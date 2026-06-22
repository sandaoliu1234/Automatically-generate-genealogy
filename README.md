# 智能族谱生成器

基于 Vue 3 + Node.js 的智能族谱生成器，可自动分析文档中的家族人物关系，生成可编辑、可交互的树状族谱图谱。

## 功能特性

### 核心功能
- 📄 **多格式文档分析**：支持 TXT、PDF、DOC、DOCX，自动解析家族信息
- 🤖 **AI 智能识别**：调用阿里云百炼（qwen-plus）或本地 Ollama（qwen2.5:3b）识别人物关系
- 🔄 **主备切换机制**：默认调用阿里云百炼，失败时自动降级到本地 Ollama
- 🌳 **树状图谱展示**：D3.js 驱动的可视化族谱
- ✏️ **在线编辑**：双击节点修改人名、拖拽调整位置、添加关系
- � **关系验证**：自动阻止不合理的跨代连接

### 交互能力
- 🔍 **人物搜索**：Ctrl+K 快速定位节点
- 📁 **折叠 / 展开子树**：管理大型族谱的视觉密度
- ✨ **焦点高亮**：点击节点高亮其全部关系网
- 🔎 **关系筛选**：按父系 / 母系 / 配偶 / 全部筛选视图
- 🖱 **节点右键菜单**：快速编辑 / 删除 / 查看详情
- ⌨️ **快捷键面板**：? 键查看所有快捷键
- 🌗 **暗色模式**：保护长时间使用的眼睛
- 🖐 **鼠标交互**：滚轮缩放、拖拽平移、单击聚焦
- 📥 **拖拽上传**：直接拖放文档到画布

### 数据与持久化
- 💾 **MySQL 持久化**：多会话管理，支持创建、加载、保存、删除族谱
- 🔁 **撤销 / 重做**：操作历史管理
- 📂 **GEDCOM 导入 / 导出**：兼容族谱行业标准 5.5.1 格式

### 视图与洞察
- � **人物详情卡片**：右侧滑出抽屉，展示节点信息与关系网络
- ⏳ **时间线视图**：按出生年份或代际组织人物
- 📊 **姓氏统计**：按姓氏数量分布，支持筛选
- 📈 **统计图表**：代际分布柱状图、性别比例环图
- 🗺 **小地图**：画布缩略图与视口导航

### 导出
- 🎨 **SVG 矢量图导出**：无损缩放，文件完全自包含（内联所有头像）
- 📄 **GEDCOM 5.5.1 导出**：标准族谱文件

## 技术栈

### 前端
- **框架**：Vue 3（Composition API）
- **可视化**：D3.js
- **构建工具**：Vite
- **样式**：原生 CSS + CSS 变量（支持主题切换）

### 后端
- **运行环境**：Node.js + Express
- **文件上传**：multer
- **文件解析**：pdf-parse（PDF）、mammoth（DOCX）
- **数据库**：MySQL（持久化族谱会话）
- **AI 集成**：
  - 阿里云百炼 API（qwen-plus）—— 主
  - Ollama 本地服务（qwen2.5:3b）—— 备

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

后端服务运行在 `http://localhost:3000`

### 4. 启动前端服务

```bash
cd frontend
npm run dev
```

前端服务运行在 `http://localhost:5173`

### 5. 打开浏览器

访问 `http://localhost:5173` 即可使用

## 使用说明

### 上传文档

- 点击"上传文档"按钮，或直接拖拽文件到画布
- 支持 TXT、PDF、DOC、DOCX
- 等待 AI 分析完成（默认 30 秒超时）

### 编辑族谱

- **修改人名**：双击节点
- **移动节点**：鼠标拖拽
- **删除节点**：右键节点 → 删除
- **添加关系**：编辑模式 + 工具栏

### 视图操作

| 操作 | 方式 |
|------|------|
| 缩放 | 鼠标滚轮 |
| 平移 | 鼠标左键拖拽空白处 |
| 聚焦节点 | 单击节点 |
| 搜索人物 | Ctrl + K |
| 时间线 | T 键 / 工具栏 |
| 快捷键面板 | ? |
| 切换暗色 | 工具栏 / Ctrl + Shift + L |

### 导出矢量图

点击"导出矢量图"按钮，族谱将下载为 SVG 文件（无损缩放、完全自包含）。

### GEDCOM 导入 / 导出

- 导入：拖拽 `.ged` 文件到画布
- 导出：工具栏 → 导出 GEDCOM

## 配置说明

### 阿里云百炼 API

**方式一：前端界面配置（推荐）**

1. 点击右上角"⚙️ 设置"
2. 输入阿里云百炼 API Key
3. 保存到浏览器本地存储

**方式二：后端 `.env` 文件**

```env
# 阿里云百炼（主）
API_KEY=您的API_KEY
AI_ENDPOINT=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_MODEL=qwen-plus

# Ollama 本地（备）
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
```

### Ollama 配置（可选，作为兜底）

1. 安装 [Ollama](https://ollama.com/)
2. 拉取模型：`ollama pull qwen2.5:3b`
3. 启动服务：`ollama serve`

### MySQL 配置（可选，用于会话持久化）

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=您的密码
DB_NAME=genealogy
```

数据库初始化脚本位于 `backend/db/init.sql`，首次启动会自动建表。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + K` | 搜索人物 |
| `Ctrl + Z` / `Ctrl + Y` | 撤销 / 重做 |
| `Ctrl + S` | 保存会话 |
| `T` | 切换时间线视图 |
| `?` | 打开快捷键面板 |
| `Esc` | 关闭弹窗 / 取消选择 |
| `Delete` | 删除选中节点 |
| `Ctrl + Shift + L` | 切换暗色模式 |

## 项目结构

```
Automatically generate genealogy/
├── backend/                       # 后端服务
│   ├── server.js                  # 应用入口
│   ├── routes/                    # 路由
│   │   ├── analyze.js             # AI 分析接口
│   │   ├── avatar.js              # 头像上传 / 访问
│   │   ├── genealogy.js           # 族谱会话 CRUD
│   │   └── gedcom.js              # GEDCOM 导入 / 导出
│   ├── services/                  # AI 服务
│   │   ├── aliyunBailian.js       # 阿里云百炼
│   │   └── ollamaService.js       # Ollama 本地
│   ├── utils/                     # 工具函数
│   │   ├── textParser.js          # TXT 解析
│   │   ├── pdfParser.js           # PDF 解析
│   │   ├── docxParser.js          # DOCX / DOC 解析
│   │   ├── gedcomParser.js        # GEDCOM 解析
│   │   └── gedcomExporter.js      # GEDCOM 导出
│   ├── db/                        # 数据库
│   │   ├── index.js               # MySQL 连接池
│   │   └── init.sql               # 建表脚本
│   ├── uploads/                   # 上传文件存储
│   │   └── avatars/               # 用户头像
│   ├── .env                       # 环境变量
│   └── package.json
│
├── frontend/                      # 前端应用
│   ├── src/
│   │   ├── App.vue                # 应用入口
│   │   ├── components/            # 组件
│   │   │   ├── TopBar.vue         # 顶部工具栏
│   │   │   ├── GenealogyCanvas.vue# D3 画布
│   │   │   ├── NodeDetailCard.vue # 人物详情卡片
│   │   │   ├── TimelinePanel.vue  # 时间线视图
│   │   │   ├── SettingsPanel.vue  # 设置面板
│   │   │   ├── HelpPanel.vue      # 快捷键面板
│   │   │   └── ...
│   │   ├── composables/           # 业务逻辑（Composition API）
│   │   │   ├── useGenealogyCore.js# 核心数据 / 状态
│   │   │   ├── useAIAnalysis.js   # AI 分析
│   │   │   ├── useExport.js       # 导出（SVG、GEDCOM）
│   │   │   ├── useNodeDetail.js   # 详情卡片逻辑
│   │   │   ├── useTimeline.js     # 时间线逻辑
│   │   │   ├── useSearch.js       # 搜索逻辑
│   │   │   └── ...
│   │   ├── utils/                 # 工具函数
│   │   ├── styles/                # 样式
│   │   └── main.js
│   ├── public/
│   └── package.json
│
└── README.md
```

## 文档格式示例

为获得最佳 AI 分析效果，建议文档格式如下：

```
爷爷张大爷和奶奶李氏有三个孩子：
大儿子张一，父亲
二女儿张二，母亲
小儿子张三，父亲
张一和王女士结婚，生了张小小
张三和刘女士结婚，生了张小四
```

## 注意事项

1. **AI 分析**：默认调用阿里云百炼，失败时自动降级到本地 Ollama，确保可用性
2. **首次拉取模型**：使用 Ollama 前需先 `ollama pull qwen2.5:3b`（约 2GB）
3. **MySQL 可选**：未配置 MySQL 时，应用仍可正常工作，只是不会持久化会话
4. **导出 SVG**：导出的 SVG 完全自包含，包含所有头像，可独立分发

## 许可证

MIT License
