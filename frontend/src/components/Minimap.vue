<template>
  <div class="minimap" ref="minimapRoot" role="region" aria-label="图谱小地图"
    @mousedown.stop="$emit('minimapMouseDown', $event)" @click.stop>
    <svg :viewBox="`0 0 ${minimapSize} ${minimapSize}`" preserveAspectRatio="xMidYMid meet" class="minimap-svg">
      <g v-for="node in nodes" :key="'mm-' + node.id"
        :transform="`translate(${minimapXOf(node.x)}, ${minimapYOf(node.y)})`">
        <circle r="3" :class="node.gender" />
      </g>
      <line v-for="link in minimapLinks" :key="'mml-' + link.id"
        :x1="minimapXOf(link.x1)" :y1="minimapYOf(link.y1)"
        :x2="minimapXOf(link.x2)" :y2="minimapYOf(link.y2)"
        class="minimap-link" :class="{ spouse: link.spouse }" />
      <rect :x="viewportRect.x" :y="viewportRect.y" :width="viewportRect.w" :height="viewportRect.h" class="minimap-viewport" />
    </svg>
    <div class="minimap-label">缩略图</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  nodes: Array, minimapSize: Number,
  minimapXOf: Function, minimapYOf: Function,
  minimapLinks: Array, viewportRect: Object,
})

defineEmits(['minimapMouseDown'])

const minimapRoot = ref(null)
defineExpose({ minimapRoot })
</script>
