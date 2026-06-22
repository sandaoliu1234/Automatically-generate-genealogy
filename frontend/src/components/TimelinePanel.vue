<template>
  <transition name="slide-in">
    <aside v-if="tl.isOpen.value" class="timeline-drawer" role="complementary" aria-label="时间线视图">
      <!-- 头部 -->
      <header class="detail-header">
        <p class="section-label">时间线 · 姓氏统计</p>
        <button class="modal-close" @click="tl.closeTimeline" aria-label="关闭">×</button>
      </header>

      <!-- 顶部：姓氏统计条 -->
      <section v-if="tl.surnameStats.value.length" class="surname-bar">
        <p class="surname-bar-title">
          <span>姓氏分布 (Top {{ tl.surnameStats.value.length }})</span>
          <button v-if="tl.surnameFilter.value" class="surname-bar-clear" @click="tl.clearSurnameFilter">
            清除筛选
          </button>
        </p>
        <div class="surname-bar-list">
          <button
            v-for="s in tl.surnameStats.value"
            :key="s.surname"
            class="surname-bar-row"
            :class="{ active: tl.surnameFilter.value === s.surname }"
            @click="onSurnameClick(s.surname)"
            :title="`点击筛选 ${s.surname} 姓，共 ${s.count} 人`"
          >
            <span class="surname-bar-char">{{ s.surname }}</span>
            <span class="surname-bar-track">
              <span class="surname-bar-fill" :style="{ width: s.percent + '%' }"></span>
            </span>
            <span class="surname-bar-count">{{ s.count }}</span>
          </button>
        </div>
      </section>

      <!-- 中部：视图切换 Tab + 搜索 -->
      <div class="timeline-tabs">
        <button
          class="timeline-tab"
          :class="{ active: tl.viewMode.value === 'birth' }"
          @click="tl.setViewMode('birth')"
        >按出生年份</button>
        <button
          class="timeline-tab"
          :class="{ active: tl.viewMode.value === 'generation' }"
          @click="tl.setViewMode('generation')"
        >按代际</button>
        <input
          class="timeline-search"
          type="text"
          placeholder="搜索姓名…"
          :value="tl.searchKeyword.value"
          @input="onSearchInput"
        />
      </div>

      <!-- 主体：时间线 -->
      <div class="timeline-body" ref="bodyRef">
        <!-- 空状态 -->
        <div v-if="tl.filteredNodes.value.length === 0" class="timeline-empty">
          <div class="timeline-empty-icon">⏳</div>
          <p v-if="tl.totalWithYear.value === 0">
            暂无出生年份信息的人物<br/>
            <span style="font-size:11px;opacity:0.7">（缺失生卒年份的人物已忽略）</span>
          </p>
          <p v-else>当前筛选条件下无匹配人物</p>
        </div>

        <!-- 年代刻度尺 -->
        <div v-else class="timeline-axis" ref="axisRef">
          <div class="timeline-axis-track" :style="{ width: trackWidth + 'px' }">
            <template v-for="tick in ticks" :key="tick.year">
              <div
                class="timeline-tick"
                :class="{ major: tick.major }"
                :style="{ left: tick.left + 'px' }"
              ></div>
              <div
                v-if="tick.major"
                class="timeline-tick-label"
                :style="{ left: tick.left + 'px' }"
              >{{ tick.year }}</div>
            </template>
            <div
              v-if="tl.hoveredYear.value != null"
              class="timeline-hover-year"
              :style="{ left: hoverLeft + 'px' }"
            >{{ tl.hoveredYear.value }}</div>
          </div>
        </div>

        <!-- 泳道 -->
        <div v-if="tl.filteredNodes.value.length" class="timeline-lanes">
          <div
            v-for="lane in tl.currentLanes.value"
            :key="lane.label"
            class="timeline-lane"
          >
            <div class="timeline-lane-label">{{ lane.label }}</div>
            <div
              class="timeline-lane-track"
              :style="{ width: trackWidth + 'px' }"
              @mousemove="onLaneMove($event, lane)"
              @mouseleave="onLaneLeave"
            >
              <div
                v-for="n in lane.nodes"
                :key="n.id"
                class="timeline-person"
                :style="personStyle(n)"
                @click="onPersonClick(n, $event)"
                @mousemove.stop="onPersonHover(n, $event)"
                @mouseleave="onPersonLeave"
                :title="`${n.name} (${n.birthYear}${n.deathYear ? '-' + n.deathYear : ''})`"
              >
                <span
                  class="timeline-person-birth"
                  :class="genderClass(n)"
                ></span>
                <span
                  v-if="n.deathYear != null"
                  class="timeline-person-life"
                ></span>
                <span
                  v-if="n.deathYear != null"
                  class="timeline-person-death"
                  :class="genderClass(n)"
                ></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部：缩放控制 -->
      <div class="timeline-zoom" v-if="tl.filteredNodes.value.length">
        <button class="timeline-zoom-btn" @click="tl.zoomOut" aria-label="缩小">−</button>
        <span class="timeline-zoom-label">{{ tl.zoom.value.toFixed(1) }}×</span>
        <button class="timeline-zoom-btn" @click="tl.zoomIn" aria-label="放大">+</button>
        <span class="timeline-count">共 {{ tl.filteredCount.value }} 人</span>
      </div>

      <!-- Tooltip -->
      <div
        v-if="tooltip.visible"
        class="timeline-tooltip"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        <div class="timeline-tooltip-name">{{ tooltip.name }}</div>
        <div class="timeline-tooltip-meta">
          {{ tooltip.gender }} · {{ tooltip.gen }} · {{ tooltip.years }}
        </div>
      </div>
    </aside>
  </transition>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useTimeline } from '../composables/useTimeline'
import { useNodeDetail } from '../composables/useNodeDetail'

const tl = useTimeline()
const detail = useNodeDetail()

// 容器宽度（响应式）
const bodyRef = ref(null)
const axisRef = ref(null)
const containerWidth = ref(360)

const updateWidth = () => {
  if (bodyRef.value) {
    containerWidth.value = bodyRef.value.clientWidth - 28 // 减去 padding
  }
}

onMounted(() => {
  updateWidth()
  window.addEventListener('resize', updateWidth)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateWidth)
})

// 时间线总宽度 = 容器宽度 × 缩放
const trackWidth = computed(() => {
  return Math.max(containerWidth.value, 200) * tl.zoom.value
})

// 把 year 映射到 px
function yearToPx(year) {
  const { min, max } = tl.yearRange.value
  const span = max - min
  if (span <= 0) return 0
  return ((year - min) / span) * trackWidth.value
}

// 人物位置样式
function personStyle(node) {
  const left = yearToPx(node.birthYear)
  if (node.deathYear != null) {
    const right = yearToPx(node.deathYear)
    const width = Math.max(8, right - left)
    return { left: left + 'px', width: width + 'px' }
  }
  return { left: left + 'px', width: '12px' }
}

function genderClass(n) {
  if (n.gender === 'female') return 'female'
  if (n.gender === 'male') return 'male'
  return 'unknown'
}

// 年代刻度（每 5 年一个小刻度，每 25 年一个主刻度）
const ticks = computed(() => {
  const { min, max } = tl.yearRange.value
  if (min >= max) return []
  const arr = []
  const majorStep = pickStep(max - min)
  const minorStep = Math.max(1, Math.floor(majorStep / 5))
  for (let y = Math.floor(min / minorStep) * minorStep; y <= max; y += minorStep) {
    if (y < min) continue
    const left = yearToPx(y)
    const major = y % majorStep === 0
    arr.push({ year: y, left, major })
  }
  return arr
})

// 根据跨度选择刻度步长
function pickStep(span) {
  if (span <= 30) return 5
  if (span <= 80) return 10
  if (span <= 200) return 25
  if (span <= 500) return 50
  return 100
}

// 鼠标悬停显示年代
const hoverLeft = ref(0)
function onLaneMove(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - rect.left
  const ratio = Math.max(0, Math.min(1, x / trackWidth.value))
  const { min, max } = tl.yearRange.value
  const year = Math.round(min + ratio * (max - min))
  tl.hoveredYear.value = year
  hoverLeft.value = x
}

function onLaneLeave() {
  tl.hoveredYear.value = null
}

// 人物 tooltip
const tooltip = ref({ visible: false, x: 0, y: 0, name: '', gender: '', gen: '', years: '' })

function onPersonHover(n, e) {
  const genderText = n.gender === 'female' ? '女' : n.gender === 'male' ? '男' : '未知'
  const years = n.deathYear != null ? `${n.birthYear} - ${n.deathYear}` : `${n.birthYear} -`
  tooltip.value = {
    visible: true,
    x: e.clientX + 12,
    y: e.clientY + 12,
    name: n.name,
    gender: genderText,
    gen: `第 ${n.generation || 1} 代`,
    years
  }
}

function onPersonLeave() {
  tooltip.value.visible = false
}

// 点击人物 → 打开详情（关闭时间线）
function onPersonClick(node) {
  tl.closeTimeline()
  detail.openNodeDetail(node)
}

// 姓氏点击切换
function onSurnameClick(surname) {
  if (tl.surnameFilter.value === surname) {
    tl.clearSurnameFilter()
  } else {
    tl.setSurnameFilter(surname)
  }
}

// 搜索框
function onSearchInput(e) {
  tl.setSearchKeyword(e.target.value)
}
</script>
