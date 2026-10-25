#!/usr/bin/env node
/**
 * tools/tangram-patterns.mjs —— **七巧板图案枚举器 v4（方案 A 的最后一击 / 兼方案 B 的退路）**
 *
 * 目标：产出**真实、可验证**的七巧板图案池（每个图案 = 一次精确的七块拼合）✓
 *   严格自检：**凸轮廓 = 13**（七巧板已知结论）⇒ 达到才说明"枚举完整" ✓
 *   退路（方案 B）：即使**不完整**，只要收出 **≥108** 个真图案，就能按实际池子分 6 档 ✓
 *
 * ── 前三代的教训（留在这里，比代码重要）──
 *   v1 顺序 DFS 无剪枝          ⇒ 6s 撞 6 万状态，未收敛 ✗
 *   v2 装配状态去重 + 8 对称     ⇒ 400k 状态 / 57k 怪图案 / **凸=0**（允许只共顶点 ⇒ 枝杈爆炸）✗
 *   v3 共边 + 分层 BFS          ⇒ 层次清楚了（d=2:20 → d=3:502 → d=4:9463 → d=5:60354）
 *                                  但 d=5 就 6 万+、d=6/7 到百万级 ⇒ **穷举在 JS 里不可行** ✗
 *   ⇒ 所以 v4 **不再追求穷举**：固定顺序 + 共边 + 包围盒 + 时间预算，**收到多少算多少** ✓
 *
 * 用法：node tools/tangram-patterns.mjs [--check] [--seconds N] [--nodes N]
 */
import { TANGRAM_PIECES, placePieceVerts, pointInConvex, polygonArea } from "../src/tangram/core.js";

const has = (f) => process.argv.includes(f);
const argNum = (f, dflt) => {
  const i = process.argv.indexOf(f);
  return i > 0 ? Number(process.argv[i + 1]) || dflt : dflt;
};
const check = has("--check");
const SECONDS = argNum("--seconds", 20);
const MAX_NODES = argNum("--nodes", 20000000);

// ══════════ 细三角格（精确表示）══════════
const triVerts = (x, y, t) => {
  switch (t) {
    case 0: return [[x, y], [x + 1, y], [x + 0.5, y + 0.5]];
    case 1: return [[x + 1, y], [x + 1, y + 1], [x + 0.5, y + 0.5]];
    case 2: return [[x + 1, y + 1], [x, y + 1], [x + 0.5, y + 0.5]];
    default: return [[x, y + 1], [x, y], [x + 0.5, y + 0.5]];
  }
};
const triCenters = (x, y) => [
  [x + 0.5, y + 1 / 3], [x + 2 / 3, y + 0.5], [x + 0.5, y + 2 / 3], [x + 1 / 3, y + 0.5],
];
function pieceCells(verts) {
  const xs = verts.map((p) => p[0]);
  const ys = verts.map((p) => p[1]);
  const out = [];
  for (let x = Math.floor(Math.min(...xs)); x < Math.ceil(Math.max(...xs)); x++) {
    for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y++) {
      const cs = triCenters(x, y);
      for (let t = 0; t < 4; t++) if (pointInConvex(verts, cs[t])) out.push([x, y, t]);
    }
  }
  return out;
}
const ck = (c) => `${c[0]},${c[1]},${c[2]}`;
function edgeKeys(cells) {
  const out = new Set();
  for (const [x, y, t] of cells) {
    const v = triVerts(x, y, t).map(([px, py]) => [Math.round(px * 2), Math.round(py * 2)]);
    for (let i = 0; i < 3; i++) {
      const a = v[i]; const b = v[(i + 1) % 3];
      const ka = `${a[0]},${a[1]}`; const kb = `${b[0]},${b[1]}`;
      out.add(ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`);
    }
  }
  return out;
}

// ══════════ 8 对称规范化 ══════════
const T8 = [];
for (let r = 0; r < 4; r++) for (const f of [false, true]) T8.push({ r, f });
function transformCell([x, y, t], { r, f }) {
  let nx = x, ny = y, nt = t;
  if (f) { nx = -x - 1; nt = [0, 3, 2, 1][nt]; }
  for (let i = 0; i < r; i++) { const tx = -ny; const ty = nx; nx = tx; ny = ty; nt = (nt + 1) % 4; }
  return [nx, ny, nt];
}
function canon8(cells) {
  let best = null;
  for (const tr of T8) {
    const arr = cells.map((c) => transformCell(c, tr));
    const minX = Math.min(...arr.map((p) => p[0]));
    const minY = Math.min(...arr.map((p) => p[1]));
    const k = arr.map(([x, y, t]) => `${x - minX},${y - minY},${t}`).sort().join("|");
    if (best === null || k < best) best = k;
  }
  return best;
}
const canon1 = (cells) => {
  const minX = Math.min(...cells.map((p) => p[0]));
  const minY = Math.min(...cells.map((p) => p[1]));
  return cells.map(([x, y, t]) => `${x - minX},${y - minY},${t}`).sort().join("|");
};

function analyze(cells) {
  const uniq = [...new Map(cells.map((c) => [ck(c), c])).values()];
  const area = uniq.length / 4;
  const pts = new Set();
  for (const [x, y, t] of uniq) for (const [px, py] of triVerts(x, y, t)) pts.add(`${px},${py}`);
  const list = [...pts].map((s) => s.split(",").map(Number));
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const sorted = list.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (seq) => {
    const h = [];
    for (const p of seq) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  const hullArea = Math.abs(polygonArea(half(sorted).concat(half(sorted.slice().reverse()))));
  const cnt = new Map();
  for (const [x, y, t] of uniq) {
    const v = triVerts(x, y, t).map(([px, py]) => [Math.round(px * 2), Math.round(py * 2)]);
    for (let i = 0; i < 3; i++) {
      const a = v[i]; const b = v[(i + 1) % 3];
      const ka = `${a[0]},${a[1]}`; const kb = `${b[0]},${b[1]}`;
      const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      cnt.set(k, (cnt.get(k) ?? 0) + 1);
    }
  }
  let boundary = 0;
  for (const n of cnt.values()) if (n === 1) boundary++;
  return { uniq, area, convex: Math.abs(hullArea - area) < 1e-9, boundary };
}

// ══════════ 自检 ══════════
{
  const all = [];
  for (const p of TANGRAM_PIECES) all.push(...pieceCells(p.verts));
  const a = analyze(all);
  const ok = a.uniq.length === 64 && all.length === 64 && a.convex && Math.abs(a.area - 16) < 1e-9;
  console.log("=".repeat(92));
  console.log("七巧板图案枚举器 v4（固定顺序 DFS + 共边 + 包围盒 + 时间预算）");
  console.log("=".repeat(92));
  console.log(`  自检·经典正方形：小三角 ${a.uniq.length}/64｜重叠 ${all.length - a.uniq.length}｜面积 ${a.area}｜凸 ${a.convex}`);
  console.log(`  ${ok ? "✅ 自检通过" : "❌ 自检失败"}`);
  if (!ok) process.exit(1);
  if (check) { console.log("  （--check 只跑自检）"); process.exit(0); }
  console.log();
}

// ══════════ 固定顺序 DFS（大块先放）══════════
const ORDER = [0, 1, 2, 5, 6, 3, 4];      // largeA, largeB, medium, square, para, smallA, smallB
const dirs = [];
for (let r = 0; r < 4; r++) for (const f of [false, true]) dirs.push({ rot: r, flip: f });
const P = TANGRAM_PIECES;
const BOX = 8;
const baseCache = new Map();

const t0 = Date.now();
let nodes = 0;
let done = false;
const shapes = new Map();

function baseOf(pieceIdx, d) {
  const key = `${pieceIdx}|${d.rot}|${d.flip}`;
  let e = baseCache.get(key);
  if (!e) {
    const base = placePieceVerts(P[pieceIdx], { ...d, dx: 0, dy: 0 });
    const cells = pieceCells(base);
    e = { base, cells, edges: edgeKeys(cells) };
    baseCache.set(key, e);
  }
  return e;
}

function candidatesFor(i, unionEdges, unionVerts) {
  const out = [];
  const seen = new Set();
  for (const d of dirs) {
    const e = baseOf(ORDER[i], d);
    for (const pv of e.base) {
      for (const uv of unionVerts) {
        const dx = uv[0] - pv[0];
        const dy = uv[1] - pv[1];
        const kk = `${d.rot},${d.flip},${dx},${dy}`;
        if (seen.has(kk)) continue;
        seen.add(kk);
        const cells = e.cells.map(([x, y, t]) => [x + dx, y + dy, t]);
        const e2 = edgeKeys(cells);
        let hit = false;
        for (const k of e2) if (unionEdges.has(k)) { hit = true; break; }
        if (!hit) continue;                       // 必须**共边** ✓
        out.push({ cells, edges: e2, verts: e.base.map(([x, y]) => [x + dx, y + dy]) });
      }
    }
  }
  return out;
}

function dfs(i, usedSet, cells, edges, verts) {
  if (done) return;
  nodes++;
  if (nodes > MAX_NODES) { done = true; return; }
  if ((nodes & 0x3ff) === 0 && Date.now() - t0 > SECONDS * 1000) { done = true; return; }
  if (i === ORDER.length) {
    const k8 = canon8(cells);
    const k1 = canon1(cells);
    const rec = shapes.get(k8);
    if (rec) rec.ways.add(k1);
    else shapes.set(k8, { cells: cells.slice(), ways: new Set([k1]) });
    return;
  }
  for (const cand of candidatesFor(i, edges, verts)) {
    let overlap = false;
    for (const c of cand.cells) if (usedSet.has(ck(c))) { overlap = true; break; }
    if (overlap) continue;
    let minX = 99, maxX = -99, minY = 99, maxY = -99;
    for (const [x, y] of cand.verts) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (maxX - minX > BOX || maxY - minY > BOX) continue;
    for (const c of cand.cells) usedSet.add(ck(c));
    cells.push(...cand.cells);
    const edges2 = new Set(edges);
    for (const e of cand.edges) edges2.add(e);
    dfs(i + 1, usedSet, cells, edges2, verts.concat(cand.verts));
    cells.length -= cand.cells.length;
    for (const c of cand.cells) usedSet.delete(ck(c));
    if (done) return;
  }
}

const seedV = P[0].verts;
const seedCells = pieceCells(seedV);
dfs(1, new Set(seedCells.map(ck)), seedCells.slice(), edgeKeys(seedCells), seedV.slice());

const ms = Date.now() - t0;
const patterns = [...shapes.values()].map((rec) => {
  const a = analyze(rec.cells);
  return { ways: rec.ways.size, convex: a.convex, boundary: a.boundary, area: a.area, cells: rec.cells };   // ⚠️ 必须带 cells：写库时要算 canon8 键
});
const convex = patterns.filter((p) => p.convex);
const areaOk = patterns.every((p) => Math.abs(p.area - 16) < 1e-9);
const byBoundary = {};
for (const p of patterns) byBoundary[p.boundary] = (byBoundary[p.boundary] ?? 0) + 1;

console.log(`  枚举：节点 ${nodes}${done ? "（**被预算截断**）" : "（完整）"}｜耗时 ${(ms / 1000).toFixed(1)}s`);
console.log(`  完整装配（canon8 去重后）= ${patterns.length}｜面积全 16 = ${areaOk}`);
console.log(`  **凸轮廓 = ${convex.length}**（已知结论：13）`);
console.log(`  轮廓边段数分布：${Object.entries(byBoundary).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join("  ")}`);
console.log();
const strict = !done && convex.length === 13 && areaOk;
console.log(`  严格自检（凸=13）：${strict ? "✅ 通过" : `⚠️ 未过（凸 ${convex.length}${done ? "、且被截断" : ""}）`}`);
console.log(`  方案 B 退路（≥108 个真图案）：${patterns.length >= 108 ? `✅ 满足（${patterns.length} 个）` : `❌ 不足（${patterns.length} 个）`}`);

// ★★★ 2026：**方案 B**（用户裁定 A 不行就走 B）—— 用**实际池子**分 6 档、写 108 个 ✓
//   难度判据（§0.3）：解法数（越少越难）＞ 轮廓边段数（越多越难）＞ 凸（凸=易）
//   ⇒ 先按「凸」+「解法数」+「边段数」算一个可分排序的分数，再**按分位切 6 档**、
//     每档取 **18** 个（入场 6 + 储备 12）✓
if (has("--write")) {
  const fs = await import("node:fs");
  // ★★★ 2026（用户：「都做了吧」）**挑战分档标定**——
  //   ⚠️ 不能用 `ways`（解法数）当主判据：本池子是**截断枚举**，`ways` 只是"碰巧被走了几次"⇒ 不可信 ✗
  //   ⇒ 用池子里**可信**的两个量：**轮廓边段数**（越少越简单）＋ **凸性**（凸 = 简单）✓
  //   分数大 = 越简单；6 档按**分位数**切（保证每档数量相当）✓
  const score = (p) => (p.convex ? 1000 : 0) - p.boundary;
  const sorted = patterns.slice().sort((a, b) => score(b) - score(a));   // 分数高 = 越易
  const per = 18;
  if (sorted.length < per * 6) {
    console.log(`  ❌ 池子只有 ${sorted.length} 个，连 6×18=108 都凑不齐 ⇒ 不写 ✗`);
    process.exit(1);
  }
  const picked = [];
  for (let d = 0; d < 6; d++) {
    // 第 d 档：从池子里**均匀取一段**（越往后越难）✓
    const from = Math.floor((d * sorted.length) / 6);
    const to = Math.floor(((d + 1) * sorted.length) / 6);
    const seg = sorted.slice(from, to);
    const step = Math.max(1, Math.floor(seg.length / per));
    for (let k = 0, got = 0; k < seg.length && got < per; k += step, got++) {
      const p = seg[k];
      picked.push({ d, ways: p.ways, convex: p.convex, boundary: p.boundary, key: canon8(p.cells ?? []) });
    }
  }
  const lines = picked.map((p) => `  { d: ${p.d}, ways: ${p.ways}, convex: ${p.convex}, boundary: ${p.boundary}, key: ${JSON.stringify(p.key)} },`);
  const body = `/**
 * ⚠️ **自动生成，别手改** —— 由 node tools/tangram-patterns.mjs --write 生成 ✓
 *
 * 七巧板图案库（**方案 B**：用户裁定"枚举穷举不可行就走 B"）——
 *   来源 = 枚举器 v4 收到的**真实完整装配**（每个都是精确的七块拼合、面积全 16 ✓）
 *   分档 = 6 档 × 18 个（入场 6 + 储备 12），按 docs/TANGRAM.md §10 的判据排序切段 ✓
 *
 * ⚠️ **严格自检未过**：凸轮廓只有 ${convex.length} 个（已知应为 13）⇒ 本池子**不是完整枚举**，
 *   只是"够用的真图案"（${patterns.length} 个里选 108）✓ 将来算法更强可重新生成替换 ✓
 * \`key\` = 8 对称规范化后的小三角键（可直接当"图案指纹"用于校验/去重）✓
 */
export const TANGRAM_PATTERN_LIBRARY = {
  generated: { pool: ${patterns.length}, convex: ${convex.length}, perDifficulty: ${per}, difficulties: 6 },
  patterns: [
${lines.join("\n")}
  ],
};
`;
  fs.writeFileSync(new URL("../src/tangram-pattern-library.js", import.meta.url), body);
  console.log(`  ✅ 已写出 108 个图案 → src/tangram-pattern-library.js（6 档 × 18）✓`);
}

process.exit(strict || patterns.length >= 108 ? 0 : 1);
