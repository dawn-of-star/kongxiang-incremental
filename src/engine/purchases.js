/**
 * engine/purchases.js —— 其余购买动作（虚空 / 暗能量 / 梦想 / ∞ / ZPE 引擎 / 暗物质）
 *
 * ★ 2026 模块化：由 1,660 行的 engine.js 按动作领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/engine.js`（barrel）导入。
 */
import { DE_SPAN, DE_UPGRADES, DREAM_BY_ID, ETERNITY_UPGRADES, INFINITY_UPGRADES, VOID_UPGRADES, ZPE_ENGINE, darkMatterAffordableIn, darkMatterCostFor, darkMatterCount, darkMatterEffectMult, darkMatterPriceAt, darkMatterUnlocked, dreamUpgradeCostAt, dreamUpgradeLevelOf, epMultAffResetCache, epMultAffordableIn, epMultAffordableTotal, epMultPriceAt, epMultTierAt, infinityRateMult, infinityStartLog10, infinityUpgradeCost, infinityUpgradeOwned, ipDoubleAffordableIn, ipDoubleCostFor, ipDoubleMult, markPageUnlocked, zpeEngineAffordableIn, zpeEngineCost, zpeEngineLevel, zpeEngineTotalCost, zpeEngineUnlocked } from "../config.js";
import { sci } from "../format.js";
import { D, conversion, deUpgradeCost, effectiveTraps, entropyRate, globalMultiplier, matterRate, particleRate, voidUpgradeCost, zpeMultiplier, zpeRate } from "../formulas.js";
import { awardDream, deLevelOf, pushLevelLog, pushLog } from "../state.js";
import Decimal from "../../dist/break_eternity.esm.js";

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
export function buyInfinityUpgrade(state, id) {
  const cfg = INFINITY_UPGRADES[id];
  if (!cfg) return { ok: false, cost: D(0), level: state.ipDoubleLevel ?? D(0) };
  // ★ 门槛：跨度层开关（「门槛压平」）只在**打破无限之后**可买。
  //   这是"何时可以买"的硬门槛，与价格（"多久买得起"）**解耦** ——
  //   所以价格以后在 10 / 50 / 128 之间怎么调，都不会让它在打破无限前被买到。
  if (id === "thresholdFlat" && !state.brokenInfinity) {
    return { ok: false, cost: D(0), level: state.ipDoubleLevel ?? D(0) };
  }
  if (!cfg.repeatable && infinityUpgradeOwned(state, id)) {
    return { ok: false, cost: D(0), level: state.ipDoubleLevel ?? D(0) };
  }
  const cost = infinityUpgradeCost(state, id);
  if (state.infinityPoints.lt(cost)) {
    return { ok: false, cost, level: state.ipDoubleLevel ?? D(0) };
  }
  state.infinityPoints = state.infinityPoints.sub(cost);

  if (id === "ipDouble") {
    const before = (state.ipDoubleLevel ?? D(0)).toNumber();
    state.ipDoubleLevel = (state.ipDoubleLevel ?? D(0)).add(1);
    // ★ 只在关键节点写日志（① 在贪心自动买法里一帧能连买好几级）
    pushLevelLog(state, cfg.name, before, before + 1);
  } else if (id === "thresholdFlat") {
    state.thresholdFlatBought = true;
    // ★ 2025：**基准不再在这里记** —— 它改由"解锁 ZPE 引擎"时记录（见 unlockZpeEngine）。
    //   原因：引擎把 `a(DE)` 打开 ⇒ DE 从引擎到手就开始指数增长；
    //   若等到买这个开关时才记基准，而那时 DE 早已撞上 1e50 ⇒ 跨度乘数 ≈ 1 ⇒ 白买 ✗
    if ((state.spanDeBase ?? D(0)).lte(0)) {
      // 兜底：若玩家在引擎解锁前就买到它（不该发生），仍记一次，避免乘数恒 1
      state.spanDeBase = (state.darkEnergy ?? D(0)).max(1);
    }
    pushLog(state, `∞ 购买「${cfg.name}」：量子门槛步长 ×20 → ×10（量子数翻倍）`);
    pushLog(state, `★ 跨度层已开启：基准 = ${sci(state.spanDeBase)}` +
      `（引擎到手时记录），物质产出按 (DE / 基准)^k 放大（k 由量子个数给，封顶 ${DE_SPAN.kMax}）`);
  } else if (id === "pairBoost") {
    state.pairBoostBought = true;
    pushLog(state, `∞ 购买「${cfg.name}」：每次捕获 2 → 3 个量子`);
  } else if (id === "ipFromQuantum") {
    state.infinityFromQuantumBought = true;
    pushLog(state, `∞ 购买「${cfg.name}」：每次大坍缩额外按本次最大量子数给点（q^${cfg.power}）`);
  } else if (id === "ipToZpe") {
    state.ipToZpeBought = true;
    pushLog(state, `∞ 购买「${cfg.name}」：ZPE 倍率开始吃无限点数量`);
  } else if (id === "ipToTransmuter") {
    state.ipToTransmuterBought = true;
    pushLog(state, `∞ 购买「${cfg.name}」：相变仪开始吃无限点数量`);
  } else if (id === "ipTime") {
    state.ipTimeBought = true;
    pushLog(state, `∞ 购买「${cfg.name}」：每次无限额外按耗时给点（每 ${cfg.secondsPerPoint} 秒 1 点）`);
  } else if (cfg.startLog10 != null) {
    // 起点跃迁：每档都是"开局物质 = 该档深度"，取最高的一档生效
    state.startBought = { ...(state.startBought ?? {}), [id]: true };
    pushLog(state, `∞ 购买「${cfg.name}」：每次大坍缩后以 ${sci(Decimal.pow(10, cfg.startLog10))} 物质开局`);
  } else if (cfg.rateMult != null) {
    state.speedBought = { ...(state.speedBought ?? {}), [id]: true };
    pushLog(state, `∞ 购买「${cfg.name}」：量子成长速率上限 ×${cfg.rateMult}（当前 ×${infinityRateMult(state).toFixed(3)}）`);
  }
  // ★ 无限升级也属于「不涉及梦想点系统」的加成 ⇒ **首次**购买任意一条给 1 梦想点。
  //   和虚空/暗能量升级同源：用 awardDream 去重（它自己记 dreamAwarded，重复买不会再发）。
  //   对可重复的 ① 来说就是"第一次买它的那一级"。
  awardDream(state, `inf:${id}`, `首次购买无限升级「${cfg.name}」`);
  return { ok: true, cost, level: state.ipDoubleLevel ?? D(0) };
}

/**
 * ★ 2025：**① 无限增幅「买满」**（用户要求它像升级中心里的可重复升级那样带买满按钮）。
 *
 * 与主升级的 `buyRepeatable(max=true)` 同套路：
 *   ① 用闭式探针 `ipDoubleAffordableIn()` 问"能买几级"（分段等比，O(段数)）
 *   ② 用 `ipDoubleCostFor()` 算这 k 级的**总价**（与探针同源 ✓）
 *   ③ 一次扣款、一次写日志（只在关键等级节点，避免一帧刷几百条）
 *
 * ⚠️ 不复用 `buyInfinityUpgrade` 的循环：那样会每级写一条日志 + 扣一次款 ✗
 *    （① 在后期一买就是几百级，逐级调用会把日志面板刷爆 —— 项目里踩过同类坑。）
 */
export function buyIpDoubleMax(state) {
  const before = (state.ipDoubleLevel ?? D(0)).toNumber();
  const k = ipDoubleAffordableIn(before, state.infinityPoints);
  if (!(k > 0)) return 0;
  const total = ipDoubleCostFor(state, k);
  if (state.infinityPoints.lt(total)) return 0;      // 兜底：探针与总价必须同源
  state.infinityPoints = state.infinityPoints.sub(total);
  state.ipDoubleLevel = D(before).add(k);
  pushLevelLog(state, INFINITY_UPGRADES.ipDouble.name, before, before + k);
  return k;
}

// ══════════════════════════════════════════════════════════
// ★★★ 2025 新实现（第三层设计稿 33~35 行）：**永恒升级「永恒增幅」**
// ══════════════════════════════════════════════════════════
// 设计稿：「永恒升级面板：将最终获得的永恒点 *5（价格初始 1ep，每次购买后 *5）」
//
// ⚠️ 与 `ipDouble` 一样：价格与效果**各只有一处实现**（config.js 的
//   `epMultPriceAt` / `epMultFactor`）⇒ 显示与实发不可能脱节 ✓
// ⚠️ 它**不随永恒重置**（永恒升级的性质）⇒ `doEternity` 里不清 `epMultLevel` ✓

/**
 * 买 `k` 级「永恒增幅」（`k` 省略 = 买满）。
 * @returns {number} 实际买到的级数（0 = 一级都买不起）
 */
export function buyEpMult(state, k = null) {
  const before = Math.max(0, Number(state.epMultLevel ?? 0) || 0);
  const cfg = ETERNITY_UPGRADES.epMult;
  if (!cfg) return 0;
  /**
   * ★★★ 2025 性能：**总价与探针共用"增量乘法"累加器**。
   *
   * 为什么必须共用：原来总价走 `epMultCostFor`（**每级一次 `Decimal.pow`**），
   *   而探针走增量乘法 ⇒ 大池子（1e10000 ⇒ 5000 级）时买满会在总价那侧
   *   做 5000 次 `pow` ⇒ 又慢回来 ✗
   * ⇒ 现在把同一个"逐级累加器"注入给探针 ✓（唯一实现、不可能脱节）
   *
   * ⚠️⚠️ **每次需要都必须 `newAccumulator()` 建一个新的** —— 我第一版把累加器
   *   写成"一个共享的有状态闭包"，结果：
   *     探针先遍历到第 5000 级 ⇒ 缓存 `curLv=5000`；
   *     随后买满循环从第 0 级开始取价 ⇒ 缓存**看起来在倒退** ⇒ 增量乘法路径失效、
   *     且价格被算成**极高** ⇒ 循环第一次就 `break` ⇒ 买满只买到 5000 级，
   *     而逐级买能得到 **14307 级** ✗（实测差 3 倍，且充值/扣款对不上）
   *   ⇒ 改成**工厂**：状态只在一次遍历内有效 ✓
   */
  const newAccumulator = () => {
    const M = cfg.costMultTiers;
    // ★ 段边界用 **config.js 的共用函数**（`epMultTierAt`）——
    //   这里原来复制了一份"预计算 crossLv"的逻辑，那正是本项目反复出 bug 的病根
    //   （同一语义两处实现 ⇒ 改一处忘一处 ⇒ 显示≠实发）✗ ⇒ 现在只有一处 ✓
    let curLv = -1, curSeg = 0, curPrice = null;
    return (lv) => {
      if (lv === curLv) return curPrice;
      const seg = epMultTierAt(lv);
      if (curPrice && lv === curLv + 1 && seg === curSeg) {
        curPrice = curPrice.mul(M[curSeg]);              // ★ 增量乘法（热路径）
      } else {
        curPrice = epMultPriceAt(lv);
        curSeg = seg;
      }
      curLv = lv;
      return curPrice;
    };
  };

  if (!state.eternityPoints.gte(epMultPriceAt(before))) return 0;
  let want;
  let total = new Decimal(0);
  if (k == null) {
    // ★★★ 2025 性能：**买满直接复用探针的结果（含总价）** ✓
    //   探针现在**一次遍历同时给出 `k` 和 `total`**（见 `epMultAffordableIn`），
    //   而 UI 每帧已经先调过探针了 ⇒ 这里通常**命中缓存、零成本** ✓
    //   原来这里自己再遍历一遍算总价 ⇒ 每帧把那 5000 级算**两遍**（≈12ms/帧 ✗）
    want = epMultAffordableIn(before, state.eternityPoints);
    // 探针刚被调用 ⇒ 缓存**必然**已按"当前等级 + 当前池子"刷新 ✓
    //   （若缓存里没有总价（理论上不会），`?? null` 会走下面的自算兜底）
    const cached = epMultAffordableTotal();
    if (cached) {
      total = cached;
    } else {
      // 兜底：缓存未命中 ⇒ 自己遍历一次
      const acc = newAccumulator();
      for (let i = 0; i < want; i++) total = total.add(acc(before + i));
    }
  } else {
    want = Math.max(0, Number(k) || 0);
    if (!(want > 0)) return 0;
    // 总价 = **逐级真价之和**（同一套累加器）✓
    //   ⚠️ 2025 修正（用户报「永恒增幅价格消耗不对」）：
    //      原来用几何闭式 `first·(g^want − 1)/(g − 1)` ⇒ 形状对，但**浮点/Decimal 幂的
    //      乘积与相除会漂移** ⇒ 实测扣款出现 `488281.0000000004` ✗
    //   ⚠️ 而且"总价 ≥ 池子就整体拒绝"在**买满**那条路上会造成**不扣钱**：
    //      探针与这里必须**同一套算法**才不会互相打架 ✓
    const acc = newAccumulator();
    for (let i = 0; i < want; i++) total = total.add(acc(before + i));
  }
  if (!(want > 0)) return 0;
  if (state.eternityPoints.lt(total)) return 0;        // 兜底：探针与总价必须一致
  state.eternityPoints = state.eternityPoints.sub(total);
  state.epMultLevel = before + want;
  // ★★★ 2025 性能：**买完必须失效 `epMultAffordableIn` 的缓存** ✓
  //   那个缓存是为了"每帧 2 次调用但池子没变"而加的；买了之后**等级和池子都变了**
  //   ⇒ 不清就会让 UI 一直显示买之前的可买级数 ✗
  //   （虽然缓存键里有"等级"和"池子"，理论上会自动失配 —— 但**显式清**更安全：
  //     若某次购买后等级与池子**恰好**与上次相同（如 `want` 算出 0 的边界情形），
  //     隐式键就可能命中过期值 ✗）
  epMultAffResetCache();
  pushLevelLog(state, cfg.name, before, before + want);
  return want;
}

// ══════════════════════════════════════════════════════════
// ★★★ 2026：「永恒之后」第一块：**暗物质 / 第二台相变仪**
// ══════════════════════════════════════════════════════════
// 设计稿原文（第 50~52 行）：
//   「在暗能量下提供第二个子页面：暗物质
//     消耗ep获取暗物质，暗物质依赖个数通过第二个相变仪提升第一个相变仪的获取效率
//     （剩下的还在想）」
// ⚠️ 用户 2026 **重写**了这条规则（设计稿那句只是雏形）：
//   ① 暗物质由 **EP 获取** ② 第二台速度 = 第一台的 `^0.01` × 暗物质数量提升
//   ③ 第二台的转化产出 = **对暗能量的倍率**（落点是 `darkEnergyMultiplier` 的**加法区**）
//
// 本函数 = 「消耗 EP 获取暗物质」这一条；
//   另一半（第二台 → 暗能量倍率）落在 `config.js` 的 `darkMatterAdditiveTerm()`，
//   由 `formulas.js` 的 `darkEnergyMultiplier()` 加进**加法区**（与 q² 同池）✓
//
// ⚠️ 与 `buyEpMult` 同一套纪律（照它写，别自创）：
//   · 价格**只有一处实现**（`darkMatterPriceAt` / `darkMatterAffordableIn` / `darkMatterCostFor`）
//     ⇒ 显示与实发不可能脱节 ✓
//   · 总价 = **逐级真价之和**，**不用几何闭式** —— 本项目已为此踩过两次
//     （`epMult` 的 `488281.0000000004`；"改首价"时 `ipDouble` 少算 1 级）✗
//   · 买满与逐级走**同一套**探针 ⇒ "买满 == 逐级实买"是**构造性**成立的 ✓
//   · ⚠️ **它不随永恒重置**（用户 2026 裁定，见 state.js 的字段说明）⇒
//      `doEternity` 里**不要**清 `state.eternityDarkMatter` ✓

/**
 * 买 `k` 个暗物质（`k` 省略 = 买满）。
 * @returns {number} 实际买到的个数（0 = 未解锁 / 一个都买不起）
 */
export function buyDarkMatter(state, k = null) {
  if (!darkMatterUnlocked(state)) return 0;            // 未达成 em4 ⇒ 未解锁（唯一判据）
  if (!state?.eternityPoints?.gte) return 0;           // 防御：EP 字段缺失/坏档
  const before = darkMatterCount(state);
  if (!state.eternityPoints.gte(darkMatterPriceAt(before))) return 0;  // 连第一个都买不起
  const want = k == null
    ? darkMatterAffordableIn(before, state.eternityPoints)
    : Math.max(0, Math.floor(Number(k) || 0));
  if (!(want > 0)) return 0;
  const total = darkMatterCostFor(before, want);       // 逐级真价之和（与探针同源）✓
  if (state.eternityPoints.lt(total)) return 0;        // 兜底：探针与总价必须一致
  state.eternityPoints = state.eternityPoints.sub(total);
  state.eternityDarkMatter = before + want;
  // 日志走**统一入口** `pushLevelLog` ⇒ 只在跨过关键节点（1/5/10/50/…）时写一条 ✓
  //   （本项目日志策略：重复购买类升级不许逐级刷屏 —— 见 state.js 的 KEY_LEVELS ✓）
  pushLevelLog(state, "暗物质", before, before + want);
  // ★★ 但**效果变化**必须让玩家看见（用户原则：「没有 ui 真的很容易误判」）：
  //   转化值是暗物质与第二台速度的**乘积**（`min(1,v2/v2Ref)` 那一半可能还没满），
  //   所以"买了但没涨"是可能发生的 ⇒ 把当前转化值一并写进日志 ✓
  const eff = darkMatterEffectMult(state);
  if (Number.isFinite(eff) && eff > 1) {
    pushLog(state, `⬆ 暗物质转化值 → ×${eff.toFixed(4)}（第二台：${(darkMatterEffectMult(state) - 1).toFixed(4)} 加进暗能量倍率的加法区）`);
  }
  return want;
}

// ══════════════════════════════════════════════════════════
// ★ 永恒（手动触发；门槛 = 无限点 1e308.25 —— 见 `ETERNITY.goalLog10`）
// ══════════════════════════════════════════════════════════

/**
 * ★★ 2025 em1（永恒里程碑 1）：「每次永恒后保留非重复购买的无限升级（每 2 次永恒保留 1 个）」
 *
 * 保留几个 = `floor(永恒次数 / 2)`（用**本次永恒之后**的次数，见调用点）。
 * 保留哪些 = 取 `INFINITY_ORDER` 里**非重复购买**条目的**末尾 N 个** ——
 *   该数组大体按"从便宜到贵"排列 ⇒ 末尾就是**最贵**的 ⇒ 保留价值最高（越贵越难重新买回）✓
 *
 * ⚠️ 必须**幂等**：它只把对应标记设 `true`，不清任何东西（`doEternity` 会先全清再调它）。
 * @returns {string[]} 本次保留的升级 id（供日志/自检）
 */
export function unlockZpeEngine(state) {
  if (zpeEngineUnlocked(state)) return false;
  // ★ 2026：条件放宽 —— **有 1 次无限**（含 em7 送的）或大坍缩过 1 次 都算达标 ✓
  const hasInfinity = (state.infinityCount ?? 0) >= 1 || (state.bigCrunchCount ?? D(0)).gte(1);
  if (!hasInfinity) return false;
  state.zpeEngineUnlocked = true;
  markPageUnlocked(state, "zpe");        // ★ 永久解锁记录（永恒后不再上锁）
  // 送 1 级（里程碑奖励）
  state.zpeEngineLevel = (state.zpeEngineLevel ?? D(0)).max(1);
  // 跨度基准：记下此刻的暗能量水位（只记一次）
  if ((state.spanDeBase ?? D(0)).lte(0)) {
    state.spanDeBase = (state.darkEnergy ?? D(0)).max(1);
  }
  awardDream(state, "zpeEngine", "解锁 ZPE 引擎");
  pushLog(state, "⚙ 第一次大坍缩的里程碑奖励：解锁「ZPE 引擎」并赠送 1 级");
  pushLog(state, `⚙ 暗能量自增长已开启（基准 = ${sci(state.spanDeBase)}）；` +
    "之后可以拿无限点买等级，等级同时给四条加成（加法区 / 产出与倍率 / 计数频率与量子 / 暗能量倍率）");
  return true;
}

/** ZPE 引擎还能买几级（分段几何的闭式解，见 config.zpeEngineAffordableIn） */
export function zpeEngineAffordable(state) {
  if (!zpeEngineUnlocked(state)) return 0;
  return zpeEngineAffordableIn(state, state.infinityPoints);
}

/**
 * 买 ZPE 引擎等级（`max=true` 买满）。
 *
 * 三条机制都由等级驱动（见 config 的 ZPE_ENGINE）：
 *   · ② 产出倍率 `(1+0.1×等级)²` —— 解锁即有
 *   · ③ 倍率吃「计数频率」     —— 等级 ≥ 5
 *   · ① 抬高倍率公式的指数     —— 等级 ≥ 10
 * 所以跨过 5 / 10 级时要给一条**明确的**日志（规则变了，玩家必须知道）。
 *
 * ⚠️ 价格是**分段几何**（软上限）：10 级后每级涨价 ×20，100 级后再 ^1.3，1000 级后再 ^1.8。
 *    所以这里不能再用"单一公比"的 geometricSum —— 直接用段内闭式算出 k 与总价。
 */
export function buyZpeEngineLevel(state, max = false) {
  if (!zpeEngineUnlocked(state)) return 0;
  const lv0 = zpeEngineLevel(state);
  const before = lv0.toNumber();
  const k = max ? zpeEngineAffordable(state) : (state.infinityPoints.gte(zpeEngineCost(state)) ? 1 : 0);
  if (k < 1) return 0;

  // 总价 = 从当前级买到 before+k 级的分段累加（log 空间求差即可）
  const total = zpeEngineTotalCost(before, before + k);
  if (state.infinityPoints.lt(total)) return 0;
  state.infinityPoints = state.infinityPoints.sub(total);

  state.zpeEngineLevel = lv0.add(k);

  // 等级本身也守"只在关键节点写日志"的规矩
  pushLevelLog(state, "ZPE 引擎", before, before + k);
  // ★ 跨过 ③ 的解锁线时，单独说清楚
  //   ⚠️ 2025：另一条 ①「抬公式指数」**已废弃**（改成加法区加成 ✓），
  //      所以这里不再播报 10 级的旧机制 ✗
  if (before < ZPE_ENGINE.countFreqLevel && before + k >= ZPE_ENGINE.countFreqLevel) {
    pushLog(state, `⚙ ZPE 引擎 ${ZPE_ENGINE.countFreqLevel} 级：ZPE 倍率开始吃「计数频率」加成`);
  }
  return k;
}

/** 无限升级当前的「效果」文本数值（UI 与自检共用，保证从公式推导） */
export function infinityUpgradeEffect(state, id) {
  const ip = state.infinityPoints ?? D(0);
  const cfg = INFINITY_UPGRADES[id];
  if (id === "ipDouble") {
    // ★★ 2025：**必须走唯一入口** `ipDoubleMult()`，不许在这里手写 `pow(effectMult, 等级)` ✗
    //   踩过：这里曾手写 `Decimal.pow(cfg.effectMult, level)`，而实发侧 `ipDoubleMult()`
    //   当时是**线性** `1+0.10×等级` ⇒ 100 级时**显示比实发大 1.2e29 倍** ✗
    //   （项目明令禁止的"显示 ≠ 实发"；而且是**两处各写一遍**的经典成因。）
    //   现在实发与显示共用这一条公式 ⇒ 换成什么形态都自动同步 ✓
    return { mult: ipDoubleMult(state) };
  }
  if (id === "ipToZpe") {
    return { bonus: D(INFINITY_UPGRADES.ipToZpe.perIp).mul(state.ipToZpeBought ? ip : 0) };
  }
  if (id === "ipToTransmuter") {
    return { mult: D(1).add(D(INFINITY_UPGRADES.ipToTransmuter.perIp).mul(state.ipToTransmuterBought ? ip : 0)) };
  }
  if (id === "ipTime") {
    // ④ 是**实时**产点的：给出 每秒速率 / 本次已实时累计 / 单次上限那一笔 / 是否已封顶
    const cap = INFINITY_UPGRADES.ipTime.capSeconds;
    const mult = ipDoubleMult(state);
    const perSecond = mult.div(INFINITY_UPGRADES.ipTime.secondsPerPoint);
    const elapsed = state.infinityElapsed ?? 0;
    return {
      perSecond,
      perHour: perSecond.mul(3600),
      accrued: state.ipTimeBought ? D(state.ipTimeAccrued ?? 0) : D(0),
      /** 单次无限最多能拿到的那笔（= 上限 ÷ 60 × 3^①） */
      capGain: cap == null ? null : perSecond.mul(cap),
      /** 已经过了上限 → 本轮不再进账，界面提示"该收了" */
      capped: cap != null && elapsed >= cap };
  }
  if (cfg?.startLog10 != null) {
    return { startLog10: cfg.startLog10, activeLog10: infinityStartLog10(state) };
  }
  if (cfg?.rateMult != null) {
    return { totalMult: infinityRateMult(state) };
  }
  return {};
}

// ══════════════════════════════════════════════════════════
// 派生显示值（UI 用，也可用于无头测试）
// ══════════════════════════════════════════════════════════

export function snapshot(state) {
  const { threshold, output } = conversion(state);
  return {
    entropy: state.resources.entropy,
    particle: state.resources.particle,
    matter: state.resources.matter,
    traps: state.resources.traps,
    dreamPoints: state.dreamPoints,
    zpe: state.zpe,
    darkEnergy: state.darkEnergy,
    globalMultiplier: globalMultiplier(state),
    zpeMultiplier: zpeMultiplier(state),
    entropyRate: entropyRate(state),
    particleRate: particleRate(state),
    matterRate: matterRate(state),
    zpeRate: zpeRate(state),
    effectiveTraps: effectiveTraps(state),
    conversion: { threshold, output } };
}
