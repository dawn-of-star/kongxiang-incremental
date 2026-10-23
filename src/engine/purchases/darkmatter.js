/**
 * engine/purchases/darkmatter.js —— 暗物质购买（永恒之后第一块）
 *
 * ★ 2026 模块化：由 512 行的 engine/purchases.js 拆出（声明与注释逐字保留）。
 *    对外统一从 `src/engine.js`（barrel）导入。
 */
import { darkMatterAffordableIn, darkMatterCostFor, darkMatterCount, darkMatterEffectMult, darkMatterPriceAt, darkMatterUnlocked } from "../../config.js";
import { pushLevelLog, pushLog } from "../../state.js";
import { fmt } from "../../format.js";

export function buyDarkMatter(state, k = null) {
  if (!darkMatterUnlocked(state)) return 0;            // 未达成 em4 ⇒ 未解锁（唯一判据）
  if (!state?.eternityPoints?.gte) return 0;           // 防御：EP 字段缺失/坏档
  const before = darkMatterCount(state);
  if (!state.eternityPoints.gte(darkMatterPriceAt(before))) return 0;  // 连第一个都买不起
  const want = k == null
    ? darkMatterAffordableIn(before, state.eternityPoints)
    : Math.max(0, Math.floor(Number(k) || 0));
  if (!(want > 0)) return 0;
  const total = darkMatterCostFor(before, want);       // 逐级真价之和（与探针同源）✓
  if (state.eternityPoints.lt(total)) return 0;        // 兜底：探针与总价必须一致
  state.eternityPoints = state.eternityPoints.sub(total);
  state.eternityDarkMatter = before + want;
  // 日志走**统一入口** `pushLevelLog` ⇒ 只在跨过关键节点（1/5/10/50/…）时写一条 ✓
  //   （本项目日志策略：重复购买类升级不许逐级刷屏 —— 见 state.js 的 KEY_LEVELS ✓）
  pushLevelLog(state, "暗物质", before, before + want);
  // ★★ 但**效果变化**必须让玩家看见（用户原则：「没有 ui 真的很容易误判」）：
  //   转化值是暗物质与第二台速度的**乘积**（`min(1,v2/v2Ref)` 那一半可能还没满），
  //   所以"买了但没涨"是可能发生的 ⇒ 把当前转化值一并写进日志 ✓
  const eff = darkMatterEffectMult(state);
  if (Number.isFinite(eff) && eff > 1) {
    pushLog(state, `⬆ 暗物质转化值 → ×${fmt(eff, 4)}（第二台：${fmt(darkMatterEffectMult(state) - 1, 4)} 加进暗能量倍率的加法区）`);
  }
  return want;
}

// ══════════════════════════════════════════════════════════
// ★ 永恒（手动触发；门槛 = 无限点 1e308.25 —— 见 `ETERNITY.goalLog10`）
// ══════════════════════════════════════════════════════════

/**
 * ★★ 2025 em1（永恒里程碑 1）：「每次永恒后保留非重复购买的无限升级（每 2 次永恒保留 1 个）」
 *
 * 保留几个 = `floor(永恒次数 / 2)`（用**本次永恒之后**的次数，见调用点）。
 * 保留哪些 = 取 `INFINITY_ORDER` 里**非重复购买**条目的**末尾 N 个** ——
 *   该数组大体按"从便宜到贵"排列 ⇒ 末尾就是**最贵**的 ⇒ 保留价值最高（越贵越难重新买回）✓
 *
 * ⚠️ 必须**幂等**：它只把对应标记设 `true`，不清任何东西（`doEternity` 会先全清再调它）。
 * @returns {string[]} 本次保留的升级 id（供日志/自检）
 */

