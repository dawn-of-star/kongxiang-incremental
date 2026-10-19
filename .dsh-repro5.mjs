import { newState } from "./Public/src/state.js";
import * as E from "./Public/src/engine.js";
import Decimal from "./Public/dist/break_eternity.esm.js";
const D = (x) => new Decimal(x);
const s = newState();
s.matter = D("1e10"); s.particles = D(50); s.particleCount = D(20); s.entropy = D(10);
s.zpe = D("1e5"); s.zpeEngineUnlocked = true; s.zpeEngineLevel = D(3); s.dreamPoints = D(20);
s.dreamUpgrades = { autoPhase: true, autoVacuum: true, autoDeGainBase: true, autoConvOutput: true, autoInfinities: true, autoIpDouble: true, autoZpeEngine: true, engineAtStart: true };
s.autoToggles = { autoPhase: true, autoVacuum: true, autoDeGainBase: true, autoConvOutput: true, autoInfinities: true, autoIpDouble: true, autoZpeEngine: true };
s.autoCrunch = { isActive: true, mode: "amount", amount: "1", time: 0.1, xHighest: "2", dynamic: false, lastAtMs: 0 };
s.brokenInfinity = true; s.infinityPoints = D("1e5");
const f = (v) => { try { const d = D(v); if (!d.isFinite()) return "Inf"; return d.gte(1e6) ? d.toExponential(2) : d.toFixed(2); } catch { return "?"; } };
for (let m = 1; m <= 10; m++) { for (let k = 0; k < 60; k++) E.tick(s, 1000); console.log(m + " 分钟 | DE =", f(s.darkEnergy), "| 物质 =", f(s.matter), "| IP =", f(s.infinityPoints)); }
