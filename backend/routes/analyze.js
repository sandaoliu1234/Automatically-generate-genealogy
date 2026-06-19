const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const { parseDocument } = require('../utils/documentParser');

// 合法的 force 模式
const VALID_FORCE_MODES = new Set(['auto', 'cloud', 'local']);

router.post('/analyze', async (req, res) => {
  try {
    const { content, filename } = req.body;
    const userApiKey = req.headers['x-api-key'] || null;
    const force = VALID_FORCE_MODES.has(req.query.force) ? req.query.force : 'auto';

    if (!content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CONTENT',
          message: '文档内容不能为空'
        }
      });
    }

    console.log(`开始分析文档: ${filename || '未知文件'}`);
    console.log(`文档长度: ${content.length} 字符`);
    console.log(`使用API Key: ${userApiKey ? '用户自定义' : '默认配置'}`);
    console.log(`调用模式: ${force}`);

    const result = await aiService.analyzeDocument(content, userApiKey, force);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('分析失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYSIS_ERROR',
        message: error.message || '文档分析失败'
      }
    });
  }
});

router.post('/upload', async (req, res) => {
  try {
    const { file } = req;
    const userApiKey = req.headers['x-api-key'] || null;
    const force = VALID_FORCE_MODES.has(req.query.force) ? req.query.force : 'auto';

    if (!file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: '请上传文件'
        }
      });
    }

    const content = await parseDocument(file);
    const result = await aiService.analyzeDocument(content, userApiKey, force);

    res.json({
      success: true,
      data: result,
      filename: file.originalname,
      force
    });

  } catch (error) {
    console.error('文件处理失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message: error.message || '文件处理失败'
      }
    });
  }
});

module.exports = router;
