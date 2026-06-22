<template>
  <div class="app-shell">
    <TopBar
      :is-loading="core.isLoading.value" :has-data="core.hasData.value"
      :provider-badge="sess.providerBadge.value" :can-undo="hist.canUndo.value"
      :can-redo="hist.canRedo.value" :theme="core.theme.value"
      @trigger-file-upload="analysis.triggerFileUpload" @open-search="openSearch"
      @export-image="exp.exportImage" @export-gedcom="exp.exportGedcom"
      @toggle-theme="core.toggleTheme" @show-help="showHelp"
      @clear-all="sess.clearAll" @show-settings="core.showSettings.value = true"
      @undo="hist.undo" @redo="hist.redo"
    />

    <!-- Hidden file inputs (triggered by TopBar events) -->
    <input ref="fileInput" type="file" class="upload-input" accept=".txt,.pdf,.doc,.docx" @change="analysis.handleFileUpload" />
    <input ref="gedcomInput" type="file" class="upload-input" accept=".ged" @change="analysis.handleGedcomUpload" />

    <main class="workspace">
      <SidePanel
        :sessions="sess.sessions.value" :current-session-id="sess.currentSessionId.value"
        :editing-session-id="sess.editingSessionId.value" :session-name-input="sess.sessionNameInput.value"
        :is-saving="sess.isSaving.value" :last-saved-at="sess.lastSavedAt.value"
        :auto-save-enabled="sess.autoSaveEnabled.value" :is-loading="core.isLoading.value"
        :has-data="core.hasData.value" :has-error="core.hasError.value"
        :nodes="core.nodes.value" :links="core.links.value"
        :api-key="sess.apiKey.value" :display-status="sess.displayStatus.value"
        :generation-stats="stats.generationStats.value" :total-members="stats.totalMembers.value"
        :max-gen="stats.maxGen.value" :generation-bar-width="stats.generationBarWidth.value"
        :gender-stats="stats.genderStats.value" :circumference="stats.circumference.value"
        :male-dash="stats.maleDash.value" :line-filter="core.lineFilter.value"
        :focused-node-id="core.focusedNodeId.value" :focus-node-name="core.focusNodeName.value"
        :query-person-a="query.queryPersonA.value" :query-person-b="query.queryPersonB.value"
        :query-result="query.queryResult.value" :format-time="sess.formatTime"
        @create-new-session="sess.createNewSession" @fetch-sessions="sess.fetchSessions"
        @load-session="sess.loadSession" @save-current-session-to="sess.saveCurrentSessionTo"
        @delete-session="sess.deleteSession" @start-rename-session="sess.startRenameSession"
        @commit-rename-session="sess.commitRenameSession" @cancel-rename-session="sess.cancelRenameSession"
        @toggle-auto-save="(v) => { sess.autoSaveEnabled.value = v }"
        @show-settings="core.showSettings.value = true" @set-line-filter="core.setLineFilter"
        @query-relationship="query.queryRelationship"
        @update:query-person-a="(v) => { query.queryPersonA.value = v }"
        @update:query-person-b="(v) => { query.queryPersonB.value = v }"
        @update:session-name-input="(v) => { sess.sessionNameInput.value = v }"
      />

      <section class="main-stage" ref="mainContent">
        <!-- Upload section -->
        <div v-if="core.showUpload.value" class="upload-section" @dragover.prevent @drop="analysis.handleDrop">
          <div class="upload-mark"><span>宗</span></div>
          <p class="upload-kicker">上传文档，自动提取直系亲属关系</p>
          <h2>从文本、PDF 或 Word 生成可编辑族谱</h2>
          <p class="upload-subtitle">支持 TXT、PDF、DOC、DOCX。系统会识别成员、代际和父母子女关系，并生成可拖拽编辑的谱图。</p>
          <div class="upload-actions">
            <button class="btn btn-primary large" @click="analysis.triggerFileUpload">选择文档</button>
            <button class="btn btn-plain large" @click="analysis.triggerGedcomUpload">导入 .ged 文件</button>
            <button class="btn btn-plain large" @click="core.showSettings.value = true">配置分析密钥</button>
          </div>
          <div class="format-row"><span>TXT</span><span>PDF</span><span>DOC</span><span>DOCX</span><span>GED</span></div>
        </div>

        <!-- Loading overlay -->
        <div v-if="core.isLoading.value" class="loading-overlay">
          <div class="loading-card">
            <div class="loading-spinner"></div>
            <div>
              <p class="loading-title">正在整理谱系</p>
              <p class="loading-text">{{ core.loadingMessage.value }}</p>
            </div>
            <button class="btn btn-sm btn-plain loading-cancel" @click="analysis.cancelAnalysis">取消分析</button>
          </div>
        </div>

        <!-- Genealogy canvas -->
        <GenealogyCanvas v-if="core.hasData.value && !core.showUpload.value" ref="canvasRef"
          :nodes="core.nodes.value" :filtered-visible-nodes="core.filteredVisibleNodes.value"
          :filtered-visible-links="core.filteredVisibleLinks.value"
          :highlighted-nodes="core.highlightedNodes.value" :highlighted-links="core.highlightedLinks.value"
          :focused-node-id="core.focusedNodeId.value" :focused-branch-ids="core.focusedBranchIds.value"
          :focused-branch-link-ids="core.focusedBranchLinkIds.value"
          :pulsing-node-id="core.pulsingNodeId.value" :is-drag-over-canvas="core.isDragOverCanvas.value"
          :zoom="core.zoom.value" :has-data="core.hasData.value"
          :get-link-path="core.getLinkPath" :get-spouse-link-path="core.getSpouseLinkPath"
          :count-descendants="core.countDescendants" :minimap-props="minimapProps"
          @start-canvas-drag="canvas.startCanvasDrag" @canvas-click="core.onCanvasClick"
          @wheel-zoom="canvas.onWheelZoom" @start-node-drag="canvas.startNodeDrag"
          @focus-on-node="core.focusOnNode" @toggle-collapse="nodeOps.toggleCollapse"
          @open-context-menu="nodeOps.openContextMenu"
          @zoom-in="canvas.zoomIn" @zoom-out="canvas.zoomOut" @reset-zoom="canvas.resetZoom"
          @minimap-mouse-down="canvas.onMinimapMouseDown"
          @canvas-drag-over="analysis.onCanvasDragOver" @canvas-drag-leave="analysis.onCanvasDragLeave"
          @drop="analysis.handleDrop"
        />
      </section>
    </main>

    <!-- Settings modal -->
    <SettingsModal v-if="core.showSettings.value"
      :user-api-key="sess.userApiKey.value" :force-mode="sess.forceMode.value"
      @close="sess.closeSettings" @save-api-key="sess.saveApiKey"
      @clear-api-key="sess.clearApiKey" @set-force-mode="sess.setForceMode"
      @update:user-api-key="(v) => { sess.userApiKey.value = v }"
    />

    <!-- Node edit modal -->
    <NodeEditModal v-if="nodeOps.showNodeEdit.value" :editing-node="nodeOps.editingNode.value"
      @close="nodeOps.closeNodeEdit" @save="nodeOps.saveNodeEdit" @delete="nodeOps.deleteNode"
    />

    <!-- Confirm dialog -->
    <div v-if="core.confirmDialog.value" class="modal" role="alertdialog" aria-modal="true" aria-label="确认操作">
      <div class="modal-content compact">
        <div class="modal-header"><h3>{{ core.confirmDialog.value.title }}</h3></div>
        <p class="confirm-message">{{ core.confirmDialog.value.message }}</p>
        <div class="form-buttons">
          <button class="btn btn-plain" @click="core.confirmDialog.value = null">取消</button>
          <button :class="['btn', core.confirmDialog.value.danger ? 'btn-danger' : 'btn-primary']"
            @click="core.confirmDialog.value.onConfirm">{{ core.confirmDialog.value.confirmText }}</button>
        </div>
      </div>
    </div>

    <!-- Search modal -->
    <div v-if="core.showSearchModal.value" class="modal" @click.self="closeSearch" role="dialog" aria-modal="true" aria-label="搜索人物">
      <div class="modal-content search-modal">
        <div class="modal-header">
          <h3>搜索人物</h3>
          <button class="modal-close" @click="closeSearch" aria-label="关闭">×</button>
        </div>
        <input ref="searchInputRef" v-model="core.searchQuery.value" class="form-input search-input"
          placeholder="输入姓名（模糊匹配）" @keydown.esc="closeSearch"
          @keydown.enter="core.searchResults.value.length && selectSearchResult(core.searchResults.value[0])" />
        <div class="search-results" role="listbox">
          <div v-if="core.searchResults.value.length === 0" class="search-empty">无匹配结果</div>
          <button v-for="r in core.searchResults.value.slice(0, 50)" :key="r.id" class="search-item" @click="selectSearchResult(r)">
            <span class="search-item-name">{{ r.name }}</span>
            <span class="search-item-meta">{{ r.generation }}世 · {{ r.gender === 'female' ? '女' : '男' }}</span>
          </button>
          <div v-if="core.searchResults.value.length > 50" class="search-more">还有 {{ core.searchResults.value.length - 50 }} 个结果，请缩小关键词</div>
        </div>
      </div>
    </div>

    <!-- Help modal -->
    <div v-if="core.showHelpModal.value" class="modal" @click.self="closeHelp" role="dialog" aria-modal="true" aria-label="快捷键帮助">
      <div class="modal-content compact">
        <div class="modal-header">
          <h3>快捷键</h3>
          <button class="modal-close" @click="closeHelp" aria-label="关闭">×</button>
        </div>
        <ul class="help-list">
          <li><kbd>Ctrl</kbd> + <kbd>K</kbd> · 打开人物搜索</li>
          <li><kbd>F</kbd> · 打开人物搜索（同 Ctrl+K）</li>
          <li><kbd>+</kbd> / <kbd>-</kbd> · 放大 / 缩小</li>
          <li><kbd>0</kbd> · 重置视图（缩放 + 平移）</li>
          <li><kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd> · 撤销 / 重做</li>
          <li><kbd>Delete</kbd> · 删除选中的节点（聚焦后）</li>
          <li><kbd>Esc</kbd> · 关闭弹窗 / 取消焦点</li>
          <li><kbd>?</kbd> · 显示本帮助</li>
        </ul>
        <p class="help-tip">双击节点可折叠 / 展开其后代；右键节点可编辑、添加子女 / 配偶 / 父母、删除。</p>
      </div>
    </div>

    <!-- Context menu -->
    <ContextMenu v-if="nodeOps.contextMenu.value.show" :context-menu="nodeOps.contextMenu.value"
      @context-edit-node="nodeOps.contextEditNode" @context-add-child="nodeOps.contextAddChild"
      @context-add-spouse="nodeOps.contextAddSpouse" @context-add-parent="nodeOps.contextAddParent"
      @set-as-root-node="nodeOps.setAsRootNode" @context-delete-node="nodeOps.contextDeleteNode"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useGenealogyCore } from './composables/useGenealogyCore'
import { useHistory } from './composables/useHistory'
import { useSessionManagement } from './composables/useSessionManagement'
import { useDocumentAnalysis } from './composables/useDocumentAnalysis'
import { useCanvasInteraction } from './composables/useCanvasInteraction'
import { useRelationshipQuery } from './composables/useRelationshipQuery'
import { useExport } from './composables/useExport'
import { useNodeOperations } from './composables/useNodeOperations'
import { useStatistics } from './composables/useStatistics'
import TopBar from './components/TopBar.vue'
import SidePanel from './components/SidePanel.vue'
import GenealogyCanvas from './components/GenealogyCanvas.vue'
import SettingsModal from './components/SettingsModal.vue'
import NodeEditModal from './components/NodeEditModal.vue'
import ContextMenu from './components/ContextMenu.vue'

// 导入并初始化 composables（单例模式，顺序重要）
const core = useGenealogyCore()
const hist = useHistory()
const sess = useSessionManagement()
const analysis = useDocumentAnalysis()
const canvas = useCanvasInteraction()
const query = useRelationshipQuery()
const exp = useExport()
const nodeOps = useNodeOperations()
const stats = useStatistics()

// Template refs
const fileInput = ref(null)
const gedcomInput = ref(null)
const mainContent = ref(null)
const canvasRef = ref(null)
const searchInputRef = ref(null)

// Minimap props for GenealogyCanvas
const minimapProps = computed(() => ({
  nodes: core.nodes.value,
  minimapSize: canvas.minimapSize,
  minimapXOf: canvas.minimapXOf,
  minimapYOf: canvas.minimapYOf,
  minimapLinks: canvas.minimapLinks.value,
  viewportRect: canvas.viewportRect.value,
}))

// 搜索功能（需要 searchInputRef template ref，留在 App.vue）
const openSearch = () => {
  if (!core.hasData.value) return
  core.showSearchModal.value = true
  core.searchQuery.value = ''
  nextTick(() => { searchInputRef.value && searchInputRef.value.focus() })
}
const closeSearch = () => { core.showSearchModal.value = false }
const selectSearchResult = (node) => {
  if (!node) return
  core.focusedNodeId.value = node.id
  canvas.centerOnNode(node)
  core.pulsingNodeId.value = node.id
  setTimeout(() => { core.pulsingNodeId.value = null }, 1600)
  closeSearch()
}

// 帮助弹窗
const showHelp = () => { core.showHelpModal.value = true }
const closeHelp = () => { core.showHelpModal.value = false }

// 画布 template refs 同步到 composables
watch(canvasRef, (comp) => {
  if (comp) {
    canvas.setSvgCanvas(comp.svgCanvas)
    canvas.setSvgGroup(comp.svgGroup)
    canvas.setMinimapEl(comp.minimapEl?.$el?.querySelector('.minimap-svg')?.parentElement || comp.minimapEl)
    exp.setExportSvgCanvas(comp.svgCanvas)
  }
})

// 画布容器出现时刷新 transform
watch(() => canvasRef.value?.canvasContainer, (el) => {
  if (el) setTimeout(canvas.updateTransform, 100)
})

// 主题变化时同步到 <html>
watch(core.theme, () => core.applyTheme())

// 监听节点/关系变化，触发自动保存
watch([core.nodes, core.links], () => { sess.scheduleAutoSave() }, { deep: true })

// 监听自动保存开关
watch(sess.autoSaveEnabled, (val) => {
  localStorage.setItem('genealogy_autosave', String(val))
  if (val) sess.scheduleAutoSave()
})

// 键盘快捷键
const handleKeyboard = (e) => {
  const tag = (e.target && e.target.tagName) || ''
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
  if (e.isComposing) return
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (core.hasData.value) openSearch(); return }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) { e.preventDefault(); hist.undo(); return }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) { e.preventDefault(); hist.redo(); return }
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === 'f' || e.key === 'F') { if (core.hasData.value) openSearch(); return }
  if (e.key === '?' || (e.shiftKey && e.key === '/')) { e.preventDefault(); showHelp(); return }
  if (e.key === 'Escape') {
    if (core.showSearchModal.value) { closeSearch(); return }
    if (core.showHelpModal.value) { closeHelp(); return }
    if (core.showSettings.value) { sess.closeSettings(); return }
    if (nodeOps.showNodeEdit.value) { nodeOps.closeNodeEdit(); return }
    if (core.focusedNodeId.value) { core.focusedNodeId.value = null; return }
  }
  if (e.key === 'Delete' || e.key === 'Del') {
    if (core.focusedNodeId.value) {
      e.preventDefault()
      const n = core.nodes.value.find(x => x.id === core.focusedNodeId.value)
      if (n) nodeOps.deleteNode(n)
    }
    return
  }
  if (e.key === '+' || e.key === '=') { e.preventDefault(); canvas.zoomIn() }
  else if (e.key === '-' || e.key === '_') { e.preventDefault(); canvas.zoomOut() }
  else if (e.key === '0') { e.preventDefault(); canvas.resetZoom() }
}

// 右键菜单：点击外部关闭
const onDocMouseDownForCtx = (e) => {
  if (!nodeOps.contextMenu.value.show) return
  const menuEl = document.querySelector('.context-menu')
  if (menuEl && !menuEl.contains(e.target)) nodeOps.closeContextMenu()
}

onMounted(() => {
  core.applyTheme()
  document.addEventListener('keydown', handleKeyboard)
  document.addEventListener('mousedown', onDocMouseDownForCtx)
  sess.fetchSessions()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyboard)
  document.removeEventListener('mousedown', onDocMouseDownForCtx)
})
</script>

<style>
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

/* 会话管理面板 */
.session-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 220px;
  overflow-y: auto;
  margin-bottom: 10px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: background 0.15s ease;
}

.session-item:hover {
  background: var(--soft, #f5efe2);
}

.session-item.active {
  background: rgba(155, 47, 34, 0.1);
  border-color: rgba(155, 47, 34, 0.2);
}

.session-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  cursor: pointer;
}

.session-disabled {
  pointer-events: none;
  opacity: 0.5;
}

.session-name-input {
  flex: 1;
  height: 30px;
  padding: 0 6px;
  font-size: 14px;
}

.session-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.auto-save-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
  font-size: 13px;
}

.autosave-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: var(--ink);
}

.save-status {
  color: var(--muted-ink);
  font-size: 12px;
}

.save-status.saving {
  color: #c4862f;
}

.save-status.saved {
  color: var(--green);
}

/* 族谱统计图表 */
.stat-sub {
  font-size: 12px;
  color: var(--muted-ink);
  margin: 8px 0 4px;
  font-weight: 600;
}

.stat-chart {
  width: 100%;
  height: 110px;
  display: block;
  background: rgba(122, 39, 27, 0.03);
  border: 1px solid var(--line);
  border-radius: 6px;
}

.stat-axis {
  stroke: var(--line);
  stroke-width: 0.5;
}

.stat-bar {
  fill: #b89c8a;
}

.stat-bar.peak {
  fill: var(--seal);
}

.stat-bar-label {
  font-size: 7px;
  fill: var(--muted-ink);
  text-anchor: middle;
  font-weight: 600;
}

.stat-bar-value {
  font-size: 7px;
  fill: var(--ink);
  text-anchor: middle;
  font-weight: 700;
}

.gender-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.gender-ring {
  width: 60px;
  height: 60px;
  flex-shrink: 0;
}

.gender-ring-bg {
  fill: none;
  stroke: var(--line);
  stroke-width: 8;
}

.gender-ring-male {
  fill: none;
  stroke: #6b6b6b;
  stroke-width: 8;
  stroke-linecap: butt;
  transition: stroke-dasharray 0.4s ease;
}

.gender-ring-text {
  font-size: 12px;
  fill: var(--ink);
  text-anchor: middle;
  font-weight: 800;
}

.gender-legend {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--ink);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
}

.legend-swatch.male {
  background: #6b6b6b;
}

.legend-swatch.female {
  background: #c97a8b;
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
  flex-wrap: wrap;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel);
}

.loading-cancel {
  margin-left: auto;
  flex-shrink: 0;
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

/* 节点卡片样式 */
.node-card {
  fill: var(--paper, #faf6f3);
  stroke: var(--line, #e0be8f);
  stroke-width: 1;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
  transition: filter 0.18s ease, stroke 0.18s ease;
}
.genealogy-canvas .node:hover .node-card {
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
  stroke: var(--seal, #7a271b);
  stroke-width: 1.5;
}
.node-accent.male { fill: #7d3a2c; }
.node-accent.female { fill: #8b4d63; }
.node-accent-fill.male { fill: #7d3a2c; }
.node-accent-fill.female { fill: #8b4d63; }
.node-avatar-bg.male { fill: #5a3a2a; }
.node-avatar-bg.female { fill: #6b3a4a; }
.node-avatar-ring {
  fill: none;
  stroke: var(--line, #e0be8f);
  stroke-width: 1.5;
}
.node-avatar-img {
  pointer-events: none;
}
.node-name {
  font-size: 14px;
  font-weight: 900;
  fill: var(--ink, #3d2c22);
  pointer-events: none;
}
.gen-badge {
  fill: rgba(122, 39, 27, 0.1);
}
.gen-badge-text {
  font-size: 9px;
  font-weight: 700;
  fill: var(--seal, #7a271b);
  text-anchor: middle;
  pointer-events: none;
}
.node-info {
  font-size: 10px;
  fill: var(--muted-ink, #8a7d6b);
  pointer-events: none;
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

.genealogy-canvas .node.focused .node-card {
  stroke: #f5a623;
  stroke-width: 2;
  filter: drop-shadow(0 0 6px rgba(245, 166, 35, 0.5));
}

/* 折叠/展开角标 */
.collapse-badge {
  cursor: pointer;
}
.collapse-badge circle {
  fill: #c4421f;
  stroke: #fff;
  stroke-width: 1.5;
  transition: fill 0.15s ease;
}
.collapse-badge:hover circle {
  fill: #9b2f22;
}
.collapse-badge text {
  fill: #fff;
  font-size: 12px;
  font-weight: 700;
  text-anchor: middle;
  pointer-events: none;
  user-select: none;
}
.collapse-badge.collapsed circle {
  fill: #5a6f8c;
}
.collapse-badge.collapsed:hover circle {
  fill: #42546d;
}

/* 焦点高亮：分支外的节点/边淡化 */
.genealogy-canvas .node.dimmed {
  opacity: 0.18;
  transition: opacity 0.18s ease;
}
.genealogy-canvas .link.dimmed {
  opacity: 0.08;
  transition: opacity 0.18s ease;
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

/* 图谱小地图 */
.minimap {
  position: absolute;
  right: 22px;
  top: 22px;
  width: 180px;
  height: 180px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: rgba(250, 246, 243, 0.92);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 14px rgba(122, 39, 27, 0.08);
  cursor: pointer;
  z-index: 5;
}

.minimap-svg {
  width: 100%;
  height: calc(100% - 18px);
  display: block;
}

.minimap circle.male {
  fill: #6b6b6b;
}

.minimap circle.female {
  fill: #c97a8b;
}

.minimap .minimap-link {
  stroke: #b89c8a;
  stroke-width: 0.4;
  fill: none;
}

.minimap .minimap-link.spouse {
  stroke: #c97a8b;
  stroke-dasharray: 1.5 1.5;
}

.minimap .minimap-viewport {
  fill: rgba(122, 39, 27, 0.12);
  stroke: var(--seal);
  stroke-width: 1.2;
  pointer-events: none;
}

.minimap-label {
  margin-top: 2px;
  font-size: 11px;
  text-align: center;
  color: var(--muted-ink);
  font-weight: 700;
  letter-spacing: 1px;
}

/* 画布拖拽文件提示遮罩 */
.canvas-dropzone {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  background: rgba(122, 39, 27, 0.08);
  backdrop-filter: blur(2px);
  border: 3px dashed var(--seal);
  border-radius: 8px;
  pointer-events: none;
  animation: dropzone-pulse 1.2s ease-in-out infinite alternate;
}

.canvas-dropzone-inner {
  text-align: center;
  background: rgba(250, 246, 243, 0.96);
  border: 1px solid var(--seal);
  border-radius: 10px;
  padding: 24px 32px;
  box-shadow: 0 8px 24px rgba(122, 39, 27, 0.18);
}

.canvas-dropzone-inner p {
  font-size: 18px;
  font-weight: 800;
  color: var(--ink);
  margin: 8px 0 4px;
}

.canvas-dropzone-inner small {
  color: var(--muted-ink);
  font-size: 12px;
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

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.48; }
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

/* 搜索弹窗 */
.search-modal {
  max-width: 520px;
  width: 90vw;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}
.search-input {
  margin-bottom: 12px;
  font-size: 16px;
}
.search-results {
  max-height: 50vh;
  overflow-y: auto;
  border-top: 1px solid var(--rule, #e8dccb);
  padding-top: 8px;
}
.search-empty {
  text-align: center;
  padding: 32px 0;
  color: var(--muted, #8a7d6b);
  font-size: 14px;
}
.search-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 15px;
  text-align: left;
  color: var(--ink);
  font-family: inherit;
}
.search-item:hover,
.search-item:focus-visible {
  background: var(--soft, #f5efe2);
  outline: none;
}
.search-item-name {
  font-weight: 600;
}
.search-item-meta {
  font-size: 13px;
  color: var(--muted, #8a7d6b);
}
.search-more {
  padding: 12px;
  text-align: center;
  font-size: 13px;
  color: var(--muted, #8a7d6b);
}

/* 视图筛选 chips */
.filter-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.chip {
  flex: 1 1 auto;
  min-width: 60px;
  padding: 6px 10px;
  font-size: 13px;
  font-family: inherit;
  background: var(--soft, #f5efe2);
  border: 1px solid var(--rule, #e8dccb);
  border-radius: 14px;
  color: var(--ink);
  cursor: pointer;
  transition: all 0.15s ease;
}
.chip:hover:not(:disabled) {
  background: #ede0c5;
}
.chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.chip.active {
  background: var(--seal, #7a271b);
  color: #fff;
  border-color: var(--seal, #7a271b);
}
.hint-mini {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--muted, #8a7d6b);
}

/* 帮助弹窗 */
.help-list {
  list-style: none;
  padding: 0;
  margin: 0 0 14px 0;
  font-size: 14px;
  line-height: 1.9;
  color: var(--ink);
}
.help-list li {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
kbd {
  display: inline-block;
  min-width: 24px;
  padding: 2px 8px;
  font-size: 12px;
  font-family: ui-monospace, monospace;
  text-align: center;
  background: var(--soft, #f5efe2);
  border: 1px solid var(--rule, #e8dccb);
  border-bottom-width: 2px;
  border-radius: 4px;
  color: var(--ink);
}
.help-tip {
  font-size: 13px;
  color: var(--muted, #8a7d6b);
  line-height: 1.6;
  border-top: 1px dashed var(--rule, #e8dccb);
  padding-top: 12px;
  margin: 0;
}

/* 节点闪烁动画（搜索后定位） */
@keyframes node-pulse {
  0%, 100% {
    transform: scale(1);
    filter: drop-shadow(0 0 0 rgba(245, 166, 35, 0));
  }
  50% {
    transform: scale(1.18);
    filter: drop-shadow(0 0 14px rgba(245, 166, 35, 0.95));
  }
}
.genealogy-canvas .node.pulse {
  animation: node-pulse 1.6s ease-in-out;
  transform-box: fill-box;
  transform-origin: center;
}


/* 暗色模式 */
[data-theme="dark"] {
  --ink: #ece5d4;
  --muted-ink: #9b9382;
  --paper: #1a1714;
  --paper-deep: #2a261f;
  --panel: #221d18;
  --line: #3d382d;
  --seal: #d97a4a;
  --seal-dark: #b85a30;
  --green: #6f8a72;
  --shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
  --soft: #2a261f;
  --rule: #3d382d;
  --muted: #9b9382;
  --paper-2: #221d18;
  --seal-2: #c4421f;
}
[data-theme="dark"] body,
[data-theme="dark"] .app-shell {
  background: var(--paper);
  color: var(--ink);
}
[data-theme="dark"] .genealogy-canvas {
  background: var(--paper-deep);
}
[data-theme="dark"] .modal-content,
[data-theme="dark"] .panel-section,
[data-theme="dark"] .topbar,
[data-theme="dark"] .query-panel,
[data-theme="dark"] .form-input,
[data-theme="dark"] .form-select,
[data-theme="dark"] .zoom-controls {
  background-color: var(--panel);
  color: var(--ink);
  border-color: var(--line);
}
[data-theme="dark"] .btn-plain {
  background: var(--paper-deep);
  color: var(--ink);
  border-color: var(--line);
}
[data-theme="dark"] .btn-plain:hover {
  background: #35302a;
}
[data-theme="dark"] .session-item:hover {
  background: #35302a;
}
[data-theme="dark"] .session-item.active {
  background: rgba(217, 122, 74, 0.18);
  border-color: rgba(217, 122, 74, 0.35);
}
[data-theme="dark"] .btn-icon-sm:hover:not(:disabled) {
  background: #35302a;
}
[data-theme="dark"] .save-status.saved {
  color: #8db88f;
}
[data-theme="dark"] .form-input,
[data-theme="dark"] .form-select {
  background: var(--paper);
  color: var(--ink);
}
[data-theme="dark"] .node-card {
  fill: var(--panel);
  stroke: var(--line);
}
[data-theme="dark"] .genealogy-canvas .node text {
  fill: var(--ink);
}
[data-theme="dark"] .gen-badge {
  fill: rgba(217, 122, 74, 0.15);
}
[data-theme="dark"] .node-avatar-ring {
  stroke: var(--line);
}
[data-theme="dark"] .genealogy-canvas .link {
  stroke: #6e6358;
}
[data-theme="dark"] .genealogy-canvas .link.spouse {
  stroke: #8a7d6b;
}
[data-theme="dark"] .zodiac-watermark {
  color: rgba(255, 255, 255, 0.05);
}
[data-theme="dark"] .upload-zone {
  background: var(--paper-deep);
  border-color: var(--line);
}
[data-theme="dark"] .minimap {
  background: rgba(26, 22, 18, 0.92);
  border-color: var(--line);
}
[data-theme="dark"] .minimap circle.male {
  fill: #b8b8b8;
}
[data-theme="dark"] .minimap circle.female {
  fill: #d49aa6;
}
[data-theme="dark"] .minimap .minimap-link {
  stroke: #6b5b4a;
}
[data-theme="dark"] .minimap .minimap-viewport {
  fill: rgba(212, 154, 166, 0.18);
  stroke: #d49aa6;
}
[data-theme="dark"] .canvas-dropzone {
  background: rgba(212, 154, 166, 0.1);
  border-color: #d49aa6;
}
[data-theme="dark"] .canvas-dropzone-inner {
  background: rgba(26, 22, 18, 0.96);
  border-color: #d49aa6;
}
[data-theme="dark"] .dropzone-icon {
  color: #d49aa6;
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  z-index: 1100;
  min-width: 160px;
  background: #fff;
  border: 1px solid var(--rule, #e8dccb);
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  font-size: 14px;
  color: var(--ink);
  user-select: none;
}
[data-theme="dark"] .context-menu {
  background: var(--paper-2);
}
.context-menu-header {
  padding: 6px 12px;
  font-size: 12px;
  color: var(--muted, #8a7d6b);
  border-bottom: 1px solid var(--rule, #e8dccb);
  margin-bottom: 4px;
}
.context-item {
  display: block;
  width: 100%;
  padding: 8px 14px;
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: 14px;
  text-align: left;
  color: var(--ink);
  cursor: pointer;
}
.context-item:hover {
  background: var(--soft, #f5efe2);
}
[data-theme="dark"] .context-item:hover {
  background: #35302a;
}
.context-item.danger {
  color: #b53636;
}
.context-divider {
  height: 1px;
  background: var(--rule, #e8dccb);
  margin: 4px 0;
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

/* 头像上传区域 */
.avatar-upload-section {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
  padding-bottom: 16px;
  border-bottom: 1px dashed var(--line);
}
.avatar-preview-wrapper {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid var(--line);
  flex-shrink: 0;
}
.avatar-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.avatar-preview-wrapper:hover .avatar-overlay {
  opacity: 1;
}
.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.avatar-error {
  color: #c4421f;
  font-size: 12px;
  margin: 0;
}
</style>
