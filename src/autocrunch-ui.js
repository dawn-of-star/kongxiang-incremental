/**
 * ★★★ 2026（用户：「自动无限的那些拓展（AD 那种基于 3 种规则的无限模式）在页面中我想在自动无限右侧」
 *   「基于规则生效（无限时间默认 0.1s）」）
 *
 * 做两件事：
 *   ① 在梦想页 `autoInfinities` 卡片的**右侧**插一个小面板（3 个模式按钮 + 输入框 + 设定 + 开关）
 *   ② 三个模式**真的驱动**自动无限（`autocrunch.js` 已经在 tick 里判，本模块只写 state ✓）
 *
 * 规则（与 AD 的 `AUTO_CRUNCH_MODE` 逐条对齐）：
 *   · 按收益    ：本次大坍缩收益 ≥ N
 *   · 按时间    ：本次无限已过 ≥ N 秒（**默认 0.1 秒** ✓ 用户指定）
 *   · × 上次最高：收益 ≥ 本永恒单次收益纪录 × N
 * 触发间隔：`AUTO_CRUNCH.fireDelayMs = 100`（0.1 秒，AD 的最小间隔上限 ✓）
 *
 * ⚠️ 只建一次；每帧只更新文本/禁用态（不重建 DOM ✓）
 */
import Decimal from "../dist/break_eternity.esm.js";
import { AUTO_CRUNCH, autoCrunchThreshold, shouldAutoCrunch } from "./autocrunch.js";
import { bigCrunchGain } from "./formulas.js";   // ★ 2026：×最高 判据要用"本次收益" ✓

const D = (x) => new Decimal(x);

const MODE_LABEL = { amount: "按收益", time: "按时间", xHighest: "× 最高" };

/** 面板样式（只注入一次） */
function injectStyle() {
  if (document.getElementById("tg-ac-style")) return;
  const st = document.createElement("style");
  st.id = "tg-ac-style";
  st.textContent = [
    "#tg-ac-rule { display:grid !important; grid-template-columns:auto 1fr; gap:6px 10px;",
    "  align-items:center; padding:8px 10px; border:1px solid var(--line-strong);",
    "  border-radius:8px; background:rgba(255,255,255,.015); font-size:12px; }",
    "#tg-ac-rule .ac-lab { color:var(--text-dim); white-space:nowrap; }",
    "#tg-ac-rule .ac-row { display:flex; flex-wrap:wrap; gap:6px; align-items:center; min-width:0; }",
    "#tg-ac-rule .btn { width:auto !important; font-size:12px; padding:5px 9px; }",
    "#tg-ac-rule input { width:88px; padding:4px 6px; font-size:12px; border-radius:4px;",
    "  border:1px solid var(--line-strong); background:var(--bg-card); color:var(--text); }",
    "#tg-ac-rule .ac-status { grid-column:1 / -1; color:var(--text-dim); font-size:11px; line-height:1.5; }",
    "#tg-ac-rule .ac-hint { grid-column:1 / -1; color:var(--eternity,#b388ff); font-size:11px; }",
    "#tg-ac-rule .ac-on { font-weight:700; }",
    "#tg-ac-rule .ac-on[data-on='1'] { color:var(--eternity,#b388ff); }",
  ].join("\n");
  (document.head ?? document.body)?.appendChild?.(st);
}

let cur = null;        // ★ 当前 state（每次 paint 更新；点击处理一律用它）
let lastApplyAt = 0;   // ★ 刚点过「设定」的时间戳：这段时间内不要用 state 回写输入框 ✗

export function paintAutoCrunchUI(state, commit) {
  if (state) cur = state;
  if (typeof document === "undefined") return;
  // 目标挂载点：梦想页里 autoInfinities 那张卡的 wrap（= 卡片 + 开关 的那一行）
  // ★ 挂载点：找到「无限自动化」那张卡所在的 .q-card-wrap（卡片 + 开关 的那一行）
  let host = null;
  for (const w of document.querySelectorAll("#panel-dream .q-card-wrap")) {
    const card = w.querySelector(".q-card");
    if (card?.id === "dream-btn-autoInfinities") { host = w; break; }
  }
  // 兜底：直接挂在梦想升级列表末尾（至少能看见 ✓）
  if (!host) host = document.getElementById("dream-upgrade-list");
  if (!host) return;

  let box = document.getElementById("tg-ac-rule");
  // ★★★ 2026（用户：「刚才的没有生效」）—— 面板是"只建一次"的 ⇒ 旧版留下的 DOM 不会自动带上
  //   新元素（比如 #tg-ac-hint）✗ ⇒ 检测到结构缺件就**重建**一次 ✓
  // ★★★ 2026（用户：「嗯……」—— 还是竖排）—— 面板是"只建一次"的 ⇒ 旧 DOM 一直沿用 ✗
  //   ⇒ 用**版本号**强制重建：样式/结构改了就 bump 这个常量 ✓
  const PANEL_VER = "3";
  if (box && box.dataset.ver !== PANEL_VER) {
    if (typeof box.remove === "function") box.remove(); else box.parentNode?.removeChild?.(box);
    box = null;
  }
  if (box && (!document.getElementById("tg-ac-hint") || !box.querySelector("[data-acmode]"))) {
    // ⚠️ stub DOM 可能没有 remove() ⇒ 两种写法都兜住 ✓
    if (typeof box.remove === "function") box.remove();
    else box.parentNode?.removeChild?.(box);
    box = null;
  }
  if (!box) {
    box = document.createElement("div");
    box.id = "tg-ac-rule";
    box.dataset.ver = "3";
        box.innerHTML = [
      '<span class="ac-lab">规则</span>',
      '<span class="ac-row">',
      ...AUTO_CRUNCH.modes.map((m) =>
        `<button class="btn btn-small" data-acmode="${m.id}">${MODE_LABEL[m.id] ?? m.name}</button>`),
      '</span>',
      '<span class="ac-lab">阈值</span>',
      '<span class="ac-row">',
      '<input id="tg-ac-value" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" />',
      '<button class="btn btn-small" id="tg-ac-apply">设定</button>',
      '<button class="btn btn-small ac-on" id="tg-ac-on" data-on="1">关</button>',
      '<span class="dim" id="tg-ac-pity" style="font-size:11px"></span>',
      '</span>',
      '<span class="ac-status" id="tg-ac-status"></span>',
      '<span class="ac-hint" id="tg-ac-hint"></span>',
    ].join("");    host.appendChild(box);

    // 事件（委托 + 直接绑定各一点，简单可靠 ✓）
    box.addEventListener("click", (ev) => {
      const b = ev.target?.closest?.("button");
      if (!b) return;
      const st = box._state;
      if (!st) return;
      if (b.dataset.acmode) {
        st.autoCrunch ??= {};
        st.autoCrunch.mode = b.dataset.acmode;
        // ★ 按时间模式默认 **0.1 秒**（用户指定）✓
        if (b.dataset.acmode === "time" && !(Number(st.autoCrunch.time) > 0)) st.autoCrunch.time = 0.1;
        commit?.();
        return;
      }
      if (b.id === "tg-ac-apply") {
        // ★ 2026（用户：「以科学计数法输入没用」）—— 输入必须能接受 `1e5` / `1E5` / `1,000`
        //   解析走 Decimal（唯一数值源）⇒ 非法值不写入、回显提示 ✓
        const raw = (document.getElementById("tg-ac-value")?.value ?? "").trim().replace(/,/g, "");
        st.autoCrunch ??= {};
        const m = st.autoCrunch.mode ?? AUTO_CRUNCH.defaultMode;
        const hint = document.getElementById("tg-ac-hint");
        const okDec = (() => {
          try { const d = D(raw); return d.gt(0) && d.isFinite() ? d.toString() : null; } catch { return null; }
        })();
        if (m === "time") {
          const n = Number(raw);
          if (Number.isFinite(n) && n > 0) { st.autoCrunch.time = n; if (hint) hint.textContent = "已设为 " + n + " 秒"; }
          else if (hint) hint.textContent = "时间必须是正数（秒）";
        } else if (m === "amount") {
          if (okDec) { st.autoCrunch.amount = okDec; if (hint) hint.textContent = "已设为收益 ≥ " + okDec; }
          else if (hint) hint.textContent = "收益阈值必须是正数（支持 1e5）";
        } else {
          if (okDec) { st.autoCrunch.xHighest = okDec; if (hint) hint.textContent = "已设为 ≥ " + okDec + " × 纪录"; }
          else if (hint) hint.textContent = "倍数必须是正数（支持 1e5）";
        }
        lastApplyAt = Date.now();   // ★ 刚设定的 1.5 秒内不要被 state 回写覆盖 ✗
        commit?.();
        return;
      }
      if (b.id === "tg-ac-on") {
        // ★★★ 2026 修 bug：这个按钮原来写 `autoCrunch.isActive`，而引擎另有一个
        //   梦想页开关 `autoToggles.autoInfinities` ⇒ **两个开关互不同步**，点哪个都可能没用 ✗
        //   ⇒ 现在**只写梦想页那一个**（`autoToggles`），引擎只认它（`autoEnabled`）✓
        st.autoToggles ??= {};
        if (st.autoToggles.autoInfinities === true) delete st.autoToggles.autoInfinities;
        else st.autoToggles.autoInfinities = true;
        commit?.();
      }
    });
  }
  box._state = state;

  const a = state?.autoCrunch ?? {};
  const mode = a.mode ?? AUTO_CRUNCH.defaultMode;
  for (const b of box.querySelectorAll("[data-acmode]")) {
    const on = b.dataset.acmode === mode;
    b.style.outline = on ? "2px solid var(--eternity,#b388ff)" : "none";
    b.style.opacity = on ? "1" : "0.65";
  }
  const val = document.getElementById("tg-ac-value");
  // ★ 2026（用户：设定成 1e5 又跳回 2）—— 刚点过「设定」时**不要**用 state 覆盖输入框 ✗
  if (val && document.activeElement !== val && Date.now() - lastApplyAt > 1500) {
    val.value = mode === "time" ? String(a.time ?? 0.1) : String(mode === "amount" ? (a.amount ?? "1") : (a.xHighest ?? "2"));
  }
  const onBtn = document.getElementById("tg-ac-on");
  // ★ 2026：显示的是**梦想页那个开关**（唯一开关）✓
  if (onBtn) onBtn.textContent = state?.autoToggles?.autoInfinities === true ? "关" : "开";
  // ★ 2026（用户：「检测都是一次性检测」）—— 判据只在**输入/模式/开关变化**时重算一次，
  //   不再每帧跑一遍 shouldAutoCrunch ✗
  const st = document.getElementById("tg-ac-status");
  if (st) {
    // ★ 2026：判据统一走 `autoEnabled`（已买 + 已开）—— 原来只显示"未购买"，开关关着却不提示 ✗
    const owned = state?.dreamUpgrades?.autoInfinities === true;
    const on = state?.autoToggles?.autoInfinities === true;
    const thr = autoCrunchThreshold(state);
    st.textContent = (!owned ? "未购买「无限自动化」⇒ 不生效 ｜ " : (on ? "" : "已购买但**未开启**（点右下角「开」）｜ "))
      + "阈值 " + (mode === "time" ? thr + " 秒" : mode === "amount" ? "收益 ≥ " + thr : "≥ " + thr + "× 纪录")
      + " ｜ 间隔 " + (AUTO_CRUNCH.fireDelayMs / 1000) + " 秒"
      + (shouldAutoCrunch(state, { gain: state?.brokenInfinity ? bigCrunchGain(state) : 0 }) ? " ｜ 判据已成立" : "")
      + (mode === "xHighest" ? " ｜ 判据：本次收益 ≥ 当前持有 IP × " + (a.xHighest ?? "2") : "")
      + " ｜ 存值 " + (mode === "time" ? (a.time ?? 0.1) + "s" : mode === "amount" ? (a.amount ?? "1") : (a.xHighest ?? "2"));
  }
}
