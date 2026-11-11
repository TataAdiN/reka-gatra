<script setup>
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath } from '@vue-flow/core'
import { useDiagramStore } from '../../stores/diagram'
import { useUiStore } from '../../stores/ui'

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
  markerEnd: [String, Object],
})

const diagram = useDiagramStore()
const ui = useUiStore()

const connector = computed(() => diagram.connectors.find((c) => c.id === props.id))

const pathData = computed(() => {
  const args = {
    sourceX: props.sourceX, sourceY: props.sourceY, sourcePosition: props.sourcePosition,
    targetX: props.targetX, targetY: props.targetY, targetPosition: props.targetPosition,
  }
  return ui.edgeStyle === 'orthogonal' ? getSmoothStepPath({ ...args, borderRadius: 10 }) : getBezierPath(args)
})

const stroke = computed(() => (props.selected ? '#6366f1' : ui.theme === 'dark' ? '#a1a1aa' : '#52525b'))
</script>

<template>
  <BaseEdge
    :id="id"
    :path="pathData[0]"
    :marker-end="markerEnd"
    :interaction-width="18"
    :style="{ stroke, strokeWidth: selected ? 2.25 : 1.75 }"
  />
  <EdgeLabelRenderer v-if="connector?.label">
    <div
      class="nodrag nopan absolute rounded-md bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300"
      :style="{ transform: `translate(-50%, -50%) translate(${pathData[1]}px, ${pathData[2]}px)`, pointerEvents: 'all' }"
      @click.stop="diagram.select('connector', id)"
    >
      {{ connector.label }}
    </div>
  </EdgeLabelRenderer>
</template>
