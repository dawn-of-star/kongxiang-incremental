/**
 * ui-quantum.js —— 量子面板 + 量子共振（原跨度层）
 *
 * ★ 2026 模块化：从 ui.js 抽出的**独立面板渲染器**。
 *   · DOM 缓存/去重/格式化一律来自 `./ui-core.js`（本文件不定义地基）
 *   · 只被 `ui.js` 的 render() 调用（单向依赖）
 */

import { COLLAPSE, engineBonusMult, matterSpanStatus, pageUnlocked, quantumDeGainBonus, quantumDeMultBonus, quantumEntropyMultiplier, quantumStepMult, quantumZpeMultBonus, quantumZpeRequirement } from "./config.js";
import { collapseUnlocked, particleBoostRate } from "./formulas.js";
import { $, el, fmt, fmtMult, sci } from "./ui-core.js";
import Decimal from "../dist/break_eternity.esm.js";

export function renderQuantum(state, R) {
  // ★★ 2025（用户裁定）：**页面解锁与"本轮是否推进到"分开** ——
  //   · 曾经解锁过（`pageUnlocked`，**永不重置**）⇒ 标签**不再上锁**、
  //     但本轮还没摸到 1e25 时显示"已解锁 · 待推进"，而不是把页面收回去 ✗
  //   · 本轮 `peakMatter ≥ 1e25` ⇒ 正常显示内容
  //   原来只判 `collapseUnlocked`（= peakMatter）⇒ 永恒归零后整页重新上锁 ✗
  const perma = pageUnlocked(state, "quantum");
  const live = collapseUnlocked(state);
  // ⚠️ `showContent` 与 `live` 同义（保留它是因为下面的语义是"内容是否刷新"）✓
  const showContent = live;

  // ★★★ 2025（用户裁定：「你要不还是给这个页面（包括无限对应的锁定页面）删了吧，bug 还在」）
  //   **量子页不再有"锁定块"** —— 内容常显，未达成时只用一条提示说明"本轮还要什么" ✓
  //   为什么这样才对：永恒会重置这些条件，而"本轮还没到"**不等于**"没解锁"
  //     ⇒ 每次永恒后玩家都会撞上一堵"你需要 XX"的墙，而机制其实好好的 ✗
  //   ⚠️ `q-hint` 用 `hidden`（它就在本页内 ⇒ 不会被 `activateTab` 覆盖）✓
  if (el["q-hint"]) {
    el["q-hint"].hidden = live;
    if (!live) {
      el["q-hint"].textContent = perma
        ? `本轮待推进：基础物质重新攒到 ${fmt(new Decimal(COLLAPSE.unlockMatter), 0)} 即可继续（已解锁过，进度不丢）`
        : `尚未解锁：需要基础物质达到 ${fmt(new Decimal(COLLAPSE.unlockMatter), 0)}`;
    }
  }
  // 标签：解锁过就**永不加锁**；"待推进"只是文字提示，不是墙 ✓
  const tabUnlocked = perma || live;
  const qTab = el["tab-tag-quantum"];
  qTab.textContent = showContent ? fmt(state.quantum, 0) : (perma ? "待推进" : "锁");
  el["tab-quantum"].classList.toggle("locked", !tabUnlocked);

  if (!showContent) return;

  el["val-quantum"].textContent = fmt(state.quantum, 0);
  el["quantum-sub"].textContent =
    `已捕获 ${state.quantumPairs.toNumber()} 对 · 累计 ${state.quantumPairsTotal.toNumber()} 对`;

  // ── 量子涨落捕获（第三层）──
  const need = quantumZpeRequirement(state.quantumPairs, quantumStepMult(state), state);
  const needLog = need.log10().toNumber();
  const curZpeLog = state.zpe.gt(0) ? state.zpe.log10().toNumber() : 0;
  el["quantum-pairs"].textContent = `${state.quantumPairs.toNumber()} 对`;
  // ★ 2025 统一科学计数法：原 `1e${needLog}` 有歧义（e 后跟小数）⇒ 规范成 `1.00eN` ✓
  el["quantum-next-cost"].textContent = `${sci(Decimal.pow(10, needLog))} ZPE`;
  el["quantum-cur-zpe"].textContent = fmt(state.zpe);
  // 进度：用对数刻度量「离门槛还差几个数量级」
  const qProg = needLog > 0 ? Math.max(0, Math.min(1, curZpeLog / needLog)) : 0;
  el["quantum-bar"].style.width = `${(qProg * 100).toFixed(1)}%`;
  el["quantum-bar-text"].textContent = `${(qProg * 100).toFixed(1)}%`;

  // ── ★ 量子给出的 5 条加成（**必须含引擎账** ⇒ 显示 == 实发）──
  //   ⚠️ 2025 踩过：引擎账原来只乘在 `formulas.js` 的**调用处**，而这里显示"纯量子给的"部分
  //      ⇒ 实测**面板显示 +21600，实发 +1e36**（差 1e31.7）✗ 典型的"显示 ≠ 实发"
  //   ⇒ 修法：`engineBonusMult` 作为**第二参**传进同一个函数 ⇒ 两边共用一条公式 ✓
  const ebmQ = engineBonusMult(state);
  el["quantum-mult"].textContent = fmtMult(quantumEntropyMultiplier(state.quantum, ebmQ));
  el["quantum-degain"].textContent = fmtMult(new Decimal(1).add(quantumDeGainBonus(state.quantum, ebmQ)));
  // ★ 2025：R 退休后，这一行改显**粒子增幅速率 b**（替代 R 的那一位）。
  //   b = b0·(1+√q/10)·里程碑·档位加速·infinityRateMult ⇒ 阈值软上限。
  //   玩家看到的含义：粒子获得的时变增幅 `g = 10^(b·本轮时间)` 的**对数斜率**（阶/秒）。
  el["quantum-grow"].textContent = `${fmt(particleBoostRate(state), 4)} 阶/秒`;
  el["quantum-demult"].textContent = fmtMult(new Decimal(1).add(quantumDeMultBonus(state.quantum, ebmQ)));
  // ★ 2025 新增：**量子 → ZPE 倍率的加法区加成**（ZPE 引擎设计稿第 3 条 ✓）
  //   与引擎同一个函数 `quantumZpeMultBonus` ⇒ 显示即实发 ✓
  if (el["quantum-zpemult"]) el["quantum-zpemult"].textContent = `+${fmt(quantumZpeMultBonus(state.quantum, ebmQ))}`;

  // ── ★ 量子共振（原名「跨度层」，2025 用户方案）：k 由量子给，把暗能量撬到 inf ──
  //    ⚠️⚠️ **不在这里渲染**：本函数在 `!showContent` 时**提前 return**（见上），
  //      而量子共振恰恰是"打破无限之后才生效"的机制 ——
  //      那时量子页可能显示「已解锁 · 待推进」⇒ 量子共振整块**永远不刷新** ✗
  //      （用户裁定：「ui 确保在**购买门槛压平后**正确显示就行」⇒ 就是这条）
  //    ⇒ 已抽成 `renderSpanLayer(state)`，在 `render()` 里**无条件**调用 ✓

  // ⚠️ 2026 **已删除**：梦想点升级的渲染循环（原在这里）。
  //
  //   ── 为什么必须搬走（用户报：「梦想（自动化）**永恒前**梦想升级未正常工作」）──
  //     本函数开头有 `if (!showContent) return;`（`showContent = peakMatter ≥ 1e25`）
  //     ⇒ 梦想升级的价格 / 可购高亮 / `disabled` **永恒前一次都不刷新** ✗
  //     实测：传入 `dreamPoints=1000`、`peakMatter=1e10` 后卡片仍写「持有 3.00」
  //       （那是**上一份 state** 留下的陈旧文本）
  //     更糟的是「等级文字」早已搬到 `dream-ui.js`（不受门控）⇒ 出现
  //       "等级会变、价格不动"的诡异现象，玩家看起来像"买了没反应" ✗
  //
  //   ── 现在 ──
  //     全部收口到 `renderDreamPage(state)`（`dream-ui.js`），
  //     在 `render()` 里**无条件**调用 ⇒ 与页面进度/门控彻底解耦 ✓
  //     这里的 `dream-badge` 也一并搬走了（同一个理由：徽标不该只在量子层刷新）✗
  //
  //   ⚠️ 别再在 `renderQuantum` 里写任何 `dream-*` 元素 —— **双写**是本项目
  //      "显示 ≠ 实发" 反复重现的老根源 ✓
  //
  //   ⚠️ 量子共振也**不在这里**（同一类坑）：见 `renderSpanLayer`（`render()` 里无条件调用）✓
}

// ══════════════════════════════════════════════════════════
// 无限面板（金色）—— 独立标签页
// ══════════════════════════════════════════════════════════

export function renderSpanLayer(state) {
  if (!el["span-badge"]) return;
  const st = matterSpanStatus(state);
  el["span-badge"].textContent = st.capped ? "已失效（硬上限）"
    : st.on ? "已生效"
      : st.armed ? "已开启（待超过基准）"
        : "未开启";
  el["span-badge"].classList.toggle("on", st.on);
  if (el["span-k"]) el["span-k"].textContent = fmt(st.k, 4);
  if (el["span-mult"]) el["span-mult"].textContent = fmtMult(st.mult);
  if (el["span-base"]) {
    el["span-base"].textContent = st.base.gt(0) ? sci(st.base) : "—";
  }
  // ★ 新增：**当前暗能量 / 基准** —— 玩家唯一能判断"离生效还差多少"的地方 ✓
  if (el["span-de"]) {
    el["span-de"].textContent = st.base.gt(0)
      ? `${sci(state.darkEnergy)} / ${sci(st.base)}` +
        (st.overBase ? `（有效量超出 ${(st.effectiveLog10 - st.base.log10().toNumber()).toFixed(1)} 阶）` : "")
      : "—";
  }
  if (el["span-state"]) el["span-state"].textContent = st.reason;
}

/**
 * ★★★ 2025：**全页面悬浮重置窗**的状态刷新（用户要求）。
 *
 * ── 它做什么 ──
 *   把「无限 / 永恒」两个按钮的**可用态与副标题**跟游戏状态同步。
 *   后两个（时空 / 梦想）是**占位**，永远禁用 ⇒ 这里不碰它们 ✓
 *
 * ── ⚠️ 判定条件必须与页面上那个按钮**同源**（本项目最忌讳"显示 ≠ 实发"）──
 *   · 无限（大坍缩）：页面上 `btn-bigcrunch` 的 `disabled` 是 `!state.brokenInfinity`
 *     （未打破无限时由 `tick` 强制触发 ⇒ 手动按钮不给用）⇒ 这里**照抄那个条件** ✓
 *   · 永恒：页面上 `btn-eternity` 的 `disabled` 是 `!can`，而 `can = canEternity(state)`
 *     ⇒ 这里也调 `canEternity(state)`（唯一入口），**不自己比 IP** ✗
 */
