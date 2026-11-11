import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { createColumn, createShape, createTable } from '../types/diagram.mjs'
import { uid } from '../utils/id.mjs'
import { resolveForeignKeys } from '../utils/sqlParser.mjs'
import { createSampleDiagram } from './sample.js'

const STORAGE_KEY = 'reka-gatra:diagram'
const HISTORY_LIMIT = 100

/** Column handle ids are `<columnId>__l` / `<columnId>__r`. */
export const columnFromHandle = (handle) => (handle ? handle.replace(/__[lr]$/, '') : null)

/**
 * Central diagram state.
 * Domain objects (tables / shapes / relationships / connectors) are the single source of truth;
 * the canvas maps them to Vue Flow nodes & edges.
 */
export const useDiagramStore = defineStore('diagram', () => {
  /** @type {import('vue').Ref<import('../types/diagram.mjs').TableNode[]>} */
  const tables = ref([])
  /** @type {import('vue').Ref<import('../types/diagram.mjs').FlowShape[]>} */
  const shapes = ref([])
  /** @type {import('vue').Ref<import('../types/diagram.mjs').Relationship[]>} */
  const relationships = ref([])
  /** @type {import('vue').Ref<import('../types/diagram.mjs').FlowConnector[]>} */
  const connectors = ref([])

  /** @type {import('vue').Ref<{kind:'table'|'shape'|'relationship'|'connector', id:string} | null>} */
  const selection = ref(null)

  // ---------------------------------------------------------------- getters
  const tableById = (id) => tables.value.find((t) => t.id === id)
  const shapeById = (id) => shapes.value.find((s) => s.id === id)
  const isSelected = (kind, id) => selection.value?.kind === kind && selection.value?.id === id

  const selectedTable = computed(() => (selection.value?.kind === 'table' ? tableById(selection.value.id) : null))
  const selectedShape = computed(() => (selection.value?.kind === 'shape' ? shapeById(selection.value.id) : null))
  const selectedRelationship = computed(() =>
    selection.value?.kind === 'relationship' ? relationships.value.find((r) => r.id === selection.value.id) : null,
  )
  const selectedConnector = computed(() =>
    selection.value?.kind === 'connector' ? connectors.value.find((c) => c.id === selection.value.id) : null,
  )

  // ---------------------------------------------------------------- history (snapshot based)
  const past = ref([])
  const future = ref([])
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  const snapshot = () =>
    JSON.stringify({ tables: tables.value, shapes: shapes.value, relationships: relationships.value, connectors: connectors.value })

  function restore(json) {
    const data = JSON.parse(json)
    tables.value = data.tables ?? []
    shapes.value = data.shapes ?? []
    relationships.value = data.relationships ?? []
    connectors.value = data.connectors ?? []
    if (selection.value && !selectionExists(selection.value)) selection.value = null
  }

  function selectionExists({ kind, id }) {
    const list = { table: tables, shape: shapes, relationship: relationships, connector: connectors }[kind]
    return list?.value.some((x) => x.id === id)
  }

  /** Call BEFORE a mutation to make it undoable. Consecutive identical states are collapsed. */
  function checkpoint() {
    const snap = snapshot()
    if (past.value[past.value.length - 1] === snap) return
    past.value.push(snap)
    if (past.value.length > HISTORY_LIMIT) past.value.shift()
    future.value = []
  }

  function undo() {
    if (!past.value.length) return
    let prev = past.value.pop()
    const current = snapshot()
    // Skip checkpoints that equal the current state (e.g. focus without edit).
    while (prev === current && past.value.length) prev = past.value.pop()
    if (prev === current) return
    future.value.push(current)
    restore(prev)
  }

  function redo() {
    if (!future.value.length) return
    past.value.push(snapshot())
    restore(future.value.pop())
  }

  // ---------------------------------------------------------------- selection
  function select(kind, id) {
    selection.value = kind && id ? { kind, id } : null
  }
  const clearSelection = () => (selection.value = null)

  // ---------------------------------------------------------------- tables
  function uniqueTableName(base) {
    let name = base
    let i = 1
    while (tables.value.some((t) => t.tableName === name)) name = `${base}_${i++}`
    return name
  }

  function addTable(position = { x: 0, y: 0 }) {
    checkpoint()
    const table = createTable({ position: { ...position }, tableName: uniqueTableName('new_table') })
    tables.value.push(table)
    select('table', table.id)
    return table
  }

  function duplicateTable(id) {
    const src = tableById(id)
    if (!src) return
    checkpoint()
    const copy = {
      ...JSON.parse(JSON.stringify(src)),
      id: uid('tbl'),
      tableName: uniqueTableName(`${src.tableName}_copy`),
      position: { x: src.position.x + 40, y: src.position.y + 40 },
    }
    copy.columns = copy.columns.map((c) => ({ ...c, id: uid('col') }))
    tables.value.push(copy)
    select('table', copy.id)
    return copy
  }

  function removeTable(id) {
    checkpoint()
    tables.value = tables.value.filter((t) => t.id !== id)
    relationships.value = relationships.value.filter((r) => r.fromTableId !== id && r.toTableId !== id)
    if (isSelected('table', id)) clearSelection()
    recomputeForeignFlags()
  }

  function addColumn(tableId, overrides = {}) {
    const table = tableById(tableId)
    if (!table) return
    checkpoint()
    let name = overrides.name ?? 'column'
    let i = 1
    while (table.columns.some((c) => c.name === name)) name = `column_${i++}`
    const col = createColumn({ ...overrides, name })
    // Insert before trailing timestamp columns so they stay at the bottom.
    const tsIndex = table.columns.findIndex((c) => ['created_at', 'updated_at', 'deleted_at'].includes(c.name))
    if (tsIndex === -1) table.columns.push(col)
    else table.columns.splice(tsIndex, 0, col)
    return col
  }

  function removeColumn(tableId, columnId) {
    const table = tableById(tableId)
    if (!table) return
    checkpoint()
    table.columns = table.columns.filter((c) => c.id !== columnId)
    relationships.value = relationships.value.filter((r) => r.fromColumnId !== columnId && r.toColumnId !== columnId)
    recomputeForeignFlags()
  }

  function moveColumn(tableId, columnId, delta) {
    const table = tableById(tableId)
    const idx = table?.columns.findIndex((c) => c.id === columnId) ?? -1
    const next = idx + delta
    if (idx < 0 || next < 0 || next >= table.columns.length) return
    checkpoint()
    const [col] = table.columns.splice(idx, 1)
    table.columns.splice(next, 0, col)
  }

  /** Keeps `isForeign` in sync for columns that are the child side of a relationship. */
  function recomputeForeignFlags() {
    const childCols = new Set(relationships.value.map((r) => r.toColumnId))
    for (const t of tables.value) {
      for (const c of t.columns) {
        if (childCols.has(c.id)) c.isForeign = true
      }
    }
  }

  // ---------------------------------------------------------------- flow shapes
  function addShape(kind, position = { x: 0, y: 0 }) {
    checkpoint()
    const shape = createShape(kind, { position: { ...position } })
    shapes.value.push(shape)
    select('shape', shape.id)
    return shape
  }

  function duplicateShape(id) {
    const src = shapeById(id)
    if (!src) return
    checkpoint()
    const copy = { ...JSON.parse(JSON.stringify(src)), id: uid('shp'), position: { x: src.position.x + 30, y: src.position.y + 30 } }
    shapes.value.push(copy)
    select('shape', copy.id)
  }

  function removeShape(id) {
    checkpoint()
    shapes.value = shapes.value.filter((s) => s.id !== id)
    connectors.value = connectors.value.filter((c) => c.source !== id && c.target !== id)
    if (isSelected('shape', id)) clearSelection()
  }

  // ---------------------------------------------------------------- connections
  /**
   * Handles a Vue Flow `connect` event.
   * Table <-> table creates a Relationship (FK); shape <-> shape creates a FlowConnector.
   * @returns {string|null} error message, if any
   */
  function connect({ source, sourceHandle, target, targetHandle }, relType = '1:N') {
    const srcTable = tableById(source)
    const tgtTable = tableById(target)

    if (srcTable && tgtTable) {
      let a = { table: srcTable, col: srcTable.columns.find((c) => c.id === columnFromHandle(sourceHandle)) }
      let b = { table: tgtTable, col: tgtTable.columns.find((c) => c.id === columnFromHandle(targetHandle)) }
      if (!a.col || !b.col) return 'Connect two columns to create a relationship.'
      if (a.col.id === b.col.id) return 'A column cannot reference itself.'
      // Parent (from) should be the PK / unique side; child (to) holds the FK.
      if (!a.col.isPrimary && (b.col.isPrimary || b.col.isUnique)) [a, b] = [b, a]
      const exists = relationships.value.some(
        (r) => (r.fromColumnId === a.col.id && r.toColumnId === b.col.id) || (r.fromColumnId === b.col.id && r.toColumnId === a.col.id),
      )
      if (exists) return 'These columns are already related.'
      checkpoint()
      if (relType !== 'N:M') b.col.isForeign = true
      const rel = { id: uid('rel'), fromTableId: a.table.id, fromColumnId: a.col.id, toTableId: b.table.id, toColumnId: b.col.id, type: relType }
      relationships.value.push(rel)
      select('relationship', rel.id)
      return null
    }

    if (shapeById(source) && shapeById(target)) {
      if (source === target) return null
      checkpoint()
      const con = { id: uid('con'), source, sourceHandle, target, targetHandle, label: '' }
      connectors.value.push(con)
      return null
    }

    return 'Tables can only connect to tables, and shapes to shapes.'
  }

  function removeRelationship(id) {
    checkpoint()
    const rel = relationships.value.find((r) => r.id === id)
    relationships.value = relationships.value.filter((r) => r.id !== id)
    // Clear the FK flag if no other relationship still references that column.
    if (rel && !relationships.value.some((r) => r.toColumnId === rel.toColumnId)) {
      const col = tableById(rel.toTableId)?.columns.find((c) => c.id === rel.toColumnId)
      if (col) col.isForeign = false
    }
    if (isSelected('relationship', id)) clearSelection()
  }

  function swapRelationship(id) {
    const rel = relationships.value.find((r) => r.id === id)
    if (!rel) return
    checkpoint()
    ;[rel.fromTableId, rel.toTableId] = [rel.toTableId, rel.fromTableId]
    ;[rel.fromColumnId, rel.toColumnId] = [rel.toColumnId, rel.fromColumnId]
    const oldChild = tableById(rel.fromTableId)?.columns.find((c) => c.id === rel.fromColumnId)
    if (oldChild && !relationships.value.some((r) => r.toColumnId === oldChild.id)) oldChild.isForeign = false
    recomputeForeignFlags()
  }

  function removeConnector(id) {
    checkpoint()
    connectors.value = connectors.value.filter((c) => c.id !== id)
    if (isSelected('connector', id)) clearSelection()
  }

  // ---------------------------------------------------------------- generic
  function moveNode(id, position) {
    const item = tableById(id) ?? shapeById(id)
    if (item) item.position = { x: Math.round(position.x), y: Math.round(position.y) }
  }

  function removeSelected() {
    const s = selection.value
    if (!s) return
    if (s.kind === 'table') removeTable(s.id)
    else if (s.kind === 'shape') removeShape(s.id)
    else if (s.kind === 'relationship') removeRelationship(s.id)
    else if (s.kind === 'connector') removeConnector(s.id)
  }

  function duplicateSelected() {
    const s = selection.value
    if (s?.kind === 'table') duplicateTable(s.id)
    else if (s?.kind === 'shape') duplicateShape(s.id)
  }

  /**
   * Adds tables produced by the SQL reverse parser.
   * @param {{tables:Array<{tableName:string, columns:any[]}>, foreignKeys:any[]}} parsed
   * @param {{replace?: boolean, origin?: {x:number,y:number}}} options
   */
  function importParsed(parsed, { replace = false, origin = { x: 0, y: 0 } } = {}) {
    checkpoint()
    if (replace) {
      tables.value = []
      relationships.value = []
    }
    const perRow = Math.max(1, Math.ceil(Math.sqrt(parsed.tables.length)))
    const rowHeights = []
    const created = parsed.tables.map((pt, i) => {
      const row = Math.floor(i / perRow)
      const col = i % perRow
      rowHeights[row] = Math.max(rowHeights[row] ?? 0, 60 + pt.columns.length * 30)
      const y = origin.y + rowHeights.slice(0, row).reduce((a, h) => a + h + 60, 0)
      const existing = tables.value.find((t) => t.tableName === pt.tableName)
      if (existing && !replace) {
        // Same table name: replace its columns in place, drop relations to removed columns.
        relationships.value = relationships.value.filter((r) => r.fromTableId !== existing.id && r.toTableId !== existing.id)
        existing.columns = pt.columns
        return existing
      }
      return createTable({ tableName: pt.tableName, columns: pt.columns, position: { x: origin.x + col * 340, y } })
    })
    tables.value.push(...created.filter((t) => !tables.value.includes(t)))
    relationships.value.push(...resolveForeignKeys(parsed.foreignKeys, tables.value))
    clearSelection()
    return created
  }

  function toJSON() {
    return { version: 1, tables: tables.value, shapes: shapes.value, relationships: relationships.value, connectors: connectors.value }
  }

  function load(data, { undoable = true } = {}) {
    if (undoable) checkpoint()
    restore(JSON.stringify(data))
    clearSelection()
  }

  function clearAll() {
    checkpoint()
    restore(JSON.stringify({}))
    clearSelection()
  }

  // ---------------------------------------------------------------- persistence
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    load(saved ? JSON.parse(saved) : createSampleDiagram(), { undoable: false })
  } catch {
    load(createSampleDiagram(), { undoable: false })
  }

  let saveTimer
  watch([tables, shapes, relationships, connectors], () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(toJSON())), 300)
  }, { deep: true })

  return {
    tables, shapes, relationships, connectors, selection,
    tableById, shapeById, isSelected,
    selectedTable, selectedShape, selectedRelationship, selectedConnector,
    canUndo, canRedo, checkpoint, undo, redo,
    select, clearSelection,
    addTable, duplicateTable, removeTable, addColumn, removeColumn, moveColumn,
    addShape, duplicateShape, removeShape,
    connect, removeRelationship, swapRelationship, removeConnector,
    moveNode, removeSelected, duplicateSelected,
    importParsed, toJSON, load, clearAll,
  }
})

