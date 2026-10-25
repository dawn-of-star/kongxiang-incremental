# 全增益落点总表：a区 / b区 / c区 / 斜率

> **状态：✅ 权威（2026-10-20 按当前 `src/` 逐函数核对）**
> 用途：回答两个问题——
> ① 这个加成到底落在公式的哪一层？② 它改的是**高度**还是**斜率**？
> 与 [`ZONES.md`](ZONES.md) 的分工：ZONES 管「落在哪条产线 / 什么颜色」；
> 本文管「落在公式的哪一层」。两者是**正交**的，不要混用。

---

## 0. 一句话结论

**当前运行路径上没有一个真正的 b区成员。**
被注释/UI 叫作「b区（指数区）」的 `matterTotalExponent`，实际是
`matterCoeff(state, P0).pow(k)` —— 对**一个系数**取幂，不是对资源整体取幂。
它主要改高度，不是改斜率（见 §3、§4）。

中期真正还在改斜率的只有三条：

1. `particleTimeBoost = 10^(b·t)`（粒子线的**时间指数**，`b` 是阶/秒）；
2. `matterSpanMult = (DE_eff / DE₀)^k`（**暗能量资源指数**，`k` 由量子给）；
3. `nekoGlobalExponent`（对全局乘积取 1.022 次幂，幅度极小）。

其中 ① 的 `b` 有软上限、② 的 `DE_eff` 在 `DE_EFF_CAP` 后饱和、③ 基础只有 2.2%
（em2+em7 后约 8.8%）。所以「中期增益落不进指数区」不是错觉，而是**结构性的**（§4）。

> ★ 但**设计稿已经为这一段准备了空间膨胀**（IP 侧的 du1~du10 超指数阶梯，
> 见 §2.2 / §4.5），只是**尚未实装**。
> 因此当前现状是「已实现系统里没有 b区 + 既定解法缺失」，
> **不是**“应该把引擎 ⑤ 改成 b区” —— 后者会与空间膨胀的职责重叠，已撤回（§5）。

> **口径**：本文「中期」指**破∞后到第一次永恒前**（主循环的中间段）；
> 第一次永恒之后的七巧板 / 暗物质 / EP 升级在表里单列「永恒后」。
> 如果你说的中期是「第一次永恒之后」，结论只会更强：那一层连直接的 `b/k` 入口都很少，
> 主要靠七巧板的免费引擎等级间接抬 `k`。

---

## 1. 判据：什么叫 a / b / c

项目规范（`src/config/base.js` 的 `ZONE_RULES`）：

```
资源_next = { [ 资源_prev + (1 × 乘法区) + 加法区 ] ^ 指数区 } × 最终倍率区
              └────────────── a区 ──────────────┘   b区          c区
```

| 记号 | 含义 | 对 `log10(资源)` 的作用 |
|---|---|---|
| `a+` | 加进基础的**加法项** | 改高度（常数偏移） |
| `a×` | 乘在某个速率/系数上的**因子** | 改高度（常数偏移） |
| `a^局部` | 对**系数/因子**取幂，不是对资源整体 | **通常是高度**；只有系数自身随时间增长时才会间接改斜率 |
| `b真` | 对**整个 `{...}`** 取幂 | 斜率 × 指数（真正的指数区） |
| `b时间` | `10^(b·t)` 这种**时间指数** | 斜率 + b（不是资源 b区，但确实改斜率） |
| `b资源` | `(DE/base)^k` 这类**资源指数**，再当因子乘 | 只要 DE 在涨就改斜率；DE 饱和后失效 |
| `c` | 最终倍率（乘在增量/收益上） | 改高度（若乘在存量上则另说） |
| `结构` | 解锁 / 重置 / 价格 / 起点 / 上限 | 改节奏或可达性，不改连续斜率 |

> 判据的关键不是「代码里有没有 `pow()`」，而是**底数是不是整个资源值**。
> `Decimal.pow(常量, 等级)`、`rate.pow(k)`、`系数.pow(k)` 都只是因子，不是 b区。

---

## 2. 全增益落点（按系统）

> 「位置」列的 `a+ / a× / a^局部 / b时间 / b资源 / c / 结构` 见 §1。
> 「中期」列：前期 = 首次大坍缩前；中期 = 破∞后到第一次永恒前；
> 永恒后 = EP / 七巧板 / 暗物质层。

| 系统 | 全部成员 | 代码落点 | 位置 | 改什么 | 中期 |
|---|---|---|---|---|---|
| **可重复升级** | `particleBoost`（计数频率）、`matterBoost`（物质倍率）、`entropyCoeff`（熵凝聚）、`trap`（熵阱） | `countFreqAddTerm` / `kindProduct("matterMul")` / `conversion` / `effectiveTraps` | `a×` / `a+` / `a×` | 高度；`entropyCoeff` 同时改 output/threshold 的斜率 | 前期 |
| **虚空 v1~v9** | v1/v6 ZPE 基础；v2 熵；v3 物质；v4 梦想系数；v5 凝聚产出 +0.5；v7 点击；v8 ZPE 倍率；v9 价格/免费 | `zpeBaseMultiplier` / `entropyRate` / `matterCoeff` / `dreamCoefficient` / `conversion` / `clickGain` / `zpeMultiplier` | `a×`（v5 是 `a+`；v9 是 `结构`） | 高度 | 前中期 |
| **ZPE 里程碑 m1~m6** | m1 点击 +10；m2 升级价 ÷ZPE；m3 ZPE 倍率折半进物质；m4 熵阱有效数 ×ZPE；m5 熵阱价 ÷ZPE；m6 熵凝聚阈值 ÷ZPE | `clickGain` / `cost` / `matterCoeff` 的 `zf` / `effectiveTraps` / `conversion` | `a+` / `a×` / `结构` | 高度；m6 是阈值除法（等价 `a×`） | 前期 |
| **暗能量里程碑 dm0~dm5** | dm0 解锁相变仪；dm1 ZPE ×2；dm2 熵阈值 ÷DE 倍率；dm3 熵 ×DE 倍率；dm4 价格；dm4b 相变 ×全局；dm5 相变 ×DE 倍率 | `darkEnergyRate` / `effectiveDarkEnergyGain` / `conversion` / `entropyRate` / `cost` | `a×` / `结构` | 高度 | 中期 |
| **暗能量升级** | `dreamAnnihilation`（ZPE 惩罚减免）、`phaseShift`（相变 ×1.5^lv）、`vacuumAccel`（DE 倍率 ×1.1^lv）、`deGainBase`（相变增幅 ×1.10/1.12^lv）、`convOutput`（凝聚斜率 +） | `zpeProductionPenalty` / `darkEnergyGainPerConversion` / `darkEnergyMultiplier` / `conversion` | `a×` / `a+` | 高度 | 中期 |
| **∞ 升级** | `ipDouble`、`ipTime`、`ipFromQuantum`、`thresholdFlat`、`pairBoost`、`rate110/121/139/167`、`ipToZpe`、`ipToTransmuter`、`start50/100/150/200` | `ipDoubleMult` / `ipTime` / `quantumPerPair` / `infinityRateMult` / `zpeMultiplier` / `darkEnergyRate` / `start` | `c` / `结构` / `a+` / `a×` / `b时间`（rate） | IP 高度、量子数量、b 斜率、DE 高度 | 中期 |
| **ZPE 引擎** | ①加法区、②ZPE 产出、②b乘算、③计数频率、④DE 自增长、⑤物质系数幂、`bCapMult` | `zpeEngineAddBonus` / `zpeEngineProdMult` / `zpeEngineMultBonus` / `zpeEngineCountFreqUnlocked` / `deEngineLevelBonus` / `matterTotalExponent` / `bCapMult` | `a+` / `a×` / `a^局部` / 上限 | 前四条是高度；⑤多数情况也是高度；`bCapMult` 抬 b 的软上限 | 破∞后 |
| **量子** | `q` 本身；`qm1/qm3/qm6`（b）；`qm2`（档位加速）；`qm4`（DE 自增长）；`qm7`（b 上限）；q→ZPE `q³/10`；q→熵 `1+q`；q→DE `q²`；q→DE 增益 `log10 q`；q→b `√q`；q→k `√q` | `particleBoostRate` / `tierAccelMult` / `deGrowthRate` / `bThresholdOf` / `quantumZpeMultBonus` / `quantumEntropyMultiplier` / `quantumDeMultBonus` / `quantumDeGainBonus` / `matterSpanExponent` | `a+` / `a×` / `b时间` / `b资源` | 前四项是高度；后两项是斜率（b、k） | 中期 |
| **暗物质** | 暗物质个数、第二台相变仪 | `darkMatterAdditiveTerm` → `darkEnergyMultiplier` | `a+` | 高度（且读**余额**，坍缩后归零） | 永恒后 |
| **永恒升级 / 里程碑** | `epMult`（EP ×5/级）；em2（Neko 指数翻倍）；em4（`deGainBase` 1.10→1.12）；em5（IP 倍率）；em6（熵阈值 ÷1.2）；自动化 / 保留类 | `eternityPointGain` / `nekoGlobalExponent` / `deGainBaseEffectMult` / `ipDoubleMult` / `conversion` | `c` / 局部指数 / `a×` / `结构` | EP/IP 高度、熵阈值、自动化 | 永恒后 |
| **七巧板** | 覆盖率 → 免费引擎等级；挑战 → `deKneeMult` / `convSlopeMult` / `ipDoubleKneeMult` / `freeZpeEngineLevels` / `passiveIpFrac` | `effectiveEngineLevel` / `tangramRewardEffects` / `tangramConvRateMult` / `rewardConvSlopeMult` | `a^局部`（经引擎 ⑤）/ `a×` / `a+` / `结构` | 主要是高度；免费引擎等级会间接抬 k 和 b 上限 | 永恒后 |
| **梦想** | 梦想点 → 全局加成；4 条自动化；离线时长；`dreamAnnihilation` 等 | `globalMultiplier` / 自动化 / `offlineCapSeconds` | `a×` / `结构` | 高度、节奏 | 全期 |
| **N.E.K.O** | 好感度 >25/50/75；`em2` / `em7` 可再翻倍加成部分 | `nekoGlobalExponent` → `globalMultiplier` | 局部指数（1.002~1.022；em2+em7 后约 1.088） | 高度/极弱斜率 | 全期（冻结区） |
| **全局乘区** | `梦想点项 × 计数频率项 × 暗能量倍率` | `globalMultiplier` | `a×` | 高度；同时喂熵/粒子/物质/ZPE | 全期 |
| **IP / EP 公式** | IP = `10^(L/ipDivisor − 0.75)`；EP = `5^(log10(IP)/308−0.7)` | `infinityPointGain` / `eternityPointGain` | `结构`（公式自带指数） | 不是升级，决定“高度→收益”的换算 | 全期 |
| **价格 / 起点 / 重置** | v9 / m2 / dm4 / `start50~200` / 坍缩重置 | `cost` / `doBigCrunch` / `resetForCollapse` | `结构` | 节奏、起点高度 | 全期 |
| **过载 / 爬升 / 软上限** | `overloadFactor` / `climbFactor` / `softCapB` / `DE_EFF_CAP` / `matterSpanMult` 硬上限 | `formulas/matter.js` / `formulas/quantum.js` / `config/quantum/growth.js` | `a×` / 上限 | 只压速率，不改存量 | 破∞后 |

---

### 2.1 混合系统的逐项落点

上表里 `∞ / 引擎 / 量子 / 永恒 / 七巧板` 的成员位置不完全相同，这里拆开列：

**∞ 升级**

| id | 效果 | 落点 | 位置 |
|---|---|---|---|
| `ipDouble` | 无限点收益倍率 | `ipDoubleMult` → `bigCrunchGain` | `c`（最终 IP） |
| `ipTime` | 每秒实时 IP | `tick` 的 `infinityPoints +=` | `结构`（收入源） |
| `ipFromQuantum` | 量子 → IP | `quantumToIPGain` → `bigCrunchGain` | `结构` / 加法收入 |
| `thresholdFlat` | 量子门槛压平 + 开启量子共振 | `state.thresholdFlatBought` / `spanDeBase` | `结构`（打开 `b资源`） |
| `pairBoost` | 每对量子 +1 | `quantumPerPair` | `a+`（量子数量） |
| `rate110/121/139/167` | 量子成长速率上限 | `infinityRateMult` → `particleBoostRate` 的 `b` | `b时间`（斜率） |
| `ipToZpe` | ZPE 倍率 += IP×perIp | `zpeMultiplier` | `a+` |
| `ipToTransmuter` | 相变速率 ×(1+IP×perIp) | `darkEnergyRate` | `a×` |
| `start50/100/150/200` | 坍缩后物质起点 | `doBigCrunch` / `resetForCollapse` | `结构`（起点高度） |

**ZPE 引擎**

| 机制 | 落点 | 位置 |
|---|---|---|
| ① 加法区 | `zpeMultiplier += zpeEngineAddBonus` | `a+` |
| ② ZPE 产出 | `zpeRate ×= zpeEngineProdMult` | `a×` |
| ②b 乘算 | `zpeMultiplier` / `darkEnergyMultiplier ×= zpeEngineMultBonus` | `a×` |
| ③ 计数频率 | `zpeMultiplier ×= countFreqAddTerm` | `a×` |
| ④ 暗能量自增长 | `deGrowthRate ×= deEngineLevelBonus` | `a×`（DE 速率） |
| ⑤ 物质系数幂 | `matterCoeff.pow(matterTotalExponent)` | `a^局部`（**不是 b真**） |
| `bCapMult` | `bThresholdOf` / `softCapB` 的阈值与跨度 | 斜率上限（b） |

**量子**

| 机制 | 落点 | 位置 |
|---|---|---|
| q 本身 | `state.quantum` / `qOf` | 资源 |
| q → ZPE | `zpeMultiplier += q³/10 × engineBonusMult` | `a+` |
| q → 熵 | `entropyRate ×= (1+q) × engineBonusMult` | `c` / `a×` |
| q → DE 倍率 | `darkEnergyMultiplier += q² × engineBonusMult` | `a+` |
| q → DE 增益 | `darkEnergyGainPerConversion ×= (1+log10 q × engineBonusMult)` | `a+` |
| q → b | `particleBoostRate = b0·(1+√q/10)·…` | `b时间`（斜率） |
| q → k | `matterSpanExponent = min(1+0.5165√q, 6.1651)` | `b资源`（斜率，会饱和） |
| `qm1/qm3/qm6` | `particleBoostRate` 乘算 | `b时间` |
| `qm2` | `tierAccelMult` 乘 `b` | `b时间` |
| `qm4` | `deGrowthRate ×1.25` | `a×`（DE 速率） |
| `qm7` | `bThresholdOf` 阈值放宽 | 斜率上限（b） |

**永恒升级 / 里程碑**

| 项 | 落点 | 位置 |
|---|---|---|
| `epMult` | `eternityPointGain ×= 5^等级` | `c`（最终 EP） |
| `em2` | `nekoGlobalExponent` 的加成部分 ×2 | 局部指数 |
| `em4` | `deGainBaseEffectMult` 1.10 → 1.12 | `a×` |
| `em5` | `bigCrunchGain ×= 1+log10(累计EP)` | `c`（最终 IP） |
| `em6` | 熵凝聚阈值 ÷1.2 | `a×`（阈值） |
| 自动化 / 保留类 | 自动购买 / 永恒后保留 | `结构` |

**七巧板**

| 项 | 落点 | 位置 |
|---|---|---|
| 覆盖率 | `tangramEngineBonusLevels` → `effectiveEngineLevel` | 经引擎 ⑤/④：`a^局部` / `a×` |
| 挑战免费引擎等级 | `freeZpeEngineLevels` → `effectiveEngineLevel` | 同上 |
| `deKneeMult` | `effectiveDarkEnergyGain` | `a×` |
| `convSlopeMult` | `conversion` 的 `perLevel` | `a+` |
| `ipDoubleKneeMult` | `ipDouble` 相关软上限 | `c` / 上限 |
| `passiveIpFrac` | 每秒被动 IP | `结构`（收入源） |
| `pityFloor` | 保底相关 | `结构` |

> ⚠️ 七巧板的「免费引擎等级」是最容易被误认为“指数区”的一条：
> 它最终确实会抬 `matterTotalExponent`，但那条是 `a^局部`，**仍然不是 b真**。
> 除非未来把引擎 ⑤ 改成真正的 b区，否则七巧板也进不了指数区。

### 2.2 已设计、未实装：空间膨胀（SE / ST）

> 状态：**合并终稿见 [`SPACE-EXPANSION-FINAL.md`](SPACE-EXPANSION-FINAL.md)**；
> `src/` 里没有任何 `du*` / SE / ST 实现。下表只列位置，数值/价格以合并终稿为准。
> ⚠️ 2026 IP 倍率禁令：`du11` 已删；`du8/du10` 价格侧暂缓；只允许环转化速率 ✓
> 它们不落在物质 b区；它们是在 **IP 侧**另开一条阶梯，把 IP 抬到 EP 门槛。
> 下表的“预定落点”是设计文档指定的入口，实装时应以唯一入口为准。

| 设计项 | 预定落点 | 设计位置 | 作用 |
|---|---|---|---|
| 挑战 `^0.5` | 所有**最终收益** | `c`（最终倍率，向下） | 挑战内减半；退出后无削弱 |
| SE 获取 | `SE = ⌊10^(log10(IP峰值)/40 − 7)⌋` | `结构`（货币） | 挑战内结算 |
| `du1` | `darkMatterAdditiveTerm` | `a×`（IP 侧） | 暗物质倍率 × 购买次数 |
| `du2` | `tangramAxisParams` | `a×` / `a+` | 七巧板有效加成 × 次数 |
| `du3` | 量子强度入口 | `a×` / `a+` | 量子强度 × 次数 |
| `du4` | `effectiveEngineLevel` | 经引擎 ⑤/④：`a^局部` / `a×` | 免费 ZPE 引擎数 × 次数 |
| `du5` | `conversion` | `a+` | 熵→粒子倍率 × 次数 |
| `du6` | `countFreqAddTerm` | `a×` | 计数频率倍率（次数的开根） |
| `du7` | 量子合成点 | `a×` | 量子按个数而非每对（效果口径待接） |
| `du8` | `zpeEngineCost` | `结构`（价格） | ZPE 倍率削弱引擎价格（价格侧，暂缓） |
| `du9` | 虚空升级效果 | `a×` | 虚空强度 ∝ log10(量子数)（当前接 `voidBoostMult`） |
| `du10` | 膨胀升级价格 | `结构`（价格） | ZPE 倍率修正价格（价格侧，暂缓） |
| `du11` | 暗能量超载 | `a×` | 单次 1e5 ST；DE 超载强度下限 0.3→0.95（随 ST） |
| ST 生产 | `dST/dt ∝ log10(全局加成)·SE` | `结构`（货币） | 主动生产 |

> ⚠️ 关键：**du1~du6 的效果形状**才是成败。
> 若沿用七巧板的 knee 饱和 ⇒ 最多 ×几倍，EP 几乎不动（`SPACE-EXPANSION.md` §12.2）。
> 设计稿推荐 `×10^(n^1.5)`（购买次数上的超指数）。
> **注意**：单条 n≈228 才能累计 +3434 阶（EP 1e8）；当前第一块七巧板是 **1e10 EP**，
> 需要 +4314 阶 ⇒ 单条约 266 次，或 du1~du3 三条各 ≈128 次。
> 详见合并终稿 §2.5（原 `SPACE-EXPANSION` §12.6 的“228 总量按每条 76 分”算错了）。

---

## 3. 指数候选逐项核对

| 候选 | 代码 | 实际形式 | 真 b区？ | 改斜率？ | 备注 |
|---|---|---|---|---|---|
| `matterTotalExponent` | `matterCoeff(...).pow(k)` | 对**系数**取幂 | ❌ | 通常否 | `k=1+5x/(1+x)`，`x=引擎等级/100`；系数是常数时纯高度 |
| `matterSpanMult` | `(10^effectiveDElog / DE₀)^k` | **资源指数**，再当因子乘 | ❌ | 是，但会饱和 | `effectiveDarkEnergyLog10` 封顶 `308.25+60=368.25`；之后乘数不再涨 |
| `particleTimeBoost` | `10^(b·t)` | **时间指数** | ❌（不是资源 b区） | 是 | 当前最主要的长期斜率；`b` 有 `softCapB` 软上限 |
| `nekoGlobalExponent` | `globalMultiplier^exp` | 对**全局乘积**取幂 | ❌ | 极弱 | `exp ≤ 1.022093`；em2+em7 可把加成部分翻到约 1.088；N.E.K.O 冻结 |
| `zpeMultiplier` | `(ZPE+1)^0.02` | 对 ZPE 取幂后当因子 | ❌ | 间接/弱 | 自反馈环，有 S 判据约束 |
| `zpeProductionPenalty` | `DE^0.5` 的倒数 | 惩罚因子 | ❌ | 否（有界） | 只压 ZPE 产出 |
| `tierAccelMult` | `10^(tiers)` 软上限 | 对档位取幂后乘 `b` | ❌ | 是（b 的乘数） | 有 `TIER_ACCEL_KNEE/SPAN` 软上限 |
| `infinityPointGain` / `eternityPointGain` | `10^(L/308)` / `5^(...)` | 公式自带的深度指数 | ❌ | 不是升级 | 决定“高度→货币”的兑换率 |
| **真正的 b区** | — | 对**整个资源值**取幂 | **0 处** | — | 见 §4.1 |

> 这张表的判据与 `src/config/base.js` 的 `ZONE_RULES` 一致：
> b区必须包住**整个 `{...}`**；只包住一个系数/因子不算。

---

## 4. 中期为什么推不动

### 4.1 形式 b区 = 0

按「对值本身取幂」的语义判据手工核对当前 `src/`：

- 没有 `state.resources.matter.pow(...)`；
- 没有 `(state.resources.matter + gain).pow(...)`；
- 没有对熵 / 粒子 / ZPE / DE 的**存量整体**取幂的生产路径。

`matterTotalExponent` 的底数是 `matterCoeff(...)`，它是**每粒子的物质系数**（速率的一部分），
不是资源 `M`。所以：

```
matterRate = P × coeff
coeff^k 只把 rate 乘上 coeff^(k−1)
```

若 `coeff` 近似常数，`k` 只是**一次性高度**；它不会把 `d log10 M/dt` 乘以 k。

### 4.2 更关键：b区该乘的那个增长项，在 `pow` 外面

`matterCoeff` 的结构是：

```
coeff = base × mb × global × zf × v3
coeff = coeff.pow(k)            ← 引擎 ⑤ 只包住这些
coeff = coeff × matterSpanMult ← (DE_eff/DE₀)^k_span 在 pow 外面
coeff = coeff × overload × climb
```

⇒ 中期真正随 DE 指数增长的 `matterSpanMult` **没有被引擎 k 放大**。
把引擎 k 从 1 拉到 6，主要放大的是 `global`（其中 DE 项只是 `log2(DE)`）和几个常数；
它不会把 `DE^k_span` 变成 `DE^(k·k_span)`。

把这句话量化（`C` = 当前 `matterCoeff` 里的系数，仅取 `1e6` 作示意）：

| 引擎等级 | `k` | `C^(k−1)`（速率倍数） | `Δlog10(IP) ≈ log10(C^(k−1))/308.25` |
|---:|---:|---:|---:|
| 0 | 1.00 | ×1 | 0 |
| 50 | 2.67 | ×1e10 | +0.032 |
| 100 | 3.50 | ×1e15 | +0.049 |
| 300 | 4.75 | ×1e22.5 | +0.073 |
| 1000 | 5.55 | ×1e27.3 | +0.088 |

⇒ 引擎 ⑤ 从 1 拉到 5.55，看起来是“×1e27 的巨量”，
在 IP 端只值 **不到 0.1 个数量级**。这就是“中期增益推不动”的直接原因。

### 4.3 量子共振本身会饱和

`matterSpanMult` 用的是 `effectiveDarkEnergyLog10(state)`：

```
kneeLog10 = 308.25
span      = 60
=> effectiveLog10 最大 = 368.25
```

超过 `1e308` 的暗能量不再让 `matterSpanMult` 继续增长。于是：

- DE 指数增长阶段：共振乘数确实在涨，提供一段斜率；
- DE 越过有效上限后：共振乘数变成常数，斜率退回 `b`（粒子时间指数）。

此外，基础物质 `> 1e100000` 时 `matterSpanMult` 会**直接变成 ×1**（硬上限），
所以它也不可能是无限期的斜率来源。

而 `b` 又有 `bThresholdOf` / `softCapB` 软上限；`bCapMult` 虽随引擎等级增长，
但引擎等级要 IP，IP 又来自物质深度 —— 一旦深度停滞，这个环也停。

### 4.4 a区高度在 IP 公式下被 308 除数吃掉

当前 IP（基础部分）：

```
log10(IP) ≈ L / 308.2547 − 0.75      （L = log10(物质)）
```

一个 ×R 的**一次性速率/高度**加成，在固定时长里最多把 L 抬高 `log10(R)` 阶
（若原本是线性增长），于是：

```
Δlog10(IP) ≈ log10(R) / 308.25
```

- ×1e6 的高度加成 ⇒ `ΔlogIP ≈ 6/308.25 ≈ 0.0195` 个数量级（几乎看不见）；
- 想靠高度把 IP 抬 1 个数量级 ⇒ 需要 ×1e308 的速率。

⇒ 中期所有 `a+ / a× / a^局部` 的增益，在 IP 端都被这个 308 除数压扁。
**单靠物质侧的斜率（`b时间`、`b资源`、`b真`）才能让深度随时间持续拉开。**

但请注意：**设计稿的解法不是把引擎 ⑤ 改成 b区**，而是加一层**空间膨胀**——
在 **IP 侧**直接加一条独立的超级指数阶梯（du1~du10），把 IP 抬几千阶，
从而绕过“物质深度 → IP”的 308 除数。它尚未实装，见 §2.2 与 §4.5。

### 4.5 设计既定解：空间膨胀（未实装）

`docs/SPACE-EXPANSION.md` / `docs/TIMESPACE.md` 已合并为
**[`SPACE-EXPANSION-FINAL.md`](SPACE-EXPANSION-FINAL.md)**：

- 挑战模式：所有**最终收益 ^0.5**（可退出；只在挑战内结算 SE）；
- 膨胀点数 SE / 膨胀时间 ST；
- du1~du6 可重复：暗物质、七巧板、量子、免费引擎、凝聚斜率、计数频率；
- du7~du10 单次：量子按个数、ZPE 价格、虚空强度、价格修正；`IP × ST^0.1` 已因禁令删除；
- 关键不是“多几项 a区”，而是 **du1~du3 的效果形状**：
  `×10^(n^1.5)` 这类**购买次数上的超指数**；
  当前 1e10 EP 目标需要 +4314 阶 ⇒ 三条各 ≈128 次（或单条 ≈266 次），
  详见合并终稿 §2.5。

⇒ 这是**IP 侧的独立阶梯**，不是物质资源的 b区；
它和“引擎 ⑤ 是否 b区”是两条互不替代的路线。
当前代码里 `du*` / SE / ST **一个都没有**（`grep -rn "SPACE_EXPANSION\\|du1" src` 为空），
所以中期的真实状态是：**已实现系统里没有 b区 + 已设计解法尚未落地**。

---

## 5. 修法：空间膨胀优先，不要再接引擎 ⑤

> 以下只是**落点选项**，不是已改数值。任何一条都要先跑
> `tools/stage-timing.mjs` + `tools/consistency.mjs`，并重验 S 判据 / 环增益。

### 方案 S：实装空间膨胀（设计既定，推荐）

按 [`SPACE-EXPANSION-FINAL.md`](SPACE-EXPANSION-FINAL.md) 的 du1~du10 做，重点是：

1. 挑战 `^0.5` 只作用在挑战内；退出后全额，SE 只在挑战内结算；
2. **du1~du3 用购买次数上的超指数形状**（如 `×10^(n^1.5)`），不要用 knee 饱和；
3. 价格增长慢于效果增长；
4. 目标 EP 读 `TANGRAM_ACQUIRE.epThresholds[0]`（当前 1e10），按 §2.5 的 n≈128/条标定；
5. 验收端点：EP 1.6 → 第一块七巧板门槛，约 9~10 轮（数值按合并终稿校准）。

这是把 IP 直接抬几千阶的**独立阶梯**，不依赖物质 b区；
也正是项目已经为“中期推不动”准备好的解法 ✓。

### 方案 0：先统一语义（零数值风险，已做）

`matterTotalExponent` 的 UI/注释已从「b区（指数区）」改成
「物质系数幂（局部指数）」；文档明确「真 b区 = 0」。
这样玩家看到的「指数区」不再是一个名不副实的标签。

### 方案 A：把引擎 ⑤ 改成真正的 b区（不推荐，除非放弃空间膨胀）

对**物质增量**取幂，而不是对系数取幂：

```
gain = k × P × dt
gain = gain ^ (1 + ε)          // ε 由引擎等级给，单调有界
M += gain
```

- 这是 `M_next = M_prev + gain^k`，不是 `M_prev^k`，比直接对存量取幂安全；
- 但它会与空间膨胀的“IP 侧阶梯”职责重叠：两条都试图解决同一段，
  数值上会互相掩盖，且需要重新验有限时间奇点；
- 除非明确决定**不做空间膨胀**，否则不建议走这条。

### 方案 B（已撤回）

“把引擎等级接到 `b` / `matterSpanExponent`”与空间膨胀的职责重叠，
且会让“引擎 ⑤ = 局部系数幂”的语义再次漂移。
既然空间膨胀就是为这段设计的，**先实装它，不要先改引擎斜率** ✗。

### 方案 C：新增中期货币买 b/k（仅在不做空间膨胀时考虑）

例如七巧板覆盖率 / 永恒里程碑给 `ε_b`、`ε_k`。
这是“新机制落在指数区”的干净做法，但与空间膨胀的 du 阶梯也会重叠；
只有在方案 S 被否决时才考虑。

---

## 6. 自查命令

```bash
# 1) 语义审计：看还有没有「对值整体取幂」
node tools/zone-audit.mjs

# 2) 直接搜生产路径里的 pow（重点看底数是不是整个资源）
rg -n "\.pow\(" src/formulas src/config

# 3) 真实引擎节奏（改任何斜率前后都跑）
node tools/stage-timing.mjs

# 4) 显示 == 实发 / 价格 / 环增益
node tools/consistency.mjs
```

> ⚠️ `zone-audit.mjs` 是**语义过滤器**，不是类型检查器；
> 它报「0 处 b区」只说明没有「包住整个值」的写法。
> 新增 b区时，仍要人读底数。
