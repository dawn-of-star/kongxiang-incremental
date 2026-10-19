/**
 * ui-core.js —— UI 层的地基（乘区上色 / 效果文案 / 格式化 / 共享回调）
 *
 * ★ 2026 模块化：从 2,784 行的 ui.js 抽出的**唯一共享内核**。
 *   · DOM 缓存/写入去重已下沉到 `ui-cache.js`；这里只 re-export
 *   · 本文件不 import 任何面板模块 ⇒ 依赖方向单一：panels → core → config/formulas/state
 *
 * ⚠️ 不要在这里放具体面板的渲染逻辑（那会让"地基"重新长成 god module）。
 */
import Decimal from "../dist/break_eternity.esm.js";
import { REPEATABLE, ZONE_OF, zoneOf } from "./config.js";
import { countFreqAddTerm, conversion } from "./formulas.js";
import { levelOf } from "./state.js";
import { fmt, fmtMult, fmtTime, sci } from "./format.js";

// ★ 既有调用方（tools/dom-smoke、面板模块）统一从 core 取格式化函数
export { fmt, sci, fmtMult, fmtTime };
// ★ DOM 缓存层（ui-cache.js）：panels 仍然只从 ui-core 取 el/$
export { $, el, cache, domWriteStats, domResetStats } from "./ui-cache.js";


/**
 * ★★★ 2025：**模块构建标记**。
 *
 * 为什么需要它：用户的 HUD 连续两次都没有我新加的行 ⇒
 *   无法区分"代码有 bug"和"浏览器在跑旧缓存"（我为此浪费了好几轮）✗
 * ⇒ HUD 会显示这个标记；**改代码时把它 +1**，就能一眼确认加载的是哪一份 ✓
 */
export const UI_BUILD = "ui-2025-07-14-a";


/**
 * 给元素加上乘区颜色 class，并附带一条 <span class="zone-tag">。
 *
 * ⚠️ 虹色（梦想系统）是特例：它没有单一颜色，走 `.rainbow-card` / `.rainbow` 那套，
 *   所以这里对 `z.rainbow` 分支单独处理 —— 否则会加一个不存在的 `zone-dream`。
 */
export function applyZone(el, id, showTag = true) {
  // ★ 参数兼容守卫：历史上有 `applyZone(cfg.id)` 这种**只传 id** 的调用 ✗
  //   （把字符串当元素用 ⇒ el.classList 为 undefined ⇒ 构建期抛 TypeError ✗）
  if (typeof el === "string" && (id === undefined || id === null || !id.classList)) { const t = el; el = id; id = t; }
  if (!el || !el.classList) return;   // 拿不到元素就静默跳过 ✓（但不影响别的 ✓）
  const z = zoneOf(id);
  const key = ZONE_OF[id];
  if (z.rainbow) el.classList.add("rainbow-card");
  else if (key) el.classList.add("zone", `zone-${key}`);
  // ★ 2025：**未登记乘区** ⇒ 只回退到默认色，**不加** `zone-undefined` ✗
  //   （旧写法会加一个不存在的 class：按钮看着"没颜色"，但在 DOM 里查不出原因）
  else el.classList.add("zone");
  // ⚠️ 未登记的 id 要能**被发现**，不能静默 —— 项目规矩：漏登记过一次
  //   （deGainBase / convOutput / 四条梦想升级都漏过，表现为"加成区不对"）
  if (!key && typeof console !== "undefined") {
    console.warn(`[zone] id "${id}" 未在 ZONE_OF 登记 ⇒ 拿不到乘区色（见 config.js 的 ZONE_OF）`);
  }
  if (showTag) {
    const tag = document.createElement("span");
    tag.className = "zone-tag";
    tag.textContent = z.cn;
    const row = el.querySelector(".btn-row");
    if (row) row.appendChild(tag);
  }
}


/**
 * 升级卡片的「当前效果」文本。
 *
 * ⚠️ **必须从公式推导，不能手写字符串。**
 *
 * 踩过的坑：`config.js` 里 `particleBoost.desc` 写的是 `×1.1^等级`（乘法），
 * 而 `formulas.js` 里的实际实现是 `countFreqAddTerm = 1 + 0.05×等级`（仿射）。
 * 100 级时卡片显示 ×13780，实际只有 ×6 —— 差 2000 倍。
 * 而且这个 bug 是从原稿 0.3.4 继承来的（那边 `getCurrentEffect()` 写 1.1^lv，
 * `engine.js` 用 1+lv×0.05）。
 *
 * 结论：**描述由公式算，就不会再脱节。**
 */
export function effectText(state, id) {
  if (id === "particleBoost") {
    // 实际是仿射（加法）形式，不是 m^等级
    return `所有产出 ×${countFreqAddTerm(state).toNumber().toFixed(2)}`;
  }
  if (id === "matterBoost") {
    const lv = levelOf(state, id);
    return `物质产出 ${fmtMult(Decimal.pow(REPEATABLE.matterBoost.effect, lv))}`;
  }
  if (id === "entropyCoeff") {
    // 直接用 conversion()，和熵凝聚规则那块显示的是同一个数
    const { threshold, output } = conversion(state);
    const rate = output.div(threshold);
    return rate.gte(1)
      ? `1 熵 = ${fmt(rate)} 粒子`
      : `消耗 ${fmt(threshold)} 熵 → ${fmt(output)} 粒子`;
  }
  return "";
}


export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ══════════════════════════════════════════════════════════
// 量子面板（第四层，红色）
// ══════════════════════════════════════════════════════════



/**
 * ★★★ 2026（用户：「基础物质又崩溃不显示了」）—— **容错包装**：
 *   任何一个子面板抛异常，都不许把整帧渲染打断 ✗（否则物质/读数全部停住 ✓）
 *   ⇒ 逐个 try/catch + 只在控制台报一次（带模块名，方便定位 ✓）
 */
const _safeSeen = new Set();
export function safePaint(name, fn) {
  try { fn(); } catch (e) {
    if (!_safeSeen.has(name)) {
      _safeSeen.add(name);
      console.error(`[paint:${name}] 渲染失败（本帧其余部分照常）`, e);
    }
  }
}



/**
 * 交互回调（由 `initUI` 注入）。
 * 面板模块（七巧板等）需要触发「状态已改，请存档/记日志」时读它 ——
 * 放在 core 是为了避免 panels → ui.js（orchestrator）的反向依赖。
 */
export let uiHandlers = null;
export function setUIHandlers(h) { uiHandlers = h; return uiHandlers; }

