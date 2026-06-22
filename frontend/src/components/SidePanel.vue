<template>
  <aside class="side-panel">
    <section class="panel-section">
      <p class="section-label">族谱会话</p>
      <div class="session-header">
        <button class="btn btn-sm" @click="$emit('createNewSession')" :disabled="isLoading">+ 新建</button>
        <button class="btn btn-sm btn-plain" @click="$emit('fetchSessions')" title="刷新列表">↻</button>
      </div>
      <div class="session-list" v-if="sessions.length">
        <div v-for="session in sessions" :key="session.id"
          :class="['session-item', { active: session.id === currentSessionId }]">
          <span v-if="editingSessionId !== session.id" class="session-name"
            :class="{ 'session-disabled': isLoading }"
            @click="!isLoading && $emit('loadSession', session.id)">{{ session.name }}</span>
          <input v-else v-model="sessionNameInputModel" class="form-input session-name-input"
            ref="sessionNameInputRef"
            @blur="$emit('commitRenameSession')" @keyup.enter="$emit('commitRenameSession')" @keyup.esc="$emit('cancelRenameSession')" />
          <div class="session-actions">
            <button class="btn-icon-sm" @click.stop="$emit('startRenameSession', session)" title="重命名" :disabled="isLoading">✏️</button>
            <button class="btn-icon-sm" @click.stop="$emit('saveCurrentSessionTo', session.id)" title="保存到本会话" :disabled="!hasData || session.id !== currentSessionId">💾</button>
            <button class="btn-icon-sm danger" @click.stop="$emit('deleteSession', session.id)" title="删除" :disabled="isLoading">🗑️</button>
          </div>
        </div>
      </div>
      <p v-else class="hint-mini">暂无保存的族谱会话</p>
      <div class="auto-save-row">
        <label class="autosave-label">
          <input type="checkbox" :checked="autoSaveEnabled" @change="$emit('toggleAutoSave', $event.target.checked)"> 自动保存
        </label>
        <span v-if="isSaving" class="save-status saving">保存中…</span>
        <span v-else-if="lastSavedAt" class="save-status saved">已保存 {{ formatTime(lastSavedAt) }}</span>
        <span v-else class="save-status">未保存</span>
      </div>
    </section>

    <!-- 统计图表 -->
    <section v-if="hasData && nodes.length" class="panel-section">
      <p class="section-label">族谱统计</p>
      <p class="stat-sub">代际分布（{{ generationStats.length }} 代，共 {{ totalMembers }} 人）</p>
      <svg class="stat-chart" viewBox="0 0 200 110" preserveAspectRatio="none" role="img" aria-label="代际分布柱状图">
        <line x1="22" :y1="100" x2="198" y2="100" class="stat-axis" />
        <line x1="22" y1="10" x2="22" y2="100" class="stat-axis" />
        <g v-for="(item, idx) in generationStats" :key="item.gen"
          :transform="`translate(${22 + idx * generationBarWidth}, 0)`">
          <rect :x="generationBarWidth * 0.18" :y="100 - item.height" :width="generationBarWidth * 0.64" :height="item.height"
            :class="['stat-bar', item.gen === maxGen ? 'peak' : 'normal']">
            <title>第 {{ item.gen }} 世：{{ item.count }} 人</title>
          </rect>
          <text :x="generationBarWidth / 2" y="108" class="stat-bar-label">{{ item.gen }}世</text>
          <text :x="generationBarWidth / 2" :y="100 - item.height - 3" class="stat-bar-value">{{ item.count }}</text>
        </g>
      </svg>
      <p class="stat-sub">性别比例（男 {{ genderStats.male }} / 女 {{ genderStats.female }}）</p>
      <div class="gender-row">
        <svg viewBox="0 0 60 60" class="gender-ring" role="img" aria-label="性别比例环图">
          <circle cx="30" cy="30" r="24" class="gender-ring-bg" />
          <circle v-if="genderStats.male + genderStats.female > 0" cx="30" cy="30" r="24" class="gender-ring-male"
            :stroke-dasharray="`${maleDash} ${circumference}`" :stroke-dashoffset="0" :transform="`rotate(-90 30 30)`" />
          <text x="30" y="34" class="gender-ring-text">{{ Math.round(genderStats.malePercent) }}%</text>
        </svg>
        <div class="gender-legend">
          <div class="legend-item"><span class="legend-swatch male"></span><span>男 {{ genderStats.male }}（{{ Math.round(genderStats.malePercent) }}%）</span></div>
          <div class="legend-item"><span class="legend-swatch female"></span><span>女 {{ genderStats.female }}（{{ Math.round(genderStats.femalePercent) }}%）</span></div>
        </div>
      </div>
    </section>

    <section class="panel-section">
      <p class="section-label">当前状态</p>
      <div class="status-line">
        <span class="status-dot" :class="{ error: hasError, loading: isLoading, pending: !apiKey && !isLoading && !hasError }"></span>
        <span>{{ displayStatus }}</span>
      </div>
    </section>

    <section class="metrics-grid">
      <div class="metric-card"><span class="metric-value">{{ nodes.length }}</span><span class="metric-label">成员</span></div>
      <div class="metric-card"><span class="metric-value">{{ links.length }}</span><span class="metric-label">关系</span></div>
    </section>

    <section class="panel-section">
      <p class="section-label">智能分析</p>
      <div class="api-state" :class="{ ready: apiKey }">
        <span>{{ apiKey ? '分析密钥已就绪' : '尚未配置分析密钥' }}</span>
      </div>
      <button class="panel-link" @click="$emit('showSettings')">管理分析密钥</button>
    </section>

    <section class="panel-section">
      <p class="section-label">编辑提示</p>
      <ul class="hint-list">
        <li>双击成员节点可编辑姓名和性别</li>
        <li>拖拽画布可移动视图，拖拽节点可微调位置</li>
        <li>右下角可缩放族谱视图</li>
      </ul>
    </section>

    <section class="panel-section" v-if="hasData">
      <p class="section-label">视图筛选</p>
      <div class="filter-row">
        <button v-for="opt in filterOptions" :key="opt.value"
          :class="['chip', { active: lineFilter === opt.value }]"
          :disabled="opt.value === 'branch' && !focusedNodeId"
          @click="$emit('setLineFilter', opt.value)">{{ opt.label }}</button>
      </div>
      <p class="hint-mini" v-if="lineFilter === 'branch' && focusedNodeId">当前分支：<strong>{{ focusNodeName }}</strong></p>
      <p class="hint-mini" v-else-if="lineFilter === 'branch'">请先点击某节点以选定分支</p>
      <p class="hint-mini" v-else>点击节点可高亮祖先 / 子孙 / 配偶</p>
    </section>

    <section class="panel-section query-panel" v-if="hasData">
      <p class="section-label">关系查询</p>
      <div class="query-fields">
        <div class="query-field">
          <label class="query-label" for="query-a">人物 A</label>
          <select id="query-a" :value="queryPersonA" @change="$emit('update:queryPersonA', $event.target.value)" class="form-select">
            <option value="">请选择</option>
            <option v-for="n in nodes" :key="n.id" :value="n.id">{{ n.name }}</option>
          </select>
        </div>
        <div class="query-field">
          <label class="query-label" for="query-b">人物 B</label>
          <select id="query-b" :value="queryPersonB" @change="$emit('update:queryPersonB', $event.target.value)" class="form-select">
            <option value="">请选择</option>
            <option v-for="n in nodes" :key="n.id" :value="n.id">{{ n.name }}</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary query-btn" @click="$emit('queryRelationship')"
        :disabled="!queryPersonA || !queryPersonB || queryPersonA === queryPersonB">查询关系</button>
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
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  sessions: Array, currentSessionId: [String, Number, null],
  editingSessionId: [String, Number, null], sessionNameInput: String,
  isSaving: Boolean, lastSavedAt: [Date, null], autoSaveEnabled: Boolean,
  isLoading: Boolean, hasData: Boolean, hasError: Boolean,
  nodes: Array, links: Array,
  apiKey: String, displayStatus: String,
  generationStats: Array, totalMembers: Number, maxGen: Number, generationBarWidth: Number,
  genderStats: Object, circumference: Number, maleDash: Number,
  lineFilter: String, focusedNodeId: [String, null], focusNodeName: String,
  queryPersonA: String, queryPersonB: String, queryResult: Object,
  formatTime: Function,
})

const emit = defineEmits([
  'createNewSession', 'fetchSessions', 'loadSession', 'saveCurrentSessionTo',
  'deleteSession', 'startRenameSession', 'commitRenameSession', 'cancelRenameSession',
  'toggleAutoSave', 'showSettings', 'setLineFilter', 'queryRelationship',
  'update:queryPersonA', 'update:queryPersonB',
])

const filterOptions = [
  { value: 'all', label: '全部' },
  { value: 'paternal', label: '仅父系' },
  { value: 'maternal', label: '仅母系' },
  { value: 'branch', label: '某人分支' },
]

const sessionNameInputModel = computed({
  get: () => props.sessionNameInput,
  set: (val) => emit('update:sessionNameInput', val),
})
</script>
