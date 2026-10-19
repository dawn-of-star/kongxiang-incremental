/**
 * state/accessors.js —— 状态访问器：等级 / 里程碑 / 成就计数
 *
 * ★ 2026 模块化：由 673 行的 state.js 按职责拆出（声明与注释逐字保留）。
 *    对外统一从 `src/state.js`（barrel）导入。
 */
import { D } from "./helpers.js";
import { pushLog } from "./log.js";

export function awardDream(state, key, label) {
  if (state.dreamAwarded[key]) return false;
  state.dreamAwarded[key] = true;
  state.dreamPoints = state.dreamPoints.add(1);
  pushLog(state, `💭 新成就「${label}」 梦想点 +1（共 ${state.dreamPoints.toString()}）`);
  return true;
}

export function achievementCount(state) {
  return Object.keys(state.dreamAwarded).length;
}

// ══════════════════════════════════════════════════════════
// 里程碑查询（把「是否已达成」统一成一个函数，formulas 里好读）
// ══════════════════════════════════════════════════════════

export function hasZpe(state, id) {
  return state.zpeMilestones[id] === true;
}

export function hasDe(state, id) {
  return state.deMilestones[id] === true;
}

export function hasVoid(state, id) {
  return state.voidUpgrades[id] === true;
}

/** v9 已购 —— 影响很多地方，单独包一个 */
export function hasV9(state) {
  return state.voidUpgrades.v9 === true;
}

// ══════════════════════════════════════════════════════════
// 等级读写
// ══════════════════════════════════════════════════════════

export function levelOf(state, id) {
  return state.levels[id] ?? D(0);
}

export function addLevel(state, id, n = 1) {
  state.levels[id] = levelOf(state, id).add(n);
}

export function deLevelOf(state, id) {
  return state.deUpgradeLevels[id] ?? D(0);
}

// ══════════════════════════════════════════════════════════
// 日志
// ══════════════════════════════════════════════════════════

