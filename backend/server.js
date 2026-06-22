const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// 必须在 require 其它模块（尤其 db/）之前调用，否则 .env 中的 DB_* 等
// 变量还没注入到 process.env，就被 db/index.js 顶层 createPool 读走了
dotenv.config();

const analyzeRouter = require('./routes/analyze');
const exportRouter = require('./routes/export');
const importRouter = require('./routes/import');
const sessionsRouter = require('./routes/sessions');
const avatarRouter = require('./routes/avatar');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3100;
const HOST = process.env.HOST || '127.0.0.1';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api', analyzeRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/avatar', avatarRouter);

// 静态文件服务：头像图片
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// 先初始化数据库再启动服务
initDb()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`族谱后端服务运行在 http://${HOST}:${PORT}`);
      console.log(`API Key: ${process.env.API_KEY ? '已配置' : '未配置'}`);
    });
  })
  .catch((err) => {
    console.error('数据库初始化失败，服务未启动:', err.message);
    process.exit(1);
  });
