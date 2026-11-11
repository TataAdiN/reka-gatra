<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import {
  ChevronDown, Code, Copy, Database, FileCode2, FileText, Fingerprint, KeyRound, Link2, Plus, Table2, Trash2,
} from '@lucide/vue'
import { useDiagramStore } from '../../stores/diagram'
import { useSchemaCopy } from '../../composables/useSchemaCopy'
import { displayType } from '../../utils/generators.mjs'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  id: { type: String, required: true },
  selected: { type: Boolean, default: false },
})

const diagram = useDiagramStore()
const { copyTable } = useSchemaCopy()
const { updateNodeInternals } = useVueFlow()

const table = computed(() => diagram.tableById(props.id))
const accent = computed(() => table.value?.color || '#6366f1')

/** Columns that take part in a relationship get a subtle highlight. */
const relatedColumns = computed(() => {
  const set = new Set()
  for (const r of diagram.relationships) {
    if (r.fromTableId === props.id) set.add(r.fromColumnId)
    if (r.toTableId === props.id) set.add(r.toColumnId)
  }
  return set
})

// Handles move when columns are added/removed/reordered: tell Vue Flow to re-measure.
watch(
  () => table.value?.columns.map((c) => c.id).join('|'),
  () => nextTick(() => updateNodeInternals([props.id])),
)

// ------------------------------------------------------------ inline rename
const editingName = ref(false)
const nameInput = ref(null)
function startRename() {
  diagram.checkpoint()
  editingName.value = true
  nextTick(() => nameInput.value?.select())
}
function finishRename(e) {
  const v = e.target.value.trim().replace(/\s+/g, '_')
  if (v) table.value.tableName = v
  editingName.value = false
}

// ------------------------------------------------------------ dropdown
const menuOpen = ref(false)
const root = ref(null)
const onDocClick = (e) => {
  if (menuOpen.value && !root.value?.contains(e.target)) menuOpen.value = false
}
onMounted(() => document.addEventListener('pointerdown', onDocClick, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocClick, true))

function run(action) {
  menuOpen.value = false
  action()
}

function addColumn() {
  diagram.select('table', props.id)
  diagram.addColumn(props.id)
}
</script>

<template>
  <div
    v-if="table"
    ref="root"
    class="group/table w-[290px] rounded-xl border bg-white text-[12px] shadow-sm transition-shadow dark:bg-zinc-900"
    :class="selected
      ? 'border-transparent shadow-lg ring-2 ring-indigo-500'
      : 'border-zinc-200 hover:shadow-md dark:border-zinc-800'"
  >
    <!-- Header -->
    <div
      class="relative flex h-10 items-center gap-2 rounded-t-xl border-b border-zinc-100 pl-3 pr-1.5 dark:border-zinc-800"
      :style="{ background: `linear-gradient(to right, ${accent}1f, transparent)` }"
    >
      <div class="absolute inset-x-0 top-0 h-[3px] rounded-t-xl" :style="{ background: accent }" />
      <Table2 class="size-3.5 shrink-0" :style="{ color: accent }" />

      <input
        v-if="editingName"
        ref="nameInput"
        class="nodrag input h-6 flex-1 font-semibold"
        :value="table.tableName"
        @blur="finishRename"
        @keydown.enter="$event.target.blur()"
        @keydown.esc="editingName = false"
      />
      <span
        v-else
        class="min-w-0 flex-1 truncate font-semibold text-zinc-900 dark:text-zinc-50"
        title="Double-click to rename"
        @dblclick.stop="startRename"
      >{{ table.tableName }}</span>

      <!-- Pinned quick actions -->
      <div class="nodrag flex items-center opacity-60 transition-opacity group-hover/table:opacity-100" :class="{ 'opacity-100': selected }">
        <button class="node-action" title="Copy SQL" @click.stop="copyTable('sql', table)">
          <Database class="size-3.5" />
        </button>
        <button class="node-action" title="Copy Markdown" @click.stop="copyTable('markdown', table)">
          <FileText class="size-3.5" />
        </button>
        <button class="node-action" title="Duplicate" @click.stop="diagram.duplicateTable(id)">
          <Copy class="size-3.5" />
        </button>
        <button class="node-action hover:!text-red-500" title="Delete" @click.stop="diagram.removeTable(id)">
          <Trash2 class="size-3.5" />
        </button>
        <div class="relative">
          <button class="node-action" :class="{ '!bg-zinc-200 dark:!bg-zinc-700': menuOpen }" title="More export options" @click.stop="menuOpen = !menuOpen">
            <ChevronDown class="size-3.5" />
          </button>
          <div v-if="menuOpen" class="menu right-0 top-7" @pointerdown.stop @wheel.stop>
            <p class="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Copy as</p>
            <button class="menu-item" @click.stop="run(() => copyTable('sql', table))"><Database class="size-3.5 text-sky-500" /> SQL DDL</button>
            <button class="menu-item" @click.stop="run(() => copyTable('markdown', table))"><FileText class="size-3.5 text-emerald-500" /> Text / Markdown</button>
            <button class="menu-item" @click.stop="run(() => copyTable('laravel', table))"><FileCode2 class="size-3.5 text-red-500" /> Laravel Migration</button>
            <div class="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
            <button class="menu-item" @click.stop="run(addColumn)"><Plus class="size-3.5" /> Add column</button>
            <button class="menu-item" @click.stop="run(startRename)"><Code class="size-3.5" /> Rename table</button>
            <button class="menu-item" @click.stop="run(() => diagram.duplicateTable(id))"><Copy class="size-3.5" /> Duplicate</button>
            <button class="menu-item !text-red-500" @click.stop="run(() => diagram.removeTable(id))"><Trash2 class="size-3.5" /> Delete</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Columns -->
    <div class="py-1">
      <div
        v-for="col in table.columns"
        :key="col.id"
        class="relative flex h-[30px] items-center gap-2 px-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
        :class="{ 'bg-indigo-50/60 dark:bg-indigo-500/5': relatedColumns.has(col.id) }"
      >
        <Handle :id="`${col.id}__l`" type="source" :position="Position.Left" class="!-left-[5px]" />

        <span class="flex w-4 shrink-0 justify-center">
          <KeyRound v-if="col.isPrimary" class="size-3.5 text-amber-500" />
          <Link2 v-else-if="col.isForeign" class="size-3.5 text-sky-500" />
          <Fingerprint v-else-if="col.isUnique" class="size-3.5 text-violet-400" />
        </span>

        <span class="min-w-0 flex-1 truncate font-medium" :class="col.isPrimary ? 'text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'">
          {{ col.name }}<span v-if="col.isNullable" class="text-zinc-400">?</span>
        </span>

        <span class="flex shrink-0 items-center gap-1">
          <span v-if="col.isAutoIncrement" class="badge bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">AI</span>
          <span v-if="col.isUnique && !col.isPrimary" class="badge bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">UQ</span>
          <span v-if="col.defaultValue" class="badge max-w-16 truncate bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" :title="`Default: ${col.defaultValue}`">= {{ col.defaultValue }}</span>
          <span class="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{{ displayType(col) }}</span>
        </span>

        <Handle :id="`${col.id}__r`" type="source" :position="Position.Right" class="!-right-[5px]" />
      </div>

      <button
        class="nodrag flex h-7 w-full items-center gap-1.5 px-3 text-[11px] text-zinc-400 opacity-0 transition hover:text-indigo-500 group-hover/table:opacity-100"
        :class="{ 'opacity-100': selected }"
        @click.stop="addColumn"
      >
        <Plus class="size-3" /> Add column
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference '../../style.css';

.node-action {
  @apply grid size-6 place-items-center rounded-md text-zinc-500 transition hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white;
}
.badge {
  @apply rounded px-1 py-px text-[9px] font-semibold leading-none;
}
</style>
