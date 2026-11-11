<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  ChevronDown, Circle, Diamond, Download, FileInput, FileText, Maximize2, Moon, PanelRight, Redo2, RectangleHorizontal,
  Spline, Square, Sun, Table2, Trash2, Undo2, Workflow, Upload, Save, GitCommitHorizontal,
} from '@lucide/vue'
import { useDiagramStore } from '../stores/diagram'
import { useUiStore } from '../stores/ui'
import { FLOW_SHAPES, RELATIONSHIP_TYPES } from '../types/diagram.mjs'
import { downloadText } from '../utils/generators.mjs'

const emit = defineEmits(['add-table', 'add-shape', 'fit-view'])
const diagram = useDiagramStore()
const ui = useUiStore()

const shapeIcons = { process: Square, decision: Diamond, document: FileText, terminal: RectangleHorizontal }

const openMenu = ref(null) // 'shape' | 'file' | null
const bar = ref(null)
const toggle = (name) => (openMenu.value = openMenu.value === name ? null : name)
const onDoc = (e) => { if (!bar.value?.contains(e.target)) openMenu.value = null }
onMounted(() => document.addEventListener('pointerdown', onDoc, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDoc, true))

function addShape(kind) {
  emit('add-shape', kind)
  openMenu.value = null
}

// ------------------------------------------------------------ JSON project files
const fileInput = ref(null)
function saveJson() {
  downloadText('diagram.json', JSON.stringify(diagram.toJSON(), null, 2), 'application/json')
  openMenu.value = null
}
function openJson(e) {
  const file = e.target.files?.[0]
  if (!file) return
  file.text().then((txt) => {
    try {
      diagram.load(JSON.parse(txt))
      ui.toast(`Loaded ${file.name}`)
    } catch {
      ui.toast('Invalid diagram file', 'error')
    }
  })
  e.target.value = ''
  openMenu.value = null
}
function clearCanvas() {
  openMenu.value = null
  if (confirm('Clear the whole canvas? (You can undo this)')) diagram.clearAll()
}
</script>

<template>
  <header
    ref="bar"
    class="pointer-events-auto flex h-12 items-center gap-1 border-b border-zinc-200 bg-white/90 px-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90"
  >
    <!-- Brand -->
    <div class="mr-2 flex items-center gap-2">
      <div class="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
        <Workflow class="size-4" />
      </div>
      <div class="hidden leading-tight sm:block">
        <p class="text-sm font-semibold">Reka Gatra</p>
        <p class="text-[10px] text-zinc-400">Schema &amp; Flow Canvas</p>
      </div>
    </div>

    <div class="divider" />

    <!-- Insert -->
    <button class="btn btn-ghost" title="Add table" @click="emit('add-table')">
      <Table2 class="size-4 text-indigo-500" /> <span class="hidden md:inline">Table</span>
    </button>

    <div class="relative">
      <button class="btn btn-ghost" :class="{ 'bg-zinc-100 dark:bg-zinc-800': openMenu === 'shape' }" title="Add flow shape" @click="toggle('shape')">
        <Circle class="size-4 text-sky-500" /> <span class="hidden md:inline">Shape</span> <ChevronDown class="size-3 opacity-60" />
      </button>
      <div v-if="openMenu === 'shape'" class="menu left-0 top-9">
        <button v-for="s in FLOW_SHAPES" :key="s.value" class="menu-item" @click="addShape(s.value)">
          <component :is="shapeIcons[s.value]" class="size-3.5 text-sky-500" /> {{ s.label }}
        </button>
      </div>
    </div>

    <div class="divider" />

    <!-- Connector settings -->
    <div class="segmented" title="Connector line style">
      <button :class="{ active: ui.edgeStyle === 'bezier' }" title="Bezier" @click="ui.edgeStyle = 'bezier'"><Spline class="size-3.5" /></button>
      <button :class="{ active: ui.edgeStyle === 'orthogonal' }" title="Orthogonal" @click="ui.edgeStyle = 'orthogonal'"><GitCommitHorizontal class="size-3.5" /></button>
    </div>
    <div class="segmented ml-1" title="Relationship type for new table connectors">
      <button
        v-for="t in RELATIONSHIP_TYPES"
        :key="t"
        class="font-mono !text-[10px] font-semibold"
        :class="{ active: ui.defaultRelType === t }"
        @click="ui.defaultRelType = t"
      >{{ t }}</button>
    </div>

    <div class="divider" />

    <button class="btn btn-ghost !px-2" :disabled="!diagram.canUndo" title="Undo (Ctrl+Z)" @click="diagram.undo()"><Undo2 class="size-4" /></button>
    <button class="btn btn-ghost !px-2" :disabled="!diagram.canRedo" title="Redo (Ctrl+Shift+Z)" @click="diagram.redo()"><Redo2 class="size-4" /></button>
    <button class="btn btn-ghost !px-2" title="Fit view to all nodes" @click="emit('fit-view')"><Maximize2 class="size-4" /></button>

    <div class="flex-1" />

    <!-- File / import / export -->
    <button class="btn btn-ghost" title="Paste CREATE TABLE statements" @click="ui.importOpen = true">
      <FileInput class="size-4" /> <span class="hidden lg:inline">Import SQL</span>
    </button>

    <div class="relative">
      <button class="btn btn-ghost !px-2" title="Project file" @click="toggle('file')"><Save class="size-4" /></button>
      <div v-if="openMenu === 'file'" class="menu right-0 top-9">
        <button class="menu-item" @click="saveJson"><Download class="size-3.5" /> Save diagram (.json)</button>
        <button class="menu-item" @click="fileInput.click()"><Upload class="size-3.5" /> Open diagram (.json)</button>
        <div class="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
        <button class="menu-item !text-red-500" @click="clearCanvas"><Trash2 class="size-3.5" /> Clear canvas</button>
      </div>
      <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="openJson" />
    </div>

    <button class="btn btn-primary ml-1" @click="ui.exportOpen = true">
      <Download class="size-4" /> Export All
    </button>

    <div class="divider" />

    <button class="btn btn-ghost !px-2" :title="ui.theme === 'dark' ? 'Light mode' : 'Dark mode'" @click="ui.toggleTheme()">
      <Sun v-if="ui.theme === 'dark'" class="size-4" />
      <Moon v-else class="size-4" />
    </button>
    <button class="btn btn-ghost !px-2" :class="{ 'text-indigo-500': ui.inspectorOpen }" title="Toggle inspector" @click="ui.inspectorOpen = !ui.inspectorOpen">
      <PanelRight class="size-4" />
    </button>
  </header>
</template>

<style scoped>
@reference '../style.css';

.divider {
  @apply mx-1.5 h-5 w-px bg-zinc-200 dark:bg-zinc-800;
}
.segmented {
  @apply flex rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-800;
}
.segmented button {
  @apply grid h-6 min-w-7 place-items-center rounded px-1.5 text-xs text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white;
}
.segmented button.active {
  @apply bg-white text-indigo-600 shadow-sm dark:bg-zinc-950 dark:text-indigo-400;
}
</style>

