<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-seal">谱</div>
        <div>
          <p class="brand-kicker">智能谱牒工作台</p>
          <h1>族谱生成器</h1>
        </div>
      </div>

      <div class="topbar-actions">
        <button class="btn btn-icon" @click="undo" :disabled="!canUndo" aria-label="撤销 (Ctrl+Z)" title="撤销 (Ctrl+Z)">↶</button>
        <button class="btn btn-icon" @click="redo" :disabled="!canRedo" aria-label="重做 (Ctrl+Y)" title="重做 (Ctrl+Y)">↷</button>
        <span class="toolbar-sep"></span>
        <button class="btn btn-primary" @click="triggerFileUpload" :disabled="isLoading" aria-label="上传文档">
          {{ isLoading ? '分析中' : '上传文档' }}
        </button>
        <button class="btn btn-plain" @click="exportImage" :disabled="!hasData || isLoading" aria-label="导出图片">
          导出图片
        </button>
        <button class="btn btn-plain danger" @click="clearAll" :disabled="!hasData || isLoading" aria-label="清空族谱">
          清空
        </button>
        <button class="btn btn-plain" @click="showSettings = true" aria-label="打开设置">
          设置
        </button>
      </div>

      <input
        ref="fileInput"
        type="file"
        class="upload-input"
        accept=".txt,.pdf,.doc,.docx"
        @change="handleFileUpload"
      />
    </header>

    <main class="workspace">
      <aside class="side-panel">
        <section class="panel-section">
          <p class="section-label">当前状态</p>
          <div class="status-line">
            <span class="status-dot" :class="{ error: hasError, loading: isLoading, pending: !apiKey && !isLoading && !hasError }"></span>
            <span>{{ displayStatus }}</span>
          </div>
        </section>

        <section class="metrics-grid">
          <div class="metric-card">
            <span class="metric-value">{{ nodes.length }}</span>
            <span class="metric-label">成员</span>
          </div>
          <div class="metric-card">
            <span class="metric-value">{{ links.length }}</span>
            <span class="metric-label">关系</span>
          </div>
        </section>

        <section class="panel-section">
          <p class="section-label">智能分析</p>
          <div class="api-state" :class="{ ready: apiKey }">
            <span>{{ apiKey ? '分析密钥已就绪' : '尚未配置分析密钥' }}</span>
          </div>
          <button class="panel-link" @click="showSettings = true">管理分析密钥</button>
        </section>

        <section class="panel-section">
          <p class="section-label">编辑提示</p>
          <ul class="hint-list">
            <li>双击成员节点可编辑姓名和性别</li>
            <li>拖拽画布可移动视图，拖拽节点可微调位置</li>
            <li>右下角可缩放族谱视图</li>
          </ul>
        </section>

        <section class="panel-section query-panel" v-if="hasData">
          <p class="section-label">关系查询</p>
          <div class="query-fields">
            <div class="query-field">
              <label class="query-label" for="query-a">人物 A</label>
              <select id="query-a" v-model="queryPersonA" class="form-select">
                <option value="">请选择</option>
                <option v-for="n in nodes" :key="n.id" :value="n.id">{{ n.name }}</option>
              </select>
            </div>
            <div class="query-field">
              <label class="query-label" for="query-b">人物 B</label>
              <select id="query-b" v-model="queryPersonB" class="form-select">
                <option value="">请选择</option>
                <option v-for="n in nodes" :key="n.id" :value="n.id">{{ n.name }}</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary query-btn" @click="queryRelationship" :disabled="!queryPersonA || !queryPersonB || queryPersonA === queryPersonB">
            查询关系
          </button>
          <div v-if="queryResult" class="query-result" :class="{ 'no-path': !queryResult.found }">
            <template v-if="queryResult.found">
              <div class="query-pair">
                <span class="query-person">{{ queryResult.nameA }}</span>
                <span class="query-arrow">称</span>
                <span class="query-person">{{ queryResult.nameB }}</span>
                <span class="query-sep">为</span>
                <span class="query-role">{{ queryResult.relation.aToB }}</span>
              </div>
              <div class="query-pair">
                <span class="query-person">{{ queryResult.nameB }}</span>
                <span class="query-arrow">称</span>
                <span class="query-person">{{ queryResult.nameA }}</span>
                <span class="query-sep">为</span>
                <span class="query-role">{{ queryResult.relation.bToA }}</span>
              </div>
            </template>
            <p v-else class="query-relation">{{ queryResult.relation }}</p>
            <p class="query-desc">{{ queryResult.description }}</p>
          </div>
        </section>
      </aside>

      <section class="main-stage" ref="mainContent">
        <div v-if="showUpload" class="upload-section" @dragover.prevent @drop="handleDrop">
          <div class="upload-mark">
            <span>宗</span>
          </div>
          <p class="upload-kicker">上传文档，自动提取直系亲属关系</p>
          <h2>从文本、PDF 或 Word 生成可编辑族谱</h2>
          <p class="upload-subtitle">
            支持 TXT、PDF、DOC、DOCX。系统会识别成员、代际和父母子女关系，并生成可拖拽编辑的谱图。
          </p>
          <div class="upload-actions">
            <button class="btn btn-primary large" @click="triggerFileUpload">选择文档</button>
            <button class="btn btn-plain large" @click="showSettings = true">配置分析密钥</button>
          </div>
          <div class="format-row">
            <span>TXT</span>
            <span>PDF</span>
            <span>DOC</span>
            <span>DOCX</span>
          </div>
        </div>

        <div v-if="isLoading" class="loading-overlay">
          <div class="loading-card">
            <div class="loading-spinner"></div>
            <div>
              <p class="loading-title">正在整理谱系</p>
              <p class="loading-text">{{ loadingMessage }}</p>
            </div>
          </div>
        </div>

        <div v-if="hasData && !showUpload" class="canvas-container" ref="canvasContainer">
          <div class="zodiac-watermark" aria-hidden="true">鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪</div>
          <div class="scroll-title">
            <span></span>
            <strong>族谱世系图</strong>
            <span></span>
          </div>

          <svg ref="svgCanvas" class="genealogy-canvas" @mousedown="startCanvasDrag" role="img" aria-label="族谱世系图画布">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#7a271b" />
              </marker>
            </defs>
            <g ref="svgGroup">
              <g v-for="link in links" :key="link.id">
                <path
                  :d="link.relation === 'husband-wife' ? getSpouseLinkPath(link) : getLinkPath(link)"
                  :class="['link', { spouse: link.relation === 'husband-wife', highlight: highlightedLinks.includes(link.id) }]"
                  :marker-end="link.relation === 'husband-wife' ? '' : 'url(#arrowhead)'"
                />
              </g>
              <g
                v-for="node in nodes"
                :key="node.id"
                class="node"
                :transform="`translate(${node.x}, ${node.y})`"
                @mousedown.stop="startNodeDrag(node, $event)"
                @dblclick="editNode(node)"
              >
                <circle r="38" :class="[node.gender, { highlight: highlightedNodes.includes(node.id) }]" />
                <text class="generation-text" dy="-14">{{ node.generation }}世</text>
                <text class="node-text" dy="10">
                  {{ node.name.length > 4 ? node.name.slice(0, 4) + '…' : node.name }}
                </text>
                <title>{{ node.name }}（{{ node.gender === 'female' ? '女' : '男' }}，{{ node.generation }}世）</title>
              </g>
            </g>
          </svg>

          <div class="zoom-controls" role="group" aria-label="缩放控制">
            <button @click="zoomOut" aria-label="缩小" title="缩小 (-)">-</button>
            <span aria-live="polite">{{ Math.round(zoom * 100) }}%</span>
            <button @click="zoomIn" aria-label="放大" title="放大 (+)">+</button>
            <button @click="resetZoom" aria-label="重置缩放" title="重置 (0)">重置</button>
          </div>
        </div>
      </section>
    </main>

    <div v-if="showSettings" class="modal" @click.self="closeSettings" role="dialog" aria-modal="true" aria-label="分析密钥设置">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <p class="section-label">分析密钥设置</p>
            <h3>配置 AI 分析密钥</h3>
          </div>
          <button class="modal-close" @click="closeSettings" aria-label="关闭">×</button>
        </div>
        <div class="form-group">
          <label class="form-label">分析密钥</label>
          <input
            v-model="userApiKey"
            type="password"
            class="form-input"
            placeholder="粘贴你的 API Key"
          />
          <small class="form-hint">密钥仅保存在你的浏览器中，不会上传到任何服务器。</small>
        </div>
        <div class="settings-info">
          <h4>如何获取密钥</h4>
          <ol>
            <li>打开阿里云百炼控制台（bailian.console.aliyun.com）</li>
            <li>登录后点击右上角头像，选择「API-KEY」</li>
            <li>点击「创建新的 API-KEY」，复制后粘贴到上方输入框</li>
          </ol>
        </div>
        <div class="form-buttons">
          <button class="btn btn-plain danger" @click="clearApiKey">清除密钥</button>
          <button class="btn btn-primary" @click="saveApiKey">保存密钥</button>
        </div>
      </div>
    </div>

    <div v-if="showNodeEdit" class="modal" @click.self="closeNodeEdit" role="dialog" aria-modal="true" aria-label="成员编辑">
      <div class="modal-content compact">
        <div class="modal-header">
          <div>
            <p class="section-label">成员编辑</p>
            <h3>调整族谱成员</h3>
          </div>
          <button class="modal-close" @click="closeNodeEdit" aria-label="关闭">×</button>
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-name">姓名</label>
          <input
            id="edit-name"
            v-model="editingNode.name"
            class="form-input"
            placeholder="输入姓名"
            maxlength="50"
            @keyup.enter="saveNodeEdit"
            autofocus
          />
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-gender">性别</label>
          <select id="edit-gender" v-model="editingNode.gender" class="form-select">
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
        </div>
        <div class="form-buttons">
          <button class="btn btn-plain danger" @click="deleteNode(editingNode)">删除成员</button>
          <button class="btn btn-primary" @click="saveNodeEdit">保存修改</button>
        </div>
      </div>
    </div>

    <div v-if="confirmDialog" class="modal" role="alertdialog" aria-modal="true" aria-label="确认操作">
      <div class="modal-content compact">
        <div class="modal-header">
          <h3>{{ confirmDialog.title }}</h3>
        </div>
        <p class="confirm-message">{{ confirmDialog.message }}</p>
        <div class="form-buttons">
          <button class="btn btn-plain" @click="confirmDialog = null">取消</button>
          <button :class="['btn', confirmDialog.danger ? 'btn-danger' : 'btn-primary']" @click="confirmDialog.onConfirm">{{ confirmDialog.confirmText }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import html2canvas from 'html2canvas'

const fileInput = ref(null)
const mainContent = ref(null)
const svgCanvas = ref(null)
const svgGroup = ref(null)
const canvasContainer = ref(null)

const nodes = ref([])
const links = ref([])
const isLoading = ref(false)
const loadingMessage = ref('正在分析文档...')
const showUpload = ref(true)
const hasError = ref(false)
const statusText = ref('')
const operationMessage = ref('')
const showNodeEdit = ref(false)
const editingNode = ref({})
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)

// 关系查询状态
const queryPersonA = ref('')
const queryPersonB = ref('')
const queryResult = ref(null)
const highlightedNodes = ref([])
const highlightedLinks = ref([])

const hasData = computed(() => nodes.value.length > 0)
const API_BASE_URL = '/api'
const apiKey = ref(localStorage.getItem('genealogy_api_key') || '')
const userApiKey = ref(apiKey.value)
const showSettings = ref(false)

let isDragging = false
let isNodeDragging = false
let dragNode = null
let startX = 0
let startY = 0
let nodeStartX = 0
let nodeStartY = 0

// 撤销/重做历史栈
const history = ref([])
const historyIndex = ref(-1)
const MAX_HISTORY = 30
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

// 确认对话框状态
const confirmDialog = ref(null)

const displayStatus = computed(() => {
  if (operationMessage.value) return operationMessage.value
  if (hasError.value) return statusText.value
  if (isLoading.value) return '正在分析中...'
  if (!apiKey.value) return '请先配置分析密钥，然后上传文档'
  if (hasData.value) return '族谱已生成，双击节点可编辑'
  return '密钥已就绪，上传文档即可生成族谱'
})

// 保存当前状态到历史栈，用于撤销/重做。
const pushHistory = () => {
  const snapshot = JSON.stringify({
    nodes: nodes.value.map(n => ({ ...n })),
    links: links.value.map(l => ({
      id: l.id,
      sourceId: l.source.id,
      targetId: l.target.id,
      relation: l.relation
    }))
  })
  history.value = history.value.slice(0, historyIndex.value + 1)
  history.value.push(snapshot)
  if (history.value.length > MAX_HISTORY) history.value.shift()
  historyIndex.value = history.value.length - 1
}

// 从历史栈恢复指定索引的状态。
const restoreHistory = (index) => {
  const snapshot = JSON.parse(history.value[index])
  const nodeMap = new Map()
  nodes.value = snapshot.nodes.map(n => {
    const node = { ...n }
    nodeMap.set(node.id, node)
    return node
  })
  links.value = snapshot.links
    .map(l => ({
      id: l.id,
      source: nodeMap.get(l.sourceId),
      target: nodeMap.get(l.targetId),
      relation: l.relation
    }))
    .filter(l => l.source && l.target)
  historyIndex.value = index
}

const undo = () => {
  if (!canUndo.value) return
  restoreHistory(historyIndex.value - 1)
  setTimeout(updateTransform, 0)
}

const redo = () => {
  if (!canRedo.value) return
  restoreHistory(historyIndex.value + 1)
  setTimeout(updateTransform, 0)
}

// 保存用户填写的分析密钥，用于后续 AI 分析请求。
const saveApiKey = () => {
  apiKey.value = userApiKey.value
  localStorage.setItem('genealogy_api_key', userApiKey.value)
  showSettings.value = false
  operationMessage.value = '密钥保存成功，可以开始上传文档'
  setTimeout(() => { operationMessage.value = '' }, 3000)
}

// 清除本地保存的分析密钥，并同步界面状态。
const clearApiKey = () => {
  userApiKey.value = ''
  apiKey.value = ''
  localStorage.removeItem('genealogy_api_key')
  operationMessage.value = '密钥已清除'
  setTimeout(() => { operationMessage.value = '' }, 3000)
}

// 关闭设置弹窗，并恢复输入框中的当前密钥值。
const closeSettings = () => {
  showSettings.value = false
  userApiKey.value = apiKey.value
}

// 打开隐藏的文件选择框，触发文档上传流程。
const triggerFileUpload = () => {
  fileInput.value?.click()
}

// 处理文件选择框上传的单个文档。
const handleFileUpload = async (event) => {
  const file = event.target.files?.[0]
  if (file) {
    await analyzeDocument(file)
  }
  event.target.value = ''
}

// 处理拖拽到上传区域的单个文档。
const handleDrop = async (event) => {
  event.preventDefault()
  const file = event.dataTransfer.files?.[0]
  if (file) {
    await analyzeDocument(file)
  }
}

// 根据文档类型选择前端读取或后端解析，并把结果交给族谱绘制逻辑。
const analyzeDocument = async (file) => {
  isLoading.value = true
  hasError.value = false
  showUpload.value = false
  loadingMessage.value = '正在读取文档...'

  try {
    let content = ''

    if (file.name.toLowerCase().endsWith('.txt')) {
      const reader = new FileReader()
      content = await new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result)
        reader.readAsText(file)
      })
    } else {
      const formData = new FormData()
      formData.append('file', file)

      loadingMessage.value = '正在解析文档...'
      const headers = {}
      if (apiKey.value) headers['X-API-Key'] = apiKey.value

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers,
        body: formData
      })

      if (!response.ok) throw new Error('文档上传失败，请检查文件格式是否正确')

      const result = await response.json()
      if (!result.success) throw new Error(result.error?.message || '无法从文档中提取族谱信息')

      buildGenealogyData(result.data.members, result.data.relationships)
      return
    }

    loadingMessage.value = '正在识别家族成员和关系...'
    const headers = { 'Content-Type': 'application/json' }
    if (apiKey.value) headers['X-API-Key'] = apiKey.value

    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, filename: file.name })
    })

    if (!response.ok) throw new Error('AI 分析服务暂时不可用，请稍后重试')

    const result = await response.json()
    if (!result.success) throw new Error(result.error?.message || '未能从文档内容中识别出族谱信息，请检查文档是否包含家族成员和关系描述')

    buildGenealogyData(result.data.members, result.data.relationships)
  } catch (error) {
    console.error('分析失败:', error)
    hasError.value = true
    statusText.value = error.message
    showUpload.value = true
  } finally {
    isLoading.value = false
  }
}

// 把 AI 返回的成员和关系数据转换成画布节点与连线。
const buildGenealogyData = (members, relationships) => {
  const nodeMap = new Map()

  nodes.value = members.map((member, index) => {
    const id = member.id || `node_${index}`
    const node = {
      id,
      name: member.name,
      gender: member.gender === 'female' ? 'female' : 'male',
      generation: member.generation || 1,
      x: 0,
      y: 0
    }
    nodeMap.set(member.name, node)
    return node
  })

  links.value = relationships
    .map((rel, index) => {
      const sourceNode = nodeMap.get(rel.person1)
      const targetNode = nodeMap.get(rel.person2)
      if (!sourceNode || !targetNode) return null

      return {
        id: `link_${index}`,
        source: sourceNode,
        target: targetNode,
        relation: rel.relation
      }
    })
    .filter(link => link !== null)

  applyTreeLayout()
  pushHistory()
  statusText.value = '分析完成，可双击节点编辑'
}

// 按代际对成员进行基础树状排布，生成初始坐标。
const applyTreeLayout = () => {
  const generations = new Map()

  nodes.value.forEach(node => {
    const gen = node.generation || 1
    if (!generations.has(gen)) generations.set(gen, [])
    generations.get(gen).push(node)
  })

  const levelHeight = 160
  const nodeSpacing = 170

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

// 根据父子节点坐标生成平滑的谱系连接线。
const getLinkPath = (link) => {
  const source = link.source
  const target = link.target

  const sx = source.x
  const sy = source.y + 38
  const tx = target.x
  const ty = target.y - 38
  const my = (sy + ty) / 2

  return `M ${sx} ${sy} C ${sx} ${my}, ${tx} ${my}, ${tx} ${ty}`
}

// 根据配偶节点坐标生成水平虚线连接。
const getSpouseLinkPath = (link) => {
  const sx = link.source.x + 38
  const sy = link.source.y
  const tx = link.target.x - 38
  const ty = link.target.y
  const mx = (sx + tx) / 2
  const my = Math.min(sy, ty) - 18
  return `M ${sx} ${sy} Q ${mx} ${my}, ${tx} ${ty}`
}

// 关系称谓映射表
const RELATION_LABELS = {
  'father-son': '父子',
  'mother-son': '母子',
  'father-daughter': '父女',
  'mother-daughter': '母女',
  'husband-wife': '夫妻'
}

// 根据代际差和路径形状计算双向关系称谓（A称B + B称A）。
const getKinshipLabel = (genA, genB, nodeA, nodeB, directRelation, pathLen) => {
  if (directRelation === 'husband-wife') {
    return { aToB: nodeA.gender === 'female' ? '妻子' : '丈夫', bToA: nodeB.gender === 'female' ? '妻子' : '丈夫' }
  }

  const genDiff = genA - genB
  const genderA = nodeA.gender === 'female'
  const genderB = nodeB.gender === 'female'
  const absDiff = Math.abs(genDiff)
  const aIsElder = genDiff > 0
  const isDirect = pathLen === absDiff

  // 直系上下代
  if (isDirect) {
    if (absDiff === 1) {
      return aIsElder
        ? { aToB: genderB ? '女儿' : '儿子', bToA: genderA ? '母亲' : '父亲' }
        : { aToB: genderB ? '母亲' : '父亲', bToA: genderA ? '女儿' : '儿子' }
    }
    if (absDiff === 2) {
      return aIsElder
        ? { aToB: genderB ? '孙女' : '孙子', bToA: genderA ? '祖母' : '祖父' }
        : { aToB: genderB ? '祖母' : '祖父', bToA: genderA ? '孙女' : '孙子' }
    }
    if (absDiff === 3) {
      return aIsElder
        ? { aToB: genderB ? '曾孙女' : '曾孙', bToA: genderA ? '曾祖母' : '曾祖父' }
        : { aToB: genderB ? '曾祖母' : '曾祖父', bToA: genderA ? '曾孙女' : '曾孙' }
    }
    return aIsElder
      ? { aToB: '后裔', bToA: '先祖' }
      : { aToB: '先祖', bToA: '后裔' }
  }

  // 旁系关系：计算A和B分别距共同祖先的代数
  const stepsUpFromA = (pathLen + genDiff) / 2
  const stepsUpFromB = (pathLen - genDiff) / 2

  // 同代旁系
  if (genDiff === 0) {
    if (stepsUpFromA === 1) return { aToB: genderB ? '姐妹' : '兄弟', bToA: genderA ? '姐妹' : '兄弟' }
    if (stepsUpFromA === 2) return { aToB: genderB ? '堂姐妹' : '堂兄弟', bToA: genderA ? '堂姐妹' : '堂兄弟' }
    return { aToB: '同族同辈', bToA: '同族同辈' }
  }

  // A是长辈（旁系）
  if (aIsElder) {
    if (stepsUpFromB === 1) return { aToB: genderB ? '侄女' : '侄子', bToA: genderA ? '姑母' : '叔伯' }
    if (stepsUpFromB === 2) return { aToB: genderB ? '侄孙女' : '侄孙', bToA: genderA ? '姑祖母' : '叔祖父' }
    return { aToB: '旁系晚辈', bToA: '旁系长辈' }
  }

  // A是晚辈（旁系）
  if (stepsUpFromA === 1) return { aToB: genderB ? '姑母' : '叔伯', bToA: genderA ? '侄女' : '侄子' }
  if (stepsUpFromA === 2) return { aToB: genderB ? '姑祖母' : '叔祖父', bToA: genderA ? '侄孙女' : '侄孙' }
  return { aToB: '旁系长辈', bToA: '旁系晚辈' }
}

// 用 BFS 查找两个节点之间的最短路径。
const findPath = (startId, endId) => {
  const adjacency = new Map()
  links.value.forEach(link => {
    if (!adjacency.has(link.source.id)) adjacency.set(link.source.id, [])
    if (!adjacency.has(link.target.id)) adjacency.set(link.target.id, [])
    adjacency.get(link.source.id).push({ neighbor: link.target.id, linkId: link.id })
    adjacency.get(link.target.id).push({ neighbor: link.source.id, linkId: link.id })
  })

  const visited = new Set([startId])
  const queue = [{ nodeId: startId, nodeIds: [startId], linkIds: [] }]

  while (queue.length > 0) {
    const { nodeId, nodeIds, linkIds } = queue.shift()
    const neighbors = adjacency.get(nodeId) || []

    for (const { neighbor, linkId } of neighbors) {
      if (neighbor === endId) {
        return { nodeIds: [...nodeIds, endId], linkIds: [...linkIds, linkId] }
      }
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push({ nodeId: neighbor, nodeIds: [...nodeIds, neighbor], linkIds: [...linkIds, linkId] })
      }
    }
  }
  return null
}

// 执行关系查询：计算两人之间的关系并高亮路径。
const queryRelationship = () => {
  highlightedNodes.value = []
  highlightedLinks.value = []
  queryResult.value = null

  const nodeA = nodes.value.find(n => n.id === queryPersonA.value)
  const nodeB = nodes.value.find(n => n.id === queryPersonB.value)
  if (!nodeA || !nodeB) {
    queryResult.value = { found: false, relation: '无法查询', description: '请先选择两个人物' }
    return
  }

  const result = findPath(nodeA.id, nodeB.id)
  if (!result) {
    queryResult.value = {
      found: false,
      relation: '无关联',
      description: `${nodeA.name} 和 ${nodeB.name} 之间没有找到关系路径`
    }
    return
  }

  // 查找直接关系类型
  const directLink = links.value.find(l => result.linkIds.includes(l.id) &&
    ((l.source.id === nodeA.id && l.target.id === nodeB.id) ||
     (l.source.id === nodeB.id && l.target.id === nodeA.id)))
  const directRelation = directLink ? directLink.relation : null

  const genDiff = (nodeA.generation || 1) - (nodeB.generation || 1)
  const pathLen = result.nodeIds.length - 1
  const label = getKinshipLabel(nodeA.generation || 1, nodeB.generation || 1, nodeA, nodeB, directRelation, pathLen)

  // 构建描述
  const intermediateCount = result.nodeIds.length - 2
  let desc = `${nodeA.name} → ${nodeB.name}`
  if (intermediateCount > 0) {
    const intermediates = result.nodeIds.slice(1, -1).map(id => {
      const n = nodes.value.find(nd => nd.id === id)
      return n ? n.name : '?'
    })
    desc = `${nodeA.name} → ${intermediates.join(' → ')} → ${nodeB.name}`
  }
  desc += `（${Math.abs(genDiff)} 代差）`

  // 高亮路径上的节点和连线
  highlightedNodes.value = [...result.nodeIds]
  highlightedLinks.value = [...result.linkIds]

  queryResult.value = { found: true, relation: label, description: desc, nameA: nodeA.name, nameB: nodeB.name }
}

// 开始拖拽画布，用于移动整个族谱视图。
const startCanvasDrag = (e) => {
  if (isNodeDragging) return
  isDragging = true
  startX = e.clientX - panX.value
  startY = e.clientY - panY.value
  document.addEventListener('mousemove', onCanvasDrag)
  document.addEventListener('mouseup', stopCanvasDrag)
}

// 根据鼠标移动距离更新画布平移位置。
const onCanvasDrag = (e) => {
  if (!isDragging) return
  panX.value = e.clientX - startX
  panY.value = e.clientY - startY
  updateTransform()
}

// 结束画布拖拽并移除临时事件监听。
const stopCanvasDrag = () => {
  isDragging = false
  document.removeEventListener('mousemove', onCanvasDrag)
  document.removeEventListener('mouseup', stopCanvasDrag)
}

// 开始拖拽单个成员节点，用于手动微调谱图。
const startNodeDrag = (node, e) => {
  if (e.button !== 0) return
  isNodeDragging = true
  dragNode = node
  nodeStartX = e.clientX - node.x
  nodeStartY = e.clientY - node.y
  document.addEventListener('mousemove', onNodeDrag)
  document.addEventListener('mouseup', stopNodeDrag)
}

// 根据鼠标移动实时更新当前节点坐标。
const onNodeDrag = (e) => {
  if (!isNodeDragging || !dragNode) return
  dragNode.x = e.clientX - nodeStartX
  dragNode.y = e.clientY - nodeStartY
}

// 结束节点拖拽并清理拖拽状态。
const stopNodeDrag = () => {
  if (isNodeDragging && dragNode) {
    pushHistory()
  }
  isNodeDragging = false
  dragNode = null
  document.removeEventListener('mousemove', onNodeDrag)
  document.removeEventListener('mouseup', stopNodeDrag)
}

// 根据缩放和平移状态更新 SVG 族谱组的 transform。
const updateTransform = () => {
  if (svgGroup.value && svgCanvas.value) {
    const rect = svgCanvas.value.getBoundingClientRect()
    const cx = rect.width / 2 + panX.value
    const cy = 86 + panY.value
    svgGroup.value.setAttribute('transform', `translate(${cx}, ${cy}) scale(${zoom.value})`)
  }
}

// 放大族谱视图。
const zoomIn = () => {
  zoom.value = Math.min(zoom.value + 0.1, 3)
  updateTransform()
}

// 缩小族谱视图。
const zoomOut = () => {
  zoom.value = Math.max(zoom.value - 0.1, 0.3)
  updateTransform()
}

// 重置族谱视图的缩放和平移位置。
const resetZoom = () => {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
  updateTransform()
}

// 打开成员编辑弹窗，并复制当前节点数据。
const editNode = (node) => {
  editingNode.value = { ...node }
  showNodeEdit.value = true
}

// 关闭成员编辑弹窗并清空临时编辑对象。
const closeNodeEdit = () => {
  showNodeEdit.value = false
  editingNode.value = {}
}

// 保存成员编辑结果并同步到节点列表。
const saveNodeEdit = () => {
  pushHistory()
  const index = nodes.value.findIndex(n => n.id === editingNode.value.id)
  if (index !== -1) {
    nodes.value[index] = { ...editingNode.value }
  }
  closeNodeEdit()
}

// 删除成员节点，并移除与该成员相关的连线。
const deleteNode = (node) => {
  confirmDialog.value = {
    title: '确认删除',
    message: `确定要删除成员「${node.name}」吗？相关连线也会一并移除。`,
    confirmText: '删除',
    danger: true,
    onConfirm: () => {
      pushHistory()
      nodes.value = nodes.value.filter(n => n.id !== node.id)
      links.value = links.value.filter(l => l.source.id !== node.id && l.target.id !== node.id)
      closeNodeEdit()
      confirmDialog.value = null
    }
  }
}

// 将当前族谱画布导出为 PNG 图片。
const exportImage = async () => {
  if (!canvasContainer.value) return

  try {
    const canvas = await html2canvas(canvasContainer.value, {
      backgroundColor: '#f5f0ec',
      scale: 2,
      useCORS: true
    })

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

// 清空当前族谱数据并回到上传初始状态。
const clearAll = () => {
  confirmDialog.value = {
    title: '确认清空',
    message: '确定要清空当前族谱数据吗？此操作不可撤销。',
    confirmText: '清空全部',
    danger: true,
    onConfirm: () => {
      nodes.value = []
      links.value = []
      showUpload.value = true
      statusText.value = '等待上传文档'
      zoom.value = 1
      panX.value = 0
      panY.value = 0
      history.value = []
      historyIndex.value = -1
      queryPersonA.value = ''
      queryPersonB.value = ''
      queryResult.value = null
      highlightedNodes.value = []
      highlightedLinks.value = []
      confirmDialog.value = null
    }
  }
}

// 键盘快捷键处理。
const handleKeyboard = (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    undo()
  } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
    e.preventDefault()
    redo()
  } else if (e.key === '+' || e.key === '=') {
    zoomIn()
  } else if (e.key === '-') {
    zoomOut()
  } else if (e.key === '0') {
    resetZoom()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyboard)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyboard)
})

watch(() => canvasContainer.value, () => {
  if (canvasContainer.value) {
    setTimeout(updateTransform, 100)
  }
})
</script>

<style>
:root {
  --ink: #241a15;
  --muted-ink: #5a4d44;
  --paper: #f5f0ec;
  --paper-deep: #e8dfda;
  --panel: #faf6f3;
  --line: #d2c4bb;
  --seal: #9b2f22;
  --seal-dark: #6f1f17;
  --green: #47624b;
  --shadow: 0 2px 10px rgba(61, 39, 21, 0.08);
  --radius: 8px;
  --ui-font: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Microsoft YaHei", sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: #2c2019;
  color: var(--ink);
  font-family: var(--ui-font);
  overflow: hidden;
}

button,
input,
select {
  font: inherit;
}

.app-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, #2e211a 0%, #3d2c22 50%, #261c16 100%);
}

.topbar {
  height: 78px;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(232, 203, 160, 0.36);
  background: rgba(38, 27, 21, 0.88);
  color: #f7ead2;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-seal {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border: 2px solid rgba(250, 218, 171, 0.7);
  background: var(--seal);
  color: #fff4db;
  font-family: "Noto Serif SC", "Songti SC", serif;
  font-size: 26px;
  font-weight: 800;
}

.brand-kicker,
.section-label,
.upload-kicker {
  color: var(--seal);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
}

.brand-kicker {
  color: #d5aa79;
  margin-bottom: 2px;
}

.brand h1 {
  font-family: "Noto Serif SC", "Songti SC", serif;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0;
}

.topbar-actions,
.upload-actions,
.form-buttons {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn {
  height: 38px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.btn-primary {
  background: var(--seal);
  color: #fff8ed;
  border-color: rgba(255, 238, 210, 0.14);
}

.btn-primary:hover:not(:disabled) {
  background: var(--seal-dark);
}

.btn-plain {
  background: rgba(255, 246, 228, 0.1);
  color: inherit;
  border-color: rgba(235, 209, 170, 0.32);
}

.btn-plain:hover:not(:disabled) {
  background: rgba(255, 246, 228, 0.2);
}

.btn-plain.danger {
  color: #e8a090;
}

.btn-icon {
  width: 38px;
  padding: 0;
  display: grid;
  place-items: center;
  background: rgba(255, 246, 228, 0.1);
  border-color: rgba(235, 209, 170, 0.32);
  font-size: 18px;
  font-weight: 400;
}

.btn-icon:hover:not(:disabled) {
  background: rgba(255, 246, 228, 0.2);
}

.btn-danger {
  background: #c0392b;
  color: #fff;
  border-color: transparent;
}

.btn-danger:hover:not(:disabled) {
  background: #a93226;
}

.toolbar-sep {
  width: 1px;
  height: 24px;
  background: rgba(235, 209, 170, 0.24);
}

.btn.large {
  height: 46px;
  padding: 0 22px;
}

.upload-input {
  display: none;
}

.workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 286px minmax(0, 1fr);
  gap: 18px;
  padding: 18px;
}

.side-panel,
.main-stage {
  border: 1px solid rgba(224, 190, 143, 0.42);
  border-radius: var(--radius);
  background: var(--panel);
}

.side-panel {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow: auto;
}

.panel-section {
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel);
}

.section-label {
  margin-bottom: 10px;
}

.status-line {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  color: var(--ink);
  font-size: 14px;
  line-height: 1.6;
}

.status-dot {
  width: 9px;
  height: 9px;
  margin-top: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--green);
}

.status-dot.error {
  background: var(--seal);
}

.status-dot.pending {
  background: #c4862f;
}

.status-dot.loading {
  background: #c4862f;
  animation: pulse 1s infinite;
}

.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.metric-card {
  min-height: 92px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel);
}

.metric-value {
  font-size: 32px;
  font-weight: 900;
  color: var(--seal);
}

.metric-label,
.form-hint,
.hint-list {
  color: var(--muted-ink);
  font-size: 14px;
}

.api-state {
  padding: 10px 12px;
  border: 1px solid rgba(155, 47, 34, 0.26);
  border-radius: var(--radius);
  color: var(--seal);
  background: rgba(155, 47, 34, 0.08);
  font-size: 14px;
}

.api-state.ready {
  color: var(--green);
  border-color: rgba(71, 98, 75, 0.3);
  background: rgba(71, 98, 75, 0.1);
}

.panel-link {
  margin-top: 10px;
  border: none;
  background: transparent;
  color: var(--seal);
  cursor: pointer;
  font-weight: 800;
}

.hint-list {
  padding-left: 18px;
  line-height: 1.8;
}

/* 关系查询面板 */
.query-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.query-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.query-label {
  display: block;
  margin-bottom: 4px;
  color: var(--ink);
  font-size: 13px;
  font-weight: 700;
}

.query-btn {
  width: 100%;
  margin-top: 2px;
}

.query-result {
  margin-top: 4px;
  padding: 12px;
  border: 1px solid rgba(71, 98, 75, 0.3);
  border-radius: var(--radius);
  background: rgba(71, 98, 75, 0.08);
}

.query-result.no-path {
  border-color: rgba(155, 47, 34, 0.26);
  background: rgba(155, 47, 34, 0.06);
  text-align: center;
}

.query-pair {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  font-size: 14px;
  line-height: 1.4;
}

.query-pair + .query-pair {
  border-top: 1px solid rgba(71, 98, 75, 0.15);
}

.query-person {
  font-weight: 700;
  color: var(--ink);
}

.query-arrow,
.query-sep {
  color: var(--muted-ink);
  font-size: 12px;
}

.query-role {
  font-family: "Noto Serif SC", "Songti SC", serif;
  font-weight: 900;
  color: var(--seal);
  font-size: 15px;
}

.query-relation {
  font-family: "Noto Serif SC", "Songti SC", serif;
  font-size: 18px;
  font-weight: 900;
  color: var(--seal);
  margin-bottom: 4px;
}

.query-result.no-path .query-relation {
  font-size: 16px;
  color: var(--muted-ink);
}

.query-desc {
  color: var(--muted-ink);
  font-size: 12px;
  line-height: 1.5;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed rgba(71, 98, 75, 0.15);
  word-break: break-all;
}

.main-stage {
  position: relative;
  min-width: 0;
  overflow: hidden;
}

.upload-section {
  position: absolute;
  inset: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  border: 2px dashed rgba(122, 39, 27, 0.28);
  border-radius: var(--radius);
  background: var(--paper);
}

.upload-mark {
  width: 84px;
  height: 84px;
  margin-bottom: 22px;
  display: grid;
  place-items: center;
  border: 2px solid rgba(155, 47, 34, 0.42);
  color: var(--seal);
  font-size: 42px;
  font-weight: 900;
}

.upload-kicker {
  margin-bottom: 10px;
}

.upload-section h2 {
  max-width: 720px;
  font-family: "Noto Serif SC", "Songti SC", serif;
  font-size: 38px;
  line-height: 1.22;
}

.upload-subtitle {
  max-width: 680px;
  margin: 16px 0 26px;
  color: var(--muted-ink);
  font-size: 16px;
  line-height: 1.8;
}

.format-row {
  margin-top: 22px;
  display: flex;
  gap: 10px;
}

.format-row span {
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted-ink);
  background: var(--panel);
  font-size: 12px;
  font-weight: 800;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  background: rgba(38, 27, 21, 0.22);
  backdrop-filter: blur(4px);
}

.loading-card {
  width: min(420px, 88%);
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 18px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel);
}

.loading-spinner {
  width: 46px;
  height: 46px;
  border: 4px solid rgba(155, 47, 34, 0.16);
  border-top-color: var(--seal);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-title {
  margin-bottom: 4px;
  font-size: 18px;
  font-weight: 900;
}

.loading-text {
  color: var(--muted-ink);
  font-size: 14px;
}

.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--paper);
}

.zodiac-watermark {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  font-family: "Noto Serif SC", "Songti SC", "KaiTi", serif;
  font-size: 30px;
  color: rgba(122, 39, 27, 0.06);
  word-spacing: 52px;
  letter-spacing: 52px;
  line-height: 88px;
  padding: 30px;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-all;
  user-select: none;
}

.scroll-title {
  position: absolute;
  top: 22px;
  left: 50%;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--seal);
  transform: translateX(-50%);
}

.scroll-title span {
  width: 80px;
  height: 1px;
  background: var(--line);
}

.scroll-title strong {
  font-family: "Noto Serif SC", "Songti SC", serif;
  font-size: 18px;
  letter-spacing: 0;
}

.genealogy-canvas {
  position: relative;
  z-index: 0;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.genealogy-canvas:active {
  cursor: grabbing;
}

.genealogy-canvas .node {
  cursor: pointer;
}

.genealogy-canvas .node circle {
  fill: #7d3a2c;
  stroke: #f6dfbd;
  stroke-width: 4;
  transition: filter 0.18s ease, transform 0.18s ease;
}

.genealogy-canvas .node circle.female {
  fill: #8b4d63;
}

.genealogy-canvas .node:hover circle {
  filter: brightness(1.12);
}

.genealogy-canvas .node-text,
.generation-text {
  fill: #fff8ea;
  text-anchor: middle;
  pointer-events: none;
}

.genealogy-canvas .node-text {
  font-size: 15px;
  font-weight: 900;
}

.generation-text {
  opacity: 0.82;
  font-size: 11px;
  font-weight: 700;
}

.genealogy-canvas .link {
  fill: none;
  stroke: #7a271b;
  stroke-width: 2.3;
  marker-end: url(#arrowhead);
  transition: stroke-width 0.2s ease, stroke 0.2s ease;
}

.genealogy-canvas .link.spouse {
  stroke: #8b5a3c;
  stroke-width: 1.8;
  stroke-dasharray: 6 4;
  marker-end: none;
}

.genealogy-canvas .link.highlight {
  stroke: var(--seal);
  stroke-width: 4;
  filter: drop-shadow(0 0 4px rgba(155, 47, 34, 0.4));
}

.genealogy-canvas .link.spouse.highlight {
  stroke-width: 3.2;
  stroke-dasharray: none;
}

.genealogy-canvas .node circle.highlight {
  stroke: var(--seal);
  stroke-width: 5;
  filter: drop-shadow(0 0 8px rgba(155, 47, 34, 0.5));
}

.zoom-controls {
  position: absolute;
  right: 22px;
  bottom: 22px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: rgba(250, 246, 243, 0.92);
  backdrop-filter: blur(8px);
}

.zoom-controls button {
  min-width: 34px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--ink);
  cursor: pointer;
  font-weight: 900;
}

.zoom-controls button:hover {
  color: #fff8ea;
  background: var(--seal);
}

.zoom-controls span {
  min-width: 52px;
  text-align: center;
  color: var(--muted-ink);
  font-size: 14px;
  font-weight: 800;
}

.modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  background: rgba(28, 19, 14, 0.58);
}

.modal-content {
  width: min(540px, 92vw);
  padding: 26px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel);
}

.modal-content.compact {
  width: min(430px, 92vw);
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted-ink);
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
  transition: background 0.15s ease, color 0.15s ease;
}

.modal-close:hover {
  background: rgba(155, 47, 34, 0.08);
  color: var(--seal);
}

.modal-header h3 {
  font-family: "Noto Serif SC", "Songti SC", serif;
  font-size: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.form-label {
  color: var(--ink);
  font-weight: 800;
}

.form-input,
.form-select {
  height: 42px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  outline: none;
  background: var(--panel);
  color: var(--ink);
}

.form-input:focus,
.form-select:focus {
  border-color: var(--seal);
  box-shadow: 0 0 0 3px rgba(155, 47, 34, 0.12);
}

.settings-info {
  margin: 12px 0 18px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--paper);
}

.settings-info h4 {
  margin-bottom: 8px;
  color: var(--seal);
}

.settings-info ol {
  padding-left: 20px;
  color: var(--muted-ink);
  line-height: 1.8;
  font-size: 14px;
}

.form-buttons {
  justify-content: flex-end;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.48;
  }
}

.confirm-message {
  margin-bottom: 20px;
  color: var(--ink);
  font-size: 15px;
  line-height: 1.6;
}

/* Focus styles for accessibility */
.btn:focus-visible,
.form-input:focus-visible,
.form-select:focus-visible,
.panel-link:focus-visible,
.zoom-controls button:focus-visible {
  outline: 2px solid var(--seal);
  outline-offset: 2px;
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

@media (max-width: 1080px) {
  body {
    overflow: auto;
  }

  .app-shell {
    min-height: 100vh;
    height: auto;
  }

  .topbar {
    height: auto;
    min-height: 78px;
    padding: 16px;
    align-items: flex-start;
    flex-direction: column;
  }

  .topbar-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .workspace {
    grid-template-columns: 1fr;
  }

  .side-panel {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .main-stage {
    min-height: 620px;
  }
}

@media (max-width: 720px) {
  .brand h1 {
    font-size: 21px;
  }

  .side-panel {
    display: flex;
  }

  .upload-section {
    inset: 16px;
    padding: 28px 18px;
  }

  .upload-section h2 {
    font-size: 28px;
  }

  .upload-actions {
    flex-direction: column;
    width: 100%;
  }

  .upload-actions .btn {
    width: 100%;
  }

  .scroll-title span {
    width: 36px;
  }
}
</style>
