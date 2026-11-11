<script setup>
import { computed, ref } from 'vue'
import {
  ArrowDown, ArrowLeftRight, ArrowUp, Copy, Database, FileCode2, FileText, Keyboard, MousePointerClick, Plus, Trash2, X,
} from '@lucide/vue'
import { useDiagramStore } from '../stores/diagram'
import { useUiStore } from '../stores/ui'
import { useSchemaCopy } from '../composables/useSchemaCopy'
import { COLORS, DATA_TYPES, FLOW_SHAPES, LENGTH_TYPES, RELATIONSHIP_TYPES } from '../types/diagram.mjs'
import { generateTable } from '../utils/generators.mjs'

const diagram = useDiagramStore()
const ui = useUiStore()
const { copyTable, context } = useSchemaCopy()

const table = computed(() => diagram.selectedTable)
const shape = computed(() => diagram.selectedShape)
const rel = computed(() => diagram.selectedRelationship)
const connector = computed(() => diagram.selectedConnector)

/** Undoable single-field update (for checkboxes / selects / swatches). */
function set(obj, key, value) {
  diagram.checkpoint()
  obj[key] = value
}

function setType(col, type) {
  diagram.checkpoint()
  col.type = type
  if (!LENGTH_TYPES.includes(type)) col.length = ''
  else if (!col.length) col.length = type === 'decimal' ? '10,2' : type === 'char' ? '1' : '255'
  if (type !== 'integer' && type !== 'bigint' && type !== 'smallint') col.isAutoIncrement = false
}

function togglePrimary(col) {
  diagram.checkpoint()
  col.isPrimary = !col.isPrimary
  if (col.isPrimary) col.isNullable = false
}

const flags = [
  { key: 'isPrimary', label: 'PK', title: 'Primary key' },
  { key: 'isForeign', label: 'FK', title: 'Foreign key' },
  { key: 'isNullable', label: 'NULL', title: 'Nullable' },
  { key: 'isUnique', label: 'UQ', title: 'Unique' },
  { key: 'isAutoIncrement', label: 'AI', title: 'Auto increment' },
]
function toggleFlag(col, key) {
  if (key === 'isPrimary') return togglePrimary(col)
  set(col, key, !col[key])
}

// ------------------------------------------------------------ live preview
const previewFormat = ref('sql')
const preview = computed(() => (table.value ? generateTable(previewFormat.value, table.value, context()) : ''))

// ------------------------------------------------------------ relationship labels
function endpoint(tableId, colId) {
  const t = diagram.tableById(tableId)
  const c = t?.columns.find((x) => x.id === colId)
  return t && c ? `${t.tableName}.${c.name}` : '?'
}

const title = computed(() => {
  if (table.value) return 'Table'
  if (shape.value) return 'Flow shape'
  if (rel.value) return 'Relationship'
  if (connector.value) return 'Connector'
  return 'Canvas'
})
</script>

<template>
  <aside
    class="pointer-events-auto flex h-full w-[360px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white/95 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95"
  >
    <div class="flex h-11 shrink-0 items-center justify-between border-b border-zinc-100 px-4 dark:border-zinc-800">
      <p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">{{ title }}</p>
      <button class="btn btn-ghost !p-1" title="Close" @click="ui.inspectorOpen = false"><X class="size-4" /></button>
    </div>

    <div class="scrollbar-thin flex-1 overflow-y-auto">
      <!-- ============================================================ TABLE -->
      <template v-if="table">
        <section class="section">
          <label class="label">Table name</label>
          <input v-model="table.tableName" class="input !text-sm font-semibold" @focus="diagram.checkpoint()" />

          <label class="label mt-3">Header color</label>
          <div class="flex gap-1.5">
            <button
              v-for="c in COLORS"
              :key="c"
              class="size-6 rounded-full ring-offset-2 transition dark:ring-offset-zinc-900"
              :class="{ 'ring-2 ring-zinc-400': table.color === c }"
              :style="{ background: c }"
              @click="set(table, 'color', c)"
            />
          </div>
        </section>

        <section class="section">
          <div class="mb-2 flex items-center justify-between">
            <p class="label !mb-0">Columns ({{ table.columns.length }})</p>
            <button class="btn btn-outline !py-1" @click="diagram.addColumn(table.id)"><Plus class="size-3.5" /> Add</button>
          </div>

          <div class="space-y-2">
            <div
              v-for="(col, i) in table.columns"
              :key="col.id"
              class="group rounded-lg border border-zinc-200 bg-zinc-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-950/40"
            >
              <div class="flex items-center gap-1.5">
                <div class="flex flex-col">
                  <button class="reorder" :disabled="i === 0" @click="diagram.moveColumn(table.id, col.id, -1)"><ArrowUp class="size-3" /></button>
                  <button class="reorder" :disabled="i === table.columns.length - 1" @click="diagram.moveColumn(table.id, col.id, 1)"><ArrowDown class="size-3" /></button>
                </div>
                <input v-model="col.name" class="input min-w-0 flex-1 font-medium" placeholder="name" @focus="diagram.checkpoint()" />
                <select class="input !w-24 shrink-0 font-mono" :value="col.type" @change="setType(col, $event.target.value)">
                  <option v-for="t in DATA_TYPES" :key="t" :value="t">{{ t }}</option>
                </select>
                <input
                  v-if="LENGTH_TYPES.includes(col.type)"
                  v-model="col.length"
                  class="input !w-14 shrink-0 font-mono"
                  :placeholder="col.type === 'decimal' ? '10,2' : '255'"
                  @focus="diagram.checkpoint()"
                />
                <button class="btn btn-ghost !p-1 hover:!text-red-500" title="Remove column" @click="diagram.removeColumn(table.id, col.id)">
                  <Trash2 class="size-3.5" />
                </button>
              </div>

              <div class="mt-1.5 flex items-center gap-1 pl-5">
                <button
                  v-for="f in flags"
                  :key="f.key"
                  class="flag"
                  :class="{ on: col[f.key], [f.key]: true }"
                  :title="f.title"
                  @click="toggleFlag(col, f.key)"
                >{{ f.label }}</button>
                <input v-model="col.defaultValue" class="input ml-1 !py-0.5 font-mono !text-[11px]" placeholder="default" @focus="diagram.checkpoint()" />
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <p class="label">Copy to clipboard</p>
          <div class="grid grid-cols-3 gap-1.5">
            <button class="btn btn-outline" @click="copyTable('sql', table)"><Database class="size-3.5 text-sky-500" /> SQL</button>
            <button class="btn btn-outline" @click="copyTable('markdown', table)"><FileText class="size-3.5 text-emerald-500" /> Text</button>
            <button class="btn btn-outline" @click="copyTable('laravel', table)"><FileCode2 class="size-3.5 text-red-500" /> Laravel</button>
          </div>

          <div class="mt-3 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div class="flex border-b border-zinc-200 bg-zinc-50 text-[11px] dark:border-zinc-800 dark:bg-zinc-950">
              <button
                v-for="f in ['sql', 'markdown', 'laravel']"
                :key="f"
                class="px-3 py-1.5 capitalize transition"
                :class="previewFormat === f ? 'bg-white font-semibold text-indigo-600 dark:bg-zinc-900 dark:text-indigo-400' : 'text-zinc-500'"
                @click="previewFormat = f"
              >{{ f }}</button>
            </div>
            <pre class="scrollbar-thin max-h-56 overflow-auto bg-white p-3 font-mono text-[11px] leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{{ preview }}</pre>
          </div>
        </section>

        <section class="section flex gap-2">
          <button class="btn btn-outline flex-1" @click="diagram.duplicateTable(table.id)"><Copy class="size-3.5" /> Duplicate</button>
          <button class="btn btn-outline flex-1 !text-red-500" @click="diagram.removeTable(table.id)"><Trash2 class="size-3.5" /> Delete</button>
        </section>
      </template>

      <!-- ============================================================ SHAPE -->
      <template v-else-if="shape">
        <section class="section">
          <label class="label">Label</label>
          <textarea v-model="shape.label" rows="2" class="input resize-none !text-sm" @focus="diagram.checkpoint()" />

          <label class="label mt-3">Shape</label>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              v-for="s in FLOW_SHAPES"
              :key="s.value"
              class="btn btn-outline"
              :class="{ '!border-indigo-500 !text-indigo-600 dark:!text-indigo-400': shape.shape === s.value }"
              @click="set(shape, 'shape', s.value)"
            >{{ s.label }}</button>
          </div>

          <label class="label mt-3">Color</label>
          <div class="flex gap-1.5">
            <button
              v-for="c in COLORS"
              :key="c"
              class="size-6 rounded-full ring-offset-2 transition dark:ring-offset-zinc-900"
              :class="{ 'ring-2 ring-zinc-400': shape.color === c }"
              :style="{ background: c }"
              @click="set(shape, 'color', c)"
            />
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label class="label">Width</label>
              <input v-model.number="shape.width" type="number" min="60" step="10" class="input" @focus="diagram.checkpoint()" />
            </div>
            <div>
              <label class="label">Height</label>
              <input v-model.number="shape.height" type="number" min="30" step="10" class="input" @focus="diagram.checkpoint()" />
            </div>
          </div>
        </section>
        <section class="section flex gap-2">
          <button class="btn btn-outline flex-1" @click="diagram.duplicateShape(shape.id)"><Copy class="size-3.5" /> Duplicate</button>
          <button class="btn btn-outline flex-1 !text-red-500" @click="diagram.removeShape(shape.id)"><Trash2 class="size-3.5" /> Delete</button>
        </section>
      </template>

      <!-- ============================================================ RELATIONSHIP -->
      <template v-else-if="rel">
        <section class="section">
          <div class="space-y-1.5 rounded-lg bg-zinc-50 p-3 font-mono text-xs dark:bg-zinc-950">
            <p><span class="text-zinc-400">parent</span> {{ endpoint(rel.fromTableId, rel.fromColumnId) }}</p>
            <p><span class="text-zinc-400">child&nbsp;</span> {{ endpoint(rel.toTableId, rel.toColumnId) }}</p>
          </div>

          <label class="label mt-3">Cardinality</label>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="t in RELATIONSHIP_TYPES"
              :key="t"
              class="btn btn-outline font-mono"
              :class="{ '!border-indigo-500 !text-indigo-600 dark:!text-indigo-400': rel.type === t }"
              @click="set(rel, 'type', t)"
            >{{ t }}</button>
          </div>
          <p class="mt-2 text-[11px] text-zinc-500">
            The child column is emitted as <code>FOREIGN KEY … REFERENCES</code> in SQL and <code>foreignId()->constrained()</code> in Laravel. N:M relationships are noted as needing a pivot table.
          </p>
        </section>
        <section class="section flex gap-2">
          <button class="btn btn-outline flex-1" @click="diagram.swapRelationship(rel.id)"><ArrowLeftRight class="size-3.5" /> Swap direction</button>
          <button class="btn btn-outline flex-1 !text-red-500" @click="diagram.removeRelationship(rel.id)"><Trash2 class="size-3.5" /> Delete</button>
        </section>
      </template>

      <!-- ============================================================ CONNECTOR -->
      <template v-else-if="connector">
        <section class="section">
          <label class="label">Label</label>
          <input v-model="connector.label" class="input !text-sm" placeholder="e.g. yes / no" @focus="diagram.checkpoint()" />
        </section>
        <section class="section">
          <button class="btn btn-outline w-full !text-red-500" @click="diagram.removeConnector(connector.id)"><Trash2 class="size-3.5" /> Delete connector</button>
        </section>
      </template>

      <!-- ============================================================ NOTHING -->
      <template v-else>
        <section class="section">
          <div class="grid grid-cols-2 gap-2 text-center">
            <div class="stat"><p class="text-xl font-semibold">{{ diagram.tables.length }}</p><p>tables</p></div>
            <div class="stat"><p class="text-xl font-semibold">{{ diagram.relationships.length }}</p><p>relationships</p></div>
            <div class="stat"><p class="text-xl font-semibold">{{ diagram.shapes.length }}</p><p>flow shapes</p></div>
            <div class="stat"><p class="text-xl font-semibold">{{ diagram.connectors.length }}</p><p>connectors</p></div>
          </div>
        </section>
        <section class="section space-y-2 text-xs text-zinc-500">
          <p class="label flex items-center gap-1.5"><MousePointerClick class="size-3.5" /> Tips</p>
          <p>Drag from a column's dot to another table's column to create a foreign key.</p>
          <p>Double-click a table name or shape to rename it. Click a relationship badge to cycle its type.</p>
          <p>Use the icons in each table header for one-click SQL / Markdown copy.</p>
        </section>
        <section class="section text-xs text-zinc-500">
          <p class="label flex items-center gap-1.5"><Keyboard class="size-3.5" /> Shortcuts</p>
          <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <kbd>Ctrl Z</kbd><span>Undo</span>
            <kbd>Ctrl Shift Z</kbd><span>Redo</span>
            <kbd>Ctrl D</kbd><span>Duplicate selection</span>
            <kbd>Del</kbd><span>Delete selection</span>
            <kbd>T / S</kbd><span>Add table / shape</span>
            <kbd>Esc</kbd><span>Deselect</span>
          </div>
        </section>
      </template>
    </div>
  </aside>
</template>

<style scoped>
@reference '../style.css';

.section {
  @apply border-b border-zinc-100 p-4 dark:border-zinc-800;
}
.label {
  @apply mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400;
}
.reorder {
  @apply grid h-3.5 w-4 place-items-center text-zinc-400 hover:text-zinc-800 disabled:opacity-20 dark:hover:text-white;
}
.flag {
  @apply rounded border border-zinc-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-400 transition hover:border-zinc-400 dark:border-zinc-700;
}
.flag.on.isPrimary { @apply border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-500/10; }
.flag.on.isForeign { @apply border-sky-400 bg-sky-50 text-sky-600 dark:bg-sky-500/10; }
.flag.on.isNullable { @apply border-zinc-400 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200; }
.flag.on.isUnique { @apply border-violet-400 bg-violet-50 text-violet-600 dark:bg-violet-500/10; }
.flag.on.isAutoIncrement { @apply border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10; }
.stat {
  @apply rounded-lg bg-zinc-50 p-3 text-[11px] text-zinc-500 dark:bg-zinc-950;
}
kbd {
  @apply rounded border border-zinc-200 bg-zinc-50 px-1.5 font-mono text-[10px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300;
}
</style>

