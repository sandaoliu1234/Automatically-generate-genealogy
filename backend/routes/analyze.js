const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const aiService = require('../services/aiService');
const documentParser = require('../utils/documentParser');

// 文档上传 multer 配置（只用于 /upload 路由）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`));
    }
  }
});

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

router.post('/upload', upload.single('file'), async (req, res) => {
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

    const content = await documentParser.parseDocument(file);
    const result = await aiService.analyzeDocument(content, userApiKey, force);

    res.json({
      success: true,
      data: result,
      filename: file.originalname,
      force
    });

  } catch (error) {
    console.error('文件处理失败:', error);
    // 文档解析阶段的失败（不支持的格式 / 文件损坏 / 超时 / mammoth 内部错误）属于用户输入问题，
    // 返回 400 + UNSUPPORTED_FORMAT，让前端能区分"用户重传"和"服务异常"
    const msg = error.message || '文件处理失败';
    const isUserInputError =
      msg.includes('不支持') ||
      msg.includes('格式') ||
      msg.includes('解析失败') ||
      msg.includes('超时') ||
      msg.includes('损坏') ||
      msg.includes('parseDocx') ||  // mammoth 内部 JSZip 抛出的内部异常
      msg.includes('JSZip') ||
      msg.includes('zip file');
    res.status(isUserInputError ? 400 : 500).json({
      success: false,
      error: {
        code: isUserInputError ? 'UNSUPPORTED_FORMAT' : 'UPLOAD_ERROR',
        message: msg
      }
    });
  }
});

module.exports = router;
