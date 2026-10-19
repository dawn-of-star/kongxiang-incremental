/**
 * state/schema.js —— 新状态骨架 newState（字段与默认值）
 *
 * ★ 2026 模块化：由 673 行的 state.js 按职责拆出（声明与注释逐字保留）。
 *    对外统一从 `src/state.js`（barrel）导入。
 */
import { BASE, DE_MILESTONES, DE_UPGRADES, QUANTUM_MILESTONES, REPEATABLE, VOID_UPGRADES, ZPE_MILESTONES } from "../config.js";
import { D } from "./helpers.js";

export function newState() {
  return {
    version: BASE.saveVersion,
    startedAt: Date.now(),
    lastSavedAt: Date.now(),
    playTimeMs: 0,

    // ── 资源 ──
    resources: {
      entropy: D(0),
      particle: D(0),
      matter: D(0),
      traps: D(0) },

    // ★ 补回：stats 块原本是单行、且含 coinage 字段 ⇒ 删铸币时整行被删掉 ✗
    //   字段清单以**反序列化**处为准（clicks / totalEntropy ✓）
    stats: { clicks: 0, totalEntropy: D(0) },

    // ── 可重复升级的等级（价格从 config 推导，不存） ──
    levels: {
      particleBoost: D(0),
      matterBoost: D(0),
      entropyCoeff: D(0) },

    // ── 一次性购买标记 ──
    voidUpgrades: Object.fromEntries(Object.keys(VOID_UPGRADES).map((k) => [k, false])),
    // ★★ 2025：「曾经解锁过的页面」—— **永不重置**（见字段说明；用户裁定第一次永恒后保持解锁）
    pageUnlocked: {},

    // ── 里程碑 ──
    zpeMilestones: Object.fromEntries(ZPE_MILESTONES.map((m) => [m.id, false])),
    /**
     * ★ 量子里程碑（2025 草案）：键在**累计量子对数**上（大坍缩不清零），
     * **永恒会清除**（用户指定：与"除梦想系统外一切重置"一致）。
     * 见 docs/QUANTUM-MILESTONES.md。
     */
    quantumMilestones: Object.fromEntries(QUANTUM_MILESTONES.map((m) => [m.id, false])),
    deMilestones: Object.fromEntries(DE_MILESTONES.map((m) => [m.id, false])),

    // ── ZPE ──
    zpe: D(0),
    zpeTotal: D(0),
    /** dm1 给的一次性快照倍率 */
    zpeFixedMultiplier: null,

    // ── 暗能量 ──
    darkEnergy: D(0),
    darkEnergyTotal: D(0),
    /** ZPE 累积器，满 darkEnergyThreshold 换一次 */
    zpeAccumulator: D(0),
    phaseTransmuterUnlocked: false,
    deUpgradeLevels: Object.fromEntries(
      Object.keys(DE_UPGRADES).map((k) => [k, D(0)]),
    ),
    /** 每个暗能量升级的首次购买是否已发过梦想点 */
    deFirstPurchase: Object.fromEntries(
      Object.keys(DE_UPGRADES).map((k) => [k, false]),
    ),

    // ── 三合一：每种可重复升级的首次购买奖励 ──
    firstPurchase: Object.fromEntries(
      Object.keys(REPEATABLE).map((k) => [k, false]),
    ),

    // ── 第四层：大坍缩 ──
    // ★ `darkMatter` / `collapseCount` / `collapseThreshold` 已删除 ——
    //   「临界坍缩 + 暗物质」整个体系被移除（见 engine.js 的说明）。
    // ★ 补回：量子相关字段（删铸币时同一行被连带删掉 ✗）
    quantum: D(0),
    quantumPairs: D(0),
    peakQuantumRun: D(0),
    totalQuantumPairs: D(0),
    // ★ 批量补回（删铸币的连带损伤 ✓ 按反序列化清单推定类型 ✓）
    // ⚠️ 2025：`accelLevel` 已随「坍缩加速器」整个删除 ⇒ 不再有这个字段。
    //    老存档里若还有它，反序列化时会被忽略（不报错 ✓）
    dreamAwarded: {},
    dreamUpgrades: {},
    /**
     * ★★★ 2025：**可重复梦想升级的等级**（首个 = 「离线时长扩展」= 离线时间上限）。
     *
     * 为什么单独一个字段（而不是把 `dreamUpgrades` 改成数字）：
     *   `dreamUpgrades` 的布尔语义**已存档**（旧档只有 `true/false`）⇒
     *   改成数字会破坏旧档反序列化 ✗
     *   ⇒ 布尔保留（"买过没有"）+ 这个新字段记等级（"买到几级"）✓
     *     两者由 `dreamUpgradeLevelOf()` 统一读取（旧档布尔 ⇒ 视为 1 级）✓
     */
    dreamUpgradeLevels: {},
    eternityCount: D(0),
    eternityPoints: D(0),
    /**
     * ★★ 2025：**累计获得**的永恒点（只增不减）—— em5 的读数源。
     *
     * 为什么不用 `eternityPoints`（当前持有）：永恒升级会**花掉** EP ⇒
     * `log10(EP)` 随之掉下来、甚至归零（`log10(0) = -Infinity`）⇒
     * em5 的加成会**随消费反复丢失**，里程碑等于白拿 ✗
     * 与 AD 的手法一致（累计量做加成的键：`totalAMMult` vs `currentAMMult`）。
     */
    eternityPointsTotal: D(0),
    /**
     * ★★★ 2025（第三层设计稿 33~35 行）：**永恒升级「永恒增幅」的等级**。
     *
     * 效果 = 最终获得的永恒点 ×5/级（`epMultFactor(state)`，唯一入口见 config.js）。
     * ⚠️ 它**不随永恒重置**（永恒升级本来就是跨永恒的进度）——
     *    所以 `doEternity` / `resetForEternity` 里**不要**清它 ✓
     */
    epMultLevel: D(0),
    /**
     * ★★★ 2026（第三层设计稿第 50~52 行）：**暗物质个数**（「永恒之后」的第一块）。
     *
     * ⚠️⚠️ **字段名刻意叫 `eternityDarkMatter`，不叫 `darkMatter`** —— 这是一个
     *   **真实的撞车**（本文件 :472 就是证据）：
     *   `darkMatter` 这个名字**属于已经删除的「临界坍缩 → 暗物质」体系**
     *   （用户当年裁定「暗物质不应存在」，整套删除），而 `deserialize` 至今
     *   **明文忽略**旧档里的 `raw.darkMatter` ✓
     *   ⇒ 若复用同名：**任何删除前的老存档，其残留的 `darkMatter` 值
     *      （可能几十）会被当成新机制的暗物质个数** ⇒ 白送一堆 ✗✗
     *   ⇒ 换一个不可能撞车的名字；旧档的那个键**继续被忽略**（行为不变）✓
     *
     * 用**普通 Number**（不是 Decimal）——理由：
     *   ① 它是**计数**（买第几个），语义与 `epMultLevel` 同级，不是货币量级；
     *   ② 唯一用途是 `log10(1+n)`，而 `Decimal.toNumber()` 在巨量时会变 `Infinity`
     *      ⇒ 用 Number 把这类越界风险**从根上消掉** ✓
     *
     * ⚠️ 它**不随永恒重置**（用户 2026 裁定）：它是用 **EP** 买来的**跨永恒资产**，
     *    与 `epMultLevel` / 永恒里程碑同类；否则"第 4 次永恒解锁、第 5 次被清掉"
     *    等于惩罚玩家 ✗ ⇒ `doEternity` 里**不要**清它 ✓
     *    （这是"永恒重置除梦想系统外一切"这条铁律的**第二处明确例外** ——
     *      第一处是 `epMultLevel`；两处都是用户逐次裁定出来的 ✓）
     */
    eternityDarkMatter: D(0),
    /**
     * ★★★ 2026：**第一台相变仪速率的快照**（存 `log10(速率)`，普通 Number）。
     *
     * 为什么要快照：暗物质的转化值要乘进 `darkEnergyMultiplier` 的加法区，
     *   而它需要 `v2 = v1^0.01`，其中 `v1 = darkEnergyRate()`。
     *   ⚠️ 现算会成**循环调用**：
     *     `darkEnergyRate → effectiveDarkEnergyGain → darkEnergyGainPerConversion`
     *     `→ (买了 dm5) → darkEnergyMultiplier → v2 → darkEnergyRate` ✗
     *   ⇒ 每帧由 `tick` 在算完暗能量之后写一次，`darkEnergyMultiplier` 只读它 ✓
     *   （项目里 `zpeFixedMultiplier` 是同一个「快照」手法的先例）
     *
     * ⚠️ 刻意存 **log10**（不是原值）：`Decimal.toNumber()` 在巨量时是 `Infinity` ✗，
     *   而 `v1^0.01 = 10^(0.01·log10 v1)` **只需要 log10** ⇒ 既省又不会溢出 ✓
     */
    v1Log10: D(0),
    /**
     * ★★★ 2025（`docs/NEKO.md` §7 / §10）：**好感度系统**（游戏原生，零依赖 SDK）。
     *
     * · `nekoAffinity`：当前好感度。规格 = 初始 **0**、范围 **[-100, 100]**、
     *   档位判定看"是否 **> 25 / > 50 / > 75**"（三档叠乘 ⇒ 全局 ^最高 1.0221151）
     * · `nekoDriftStamps`：**窗口预算**用的时间戳数组 `[[ms, delta], …]`
     *   —— 保证"每 5 分钟波动 < 8 点"（接入 SDK 后 < 16）✓
     * ⚠️ 这两个字段**不随任何重置清空**（好感度是跨轮次的长期进度）——
     *   所以 `doBigCrunch` / `doEternity` 里**不要**清它 ✓
     */
    nekoAffinity: 0,
    nekoDriftStamps: [],
    infinityElapsed: 0,
  // ★ 2025: 本轮时长（秒）—— 收手判据按时间；每次大坍缩归零（见 engine.js）
  runElapsed: 0,
    // ⚠️ 2026 **已删除**：`fastestInfinitySec`（最快一次无限的耗时）与
    //   `icAutoTimer`（自动完成无限挑战的累计计时）——
    //   它们**只服务于 em7「自动完成无限挑战」**，而 **IC 整个系统已被用户删除** ✗
    //   em7 本身退回 `pending`（见 `config.js` 的 `ETERNITY_MILESTONES`）⇒ 暂无读取方 ✓
    //   ⚠️ 将来重做 em7 时**不要照着旧字段复活** —— 那时需要的时间源要重新设计
    //      （旧实现的口径是"历次本轮时长的最小值"，依赖 IC 关卡数）✓
    infinityFromQuantumBought: false,
    ipTimeAccrued: D(0),   // ★ 数值约定 #3：IP 累加量会超过 1.8e308 ⇒ Decimal ✓
    ipTimeBought: false,
    ipToTransmuterBought: false,
    ipToZpeBought: false,
    pairBoostBought: false,
    quantumPairsTotal: D(0),
    speedBought: {},
    startBought: {},
    thresholdFlatBought: false,
    v9: false,
    zpeEngineLevel: D(0),
    zpeEngineUnlocked: false,
    // ★ 从代码扫描补回（删铸币连带损伤 ✓）
    deAccum: D(0),
    /** 无限点（大坍缩给） */
    infinityPoints: D(0),
    /** ★ 补回：删铸币时被连带删掉的梦想点字段 ✗（globalMultiplier 依赖它 ✓） */
    dreamPoints: D(0),
    // ★★★ 2026：七巧板（几何=kernel `src/tangram.js`；游戏侧=`src/tangram-game.js`）✓
    // ★★★ 2026：自动无限（默认**开**；买下即生效）✓
    /** ★ 2026：自动化总开关（**只存 true** ⇒ 缺省 = 关 = 手动开）✓ */
    autoToggles: {},
    autoCrunch: { isActive: false, mode: "xHighest", amount: "1", time: 0.1, xHighest: "2", dynamic: false, lastAtMs: 0 },
    /** 本永恒**单次**收益最高纪录（× 最高模式的判据）✓ */
    maxIpThisEternity: D(0),   // ★ 本永恒 IP 峰值（AD 的 records.thisEternity.maxIP）⇒ Decimal ✓
    tangramOwned: {},          // 已获得（id → true）
    tangramPity: {},           // 抽取保底（id → 连续失败次数）
    tangramPlaced: {},         // 摆位（id → {rot, flip, dx, dy}；小数 = 自由拖动）
    tangramCleared: [0, 0, 0, 0, 0, 0],   // 拼装挑战：每档已清数（奖励唯一输入）
    tangramChallenge: { solved: 0 },      // 挑战进度
    /** 已大坍缩次数 */
    bigCrunchCount: D(0),
    /**
     * 是否已「打破无限」。
     * false = 物质硬顶在 1e308.25，到顶强制大坍缩，收益固定
     * true  = 上限解除，手动大坍缩，收益随深度增长
     */
    brokenInfinity: false,
    /**
     * ★ 跨度层基准（`D(0)` = 尚未开启）。
     *
     * 买下「门槛压平」时记下**当时的暗能量水位**，跨度乘数取
     * `(DE / spanDeBase)^k` —— 好处：
     *   · 购买瞬间乘数恰好 = 1（连续、无跳变）
     *   · 早期根本买不到该升级 ⇒ 乘数恒 1 ⇒ **不伤前期**
     *   · 基准由玩家的购买时刻确定，**不需要我发明一个魔法常数**
     * 见 docs/R-REPLACEMENT.md §11。
     */
    spanDeBase: D(0),
    /** 历史最高物质（用于显示和里程碑判定） */
    peakMatter: D(0),

    // ── ∞ 层：无限升级（用无限点买，不随大坍缩重置）──
    /** ① 无限增幅：无限点收益 ×2 的等级 */
    ipDoubleLevel: D(0),
    // ⚠️ 2026 **已删除** `ic: { active, completed }` —— 无限挑战（IC）整个系统被用户删除
    //   （原话：「我发现无限挑战做不做都不影响我永恒了」）。
    //   ⚠️ 老存档里仍有这两个字段 ⇒ `deserialize` 会**明文忽略**它们（不做迁移、不报错）✓
    /**
     * ★ 无限铸币等级（**设计未冻结：用户保留最终修改权**）。
     *    这是"24 小时档"的节流阀 —— 只卡铸币上限而其它 IP 循环不设限是无效的（模型实测）。
     */
    /** 日志缓冲，最近 N 条 */
    log: [] };
}

// ══════════════════════════════════════════════════════════
// 梦想点：成就系统
// ══════════════════════════════════════════════════════════

/**
 * 发一个「非重复加成」的梦想点。
 *
 * @param {object} state
 * @param {string} key   加成的唯一标识（如 "void:v1" / "zpeMs:m3" / "collapse:0"）
 * @param {string} label 显示用的名字
 * @returns {boolean}    是否是新成就（true = 发到了梦想点）
 */
