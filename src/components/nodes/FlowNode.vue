<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { useDiagramStore } from '../../stores/diagram'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  id: { type: String, required: true },
  selected: { type: Boolean, default: false },
})

const diagram = useDiagramStore()
const { updateNodeInternals } = useVueFlow()

const shape = computed(() => diagram.shapeById(props.id))
const color = computed(() => shape.value?.color || '#0ea5e9')

/** SVG outline for each shape kind, drawn in the node's own pixel space. */
const outline = computed(() => {
  const s = shape.value
  if (!s) return null
  const w = s.width
  const h = s.height
  const p = 1.5 // half stroke
  switch (s.shape) {
    case 'decision':
      return { tag: 'polygon', attrs: { points: `${w / 2},${p} ${w - p},${h / 2} ${w / 2},${h - p} ${p},${h / 2}` } }
    case 'document':
      return {
        tag: 'path',
        attrs: { d: `M${p},${p} H${w - p} V${h - 12} C${w * 0.75},${h - 24} ${w * 0.3},${h + 4} ${p},${h - 8} Z` },
      }
    case 'terminal':
      return { tag: 'rect', attrs: { x: p, y: p, width: w - 2 * p, height: h - 2 * p, rx: (h - 2 * p) / 2 } }
    default:
      return { tag: 'rect', attrs: { x: p, y: p, width: w - 2 * p, height: h - 2 * p, rx: 10 } }
  }
})

watch(
  () => shape.value && `${shape.value.width}x${shape.value.height}:${shape.value.shape}`,
  () => nextTick(() => updateNodeInternals([props.id])),
)

// ------------------------------------------------------------ inline label editing
const editing = ref(false)
const textarea = ref(null)
function startEdit() {
  diagram.checkpoint()
  editing.value = true
  nextTick(() => textarea.value?.select())
}
function finishEdit(e) {
  shape.value.label = e.target.value
  editing.value = false
}

const handles = [
  { id: 't', position: Position.Top },
  { id: 'r', position: Position.Right },
  { id: 'b', position: Position.Bottom },
  { id: 'l', position: Position.Left },
]
</script>

<template>
  <div
    v-if="shape"
    class="relative grid place-items-center"
    :style="{ width: `${shape.width}px`, height: `${shape.height}px` }"
    @dblclick.stop="startEdit"
  >
    <svg class="absolute inset-0 overflow-visible" :width="shape.width" :height="shape.height">
      <component
        :is="outline.tag"
        v-bind="outline.attrs"
        :fill="color"
        fill-opacity="0.12"
        :stroke="color"
        stroke-width="2"
        stroke-linejoin="round"
        :class="selected ? 'drop-shadow-[0_0_6px_rgba(99,102,241,0.55)]' : ''"
      />
      <component
        :is="outline.tag"
        v-if="selected"
        v-bind="outline.attrs"
        fill="none"
        stroke="#6366f1"
        stroke-width="1"
        stroke-dasharray="4 3"
        style="transform-box: fill-box; transform-origin: center; transform: scale(1.07)"
      />
    </svg>

    <textarea
      v-if="editing"
      ref="textarea"
      class="nodrag nowheel relative z-10 h-3/4 w-4/5 resize-none rounded bg-white/80 p-1 text-center text-xs outline-none dark:bg-zinc-900/80"
      :value="shape.label"
      @blur="finishEdit"
      @keydown.enter.exact.prevent="$event.target.blur()"
      @keydown.esc="editing = false"
    />
    <span
      v-else
      class="relative z-10 max-w-[80%] whitespace-pre-wrap break-words text-center text-[12.5px] font-medium leading-tight text-zinc-800 dark:text-zinc-100"
      :class="{ 'max-w-[60%]': shape.shape === 'decision', '-mt-2': shape.shape === 'document' }"
    >{{ shape.label || ' ' }}</span>

    <Handle v-for="h in handles" :id="h.id" :key="h.id" type="source" :position="h.position" />
  </div>
</template>
