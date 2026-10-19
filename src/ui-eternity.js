/**
 * ui-eternity.js —— 永恒面板的渲染（永恒升级 + 8 条里程碑）
 *
 * ★ 2026 模块化：从 ui.js 抽出的**独立面板渲染器**。
 *   · DOM 缓存/去重/格式化一律来自 `./ui-core.js`（本文件不定义地基）
 *   · 只被 `ui.js` 的 render() 调用（单向依赖）
 */

import { ETERNITY_MILESTONES, ETERNITY_UPGRADES, em2BonusMult, em5IpMult, epMultAffordableIn, epMultFactor, epMultPriceAt, hasEternityMilestone } from "./config.js";
import { D } from "./formulas.js";
import { $, el, fmt } from "./ui-core.js";

export function renderEternityUpgrades(state) {
  const lv = Math.max(0, Number(state.epMultLevel ?? 0) || 0);
  const f = epMultFactor(state);
  const price = epMultPriceAt(lv);
  const ep = state.eternityPoints ?? D(0);
  const can = ep.gte(price);
  const nextF = f.mul(ETERNITY_UPGRADES.epMult.effectMult);

  if (el["eternity-upg-epMult-lv"]) el["eternity-upg-epMult-lv"].textContent = `Lv ${lv}`;
  if (el["eternity-upg-epMult-desc"]) {
    el["eternity-upg-epMult-desc"].textContent = lv > 0
      ? `最终获得的永恒点 ×${fmt(f, 0)}（下一级 ×${fmt(nextF, 0)}）`
      : ETERNITY_UPGRADES.epMult.desc;
  }
  if (el["eternity-upg-epMult-cost"]) {
    el["eternity-upg-epMult-cost"].textContent = `花费 ${fmt(price, 0)} 永恒点`;
  }
  if (el["max-eternity-upg-epMult-n"]) {
    el["max-eternity-upg-epMult-n"].textContent = fmt(epMultAffordableIn(lv, ep), 0);
  }
  const b = el["btn-eternity-upg-epMult"];
  if (b) {
    b.classList.toggle("affordable", can);
    b.disabled = !can;
  }
  const bm = el["btn-max-eternity-upg-epMult"];
  if (bm) bm.disabled = !(epMultAffordableIn(lv, ep) > 0);
}

/**
 * ★★★ 2026（用户 2026 重写的规则）：**暗物质面板**（暗能量的第二个子页）。
 *
 * 守「显示 == 实发」：**每一项都调 `config.js` 的唯一入口**，UI 自己不算任何数：
 *   `darkMatterCount` / `darkMatterPriceAt` / `darkMatterAffordableIn` /
 *   `secondTransmuterSpeed` / `darkMatterTargetMult` / `darkMatterEffectMult` / `darkMatterAdditiveTerm`
 *   （本项目在"显示 ≠ 实发"上栽过 4 次，所以这条是硬纪律 ✓）
 *
 * ⚠️ 它必须**无条件刷新**：解锁判据是 `eternityCount >= 4`（em4），
 *   而 `renderDe` 那段会因"相变仪本轮未解锁"提前 return ⇒ 放进去就会被跳过 ✗
 *   （与 `renderSpanLayer` 同一个坑，见那边的说明）
 */
export function renderEternityMilestones(state) {
  const box = el["eternity-milestone-list"];
  if (!box) return;
  let doneCount = 0;
  let nextFound = false;
  for (const m of ETERNITY_MILESTONES) {
    const node = document.getElementById(`ems-${m.id}`);
    if (!node) continue;
    const reached = hasEternityMilestone(state, m.id);
    if (reached) doneCount++;
    const isNext = !reached && !nextFound;
    if (isNext) nextFound = true;
    node.classList.toggle("done", reached);
    node.classList.toggle("next", isNext);
    // `pending` 的条目**即使达成也标成待实装**（避免"拿到了却没效果"的误解）
    node.classList.toggle("pending", m.pending === true);
    const need = document.getElementById(`ems-${m.id}-need`);
    if (need) {
      if (m.pending) need.textContent = reached ? `已达成 · 待实装` : `第 ${m.need} 次永恒 · 待实装`;
      else if (m.id === "em5" && reached) need.textContent = `已达成 · 当前 ×${fmt(em5IpMult(state), 2)}`;
      // ★★★ 2025：em2 已实装 ⇒ 显示**当前加成倍数**（与 em5 同一套做法）✓
      //   ⚠️ 倍率走唯一入口 `em2BonusMult`，UI 不许自己判 `eternityCount >= 2` ✗
      else if (m.id === "em2" && reached) need.textContent = `已达成 · 加成 ×${fmt(em2BonusMult(state), 0)}`;
      else need.textContent = reached ? "已达成" : `第 ${m.need} 次永恒`;
    }
    // ⚠️ pending **不再是 true** 的条目要把旧 title 清掉 ——
    //   否则 em2 会**一直挂着**"等 neko 上线"的过期解释 ✗（它现在已实装）
    if (m.pending) { if (node.title !== (m.pendingWhy ?? "")) node.title = m.pendingWhy ?? ""; }
    else if (node.title) node.title = "";
  }
  if (el["eternity-ms-badge"]) el["eternity-ms-badge"].textContent = `${doneCount} / ${ETERNITY_MILESTONES.length}`;
}

/** 虚空科技的父标签 / 子页映射（子页激活时父标签也要亮着） */
