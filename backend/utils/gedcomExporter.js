// GEDCOM 5.5.1 导出工具
// 输入：{ members, relationships }
// 输出：符合 GEDCOM 5.5.1 规范的 .ged 文本
//
// 说明：FAMS / FAMC 标签是可选的（多数软件会从 FAM 反向索引），
// 本导出仅生成 HEAD + INDI + FAM + TRLR，已满足 5.5.1 最低要求。

const cleanName = (name) => {
  if (!name) return '(未知)'
  return String(name).replace(/\//g, '').trim() || '(未知)'
}

const isMale = (n) => n && n.gender === 'male'
const isFemale = (n) => n && n.gender === 'female'

// 找一个成员的配偶（任一配偶）
const findSpouse = (members, relationships, personId, excludeChildId) => {
  for (const rel of relationships) {
    if (!rel || rel.relation !== 'husband-wife') continue
    const sourceId = rel.source && rel.source.id ? rel.source.id : rel.source
    const targetId = rel.target && rel.target.id ? rel.target.id : rel.target
    if (sourceId === personId && targetId !== excludeChildId) {
      return members.find(m => m.id === targetId) || null
    }
    if (targetId === personId && sourceId !== excludeChildId) {
      return members.find(m => m.id === sourceId) || null
    }
  }
  return null
}

// 根据父→子关系，生成"父-母 → 子"分组
// 每个组对应一个 FAM 记录
const groupChildrenByParents = (members, relationships) => {
  const groups = new Map()
  for (const rel of relationships) {
    if (!rel) continue
    if (rel.relation === 'husband-wife') continue
    const sourceId = rel.source && rel.source.id ? rel.source.id : rel.source
    const targetId = rel.target && rel.target.id ? rel.target.id : rel.target
    if (!sourceId || !targetId) continue
    const source = members.find(m => m.id === sourceId)
    const target = members.find(m => m.id === targetId)
    if (!source || !target) continue
    // 父 → 子（source.generation <= target.generation）
    let parent = source
    let child = target
    if ((source.generation || 1) > (target.generation || 1)) {
      parent = target
      child = source
    }
    const otherParent = findSpouse(members, relationships, parent.id, child.id)
    let fatherId = null
    let motherId = null
    if (isMale(parent)) fatherId = parent.id
    else if (isFemale(parent)) motherId = parent.id
    if (otherParent) {
      if (isMale(otherParent) && !fatherId) fatherId = otherParent.id
      else if (isFemale(otherParent) && !motherId) motherId = otherParent.id
    }
    // key 用"父ID|母ID"，没有则保留空串
    const key = `${fatherId || ''}|${motherId || ''}`
    if (!groups.has(key)) groups.set(key, { fatherId, motherId, children: [] })
    groups.get(key).children.push(child.id)
  }
  return groups
}

const line = (level, tag, value) => {
  return `${level} ${tag}${value !== undefined && value !== null && value !== '' ? ' ' + String(value) : ''}`
}

const buildGedcom = ({ members = [], relationships = [] }) => {
  const out = []
  // 头
  out.push('0 HEAD')
  out.push('1 SOUR Auto-Genealogy-Builder')
  out.push('2 NAME Auto Genealogy Builder')
  out.push('2 VERS 1.0')
  out.push('1 GEDC')
  out.push('2 VERS 5.5.1')
  out.push('2 FORM LINEAGE-LINKED')
  out.push('1 CHAR UTF-8')

  // 给每个成员分配 INDI xref
  const indiMap = new Map()
  members.forEach((m, idx) => {
    indiMap.set(m.id, `@I${idx + 1}@`)
  })

  // INDI 记录
  for (const m of members) {
    const xref = indiMap.get(m.id)
    out.push(`0 ${xref} INDI`)
    out.push(line(1, 'NAME', cleanName(m.name)))
    if (m.gender === 'male') out.push(line(1, 'SEX', 'M'))
    else if (m.gender === 'female') out.push(line(1, 'SEX', 'F'))
    if (m.generation) out.push(line(1, 'NOTE', `第 ${m.generation} 世`))
  }

  // FAM 记录
  const groups = groupChildrenByParents(members, relationships)
  let famIdx = 0
  for (const [, group] of groups) {
    famIdx += 1
    const famXref = `@F${famIdx}@`
    out.push(`0 ${famXref} FAM`)
    if (group.fatherId) {
      const fxref = indiMap.get(group.fatherId)
      if (fxref) out.push(line(1, 'HUSB', fxref))
    }
    if (group.motherId) {
      const mxref = indiMap.get(group.motherId)
      if (mxref) out.push(line(1, 'WIFE', mxref))
    }
    for (const childId of group.children) {
      const cxref = indiMap.get(childId)
      if (cxref) out.push(line(1, 'CHIL', cxref))
    }
  }

  out.push('0 TRLR')
  return out.join('\n') + '\n'
}

module.exports = { buildGedcom }
