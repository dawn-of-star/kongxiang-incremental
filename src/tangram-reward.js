/**
 * ★★★ 2026：**挑战奖励落进公式的那一层**（用户：「做吧」）
 *
 * 六个系数，全部是**乘一个数**：不改任何公式的形状 ⇒ **不动 `p`** ✓
 *   · convSlopeMult      → `conversion()` 的 perLevel（横轴）
 *   · countFreqMult      → `countFreqAddTerm()` 的 extra−1（斜轴）
 *   · freeZpeEngineLevels→ `effectiveEngineLevel()`（纵轴，已接）
 *   · pityFloor          → 抽取保底次数（`drawTangramPiece`）
 *   · deKneeMult         → 暗能量基础收益的 knee（`deGainBase` 落点）
 *   · ipDoubleKneeMult   → `ipDouble` 软上限的 knee
 *
 * ⚠️ 基线（一题没清）时**每个系数都是 1 / 0** ⇒ 零回归 ✓
 */
import { tangramRewardEffects } from "./tangram.js";

/** 只计算一次（按 tangramCleared 的签名缓存，避免每帧重算）✓ */
let cache = { key: "", val: null };
export function tangramRewards(state) {
  const arr = state?.tangramCleared ?? [];
  const key = arr.join(",");
  if (cache.key === key && cache.val) return cache.val;
  const val = tangramRewardEffects(arr);
  cache = { key, val };
  return val;
}

export const rewardConvSlopeMult = (state) => tangramRewards(state).convSlopeMult ?? 1;
export const rewardCountFreqMult = (state) => tangramRewards(state).countFreqMult ?? 1;
export const rewardPityFloor = (state) => tangramRewards(state).pityFloor ?? 150;
export const rewardDeKneeMult = (state) => tangramRewards(state).deKneeMult ?? 1;
export const rewardIpDoubleKneeMult = (state) => tangramRewards(state).ipDoubleKneeMult ?? 1;
export const rewardFreeEngineLevels = (state) => tangramRewards(state).freeZpeEngineLevels ?? 0;
