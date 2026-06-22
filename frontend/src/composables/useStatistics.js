import { computed } from 'vue'
import { useGenealogyCore } from './useGenealogyCore'

export function useStatistics() {
  const { nodes } = useGenealogyCore()

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
      male, female,
      malePercent: total === 0 ? 0 : (male / total) * 100,
      femalePercent: total === 0 ? 0 : (female / total) * 100
    }
  })

  const circumference = computed(() => 2 * Math.PI * 24)
  const maleDash = computed(() => (genderStats.value.malePercent / 100) * circumference.value)

  return {
    generationStats, totalMembers, maxGen, generationBarWidth,
    genderStats, circumference, maleDash,
  }
}
