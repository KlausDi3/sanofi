# HICODE 平台 · metadata 可视化迭代

这一轮的目标来自 **2026-07-28 组会**（`Meeting record/meeting-0728.md`）和 Mian Zhong 在 Teams 上的补充说明：
把 `notebooks/metadata-incorporation.ipynb` 的分析能力搬到 HICODE 平台上，让研究者跑完
分析后能在一个独立页面里看到 **主题 × 元数据** 的交叉结果，并能把结果导出。

算法没有新东西 —— 本轮本质是**迁移 + 前后端联动**。

---

## 怎么用这个文件夹

| 文件 | 作用 |
|---|---|
| `README.md` | 你在看的这个：进度总表 + 当前阻塞 + 下一步 |
| `01` … `07-*.md` | 每个步骤一个文件：目标 / 改哪些文件 / 验收标准 / 状态 |
| `DECISIONS.md` | 待决事项和已决事项，含决策理由 |

**每完成一步**：更新该步文件顶部的 `状态`，并同步下面的进度总表。

---

## 进度总表

| # | 步骤 | 状态 | 产出 |
|---|---|---|---|
| 01 | [后端数据层：列名自适应 + 保留 metadata](01-backend-data-layer.md) | ✅ 完成 | `411177c` |
| 02 | [后端 metadata 分析 + API 端点](02-backend-metadata-analysis.md) | ✅ 完成 | `411177c` |
| 03 | [数据集与数据治理](03-dataset-and-governance.md) | ✅ 完成 | 100 条分层样本 |
| 04 | [前端路由拆分](04-frontend-routing.md) | ✅ 完成 | `/analysis` + `/results` |
| 05 | [前端 Results 页 + metadata 图表](05-frontend-results-page.md) | ✅ 完成 | 10 个面板 |
| 06 | [结果下载（JSON + PDF）](06-download.md) | ✅ 完成 | JSON + 可打印报告 |
| 07 | [效率优化：放大到 1000 条](07-efficiency.md) | ⬜ 下一轮 | |

图例：✅ 完成 · 🔵 进行中 · ⬜ 未开始 · ⛔ 阻塞

---

## 当前阻塞

无。D-1 已于 2026-08-14 决策（维持 public、数据集照常提交），步骤 03 阻塞解除。

---

## 下一步

**本轮范围（01–06）已全部完成。** 剩下的是收尾，不是开发：

1. **人工过一遍** —— 起前后端，把三个 tab、导出、打印预览都点一次。
   自动化验证覆盖了数据和渲染，但打印分页、下拉菜单交互没人眼确认过。
2. **合并到 `main`** —— 目前都在 `feat/metadata-analysis` 分支上。
3. **部署到 Render 并发链接给团队试用** —— 会议 §12 说好 8 月 10 日左右在 Teams 发链接，
   这个节点已经过了。
4. **补本地 OpenAI 额度** —— 本地 key 额度耗尽，全程无法真跑一次完整 pipeline，
   所有验证都是 mock 模式或注入 job 完成的。**上线前应至少真跑一次复验。**

之后 07 效率优化留到下一轮，为月底与 Sanofi 的汇报做准备。

---

## 时间线

| 日期 | 事项 |
|---|---|
| 2026-07-28 | 组会，确定本轮范围 |
| 2026-08-10 | 原定 Teams check-in（**已过期**） |
| 2026-08-15 | Junjie 开会回来，可开 internal meeting |
| 2026-08 月底（周五） | 与 Sanofi 汇报两个月进度 ← **硬 deadline** |

按 04/05/06 的估算（约 3 天）打完，距月底汇报仍有余量。

---

## 需求来源对照

| 需求 | 会议出处 | 落在哪步 |
|---|---|---|
| 删掉过小数据集，换成 1000 抽 100 | §2 §3 §10 + Teams 7/23 | 03 |
| Results 加 Download 按钮（先不带 metadata） | §4 §10 | 06 |
| 新增独立 Results 页承载 metadata 可视化 | §5 §11 + Teams 7/22 | 04 05 |
| 每个 metadata 变量一个子 tab（ydata census 风格） | §11 + Teams 7/22 截图 | 05 |
| 列类型自动识别（unique ≤ 10 → categorical） | §7 | 02 ✅ |
| merge 主题结果与原始 metadata | §8 | 02 ✅ |
| Dashboard ↔ Results 联动 | §13 | 05 |
| df_sim 落盘（filesystem，不上数据库） | §14 | 见 D-2，本轮可能不需要 |
