import { nextTick } from 'vue'
import { useGenealogyCore } from './useGenealogyCore'

let svgCanvasRef = null

export function useExport() {
  const core = useGenealogyCore()
  const { nodes, hasData, statusText, filteredVisibleNodes } = core

  const setSvgCanvas = (el) => { svgCanvasRef = el }

  /** 将当前族谱画布导出为 PNG 图片 */
  const exportImage = async () => {
    if (!svgCanvasRef || nodes.value.length === 0) return
    try {
      statusText.value = '正在生成图片…'
      await nextTick()

      const visible = filteredVisibleNodes.value
      if (visible.length === 0) { statusText.value = '无可见内容可导出'; return }

      const padding = 120
      const minX = Math.min(...visible.map(n => n.x)) - 85
      const maxX = Math.max(...visible.map(n => n.x)) + 85
      const minY = Math.min(...visible.map(n => n.y)) - 50
      const maxY = Math.max(...visible.map(n => n.y)) + 50
      const vbW = maxX - minX + padding * 2
      const vbH = maxY - minY + padding * 2

      const clone = svgCanvasRef.cloneNode(true)
      clone.setAttribute('viewBox', `${minX - padding} ${minY - padding} ${vbW} ${vbH}`)
      clone.setAttribute('width', vbW)
      clone.setAttribute('height', vbH)
      clone.removeAttribute('class')

      const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      styleEl.textContent = `
        .node circle { fill: #7d3a2c; stroke: #f6dfbd; stroke-width: 4; }
        .node circle.female { fill: #8b4d63; }
        .node circle.highlight { stroke: #9b2f22; stroke-width: 5; }
        .node-text { fill: #fff8ea; text-anchor: middle; font-size: 15px; font-weight: 900; font-family: sans-serif; }
        .generation-text { fill: #fff8ea; text-anchor: middle; font-size: 11px; font-weight: 700; opacity: 0.82; font-family: sans-serif; }
        .link { fill: none; stroke: #7a271b; stroke-width: 2.3; }
        .link.spouse { stroke: #8b5a3c; stroke-width: 1.8; stroke-dasharray: 6 4; }
        .link.highlight { stroke: #9b2f22; stroke-width: 4; }
        .link.spouse.highlight { stroke-width: 3.2; stroke-dasharray: none; }
        .collapse-badge { transform: translate(28px, -28px); }
        .collapse-badge circle { fill: #c4421f; stroke: #fff; stroke-width: 1.5; }
        .collapse-badge text { fill: #fff; font-size: 14px; font-weight: 700; text-anchor: middle; font-family: sans-serif; }
        .collapse-badge.collapsed circle { fill: #5a6f8c; }
        marker polygon { fill: #7a271b; }
      `
      clone.insertBefore(styleEl, clone.firstChild)
      clone.querySelectorAll('title').forEach(t => t.remove())

      const serializer = new XMLSerializer()
      const svgStr = serializer.serializeToString(clone)
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)

      const img = new Image()
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url })

      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = vbW * scale
      canvas.height = vbH * scale
      const ctx = canvas.getContext('2d')
      ctx.scale(scale, scale)
      ctx.fillStyle = '#f5f0ec'
      ctx.fillRect(0, 0, vbW, vbH)
      ctx.drawImage(img, 0, 0, vbW, vbH)
      URL.revokeObjectURL(url)

      const link = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:-]/g, '').replace('T', '_').slice(0, 15)
      link.download = `族谱_${timestamp}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      statusText.value = '导出成功'
    } catch (error) {
      console.error('导出失败:', error)
      statusText.value = '导出失败'
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
      statusText.value = 'GEDCOM 导出成功'
    } catch (err) {
      console.error('GEDCOM 导出失败:', err)
      statusText.value = 'GEDCOM 导出失败'
    }
  }

  return { exportImage, exportGedcom, setExportSvgCanvas: setSvgCanvas }
}
