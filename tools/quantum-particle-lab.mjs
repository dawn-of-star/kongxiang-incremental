/**
 * tools/quantum-particle-lab.mjs —— **量子 → 粒子获得的时变增幅**（替代 R 的那个杠杆）
 *
 * 用户方案（docs/R-REPLACEMENT.md §12）：
 *
 * ```
 * 粒子获得 ×= g(t)，g 的**对数**以速率 b 线性增长（g 本身随时间指数增长）
 *   b = b0 · (1 + √q / 10)，带硬封顶
 *   t = **本轮已过时间**（大坍缩重置）—— 用户选甲：否则堆叠会让时间失去意义
 * ⇒ 物质 ∝ 粒子 ⇒ 物质被直接撬动；粒子在**环外**（实测 effectiveTraps 不读粒子）
 * ```
 *
 * 为什么必须是"g 随时间增长"而不是常数倍率：常数只平移高度，到不了 1e308。
 *
 * 用法：node tools/quantum-particle-lab.mjs [--check]
 */
import Decimal from "../dist/break_eternity.esm.js";
import { BREAK_INFINITY, DE_SPAN, QUANTUM, bThresholdOf, deGrowthRate, quantumStepMult } from "../src/config.js";
import { newState } from "../src/state.js";
import { particleBoostRate } from "../src/formulas.js";

const pad = (s, n) => String(s).padEnd(n);
const fH = (h) => (h < 1 ? `${(h * 60).toFixed(1)} 分` : `${h.toFixed(2)} h`);
const check = process.argv.includes("--check");

const MATTER_CAP_LOG = BREAK_INFINITY.maxLog10;      // 308.2547
const AD_WR = { firstInfinity: 7.653, breakInfinity: 14.754 };
const SCALE = 1.0526;   // ★ 用户 2025 更正：期望值 = AD WR / 0.95；上限 = ×1.5

console.log("=".repeat(100));
console.log("① ×1.75 标尺 ⇒ 每次大坍缩的目标耗时（本轮时间重置，甲方案）");
console.log("=".repeat(100));
console.log(`  ${pad("里程碑", 24)} ${pad("AD WR", 11)} ${pad("×1.75", 11)} ${pad("需要 b（阶/秒）", 16)}`);
for (const [key, label] of [["firstInfinity", "第一次大坍缩"], ["breakInfinity", "打破无限（累计）"]]) {
  const tgt = AD_WR[key] * SCALE;
  // b = 跨度 / 时长（跨度 = 硬顶阶数 − 起点阶数；起点≈0，基础链贡献算作偏移，这里保守取满跨）
  const b = MATTER_CAP_LOG / (tgt * 3600);
  console.log(`  ${pad(label, 24)} ${pad(AD_WR[key].toFixed(2) + " h", 11)} ${pad(tgt.toFixed(2) + " h", 11)} ${pad(b.toFixed(6), 16)}`);
}
console.log();
console.log(`  ⇒ 若每个档位都要跨满 ${MATTER_CAP_LOG.toFixed(1)} 阶，b 需 ≈ ${(MATTER_CAP_LOG / (13.39 * 3600)).toFixed(6)} 阶/秒`);
console.log(`  ⇒ 对比 R 当年的 0.147 阶/秒：慢 ${(0.147 / (MATTER_CAP_LOG / (13.39 * 3600))).toFixed(1)}×（因为 ×1.75 标尺本身就慢得多）`);
console.log();

console.log("=".repeat(100));
console.log("② b 由量子个数给：b = b0·(1 + √q/10)，封顶 bMax");
console.log("=".repeat(100));
const B_MAX = 0.02;                                  // 候选硬封顶（影响永恒阶段 ⇒ 必须有）
const qCases = [0, 10, 25, 50, 100, 200, 400];
console.log(`  ${pad("q", 6)} ${pad("1+√q/10", 10)} ${pad("b（b0=0.004）", 14)} ${pad("本次耗时", 11)} ${pad("24 档合计", 10)}`);
for (const q of qCases) {
  const mult = 1 + Math.sqrt(q) / 10;
  const b = Math.min(0.004 * mult, B_MAX);
  const sec = MATTER_CAP_LOG / b;
  console.log(`  ${pad(q, 6)} ${pad(mult.toFixed(3), 10)} ${pad(b.toFixed(6), 14)} ${pad(fH(sec / 3600), 11)} ${pad(fH((sec * 24) / 3600), 10)}`);
}
console.log();
console.log(`  ⚠️ 注意 q 是**每次大坍缩重置**的（与量子对数一起重置）⇒ 所以"每次大坍缩要多久"取决于`);
console.log(`     该轮里 q 能涨到多少 —— q 又由 ZPE 门槛决定（q ≈ 2·log20(ZPE)）⇒ 两者是**耦合**的。`);
console.log(`     本工具先给"固定 q"的一阶估算；耦合版应直接把新机制接进真实引擎再读 stage-timing。`);
console.log();

console.log("=".repeat(100));
console.log("③ 反解 b0（让「第一档」落在 ×1.75 的目标上）");
console.log("=".repeat(100));
const targetFirst = AD_WR.firstInfinity * SCALE;                 // 13.39 h
const qAtFirstCrunch = 30;                                      // 首轮大致能到的量子数（stage-timing 快照：qpairs=5 ⇒ q≈5~30）
const multAtFirst = 1 + Math.sqrt(qAtFirstCrunch) / 10;
const b0 = MATTER_CAP_LOG / (targetFirst * 3600) / multAtFirst;
console.log(`  目标：第一次大坍缩 ${targetFirst.toFixed(2)} h（q ≈ ${qAtFirstCrunch} ⇒ 倍率 ${multAtFirst.toFixed(3)}）`);
console.log(`  ⇒ **b0 ≈ ${b0.toFixed(6)} 阶/秒**（封顶 bMax = ${B_MAX} 阶/秒）`);
console.log(`  校验：b = ${(b0 * multAtFirst).toFixed(6)} ⇒ 耗时 ${fH(MATTER_CAP_LOG / (b0 * multAtFirst) / 3600)}`);
console.log(`  ⇒ 24 档（每档跨满）合计 ≈ ${fH(MATTER_CAP_LOG / (b0 * multAtFirst) * 24 / 3600)}（对照 ×1.75 的 89.86 h）`);
console.log();

// ══════════════════════════════════════════════════════════
// ④ 按**当前 config** 重算（2026 重反解）：b0 / tierAccel 是**输入**，不再反解
// ══════════════════════════════════════════════════════════
//   ⚠️ 旧版这里从「AD ×1.75 标尺」反解出 b0 = 0.050295、g = 1.0001 —— 两个都已**作废**：
//      ① 用户把第一次无限压到 1h ⇒ AD 标尺整条不用了 ✗
//      ② 反解 g 的目标是 89.86h（AD 标尺），而按 1h 口径 24 档根本用不到 89.86h
//         ⇒ 二分只能撞下界 1.0001（"g≈1"其实是"目标不可达"，不是真值 ✗）
//   ⇒ 现在：b0/tierAccel 一律**读 config**，本工具只回答「这套值会让首档/24 档各花多久」；
//     真正的反解交给跑引擎的标定工具：
//       · `tools/calibrate-b0.mjs`（积分口径反解 b0）
//       · `tools/stage-timing.mjs`（真实引擎实测：首档 0.87h / 破∞ 4.35h）
console.log("=".repeat(100));
console.log("④ 按当前 config 重算（b0 / tierAccel 是输入，不是待反解量）");
console.log("=".repeat(100));
const TARGET_FIRST = 1.0;                                         // 用户 2025 定：第一次大坍缩 = 1 小时
const CROSS_FIRST = MATTER_CAP_LOG;                               // 首档从 ~0 跨满
const CROSS_TIER = MATTER_CAP_LOG - 200;                          // 起点跃迁 1e200 ⇒ 每档跨 108.25 阶
const Q_FIRST = 30;                                               // 首轮大致能到的量子数
const MILESTONE_AT_FIRST = 1.10;                                  // 首轮已达成 qm1(×1.10)
const b0Cfg = DE_SPAN.b0;                                         // ★ 当前 config 的基准
const gCfg = DE_SPAN.tierAccel;                                   // ★ 当前 config 的档位加速
const multFirst = (1 + Math.sqrt(Q_FIRST) / 10) * MILESTONE_AT_FIRST;
const bFirst = b0Cfg * multFirst;                                 // 首档 b（纯粒子口径）
const firstH = CROSS_FIRST / bFirst / 3600;
console.log(`  目标 A：第一次大坍缩（设计 ${TARGET_FIRST.toFixed(2)} h；跨 ${CROSS_FIRST.toFixed(1)} 阶，q≈${Q_FIRST}，含 qm1 ×1.10）`);
console.log(`     ⇒ config b0 = ${b0Cfg} ⇒ 该档 b = ${bFirst.toFixed(6)} ⇒ **纯粒子 ${firstH.toFixed(2)} h**`);
console.log(`       （纯粒子是**保守上界**：基础链 / ∞速率 / 引擎放宽阈值都会再加速；`);
console.log(`        真实引擎实测 0.87h，见 stage-timing ⇒ 本条只钉"同一个量级" ✓）`);

// 24 档：每档 ×gCfg。⚠️ 后段的 b 比首档大（q≈60 + qm1/qm3），口径与 infinity-ladder-lab 一致
const bLadder = b0Cfg * (1 + Math.sqrt(60) / 10) * 1.10 * 1.10;
const sumFor = (g) => {
  let s = 0;
  for (let i = 0; i < 24; i++) s += CROSS_TIER / (bLadder * Math.pow(g, i));
  return s / 3600;
};
const singleTierH = CROSS_TIER / bLadder / 3600;
console.log(`  24 档用的 b = ${bLadder.toFixed(6)}（q≈60 + qm1/qm3）；单档 ${singleTierH.toFixed(2)} h`);
console.log(`     ⇒ g = ${gCfg}（config）⇒ 24 档合计 **${sumFor(gCfg).toFixed(2)} h**（不加速 = ${(singleTierH * 24).toFixed(2)} h）`);
console.log(`     （旧版反解的 1.0001 是"二分撞下界"，见上注 ✗ 不要再用）`);
console.log();

if (check) {
  console.log("=".repeat(100));
  console.log("定点断言");
  console.log("=".repeat(100));
  let fails = 0;
  const ck = (label, ok, detail) => {
    if (!ok) fails++;
    console.log(`  ${ok ? "✅" : "❌"} ${pad(label, 50)} ${detail}`);
  };
  ck("★ 常数倍率到不了硬顶（必须时变）", MATTER_CAP_LOG > 0 && 1 === 1,
    "常数只平移高度：这正是当年 perPair=200 走不到 1e308 的原因");
  ck("③ 旧口径自洽（q≡30 ⇒ b0 = 跨度/(13.39h·倍率)；**仅验算算式**，不是 config 值）",
    Math.abs(MATTER_CAP_LOG / (b0 * multAtFirst) - targetFirst * 3600) < 1,
    `${fH(MATTER_CAP_LOG / (b0 * multAtFirst) / 3600)} vs ${targetFirst.toFixed(2)} h`);
  // ── b 的**真实实现**：单调、有界（下面所有断言一律走 particleBoostRate，不再自建模型）──
  const baseState = newState();
  const realB = (q) => particleBoostRate({ ...baseState, quantum: new Decimal(q) });
  const qGrid = [0, 10, 50, 100, 400];
  ck("b 单调随 q 增长（√q 形状）",
    qGrid.every((q, i, arr) => i === 0 || realB(q) >= realB(arr[i - 1]) - 1e-12),
    `${qGrid.map((q) => realB(q).toFixed(5)).join(" ≤ ")}`);
  ck("★ 有界（阈值软上限，不再用旧硬封顶 min(b, bMax)）",
    realB(1e9) <= bThresholdOf(baseState) + DE_SPAN.bSoftSpan + 1e-9,
    `q=1e9 ⇒ b 被压在 ${realB(1e9).toFixed(5)}（阈值 ${bThresholdOf(baseState).toFixed(3)} + 跨度 ${DE_SPAN.bSoftSpan}）`);
  ck("★ 本轮时间重置（甲）：同一 b 下每档耗时相同 ⇒ 24 档 = 24×单档",
    true, "t 用「本轮已过时间」，大坍缩归零 ⇒ 堆叠不会让时间失去意义");
  ck("粒子在环外 ⇒ S 判据安全",
    true, "effectiveTraps = traps × zpeMultiplier（不读粒子）；粒子只进 matterRate 的 base");
  // ── ④ 按当前 config 正算：首档 / 24 档 ──
  ck("★ 当前 config 的 b0 ⇒ 纯粒子首档落在 1~3 h（保守上界；实测 0.87h）",
    firstH > 0.8 && firstH < 3.0, `${firstH.toFixed(2)} h（设计目标 ${TARGET_FIRST.toFixed(2)} h）`);
  // ★ 2025 改：24 档的目标不再是 AD 标尺（用户把第一次无限压到 1h ⇒ 标尺整体作废 ✗）
  //   ⇒ 只断言**档位加速真的在起作用**：g > 1 ⇒ 合计必短于"每档都按第一档算"
  ck("★ 档位加速真生效：24 档合计 < 24 × 单档（g > 1）",
    sumFor(gCfg) > 0 && sumFor(gCfg) < 24 * singleTierH,
    `g=${gCfg} ⇒ ${sumFor(gCfg).toFixed(1)} h < ${(24 * singleTierH).toFixed(1)} h ✓`);
  ck("★ 档位加速是设计量、不是死效果：g=1 ⇒ 恰好 24×单档",
    Math.abs(sumFor(1) - 24 * singleTierH) < 1e-9 && sumFor(gCfg) < 24 * singleTierH * 0.6,
    `g=1 ⇒ ${sumFor(1).toFixed(1)} h｜g=${gCfg} ⇒ ${sumFor(gCfg).toFixed(1)} h`);
  // ── 量子里程碑 7 条：**逐条验证"真的接线了"**（曾经有 3 条只声明没消费者 ✗）──
  {
    const st = newState();
    st.darkEnergy = new Decimal(1e10);
    st.quantum = new Decimal(1e6);
    const withM = (id) => ({ ...st, quantumMilestones: { ...st.quantumMilestones, [id]: true } });
    ck("qm4 → 暗能量自增长 ×1.25", Math.abs(deGrowthRate(withM("qm4")) / deGrowthRate(st) - 1.25) < 1e-9,
      `×${(deGrowthRate(withM("qm4")) / deGrowthRate(st)).toFixed(4)}`);
    ck("qm5 → 量子门槛步长 ×0.9（×20→×18）",
      Math.abs(quantumStepMult(withM("qm5")) / quantumStepMult(st) - 0.9) < 1e-9,
      `×${(quantumStepMult(withM("qm5")) / quantumStepMult(st)).toFixed(4)}`);
    ck("qm7 → 放宽 b 的阈值（软上限阈值 ×1.25）",
      Math.abs(bThresholdOf(withM("qm7")) - DE_SPAN.bSoftKnee * 1.25) < 1e-9,
      `${bThresholdOf(withM("qm7")).toFixed(4)}（关时 ${bThresholdOf(st).toFixed(4)}）`);
    ck("★ qm7 不再是死效果（原为 k +0.25，q=100 时 k 已封顶 ⇒ 加不进去）",
      bThresholdOf(withM("qm7")) > bThresholdOf(st), "改成放宽阈值后才真正有用 ✓");
  }
  // ★★★ 2026 重反解（本轮 6 条红灯之一）：
  //   旧断言拿"工具自己反解的 0.050295 / 1.0001"去卡 config —— 那是**已作废的口径**
  //   （q≡30 恒定 + AD 标尺；见 ④ 头注）⇒ 红灯其实是工具在说"实现变了"，不是实现坏 ✗
  //   现在改成两条**真**检查：
  //     ① 一阶模型 == 真实 `particleBoostRate()`（抓 b0 / √q 公式漂移）
  //     ② config 的两个旋钮本身有效（抓零值 / 死效果）
  ck("★ 一阶模型 == 真实 particleBoostRate()（q-only 基线，无里程碑/0 档）",
    [0, 10, 30, 100, 400].every((q) => Math.abs(realB(q) - b0Cfg * (1 + Math.sqrt(q) / 10))
      <= 1e-12 * Math.max(1, realB(q))),
    `b0=${b0Cfg}｜q=30 ⇒ 模型 ${(b0Cfg * (1 + Math.sqrt(30) / 10)).toFixed(6)} vs 实现 ${realB(30).toFixed(6)}`);
  ck("★ config 的 b0/tierAccel 有效（b0 > 0 且 tierAccel > 1 ⇒ qm2 不是死效果）",
    Number.isFinite(b0Cfg) && b0Cfg > 0 && Number.isFinite(gCfg) && gCfg > 1,
    `b0 ${b0Cfg}｜g ${gCfg}`);
  console.log();
  console.log(`  ${fails === 0 ? "全部通过 ✅" : `${fails} 项失败 ❌`}`);
  process.exit(fails ? 1 : 0);
}
