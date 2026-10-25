/**
 * space.js —— 空间膨胀核心闭环（SE / ST / 挑战）
 *
 * 这一层**不碰 du 效果**；先把货币和挑战做成可运行、可存档的闭环：
 *   · EP ≥ 1e1200 解锁，之后随时能进；
 *   · **进入时自动执行一次永恒重置**（保留七巧板 / 暗物质；不发 EP、不涨永恒次数）；
 *     初始已有挑战会被永恒打断，重复进入就重复这套重置；
 *   · 挑战内：最终 IP 收益 ^0.5（由 `spaceChallengePower` 乘在唯一入口）；
 *   · SE：挑战内按 IP 峰值增量结算（进入时记基线，避免“进出刷 SE”）；
 *   · ST：基础公式按游戏秒生产，挑战内也吃 ^0.5；
 *   · 退出挑战后 IP 收益恢复全额，已结算 SE 不退。
 *
 * ⚠️ 所有“最终收益”必须走唯一包装 `spaceApplyFinalGain()`；不要在公式各处手写 sqrt。
 */
import Decimal from "../dist/break_eternity.esm.js";

const D = (x) => new Decimal(x ?? 0);
export const SPACE_UNLOCK_EP = new Decimal("1e1200");
export const SPACE_SE_DIVISOR = 40;
export const SPACE_SE_OFFSET = -7;

/** 是否已解锁空间膨胀：EP 达标，或曾经达标（挑战重置会清 EP，但页面永久解锁）。 */
export function spaceUnlocked(state) {
  return state?.pageUnlocked?.space === true || D(state?.eternityPoints).gte(SPACE_UNLOCK_EP);
}

/** 挑战内最终收益系数；退出后 1。 */
export function spaceChallengePower(state) {
  return state?.space?.challenge === true ? 0.5 : 1;
}

/** 唯一最终收益包装：IP / ST 等最终产出都在写回 state 前过这里。 */
export function spaceApplyFinalGain(state, value) {
  const v = D(value);
  const p = spaceChallengePower(state);
  return p === 1 ? v : v.mul(p);
}

/** SE 公式：floor(10^(log10(IP_peak)/40 − 7))；低于 1 时为 0。 */
export function spaceSeFromIp(ip) {
  const v = D(ip);
  if (!v.gt(0)) return D(0);
  const exp = v.log10().div(SPACE_SE_DIVISOR).add(SPACE_SE_OFFSET);
  if (exp.lte(0)) return D(0);
  return Decimal.pow(10, exp).floor();
}

/** ST 基础产量（每秒）；`globalMult` 由 tick 传入，避免公式层循环依赖。 */
export function spaceStRate(state, globalMult) {
  const se = D(state?.space?.se);
  const gm = D(globalMult);
  const logGm = gm.gt(10) ? gm.log10() : D(1);
  const logSe = se.gt(0) ? se.add(1).log10() : D(0);
  return logGm.mul(logSe).mul(0.01).mul(spaceChallengePower(state));
}

/**
 * 每 tick 推进：挑战内按 IP 峰值增量结算 SE；ST 按秒生产。
 * @param {object} state
 * @param {number} dt 游戏秒
 * @param {Decimal|number} globalMult 当前全局加成
 */
export function spaceTick(state, dt, globalMult) {
  if (!spaceUnlocked(state)) return;
  const sp = state.space;
  if (!sp) return;
  const d = Math.max(0, Number(dt) || 0);
  if (!(d > 0)) return;

  const ip = D(state.infinityPoints);
  const ep = D(state.eternityPoints);
  if (ip.gt(sp.bestIp)) sp.bestIp = ip;
  if (ep.gt(sp.bestEp)) sp.bestEp = ep;

  if (sp.challenge === true) {
    if (ip.gt(sp.ipPeak)) sp.ipPeak = ip;
    const target = spaceSeFromIp(sp.ipPeak);
    const base = D(sp.challengeSeBase);
    const already = D(sp.challengeSe);
    const delta = target.sub(base).sub(already);
    if (delta.gt(0)) {
      sp.se = D(sp.se).add(delta);
      sp.challengeSe = already.add(delta);
    }
  }

  const rate = spaceStRate(state, globalMult);
  if (rate.gt(0)) sp.st = D(sp.st).add(rate.mul(d));
}

/** 进入挑战：必须先执行一次**新的永恒重置**；进入时记 IP 峰值基线。 */
export function enterSpaceChallenge(state) {
  if (!spaceUnlocked(state)) return { ok: false, reason: "locked" };
  const sp = state?.space;
  if (!sp || sp.challenge === true) return { ok: false, reason: "active" };
  // 挑战重置会清空当前 EP；用永久页面记录保持解锁。
  state.pageUnlocked ??= {};
  state.pageUnlocked.space = true;
  sp.challenge = true;
  sp.ipPeak = D(state.infinityPoints);
  sp.challengeSeBase = spaceSeFromIp(sp.ipPeak);
  sp.challengeSe = D(0);
  return { ok: true };
}

/** 永恒重置会打断当前挑战；下次进入时重新执行挑战重置。 */
export function spaceOnEternity(state) {
  const sp = state?.space;
  if (!sp?.challenge) return false;
  sp.challenge = false;
  return true;
}

/** 退出挑战：停止 SE/挑战系数；已结算的 SE 不退。 */
export function exitSpaceChallenge(state) {
  const sp = state?.space;
  if (!sp || sp.challenge !== true) return { ok: false, reason: "inactive" };
  sp.challenge = false;
  return { ok: true };
}

export function toggleSpaceChallenge(state) {
  return state?.space?.challenge === true ? exitSpaceChallenge(state) : enterSpaceChallenge(state);
}

// ══════════════════════════════════════════════════════════
// du 效果辅助（只读 state；购买/价格在 space-upgrades.js）
// ══════════════════════════════════════════════════════════

/** du 等级；单次升级 true ⇒ 1。 */
export function spaceLevel(state, id) {
  const raw = state?.space?.upgrades?.[id];
  if (raw === true) return 1;
  return Math.max(0, Math.floor(Number(raw ?? 0) || 0));
}

/** du1~du3 的 ×10^(n^1.5)。 */
export function spaceDuMult(state, id) {
  const n = spaceLevel(state, id);
  if (!(n > 0)) return D(1);
  // ⚠️ 不要用 `Math.pow(n, 1.5)`：n 很大时它会先变成 Infinity，
  //    Decimal.pow 收到 Infinity 指数也会返回 Infinity ✗
  //    ⇒ 指数也走 Decimal，让 break_eternity 自己处理超大层数。
  return Decimal.pow(10, D(n).pow(1.5));
}

/**
 * du4/du6 的软上限等效等级：
 *   n_eff = C + (n−C)/(1+0.5·log10(n/C))，n>C
 * 到 100C 时超出部分的平均每级效率 = 50%。
 */
export function spaceSoftLevel(level, cap) {
  const n = Math.max(0, Number(level) || 0);
  if (n <= cap) return n;
  return cap + (n - cap) / (1 + 0.5 * Math.log10(n / cap));
}

/** du4：免费 ZPE 引擎等级（+10·n_eff）。 */
export function spaceDu4EngineLevels(state) {
  return 10 * spaceSoftLevel(spaceLevel(state, "du4"), 1e6);
}

/** du5：熵→粒子倍率 ×10^√n。 */
export function spaceDu5Mult(state) {
  const n = spaceLevel(state, "du5");
  if (!(n > 0)) return D(1);
  return Decimal.pow(10, D(n).pow(0.5));
}

/** du6：计数频率 ×(1 + 0.5√n_eff)。 */
export function spaceDu6Mult(state) {
  const n = spaceSoftLevel(spaceLevel(state, "du6"), 1e8);
  return n > 0 ? D(1).add(D(n).pow(0.5).mul(0.5)) : D(1);
}

/**
 * du9：所有“虚空增幅”类升级的全局强度倍率。
 * ∝ log10(1+量子数)，封顶 ×10（未购买 = ×1）。
 */
export function spaceDu9Mult(state) {
  if (spaceLevel(state, "du9") <= 0) return 1;
  const q = D(state?.quantum);
  const lg = q.gt(1) ? q.add(1).log10().toNumber() : 0;
  return 1 + Math.min(9, Math.max(0, lg));
}

/**
 * du11：DE 超载因子下限。
 * 未购买 ⇒ 0（不改变原行为）；购买后随当前 ST 从 0.3 抬向 0.95。
 */
export function spaceDu11Floor(state) {
  if (spaceLevel(state, "du11") <= 0) return 0;
  const C = D(1e5);
  const st = D(state?.space?.st);
  const x = Decimal.max(D(0), st.sub(C));
  return Math.min(0.95, 0.3 + 0.7 * x.div(x.add(C)).toNumber());
}
