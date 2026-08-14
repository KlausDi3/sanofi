# 决策记录

---

## ✅ D-1 · 演示数据集放哪里（已决 2026-08-14）

> **决定：仓库维持 public，数据集照常提交。**
> 由 Zeleikun 拍板。风险已当面说明两次（见下方背景），项目方选择接受。
> 步骤 03 据此解除阻塞。
>
> 待跟进：4 列版评论自 2026-02-02 起已公开，属既成事实，本决定一并覆盖。
> 建议仍在 8 月底给 Sanofi 的汇报里列为 open issue，由合作方判断是否需要处理。

### 背景

`syntheticdata/README.md` 里写着：

> Despite the directory name, the CSV files here are **real patient review samples
> scraped from Vitals / RateMDs / Yelp**, not synthetically generated text.
> Because reviews contain identifiable physician names and patient narratives,
> **do not push this directory to a public repo.** The parent repository is
> private; keep it that way.

但实测（未登录）：

```
https://raw.githubusercontent.com/KlausDi3/sanofi/main/syntheticdata/doctor_reviews_100.csv → 200
https://raw.githubusercontent.com/KlausDi3/sanofi/main/syntheticdata/README.md              → 200
```

`KlausDi3/sanofi` 是 **public**，该目录自 `5d7e0b9`（2026-02-02）起就在上面 —— 连那句警告本身都是公开的。
这是历史遗留，不是本轮造成的。

本轮要新增的演示数据集来自 `notebooks/doctor_review_sample1000.csv`，带 24 列：

```
NPI · FirstName · LastName · DocName · PracticeZip5 · BusinessZip5
biography_doc · education_doc · Gender · Credential · Specialty · PhysicianType
platform · num_reviews · population · population_density · median_household_income
county · city · state
```

比现有 4 列版本敏感一个量级。**在决策前不往 `syntheticdata/` 加任何新数据文件。**

### 选项

| | 方案 | 优点 | 代价 |
|---|---|---|---|
| A | 把 `KlausDi3/sanofi` 转为 private | 一条命令，同时解决历史遗留 | 公开演示链接受影响（需确认 Render 是否依赖公开访问） |
| B | 演示数据集只进实验室私有仓库 `JHU-CDHAI/Sanofi` | 归属最合理 | 两个仓库分叉，本地开发要手动同步 |
| C | 做去标识化版本进 `syntheticdata/` | 公开仓库可继续用 | 评论正文本身仍是真实患者叙述，去标识化不彻底 |
| D | 数据文件加 `.gitignore`，仅本地 | 立刻可继续开发 | 部署环境拿不到数据，线上演示不了 |

**状态：已决 —— 采用「维持 public，照常提交」，即上表之外的第五种：接受风险。**

---

## 🟡 D-2 · df_sim 要不要落盘（建议本轮跳过）

### 背景

会议 §14，Junjie 提议把 dashboard 跑出的 `df_sim` 存到 Render 的 folder，Results 页再读，
不搞数据库，用 filesystem + query index。

### 分析

第一版**不需要**。理由：

- metadata 面板必须在后端算（原始 CSV 的 22 列元数据只有后端有），而后端 `jobs` dict
  本来就按 `job_id` 存着结果
- 前端只要把 `job_id` 存进 `localStorage` + URL，Results 页拿 `job_id` 调
  `/api/results/{job_id}/metadata` 就能联动 —— 一行落盘代码都不用写

落盘的真正价值是「服务重启后还能看历史」，属于 nice-to-have。

### 另外要提醒团队的

**Render 免费实例的文件系统是 ephemeral 的，重启即清空。** 所以落盘并不能真正解决持久化，
要么挂付费 persistent disk，要么上 S3。这一点会议上没人提到，建议写进给 Sanofi 的汇报当 open issue。

**建议：本轮跳过，用 `job_id` 传递。列入下一轮。**

**状态：待确认（若无异议按建议执行）**

---

## ✅ 已决

### D-3 · metadata 分析放后端而非前端

**决定：后端算 value，前端只渲染。**

依据会议 §11 Junjie 的说法（「我们算出来那个 value…前端应该有现成的包」）。
后端本来就是 Python，notebook 代码可直接移植；元数据列也只有后端拿得到。

### D-4 · 不引入 pandas

**决定：`metadata_analysis.py` 用纯标准库实现。**

venv 里没有 pandas，而这个模块只需要 group-by 和分位数。pandas 是重量级 wheel，
加进 Render 镜像会显著拖慢构建，收益不成比例。

### D-5 · 超过 10 个取值的分类列不再直接丢弃

**决定：新增 `highCardinality` 档，保留并截断到 top 12。**

notebook 的规则（unique ≤ 10 → categorical）会让 `state`(40) 和 `Credential`(19) 整列消失，
而 S2 在 notebook 末尾还留了一段按州画地图的代码 —— 说明州是他关心的维度。
默认视图仍按会议约定只显示 ≤10 的那批，`highCardinality` 放在「更多列」后面，两边都不牺牲。

### D-6 · 下载格式 JSON 和 PDF 都做

会议 §4 的 Open Question。JSON 前端一个 `Blob` 就够（零后端改动），
PDF 用后端出 HTML + 前端 `window.print()`（半天），没必要二选一。
