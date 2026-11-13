#!/usr/bin/env node
/**
 * tools/save-integrity-lab.mjs —— 存档完整性（格式版本 / checksum / 旧档迁移 / 漏字段守卫）
 *
 * 为什么需要它：
 *   ① 存档是玩家唯一的进度载体，写坏了**没有第二次机会**；
 *   ② `serialize` 是全量、`deserialize` 是显式白名单 —— 2026 年七巧板就因此
 *      刷新即丢（6 个字段一个都没写）。本 lab 把"新字段忘了写进白名单"变成红灯。
 *
 * 覆盖：
 *   ① round-trip 全字段（含 tangram 进度 / space / nekoAffinity）
 *   ② 篡改检测（改 payload / 改 checksum / 改 formatVersion）
 *   ③ 旧档迁移（无外层字段的裸档、v1 旧信封、旧 formatVersion）
 *   ④ 校验失败不覆盖原档（load 后 save 必须拒绝写入，localStorage 字节不变）
 *   ⑤ `serialize` 的 key 集合 ⊆ `deserialize` 接受集合
 *
 * 用法：`node tools/save-integrity-lab.mjs`
 */
import Decimal from "../dist/break_eternity.esm.js";
import { BASE, PAGE_KEYS } from "../src/config.js";
import { deserialize, newState, serialize } from "../src/state.js";
import {
  SAVE_FORMAT_VERSION, checksumOf, clear, createSaveEnvelope, fnv1a,
  isSaveWriteBlocked, load, save, saveBlockedReason, stableStringify, verifySaveEnvelope,
} from "../src/save.js";

const D = (v) => new Decimal(v);
let failed = 0;
const check = (name, ok, detail = "") => {
  if (ok) { console.log(`  ✅ ${name}`); return; }
  failed += 1;
  console.log(`  ❌ ${name}${detail ? `：${detail}` : ""}`);
};

// ── localStorage 桩（Node 里没有；必须在第一次 save()/load() 之前装上）──
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}
const storage = new MemoryStorage();
globalThis.localStorage = storage;
const KEY = BASE.saveKey;
const rawSave = () => storage.getItem(KEY);
const setRawSave = (value) => storage.setItem(KEY, value);

// ══════════════════════════════════════════════════════════
// 构造一个「所有字段都非默认」的状态
// ══════════════════════════════════════════════════════════
function makeFullState() {
  const s = newState();

  s.version = 2;
  s.startedAt = 111;
  s.lastSavedAt = 222;
  s.playTimeMs = 333;

  s.resources.entropy = D("1.5e10");
  s.resources.particle = D("2.5e11");
  s.resources.matter = D("3.5e12");
  s.resources.traps = D("4.5e13");
  s.stats.clicks = 44;
  s.stats.totalEntropy = D("5.5e14");

  for (const k of Object.keys(s.levels)) s.levels[k] = D(5);
  for (const k of Object.keys(s.voidUpgrades)) s.voidUpgrades[k] = true;
  for (const k of Object.keys(s.zpeMilestones)) s.zpeMilestones[k] = true;
  for (const k of Object.keys(s.quantumMilestones)) s.quantumMilestones[k] = true;
  for (const k of Object.keys(s.deMilestones)) s.deMilestones[k] = true;
  for (const k of Object.keys(s.deUpgradeLevels)) s.deUpgradeLevels[k] = D(2);
  for (const k of Object.keys(s.deFirstPurchase)) s.deFirstPurchase[k] = true;
  for (const k of Object.keys(s.firstPurchase)) s.firstPurchase[k] = true;
  for (const k of PAGE_KEYS) s.pageUnlocked[k] = true;

  // Decimal 标量：每个给不同的非零值，漏读时一定会和默认值 D(0) 不同
  const decimals = [
    "zpe", "zpeTotal", "darkEnergy", "zpeAccumulator",
    "zpeEngineLevel", "eternityCount", "eternityPoints", "eternityPointsTotal",
    "infinityPoints", "bigCrunchCount", "peakMatter", "ipDoubleLevel", "ipTimeAccrued",
    "quantum", "quantumPairs", "quantumPairsTotal", "peakQuantumRun",
    "maxIpThisEternity", "dreamPoints",
  ];
  decimals.forEach((key, i) => { s[key] = D(i + 2); });
  s.zpeFixedMultiplier = D("2.5");

  s.darkEnergyTotal = D("9e9");
  s.deAccum = D(123);
  s.spanDeBase = D(1000);
  s.totalQuantumPairs = D(9);
  s.eternityDarkMatter = 7;
  s.epMultLevel = 2;
  s.v1Log10 = 12.5;
  s.nekoAffinity = 42.5;
  s.nekoDriftStamps = [[1000, 1], [2000, -2]];
  s.infinityElapsed = 9;
  s.runElapsed = 12.5;
  s.v9 = true;
  s.phaseTransmuterUnlocked = true;
  s.infinityFromQuantumBought = true;
  s.ipTimeBought = true;
  s.ipToTransmuterBought = true;
  s.ipToZpeBought = true;
  s.pairBoostBought = true;
  s.thresholdFlatBought = true;
  s.zpeEngineUnlocked = true;
  s.brokenInfinity = true;

  s.autoToggles = { autoInfinities: true, autoSpaceDu: true };
  s.autoCrunch = {
    isActive: true, mode: "amount", amount: "3", time: 0.5,
    xHighest: "4", dynamic: true, lastAtMs: 999,
  };
  s.startBought = { pageA: true };
  s.speedBought = { speedA: true };
  s.dreamUpgrades = { offline: true };
  s.dreamUpgradeLevels = { offline: 3 };
  s.dreamAwarded = { ach1: true };

  s.tangramOwned = { largeA: true, smallB: true };
  s.tangramPity = { largeA: 2, smallB: 1 };
  s.tangramPlaced = { largeA: { rot: 1, flip: true, dx: 0.5, dy: -1 } };
  s.tangramCoordVersion = 2;
  s.tangramCleared = [1, 2, 3, 4, 5, 6];
  s.tangramChallenge = { solved: 3 };
  s.tangramChallengeThisEternity = 4;
  s.tangramSeed = 123;

  s.space.se = D("1e6");
  s.space.st = D("2e6");
  s.space.challenge = true;
  s.space.ipPeak = D("3e6");
  s.space.bestIp = D("4e6");
  s.space.bestEp = D("5e6");
  s.space.challengeSe = D("6e6");
  s.space.challengeSeBase = D("7e6");
  s.space.upgrades = { du1: 3, du7: true, du11: true };

  s.log = [{ t: 11, text: "a" }, { t: 22, text: "b" }];
  return s;
}

/** 找第一条差异（只用于失败时给线索） */
function firstDiff(a, b, prefix = "") {
  if (a === b) return null;
  if (typeof a !== typeof b) return `${prefix}: ${typeof a} ≠ ${typeof b}`;
  if (a && b && typeof a === "object") {
    if (Array.isArray(a) !== Array.isArray(b)) return `${prefix}: array ≠ object`;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (!(k in a)) return `${prefix}.${k}: 往返后多出`;
      if (!(k in b)) return `${prefix}.${k}: 往返后丢失`;
      const d = firstDiff(a[k], b[k], prefix ? `${prefix}.${k}` : k);
      if (d) return d;
    }
    return null;
  }
  return `${prefix}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
}

// ══════════════════════════════════════════════════════════
// 守卫：serialize 的 key 集合 ⊆ deserialize 接受集合
// ══════════════════════════════════════════════════════════
/**
 * 用 Proxy 记录 deserialize 到底读了哪些路径，再和 serialize 产物的路径集合对比。
 * 返回**没被读取**的路径（空数组 = 通过）。
 */
function findUnreadKeys(payload) {
  const reads = new Set();
  const wrap = (value, prefix) => {
    if (!value || typeof value !== "object") return value;
    return new Proxy(value, {
      get(target, prop, receiver) {
        if (typeof prop === "string") reads.add(prefix ? `${prefix}.${prop}` : prop);
        const v = Reflect.get(target, prop, receiver);
        return wrap(v, prefix ? `${prefix}.${prop}` : prop);
      },
    });
  };

  deserialize(wrap(payload, ""));

  const missing = [];
  const walk = (value, prefix) => {
    // 根对象本身不会被 deserialize "读取"（它读的是根下的字段）⇒ 不检查空前缀
    if (value && typeof value === "object") {
      if (prefix && !reads.has(prefix)) missing.push(prefix);
      const entries = Array.isArray(value)
        ? value.map((v, i) => [String(i), v])
        : Object.entries(value);
      for (const [k, v] of entries) walk(v, prefix ? `${prefix}.${k}` : k);
    } else if (prefix && !reads.has(prefix)) {
      missing.push(prefix);
    }
  };
  walk(payload, "");
  return missing;
}

// ══════════════════════════════════════════════════════════
// ① round-trip 全字段
// ══════════════════════════════════════════════════════════
console.log("=".repeat(96));
console.log("存档完整性 lab · formatVersion / checksum / 旧档迁移 / 漏字段守卫");
console.log("=".repeat(96));
console.log("\n── ① round-trip 全字段 ──");

const full = makeFullState();
const fullPayload = serialize(full);
const roundTrip = deserialize(fullPayload);
check("deserialize 报告 ok", roundTrip.ok === true);
const backText = stableStringify(serialize(roundTrip.state));
const payloadText = stableStringify(fullPayload);
check(
  "全字段 round-trip 一致（含所有 Decimal / 映射 / 数组）",
  backText === payloadText,
  firstDiff(JSON.parse(payloadText), JSON.parse(backText)) ?? "",
);
{
  const b = roundTrip.state;
  check("七巧板进度保留", b.tangramOwned.largeA === true
    && b.tangramPity.largeA === 2
    && b.tangramPlaced.largeA.dx === 0.5
    && b.tangramCleared[5] === 6
    && b.tangramChallenge.solved === 3
    && b.tangramChallengeThisEternity === 4
    && b.tangramSeed === 123,
  `owned=${b.tangramOwned.largeA}｜placed.dx=${b.tangramPlaced.largeA?.dx}｜cleared=${b.tangramCleared}`);
  check("space 进度保留", b.space.challenge === true
    && b.space.se.eq(D("1e6"))
    && b.space.upgrades.du1 === 3
    && b.space.upgrades.du7 === true
    && b.space.challengeSeBase.eq(D("7e6")),
  `challenge=${b.space.challenge}｜se=${b.space.se}｜du1=${b.space.upgrades.du1}`);
  check("neko 进度保留", b.nekoAffinity === 42.5 && b.nekoDriftStamps.length === 2,
    `affinity=${b.nekoAffinity}｜stamps=${b.nekoDriftStamps.length}`);
  check("此前漏读的活字段补回", b.runElapsed === 12.5 && b.deAccum.eq(D(123))
    && b.spanDeBase.eq(D(1000)) && b.totalQuantumPairs.eq(D(9)) && b.v9 === true,
  `runElapsed=${b.runElapsed}｜deAccum=${b.deAccum}｜spanDeBase=${b.spanDeBase}`);
}

// ══════════════════════════════════════════════════════════
// ①b 当前格式：save() → load()（真实 localStorage 路径）
// ══════════════════════════════════════════════════════════
console.log("\n── ①b save()/load() 当前格式 ──");
{
  clear();
  const wrote = save(full);
  const raw = rawSave();
  check("save() 写出存档", wrote > 0 && typeof raw === "string", `return=${wrote}`);
  const parsed = JSON.parse(raw);
  check("外层是 {formatVersion, checksum, payload}", parsed.formatVersion === SAVE_FORMAT_VERSION
    && typeof parsed.checksum === "string" && parsed.payload && typeof parsed.payload === "object");
  check("checksum 与 payload 对应", parsed.checksum === checksumOf(parsed.payload));
  const res = load();
  check("load() 校验通过（非 corrupted / 非 legacy）", !!res && res.ok === true
    && res.corrupted === false && res.legacy === false
    && res.formatVersion === SAVE_FORMAT_VERSION,
  res ? `ok=${res.ok} legacy=${res.legacy} reason=${res.reason ?? "-"}` : "null");
  check("save/load 后关键字段一致", !!res
    && res.state.nekoAffinity === 42.5 && res.state.space.se.eq(D("1e6"))
    && res.state.tangramOwned.largeA === true,
  res ? `neko=${res.state.nekoAffinity}｜se=${res.state.space.se}` : "no state");
}

// ══════════════════════════════════════════════════════════
// ② 篡改检测
// ══════════════════════════════════════════════════════════
console.log("\n── ② 篡改检测 ──");
{
  const env = createSaveEnvelope(fullPayload);
  check("正常信封校验通过", verifySaveEnvelope(env).ok === true);

  const badPayload = JSON.parse(JSON.stringify(env));
  badPayload.payload.nekoAffinity = 43;
  const v1 = verifySaveEnvelope(badPayload);
  check("改 payload 被 checksum 抓到", !v1.ok && v1.reason === "checksum-mismatch",
    `reason=${v1.reason}`);

  const badChecksum = { ...env, checksum: "fnv1a:00000000" };
  const v2 = verifySaveEnvelope(badChecksum);
  check("改 checksum 被抓到", !v2.ok && v2.reason === "checksum-mismatch",
    `reason=${v2.reason}`);

  const future = { ...env, formatVersion: SAVE_FORMAT_VERSION + 1 };
  const v3 = verifySaveEnvelope(future);
  check("未来 formatVersion 拒绝载入", !v3.ok && v3.reason === "future-format-version",
    `reason=${v3.reason}`);

  const a = { b: 1, a: { d: 2, c: [3, { y: 1, x: 2 }] } };
  const b = { a: { c: [3, { x: 2, y: 1 }], d: 2 }, b: 1 };
  check("稳定序列化与键顺序无关", stableStringify(a) === stableStringify(b));
  check("FNV-1a 标准向量", fnv1a("hello") === "4f9f2cab", fnv1a("hello"));
  check("FNV-1a 对内容敏感", fnv1a("a") !== fnv1a("b") && fnv1a("存档") === fnv1a("存档"));
}

// ══════════════════════════════════════════════════════════
// ③ 旧档迁移（裸状态 / v1 信封 / 旧 formatVersion）
// ══════════════════════════════════════════════════════════
console.log("\n── ③ 旧档迁移 ──");
const legacyPayload = {
  version: 1,
  lastSavedAt: Date.now() - 120_000,
  tangramOwned: { largeA: true },
  tangramPity: { largeA: 2 },
  tangramPlaced: { largeA: { dx: 1, dy: 1, rot: 0, flip: false } },   // 无 tangramCoordVersion ⇒ 旧坐标
  tangramCleared: [1, 0, 0, 0, 0, 0],
  tangramChallenge: { solved: 1 },
  space: {
    se: "100", st: "5", challenge: true, ipPeak: "10", bestIp: "10", bestEp: "2",
    challengeSe: "1", challengeSeBase: "1", upgrades: { du1: 2 },
  },
  nekoAffinity: 37,
  nekoDriftStamps: [[1, 2]],
  autoCrunch: { isActive: true },
  eternityCount: 2,
  deAccum: "123",
  spanDeBase: "1000",
  runElapsed: 5,
  totalQuantumPairs: "9",
  v9: true,
};
{
  clear();
  setRawSave(JSON.stringify(legacyPayload));
  const res = load();
  check("裸旧档能读（无 formatVersion / checksum）", !!res && res.ok === true
    && res.legacy === true && res.formatVersion === 0 && !res.corrupted,
  res ? `ok=${res.ok} legacy=${res.legacy} fv=${res.formatVersion}` : "null");
  const b = res?.state;
  check("旧档字段不丢：tangram / space / neko", !!b
    && b.tangramOwned.largeA === true && b.tangramPity.largeA === 2
    && b.space.challenge === true && b.space.se.eq(D(100)) && b.space.upgrades.du1 === 2
    && b.nekoAffinity === 37 && b.nekoDriftStamps.length === 1,
  b ? `owned=${b.tangramOwned.largeA}｜se=${b.space.se}｜neko=${b.nekoAffinity}` : "no state");
  check("旧七巧板坐标迁移（dy=4-dy / rot+2 / flip 取反）", !!b
    && b.tangramCoordVersion === 2
    && b.tangramPlaced.largeA.dy === 3
    && b.tangramPlaced.largeA.rot === 2
    && b.tangramPlaced.largeA.flip === true,
  b ? `dy=${b.tangramPlaced.largeA?.dy} rot=${b.tangramPlaced.largeA?.rot} flip=${b.tangramPlaced.largeA?.flip}` : "");
  check("旧档其余活字段也保留", !!b
    && b.autoToggles.autoInfinities === true
    && b.runElapsed === 5 && b.deAccum.eq(D(123)) && b.spanDeBase.eq(D(1000))
    && b.totalQuantumPairs.eq(D(9)) && b.v9 === true,
  b ? `autoInfinities=${b.autoToggles.autoInfinities}｜deAccum=${b.deAccum}｜span=${b.spanDeBase}` : "");
  check("eternityCount>0 ⇒ 页面解锁兜底", !!b && PAGE_KEYS.every((k) => b.pageUnlocked[k] === true));
  check("离线时长从 lastSavedAt 推得", !!res && res.offlineSeconds > 60,
    res ? `${res.offlineSeconds.toFixed(1)}s` : "");
}
{
  // v1 旧信封：有 payload、没有 checksum
  clear();
  setRawSave(JSON.stringify({ formatVersion: 1, payload: legacyPayload }));
  const res = load();
  check("v1 旧信封（无 checksum）能读", !!res && res.ok === true && res.legacy === true
    && res.formatVersion === 1 && !res.corrupted,
  res ? `ok=${res.ok} legacy=${res.legacy} fv=${res.formatVersion}` : "null");
}
{
  // v1 旧信封 + checksum：也按旧版本接受
  clear();
  const payload = { ...legacyPayload, lastSavedAt: Date.now() };
  setRawSave(JSON.stringify({ formatVersion: 1, checksum: checksumOf(payload), payload }));
  const res = load();
  check("v1 旧 formatVersion + checksum 能读", !!res && res.ok === true
    && res.legacy === true && res.formatVersion === 1,
  res ? `ok=${res.ok} legacy=${res.legacy} fv=${res.formatVersion}` : "null");
}

// ══════════════════════════════════════════════════════════
// ④ 校验失败不覆盖原档
// ══════════════════════════════════════════════════════════
console.log("\n── ④ 校验失败不覆盖原档 ──");
{
  clear();
  const env = createSaveEnvelope(serialize(makeFullState()));
  env.payload.nekoAffinity = 99;                 // 改内容但保留旧 checksum
  const raw = JSON.stringify(env);
  setRawSave(raw);
  const res = load();
  check("篡改档被标记 corrupted", !!res && res.ok === false && res.corrupted === true
    && res.reason === "checksum-mismatch",
  res ? `ok=${res.ok} corrupted=${res.corrupted} reason=${res.reason}` : "null");
  check("载入后进入写保护", isSaveWriteBlocked() === true
    && saveBlockedReason() === "checksum-mismatch", saveBlockedReason());
  const wrote = save(newState());
  check("save() 拒绝写入（返回 0）", wrote === 0, `return=${wrote}`);
  check("原档字节未被覆盖", rawSave() === raw);
  clear();
  check("clear() 解除写保护", isSaveWriteBlocked() === false);
}
{
  clear();
  const raw = "{ 这不是合法 JSON";
  setRawSave(raw);
  const res = load();
  check("JSON 损坏也走 corrupted + 写保护", !!res && res.corrupted === true
    && res.reason === "json-parse-error" && isSaveWriteBlocked() === true,
  res ? `reason=${res.reason}` : "null");
  check("JSON 损坏时 save() 不覆盖", save(newState()) === 0 && rawSave() === raw);
  clear();
}
{
  clear();
  const future = JSON.stringify({
    formatVersion: SAVE_FORMAT_VERSION + 1,
    checksum: "fnv1a:deadbeef",
    payload: serialize(makeFullState()),
  });
  setRawSave(future);
  const res = load();
  check("未来格式版本不覆盖原档", !!res && res.corrupted === true
    && res.reason === "future-format-version"
    && save(newState()) === 0 && rawSave() === future,
  res ? `reason=${res.reason}` : "null");
  clear();
}

// ══════════════════════════════════════════════════════════
// ⑤ key 集合守卫：serialize ⊆ deserialize 接受集合
// ══════════════════════════════════════════════════════════
console.log("\n── ⑤ serialize key 集合 ⊆ deserialize 接受集合 ──");
{
  const missing = findUnreadKeys(fullPayload);
  check("所有 serialize 字段都被 deserialize 读到", missing.length === 0,
    missing.slice(0, 10).join(", "));

  const injected = JSON.parse(JSON.stringify(fullPayload));
  injected.__futureField = 1;
  injected.space.__futureNested = 2;
  const caught = findUnreadKeys(injected);
  check("守卫能抓住新增字段漏读", caught.includes("__futureField")
    && caught.includes("space.__futureNested"), caught.slice(0, 10).join(", "));
}

// ══════════════════════════════════════════════════════════
// 汇总
// ══════════════════════════════════════════════════════════
console.log();
console.log("=".repeat(96));
console.log(failed === 0 ? "  ✅ 存档完整性全部通过" : `  ❌ ${failed} 项失败`);
console.log("=".repeat(96));
process.exitCode = failed === 0 ? 0 : 1;
