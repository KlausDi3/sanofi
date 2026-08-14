# 04 · 前端路由拆分

**状态：⬜ 未开始** · 预估 0.5 天 · 步骤 05 的前置

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

- [ ] `/analysis` 与改造前的 dashboard 行为完全一致（跑分析、看结果、下载都不受影响）
- [ ] `/results` 可直达，未跑分析时显示空状态
- [ ] 侧栏高亮跟随实际路由
- [ ] 未实现的入口是明确的禁用态，不是假高亮
- [ ] 跑完分析后 URL 带上 job id，刷新页面结果还在
- [ ] `npm run build` 通过

## 风险

改动集中在 `page.tsx` 的搬迁。它有 8 个 `useState` 和一个 `handleAnalyze`，
整体搬过去即可，**不要顺手重构** —— 这一步只做位置移动，行为零变化，
出问题时容易定位。
