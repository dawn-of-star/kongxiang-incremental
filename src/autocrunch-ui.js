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
import { AUTO_CRUNCH, autoCrunchThreshold, shouldAutoCrunch } from "./autocrunch.js";

const MODE_LABEL = { amount: "按收益", time: "按时间", xHighest: "× 最高" };

export function paintAutoCrunchUI(state, commit) {
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
  if (!box) {
    box = document.createElement("div");
    box.id = "tg-ac-rule";
    box.style.cssText = [
      "flex:1 1 240px", "min-width:200px", "display:flex", "flex-wrap:wrap",
      "gap:4px", "align-items:center", "padding:6px 8px",
      "border:1px solid var(--line-strong)", "border-radius:6px",
      "font-size:12px",
    ].join(";");
    box.innerHTML = [
      '<span style="font-weight:700">规则</span>',
      ...AUTO_CRUNCH.modes.map((m) =>
        `<button class="btn btn-small" data-acmode="${m.id}" style="width:auto">${MODE_LABEL[m.id] ?? m.name}</button>`),
      '<input id="tg-ac-value" type="text" inputmode="decimal" autocomplete="off" spellcheck="false"',
      '  style="width:76px;padding:2px 4px;font-size:12px" />',
      '<button class="btn btn-small" id="tg-ac-apply" style="width:auto">设定</button>',
      '<button class="btn btn-small" id="tg-ac-on" style="width:auto">关</button>',
      '<span class="dim" id="tg-ac-status" style="flex-basis:100%"></span>',
    ].join("");
    host.appendChild(box);

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
        const v = document.getElementById("tg-ac-value")?.value ?? "";
        st.autoCrunch ??= {};
        const m = st.autoCrunch.mode ?? AUTO_CRUNCH.defaultMode;
        if (m === "time") st.autoCrunch.time = Math.max(0.1, Number(v) || 0.1);
        else if (m === "amount") st.autoCrunch.amount = String(v || "1");
        else st.autoCrunch.xHighest = String(v || "2");
        commit?.();
        return;
      }
      if (b.id === "tg-ac-on") {
        st.autoCrunch ??= {};
        st.autoCrunch.isActive = st.autoCrunch.isActive === false;
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
  if (val && document.activeElement !== val) {
    val.value = mode === "time" ? String(a.time ?? 0.1) : String(mode === "amount" ? (a.amount ?? "1") : (a.xHighest ?? "2"));
  }
  const onBtn = document.getElementById("tg-ac-on");
  if (onBtn) onBtn.textContent = a.isActive === false ? "开" : "关";
  const st = document.getElementById("tg-ac-status");
  if (st) {
    const owned = state?.dreamUpgrades?.autoInfinities === true;
    const thr = autoCrunchThreshold(state);
    st.textContent = (owned ? "" : "未购买「无限自动化」⇒ 不生效 ｜ ")
      + "阈值 " + (mode === "time" ? thr + " 秒" : mode === "amount" ? "收益 ≥ " + thr : "≥ " + thr + "× 纪录")
      + " ｜ 间隔 " + (AUTO_CRUNCH.fireDelayMs / 1000) + " 秒"
      + (shouldAutoCrunch(state) ? " ｜ 判据已成立" : "");
  }
}
