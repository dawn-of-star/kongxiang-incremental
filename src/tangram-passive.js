
/**
 * ★★★ 2026：**「每秒 1% 本次无限可获得的 IP」**（设计稿 §4 的中间难度全清奖励）
 *
 * 等价于 AD 的 **TS181**（`src/core/secret-formula/eternity/time-studies/normal-time-studies.js`）：
 *     原文 =「You gain **1%** of your **IP gained this Infinity** per second」
 *
 * ⚠️ 两条必须守的规矩：
 *   ① 收益源必须走 `bigCrunchGain()`（**唯一数据源**）—— 由 engine 以**参数**传进来
 *      （本模块不 import engine ⇒ 无循环依赖 ✓）
 *   ② 它**不改指数**：`dIP/dt = 0.01·G`，而 `G ∝ IP^0.301` ⇒ 渐近行为不变 ✓
 *      （白名单条目：见 `docs/TANGRAM.md` §5.1c；`p` 的实测余量 0.301 ≪ 1 ✓）
 *
 * ⚠️ 解锁条件 = 「拼装挑战的**中间难度全清**」（`tangramRewardEffects().passiveIpFrac > 0`）✓
 */
import Decimal from "../dist/break_eternity.esm.js";
import { tangramRewardEffects } from "./tangram.js";

/**
 * @param {object} state
 * @param {number} dtSec     本帧秒数
 * @param {(state: object) => Decimal} gainFn  = `bigCrunchGain`（engine 传进来）
 * @returns {Decimal} 本帧应加到 `state.infinityPoints` 的量（未解锁 ⇒ 恰好 0 ✓）
 */
export function tangramPassiveIpGain(state, dtSec, gainFn) {
  const frac = tangramRewardEffects(state?.tangramCleared).passiveIpFrac;
  if (!frac) return new Decimal(0);
  const dt = Math.max(0, Number(dtSec) || 0);
  if (dt <= 0) return new Decimal(0);
  if (!state?.brokenInfinity) return new Decimal(0);        // 破∞前没有"本次无限收益"⇒ 不给 ✓
  const g = gainFn(state);
  if (!g || !g.gt || !g.gt(0)) return new Decimal(0);
  return g.mul(frac).mul(dt / 1000);                        // ⚠️ dt 是**毫秒**（与 tick 一致）
}

/** 便捷版：直接加到 state 上（返回加了多少，供日志/断言用）✓ */
export function applyTangramPassiveIp(state, dtMs, gainFn) {
  const gain = tangramPassiveIpGain(state, dtMs, gainFn);
  if (gain.lte(0)) return gain;
  state.infinityPoints = (state.infinityPoints ?? new Decimal(0)).add(gain);
  return gain;
}
