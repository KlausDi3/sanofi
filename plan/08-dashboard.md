# 08 · Dashboard 落地页

**状态：✅ 完成（A1 范围：只做页面，不做落盘）**

---

## 目标

把侧栏那个一直灰着的 Dashboard 变成真正的落地页：最近运行 + 数据集概览 + 快速开始。

不在原计划 01–07 里，是 2026-08-28 讨论时加的。

## 为什么

三个理由，按重要性排：

1. **历史运行原本无法访问。** `/results` 只认「最近一次」，跑过的第 3 次运行再也打不开。
   `interface功能文档.md` 里把这条标成「⚪ 未实现」，会议 §13 讨论「怎么引导用户去 Results」时
   也没解决这一层。
2. **缓解 Mian 说的「dashboard 已经很满了」**（§13）。把「看历史 / 挑数据集」移出分析页。
3. **月底 Sanofi 汇报需要一个开场。** 落在满是上传控件的表单页，不如落在
   「这个平台跑过什么、有哪些数据」。

## 改动

### 后端

| 改动 | 说明 |
|---|---|
| `/api/jobs` 改为投影 | **原来直接 `return list(jobs.values())`** —— 而 job 上挂着 `dataset`，所以整张元数据表（含 NPI、医生真名、执业邮编、传记）随列表一起返回。三次运行 2.5 MB。现在只回 counts 和 labels，同样三次 627 字节 |
| `_now_iso()` | 时间戳改为带时区的 UTC。原来 `datetime.now().isoformat()` 不带时区，浏览器按本地时间解析 —— Render 服务器是 UTC 而用户在 EDT，「刚跑完」会显示成「4 小时前」 |

### 前端

```
src/app/dashboard/page.tsx     新页面
src/app/page.tsx               / 从 → /analysis 改为 → /dashboard
src/components/Sidebar/        Dashboard 从禁用改为可用
src/lib/hicode.ts              fetchJobs()
src/types/analysis.ts          JobSummary；Datasource 加 metadataColumns
```

页面内容：

- **统计条** —— 数据集数 / 完成运行数 / 平均主题数 / 可用文档总数
- **最近运行**（最多 8 条）—— 问题、数据集、主题数、`N of M analysed`、相对时间、状态徽章，
  每条带「Themes」和「Metadata」两个入口，跳到**那一次**的结果
- **数据集卡片** —— 条数 + 元数据列数（列数为 0 时明说不支持交叉视图）
- **开始新分析**按钮

## 验收标准

- [x] 侧栏 Dashboard 可用并高亮，`/` 落到 `/dashboard`
- [x] 最近运行按时间倒序，显示问题 / 数据集 / 主题数 / 相对时间
- [x] 点历史运行的 Metadata 打开的是**那一次**，不是最近一次
- [x] 数据集卡片显示元数据列数
- [x] 后端不可达时显示说明而非崩溃
- [x] 无运行时显示空状态
- [x] `/api/jobs` 不再泄露数据集内容
- [x] `npm run build` 通过

## 实测

headless 截图核对：统计条 `3 数据集 / 4 运行 / 5 主题 / 1,120 文档`；四条运行按倒序列出，
相对时间 `just now` 正确（时区修复生效）。

打开最旧一次运行的 Metadata：显示的是那次的问题「How were patients referred to this provider?」，
而不是最新的「What did patients say about wait times?」——
且该次跑的是 1000 条数据集，`Categorical 5`（`Specialty` 在 1000 条上取值过多被排除），
与 100 条数据集的 6 个面板不同，说明确实读的是对应那一次的数据。

## 遗留：A2 没做

**任务存在内存里**（`jobs: dict`），所以「最近运行」列表在后端重启后清空，
Render 免费实例休眠后也清空。页面已经明说这一点（"Held in memory by the API —
restarting it clears this list"），不假装是历史记录。

真正的持久化就是会议 §14 说的 `df_sim` 落盘。我在 `DECISIONS.md` D-2 里判断第一版不需要 ——
那个判断在「只看最近一次」的前提下成立，**但 Dashboard 做出来之后就不成立了**：
一个会被清空的历史列表价值有限。

不过落盘的正解取决于 Render 用不用付费持久盘（免费实例的磁盘同样是临时的），
那是个部署决策，留给下一轮和效率优化一起做。
