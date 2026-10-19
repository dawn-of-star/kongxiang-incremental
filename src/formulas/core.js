/**
 * formulas/core.js —— 基础工具：D / floorDiv / 等比求和 / 梦想系数 / 按 kind 聚合
 *
 * ★ 2026 模块化：由 1,116 行的 formulas.js 按领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/formulas.js`（barrel）导入。
 */
import { REPEATABLE } from "../config.js";
import { hasVoid, levelOf } from "../state.js";
import Decimal from "../../dist/break_eternity.esm.js";


// ★★★ 2026：七巧板三条轴的加成（设计稿 docs/TANGRAM.md §2 已勘定的落点）✓


// ★ 2026：挑战奖励系数（乘一个数，不改形状 ⇒ p 不变 ✓）

/**
 * formulas.js —— 全部计算（纯函数，不碰 DOM）
 *
 * 从 0.3.4 的 engine.js 移植。所有派生值都在这里算，state 只存原始数据。
 * 纯函数的好处：能在 Node 里直接跑无头测试（见 tools/headless.mjs）。
 *
 * ⚠️ 大数一律用 Decimal.pow，绝不用 Math.pow。
 *    JS 的 Number 上限是 1.8e308，Math.pow(4, 512) 就会溢出成 Infinity
 *    并被 D() 转成 dInf，污染整条链。SPEC §5.3
 */




const D = (v) => new Decimal(v ?? 0);
export { D };

/**
 * `floor(x / y)`，并且**对 Decimal 除法的舍入免疫**。
 *
 * ⚠️ 这是一个真踩过的坑，不要退回 `x.div(y).floor()`：
 *
 *   break_eternity 的 `div` 只保留约 15~16 位有效数字，商会被**四舍五入**。
 *   当真实商非常接近整数、但落在整数下方时，`div` 会把它抬到整数上，
 *   于是 `floor()` 多出一格：
 *
 *       x = 16215948575620.594        y = 0.033665705190560606
 *       真值   x/y = 481675594906810.94   -> floor = …810
 *       div 给出   481675594906811       -> floor = …811   ← 多一格
 *
 *   后果（实测）：熵 → 粒子的转换多扣一次阈值，余量变成
 *   **-0.001953125**，界面上出现「余 -0.0019」这种负数。
 *   同一类隐患也在所有「闭式解反推买得起几级」的地方。
 *
 * 所以这里向下取整之后再回退校验一次：`q×y` 不许超过 `x`。
 * 最多退 4 次（真实误差只有 1 格，写 4 是为了防御性），常数代价。
 */
export function floorDiv(x, y) {
  let q = x.div(y).floor();
  for (let i = 0; i < 4 && q.gt(0) && q.mul(y).gt(x); i++) q = q.sub(1);
  return q;
}

/** 等比数列前 n 项和：`first × (r^n − 1)/(r − 1)`（r = 1 时退化成 first×n） */
export function geometricSum(first, r, n) {
  return r === 1
    ? first.mul(n)
    : first.mul(Decimal.pow(r, n).sub(1)).div(r - 1);
}

/**
 * 把「闭式解反推出的级数」下调到**真正买得起**的那一档。
 *
 * `log`/`div` 都有舍入，反推出来的 n 偶尔会比实际能买的级数多 1，
 * 此时总价会略微超过资源 —— 老代码是直接 `return 0`（玩家点了「买满」却什么都没发生）。
 */
export function clampToAffordable(first, r, pool, n) {
  let k = n;
  for (let i = 0; i < 4 && k > 1 && pool.lt(geometricSum(first, r, k)); i++) k -= 1;
  return k;
}

// ══════════════════════════════════════════════════════════
// 全局加成
// ══════════════════════════════════════════════════════════

/** 梦想点的系数。v4 把它从 0.02 提到 0.08。 */
export function dreamCoefficient(state) {
  return hasVoid(state, "v4") ? 0.08 : 0.02;
}

/**
 * 某个乘区里所有可重复升级的乘积。
 *
 * 升级按 config 里的 `kind` 归类，所以加一条新的乘法升级只需要在
 * config 的 REPEATABLE 里加一条，不用改这里。
 *
 * 这也是 SPEC 判据 P7 的体现：纯乘法链上因子位置无关，
 * 所以「作用在物质产出上的所有乘法升级」可以合成一个乘积。
 */
export function kindProduct(state, kind) {
  let m = D(1);
  for (const cfg of Object.values(REPEATABLE)) {
    if (cfg.kind !== kind) continue;
    const lv = levelOf(state, cfg.id);
    if (lv.lte(0)) continue;
    m = m.mul(Decimal.pow(cfg.effect, lv));
  }
  return m;
}

/** 计数频率里由可重复升级贡献的加法项：1 + Σ(k·等级) */
