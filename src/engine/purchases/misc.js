/**
 * engine/purchases/misc.js —— 虚空 / 暗能量 / 梦想升级购买
 *
 * ★ 2026 模块化：由 512 行的 engine/purchases.js 拆出（声明与注释逐字保留）。
 *    对外统一从 `src/engine.js`（barrel）导入。
 */
import { DE_UPGRADES, DREAM_BY_ID, VOID_UPGRADES, dreamUpgradeCostAt, dreamUpgradeLevelOf, markPageUnlocked } from "../../config.js";
import { deUpgradeCost, voidUpgradeCost } from "../../formulas.js";
import { awardDream, deLevelOf, pushLevelLog, pushLog } from "../../state.js";

/**
 * engine/purchases.js —— 其余购买动作（虚空 / 暗能量 / 梦想 / ∞ / ZPE 引擎 / 暗物质）
 *
 * ★ 2026 模块化：由 1,660 行的 engine.js 按动作领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/engine.js`（barrel）导入。
 */





export function buyVoidUpgrade(state, id) {
  const cfg = VOID_UPGRADES[id];
  if (!cfg || state.voidUpgrades[id]) return false;

  // ★ 先把**两项**价格都验完再扣款。
  //   老写法是「先扣梦想点 -> 再查 ZPE」，如果 ZPE 不够就直接 return false，
  //   扣掉的梦想点不会退回来（白扣）。现在 v9 的 ZPE 价格是 0 所以碰不到，
  //   但只差一条带 dream + zpe 双价的升级就会踩上。
  const cost = voidUpgradeCost(state, id);
  if (cfg.costDream && state.dreamPoints.lt(cfg.costDream)) return false;
  if (cost.gt(0) && state.zpe.lt(cost)) return false;
  // ★ **门槛**（不是价格）：v9 要求 ZPE 到 1e8 才解锁 —— 原稿逻辑，见 config 的 `requireZpe`。
  //   用户确认「v9 不改，故意设计的」，所以这里只挡"太早买"，不扣 ZPE。
  if (cfg.requireZpe != null && state.zpe.lt(cfg.requireZpe)) return false;

  if (cfg.costDream) state.dreamPoints = state.dreamPoints.sub(cfg.costDream);
  if (cost.gt(0)) state.zpe = state.zpe.sub(cost);

  state.voidUpgrades[id] = true;
  markPageUnlocked(state, "void");       // ★ 永久解锁记录（永恒后不再上锁）
  pushLog(state, `⚡ 购买虚空升级「${cfg.name}」`);
  awardDream(state, `void:${id}`, `虚空升级「${cfg.name}」`);

  if (cfg.rewardDream) {
    state.dreamPoints = state.dreamPoints.add(1);
    pushLog(state, "💭 获得 1 梦想点（虚空升级奖励）");
  }
  return true;
}

/** 购买暗能量升级 */
export function buyDeUpgrade(state, id) {
  const cfg = DE_UPGRADES[id];
  if (!cfg) return false;
  const lv = deLevelOf(state, id);
  if (cfg.maxLevel != null && lv.gte(cfg.maxLevel)) return false;

  const cost = deUpgradeCost(state, id);
  if (cost.dream && state.dreamPoints.lt(cost.dream)) return false;
  if (cost.matter && state.resources.matter.lt(cost.matter)) return false;
  if (cost.particle && state.resources.particle.lt(cost.particle)) return false;
  if (cost.zpe && state.zpe.lt(cost.zpe)) return false;
  if (cost.darkEnergy && state.darkEnergy.lt(cost.darkEnergy)) return false;

  if (cost.dream) state.dreamPoints = state.dreamPoints.sub(cost.dream);
  if (cost.matter) state.resources.matter = state.resources.matter.sub(cost.matter);
  if (cost.particle) state.resources.particle = state.resources.particle.sub(cost.particle);
  if (cost.zpe) state.zpe = state.zpe.sub(cost.zpe);
  if (cost.darkEnergy) state.darkEnergy = state.darkEnergy.sub(cost.darkEnergy).max(0);   // ★ 夹住 ≥0：否则 log10(负数) = NaN ⇒ 整条链坏死 ✗

  state.deUpgradeLevels[id] = lv.add(1);
  pushLevelLog(state, cfg.name, lv.toNumber(), lv.add(1).toNumber());

  if (cfg.firstRewardDream && !state.deFirstPurchase[id]) {
    state.deFirstPurchase[id] = true;
    state.dreamPoints = state.dreamPoints.add(1);
    pushLog(state, `💭 首次购买「${cfg.name}」，获得 1 梦想点`);
  }
  return true;
}

// ══════════════════════════════════════════════════════════
// v9 的「达到阈值自动获取」
// ══════════════════════════════════════════════════════════

/**
 * 自动购买某个暗能量升级（由梦想点升级解锁）。
 *
 * ⚠️ 同样用**闭式解**，不写循环。这两个升级的价格都是等比数列：
 *   高效相变   100 × r^等级          (r = costMult)
 *   真空加速   10^等级
 * 前 k 级总价 = base × (r^k - 1)/(r - 1)
 * 反解    k  = floor(log_r(资源 × (r-1)/base + 1))
 *
 * @returns {number} 实际买到的级数
 */
export function buyDreamUpgrade(state, id) {
  const d = DREAM_BY_ID[id];
  if (!d) return false;
  const lv = dreamUpgradeLevelOf(state, id);
  // ★ 2025：**可重复**梦想升级（首个是「离线时长扩展」）——
  //   价格随等级涨（`dreamUpgradeCostAt` 唯一入口），满级后不可再买 ✓
  const cost = dreamUpgradeCostAt(id, lv);
  if (cost == null) return false;                 // 已满级 / 一次性已买
  if (state.dreamPoints.lt(cost)) return false;
  state.dreamPoints = state.dreamPoints.sub(cost);
  state.dreamUpgrades[id] = true;                 // 老字段保持"买过"语义（旧档零破坏）✓
  if (d.repeatable) {
    state.dreamUpgradeLevels ??= {};
    state.dreamUpgradeLevels[id] = lv + 1;        // 记等级（唯一数据源）✓
    pushLog(state, `💭 梦想点升级「${d.name}」升到 Lv${lv + 1}（消耗 ${cost} 梦想点）`);
  } else {
    pushLog(state, `💭 购买梦想点升级「${d.name}」（消耗 ${cost} 梦想点）`);
    // ⚠️⚠️ **成就奖励只给一次性升级** —— 我第一版对所有升级都调，
    //   于是可重复升级**每次购买都白拿 1 梦想点** ⇒ 第 1 级标价 2 实扣 **1** ✗
    //   （实测：Lv0 标价 2、实扣 1；Lv1~11 全对 —— 因为 `dreamAwarded` 只发一次，
    //     而第一次购买恰好就是"差值 1"的那一次）
    //   ⇒ 可重复升级的折扣会让"标价"与"实扣"永久不一致（本项目最忌讳的显示≠实发）✗
    //   ⇒ 只在**一次性**升级上发成就 ✓
    awardDream(state, `dreamUp:${id}`, `梦想点升级「${d.name}」`);
  }
  return true;
}


// ══════════════════════════════════════════════════════════
// ★ ∞ 层：无限升级（用无限点购买，不随大坍缩重置）
// ══════════════════════════════════════════════════════════

/**
 * 购买无限升级（统一入口）。
 *
 * ⚠️ 价格一律走 `infinityUpgradeCost()`（config 里的唯一数据源），
 *    界面显示的也是它 —— 这样"显示 vs 实际"不可能脱节。
 *
 * @returns {{ok: boolean, cost: Decimal, level: Decimal}} 供 UI/自检读取
 */
