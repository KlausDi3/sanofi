# 06 · 结果下载（JSON + PDF）

**状态：⬜ 未开始** · 预估 0.5 天 · 可与 04 / 05 并行

---

## 目标

在 Dashboard 的 Results 区加一个下载按钮，导出跑完 pipeline 的结果。

对应会议 §4 §10。

## 范围（会议明确限定）

Mian 在 §10 里说得很清楚：

> download results 的部分，其实我觉得我们现在可以先不用加 metadata，
> 只是把这一部分的东西 download 下来就可以了，就现有的这些。

**本步只导出现有 pipeline 结果**（topics / labels / 主题统计 / 共现），
**不含 metadata 分析**。metadata 的导出留到 metadata 页做完之后再说。

## 格式：两个都做

会议 §4 的讨论没定死（「JSON 还是 PDF」「也都可以吧」）。
两个成本都很低，没必要二选一 —— 见 `DECISIONS.md` D-6。

| 格式 | 实现 | 面向 |
|---|---|---|
| **JSON** | 前端 `Blob` + `URL.createObjectURL`，**零后端改动** | CS 侧、需要二次处理 |
| **PDF** | 后端出 HTML → 前端开新窗 `window.print()` → 用户存 PDF | Sanofi 侧、直接阅读 |

PDF 走 print 而不是装 weasyprint / puppeteer：
后者要往 Render 镜像里塞一个无头浏览器或一整套渲染依赖，构建时间和体积代价都不小，
而这里只需要一份能打印的报告。Mian 关心的是「对他们来讲能不能看」，print 输出完全够。

## 改动

### 后端

```
GET /api/results/{job_id}/report.html
```

用 Jinja2 模板（FastAPI 依赖里已有）渲染：

- 标题 / 研究问题 / 数据集 / 运行时间
- 汇总：主题数、文档数、筛选后文档数、标签数
- 每个主题：名称、标签云、命中文档数、若干条代表性评论原文
- 主题普遍度表 + 共现矩阵表
- 内联 `@media print` 的 CSS，控制分页

### 前端

- Results 面板顶部加下载按钮（会议 §10：「在这四个 tab 附近加个 download button」）
- 下拉两项：Download JSON / Download PDF
- JSON 直接从内存里的 `results` 对象序列化
- PDF 开新窗口指向 `report.html`，`onload` 后触发 `window.print()`

## 验收标准

- [ ] JSON 下载内容与 `/api/status/{job_id}` 的 `result` 一致，文件名带 job id
- [ ] `report.html` 在浏览器里排版正常，打印预览分页合理
- [ ] 报告里的数字与界面显示一致
- [ ] 没有结果时按钮禁用
- [ ] 报告**不含**任何 metadata 分析内容（本轮范围外）

## 备注

导出的 JSON 里含 `documentTexts`（评论原文）和 `docThemes`。
如果之后要给外部分享，需要考虑是否提供一个「不含原文」的精简版 ——
记一笔，本轮不做。
