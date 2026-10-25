/**
 * formulas/dark-energy.js —— 暗能量倍率与单次转换量
 *
 * ★ 2026 模块化：由 1,116 行的 formulas.js 按领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/formulas.js`（barrel）导入。
 */
import { darkMatterAdditiveTerm, deGainBaseEffectMult, dreamUpgradeEffects, effectiveDarkEnergyLog10Of, engineBonusMult, qOf, quantumDeGainBonus, quantumDeMultBonus, zpeEngineMultBonus } from "../config.js";
import { spaceDeEffectiveLog10 } from "../space.js";
import { D } from "./core.js";
import { deLevelOf, hasDe } from "../state.js";
import Decimal from "../../dist/break_eternity.esm.js";

export function darkEnergyMultiplier(state) {
  // ⚠️ 用 **darkEnergyTotal（历史总量）**，不是 darkEnergy（当前余额）。
  //
  // 踩过（用户报告：「买凝聚斜率后 1熵=N粒子 反而变小」）：
  //   阈值 = (100+3n) / ZPE倍率 / 【暗能量倍率】
  //   而 deMult 原来读**余额**。花暗能量买升级 -> 余额降 -> deMult 降
  //   -> 阈值升 -> 转换率降。实测：
  //       花费占余额  8%  -> +3.36%
  //       花费占余额 41%  -> +0.67%
  //       花费占余额 55%  -> ❌ -2.53%
  //       花费占余额 82%  -> ❌ -12.49%
  //   即「买升级反而变弱」——升级给的产出增量是固定绝对值，打不过余额损失。
  //
  //   darkEnergyTotal 从不被坍缩/大坍缩重置，所以「累计产出过多少」才是
  //   奖励的正确语义。这也是 dm5 里程碑同一个坑（那边已修）。
  //
  // 注意「双刃」的另一半**故意保留**：zpeProductionPenalty 仍然看余额 ——
  // 「囤着不用伤 ZPE」这个惩罚是有意设计，不该一起改掉。
  const de = state.darkEnergyTotal.gt(0) ? state.darkEnergyTotal : D(0);
  // ★ 2026-10-25 归一化：暗能量倍率改用**有效量**（DE_EFF_CAP 渐近上限），
  //   不再削 DE 的产出/自增长。用累计总量算，避免花钱导致倍率下降。
  //   du11 在此抬“被削弱后的下限”，不再碰物质 overload。
  const rawLog10 = de.gt(0) ? de.log10().toNumber() : 0;
  const cappedLog10 = effectiveDarkEnergyLog10Of(de);
  const effLog10 = spaceDeEffectiveLog10(state, rawLog10, cappedLog10);
  const x = D(effLog10 * 3.321928094887362);   // log2(10^L) = L·log2(10)
  const coeff = Decimal.min(D(0.1).add(x.div(20).mul(0.15)), D(0.25));
  // ★ 量子：作为**基础加成**加进括号里（a区），量是 q²。
  //   `暗能量倍率 = (1 + 0.25·log2(暗能量)) + q²`
  // ★★★ 2025（用户裁定）：量子这项也吃引擎倍率（5 条之一）
  // ★★★ 2026：「永恒之后」第一块 —— 暗物质的转化值**加进同一个加法池**（与 q² 同形制）。
  //   未解锁 / n = 0 ⇒ 恰好 0 ⇒ **零回归** ✓
  //   ⚠️ 它是**加法区常数项** ⇒ 不进 `computeS`（那只统计可重复乘法升级），
  //      且常数只在 `∂ln(倍率)/∂ln(DE)` 的**分母**里 ⇒ 引擎环增益**下降** ⇒ 更安全 ✓
  const base = D(1).add(x.mul(coeff))
    .add(quantumDeMultBonus(qOf(state), engineBonusMult(state)))
    .add(darkMatterAdditiveTerm(state));
  const accel = Decimal.pow(
    dreamUpgradeEffects(state).vacuumAccelEffectMult,
    deLevelOf(state, "vacuumAccel"),
  );
  // ★ 2025 设计稿第 4 条：**ZPE 引擎提供的倍率也作用在暗能量倍率上**。
  //   ⇒ 与第 3 条（`暗能量倍率 ^1.03 → ZPE 倍率`）**闭合成环** ✗
  //   环增益验算见 `tools/zpe-engine-lab.mjs`：因为 `暗能量倍率 ∝ log2(暗能量)`（对数 ✓），
  //   所以 `∂ln(DE倍率)/∂ln(DE)` 极小 ⇒ 整环增益 ≈ 1e-3 量级 ⇒ **安全** ✓
  //   ⚠️ 但引擎等级不设上限时它会跟着 2^等级 一起膨胀 ⇒ **上限权在用户手里**（设计稿保留 ✓）
  return base.mul(accel).mul(zpeEngineMultBonus(state));
}

/** 每转换一次得到多少暗能量 */
export function darkEnergyGainPerConversion(state) {
  const d = dreamUpgradeEffects(state);
  let g = Decimal.pow(d.phaseShiftEffectMult, deLevelOf(state, "phaseShift"))
    .mul(d.phaseShiftBaseMult)
    // ★ 新增「相变增幅」：基础暗能量获取的乘法区
    //   ★★★ 2026：倍率改走 `deGainBaseEffectMult(state)` —— **em4「优化暗能量获取公式」的唯一入口**
    //   （em4 前 = 1.10，em4 后 = 1.12；**不许**在这里直接读 `DE_UPGRADES.deGainBase.effectMult` ✗）
    .mul(Decimal.pow(
      deGainBaseEffectMult(state),
      deLevelOf(state, "deGainBase"),
    ));
  if (hasDe(state, "dm5")) g = g.mul(darkEnergyMultiplier(state));
  // ★ 量子：作为**基础加成**加进括号里（a区），量是 log10(q)。
  //   `每次转换量 = ... × [1 + log10(q)]`
  // ★★★ 2025（用户裁定）：量子这项也吃引擎倍率（5 条之一）
  return g.mul(D(1).add(quantumDeGainBonus(qOf(state), engineBonusMult(state))));
}

// ══════════════════════════════════════════════════════════
// 熵阱
// ══════════════════════════════════════════════════════════

/**
 * 实际生效的熵阱数量。
 *
 * m4「ZPE 倍率影响熵阱实际生效数量」—— 放大**数量**。
 *
 * ⚠️ 量子**不在这里**，也**不在 zpeRate 里**（这里原先写「ZPE 产出倍率 ×(1+log10 量子数)
 *    只进 zpeRate」，那是更早一版的模型，已经不存在了）。量子现在一共 4 条作用：
 *      entropyRate            ×(1+q)          -> **c区**（最终倍率，作用在增量上）
 *      darkEnergyMultiplier   +q²（加法池）    -> a区
 *      darkEnergyGainPerConversion ×(1+log10 q) -> a区
 *      matterRate / tick      M×R(q)×ln10      -> 等价写法的 **b区**（见 engine.js）
 *    所以「ZPE / 暗能量涨不动、物质照样指数到 e308」是结构性的，不是显示问题。
 */
