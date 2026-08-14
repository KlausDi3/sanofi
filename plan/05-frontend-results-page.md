# 05 · 前端 Results 页 + metadata 图表

**状态：⬜ 未开始** · 预估 2 天 · **本轮最大的一块** · 依赖步骤 04

---

## 目标

在独立的 Results 页里呈现 **主题 × 元数据** 交叉分析，每个元数据变量一个子 tab。

对应会议 §5 §11 §13，以及 Mian 在 Teams 7/22 发的参照物：
[ydata-profiling census report](https://docs.profiling.ydata.ai/latest/examples/census/census_report.html)
—— 他的原话是「每个 metadata 有一个自己的 tab」。

## 布局

```
┌─ Run 选择器：显示当前 job 的 query / 数据集 / 主题数 ──────────┐
├───────────────────────────────────────────────────────────┤
│  [ Overview ]  [ Categorical ]  [ Continuous ]              ← 一级
│                                                             │
│  [gender] [platform] [physician type] [+ 更多列]            ← 二级（每变量一个）
│                                                             │
│  ┌─────────────── 图表区 ────────────────┐                 │
│  │  categorical → 堆叠柱 / 分组柱（可切换） │                 │
│  │  continuous  → 箱线图                   │                 │
│  └──────────────────────────────────────┘                 │
│  样本量提示 · 折叠类别提示 · 被排除列说明                     │
└───────────────────────────────────────────────────────────┘
```

- **Overview**：主题总览 + 哪些列可用 / 哪些被排除及原因
- **二级 tab**：由 `columnTypes` 驱动，数据集换了自动变（这就是会议 §7 说的 data-agnostic）
- **「+ 更多列」**：放 `highCardinality` 那批（`state`、`Credential`），默认收起

## 数据来源

```
GET /api/results/{job_id}/metadata     → { columnTypes, panels }
```

后端已经算好，前端**不做任何统计计算**，只渲染。契约见 `02-backend-metadata-analysis.md`。

## 图表实现

已装 `recharts@2.15`，不需要新依赖。

| 图 | 实现 |
|---|---|
| 堆叠柱（`byTheme`） | `<BarChart>` + `stackId`，直接用 |
| 分组柱（`byCategory`） | `<BarChart>` 多 `<Bar>`，直接用 |
| 箱线图（continuous） | **Recharts 没有原生箱线图**，自绘 SVG |

自绘箱线图可以照抄 `src/components/Results/CoOccurrenceHeatmap.tsx` 的结构 ——
那个组件已经是纯 SVG 手绘（196 行），有现成的坐标映射、色阶、tooltip 模式可参考。

后端给的是五数概括 + `outliers`，画起来是纯几何，不需要在前端算分位数。

## 必须做对的三件事

### 1. 样本量要可见

后端每个分组都给了 `n`。notebook 里 `self-referral` 只有 5 篇文档却显示「100% 男医生」，
这种图给 Sanofi 看会出问题。

- 在图上或 tooltip 里显示 `n`
- `n` 小于阈值（建议 10）的分组降低不透明度 + 标注
- 面板顶部给一句总样本量说明

### 2. 折叠要说明

`highCardinality` 的 panel 带 `foldedCategories`，非 0 表示图是截断的。
必须显式写「另有 N 个类别已折叠为 Other」，否则 `Other` 会被读成一个真实类别。

### 3. 被排除的列要给理由

`columnTypes.excluded` 带 `reason`。在 Overview 里列出来，
让研究者知道 `PracticeZip5` 是被**主动排除**的，而不是系统漏了。

## 空状态

会议 §13 里柯老师问「怎么引导用户去 Results」。三种状态都要处理：

| 状态 | 显示 |
|---|---|
| 没有 job id | 引导卡片 + 「去跑一次分析」按钮跳 `/analysis` |
| job 未完成（409） | 进行中提示 + 轮询 |
| 有结果但无 metadata | 显示 `unavailableReason`（如「上传的文件不含元数据列」），不报错 |

反向也要做：`/analysis` 跑完后给一个「查看 metadata 分析 →」的入口。

## 新增文件

```
src/app/results/page.tsx
src/components/Metadata/MetadataPanelTabs.tsx      一级 + 二级 tab
src/components/Metadata/CategoricalPanel.tsx       堆叠柱 / 分组柱
src/components/Metadata/BoxPlot.tsx                自绘 SVG 箱线图
src/components/Metadata/ExcludedColumnsNote.tsx    排除列说明
src/lib/hicode.ts                                  加 fetchResultMetadata()
src/types/analysis.ts                              加 MetadataPanel / ColumnTypes
```

## 验收标准

- [ ] 二级 tab 由数据集实际列驱动，换数据集自动变
- [ ] categorical 两种视图可切换，数值与后端一致
- [ ] 箱线图五数位置正确，离群点单独画
- [ ] 每个分组的 `n` 可见，小样本有视觉弱化
- [ ] 折叠类别有明确说明
- [ ] 被排除列及原因在 Overview 可见
- [ ] 三种空状态都有合理呈现，不出现红色错误条
- [ ] 用 `physician_reviews.csv`（完全不同的 schema）验证 data-agnostic
- [ ] `npm run build` 通过

## 备注

会议 §11 提到「让柯老师帮忙设计」。上面是功能骨架和数据契约，
视觉细节（配色、间距、tab 样式）留给柯老师，两边不冲突。
