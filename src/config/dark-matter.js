/**
 * config/dark-matter.js —— 暗物质 / 第二台相变仪（永恒之后第一块）
 *
 * ⚠️ 本文件由 `src/config.js` 按领域机械拆分而来：**声明与注释逐字保留**。
 *    对外仍然统一从 `src/config.js`（barrel）导入 —— 不要直接改这里的 import 路径。
 *    依赖：eternity ｜ Decimal
 */
import Decimal from "../../dist/break_eternity.esm.js";
import { spaceDuMult } from "../space/core.js";
import { hasEternityMilestone } from "./eternity.js";

export const DARK_MATTER = {
  // ── 获取：EP 购买（唯一来源；等比价格，首价 1）──
  /** 第 n 个的价格 = `costBase · costMult^n`（单位 = 永恒点 EP） */
  costBase: 1,
  costMult: 3,
  // ── 第二台相变仪速度：`v2 = 10^(speedExp·log10 v1) · n^speedNExp` ──
  /** `v1` 的指数 —— 0.01 是"压缩机"，结果恒落在 1 ~ 1000 */
  speedExp: 0.01,
  /** 暗物质数量对速度的幂次（0.25 ⇒ n=122 时 ×3.3、n=1e6 时 ×32） */
  speedNExp: 0.25,
  // ── ④ 目标倍率：`T = 1 + min( effectCoeff·((log10(1+余额))^(n^effectNExp) − 1), effectCap )` ──
  /**
   * ★★★ **强度系数** —— 用户 2026 的裁定：「**强度不足的话……调整我们的系数就行**」
   *   （即：**不动价格阶梯**，也不许动游戏的 a/k/b；只把这条机制自己的强度给够。）
   *
   * ── 为什么是 30000（反解 + 实测，不是拍的）──
   * 用户的 EP 现实：`40 EP ⇒ n=4`（`1+3+9+27 = 40` 恰好）、`1145 EP ⇒ n=7`。
   *   ⇒ 而 `0.1` 时 n=4 的项只有 ~3.4e5，实测省 **0.0 分钟** ✗
   * 用实测的幂律 `省时 ∝ 项^0.34`（见 `tools/dark-matter-lab.mjs --calibrate`）反解，
   *   把系数抬到 **3e4** 后**实测**（第 5 轮、同状态分叉、对照 n=0 的 3.72 小时）：
   *     `n=2 ⇒ 16.1 分（7.2%）`｜`n=4（40 EP）⇒ 23.3 分（10.4%）`
   *     `n=7（1145 EP）⇒ 30.3 分（13.6%）`｜`n=10 ⇒ 34.8 分（15.6%）`
   *     `n=30 ⇒ 48.7 分（21.8%）`｜`n=122 ⇒ 56.0 分（25.1%，撞顶）`
   *   ⇒ **用户买得起的那两个数都有感觉了** ✓ 且仍封在 ~25%、无 runaway ✓
   *
   * ⚠️ 这条机制因此是一条**尖峰**（不是长坡）：`n ∈ [2, 10]` 走完从"有感"到"接近撞顶"。
   *   这是本形式的**结构性质**（`log10 余额 ≈ 3950` 太大 ⇒ 每单位 n 的杠杆极高）：
   *   「早期买得起就有感觉」与「长坡」**只能二选一**。用户选了前者 ✓
   *   想要长坡的话，旋钮是 `effectNExp`（调小 ⇒ 摊开）而不是 `effectCap`（抬高会把大 n 推过"整段塌掉"线）。
   *
   * ⚠️ 绝对百分比来自**贪心拟真**，用户 2026 明确说「**拟真不如我上手玩**」
   *   ⇒ 把它当**方向与相对曲线**用，最终手感以实际上手为准 ✓
   */
  effectCoeff: 30000,
  /**
   * ★★★ **n 的幂** —— 决定「攒暗物质有没有用」，是这条机制**最关键的一个数**。
   *
   * ── 为什么从 0.01 改成 0.32（2026 实测反解，不是拍的）──
   * 用户 2026 的裁定：**不许动游戏的 `a` / `k` / `b`**（"否则显得我很无能"），
   *   暗物质必须靠**自己的数值**变强 ⇒ 那问题就只剩"这个数给得够不够"。
   *
   * 真引擎实测（`tools/dark-matter-lab.mjs --calibrate`，第 5 轮同状态分叉对照）：
   *   项 = **535**（n=122；实测暗能量余额峰值 `log10 ≈ 3950`）⇒ 省 **0.0 分钟** ✗
   *   项 = 1.7e10 ⇒ 省 15.6 分钟（7%）
   *   幂律拟合 `省时 ∝ 项^0.34` ⇒ 要省 ~27% 需要项 ≈ **1e12**
   * 反解：`0.1·(log10 余额)^(n^b) = 1e12` 在 `n ≈ 55` 处成立 ⇒ **`b ≈ 0.32`**
   * ⇒ 0.01 差了**十个数量级**；0.32 让"n ≈ 55 个暗物质"就摸到目标区间 ✓
   *
   * ⚠️ 这只是**暗物质自己的公式**里的指数 —— 与"不许动 a/k/b"那条裁决**不冲突** ✓
   * ⚠️ 改它必须重跑 `--calibrate`（它是**标定值**）
   */
  effectNExp: 0.32,
  /**
   * ★★★ **效果硬封顶**（加进加法区那一项的上界）。
   *
   * 为什么必须有：上面那条幂律是 **0.34 次方** ⇒ 项再大两个数量级会把整段压塌 ✗
   *   `1e12 ⇒ 省 ~27%`（安全）｜`1e13 ⇒ ~59%`（偏多）｜`1e14 ⇒ 整段塌掉`
   * ⇒ 封在 **1e12**，留约两个数量级的余量 ✓
   * 这也是项目既定规矩（`PROGRESSION.md` §4.5「分轴价格段 / **效果硬封顶**，二选一」）✓
   */
  effectCap: 1e12,
  // ── 效率：`转化值 = 1 + (T − 1)·min(1, v2 / v2Ref)` ──
  /**
   * 效率基准 —— **由 `tools/dark-matter-lab.mjs --calibrate` 的真引擎读数标定**。
   *
   * 实测（第 1 轮，每 10 分钟采样一次，共 31 个样本）：
   *   `log10 v1` 的 25% / 中位 / 75% = **126.6 / 128.6 / 162.6**
   *   ⇒ `v2 = v1^0.01 · n^0.25` 在 n=122 时 ≈ **61 / 64 / 140**
   * ⇒ 取 **200**：解锁时（第 4 次永恒起，v1 比第 1 轮更高）效率约 **1/3 ~ 2/3**，
   *   随暗物质个数继续爬 ⇒ 既看得到成长，又不会一开始就吃满 ✓
   * ⚠️ 改这个数必须重跑 `--calibrate` 复核（它是**标定值**，不是拍的）
   */
  v2Ref: 200,
};

/** em4 是否已达成 ⇒ 暗物质解锁（**唯一判据**，UI 与引擎共用） */
export function darkMatterUnlocked(state) {
  return hasEternityMilestone(state, "em4");
}

/**
 * 暗物质的**个数**（读 `state.eternityDarkMatter`）。
 *
 * ⚠️ 字段名不是 `darkMatter` —— 那个名字属于**已删除**的「临界坍缩 → 暗物质」体系，
 *   `state.js` 至今明文忽略旧档里的 `raw.darkMatter` ⇒ 复用同名会让老存档白得一批 ✗
 *   （完整理由写在 `state.js` 的字段说明里）
 *
 * ⚠️ 刻意用 **普通 Number**（不是 Decimal）——理由有两条：
 *   ① 它是**计数**（买第几个），语义与 `epMultLevel` 同级，不是货币量级；
 *   ② 它的唯一用途是 `log10`/幂次，而 `Decimal.toNumber()` 在巨量时会变 `Infinity`
 *      ⇒ 用 Number 直接把这类越界风险**从根上消掉** ✓
 * 脏数据（负数 / NaN / 字符串）⇒ 回落 0（存档可被手改 ⇒ 必须夹住）✓
 */
export function darkMatterCount(state) {
  const n = Math.floor(Number(state?.eternityDarkMatter ?? 0) || 0);
  return n > 0 ? n : 0;
}

/**
 * 第二台相变仪的**速度** `v2 = v1^0.01 · n^0.25`。
 *
 * ⚠️ `v1` 取自 **`state.v1Log10`（上一帧的 `log10(第一台速率)`）**，**不是**现算
 *   `darkEnergyRate()` —— 否则会成**循环调用**：
 *     `darkEnergyRate → effectiveDarkEnergyGain → darkEnergyGainPerConversion`
 *     `→ (买了 dm5) → darkEnergyMultiplier → 本函数 → darkEnergyRate` ✗
 *   （项目里 `zpeFixedMultiplier` 是同一个"快照"手法的先例 ✓）
 *   ⚠️ 而 `darkEnergyMultiplier` 本身也在 `globalMultiplier` 里 ⇒ 用 `zpeRate` 当输入**同样**会成环 ✗
 * ⇒ 存 **log10** 还有个好处：**不会溢出**（`Decimal.toNumber()` 在巨量时是 Infinity）✓
 *
 * 未解锁 / n = 0 ⇒ **返回 0**（效率 0 ⇒ 转化值 = 1 ⇒ 零回归 ✓）
 */
export function secondTransmuterSpeed(state) {
  if (!darkMatterUnlocked(state)) return 0;
  const n = darkMatterCount(state);
  if (!(n > 0)) return 0;
  const logv1 = Number(state?.v1Log10 ?? 0) || 0;
  const v1Part = Math.pow(10, DARK_MATTER.speedExp * logv1);
  return v1Part * Math.pow(n, DARK_MATTER.speedNExp);
}

/**
 * ④ 的**目标**倍率 `T`（第二台最多能把暗能量转出多少倍率）。
 *
 * `T = 1 + min( effectCoeff·max(0, (log10(1 + 暗能量**余额**))^(n^effectNExp) − 1), effectCap )`
 *
 * ⚠️ `1 +` 与 `max(0, ·)` **都是必须的**：大坍缩/永恒后余额被置为 **1**，
 *   于是 `log10(1) = 0`，而 `0^(n^b) = 0` ⇒ 不夹的话项 = `−c` ⇒ **变成减益** ✗
 * ⚠️ `n = 0` ⇒ `n^b = 0` ⇒ `(...)^0 = 1` ⇒ 项 = 0 ⇒ **零回归** ✓
 * ⚠️ `effectCap` 是**硬封顶** ⇒ `T` 有界 ⇒ 效率形式再乘一次也仍然有界 ✓
 *   （为什么必须封、封在多少：见 `DARK_MATTER.effectCap` 的注释）
 */
export function darkMatterTargetMult(state) {
  if (!darkMatterUnlocked(state)) return 1;
  const n = darkMatterCount(state);
  if (!(n > 0)) return 1;
  const de = state?.darkEnergy ?? new Decimal(0);
  if (!(de.gt ? de.gt(0) : Number(de) > 0)) return 1;
  const lg = de.add(1).log10().toNumber();
  if (!(lg > 0)) return 1;
  const progress = Math.pow(lg, Math.pow(n, DARK_MATTER.effectNExp)) - 1;
  const term = DARK_MATTER.effectCoeff * Math.max(0, progress);
  // ★ 硬封顶（`effectCoeff` 已含在内 ⇒ 封的是**最终那一项**，不是 progress）
  const cap = Number(DARK_MATTER.effectCap);
  const gain = (Number.isFinite(cap) && cap > 0) ? Math.min(term, cap) : term;
  return 1 + gain;
}

/**
 * ④ 的**实际**转化值（效率形式）—— 唯一落点，UI 与引擎共用。
 *
 * `转化值 = 1 + (T − 1) · min(1, v2 / v2Ref)`
 *   · 未解锁 / n = 0 ⇒ **恒等 1**（零回归 ✓）
 *   · 效率封顶 1 ⇒ 转化值 `∈ [1, T]` ⇒ **有界** ✓（这是 v2 可以无界的原因）
 */
export function darkMatterEffectMult(state) {
  if (!darkMatterUnlocked(state)) return 1;
  const n = darkMatterCount(state);
  if (!(n > 0)) return 1;
  const T = darkMatterTargetMult(state);
  if (!(T > 1)) return 1;
  const eff = Math.min(1, secondTransmuterSpeed(state) / DARK_MATTER.v2Ref);
  return 1 + (T - 1) * Math.max(0, eff);
}

/**
 * ④ 加进暗能量倍率**加法区**的那一项 —— 与 `q²` 同一个池子，所以是 `转化值 − 1`。
 * 未解锁 ⇒ **恰好 0**（零回归 ✓）
 */
export function darkMatterAdditiveTerm(state) {
  // ★ 2026-10-25：du1 直接放大暗物质的加法项（未买 = ×1，零回归）
  // ⚠️ 用 Decimal 返回，不要 `.toNumber()`：du1 等级上千时 10^(n^1.5)
  //   会超过 Number.MAX_VALUE ⇒ Infinity ⇒ 暗能量倍率 NaN/∞ ✗
  return new Decimal(darkMatterEffectMult(state) - 1).mul(spaceDuMult(state, "du1"));
}

/**
 * **精确整数幂**（只用 `mul` 的反复平方法）。
 *
 * ⚠️ 为什么不能用 `Decimal.pow`：它给的是**带误差**的值 ——
 *   `Decimal.pow(100, 5000)` = `1.0000000000005236e10000`（不是精确的 `1e10000`）✗
 *   后果是"探针"与"实发"用**不同的价格** ⇒ 实测"买满 5000 级 vs 逐级 14307 级"对不上。
 *   `Decimal.mul` 对整数尾数相乘是**精确**的 ⇒ 反复平方正好绕开 `pow` 的误差 ✓
 *   （与 `epMultPriceAt` 里那份局部实现同源；本项目已为此踩过一次坑。）
 *
 * ⏳ 遗留：`epMultPriceAt` 里**还有一份同样的局部实现** —— 本批不动它
 *   （那是被 18 条断言压着的老代码；本项目纪律：一次只改一处）。
 *   将来统一到这里即可，改完重跑 `consistency.mjs` 的 epMult 三条断言 ✓
 */
export function powExactInt(base, exp) {
  let result = new Decimal(1);
  let b = new Decimal(base);
  let n = Math.max(0, Math.floor(Number(exp) || 0));
  while (n > 0) {
    if (n & 1) result = result.mul(b);
    n >>>= 1;
    if (n > 0) b = b.mul(b);
  }
  return result;
}

/**
 * 第 `n` 个暗物质的**价格**（单位 EP）—— **唯一实现**（UI 与实发共用 ✓）。
 * 序列是**纯等比**（`costBase·costMult^n`）⇒ 没有 `ipDouble` 那种"第 1 级是特例"的问题 ✓
 */
export function darkMatterPriceAt(n) {
  const k = Math.max(0, Math.floor(Number(n) || 0));
  const { costBase, costMult } = DARK_MATTER;
  const mag = Math.log10(costBase) + k * Math.log10(costMult);
  // 小量级：`Math.pow` 在安全整数内是精确的 ✓；大量级：走精确整数幂 ✓
  if (mag <= 15) return new Decimal(costBase * Math.pow(costMult, k));
  return new Decimal(costBase).mul(powExactInt(costMult, k));
}

/**
 * 从 `count` 起连续买 `k` 个的**真实总价**（= 逐级价之和）。
 *
 * ⚠️ 刻意**不用几何闭式**：本项目已有两次教训（`epMult` 的
 *   `488281.0000000004`、"改首价"时少算 1 级）都出自"闭式 + 浮点/Decimal 幂"
 *   ⇒ 改成**逐级累加真价** ✓（`buyEpMult` 与 `ipDoubleCostFor` 都是这个做法）
 */
export function darkMatterCostFor(count, k) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const m = Math.max(0, Math.floor(Number(k) || 0));
  let sum = new Decimal(0);
  for (let i = 0; i < m; i++) sum = sum.add(darkMatterPriceAt(n + i));
  return sum;
}

/**
 * `count` 起、池子为 `pool` 时能**连续买几个**（"买满"用）。
 *
 * 实现 = 本项目认可的**解析上界 + 逐级核减**（`ipDoubleAffordableIn` 同款）：
 *   ① 上界：把序列当纯等比 ⇒ `costBase·r^(n+k) ≤ pool` ⇒ `k ≤ log_r(pool/costBase)`
 *      ⚠️ 该式**忽略 `−n`**（那只会让上界更大）⇒ 保证**只高估、不低估** ✓
 *   ② 逐级核减：用**真价**累加，超了就停 ⇒ 精确 ✓
 * 规模：`costMult` 每级 ×3~5 ⇒ 可买个数只有**几十**量级（不是 `epMult` 那种 5000 级）
 *   ⇒ O(k) 的逐级循环对"每帧 2 次"完全够用，**不需要** `epMult` 那套缓存 ✓
 */
export function darkMatterAffordableIn(count, poolDecimal) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const pool = poolDecimal instanceof Decimal ? poolDecimal : new Decimal(poolDecimal || 0);
  if (pool.lt(darkMatterPriceAt(n))) return 0;
  const { costBase, costMult } = DARK_MATTER;
  const rLog = Math.log10(costMult);
  const poolLog = pool.log10().toNumber();
  const kUB = Math.max(1, Math.ceil((poolLog - Math.log10(costBase)) / rLog) + 2);
  let sum = new Decimal(0);
  let k = 0;
  for (let i = 0; i < kUB; i++) {
    const price = darkMatterPriceAt(n + k);
    if (sum.add(price).gt(pool)) break;
    sum = sum.add(price);
    k++;
  }
  return k;
}
