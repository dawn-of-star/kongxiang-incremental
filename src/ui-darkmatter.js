/**
 * ui-darkmatter.js —— 暗物质 / 第二台相变仪面板
 *
 * ★ 2026 模块化：从 ui.js 抽出的**独立面板渲染器**。
 *   · DOM 缓存/去重/格式化一律来自 `./ui-core.js`（本文件不定义地基）
 *   · 只被 `ui.js` 的 render() 调用（单向依赖）
 */

import { DARK_MATTER, ETERNITY_MILESTONES, darkMatterAdditiveTerm, darkMatterAffordableIn, darkMatterCount, darkMatterEffectMult, darkMatterPriceAt, darkMatterTargetMult, darkMatterUnlocked, secondTransmuterSpeed } from "./config.js";
import { D } from "./formulas.js";
import { $, el, fmt, fmtMult } from "./ui-core.js";
import Decimal from "../dist/break_eternity.esm.js";

export function renderDarkMatter(state) {
  const unlocked = darkMatterUnlocked(state);
  if (el["darkm-locked"]) el["darkm-locked"].hidden = unlocked;
  if (el["darkm-content"]) el["darkm-content"].hidden = !unlocked;

  // ── 标签上的角标：把"个数"直接显示出来（用户原则：没有 ui 很容易误判）──
  if (el["tab-tag-de"]) { /* 暗能量标签自己的角标由 renderDe 写（暗能量余额）*/ }
  if (!unlocked) {
    if (el["darkm-unlock-cond"]) {
      const need = ETERNITY_MILESTONES.find((m) => m.id === "em4")?.need ?? 4;
      const cur = Math.max(0, Number(state?.eternityCount ?? 0) || 0);
      el["darkm-unlock-cond"].innerHTML =
        `<div class="${cur >= need ? "ok" : "no"}">${cur >= need ? "✓" : "✗"} `
        + `永恒里程碑 em4（第 ${need} 次永恒）—— 当前第 ${cur} 次</div>`;
    }
    if (el["darkm-locked-title"]) el["darkm-locked-title"].textContent = "暗物质未解锁";
    return;
  }

  const n = darkMatterCount(state);
  const price = darkMatterPriceAt(n);
  const ep = state.eternityPoints ?? D(0);
  const afford = darkMatterAffordableIn(n, ep);
  const speed = secondTransmuterSpeed(state);
  const eff = Math.min(1, speed / DARK_MATTER.v2Ref);
  const target = darkMatterTargetMult(state);
  const effect = darkMatterEffectMult(state);
  const term = darkMatterAdditiveTerm(state);

  if (el["darkm-count"]) el["darkm-count"].textContent = String(n);
  if (el["darkm-price"]) el["darkm-price"].textContent = `${fmt(price, 0)} 永恒点`;
  if (el["darkm-ep"]) el["darkm-ep"].textContent = fmt(ep, 0);
  if (el["darkm-afford"]) el["darkm-afford"].textContent = String(afford);
  if (el["darkm-speed"]) el["darkm-speed"].textContent = fmt(new Decimal(speed), 3);
  if (el["darkm-eff"]) el["darkm-eff"].textContent = `${fmt(new Decimal(eff * 100), 1)}%`;
  if (el["darkm-target"]) el["darkm-target"].textContent = fmtMult(new Decimal(target));
  if (el["darkm-effect"]) el["darkm-effect"].textContent = fmtMult(new Decimal(effect));
  if (el["darkm-term"]) el["darkm-term"].textContent = `+${fmt(new Decimal(term), 4)}`;

  // ── ★★★ 2026：**第二台相变仪的动态环**（用户要求：形制照第一台/`de-ring-*`）──
  //
  //   ⚠️⚠️ 环的**含义与第一台不同**，实现前必须想清楚（否则就是"自创一套 UI"✗）：
  //     · 第一台：`deAccum` 攒到 `darkEnergyThreshold` 才转换一次 ⇒ 环 = **累积进度** ✓
  //     · 第二台：**没有累加器** —— 实现是"效率形式"（`转化值 = 1 + (T−1)·min(1, v2/v2Ref)`），
  //       转化是**瞬时**的 ⇒ 若照抄出一个"攒进度"的环，那环就在**画一个不存在的机制** ✗
  //   ⇒ 所以这里画的是**真实存在、且真的在动**的那个量：
  //       **当前转化值相对效果封顶的对数进度**
  //         `pct = log10(1 + 项) / log10(1 + effectCap)`
  //     · 项 = 0（本轮余额还是 1）⇒ **0%**
  //     · 项 = effectCap ⇒ **100%**（撞顶）
  //     · 用对数是因为项横跨 12 个数量级（1e0 ~ 1e12），线性刻度会一直贴在 0 ✓
  //   ⇒ 它**每次大坍缩都会归零重扫**（余额被 `resetForCollapse` 置回 1），所以是真的动态 ✓
  //
  //   ⚠️ 与第一台一样用**行内 `strokeDashoffset`**（周长 263.9 = 2π×42），
  //      不用 CSS 变量 —— 两台的驱动方式必须同源，否则调一处忘一处 ✗
  const cap = Number(DARK_MATTER.effectCap) || 0;
  const pct = cap > 0 ? Math.max(0, Math.min(1, Math.log10(1 + Math.max(0, term)) / Math.log10(1 + cap))) : 0;
  if (el["darkm-ring-pct"]) el["darkm-ring-pct"].textContent = `${(pct * 100).toFixed(0)}%`;
  if (el["darkm-ring-progress"]) {
    el["darkm-ring-progress"].textContent = `${fmt(new Decimal(Math.max(0, term)), 2)} / ${fmt(new Decimal(cap), 0)}`;
  }
  if (el["darkm-ring-fill"]) el["darkm-ring-fill"].style.strokeDashoffset = String(263.9 * (1 - pct));

  const can = ep.gte(price);
  if (el["darkm-cost"]) el["darkm-cost"].textContent = `花费 ${fmt(price, 0)} 永恒点`;
  if (el["darkm-status"]) el["darkm-status"].textContent = can ? "可获取" : `需要 ${fmt(price, 0)} 永恒点`;
  const b = el["btn-darkm"];
  if (b) { b.classList.toggle("affordable", can); b.disabled = !can; }
  const bm = el["btn-max-darkm"];
  if (bm) bm.disabled = !(afford > 0);
  if (el["max-darkm-n"]) el["max-darkm-n"].textContent = String(afford);
}

/**
 * ★★★ 2026：**七巧板面板**（永恒的子页）—— ⚠️ **目前是骨架**，机制尚未实现。
 *
 * 为什么先建页：用户 2026 原话「七巧板系统列为代办，因为这个玩意的复杂度不亚于再开发一个系统……
 *   **但你可以先把七巧板作为永恒后的子页面开发出来**」✓
 * ⇒ 本函数只做两件事：① 报告解锁条件（`em8`）是否达成；② **明说机制未实现**
 *   （**不许假装有进度** —— 本项目最贵的那条纪律是"显示 == 实发" ✗）
 * ⚠️ 机制本身（覆盖率内核 / 三条轴 / 拼装 / 概率获取 / 拼装挑战）见 `docs/TANGRAM.md`，
 *   全部**未实现** ⇒ 将来做的时候，这个函数要改成读**真正的状态** ✓
 */
