/**
 * engine/collapse.js —— 大坍缩 / 打破无限 / 重置
 *
 * ★ 2026 模块化：由 1,660 行的 engine.js 按动作领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/engine.js`（barrel）导入。
 */
import { BREAK_INFINITY, CRUNCH_AT_LABEL, INFINITY_UPGRADES, REPEATABLE, hasCollapse, infinityStartLog10, markPageUnlocked, quantumToIPGain } from "../config.js";
import { D, bigCrunchGain, canBigCrunch } from "../formulas.js";
import { sci } from "../format.js";
import { awardDream, pushLog } from "../state.js";
import Decimal from "../../dist/break_eternity.esm.js";
import { applyCollapseKeeps } from "../dream-effects.js";   // ★ 2026-10-22：暗能量永存 ⇒ 无限也不重置 DE ✓

export function breakInfinity(state) {
  if (state.brokenInfinity) return false;
  const cost = D(BREAK_INFINITY.unlockCost);
  if (state.infinityPoints.lt(cost)) return false;
  state.infinityPoints = state.infinityPoints.sub(cost);
  state.brokenInfinity = true;
  markPageUnlocked(state, "infinity");   // ★ 永久解锁记录（永恒后不再上锁）
  pushLog(state, "💠 打破无限！物质上限解除，大坍缩改为手动，收益随深度增长");
  awardDream(state, "breakInfinity", "打破无限");
  return true;
}

// ══════════════════════════════════════════════════════════
// 离线推进
// ══════════════════════════════════════════════════════════

/**
 * 推进 seconds 秒（可以很长）。
 *
 * 分段是为了让 ZPE 增长带来的 zpeMultiplier 变化被跟上 ——
 * 片内系数是常数，所以片内是精确积分，只有跨片的系数更新是近似的。
 */
export function resetForCollapse(state) {
  // ★ ∞ 层「起点跃迁」：把物质起点从 0 抬到 1e{startLog10}（没买就是 0，行为不变）。
  //   只抬**起点**，不碰上限 —— 所以它缩短的是距离，不是改形。
  const startLog = infinityStartLog10(state);
  state.resources.matter = startLog > 0 ? Decimal.pow(10, startLog) : D(0);
  state.resources.particle = D(0);
  state.resources.entropy = D(0);
  state.resources.traps = D(0);
  for (const id of Object.keys(REPEATABLE)) state.levels[id] = D(0);
  state.zpe = D(0);
  state.darkEnergy = D(1);   // ★ 不能归零：log10(0) = -Infinity ⇒ 下游 NaN ⇒ 全链冻结 ✗
  // 累积器无论如何都清（它是「本轮进度」，不是资产）
  //
  // ★ 这里原来清的是 `state.zpeAccumulator` —— 那是**旧模型的死字段**，
  //   全项目只有「新建 / 序列化 / 这一行」碰它，界面读的是 `state.deAccum`。
  //   于是相变环的进度在大坍缩后**留了下来**，和「本轮进度归零」的意图相反。
  //   两个都清：deAccum 是活的，zpeAccumulator 留给旧存档一个干净的默认值。
  state.deAccum = D(0);
  state.zpeAccumulator = D(0);
}

// ★ `doCollapse`（临界坍缩）已整个移除 —— 用户决定：暗物质不应存在。
//
//   它原本是「物质跨过阈值(×1e5 递进) -> 领暗物质 -> 全局加成 ×10^DM」的阶梯。
//   被删的理由是**形式性**的，不是调参问题：
//     基础成长 `M'' ∝ log(M)`，乘任何倍率 C 只能得到
//     `log10(M) ∝ 2·log10(t) + 常数(C)` —— 只平移常数项。
//     `10^DM` 累积到 1e560，把曲线平移了几百个数量级，
//     280 个数量级因此挤在 3 秒内跨过。
//
//   现在由**量子涨落**（`quantumGrowthRate`）提供 `∝ M` 的指数项，
//   1e25 -> 1e308.25 实测 1.76 小时。
//
//   `state.collapseThreshold` / `collapseCount` / `darkMatter` 字段也已从 state 删除。

/**
 * 大坍缩：物质到达 1e308.25（= log10(Number.MAX_VALUE)，JS 双精度上限，
 * 也正是 AD「首次无限」的触发点）。
 *
 * 给无限点，重置下层资源。**梦想点永不重置；量子会被重置**（用户明确）。
 */
export function doBigCrunch(state) {
  // ⚠️ 2026：这里原来有 icCompleteOnCrunch(state)（IC 通过判定）——
  //   **IC 整个系统已删除**（用户裁定）⇒ 那行移除 ✓

  if (!canBigCrunch(state)) return null;

  // ★ ∞ 层：大坍缩只发**深度部分**（④ 耗时收益已在 tick 里实时发过，这里再发就是重复发放）。
  //   ⚠️ 必须走 `bigCrunchGain()` 这个**唯一数据源** —— 它含 ① 的加成、铸币倍率、量子铸币。
  //      老写法自己算 `infinityPointGain × 3^①`，于是"界面显示"与"实际发放"会脱节。
  const ip = bigCrunchGain(state);
  const depthIP = ip.sub(quantumToIPGain(state));     // 纯深度部分（日志/显示用）
  const elapsed = state.infinityElapsed ?? 0;
  const timeAccrued = state.ipTimeAccrued ?? 0;       // 本轮实时累计（显示/日志用）

  state.infinityPoints = state.infinityPoints.add(ip);
  state.bigCrunchCount = state.bigCrunchCount.add(1);
  // ⚠️ 2026：这里原来记录 state.fastestInfinitySec（最快一次无限的耗时）——
  //   它只服务 em7 的 IC 自动化，IC 删除后无人读取 ⇒ 一并移除 ✓
  //   （`elapsed` 本身仍用于下面的日志/显示，不要删它 ✗）

  // ★★★ 2026-10-22（用户新增）：「暗能量永存」再添一个效果 —— **无限时也不重置暗能量** ✓
  //   顺序要紧：**先快照**（重置会把它设成 1 ✗）⇒ 再 resetForCollapse ⇒ 再写回 ✓
  //   快照只带"可能被保留"的字段（目前只有 darkEnergy ✓，将来加别的也放这里 ✓）
  const collapseKeepSnapshot = { darkEnergy: state.darkEnergy };
  resetForCollapse(state);
  applyCollapseKeeps(state, collapseKeepSnapshot);
  // ④ 的计时器与实时累计归零：下一次无限从 0 开始重新累计
  state.infinityElapsed = 0;
  state.ipTimeAccrued = D(0);
  // ★ 2025：**本轮时长也归零**（收手判据按时间 ⇒ 必须每轮重置）
  state.runElapsed = 0;

  // ★ 量子**会被大坍缩重置**。
  //   `quantumPairs`（门槛进度）也必须一起清 —— 否则门槛会退回 1e10，
  //   玩家可以靠反复坍缩刷量子。
  //   `quantumPairsTotal` 是累计统计量，保留。
  state.quantum = D(0);
  state.peakQuantumRun = D(0);       // ★ 量子铸币的基数随量子一起归零
  state.quantumPairs = D(0);

  // ★ 阈值文案从 config 取（CRUNCH_AT_LABEL），不要手写 "1e308.25" ——
  //   手写的那个和实际用的 log10(Number.MAX_VALUE) = 1e308.2547 差 0.25 个数量级。
  pushLog(state, `🌌 大坍缩！物质触及 ${CRUNCH_AT_LABEL} 上限，获得 ${sci(ip)} 无限点（共 ${sci(state.infinityPoints)}）`);
  if (timeAccrued > 0) {
    pushLog(state, `🌊 无限长河：本次无限 ${fmtSeconds(elapsed)} 期间实时进账 ${sci(timeAccrued)} 点` +
      `（超出 ${Math.round((INFINITY_UPGRADES.ipTime.capSeconds ?? 0) / 60)} 分钟的部分不再产点）`);
  }
  // ⚠️ 这里曾经有一行 `pushLog(... 量子 +${q.toString()} ...)`，以及
  //    `return { infinityPoints: ip, quantum: q }` —— 但 v3 量子模型
  //    已经删掉了「大坍缩给量子」，`q` 这个变量不复存在。
  //    结果 doBigCrunch **每次都抛 ReferenceError**，大坍缩彻底不可用。
  //
  //    所有工具都没抓到，因为没有一个是「跑一遍大坍缩」的：
  //      dom-smoke 永远到不了 1e308 / audit 不调用它 /
  //      dead-code-audit 查的是 config 的 id，不是变量引用。
  //    教训：**删一个功能时，要连带删掉它对外的返回值、日志、接口。**
  pushLog(state, `💭 梦想点保留（${sci(state.dreamPoints)} 点）`);
  awardDream(state, "bigcrunch", "首次大坍缩");
  // ⚠️ 返回值的 `infinityPoints` 是**本次实际发放**的点数（现在只有深度部分）；
  //    耗时部分（④）已经在 tick 里实时发过了，`timeIPAccrued` 只是它的累计值，供日志/界面用。
  // ★ cm1 / cm4（新 8 条坍缩里程碑）：无限后的开局赠礼（重置之后、返回之前 ✓）
  if (hasCollapse(state, "cm1")) {
    state.resources.particle = Decimal.max(D(state.resources.particle ?? 0), D(10));
    state.resources.matter = Decimal.max(D(state.resources.matter ?? 0), D(10));
  }
  if (hasCollapse(state, "cm4")) {
    state.quantum = Decimal.max(D(state.quantum ?? 0), D(4));
  }

  // crunch NaN guard: the DE reset path can leave a poisoned value; restore it here   if (String(state.darkEnergy).includes("NaN") || state.darkEnergy.lt(0)) state.darkEnergy = D(1);
  // ★ 2026：给"被动 IP"留快照（本次无限的收益基准）⇒ 防止正反馈爆炸 ✗

  try { state.passiveIpBase = bigCrunchGain(state).toString(); } catch { /* 忽略 */ }

  return { infinityPoints: ip, depthIP, timeIPAccrued: D(timeAccrued) };
}

/** 耗时的短显示（日志用，纯展示，不参与运算） */
export function fmtSeconds(sec) {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s} 秒`;
  if (s < 3600) return `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
  return `${Math.floor(s / 3600)} 小时 ${Math.floor((s % 3600) / 60)} 分`;
}

/**
 * 购买梦想点一次性升级（量子页）。
 *
 * 为什么在量子页：暗物质工程三个升级里只有第一个（梦想烬灭虚无）烧梦想点，
 * 后两个只烧粒子和 ZPE，导致梦想点中后期没有去处。这两个升级把它接回来。
 *
 * ⚠️ 量子页的这两条**不随大坍缩重置**（梦想点本身也不重置）。
 */