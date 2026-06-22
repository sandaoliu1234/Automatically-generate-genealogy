import { ref, computed } from 'vue'
import { useGenealogyCore } from './useGenealogyCore'

// 从 birth/death 字符串中提取 4 位年份
// 支持 "1920"、"1920-01-01"、"约1920"、"1920年" 等格式
function extractYear(s) {
  if (!s) return null
  const m = String(s).match(/(\d{4})/)
  if (!m) return null
  const y = parseInt(m[1], 10)
  if (y < 1000 || y > 3000) return null
  return y
}

// 推断姓氏：取 name 第一个字符（中文姓氏通常为首字）
function inferSurname(name) {
  if (!name) return '未知'
  const s = String(name).trim()
  if (s.length === 0) return '未知'
  return s.charAt(0)
}

// ─── 模块级共享状态（单例模式，与 useNodeDetail 保持一致） ───
// 与详情卡片的互斥逻辑由 App.vue 统一管理
const isOpen = ref(false)
const viewMode = ref('birth') // 'birth' | 'generation'
const surnameFilter = ref(null) // null = 全部
const searchKeyword = ref('')
const zoom = ref(1)
const hoveredYear = ref(null)

export function useTimeline() {
  const core = useGenealogyCore()
  const { nodes } = core

  // 姓氏统计（按数量降序，取前 12）
  const surnameStats = computed(() => {
    const map = new Map()
    for (const n of nodes.value) {
      const s = inferSurname(n.name)
      map.set(s, (map.get(s) || 0) + 1)
    }
    const total = nodes.value.length || 1
    return [...map.entries()]
      .map(([surname, count]) => ({
        surname,
        count,
        percent: (count / total) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  })

  // 带年份解析的人物列表（缺失年份的会被排除，由 UI 决定是否显示）
  const nodesWithYears = computed(() => {
    return nodes.value
      .map(n => ({
        ...n,
        birthYear: extractYear(n.birth),
        deathYear: extractYear(n.death),
        surname: inferSurname(n.name)
      }))
      .filter(n => n.birthYear != null) // 设计决策：忽略缺失出生年份
  })

  // 应用筛选：姓氏 + 搜索
  const filteredNodes = computed(() => {
    let arr = nodesWithYears.value
    if (surnameFilter.value) {
      arr = arr.filter(n => n.surname === surnameFilter.value)
    }
    if (searchKeyword.value && searchKeyword.value.trim()) {
      const q = searchKeyword.value.trim()
      arr = arr.filter(n => n.name && n.name.includes(q))
    }
    return arr
  })

  // 年份范围（用于横向时间轴）
  const yearRange = computed(() => {
    if (filteredNodes.value.length === 0) {
      const now = new Date().getFullYear()
      return { min: now - 100, max: now }
    }
    let min = Infinity, max = -Infinity
    for (const n of filteredNodes.value) {
      if (n.birthYear < min) min = n.birthYear
      if (n.birthYear > max) max = n.birthYear
      if (n.deathYear != null && n.deathYear > max) max = n.deathYear
    }
    // 留 5 年边距
    min = Math.floor((min - 5) / 10) * 10
    max = Math.ceil((max + 5) / 10) * 10
    return { min, max }
  })

  // 按代际分组（用于代际视图泳道）
  const generationLanes = computed(() => {
    if (filteredNodes.value.length === 0) return []
    const map = new Map()
    for (const n of filteredNodes.value) {
      const g = n.generation || 1
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(n)
    }
    return [...map.entries()]
      .map(([gen, list]) => ({
        gen,
        label: `第 ${gen} 代`,
        nodes: list.sort((a, b) => a.birthYear - b.birthYear)
      }))
      .sort((a, b) => a.gen - b.gen)
  })

  // 按姓氏分组（用于姓氏泳道 / 仅在按出生年份模式下作为泳道）
  const surnameLanes = computed(() => {
    const top = surnameStats.value.slice(0, 8).map(s => s.surname)
    const lanes = top.map(surname => ({
      surname,
      label: surname,
      nodes: filteredNodes.value
        .filter(n => n.surname === surname)
        .sort((a, b) => a.birthYear - b.birthYear)
    }))
    const others = filteredNodes.value.filter(n => !top.includes(n.surname))
    if (others.length > 0) {
      lanes.push({
        surname: '__other__',
        label: '其他',
        nodes: others.sort((a, b) => a.birthYear - b.birthYear)
      })
    }
    return lanes
  })

  // 当前视图的泳道
  const currentLanes = computed(() => {
    if (viewMode.value === 'generation') return generationLanes.value
    return surnameLanes.value
  })

  // 总人数（带年份的）
  const totalWithYear = computed(() => nodesWithYears.value.length)
  const filteredCount = computed(() => filteredNodes.value.length)

  // ─── 操作 ───
  const openTimeline = () => { isOpen.value = true }
  const closeTimeline = () => { isOpen.value = false }
  const toggleTimeline = () => { isOpen.value = !isOpen.value }

  const setViewMode = (mode) => {
    if (mode === 'birth' || mode === 'generation') viewMode.value = mode
  }

  const setSurnameFilter = (surname) => {
    surnameFilter.value = surname
  }

  const clearSurnameFilter = () => {
    surnameFilter.value = null
  }

  const setSearchKeyword = (q) => {
    searchKeyword.value = q
  }

  const setZoom = (z) => {
    zoom.value = Math.max(0.5, Math.min(8, z))
  }

  const zoomIn = () => setZoom(zoom.value * 1.25)
  const zoomOut = () => setZoom(zoom.value / 1.25)

  return {
    // 状态
    isOpen, viewMode, surnameFilter, searchKeyword, zoom, hoveredYear,
    // 数据
    nodes, surnameStats, filteredNodes, yearRange,
    generationLanes, surnameLanes, currentLanes,
    totalWithYear, filteredCount,
    // 操作
    openTimeline, closeTimeline, toggleTimeline,
    setViewMode, setSurnameFilter, clearSurnameFilter,
    setSearchKeyword, setZoom, zoomIn, zoomOut,
  }
}
