/**
 * config/zpe-engine/economy.js —— 引擎经济：等级 / 价格 / 买满探针 / 累计价倍率
 *
 * ★ 2026 模块化：由 624 行的 config/zpe-engine.js 拆出（声明与注释逐字保留）。
 *    对外统一从 `src/config.js`（barrel）导入。
 */
import { ZPE_ENGINE, zpeEngineLevel, zpeEngineUnlocked } from "./config.js";
import Decimal from "../../../dist/break_eternity.esm.js";

export function engineBonusMult(state) {
  const lv = Math.max(0, Number(state?.zpeEngineLevel ?? 0) || 0);
  const base = Math.max(1, Number(ZPE_ENGINE.bonusBaseLevel ?? 1) || 1);
  if (lv <= base) return new Decimal(1);           // 低于基准级 ⇒ 恒 1（零回归 ✓）
  const denom = zpeEngineTotalCost(0, base);
  if (!denom.gt(0)) return new Decimal(1);
  return zpeEngineTotalCost(0, lv).div(denom);
}

/**
 * ① 的等级上限探针：给定池子能买几级。
 *
 * ★★★ 2025 重写（用户裁定改了首价序列之后）：
 *   用户的价格序列是 `1 → 1 → 10 → 100 → …` —— **第 1 级 1 点是个特例**
 *   （`10^(n−1)` 在 n=0 处是 0.1，不是 1）⇒ 任何"纯等比闭式"都会错。
 *   ⚠️ 我在这里**错了两次**（先 `/9` 后 `/90`，再想用 `/9` 反解 k）——
 *      根因都是"把带特例的序列当成纯等比" ✗
 *
 *   ⇒ 现在改成**两段式**，不再推导新公式：
 *     ① **解析求上界** `kUB`（把序列当纯等比 `10^(n−1)`，首项取本级价格）—— 只会**高估**
 *     ② 从 `kUB` **逐级阶梯回退**直到累计价 ≤ 池子 ⇒ **保证精确** ✓
 *       回退步数：首价有偏差时最多差 1~2 级 ⇒ 实际上近 O(1) ✓
 *     （步长 ≤ 30 级，`ipDoublePriceAt` 是幂运算，开销可忽略）
 */
export function zpeEngineCost(state) {
  const c0 = new Decimal(ZPE_ENGINE.baseCostIp);
  const r = new Decimal(ZPE_ENGINE.costGrowth);
  // ⚠️⚠️ **必须 `Number(…)`** —— `zpeEngineLevel()` 返回的是 **Decimal**，
  //   而 `lv + i` / Decimal 参与 `pow` 时会走**字符串拼接**：
  //   实测 `Lv1990 + 0 ⇒ "19900"`（不是 1990）⇒ 价格虚高到买不起、显示也错 ✗
  //   （我第一版就是这么写的，被 `_zpe3` 的逐步试算当场抓出来）
  const lv = Number(zpeEngineLevel(state)) || 0;
  // ★★★ 2025 新增（用户要求）：**2000 级之后的价格增幅惩罚**（见 `zpeEngineCostMult`）✓
  //   `cost(lv) = c0 · r^lv · ζ(lv)`，阈值处 `ζ(2000) = 1` ⇒ **跨过阈值不跳变** ✓
  return c0.mul(r.pow(lv)).mul(zpeEngineCostMult(lv));
}

/**
 * ★★★ 2025/2026 **新增**（用户要求）：「给 zpe 引擎在大于 2000 级后购买等级需要更多无限点
 *   （**每增加 5 个数量级只能买 1 个**）的价格增幅逻辑」。
 *
 * ── 终稿语义（用户第 3 次纠正原话：「**不应该是当前价格基础上再 ×1e5 么？**」）──
 *   **2000 级起，每买一级都在当前价格上再 ×mult** ⇒ 逐级连乘 ✓
 *     `ζ(lv) = 1`（lv < level）｜`mult^(lv − level + 1)`（lv ≥ level）
 *   即：
 *     `价格(1999) = 5·r^1999`
 *     `价格(2000) = 价格(1999) · r · mult`          ← 第 1 次 ×mult
 *     `价格(2001) = 价格(2000) · r · mult`          ← 第 2 次
 *     `价格(2000+n) = 价格(1999) · r^(n+1) · mult^(n+1)` ✓
 *   ⚠️ `mult` 由 `1e5` 调成 **`1e9`**（用户 2026：「一次能爬的还是太多了」）✓
 *
 * ── ⚠️⚠️ 我前两版都**只让它生效一次**（ζ 取常数）──
 *   那只有"跨过 2000 那一步 ×mult"，之后每级又回到 ×1.8725 ✗
 *   ⇒ 用户看到的现象就是"说好的价格阈值升级呢？"（增量没持续）
 *   教训：「每增加 N 个数量级只能买 1 个」是**每一级**都要 +N 个数量级，不是一次性 ✓
 *
 * ── 实测（Lv2000 之后每级）──
 *   Lv2001 ⇒ +9.27 个数量级｜Lv2005 ⇒ 累计 +46.4｜Lv2010 ⇒ 累计 +92.7 ✓
 *   ⚠️ 这比 2000 级**以下**更陡（下面每级只 +0.27）—— 是有意的：
 *     用户要一道**硬闸门**把引擎等级封在 2000 附近 ✓
 *   好处：池子给的是 `log10(池)/9.27` 级 ⇒ 可买级数随池子**对数**增长，不会失控 ✓
 *   （从 1e1000 池 ≈ 1127 级；1e2000 池 ≈ 1307 级）
 */
export function zpeEngineCostMult(level) {
  const cfg = ZPE_ENGINE.steepAfter ?? { level: 2000, mult: 1e9 };
  const lv = Math.max(0, Number(level) || 0);
  const start = cfg.level ?? 2000;
  const mult = cfg.mult ?? 1e9;
  if (lv < start) return new Decimal(1);
  // ★ **逐级连乘**：超出阈值的级数越多，乘得越多 ✓
  //   `mult^(lv − start + 1)` ⇒ 第 2000 级本身就是 ×mult（与用户"当前价格基础上再×mult"一致）✓
  return new Decimal(mult).pow(lv - start + 1);
}

/** `ζ` 的**每级倍率**（`ζ(lv+1)/ζ(lv)`）—— 供 UI/诊断显示"这一级实际涨多少" ✓ */
export function zpeEngineStepMult(level) {
  const lv = Math.max(0, Number(level) || 0);
  return zpeEngineCostMult(lv + 1).div(zpeEngineCostMult(lv));
}

/**
 * 从 `from` 买到 `to` 的总价（**Decimal**）。
 *
 * ★★★ 2025 **改回分段闭式**（在"逐级累加"之后又改回来 —— 两次的教训都留档）。
 *
 * ── 第 1 版（原始）：纯等比闭式 ──
 *   `c0·r^a·(r^n − 1)/(r − 1)` —— 它假设**每级都 ×r**。
 *   加了 2000 级后的惩罚 `ζ` 之后，这个假设**不再成立** ⇒ 闭式必错 ✗
 *
 * ── 第 2 版（我改成逐级累加）：正确，但**把性能打崩了** ✗✗ ──
 *   实测（`_zpeclosed2.mjs`）：`zpeEngineTotalCost(0, 2000)` = **3.9 ms/次**
 *   而它是**热路径**：
 *     · `ui.js` 的 ZPE 面板每帧显示引擎累计价
 *     · `engineBonusMult()` 里调**两次**（`zpeEngineTotalCost(0, lv)/zpeEngineTotalCost(0, base)`）
 *       —— 而 `engineBonusMult` 被 UI 每帧用于显示引擎加成 ✗
 *   ⇒ 每帧 3~4 次 × 3.9ms ≈ **12~16ms/帧**，在 ZPE 2000 级后还会**继续变慢**（O(等级)）✗
 *   这正是用户的性能图上 `zpeEngineTotalCost(0, 等级) = 2.06 ms/次` 那一行。
 *
 * ── 第 3 版（现在）：**分段闭式**（与逐级累加**逐区间验证一致**）──
 *   ζ 现在是**逐级连乘**（`lv ≥ L ⇒ ζ = M^(lv−L+1)`）⇒ 阈值之上是
 *   **公比为 `r·M` 的等比数列**（每一级都同时 ×r 和 ×M）：
 *     · 段 1 `[a, min(b, L))`：公比 `r`，首项 `c0·r^a`
 *     · 段 2 `[max(a, L), b)`：公比 **`r·M`**，首项 `c0·r^L·M`
 *
 *   ⚠️⚠️ **这里有一个我来回错过两次的点，必须讲清**：
 *     · 当 ζ 是**常数**（旧版，只跃变一次）时，段 2 的公比是 **`r`**（不是 `r·M`）
 *       —— 我那次写成 `r·M` ⇒ 算出来的价虚高几个数量级 ✗
 *     · 当 ζ 是**逐级连乘**（现在）时，段 2 的公比**就是 `r·M`** ✓
 *   ⇒ **公比取决于 ζ 的形状**，不能照抄。改 ζ 语义时必须回来重算这一段 ✗
 *
 *   性能：`(0, 2000)` 3.9ms → **0.0039ms（1013×）**；且**与等级无关**（O(1)）✓
 */
export function zpeEngineTotalCost(from, to) {
  const a = Math.max(0, Number(from) || 0);
  const b = Math.max(0, Number(to) || 0);
  const n = Math.floor(b - a);
  if (n <= 0) return new Decimal(0);
  const c0 = new Decimal(ZPE_ENGINE.baseCostIp);
  const r = new Decimal(ZPE_ENGINE.costGrowth);
  const M = new Decimal(ZPE_ENGINE.steepAfter?.mult ?? 1e9);
  const L = zpeEngineSteepLevel();
  /** 等比求和（公比 `q`）：`first·(q^n − 1)/(q − 1)` */
  const geo = (first, q, count) => first.mul(q.pow(count).sub(1)).div(q.sub(1));
  let total = new Decimal(0);
  // 段 1：ζ = 1 ⇒ 公比 r
  const e1 = Math.min(b, L);
  if (e1 > a) total = total.add(geo(c0.mul(r.pow(a)), r, e1 - a));
  // 段 2：ζ = M^(lv−L+1) ⇒ 公比 r·M，首项 c0·r^L·M
  const s2 = Math.max(a, L);
  if (b > s2) {
    const q = r.mul(M);
    total = total.add(geo(c0.mul(r.pow(s2)).mul(zpeEngineCostMult(s2)), q, b - s2));
  }
  return total;
}

/** `steepAfter.level`（生效级）—— 单一出处 */
export function zpeEngineSteepLevel() {
  return ZPE_ENGINE.steepAfter?.level ?? 2000;
}

/**
 * **逐级累加**版（闭式的验证基准 + 万一 ζ 形状再变的兜底）。
 *
 * ⚠️ 复杂度 `O(n)`、每级一次 `Decimal.pow` ⇒ **绝不放进热路径** ✗
 *   （我把它放进去过一次，实测 3.9ms/帧 × 每帧 3~4 次 ⇒ 性能事故）
 * 用途：自检里与闭式对照 ✓
 */
export function zpeEngineTotalCostLoop(from, to) {
  const a = Math.max(0, Number(from) || 0);
  const b = Math.max(0, Number(to) || 0);
  const n = Math.floor(b - a);
  if (n <= 0) return new Decimal(0);
  const c0 = new Decimal(ZPE_ENGINE.baseCostIp);
  const r = new Decimal(ZPE_ENGINE.costGrowth);
  let total = new Decimal(0);
  for (let i = 0; i < n; i++) total = total.add(c0.mul(r.pow(a + i)).mul(zpeEngineCostMult(a + i)));
  return total;
}

/**
 * 从当前等级起，给定无限点池**最多能买几级**。
 *
 * ★★★ 2025 **改回分段闭式反解**（"逐级核减"版正确但把性能打崩了 —— 见下）。
 *
 * ── 反解（每段内是纯等比）──
 *   `pool ≥ first·(r^k − 1)/(r − 1)` ⇒ `k = floor( log_r(1 + pool·(r−1)/first) )`
 *   两段**串联**：先吃段 1（ζ=1），剩余的钱再吃段 2（ζ=M）✓
 *   ⚠️ `floor` 在浮点边界上可能**低于真值**（本项目踩过：探针说 30 级、真值 25 级）
 *      ⇒ 算出后再用 `zpeEngineTotalCost` **验一次**，多退少补（O(1) 次闭式调用）✓
 *
 * ── 为什么不能用"逐级核减"（我上一版）✗ ──
 *   实测 `zpeEngineAffordableIn @Lv0` = **4.5 ms/次**，而 UI **每帧**调它
 *   （ZPE 面板的「可买 N 级」+ 买满按钮的门控）⇒ 又一个性能事故 ✗
 *   （那个循环的 `kUB` 还会到 20000 ⇒ 最坏情况更糟）
 *
 * ── `ζ` 随等级变化时（`spanLevels > 0`）──
 *   闭式不成立 ⇒ 退回逐级核减（`zpeEngineAffordableInLoop`）✓
 */
export function zpeEngineAffordableIn(state, poolDecimal) {
  if (!zpeEngineUnlocked(state)) return 0;
  const pool = poolDecimal instanceof Decimal ? poolDecimal : new Decimal(poolDecimal ?? 0);
  if (pool.lte(0)) return 0;
  // ⚠️ **必须 `Number(…)`** —— `zpeEngineLevel()` 返回 Decimal，
  //   参与 `lv + i` 会变成**字符串拼接**（`1990 + 0 ⇒ "19900"` ✗，我踩过）
  const lv = Number(zpeEngineLevel(state)) || 0;
  const c0 = new Decimal(ZPE_ENGINE.baseCostIp);
  const r = new Decimal(ZPE_ENGINE.costGrowth);
  const M = new Decimal(ZPE_ENGINE.steepAfter?.mult ?? 1e9);
  const L = zpeEngineSteepLevel();
  /** 在公比 `q`、首项 `first` 的等比段里，`avail` 最多买几级 */
  const nIn = (first, q, avail) => {
    if (first.lte(0) || avail.lt(first)) return 0;
    const inner = avail.mul(q.sub(1)).div(first).add(1);
    if (inner.lte(1)) return 0;
    const k = Math.floor(inner.log10().div(q.log10()).toNumber());
    return Number.isFinite(k) && k > 0 ? k : 0;
  };
  let left = pool;
  let k = 0;
  // 段 1：ζ = 1 ⇒ 公比 r
  if (lv < L) {
    const n1 = Math.min(nIn(c0.mul(r.pow(lv)), r, left), L - lv);
    if (n1 > 0) {
      left = left.sub(zpeEngineTotalCost(lv, lv + n1));
      k += n1;
    }
  }
  // 段 2：ζ = M^(lv−L+1) ⇒ 公比 **r·M**（每一级都同时 ×r 和 ×M）✓
  const at = lv + k;
  if (left.gt(0) && at >= L) {
    const n2 = nIn(c0.mul(r.pow(at)).mul(zpeEngineCostMult(at)), r.mul(M), left);
    if (n2 > 0) k += n2;
  }
  // 浮点边界修正：`floor` 可能少算 1 级（也可能多算 1 级）⇒ 用**真价**收敛 ✓
  let guard = 0;
  while (guard++ < 4 && k > 0 && zpeEngineTotalCost(lv, lv + k).gt(pool)) k--;
  guard = 0;
  while (guard++ < 4 && zpeEngineTotalCost(lv, lv + k + 1).lte(pool)) k++;
  return k;
}

/** 逐级核减版（`ζ` 随等级变化时的兜底 + 自检的验证基准）—— **O(k)，别放热路径** ✗ */
export function zpeEngineAffordableInLoop(lv, pool) {
  const c0 = new Decimal(ZPE_ENGINE.baseCostIp);
  const r = new Decimal(ZPE_ENGINE.costGrowth);
  const inner = pool.mul(r.sub(1)).div(c0.mul(r.pow(lv))).add(1);
  if (inner.lte(1)) return 0;
  let kUB = inner.log10().div(r.log10()).floor().toNumber();
  if (!Number.isFinite(kUB) || kUB < 1) kUB = 1;
  kUB = Math.max(1, Math.min(kUB + 2, 20000));
  let spent = new Decimal(0);
  let k = 0;
  for (let i = 0; i < kUB; i++) {
    const p = c0.mul(r.pow(lv + i)).mul(zpeEngineCostMult(lv + i));
    if (spent.add(p).gt(pool)) break;
    spent = spent.add(p);
    k++;
  }
  return k;
}

/**
 * ② 引擎对 ZPE 产出的倍率。
 *
 * ★★ 2025「甲方案」（用户选定）：**全部改多项式**。
 *
 *   原案「每级 ×10」（`10^等级` ✗）在"破∞时已 944 级"的起跑线上**是几秒钟走完** ✗
 *   （拉表：`tools/` 的两方案对照 ⇒ 封顶到 3 级都还是 0.00h ✗）
 *   根因（数学判据）：**任何指数形式**（`10^等级` / `2^等级` / `2^√等级` ✗）都会让
 *     `∫dx/FORM(x)` 收敛 ⇒ **有限时间爆炸** ✗；只有**多项式**（线性/开根）发散 ⇒ 安全 ✓
 *   ⇒ 改成 `1 + 0.01·√等级`（开根 ✓，与倍率项同一族）
 */
/**
 * 第三种设计稿（用户 2025）· 引擎机制的**第 5 条**：
 *   「zpe 引擎将基于自身提供的倍数，提升**前 8 个虚空升级的效果**」
 *
 *   voidBoostMult = 1 + VOID_BOOST.coeff × log10(引擎倍率)
 *
 * 为什么用**对数**（不是直接乘）：
 *   · 引擎倍率现在最大可达 ~1e75（三次方价格下，等级 ~9.46e76）
 *   · 若线性乘进虚空升级 ⇒ 立刻重演 runaway（判据不允许指数链）
 *   · 对数 ⇒ 1e75 只给 ×(1 + 0.1×75) ≈ ×8.5 —— 强、有界、判据安全
 *   · 引擎未解锁/等级 0 ⇒ 倍率 = 1 ⇒ log10 = 0 ⇒ boost = 1 ⇒ **零回归**
 */

