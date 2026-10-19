/**
 * formulas/dark-energy-rate.js —— 暗能量产出速率（依赖全局加成与 ZPE 速率）
 *
 * ★ 2026 模块化：由 1,116 行的 formulas.js 按领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/formulas.js`（barrel）导入。
 */
import { BASE, DE_EFF_CAP, INFINITY_UPGRADES } from "../config.js";
import { D } from "./core.js";
import { darkEnergyGainPerConversion } from "./dark-energy.js";
import { globalMultiplier } from "./global.js";
import { hasDe } from "../state.js";
import { tangramRewardEffects } from "../tangram.js";
import { zpeRate } from "./zpe.js";
import Decimal from "../../dist/break_eternity.esm.js";

export function effectiveDarkEnergyGain(state) {
  let g = darkEnergyGainPerConversion(state);
  // ★ 里程碑 dm4b：全局加成作用于相变转换速率
  if (hasDe(state, "dm4b")) g = g.mul(globalMultiplier(state));
  // ★ 2026：挑战奖励的 `deKneeMult`（d3~d6 清满）⇒ 暗能量收益抬升 ✓
  //   ⚠️ 它只是"乘一个数"（不改曲线形状 ⇒ 不动 p）✓
  const _deKnee = tangramRewardEffects(state?.tangramCleared).deKneeMult ?? 1;
  // ★ 2026：**软上限**（DE_EFF_CAP）必须作用在"收益"上，否则自增长仍是指数 ✗
  const _dlg = (state?.darkEnergy ?? new Decimal(0)).lte(0) ? 0 : state.darkEnergy.log10().toNumber();
  const _cap = DE_EFF_CAP;
  const deCapDecay = _dlg <= _cap.kneeLog10 ? 1 : Math.pow(2, -(_dlg - _cap.kneeLog10) / _cap.span);
  // ⚠️ 必须走 `.mul()`：`g` 可能是 >1e308 或 `ee…` 层的 Decimal，
  //   而 JS 的 `g * 数字` 会先 `valueOf()` 成 Number ⇒ Infinity/NaN ✗
  //   （README 数值约定 #3；这正是 2026 离线结算里 darkEnergy/zpe 变 ∞ 的根因）
  return g.mul(_deKnee).mul(deCapDecay);
}

/**
 * 暗能量生成速率（每秒）。
 *
 * ★ 里程碑 dm4b（1e6 暗能量）：**全局加成作用于相变转换速率**。
 *
 *   注意它和「熵凝聚转换速率」是两回事：
 *     · 熵凝聚（entropy→particle）在 particleRate 里，**不含 dm4b**
 *     · 相变（ZPE→暗能量）就是这里
 *
 *   所以 dm4b **完全不碰主环**：主环增益仍是 globalMult²，时间压缩不变。
 *   它只让暗能量积累变快：
 *     `dDE/dt = zpeRate/1e8 × gain × globalMult`
 *     而 globalMult 含 `deMult = 1 + 0.25·log2(DE)`
 *     => `dDE/dt ∝ log(DE)/DE^0.5`
 *     数学结论见 tools/de-milestone-model.mjs：峰值在 DE≈1e4.5，**不会失控**。
 */
export function darkEnergyRate(state) {
  if (!state.phaseTransmuterUnlocked) return D(0);
  const r = zpeRate(state).div(BASE.darkEnergyThreshold).mul(effectiveDarkEnergyGain(state));
  // ⚠️ 2026：暗物质的落点**不在这里**。
  //   我第一版按设计稿字面把它乘在这个函数里（"提升第一个相变仪的获取效率"），
  //   但用户 2026 重写的规则把落点定为**暗能量倍率的加法区** ⇒ 见 `darkEnergyMultiplier()` ✓
  // ★ ∞ 层 ③「相变超频」：无限点加速相变仪（ZPE → 暗能量）
  if (state.ipToTransmuterBought) {
    return r.mul(D(1).add(D(INFINITY_UPGRADES.ipToTransmuter.perIp).mul(state.infinityPoints ?? 0)));
  }
  return r;
}

// ══════════════════════════════════════════════════════════
// 熵 → 粒子
// ══════════════════════════════════════════════════════════

/**
 * 当前的转换规则。
 *
 * 产出与阈值**都是加法**：
 *   output    = 1 + 0.15n        （v5 后 1 + 0.65n）
 *   threshold = 100 + 3n
 *   净转换率 -> 0.15/3 = 0.05（v5 后 0.65/3 = 0.2167）
 *
 * ⚠️ 这个上限是**节拍器**，不是缺陷。曾经改成乘法（output = 1.07^n），
 *    400 级时转换率变成原稿的 93 亿倍，整局 15 分钟通关。
 *    详见 config.js 里 entropyCoeff 的注释和 tools/compare-pace.mjs。
 */
