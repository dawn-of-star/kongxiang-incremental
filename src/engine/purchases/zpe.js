/**
 * engine/purchases/zpe.js —— ZPE 引擎：解锁 / 可买级数 / 购买
 *
 * ★ 2026 模块化：由 512 行的 engine/purchases.js 拆出（声明与注释逐字保留）。
 *    对外统一从 `src/engine.js`（barrel）导入。
 */
import { ZPE_ENGINE, markPageUnlocked, zpeEngineAffordableIn, zpeEngineCost, zpeEngineLevel, zpeEngineTotalCost, zpeEngineUnlocked } from "../../config.js";
import { sci } from "../../format.js";
import { D } from "../../formulas.js";
import { awardDream, pushLevelLog, pushLog } from "../../state.js";

export function unlockZpeEngine(state) {
  if (zpeEngineUnlocked(state)) return false;
  // ★ 2026：条件放宽 —— **有 1 次无限**（含 em7 送的）或大坍缩过 1 次 都算达标 ✓
  const hasInfinity = (state.infinityCount ?? 0) >= 1 || (state.bigCrunchCount ?? D(0)).gte(1);
  if (!hasInfinity) return false;
  state.zpeEngineUnlocked = true;
  markPageUnlocked(state, "zpe");        // ★ 永久解锁记录（永恒后不再上锁）
  // 送 1 级（里程碑奖励）
  state.zpeEngineLevel = (state.zpeEngineLevel ?? D(0)).max(1);
  // 跨度基准：记下此刻的暗能量水位（只记一次）
  if ((state.spanDeBase ?? D(0)).lte(0)) {
    state.spanDeBase = (state.darkEnergy ?? D(0)).max(1);
  }
  awardDream(state, "zpeEngine", "解锁 ZPE 引擎");
  pushLog(state, "⚙ 第一次大坍缩的里程碑奖励：解锁「ZPE 引擎」并赠送 1 级");
  pushLog(state, `⚙ 暗能量自增长已开启（基准 = ${sci(state.spanDeBase)}）；` +
    "之后可以拿无限点买等级，等级同时给四条加成（加法区 / 产出与倍率 / 计数频率与量子 / 暗能量倍率）");
  return true;
}

/** ZPE 引擎还能买几级（分段几何的闭式解，见 config.zpeEngineAffordableIn） */
export function zpeEngineAffordable(state) {
  if (!zpeEngineUnlocked(state)) return 0;
  return zpeEngineAffordableIn(state, state.infinityPoints);
}

/**
 * 买 ZPE 引擎等级（`max=true` 买满）。
 *
 * 三条机制都由等级驱动（见 config 的 ZPE_ENGINE）：
 *   · ② 产出倍率 `(1+0.1×等级)²` —— 解锁即有
 *   · ③ 倍率吃「计数频率」     —— 等级 ≥ 5
 *   · ① 抬高倍率公式的指数     —— 等级 ≥ 10
 * 所以跨过 5 / 10 级时要给一条**明确的**日志（规则变了，玩家必须知道）。
 *
 * ⚠️ 价格是**分段几何**（软上限）：10 级后每级涨价 ×20，100 级后再 ^1.3，1000 级后再 ^1.8。
 *    所以这里不能再用"单一公比"的 geometricSum —— 直接用段内闭式算出 k 与总价。
 */
export function buyZpeEngineLevel(state, max = false) {
  if (!zpeEngineUnlocked(state)) return 0;
  const lv0 = zpeEngineLevel(state);
  const before = lv0.toNumber();
  const k = max ? zpeEngineAffordable(state) : (state.infinityPoints.gte(zpeEngineCost(state)) ? 1 : 0);
  if (k < 1) return 0;

  // 总价 = 从当前级买到 before+k 级的分段累加（log 空间求差即可）
  const total = zpeEngineTotalCost(before, before + k);
  if (state.infinityPoints.lt(total)) return 0;
  state.infinityPoints = state.infinityPoints.sub(total);

  state.zpeEngineLevel = lv0.add(k);

  // 等级本身也守"只在关键节点写日志"的规矩
  pushLevelLog(state, "ZPE 引擎", before, before + k);
  // ★ 跨过 ③ 的解锁线时，单独说清楚
  //   ⚠️ 2025：另一条 ①「抬公式指数」**已废弃**（改成加法区加成 ✓），
  //      所以这里不再播报 10 级的旧机制 ✗
  if (before < ZPE_ENGINE.countFreqLevel && before + k >= ZPE_ENGINE.countFreqLevel) {
    pushLog(state, `⚙ ZPE 引擎 ${ZPE_ENGINE.countFreqLevel} 级：ZPE 倍率开始吃「计数频率」加成`);
  }
  return k;
}

/** 无限升级当前的「效果」文本数值（UI 与自检共用，保证从公式推导） */
