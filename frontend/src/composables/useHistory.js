import { ref, computed } from 'vue'
import { useGenealogyCore } from './useGenealogyCore'

const history = ref([])
const historyIndex = ref(-1)
const MAX_HISTORY = 30

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

export function useHistory() {
  const { nodes, links, updateTransform } = useGenealogyCore()

  /** 保存当前状态到历史栈 */
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

  /** 从历史栈恢复指定索引的状态 */
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

  /** 清空历史 */
  const clearHistory = () => {
    history.value = []
    historyIndex.value = -1
  }

  return {
    history, historyIndex,
    canUndo, canRedo,
    pushHistory, restoreHistory,
    undo, redo, clearHistory,
  }
}
