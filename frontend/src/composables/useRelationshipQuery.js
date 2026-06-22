import { ref } from 'vue'
import { useGenealogyCore } from './useGenealogyCore'

const queryPersonA = ref('')
const queryPersonB = ref('')
const queryResult = ref(null)

// 关系称谓映射表
const RELATION_LABELS = {
  'father-son': '父子',
  'mother-son': '母子',
  'father-daughter': '父女',
  'mother-daughter': '母女',
  'husband-wife': '夫妻'
}

/** 根据代际差和路径形状计算双向关系称谓 */
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
    return aIsElder ? { aToB: '后裔', bToA: '先祖' } : { aToB: '先祖', bToA: '后裔' }
  }

  const stepsUpFromA = (pathLen + genDiff) / 2
  const stepsUpFromB = (pathLen - genDiff) / 2
  const aToAncestorRel = pathRelations[stepsUpFromA - 1]
  const isAPaternal = aToAncestorRel && aToAncestorRel.startsWith('father-')
  const isAMaternal = aToAncestorRel && aToAncestorRel.startsWith('mother-')
  const bToAncestorRel = pathRelations[stepsUpFromA]
  const isBMaternal = bToAncestorRel && bToAncestorRel.startsWith('mother-')

  if (genDiff === 0) {
    if (stepsUpFromA === 1) return { aToB: genderB ? '姐妹' : '兄弟', bToA: genderA ? '姐妹' : '兄弟' }
    if (stepsUpFromA === 2) return { aToB: genderB ? '堂姐妹' : '堂兄弟', bToA: genderA ? '堂姐妹' : '堂兄弟' }
    return { aToB: '同族同辈', bToA: '同族同辈' }
  }

  if (aIsElder) {
    if (stepsUpFromB === 1) {
      if (isBMaternal) return { aToB: genderB ? '外甥女' : '外甥', bToA: genderA ? '姨母' : '舅父' }
      return { aToB: genderB ? '侄女' : '侄子', bToA: genderA ? '姑母' : '叔伯' }
    }
    if (stepsUpFromB === 2) {
      if (isBMaternal) return { aToB: genderB ? '外甥孙女' : '外甥孙', bToA: genderA ? '姨祖母' : '舅祖父' }
      return { aToB: genderB ? '侄孙女' : '侄孙', bToA: genderA ? '姑祖母' : '叔祖父' }
    }
    return { aToB: '旁系晚辈', bToA: '旁系长辈' }
  }

  if (stepsUpFromA === 1) {
    if (isAMaternal) return { aToB: genderB ? '姨母' : '舅父', bToA: genderA ? '外甥女' : '外甥' }
    return { aToB: genderB ? '姑母' : '叔伯', bToA: genderA ? '侄女' : '侄子' }
  }
  if (stepsUpFromA === 2) {
    if (isAMaternal) return { aToB: genderB ? '姨祖母' : '舅祖父', bToA: genderA ? '外甥孙女' : '外甥孙' }
    return { aToB: genderB ? '姑祖母' : '叔祖父', bToA: genderA ? '侄孙女' : '侄孙' }
  }
  return { aToB: '旁系长辈', bToA: '旁系晚辈' }
}

/** BFS 最短路径 */
const findPath = (startId, endId, linksVal) => {
  const adjacency = new Map()
  linksVal.forEach(link => {
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
      if (neighbor === endId) return { nodeIds: [...nodeIds, endId], linkIds: [...linkIds, linkId] }
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push({ nodeId: neighbor, nodeIds: [...nodeIds, neighbor], linkIds: [...linkIds, linkId] })
      }
    }
  }
  return null
}

export function useRelationshipQuery() {
  const { nodes, links, highlightedNodes, highlightedLinks } = useGenealogyCore()

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

    const result = findPath(nodeA.id, nodeB.id, links.value)
    if (!result) {
      queryResult.value = { found: false, relation: '无关联', description: `${nodeA.name} 和 ${nodeB.name} 之间没有找到关系路径` }
      return
    }

    const directLink = links.value.find(l => result.linkIds.includes(l.id) &&
      ((l.source.id === nodeA.id && l.target.id === nodeB.id) ||
       (l.source.id === nodeB.id && l.target.id === nodeA.id)))
    const directRelation = directLink ? directLink.relation : null
    const linkMap = new Map(links.value.map(l => [l.id, l]))
    const pathRelations = result.linkIds.map(id => linkMap.get(id)?.relation).filter(Boolean)

    const label = getKinshipLabel(
      nodeA.generation || 1, nodeB.generation || 1,
      nodeA, nodeB, directRelation, result.nodeIds.length - 1, pathRelations
    )

    const intermediateCount = result.nodeIds.length - 2
    let desc = `${nodeA.name} → ${nodeB.name}`
    if (intermediateCount > 0) {
      const intermediates = result.nodeIds.slice(1, -1).map(id => {
        const n = nodes.value.find(nd => nd.id === id)
        return n ? n.name : '?'
      })
      desc = `${nodeA.name} → ${intermediates.join(' → ')} → ${nodeB.name}`
    }
    desc += `（${Math.abs((nodeA.generation || 1) - (nodeB.generation || 1))} 代差）`

    highlightedNodes.value = [...result.nodeIds]
    highlightedLinks.value = [...result.linkIds]
    queryResult.value = { found: true, relation: label, description: desc, nameA: nodeA.name, nameB: nodeB.name }
  }

  return {
    queryPersonA, queryPersonB, queryResult,
    queryRelationship, RELATION_LABELS,
  }
}
