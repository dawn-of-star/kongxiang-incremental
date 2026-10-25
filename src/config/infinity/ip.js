/**
 * config/infinity/ip.js —— 无限点经济：IP 公式 / 除数 / 无限增幅 / 无限长河 / 量子铸币
 *
 * ★ 2026 模块化：由 1,009 行的 config/infinity.js 拆出（声明与注释逐字保留）。
 *    对外统一从 `src/config.js`（barrel）导入。
 */
import { BREAK_INFINITY } from "./break.js";
import { powExactInt } from "../dark-matter.js";
import { INFINITY_UPGRADES } from "./upgrades.js";
import Decimal from "../../../dist/break_eternity.esm.js";
import { rewardIpDoubleKneeMult } from "../../tangram/reward.js";   // ★ 2026：d5/d6 清满 ⇒ knee 倍率 ✓

export function infinityPointGain(matter, broken, state = null) {
  const m = matter instanceof Decimal ? matter : new Decimal(matter ?? 0);
  if (!broken) return new Decimal(BREAK_INFINITY.firstCrunchIP);
  const maxLog = Math.log10(Number.MAX_VALUE);
  const depth = m.gt(0) ? m.log10().div(maxLog) : new Decimal(0);
  if (depth.lte(0)) return new Decimal(BREAK_INFINITY.firstCrunchIP);
  /**
   * ★ 深度复利（2025 用户方案，见 docs/PROGRESSION.md 与 tools/infinity-ladder-lab.mjs）：
   *
   * `IP = floor( (L/308.2547)² · 10^(c·(L − 过载拐点)) )`
   *
   * · 前半是**现状**（G3 的"故意设计"内核保留：IP **只来自深度**）✓
   * · 后半是新增的**深度复利**：过载解除硬顶后，越推越深 ⇒ 每阶 ×10^c ✓
   * · `c ≈ 0.035` 由模型反解（让 128 IP 落在 **3 次**深坍缩内）——
   *   而"3 次"不是拍脑袋：`b` 的硬封顶 0.02 使 N≥4 在数学上做不到 ✓
   *
   * 为什么必须加它：IP/次 恒为 1 时，128 IP 要 **128 次**大坍缩，
   * 与"×1.75 标尺 + 慢速大坍缩"**根本冲突**（`infinity-ladder-lab` 有断言）。
   */
  const excess = m.log10().sub(BREAK_INFINITY.maxLog10).max(0).toNumber();
  // ★★ 2025（用户方案 c，甲档）：**深度软上限** —— 治"一次坍缩直接通关" ✗
  //
  //   病：破∞后上限解除 ⇒ excess 可以无限涨（实测能到 8800 阶 ✗）
  //       ⇒ 单轮 IP = 10^(0.0035×8800) = 1e308 ⇒ **一次坍缩越过永恒门槛** ✗（实测 16 秒 ✗）
  //   药：超出 knee 的部分按**同族形状**压紧（与「过载」同一个 `2^(−超出/跨度)` ✓）
  //       excess_eff = knee + (excess−knee)·2^(−(excess−knee)/span)   上界 = knee + span/ln2 ✓
  //   效果：单轮 IP **被封顶** ⇒ 次数 = 门槛/单轮收益 ⇒ 次数与时长都可控 ✓
  //       `knee=10 / span=20` ⇒ 上界 ≈ 38.9 阶 ⇒ 单轮 ≈ 1e0.14 ⇒ 约 **2267 次 × 11 秒 ≈ 6.9 h** ✓
  //       （拉表见 `tools/post-break-runaway-lab.mjs` 的同族表 + 本轮对话的 (c) 表 ✓）
  //   ⚠️ 浅挖（excess ≤ knee）**完全不受影响** ✓ ⇒ 破∞前的经济与手感一字未动 ✓
  // ★ 2025：**深度复利已删除**（D6 废弃 ✗）—— IP 回到基线 `floor((L/308.2547)²)`，
  // ★ 2025 用户要求：与 **AD 源码**保持基本一致（game.js:86 `gainedInfinityPoints`）
  //    AD:  IP = floor( 10^( log10(maxAM) / div − 0.75 ) × 乘数们 )   div 默认 308、可被来源压低
  //    我们: 同一形状 ✓ 除数走 `ipDivisor(state)` ✓（保留未来升级"调用与影响"的权力 ✓）
  const div = (state && typeof ipDivisor === "function") ? ipDivisor(state) : BREAK_INFINITY.maxLog10;
  const L = m.log10();
  return Decimal.pow(10, L.div(div).sub(0.75)).mul(BREAK_INFINITY.ipBase ?? 1).floor().max(1);
}

/** 大坍缩阈值（Decimal）—— 用 pow 构造，保住小数指数 */
export const IP_DIVISOR_SOURCES = [
  // { id: "em1", when: (s) => hasEternityMilestone(s, "em1"), value: 250, pending: true },
  // { id: "upg-x", when: (s) => hasUpgrade(s, "x"), value: 210, pending: true },
];

/** ★ 无限点公式的除数（唯一入口 ✓ 未来所有相关升级都改这里 ✓） */
export function ipDivisor(state) {
  let best = BREAK_INFINITY.maxLog10;                     // 基准 = log10(Number.MAX_VALUE) = 308.2547 ✓
  for (const src of IP_DIVISOR_SOURCES) {
    if (src.pending) continue;
    let ok = false;
    try { ok = !!src.when(state); } catch { ok = false; }
    if (ok) best = Math.min(best, src.value);
  }
  return best;
}

/** 供工具/界面直接问"这个来源现在生效吗" ✓ */
export function ipDivisorBreakdown(state) {
  const rows = [{ id: "base", value: BREAK_INFINITY.maxLog10, active: true }];
  for (const src of IP_DIVISOR_SOURCES) {
    let ok = false;
    if (!src.pending) { try { ok = !!src.when(state); } catch { ok = false; } }
    rows.push({ id: src.id, value: src.value, active: ok, pending: !!src.pending });
  }
  return { divisor: ipDivisor(state), rows };
}

// ══════════════════════════════════════════════════════════
// ⚠️ 2026 **已删除**：`IC_MODS` 与 `icMod()` ——
//   它们是「IC 挑战中把引擎**生效等级**压低到 1」的修饰器（用户 2025 选的 β 方案，
//   落在"第 5 关 = 无引擎修行关"）。
//   **IC 整个系统被用户删除** ⇒ 再也没有"挑战态" ⇒ 修饰器永远是 null ⇒ 纯死代码 ✗
//
//   ⇒ `effectiveEngineLevel()` **保留**（它是"看引擎效果"的唯一入口，多处依赖），
//     但内部不再查修饰器，直接返回真实等级 ✓
//   ⚠️ 不要因为"现在它等于 zpeEngineLevel"就把 `effectiveEngineLevel` 删掉 ——
//     它的价值是**收口**：以后若有类似修饰器，只改这一处 ✓
// ══════════════════════════════════════════════════════════

/** ★ 引擎的**生效等级**（唯一入口 ✓）—— 2026 起没有修饰器，恒等于真实等级 ✓ */
export const IP_DOUBLE_AD = {
  base: new Decimal(10),                    // AD: `costIncrease = 10`（浅指数段）
  stepShallow: new Decimal(10),             // AD: 步长 ×10  ← **用户裁定：每级 ×10**
  stepSteep: new Decimal(1e10),             // AD: 门槛后步长 ×1e10
  // ★★★ 2025 修正（用户报告：「6 级准备买 7 级要 1e16」）——
  //   **原来的 1e6 门槛太低，让"陡段"从第 5 级就开始** ✗
  //   实测（`ipDoubleCost`，门槛=1e6 ⇒ purchasesAtIncrease=5）：
  //     L0~5 ⇒ 1e1 / 1e2 / 1e3 / 1e4 / 1e5 / 1e6   ← 浅段（每级 ×10 ✓）
  //     L6   ⇒ **1e16**（不是 1e7！）← 已进陡段：`10^6 × 1e10^1`
  //     L7   ⇒ 1e26｜L8 ⇒ 1e36                 ← 每级 ×1e10
  //   ⇒ 用户看到的 1e16 是**照 AD 公式的正确输出**，错的是**门槛值**（AD 用 1e3e6，
  //     我上一轮擅自改成 1e6，导致浅段只有 5 级）✗
  //   改动：门槛 1e6 → **1e31**（⇒ 浅段到第 30 级，每级 ×10，与用户预期一致）
  //     L6 ⇒ 1e7 ✓｜L20 ⇒ 1e21 ✓｜L29 ⇒ 1e30 ✓｜L30 起进陡段
  costIncreaseThreshold: new Decimal("1e31"),
  // ★★★ 2025 **`costCap` 已彻底删除**（用户裁定：「costCap 函数要不你彻底删了吧」）✓
  //
  // ── 为什么删（三步走，前两步都错）──
  //   ① 原来：`costCap = 1e320`，探针在"价格 ≥ cap"时**整段跳过** ⇒ 可买级数被钉在 **Lv59** ✗
  //   ② 我改成"平台"（价格 `min(10^log, cap)`）⇒ 仍然被钉住，只是换了形式：
  //      封顶后每级恒收 1e320 ⇒ **池 < 1e320 就一级都买不了** ✗
  //      实测：池 1e320 ⇒ 买满 59 级（看起来还是"卡 59"）｜1e325 ⇒ 330 级｜1e400 ⇒ 405 级
  //   ③ **它其实没在防任何东西**：`10^n` 在 `n ≥ 309` 就超过 `Number.MAX_VALUE`，
  //      而 `Decimal.pow` 自己处理 e308 以上（返回合法的 Decimal，不是 Infinity）
  //      ⇒ `costCap` 从未阻止过溢出，它**唯一的实际作用就是把可买级数砍掉** ✗
  //   ⇒ 删掉它：价格 = `10^ipDoubleLogCost(n)`，**不封顶** ✓
  //      可达等级本来就有天然上界：`n ≈ log10(池)/10`，而池 ≤ 永恒门槛 1e308.25 量级
  //      ⇒ `n ≤ 几十~几百`，价格到 `1e10n`，**远在 `Decimal` 的 e9e15 范围内** ✓
  get purchasesAtIncrease() { return this.costIncreaseThreshold.log10().toNumber() - 1; },
};

/**
 * 下一级价格。
 *
 * ★★★ 2025（用户裁定）：**必须与 `ipDoublePriceAt` 同源**。
 *   原来这里写死 `stepShallow^(count+1)`（= AD 的 `10^(count+1)`）⇒ 首价 **10** ✗
 *   用户裁定首价应为 **1**（"购买时 1 级"），序列 `1 → 1 → 10 → 100 → 1000 …`
 *   ⇒ 本函数改为**直接调 `ipDoublePriceAt`**（单一实现，两处不会再脱节 ✓）
 *   ⚠️ 踩过同一类坑多次：「显示 ≠ 实发」几乎都源于**同一个公式写了两遍**。
 */
export function ipDoubleLogCost(level, kneeMult = 1) {
  const n = Math.max(0, Number(level) || 0);
  const KNEE = Math.max(1, Number(kneeMult) || 1);   // ★ 2026：挑战奖励的 knee 倍率（d5/d6 清满 ×2/×3）
  // ★ 第 1 级（count=0）：固定 1 点（用户裁定）
  if (n <= 0) return 0;                                                // 10^0 = 1 ✓
  const inc = IP_DOUBLE_AD.purchasesAtIncrease;
  // ★ 第 2 级起：`10^(n−1)` ⇒ n=1→1、n=2→10、n=3→100 …（与用户给的序列一致 ✓）
  if (n < inc) return Math.log10(10) * (n - 1);
  // ★ 2026：knee 倍率 = **软上限右移** ⇒ 门槛**除以**倍率（更快到高位、更便宜 ✓）
  //   ⚠️ 乘上去是**变慢**（实测 knee=3 时第 40 级 log 价 131 → 193 ✗）⇒ 方向必须是除 ✓
  const thr = IP_DOUBLE_AD.costIncreaseThreshold.log10().toNumber() / KNEE;
  return thr + (n - inc) * Math.log10(1e10);                           // AD: 门槛 × 1e10^超出
}

/**
 * ① 的**真实单级价格**（Decimal）。
 *
 * ⚠️ 为什么必须单独有它（不能到处写 `10^ipDoubleLogCost(lv)`）：
 *   上面的 log 形式**表达不了第 1 级的 1 点**（`10^0 = 1` 恰好对，但
 *   `ipDoubleAffordableIn` 里还要拿"本级价格"做等比数列求和，写两遍必错 ✗）
 *   ⇒ 单一实现，求和处一律调它 ✓
 */
/**
 * ★★★ 2025 **修 bug**（用户报：「无限增幅在 IP 超越 e308.25 后没法买满」）。
 *
 * ── 症状 ──
 *   池 1e5000 也只能买到 **Lv59**，而且**只用掉池子的极小一部分就永久停止** ✗
 *
 * ── 根因与最终修法（走了三步，前两步都错，记档）──
 *   ① 原实现：`costCap = 1e320`，探针在"价格 ≥ cap"时**整段跳过** ⇒ 恒返回 59 ✗
 *   ② 我改成"平台"（价格 `min(10^log, cap)`）⇒ **仍然被钉住**：
 *      封顶后每级恒收 1e320 ⇒ 池 < 1e320 时**一级都买不了**（用户实测"还是卡 59"）✗
 *   ③ **删除 `costCap`**（用户裁定）：价格**不封顶** = `10^ipDoubleLogCost(n)` ✓
 *      —— 它本来就没在防溢出（`10^n` 在 n≥309 就超 `Number.MAX_VALUE`，
 *         而 `Decimal.pow` 自己处理 e308 以上；可达等级 ≈ `log10(池)/10`，
 *         价格上限远在 `Decimal` 的 e9e15 内）⇒ 它**唯一的作用就是砍可买级数** ✗
 */
export function ipDoublePriceAt(level, kneeMult = 1) {
  const n = Math.max(0, Number(level) || 0);
  return new Decimal(10).pow(ipDoubleLogCost(n, kneeMult));
}

/**
 * ★★★ 2025 终稿（用户裁定 **方案甲**）：**引擎等级对「量子加成」的乘数**。
 *
 *   ── 形状：与「引擎累计价」同速（不是与等级同速）──
 *     `engineBonusMult(lv) = Σprice(0→lv) / Σprice(0→基准级)`
 *
 *   ── 为什么不是 `bonusGrowth^等级`（我上一版，实测失败 ✗）──
 *     那版每级只给 ×1.22（`ZPE_ENGINE.bonusGrowth`），而价格每级 ×1.872
 *     ⇒ **收入涨得比价格慢** ⇒ 引擎停在 116 级再也买不起（实测：每轮收入 1e30 vs 下一级价 1e32）✗
 *
 *   ── 为什么"与累计价同速"能自付（这是甲的核心）──
 *     买下一级要付 `price(lv)`；而付完之后乘数变成 `Σ(0→lv+1)/Σ(0→基准)`
 *     ⇒ 乘数**相对**增加 `1 + price(lv)/Σ(0→lv)` —— 恰好是"你刚付掉的那笔占累计的比例"
 *     ⇒ 收入按同比例上升 ⇒ **这一笔买卖恰好自付** ⇒ 等级可以一路涨 ✓
 *
 *   ── 用户提醒的代价（2025 原话）──
 *     「越过满速阈值后，后续生效的强度和等级的比例，需要更多等级才能 = 未越过阈值时的比例」
 *     即：价格是**指数**的（`×costGrowth`/级）⇒ 后期**每级越来越贵**，
 *     而乘数按累计价同速涨 ⇒ **同等"强度增量"需要越来越多的等级** ✓ 这是有意的（软上限语义）。
 *
 *   ── 落点：**乘在量子加成上**（用户裁定"全部"）──
 *     量子 → 熵 / 暗能量倍率 / 暗能量获得 / ZPE加法区 / IP 收入 五条**全部**乘它。
 *     ⚠️ 但**不在 `config.js` 的 5 个函数体内乘**（它们只收 `quantum` 参数、拿不到 state；
 *        且在体内乘会让 `audit.mjs` 的 `quantumDeMultBonus(q)===10000` 类断言失效、
 *        并污染 UI 量子面板的显示）⇒ 在 `formulas.js` 的**调用处**乘 ✓
 */
export function ipDoubleAffordableIn(level, poolDecimal, kneeMult = 1) {
  const lv0 = Math.max(0, Number(level) || 0);
  // ⚠️ 2026：ipDouble 的 knee 奖励（d6 全清 ×3）**尚未接** —— 这两个函数没有 state 形参，
  //   硬塞会 ReferenceError ✗ 要接必须先改签名（会连锁到 6 个以上调用点）⇒ 记入 TODO ✓
  const inc = IP_DOUBLE_AD.purchasesAtIncrease;
  // ★ `costCap` 已删除（用户裁定）⇒ 这里不再读它 ✓
  const pool = poolDecimal instanceof Decimal ? poolDecimal : new Decimal(poolDecimal ?? 0);
  if (!pool.gte(ipDoublePriceAt(lv0, kneeMult))) return 0;

  /**
   * ★★★ 2025 修正（用户报「永恒增幅价格消耗不对」后连带排查）：
   *   原来第 1 段是「**解析上界直接当答案**，只在买不起时才逐级回退」——
   *   而 `Math.floor` 的上界在浮点边界上会**低于真值**，回退循环只会往下调
   *   ⇒ 永远找不到真值。实测：池 1e30 时探针说 30 级，**逐级真值只能买 25 级** ✗
   *   （而且第一段还被 `inc` 级封顶 ⇒ 上界一旦低于真值就直接错）
   *   ⇒ 现在两段都用**同一套**：解析上界（`ceil` + 缓冲 ⇒ 只高估）＋ **逐级核减到真值** ✓
   *      逐级核减是 O(k) 的真价累加，而 k ≤ 几百 ⇒ 开销可忽略
   */
  const countFrom = (startLv, avail) => {
    if (!avail.gte(ipDoublePriceAt(startLv))) return { n: 0, spent: new Decimal(0) };
    // ① 解析上界（把序列当纯等比，首项 A = 本级价/10、比值 10）
    //    ⚠️ 必须 `ceil` + 缓冲：让"上界只会**高估**"这条前提真的成立 ✓
    const A = ipDoublePriceAt(startLv).div(10);
    let kUB = A.gt(0) ? Math.ceil(avail.mul(9).div(A).add(1).log10().toNumber()) + 2 : 0;
    if (!Number.isFinite(kUB) || kUB < 1) kUB = 1;
    kUB = Math.max(1, Math.min(kUB + 2, 20000));   // 硬上限：防极端池子撑爆循环（**不是**机制上限）
    // ② 逐级核减（真价累加）⇒ 精确的那个 n
    let spent = new Decimal(0);
    let n = 0;
    for (let i = 0; i < kUB; i++) {
      // ★ `costCap` 已删 ⇒ 这里**不再取 min**（那正是把可买级数钉在 Lv59 的东西之一）✓
      const p = ipDoublePriceAt(startLv + i);
      if (spent.add(p).gt(avail)) break;
      spent = spent.add(p);
      n++;
    }
    return { n, spent };
  };

  let lv = lv0;
  let left = pool;
  let total = 0;
  // ── 第 1 段：门槛以下（池子被 `costIncreaseThreshold` 截断，照抄 AD 的 clampMax）──
  if (lv < inc) {
    const usable = Decimal.min(left, IP_DOUBLE_AD.costIncreaseThreshold);
    const r = countFrom(lv, usable);
    const take = Math.min(r.n, inc - lv);
    total += take;
    lv += take;
    // 扣掉这一段真花的钱（`costFor` 口径与购买函数一致 ✓）
    if (take > 0) left = left.sub(ipDoubleCostFor({ ipDoubleLevel: lv - take }, take));
  }
  // ── 第 2 段：陡指数，直到价格撞封顶 ──
  //   ⚠️⚠️ 2025 修 bug（用户报「IP 超过 e308.25 后没法买满」）：
  //     原来这里是 `if (… && ipDoublePriceAt(lv).lt(cap)) { … total += Math.min(r.n, beforeCap) }`
  //     —— 两个截断叠在一起：
  //       ① 价格 ≥ cap ⇒ **整段跳过**（价格在 Lv59 到 cap ⇒ 从 Lv59 起恒返回 59）✗
  //       ② `beforeCap` 又把级数按"cap 之前的等比段长度"截一次 ✗
  //     ⇒ 实测池 1e5000 也只买到 Lv59、且只花掉极小一部分。
  //   ⇒ 现在价格**封顶成平台**（`ipDoublePriceAt` 里 `min(cap)`）⇒ 不再需要任何截断：
  //     `countFrom` 的逐级核减会自然地在"钱花完"处停下 ✓
  if (lv >= inc && left.gte(ipDoublePriceAt(lv))) {
    const r = countFrom(lv, left);
    total += r.n;
  }
  return total;
}

/**
 * ① 从当前级买 `k` 级的**总价**。
 *
 * ★★★ 2025（用户裁定改了首价序列）：**不再手抄等比求和**，改为
 *   **逐级累加 `ipDoublePriceAt`**（单一实现 ✓）。
 *
 *   ── 为什么放弃"分段等比公式"（原来那套）──
 *     它把序列形状（`10^(n+1)`）**又抄了一遍**（`div(9)` / `g=10` / 段边界），
 *     而首价一改（`10^(n−1)`）就得同步改三处系数 ⇒ 我当场就把 `div(9)` 抄错了 ✗
 *     （"同一个公式写两遍 ⇒ 显示/计算脱节"是这个项目的**头号病根**）
 *   ── 代价 ──
 *     只能在**需要具体总价**时用（例：UI 显示"买满要花多少"）。
 *     而"能买几级"走 `ipDoubleAffordableIn`（解析闭式，快）⇒ 两条路各司其职 ✓
 *     `k` 在这里只可能来自"买满按钮刚算出的级数"（≤ 门槛级数），量级很小 ✓
 */
export function ipDoubleCostFor(state, k) {
  const n = Math.max(0, Number(k) || 0);
  if (n <= 0) return new Decimal(0);
  const lv = Math.max(0, Number(state?.ipDoubleLevel ?? 0) || 0);
  let total = new Decimal(0);
  for (let i = 0; i < n; i++) {
    // ⚠️⚠️ 2025 修 bug（两步）：原来这里有 `if (c.gte(cap)) break;` ⇒ 总价半路截断 ✗
    //   后来我改成"平台"（`min(cap)`）⇒ **仍然被钉住**（池 < 1e320 时一级都买不了）✗
    //   ⇒ `costCap` 现已**彻底删除**：价格不封顶，逐级累加**真价**，
    //     与 `ipDoubleAffordableIn` 完全同源 ✓
    total = total.add(ipDoublePriceAt(lv + i, rewardIpDoubleKneeMult(state)));
  }
  return total;
}

/** 铸币等级上限（**档位闸门**：大坍缩次数 × 每档放行级数） */


/** 铸币等级 */


/** 铸币对**所有无限点收入**的倍率：`m^等级` */


/** 铸币第 N 级的价格（log10，分段软上限） */


/** 铸币下一级价格 */


/**
 * 铸币能买几级（**同时受档位闸门与软上限约束**）。
 * 闸门优先：`min(闸门剩余, 池子买得起的级数)`。
 */


/** 铸币总价（从 from 买到 to，Decimal） */


/**
 * ★ 档位里程碑（挂在**大坍缩次数**上）
 *
 * 设计意图（用户定的 24h → 18h）：
 *   总时长 = 档数 × 每次大坍缩耗时，而**每档兑现的阶数由 `capPerCrunch` 决定**。
 *   所以"档数压缩"不是把档数直接改小，而是**让每档上限随进度爬升**：
 *   30 → 33 → 36 → 41 → 46 ⇒ 同样的 306 阶需要的档数变少 ⇒ 阶梯自然压缩到 ~18 档。
 *
 * 另外两条：
 *   · `rate` —— 成长速率里程碑（每次大坍缩更快，与「速率解放」共用一个入口 `infinityRateMult`）；
 *   · `lube` —— **量子润滑（保守版）**：把量子门槛步长从 ×20 缓到 ×19.5。
 *     判据：`tools/crunch-speed-lab.mjs` 的 ⑦ 行显示"量子不足"惩罚很重（36.9h），
 *     所以先给一点点缓和；若实测仍然严重，再按用户说的"回到原方案"（给更多）。
 */
export function ipDoubleCost(state) {
  const count = Math.max(0, Number(state?.ipDoubleLevel ?? 0) || 0);
  return ipDoublePriceAt(count, rewardIpDoubleKneeMult(state));
}

/** 效果 —— 照抄 AD 的 `effect: () => DC.D2.pow(player.IPMultPurchases)`（×2/级） */
export function ipDoubleMult(state) {
  const lv = Math.max(0, Number(state?.ipDoubleLevel ?? 0) || 0);
  return new Decimal(2).pow(lv);
}

// ══════════════════════════════════════════════════════════
// ★★ 暗能量**有效量**软上限（用户 2025 方案乙，起点 = 1e50 阶 ✓）
//   为什么不是"削速率"：速率被按比例削弱后仍是天文数字 ⇒ 一秒冲过几百阶 ✗
//   所以改为削**量**：  log10(DE_eff) = knee + span·(1 − 2^(−(log10 DE − knee)/span))
//     形状：单调递增 ✓ 上界 = knee + span ✓ 平滑 ✓（cap-monotonic-lab 的模板可直接断言 ✓）
//   ★ 关键：物质最多 ≈ (1e(50+span)/base)^k ⇒ **span 就是"破∞→永恒能走多远"的总闸** ✓
//   ⚠️ 必须保证仍能到 1e308.25（否则永恒不可达 ✗）：(50+span−baseLog)×6.1651 ≥ 308.2547
// ══════════════════════════════════════════════════════════
// ★★★ 2026（用户：「前期启动自动化后一整个逻辑都有问题」）——
//   实测：打开自动化后 `darkEnergy` 每分钟 ×1e33（10 分钟从 7e55 到 4e354 ✗）。
//   根因 = 「暗能量自增长」是**自指**的（收益 ∝ 自身存量）⇒ 时间上指数 ✗
//   而 `DE_EFF_CAP` 的 knee = 300 阶 **永远够不到** ⇒ 等于没开 ✗
//   ⇒ 把 knee 压到 **40 阶**、span 30 ⇒ 收益在 40 阶之后按 2^(-x/30) 衰减 ⇒ 收敛 ✓
// ★★★ 2026（用户裁定）：「允许暗能量**超越 e308.25**，但到那时被**超载机制**压制」——
//   ⇒ knee 就设在 **e308.25**（= 双精度上限，UI 里出现 ∞ 视为致命错误 ✗）
//   span 60 ⇒ 超过 knee 后每 60 阶减半 ⇒ 永远压得住，但**数值本身**仍可以 >1e308（break_eternity ✓）
export function timeIPPerSecond(state) {
  // ★ 用户 2025 裁定：**无限长河停产**（本函数只留壳 ✓ 效果等同删除 ✗）
  //   ⚠️ 2026：这里原来写「破∞后的 IP 改由**无限挑战（8 关，每关 +38.53 阶）**提供」——
  //     **IC 已被用户删除** ⇒ 那句话不再成立 ✗
  //     现在破∞后的 IP 由 ④ 深度收益 + 量子铸币 + ① 无限增幅 等提供（见 `bigCrunchGain`）✓
  // ⏸ 待定 → 2025 用户解冻 ✓（保留用户定的**上限 1 IP/分钟** ✓）
  const raw = ipDoubleMult(state)
    .div(INFINITY_UPGRADES.ipTime.secondsPerPoint);
  return Decimal.min(raw, new Decimal(1).div(60));   // 上限 1 IP/分钟 ✓
}

/** ④ 单次无限的**可计时长上限**（秒）：超出部分不产点 —— 它是给"速度"定的靶子 */
export function timeIPCapSeconds() {
  return INFINITY_UPGRADES.ipTime.capSeconds ?? Infinity;
}

/**
 * ④ 单次无限（按耗时）**应得的总量** —— 实时进账的就是这个总量，只是拆成每帧发。
 *
 * ⚠️ 保留它是为了让工具/断言能直接验"总量"。**大坍缩不再调用它**
 *    （那时耗时部分早已实时发完，再发一次就是重复发放）。
 */
export function timeInfinityPointGain(state, seconds) {
  // ★ 用户 2025 最终裁定：**无限长河整体废弃** ⇒ 本函数同样停产（tick 走的就是它 ✗）
  if (!state.ipTimeBought) return new Decimal(0);
  // ⏸ 待定 → 解冻 ✓（同上限 ✓）
  const rawTotal = new Decimal(counted).div(INFINITY_UPGRADES.ipTime.secondsPerPoint)
    .mul(ipDoubleMult(state));
  return Decimal.min(rawTotal, new Decimal(counted).div(60));   // 1 IP/分钟 ✓
}

// ══════════════════════════════════════════════════════════
// ★ 无限点公式的**除数（div）**—— 保留"调用与影响"的权力（用户 2025 明确要求 ✓）
//
//   对齐 AD 源码（game.js:86 `gainedInfinityPoints`）：
//       const div = new Decimal(Effects.min(308, Achievement(103), TimeStudy(111))).toNumber();
//   ⇒ AD 的机制是：**多个来源各自给出一个候选除数，取其中最小者** ✓
//
//   本函数照搬这个机制 ✓：
//       ipDivisor(state) = min(基准 308.2547, 各来源候选值...)
//   ⇒ 未来的升级/里程碑只要往 `IP_DIVISOR_SOURCES` 里加一条候选 ✓ 即可生效 ✓
//      （不需要改公式、不需要改调用点 —— 这就是"保留调用与影响权力"的落地 ✓）
//
//   ⚠️ 目前所有候选都**未接线**（pending ✓）⇒ ipDivisor 恒等于基准 308.2547
//      ⇒ 零回归 ✓（公式现状不受任何影响 ✓）
// ══════════════════════════════════════════════════════════

/** 各来源给出的候选除数（越小 ⇒ 同样物质给越多 IP ✓）。pending 表示尚未接线。 */
export function quantumToIPGain(state) {
  if (!state.infinityFromQuantumBought) return new Decimal(0);
  const q = state.peakQuantumRun ?? 0;
  const n = q instanceof Decimal ? q : new Decimal(q);
  const p = Number(INFINITY_UPGRADES.ipFromQuantum.power ?? 2) || 2;
  // 非整数幂（当前 1.75）只能走 `.pow()`；整数幂一律走精确反复平方
  const v = Number.isInteger(p) ? powExactInt(n, p) : n.pow(p);
  return v.floor();
}

/**
 * ① 的**下一级价格**（log10）。
 *
 * ★★★ 2025（用户裁定）：「无限增幅的初始价格不应该就是 1 无限点（购买时 1 级）么？
 *   然后每 2 级为 10 无限点花费，3 级 100 点（以此类推）」
 *   ⇒ 价格序列：`1（第1级）→ 1（第2级）→ 10 → 100 → 1000 …`
 *     即第 1 级 **1 点**（开局买得起），第 2 级 1 点，之后每级 ×10 ✓
 *
 *   ⚠️ 原实现（照抄 AD）是 `10^(count+1)` ⇒ 首价 **10** ⇒ 用户报
 *      「无限增幅开局买不了？…打破无限本身也要 128 点」⇒ 10 点开局确实难凑 ✗
 *   ⚠️ 门槛之后仍是 AD 的 `门槛 × 1e10^超出`（用户：「后续的阈值我不管你，因为符合预期」）✓
 */


