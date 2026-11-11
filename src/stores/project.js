import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useDiagramStore } from './diagram'
import { useUiStore } from './ui'
import { downloadText } from '../utils/generators.mjs'

export const useProjectStore = defineStore('project', () => {
  const diagram = useDiagramStore()
  const ui = useUiStore()

  /** @type {import('vue').Ref<any>} Native FileSystemFileHandle if opened/saved via File System Access API */
  const fileHandle = ref(null)
  const fileName = ref('Untitled Diagram.json')
  const hasUnsavedChanges = ref(false)
  const isSaving = ref(false)
  const lastSavedAt = ref(null)

  // Track diagram mutations to indicate unsaved state
  let initialized = false
  watch(
    () => [diagram.tables, diagram.shapes, diagram.relationships, diagram.connectors],
    () => {
      if (!initialized) {
        initialized = true
        return
      }
      hasUnsavedChanges.value = true
    },
    { deep: true },
  )

  /**
   * Save the current diagram.
   * If a FileSystemFileHandle is already linked (existing file was opened or previously saved),
   * it writes directly to that file without creating a new file or prompting.
   * If no file handle exists, it prompts once via showSaveFilePicker (or fallback download).
   */
  async function saveFile({ forceSaveAs = false } = {}) {
    if (isSaving.value) return false
    isSaving.value = true
    const jsonContent = JSON.stringify(diagram.toJSON(), null, 2)

    try {
      // 1. Direct overwrite if an existing file handle is already active
      if (fileHandle.value && !forceSaveAs && typeof fileHandle.value.createWritable === 'function') {
        const writable = await fileHandle.value.createWritable()
        await writable.write(jsonContent)
        await writable.close()

        hasUnsavedChanges.value = false
        lastSavedAt.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        ui.toast(`Saved changes to "${fileName.value}"`, 'success')
        return true
      }

      // 2. Browser supports File System Access API (showSaveFilePicker)
      if ('showSaveFilePicker' in window) {
        const base = fileName.value && fileName.value !== 'Untitled Diagram.json'
          ? fileName.value.replace(/\.json$/i, '')
          : 'diagram'

        const handle = await window.showSaveFilePicker({
          suggestedName: `${base}.json`,
          types: [
            {
              description: 'Reka Gatra Diagram (*.json)',
              accept: { 'application/json': ['.json'] },
            },
          ],
        })

        const writable = await handle.createWritable()
        await writable.write(jsonContent)
        await writable.close()

        fileHandle.value = handle
        fileName.value = handle.name
        hasUnsavedChanges.value = false
        lastSavedAt.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        ui.toast(`Saved to "${handle.name}"`, 'success')
        return true
      }

      // 3. Fallback for browsers without File System Access API
      const fallbackName = fileName.value || 'diagram.json'
      downloadText(fallbackName, jsonContent, 'application/json')
      hasUnsavedChanges.value = false
      lastSavedAt.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      ui.toast(`Downloaded "${fallbackName}"`, 'success')
      return true
    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled file dialog, do not show error
        return false
      }
      console.error('Save failed:', err)
      ui.toast(`Failed to save: ${err.message || 'Unknown error'}`, 'error')
      return false
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Open an existing diagram file.
   * Preserves FileSystemFileHandle so subsequent Ctrl+S operations will overwrite this file directly.
   */
  async function openFile() {
    try {
      if ('showOpenFilePicker' in window) {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: 'Reka Gatra Diagram (*.json)',
              accept: { 'application/json': ['.json'] },
            },
          ],
          multiple: false,
        })

        const file = await handle.getFile()
        const text = await file.text()
        const parsed = JSON.parse(text)

        diagram.load(parsed)
        fileHandle.value = handle
        fileName.value = handle.name
        hasUnsavedChanges.value = false
        lastSavedAt.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        ui.toast(`Opened "${handle.name}"`, 'success')
        return true
      }
    } catch (err) {
      if (err.name === 'AbortError') return false
      console.error('Open file error:', err)
      ui.toast('Failed to open file', 'error')
      return false
    }

    return false
  }

  /**
   * Fallback loader for standard <input type="file">
   */
  async function loadFromFileObject(file) {
    if (!file) return false
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      diagram.load(parsed)
      fileHandle.value = null
      fileName.value = file.name
      hasUnsavedChanges.value = false
      lastSavedAt.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      ui.toast(`Opened "${file.name}"`, 'success')
      return true
    } catch (err) {
      console.error('Load error:', err)
      ui.toast('Invalid JSON diagram file', 'error')
      return false
    }
  }

  function resetFile() {
    fileHandle.value = null
    fileName.value = 'Untitled Diagram.json'
    hasUnsavedChanges.value = false
    lastSavedAt.value = null
  }

  return {
    fileHandle,
    fileName,
    hasUnsavedChanges,
    isSaving,
    lastSavedAt,
    saveFile,
    openFile,
    loadFromFileObject,
    resetFile,
  }
})

