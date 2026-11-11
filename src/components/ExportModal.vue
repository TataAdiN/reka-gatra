<script setup>
import { computed, ref } from 'vue'
import { Copy, Database, Download, FileCode2, FileText, X } from '@lucide/vue'
import { useDiagramStore } from '../stores/diagram'
import { useUiStore } from '../stores/ui'
import { useSchemaCopy } from '../composables/useSchemaCopy'
import { FORMATS, downloadText, generateAll } from '../utils/generators.mjs'

const diagram = useDiagramStore()
const ui = useUiStore()
const { copyAll } = useSchemaCopy()

const format = ref('sql')
const tabs = [
  { value: 'sql', label: 'SQL (.sql)', icon: Database, color: 'text-sky-500' },
  { value: 'markdown', label: 'Markdown (.md)', icon: FileText, color: 'text-emerald-500' },
  { value: 'laravel', label: 'Laravel (.php)', icon: FileCode2, color: 'text-red-500' },
]

const output = computed(() => generateAll(format.value, diagram.tables, diagram.relationships, ui.dialect))

function download() {
  const { ext, mime } = FORMATS[format.value]
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '_')
  const name = format.value === 'laravel' ? `${stamp}_000000_create_schema_tables.php` : `schema.${ext}`
  downloadText(name, output.value, mime)
  ui.toast(`Downloaded ${name}`)
}
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-zinc-950/40 p-6 backdrop-blur-sm" @click.self="ui.exportOpen = false">
    <div class="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
      <div class="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
        <div>
          <h2 class="text-sm font-semibold">Export all tables</h2>
          <p class="text-xs text-zinc-500">{{ diagram.tables.length }} tables · {{ diagram.relationships.length }} relationships · ordered by FK dependency</p>
        </div>
        <button class="btn btn-ghost !p-1" @click="ui.exportOpen = false"><X class="size-4" /></button>
      </div>

      <div class="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-5 py-2.5 dark:border-zinc-800">
        <button
          v-for="t in tabs"
          :key="t.value"
          class="btn"
          :class="format === t.value ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white' : 'btn-ghost'"
          @click="format = t.value"
        >
          <component :is="t.icon" class="size-3.5" :class="t.color" /> {{ t.label }}
        </button>
        <div class="flex-1" />
        <select v-if="format === 'sql'" v-model="ui.dialect" class="input !w-auto">
          <option value="mysql">MySQL / MariaDB</option>
          <option value="postgresql">PostgreSQL</option>
        </select>
      </div>

      <pre class="scrollbar-thin min-h-64 flex-1 overflow-auto bg-zinc-50 p-5 font-mono text-[12px] leading-relaxed text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">{{ output }}</pre>

      <div class="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
        <button class="btn btn-outline" @click="copyAll(format)"><Copy class="size-3.5" /> Copy</button>
        <button class="btn btn-primary" :disabled="!diagram.tables.length" @click="download"><Download class="size-3.5" /> Download</button>
      </div>
    </div>
  </div>
</template>

