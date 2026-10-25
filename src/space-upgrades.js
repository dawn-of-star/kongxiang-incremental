/**
 * space-upgrades.js —— 空间膨胀 du 的购买 / 价格 / 等级
 *
 * 单一价格源：`space-config.js` 的 `baseCost` / `costMult`；UI 与引擎都走这里，
 * 不要按钮写一个价、扣款写另一个价。
 *
 * 购买规则：
 *   · du1~du6：SE 复购，价格 ×1.5^n / ×1.6^n；
 *   · du7 / du9 / du11：ST 单次；
 *   · du8 / du10：价格侧，本阶段 deferred，不实现。
 */
import Decimal from "../dist/break_eternity.esm.js";
import { spaceUnlocked } from "./space.js";
import { SPACE_UPGRADES } from "./space-config.js";

const D = (x) => new Decimal(x ?? 0);

export function spaceUpgradeConfig(id) {
  return SPACE_UPGRADES.find((u) => u.id === id) ?? null;
}

/** 当前等级；单次升级返回 0/1。 */
export function spaceUpgradeLevel(state, id) {
  const raw = state?.space?.upgrades?.[id];
  if (raw === true) return 1;
  return Math.max(0, Math.floor(Number(raw ?? 0) || 0));
}

/** 是否已拥有（单次升级只看 true / >0）。 */
export function spaceUpgradeOwned(state, id) {
  return spaceUpgradeLevel(state, id) > 0;
}

/** 下一级价格（Decimal）。 */
export function spaceUpgradeCost(state, id) {
  const cfg = spaceUpgradeConfig(id);
  if (!cfg) return D(Infinity);
  const base = D(cfg.baseCost);
  if (!cfg.repeatable) return base;
  const mult = Number(cfg.costMult) || 1;
  return base.mul(Decimal.pow(mult, spaceUpgradeLevel(state, id)));
}

/** 货币余额。 */
export function spaceCurrencyBalance(state, id) {
  const cfg = spaceUpgradeConfig(id);
  if (!cfg) return D(0);
  return D(cfg.currency === "se" ? state?.space?.se : state?.space?.st);
}

/** 当前能否买（不含 UI 的“暂缓”提示）。 */
export function spaceCanBuy(state, id) {
  const cfg = spaceUpgradeConfig(id);
  if (!cfg || cfg.deferred || cfg.pending) return false;
  if (!spaceUnlocked(state)) return false;
  if (!cfg.repeatable && spaceUpgradeOwned(state, id)) return false;
  return spaceCurrencyBalance(state, id).gte(spaceUpgradeCost(state, id));
}

/**
 * 买一级/一次。
 * @returns {{ok:boolean, reason?:string, cost?:Decimal, level?:number}}
 */
export function buySpaceUpgrade(state, id) {
  const cfg = spaceUpgradeConfig(id);
  if (!cfg) return { ok: false, reason: "unknown" };
  if (cfg.deferred) return { ok: false, reason: "deferred" };
  if (cfg.pending) return { ok: false, reason: "pending" };
  if (!spaceUnlocked(state)) return { ok: false, reason: "locked" };
  if (!cfg.repeatable && spaceUpgradeOwned(state, id)) return { ok: false, reason: "owned" };

  const cost = spaceUpgradeCost(state, id);
  const key = cfg.currency === "se" ? "se" : "st";
  const balance = D(state?.space?.[key]);
  if (balance.lt(cost)) return { ok: false, reason: "poor", cost };

  state.space[key] = balance.sub(cost);
  state.space.upgrades ??= {};
  const level = spaceUpgradeLevel(state, id) + 1;
  state.space.upgrades[id] = cfg.repeatable ? level : true;
  return { ok: true, cost, level };
}
