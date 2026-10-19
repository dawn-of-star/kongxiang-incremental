/**
 * formulas/matter.js —— 物质系数 / 物质速率 / 爬升 / 过载 / 收手判据
 *
 * ★ 2026 模块化：由 1,116 行的 formulas.js 按领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/formulas.js`（barrel）导入。
 */
import { BASE, CLIMB, OVERLOAD, matterSpanMult, matterTotalExponent, voidBoostMult } from "../config.js";
import { D, kindProduct } from "./core.js";
import { globalMultiplier } from "./global.js";
import { zpeMultiplier } from "./zpe.js";
import Decimal from "../../dist/break_eternity.esm.js";

export function matterCoeff(state, particleCount = undefined) {
  const P = particleCount === undefined
    ? (state.resources?.particle ?? null)
    : particleCount;
  const mb = kindProduct(state, "matterMul");
  let zf = D(1);
  if (state.zpeMilestones.m3) {
    const factor = state.voidUpgrades.v9 ? 1.0 : 0.5;
    zf = D(1).add(zpeMultiplier(state).sub(1).mul(factor));
  }
  const v3 = state.voidUpgrades.v3 ? D(1.5).mul(voidBoostMult(state)) : D(1);
  const coeff = D(BASE.matterPerParticle)
    .mul(mb)
    .mul(globalMultiplier(state))
    .mul(zf)
    .mul(v3)
    // ★★ 2025 B8：**b区** —— 对 a区括号整体取幂，指数由引擎等级给
    .pow(matterTotalExponent(state))
    // ★ 跨度层在**指数之外**：它是"第二路产物质"（ZPE→DE→物质）的独立机制
    .mul(matterSpanMult(state));

  //   ⚠️ 过载的触发量是「**未经削减的速率**」= `particle × coeff`
  //      （若用削减后的速率去触发 → 自我引用 ⇒ 恒为 1 或来回抖 ✗）
  const preRate = P != null
    ? (P instanceof Decimal ? P : D(P)).mul(coeff)
    : null;
  return coeff.mul(overloadFactor(state, preRate)).mul(climbFactor(state));
}

/** 熵产出速率 */
export function matterRate(state) {
  // ══════════════════════════════════════════════════════════
  // ★★★ 2025：**改为唯一入口的直接调用** —— 不再在这里重算一遍基础产出
  // ══════════════════════════════════════════════════════════
  //   `dM/dt = particle × matterCoeff` ⇒ 这里就**只做这一次乘法** ✓
  //
  //   ⚠️ 为什么不再展开：本函数原来把 `base = particle × 每粒子各项 × …` **重算了一遍**，
  //      与 `matterCoeff` 那套"各算一遍"⇒ 项目因此踩过 **4 次「显示 ≠ 实发」**
  //      （最近一次：`v3` 少了 `voidBoostMult` ⇒ 差 2.09e6 ✗；再往前是沉潜蓄能 / dm4b / 铸币）
  //   ⚠️ 我第一版改错：写成 `total.mul(matterCoeff(state))` —— 而 `total` **已含粒子数**
  //      （它是速率），再乘「每粒子系数」⇒ 变成 `particle² × coeff`，量纲错 ✗
  //      （实测比值 8.18e17 = particle × 2.09e6）
  //
  //   过载 / 爬升的软上限**在 `matterCoeff` 内**（用户裁定：有且只影响获得速率）✓
  return state.resources.particle.mul(matterCoeff(state));
}

/**
 * 爬升形状因子（路线 1）：`2^(−(L − knee)/halvingOrders)`，L ≤ knee 时恒为 1。
 *
 * 为什么需要它：物质的末端增长是 `dM/dt = M·R(q)·ln10`，即 `d(log10 M)/dt = R(q)` ——
 * **斜率恒定 = 直线**。玩家看到的是"每 25 阶一样慢"的节拍器。
 * 这个因子让 R 随深度递减，整条线变成 `L = knee + D·log2(1 + ln2·R₀·t/D)`，即 **log 形**。
 *
 * ⚠️ 与 `overloadFactor` 的区别：过载**只在打破无限之后**生效（管"越过旧硬顶能推多深"），
 *    爬升形状**任何阶段都生效**（管"这段爬升长什么样"）。
 * ⚠️ 必须被 `matterRate` 和 `tick` 同时使用（SPEC「输出函数 == 运算函数」）。
 */
export function climbFactor(state) {
  const L = state.resources.matter.gt(0) ? state.resources.matter.log10() : D(0);
  if (L.lte(CLIMB.knee)) return D(1);
  const over = L.sub(CLIMB.knee).toNumber();
  if (!(over > 1e-9)) return D(1);              // 拐点死区，避免 log10/pow 往返误差
  // ★★★ 2025 同 `overloadFactor` 的修正：**等效斜率必须与 k 无关**。
  //   它也**在 a区 内**（`matterRate` 里与 overload 相乘，再整体被 `^k` 取幂）
  //   ⇒ 不补偿的话，k=13.86 时 `2^(−over×13.86/100)`：
  //       M=1000（over=975）⇒ 2^−135 ≈ 1e−41 ⇒ 同样是"产出为 0" ✗
  //   ⇒ 步长按 k 放大，使有效斜率恒为 `CLIMB.halvingOrders`（100 阶）✓
  const kExp = Number(matterTotalExponent(state));
  const kScale = Number.isFinite(kExp) && kExp > 1 ? kExp : 1;
  const effHalving = CLIMB.halvingOrders * kScale;
  // ★★ 同 `overloadFactor`：用 **`Decimal.pow`**（`Math.pow` 会在 number 域下溢成 0 ✗）
  return new Decimal(2).pow(-over / effHalving);
}

/**
 * ★★★ 2025（用户裁定）：**过载的触发条件是「基础物质获得速率 > 1.8e308」，不是物质数量**。
 *
 * ── 用户原话 ──
 *   「过载机制生效的时间应该在**基础物质获得速率大于 1.8e308** 时生效
 *     （**有且只影响获得速率**）」
 *
 * ── 为什么这样才自洽 ──
 *   物质是 Decimal（可到 1e9e15），**没有** 1.8e308 这个上限；
 *   而 `Number.MAX_VALUE = 1.8e308` 是**双精度的上限** —— 它卡的是"每秒获得多少"，
 *   也就是**速率**。所以过载的语义应当是「速率逼近双精度上限时开始收」，
 *   而不是「物质数量跨过某个深度」。旧实现用 `matter.log10() > 拐点` ⇒ 触发点与速率无关 ✗
 *
 * ── 「只影响获得速率」怎么保证 ──
 *   落点放在 `engine.js` 的 `matterCoeff()`（tick 积分用的系数）里 ⇒
 *     · 它只乘进 `dM/dt`，**不改物质存量、不改阈值、不改任何"数量"**
 *     · `matterRate` 也读同一个 `matterCoeff` ⇒ 显示与实发同源（不再各乘一次）✓
 *
 * @param {object} state
 * @param {Decimal|number} baseRate  **未**被过载/爬升削减的物质获得速率
 */
export function overloadFactor(state, baseRate) {
  if (!state.brokenInfinity) return D(1);      // 未打破：硬顶，不走软上限
  const rate = baseRate == null
    ? D(0)
    : (baseRate instanceof Decimal ? baseRate : D(baseRate));
  // ★★ 触发阈：双精度上限 `Number.MAX_VALUE = 1.8e308`（**速率**上限，不是数量上限）
  //
  //   ⚠️ **必须在对数域比较**：物质的获得速率是 Decimal，实测 168h 已达 **1e1943**
  //     ⇒ 若写 `OVERLOAD.rateThreshold.log10()`，那是 `(1.8e308).log10() = 308.25`（没问题）；
  //       但若写 `rate.toNumber()` 或对 rate 取 `Number(...)`，**1e1943 会溢出成 Infinity**，
  //       一切比较都失真 ✗（我第一版就踩了这个：阈值判定恒为"超阈"）
  //   ⇒ 用 `rate.log10()`（Decimal 的 log10 是安全的）与**预先算好的常数量级**比较 ✓
  const rateLog = rate.gt(0) ? rate.log10() : D(0);
  if (rateLog.lte(OVERLOAD.rateThresholdLog10)) return D(1);
  const over = rateLog.sub(OVERLOAD.rateThresholdLog10).toNumber();
  if (!(over > 1e-9)) return D(1);

  // ══════════════════════════════════════════════════════════
  // ★★★ 2025 二次重做（用户裁定方案 B）：**渐近式**
  // ══════════════════════════════════════════════════════════
  //  用户质疑：「虽然是仿照 AD 中复制器的增长削弱逻辑，但**为什么能变成负增长**呢？」
  //  ⇒ 完全正确。根因是可算的：
  //
  //    `rate = base × factor(over)`，令 `s = |d ln(factor)/d over|`
  //    则 `d ln(rate)/d ln(base) = 1/(1 − k·s)`（k = 引擎的 b区指数）
  //    ⇒ **硬约束 `k·s < 1`**；越界则速率随 base 上升而**下降** = 负增长 ✗
  //
  //    旧指数式 `factor = 1.2^(−over/2.63)` 配 `tierShift`
  //      ⇒ `s = (ln1.2/2.63)·(1 + 0.25·档数)` —— **随档数无上界增长**
  //      ⇒ 实测 over=5000 时 `s = 8.72`、`k·s = 120` ≫ 1 ⇒ 必然负增长 ✗
  //
  //    渐近式 `factor = 1/(1 + over/knee)^p`
  //      ⇒ `s = (p/knee)/(1 + over/knee)` —— **随 over 递减**（在 over=0 取最大 `p/knee`）
  //      ⇒ 只要 `p/knee < 1/k` 就**永远**不越界（与 over 无关）⇒ **结构性安全** ✓
  //        本配置：`p/knee = 1/8430 = 1.19e-4`，`k` 上限 26 ⇒ `k·s ≤ 0.0031` ≪ 1 ✓
  //
  //  ⚠️ 语义差别（这是"变少"与"变慢"的分界）：
  //    AD 的 `scaleFactor = 1.2 > 1` 乘在 **interval**（时间）上 ⇒ 只让**变慢**
  //    我们曾把 `1/1.2 < 1` 乘在 **rate** 上 ⇒ 会让**变少**（可净下降）
  //    渐近式把因子压成"有下界、极缓"的形状 ⇒ 速率与 base **同阶增长** ⇒ 回到了"变慢" ✓
  //
  //  `knee = 8430` 的依据：用户要求「推进到 1e308.25 不费更多时间」。
  //    实测该点（11.13h）`over = 443.7` 阶 ⇒ 要因子 ≈ 1 就得 `knee ≫ 443.7`；
  //    目标「最多慢 5%」（因子 ≥ 0.95）⇒ `knee ≥ 443.7 × 0.95/0.05 = 8430` ✓
  const p = OVERLOAD.p ?? 1;
  return new Decimal(1).div(new Decimal(1).add(over / OVERLOAD.knee).pow(p));
}

/**
 * ★ 2025：**"这一轮跑够了"的单一判据**（自动坍缩 / 模拟器 / 界面提示共用）。
 *
 * 为什么必须有它：判据原来是**硬编码 `overloadFactor(s) < 0.05`**，散落在
 *   `tools/stage-timing.mjs`（两处）等处。而 `0.05` 与过载强度是**强耦合**的：
 *   过载一旦放松（因子变小 / 步长变大 / 开累进），这个值就可能**永远到不了**
 *   ⇒ 自动坍缩永不触发 ⇒ 模拟与玩法一起卡死 ✗
 * ⇒ 阈值改放 `OVERLOAD.crunchBelow`（与过载参数同一个 config 对象），
 *   并由 `tools/overload-lab.mjs` 断言「在合理深度内一定可达」✓
 *
 * ⚠️ 未打破无限时**不适用**（那时是硬顶强制坍缩，见 `tick`）。
 */
export function shouldCrunch(state, baseRate = undefined) {
  if (!state?.brokenInfinity) return false;
  if (!state.resources?.matter?.gt(0)) return false;
  // ══════════════════════════════════════════════════════════
  // ★★★ 2025（用户裁定）：**收手判据改成「按本轮时间」**
  // ══════════════════════════════════════════════════════════
  //   为什么必须挪掉「按速率」这条：
  //     `k`（b区指数）直接放大 rate ⇒ 按 rate 收手时 k↑ ⇒ **更早收手** ⇒ 深度变浅
  //     ⇒ "k 越大 = 越快但收入越低"，方向反了 ✗（实测：k 每 +1 ⇒ 收手深度 −3646 阶）
  //   改成按时间后：k↑ ⇒ 同样时间内推进更深 ⇒ 深度↑ ⇒ 收入↑ ✓ **k 变成纯收益**
  //   ⇒ 这也让用户要的机制成立：「基于最快的一次无限时间」给量子加成
  //     （k↑ ⇒ 更快 ⇒ T_best 更小 ⇒ 加成更高 ⇒ 正反馈，但被"时间上限"钉住 ⇒ 不发散 ✓）
  //
  //   ⚠️ 旧的 rate 判据**保留为兜底**：万一时间上限到不了，仍能把轮次结束掉 ⇒ 不卡死。
  //
  //   ⚠️⚠️ **2026 实测：它根本不是「万一」—— 兜底才是实际生效的那条，而且它承重** ✗
  //     · 实测每次大坍缩 ≈ **35 秒**（< `runSeconds = 300`）
  //       ⇒ 触发的**一直是下面这条 rate 判据**；主判据（按时间）从没到过 ✗
  //       ⚠️ 注意口径：必须只算**破∞之后**那一段（破∞前 `!brokenInfinity` ⇒ 一次坍缩都没有）
  //     · 关掉兜底的实测代价（lab：`tools/dark-matter-lab.mjs --crunchbelow=off`）：
  //         每轮永恒 **5.46h → 10.72h**（破∞时刻几乎不变 4.38h）
  //         ⇒ 慢的**全在「破∞→永恒」那一段**（0.8h → 3.0h）✗
  //     ⇒ 所以**不能删它**（删了尾段没法玩）。
  //     · ⚠️ 但它**不是**"乘区型加成没效果"的元凶 —— A/B 实测：关掉它之后
  //       暗物质的**相对**收益反而**变小**（24.9% → 17.9%，因为基线变长）✗
  //       真正的原因是"落点在生产乘区"本身 ⇒ 见 `docs/DARK-MATTER.md` §3 三/四
  const limit = OVERLOAD.runSeconds;
  if (limit != null && Number.isFinite(limit)) {
    const elapsed = Number(state.runElapsed ?? 0) || 0;
    if (elapsed >= limit) return true;
  }
  // ── 兜底：旧的 rate 判据 ──
  const rate = baseRate !== undefined
    ? baseRate
    : matterRate(state);
  return overloadFactor(state, rate).lt(OVERLOAD.crunchBelow ?? 0.05);
}

/**
 * ZPE 产出速率。
 *
 * ★ 方案 1（用户选定）：**全局加成进两次**。
 *
 *   `zpeRate = 熵阱 × globalMult × globalMult × zpe基础 × prodMult × 惩罚`
 *                        └───────── globalMult² ─────────┘
 *
 * ── 为什么 ──
 *   量子涨落靠「ZPE 跨过门槛」触发，但实测 **ZPE 全程只涨 2.8 个数量级**
 *   （1e12.9 -> 1e15.6），而每次捕获门槛 ×20 = 1.301 个数量级
 *   -> 整局只能多捕 **4 对（8 量子）**，涨得太慢。
 *
 *   两条路对照测过：
 *     · 全局加成再进一次（**乘法**）  -> ZPE 涨 **6.3 阶**，8 对 / 16 量子  ✅
 *     · 暗能量 ×(1+log10 DE)（**对数**）-> ZPE 只涨 3.6 阶，5 对 / 10 量子  ❌
 *   乘法赢 —— 对数形式的加成传不到 ZPE 上（DE 涨得快，但 log 吃掉大部分）。
 *
 *   实测副作用（都是正向）：
 *     阶梯 1.76h -> 1.67h（仍在 1~2h 目标区间）
 *     暗能量 1e22 -> 1e36（ZPE 喂暗能量的自然结果，顺带缓解「暗能量太慢」）
 *
 * ⚠️ **它引入了一个正反馈环**：
 *     量子 ↑ -> 暗能量倍率 +q² -> globalMult ↑ -> zpeRate∝globalMult² ↑
 *           -> ZPE ↑ -> 更多量子 -> …
 *   在**当前步长（×20，整局 16 量子）下实测没有跑飞**。
 *   若将来把门槛步长调小（比如 ×2，可捕 ~21 对 / 42 量子），
 *   `q²` 会大一个量级 —— **必须重新验证环增益，不能想当然。**
 *
 * ── 用户预告 ──
 *   无限之后会解锁一个**重点加成虚空系统**的新系统，届时 ZPE / 量子的定位可能调整。
 *   在那之前保持现状。
 */
