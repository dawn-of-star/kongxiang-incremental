/**
 * formulas/global.js —— 全局加成及其三因子分解
 *
 * ★ 2026 模块化：由 1,116 行的 formulas.js 按领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/formulas.js`（barrel）导入。
 */
import { REPEATABLE, hasCollapse, nekoGlobalExponent } from "../config.js";
import { D, dreamCoefficient } from "./core.js";
import { darkEnergyMultiplier } from "./dark-energy.js";
import { levelOf } from "../state.js";
import { tangramCountFreqMult } from "../tangram-bonus.js";
import { rewardCountFreqMult } from "../tangram-reward.js";
import Decimal from "../../dist/break_eternity.esm.js";

export function countFreqAddTerm(state) {
  let extra = D(1);
  for (const cfg of Object.values(REPEATABLE)) {
    if (cfg.kind !== "countFreqAdd") continue;
    extra = extra.add(levelOf(state, cfg.id).mul(cfg.effectPerLevel ?? 0.05));
  }
  // ★ cm2：计数频率每级系数翻倍（0.05 -> 0.10）⇒ 把"超出 1 的部分" ×2
  if (hasCollapse(state, "cm2")) extra = D(1).add(extra.sub(1).mul(2));
  // ★★★ 2026：**斜轴**（覆盖率 ⇒ 计数频率每级系数 0.05 → 50）✓
  extra = D(1).add(extra.sub(1).mul(tangramCountFreqMult(state)));
  extra = D(1).add(extra.sub(1).mul(rewardCountFreqMult(state)));   // ★ 2026：d5 全清 ⇒ ×5 ✓
  return extra;
}

/**
 * **全局加成** = 梦想点项 × 计数频率项 × 暗能量项
 *
 * 它同时喂 `entropyRate` 与 `matterRate`（等于乘在环的两端），所以是**真·全局**：
 * 顶部有一个专门的「全局加成」槽显示这个乘积和它的三个因子（见 ui.js）。
 *
 * ⚠️ 命名歧义（踩过的坑）：`REPEATABLE.particleBoost` 那条升级叫「计数频率」，
 *    它只是这个乘积里的**一个因子**。别把两者混为一谈。
 *
 * ★ 原稿的 bug：算了 `dreamCoefficient` 但下面硬编码 0.02，导致 v4 完全无效。
 *   这里真的用它。
 */
export function globalMultiplier(state) {
  const dp = state.dreamPoints;
  const base = D(1).add(dp.mul(dreamCoefficient(state)));
  const total = base
    .mul(countFreqAddTerm(state))
    .mul(darkEnergyMultiplier(state));
  // ★★★ 2025（`docs/NEKO.md` §7 / §10）：**好感度 ⇒ 全局加成 ^指数**
  //   · 三档（>25 / >50 / >75）叠乘 ⇒ 指数 ∈ [1, 1.0221151]
  //   · 好感度为负 / 未达门槛 ⇒ 指数恒 1（**负面不影响游戏进程** ✓）
  //   · 幂运算必须走 `Decimal.pow`（`Math.pow` 在 1e308 量级会 Infinity ⇒ 本项目踩过 ✓）
  //   · 安全余量已论证（NEKO.md §7）：环增益 0.7263 → 0.7423，仍 < 1 ✓
  const nekoExp = nekoGlobalExponent(state);
  return nekoExp === 1 ? total : Decimal.pow(total, nekoExp);
  // ⚠️ 量子**不在这里**。
  //
  //   曾经把它放进 globalMultiplier（想让它「更全面」），但那是**最爆炸的乘区**：
  //   globalMultiplier 同时喂 entropyRate 和 matterRate，等于乘在环的两端，
  //   环增益拿到的是 Q² 而不是 Q。
  //
  //   实测（玩家反馈 + 隔离对照）：
  //     物质 1e27   有量子 2088s   无量子 4707s   -> 解锁瞬间给了约 52 倍加速
  //   而用户的原则是：**量子给的乘区不应该让物质一次跳到无限**。
  //
  //   现在量子作用在 entropyRate（单条产线），环增益只拿 Q。
}

/**
 * 全局加成的**分解**（顶部「全局加成」槽显示用）。
 *
 * 接口放在这里而不是 ui.js：显示必须来自同一个公式（SPEC「输出函数 == 运算函数」），
 * 否则又会出现「显示 ≠ 实际」。
 *
 * ★ 2025：加了好感度那一层**指数** ⇒ 分解里必须带上它，否则
 *   `dream × countFreq × de ≠ total`（三因子相乘再取幂）⇒ 显示会自相矛盾 ✗
 *   ⇒ 返回 `nekoExp`（1 = 未生效）与 `base`（取幂**之前**的乘积），
 *      让 UI 能显示 `base ^nekoExp` 这个**完整**表达式 ✓
 */
export function globalMultiplierParts(state) {
  const dream = D(1).add(state.dreamPoints.mul(dreamCoefficient(state)));
  const countFreq = countFreqAddTerm(state);
  const de = darkEnergyMultiplier(state);
  const base = dream.mul(countFreq).mul(de);
  const nekoExp = nekoGlobalExponent(state);
  const total = nekoExp === 1 ? base : Decimal.pow(base, nekoExp);
  return { dream, countFreq, de, base, nekoExp, total };
}

// ══════════════════════════════════════════════════════════
// 第四层：量子涨落 / 大坍缩
// ══════════════════════════════════════════════════════════
//
// ★ 原来的「临界坍缩阶梯」（阈值 ×1e5 递进 -> 暗物质 -> 10^DM）已整个删除。
//   它是「阶梯 3 秒」的形式性元凶：`10^DM` 把曲线平移了 1e560 个数量级。
//   现在第三层是**量子涨落**，由它提供指数成长速率（见 quantumGrowthRate）。
//
//   `collapseUnlocked` 保留原名（改名会波及 state/UI/工具），但语义已经变成
//   「**量子涨落是否已解锁**」—— 就是 `peakMatter >= 1e25`。

/** 第三层（量子涨落）是否已解锁 */
