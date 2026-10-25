/**
 * space-ui.js —— 空间膨胀页面（**UI 先行**）
 *
 * 目标：先把 `docs/SPACE-EXPANSION-FINAL.md` 的页面骨架、信息层级、升级卡片和
 *       “未接线”状态做出来；本文件**不购买、不结算、不改收益**。
 *
 * ⚠️ 后续接引擎时，价格/等级/挑战状态都应从 state 的同一组字段读；
 *    这里已经预留 `state.space = { se, st, challenge, ipPeak, epPeak, upgrades }`。
 */
import Decimal from "../dist/break_eternity.esm.js";
import { markPageUnlocked } from "./config.js";
import { startSpaceChallenge } from "./engine.js";
import { buySpaceUpgrade, spaceCanBuy, spaceUpgradeCost, spaceUpgradeLevel } from "./space-upgrades.js";
import { exitSpaceChallenge, spaceUnlocked } from "./space.js";
import { fmt, sci } from "./ui-core.js";
import { SPACE_DESIGN, SPACE_UPGRADES } from "./space-config.js";

const D = (x) => new Decimal(x ?? 0);
const cardRefs = new Map();
let built = false;
let lastState = null;

function h(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = String(text);
  return n;
}

function currencyCard(label, id, hint) {
  const box = h("div", "space-cur");
  box.appendChild(h("span", "space-cur-label", label));
  const val = h("b", "space-cur-value", "0");
  val.id = id;
  box.appendChild(val);
  box.appendChild(h("small", "space-cur-hint", hint));
  return box;
}

function statusCard(title, id) {
  const box = h("div", "space-status-card");
  const head = h("div", "space-status-head");
  head.appendChild(h("h3", null, title));
  const badge = h("span", "badge space-badge", "未接线");
  badge.id = id;
  head.appendChild(badge);
  box.appendChild(head);
  return box;
}

function upgradeCard(u) {
  const box = h("div", "space-upg" + (u.deferred ? " space-upg--deferred" : ""));
  const head = h("div", "space-upg-head");
  head.appendChild(h("b", "space-upg-name", `${u.id} · ${u.name}`));
  const lv = h("span", "space-upg-lv", u.repeatable ? "Lv 0" : "未购买");
  head.appendChild(lv);
  box.appendChild(head);
  box.appendChild(h("div", "space-upg-slot", `落点：${u.slot}`));
  box.appendChild(h("div", "space-upg-desc", u.desc));
  const meta = h("div", "space-upg-meta");
  meta.appendChild(h("span", "space-upg-effect", u.effect));
  const cost = h("span", "space-upg-cost", u.cost);
  meta.appendChild(cost);
  box.appendChild(meta);
  const btn = h("button", "btn space-upg-btn", u.deferred ? "暂缓（IP 禁令）" : "购买");
  btn.type = "button";
  btn.disabled = true;
  btn.title = u.deferred ? u.deferredReason : "";
  btn.addEventListener("click", () => {
    if (!lastState || u.deferred) return;
    const r = buySpaceUpgrade(lastState, u.id);
    if (r.ok) renderSpace(lastState);
  });
  box.appendChild(btn);
  cardRefs.set(u.id, { box, lv, btn, cost });
  return box;
}

function build() {
  if (built) return;
  const root = document.getElementById("space-root");
  if (!root) return;

  const head = h("div", "space-head");
  const intro = h("div", "space-intro");
  const title = h("p", "rule");
  title.appendChild(h("b", null, "空间膨胀"));
  title.appendChild(h("span", "space-title-sep", "  ——  "));
  const badge = h("span", "badge space-badge", "UI 先行 · 未接线");
  badge.id = "space-page-badge";
  title.appendChild(badge);
  intro.appendChild(title);
  intro.appendChild(h("p", "note",
    "EP ≥ 1e1200 解锁；挑战内所有最终收益 ^0.5，退出后全额，SE 只在挑战内按 IP 峰值结算。"
    + "ST 基础公式的上一轮结果固定取 SE。实测 EP 1e1296，本阶段目标重定为 1e3600；"
    + "挑战、SE/ST、du1~6/9/11 与 du7 自动化已接。"));
  head.appendChild(intro);

  const curs = h("div", "space-currencies");
  curs.appendChild(currencyCard("膨胀点数 SE", "space-se", "挑战内 IP 峰值结算"));
  curs.appendChild(currencyCard("膨胀时间 ST", "space-st", "由全局加成主动生产"));
  head.appendChild(curs);
  root.appendChild(head);

  const statusRow = h("div", "space-status-row");
  const chal = statusCard("挑战模式", "space-challenge-badge");
  chal.appendChild(h("div", "space-kv",
    "进入后：所有最终收益 ^0.5 ｜ 可随时退出 ｜ 不改价格/门槛/上限"));
  const chalLine = h("div", "space-status-line", "当前：未进入");
  chalLine.id = "space-challenge-line";
  chal.appendChild(chalLine);
  const chalBtn = h("button", "btn space-challenge-btn", "进入挑战");
  chalBtn.id = "space-challenge-btn";
  chalBtn.type = "button";
  chalBtn.disabled = true;
  chalBtn.title = "需要 EP 1e1200";
  chalBtn.addEventListener("click", () => {
    if (!lastState) return;
    const result = lastState.space?.challenge === true
      ? exitSpaceChallenge(lastState)
      : startSpaceChallenge(lastState);
    if (result?.ok) renderSpace(lastState);
  });
  chal.appendChild(chalBtn);
  statusRow.appendChild(chal);

  const target = statusCard("本阶段目标", "space-target-badge");
  const targetEp = D(SPACE_DESIGN.targetEp);
  target.appendChild(h("div", "space-kv", `空间膨胀目标：EP ≥ ${sci(targetEp)}`));
  const targetGrid = h("div", "space-kv-grid");
  const epNow = h("div", "space-kv");
  epNow.appendChild(h("span", null, "当前 EP"));
  const epNowVal = h("b", null, "0");
  epNowVal.id = "space-ep-now";
  epNow.appendChild(epNowVal);
  targetGrid.appendChild(epNow);
  const ipPeak = h("div", "space-kv");
  ipPeak.appendChild(h("span", null, "IP 峰值"));
  const ipPeakVal = h("b", null, "0");
  ipPeakVal.id = "space-ip-peak";
  ipPeak.appendChild(ipPeakVal);
  targetGrid.appendChild(ipPeak);
  target.appendChild(targetGrid);
  const bar = h("div", "space-progress");
  const barFill = h("div", "space-progress-fill");
  barFill.id = "space-ep-progress";
  bar.appendChild(barFill);
  target.appendChild(bar);
  statusRow.appendChild(target);
  root.appendChild(statusRow);

  const seHead = h("h2", "space-section-title", "SE 复购 · du1~du6");
  root.appendChild(seHead);
  const seList = h("div", "space-upgrade-grid");
  seList.id = "space-se-list";
  for (const u of SPACE_UPGRADES.filter((x) => x.currency === "se")) seList.appendChild(upgradeCard(u));
  root.appendChild(seList);

  const stHead = h("h2", "space-section-title", "ST 单次 · du7~du11");
  root.appendChild(stHead);
  const stList = h("div", "space-upgrade-grid");
  stList.id = "space-st-list";
  for (const u of SPACE_UPGRADES.filter((x) => x.currency === "st")) stList.appendChild(upgradeCard(u));
  root.appendChild(stList);

  const note = h("p", "note space-footnote");
  note.textContent = "du1~du6 用 SE 复购；du9/du11 用 ST 单次；du7 是单次解锁 du1~du6 自动化（开关在梦想页）。"
    + " du11 是单次 1e5 ST，用当前 ST 把暗能量超载强度下限从 0.3 抬向 0.95（不会到 1）。";
  root.appendChild(note);

  built = true;
}

function setText(id, value) {
  const n = document.getElementById(id);
  if (n) n.textContent = value;
}

/**
 * 每帧刷新（只改文本/进度，不重建）。
 * @param {object} state 主 state；没有空间字段时显示 0 / 未接线，不报错。
 */
export function renderSpace(state) {
  if (typeof document === "undefined") return;
  build();
  if (!built || !state) return;
  lastState = state;

  const sp = state.space ?? {};
  const se = D(sp.se);
  const st = D(sp.st);
  const ep = D(state.eternityPoints);
  const ipPeak = D(sp.ipPeak ?? state.maxIpThisEternity ?? state.infinityPoints);
  const challenge = sp.challenge === true;
  const unlockEp = D(SPACE_DESIGN.unlockEp);
  const unlocked = spaceUnlocked(state);
  if (unlocked) markPageUnlocked(state, "space");
  const targetEp = D(SPACE_DESIGN.targetEp);

  // 解锁点是 EP ≥ 1e1200，不是第一次永恒：flyout 保留可见，但未达成时锁住。
  const flyout = document.getElementById("flyout-eternity-space");
  if (flyout) {
    flyout.classList.toggle("locked", !unlocked);
    flyout.setAttribute("aria-disabled", unlocked ? "false" : "true");
    if (unlocked) flyout.removeAttribute("title");
    else flyout.title = `尚未解锁：需要永恒点达到 ${sci(unlockEp)}`;
  }

  const chalBtn = document.getElementById("space-challenge-btn");
  if (chalBtn) {
    chalBtn.disabled = !unlocked;
    chalBtn.textContent = challenge ? "退出挑战" : "进入挑战";
    chalBtn.title = !unlocked
      ? `需要永恒点达到 ${sci(unlockEp)}`
      : challenge
        ? "退出后最终收益恢复全额；已结算 SE 保留"
        : "进入时自动执行一次永恒重置（保留七巧板 / 暗物质）";
  }

  setText("space-se", fmt(se, 0));
  setText("space-st", fmt(st, 2));
  setText("space-ep-now", fmt(ep, 0));
  setText("space-ip-peak", fmt(ipPeak, 0));
  setText("space-challenge-badge", !unlocked ? "未解锁" : (challenge ? "挑战中" : "未进入"));
  setText("space-challenge-line", !unlocked
    ? `需要永恒点达到 ${sci(unlockEp)} 后解锁（当前只展示 UI）`
    : (challenge ? "当前：挑战中 · 最终收益 ^0.5" : "进入时自动执行一次永恒重置（保留七巧板 / 暗物质）"));

  const pct = (() => {
    if (!ep.gt(0) || !targetEp.gt(0)) return 0;
    const p = ep.log10().div(targetEp.log10()).toNumber() * 100;
    return Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : 0;
  })();
  const fill = document.getElementById("space-ep-progress");
  if (fill) fill.style.width = `${pct.toFixed(1)}%`;

  const levels = sp.upgrades ?? {};
  for (const u of SPACE_UPGRADES) {
    const ref = cardRefs.get(u.id);
    if (!ref) continue;
    const raw = levels[u.id];
    const level = spaceUpgradeLevel(state, u.id);
    const owned = !u.repeatable && level > 0;
    const cost = spaceUpgradeCost(state, u.id);
    const unit = u.currency === "se" ? "SE" : "ST";
    if (u.deferred || u.pending) {
      ref.lv.textContent = u.repeatable ? "Lv 0" : "未购买";
      ref.btn.textContent = u.deferred ? "暂缓（IP 禁令）" : "效果待接";
      ref.btn.disabled = true;
      ref.btn.title = u.deferredReason ?? u.pendingReason ?? "本阶段暂缓";
      ref.cost.textContent = u.cost;
    } else {
      ref.lv.textContent = u.repeatable ? `Lv ${fmt(D(level), 0)}` : (owned ? "已购买" : "未购买");
      ref.cost.textContent = `${u.repeatable ? "下一级" : "价格"} ${sci(cost)} ${unit}`;
      const can = spaceCanBuy(state, u.id);
      ref.btn.textContent = owned
        ? "已购买"
        : can ? `购买 · ${sci(cost)} ${unit}` : `${unit} 不足`;
      ref.btn.disabled = owned || !can;
      ref.btn.title = owned ? "单次升级已购买" : can ? "点击购买" : `还差 ${sci(cost.sub(D(u.currency === "se" ? sp.se : sp.st)))} ${unit}`;
    }
    ref.box.classList.toggle("space-upg--owned", !u.repeatable && (raw === true || level > 0));
  }

  const pageBadge = document.getElementById("space-page-badge");
  if (pageBadge) {
    pageBadge.textContent = !unlocked
      ? "未解锁"
      : (SPACE_DESIGN.wired ? "已接线" : "du 已接 · du7 自动化");
  }
}
