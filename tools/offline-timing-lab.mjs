#!/usr/bin/env node
/**
 * tools/offline-timing-lab.mjs —— 离线 / 后台补时的**上限与补时口径**（纯 Node，无浏览器）
 *
 * 为什么需要它：这三条都是"返回值被上层忽略 / 上限在两个地方各读一次"造成的，
 * 症状又都**只在真实浏览器里**出现（读档、切后台、隐私模式），
 * 单看代码很容易再写回去 ⇒ 用纯 Node 把口径钉死：
 *
 *   ① 离线上限升级无效：
 *        `advance(state, seconds, chunk, cap)` 的 cap 必须由调用方给；
 *        5h 请求 + 6h cap 要真的推进 5h，**不能**被内层的 4h 再裁一次；
 *        不传 cap 的调用方仍按基础 4h 裁（默认值行为不变）✓
 *   ③ 后台/休眠回来只计 1 秒：
 *        hidden 时长 → 应补秒数的纯函数 `hiddenCatchUpSeconds(gapMs, cap)`：
 *        < 1 秒不补、上限走离线 cap、非法输入返回 0 ✓
 *   ⑤ 保存失败仍闪「已保存 ✓」：
 *        假 localStorage 的 `setItem` 抛异常时，`save()` 必须返回 0，
 *        并且 `state.lastSavedAt` **不变**（只有写成功才提交）✓
 *
 * 另：`main.js` 一加载就要 DOM，纯 Node 跑不起来 ⇒ 它的三处**接线**
 *   用源码判据兜住（cap 有没有传进 advance / 补时有没有调用 / flashSave 有没有门槛）。
 *
 * 用法：node tools/offline-timing-lab.mjs
 */
import { readFileSync } from "node:fs";
import Decimal from "../dist/break_eternity.esm.js";
import { BASE } from "../src/config.js";
import { advance, hiddenCatchUpSeconds } from "../src/engine.js";
import { newState } from "../src/state.js";
import { save } from "../src/save.js";

const H = 3600;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (ok) { console.log(`  ✅ ${name}`); return; }
  failed += 1;
  console.log(`  ❌ ${name}${detail ? `：${detail}` : ""}`);
};
/** 相对误差比较（产出的熵对 t 是线性的，理论值可精确算 ⇒ 这里只给浮点余量） */
const near = (a, b, rel = 0.01) => Math.abs(a - b) <= Math.abs(b) * rel;
const fmt = (v) => (typeof v === "number" ? v.toFixed(3) : String(v));

// ══════════════════════════════════════════════════════════
// ① advance 的上限：cap 参数生效，默认仍按 4h
// ══════════════════════════════════════════════════════════
/**
 * 造一个"产出固定"的状态来量推进了多久：
 *   · 1000 个熵阱 ⇒ 每秒 1000 熵，`stats.totalEntropy` 是**毛产量**、跨重置累计
 *   · `brokenInfinity` ⇒ 关掉强制大坍缩，避免里程碑/重置干扰计时度量
 */
function makeTimedState() {
  const s = newState();
  s.brokenInfinity = true;
  s.resources.traps = new Decimal(1000);
  return s;
}

/** 请求 `requestedSeconds` 秒、上限 `cap`（undefined = 走 advance 的默认值） */
function runAdvance(requestedSeconds, cap) {
  const s = makeTimedState();
  // 60 秒一块：上限语义与块大小无关，少跑几千次 tick 让 lab 保持秒级
  advance(s, requestedSeconds, 60, cap);
  // `runElapsed` 是 tick 里按 dt 累加的**本轮时长** ⇒ 精确等于 advance 真正推进的秒数
  return { seconds: s.runElapsed, entropy: s.stats.totalEntropy.toNumber() };
}

console.log("=".repeat(96));
console.log("离线 / 后台补时 lab · cap 参数 / hidden 补时口径 / 保存失败不改 lastSavedAt");
console.log("=".repeat(96));

console.log("\n── ① advance 的上限：升级 cap 生效；默认仍裁 4h ──");
const e4Default = runAdvance(4 * H);          // 请求 4h（默认 cap 内，原样通过）
const e10Default = runAdvance(10 * H);        // 请求 10h（默认 cap = 4h ⇒ 裁到 4h）
const e4Cap4 = runAdvance(5 * H, 4 * H);      // 5h 请求 + 4h cap ⇒ 裁到 4h
const e5Cap5 = runAdvance(5 * H, 5 * H);      // 5h 请求 + 5h cap ⇒ 完整 5h
const e5Cap6 = runAdvance(5 * H, 6 * H);      // 5h 请求 + 6h cap ⇒ 完整 5h
const e6Cap6 = runAdvance(6 * H, 6 * H);      // 6h 请求 + 6h cap ⇒ 完整 6h

check("不传 cap：请求 10h 仍被裁到基础 4h（默认行为不变）",
  e10Default.seconds === 4 * H && e10Default.seconds === e4Default.seconds,
  `10h→${fmt(e10Default.seconds)}s｜4h→${fmt(e4Default.seconds)}s`);
check("cap=4h 时 5h 请求被裁到 4h（cap 是硬上限）",
  e4Cap4.seconds === 4 * H,
  `5h@4h→${fmt(e4Cap4.seconds)}s`);
check("★ 升级 cap 生效：5h 请求 + 6h cap 能完整推进 5h",
  e5Cap6.seconds === 5 * H && e5Cap6.seconds === e5Cap5.seconds,
  `5h@6h→${fmt(e5Cap6.seconds)}s｜5h@5h→${fmt(e5Cap5.seconds)}s`);
check("★ 升级后确实突破 4h（5h@6h ≈ 1.25 × 5h@4h 的产出）",
  near(e5Cap6.entropy, e4Cap4.entropy * 1.25, 0.02),
  `5h@6h 总熵=${fmt(e5Cap6.entropy)}｜4h 总熵=${fmt(e4Cap4.entropy)}｜倍率=${fmt(e5Cap6.entropy / e4Cap4.entropy)}`);
check("6h 请求 + 6h cap ≈ 1.5 × 4h（少裁 2 小时）",
  e6Cap6.seconds === 6 * H && near(e6Cap6.entropy, e4Cap4.entropy * 1.5, 0.02),
  `6h@6h→${fmt(e6Cap6.seconds)}s｜总熵倍率=${fmt(e6Cap6.entropy / e4Cap4.entropy)}`);
check("默认 cap 常量仍是 4h（没有偷偷改 BASE）",
  BASE.offlineCapSeconds === 4 * H,
  `BASE.offlineCapSeconds=${BASE.offlineCapSeconds}`);

// ══════════════════════════════════════════════════════════
// ③ hidden 补时口径 + 真的推进
// ══════════════════════════════════════════════════════════
console.log("\n── ③ hiddenCatchUpSeconds：后台补时口径 ──");
const cap4 = BASE.offlineCapSeconds;          // 基础 4h
const cap6 = cap4 + 2 * H;                    // 模拟「离线时长扩展」+2 级（每级 1h）

check("10 分钟后台 ⇒ 补 600 秒",
  hiddenCatchUpSeconds(10 * 60 * 1000, cap4) === 600,
  `返回 ${fmt(hiddenCatchUpSeconds(10 * 60 * 1000, cap4))}s`);
check("6 小时后台 + 6h cap ⇒ 完整补 6h（升级后的 cap 也走同一入口）",
  hiddenCatchUpSeconds(6 * H * 1000, cap6) === 6 * H,
  `返回 ${fmt(hiddenCatchUpSeconds(6 * H * 1000, cap6))}s`);
check("10 小时后台 + 4h cap ⇒ 裁到 4h",
  hiddenCatchUpSeconds(10 * H * 1000, cap4) === cap4,
  `返回 ${fmt(hiddenCatchUpSeconds(10 * H * 1000, cap4))}s`);
check("gap < 1 秒 ⇒ 不补（交给下一帧 rAF，避免双计）",
  hiddenCatchUpSeconds(500, cap4) === 0 && hiddenCatchUpSeconds(999, cap4) === 0,
  `500ms→${fmt(hiddenCatchUpSeconds(500, cap4))}｜999ms→${fmt(hiddenCatchUpSeconds(999, cap4))}`);
check("恰好 1 秒 ⇒ 补 1 秒（边界不吞时间）",
  hiddenCatchUpSeconds(1000, cap4) === 1);
check("不传 cap ⇒ 默认基础 4h",
  hiddenCatchUpSeconds(10 * H * 1000) === cap4,
  `返回 ${fmt(hiddenCatchUpSeconds(10 * H * 1000))}s`);
check("非法输入（NaN / 负数 / 0）⇒ 0",
  hiddenCatchUpSeconds(NaN, cap4) === 0
  && hiddenCatchUpSeconds(-5000, cap4) === 0
  && hiddenCatchUpSeconds(0, cap4) === 0);
{
  // 端到端：10 分钟 gap → 补时函数 → advance，必须真的推进 600 秒（不是 1 秒）
  const s = makeTimedState();
  const catchUp = hiddenCatchUpSeconds(10 * 60 * 1000, cap6);
  advance(s, catchUp, 5, cap6);
  const entropy = s.stats.totalEntropy.toNumber();
  check("10 分钟后台补时真的推进 10 分钟（不是 1 秒）",
    Math.abs(s.runElapsed - 600) < 1e-9 && entropy > 600 * 1000,
    `推进=${fmt(s.runElapsed)}s（期望 600）｜总熵=${fmt(entropy)}（至少 ${1000 * 600}）`);
}

// ══════════════════════════════════════════════════════════
// ⑤ 保存失败：save() 返回 0 且 lastSavedAt 不变
// ══════════════════════════════════════════════════════════
console.log("\n── ⑤ save()：setItem 失败必须返回 0，且不推进 lastSavedAt ──");

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}
/** 写什么抛什么 —— 模拟隐私模式 / 配额满 / 存储被禁用 */
class ThrowingStorage extends MemoryStorage {
  setItem() { throw new Error("QuotaExceededError（测试桩）"); }
}

const good = new MemoryStorage();
globalThis.localStorage = good;
{
  const s = newState();
  s.lastSavedAt = 111;
  const bytes = save(s);
  const raw = good.getItem(BASE.saveKey);
  const payload = raw ? JSON.parse(raw).payload : null;
  check("正常写入：返回字节数 > 0", bytes > 0, `return=${bytes}`);
  check("正常写入：lastSavedAt 被更新",
    s.lastSavedAt > 111,
    `lastSavedAt=${s.lastSavedAt}`);
  check("正常写入：payload 里的时间 = 本次写入时间（下次离线时长从它算）",
    !!payload && payload.lastSavedAt === s.lastSavedAt,
    `payload.lastSavedAt=${payload?.lastSavedAt}｜state=${s.lastSavedAt}`);
}

const bad = new ThrowingStorage();
globalThis.localStorage = bad;
{
  const s = newState();
  s.lastSavedAt = 222;
  // 预期内的失败：把 console.warn 收起来（同时断言"确实留了日志"，不是静默失败）
  const warns = [];
  const origWarn = console.warn;
  console.warn = (...args) => { warns.push(args.map(String).join(" ")); };
  let bytes;
  try {
    bytes = save(s);
  } finally {
    console.warn = origWarn;
  }
  check("★ setItem 抛异常：save() 返回 0", bytes === 0, `return=${bytes}`);
  check("★ setItem 抛异常：lastSavedAt 保持原值（没有假装存过）",
    s.lastSavedAt === 222,
    `lastSavedAt=${s.lastSavedAt}`);
  check("失败时 localStorage 里没有任何新档", bad.getItem(BASE.saveKey) === null);
  check("失败时 console.warn 有技术细节（调用方之外还有痕迹）",
    warns.some((w) => w.includes("存档失败")),
    warns.join(" / "));
}

// 恢复一个可用的存储，避免后续（本进程内）任何 save 调用误用抛错桩
globalThis.localStorage = good;

// ══════════════════════════════════════════════════════════
// ⑥ 接线守卫（静态）：这三条 bug 的本质都是"下层修好了，上层没接上"
// ══════════════════════════════════════════════════════════
//   纯 Node 跑不了 main.js（它一加载就要 DOM），但接线只有几行 ⇒ 用源码判据兜住：
//   · 离线结算必须把 cap **显式**传进 advance（否则升级又被默认 4h 裁掉 ✗）
//   · 回前台必须调用 hiddenCatchUpSeconds 并按 cap 补时 + 重置帧锚点
//   · onSave 必须**先看返回值**再 flashSave（否则失败也闪「已保存 ✓」✗）
console.log("\n── ⑥ 接线守卫（main.js 静态判据）──");
{
  const code = readFileSync(new URL("../src/main.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")       // 去掉块注释（注释里出现旧写法不算）
    .replace(/^\s*\/\/.*$/gm, "");          // 去掉整行注释
  const flat = code.replace(/\s+/g, " ");   // 折叠空白 ⇒ 不依赖具体换行/缩进
  check("离线结算把 cap 显式传给 advance（不是依赖默认 4h）",
    /const cap = offlineCapSeconds\(state\);/.test(flat)
    && /advance\(state, capped, 5, (?:cap|offlineCapSeconds\(state\))\);/.test(flat));
  check("回到前台按 hiddenCatchUpSeconds(gapMs, cap) 补时",
    /const catchUp = hiddenCatchUpSeconds\(gapMs, cap\);/.test(flat)
    && /advance\(state, catchUp, 5, (?:cap|offlineCapSeconds\(state\))\);/.test(flat));
  check("补完重置帧锚点（避免下一帧 rAF 再把同一段 gap 算一次）",
    /lastFrame = performance\.now\(\); lastFrameReal = lastFrame;/.test(flat));
  check("onSave 只有 save() 返回值 > 0 才 flashSave（失败走日志）",
    /flashSave\(\);/.test(flat)
    && /if \((?:bytes|n) > 0\) \{? flashSave\(\);/.test(flat)
    && /warnSaveFailed\("手动存档"\);/.test(flat));
}

// ══════════════════════════════════════════════════════════
// 汇总
// ══════════════════════════════════════════════════════════
console.log();
console.log("=".repeat(96));
console.log(failed === 0 ? "  ✅ 离线 / 后台补时 / 保存失败 全部通过" : `  ❌ ${failed} 项失败`);
console.log("=".repeat(96));
process.exitCode = failed === 0 ? 0 : 1;
