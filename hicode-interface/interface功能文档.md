# HICODE 分析平台 — 前端功能文档

> 对应代码：`hicode-interface/`（Next.js 16 + React 19 + Tailwind 4 + Recharts + lucide-react）
> 后端 API 由 `NEXT_PUBLIC_API_URL` 指定（默认 `http://localhost:8000`，开发环境 `:8002`）。

HICODE 是一个面向研究人员的**归纳式编码（inductive coding）分析平台**：用户上传或连接一份文本语料，输入研究问题，系统先用 embedding 按相关度筛选文本 → 用 LLM 生成描述性标签 → 对标签做层次聚类形成主题 → 在界面展示主题、关联文本和统计可视化。

界面整体为**左侧导航栏 + 右侧主内容区**两栏布局。下面分三部分讲：导航功能、主页面功能、可视化。

---

## 一、导航功能（侧边栏）

侧边栏（`Sidebar/Sidebar.tsx`）顶部为品牌区（`BrainCircuit` 图标 + **HICODE**），底部为用户区（当前硬编码「Researcher / research@sanofi.com」，尚未接入认证）。中间「Analysis」分组下有 **5 个导航入口**。

> ⚠️ **当前实现状态**：5 个入口目前只切换本地高亮状态（`activeItem`），**还没有接入真正的页面路由**——无论点哪个，主内容区始终显示「数据分析」页面。下表说明每个入口**规划中的功能**，以及当前是否已实现。

| 导航项 | 图标 | 规划功能 | 当前状态 |
|--------|------|----------|----------|
| **Dashboard** | LayoutDashboard | 平台首页/概览：展示近期分析任务、关键指标、快捷入口 | ⚪ 未实现（仅高亮） |
| **Data Sources** | Database | 数据源管理：浏览/连接后端数据集、查看已上传文件、管理数据集 | ⚪ 未实现（连接功能目前内嵌在分析页 Step 1） |
| **Run Analysis** | Microscope | 运行分析：即当前的三步分析主流程 | 🟢 已实现（就是现主页面） |
| **Results** | FileText | 结果中心：汇总查看历史分析结果与主题，独立于单次运行 | ⚪ 未实现（结果目前只显示在分析页右栏） |
| **Settings** | Settings | 设置：模型选择、API Key、语言、主题等配置 | ⚪ 未实现 |

**待完善建议**
- 将 5 个入口接入 Next.js 路由，拆分为独立页面。
- Data Sources 页：把现在内嵌在 Step 1 的「连接后端数据集」独立出来，做成可管理的数据源列表。
- Results 页：接入历史任务列表（后端已有 `GET /api/jobs`），让结果不依赖单次运行会话。
- 用户区接入真实登录态，替换硬编码邮箱。

---

## 二、主页面功能（数据分析页）

主内容区头部：面包屑「Home / Analysis」、标题 **Data Analysis**、「How it works」4 步使用引导、以及失败时顶部的红色错误条。

主体为**左右两栏**：左栏「数据输入 + 运行」，右栏「结果」。整个分析流程按三步卡片组织。

### Step 1：数据输入（`DataInput/DataInputCard.tsx`）

提供**两种互斥的数据来源**：

**A. 上传文件（`FileUpload.tsx`）**
- 拖拽或点击上传，支持多文件；支持格式 **CSV / JSON / TXT / PDF**（拖拽时按扩展名过滤）。
- 已选文件以列表展示，每项可单独移除。

**B. 连接后端数据集**
- 组件挂载时自动调 `GET /api/datasources` 拉取数据集填充下拉框，选项显示「名称 (文档数 docs)」。
- 选中后切换为绿色「已连接」徽章（数据集名 + 文档数 + Disconnect），并清空已上传文件。
- 后端不可达时提示「Could not reach backend. Is the backend running on :8002?」。

**研究问题输入**
- 文本框「What topic do you want to explore?」，默认填入示例问题。
- 该问题用于分析前按 embedding 相似度筛选最相关文本。

**领域背景（可选、可折叠）**
- 「Add domain context」填写数据集背景/领域知识，作为 system prompt 引导标签生成；留空忽略。已填写时显示「set」徽章。

### Step 2：运行分析（`Analysis/AnalysisTrigger.tsx`）

- **信息行**：显示数据集名+文档数，或「N files selected / ~N documents」（文件来源时文档数为估算值，按字节/500）。
- 问题非空时显示「**Embedding filter active**」标记。
- **运行进度**：分析期间显示 spinner + 来自后端 job 状态的实时进度文案。
- **Run Analysis 按钮**：无数据或分析中时禁用，分析中显示「Analyzing...」。

**运行逻辑（`page.tsx` + `lib/hicode.ts`）**
1. 上传文件时先 `POST /api/upload` 解析为 `{doc_id: text}`（失败回退到客户端解析）。
2. `POST /api/analyze` 启动任务，携带 `documents` 或 `datasource_id`、`query`、`coding_goal`、`background`、`model_name`（默认 `gpt-4o-mini`）。
3. 轮询 `GET /api/status/{job_id}`（每 2s，最多 10 分钟），完成渲染结果，出错/超时抛错。

### Step 3：结果展示（`Results/ResultsPanel.tsx`）

未运行时显示空状态「No results yet」。有结果后包含：

- **汇总条**：主题数、总文档数、（若有筛选）「N filtered by relevance」、生成的标签总数。
- **Filtered Reviews（可折叠）**：按 embedding 相似度排序的评论列表，每条显示文档 ID、文本、「NN% match」相似度。
- **视图切换标签页**：Topics / Labels per Theme / Docs per Theme / Co-occurrence（详见第三部分；无数据的视图自动禁用）。
- **底部**「View All Results」按钮（当前为占位，无跳转）。

**Topics 视图（`TopicItem.tsx`）** — 默认视图：
- 主题列表，首个默认展开。展开后显示研究问题、标签云、关联文件数，以及可折叠的「关联评论」原文（文档 ID + 文本）。

---

## 三、可视化

结果区通过顶部标签页在 4 种视图间切换，后三种为图表可视化（数据缺失时标签页自动置灰禁用）。

### 1. Topics（主题列表）
非图表，列表形式。每个主题可展开查看其研究问题、标签云、关联文件数与关联评论原文。

### 2. Labels per Theme — 标签普遍度柱状图（`PrevalenceBarChart.tsx`）
- 横向柱状图（Recharts），展示**每个主题汇集了多少条原始标签**，按数量降序排列。
- 6 色循环配色；行高自适应（每行 44px，高度 200~600px）；hover 显示数值。

### 3. Docs per Theme — 文档普遍度柱状图
- 同一柱状图组件，展示**每个主题被多少篇不同文档命中**（一篇文档若属于 3 个主题，则在 3 个主题中各计一次）。

### 4. Co-occurrence — 主题共现热力图（`CoOccurrenceHeatmap.tsx`）
- **自绘 SVG 上三角矩阵**，每个单元格代表「同时包含这两个主题的文档数」。
- 颜色按强度从浅蓝（`#eff6ff`）渐变到深蓝（`#1e40af`），单元格内标数值，深色背景自动转白字。
- 对角线掩盖（自己与自己不计）；底部有色阶图例（0 → 最大值）；hover 显示「主题A ↔ 主题B: N」。
- 全为 0 时显示「No co-occurrences detected」。

### 可视化数据契约（来自后端 `AnalysisResult`，见 `types/analysis.ts`）
| 字段 | 用途 |
|------|------|
| `themesOrdered` | 矩阵/坐标轴的主题顺序 |
| `themeLabelCounts` | 柱状图：每主题的原始标签数 |
| `themeDocCounts` | 柱状图：每主题的文档数 |
| `coOccurrenceMatrix` | 热力图：N×N 对称矩阵，对角线为 0 |
| `filteredReviews[]` | 筛选评论及相似度 `score` |
| `totalLabels` | 生成的唯一标签数 |

---

## 附：技术要点小结
- 前端为单页应用，分析主流程内联在一个页面，按三步卡片组织。
- API 客户端封装于 `src/lib/hicode.ts`：`fetchDatasources / loadDatasource / startAnalysis / getJobStatus / waitForCompletion / analyzeCorpus / uploadFiles / parseFiles / estimateDocumentCount / checkApiHealth`。
- 错误处理已覆盖：后端不可达、上传失败回退客户端解析、分析超时。
