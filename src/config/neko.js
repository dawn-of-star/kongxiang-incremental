/**
 * config/neko.js —— N.E.K.O 好感度、道具、动作白名单
 *
 * ⚠️ 本文件由 `src/config.js` 按领域机械拆分而来：**声明与注释逐字保留**。
 *    对外仍然统一从 `src/config.js`（barrel）导入 —— 不要直接改这里的 import 路径。
 *    依赖：eternity ｜ Decimal
 */
import Decimal from "../../dist/break_eternity.esm.js";
import { em2BonusMult, em7BonusMult } from "./eternity.js";

export const NEKO = {
  /** 好感度下限 / 上限（`max` 是"软展示"上限，正值允许超过它 ✓） */
  min: -100,
  max: 100,
  /** 三档门槛（**严格大于** —— NEKO.md 写的是 `> 25` 等）*/
  tiers: [
    { need: 25, pow: 1.002 },
    { need: 50, pow: 1.005 },
    { need: 75, pow: 1.015 },
  ],
  /** 波动上限（每 5 分钟）：原生 / 接入 SDK 后 */
  driftWindowSec: 300,
  driftMax: 8,
  driftMaxSdk: 16,
};

/**
 * ★★★ 2025 **em2**（设计稿第 38 行）：「neko 系统提供的全局加成效果翻倍（**数值翻倍**）」。
 *
 * 语义（用户裁定 = 「翻倍**加成部分**」）：
 *   指数 = `1 + NEKO_BONUS_DOUBLE × (三档叠乘 − 1)`
 *   · 未达 em2（或未买）⇒ 倍率 `1`（原样，零回归 ✓）
 *   · 达 em2 ⇒ 倍率 **`2`** ⇒ `1.0221151` 变成 **`2.0442302`** ✓
 */
export const NEKO_BONUS_DOUBLE = 2;

/**
 * 好感度给出的**全局加成指数**（唯一入口 ✓）。
 *
 * `全局加成 ^= 本函数`。三档**叠乘**（NEKO.md §7「叠乘」）。
 * ⚠️ 未达门槛 / 好感度为负 ⇒ 恒 **1**（负面不影响游戏进程 ✓）
 *
 * ★★★ 2025：**em2 落地**（设计稿第 38 行）——
 *   `em2` 达成后把**加成部分**（`e − 1`）翻 `NEKO_BONUS_DOUBLE` 倍 ✓
 *   ⚠️ 必须**只翻加成部分**：若直接 `e × 2`，好感度 ≤ 25（`e` 恒 1）时
 *     会变成 2 ⇒ **白送一个全局平方**、"neko 没练就完全没加成"的语义被破坏 ✗
 *     （用户裁定选的就是"翻倍加成部分"这一项）
 */
export function nekoGlobalExponent(state) {
  const a = Number(state?.nekoAffinity ?? 0) || 0;
  if (!(a > NEKO.tiers[0].need)) return 1;          // ≤25（含负数）⇒ 无加成 ✓
  let e = 1;
  for (const t of NEKO.tiers) if (a > t.need) e *= t.pow;
  // ★ em2：翻倍**加成部分**（`e − 1`）⇒ 未达成时倍率为 1、达成为 2 ✓
  const mult = em2BonusMult(state) * em7BonusMult(state);   // ★ 2026：em7 再翻倍 ✓
  return 1 + mult * (e - 1);
}

/**
 * ★★★ 2025 **em2** 的倍率读数（`1` 或 `NEKO_BONUS_DOUBLE`）—— **唯一入口** ✓
 *
 * 为什么单独抽出来：UI 要显示"当前加成倍数"（与 `em5` 显示 `×N` 同一套做法），
 *   而 UI **不许自己判** `eternityCount >= 2` ✗（那又是一条"显示 ≠ 实发"的路）
 *   ⇒ 判据只在这里，公式与显示都读它 ✓
 */
export function addNekoAffinity(state, delta, { sdk = false, now = Date.now() } = {}) {
  if (!state) return 0;
  const cur = Number(state.nekoAffinity ?? 0) || 0;
  const want = Number(delta) || 0;
  if (want === 0) return 0;
  // ── 窗口预算：最近 `driftWindowSec` 内所有写入的**绝对值之和** ≤ driftMax ──
  const budget = sdk ? NEKO.driftMaxSdk : NEKO.driftMax;
  const winMs = NEKO.driftWindowSec * 1000;
  const stamps = (Array.isArray(state.nekoDriftStamps) ? state.nekoDriftStamps : [])
    .filter((s) => Array.isArray(s) && s.length === 2 && now - s[0] < winMs);
  const used = stamps.reduce((a, s) => a + Math.abs(Number(s[1]) || 0), 0);
  const room = Math.max(0, budget - used);
  let applied = want;
  if (Math.abs(want) > room) applied = Math.sign(want) * room;      // 削减到窗口剩余额度
  if (applied === 0) { state.nekoDriftStamps = stamps; return 0; }
  const next = Math.max(NEKO.min, Math.min(NEKO.max, cur + applied));
  const real = next - cur;                                          // 封顶后真实变化
  state.nekoAffinity = next;
  if (real !== 0) stamps.push([now, real]);
  state.nekoDriftStamps = stamps;
  return real;
}

/** 距离下一档还差多少（UI 用；已全开返回 null） */
export function nekoNextTier(state) {
  const a = Number(state?.nekoAffinity ?? 0) || 0;
  for (const t of NEKO.tiers) if (!(a > t.need)) return t;
  return null;
}

// ══════════════════════════════════════════════════════════
// ★★★ 2025（`docs/NEKO.md` §6）：**猫娘的动作白名单**
// ══════════════════════════════════════════════════════════
// §6 原文的三条**硬约束**（也是本项目的既有判据）：
//   ① **阶段白名单**：动作只能作用于玩家**已经到达**的阶段（不会替玩家越过门槛）
//   ② **只走既有购买函数**：不自己写扣款逻辑（踩过"自动化与手动双倍发放"的坑）
//   ③ **限流 + 幂等**：每 tick 最多 N 次动作；重复调用同一动作不叠加
//
// ⚠️ 另外一条（§6 末尾）：**猫娘驱动的自动化不花游戏内的梦想点**，
//   也不占用玩家已买的自动化升级槽位 ⇒ 它是**独立通道**，不是"替玩家买升级" ✓
//
// 这个对象是**纯数据**：动作名 → 说明。真正的派发在 `neko.js`（那里才知道引擎函数）。
// 放在 config 是为了让 UI / 文档 / 断言**共用同一份清单**（不许各写一份 ✗）。
export const NEKO_ACTIONS = {
  buyRepeatable: "买三条主升级（走同一个购买函数）",
  buyVoidUpgrade: "买虚空升级",
  buyDeUpgrade: "买暗能量升级",
  buyInfinityUpgrade: "买无限升级（含 ① 无限增幅）",
  doBigCrunch: "大坍缩",
  doEternity: "永恒",
  /** 猫娘的自动化通道（**不消耗梦想点**、不占玩家槽位 —— §6 末尾） */
  setAuto: "开关自动化",
};

/**
 * 每个 tick 最多接受多少条动作（§6 的"限流"）。
 * ⚠️ 取用户指定的量级（"每 tick 最多 N 次"）⇒ 8 条；超出的**丢掉并计数**，
 *   不报错（对面是 LLM，不该因为多发了几条就整批失败）✓
 */
export const NEKO_MAX_ACTIONS_PER_TICK = 8;

/** 派发动作的结果形状（`NEKO.md` §4 的 `ResultPublisher` 要用） */
export const NEKO_ACTION_RESULT = {
  OK: "ok",
  UNKNOWN: "unknown_action",
  THROTTLED: "throttled",
  REJECTED: "rejected",
};

// ══════════════════════════════════════════════════════════
// ★★★ 2025（设计稿第 27 行 / 用户裁定）：**主面板的折叠分组**
// ══════════════════════════════════════════════════════════
// 设计稿原文：「…**升级中心 / 点击获取熵 / 各项加成比例都合并为主面板页面下**
//              （这些页面在自动化后玩家不会在意的）」
// 用户裁定：「我要是用户估计会倾向于 **b 方案**（可折叠）—— 建议有个**下拉条**，
//            同时下拉条中有个**复选框**以确认**记住展开状态**」
//
// ⚠️ 默认值 = **收起**（设计稿的理由是"自动化后玩家不会在意的" ⇒ 默认不占屏幕）
export const NEKO_ITEMS = {
  /** 免费猫条：稿子明写"免费" ⇒ 唯一成本是**波动窗口预算**（§7 每 5 分钟 < 8 点） */
  catFood: {
    id: "catFood", name: "猫条", gain: 1,
    costText: "免费",
    /** 买得起吗（**不扣**，真正的扣款在 `useNekoItem` 里 —— 只走那一个入口 ✓） */
    can: () => true,
  },
  /** 棒棒糖：消耗**当前所有物质**（稿子原文） */
  lollipop: {
    id: "lollipop", name: "棒棒糖", gain: 3,
    costText: "当前所有物质",
    can: (s) => (s?.resources?.matter ?? new Decimal(0)).gt(0),
  },
  /** 猫爪：换取**当前所有 ZPE**（稿子原文） */
  paw: {
    id: "paw", name: "猫爪", gain: 5,
    costText: "当前所有 ZPE",
    can: (s) => (s?.zpe ?? new Decimal(0)).gt(0),
  },
};

/**
 * 使用一个好感度道具（**唯一入口** ✓）。
 *
 * 纪律：
 *   · 扣款与好感度写入**都在这里**（不许别处再写一遍 ⇒ "双倍发放"是本项目踩过的坑）✓
 *   · 好感度写入走 `addNekoAffinity`（**唯一写入点**）⇒ 天然受 §7 的波动窗口限制 ✓
 *     ⚠️ 因此可能出现"资源扣了、好感度没加满"——那是**设计如此**（窗口预算），
 *        函数返回**真实增量**让 UI 能如实显示 ✓
 * @returns {{ok:boolean, gain:number, reason?:string}} gain = **实际**加了多少好感度
 */
export function useNekoItem(state, id) {
  const it = NEKO_ITEMS[id];
  if (!it) return { ok: false, gain: 0, reason: "未知道具" };
  if (!it.can(state)) return { ok: false, gain: 0, reason: `需要：${it.costText}` };
  // ── 先问窗口预算：**一点都加不了就别扣资源**（否则玩家白丢物质/ZPE ✗）──
  const room = nekoDriftRoom(state, false);
  if (room <= 0) return { ok: false, gain: 0, reason: "窗口额度已用完（每 5 分钟 < 8 点）" };
  // ── 扣款 ──
  //   ⚠️ config.js 里没有 `D()` 辅助（那是 `state.js` 的）⇒ 用 `new Decimal(0)` ✓
  if (id === "lollipop") state.resources.matter = new Decimal(0);
  else if (id === "paw") state.zpe = new Decimal(0);
  // ── 加好感度（唯一写入点）──
  const gain = addNekoAffinity(state, it.gain);
  return { ok: true, gain };
}

/** 当前波动窗口还剩多少额度（UI 用；`sdk` = 接入后的放宽档） */
export function nekoDriftRoom(state, sdk = false, now = Date.now()) {
  const budget = sdk ? NEKO.driftMaxSdk : NEKO.driftMax;
  const winMs = NEKO.driftWindowSec * 1000;
  const stamps = Array.isArray(state?.nekoDriftStamps) ? state.nekoDriftStamps : [];
  const used = stamps
    .filter((s) => Array.isArray(s) && s.length === 2 && now - s[0] < winMs)
    .reduce((a, s) => a + Math.abs(Number(s[1]) || 0), 0);
  return Math.max(0, budget - used);
}

// ══════════════════════════════════════════════════════════
// 第四层：临界坍缩（红色）
// ══════════════════════════════════════════════════════════

/**
 * 设计推导（这一步的数值是算出来的，不是拍的）：
 *
 *   坍缩阈值  T_n = 1e25 × 10^(10n)      每档 ×1e10
 *   暗物质    DM_n = 10n                 每次 +10
 *   全局加成  M    = 10^DM
 *
 *   验算：M_n = 10^(10n)，而 T_n = 1e25 × 10^(10n) = 1e25 × M_n
 *   => **每轮只需要把「基础曲线」推到 1e25，剩下的全部由倍率承担。**
 *      所以每轮耗时恒定，是个能自持的循环。
 *
 *   目标 1e308.25（= log10(Number.MAX_VALUE)，即 JS 双精度上限，
 *   也正是 AD「首次无限」的触发点）：
 *       需要 M = 1e283.25 -> DM = 283.25 -> **29 次坍缩**
 *
 * ⚠️ 关键：**1e25 是每轮的固定距离**，所以 S 杠杆（第四层的乘法升级）
 *    决定的是「一轮多快」，而不是「能到多高」。高度由倍率负责。
 */

