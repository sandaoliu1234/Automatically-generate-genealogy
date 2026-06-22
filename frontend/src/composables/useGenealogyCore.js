import { ref, computed, nextTick } from 'vue'

// ============ 共享响应式状态（单例） ============
const nodes = ref([])
const links = ref([])
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isLoading = ref(false)
const isDragOverCanvas = ref(false)
const loadingMessage = ref('正在分析文档...')
const showUpload = ref(true)
const hasError = ref(false)
const statusText = ref('')
const focusedNodeId = ref(null)
const highlightedNodes = ref([])
const highlightedLinks = ref([])
const pulsingNodeId = ref(null)
const lineFilter = ref('all')
const confirmDialog = ref(null)
const theme = ref(localStorage.getItem('genealogy_theme') || 'light')
const showSearchModal = ref(false)
const searchQuery = ref('')
const showHelpModal = ref(false)
const showSettings = ref(false)
const operationMessage = ref('')

const hasData = computed(() => nodes.value.length > 0)

// updateTransform / fitToView 由 useCanvasInteraction 注册
let _updateTransform = null
let _fitToView = null
const registerUpdateTransform = (fn) => { _updateTransform = fn }
const registerFitToView = (fn) => { _fitToView = fn }
const updateTransform = () => { if (_updateTransform) _updateTransform() }
const canvasFitToView = () => { if (_fitToView) _fitToView() }

// ============ 树操作 ============

/** 收集指定节点的所有直系后代 id */
const collectDescendants = (nodeId, set) => {
  for (const link of links.value) {
    if (link.relation === 'husband-wife') continue
    const sourceId = link.source.id
    const targetId = link.target.id
    if (sourceId === nodeId && !set.has(targetId)) {
      set.add(targetId)
      collectDescendants(targetId, set)
    }
  }
}

/** 计算某节点下需要隐藏的后代总数 */
const countDescendants = (nodeId) => {
  const set = new Set()
  collectDescendants(nodeId, set)
  return set.size
}

/** 收集节点的祖先链（含自己） */
const collectAncestors = (nodeId, set) => {
  if (set.has(nodeId)) return
  set.add(nodeId)
  for (const link of links.value) {
    if (link.relation === 'husband-wife') continue
    if (link.target.id === nodeId && !set.has(link.source.id)) {
      collectAncestors(link.source.id, set)
    }
  }
}

/** 收集节点的配偶 id */
const collectSpouses = (nodeId, set) => {
  for (const link of links.value) {
    if (link.relation !== 'husband-wife') continue
    if (link.source.id === nodeId) set.add(link.target.id)
    else if (link.target.id === nodeId) set.add(link.source.id)
  }
}

// ============ 折叠 & 可见性 ============

const collapsedAncestors = computed(() => nodes.value.filter(n => n.collapsed))

const hiddenNodeIds = computed(() => {
  const hidden = new Set()
  for (const collapsed of collapsedAncestors.value) {
    collectDescendants(collapsed.id, hidden)
  }
  return hidden
})

const visibleNodes = computed(() => nodes.value.filter(n => !hiddenNodeIds.value.has(n.id)))
const visibleLinks = computed(() => links.value.filter(l =>
  !hiddenNodeIds.value.has(l.source.id) && !hiddenNodeIds.value.has(l.target.id)
))

const focusedBranchIds = computed(() => {
  if (!focusedNodeId.value) return null
  const set = new Set()
  collectAncestors(focusedNodeId.value, set)
  collectDescendants(focusedNodeId.value, set)
  collectSpouses(focusedNodeId.value, set)
  return set
})

const focusedBranchLinkIds = computed(() => {
  if (!focusedBranchIds.value) return null
  const set = new Set()
  for (const link of links.value) {
    if (focusedBranchIds.value.has(link.source.id) && focusedBranchIds.value.has(link.target.id)) {
      set.add(link.id)
    }
  }
  return set
})

// ============ 视图筛选 ============

function getLineVisible(line) {
  if (nodes.value.length === 0) return new Set()
  const minGen = Math.min(...nodes.value.map(n => n.generation || 1))
  const start = new Set(nodes.value.filter(n => (n.generation || 1) === minGen).map(n => n.id))
  let added = true
  while (added) {
    added = false
    for (const link of links.value) {
      if (link.relation !== 'husband-wife') continue
      if (start.has(link.source.id) && !start.has(link.target.id)) { start.add(link.target.id); added = true }
      else if (start.has(link.target.id) && !start.has(link.source.id)) { start.add(link.source.id); added = true }
    }
  }
  const visible = new Set(start)
  const queue = [...start]
  while (queue.length) {
    const id = queue.shift()
    for (const link of links.value) {
      if (link.relation === 'husband-wife') continue
      if (!link.relation.startsWith(line + '-')) continue
      if (link.source.id === id && !visible.has(link.target.id)) {
        visible.add(link.target.id)
        queue.push(link.target.id)
      }
    }
  }
  const toAdd = new Set()
  for (const link of links.value) {
    if (link.relation !== 'husband-wife') continue
    if (visible.has(link.source.id)) toAdd.add(link.target.id)
    if (visible.has(link.target.id)) toAdd.add(link.source.id)
  }
  for (const id of toAdd) visible.add(id)
  return visible
}

const filterHiddenNodeIds = computed(() => {
  if (lineFilter.value === 'all') return new Set()
  if (lineFilter.value === 'branch') {
    if (!focusedNodeId.value || !focusedBranchIds.value) return new Set()
    return new Set(nodes.value.map(n => n.id).filter(id => !focusedBranchIds.value.has(id)))
  }
  if (lineFilter.value === 'paternal') {
    const visible = getLineVisible('father')
    return new Set(nodes.value.map(n => n.id).filter(id => !visible.has(id)))
  }
  if (lineFilter.value === 'maternal') {
    const visible = getLineVisible('mother')
    return new Set(nodes.value.map(n => n.id).filter(id => !visible.has(id)))
  }
  return new Set()
})

const combinedHiddenNodeIds = computed(() => {
  const set = new Set(hiddenNodeIds.value)
  for (const id of filterHiddenNodeIds.value) set.add(id)
  return set
})

const filteredVisibleNodes = computed(() => nodes.value.filter(n => !combinedHiddenNodeIds.value.has(n.id)))
const filteredVisibleLinks = computed(() => links.value.filter(l =>
  !combinedHiddenNodeIds.value.has(l.source.id) && !combinedHiddenNodeIds.value.has(l.target.id)
))

const setLineFilter = (mode) => {
  lineFilter.value = mode
  if (mode === 'branch' && !focusedNodeId.value) {
    lineFilter.value = 'all'
  }
}

const focusNodeName = computed(() => {
  if (!focusedNodeId.value) return ''
  const n = nodes.value.find(x => x.id === focusedNodeId.value)
  return n ? n.name : ''
})

// ============ 焦点 & 交互 ============

const focusOnNode = (node) => {
  focusedNodeId.value = focusedNodeId.value === node.id ? null : node.id
}

const onCanvasClick = () => {
  focusedNodeId.value = null
  highlightedNodes.value = []
  highlightedLinks.value = []
}

// ============ 搜索 ============

const searchResults = computed(() => {
  const q = searchQuery.value.trim()
  if (!q) return nodes.value.slice().sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name, 'zh'))
  return nodes.value
    .filter(n => n.name && n.name.includes(q))
    .sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name, 'zh'))
})

// ============ 主题 ============

const toggleTheme = () => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('genealogy_theme', theme.value)
}

const applyTheme = () => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme.value)
  }
}

// ============ 树布局 & 连线 ============

const applyTreeLayout = () => {
  const generations = new Map()
  nodes.value.forEach(node => {
    const gen = node.generation || 1
    if (!generations.has(gen)) generations.set(gen, [])
    generations.get(gen).push(node)
  })
  const levelHeight = 150
  const nodeSpacing = 200
  generations.forEach((genNodes, gen) => {
    const y = (gen - 1) * levelHeight + 120
    const totalWidth = (genNodes.length - 1) * nodeSpacing
    const startX = -totalWidth / 2
    genNodes.forEach((node, index) => {
      node.x = startX + index * nodeSpacing
      node.y = y
    })
  })
  setTimeout(updateTransform, 0)
}

const getLinkPath = (link) => {
  const source = link.source
  const target = link.target
  const sx = source.x
  const sy = source.y + 39
  const tx = target.x
  const ty = target.y - 39
  const my = (sy + ty) / 2
  return `M ${sx} ${sy} C ${sx} ${my}, ${tx} ${my}, ${tx} ${ty}`
}

const getSpouseLinkPath = (link) => {
  const sx = link.source.x + 85
  const sy = link.source.y
  const tx = link.target.x - 85
  const ty = link.target.y
  const mx = (sx + tx) / 2
  const my = Math.min(sy, ty) - 18
  return `M ${sx} ${sy} Q ${mx} ${my}, ${tx} ${ty}`
}

export function useGenealogyCore() {
  return {
    // 状态
    nodes, links, zoom, panX, panY,
    isLoading, isDragOverCanvas, loadingMessage, showUpload, hasError, statusText,
    focusedNodeId, highlightedNodes, highlightedLinks, pulsingNodeId,
    lineFilter, confirmDialog, theme, showSearchModal, searchQuery,
    showHelpModal, showSettings, operationMessage,
    hasData,
    // 可见性
    filteredVisibleNodes, filteredVisibleLinks,
    focusedBranchIds, focusedBranchLinkIds,
    focusNodeName, searchResults,
    // 树操作
    collectDescendants, countDescendants, collectAncestors, collectSpouses,
    // 焦点
    focusOnNode, onCanvasClick,
    // 筛选
    setLineFilter,
    // 主题
    toggleTheme, applyTheme,
    // 布局 & 连线
    applyTreeLayout, getLinkPath, getSpouseLinkPath,
    updateTransform, registerUpdateTransform,
    canvasFitToView, registerFitToView,
  }
}
