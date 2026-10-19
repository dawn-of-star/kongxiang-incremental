/**
 * config/quantum/growth.js —— 粒子增幅 b / 跨度幂 k / 量子共振 / 暗能量自增长 / 档位加速
 *
 * ★ 2026 模块化：由 740 行的 config/quantum.js 拆出（声明与注释逐字保留）。
 *    对外统一从 `src/config.js`（barrel）导入。
 */
import { COLLAPSE } from "../base.js";
import { effectiveDarkEnergyLog10 } from "../dark-energy.js";
import { ENGINE_MECH, effectiveEngineLevel } from "../zpe-engine.js";
import Decimal from "../../../dist/break_eternity.esm.js";

export const CLIMB = {
  /** 拐点（阶）：从这一阶开始衰减。直接取量子层解锁点（1e25 → 25），单一数据源 */
  knee: Math.log10(Number(COLLAPSE.unlockMatter)),
  /** 每多少阶速率减半 */
  halvingOrders: 100 };

/**
 * 量子 → **指数成长速率**（单位：数量级/秒）。
 *
 * ══════════════════════════════════════════════════════════
 * 为什么需要这个（结构性问题，不是调参问题）
 * ══════════════════════════════════════════════════════════
 *   基础成长是 `M'' ∝ log(M)`（因为熵阱数量 ∝ log(物质)），
 *   于是 `M` 随时间**多项式**增长，`d(log10 M)/dt` 持续衰减。
 *
 *   乘进任何倍率 `C` 只能把系数放大：
 *       `log10(M) ∝ 2·log10(t) + 常数(C)`
 *   —— **只加一个常数，改不了曲线的形式。**
 *   实测：`perPair=200`（量子 2400 个，倍率 ×2401）也走不到 1e308。
 *
 *   要「1e25 → 1e308.25 平滑 1~2 小时」，成长必须是**指数**的：
 *       `d(log10 M)/dt = R`   （R 为常数）
 *
 * ── 形态 ──
 *   `R(q) = Rmax × q / (q + half)`
 *     · q=0    -> 0
 *     · q=half -> Rmax/2
 *     · q→∞    -> Rmax（平滑趋近，永不超出）
 *
 *   283 个数量级 ÷ Rmax：
 *     Rmax = 0.05 -> 5660 秒 = 1.57 小时   ← 落在「>1h 且 <2h」的目标区间
 *     Rmax = 0.08 -> 3538 秒 = 0.98 小时
 *     Rmax = 0.04 -> 7075 秒 = 1.97 小时
 *
 *   `half` 决定「量子要多少才推得动」：half 越小越慷慨（用户说升级区可以慷慨）。
 */
/**
 * @param {Decimal|number} quantum
 * @param {Decimal|number} [rateMult=1] ∞ 层「速率解放」对**上限**的倍率
 *        （用倍率而不是绝对值，这样最终 R₀ 定成多少都不必重算升级数值）
 */
// ★★ 2025：`quantumGrowthRate()` **已彻底删除**（用户决定取消 R 机制）。
//   物质不再有 `M·R·ln10` 这一项；承重机制改为
//     · 引擎之前：粒子获得的时变增幅 `particleTimeBoost()`（`b` 由量子 √q 与里程碑给）
//     · 引擎之后：暗能量自增长 `deGrowthRate()` → 跨度层 `matterSpanMult()`
//   原先"改成长速率"的三个旋钮（∞速率解放 / 坍缩加速器 / 档位 rate 项）改挂 `b`
//   —— 它们的唯一汇总入口仍是 `infinityRateMult()` ✓
//   实测（删 R 后真实引擎）：物质**仍能撞到 1e308**，第一次大坍缩 10.52h（目标 13.39h）✓

/**
 * 下一对量子的 ZPE 门槛：`1e10 × (10 × 2)^已捕获对数 = 1e10 × 20^n`。
 *
 * ── 递进结构 ──
 *   · `zpeCostGrowth = 10`：每次捕获门槛 ×10
 *   · `zpeCostExtraNerf = 2`：**再 ×2**（用户新增的削弱）→ 合起来每次 ×20
 *
 * 为什么必须是**几何递进**（固定倍率 > 1）：
 *   它把量子数锁在 `log(ZPE)` 上。若改成线性，量子数会变成 `ZPE / 1e10` 级别
 *   （ZPE=1e100 时 1e90 个量子），`×(1+q)` 直接爆炸。
 *
 * 削弱对比（ZPE = 1e100 时）：
 *   ×10  递进 -> 90 对 -> 180 量子
 *   ×20  递进 -> 64 对 -> 128 量子   ← 现在
 *   ×100 递进 -> 32 对 ->  64 量子
 */
/** 量子门槛的**总倍率**（单一数据源：档位里程碑的"量子润滑" × 门槛压平 × 量子里程碑 qm5） */
export const DE_SPAN = {
  /**
   * ★★★ 2026（用户裁定）：「跨度层」**改名为「量子共振」**（机制/数值完全不变）——
   *   · 玩家可见的标题、标签、说明、日志全部改用「量子共振」✓
   *   · **内部标识符仍是 `span*`**（`DE_SPAN` / `matterSpanMult` / `state.spanDeBase` …）：
   *     其中 `state.spanDeBase` 是**存档字段**，改名要写迁移且零收益 ⇒ 保留，
   *     并在注释里写明对应关系 ✓
   *   ⚠️ 看到 `span` 就是「量子共振」——不要再往回改 ✓
   */
  /** 标定系数：q = 100 时 k 恰好 = kMax */
  kCoeff: 0.516509,
  /** 封顶 = log10(物质硬顶) / log10(暗能量软上限) = 308.2547 / 50 */
  kMax: 6.1651,
  /** 暗能量软上限（阶） */
  deSoftCapLog10: 50,
  /**
   * ★ 粒子增幅速率 `b` 的基准（阶/秒）：由 `quantum-particle-lab` 反解 ——
   *   第一次大坍缩 = 7.653h × 1.75 = 13.39h（q≈30、已达成 qm1 ×1.10）✓
   */
  b0: 0.033500,
  /** ★ 粒子增幅速率的硬封顶（阶/秒）。⚠️ 这个封顶把打破无限前的阶梯锁成"3 次深坍缩" */
  /** qm7 对阈值的放宽倍率（见 bThresholdOf） */
  qm7BMaxMult: 1.25,
  /**
   * ★★ 2025：`b` 的封顶改成**阈值软上限**（用户选定）——
   *
   *   低于阈值：原样通过
   *   超过阈值：`b = 阈值 + 超出 · 2^(−超出/跨度)`   ← **与过载同一族的形状**（有界、平滑、可调）
   *
   * 为什么不用硬封顶：用户要求"第一次无限缩到 1h" ⇒ 需要 `b ≈ 0.08`
   *   （1h 跨 283 阶），而硬封顶 0.02 在结构上做不到 ✗
   *   软上限则"允许冲上去、但在远处收紧"✓ 既满足 1h，又保住"不许 runaway"的意图 ✓
   */
  bSoftKnee: 0.13,
  /** 软上限的压紧跨度（越大越宽松） */
  bSoftSpan: 0.09,
  bMax: 0.02,
  /**
   * ★★★ 2026（用户要求）：**量子共振的硬上限** ——
   *   **基础物质（`state.resources.matter`）超过 `1e100000` ⇒ 共振不再生效**（乘数恒 ×1）。
   *
   * ── 为什么用"物质"而不是"暗能量" ──
   *   共振的落点就是**物质产出**（`matterRate` 里乘它）⇒ 用物质本身设闸门最直观：
   *   玩家看到"物质已经 1e100000 了 ⇒ 共振关闭"能立刻理解 ✓
   *
   * ── 为什么叫"硬"上限 ──
   *   到点**直接失效**（不是渐近饱和、不是软上限）—— 用户明确要"大于…不再生效"✓
   *   ⚠️ 它与暗能量侧的 `DE_EFF_CAP`（软上限）**是两回事**：
   *      那个压的是"参与运算的暗能量有效量"；这个压的是"共振这条机制本身" ✓
   *
   * ── 触发成本 ──
   *   比较用**预构造的 Decimal 常量**（`SPAN_OFF_ABOVE_MATTER`），不在热路径上构造/求 log10 ✓
   */
  offAboveMatterLog10: 100000,
  /**
   * ★ 档位加速系数：`qm2` 达成后每档位乘它。
   *
   * ⚠️ 数值由**数值反解**给出，我最初手算是 1.06、**错了**：
   *   `1.06^24 = 4.05` ⇒ 24 档只花 62.6h，比 ×1.75 标尺（89.86h）快 1.44× ✗
   *   反解结果 **1.0209** ⇒ 合计 89.86h ✓（`quantum-particle-lab` §④ 有断言）
   */
  tierAccel: 1.10,
  /**
   * ★ 暗能量的指数增长速率常数（**替代 R 的那一位**）。
   *
   * `dDE/dt = a(DE)·DE` ⇒ `d(log10 DE)/dt = a(DE)`，即 log 空间里的斜率。
   * `a(DE)` 随当前暗能量**衰减**（软上限）但**有下限**（用户第 3 条：不会停摆）。
   *
   * ★ 数值 2025 修正（引擎提前到第一次大坍缩之后）：
   *   a(DE) 从**引擎到手**那一刻就开始跑，所以 a0 必须按
   *   「引擎到手 → 买到门槛压平（打破无限）」的**整段时长**标定，而不是按一次大坍缩 ✗
   *   整段 ≈ 10h ⇒ a0 = 50 / 36000 ≈ **0.00139 阶/秒** ✓
   *   （旧值 0.00621 会让 DE 在 3.41h 就撞 1e50 ⇒ 买开关时基准≈上限 ⇒ 跨度层白买 ✗
   *     断言见 `tools/infinity-ladder-lab.mjs`）
   *
   * ⚠️ 由 **ZPE 引擎**负责放大它（用户声明：引擎主负责打破无限→永恒这一段）。
   */
  a0: 0.003112,
  /** 衰减拐点（阶）：低于它不衰减 */
  aKnee: 30,
  /** 每多少阶减半 */
  aHalving: 8,
  /** 下限（占 a0 的比例）：保证永不停摆 */
  aFloor: 0.15,
  // ⚠️ 这三个字段 **已删除**（2025 引擎机制重做，用户裁定 A 方案）：
  //   `engineLevelCoeff` / `prodLevelCoeff` / `multLevelCoeff`
  //   ⇒ 全部搬到 `ENGINE_MECH`（`add` / `prod` / `mult` / `de`），因为
  //     ①④ 从"线性"改成了**饱和式**、②②b 的系数也重新标定过了 ✓
};

/**
 * 暗能量的指数增长速率 `a(DE)`：随当前暗能量衰减，但**不低于下限**。
 *
 * ⚠️ 这是**替代 R** 的那一位（`R` 是"物质 log 的斜率"，`a` 是"暗能量 log 的斜率"）。
 *    接线时要注意：它必须落在**环的输出侧**（ZPE→DE），不许接回熵阱/ZPE/全局加成。
 */
/**
 * ★★ 2025「开根削弱」：ZPE 引擎等级对**暗能量自增长**的倍率。
 *
 *   线性（旧）  `1 + 0.1×等级`        ⇒ 与深度复利 + 跨度层相乘 ⇒ **指数 runaway** ✗
 *   开根（新）  `1 + 0.1×√等级`       ⇒ `dx/dt ∝ √x` ⇒ x ∝ t²（多项式 ✓，自我减速 ✓）
 *
 *   数值对照：等级 100 ⇒ 旧 ×11 ／ 新 ×2 ｜ 等级 1021 ⇒ 旧 ×103 ／ 新 ×4.2 ✓
 *   见 `tools/post-break-runaway-lab.mjs`（拉表 + 断言）。
 */
export function deEngineLevelBonus(level) {
  const lv = Math.max(0, level ?? 0);
  if (!Number.isFinite(lv) || lv <= 0) return 1;
  // ★★ 2025 二次修订：改成**饱和式**（见 `ENGINE_MECH`）。
  //   原来 `1 + 0.1×等级` 是线性 ⇒ 真无界 ✗ 与"内部机制可以有终点"冲突。
  //   ⇒ `1 + A·x/(1+x)`，x = lv/knee；A=20 ⇒ 极限 ×21 ✓
  const { A, knee } = ENGINE_MECH.de;
  const x = lv / Math.max(1e-9, knee);
  return 1 + A * (x / (1 + x));
}

export function deGrowthRate(state, engineMult = 1) {
  const L = Math.max(0, (state.darkEnergy ?? new Decimal(1)).max(1).log10().toNumber());
  const decay = L > DE_SPAN.aKnee ? Math.pow(2, -(L - DE_SPAN.aKnee) / DE_SPAN.aHalving) : 1;
  const a = Math.max(DE_SPAN.a0 * DE_SPAN.aFloor, DE_SPAN.a0 * decay);
  // ★ 量子里程碑 qm4：暗能量自增长速率 ×1.25（见 docs/QUANTUM-MILESTONES.md）
  const qm = state.quantumMilestones?.qm4 ? 1.25 : 1;
  return a * qm * Math.max(0, engineMult);
}

/**
 * 粒子增幅速率的**封顶**（硬上限）。
 *
 * ★ 量子里程碑 qm7 放宽它：`0.02 → 0.025`（×1.25）。
 *
 * ⚠️ 为什么 qm7 不改成别的：它原来是"跨度幂 k +0.25"，但**构造上就是死的** ——
 *   实测：q = 100 时 k 已经到封顶 6.1651，而 qm7 要 **300** 累计对数 ⇒ 拿到它时永远加不进去 ✗
 *   而 `bMax` 是**真正卡住阶梯**的那个约束（`infinity-ladder-lab`：
 *   N≥4 需要 b ≥ 0.0236 > 0.02 ⇒ 数学上做不到）⇒ 放宽它才有意义 ✓
 */
/** 档位加速倍率的**软上限拐点**：低于它原样通过（设计要求"≤24 档 ≈ ×9.85"完整保留 ✓） */
const TIER_ACCEL_KNEE = 12;
/** 档位加速软上限的跨度（上界 = 拐点 + 它 = ×18） */
const TIER_ACCEL_SOFT_SPAN = 6;
/**
 * ★ 2025 B1 修复：档位加速倍率必须**有界**。
 *
 * 原式 `Math.pow(tierAccel, tiers)` 直接吃**无界的**大坍缩次数：
 *   · 设计要求只在 ~24 档内成立（`1.10^24 ≈ 9.85`）；
 *   · 而破∞后坍缩会 runaway（TODO B3"坍缩刷屏"，实测 7448 次）⇒ `1.10^7448 = Infinity`
 *   ⇒ `b = Infinity` ⇒ `softCapB` 里 `over/span = Infinity` 与 `1 + Infinity` 相除
 *     ⇒ **NaN** ⇒ 粒子/物质全链冻结（stage-timing 的 `物质=1eNaN`，B1）✗
 *
 * 用与 `softCapB` **同族**的单调软上限压住（有界 = knee + span ✓ 平滑 ✓ 不减 ✓）。
 * `∞` 由此落成有限值，不再产生 NaN ✓
 */
export function tierAccelMult(state) {
  if (!state.quantumMilestones?.qm2) return 1;
  const tiers = Math.max(0, (state.bigCrunchCount ?? 0).toNumber ? (state.bigCrunchCount).min(1e15).toNumber() : Number(state.bigCrunchCount ?? 0));
  const raw = Math.pow(DE_SPAN.tierAccel, tiers);
  if (!Number.isFinite(raw)) return TIER_ACCEL_KNEE + TIER_ACCEL_SOFT_SPAN;
  if (raw <= TIER_ACCEL_KNEE) return raw;
  const over = raw - TIER_ACCEL_KNEE;
  return TIER_ACCEL_KNEE + over / (1 + over / TIER_ACCEL_SOFT_SPAN);
}

/**
 * ★★ 2025 B7：**b 的软上限随引擎等级放开**（拆掉「效果封顶」✗）
 *
 * ── 为什么必须改（实测现场）──
 *   原式上界恒等于 `knee + span = 0.22`（与引擎无关）⇒ 是**效果封顶** ✗
 *   实测：把引擎倍数从 1 拉到 1e12（12 个数量级），`softCapB` 之后的 b
 *   只从 0.0335 涨到 0.22（**6.6 倍**）✗
 *   ⇒ 引擎的乘法被自己的软上限吃掉 ⇒ **引擎当不了「打破无限 → 永恒」的主推进** ✗
 *     （用户定位：引擎 ≈ AD 的星系 / 接手复制器的辅助职责 ⇒ 它必须真的能放大产出）
 *
 * ── 改法（用户 2025 决策）──
 *   用户要的是**成本曲线**控节奏，**不要效果封顶**（与 AD 一致：AD 封价格、不封效果）
 *   ⇒ knee 与 span **按同一倍率一起放大**（保持同族形状 ⇒ 单调 ✓ 平滑 ✓ 有界 ✓）
 *   ⇒ 上界 = `mult × (knee + span)`，随引擎等级线性增长
 *
 * ── 为什么倍率取 `1 + 0.5×等级`（**待标定，但形状是对的**）──
 *   · 拉到 b ≈ 6.2e3 阶/秒（≈ 一轮走完 283 阶 ⇒ 单轮够拿 1e280 量级）需要约 1.24e4 级；
 *   · 该倍率下 1.24e4 级 ⇒ 上界 ≈ 1240（够），而 1 万级 ⇒ 5580（有余量）；
 *   · 系数 `0.5` 是**唯一的旋钮**：调大 ⇒ 更早放开（更快到顶，但更接近 runaway）；
 *   · ⚠️ 它**不是**自由参数：要按 `docs/TODO.md` B7 的表标定（目标 = 54.05h 到 1e280 基础值）。
 *
 * ⚠️ 本函数只影响**上界**，不影响拐点以下的线性段 ⇒ 前期手感零回归 ✓
 * ⚠️ 必须走 `effectiveEngineLevel()`（唯一入口）—— 否则 IC 挑战修饰器会被绕过 ✗（显示≠实发）
 */
export const B_CAP_PER_LEVEL = 0.5;
export function bCapMult(state) {
  const lv = effectiveEngineLevel(state).toNumber();
  if (!Number.isFinite(lv)) return 1;
  return 1 + B_CAP_PER_LEVEL * Math.max(0, lv);
}

/**
 * ★★ 2025 B8：**物质层的 b区（指数区）成员 —— 由引擎等级控制**
 *
 * ── 为什么是这里（用户给的框架 + 用户裁定）──
 *   规范：`资源_next = { [ … ] ^ 指数区 } × 最终倍率区`
 *   用户裁定两条：
 *     ① "IP 全部来自**基础物质**（基础公式），**不看升级** ✗"
 *        ⇒ 要跨到永恒的 IP，必须让**基础公式的输入（物质深度）**变大，
 *          而不是再加一个 IP 升级（那会变成 IP→IP 平行环，违反 `PROGRESSION §0.3` 骨架）
 *     ② "b区 的成员**由引擎控制**"
 *        ⇒ 引擎的落点从「抬 ZPE 产出」升级为「改物质曲线的**形状**」
 *
 * ── 数学为什么这样才够（我前面几轮的核心结论）──
 *   a区（乘法）只改**高度**：`log10(物质)` 的斜率仍由 b 钉住（= 2.17 阶/秒）
 *     ⇒ 54 小时最多 `2.17×194580 = 4.2e5` 阶 ⇒ 看似够，
 *       但**每轮都被大坍缩清零**，实际峰值只推进 2 阶/小时 ⇒ 永远到不了 ✗
 *   b区（指数）改**斜率**：`总量 = base^k` ⇒ `d log10(总量)/dt = k · d log10(base)/dt`
 *     ⇒ **斜率被放大 k 倍** ⇒ 这才是"用升级撬动基础物质"的正统位置 ✓
 *
 * ── 判据：**必须同时单调、有界**（项目既有红线）──
 *   · 单调 ⇒ 引擎等级越高越强（不许出现"越买越弱"）
 *   · 有界 ⇒ **不许 runaway**：`k` 若继续随等级无界增长，
 *     `d log10(N)/dt = b·k` 会随 t 二次增长 ⇒ 有限时间奇点 ✗（与 ZPE 的 `a≥1` 同一个病）
 *   ⇒ 用**单调饱和**形状：`k = 1 + kMax·x/(1+x)`，`x = 等级/knee`
 *     （与 `softCapB` / `effectiveDarkEnergyLog10` 同一族，项目里已有三处用这个形状）
 *
 * ── 标定 ──
 *   · `kMax = 25`：反解自"到 1e280 基础 IP 需 `log10(物质) ≈ 8.65e4` 阶"
 *     （`k ≈ 25` 时，约 2 小时内即可跨完；k=1 时永远到不了）
 *   · `knee = 2000`：约 2000 级吃到 `kMax` 的一半（`k ≈ 13`）
 *   ⚠️ 两个常数都是**待标定**的旋钮，但形状（单调饱和）是硬要求 ✓
 *
 * ⚠️ 安全性说明（为什么它**不进** S 池）：物质不在「熵阱 ↔ ZPE」那个主环里，
 *   所以对物质取幂不会放大环增益。这条与 R 当年被删的理由不同 ——
 *   R 是**速率常数**（只改速度、改不了形状 ⇒ 可玩性窄），b区 改的是形状 ✓
 */
/**
 * ★★★ 2025 终稿（用户裁定，H2）：**b区指数 k 的标度**。
 *
 *   目标：物质到 **1e95000** ⇒ IP = 1e308.25（见 `docs/TODO.md` H 段）
 *   实测（表二，`runSeconds=300`）：**k ≈ 5.95 正好命中目标**
 *     k=5.9 ⇒ 单轮 IP 1e276.3（差 32 阶）
 *     k=6.0 ⇒ 单轮 IP 1e380.8（超 72.6 阶）
 *   ⇒ 满值只需 **6**（原来的 26 毫无意义：k=8/10/14 只是数字更大、无新意义）
 *
 *   标度：`k(lv) = 1 + KMAX·x/(1+x)`，`x = lv/KNEE`
 *     KNEE = 100 ⇒ 100 级 ⇒ k = 3.5｜300 级 ⇒ 4.76｜1000 级 ⇒ 5.55｜趋近 6
 *     （与用户裁定 C「1e28 池 ≈ 100 级」对齐：那时 k 已到一半以上 ⇒ 机制有实质强度 ✓）
 */
export const MATTER_B_KNEE = 100;
export const MATTER_B_KMAX = 5;
export function matterTotalExponent(state) {
  const lv = effectiveEngineLevel(state).toNumber();
  if (!Number.isFinite(lv) || lv <= 0) return 1;
  const x = lv / MATTER_B_KNEE;
  return 1 + MATTER_B_KMAX * (x / (1 + x));
}

export function bThresholdOf(state) {
  const qm = state.quantumMilestones?.qm7 ? DE_SPAN.qm7BMaxMult : 1;
  return DE_SPAN.bSoftKnee * qm * bCapMult(state);
}

/**
 * ★ 阈值软上限：把原始 `b_raw` 压成实际生效的 `b`。
 *
 *   `b ≤ 阈值`  ⇒ 原样
 *   `b > 阈值`  ⇒ `阈值 + 超出 / (1 + 超出/跨度)`   ← 有界（上限 = 阈值 + 跨度）
 *
 * 与「过载」同一族的形状 ✓（`2^(−超出/x)` 的单调化版本）—— 项目里已有多处用这个形状。
 * ★ 2025 B7：拐点与跨度都乘 `bCapMult()` ⇒ **上界随引擎等级放开** ✓（不再是效果封顶）
 */
export function softCapB(bRaw, state) {
  const cap = bCapMult(state);
  const knee = bThresholdOf(state);
  const span = DE_SPAN.bSoftSpan * cap;
  // ★ 2025 B1：非有限入参守卫 —— 原式在 `bRaw = Infinity` 时
  //   `over/span = Infinity`、`1 + over/span = Infinity` ⇒ Infinity/Infinity = **NaN** ⇒
  //   粒子/物质全链被污染（stage-timing 的 `物质=1eNaN`）。这里直接给上界 ✓
  if (!Number.isFinite(bRaw)) return knee + span;
  if (bRaw <= knee) return bRaw;
  const over = bRaw - knee;
  return knee + over / (1 + over / span);   // ★ 单调递增 ✓ 上界 knee+span ✓（旧式 x·2^(-x/span) 会在 x>1.44·span 后**反向下降** ✗）
}

/**
 * ★ 2025「步首快照」的统一入口：**量子个数**的读取。
 *
 * 为什么需要它：`advance` 把时间按 5 秒切 chunk，每 chunk 调一次 tick ✗
 *   而量子是**阈值跳变**量（捕获一次 +2）⇒ 后面的 chunk 会用上跳变后的 q，
 *   界面显示的却是起始 q ⇒ "显示 == 实发"分叉（实测物质偏 41% ✗）
 *   ⇒ 短步（≤30s）里由 `advance` 设 `state.quantumFrozen`，
 *     所有"量子派生"的读取都走这里 ⇒ 整步用**同一个 q** ✓
 *   ⚠️ 它只冻结**读取**，不动 `state.quantum` 的累计 ✓（第一版草稿就是错在覆盖 state ✗）
 *   ⚠️ 长步（离线）**不冻结**：否则离线几小时的量子进展会被拉平 ✗
 */
const SPAN_OFF_ABOVE_MATTER = new Decimal("1e" + DE_SPAN.offAboveMatterLog10);

/**
 * 量子共振乘数 `(DE / DE₀)^k`（**原名「跨度层」，机制未变**）。**未买「门槛压平」时恒为 1**。
 *
 * ⚠️ 2025 起"基准"与"开关"是**两件事**（之前我用 `spanDeBase > 0` 兼任开关，需求变了）：
 *   · **基准 `DE₀`**：在 **ZPE 引擎到手时**记录（引擎把 `a(DE)` 打开，DE 从那一刻起指数增长）
 *   · **开关**：`thresholdFlatBought`（无限升级「门槛压平」，需先打破无限）
 *   ⇒ 这样"引擎到手 → 买到开关"期间 DE 的增长**全部**被换算成共振 ✓
 *
 * ★★★ 2026：**硬上限** —— 基础物质 `> 1e100000` ⇒ **恒 ×1**（用户要求，见 `offAboveMatterLog10`）✓
 */
export function matterSpanExponent(state) {
  // ⚠️ config.js 没有 `D()` 辅助函数（那是 state.js 的），直接用 new Decimal
  // ★ 数值约定 #3：量子可以极大 ⇒ 限幅后再降级（1e15 远超任何真实用量 ✓）
  const q = Math.max(0, (state.quantum ?? new Decimal(0)).min(1e15).toNumber());
  const raw = 1 + DE_SPAN.kCoeff * Math.sqrt(q);
  return Math.min(raw, DE_SPAN.kMax);
}

/**
 * 量子共振的硬上限常量（`1e100000`）—— **模块级预构造**，供热路径 O(1) 比较 ✓
 * ⚠️ 用 `"1e" + 数字` 拼字符串而不是 `pow`：`Decimal.pow(10,100000)` 有浮点尾巴，
 *   而这里只需要一个**精确的**比较阈值 ✓
 */
export function matterSpanMult(state) {
  if (!state.thresholdFlatBought) return new Decimal(1);      // 开关：门槛压平
  // ★ 硬上限：基础物质超过 1e100000 ⇒ 量子共振不再生效（放在最前面之一：
  //   比它便宜的判据先挡，避免无谓的 Decimal 运算 ✓）
  const matter = state.resources?.matter;
  if (matter && matter.gt(SPAN_OFF_ABOVE_MATTER)) return new Decimal(1);
  const base = state.spanDeBase ?? new Decimal(0);
  if (base.lte(0)) return new Decimal(1);
  const de = state.darkEnergy ?? new Decimal(0);
  if (de.lte(base)) return new Decimal(1);
  // ★ 方案乙：改用**有效量**（越 1e50 后渐近饱和 ✓ 见 DE_EFF_CAP ✓）
  const dEff = Decimal.pow(10, effectiveDarkEnergyLog10(state));
  return dEff.div(base).pow(matterSpanExponent(state));
}

/**
 * ★★★ 2025（用户裁定：「ui 确保在购买门槛压平后正确显示就行」）：
 * **跨度层的状态 + 显示值，唯一来源**。
 *
 * ── 为什么必须抽出来 ──
 *   原来**显示侧与实发侧各有一套判据**（本项目"显示 ≠ 实发"的头号成因 ✗）：
 *     `ui.js`  : `spanOn = state.spanDeBase > 0`      ← 只看"基准记了没"
 *     `matterSpanMult` : `if (!state.thresholdFlatBought) return 1`  ← 看"开关买了没"
 *   而**基准是在「引擎到手」时就记的**（见 `matterSpanMult` 的注释），
 *   开关却是「门槛压平」⇒ **在"引擎到手 → 买到门槛压平"这段里，
 *   界面会显示「已开启」而实际乘数恒为 ×1** ✗
 *
 * ⇒ 本函数把三者（开关 / 基准 / 当前暗能量相对基准的位置）**一次说清**，
 *   界面与断言都读它 ⇒ 不可能再脱节 ✓
 *
 * @returns {{on:boolean, k:number, mult:Decimal, base:Decimal, deLog10:number,
 *            effectiveLog10:number, overBase:boolean, reason:string}}
 */
export function matterSpanStatus(state) {
  const base = state.spanDeBase ?? new Decimal(0);
  const de = state.darkEnergy ?? new Decimal(0);
  const k = matterSpanExponent(state);
  const mult = matterSpanMult(state);
  const deLog10 = de.gt(0) ? de.log10().toNumber() : 0;
  const effectiveLog10 = effectiveDarkEnergyLog10(state);
  const overBase = base.gt(0) && de.gt(base);
  // ★★★ 2026：**硬上限**是否已触发（基础物质 > 1e100000 ⇒ 量子共振失效）
  const matter = state.resources?.matter;
  const capped = !!(matter && matter.gt(SPAN_OFF_ABOVE_MATTER));

  let reason = "";
  // ⚠️ 顺序有意义：**硬上限排在最前** —— 它一旦触发，其他阶段都不重要了
  //   （否则会显示"已生效"而乘数其实是 ×1 ⇒ 又一次"显示 ≠ 实发"✗）
  if (capped) reason = `状态：量子共振已失效（基础物质已超过 1e${DE_SPAN.offAboveMatterLog10} 硬上限）`;
  else if (!state.thresholdFlatBought) reason = "状态：未开启（需先买「门槛压平」）";
  else if (base.lte(0)) reason = "状态：基准未记录（应在 ZPE 引擎到手时记录）";
  else if (!overBase) reason = "状态：暗能量尚未超过基准 ⇒ 乘数恒为 ×1";
  else reason = "状态：已生效";

  return {
    on: mult.gt(1),                    // ★ "真的在乘"才叫开启（而不是"开关买了"）
    armed: state.thresholdFlatBought === true && base.gt(0),   // 开关+基准就绪（但可能还没超过基准）
    capped,                            // ★ 2026：硬上限已触发（物质 > 1e100000）
    k,
    mult,
    base,
    deLog10,
    effectiveLog10,
    overBase,
    reason,
  };
}

/**
 * 汇总已购量子升级的效果（占位标题保留）
 */

// ★ `darkMatterMultiplier(10^DM)` 已移除 —— 暗物质体系整个删除。
//   它是「阶梯 3 秒」的形式性元凶（把曲线平移 1e560 个数量级）。
//   现在由「粒子时变增幅」（`particleTimeBoost`）与「暗能量跨度层」提供。

/**
 * 「打破无限」—— 仿 AD 的 Break Infinity。
 *
 * 三个阶段：
 *   ① 未打破：物质被**硬顶**在 `crunchAt`，到顶**强制**大坍缩，收益固定 `firstCrunchIP`
 *              （对应 AD 的第一次 Infinity，你没法突破 1.79e308）
 *   ② 花 `unlockCost` 无限点买下「打破无限」
 *   ③ 已打破：上限解除，物质可以继续涨；大坍缩改为**手动**，
 *              收益随深度连续增长 —— 这就是「超过 e308.25 迎来削弱」：
 *              跑得越深收益越高，但**每多一个数量级的收益递减**。
 *              玩家要在「多跑一会儿」和「赶紧收」之间选。
 */


