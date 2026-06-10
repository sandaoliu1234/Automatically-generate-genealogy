# 智能族谱生成器

基于 Vue + Node.js 的智能族谱生成器，可以自动分析文档中的家族人物关系，并生成可编辑的树状族谱图谱。

## 功能特性

- 📄 **文档上传分析**：支持 TXT、PDF、DOC、DOCX 格式
- 🤖 **AI智能识别**：调用阿里云百炼API自动识别人物关系
- 🌳 **树状图谱展示**：可视化展示家族成员关系
- ✏️ **在线编辑**：双击节点修改人名、拖拽调整位置
- 📥 **图片导出**：一键导出高清族谱图片
- 🔒 **关系验证**：自动阻止不合理的跨代连接

## 技术栈

- **前端**：Vue 3 + D3.js + html2canvas
- **后端**：Node.js + Express + 阿里云百炼API
- **构建工具**：Vite

## 快速开始

### 1. 安装后端依赖

```bash
cd backend
npm install
```

### 2. 安装前端依赖

```bash
cd frontend
npm install
```

### 3. 启动后端服务

```bash
cd backend
npm start
```

后端服务将运行在 http://localhost:3000

### 4. 启动前端服务

```bash
cd frontend
npm run dev
```

前端服务将运行在 http://localhost:5173

### 5. 打开浏览器

访问 http://localhost:5173 即可使用

## 使用说明

### 上传文档

1. 点击"上传文档"按钮或拖拽文件到上传区域
2. 选择包含家族信息的文档文件
3. 等待AI分析完成

### 编辑族谱

- **修改人名**：双击节点，修改姓名和性别
- **移动节点**：拖拽节点到新位置
- **删除节点**：在编辑模式下点击"删除"按钮

### 导出图片

点击"导出图片"按钮，族谱将自动下载为PNG格式

## 配置说明

### 阿里云百炼API配置

**方式一：通过前端界面配置（推荐）**

1. 启动应用后，点击右上角的"⚙️ 设置"按钮
2. 在弹出的设置窗口中输入您的阿里云百炼API Key
3. 点击"保存"按钮
4. API Key将保存在您的浏览器本地存储中

**方式二：通过后端配置文件配置**

在 `backend/.env` 文件中配置：

```env
API_KEY=您的API_KEY
AI_ENDPOINT=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_MODEL=qwen-plus
```

### 如何获取API Key

1. 访问 [阿里云百炼控制台](https://bailian.console.aliyun.com/)
2. 登录您的阿里云账号
3. 在"API-KEY管理"中创建或查看您的API Key
4. 将API Key复制到应用设置中

## 文档格式示例

为了获得最佳分析效果，建议文档格式如下：

```
爷爷张大爷和奶奶李氏有三个孩子：
大儿子张一，父亲
二女儿张二，母亲
小儿子张三，父亲
张一和王女士结婚，生了张小小
张三和刘女士结婚，生了张小四
```

## 注意事项

1. AI分析需要一定的处理时间，请耐心等待
2. 建议文档内容简洁明了，避免过多无关信息
3. 导出的图片清晰度为2倍缩放

## 项目结构

```
genealogy-app/
├── backend/              # 后端服务
│   ├── server.js         # 应用入口
│   ├── routes/           # 路由
│   ├── services/        # AI服务
│   ├── utils/          # 工具函数
│   └── package.json
├── frontend/            # 前端应用
│   ├── src/            # 源代码
│   ├── public/        # 静态资源
│   └── package.json
└── README.md
```

## 许可证

MIT License
