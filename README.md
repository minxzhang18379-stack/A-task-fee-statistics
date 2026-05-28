# PANN Task Manager (任务及稿费统计管理系统)

[![React](https://img.shields.io/badge/Frontend-React%2019-blue?logo=react&logoColor=white)](https://react.dev/)
[![Tauri](https://img.shields.io/badge/Desktop-Tauri%202.x-lightgrey?logo=tauri&logoColor=white)](https://tauri.app/)
[![Cloudflare Pages](https://img.shields.io/badge/Backend-Cloudflare%20Pages-orange?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![Cloudflare D1](https://img.shields.io/badge/Database-Cloudflare%20D1%20(SQLite)-blueviolet?logo=sqlite&logoColor=white)](https://developers.cloudflare.com/d1/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**PANN Task Manager** 是一款面向内容制作团队、摄影俱乐部以及独立自由职业者的**多端智能任务与稿费统计管理系统**。

系统采用创新的**多端协同架构**，全面适配 Windows 桌面端应用（基于 Tauri）以及 Web/移动手机端（基于 Cloudflare Pages 部署）。系统支持“云端数据实时共享”与“本地单机离线运行”双重模式，并拥有精美的玻璃拟态（Glassmorphism）暗黑美学 UI 设计与高度完善的安全鉴权机制。

---

## 🌟 核心特性

*   **📱 跨端跨平台适配**：
    *   **桌面客户端 (Windows)**：基于 Tauri 2.x 原生编译，包体积极小（约 3.9MB 安装包），内存占用极低，集成系统原生通知与本地独立 SQLite。
    *   **Web 网页与移动端**：适配 iOS/Android 移动端屏幕，提供自适应侧边抽屉式导航与全面流畅的手势响应。
*   **🔄 云端同步与离线降级双路由**：
    *   **在线云端模式**：所有终端实时与 Cloudflare D1 边缘数据库同步，满足多人协同录入、实时统计与统计大屏共享的需求。
    *   **离线单机模式**：Tauri 客户端在无网或未配服务器时，自动无缝切换至本地物理 SQLite 数据库（`tasks.db`）独立运行。
*   **🔒 工业级 JWT 安全鉴权**：
    *   **无感登录与 Token 过期机制**：移除明文密码存储的反安全模式，静态密码在验证后仅用于单次签发 12 小时有效期的 JWT 临时令牌。
    *   **双角色双密码隔离模式**：
        *   **管理员 (Admin)**：拥有完整的任务增删改查、Excel 模板导入、批量数据清洗与全库清空权限。
        *   **普通成员 (Member)**：拥有添加任务、修改自己任务的录入权限。界面自动屏蔽删除控件、批量操作按钮以及设置管理页面，避免数据误删。
*   **📊 强大的数据导入导出引擎**：
    *   **Excel 智能导入**：支持识别格式混乱的外部表格，智能提取“任务名称”、“拍摄人”、“任务类型”、“任务日期”与“稿费”等关键维度。
    *   **物理文本清洗规则 (DRY 业务服务)**：支持在入库前自动对拍摄人后缀（如“（修图）”、“(修图)”）和地点拆分规则进行规范化清洗，确保大盘统计维度绝对纯净。
    *   **Excel 高级导出**：支持按照模板导出带有求和公式、边框样式及表头标题的专业稿费汇总单，并支持一键为特定摄影师生成个人对账单。
*   **🌗 现代玻璃拟态设计系统**：
    *   基于 Tailwind CSS + Shadcn UI 深度定制的暗黑玻璃透光美学，包含平滑的微动画悬浮反馈。

---

## 📐 系统架构拓扑图

```mermaid
graph TD
    subgraph 客户端层 (多端适配)
        WebClient[Web网页/手机端浏览器] -->|标准 HTTPS 请求| CF_Gateway
        TauriClient[Tauri 桌面端 .exe] -->|API 请求 (携带 JWT)| CF_Gateway
        TauriClient -.->|无网状态下自动降级| LocalSQLite[(本地物理 SQLite tasks.db)]
    end

    subgraph 服务端 (Cloudflare Serverless 边缘网络)
        CF_Gateway{CF _middleware.ts 拦截器}
        CF_Gateway -->|CORS 拦截 / 全局未捕获异常捕捉| CORS_Gate[跨域与异常处理器]
        CF_Gateway -->|JWT 令牌解密与过期时间校验| Auth_Gate[鉴权拦截器]
        
        Auth_Gate -->|通过: 解析claims存入 context.data| Route_API[API 路由分配]
        
        Route_API -->|/api/auth 登录| Auth_API[auth.ts 静态密码校验与JWT签发]
        Route_API -->|/api/tasks 任务| Task_API[tasks.ts 任务 CRUD 极简控制器]
        Route_API -->|/api/tasks/all 清除| Clear_API[tasks/all.ts 专用清库控制器]
    end

    subgraph 存储层 (边缘分布式 SQLite)
        Task_API -->|D1 API 查询| D1[(Cloudflare D1 SQLite 数据库)]
        Clear_API -->|D1 API 清空| D1
    end
```

---

## 📂 项目目录结构说明

```
f:\PANN\任务稿费统计/
├── functions/                  # Cloudflare Pages Serverless 后端 API
│   ├── api/
│   │   ├── _middleware.ts      # [核心] 全局中间件 (CORS 预检、JWT 拦截校验、全局 Try-Catch)
│   │   ├── auth.ts             # 静态密码验证登录与签发 JWT 令牌
│   │   ├── tasks.ts            # 任务增删改查路由 (直接受 JWT 保护，剥离 CORS)
│   │   ├── tasks/
│   │   │   └── all.ts          # 专属清空数据库接口 (仅管理员 JWT 可调用)
│   │   └── jwt.ts              # [工具] 原生 Web Crypto API JWT 签名/验证类
├── src/                        # 前端 React 源码
│   ├── assets/                 # 静态图片资源 (Logo 等)
│   ├── components/
│   │   ├── login-gate.tsx      # 安全登录门禁 (包含云端 JWT 自动校验与本地单机切换)
│   │   ├── layout.tsx          # 玻璃美学外壳 (集成自适应移动端 Hamburger 侧抽屉菜单)
│   │   └── ui/                 # 基础原子化 UI 组件 (Shadcn UI / Tailwind)
│   ├── lib/
│   │   ├── db.ts               # [核心] 统一数据库分流路由器 (自动判断云端/本地运行环境)
│   │   └── excelEngine.ts      # 智能 Excel 导入/解析及 Blob 导出引擎
│   ├── pages/                  # 业务功能页面
│   │   ├── dashboard.tsx       # 任务及稿费数据可视化主面板
│   │   ├── tasks.tsx           # 任务列表与录入 (自动根据角色过滤删除/批量操作)
│   │   ├── stats.tsx           # 每月稿费明细与摄影师统计大盘
│   │   └── settings.tsx        # 系统设置 (模板样式定制、数据库维护及清空)
│   ├── App.tsx                 # 主入口 (封装门禁与全局路由)
│   └── index.css               # 主样式系统设计 (CSS Tokens)
├── src-tauri/                  # Tauri 2.x 桌面原生配置与 Rust 核心代码
├── index.html                  # 网页主入口模板
├── package.json                # 项目依赖管理
├── schema.sql                  # Cloudflare D1 数据库初始化 DDL 脚本
└── README.md                   # 本说明文件
```

---

## 💾 数据库表结构设计 (schema.sql)

系统采用单表结构设计，在保证极高运行性能的同时，通过严格的索引与清洗机制确保数据结构稳定：

```sql
-- 任务及稿费记录主表
CREATE TABLE IF NOT EXISTS TaskRecord (
  id INTEGER PRIMARY KEY AUTOINCREMENT,      -- 自增主键 ID
  title TEXT NOT NULL,                        -- 任务/项目名称 (入库自动剔除地点后缀)
  photographer TEXT NOT NULL DEFAULT '',     -- 拍摄人/修图人名称 (入库自动净化修图后缀)
  taskType TEXT NOT NULL DEFAULT '非重大',    -- 任务类型 (如: 重大、非重大、特约)
  taskDate TEXT NOT NULL DEFAULT '',         -- 任务发生日期 (格式: YYYY-MM-DD)
  fee REAL NOT NULL DEFAULT 0                -- 稿费金额 (浮点型数)
);

-- 为高频统计维度建立覆盖索引，大幅提高大盘渲染速度
CREATE INDEX IF NOT EXISTS idx_task_date ON TaskRecord(taskDate);
CREATE INDEX IF NOT EXISTS idx_photographer ON TaskRecord(photographer);
```

---

## 🛠️ 本地开发指南

### 1. 开发环境前置要求
*   **Node.js**：v18.0.0 以上 (推荐 v22)
*   **Rust**：推荐安装 Rustc & Cargo (如果您需要重构并编译 Tauri 桌面应用)

### 2. 初始化项目依赖
克隆项目到本地后，在根目录下执行：
```bash
npm install
```

### 3. 运行前端开发服务器 (Vite)
如果您只想调试前端 UI，可直接运行：
```bash
npm run dev
```

### 4. 运行 Serverless 后端模拟器 (Cloudflare Wrangler)
本项目的 Serverless API 依赖于 Cloudflare 环境。要在本地同时模拟前端、Functions 路由以及本地 D1 数据库，可利用 Wrangler CLI：
```bash
# 启动本地模拟环境 (Vite 静态文件 + D1 数据库 + Pages API 连通)
npx wrangler pages dev dist --compatibility-date=2026-05-28 --d1=DB
```

### 5. 运行 Tauri 桌面开发模式
若想在桌面 webview 沙盒内进行实时联调，可运行：
```bash
npm run tauri dev
```

---

## 🌐 生产部署与上线说明 (Cloudflare Pages)

本系统可以完全托管在 Cloudflare 平台，实现全网极速低延迟部署与接近**永久免费**的日常开销。

### 第一步：创建并运行 D1 数据库
1.  登录您的 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2.  在左侧导航栏选择 **Workers & Pages > D1**，点击 **Create database**，创建一个名为 `pann-tasks-db` 的数据库。
3.  数据库创建成功后，进入其详情页，点击右上角的 **Console** (SQL 终端)。
4.  将本项目根目录下的 [schema.sql](file:///f:/PANN/任务稿费统计/schema.sql) 文件内容完整复制到 Console 中并点击 **Execute** 运行，完成数据表及索引的创建。

### 第二步：部署 Cloudflare Pages
1.  将您的本地代码推送至您的私有 GitHub 仓库。
2.  在 Cloudflare 控制台选择 **Workers & Pages > Create application > Pages > Connect to Git**，选择您的仓库。
3.  在构建配置中选择：
    *   **Framework preset**：`Vite`
    *   **Build command**：`npm run build`
    *   **Build output directory**：`dist`
4.  点击 **Save and Deploy** 开始初次编译上线。

### 第三步：配置绑定与安全密钥 (关键步骤)
为确保云端 API 连通与系统安全，需要在 Pages 的控制台进行如下设置：
1.  **D1 数据库绑定**：
    *   进入您的 Pages 项目，点击 **Settings > Functions**。
    *   在 **D1 database bindings** 区域点击 **Add binding**。
    *   **Variable name (变量名)**：必须填 `DB`。
    *   **D1 database**：选择第一步中创建的 `pann-tasks-db`。
2.  **配置系统安全密钥 (Environment variables)**：
    *   点击 **Settings > Environment variables**。
    *   添加如下变量值：
        *   `API_PASSWORD`：管理员密码 (用于签发 admin 令牌，如不设置默认为 `admin123`)。
        *   `MEMBER_PASSWORD`：普通成员密码 (用于签发 member 限制权限令牌，如不设置默认为 `member123`)。
        *   `JWT_SECRET`：**【强烈建议配置】** 足够长且随机的强密钥串，用于服务端对 JWT 会话安全签名。
3.  保存配置后，在 **Deployments** 页面选择最新一次部署，点击 **Retry deployment** (重新部署) 以激活上述绑定。

---

## 📦 Tauri 桌面客户端编译发布

如果您对前端代码进行了任何定制（如修改了默认服务器地址等），或者同步了上述重构升级，需要重新编译生成 Windows 原生软件：

```bash
# 启动 Tauri 高级自动打包构建
npm run tauri build
```
编译完成后，安装程序和免安装二进制文件将自动输出在：
*   `src-tauri/target/release/bundle/nsis/PANN Task Manager_1.0.1_x64-setup.exe` (自动复制并同步至您的项目根目录下)
*   `src-tauri/target/release/tauri-app.exe` (自动重命名为 `PANN Task Manager.exe` 同步至根目录下)

---

## 🔒 许可证

本项目基于 MIT 许可证开源。仅供内部团队管理及个人统计核算使用，请勿用于非法商业销售。
