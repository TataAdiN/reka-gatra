<script setup>
import { AlertCircle, CheckCircle2, Info } from '@lucide/vue'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()
const icons = { success: CheckCircle2, error: AlertCircle, info: Info }
const colors = { success: 'text-emerald-400', error: 'text-red-400', info: 'text-sky-400' }
</script>

<template>
  <div class="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
    <TransitionGroup name="toast">
      <div
        v-for="t in ui.toasts"
        :key="t.id"
        class="pointer-events-auto flex items-center gap-2 rounded-full bg-zinc-900 py-2 pl-3 pr-4 text-xs font-medium text-white shadow-xl ring-1 ring-white/10 dark:bg-white dark:text-zinc-900"
        @click="ui.dismissToast(t.id)"
      >
        <component :is="icons[t.kind]" class="size-4" :class="colors[t.kind]" />
        {{ t.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

