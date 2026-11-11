import { storeToRefs } from 'pinia'
import { useDiagramStore } from '../stores/diagram'
import { useUiStore } from '../stores/ui'
import { FORMATS, generateAll, generateTable } from '../utils/generators.mjs'

/** Writes text to the clipboard with a legacy fallback for non-secure contexts. */
export async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text })
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

/** One-click copy actions shared by table nodes, the inspector and the export modal. */
export function useSchemaCopy() {
  const diagram = useDiagramStore()
  const ui = useUiStore()
  const { tables, relationships } = storeToRefs(diagram)

  const context = () => ({ tables: tables.value, relationships: relationships.value, dialect: ui.dialect })

  async function copyText(text, label) {
    const ok = await writeClipboard(text)
    ui.toast(ok ? `Copied ${label} to clipboard!` : 'Clipboard access was denied', ok ? 'success' : 'error')
    return ok
  }

  /** @param {'sql'|'markdown'|'laravel'} format */
  function copyTable(format, tableOrId) {
    const table = typeof tableOrId === 'string' ? diagram.tableById(tableOrId) : tableOrId
    if (!table) return
    return copyText(generateTable(format, table, context()), `${FORMATS[format].label} for "${table.tableName}"`)
  }

  function copyAll(format) {
    if (!tables.value.length) return ui.toast('There are no tables to export', 'info')
    return copyText(generateAll(format, tables.value, relationships.value, ui.dialect), `${FORMATS[format].label} (${tables.value.length} tables)`)
  }

  return { copyText, copyTable, copyAll, context }
}

