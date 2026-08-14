# 04 · 前端路由拆分

**状态：✅ 完成** · 步骤 05 的前置

---

## 目标

把当前的单页应用拆成真正的多页路由，让侧栏的 Results 能跳到一个独立页面。

对应会议 §5 §13。

## 为什么需要

侧栏那 5 个入口目前是**假的**：

```tsx
// src/components/Sidebar/Sidebar.tsx:24
const [activeItem, setActiveItem] = useState("dashboard");
```

点哪个都只切换本地高亮，主内容区永远是同一个页面。`src/app/` 下也只有
`page.tsx` + `layout.tsx` 两个文件，没有任何子路由。

会议 §13 里 Junjie 的结论是「dashboard 不变，Results 变成一个新 tab」——
这要求真路由，不是条件渲染。

## 改动

### 路由结构

```
src/app/
  page.tsx              → redirect 到 /analysis
  analysis/page.tsx     ← 现在的 page.tsx 原样搬过来，逻辑不动
  results/page.tsx      ← 新建（内容在步骤 05 做，本步先出空壳）
  layout.tsx            ← 不动
```

Next.js 16 App Router，`redirect()` 从 `next/navigation` 引。

### Sidebar 改造

- `navItems` 加 `href` 字段
- `NavItem` 从 `onClick` 改成 `next/link` 的 `<Link>`
- 高亮状态改用 `usePathname()` 判断，去掉 `useState`
- 未实现的入口（Dashboard / Data Sources / Settings）**保持禁用态**并加 tooltip，
  不要让它们看起来能点 —— 现在的假高亮比明确禁用更让人困惑

### 状态跨页传递

Dashboard 跑完分析后 Results 页要能拿到结果。方案（见 `DECISIONS.md` D-2）：

- 跑完把 `job_id` 写进 `localStorage`
- 同时反映到 URL：`/results?job=<job_id>`，这样链接可分享、刷新不丢
- Results 页优先读 URL param，回退到 `localStorage`

**不需要后端落盘** —— 后端 `jobs` dict 已经按 job_id 存着结果和数据集。

## 验收标准

- [x] `/analysis` 与改造前的 dashboard 行为完全一致
- [x] `/results` 可直达，未跑分析时显示空状态
- [x] 侧栏高亮跟随实际路由
- [x] 未实现的入口是明确的禁用态，不是假高亮
- [x] 跑完分析后 URL 带上 job id，刷新页面结果还在
- [x] `npm run build` 通过

## 实测

```
构建     ✓ Compiled successfully  路由: / · /analysis · /results
/        → 200，最终 URL 落在 /analysis
/analysis→ 200，侧栏 Run Analysis 带 aria-current="page"
/results → 200
侧栏     3 个禁用项（Dashboard / Data Sources / Settings），带 title 说明
跨页数据 mock 模式跑出真实 job：result.id == job_id ✓
         /api/status/{job} 跨域 200，CORS 头正确
         /api/results/{job}/metadata 返回 10 个面板
响应体   dataset 字段未泄漏进 JobStatus ✓
```

## 落地方式

- `src/app/page.tsx` 改为 `redirect("/analysis")`；原内容 `git mv` 到 `src/app/analysis/page.tsx`，保留文件历史
- 新增 `src/lib/jobSession.ts` 统一管理「当前看的是哪次运行」：URL 优先、localStorage 兜底
- 跑完分析用 `history.replaceState` 写 URL，而不是 `router.replace` ——
  后者会触发导航、重跑页面 effect，把刚拿到的结果再取一遍
- `/analysis` 挂载时按 job id 回填结果，刷新不用重跑（重跑要再花一次语料成本）
- `/analysis` 结果区下方加了「Break these themes down by metadata」入口，
  解决会议 §13 柯老师问的「怎么引导用户去 Results」
- 侧栏链接自动带上当前 job id，从 Results 点进去不会是空页

## 遗留

- `/results` 首屏 SSR 是 "Loading run…"，hydrate 后才切到空状态（localStorage 在服务端读不到）。
  有一次短暂闪烁，可接受。
- 上述验证覆盖路由、构建、跨页数据流；**ready 状态的视觉渲染没有在浏览器里人眼确认过**。
  步骤 05 做图表时会自然覆盖到。
