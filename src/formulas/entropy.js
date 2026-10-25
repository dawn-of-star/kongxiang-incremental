/**
 * formulas/entropy.js —— 熵 / 粒子产出与熵→粒子转换
 *
 * ★ 2026 模块化：由 1,116 行的 formulas.js 按领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/formulas.js`（barrel）导入。
 */
import { BASE, DE_UPGRADES, REPEATABLE, engineBonusMult, hasCollapse, hasEternityMilestone, qOf, quantumEntropyMultiplier, transmuterIpMult, voidBoostMult } from "../config.js";
import { D } from "./core.js";
import { darkEnergyMultiplier } from "./dark-energy.js";
import { globalMultiplier } from "./global.js";
import { particleTimeBoost } from "./quantum.js";
import { deLevelOf, hasDe, hasV9, hasVoid, hasZpe, levelOf } from "../state.js";
import { tangramConvRateMult } from "../tangram/bonus.js";
import { rewardConvSlopeMult } from "../tangram/reward.js";
import { spaceDu5Mult } from "../space/core.js";
import { effectiveTraps, zpeMultiplier } from "./zpe.js";

export function entropyRate(state) {
  const v2 = hasVoid(state, "v2") ? D(1.5).mul(voidBoostMult(state)) : D(1);
  let r = effectiveTraps(state)
    .mul(globalMultiplier(state))
    .mul(BASE.trapBaseRate)
    .mul(zpeMultiplier(state))
    .mul(v2)
    // ★ 量子：作用在**熵产出**这条单线上（不是全局加成）。
    //   理由见 globalMultiplier 的注释 —— 放全局加成等于乘在环的两端，
    //   环增益会变成 Q²，物质会一次跳到无限。
    // ★★★ 2025（用户裁定）：量子→熵 也吃引擎倍率（5 条之一）。
    //   ⚠️ 它会让"引擎 → 熵 → 物质"多一条路径 ⇒ 由 `consistency` 与
    //      `zpe-engine-lab` 的环增益断言守（跑完必看）。
    .mul(quantumEntropyMultiplier(qOf(state), engineBonusMult(state)));
  if (hasDe(state, "dm3")) r = r.mul(darkEnergyMultiplier(state));
  return r;
}

/**
 * 物质产出速率（依赖当前粒子数）。
 *
 * ⚠️ **必须包含量子那一段指数项** —— 引擎里 `tick` 的公式是它加上这一项。
 *    这条是「输出函数 == 运算函数」的硬约束：我在引擎里加了项却没加在这里，
 *    `consistency.mjs` 立刻报「物质速率误差 82.74%」。
 */
export function conversion(state) {
  const lv = levelOf(state, "entropyCoeff");
  const cfg = REPEATABLE.entropyCoeff;

  // ⚠️ 这里原来有一个 `qe.convUncap` 分支（旧量子升级「解耦」把产出改成乘法）。
  //    那套量子升级系统已整体删除，分支永远是死路，已移除。
  let perLevel = D(cfg.outputPerLevel);
  // ★★★ 2026：**横轴**（覆盖率 ⇒ 熵→粒子速率 0.1 → 1e13）—— 直接乘在**斜率**上 ✓
  perLevel = perLevel.mul(tangramConvRateMult(state));
  perLevel = perLevel.mul(rewardConvSlopeMult(state));   // ★ 2026：挑战奖励（d4 全清 ⇒ ×10）✓
  if (hasVoid(state, "v5")) perLevel = perLevel.add(0.5);
  if (hasCollapse(state, "cm5")) perLevel = perLevel.mul(transmuterIpMult(state));   // ⑤ 相变仪随 IP（对数）
  // ★ 「凝聚斜率」：直接加在**斜率**上（不是乘一个倍率）。
  //   加法形式让转换率封顶在 perLevel/thresholdPerLevel；
  //   抬斜率才能把这个上限本身推高，而且因为 L ∝ log(资源)，
  //   上限只是**对数增长**，几乎不进 S 池。
  perLevel = perLevel.add(DE_UPGRADES.convOutput.perLevel * deLevelOf(state, "convOutput").toNumber());
  const output = D(BASE.autoConvertOutput).add(lv.mul(perLevel));

  let threshold = D(BASE.autoConvertCost).add(lv.mul(cfg.thresholdPerLevel));
  // （原来这里乘 `qe.convThresholdMul`，旧量子升级「量纲压缩」——已随系统删除）

  if (hasZpe(state, "m6")) {
    const divisor = hasV9(state) ? 2 : 1;
    threshold = threshold.div(zpeMultiplier(state).mul(divisor));
  }
  // ★ 原稿这里同时乘了分子和分母，数学上精确抵消（SPEC 判据 P9）。
  //   现在只降阈值。
  if (hasDe(state, "dm2")) {
    threshold = threshold.div(darkEnergyMultiplier(state));
  }
  // ⚠️ 2026：这里原来有 threshold.mul(icEntropyMult(state))（IC 放大熵需求）——
  //   **IC 整个系统已删除**（用户裁定）⇒ 那行移除 ✓
  if (hasCollapse(state, "cm3")) threshold = threshold.mul(0.5);   // ③ 100:1 -> 50:1
  // ★★ 2025 em6（永恒里程碑 6）：「熵到粒子的熵消耗再除以 1.2」
  //   放在**所有修正的最后**（与 cm3、IC 同一个位置）—— 顺序不影响乘除结果，
  //   但集中在这里便于审计"阈值到底被谁改过" ✓
  if (hasEternityMilestone(state, "em6")) threshold = threshold.div(1.2);
  return { threshold, output: output.mul(spaceDu5Mult(state)) };
}

/**
 * 粒子产出速率（每秒）。
 *
 * ★ 这里有一条**结构性**的边：量子升级「直接边」让 `物质 → 粒子` 直达。
 *
 * 为什么它重要：原本的链是
 *     物质 → 熵阱(价格×2, 产出+1) → 熵 → 粒子 → 物质
 * 而 `熵阱 ∝ log(物质)`，所以整条链是**亚指数**（实测 8.4 阶/对数时间）。
 *
 * 加上直接边后：
 *     dM/dt = k·P
 *     dP/dt = c + j·M          ← 新增的 j·M
 *     => d²M/dt² = k·c + k·j·M  ← M 自己出现在二阶导里 → **真指数**
 */
export function particleRate(state) {
  const { threshold, output } = conversion(state);
  // ⚠️ 这里原来有旧量子升级「直接边」的分支。那套系统已删除。
  //    （它当年会跑飞：d²M/dt² = k·c + k·j·M 里的 M 自反馈，
  //      增长率 √(k·j) 随全局加成一起涨，所以整条升级被废弃。）
  // ⚠️ dm4b **不在这里**。它作用于「相变转换速率」（ZPE→暗能量），
  //    不是「熵凝聚转换速率」（熵→粒子）。见 darkEnergyRate()。
  // ★ 量子 → 粒子获得的**时变增幅**（替代 R 的那个杠杆）：**必须与 `engine.js` 的 tick 同项**
  //   （踩过三次"显示 ≠ 实发"，根因每次都是"两处各算一遍基础产出"）。
  return entropyRate(state).div(threshold).mul(output).mul(particleTimeBoost(state));
}

// ══════════════════════════════════════════════════════════
// 价格
// ══════════════════════════════════════════════════════════

/**
 * 用于价格的 ZPE 倍率（m2 和 dm4 都会影响它）。
 * 原稿里这个函数的注释和代码差了 50 倍（注释说 0.001，代码是 0.05），这里统一成 0.05。
 */
