/**
 * engine/eternity.js —— 永恒：保留规则与 doEternity
 *
 * ★ 2026 模块化：由 1,660 行的 engine.js 按动作领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/engine.js`（barrel）导入。
 */
import { resetForCollapse } from "./collapse.js";
import { INFINITY_ORDER, INFINITY_UPGRADES, PAGE_KEYS, canEternity, epMultFactor, eternityPointGain, hasEternityMilestone, infinityUpgradeCost, markPageUnlocked } from "../config.js";
import { applyEternityKeeps } from "../dream-effects.js";
import { sci } from "../format.js";
import { D } from "../formulas.js";
import { pushLog } from "../state.js";

export function applyEternityRetention(state) {
  const count = Math.floor((state.eternityCount ?? 0) / 2);
  if (count <= 0) return [];
  const singles = INFINITY_ORDER.filter((id) => !INFINITY_UPGRADES[id]?.repeatable);
  // ★★★ 2026 修 bug（用户：「em1 的里程碑生效方向不对啊，为什么从**贵的量子的**无限升级获取
  //   而不是**便宜的 iu**？」＋「应该是**从便宜的 iu 保存到贵的 iu**」）：
  //   旧写法 `singles.slice(-count)` 假设 `INFINITY_ORDER` 从便宜到贵 —— **那是假的** ✗
  //   （它是 UI 格子顺序：`ipFromQuantum` 排第一、量子系排最后）
  //   ⇒ 实测旧行为：永恒 6 次保留 `rate167(10000) / rate139(1000) / start200(300)` ✗
  //   ⇒ 现在按**真实价格升序**取最便宜的 N 个 ✓（价格走唯一入口 `infinityUpgradeCost`）
  const priced = singles
    .map((id, idx) => ({ id, idx, cost: Number(infinityUpgradeCost(state, id) ?? Infinity) }))
    .sort((a, b) => (a.cost - b.cost) || (a.idx - b.idx));
  const kept = [];
  // ⚠️ 每次**全新分配**这两个容器：调用点（`doEternity`）刚把 `startBought`/`speedBought` 清成 `{}`，
  //    所以这里不需要判重；直接写即可（幂等：重复调用的结果相同 ✓）
  state.startBought = state.startBought ?? {};
  state.speedBought = state.speedBought ?? {};
  for (const { id } of priced.slice(0, count)) {
    // 各条一次性升级的**真实标记字段** —— 口径与 `infinityUpgradeOwned()`（config.js）逐条对应，
    // 改这里必须同步改那里（两处不一致 = "买了却没生效"类 bug 的经典成因 ✗）
    if (id === "thresholdFlat") state.thresholdFlatBought = true;
    else if (id === "pairBoost") state.pairBoostBought = true;
    else if (id === "ipFromQuantum") state.infinityFromQuantumBought = true;
    else if (id === "ipToZpe") state.ipToZpeBought = true;
    else if (id === "ipToTransmuter") state.ipToTransmuterBought = true;
    else if (id === "ipTime") state.ipTimeBought = true;
    else if (id.startsWith("start")) state.startBought[id] = true;
    else if (id.startsWith("rate")) state.speedBought[id] = true;
    else continue;                                     // 未知 id：不静默算作保留
    kept.push(id);
  }
  return kept;
}

/**
 * 永恒一次（**手动**，项目里刻意没有"到门槛自动触发"）。
 *
 * AD 同源：永恒点 = `floor(5^(log10(IP)/308 − 0.7))`，并重置 ∞ 层及其以下的一切。
 *
 * 重置 / 保留（与 `#panel-eternity` 的可视清单**逐条对应**：改一处必须改两处）：
 *   · 归零：物质 / 粒子 / 熵 / 熵阱 · 三条主升级 · ZPE / 暗能量 / 量子 ·
 *          无限点 · 全部 ∞ 升级（含铸币、加速器）· 大坍缩次数（档位归零）· ZPE 引擎
 *   · 保留：**梦想系统（梦想点 / 梦想升级 / 成就账本）** · 永恒点与永恒次数 · 日志与统计
 *
 * ⚠️ **奖励目前是占位**（暗物质要换新机制），所以第二次永恒**不会更快** ——
 *    这是占位期的已知代价，等奖励定下来再平衡（见 `docs/IP-ECONOMY.md`）。
 */
export function doEternity(state) {
  if (!canEternity(state)) return null;

  // ★★★ 2026 修 bug（用户：「梦想（自动化）页面的自动化升级都不正常工作」）
  //   `keepDeEternity` / `keepVoidEternity` / `engineAtStart` 三条"永恒保留"型升级
  //   **效果侧从来没接上**：`dream-effects.js` 的 `applyEternityKeeps()` 写好了、
  //   也 import 了，但**一次都没被调用** ✗ ⇒ 买了等于没买。
  //   ⇒ 现在：① 先拍**快照**（必须在重置**之前**）② 重置完后写回 ✓
  const eternityKeepSnapshot = {
    darkEnergy: state.darkEnergy,
    voidUpgrades: { ...(state.voidUpgrades ?? {}) },
    zpeMilestones: { ...(state.zpeMilestones ?? {}) },
  };

  const gained = eternityPointGain(state.infinityPoints).mul(epMultFactor(state));
  const ipBefore = state.infinityPoints;
  state.eternityPoints = (state.eternityPoints ?? D(0)).add(gained);
  // ★★ 2025：**累计 EP** —— em5 的读数源（只增不减；见 state.js 的字段说明）
  state.eternityPointsTotal = (state.eternityPointsTotal ?? D(0)).add(gained);
  // ★ 数值约定 #3：ternityCount 现在是 Decimal ⇒ 必须用 .add()（+ 会变字符串拼接 ✗）
  state.eternityCount = D(state.eternityCount ?? 0).add(1);

  // ══════════════════════════════════════════════════════════
  // ★★★ 2025（用户实测报告 + 用户裁定）：**永恒后补齐「曾经解锁过」的记录**
  // ══════════════════════════════════════════════════════════
  // 用户原话：「永恒次数若 > 1 则解锁永恒前所有页面」
  //   但用户后来给了截图，证明真正的语义是「**永恒之前解锁过的所有页面**」
  //   —— 那必然包含"永恒"这一页本身 ⇒ 判据是"**至少永恒过一次**"即 `count > 0` ✓
  //
  // 病根（用户截图：无限/永恒两页显示"待推进"）：
  //   `markPageUnlocked` 只在**解锁那一刻**打点，而这些页面是"本轮的实时条件"
  //   （无限页判 `brokenInfinity`、量子页判 `peakMatter ≥ 1e25`、永恒页判 `eternityCount > 0`）
  //   ⇒ 永恒把 IP / 大坍缩 / peakMatter 全清零 ⇒ `live` 变假
  //   ⇒ 若 `pageUnlocked` 记录是空的（旧档，或那一刻没打点成功）
  //     ⇒ `perma` 也是假 ⇒ 页面**退回"待推进"** ✗
  //
  // ⇒ 修法：**永恒成功这一刻**，把全部 `PAGE_KEYS` 打点（能走到永恒 = 这些页面必然都解锁过）
  //   ✓ 自愈：用户当前那个"记录为空"的档，**再永恒一次就自动补上**
  //   ✓ 且此后存档里就有记录了 ⇒ 刷新 / 后续永恒都不会再退回 ✓
  //   ⚠️ 放在 `eternityCount + 1` **之后**（打点与计数同源，不会漏掉第一次）
  for (const k of PAGE_KEYS) markPageUnlocked(state, k);

  // ── ∞ 层归零 ──
  state.infinityPoints = D(0);
  state.ipDoubleLevel = D(0);
  state.ipToZpeBought = false;
  state.ipToTransmuterBought = false;
  state.ipTimeBought = false;
  state.infinityFromQuantumBought = false;
  state.thresholdFlatBought = false;
  state.pairBoostBought = false;
  state.startBought = {};
  state.speedBought = {};
  state.brokenInfinity = false;
  // ★★★ 2026（用户：「em7 追加：初始获得一次无限次数，打破无限默认解锁」）——
  //   em7 达成后，每次永恒**保留 1 次无限 + 默认已打破无限** ✓
  if (hasEternityMilestone(state, "em7")) {
    state.infinityCount = Math.max(1, Math.floor(Number(state.infinityCount ?? 0)) + 1);
    state.brokenInfinity = true;
  }
  state.ipTimeAccrued = D(0);
  state.infinityElapsed = 0;
  // 档位 / 量子（铸币与坍缩加速器已删除）
  state.bigCrunchCount = D(0);
  state.peakQuantumRun = D(0);
  state.quantum = D(0);
  state.quantumPairs = D(0);
  // ZPE 引擎（它在 ∞ 层之下）
  state.zpeEngineUnlocked = false;
  state.zpeEngineLevel = D(0);
  // ⚠️ 2026：这里原来有一行 ad-hoc 的「开局引擎」实现（zpeEngineLevel = D(1)）——
  //   已**删除**，统一由下面 applyEternityKeeps() 负责（两处实现必然分叉）✗

  // ── 虚拟系统整体归零（★ 用户明确：**除梦想系统外，一切重置**）──
  //   虚空升级（v1~v9）、ZPE 里程碑、暗能量里程碑、暗能量升级等级、相变仪解锁：
  //   全部属于"进度"，永恒一律归零。**只留梦想系统**（梦想点 / 梦想升级 / 成就账本）。
  for (const k of Object.keys(state.voidUpgrades ?? {})) state.voidUpgrades[k] = false;
  for (const k of Object.keys(state.zpeMilestones ?? {})) state.zpeMilestones[k] = false;
  for (const k of Object.keys(state.deMilestones ?? {})) state.deMilestones[k] = false;
  // ★★★ 2026 修 bug（用户：「梦想烬灭虚无每次永恒都会被重置，每次都要重新消耗梦想点」）——
  //   它是 **暗能量升级**（DE_UPGRADES.dreamAnnihilation），但**用梦想点购买** ✗
  //   而梦想点/梦想升级**永不重置** ⇒ 它必须一起保留 ✓（否则等于重复收费 ✗）
  //   ⇒ 重置时**跳过**它（其余暗能量升级照常归零 ✓）
  for (const k of Object.keys(state.deUpgradeLevels ?? {})) {
    if (k === "dreamAnnihilation") continue;   // ★ 梦想点买的，跨永恒保留 ✓
    state.deUpgradeLevels[k] = D(0);
  }
  state.phaseTransmuterUnlocked = false;
  // （自动化不是独立字段：`isAutoAcquire()` 由 v9 / ZPE 里程碑推导 ⇒ 上面清掉它们就自动失效）

  // ── 无限层以下的资源与升级：复用大坍缩的重置 ──
  resetForCollapse(state);
  state.deAccum = D(0);
  state.zpeAccumulator = D(0);
  state.peakMatter = D(0);

  // ★★★ 2026 修 bug：「永恒保留」三条（keepDeEternity / keepVoidEternity / engineAtStart）
  //   **效果侧从来没接上** —— applyEternityKeeps() 写好了、也 import 了，但一次都没被调用 ✗
  //   ⇒ 在**所有重置做完之后**写回快照（快照在函数开头、重置之前拍的）✓
  //   ⚠️ 位置要求：必须在 `resetForCollapse` / `peakMatter` 归零 / 虚空清零**之后** ✓
  const keptByDream = applyEternityKeeps(state, eternityKeepSnapshot);
  if (keptByDream.length) pushLog(state, `💭 梦想升级：永恒后保留 ${keptByDream.join("、")}`);

  // ★★ 2025 em1：**在各层都清空之后**，按里程碑把"保留的 ∞ 升级"补回来。
  //   ⚠️ 必须放在 `resetForCollapse` **之后** —— 它内部会读 `startBought` 抬高开局物质
  //      （`infinityStartLog10`）。若先补回，这一轮会白送一次 1e150 级起点 ✗
  const retained = hasEternityMilestone(state, "em1") ? applyEternityRetention(state) : [];
  if (retained.length) {
    pushLog(state, `⏳ em1：保留 ${retained.length} 个非重复 ∞ 升级（${retained.map((id) => INFINITY_UPGRADES[id]?.name ?? id).join("、")}）`);
  }

  pushLog(state, `⏳ 永恒第 ${state.eternityCount} 次：无限点 ${sci(ipBefore)} → ` +
    `获得 ${gained.toString()} 永恒点（共 ${state.eternityPoints.toString()}）`);
  pushLog(state, "⏳ 已重置除梦想系统外的一切（虚空 / 里程碑 / ∞ 层及以下）；永恒点保留");
  return { eternityPoints: gained, count: state.eternityCount };
}

// ★★ 2025：**坍缩加速器已整个删除**（用户裁定 —— "否则会对机制解读有极大污染"）
//   原落点在这里：`accelAffordable()` / `buyAccel()` 两个导出函数。
//   它属于"IP → 成长速率"的平行环，且与「速率解放」「档位 rate 里程碑」共用
//   `infinityRateMult` 入口 ⇒ 界面上分不清谁在起作用。详见 config.js 的说明。

// ══════════════════════════════════════════════════════════
// ★ 无限铸币（**设计未冻结：用户保留最终修改权**）
// ══════════════════════════════════════════════════════════

/** 铸币还能买几级（**闸门优先**：档位放行 ∩ 买得起） */



// ══════════════════════════════════════════════════════════
// ★ ZPE 引擎（打破无限后 · 虚空系统子页）
// ══════════════════════════════════════════════════════════

/**
 * 解锁 ZPE 引擎。
 *
 * ★ 2025 用户决定：**解锁节点提前** —— 条件从「10 无限点」改为「**1 次大坍缩**」，
 *   并且**送 1 级等级**（当作第一次无限的里程碑奖励）。
 *
 * 为什么：`a(DE)`（暗能量指数增长）是挂在引擎上的 ⇒ 引擎越早到手，
 *   DE 的自增长就越早开始（实测从 7.73h 提前到 2.05h，省 5.7 小时）✓
 *
 * ★ 同时记录**跨度基准 `spanDeBase`**：引擎到手这一刻的 DE 水位。
 *   跨度乘数 = `(DE / 此刻的 DE)^k`，所以"引擎到手 → 买到门槛压平"期间的 DE 增长
 *   会被**完整**换算成跨度 ✓（开关仍是「门槛压平」，两者必须分开，见 config 注释）
 */

