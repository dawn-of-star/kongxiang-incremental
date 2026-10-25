import { TANGRAM_CHALLENGE_REWARDS } from "../../tangram.js";
/**
 * config/quantum/gates.js —— 量子门槛 / 捕获 / 量子加成（熵、暗能量、ZPE、IP）
 *
 * ★ 2026 模块化：由 740 行的 config/quantum.js 拆出（声明与注释逐字保留）。
 *    对外统一从 `src/config.js`（barrel）导入。
 */
import { tierQuantumStepMult } from "../infinity.js";
import { hasCollapse } from "../milestones.js";
import Decimal from "../../../dist/break_eternity.esm.js";
import { spaceDuMult } from "../../space.js";

/**
 * config/quantum.js —— 量子 / 粒子增幅 b / 跨度幂 k / 暗能量自增长 / 量子共振
 *
 * ⚠️ 本文件由 `src/config.js` 按领域机械拆分而来：**声明与注释逐字保留**。
 *    对外仍然统一从 `src/config.js`（barrel）导入 —— 不要直接改这里的 import 路径。
 *    依赖：base, infinity, milestones, zpe-engine, dark-energy ｜ Decimal
 */






export const QUANTUM = {
  /** 第一对量子的 ZPE 门槛 */
  zpeBaseCost: 1e10,
  /** 每捕获一对，下一对的门槛 ×这个数 */
  zpeCostGrowth: 10,
  /** ★ 用户新增的削弱：在 ×10 的基础上**再 ×2**（合起来每次 ×20） */
  zpeCostExtraNerf: 2,
  /**
   * ★★ 2025 新增：**捕获档位的累进因子**（过载新语义，用户裁定选项 C）
   *
   *   门槛(pairs) = base × step^pairs × **captureTierFactor^(pairs²/2)**
   *
   *   · `= 1` ⇒ **完全退化为原来的纯几何**（零回归 ✓，默认值就是 1）
   *   · `> 1` ⇒ 每捕获一对，下一次的门槛**步长本身被抬高** ⇒ 超几何增长
   *     ⇒ 实现设计稿行 12「**越靠后越难获取**」与 AD 复制器
   *     「每超一档 ⇒ 该档难度 ×固定因子」的累进语义（见 `quantumZpeRequirement` 的注释）
   *
   *   ⚠️ 它是**指数上的平方** ⇒ 对 late-game 影响极大，标定时必须**小步**调
   *     （1.001 这种量级就会在 pairs=100 时贡献 1.001^5000 ≈ 148 倍）。
   *   标定方法与实测表见 `tools/quantum-curve.mjs`；
   *   改完必须重跑 `tools/stage-timing.mjs`（它给出 48h 的 IP 落点）。
   */
  captureTierFactor: 1,
  /**
   * ★ 2025 备注：这里原来有 `growthRateMax: 0.147` / `growthRateHalf: 0.5` 两个常数，
   *   用来做「量子 → 指数成长速率 R」的饱和式。**R 已彻底删除**（见 docs/R-REPLACEMENT.md §12），
   *   所以这两个常数与它们的解释（"为什么是 0.147"）一并移除 ✓
   *   现在量子经 `√q` 影响两处：粒子增幅速率 `b`（`DE_SPAN.b0` 一族）与跨度幂 `k` ✓
   *   0.147 是按 `L = knee + D·log2(1 + ln2·R₀·t/D)` 反解出来的（t = 100 分钟）。
   *   想调就改这个数 + `CLIMB.halvingOrders`，然后跑 `tools/pace-model.mjs` 复算。
   */
  // ★★ 2025：`growthRateMax` / `growthRateHalf` **已删除**（R 退休）。
  //   原先"量子越多 R 越高、上限 0.147"的饱和式不再存在；
  //   量子改经 `√q` 影响 `b`（粒子增幅速率）与跨度幂 `k`。
  /** 达到上限一半时所需的量子数（越小越慷慨）。0.5 时阶梯段约 1.75 小时 */

  /** 每对给几个量子（用户设定：一对） */
  perPair: 2 };

/**
 * 爬升形状（路线 1）：让 `e25 → e308.25` 那段从直线变成 log 形。
 *
 *   `R_eff = R(q) · 2^(−(L − knee)/halvingOrders)`      （L ≤ knee 时恒为 1）
 *
 * knee = 25 = 量子层解锁点（`COLLAPSE.unlockMatter` 的对数）——
 * 所以 **e25 之前那 6 分钟完全不受影响**（那段由基础环决定，本来就不走量子项）。
 *
 * ⚠️ 2025：R 退休后，这段时长的旋钮改成 `DE_SPAN.b0` 与 `bMax`（粒子增幅速率）。
 *    参数表与定点断言见 `tools/pace-model.mjs`（--check / --sweep）。
 *    实测（_sim 沙盒，非本仓库）：直线 97.6 分钟 → log 形 105.1 分钟。
 */
export function quantumStepMult(state) {
  const flat = state.thresholdFlatBought ? 0.5 : 1;   // ×20 → ×10
  // ★ 量子里程碑 qm5：再 ×20 → ×18（= ×0.9），见 docs/QUANTUM-MILESTONES.md
  const qm = state.quantumMilestones?.qm5 ? 0.9 : 1;
  return tierQuantumStepMult(state) * flat * qm;
}

/** 每次捕获得到几个量子（涨落增幅：2 → 3） */
export function quantumPerPair(state) {
  const base = state.pairBoostBought ? 3 : QUANTUM.perPair;   // ★ cm6：每对 +1（见下一行）
  const raw = base + (hasCollapse(state, "cm6") ? 1 : 0);
  // ★★★ 2026（用户裁定）：**基于本次永恒完成的拼装挑战数量**，增幅**每对量子的实际数量** ✓
  //   每完成 1 个 ⇒ ×(1 + 0.10)；本次永恒内累计，永恒后归零 ✓
  //   ⚠️ 唯一入口仍是这里（tick.js:471 只读它）⇒ 显示与实发同源 ✓
  // ★★★ 2026（用户裁定，更激进）：**每完成 1 组（= 6 个挑战）⇒ 每对量子翻倍** ✓
  //   全清（36 个 = 6 组）⇒ ×2^6 = ×64，再叠一个"全清额外 ×2" ⇒ **×128** ✓
  //   基线每对 2 ⇒ 全清 **256 个量子/对** ✓（与用户口径一致 ✓）
  // ★★★ 2026（用户裁定，更激进）：**每完成 1 组（= 6 个挑战）⇒ 每对量子翻倍** ✓
  //   全清（36 个 = 6 组）⇒ ×2^6 = ×64，再叠一个"全清额外 ×2" ⇒ **×128** ✓
  //   基线每对 2 ⇒ 全清 **256 个量子/对** ✓（与用户口径一致 ✓）
  //   ⚠️ 倍率本身抽到 `quantumPairMult()`（面板要显示它 ⇒ 同源 ✓，不写第二遍 ✗）
  return raw * quantumPairMult(state) * spaceDuMult(state, "du3").toNumber();
}

/**
 * ★★★ 2026-10-22（用户：「实时数值得做」）—— **每对量子的倍率本身**
 *
 * 面板要显示"当前是几倍" ✓ ⇒ 拆出来，与 `quantumPerPair()` **同源**
 * （后者 = 裸值 × 本函数 ⇒ 显示 == 实发 ✓，不是第二条路 ✓）
 */
export function quantumPairMult(state) {
  const R = TANGRAM_CHALLENGE_REWARDS;
  const n = Math.max(0, Math.floor(Number(state?.tangramChallengeThisEternity ?? 0)));
  const groups = Math.floor(n / R.perTier);
  const allClearBonus = n >= R.perTier * 6 ? (R.quantumPairAllClearBonus ?? 2) : 1;
  return Math.pow(R.quantumPairDoublePerGroup ?? 2, groups) * allClearBonus;
}

/**
 * ★★ 2025：**`unspentBoost`（沉潜蓄能）已整个删除**（用户裁定 + `TODO.md` A 段早就列了它）
 *
 * 原效果：`a区产率 ×(1 + 未花无限点/2)`，硬封顶 ×1000。删除理由：
 *   · 它是 **IP → 产率** 的平行环（和铸币 / 坍缩加速器同一类），不推动物质形状；
 *   · 「未花无限点」这个口径与现在 **IP 主阶梯（量子铸币 q^1.75）** 的经济不匹配；
 *   · 它的 1.5 次方版曾经是 runaway 源（2025 改成线性才压住）——留着一个需要专门封顶的机制不值当。
 *
 * ⚠️ **历史教训必须留着**（项目规矩：踩过的坑写在注释里，它们是防回退的唯一记录）：
 *   它是「**显示 ≠ 实发**」的**第三例** —— 当时 `unspentBoostMult` 只加在
 *   `formulas.js` 的 `matterRate()` 里，而 `engine.js` 的 `matterCoeff()` 没有它
 *   ⇒ **界面显示有加成、引擎不发放** ✗
 *   前两例：铸币倍率只在界面生效；`dm4b` 只加在 `darkEnergyRate()` 里。
 *   ⇒ 现在的守卫：`tools/zpe-matter-lab.mjs --check` 有"物质系数 ≡ 显示产出/粒子"的等价断言，
 *     且 `matterCoeff()` 与 `matterRate()` **逐项同源**。
 */

export function quantumZpeRequirement(pairs, lubeMult = 1, state = null) {
  const n = pairs instanceof Decimal ? pairs : new Decimal(pairs ?? 0);
  // 用户设定的「再 ×2」并进底数：10 × 2 = 20；lubeMult 是「量子润滑」的缓和倍率
  const step = new Decimal((state && hasCollapse(state, "cm7") ? 22 : QUANTUM.zpeCostGrowth)).mul(QUANTUM.zpeCostExtraNerf ?? 1).mul(lubeMult);
  let base = new Decimal((state && hasCollapse(state, "cm7") ? 1e8 : QUANTUM.zpeBaseCost)).mul(Decimal.pow(step, n));

  // ══════════════════════════════════════════════════════════
  // ★★ 2025：**过载新语义 —— 「阈值本身被抬高」**（用户裁定，选项 C）
  // ══════════════════════════════════════════════════════════
  // 用户的原话与依据：「过载机制，应该是**类似 AD 中复制器的增长阈值**」。
  //   AD 原文（`src/core/replicanti.js`）：
  //     increases = (amount.log10() − cap.log10()) / ReplicantiGrowth.scaleLog10
  //     interval  = interval × scaleFactor ^ increases
  //   ⇒ AD 是「**每超一个固定 OoM 步长 ⇒ 该档难度 ×固定因子**」，是**按档累进**的语义，
  //     而不是单纯的连续速率惩罚。
  //
  // 我们的落地：把累进放在**捕获门槛**上（对应设计稿行 12
  //   「重新优化量子的获得公式，这将使其前期获得更多的量子（**越靠后越难获取**）」）——
  //   每捕获一对，**下一次的门槛步长本身**就被抬高一点 ⇒ 门槛成为**超几何**：
  //       门槛(pairs) = base × step^pairs × F^(pairs²/2)
  //   等价写法 `F^(pairs²)`（常数折进 F）。为什么用 `pairs²` 而不是 `pairs`：
  //     · `pairs` 只是把几何的底数调大（= 改 step），**没有"档"的概念** ✗
  //     · `pairs²` 让**每一档都比上一档更陡** ⇒ 这才是"阈值本身被抬高" ✓
  //
  // ⚠️ 标定：`QUANTUM.captureTierFactor = 1` 时**完全退化为原来的纯几何**（零回归 ✓）。
  //    实测标定表见 `tools/quantum-curve.mjs`；调它之后必须重跑 `tools/stage-timing.mjs`。
  const F = QUANTUM.captureTierFactor ?? 1;
  if (F > 1) {
    // pairs² / 2 —— Decimal 的指数走 log10，避免大数下溢
    const exp = n.mul(n).div(2);
    if (exp.gt(0)) base = base.mul(Decimal.pow(F, exp));
  }
  return base;
}

/**
 * 量子 → **熵生产的最终倍率**（**c区**的一个成员）。
 *
 * 形式 `1 + q`：线性，基于当前持有的量子量。
 * 它本身无界，但**量子会被大坍缩重置**，所以单周期内 q 有上限，不跨周期膨胀。
 *
 * ⚠️ 两个实现事实（改这一条之前先看）：
 *   · 它是**目前唯一**的 c区成员 —— c区靠描述里的「最终」二字登记，
 *     所以界面上这一条写的是「最终倍率」（index.html 的量子面板）。
 *   · 它乘的是**本 tick 的增量**（entropyRate 的乘法链里一环），
 *     不是 `{存量 + 增量}`。熵这一层两种写法等价（熵进来就被阈值转换扣空），
 *     但**别的层若要用 c区，先回 config.js 顶部第 ③ 条定死语义**。
 */
/** ★ 同上：`bonus` = 引擎账（可选第二参）。见 `quantumZpeMultBonus` 的说明。 */
export function quantumEntropyMultiplier(quantum, bonus = null) {
  const q = quantum instanceof Decimal ? quantum : new Decimal(quantum ?? 0);
  const v = q.lte(0) ? new Decimal(1) : q.add(1);
  return bonus ? v.mul(bonus) : v;
}

/**
 * 量子 → **暗能量倍率的「基础加成」**（a区）。
 *
 * 用户定义：**当前持有的量子量 ²**，作为加进基础的加成。
 *     `暗能量倍率 = (1 + 0.25·log2(暗能量)) + q²`
 *
 * 注意返回的是**加成量**（加到括号里），不是倍率 —— 所以 q=0 时返回 0。
 * 给平方的理由：量子量本身很小（一轮几十个），平方后才有量级感。
 */
/** ★ 同上：`bonus` = 引擎账（可选第二参）。见 `quantumZpeMultBonus` 的说明。 */
export function quantumDeMultBonus(quantum, bonus = null) {
  const q = quantum instanceof Decimal ? quantum : new Decimal(quantum ?? 0);
  if (q.lte(0)) return new Decimal(0);
  const v = q.mul(q);
  return bonus ? v.mul(bonus) : v;
}

/**
 * 量子 → **暗能量获取的「基础加成」**（a区）。
 *
 * 用户定义：**当前持有的量子量取对数**，作为加进基础的加成。
 *     `每次转换量 = 高效相变 × 1.25^... × [1 + log10(q)]`
 *
 * 对数让它天然温和：量子从 10 涨到 1000（100 倍），加成只从 1 涨到 3。
 * 返回的是**加成量**，所以 q≤1 时返回 0。
 */
/** ★ 同上：`bonus` = 引擎账（可选第二参）。见 `quantumZpeMultBonus` 的说明。 */
export function quantumDeGainBonus(quantum, bonus = null) {
  const q = quantum instanceof Decimal ? quantum : new Decimal(quantum ?? 0);
  if (q.lte(1)) return new Decimal(0);
  const v = q.log10();
  return bonus ? v.mul(bonus) : v;
}


// （旧函数 `quantumGain(matterLog10)` 已删除：量子改为按阈值累积，
//   见上方 `quantumGainForCollapse` / `quantumGainForCrunch`。）



/** 汇总已购量子升级的效果 */

// ══════════════════════════════════════════════════════════
// ★ 跨度层（2025 用户方案）：暗能量把物质"撬"到 inf
// ══════════════════════════════════════════════════════════
/**
 * 用户定的形状（docs/R-REPLACEMENT.md）：
 *
 * ```
 * ① 暗能量以 a(DE) 指数增长，跨到 1e50（软上限）
 * ② 量子给"幂"：k = min(1 + c·√q, 6.1651)
 * ③ 物质产出 ×= (DE / DE₀)^k   ⇒  DE 到 1e50 时物质撞 1e308（inf）
 * ```
 *
 * `kMax = 6.1651 = log10(1e308.2547) / 50` —— 把暗能量的 50 阶放大到 308.25 阶。
 * **封顶是必需的**：不封顶时 q=150 会给出 k≈7.33 ⇒ 物质**早于** DE 到顶、软上限形同虚设。
 *
 * 安全性（b区解禁的依据）：这个幂只作用在**环的输出侧**（ZPE→DE→物质），
 * 不参与「熵阱 ↔ ZPE」那个环 ⇒ S 判据不受影响。
 * ⚠️ 千万不要把它接回 ZPE / 熵阱 / 全局加成 —— 那会重现"环增益 Q²、物质一次跳无限"的旧问题。
 */
/**
 * ★ 量子里程碑（2025 草案；7 条）
 *
 * 键在**累计量子对数**上（`quantumPairsTotal`，大坍缩不清零）——
 * 当前量子数每轮归零，键在它上面会形同虚设（见 docs/QUANTUM-MILESTONES.md §0）。
 * **永恒会把它们全部清除**（用户指定：与"除梦想系统外一切重置"一致）。
 *
 * 效果分两类：`kind: "b"` 给粒子增幅速率乘算加成；`kind: "a"` 给引擎段（`a(DE)`）；
 * `kind: "gate"` 改量子门槛步长；`kind: "k"` 给跨度幂。`qm2` 是"开启档位加速"的开关。
 */
export function qOf(state) {
  return state.quantumFrozen ?? state.quantum ?? new Decimal(0);
}

/**
 * ★ 2025 设计稿修订：**量子对 ZPE 倍率的加成**（加法区）。
 *
 * 形制照抄 `darkEnergyMultiplier` 里的 `+q²`（同一个"量子作为基础加成加进括号里"的先例 ✓）
 * ⇒ 走**加法区**，相对漂移极小 ⇒ 不破坏"显示 == 实发" ✓
 *
 * ⚠️ **数值待定**（用户：得算数据）—— 现在给三种候选，用 `--q` 参数切换：
 *   "2"  ⇒ `+q²`   （与暗能量倍率同款：起步猛、后期被引擎的 2^等级 盖过）
 *   "3"  ⇒ `+q³`   （中后期也有存在感）
 *   "exp"⇒ `×2^q`  （指数，后期极强 ✗ 有失控风险，**不推荐**）
 */
export const QUANTUM_ZPE_MODE = "3";   // ★ 用户 2025 选定 +q³（后续会有额外加成弥补，画饼 ✓）
/**
 * ★ `q³` 的**系数**（数学公式拉表得出，见 `tools/quantum-zpe-coeff-lab.mjs`）。
 *
 * 判据：① q≈4（首次大坍缩附近）给 ZPE 倍率 ×2~×4 的观感
 *       ② q≈30（常规一轮）等效 8~12 级引擎（`log2(c·q³)`）
 * 反解：① ⇒ c ∈ [0.0743, 0.2229]；② ⇒ c ∈ [0.0095, 0.1517]
 *       ⇒ 交集 [0.0743, 0.1517] ⇒ 几何中点 0.106 ⇒ **圆整 0.1** ✓
 * 等价说法：量子项 ≈ 一个 `3·log2(q) − 3.3` 级的 ZPE 引擎 ✓
 * ⚠️ 斜率天然陡（q×10 ⇒ 项×1000）⇒ 系数必须小 ✓
 */
export const QUANTUM_ZPE_COEFF = 0.1;

/**
 * ★★★ 2025：`bonus` = 引擎账（`engineBonusMult(state)`）——**可选第二参**。
 *
 *   ── 为什么要有它（否则"显示 ≠ 实发"）──
 *     用户裁定：量子给的 5 条加成**全部**要吃引擎倍率（`engineBonusMult`）。
 *     我第一版把它乘在 `formulas.js` 的**调用处**（为了不动 `audit.mjs` 的老断言）✗
 *     后果（实测）：**量子面板显示 +21600，而实发 +1e36**（差 1e31.7 ✗✗）
 *   ⇒ 修法：**账乘在函数体内**，显示与实发**共用这一个函数** ✓
 *     面板调用时同样传 `engineBonusMult(state)` ⇒ 显示 == 实发 ✓
 *
 *   ⚠️ 不传 `bonus` ⇒ 退化为"纯量子给的部分"（老断言 `quantumDeMultBonus(q)===10000`
 *      因此仍然成立 ✓；也方便 lab 单独测量子那一层）
 */
export function quantumZpeMultBonus(quantum, bonus = null) {
  const q = quantum instanceof Decimal ? quantum : new Decimal(quantum ?? 0);
  if (q.lte(0)) return new Decimal(0);
  let v;
  if (QUANTUM_ZPE_MODE === "exp") v = new Decimal(2).pow(q).sub(1);
  else if (QUANTUM_ZPE_MODE === "3") v = q.pow(3).mul(QUANTUM_ZPE_COEFF);
  else v = q.pow(2);
  return bonus ? v.mul(bonus) : v;
}

/** 跨度幂 k：由**量子个数**的开根给出，封顶 `DE_SPAN.kMax` */