/**
 * config/dark-energy.js —— 暗能量：升级表、惩罚、有效量软上限
 *
 * ⚠️ 本文件由 `src/config.js` 按领域机械拆分而来：**声明与注释逐字保留**。
 *    对外仍然统一从 `src/config.js`（barrel）导入 —— 不要直接改这里的 import 路径。
 *    依赖：eternity, tangram.js ｜ Decimal
 */
import Decimal from "../../dist/break_eternity.esm.js";
import { tangramRewardEffects } from "../tangram.js";
import { hasEternityMilestone } from "./eternity.js";

export const DE_PENALTY = {
  coeff: 0.001,
  /** 原来是 1.5，改成 0.5 拆掉死亡螺旋 */
  exponent: 0.5,
  /** 梦想烬灭虚无每级的减免 = `1 − 0.85^等级` */
  dreamReductionBase: 0.85,
  /** 惩罚下限：ZPE 永远不会被完全掐死 */
  floor: 1e-9 };

/**
 * 分段价格增长（基础暗能量获取升级用）。
 *
 * 用户设定：每次购买 ×3；价格超过 1e10 后改 ×1.5；超过 1e308 后改 ×2。
 *
 * ⚠️ **必须用闭式解，不能循环。** 从 1e10 涨到 1e308 在 ×1.5 下是 1693 级，
 *    循环写法在后期每帧要跑上千次 —— 和 buyRepeatable / buyTrap 同一类坑。
 *
 * 三段：
 *   ① ×3  直到价格 ≥ 1e10      -> 共 a 级
 *   ② ×1.5 直到价格 ≥ 1e308    -> 共 b 级
 *   ③ ×2  之后无限延续
 *
 * 注意 S 判据：单条升级的 S = `log(m)/log(r)`，取**当前那一级的 r**。
 * 所以这段曲线里 **r=1.5 是 S 最贵的一段**（r 越小 S 越大）。
 */
export const DE_UPGRADES = {
  dreamAnnihilation: {
    id: "dreamAnnihilation",
    name: "梦想烬灭虚无",
    maxLevel: 10,
    /** 价格：1 梦想点 + 10^(10+等级) 物质 */
    costDream: 1,
    costMatter: (lv) => new Decimal(10).pow(new Decimal(10).add(lv)),
    /**
     * ★ 方案 C（改）：减免 = **等级 / 满级**（线性，平滑，满级正好 100%）。
     *
     *   原稿是「每级抵消 1/3，3 级满」—— 4~10 级完全无效，且第 3 级跳崖。
     *   先用了几何曲线（10 级 80.3%），但用户指出原稿意图是
     *   **满级后不再有 ZPE 削弱倍率**，所以改成线性：每级 10%，第 10 级 100%。
     */
    desc: (lv) => {
      const max = 10;
      const r = Math.min(lv / max, 1) * 100;
      const next = Math.min((lv + 1) / max, 1) * 100;
      return lv >= max
        ? "已满级：暗能量对 ZPE 的削弱完全移除"
        : `削弱暗能量对 ZPE 的惩罚 ${r.toFixed(0)}%（下一级 ${next.toFixed(0)}%）`;
    },
    firstRewardDream: true },
  /**
   * 高效相变的 m 从 1.5 削到 1.13 —— S 贡献 0.5850 -> 0.3014。
   *
   * 用 IIFE 把倍率存进局部常量，`desc` 闭包引用它，
   * 这样**描述不可能和 effectMult 脱节**（踩过手写字符串的坑）。
   */
  phaseShift: (() => {
    const M = 1.5;    // ★ 方案 A：恢复原稿的 1.5（这就是「暗能量获取」）
    const R = 4;      // ★ 方案 A：价格增长 1.5 -> 4，把 r 抬到 m 之上
    return {
      id: "phaseShift",
      name: "高效相变",
      maxLevel: null,
      baseCost: 100,
      costParticle: (lv) => new Decimal(100).mul(new Decimal(R).pow(lv)),
      costMult: R,
      effectMult: M,
      desc: (lv) => `每次暗能量转换的量 ×${new Decimal(M).pow(lv).toFixed(2)}（花粒子）`,
      firstRewardDream: true };
  })(),
  vacuumAccel: (() => {
    const M = 1.12;
    return {
      id: "vacuumAccel",
      name: "真空加速",
      maxLevel: null,
      costZpe: (lv) => new Decimal(10).pow(lv),
      costMult: 10,
      effectMult: M,
      desc: (lv) => `暗能量倍率 ×${new Decimal(M).pow(lv).toFixed(2)}`,
      firstRewardDream: true };
  })(),

  /**
   * ★ 新增 ①：基础暗能量获取（b 区乘法）。
   *
   * 价格用**分段曲线**（见 PIECEWISE）：×3 -> ×1.5(>1e10) -> ×2(>1e308)。
   * 消耗**暗能量**。
   */
  deGainBase: (() => {
    /**
     * ★ m 从 1.05 提到 1.10（用户反馈：36 级只有 ×5.79，期望 ≥30）。
     *
     *    1.05^36 = 5.79   -> 1.10^36 = 30.91  ✅ 命中目标
     *
     * ⚠️ S 代价：`S = log(m)/log(r)`，而分段曲线的 r 由**最小的那段**支配
     *    （min(3, 1.5, 2) = 1.5）。所以：
     *       m=1.05 -> S 贡献 0.1203 -> 总 S 0.6115
     *       m=1.10 -> S 贡献 0.2351 -> 总 S 0.7263   ← 现在
     *    仍然远低于 1，安全；但超过了原先 0.5 的目标值。
     *
     *    如果嫌 S 太高：把 ×1.5 那段抬到 ×2，同样的 m 能省 42% 的 S
     *    （1.10 时 0.2351 -> 0.1375，总 S 降到 0.6538）。
     *
     * ✅ 安全性：这条效果的下游是**对数**的 ——
     *    暗能量获取 ×m^L -> 暗能量增长 -> deMult = 1+0.25·log2(DE) 只按对数涨。
     *    所以把 m 调高不会引起跑飞，只会让暗能量更快到位。
     */
    const M = 1.10;
    /**
     * ★★★ 2026：**em4「优化暗能量获取公式」的落点** —— 每级倍率 `1.10 → 1.12`。
     *
     * ── 为什么落在这里（用户 2026 裁定：「我选择那个**能减时间最少**的方案」）──
     * 候选是拉表 + 真引擎实测出来的（见 `docs/DARK-MATTER.md` §8-1 的对照表）：
     *   · 按"首次永恒省时"排：`1.10→1.12` ⇒ **−1.9 分**（最小）｜`1.10→1.15` ⇒ −8.9 分
     *     ｜`phaseShift 1.5→1.6` ⇒ −4.3 分｜自增长两条 ⇒ **0.0 分**（不是瓶颈）
     *   ⇒ 用户选了**最小的那个** ✓
     *
     * ⚠️ **它是 em4 的效果，不是全局改数** —— 依据就是 em4 的文案
     *   「**优化**暗能量获取公式，并解锁暗物质与第二个相变仪」：
     *   后半已是 `hasEternityMilestone(state, "em4")` 门控的 ⇒ 前半也应当门控 ✓
     * ⇒ 于是有唯一入口 `deGainBaseEffectMult(state)`（见下方），
     *   而**不传 state 的调用方（`computeS()` 的旧调用点 / 各工具）读到的永远是 1.10**
     *   ⇒ 对既有 S 判据与全部既有工具**零回归** ✓
     */
    const M_EM4 = 1.12;
    return {
      id: "deGainBase",
      name: "相变增幅",
      maxLevel: null,   // ★ 2026 撤回封顶：等级**可以无限买**（break_eternity 就是为此存在 ✓）
      baseCost: 10,
      /** 用分段闭式解代替固定 costMult */
      piecewise: true,
      effectMult: M,
      /** ★ em4 达成后的每级倍率（`deGainBaseEffectMult()` 读它 —— **唯一数据源**） */
      em4EffectMult: M_EM4,
      costDarkEnergy: true,
      /**
       * ⚠️ 描述必须**从实际生效的倍率推导**（收 `state`）——
       *   否则 em4 之后显示的还是 `1.10^L`，又是一个「显示 ≠ 实发」✗
       *   （同族先例：`convOutput.desc` 也收 `state`）
       */
      desc: (lv, state) => {
        const m = deGainBaseEffectMult(state);
        return `每次暗能量转换的量 ×${new Decimal(m).pow(lv).toFixed(2)}（花暗能量）`
          + (m > M ? "　（em4 已优化）" : "");
      },
      firstRewardDream: true };
  })(),

  /**
   * ★ 新增 ②：转换产出（熵凝聚的**产出斜率**）。
   *
   * 现有转换是加法形式：`产出 = 1 + 0.15n`（v5 后 +0.65n），
   * 所以转换率 `产出/阈值` 在 n→∞ 时会**封顶**。乘一个倍率只能抬高上限，仍会封顶。
   *
   * 这条升级改的是**斜率**：每级让产出增量 +0.05。
   *   `产出 = 1 + (0.15 + 0.5·v5 + 0.05·L) × n`
   *   `转换率上限 = (0.15 + 0.5 + 0.05L)/3 = 0.2167 + 0.0167L`
   *
   * 于是上限随 L **线性**增长，而 `L ∝ log(资源)` —— 整体是对数增长，
   * **几乎不进 S 池**。而且它正好让「1 熵 = N 粒子」这个显示成真。
   *
   * 消耗**暗能量**。
   */
  convOutput: (() => {
    const PER_LEVEL = 0.05;
    return {
      id: "convOutput",
      name: "凝聚斜率",
      maxLevel: null,   // ★ 2026 撤回封顶：等级**可以无限买**（break_eternity 就是为此存在 ✓）
      baseCost: 100,
      costMult: 2,
      costDarkEnergy: true,
      /** 每级给产出增量加多少 */
      perLevel: PER_LEVEL,
      /**
       * ★ 描述必须**从实际公式推导**，不能假设 v5 已买。
       *
       *   踩过：旧描述写死 `0.15 + 0.5 + 0.05L`（假设 v5），没买 v5 时显示的
       *   "转换率上限"比真实值高 —— 又是「显示 vs 实际」那类问题。
       *   所以这里接收 `state`（UI 会传），按实际是否买了 v5 算。
       */
      desc: (lv, state) => {
        const v5 = state?.voidUpgrades?.v5 ? 0.5 : 0;
        const inc = 0.15 + v5 + PER_LEVEL * lv;
        return `熵凝聚每级产出增量 +${(PER_LEVEL * lv).toFixed(2)}` +
          `（转换率上限 ${(inc / 3).toFixed(3)}${v5 ? "" : "，未含 v5"}）`;
      },
      firstRewardDream: true };
  })() };

/**
 * ★★★ 2026：`deGainBase`（相变增幅）的**实际每级倍率** —— **em4 的唯一落点**。
 *
 * `hasEternityMilestone(state, "em4") ? em4EffectMult : effectMult`
 *
 * ⚠️ 三个调用方**都必须走它**，一个都不许自己读 `cfg.effectMult`：
 *   ① `formulas.js` 的 `darkEnergyGainPerConversion()` —— **实发**
 *   ② 本文件的 `computeS()` —— **S 判据**
 *   ③ `DE_UPGRADES.deGainBase.desc` —— **显示**（否则 em4 后又是「显示 ≠ 实发」✗）
 *
 * ⚠️ 不传 `state` ⇒ 视为**没有 em4** ⇒ 返回基础值 `1.10` ✓
 *   ⇒ 所有"不传 state"的旧调用点（`computeS()` / `headless.mjs` / `tier4-*.mjs`）
 *     读到的数**一字不变** ⇒ 对既有断言**零回归** ✓
 */
export function deGainBaseEffectMult(state) {
  const cfg = DE_UPGRADES.deGainBase;
  const base = hasEternityMilestone(state, "em4") ? cfg.em4EffectMult : cfg.effectMult;
  // ★★★ 2026：拼装挑战**六档全清** ⇒ 每级倍率抬到 1.14（em4 是 1.12）✓
  //   ⚠️ 只抬"每级倍率"，不改曲线形状 ⇒ 不影响 p ✓
  const full = tangramRewardEffects(state?.tangramCleared).allClear;
  return full ? base.max ? base.max(1.14) : Math.max(Number(base), 1.14) : base;
}

// ══════════════════════════════════════════════════════════
// 梦想点一次性升级（量子页）
// ══════════════════════════════════════════════════════════

/**
 * 梦想点一次性升级（量子页）。
 *
 * 为什么放在量子页：暗物质工程的三个升级里，第一个（梦想烬灭虚无）
 * 本来就用梦想点计价。后两个（高效相变 / 真空加速）原本只烧粒子和 ZPE，
 * 于是梦想点在中后期**没有去处**。这两个把它们接进梦想点经济。
 *
 * 定位：**自动化**。买了之后对应的暗能量升级会自动购买，
 * 玩家不用再手点（对齐 v9 的「达到阈值自动获取」）。
 */
export const DE_EFF_CAP = { kneeLog10: 308.25, span: 60 };

export function effectiveDarkEnergyLog10(state) {
  const de = state?.darkEnergy ?? new Decimal(0);
  if (de.lte(0)) return 0;
  const dlg = de.log10().toNumber();
  const { kneeLog10: knee, span } = DE_EFF_CAP;
  if (dlg <= knee) return dlg;
  return knee + span * (1 - Math.pow(2, -(dlg - knee) / span));
}

// ══════════════════════════════════════════════════════════
// ★★★ 2026 · 永恒之后第一块：**暗物质 / 第二个相变仪**
//   （第三层设计稿 `C:\Users\25187\Desktop\第三层设计.txt` 第 50~52 行）
// ══════════════════════════════════════════════════════════
// 设计稿原文（逐字）：
//   「在暗能量下提供第二个子页面：暗物质
//     消耗ep获取暗物质，暗物质依赖个数通过第二个相变仪提升第一个相变仪的获取效率
//     （剩下的还在想）」
//
// ── ① 落点：暗能量倍率的**加法区**（★ 用户口径：这就是「**额外乘区**」——
//   他说「额外乘区」时**一概指 a 区（加法区）**，即在括号里再加一项、与 `q²` 同形制，
//   **不是**独立乘在整体上的因子。术语权威定义见 `docs/BONUS-INVENTORY.md` 文首）──
//   `formulas.js` 的 `darkEnergyMultiplier()` 结构是
//       `base = 1 + log2(暗能量累计)·coeff + q²`（加法区 = a区），再 × accel × 引擎倍率
//   本机制往那个括号里**再加一项** `(转化值 − 1)` ⇒ 与 `q²` **同一形制**（同一个加法池）✓
//   ⚠️ 它**不是**乘性因子 —— 暗能量倍率经 `globalMultiplier` **落在环的两端**
//      （`formulas.js:147~157` 有现成警告：当年把量子当因子放进去，"物质 1e27 的到达时间"
//       从 4707s 缩到 2088s ≈ 52 倍加速，用户判定不可接受 ✗）
//   ⇒ 加法区的**常数项**不会放大环增益：它只在 `∂ln(倍率)/∂ln(DE)` 的**分母**里
//      ⇒ 环增益反而**下降** ⇒ 更安全 ✓（而 `computeS` 只统计可重复乘法升级，常数项不进池 ✓）
//
// ── ② 形状：`v1^0.01` 与 `n^0.01` 都是「压缩机」──
//   · `v1^0.01 = 10^(0.01·log10 v1)` ⇒ 把**任意大**的速率压进 **1 ~ 1000**（v1 = 1e100 ⇒ 10）✓
//   · `n^0.01` 对 n 是**对数级**增长（n = 1e12 时指数才 1.028）
//   ⇒ 两者天生温和：实测失效点（Δ > 0.5）在 **L > 1e18 次永恒**之外
//      ⇒ **价格形状不背安全责任**，可以按手感挑 ✓
//
// ── ③ 为什么用「效率」而不是「按时间跟踪」（我在实现时改的一处）──
//   批准的是"目标跟踪"（当前值以 ∝v2 的速率追目标 T）。但实测：T 在**一整轮**里只从 1 涨到 ~18
//   （而暗能量要长 167 阶那么久）⇒ 任何秒级的跟踪速度都"追得上" ⇒ **v2 会完全看不见** ✗
//   ⇒ 改成**效率形式**：`转化值 = 1 + (T − 1)·min(1, v2 / v2Ref)`
//      v2 决定"能把多少暗能量转成倍率" —— 既可见、又有界（v2 → ∞ 时封在 T）✓
//
// ── ④ 读**余额**（`state.darkEnergy`），不读累计（用户 2026 裁定）──
//   用户理由：「累计的反而更容易爆掉」—— 实测正确：
//     · `darkEnergyTotal` 终身累计、永不重置 ⇒ 每轮 +167 阶 ⇒ **无界**
//     · `darkEnergy` 每轮重置为 1 ⇒ 当轮有界（≤ 该轮峰值）✓
//   ⚠️ 本项目有个**已知坑**（`formulas.js:387`）：`deMult` 曾读余额，结果
//      「花暗能量买升级 → 余额降 → deMult 降 → 阈值升 → 转换率降」= **买升级反而变弱** ✗
//   ⇒ 本机制**不会被咬到**，敏感度低两个数量级：
//      `d项/dlog10(暗能量) = c·n^b·(log10 DE)^(n^b−1) ≈ 0.1`（每掉 1 个数量级只让 Δ 变 0.0007）
//      而当年那个是**反比**关系（实测掉 12.49%）✓
//
// ── ⑤ 解锁 = em4（第 4 次永恒）──
//   设计稿第 40 行把两者写在**同一句**：「优化暗能量获取公式，**并解锁暗物质与第二个相变仪**」
//   ⇒ 判据 = `hasEternityMilestone(state, "em4")`，唯一入口 `darkMatterUnlocked()` ✓
//
// ── ⑥ 数值来源（用户 2026：**全部由 `tools/dark-matter-lab.mjs` 反解，不许手调**）──
//   `costBase` / `costMult`（EP 价格）｜`speedExp` / `speedNExp`（v2）｜`v2Ref`（效率基准）
//   ｜`effectCoeff` / `effectNExp`（④ 的目标 T）
// ══════════════════════════════════════════════════════════

/**
 * 暗物质 / 第二台相变仪的参数（**唯一数据源**）。
 *
 * 规则（用户 2026 重写版）：
 *   ① 暗物质由 **EP 获取**
 *   ② 第二台相变仪的速度是「第一台的 ^0.01」（可调以适配前期速度）
 *   ③ 第二台同时受**暗物质数量**的速度提升
 *   ④ 把暗能量**基于暗物质的 ^0.001** 转化为倍率，提供额外的暗能量倍率加成
 */
