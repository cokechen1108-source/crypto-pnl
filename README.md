# Minara Tweets Scored

创作者榜单与推文评分 demo：基于推文内容与衍生数据（转推、交易等）对创作者进行多维度打分与排名。

---

## 评分算法逻辑

当前项目内有两套可用的评分实现，**API 与榜单页实际使用的是 `lib/score/creatorScore.ts`**（基于 mock 创作者数据）。下面先说明这套主流程，再简述另一套基于 `Tweet` / `Trade` 的组件逻辑。

### 一、主流程：`lib/score/creatorScore.ts`

入口：`getLeaderboard()`，对每个 mock 创作者计算 **Content Score**、**Derivative Score**，再合成 **Total Score**。

#### 1. Content Score（内容分）

内容分由四个子维度加权得到：

| 维度 | 权重 | 计算方式 |
|------|------|----------|
| **原创性 (originalityScore)** | 25% | 非转推条数 / 总推文条数 × 100 |
| **洞察力 (insightScore)** | 35% | 对每条**原创**推文打分后取平均，再封顶 100。单条规则：<br>• 文本长度 > 60 字：+20<br>• 含「为什么」或 "thesis"：+30<br>• 含 "narrative" 或「世界观」：+30 |
| **互动质量 (engagementQualityScore)** | 25% | 原创推文总互动量 = `likes + replies×2 + retweets×3`；若 > 200 则为 100，否则为 20 |
| **Minara 亲和 (minaraAffinityScore)** | 15% | 任意一条推文内容含 "minara"（不区分大小写）则为 100，否则为 0 |

**内容总分公式：**

```text
totalContentScore =
  originalityScore × 0.25
  + insightScore × 0.35
  + engagementQualityScore × 0.25
  + minaraAffinityScore × 0.15
```

#### 2. Derivative Score（衍生分）

基于「转推传播效率」的简单指标：

- 仅统计**原创**推文的 `retweets` 之和。
- 公式：`(原创推文总转推数 / 粉丝数) × 1000`，保留两位小数。

粉丝数为 0 时衍生分为 0。

#### 3. Total Score（总分）

```text
totalScore = contentScore × 0.6 + derivativeScore × 0.4
```

榜单按 `totalScore` 降序排列。

---

### 二、备用/组件逻辑

以下模块使用 `types/leaderboard` 中的 `Tweet`、`Trade` 等类型，可作为接入真实数据时的组件或参考实现。

#### 1. `lib/score/contentScore.ts` — 内容分（规则 + 情绪）

- **原创性**：非转推且按内容去重后的条数占比 × 100。
- **洞察力**：每条推文按「长度/140、是否含观点词、情绪分」加权得到 0–1，再平均 × 100；情绪来自 `lib/utils/textAnalysis.ts` 的 `estimateTextSentimentScore`（关键词规则，约 [-3, 3] 再映射到 0–1）。
- **互动质量**：`0.5×likes + 1.5×retweets + 2×replies`，经 `softNormalize(·, 200)`（对数归一、上限约 200）后再平均 × 100。
- **Minara 亲和**：命中「minara / 米娜拉 / ip / fan art / 二创 / 衍生创作 / 同人」等关键词的推文占比 × 100。
- 四维权重：原创性 25%、洞察力 25%、互动质量 30%、Minara 亲和 20%。

#### 2. `lib/score/derivativeScore.ts` — 衍生分（交易）

- 输入为 `Trade[]`。
- 公式：`avgPnl + Math.log(trades.length + 1) × 5`，即平均盈亏 + 交易数量的对数奖励。

#### 3. `lib/utils/textAnalysis.ts` — 情绪估计

- 基于中英文关键词规则（如 赚/爽/机会 vs 跌/亏/risk 等），对单条文本给出约 [-3, 3] 的分数，仅供 contentScore 的洞察力子项使用。

---

## 项目结构（与评分相关）

```text
lib/
  score/
    creatorScore.ts   # 主入口：getLeaderboard，当前 API 使用的评分逻辑
    contentScore.ts  # 基于 Tweet 的内容分（可接真实推文）
    derivativeScore.ts # 基于 Trade 的衍生分（可接真实交易）
  mock/
    mockCreators.ts  # 当前榜单用的 mock 创作者与推文
  utils/
    textAnalysis.ts  # 规则情绪估计
types/
  leaderboard.ts     # Tweet / Trade / ContentScoreBreakdown 等类型
pages/
  api/leaderboard.ts # 榜单 API，调用 getLeaderboard()
  index.tsx          # 榜单页
```

---

## 本地运行

```bash
# 安装依赖
yarn

# 运行 demo 脚本（若存在）
npx tsx scripts/runDemo.ts
```

榜单 API 与前端需在 Next 等框架下启动（本项目含 `pages/api/leaderboard.ts` 与 `pages/index.tsx`，可按你当前框架的启动命令运行）。

---

## 小结

- **当前生效的评分逻辑**：`lib/score/creatorScore.ts` — Content（原创性 + 洞察力 + 互动质量 + Minara 亲和）与 Derivative（转推/粉丝比），再按 6:4 合成总分。
- **扩展方向**：接入真实推文/交易时，可改用 `contentScore.ts` 与 `derivativeScore.ts` 的接口，并替换 mock 数据源；情绪部分仍由 `textAnalysis.ts` 提供规则分数，后续可替换为模型。

---

## 部署（Vercel + Railway）

见 `DEPLOY_VERCEL_RAILWAY.md`。
