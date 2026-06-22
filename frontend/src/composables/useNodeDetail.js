import { ref, computed } from 'vue'
import { useGenealogyCore } from './useGenealogyCore'

// 人物详情卡片（单击节点打开）
// 节点关系查找：复用 core 的 collectAncestors/Descendants/Spouses，
// 自己实现 siblings（共同父母节点的兄弟姊妹）

const detailNodeId = ref(null)

export function useNodeDetail() {
  const core = useGenealogyCore()
  const { nodes, links } = core

  const isDetailOpen = computed(() => detailNodeId.value != null)

  const detailNode = computed(() => {
    if (!detailNodeId.value) return null
    return nodes.value.find(n => n.id === detailNodeId.value) || null
  })

  // 父亲：来源是该节点的 father-son/father-daughter
  const detailFather = computed(() => {
    const n = detailNode.value
    if (!n) return null
    for (const l of links.value) {
      if (l.target && l.target.id === n.id && (l.relation === 'father-son' || l.relation === 'father-daughter')) {
        return l.source
      }
    }
    return null
  })

  // 母亲：来源是该节点的 mother-son/mother-daughter
  const detailMother = computed(() => {
    const n = detailNode.value
    if (!n) return null
    for (const l of links.value) {
      if (l.target && l.target.id === n.id && (l.relation === 'mother-son' || l.relation === 'mother-daughter')) {
        return l.source
      }
    }
    return null
  })

  // 配偶：husband-wife 双向
  const detailSpouses = computed(() => {
    const n = detailNode.value
    if (!n) return []
    const set = new Set()
    const list = []
    for (const l of links.value) {
      if (l.relation !== 'husband-wife') continue
      if (l.source && l.source.id === n.id && !set.has(l.target.id)) {
        set.add(l.target.id); list.push(l.target)
      } else if (l.target && l.target.id === n.id && !set.has(l.source.id)) {
        set.add(l.source.id); list.push(l.source)
      }
    }
    return list
  })

  // 子女：target 是该节点的 parent-xxx
  const detailChildren = computed(() => {
    const n = detailNode.value
    if (!n) return []
    const list = []
    for (const l of links.value) {
      if (l.source && l.source.id === n.id && /^(father|mother)-(son|daughter)$/.test(l.relation)) {
        list.push(l.target)
      }
    }
    return list
  })

  // 兄弟姐妹：找父亲/母亲，再找该父母的其他子女
  const detailSiblings = computed(() => {
    const n = detailNode.value
    if (!n) return []
    const parentIds = [detailFather.value?.id, detailMother.value?.id].filter(Boolean)
    if (parentIds.length === 0) return []
    const set = new Set([n.id])
    const list = []
    for (const l of links.value) {
      if (!l.target) continue
      if (!/^(father|mother)-(son|daughter)$/.test(l.relation)) continue
      if (l.target.id === n.id) continue
      if (parentIds.includes(l.source.id) && !set.has(l.target.id)) {
        set.add(l.target.id); list.push(l.target)
      }
    }
    return list
  })

  const openNodeDetail = (node) => {
    if (!node) return
    detailNodeId.value = node.id
  }

  const closeNodeDetail = () => {
    detailNodeId.value = null
  }

  // 点击详情里某个人名 → 切换到那个人的详情
  const navigateToNode = (node) => {
    if (node && node.id) detailNodeId.value = node.id
  }

  return {
    detailNodeId, isDetailOpen, detailNode,
    detailFather, detailMother, detailSpouses, detailChildren, detailSiblings,
    openNodeDetail, closeNodeDetail, navigateToNode,
  }
}
