/**
 * engine/actions.js —— 手动点击、可重复升级、熵阱、自动获取
 *
 * ★ 2026 模块化：由 1,660 行的 engine.js 按动作领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/engine.js`（barrel）导入。
 */
import { BASE, DE_UPGRADES, DREAM_UPGRADES, REPEATABLE, dreamUpgradeEffects, piecewiseDeCost } from "../config.js";
import { autoEnabled, dreamAutoBuyTick } from "../dream-effects.js";
import { D, clampToAffordable, floorDiv, geometricSum, isAutoAcquire, repeatableCost, trapCost } from "../formulas.js";
import { buyIpDoubleMax, buyZpeEngineLevel } from "./purchases.js";
import { addLevel, deLevelOf, levelOf, pushLevelLog, pushLog } from "../state.js";
import Decimal from "../../dist/break_eternity.esm.js";

export function doClick(state) {
  let gain = D(BASE.clickGain);
  // m1：+10
  if (state.zpeMilestones.m1) gain = gain.add(10);
  // v7：×5
  if (state.voidUpgrades.v7) gain = gain.mul(5);
  state.resources.entropy = state.resources.entropy.add(gain);
  state.stats.clicks += 1;
  return gain;
}

/**
 * 购买可重复升级。
 *
 * ⚠️ 买满**必须用闭式解**，不能循环。
 *
 * 这是踩过两次的坑：原稿用 `while (entropy >= threshold)` 逐次扣减，
 * 我批评过它；结果自己在这里写了 `for (i < affordableCount())` ——
 * 而 affordableCount 在量子倍率起来之后能到 **1e7**，
 * 于是每帧跑上千万次循环，整个模拟直接卡死。
 *
 * 几何级数的前 n 项和：`firstCost × (r^n - 1) / (r - 1)`
 *
 * @param {boolean} max true = 一次买满
 * @returns {number} 实际买到的级数
 */
export function buyRepeatable(state, id, max = false) {
  const cfg = REPEATABLE[id];
  if (!cfg) return 0;

  // ★ v9 + m2 之后进入「自动获取」模式：由 tick 里的 autoAcquire 统一处理。
  //   这里必须直接返回，否则手动点击会**绕过扣款白送等级**
  //   （autoAcquire 已经加过一遍，玩家再点一下就是双倍）。
  if (isAutoAcquire(state, "upgrade")) return 0;

  const n = max ? affordableCount(state, id) : 1;
  if (n <= 0) return 0;

  const r = cfg.costMult;
  const first = repeatableCost(state, id);
  const pool = state.resources[cfg.currency];

  // 闭式解求总价：等比数列前 n 项和。
  // ★ 反推出来的 n 可能因为 log/div 的舍入多 1 格，先下调到真买得起的档位 ——
  //   否则「买满」按钮会静默什么都不做（pool.lt(total) -> return 0）。
  const k = max ? clampToAffordable(first, r, pool, n) : 1;
  const total = geometricSum(first, r, k);
  if (pool.lt(total)) return 0;
  state.resources[cfg.currency] = pool.sub(total);

  const before = levelOf(state, id).toNumber();
  addLevel(state, id, k);
  // ★ 只在关键节点写日志（1/5/10/50/100…）：自动获取模式一帧买几百级，逐级写会刷爆
  pushLevelLog(state, cfg.name, before, before + k);
  if (cfg.firstRewardDream && !state.firstPurchase[id]) {
    state.firstPurchase[id] = true;
    state.dreamPoints = state.dreamPoints.add(1);
    pushLog(state, `💭 首次购买「${cfg.name}」，获得 1 梦想点`);
  }
  return k;
}

/**
 * 等比价格 + 给定资源池 ⇒ 买得起几个（闭式解，O(1)）。
 *
 * 抽出来是为了让「三条主升级」「∞ 层①」「ZPE 引擎等级」共用同一套算法 ——
 * 复制粘贴迟早会在某一份里忘记 `clampToAffordable` 的浮点兜底。
 */
export function affordableFromPool(firstCost, r, pool, cap = 1e7) {
  if (!(r > 1)) return 0;
  if (pool.lt(firstCost)) return 0;
  // n = floor( log_r( pool×(r-1)/firstCost + 1 ) )
  const ratio = pool.mul(r - 1).div(firstCost).add(1);
  const n = ratio.log(r).floor().toNumber();
  if (!Number.isFinite(n) || n <= 0) return 0;
  // ★ 显示/购买的数量也必须是「真的买得起」的数量（log 同样有舍入）
  return Math.min(clampToAffordable(firstCost, r, pool, Math.min(n, cap)), cap);
}

/** 还能买几个（闭式解，O(1)） */
export function affordableCount(state, id) {
  const cfg = REPEATABLE[id];
  if (!cfg) return 0;
  return affordableFromPool(repeatableCost(state, id), cfg.costMult, state.resources[cfg.currency]);
}

/**
 * 购买熵阱。买满同样用**闭式解**，理由见 buyRepeatable。
 *
 * 熵阱价格是 `0.1 × r^n`，也是等比数列：
 *   `first × (r^k - 1)/(r - 1) <= 物质`  =>  `k = floor(log_r(物质×(r-1)/first + 1))`
 */
export function buyTrap(state, max = false) {
  const auto = isAutoAcquire(state, "trap");
  const r = BASE.trapCostMult;
  const pool = state.resources.matter;

  const first = trapCost(state);
  if (pool.lt(first)) return 0;

  let k = 1;
  if (max) {
    if (r <= 1) {
      k = Math.min(1e7, floorDiv(pool, first).toNumber());
    } else {
      const ratio = pool.mul(r - 1).div(first).add(1);
      k = Math.floor(ratio.log(r).toNumber());
      if (!Number.isFinite(k) || k < 1) k = 1;
      // ★ 反推的 k 可能多一格（见 formulas.js 的 clampToAffordable）
      k = clampToAffordable(first, r, pool, Math.min(k, 1e7));
    }
    if (!Number.isFinite(k) || k < 1) k = 1;
    k = Math.min(k, 1e7);
  }

  if (!auto) {
    const total = geometricSum(first, r, k);
    if (pool.lt(total)) return 0;
    state.resources.matter = pool.sub(total);
  }
  state.resources.traps = state.resources.traps.add(k);
  return k;
}

/** 购买虚空升级 */
export function autoBuyDeUpgrade(state, id) {
  const cfg = DE_UPGRADES[id];
  if (!cfg) return 0;
  const lv = deLevelOf(state, id);
  // ★★★ 2026：**自动购买必须尊重 maxLevel**（原来没查 ⇒ 能买到 659 级 ✗）
  if (cfg.maxLevel != null && lv.gte(cfg.maxLevel)) return 0;
  const d = dreamUpgradeEffects(state);

  let r, base, pool, isParticle, isDarkEnergy = false;
  if (id === "phaseShift") {
    r = d.phaseShiftCostMult;
    base = D(cfg.baseCost ?? 100).mul(Decimal.pow(r, lv));
    pool = state.resources.particle;
    isParticle = true;
  } else if (id === "vacuumAccel") {
    r = 10;
    base = Decimal.pow(10, lv);
    pool = state.zpe;
    isParticle = false;
  } else if (id === "convOutput") {
    // 凝聚斜率：等比数列，价格 = baseCost × costMult^等级，烧暗能量
    r = cfg.costMult;
    base = D(cfg.baseCost).mul(Decimal.pow(r, lv));
    pool = state.darkEnergy;
    isParticle = false;
    isDarkEnergy = true;
  } else if (id === "deGainBase") {
    // 相变增幅：**分段价格**（×3 -> ×1.5 -> ×2），没有单一公比。
    // 用有界的逐级累加 —— 每一级只调一次 O(1) 的 piecewiseDeCost，
    // 而且上限 200 级封死，所以是常数代价（不像当年那个无界的 while）。
    pool = state.darkEnergy;
    let k2 = 0;
    let acc = D(0);
    // ★★★ 2026（用户：「前期启动自动化后一整个逻辑都有问题」）——
    //   原来一次买满（最多 200 级）⇒ **每帧复利** ⇒ 暗能量 10 分钟从 3e2 冲到 6e19 ✗
    //   ⇒ 自动化改成**每次只买 1 级**（与 AD 的 autobuyer 间隔语义一致）✓
    for (let i = 0; i < 1; i++) {
      const one = piecewiseDeCost(cfg.baseCost, lv.add(k2));
      if (pool.lt(acc.add(one))) break;
      acc = acc.add(one);
      k2++;
    }
    if (k2 < 1) return 0;
    state.darkEnergy = pool.sub(acc);
    state.deUpgradeLevels[id] = lv.add(k2);
    pushLevelLog(state, cfg.name, lv.toNumber(), lv.add(k2).toNumber());
    return k2;
  } else {
    return 0;   // 其他升级价格形态不同，不支持自动
  }

  if (r <= 1 || pool.lt(base)) return 0;

  let k = Math.floor(pool.mul(r - 1).div(base).add(1).log(r).toNumber());
  if (!Number.isFinite(k) || k < 1) return 0;
  k = Math.min(k, 1);   // ★ 2026：每次只买 1 级（防每帧复利 ✗）

  // 浮点误差兜底：算出来的总价可能略微超过资源（抽到 formulas.js 里了）
  k = clampToAffordable(base, r, pool, k);
  const total = geometricSum(base, r, k);
  if (pool.lt(total)) return 0;

  if (isDarkEnergy) state.darkEnergy = pool.sub(total);
  else if (isParticle) state.resources.particle = pool.sub(total);
  else state.zpe = pool.sub(total);

  state.deUpgradeLevels[id] = lv.add(k);
  pushLevelLog(state, cfg.name, lv.toNumber(), lv.add(k).toNumber());
  return k;
}

/**
 * v9 的「达到阈值自动获取」。
 *
 * m2（升级价格折扣）和 m5（熵阱价格折扣）在 v9 之后从「打折」升级成「免费」：
 * 资源达到折后阈值就直接加等级，不扣钱。
 *
 * ⚠️ 同样用**闭式解**，不要写 `for (guard < 50)` ——
 *    那个循环在后期每帧都会被跑满，而且一次只能买 50 级，
 *    买得起 1e7 级时要等几十万帧。（和 buyRepeatable / buyTrap 同一类坑。）
 */
export function autoAcquire(state) {
  if (isAutoAcquire(state, "upgrade")) {
    for (const id of Object.keys(REPEATABLE)) {
      const cfg = REPEATABLE[id];
      const n = affordableCount(state, id);
      if (n <= 0) continue;
      const before = levelOf(state, id).toNumber();
      addLevel(state, id, n);
      pushLevelLog(state, cfg.name, before, before + n);
      if (cfg.firstRewardDream && !state.firstPurchase[id]) {
        state.firstPurchase[id] = true;
        state.dreamPoints = state.dreamPoints.add(1);
      }
    }
  }
  if (isAutoAcquire(state, "trap")) {
    buyTrap(state, true);
  }
}

/**
 * 梦想点升级带来的自动化：自动购买暗能量升级。
 *
 * ⚠️ **必须独立于 v9 调用。**
 *    最初我把它塞进了 `autoAcquire()`，而那个函数只在 `voidUpgrades.v9`
 *    为真时才跑 —— 于是买了梦想点自动化却什么都不发生（实测等级一直是 0）。
 *    梦想点和虚空升级是两条独立的系统，不该互相门控。
 */
export function autoAcquireDream(state) {
  // ★★★ 2026 修 bug（用户报：「梦想（自动化）页面的自动化升级都不正常工作」）
  //
  // ── 原 bug（4 条「自动买暗能量升级」全死）──
  //   旧写法：`for (const id of dreamUpgradeEffects(state).autoBuyDe) if (autoEnabled(state, id)) …`
  //   而 `autoBuyDe` 装的是 **DE 升级的 id**（`phaseShift` / `vacuumAccel` / …），
  //   不是**梦想升级的 id**（`autoPhase` / `autoVacuum` / …）✗
  //   ⇒ `autoEnabled(state, "phaseShift")` 去查 `state.dreamUpgrades["phaseShift"]` ——
  //     那个 key **永远不存在** ⇒ 恒 false ⇒ 四条一次都不会自动买 ✗
  //     （开关写的是 `autoToggles.autoPhase`，引擎读的是 `autoToggles.phaseShift` ⇒ 也对不上）
  //
  // ── 现在 ──
  //   遍历**梦想升级定义**（`DREAM_UPGRADES`），用**梦想 id** 判"已买+已开关"，
  //   再用 `effect.deUpgrade` 去真正购买 ⇒ 两个 id 各归各位 ✓
  //   ⚠️ `dreamUpgradeEffects().autoBuyDe` **保留原样**（UI 用它显示"已开启哪几条 DE 升级"，
  //     那里要的就是 DE 名字）✓ 两处语义不同，不要合并。
  for (const d of DREAM_UPGRADES) {
    const e = d.effect;
    if (e?.kind === "autoBuy" && e.deUpgrade && autoEnabled(state, d.id)) {
      autoBuyDeUpgrade(state, e.deUpgrade);
    }
  }
  // ★★★ 2026：另两条「自动买满」（IP 点倍增 / ZPE 引擎）✓ 买手由本文件注入（避免循环 import）
  dreamAutoBuyTick(state, {
    buyIpDouble: (st) => buyIpDoubleMax(st),
    buyZpeEngine: (st) => (buyZpeEngineLevel(st, true) ? 1 : 0),
  });
}

// ══════════════════════════════════════════════════════════
// 第四层：临界坍缩
// ══════════════════════════════════════════════════════════

/**
 * 坍缩时的重置范围。
 *
 * **保留**（跨坍缩的永久进度）：
 *   · 虚空系统：虚空升级 / ZPE 里程碑
 *   · 暗物质工程：暗能量里程碑 / 暗能量升级
 *   · 梦想点（成就）/ 暗物质 / 量子 / 量子升级
 *
 * **重置**：物质 / 粒子 / 熵 / 熵阱 / 三条升级等级 / ZPE 余额 / 暗能量余额
 *
 * 量子升级「惯性」可以把 ZPE 与暗能量的余额也保留下来。
 */
/**
 * 重置下层资源。**只有大坍缩会调用它**（临界坍缩已经不重置任何东西了）。
 *
 * （原来有个 `qe.keepZpeDe` 参数来自旧量子升级「惯性」——整套系统已删除，
 *   所以 ZPE/暗能量现在**总是**被清空。）
 */
