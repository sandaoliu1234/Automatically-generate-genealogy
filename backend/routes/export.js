// GEDCOM 导出路由
// POST /api/export/gedcom
// Body: { members, relationships } 或 { members, relationships, filename }
// 返回 text/plain；前端用 Blob 下载
// 导入端点另见 routes/import.js -> POST /api/import/gedcom

const express = require('express')
const { buildGedcom } = require('../utils/gedcomExporter')

const router = express.Router()

router.post('/gedcom', (req, res) => {
  try {
    const { members = [], relationships = [], filename } = req.body || {}
    if (!Array.isArray(members)) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_INPUT', message: 'members 必须是数组' }
      })
    }
    if (!Array.isArray(relationships)) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_INPUT', message: 'relationships 必须是数组' }
      })
    }

    const text = buildGedcom({ members, relationships })
    const safeName = String(filename || 'genealogy.ged').replace(/[^\w\-. ]/g, '_')

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`)
    return res.send(text)
  } catch (err) {
    console.error('[GEDCOM] 导出失败:', err)
    return res.status(500).json({
      success: false,
      error: {
        code: 'GEDCOM_FAILED',
        message: err.message || 'GEDCOM 导出失败'
      }
    })
  }
})

module.exports = router
