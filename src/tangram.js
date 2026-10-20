/**
 * ★★★ 2026：**七巧板的几何内核** —— 照 [`docs/TANGRAM.md`](../docs/TANGRAM.md) §1 / §5.3 的设计稿实现。
 *
 * ── 设计稿要点（逐条对应）──
 *   · 最终目标是**把七块板拼成正方形**（经典七巧板）⇒ 正方形边长取 **4**，顶点全落在 **0..4 整数点** ✓
 *   · 原点在**左下角**；只看**三条线**：
 *       **纵轴** = 左边缘 `x=0` ｜ **横轴** = 下边缘 `y=0` ｜ **斜轴** = 主对角线 `y=x` ✓
 *   · 加成随「**板块占据该线的比例**」走，且**「边、点、面覆盖都算」**（用户原话）
 *     ⇒ 所以覆盖率 = 「线上落进**任意板块**（含内部与边界）的**并集长度** ÷ 该线全长」✓
 *   · 「相当自由」⇒ 不是固定插槽：板块可 **旋转 / 翻转**，落点靠**吸附**（见 `snapPoint`）✓
 *
 * ── 为什么用**凸多边形**做：七块板（三角 / 正方形 / 平行四边形）**全部是凸的** ⇒
 *     ① 「线 ∩ 板」必然只有**一段**（不用处理多段）✓
 *     ② 重叠判定可用 **SAT（分离轴）**，整数坐标下**精确**，不靠采样 ✓
 *
 * ⚠️ 本模块是**纯函数**：不读 `state`、不碰 DOM、不改任何东西 ⇒ 好断言、好复用 ✓
 * ⚠️ 数值口径：`rot` 是 **90° 的整数倍**（0..3），`flip` 是布尔（沿垂直轴镜像）✓
 */

/**
 * ★★★ 2026：**七巧板的获取门槛**（用户裁定 §6 的口径）——
 *   原话：「以 **1e10** 为获取第一块板子的基准**逐级指数/超指数倍增**」✓
 *
 * ── 读法（我按 §3 的「消耗 **EP** 解锁各巧板」落实）──
 *   · 门槛量是 **EP**（永恒点）✓
 *   · 第 1 块 = **1e10 EP**（用户给的基准）✓
 *   · 之后**逐级**乘一个**越来越大的**倍数（×1e3 → ×1e4 → … → ×1e8）
 *     ⇒ 指数本身也在涨 = **超指数**增长（用户原话"指数/超指数"取了后者）✓
 *
 * ⚠️ **拉表定**：7 个门槛是**字面表**（不靠公式现算）⇒ 想改哪块就改哪块，且可被断言逐条核对 ✓
 * ⚠️ 这套数**还没有经过节奏标定**（EP 到 1e10 大约对应 IP ≈ 1e4620，
 *   到 1e43 大约对应 IP ≈ 1e19160 —— 见 `docs/TANGRAM.md` §6）⇒
 *   它是"可玩的量级"，不是"平衡过的量级"；**标定要等能真的玩到那一步** ✓
 * ⚠️ §3 还说「获取**带概率**；超过一定阈值**必定**得到一块」⇒
 *   本表是**必定得到**的那一侧（保底阈值）✓ 概率曲线仍是待定项（§6 第 5 条的另一半）✓
 */
export const TANGRAM_ACQUIRE = {
  /**
   * ★★★ 2026（用户裁定）：「我希望的是**按照面积从小到大获取**」⇒
   *   获取顺序与门槛表**按这个数组**走（不是 `TANGRAM_PIECES` 的几何顺序）✓
   *   面积：smallA 1/16 = smallB 1/16 < medium 2/16 = square 2/16 = para 2/16 < largeA 4/16 = largeB 4/16 ✓
   *   ⚠️ 同面积的按"先小三角、中三角、正方形、平行四边形、大三角"的常识顺序排 ✓
   */
  order: ["smallA", "smallB", "medium", "square", "para", "largeA", "largeB"],
  /** 7 块板的 EP 门槛（**下标 = 上面的获取顺序**；第 1 块 1e10；倍数 1e3→1e8 逐级放大） */
  epThresholds: [
    "1e10",   // 第 1 步 —— 用户给的基准（= 小三角 I）
    "1e13",   // ×1e3（小三角 II）
    "1e17",   // ×1e4（中三角）
    "1e22",   // ×1e5（正方形）
    "1e28",   // ×1e6（平行四边形）
    "1e35",   // ×1e7（大三角 I）
    "1e43",   // ×1e8（大三角 II）
  ],
  /** 逐级倍数（只用于文档/自检展示；门槛表是唯一数据源） */
  steps: [1e3, 1e4, 1e5, 1e6, 1e7, 1e8],
};

/** 获取顺序里第 `step` 步是哪一块（越界 ⇒ null）✓ */
export function tangramPieceAtStep(step) {
  const id = TANGRAM_ACQUIRE.order[step];
  return id ? TANGRAM_PIECES.find((p) => p.id === id) ?? null : null;
}

/** 某块在图鉴里排第几步（不在获取顺序里 ⇒ -1）✓ */
export function tangramStepOf(id) {
  return TANGRAM_ACQUIRE.order.indexOf(id);
}

/**
 * 按当前 EP 能拿到**几块**板（保底口径：EP ≥ 第 i 个门槛 ⇒ 第 i 块到手）✓
 * @param {Decimal|number|string} ep
 * @returns {number} 0..7
 */
export function tangramPiecesFromEP(ep) {
  const v = ep && ep.log10 ? ep : makeDecimal(ep);
  let n = 0;
  for (const t of TANGRAM_ACQUIRE.epThresholds) {
    if (v.gte(makeDecimal(t))) n++;
  }
  return n;
}

/** 第 i 块（0-based）的门槛；越界返回 null */
export function tangramThresholdAt(i) {
  const t = TANGRAM_ACQUIRE.epThresholds[i];
  return t == null ? null : makeDecimal(t);
}

/**
 * ⚠️ 本模块刻意**不 import `break_eternity`**（保持"纯几何/纯函数、零依赖"）——
 *   门槛比较需要一个十进制造型 ⇒ 用一个**极小的本地适配**：
 *   有 `gte/log10` 的（Decimal）直接用；否则转成 `{log10, gte}` 的朴素实现 ✓
 *   （只用于比较 1e10~1e43 这种量级 ⇒ 双精度够 ✓ 真要精细再换 Decimal）
 */
function makeDecimal(x) {
  if (x && typeof x.gte === "function") return x;
  const n = Number(x);
  return {
    log10: () => Math.log10(n),
    gte(other) {
      const o = typeof other === "number" ? other : Number(other.log10 ? Math.pow(10, other.log10()) : other);
      return n >= o;
    },
  };
}

/**
 * ★★★ 2026：**抽取 / 足量兑换的价目表**（用户：「顺便做下消耗 EP 抽取 / 足量兑换巧板的功能」）——
 *   照 §3 的两句话落实：「消耗 **EP** 解锁各巧板」＋「获取**带概率**；超过一定阈值**必定**得到一块」✓
 *
 * | 途径 | 花费 | 概率 | 最坏花费 |
 * |---|---|---|---|
 * | **抽取** | `门槛 × 1%` EP／次 | 每次 **2%**（1/50） | 吃保底 **150 次** ⇒ `1.5×门槛` |
 * | **足量兑换** | `门槛` EP | **必定** | `1×门槛` |
 *
 * ⇒ 设计意图：**兑换是"稳"（保底最便宜），抽取是"赌"**（平均 `2×门槛`、最坏 `1.5×门槛`，
 *   但**单次门槛极低** ⇒ 前期就能碰运气、且抽到即赚）✓
 * ⚠️ 概率曲线（2%）与保底次数（150）都是**我拍的、待标定**（`TANGRAM.md` §6 第 5 条的另一半）✓
 * ⚠️ 「超过一定阈值必定得到」我落实成 **保底次数**（pity）而不是"EP 余额达到就白给" ——
 *   因为用户这次明确说**消耗** EP ⇒ 白给与"消耗"矛盾 ✗
 */
export const TANGRAM_DRAW = {
  /** 抽取价格 = 门槛 × 这个比例 */
  costFrac: 0.01,
  /** 单次成功率 */
  chance: 0.02,
  /** 保底：连续失败这么多次 ⇒ 下一次必定成功 */
  pity: 150,
};

/**
 * 第 i 块（0-based）的**抽取价**与**兑换价**（都用 EP；以门槛表为唯一数据源）✓
 * @returns {{draw:string, exchange:string, chance:number, pity:number} | null}
 */
export function tangramPricesAt(i) {
  const t = TANGRAM_ACQUIRE.epThresholds[i];
  if (t == null) return null;
  const exp = Math.round(Math.log10(Number(t)));
  const drawExp = exp + Math.round(Math.log10(TANGRAM_DRAW.costFrac));   // 1e10 × 1% = 1e8
  return {
    draw: `1e${drawExp}`,
    exchange: t,
    chance: TANGRAM_DRAW.chance,
    pity: TANGRAM_DRAW.pity,
  };
}

/**
 * ★★★ 2026：**放置状态 → 顶点数组**（只含"真的摆到棋盘上"的那几块）✓
 *   `placed` 的形状：`{ [pieceId]: { rot, flip, dx, dy } }`（`state.tangramPlaced`）
 *   ⚠️ 拿到手但**没摆**的块**不计入覆盖率** —— 否则"拼装"就没意义了 ✗
 */
export function placedVertices(placed, pieces = TANGRAM_PIECES) {
  if (!placed) return [];
  return pieces
    .filter((p) => placed[p.id])
    .map((p) => placePieceVerts(p, placed[p.id]));
}

/**
 * ★★★ 2026（用户：「我希望能拖动的区域**包括一整个页面**，但**加成判定不需要大修改**」）——
 *   活动范围从「必须在 4×4 方框内」放宽成**一大片画布**：`CANVAS_MIN..CANVAS_MAX` ✓
 *   ⚠️ 为什么这样"加成判定不用改"：三条轴**永远是方框的边与对角线**（`TANGRAM_AXES`）；
 *     块拖到框外 ⇒ 它与那三条线的交集自然变成 0（或被裁掉一部分）⇒ 覆盖率公式**一字不改** ✓
 *   ⚠️ 仍保留一个**画布上限**（不真的无限远）：否则可以把块拖到看不见的地方 ⇒ 体验变差 ✗
 */
export const CANVAS_MIN = 0;    // 2026: 画布左下角 = 正方形左下角 (0,0)
export const CANVAS_MAX = 8;    // 2026: 8x8 画布（正方形 0..4 贴在左下）

/**
 * 一个摆位**是否合法**：① 整块在**画布**内（`-3..7`，**不再是 0..4 的方框**）② 不与已放下的块重叠 ✓
 * ⚠️ 「在画布内」只需检查顶点：七块都是**凸**的，凸块的全部顶点在凸区域内 ⇒ 整块在内 ✓
 * ⚠️ 重叠用 `convexOverlap`（SAT）⇒ **共边/共点不算重叠** ⇒ 贴边拼装合法 ✓
 */
export function isPlacementLegal(id, cfg, placed, pieces = TANGRAM_PIECES) {
  const piece = pieces.find((p) => p.id === id);
  if (!piece) return false;
  const v = placePieceVerts(piece, cfg);
  if (!v.every(([x, y]) => x >= CANVAS_MIN && x <= CANVAS_MAX && y >= CANVAS_MIN && y <= CANVAS_MAX)) return false;
  for (const other of pieces) {
    if (other.id === id || !placed?.[other.id]) continue;
    if (convexOverlap(v, placePieceVerts(other, placed[other.id]))) return false;
  }
  return true;
}

/** 某块的当前摆位（没摆过 ⇒ 默认摆位 = 原点、不转不翻）✓ */
export function placementOf(placed, id) {
  return placed?.[id] ?? { rot: 0, flip: false, dx: 0, dy: 0 };
}

/**
 * ★★★ 2026：**SVG 像素 → 棋盘坐标**（拖拽用；抽成纯函数以便断言）✓
 *   ⚠️ 两个经典坑都在这里：
 *     ① viewBox 有 `-3` 的留白（`viewBox="-3 -3 106 106"`）⇒ 要先偏移；
 *     ② **y 轴要翻**：棋盘原点在**左下**、SVG 原点在**左上** ✓
 *   `rect` = `svg.getBoundingClientRect()` 的形状 `{ left, top, width, height }`
 * @returns {[number, number]} 棋盘坐标（单位 = 格，未取整）
 */
export function svgToBoard(clientX, clientY, rect, view = { x: 0, y: 0, w: 200, h: 200 }) {   // 2026: canvas 8x8, no y flip
  const sx = view.x + ((clientX - rect.left) / rect.width) * view.w;
  const sy = view.y + ((clientY - rect.top) / rect.height) * view.h;
  // ⚠️ 棋盘占的是 viewBox 的 **0..100**（`-3` 只是外圈留白）⇒ 不能拿 view.x 当原点 ✗
  //   （我第一版写成 `(sx - view.x)/25` ⇒ 全错，被 ⑧ 的 4 个角点当场抓住 ✓）
  // 2026: rotate the canvas 90deg clockwise => NO y flip (square sits top-left) ✓
  return [sx / 25, sy / 25];
}

/** 棋盘坐标 → SVG（`ui.js` 画 `polygon` 用；与 `svgToBoard` 互为逆）✓ */
export function boardToSvg([x, y]) {
  return [x * 25, y * 25];   // 2026: canvas rotated 90deg clockwise => no y flip
}

/**
 * ★★★ 2026：**拼装挑战**的口径（用户裁定）——
 *   原话：「拼装挑战分 **6 个难度**，每难度 **6 个图案**（每次**时空**随机。
 *          ps：时空也是一个重置层，其实也就是需要 **6 个难度 ×（6+12）个图案**。
 *          如果设计不到维持六难度×每个6图案的设计）」
 *
 * ── 落实成数字（全部可断言）──
 *   · 难度 **6** 档（见 `difficulties`，从易到难）✓
 *   · 每档入场 **6** 个图案（玩家在某个时空里看到/要拼的那 6 个）✓
 *   · 另有 **12** 个**储备**（因为"每次时空随机"⇒ 同一个难度要能换花样，不能只有 6 个）✓
 *   ⇒ 每档需要 **18** 个图案，总计 **6 × 18 = 108** 个 ✓
 *
 * ⚠️⚠️ **这里刻意不放图案数据** —— 图案必须是 `docs/TANGRAM.md` §T 的**枚举器真算出来的**
 *   （自检 = 必须正好产出 **13 个凸轮廓**，那是七巧板的已知结论）。
 *   手写/编造 108 个轮廓 = "显示≠实发" ✗ ⇒ `patterns` 故意留空，等枚举器产出后由
 *   `tools/tangram-patterns.mjs` 生成并写进 `docs/`（而不是在代码里手抄）✓
 */
export const TANGRAM_CHALLENGE = {
  perDifficulty: 6,      // 每档入场 6 个
  reserve: 12,           // 每档储备 12 个（"每次时空随机"要用）
  difficulties: [
    { id: "d1", name: "入门", desc: "凸轮廓、贴边块多（解法最多）" },
    { id: "d2", name: "简单", desc: "凸轮廓为主" },
    { id: "d3", name: "普通", desc: "开始出现凹轮廓" },
    { id: "d4", name: "进阶", desc: "凹且有内凹角" },
    { id: "d5", name: "困难", desc: "轮廓边数多、贴边块少" },
    { id: "d6", name: "极难", desc: "解法最少（唯一解那一档）" },
  ],
};

/**
 * ★★★ 2026（用户裁定）**拼装挑战的奖励结构** —— 三点必须记住：
 *   · 「软上限」是**前期**规矩；后期该给**强力档** ✓
 *   · 但**红线**：任何奖励都不许让 IP 反馈回 IP（那会把 `p` 推向 1 ⇒ 有限时间爆炸）✗
 *   · ⇒ 强力档只能锚在 **knee / 指数项 / 结构性** 上：**抬 knee 不改变渐近指数** ⇒ `p` 一点不动 ✓
 *     （而「抬乘数」在后期被 knee 压平 ⇒ 等于没给，这正是 +N% 表无用的原因）
 *
 * ⚠️ 数值是**初稿**，要经 `stage-timing` 实测再定 ✓（本项目规矩：以实际说话）
 * ⚠️ 用户点出的对应关系：**免费 ZPE 引擎等级 ≈ 抬高「最终获得的基础物质」**（同一件事的两种说法）✓
 */
export const TANGRAM_CHALLENGE_REWARDS = {
  /**
   * ★★★ 2026（用户：「想想更强力的加成吧」）—— **强力档的唯一定律**：
   *   不改 `p`（不把 IP 反馈回 IP）⇒ 只能锚在 **knee 位移 / 指数项 / 结构性** 上 ✓
   *   （纯乘区在后期会被 knee 压平 ⇒ 等于没给 ✗）
   *
   *   每档清满 6 个 ⇒ 该档的结构性奖励（比初稿强 5~10 倍）：
   *     d1 EP 折扣 10%         d2 折扣 20% + 保底 150→120
   *     d3 免费引擎 +10 级      d4 熵→粒子斜率 ×10
   *     d5 计数频率每级系数 ×5   d6 `ipDouble` knee ×3
   *   d3+d4 全清 ⇒ 每秒 1% 本次无限 IP（AD TS181）｜六档全清 ⇒ deGain 每级 1.14 + e308.25 硬保证 ✓
   */
  epDiscountByTier: [0.10, 0.20, 0.35, 0.50, 0.65, 0.80],
  /** 清满该档 ⇒ 暗能量基础收益的 knee 倍率（曲线右移，不改 p）✓ */
  deKneeMultByTier: [1, 1, 1.5, 2.0, 3.0, 4.0],
  /** 清满该档 ⇒ `ipDouble` 软上限的 knee 倍率（后期真正提速）✓ */
  ipDoubleKneeMultByTier: [1, 1, 1, 1, 2.0, 3.0],
  /** 清满该档 ⇒ 免费 ZPE 引擎等级（≈ 抬高最终基础物质）✓ */
  freeZpeEngineLevelsByTier: [0, 0, 10, 25, 50, 100],
  /** 清满该档 ⇒ 熵→粒子斜率倍率（横轴）✓ */
  convSlopeMultByTier: [1, 1, 1, 10, 1, 1],
  /** 清满该档 ⇒ 计数频率每级系数倍率（斜轴）✓ */
  countFreqMultByTier: [1, 1, 1, 1, 5, 1],
  /** 清满该档 ⇒ 抽取保底次数（越小越强）✓ */
  pityFloorByTier: [150, 120, 150, 150, 150, 150],
  /**
   * ★★★ 2026（用户：「基于**本次永恒**完成的拼装挑战数量，增幅**每对量子的实际数量**」）——
   *   每完成 1 个挑战 ⇒ 每对量子 +10%（乘区，**本次永恒内累计**，永恒后归零 ✓）
   *   36 个全清 ⇒ ×(1 + 3.6) = ×4.6 ✓（待用户标定，改这一个数即可 ✓）
   */
  perClearQuantumPairMult: 0.10,
  /** 每档需要清满几个 */
  perTier: 6,
  /** 结构性奖励（不等价于任何乘区）✓ */
  structural: {
    midAllClearPassiveIp: 0.01,
    allClearDeGainPerLevel: 1.14,
    allClearGoalLog10: 308.25,
  },
};

/**
 * **奖励的唯一聚合入口**（引擎各处只准读它，不许自己算）✓
 * @param {number[]} clearedByDifficulty 每档已清图案数（长度 6；缺省 = 全 0 ⇒ **全部为基线**）
 * @returns {{epDiscount:number, deKneeMult:number, ipDoubleKneeMult:number, freeZpeEngineLevels:number, passiveIpFrac:number, allClear:boolean}}
 */
export function tangramRewardEffects(clearedByDifficulty) {
  const R = TANGRAM_CHALLENGE_REWARDS;
  const arr = Array.isArray(clearedByDifficulty) ? clearedByDifficulty : [];
  const n = (d) => Math.min(R.perTier, Math.max(0, Math.floor(Number(arr[d] ?? 0))));
  let epDiscount = 0;
  let deKneeMult = 1;
  let ipDoubleKneeMult = 1;
  let freeZpeEngineLevels = 0;
  let midAll = true;
  let allClear = true;
  for (let d = 0; d < 6; d++) {
    const k = n(d);
    epDiscount += R.epDiscountByTier[d] * (k / R.perTier);      // 按进度线性 ✓
    if (k >= R.perTier) {                                        // 清满才生效 ✓
      deKneeMult = Math.max(deKneeMult, R.deKneeMultByTier[d]);
      ipDoubleKneeMult = Math.max(ipDoubleKneeMult, R.ipDoubleKneeMultByTier[d]);
      freeZpeEngineLevels += R.freeZpeEngineLevelsByTier[d];
    }
    // ★ 2026（用户：「参考 ad 的时间研究 181 **在第 4 层完成时**获得」）⇒ 门槛 = **第 4 档全清** ✓
    if (d === 3 && k < R.perTier) midAll = false;
    if (k < R.perTier) allClear = false;
  }
  // ★ 2026：新增三项（斜率 / 计数频率 / 保底）—— 取"已清满的最高档"值 ✓
  let convSlopeMult = 1;
  let countFreqMult = 1;
  let pityFloor = 150;
  for (let d = 0; d < 6; d++) {
    if (n(d) < R.perTier) continue;
    convSlopeMult = Math.max(convSlopeMult, R.convSlopeMultByTier?.[d] ?? 1);
    countFreqMult = Math.max(countFreqMult, R.countFreqMultByTier?.[d] ?? 1);
    pityFloor = Math.min(pityFloor, R.pityFloorByTier?.[d] ?? 150);
  }
  return {
    epDiscount: Math.min(0.9, epDiscount),
    deKneeMult,
    ipDoubleKneeMult,
    freeZpeEngineLevels,
    convSlopeMult,
    countFreqMult,
    pityFloor,
    passiveIpFrac: midAll ? R.structural.midAllClearPassiveIp : 0,
    allClear,
  };
}

/** 每档需要多少图案（6 入场 + 12 储备 = 18）✓ */
export function tangramPatternsPerDifficulty() {
  return TANGRAM_CHALLENGE.perDifficulty + TANGRAM_CHALLENGE.reserve;
}

/** 总需求（6 × 18 = 108）✓ */
export function tangramPatternsTotal() {
  return TANGRAM_CHALLENGE.difficulties.length * tangramPatternsPerDifficulty();
}

/**
 * **挑出某一档在某次时空里要用的 6 个图案**（从该档的 18 个里挑，可复现）✓
 *
 * 规则（自定，但**确定性**、可断言）：
 *   · 用 `seed`（= 时空次数）做 `mulberry32` 伪随机 ⇒ 同一 seed 每次结果相同 ✓
 *   · **不放回**地洗该档的 18 个索引，取前 6 个 ✓
 * @param {number} difficultyIdx 0..5
 * @param {number} seed 时空次数（未来由时空层传入）
 * @param {number} poolSize 该档实际拥有的图案数（枚举器产出多少就是多少；不足 18 也允许）
 * @returns {number[]} 该档本次要用的图案下标（长度 = min(6, poolSize)）
 */
export function pickChallengePatterns(difficultyIdx, seed, poolSize = tangramPatternsPerDifficulty()) {
  const d = Math.max(0, Math.floor(Number(difficultyIdx) || 0));
  const n = Math.max(0, Math.floor(Number(poolSize) || 0));
  const want = Math.min(TANGRAM_CHALLENGE.perDifficulty, n);
  // 该档的 18 个图案在下标空间里是连续的一段 ✓
  const base = d * tangramPatternsPerDifficulty();
  const idx = [];
  for (let k = 0; k < n; k++) idx.push(base + k);
  // mulberry32（32 位、确定、无依赖）✓
  let s = (Math.floor(Number(seed) || 0) * 2654435761) >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let k = idx.length - 1; k > 0; k--) {           // 洗牌（Fisher–Yates）✓
    const j = Math.floor(rnd() * (k + 1));
    [idx[k], idx[j]] = [idx[j], idx[k]];
  }
  return idx.slice(0, want);
}

// ══════════ 2026：图案指纹（与枚举器 `tools/tangram-patterns.mjs` 同一套算法）══════════
//   ⚠️ 这四支是**图案库 key** 的解码/编码器 —— 挑战判定就是「玩家的摆位指纹 == 目标指纹」✓
//   表示：每单位格按两条对角线切成 4 个小三角（0=下 1=右 2=上 3=左）⇒ 七块板恰好是若干小三角的并
/** 小三角的三个顶点（UI 画目标轮廓要用）✓ */
export const TRI_VERTS_FOR_UI = (x, y, t) => {
  switch (t) {
    case 0: return [[x, y], [x + 1, y], [x + 0.5, y + 0.5]];
    case 1: return [[x + 1, y], [x + 1, y + 1], [x + 0.5, y + 0.5]];
    case 2: return [[x + 1, y + 1], [x, y + 1], [x + 0.5, y + 0.5]];
    default: return [[x, y + 1], [x, y], [x + 0.5, y + 0.5]];
  }
};
const TRI_CENTERS = (x, y) => [
  [x + 0.5, y + 1 / 3], [x + 2 / 3, y + 0.5], [x + 0.5, y + 2 / 3], [x + 1 / 3, y + 0.5],
];

/** 一块板覆盖的小三角 `[[x,y,t], …]` ✓ */
export function polygonCells(verts) {
  const xs = verts.map((p) => p[0]);
  const ys = verts.map((p) => p[1]);
  const out = [];
  for (let x = Math.floor(Math.min(...xs)); x < Math.ceil(Math.max(...xs)); x++) {
    for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y++) {
      const cs = TRI_CENTERS(x, y);
      for (let t = 0; t < 4; t++) if (pointInConvex(verts, cs[t])) out.push([x, y, t]);
    }
  }
  return out;
}

const T8 = [];
for (let r = 0; r < 4; r++) for (const f of [false, true]) T8.push({ r, f });
function transformCell([x, y, t], { r, f }) {
  let nx = x, ny = y, nt = t;
  if (f) { nx = -x - 1; nt = [0, 3, 2, 1][nt]; }
  for (let i = 0; i < r; i++) { const tx = -ny; const ty = nx; nx = tx; ny = ty; nt = (nt + 1) % 4; }
  return [nx, ny, nt];
}

/**
 * **图案指纹**：小三角集合 → 8 种对称里**字典序最小**的规范化键 ✓
 *   ⇒ 旋转/镜像/平移的同一形状得到同一个键 ✓（与图案库里的 `key` 同一套算法）
 */
export function cellsFingerprint(cells) {
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

/** 指纹 → 小三角集合（解码；用于把目标画出来）✓ */
export function cellsFromFingerprint(key) {
  if (!key) return [];
  return key.split("|").map((s) => s.split(",").map(Number));
}

/** 玩家当前摆位的**并集小三角**（只看真的放下的块）✓ */
export function placedCells(placed) {
  const out = [];
  for (const p of TANGRAM_PIECES) {
    const cfg = placed?.[p.id];
    if (!cfg) continue;
    out.push(...polygonCells(placePieceVerts(p, cfg)));
  }
  // 去重（相邻块共边时会有重复的小三角）
  return [...new Map(out.map((c) => [`${c[0]},${c[1]},${c[2]}`, c])).values()];
}

/** 目标正方形的边长（= 4×4 整数网格；见 `TANGRAM.md` §5.3 的尺寸推导） */
export const TANGRAM_SIZE = 4;

/**
 * 七块板 —— 顶点坐标落在 `0..4` 的整数点上，**七块恰好铺满 4×4 正方形**（面积和 = `16`）。
 *
 * ★★★ 2026：这批坐标**不是手推的** —— 手推的第一版被 `tangram-lab` 的
 *   「互不重叠 / 铺满」两条断言当场抓住（正方形与平行四边形重叠、94.1% 覆盖有空洞）✗
 *   ⇒ 改成**小规模回溯搜索**求出来的：已知两块大三角铺满左下半边（已独立验证 ✓），
 *     于是只需把**右上半边**（直角边 4 的等腰直角三角形，面积 8）切成
 *     中三角(2) + 2×小三角(1+1) + 正方形(2) + 平行四边形(2) ✓
 *     搜索条件 = 「都在目标内 + 两两不重叠 + 面积和相等」⇒ 面积相等即**恰好铺满** ✓
 *   ⇒ 面积分数与 `TANGRAM.md` §5.3 的表**逐条一致**（由 `tangram-lab` 的 ① 守着）✓
 */
export const TANGRAM_PIECES = [
  { id: "largeA", name: "大三角 I", frac: 4 / 16, verts: [[0, 0], [4, 0], [2, 2]] },
  { id: "largeB", name: "大三角 II", frac: 4 / 16, verts: [[0, 0], [2, 2], [0, 4]] },
  { id: "medium", name: "中三角", frac: 2 / 16, verts: [[4, 4], [4, 2], [2, 4]] },
  { id: "smallA", name: "小三角 I", frac: 1 / 16, verts: [[3, 3], [2, 2], [3, 1]] },
  { id: "smallB", name: "小三角 II", frac: 1 / 16, verts: [[2, 4], [1, 3], [0, 4]] },
  { id: "square", name: "正方形", frac: 2 / 16, verts: [[2, 4], [1, 3], [2, 2], [3, 3]] },
  { id: "para", name: "平行四边形", frac: 2 / 16, verts: [[3, 3], [4, 2], [4, 0], [3, 1]] },
];

/** 三条轴（设计稿 §1）：都用「起点 → 终点」表示；比例 = 已覆盖长度 ÷ 全长 ✓ */
export const TANGRAM_AXES = [
  { id: "vert", name: "纵轴 · 左边缘", from: [0, 0], to: [0, TANGRAM_SIZE] },
  // ★ 2026（用户：「判定区的**下侧线移动到上侧**就行了」）—— 横轴改到**上边缘** ✓
  { id: "horz", name: "横轴 · 上边缘", from: [0, TANGRAM_SIZE], to: [TANGRAM_SIZE, TANGRAM_SIZE] },
  { id: "diag", name: "斜轴 · 主对角线", from: [0, 0], to: [TANGRAM_SIZE, TANGRAM_SIZE] },
];

// ── 基础几何（全部纯函数）────────────────────────────────

/** 多边形面积（鞋带公式取绝对值；顶点顺序无所谓） */
export function polygonArea(verts) {
  let s = 0;
  for (let i = 0; i < verts.length; i++) {
    const [x1, y1] = verts[i];
    const [x2, y2] = verts[(i + 1) % verts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** 点是否落在**凸**多边形内（含边界）—— 用「同侧判定」：所有边的叉积同号 ✓ */
export function pointInConvex(verts, [px, py]) {
  let pos = false;
  let neg = false;
  for (let i = 0; i < verts.length; i++) {
    const [x1, y1] = verts[i];
    const [x2, y2] = verts[(i + 1) % verts.length];
    const cross = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
    if (cross > 1e-9) pos = true;
    if (cross < -1e-9) neg = true;
    if (pos && neg) return false;          // 落在某条边的两侧 ⇒ 在外面
  }
  return true;                              // （含全部叉积为 0 的退化情形 = 在边上）
}

/** 旋转 90°×`rot`（绕原点；整数坐标旋转后仍是整数） */
export function rotateVerts(verts, rot) {
  const r = ((rot % 4) + 4) % 4;
  return verts.map(([x, y]) => {
    if (r === 0) return [x, y];
    if (r === 1) return [-y, x];
    if (r === 2) return [-x, -y];
    return [y, -x];
  });
}

/** 镜像（沿 y 轴翻 = `x → -x`）—— 设计稿里的 `F` 翻转键 ✓ */
export function flipVerts(verts) {
  return verts.map(([x, y]) => [-x, y]);
}

/**
 * 把一块板摆到棋盘上：**翻转 → 旋转 → 平移**（顺序固定，便于复现）✓
 * @returns {number[][]} 变换后的顶点（整数，若输入与 `dx/dy` 都是整数）
 */
export function placePieceVerts(piece, { rot = 0, flip = false, dx = 0, dy = 0 } = {}) {
  let v = piece.verts.map((p) => [p[0], p[1]]);
  if (flip) v = flipVerts(v);
  v = rotateVerts(v, rot);
  return v.map(([x, y]) => [x + dx, y + dy]);
}

/**
 * **吸附**：把落点吸到最近的**整数格点**（设计稿的「边缘吸附 / 顶点吸附」的基础层）。
 * ⚠️ 完整版还应吸到"已有板块的顶点/边"；那属于后续（见 `TANGRAM.md` §7 的 ④），
 *   本函数只做**格点吸附**这一层，够开工且可断言 ✓
 */
export const snapPoint = ([x, y]) => [Math.round(x), Math.round(y)];

/**
 * 一条线段落进某**凸**多边形的参数区间（`t ∈ [0,1]`，线段由 `A + t(B−A)` 给出）。
 * 做法：把"在凸多边形内"拆成**每条边的半平面约束**，逐个与当前区间求交 ✓
 * @returns {[number, number] | null} 
ull` = 不相交
 */
export function lineIntervalInConvex(verts, A, B) {
  const [ax, ay] = A;
  const [bx, by] = B;
  let lo = 0;
  let hi = 1;
  // 统一的**逆时针**方向：面积 > 0 时（鞋带为正）叉积 > 0 表示"内侧" ✓
  const ccw = polygonSignedArea(verts) > 0;
  for (let i = 0; i < verts.length; i++) {
    const [x1, y1] = verts[i];
    const [x2, y2] = verts[(i + 1) % verts.length];
    // 边 (x1,y1)→(x2,y2) 的内侧法线约束：cross(edge, P - p1) ≥ 0（逆时针时）
    const ex = x2 - x1;
    const ey = y2 - y1;
    const sgn = ccw ? 1 : -1;
    // f(t) = sgn · cross(edge, A + t(B−A) − p1) ≥ 0
    const c0 = sgn * (ex * (ay - y1) - ey * (ax - x1));
    const c1 = sgn * (ex * (by - ay) - ey * (bx - ax));
    if (Math.abs(c1) < 1e-12) {
      if (c0 < -1e-9) return null;          // 平行且在体外 ⇒ 整段都不在
      continue;
    }
    const t = -c0 / c1;                     // c0 + t·c1 = 0 的根
    if (c1 > 0) lo = Math.max(lo, t);       // 约束随 t 增大而满足 ⇒ 下界
    else hi = Math.min(hi, t);              // 反之是上界
    if (lo > hi + 1e-12) return null;
  }
  return [Math.max(0, lo), Math.min(1, hi)];
}

/** 有符号面积（鞋带；只看符号，用来判顶点绕向） */
function polygonSignedArea(verts) {
  let s = 0;
  for (let i = 0; i < verts.length; i++) {
    const [x1, y1] = verts[i];
    const [x2, y2] = verts[(i + 1) % verts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

/** 线段长度 */
export function segLength(A, B) {
  return Math.hypot(B[0] - A[0], B[1] - A[1]);
}

/**
 * **一条轴被已放置的板块覆盖了多少**（设计稿的核心量）：
 * 取所有板块在该线上交出的区间的**并集**长度 ÷ 全长 ✓
 * ⚠️ 「边、点、面覆盖都算」⇒ 用"线是否落在板内（含边界）"判定，正是并集长度 ✓
 * @param {number[][][]} placed 已放置板块的顶点数组
 * @param {{from:number[],to:number[]}} axis
 * @returns {number} 0..1
 */
export function axisCoverage(placed, axis) {
  const A = axis.from;
  const B = axis.to;
  const ivs = [];
  for (const verts of placed) {
    const iv = lineIntervalInConvex(verts, A, B);
    if (iv && iv[1] > iv[0] + 1e-12) ivs.push(iv);
  }
  if (!ivs.length) return 0;
  ivs.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curLo, curHi] = ivs[0];
  for (let i = 1; i < ivs.length; i++) {
    const [lo, hi] = ivs[i];
    if (lo <= curHi + 1e-12) curHi = Math.max(curHi, hi);   // 有重叠 ⇒ 合并
    else { total += curHi - curLo; [curLo, curHi] = [lo, hi]; }
  }
  total += curHi - curLo;
  return Math.min(1, Math.max(0, total));
}

/**
 * **三条轴的覆盖率**（= 设计稿里三条轴的加成输入）。
 * ⚠️ 这里是**唯一的计算入口** —— UI 与将来的引擎都必须调它（显示 == 实发）✓
 * @returns {{vert:number,horz:number,diag:number}}
 */
export function axisCoverageAll(placed) {
  const out = {};
  for (const ax of TANGRAM_AXES) out[ax.id] = axisCoverage(placed, ax);
  return out;
}

/** 两块**凸**板是否重叠 —— SAT（分离轴定理）；整数坐标下精确，不靠采样 ✓ */
export function convexOverlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      // 该边的法线作为分离轴
      const nx = -(y2 - y1);
      const ny = x2 - x1;
      let aMin = Infinity; let aMax = -Infinity;
      let bMin = Infinity; let bMax = -Infinity;
      for (const [px, py] of a) { const d = px * nx + py * ny; aMin = Math.min(aMin, d); aMax = Math.max(aMax, d); }
      for (const [px, py] of b) { const d = px * nx + py * ny; bMin = Math.min(bMin, d); bMax = Math.max(bMax, d); }
      // ⚠️ 用**严格**分离（留 1e-9 容差）：共边（贴在一起）不算重叠 ✓
      if (aMax <= bMin + 1e-9 || bMax <= aMin + 1e-9) return false;
    }
  }
  return true;
}
