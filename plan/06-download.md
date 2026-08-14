# 06 · 结果下载（JSON + PDF）

**状态：✅ 完成**

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

- [x] JSON 下载内容与 `result` 一致，文件名带 job id
- [x] `report.html` 在浏览器里排版正常
- [x] 报告里的数字与界面显示一致
- [x] 没有结果时按钮不出现
- [x] 报告**不含**任何 metadata 分析内容（本轮范围外）
- [ ] 打印预览分页 ← **未验证，见遗留**

## 实测

```
GET /api/results/{job}/report.html   → 200  text/html
GET /api/results/nope/report.html    → 404
未完成的 job                          → 409
章节生成                              Themes · Theme prevalence · Theme co-occurrence
```

报告数字与界面一致：5 themes / 117 documents / 18 analysed after filtering / 123 unique labels；
prevalence 表 Recommendations 23 docs · 25 labels；共现矩阵对称、对角线为 `—`。

前端 Export 按钮出现在 Results 面板标题栏右侧，下拉两项（Printable report / JSON）。

## 落地方式

- 不引入 Jinja2 —— 为一个模板加依赖不划算，和之前不引入 pandas 同理。
  用标准库拼字符串，所有插值走 `html.escape`（主题名和标签来自 LLM，评论正文来自公开网页，都不能当作可信标记）
- PDF 不在服务端生成 —— 那意味着镜像里要塞一个无头浏览器或整套渲染栈，
  而浏览器自带的「打印为 PDF」不需要任何依赖就能到达同一结果
- 报告顶部有一条 `no-print` 提示，告诉用户用打印对话框存 PDF
- `start_analysis` 顺带记下 `dataset_name`，报告里能标明数据来源

## 过程中修掉的问题

**评论正文里的 HTML 实体被二次转义** —— 源数据是抓取时未解码的，
正文里带着 `&#39;` 这类实体，直接转义会把实体本身显示出来（`Northwest Women&#39;s`）。
改为先 `unescape` 再 `escape`：显示正常，且因为最终仍然转义，安全性不变。

## 遗留

- **打印分页没有实际验证** —— `@media print` 规则写了（`break-inside: avoid` 等），
  但没在真实打印预览里看过。需要人工过一遍。
- **同样的 HTML 实体问题在前端界面也存在** —— `TopicItem` 渲染评论原文时一样会显示 `&#39;`。
  属于既有问题，本轮没动。根治应该在 `read_dataset` 入库时解码，
  但那会同时改变送进 LLM 的文本，影响面更大，需要单独评估。
- 导出的 JSON 含 `documentTexts`（评论原文）和 `docThemes`。
  若要对外分享，应考虑提供不含原文的精简版。
