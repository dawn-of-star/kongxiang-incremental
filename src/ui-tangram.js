/**
 * ★★★ 2026：**七巧板面板的 UI**（独立模块 —— 只在 `ui.js` 里加两行调用）
 *
 * ⚠️ 设计原则（本轮教训）：**不往 `ui.js` / `index.html` 的大结构里塞东西** ✗
 *   ⇒ 面板内容全部由本模块**在运行时建**，宿主只需要一个空容器 `#tangram-root` ✓
 *   ⇒ 删/改这一整块只影响本文件 ✓
 *
 * 交互（按钮版；拖拽留给下一步）：
 *   · 获取卡片：一次只对"下一块"（第一块还没拿到的），[抽 N] [兑 M] ＋ 保底进度条 ✓
 *   · 托盘 7 格：点亮 = 已获得；点一下 = 选中 ✓
 *   · 选中后：◀ ▶ ▼ ▲ 移动 / R 转 / F 翻 / 放下 / 收回 ✓
 *   · 棋盘：目标轮廓（暗）＋ 已放下板块（亮），覆盖率三轴读数 ✓
 *   · 拼装挑战：目标难度/解法数、是否拼对、【下一题】、【重置棋盘】✓
 */
import {
  TANGRAM_PIECES, TANGRAM_CHALLENGE, tangramPricesAt,
  tangramPieceAtStep, tangramPatternsPerDifficulty,
  placePieceVerts, placementOf, cellsFromFingerprint,
} from "./tangram.js";
import {
  drawTangramPiece, exchangeTangramPiece, tangramCoverage,
  setTangramPlacement, moveTangramPlacement, rotateTangramPlacement, flipTangramPlacement,
  takeTangramBack, resetTangramBoard, autoPlaceTangram,
  tangramChallengeTarget, tangramChallengeSolved, tangramAdvanceChallenge,
  tangramPriceFactor,
} from "./tangram-game.js";
import { sci } from "./format.js";

const $id = (i) => document.getElementById(i);
let sel = null;              // 当前选中的块 id
let targetCache = null;      // { key } = 上次画的目标（避免每帧重建 DOM）
let commitCb = null;         // main.js 注入的"存档 + 重绘"回调

/** 只建一次（容器空的时候建）✓ */
export function buildTangramUI(commit) {
  commitCb = commit;
  const root = $id("tangram-root");
  if (!root || root.dataset.built === "1") return;
  root.dataset.built = "1";
  root.innerHTML = [
    '<p class="note" id="tg-ep-line"></p>',
    '<div class="card">',
    '  <h2>获取巧板 <span class="badge" id="tg-acq-name">—</span></h2>',
    '  <div class="tg-bar"><i id="tg-acq-fill"></i></div>',
    '  <div class="tg-row">',
    '    <button class="btn" id="tg-draw">抽</button>',
    '    <button class="btn" id="tg-ex">兑</button>',
    '    <span class="dim" id="tg-pity"></span>',
    '  </div>',
    '</div>',
    '<div class="card">',
    '  <h2>托盘 <span class="badge" id="tg-count">0 / 7</span></h2>',
    '  <div class="tg-slots" id="tg-slots"></div>',
    '  <div class="tg-row" id="tg-ctrls">',
    '    <button class="btn btn-small" data-tg="left">◀</button>',
    '    <button class="btn btn-small" data-tg="right">▶</button>',
    '    <button class="btn btn-small" data-tg="down">▼</button>',
    '    <button class="btn btn-small" data-tg="up">▲</button>',
    '    <button class="btn btn-small" data-tg="rot">R 转</button>',
    '    <button class="btn btn-small" data-tg="flip">F 翻</button>',
    '    <button class="btn btn-small" data-tg="place">放下</button>',
    '    <button class="btn btn-small" data-tg="back">收回</button>',
    '  </div>',
    '  <svg class="tg-board" viewBox="-3 -3 106 106">',
    '    <g id="tg-target"></g><g id="tg-pieces"></g>',
    '    <rect class="tg-frame" x="0" y="0" width="100" height="100"></rect>',
    '  </svg>',
    '  <p class="note" id="tg-cov">三轴覆盖率 —</p>',
    '</div>',
    '<div class="card">',
    '  <h2>拼装挑战</h2>',
    '  <p class="note" id="tg-chal"></p>',
    '  <div class="tg-row">',
    '    <button class="btn" id="tg-next">下一题</button>',
    '    <button class="btn" id="tg-reset">重置棋盘</button>',
    '  </div>',
    '</div>',
  ].join("\n");

  // 事件（一次性委托，重建也不丢 ✓）
  root.addEventListener("click", (ev) => {
    const b = ev.target?.closest?.("button");
    if (!b) return;
    const act = b.dataset?.tg;
    if (act && sel) {
      const cur = placementOf(tangramPlacedRef?.(sel), sel);
      void cur;
      const map = {
        left: () => moveTangramPlacement(stateRef, sel, -1, 0),
        right: () => moveTangramPlacement(stateRef, sel, 1, 0),
        down: () => moveTangramPlacement(stateRef, sel, 0, -1),
        up: () => moveTangramPlacement(stateRef, sel, 0, 1),
        rot: () => rotateTangramPlacement(stateRef, sel, 1),
        flip: () => flipTangramPlacement(stateRef, sel),
        place: () => autoPlaceTangram(stateRef, sel),
        back: () => takeTangramBack(stateRef, sel),
      };
      map[act]?.();
      commitCb?.();
      return;
    }
    if (b.id === "tg-draw" || b.id === "tg-ex") {
      const st = nextStep(stateRef);
      if (st < 0) return;
      (b.id === "tg-draw" ? drawTangramPiece : exchangeTangramPiece)(stateRef, st);
      commitCb?.();
      return;
    }
    if (b.id === "tg-next") { tangramAdvanceChallenge(stateRef); commitCb?.(); return; }
    if (b.id === "tg-reset") { resetTangramBoard(stateRef); commitCb?.(); return; }
    const slot = b.dataset?.slot;
    if (slot && stateRef?.tangramOwned?.[slot]) { sel = slot; commitCb?.(); }
  });
}

// 渲染时用的当前 state 引用（由 `renderTangram(state)` 更新）
let stateRef = null;
let tangramPlacedRef = (id) => stateRef?.tangramPlaced?.[id];

/** 下一块（按面积从小到大）= 获取目标 */
function nextStep(state) {
  for (let step = 0; step < TANGRAM_CHALLENGE.difficulties.length * 0 + 7; step++) {
    const pc = tangramPieceAtStep(step);
    if (!pc) return -1;
    if (!state?.tangramOwned?.[pc.id]) return step;
  }
  return -1;
}

/** 每帧调用（只更新文本/属性，**不重建 DOM 结构**）✓ */
export function renderTangram(state) {
  stateRef = state;
  const root = $id("tangram-root");
  if (!root || root.dataset.built !== "1") return;
  const ownedN = TANGRAM_PIECES.filter((p) => state.tangramOwned?.[p.id]).length;

  if ($id("tg-ep-line")) $id("tg-ep-line").textContent = `永恒点 EP ${sci(state.eternityPoints ?? 0)} ｜ 挑战折扣 ×${tangramPriceFactor(state).toFixed(2)}`;
  if ($id("tg-count")) $id("tg-count").textContent = `${ownedN} / 7`;

  // 获取卡片
  const step = nextStep(state);
  const pc = step >= 0 ? tangramPieceAtStep(step) : null;
  if ($id("tg-acq-name")) $id("tg-acq-name").textContent = pc ? pc.name : "七块已集齐";
  if (pc) {
    const pr = tangramPricesAt(step);
    const f = tangramPriceFactor(state);
    const pity = Math.max(0, Math.floor(Number(state.tangramPity?.[pc.id] ?? 0)));
    if ($id("tg-draw")) { $id("tg-draw").textContent = `抽 ${sci(Number(pr.draw) * f)}`; $id("tg-draw").disabled = (state.eternityPoints ?? 0) < Number(pr.draw) * f; }
    if ($id("tg-ex")) { $id("tg-ex").textContent = `兑 ${sci(Number(pr.exchange) * f)}`; $id("tg-ex").disabled = (state.eternityPoints ?? 0) < Number(pr.exchange) * f; }
    if ($id("tg-pity")) $id("tg-pity").textContent = `保底 ${pity}/${pr.pity}`;
    if ($id("tg-acq-fill")) $id("tg-acq-fill").style.width = `${(pity / pr.pity) * 100}%`;
  } else {
    if ($id("tg-draw")) $id("tg-draw").disabled = true;
    if ($id("tg-ex")) $id("tg-ex").disabled = true;
    if ($id("tg-pity")) $id("tg-pity").textContent = "";
    if ($id("tg-acq-fill")) $id("tg-acq-fill").style.width = "0%";
  }

  // 托盘（7 格，只建一次）
  const slots = $id("tg-slots");
  if (slots && slots.childElementCount === 0) {
    for (let i = 0; i < TANGRAM_PIECES.length; i++) {
      const b = document.createElement("button");
      b.className = "btn btn-small tg-slot";
      b.dataset.slot = TANGRAM_PIECES[i].id;
      b.textContent = TANGRAM_PIECES[i].name;
      slots.appendChild(b);
    }
  }
  if (slots) {
    for (let i = 0; i < TANGRAM_PIECES.length; i++) {
      const b = slots.children[i];
      if (!b) continue;
      const owned = !!state.tangramOwned?.[TANGRAM_PIECES[i].id];
      b.classList.toggle("owned", owned);
      b.classList.toggle("sel", sel === TANGRAM_PIECES[i].id);
    }
  }

  // 覆盖率
  const cov = tangramCoverage(state);
  if ($id("tg-cov")) {
    $id("tg-cov").textContent = `三轴覆盖率：纵 ${(cov.vert * 100).toFixed(0)}% ｜ 横 ${(cov.horz * 100).toFixed(0)}% ｜ 斜 ${(cov.diag * 100).toFixed(0)}%`;
  }

  // 棋盘：目标（缓存） + 已放下的板块
  const tgt = tangramChallengeTarget(state);
  const gT = $id("tg-target");
  if (gT && tgt && (!targetCache || targetCache.key !== tgt.key) && typeof document.createElementNS === "function") {
    const d = cellsFromFingerprint(tgt.key).map((c) => {
      const v = triPts(c[0], c[1], c[2]).map(([x, y]) => [x * 25, 100 - y * 25]);
      return `M${v[0][0]} ${v[0][1]}L${v[1][0]} ${v[1][1]}L${v[2][0]} ${v[2][1]}Z`;
    }).join("");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "tg-target");
    gT.textContent = "";
    gT.appendChild(path);
    targetCache = { key: tgt.key };
  }
  const gP = $id("tg-pieces");
  if (gP && typeof document.createElementNS === "function") {
    gP.textContent = "";
    for (const p of TANGRAM_PIECES) {
      const cfg = state.tangramPlaced?.[p.id];
      if (!cfg) continue;
      const v = placePieceVerts(p, cfg).map(([x, y]) => [x * 25, 100 - y * 25]);
      const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      poly.setAttribute("points", v.map((q) => q.join(",")).join(" "));
      poly.setAttribute("class", "tg-piece");
      gP.appendChild(poly);
    }
  }

  // 挑战状态
  if ($id("tg-chal")) {
    const ok = tangramChallengeSolved(state);
    $id("tg-chal").textContent = tgt
      ? `难度 ${tgt.d + 1} ｜ 解法 ${tgt.ways} 种 ｜ 轮廓边段 ${tgt.boundary} ｜ ${ok ? "已拼对！点【下一题】" : "未拼对"}`
      : "—";
  }
  if ($id("tg-next")) $id("tg-next").disabled = !tangramChallengeSolved(state);
}

/** 小三角的三个顶点（棋盘坐标；与 tangram.js 的表示一致）✓ */
function triPts(x, y, t) {
  switch (t) {
    case 0: return [[x, y], [x + 1, y], [x + 0.5, y + 0.5]];
    case 1: return [[x + 1, y], [x + 1, y + 1], [x + 0.5, y + 0.5]];
    case 2: return [[x + 1, y + 1], [x, y + 1], [x + 0.5, y + 0.5]];
    default: return [[x, y + 1], [x, y], [x + 0.5, y + 0.5]];
  }
}

export { tangramPatternsPerDifficulty, TANGRAM_CHALLENGE };
