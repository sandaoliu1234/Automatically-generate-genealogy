import { ref, computed } from 'vue'
import { useGenealogyCore } from './useGenealogyCore'
import { useHistory } from './useHistory'

// 拖拽相关的非响应式变量
let isDragging = false
let isNodeDragging = false
let dragNode = null
let startX = 0
let startY = 0
let nodeStartX = 0
let nodeStartY = 0

// SVG template refs（由组件注册）
let svgCanvasRef = null
let svgGroupRef = null
let minimapElRef = null

export function useCanvasInteraction() {
  const core = useGenealogyCore()
  const { nodes, links, zoom, panX, panY, registerUpdateTransform, registerFitToView } = core
  const { pushHistory } = useHistory()

  const isClampPaused = ref(false)

  // ============ 注册 template refs ============
  const setSvgCanvas = (el) => { svgCanvasRef = el }
  const setSvgGroup = (el) => { svgGroupRef = el }
  const setMinimapEl = (el) => { minimapElRef = el }

  // ============ transform 更新 ============
  const clampPan = () => {
    if (!svgCanvasRef || nodes.value.length === 0) return
    if (isClampPaused.value) return
    const xs = nodes.value.map(n => n.x)
    const ys = nodes.value.map(n => n.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const contentW = (maxX - minX + 200) * zoom.value
    const contentH = (maxY - minY + 200) * zoom.value
    const padding = 100
    const maxPanX = contentW / 2 + padding
    const maxPanY = contentH / 2 + padding
    panX.value = Math.max(-maxPanX, Math.min(maxPanX, panX.value))
    panY.value = Math.max(-maxPanY, Math.min(maxPanY, panY.value))
  }

  const updateTransform = () => {
    if (svgGroupRef && svgCanvasRef) {
      clampPan()
      const rect = svgCanvasRef.getBoundingClientRect()
      const cx = rect.width / 2 + panX.value
      const cy = rect.height / 2 + panY.value
      svgGroupRef.setAttribute('transform', `translate(${cx}, ${cy}) scale(${zoom.value})`)
    }
  }

  // 注册到 core，让其他 composable 可以调用
  registerUpdateTransform(updateTransform)

  // ============ 画布拖拽 ============
  const startCanvasDrag = (e) => {
    if (isNodeDragging) return
    if (e.button !== 0) return
    isDragging = true
    isClampPaused.value = true
    startX = e.clientX - panX.value
    startY = e.clientY - panY.value
    if (typeof document !== 'undefined') document.body.style.cursor = 'grabbing'
    document.addEventListener('mousemove', onCanvasDrag)
    document.addEventListener('mouseup', stopCanvasDrag)
  }

  const onCanvasDrag = (e) => {
    if (!isDragging) return
    panX.value = e.clientX - startX
    panY.value = e.clientY - startY
    updateTransform()
  }

  const stopCanvasDrag = () => {
    isDragging = false
    isClampPaused.value = false
    if (typeof document !== 'undefined') document.body.style.cursor = ''
    document.removeEventListener('mousemove', onCanvasDrag)
    document.removeEventListener('mouseup', stopCanvasDrag)
    updateTransform()
  }

  // ============ 节点拖拽 ============
  const startNodeDrag = (node, e) => {
    if (e.button !== 0) return
    isNodeDragging = true
    dragNode = node
    nodeStartX = e.clientX - node.x
    nodeStartY = e.clientY - node.y
    document.addEventListener('mousemove', onNodeDrag)
    document.addEventListener('mouseup', stopNodeDrag)
  }

  const onNodeDrag = (e) => {
    if (!isNodeDragging || !dragNode) return
    dragNode.x = e.clientX - nodeStartX
    dragNode.y = e.clientY - nodeStartY
  }

  const stopNodeDrag = () => {
    if (isNodeDragging && dragNode) pushHistory()
    isNodeDragging = false
    dragNode = null
    document.removeEventListener('mousemove', onNodeDrag)
    document.removeEventListener('mouseup', stopNodeDrag)
  }

  // ============ 缩放 ============
  const zoomIn = () => {
    zoom.value = Math.min(zoom.value + 0.1, 3)
    updateTransform()
  }

  const zoomOut = () => {
    zoom.value = Math.max(zoom.value - 0.1, 0.3)
    updateTransform()
  }

  const onWheelZoom = (e) => {
    if (!svgGroupRef || !svgCanvasRef) return
    const rect = svgCanvasRef.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const oldZoom = zoom.value
    const step = -e.deltaY * 0.001
    let newZoom = oldZoom + step
    newZoom = Math.max(0.3, Math.min(3, newZoom))
    if (newZoom === oldZoom) return
    zoom.value = newZoom
    const oldCx = rect.width / 2 + panX.value
    const oldCy = rect.height / 2 + panY.value
    const ratio = newZoom / oldZoom
    const newCx = mx - (mx - oldCx) * ratio
    const newCy = my - (my - oldCy) * ratio
    panX.value = newCx - rect.width / 2
    panY.value = newCy - rect.height / 2
    svgGroupRef.setAttribute('transform', `translate(${newCx}, ${newCy}) scale(${newZoom})`)
  }

  const resetZoom = () => {
    zoom.value = 1
    panX.value = 0
    panY.value = 0
    updateTransform()
  }

  const fitToView = () => {
    if (!svgCanvasRef || nodes.value.length === 0) {
      resetZoom()
      return
    }
    const rect = svgCanvasRef.getBoundingClientRect()
    const padding = 80
    const xs = nodes.value.map(n => n.x)
    const ys = nodes.value.map(n => n.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const contentW = maxX - minX + 200
    const contentH = maxY - minY + 200
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const scaleX = (rect.width - padding * 2) / contentW
    const scaleY = (rect.height - padding * 2) / contentH
    zoom.value = Math.min(scaleX, scaleY, 1)
    zoom.value = Math.max(zoom.value, 0.1)
    panX.value = -centerX * zoom.value
    panY.value = -centerY * zoom.value
    updateTransform()
  }

  /** 居中到指定节点 */
  const centerOnNode = (node) => {
    if (!svgCanvasRef) return
    panX.value = -node.x * zoom.value
    panY.value = -node.y * zoom.value
    updateTransform()
  }

  // ============ 小地图 ============
  const minimapSize = 180
  const minimapPadding = 10

  const minimapBounds = computed(() => {
    if (nodes.value.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
    const xs = nodes.value.map(n => n.x)
    const ys = nodes.value.map(n => n.y)
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
  })

  const minimapScale = computed(() => {
    const b = minimapBounds.value
    const rangeX = (b.maxX - b.minX) || 1
    const rangeY = (b.maxY - b.minY) || 1
    const usable = minimapSize - minimapPadding * 2
    return Math.min(usable / rangeX, usable / rangeY)
  })

  const minimapXOf = (x) => {
    const b = minimapBounds.value
    const rangeX = (b.maxX - b.minX) || 1
    const offsetX = (x - b.minX) / rangeX * (rangeX * minimapScale.value)
    return minimapPadding + offsetX
  }

  const minimapYOf = (y) => {
    const b = minimapBounds.value
    const rangeY = (b.maxY - b.minY) || 1
    const offsetY = (y - b.minY) / rangeY * (rangeY * minimapScale.value)
    return minimapPadding + offsetY
  }

  const minimapLinks = computed(() => {
    if (!links.value.length || !nodes.value.length) return []
    const map = new Map(nodes.value.map(n => [n.id, n]))
    const out = []
    for (const link of links.value) {
      const sourceId = link.source?.id || link.source
      const targetId = link.target?.id || link.target
      const s = map.get(sourceId)
      const t = map.get(targetId)
      if (!s || !t) continue
      out.push({ id: link.id, x1: s.x, y1: s.y, x2: t.x, y2: t.y, spouse: link.relation === 'husband-wife' })
    }
    return out
  })

  const viewportRect = computed(() => {
    if (!svgCanvasRef || nodes.value.length === 0) return { x: 0, y: 0, w: minimapSize, h: minimapSize }
    const rect = svgCanvasRef.getBoundingClientRect()
    const halfWWorld = rect.width / 2 / zoom.value
    const halfHWorld = rect.height / 2 / zoom.value
    const cxWorld = -panX.value / zoom.value
    const cyWorld = -panY.value / zoom.value
    const x1World = cxWorld - halfWWorld
    const y1World = cyWorld - halfHWorld
    const x2World = cxWorld + halfWWorld
    const y2World = cyWorld + halfHWorld
    return {
      x: minimapXOf(x1World), y: minimapYOf(y1World),
      w: minimapXOf(x2World) - minimapXOf(x1World),
      h: minimapYOf(y2World) - minimapYOf(y1World)
    }
  })

  const onMinimapMouseDown = (e) => {
    if (!svgCanvasRef || !minimapElRef) return
    const rect = minimapElRef.getBoundingClientRect()
    const scale = minimapSize / rect.width
    const moveTo = (clientX, clientY) => {
      const mx = (clientX - rect.left) * scale
      const my = (clientY - rect.top) * scale
      const b = minimapBounds.value
      const rangeX = (b.maxX - b.minX) || 1
      const rangeY = (b.maxY - b.minY) || 1
      const worldX = (mx - minimapPadding) / minimapScale.value + b.minX
      const worldY = (my - minimapPadding) / minimapScale.value + b.minY
      panX.value = -worldX * zoom.value
      panY.value = -worldY * zoom.value
      updateTransform()
    }
    moveTo(e.clientX, e.clientY)
    const onMove = (ev) => moveTo(ev.clientX, ev.clientY)
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // fitToView 在 const 声明后才能注册
  registerFitToView(fitToView)

  return {
    // refs
    setSvgCanvas, setSvgGroup, setMinimapEl,
    // 拖拽
    startCanvasDrag, onCanvasDrag, stopCanvasDrag,
    startNodeDrag, onNodeDrag, stopNodeDrag,
    isClampPaused,
    // 缩放
    zoomIn, zoomOut, onWheelZoom, resetZoom, fitToView,
    clampPan, updateTransform, centerOnNode,
    // 小地图
    minimapSize, minimapPadding, minimapBounds, minimapScale,
    minimapXOf, minimapYOf, minimapLinks, viewportRect,
    onMinimapMouseDown,
  }
}
