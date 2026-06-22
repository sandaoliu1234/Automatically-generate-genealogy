import { useGenealogyCore } from './useGenealogyCore'

let svgCanvasRef = null
let statusResetTimer = null  // 状态文本自动还原定时器

// 设置状态文本并在指定毫秒后自动清空（连续操作时自动取消上一次的 timer）
function setStatusAutoReset(statusTextRef, text, duration = 3000) {
  if (statusResetTimer) {
    clearTimeout(statusResetTimer)
    statusResetTimer = null
  }
  statusTextRef.value = text
  statusResetTimer = setTimeout(() => {
    if (statusTextRef.value === text) statusTextRef.value = ''
    statusResetTimer = null
  }, duration)
}

export function useExport() {
  const core = useGenealogyCore()
  const { nodes, hasData, statusText, filteredVisibleNodes } = core

  const setSvgCanvas = (el) => { svgCanvasRef = el }

  /** 导出当前族谱为 SVG 矢量图（缩放不失真） */
  const exportSvg = async () => {
    if (!svgCanvasRef || nodes.value.length === 0) return
    try {
      statusText.value = '正在生成 SVG…'

      const visible = filteredVisibleNodes.value
      if (visible.length === 0) { setStatusAutoReset(statusText, '无可见内容可导出', 3000); return }

      const padding = 80
      const minX = Math.min(...visible.map(n => n.x)) - 85
      const maxX = Math.max(...visible.map(n => n.x)) + 85
      const minY = Math.min(...visible.map(n => n.y)) - 50
      const maxY = Math.max(...visible.map(n => n.y)) + 50
      const vbW = maxX - minX + padding * 2
      const vbH = maxY - minY + padding * 2

      const clone = svgCanvasRef.cloneNode(true)
      const clonedGroup = clone.querySelector('g')
      if (clonedGroup) clonedGroup.removeAttribute('transform')
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
      clone.setAttribute('viewBox', `${minX - padding} ${minY - padding} ${vbW} ${vbH}`)
      clone.setAttribute('width', vbW)
      clone.setAttribute('height', vbH)
      // 关键修复：保留 genealogy-canvas class，让 .genealogy-canvas .link 等选择器生效
      // （之前 removeAttribute('class') 导致连线变成黑色实心块）
      if (!clone.getAttribute('class') || !clone.getAttribute('class').includes('genealogy-canvas')) {
        clone.setAttribute('class', 'genealogy-canvas')
      }
      clone.removeAttribute('style')

      const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      styleEl.textContent = `
        .node-card { fill: #faf6f3; stroke: #e0be8f; stroke-width: 1; }
        .node-accent.male, .node-accent-fill.male { fill: #7d3a2c; }
        .node-accent.female, .node-accent-fill.female { fill: #8b4d63; }
        .node-avatar-bg.male { fill: #5a3a2a; }
        .node-avatar-bg.female { fill: #6b3a4a; }
        .node-avatar-ring { fill: none; stroke: #e0be8f; stroke-width: 1.5; }
        .node-name { font-size: 14px; font-weight: 900; fill: #3d2c22; font-family: "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif; pointer-events: none; }
        .gen-badge { fill: rgba(122, 39, 27, 0.1); }
        .gen-badge-text { font-size: 9px; font-weight: 700; fill: #7a271b; text-anchor: middle; font-family: "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif; pointer-events: none; }
        .node-info { font-size: 10px; fill: #8a7d6b; font-family: "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif; pointer-events: none; }
        .genealogy-canvas .link { fill: none; stroke: #7a271b; stroke-width: 2.3; }
        .genealogy-canvas .link.spouse { stroke: #8b5a3c; stroke-width: 1.8; stroke-dasharray: 6 4; }
        .genealogy-canvas .link.highlight { stroke: #9b2f22; stroke-width: 4; }
        .genealogy-canvas .link.spouse.highlight { stroke-width: 3.2; stroke-dasharray: none; }
        .collapse-badge circle { fill: #c4421f; stroke: #fff; stroke-width: 1.5; }
        .collapse-badge text { fill: #fff; font-size: 14px; font-weight: 700; text-anchor: middle; font-family: sans-serif; }
        .collapse-badge.collapsed circle { fill: #5a6f8c; }
        marker polygon { fill: #7a271b; }
      `
      clone.insertBefore(styleEl, clone.firstChild)
      clone.querySelectorAll('title').forEach(t => t.remove())

      // 关键修复：处理所有 <image> 头像
      // - data URI（默认 SVG 头像）：替换为 <g><svg> 内联结构（无外部依赖）
      // - 远程 URL（用户上传的头像）：fetch 转 base64 data URI（避免 file:// 找不到）
      const imageEls = clone.querySelectorAll('image')
      const remoteImageEls = []

      imageEls.forEach(imgEl => {
        const href = imgEl.getAttribute('href') || imgEl.getAttribute('xlink:href') || (imgEl.href && imgEl.href.baseVal)
        if (!href) return
        if (href.startsWith('data:image/svg+xml')) {
          // 默认 SVG 头像：替换为 <g transform><svg> 内联结构
          const isFemale = href.includes('6b3a4a') || href.includes('e8c4d0')
          const x = imgEl.getAttribute('x') || '-71'
          const y = imgEl.getAttribute('y') || '-18'
          const w = imgEl.getAttribute('width') || '36'
          const h = imgEl.getAttribute('height') || '36'

          const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g')
          wrapper.setAttribute('transform', `translate(${x}, ${y})`)

          const inner = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
          inner.setAttribute('width', w)
          inner.setAttribute('height', h)
          inner.setAttribute('viewBox', '0 0 80 80')
          inner.innerHTML = isFemale
            ? '<rect width="80" height="80" rx="40" fill="#6b3a4a"/><circle cx="40" cy="28" r="14" fill="#e8c4d0"/><ellipse cx="40" cy="62" rx="22" ry="18" fill="#e8c4d0"/>'
            : '<rect width="80" height="80" rx="40" fill="#5a3a2a"/><circle cx="40" cy="28" r="14" fill="#d4b896"/><ellipse cx="40" cy="62" rx="22" ry="18" fill="#d4b896"/>'

          wrapper.appendChild(inner)
          imgEl.parentNode.replaceChild(wrapper, imgEl)
        } else {
          // 远程 URL（用户上传的头像）：后续 fetch 转 base64
          remoteImageEls.push({ imgEl, href })
        }
      })

      // 远程头像 fetch + 转 base64 data URI
      if (remoteImageEls.length) {
        statusText.value = `正在加载 ${remoteImageEls.length} 张头像…`
        await Promise.all(remoteImageEls.map(async ({ imgEl, href }) => {
          try {
            const response = await fetch(href)
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const blob = await response.blob()
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result)
              reader.onerror = () => reject(new Error('FileReader 失败'))
              reader.readAsDataURL(blob)
            })
            // 更新 <image> 的 href 为 data URI
            imgEl.setAttribute('href', dataUrl)
            imgEl.setAttribute('xlink:href', dataUrl)
          } catch (e) {
            console.warn('头像加载失败（将使用占位）:', href, e)
            // 加载失败：替换为灰色占位（用纯色矩形）
            const x = imgEl.getAttribute('x') || '-71'
            const y = imgEl.getAttribute('y') || '-18'
            const w = imgEl.getAttribute('width') || '36'
            const h = imgEl.getAttribute('height') || '36'
            const placeholder = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
            placeholder.setAttribute('x', x)
            placeholder.setAttribute('y', y)
            placeholder.setAttribute('width', w)
            placeholder.setAttribute('height', h)
            placeholder.setAttribute('fill', '#cccccc')
            placeholder.setAttribute('rx', '18')
            imgEl.parentNode.replaceChild(placeholder, imgEl)
          }
        }))
      }

      const serializer = new XMLSerializer()
      const svgStr = serializer.serializeToString(clone)
      // 加 XML 头，让浏览器和图片查看器正确识别
      const xml = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgStr
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:-]/g, '').replace('T', '_').slice(0, 15)
      link.download = `族谱_${timestamp}.svg`
      link.href = url
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
      setStatusAutoReset(statusText, 'SVG 导出成功', 3000)
    } catch (error) {
      console.error('SVG 导出失败:', error)
      setStatusAutoReset(statusText, 'SVG 导出失败', 5000)
    }
  }

  /** 导出当前族谱为 GEDCOM 5.5.1 文件 */
  const exportGedcom = async () => {
    if (!hasData.value) return
    try {
      statusText.value = '正在导出 GEDCOM…'
      const payload = {
        members: nodes.value.map(n => ({ id: n.id, name: n.name, gender: n.gender, generation: n.generation })),
        relationships: core.links.value.map(l => ({
          source: l.source && l.source.id ? l.source.id : l.source,
          target: l.target && l.target.id ? l.target.id : l.target,
          relation: l.relation
        })),
        filename: 'genealogy.ged'
      }
      const res = await fetch('/api/export/gedcom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const ts = new Date().toISOString().replace(/[:-]/g, '').replace('T', '_').slice(0, 15)
      link.download = `族谱_${ts}.ged`
      link.href = url
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
      setStatusAutoReset(statusText, 'GEDCOM 导出成功', 3000)
    } catch (err) {
      console.error('GEDCOM 导出失败:', err)
      setStatusAutoReset(statusText, 'GEDCOM 导出失败', 5000)
    }
  }

  return { exportSvg, exportGedcom, setExportSvgCanvas: setSvgCanvas }
}
