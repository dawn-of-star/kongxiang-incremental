/**
 * ui.js —— 装配层 + 静态结构构建（唯一初始化入口）
 *
 * ★ 2026 模块化后的职责（**只保留"构建一次"的东西**）：
 *   · build*()：从 config 生成静态 DOM（升级卡 / 里程碑 / 图例 / 折叠分组）
 *   · activateTab / initUI：标签与按钮绑定
 *   · render()：**只做编排** —— 各区块的渲染在 ui-panels.js / ui-<panel>.js
 *   · showOfflineBanner / flashSave：两个一次性提示
 *
 * ⚠️ 面板的渲染逻辑**不要写回这里**；DOM 地基在 ui-core.js。
 */
import {
  $, el, fmt, sci, fmtMult, fmtTime,
  UI_BUILD, domWriteStats, domResetStats,
  applyZone, cache, setUIHandlers,
} from "./ui-core.js";
// 面板渲染器（单向依赖：panels → ui-core；本文件只做编排）
import { renderDarkMatter } from "./ui-darkmatter.js";
import { renderNeko } from "./ui-neko.js";
import { renderQuantum, renderSpanLayer } from "./ui-quantum.js";
import { renderInfinity, renderFloatResets } from "./ui-infinity.js";
import { renderTangram } from "./ui-tangram-panel.js";
// 主面板区块（render() 只做编排）
import {
  renderPageUnlockSelfHeal, renderResourceBars, renderClickAndUpgrades, renderVoidPanel,
  renderEternityPanel, renderTierMilestones, renderZpeEnginePanel, renderAutomationStatus,
  renderZpeMilestonesPanel, renderDarkEnergyPanel, renderLogPanel,
} from "./ui-panels.js";
// 静态结构 / 交互绑定（仍然集中在这一层）
import { arrangeDreamPage, renderDreamPage } from "./dream-ui.js";
import { bindTangramBoard } from "./tangram-board.js";
import { setupTabLocks } from "./lock-ui.js";
import { perfSection } from "./perf.js";
import {
  BASE, DE_MILESTONES, DE_SPAN, DE_UPGRADES, DREAM_UPGRADES, ENGINE_MECH,
  ETERNITY_MILESTONES, INFINITY_ORDER, INFINITY_UPGRADES,
  MATTER_B_KMAX, MATTER_B_KNEE, NEKO_ITEMS, REPEATABLE, TIER_MILESTONES,
  UI_FOLDS, VOID_UPGRADES, ZONES, ZONE_OF, ZPE_ENGINE, ZPE_MILESTONES,
  matterTotalExponent, zoneOf, zpeEngineLevel,
} from "./config.js";
// 既有调用方（main.js / tools）仍可从 ui.js 拿到这些名字
export { $, el, fmt, sci, fmtMult, fmtTime, UI_BUILD, domWriteStats, domResetStats };


function buildUpgrades() {
  el["upgrade-list"].innerHTML = "";
  for (const cfg of Object.values(REPEATABLE)) {
    const row = document.createElement("div");
    row.className = "btn-main";
    row.innerHTML = `
      <button class="btn" id="btn-upg-${cfg.id}">
        <div class="btn-row">
          <span class="btn-name">${cfg.name}</span>
          <span class="btn-lv" id="upg-${cfg.id}-lv">Lv 0</span>
        </div>
        <div class="btn-desc" id="upg-${cfg.id}-desc"></div>
        <div class="btn-cost" id="upg-${cfg.id}-cost">—</div>
      </button>
      <button class="btn-max" id="btn-max-${cfg.id}" title="一次买满（闭式解）">
        <span class="n" id="max-${cfg.id}-n">0</span>买满
      </button>
    `;
    el["upgrade-list"].appendChild(row);
    applyZone(row.querySelector(`#btn-upg-${cfg.id}`), cfg.id);
    const mx = row.querySelector(`#btn-max-${cfg.id}`);
    mx.classList.add("zone", `zone-${ZONE_OF[cfg.id]}`);
  }
}

/** 9 个虚空升级 */
function buildVoidUpgrades() {
  el["void-upgrade-list"].innerHTML = "";
  for (const cfg of Object.values(VOID_UPGRADES)) {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.id = `void-btn-${cfg.id}`;
    btn.innerHTML = `
      <div class="btn-row">
        <span class="btn-name${cfg.costDream ? " rainbow" : ""}">${cfg.name}</span>
        <span class="btn-lv" id="void-${cfg.id}-state">未购买</span>
      </div>
      <div class="btn-desc">${cfg.desc}</div>
      <div class="btn-cost" id="void-${cfg.id}-cost">—</div>
    `;
    el["void-upgrade-list"].appendChild(btn);
    // ★ 2025 修复：原来是 `applyZone(cfg.id)` —— **只传 id 没传元素** ✗
    //   兼容守卫换位后 `el` 仍是 undefined ⇒ 直接 return ⇒ **9 条虚空升级一个都没上色** ✗
    //   （用户报"加成按钮没有按乘区上色"的根因之一。）改为与暗能量同一写法 ✓
    applyZone(btn, cfg.id);
  }
}

/** 3 个暗能量升级 */
function buildDeUpgrades() {
  el["de-upgrade-list"].innerHTML = "";
  for (const cfg of Object.values(DE_UPGRADES)) {
    const row = document.createElement("div");
    row.className = "btn-main";
    row.innerHTML = `
      <button class="btn" id="de-btn-${cfg.id}">
        <div class="btn-row">
          <span class="btn-name${cfg.costDream ? " rainbow" : ""}">${cfg.name}</span>
          <span class="btn-lv" id="de-${cfg.id}-lv">Lv 0</span>
        </div>
        <div class="btn-desc" id="de-${cfg.id}-desc"></div>
        <div class="btn-cost" id="de-${cfg.id}-cost">—</div>
      </button>
      <button class="btn-max" id="de-max-${cfg.id}" title="连续购买直到买不起">买满</button>
    `;
    el["de-upgrade-list"].appendChild(row);
    applyZone(row.querySelector(`#de-btn-${cfg.id}`), cfg.id);
    row.querySelector(`#de-max-${cfg.id}`).classList.add("zone", `zone-${ZONE_OF[cfg.id]}`);
  }
}

/** 两种里程碑 */
function buildMilestones() {
  el["milestone-list"].innerHTML = "";
  for (const m of ZPE_MILESTONES) {
    const d = document.createElement("div");
    d.className = "ms";
    d.id = `ms-${m.id}`;
    d.innerHTML = `<span class="dot"></span><span class="txt">${m.desc}</span><span class="need" id="ms-${m.id}-need">—</span>`;
    el["milestone-list"].appendChild(d);
    applyZone(d, m.id, false);
  }
  el["de-milestone-list"].innerHTML = "";
  for (const m of DE_MILESTONES) {
    const d = document.createElement("div");
    d.className = "ms";
    d.id = `dms-${m.id}`;
    d.innerHTML = `<span class="dot"></span><span class="txt">${m.desc}</span><span class="need" id="dms-${m.id}-need">—</span>`;
    el["de-milestone-list"].appendChild(d);
    applyZone(d, m.id, false);
  }
}

/** 乘区图例 */
function buildLegend() {
  const box = el["zone-legend"];
  if (!box) return;
  box.innerHTML =
    Object.entries(ZONES)
      .map(([key, z]) => {
        // 虹色乘区（梦想加成）走渐变色块，不是单一 color
        const swatch = z.rainbow
          ? `<span class="swatch swatch-rainbow"></span>`
          : `<span class="swatch" style="--zone:${z.color}"></span>`;
        return `<span class="item zone-${key}">${swatch}${z.name}</span>`;
      })
      .join("") +
    `<span class="hint">颜色 = 加成作用的位置：同一颜色就是叠在同一个位置；` +
    `描述里带「最终」二字的另算一层</span>`;
}

/**
 * ∞ 层：无限升级（**2×n 网格**）。
 *
 * 为什么是网格：条目已经有 12 条（①~④ + 起点跃迁×4 + 速率解放×4），
 * 单列会把无限页拉得很长；两列刚好一屏。
 *
 * 颜色规则（用户指定）：
 *   · **不再一律用彩色/虹色**，而是按"加成落在哪个位置"取乘区色（`ZONE_OF`）；
 *   · 只有**作用于梦想系统**的条目才保留虹色（`z.rainbow`）。
 */
function buildInfinityUpgrades() {
  const box = el["inf-upgrade-list"];
  if (!box) return;
  box.innerHTML = "";

  // ★★ 2025：**① 无限增幅置顶、独立占一行**（用户要求），形态与
  //   「升级中心」里的可重复升级**一致**：主按钮 + 「买满」按钮（同一个 CSS 类 `btn-main`）。
  //   ⚠️ 外壳是**静态写在 index.html 里**的（这样 `cache()` 在 `initUI` 早期就能拿到这些 id）
  //      ⇒ 这里只补文案与**乘区色**，不重建 DOM ✓
  //   ⇒ 它不再出现在下面的 `.inf-grid` 里（下面的循环里 `continue` 跳过它 ✓）。
  const row = el["inf-ipdouble-row"];
  if (row) {
    el["inf-ipDouble-desc"].textContent = INFINITY_UPGRADES.ipDouble.desc;
    applyZone(el["inf-btn-ipDouble"], "ipDouble");
    el["btn-max-ipDouble"].classList.add("zone", `zone-${ZONE_OF.ipDouble}`);
  }

  for (const id of INFINITY_ORDER) {
    if (id === "ipDouble") continue;          // ★ 已置顶，不进网格
    const cfg = INFINITY_UPGRADES[id];
    const z = zoneOf(id);
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.id = `inf-btn-${id}`;
    btn.innerHTML = `
      <div class="btn-row">
        <span class="btn-name${z.rainbow ? " rainbow" : ""}">${cfg.name}</span>
        <span class="btn-lv" id="inf-${id}-state">未购买</span>
      </div>
      <div class="btn-desc" id="inf-${id}-desc">${cfg.desc}</div>
      <div class="btn-cost" id="inf-${id}-cost">—</div>
    `;
    box.appendChild(btn);
    // ★ 2025 修复：同样是"只传 id"✗ ⇒ 16 条无限升级没上色。改为传元素 ✓
    applyZone(btn, id);
  }
}

/**
 * 梦想点一次性升级（量子页）。
 *
 * 颜色规则与其他列表**同一套**：乘区色由 `ZONE_OF` 决定；这四条属于 dream 乘区，
 * 于是自动走虹色（`applyZone` 对 `z.rainbow` 加 `rainbow-card`）、名字加 `.rainbow`。
 *
 * ⚠️ 踩过两个坑，正是"虹色不动 / 加成区不对"的根因：
 *   1. 原来硬编码 `zone zone-dm` —— 它们不属于量子乘区（语义错，颜色也是错的）；
 *   2. 原来只给卡片加 `rainbow-card`（静态 `border-image`），名字上没有 `.rainbow`，
 *      而带动画的是 `.rainbow` —— 所以"颜色不动"。
 */
function buildDreamUpgrades() {
  const box = el["dream-upgrade-list"];
  if (!box) return;
  box.innerHTML = "";
  // ★★★ 2025：**可重复梦想升级必须在这里登记** —— 让 `tools/dead-code-audit.mjs`
  //   能验证"这些 id 真的被处理了" ✓
  //   为什么需要：`dreamUpgradeEffects()` 是按 `effect.kind` **泛化分发**的，
  //   而"等级"是按 **id** 读的（`dreamUpgradeLevelOf` / `dreamUpgradeCostAt`）⇒
  //   若有人在 config 里塞一个 `repeatable` 却没人处理的新升级，
  //   纯泛化分发会**静默漏掉**它（面板显示"未购买"、永远买不了第 2 级）✗
  //   ⇒ 这个集合就是"已知会被按 id 处理"的清单；新增必须登记，否则审计报红 ✓
  const REPEATABLE_DREAM = new Set(["offlineCap"]);
  for (const d of DREAM_UPGRADES) {
    const z = zoneOf(d.id);
    const btn = document.createElement("button");
    btn.className = "btn q-card";
    btn.id = `dream-btn-${d.id}`;
    if (REPEATABLE_DREAM.has(d.id) && !d.repeatable) {
      // 自检：登记了却忘了在 config 标 `repeatable` ⇒ 打日志暴露（不静默）✓
      console.warn(`[dream] ${d.id} 登记为可重复，但 config 里没标 repeatable`);
    }
    btn.innerHTML = `
      <div class="btn-row">
        <span class="btn-name${z.rainbow ? " rainbow" : ""}">${d.name}</span>
        <span class="btn-lv" id="dream-${d.id}-state">未购买</span>
      </div>
      <div class="btn-desc">${d.desc}</div>
      <div class="btn-cost" id="dream-${d.id}-cost">${d.repeatable ? `花费 ${sci(d.cost)} 梦想点` : `花费 ${d.cost} 梦想点`}</div>
    `;
    box.appendChild(btn);
    // ★ 2025 修复：同样是"只传 id"✗ ⇒ 4 条梦想升级没上色。改为传元素 ✓
    applyZone(btn, d.id);
  }
}


/** 标签页切换 */
function setupTabs() {
  const bar = el["tabs"];
  if (!bar) return;
  bar.addEventListener("click", (e) => {
    // ★ 用 [data-tab] 而不是 .tab：虚空科技的**悬浮子页入口**也是 data-tab
    const tab = e.target.closest("[data-tab]");
    if (!tab || tab.classList.contains("locked")) return;
    activateTab(tab.dataset.tab);
  });
}

/**
 * 建 ZPE 引擎的「三条机制」卡片（**只在初始化时跑一次**）。
 *
 * 为什么不放在 `render()` 里：每帧 `innerHTML = …` 会重建 DOM，
 * 于是 `:hover` 与 CSS 过渡每帧被重置 —— 鼠标移上去就频繁闪烁（用户实测报的 bug）。
 * 这里把**不变的文案**（名字、条件）写死成静态 DOM，`render()` 只更新会变的那两处文本。
 */
function buildZpeMechanisms() {
  const box = el["zpe-engine-mechanisms"];
  if (!box) return;
  const cards = [
    {
      name: "① ZPE 倍率的加法区加成",
      at: `饱和式：+${ENGINE_MECH.add.A} 为上限（x = 等级/${ENGINE_MECH.add.knee}，x/(1+x) 收敛）⇒ 有终点 ✓` },
    {
      name: "② 按等级提速产出与倍率",
      at: `开根式：产出 ×(1 + ${ENGINE_MECH.prod.coeff}·√等级)、倍率 ×(1 + ${ENGINE_MECH.mult.coeff}·√等级)（增长极慢 ⇒ 实际到顶早）` },
    {
      name: "③ 吃「计数频率」与「量子」加成",
      at: `等级 ${ZPE_ENGINE.countFreqLevel} 解锁计数频率（纯阈值 ⇒ 本身就是终点）；量子再给 ZPE 倍率 +q³/10（加法区）` },
    {
      // ★ 2025：设计稿第 4 条**之前漏了**（面板只列了 3 条 ✗）—— 用户指出后补上 ✓
      name: "④ 引擎倍率也作用于暗能量倍率",
      at: `饱和式：×${ENGINE_MECH.de.A + 1} 为上限（x = 等级/${ENGINE_MECH.de.knee}）⇒ 有终点 ✓` },
    {
      // ★ 2026 语义修正：这是**物质系数的局部幂**，不是正式 b区。
      //   正式 b区必须包住整个资源值；这里取幂的是 `matterCoeff`（系数）
      //   ⇒ 主要改高度，不改长期斜率。完整落点见 docs/BONUS-POSITIONS.md。
      name: "⑤ 物质系数幂（局部指数）：引擎给物质系数一个指数",
      at: `对物质系数取幂（不是资源整体）：k = 1 → ${1 + MATTER_B_KMAX}（${MATTER_B_KNEE} 级后饱和）；主要提高高度` },
  ];
  box.innerHTML = cards.map((c, i) => `
      <div class="btn zone zone-zpe" id="zpe-mech-${i}" style="cursor:default">
        <div class="btn-row">
          <span class="btn-name">${c.name}</span>
          <span class="btn-lv" id="zpe-mech-${i}-state">未生效</span>
        </div>
        <div class="btn-desc" id="zpe-mech-${i}-now">—</div>
        <div class="btn-cost" style="color:var(--text-faint)">${c.at}</div>
      </div>`).join("");
}

/**
 * 建「坍缩里程碑」清单（**只建一次**，`render()` 里只切 class）。
 *
 * ⚠️ 结构必须与 `buildVoidUpgrades()` 里的里程碑**逐字一致**：
 *    `div.ms` + `span.dot / .txt / .need`，状态用 `done` / `next` 两个 class。
 *    第一版我用了 `ms-item` 这个**不存在的 class**，于是它在页面上和别的里程碑长得不一样。
 *    （这里刻意**不调** `applyZone()`：档位里程碑的效果落在好几格上，
 *      按项目规矩"落点不唯一就不上色"。）
 */
function buildTierMilestones() {
  const box = el["tier-milestone-list"];
  if (!box) return;
  box.innerHTML = "";
  for (const m of TIER_MILESTONES) {
    const d = document.createElement("div");
    d.className = "ms";
    d.id = `tms-${m.id}`;
    d.innerHTML = `<span class="dot"></span><span class="txt">${m.desc}</span>` +
      `<span class="need" id="tms-${m.id}-need">${m.at} 次大坍缩</span>`;
    box.appendChild(d);
  }
}

/**
 * ★★ 2025：**永恒里程碑**列表（设计稿 36~44 行；按永恒次数解锁）。
 *
 * 与档位里程碑同一套 DOM 约定（`.ms` + `.done` / `.next`），但多一个状态：
 * **`pending`（待实装）** —— 条目已登记、机制本体还没做。
 * 这一类**必须显式标出来**（用户指定"剩下的先做个占位"），
 * 否则玩家拿到后会以为有效果 ✗。`tools/eternity-lab.mjs` 有断言守这条。
 *
 * ⚠️ 刻意**不调 `applyZone()`**：永恒里程碑的效果落在好几处（IP 保留 / 量子 / 熵 / …），
 *   按项目规矩"落点不唯一就不上色"。
 */
function buildEternityMilestones() {
  const box = el["eternity-milestone-list"];
  if (!box) return;
  box.innerHTML = "";
  for (const m of ETERNITY_MILESTONES) {
    const d = document.createElement("div");
    d.className = "ms";
    d.id = `ems-${m.id}`;
    d.innerHTML = `<span class="dot"></span><span class="txt">${m.desc}</span>` +
      `<span class="need" id="ems-${m.id}-need">第 ${m.need} 次永恒</span>`;
    box.appendChild(d);
  }
}

/**
 * ★★★ 2025 新实现（第三层设计稿 33~35 行）：**永恒升级「永恒增幅」的渲染**。
 *
 * ⚠️ 与实发**同源**：等级/倍率/价格分别来自
 *   `state.epMultLevel` / `epMultFactor` / `epMultPriceAt`（唯一入口）⇒
 *   不可能出现"显示 ≠ 实发" ✓（本项目在这上面栽过 4 次）
 */
const TAB_PARENT = { void: "void", zpe: "void", de: "de", darkm: "de", quantum: "quantum", infinity: "infinity", infdeep: "infinity", eternity: "eternity", tangram: "eternity" };
/** 子页 → 它的父标签（父标签在子页激活时保持高亮） */
const SUB_WRAP = {
  zpe: "tab-wrap-void",
  infdeep: "tab-wrap-infinity",
  // ★★★ 2026：暗能量的子页（暗物质）
  darkm: "tab-wrap-de",
  // ★★★ 2026：永恒的子页（七巧板 —— 骨架）
  tangram: "tab-wrap-eternity",
  // ★★★ 2025（用户裁定）：主控台的**三个子页**（主控台本体 / 梦想 / 猫猫）
  //   —— 与虚空科技同一套表现形式 ✓
  dream: "tab-wrap-console",
  neko: "tab-wrap-console",
};
const ALL_PANELS = [
  "console", "dream", "neko",          // ★ 2025：主控台的三个子页
  "void", "zpe", "de", "darkm", "quantum", "infinity", "infdeep", "eternity", "tangram",
];

export function activateTab(name) {
  for (const t of el["tabs"].querySelectorAll("[data-tab]")) {
    const on = t.dataset.tab === name;
    t.classList.toggle("active", on && !t.classList.contains("flyout-item"));
    if (t.classList.contains("flyout-item")) t.classList.toggle("active", on);
  }
  // 父标签高亮：表驱动（原来硬编码 void/zpe，加第二个子页时会漏）
  for (const [sub, wrapId] of Object.entries(SUB_WRAP)) {
    el[wrapId]?.classList.toggle("sub-active", name === sub);
  }
  for (const p of ALL_PANELS) {
    const panel = el[`panel-${p}`];
    if (panel) panel.hidden = p !== name;
  }
}


// ══════════════════════════════════════════════════════════
// 渲染
// ══════════════════════════════════════════════════════════

/** 上一次渲染进日志面板的内容签名（见 render() 里的说明） */

export function render(state) {
  // ★ 2026：编排层 —— 每个区块的实现在 `ui-panels.js` / `ui-<panel>.js`
  //   顺序 = 画面刷新顺序；每块只改文本/class，不重建 DOM。
  renderPageUnlockSelfHeal(state);
  const R = state.resources;
  renderResourceBars(state);
  // 猫猫卡片：无条件刷新（好感度不受面板显隐影响）
  perfSection("猫猫卡", () => renderNeko(state));
  renderClickAndUpgrades(state);
  renderVoidPanel(state);
  renderEternityPanel(state);
  renderTierMilestones(state);
  renderZpeEnginePanel(state);
  renderAutomationStatus(state);
  renderZpeMilestonesPanel(state);
  perfSection("暗能量面板（含里程碑）", () => renderDarkEnergyPanel(state));
  perfSection("量子面板", () => renderQuantum(state, R));
  perfSection("量子共振", () => renderSpanLayer(state));
  perfSection("暗物质", () => renderDarkMatter(state));
  perfSection("七巧板", () => renderTangram(state));
  perfSection("无限面板", () => renderInfinity(state));
  renderFloatResets(state);
  renderDreamPage(state);
  renderLogPanel(state);
}

function applyStaticZones() {
  const pairs = [
    ["btn-buy-trap", "trap"],                       // 熵阱 → 熵产出
    ["btn-unlock-zpe-engine", "zpeEngine"],         // 启动引擎 → ZPE
    ["btn-buy-zpe-engine", "zpeEngine"],
    ["btn-buy-zpe-engine-max", "zpeEngine"],
    ["btn-unlock-transmuter", "transmuter"],        // 相变仪 → 暗能量
    ["btn-bigcrunch", "bigcrunch"],                 // 大坍缩 → 无限点收益
    ["btn-break-infinity", "breakInfinity"],        // 打破无限 → 无限点收益
    // ★★★ 2025 补登记（`dom-smoke` 的「按钮乘区色」当场抓到我漏了它）：
    //   暗物质页的**买满按钮** `btn-max-darkm` 在 HTML 里是静态的、
    //   但不在本名单 ⇒ **静态未上色** ✗
    //   （主按钮 `btn-darkm` 因为 id 不匹配 `^btn-(buy|unlock|max)` 而不被断言查，
    //     但它同样硬编码了颜色 ⇒ 一并收进来，让乘区色只有 `ZONE_OF` 一个出处 ✓）
    ["btn-darkm", "darkmatter"],
    ["btn-max-darkm", "darkmatterBuyMax"],
  ];
  for (const [elId, zoneId] of pairs) {
    const node = el[elId] ?? $(elId);
    if (node) applyZone(node, zoneId);
  }
}

/**
 * ★★★ 2025（用户裁定：「让 ui 的描述**完全符合真实的**」）：**文案里的数字也要从常量来**。
 *
 * 背景：三页描述里原本**手写**了一堆具体数字，结果全都过期了 ✗
 *   · ZPE 页：「价格 5 × (等级+1)³（三次方）100/1000/10000 级起各再抬一次斜率」
 *     → 真实：`5 × costGrowth^等级`（**指数**，且**没有**分段斜率）
 *   · ZPE 页：「k 由等级给、1 → 26 单调饱和」→ 真实：`1 + KMAX·x/(1+x)` ⇒ **1 → 6**
 *   · 量子页：「暗能量到 1e50 时 k 封顶把它放大到 1e308」
 *     → 真实：有效量软上限 = knee 300 + span 60，而**实测 DE 只到 150~167** ⇒ 从未生效
 *   · 量子页：「购买瞬间记下当时的暗能量水位作为基准」
 *     → 真实：基准在**解锁 ZPE 引擎**那一刻就记下了（`thresholdFlat` 只是**开关**）
 * ⇒ 数字全部改由**这里**从常量渲染 ⇒ 常量一改文案跟着改，不可能再脱节 ✓
 *
 * ⚠️ 只在 `initUI` 里跑一次（这些数字**不随游戏状态变**）✓
 */
function buildDynamicText() {
  const set = (id, text) => { if (el[id]) el[id].textContent = text; };
  // ZPE 页：价格形状 + 标定锚点
  // ★★★ 2025/2026 UI 同步：价格形状**必须含 2000 级后的惩罚项** `ζ` ——
  //   公式实际是 `c0 · costGrowth^lv · ζ(lv)`，只写前两项会让人以为**没有**惩罚 ✗
  //   ⚠️ 语义定稿：ζ 是**逐级连乘**（`M^(lv−2000+1)`）⇒ 2000 级起**每级都 ×1e5** ✓
  set("zpe-price-shape",
    `${ZPE_ENGINE.baseCostIp} × ${ZPE_ENGINE.costGrowth}^等级` +
    (ZPE_ENGINE.steepAfter?.level != null
      ? ` × ζ，ζ = ${(ZPE_ENGINE.steepAfter.mult ?? 1e5).toExponential(0)}^(等级−${ZPE_ENGINE.steepAfter.level}+1)`
        + `（${ZPE_ENGINE.steepAfter.level} 级起**每级再 ×${(ZPE_ENGINE.steepAfter.mult ?? 1e5).toExponential(0)}**）`
      : ""));
  set("zpe-price-anchor", `｜标定：1e28 无限点 ≈ 100 级`);
  // ZPE 页：物质系数幂 k 的真实形状（**不是** 1→26；也不是正式 b区）
  set("zpe-k-shape",
    `k = 1 + ${MATTER_B_KMAX}·x/(1+x)（x = 等级/${MATTER_B_KNEE}）` +
    ` ⇒ **1 → ${(1 + MATTER_B_KMAX).toFixed(0)}** 单调饱和` +
    `（等级 ${MATTER_B_KNEE} 时 k = ${matterTotalExponent({ zpeEngineLevel: MATTER_B_KNEE }).toFixed(2)}）`);
  // 量子页：量子共振的幂上界（6.1651）
  set("span-kmax", String(DE_SPAN.kMax));
}

/**
 * ★★★ 2025（设计稿第 27 行 / 用户裁定）：**折叠分组的唯一实现**。
 *
 * 需求（用户原话）：「我要是用户估计会倾向于 **b 方案**（可折叠）——
 *   建议有个**下拉条**，同时下拉条中有个**复选框**以确认**记住展开状态**」
 *
 * 行为：
 *   · 未勾"记住" ⇒ 每次打开页面都用 `defaultOpen`（**不记忆**）
 *   · 勾了"记住" ⇒ 把当前展开态写进 localStorage，下次按它还原 ✓
 *
 * ⚠️ 三个易错点，都在这一个函数里收口：
 *   ① 复选框在**标题行内部** ⇒ 点它**不能**连带折叠（`stopPropagation`）
 *   ② `localStorage` 可能抛（隐身模式 / 配额满）⇒ 全程 try/catch，
 *      失败就退化成"不记忆"（**绝不能因此让 UI 初始化失败** ✗）
 *   ③ 展开态必须同时反映到 `aria-expanded`（无障碍 + CSS 箭头）**和** `hidden`
 */
function setupFolds() {
  for (const f of Object.values(UI_FOLDS)) {
    const head = el[`fold-${f.id}-head`];
    const body = el[`fold-${f.id}-body`];
    const box = el[`fold-${f.id}-remember`];
    if (!head || !body) continue;

    const store = {
      read() {
        try {
          const v = localStorage.getItem(f.rememberKey);
          return v === "open" ? true : v === "closed" ? false : null;
        } catch { return null; }
      },
      write(open) {
        try { localStorage.setItem(f.rememberKey, open ? "open" : "closed"); } catch { /* 不记忆 */ }
      },
      clear() {
        try { localStorage.removeItem(f.rememberKey); } catch { /* 忽略 */ }
      },
    };

    // 初始态归 `applyFoldPreference` 管（**导出** ⇒ 断言能单独验"重启后按记忆还原"✓）
    applyFoldPreference(f, head, body, box, store);

    // 标题行 = 下拉条（`<button>` ⇒ Enter/Space 原生可用 ✓）
    head.addEventListener("click", () => {
      const nowOpen = body.hidden;              // 收起 ⇒ 这次要展开
      setFoldOpen(head, body, nowOpen);
      if (box?.checked) store.write(nowOpen);
    });

    // 复选框：勾上时**以当前状态为准**写入（而不是改状态）——
    //   否则"勾选"这个动作本身会顺带折叠一次，很反直觉 ✗
    box?.addEventListener("click", (e) => {
      e.stopPropagation();                      // ⚠️ 易错点①：别连带折叠
      if (e.target.checked) store.write(!body.hidden);
      else store.clear();                       // 取消勾选 ⇒ 回到"不记忆"
    });
  }
}

/** 折叠态的**唯一写入点**：`hidden` 与 `aria-expanded` 必须一起改（分开改必漏一个 ✗） */
export function setFoldOpen(head, body, open) {
  body.hidden = !open;
  head.setAttribute("aria-expanded", open ? "true" : "false");
}

/**
 * 折叠的**初始态**（导出 ⇒ 断言可以单独验"重开页面按记忆还原"，
 * 不必调整个 `initUI` —— 那样会**累积监听器**并需要全套 handlers ✗）。
 *
 * 规则：**只认"记住"勾选过的情况**下的存储值，否则用 `defaultOpen`。
 * ⚠️ "用户是否勾过记住"这件事本身也得记住 ⇒ 用同一个键的**存在性**表达 ✓
 */
export function applyFoldPreference(f, head, body, box, store) {
  const s = store ?? {
    read() {
      try {
        const v = localStorage.getItem(f.rememberKey);
        return v === "open" ? true : v === "closed" ? false : null;
      } catch { return null; }
    },
  };
  let remembered = false;
  try { remembered = localStorage.getItem(f.rememberKey) !== null; } catch { remembered = false; }
  if (box) box.checked = remembered;
  const saved = remembered ? s.read() : null;
  setFoldOpen(head, body, saved === null ? f.defaultOpen === true : saved);
  return { remembered, open: body.hidden === false };
}

/**
 * ★★★ 2025（用户裁定：「ui 确保在**购买门槛压平后**正确显示就行」）：**量子共振**渲染。
 *   （★★★ 2026 用户裁定：原名「跨度层」⇒ **改名为「量子共振」**，机制/数值完全不变；
 *     内部标识符仍是 `span*`（`state.spanDeBase` 是存档字段）⇒ 见 `DE_SPAN` 的注释）
 *
 * ── 为什么必须独立成一个函数（而不是留在 `renderQuantum` 里）──
 *   `renderQuantum` 在"本轮还没推进到量子页"时**提前 return**（`if (!showContent) return`），
 *   而量子共振是**打破无限之后**才生效的机制 —— 那一刻量子页往往正显示
 *   「已解锁 · 待推进」⇒ 留在里面就**永远不刷新**（徽标停在静态 HTML 的初值）✗
 *   ⇒ 抽出来，在 `render()` 里**无条件**调用（与猫猫卡同一做法）✓
 *
 * ── 判据唯一来源 ──
 *   `matterSpanStatus(state)`（config.js）。原来这里自己写 `spanDeBase > 0`，
 *   而实发（`matterSpanMult`）看 `thresholdFlatBought`
 *   ⇒ "引擎到手 → 买到门槛压平"这段会显示「已开启」而实际乘数恒 ×1 ✗（显示 ≠ 实发）
 *   ⇒ 现在徽标只在**真的在乘**（`mult > 1`）时才说"已生效"，
 *     中间每个阶段都有**具体原因**（armed / 未超基准 / 未开启）✓
 *   ★ 2026：**硬上限**（基础物质 > 1e100000）单独一个徽标「已失效（硬上限）」——
 *     它必须**优先于**其他阶段判断，否则会显示"已生效"而乘数其实是 ×1 ✗
 */
function setupFloatResets(handlers) {
  const box = el["float-resets"];
  // ── 折叠 / 展开（状态存 localStorage，与折叠分组 `UI_FOLDS` 同一套习惯）✓
  const MIN_KEY = "kongxiang.ui.floatResets.min";
  const minBtn = el["fr-min"];
  if (box && minBtn) {
    let collapsed = false;
    try { collapsed = localStorage.getItem(MIN_KEY) === "1"; } catch (_) { /* 隐私模式 */ }
    const apply = (v) => {
      box.classList.toggle("fr-collapsed", v);
      minBtn.textContent = v ? "+" : "−";
      minBtn.title = v ? "展开" : "折叠";
    };
    apply(collapsed);
    minBtn.addEventListener("click", () => {
      collapsed = !collapsed;
      apply(collapsed);
      try { localStorage.setItem(MIN_KEY, collapsed ? "1" : "0"); } catch (_) { /* ignore */ }
    });
  }
  // ── 无限 / 永恒：**与页面按钮同一个 handler** ✓
  el["fr-btn-infinity"]?.addEventListener("click", handlers.onBigCrunch);
  el["fr-btn-eternity"]?.addEventListener("click", handlers.onEternity);
  // ── 时空 / 梦想：**占位**，不接 handler ✓
  //   （`disabled` 按钮本来收不到 click；这里显式不接，是为了将来加机制时
  //     一眼看出"该去哪里接" —— 见 index.html 里那段注释）
}

// ★★★ 2026 修 bug（用户截图：`ReferenceError: handlers is not defined`）——
//   `handlers` 只是 `initUI()` 的**参数**，模块级函数（如 renderTangramReal）里**看不到**它 ✗
//   ⇒ 在这里存一份模块级引用，给那些函数用 ✓

export function initUI(handlers) {
  setUIHandlers(handlers);
  cache();
  applyStaticZones();     // ★ 静态按钮的乘区色（唯一数据源 = ZONE_OF）
  buildUpgrades();
  buildVoidUpgrades();
  buildZpeMechanisms();   // ★ 三条机制只建一次（放在 render 里会每帧重建 → hover 闪烁）
  buildTierMilestones();  // ★ 档位里程碑同理
  buildEternityMilestones();  // ★ 2025：永恒里程碑（只建一次）
  buildDeUpgrades();
  buildMilestones();
  buildLegend();
  buildDreamUpgrades();
  // ★ 2026：建完后**排一次**分组 + 挂开关（只搬卡片，不重建 ⇒ id/handler 全保留）✓
  arrangeDreamPage();   // ⚠️ 这里没有 state 变量（构建期）⇒ 模块内部用 renderDreamPage 存下的引用 ✓
  // ★ 2026：七巧板拖拽（自由拖动 + 松手吸附 0.2 格；拖拽中 R/F）✓
  bindTangramBoard(null, () => {});   // ⚠️ 构建期没有 state（TDZ）⇒ 模块用 paint 时存下的引用 ✓
  buildInfinityUpgrades();
  setupTabs();
  setupTabLocks();        // ★ 2026：锁角标的样式由模块自己注入（不动 css 文件）✓
  setupFolds();           // ★ 2025：主面板折叠分组（设计稿第 27 行 + 用户裁定的下拉条/记住）
  setupFloatResets(handlers);   // ★ 2025：全页面悬浮重置窗（四按钮 + 折叠）
  buildDynamicText();     // ★ 2025：三页描述里的数字**从常量来**（原来手写的全过期了 ✗）
  // ★ 2025：默认打开「主控台」（原左列的 5 张卡并进标签页后成为第一个面板）
  activateTab("console");

  el["btn-click"].addEventListener("click", handlers.onClick);
  el["btn-buy-trap"].addEventListener("click", handlers.onBuyTrap);
  el["btn-save"].addEventListener("click", handlers.onSave);
  el["btn-export"].addEventListener("click", handlers.onExport);
  el["btn-reset"].addEventListener("click", handlers.onReset);
  el["btn-unlock-transmuter"].addEventListener("click", handlers.onUnlockTransmuter);
  // 临界坍缩是自动的，所以没有按钮可绑。
  // （曾经这里挂着 el["btn-collapse"] 的监听，删掉 HTML 后就成了悬空引用 ——
  //   是烟测的「el[] 未进 cache」反向检查抓出来的。）
  el["btn-bigcrunch"].addEventListener("click", handlers.onBigCrunch);
  el["btn-break-infinity"].addEventListener("click", handlers.onBreakInfinity);
  // ★★★ 2025：永恒升级「永恒增幅」（设计稿 33~35 行）
  //   ⚠️ 用 `?.` —— 元素若不在（旧 html 缓存）也不该让整段初始化抛错 ✗
  el["btn-eternity-upg-epMult"]?.addEventListener("click", () => handlers.onBuyEpMult(false));
  el["btn-max-eternity-upg-epMult"]?.addEventListener("click", () => handlers.onBuyEpMult(true));
  // ★★★ 2026：暗物质（暗能量的第二个子页）—— 与永恒增幅同一套接线 ✓
  el["btn-darkm"]?.addEventListener("click", () => handlers.onBuyDarkMatter(false));
  el["btn-max-darkm"]?.addEventListener("click", () => handlers.onBuyDarkMatter(true));
  // ★★★ 2025：按乘区上色（新增的 `eternity` 乘区，见 config.js 的 ZONES / ZONE_OF）——
  //   用户要求：「所有的加成按钮都应根据代码中的加成落点提供颜色」
  applyZone(el["btn-eternity-upg-epMult"], "epMult");
  el["btn-max-eternity-upg-epMult"]?.classList.add("zone", `zone-${ZONE_OF.epMult}`);
  // ★★★ 2025（`NEKO.md` §10）：**三个好感度道具**的按钮 —— 全部走 `handlers.onUseNekoItem`
  //   （它内部调 `useNekoItem` = **唯一入口**，扣款与好感度写入都在那里 ✓）
  //   ⚠️ 那对 `±8` 调试按钮已**删除** —— 道具实装后不再需要（它们是"没有道具时的可见性补丁"）✓
  for (const it of Object.values(NEKO_ITEMS)) {
    el[`btn-neko-item-${it.id}`]?.addEventListener("click", () => handlers.onUseNekoItem(it.id));
  }

  for (const cfg of Object.values(REPEATABLE)) {
    $(`btn-upg-${cfg.id}`)?.addEventListener("click", () => handlers.onBuyRepeatable(cfg.id, false));
    $(`btn-max-${cfg.id}`)?.addEventListener("click", () => handlers.onBuyRepeatable(cfg.id, true));
  }
  for (const cfg of Object.values(VOID_UPGRADES)) {
    $(`void-btn-${cfg.id}`)?.addEventListener("click", () => handlers.onBuyVoid(cfg.id));
  }
  for (const cfg of Object.values(DE_UPGRADES)) {
    $(`de-btn-${cfg.id}`)?.addEventListener("click", () => handlers.onBuyDe(cfg.id, false));
    $(`de-max-${cfg.id}`)?.addEventListener("click", () => handlers.onBuyDe(cfg.id, true));
  }
  // （原来这里还遍历 QUANTUM_UPGRADES 绑定量子升级按钮 ——
  //   旧量子升级系统已整体删除，那个数组现在是空的，循环也一并去掉）

  for (const d of DREAM_UPGRADES) {
    $(`dream-btn-${d.id}`)?.addEventListener("click", () => handlers.onBuyDream(d.id));
  }
  for (const id of INFINITY_ORDER) {
    $(`inf-btn-${id}`)?.addEventListener("click", () => handlers.onBuyInfinity(id));
  }
  // ★ 2025：① 置顶行的「买满」（形态与升级中心的买满按钮一致）
  el["btn-max-ipDouble"]?.addEventListener("click", () => handlers.onBuyIpDoubleMax());

  // ── ZPE 引擎（虚空科技的第二个子页）──
  el["btn-unlock-zpe-engine"].addEventListener("click", handlers.onUnlockZpeEngine);
  el["btn-eternity"].addEventListener("click", handlers.onEternity);
  el["btn-buy-zpe-engine"].addEventListener("click", () => handlers.onBuyZpeEngine(false));
  el["btn-buy-zpe-engine-max"].addEventListener("click", () => handlers.onBuyZpeEngine(true));

  // 熵阱也支持买满（右键）
  el["btn-buy-trap"].addEventListener("contextmenu", (e) => {
    e.preventDefault();
    handlers.onBuyTrap(true);
  });

  // 空格也能点
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat && e.target === document.body) {
      e.preventDefault();
      handlers.onClick();
    }
  });
}

/**
 * 离线收益横幅。
 *
 * ★ 2025：`cap` 由调用方传入（= `offlineCapSeconds(state)` 的结果）——
 *   原来这里**第三处**读 `BASE.offlineCapSeconds`：
 *   结算、判"是否被截断"、提示文案三处各读一次基础常量 ⇒
 *   加了「离线时长扩展」升级后，前两处按新上限、这一处还按 4h ⇒ 说谎 ✗
 *   ⇒ 全部由**唯一入口**给值 ✓
 */
export function showOfflineBanner(seconds, capped, cap = BASE.offlineCapSeconds) {
  const b = el["offline-banner"];
  if (!b) return;
  b.hidden = false;
  b.textContent = `欢迎回来！离线 ${fmtTime(seconds)}` +
    (capped ? `（已按 ${fmtTime(cap)} 上限结算）` : "");
}

export function flashSave() {
  const b = el["btn-save"];
  if (!b) return;
  const old = b.textContent;
  b.textContent = "已保存 ✓";
  b.classList.add("on");
  setTimeout(() => { b.textContent = old; b.classList.remove("on"); }, 1100);
}


