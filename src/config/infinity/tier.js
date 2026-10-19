/**
 * config/infinity/tier.js —— 档位里程碑（挂在破∞后的大坍缩次数上）
 *
 * ★ 2026 模块化：由 1,009 行的 config/infinity.js 拆出（声明与注释逐字保留）。
 *    对外统一从 `src/config.js`（barrel）导入。
 */
import { hasCollapse } from "../milestones.js";
import { QUANTUM } from "../quantum.js";
import Decimal from "../../../dist/break_eternity.esm.js";

/**
 * config/infinity.js —— 无限层：门槛、过载、∞ 升级、IP 经济、无限增幅、档位里程碑
 *
 * ⚠️ 本文件由 `src/config.js` 按领域机械拆分而来：**声明与注释逐字保留**。
 *    对外仍然统一从 `src/config.js`（barrel）导入 —— 不要直接改这里的 import 路径。
 *    依赖：milestones, quantum, dark-matter ｜ Decimal
 */




export const TIER_MILESTONES = [
  /**
   * ⚠️ 2025：原来 7 条里有 **4 条是 `kind:"cap"`（"铸币每档上限 +N"）** ——
   *   铸币整个删除后它们是**死数据**（`cap` 没有任何读取方），
   *   而 UI 会把 `desc` 原样显示给玩家 ⇒ 面板上写着"铸币每档上限 +3"这种不存在的机制 ✗
   *   ⇒ 用户要求"赶紧把无限子页面的东西改了" ⇒ 这 4 条改成**已经接线**的 `lube`：
   *     `tierQuantumStepMult()` 里 `k = 1 − Σ(value/20)/2` —— 把量子门槛步长从 ×20 缓到 ×19.5 那一族，
   *     落在「打破无限 → 永恒」那段的承重机制上（量子来得更早 ⇒ 跨度幂 k 与 b 都更早起来）✓
   */
  { at: 3, id: "tm-lube1", kind: "lube", value: 0.5, desc: "量子润滑：门槛步长 ×20 → ×19.5" },
  { at: 6, id: "tm-rate1", kind: "rate", value: 1.05, desc: "成长速率 ×1.05" },
  { at: 9, id: "tm-lube2", kind: "lube", value: 0.5, desc: "量子润滑：门槛步长再缓一档（→ ×19.0）" },
  { at: 12, id: "tm-lube3", kind: "lube", value: 0.5, desc: "量子润滑：门槛步长再缓一档（→ ×18.5）" },
  { at: 15, id: "tm-rate2", kind: "rate", value: 1.05, desc: "成长速率 ×1.05（累计 ×1.1025）" },
  { at: 18, id: "tm-lube4", kind: "lube", value: 0.5, desc: "量子润滑：门槛步长再缓一档（→ ×18.0）" },
  { at: 24, id: "tm-lube5", kind: "lube", value: 0.5, desc: "收尾：量子润滑再来一档（→ ×17.5）" },
];

/** 已解锁的档位里程碑（大坍缩次数 ≥ at） */
export function tierMilestonesDone(state) {
  const n = state.bigCrunchCount instanceof Decimal ? state.bigCrunchCount.min(1e15).toNumber() : Number(state.bigCrunchCount) || 0;
  return TIER_MILESTONES.filter((m) => n >= m.at);
}

/** 铸币**每档上限**（基础 30 + 里程碑累加）—— 档数压缩就是靠它 */


/** 档位里程碑给的成长速率倍率（并入 infinityRateMult，保持单一入口） */
export function tierRateMult(state) {
  let m = 1;
  for (const x of tierMilestonesDone(state)) if (x.kind === "rate") m *= x.value;
  return m;
}

/** 档位里程碑给的"量子润滑"：门槛步长的额外倍率（1 = 无缓和） */
export function tierQuantumStepMult(state) {
  let k = 1;
  for (const m of tierMilestonesDone(state)) if (m.kind === "lube") k *= 1 - m.value / (state && hasCollapse(state, "cm7") ? 22 : QUANTUM.zpeCostGrowth) / 2;
  return k;
}

/**
 * ★ 永恒层（先占位：只有门槛与永恒点公式，内容待设计）
 *
 * 永恒点公式**照 AD 抄**（`src/core/secret-formula/multiplier-tab/eternity-points.js`）：
 *
 *   AD: `DC.D5.pow( log10(maxIP) / (308 − Pelle) − 0.7 )`
 *   即  **永恒点 = floor( 5^(log10(IP)/308 − 0.7) )**
 *
 * 代入门槛验算：`5^(308.25/308 − 0.7) = 5^0.3008 = 1.62` → floor = **1 点** ✓
 * （AD 第一次永恒也正好给 1 点，手感一致。）
 *
 * ⚠️ 两条与物质层**刻意不同**的地方（用户指定）：
 *   1. 永恒点只由 **无限点**决定，与物质深度无关；
 *   2. **没有**「到 1e308.25 强制坍缩」那种硬顶机制 —— 永恒是**手动**触发的，
 *      到了门槛不会自己重置（强制坍缩只存在于物质层）。
 */
