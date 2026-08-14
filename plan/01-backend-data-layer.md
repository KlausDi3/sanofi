# 01 · 后端数据层：列名自适应 + 保留 metadata

**状态：✅ 完成** — commit `411177c`，分支 `feat/metadata-analysis`

---

## 目标

让后端能读两种 schema 的 CSV，并且**不再丢弃元数据列** —— 这是整个 metadata 功能的地基。

## 为什么需要

原来的 `load_csv_dataset()` 把列名写死了：

```python
doc_id = row.get('id', ...)          # 新数据集用的是 text_id
text   = row.get('review_text', '')  # 新数据集用的是 text
return documents                     # 其余 22 列全部丢弃
```

两个后果：

1. `notebooks/doctor_review_sample1000.csv`（`text_id,text,...`）读进来是**一堆空字符串，且不报错** ——
   会静默跑完整个 pipeline 然后产出垃圾结果
2. 元数据列压根没进系统，metadata 功能无从谈起

## 改动

`hicode-api/main.py`

| 新增 | 说明 |
|---|---|
| `detect_columns(fieldnames)` | 从表头里识别 id 列和文本列；候选名 `text_id/id/doc_id/document_id`、`text/review_text/review/content/body` |
| `read_dataset(filepath)` | 返回 `{documents, rows, id_column, text_column, metadata_columns}`，`rows` 是原始行 |
| `load_csv_dataset(filepath)` | 保留为 `read_dataset(...)["documents"]` 的薄封装，调用方不用改 |

其他：

- `get_available_datasources()` 增加 `metadataColumns` 字段，前端可以据此提示某数据集是否支持 metadata 视图
- 找不到文本列时**抛出明确异常**，而不是静默返回空文档
- `start_analysis` 把 `dataset` 挂到 job 上（不进 `JobStatus` 响应，避免把整张元数据表回传前端）

## 验收标准

- [x] 两种 schema 的 CSV 都能正确读出非空文本
- [x] 5 份既有数据集回归通过（`id`/`review_text`）
- [x] 24 列新数据集读出 1000 篇文档、22 个元数据列
- [x] `JobStatus(**jobs[job_id])` 不因新增的 `dataset` 键报错，且 `dataset` 不泄漏进响应

## 实测

```
doctor_reviews_10.csv          id=id       text=review_text  docs=10    meta=2
doctor_reviews_100.csv         id=id       text=review_text  docs=100   meta=2
physician_reviews.csv          id=id       text=review_text  docs=20    meta=3
doctor_review_sample1000.csv   id=text_id  text=text         docs=1000  meta=22
```

## 备注

`physician_reviews.csv` 的元数据列是 `rating / physician_specialty / date` —— 和医生评论那几份完全不同。
这正好验证了「data-agnostic」这个目标（会议 §7）：换一份表格，metadata 视图应该自动适配。
