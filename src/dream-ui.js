/**
 * ★★★ 2026：**梦想页的分组 + 右侧开关**（用户：「自动化升级根据种类以 3 列或 2 列的分隔标签生效」
 *   「开关应该在对应升级的右侧而不是下侧」）
 *
 * ⚠️ 做法（本轮教训）：**不重建** 0.7.1 已经建好的卡片（那会丢 id / handler ✗）
 *   ⇒ 只做两件**增量**操作：
 *     ① 把已有卡片按 5 组**搬进** `<div class="dream-group-grid">`，并在前面插一个分隔标签 ✓
 *     ② 给「自动化」类卡片**右侧**追加一个开关按钮（`dream-toggle-<id>`）✓
 *
 * 开关语义（用户裁定）：「买下只是解锁能力，要**手动开**」⇒ `state.autoToggles[id] === true` 才生效；
 *   没买的开关是**可点的**（点了只改偏好，无副作用）—— 上一版把它 `disabled` 了，用户实测「点不动」✗
 */
import { DREAM_UPGRADES } from "./config.js";

/** 这 7 条是「有开关」的自动化（4 条自动购物 + 自动无限 + 2 条自动购买新对象）✓ */
export const AUTOMATION_IDS = new Set([
  "autoPhase", "autoVacuum", "autoDeGainBase", "autoConvOutput",
  "autoInfinities", "autoIpDouble", "autoZpeEngine",
]);

const GROUPS = [
  {
    name: "暗能量自动化",
    pick: (d) => ["autoPhase", "autoVacuum", "autoDeGainBase", "autoConvOutput"].includes(d.id),
  },
  { name: "IP / ZPE 自动化", pick: (d) => ["autoIpDouble", "autoZpeEngine"].includes(d.id) },
  { name: "无限自动化", pick: (d) => d.id === "autoInfinities" },
  { name: "永恒保留（被动）", pick: (d) => ["keepDeEternity", "engineAtStart", "keepVoidEternity"].includes(d.id) },
  { name: "梦想点 / 离线", pick: (d) => d.id === "offlineCap" },
];

/** 只排一次（构建完成后调用）✓ */
let stateRef = null;      // 由 renderDreamPage 每帧更新（arrange 在构建期没有 state ✓）

export function arrangeDreamPage(state) {
  if (state) stateRef = state;
  const box = document.getElementById("dream-upgrade-list");
  if (!box || box.dataset.arranged === "1") return;
  box.dataset.arranged = "1";

  const cards = new Map();
  for (const d of DREAM_UPGRADES) {
    const c = document.getElementById(`dream-btn-${d.id}`);
    if (c) cards.set(d.id, c);
  }
  if (!cards.size) return;

  // ⚠️ stub DOM（dom-smoke）没有 createDocumentFragment ⇒ 用一个普通 div 当容器 ✓
  const frag = document.createElement("div");
  const used = new Set();
  for (const g of GROUPS) {
    const items = DREAM_UPGRADES.filter((d) => !used.has(d.id) && g.pick(d) && cards.has(d.id));
    if (!items.length) continue;
    for (const d of items) used.add(d.id);

    const label = document.createElement("div");
    label.className = "dream-group-label";
    label.textContent = g.name + "（" + items.length + "）";
    frag.appendChild(label);

    const grid = document.createElement("div");
    grid.className = "dream-group-grid";
    for (const d of items) {
      const card = cards.get(d.id);
      const wrap = document.createElement("div");
      wrap.className = "q-card-wrap";
      wrap.appendChild(card);                        // 搬走原卡片（id / handler 都保留 ✓）
      if (AUTOMATION_IDS.has(d.id)) {
        const tg = document.createElement("button");
        tg.className = "btn btn-small dream-toggle";
        tg.id = `dream-toggle-${d.id}`;
        tg.textContent = "关";
        tg.title = "自动化总开关（买下只是解锁能力，要手动开）";
        wrap.appendChild(tg);                        // ★ 卡片**右侧** ✓
      }
      grid.appendChild(wrap);
    }
    frag.appendChild(grid);
  }
  box.textContent = "";
  box.appendChild(frag);

  // 开关：**事件委托**（列表重建/遮挡都不怕）✓
  box.addEventListener("click", (ev) => {
    const b = ev.target?.closest?.("button");
    if (!b?.id) return;
    const m = /^dream-toggle-(.+)$/.exec(b.id);
    if (!m) return;
    const st = stateRef;
    if (st?.autoToggles) {
      const on = st.autoToggles[m[1]] === true;
      if (on) delete st.autoToggles[m[1]];
      else st.autoToggles[m[1]] = true;
    }
    if (st) renderDreamPage(st);
  });
}

/** 每帧（只改文本/属性，**不动结构**）✓ */
export function renderDreamPage(state) {
  if (state) stateRef = state;
  const box = document.getElementById("dream-upgrade-list");
  if (!box || box.dataset.arranged !== "1") return;
  for (const d of DREAM_UPGRADES) {
    const tg = document.getElementById(`dream-toggle-${d.id}`);
    if (tg) {
      const owned = hasDreamUpgradeLocal(state, d.id);
      const on = state?.autoToggles?.[d.id] === true;
      tg.textContent = owned ? (on ? "开" : "关") : "关";
      tg.disabled = false;                          // ★ 一律可点（上一版 disabled ⇒ 用户「点不动」✗）
      tg.classList.toggle("off", !on);
      tg.title = owned
        ? (on ? "已开启 —— 点一下关掉" : "已解锁但**未开启** —— 点一下打开")
        : "还没买这条升级（买下后点这里开关）";
    }
    const st = document.getElementById(`dream-${d.id}-state`);
    if (st) {
      const owned = hasDreamUpgradeLocal(state, d.id);
      const auto = AUTOMATION_IDS.has(d.id);
      const on = state?.autoToggles?.[d.id] === true;
      st.textContent = !owned ? "未购买" : (auto && !on ? "已购买 · 未开启" : "已购买");
    }
  }
}

/** 本地判定（不 import engine，避免循环）—— 与 `dreamUpgradeLevelOf` 同口径：存 true/数字 ✓ */
function hasDreamUpgradeLocal(state, id) {
  const v = state?.dreamUpgrades?.[id];
  return v === true || (typeof v === "number" && v > 0);
}
