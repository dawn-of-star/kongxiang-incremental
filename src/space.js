/**
 * space.js —— 空间膨胀核心闭环（SE / ST / 挑战）
 *
 * 这一层**不碰 du 效果**；先把货币和挑战做成可运行、可存档的闭环：
 *   · EP ≥ 1e1200 解锁；
 *   · 每次进入挑战前必须先执行一次**永恒重置**；永恒会打断当前挑战；
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

/** 是否已解锁空间膨胀（以**当前 EP** 判定；不是第一次永恒）。 */
export function spaceUnlocked(state) {
  return D(state?.eternityPoints).gte(SPACE_UNLOCK_EP);
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
  const count = Math.max(0, Math.floor(Number(state.eternityCount ?? 0)));
  const last = Math.max(0, Math.floor(Number(sp.challengeEternity ?? 0)));
  if (!(count > last)) return { ok: false, reason: "need-eternity", need: last + 1 };
  sp.challengeEternity = count;
  sp.challenge = true;
  sp.ipPeak = D(state.infinityPoints);
  sp.challengeSeBase = spaceSeFromIp(sp.ipPeak);
  sp.challengeSe = D(0);
  return { ok: true };
}

/** 永恒重置会打断当前挑战；下次进入必须再执行一次永恒。 */
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
