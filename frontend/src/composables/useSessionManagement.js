import { ref, computed, watch, nextTick } from 'vue'
import { useGenealogyCore } from './useGenealogyCore'
import { useHistory } from './useHistory'

// 会话状态缓存：每个会话独立存储 nodes/links
const sessionStateCache = new Map()
const sessions = ref([])
const currentSessionId = ref(null)
const currentSessionName = ref('')
const isSaving = ref(false)
const lastSavedAt = ref(null)
const autoSaveEnabled = ref(localStorage.getItem('genealogy_autosave') !== 'false')
const sessionNameInput = ref('')
const editingSessionId = ref(null)
let renameSessionOriginalName = ''
let autoSaveTimer = null

export function useSessionManagement() {
  const core = useGenealogyCore()
  const { nodes, links, zoom, panX, panY, showUpload, statusText } = core
  const { history, historyIndex, pushHistory, clearHistory } = useHistory()

  const displayStatus = computed(() => {
    if (core.operationMessage.value) return core.operationMessage.value
    if (core.hasError.value) return statusText.value
    if (core.isLoading.value) return '正在分析中...'
    if (sessions.value.length > 0 && !currentSessionId.value && !core.hasData.value) return '请选择一个族谱会话或新建会话'
    if (!apiKey.value) return '请先配置分析密钥，然后上传文档'
    if (core.hasData.value) return currentSessionName.value ? `「${currentSessionName.value}」已生成` : '族谱已生成，双击节点可编辑'
    return '密钥已就绪，上传文档即可生成族谱'
  })

  // API 密钥管理
  const apiKey = ref(localStorage.getItem('genealogy_api_key') || '')
  const userApiKey = ref(apiKey.value)
  const VALID_FORCE_MODES = ['auto', 'cloud', 'local']
  const forceMode = ref(localStorage.getItem('genealogy_force_mode') || 'auto')
  const aiProviderInfo = ref(null)

  const providerBadge = computed(() => {
    const info = aiProviderInfo.value
    if (!info || !info.provider) return null
    if (info.forced === 'cloud') return { text: '阿里云百炼（强制）', tone: 'cloud' }
    if (info.forced === 'local') return { text: '本地 Ollama（强制）', tone: 'local' }
    if (info.fallback) return { text: '本地 Ollama（兜底 · 阿里云异常）', tone: 'fallback', hint: info.primaryError }
    return { text: '阿里云百炼', tone: 'cloud' }
  })

  const saveApiKey = () => {
    apiKey.value = userApiKey.value
    localStorage.setItem('genealogy_api_key', userApiKey.value)
    core.showSettings.value = false
    core.operationMessage.value = '密钥保存成功，可以开始上传文档'
    setTimeout(() => { core.operationMessage.value = '' }, 3000)
  }

  const clearApiKey = () => {
    userApiKey.value = ''
    apiKey.value = ''
    localStorage.removeItem('genealogy_api_key')
    core.operationMessage.value = '密钥已清除'
    setTimeout(() => { core.operationMessage.value = '' }, 3000)
  }

  const setForceMode = (mode) => {
    if (!VALID_FORCE_MODES.includes(mode)) return
    forceMode.value = mode
    localStorage.setItem('genealogy_force_mode', mode)
  }

  const closeSettings = () => {
    core.showSettings.value = false
    userApiKey.value = apiKey.value
  }

  // ============ 会话缓存 ============

  const cacheCurrentState = () => {
    if (currentSessionId.value) {
      sessionStateCache.set(currentSessionId.value, {
        nodes: JSON.parse(JSON.stringify(nodes.value)),
        links: links.value.map(l => ({
          id: l.id, source: l.source?.id || l.source,
          target: l.target?.id || l.target, relation: l.relation
        })),
        name: currentSessionName.value,
        zoom: zoom.value, panX: panX.value, panY: panY.value
      })
    }
  }

  const restoreState = (sessionId) => {
    const cached = sessionStateCache.get(sessionId)
    if (cached) {
      const nodeMap = new Map()
      nodes.value = cached.nodes.map(n => { const node = { ...n }; nodeMap.set(node.id, node); return node })
      links.value = cached.links.map(l => ({
        ...l, source: nodeMap.get(l.source) || l.source, target: nodeMap.get(l.target) || l.target
      }))
      currentSessionName.value = cached.name || '未命名族谱'
      zoom.value = cached.zoom || 1
      panX.value = cached.panX || 0
      panY.value = cached.panY || 0
    } else {
      nodes.value = []
      links.value = []
    }
    showUpload.value = nodes.value.length === 0
  }

  // ============ 时间格式化 ============
  const formatTime = (date) => {
    if (!date) return ''
    const d = new Date(date)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }

  // ============ 会话 CRUD ============

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions')
      const json = await res.json()
      if (json.success) sessions.value = json.data || []
      else console.error('拉取会话列表失败:', json.error)
    } catch (err) { console.error('拉取会话列表失败:', err) }
  }

  const createNewSession = async () => {
    await flushAutoSave()
    cacheCurrentState()
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '未命名族谱' })
      })
      const json = await res.json()
      if (json.success) {
        currentSessionId.value = json.data.id
        currentSessionName.value = json.data.name || '未命名族谱'
        nodes.value = []; links.value = []
        showUpload.value = true
        zoom.value = 1; panX.value = 0; panY.value = 0
        clearHistory()
        statusText.value = '新会话已创建，请上传文档'
        await fetchSessions()
      } else {
        statusText.value = '创建会话失败：' + (json.error?.message || '未知错误')
      }
    } catch (err) {
      console.error('创建会话失败:', err)
      statusText.value = '创建会话失败，请检查后端服务'
    }
  }

  const loadSession = async (id) => {
    await flushAutoSave()
    cacheCurrentState()
    if (sessionStateCache.has(id)) {
      currentSessionId.value = id
      restoreState(id)
      core.applyTreeLayout()
      core.updateTransform()
      pushHistory()
      statusText.value = `已加载「${currentSessionName.value}」`
      return
    }
    try {
      const res = await fetch(`/api/sessions/${id}`)
      const json = await res.json()
      if (!json.success) { statusText.value = '加载会话失败：' + (json.error?.message || '未知错误'); return }
      const data = json.data
      const nodeMap = new Map()
      currentSessionId.value = data.id
      currentSessionName.value = data.name || '未命名族谱'
      nodes.value = (data.members || []).map(m => {
        const node = {
          id: m.id, name: m.name || '', gender: m.gender === 'female' ? 'female' : 'male',
          generation: m.generation || 1, birth: m.birth || '', death: m.death || '', note: m.note || '',
          avatar: m.avatar || '',
          x: m.x != null ? m.x : 0, y: m.y != null ? m.y : 0, collapsed: false
        }
        nodeMap.set(node.id, node)
        return node
      })
      links.value = (data.relationships || []).map((r, idx) => {
        const source = nodeMap.get(r.source_id)
        const target = nodeMap.get(r.target_id)
        if (!source || !target) return null
        return { id: r.id || `link_${idx}`, source, target, relation: r.relation }
      }).filter(l => l !== null)
      showUpload.value = nodes.value.length === 0
      core.applyTreeLayout()
      nextTick(() => core.canvasFitToView && core.canvasFitToView())
      pushHistory()
      cacheCurrentState()
      statusText.value = `已加载「${currentSessionName.value}」`
    } catch (err) {
      console.error('加载会话失败:', err)
      statusText.value = '加载会话失败，请检查后端服务'
    }
  }

  const saveCurrentSessionTo = async (id) => {
    if (!id || nodes.value.length === 0) return
    if (id !== currentSessionId.value) return
    isSaving.value = true
    try {
      const payload = {
        name: currentSessionName.value || '未命名族谱',
        members: nodes.value.map(n => ({
          id: n.id, name: n.name, gender: n.gender, generation: n.generation,
          birth: n.birth, death: n.death, note: n.note, avatar: n.avatar || '', x: n.x, y: n.y
        })),
        relationships: links.value.map(l => ({
          id: l.id, source: l.source?.id || l.source, target: l.target?.id || l.target, relation: l.relation
        }))
      }
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (json.success) { lastSavedAt.value = new Date(); statusText.value = '会话已保存'; await fetchSessions() }
      else statusText.value = '保存会话失败：' + (json.error?.message || '未知错误')
    } catch (err) { console.error('保存会话失败:', err); statusText.value = '保存会话失败，请检查后端服务' }
    finally { isSaving.value = false }
  }

  const saveCurrentSession = () => {
    if (!currentSessionId.value) return
    return saveCurrentSessionTo(currentSessionId.value)
  }

  const deleteSession = async (id) => {
    const session = sessions.value.find(s => s.id === id)
    core.confirmDialog.value = {
      title: '确认删除会话',
      message: `确定要删除会话「${session ? session.name : id}」吗？该会话下的所有数据将被永久删除。`,
      confirmText: '删除', danger: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
          const json = await res.json()
          if (json.success) {
            sessionStateCache.delete(id)
            if (currentSessionId.value === id) {
              currentSessionId.value = null; currentSessionName.value = ''
              nodes.value = []; links.value = []; showUpload.value = true
              statusText.value = '等待上传文档'
            }
            await fetchSessions()
          } else statusText.value = '删除会话失败：' + (json.error?.message || '未知错误')
        } catch (err) { console.error('删除会话失败:', err); statusText.value = '删除会话失败，请检查后端服务' }
        finally { core.confirmDialog.value = null }
      }
    }
  }

  // ============ 重命名 ============

  const startRenameSession = (session) => {
    editingSessionId.value = session.id
    sessionNameInput.value = session.name
    renameSessionOriginalName = session.name
    nextTick(() => { const el = document.querySelector('.session-name-input'); el && el.focus() })
  }

  const commitRenameSession = async () => {
    const id = editingSessionId.value
    if (!id) return
    const newName = sessionNameInput.value.trim() || '未命名族谱'
    const session = sessions.value.find(s => s.id === id)
    if (session && session.name === newName) { editingSessionId.value = null; return }
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName })
      })
      const json = await res.json()
      if (json.success) { if (currentSessionId.value === id) currentSessionName.value = newName; await fetchSessions() }
      else statusText.value = '重命名失败：' + (json.error?.message || '未知错误')
    } catch (err) { console.error('重命名会话失败:', err); statusText.value = '重命名失败，请检查后端服务' }
    finally { editingSessionId.value = null }
  }

  const cancelRenameSession = () => {
    const id = editingSessionId.value
    if (!id) return
    const session = sessions.value.find(s => s.id === id)
    if (session) session.name = renameSessionOriginalName
    editingSessionId.value = null
    sessionNameInput.value = ''
  }

  // ============ 自动保存 ============

  const scheduleAutoSave = () => {
    if (!autoSaveEnabled.value || !currentSessionId.value || nodes.value.length === 0) return
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(() => { autoSaveTimer = null; saveCurrentSession() }, 2000)
  }

  const flushAutoSave = async () => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer); autoSaveTimer = null
      if (currentSessionId.value && nodes.value.length > 0) await saveCurrentSession()
    }
  }

  // 监听节点/关系变化触发自动保存
  watch([nodes, links], () => { scheduleAutoSave() }, { deep: true })
  watch(autoSaveEnabled, (val) => {
    localStorage.setItem('genealogy_autosave', String(val))
    if (val) scheduleAutoSave()
  })

  /** 清空当前族谱数据并回到上传初始状态 */
  const clearAll = () => {
    core.confirmDialog.value = {
      title: '确认清空',
      message: '确定要清空当前族谱数据吗？此操作不可撤销。',
      confirmText: '清空全部', danger: true,
      onConfirm: () => {
        nodes.value = []; links.value = []; showUpload.value = true
        statusText.value = '等待上传文档'
        zoom.value = 1; panX.value = 0; panY.value = 0
        clearHistory()
        core.confirmDialog.value = null
        if (currentSessionId.value) sessionStateCache.delete(currentSessionId.value)
      }
    }
  }

  return {
    // 会话状态
    sessions, currentSessionId, currentSessionName,
    isSaving, lastSavedAt, autoSaveEnabled,
    sessionNameInput, editingSessionId,
    displayStatus,
    // API 密钥
    apiKey, userApiKey, forceMode, aiProviderInfo, providerBadge,
    saveApiKey, clearApiKey, setForceMode, closeSettings,
    // 会话操作
    fetchSessions, createNewSession, loadSession,
    saveCurrentSessionTo, saveCurrentSession, deleteSession,
    startRenameSession, commitRenameSession, cancelRenameSession,
    // 缓存
    sessionStateCache, cacheCurrentState, restoreState,
    // 自动保存
    scheduleAutoSave, flushAutoSave,
    // 工具
    formatTime, clearAll,
  }
}
