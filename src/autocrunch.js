/**
 * ★★★ 2026：**自动无限**（照 AD 的 Big Crunch autobuyer）
 *
 * ⚠️ 独立模块（本轮教训：别往 engine.js 里塞代码）；engine 只调一行：
 *     `maybeAutoCrunch(state, doBigCrunch);`
 *   —— 把 `doBigCrunch` 当**参数**传进来，避免 engine ⇄ 本模块的循环 import ✓
 *
 * 与 AD 的对应关系（`docs/ETERNITY-AUTO.md`）：
 *   · AD `AUTO_CRUNCH_MODE`：AMOUNT / TIME / X_HIGHEST ⇒ 这里是 `amount` / `time` / `xHighest` ✓
 *   · AD 的「最小间隔 100ms」上限 ⇒ `fireDelayMs = 100`（**用户裁定：判据成立后 0.1s 才坍缩**）✓
 *   · AD 的 `increaseWithMult` 复选框 ⇒ `dynamic`（阈值随 IP 倍率抬升）✓
 *
 * ⚠️ 本模块的数值就是**唯一数据源**（与 `tangram.js` 自带表同一范式）✓
 */
import Decimal from "../dist/break_eternity.esm.js";
// ★ 2026：自动坍缩的"开/关"统一走 `autoEnabled`（已买 + 已开）。
//   ⚠️ `dream-effects.js` 只 import Decimal ⇒ **不会**形成循环依赖 ✓
import { autoEnabled } from "./dream-effects.js";

const D = (x) => new Decimal(x);

export const AUTO_CRUNCH = {
  /** 默认模式（AD 默认 X_HIGHEST）✓ */
  defaultMode: "xHighest",
  /** 三种模式 × 默认阈值（可改）✓ */
  modes: [
    { id: "amount", name: "按收益", unit: "IP", def: "1" },
    { id: "time", name: "按时间", unit: "秒", def: 0.1 },   // ★ 用户指定：**默认 0.1 秒** ✓
    { id: "xHighest", name: "× 上次最高", unit: "倍", def: "2" },
  ],
  defaults: { amount: "1", time: 0.1, xHighest: "2" },   // ★ time 默认 0.1 秒（用户指定）✓
  /** ★ 用户裁定：判据成立后 **0.1 秒**才真正坍缩（= AD 的最小间隔 100ms 上限）✓ */
  fireDelayMs: 100,
  /** 动态阈值系数（买了 IP 倍率升级会抬高 amount 阈值；买了 ipTime 就不抬）✓ */
  dynamicAmountMult: 2,
};

/** 状态字段的**默认值**（`state.js` 用它初始化 / 自愈）✓ */
export function defaultAutoCrunch() {
  return {
    isActive: false,                        // ⚠️ 默认**关**：必须先买 `autoInfinities` 才解锁能力 ✓
    mode: AUTO_CRUNCH.defaultMode,
    amount: AUTO_CRUNCH.defaults.amount,
    time: AUTO_CRUNCH.defaults.time,
    xHighest: AUTO_CRUNCH.defaults.xHighest,
    dynamic: false,
    /** 上次坍缩的**单调时钟**毫秒数（冷却用；不随坍缩归零）✓ */
    lastAtMs: 0,
  };
}

/** 当前模式的阈值（动态阈值只影响 `amount`）✓ */
export function autoCrunchThreshold(state) {
  const a = state?.autoCrunch ?? defaultAutoCrunch();
  const mode = AUTO_CRUNCH.modes.some((m) => m.id === a.mode) ? a.mode : AUTO_CRUNCH.defaultMode;
  if (mode === "time") return Math.max(0, Number(a.time ?? AUTO_CRUNCH.defaults.time) || 0);
  if (mode === "xHighest") return D(a.xHighest ?? AUTO_CRUNCH.defaults.xHighest);
  let amt = D(a.amount ?? AUTO_CRUNCH.defaults.amount);
  if (a.dynamic) {
    // 每买一级 IP 倍率 ⇒ 阈值 ×2（AD 的 increaseWithMult）；买了 ipTime 就不抬 ✓
    if (state?.ipTimeBought !== true) {
      const lv = Math.max(0, Math.floor(Number(state?.ipDoubleLevel ?? 0)));
      amt = amt.mul(D(AUTO_CRUNCH.dynamicAmountMult).pow(lv));
    }
  }
  return amt;
}

/**
 * ★ **判据**（与 AD 逐条对齐）✓
 *   `lastGain` = 本永恒**单次**大坍缩收益的最高纪录（不是余额 ✗）
 *   ⚠️ AD 用的是 `thisEternity.maxIP`（余额），但我们的经济里余额能到 1e50、单次收益只有 1~2
 *      ⇒ 照 AD 字面写会**永远不触发** ✗ ⇒ 这里比"单次收益纪录"✓
 */
export function shouldAutoCrunch(state, ctx = {}) {
  const a = state?.autoCrunch;
  // ★★★ 2026 修 bug（用户：「梦想（自动化）页面的自动化升级都不正常工作」）：
  //   `autoInfinities` 原来判 `state.dreamUpgrades.autoInfinities === true`（**买下就生效**），
  //   完全无视梦想页的开关 `autoToggles.autoInfinities` ⇒ 开关是**摆设** ✗
  //   而且它还有**第二个开关** `autoCrunch.isActive`（自动坍缩面板上的开/关）⇒ 两个开关互不同步 ✗
  //   ⇒ 现在统一走 `autoEnabled()`（唯一判定：**已买 + 已开**）✓
  //     老档的 `autoCrunch.isActive` 由 `state.deserialize` 迁移进 `autoToggles` ✓
  if (!a) return false;
  if (!autoEnabled(state, "autoInfinities")) return false;
  if (!state?.brokenInfinity) return false;
  const mode = AUTO_CRUNCH.modes.some((m) => m.id === a.mode) ? a.mode : AUTO_CRUNCH.defaultMode;
  const thr = autoCrunchThreshold(state);
  if (mode === "time") {
    return Number(ctx.runElapsed ?? state?.runElapsed ?? 0) >= Number(thr);
  }
  const gain = D(ctx.gain ?? state?.infinityPoints ?? 0);
  if (mode === "xHighest") {
    // ★★★ 2026（用户纠正）**AD 的 X_HIGHEST 是什么**：
    //   「本次无限时，如果能**超越目前持有 IP 的一定倍值**，就无限一次」
    //   ⇒ 判据 = **本次坍缩收益** ≥ **当前持有 IP** × N ✓
    //   （我先前写成"比本永恒单次收益纪录" ✗ 那是错的）
    //   ⚠️ 因为 ZPE 引擎的存在，这个条件**天生会成立** ✓（收益随引擎等级增长 ✓）
    const held = D(state?.infinityPoints ?? 0);
    if (held.lte(0)) return true;                 // 一分没有 ⇒ 立刻坍（AD 同义）✓
    return gain.gte(held.mul(D(thr)));
  }
  return gain.gte(D(thr));
}

/** 备用：单次收益 = 当前会拿到的 IP（engine 传 ctx.gain 时优先用它）✓ */
function bigCrunchGainOf(state) {
  const ip = D(state?.infinityPoints ?? 0);
  return ip;      // 简化：以当前 IP 作为"本次收益"的下界（engine 会传准确值）
}

/**
 * **每 tick 调一次**：判据成立 + 冷却已过 ⇒ 坍缩 ✓
 * @returns {boolean} 是否真的坍缩了
 */
export function maybeAutoCrunch(state, doBigCrunch, gainFn) {
  const a = state?.autoCrunch;
  if (!a) return false;
  // ★ 2026：统一判据 —— **已买 `autoInfinities` + 梦想页开关已开**（唯一入口 `autoEnabled`）✓
  //   ⚠️ 不再看 `a.isActive`（那是第二个开关 ⇒ 互不同步）；老档值已在 deserialize 迁移 ✓
  if (!autoEnabled(state, "autoInfinities")) return false;
  if (!state?.brokenInfinity) return false;
  const nowMs = Number(state?.playTimeMs ?? 0) || 0;
  const lastMs = Number(a.lastAtMs ?? 0) || 0;
  if (nowMs - lastMs < AUTO_CRUNCH.fireDelayMs) return false;     // ★ 0.1s 冷却 ✓
  const gain = typeof gainFn === "function" ? gainFn(state) : state?.infinityPoints;
  if (!shouldAutoCrunch(state, { gain })) return false;
  a.lastAtMs = nowMs;
  doBigCrunch(state);
  return true;
}

/**
 * 开/关 —— ★ 2026：**只写梦想页那个开关** `autoToggles.autoInfinities`
 *   （唯一开关；引擎只认它。`autoCrunch.isActive` 已弃用，仅老档迁移时读一次）✓
 */
export function setAutoCrunchActive(state, on) {
  state.autoToggles ??= {};
  if (on === true) state.autoToggles.autoInfinities = true;
  else delete state.autoToggles.autoInfinities;
  return state.autoToggles.autoInfinities === true;
}
export function setAutoCrunchMode(state, mode) {
  if (!AUTO_CRUNCH.modes.some((m) => m.id === mode)) return false;
  state.autoCrunch ??= defaultAutoCrunch();
  state.autoCrunch.mode = mode;
  return true;
}
export function setAutoCrunchValue(state, mode, value) {
  state.autoCrunch ??= defaultAutoCrunch();
  if (mode === "time") { state.autoCrunch.time = Math.max(1, Number(value) || 1); return true; }
  if (mode === "amount") { state.autoCrunch.amount = String(value ?? "1"); return true; }
  if (mode === "xHighest") { state.autoCrunch.xHighest = String(value ?? "2"); return true; }
  return false;
}
