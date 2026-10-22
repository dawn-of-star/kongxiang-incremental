/**
 * config/dream.js —— 梦想点体系：升级表、效果聚合、离线上限、S 判据、分段价格
 *
 * ⚠️ 本文件由 `src/config.js` 按领域机械拆分而来：**声明与注释逐字保留**。
 *    对外仍然统一从 `src/config.js`（barrel）导入 —— 不要直接改这里的 import 路径。
 *    依赖：dark-energy, base, upgrades, zones ｜ Decimal
 */
import Decimal from "../../dist/break_eternity.esm.js";
import { BASE } from "./base.js";
import { REPEATABLE } from "./upgrades.js";
import { DE_UPGRADES, deGainBaseEffectMult } from "./dark-energy.js";
import { ZONE_OF } from "./zones.js";

export const DREAM_UPGRADES = [
  {
    // ★ 2026（用户：「照着原稿解锁的顺序解锁，没解锁的直接不显示」）
    unlockWhen: "always",   // ★ 2026（用户：判定太严，卡看不到）⇒ 先一律可见 ✓
    id: "autoPhase",
    name: "相变自动化",
    cost: 1,
    target: "phaseShift",
    desc: "自动购买「高效相变」",
    effect: { kind: "autoBuy", deUpgrade: "phaseShift" } },
  {
    // ★ 2026（用户：「照着原稿解锁的顺序解锁，没解锁的直接不显示」）
    unlockWhen: "always",   // ★ 2026（用户：判定太严，卡看不到）⇒ 先一律可见 ✓
    id: "autoVacuum",
    name: "加速自动化",
    cost: 1,
    target: "vacuumAccel",
    desc: "自动购买「真空加速」",
    effect: { kind: "autoBuy", deUpgrade: "vacuumAccel" } },
  // ★ 新增两条：覆盖前面的暗能量升级 4（相变增幅）和 5（凝聚斜率）。
  //   用户要求：梦想点经济要覆盖全部五条暗能量升级。
  {
    // ★ 2026（用户：「照着原稿解锁的顺序解锁，没解锁的直接不显示」）
    unlockWhen: "always",   // ★ 2026（用户：判定太严，卡看不到）⇒ 先一律可见 ✓
    id: "autoDeGainBase",
    name: "增幅自动化",
    cost: 1,
    target: "deGainBase",
    desc: "自动购买「相变增幅」",
    effect: { kind: "autoBuy", deUpgrade: "deGainBase" } },
  {
    // ★ 2026（用户：「照着原稿解锁的顺序解锁，没解锁的直接不显示」）
    unlockWhen: "always",   // ★ 2026（用户：判定太严，卡看不到）⇒ 先一律可见 ✓
    id: "autoConvOutput",
    name: "斜率自动化",
    cost: 1,
    target: "convOutput",
    desc: "自动购买「凝聚斜率」",
    effect: { kind: "autoBuy", deUpgrade: "convOutput" } },
  // ★★★ 2025（用户要求）：「4 个 h 有点短了，梦想页面自动化中建议多一个
  //   **消耗梦想点兑换更多离线时间**的升级」
  //
  // ── 设计 ──
  //   · **可重复购买（有等级）** —— 这是本项目第一个"有等级"的梦想升级，
  //     所以顺手给 `DREAM_UPGRADES` 加了通用等级支持（`repeatable` / `costMult` /
  //     `maxLevel`），不是给它开特例 ✓
  //   · **每级 +1 小时**（用户只说要"更多"，1 小时是直观刻度）
  //   · **最多 12 级 ⇒ 上限 4h + 12h = 16 小时**
  //     ⚠️ 必须有上限：离线结算耗时 ≈ 每小时 8ms × 分块，16 小时约 **80ms**
  //       （我实测：1 天 674ms、1 小时 191ms）⇒ 16 小时仍在"可接受的一次性卡顿"内 ✓
  //       再往上（如 7 天）就是 660ms 的卡顿了，不该由一次升级点开 ✗
  //   · **价格用梦想点**（用户说"消耗梦想点"）：
  //       第 1 级 2 梦想点，之后每级 ×2 ⇒ 2 / 4 / 8 / … / 4096（12 级合计 8190）
  //     梦想点收入在后期是充裕的，但 8190 是个真实门槛 ⇒ 这是长期目标 ✓
  {
    // ★ 2026（用户：「照着原稿解锁的顺序解锁，没解锁的直接不显示」）
    unlockWhen: "always",   // ★ 2026（用户）：离线时长**开局就有** ✓
    id: "offlineCap",
    name: "离线时长扩展",
    cost: 2,                 // 第 1 级价格（梦想点）
    costMult: 2,             // 每级价格 ×2（**可重复购买**）
    repeatable: true,
    maxLevel: 12,            // 12 级 ⇒ +12 小时 ⇒ 总上限 16 小时
    hoursPerLevel: 1,        // 每级 +1 小时
    desc: "离线时间上限 +1 小时/级（上限 16 小时）",
    effect: { kind: "offlineCap" } },
  // ★★★ 2026（用户裁定：「梦想升级全部迁到梦想页」「不是自动解锁而是手动解锁」）——
  //   **永恒自动化组**（`group: "emauto"`）：买下只是解锁能力，还要点右侧开关才生效 ✓
  //   代价一律「梦想点」；`effect.kind` 决定 UI 与实现（autoBuy / autoInfinities / keep*）✓
  {
    unlockWhen: "breakInfinity",   // 2026: 自动无限 ⇒ 至少要永恒过一次 ✓
    id: "autoInfinities",
    group: "emauto",
    name: "无限自动化",
    desc: "自动进行大坍缩（模式与阈值见「自动无限」小页，类 AD 的自动无限）",
    cost: 1,
    effect: { kind: "autoInfinities" },
  },
  {
    // ★ 2026（用户：「照着原稿解锁的顺序解锁，没解锁的直接不显示」）
    unlockWhen: "em8",
    id: "autoIpDouble",
    group: "emauto",
    name: "倍增自动化",
    desc: "自动买满「IP 点倍增」（买到买不动为止）",
    cost: 2,
    effect: { kind: "autoBuy", target: "ipDouble" },
  },
  {
    unlockWhen: "em8",   // ★ 2026：ZPE 引擎自动化 ⇒ 破∞后（引擎那时才解锁）
    id: "autoZpeEngine",
    group: "emauto",
    name: "引擎自动化",
    desc: "自动买满 ZPE 引擎等级（买到买不动为止）",
    cost: 2,
    effect: { kind: "autoBuy", target: "zpeEngine" },
  },
  {
    // ★ 2026（用户：「照着原稿解锁的顺序解锁，没解锁的直接不显示」）
    unlockWhen: "em8",
    id: "keepDeEternity",
    group: "emauto",
    name: "暗能量永存",
    desc: "永恒时与**无限（大坍缩）时**都**不再清空暗能量**（被动，无需开关）",
    cost: 3,
    effect: { kind: "keep", target: "darkEnergy" },
  },
  {
    // ★ 2026（用户：「照着原稿解锁的顺序解锁，没解锁的直接不显示」）
    unlockWhen: "em8",
    id: "engineAtStart",
    group: "emauto",
    name: "开局引擎",
    desc: "每次大坍缩后保留 1 级 ZPE 引擎（不必从 0 开始攒）",
    cost: 3,
    effect: { kind: "keep", target: "zpeEngineStart" },
  },
  {
    // ★ 2026（用户：「照着原稿解锁的顺序解锁，没解锁的直接不显示」）
    unlockWhen: "em8",
    id: "keepVoidEternity",
    group: "emauto",
    name: "虚空永存",
    desc: "永恒时**不再清空虚空升级**（被动，无需开关）",
    cost: 5,
    effect: { kind: "keep", target: "voidUpgrades" },
  },
];

export const DREAM_BY_ID = Object.fromEntries(DREAM_UPGRADES.map((d) => [d.id, d]));

/**
 * 汇总已购梦想点升级的效果。
 *
 * ⚠️ 默认值必须从 DE_UPGRADES 读，**不能硬编码**。
 *
 * 踩过：这里曾写死 `phaseShiftEffectMult: 1.5`，而 DE_UPGRADES 的 effectMult
 * 后来被削到 1.13 —— 于是「没买升级」的基准值变成错的，S 判据算出 1.19（实际 0.50）。
 *
 * 统一原则：**任何派生值都从唯一数据源算，不抄。**
 */
export function dreamUpgradeEffects(state) {
  const s = state ?? {};
  const out = {
    phaseShiftCostMult: DE_UPGRADES.phaseShift.costMult,
    phaseShiftEffectMult: DE_UPGRADES.phaseShift.effectMult,
    phaseShiftBaseMult: 1,
    vacuumAccelEffectMult: DE_UPGRADES.vacuumAccel.effectMult,
    /** 需要自动购买的暗能量升级 id 列表 */
    autoBuyDe: [],
    /**
     * ★★★ 2025：**离线时长上限的额外秒数**（用户要求"消耗梦想点兑换更多离线时间"）。
     * 由 `offlineCapBonusSeconds(state)` 汇总 —— 那才是唯一入口 ✓
     */
    offlineCapBonus: 0 };
  for (const d of DREAM_UPGRADES) {
    if (!s.dreamUpgrades?.[d.id]) continue;
    const e = d.effect;
    if (e.kind === "autoBuy") out.autoBuyDe.push(e.deUpgrade);
    // ★ 可重复梦想升级：按**等级**累加（`state.dreamUpgradeLevels[id]`）✓
    if (e.kind === "offlineCap") {
      out.offlineCapBonus += dreamUpgradeLevelOf(s, d.id) * (d.hoursPerLevel ?? 0) * 3600;
    }
  }
  return out;
}

/**
 * ★★★ 2025：`DREAM_UPGRADES` 的**等级**（一次性升级恒为 0 或 1）—— 唯一入口 ✓
 *
 * 为什么要它：`offlineCap` 是本项目第一个**可重复**的梦想升级
 *   （用户要求"兑换更多离线时间" ⇒ 必须能买多次）。
 *   原来 `state.dreamUpgrades[id]` 是个布尔；现在额外用
 *   `state.dreamUpgradeLevels[id]` 记等级，**布尔字段保持不变** ⇒ 旧档零破坏 ✓
 */
export function dreamUpgradeLevelOf(state, id) {
  const s = state ?? {};
  const lv = Number(s.dreamUpgradeLevels?.[id] ?? 0);
  if (Number.isFinite(lv) && lv > 0) return Math.floor(lv);
  // 兼容：老档只有布尔 ⇒ 视为 1 级 ✓
  return s.dreamUpgrades?.[id] ? 1 : 0;
}

/** 该梦想升级的**下一级价格**（`null` = 已满级）—— 唯一入口 ✓ */
export function dreamUpgradeCostAt(id, level) {
  const d = DREAM_BY_ID[id];
  if (!d) return null;
  const lv = Math.max(0, Number(level) || 0);
  if (d.repeatable) {
    if (d.maxLevel != null && lv >= d.maxLevel) return null;      // 满级
    // 价格 = `cost × costMult^等级` ⇒ 第 1 级 `cost`、第 2 级 `cost·mult` …
    // ⚠️⚠️ **整数幂必须走精确路径** —— `Decimal.pow(2, 3)` 会给 `15.999999999999998` ✗
    //   （这是本项目第 N 次栽在"库的 pow 不精确"上：`Decimal.pow` 内部走
    //     `pow10`(exp/log) 或 `Math.pow`，两者都带误差；而 `Decimal.mul` 连乘整数是精确的）
    //   价格是玩家天天看的数字，`15.999999999999998` 不能忍 ⇒ 用反复平方法（只用 `mul`）✓
    const mult = d.costMult ?? 1;
    const mag = Math.log10(d.cost) + lv * Math.log10(mult);
    let p;
    if (mag <= 15) {
      p = new Decimal(d.cost * Math.pow(mult, lv));               // 安全整数内 `Math.pow` 精确 ✓
    } else {
      let r = new Decimal(1), b = new Decimal(mult), e = lv;
      while (e > 0) {                                             // 反复平方（只用 `mul`）✓
        if (e & 1) r = r.mul(b);
        e >>>= 1;
        if (e > 0) b = b.mul(b);
      }
      p = new Decimal(d.cost).mul(r);
    }
    return p;
  }
  return lv > 0 ? null : new Decimal(d.cost);                       // 一次性：买了就没有下一级
}

/**
 * ★★★ 2025：**离线时间上限（秒）** —— 唯一入口 ✓
 *
 * = `BASE.offlineCapSeconds`（基础 4 小时）+ 已买的「离线时长扩展」等级 × 1 小时 ✓
 *
 * ⚠️ 必须唯一：原来 `main.js` 里两处**各自**读 `BASE.offlineCapSeconds`
 *   （一次夹结算时长、一次判"是否被截断"）⇒ 加了升级后那两处会不一致
 *   （结算按新上限、提示却说被截断）✗ —— 这正是本项目反复出现的"同一件事两条路"
 */
export function offlineCapSeconds(state) {
  const bonus = state ? dreamUpgradeEffects(state).offlineCapBonus : 0;
  return BASE.offlineCapSeconds + bonus;
}

// ══════════════════════════════════════════════════════════
// 自检：数值层的 S 判据（SPEC §2.4 / P10）
// ══════════════════════════════════════════════════════════

/**
 * 计算耦合判据 S = Σ log(m)/log(r)。
 *
 * ⚠️ 只有 **kind = "matterMul" / "globalMul"（指数形式 m^等级）** 才计入。
 *
 * 三种不计入的情况：
 *   · kind = "countFreqAdd" —— 效果是 `1 + k·等级`，**仿射（线性）**，不是乘法。
 *     累计效果 = (1 + 0.05n)，线性增长。它的贡献是 log(log I) 级，
 *     对 S 的影响是 0。原稿的 particleBoost 就是这种。
 *   · kind = "convAdd"  —— 加法产出 + 加法阈值，净转换率有硬上限。
 *   · 一次性升级 / 里程碑 —— 没有「等级」，不构成反馈环。
 *
 * S < 1 才是安全的。当前只有 matterBoost 一条计入。
 */
/**
 * 可重复乘法升级的耦合判据。
 *
 * ⚠️ **必须用运行时生效的值，不能用 config 里的静态值。**
 *
 * 这个函数踩过两次同一个坑：
 *   ① 只统计 REPEATABLE，漏掉暗能量的可重复升级
 *      -> phaseShift 的 r = m = 1.5（贡献 1.000）一直没被检查到
 *   ② 统计了，但读的是静态 cfg 值，没理会梦想点升级的覆盖
 *      -> 买了「相位锁定」之后 S 仍显示 0.5002，实际已经是 0.375
 *
 * 一个「检查」如果检查的不是运行时真值，它就等于没检查。
 *
 * @param {object} [state] 传入则计入梦想点升级的覆盖；不传则用基础值
 */
export function computeS(state) {
  // 不传 state 就用「什么都没买」的基准值 —— 同样从 dreamUpgradeEffects 推导
  const d = dreamUpgradeEffects(state);
  const parts = [];

  // ① 三条可重复升级
  for (const cfg of Object.values(REPEATABLE)) {
    if (cfg.kind === "convAdd" || cfg.kind === "countFreqAdd") continue;
    parts.push({ id: cfg.id, m: cfg.effect, r: cfg.costMult, kind: cfg.kind });
  }

  // ② 暗能量里**可重复**的升级
  for (const cfg of Object.values(DE_UPGRADES)) {
    if (cfg.maxLevel != null) continue;       // 有上限 = 有限次，不计入
    if (!cfg.costMult && !cfg.piecewise) continue;
    // ★ **必须有 effectMult 才算「乘法型」**。
    //   「凝聚斜率」改的是产出**斜率**（加法），没有 effectMult ——
    //   最初忘了这条判断，于是它被当成乘法升级塞进 S，m=undefined -> S=NaN。
    //   审计立刻抓到了（D4 项）。注释里写"不进 S 池"是不够的，得在代码里执行。
    if (!cfg.effectMult) continue;
    const m = cfg.id === "phaseShift"
      ? d.phaseShiftEffectMult
      : cfg.id === "vacuumAccel" ? d.vacuumAccelEffectMult
        // ★★★ 2026：`deGainBase` 的每级倍率会被 **em4** 抬高（1.10 → 1.12）⇒ **S 是状态相关的**：
        //   无 em4 ⇒ S = 0.7263；有 em4 ⇒ S = 0.7706（**两者都 < 1** ✓ 余量仍够）
        //   ⚠️ 不传 `state` 的调用方（`headless.mjs` / `tier4-*.mjs`）读到的是基础值 ⇒ 零回归 ✓
        : cfg.id === "deGainBase" ? deGainBaseEffectMult(state)
          : cfg.effectMult;
    let r = cfg.costMult;
    // ★ 分段曲线（piecewise）对 S 的贡献由**最小的 r** 支配，
    //   因为单条升级的 S = log(m)/log(当前那一级的 r)，r 越小 S 越大。
    if (cfg.piecewise) r = Math.min(PIECEWISE.r1, PIECEWISE.r2, PIECEWISE.r3);
    parts.push({ id: cfg.id, m, r, kind: "deUpgrade" });
  }

  // ③ 「凝聚斜率」改的是**产出斜率**，不是乘法倍率，所以不进 S 池。
  //    上限 = (0.15+0.5+0.05L)/3 随 L 线性增长，而 L ∝ log(资源) —— 对数增长。
  //    （这条要显式写出来，否则以后有人会以为它被漏掉了。）

  let S = 0;
  for (const p of parts) S += Math.log(p.m) / Math.log(p.r);
  return { S, parts };
}

/** 只统计第四层（zone = dm）的贡献，用来控制新层的预算 */
export function computeTier4S() {
  const all = computeS();
  return {
    total: all.S,
    tier4: all.parts.filter((p) => ZONE_OF[p.id] === "dm")
      .reduce((s, p) => s + Math.log(p.m) / Math.log(p.r), 0) };
}

// ══════════════════════════════════════════════════════════
// 作用乘区（UI 用颜色区分）
// ══════════════════════════════════════════════════════════

/**
 * 每个升级「作用在哪个乘区」。
 *
 * 为什么值得用颜色标出来：SPEC 判据 P7 说「纯乘法链上乘法因子位置无关」，
 * 但玩家看不出来。给同一乘区的升级上同一个颜色，玩家一眼就能知道
 * 「这两条是叠在同一个位置上的」——这正是判断「是否重复」的直觉来源。
 *
 * 六个乘区对应经济链上的六个位置：
 *   物质 → 熵阱 → ZPE ──> 熵 ──(转换)──> 粒子 ──> 物质
 *                              ↑                        │
 *                              └────────────────────────┘
 */
export const PIECEWISE = { p1: 1e10, p2: 1e308, r1: 3, r2: 1.5, r3: 2 };

/** 分段价格：第 lv 级的价格（O(1) 闭式解） */
export function piecewiseDeCost(base, lv) {
  // config.js 里没有 D() 辅助函数（那是 state.js 的），所以直接用 new Decimal
  const dec = (v) => (v instanceof Decimal ? v : new Decimal(v));
  const B = dec(base);
  const { p1, p2, r1, r2, r3 } = PIECEWISE;
  const P1 = dec(p1), P2 = dec(p2);
  const n = lv instanceof Decimal ? lv.toNumber() : Number(lv);
  if (!(n > 0)) return B;

  // ① 第一段要几级才到 P1
  const a = B.gte(P1) ? 0 : Math.ceil(P1.div(B).log(r1).toNumber());
  if (n <= a) return B.mul(Decimal.pow(r1, n));
  const pA = B.mul(Decimal.pow(r1, a));          // 第一段结束时的价格

  // ② 第二段要几级才到 P2
  const b = pA.gte(P2) ? 0 : Math.ceil(P2.div(pA).log(r2).toNumber());
  if (n <= a + b) return pA.mul(Decimal.pow(r2, n - a));
  const pB = pA.mul(Decimal.pow(r2, b));         // 第二段结束时的价格

  // ③ 之后 ×r3
  return pB.mul(Decimal.pow(r3, n - a - b));
}

/**
 * 分段曲线对 S 的贡献。
 * 由**最小的 r**（= 最贵的那段）支配，因为 S = log(m)/log(r)。
 */
export function piecewiseSContribution(m) {
  const worstR = Math.min(PIECEWISE.r1, PIECEWISE.r2, PIECEWISE.r3);
  return Math.log(m) / Math.log(worstR);
}


