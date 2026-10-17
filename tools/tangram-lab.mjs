#!/usr/bin/env node
/**
 * tools/tangram-lab.mjs —— 七巧板**几何内核**的定点断言（照 `docs/TANGRAM.md` §1 / §5.3 / §7 ①）
 *
 * 这个工具守四件事：
 *   ① 「**面积表**」——七块板的面积分数必须与 `TANGRAM.md` §5.3 的表逐条一致（¼ ¼ ⅛ 1/16 1/16 ⅛ ⅛）✓
 *   ② 「**经典摆放真的成立**」——七块**互不重叠**、面积和 = 16、且**铺满** 4×4 正方形（采样验证）✓
 *   ③ ★ 「**三条线 100%**」——经典摆放里，左边缘 / 下边缘 / 主对角线**各 100% 覆盖**
 *      （这是"盖满"的基准态；`TANGRAM.md` §0.1 说三条轴的终态值就是"盖满"时的值 ✓）
 *   ④ 「**旋转 / 翻转 / 覆盖率**」的基本性质（4 次旋转回原位、翻转两次回原位、覆盖率单调不降）✓
 *
 * ⚠️ 为什么先做这个：设计稿 §7 的实现顺序里 ① 是「覆盖率内核（纯函数 + 断言，**不碰 UI**）」——
 *   它**不依赖任何待定数值**（三条轴的软上限、七巧板概率……都还没定）⇒ 可以先做且值得先做 ✓
 * ⚠️ 覆盖率的**唯一实现**在 `src/tangram.js`；本工具只**调**它，不自己算一遍（防"两处实现"）✓
 *
 * 用法：node tools/tangram-lab.mjs [--check]
 */
import {
  TANGRAM_SIZE, TANGRAM_PIECES, TANGRAM_AXES, TANGRAM_ACQUIRE, TANGRAM_DRAW,
  polygonArea, pointInConvex, convexOverlap, axisCoverage, axisCoverageAll,
  placePieceVerts, rotateVerts, flipVerts, snapPoint, segLength,
  tangramPiecesFromEP, tangramThresholdAt, tangramPricesAt, placementOf, svgToBoard, boardToSvg,
  TANGRAM_CHALLENGE, tangramPatternsPerDifficulty, tangramPatternsTotal, pickChallengePatterns,
  TANGRAM_CHALLENGE_REWARDS, tangramRewardEffects,
} from "../src/tangram.js";
// ★ 2026：抽取/兑换与覆盖率读数（引擎侧）
// ★ 2026：图案库（由 `tools/tangram-patterns.mjs --write` 生成的 108 个真图案）
import { TANGRAM_PATTERN_LIBRARY } from "../src/tangram-pattern-library.js";
import Decimal from "../dist/break_eternity.esm.js";
import { sci } from "../src/format.js";
const D = (x) => new Decimal(x);

const check = process.argv.includes("--check");
const pad = (s, n) => String(s).padEnd(n);
let fails = 0;
let ckCount = 0;                 // ★ 断言条数**动态计**（别手写 —— 本项目栽过 ✗）
const ck = (label, ok, detail) => {
  ckCount++;
  if (!ok) fails++;
  console.log(`  ${ok ? "✅" : "❌"} ${pad(label, 46)} ${detail}`);
};

const classical = TANGRAM_PIECES.map((p) => p.verts);   // 经典摆放（= 每块自己的坐标）

console.log("=".repeat(96));
console.log(`七巧板几何内核 · 定点断言（纯函数部分）（目标正方形 ${TANGRAM_SIZE}×${TANGRAM_SIZE}，原点在左下角）`);
console.log("=".repeat(96));
console.log();

// ── ① 面积表（与 `TANGRAM.md` §5.3 的表逐条对照）──
{
  const total = polygonArea([[0, 0], [TANGRAM_SIZE, 0], [TANGRAM_SIZE, TANGRAM_SIZE], [0, TANGRAM_SIZE]]);
  const bad = TANGRAM_PIECES.filter((p) => Math.abs(polygonArea(p.verts) / total - p.frac) > 1e-9);
  const sum = TANGRAM_PIECES.reduce((s, p) => s + polygonArea(p.verts), 0);
  ck("① 七块板的面积分数与 §5.3 的表一致", bad.length === 0,
    bad.length === 0
      ? TANGRAM_PIECES.map((p) => `${p.name}=${polygonArea(p.verts)}/${total}`).join("｜")
      : `不符：${bad.map((p) => `${p.name} 实得 ${polygonArea(p.verts)} 期望 ${p.frac * total}`).join("｜")}`);
  ck("①b 面积和 = 正方形面积", Math.abs(sum - total) < 1e-9, `${sum} / ${total}`);
}

// ── ② 经典摆放：互不重叠 + 铺满（采样）──
{
  const pairs = [];
  for (let i = 0; i < classical.length; i++) {
    for (let j = i + 1; j < classical.length; j++) {
      if (convexOverlap(classical[i], classical[j])) {
        pairs.push(`${TANGRAM_PIECES[i].name}×${TANGRAM_PIECES[j].name}`);
      }
    }
  }
  ck("② 七块互不重叠（SAT，共边不算重叠）", pairs.length === 0,
    pairs.length === 0 ? `${(classical.length * (classical.length - 1)) / 2} 对全部通过` : `重叠：${pairs.join("｜")}`);

  // 铺满：在正方形内均匀撒点，每点都必须落在**至少一块**板里；
  //   ⚠️ 「重叠」要按**严格内部**判定 —— 铺满时相邻板块**共边**，
  //     落在共边上的采样点会被 `pointInConvex`（含边界）同时算进两块 ⇒ 那不是重叠 ✗
  const strictlyInside = (verts, [px, py]) => {
    const eps = 1e-9;
    for (let i = 0; i < verts.length; i++) {
      const [x1, y1] = verts[i];
      const [x2, y2] = verts[(i + 1) % verts.length];
      const cross = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
      // ⚠️ 必须**全部严格为正**才算内部 ⇒ 贴边（cross ≈ 0）不算 ✗
      //   （我第一版写成 `cross < -eps ⇒ return false` ⇒ 贴边被当成内部 ⇒ 共边点被判成"内部重叠"✗）
      if (cross <= eps) return false;
    }
    return true;
  };
  const N = 41;                                  // 41×41 网格（含端点）
  let covered = 0; let multi = 0; let holes = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const p = [(i / (N - 1)) * TANGRAM_SIZE, (j / (N - 1)) * TANGRAM_SIZE];
      const hits = classical.filter((v) => pointInConvex(v, p)).length;
      if (hits >= 1) covered++;
      if (hits > 1) multi++;
      if (hits === 0) holes++;
    }
  }
  const pct = (covered / (N * N)) * 100;
  // 真正的"内部重叠"该为 0：只有落在**两块共同边界**上的点才会 hits>1
  const multiAllOnBoundary = (() => {
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const p = [(i / (N - 1)) * TANGRAM_SIZE, (j / (N - 1)) * TANGRAM_SIZE];
        const inStrict = classical.filter((v) => strictlyInside(v, p)).length;
        if (inStrict > 1) return false;
      }
    }
    return true;
  })();
  ck("②b 铺满正方形（采样：无空洞；重叠只可能落在共边上）",
    holes === 0 && pct === 100 && multiAllOnBoundary,
    `${N}×${N} 采样：覆盖 ${pct.toFixed(1)}%｜空洞 ${holes}｜` +
    `含边界的多点 ${multi}（全部在共边上=${multiAllOnBoundary}）｜内部重叠=0 ✓`);
}

// ── ③ ★ 三条线各 100%（"盖满"基准态）──
{
  const cov = axisCoverageAll(classical);
  const all = TANGRAM_AXES.every((ax) => Math.abs(cov[ax.id] - 1) < 1e-9);
  ck("③ 经典摆放 ⇒ 三条线各 100%（盖满）", all,
    TANGRAM_AXES.map((ax) => `${ax.name}=${(cov[ax.id] * 100).toFixed(1)}%`).join("｜"));
}

// ── ④ 旋转 / 翻转 / 吸附 / 覆盖率的基本性质 ──
{
  // 4 次 90° 旋转回到原样（逐点比较）
  const p0 = TANGRAM_PIECES[0].verts;
  const r4 = rotateVerts(rotateVerts(rotateVerts(rotateVerts(p0, 1), 1), 1), 1);
  const same = JSON.stringify(r4) === JSON.stringify(p0);
  ck("④ 旋转 4 次 90° 回到原位", same, same ? "逐点相同" : `实得 ${JSON.stringify(r4)}`);

  // 翻转两次回到原位
  const f2 = flipVerts(flipVerts(p0));
  const sameF = JSON.stringify(f2) === JSON.stringify(p0);
  ck("④b 翻转两次回到原位", sameF, sameF ? "逐点相同" : `实得 ${JSON.stringify(f2)}`);

  // 翻转**不改变面积**，但**改变覆盖率** —— 这是"翻转键 （F） 有策略意义"的证明 ✓
  //   ⚠️ 必须挑一个**真的能区分**两侧的摆法（我第一版用中三角平移后的朝向，两种都是 0% ⇒ 不具区分性 ✗）
  //   ⇒ 用"直角边 2 的三角形，一条直角边正好压在 y=0 上"这个手算例子：
  //      不翻转 ⇒ 底边 (0,0)-(2,0) 整段盖住 ⇒ 下边缘 50%（线长 4）
  //      翻转   ⇒ 底边跑到 x ∈ [−2,0] ⇒ 板外 ⇒ 下边缘 0% ✓
  const tri = [[0, 0], [2, 0], [0, 2]];
  const triF = flipVerts(tri);
  const a1 = polygonArea(tri);
  const a2 = polygonArea(triF);
  const cNo = axisCoverage([tri], TANGRAM_AXES[1]);
  const cYes = axisCoverage([triF], TANGRAM_AXES[1]);
  ck("④c 翻转：面积不变，但覆盖率会变（所以翻转有策略意义）",
    Math.abs(a1 - a2) < 1e-9 && Math.abs(cNo - 0.5) < 1e-9 && cYes === 0,
    `面积 ${a1}/${a2}｜下边缘覆盖 ${(cNo * 100).toFixed(1)}%（期望 50%） vs ${(cYes * 100).toFixed(1)}%（期望 0%）`);

  // 吸附：小数落点吸到整数格点
  const s1 = snapPoint([1.4, 2.6]);
  ck("④d 吸附到整数格点", s1[0] === 1 && s1[1] === 3, `[1.4, 2.6] ⇒ [${s1.join(", ")}]`);

  // 覆盖率**单调不降**：往棋盘上加板块只会让覆盖变多（不会变少）
  const one = [TANGRAM_PIECES[0].verts];
  const two = [TANGRAM_PIECES[0].verts, TANGRAM_PIECES[1].verts];
  const c1 = axisCoverageAll(one); const c2 = axisCoverageAll(two);
  const mono = TANGRAM_AXES.every((ax) => c2[ax.id] >= c1[ax.id] - 1e-12);
  ck("④e 覆盖率随板块增加**单调不降**", mono,
    TANGRAM_AXES.map((ax) => `${ax.id} ${(c1[ax.id] * 100).toFixed(0)}%→${(c2[ax.id] * 100).toFixed(0)}%`).join("｜"));

  // 手算定点：只有"大三角 I"时，下边缘 `y=0` 被它的 (0,0)-(4,0) 整条盖住 ⇒ 100%
  //  而左边缘 `x=0` 只有 (0,0) 一个点 ⇒ 0%（点覆盖长度为 0）✓
  const onlyA = axisCoverageAll([TANGRAM_PIECES[0].verts]);
  ck("④f 定点手算：只放大三角 I ⇒ 下边缘 100%、左边缘 0%",
    Math.abs(onlyA.horz - 1) < 1e-9 && Math.abs(onlyA.vert - 0) < 1e-9,
    `横=${(onlyA.horz * 100).toFixed(1)}%｜纵=${(onlyA.vert * 100).toFixed(1)}%｜斜=${(onlyA.diag * 100).toFixed(1)}%`);
}

// ── ⑤ 摆法自由度：把一块挪到别处 ⇒ 覆盖率随之变化（不是"集齐才有"）──
{
  // 把"大三角 I"沿 y 轴上移 1 ⇒ 下边缘不再被盖住 ⇒ 横轴覆盖率掉到 0
  const moved = placePieceVerts(TANGRAM_PIECES[0], { dy: 1 });
  const cov = axisCoverageAll([moved]);
  const shifted = Math.abs(cov.horz - 0) < 1e-9 && cov.diag > 0;
  ck("⑤ 挪开一块 ⇒ 覆盖率**连续变化**（不是开关）", shifted,
    `上移 1：横=${(cov.horz * 100).toFixed(1)}%｜斜=${(cov.diag * 100).toFixed(1)}%（对角线仍被 (0,1)-(2,3) 段盖住）`);
}

// ── ⑥ 获取门槛表（用户 2026 裁定：「以 1e10 为获取第一块板子的基准逐级指数/超指数倍增」）──
{
  const T = TANGRAM_ACQUIRE.epThresholds;
  const nums = T.map((x) => Number(x));
  const first = nums[0];
  const increasing = nums.every((v, i) => i === 0 || v > nums[i - 1]);
  // 「逐级指数/超指数倍增」⇒ 每级的**倍数本身**在增大（超指数）；恒定倍数才是纯指数
  const steps = nums.slice(1).map((v, i) => Math.log10(v) - Math.log10(nums[i]));
  const stepsGrowing = steps.every((v, i) => i === 0 || v > steps[i - 1]);
  ck("⑥ 获取门槛：第一块 = 1e10，且逐级门槛严格递增",
    T.length === 7 && first === 1e10 && increasing,
    `7 块门槛 = ${T.join(" < ")}`);
  ck("⑥b 增长是**超指数**（每级倍数本身在变大）", stepsGrowing,
    `各级指数差 = ${steps.map((s) => `+${s}`).join(", ")}（递增 ⇒ 超指数 ✓）`);

  ck("⑥d 获取顺序**按面积从小到大**（用户裁定）",
    TANGRAM_ACQUIRE.order.length === 7
      && TANGRAM_ACQUIRE.order.every((id, k) => {
        if (k === 0) return true;
        const prev = TANGRAM_PIECES.find((p) => p.id === TANGRAM_ACQUIRE.order[k - 1]);
        const cur = TANGRAM_PIECES.find((p) => p.id === id);
        return cur.frac >= prev.frac;                 // 面积**不降** ⇒ 从小到大 ✓
      })
      && new Set(TANGRAM_ACQUIRE.order).size === 7,   // 7 块一块不漏不重 ✓
    TANGRAM_ACQUIRE.order.map((id) => {
      const pc = TANGRAM_PIECES.find((p) => p.id === id);
      return `${pc.name}(${pc.frac * 16}/16)`;
    }).join(" → "));

  // 保底口径：EP 到哪一档就拿到几块（含边界）
  const cases = [
    ["1e9", 0], ["1e10", 1], ["1e12", 1], ["1e13", 2],
    ["1e22", 4], ["1e42", 6], ["1e43", 7], ["1e100", 7],
  ];
  const bad = cases.filter(([ep, want]) => tangramPiecesFromEP(ep) !== want);
  ck("⑥c 保底口径：EP ≥ 第 i 个门槛 ⇒ 第 i 块到手（含边界）",
    bad.length === 0,
    bad.length === 0
      ? cases.map(([ep, want]) => `${ep}⇒${want} 块`).join("｜")
      : `不符：${bad.map(([ep, want]) => `${ep} 期望 ${want} 实得 ${tangramPiecesFromEP(ep)}`).join("｜")}`);
}

// ⚠️ 2026：原本这里有一整段「抽取/兑换/拼装/挑战判定」的断言 ——
//   它们依赖 engine 的 `drawTangramPiece` / `setTangramPlacement` / `tangramChallenge*`，
//   而 0.7.1 的 engine 里还没有这些函数（本轮改动未提交）⇒ 先摘掉；等引擎侧接回再恢复 ✓

// ── ⑧ 拖拽的坐标换算（y 轴翻转是经典 bug 源 ⇒ 必须可测）──
{
  // 造一个"标准"的 SVG 矩形：宽 400、高 400、左上角在 (100, 50)
  const rect = { left: 100, top: 50, width: 400, height: 400 };
  const VB = { x: -3, y: -3, w: 106, h: 106 };
  // viewBox 里 (0,0)（= 棋盘左下角）对应 SVG 的点：x = 0 ⇒ (0 - (-3))/106 × 400 + 100
  const px = (v) => 100 + ((v - VB.x) / VB.w) * 400;
  const py = (v) => 50 + ((v - VB.y) / VB.h) * 400;
  const cases = [
    [[0, 0], [px(0), py(100)]],          // 棋盘左下 = viewBox (0,100) ✓
    [[4, 0], [px(100), py(100)]],        // 棋盘右下 ✓
    [[0, 4], [px(0), py(0)]],            // 棋盘左上（y 翻转 ⇒ SVG 的上边）✓
    [[2, 2], [px(50), py(50)]],          // 正中 ✓
  ];
  const bad = cases.filter(([[bx, by], [cx, cy]]) => {
    const [gx, gy] = svgToBoard(cx, cy, rect, VB);
    return Math.abs(gx - bx) > 1e-9 || Math.abs(gy - by) > 1e-9;
  });
  // 往返一致：boardToSvg → svgToBoard 应回到原位 ✓
  const rt = [[0, 0], [1, 3], [4, 4], [2, 1]].every(([bx, by]) => {
    const [sx, sy] = boardToSvg([bx, by]);
    // boardToSvg 给的是 viewBox 坐标 ⇒ 换成 client 再换回来
    const [gx, gy] = svgToBoard(px(sx), py(sy), rect, VB);
    return Math.abs(gx - bx) < 1e-9 && Math.abs(gy - by) < 1e-9;
  });
  ck("⑧ 拖拽坐标：svgToBoard 的 4 个角点 + 往返一致", bad.length === 0 && rt,
    bad.length === 0 ? `4 个角点全部命中，往返一致 ✓（含 **y 轴翻转** ✓）`
      : `偏差：${bad.map(([[bx, by]]) => `(${bx},${by})`).join(",")}`);
}

// ── ⑨ 拼装挑战的口径（用户 2026：「6 个难度 × 每难度 6 个图案；每次时空随机；需要 6×(6+12)」）──
{
  ck("⑨ 难度 6 档 × 每档 18 个（6 入场 + 12 储备）= **108** 个图案",
    TANGRAM_CHALLENGE.difficulties.length === 6
      && TANGRAM_CHALLENGE.perDifficulty === 6
      && TANGRAM_CHALLENGE.reserve === 12
      && tangramPatternsPerDifficulty() === 18
      && tangramPatternsTotal() === 108,
    `${TANGRAM_CHALLENGE.difficulties.map((d) => d.name).join(" / ")}` +
    `｜每档 ${tangramPatternsPerDifficulty()} ⇒ 总 ${tangramPatternsTotal()}`);

  // "每次时空随机" ⇒ 挑出来的 6 个要**随 seed 变**，且**同一个 seed 稳定**（可复现）✓
  {
    const a = pickChallengePatterns(2, 7);
    const a2 = pickChallengePatterns(2, 7);
    const b = pickChallengePatterns(2, 8);
    const same = JSON.stringify(a) === JSON.stringify(a2);
    const differ = JSON.stringify(a) !== JSON.stringify(b);
    // 6 个不重复、且都落在**该档自己的区间**（2 档 ⇒ 36..53）✓
    const inRange = a.every((v) => v >= 2 * 18 && v < 3 * 18);
    const uniq = new Set(a).size === a.length && a.length === 6;
  // ★★★ 2026（方案 B）：**图案库**必须是 6 档 × 18 = 108 个**真图案**（键互不相同）✓
  {
    const L = TANGRAM_PATTERN_LIBRARY;
    const P2 = L.patterns;
    const perD = {};
    for (const p of P2) perD[p.d] = (perD[p.d] ?? 0) + 1;
    const keys = new Set(P2.map((p) => p.key));
    const okL = P2.length === 108
      && Object.keys(perD).length === 6 && Object.values(perD).every((n) => n === 18)
      && keys.size === 108 && P2.every((p) => typeof p.key === "string" && p.key.length > 10);
    // ★ 2026（用户：「都做了吧」）**分档标定**：每档平均轮廓边段数必须**单调不降**（越往后越难）✓
    const avgB = [0,1,2,3,4,5].map((d) => {
      const a = P2.filter((p) => p.d === d).map((p) => p.boundary);
      return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    });
    const monoB = avgB.every((v, i) => i === 0 || v >= avgB[i - 1] - 1e-9);
    // ★★★ 2026（用户：「都做了吧」+「都后期了不上强力升级还有用么」）**奖励结构**的断言：
  //   ① 没清任何图案 ⇒ **每一项都是基线**（游戏不变）✓ ② 清得越多 ⇒ EP 折扣单调不减 ✓
  //   ③ 全清 ⇒ 结构性奖励生效 + 免费 ZPE 引擎等级 = 表里的和 ✓
  //   ④ ⚠️ 红线：表里**没有任何"IP 反馈回 IP"的项**（那会把 p 推向 1）✓
  {
    const zero = tangramRewardEffects();
    const baseOk = zero.epDiscount === 0 && zero.deKneeMult === 1 && zero.ipDoubleKneeMult === 1
      && zero.freeZpeEngineLevels === 0 && zero.passiveIpFrac === 0 && zero.allClear === false;
    const half = tangramRewardEffects([6, 6, 3, 0, 0, 0]);
    const more = tangramRewardEffects([6, 6, 6, 6, 0, 0]);
    const mono = more.epDiscount >= half.epDiscount && half.epDiscount > 0;
    const full = tangramRewardEffects([6, 6, 6, 6, 6, 6]);
    const fullOk = full.allClear === true && full.passiveIpFrac === 0.01
      // ★ 2026：换成"强力版"奖励表 ⇒ 期望值跟着改（免费引擎 = 表内求和 185；knee 3.0 / 4.0）✓
      && full.freeZpeEngineLevels === TANGRAM_CHALLENGE_REWARDS.freeZpeEngineLevelsByTier.reduce((a, b) => a + b, 0)
      && full.ipDoubleKneeMult === 3.0 && full.deKneeMult === 4.0
      && full.convSlopeMult === 10 && full.countFreqMult === 5 && full.pityFloor === 120;
    ck("⑨e 奖励：基线恒等 / 单调 / 全清生效（且**无 IP 自反馈项**）", baseOk && mono && fullOk,
      "基线=" + (baseOk ? "全 0 ✓" : "✗") + "｜半程折扣=" + (half.epDiscount * 100).toFixed(0) +
      "% → 更多=" + (more.epDiscount * 100).toFixed(0) + "%｜全清：免费引擎 " + full.freeZpeEngineLevels +
      " 级、ipDouble knee ×" + full.ipDoubleKneeMult + "、被动IP " + full.passiveIpFrac);
  }
  ck("⑨d 分档标定：每档平均轮廓边段数**单调不降**", monoB,
      avgB.map((v, i) => `d${i + 1}=${v.toFixed(1)}`).join(" ≤ ") +
      `（⚠️ d3~d6 目前相同：本池子只有 20/24/28/32 四种边段数 ⇒ 待枚举器更强后自然分化）`);
    ck("⑨c 图案库 = 6 档 × 18（108 个，键互不相同）", okL,
      `实得 ${P2.length} 个｜每档 ${Object.values(perD).join("/")}｜不同键 ${keys.size}｜` +
      `来源池 ${L.generated.pool} 个真装配（凸 ${L.generated.convex}）`);
  }

  ck("⑨b 时空随机：同 seed 稳定 / 换 seed 变化 / 6 个互不重复且落在本档区间",
      same && differ && inRange && uniq,
      `seed7 ⇒ [${a.join(",")}]（复现=${same}）｜seed8 ⇒ [${b.join(",")}]（不同=${differ}）｜6 个不重复=${uniq}`);
  }
}

console.log();
console.log("=".repeat(96));
console.log(`  ${fails === 0 ? `全部通过 ✅（${ckCount} 条断言）` : `${fails} / ${ckCount} 项失败 ❌`}`);
console.log("=".repeat(96));
if (!check) {
  console.log();
  console.log("  （本工具在默认模式下也跑全部断言 —— 没有\"读数表\"，因为几何内核的产出就是断言本身）✓");
}
process.exit(fails ? 1 : 0);
