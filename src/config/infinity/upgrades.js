/**
 * config/infinity/upgrades.js —— ∞ 升级表、价格、已购判定、速率倍率
 *
 * ★ 2026 模块化：由 1,009 行的 config/infinity.js 拆出（声明与注释逐字保留）。
 *    对外统一从 `src/config.js`（barrel）导入。
 */
import { ipDoubleLogCost } from "./ip.js";
import { tierRateMult } from "./tier.js";
import Decimal from "../../../dist/break_eternity.esm.js";

export const INFINITY_UPGRADES = {
  /**
   * ① 无限增幅 —— **最终乘区**（乘在所有 IP 来源之后）
   *
   * ★★ 2025 用户裁定：形态**照抄 AD 源码** `InfinityUpgrade.ipMult` ⇒ 效果 `×2/级`（= `2^等级`）。
   *   唯一的实现在 `ipDoubleMult()`；显示侧（engine.js 的 `infinityUpgradeEffect`、
   *   ui.js 的收入明细）**都必须调它** ⇒ 防止再出现"显示 ≠ 实发"✗
   *
   *   职责：负责「1e280 基础值 → 1e308.25」那 **28.25 阶**（需 93.8 级）。
   *   节流：**只封价格、不封效果**（见 `IP_DOUBLE_AD`），与 AD 的 `costCap` 同思路。
   *
   *   ⚠️ 价格 `firstCost/costMult` 是在"线性版"时代标定的（首价 1、每级 ×10），
   *      换成 `2^等级` 后**必须重新标定**（否则 24 档阶梯会被 IP 侧打穿）——
   *      实测数据见 `tools/stage-timing.mjs`。
   */
  ipDouble: {
    id: "ipDouble",
    name: "无限增幅",
    repeatable: true,
    firstCost: 1,
    costMult: 10,
    /** ★ = AD 的 `DC.D2`（效果底数，`ipDoubleMult()` 与 `ipDoubleLogCost()` 共用） */
    effectMult: 2,
    zone: "ip",
    desc: "无限点收益 ×2/级（最终乘区：乘在所有来源之后）" },

  /** ② 无限点数量 → ZPE 倍率的**加法区**（a区） */
  /**
   * ★ 量子铸币（用户提案）：**单次 100 无限点**，之后每次大坍缩额外获得
   *   `floor(本次无限最大量子数 ^ power)` 点无限点（`power` 见升级定义；2026 由 2 调成 **1.75**）。
   *
   * 为什么需要它（诊断依据，`tools/stage-timing.mjs --profile`）：
   *   打破无限后 ④ 收入只有 540~1620 点/小时，而铸币起步价 1e4 ⇒ **24 小时买不到一级铸币**，
   *   阶梯的"种子"根本攒不出来。这一条把「ZPE → 量子 → 无限点」接通，
   *   正好补上种子（实测 q≈83 时给 **2282** 点 ≈ 起步价量级；`^2` 时代是 6889）。
   *
   * 安全性：q 的成长受量子门槛（每次 ×20）限制，`q ≈ 2·log20(ZPE)` ——
   *   所以 `q^power` 只随 `log^power(ZPE)` 增长，**是种子而不是 runaway**
   *   （q=138 时 `^1.75` 给 5556；`^2` 时代是 19043）。
   */
  /**
   * 门槛压平：量子门槛步长 ×20 → ×10（原稿候选 11；现在能放大 q² 收益）
   *
   * ★ 2025 追加职责：它同时是**跨度层的开关**（用户方案，见 docs/R-REPLACEMENT.md §11）。
   *   买下时记下当时的暗能量水位 `state.spanDeBase`，此后
   *   `物质产出 ×= (DE / spanDeBase)^k`，其中 `k = min(1 + c·√q, 6.1651)`。
   *
   *   为什么用它当开关：它是 ∞ 层升级 ⇒ 天然"打破无限之后"（早期不激活）；
   *   而且它本身就是量子相关的升级，与"k 由量子给"语义一致。
   *
   * ⚠️ 价格与门槛是**两个独立旋钮**：
   *   · 价格（现 128 IP）只影响"多久买得起"；
   *   · 门槛 `brokenInfinity`（在 `buyInfinityUpgrade` 里强制）保证"何时**可以**买"。
   *   用户仍在权衡价格（10 / 50 / 128），但门槛语义与价格无关 ⇒ 先上后调。
   */
  thresholdFlat: {
    id: "thresholdFlat",
    name: "门槛压平",
    cost: 128,
    desc: "量子门槛步长 ×20 → ×10，并开启跨度层",
    zone: "dm" },
  /** 涨落增幅：每对量子 +2 → +3（原稿候选 10） */
  pairBoost: {
    id: "pairBoost",
    name: "涨落增幅",
    cost: 5,
    desc: "每对量子 2 → 3",
    zone: "dm" },
  /**
   * 未花 IP 加产率（原稿候选 15，AD `unspentBonus` 同源）：a区 产率按**未花无限点**提升。
   *
   * ⚠️ **必须有硬上限**（用户指定：影响永恒阶段的东西要有极强软上限）。
   *    AD 原式 `(IP/2)^1.5 + 1` 单独看很危险：IP 到 1e308 时它是 1e462，
   *    物质爬升会被瞬间抹平（整条 24h 阶梯失去意义）。所以这里**封顶 ×1000**：
   *    它只在"攒铸币种子"的那几个小时里起作用，之后恒定 —— 定位是**种子**，不是 runaway。
   */
  // ⚠️ `unspentBoost`（沉潜蓄能）已整条删除（2025 用户裁定）—— 见上方 `unspentBoostMult` 的删除说明
  ipFromQuantum: {
    id: "ipFromQuantum",
    name: "量子铸币",
    cost: 100,
    /**
     * ★★★ 收益指数（**唯一数据源**，`quantumToIPGain` 读它）。
     * ⏳ 2026 平衡：用户报「效果有点过于强了，`^2` 改成 `^1.75` 差不多」⇒ 2 → **1.75**
     * ⚠️ 它是**分数幂** ⇒ 走 `Decimal.pow`（有 ~1e-15 相对误差）；改回整数时会自动走精确路径 ✓
     */
    power: 1.75,
    desc: "大坍缩收益 +本次最大量子数^1.75",
    zone: "ip" },
  ipToZpe: {
    id: "ipToZpe",
    name: "零点耦合",
    cost: 1,
    perIp: 1,
    zone: "zpe",
    desc: "ZPE 倍率 += 无限点数量" },

  /** ③ 无限点 → 相变仪转换速率（ZPE → 暗能量） */
  ipToTransmuter: {
    id: "ipToTransmuter",
    name: "相变超频",
    cost: 1,
    perIp: 0.5,
    zone: "de",
    desc: "相变仪速率 ×(1 + 无限点×0.5)" },

  /** ④ 每次无限的**耗时**换成无限点（每 60 秒 1 点） */
  ipTime: {
    id: "ipTime",
    name: "无限长河",
    cost: 3,
    /** 每多少秒给 1 点 */
    secondsPerPoint: 60,
    /**
     * 耗时上限（秒）：**1800 = 30 分钟**。
     *
     * 为什么要它：没有上限时"收快收慢每小时都是 60 点"，速度类升级（速率解放/起点跃迁）
     * 对 IP 收入完全没有意义。加上限后 `IP/小时 = 60 × 3^① × min(T,1800)/T`：
     *   · 单次 ≤ 30 分钟 → 吃满；
     *   · 单次 100 分钟（现状）→ 只有 30%。
     * 于是"把单次无限压进 30 分钟"变成明确目标（AD 的同类做法也是给上限而不是无限膨胀）。
     * 沙盒实测代价很小：打破无限 4.1h → 4.8h。
     */
    capSeconds: 1800,
    zone: "ip",
    desc: "每秒实时获得「1 ÷ 60」点（吃 ① 的加成），单次最多计 30 分钟" },

  // ══════════════════════════════════════════════════════════
  // ★ 加速「e25 → e308.25」那一段的两条线
  //
  //   为什么要专门为这一段加升级：这段原先的斜率 = R（已退休）—— 现在它们抬的是 `b`（粒子增幅速率）。
  //   而 a区 的产率升级对它完全无效（基础环比指数项小 1e200 倍，实测过）。
  //   所以只有两个真杠杆：**抬 R 的上限** 与 **缩短距离（抬高开局物质）**。
  //   量化（tools/infinity-sim.mjs / _sim 沙盒对齐过）：
  //     · 速率类：`t ∝ 1/R₀`，每 +10% → 单次无限 −9%
  //     · 起点类：从 1e25 提到 1e200 → 单次无限 −39%（在爬升衰减开启后）
  // ══════════════════════════════════════════════════════════

  /**
   * 起点跃迁 I~IV：**每次大坍缩之后**以指定的物质开局（AD `skipReset*` 的同源设计）。
   *
   * ⚠️ 只抬高"起点"，不改变上限 —— 所以它不改形，只缩短距离。
   *    数值用**绝对深度**（1e50/1e100/1e150/1e200），与最终的爬升衰减参数无关。
   */
  start50: { id: "start50", name: "起点跃迁 I", cost: 20, startLog10: 50, zone: "matter", desc: "每次大坍缩后以 1e50 物质开局" },
  start100: { id: "start100", name: "起点跃迁 II", cost: 40, startLog10: 100, zone: "matter", desc: "每次大坍缩后以 1e100 物质开局" },
  start150: { id: "start150", name: "起点跃迁 III", cost: 80, startLog10: 150, zone: "matter", desc: "每次大坍缩后以 1e150 物质开局" },
  start200: { id: "start200", name: "起点跃迁 IV", cost: 300, startLog10: 200, zone: "matter", desc: "每次大坍缩后以 1e200 物质开局" },

  /**
   * 速率解放 I~IV：抬 `b`（粒子增幅速率）的倍率 —— R 退休前它们抬的是 R 的上限。
   *
   * ⚠️ 用**百分比**而不是绝对值，这样最终 R₀ 定成多少都自动跟随 ——
   *    避免"改了 knee/D 以后这几条升级的数值全要重算"。
   */
  rate110: { id: "rate110", name: "速率解放 I", cost: 10, rateMult: 1.10, zone: "dm", desc: "粒子增幅速率 b ×1.10" },
  rate121: { id: "rate121", name: "速率解放 II", cost: 100, rateMult: 1.10, zone: "dm", desc: "粒子增幅速率 b ×1.10" },
  rate139: { id: "rate139", name: "速率解放 III", cost: 1000, rateMult: 1.15, zone: "dm", desc: "粒子增幅速率 b ×1.15" },
  rate167: { id: "rate167", name: "速率解放 IV", cost: 10000, rateMult: 1.20, zone: "dm", desc: "粒子增幅速率 b ×1.20" } };

/**
 * 无限升级的展示顺序（UI 与自检共用）。
 * UI 会把它排成 2×n 网格，所以顺序就是格子顺序（左→右、上→下）。
 */
export const INFINITY_ORDER = [
  "ipFromQuantum", "thresholdFlat", "pairBoost",
  "ipDouble", "ipToZpe",
  "ipToTransmuter", "ipTime", 
  "start50", "start100",
  "start150", "start200",
  "rate110", "rate121",
  "rate139", "rate167",
];


/** 大坍缩能拿多少无限点 */
export function infinityPointEffect(ip) {
  const n = ip instanceof Decimal ? ip : new Decimal(ip ?? 0);
  return { count: n };
}

/**
 * 无限升级的价格（**唯一数据源**）。
 *
 * UI 显示的和引擎扣的必须走这一个函数 —— 这是 consistency.mjs 的硬要求，
 * 也是「显示 vs 实际」那类 bug 的唯一防法。
 *
 * @returns {Decimal} 价格（可重复升级按当前等级算）
 */
export function infinityUpgradeCost(state, id) {
  const cfg = INFINITY_UPGRADES[id];
  if (!cfg) return new Decimal(0);
  if (cfg.repeatable) {
    // ★ ①「无限增幅」走**分段软上限**（用户指定：影响永恒阶段的东西必须有极强软上限）。
    //   60 级前与老的 `10^等级` 完全一致；之后每级涨价 ×100、再 ^1.5。
    // ⚠️ 约定：`ipDoubleLevel` **必须是 `Decimal`**。三条路都保证这一点：
    //   `newState` 的 `D(0)` / `deserialize` 的 `dec()` / 引擎的 `D(before).add(k)` ✓
    //   （我写性能复现脚本时顺手赋了个普通 `30` ⇒ 这里当场抛 TypeError —— 是**脚本违约**，
    //     不是代码 bug ⇒ 所以**不放宽**这里的类型要求，否则约定就模糊了 ✗）
    const lv = (state.ipDoubleLevel ?? new Decimal(0)).toNumber();
    return new Decimal(10).pow(ipDoubleLogCost(lv));
  }
  return new Decimal(cfg.cost ?? 0);
}

/** 该无限升级已经买了吗（可重复的返回等级 > 0） */
/**
 * 这条 ∞ 升级**买过没有**。
 *
 * ⚠️ 踩过的坑（本轮）：加一次性升级时只写了购买分支的 `state.xxxBought = true`，
 *    **忘了在这里登记** ⇒ `buyInfinityUpgrade` 的"已买就不再卖"判断失效，
 *    同一升级会被**无限次重复购买**（每次 5/50/100 IP）。
 *    实测后果：打破无限后的 IP 池永远停在个位数（钱全被重复购买吃掉），
 *    "种子"永远攒不出来 —— 整条阶梯因此卡死。
 */
export function infinityUpgradeOwned(state, id) {
  const cfg = INFINITY_UPGRADES[id];
  if (!cfg) return false;
  if (cfg.repeatable) return (state.ipDoubleLevel ?? new Decimal(0)).gt(0);
  if (cfg.startLog10 != null) return (state.startBought ?? {})[id] === true;
  if (cfg.rateMult != null) return (state.speedBought ?? {})[id] === true;
  if (id === "ipToZpe") return state.ipToZpeBought === true;
  if (id === "ipToTransmuter") return state.ipToTransmuterBought === true;
  if (id === "ipTime") return state.ipTimeBought === true;
  if (id === "ipFromQuantum") return state.infinityFromQuantumBought === true;
  if (id === "thresholdFlat") return state.thresholdFlatBought === true;
  if (id === "pairBoost") return state.pairBoostBought === true;
  return false;
}

/**
 * 「起点跃迁」当前生效的开局深度（对数）。没买就是 0（= 从 0 开始，原样）。
 * 取**已买里最高的一档**（它们是递进的，不是相加的）。
 */
export function infinityStartLog10(state) {
  let best = 0;
  for (const cfg of Object.values(INFINITY_UPGRADES)) {
    if (cfg.startLog10 == null) continue;
    if ((state.startBought ?? {})[cfg.id] === true && cfg.startLog10 > best) best = cfg.startLog10;
  }
  return best;
}

/** 「速率解放」对量子成长速率上限的总倍率（各档相乘） */
/**
 * ★★ 2025：**坍缩加速器（CRUNCH_ACCEL）已整个删除**（用户裁定）
 *
 * 用户理由（原话）：「原则上坍缩加速机制也不该在这里。我的结论是直接删。
 *                  否则会对机制解读有极大污染」
 *
 * 它原本是"花无限点直接买时间"（每级成长速率 ×1.02、硬封顶 ×2），
 * 与同一批被删的机制同源：
 *   · 它是 **IP → 成长速率** 的平行环（和铸币 IP→IP 一样，不推动物质）；
 *   · 它的叙事（"把 24h 档压到 18h"）是**旧标尺**（×1.75）时代的产物，
 *     而正确标尺是 `AD WR × 1.0526`（见 PROGRESSION §2.0）⇒ 叙事本身已失据；
 *   · 与「速率解放」「档位 rate 里程碑」**共用一个入口**（infinityRateMult），
 *     三者在界面上无法分辨"谁在起作用" ⇒ 机制解读被污染。
 *
 * 移除后 `infinityRateMult` = ∞ 层「速率解放」各档 × 档位 rate 里程碑（`tierRateMult`）。
 */

/**
 * 无限升级「速率解放」（`rateMult`）的**合并倍率** = ∞ 层已买的档位 × 档位 rate 里程碑。
 *
 * ★ 单一数据源：`infinityRateMult(state)` 是"改速率"类机制的**唯一**入口（R 退休后它改的是 `b`），
 *   所以任何"改成长速率"的机制都必须并进这里，不许各写各的（否则会漏乘）。
 */
export function infinityRateMult(state) {
  let m = new Decimal(1);
  for (const cfg of Object.values(INFINITY_UPGRADES)) {
    if (cfg.rateMult == null) continue;
    if ((state.speedBought ?? {})[cfg.id] === true) m = m.mul(cfg.rateMult);
  }
  return m.mul(tierRateMult(state));
}

/**
 * ④「无限长河」的**实时**产点速率（点/秒）。
 *
 * 设计参考：AD 的同类升级（`ipGen` / 被动产点）是**实时生成**的，不是每次结算时一次性给。
 * 所以这里也改成实时：`tick` 每帧按这个速率进账，**总量公式不变**
 * （单次无限累计 = `min(耗时, 上限) ÷ 60 × 3^①等级`）。
 *
 * 好处：挂机期间点就在账上（不必等大坍缩才入账），
 * 而且"把单次压进 30 分钟"这个目标从"结算时才算"变成屏幕上的实时数字。
 */
