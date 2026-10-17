/**
 * ★★★ 2026：**七巧板棋盘 —— 画板 + 自由拖拽**（用户：「拖动指的意思就是自由拖动」）
 *
 * 面板结构（0.7.1 已有，**不新建容器** ✓）：
 *   `.tangram-svg`（viewBox = -3 -3 106 106，板坐标 = 0..100，y 轴**向下**）
 *   里面已有：`tg-frame`（目标正方形）、三条 `tg-axis`、三条 `tg-cov`（覆盖率用 dashoffset 点亮）
 *   ⇒ 本模块**只往里追加**两层 `<g>`：目标轮廓（暗）+ 玩家板块（亮）✓
 *
 * 坐标换算（唯一入口，别在别处手写）：
 *   板坐标 (x, y) ∈ [0,4]（正方形边长 4） ⇒ SVG = (x·25, 100 − y·25) ✓
 *   （y 要翻转：板原点在**左下**，SVG 原点在**左上**）
 *
 * 拖拽语义（用户裁定）：
 *   · **自由拖动**：位置是**小数**，只有松手时吸附 0.2 格（`tangram.js` 的 `snapPoint`）✓
 *   · 画布外也能放（`CANVAS_MIN..CANVAS_MAX` = −3..7），只是**覆盖率贡献 0** ✓
 *   · 拖的时候按 R / F 旋转 / 翻转 ✓
 *
 * ⚠️ 独立模块 ⇒ `ui.js` 只加两行（`bindTangramBoard` / `paintTangramBoard`）✓
 */
import {
  TANGRAM_PIECES, placePieceVerts, placementOf, snapPoint, cellsFromFingerprint,
} from "./tangram.js";
import { setTangramPlacement, tangramCoverage, tangramChallengeTarget } from "./tangram-game.js";

const SVG_NS = "http://www.w3.org/2000/svg";
/** 板坐标 → SVG 坐标（**唯一换算点**）✓ */
const toSvg = (x, y) => [x * 25, 100 - y * 25];
/** SVG 坐标 → 板坐标 ✓ */
const toBoard = (sx, sy) => [sx / 25, (100 - sy) / 25];

const PAD = 240;                       // viewBox 外扩，让 −3..7 的画布也看得见 ✓
let layerTarget = null;
let layerPieces = null;
let targetKeyCache = null;
let drag = null;                       // { id, grabDx, grabDy }
let stRef = null;                      // 由 paintTangramBoard 每帧更新（绑定发生在构建期，那时没有 state ✓）

function svgRoot() {
  return typeof document !== "undefined" ? document.querySelector("#panel-tangram .tangram-svg") : null;
}
function ensureLayers(svg) {
  if (!svg) return false;
  if (layerTarget?.isConnected && layerPieces?.isConnected) return true;
  if (typeof document === "undefined" || typeof document.createElementNS !== "function") return false;
  layerTarget = document.createElementNS(SVG_NS, "g");
  layerTarget.setAttribute("class", "tg-target-layer");
  layerPieces = document.createElementNS(SVG_NS, "g");
  layerPieces.setAttribute("class", "tg-piece-layer");
  svg.appendChild(layerTarget);
  svg.appendChild(layerPieces);
  // ⚠️ 2026 修：**不要改 viewBox** —— 原来外扩到 −9.6..9.6 会把棋盘缩成右上角一小块 ✗
  //   设计稿 §8 定的是 950px 的 svg，viewBox 保持 index.html 的 `-3 -3 106 106` ✓
  svg.style.touchAction = "none";      // 触屏拖拽必须 ✓
  return true;
}

/** 画：目标轮廓（暗，按 key 缓存）+ 玩家板块（亮）✓ 每帧调，成本 O(块数) ✓ */
/**
 * 2026（用户：「这块白色三角网格状的为什么会在这？」）——
 *   **只画并集外轮廓**：把所有小三角的边计数，出现两次的是内部共边 => 丢掉；
 *   只出现一次的才是边界 => 首尾相接成闭合折线 ✓
 *   => 一条干净外框，不再是三角网格（那是实现细节，不该出现在界面上 ✗）
 */
export function unionOutlinePath(cells, toSvgFn) {
  const keyOf = (q) => q[0].toFixed(3) + ',' + q[1].toFixed(3);
  const count = new Map();
  const pts = new Map();
  const addEdge = (a, b) => {
    const ka = keyOf(a), kb = keyOf(b);
    const ek = ka < kb ? ka + '|' + kb : kb + '|' + ka;
    count.set(ek, (count.get(ek) ?? 0) + 1);
    pts.set(ka, a); pts.set(kb, b);
  };
  for (const c of cells) {
    const v = triVerts(c[0], c[1], c[2]);
    addEdge(v[0], v[1]); addEdge(v[1], v[2]); addEdge(v[2], v[0]);
  }
  const adj = new Map();
  for (const [ek, n] of count) {
    if (n !== 1) continue;
    const parts = ek.split('|');
    if (!adj.has(parts[0])) adj.set(parts[0], []);
    if (!adj.has(parts[1])) adj.set(parts[1], []);
    adj.get(parts[0]).push(parts[1]);
    adj.get(parts[1]).push(parts[0]);
  }
  const used = new Set();
  const ekey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  let d = '';
  for (const start of adj.keys()) {
    for (const next0 of adj.get(start)) {
      if (used.has(ekey(start, next0))) continue;
      const loop = [start];
      let cur = start, nxt = next0, guard = 0;
      while (guard++ < 10000) {
        used.add(ekey(cur, nxt));
        loop.push(nxt);
        if (nxt === start) break;
        const cand = (adj.get(nxt) ?? []).filter((k) => !used.has(ekey(nxt, k)));
        if (!cand.length) break;
        cur = nxt; nxt = cand[0];
      }
      if (loop.length < 3) continue;
      const sp = loop.map((k) => toSvgFn(pts.get(k)[0], pts.get(k)[1]));
      d += 'M' + sp.map((q) => q[0] + ' ' + q[1]).join('L') + 'Z';
    }
  }
  return d;
}

export function paintTangramBoard(state) {
  if (state) stRef = state;
  const svg = svgRoot();
  if (!svg || !ensureLayers(svg)) return;

  // ★★★ 2026（用户：「这个白色的为什么会在这？为什么会有这个实现？」）——
  //   **棋盘上不画目标图案**：棋盘是给「三条轴覆盖率」用的（你摆块、盖线、拿加成），
  //   而拼装挑战的"题目"只作为**小预览**出现在挑战卡片里 ✓
  //   （原来把题目铺在主棋盘上 = 把两个机制混在一起，还糊住了覆盖率视野 ✗）
  // ② 玩家板块（每帧重建 —— 只有 ≤7 个多边形，成本可忽略 ✓）
  layerPieces.textContent = "";
  for (const p of TANGRAM_PIECES) {
    const cfg = state?.tangramPlaced?.[p.id];
    if (!cfg) continue;
    const poly = document.createElementNS(SVG_NS, "polygon");
    poly.setAttribute("points", placePieceVerts(p, cfg).map(([x, y]) => toSvg(x, y).join(",")).join(" "));
    poly.setAttribute("class", "tg-piece-poly");
    poly.dataset.piece = p.id;
    layerPieces.appendChild(poly);
  }

  // ③ 三条轴的高亮（dashoffset = 全长 × (1 − cov)）✓
  const cov = tangramCoverage(state);
  const dashes = [["tg-cov-vert", cov.vert, 100], ["tg-cov-horz", cov.horz, 100], ["tg-cov-diag", cov.diag, 141.42]];
  for (const [id, c, len] of dashes) {
    const el = document.getElementById(id);
    if (el) el.setAttribute("stroke-dashoffset", String(len * (1 - Math.min(1, Math.max(0, c)))));
  }
}

/** 小三角顶点（与 `tangram.js` 的表示一致）✓ */
function triVerts(x, y, t) {
  switch (t) {
    case 0: return [[x, y], [x + 1, y], [x + 0.5, y + 0.5]];
    case 1: return [[x + 1, y], [x + 1, y + 1], [x + 0.5, y + 0.5]];
    case 2: return [[x + 1, y + 1], [x, y + 1], [x + 0.5, y + 0.5]];
    default: return [[x, y + 1], [x, y], [x + 0.5, y + 0.5]];
  }
}

/** 绑定拖拽（只绑一次）✓ */
export function bindTangramBoard(state, commit) {
  const svg = svgRoot();
  if (!svg || svg.dataset.dragBound === "1") return false;
  if (!ensureLayers(svg)) return false;
  svg.dataset.dragBound = "1";

  const ptToBoard = (ev) => {
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const sx = vb.x + ((ev.clientX - r.left) / r.width) * vb.width;
    const sy = vb.y + ((ev.clientY - r.top) / r.height) * vb.height;
    return toBoard(sx, sy);
  };

  svg.addEventListener("pointerdown", (ev) => {
    const state = stRef;
    const poly = ev.target?.closest?.("polygon[data-piece]");
    if (!poly) return;
    const id = poly.dataset.piece;
    const cfg = placementOf(state?.tangramPlaced, id);
    const [bx, by] = ptToBoard(ev);
    drag = { id, grabDx: bx - Number(cfg.dx ?? 0), grabDy: by - Number(cfg.dy ?? 0) };
    poly.classList.add("dragging");
    svg.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
  });

  svg.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const state = stRef;
    const [bx, by] = ptToBoard(ev);
    // 自由拖动：**不吸附**（小数直接给），合法性由 `setTangramPlacement` 判（画布内 + 不重叠）✓
    setTangramPlacement(state, drag.id, { dx: bx - drag.grabDx, dy: by - drag.grabDy });
    paintTangramBoard(state);
  });

  const finish = (ev) => {
    if (!drag) return;
    const state = stRef;
    const cfg = placementOf(state?.tangramPlaced, drag.id);
    // 松手：吸附到 0.2 格（`snapPoint` 的半径在 tangram.js 里定）✓
    const [sx, sy] = snapPoint(Number(cfg.dx ?? 0), Number(cfg.dy ?? 0));
    setTangramPlacement(state, drag.id, { dx: sx, dy: sy });
    drag = null;
    svg.releasePointerCapture?.(ev?.pointerId);
    commit?.();
  };
  svg.addEventListener("pointerup", finish);
  svg.addEventListener("pointercancel", finish);

  // 拖拽中按 R / F ⇒ 旋转 / 翻转（用户原话：「拖的时候也能转」）✓
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", (ev) => {
      if (!drag) return;
      const state = stRef;
      if (ev.key === "r" || ev.key === "R") {
        const cfg = placementOf(state?.tangramPlaced, drag.id);
        setTangramPlacement(state, drag.id, { rot: Number(cfg.rot ?? 0) + 1 });
        paintTangramBoard(state);
        ev.preventDefault();
      } else if (ev.key === "f" || ev.key === "F") {
        const cfg = placementOf(state?.tangramPlaced, drag.id);
        setTangramPlacement(state, drag.id, { flip: !cfg.flip });
        paintTangramBoard(state);
        ev.preventDefault();
      }
    });
  }
  return true;
}
