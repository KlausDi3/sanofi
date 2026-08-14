# 02 · 后端 metadata 分析 + API 端点

**状态：✅ 完成** — commit `411177c`，分支 `feat/metadata-analysis`

---

## 目标

把 `notebooks/metadata-incorporation.ipynb` 的 Step 2（列类型识别）和 Step 3（merge + 出图数据）
移植到后端，输出前端可以直接渲染的 JSON。

对应会议 §7（列类型识别）和 §8（merge + 画图）。

## 改动

### 新增 `hicode-api/src/metadata_analysis.py`

```python
infer_column_types(rows, exclude=(id_col, text_col))
    -> {"categorical": [...], "continuous": [...],
        "highCardinality": [...], "excluded": [{"column","reason"}]}

build_metadata_panels(doc_themes, rows, id_column, column_types)
    -> [panel, ...]   # 每列一个 panel，对应前端一个子 tab
```

纯标准库实现，不引入 pandas（见 `DECISIONS.md` D-4）。

### 新增端点

```
GET /api/results/{job_id}/metadata
```

| 情形 | 返回 |
|---|---|
| 正常 | `200` + `{jobId, query, columnTypes, panels}` |
| job 不存在 | `404` |
| job 未完成 | `409`（附当前状态） |
| 上传文件（无元数据） | `200` + `panels: []` + `unavailableReason` |
| 无文档命中主题 | `200` + `panels: []` + `unavailableReason` |

后两种刻意不报错 —— 这是正常情况，前端应该显示说明而不是错误条。

### `build_pipeline_result` 增加 `docThemes`

`{doc_id: [theme, ...]}`，即 notebook 里的 `theme_df`，是 metadata 交叉的 join key。

## 相对 notebook 修掉的 3 个问题

| 问题 | notebook 的表现 | 处理 |
|---|---|---|
| ZIP / NPI 被当连续变量 | 给邮编画箱线图，中位数无意义 | 列名按 camelCase / snake_case / 数字边界分词后匹配标识符词表。原来只做 `"id" in name` 子串匹配，`PracticeZip5`、`PhyID` 全部漏网 |
| 重复列 | `num_reviews` 和 `parsed_review_count` 画出两张一模一样的图 | 按**数值归一化**后的签名去重（`"15.0"` == `"15"`，字符串比较认不出） |
| 取值 >10 的分类列被丢弃 | `state`(40)、`Credential`(19) 整列消失 | 新增 `highCardinality` 档，保留并截断 top 12，`foldedCategories` 报告折叠了多少 |

## 数据契约

**categorical panel**

```jsonc
{
  "column": "Gender",
  "type": "categorical",
  "highCardinality": false,
  "foldedCategories": 0,
  "themes": [...], "categories": ["F", "M"],
  "byTheme":    [{ "theme": ..., "n": 22, "counts": {...}, "pct": {...} }],
  "byCategory": [{ "category": "F", "n": 18, "counts": {...}, "pct": {...} }]
}
```

`byTheme` 对应 notebook 的堆叠柱（每个主题内的元数据构成），
`byCategory` 对应分组柱（每个取值内的主题占比）。两个都给，前端可切换。

**continuous panel**

```jsonc
{
  "column": "median_household_income",
  "type": "continuous",
  "byTheme": [{ "theme": ..., "n": 23, "min":…, "q1":…, "median":…,
                "q3":…, "max":…, "mean":…, "outliers": [...] }]
}
```

> **每个分组都带 `n`。** notebook 的图里 `self-referral` 只有 5 篇文档却显示「100% 男医生」，
> 纯占比图不带分母极易被误读。前端在 `n` 偏小时必须弱化或标注 —— 这条要落到步骤 05。

## 验收标准

- [x] `categorical` 结果与 notebook 的 `cat_columns` 一致（`Gender`/`PhysicianType`/`platform`）
- [x] ZIP / NPI / PhyID 不出现在 `continuous`
- [x] `parsed_review_count` 被识别为 `num_reviews` 的重复列
- [x] `state`、`Credential` 保留在 `highCardinality` 且正确折叠
- [x] 端点 4 条错误路径行为正确
- [x] 每个 panel 分组带 `n`

## 实测

用 notebook 那次真实运行（`82ca572c`，1000 条语料，5 个主题，75 篇文档有主题）注入 job 后打端点：

```
CATEGORICAL     : platform, Gender, PhysicianType
HIGH-CARDINALITY: Credential, state          (state 折叠 10 类，保留 13)
CONTINUOUS      : num_reviews, population, population_density, median_household_income
EXCLUDED        : PhyID/NPI/PracticeZip5/BusinessZip5(标识符)
                  biography_doc/education_doc(长文本)
                  FirstName/LastName/DocName/county/city/Specialty(取值过多)
                  parsed_review_count(重复)
```

```
Gender:  referrals from healthcare providers  n=22  {F: 0.09, M: 0.91}
         consultations and opinions           n=8   {F: 0.13, M: 0.88}
```

## 遗留

- 本地 OpenAI key 额度耗尽（`429 insufficient_quota`），端到端测试是**注入已完成 job** 做的，
  不是真跑一次 LLM。线上 Render 的 key 正常。要在本地跑完整 pipeline 需要补额度。
- `excluded` 里的 `Specialty`(82 类) 其实有研究价值，但 82 个类别画不成图。
  若之后要支持，需要先做专科归组（如按大类合并）。
