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
import { DREAM_UPGRADES, dreamUpgradeLevelOf, dreamUpgradeCostAt, hasEternityMilestone } from "./config.js";
import { sci } from "./format.js";

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
/**
 * ★★★ 2026（用户：「照原稿的解锁顺序，没解锁的直接不显示」）——
 *   阶段判定（**只读 state，不写**）：
 *     `de`            ⇒ 暗能量层已解锁（有里程碑/暗能量 > 0）
 *     `breakInfinity` ⇒ 破过无限
 *     `eternity`      ⇒ 至少永恒 1 次
 *     `always`        ⇒ 一直可见
 */
export function isDreamUnlocked(state, d) {
  const when = d?.unlockWhen ?? "always";
  if (when === "always") return true;

  // ★★★ 2026（用户：「我请你基于**次数**检测 —— 该解锁的时候有些看不到解锁」）
  //   ⇒ 一律看**计数器**（Decimal / number 都能读），不看任何标志位 ✗
  const num = (v) => {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    try { return Number(v.toString()); } catch { return 0; }
  };
  const eternity = num(state?.eternityCount);
  const infCount = num(state?.infinityCount);
  const quantum = num(state?.quantum) + num(state?.quantumPairs);

  if (when === "quantum") return quantum > 0;                    // 有量子 ⇒ 暗能量层自动化 ✓
  if (when === "em8") return eternity >= 8;                     // 第 8 次永恒 ⇒ 其余 ✓
  if (when === "breakInfinity") return infCount >= 1 || state?.brokenInfinity === true;
  if (when === "eternity") return eternity >= 1;
  return true;
}

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
    // ★ 2026：未解锁的**直接不显示**（AD 的自动页面形态 ✓）
  const items = DREAM_UPGRADES.filter((d) => !used.has(d.id) && g.pick(d) && cards.has(d.id) && isDreamUnlocked(state, d));
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

  // ★★★ 2026（用户：「该解锁的时候有些看不到解锁」）—— **排列只在启动时跑过一次** ✗
  //   ⇒ 之后解锁条件变了（比如有了量子/到了第 8 次永恒），旧 DOM 不会再长出新卡 ✗
  //   ⇒ 这里比一次"可见集合"的签名，变了就**重新排列** ✓
  {
    const sig = DREAM_UPGRADES.filter((d) => isDreamUnlocked(state, d)).map((d) => d.id).join(",");
    if (box.dataset.visibleSig !== sig) {
      box.dataset.visibleSig = sig;
      box.dataset.arranged = "0";
      try { arrangeDreamPage(state); } catch { /* 忽略 */ }
      if (box.dataset.arranged === "0") box.dataset.arranged = "1";
    }
  }
  if (state) stateRef = state;
  const box2 = document.getElementById("dream-upgrade-list");   // ★ 2026：重排用（原名 box 已被上面占用）
  if (!box || box.dataset.arranged !== "1") return;
  let ownedCount = 0;
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

    // ══════════════════════════════════════════════════════════
    // ★★★ 2026 **修 bug**（用户报：「主控台下子页面中梦想（自动化）**永恒前**梦想升级未正常工作」）
    // ══════════════════════════════════════════════════════════
    // ── 症状 ──
    //   永恒前（`peakMatter < 1e25`）梦想卡片的价格/可购高亮**永远不刷新**，
    //   甚至显示的是**上一份 state** 的陈旧数字（实测：传入 dreamPoints=1000，
    //   卡片仍写「持有 3.00」）。买了也没法从界面上判断买得起买不起。
    //
    // ── 根因 ──
    //   这三样原来写在 `ui.js` 的 `renderQuantum()` **里面**，而那个函数开头有
    //     `if (!showContent) return;`（`showContent = collapseUnlocked = peakMatter ≥ 1e25`）
    //   ⇒ 没到量子层就直接 return，那段**一次都不执行** ✗
    //   （而「等级文字」早就搬到本文件了 ⇒ 所以出现"等级会变、价格不动"的诡异现象）
    //
    // ── 修法：**收口到这里**（唯一渲染器）──
    //   价格 / 可购 / maxed / 徽标都跟等级文字同一个地方更新，**且不受任何页面门控** ✓
    //   ⚠️ `ui.js` 里那段 legacy 循环**已删除** —— 两处写同一批元素是本项目反复踩的坑
    //     （"显示 ≠ 实发"的老来源）✗
    //   ⚠️ 等级/价格必须走 `dreamUpgradeLevelOf` / `dreamUpgradeCostAt`（唯一入口），
    //     不要直接读 `d.cost` / `state.dreamUpgrades[id]` —— 否则可重复升级买不了第 2 级 ✗
    const lv = dreamUpgradeLevelOf(state, d.id);
    const cost = dreamUpgradeCostAt(d.id, lv);        // `null` = 已满级 / 一次性已买
    const has = lv > 0;
    const maxed = cost == null;
    if (has) ownedCount++;
    const btn = document.getElementById(`dream-btn-${d.id}`);
    if (btn) {
      const canBuy = !maxed && state.dreamPoints.gte(cost);
      btn.classList.toggle("affordable", canBuy);
      btn.classList.toggle("owned", has);
      btn.disabled = maxed;
    }
    const cEl = document.getElementById(`dream-${d.id}-cost`);
    if (cEl) {
      cEl.textContent = maxed
        ? (d.repeatable ? "已满级 ✓" : "已生效")
        : `花费 ${sci(cost)} 梦想点（持有 ${sci(state.dreamPoints)}）`;
    }
    // 可重复升级的等级读数（`Lv 3 / 12`）—— 一次性那条仍显示"未购买/已购买"（由上面的 st 处理）✓
    if (st && d.repeatable) {
      st.textContent = d.maxLevel != null ? `Lv ${lv} / ${d.maxLevel}` : `Lv ${lv}`;
    }
  }
  const badge = document.getElementById("dream-badge");
  if (badge) badge.textContent = `${ownedCount} / ${DREAM_UPGRADES.length}`;
}

/** 本地判定（不 import engine，避免循环）—— 与 `dreamUpgradeLevelOf` 同口径：存 true/数字 ✓ */
function hasDreamUpgradeLocal(state, id) {
  const v = state?.dreamUpgrades?.[id];
  return v === true || (typeof v === "number" && v > 0);
}