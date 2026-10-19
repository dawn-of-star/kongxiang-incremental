/**
 * config/milestones.js —— 坍缩 / ZPE / 暗能量 / 量子四套里程碑的数据表
 *
 * ⚠️ 本文件由 `src/config.js` 按领域机械拆分而来：**声明与注释逐字保留**。
 *    对外仍然统一从 `src/config.js`（barrel）导入 —— 不要直接改这里的 import 路径。
 *    依赖：无（叶子模块） ｜ Decimal
 */
import Decimal from "../../dist/break_eternity.esm.js";

export const COLLAPSE_MILESTONES = [
  { at: 1, id: "cm1", desc: "无限后以 10 粒子 + 10 物质开局" },                 // engine.js doBigCrunch 末尾
  { at: 2, id: "cm2", desc: "计数频率每级系数翻倍（0.05 → 0.10）" },           // formulas.js countFreqAddTerm
  { at: 3, id: "cm3", desc: "熵到粒子的初始转换比 100:1 → 50:1" },             // formulas.js conversion（阈值 ×0.5）
  { at: 4, id: "cm4", desc: "无限后以 4 量子开局" },                           // engine.js doBigCrunch 末尾
  { at: 5, id: "cm5", desc: "相变仪转换速率随持有无限点增幅（对数，倍增而减缓）" }, // formulas.js conversion + transmuterIpMult
  { at: 6, id: "cm6", desc: "量子每对获得数量 +1" },                           // config.js quantumPerPair
  { at: 7, id: "cm7", desc: "量子获得公式重做（前期更多、后期更难）" },          // config.js quantumZpeRequirement（1e8 / ×22）
  { at: 8, id: "cm8", desc: "基于游玩时间的全局倍率额外加成（对数）" },         // config.js playTimeBonus
];

/** 该坍缩里程碑是否已达成（按已大坍缩次数） */
export function hasCollapse(state, id) {
  const m = COLLAPSE_MILESTONES.find((x) => x.id === id);
  if (!m) return false;
  // ★ 数值约定 #3：走 Decimal 比较（`Number(1e400)` = Infinity ✗）
  return new Decimal(state?.bigCrunchCount ?? 0).gte(m.at);
}

/** ⑤ 相变仪随持有 IP 的倍率（对数 ⇒ 倍增而减缓；封顶防失控） */
export const ZPE_MILESTONES = [
  {
    id: "m1",
    need: "10",
    desc: "手动点击熵 +10",
    effect: { kind: "clickGainAdd", value: 10 } },
  {
    id: "m2",
    need: "100",
    desc: "所有升级价格 ÷ ZPE 倍率",
    effect: { kind: "upgradePriceDivZpe" } },
  {
    id: "m3",
    need: "500",
    // ★ 文案已改：原描述写「粒子和物质」，实际只影响物质
    desc: "ZPE 倍率以一半效率影响物质产出",
    effect: { kind: "matterZpeFactor", ratio: 0.5 } },
  {
    id: "m4",
    need: "1000",
    desc: "ZPE 倍率影响熵阱的实际生效数量",
    effect: { kind: "effectiveTraps", bonus: 1 } },
  {
    id: "m5",
    need: "10000",
    desc: "购买熵阱价格 ÷ ZPE 倍率",
    effect: { kind: "trapPriceDivZpe" } },
  {
    id: "m6",
    need: "1e8",
    desc: "熵凝聚阈值 ÷ ZPE 倍率",
    effect: { kind: "convThresholdDivZpe" } },
];

// ══════════════════════════════════════════════════════════
// 6 个暗能量里程碑
// ══════════════════════════════════════════════════════════

export const DE_MILESTONES = [
  {
    id: "dm0",
    need: "0",
    /**
     * ⚠️ 这不是「暗能量 ≥ 0」就解锁的。
     * 原稿把它绑在一个手动按钮上，门槛是 **v8 已购 且 物质 ≥ 1e8**：
     *     UI.btnUnlockTransmuter.addEventListener('click', () => {
     *         if (hasV8 && matter.gte(new Decimal(1e8))) { ... }
     *     });
     * 移植时如果漏掉这个门槛，整个第三层会在第 0 秒就开着 ——
     * 实测会让通关速度快 6 倍。所以这里显式建模。
     */
    gate: { voidUpgrade: "v8", matter: "1e8" },
    desc: "解锁相变仪（需要「虚空永恒 v8」+ 1e8 物质）",
    effect: { kind: "unlockTransmuter" } },
  {
    id: "dm1",
    need: "10",
    desc: "ZPE 倍率 ×2",
    effect: { kind: "zpeFixedMultiplier", value: 2 } },
  {
    id: "dm2",
    need: "100",
    // ★ 文案与效果都已改：原稿分子分母同时放大，数学上精确抵消
    desc: "暗能量降低熵凝聚阈值（÷ 暗能量倍率）",
    effect: { kind: "convThresholdDivDe" } },
  {
    id: "dm3",
    need: "1000",
    // ★ 文案已改：原描述写「ZPE 速度」，实际加成的是熵产出
    desc: "暗能量倍率额外加成熵产出",
    /**
     * ⚠️ **声明与实现分居两处**（历史遗留）：
     *   这里的 `kind` 只是**元数据**，全项目没有任何消费者；
     *   真正的效果硬编码在 `formulas.js` 的 `entropyRate()`：
     *       `if (hasDe(state, "dm3")) r = r.mul(darkEnergyMultiplier(state));`
     *   守卫：`tools/zpe-matter-lab.mjs` 的断言会验证"dm3 生效 ⇒ 熵产出 ×暗能量倍率"
     *   （把"声明了但没人验"变成"有断言"）。
     *   想彻底统一，就把各 kind 都改成 `kind → handler` 的表驱动 —— 但那是一次独立重构。
     */
    effect: { kind: "entropyMulDe" } },
  {
    id: "dm4",
    need: "10000",
    desc: "ZPE 折扣倍率额外 ×(1 + 暗能量 × 0.05)",
    effect: { kind: "priceDiscountDeBonus", ratio: 0.05 } },
  {
    id: "dm4b",
    need: "1000000",
    /**
     * ★ 大胆的一次性解锁：**全局加成作用于相变转换速率**（1e6 暗能量生效）。
     *
     * ⚠️ 是「相变转换」（ZPE→暗能量，见 darkEnergyRate），
     *    不是「熵凝聚转换」（熵→粒子，见 particleRate）。
     *    我第一版放错了位置，描述也写成了熵凝聚 —— 两处都已修正。
     *
     * 效果链条：
     *   dDE/dt = zpeRate/1e8 × gain × globalMult
     *   而 globalMult 里与 DE 相关的只有 deMult = 1 + 0.25·log2(DE)
     *   => dDE/dt ∝ log(DE) / DE^0.5
     *
     * ⚠️ 数学结论（tools/de-milestone-model.mjs）：
     *   · **不会失控** —— 速率在 DE ≈ 1e4.5 达到峰值后回落，对数项输给 DE^0.5
     *   · 提速 4~9×，且随 DE 增大而增大（1e30 时 25.9×）
     *   · **完全不碰主环**：主环增益仍是 globalMult²，时间压缩不变
     *   · 门槛从 5e6 降到 1e6，是为了在峰值附近就生效（5e6 比峰值晚 2.2 个数量级）
     */
    desc: "全局加成作用于相变转换速率（ZPE → 暗能量）",
    effect: { kind: "globalToConversion" } },
  {
    id: "dm5",
    need: "1e10",
    desc: "暗能量倍率也会加速暗能量自身的生成",
    effect: { kind: "deGainMulDe" } },
];

// ══════════════════════════════════════════════════════════
// 3 个暗能量升级
// ══════════════════════════════════════════════════════════

/**
 * 暗能量对 ZPE 的惩罚参数（★ 双刃机制）。
 *
 * 惩罚乘数 = `max( 1 / (1 + coeff × 暗能量^exponent × (1−减免)) , floor )`
 *
 * 历史：原稿是 `coeff=0.001, exponent=1.5`，**超线性**，形成死亡螺旋
 *       （暗能量越多 -> ZPE 越少 -> 暗能量涨得越慢）。已改为 0.5。
 */
export const QUANTUM_MILESTONES = [
  { id: "qm1", need: 1, kind: "b", value: 1.10, desc: "粒子增幅速率 ×1.10" },
  { id: "qm2", need: 3, kind: "tierAccel", value: 1.4, desc: "开启档位加速：每档位 ×1.40（值与 DE_SPAN.tierAccel 保持一致）" },
  { id: "qm3", need: 8, kind: "b", value: 1.10, desc: "粒子增幅速率 ×1.10" },
  { id: "qm4", need: 20, kind: "a", value: 1.25, desc: "暗能量自增长速率 ×1.25" },
  { id: "qm5", need: 50, kind: "gate", value: 18, desc: "量子门槛步长 ×20 → ×18" },
  { id: "qm6", need: 120, kind: "b", value: 1.15, desc: "粒子增幅速率 ×1.15" },
  { id: "qm7", need: 300, kind: "bMax", value: 1.25, desc: "粒子增幅速率的封顶 ×1.25（0.02 → 0.025）" },
];

/**
 * ★ 粒子增幅（替代 R 的那一位）的基础参数。
 *
 * `粒子获得 ×= 10^(b · 本轮已过时间)`，`b = b0·(1+√q/10)·里程碑×档位加速`，封顶 `bMax`。
 * 数值来源：`tools/quantum-particle-lab.mjs` 反解（×1.75 标尺：
 * 第一次大坍缩 13.39h ⇒ b0 ≈ 0.00413）；档位 ×1.06 由阶梯算术给出（24 档 ≈ 90h）。
 *
 * ⚠️ 粒子在**环外**（实测 `effectiveTraps` 不读粒子）⇒ 这个杠杆不进环，S 判据安全。
 * ⚠️ `bMax` 是**硬封顶**（用户既有要求：影响永恒阶段的东西必须有极强软上限）。
 */
