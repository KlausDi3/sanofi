# 03 · 数据集与数据治理

**状态：✅ 完成** — D-1 已决（2026-08-14：维持 public、照常提交）

---

## 目标

会议 §2 §3 §10 + Teams 7/23：

1. 删掉过小的示例数据集（10 / 20 / 50 条）
2. 换成从 `doctor_review_sample1000.csv` 抽出的 **100 条**样本，带完整元数据
3. 保留 1000 条全量作为后续效率测试用

Mian 的原话（Teams 7/23）：

> I think we need to proceed with a larger dataset and remove the smaller ones in current implementation.

以及会议 §10 里定的折中：1000 条跑一次太慢也有真实 API 成本，
所以**先从 1000 里再抽 100** 做功能开发，效率优化留到下一轮（步骤 07）。

## 为什么阻塞

见 `DECISIONS.md` D-1。一句话：`syntheticdata/` 是**真实患者评论**，
其 README 明确要求不要推到公开仓库，但 `KlausDi3/sanofi` 是 public 且该目录早已在上面。
新的 100 条样本带 NPI、医生真名、执业邮编、传记原文，敏感度更高。

D-1 已决定接受该风险、照常提交，本步据此推进。

## 要做的

### 1. 分层抽样

**不能用随机抽样。** 直接 `sample(100)` 会让某些分类取值只剩个位数，
子 tab 的图直接退化（`self-referral` n=5 显示 100% 的老问题会被放大）。

按 `Gender` × `platform` × `PhysicianType` 做分层抽样，保证每个取值都有足够样本。
抽完要打印各维度分布做验证。

参考全量 1000 条的分布：

```
Gender        : M 714 / F 286
PhysicianType : Specialty 653 / Primary Care 269 / Super Specialties 78
platform      : Vitals 417 / HG 413 / Yelp 106 / RateMD 64
state         : CA 161 / FL 115 / TX 85 / NY 84 / …（90 条为空）
```

`Super Specialties` 只占 7.8% —— 100 条里大约 8 条，是最需要保底的一档。

### 2. 落地文件

- 新增：100 条样本（文件名和位置取决于 D-1 的方案）
- 删除：`doctor_reviews_10.csv`、`doctor_reviews_20.csv`、`doctor_reviews_50.csv`
- 保留：`physician_reviews.csv`（schema 完全不同，是 data-agnostic 的活体测试用例）
- 更新：`syntheticdata/README.md` —— 现在的内容已经和事实不符

### 3. 顺带修

`load_csv_dataset` 的问题已在步骤 01 修好，新数据集放进去就能直接用，无需再改代码。

## 验收标准

- [x] D-1 已决策并记录
- [x] 100 条样本各分类维度分布与全量接近，最小档 ≥ 8 条
- [x] 小数据集已删除，UI 下拉框只剩预期的几项
- [x] `syntheticdata/README.md` 与实际情况一致
- [x] metadata 端点返回 ≥ 3 个 categorical panel（实得 6 个）

## 实测

抽样结果（`--seed 20260728`），三个维度全部落在源分布 1.5 个百分点内：

```
Gender         M 70.0% / F 30.0%                      source 71.4% / 28.6%
PhysicianType  Specialty 64% · Primary Care 27% · Super Specialties 9%
                                                      source 65.3% / 26.9% / 7.8%
platform       Vitals 42% · HG 40% · Yelp 10% · RateMD 8%
                                                      source 41.7% / 41.3% / 10.6% / 6.4%
```

23 个非空层，最小分配 1，最大 20。`Super Specialties` 拿到 9 条（保底目标 8）。

数据源下拉框：

```
physician_reviews    docs=20   metadata=3 列
doctor_reviews_100   docs=100  metadata=22 列
```

metadata 端点在新数据集上产出 **10 个面板**：

```
categorical      platform · Gender · Credential · PhysicianType · Specialty · state
continuous       num_reviews · population · population_density · median_household_income
```

对比 1000 条全量时的分类结果，`Credential` 从 highCardinality 降为普通 categorical、
`Specialty` 从 excluded 升为 highCardinality —— 阈值随实际数据自适应，
正是会议 §7 要的 data-agnostic 行为。

## 遗留

上面的端点验证是**注入已完成 job** 做的，不是真跑一次 LLM ——
本地 OpenAI key 额度耗尽（`429 insufficient_quota`），线上 Render 的 key 正常。
注入用的是 notebook 那次运行的主题，与新样本只有 9 条重叠，
所以面板里的样本量偏小；真跑一次会覆盖大部分文档。
**补上额度后应在本地真跑一次复验。**
