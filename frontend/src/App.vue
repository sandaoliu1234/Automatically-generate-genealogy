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
        <span
          v-if="providerBadge"
          :class="['provider-badge', `tone-${providerBadge.tone}`]"
          :title="providerBadge.hint || providerBadge.text"
          aria-live="polite"
        >
          {{ providerBadge.text }}
        </span>
        <button class="btn btn-icon" @click="undo" :disabled="!canUndo" aria-label="撤销 (Ctrl+Z)" title="撤销 (Ctrl+Z)">↶</button>
        <button class="btn btn-icon" @click="redo" :disabled="!canRedo" aria-label="重做 (Ctrl+Y)" title="重做 (Ctrl+Y)">↷</button>
        <span class="toolbar-sep"></span>
        <button class="btn btn-primary" @click="triggerFileUpload" :disabled="isLoading" aria-label="上传文档">
          {{ isLoading ? '分析中' : '上传文档' }}
        </button>
        <button class="btn btn-plain" @click="openSearch" :disabled="!hasData" aria-label="搜索人物 (Ctrl+K)" title="搜索人物 (Ctrl+K)">
          搜索人物
        </button>
        <button class="btn btn-plain" @click="exportImage" :disabled="!hasData || isLoading" aria-label="导出图片">
          导出图片
        </button>
        <button class="btn btn-plain" @click="exportGedcom" :disabled="!hasData || isLoading" aria-label="导出 GEDCOM">
          导出 GEDCOM
        </button>
        <button class="btn btn-plain" @click="toggleTheme" :aria-label="'切换到' + (theme === 'dark' ? '亮色' : '暗色') + '模式'" :title="'切换到' + (theme === 'dark' ? '亮色' : '暗色') + '模式'">
          {{ theme === 'dark' ? '☀ 亮色' : '🌙 暗色' }}
        </button>
        <button class="btn btn-plain" @click="showHelp" aria-label="快捷键帮助" title="快捷键帮助 (?)">?</button>
        <button class="btn btn-plain" @click="clearAll" :disabled="!hasData || isLoading" aria-label="清空族谱">
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
        <input
          ref="gedcomInput"
          type="file"
          class="upload-input"
          accept=".ged"
          @change="handleGedcomUpload"
        />
    </header>

    <main class="workspace">
      <aside class="side-panel">
        <section class="panel-section">
          <p class="section-label">族谱会话</p>
          <div class="session-header">
            <button class="btn btn-sm" @click="createNewSession">+ 新建</button>
            <button class="btn btn-sm btn-plain" @click="fetchSessions" title="刷新列表">↻</button>
          </div>
          <div class="session-list" v-if="sessions.length">
            <div
              v-for="session in sessions"
              :key="session.id"
              :class="['session-item', { active: session.id === currentSessionId }]"
            >
              <span v-if="editingSessionId !== session.id" class="session-name" @click="loadSession(session.id)">{{ session.name }}</span>
              <input
                v-else
                v-model="sessionNameInput"
                class="form-input session-name-input"
                ref="sessionNameInputRef"
                @blur="commitRenameSession"
                @keyup.enter="commitRenameSession"
                @keyup.esc="cancelRenameSession"
              />
              <div class="session-actions">
                <button class="btn-icon-sm" @click.stop="startRenameSession(session)" title="重命名">✏️</button>
                <button class="btn-icon-sm" @click.stop="saveCurrentSessionTo(session.id)" title="保存到本会话" :disabled="!hasData">💾</button>
                <button class="btn-icon-sm danger" @click.stop="deleteSession(session.id)" title="删除">🗑️</button>
              </div>
            </div>
          </div>
          <p v-else class="hint-mini">暂无保存的族谱会话</p>
          <div class="auto-save-row">
            <label class="autosave-label">
              <input type="checkbox" v-model="autoSaveEnabled"> 自动保存
            </label>
            <span v-if="isSaving" class="save-status saving">保存中…</span>
            <span v-else-if="lastSavedAt" class="save-status saved">已保存 {{ formatTime(lastSavedAt) }}</span>
            <span v-else class="save-status">未保存</span>
          </div>
        </section>

        <!-- 统计图表：代际分布柱状图 + 性别比例环图 -->
        <section v-if="hasData && nodes.length" class="panel-section">
          <p class="section-label">族谱统计</p>

          <p class="stat-sub">代际分布（{{ generationStats.length }} 代，共 {{ totalMembers }} 人）</p>
          <svg
            class="stat-chart"
            viewBox="0 0 200 110"
            preserveAspectRatio="none"
            role="img"
            aria-label="代际分布柱状图"
          >
            <line x1="22" :y1="100" x2="198" y2="100" class="stat-axis" />
            <line x1="22" y1="10" x2="22" y2="100" class="stat-axis" />
            <g
              v-for="(item, idx) in generationStats"
              :key="item.gen"
              :transform="`translate(${22 + idx * generationBarWidth}, 0)`"
            >
              <rect
                :x="generationBarWidth * 0.18"
                :y="100 - item.height"
                :width="generationBarWidth * 0.64"
                :height="item.height"
                :class="['stat-bar', item.gen === maxGen ? 'peak' : 'normal']"
              >
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
              <circle
                v-if="genderStats.male + genderStats.female > 0"
                cx="30"
                cy="30"
                r="24"
                class="gender-ring-male"
                :stroke-dasharray="`${maleDash} ${circumference}`"
                :stroke-dashoffset="0"
                :transform="`rotate(-90 30 30)`"
              />
              <text x="30" y="34" class="gender-ring-text">{{ Math.round(genderStats.malePercent) }}%</text>
            </svg>
            <div class="gender-legend">
              <div class="legend-item">
                <span class="legend-swatch male"></span>
                <span>男 {{ genderStats.male }}（{{ Math.round(genderStats.malePercent) }}%）</span>
              </div>
              <div class="legend-item">
                <span class="legend-swatch female"></span>
                <span>女 {{ genderStats.female }}（{{ Math.round(genderStats.femalePercent) }}%）</span>
              </div>
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

        <section class="panel-section" v-if="hasData">
          <p class="section-label">视图筛选</p>
          <div class="filter-row">
            <button
              v-for="opt in [
                { value: 'all', label: '全部' },
                { value: 'paternal', label: '仅父系' },
                { value: 'maternal', label: '仅母系' },
                { value: 'branch', label: '某人分支' }
              ]"
              :key="opt.value"
              :class="['chip', { active: lineFilter === opt.value }]"
              :disabled="opt.value === 'branch' && !focusedNodeId"
              @click="setLineFilter(opt.value)"
            >{{ opt.label }}</button>
          </div>
          <p class="hint-mini" v-if="lineFilter === 'branch' && focusedNodeId">
            当前分支：<strong>{{ focusNodeName }}</strong>
          </p>
          <p class="hint-mini" v-else-if="lineFilter === 'branch'">
            请先点击某节点以选定分支
          </p>
          <p class="hint-mini" v-else>
            点击节点可高亮祖先 / 子孙 / 配偶
          </p>
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
            <button class="btn btn-plain large" @click="triggerGedcomUpload">导入 .ged 文件</button>
            <button class="btn btn-plain large" @click="showSettings = true">配置分析密钥</button>
          </div>
          <div class="format-row">
            <span>TXT</span>
            <span>PDF</span>
            <span>DOC</span>
            <span>DOCX</span>
            <span>GED</span>
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

        <div v-if="hasData && !showUpload" class="canvas-container" ref="canvasContainer"
             @dragover="onCanvasDragOver"
             @dragleave="onCanvasDragLeave"
             @drop="handleDrop">
          <div class="zodiac-watermark" aria-hidden="true">鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪 鼠 牛 虎 兔 龙 蛇 马 羊 猴 鸡 狗 猪</div>
          <div class="scroll-title">
            <span></span>
            <strong>族谱世系图</strong>
            <span></span>
          </div>

          <svg
            ref="svgCanvas"
            class="genealogy-canvas"
            @mousedown="startCanvasDrag"
            @click.self="onCanvasClick"
            @wheel.prevent="onWheelZoom"
            role="img"
            aria-label="族谱世系图画布"
          >
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
              <g v-for="link in filteredVisibleLinks" :key="link.id">
                <path
                  :d="link.relation === 'husband-wife' ? getSpouseLinkPath(link) : getLinkPath(link)"
                  :class="['link', {
                    spouse: link.relation === 'husband-wife',
                    highlight: highlightedLinks.includes(link.id),
                    dimmed: focusedBranchLinkIds && !focusedBranchLinkIds.has(link.id)
                  }]"
                  :marker-end="link.relation === 'husband-wife' ? '' : 'url(#arrowhead)'"
                />
              </g>
              <g
                v-for="node in filteredVisibleNodes"
                :key="node.id"
                class="node"
                :class="{
                  focused: focusedNodeId === node.id,
                  dimmed: focusedBranchIds && !focusedBranchIds.has(node.id),
                  pulse: pulsingNodeId === node.id
                }"
                :transform="`translate(${node.x}, ${node.y})`"
                @mousedown.stop="startNodeDrag(node, $event)"
                @click.stop="focusOnNode(node)"
                @dblclick.stop="toggleCollapse(node)"
                @contextmenu.stop="openContextMenu(node, $event)"
              >
                <circle r="38" :class="[node.gender, { highlight: highlightedNodes.includes(node.id) }]" />
                <text class="generation-text" dy="-14">{{ node.generation }}世</text>
                <text class="node-text" dy="10">
                  {{ node.name.length > 4 ? node.name.slice(0, 4) + '…' : node.name }}
                </text>
                <title>{{ node.name }}（{{ node.gender === 'female' ? '女' : '男' }}，{{ node.generation }}世）</title>
                <g v-if="countDescendants(node.id) > 0" class="collapse-badge" :class="{ collapsed: node.collapsed }" @click.stop="toggleCollapse(node)">
                  <circle r="11" />
                  <text dy="4">{{ node.collapsed ? '+' : '−' }}</text>
                  <title>{{ node.collapsed ? '展开 ' + countDescendants(node.id) + ' 个后代' : '折叠 ' + countDescendants(node.id) + ' 个后代' }}</title>
                </g>
              </g>
            </g>
          </svg>

          <div class="zoom-controls" role="group" aria-label="缩放控制">
            <button @click="zoomOut" aria-label="缩小" title="缩小 (-)">-</button>
            <span aria-live="polite">{{ Math.round(zoom * 100) }}%</span>
            <button @click="zoomIn" aria-label="放大" title="放大 (+)">+</button>
            <button @click="resetZoom" aria-label="重置缩放" title="重置 (0)">重置</button>
          </div>

          <!-- 图谱小地图：缩略图 + 当前视口框，支持拖拽 / 点击导航 -->
          <div
            v-if="hasData && nodes.length > 0"
            class="minimap"
            ref="minimapEl"
            role="region"
            aria-label="图谱小地图"
            @mousedown.stop="onMinimapMouseDown"
            @click.stop
          >
            <svg :viewBox="`0 0 ${minimapSize} ${minimapSize}`" preserveAspectRatio="xMidYMid meet" class="minimap-svg">
              <!-- 节点缩略 -->
              <g
                v-for="node in nodes"
                :key="'mm-' + node.id"
                :transform="`translate(${minimapXOf(node.x)}, ${minimapYOf(node.y)})`"
              >
                <circle r="3" :class="node.gender" />
              </g>
              <!-- 关系缩略 -->
              <line
                v-for="link in minimapLinks"
                :key="'mml-' + link.id"
                :x1="minimapXOf(link.x1)"
                :y1="minimapYOf(link.y1)"
                :x2="minimapXOf(link.x2)"
                :y2="minimapYOf(link.y2)"
                class="minimap-link"
                :class="{ spouse: link.spouse }"
              />
              <!-- 当前视口框 -->
              <rect
                :x="viewportRect.x"
                :y="viewportRect.y"
                :width="viewportRect.w"
                :height="viewportRect.h"
                class="minimap-viewport"
              />
            </svg>
            <div class="minimap-label">缩略图</div>
          </div>

          <!-- 拖拽文件到画布时的提示遮罩 -->
          <div v-if="isDragOverCanvas" class="canvas-dropzone" aria-hidden="true">
            <div class="canvas-dropzone-inner">
              <div class="dropzone-icon">⇪</div>
              <p>拖入文件以替换当前族谱</p>
              <small>支持 TXT / PDF / DOC / DOCX</small>
            </div>
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
          <label class="form-label" for="api-key-input">分析密钥</label>
          <input
            id="api-key-input"
            v-model="userApiKey"
            type="password"
            class="form-input"
            placeholder="粘贴你的 API Key"
          />
          <small class="form-hint">密钥仅保存在你的浏览器中，不会上传到任何服务器。</small>
        </div>
        <div class="form-group">
          <label class="form-label" for="force-mode-select">调用模式</label>
          <select
            id="force-mode-select"
            class="form-select"
            :value="forceMode"
            @change="(e) => setForceMode(e.target.value)"
          >
            <option value="auto">自动：阿里云优先，失败时自动切本地</option>
            <option value="cloud">强制云端：仅用阿里云百炼</option>
            <option value="local">强制本地：仅用本地 Ollama</option>
          </select>
          <small class="form-hint">调试或对比效果时可手动指定；选择会自动保存到本地。</small>
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

    <!-- 搜索人物弹窗 -->
    <div v-if="showSearchModal" class="modal" @click.self="closeSearch" role="dialog" aria-modal="true" aria-label="搜索人物">
      <div class="modal-content search-modal">
        <div class="modal-header">
          <h3>搜索人物</h3>
          <button class="modal-close" @click="closeSearch" aria-label="关闭">×</button>
        </div>
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          class="form-input search-input"
          placeholder="输入姓名（模糊匹配）"
          @keydown.esc="closeSearch"
          @keydown.enter="searchResults.length && selectSearchResult(searchResults[0])"
        />
        <div class="search-results" role="listbox">
          <div v-if="searchResults.length === 0" class="search-empty">无匹配结果</div>
          <button
            v-for="r in searchResults.slice(0, 50)"
            :key="r.id"
            class="search-item"
            @click="selectSearchResult(r)"
          >
            <span class="search-item-name">{{ r.name }}</span>
            <span class="search-item-meta">{{ r.generation }}世 · {{ r.gender === 'female' ? '女' : '男' }}</span>
          </button>
          <div v-if="searchResults.length > 50" class="search-more">还有 {{ searchResults.length - 50 }} 个结果，请缩小关键词</div>
        </div>
      </div>
    </div>

    <!-- 快捷键帮助弹窗 -->
    <div v-if="showHelpModal" class="modal" @click.self="closeHelp" role="dialog" aria-modal="true" aria-label="快捷键帮助">
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

    <!-- 右键菜单 -->
    <div
      v-if="contextMenu.show"
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      role="menu"
      @click.stop
    >
      <div class="context-menu-header">{{ contextMenu.node && contextMenu.node.name }}</div>
      <button class="context-item" @click="contextEditNode">编辑…</button>
      <div class="context-divider"></div>
      <button class="context-item" @click="contextAddChild('male')">添加儿子</button>
      <button class="context-item" @click="contextAddChild('female')">添加女儿</button>
      <button class="context-item" @click="contextAddSpouse">添加配偶</button>
      <div class="context-divider"></div>
      <button class="context-item" @click="contextAddParent('father')">添加父亲</button>
      <button class="context-item" @click="contextAddParent('mother')">添加母亲</button>
      <div class="context-divider"></div>
      <button class="context-item" @click="setAsRootNode">设为根</button>
      <button class="context-item danger" @click="contextDeleteNode">删除</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import html2canvas from 'html2canvas'

const fileInput = ref(null)
const gedcomInput = ref(null)
const mainContent = ref(null)
const svgCanvas = ref(null)
const svgGroup = ref(null)
const canvasContainer = ref(null)
const minimapEl = ref(null)

const nodes = ref([])
const links = ref([])
const isLoading = ref(false)
const isDragOverCanvas = ref(false)
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

// ============ 统计图表 ============
// 代际分布 + 性别比例，所有数据都从 nodes 派生
const generationStats = computed(() => {
  if (nodes.value.length === 0) return []
  const counts = new Map()
  for (const n of nodes.value) {
    const g = n.generation || 1
    counts.set(g, (counts.get(g) || 0) + 1)
  }
  const arr = Array.from(counts.entries())
    .map(([gen, count]) => ({ gen, count }))
    .sort((a, b) => a.gen - b.gen)
  const max = Math.max(...arr.map(i => i.count), 1)
  // 留 10% 顶部空白，柱体最大占 80px
  return arr.map(item => ({
    ...item,
    height: Math.round((item.count / max) * 80) + 4
  }))
})
const totalMembers = computed(() => nodes.value.length)
const maxGen = computed(() => {
  if (generationStats.value.length === 0) return 0
  return generationStats.value.reduce((m, i) => (i.count > m.count ? i : m)).gen
})
// 单柱宽度 = (画布宽 198 - 起始 22) / 代际数，至少 8px
const generationBarWidth = computed(() => {
  const n = generationStats.value.length || 1
  return Math.max(8, Math.floor(176 / n))
})
const genderStats = computed(() => {
  let male = 0
  let female = 0
  for (const n of nodes.value) {
    if (n.gender === 'female') female += 1
    else male += 1
  }
  const total = male + female
  return {
    male,
    female,
    malePercent: total === 0 ? 0 : (male / total) * 100,
    femalePercent: total === 0 ? 0 : (female / total) * 100
  }
})
const circumference = computed(() => 2 * Math.PI * 24)
const maleDash = computed(() => {
  return (genderStats.value.malePercent / 100) * circumference.value
})
const API_BASE_URL = '/api'
const apiKey = ref(localStorage.getItem('genealogy_api_key') || '')
const userApiKey = ref(apiKey.value)
const showSettings = ref(false)
// 调用模式：auto（自动主备切换）/ cloud（强制云端）/ local（强制本地）
const VALID_FORCE_MODES = ['auto', 'cloud', 'local']
const forceMode = ref(localStorage.getItem('genealogy_force_mode') || 'auto')
// 最近一次分析的服务来源信息
const aiProviderInfo = ref(null)
// 焦点节点 id：null 表示未聚焦；点击节点切换焦点；点击空白处或再次点击同一节点取消
const focusedNodeId = ref(null)
// 主题：light / dark
const theme = ref(localStorage.getItem('genealogy_theme') || 'light')
// 搜索
const showSearchModal = ref(false)
const searchQuery = ref('')
const searchInputRef = ref(null)
// 帮助弹窗
const showHelpModal = ref(false)
// 右键菜单
const contextMenu = ref({ show: false, x: 0, y: 0, node: null })

// MySQL 会话管理
const sessions = ref([])
const currentSessionId = ref(null)
const currentSessionName = ref('')
const isSaving = ref(false)
const lastSavedAt = ref(null)
const autoSaveEnabled = ref(localStorage.getItem('genealogy_autosave') !== 'false')
const sessionNameInput = ref('')
const editingSessionId = ref(null)
const sessionNameInputRef = ref(null)
// 会话重命名时的原始名称，用于 ESC 取消恢复
let renameSessionOriginalName = ''

// 主题初始化（应用 data-theme 到 <html>）
applyTheme()

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
  if (sessions.value.length > 0 && !currentSessionId.value && !hasData.value) return '请选择一个族谱会话或新建会话'
  if (!apiKey.value) return '请先配置分析密钥，然后上传文档'
  if (hasData.value) return currentSessionName.value ? `「${currentSessionName.value}」已生成` : '族谱已生成，双击节点可编辑'
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

// 切换调用模式，并持久化到本地
const setForceMode = (mode) => {
  if (!VALID_FORCE_MODES.includes(mode)) return
  forceMode.value = mode
  localStorage.setItem('genealogy_force_mode', mode)
}

// 把最近一次 AI 调用结果转换成用于顶栏徽章展示的文本与样式
const providerBadge = computed(() => {
  const info = aiProviderInfo.value
  if (!info || !info.provider) return null
  if (info.forced === 'cloud') {
    return { text: '阿里云百炼（强制）', tone: 'cloud' }
  }
  if (info.forced === 'local') {
    return { text: '本地 Ollama（强制）', tone: 'local' }
  }
  if (info.fallback) {
    return {
      text: `本地 Ollama（兜底 · 阿里云异常）`,
      tone: 'fallback',
      hint: info.primaryError
    }
  }
  return { text: `阿里云百炼`, tone: 'cloud' }
})

// 关闭设置弹窗，并恢复输入框中的当前密钥值。
const closeSettings = () => {
  showSettings.value = false
  userApiKey.value = apiKey.value
}

// 打开隐藏的文件选择框，触发文档上传流程。
const triggerFileUpload = () => {
  fileInput.value?.click()
}
const triggerGedcomUpload = () => {
  gedcomInput.value?.click()
}

// 处理 GEDCOM 导入：读 .ged 文本 -> 走 importGedcomFromText
const handleGedcomUpload = async (event) => {
  const file = event.target.files?.[0]
  // 关键：清空 value，否则下次选同一文件不触发 change
  event.target.value = ''
  if (!file) return
  const text = await file.text()
  await importGedcomFromText(file.name, text)
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
  isDragOverCanvas.value = false
  const file = event.dataTransfer.files?.[0]
  if (!file) return
  if (file.name.toLowerCase().endsWith('.ged')) {
    await importGedcomFromText(file.name, await file.text())
  } else {
    await analyzeDocument(file)
  }
}

// 共用的 GEDCOM 导入核心逻辑：上传页面 / 画布 / 拖拽 都走这里
const importGedcomFromText = async (filename, text) => {
  isLoading.value = true
  hasError.value = false
  showUpload.value = false
  loadingMessage.value = '正在解析 GEDCOM 文件...'
  try {
    const resp = await fetch('/api/import/gedcom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, filename })
    })
    const json = await resp.json()
    if (!json.success) {
      throw new Error(json.error?.message || 'GEDCOM 导入失败')
    }
    const { members, relationships } = json.data
    if (!members || members.length === 0) {
      throw new Error('GEDCOM 中未找到成员记录')
    }
    currentSessionName.value = (filename || 'GEDCOM').replace(/\.ged$/i, '')
    await buildGenealogyData(members, relationships)
    statusText.value = `已从 ${filename} 导入，共 ${members.length} 人`
  } catch (err) {
    hasError.value = true
    statusText.value = '导入失败：' + (err.message || '未知错误')
    showUpload.value = true
  } finally {
    isLoading.value = false
  }
}

// 画布上的拖拽需要：dragover preventDefault（才能 drop），
// dragenter/dragleave 维护视觉态，drop 复用 handleDrop
const onCanvasDragOver = (event) => {
  event.preventDefault()
  // 必须设置 dropEffect 才能在某些浏览器触发 drop
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  isDragOverCanvas.value = true
}
const onCanvasDragLeave = (event) => {
  // 仅当真正离开容器时清掉（relatedTarget 不在容器内）
  if (event.currentTarget && event.relatedTarget &&
      event.currentTarget.contains(event.relatedTarget)) return
  isDragOverCanvas.value = false
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

      const response = await fetch(`${API_BASE_URL}/upload?force=${forceMode.value}`, {
        method: 'POST',
        headers,
        body: formData
      })

      if (!response.ok) throw new Error('文档上传失败，请检查文件格式是否正确')

      const result = await response.json()
      if (!result.success) throw new Error(result.error?.message || '无法从文档中提取族谱信息')

      aiProviderInfo.value = {
        provider: result.data?.provider,
        fallback: result.data?.fallback,
        forced: result.data?.forced,
        primaryError: result.data?.primaryError
      }
      buildGenealogyData(result.data.members, result.data.relationships)
      return
    }

    loadingMessage.value = '正在识别家族成员和关系...'
    const headers = { 'Content-Type': 'application/json' }
    if (apiKey.value) headers['X-API-Key'] = apiKey.value

    const response = await fetch(`${API_BASE_URL}/analyze?force=${forceMode.value}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, filename: file.name })
    })

    if (!response.ok) throw new Error('AI 分析服务暂时不可用，请稍后重试')

    const result = await response.json()
    if (!result.success) throw new Error(result.error?.message || '未能从文档内容中识别出族谱信息，请检查文档是否包含家族成员和关系描述')

    aiProviderInfo.value = {
      provider: result.data?.provider,
      fallback: result.data?.fallback,
      forced: result.data?.forced,
      primaryError: result.data?.primaryError
    }
    buildGenealogyData(result.data.members, result.data.relationships)
  } catch (error) {
    console.error('分析失败:', error)
    hasError.value = true
    // fetch 失败（TypeError: Failed to fetch）通常是后端没启动 / 代理不通
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      statusText.value = '无法连接后端服务，请确认 backend 已在端口 3100 启动（node server.js）'
    } else {
      statusText.value = error.message
    }
    showUpload.value = true
  } finally {
    isLoading.value = false
  }
}

// 把 AI 返回的成员和关系数据转换成画布节点与连线。
// 兼容三种数据来源：
//   - AI 文本分析：relationships[].person1/person2 指向 member.name
//   - GEDCOM 导入 ：relationships[].source_id/target_id 指向 member.id
//   - 数据库加载 ：relationships[].source/target 可能是 id 或 name
// 优先按 id 查，回退到按 name 查，保证所有数据源都能正常连线。
const buildGenealogyData = async (members, relationships) => {
  const nodeById = new Map()
  const nodeByName = new Map()

  nodes.value = members.map((member, index) => {
    const id = member.id || `node_${index}`
    const node = {
      id,
      name: member.name,
      gender: member.gender === 'female' ? 'female' : 'male',
      generation: member.generation || 1,
      x: 0,
      y: 0,
      collapsed: false
    }
    nodeById.set(id, node)
    if (member.name) nodeByName.set(member.name, node)
    return node
  })

  const findNode = (key) => {
    if (key == null) return null
    if (nodeById.has(key)) return nodeById.get(key)
    if (nodeByName.has(key)) return nodeByName.get(key)
    // GEDCOM 解析会保留 @I1@ 这种原始 xref，作为最后一道兜底
    if (typeof key === 'string' && key.startsWith('@')) {
      const m = members.find(mb => mb.id === key || mb.gedcomXref === key)
      if (m) return nodeById.get(m.id)
    }
    return null
  }

  links.value = relationships
    .map((rel, index) => {
      const sourceKey = rel.source_id || rel.source || rel.person1
      const targetKey = rel.target_id || rel.target || rel.person2
      const sourceNode = findNode(sourceKey)
      const targetNode = findNode(targetKey)
      if (!sourceNode || !targetNode) return null

      return {
        id: rel.id || `link_${index}`,
        source: sourceNode,
        target: targetNode,
        relation: rel.relation
      }
    })
    .filter(link => link !== null)

  applyTreeLayout()
  pushHistory()
  statusText.value = '分析完成，可双击节点编辑'

  // 如果当前没有绑定会话，自动创建一个新会话并保存
  if (!currentSessionId.value) {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '未命名族谱' })
      })
      const json = await res.json()
      if (json.success) {
        currentSessionId.value = json.data.id
        currentSessionName.value = json.data.name || '未命名族谱'
        await saveCurrentSession()
        await fetchSessions()
      }
    } catch (err) {
      console.error('自动创建会话失败:', err)
    }
  } else {
    // 已有会话时立即自动保存一次
    scheduleAutoSave()
  }
}

// 按代际对成员进行基础树状排布，生成初始坐标。
// 收集指定节点的所有直系后代 id
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

// 计算某节点下需要隐藏的后代总数
const countDescendants = (nodeId) => {
  const set = new Set()
  collectDescendants(nodeId, set)
  return set.size
}

// 当前被折叠的祖先节点集合
const collapsedAncestors = computed(() => nodes.value.filter(n => n.collapsed))

// 由于祖先折叠而需要隐藏的节点 id 集合
const hiddenNodeIds = computed(() => {
  const hidden = new Set()
  for (const collapsed of collapsedAncestors.value) {
    collectDescendants(collapsed.id, hidden)
  }
  return hidden
})

// 实际渲染的节点 / 边（过滤掉被折叠的子树）
const visibleNodes = computed(() => nodes.value.filter(n => !hiddenNodeIds.value.has(n.id)))
const visibleLinks = computed(() => links.value.filter(l => {
  if (hiddenNodeIds.value.has(l.source.id)) return false
  if (hiddenNodeIds.value.has(l.target.id)) return false
  return true
}))

// 切换节点折叠/展开状态
const toggleCollapse = (node) => {
  const target = nodes.value.find(n => n.id === node.id)
  if (!target) return
  // 没有后代的叶子节点不响应双击（避免误折叠）
  if (countDescendants(node.id) === 0) return
  target.collapsed = !target.collapsed
  pushHistory()
}

// 收集节点的祖先链（含自己）
const collectAncestors = (nodeId, set) => {
  if (set.has(nodeId)) return
  set.add(nodeId)
  for (const link of links.value) {
    if (link.relation === 'husband-wife') continue
    // 子→父 关系中，target 是子，source 是父
    if (link.target.id === nodeId && !set.has(link.source.id)) {
      collectAncestors(link.source.id, set)
    }
  }
}

// 收集节点的配偶 id
const collectSpouses = (nodeId, set) => {
  for (const link of links.value) {
    if (link.relation !== 'husband-wife') continue
    if (link.source.id === nodeId) set.add(link.target.id)
    else if (link.target.id === nodeId) set.add(link.source.id)
  }
}

// 当前焦点节点 + 配偶 + 祖先 + 后代（构成完整"分支"）
const focusedBranchIds = computed(() => {
  if (!focusedNodeId.value) return null
  const set = new Set()
  collectAncestors(focusedNodeId.value, set)
  collectDescendants(focusedNodeId.value, set)
  collectSpouses(focusedNodeId.value, set)
  return set
})

// 焦点分支内的边（用于高亮）
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

// 点击节点：切换焦点
const focusOnNode = (node) => {
  if (focusedNodeId.value === node.id) {
    focusedNodeId.value = null
  } else {
    focusedNodeId.value = node.id
  }
}

// 点击画布空白处：取消焦点 + 取消查询高亮
const onCanvasClick = () => {
  focusedNodeId.value = null
  highlightedNodes.value = []
  highlightedLinks.value = []
}

// 主题切换
const toggleTheme = () => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('genealogy_theme', theme.value)
}

// 应用主题到根元素
const applyTheme = () => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme.value)
  }
}

// 打开搜索
const openSearch = () => {
  if (!hasData.value) return
  showSearchModal.value = true
  searchQuery.value = ''
  // 自动聚焦输入框
  nextTick(() => {
    searchInputRef.value && searchInputRef.value.focus()
  })
}

const closeSearch = () => {
  showSearchModal.value = false
}

// 搜索结果：按姓名模糊匹配，按代际 + 姓名排序
const searchResults = computed(() => {
  const q = searchQuery.value.trim()
  if (!q) return nodes.value.slice().sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name, 'zh'))
  return nodes.value
    .filter(n => n.name && n.name.includes(q))
    .sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name, 'zh'))
})

// 选中搜索结果：聚焦 + 居中 + 闪烁
const selectSearchResult = (node) => {
  if (!node) return
  focusedNodeId.value = node.id
  // 居中该节点
  centerOnNode(node)
  // 闪烁 1.5s
  pulsingNodeId.value = node.id
  setTimeout(() => {
    pulsingNodeId.value = null
  }, 1600)
  closeSearch()
}

// 居中到指定节点
const centerOnNode = (node) => {
  if (!svgCanvas.value) return
  const rect = svgCanvas.value.getBoundingClientRect()
  // 把节点的世界坐标 (node.x, node.y) 投影到屏幕中心
  // 屏幕坐标 = cx + node.x * zoom，cx = rect.width / 2 + panX
  // 要使屏幕坐标 = (rect.width / 2, rect.height / 2)
  // → rect.width/2 + panX + node.x * zoom = rect.width/2 → panX = -node.x * zoom
  panX.value = -node.x * zoom.value
  panY.value = -node.y * zoom.value
  updateTransform()
}

// 闪烁高亮的节点 id
const pulsingNodeId = ref(null)

// 视图筛选：all / paternal / maternal / branch（branch 用 focusedBranchIds）
const lineFilter = ref('all')

// 仅显示沿某 line 边（father / mother）从根可达的子代 + 根的配偶 + 一层 spouse
function getLineVisible(line) {
  if (nodes.value.length === 0) return new Set()
  const minGen = Math.min(...nodes.value.map(n => n.generation || 1))
  // 起点 = 所有最小代际的节点（通常是 gen=1 的根）
  const start = new Set(nodes.value.filter(n => (n.generation || 1) === minGen).map(n => n.id))
  // 起点配偶也作为起点
  let added = true
  while (added) {
    added = false
    for (const link of links.value) {
      if (link.relation !== 'husband-wife') continue
      if (start.has(link.source.id) && !start.has(link.target.id)) { start.add(link.target.id); added = true }
      else if (start.has(link.target.id) && !start.has(link.source.id)) { start.add(link.source.id); added = true }
    }
  }
  // BFS 沿 line-* 边向子代走
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
  // 加 visible 节点的一层配偶（保持配偶一致性，但不沿配偶向下延伸）
  const toAdd = new Set()
  for (const link of links.value) {
    if (link.relation !== 'husband-wife') continue
    if (visible.has(link.source.id)) toAdd.add(link.target.id)
    if (visible.has(link.target.id)) toAdd.add(link.source.id)
  }
  for (const id of toAdd) visible.add(id)
  return visible
}

// 筛选后需要隐藏的节点 id 集合
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

// 综合隐藏：折叠的子孙 + 筛选掉的节点
const combinedHiddenNodeIds = computed(() => {
  const set = new Set(hiddenNodeIds.value)
  for (const id of filterHiddenNodeIds.value) set.add(id)
  return set
})

// 实际渲染的节点 / 边（综合过滤）
const filteredVisibleNodes = computed(() => nodes.value.filter(n => !combinedHiddenNodeIds.value.has(n.id)))
const filteredVisibleLinks = computed(() => links.value.filter(l => {
  if (combinedHiddenNodeIds.value.has(l.source.id)) return false
  if (combinedHiddenNodeIds.value.has(l.target.id)) return false
  return true
}))

// 切换筛选模式
const setLineFilter = (mode) => {
  lineFilter.value = mode
  if (mode === 'branch' && !focusedNodeId.value) {
    // 切到 branch 但没选人，自动回到 all
    lineFilter.value = 'all'
  }
}

// 当前焦点节点的名字（用于显示）
const focusNodeName = computed(() => {
  if (!focusedNodeId.value) return ''
  const n = nodes.value.find(x => x.id === focusedNodeId.value)
  return n ? n.name : ''
})

// 帮助弹窗
const showHelp = () => {
  showHelpModal.value = true
}
const closeHelp = () => {
  showHelpModal.value = false
}

// 打开右键菜单
const openContextMenu = (node, e) => {
  if (e && e.preventDefault) e.preventDefault()
  const menuWidth = 180
  const menuHeight = 320
  let x = e.clientX
  let y = e.clientY
  if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8
  if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8
  contextMenu.value = { show: true, x, y, node }
}

const closeContextMenu = () => {
  contextMenu.value.show = false
  contextMenu.value.node = null
}

// 右键菜单：编辑
const contextEditNode = () => {
  const node = contextMenu.value.node
  closeContextMenu()
  if (node) editNode(node)
}

// 生成新节点 id
const newNodeId = (prefix = 'node') => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`

// 右键菜单：添加子女（性别 = male/female）
const contextAddChild = (gender) => {
  const node = contextMenu.value.node
  closeContextMenu()
  if (!node) return
  pushHistory()
  const id = newNodeId('node')
  // 父→子 关系类型：父是 node，母的话反过来
  let parentRel
  if (node.gender === 'female') {
    parentRel = gender === 'male' ? 'mother-son' : 'mother-daughter'
  } else {
    parentRel = gender === 'male' ? 'father-son' : 'father-daughter'
  }
  const newNode = {
    id,
    name: '新成员',
    gender,
    generation: (node.generation || 1) + 1,
    x: node.x + 80,
    y: node.y + 120,
    collapsed: false
  }
  nodes.value.push(newNode)
  links.value.push({
    id: newNodeId('link'),
    source: node,
    target: newNode,
    relation: parentRel
  })
}

// 右键菜单：添加配偶
const contextAddSpouse = () => {
  const node = contextMenu.value.node
  closeContextMenu()
  if (!node) return
  pushHistory()
  const id = newNodeId('node')
  const newNode = {
    id,
    name: '新配偶',
    gender: node.gender === 'female' ? 'male' : 'female',
    generation: node.generation || 1,
    x: node.x + 100,
    y: node.y,
    collapsed: false
  }
  nodes.value.push(newNode)
  links.value.push({
    id: newNodeId('link'),
    source: node,
    target: newNode,
    relation: 'husband-wife'
  })
}

// 右键菜单：添加父亲 / 母亲
const contextAddParent = (which) => {
  const node = contextMenu.value.node
  closeContextMenu()
  if (!node) return
  pushHistory()
  const id = newNodeId('node')
  const newNode = {
    id,
    name: which === 'father' ? '父亲' : '母亲',
    gender: which,
    generation: Math.max(1, (node.generation || 1) - 1),
    x: node.x - 80,
    y: node.y - 120,
    collapsed: false
  }
  nodes.value.push(newNode)
  const rel = which === 'father'
    ? (node.gender === 'female' ? 'father-daughter' : 'father-son')
    : (node.gender === 'female' ? 'mother-daughter' : 'mother-son')
  links.value.push({
    id: newNodeId('link'),
    source: newNode,
    target: node,
    relation: rel
  })
}

// 右键菜单：删除
const contextDeleteNode = () => {
  const node = contextMenu.value.node
  closeContextMenu()
  if (node) deleteNode(node)
}

// 右键菜单：设为根（把该节点调整为最小代际 1，并相应下移其他成员）
const setAsRootNode = () => {
  const node = contextMenu.value.node
  closeContextMenu()
  if (!node) return
  const minGen = Math.min(...nodes.value.map(n => n.generation || 1))
  const currentGen = node.generation || 1
  if (currentGen <= minGen) return
  pushHistory()
  const offset = currentGen - minGen
  for (const n of nodes.value) {
    const g = (n.generation || 1) - offset
    n.generation = g < 1 ? 1 : g
  }
  applyTreeLayout()
  updateTransform()
}

// 切换应用层
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
// pathRelations 是路径上每条边按 A→B 方向的 link.relation，用于区分父系/母系旁系。
const getKinshipLabel = (genA, genB, nodeA, nodeB, directRelation, pathLen, pathRelations = []) => {
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

  // A 走向共同祖先的最后一步边索引 = stepsUpFromA - 1
  // father-xxx 表示走父系（A 的父辈是父），mother-xxx 表示走母系（A 的父辈是母）
  const aToAncestorRel = pathRelations[stepsUpFromA - 1]
  const isAPaternal = aToAncestorRel && aToAncestorRel.startsWith('father-')
  const isAMaternal = aToAncestorRel && aToAncestorRel.startsWith('mother-')
  // B 走向共同祖先的第一步边索引 = stepsUpFromA（共同祖先 → B 的第一步）
  const bToAncestorRel = pathRelations[stepsUpFromA]
  const isBPaternal = bToAncestorRel && bToAncestorRel.startsWith('father-')
  const isBMaternal = bToAncestorRel && bToAncestorRel.startsWith('mother-')

  // 同代旁系
  if (genDiff === 0) {
    if (stepsUpFromA === 1) return { aToB: genderB ? '姐妹' : '兄弟', bToA: genderA ? '姐妹' : '兄弟' }
    if (stepsUpFromA === 2) return { aToB: genderB ? '堂姐妹' : '堂兄弟', bToA: genderA ? '堂姐妹' : '堂兄弟' }
    return { aToB: '同族同辈', bToA: '同族同辈' }
  }

  // A是长辈（旁系）：A → ancestor → ... → B，B 是 A 的晚辈旁系
  if (aIsElder) {
    if (stepsUpFromB === 1) {
      // B 通过母系连到共同祖先时，B 是 A 的外甥/外甥女（母系旁系晚辈）
      if (isBMaternal) {
        return { aToB: genderB ? '外甥女' : '外甥', bToA: genderA ? '姨母' : '舅父' }
      }
      return { aToB: genderB ? '侄女' : '侄子', bToA: genderA ? '姑母' : '叔伯' }
    }
    if (stepsUpFromB === 2) {
      if (isBMaternal) {
        return { aToB: genderB ? '外甥孙女' : '外甥孙', bToA: genderA ? '姨祖母' : '舅祖父' }
      }
      return { aToB: genderB ? '侄孙女' : '侄孙', bToA: genderA ? '姑祖母' : '叔祖父' }
    }
    return { aToB: '旁系晚辈', bToA: '旁系长辈' }
  }

  // A是晚辈（旁系）：A → ancestor → ... → B，B 是 A 的长辈旁系
  if (stepsUpFromA === 1) {
    // A 通过母系连到共同祖先时，A 的长辈旁系是姨/舅（母系）
    if (isAMaternal) {
      return { aToB: genderB ? '姨母' : '舅父', bToA: genderA ? '外甥女' : '外甥' }
    }
    return { aToB: genderB ? '姑母' : '叔伯', bToA: genderA ? '侄女' : '侄子' }
  }
  if (stepsUpFromA === 2) {
    if (isAMaternal) {
      return { aToB: genderB ? '姨祖母' : '舅祖父', bToA: genderA ? '外甥孙女' : '外甥孙' }
    }
    return { aToB: genderB ? '姑祖母' : '叔祖父', bToA: genderA ? '侄孙女' : '侄孙' }
  }
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

  // 收集路径上每条边按 A→B 方向的关系类型
  const linkMap = new Map(links.value.map(l => [l.id, l]))
  const pathRelations = result.linkIds.map(id => linkMap.get(id)?.relation).filter(Boolean)

  const genDiff = (nodeA.generation || 1) - (nodeB.generation || 1)
  const pathLen = result.nodeIds.length - 1
  const label = getKinshipLabel(
    nodeA.generation || 1,
    nodeB.generation || 1,
    nodeA,
    nodeB,
    directRelation,
    pathLen,
    pathRelations
  )

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
    clampPan()
    const rect = svgCanvas.value.getBoundingClientRect()
    const cx = rect.width / 2 + panX.value
    const cy = rect.height / 2 + panY.value
    svgGroup.value.setAttribute('transform', `translate(${cx}, ${cy}) scale(${zoom.value})`)
  }
}

// ============ 图谱小地图（minimap） ============
// minimap 是一个与画布等比的缩略图，包含节点、关系和当前视口框。
// 视口框在 minimap 上的位置随 panX/panY/zoom 实时更新；
// 用户在 minimap 上点击 / 拖拽视口框，可直接将画布视口平移到对应位置。

const minimapSize = 180 // minimap 边长（viewBox 边长，单位为 minimap 坐标）
const minimapPadding = 10 // 节点包围盒在 minimap 中的内边距
const minimapBounds = computed(() => {
  if (nodes.value.length === 0) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  }
  const xs = nodes.value.map(n => n.x)
  const ys = nodes.value.map(n => n.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  }
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
    out.push({
      id: link.id,
      x1: s.x,
      y1: s.y,
      x2: t.x,
      y2: t.y,
      spouse: link.relation === 'husband-wife'
    })
  }
  return out
})
const viewportRect = computed(() => {
  if (!svgCanvas.value || nodes.value.length === 0) {
    return { x: 0, y: 0, w: minimapSize, h: minimapSize }
  }
  const rect = svgCanvas.value.getBoundingClientRect()
  // 当前画布可见区域在世界坐标下是：
  //   x ∈ [ -rect.width/(2*zoom) - panX/zoom,  rect.width/(2*zoom) - panX/zoom ]
  // 注意 svgGroup 的中心是 (rect.width/2 + panX, rect.height/2 + panY)
  const halfWWorld = rect.width / 2 / zoom.value
  const halfHWorld = rect.height / 2 / zoom.value
  // 中心点对应世界坐标的 ( -panX/zoom, -panY/zoom )
  const cxWorld = -panX.value / zoom.value
  const cyWorld = -panY.value / zoom.value
  const x1World = cxWorld - halfWWorld
  const y1World = cyWorld - halfHWorld
  const x2World = cxWorld + halfWWorld
  const y2World = cyWorld + halfHWorld
  return {
    x: minimapXOf(x1World),
    y: minimapYOf(y1World),
    w: minimapXOf(x2World) - minimapXOf(x1World),
    h: minimapYOf(y2World) - minimapYOf(y1World)
  }
})

// minimap 点击 / 拖拽：把画布视口中心移动到对应位置
const onMinimapMouseDown = (e) => {
  if (!svgCanvas.value || !minimapEl.value) return
  // minimapEl 是 DIV，使用 getBoundingClientRect 拿到实际显示尺寸，再换算到 viewBox 坐标
  const rect = minimapEl.value.getBoundingClientRect()
  const scale = minimapSize / rect.width
  const moveTo = (clientX, clientY) => {
    const mx = (clientX - rect.left) * scale
    const my = (clientY - rect.top) * scale
    // 反推世界坐标
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
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// 计算节点族的可视范围，并把 pan 限制在合理区间内防止视图跑飞。
const clampPan = () => {
  if (!svgCanvas.value || nodes.value.length === 0) return
  const rect = svgCanvas.value.getBoundingClientRect()
  const minX = Math.min(...nodes.value.map(n => n.x))
  const maxX = Math.max(...nodes.value.map(n => n.x))
  const minY = Math.min(...nodes.value.map(n => n.y))
  const maxY = Math.max(...nodes.value.map(n => n.y))
  const contentW = (maxX - minX + 200) * zoom.value
  const contentH = (maxY - minY + 200) * zoom.value
  // 横向：内容宽度大于画布时允许平移，限制在 [-(contentW/2), contentW/2] 之间
  const maxPanX = Math.max(0, (contentW - rect.width) / 2)
  // 纵向：内容高度大于画布时允许平移
  const maxPanY = Math.max(0, (contentH - rect.height) / 2)
  panX.value = Math.max(-maxPanX, Math.min(maxPanX, panX.value))
  panY.value = Math.max(-maxPanY, Math.min(maxPanY, panY.value))
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

// 鼠标滚轮缩放：以鼠标位置为中心，符合主流编辑器习惯
const onWheelZoom = (e) => {
  if (!svgGroup.value || !svgCanvas.value) return
  const rect = svgCanvas.value.getBoundingClientRect()
  // 鼠标相对画布的坐标
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const oldZoom = zoom.value
  // 滚轮向上（deltaY < 0）放大，向下缩小；步进约为每 100px 滚 0.1
  const step = -e.deltaY * 0.001
  let newZoom = oldZoom + step
  newZoom = Math.max(0.3, Math.min(3, newZoom))
  if (newZoom === oldZoom) return
  zoom.value = newZoom
  // 以鼠标为中心缩放：调整 panX/panY，使鼠标下方的世界坐标保持不变
  const oldCx = rect.width / 2 + panX.value
  const oldCy = rect.height / 2 + panY.value
  const ratio = newZoom / oldZoom
  const newCx = mx - (mx - oldCx) * ratio
  const newCy = my - (my - oldCy) * ratio
  panX.value = newCx - rect.width / 2
  panY.value = newCy - rect.height / 2
  // 直接写 transform，不走 updateTransform/clampPan，避免缩放锚点被边界限制挤偏
  svgGroup.value.setAttribute('transform', `translate(${newCx}, ${newCy}) scale(${newZoom})`)
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

// 导出当前族谱为 GEDCOM 5.5.1 文件
const exportGedcom = async () => {
  if (!hasData.value) return
  try {
    statusText.value = '正在导出 GEDCOM…'
    const payload = {
      members: nodes.value.map(n => ({
        id: n.id,
        name: n.name,
        gender: n.gender,
        generation: n.generation
      })),
      relationships: links.value.map(l => ({
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
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
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

// 会话管理：时间格式化
const formatTime = (date) => {
  if (!date) return ''
  const d = new Date(date)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

// 从后端拉取会话列表
const fetchSessions = async () => {
  try {
    const res = await fetch('/api/sessions')
    const json = await res.json()
    if (json.success) {
      sessions.value = json.data || []
    } else {
      console.error('拉取会话列表失败:', json.error)
    }
  } catch (err) {
    console.error('拉取会话列表失败:', err)
  }
}

// 创建新会话并加载
const createNewSession = async () => {
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '未命名族谱' })
    })
    const json = await res.json()
    if (json.success) {
      currentSessionId.value = json.data.id
      currentSessionName.value = json.data.name || '未命名族谱'
      nodes.value = []
      links.value = []
      showUpload.value = true
      statusText.value = '新会话已创建，请上传文档'
      await fetchSessions()
      // 新会话立即触发一次保存占位，随后用户编辑会自动保存
    } else {
      statusText.value = '创建会话失败：' + (json.error?.message || '未知错误')
    }
  } catch (err) {
    console.error('创建会话失败:', err)
    statusText.value = '创建会话失败，请检查后端服务'
  }
}

// 加载指定会话
const loadSession = async (id) => {
  try {
    const res = await fetch(`/api/sessions/${id}`)
    const json = await res.json()
    if (!json.success) {
      statusText.value = '加载会话失败：' + (json.error?.message || '未知错误')
      return
    }
    const data = json.data
    const nodeMap = new Map()
    nodes.value = (data.members || []).map(m => {
      const node = {
        id: m.id,
        name: m.name || '',
        gender: m.gender === 'female' ? 'female' : 'male',
        generation: m.generation || 1,
        birth: m.birth || '',
        death: m.death || '',
        note: m.note || '',
        x: m.x != null ? m.x : 0,
        y: m.y != null ? m.y : 0,
        collapsed: false
      }
      nodeMap.set(node.id, node)
      return node
    })
    links.value = (data.relationships || []).map((r, idx) => {
      const source = nodeMap.get(r.source_id)
      const target = nodeMap.get(r.target_id)
      if (!source || !target) return null
      return {
        id: r.id || `link_${idx}`,
        source,
        target,
        relation: r.relation
      }
    }).filter(l => l !== null)
    currentSessionId.value = data.id
    currentSessionName.value = data.name || '未命名族谱'
    showUpload.value = nodes.value.length === 0
    applyTreeLayout()
    resetZoom()
    pushHistory()
    statusText.value = `已加载「${currentSessionName.value}」`
  } catch (err) {
    console.error('加载会话失败:', err)
    statusText.value = '加载会话失败，请检查后端服务'
  }
}

// 把当前画布数据保存到指定会话
const saveCurrentSessionTo = async (id) => {
  if (!id || nodes.value.length === 0) return
  isSaving.value = true
  try {
    const payload = {
      name: currentSessionName.value || '未命名族谱',
      members: nodes.value.map(n => ({
        id: n.id,
        name: n.name,
        gender: n.gender,
        generation: n.generation,
        birth: n.birth,
        death: n.death,
        note: n.note,
        x: n.x,
        y: n.y
      })),
      relationships: links.value.map(l => ({
        id: l.id,
        source: l.source && l.source.id ? l.source.id : l.source,
        target: l.target && l.target.id ? l.target.id : l.target,
        relation: l.relation
      }))
    }
    const res = await fetch(`/api/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const json = await res.json()
    if (json.success) {
      lastSavedAt.value = new Date()
      statusText.value = '会话已保存'
      await fetchSessions()
    } else {
      statusText.value = '保存会话失败：' + (json.error?.message || '未知错误')
    }
  } catch (err) {
    console.error('保存会话失败:', err)
    statusText.value = '保存会话失败，请检查后端服务'
  } finally {
    isSaving.value = false
  }
}

// 保存当前会话（使用 currentSessionId）
const saveCurrentSession = () => {
  if (!currentSessionId.value) return
  return saveCurrentSessionTo(currentSessionId.value)
}

// 删除会话
const deleteSession = async (id) => {
  const session = sessions.value.find(s => s.id === id)
  confirmDialog.value = {
    title: '确认删除会话',
    message: `确定要删除会话「${session ? session.name : id}」吗？该会话下的所有数据将被永久删除。`,
    confirmText: '删除',
    danger: true,
    onConfirm: async () => {
      try {
        const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
        const json = await res.json()
        if (json.success) {
          if (currentSessionId.value === id) {
            currentSessionId.value = null
            currentSessionName.value = ''
            nodes.value = []
            links.value = []
            showUpload.value = true
            statusText.value = '等待上传文档'
          }
          await fetchSessions()
        } else {
          statusText.value = '删除会话失败：' + (json.error?.message || '未知错误')
        }
      } catch (err) {
        console.error('删除会话失败:', err)
        statusText.value = '删除会话失败，请检查后端服务'
      } finally {
        confirmDialog.value = null
      }
    }
  }
}

// 开始重命名会话
const startRenameSession = (session) => {
  editingSessionId.value = session.id
  sessionNameInput.value = session.name
  renameSessionOriginalName = session.name
  nextTick(() => {
    sessionNameInputRef.value && sessionNameInputRef.value.focus()
  })
}

// 确认重命名
const commitRenameSession = async () => {
  const id = editingSessionId.value
  if (!id) return
  const newName = sessionNameInput.value.trim() || '未命名族谱'
  const session = sessions.value.find(s => s.id === id)
  if (session && session.name === newName) {
    editingSessionId.value = null
    return
  }
  try {
    const res = await fetch(`/api/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    })
    const json = await res.json()
    if (json.success) {
      if (currentSessionId.value === id) {
        currentSessionName.value = newName
      }
      await fetchSessions()
    } else {
      statusText.value = '重命名失败：' + (json.error?.message || '未知错误')
    }
  } catch (err) {
    console.error('重命名会话失败:', err)
    statusText.value = '重命名失败，请检查后端服务'
  } finally {
    editingSessionId.value = null
  }
}

// 取消重命名
const cancelRenameSession = () => {
  const id = editingSessionId.value
  if (!id) return
  const session = sessions.value.find(s => s.id === id)
  if (session) {
    session.name = renameSessionOriginalName
  }
  editingSessionId.value = null
  sessionNameInput.value = ''
}

// 自动保存：防抖 2s
let autoSaveTimer = null
const scheduleAutoSave = () => {
  if (!autoSaveEnabled.value || !currentSessionId.value || nodes.value.length === 0) return
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    saveCurrentSession()
  }, 2000)
}

// 监听节点/关系变化，触发自动保存
watch([nodes, links], () => {
  scheduleAutoSave()
}, { deep: true })

// 监听自动保存开关，持久化到 localStorage
watch(autoSaveEnabled, (val) => {
  localStorage.setItem('genealogy_autosave', String(val))
  if (val) scheduleAutoSave()
})

// 键盘快捷键处理。
const handleKeyboard = (e) => {
  // 输入框 / 文本域 / 弹窗输入元素内不触发快捷键（避免与文本编辑冲突）
  const tag = (e.target && e.target.tagName) || ''
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
  if (e.isComposing) return

  // Ctrl+K / Cmd+K：打开搜索
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault()
    if (hasData.value) openSearch()
    return
  }
  // Ctrl+Z / Cmd+Z：撤销
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
    e.preventDefault()
    undo()
    return
  }
  // Ctrl+Y / Ctrl+Shift+Z：重做
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
    e.preventDefault()
    redo()
    return
  }
  // 其它带 Ctrl/Meta / Alt 的组合键交给系统
  if (e.ctrlKey || e.metaKey || e.altKey) return

  // F：打开搜索
  if (e.key === 'f' || e.key === 'F') {
    if (hasData.value) openSearch()
    return
  }
  // ?：显示帮助
  if (e.key === '?' || (e.shiftKey && e.key === '/')) {
    e.preventDefault()
    showHelp()
    return
  }
  // Esc：关闭弹窗 / 取消焦点
  if (e.key === 'Escape') {
    if (showSearchModal.value) { closeSearch(); return }
    if (showHelpModal.value) { closeHelp(); return }
    if (showSettings.value) { closeSettings(); return }
    if (showNodeEdit.value) { closeNodeEdit(); return }
    if (focusedNodeId.value) { focusedNodeId.value = null; return }
  }
  // Delete：删除聚焦节点
  if (e.key === 'Delete' || e.key === 'Del') {
    if (focusedNodeId.value) {
      e.preventDefault()
      const n = nodes.value.find(x => x.id === focusedNodeId.value)
      if (n) deleteNode(n)
    }
    return
  }
  // 缩放 / 重置
  if (e.key === '+' || e.key === '=') {
    e.preventDefault()
    zoomIn()
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault()
    zoomOut()
  } else if (e.key === '0') {
    e.preventDefault()
    resetZoom()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyboard)
  fetchSessions()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyboard)
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
})

watch(() => canvasContainer.value, () => {
  if (canvasContainer.value) {
    setTimeout(updateTransform, 100)
  }
})

// 主题变化时同步到 <html>
watch(theme, () => applyTheme())

// 右键菜单：点击外部关闭
const onDocumentMouseDownForContext = (e) => {
  if (!contextMenu.value.show) return
  const menuEl = document.querySelector('.context-menu')
  if (menuEl && !menuEl.contains(e.target)) {
    closeContextMenu()
  }
}
onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDownForContext)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDownForContext)
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

.btn-sm {
  height: 30px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
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

.btn-icon-sm {
  width: 26px;
  height: 26px;
  padding: 0;
  display: inline-grid;
  place-items: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--muted-ink);
  cursor: pointer;
  font-size: 13px;
}

.btn-icon-sm:hover:not(:disabled) {
  background: var(--soft, #f5efe2);
  color: var(--ink);
}

.btn-icon-sm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-icon-sm.danger:hover {
  background: rgba(176, 53, 53, 0.12);
  color: #b53535;
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

/* AI 服务来源徽章 */
.provider-badge {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;
  user-select: none;
  letter-spacing: 0.02em;
}

.provider-badge.tone-cloud {
  background: rgba(36, 130, 230, 0.12);
  color: #2482e6;
  border-color: rgba(36, 130, 230, 0.32);
}

.provider-badge.tone-local {
  background: rgba(56, 161, 105, 0.14);
  color: #2f855a;
  border-color: rgba(56, 161, 105, 0.32);
}

.provider-badge.tone-fallback {
  background: rgba(221, 107, 32, 0.14);
  color: #c05621;
  border-color: rgba(221, 107, 32, 0.4);
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

/* 折叠/展开角标 */
.collapse-badge {
  cursor: pointer;
  transform: translate(28px, -28px);
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
  font-size: 14px;
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
.genealogy-canvas .node.dimmed circle,
.genealogy-canvas .node.dimmed text {
  opacity: 0.18;
  transition: opacity 0.18s ease;
}
.genealogy-canvas .node.dimmed .collapse-badge {
  opacity: 0.18;
}
.genealogy-canvas .node.focused circle {
  stroke: #f5a623;
  stroke-width: 5;
  filter: drop-shadow(0 0 6px rgba(245, 166, 35, 0.7));
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

.dropzone-icon {
  font-size: 42px;
  color: var(--seal);
  line-height: 1;
}

@keyframes dropzone-pulse {
  from { background: rgba(122, 39, 27, 0.06); }
  to { background: rgba(122, 39, 27, 0.14); }
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
[data-theme="dark"] .node circle {
  filter: brightness(0.95) saturate(0.9);
}
[data-theme="dark"] .genealogy-canvas .node text {
  fill: var(--ink);
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
</style>
