/**
 * ★★★ 2026：**自动无限规则面板**（挂在「无限自动化」卡片右侧）
 *
 * 用户要求（多次）：
 *   ① 形态学 AD 的自动页面：**三条规则做成"活跃选择项"**，选中哪个哪个生效 ✓
 *   ② **好看一点**（原来一排 .btn 被项目的 `width:100%` 拖成竖排 ✗）
 *   ③ 判据**一次性检测**（不在每帧重算 ✗）
 *
 * ⚠️ 因此这里**全部内联样式 + !important**：项目的 `.btn` 是 `display:block; width:100%`，
 *   任何依赖外部 CSS 覆盖的做法都被证明会翻车（两次 ✗）。
 * ⚠️ 面板**带版本号**：结构或样式改了必须 bump `PANEL_VER`，否则旧 DOM 会被一直沿用 ✗
 */
import Decimal from "../dist/break_eternity.esm.js";
import { AUTO_CRUNCH, autoCrunchThreshold, shouldAutoCrunch } from "./autocrunch.js";
import { bigCrunchGain } from "./formulas.js";

const D = (x) => new Decimal(x);
const MODE_LABEL = { amount: "按收益", time: "按时间", xHighest: "× 最高" };
const PANEL_VER = "4";
const BTN_CSS = "width:auto !important;display:inline-block !important;flex:0 0 auto;"
  + "font-size:12px;padding:5px 10px;margin:0;line-height:1.2;border-radius:6px";
const LAB_CSS = "color:var(--text-dim);white-space:nowrap;font-size:12px;flex:0 0 auto";

let cur = null;
let lastApplyAt = 0;

function mkBtn(text, id, mode) {
  const b = document.createElement("button");
  b.className = "btn btn-small";
  if (id) b.id = id;
  if (mode) b.dataset.acmode = mode;
  b.textContent = text;
  b.style.cssText = BTN_CSS;
  return b;
}

function mkLab(text) {
  const s = document.createElement("span");
  s.textContent = text;
  s.style.cssText = LAB_CSS;
  return s;
}


/** 建一次自动无限规则面板（内联样式 + 版本号；旧版会被 paint 逻辑移除）。 */
function buildAutoCrunchPanel(host, commit) {
    const box = document.createElement("div");
    box.id = "tg-ac-rule";
    box.dataset.ver = PANEL_VER;
    box.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;align-items:center;"
      + "flex:1 1 260px;min-width:220px;padding:8px 10px;margin:2px 0 6px;"
      + "border:1px solid var(--line-strong);border-radius:8px;"
      + "background:rgba(255,255,255,.015);font-size:12px";

    box.appendChild(mkLab("规则"));
    for (const m of AUTO_CRUNCH.modes) box.appendChild(mkBtn(MODE_LABEL[m.id] ?? m.name, null, m.id));

    box.appendChild(mkLab("阈值"));
    const inp = document.createElement("input");
    inp.id = "tg-ac-value";
    inp.type = "text";
    inp.inputMode = "decimal";
    inp.autocomplete = "off";
    inp.spellcheck = false;
    inp.style.cssText = "width:84px;padding:4px 6px;font-size:12px;border-radius:6px;"
      + "border:1px solid var(--line-strong);background:var(--bg-card);color:var(--text)";
    box.appendChild(inp);

    box.appendChild(mkBtn("设定", "tg-ac-apply"));
    box.appendChild(mkBtn("关", "tg-ac-on"));

    const status = document.createElement("span");
    status.id = "tg-ac-status";
    status.style.cssText = "flex-basis:100%;color:var(--text-dim);font-size:11px;line-height:1.5;margin-top:2px";
    box.appendChild(status);

    const hint = document.createElement("span");
    hint.id = "tg-ac-hint";
    hint.style.cssText = "flex-basis:100%;color:var(--eternity,#b388ff);font-size:11px";
    box.appendChild(hint);

    host.appendChild(box);
  box.addEventListener("click", (ev) => handleAutoCrunchClick(ev, commit));
  return box;
}

/** 面板的点击处理：规则切换 / 设定阈值 / 开关。 */
function handleAutoCrunchClick(ev, commit) {
      const b = ev.target?.closest?.("button");
      if (!b) return;
      const st = cur;
      if (!st) return;

      if (b.dataset.acmode) {
        st.autoCrunch ??= {};
        st.autoCrunch.mode = b.dataset.acmode;
        if (b.dataset.acmode === "time" && !(Number(st.autoCrunch.time) > 0)) st.autoCrunch.time = 0.1;
        commit?.();
        return;
      }

      if (b.id === "tg-ac-apply") {
        const raw = (document.getElementById("tg-ac-value")?.value ?? "").trim().replace(/,/g, "");
        const hint = document.getElementById("tg-ac-hint");
        st.autoCrunch ??= {};
        const m = st.autoCrunch.mode ?? AUTO_CRUNCH.defaultMode;
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
          if (okDec) { st.autoCrunch.xHighest = okDec; if (hint) hint.textContent = "已设为 ≥ " + okDec + " × 本永恒峰值 IP"; }
          else if (hint) hint.textContent = "倍数必须是正数（支持 1e5）";
        }
        lastApplyAt = Date.now();
        commit?.();
        return;
      }

      if (b.id === "tg-ac-on") {
        st.autoCrunch ??= {};
        st.autoCrunch.isActive = st.autoCrunch.isActive === false;
        commit?.();
      }
}

/** 每帧只同步文本/选中态（不重建 DOM）。 */
function syncAutoCrunchPanel(box, state) {
  const a = state?.autoCrunch ?? {};
  const mode = a.mode ?? AUTO_CRUNCH.defaultMode;

  for (const b of box.querySelectorAll("[data-acmode]")) {
    const on = b.dataset.acmode === mode;
    b.style.background = on ? "var(--eternity,#b388ff)" : "transparent";
    b.style.color = on ? "#101014" : "var(--text-dim)";
    b.style.borderColor = on ? "var(--eternity,#b388ff)" : "var(--line-strong)";
    b.style.fontWeight = on ? "700" : "600";
  }

  const val = document.getElementById("tg-ac-value");
  if (val && document.activeElement !== val && Date.now() - lastApplyAt > 1500) {
    val.value = mode === "time" ? String(a.time ?? 0.1) : String(mode === "amount" ? (a.amount ?? "1") : (a.xHighest ?? "2"));
  }

  const onBtn = document.getElementById("tg-ac-on");
  if (onBtn) {
    const on = a.isActive !== false;
    onBtn.textContent = on ? "开" : "关";
    onBtn.style.background = on ? "var(--eternity,#b388ff)" : "transparent";
    onBtn.style.color = on ? "#101014" : "var(--text-dim)";
  }

  const st = document.getElementById("tg-ac-status");
  if (st) {
    const owned = state?.dreamUpgrades?.autoInfinities === true;
    const sig = [mode, a.amount, a.time, a.xHighest, a.isActive, owned, state?.brokenInfinity].join("|");
    if (st.dataset.sig !== sig) {
      st.dataset.sig = sig;
      const thr = autoCrunchThreshold(state);
      const okNow = owned && state?.brokenInfinity
        && shouldAutoCrunch(state, { gain: state?.brokenInfinity ? bigCrunchGain(state) : 0 });
      st.textContent = (owned ? "" : "未购买「无限自动化」⇒ 不生效 ｜ ")
        + "判据：" + (mode === "time" ? "本次无限已过 ≥ " + thr + " 秒"
          : mode === "amount" ? "本次收益 ≥ " + thr
            : "本次收益 ≥ 本永恒峰值 IP × " + thr)
        + " ｜ 间隔 " + (AUTO_CRUNCH.fireDelayMs / 1000) + " 秒"
        + (okNow ? " ｜ 现已成立" : "");
    }
  }
}

export function paintAutoCrunchUI(state, commit) {
  if (typeof document === "undefined") return;
  if (state) cur = state;

  let host = null;
  for (const w of document.querySelectorAll("#panel-dream .q-card-wrap")) {
    if (w.querySelector(".q-card")?.id === "dream-btn-autoInfinities") { host = w; break; }
  }
  if (!host) host = document.getElementById("dream-upgrade-list");
  if (!host) return;

  let box = document.getElementById("tg-ac-rule");
  if (box && box.dataset.ver !== PANEL_VER) {
    if (typeof box.remove === "function") box.remove();
    else box.parentNode?.removeChild?.(box);
    box = null;
  }
  if (!box) box = buildAutoCrunchPanel(host, commit);
  box._state = state;
  syncAutoCrunchPanel(box, state);
}
