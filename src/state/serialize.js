/**
 * state/serialize.js —— 存档序列化 / 反序列化（含旧档迁移）
 *
 * ★ 2026 模块化：由 673 行的 state.js 按职责拆出（声明与注释逐字保留）。
 *    对外统一从 `src/state.js`（barrel）导入。
 */
import { NEKO, PAGE_KEYS } from "../config.js";
import { D } from "./helpers.js";
import { LOG_MAX } from "./log.js";
import { newState } from "./schema.js";
import Decimal from "../../dist/break_eternity.esm.js";

export function serialize(state) {
  const enc = (v) => {
    if (v instanceof Decimal) return v.toString();
    if (Array.isArray(v)) return v.map(enc);
    if (v && typeof v === "object") {
      const o = {};
      for (const [k, val] of Object.entries(v)) o[k] = enc(val);
      return o;
    }
    return v;
  };
  return enc(state);
}

/** 反序列化：按 newState() 的骨架逐字段还原，缺失/损坏的字段回落到默认值。 */
export function deserialize(raw) {
  const fresh = newState();
  if (!raw || typeof raw !== "object") return { state: fresh, ok: false };

  const num = (v, d) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const dec = (v) => {
    try {
      const d = D(v);
      return d.isFinite() ? d : D(0);
    } catch {
      return D(0);
    }
  };
  const bool = (v) => v === true;

  const s = fresh;

  // ★★★ 2026（用户：「每次永恒后为什么要重置自动化的开关状态」）——
  //   根因：这两项只写在 newState()，**deserialize 里没有** ⇒ 存档/读档就丢 ✗
  s.autoToggles = raw.autoToggles && typeof raw.autoToggles === "object"
    ? Object.fromEntries(Object.entries(raw.autoToggles).filter(([, v]) => v === true)) : {};
  // ★★★ 2026 迁移（修「梦想页开关是摆设」时统一开关）：
  //   `autoInfinities` 原来有**两个**开关（梦想页 `autoToggles` + 面板 `autoCrunch.isActive`），
  //   引擎只认后者 ⇒ 梦想页的开关点了没用 ✗
  //   现在**唯一开关** = `autoToggles.autoInfinities`；这里把老档的 `isActive:true` 迁移过来，
  //   保证"原来开着自动坍缩的玩家升级后仍然是开的" ✓
  //   ⚠️ 只在老档**没有** `autoToggles.autoInfinities` 时才迁移（不覆盖玩家新设置）✓
  if (raw.autoCrunch?.isActive === true && s.autoToggles.autoInfinities !== true) {
    s.autoToggles.autoInfinities = true;
  }
  s.autoCrunch = {
    isActive: raw.autoCrunch?.isActive === true,          // 已弃用（保留读写兼容），引擎不再看它
    mode: ["amount", "time", "xHighest"].includes(raw.autoCrunch?.mode) ? raw.autoCrunch.mode : "xHighest",
    amount: String(raw.autoCrunch?.amount ?? "1"),
    time: Math.max(0.1, num(raw.autoCrunch?.time, 0.1)),   // 时间模式默认 0.1 秒
    xHighest: String(raw.autoCrunch?.xHighest ?? "2"),
    dynamic: raw.autoCrunch?.dynamic === true,
    lastAtMs: Math.max(0, num(raw.autoCrunch?.lastAtMs, 0)),
  };
  s.maxIpThisEternity = dec(raw.maxIpThisEternity);   // ★ Decimal 存储（num 会截断成 Infinity ✗）
  s.version = num(raw.version, fresh.version);
  s.startedAt = num(raw.startedAt, fresh.startedAt);
  s.lastSavedAt = num(raw.lastSavedAt, Date.now());
  s.playTimeMs = num(raw.playTimeMs, 0);

  const r = raw.resources ?? {};
  s.resources.entropy = dec(r.entropy);
  s.resources.particle = dec(r.particle);
  s.resources.matter = dec(r.matter);
  s.resources.traps = dec(r.traps);
  s.dreamPoints = dec(raw.dreamPoints);

  const lv = raw.levels ?? {};
  for (const k of Object.keys(fresh.levels)) s.levels[k] = dec(lv[k]);

  const vu = raw.voidUpgrades ?? {};
  for (const k of Object.keys(fresh.voidUpgrades)) s.voidUpgrades[k] = bool(vu[k]);

  const qm = raw.quantumMilestones ?? {};
  for (const k of Object.keys(fresh.quantumMilestones)) s.quantumMilestones[k] = bool(qm[k] === true);
  const zm = raw.zpeMilestones ?? {};
  for (const k of Object.keys(fresh.zpeMilestones)) s.zpeMilestones[k] = bool(zm[k]);

  const dm = raw.deMilestones ?? {};
  for (const k of Object.keys(fresh.deMilestones)) s.deMilestones[k] = bool(dm[k]);

  s.zpe = dec(raw.zpe);
  s.zpeTotal = dec(raw.zpeTotal);
  s.zpeFixedMultiplier = raw.zpeFixedMultiplier == null ? null : dec(raw.zpeFixedMultiplier);

  s.darkEnergy = dec(raw.darkEnergy);
  s.darkEnergyTotal = dec(raw.darkEnergyTotal);
  s.zpeAccumulator = dec(raw.zpeAccumulator);
  s.phaseTransmuterUnlocked = bool(raw.phaseTransmuterUnlocked);

  const dl = raw.deUpgradeLevels ?? {};
  for (const k of Object.keys(fresh.deUpgradeLevels)) s.deUpgradeLevels[k] = dec(dl[k]);

  const df = raw.deFirstPurchase ?? {};
  for (const k of Object.keys(fresh.deFirstPurchase)) s.deFirstPurchase[k] = bool(df[k]);

  const fp = raw.firstPurchase ?? {};
  for (const k of Object.keys(fresh.firstPurchase)) s.firstPurchase[k] = bool(fp[k]);

  const st = raw.stats ?? {};
  s.stats.clicks = num(st.clicks, 0);
  s.stats.totalEntropy = dec(st.totalEntropy);

  // ── 第四层：大坍缩 ──
  // ★ 旧存档里的 darkMatter / collapseCount / collapseThreshold 直接**忽略** ——
  //   那三样已经不存在了，读进来也没有字段可放。读旧档不会报错。
  s.infinityPoints = dec(raw.infinityPoints);
  s.bigCrunchCount = dec(raw.bigCrunchCount);
  s.brokenInfinity = raw.brokenInfinity === true;
  s.peakMatter = dec(raw.peakMatter);

  // ── ∞ 层：无限升级 ──
  s.ipDoubleLevel = dec(raw.ipDoubleLevel);
  // ⚠️ 2026：`raw.ic` **明文忽略**（IC 已删除）——
  //   老存档里还有 `ic: { active, completed }`，这里**不读、不迁移、不报错** ✓
  //   这比"读到一半就崩"安全：未知字段一律忽略是本项目既有的存档策略 ✓
  s.infinityFromQuantumBought = bool(raw.infinityFromQuantumBought);
  s.thresholdFlatBought = bool(raw.thresholdFlatBought);
  s.pairBoostBought = bool(raw.pairBoostBought);
  s.peakQuantumRun = dec(raw.peakQuantumRun);
  // ⚠️ 2025：不再读 `raw.accelLevel`（坍缩加速器已删除）。老存档带着它也无害 —— 直接忽略 ✓
  s.ipToZpeBought = bool(raw.ipToZpeBought);
  s.ipToTransmuterBought = bool(raw.ipToTransmuterBought);
  s.ipTimeBought = bool(raw.ipTimeBought);
  s.startBought = raw.startBought && typeof raw.startBought === "object"
    ? Object.fromEntries(Object.entries(raw.startBought).filter(([, v]) => v === true))
    : {};
  // ★★ 2025：**页面「曾经解锁过」的永久记录**（第一次永恒后保持解锁）
  //   ⚠️ 必须进反序列化 —— 否则刷新一次存档就从"已解锁"退回"锁" ✗
  //   只接受 `true`（与 startBought / speedBought 同一套写法）
  s.pageUnlocked = raw.pageUnlocked && typeof raw.pageUnlocked === "object"
    ? Object.fromEntries(Object.entries(raw.pageUnlocked).filter(([, v]) => v === true))
    : {};

  // ══════════════════════════════════════════════════════════
  // ★★★ 2025 **页面解锁的兜底**（用户实测报告：「永恒后还是会重置页面」）
  // ══════════════════════════════════════════════════════════
  // 病根：`pageUnlocked` 是 2025 才加的字段，**加之前存的档里根本没有它**。
  //   而 `markPageUnlocked` 只在"解锁那一刻"被打点 —— 旧档玩家早就过了那一刻
  //   ⇒ 记录永远是空的 ⇒ 永恒（或任何清空内容的重置）之后页面退回"待推进" ✗
  //
  // ⇒ ★ **用户裁定**：「永恒次数若 > 1 则解锁永恒前所有页面」
  //   ⚠️ 但实测证明**必须用 `> 0`**（我按字面改成 `> 1` 是错的 ✗）：
  //     用户的档是 `eternityCount = 1` 且 `pageUnlocked = {}`（旧档）——
  //     用 `> 1` 就**不补全** ⇒ 无限页（判据 `brokenInfinity`）与永恒页
  //     （判据 `eternityCount > 0`）都变成 `perma=false` ⇒ 退回"待推进" ✗
  //     而用 `> 0`：一次永恒即**证明**该档一路解锁过到永恒 ⇒ 补全全部 `PAGE_KEYS` ✓
  //   ⇒ 用户真正要的语义是「**永恒之前解锁过的所有页面**」—— 那就包含"永恒"这一页本身，
  //     判据就是"至少永恒过一次" = `> 0`。
  //
  //   ⚠️ 判据用 `raw.eternityCount`（**原始存档**），不是 `s.*` ——
  //      避免把"后续补的默认值"误当成旧档证据。
  //   ⚠️ 这是**载入时**的兜底：`deserialize` 只在读档时跑 ⇒ 活档期间的解锁
  //      仍走 `markPageUnlocked`（那是"解锁那一刻"的正规打点）✓
  const rawEternityCount = num(raw.eternityCount, 0);
  if (rawEternityCount > 0) {
    for (const k of PAGE_KEYS) s.pageUnlocked[k] = true;
  }

  s.speedBought = raw.speedBought && typeof raw.speedBought === "object"
    ? Object.fromEntries(Object.entries(raw.speedBought).filter(([, v]) => v === true))
    : {};
  s.infinityElapsed = num(raw.infinityElapsed, 0);
  // ⚠️ 2026：`fastestInfinitySec` / `icAutoTimer` **不再读取**（随 IC 删除）——
  //   老存档里仍有这两个字段 ⇒ **明文忽略**（不迁移、不报错）✓
  s.ipTimeAccrued = dec(raw.ipTimeAccrued);           // ★ Decimal 存储 ✓
  s.zpeEngineUnlocked = bool(raw.zpeEngineUnlocked);
  s.zpeEngineLevel = dec(raw.zpeEngineLevel);
  s.eternityPoints = dec(raw.eternityPoints);
  s.eternityCount = dec(raw.eternityCount);
  // ★ 2025：累计 EP（em5 的读数源）。**旧存档没有这个字段** ⇒ 用当前持有量兜底
  //   （旧档的持有量 ≥ 0，兜底后行为正常；新档从此只增不减 ✓）
  s.eternityPointsTotal = raw.eternityPointsTotal != null
    ? dec(raw.eternityPointsTotal)
    : s.eternityPoints;
  // ★★★ 2025：永恒升级「永恒增幅」的等级（新字段；旧档没有 ⇒ 默认 0 ✓）
  s.epMultLevel = Math.max(0, num(raw.epMultLevel, 0));
  // ★★★ 2026：暗物质**个数**（新字段 `eternityDarkMatter`；旧档没有 ⇒ 默认 0 ✓）
  //   ⚠️⚠️ 读的是 `raw.eternityDarkMatter`，**不是** `raw.darkMatter` ——
  //      后者属于**已删除**的「临界坍缩 → 暗物质」体系，本文件 :472 那一段明文忽略它 ✓
  //      （复用同名 ⇒ 删除前的老存档会凭空得到暗物质 ✗，见字段说明）
  //   ⚠️ 必须夹住（存档可被手改）：`Number(x) || 0` 把 NaN / 非数字打成 0，
  //      再 `Math.max(0, floor(...))` 夹掉负数与小数 ⇒ 脏数据不可能把 log10 弄坏 ✓
  s.eternityDarkMatter = Math.max(0, Math.floor(Number(num(raw.eternityDarkMatter, 0)) || 0));
  // ★★★ 2026：第一台速率的 log10 快照（**纯运行期派生量**，每帧都会被重写）
  //   ⇒ 旧档 / 脏数据一律回落 0；`num()` 已把 NaN / 非数字打成默认值 ✓
  s.v1Log10 = num(raw.v1Log10, 0);
  // ★★★ 2025（`docs/NEKO.md` §7）：好感度（跨轮次长期进度；旧档默认 0 ✓）
  //   ⚠️ 必须夹到 [NEKO.min, NEKO.max]（存档可被手改 ⇒ 不夹的话指数会失控 ✗）
  s.nekoAffinity = Math.max(NEKO.min, Math.min(NEKO.max, num(raw.nekoAffinity, 0)));
  // 窗口预算的时间戳：只接受 `[ms, delta]` 形状（防脏数据）
  s.nekoDriftStamps = Array.isArray(raw.nekoDriftStamps)
    ? raw.nekoDriftStamps
      .filter((x) => Array.isArray(x) && x.length === 2 && Number.isFinite(Number(x[0])) && Number.isFinite(Number(x[1])))
      .map((x) => [Number(x[0]), Number(x[1])])
      .slice(-64)                                   // 环形上限：够 5 分钟窗口用，防存档膨胀
    : [];

  // ── 量子 ──
  s.quantum = dec(raw.quantum);
  s.quantumPairs = dec(raw.quantumPairs);
  s.quantumPairsTotal = dec(raw.quantumPairsTotal);
  s.dreamUpgrades = raw.dreamUpgrades && typeof raw.dreamUpgrades === "object"
    ? Object.fromEntries(Object.entries(raw.dreamUpgrades).filter(([, v]) => v === true))
    : {};
  // ★★★ 2025：**可重复梦想升级的等级**（首个 = 「离线时长扩展」）——
  //   只接受正整数（夹掉 NaN / 负数 / 小数，防手改存档 ✗）
  s.dreamUpgradeLevels = (() => {
    const src = raw.dreamUpgradeLevels;
    if (!src || typeof src !== "object") return {};
    const out = {};
    for (const [k, v] of Object.entries(src)) {
      const n = Math.floor(Number(v));
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
    return out;
  })();

  // ── 梦想点成就表 ──
  s.dreamAwarded = raw.dreamAwarded && typeof raw.dreamAwarded === "object"
    ? Object.fromEntries(Object.entries(raw.dreamAwarded).filter(([, v]) => v === true))
    : {};

  s.log = Array.isArray(raw.log)
    ? raw.log.slice(-LOG_MAX).map((e) => ({ t: num(e?.t, Date.now()), text: String(e?.text ?? "") }))
    : [];

  // ★★★ 2026（用户：∞ 又回来咬人了，守卫点名 `darkEnergy` 与 `zpe`）——
  //   **读档自愈**：资源若不是有限值（旧档被炸坏 / Infinity 落盘），直接夹回 1e308 ✓
  //   （break_eternity 能表示 1e308 以上的有限值；夹到 1e308 是"接近上限但不越界"的恢复值 ✓）
  {
    const LIMIT = new Decimal("1e308");
    const clampField = (obj, key) => {
      const v = obj?.[key];
      if (v == null) return false;
      let d;
      try { d = v instanceof Decimal ? v : new Decimal(v); } catch { return false; }
      if (d.isFinite() && !d.isNaN?.()) return false;
      obj[key] = LIMIT;
      return true;
    };
    const repaired = [];
    if (clampField(s, "darkEnergy")) repaired.push("darkEnergy");
    if (clampField(s, "zpe")) repaired.push("zpe");
    if (clampField(s, "infinityPoints")) repaired.push("infinityPoints");
    if (clampField(s, "eternityPoints")) repaired.push("eternityPoints");
    if (clampField(s, "quantum")) repaired.push("quantum");
    if (clampField(s, "matter")) repaired.push("matter");
    if (clampField(s, "entropy")) repaired.push("entropy");
    if (clampField(s, "particles")) repaired.push("particles");
    if (repaired.length) {
      console.warn("[读档自愈] 以下字段原本是非有限值，已夹回 1e308：", repaired.join(", "));
    }
  }

  // ★★★ 2026-10-22 修（用户：「**刷新网页后七巧板系统进度丢失**」）——
  //   根因：`deserialize` 是**逐字段显式还原**（55 个 ✓），而七巧板那 6 个字段**一个都没写** ✗
  //   ⇒ 刷新后它们回落到 `newState()` 的空默认值 ⇒ 进度全丢 ✗
  //   （这是"模块化拆分时漏字段"的典型事故：serialize 是全量 ✓，deserialize 是白名单 ✗）
  s.tangramOwned = raw.tangramOwned && typeof raw.tangramOwned === "object"
    ? Object.fromEntries(Object.entries(raw.tangramOwned).filter(([, v]) => v === true))
    : {};
  s.tangramPity = raw.tangramPity && typeof raw.tangramPity === "object"
    ? Object.fromEntries(Object.entries(raw.tangramPity).map(([k, v]) => [k, num(v, 0)]))
    : {};
  s.tangramPlaced = raw.tangramPlaced && typeof raw.tangramPlaced === "object"
    ? Object.fromEntries(Object.entries(raw.tangramPlaced)
      .filter(([, v]) => v && typeof v === "object")
      .map(([id, v]) => [id, { ...v }]))
    : {};
  /**
   * ★ 2026-10-23（用户：「原点不应该在左中么」）——
   *   坐标系从「无 y 翻转（原点屏幕左上）」改成「y 翻转（原点屏幕左中）」。
   *   旧档的 dx/dy/rot/flip 是按旧屏幕坐标存的；直接渲染会整块跑到面板上方（截图事故）。
   *   ⇒ 保持**屏幕位置和朝向不变**：
   *       dy' = 4 - dy
   *       rot' = (rot + 2) % 4    （y 反射 = x 反射 + 180°）
   *       flip' = !flip
   *   只在旧档（没有 `tangramCoordVersion` 或 < 2）执行一次；新档不动 ✓
   */
  const coordVersion = num(raw.tangramCoordVersion, 1);
  if (coordVersion < 2) {
    for (const cfg of Object.values(s.tangramPlaced)) {
      cfg.dx = num(cfg.dx, 0);
      cfg.dy = 4 - num(cfg.dy, 0);
      cfg.rot = ((Math.floor(num(cfg.rot, 0)) + 2) % 4 + 4) % 4;
      cfg.flip = !bool(cfg.flip);
    }
  }
  s.tangramCoordVersion = 2;
  s.tangramCleared = Array.isArray(raw.tangramCleared)
    ? [0, 0, 0, 0, 0, 0].map((_, i) => num(raw.tangramCleared[i], 0))
    : [0, 0, 0, 0, 0, 0];
  s.tangramChallenge = raw.tangramChallenge && typeof raw.tangramChallenge === "object"
    ? { solved: num(raw.tangramChallenge.solved, 0) }
    : { solved: 0 };
  s.tangramChallengeThisEternity = num(raw.tangramChallengeThisEternity, 0);
  s.tangramSeed = raw.tangramSeed == null ? null : num(raw.tangramSeed, 0);

  s.space = restoreSpace(raw.space, dec, num);
  return { state: s, ok: true };
}
/**
 * ★ 2026-10-25：空间膨胀状态白名单（从 deserialize 拆出，控制函数预算）。
 * @param {object|undefined} raw 存档里的 raw.space
 * @param {(v:any)=>any} dec Decimal 解码
 * @param {(v:any,d:number)=>number} num 数字解码
 */
function restoreSpace(raw, dec, num) {
  const sp = raw && typeof raw === "object" ? raw : {};
  const upgrades = {};
  if (sp.upgrades && typeof sp.upgrades === "object") {
    for (const [id, v] of Object.entries(sp.upgrades)) {
      if (v === true) upgrades[id] = true;
      else {
        const n = num(v, 0);
        if (n > 0) upgrades[id] = n;
      }
    }
  }
  return {
    se: dec(sp.se),
    st: dec(sp.st),
    challenge: sp.challenge === true,
    ipPeak: dec(sp.ipPeak),
    bestIp: dec(sp.bestIp),
    bestEp: dec(sp.bestEp),
    challengeSe: dec(sp.challengeSe),
    challengeSeBase: dec(sp.challengeSeBase),
    upgrades,
  };
}

