/**
 * config/upgrades.js —— 可重复升级、虚空升级与虚空加成
 *
 * ⚠️ 本文件由 `src/config.js` 按领域机械拆分而来：**声明与注释逐字保留**。
 *    对外仍然统一从 `src/config.js`（barrel）导入 —— 不要直接改这里的 import 路径。
 *    依赖：milestones, zpe-engine ｜ Decimal
 */
import Decimal from "../../dist/break_eternity.esm.js";
import { hasCollapse } from "./milestones.js";
import { zpeEngineMultBonus } from "./zpe-engine.js";
import { spaceDu9Mult } from "../space/core.js";

export const TRANSMUTER_IP = { coeff: 0.5, cap: 100 };
export function transmuterIpMult(state) {
  if (!hasCollapse(state, "cm5")) return 1;
  // ★ 数值约定 #3：IP 可以 >1e308 ⇒ 用 Decimal，安全的地方才降级
  const ip = new Decimal(state?.infinityPoints ?? 0).max(0);
  const v = 1 + TRANSMUTER_IP.coeff * Math.log10(1 + ip);
  return Math.min(v, TRANSMUTER_IP.cap);
}

/** ⑧ 游玩时间的全局加成（对数 ⇒ 次线性；字段缺失时返回 1 ✓ 安全） */
export const TIME_BONUS = { coeff: 0.1 };
export function playTimeBonus(state) {
  if (!hasCollapse(state, "cm8")) return 1;
  const sec = Number(state?.stats?.playTimeSec ?? state?.playTimeSec ?? 0) || 0;
  if (sec <= 0) return 1;
  return 1 + TIME_BONUS.coeff * Math.log10(1 + sec / 60);
}

/**
 * ★★★ 2026 **已删除**（用户裁定：「把无限挑战（和相关的）删了」）。
 *
 * ── 原样（留档，便于对照 git 历史）──
 *   `INFINITY_CHALLENGES = { max: 3, entMult: 5, ipJumpOrders: 10 }`
 *   `icEntropyMult(state)` —— 挑战中熵需求 `×5^k`
 *   `icIpJumpMult()`       —— 每过一关 IP ×10^10
 *
 * ── 为什么删（用户原话）──
 *   「我发现无限挑战做不做都不影响我永恒了」
 *   ⇒ 既不影响永恒节奏、也不是必经之路 ⇒ 纯可选的内容负担 ✗
 *
 * ── 连带删除（整块，不是半删）──
 *   ui-ic.js 整文件 · state.ic / icAutoTimer / fastestInfinitySec ·
 *   engine.js 的 start/abandon/icCompleteOnCrunch/icAutoAdvance ·
 *   formulas.conversion 里那行阈值放大 · index.html 的 IC 宿主 ·
 *   neko.js 的 IC 日志分类 · tools/ic-lab.mjs 与 ic-ladder-lab.mjs ·
 *   **em7 退回 pending**（它的内容就是自动完成 IC）
 *
 * ⚠️ 不要从 git 历史复活它 —— 除非用户明确要重建 ✓
 */

export const VOID_BOOST = { coeff: 0.1 };

/**
 * ★★ 2025：**「曾经解锁过」的页面记录**（用户裁定：第一次永恒后相关页面保持解锁）
 *
 * ── 问题 ──
 *   各面板的解锁判定**几乎全建立在会被重置的值上** ——
 *   · 量子 / 无限面板 = `collapseUnlocked(state)` = **`peakMatter ≥ 1e25`**
 *   · 暗能量面板     = `phaseTransmuterUnlocked`
 *   · ZPE 引擎面板   = `zpeEngineUnlocked`
 *   · 虚空面板       = 由 `v1` 等虚空升级推导
 *   而 `doEternity()` 会把上面这些**一并清零** ⇒ 永恒后整排标签重新上锁 ✗
 *   （用户玩完第一轮实测反馈：「我们应该在第一次永恒后保持相关页面的解锁状态」）
 *
 * ── 做法 ──
 *   把**解锁**与**数值**彻底解耦：
 *   · `state.pageUnlocked[key]` = 曾经解锁过（**永不重置**，`doEternity` 不碰它）
 *   · 读取方一律走 `pageUnlocked(state, key)`；解锁那一刻调 `markPageUnlocked(state, key)`
 *   ⚠️ **不要在 UI / formulas 里直接读那些易失字段判解锁** ✗（这正是本 bug 的成因）
 *
 * `key` 取值（与面板一一对应）：
 *   `void` 虚空科技 · `zpe` ZPE 引擎 · `de` 暗能量 · `quantum` 量子涨落 ·
 *   `infinity` 无限 · `eternity` 永恒
 *
 * ⚠️ **加新页面时必须同步这里** —— 漏一个就会出现"该页永恒后仍上锁"的 bug
 *   （踩过：`eternity` 第一版就漏了，用户实测反馈「我的永恒页面也被重置了」✗）
 */
export function voidBoostMult(state) {
  const m = zpeEngineMultBonus(state);
  const lg = m.lte(1) ? 0 : m.log10().toNumber();
  return (1 + VOID_BOOST.coeff * Math.max(0, lg)) * spaceDu9Mult(state);
}

/**
 * ★★ 2025（用户裁定）：**引擎的每条机制各有「内部终点」** —— 引擎整体无上限，但内部机制各自封顶。
 *
 *   用户原话：「**没有终点，但内部的机制可以拥有终点**（这也就是为什么引擎并不像 AD 中星系
 *   直接单纯增幅计数频率强度那样只有一个机制，而是多个机制）」
 *
 *   ⇒ 也就是：每条机制走**饱和式** `1 + A·x/(1+x)`（`x = 等级/knee`），
 *     各自的 `knee` **错开** ⇒ 形成"早期吃①、中期吃②、后期吃⑤"的**排期** ✓
 *     这正是"多机制"相对 AD 单机制的优势：不会所有加成同时饱和。
 *
 *   ⚠️ ①④ 原来是**线性**（`1+lv` / `1+0.1lv`，真无界）⇒ 本次改成饱和式。
 *     ②②b 原来是开根（`1+0.0X·√lv`，增长极慢、2000 级才 1e0.16/1e0.51 ⇒ 名义机制）
 *     ⇒ 本次把系数提到可感知量级。
 */
export const REPEATABLE = {
  /**
   * 计数频率。用粒子买，价格 ×2，效果 ×1.1/级。
   * S 贡献 = log(1.1)/log(2) = 0.1375
   */
  particleBoost: {
    id: "particleBoost",
    name: "计数频率",
    /** kind 决定它进哪个乘区，formulas.js 按 kind 汇总 */
    kind: "countFreqAdd",
    currency: "particle",
    baseCost: 1,
    costMult: 2,
    effect: 1.1,
    /** 仿射系数：实际效果是 `1 + 0.05×等级`（不是 1.1^等级） */
    effectPerLevel: 0.05,
    /**
     * ⚠️ 效果文本由 `ui.js` 的 `effectText()` 从公式推导，**不要在这里写死**。
     *    曾经写成 `×1.1^等级`，而实现是 `1 + 0.05×等级` —— 100 级时
     *    卡片显示 ×13780、实际 ×6，差 2000 倍。
     */
    firstRewardDream: true },

  /**
   * 物质速率。用物质买，价格 ×1.5，效果 ×1.125/级。
   * S 贡献 = log(1.125)/log(1.5) = 0.2905
   */
  matterBoost: (() => {
    const M = 1.0625;
    return {
      id: "matterBoost",
      name: "物质速率",
      kind: "matterMul",
      currency: "matter",
      baseCost: 5,
      costMult: 1.5,
      effect: M,
      firstRewardDream: true };
  })(),

  /**
   * 熵凝聚。用粒子买。★ 结构最特殊的一条。
   *
   * 产出是**加法**的：output = 1 + 0.15n
   * 阈值也是**加法**的：threshold = 100 + 3n
   *   => 净转换率 = (1+0.15n)/(100+3n) -> 0.15/3 = 0.05（硬上限）
   *
   * ⚠️ 这个上限**不是 bug，是节拍器**。
   *
   * 曾经把它改成乘法（output = 1.07^n），结果在 400 级时转换率是原稿的
   * **93 亿倍**，整局 15 分钟就通关了（见 tools/compare-pace.mjs 的实测）。
   *
   * 原稿的设计意图是：
   *   Tier 0 的升级**有界**（转换率最大 4.7×），
   *   无界增长交给 Tier 1/2（ZPE 倍率、暗能量倍率）。
   * 这才是 S = 0.428 安全的原因 —— 加法项不进乘法池。
   *
   * 所以这里保持加法。买满 400 级也只有 4.69×，玩家自然会停止购买。
   */
  entropyCoeff: {
    id: "entropyCoeff",
    name: "熵凝聚",
    kind: "convAdd",
    currency: "particle",
    baseCost: 5,
    costMult: 1.5,
    /** 产出增量 / 级（加法）。极限转换率 = 产出增量 / 阈值增量 */
    outputPerLevel: 0.15,
    /** 阈值增量 / 级（加法） */
    thresholdPerLevel: 3,
    firstRewardDream: true } };

// ══════════════════════════════════════════════════════════
// 9 个虚空升级（全部一次性，固定价格）
// ══════════════════════════════════════════════════════════

export const VOID_UPGRADES = {
  v1: {
    id: "v1",
    name: "虚空过载",
    cost: "20000",
    // ★ 文案已改：原描述只写「ZPE 产出 ×3」，严重低估
    desc: "ZPE 产出 ×3。此外每拥有一个虚空升级，ZPE 产出额外 +1000%（可叠加）",
    rewardDream: true,
    // 效果在 formulas.js 里实现（见 zpeBaseMultiplier）
    note: "买下后立刻 ×33，买齐 9 个共 ×273" },
  v2: {
    id: "v2",
    name: "熵流加速",
    cost: "50000",
    desc: "熵产出 ×1.5",
    rewardDream: true },
  v3: {
    id: "v3",
    name: "物质重组",
    cost: "100000",
    desc: "粒子→物质 ×1.5",
    rewardDream: true },
  v4: {
    id: "v4",
    name: "虚空共鸣",
    cost: "300000",
    // ★ 文案已改：原描述是「系数从 0.02 → 0.08」，玩家看不懂系数是什么
    desc: "梦想点的全局加成系数：每点 +2% → +8%",
    rewardDream: true,
    note: "原稿此条完全无效（dreamCoefficient 写了没人读），已修" },
  v5: {
    id: "v5",
    name: "凝聚升华",
    cost: "1000000",
    // ★ 恢复原稿效果：每级产出增量 +0.5（0.15 -> 0.65）
    //   极限转换率从 0.05 提到 0.2167（4.3 倍），是**有界**的提升 —— 安全。
    desc: "熵凝聚每级产出增量 +0.5（极限转换率 0.05 → 0.2167）",
    rewardDream: true },
  v6: {
    id: "v6",
    name: "虚空汲取",
    cost: "3000000",
    // ★ 文案补全：原描述只写「ZPE 产出 ×5」
    desc: "ZPE 产出 ×5，且此后 ZPE 倍率也会影响 ZPE 产出",
    rewardDream: true },
  v7: {
    id: "v7",
    name: "超光速引擎",
    cost: "10000000",
    desc: "手动点击获得 ×5 熵（10 → 50 熵/次）",
    rewardDream: true },
  v8: {
    id: "v8",
    name: "虚空永恒",
    cost: "80000000",
    desc: "ZPE 倍率 ×1.5",
    rewardDream: true },
  v9: {
    id: "v9",
    name: "传承启迪",
    // 消耗 1 梦想点 + **门槛** 1e8 ZPE（见下方 requireZpe）
    costDream: 1,
    /**
     * ⚠️ **门槛**（不是价格）：ZPE 到 1e8 才允许购买。
     *
     * 原稿就是这么写的（`legacy/index.html` 的 `void-cost-v9`：「1 梦想点 + 1e8 ZPE」）。
     * 用户明确「v9 不改，故意设计的」⇒ `cost` 仍是 `"0"`（**不扣** ZPE），
     * 只保留"到 1e8 才解锁"这条门槛；加它的唯一目的是不让它开局 4 秒被买走
     * （实测它曾把 ZPE 在 7 分钟内推到 1e15，让 `tools/stage-timing.mjs` 的时长读数失真）。
     */
    requireZpe: 1e8,
    cost: "0",
    desc: "所有里程碑效果翻倍；熵凝聚/升级价格/熵阱价格的折扣改为「达到阈值自动获取」（不再扣钱）",
    rewardDream: false } };

// ══════════════════════════════════════════════════════════
// 6 个 ZPE 里程碑（阈值触发，永久）
// ══════════════════════════════════════════════════════════

