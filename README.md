# Atoms-Demo

> 🚀 把想法变成可销售的产品 — AI 驱动的产品构建平台

Atoms-Demo 是一个面向非技术用户的 AI 驱动平台，帮助用户在几分钟内将创意转化为可销售的产品方案。无需编码经验，通过自然语言对话即可完成产品规划、方案生成和图像设计。

---

## ✨ 核心功能

### 🤖 智能 AI Agent 系统

采用多 Agent 协作架构，自动识别用户意图并分发到不同的专业 AI：

- **意图识别 Agent** — 自动分析用户输入，判断需求类型（绘图 / 方案 / 问答）
- **图像生成 Agent** — 根据描述生成精美的 SVG 矢量图，支持下载
- **方案生成 Agent** — 生成结构化的产品方案（市场分析、功能规划、定价策略等）
- **问答 Agent** — 直接回答用户的各类问题

### 🔐 用户认证系统

- 邮箱注册 / 登录
- 密码 bcrypt 加密存储
- 用户名唯一性校验
- Zod 表单数据校验
- 基于 localStorage 的会话管理

### 📊 实时流式响应

- 基于 SSE (Server-Sent Events) 的流式输出
- 实时显示 AI 思考过程
- 打字机效果逐字呈现内容
- 支持 Markdown 格式渲染（标题、列表、表格、代码块等）

### 🎨 现代化 UI

- 深色主题设计
- 响应式布局（适配桌面和移动端）
- 可爱的卡通头像装饰
- 流畅的动画过渡效果

---

## 🛠️ 技术栈

| 分类 | 技术 | 版本 |
|------|------|------|
| **框架** | Next.js (App Router) | 16.3.2 |
| **语言** | TypeScript | ^5 |
| **UI** | React | 19.2.8 |
| **样式** | Tailwind CSS | ^4 |
| **数据库** | SQLite (via Prisma) | - |
| **ORM** | Prisma | ^7.9.1 |
| **图标** | Lucide React | ^1.33.0 |
| **表单校验** | Zod | ^4.4.3 |
| **密码加密** | bcrypt | ^6.0.0 |
| **AI 服务** | 阿里云通义千问 (DashScope API) | qwen3.7-flash |

---

## 📁 项目结构

```
atoms-demo/
├── src/
│   ├── app/                          # 页面路由 (Next.js App Router)
│   │   ├── page.tsx                  # 🏠 首页（Hero + Navbar）
│   │   ├── layout.tsx                # 全局布局
│   │   ├── globals.css               # 全局样式 + CSS 变量
│   │   ├── login/
│   │   │   └── page.tsx              # 🔑 登录页
│   │   ├── register/
│   │   │   └── page.tsx              # 📝 注册页
│   │   ├── app/
│   │   │   └── page.tsx              # 🤖 AI 生成工作台
│   │   ├── generate/
│   │   │   └── page.tsx              # 📊 内容生成页
│   │   └── api/                      # API 路由
│   │       ├── auth/
│   │       │   ├── register/route.ts # 注册接口
│   │       │   ├── login/route.ts    # 登录接口
│   │       │   └── check-username/
│   │       │       └── route.ts      # 用户名检查接口
│   │       ├── agent/route.ts        # AI Agent 接口（多 Agent 协作）
│   │       └── generate/route.ts     # AI 生成接口（流式输出）
│   ├── components/                   # 可复用组件
│   │   ├── Navbar.tsx                # 顶部导航栏（含下拉菜单）
│   │   └── Hero.tsx                  # 首页主视觉区域
│   └── lib/                          # 工具库
│       ├── db.ts                     # Prisma 数据库客户端
│       ├── store.ts                  # 客户端状态管理 (localStorage)
│       └── validators.ts            # Zod 表单校验规则
├── prisma/
│   └── schema.prisma                 # 数据库模型定义
├── prisma.config.ts                  # Prisma 配置
├── data/
│   └── db.json                       # SQLite 数据文件
└── package.json                      # 项目配置
```

---

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### 安装步骤

#### 1. 克隆项目

```bash
git clone <仓库地址>
cd atoms-demo
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 初始化数据库

```bash
npx prisma generate
npx prisma db push
```

#### 4. 配置环境变量

在项目根目录创建 `.env` 文件：

```env
# 数据库连接（SQLite）
DATABASE_URL="file:./data/db.json"

# 阿里云 DashScope API 密钥（用于 AI 功能）
DASHSCOPE_API_KEY="your-api-key-here"
```

> ⚠️ **注意**: 请前往 [阿里云百炼平台](https://dashscope.console.aliyun.com/) 获取 API 密钥。

#### 5. 启动开发服务器

```bash
npm run dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000) 🎉

---

## 📖 使用指南

### 注册账号

1. 点击右上角「注册」按钮
2. 填写用户名、邮箱和密码
3. 点击「创建账号」完成注册

### 使用 AI 生成

1. 登录后，在首页输入框输入你的想法
2. 点击「开始」进入 AI 工作台
3. AI 会自动识别你的意图：
   - 输入「画一个...」→ 生成 SVG 图像 🎨
   - 输入「帮我做一个产品方案...」→ 生成产品方案 📝
   - 输入普通问题 → 直接回答 💬
4. 生成完成后可以：
   - 📋 复制内容
   - 🔄 重新生成
   - 📥 下载图片（SVG 格式）

---

## 🔌 API 接口说明

### 认证接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/check-username` | POST | 检查用户名是否可用 |

### AI 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/agent` | POST | AI Agent 多意图生成（SSE 流式） |
| `/api/generate` | POST | AI 方案生成（SSE 流式） |

### 请求/响应示例

**注册接口** (`POST /api/auth/register`)

```json
// 请求
{
  "name": "张三",
  "email": "zhangsan@example.com",
  "password": "123456"
}

// 响应
{
  "success": true,
  "message": "注册成功",
  "user": { "id": "...", "name": "张三", "email": "..." }
}
```

**AI Agent 接口** (`POST /api/agent`)

```json
// 请求
{
  "prompt": "帮我设计一个在线教育平台的产品方案"
}

// 响应 (SSE 流)
data: {"type":"thinking","stage":0,"text":"Alex 正在分析你的意图..."}
data: {"type":"intent","intent":"plan"}
data: {"type":"content","content":"## 产品方案...","contentType":"text"}
data: {"type":"done"}
```

---

## 🗄️ 数据库模型

当前使用 SQLite + Prisma，数据模型：

```prisma
model User {
  id        String   @id @default(cuid())
  name      String   @unique    // 用户名（唯一）
  email     String   @unique    // 邮箱（唯一）
  password  String               // bcrypt 加密后的密码
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 数据库操作

```bash
# 查看数据库状态
npx prisma db push

# 打开 Prisma Studio 可视化管理
npx prisma studio

# 重新生成 Prisma Client
npx prisma generate
```

---

## 🏗️ 构建与部署

### 本地构建

```bash
npm run build
npm start
```

### 部署到 Vercel（推荐）

1. 将代码推送到 GitHub
2. 前往 [Vercel](https://vercel.com) 导入项目
3. 配置环境变量（`DATABASE_URL`、`DASHSCOPE_API_KEY`）
4. 点击部署

> 💡 Vercel 提供免费套餐，支持自动 HTTPS、全球 CDN、自动扩展。

### 部署注意事项

- SQLite 数据库在 Vercel 的无服务器环境中每次请求可能重置，生产环境建议使用 PostgreSQL（Supabase）
- API 密钥应存放在环境变量中，不要硬编码在代码里
- 建议开启 Vercel 的 Preview Deployments 进行测试

---

## 🔒 安全说明

- ✅ 密码使用 bcrypt 加密（salt rounds: 10）
- ✅ 表单数据通过 Zod 进行校验
- ✅ 邮箱唯一性检查
- ⚠️ API 密钥应通过环境变量管理，避免提交到代码仓库
- ⚠️ 生产环境建议使用更安全的会话管理方案（如 JWT + HttpOnly Cookie）

---

## 📝 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（热更新） |
| `npm run build` | 构建生产版本 |
| `npm start` | 启动生产服务器 |
| `npx prisma studio` | 打开数据库可视化管理工具 |
| `npx prisma db push` | 同步数据库模型 |
| `npx prisma generate` | 重新生成 Prisma Client |

---

## 🗺️ 路线图

- [ ] 支持更多 AI 模型（OpenAI、Anthropic 等）
- [ ] 用户历史记录保存
- [ ] 方案导出为 PDF / Word
- [ ] 团队协作功能
- [ ] 产品模板市场
- [ ] 支付集成（订阅制）
- [ ] 移动端 App

---

## 📄 License

MIT

---

<p align="center">
  由 <strong>Atoms-Demo</strong> 团队用 ❤️ 构建
</p>
