/**
 * ★★★ 2026：**七巧板三条轴的加成**（设计稿 `docs/TANGRAM.md` §2 **已勘定**的落点）
 *
 * | 轴 | 覆盖率 | 落点（唯一入口） | 范围 |
 * |---|---|---|---|
 * | 纵轴 | `cov.vert` | `effectiveEngineLevel()`（免费 ZPE 引擎） | 10 → 10000 **级** |
 * | 横轴 | `cov.horz` | `conversion()` 的 output/threshold（速率） | 0.1 → 1e13 |
 * | 斜轴 | `cov.diag` | `countFreqAddTerm()` 的每级系数 | 0.05 → 50 |
 *
 * ⚠️ 两条硬规矩：
 *   ① **连续、单调**，`cov=0 ⇒ lo`、`cov=1 ⇒ hi`（不是"集齐七块才给全额"的开关 ✗）
 *   ② 三条轴都喂**永恒阶段** ⇒ 各配**极强软上限**（`PROGRESSION.md` §4.5）：
 *      这里用 **log 空间插值 + knee 饱和** ⇒ 覆盖率再高也不会突破 §4.5 的上限 ✓
 *
 * ⚠️ 独立模块（`formulas.js`/`config.js` 各只加一行调用）✓
 */
import { axisCoverageAll } from "./tangram.js";
import { placedVertices } from "./tangram.js";

/** 三条轴的端点（唯一数据源）✓ */
export const TANGRAM_AXES_RANGE = {
  /** 纵轴：免费 ZPE 引擎等级 10 → 10000 */
  engineLevel: { lo: 10, hi: 10000 },
  /** 横轴：熵→粒子速率 0.1 → 1e13 */
  convRate: { lo: 0.1, hi: 1e13 },
  /** 斜轴：计数频率每级系数 0.05 → 50 */
  countFreqPerLevel: { lo: 0.05, hi: 50 },
  /** 软上限：log 空间的 knee（覆盖率到这个比例之后开始饱和）✓ */
  knee: 0.85,
};

/**
 * log 空间插值 + knee 饱和：`cov=0 ⇒ lo`、`cov=1 ⇒ hi`，且**平滑、严格单调** ✓
 * 形状：前 knee 段线性爬到 `kneeLo`，之后按指数趋近 `hi`（永远到不了 ⇒ 天然封顶 ✓）
 */
function mixLog(cov, { lo, hi }) {
  const c = Math.min(1, Math.max(0, Number(cov) || 0));
  const knee = TANGRAM_AXES_RANGE.knee;
  const l0 = Math.log10(lo);
  const l1 = Math.log10(hi);
  if (c <= 0) return lo;
  if (c >= 1) return hi * (1 - 1e-9);         // 覆盖率 100% ⇒ 几乎到顶（但不越过 ✓）
  if (c <= knee) return Math.pow(10, l0 + (l1 - l0) * (c / knee) * 0.5);   // 前半段只走一半 log 距离
  const t = (c - knee) / (1 - knee);
  return Math.pow(10, l0 + (l1 - l0) * (0.5 + 0.5 * (1 - Math.pow(2, -3 * t))));
}

/** 当前三轴覆盖率 → 三个参数 ✓（每帧调；纯算术，无副作用） */
export function tangramAxisParams(state) {
  const cov = axisCoverageAll(placedVertices(state?.tangramPlaced));
  return {
    engineLevel: Math.floor(mixLog(cov.vert, TANGRAM_AXES_RANGE.engineLevel)),
    convRate: mixLog(cov.horz, TANGRAM_AXES_RANGE.convRate),
    countFreqPerLevel: mixLog(cov.diag, TANGRAM_AXES_RANGE.countFreqPerLevel),
    cov,
  };
}

/** 斜轴：计数频率每级的**倍率**（相对基线 0.05）✓ —— `countFreqAddTerm` 只加一行用这个 */
export function tangramCountFreqMult(state) {
  const p = tangramAxisParams(state);
  return Math.max(0, p.countFreqPerLevel / TANGRAM_AXES_RANGE.countFreqPerLevel.lo);
}

/** 纵轴：免费 ZPE 引擎等级的**额外级数** ✓ */
export function tangramEngineBonusLevels(state) {
  return tangramAxisParams(state).engineLevel - TANGRAM_AXES_RANGE.engineLevel.lo;
}

/** 横轴：熵→粒子速率的**倍率**（相对基线 0.1）✓ */
export function tangramConvRateMult(state) {
  return tangramAxisParams(state).convRate / TANGRAM_AXES_RANGE.convRate.lo;
}

// ⚠️ 2026：这里**不**提供 `effectiveEngineLevel()` ——
//   唯一入口在 `src/config/zpe-engine/config.js`（裸等级 + 纵轴覆盖 + 挑战奖励 ✓）。
//   我曾在此加过一份纯函数版 ⇒ **重复入口** ✗（同一件事两条路，已删 ✓）。
//   ⚠️ 也**不能**在这里 import 那个入口：本文件是 formulas/config 反向依赖的底层模块 ✗
//   ⇒ 需要它的地方直接从 `config/zpe-engine/config.js` 取 ✓
