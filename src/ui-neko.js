/**
 * ui-neko.js —— 猫猫子页（好感度 / 道具 / 接入状态）
 *
 * ★ 2026 模块化：从 ui.js 抽出的**独立面板渲染器**。
 *   · DOM 缓存/去重/格式化一律来自 `./ui-core.js`（本文件不定义地基）
 *   · 只被 `ui.js` 的 render() 调用（单向依赖）
 */

import { NEKO, NEKO_ITEMS, nekoDriftRoom, nekoGlobalExponent, nekoNextTier } from "./config.js";
import { nekoHostPresent } from "./neko.js";
import { detectPluginId } from "./neko/plugin-bridge.js";
import { $, el } from "./ui-core.js";
import { AUTOMATION_IDS } from "./dream-ui.js";   // ★ 2026-11-13：授权列表的唯一来源 ✓
import { save } from "./save.js";                 // ★ 授权改动要立即存档 ✓

/** ★ 2026-11-13：授权行的中文名（id → 显示名 ✓；缺省显示 id ✓）*/
const GRANT_LABEL = {
  autoPhase: "相变自动化",
  autoVacuum: "加速自动化",
  autoDeGainBase: "暗能量增幅自动化",
  autoConvOutput: "凝聚斜率自动化",
  autoInfinities: "无限自动化（自动大坍缩）",
  autoIpDouble: "IP 倍增自动化",
  autoZpeEngine: "ZPE 引擎自动化",
};

export function renderNeko(state) {
  const a = Number(state?.nekoAffinity ?? 0) || 0;
  const exp = nekoGlobalExponent(state);
  const next = nekoNextTier(state);

  // ★★★ 2025（`docs/NEKO.md` §3~§9）：**宿主接入状态** ——
  //   用户原则「没有 ui 真的很容易误判」⇒ 接没接上必须看得见 ✓
  //   ⚠️ 判据**调真函数** `nekoHostPresent()`（读宿主注入的 `#neko-minigame-host-launch`），
  //      不是看 `window.lanlan_config`（那是**旧式集成**，soccer/badminton 用的另一条路 ✗）
  if (el["neko-sdk-state"]) {
    const host = nekoHostPresent(globalThis.document);
    const pluginId = detectPluginId(globalThis.location);
    el["neko-sdk-state"].textContent = pluginId
      ? `插件面板模式（${pluginId}）`
      : host
        ? "旧宿主路线（minigame SDK，已弃用）"
        : "未接入（独立模式；N.E.K.O 请用插件面板）";
  }
  if (el["neko-chat-badge"]) {
    const pluginId = detectPluginId(globalThis.location);
    el["neko-chat-badge"].textContent = pluginId
      ? "插件面板"
      : nekoHostPresent(globalThis.document) ? "旧宿主" : "未接入";
  }

  if (el["neko-affinity"]) el["neko-affinity"].textContent = String(Math.round(a * 100) / 100);
  if (el["neko-exponent"]) {
    el["neko-exponent"].textContent = exp === 1
      ? "^1（未生效）"
      : `^${exp.toFixed(7)}（全局加成取这个幂）`;
  }
  if (el["neko-next"]) {
    el["neko-next"].textContent = next
      ? `好感度 > ${next.need} ⇒ 全局 ^${next.pow}` + (a <= next.need ? `（还差 ${(next.need - a).toFixed(1)}）` : "")
      : "已全部生效（^1.0221151）";
  }
  // 进度条：0 ⇒ 空、100 ⇒ 满（负值按 0 显示，因为负向不影响收益 ✓）
  if (el["neko-bar"] && el["neko-bar-text"]) {
    const pct = Math.max(0, Math.min(1, a / NEKO.max));
    el["neko-bar"].style.width = `${(pct * 100).toFixed(1)}%`;
    el["neko-bar-text"].textContent = `${Math.round(a)} / ${NEKO.max}`;
  }
  if (el["neko-drift"]) {
    const room = nekoDriftRoom(state);
    el["neko-drift"].textContent = room > 0
      ? `还剩 ${room} 点（每 5 分钟 < ${NEKO.driftMax} 点${room < NEKO.driftMax ? "，已用掉一部分" : ""}）`
      : `已用完（每 5 分钟 < ${NEKO.driftMax} 点）—— 等窗口过去`;
  }
  // ★★★ 2025（`NEKO.md` §10）：**道具**（三个）——
  //   判据全部走 `NEKO_ITEMS` + `nekoDriftRoom`（**同一套来源**，不在这里重写 ✗）
  {
    const room = nekoDriftRoom(state);
    let usable = 0;
    for (const it of Object.values(NEKO_ITEMS)) {
      const canRes = it.can(state) === true;
      const can = canRes && room > 0;
      if (canRes) usable++;
      const btn = el[`btn-neko-item-${it.id}`];
      if (btn) {
        btn.classList.toggle("affordable", can);
        btn.disabled = !can;
      }
      const cost = el[`neko-item-${it.id}-cost`];
      if (cost) {
        cost.textContent = !canRes ? `需要：${it.costText}`
          : room <= 0 ? `窗口额度已用完（每 5 分钟 < ${NEKO.driftMax} 点）`
            : it.costText;
      }
    }
    if (el["neko-item-badge"]) el["neko-item-badge"].textContent = `${usable} / ${Object.keys(NEKO_ITEMS).length} 可用`;
  }
  // ★ 档位阶梯：**只建一次 DOM，之后只改文本 + class** ✓
  //   （踩过：每帧 `innerHTML` 会重置 hover ⇒ 闪烁 ✗，见文件里其它渲染块的注释）
  const box = el["neko-tier-list"];
  if (box) {
    if (!box.dataset.built) {
      box.dataset.built = "1";
      for (const t of NEKO.tiers) {
        const d = document.createElement("div");
        d.id = `neko-tier-${t.need}`;
        box.appendChild(d);
      }
    }
    for (const t of NEKO.tiers) {
      const d = document.getElementById(`neko-tier-${t.need}`);
      if (!d) continue;
      const on = a > t.need;
      d.className = on ? "on" : "";
      d.innerHTML = `<span>好感度 &gt; ${t.need}</span><b>全局 ^${t.pow}${on ? "　✅ 已生效" : ""}</b>`;
    }
  }

  // ══════════════════════════════════════════════════════════
  // ★★★ 2026-11-13（`setAuto` 的最后一块 UI）—— **猫娘自动化授权**
  //   · 勾选 = 写 `state.nekoAutoGrants[id] = true`（**只有玩家能写** ✓）
  //   · 猫娘通过 `setAuto` 只能开**已授权**的 ✓（没授权 ⇒ rejected ✓）
  //   · 列表从 `AUTOMATION_IDS` 生成 ✓（不写死 ✗）
  //   ⚠️ 只建一次 DOM（每帧重建会闪 ✗ —— 本文件的既有教训 ✓）
  // ══════════════════════════════════════════════════════════
  const gbox = el["neko-auto-grants"];
  if (gbox) {
    if (!gbox.dataset.built) {
      gbox.dataset.built = "1";
      for (const id of AUTOMATION_IDS) {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:6px;margin-top:4px";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.id = `neko-grant-${id}`;
        cb.style.cssText = "width:auto;margin:0";
        cb.addEventListener("change", () => {
          const st = gbox._state;
          if (!st) return;
          st.nekoAutoGrants ??= {};
          st.nekoAuto ??= {};
          if (cb.checked) st.nekoAutoGrants[id] = true;
          else { delete st.nekoAutoGrants[id]; delete st.nekoAuto[id]; }
          try { save(st); } catch { /* 存档失败不影响勾选 ✓ */ }
        });
        const lab = document.createElement("label");
        lab.htmlFor = cb.id;
        lab.textContent = GRANT_LABEL[id] ?? id;
        lab.style.cssText = "font-size:11px;cursor:pointer";
        row.appendChild(cb);
        row.appendChild(lab);
        gbox.appendChild(row);
      }
    }
    gbox._state = state;
    for (const id of AUTOMATION_IDS) {
      const cb = document.getElementById(`neko-grant-${id}`);
      if (!cb) continue;
      const granted = state?.nekoAutoGrants?.[id] === true || state?.nekoAutoGrants?.__all === true;
      const running = state?.nekoAuto?.[id] === true;
      cb.checked = granted;
      cb.title = running ? "猫娘当前已开启" : "";
    }
  }
}

/** 永恒里程碑的状态刷新（只在 `render()` 里调，不重建 DOM） */
