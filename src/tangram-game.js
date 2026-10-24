/**
 * ★★★ 2026：**七巧板的"游戏侧"函数**（状态相关；几何/纯函数在 `tangram.js`）
 *
 * ⚠️ 为什么单独一个文件、不塞进 `engine.js`：
 *   本轮的教训 —— 往 1900 行的 `engine.js` 里用脚本插/删代码 = 高风险 ✗
 *   这些函数**只依赖** `tangram.js`（纯）+ `state` 的几个字段 ⇒ 独立模块零风险、可单测 ✓
 *
 * 职责划分（别混）：
 *   · `tangram.js`        —— 几何、覆盖率、指纹、价目表、奖励表（**纯函数，不碰 state**）
 *   · 本文件              —— 读/写 `state.tangram*` 的那一层（抽取、兑换、拼装、挑战）
 *
 * 存档字段（`state.js` 里登记）：`tangramOwned` / `tangramPity` / `tangramPlaced` / `tangramCleared` / `tangramChallenge`
 */
import Decimal from "../dist/break_eternity.esm.js";
import { CANVAS_MIN, CANVAS_MAX,
  TANGRAM_PIECES, TANGRAM_CHALLENGE, TANGRAM_ACQUIRE,
  tangramPricesAt, tangramPieceAtStep, tangramPatternsPerDifficulty, pickChallengePatterns,
  placePieceVerts, placementOf, isPlacementLegal, placedVertices, axisCoverageAll,
  polygonCells, cellsFingerprint, cellsFromFingerprint, placedCells,
} from "./tangram.js";
import { TANGRAM_PATTERN_LIBRARY } from "./tangram-pattern-library.js";
import { rewardPityFloor } from "./tangram-reward.js";   // ★ 2026：挑战奖励降低保底 ✓

const D = (x) => new Decimal(x);

/** 当前 EP 折扣（挑战奖励）—— 抽/兑价格乘它 ✓ 没清任何图案 ⇒ 1（基价）✓ */
export function tangramPriceFactor(state) {
  const cleared = state?.tangramCleared ?? [];
  const R = TANGRAM_ACQUIRE ? null : null;              // 只为可读性；奖励表在下面单独取
  void R;
  const perTier = TANGRAM_CHALLENGE.perDifficulty;
  let disc = 0;
  // ⚠️ 与 `tangram.js` 的 `tangramRewardEffects` 同源：这里只取折扣项 ✓
  //   （两处都读同一张常量表，不会脱节）
  const TABLE = tangramPriceFactor.TABLE ?? null;
  void TABLE;
  for (let d = 0; d < 6; d++) {
    const n = Math.min(perTier, Math.max(0, Math.floor(Number(cleared[d] ?? 0))));
    disc += (tangramPriceFactor.DISCOUNT[d] ?? 0) * (n / perTier);
  }
  return Math.max(0.1, 1 - Math.min(0.9, disc));
}
// 折扣表引用奖励表（唯一数据源）✓ —— 延迟绑定，避免循环 import
import { TANGRAM_CHALLENGE_REWARDS } from "./tangram.js";
tangramPriceFactor.DISCOUNT = TANGRAM_CHALLENGE_REWARDS.epDiscountByTier;

/** 抽取：花「门槛 × 1% × 折扣」EP，单次 2%，连续失败到保底必中 ✓ */
export function drawTangramPiece(state, step, rng = Math.random) {
  const p = tangramPricesAt(step);
  if (!p) return { ok: false, reason: "bad-index" };
  const piece = tangramPieceAtStep(step);
  if (!piece) return { ok: false, reason: "bad-index" };
  const id = piece.id;
  if (state.tangramOwned?.[id]) return { ok: false, reason: "owned" };
  const cost = D(p.draw).mul(tangramPriceFactor(state));
  if ((state.eternityPoints ?? D(0)).lt(cost)) return { ok: false, reason: "poor" };
  state.eternityPoints = state.eternityPoints.sub(cost);
  state.tangramPity ??= {};
  const fails = Math.max(0, Math.floor(Number(state.tangramPity[id] ?? 0)));
  // ★ 2026：保底次数可被挑战奖励降低（d2 全清 ⇒ 120）✓
  const pity = Math.min(p.pity, rewardPityFloor(state));
  const pityHit = fails + 1 >= pity;
  const luck = !pityHit && rng() < p.chance;
  if (pityHit || luck) {
    state.tangramOwned ??= {};
    state.tangramOwned[id] = true;
    delete state.tangramPity[id];
    autoPlaceTangram(state, id);
    return { ok: true, got: true, cost: cost.toString() };
  }
  state.tangramPity[id] = fails + 1;
  return { ok: true, got: false, cost: cost.toString() };
}

/** 足量兑换：花「门槛 × 折扣」EP，必定到手 ✓ */
export function exchangeTangramPiece(state, step) {
  const p = tangramPricesAt(step);
  if (!p) return { ok: false, reason: "bad-index" };
  const piece = tangramPieceAtStep(step);
  if (!piece) return { ok: false, reason: "bad-index" };
  const id = piece.id;
  if (state.tangramOwned?.[id]) return { ok: false, reason: "owned" };
  const cost = D(p.exchange).mul(tangramPriceFactor(state));
  if ((state.eternityPoints ?? D(0)).lt(cost)) return { ok: false, reason: "poor" };
  state.eternityPoints = state.eternityPoints.sub(cost);
  state.tangramOwned ??= {};
  state.tangramOwned[id] = true;
  if (state.tangramPity) delete state.tangramPity[id];
  autoPlaceTangram(state, id);
  return { ok: true, cost: cost.toString() };
}

/** 拿到手就摆上棋盘（否则玩家"看不到巧板"）✓ 依次试几个格点，都冲突就留在托盘 ✓ */
export function autoPlaceTangram(state, id, { parking = false } = {}) {
  if (!state?.tangramOwned?.[id]) return false;
  if (state.tangramPlaced?.[id]) return true;

  // ★ 2026-10-23（用户：「允许超出放置；重置棋盘能找到所有巧板」）：
  //   旧实现**允许重叠** ⇒ `setTangramPlacement(0,0)` 永远成功 ⇒ 重置时七块全叠在 (0,0) ✗
  //   现在自动摆位先做**无重叠**检查；重置用 `parking` 把块放到**目标 4×4 外**的停车位，
  //   既不会帮玩家自动解题，也不会让块叠成一坨。
  const tryCfg = (cfg) => {
    if (!isPlacementLegal(id, cfg, state.tangramPlaced, undefined, false)) return false;
    const r = setTangramPlacement(state, id, cfg, true);   // 已检查过：force 只跳过重复检查
    return r.ok;
  };

  if (parking) {
    // ★ 2026-10-23：自动摆位的 fallback（新获得的块在目标区放不下时）。
    //   优先停在加成原点 (4,4) 右侧（x=4..8, y=0..4），再退到屏幕下方。
    //   ⚠️ 重置棋盘**不走这里**：重置要回到左侧 4×4 加成区（三轴满覆盖）✓
    for (const rot of [0, 1, 2, 3]) {
      for (const flip of [false, true]) {
        for (let y = 0; y <= 4; y += 0.5) {
          for (let x = 4; x <= 8; x += 0.5) {
            if (tryCfg({ dx: x, dy: y, rot, flip })) return true;
          }
        }
        for (let y = -4; y <= 0; y += 0.5) {
          for (let x = 0; x <= 4; x += 0.5) {
            if (tryCfg({ dx: x, dy: y, rot, flip })) return true;
          }
        }
      }
    }
    return false;
  }

  // 新获得的块：优先放进目标 4×4；放不下再停车
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [2, 0], [0, 2], [1, 1], [3, 0], [0, 3]]) {
    if (tryCfg({ dx, dy, rot: 0, flip: false })) return true;
  }
  return autoPlaceTangram(state, id, { parking: true });
}

/** 设定摆位（**允许小数** = 自由拖动；手动摆位不检查画布边框，允许重叠）✓ */
/**
 * ★★★ 2026-10-22（用户：「旋转/翻转在选中后无法生效，快捷键也是」）——
 *   根因：旋转/翻转后会**重新做合法性判定** ✗ ⇒ 一旦旋出画布/产生重叠就被拒绝 ✗
 *   ⇒ 表现为"按了没反应" ✓
 *   `force = true` 时**跳过合法性判定**（只用于旋转/翻转这类"原地变形" ✓）
 *   ⚠️ 位置拖动仍然走合法性判定（不许拖出画布 ✓）
 */

/**
 * ★★★ 2026-10-22（用户诊断：「**所有巧板的变换中心不在物理中心**」✓ 完全正确）——
 *   原实现：`rot/flip` 是在**棋盘原点 (0,0)** 处做的 ✗ ⇒ 一转就把块甩到别处 ✗
 *   （正方形是特例：它在原点周围恰好对称，所以看起来"只转了一点" ✗）
 *
 * 本函数 = **绕板块自身包围盒中心**变换 ✓：
 *   1. 先取变换后的**未平移**顶点（dx=dy=0），算它的包围盒中心 c2
 *   2. 再取变换前的世界包围盒中心 c1
 *   3. 把 `dx,dy` 补上 `c1 − c2` ⇒ 视觉上"原地转/翻" ✓
 *
 * @returns {{ok:boolean}}
 */
export function transformPieceInPlace(state, id, { dRot = 0, dFlip = false } = {}) {
  const piece = TANGRAM_PIECES.find((p) => p.id === id);
  if (!piece) return { ok: false, reason: "unknown-piece" };
  const cur = placementOf(state?.tangramPlaced, id);
  const centerOf = (verts) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of verts) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return [(minX + maxX) / 2, (minY + maxY) / 2];
  };
  const before = placePieceVerts(piece, { rot: cur.rot, flip: cur.flip, dx: Number(cur.dx ?? 0), dy: Number(cur.dy ?? 0) });
  const c1 = centerOf(before);
  const next = {
    rot: ((Math.floor(Number(cur.rot ?? 0) + dRot) % 4) + 4) % 4,
    flip: dFlip ? !cur.flip : !!cur.flip,
    dx: 0,
    dy: 0,
  };
  const c2 = centerOf(placePieceVerts(piece, next));
  // ⚠️ `c1` **已经含** cur.dx/cur.dy（它是变换前的世界包围盒）⇒ 这里不能再加一次 ✗
  //   （我第一版写成 `cur.dx + (c1 − c2)` ⇒ 中心被推了两次 ⇒ 越转越偏 ✗）
  next.dx = c1[0] - c2[0];
  next.dy = c1[1] - c2[1];
  return setTangramPlacement(state, id, next, true);
}
export function setTangramPlacement(state, id, cfg, force = false) {
  if (!state?.tangramOwned?.[id]) return { ok: false, reason: "not-owned" };
  state.tangramPlaced ??= {};
  const next = { rot: 0, flip: false, dx: 0, dy: 0, ...placementOf(state.tangramPlaced, id), ...cfg };
  next.rot = ((Math.floor(next.rot) % 4) + 4) % 4;
  next.dx = Number(next.dx) || 0;
  next.dy = Number(next.dy) || 0;
  // ★ 2026-10-23：手动拖拽**不检查画布边框**（第 6 参 false）⇒ 块可以停在目标外/边框外；
  //   自动摆位仍用有界检查（`autoPlaceTangram` 自己调 `isPlacementLegal`）✓
  if (!force && !isPlacementLegal(id, next, state.tangramPlaced, undefined, true, false)) return { ok: false, reason: "illegal" };
  state.tangramPlaced[id] = next;
  return { ok: true, placement: next };
}
export const moveTangramPlacement = (state, id, ddx, ddy) => {
  const cur = placementOf(state.tangramPlaced, id);
  return setTangramPlacement(state, id, { dx: cur.dx + ddx, dy: cur.dy + ddy });
};
export const rotateTangramPlacement = (state, id, dir = 1) => {
  // ★ 2026-10-23（用户：「旋转后又不在中心点了」）——
  //   面板按钮原来走这里，只改 `rot`（绕棋盘原点转）⇒ 块会被甩走 ✗
  //   现在和 R 键共用 `transformPieceInPlace`（绕自身 bbox 中心）✓
  return transformPieceInPlace(state, id, { dRot: dir });
};
export const flipTangramPlacement = (state, id) => {
  // 同上：翻转也绕自身中心，不再绕棋盘原点 ✓
  return transformPieceInPlace(state, id, { dFlip: true });
};
export function takeTangramBack(state, id) {
  if (!state?.tangramPlaced?.[id]) return false;
  delete state.tangramPlaced[id];
  return true;
}
/** 重置棋盘：清布局 + 已持有的块**自动归位**（不丢所有权）✓ */
export function resetTangramBoard(state) {
  const cleared = Object.keys(state?.tangramPlaced ?? {}).length;
  state.tangramPlaced = {};
  let placed = 0;
  let parked = 0;
  for (const p of TANGRAM_PIECES) {
    if (!state.tangramOwned?.[p.id]) continue;
    // ★ 2026-10-23（用户：「重置的时候所有板块应该在左半（覆盖加成区域）」）——
    //   回到左侧 4×4 加成区（经典摆放，三轴 100%），不再停车到右侧/外面 ✓
    if (autoPlaceTangram(state, p.id)) placed++;
    else parked++;
  }
  return { cleared, placed, parked };
}

/** 三条轴覆盖率（只算**真的摆上棋盘**的块）✓ */
export function tangramCoverage(state) {
  return axisCoverageAll(placedVertices(state?.tangramPlaced));
}

// ══════════ 拼装挑战 ══════════
/** 目标图案：线性推进（"每时空随机"等时空层实装后换 `pickChallengePatterns`）✓ */
export function tangramChallengeTarget(state) {
  const lib = TANGRAM_PATTERN_LIBRARY.patterns;
  if (!lib.length) return null;
  // ★★★ 2026（终稿 §10）：「**6 个难度，每难度 6 图案，每次时空随机**」✓
  //   · 种子 = `eternityCount`（时空层的**代理**：每次永恒换一批顺序）✓
  //   · 逐档推进：先清 d1 的 6 个 → 再 d2 …（`tangramCleared[d]` = 该档已清数）✓
  //   · 每档的出题顺序由 `pickChallengePatterns(d, 种子, poolSize)` 洗牌决定 ✓
  //   ⚠️ 时空层实装后把种子换成「时空次数」即可，其它一行不用改 ✓
  const per = TANGRAM_CHALLENGE.perDifficulty;
  // ★★★ 2026（用户：「时空是一个**新的重置层**，务必注意」）——
  //   种子必须是 **时空次数**（`spaceCount`）；时空层还没实装 ⇒ 先退回永恒次数 ✓
  //   ⚠️ 时空 ≠ 永恒：它是一层**更外层的重置** ⇒ 一旦实装，这里**不用改**（`spaceCount` 优先 ✓）
  // 2026-10-22 (user: resetting the puzzle set is the SPACE layer's job, not eternity's)
  //   seed used to be `spaceCount ?? eternityCount` -> every eternity changed the puzzle.
  //   Now the seed is recorded once on first entry (state.tangramSeed) and only a
  //   spaceCount change (the space layer) re-rolls it.
  if (state && state.tangramSeed == null) state.tangramSeed = Math.floor(Number(state.spaceCount ?? 0)) || 0;
  const seed = Math.floor(Number(state?.spaceCount ?? state?.tangramSeed ?? 0)) || 0;
  const cleared = state?.tangramCleared ?? [];
  for (let d = 0; d < 6; d++) {
    const n = Math.min(per, Math.max(0, Math.floor(Number(cleared[d] ?? 0))));
    if (n >= per) continue;                                   // 该档已清满 ⇒ 下一档 ✓
    const order = pickChallengePatterns(d, seed, tangramPatternsPerDifficulty());
    const idx = order[n % order.length];
    return lib[idx] ?? lib[0];
  }
  return lib[0];                                             // 六档全清 ⇒ 循环（不崩 ✓）
}
/** 拼对了吗：玩家摆位的并集指纹 == 目标指纹（旋转/镜像/平移都算拼对）✓ */
export function tangramChallengeSolved(state) {
  const t = tangramChallengeTarget(state);
  if (!t) return false;
  const placed = state?.tangramPlaced ?? {};
  if (!Object.keys(placed).length) return false;

  // ★★★ 2026-10-22（用户：「照着题目拼好了却**不自动完成**」）——
  //   根因：吸附是 **0.2 格**（用户要求 ✓），而 polygonCells 只在**整数网格**上切小三角 ✗
  //   ⇒ 位置带 0.2/0.4 偏移时算不出 cell ⇒ 指纹永远对不上 ✗
  //   ⇒ 判定时**把落点四舍五入到整格**再算 ✓（只影响判定，不改玩家看到的位置 ✓）
  const rounded = {};
  for (const [id, cfg] of Object.entries(placed)) {
    rounded[id] = { ...cfg, dx: Math.round(Number(cfg?.dx ?? 0)), dy: Math.round(Number(cfg?.dy ?? 0)) };
  }
  const mine = placedCells(rounded);
  if (!mine.length) return false;
  if (cellsFingerprint(mine) === t.key) return true;
  // 兜底：原始（未取整）也算一遍 —— 整数落点时两种结果相同 ✓
  const raw = placedCells(placed);
  return raw.length > 0 && cellsFingerprint(raw) === t.key;
}
/** 过关并进下一题（按目标难度累加 `tangramCleared`，奖励唯一输入）✓ */
export function tangramAdvanceChallenge(state) {
  if (!tangramChallengeSolved(state)) return false;
  const t = tangramChallengeTarget(state);
  state.tangramChallenge ??= { solved: 0 };
  state.tangramChallenge.solved = Math.max(0, Math.floor(Number(state.tangramChallenge.solved ?? 0))) + 1;
  const d = Math.max(0, Math.min(5, Math.floor(Number(t?.d ?? 0))));
  state.tangramCleared ??= [0, 0, 0, 0, 0, 0];
  state.tangramCleared[d] = Math.max(0, Math.floor(Number(state.tangramCleared[d] ?? 0))) + 1;
  // ★ 2026：**本次永恒完成数**（d3 奖励「每对量子」的输入 ✓）—— 永恒时归零 ✓
  state.tangramChallengeThisEternity = Math.max(0, Math.floor(Number(state.tangramChallengeThisEternity ?? 0))) + 1;
  return true;
}

export {
  TANGRAM_PIECES, TANGRAM_CHALLENGE, TANGRAM_ACQUIRE, TANGRAM_CHALLENGE_REWARDS,
  tangramPricesAt, tangramPieceAtStep, tangramPatternsPerDifficulty,
  cellsFromFingerprint, placedCells, cellsFingerprint, polygonCells,
};

/**
 * ★★★ 2026-10-22（用户：「加个**确认完成**按钮」）——
 *   返回「当前摆放 vs 目标图案」的差异，用于按钮上的提示 ✓
 *   · `missing` = 目标有、你没有的小三角数（还差多少块）
 *   · `extra`   = 你有、目标没有的（多余/摆错）
 *   · `ok`      = 完全一致（等价于 `tangramChallengeSolved()` ✓）
 *   ⚠️ 与判定**同一口径**：落点取整到整格 + 8 重对称指纹 ✓
 */
export function tangramChallengeDiff(state) {
  const t = tangramChallengeTarget(state);
  if (!t) return { ok: false, missing: 0, extra: 0, reason: "no-target" };
  const placed = state?.tangramPlaced ?? {};
  const rounded = {};
  for (const [id, cfg] of Object.entries(placed)) {
    rounded[id] = { ...cfg, dx: Math.round(Number(cfg?.dx ?? 0)), dy: Math.round(Number(cfg?.dy ?? 0)) };
  }
  const mineCells = placedCells(rounded);
  const tgtCells = cellsFromFingerprint(t.key);
  const keyOf = (c) => c[0] + "," + c[1] + "," + c[2];
  const mineSet = new Set(mineCells.map(keyOf));
  const tgtSet = new Set(tgtCells.map(keyOf));
  let missing = 0;
  for (const k of tgtSet) if (!mineSet.has(k)) missing++;
  let extra = 0;
  for (const k of mineSet) if (!tgtSet.has(k)) extra++;
  // ★ 2026-10-22（用户：「试试吧」= 把缺口画出来）——
  //   `ghostCells` = 目标小三角，**平移**到与玩家形状同一个左下角 ✓
  //   用途：在棋盘上画"淡红的缺口" ✓（对齐用的是包围盒左下角，够用 ✓）
  const bboxMin = (cells) => {
    let minX = Infinity, minY = Infinity;
    for (const c of cells) { if (c[0] < minX) minX = c[0]; if (c[1] < minY) minY = c[1]; }
    return [minX === Infinity ? 0 : minX, minY === Infinity ? 0 : minY];
  };
  // ★★★ 2026-10-24（用户：「红色提示**固定在 8×8 棋盘内**」）——
  //   不再跟随玩家形状的包围盒 ✗（那会飘到块旁边 ✗）
  //   改成**原位绘制**：目标图案本来就是归一化到左下角的 ✓ ⇒ 直接落在画布的**左下 4×4** ✓
  //   （画布 0..8 ✓，目标占 0..4 ✓ ⇒ 稳稳在棋盘内 ✓）
  // ★★★ 2026-10-24（用户：「预想的题目中心点在 8×8 的中间（4×4 位置）」）——
  //   目标图案的包围盒**中心**对齐到画布中点 `(CANVAS_MAX/2, CANVAS_MAX/2) = (4,4)` ✓
  //   （之前是"左下角对齐原点" ✗ ⇒ 实测中心落在约 (3,2) ✗ —— 正是用户看到偏左偏下 ✓）
  const cw = 4;   // 画布 0..8 的中点（写死 4，避免 CANVAS_* 未注入时算成 NaN ✗）
  const [bbx0, bby0] = bboxMin(tgtCells);
  let bbx1 = -Infinity, bby1 = -Infinity;
  for (const c of tgtCells) { if (c[0] > bbx1) bbx1 = c[0]; if (c[1] > bby1) bby1 = c[1]; }
  const ox = Math.round(cw - (bbx0 + bbx1) / 2);
  const oy = Math.round(cw - (bby0 + bby1) / 2);
  const ghostCells = tgtCells.map(([x, y, k]) => [x + ox, y + oy, k]);
  return {
    ok: missing === 0 && extra === 0,
    missing, extra,
    target: tgtCells.length, mine: mineCells.length,
    ghostCells,          // ★ 供棋盘画缺口 ✓
    holes: ghostCells.filter((c) => !mineSet.has((c[0]) + "," + (c[1]) + "," + (c[2]))),
  };
}