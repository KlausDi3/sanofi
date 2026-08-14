# 03 · 数据集与数据治理

**状态：⬜ 未开始** — D-1 已决（2026-08-14：维持 public、照常提交），阻塞解除

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
- [ ] 100 条样本各分类维度分布与全量接近，最小档 ≥ 8 条
- [ ] 小数据集已删除，UI 下拉框只剩预期的几项
- [ ] `syntheticdata/README.md` 与实际情况一致
- [ ] 用新数据集跑通一次完整分析，metadata 端点返回 ≥ 3 个 categorical panel

## 备注

前端步骤 04 / 05 / 06 **不依赖**本步骤。用现有的 `doctor_reviews_100.csv`
（元数据列只有 `PhyID`、`platform`，其中 `PhyID` 会被判为标识符排除）就能开发联调 ——
只会看到 1 个 categorical panel，够验证链路，不够做演示。
