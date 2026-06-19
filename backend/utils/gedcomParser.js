// GEDCOM 5.5.1 解析工具
// 输入：.ged 文本
// 输出：{ members, relationships } 供 buildGenealogyData 直接消费
//
// GEDCOM 语法要点：
//   0 INDI  / 0 FAM / 0 HEAD / 0 TRLR
//   一级标签 NAME / SEX / HUSB / WIFE / CHIL
//   CONCAT / CONT 表示续行
//   实际中可能存在 INDI 跨行 NAME，用 1 NAME 主行 + 2 CONT 续行 + 2 CONCAT 拼接
//
// 我们以 5.5.1 规范最小可解析为目标：
//   - 解析 INDI -> 成员（name, gender, generation 暂定为 1）
//   - 解析 FAM  -> 关系（father-son / father-daughter / mother-son / mother-daughter / husband-wife）
//   - 子代的 generation 根据父/母 generation + 1 推断
//   - 多个家庭合并成完整成员/关系列表

const RELATION_BY_GENDER = {
  'father-son': 'father-son',
  'father-daughter': 'father-daughter',
  'mother-son': 'mother-son',
  'mother-daughter': 'mother-daughter'
}

// 把 0 级块切成 [{ tag, xref, lines: [{ level, tag, value, xref? }] }]
const parseBlocks = (text) => {
  const lines = text.split(/\r?\n/)
  const blocks = []
  let current = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    // GEDCOM 行： level [xref] tag [value]
    // 例：0 @I1@ INDI  /  1 NAME John / Doe
    const m = line.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?(\w+)\s*(.*)$/)
    if (!m) continue
    const level = parseInt(m[1], 10)
    const xref = m[2] || ''
    const tag = m[3]
    const value = m[4] || ''
    if (level === 0) {
      if (current) blocks.push(current)
      current = { tag, xref, lines: [] }
    } else if (current) {
      current.lines.push({ level, tag, value, xref })
    }
  }
  if (current) blocks.push(current)
  return blocks
}

// 从 INDI 的 lines 中提取姓名 / 性别
const parseIndi = (block) => {
  let name = ''
  let gender = ''
  let generation = 1
  for (let i = 0; i < block.lines.length; i++) {
    const ln = block.lines[i]
    if (ln.level === 1) {
      if (ln.tag === 'NAME') {
        name = ln.value
        // 处理续行：1 CONT 续行（换行延续），1 CONCAT 续行（直接拼接）
        for (let j = i + 1; j < block.lines.length; j++) {
          const next = block.lines[j]
          if (next.level === 1) break
          if (next.tag === 'CONT') name += '\n' + next.value
          else if (next.tag === 'CONCAT') name += next.value
        }
      } else if (ln.tag === 'SEX') {
        gender = ln.value
      } else if (ln.tag === 'NOTE' && /^第\s*(\d+)\s*世/.test(ln.value)) {
        const m = ln.value.match(/第\s*(\d+)\s*世/)
        if (m) generation = parseInt(m[1], 10)
      }
    }
  }
  return { name: name.trim() || '(未知)', gender, generation }
}

const parseGedcom = (text) => {
  if (!text || typeof text !== 'string') {
    throw new Error('GEDCOM 内容为空')
  }
  const blocks = parseBlocks(text)
  const indiMap = new Map() // xref -> { id, name, gender, generation }
  const members = []
  const relationships = []

  // 先解析所有 INDI
  for (const b of blocks) {
    if (b.tag !== 'INDI' || !b.xref) continue
    const info = parseIndi(b)
    const id = `ged_${indiMap.size + 1}`
    const member = {
      id,
      name: info.name,
      gender: info.gender === 'M' ? 'male' : info.gender === 'F' ? 'female' : 'male',
      generation: info.generation || 1,
      x: 0,
      y: 0,
      collapsed: false
    }
    indiMap.set(b.xref, { id, generation: member.generation })
    members.push(member)
  }

  // 再解析 FAM -> 关系
  for (const b of blocks) {
    if (b.tag !== 'FAM' || !b.xref) continue
    let husb = ''
    let wife = ''
    const children = []
    for (const ln of b.lines) {
      if (ln.level === 1) {
        if (ln.tag === 'HUSB') husb = ln.value
        else if (ln.tag === 'WIFE') wife = ln.value
        else if (ln.tag === 'CHIL') children.push(ln.value)
      }
    }
    // 父/母 → 子 关系
    const parents = []
    if (husb && indiMap.has(husb)) parents.push({ xref: husb, gender: 'male' })
    if (wife && indiMap.has(wife)) parents.push({ xref: wife, gender: 'female' })
    for (const childXref of children) {
      const childInfo = indiMap.get(childXref)
      if (!childInfo) continue
      const childMember = members.find(m => m.id === childInfo.id)
      if (!childMember) continue
      const childGender = childMember.gender === 'female' ? 'daughter' : 'son'
      // 推断 generation：父/母 generation 最大值 + 1
      let maxParentGen = 0
      for (const p of parents) {
        const g = indiMap.get(p.xref).generation || 1
        if (g > maxParentGen) maxParentGen = g
      }
      if (maxParentGen === 0) maxParentGen = 1
      childMember.generation = maxParentGen + 1
      for (const p of parents) {
        const rel = p.gender === 'male'
          ? (childGender === 'son' ? 'father-son' : 'father-daughter')
          : (childGender === 'son' ? 'mother-son' : 'mother-daughter')
        relationships.push({
          id: `ged_rel_${relationships.length + 1}`,
          source: p.xref === husb ? husb : wife,
          source_id: indiMap.get(p.xref).id,
          target: childXref,
          target_id: childInfo.id,
          relation: rel
        })
      }
    }
    // 夫妻关系
    if (husb && wife && indiMap.has(husb) && indiMap.has(wife)) {
      relationships.push({
        id: `ged_rel_${relationships.length + 1}`,
        source: husb,
        source_id: indiMap.get(husb).id,
        target: wife,
        target_id: indiMap.get(wife).id,
        relation: 'husband-wife'
      })
    }
  }

  if (members.length === 0) {
    throw new Error('GEDCOM 中未找到 INDI 记录')
  }

  return { members, relationships }
}

module.exports = { parseGedcom }
