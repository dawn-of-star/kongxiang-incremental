#!/usr/bin/env node
/**
 * tools/space-lab.mjs —— 空间膨胀核心（SE / ST / 挑战 / du）的定点断言
 *
 * du7 仍是“效果口径待接”，不在这里假装有；du8/du10 按设计暂缓。
 */
import Decimal from "../dist/break_eternity.esm.js";
import { newState, serialize, deserialize } from "../src/state.js";
import { bigCrunchGain, darkEnergyMultiplier, darkEnergyRate, overloadFactor } from "../src/formulas.js";
import { darkMatterAdditiveTerm, deGrowthRate } from "../src/config.js";
import { startSpaceChallenge } from "../src/engine.js";
import { autoBuySpaceDu, buySpaceUpgrade, spaceUpgradeCost } from "../src/space/upgrades.js";
import {
  SPACE_UNLOCK_EP, spaceSeFromIp, spaceStRate, spaceChallengePower,
  enterSpaceChallenge, exitSpaceChallenge, spaceTick, spaceLevel,
  spaceDuMult, spaceDu4EngineLevels, spaceDu5Mult, spaceDu6Mult, spaceDu9Mult, spaceDu11Floor,
} from "../src/space/core.js";

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

{
  const s = newState();
  s.eternityPoints = D("1e1200");
  s.space.se = D(100);
  s.space.st = D("2e5");
  const c1 = spaceUpgradeCost(s, "du1");
  const b1 = buySpaceUpgrade(s, "du1");
  const c2 = spaceUpgradeCost(s, "du1");
  const b7 = buySpaceUpgrade(s, "du7");
  const b11 = buySpaceUpgrade(s, "du11");
  ck("du 购买 / 价格 / du7 自动化解锁 / du11 单次",
    c1.eq(1) && b1.ok && s.space.se.eq(99) && c2.eq(1.5)
      && b7.ok && s.space.upgrades.du7 === true
      && b11.ok && s.space.st.eq(D("99990")) && s.space.upgrades.du11 === true
      && Math.abs(spaceDu11Floor(s) - 0.3) < 1e-12,
    `du1 ${c1}→${c2}｜SE=${s.space.se}｜du7=${b7.ok}｜du11 ST=${s.space.st}｜floor=${spaceDu11Floor(s)}`);
}

{
  const s = newState();
  s.eternityPoints = D("1e1200");
  s.space.upgrades.du7 = true;
  s.space.se = D("1e15");
  s.autoToggles.autoSpaceDu = true;
  const bought = autoBuySpaceDu(s, 1);
  ck("du7 自动化：按秒买 du1~du6、与手动开关联动",
    bought > 0 && spaceLevel(s, "du1") > 0 && spaceLevel(s, "du6") > 0
      && spaceLevel(s, "du7") === 1 && spaceLevel(s, "du4") > 0,
    `1 秒买 ${bought} 级｜du1=${spaceLevel(s, "du1")}｜du4=${spaceLevel(s, "du4")}｜du6=${spaceLevel(s, "du6")}`);
  const before = spaceLevel(s, "du1");
  s.autoToggles.autoSpaceDu = false;
  const off = autoBuySpaceDu(s, 1);
  ck("du7 自动开关关闭则不再买", off === 0 && spaceLevel(s, "du1") === before,
    `off bought=${off}｜du1=${spaceLevel(s, "du1")}`);
}

{
  const s = newState();
  s.space.upgrades = { du1: 1, du4: 1e8, du5: 1, du6: 1, du9: true };
  s.quantum = D(100);
  s.space.st = D("2e5");
  const d1 = spaceDuMult(s, "du1");
  const d4 = spaceDu4EngineLevels(s);
  const d5 = spaceDu5Mult(s);
  const d6 = spaceDu6Mult(s);
  const d9 = spaceDu9Mult(s);
  ck("du 效果：du1/4/5/6/9 数值",
    d1.eq(10) && d4 > 0 && d5.eq(10) && d6.eq(1.5) && Math.abs(d9 - (1 + Math.log10(101))) < 1e-12,
    `du1=${d1}｜du4Levels=${d4.toFixed(0)}｜du5=${d5}｜du6=${d6}｜du9=${d9.toFixed(4)}`);
  s.space.upgrades.du11 = true;
  ck("du11 floor 随 ST 0.3→0.65", Math.abs(spaceDu11Floor(s) - 0.65) < 1e-9,
    `ST=2e5 ⇒ floor=${spaceDu11Floor(s)}`);
}

{
  const s = newState();
  s.brokenInfinity = true;
  s.space.st = D("1e5");
  const raw = overloadFactor(s, D("1e100000"));
  s.space.upgrades.du11 = true;
  const after = overloadFactor(s, D("1e100000"));
  ck("du11 已离开物质超载（overloadFactor 不吃 du11）", raw.eq(after),
    `无du11=${raw.toPrecision?.(4) ?? raw}｜有du11=${after.toPrecision?.(4) ?? after}`);
}

{
  const mk = (owned) => {
    const s = newState();
    s.darkEnergyTotal = D("1e2000");
    s.space.st = D("1e5");
    if (owned) s.space.upgrades.du11 = true;
    return darkEnergyMultiplier(s);
  };
  const m0 = mk(false);
  const m1 = mk(true);
  ck("du11 接到新 DE 倍率削弱：0.3 floor 生效", m1.gt(m0) && m1.isFinite(),
    `无du11=${String(m0).slice(0, 18)}｜有du11=${String(m1).slice(0, 18)}（ST=1e5 ⇒ floor=0.3）`);
}

{
  const s = newState();
  s.eternityCount = D(4);
  s.eternityDarkMatter = D(122);
  s.v1Log10 = 130;
  s.darkEnergy = D("1e300");
  s.darkEnergyTotal = D("1e300");
  s.zpe = D("1e300");
  s.phaseTransmuterUnlocked = true;
  s.zpeEngineUnlocked = true;
  s.zpeEngineLevel = D(100);
  s.space.upgrades = { du1: 1e6, du2: 1e6, du3: 1e6 };
  const term = darkMatterAdditiveTerm(s);
  const dm = darkEnergyMultiplier(s);
  const dr = darkEnergyRate(s);
  ck("du 大等级 + 暗物质：DE 倍率/速率/加法项都不 ∞",
    term.isFinite() && dm.isFinite() && dr.isFinite(),
    `du=1e6 ⇒ term=${String(term).slice(0, 20)}｜mult=${String(dm).slice(0, 20)}｜rate=${String(dr).slice(0, 20)}`);
}

{
  const a = newState();
  a.darkEnergy = D("1e300");
  const b = newState();
  b.darkEnergy = D("1e5000");
  const a1 = deGrowthRate(a, 1);
  const a2 = deGrowthRate(b, 1);
  const m1s = newState();
  m1s.darkEnergyTotal = D("1e1000");
  const m2s = newState();
  m2s.darkEnergyTotal = D("1e2000");
  const m1 = darkEnergyMultiplier(m1s);
  const m2 = darkEnergyMultiplier(m2s);
  ck("归一化：DE 自增长不随量级衰减，倍率只吃有效量上限",
    Math.abs(a2 / a1 - 1) < 1e-12 && m1.isFinite() && m2.isFinite()
      && m2.sub(m1).abs().lt(1) && m2.lt(400),
    `a(1e300)=${a1}｜a(1e5000)=${a2}｜mult(1e1000)=${String(m1).slice(0, 18)}｜mult(1e2000)=${String(m2).slice(0, 18)}`);
}

console.log();
console.log("=".repeat(96));
console.log(fails === 0 ? "  ✅ 全部通过" : `  ❌ ${fails} 项失败`);
console.log("=".repeat(96));
process.exit(fails ? 1 : 0);
