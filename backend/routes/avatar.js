// 头像上传路由
// POST /api/avatar/upload  — 上传头像图片，返回路径
// DELETE /api/avatar/:filename — 删除指定头像文件

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// 确保上传目录存在
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 头像专用 multer 配置
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueName = `avatar_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
    cb(null, uniqueName);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB 上限
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的图片格式: ${ext}，请使用 JPG/PNG/GIF/WebP`));
    }
  }
});

// 上传头像
router.post('/upload', avatarUpload.single('avatar'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: '请选择头像图片' }
      });
    }
    // 返回相对路径（前端通过 /uploads/avatars/xxx.jpg 访问）
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    res.json({ success: true, data: { path: avatarPath } });
  } catch (err) {
    console.error('[Avatar] 上传失败:', err);
    res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_FAILED', message: err.message || '头像上传失败' }
    });
  }
});

// 删除头像
router.delete('/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    // 安全校验：只允许删除 avatars 目录下的文件
    const safeName = path.basename(filename);
    const filePath = path.join(UPLOAD_DIR, safeName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Avatar] 删除失败:', err);
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: err.message || '头像删除失败' }
    });
  }
});

module.exports = router;
