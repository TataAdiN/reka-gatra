/**
 * Diagram domain model (plain JavaScript + JSDoc typedefs).
 *
 * Relationship direction convention:
 *   from = parent / referenced side (usually the PK column, the "1" side)
 *   to   = child  / referencing side (the FK column, the "N" side)
 * So a `1:N` relationship reads naturally "from (1) -> to (N)".
 */

/**
 * @typedef {'integer'|'bigint'|'smallint'|'varchar'|'char'|'text'|'boolean'|'timestamp'|'datetime'|'date'|'decimal'|'float'|'json'|'uuid'} DataType
 */

/**
 * @typedef {Object} Column
 * @property {string} id
 * @property {string} name
 * @property {DataType} type
 * @property {string} [length]        e.g. "255" or "10,2"
 * @property {boolean} isPrimary
 * @property {boolean} isForeign
 * @property {boolean} isNullable
 * @property {boolean} isUnique
 * @property {boolean} isAutoIncrement
 * @property {string} [defaultValue]
 */

/**
 * @typedef {Object} TableNode
 * @property {string} id
 * @property {string} tableName
 * @property {{x:number,y:number}} position
 * @property {Column[]} columns
 * @property {string} [color]
 */

/**
 * @typedef {'1:1'|'1:N'|'N:M'} RelationshipType
 *
 * @typedef {Object} Relationship
 * @property {string} id
 * @property {string} fromTableId
 * @property {string} fromColumnId
 * @property {string} toTableId
 * @property {string} toColumnId
 * @property {RelationshipType} type
 */

/**
 * @typedef {'process'|'decision'|'document'|'terminal'} FlowShapeKind
 *
 * @typedef {Object} FlowShape
 * @property {string} id
 * @property {FlowShapeKind} shape
 * @property {string} label
 * @property {{x:number,y:number}} position
 * @property {number} width
 * @property {number} height
 * @property {string} [color]
 *
 * @typedef {Object} FlowConnector
 * @property {string} id
 * @property {string} source
 * @property {string} sourceHandle
 * @property {string} target
 * @property {string} targetHandle
 * @property {string} [label]
 */

import { uid } from '../utils/id.mjs'

/** @type {DataType[]} */
export const DATA_TYPES = [
  'integer', 'bigint', 'smallint', 'varchar', 'char', 'text', 'boolean',
  'timestamp', 'datetime', 'date', 'decimal', 'float', 'json', 'uuid',
]

/** Types that accept a length / precision argument. */
export const LENGTH_TYPES = ['varchar', 'char', 'decimal']

/** @type {RelationshipType[]} */
export const RELATIONSHIP_TYPES = ['1:1', '1:N', 'N:M']

/** @type {{value: FlowShapeKind, label: string}[]} */
export const FLOW_SHAPES = [
  { value: 'process', label: 'Process' },
  { value: 'decision', label: 'Decision' },
  { value: 'document', label: 'Document' },
  { value: 'terminal', label: 'Start / End' },
]

/** Accent palette shared by table headers and flow shapes. */
export const COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b',
]

/** @returns {Column} */
export function createColumn(overrides = {}) {
  return {
    id: uid('col'),
    name: 'column',
    type: 'varchar',
    length: '255',
    isPrimary: false,
    isForeign: false,
    isNullable: false,
    isUnique: false,
    isAutoIncrement: false,
    defaultValue: '',
    ...overrides,
  }
}

/** @returns {TableNode} */
export function createTable(overrides = {}) {
  return {
    id: uid('tbl'),
    tableName: 'new_table',
    position: { x: 0, y: 0 },
    color: COLORS[0],
    columns: [
      createColumn({ name: 'id', type: 'bigint', length: '', isPrimary: true, isAutoIncrement: true }),
      createColumn({ name: 'created_at', type: 'timestamp', length: '', isNullable: true }),
      createColumn({ name: 'updated_at', type: 'timestamp', length: '', isNullable: true }),
    ],
    ...overrides,
  }
}

const SHAPE_SIZES = {
  process: { width: 160, height: 70 },
  decision: { width: 150, height: 110 },
  document: { width: 160, height: 80 },
  terminal: { width: 150, height: 56 },
}

/** @returns {FlowShape} */
export function createShape(shape = 'process', overrides = {}) {
  const label = FLOW_SHAPES.find((s) => s.value === shape)?.label ?? 'Step'
  return {
    id: uid('shp'),
    shape,
    label: shape === 'terminal' ? 'Start' : label,
    position: { x: 0, y: 0 },
    ...SHAPE_SIZES[shape],
    color: COLORS[1],
    ...overrides,
  }
}

/** Returns the cardinality ("one" | "many") of each end of a relationship. */
export function relationshipEnds(type) {
  if (type === '1:1') return { from: 'one', to: 'one' }
  if (type === 'N:M') return { from: 'many', to: 'many' }
  return { from: 'one', to: 'many' }
}

