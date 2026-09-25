# 09 · Token 用量显示

**状态：✅ 完成**

---

## 目标

让每次运行花了多少 token、大约多少钱，在页面上看得见：Dashboard 汇总 + 每条运行，
分析页运行中实时计数，结果摘要栏和打印报告各显示一次。

2026-09-25 在 08 Dashboard 之后加的。

## 为什么

- 后端每次调 OpenAI 都拿到了 `response.usage`，但直接丢掉了。50 篇文档要打 50 次标签调用、
  几次聚类、一次 embedding，跑完之后没人说得出这一次花了什么。
- 对 Sanofi 汇报，「这次分析花了 0.4 美元」比 token 数直观，所以顺带做了费用估算。

## 改动

### 后端

| 改动 | 说明 |
|---|---|
| `src/usage.py` 新模块 | `UsageTracker` 按阶段（embedding / generation / clustering）累加 usage；`on_update` 回调在每次调用后把快照写回 `jobs[job_id]["usage"]`，所以 `/api/status` 轮询时能看到数字在涨 |
| 费用表 `PRICES_PER_1M` | 手工维护的每百万 token 单价，快照 2026-09。模型不在表里 → 费用为 `null` 而不是错的数字；任一阶段未定价则整体费用也为 `null`，避免部分金额被当成全价 |
| `generate_labels` / `cluster_labels_gpt` / `get_embeddings` | 各加一个可选 `usage` 参数，不传时行为不变 |
| `JobStatus.usage`、`result["usage"]`、`/api/jobs` 摘要 | 三处都带 usage；导出 JSON 因此自动包含 |
| `report.py` | 统计条加「Tokens used」和「Estimated cost」 |
| mock 模式 | `mock_usage()` 按文本长度估一份看起来合理的用量，UI 才有东西可排版；结果本身已标 `mock: True`，前端显示时注明 simulated |

### 前端

```
src/lib/usage.ts                         formatTokens / formatCost / describeUsage / sumUsage
src/types/analysis.ts                    TokenUsage、StageUsage；AnalysisResult / JobSummary 加 usage
src/lib/hicode.ts                        JobStatus 加 usage
src/app/dashboard/page.tsx               统计条第 5 张卡「Tokens used · ~$x」；每条运行「88k tokens · ~$0.01」
src/app/analysis/page.tsx                onProgress 里同步 liveUsage
src/components/Analysis/AnalysisTrigger  进度条右侧实时显示 token 数
src/components/Results/ResultsPanel      摘要栏加一项，hover 看分阶段明细
```

Dashboard 的汇总算的是**全部**运行而非只算完成的：失败的运行在失败前打的调用同样付了钱。

## 验收标准

- [x] 真实模式下三处 OpenAI 调用的 usage 都被累加（embedding 只有 prompt token）
- [x] 运行中 `/api/status` 的 `usage` 逐次增长
- [x] Dashboard 汇总卡 + 每条运行显示 token 与费用
- [x] 结果摘要栏显示本次用量，mock 标注 simulated
- [x] 未定价模型显示 token、不显示费用
- [x] 打印报告包含用量
- [x] `tsc --noEmit` 与 `next build` 通过

## 实测

mock 模式 headless 截图：Dashboard 两条运行各 `88k tokens · ~$0.01`，汇总卡 `176k / ~$0.03`；
结果面板 `88k tokens · ~$0.01 (simulated)`。`/api/status` 返回分阶段 usage，
`estimatedCostUsd` 对未知模型为 `null`（单元冒烟测试）。

真实 OpenAI 调用路径只做了代码层面核对，没有实际烧 key 跑一遍。

## 遗留

- 费用表需要手工跟进 OpenAI 调价。
- 用量和运行历史一样存在内存里，重启即清，见 08 的 A2 遗留。
