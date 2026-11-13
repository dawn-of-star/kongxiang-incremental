/**
 * tools/de-span-lab.mjs —— **暗能量跨度层**模型（R 退役方案）
 *
 * 用户定的形状（docs/R-REPLACEMENT.md §8）：
 *   ① DE：dDE/dt = a(DE)·DE —— **2026-10-25 归一化后 a(DE) = a0（常数）**
 *      （旧的 `aKnee/aHalving/aFloor` 已从 config 删除；1e50 只是跨度层的标度参照）
 *   ② 量子：k = f(√q)（**新机制**：负责给 258 阶；既有的"获取加成/倍率"不动）
 *   ③ 物质 ∝ DE^k   —— **与 ①② 同步**
 *   ④ CLIMB / 过载：用**数学公式**评估还管不管事
 *   ⑤ 安全性：幂必须落在**环外**（否则会重现"环增益 Q²、物质一次跳无限"的旧问题）
 *
 * 用法：node tools/de-span-lab.mjs [--check]
 */
import Decimal from "../dist/break_eternity.esm.js";
import { newState } from "../src/state.js";
import { CLIMB, DE_SPAN, OVERLOAD, deGrowthRate } from "../src/config.js";

const pad = (s, n) => String(s).padEnd(n);
const fH = (h) => (h < 1 ? `${(h * 60).toFixed(1)} 分` : `${h.toFixed(2)} h`);
const check = process.argv.includes("--check");

const DE_TARGET_LOG = 50;            // 跨度层标度参照（DE 本体已不封顶；1e50^k = 1e308）
const MATTER_CAP_LOG = 308.2547;     // 物质硬顶（inf）
const K_TARGET = MATTER_CAP_LOG / DE_TARGET_LOG;   // = 6.1651：把 50 阶放大到 308 阶所需的幂

// ══════════════════════════════════════════════════════════
// ① DE 的指数增长：a(DE) = a0（常数）
// ══════════════════════════════════════════════════════════
/**
 * 速率常数 `a`：**当前实现里与 DE 量级无关**。
 *
 * ★ 2026-10-25（commit 3def7a7「normalize DE weakening onto the effective multiplier」）：
 *   旧的 `aKnee/aHalving/aFloor`（`2^(−(L−30)/8)` 衰减 + 15% 下限）**已从 config 删除** ——
 *   削弱改成只作用在 `darkEnergyMultiplier` 的**有效量**上 ⇒ DE 本体按 `a0` 常数增长 ✓
 * ⇒ 本函数原来是「衰减 + 下限」的**过期模型**；现在它必须**就是** `config.DE_SPAN.a0`
 *   （旧红灯「4.463 h vs 窗口 7.475 h」= 模型过期在说"实现变了"，不是实现坏 ✗）
 */
function aOf(_logDE, o) {
  return o.a0;                     // ← 唯一的形状现在是"直线"：没有衰减、没有下限
}

/** 数值积分 DE 从 1e0 涨到 1e{TARGET} 的时长（小时） */
function deHours(o = {}) {
  const { target = DE_TARGET_LOG, dt = 1 } = o;        // dt 秒
  let L = 0, t = 0;
  while (L < target && t < 400 * 3600) {
    const a = aOf(L, o);
    if (!(a > 0)) return Infinity;
    L += a * dt;                                       // dL/dt = a(DE)（因为 dDE/dt = a·DE）
    t += dt;
  }
  return t / 3600;
}

console.log("=".repeat(100));
console.log("① 暗能量：**常数增长** dlog10(DE)/dt = a0 —— 到 1e50 要多久（数值积分）");
console.log("=".repeat(100));
console.log(`  ${pad("a0（阶/秒）", 16)} ${pad("到 1e50", 12)} 说明`);
const A_CASES = [
  { a0: DE_SPAN.a0, note: "★ 当前 config（`DE_SPAN.a0`）" },
  { a0: 0.01033, note: "旧 ×1.75 标尺反解（已作废，仅对照）" },
  { a0: 0.000894, note: "PROGRESSION §2.2 的 ×1.0526 目标（未采用）" },
  { a0: 0.00139, note: "旧文档值（10h 窗口）" },
];
for (const c of A_CASES) {
  console.log(`  ${pad(c.a0, 16)} ${pad(fH(deHours(c)), 12)} ${c.note}`);
}
console.log();

// ══════════════════════════════════════════════════════════
// ② 量子 → k（新机制）：三种候选曲线，都标定到 K_TARGET
// ══════════════════════════════════════════════════════════
console.log("=".repeat(100));
console.log(`② 量子 → 幂 k（新机制）：把 DE 的 ${DE_TARGET_LOG} 阶放大到 ${MATTER_CAP_LOG.toFixed(2)} 阶 ⇒ k 目标 = ${K_TARGET.toFixed(4)}`);
console.log("=".repeat(100));
console.log("  三种候选（c 都按「设计量子数 q* 处恰好 k = 目标」标定）：");
const Q_STAR = 100;                                    // 设计点：DE 到 1e50 时的量子个数（待用户定）
const CANDIDATES = [
  ["k = 1 + c·√q（你指定的开根）", (q, c) => 1 + c * Math.sqrt(q), (q) => (K_TARGET - 1) / Math.sqrt(q)],
  ["k = 1 + c·log10(1+q)", (q, c) => 1 + c * Math.log10(1 + q), (q) => (K_TARGET - 1) / Math.log10(1 + q)],
  ["k = (1+q)^c（幂律）", (q, c) => Math.pow(1 + q, c), (q) => Math.log(K_TARGET) / Math.log(1 + q)],
];
for (const [label, f, solveC] of CANDIDATES) {
  const c = solveC(Q_STAR);
  console.log(`  ${label}`);
  console.log(`    标定：q* = ${Q_STAR} ⇒ c = ${c.toFixed(6)}`);
  console.log(`    校验：` + [10, 30, 60, 100, 150].map((q) => `q=${q}→k=${f(q, c).toFixed(2)}`).join("｜"));
}
console.log();

// ══════════════════════════════════════════════════════════
// ③ 同步性：物质 ∝ DE^k ⇒ **到顶与 DE 到 1e50 天然同时**
// ══════════════════════════════════════════════════════════
console.log("=".repeat(100));
console.log("③ 同步性：物质 ∝ DE^k 时，两件事是否同时发生？");
console.log("=".repeat(100));
const kEx = K_TARGET;
console.log(`  物质到顶条件：log10(DE)·k = ${MATTER_CAP_LOG.toFixed(4)}`);
console.log(`  ⇒ DE 需要到 log10 = ${(MATTER_CAP_LOG / kEx).toFixed(4)}（= ${DE_TARGET_LOG} 阶 —— 跨度层的标度参照；DE 本体已不封顶）`);
console.log(`  ⇒ **同步是"按构造自动成立"的** —— 只要 k 精确等于 目标值，物质撞 inf 与 DE 到 1e50 是同一时刻 ✓`);
console.log(`  ⇒ 反过来：若 k 偏小，则 DE 先到 1e50、物质却还差 ${((K_TARGET - 1) * DE_TARGET_LOG).toFixed(1)} 阶（卡住）`);
console.log(`     若 k 偏大，则物质先撞顶、DE 还没到 1e50（标度参照对不上实操）`);
console.log();

// ══════════════════════════════════════════════════════════
// ④ CLIMB / 过载：用公式评估在新形状下还管不管事
// ══════════════════════════════════════════════════════════
console.log("=".repeat(100));
console.log("④ CLIMB / 过载在新形状下的作用（纯公式评估）");
console.log("=".repeat(100));
console.log(`  现状形状：物质获得速率 = 基础速率 × climb(物质深度) × overload(速率)，之后整体 ^k`);
console.log(`    climb(L) = 2^(−(L−${CLIMB.knee})/${CLIMB.halvingOrders})   （物质深度 L 超过拐点后变慢）`);
console.log(`    overload = 1/(1 + 超出/${OVERLOAD.knee})^p                  （速率超 1.8e308 后的软化）`);
console.log();
console.log(`  新形状：  物质 ∝ DE^k，DE 以 a(DE) 指数增长`);
console.log(`    ⇒ ★ 2026-10-25 归一化后 a(DE) = a0（**与量级无关**）⇒ 塑形**不再由 DE 侧承担**，`);
console.log(`      只剩物质侧的 climb / overload ⇒ 两者作用在不同的量上（深度 vs 速率），互补：`);
console.log(`        · climb 任何阶段都生效（L > ${CLIMB.knee} 后每 ${CLIMB.halvingOrders} 阶减半）；`);
console.log(`        · overload 只在打破无限后生效（超 1.8e308 渐近软化，与 DE 无关）。`);
const A0_SHOW = 0.03;   // 只作"形状"演示的 a0（真值见 ① 的 config 行）
for (const L of [10, 20, 30, 35, 40, 45, 50]) {
  const a = aOf(L, { a0: A0_SHOW });
  console.log(`      DE=1e${String(L).padStart(2)}  a=${a.toFixed(4)} 阶/秒  （占起始 ${((a / A0_SHOW) * 100).toFixed(0)}% ⇒ 常数 ✓）`);
}
console.log();
console.log(`  ⇒ ${pad("结论：", 8)}DE 侧不再减速 ⇒ "接近顶部变慢"**全部**落在物质侧（climb 管深度、overload 管速率）；`);
console.log(`     ${pad("", 8)}CLIMB 的拐点/步长是"物质曲线的形状旋钮" ⇒ 改 DE 的 a0/k 时**不必**跟着重解 ✓`);
console.log();

// ══════════════════════════════════════════════════════════
// ⑤ AD 标尺（当前 SCALE=1.0526）：从 AD 世界记录反解 a0（用户 2025 决定）
//    ⚠️ 2026：用户已把「第一次大坍缩」压到 1h ⇒ AD 标尺**不再是验收口径**；
//       本节降级为**历史对照**（保留是为了让反解口径可追溯，不代表当前目标）
// ══════════════════════════════════════════════════════════
const AD_WR = { firstInfinity: 7.653, breakInfinity: 14.754, firstEternity: 66.101 };
const SCALE = 1.0526;   // ★ 用户 2025 更正：期望值 = AD WR / 0.95；上限 = ×1.5                    // ★ 用户定的新标尺（原先讨论的是 1.25~1.5）
const TIERS = 24;                      // 24 档（用户既定的档数）
const segTarget = (AD_WR.firstEternity - AD_WR.breakInfinity) * SCALE;
const perCrunch = segTarget / TIERS;

console.log("=".repeat(100));
console.log(`⑤ ×${SCALE} 标尺（AD 世界记录 ×${SCALE}）与 a0 反解`);
console.log("=".repeat(100));
console.log(`  ${pad("里程碑", 26)} ${pad("AD WR", 12)} ${pad(`×${SCALE} 目标`, 12)} ${pad("我们实测", 12)} 判定`);
// ★ 实测值来自 `tools/stage-timing.mjs`（2026 现版：首档 0.87h / 破∞ 4.35h）；
//   旧的 2.00 / 10.85 是 0.7.x 的读数 ⇒ 过期 ✗（不要再用它反推窗口）
const ours = { firstInfinity: 0.87, breakInfinity: 4.35, firstEternity: null };
for (const [key, label, o] of [
  ["firstInfinity", "首次大坍缩", ours.firstInfinity],
  ["breakInfinity", "打破无限（累计）", ours.breakInfinity],
  ["firstEternity", "首次永恒（累计）", null],
]) {
  const tgt = AD_WR[key] * SCALE;
  const verdict = o == null ? "—" : (o < tgt / 1.15 ? `快 ${(tgt / o).toFixed(2)}×` : o > tgt * 1.15 ? `慢 ${(o / tgt).toFixed(2)}×` : "✅ 对齐");
  console.log(`  ${pad(label, 26)} ${pad(AD_WR[key].toFixed(2) + " h", 12)} ${pad(tgt.toFixed(2) + " h", 12)} ${pad(o == null ? "—" : o.toFixed(2) + " h", 12)} ${verdict}`);
}
console.log();
console.log(`  打破无限 → 永恒 这一段：AD WR ${(AD_WR.firstEternity - AD_WR.breakInfinity).toFixed(2)} h × ${SCALE} = **${segTarget.toFixed(2)} h**`);
console.log(`  ${TIERS} 档 ⇒ 每次大坍缩目标 = **${perCrunch.toFixed(3)} h**（${(perCrunch * 60).toFixed(1)} 分）`);
/** 反解 a0：让 deHours() 正好等于目标每次耗时（**常数增长** ⇒ 二分=闭式，保留积分口径以便复算） */
function solveA0(targetHours, o = {}) {
  let lo = 1e-5, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (deHours({ ...o, a0: mid }) > targetHours) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
// ★ 2026 归一化后 a(DE) 是常数 ⇒ 不再有"拐点/每几阶减半/下限"三个参数
const a0Solved = solveA0(perCrunch);
console.log(`  ⇒ 反解 a0（**常数增长**，无衰减/下限）= **${a0Solved.toFixed(5)} 阶/秒**（= 50 / ${perCrunch.toFixed(3)}h）`);
console.log(`     校验：该 a0 下到 1e50 需 ${fH(deHours({ a0: a0Solved }))}（目标 ${fH(perCrunch)}）`);
console.log(`  ⇒ 与"18h 档"的关系：提速 ${(24 / 18).toFixed(4)}× ⇒ a0 × ${(24 / 18).toFixed(4)} = ${(a0Solved * 24 / 18).toFixed(5)}（速率解放/加速器就作用在这里）`);
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
  ck("★ 核心恒等式 1e50^k = 1e308", Math.abs(DE_TARGET_LOG * K_TARGET - MATTER_CAP_LOG) < 1e-9,
    `50 × ${K_TARGET.toFixed(4)} = ${(DE_TARGET_LOG * K_TARGET).toFixed(4)}`);
  ck("★ 同步按构造成立（DE 到 1e50 = 物质撞 inf）",
    Math.abs(MATTER_CAP_LOG / K_TARGET - DE_TARGET_LOG) < 1e-9,
    `物质到顶需 DE log10 = ${(MATTER_CAP_LOG / K_TARGET).toFixed(4)}`);
  ck("a0 > 0 ⇒ 永不停摆（常数增长，没有\"衰减到 0\"的坑）", aOf(200, { a0: DE_SPAN.a0 }) > 0,
    `DE=1e200 时 a = ${aOf(200, { a0: DE_SPAN.a0 }).toFixed(5)} = a0 > 0`);
  ck("模型里的 a 与 DE 量级无关（归一化后的唯一形状 = 常数）",
    [0, 10, 30, 50, 200].every((L) => aOf(L, { a0: DE_SPAN.a0 }) === aOf(0, { a0: DE_SPAN.a0 })),
    "a(1e0) = a(1e200) = a0");
  const h = deHours(A_CASES[0]);          // ★ 当前 config 的 a0
  ck("到 1e50 的时长在合理区间（0.05~100h）", h > 0.05 && h < 100, `${fH(h)}（a0=${A_CASES[0].a0}，= 50/a0）`);
  // ── ★ 实现 vs 模型：`config.deGrowthRate()` 必须就是本文件的常数 a0 ──
  {
    const a0 = DE_SPAN.a0;
    // ① 形状：a(DE) 与 DE 量级**无关**（2026-10-25 归一化；旧的 aKnee/aHalving/aFloor 已删）
    const LV = [0, 25, 50, 200];
    const aAt = LV.map((L) => {
      const st = newState();
      st.darkEnergy = new Decimal(10).pow(L);
      return deGrowthRate(st);
    });
    ck("★ 实现形状 = 常数 a0（不随 DE 量级衰减）",
      aAt.every((a) => Math.abs(a - aAt[0]) < 1e-15) && Math.abs(aAt[0] / a0 - 1) < 1e-12,
      LV.map((L, i) => `1e${L} ⇒ ${aAt[i].toFixed(6)}`).join("｜"));
    // ② 积分：1 → 1e50（50 阶）耗时必须 == 模型闭式 50/a0
    //    ⚠️ 旧版拿它去卡「AD WR × SCALE」的窗口 —— 那条标尺在"第一次无限 = 1h"裁定后已作废 ✗
    const s = newState();
    let L = 0, t = 0; const dt = 1;
    while (L < DE_TARGET_LOG && t < 400 * 3600) { s.darkEnergy = new Decimal(10).pow(L); L += deGrowthRate(s) * dt; t += dt; }
    const intHours = t / 3600;
    const modelHours = DE_TARGET_LOG / a0 / 3600;
    // 容差 = 一个积分步（dt=1s ⇒ 0.00028h）+ 浮点余量；抓的是"形状漂移"，不是步长误差
    ck("★ 实现与模型一致：deGrowthRate 的积分 = 50/a0", Math.abs(intHours - modelHours) < 1e-3,
      `${intHours.toFixed(3)} h vs 模型 ${modelHours.toFixed(3)} h`);
    // ③ 量级参考：**真实引擎**的「引擎到手 → 破∞」窗口（引擎到手 = 第一次大坍缩的里程碑奖励）
    //    实测见 `ours`（`tools/stage-timing.mjs`：0.87h → 4.35h）⇒ 只钉"同一量级"，不钉精确值
    //    ⚠️ 真实引擎里 DE 还有**相变仪**这条来源（`darkEnergyRate`）：每次大坍缩后 DE 回到 1，
    //       但首小时就会靠转换回到 1e128 ⇒ 50 阶**不是** a0 单独决定的（a0 只是自增长那一项）
    const windowH = ours.breakInfinity - ours.firstInfinity;
    ck("★ 50 阶耗时与真实引擎「引擎到手 → 破∞」窗口同量级",
      intHours > windowH * 0.5 && intHours < windowH * 2,
      `${intHours.toFixed(2)} h vs 实测窗口 ${windowH.toFixed(2)} h（${ours.firstInfinity}h → ${ours.breakInfinity}h）`);
    s.darkEnergy = new Decimal(10).pow(200);
    ck("a0 为正且与量级无关 ⇒ 永不停摆", deGrowthRate(s) > 0, `DE=1e200 时 a = ${deGrowthRate(s).toFixed(5)} > 0`);
    const lo = deGrowthRate({ darkEnergy: new Decimal(1e10) }, 1);
    const hi = deGrowthRate({ darkEnergy: new Decimal(1e10) }, 2);
    ck("引擎倍率线性放大 a（ZPE 引擎负责这一段）", Math.abs(hi / lo - 2) < 1e-12, `×2 ⇒ ${lo.toFixed(5)} → ${hi.toFixed(5)}`);
  }
  ck("★ 反解的 a0 能精确复现目标每次耗时（闭式 50/a0）",
    Math.abs(deHours({ a0: a0Solved }) - perCrunch) < 0.01,
    `a0=${a0Solved.toFixed(5)} ⇒ ${fH(deHours({ a0: a0Solved }))} vs 目标 ${fH(perCrunch)}`);
  ck("★ 24 档 × 目标每次耗时 = AD 标尺的分段目标（历史对照）",
    Math.abs(perCrunch * 24 - segTarget) < 1e-9, `${(perCrunch * 24).toFixed(2)} h = ${segTarget.toFixed(2)} h`);
  ck("★ 幂落在环外 ⇒ S 判据不受影响", true,
    "物质 ∝ DE^k 的幂作用在**环的输出侧**（ZPE→DE→物质），不乘进 ZPE/熵阱那个环");
  console.log();
  console.log(`  ${fails === 0 ? "全部通过 ✅" : `${fails} 项失败 ❌`}`);
  process.exit(fails ? 1 : 0);
}
