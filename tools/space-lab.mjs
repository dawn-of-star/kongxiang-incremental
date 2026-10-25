#!/usr/bin/env node
/**
 * tools/space-lab.mjs —— 空间膨胀核心（SE / ST / 挑战 / ^0.5）的定点断言
 *
 * 只测**已接线的核心闭环**；du 效果尚未接线，不在这里假装有。
 */
import Decimal from "../dist/break_eternity.esm.js";
import { newState, serialize, deserialize } from "../src/state.js";
import { bigCrunchGain } from "../src/formulas.js";
import { startSpaceChallenge } from "../src/engine.js";
import {
  SPACE_UNLOCK_EP, spaceSeFromIp, spaceStRate, spaceChallengePower,
  enterSpaceChallenge, exitSpaceChallenge, spaceTick,
} from "../src/space.js";

const D = (x) => new Decimal(x);
let fails = 0;
const ck = (label, ok, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? "✅" : "❌"} ${label.padEnd(46)} ${detail}`);
};

console.log("=".repeat(96));
console.log("空间膨胀核心 · SE / ST / 挑战 / ^0.5");
console.log("=".repeat(96));

{
  const cases = [
    ["1e308", "5"],
    ["1e400", "1000"],
    ["1e1200", "1e23"],
  ];
  const rows = cases.map(([ip, want]) => [ip, spaceSeFromIp(D(ip)).toString(), want]);
  ck("SE 端点", rows.every(([, got, want]) => got === want), rows.map(([ip, got]) => `${ip}⇒${got}`).join("｜"));
}

{
  const s = newState();
  s.space.se = D(999);
  const normal = spaceStRate(s, D(10));
  const challenged = (() => { s.space.challenge = true; const r = spaceStRate(s, D(10)); s.space.challenge = false; return r; })();
  const want = D(0.01).mul(D(1000).log10());   // 0.03
  ck("ST 基础公式 / 挑战 ^0.5", normal.eq(want) && challenged.eq(want.mul(0.5)),
    `SE=999,gm=10 ⇒ ${normal.toString()}｜挑战内 ${challenged.toString()}（应 ${want.toString()} / 一半）`);
}

{
  const s = newState();
  s.eternityPoints = D("1e1200");
  s.eternityCount = D(1);
  s.infinityPoints = D("1e308");
  const enter = enterSpaceChallenge(s);
  const base = s.space.challengeSeBase;
  s.infinityPoints = D("1e400");
  spaceTick(s, 1, D(10));
  const earned = s.space.se;
  const challengeEarned = s.space.challengeSe;
  exitSpaceChallenge(s);
  const seAfterExit = s.space.se;
  spaceTick(s, 1, D(10));   // 挑战外不再结算 SE
  ck("挑战：进入记基线 / 增量结算 / 退出停止",
    enter.ok && base.eq(5) && earned.eq(995) && challengeEarned.eq(995)
      && seAfterExit.eq(995) && s.space.se.eq(995) && s.space.challenge === false,
    `baseline=${base.toString()}｜earned=${earned.toString()}｜退出后 ${s.space.se.toString()} ✓`);
}

{
  const s = newState();
  s.eternityPoints = D("1e1200");
  s.eternityCount = D(1);
  s.infinityPoints = D("1e400");
  enterSpaceChallenge(s);                   // 基线 = 1000
  spaceTick(s, 1, D(10));
  ck("重进同一峰值不刷 SE", s.space.se.eq(0) && s.space.challengeSe.eq(0),
    `se=${s.space.se.toString()}（进入时 IP=1e400，基线已吃掉旧峰值）`);
}

{
  const mk = (challenge) => {
    const s = newState();
    s.brokenInfinity = true;
    s.resources.matter = D("1e308");
    s.space.challenge = challenge;
    return s;
  };
  const a = bigCrunchGain(mk(false));
  const b = bigCrunchGain(mk(true));
  ck("最终 IP 收益：挑战内严格 ^0.5", a.gt(0) && b.div(a).sub(0.5).abs().lt(1e-12),
    `全额=${a.toString()}｜挑战=${b.toString()}｜比值=${b.div(a).toString()}`);
  ck("挑战系数 / 解锁常量", spaceChallengePower({ space: { challenge: true } }) === 0.5
    && SPACE_UNLOCK_EP.eq(D("1e1200")), `系数 0.5｜解锁 ${SPACE_UNLOCK_EP.toString()}`);
}

{
  const s = newState();
  s.eternityPoints = D("1e1200");
  s.eternityCount = D(1);
  s.infinityPoints = D("1e400");
  enterSpaceChallenge(s);
  s.space.se = D("1e9");
  const raw = serialize(s);
  const back = deserialize(raw).state;
  ck("空间状态存档往返", back.space.challenge === true && back.space.se.eq(D("1e9"))
    && back.space.challengeSeBase.eq(D(1000)), `challenge=${back.space.challenge}｜se=${back.space.se.toString()}`);
}

{
  const s = newState();
  s.eternityPoints = D("1e1200");
  s.eternityCount = D(5);
  s.eternityDarkMatter = D(7);
  s.tangramOwned.largeA = true;
  s.space.upgrades.du1 = 3;
  s.space.se = D(9);
  const epBefore = s.eternityPoints.toString();
  const r = startSpaceChallenge(s);
  ck("进入挑战：自动永恒重置 + 清 EP + 保留七巧板/暗物质/空间",
    !!r?.ok && String(s.eternityCount) === "5" && s.eternityPoints.eq(0)
      && s.eternityPointsTotal.eq(0) && s.space.challenge === true
      && s.tangramOwned.largeA === true && s.eternityDarkMatter.eq(7)
      && s.space.upgrades.du1 === 3 && s.space.se.eq(9),
    `EP ${epBefore}→${s.eternityPoints}｜永恒=${s.eternityCount}｜七巧板=${s.tangramOwned.largeA}`
      + `｜暗物质=${s.eternityDarkMatter}｜du1=${s.space.upgrades.du1}｜challenge=${s.space.challenge}`);
}

console.log();
console.log("=".repeat(96));
console.log(fails === 0 ? "  ✅ 全部通过" : `  ❌ ${fails} 项失败`);
console.log("=".repeat(96));
process.exit(fails ? 1 : 0);
