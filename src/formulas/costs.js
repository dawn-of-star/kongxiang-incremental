/**
 * formulas/costs.js —— 可重复升级、熵阱、虚空/暗能量升级的价格
 *
 * ★ 2026 模块化：由 1,116 行的 formulas.js 按领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/formulas.js`（barrel）导入。
 */
import { BASE, DE_UPGRADES, REPEATABLE, VOID_UPGRADES, dreamUpgradeEffects, piecewiseDeCost } from "../config.js";
import { D } from "./core.js";
import { deLevelOf, hasDe, hasZpe, levelOf } from "../state.js";
import { zpeMultiplier } from "./zpe.js";
import Decimal from "../../dist/break_eternity.esm.js";

export function effectiveZpeMultiplierForPrice(state) {
  let m = zpeMultiplier(state);
  if (hasDe(state, "dm4")) m = m.mul(D(1).add(state.darkEnergy.mul(0.05)));
  return m;
}

/** 可重复升级的价格（已应用折扣） */
export function repeatableCost(state, id) {
  const cfg = REPEATABLE[id];
  const lv = levelOf(state, id);
  let cost = D(cfg.baseCost).mul(Decimal.pow(cfg.costMult, lv));
  if (hasZpe(state, "m2")) cost = cost.div(effectiveZpeMultiplierForPrice(state));
  return cost;
}

/** 熵阱价格（已应用 m5 折扣 + 量子升级「退火」） */
export function trapCost(state) {
  // （原来这里读 `qe.trapCostMult` 覆盖基础增长 ——
  //   旧量子升级「退火」，已随整套系统删除，永远返回 null，所以直接去掉）
  const n = state.resources.traps;
  const mult = BASE.trapCostMult;
  let c = D(BASE.trapBaseCost).mul(Decimal.pow(mult, n));
  if (hasZpe(state, "m5")) c = c.div(zpeMultiplier(state));
  return c;
}

/** 虚空升级价格（固定） */
export function voidUpgradeCost(state, id) {
  return D(VOID_UPGRADES[id].cost);
}

/** 暗能量升级价格 */
export function deUpgradeCost(state, id) {
  const cfg = DE_UPGRADES[id];
  const lv = deLevelOf(state, id);
  const d = dreamUpgradeEffects(state);
  let particle = null;
  if (cfg.costParticle) {
    // 「相位锁定」会把高效相变的价格增长从 1.5 提到 2.0
    particle = id === "phaseShift"
      ? D(cfg.baseCost ?? 100).mul(Decimal.pow(d.phaseShiftCostMult, lv))
      : cfg.costParticle(lv);
  }
  let darkEnergy = null;
  if (cfg.costDarkEnergy) {
    // ★ 分段曲线（×3 -> ×1.5 -> ×2）用闭式解，不要循环
    darkEnergy = cfg.piecewise
      ? piecewiseDeCost(cfg.baseCost, lv)
      : D(cfg.baseCost).mul(Decimal.pow(cfg.costMult, lv));
  }
  return {
    dream: cfg.costDream ? D(cfg.costDream) : null,
    matter: cfg.costMatter ? cfg.costMatter(lv) : null,
    particle,
    zpe: cfg.costZpe ? cfg.costZpe(lv) : null,
    darkEnergy };
}

/**
 * 该升级在 v9 之后是否变成「达到阈值自动获取」（不扣钱）。
 * v9 会把 m2 / m5 的折扣升级成免费。
 */
