/**
 * engine/purchases/infinity.js —— ∞ 层购买：无限升级 / 无限增幅 / 永恒增幅 / 效果文本 / 快照
 *
 * ★ 2026 模块化：由 512 行的 engine/purchases.js 拆出（声明与注释逐字保留）。
 *    对外统一从 `src/engine.js`（barrel）导入。
 */
import { DE_SPAN, ETERNITY_UPGRADES, INFINITY_UPGRADES, epMultAffResetCache, epMultAffordableIn, epMultAffordableTotal, epMultPriceAt, epMultTierAt, infinityRateMult, infinityStartLog10, infinityUpgradeCost, infinityUpgradeOwned, ipDoubleAffordableIn, ipDoubleCostFor, ipDoubleMult } from "../../config.js";
import { sci } from "../../format.js";
import { D, conversion, effectiveTraps, entropyRate, globalMultiplier, matterRate, particleRate, zpeMultiplier, zpeRate } from "../../formulas.js";
import { awardDream, pushLevelLog, pushLog } from "../../state.js";
import Decimal from "../../../dist/break_eternity.esm.js";

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

