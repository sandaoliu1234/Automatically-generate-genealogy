import { ref } from 'vue'
import { useGenealogyCore } from './useGenealogyCore'
import { useHistory } from './useHistory'

const showNodeEdit = ref(false)
const editingNode = ref({})
const contextMenu = ref({ show: false, x: 0, y: 0, node: null })

export function useNodeOperations() {
  const core = useGenealogyCore()
  const { nodes, links, applyTreeLayout, updateTransform } = core
  const { pushHistory } = useHistory()

  const newNodeId = (prefix = 'node') => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`

  // ============ 节点编辑 ============

  const editNode = (node) => {
    editingNode.value = { birth: '', death: '', note: '', avatar: '', ...node }
    showNodeEdit.value = true
  }

  const closeNodeEdit = () => {
    showNodeEdit.value = false
    editingNode.value = {}
  }

  const saveNodeEdit = () => {
    pushHistory()
    const index = nodes.value.findIndex(n => n.id === editingNode.value.id)
    if (index !== -1) nodes.value[index] = { ...editingNode.value }
    closeNodeEdit()
  }

  const deleteNode = (node) => {
    core.confirmDialog.value = {
      title: '确认删除',
      message: `确定要删除成员「${node.name}」吗？相关连线也会一并移除。`,
      confirmText: '删除',
      danger: true,
      onConfirm: () => {
        pushHistory()
        nodes.value = nodes.value.filter(n => n.id !== node.id)
        links.value = links.value.filter(l => l.source.id !== node.id && l.target.id !== node.id)
        closeNodeEdit()
        core.confirmDialog.value = null
      }
    }
  }

  // ============ 右键菜单 ============

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

  const contextEditNode = () => {
    const node = contextMenu.value.node
    closeContextMenu()
    if (node) editNode(node)
  }

  const contextAddChild = (gender) => {
    const node = contextMenu.value.node
    closeContextMenu()
    if (!node) return
    pushHistory()
    const id = newNodeId('node')
    let parentRel
    if (node.gender === 'female') {
      parentRel = gender === 'male' ? 'mother-son' : 'mother-daughter'
    } else {
      parentRel = gender === 'male' ? 'father-son' : 'father-daughter'
    }
    const newNode = {
      id, name: '新成员', gender,
      generation: (node.generation || 1) + 1,
      x: node.x + 80, y: node.y + 120, collapsed: false
    }
    nodes.value.push(newNode)
    links.value.push({ id: newNodeId('link'), source: node, target: newNode, relation: parentRel })
  }

  const contextAddSpouse = () => {
    const node = contextMenu.value.node
    closeContextMenu()
    if (!node) return
    pushHistory()
    const newNode = {
      id: newNodeId('node'), name: '新配偶',
      gender: node.gender === 'female' ? 'male' : 'female',
      generation: node.generation || 1,
      x: node.x + 100, y: node.y, collapsed: false
    }
    nodes.value.push(newNode)
    links.value.push({ id: newNodeId('link'), source: node, target: newNode, relation: 'husband-wife' })
  }

  const contextAddParent = (which) => {
    const node = contextMenu.value.node
    closeContextMenu()
    if (!node) return
    pushHistory()
    const newNode = {
      id: newNodeId('node'), name: which === 'father' ? '父亲' : '母亲', gender: which,
      generation: Math.max(1, (node.generation || 1) - 1),
      x: node.x - 80, y: node.y - 120, collapsed: false
    }
    nodes.value.push(newNode)
    const rel = which === 'father'
      ? (node.gender === 'female' ? 'father-daughter' : 'father-son')
      : (node.gender === 'female' ? 'mother-daughter' : 'mother-son')
    links.value.push({ id: newNodeId('link'), source: newNode, target: node, relation: rel })
  }

  const contextDeleteNode = () => {
    const node = contextMenu.value.node
    closeContextMenu()
    if (node) deleteNode(node)
  }

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

  /** 切换节点折叠/展开状态 */
  const toggleCollapse = (node) => {
    const target = nodes.value.find(n => n.id === node.id)
    if (!target) return
    const set = new Set()
    core.collectDescendants(node.id, set)
    if (set.size === 0) return
    target.collapsed = !target.collapsed
    pushHistory()
  }

  return {
    showNodeEdit, editingNode, contextMenu,
    editNode, closeNodeEdit, saveNodeEdit, deleteNode,
    openContextMenu, closeContextMenu,
    contextEditNode, contextAddChild, contextAddSpouse, contextAddParent,
    contextDeleteNode, setAsRootNode,
    toggleCollapse, newNodeId,
  }
}
