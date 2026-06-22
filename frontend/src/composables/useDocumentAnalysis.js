import { ref, nextTick } from 'vue'
import { useGenealogyCore } from './useGenealogyCore'
import { useHistory } from './useHistory'
import { useSessionManagement } from './useSessionManagement'

const API_BASE_URL = '/api'
let currentAbortController = null
const fileInput = ref(null)
const gedcomInput = ref(null)

export function useDocumentAnalysis() {
  const core = useGenealogyCore()
  const { nodes, links, showUpload, isLoading, hasError, loadingMessage, statusText } = core
  const { pushHistory } = useHistory()
  const sess = useSessionManagement()

  const cancelAnalysis = () => { if (currentAbortController) currentAbortController.abort() }

  const triggerFileUpload = () => { fileInput.value?.click() }
  const triggerGedcomUpload = () => { gedcomInput.value?.click() }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (file) await analyzeDocument(file)
    event.target.value = ''
  }

  const handleGedcomUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const text = await file.text()
    await importGedcomFromText(file.name, text)
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    core.isDragOverCanvas.value = false
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    if (file.name.toLowerCase().endsWith('.ged')) await importGedcomFromText(file.name, await file.text())
    else await analyzeDocument(file)
  }

  const onCanvasDragOver = (event) => {
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    core.isDragOverCanvas.value = true
  }

  const onCanvasDragLeave = (event) => {
    if (event.currentTarget && event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return
    core.isDragOverCanvas.value = false
  }

  // ============ 文档分析 ============

  const analyzeDocument = async (file) => {
    await sess.flushAutoSave()
    const sessionAtStart = sess.currentSessionId.value
    currentAbortController = new AbortController()
    const signal = currentAbortController.signal
    isLoading.value = true; hasError.value = false; showUpload.value = false
    loadingMessage.value = '正在读取文档...'

    let targetSessionId = sessionAtStart
    if (sessionAtStart && nodes.value.length > 0) {
      try {
        sess.cacheCurrentState()
        const res = await fetch('/api/sessions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name.replace(/\.[^.]+$/, '') || '未命名族谱' })
        })
        const json = await res.json()
        if (json.success) targetSessionId = json.data.id
      } catch (err) { console.error('预创建会话失败:', err) }
    }

    try {
      let content = ''
      if (file.name.toLowerCase().endsWith('.txt')) {
        const reader = new FileReader()
        content = await new Promise((resolve) => { reader.onload = (e) => resolve(e.target.result); reader.readAsText(file) })
      } else {
        const formData = new FormData()
        formData.append('file', file)
        loadingMessage.value = '正在解析文档...'
        const headers = {}
        if (sess.apiKey.value) headers['X-API-Key'] = sess.apiKey.value
        const response = await fetch(`${API_BASE_URL}/upload?force=${sess.forceMode.value}`, { method: 'POST', headers, body: formData, signal })
        if (!response.ok) {
          let backendMsg = '文档上传失败，请检查文件格式是否正确'
          try { const errJson = await response.json(); if (errJson?.error?.message) backendMsg = errJson.error.message } catch (_) {}
          throw new Error(backendMsg)
        }
        const result = await response.json()
        if (!result.success) throw new Error(result.error?.message || '无法从文档中提取族谱信息')
        sess.aiProviderInfo.value = { provider: result.data?.provider, fallback: result.data?.fallback, forced: result.data?.forced, primaryError: result.data?.primaryError }
        loadingMessage.value = '正在构建谱系图...'
        await buildGenealogyData(result.data.members, result.data.relationships, targetSessionId)
        return
      }

      loadingMessage.value = '正在识别家族成员和关系...'
      const headers = { 'Content-Type': 'application/json' }
      if (sess.apiKey.value) headers['X-API-Key'] = sess.apiKey.value
      const response = await fetch(`${API_BASE_URL}/analyze?force=${sess.forceMode.value}`, {
        method: 'POST', headers, body: JSON.stringify({ content, filename: file.name }), signal
      })
      if (!response.ok) throw new Error('AI 分析服务暂时不可用，请稍后重试')
      const result = await response.json()
      if (!result.success) throw new Error(result.error?.message || '未能从文档内容中识别出族谱信息，请检查文档是否包含家族成员和关系描述')
      sess.aiProviderInfo.value = { provider: result.data?.provider, fallback: result.data?.fallback, forced: result.data?.forced, primaryError: result.data?.primaryError }
      loadingMessage.value = '正在构建谱系图...'
      await buildGenealogyData(result.data.members, result.data.relationships, targetSessionId)
    } catch (error) {
      if (error.name === 'AbortError') { statusText.value = '分析已取消'; showUpload.value = true; return }
      console.error('分析失败:', error)
      hasError.value = true
      statusText.value = (error instanceof TypeError && /fetch/i.test(error.message))
        ? '无法连接后端服务，请确认 backend 已在端口 3100 启动（node server.js）'
        : error.message
      showUpload.value = true
    } finally { isLoading.value = false; currentAbortController = null }
  }

  // ============ GEDCOM 导入 ============

  const importGedcomFromText = async (filename, text) => {
    await sess.flushAutoSave()
    const sessionAtStart = sess.currentSessionId.value
    isLoading.value = true; hasError.value = false; showUpload.value = false
    loadingMessage.value = '正在解析 GEDCOM 文件...'

    let targetSessionId = sessionAtStart
    if (sessionAtStart && nodes.value.length > 0) {
      try {
        sess.cacheCurrentState()
        const name = (filename || 'GEDCOM').replace(/\.ged$/i, '')
        const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
        const json = await res.json()
        if (json.success) targetSessionId = json.data.id
      } catch (err) { console.error('预创建会话失败:', err) }
    } else {
      sess.currentSessionName.value = (filename || 'GEDCOM').replace(/\.ged$/i, '')
    }

    try {
      const resp = await fetch('/api/import/gedcom', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, filename })
      })
      const json = await resp.json()
      if (!json.success) throw new Error(json.error?.message || 'GEDCOM 导入失败')
      const { members, relationships } = json.data
      if (!members || members.length === 0) throw new Error('GEDCOM 中未找到成员记录')
      await buildGenealogyData(members, relationships, targetSessionId)
      statusText.value = `已从 ${filename} 导入，共 ${members.length} 人`
    } catch (err) {
      hasError.value = true; statusText.value = '导入失败：' + (err.message || '未知错误'); showUpload.value = true
    } finally { isLoading.value = false }
  }

  // ============ 构建族谱数据 ============

  const buildGenealogyData = async (members, relationships, targetSessionId) => {
    const nodeById = new Map()
    const nodeByName = new Map()
    const newNodes = members.map((member, index) => {
      const id = member.id || `node_${index}`
      const node = { id, name: member.name, gender: member.gender === 'female' ? 'female' : 'male', generation: member.generation || 1, avatar: '', x: 0, y: 0, collapsed: false }
      nodeById.set(id, node)
      if (member.name) nodeByName.set(member.name, node)
      return node
    })
    const findNode = (key) => {
      if (key == null) return null
      if (nodeById.has(key)) return nodeById.get(key)
      if (nodeByName.has(key)) return nodeByName.get(key)
      if (typeof key === 'string' && key.startsWith('@')) {
        const m = members.find(mb => mb.id === key || mb.gedcomXref === key)
        if (m) return nodeById.get(m.id)
      }
      return null
    }
    const newLinks = relationships.map((rel, index) => {
      const sourceKey = rel.source_id || rel.source || rel.person1
      const targetKey = rel.target_id || rel.target || rel.person2
      const sourceNode = findNode(sourceKey)
      const targetNode = findNode(targetKey)
      if (!sourceNode || !targetNode) return null
      return { id: rel.id || `link_${index}`, source: sourceNode, target: targetNode, relation: rel.relation }
    }).filter(link => link !== null)

    const isCurrentSession = targetSessionId === sess.currentSessionId.value || !targetSessionId
    if (isCurrentSession) {
      nodes.value = newNodes; links.value = newLinks
      core.applyTreeLayout()
      nextTick(() => core.canvasFitToView && core.canvasFitToView())
      pushHistory()
      statusText.value = '分析完成，可双击节点编辑'
      if (!sess.currentSessionId.value) {
        try {
          const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '未命名族谱' }) })
          const json = await res.json()
          if (json.success) {
            sess.currentSessionId.value = json.data.id
            sess.currentSessionName.value = json.data.name || '未命名族谱'
            await sess.saveCurrentSession()
            await sess.fetchSessions()
          }
        } catch (err) { console.error('自动创建会话失败:', err) }
      } else { sess.scheduleAutoSave() }
    } else {
      const nodeMap = new Map()
      const serializableNodes = newNodes.map(n => { const node = { ...n }; nodeMap.set(node.id, node); return node })
      const serializableLinks = newLinks.map(l => ({ id: l.id, source: l.source.id, target: l.target.id, relation: l.relation }))
      sess.sessionStateCache.set(targetSessionId, { nodes: serializableNodes, links: serializableLinks, name: sess.currentSessionName.value, zoom: 1, panX: 0, panY: 0 })
      try {
        await fetch(`/api/sessions/${targetSessionId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: serializableNodes.length > 0 ? `${serializableNodes[0].name}的族谱` : '未命名族谱',
            members: serializableNodes.map(n => ({ id: n.id, name: n.name, gender: n.gender, generation: n.generation, x: n.x, y: n.y })),
            relationships: serializableLinks
          })
        })
        await sess.fetchSessions()
        statusText.value = '新族谱已生成，可在左侧会话列表中查看'
      } catch (err) { console.error('保存新族谱失败:', err) }
      sess.restoreState(sess.currentSessionId.value)
    }
  }

  return {
    fileInput, gedcomInput,
    triggerFileUpload, triggerGedcomUpload,
    handleFileUpload, handleGedcomUpload, handleDrop,
    onCanvasDragOver, onCanvasDragLeave,
    cancelAnalysis, analyzeDocument, buildGenealogyData,
  }
}
