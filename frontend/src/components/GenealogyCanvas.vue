<template>
  <div class="canvas-container" ref="canvasContainer"
    @dragover="$emit('canvasDragOver', $event)"
    @dragleave="$emit('canvasDragLeave', $event)"
    @drop="$emit('drop', $event)">
    <div class="zodiac-watermark" aria-hidden="true">鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪</div>
    <div class="scroll-title"><span></span><strong>族谱世系图</strong><span></span></div>

    <svg ref="svgCanvas" class="genealogy-canvas"
      @mousedown="$emit('startCanvasDrag', $event)"
      @click.self="$emit('canvasClick')"
      @wheel.prevent="$emit('wheelZoom', $event)"
      role="img" aria-label="族谱世系图画布">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#7a271b" />
        </marker>
        <clipPath id="avatar-clip">
          <circle cx="-53" cy="0" r="18" />
        </clipPath>
      </defs>
      <g ref="svgGroup">
        <!-- Links -->
        <g v-for="link in filteredVisibleLinks" :key="link.id">
          <path
            :d="link.relation === 'husband-wife' ? getSpouseLinkPath(link) : getLinkPath(link)"
            :class="['link', {
              spouse: link.relation === 'husband-wife',
              highlight: highlightedLinks.includes(link.id),
              dimmed: focusedBranchLinkIds && !focusedBranchLinkIds.has(link.id)
            }]"
            :marker-end="link.relation === 'husband-wife' ? '' : 'url(#arrowhead)'" />
        </g>
        <!-- Node cards -->
        <g v-for="node in filteredVisibleNodes" :key="node.id" class="node"
          :class="{ focused: focusedNodeId === node.id, dimmed: focusedBranchIds && !focusedBranchIds.has(node.id), pulse: pulsingNodeId === node.id }"
          :transform="`translate(${node.x}, ${node.y})`"
          @mousedown.stop="$emit('startNodeDrag', node, $event)"
          @click.stop="$emit('focusOnNode', node)"
          @dblclick.stop="$emit('toggleCollapse', node)"
          @contextmenu.stop="$emit('openContextMenu', node, $event)">
          <!-- Card background -->
          <rect class="node-card" x="-85" y="-39" width="170" height="78" rx="10" ry="10" />
          <!-- Gender accent bar -->
          <rect class="node-accent" :class="node.gender || 'male'" x="-85" y="-39" width="5" height="78" rx="10" ry="0" />
          <rect class="node-accent-fill" :class="node.gender || 'male'" x="-83" y="-39" width="3" height="78" />
          <!-- Avatar circle background -->
          <circle cx="-53" cy="0" r="19" :class="['node-avatar-bg', node.gender || 'male']" />
          <!-- Avatar image (clipped to circle) -->
          <image
            :href="getAvatarUrl(node)"
            x="-71" y="-18" width="36" height="36"
            preserveAspectRatio="xMidYMid slice"
            clip-path="url(#avatar-clip)"
            class="node-avatar-img" />
          <!-- Avatar border ring -->
          <circle cx="-53" cy="0" r="19" class="node-avatar-ring" />
          <!-- Name -->
          <text class="node-name" x="-26" y="-13">{{ node.name.length > 5 ? node.name.slice(0, 5) + '…' : node.name }}</text>
          <!-- Generation badge -->
          <rect class="gen-badge" x="-26" y="-4" width="38" height="16" rx="4" />
          <text class="gen-badge-text" x="-7" y="8">{{ node.generation }}世</text>
          <!-- Info line: birth ~ death or note -->
          <text class="node-info" x="-26" y="28">{{ formatNodeInfo(node) }}</text>
          <!-- Tooltip -->
          <title>{{ node.name }}（{{ node.gender === 'female' ? '女' : '男' }}，{{ node.generation }}世）{{ node.birth ? ' 生：' + node.birth : '' }}{{ node.death ? ' 卒：' + node.death : '' }}{{ node.note ? ' ' + node.note : '' }}</title>
          <!-- Collapse badge -->
          <g v-if="countDescendants(node.id) > 0" class="collapse-badge" :class="{ collapsed: node.collapsed }"
            transform="translate(73, -27)" @click.stop="$emit('toggleCollapse', node)">
            <circle r="10" />
            <text dy="4">{{ node.collapsed ? '+' : '−' }}</text>
            <title>{{ node.collapsed ? '展开 ' + countDescendants(node.id) + ' 个后代' : '折叠 ' + countDescendants(node.id) + ' 个后代' }}</title>
          </g>
        </g>
      </g>
    </svg>

    <div class="zoom-controls" role="group" aria-label="缩放控制">
      <button @click="$emit('zoomOut')" aria-label="缩小" title="缩小 (-)">-</button>
      <span aria-live="polite">{{ Math.round(zoom * 100) }}%</span>
      <button @click="$emit('zoomIn')" aria-label="放大" title="放大 (+)">+</button>
      <button @click="$emit('resetZoom')" aria-label="重置缩放" title="重置 (0)">重置</button>
    </div>

    <Minimap v-if="hasData && nodes.length > 0" v-bind="minimapProps"
      ref="minimapEl" @minimapMouseDown="$emit('minimapMouseDown', $event)" />

    <div v-if="isDragOverCanvas" class="canvas-dropzone" aria-hidden="true">
      <div class="canvas-dropzone-inner">
        <div class="dropzone-icon">⇪</div>
        <p>拖入文件以替换当前族谱</p>
        <small>支持 TXT / PDF / DOC / DOCX</small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Minimap from './Minimap.vue'
import { getAvatarUrl } from '../utils/defaultAvatars.js'

const props = defineProps({
  nodes: Array, filteredVisibleNodes: Array, filteredVisibleLinks: Array,
  highlightedNodes: Array, highlightedLinks: Array,
  focusedNodeId: [String, null], focusedBranchIds: [Set, null], focusedBranchLinkIds: [Set, null],
  pulsingNodeId: [String, null], isDragOverCanvas: Boolean,
  zoom: Number, hasData: Boolean,
  getLinkPath: Function, getSpouseLinkPath: Function, countDescendants: Function,
  minimapProps: Object,
})

const emit = defineEmits([
  'startCanvasDrag', 'canvasClick', 'wheelZoom',
  'startNodeDrag', 'focusOnNode', 'toggleCollapse', 'openContextMenu',
  'zoomIn', 'zoomOut', 'resetZoom', 'minimapMouseDown',
  'canvasDragOver', 'canvasDragLeave', 'drop',
])

/** 格式化节点信息行：优先显示生卒年，否则显示备注 */
const formatNodeInfo = (node) => {
  const parts = []
  if (node.birth) parts.push(node.birth.length > 10 ? node.birth.slice(0, 10) : node.birth)
  if (node.death) parts.push(node.death.length > 10 ? node.death.slice(0, 10) : node.death)
  if (parts.length > 0) return parts.join(' ~ ')
  if (node.note) return node.note.length > 12 ? node.note.slice(0, 12) + '…' : node.note
  return node.gender === 'female' ? '女' : '男'
}

const svgCanvas = ref(null)
const svgGroup = ref(null)
const canvasContainer = ref(null)
const minimapEl = ref(null)

defineExpose({ svgCanvas, svgGroup, canvasContainer, minimapEl })
</script>
