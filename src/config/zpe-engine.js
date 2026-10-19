/**
 * config/zpe-engine.js —— ZPE 引擎（价格、等级、五条机制、唯一有效等级入口）
 *
 * ⚠️ 本文件由 `src/config.js` 按领域机械拆分而来：**声明与注释逐字保留**。
 *    对外仍然统一从 `src/config.js`（barrel）导入 —— 不要直接改这里的 import 路径。
 *    依赖：tangram-bonus.js, tangram.js ｜ Decimal
 */
import Decimal from "../../dist/break_eternity.esm.js";
import { tangramEngineBonusLevels } from "../tangram-bonus.js";
import { tangramRewardEffects } from "../tangram.js";

export const ZPE_ENGINE = {
  // ⚠️ 原来这里有个 `unlockCostIp: 10`（"解锁价 10 无限点"）—— **已删除**：
  //   解锁条件 2025 就改成了「**1 次大坍缩**」（里程碑奖励，不花无限点，还送 1 级），
  //   见 `engine.js` 的 `unlockZpeEngine()`。这个字段从此**没有任何读取方** ⇒ 是死数据 ✓
  //   （留着它的害处：注释还在说"用户指定：10 无限点"，与实现相反 ⇒ 读代码的人会被误导 ✗）
  /**
   * **第一级价格**（= 指数价格的 `c0`）。
   *
   * ★★★ 2025 **终稿**（用户裁定）：`5`。价格形状改成**指数** `c0 · r^L`（见 `costGrowth`）。
   *
   *   ⚠️ 本字段曾被我（2025 本会话）一路降到 **1e-5**（5 → 0.001 → 1e-4 → 1e-5），
   *      理由是"让 168h 达到 2000 级" —— **只看了一个目标、没看首价** ⇒
   *      界面出现"0.1 的价格"（用户当场指出），且 1e28 池能买到 **2.4 亿级** ✗
   *   ⚠️ 而且**幂次价格下"首价可读"与"满级卡住"不可兼得**：
   *      要让 1e28 池恰好买 ~2000 级，反解出 `base ≈ 2.5e15` ⇒ 1 级价就是 2.5e15 ✗
   *   ⇒ 改成指数后，首价是**独立可读**的数（= 5），而级数由 `log(池)` 控制 ✓
   *
   *   标定：**1e28 池 ≈ 100 级**（用户裁定）⇒ `5·(r^100−1)/(r−1) = 1e28` ⇒ `r = 1.872483` ✓
   */
  baseCostIp: 5,
  /**
   * ★★★ **每级涨价倍率**（指数价格的 `r`）—— 用户裁定的"价格步长不短"就落在这里。
   *
   *   `cost(L) = baseCostIp · costGrowth^L`（L = 当前等级，买的是第 L+1 级）
   *   ⇒ **每级固定 ×1.60**（不是"每级加一点"）⇒ 步长恒定、可预期 ✓
   *
   *   ── 各池子对应的级数（标定结果）──
   *   | IP 池 | 能买级数 |
   *   |---|---|
   *   | 1e10 | 44 |
   *   | 1e20 | 71 |
   *   | **1e28** | **100** ← 用户裁定的锚点 |
   *   | 1e40 | 144 |
   *   | 1e100 | 364 |
   *   ⇒ 全程落在 0~350 的**可读范围**（不再是 2.4 亿）✓
   *
   *   ⚠️ 调大 `r` ⇒ 更陡 ⇒ 同样池子买到更少级；调小则相反。
   *      改它**不影响**首价（首价恒 = `baseCostIp`）✓
   */
  costGrowth: 1.872483,
  /**
   * ★★★ **引擎加成对「量子加成」的每级增速**（用户裁定：方案**乙** = `1.22`）。
   *
   *   `engineBonusMult = bonusGrowth^等级` —— 乘在 5 条量子加成上（见 `engineBonusMult`）。
   *
   *   ── 为什么**不等于** `costGrowth`（我第一版就是那么做的，结果 12h 冻结 ✗）──
   *     实测量级：
   *       · 每级加成 ×B ⇒ 收入 +log10(B) 阶（因为 k 杠杆 ≈ +46 阶/级，见下）
   *       · 价格每级 ×`costGrowth` ⇒ **需要** 收入 +0.272 阶/级
   *     ⇒ 若 `B = costGrowth = 1.872`（+0.272 阶）⇒ **收入与价格恰好持平**
   *       ⇒ 数值一偏就成**正反馈** ⇒ 实测 **12 小时冲到 819 级后彻底冻结**（IP 池、量子、等级全不动）✗
   *     ⇒ 取 `B = 1.22`（+0.087 阶）⇒ 收入比价格**慢 3 倍**
   *       ⇒ 推进是**渐进的**：买一级看得见收益，但追不上价格 ⇒ 不会一步到位 ✓
   *
   *   ⚠️ 标定依据（实测）：
   *     · `k` 杠杆：a区 ≈ 1e4126 @深度 1e8744，k 每级 +0.0113 ⇒ rate 每级 +46 阶
   *     · 但"每级加成 ×B"直接乘在**量子加成**上 ⇒ 收入 +log10(B) 阶（不再走 k）
   *     · 所以 `B` 与 `log10` 后就是"每级收入增量"，与价格的 0.272 直接可比较 ✓
   */
  bonusGrowth: 1.22,
  /**
   * ★★★ **方案甲**（用户裁定）：引擎加成的**基准级** ——
   *   `engineBonusMult(lv) = Σprice(0→lv) / Σprice(0→bonusBaseLevel)`
   *
   *   取 1：乘数从第 1 级起算（1 级 ⇒ ×1，2 级 ⇒ 约 ×1.87…）
   *   ⚠️ 若它让引擎"起步就爆"（因为 116 级时的累计价是 2.4e27 倍），
   *      就把这个数**抬到引擎的自然停滞点**（≈116）⇒ 那时乘数从 ×1 开始长。
   *      （这是一个**可选旋钮**：值越大 ⇒ 乘数起步越小、越晚发力）
   */
  bonusBaseLevel: 1,
  /**
   * ★ 2025 已废弃：下面这段"分段软上限"（`0~10 ×2 / >10 ×20 / >100 ×49 / >1000 ×219`）
   *   是**三次方时代的旧设计**，已被指数价格整体取代 ⇒ **无任何读取方** ✗
   *   （保留这段文字只为说明来历；真正的价格见 `zpeEngineCost` / `zpeEngineTotalCost`
   *     / `zpeEngineAffordableIn` 三个同源函数。）
   *
   *   | 等级区间 | 每级涨价倍率 | 说明 |
   *   |---|---|---|
   *   | 0 ~ 10    | ×2           | 正常段 |
   *   | > 10      | ×2 **再 ×10** = ×20 | 「大于 10 引擎价格增长 ×10」 |
   *   | > 100     | 再 **^1.3** = ×49.1 | 「大于 100 再多 ^1.3」 |
   *   | > 1000    | 再 **^1.8** = ×218.6 | 「大于 1000 再多 ^1.8」 |
   */
  // ⚠️ `addPerLevel`（① 每级 +1）**已删除**：① 改成饱和式后不再"每级加固定值"，
  //   参数移到 `ENGINE_MECH.add`（`A` / `knee`）✓
  // ⚠️ ② 的旧参数（`(1 + perLevel×等级)²`）也已删除（2025 设计稿改过两次形状）。

  /** ③ 从这一级起，ZPE 倍率开始吃「计数频率」 */
  countFreqLevel: 5,
  /** ⚠️ 废弃（2025 设计稿把 ① 改成加法区）：① 原来从这一级起给倍率公式加指数 */
  /** ① 的指数加成上限（安全线：0.05 × 2 = 0.10 ≪ 1） */
  /**
   * ★★★ 2025 **新增**（用户要求）：「2000 级之后购买等级需要更多无限点
   *   （**每增加 5 个数量级只能买 1 个**）的价格增幅」。
   *
   * ── 终稿（用户第 3 次纠正：「**不应该是当前价格基础上再 ×1e5 么？**」）──
   *   `zpeEngineCost(lv) = c0 · costGrowth^lv · ζ(lv)`
   *   `ζ(lv) = 1`（lv < level）｜**`mult^(lv − level + 1)`**（lv ≥ level）✓
   *
   *   ⇒ 也就是「**2000 级起，每买一级都在当前价格上再 ×mult**」✓
   *     `价格(2000+n) = 价格(1999) · costGrowth^(n+1) · mult^(n+1)`
   *
   *   ⚠️⚠️ **我前两版都只让它生效一次**（`ζ = mult` 常数）——
   *     那只有"跨过 2000 那一步 ×mult"，之后每级又只 ×1.8725 ✗
   *     用户要的是**逐级连乘**（每一级都多 9 个数量级）✓
   *
   *   ★ **`mult = 1e9`（用户 2026 定稿）**：
   *     原为 `1e5`，用户裁定「**数值从 1e5 调整为 1e9 吧，一次能爬的还是太多了**」
   *     —— 注意他的理由：不是"太贵买不起"，而是**一次能爬的级数太多**。
   *     在闭式下 `可买级数 ≈ log10(池) / (log10(mult) + log10(costGrowth))`：
   *       `mult = 1e5` ⇒ 每级 5.27 个数量级｜`mult = 1e9` ⇒ 每级 **9.27 个数量级**
   *       ⇒ 同一池子能爬的级数**减少约 43%**（1e2000 池：2275 级 → 1307 级）
   *     ⚠️ 用户明确：**不靠改机制来控制节奏**，只调这个数值旋钮 ✓
   *
   *   ⚠️ 这**比 2000 级以下更陡**（下面每级只 +0.27 个数量级，上面 +9.27）——
   *     是有意的：用户要一道**硬闸门**把引擎等级封在这里 ✓
   *   ⚠️ 好处：池子给的是 `log10(池)/9.27` 级 ⇒ **可买级数随池子对数增长**，不会失控 ✓
   */
  steepAfter: { level: 2000, mult: 1e9 },
};

/**
 * ★ 无限铸币（**设计未冻结：用户保留最终修改权**）
 *
 * 用户批注：「铸币系统一看就很影响设计，虽然强力。我的建议是保留对这一设计的最终修改权。」
 *
 * ── 它是什么 ──
 *   可重复升级，花**无限点**买，效果是把**所有无限点收入**乘以 `m^等级`。
 *   价格也是等比：`baseCostIp × r^等级`。于是
 *       p = log(m)/log(r)
 *   `p < 1` 收敛（追不上）、`p = 1` 每小时固定阶数、`p > 1` 超临界（有限时间奇点）。
 *   本项目取 `p = 1.32 > 1`：**先慢后冲**，这是唯一能在几十小时内跨 306 阶的形态。
 *
 * ── 为什么必须有"档位闸门"（关键，模型实测的教训）──
 *   只要某个循环能用无限点**批量买入**，池子一大它就会瞬间买几百级、当场放大收入。
 *   所以铸币等级**硬性**受 `capPerCrunch × 大坍缩次数` 限制：
 *   每次大坍缩才放行一批，节奏就由"每次大坍缩要多久"决定（见 `docs/IP-ECONOMY.md`）。
 *
 *   ⚠️ 闸门**不许**和别的循环用加法耦合。模型里曾经把上限写成
 *      `引擎等级 + 档位×增量`，结果引擎等级一跑飞就把闸门整体顶开（12/22/32 拟合结果一模一样）。
 *
 * ── 拟合结果（`tools/ip-economy-lab.mjs`）──
 *   `capPerCrunch = 30` + ① 每档 +2 级 → 实测 **24.0 小时 / 24 档**，每档兑现 **12.73 阶**
 *   （设计值 `306 ÷ 24 = 12.75`）。
 */
/**
 *   —— 它原先只通过「深度复利 IP 公式」（已换成 AD 型 ✗）与「无限长河」（已停产 ✗）生效。
 *   本定义**暂时保留**（41 处工具断言仍直接调用它 ✓ 删定义会连带一大片 ✗）；
 *   等"清理批次"一起删（那时连工具断言一并处理 ✓）。
 *   ⇒ 它现在**不影响任何数值** ✓（界面条目也已隐藏 ✓）
 */


/**
 * ★ 无限增幅（①，`INFINITY_UPGRADES.ipDouble`）的价格**软上限**。
 *
 * 用户指定：「若会影响永恒阶段务必加入极强的软上限」。
 * ① 的效果是 `收入 ×3^等级`、价格 `10^等级` —— 单独看是**收敛**的（`p = 0.477`），
 * 但池子一大就能**批量买几百级**：模型实测 `A ≈ log10(池子/9)`，
 * 于是「池子变大 → 一次买光 → 收入 ×3^A」形成池驱动的爆走。
 *
 * 拟合需要的量级是 **A ≈ 50**（24 档 × 每档 +2 级），所以软上限从第 60 级起咬：
 * 60 级前完全不干扰设计，之后每级涨价 ×100、再 ^1.5 —— 1e308 点也只能买到 60 多级。
 */
// ⚠️ 2025 **已删除** `IP_DOUBLE_SOFT_CAP`（分段 `×10 / ×100 / ×10^3`）——
//   用户终稿裁定：「**同 AD 中 ip 倍增价格逻辑，且不再更改**」
//   ⇒ 价格改由 `IP_DOUBLE_AD` 驱动（两段等比：门槛前 ×10、门槛后 ×1e10、封顶 1e300）
//   ⇒ 旧数组的三个字段（`from`/`growth`）已无读取方，整段删除（避免两套价格并存 ✗）

/**
 * 「量子铸币」的实际收益：`floor(本次无限最大量子数 ^ power)`。
 * 没买这条就是 0（所以它是"买断才有"的一次性收益）。
 *
 * ★★★ 2026 平衡（用户报：「量子铸币的效果有点过于强了，`^2` 改成 `^1.75` 差不多」）：
 *   指数从**硬编码的平方**改为读升级定义里的 `power`（单一数据源 ✓）：
 *     旧 `n.mul(n)`（= q²）→ 新 `q^1.75`
 *   实测同一量子数下的收益变化（`q^1.75 / q² = q^(−0.25)`，用真 Decimal 算的）：
 *     `q=83 ⇒ 6889 → 2282`（−66.9%）｜`q=138 ⇒ 19043 → 5556`（−70.8%）｜`q=1000 ⇒ 1e6 → 177827`（−82.2%）
 *   ⇒ 量子越多，砍得越狠（这正是"过于强"的那部分）✓
 *
 * ⚠️ 精度纪律（本项目踩过）：**整数指数不能用 `Decimal.pow`** ——
 *   `Decimal.pow(5,2)` 会给 `25.000000000000007`（不是精确的 25）✗
 *   ⇒ 所以这里按指数**分路**：整数走 `powExactInt`（反复平方法，精确），
 *     非整数才用 `.pow()`（分数幂没有精确算法，只能接受 ~1e-15 的相对误差）✓
 */
export function engineBonusMult(state) {
  const lv = Math.max(0, Number(state?.zpeEngineLevel ?? 0) || 0);
  const base = Math.max(1, Number(ZPE_ENGINE.bonusBaseLevel ?? 1) || 1);
  if (lv <= base) return new Decimal(1);           // 低于基准级 ⇒ 恒 1（零回归 ✓）
  const denom = zpeEngineTotalCost(0, base);
  if (!denom.gt(0)) return new Decimal(1);
  return zpeEngineTotalCost(0, lv).div(denom);
}

/**
 * ① 的等级上限探针：给定池子能买几级。
 *
 * ★★★ 2025 重写（用户裁定改了首价序列之后）：
 *   用户的价格序列是 `1 → 1 → 10 → 100 → …` —— **第 1 级 1 点是个特例**
 *   （`10^(n−1)` 在 n=0 处是 0.1，不是 1）⇒ 任何"纯等比闭式"都会错。
 *   ⚠️ 我在这里**错了两次**（先 `/9` 后 `/90`，再想用 `/9` 反解 k）——
 *      根因都是"把带特例的序列当成纯等比" ✗
 *
 *   ⇒ 现在改成**两段式**，不再推导新公式：
 *     ① **解析求上界** `kUB`（把序列当纯等比 `10^(n−1)`，首项取本级价格）—— 只会**高估**
 *     ② 从 `kUB` **逐级阶梯回退**直到累计价 ≤ 池子 ⇒ **保证精确** ✓
 *       回退步数：首价有偏差时最多差 1~2 级 ⇒ 实际上近 O(1) ✓
 *     （步长 ≤ 30 级，`ipDoublePriceAt` 是幂运算，开销可忽略）
 */
export function zpeEngineUnlocked(state) {
  return state.zpeEngineUnlocked === true;
}

/** 引擎等级（没解锁就是 0） */
export function zpeEngineLevel(state) {
  const lv = state.zpeEngineLevel ?? 0;
  return lv instanceof Decimal ? lv : new Decimal(lv);
}

/**
 * 下一级的价格（无限点）。**解锁本身不花无限点**（走「1 次大坍缩」里程碑，见 engine.js）。
 *
 * ★★★ 2025 **价格形状重设计（用户裁定）**：三次方 → **指数**。
 *
 *   ── 为什么必须换成指数 ──
 *     旧式 `base·(L+1)³` 的**累计价 ∝ L⁴** ⇒ `级数 ∝ 池^0.25`
 *     ⇒ 池子每涨 4 阶，能买的级数就**翻倍** ⇒ 永远追不上 ⇒ 实测买到 **2.4 亿级** ✗
 *     而且"首价可读"与"满级价格刚好卡住"**在幂次形状下不可兼得**：
 *       要让 1e28 池恰好只买 ~2000 级，反解出 `base ≈ 2.5e15` ⇒ **1 级价 2.5e15** ✗
 *   ⇒ 指数：`级数 ∝ log(池)` ⇒ 池涨 8 阶、级数只涨几百 ⇒ **步长真正被控制住** ✓
 *     而且首价就是一个**独立可读**的数（= `baseCostIp`），不会变成 1e-5 ✗
 *
 *   ── 标定（用户裁定：**1e28 池 ≈ 100 级**）──
 *     `cost(L) = c0 · r^L`（L = 当前等级 ⇒ 第 L+1 级）
 *     累计到 100 级：`c0·(r^100 − 1)/(r − 1) = 1e28`
 *     取 `c0 = 5` ⇒ 反解 `r = 1.60`
 *     ⇒ 1e28 池 → **100 级**｜1e40 池 → 144 级｜1e100 池 → 342 级 ✓（全程可读）
 */
export function zpeEngineCost(state) {
  const c0 = new Decimal(ZPE_ENGINE.baseCostIp);
  const r = new Decimal(ZPE_ENGINE.costGrowth);
  // ⚠️⚠️ **必须 `Number(…)`** —— `zpeEngineLevel()` 返回的是 **Decimal**，
  //   而 `lv + i` / Decimal 参与 `pow` 时会走**字符串拼接**：
  //   实测 `Lv1990 + 0 ⇒ "19900"`（不是 1990）⇒ 价格虚高到买不起、显示也错 ✗
  //   （我第一版就是这么写的，被 `_zpe3` 的逐步试算当场抓出来）
  const lv = Number(zpeEngineLevel(state)) || 0;
  // ★★★ 2025 新增（用户要求）：**2000 级之后的价格增幅惩罚**（见 `zpeEngineCostMult`）✓
  //   `cost(lv) = c0 · r^lv · ζ(lv)`，阈值处 `ζ(2000) = 1` ⇒ **跨过阈值不跳变** ✓
  return c0.mul(r.pow(lv)).mul(zpeEngineCostMult(lv));
}

/**
 * ★★★ 2025/2026 **新增**（用户要求）：「给 zpe 引擎在大于 2000 级后购买等级需要更多无限点
 *   （**每增加 5 个数量级只能买 1 个**）的价格增幅逻辑」。
 *
 * ── 终稿语义（用户第 3 次纠正原话：「**不应该是当前价格基础上再 ×1e5 么？**」）──
 *   **2000 级起，每买一级都在当前价格上再 ×mult** ⇒ 逐级连乘 ✓
 *     `ζ(lv) = 1`（lv < level）｜`mult^(lv − level + 1)`（lv ≥ level）
 *   即：
 *     `价格(1999) = 5·r^1999`
 *     `价格(2000) = 价格(1999) · r · mult`          ← 第 1 次 ×mult
 *     `价格(2001) = 价格(2000) · r · mult`          ← 第 2 次
 *     `价格(2000+n) = 价格(1999) · r^(n+1) · mult^(n+1)` ✓
 *   ⚠️ `mult` 由 `1e5` 调成 **`1e9`**（用户 2026：「一次能爬的还是太多了」）✓
 *
 * ── ⚠️⚠️ 我前两版都**只让它生效一次**（ζ 取常数）──
 *   那只有"跨过 2000 那一步 ×mult"，之后每级又回到 ×1.8725 ✗
 *   ⇒ 用户看到的现象就是"说好的价格阈值升级呢？"（增量没持续）
 *   教训：「每增加 N 个数量级只能买 1 个」是**每一级**都要 +N 个数量级，不是一次性 ✓
 *
 * ── 实测（Lv2000 之后每级）──
 *   Lv2001 ⇒ +9.27 个数量级｜Lv2005 ⇒ 累计 +46.4｜Lv2010 ⇒ 累计 +92.7 ✓
 *   ⚠️ 这比 2000 级**以下**更陡（下面每级只 +0.27）—— 是有意的：
 *     用户要一道**硬闸门**把引擎等级封在 2000 附近 ✓
 *   好处：池子给的是 `log10(池)/9.27` 级 ⇒ 可买级数随池子**对数**增长，不会失控 ✓
 *   （从 1e1000 池 ≈ 1127 级；1e2000 池 ≈ 1307 级）
 */
export function zpeEngineCostMult(level) {
  const cfg = ZPE_ENGINE.steepAfter ?? { level: 2000, mult: 1e9 };
  const lv = Math.max(0, Number(level) || 0);
  const start = cfg.level ?? 2000;
  const mult = cfg.mult ?? 1e9;
  if (lv < start) return new Decimal(1);
  // ★ **逐级连乘**：超出阈值的级数越多，乘得越多 ✓
  //   `mult^(lv − start + 1)` ⇒ 第 2000 级本身就是 ×mult（与用户"当前价格基础上再×mult"一致）✓
  return new Decimal(mult).pow(lv - start + 1);
}

/** `ζ` 的**每级倍率**（`ζ(lv+1)/ζ(lv)`）—— 供 UI/诊断显示"这一级实际涨多少" ✓ */
export function zpeEngineStepMult(level) {
  const lv = Math.max(0, Number(level) || 0);
  return zpeEngineCostMult(lv + 1).div(zpeEngineCostMult(lv));
}

/**
 * 从 `from` 买到 `to` 的总价（**Decimal**）。
 *
 * ★★★ 2025 **改回分段闭式**（在"逐级累加"之后又改回来 —— 两次的教训都留档）。
 *
 * ── 第 1 版（原始）：纯等比闭式 ──
 *   `c0·r^a·(r^n − 1)/(r − 1)` —— 它假设**每级都 ×r**。
 *   加了 2000 级后的惩罚 `ζ` 之后，这个假设**不再成立** ⇒ 闭式必错 ✗
 *
 * ── 第 2 版（我改成逐级累加）：正确，但**把性能打崩了** ✗✗ ──
 *   实测（`_zpeclosed2.mjs`）：`zpeEngineTotalCost(0, 2000)` = **3.9 ms/次**
 *   而它是**热路径**：
 *     · `ui.js` 的 ZPE 面板每帧显示引擎累计价
 *     · `engineBonusMult()` 里调**两次**（`zpeEngineTotalCost(0, lv)/zpeEngineTotalCost(0, base)`）
 *       —— 而 `engineBonusMult` 被 UI 每帧用于显示引擎加成 ✗
 *   ⇒ 每帧 3~4 次 × 3.9ms ≈ **12~16ms/帧**，在 ZPE 2000 级后还会**继续变慢**（O(等级)）✗
 *   这正是用户的性能图上 `zpeEngineTotalCost(0, 等级) = 2.06 ms/次` 那一行。
 *
 * ── 第 3 版（现在）：**分段闭式**（与逐级累加**逐区间验证一致**）──
 *   ζ 现在是**逐级连乘**（`lv ≥ L ⇒ ζ = M^(lv−L+1)`）⇒ 阈值之上是
 *   **公比为 `r·M` 的等比数列**（每一级都同时 ×r 和 ×M）：
 *     · 段 1 `[a, min(b, L))`：公比 `r`，首项 `c0·r^a`
 *     · 段 2 `[max(a, L), b)`：公比 **`r·M`**，首项 `c0·r^L·M`
 *
 *   ⚠️⚠️ **这里有一个我来回错过两次的点，必须讲清**：
 *     · 当 ζ 是**常数**（旧版，只跃变一次）时，段 2 的公比是 **`r`**（不是 `r·M`）
 *       —— 我那次写成 `r·M` ⇒ 算出来的价虚高几个数量级 ✗
 *     · 当 ζ 是**逐级连乘**（现在）时，段 2 的公比**就是 `r·M`** ✓
 *   ⇒ **公比取决于 ζ 的形状**，不能照抄。改 ζ 语义时必须回来重算这一段 ✗
 *
 *   性能：`(0, 2000)` 3.9ms → **0.0039ms（1013×）**；且**与等级无关**（O(1)）✓
 */
export function zpeEngineTotalCost(from, to) {
  const a = Math.max(0, Number(from) || 0);
  const b = Math.max(0, Number(to) || 0);
  const n = Math.floor(b - a);
  if (n <= 0) return new Decimal(0);
  const c0 = new Decimal(ZPE_ENGINE.baseCostIp);
  const r = new Decimal(ZPE_ENGINE.costGrowth);
  const M = new Decimal(ZPE_ENGINE.steepAfter?.mult ?? 1e9);
  const L = zpeEngineSteepLevel();
  /** 等比求和（公比 `q`）：`first·(q^n − 1)/(q − 1)` */
  const geo = (first, q, count) => first.mul(q.pow(count).sub(1)).div(q.sub(1));
  let total = new Decimal(0);
  // 段 1：ζ = 1 ⇒ 公比 r
  const e1 = Math.min(b, L);
  if (e1 > a) total = total.add(geo(c0.mul(r.pow(a)), r, e1 - a));
  // 段 2：ζ = M^(lv−L+1) ⇒ 公比 r·M，首项 c0·r^L·M
  const s2 = Math.max(a, L);
  if (b > s2) {
    const q = r.mul(M);
    total = total.add(geo(c0.mul(r.pow(s2)).mul(zpeEngineCostMult(s2)), q, b - s2));
  }
  return total;
}

/** `steepAfter.level`（生效级）—— 单一出处 */
export function zpeEngineSteepLevel() {
  return ZPE_ENGINE.steepAfter?.level ?? 2000;
}

/**
 * **逐级累加**版（闭式的验证基准 + 万一 ζ 形状再变的兜底）。
 *
 * ⚠️ 复杂度 `O(n)`、每级一次 `Decimal.pow` ⇒ **绝不放进热路径** ✗
 *   （我把它放进去过一次，实测 3.9ms/帧 × 每帧 3~4 次 ⇒ 性能事故）
 * 用途：自检里与闭式对照 ✓
 */
export function zpeEngineTotalCostLoop(from, to) {
  const a = Math.max(0, Number(from) || 0);
  const b = Math.max(0, Number(to) || 0);
  const n = Math.floor(b - a);
  if (n <= 0) return new Decimal(0);
  const c0 = new Decimal(ZPE_ENGINE.baseCostIp);
  const r = new Decimal(ZPE_ENGINE.costGrowth);
  let total = new Decimal(0);
  for (let i = 0; i < n; i++) total = total.add(c0.mul(r.pow(a + i)).mul(zpeEngineCostMult(a + i)));
  return total;
}

/**
 * 从当前等级起，给定无限点池**最多能买几级**。
 *
 * ★★★ 2025 **改回分段闭式反解**（"逐级核减"版正确但把性能打崩了 —— 见下）。
 *
 * ── 反解（每段内是纯等比）──
 *   `pool ≥ first·(r^k − 1)/(r − 1)` ⇒ `k = floor( log_r(1 + pool·(r−1)/first) )`
 *   两段**串联**：先吃段 1（ζ=1），剩余的钱再吃段 2（ζ=M）✓
 *   ⚠️ `floor` 在浮点边界上可能**低于真值**（本项目踩过：探针说 30 级、真值 25 级）
 *      ⇒ 算出后再用 `zpeEngineTotalCost` **验一次**，多退少补（O(1) 次闭式调用）✓
 *
 * ── 为什么不能用"逐级核减"（我上一版）✗ ──
 *   实测 `zpeEngineAffordableIn @Lv0` = **4.5 ms/次**，而 UI **每帧**调它
 *   （ZPE 面板的「可买 N 级」+ 买满按钮的门控）⇒ 又一个性能事故 ✗
 *   （那个循环的 `kUB` 还会到 20000 ⇒ 最坏情况更糟）
 *
 * ── `ζ` 随等级变化时（`spanLevels > 0`）──
 *   闭式不成立 ⇒ 退回逐级核减（`zpeEngineAffordableInLoop`）✓
 */
export function zpeEngineAffordableIn(state, poolDecimal) {
  if (!zpeEngineUnlocked(state)) return 0;
  const pool = poolDecimal instanceof Decimal ? poolDecimal : new Decimal(poolDecimal ?? 0);
  if (pool.lte(0)) return 0;
  // ⚠️ **必须 `Number(…)`** —— `zpeEngineLevel()` 返回 Decimal，
  //   参与 `lv + i` 会变成**字符串拼接**（`1990 + 0 ⇒ "19900"` ✗，我踩过）
  const lv = Number(zpeEngineLevel(state)) || 0;
  const c0 = new Decimal(ZPE_ENGINE.baseCostIp);
  const r = new Decimal(ZPE_ENGINE.costGrowth);
  const M = new Decimal(ZPE_ENGINE.steepAfter?.mult ?? 1e9);
  const L = zpeEngineSteepLevel();
  /** 在公比 `q`、首项 `first` 的等比段里，`avail` 最多买几级 */
  const nIn = (first, q, avail) => {
    if (first.lte(0) || avail.lt(first)) return 0;
    const inner = avail.mul(q.sub(1)).div(first).add(1);
    if (inner.lte(1)) return 0;
    const k = Math.floor(inner.log10().div(q.log10()).toNumber());
    return Number.isFinite(k) && k > 0 ? k : 0;
  };
  let left = pool;
  let k = 0;
  // 段 1：ζ = 1 ⇒ 公比 r
  if (lv < L) {
    const n1 = Math.min(nIn(c0.mul(r.pow(lv)), r, left), L - lv);
    if (n1 > 0) {
      left = left.sub(zpeEngineTotalCost(lv, lv + n1));
      k += n1;
    }
  }
  // 段 2：ζ = M^(lv−L+1) ⇒ 公比 **r·M**（每一级都同时 ×r 和 ×M）✓
  const at = lv + k;
  if (left.gt(0) && at >= L) {
    const n2 = nIn(c0.mul(r.pow(at)).mul(zpeEngineCostMult(at)), r.mul(M), left);
    if (n2 > 0) k += n2;
  }
  // 浮点边界修正：`floor` 可能少算 1 级（也可能多算 1 级）⇒ 用**真价**收敛 ✓
  let guard = 0;
  while (guard++ < 4 && k > 0 && zpeEngineTotalCost(lv, lv + k).gt(pool)) k--;
  guard = 0;
  while (guard++ < 4 && zpeEngineTotalCost(lv, lv + k + 1).lte(pool)) k++;
  return k;
}

/** 逐级核减版（`ζ` 随等级变化时的兜底 + 自检的验证基准）—— **O(k)，别放热路径** ✗ */
export function zpeEngineAffordableInLoop(lv, pool) {
  const c0 = new Decimal(ZPE_ENGINE.baseCostIp);
  const r = new Decimal(ZPE_ENGINE.costGrowth);
  const inner = pool.mul(r.sub(1)).div(c0.mul(r.pow(lv))).add(1);
  if (inner.lte(1)) return 0;
  let kUB = inner.log10().div(r.log10()).floor().toNumber();
  if (!Number.isFinite(kUB) || kUB < 1) kUB = 1;
  kUB = Math.max(1, Math.min(kUB + 2, 20000));
  let spent = new Decimal(0);
  let k = 0;
  for (let i = 0; i < kUB; i++) {
    const p = c0.mul(r.pow(lv + i)).mul(zpeEngineCostMult(lv + i));
    if (spent.add(p).gt(pool)) break;
    spent = spent.add(p);
    k++;
  }
  return k;
}

/**
 * ② 引擎对 ZPE 产出的倍率。
 *
 * ★★ 2025「甲方案」（用户选定）：**全部改多项式**。
 *
 *   原案「每级 ×10」（`10^等级` ✗）在"破∞时已 944 级"的起跑线上**是几秒钟走完** ✗
 *   （拉表：`tools/` 的两方案对照 ⇒ 封顶到 3 级都还是 0.00h ✗）
 *   根因（数学判据）：**任何指数形式**（`10^等级` / `2^等级` / `2^√等级` ✗）都会让
 *     `∫dx/FORM(x)` 收敛 ⇒ **有限时间爆炸** ✗；只有**多项式**（线性/开根）发散 ⇒ 安全 ✓
 *   ⇒ 改成 `1 + 0.01·√等级`（开根 ✓，与倍率项同一族）
 */
/**
 * 第三种设计稿（用户 2025）· 引擎机制的**第 5 条**：
 *   「zpe 引擎将基于自身提供的倍数，提升**前 8 个虚空升级的效果**」
 *
 *   voidBoostMult = 1 + VOID_BOOST.coeff × log10(引擎倍率)
 *
 * 为什么用**对数**（不是直接乘）：
 *   · 引擎倍率现在最大可达 ~1e75（三次方价格下，等级 ~9.46e76）
 *   · 若线性乘进虚空升级 ⇒ 立刻重演 runaway（判据不允许指数链）
 *   · 对数 ⇒ 1e75 只给 ×(1 + 0.1×75) ≈ ×8.5 —— 强、有界、判据安全
 *   · 引擎未解锁/等级 0 ⇒ 倍率 = 1 ⇒ log10 = 0 ⇒ boost = 1 ⇒ **零回归**
 */
export const ENGINE_MECH = {
  /** ① ZPE 倍率**加法区**：`1 + A·x/(1+x)`，`x = 等级/knee`
   *  ★ H3（2025 终稿）：knee `200 → 20` —— 与 `MATTER_B_KNEE = 100` 的标度对齐
   *    （100 级时 ① 充满 `100/20 / (1+100/20) = 83.3%` ⇒ 机制已有实质强度 ✓）*/
  add: { A: 200, knee: 20 },
  /** ② ZPE **产出倍率**：开根（本身即"实际到顶"形状） */
  prod: { coeff: 0.02 },
  /** ②b ZPE/暗能量**乘算倍率**：开根 */
  mult: { coeff: 0.15 },
  /** ④ **暗能量自增长**倍率：`1 + A·x/(1+x)`；比 ① 敏感 ⇒ knee 更晚、A 更小
   *  ★ H3：knee `500 → 40`（100 级时充满 71.4%）*/
  de: { A: 20, knee: 40 },
};

/** 饱和式辅助：`1 + A·x/(1+x)`，x = lv/knee */
function saturate(A, lv, knee) {
  const x = Math.max(0, lv) / Math.max(1e-9, knee);
  return new Decimal(1).add(new Decimal(A).mul(x / (1 + x)));
}

export function zpeEngineProdMult(state) {
  if (!zpeEngineUnlocked(state)) return new Decimal(1);
  const lv = effectiveEngineLevel(state);            // ★ 唯一入口（IC 修饰器可压低 ✓）
  // ② 产出倍率 —— 开根形状（增长极慢 ⇒ 天然"实际到顶"）
  return new Decimal(1).add(lv.pow(0.5).mul(ENGINE_MECH.prod.coeff));
}

/**
 * ① 引擎给 `zpeMultiplier` 的**加法区额外倍率**（a区）。
 *
 * ★ 2025 设计稿（用户）第 1 条：**不再抬公式指数**（旧版 `+0.002/级` ✗），
 *   改成"加法区的额外倍率" —— 与「零点耦合」同一写法：`m = m.add(项)` ✓
 *
 * ★★ 2025 二次修订：改成**饱和式** `1 + A·x/(1+x)`（见 `ENGINE_MECH` 的说明）——
 *   原来是 `等级 × 1`（线性 ⇒ 真无界 ✗），与"内部机制可以有终点"的主张冲突。
 */
export function zpeEngineAddBonus(state) {
  if (!zpeEngineUnlocked(state)) return new Decimal(0);
  const lv = effectiveEngineLevel(state).toNumber();
  if (!Number.isFinite(lv) || lv <= 0) return new Decimal(0);
  // 返回的是「加法项」= 饱和值 − 1（调用方是 `m = m.add(...)`）
  return saturate(ENGINE_MECH.add.A, lv, ENGINE_MECH.add.knee).sub(1);
}

/**
 * ②b 引擎给 `zpeMultiplier` 与**暗能量倍率**的**乘算倍率**（同一函数两处用 ✓）。
 *
 * ★★ 2025「甲方案」：原案「每级 ×2」⇒ `2^等级` ✗ —— 与 `10^等级` 同一个病：
 *   指数形式 ⇒ 积分收敛 ⇒ **有限时间爆炸** ✗（拉表：等级 276 时 ×1e83 ✗）
 *   ⇒ 改成 `1 + 0.05·√等级`（开根 ✓）
 *     系数 0.05 由「破∞ → 永恒 = 6 小时」的目标反解得出 ✓
 *     （见 `tools/post-break-engine-lab.mjs` 与两方案对照表）
 */
export function zpeEngineMultBonus(state) {
  if (!zpeEngineUnlocked(state)) return new Decimal(1);
  const lv = effectiveEngineLevel(state);            // ★ 唯一入口（IC 修饰器可压低 ✓）
  // ②b 乘算倍率 —— 开根形状（同 ② 的理由）
  return new Decimal(1).add(lv.pow(0.5).mul(ENGINE_MECH.mult.coeff));
}

/**
 * ③ 暗能量倍率对 ZPE 倍率的影响（**带指数**，用户设计稿第 3 条）。
 *
 * `zpeMultiplier ×= 暗能量倍率 ^ 1.03`（初始指数 1.03，**上限待用户定** ✓）
 *
 * ⚠️⚠️ 这构成一个**反馈环**：`引擎倍率 → 暗能量倍率 →（^1.03）→ ZPE 倍率 → ZPE → …`
 *   与 `ZPE 倍率 ^0.02` 那条自反馈**耦合** ⇒ 必须一起验算环增益 < 1 ✗
 *   见 `tools/zpe-engine-lab.mjs` 的 `a < 1` 安全线（那里已把这条指数算进去）。
 */



/** ③ 是否已解锁（等级 ≥ countFreqLevel） */
export function zpeEngineCountFreqUnlocked(state) {
  return zpeEngineUnlocked(state) && zpeEngineLevel(state).toNumber() >= ZPE_ENGINE.countFreqLevel;
}

// ══════════════════════════════════════════════════════════
// 三条可重复升级
// ══════════════════════════════════════════════════════════

export function effectiveEngineLevel(state) {
  // ★★★ 2026：**纵轴**（覆盖率 ⇒ 免费 ZPE 引擎等级 10 → 10000）—— 设计稿 §2 已勘定 ✓
  //   ⚠️ 走 log 插值 + knee 饱和 ⇒ 有极强软上限（`PROGRESSION.md` §4.5）✓
  const base = zpeEngineLevel(state).max(0);
  const covBonus = typeof state?.tangramPlaced === "object" ? tangramEngineBonusLevels(state) : 0;
  // ★★★ 2026（用户：「七巧板的加成还没实装？」）—— **挑战奖励**的免费引擎级也要进公式 ✓
  //   原来它只在面板显示（显示 ≠ 实发 ✗）；现在两条来源**相加**：覆盖率 + 挑战奖励 ✓
  const rewardBonus = tangramRewardEffects(state?.tangramCleared).freeZpeEngineLevels ?? 0;
  return base.add(Math.max(0, covBonus)).add(Math.max(0, rewardBonus));
}

// ══════════════════════════════════════════════════════════
// ★ 无限增幅（ipDouble）—— 2025 用户方案甲：**从 ×2/级 改成线性 +10%/级** ✓
//   ×2/级 会形成 "IP → 买等级 → IP 翻倍 → 更多 IP" 的**指数反馈环** ✗
//   （探针实测：破∞后 44 秒走完 1e10 → 1e308 ✗；关引擎/调 k/调价格都不影响 ✗）
//   线性 ⇒ 多项式 ⇒ 判据安全 ✓；破∞前它仍是主要 IP 引擎 ✓（配合长河 1 IP/分钟 ✓）
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
// ★★★ 2025 **终稿**（用户裁定）：`ipDouble` **照抄 AD 的 ipMult**，不再改动
// ══════════════════════════════════════════════════════════
// 用户原话：「**同 AD 中 ip 倍增价格逻辑，且不再更改**」+「1: 就这样，不再做任何修改（终稿）」
//
// ── AD 原文（`src/core/infinity-upgrades.js`，逐行核对过）──
//   ```
//   // 132-135: "The repeatable 2xIP upgrade has an odd cost structure -
//   //   it follows a shallow exponential (step *10) up to e3M, at which point
//   //   it follows a steeper one (step *1e10) up to e6M before finally hardcapping."
//   get cost() {
//     if (purchaseCount >= purchasesAtIncrease)
//       return costIncreaseThreshold.times(Decimal.pow(costIncrease, purchaseCount - purchasesAtIncrease));
//     return Decimal.pow(costIncrease, purchaseCount + 1);
//   }
//   get purchasesAtIncrease() { return this.config.costIncreaseThreshold.log10() - 1; }
//   get costIncrease() { return hasIncreasedCost ? 1e10 : 10; }
//   // costCap: DC.E6E6 ｜ costIncreaseThreshold: DC.E3E6
//   effect: () => DC.D2.pow(player.IPMultPurchases)     // ← **2^购买次数**
//   ```
//
// ⇒ 我们照抄这三条：**基础价 10、步长 ×10、门槛后步长 ×1e10、封顶 1e6e6、效果 2^等级**
//
// ⚠️ 与 AD 的一处**必要偏差**（必须记下，不假装没有）：
//   AD 的门槛 `1e3e6` / 封顶 `1e6e6` 建立在 AD 自己的 IP 经济上（它能到 1e3000000）。
//   我们的 IP 池实测在 **1e19 ~ 1e28** ⇒ 照抄门槛会让此升级**永远只买到 27 级**（`10^28`）
//   ⇒ 效果只有 ×2^27 = 1.3e8，够不到它该负责的那 **28.25 阶**（1e280 → 1e308.25）✗
//   ⇒ 用户第 1 条裁定"就这样、终稿"= **保持 ×2/级 不动**；
//     门槛/封顶这两个**纯价格参数**按我们的经济量级重设（这符合"同 AD 的**价格逻辑**"，
//     因为逻辑是"浅指数 → 门槛 → 陡指数 → 封顶"，不是那几个具体数字）✓
//   ⇒ 取 `costIncreaseThreshold = 1e6`、`costCap = 1e300`：
//      · 1e6 之前：步长 ×10 ⇒ `10^(L+1)` ⇒ 到 L=5 花 1e6
//      · 1e6 之后：步长 ×1e10 ⇒ 每级 +10 阶
//      · 1e300 封顶 ⇒ L≈35 封顶 ⇒ 2^35 = 3.4e10 ⇒ 约 9.5 阶
//     ⚠️ 9.5 阶 < 28.25 阶 ⇒ **单靠它仍不够**（与线性版同一个结论：它只是"最终乘区"的一环，
//        剩下的大头必须来自深度收益/引擎）。这条**不是新问题**，是待解决的数值问题。
