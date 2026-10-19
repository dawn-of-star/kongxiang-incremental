/**
 * ui-neko.js —— 猫猫子页（好感度 / 道具 / 接入状态）
 *
 * ★ 2026 模块化：从 ui.js 抽出的**独立面板渲染器**。
 *   · DOM 缓存/去重/格式化一律来自 `./ui-core.js`（本文件不定义地基）
 *   · 只被 `ui.js` 的 render() 调用（单向依赖）
 */

import { NEKO, NEKO_ITEMS, nekoDriftRoom, nekoGlobalExponent, nekoNextTier } from "./config.js";
import { nekoHostPresent } from "./neko.js";
import { $, el } from "./ui-core.js";

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
    el["neko-sdk-state"].textContent = host
      ? "已检测到宿主（本游戏尚未注册 ⇒ 暂不连接）"
      : "未接入（本页无宿主）";
  }
  if (el["neko-chat-badge"]) {
    el["neko-chat-badge"].textContent = nekoHostPresent(globalThis.document) ? "宿主已就绪" : "未接入";
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
}

/** 永恒里程碑的状态刷新（只在 `render()` 里调，不重建 DOM） */
