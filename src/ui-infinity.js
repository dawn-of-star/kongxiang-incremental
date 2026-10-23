import { rewardIpDoubleKneeMult } from "./tangram-reward.js";   // ★ 2026：knee 奖励（显示=实发 ✓）
/**
 * ui-infinity.js —— 无限面板：大坍缩 / ∞ 升级 / 悬浮重置窗
 *
 * ★ 2026 模块化：从 ui.js 抽出的**独立面板渲染器**。
 *   · DOM 缓存/去重/格式化一律来自 `./ui-core.js`（本文件不定义地基）
 *   · 只被 `ui.js` 的 render() 调用（单向依赖）
 */

import { BREAK_INFINITY, CRUNCH_AT_LABEL, ETERNITY, INFINITY_ORDER, INFINITY_UPGRADES, OVERLOAD, canEternity, crunchThreshold, infinityUpgradeCost, infinityUpgradeOwned, ipDoubleAffordableIn, ipDoubleMult, overloadThreshold, pageUnlocked } from "./config.js";
import { infinityUpgradeEffect } from "./engine.js";
import { D, bigCrunchGain, canBigCrunch, matterRate, overloadFactor } from "./formulas.js";
import { $, el, fmt, fmtMult, fmtTime, sci } from "./ui-core.js";
import Decimal from "../dist/break_eternity.esm.js";

export function renderInfinity(state) {
  const cap = crunchThreshold();
  // ★★ 2025（用户裁定）：`perma` = 曾经解锁过（**永不重置**）⇒ 标签**不再上锁**；
  //   `live` = 本轮已经摸到物质硬顶或坍缩过 ⇒ 才显示内容。
  //   原来只判本轮条件 ⇒ 永恒把 `peakMatter` / `bigCrunchCount` 清零后整页重新上锁 ✗
  const perma = pageUnlocked(state, "infinity");
  const live = state.peakMatter.gte(cap) || state.bigCrunchCount.gt(0);

  // ★★★ 2025（用户裁定）：「**包括无限对应的锁定页面删了**」⇒ 内容常显 ✓
  //   同量子页：`hidden` 只留给**本页内**的提示条（不会被 `activateTab` 覆盖）✓
  // ⚠️ 原来这里写 `el["inf-need"]` —— 那个元素住在**锁定块**里，
  //   而锁定块已按用户裁定删除 ⇒ 现在把硬顶写进行内那格（它本来就是显示硬顶的地方）✓
  //   与 `"bigcrunch-need"` 同源 = `CRUNCH_AT_LABEL`（**不手写** ✗）
  if (el["bigcrunch-need"]) el["bigcrunch-need"].textContent = CRUNCH_AT_LABEL;
  if (el["inf-progress"]) {
    el["inf-progress"].textContent = live
      ? `（本轮已达成：当前物质 ${sci(state.resources.matter)}）`
      : perma
        ? `（本轮待推进：重新推进到硬顶即可继续 —— 已解锁过，进度不丢）`
        : `（尚未达到：当前 ${sci(state.resources.matter)}）`;
  }
  if (el["inf-hint"]) {
    el["inf-hint"].hidden = live;
    if (!live) {
      el["inf-hint"].textContent = perma
        ? "已解锁过：本轮重新推进到物质硬顶即可继续使用（进度不丢）"
        : "尚未解锁：需要基础物质达到物质硬顶（见上）";
    }
  }

  const tab = el["tab-tag-infinity"];
  // ★ 2025：标签页上的 IP 也用 `sci`（用户裁定统一格式 = `1.00e308`）✓
  tab.textContent = live ? sci(state.infinityPoints) : (perma ? "待推进" : "锁");
  el["tab-infinity"].classList.toggle("locked", !(perma || live));

  if (!live) return;

  // ★ 2025：无限点数值统一走 `sci`（原来 `fmt(·, 0)` 会显示成 `1e308`）✓
  el["val-infinity"].textContent = sci(state.infinityPoints);
  el["bigcrunch-count"].textContent = fmt(state.bigCrunchCount, 0);   // ★ 数值约定 #3：不在显示层 toNumber（会 ∞ ✗）
  el["bigcrunch-gain"].textContent = sci(bigCrunchGain(state));

  const broken = state.brokenInfinity;
  // ★★ 2025（用户裁定）：**过载按「物质获得速率」触发，不再按物质数量** ——
  //   阈值 = `Number.MAX_VALUE = 1.8e308`（双精度上限，卡的是"每秒获得多少"）。
  //   ⇒ 界面必须显示**速率**口径（原来显示"距拐点 N 阶"= 数量口径，已过时 ✗）
  const ovT = overloadThreshold(state);          // 仍用于"打破无限后的数量门槛"显示
  const preRate = matterRate(state);             // 未削减的获得速率（唯一入口）
  const ov = overloadFactor(state, preRate);
  el["bigcrunch-need"].textContent = broken
    // ★ 2025 统一科学计数法（原 `1e${ovT}` 有歧义：看着像 e 后跟小数）
    ? sci(Decimal.pow(10, ovT.toNumber()))
    : CRUNCH_AT_LABEL;
  if (!broken) {
    el["overload-state"].textContent = "硬顶（未打破）";
  } else if (ov.gte(1)) {
    // 距触发还差几个数量级（**对数域**算，避免 1e1943 溢出成 Infinity ✗）
    const gap = OVERLOAD.rateThresholdLog10.toNumber() - preRate.log10().toNumber();
    el["overload-state"].textContent = `无（速率距 1.8e308 还差 ${gap.toFixed(1)} 阶）`;
  } else {
    const over = preRate.log10().toNumber() - OVERLOAD.rateThresholdLog10.toNumber();
    el["overload-state"].textContent = `×${fmt(ov, 3)}（速率超 1.8e308 已 ${over.toFixed(1)} 阶）`;
  }

  const canCrunch = broken && canBigCrunch(state);
  const bb = el["btn-bigcrunch"];
  bb.disabled = !canCrunch;
  bb.classList.toggle("affordable", canCrunch);
  el["bigcrunch-status"].textContent = !broken
    ? "到顶强制触发"
    : canCrunch ? "可以坍缩" : "物质不足";
  el["bigcrunch-desc"].textContent = broken
    ? `手动触发。跑得越深收益越高；获得速率超过 1.8e308 后进入**过载**，速率按 1/(1+超出/${OVERLOAD.knee}) 渐近削弱`
    : "物质到 1e308.25 会强制大坍缩（收益固定）";

  const bk = el["btn-break-infinity"];
  const showBreak = !broken && state.infinityPoints.gte(BREAK_INFINITY.unlockCost);
  bk.hidden = !showBreak;
  if (showBreak) {
    bk.classList.add("affordable");
    el["break-state"].textContent = `花 ${BREAK_INFINITY.unlockCost} 无限点`;
  }

  // 大坍缩就绪时给标签一个提示
  el["tab-infinity"].classList.toggle("alert", canCrunch);

  renderInfinityUpgrades(state);
}

/**
 * ∞ 层：无限升级的渲染。
 *
 * ⚠️ 价格走 `infinityUpgradeCost()`、效果从公式推导 —— 界面不许自己算一遍
 *    （consistency.mjs 的硬要求）。
 */
export function renderInfinityUpgrades(state) {
  const ip = state.infinityPoints;
  let owned = 0;
  for (const id of INFINITY_ORDER) {
    const cfg = INFINITY_UPGRADES[id];
    const btn = $(`inf-btn-${id}`);

    // ★★★ 2025 修复（用户报告：「ip点倍增初始×1，购买一次后应该 ×2，但我看着还是 ×1」）：
    //   `ipDouble`（① 无限增幅）**被移到了置顶的静态壳**，它的 id 是 `inf-ipdouble-row`
    //   （小写 d！）而不是 `inf-btn-ipDouble` ⇒ 本循环的 `$(\`inf-btn-${id}\`)` 取不到
    //   ⇒ `if (!btn) continue` **每帧把它跳过** ⇒ 那一行的
    //      `inf-ipDouble-state`（"Lv N"）/ `inf-ipDouble-cost`（价格）/ `max-ipDouble-n`
    //      **从来没被更新过**，永远停在 index.html 的静态初值 "Lv 0" / "—" / "0" ✗
    //   （实发侧 `ipDoubleMult()` 一直是对的 ⇒ 这是纯"显示 ≠ 实发"的显示侧 bug）
    //   ⇒ 单独在这里渲染它，然后 continue（它没有走通用分支的那些元素）✓
    if (id === "ipDouble") {
      const lvIpD = state.ipDoubleLevel ?? D(0);
      const effIpD = infinityUpgradeEffect(state, id);       // ★ 与实发同源（唯一入口）
      const costIpD = infinityUpgradeCost(state, id);
      // ★★★ 2025（用户裁定）：**删掉"需先打破无限"这个门槛**。
      //   用户原话：「无限增幅开局买不了？我们无限一次的时间这么长，开局还买不到重要的升级不扯淡么？
      //             移除购买无限增幅需要打破无限这个要求。因为打破无限本身也需要 128 个无限点」
      //   ⇒ 合理：**IP 的第一个来源就是大坍缩**，而打破无限要 128 IP ⇒
      //     在打破之前，① 是**唯一**能花 IP 的地方 ⇒ 挡住它等于"IP 完全没用" ✗
      //   ⚠️ 实发侧本来就没这个门槛（`buyInfinityUpgrade` 只对 `thresholdFlat` 强制）
      //      ⇒ 这又是一处**"显示门槛 ≠ 实发门槛"**（显示比实发严）—— 修的是 UI ✓
      const canIpD = state.infinityPoints.gte(costIpD);
      if (el["inf-ipDouble-state"]) el["inf-ipDouble-state"].textContent = `Lv ${fmt(lvIpD, 0)}`;
      if (el["inf-ipDouble-cost"]) {
        // ⚠️⚠️ 2025 修正（用户报「无限升级不显示价格 + ip 只显示 1e308」）：
        //   原来是 `fmt(costIpD, 0)` —— `fmt` 会把 `"1.00"` 的**尾随零括掉** ⇒ 输出 `1e308` ✗
        //   （实测：`fmt(1e308,0) = "1e308"`、`sci(1e308) = "1.00e308"`）
        //   ⇒ 数值一律走 `sci`（用户裁定的统一格式：尾数固定 2 位小数）✓
        el["inf-ipDouble-cost"].textContent = `花费 ${sci(costIpD)} 无限点`;
      }
      if (el["inf-ipDouble-desc"]) {
        // 与实发同源：`effIpD.mult` 就是 `ipDoubleMult(state)`（×2^等级）
        el["inf-ipDouble-desc"].textContent = lvIpD.gt(0)
          ? `无限点收益 ×${sci(effIpD.mult)}（下一级 ×${sci(effIpD.mult.mul(cfg.effectMult))}）`
          : cfg.desc;
      }
      const nIpD = ipDoubleAffordableIn(lvIpD.toNumber(), state.infinityPoints, rewardIpDoubleKneeMult(state));   // ★ 显示=实发 ✓
      if (el["max-ipDouble-n"]) el["max-ipDouble-n"].textContent = fmt(nIpD, 0);
      const bbIpD = el["inf-btn-ipDouble"];
      if (bbIpD) {
        bbIpD.classList.toggle("affordable", canIpD);
        bbIpD.disabled = !canIpD;
      }
      if (el["btn-max-ipDouble"]) el["btn-max-ipDouble"].disabled = !(nIpD > 0);
      owned += lvIpD.gt(0) ? 1 : 0;
      continue;
    }

    if (!btn) continue;
    const cost = infinityUpgradeCost(state, id);
    const bought = !cfg.repeatable && infinityUpgradeOwned(state, id);
    //   （原来这行还含 "coinage" ⇒ 删铸币时被整行删掉 ✗）
    const level = cfg.repeatable ? (state.ipDoubleLevel?.toNumber() ?? 0) : 0;
    if (bought || level > 0) owned++;
    // ★ 门槛与价格一样，必须**同源**地进"可购买判定 + 文案"。
    //   踩过（同一类，且这次是我自己埋的）：`thresholdFlat`（门槛压平）在引擎里被
    //   `brokenInfinity` 挡住，但界面只比 IP ⇒ 会把它标成可购买、也不说缺什么 ✗
    //   ⇒ 与虚空升级的 `requireZpe` 用同一套写法。
    const gateOk = id !== "thresholdFlat" || state.brokenInfinity;
    const can = !bought && gateOk && ip.gte(cost);
    btn.classList.toggle("affordable", can);
    btn.classList.toggle("maxed", bought);
    btn.disabled = bought;
    $(`inf-${id}-state`).textContent = cfg.repeatable
      ? `Lv ${fmt(state.ipDoubleLevel ?? 0, 0)}`
      : bought ? "已购买 ✓" : "未购买";
    $(`inf-${id}-cost`).textContent = bought
      ? "已生效"
      // ⚠️ 2025 修正：`fmt(cost, 0)` ⇒ `1e308`（尾随零被括掉）✗ ⇒ 一律走 `sci` ✓
      : `花费 ${sci(cost)} 无限点` + (gateOk ? "" : "｜需先打破无限");

    // ★ 效果文本从公式推导（不许手写），买下后显示**当前实际值**
    const eff = infinityUpgradeEffect(state, id);
    let descText = cfg.desc;
    if (id === "ipDouble" && level > 0) {
      descText = `无限点收益 ×${sci(eff.mult)}（下一级 ×${sci(eff.mult.mul(cfg.effectMult))}）`;
    } else if (id === "ipToZpe" && state.ipToZpeBought) {
      descText = `ZPE 倍率 +${sci(eff.bonus)}（随无限点增长）`;
    } else if (id === "ipToTransmuter" && state.ipToTransmuterBought) {
      descText = `相变仪转换速率 ${fmtMult(eff.mult)}`;
    } else if (id === "ipTime" && state.ipTimeBought) {
      // ④ 实时产点：显示速率 + 本次已累计（封顶后提示该收了）
      const capTxt = eff.capGain ? `，单次上限 ${sci(eff.capGain)} 点` : "";
      descText = `每秒 +${sci(eff.perSecond)} 点（${sci(eff.perHour)} 点/小时${capTxt}）` +
        (eff.accrued.gt(0) ? `　本次已实时进账 ${sci(eff.accrued)} 点` : "") +
        (eff.capped ? "　⚠️ 已到 30 分钟上限，该大坍缩了" : "");
    } else if (cfg.startLog10 != null) {
      descText = bought
        // ★ 2025 统一科学计数法（原 `1e${activeLog10}` 有歧义）
        ? `每次大坍缩后以 ${sci(Decimal.pow(10, eff.activeLog10))} 物质开局（当前生效的一档）`
        : cfg.desc;
    } else if (cfg.rateMult != null) {
      descText = bought
        ? `量子成长速率上限 ×${fmt(eff.totalMult, 3)}（已叠加）`
        : cfg.desc;
    }
    $(`inf-${id}-desc`).textContent = descText;
  }
  el["inf-upgrade-count"].textContent = `${owned} / ${INFINITY_ORDER.length}`;

  // 收入明细：深度部分 + 耗时部分（④）
  const elapsed = state.infinityElapsed ?? 0;
  // ★★ 2025：这里原来手写 `Decimal.pow(effectMult, 等级)` —— 与实发侧脱节的第二处 ✗
  //   统一走唯一入口 `ipDoubleMult(state)`（见 engine.js 同处的注释）
  const perHour = state.ipTimeBought
    ? new Decimal(3600).div(INFINITY_UPGRADES.ipTime.secondsPerPoint)
      .mul(ipDoubleMult(state))
    : new Decimal(0);
  el["inf-income"].textContent = perHour.gt(0)
    ? `${fmt(perHour, 0)} 点/小时（耗时部分）`
    : "只有深度收益（买「无限长河」后按耗时给）";
  el["inf-elapsed"].textContent = `${fmtTime(elapsed)} · 本次已攒 ${fmt(new Decimal(elapsed).div(INFINITY_UPGRADES.ipTime.secondsPerPoint), 0)} 点`;
}

// ══════════════════════════════════════════════════════════
// 事件绑定
// ══════════════════════════════════════════════════════════

/**
 * 给 **index.html 里静态写死**的那些"升级 / 解锁"按钮补上乘区色。
 *
 * 为什么要有这个函数（用户 2025 指出）：
 *   数据驱动的五张升级列表（主升级 / 虚空 / 暗能量 / 无限 / 梦想）都走 `applyZone()` ✓，
 *   但**静态按钮**（熵阱、ZPE 引擎升格、相变仪解锁、坍缩加速）的颜色是
 *   直接写死在 `index.html` 的 `class="btn zone zone-xxx"` 上的 ✗ —— 于是：
 *     · 换乘区时它们**不会跟着变**（两处数据源 ⇒ 迟早脱节）；
 *     · 而且 `-max`（买满）那几个**一个颜色都没有** ✗
 *   ⇒ 统一改成从这里按 `ZONE_OF` 上色：**唯一数据源**，与其它列表同一套规矩 ✓
 *
 * 判据仍是「只看**加成作用的位置**」，不看它属于哪个页面（见 config.js 的 `ZONE_OF`）。
 * 只建一次（与 `buildZpeMechanisms` 同理），在 `render()` 里做会每帧重建 ⇒ hover 闪烁 ✗
 */
export function renderFloatResets(state) {
  // ── 无限（大坍缩）──
  const infBtn = el["fr-btn-infinity"];
  if (infBtn) {
    const can = !!state.brokenInfinity;
    infBtn.classList.toggle("affordable", can);
    infBtn.disabled = !can;
    if (el["fr-sub-infinity"]) {
      el["fr-sub-infinity"].textContent = can ? "大坍缩" : "需先打破无限";
    }
  }
  // ── 永恒 ──
  const eterBtn = el["fr-btn-eternity"];
  if (eterBtn) {
    const can = canEternity(state);              // ★ 唯一入口（不自己比 IP）✓
    eterBtn.classList.toggle("affordable", can);
    eterBtn.disabled = !can;
    if (el["fr-sub-eternity"]) {
      // 未达成时把**还差多少**说清楚（`sci` 统一格式 = `1.00e280`）✓
      el["fr-sub-eternity"].textContent = can
        ? "可永恒"
        : `${sci(state.infinityPoints)} / ${sci(Decimal.pow(10, ETERNITY.goalLog10))}`;
    }
  }
}

/**
 * ★★★ 2025：接线**全页面悬浮重置窗**（只跑一次，见 `initUI`）。
 *
 * ── 关键纪律：两个真按钮与页面上的按钮**走同一个 handler** ✓
 *   悬浮窗**不许自己调** `doBigCrunch` / `doEternity`
 *   —— 那会绕过 `save(state)` 与 `afterAction()`（页面按钮那两步是必须的），
 *     于是"悬浮窗点了不存盘 / 界面不刷新"✗
 *   ⇒ 一律走 `handlers.*`（与页面按钮**同一个函数对象**）✓
 */