<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ConnectionMode, MarkerType, VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { Table2 } from '@lucide/vue'

import TopBar from '../components/TopBar.vue'
import InspectorPanel from '../components/InspectorPanel.vue'
import ExportModal from '../components/ExportModal.vue'
import ImportSqlModal from '../components/ImportSqlModal.vue'
import ProjectModal from '../components/ProjectModal.vue'
import ToastContainer from '../components/ToastContainer.vue'
import TableNode from '../components/nodes/TableNode.vue'
import FlowNode from '../components/nodes/FlowNode.vue'
import RelationEdge from '../components/edges/RelationEdge.vue'
import FlowEdge from '../components/edges/FlowEdge.vue'
import { useDiagramStore } from '../stores/diagram'
import { useUiStore } from '../stores/ui'
import { useProjectStore } from '../stores/project'

const FLOW_ID = 'schema-canvas'
const TABLE_WIDTH = 290

const diagram = useDiagramStore()
const ui = useUiStore()
const project = useProjectStore()
const { findNode, screenToFlowCoordinate, fitView } = useVueFlow(FLOW_ID)

const wrapper = ref(null)

// ------------------------------------------------------------------ store -> Vue Flow mapping
const nodes = computed(() => [
  ...diagram.tables.map((t) => ({
    id: t.id,
    type: 'table',
    position: { x: t.position.x, y: t.position.y },
    selected: diagram.isSelected('table', t.id),
  })),
  ...diagram.shapes.map((s) => ({
    id: s.id,
    type: 'flow',
    position: { x: s.position.x, y: s.position.y },
    selected: diagram.isSelected('shape', s.id),
  })),
])

/** Live geometry from Vue Flow (follows the node while it is being dragged). */
function geometry(id) {
  const n = findNode(id)
  const fallback = diagram.tableById(id)?.position ?? { x: 0, y: 0 }
  return { x: n?.position.x ?? fallback.x, w: n?.dimensions.width || TABLE_WIDTH }
}

/** Picks the left/right column handles so connectors take the shortest horizontal route. */
function pickSides(fromId, toId) {
  if (fromId === toId) return ['r', 'r']
  const a = geometry(fromId)
  const b = geometry(toId)
  if (a.x + a.w + 40 < b.x) return ['r', 'l']
  if (b.x + b.w + 40 < a.x) return ['l', 'r']
  return a.x <= b.x ? ['l', 'l'] : ['r', 'r']
}

const edges = computed(() => {
  const arrowColor = ui.theme === 'dark' ? '#a1a1aa' : '#52525b'
  return [
    ...diagram.relationships.map((r) => {
      const [s, t] = pickSides(r.fromTableId, r.toTableId)
      return {
        id: r.id,
        type: 'relation',
        source: r.fromTableId,
        sourceHandle: `${r.fromColumnId}__${s}`,
        target: r.toTableId,
        targetHandle: `${r.toColumnId}__${t}`,
        selected: diagram.isSelected('relationship', r.id),
      }
    }),
    ...diagram.connectors.map((c) => {
      const selected = diagram.isSelected('connector', c.id)
      return {
        id: c.id,
        type: 'flow',
        source: c.source,
        sourceHandle: c.sourceHandle,
        target: c.target,
        targetHandle: c.targetHandle,
        selected,
        markerEnd: { type: MarkerType.ArrowClosed, color: selected ? '#6366f1' : arrowColor, width: 18, height: 18 },
      }
    }),
  ]
})

// ------------------------------------------------------------------ Vue Flow events
function onConnect(params) {
  const error = diagram.connect(params, ui.defaultRelType)
  if (error) ui.toast(error, 'info')
}

function isValidConnection(c) {
  const bothTables = diagram.tableById(c.source) && diagram.tableById(c.target)
  const bothShapes = diagram.shapeById(c.source) && diagram.shapeById(c.target) && c.source !== c.target
  return Boolean(bothTables || bothShapes)
}

const onNodeDragStart = () => diagram.checkpoint()
function onNodeDragStop({ nodes: moved }) {
  for (const n of moved) diagram.moveNode(n.id, n.position)
}

const onNodeClick = ({ node }) => diagram.select(node.type === 'table' ? 'table' : 'shape', node.id)
const onEdgeClick = ({ edge }) => diagram.select(edge.type === 'relation' ? 'relationship' : 'connector', edge.id)
const onPaneClick = () => diagram.clearSelection()

const minimapColor = (node) =>
  node.type === 'table' ? diagram.tableById(node.id)?.color ?? '#6366f1' : diagram.shapeById(node.id)?.color ?? '#0ea5e9'

// ------------------------------------------------------------------ insert helpers
/** Flow-space coordinate of the visible canvas centre. */
function viewportCenter() {
  const rect = wrapper.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return screenToFlowCoordinate({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
}

function jitter() {
  return Math.round((Math.random() - 0.5) * 60)
}

function addTable() {
  const c = viewportCenter()
  diagram.addTable({ x: c.x - TABLE_WIDTH / 2 + jitter(), y: c.y - 80 + jitter() })
  ui.inspectorOpen = true
}

function addShape(kind) {
  const c = viewportCenter()
  diagram.addShape(kind, { x: c.x - 80 + jitter(), y: c.y - 35 + jitter() })
}

async function onImport(parsed, options) {
  const c = viewportCenter()
  const created = diagram.importParsed(parsed, { ...options, origin: { x: c.x - 300, y: c.y - 200 } })
  ui.importOpen = false
  ui.toast(`Generated ${created.length} table${created.length === 1 ? '' : 's'} from SQL`)
  await nextTick()
  setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 60)
}

// ------------------------------------------------------------------ keyboard shortcuts
function onKeydown(e) {
  const el = e.target
  if (el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
  const mod = e.ctrlKey || e.metaKey
  const key = e.key.toLowerCase()

  if (mod && key === 's') {
    e.preventDefault()
    project.saveFile()
  } else if (mod && key === 'z') {
    e.preventDefault()
    e.shiftKey ? diagram.redo() : diagram.undo()
  } else if (mod && key === 'y') {
    e.preventDefault()
    diagram.redo()
  } else if (mod && key === 'd') {
    e.preventDefault()
    diagram.duplicateSelected()
  } else if (key === 'delete' || key === 'backspace') {
    diagram.removeSelected()
  } else if (key === 'escape') {
    diagram.clearSelection()
    ui.exportOpen = ui.importOpen = ui.projectOpen = false
  } else if (!mod && key === 't') {
    addTable()
  } else if (!mod && key === 's') {
    addShape('process')
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="flex h-full flex-col">
    <TopBar
      @add-table="addTable"
      @add-shape="addShape"
      @fit-view="() => fitView({ padding: 0.2, duration: 400 })"
    />

    <div ref="wrapper" class="relative flex-1 overflow-hidden">
      <VueFlow
        :id="FLOW_ID"
        :nodes="nodes"
        :edges="edges"
        :connection-mode="ConnectionMode.Loose"
        :is-valid-connection="isValidConnection"
        :delete-key-code="null"
        :min-zoom="0.15"
        :max-zoom="2.5"
        :snap-to-grid="true"
        :snap-grid="[10, 10]"
        :elevate-edges-on-select="true"
        :default-viewport="{ x: 0, y: 0, zoom: 1 }"
        fit-view-on-init
        class="h-full w-full"
        @connect="onConnect"
        @node-drag-start="onNodeDragStart"
        @node-drag-stop="onNodeDragStop"
        @node-click="onNodeClick"
        @edge-click="onEdgeClick"
        @pane-click="onPaneClick"
      >
        <template #node-table="props">
          <TableNode v-bind="props" />
        </template>
        <template #node-flow="props">
          <FlowNode v-bind="props" />
        </template>
        <template #edge-relation="props">
          <RelationEdge v-bind="props" />
        </template>
        <template #edge-flow="props">
          <FlowEdge v-bind="props" />
        </template>

        <Background :gap="20" :size="1.2" :pattern-color="ui.theme === 'dark' ? '#3f3f46' : '#d4d4d8'" />
        <Controls position="bottom-left" :show-interactive="false" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          :node-color="minimapColor"
          :node-border-radius="6"
          :mask-color="ui.theme === 'dark' ? 'rgba(9,9,11,0.7)' : 'rgba(244,244,245,0.7)'"
          :class="{ '!right-[376px]': ui.inspectorOpen }"
        />
      </VueFlow>

      <!-- Empty state -->
      <div v-if="!diagram.tables.length && !diagram.shapes.length" class="pointer-events-none absolute inset-0 grid place-items-center">
        <div class="text-center text-zinc-400">
          <Table2 class="mx-auto mb-3 size-10 opacity-50" />
          <p class="text-sm font-medium">Your canvas is empty</p>
          <p class="mt-1 text-xs">Press <kbd class="rounded border px-1">T</kbd> to add a table or use <b>Import SQL</b>.</p>
        </div>
      </div>

      <Transition name="slide">
        <div v-if="ui.inspectorOpen" class="pointer-events-none absolute bottom-3 right-3 top-3 z-10">
          <InspectorPanel />
        </div>
      </Transition>
    </div>

    <ExportModal v-if="ui.exportOpen" />
    <ImportSqlModal v-if="ui.importOpen" @import="onImport" />
    <ProjectModal v-if="ui.projectOpen" />
    <ToastContainer />
  </div>
</template>
