/**
 * ★★★ 2026：**梦想页自动化的"效果"侧**（用户：「梦想页面的所有自动化升级呢？」）
 *
 * 之前只有**定义 + 开关**，但没接效果 ✗ ⇒ 买下不会自动干活。本模块补齐三块：
 *
 * | 升级 | 效果 | 落点 |
 * |---|---|---|
 * | `autoPhase` / `autoVacuum` / `autoDeGainBase` / `autoConvOutput` | 自动买对应的**暗能量升级** | `engine.autoAcquireDream` → `autoBuyDeUpgrade`（用 `effect.deUpgrade`）|
 * | `autoIpDouble` | 自动买满 IP 点倍增 | `ipDoubleAffordableIn` / `ipDoubleCostF`（同 UI 用的入口）|
 * | `autoZpeEngine` | 自动买满 ZPE 引擎 | `zpeEngineCost`（引擎等级的唯一价格入口）|
 * | `keepDeEternity` | 永恒**不清空**暗能量 | `applyEternityKeeps`（`doEternity` 重置后写回）|
 * | `engineAtStart` | 坍缩/永恒后保留 1 级 ZPE 引擎 | 同上 |
 * | `keepVoidEternity` | 永恒**不清空**虚空升级 | 同上 |
 *
 * ⚠️ **两类判据不同，别混用**（2026 混用过一次，四条自动买全死）：
 *   · **自动化**（每 tick 干活、梦想页有开关）⇒ `autoEnabled`（已买 **且** `autoToggles[id]`）
 *   · **被动保留**（梦想页没开关）⇒ `hasMilestone`（**已买即生效**）
 * ⚠️ 全部**只作用于永恒阶段**（用户边界：永恒之前的东西不碰）——
 *   它们不改任何公式，只在"重置/购买"这一层做该做的事 ✓
 */
import Decimal from "../dist/break_eternity.esm.js";

const D = (x) => new Decimal(x);

/** 某条自动化是否**已买 + 已开**（唯一判定，别在别处手写）✓ */
export function autoEnabled(state, id) {
  const owned = state?.dreamUpgrades?.[id];
  const isOwned = owned === true || (typeof owned === "number" && owned > 0);
  return isOwned && state?.autoToggles?.[id] === true;
}

/**
 * 每 tick：两条"自动买满"的自动化 ✓
 * @param {object} state
 * @param {{buyIpDouble: Function, buyZpeEngine: Function}} buy  —— 由 engine 注入（避免循环 import）
 * @returns {{ipDouble:number, zpeEngine:number}} 本 tick 各买了多少级（供日志/断言用）
 */
export function dreamAutoBuyTick(state, buy) {
  const out = { ipDouble: 0, zpeEngine: 0 };
  // ★★★ 2026：**节流 250ms**（AD 的 autobuyer 有间隔）——否则每帧买 1 级也太快 ✗
  const now = Number(state?.playTimeMs ?? 0) || 0;
  if (now - (Number(state?._lastDreamAutoAt) || 0) < 250) return out;
  state._lastDreamAutoAt = now;
  if (autoEnabled(state, "autoIpDouble")) out.ipDouble = buy.buyIpDouble(state) ?? 0;
  if (autoEnabled(state, "autoZpeEngine")) out.zpeEngine = buy.buyZpeEngine(state) ?? 0;
  return out;
}

/**
 * 永恒之后**立刻**调用：把该保留的东西写回去 ✓
 *
 * ⚠️ 为什么"写回"而不是"重置时不重置"：
 *   `doEternity` 里的重置顺序/范围是既有的（且被断言守着）⇒ 在**之后**补写回，
 *   等价于"不重置"，但**不动那条被断言检查的重置代码** ✓（更安全）
 */
export function applyEternityKeeps(state, snapshot) {
  const done = [];
  // ⚠️⚠️ 2026 修 bug：这三条是**被动型**（梦想页不给它们开关 —— 见 `dream-ui.js` 的
  //   `AUTOMATION_IDS` 只有 7 条，不含 keep*）⇒ 判据必须用 `hasMilestone`（**已买即生效**）✓
  //   原来全用 `autoEnabled`（要求 `autoToggles[id] === true`）⇒ 那个开关**永远不会被设置**
  //   ⇒ 三条"永恒保留"恒不生效（买了等于没买）✗
  //   用户裁定「买下只是解锁能力，要手动开」针对的是**自动化**（每 tick 干活那种），
  //   不是被动保留 —— 组名就叫「永恒保留（被动）」✓
  if (hasMilestone(state, "keepDeEternity")) {
    state.darkEnergy = snapshot?.darkEnergy ?? D(0);
    done.push("darkEnergy");
  }
  if (hasMilestone(state, "keepVoidEternity")) {
    state.voidUpgrades = snapshot?.voidUpgrades ?? {};
    state.zpeMilestones = snapshot?.zpeMilestones ?? {};
    done.push("voidUpgrades");
  }
  if (hasMilestone(state, "engineAtStart")) {
    // 开局给 1 级引擎（不是"买满"，只是别从 0 开始）✓
    state.zpeEngineLevel = D(state.zpeEngineLevel ?? 0).max(D(1));
    done.push("engineAtStart");
  }
  return done;
}

/** 小工具：某条升级是否已买（不看开关 —— 被动型用）✓ */
function hasMilestone(state, id) {
  const owned = state?.dreamUpgrades?.[id];
  return owned === true || (typeof owned === "number" && owned > 0);
}

/** UI/日志用：一句话说清某条自动化现在的状态 ✓ */
export function autoStatusText(state, id) {
  const owned = hasMilestone(state, id);
  if (!owned) return "未购买";
  return state?.autoToggles?.[id] === true ? "已开启" : "已购买 · 未开启";
}
