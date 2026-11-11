<script setup>
import { computed, ref } from 'vue'
import { AlertTriangle, CheckCircle2, FileInput, X } from '@lucide/vue'
import { useUiStore } from '../stores/ui'
import { parseSQL } from '../utils/sqlParser.mjs'

const emit = defineEmits(['import'])
const ui = useUiStore()

const sql = ref(`CREATE TABLE categories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT NOT NULL,
    sku VARCHAR(64) NOT NULL UNIQUE,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);`)
const replace = ref(false)

const parsed = computed(() => parseSQL(sql.value))
const summary = computed(() => {
  const { tables, foreignKeys } = parsed.value
  return `${tables.length} table${tables.length === 1 ? '' : 's'}, ${tables.reduce((n, t) => n + t.columns.length, 0)} columns, ${foreignKeys.length} foreign keys`
})

function submit() {
  if (!parsed.value.tables.length) return
  emit('import', parsed.value, { replace: replace.value })
}
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-zinc-950/40 p-6 backdrop-blur-sm" @click.self="ui.importOpen = false">
    <div class="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
      <div class="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
        <div>
          <h2 class="text-sm font-semibold">Import SQL</h2>
          <p class="text-xs text-zinc-500">Paste <code>CREATE TABLE</code> statements (MySQL, PostgreSQL, SQLite) to generate table nodes.</p>
        </div>
        <button class="btn btn-ghost !p-1" @click="ui.importOpen = false"><X class="size-4" /></button>
      </div>

      <textarea
        v-model="sql"
        spellcheck="false"
        class="scrollbar-thin min-h-72 flex-1 resize-none bg-zinc-50 p-5 font-mono text-[12px] leading-relaxed text-zinc-800 outline-none dark:bg-zinc-950 dark:text-zinc-200"
        placeholder="CREATE TABLE users ( ... );"
      />

      <div class="border-t border-zinc-100 px-5 py-2 text-xs dark:border-zinc-800">
        <p v-if="parsed.tables.length" class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 class="size-3.5" /> Detected {{ summary }}
        </p>
        <p v-for="err in parsed.errors" :key="err" class="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <AlertTriangle class="size-3.5 shrink-0" /> {{ err }}
        </p>
      </div>

      <div class="flex items-center justify-between gap-2 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
        <label class="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <input v-model="replace" type="checkbox" class="accent-indigo-600" /> Replace existing tables
        </label>
        <div class="flex gap-2">
          <button class="btn btn-outline" @click="ui.importOpen = false">Cancel</button>
          <button class="btn btn-primary" :disabled="!parsed.tables.length" @click="submit"><FileInput class="size-3.5" /> Generate nodes</button>
        </div>
      </div>
    </div>
  </div>
</template>

