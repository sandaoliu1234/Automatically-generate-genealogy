const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const analyzeRouter = require('./routes/analyze');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3100;
const HOST = process.env.HOST || '127.0.0.1';

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
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

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api', upload.single('file'), analyzeRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || '服务器内部错误',
      details: process.env.NODE_ENV === 'development' ? err.stack : {}
    }
  });
});

app.listen(PORT, HOST, () => {
  console.log(`族谱后端服务运行在 http://${HOST}:${PORT}`);
  console.log(`API Key: ${process.env.API_KEY ? '已配置' : '未配置'}`);
});
