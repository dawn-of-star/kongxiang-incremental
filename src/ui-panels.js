/**
 * ui-panels.js —— 主面板各区块的渲染函数（从 560 行的 render() 里抽出）
 *
 * ★ 2026 模块化：每个函数只负责**一个区块**（资源条 / 升级中心 / 虚空 / 永恒 /
 *   坍缩里程碑 / ZPE 引擎 / 自动化状态 / ZPE 里程碑 / 暗能量 / 日志）。
 *   · `render()` 只保留 20 行左右的编排（顺序 = 画面刷新顺序）
 *   · 仍然只通过 `./ui-core.js` 拿 DOM 地基，不反向 import ui.js
 */

import { BASE, DE_MILESTONES, DE_UPGRADES, ETERNITY, MATTER_B_KMAX, MATTER_B_KNEE, PAGE_KEYS, REPEATABLE, TIER_MILESTONES, VOID_UPGRADES, ZPE_ENGINE, ZPE_MILESTONES, dreamUpgradeEffects, effectiveEngineLevel, engineBonusMult, eternityPointGain, markPageUnlocked, matterTotalExponent, pageUnlocked, qOf, quantumZpeMultBonus, tierMilestonesDone, zpeEngineAddBonus, zpeEngineCost, zpeEngineCountFreqUnlocked, zpeEngineLevel, zpeEngineMultBonus, zpeEngineProdMult, zpeEngineStepMult, zpeEngineUnlocked } from "./config.js";
import { affordableCount, lastMatterRatePerSecond, zpeEngineAffordable } from "./engine.js";
import { D, conversion, darkEnergyMultiplier, darkEnergyRate, deUpgradeCost, effectiveTraps, entropyRate, globalMultiplierParts, isAutoAcquire, particleRate, repeatableCost, trapCost, voidUpgradeCost, zpeBaseMultiplier, zpeMultiplier, zpeProductionPenalty, zpeRate } from "./formulas.js";
import { deLevelOf, levelOf } from "./state.js";
import { $, effectText, el, escapeHtml, fmt, fmtMult, fmtTime, sci } from "./ui-core.js";
import { renderEternityMilestones, renderEternityUpgrades } from "./ui-eternity.js";
import Decimal from "../dist/break_eternity.esm.js";

let lastLogSig = "";

/**
 * 界面物质速率：**直接显示引擎上一步实际发出的速率**（`lastMatterRate`）。
 * ⇒ 显示与实发是字面意义上的同一个数，不存在"预测下一步"的偏差。
 */
const displayMatterRate = () => lastMatterRatePerSecond();

export function renderPageUnlockSelfHeal(state) {
  // ══════════════════════════════════════════════════════════
  // ★★★ 2025（用户裁定 + 用户质问「为什么要我再永恒一次？bug 还是特性？」）
  //        ⇒ **是 bug**，不该让玩家多跑一轮。这里做**实时自愈**。
  // ══════════════════════════════════════════════════════════
  // 正确语义：「永恒过的档 ⇒ 永恒前的所有页面**永久解锁**」
  //   所以判据就是 `eternityCount > 0` —— **不需要**依赖"那一刻打点成功"。
  //
  // 原来只有两条路：① 载入兜底（`deserialize`）② 永恒那一刻打点（`doEternity`）
  //   ⇒ 若玩家**当前内存里**的记录是空的（旧档、或当初那一刻没打点）
  //     ⇒ 必须**再永恒一次**才补上 ⇒ 玩家看到的就是"页面被重置" ✗
  //   （用户原话：「已经永恒一次了不应该一直解锁么」—— 对 ✓）
  //
  // ⇒ 加第三条路：**渲染时按 `eternityCount > 0` 补齐**。
  //   `markPageUnlocked` 是**幂等**的（已为 true 时直接 return false）⇒ 每帧调也无副作用 ✓
  //   ⇒ 玩家**下一帧**就自愈，不用再永恒一次 ✓
  if ((state.eternityCount ?? 0) > 0) {
    for (const k of PAGE_KEYS) markPageUnlocked(state, k);
  }
}

export function renderResourceBars(state) {
  const R = state.resources;
  // ── 资源条 ──
  // ★ 熵是特例：**大数字放速率，小字放持有量**（HTML 里 id 也对调了）。
  //   熵凝聚斜率上去后（趋近 1 熵 = N 粒子），熵进来就被转走，
  //   持有量恒等于「不足一个阈值的余数」，**没有信息量**。
  el["rate-entropy"].textContent = `+${fmt(entropyRate(state))}/s`;
  el["val-entropy"].textContent = `余 ${fmt(R.entropy)}`;
  el["val-particle"].textContent = fmt(R.particle);
  el["val-matter"].textContent = fmt(R.matter);
  el["val-dream"].textContent = fmt(state.dreamPoints, 0);
  el["val-zpe"].textContent = fmt(state.zpe);
  el["val-de"].textContent = fmt(state.darkEnergy);

  el["rate-particle"].textContent = `+${fmt(particleRate(state))}/s`;
  el["rate-matter"].textContent = `+${fmt(displayMatterRate())}/s`;
  el["rate-zpe"].textContent = `+${fmt(zpeRate(state))}/s`;
  el["rate-de"].textContent = state.phaseTransmuterUnlocked
    ? `+${fmt(darkEnergyRate(state))}/s`
    : "未解锁";

  // ── 顶部「全局加成」槽 ──
  //   它显示的是**真·全局**那个乘积，以及它的三个因子 —— 每个因子按自己的乘区上色，
  //   这样玩家一眼能分清「计数频率（那个升级）」和「全局（乘积）」。
  {
    const parts = globalMultiplierParts(state);
    el["global-multiplier"].textContent = fmtMult(parts.total);
    // ★ 只改文本，不重建 DOM（每帧 innerHTML = 每帧重解析 + hover 状态被重置）
    el["gm-dream"].textContent = `梦想点 ×${fmt(parts.dream, 2)}`;
    el["gm-countfreq"].textContent = `计数频率 ×${fmt(parts.countFreq, 2)}`;
    el["gm-de"].textContent = `暗能量 ×${fmt(parts.de, 2)}`;
    // ★★★ 2025（NEKO.md §7）：好感度那一层**指数**也必须显示出来 ——
    //   否则 `dream × countFreq × de ≠ total`（三因子相乘**再取幂**）⇒ 显示自相矛盾 ✗
    if (el["gm-neko"] && parts.nekoExp !== 1) {
      el["gm-neko"].textContent = `好感度 ^${parts.nekoExp.toFixed(7)}`;
      el["gm-neko"].hidden = false;
    } else if (el["gm-neko"]) {
      el["gm-neko"].hidden = true;
    }
  }
}

export function renderClickAndUpgrades(state) {
  const R = state.resources;
  // ── 点击 ──
  let clickGain = new Decimal(BASE.clickGain);
  if (state.zpeMilestones.m1) clickGain = clickGain.add(10);
  if (state.voidUpgrades.v7) clickGain = clickGain.mul(5);
  el["click-gain"].textContent = `+${fmt(clickGain)} 熵 / 次`;

  // ── 三条可重复升级 ──
  const autoUpgrade = isAutoAcquire(state, "upgrade");
  let affordable = 0;
  for (const cfg of Object.values(REPEATABLE)) {
    const lv = levelOf(state, cfg.id);
    const cost = repeatableCost(state, cfg.id);
    const pool = R[cfg.currency];
    const can = pool.gte(cost);
    if (can && !autoUpgrade) affordable++;
    const btn = $(`btn-upg-${cfg.id}`);
    if (btn) {
      // ★ 自动获取模式下不能手动买（否则会绕过扣款白送等级）
      btn.classList.toggle("affordable", can && !autoUpgrade);
      btn.classList.toggle("maxed", autoUpgrade);
      btn.disabled = autoUpgrade;
      $(`upg-${cfg.id}-lv`).textContent = `Lv ${fmt(lv, 0)}`;
      // ★ 用 effectText 从公式推导，不要用 cfg.desc（会和实现脱节）
      $(`upg-${cfg.id}-desc`).textContent = effectText(state, cfg.id);
      const currencyName = { particle: "粒子", matter: "物质" }[cfg.currency] ?? cfg.currency;
      $(`upg-${cfg.id}-cost`).textContent = autoUpgrade
        ? "⚡ 自动获取中（免费）"
        : `花费 ${fmt(cost)} ${currencyName}`;
    }
    // 买满按钮：显示当前能买几个（闭式解，O(1)）
    const n = autoUpgrade ? 0 : affordableCount(state, cfg.id);
    const mx = $(`btn-max-${cfg.id}`);
    if (mx) {
      mx.disabled = n <= 0;
      mx.classList.toggle("can", n > 0);
      $(`max-${cfg.id}-n`).textContent = n > 0 ? String(n) : "0";
    }
  }
  el["upgrade-count"].textContent = autoUpgrade ? "自动获取中" : `${affordable} 项可购买`;

  // ── 熵阱 ──
  const tCost = trapCost(state);
  const trapAuto = state.voidUpgrades.v9 && state.zpeMilestones.m5;
  el["trap-lv"].textContent = `${fmt(R.traps, 0)} 个`;
  el["trap-badge"].textContent = fmt(R.traps, 0);
  el["trap-cost"].textContent = trapAuto
    ? `达到 ${fmt(tCost)} 物质时自动获取`
    : `花费 ${fmt(tCost)} 物质`;
  const trapBtn = el["btn-buy-trap"];
  trapBtn.classList.toggle("affordable", trapAuto ? R.matter.gte(tCost) : R.matter.gte(tCost));
  el["trap-effective"].textContent = fmt(effectiveTraps(state), 0);

  const cv = conversion(state);
  // ★ 阈值会被 m6（÷ZPE倍率）和 dm2（÷暗能量倍率）压下去。
  //   压到 1 以下时，「消耗 X 熵 → Y 粒子」这个说法就没意义了 ——
  //   应该反过来显示「1 熵 = N 粒子」。
  const convRate = cv.output.div(cv.threshold);
  el["entropy-rule"].textContent = convRate.gte(1)
    ? `1 熵 = ${fmt(convRate)} 粒子`
    : `消耗 ${fmt(cv.threshold)} 熵 → ${fmt(cv.output)} 粒子`;

  // ── 数值明细 ──
  el["d-entropy-rate"].textContent = fmt(entropyRate(state));
  el["d-particle-rate"].textContent = fmt(particleRate(state));
  el["d-matter-rate"].textContent = fmt(displayMatterRate());
  el["d-zpe-rate"].textContent = fmt(zpeRate(state));
  el["d-zpe-mult"].textContent = fmtMult(zpeMultiplier(state));
  el["d-zpe-prod"].textContent = fmtMult(zpeBaseMultiplier(state));
  el["d-de-mult"].textContent = fmtMult(darkEnergyMultiplier(state));
  const pen = zpeProductionPenalty(state);
  el["d-zpe-penalty"].textContent = pen.gte(1) ? "无" : `×${fmt(pen, 3)}`;
  el["d-clicks"].textContent = String(state.stats.clicks);
  el["d-playtime"].textContent = fmtTime(state.playTimeMs / 1000);
}

export function renderVoidPanel(state) {
  // ── 虚空升级 ──
  let voidOwned = 0;
  for (const cfg of Object.values(VOID_UPGRADES)) {
    const owned = state.voidUpgrades[cfg.id];
    if (owned) voidOwned++;
    const btn = $(`void-btn-${cfg.id}`);
    if (!btn) continue;
    const cost = voidUpgradeCost(state, cfg.id);
    // ★ 门槛（requireZpe）必须同时进"可购买判定"与"文案" ——
    //   踩过（第五例"显示 ≠ 实发"）：界面只看 `costDream`，于是把 v9「传承启迪」
    //   标成可购买、价格写"花费 1 梦想点"，**而引擎会因 `requireZpe: 1e8` 拒绝** ✗
    //   ⇒ 玩家看到能买却买不动，且不知道缺什么。
    const zpeGateOk = cfg.requireZpe == null || state.zpe.gte(cfg.requireZpe);
    const can = !owned && zpeGateOk &&
      (cfg.costDream ? state.dreamPoints.gte(cfg.costDream) : state.zpe.gte(cost));
    btn.classList.toggle("affordable", can);
    btn.classList.toggle("maxed", owned);
    $(`void-${cfg.id}-state`).textContent = owned ? "已购买 ✓" : "未购买";
    const priceText = cfg.costDream
      ? `花费 ${cfg.costDream} 梦想点`
      : `花费 ${fmt(cost)} ZPE`;
    // 门槛单独写出来（用「｜」分隔），而不是把它混进价格里 —— 价格与门槛是两回事
    const gateText = cfg.requireZpe == null ? "" : `｜需 ZPE ≥ ${fmt(cfg.requireZpe)}`;
    $(`void-${cfg.id}-cost`).textContent = owned
      ? "已生效"
      : priceText + gateText;
  }
  el["void-count"].textContent = String(voidOwned);
  // ★ 总数从 config 推导，不写死 9 —— 加第 10 个虚空升级时这里要跟着变
  el["tab-tag-void"].textContent = `${voidOwned}/${Object.keys(VOID_UPGRADES).length}`;
  el["zpe-multiplier"].textContent = fmtMult(zpeMultiplier(state));
}

export function renderEternityPanel(state) {
  // ── 永恒（**先占位**：只显示门槛与"本次可得"，还没有永恒动作）──
  {
    const goal = new Decimal(10).pow(ETERNITY.goalLog10);
    const can = state.infinityPoints.gte(goal);
    // ★★ 2025 补漏：永恒页**也**必须走「曾经解锁过」的永久记录 ——
    //   原来这里直接 `can ? "可永恒" : "锁"`，而 `can` 看的是**本轮 IP** ⇒
    //   永恒后 IP 归零，标签立刻变回"锁"，玩家以为自己丢了永恒页 ✗
    //   （用户实测反馈：「我的永恒页面也被重置了」—— 与量子/无限/暗能量同一个病，
    //     我上一轮只改了那三个，漏了这个 ✗）
    //   `perma` 的判据：跑过永恒（`eternityCount > 0`）**或**已有永久记录。
    //   第一次达成时下面会 `markPageUnlocked` 打点 ⇒ 此后永久为真 ✓
    const perma = pageUnlocked(state, "eternity") || (state.eternityCount ?? 0) > 0;
    // ★★★ 2025（用户裁定）：**锁定块已删除**，内容常显 ✓
    //   原来这里 `eternity-locked.hidden = can` ⇒ 每次永恒后 IP 归零就会
    //   看到整屏「永恒 · 本轮待推进 / 需要无限点 1.00e280 / 当前 0」（用户截图就是这个）✗
    //   ⇒ 现在只在内容区里用一行说明"本轮还差多少"，**永不遮挡** ✓
    if (el["eternity-hint"]) {
      el["eternity-hint"].hidden = can;
      if (!can) {
        el["eternity-hint"].textContent = perma
          ? `本轮待推进：无限点重新攒到 ${sci(Decimal.pow(10, ETERNITY.goalLog10))} 即可再永恒（永恒点与进度不丢）`
          : `尚未解锁：需要无限点达到 ${sci(Decimal.pow(10, ETERNITY.goalLog10))}`;
      }
    }
    if (el["eternity-need-inline"]) el["eternity-need-inline"].textContent = sci(Decimal.pow(10, ETERNITY.goalLog10));
    if (el["eternity-progress"]) {
      // ★ 2025：IP 数值统一 `sci` ✓
      el["eternity-progress"].textContent = can
        ? `（本轮已达成：当前 ${sci(state.infinityPoints)}）`
        : `（当前 ${sci(state.infinityPoints)}）`;
    }
    el["val-eternity"].textContent = fmt(state.eternityPoints, 0);
    el["eternity-gain"].textContent = fmt(eternityPointGain(state.infinityPoints), 0);
    el["eternity-count"].textContent = String(state.eternityCount ?? 0);
    // 标签：解锁过就**永不加锁**（与量子/无限/暗能量同一套语义）
    el["tab-tag-eternity"].textContent = can ? "可永恒" : (perma ? "待推进" : "锁");
    el["tab-eternity"].classList.toggle("locked", !(perma || can));
    if (perma || can) markPageUnlocked(state, "eternity");   // 幂等打点
    // ★ 永恒按钮：到无限点 1e308.25 才可用（= `ETERNITY.goalLog10`），且**手动**触发
    const be = el["btn-eternity"];
    be.disabled = !can;
    be.classList.toggle("affordable", can);
    // ★ 2025：原来是**写死的**门槛文案 ⇒ 从 `ETERNITY.goalLog10` 推出来 ✓
    //   （写死的话，哪天改了门槛这句就会说谎 —— 正是本项目反复出现的"显示 ≠ 实发"
    //     ⚠️ 2026 它真的说谎过一次：门槛曾被写成 280，而这里的文案推算出来是 1e308.25，
    //        两处不一致 ⇒ 已统一到 308.25 ✓）
    el["eternity-status"].textContent = can
      ? "可永恒"
      : `需要 ${sci(Decimal.pow(10, ETERNITY.goalLog10))} 无限点`;
  }
}

export function renderTierMilestones(state) {
  // ── 坍缩里程碑（铸币已删 ⇒ 只剩 rate / lube 两类）──
  {
    // ★ 坍缩里程碑：与虚空/暗能量里程碑**同一套状态**（done / next），只切 class
    {
      const done = new Set(tierMilestonesDone(state).map((m) => m.id));
      let nextFound = false;
      for (const m of TIER_MILESTONES) {
        const node = document.getElementById("tms-" + m.id);
        if (!node) continue;
        const isDone = done.has(m.id);
        const isNext = !isDone && !nextFound;
        if (isNext) nextFound = true;
        node.classList.toggle("done", isDone);
        node.classList.toggle("next", isNext);
        const need = document.getElementById("tms-" + m.id + "-need");
        if (need) need.textContent = isDone ? "已达成" : m.at + " 次大坍缩";
      }
      el["tier-ms-badge"].textContent = done.size + " / " + TIER_MILESTONES.length;
      // ★ 2025：永恒里程碑（同一套 done/next 约定；额外有 pending 态）
      renderEternityMilestones(state);
      // ★★★ 2025：永恒升级「永恒增幅」（设计稿 33~35 行）
      renderEternityUpgrades(state);
    }

  }
}

export function renderZpeEnginePanel(state) {
  // ── ZPE 引擎（虚空科技的第二个子页）──
  {
    const unlocked = zpeEngineUnlocked(state);
    el["zpe-engine-locked"].hidden = unlocked;
    el["zpe-engine-content"].hidden = !unlocked;
    // ★ 2025：解锁条件改为「1 次大坍缩」并送 1 级（里程碑奖励，不再花无限点）
    el["zpe-engine-unlock-cost"].textContent = state.bigCrunchCount?.gte(1) ? "条件已满足" : "1 次大坍缩";
    const btnUnlock = el["btn-unlock-zpe-engine"];
    const canUnlock = !unlocked && (state.bigCrunchCount ?? D(0)).gte(1);   // ★ 2025：解锁条件已改成「1 次大坍缩」（不再花无限点 ✗）
    btnUnlock.classList.toggle("affordable", canUnlock);
    btnUnlock.disabled = unlocked;
    btnUnlock.textContent = unlocked ? "已解锁 ✓" : "解锁（1 次大坍缩，送 1 级）";

    // ★★★ 2026（用户：「显示==实发又出问题了」）—— 引擎的实际有效等级是 `effectiveEngineLevel()`（含七巧板加成）✓
  //   原来这里显示的是 `zpeEngineLevel`（**裸等级**）⇒ 显示 ≠ 实发 ✗
  const lv = effectiveEngineLevel(state);   // 唯一入口 ✓
    const prod = zpeEngineProdMult(state);
    const addBonus = zpeEngineAddBonus(state);
    const multBonus = zpeEngineMultBonus(state);
    // ★ 2025：量子项的显示**必须含引擎账**（否则与 `zpeMultiplier` 的实发不符 ✗）
    const qTerm = quantumZpeMultBonus(qOf(state), engineBonusMult(state));
    el["zpe-engine-level"].textContent = lv.gte(1e6) ? `10^${lv.log10().toNumber().toFixed(2)}` : fmt(lv, 0);
    el["zpe-engine-prod"].textContent = fmtMult(prod);
    // ★ 2025：这一格从"公式指数"改成"加法区加成"（设计稿第 1 条 ✓）
    el["zpe-engine-exp"].textContent = fmtMult(addBonus.max(1));
    // ★ 2025：IP 数值/花费统一 `sci`（原来 `fmt(·,0)` 会给 `1e308`）✓
    el["zpe-engine-ip"].textContent = sci(state.infinityPoints);

    const can = zpeEngineAffordable(state);
    const cost = zpeEngineCost(state);
    el["zpe-engine-afford"].textContent = can > 0 ? `可买 ${can} 级` : "买不起";
    // ★★★ 2025/2026 UI 同步（「2000 级后价格增幅」必须说清，否则玩家以为卡死了）：
    //   ⚠️ 语义已定稿（用户第 3 次纠正：「不应该是当前价格基础上再 ×1e5 么？」）：
    //     **2000 级起每一级都在当前价格上再 ×1e5**（逐级连乘）——
    //     不是"只在 2000 级跃变一次" ✗（那是我的旧版，用户看到的就是"没生效"）
    //   ⇒ 面板显示"**每级 ×多少**"（`zpeEngineStepMult` 是唯一入口，UI 不自己算公式 ✓）
    //   实测：lv<2000 ⇒ ×1.87｜**lv≥2000 ⇒ ×1.8725e5（每级都如此，累计每级 +5.27 个数量级）**
    const stepMult = Number(ZPE_ENGINE.costGrowth) * zpeEngineStepMult(lv.toNumber()).toNumber();
    const steepStart = ZPE_ENGINE.steepAfter?.level ?? 2000;
    const steepMult = ZPE_ENGINE.steepAfter?.mult ?? 1e9;
    const stepTxt = stepMult >= 1e4
      ? `**每级 ×${stepMult.toExponential(4)}**（${steepStart} 级起每级另 ×${steepMult.toExponential(0)}，逐级连乘）`
      : `每级 ×${stepMult.toFixed(4)}`;
    el["zpe-engine-cost"].textContent = `花费 ${sci(cost)} 无限点｜${stepTxt}`;
    const btnBuy = el["btn-buy-zpe-engine"];
    btnBuy.classList.toggle("affordable", state.infinityPoints.gte(cost));
    // 下一级的产出倍率：用一个"等级 +1"的浅拷贝算，避免手写预测公式
    const nextProd = zpeEngineProdMult({ ...state, zpeEngineLevel: lv.add(1) });
    el["zpe-engine-buy-desc"].textContent =
      `ZPE 产出 ${fmtMult(prod)} → ${fmtMult(nextProd)}`;

    // ★ 引擎机制（**4 条**）：只更新文本与 class，绝不重建 DOM。
    //   踩过的坑：这里原来是每帧 `innerHTML = …` —— 每帧重建会重置 `:hover`
    //   与 CSS 过渡，玩家鼠标一挪上去就**频繁闪烁**（用户实测报的 bug）。
    //   所以卡片在 `buildZpeMechanisms()` 里建一次，这里只改两个文本 + 一个 class。
    const mech = [
      {
        on: unlocked,
        now: `当前 ZPE 倍率 +${fmt(addBonus)}（加法区）` },
      {
        on: unlocked,
        now: `产出 ${fmtMult(prod)}｜倍率 ${fmtMult(multBonus)}` },
      {
        on: zpeEngineCountFreqUnlocked(state),
        now: zpeEngineCountFreqUnlocked(state)
          ? `计数频率已生效｜量子项 +${fmt(qTerm)}（q³/10）`
          : `量子项 +${fmt(qTerm)}（q³/10）｜计数频率等级 ${ZPE_ENGINE.countFreqLevel} 解锁` },
      {
        // ★ 设计稿第 4 条（之前漏列 ✗）：暗能量倍率 ×2^等级
        on: unlocked,
        now: `暗能量倍率 ×${fmtMult(multBonus)}（= 2^等级）` },
      {
        // ★ 2026 语义修正：第 5 条是**物质系数**的局部幂，不是正式 b区
        //   （取幂的是 matterCoeff，不是资源整体；见 docs/BONUS-POSITIONS.md）
        on: matterTotalExponent(state) > 1 + 1e-9,
        now: matterTotalExponent(state) > 1 + 1e-9
          ? `物质系数 = { 前四条 } ^ ${matterTotalExponent(state).toFixed(3)}（局部幂：主要提高高度，不改长期斜率）`
          : `k = 1（引擎等级 0 ⇒ 不生效）｜${MATTER_B_KNEE} 级饱和到 k = ${(1 + MATTER_B_KMAX).toFixed(0)}` },
    ];
    mech.forEach((m, i) => {
      const card = $(`zpe-mech-${i}`);
      if (!card) return;
      card.classList.toggle("affordable", m.on);
      const st = $(`zpe-mech-${i}-state`);
      if (st) st.textContent = m.on ? "已生效" : "未生效";
      const now = $(`zpe-mech-${i}-now`);
      if (now) now.textContent = m.now;
    });
  }
}

export function renderAutomationStatus(state) {
  // ══════════════════════════════════════════════════════════
  // ★★★ 2025：**自动化状态**（设计稿第 24 行）
  // ══════════════════════════════════════════════════════════
  // ⚠️ 位置：**主控台 → 梦想（自动化）子页**（用户裁定子页归属）
  //   ⇒ 从 ZPE 渲染块里**搬出来**、变成无条件刷新（它是独立面板，不随 ZPE 页显隐）✓
  // 用户原则：「**没有 ui 真的很容易误判**」—— 这批自动化早就实现了
  //   （`isAutoAcquire` 管升级/熵阱、梦想升级 `autoBuyDe` 管 5 条暗能量升级），
  //   但页面上**一处都不显示** ⇒ 看不出它在跑 ✗
  // ⚠️ 判据全部**调真函数**（`isAutoAcquire` / `dreamUpgradeEffects`），不在这里重写条件 ✓
  {
    const acqUp = isAutoAcquire(state, "upgrade");
    const acqTrap = isAutoAcquire(state, "trap");
    const v9 = !!state.voidUpgrades?.v9;
    if (el["auto-acquire"]) {
      el["auto-acquire"].textContent = acqUp || acqTrap
        ? `已开启（升级${acqUp ? "✓" : "✗"} / 熵阱${acqTrap ? "✓" : "✗"}）`
        : v9 ? "v9 已买，但门槛未满足" : "未开启（需虚空升级 v9）";
    }
    if (el["auto-de"]) {
      const ids = dreamUpgradeEffects(state).autoBuyDe ?? [];
      el["auto-de"].textContent = ids.length
        ? `已开启 ${ids.length} 条：${ids.join(" / ")}`
        : `未开启（需梦想升级，共 4 条）`;
    }
  }
  // 梦想子页的徽标：有自动化在跑就标"部分实装"，否则"壳子" ✓
  if (el["dream-page-badge"]) {
    const anyAuto = isAutoAcquire(state, "upgrade") || isAutoAcquire(state, "trap")
      || (dreamUpgradeEffects(state).autoBuyDe ?? []).length > 0;
    el["dream-page-badge"].textContent = anyAuto ? "自动化部分实装" : "壳子";
  }
}

export function renderZpeMilestonesPanel(state) {
  // ── ZPE 里程碑 ──
  let nextFound = false;
  for (const m of ZPE_MILESTONES) {
    const d = $(`ms-${m.id}`);
    if (!d) continue;
    const done = state.zpeMilestones[m.id];
    const isNext = !done && !nextFound;
    if (isNext) nextFound = true;
    d.classList.toggle("done", done);
    d.classList.toggle("next", isNext);
    const needEl = $(`ms-${m.id}-need`);
    if (needEl) {
      needEl.textContent = done
        ? "已达成 ✓"
        : `${fmt(state.zpeTotal)} / ${fmt(new Decimal(m.need), 0)} ZPE`;
    }
  }
}

export function renderDarkEnergyPanel(state) {
  const R = state.resources;
  const pen = zpeProductionPenalty(state);
  // ★★ 2025（用户裁定）：暗能量是靠**按钮**启动的（不是自动判定）——
  //   所以"保持解锁"的正确做法是：**标签永不上锁**（解锁过就一直可点进去），
  //   里面照旧显示"启动相变仪"的按钮与本轮条件（条件已随虚空升级清零 ⇒ 需重新满足）。
  //   原来标签在 `phaseTransmuterUnlocked === false` 时直接上锁 ⇒ 永恒后点不进去 ✗
  const perma = pageUnlocked(state, "de");
  const unlocked = state.phaseTransmuterUnlocked === true;
  el["tab-tag-de"].textContent = unlocked ? fmt(state.darkEnergy) : (perma ? "待推进" : "锁");
  el["tab-de"].classList.toggle("locked", !(perma || unlocked));
  el["de-locked"].hidden = unlocked;
  el["de-content"].hidden = !unlocked;

  if (!unlocked) {
    if (el["de-perma-hint"]) el["de-perma-hint"].hidden = !perma;
    if (el["de-locked-title"]) el["de-locked-title"].textContent = perma ? "相变仪 · 本轮待重启" : "相变仪未解锁";
    const g = DE_MILESTONES.find((m) => m.id === "dm0")?.gate;
    if (g) {
      const hasVoidOk = !g.voidUpgrade || state.voidUpgrades[g.voidUpgrade];
      const matterOk = !g.matter || R.matter.gte(g.matter);
      el["de-unlock-cond"].innerHTML =
        `<div class="${hasVoidOk ? "ok" : "no"}">${hasVoidOk ? "✓" : "✗"} 已购买「虚空永恒 v8」</div>` +
        `<div class="${matterOk ? "ok" : "no"}">${matterOk ? "✓" : "✗"} 物质 ≥ ${fmt(new Decimal(g.matter), 0)}（当前 ${fmt(R.matter)}）</div>`;
    }
    el["btn-unlock-transmuter"].hidden = false;
    const g2 = DE_MILESTONES.find((m) => m.id === "dm0")?.gate;
    const ready = g2 && (!g2.voidUpgrade || state.voidUpgrades[g2.voidUpgrade]) && R.matter.gte(g2.matter);
    const ub = el["btn-unlock-transmuter"];
    ub.classList.toggle("affordable", !!ready);
    ub.disabled = !ready;
    ub.textContent = ready ? "启动相变仪（已就绪）" : "启动相变仪（条件未满足）";
  } else {
    el["de-multiplier"].textContent = fmtMult(darkEnergyMultiplier(state));
    el["de-penalty"].textContent = pen.gte(1) ? "无" : `×${fmt(pen, 3)}`;

    // ── 相变环：ZPE → 暗能量 的转换进度 ──
    //    和原稿那个百分比条同一个用途：让玩家知道「现在没事干」是正常的。
    const th = new Decimal(BASE.darkEnergyThreshold);
    const acc = state.deAccum ?? new Decimal(0);
    const pct = Math.max(0, Math.min(1, acc.div(th).toNumber()));
    // 下一次转换要多久：还差多少 ZPE / ZPE 产出速率
    const zr = zpeRate(state);
    const eta = zr.gt(0) ? th.sub(acc).div(zr).toNumber() : Infinity;
    // 一轮 < 0.5 秒时填充环看不出变化 -> 切成高光旋转
    const instant = !Number.isFinite(eta) || eta < 0.5;

    el["de-ring-wrap"].classList.toggle("instant", instant);
    el["de-ring-pct"].textContent = instant ? "⟳" : `${(pct * 100).toFixed(0)}%`;
    // ★ 不再显示「下一次转换需要 1e8 ZPE」——
    //   实际转换是**连续**的（zpeRate/1e8），根本不存在「下一次」，
    //   而且在持续转换模式下那句话还和左边的环自相矛盾。改成显示速率。
    el["de-ring-rate"].textContent = `${fmt(zr.div(BASE.darkEnergyThreshold), 3)} 次/秒`;
    el["de-ring-de"].textContent = `${fmt(darkEnergyRate(state), 3)} /秒`;

    const dfill = el["de-ring-fill"];
    if (instant) {
      dfill.style.strokeDashoffset = "";   // 交给 CSS 动画，别用行内样式压住它
    } else {
      dfill.style.strokeDashoffset = String(263.9 * (1 - pct));
    }

    for (const cfg of Object.values(DE_UPGRADES)) {
      const lv = deLevelOf(state, cfg.id);
      const maxed = cfg.maxLevel != null && lv.gte(cfg.maxLevel);
      const c = deUpgradeCost(state, cfg.id);
      let can = !maxed;
      if (can && c.dream) can = state.dreamPoints.gte(c.dream);
      if (can && c.matter) can = R.matter.gte(c.matter);
      if (can && c.particle) can = R.particle.gte(c.particle);
      if (can && c.zpe) can = state.zpe.gte(c.zpe);
      if (can && c.darkEnergy) can = state.darkEnergy.gte(c.darkEnergy);   // ★ 新增
      const btn = $(`de-btn-${cfg.id}`);
      if (!btn) continue;
      btn.classList.toggle("affordable", can);
      btn.classList.toggle("maxed", maxed);
      $(`de-${cfg.id}-lv`).textContent = maxed ? `Lv ${fmt(lv, 0)} (满级)` : `Lv ${fmt(lv, 0)}`;
      // ★ 把 state 也传进去：有些描述必须按实际状态算（例如凝聚斜率要看 v5 买没买）
      $(`de-${cfg.id}-desc`).textContent = cfg.desc(lv, state);
      const parts = [];
      if (c.dream) parts.push(`${fmt(c.dream, 0)} 梦想点`);
      if (c.matter) parts.push(`${fmt(c.matter)} 物质`);
      if (c.particle) parts.push(`${fmt(c.particle)} 粒子`);
      if (c.zpe) parts.push(`${fmt(c.zpe)} ZPE`);
      // ★ 新增：暗能量计价的升级。
      //   最初漏了这一行 —— 两个新升级在界面上显示「花费 」后面空白，
      //   因为 parts 是空的、join 出来就是空字符串。截图抓到的就是这个。
      if (c.darkEnergy) parts.push(`${fmt(c.darkEnergy)} 暗能量`);
      $(`de-${cfg.id}-cost`).textContent = maxed ? "已满级" : `花费 ${parts.join(" + ")}`;
    }

    for (const m of DE_MILESTONES) {
      const d = $(`dms-${m.id}`);
      if (!d) continue;
      const done = state.deMilestones[m.id];
      const firstUndone = DE_MILESTONES.find((x) => !state.deMilestones[x.id]);
      d.classList.toggle("done", done);
      d.classList.toggle("next", !done && firstUndone?.id === m.id);
      const needEl = $(`dms-${m.id}-need`);
      if (needEl) {
        needEl.textContent = done
          ? "已达成 ✓"
          : m.gate
            ? "v8 + 1e8 物质"
            : `${fmt(state.darkEnergyTotal)} / ${fmt(new Decimal(m.need), 0)}`;
      }
    }
  }
}

export function renderLogPanel(state) {
  // ── 日志 ──
  //
  // ⚠️ 判据不能只看**条数**（原来就是 `childElementCount !== state.log.length`）。
  //    state.log 有 LOG_MAX = 60 的上限，一旦写满，长度永远是 60、
  //    DOM 里也永远有 60 个子元素 —— 两边相等，于是**日志面板从此再也不刷新**，
  //    玩家看到的是冻结的旧消息（实测：第 61 条之后一条都进不去）。
  //    正确判据是「最近一条」的身份：长度 + 时间戳 + 文本。
  const logEl = el["log-panel"];
  const lastLog = state.log[state.log.length - 1];
  const logSig = `${state.log.length}|${lastLog ? lastLog.t : 0}|${lastLog ? lastLog.text : ""}`;
  if (logSig !== lastLogSig) {
    lastLogSig = logSig;
    logEl.innerHTML = state.log
      .map((e) => {
        const t = new Date(e.t);
        const hh = String(t.getHours()).padStart(2, "0");
        const mm = String(t.getMinutes()).padStart(2, "0");
        const ss = String(t.getSeconds()).padStart(2, "0");
        return `<div class="le"><span class="lt">${hh}:${mm}:${ss}</span>${escapeHtml(e.text)}</div>`;
      })
      .join("");
    logEl.scrollTop = logEl.scrollHeight;
  }
}
