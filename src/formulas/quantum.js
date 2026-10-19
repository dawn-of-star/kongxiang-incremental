/**
 * formulas/quantum.js —— 量子里程碑 / 粒子时变增幅
 *
 * ★ 2026 模块化：由 1,116 行的 formulas.js 按领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/formulas.js`（barrel）导入。
 */
import { DE_SPAN, QUANTUM_MILESTONES, infinityRateMult, qOf, softCapB, tierAccelMult } from "../config.js";
import { D } from "./core.js";
import Decimal from "../../dist/break_eternity.esm.js";

export function quantumMilestonesDone(state) {
  return QUANTUM_MILESTONES.filter((m) => state.quantumMilestones?.[m.id]);
}

/**
 * 粒子增幅速率常数 `b`（阶/秒）—— **替代 R 的那个杠杆**。
 *
 * `b = b0 · (1 + √q / 10) · 【量子里程碑的乘算加成】·【档位加速】`
 *   · `q` = 当前量子个数（每轮重置）
 *   · 档位加速：`qm2` 达成后，每档位 ×1.06（这是把 24 档压到 ~90h 的来源）
 *   · 硬封顶 `bMax`（用户既有要求：影响永恒阶段的东西必须有极强软上限）
 *
 * 时变增幅 `g(t) = 10^(b·本轮已过时间)`：**g 必须随时间增长**，否则只是"平移高度"到不了硬顶。
 */
export function checkQuantumMilestones(state) {
  const got = [];
  const total = state.quantumPairsTotal ?? D(0);
  for (const m of QUANTUM_MILESTONES) {
    if (!state.quantumMilestones[m.id] && total.gte(m.need)) {
      state.quantumMilestones[m.id] = true;
      got.push(m);
    }
  }
  return got;
}

/** 已达成的量子里程碑 */
export function particleBoostRate(state) {
  const b0 = DE_SPAN.b0;
  const q = Math.max(0, qOf(state).toNumber());
  let b = b0 * (1 + Math.sqrt(q) / 10);
  // 里程碑的乘算加成（qm1/qm3/qm6 是 b 加成；qm2 是"开启档位加速"）
  for (const m of quantumMilestonesDone(state)) {
    if (m.kind === "b") b *= m.value;
  }
  // 档位加速：qm2 达成后，每档位 ×1.0209（档位 = 已大坍缩次数）
  // ★ 2025 B1：改走 `tierAccelMult()` —— 原式 `Math.pow(tierAccel, 无界档位数)` 在
  //   破∞后的坍缩刷屏里会算出 Infinity ⇒ b=Infinity ⇒ softCapB 出 NaN ⇒ 全链冻结 ✗
  b *= tierAccelMult(state);
  // ★ 2025：R 退休后，原先"改成长速率"的三个旋钮里**只剩两个**
  //   （∞「速率解放」/ 档位 rate 里程碑）—— 「坍缩加速器」已整个删除（用户裁定）。
  //   `infinityRateMult()` 仍是它们的唯一汇总入口 ✓
  //   于是它们的作用从"抬 R"变成"抬 b"（同样是提速，但落点在粒子线，环外 ✓）
  b *= infinityRateMult(state).toNumber();
  // ★ 阈值软上限（用户 2025 选定）：不再用硬封顶 `min(b, bMax)` ✗
  //   低于阈值原样通过；超过则 `阈值 + 超出·2^(−超出/跨度)` ⇒ 有界、平滑 ✓
  return softCapB(b, state);
}

/**
 * 粒子获得的时变增幅 `g = 10^(b · 本轮已过时间)`（甲方案：时间**每轮重置**）。
 *
 * 用户选甲的理由：若用全局累计时间，堆叠会让时间失去意义（第二次大坍缩起瞬间到顶）。
 */
export function particleTimeBoost(state) {
  const b = particleBoostRate(state);
  const t = Math.max(0, (state.infinityElapsed ?? 0));      // 秒；大坍缩时归零
  return Decimal.pow(10, b * t);
}

/**
 * 暗能量里程碑的额外门槛。
 * dm0（相变仪）在原稿里要求「v8 已购 且 物质 ≥ 1e8」，见 config.js 的注释。
 */
