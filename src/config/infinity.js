/**
 * config/infinity.js —— 无限层：门槛、过载、∞ 升级、IP 经济、无限增幅、档位里程碑
 *
 * ⚠️ 本文件由 `src/config.js` 按领域机械拆分而来：**声明与注释逐字保留**。
 *    对外仍然统一从 `src/config.js`（barrel）导入 —— 不要直接改这里的 import 路径。
 *    依赖：milestones, quantum, dark-matter ｜ Decimal
 */
import Decimal from "../../dist/break_eternity.esm.js";
import { hasCollapse } from "./milestones.js";
import { QUANTUM } from "./quantum.js";
import { powExactInt } from "./dark-matter.js";

export const TIER_MILESTONES = [
  /**
   * ⚠️ 2025：原来 7 条里有 **4 条是 `kind:"cap"`（"铸币每档上限 +N"）** ——
   *   铸币整个删除后它们是**死数据**（`cap` 没有任何读取方），
   *   而 UI 会把 `desc` 原样显示给玩家 ⇒ 面板上写着"铸币每档上限 +3"这种不存在的机制 ✗
   *   ⇒ 用户要求"赶紧把无限子页面的东西改了" ⇒ 这 4 条改成**已经接线**的 `lube`：
   *     `tierQuantumStepMult()` 里 `k = 1 − Σ(value/20)/2` —— 把量子门槛步长从 ×20 缓到 ×19.5 那一族，
   *     落在「打破无限 → 永恒」那段的承重机制上（量子来得更早 ⇒ 跨度幂 k 与 b 都更早起来）✓
   */
  { at: 3, id: "tm-lube1", kind: "lube", value: 0.5, desc: "量子润滑：门槛步长 ×20 → ×19.5" },
  { at: 6, id: "tm-rate1", kind: "rate", value: 1.05, desc: "成长速率 ×1.05" },
  { at: 9, id: "tm-lube2", kind: "lube", value: 0.5, desc: "量子润滑：门槛步长再缓一档（→ ×19.0）" },
  { at: 12, id: "tm-lube3", kind: "lube", value: 0.5, desc: "量子润滑：门槛步长再缓一档（→ ×18.5）" },
  { at: 15, id: "tm-rate2", kind: "rate", value: 1.05, desc: "成长速率 ×1.05（累计 ×1.1025）" },
  { at: 18, id: "tm-lube4", kind: "lube", value: 0.5, desc: "量子润滑：门槛步长再缓一档（→ ×18.0）" },
  { at: 24, id: "tm-lube5", kind: "lube", value: 0.5, desc: "收尾：量子润滑再来一档（→ ×17.5）" },
];

/** 已解锁的档位里程碑（大坍缩次数 ≥ at） */
export function tierMilestonesDone(state) {
  const n = state.bigCrunchCount instanceof Decimal ? state.bigCrunchCount.min(1e15).toNumber() : Number(state.bigCrunchCount) || 0;
  return TIER_MILESTONES.filter((m) => n >= m.at);
}

/** 铸币**每档上限**（基础 30 + 里程碑累加）—— 档数压缩就是靠它 */


/** 档位里程碑给的成长速率倍率（并入 infinityRateMult，保持单一入口） */
export function tierRateMult(state) {
  let m = 1;
  for (const x of tierMilestonesDone(state)) if (x.kind === "rate") m *= x.value;
  return m;
}

/** 档位里程碑给的"量子润滑"：门槛步长的额外倍率（1 = 无缓和） */
export function tierQuantumStepMult(state) {
  let k = 1;
  for (const m of tierMilestonesDone(state)) if (m.kind === "lube") k *= 1 - m.value / (state && hasCollapse(state, "cm7") ? 22 : QUANTUM.zpeCostGrowth) / 2;
  return k;
}

/**
 * ★ 永恒层（先占位：只有门槛与永恒点公式，内容待设计）
 *
 * 永恒点公式**照 AD 抄**（`src/core/secret-formula/multiplier-tab/eternity-points.js`）：
 *
 *   AD: `DC.D5.pow( log10(maxIP) / (308 − Pelle) − 0.7 )`
 *   即  **永恒点 = floor( 5^(log10(IP)/308 − 0.7) )**
 *
 * 代入门槛验算：`5^(308.25/308 − 0.7) = 5^0.3008 = 1.62` → floor = **1 点** ✓
 * （AD 第一次永恒也正好给 1 点，手感一致。）
 *
 * ⚠️ 两条与物质层**刻意不同**的地方（用户指定）：
 *   1. 永恒点只由 **无限点**决定，与物质深度无关；
 *   2. **没有**「到 1e308.25 强制坍缩」那种硬顶机制 —— 永恒是**手动**触发的，
 *      到了门槛不会自己重置（强制坍缩只存在于物质层）。
 */
export const BREAK_INFINITY = {
  /**
   * 大坍缩阈值 = log10(Number.MAX_VALUE) = 308.2547…
   *
   * ⚠️ 阈值必须用 `Decimal.pow(10, MAX_LOG10)` 构造，**不能用字符串 `"1e308.2547"`**。
   *    break_eternity 的字符串解析只认**整数**指数 ——
   *    `new Decimal("1e308.2547")` 会静默变成 `1e308`，白丢 0.25 个数量级。
   *    （这就是又一处「显示 vs 实际」不符：界面写 1e308.2547，代码实际用 1e308。）
   */
  maxLog10: Math.log10(Number.MAX_VALUE),

  /** 首次大坍缩的固定收益 */
  firstCrunchIP: 1,

  /**
   *
   * ⚠️ **实测重解过**（R 删除之后）：
   *   · 模型初值 0.035 是在"R 还在"时按"每次超出 43 阶"反解的；
   *   · 真实引擎（60h 仿真）实测：打破无限用了 **14 次**坍缩（每次 ~9 IP）
   *     ⇒ 真实的"超出阶数"只有 **~27 阶**（贪心策略收得更早，不是 43）✗
   *   · ⚠️ 我按 "要 42 IP/次" 反解成 `c ≈ 0.060` 并实测 —— **结果更慢**（50h 只有 4 次坍缩、
   *     IP 才 1e1.70）✗ ⇒ **已回退到 0.035**（实测基线：60h / 14 次 / 57.97h 达成）✓
   *     教训：**"IP/次"不是唯一变量** —— 多出来的 IP 会被策略花在起点跃迁/速率解放上，
   *     从而改变物质爬升与坍缩节奏。想调这一段，模型必须**把"IP 花在哪"也建进去** ✗
   *     （`infinity-ladder-lab` 目前只看"IP/次"，**不足以**预测这一段）
   *
   * 为什么必须加：IP/次 恒为 1 ⇒ 128 IP 要 128 次大坍缩 ⇒ 与"慢速大坍缩"（R 已退休）冲突 ✗
   */
  /** ★ 深度软上限（用户方案 c / 甲档）：超出 knee 的部分被 `2^(−超出/跨度)` 压紧，上界 = knee + span/ln2 */

  /**
   * 买下「打破无限」要多少无限点。
   *
   * ⚠️ 128 是**刻意的**：这一层的设计意图是「让玩家多次无限来攒无限点」，
   *    所以门槛要落在大约 3~5 次无限才能攒到的位置。
   *    每次无限的基础收益是 `firstCrunchIP = 1`，所以光靠大坍缩本体是攒不到的 ——
   *    真正的收入来自「无限长河」（④，按耗时给点）和「无限增幅」（①，收益翻倍）。
   *    实测（tools/infinity-sim.mjs）：约 5 次无限 / 8~9 小时可买下。
   */
  unlockCost: 128,

  /**
   * 突破后的收益公式：`floor(base × (log10(物质) / log10(MAX))^exponent)`
   *
   * exponent = 2 时：
   *   1e308  -> 1       （还没突破，和固定收益持平）
   *   1e616  -> 4
   *   1e1000 -> 10
   *   1e3000 -> 94
   */
  ipBase: 1,
  ipExponent: 2 };

/** 大坍缩阈值的显示字符串（和实际值同源，不会脱节） */
export const CRUNCH_AT_LABEL = (() => {
  // ★★★ 2025（用户裁定）：**统一科学计数法为 `1.00e308`**
  //   ⚠️ 原来是 `1e${maxLog10.toFixed(4)}` = **`1e308.2547`** —— 这个写法**是错的/误导的**：
  //     它的意思是 `10^308.2547` = **1.7977e308**，但字面看着像"e 后面跟了个小数" ✗
  //   ⇒ 规范写法 = `1.80e308`（尾数 × 10 的整数次幂）✓
  const v = Decimal.pow(10, BREAK_INFINITY.maxLog10);
  const exp = Math.floor(BREAK_INFINITY.maxLog10);
  const mant = v.div(Decimal.pow(10, exp)).toNumber();
  return `${mant.toFixed(2)}e${exp}`;
})();

// ══════════════════════════════════════════════════════════
// 过载（打破无限之后的**软上限**）
// ══════════════════════════════════════════════════════════

/**
 * 未打破无限时，物质被**硬顶**在 1e308.2547，到顶强制大坍缩（保持原样）。
 * 打破之后不再有硬顶，改走**过载**：超过拐点后，物质产出速率每 `halvingOrders` 阶减半。
 *
 *   `d(log10 M)/dt = R(q) · 2^(−(L − 拐点)/halvingOrders)`
 *
 * ── 为什么必须是"软"的 ──
 *   硬顶会让"再深一点"变成不可能，于是任何"用无限点买的东西去抬上限"的设计
 *   都会掉进自指闭环：`cap = f(IP(cap))` 只有两种结局 —— 卡死（f 次线性）
 *   或刀刃爆炸（f 超线性）。软上限把"能不能过去"换成"过去得有多慢"：
 *     · 进度永远有一点，不存在死锁；
 *     · 深度按 `ΔL = D·log2(1 + ln2·R·t/D)` 随时间**对数增长**（D = halvingOrders）；
 *     · 实测（_sim 沙盒）：D=10 → +43 阶/次、约 6 分钟；D=20 → +87 阶/次、约 8.4 分钟。
 *
 * ── 量子推迟拐点 ──
 *   `拐点 = 308.2547 + 每量子推迟阶数 × 量子数`
 *   0.00432137 = log10(1.01)，即「每量子稳定 1%」的等价写法。
 *   拐点越高，能推得越深（收益侧的无限点也随深度增长）。
 *   ⚠️ 注意这里只乘**当前量子数**：大坍缩会把量子清零，所以每轮都要重新累积。
 */
export const OVERLOAD = {
  /**
   * ★★★ 2025（用户裁定）：**过载的触发门槛 = 「基础物质获得速率」**，不是物质数量。
   *
   *   用户原话：「过载机制生效的时间应该在**基础物质获得速率大于 1.8e308** 时生效
   *             （**有且只影响获得速率**）」
   *   以及对速率的定义：「**每秒能获得多少**」⇒ 就是 `d(资源)/dt` 的倍率。
   *
   *   ⚠️ 旧实现用 `matter.log10() > 拐点(308.25 + 0.00432×量子)` 判触发 —— 那是**数量**口径 ✗
   *      （那个"拐点"原本是给"物质到顶强制大坍缩"用的，被借来当过载触发点）
   */
  rateThreshold: new Decimal(Number.MAX_VALUE),   // = 1.7976931348623157e308
  /**
   * 上式的 **log10 预计算值**（= 308.2547…）。
   *
   * ⚠️ 判定必须在**对数域**做：物质获得速率是 Decimal，实测 168h 已达 **1e1943** ⇒
   *   若把 rate 转成普通 number（或 `Number(...)`）比较 → **溢出成 Infinity**
   *   ⇒ 判定恒为"超阈"、因子恒为极小 ✗（我第一版就踩了这个）
   *   ⇒ 统一用 `rate.log10()` 与这个常数量级比 ✓
   */
  rateThresholdLog10: new Decimal(Number.MAX_VALUE).log10(),

  // ══════════════════════════════════════════════════════════
  // ★★★ 2025 二次重做（用户裁定 **方案 B**）：**渐近式**削弱因子
  // ══════════════════════════════════════════════════════════
  // ── 为什么必须从「指数式」换成「渐近式」──
  //   用户质疑：「虽然是仿照 AD 中复制器的增长削弱逻辑，但**为什么能变成负增长**呢？」
  //   ⇒ 完全正确，而且能算出根因：
  //     `s = |d ln(factor)/d over|`，硬约束 **`k·s < 1`**（k = 引擎的 b区指数）
  //     · 旧指数式 `1.2^(−over/2.63)` 配 `tierShift` ⇒ `s = (ln1.2/2.63)·(1+0.25·档数)`
  //       **随档数无上界增长** ⇒ 实测 over=5000 时 `s = 8.72`、`k·s = 120` ≫ 1
  //       ⇒ **速率随 base 上升而下降** = 负增长 ✗（用户感觉到的就是这个）
  //     · 渐近式 `1/(1+over/knee)^p` ⇒ `s = (p/knee)/(1+over/knee)` **随 over 递减**
  //       ⇒ 只要 `p/knee < 1/k` 就**永远**不越界 ✓（与 over 无关，结构性安全）
  //
  //   ⚠️ AD 的真正做法是因子乘在 **interval**（时间）上（`scaleFactor = 1.2 > 1` ⇒ 变慢），
  //      而我们乘在 **rate**（数量）上 ⇒ **同一个公式、一个让「变慢」一个让「变少」**。
  //      渐近式的作用就是把"变少"压回"变慢"（因子有下界、速率与 base 同阶增长）✓
  //
  // ── knee = 8430 的依据（这是可算的，不是拍的）──
  //   用户要求：「获取 ip 的公式中 ip 大于 e308.25 时，**推进到那个点不费更多时间**」
  //   实测（物质首次触及硬顶 1e308.25 的现场，11.13h）：
  //       物质 = 1e533.8｜**速率 = 1e751.9**｜`over` = 751.9 − 308.2547 = **443.7 阶**
  //       旧指数式在该点的因子 = **1.66e−47** ⇒ 那一段被砍掉 47 个数量级 ✗
  //   ⇒ 要"不多花时间"就得 `因子(over=443.7) ≈ 1` ⇒ `knee ≫ 443.7`
  //     目标「最多慢 5%」（因子 ≥ 0.95）⇒ `knee ≥ 443.7 × 0.95/0.05 = 8430` ✓ **方案 B**
  //   ⇒ 附带好处：`k·s = k·p/knee = 26/8430 = 0.0031`（上限 1.0）⇒ **余量 99.7%** ✓
  //
  //   ⚠️ 代价（必须记住）：过载在 `over ≲ 4000` 阶内几乎不起作用 ⇒ 它变成**纯晚期软上限**。
  //      前期/中期完全不拦 —— 这是"不多花时间"这个要求必然带来的。
  knee: 8430,
  /** 幂指数 `p`。取 1 使 `p/knee = 1.19e-4` 极小 ⇒ 安全性最大化（`p` 越大越陡） */
  p: 1,
  /**
   * ★ **自动坍缩的过载阈值**（`overloadFactor` 低于它就认为"这一轮跑够了"）。
   *
   *   ⚠️ **必须与 knee 一起标定**：渐近式的因子有**下界 0**、但下降极慢
   *     ⇒ 若 `crunchBelow` 定得太小（比如 0.05），要 over = 19·knee = 1.6e5 阶才到
   *     ⇒ 自动坍缩可能**永远不触发** ⇒ 卡住 ✗
   *   ⇒ 由 `tools/overload-lab.mjs` 断言「在合理深度内一定可达」✓
   *     实测该点的 over 在数百~数千量级，故取 0.5（over = knee = 8430 阶处到达）
   */
  crunchBelow: 0.5,
  /**
   * ★★★ 2025（用户裁定）：**本轮时长上限（秒）—— 收手判据改成「按时间」**。
   *
   *   ── 为什么必须挪掉「按速率」──
   *     `k`（b区指数）直接放大 rate ⇒ 按 rate 收手时 `k↑` ⇒ **更早收手** ⇒ 深度变浅
   *     ⇒ "k 越大 = 越快但收入越低"，**方向反了** ✗
   *     （实测：k 每 +1 ⇒ 收手深度 **−3646 阶** ⇒ 收入 −11.84 阶）
   *   ── 按时间收手后 ──
   *     `k↑` ⇒ 同样时间内推进更深 ⇒ 深度↑ ⇒ 收入↑ ⇒ **k 变成纯收益** ✓
   *     而且它让用户要的机制成立：「**基于最快的一次无限时间**给量子加成」
   *     （k↑ ⇒ 更快 ⇒ T_best 更小 ⇒ 加成更高 ⇒ 正反馈，但被这个时间上限钉住 ⇒ 不发散 ✓）
   *
   *   ⚠️ 这是**基线值**。用户要的机制会让它随 `T_best` 变化（见 `QUANTUM_SPEED`）。
   *   ⚠️ 旧的 rate 判据在 `shouldCrunch` 里**保留为兜底**（时间到不了时仍能收手 ⇒ 不卡死）。
   */
  runSeconds: 300,

  // ══════════════════════════════════════════════════════════
  // ★ 2025 已删除的字段（用户裁定「该拆掉的就拆」）
  // ══════════════════════════════════════════════════════════
  //   `factor: 1.2`        —— AD 的 scaleFactor；渐近式不用它（改由 knee 定形状）
  //   `halvingOrders: 2.63`—— 指数式的步长；正是负增长的来源（s 随档数无上界）
  //   `tierShift: 0.25`    —— 分档累进；在渐近式里**只会把 s 推陡** ⇒ 纯有害 ✗
  //   `stepOrders: 10`     —— tierShift 的档长，随之删除
  //   `quantumDelayPerQuantum` —— 旧"数量拐点随量子推迟"的参数；触发量已改成速率，无读取方
};

/**
 * 打破无限后的物质上限（阶）—— **只是显示用的口径**。
 *
 * ⚠️ ★★★ 2025：**过载的触发量已改成「速率」**（见 `OVERLOAD.rateThreshold`）⇒
 *   本函数**不再参与过载判定**，只留给界面显示"打破后物质能推到哪里"。
 *   它**不再随量子推迟** —— `quantumDelayPerQuantum` 是数量口径的遗留，已删除
 *   （速率口径下"量子把拐点往上推"没有对应物）。
 *
 * ⚠️ 待办：它与 `BREAK_INFINITY.maxLog10` 只差一个"量子推迟"，而现在那个推迟没了
 *   ⇒ 本函数已**完全等于常量** ⇒ 应当整体删除、调用方直接用 `BREAK_INFINITY.maxLog10`。
 *   删它会牵动 `ui.js` 与 `crunch-speed-lab` / `de-span-lab` / `infinity-ladder-lab` 三个工具
 *   ⇒ 本轮先不删，记为待办。**它们现在都还在读它，别单独删**。
 */
export function overloadThreshold(state) {
  return new Decimal(BREAK_INFINITY.maxLog10);
}

// ⚠️ 2025 已删除：`overloadUsedOver(over)`（"每超一档 ⇒ 阈值被抬高"的分档累进）
//   删除理由：它是**负增长的直接来源** —— `s = |d ln(factor)/d over|` 随档数无上界增长，
//   实测 over=5000 时 `k·s = 120` ≫ 1 ⇒ 速率随 base 上升而下降 ✗
//   渐近式（`OVERLOAD.knee`）的 `s` 随 over **递减** ⇒ 结构性安全 ✓
//   详见 config.js 的 `OVERLOAD` 注释与本文件 `OVERLOAD.knee` 的标定说明。

// ══════════════════════════════════════════════════════════
// ∞ 层：无限升级（全部用无限点购买，不随大坍缩重置）
// ══════════════════════════════════════════════════════════

/**
 * 四个无限升级。效果的计算全部在 formulas.js / engine.js，
 * 这里只放**数据**（价格 + 效果参数 + 描述），和别的层一个规矩。
 *
 * ── 为什么这一层要有 ④「无限长河」──
 *   大坍缩本体的收益是 `floor((log10M / 308.2547)²)`，而物质被硬顶在 1e308.2547，
 *   所以**每次无限恰好 1 个无限点**，而一次无限又要 ≥ 94 分钟（R 被钳在 0.05 阶/秒）。
 *   光靠它，攒 128 点要 200 小时 —— 整层不可达。
 *   ④ 把一部分收入改成**按耗时**给（与深度无关），于是：
 *     · 每次无限都能稳拿一笔，攒门槛只需要几次无限；
 *     · 单位时间的收入是常数 `60 × 2^①等级` 点/小时，不随深度膨胀，
 *       这条环因此天然稳定（详细推导见 RESPONSES/设计讨论）。
 *
 * ── ④ 的读法 ──
 *   每 60 秒累计 1 点（连续结算，不是每秒跳一次）。所以
 *     「一次 104 分钟的无限」= 104 点；「一次 5 分钟的无限」= 5 点。
 *   两者**每小时都是 60 点**（再乘 ① 的倍率）—— 收快收慢收益相同，
 *   想强制「多次无限」的话需要给 ④ 加耗时上限（当前没加，属待定项）。
 */
export const INFINITY_UPGRADES = {
  /**
   * ① 无限增幅 —— **最终乘区**（乘在所有 IP 来源之后）
   *
   * ★★ 2025 用户裁定：形态**照抄 AD 源码** `InfinityUpgrade.ipMult` ⇒ 效果 `×2/级`（= `2^等级`）。
   *   唯一的实现在 `ipDoubleMult()`；显示侧（engine.js 的 `infinityUpgradeEffect`、
   *   ui.js 的收入明细）**都必须调它** ⇒ 防止再出现"显示 ≠ 实发"✗
   *
   *   职责：负责「1e280 基础值 → 1e308.25」那 **28.25 阶**（需 93.8 级）。
   *   节流：**只封价格、不封效果**（见 `IP_DOUBLE_AD`），与 AD 的 `costCap` 同思路。
   *
   *   ⚠️ 价格 `firstCost/costMult` 是在"线性版"时代标定的（首价 1、每级 ×10），
   *      换成 `2^等级` 后**必须重新标定**（否则 24 档阶梯会被 IP 侧打穿）——
   *      实测数据见 `tools/stage-timing.mjs`。
   */
  ipDouble: {
    id: "ipDouble",
    name: "无限增幅",
    repeatable: true,
    firstCost: 1,
    costMult: 10,
    /** ★ = AD 的 `DC.D2`（效果底数，`ipDoubleMult()` 与 `ipDoubleLogCost()` 共用） */
    effectMult: 2,
    zone: "ip",
    desc: "无限点收益 ×2/级（最终乘区：乘在所有来源之后）" },

  /** ② 无限点数量 → ZPE 倍率的**加法区**（a区） */
  /**
   * ★ 量子铸币（用户提案）：**单次 100 无限点**，之后每次大坍缩额外获得
   *   `floor(本次无限最大量子数 ^ power)` 点无限点（`power` 见升级定义；2026 由 2 调成 **1.75**）。
   *
   * 为什么需要它（诊断依据，`tools/stage-timing.mjs --profile`）：
   *   打破无限后 ④ 收入只有 540~1620 点/小时，而铸币起步价 1e4 ⇒ **24 小时买不到一级铸币**，
   *   阶梯的"种子"根本攒不出来。这一条把「ZPE → 量子 → 无限点」接通，
   *   正好补上种子（实测 q≈83 时给 **2282** 点 ≈ 起步价量级；`^2` 时代是 6889）。
   *
   * 安全性：q 的成长受量子门槛（每次 ×20）限制，`q ≈ 2·log20(ZPE)` ——
   *   所以 `q^power` 只随 `log^power(ZPE)` 增长，**是种子而不是 runaway**
   *   （q=138 时 `^1.75` 给 5556；`^2` 时代是 19043）。
   */
  /**
   * 门槛压平：量子门槛步长 ×20 → ×10（原稿候选 11；现在能放大 q² 收益）
   *
   * ★ 2025 追加职责：它同时是**跨度层的开关**（用户方案，见 docs/R-REPLACEMENT.md §11）。
   *   买下时记下当时的暗能量水位 `state.spanDeBase`，此后
   *   `物质产出 ×= (DE / spanDeBase)^k`，其中 `k = min(1 + c·√q, 6.1651)`。
   *
   *   为什么用它当开关：它是 ∞ 层升级 ⇒ 天然"打破无限之后"（早期不激活）；
   *   而且它本身就是量子相关的升级，与"k 由量子给"语义一致。
   *
   * ⚠️ 价格与门槛是**两个独立旋钮**：
   *   · 价格（现 128 IP）只影响"多久买得起"；
   *   · 门槛 `brokenInfinity`（在 `buyInfinityUpgrade` 里强制）保证"何时**可以**买"。
   *   用户仍在权衡价格（10 / 50 / 128），但门槛语义与价格无关 ⇒ 先上后调。
   */
  thresholdFlat: {
    id: "thresholdFlat",
    name: "门槛压平",
    cost: 128,
    desc: "量子门槛步长 ×20 → ×10，并开启跨度层",
    zone: "dm" },
  /** 涨落增幅：每对量子 +2 → +3（原稿候选 10） */
  pairBoost: {
    id: "pairBoost",
    name: "涨落增幅",
    cost: 5,
    desc: "每对量子 2 → 3",
    zone: "dm" },
  /**
   * 未花 IP 加产率（原稿候选 15，AD `unspentBonus` 同源）：a区 产率按**未花无限点**提升。
   *
   * ⚠️ **必须有硬上限**（用户指定：影响永恒阶段的东西要有极强软上限）。
   *    AD 原式 `(IP/2)^1.5 + 1` 单独看很危险：IP 到 1e308 时它是 1e462，
   *    物质爬升会被瞬间抹平（整条 24h 阶梯失去意义）。所以这里**封顶 ×1000**：
   *    它只在"攒铸币种子"的那几个小时里起作用，之后恒定 —— 定位是**种子**，不是 runaway。
   */
  // ⚠️ `unspentBoost`（沉潜蓄能）已整条删除（2025 用户裁定）—— 见上方 `unspentBoostMult` 的删除说明
  ipFromQuantum: {
    id: "ipFromQuantum",
    name: "量子铸币",
    cost: 100,
    /**
     * ★★★ 收益指数（**唯一数据源**，`quantumToIPGain` 读它）。
     * ⏳ 2026 平衡：用户报「效果有点过于强了，`^2` 改成 `^1.75` 差不多」⇒ 2 → **1.75**
     * ⚠️ 它是**分数幂** ⇒ 走 `Decimal.pow`（有 ~1e-15 相对误差）；改回整数时会自动走精确路径 ✓
     */
    power: 1.75,
    desc: "大坍缩收益 +本次最大量子数^1.75",
    zone: "ip" },
  ipToZpe: {
    id: "ipToZpe",
    name: "零点耦合",
    cost: 1,
    perIp: 1,
    zone: "zpe",
    desc: "ZPE 倍率 += 无限点数量" },

  /** ③ 无限点 → 相变仪转换速率（ZPE → 暗能量） */
  ipToTransmuter: {
    id: "ipToTransmuter",
    name: "相变超频",
    cost: 1,
    perIp: 0.5,
    zone: "de",
    desc: "相变仪速率 ×(1 + 无限点×0.5)" },

  /** ④ 每次无限的**耗时**换成无限点（每 60 秒 1 点） */
  ipTime: {
    id: "ipTime",
    name: "无限长河",
    cost: 3,
    /** 每多少秒给 1 点 */
    secondsPerPoint: 60,
    /**
     * 耗时上限（秒）：**1800 = 30 分钟**。
     *
     * 为什么要它：没有上限时"收快收慢每小时都是 60 点"，速度类升级（速率解放/起点跃迁）
     * 对 IP 收入完全没有意义。加上限后 `IP/小时 = 60 × 3^① × min(T,1800)/T`：
     *   · 单次 ≤ 30 分钟 → 吃满；
     *   · 单次 100 分钟（现状）→ 只有 30%。
     * 于是"把单次无限压进 30 分钟"变成明确目标（AD 的同类做法也是给上限而不是无限膨胀）。
     * 沙盒实测代价很小：打破无限 4.1h → 4.8h。
     */
    capSeconds: 1800,
    zone: "ip",
    desc: "每秒实时获得「1 ÷ 60」点（吃 ① 的加成），单次最多计 30 分钟" },

  // ══════════════════════════════════════════════════════════
  // ★ 加速「e25 → e308.25」那一段的两条线
  //
  //   为什么要专门为这一段加升级：这段原先的斜率 = R（已退休）—— 现在它们抬的是 `b`（粒子增幅速率）。
  //   而 a区 的产率升级对它完全无效（基础环比指数项小 1e200 倍，实测过）。
  //   所以只有两个真杠杆：**抬 R 的上限** 与 **缩短距离（抬高开局物质）**。
  //   量化（tools/infinity-sim.mjs / _sim 沙盒对齐过）：
  //     · 速率类：`t ∝ 1/R₀`，每 +10% → 单次无限 −9%
  //     · 起点类：从 1e25 提到 1e200 → 单次无限 −39%（在爬升衰减开启后）
  // ══════════════════════════════════════════════════════════

  /**
   * 起点跃迁 I~IV：**每次大坍缩之后**以指定的物质开局（AD `skipReset*` 的同源设计）。
   *
   * ⚠️ 只抬高"起点"，不改变上限 —— 所以它不改形，只缩短距离。
   *    数值用**绝对深度**（1e50/1e100/1e150/1e200），与最终的爬升衰减参数无关。
   */
  start50: { id: "start50", name: "起点跃迁 I", cost: 20, startLog10: 50, zone: "matter", desc: "每次大坍缩后以 1e50 物质开局" },
  start100: { id: "start100", name: "起点跃迁 II", cost: 40, startLog10: 100, zone: "matter", desc: "每次大坍缩后以 1e100 物质开局" },
  start150: { id: "start150", name: "起点跃迁 III", cost: 80, startLog10: 150, zone: "matter", desc: "每次大坍缩后以 1e150 物质开局" },
  start200: { id: "start200", name: "起点跃迁 IV", cost: 300, startLog10: 200, zone: "matter", desc: "每次大坍缩后以 1e200 物质开局" },

  /**
   * 速率解放 I~IV：抬 `b`（粒子增幅速率）的倍率 —— R 退休前它们抬的是 R 的上限。
   *
   * ⚠️ 用**百分比**而不是绝对值，这样最终 R₀ 定成多少都自动跟随 ——
   *    避免"改了 knee/D 以后这几条升级的数值全要重算"。
   */
  rate110: { id: "rate110", name: "速率解放 I", cost: 10, rateMult: 1.10, zone: "dm", desc: "粒子增幅速率 b ×1.10" },
  rate121: { id: "rate121", name: "速率解放 II", cost: 100, rateMult: 1.10, zone: "dm", desc: "粒子增幅速率 b ×1.10" },
  rate139: { id: "rate139", name: "速率解放 III", cost: 1000, rateMult: 1.15, zone: "dm", desc: "粒子增幅速率 b ×1.15" },
  rate167: { id: "rate167", name: "速率解放 IV", cost: 10000, rateMult: 1.20, zone: "dm", desc: "粒子增幅速率 b ×1.20" } };

/**
 * 无限升级的展示顺序（UI 与自检共用）。
 * UI 会把它排成 2×n 网格，所以顺序就是格子顺序（左→右、上→下）。
 */
export const INFINITY_ORDER = [
  "ipFromQuantum", "thresholdFlat", "pairBoost",
  "ipDouble", "ipToZpe",
  "ipToTransmuter", "ipTime", 
  "start50", "start100",
  "start150", "start200",
  "rate110", "rate121",
  "rate139", "rate167",
];


/** 大坍缩能拿多少无限点 */
export function infinityPointGain(matter, broken, state = null) {
  const m = matter instanceof Decimal ? matter : new Decimal(matter ?? 0);
  if (!broken) return new Decimal(BREAK_INFINITY.firstCrunchIP);
  const maxLog = Math.log10(Number.MAX_VALUE);
  const depth = m.gt(0) ? m.log10().div(maxLog) : new Decimal(0);
  if (depth.lte(0)) return new Decimal(BREAK_INFINITY.firstCrunchIP);
  /**
   * ★ 深度复利（2025 用户方案，见 docs/PROGRESSION.md 与 tools/infinity-ladder-lab.mjs）：
   *
   * `IP = floor( (L/308.2547)² · 10^(c·(L − 过载拐点)) )`
   *
   * · 前半是**现状**（G3 的"故意设计"内核保留：IP **只来自深度**）✓
   * · 后半是新增的**深度复利**：过载解除硬顶后，越推越深 ⇒ 每阶 ×10^c ✓
   * · `c ≈ 0.035` 由模型反解（让 128 IP 落在 **3 次**深坍缩内）——
   *   而"3 次"不是拍脑袋：`b` 的硬封顶 0.02 使 N≥4 在数学上做不到 ✓
   *
   * 为什么必须加它：IP/次 恒为 1 时，128 IP 要 **128 次**大坍缩，
   * 与"×1.75 标尺 + 慢速大坍缩"**根本冲突**（`infinity-ladder-lab` 有断言）。
   */
  const excess = m.log10().sub(BREAK_INFINITY.maxLog10).max(0).toNumber();
  // ★★ 2025（用户方案 c，甲档）：**深度软上限** —— 治"一次坍缩直接通关" ✗
  //
  //   病：破∞后上限解除 ⇒ excess 可以无限涨（实测能到 8800 阶 ✗）
  //       ⇒ 单轮 IP = 10^(0.0035×8800) = 1e308 ⇒ **一次坍缩越过永恒门槛** ✗（实测 16 秒 ✗）
  //   药：超出 knee 的部分按**同族形状**压紧（与「过载」同一个 `2^(−超出/跨度)` ✓）
  //       excess_eff = knee + (excess−knee)·2^(−(excess−knee)/span)   上界 = knee + span/ln2 ✓
  //   效果：单轮 IP **被封顶** ⇒ 次数 = 门槛/单轮收益 ⇒ 次数与时长都可控 ✓
  //       `knee=10 / span=20` ⇒ 上界 ≈ 38.9 阶 ⇒ 单轮 ≈ 1e0.14 ⇒ 约 **2267 次 × 11 秒 ≈ 6.9 h** ✓
  //       （拉表见 `tools/post-break-runaway-lab.mjs` 的同族表 + 本轮对话的 (c) 表 ✓）
  //   ⚠️ 浅挖（excess ≤ knee）**完全不受影响** ✓ ⇒ 破∞前的经济与手感一字未动 ✓
  // ★ 2025：**深度复利已删除**（D6 废弃 ✗）—— IP 回到基线 `floor((L/308.2547)²)`，
  // ★ 2025 用户要求：与 **AD 源码**保持基本一致（game.js:86 `gainedInfinityPoints`）
  //    AD:  IP = floor( 10^( log10(maxAM) / div − 0.75 ) × 乘数们 )   div 默认 308、可被来源压低
  //    我们: 同一形状 ✓ 除数走 `ipDivisor(state)` ✓（保留未来升级"调用与影响"的权力 ✓）
  const div = (state && typeof ipDivisor === "function") ? ipDivisor(state) : BREAK_INFINITY.maxLog10;
  const L = m.log10();
  return Decimal.pow(10, L.div(div).sub(0.75)).mul(BREAK_INFINITY.ipBase ?? 1).floor().max(1);
}

/** 大坍缩阈值（Decimal）—— 用 pow 构造，保住小数指数 */
export function crunchThreshold() {
  return Decimal.pow(10, BREAK_INFINITY.maxLog10);
}

/**
 * 无限点 → 效果（暂定，用户说之后再调）。
 * 现在是纯计数 + 解锁「打破无限」+ 四个无限升级（见 INFINITY_UPGRADES）。
 */
export function infinityPointEffect(ip) {
  const n = ip instanceof Decimal ? ip : new Decimal(ip ?? 0);
  return { count: n };
}

/**
 * 无限升级的价格（**唯一数据源**）。
 *
 * UI 显示的和引擎扣的必须走这一个函数 —— 这是 consistency.mjs 的硬要求，
 * 也是「显示 vs 实际」那类 bug 的唯一防法。
 *
 * @returns {Decimal} 价格（可重复升级按当前等级算）
 */
export function infinityUpgradeCost(state, id) {
  const cfg = INFINITY_UPGRADES[id];
  if (!cfg) return new Decimal(0);
  if (cfg.repeatable) {
    // ★ ①「无限增幅」走**分段软上限**（用户指定：影响永恒阶段的东西必须有极强软上限）。
    //   60 级前与老的 `10^等级` 完全一致；之后每级涨价 ×100、再 ^1.5。
    // ⚠️ 约定：`ipDoubleLevel` **必须是 `Decimal`**。三条路都保证这一点：
    //   `newState` 的 `D(0)` / `deserialize` 的 `dec()` / 引擎的 `D(before).add(k)` ✓
    //   （我写性能复现脚本时顺手赋了个普通 `30` ⇒ 这里当场抛 TypeError —— 是**脚本违约**，
    //     不是代码 bug ⇒ 所以**不放宽**这里的类型要求，否则约定就模糊了 ✗）
    const lv = (state.ipDoubleLevel ?? new Decimal(0)).toNumber();
    return new Decimal(10).pow(ipDoubleLogCost(lv));
  }
  return new Decimal(cfg.cost ?? 0);
}

/** 该无限升级已经买了吗（可重复的返回等级 > 0） */
/**
 * 这条 ∞ 升级**买过没有**。
 *
 * ⚠️ 踩过的坑（本轮）：加一次性升级时只写了购买分支的 `state.xxxBought = true`，
 *    **忘了在这里登记** ⇒ `buyInfinityUpgrade` 的"已买就不再卖"判断失效，
 *    同一升级会被**无限次重复购买**（每次 5/50/100 IP）。
 *    实测后果：打破无限后的 IP 池永远停在个位数（钱全被重复购买吃掉），
 *    "种子"永远攒不出来 —— 整条阶梯因此卡死。
 */
export function infinityUpgradeOwned(state, id) {
  const cfg = INFINITY_UPGRADES[id];
  if (!cfg) return false;
  if (cfg.repeatable) return (state.ipDoubleLevel ?? new Decimal(0)).gt(0);
  if (cfg.startLog10 != null) return (state.startBought ?? {})[id] === true;
  if (cfg.rateMult != null) return (state.speedBought ?? {})[id] === true;
  if (id === "ipToZpe") return state.ipToZpeBought === true;
  if (id === "ipToTransmuter") return state.ipToTransmuterBought === true;
  if (id === "ipTime") return state.ipTimeBought === true;
  if (id === "ipFromQuantum") return state.infinityFromQuantumBought === true;
  if (id === "thresholdFlat") return state.thresholdFlatBought === true;
  if (id === "pairBoost") return state.pairBoostBought === true;
  return false;
}

/**
 * 「起点跃迁」当前生效的开局深度（对数）。没买就是 0（= 从 0 开始，原样）。
 * 取**已买里最高的一档**（它们是递进的，不是相加的）。
 */
export function infinityStartLog10(state) {
  let best = 0;
  for (const cfg of Object.values(INFINITY_UPGRADES)) {
    if (cfg.startLog10 == null) continue;
    if ((state.startBought ?? {})[cfg.id] === true && cfg.startLog10 > best) best = cfg.startLog10;
  }
  return best;
}

/** 「速率解放」对量子成长速率上限的总倍率（各档相乘） */
/**
 * ★★ 2025：**坍缩加速器（CRUNCH_ACCEL）已整个删除**（用户裁定）
 *
 * 用户理由（原话）：「原则上坍缩加速机制也不该在这里。我的结论是直接删。
 *                  否则会对机制解读有极大污染」
 *
 * 它原本是"花无限点直接买时间"（每级成长速率 ×1.02、硬封顶 ×2），
 * 与同一批被删的机制同源：
 *   · 它是 **IP → 成长速率** 的平行环（和铸币 IP→IP 一样，不推动物质）；
 *   · 它的叙事（"把 24h 档压到 18h"）是**旧标尺**（×1.75）时代的产物，
 *     而正确标尺是 `AD WR × 1.0526`（见 PROGRESSION §2.0）⇒ 叙事本身已失据；
 *   · 与「速率解放」「档位 rate 里程碑」**共用一个入口**（infinityRateMult），
 *     三者在界面上无法分辨"谁在起作用" ⇒ 机制解读被污染。
 *
 * 移除后 `infinityRateMult` = ∞ 层「速率解放」各档 × 档位 rate 里程碑（`tierRateMult`）。
 */

/**
 * 无限升级「速率解放」（`rateMult`）的**合并倍率** = ∞ 层已买的档位 × 档位 rate 里程碑。
 *
 * ★ 单一数据源：`infinityRateMult(state)` 是"改速率"类机制的**唯一**入口（R 退休后它改的是 `b`），
 *   所以任何"改成长速率"的机制都必须并进这里，不许各写各的（否则会漏乘）。
 */
export function infinityRateMult(state) {
  let m = new Decimal(1);
  for (const cfg of Object.values(INFINITY_UPGRADES)) {
    if (cfg.rateMult == null) continue;
    if ((state.speedBought ?? {})[cfg.id] === true) m = m.mul(cfg.rateMult);
  }
  return m.mul(tierRateMult(state));
}

/**
 * ④「无限长河」的**实时**产点速率（点/秒）。
 *
 * 设计参考：AD 的同类升级（`ipGen` / 被动产点）是**实时生成**的，不是每次结算时一次性给。
 * 所以这里也改成实时：`tick` 每帧按这个速率进账，**总量公式不变**
 * （单次无限累计 = `min(耗时, 上限) ÷ 60 × 3^①等级`）。
 *
 * 好处：挂机期间点就在账上（不必等大坍缩才入账），
 * 而且"把单次压进 30 分钟"这个目标从"结算时才算"变成屏幕上的实时数字。
 */
export function timeIPPerSecond(state) {
  // ★ 用户 2025 裁定：**无限长河停产**（本函数只留壳 ✓ 效果等同删除 ✗）
  //   ⚠️ 2026：这里原来写「破∞后的 IP 改由**无限挑战（8 关，每关 +38.53 阶）**提供」——
  //     **IC 已被用户删除** ⇒ 那句话不再成立 ✗
  //     现在破∞后的 IP 由 ④ 深度收益 + 量子铸币 + ① 无限增幅 等提供（见 `bigCrunchGain`）✓
  // ⏸ 待定 → 2025 用户解冻 ✓（保留用户定的**上限 1 IP/分钟** ✓）
  const raw = ipDoubleMult(state)
    .div(INFINITY_UPGRADES.ipTime.secondsPerPoint);
  return Decimal.min(raw, new Decimal(1).div(60));   // 上限 1 IP/分钟 ✓
}

/** ④ 单次无限的**可计时长上限**（秒）：超出部分不产点 —— 它是给"速度"定的靶子 */
export function timeIPCapSeconds() {
  return INFINITY_UPGRADES.ipTime.capSeconds ?? Infinity;
}

/**
 * ④ 单次无限（按耗时）**应得的总量** —— 实时进账的就是这个总量，只是拆成每帧发。
 *
 * ⚠️ 保留它是为了让工具/断言能直接验"总量"。**大坍缩不再调用它**
 *    （那时耗时部分早已实时发完，再发一次就是重复发放）。
 */
export function timeInfinityPointGain(state, seconds) {
  // ★ 用户 2025 最终裁定：**无限长河整体废弃** ⇒ 本函数同样停产（tick 走的就是它 ✗）
  if (!state.ipTimeBought) return new Decimal(0);
  // ⏸ 待定 → 解冻 ✓（同上限 ✓）
  const rawTotal = new Decimal(counted).div(INFINITY_UPGRADES.ipTime.secondsPerPoint)
    .mul(ipDoubleMult(state));
  return Decimal.min(rawTotal, new Decimal(counted).div(60));   // 1 IP/分钟 ✓
}

// ══════════════════════════════════════════════════════════
// ★ 无限点公式的**除数（div）**—— 保留"调用与影响"的权力（用户 2025 明确要求 ✓）
//
//   对齐 AD 源码（game.js:86 `gainedInfinityPoints`）：
//       const div = new Decimal(Effects.min(308, Achievement(103), TimeStudy(111))).toNumber();
//   ⇒ AD 的机制是：**多个来源各自给出一个候选除数，取其中最小者** ✓
//
//   本函数照搬这个机制 ✓：
//       ipDivisor(state) = min(基准 308.2547, 各来源候选值...)
//   ⇒ 未来的升级/里程碑只要往 `IP_DIVISOR_SOURCES` 里加一条候选 ✓ 即可生效 ✓
//      （不需要改公式、不需要改调用点 —— 这就是"保留调用与影响权力"的落地 ✓）
//
//   ⚠️ 目前所有候选都**未接线**（pending ✓）⇒ ipDivisor 恒等于基准 308.2547
//      ⇒ 零回归 ✓（公式现状不受任何影响 ✓）
// ══════════════════════════════════════════════════════════

/** 各来源给出的候选除数（越小 ⇒ 同样物质给越多 IP ✓）。pending 表示尚未接线。 */
export const IP_DIVISOR_SOURCES = [
  // { id: "em1", when: (s) => hasEternityMilestone(s, "em1"), value: 250, pending: true },
  // { id: "upg-x", when: (s) => hasUpgrade(s, "x"), value: 210, pending: true },
];

/** ★ 无限点公式的除数（唯一入口 ✓ 未来所有相关升级都改这里 ✓） */
export function ipDivisor(state) {
  let best = BREAK_INFINITY.maxLog10;                     // 基准 = log10(Number.MAX_VALUE) = 308.2547 ✓
  for (const src of IP_DIVISOR_SOURCES) {
    if (src.pending) continue;
    let ok = false;
    try { ok = !!src.when(state); } catch { ok = false; }
    if (ok) best = Math.min(best, src.value);
  }
  return best;
}

/** 供工具/界面直接问"这个来源现在生效吗" ✓ */
export function ipDivisorBreakdown(state) {
  const rows = [{ id: "base", value: BREAK_INFINITY.maxLog10, active: true }];
  for (const src of IP_DIVISOR_SOURCES) {
    let ok = false;
    if (!src.pending) { try { ok = !!src.when(state); } catch { ok = false; } }
    rows.push({ id: src.id, value: src.value, active: ok, pending: !!src.pending });
  }
  return { divisor: ipDivisor(state), rows };
}

// ══════════════════════════════════════════════════════════
// ⚠️ 2026 **已删除**：`IC_MODS` 与 `icMod()` ——
//   它们是「IC 挑战中把引擎**生效等级**压低到 1」的修饰器（用户 2025 选的 β 方案，
//   落在"第 5 关 = 无引擎修行关"）。
//   **IC 整个系统被用户删除** ⇒ 再也没有"挑战态" ⇒ 修饰器永远是 null ⇒ 纯死代码 ✗
//
//   ⇒ `effectiveEngineLevel()` **保留**（它是"看引擎效果"的唯一入口，多处依赖），
//     但内部不再查修饰器，直接返回真实等级 ✓
//   ⚠️ 不要因为"现在它等于 zpeEngineLevel"就把 `effectiveEngineLevel` 删掉 ——
//     它的价值是**收口**：以后若有类似修饰器，只改这一处 ✓
// ══════════════════════════════════════════════════════════

/** ★ 引擎的**生效等级**（唯一入口 ✓）—— 2026 起没有修饰器，恒等于真实等级 ✓ */
export const IP_DOUBLE_AD = {
  base: new Decimal(10),                    // AD: `costIncrease = 10`（浅指数段）
  stepShallow: new Decimal(10),             // AD: 步长 ×10  ← **用户裁定：每级 ×10**
  stepSteep: new Decimal(1e10),             // AD: 门槛后步长 ×1e10
  // ★★★ 2025 修正（用户报告：「6 级准备买 7 级要 1e16」）——
  //   **原来的 1e6 门槛太低，让"陡段"从第 5 级就开始** ✗
  //   实测（`ipDoubleCost`，门槛=1e6 ⇒ purchasesAtIncrease=5）：
  //     L0~5 ⇒ 1e1 / 1e2 / 1e3 / 1e4 / 1e5 / 1e6   ← 浅段（每级 ×10 ✓）
  //     L6   ⇒ **1e16**（不是 1e7！）← 已进陡段：`10^6 × 1e10^1`
  //     L7   ⇒ 1e26｜L8 ⇒ 1e36                 ← 每级 ×1e10
  //   ⇒ 用户看到的 1e16 是**照 AD 公式的正确输出**，错的是**门槛值**（AD 用 1e3e6，
  //     我上一轮擅自改成 1e6，导致浅段只有 5 级）✗
  //   改动：门槛 1e6 → **1e31**（⇒ 浅段到第 30 级，每级 ×10，与用户预期一致）
  //     L6 ⇒ 1e7 ✓｜L20 ⇒ 1e21 ✓｜L29 ⇒ 1e30 ✓｜L30 起进陡段
  costIncreaseThreshold: new Decimal("1e31"),
  // ★★★ 2025 **`costCap` 已彻底删除**（用户裁定：「costCap 函数要不你彻底删了吧」）✓
  //
  // ── 为什么删（三步走，前两步都错）──
  //   ① 原来：`costCap = 1e320`，探针在"价格 ≥ cap"时**整段跳过** ⇒ 可买级数被钉在 **Lv59** ✗
  //   ② 我改成"平台"（价格 `min(10^log, cap)`）⇒ 仍然被钉住，只是换了形式：
  //      封顶后每级恒收 1e320 ⇒ **池 < 1e320 就一级都买不了** ✗
  //      实测：池 1e320 ⇒ 买满 59 级（看起来还是"卡 59"）｜1e325 ⇒ 330 级｜1e400 ⇒ 405 级
  //   ③ **它其实没在防任何东西**：`10^n` 在 `n ≥ 309` 就超过 `Number.MAX_VALUE`，
  //      而 `Decimal.pow` 自己处理 e308 以上（返回合法的 Decimal，不是 Infinity）
  //      ⇒ `costCap` 从未阻止过溢出，它**唯一的实际作用就是把可买级数砍掉** ✗
  //   ⇒ 删掉它：价格 = `10^ipDoubleLogCost(n)`，**不封顶** ✓
  //      可达等级本来就有天然上界：`n ≈ log10(池)/10`，而池 ≤ 永恒门槛 1e308.25 量级
  //      ⇒ `n ≤ 几十~几百`，价格到 `1e10n`，**远在 `Decimal` 的 e9e15 范围内** ✓
  get purchasesAtIncrease() { return this.costIncreaseThreshold.log10().toNumber() - 1; },
};

/**
 * 下一级价格。
 *
 * ★★★ 2025（用户裁定）：**必须与 `ipDoublePriceAt` 同源**。
 *   原来这里写死 `stepShallow^(count+1)`（= AD 的 `10^(count+1)`）⇒ 首价 **10** ✗
 *   用户裁定首价应为 **1**（"购买时 1 级"），序列 `1 → 1 → 10 → 100 → 1000 …`
 *   ⇒ 本函数改为**直接调 `ipDoublePriceAt`**（单一实现，两处不会再脱节 ✓）
 *   ⚠️ 踩过同一类坑多次：「显示 ≠ 实发」几乎都源于**同一个公式写了两遍**。
 */
export function ipDoubleLogCost(level) {
  const n = Math.max(0, Number(level) || 0);
  // ★ 第 1 级（count=0）：固定 1 点（用户裁定）
  if (n <= 0) return 0;                                                // 10^0 = 1 ✓
  // ⚠️ 2026：ipDouble 的 knee 奖励（d6 全清 ×3）**尚未接** —— 这两个函数没有 state 形参，
  //   硬塞会 ReferenceError ✗ 要接必须先改签名（会连锁到 6 个以上调用点）⇒ 记入 TODO ✓
  const inc = IP_DOUBLE_AD.purchasesAtIncrease;
  // ★ 第 2 级起：`10^(n−1)` ⇒ n=1→1、n=2→10、n=3→100 …（与用户给的序列一致 ✓）
  if (n < inc) return Math.log10(10) * (n - 1);
  const thr = IP_DOUBLE_AD.costIncreaseThreshold.log10().toNumber();
  return thr + (n - inc) * Math.log10(1e10);                           // AD: 门槛 × 1e10^超出
}

/**
 * ① 的**真实单级价格**（Decimal）。
 *
 * ⚠️ 为什么必须单独有它（不能到处写 `10^ipDoubleLogCost(lv)`）：
 *   上面的 log 形式**表达不了第 1 级的 1 点**（`10^0 = 1` 恰好对，但
 *   `ipDoubleAffordableIn` 里还要拿"本级价格"做等比数列求和，写两遍必错 ✗）
 *   ⇒ 单一实现，求和处一律调它 ✓
 */
/**
 * ★★★ 2025 **修 bug**（用户报：「无限增幅在 IP 超越 e308.25 后没法买满」）。
 *
 * ── 症状 ──
 *   池 1e5000 也只能买到 **Lv59**，而且**只用掉池子的极小一部分就永久停止** ✗
 *
 * ── 根因与最终修法（走了三步，前两步都错，记档）──
 *   ① 原实现：`costCap = 1e320`，探针在"价格 ≥ cap"时**整段跳过** ⇒ 恒返回 59 ✗
 *   ② 我改成"平台"（价格 `min(10^log, cap)`）⇒ **仍然被钉住**：
 *      封顶后每级恒收 1e320 ⇒ 池 < 1e320 时**一级都买不了**（用户实测"还是卡 59"）✗
 *   ③ **删除 `costCap`**（用户裁定）：价格**不封顶** = `10^ipDoubleLogCost(n)` ✓
 *      —— 它本来就没在防溢出（`10^n` 在 n≥309 就超 `Number.MAX_VALUE`，
 *         而 `Decimal.pow` 自己处理 e308 以上；可达等级 ≈ `log10(池)/10`，
 *         价格上限远在 `Decimal` 的 e9e15 内）⇒ 它**唯一的作用就是砍可买级数** ✗
 */
export function ipDoublePriceAt(level) {
  const n = Math.max(0, Number(level) || 0);
  return new Decimal(10).pow(ipDoubleLogCost(n));
}

/**
 * ★★★ 2025 终稿（用户裁定 **方案甲**）：**引擎等级对「量子加成」的乘数**。
 *
 *   ── 形状：与「引擎累计价」同速（不是与等级同速）──
 *     `engineBonusMult(lv) = Σprice(0→lv) / Σprice(0→基准级)`
 *
 *   ── 为什么不是 `bonusGrowth^等级`（我上一版，实测失败 ✗）──
 *     那版每级只给 ×1.22（`ZPE_ENGINE.bonusGrowth`），而价格每级 ×1.872
 *     ⇒ **收入涨得比价格慢** ⇒ 引擎停在 116 级再也买不起（实测：每轮收入 1e30 vs 下一级价 1e32）✗
 *
 *   ── 为什么"与累计价同速"能自付（这是甲的核心）──
 *     买下一级要付 `price(lv)`；而付完之后乘数变成 `Σ(0→lv+1)/Σ(0→基准)`
 *     ⇒ 乘数**相对**增加 `1 + price(lv)/Σ(0→lv)` —— 恰好是"你刚付掉的那笔占累计的比例"
 *     ⇒ 收入按同比例上升 ⇒ **这一笔买卖恰好自付** ⇒ 等级可以一路涨 ✓
 *
 *   ── 用户提醒的代价（2025 原话）──
 *     「越过满速阈值后，后续生效的强度和等级的比例，需要更多等级才能 = 未越过阈值时的比例」
 *     即：价格是**指数**的（`×costGrowth`/级）⇒ 后期**每级越来越贵**，
 *     而乘数按累计价同速涨 ⇒ **同等"强度增量"需要越来越多的等级** ✓ 这是有意的（软上限语义）。
 *
 *   ── 落点：**乘在量子加成上**（用户裁定"全部"）──
 *     量子 → 熵 / 暗能量倍率 / 暗能量获得 / ZPE加法区 / IP 收入 五条**全部**乘它。
 *     ⚠️ 但**不在 `config.js` 的 5 个函数体内乘**（它们只收 `quantum` 参数、拿不到 state；
 *        且在体内乘会让 `audit.mjs` 的 `quantumDeMultBonus(q)===10000` 类断言失效、
 *        并污染 UI 量子面板的显示）⇒ 在 `formulas.js` 的**调用处**乘 ✓
 */
export function ipDoubleAffordableIn(level, poolDecimal) {
  const lv0 = Math.max(0, Number(level) || 0);
  // ⚠️ 2026：ipDouble 的 knee 奖励（d6 全清 ×3）**尚未接** —— 这两个函数没有 state 形参，
  //   硬塞会 ReferenceError ✗ 要接必须先改签名（会连锁到 6 个以上调用点）⇒ 记入 TODO ✓
  const inc = IP_DOUBLE_AD.purchasesAtIncrease;
  // ★ `costCap` 已删除（用户裁定）⇒ 这里不再读它 ✓
  const pool = poolDecimal instanceof Decimal ? poolDecimal : new Decimal(poolDecimal ?? 0);
  if (!pool.gte(ipDoublePriceAt(lv0))) return 0;

  /**
   * ★★★ 2025 修正（用户报「永恒增幅价格消耗不对」后连带排查）：
   *   原来第 1 段是「**解析上界直接当答案**，只在买不起时才逐级回退」——
   *   而 `Math.floor` 的上界在浮点边界上会**低于真值**，回退循环只会往下调
   *   ⇒ 永远找不到真值。实测：池 1e30 时探针说 30 级，**逐级真值只能买 25 级** ✗
   *   （而且第一段还被 `inc` 级封顶 ⇒ 上界一旦低于真值就直接错）
   *   ⇒ 现在两段都用**同一套**：解析上界（`ceil` + 缓冲 ⇒ 只高估）＋ **逐级核减到真值** ✓
   *      逐级核减是 O(k) 的真价累加，而 k ≤ 几百 ⇒ 开销可忽略
   */
  const countFrom = (startLv, avail) => {
    if (!avail.gte(ipDoublePriceAt(startLv))) return { n: 0, spent: new Decimal(0) };
    // ① 解析上界（把序列当纯等比，首项 A = 本级价/10、比值 10）
    //    ⚠️ 必须 `ceil` + 缓冲：让"上界只会**高估**"这条前提真的成立 ✓
    const A = ipDoublePriceAt(startLv).div(10);
    let kUB = A.gt(0) ? Math.ceil(avail.mul(9).div(A).add(1).log10().toNumber()) + 2 : 0;
    if (!Number.isFinite(kUB) || kUB < 1) kUB = 1;
    kUB = Math.max(1, Math.min(kUB + 2, 20000));   // 硬上限：防极端池子撑爆循环（**不是**机制上限）
    // ② 逐级核减（真价累加）⇒ 精确的那个 n
    let spent = new Decimal(0);
    let n = 0;
    for (let i = 0; i < kUB; i++) {
      // ★ `costCap` 已删 ⇒ 这里**不再取 min**（那正是把可买级数钉在 Lv59 的东西之一）✓
      const p = ipDoublePriceAt(startLv + i);
      if (spent.add(p).gt(avail)) break;
      spent = spent.add(p);
      n++;
    }
    return { n, spent };
  };

  let lv = lv0;
  let left = pool;
  let total = 0;
  // ── 第 1 段：门槛以下（池子被 `costIncreaseThreshold` 截断，照抄 AD 的 clampMax）──
  if (lv < inc) {
    const usable = Decimal.min(left, IP_DOUBLE_AD.costIncreaseThreshold);
    const r = countFrom(lv, usable);
    const take = Math.min(r.n, inc - lv);
    total += take;
    lv += take;
    // 扣掉这一段真花的钱（`costFor` 口径与购买函数一致 ✓）
    if (take > 0) left = left.sub(ipDoubleCostFor({ ipDoubleLevel: lv - take }, take));
  }
  // ── 第 2 段：陡指数，直到价格撞封顶 ──
  //   ⚠️⚠️ 2025 修 bug（用户报「IP 超过 e308.25 后没法买满」）：
  //     原来这里是 `if (… && ipDoublePriceAt(lv).lt(cap)) { … total += Math.min(r.n, beforeCap) }`
  //     —— 两个截断叠在一起：
  //       ① 价格 ≥ cap ⇒ **整段跳过**（价格在 Lv59 到 cap ⇒ 从 Lv59 起恒返回 59）✗
  //       ② `beforeCap` 又把级数按"cap 之前的等比段长度"截一次 ✗
  //     ⇒ 实测池 1e5000 也只买到 Lv59、且只花掉极小一部分。
  //   ⇒ 现在价格**封顶成平台**（`ipDoublePriceAt` 里 `min(cap)`）⇒ 不再需要任何截断：
  //     `countFrom` 的逐级核减会自然地在"钱花完"处停下 ✓
  if (lv >= inc && left.gte(ipDoublePriceAt(lv))) {
    const r = countFrom(lv, left);
    total += r.n;
  }
  return total;
}

/**
 * ① 从当前级买 `k` 级的**总价**。
 *
 * ★★★ 2025（用户裁定改了首价序列）：**不再手抄等比求和**，改为
 *   **逐级累加 `ipDoublePriceAt`**（单一实现 ✓）。
 *
 *   ── 为什么放弃"分段等比公式"（原来那套）──
 *     它把序列形状（`10^(n+1)`）**又抄了一遍**（`div(9)` / `g=10` / 段边界），
 *     而首价一改（`10^(n−1)`）就得同步改三处系数 ⇒ 我当场就把 `div(9)` 抄错了 ✗
 *     （"同一个公式写两遍 ⇒ 显示/计算脱节"是这个项目的**头号病根**）
 *   ── 代价 ──
 *     只能在**需要具体总价**时用（例：UI 显示"买满要花多少"）。
 *     而"能买几级"走 `ipDoubleAffordableIn`（解析闭式，快）⇒ 两条路各司其职 ✓
 *     `k` 在这里只可能来自"买满按钮刚算出的级数"（≤ 门槛级数），量级很小 ✓
 */
export function ipDoubleCostFor(state, k) {
  const n = Math.max(0, Number(k) || 0);
  if (n <= 0) return new Decimal(0);
  const lv = Math.max(0, Number(state?.ipDoubleLevel ?? 0) || 0);
  let total = new Decimal(0);
  for (let i = 0; i < n; i++) {
    // ⚠️⚠️ 2025 修 bug（两步）：原来这里有 `if (c.gte(cap)) break;` ⇒ 总价半路截断 ✗
    //   后来我改成"平台"（`min(cap)`）⇒ **仍然被钉住**（池 < 1e320 时一级都买不了）✗
    //   ⇒ `costCap` 现已**彻底删除**：价格不封顶，逐级累加**真价**，
    //     与 `ipDoubleAffordableIn` 完全同源 ✓
    total = total.add(ipDoublePriceAt(lv + i));
  }
  return total;
}

/** 铸币等级上限（**档位闸门**：大坍缩次数 × 每档放行级数） */


/** 铸币等级 */


/** 铸币对**所有无限点收入**的倍率：`m^等级` */


/** 铸币第 N 级的价格（log10，分段软上限） */


/** 铸币下一级价格 */


/**
 * 铸币能买几级（**同时受档位闸门与软上限约束**）。
 * 闸门优先：`min(闸门剩余, 池子买得起的级数)`。
 */


/** 铸币总价（从 from 买到 to，Decimal） */


/**
 * ★ 档位里程碑（挂在**大坍缩次数**上）
 *
 * 设计意图（用户定的 24h → 18h）：
 *   总时长 = 档数 × 每次大坍缩耗时，而**每档兑现的阶数由 `capPerCrunch` 决定**。
 *   所以"档数压缩"不是把档数直接改小，而是**让每档上限随进度爬升**：
 *   30 → 33 → 36 → 41 → 46 ⇒ 同样的 306 阶需要的档数变少 ⇒ 阶梯自然压缩到 ~18 档。
 *
 * 另外两条：
 *   · `rate` —— 成长速率里程碑（每次大坍缩更快，与「速率解放」共用一个入口 `infinityRateMult`）；
 *   · `lube` —— **量子润滑（保守版）**：把量子门槛步长从 ×20 缓到 ×19.5。
 *     判据：`tools/crunch-speed-lab.mjs` 的 ⑦ 行显示"量子不足"惩罚很重（36.9h），
 *     所以先给一点点缓和；若实测仍然严重，再按用户说的"回到原方案"（给更多）。
 */
export function ipDoubleCost(state) {
  const count = Math.max(0, Number(state?.ipDoubleLevel ?? 0) || 0);
  return ipDoublePriceAt(count);
}

/** 效果 —— 照抄 AD 的 `effect: () => DC.D2.pow(player.IPMultPurchases)`（×2/级） */
export function ipDoubleMult(state) {
  const lv = Math.max(0, Number(state?.ipDoubleLevel ?? 0) || 0);
  return new Decimal(2).pow(lv);
}

// ══════════════════════════════════════════════════════════
// ★★ 暗能量**有效量**软上限（用户 2025 方案乙，起点 = 1e50 阶 ✓）
//   为什么不是"削速率"：速率被按比例削弱后仍是天文数字 ⇒ 一秒冲过几百阶 ✗
//   所以改为削**量**：  log10(DE_eff) = knee + span·(1 − 2^(−(log10 DE − knee)/span))
//     形状：单调递增 ✓ 上界 = knee + span ✓ 平滑 ✓（cap-monotonic-lab 的模板可直接断言 ✓）
//   ★ 关键：物质最多 ≈ (1e(50+span)/base)^k ⇒ **span 就是"破∞→永恒能走多远"的总闸** ✓
//   ⚠️ 必须保证仍能到 1e308.25（否则永恒不可达 ✗）：(50+span−baseLog)×6.1651 ≥ 308.2547
// ══════════════════════════════════════════════════════════
// ★★★ 2026（用户：「前期启动自动化后一整个逻辑都有问题」）——
//   实测：打开自动化后 `darkEnergy` 每分钟 ×1e33（10 分钟从 7e55 到 4e354 ✗）。
//   根因 = 「暗能量自增长」是**自指**的（收益 ∝ 自身存量）⇒ 时间上指数 ✗
//   而 `DE_EFF_CAP` 的 knee = 300 阶 **永远够不到** ⇒ 等于没开 ✗
//   ⇒ 把 knee 压到 **40 阶**、span 30 ⇒ 收益在 40 阶之后按 2^(-x/30) 衰减 ⇒ 收敛 ✓
// ★★★ 2026（用户裁定）：「允许暗能量**超越 e308.25**，但到那时被**超载机制**压制」——
//   ⇒ knee 就设在 **e308.25**（= 双精度上限，UI 里出现 ∞ 视为致命错误 ✗）
//   span 60 ⇒ 超过 knee 后每 60 阶减半 ⇒ 永远压得住，但**数值本身**仍可以 >1e308（break_eternity ✓）
export function quantumToIPGain(state) {
  if (!state.infinityFromQuantumBought) return new Decimal(0);
  const q = state.peakQuantumRun ?? 0;
  const n = q instanceof Decimal ? q : new Decimal(q);
  const p = Number(INFINITY_UPGRADES.ipFromQuantum.power ?? 2) || 2;
  // 非整数幂（当前 1.75）只能走 `.pow()`；整数幂一律走精确反复平方
  const v = Number.isInteger(p) ? powExactInt(n, p) : n.pow(p);
  return v.floor();
}

/**
 * ① 的**下一级价格**（log10）。
 *
 * ★★★ 2025（用户裁定）：「无限增幅的初始价格不应该就是 1 无限点（购买时 1 级）么？
 *   然后每 2 级为 10 无限点花费，3 级 100 点（以此类推）」
 *   ⇒ 价格序列：`1（第1级）→ 1（第2级）→ 10 → 100 → 1000 …`
 *     即第 1 级 **1 点**（开局买得起），第 2 级 1 点，之后每级 ×10 ✓
 *
 *   ⚠️ 原实现（照抄 AD）是 `10^(count+1)` ⇒ 首价 **10** ⇒ 用户报
 *      「无限增幅开局买不了？…打破无限本身也要 128 点」⇒ 10 点开局确实难凑 ✗
 *   ⚠️ 门槛之后仍是 AD 的 `门槛 × 1e10^超出`（用户：「后续的阈值我不管你，因为符合预期」）✓
 */
