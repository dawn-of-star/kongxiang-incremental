/**
 * engine/tick.js —— 时间推进：tick / 离线闭式解 advance
 *
 * ★ 2026 模块化：由 1,660 行的 engine.js 按动作领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/engine.js`（barrel）导入。
 */
import { autoAcquire, autoAcquireDream } from "./actions.js";
import { maybeAutoCrunch } from "../autocrunch.js";
import { doBigCrunch } from "./collapse.js";
import { BASE, COLLAPSE, DE_EFF_CAP, INFINITY_UPGRADES, crunchThreshold, deEngineLevelBonus, deGrowthRate, hasEternityMilestone, ipDoubleMult, markPageUnlocked, quantumPerPair, quantumStepMult, quantumZpeRequirement, zpeEngineLevel, zpeEngineUnlocked } from "../config.js";
import { sci } from "../format.js";
import { D, bigCrunchGain, checkDeMilestones, checkQuantumMilestones, checkZpeMilestones, collapseUnlocked, conversion, darkEnergyRate, entropyRate, floorDiv, matterCoeff, particleTimeBoost, zpeRate } from "../formulas.js";
import { unlockZpeEngine } from "./purchases.js";
import { awardDream, isQuantumLogLevel, pushLog } from "../state.js";
import { applyTangramPassiveIp } from "../tangram-passive.js";
import Decimal from "../../dist/break_eternity.esm.js";

/**
 * engine.js —— 推进与动作
 *
 * 两块内容：
 *   1. tick / advance —— 时间推进（含离线闭式解）
 *   2. 各种购买动作
 *
 * ── 为什么 tick 能用闭式解 ──
 *
 * 关键观察：**粒子产出速率不依赖粒子数或物质数**。
 *   dP/dt = particleRate(state)          ← 只依赖 等级/ZPE/暗能量
 *   dM/dt = particle × matterCoeff(state) ← 对 P 是线性的
 *
 * 所以在一个时间片内（系数视为常数）可以精确积分：
 *   P(t) = P0 + c·t
 *   M(t) = M0 + k·(P0·t + c·t²/2)
 *
 * 这比逐 tick 模拟快无数倍，也是 SPEC §5.2 要求的。
 */


// ★★★ 2026：自动无限（独立模块，tick 里调 maybeAutoCrunch）✓

// ★★★ 2026：七巧板「每秒 1% 本次无限 IP」（AD TS181 同款）✓

// ★★★ 2026：梦想自动化的**效果侧**（自动买满 + 永恒保留）✓

// ★★★ 2025（用户裁定）：统一的科学计数法 `1.00e308`（`sci()`）
//   ⚠️ 从 `./format.js` 取，**不能**从 `./ui.js` 取 —— `ui.js` 已 import 本文件，
//      反向 import 会成循环依赖 ✗（见 format.js 的头注）




// ══════════════════════════════════════════════════════════
// 系数（供闭式解用）
// ══════════════════════════════════════════════════════════
// ★★★ 2025：`matterCoeff` **已搬到 `formulas.js`**（唯一入口）——
//   它原来在这里、而 `matterRate()` 在 formulas.js 里各算一遍基础产出
//   ⇒ 项目因此踩过 **4 次「显示 ≠ 实发」**（最近一次：`v3` 少了 `voidBoostMult` ⇒ 差 2.09e6 ✗）
//   ⇒ 现在两边共用同一个函数，结构上不可能再分叉 ✓
//   ⚠️ 这里**重新导出**它以保持既有调用方（`tools/zpe-matter-lab.mjs` 等）不受影响 ✓

// ══════════════════════════════════════════════════════════
// 单步推进
// ══════════════════════════════════════════════════════════

/**
 * 推进 dt 秒。
 *
 * @param {object} state
 * @param {number} dt  秒。调用方负责分段（见 advance）
 */
export function tick(state, dt) {
  if (!(dt > 0) || !Number.isFinite(dt)) return state;

  // ★★ 2025「步首快照」（**用户点破本质之后**才放对位置）：
  //
  //   本质：**量子是阶梯函数**（每捕获一次跳 +2），而引擎的公式全假设一切平滑 ✗
  //     ⇒ 离散跳变量被塞进"连续积分"的速率里 ⇒ 显示（步首值）与实发（整步）必然分叉 ✗
  //       实测：`consistency` 报物质偏 ~100% ✗
  //
  //   修法（按用户的描述）：**让阶梯的取值固定在这一步的开头** ✓
  //     · tick **开头**设快照 ⇒ 本 tick 的所有速率都读它 ✓
  //     · 显示是 tick **之前**算的，读的正是同一个 `state.quantum` ⇒ 一致 ✓✓
  //     · 捕获照旧在 tick **末尾**原子写回 ⇒ 下一步的快照自然变新值 ✓
  //
  //   ⚠️ 我前三次都错了：① 快照放在 `advance`（该测试**直接调 tick**，走不到 ✗）
  //      ②③ 去搬动**捕获**的时序（该动的是**读取**，不是捕获 ✗）
  state.quantumFrozen = state.quantum;
  try {
    return tickBody(state, dt);
  } finally {
    delete state.quantumFrozen;
  }
}

/** tick 的主体（拆出来只为把「步首快照」用 try/finally 包住 ✓） */
/** 计时：本轮时长 / 本次无限时长 / ④ 无限长河的实时产点。 */
function applyTimedIncome(state, dt) {
  // ★ ∞ 层 ④「无限长河」的计量口径：本次无限已经过去了多少秒。
  //   用 dt 累加而不是读 wall clock —— 离线结算（advance）走的是同一个 tick，
  //   所以挂机 4 小时回来，这段时间也会被如实计入。
  state.infinityElapsed = (state.infinityElapsed ?? 0) + dt;

  // ★★★ 2025（用户裁定）：**本轮时长** `runElapsed` —— 收手判据用它（按时间收手）。
  //   ⚠️ 不能复用 `infinityElapsed`：那个被「无限长河」的 30 分钟上限**截断**过
  //      （见上面 `cap` 那几行）⇒ 用它当收手判据会失真 ✗
  state.runElapsed = (state.runElapsed ?? 0) + dt;

  // ★ ④ 是**实时**产点的（对齐 AD 的 ipGen：被动产点，不是结算时一次性给）。
  //   每帧按 `1/60 × 3^①等级` 进账，但**只计本次无限的前 30 分钟** ——
  //   和改之前的总量完全一致（`min(耗时, 1800) ÷ 60 × 3^①`），只是拆成每帧发。
  //   好处：挂机时点就在账上，不必等大坍缩；"单次 30 分钟"变成屏幕上的实时数字。
  if (state.ipTimeBought) {
    const cap = INFINITY_UPGRADES.ipTime.capSeconds ?? Infinity;
    const before = Math.min(state.infinityElapsed - dt, cap);   // 本帧之前的可计时长
    const after = Math.min(state.infinityElapsed, cap);         // 本帧之后
    if (after > before) {
      const gain = D(after - before)
        .div(INFINITY_UPGRADES.ipTime.secondsPerPoint)
        .mul(ipDoubleMult(state));
    state.infinityPoints = state.infinityPoints.add(gain);
      // 本次无限"实时累计了多少"（仅供日志与界面显示；上限 = 30 分钟那笔）
    // ★ 数值约定 #3：别再 toNumber ✗（IP 累加量会超过 1.8e308）
  state.ipTimeAccrued = (state.ipTimeAccrued instanceof Decimal ? state.ipTimeAccrued : D(state.ipTimeAccrued ?? 0)).add(gain);
    }
  }
}

/** 第 1 阶段：熵产出 → 按阈值转成粒子（返回本片起始粒子数与本片粒子增量）。 */
function advanceEntropyToParticle(state, dt) {
  const P0 = state.resources.particle;

  // ── 1. 熵产出，然后转成粒子 ──
  const eGain = entropyRate(state).mul(dt);
  let entropy = state.resources.entropy.add(eGain);
  const { threshold, output } = conversion(state);

  let particleGain = D(0);
  if (entropy.gte(threshold)) {
    // ★ 原稿是 while (entropy >= threshold) 逐次扣减 —— 后期一 tick 转几万次会卡死。
    //   改成除法一次算完，O(1)。
    //   （原来这里有一个旧量子升级「余量回收」的分支，整套系统已删除。）
    //
    // ⚠️ 必须用 floorDiv，不能写 `entropy.div(threshold).floor()`：
    //    Decimal 的 div 只有 ~15 位有效数字，商会被四舍五入抬到整数上，
    //    floor 就多一格，余量变成负数（实测「余 -0.001953125」）。
    //    见 formulas.js 的 floorDiv 注释。
    const times = floorDiv(entropy, threshold);
    entropy = entropy.sub(times.mul(threshold));
    // 兜底：即使 floorDiv 后仍有极小的负余量，也不许存负数
    if (entropy.lt(0)) entropy = D(0);
    particleGain = times.mul(output);
  }
  // ★ 量子 → 粒子获得的**时变增幅**（替代 R 的那个杠杆；2025 用户方案）
  //
  //   `粒子获得 ×= g(t)`，`g = 10^(b·**本轮已过时间**)` —— 用户选甲：时间每轮重置，
  //   否则堆叠会让时间失去意义（第二次大坍缩起瞬间到顶）。
  //   ⚠️ `g` **必须随时间增长**：常数倍率只平移高度，到不了 1e308
  //      （这正是当年 perPair=200 也跨不到顶的原因）。
  //   ⚠️ 粒子在**环外**（`effectiveTraps` 不读粒子）⇒ 不进环，S 判据安全。
  //   ⚠️ 与 `formulas.js` 的 `particleRate()` **必须同项**（显示 == 实发）。
  particleGain = particleGain.mul(particleTimeBoost(state));
  state.resources.entropy = entropy;
  state.stats.totalEntropy = state.stats.totalEntropy.add(eGain);

  return { P0, particleGain };
}

/** 第 2 阶段：粒子 & 物质（闭式解；过载/爬升已含在 matterCoeff 里）。 */
function advanceParticleToMatter(state, dt, P0, particleGain) {
  // ── 2. 粒子 & 物质（闭式解 + 量子的指数项）──
  // ★★ 2025：传入**本片的粒子数** `P0` —— 过载的触发量是「未削减的速率」`P0 × coeff`，
  //   而 `matterCoeff` 需要它才能算出这个速率（`state.resources.particle` 此刻还是旧值）。
  const k = matterCoeff(state, P0);
  const c = particleGain.div(dt); // 本片的等效粒子速率
  state.resources.particle = P0.add(particleGain);

  let matterGain = k.mul(P0.mul(dt).add(c.mul((dt * dt) / 2)));

  // ★ 旧「量子 → 指数成长速率 R」那一项**已删除**（2025 用户决定：取消 R 机制）。
  //
  //   它原本是 `dM/dt += M·R·ln10`，让物质在时间里指数增长（`d(log10 M)/dt = R`）。
  //   取消的理由：R 是**速率常数**，只能改速度、改不了形状 ⇒ 可玩性窄（见 PROGRESSION.md §0.6）。
  //   替代：**粒子获得的时变增幅**（上面的 `particleTimeBoost`）——
  //   同样给"时间里指数增长"，但落在**粒子线**上，而且增幅本身随里程碑与档位成长 ✓
  // ★★ 2025：R（量子给的指数成长速率）**已彻底删除**。物质不再有 `M·R·ln10` 那一项。
  //   承重机制改为两层：
  //     · 引擎之前：**粒子获得的时变增幅**（`particleTimeBoost`，见上）
  //     · 引擎之后：**暗能量自增长 a(DE) → 跨度层 (DE/DE₀)^k**
  //   实测删 R 后物质**仍能撞到 1e308**（第一次大坍缩 10.52h，×1.75 目标 13.39h）✓

  // ★★ 2025：**过载 / 爬升不在这里乘** —— 它们已经含在 `matterCoeff(state, P0)` 里
  //   （用户裁定「有且只影响获得速率」⇒ 落点在系数上，唯一入口）。
  //   ⚠️ 踩过：这里原来又乘了一次 `overloadFactor` / `climbFactor` ⇒ **平方** ⇒
  //      `consistency.mjs` 报「matterRate 误差 2.32%」✗
  //   ⇒ 现在 `matterGain = k × (闭式积分项)`，衰减只出现一次 ✓

  state.resources.matter = state.resources.matter.add(matterGain);
}

/** 第 3 阶段：ZPE 产出。 */
function advanceZpe(state, dt) {
  // ── 3. ZPE ──
  const zGain = zpeRate(state).mul(dt);
  state.zpe = state.zpe.add(zGain);
  state.zpeTotal = state.zpeTotal.add(zGain);
}

/** 第 4 阶段：暗能量（相变仪 + 自增长 + 每帧非有限值净化）。 */
function advanceDarkEnergy(state, dt) {
  // ── 4. 暗能量（相变仪解锁后）──
  //
  // ★ 唯一入口原则：这里**必须**调用 darkEnergyRate()，
  //   也就是界面显示的那个函数。不允许在引擎里重算一遍。
  //
  //   踩过：dm4b 最初只加进 darkEnergyRate()，而引擎用 zpeAccumulator
  //   自己算（走 darkEnergyGainPerConversion）—— 于是效果变成死代码：
  //   界面数字变了、实际产出一点没变。玩家反馈「还是涨不动」。
  //
  //   顺带修掉一个精度问题：老的累加器用 `floor(acc/1e8)` 量化，
  //   dt 大时会丢掉余数；直接乘 dt 是连续的，更准。
  if (state.phaseTransmuterUnlocked) {
    const deGain = darkEnergyRate(state).mul(dt);
    state.darkEnergy = state.darkEnergy.add(deGain);
    state.darkEnergyTotal = state.darkEnergyTotal.add(deGain);
  }

  // ── 4b. ★ 暗能量的**自增长**（替代 R 的那一位；2025 用户方案）──
  //
  //   `dDE/dt = a(DE)·DE` ⇒ `d(log10 DE)/dt = a(DE)` —— 暗能量在**时间里指数增长**，
  //   只需跨 50 阶就能靠跨度层把物质撬到 1e308（`1e50^6.1651 = 1e308`）。
  //
  //   ⚠️ 用户选定的开关（方案 B，符合直觉）：**必须先解锁 ZPE 引擎**才开启。
  //
  //   ★★ 2025「开根削弱」（用户方案，专治破∞→永恒那段 runaway ✗）：
  //      原来等级给的是**线性**倍率 `1 + 0.1×等级` ✗
  //      ⇒ 与 IP 深度复利 `IP ≈ 10^(0.035·x)`、跨度层 `DE^k` 乘在一起后，
  //        `dx/dt ∝ x`（x = 超出上限的阶数 ⇒ 物质的 log 本身指数爆炸 ✗，
  //        等级 1021 时 log 翻倍时间只有 18 秒 ✗，见 tools/post-break-runaway-lab.mjs）
  //      ⇒ 改成 **开根**：`1 + 0.1×√等级` ✓
  //        数学效果：`dx/dt ∝ √x` ⇒ `x ∝ t²`（**多项式**，不是指数 ✗）
  //        ⇒ 越到后期越自我减速 ✓（等级 1021 时倍率从 ×103 降到 ×4.2 ✓）
if (state.zpeEngineUnlocked) {
  const lv = zpeEngineLevel(state).toNumber();
  const engineMult = deEngineLevelBonus(lv);
  // 2026: a must be a finite non-negative number (a Number leaking in would make DE Infinity).
  let a = deGrowthRate(state, engineMult);
  if (!Number.isFinite(a) || a < 0) a = 0;
  // 2026: dDE/dt is proportional to DE, so clamp the per-frame dt to 1s --
  // a background tab can deliver a multi-thousand-second catch-up tick that jumps DE past the limit.
  const _dtS = Math.min(Math.max(0, dt), 1);
  // 2026: the DE_EFF_CAP soft cap is applied to the growth rate so it converges instead of exploding.
  const _dlg = state.darkEnergy.lte(0) ? 0 : state.darkEnergy.log10().toNumber();
  const _cap = DE_EFF_CAP;
  const _capDecay = _dlg <= _cap.kneeLog10 ? 1 : Math.pow(2, -(_dlg - _cap.kneeLog10) / _cap.span);
  const deSelf = state.darkEnergy.max(1).mul(a).mul(Math.LN10).mul(_dtS).mul(_capDecay);
  state.darkEnergy = state.darkEnergy.add(deSelf);
  state.darkEnergy = state.darkEnergy.max(0);
  // 2026: per-frame sanitiser -- any resource that turns non-finite is clamped back to 1e308
  // so the UI can never render the infinity glyph (README convention #4: infinity = fatal error).
  {
    const LIMIT = D("1e308");
    for (const k of ["darkEnergy", "zpe", "infinityPoints", "eternityPoints", "quantum", "matter", "entropy", "particles"]) {
      const v = state[k];
      if (v && typeof v.isFinite === "function" && !v.isFinite()) {
        state[k] = LIMIT;
        globalThis.__KI_INF_SEEN ??= {};
        if (!globalThis.__KI_INF_SEEN[k]) {
          globalThis.__KI_INF_SEEN[k] = true;
          // ★ 2026：**带栈**——只在第一次时打印调用栈，直接指认"是谁把它推成 ∞ 的" ✓
          if (!globalThis.__KI_INF_TRACED) {
            globalThis.__KI_INF_TRACED = true;
            console.error("[inf-sanitise] state." + k + " became non-finite; clamped to 1e308. Stack:", new Error("infinity-source").stack);
          } else {
            console.error("[inf-sanitise] state." + k + " was non-finite; clamped to 1e308");
          }
        }
      }
    }
  }
  if (String(state.darkEnergy).includes("NaN")) state.darkEnergy = D(1);
  state.darkEnergyTotal = state.darkEnergyTotal.add(deSelf);
  }
}

/** 第 4c 阶段：第一台相变仪速率的 log10 快照（暗物质机制的输入）。 */
function snapshotTransmuterRate(state) {
  // ── 4c. ★★ 2026：**第一台相变仪速率的快照**（暗物质机制的输入）──
  //
  //   为什么必须存快照、不能现算（完整理由见 `state.js` 的 `v1Log10` 字段说明）：
  //     `darkEnergyMultiplier` 需要 `v2 = v1^0.01`，而 `v1 = darkEnergyRate()`
  //     ⇒ 现算会成**环**：`darkEnergyRate → effectiveDarkEnergyGain
  //        → darkEnergyGainPerConversion → (买了 dm5) → darkEnergyMultiplier → v2 → darkEnergyRate` ✗
  //     （换用 `zpeRate` 当输入**同样**成环 —— 它经 `globalMultiplier` 又回到 `darkEnergyMultiplier` ✗）
  //   ⇒ 在这里（本帧的暗能量都算完之后）写一次，供**下一帧**的 `darkEnergyMultiplier` 读 ✓
  //      与 `zpeFixedMultiplier` 是同一个"快照"手法 ✓
  //
  //   ⚠️ 存 **log10**：`Decimal.toNumber()` 在巨量时是 `Infinity`，而 `v1^0.01` 只需要 log10 ✓
  //   ⚠️ 相变仪未解锁时 `darkEnergyRate()` 返回 0 ⇒ `log10(0) = -Infinity`
  //      ⇒ 夹成 `-323`（≈ double 最小正规数）；那时效率本就 ≈0 ⇒ 转化值恒 1 ✓
  {
    const v1 = state.phaseTransmuterUnlocked ? darkEnergyRate(state) : D(0);
    const lg = v1.gt(0) ? v1.log10().toNumber() : -323;
    state.v1Log10 = Number.isFinite(lg) ? lg : -323;
  }
}

/** 第 5 阶段：ZPE / 量子 / 暗能量里程碑（含 dm0 解锁相变仪）。 */
function checkMilestones(state) {
  // ── 5. 里程碑 ──
  for (const m of checkZpeMilestones(state)) {
    pushLog(state, `🏆 达成虚空里程碑：${m.desc}`);
    awardDream(state, `zpeMs:${m.id}`, m.desc);
  }
  // ★★ 2025 补：**量子里程碑的检查从来没被调用过** ✗✗
  //   ⇒ qm1~qm7 在真实引擎里全是死的（b 的加成、档位加速、qm4/qm5/qm7 全不生效）
  //   ⇒ 教训：单元级断言（直接调 `checkQuantumMilestones`）**抓不到"没接线"** ✗
  //     已补一条**集成级**断言（见 tools/stage-timing.mjs 的里程碑检查）
  for (const m of checkQuantumMilestones(state)) {
    pushLog(state, `🏆 达成量子里程碑：${m.desc}`);
    awardDream(state, `qm:${m.id}`, m.desc);
  }
  for (const m of checkDeMilestones(state)) {
    pushLog(state, `🏆 达成暗能量里程碑：${m.desc}`);
    awardDream(state, `deMs:${m.id}`, m.desc);
    if (m.id === "dm0") {
      state.phaseTransmuterUnlocked = true;
      markPageUnlocked(state, "de");         // ★ 永久解锁记录（永恒后不再上锁）
      pushLog(state, "🌌 相变仪已解锁！");
    }
  }
}

/** 第 6 阶段：历史最高物质 + 量子页面永久解锁。 */
function updatePeakMatterAndPages(state) {
  // ── 6. 历史最高物质（第四层解锁条件 + 坍缩进度）──
  if (state.resources.matter.gt(state.peakMatter)) {
    state.peakMatter = state.resources.matter;
  }
  // ★★ 2025：物质首次摸到 1e25 ⇒ 「量子」页面永久解锁（**独立于 peakMatter**，
  //   否则永恒把 peakMatter 清零后整排标签会重新上锁 ✗ —— 用户实测反馈就是这个）
  if (state.peakMatter.gte(COLLAPSE.unlockMatter) && markPageUnlocked(state, "quantum")) {
    pushLog(state, "⚛ 量子涨落已解锁！");
  }
}

/** 第 7 阶段：相变环的显示累加器（不改实际转换）。 */
function updateTransmuterAccumulator(state, dt) {
  // ── 7. 相变仪进度（只为显示那个环，不改实际转换）──
  //     实际转换是连续除法（zpeRate/1e8），这里维护一个
  //     「距离下一次 1e8 ZPE 还差多少」的累加器，纯粹给玩家看。
  if (collapseUnlocked(state) || state.phaseTransmuterUnlocked) {
    const th = D(BASE.darkEnergyThreshold);
    const acc = state.deAccum.add(zpeRate(state).mul(dt));
    // Decimal 没有 mod，用 acc - floor(acc/th)*th（floorDiv 防舍入，见 formulas.js）
    state.deAccum = acc.lt(th) ? acc : acc.sub(floorDiv(acc, th).mul(th));
    if (state.deAccum.lt(0)) state.deAccum = D(0);
  }
}

/** 第 10 阶段：自动获取（v9）+ 梦想自动化 + ZPE 引擎自动解锁。 */
function runAutomation(state) {
  // ── 10. 自动化 ──
  if (state.voidUpgrades.v9) autoAcquire(state);
  autoAcquireDream(state);   // 独立于 v9，见函数注释
  // ★★★ 2026：**自动无限**（AD 的 Big Crunch autobuyer）——
  //   独立模块 `src/autocrunch.js`；把 `doBigCrunch` 当参数传进去，避免循环 import ✓
  //   ⚠️ 判据成立后再等 0.1s（用户裁定）⇒ 冷却在模块里判 ✓
  // ★★★ 2026（用户：「理论上应该因为拥有 1 次无限而自动解锁的 zpe 引擎需要手动解锁」）——
  //   自动解锁：达标就在 tick 里自动开（幂等 ✓），不必再点按钮 ✓
  if (!zpeEngineUnlocked(state)) {
    const hasInf = (state.infinityCount ?? 0) >= 1 || (state.bigCrunchCount ?? D(0)).gte(1);
    if (hasInf) unlockZpeEngine(state);
  }
}

/** ∞ 溯源守卫：任何资源变成 Infinity/NaN 时点名字段（每字段只报一次）。 */
function checkInfinityGuard(state) {
  // ★★★ 2026（用户：「无限符号还是出现了」）—— **∞ 溯源守卫**：
  //   任何资源变成 Infinity/NaN 时，立刻在控制台点名是**哪个字段** ✗
  //   （只报一次/字段，不刷屏 ✓）
  if (globalThis.__KI_INF_GUARD !== false) {
    const _chk = {
      matter: state.matter, entropy: state.entropy, particles: state.particles,
      zpe: state.zpe, darkEnergy: state.darkEnergy,
      infinityPoints: state.infinityPoints, eternityPoints: state.eternityPoints,
      quantum: state.quantum, bigCrunchCount: state.bigCrunchCount,
    };
    for (const [k, v] of Object.entries(_chk)) {
      if (v && typeof v.isFinite === "function" && !v.isFinite()) {
        globalThis.__KI_INF_SEEN ??= {};
        if (!globalThis.__KI_INF_SEEN[k]) {
          globalThis.__KI_INF_SEEN[k] = true;
          console.error(`[∞ 溯源] state.${k} 变成了非有限值（Infinity/NaN）——请把这个字段名报给开发者`);
        }
      }
    }
  }
}

/** 自动无限 + 七巧板被动 IP + 本永恒 IP 峰值。 */
function runAutoCrunchAndPassive(state, dt) {
  maybeAutoCrunch(state, doBigCrunch, bigCrunchGain);   // ★ 2026：×最高 用**本次收益** ✓
  // ★★★ 2026：**每秒 1% 本次无限可获得的 IP**（中间难度全清奖励；未解锁 ⇒ 恰好 0 ✓）
  //   ⚠️ 收益源走 bigCrunchGain（唯一数据源），当参数传进去避免循环 import ✓
  applyTangramPassiveIp(state, dt, bigCrunchGain);
  // ★★★ 2026（本地 AD 源码 `core/autobuyers/big-crunch-autobuyer.js`）——
  //   AD 的 X_HIGHEST 比的是 `records.thisEternity.maxIP`（本永恒**持有 IP 的峰值**）✓
  //   ⇒ 这里维护同一个量（不再是"单次收益纪录" ✗）
  {
    const ipNow = state.infinityPoints ?? D(0);
    const prev = state.maxIpThisEternity instanceof Decimal ? state.maxIpThisEternity : D(state.maxIpThisEternity ?? 0);
    if (ipNow.gt(prev)) state.maxIpThisEternity = ipNow;
  }
}

export function tickBody(state, dt) {
  if (!(dt > 0) || !Number.isFinite(dt)) return state;

  // ★ 2026：11 个阶段各自成函数（顺序 = 原 tickBody 的执行顺序）
  applyTimedIncome(state, dt);

  // ── 1~2. 熵 → 粒子 → 物质 ──
  const { P0, particleGain } = advanceEntropyToParticle(state, dt);
  advanceParticleToMatter(state, dt, P0, particleGain);

  // ── 3~4c. ZPE / 暗能量 / 速率快照 ──
  advanceZpe(state, dt);
  advanceDarkEnergy(state, dt);
  snapshotTransmuterRate(state);

  // ── 5~7. 里程碑 / 峰值 / 相变环显示 ──
  checkMilestones(state);
  updatePeakMatterAndPages(state);
  updateTransmuterAccumulator(state, dt);

  // ── 8. 层间重置（**由外到内**）──
  phaseResets(state);
  // ── 9. 层内奖励：量子捕获（必须在重置之后）──
  phaseQuantumCapture(state);

  // ── 10. 自动化 + 守卫 ──
  runAutomation(state);
  checkInfinityGuard(state);
  runAutoCrunchAndPassive(state, dt);

  return state;
}

/**
 * ══════════════════════════════════════════════════════════
 * 层结构（重构后显式化）
 * ══════════════════════════════════════════════════════════
 *
 *   第 0 层  熵 → 粒子 → 物质     生产环
 *   第 1 层  ZPE                   由熵阱产出
 *   第 2 层  暗能量                 由 ZPE 相变而来
 *   第 3 层  临界坍缩 → 暗物质/量子   层内阶梯（自动）
 *   第 4 层  大坍缩   → 无限点       层间重置（强制/手动）
 *
 * **重置顺序必须由外到内**：外层一重置，内层的判定自然失效，
 * 不会出现「内层刚发的奖励被同帧的外层重置抹掉」。
 *
 * 踩过的坑（用户发现）：原来是「量子捕获 → 临界坍缩 → 大坍缩」，
 * 而量子捕获会抬高 globalMultiplier → 物质涨得更快 → 触发大坍缩
 * → 同一帧内把刚捕获的量子抹掉。**自我抵消**。
 */

/**
 * 阶段：层间重置。**由外到内**。
 *
 * ★ 「临界坍缩阶梯」已整个删除，所以现在只有一层重置：大坍缩。
 *   第三层（量子涨落）**不重置任何东西** —— 它只给量子，量子再给指数成长速率。
 *   （原来的顺序坑：量子捕获 → 临界坍缩 → 大坍缩，同一帧内刚捕获的量子被抹掉。
 *     现在没有内层重置，这个坑从结构上消失了。）
 */
export function phaseResets(state) {
  // ── 大坍缩（唯一的重置）──
  //    未打破无限时物质硬顶在 1e308.25，到顶**强制**触发；
  //    打破后上限解除，改由玩家手动（见 doBigCrunch 的调用方）。
  if (!state.brokenInfinity) {
    const cap = crunchThreshold();
    if (state.resources.matter.gte(cap)) {
      state.resources.matter = cap;   // 硬顶：不许超过
      doBigCrunch(state);
    }
  }
}

/**
 * 阶段：层内奖励 —— 量子涨落捕获。
 *
 * 门槛 `1e10 × 10^已捕获对数`，满足即自动捕获一对（+2 量子）。
 *
 * ⚠️ 必须排在 phaseResets **之后**：
 *    捕获会抬高 globalMultiplier，进而加快物质增长；
 *    如果排在重置之前，同一帧内刚捕获的量子会被大坍缩抹掉。
 */
export function phaseQuantumCapture(state) {
  if (!collapseUnlocked(state)) return;
  for (let guard = 0; guard < 200; guard++) {
    const need = quantumZpeRequirement(state.quantumPairs, quantumStepMult(state), state);
    if (state.zpe.lt(need)) break;
    state.quantumPairs = state.quantumPairs.add(1);
    state.quantumPairsTotal = state.quantumPairsTotal.add(1);
    state.quantum = state.quantum.add(quantumPerPair(state));
    if (state.quantum.gt(state.peakQuantumRun ?? 0)) state.peakQuantumRun = state.quantum;
    // ★★★ 2025（用户裁定）：「顺手优化下量子的日志输出，
    //   每 **1/5/25/125/625**（以此类推）对量子输出」
    //   ⚠️ 原来是**每对都写一条** ⇒ 一局几百对就把 #log-panel 刷爆、
    //      把真正重要的事件（大坍缩 / 里程碑）冲走 ✗
    //   ⚠️ 判据用 `isQuantumLogLevel`（**纯 ×5 序列**），
    //      **不是** `isKeyLevel`（那是 ×5/×2 交替，给重复购买升级用的）—— 语义不同，别混 ✗
    //   ⚠️ `quantumPairs` 是 Decimal ⇒ 先 `toNumber()`（超 1e18 时 toNumber 给近似值，
    //      而我们的序列上界也是 1e18 ⇒ 边界处也不会误判 ✓）
    if (isQuantumLogLevel(state.quantumPairs.toNumber())) {
      pushLog(state, `⚛ 捕获第 ${state.quantumPairs.toString()} 对量子（门槛 ${sci(need)} ZPE）`);
    }
    // ★★ 2025：**捕获量子会重置 ZPE**（设计稿第 39 行「量子获取时不再重置 zpe」的**前提**）。
    //   在此之前这个重置**根本没实现** —— 那么 em3 就成了一条永远为真的空条目 ✗
    //   ⇒ 先把重置实现出来，再由 **em3** 豁免它（「不再重置」= 增量式升级 ✓）。
    //   ⚠️ 重置后**必须 `break`**：`need` 是按 `quantumPairs` 算的，ZPE 归零后本轮不可能再捕获，
    //      继续循环只会空转（`state.zpe.lt(need)` 下一轮就成立了，其实安全，但 `break` 语义更清楚）。
    if (!hasEternityMilestone(state, "em3")) {
      state.zpe = D(0);
      pushLog(state, "⚛ 捕获量子：ZPE 已重置（em3 后不再重置）");
      break;
    }
  }
}

/**
 * 打破无限（花无限点）。
 * 之后物质上限解除，大坍缩改为手动，收益随深度增长。
 */
export function advance(state, seconds, chunkSeconds = 5) {
  let remaining = Math.min(seconds, BASE.offlineCapSeconds);
  const chunks = Math.max(1, Math.ceil(remaining / chunkSeconds));
  const dt = remaining / chunks;
  // ★★ 2025「步首快照」（用户要求，修"显示 ≠ 实发"）：
  //   短步（≤ 30 秒）里所有"量子派生"的读取都走 `qOf()` ⇒ 冻结在步首的值 ✓
  //   长步（离线结算）**不冻结** —— 否则几小时的量子进展会被拉平 ✗
  //   ⚠️ 只设**影子字段** `quantumFrozen`，**绝不覆盖** `state.quantum` 的累计 ✓
  //      （第一版草稿就是覆盖 state ⇒ 会把量子累计抹掉 ✗，已废弃）
  const FREEZE_MAX_S = 30;
  const freeze = remaining <= FREEZE_MAX_S;
  if (freeze) state.quantumFrozen = state.quantum;
  try {
    for (let i = 0; i < chunks; i++) tick(state, dt);
  } finally {
    if (freeze) delete state.quantumFrozen;
  }
  return state;
}

// ══════════════════════════════════════════════════════════
// 动作
// ══════════════════════════════════════════════════════════

/** 点击给熵 */
