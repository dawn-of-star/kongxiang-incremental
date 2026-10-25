/**
 * formulas/costs.js —— 可重复升级、熵阱、虚空/暗能量升级的价格
 *
 * ★ 2026 模块化：由 1,116 行的 formulas.js 按领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/formulas.js`（barrel）导入。
 */
import { BASE, DE_UPGRADES, PIECEWISE, REPEATABLE, VOID_UPGRADES, dreamUpgradeEffects, piecewiseDeCost } from "../config.js";
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
 * ★★★ 2026（用户：「我现在的购买量级马上到百万了」）：
 * **暗能量升级的「还能买几级」—— O(1) 闭式解**（按段求和，最多 3 段）。
 *
 * ── 为什么必须有它 ──
 *   旧实现是**逐级循环**（`while (n < 500 && buyDeUpgrade(...))`、自动化里 `for (i<5000)`）：
 *   百万级时要么被硬上限截断（"买满不买满"✗），要么跑几百万次（卡死 ✗）。
 *   等比价格的级数和有闭式解，所以**不需要**循环：
 *     前 k 级总价 = P₀^(r^k − 1)/(r − 1)  ⇒  k = ⌊log_r(1 + 池·(r−1)/P₀)⌋ ✓
 *   `deGainBase` 是**三段**（×3 → ×1.5 → ×2），按段边界逐段解 —— 段数 ≤3 ⇒ 仍是 O(1) ✓
 *
 * ⚠️ 价格的**唯一来源**仍是 `deUpgradeCost`（本函数只反解级数，不自己造价格）✓
 * ⚠️ `dreamAnnihilation`（梦想点 + 物质、上限 10 级）不在这里 —— 它 ≤10 级，调用方直接循环 ✓
 *
 * @param {number} cap 最多算几级（安全阀；默认不设限）
 * @returns {{k:number, spent:Decimal, pool:"particle"|"zpe"|"darkEnergy"}|null}
 *   `spent` = 买 k 级的总价（与 `deUpgradeCost` 逐级求和一致，见断言）
 */
export function deLevelsAffordable(state, id, cap = Infinity) {
  const cfg = DE_UPGRADES[id];
  if (!cfg) return null;
  // 只处理这四条（其余价格形状不同）
  let poolKey, ratio, piecewise = false;
  const d = dreamUpgradeEffects(state);
  if (id === "phaseShift") { poolKey = "particle"; ratio = d.phaseShiftCostMult; }
  else if (id === "vacuumAccel") { poolKey = "zpe"; ratio = 10; }
  else if (id === "convOutput") { poolKey = "darkEnergy"; ratio = cfg.costMult; }
  else if (id === "deGainBase") { poolKey = "darkEnergy"; piecewise = true; }
  else return null;

  const lv = deLevelOf(state, id);
  let room = Number(cap);
  if (cfg.maxLevel != null) room = Math.min(room, Number(cfg.maxLevel) - lv.toNumber());
  if (!(room > 0)) return { k: 0, spent: D(0), pool: poolKey };

  const poolSrc = poolKey === "particle" ? state.resources.particle : poolKey === "zpe" ? state.zpe : state.darkEnergy;
  let pool = D(poolSrc ?? 0);

  // 当前这一级的价格（权威来源；`null` ⇒ 该币种不参与 ⇒ 买不了）
  const cost = deUpgradeCost(state, id);
  let price = cost.particle ?? cost.zpe ?? cost.darkEnergy;
  if (!price) return { k: 0, spent: D(0), pool: poolKey };

  /** 等比：池子还能买几级（P 为当前级价格） */
  const levelsFrom = (P, r, cash) => {
    if (!(r > 1) || cash.lt(P)) return 0;
    const x = cash.mul(r - 1).div(P).add(1);
    const k = Math.floor(x.log(r).toNumber());
    return Number.isFinite(k) && k > 0 ? k : 0;
  };
  /** 等比前 k 级总价 */
  const sumOf = (P, r, k) => P.mul(Decimal.pow(r, k).sub(1)).div(r - 1);

  let k = 0;
  let spent = D(0);

  if (!piecewise) {
    const want = Math.min(room, levelsFrom(price, ratio, pool));
    if (want > 0) { k = want; spent = sumOf(price, ratio, k); }
    return { k, spent, pool: poolKey };
  }

  // ── deGainBase：三段 ──
  const B = D(cfg.baseCost);
  const P1 = D(PIECEWISE.p1), P2 = D(PIECEWISE.p2);
  const aEnd = B.gte(P1) ? 0 : Math.ceil(P1.div(B).log(PIECEWISE.r1).toNumber());
  const pA = B.mul(Decimal.pow(PIECEWISE.r1, aEnd));
  const bEnd = pA.gte(P2) ? 0 : Math.ceil(P2.div(pA).log(PIECEWISE.r2).toNumber());
  let cur = lv.toNumber();
  let guard = 0;
  while (k < room && guard++ < 8) {
    let r, boundary;
    if (cur < aEnd) { r = PIECEWISE.r1; boundary = aEnd; }
    else if (cur < aEnd + bEnd) { r = PIECEWISE.r2; boundary = aEnd + bEnd; }
    else { r = PIECEWISE.r3; boundary = Infinity; }
    const roomHere = Math.min(room - k, boundary === Infinity ? Infinity : boundary - cur);
    const afford = Math.min(roomHere, levelsFrom(price, r, pool.sub(spent)));
    if (afford <= 0) break;
    spent = spent.add(sumOf(price, r, afford));
    price = price.mul(Decimal.pow(r, afford));
    cur += afford;
    k += afford;
    if (boundary === Infinity) break;
  }
  return { k, spent, pool: poolKey };
}
