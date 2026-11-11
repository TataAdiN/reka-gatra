import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const THEME_KEY = 'reka-gatra:theme'

/** UI-only state: theme, toasts, modals, canvas preferences. */
export const useUiStore = defineStore('ui', () => {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const theme = ref(localStorage.getItem(THEME_KEY) || (prefersDark ? 'dark' : 'light'))

  /** 'bezier' | 'orthogonal' */
  const edgeStyle = ref('bezier')
  /** Relationship type applied to newly drawn table connectors. */
  const defaultRelType = ref('1:N')
  /** SQL dialect used by every SQL generator. */
  const dialect = ref('mysql')

  const inspectorOpen = ref(true)
  const exportOpen = ref(false)
  const importOpen = ref(false)
  const projectOpen = ref(false)

  /** @type {import('vue').Ref<Array<{id:number, message:string, kind:'success'|'error'|'info'}>>} */
  const toasts = ref([])
  let toastSeq = 0

  function toast(message, kind = 'success', duration = 2200) {
    const id = ++toastSeq
    toasts.value.push({ id, message, kind })
    setTimeout(() => dismissToast(id), duration)
  }
  function dismissToast(id) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  watch(
    theme,
    (t) => {
      document.documentElement.classList.toggle('dark', t === 'dark')
      localStorage.setItem(THEME_KEY, t)
    },
    { immediate: true },
  )

  return {
    theme, edgeStyle, defaultRelType, dialect,
    inspectorOpen, exportOpen, importOpen, projectOpen,
    toasts, toast, dismissToast, toggleTheme,
  }
})

