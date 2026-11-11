<script setup>
import { computed, ref } from 'vue'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileCode,
  FileJson,
  FolderOpen,
  HardDrive,
  Save,
  Table2,
  Trash2,
  Upload,
  Workflow,
  X,
} from '@lucide/vue'
import { useDiagramStore } from '../stores/diagram'
import { useUiStore } from '../stores/ui'
import { useProjectStore } from '../stores/project'

const diagram = useDiagramStore()
const ui = useUiStore()
const project = useProjectStore()

const fileInput = ref(null)
const showClearConfirm = ref(false)

const totalColumns = computed(() =>
  diagram.tables.reduce((sum, t) => sum + (t.columns?.length || 0), 0),
)

async function handleSave() {
  const ok = await project.saveFile()
  if (ok) ui.projectOpen = false
}

async function handleSaveAs() {
  const ok = await project.saveFile({ forceSaveAs: true })
  if (ok) ui.projectOpen = false
}

async function handleOpenFile() {
  if ('showOpenFilePicker' in window) {
    const ok = await project.openFile()
    if (ok) ui.projectOpen = false
  } else {
    fileInput.value?.click()
  }
}

async function handleFileFallback(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const ok = await project.loadFromFileObject(file)
  if (ok) ui.projectOpen = false
  e.target.value = ''
}

function handleClearCanvas() {
  diagram.clearAll()
  project.resetFile()
  ui.toast('Canvas cleared (you can undo with Ctrl+Z)')
  showClearConfirm.value = false
  ui.projectOpen = false
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 grid place-items-center bg-zinc-950/40 p-6 backdrop-blur-sm"
    @click.self="ui.projectOpen = false"
  >
    <div
      class="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
        <div class="flex items-center gap-2">
          <div class="grid size-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <FileJson class="size-4" />
          </div>
          <div>
            <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Project &amp; File Management</h2>
            <p class="text-[11px] text-zinc-500">Auto-save with <kbd class="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[10px]">Ctrl+S</kbd></p>
          </div>
        </div>
        <button class="btn btn-ghost !p-1" title="Close" @click="ui.projectOpen = false">
          <X class="size-4" />
        </button>
      </div>

      <!-- Current Active File Banner -->
      <div class="flex items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/70 px-5 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
        <div class="flex items-center gap-2 min-w-0">
          <span
            class="size-2 rounded-full shrink-0"
            :class="project.hasUnsavedChanges ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'"
          />
          <div class="min-w-0">
            <p class="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              {{ project.fileName }}
            </p>
            <p class="text-[10px] text-zinc-400 flex items-center gap-1">
              <span v-if="project.fileHandle" class="text-indigo-500 dark:text-indigo-400 font-medium">Direct Disk Link Active</span>
              <span v-else>Unsaved file</span>
              <span v-if="project.lastSavedAt">• Last saved at {{ project.lastSavedAt }}</span>
            </p>
          </div>
        </div>
        <span
          class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          :class="project.hasUnsavedChanges
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'"
        >
          {{ project.hasUnsavedChanges ? 'Unsaved' : 'Saved' }}
        </span>
      </div>

      <!-- Overview Stats -->
      <div class="grid grid-cols-4 gap-2 border-b border-zinc-100 bg-white px-5 py-3 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <div class="rounded-lg bg-zinc-50 p-2 border border-zinc-200/60 shadow-xs dark:bg-zinc-950 dark:border-zinc-800">
          <p class="text-base font-bold text-zinc-900 dark:text-zinc-100">{{ diagram.tables.length }}</p>
          <p class="text-[10px] text-zinc-400">Tables</p>
        </div>
        <div class="rounded-lg bg-zinc-50 p-2 border border-zinc-200/60 shadow-xs dark:bg-zinc-950 dark:border-zinc-800">
          <p class="text-base font-bold text-zinc-900 dark:text-zinc-100">{{ totalColumns }}</p>
          <p class="text-[10px] text-zinc-400">Columns</p>
        </div>
        <div class="rounded-lg bg-zinc-50 p-2 border border-zinc-200/60 shadow-xs dark:bg-zinc-950 dark:border-zinc-800">
          <p class="text-base font-bold text-zinc-900 dark:text-zinc-100">{{ diagram.relationships.length }}</p>
          <p class="text-[10px] text-zinc-400">Relations</p>
        </div>
        <div class="rounded-lg bg-zinc-50 p-2 border border-zinc-200/60 shadow-xs dark:bg-zinc-950 dark:border-zinc-800">
          <p class="text-base font-bold text-zinc-900 dark:text-zinc-100">{{ diagram.shapes.length }}</p>
          <p class="text-[10px] text-zinc-400">Shapes</p>
        </div>
      </div>

      <!-- Action Cards -->
      <div class="space-y-3 p-5">
        <!-- Save / Overwrite Card -->
        <div class="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/30">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <p class="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Save class="size-3.5 text-indigo-500" />
                {{ project.fileHandle ? 'Save Changes (Overwrite)' : 'Save to File (New)' }}
              </p>
              <p class="text-[11px] text-zinc-500">
                <template v-if="project.fileHandle">
                  Directly overwrites <span class="font-mono font-medium text-zinc-700 dark:text-zinc-300">{{ project.fileName }}</span> without prompting. Same as pressing <kbd class="font-mono">Ctrl+S</kbd>.
                </template>
                <template v-else>
                  Choose where to save on your disk. Once chosen, future <kbd class="font-mono">Ctrl+S</kbd> saves directly into it.
                </template>
              </p>
            </div>
            <div class="flex flex-col gap-1.5 shrink-0">
              <button class="btn btn-primary !py-1.5" @click="handleSave">
                <Save class="size-3.5" /> Save (Ctrl+S)
              </button>
              <button
                v-if="project.fileHandle"
                class="btn btn-outline !py-1 text-[11px]"
                title="Save a new copy with different name"
                @click="handleSaveAs"
              >
                Save As Copy...
              </button>
            </div>
          </div>
        </div>

        <!-- Open File Card -->
        <div class="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/30">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <p class="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <FolderOpen class="size-3.5 text-sky-500" /> Open Existing Diagram (.json)
              </p>
              <p class="text-[11px] text-zinc-500">
                Opens an existing file from disk and connects it so subsequent <kbd class="font-mono">Ctrl+S</kbd> auto-saves directly back to that file.
              </p>
            </div>
            <button class="btn btn-outline shrink-0 !py-1.5" @click="handleOpenFile">
              <Upload class="size-3.5" /> Open File
            </button>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="application/json,.json"
            class="hidden"
            @change="handleFileFallback"
          />
        </div>

        <!-- Danger Zone Card -->
        <div class="rounded-xl border border-red-200/60 bg-red-50/30 p-3.5 dark:border-red-950 dark:bg-red-950/10">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <p class="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <Trash2 class="size-3.5" /> Clear Canvas
              </p>
              <p class="text-[11px] text-zinc-500 dark:text-zinc-400">
                Remove all active tables, flowchart shapes, and connectors from the workspace.
              </p>
            </div>
            <template v-if="!showClearConfirm">
              <button
                class="btn border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/40 shrink-0 !py-1.5"
                @click="showClearConfirm = true"
              >
                Clear
              </button>
            </template>
            <template v-else>
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  class="btn btn-ghost !text-xs !py-1 !px-2"
                  @click="showClearConfirm = false"
                >
                  Cancel
                </button>
                <button
                  class="btn bg-red-600 text-white hover:bg-red-500 !text-xs !py-1 !px-2 shadow-xs"
                  @click="handleClearCanvas"
                >
                  Confirm
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/40 px-5 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/20">
        <span class="text-[10px] text-zinc-400">Browser local storage syncs continuously</span>
        <button class="btn btn-outline !py-1" @click="ui.projectOpen = false">
          Close
        </button>
      </div>
    </div>
  </div>
</template>
