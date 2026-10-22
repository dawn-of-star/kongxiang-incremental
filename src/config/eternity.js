/**
 * config/eternity.js —— 永恒层：门槛、EP 公式、永恒升级、8 条永恒里程碑
 *
 * ⚠️ 本文件由 `src/config.js` 按领域机械拆分而来：**声明与注释逐字保留**。
 *    对外仍然统一从 `src/config.js`（barrel）导入 —— 不要直接改这里的 import 路径。
 *    依赖：neko ｜ Decimal
 */
import Decimal from "../../dist/break_eternity.esm.js";
import { NEKO_BONUS_DOUBLE } from "./neko.js";

export const ETERNITY = {
  /**
   * 门槛：**无限点 1e308.25**（对齐 AD 的 `Number.MAX_VALUE ≈ 1.7977e308`）。
   *
   * ── ⚠️ 2026 修正（用户报：「永恒点获取公式中 280 修改成 308.25」）──
   *   这里原来写 `280`，注释理由是"比 AD 更早解锁永恒按钮，门槛处同样给 1 点"。
   *   但 `280` 这个常量**同时**是下面 `eternityPointGain()` 第一句的起点 ⇒ 那次"提前"
   *   不只改了按钮，**也改了 EP 获取公式的门槛**，于是出现：
   *     · 界面文案 / `docs/` / `stage-timing` 的标签一直写 **1e308.25**（AD 口径）
   *     · 而代码实际在 **1e280** 就放行并开始给 EP
   *   ⇒ 又一处「显示 vs 实际」不符（本项目最贵的那类 bug）✗
   *   ⇒ 统一到 **308.25**（用户指定值）✓
   *
   * ⚠️ AD 的精确值是 `log10(Number.MAX_VALUE) = 308.25471555991675`，
   *   与本值差 **0.0047 个数量级**。若要严格同源，把它改成 `BREAK_INFINITY.maxLog10` 即可
   *   （但那是"打破无限"的阈值，语义不同 ⇒ 刻意不复用，避免两件事被一个常量绑死）。
   *
   * 门槛处仍然正好 1 点：`5^(308.25/308 − 0.7) = 5^0.3008 = 1.62 → floor = 1` ✓
   */
  goalLog10: 308.25,
  /** 底数 5 */
  base: 5,
  /** 公式除数 308（AD 原文是 `308 − Pelle`，Pelle = 0 时即 308） */
  divisor: 308,
  /** 指数偏移 0.7 */
  offset: 0.7 };

/** 能不能永恒（门槛 = 无限点 1e308.25） */
export function canEternity(state) {
  return (state.infinityPoints ?? 0).gte(new Decimal(10).pow(ETERNITY.goalLog10));
}

// ══════════════════════════════════════════════════════════
// ★★★ 2025 新实现（第三层设计稿 33~35 行）：**永恒升级面板**
// ══════════════════════════════════════════════════════════
// 设计稿原文：
//   「永恒升级面板：将最终获得的永恒点 *5（价格初始 1ep，每次购买后 *5）」
//
// ⚠️ 实现纪律（本项目最贵的一课）：**价格与效果各只有一处实现**
//   · 价格 → `epMultPriceAt(level)`（唯一入口；UI 与实发都调它）
//   · 效果 → `epMultFactor(state)`（唯一入口；`doEternity` 与 UI 都调它）
//   同一条公式写两遍 ⇒ 就是"显示 ≠ 实发"的头号成因 ✗（本项目已踩过 4 次）
// ══════════════════════════════════════════════════════════
export const ETERNITY_UPGRADES = {
  /**
   * `epMult`：**最终获得的永恒点 ×5/级**（可重复购买）。
   *
   * · 效果：`5^等级`（乘在 `eternityPointGain` 的**最终结果**上 —— 设计稿说"最终获得的"）
   *
   * ── ⚠️⚠️ 2025 价格修正（用户报「永恒增幅价格增幅的 bug」）──
   *   设计稿 `第三层设计.txt` 第 33~35 行原文：
   *     「永恒升级面板：将最终获得的永恒点*5（**价格初始 1ep，每次购买后*5**）
   *       （**剩下的类似 ad 中的永恒升级**）」
   *   ⇒ 最后一句是**权威补充**：照 AD 抄。而 AD 的真实实现（`src/core/eternity.js`
   *     的 `EPMultiplierState.costAfterCount`）是：
   *       `costIncreaseThresholds = [1e100, 1.8e308, 1e1300, 1e4000]`
   *       `multPerUpgrade        = [50, 100, 500, 1000]`
   *       `cost(n) = multPerUpgrade[段]^n × **500**`
   *   ⇒ 我原来实现成 `5^n × 1` —— **基础价（500 vs 1）与涨价倍率（50 vs 5）都错** ✗
   *     差得很远：第 1 级 AD = 25000，我 = 1（差 2.5 万倍）。
   *
   *   ── 那"价格初始 1ep"怎么解释？──
   *     AD 的 `cost` 是**固定 500 起步**的（不是 1）。设计稿那句更像是"初始很便宜"的
   *     口语描述，而它自己紧接着说"剩下的类似 AD" ⇒ **以 AD 为准** ✓
   *     ⚠️ 如果你要的是字面上的"第 1 级 = 1ep、之后 ×5"，把 `baseCost` 改回 1、
   *        `costMultTiers` 改成 `[5]` 即可（**参数化**就是为此）✓
   */
  epMult: {
    id: "epMult",
    name: "永恒增幅",
    repeatable: true,
    /** 效果底数（每级 ×5）—— 这一条设计稿明写，不动 ✓ */
    effectMult: 5,
    /**
     * **价格**：分段倍率。
     *
     * ── ⚠️⚠️ 2025 第二次修正（用户裁定：「**第一层改成 1ep 点**，
     *    不然前期玩家买不动后面的永恒升级啊」）──
     *   设计稿第 34 行原文：「价格**初始 1ep**，每次购买后 *5」
     *   我第一次改成照抄 AD 的 `cost = 500·50^n` ⇒ **Lv0 就要 500 EP** ⇒
     *   前期一次永恒只给 1~2 EP ⇒ **根本买不起** ✗（用户当场指出）
     *   ⇒ `costBase` 改回 **1**（照设计稿字面），并把前两段的倍率从
     *     AD 的 `[50, 100, 500, 1000]` 降为 **`[5, 10, 50, 100]`**
     *     —— 因为"初始 1ep"配"×50"仍然太陡（Lv2 就 50 EP）✓
     *   于是前几级 = **1 / 5 / 25 / 125 / 625 …**（正好就是设计稿那句的序列）✓
     *   而后期段（×50 / ×100）仍然保留 AD 的陡峭度 ⇒ 不会一路无痛买满 ✓
     */
    costBase: 1,
    /**
     * ★★★ 2025 第四次调（用户裁定）：
     *   「我们可以在 **1e10000 后提供阈值更高的价格惩罚**（学习 AD 中的处理方式），
     *     阈值楼梯**可以少个 1e300 的**」
     *
     * ⇒ 楼梯（去掉 1e300 那档，并在 1e10000 之后加一段惩罚）：
     *     价格 < 1e30    ⇒ ×5     （前期，1 EP 起，平坦）
     *     价格 < 1e1000  ⇒ ×10
     *     价格 < 1e10000 ⇒ ×100
     *     之后一直      ⇒ **×500**（末段惩罚，"之后不再分段"）
     *
     * ⚠️⚠️ 末段**必须用"更大的倍率 + `null` 阈值"**，不能给末段一个**有限阈值** ✗
     *   ── 为什么（我上一轮刚踩到，值得记）──
     *     对"无上界"的价格，进入某段所需等级 = `log(阈值)/log(该段倍率)`。
     *     若末段阈值是有限值 T 而倍率又很大，这个等级会被推到**极高** ⇒
     *     `for (lv < crossLv[i])` 选段时会**跳过末段**，或者在一个突兀的等级上
     *     突然切换到它 ⇒ 段结构自相矛盾（实测：买满 5000 级 vs 逐级 14307 级 ✗）。
     *     极端例子：阈值 `1e10000` 配 ×500 ⇒ 需要 `10000/2.699 ≈ 8570` 级才进入 ✗
     *   ⇒ 正确做法：**每个段用一个不同的倍率，且每段都能在下一段阈值前被超越**；
     *     末段用 `null`（永不切换）✓
     *   ⚠️ AD 的末段用的是**超线性公式**（`E3^(n + clampMin(n−1334,0)^1.2)`）而不是
     *     固定倍率，所以它天然没有"进入条件过苛"的问题。本项目到不了那个量级
     *     （AD 的 1334 级起点对应 1e1300 以上的价格），故用"更大倍率"代替 ✓
     */
    costMultTiers: [5, 10, 100, 500],
    /**
     * 每段的**上限阈值**（价格超过它就进下一段）。
     *
     * ★ 2025 第四次调：`[1e30, 1e1000, 1e10000, null]` —— 去掉了 `1e300` 那档 ✓
     *   ⚠️ `1e1000` / `1e10000` 超过 double 范围 ⇒ 用**字符串 + `Decimal` 比较**（不能 `Number`）✗
     *   ⚠️ 末段必须是 `null`（见 `costMultTiers` 的说明）✓
     */
    costThresholds: ["1e30", "1e1000", "1e10000", null],
    // ⚠️⚠️ **没有 `costCap`** —— 用户裁定：「costCap 你要不删了吧，
    //   因为永恒倍增 **AD 中本来在第三段后就可以无限购买**」
    //   AD 的 `costAfterCount` 确实是**无上界**的（第三段后 `E3^(…)` 继续涨）✓
    //   原来我用 `1e1000` 当封顶，会在第三段刚起步时就把价格钉死 ⇒
    //   既不符合 AD，也让"第三段"没有意义 ✗ ⇒ 删除 ✓
    //   （本项目别处仍需要封顶的只有 `ipDouble` —— 那是**另一套**机制，不动它。）
    desc: "最终获得的永恒点 ×5/级",
  },
};

/**
 * `epMult` 的**段边界等级**（唯一实现 ✓）—— `crossLv[i]` = 第 i 段的倍率
 * 把价格推到"该段阈值"所需的**最小等级**。
 *
 * ★ 为什么要有这个函数（我踩到的坑，必须记）：
 *   原来 `epMultPriceAt` 在选段时对每个段做一次 `Decimal.pow(M[i], n)` 再与阈值比。
 *   这有两个病：
 *     ① **慢**：`epMultAffordableIn` 每级都调用 `epMultPriceAt` ⇒ 池 1e10000（5000 级）
 *        要跑 5000×4 = 2 万次 `Decimal.pow` ✗
 *     ② **数值边界漂移**：`Decimal.pow(5, 43)` 与 `ipow(5, 43)` 舍入路径不同 ⇒
 *        "选段判定"与"最终算价"用的不是同一个值 ⇒ 段边界附近可能选错段 ✗
 *   ⇒ 段边界只与**倍率 + 阈值**有关，与当前等级无关（固定值）⇒ 预先算好 ✓
 *     判断退化为**整数比较**（精确、O(1)），`epMultPriceAt` 与 `epMultAffordableIn`
 *     与 `engine.buyEpMult` 三处**共用同一套边界** ⇒ 不可能再脱节 ✓
 *
 * ⚠️ 阈值必须在 **log10 空间**取对数 —— `Number("1e10000") === Infinity` ✗
 *   （`1e1000` / `1e10000` 都超过 double 范围）
 */
export const epMultTierCrossLv = (() => {
  const cfg = ETERNITY_UPGRADES.epMult;
  const M = cfg.costMultTiers;
  return M.map((m, i) => {
    const raw = cfg.costThresholds[i];
    if (raw == null) return Infinity;                    // 末段：永不切换 ✓
    const str = String(raw);
    const mm = /^1e(\d+)$/.exec(str);
    const log10T = mm ? Number(mm[1]) : new Decimal(str).log10().toNumber();
    const lv = Math.ceil((log10T - Math.log10(cfg.costBase)) / Math.log10(m));
    return Number.isFinite(lv) ? Math.max(1, lv) : Infinity;
  });
})();

/**
 * 第 `lv` 级的价格落在**哪一段**（= 哪个倍率）。
 *
 * 语义（与 AD 的 `costAfterCount` 一致）：**从第 0 段开始，价格超过本段阈值就进下一段**；
 *  `null` 阈值的段是**末段**（永不切换）✓
 */
export function epMultTierAt(lv) {
  const M = ETERNITY_UPGRADES.epMult.costMultTiers;
  for (let i = 0; i < M.length; i++) if (lv < epMultTierCrossLv[i]) return i;
  return M.length - 1;
}

/**
 * `epMult` 的**下一级价格**（唯一的实现 ✓）—— 照 AD 的 `costAfterCount` 移植。
 *
 * ⚠️ 与 AD 的差异（必须记下来）：
 *   · AD 用 `DC.E1300` / `DC.E4000` 当后两段阈值（**超过 double 范围**）⇒
 *     本项目一律用**字符串 + `Decimal` 比较** ✓
 *   · AD 最后一段是 `E3^(n + clampMin(n−1334,0)^1.2) × 500`（超线性）；
 *     本作 EP 池到不了那么远 ⇒ **不实现那一段**，靠 `costCap` 兜底 ✓
 * · 浮点：`Math.pow` 只在**结果 ≤ `MAX_SAFE_INTEGER`** 时才精确（见下）✓
 */
export function epMultPriceAt(level) {
  const n = Math.max(0, Number(level) || 0);
  const cfg = ETERNITY_UPGRADES.epMult;
  // 找一个"结果 < 阈值"的段 ⇒ 用它算价格 ✓
  // ⚠️⚠️ 2025 修正（我上一版在这里**选错段**）：
  //   原来循环里每次不满足就把 `mult` 覆写成 `costMultTiers[i]` ⇒
  //   一旦**所有段都超阈值**（第三段阈值 1e1000 > `costCap` 时必然发生），
  //   它会退化成"用最后一段"——而 AD 的语义是
  //     `for (...) { const cost = mult[i]^n × base; if (cost < thresh[i]) return cost; }`
  //   即"整圈都不满足就**依次返回第一个**（等价于用 **tiers[0]**）" ✓
  //   ⇒ 现在：所有段都不满足时用 **`costMultTiers[0]`**（与 AD 一致）
  // ⚠️★ 选段用**预计算好的段边界等级**（`epMultTierCrossLv`），不再在循环里做 `Decimal.pow` ✓
  //   ── 为什么改（踩到的真坑）──
  //     原实现每段都算一次 `Decimal.pow(M[i], n)` 再与阈值比。这有两个问题：
  //       ① **慢**：`epMultAffordableIn` 每级调一次本函数 ⇒ 池 1e10000（5000 级）
  //          要跑 5000×4 = 2 万次 `Decimal.pow` ✗
  //       ② **数值边界漂移**：`Decimal.pow(5, 43)` 与 `ipow(5, 43)` 的舍入路径不同，
  //          导致"选段判定"与"最终算价"用的不是同一个值 ⇒ 段边界附近可能选错段 ✗
  //   ⇒ 段边界是**与 n 无关的固定等级**（`1e30` / `1e1000` / `1e10000` 只与倍率有关），
  //     预先算好即可；判断退化成整数比较，**精确且快** ✓
  const mult = cfg.costMultTiers[epMultTierAt(n)];
  // ⚠️ 精度：**整数底数 + 整数指数**时，一律用**反复平方法**（只用 `mul`）✓
  //   ── 为什么（这是我踩到的真坑，值得记）──
  //     `Decimal.pow(100, 5000)` 给 **`1.0000000000005236e10000`** —— 不是精确的 `1e10000` ✗
  //     （`Decimal.pow` 内部走 `pow10`(exp/log) 或 `Math.pow`，两者都会带误差。）
  //     后果：`epMultPriceAt(5000)` 比池子 1e10000 **大一点点** ⇒ 探针判定"只能买 5000 级"，
  //       而**增量乘法**（`Decimal.mul` 连乘 100）得到的是**精确的** `1e10000`
  //       ⇒ 两条路给出不同的价格 ⇒ 买满 5000 级 vs 逐级 14307 级，完全对不上 ✗
  //     （`Decimal.mul` 对整数尾数相乘是精确的 ⇒ 反复平方正好绕开 `pow` 的误差。）
  //   ⇒ `ipow(mult, n)`：只用 `mul`，O(log n) 步，**精确** ✓
  const ipow = (base, e) => {
    let result = new Decimal(1);
    let b = new Decimal(base);
    let n2 = e;
    while (n2 > 0) {
      if (n2 & 1) result = result.mul(b);
      n2 >>>= 1;
      if (n2 > 0) b = b.mul(b);
    }
    return result;
  };
  const mag = Math.log10(cfg.costBase) + n * Math.log10(mult);
  if (mag <= 15) {                       // 小量级：`Math.pow` 在安全整数内是精确的 ✓
    return new Decimal(cfg.costBase * Math.pow(mult, n));
  }
  return new Decimal(cfg.costBase).mul(ipow(mult, n));
}

/**
 * `epMult` 的**当前效果**（唯一的实现 ✓）—— 未买恒 1（零回归 ✓）。
 *
 * ⚠️ 同样修**浮点漂移**（与 `epMultPriceAt` 同一个病）：
 *   `Decimal.pow(5, 2)` 给 `25.000000000000007` ✗ —— 而这是玩家看的倍率数字。
 *   等级是整数且实际到不了几百 ⇒ 用精确的整数幂 ✓
 */
export function epMultFactor(state) {
  const lv = Math.max(0, Number(state?.epMultLevel ?? 0) || 0);
  if (lv <= 0) return new Decimal(1);
  if (lv <= 320) return new Decimal(Math.pow(ETERNITY_UPGRADES.epMult.effectMult, lv));
  const v = new Decimal(ETERNITY_UPGRADES.epMult.effectMult).pow(lv);
  return v.isFinite() ? v : new Decimal(Number.MAX_VALUE);
}

/**
 * 从 `level` 起连续买 `count` 级的**真实总价**（= 逐级价之和）。
 *
 * ★ 2025 现状：**`buyEpMult` 已不再调用它** —— 引擎改走
 *   「增量乘法累加器」（见 `engine.js` 的 `newAccumulator`），因为大池子下
 *   这里每级一次 `epMultPriceAt`（含一次 `Decimal` 幂）会慢一个量级。
 *   本函数保留给**测试 / 断言 / 将来的 UI** 用（语义清晰、与真实序列同源）✓
 *
 * ⚠️⚠️ 历史（用户报「永恒增幅价格消耗不对」）：
 *   原来 `buyEpMult` 用的是**几何闭式** `first·(g^k − 1)/(g − 1)` ⇒
 *   形状对，**但它是浮点/Decimal 幂的乘积与相除** ⇒ 实测扣款出现
 *   `488281.0000000004` 这种**漂移**（价格是玩家天天看的数字，不能忍 ✗）
 *   ⇒ 改成**逐级累加真价** ✓（与 `ipDoubleCostFor` 同一个做法）
 */
export function epMultCostFor(level, count) {
  const n = Math.max(0, Number(level) || 0);
  const k = Math.max(0, Math.floor(Number(count) || 0));
  let sum = new Decimal(0);
  for (let i = 0; i < k; i++) sum = sum.add(epMultPriceAt(n + i));
  return sum;
}

/**
 * ★★★ 2025：`epMultAffordableIn` 的**短期缓存**（性能修复）。
 *
 * ── 为什么必要（用户：「修！劳资的性能为什么要花在这个上面」）──
 *   `epMultAffordableIn` **每帧被调用 2 次**（UI 显示下一级可买数 + 买满按钮可用判断），
 *   而它要为**每一级**累加真价：池 1e10000 时要循环 **5000 次** ⇒ 实测 **11.94ms/帧** ✗
 *   可**绝大多数帧里，池子根本没变**（EP 只在永恒时增加，而那之前你先在看别的页）
 *   ⇒ "池子没变 + 等级没变" ⇒ 结果**必然**相同 ⇒ 直接返回上次答案 ✓
 *
 * ── 缓存键为什么用 `log10(pool)` 而不是 `pool.toString()` ──
 *   `toString()` 每次都要**格式化整个 Decimal**（对 1e10000 这种也不便宜，且会分配字符串）。
 *   `log10()` 是一次廉价运算，且"EP 池变了"必然导致 `log10` 变化（除非变化 < 1e-16，
 *   那本来也不影响结果）✓
 *
 * ── ⚠️ 失效条件（必须写全，否则会返回过期答案）──
 *   ① 等级变了（买了之后）
 *   ② 池子变了（EP 增减）
 *   ③ **价格函数变了**（`buyEpMult` 会注入自己的累加器 ⇒ 必须区分）✓
 *   `EPTERNITY_UPGRADES.epMult` 的**配置**变化不在运行时发生 ⇒ 不需要纳入键 ✓
 */
let epMultAffCache = { lv: -1, poolLog: NaN, fn: null, val: -1 };

/** 清缓存（买了 / 存档载入 / 测试要强制重算时调）—— 唯一的失效入口 ✓ */
export function epMultAffResetCache() {
  epMultAffCache = { lv: -1, poolLog: NaN, fn: null, val: -1 };
}

/**
 * ★★★ 2025：`epMult` 价格的**增量累加器**（性能关键路径的唯一实现 ✓）。
 *
 * ── 它做什么 ──
 *   从某一级开始按**升序**连续取价。同一段内用 `price *= mult`（一次 `Decimal.mul`），
 *   跨段才重算一次（段数 ≤ 4）⇒ 每级代价 ≈ 一次乘法 ✓
 *
 * ── 为什么必须"唯一实现"（我又踩了一次）──
 *   原来 `engine.buyEpMult` 里**复制**了一份同样的累加器。于是"每帧 2 次调用"
 *   变成两条独立的遍历：UI 探针一次、买满总价一次 ⇒ 池 1e10000 时 **≈12ms/帧** ✗
 *   （这正是本项目反复出现的病根：**同一件事两条路**）
 *   ⇒ 现在只有这一个工厂；`epMultAffordableIn` 与 `buyEpMult` 都用它 ✓
 *
 * ⚠️ 每次遍历都要**新建**一个（`epMultNewAccumulator()`）—— 它有内部游标，
 *   跨调用复用会让"价格单调递增"这个前提失效 ✗（我犯过：导致买满少买 3 倍）
 */
export function epMultNewAccumulator() {
  const M = ETERNITY_UPGRADES.epMult.costMultTiers;
  let curLv = -1, curSeg = -1, curPrice = null;
  return (lv) => {
    if (lv === curLv) return curPrice;
    const seg = epMultTierAt(lv);
    if (curPrice && lv === curLv + 1 && seg === curSeg) {
      curPrice = curPrice.mul(M[curSeg]);        // ★ 热路径：增量乘法
    } else {
      curPrice = epMultPriceAt(lv);              // 跨段 / 跳级：用真价
    }
    curSeg = seg;
    curLv = lv;
    return curPrice;
  };
}

/**
 * 给定池子能买几级 `epMult`，并把**总价**一并写入 `epMultAffCache.total`。
 *
 * ★ 为什么把总价也带出来：`buyEpMult`（买满）需要总价，
 *   如果它自己再遍历一次，就等于**每帧把那 5000 级算两遍** ✗
 *   ⇒ 一次遍历同时给出 `{ k, total }`，两条路共用 ✓
 *
 * ⚠️⚠️ 2025 修正：原来用 `floor(log10(pool·(g−1)/first + 1) / log10(g))` 求 `k`，
 *   而 `Math.log10` / `Math.floor` 在**边界上会少 1**：
 *     池 3906（恰好 = 1+5+25+125+625+3125）⇒ 只能买 5 级（**少 1 级** ✗）
 *     池 6（恰好 = 1+5）⇒ 说能买 2 级、而买满却**扣 0**（探针与实扣不一致 ✗）
 *   ⇒ 换成**两段**（与 `ipDoubleAffordableIn` 同一套）：
 *     ① 解析上界 `kUB`（把序列当纯等比 ⇒ 只会**高估**，不会低估）
 *     ② **逐级核减**：用真价往回退，直到总价 ≤ 池子 ⇒ **精确**
 *   ⇒ 这样"探针说能买 N 级"与"买满真的买 N 级"**从结构上**不可能再不一致 ✓
 */
export function epMultAffordableIn(level, poolDecimal, priceFn = epMultPriceAt) {
  const n = Math.max(0, Number(level) || 0);
  const cfg = ETERNITY_UPGRADES.epMult;
  const pool = poolDecimal instanceof Decimal ? poolDecimal : new Decimal(poolDecimal || 0);
  const poolLog = pool.log10().toNumber();

  // ★ 短路：池子与等级都没变 ⇒ 答案（含总价）必然相同 ✓
  if (epMultAffCache.lv === n && epMultAffCache.poolLog === poolLog
      && epMultAffCache.fn === priceFn) {
    return epMultAffCache.val;
  }
  const finish = (v, total) => {
    epMultAffCache = { lv: n, poolLog, fn: priceFn, val: v, total };
    return v;
  };

  // ── ③ 循环上界：**没有封顶**（用户裁定：AD 第三段后可以无限购买）──
  //   上界由「池子的量级」解析给出，且**保证只高估**：
  //     `k·log10(mult) ≤ log10(pool)` ⇒ `k ≤ log10(pool)/log10(mult)`
  //     ⚠️ `mult` 取**当前等级所在段**的倍率：段内倍率固定 ⇒ 该式在段内成立；
  //       往后每段倍率只会**更大**（增长更快）⇒ 用本段倍率算出的 k 仍是**高估** ✓
  //     ⚠️ 反例（我错过一次）：用**最大**倍率会得出**更小**的上界 ⇒ 低估 ⇒ 少买 1 级 ✗
  //   ⚠️⚠️ 2025：**删掉了 `HARD_CAP` 绝对上限** —— 用户指出
  //     「我可没说后续抵达不了 1e10000 这个阈值哦」⇒ 我不该替游戏设上限 ✓
  const curMult = cfg.costMultTiers[epMultTierAt(n)];
  const kUB = Math.max(1, Math.ceil(poolLog / Math.log10(curMult)) + 2);

  // ── ② 逐级核减（用**真价**累加）⇒ 精确的那个 `k` 与 `total` ──
  const acc = priceFn === epMultPriceAt ? epMultNewAccumulator() : priceFn;
  const M = cfg.costMultTiers;
  let seg = epMultTierAt(n);
  let price = acc(n);
  let sum = new Decimal(0);
  let k = 0;
  for (let i = 0; i < kUB; i++) {
    if (sum.add(price).gt(pool)) break;
    sum = sum.add(price);
    k++;
    const nseg = epMultTierAt(n + k);         // ★ 共用边界（整数比较，O(1)）✓
    if (nseg === seg) {
      price = price.mul(M[seg]);              // 同段：增量乘法 ✓
    } else {
      seg = nseg;
      price = acc(n + k);                     // 跨段：用真价重算（≤ 4 次）✓
    }
  }
  return finish(k < 1 ? 0 : k, k < 1 ? new Decimal(0) : sum);
}

/** 读缓存里的**总价**（`epMultAffordableIn` 刚被调用过才有效）✓ */
export function epMultAffordableTotal() {
  return epMultAffCache.total instanceof Decimal ? epMultAffCache.total : null;
}

/**
 * ★★ 2025：**永恒里程碑**（用户设计稿 `第三层设计.txt` 第 36~44 行，逐条对应）
 *
 * ── 解锁条件 ──
 *   **按永恒次数**（用户 2025 裁定）：`need` = 需要永恒几次。
 *   所以第 N 次永恒之后，前 N 条一起生效。
 *
 * ── 现状（2026 核对）──
 *   ⚠️⚠️ 这一段原来写着「已完整落地：`em1` `em3` `em6`；占位：`em2` `em4` `em5` `em7` `em8`」
 *     —— **它已经过期了**：`em2` / `em5` / `em7` 早就实装（`pending` 标志都没了），
 *     只有 `em8` 还是占位 ✗（2026 实测抓到，与 `CONFIG-FACTS.md` 冲突）
 *   ⇒ 现在以**机器生成的权威**为准（`tools/config-facts.mjs` → `docs/CONFIG-FACTS.md`）：
 *     · 已实装：`em1` `em2` `em3` `em4` `em5` `em6` `em7`
 *     · 占位（`pending: true`）：`em8`（等永恒自动化页面，设计稿第 44 行）
 *   ⇒ **加/改条目后必须回来看这一行**（这里已经漂移过一次了）✓
 *
 * ⚠️ **不要只加条目不加 `pending`** —— `tools/eternity-lab.mjs` 会断言
 *   "标了 pending 的条目必须在 UI 上显示为待办"，避免玩家以为拿到了却没效果 ✗
 */
export const ETERNITY_MILESTONES = [
  {
    id: "em1",
    need: 1,
    desc: "每次永恒后保留非重复购买的无限升级（每 2 次永恒保留 1 个）",
    /**
     * 保留几个非重复 ∞ 升级 = `floor(永恒次数 / 2)`。
     * 选取规则：按 `INFINITY_ORDER` 的**倒序**（该数组大体是从便宜到贵）⇒ 保留**最贵**的那些，
     * 因为越贵的越难重新买回来、保留价值越高。
     */
    effect: { kind: "retainInfinity", per: 2 } },
  {
    id: "em2",
    need: 2,
    /**
     * ★★★ 2025：**已实装**（原来是 `pending: true`，理由是「neko / 好感度系统尚未上线」）。
     *
     * ⚠️ 那条理由**已经过时**：`NEKO` 常量、好感度三档、道具、猫猫子页
     *   **早就在跑了**（只有"SDK 真握手"还没接，而那与本里程碑无关）✗
     * ⇒ 现在落地：把 `nekoGlobalExponent()` 的**加成部分翻倍** ✓
     *   设计稿第 38 行原文：「neko系统提供的全局加成效果翻倍（**数值翻倍**）」
     *   · 加成部分 = 三档叠乘 = `1.002 × 1.005 × 1.015 = 1.0221151`
     *   · em2 之后 = `1 → **2.0442302**`（即 `1 + 2×(1.0221151 − 1)`）✓
     *   · ⚠️ 好感度 ≤ 25 时**仍然恒为 1**（"neko 没练就完全没加成"这条语义不许被破坏）✗
     *
     * （"暗物质 / 第二台相变仪"是 **em4** 的内容、不是本条 ⇒ 见 em4 的说明）✓
     */
    effect: { kind: "nekoBonusDouble" },
    desc: "neko 系统提供的全局加成效果翻倍" },
  {
    id: "em3",
    need: 3,
    desc: "宇宙涨落获得量子时不再重置 ZPE",
    pending: false },
  {
    id: "em4",
    need: 4,
    desc: "优化暗能量获取公式，并解锁暗物质与第二个相变仪",
    /**
     * ★★★ 2026：**已实装**（原为 `pending: true`，理由是「暗物质/第二相变仪尚未实现」）。
     *
     * 依据 = 设计稿第 50~52 行（原文逐字）：
     *   「在暗能量下提供第二个子页面：暗物质
     *     消耗ep获取暗物质，暗物质依赖个数通过第二个相变仪提升第一个相变仪的获取效率
     *     （剩下的还在想）」
     * ⇒ 落地在 `DARK_MATTER` / `darkMatterUnlocked()` / `darkMatterAdditiveTerm()`（见文件末尾）
     *   与 `engine.js` 的 `buyDarkMatter()`、`formulas.js` 的 `darkEnergyRate()` ✓
     *
     * ★★★ 2026：**两半都已落地**（此前记录是"只落地了后半"，现已补齐）✓
     *   · 后半「解锁暗物质与第二个相变仪」 ⇒ ✅ 已落地（就是上面那批）
     *   · 前半「**优化暗能量获取公式**」 ⇒ ✅ **已落地**（2026 用户裁定：
     *     「我选择那个**能减时间最少**的方案，即刻执行」）：
     *       落点 = `DE_UPGRADES.deGainBase.em4EffectMult`（相变增幅每级倍率 **1.10 → 1.12**），
     *       唯一入口 `deGainBaseEffectMult(state)` —— **实发**（`darkEnergyGainPerConversion`）、
     *       **S 判据**（`computeS`）、**显示**（`deGainBase.desc`）三处都走它 ✓
     *       依据 = 拉表 + 真引擎实测的候选表（见 `docs/DARK-MATTER.md` §8-1）：
     *         按"首次永恒省时"排，`1.10→1.12` = **−1.9 分**（最小）｜`1.10→1.15` = −8.9 分｜
     *         `phaseShift 1.5→1.6` = −4.3 分｜自增长两条 = **0.0 分**（不是瓶颈）
     *       ⚠️ 手感是**刻意的保守**：基线 5.62 小时，只省 **1.9 分钟（0.56%）** ✓
     *       ⚠️ S 判据会被抬高：无 em4 = 0.7263｜有 em4 = **0.7707**（两者都 < 1 ✓ 余量 0.229）
     *
     * ⚠️ 关于 `effect.kind`（踩过的坑，值得说清）：
     *   **永恒里程碑的 `effect` 没有任何消费者** —— `dreamUpgradeEffects()` 才按
     *   `effect.kind` 泛化分发（`DREAM_UPGRADES` 专用）。所以这里写的 kind 是
     *   **给人看的标签**，真正的判据是 `hasEternityMilestone(state, "em4")` ✓
     *   （`R-REPLACEMENT.md` §8.1 的教训：`effect.kind` 声明若没有"声明→handler"
     *     表驱动，就会与实现脱节 —— 所以**明说它是标签**，而不是假装它驱动代码 ✓）
     */
    effect: { kind: "unlockDarkMatter" } },
  {
    id: "em5",
    need: 5,
    desc: "永恒点数量能倍增无限点数量",
    effect: { kind: "ipMultByEpLog" } },
  {
    id: "em6",
    need: 6,
    desc: "熵到粒子的熵消耗再除以 1.2",
    effect: { kind: "entropyCostDiv", value: 1.2 } },
  {
    id: "em7",
    need: 7,
    /**
     * ★★★ 2026（用户裁定）：「修改为 **N.E.K.O 提供的加成再翻倍**」✓
     *   —— 与 em2 同 kind；实发走 `em7BonusMult()`（唯一入口）✓
     */
    effect: { kind: "nekoBonusDouble" },
    desc: "N.E.K.O 好感度提供的全局加成**再翻倍**；每次永恒 **+1 次无限**，且**打破无限默认解锁**" },
  {
    id: "em8",
    need: 8,
    // 2026 user ruling: em8 unlocks the TANGRAM system (no longer pending).
    effect: { kind: "unlockTangram" },
    desc: "解锁七巧板系统（摆块盖住三条轴换加成 + 拼装挑战）" },
];

/**
 * 该永恒里程碑是否已达成（`eternityCount >= need`）。
 *
 * 注意与 `pageUnlocked` 的区别：那是**页面**解锁的永久记录；这里是**里程碑达成**。
 * 两者都永不重置，但判定源不同（这里读永恒次数，永恒次数本来就永久保留 ✓）。
 */
export function hasEternityMilestone(state, id) {
  const m = ETERNITY_MILESTONES.find((x) => x.id === id);
  if (!m) return false;
  return (state?.eternityCount ?? 0) >= m.need;
}

/** 已达成且**已实装**的永恒里程碑（`pending` 的不算，供效果读取方使用） */
export function eternityMilestonesActive(state) {
  return ETERNITY_MILESTONES.filter((m) => !m.pending && hasEternityMilestone(state, m.id));
}

/** 永恒里程碑的显示顺序（UI 与 lab 共用） */
export const ETERNITY_MILESTONE_ORDER = ETERNITY_MILESTONES.map((m) => m.id);

/**
 * ★★ 2025 em5：**永恒点倍增无限点** —— `IP 收益 ×(1 + log10(累计永恒点))`
 *
 * ── 口径选择（用户 2025 裁定：**口径④**）──
 *   设计稿只写「永恒点数量能倍增无限点数量」，没写公式。候选里：
 *     · ① `M ×= 累计EP`      ⇒ **发散反馈环** ✗
 *     · ② `M ×= 10^累计EP`   ⇒ 第 22 轮就溢出 `Infinity` ✗
 *     · ④ `M ×= (1+log10(累计EP))` ⇒ 每轮增长因子**有界**（趋于常数）⇒ 只是指数增长 ✓
 *   实测（`tools/eternity-lab.mjs --check` 有断言）：
 *     IP 越深 → EP 越多 → M 越大 → 下一轮更深 是**闭环**，
 *     而 `EP = 5^(log10(IP)/308−0.7)` 提供了阻尼（IP 每 ×10，EP 只涨 ~1.1%）。
 *     ①② 的增长率会**逐轮递增**（双指数）⇒ 环失控；④ 的增长率有界 ⇒ 安全。
 *
 * ⚠️ 读的是 **`eternityPointsTotal`（累计）**，不是当前持有 ——
 *   否则买永恒升级花掉 EP 会让这个加成反复丢失（见 state.js 的字段说明）。
 * ⚠️ 有界性来源：`1 + log10(x)` 随 x 只**对数**增长 ⇒ 不进 runaway 池 ✓
 */
export function em5IpMult(state) {
  if (!hasEternityMilestone(state, "em5")) return new Decimal(1);
  const total = state?.eternityPointsTotal ?? new Decimal(0);
  const l = total.gt(1) ? total.log10() : new Decimal(0);
  return new Decimal(1).add(l.max(0));
}

/**
 * 本次永恒能拿多少永恒点（纯函数，UI 与断言共用）。
 *
 * @param {Decimal} infinityPoints
 * @returns {Decimal} 不到门槛就是 0
 */
export function em2BonusMult(state) {
  return hasEternityMilestone(state, "em2") ? NEKO_BONUS_DOUBLE : 1;
}

/**
 * ★★★ 2026（用户：「永恒里程碑 7，修改为 neko 提供的加成再翻倍」）——
 *   em7 与 em2 同一套写法：**只判里程碑是否达成**，UI 与公式都读这里 ⇒ 显示 == 实发 ✓
 */
export function em7BonusMult(state) {
  return hasEternityMilestone(state, "em7") ? NEKO_BONUS_DOUBLE : 1;
}

/**
 * 好感度的**写入通道**（唯一的写入点 ✓ —— 与「只走既有购买函数」同一套纪律）。
 *
 * · 夹到 `[NEKO.min, NEKO.max]`（正值允许超过 `max`？⇒ **不允许**：`max` 就是硬上限 100，
 *   NEKO.md 的"正值可超 100"指的是**档位判定**不受 100 限制，而数值本身要封顶防爆）
 *   ⚠️ 这一点我按"安全优先"实现：封顶 100。若你要"可超 100 的数值"，告诉我改 `max` ✓
 * · `5 分钟波动 < 8`（`NEKO.driftMax`）—— 用 `state.nekoDriftStamps` 记录最近窗口内的累计变化
 *   ⚠️ 边界由**调用方**（道具 / SDK 通道）负责限流；本函数只保证**单次写入**不越界
 * @returns {number} 实际变化量（可能小于请求量，被窗口预算削减）
 */
export function eternityPointGain(infinityPoints) {
  if (infinityPoints.lt(new Decimal(10).pow(ETERNITY.goalLog10))) return new Decimal(0);
  const ep = new Decimal(ETERNITY.base).pow(
    infinityPoints.log10().div(ETERNITY.divisor).sub(ETERNITY.offset),
  ).floor();
  return ep.lt(1) ? new Decimal(1) : ep;   // 门槛处正好 1 点，兜底防止浮点掉到 0
}

/**
 * 引擎价格的 **log10**（分段几何，闭式）。
 *
 * 分段的意义：每段内是等比数列，段与段之间是**乘性跳变**，所以整体仍是闭式 ——
 * 「买满」不需要逐级循环。
 */

/** ZPE 引擎是否已解锁 */

/**
 * ★★★ 2026-10-22（用户：「本次 EP 收益」= **A: 显示 ≠ 实发**）—— **EP 收益的唯一入口**
 *
 *   = `eternityPointGain(IP) × epMultFactor(state)`（EP ×5 升级的因子 ✓）
 *
 * 踩坑（经典复刻）：结算侧乘了 `epMultFactor` ✓，界面「本次收益」却只算
 *   `eternityPointGain(IP)` ✗ ⇒ 买了「永恒增幅」后面板显示 ×1、实际到账 ×5 ✗
 * ⇒ 现在两边都必须调本函数 ✓（`tools/consistency.mjs` 有守卫 ✓）
 */
export function eternityGain(state) {
  return eternityPointGain(state?.infinityPoints ?? 0).mul(epMultFactor(state));
}