/**
 * tools/decimal-guard.mjs —— **数值约定 #3 的守卫**
 *
 * 规矩（`README.md` 的「数值约定」第 3 条）：
 *   凡是**能超过 1.8e308** 的量，必须全程 `Decimal`；
 *   `Number()` / `Math.*()` 只允许用在**必然有界**的量上（下标、计数、0~1 比例、端点常数）。
 *
 * 本守卫只查最常见、也最容易犯的那一类：
 *   把**资源类字段**直接塞进 `Number(...)` / `Math.floor(...)` / `Math.pow(...)`
 *   —— 超过 1e308 就变 Infinity ⇒ 界面上出现 ∞（按规矩 #4 = 致命错误 ✗）
 *
 * ⚠️ 白名单：`.log10()` / `.log(logBase)` 取出来的都是**小数值** ✓ 安全 ✓
 *   所以 `Number(x.log10())` 不报，`Number(x)` 才报 ✓
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// ★ 2026 模块化：递归 src/（含 src/config/），否则新子目录不在守卫范围内
import { walkFiles } from "./lib/walk.mjs";
// ★ 2026 运行时回归：Decimal 不能被 JS 的 `*` 强制成 Number（>1e308 ⇒ Infinity/NaN）
import Decimal from "../dist/break_eternity.esm.js";
import { newState } from "../src/state.js";
import { advance } from "../src/engine.js";
import { effectiveDarkEnergyGain } from "../src/formulas.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

/** 会超过 1.8e308 的字段（资源 / 大计数） */
const BIG = [
  "matter", "entropy", "particles", "zpe", "darkEnergy", "darkEnergyTotal",
  "infinityPoints", "eternityPoints", "eternityPointsTotal", "quantum",
  "bigCrunchCount", "peakMatter", "peakQuantumRun", "darkMatter",
];

/** 只在"取对数之后"才安全的写法 */
const SAFE_MIDDLE = /\.log10\(\)|\.log\(|\.log2\(\)|\.min\(1e15\)/;   // 取对数 或 先限幅 ⇒ 安全 ✓

const problems = [];
for (const f of walkFiles(SRC)) {
  const rel = path.relative(SRC, f).replace(/\\/g, "/");
  const lines = fs.readFileSync(f, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(\*|\/\/)/.test(line)) continue;           // 注释跳过
    if (SAFE_MIDDLE.test(line)) continue;               // 先取对数 ⇒ 安全
    for (const field of BIG) {
      // Number(...state.field...) / Math.xxx(...state.field...)
      const reCall = new RegExp(`(Number|Math\\.[a-zA-Z]+)\\([^)]*\\b(?:state|s|st)\\??\\.${field}\\b`);
      // state.field.toNumber() / state.field.mul(...).toNumber()（链式里没取对数）
      const reToNum = new RegExp(`\\b(?:state|s|st)\\??\\.${field}\\b[^;]*?\\.toNumber\\(\\)`);
      if (reCall.test(line) || reToNum.test(line)) {
        problems.push({ file: rel, line: i + 1, field, text: line.trim().slice(0, 110) });
        break;
      }
    }
  }
}

console.log("=".repeat(100));
console.log("★ 数值约定 #3 守卫：资源类字段不许直接 Number()/.toNumber()");
console.log("=".repeat(100));
if (!problems.length) {
  console.log("  ✅ 未发现违规（资源类大数都在 Decimal 上）");
} else {
  console.log(`  ❌ ${problems.length} 处可疑（超过 1e308 会变 Infinity ⇒ 界面 ∞ ✗）：`);
  for (const p of problems) console.log(`     ${p.file}:${p.line}  [${p.field}]  ${p.text}`);
}
console.log("=".repeat(100));
// ── 运行时回归：JS 的 `*` 会把 Decimal 先 valueOf() 成 Number ──
// 2026 实测：`darkEnergyGainPerConversion` > 1e308 时，`g * 1` = Infinity（层 2 值则是 NaN）
// ⇒ 离线结算里 darkEnergy / zpe 变 ∞，sanctifier 只能事后夹回。
// 这条断言用"相变等级 2000"造出一个 >1e308 的合法 Decimal，守住 `.mul()` 的唯一写法。
let runtimeFail = 0;
{
  const D = (v) => new Decimal(v);
  const s = newState();
  Object.assign(s, {
    phaseTransmuterUnlocked: true,
    zpeEngineUnlocked: true,
    brokenInfinity: true,
    zpe: D("1e100"),
    darkEnergy: D("1e10"),
    darkEnergyTotal: D("1e10"),
    quantum: D(100),
  });
  s.resources.traps = D(50);
  s.deUpgradeLevels.phaseShift = D(2000);   // 1.5^2000 ≈ 1e352 > 1e308
  const gain = effectiveDarkEnergyGain(s);
  const finite = gain instanceof Decimal && gain.isFinite();
  const big = finite && gain.gt(new Decimal("1e308"));
  advance(s, 60);   // 离线结算路径：advance → tick（5s 分块）
  const bad = ["zpe", "zpeTotal", "darkEnergy", "darkEnergyTotal"].filter((k) => !s[k].isFinite());
  const ok = finite && big && bad.length === 0;
  console.log(`  ${ok ? "✅" : "❌"} 大数路径：>1e308 的 Decimal 必须走 .mul（不得被 * 转成 Number）`);
  console.log(`     暗能量收益 = ${String(gain)}（有限=${finite}，>1e308=${big}）｜结算后非有限字段：${bad.join(", ") || "无"}`);
  if (!ok) runtimeFail++;
}
console.log("=".repeat(100));
process.exitCode = problems.length || runtimeFail ? 1 : 0;
