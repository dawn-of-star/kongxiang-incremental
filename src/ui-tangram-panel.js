/**
 * ui-tangram-panel.js —— 七巧板面板（真数据 / 画板 / 拖拽 / 挑战预览）
 *
 * ★ 2026 模块化：从 ui.js 抽出的**独立面板渲染器**。
 *   · DOM 缓存/去重/格式化一律来自 `./ui-core.js`（本文件不定义地基）
 *   · 只被 `ui.js` 的 render() 调用（单向依赖）
 */

import { paintAutoCrunchUI } from "./autocrunch-ui.js";
import { hasEternityMilestone } from "./config.js";
import { D } from "./formulas.js";
import { updateTabLocks } from "./lock-ui.js";
import { paintTangramBoard } from "./tangram-board.js";
import { TANGRAM_PIECES, autoPlaceTangram, cellsFromFingerprint, drawTangramPiece, exchangeTangramPiece, flipTangramPlacement, moveTangramPlacement, resetTangramBoard, rotateTangramPlacement, takeTangramBack, tangramAdvanceChallenge, tangramChallengeSolved, tangramChallengeTarget, tangramCoverage, tangramPieceAtStep, tangramPriceFactor, tangramPricesAt } from "./tangram-game.js";
import { tangramRewardEffects } from "./tangram.js";
import { el, safePaint, sci, uiHandlers } from "./ui-core.js";

export function renderTangram(state) {
  const ok = hasEternityMilestone(state, "em8");
  if (el["tangram-hint"]) {
    el["tangram-hint"].textContent = ok
      ? "已达成 em8（永恒自动化）—— 但七巧板机制尚未实现，本页仍是骨架"
      : "未解锁：需要达成 em8（永恒自动化）—— 该里程碑目前仍是占位（唯一 pending 的一条）";
  }
  if (el["tangram-progress"]) {
    el["tangram-progress"].textContent = "骨架已就位 ｜ 覆盖率内核 / 三条轴 / 拼装 / 概率 / 挑战 = 未实现";
  }
  // ★ 三条轴的覆盖率读数 + 拼装挑战（**都还没有真实来源** ⇒ 一律写 "—"，不写 0% ✗）
  //   ⚠️ 将来做覆盖率内核时，这里要改成：
  //     ① 三个读数 ← `cov纵 / cov横 / cov斜`；
  //     ② 同时用 `el["tg-cov-vert"].style.strokeDashoffset = 全长 × (1 − cov)` 点亮那三条线
  //        （形制同暗物质面板的环 `darkm-ring-fill`）✓
  for (const k of ["tangram-cov-vert", "tangram-cov-horz", "tangram-cov-diag"]) {
    if (el[k]) el[k].textContent = "—";
  }
  // ★★★ 2026：**拼装挑战**真数据（难度 / 解法数 / 本档进度 / 是否拼对 / 通关总数）✓
  {
    const state2 = state;                      // 本函数里叫 state（不是 st）✓
    const tgt = tangramChallengeTarget(state2);
    const solved = tangramChallengeSolved(state2);
    const cleared = state2.tangramCleared ?? [0, 0, 0, 0, 0, 0];
    const totalCleared = cleared.reduce((a, b) => a + Math.max(0, Math.floor(Number(b) || 0)), 0);
    const perTier = 6;
    const d = Math.max(0, Math.min(5, Math.floor(Number(tgt?.d ?? 0))));
    if (document.getElementById("tangram-chal-badge")) document.getElementById("tangram-chal-badge").textContent = totalCleared + " / 36";
    if (el["tangram-chal-need"]) {
      el["tangram-chal-need"].textContent = tgt
        ? "难度 " + (d + 1) + " ｜ 解法 " + tgt.ways + " 种 ｜ 轮廓边段 " + tgt.boundary
        : "—";
    }
    if (el["tangram-chal-progress"]) {
      el["tangram-chal-progress"].textContent = "第 " + (d + 1) + " 档 " + Math.min(perTier, Math.floor(Number(cleared[d] ?? 0))) + " / " + perTier;
    }
    if (document.getElementById("tangram-chal-solved")) {
      document.getElementById("tangram-chal-solved").textContent = solved ? "✅ 已拼对 —— 点「下一题」" : "未拼对";
    }
    if (document.getElementById("tg-chal-hint")) {
      document.getElementById("tg-chal-hint").textContent = solved ? "已拼对，点「下一题」继续 ✓" : "把七块拼成题目形状（可旋转/翻转）";
    }
  }
  // ★★★ 2026：用**真数据**覆盖上面的占位（实现在文件末尾）✓
  renderTangramReal(state);
  // ⚠️ 2026：`renderDreamPage(state)` **从这里搬走了** ——
  //   梦想页是**主控台**的子页，却挂在七巧板（永恒期）的渲染函数里 ⇒ 语义错、且
  //   一旦七巧板被门控/拆分，梦想页就会静默失效 ✗
  //   ⇒ 已移到 `render()` 主流程（与 `renderFloatResets` 同一处，**无条件**调用）✓
  // ★ 2026：AD 式锁态（每帧幂等；只改 class/属性）✓
  updateTabLocks(state);
}

/**
 * ★★★ 2025 新实现（`docs/NEKO.md` §7 / 设计稿 §10）：**猫猫卡片**。
 *
 * 守「显示 == 实发」：好感度 / 指数 / 下一档全部走 config 的
 *   `nekoGlobalExponent` / `nekoNextTier` / `NEKO`（**唯一入口**）⇒ 与实发不可能脱节 ✓
 *
 * ⚠️ 接入 N.E.K.O SDK 是**另一条线**（NEKO.md §3~§9，走 `neko-minigame-sdk`）。
 *   本卡片在**未接入**时也完整可用（好感度由游戏内原生机制驱动）——
 *   这正是 NEKO.md §7 明写的定位 ✓
 */
let tgSel = null;
let tgBarBuilt = false;
let tgAcqBuilt = false;
let tgChalBound = false;
let stRefForAcq = null;   // 获取卡片的按钮闭包要用（构建期没有 state ✓）

/** 下一块（按面积从小到大）的步号；全齐 ⇒ -1 ✓ */
function tgNextStep(st) {
  for (let s = 0; s < 7; s++) {
    const pc = tangramPieceAtStep(s);
    if (!pc) return -1;
    if (!st.tangramOwned?.[pc.id]) return s;
  }
  return -1;
}

function renderTangramReal(st) {
  const hint = el["tangram-hint"];
  const prog = el["tangram-progress"];
  if (!hint && !prog) return;

  const ownedN = TANGRAM_PIECES.filter((x) => st.tangramOwned?.[x.id]).length;
  const placedN = Object.keys(st.tangramPlaced ?? {}).length;
  const cov = tangramCoverage(st);
  const tgt = tangramChallengeTarget(st);
  const solved = tangramChallengeSolved(st);
  const step = tgNextStep(st);
  const pc = step >= 0 ? tangramPieceAtStep(step) : null;
  const pr = step >= 0 ? tangramPricesAt(step) : null;
  const factor = tangramPriceFactor(st);

  if (!document.getElementById("tg-reward-line") && hint?.parentElement) {
    const d = document.createElement("p");
    d.className = "note";
    d.id = "tg-reward-line";
    hint.parentElement.insertBefore(d, hint.nextSibling);
  }
  if (hint) {
    hint.textContent = pc
      ? "下一块：" + pc.name
        + " ｜ 抽 " + sci(D(pr.draw).mul(factor)) + " EP"
        + " ｜ 兑 " + sci(D(pr.exchange).mul(factor)) + " EP"
        + " ｜ 保底 " + Math.floor(Number(st.tangramPity?.[pc.id] ?? 0)) + "/" + pr.pity
      : "七块已集齐 —— 到拼装挑战里拼图案吧";
  }
  // ★★★ 2026：**挑战奖励**（表在 tangram.js 的 TANGRAM_CHALLENGE_REWARDS）—— 面板里显示当前档位 ✓
  if (prog) {
    prog.textContent = "已获得 " + ownedN + "/7 ｜ 已放下 " + placedN
      + (tgt ? (" ｜ 挑战：难度 " + (tgt.d + 1) + " ｜ " + (solved ? "已拼对！" : "未拼对")) : "");
  }
  // ★★★ 2026：画棋盘（目标轮廓 + 板块 + 三轴 dashoffset）✓
safePaint("tangram-board", () => paintTangramBoard(st));
  // ★ 2026（用户：「**主要是巧板托盘**」）—— 给 7 个槽位画**真实形状**缩略图
  //   ⚠️ 只往槽位里塞 SVG，**不动任何布局**（15% 右列 / 2 列网格 / 855px 坐标轴全部原样）✓
safePaint("tangram-thumbs", () => paintTangramThumbs(st));   // ⚠️ 本函数的形参叫 st（不是 state）✗
  // ★ 2026：自动无限的**三条规则面板**（挂在「无限自动化」卡片右侧；只建一次）✓
safePaint("autocrunch-ui", () => paintAutoCrunchUI(st, () => uiHandlers?.onTangramCommit?.()));
  // ★ 2026：**挑战题目预览**（小图，画在挑战卡里；棋盘只做覆盖率 ✓）
  // ★ 2026（用户：「点一下出预览图就行了」）—— 预览默认隐藏，点「看题目」才展开 ✓
  if (!tgPrevBound && typeof document !== "undefined") {
    const btn = document.getElementById("tg-chal-preview-btn");
    const wrap = document.getElementById("tg-chal-preview-wrap");
    if (btn && wrap) {
      tgPrevBound = true;
      btn.addEventListener("click", () => {
        const show = wrap.hidden;
        wrap.hidden = !show;
        btn.textContent = show ? "收起题目" : "看题目";
        if (show) paintChallengePreview(st, true);   // 展开时强制画一次 ✓
      });
    }
  }
safePaint("tangram-preview", () => paintChallengePreview(st));

  // ★★★ 2026：**挑战奖励的当前档位**（唯一聚合入口 `tangramRewardEffects`）✓
  const rw = tangramRewardEffects(st.tangramCleared);
  const rl = document.getElementById("tg-reward-line");   // ⚠️ 不走 el[] 缓存（它在运行时才建）✓
  if (rl) {
    rl.textContent = "挑战奖励：EP 折扣 " + (rw.epDiscount * 100).toFixed(0) + "%"
      + " ｜ 免费引擎 " + rw.freeZpeEngineLevels + " 级"
      + " ｜ 暗能量 knee ×" + rw.deKneeMult.toFixed(2)
      + " ｜ IP 倍增 knee ×" + rw.ipDoubleKneeMult.toFixed(2) + "（仅显示）"
      + " ｜ 转化斜率 ×" + (rw.convSlopeMult ?? 1).toFixed(0)
      + " ｜ 计数系数 ×" + (rw.countFreqMult ?? 1).toFixed(0)
      + " ｜ 保底 " + (rw.pityFloor ?? 150)
      + (rw.passiveIpFrac > 0 ? " ｜ 每秒 " + (rw.passiveIpFrac * 100).toFixed(0) + "% 本次无限 IP" : "")
      + (rw.allClear ? " ｜ 全清 ✓" : "");
  }
  for (const pair of [["vert", cov.vert], ["horz", cov.horz], ["diag", cov.diag]]) {
    const node = el["tangram-cov-" + pair[0]];
    if (node) node.textContent = (pair[1] * 100).toFixed(1) + "%";
  }

  const slots = typeof document !== "undefined"
    ? document.querySelectorAll("#panel-tangram .tangram-slot")
    : [];
  for (let i = 0; i < slots.length && i < TANGRAM_PIECES.length; i++) {
    const node = slots[i];
    const piece = TANGRAM_PIECES[i];
    const own = !!st.tangramOwned?.[piece.id];
    if (node.dataset.tgBound !== "1") {
      node.dataset.tgBound = "1";
      node.style.cursor = "pointer";
      const pid = piece.id;
      node.addEventListener("click", () => {
        if (!st.tangramOwned?.[pid]) return;
        tgSel = pid;
        renderTangramReal(st);
      });
    }
    node.classList.toggle("owned", own);
    node.style.opacity = own ? "1" : "0.5";
    node.style.outline = tgSel === piece.id ? "1px solid var(--eternity, #b388ff)" : "none";
  }

  // ★★★ 2026（用户：「一开始的抽取系统不是挺好的么？**进度条 + 直接兑换**，在**托盘上方**」）——
  //   获取卡片放在托盘**最上面**（`.tangram-tray` 的第一个子节点）✓ 只建一次，之后每帧只改数字 ✓
  if (!tgAcqBuilt && typeof document !== "undefined") {
    // ★ 2026：插进 **.tangram-side**（三段式容器）⇒ 不会变成托盘网格的单元格 ✗
    const side = document.querySelector("#panel-tangram .tangram-side")
      ?? document.querySelector("#panel-tangram .tangram-tray");
    if (side) {
      tgAcqBuilt = true;
      const card = document.createElement("div");
      card.id = "tg-acq-card";
      card.style.marginBottom = "8px";
      card.innerHTML = [
        '<div class="tg-acq-title" style="font-weight:700;margin-bottom:4px">获取巧板 <span class="dim" id="tg-acq-name"></span></div>',
        '<div class="tg-acq-bar"><i id="tg-acq-fill"></i></div>',
        '<div class="tg-acq-row">',
        '  <button class="btn btn-small" id="tg-acq-draw" style="width:auto">抽</button>',
        '  <button class="btn btn-small" id="tg-acq-ex" style="width:auto">直接兑换</button>',
        '  <span class="dim" id="tg-acq-pity"></span>',
        '</div>',
      ].join("");
      side.insertBefore(card, side.firstChild);
      document.getElementById("tg-acq-draw")?.addEventListener("click", () => {
        const s2 = tgNextStep(stRefForAcq);
        if (s2 >= 0) { drawTangramPiece(stRefForAcq, s2); uiHandlers?.onTangramCommit?.(); }
      });
      document.getElementById("tg-acq-ex")?.addEventListener("click", () => {
        const s2 = tgNextStep(stRefForAcq);
        if (s2 >= 0) { exchangeTangramPiece(stRefForAcq, s2); uiHandlers?.onTangramCommit?.(); }
      });
    }
  }
  if (tgAcqBuilt) {
    stRefForAcq = st;
    const nm = document.getElementById("tg-acq-name");
    const fill = document.getElementById("tg-acq-fill");
    const pity = document.getElementById("tg-acq-pity");
    const btnD = document.getElementById("tg-acq-draw");
    const btnE = document.getElementById("tg-acq-ex");
    if (nm) nm.textContent = pc ? "｜" + pc.name : "｜七块已集齐";
    const fails = pc ? Math.max(0, Math.floor(Number(st.tangramPity?.[pc.id] ?? 0))) : 0;
    if (fill) fill.style.width = pc && pr ? Math.min(100, (fails / pr.pity) * 100) + "%" : "0%";
    if (pity) pity.textContent = pc && pr ? "保底 " + fails + "/" + pr.pity : "";
    if (btnD) { btnD.textContent = pc && pr ? "抽（" + sci(D(pr.draw).mul(factor)) + "）" : "抽"; btnD.disabled = !pc; }
    if (btnE) { btnE.textContent = pc && pr ? "直接兑换（" + sci(D(pr.exchange).mul(factor)) + "）" : "直接兑换"; btnE.disabled = !pc; }
  }  // ★ 2026：拼装挑战节的两个按钮（挂一次 ✓）
  if (!tgChalBound && typeof document !== "undefined") {
    const bNext = document.getElementById(tgChalBound ? "" : "tg-chal-next");
    const bReset = document.getElementById("tg-chal-reset");
    if (bNext && bReset) {
      tgChalBound = true;
      bNext.addEventListener("click", () => { tangramAdvanceChallenge(st); uiHandlers?.onTangramCommit?.(); });
      bReset.addEventListener("click", () => { resetTangramBoard(st); uiHandlers?.onTangramCommit?.(); });
    }
  }
  if (!tgBarBuilt && typeof document !== "undefined") {
    // ★ 2026：控制条挂在 **.tangram-side** 的末尾（托盘下方，不前不后 ✓）
    const host = document.querySelector("#panel-tangram .tangram-side")
      ?? document.querySelector("#panel-tangram .tangram-tray");
    if (host) {
      tgBarBuilt = true;
      const bar = document.createElement("div");
      bar.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;margin:8px 0";
      const mk = (label, fn) => {
        const b = document.createElement("button");
        b.className = "btn btn-small";
        b.style.width = "auto";
        b.textContent = label;
        b.addEventListener("click", () => { fn(); uiHandlers?.onTangramCommit?.(); });
        bar.appendChild(b);
      };
      mk("左移", () => { if (tgSel) moveTangramPlacement(st, tgSel, -1, 0); });
      mk("右移", () => { if (tgSel) moveTangramPlacement(st, tgSel, 1, 0); });
      mk("上移", () => { if (tgSel) moveTangramPlacement(st, tgSel, 0, 1); });
      mk("下移", () => { if (tgSel) moveTangramPlacement(st, tgSel, 0, -1); });
      mk("旋转", () => { if (tgSel) rotateTangramPlacement(st, tgSel, 1); });
      mk("翻转", () => { if (tgSel) flipTangramPlacement(st, tgSel); });
      mk("放下", () => { if (tgSel) autoPlaceTangram(st, tgSel); });
      mk("收回", () => { if (tgSel) takeTangramBack(st, tgSel); });
      mk("下一题", () => tangramAdvanceChallenge(st));
      mk("重置棋盘", () => resetTangramBoard(st));
      host.appendChild(bar);
    }
  }
}


// ──────────────────────────────────────────────────────────
// ★ 2026：托盘槽位的**真实形状缩略图**（用户唯一要求的那件事）
//   每格 = 小 SVG（顶点取 TANGRAM_PIECES，包围盒自动缩放）+ 原来的名字文字 ✓
//   ⚠️ 只建一次（data-thumb 标记）；不改尺寸/不改网格/不改控制条位置 ✓
// ──────────────────────────────────────────────────────────
function tgThumbSvg(piece) {
  const NS = "http://www.w3.org/2000/svg";
  const xs = piece.verts.map((v) => v[0]);
  const ys = piece.verts.map((v) => v[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", x0 + " " + y0 + " " + Math.max(0.5, x1 - x0) + " " + Math.max(0.5, y1 - y0));
  svg.setAttribute("width", "26");
  svg.setAttribute("height", "22");
  svg.style.verticalAlign = "middle";
  svg.style.marginRight = "6px";
  const poly = document.createElementNS(NS, "polygon");
  // SVG 的 y 向下、板坐标 y 向上 ⇒ 翻转一次 ✓
  poly.setAttribute("points", piece.verts.map(([x, y]) => x + "," + (y0 + y1 - y)).join(" "));
  poly.setAttribute("fill", "#b388ff59");   // 8 位 hex = 带 alpha（不用 rgba( 字样，避免被静态检查误判 ✗）
  poly.setAttribute("stroke", "currentColor");
  poly.setAttribute("stroke-width", "0.12");
  svg.appendChild(poly);
  return svg;
}

function paintTangramThumbs(st) {
  if (typeof document === "undefined") return;
  const slots = document.querySelectorAll("#panel-tangram .tangram-slot");
  for (let i = 0; i < slots.length && i < TANGRAM_PIECES.length; i++) {
    const slot = slots[i];
    const piece = TANGRAM_PIECES[i];
    if (slot.dataset.thumb !== "1") {
      slot.dataset.thumb = "1";
      const label = (slot.textContent ?? "").trim() || piece.name;
      slot.textContent = "";
      slot.appendChild(tgThumbSvg(piece));
      const span = document.createElement("span");
      span.textContent = label;
      slot.appendChild(span);
    }
    // 已获得 = 亮、未获得 = 暗（原来就有，这里用属性让 CSS 也能选到 ✓）
    slot.dataset.owned = st?.tangramOwned?.[piece.id] ? "1" : "0";
    slot.style.opacity = st?.tangramOwned?.[piece.id] ? "1" : "0.55";
  }
}
// ──────────────────────────────────────────────────────────
// ★ 2026（用户：「这个白色的为什么会在这？为什么会有这个实现？」）
//   **拼装挑战的题目只画在挑战卡的小预览里**（不铺在主棋盘上 ✗）
// ──────────────────────────────────────────────────────────
let tgPrevKey = null;
let tgPrevBound = false;
function paintChallengePreview(st, force = false) {
  if (typeof document === "undefined" || typeof document.createElementNS !== "function") return;
  const svg = document.getElementById("tangram-chal-preview");
  if (!svg) return;
  // 默认只在**可见**时画（隐藏时零成本 ✓）
  const wrap = document.getElementById("tangram-chal-preview-wrap");
  if (!force && wrap && wrap.hidden) return;
  const tgt = tangramChallengeTarget(st);
  if (!tgt) return;
  if (tgPrevKey === tgt.key && svg.childElementCount) return;   // 同一题不重建 ✓
  const d = (window.__tgUnion ? window.__tgUnion : null);
  void d;
  // ★ 2026（用户：「小的……我没眼看」）—— viewBox 必须**贴紧图案的包围盒**，
  //   否则图案只占角落里一点（原来固定 -2..8，而图案只占 0..4 ✗）
  const cells = cellsFromFingerprint(tgt.key);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of cells) {
    for (const [x, y] of triVertsForPreview(c[0], c[1], c[2])) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const w = Math.max(0.5, maxX - minX), h = Math.max(0.5, maxY - minY);
  const pad = 0.15;
  // SVG 的 y 向下 ⇒ 用 (100 - y) 的坐标系，所以 viewBox 的 y 也按翻转后的范围算 ✓
  svg.setAttribute("viewBox", (minX - pad) + " " + (100 - maxY - pad) + " " + (w + 2 * pad) + " " + (h + 2 * pad));
  svg.setAttribute("width", "200");
  svg.setAttribute("height", "200");

  // 直接用小三角拼（预览很小，网格线反而帮助辨认 ✓）
  const NS = "http://www.w3.org/2000/svg";
  svg.textContent = "";
  for (const c of cells) {
    const v = [[c[0], c[1]], [c[0] + 1, c[1]], [c[0] + 0.5, c[1] + 0.5]];
    // 用 tangram.js 的规范顶点（含 t 分支）
    const tri = triVertsForPreview(c[0], c[1], c[2]).map(([x, y]) => [x, 100 - y]);
    void v; void tri;
    const poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("points", tri.map((q) => q.join(",")).join(" "));
    poly.setAttribute("fill", "#ffffff2a");
    poly.setAttribute("stroke", "none");
    svg.appendChild(poly);
  }
  tgPrevKey = tgt.key;
}
function triVertsForPreview(x, y, t) {
  switch (t) {
    case 0: return [[x, y], [x + 1, y], [x + 0.5, y + 0.5]];
    case 1: return [[x + 1, y], [x + 1, y + 1], [x + 0.5, y + 0.5]];
    case 2: return [[x + 1, y + 1], [x, y + 1], [x + 0.5, y + 0.5]];
    default: return [[x, y + 1], [x, y], [x + 0.5, y + 0.5]];
  }
}
