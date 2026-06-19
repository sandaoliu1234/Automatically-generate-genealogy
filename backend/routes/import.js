// GEDCOM 导入路由
// POST /api/import/gedcom
// Body: { content: '.ged 文本', filename? }
// 返回：{ success, data: { members, relationships, filename } }

const express = require('express')
const { parseGedcom } = require('../utils/gedcomParser')

const router = express.Router()

router.post('/gedcom', (req, res) => {
  try {
    const { content, filename } = req.body || {}
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_INPUT', message: 'content 字段必填，且为 .ged 文本' }
      })
    }
    const data = parseGedcom(content)
    return res.json({
      success: true,
      data: {
        filename: filename || 'imported.ged',
        members: data.members,
        relationships: data.relationships
      }
    })
  } catch (err) {
    console.error('[GEDCOM] 导入失败:', err)
    return res.status(400).json({
      success: false,
      error: {
        code: 'GEDCOM_PARSE_FAILED',
        message: err.message || 'GEDCOM 解析失败'
      }
    })
  }
})

module.exports = router
