<script setup>
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, Position, getBezierPath, getSmoothStepPath } from '@vue-flow/core'
import { useDiagramStore } from '../../stores/diagram'
import { useUiStore } from '../../stores/ui'
import { RELATIONSHIP_TYPES, relationshipEnds } from '../../types/diagram.mjs'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  id: String,
  sourceX: Number,
  sourceY: Number,
  targetX: Number,
  targetY: Number,
  sourcePosition: String,
  targetPosition: String,
  selected: Boolean,
  data: Object,
})

const diagram = useDiagramStore()
const ui = useUiStore()

const rel = computed(() => diagram.relationships.find((r) => r.id === props.id))
const ends = computed(() => relationshipEnds(rel.value?.type ?? '1:N'))

const pathData = computed(() => {
  const args = {
    sourceX: props.sourceX, sourceY: props.sourceY, sourcePosition: props.sourcePosition,
    targetX: props.targetX, targetY: props.targetY, targetPosition: props.targetPosition,
  }
  return ui.edgeStyle === 'orthogonal' ? getSmoothStepPath({ ...args, borderRadius: 10, offset: 24 }) : getBezierPath(args)
})

/** Crow's-foot notation glyph for one end of the connector. */
function glyph(x, y, position, cardinality) {
  const d = position === Position.Left ? -1 : 1
  if (cardinality === 'many') {
    const bx = x + d * 14
    return `M${bx},${y} L${x},${y - 7} M${bx},${y} L${x},${y} M${bx},${y} L${x},${y + 7} M${x + d * 18},${y - 6} L${x + d * 18},${y + 6}`
  }
  return `M${x + d * 9},${y - 6} L${x + d * 9},${y + 6} M${x + d * 14},${y - 6} L${x + d * 14},${y + 6}`
}

const sourceGlyph = computed(() => glyph(props.sourceX, props.sourceY, props.sourcePosition, ends.value.from))
const targetGlyph = computed(() => glyph(props.targetX, props.targetY, props.targetPosition, ends.value.to))

const stroke = computed(() => (props.selected ? '#6366f1' : ui.theme === 'dark' ? '#71717a' : '#94a3b8'))

function cycleType() {
  if (!rel.value) return
  diagram.checkpoint()
  const i = RELATIONSHIP_TYPES.indexOf(rel.value.type)
  rel.value.type = RELATIONSHIP_TYPES[(i + 1) % RELATIONSHIP_TYPES.length]
  diagram.select('relationship', props.id)
}
</script>

<template>
  <BaseEdge
    :id="id"
    :path="pathData[0]"
    :interaction-width="18"
    :style="{ stroke, strokeWidth: selected ? 2.25 : 1.5, transition: 'stroke .15s' }"
  />
  <path :d="sourceGlyph" fill="none" :stroke="stroke" stroke-width="1.5" stroke-linecap="round" class="pointer-events-none" />
  <path :d="targetGlyph" fill="none" :stroke="stroke" stroke-width="1.5" stroke-linecap="round" class="pointer-events-none" />

  <EdgeLabelRenderer>
    <button
      class="nodrag nopan absolute rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-semibold shadow-sm transition"
      :class="selected
        ? 'border-indigo-500 bg-indigo-500 text-white'
        : 'border-zinc-200 bg-white text-zinc-500 hover:border-indigo-400 hover:text-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'"
      :style="{ transform: `translate(-50%, -50%) translate(${pathData[1]}px, ${pathData[2]}px)`, pointerEvents: 'all' }"
      title="Click to cycle relationship type (1:1 → 1:N → N:M)"
      @click.stop="cycleType"
    >
      {{ rel?.type }}
    </button>
  </EdgeLabelRenderer>
</template>
