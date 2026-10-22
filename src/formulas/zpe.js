/**
 * formulas/zpe.js —— ZPE 倍率 / 产出 / 惩罚 / 熵阱 / ZPE 速率
 *
 * ★ 2026 模块化：由 1,116 行的 formulas.js 按领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/formulas.js`（barrel）导入。
 */
import { DE_MILESTONES, DE_PENALTY, DE_UPGRADES, INFINITY_UPGRADES, ZPE_EXPONENT, engineBonusMult, qOf, quantumZpeMultBonus, voidBoostMult, zpeEngineAddBonus, zpeEngineCountFreqUnlocked, zpeEngineMultBonus, zpeEngineProdMult } from "../config.js";
import { D } from "./core.js";
import { countFreqAddTerm, globalMultiplier } from "./global.js";
import { deLevelOf, hasDe, hasV9, hasVoid, hasZpe } from "../state.js";
import Decimal from "../../dist/break_eternity.esm.js";
import { tangramRewardEffects } from "../tangram.js";   // ★ 2026-10-22：前两组清满 ⇒ neko 指数作用于 ZPE ✓
import { nekoGlobalExponent } from "../config/neko.js";

export function zpeMultiplier(state) {
  const z = state.zpe.gt(0) ? state.zpe : D(0);
  // ★ 2025：① 不再抬指数（旧的  已删除；指数恒为 ZPE_EXPONENT ✓）
  const exp = ZPE_EXPONENT;
  let m = z.add(1).pow(exp);
  // ① 加法区：`m += 等级 × addPerLevel`（与「零点耦合」同一写法）
  m = m.add(zpeEngineAddBonus(state));
  // ②b 乘算：`m ×= 2^等级`
  m = m.mul(zpeEngineMultBonus(state));
  // ★ 2025 设计稿修订：③ 改成**量子对 zpe 倍率的加成**（用户改）
  //
  //   为什么换掉原来的「暗能量倍率 ^1.03」：
  //     它把**暗能量倍率**塞进了 zpeMultiplier，而暗能量倍率依赖暗能量总量、
  //     暗能量又由相变仪从 ZPE 产出 ⇒ 它在**同一个 tick 里会变** ✗
  //     ⇒ 显示（瞬时快照）与实发（整步）用了不同时刻的值 ⇒ 实测 6% 偏差（consistency 抓到 ✗）
  //     （判别实验：关掉它 ⇒ consistency 立刻全绿 ✓；关掉 ④ ⇒ 仍红 ✗ ⇒ 元凶是它）
  //   换成**量子**的加成后：走**加法区**（与 darkEnergyMultiplier 里 `+q²` 同一形制 ✓），
  //     加法项的**相对**漂移极小 ⇒ 不再破坏"显示 == 实发" ✓
  // ⚠️ **暂时关闭**（2025）：`量子 → zpe 倍率` 这条一旦接上，`consistency` 会报
  //    物质 41% 偏差 ✗ —— 根因不是这条设计本身，而是**引擎取值时机**：
  //    `advance` 按 5 秒切 chunk，每 chunk 重算因子；量子是**阈值跳变**量
  //    ⇒ 后段 chunk 用的是跳变后的 q、而界面显示的是起始 q ⇒ 分叉 ✗
  //    ⇒ 修法是「步首快照」（把因子**传进** tick，而不是覆盖 state ✗），
  //      那需要一个专门的小重构 ⇒ 落成前这一行保持关闭 ✓
  // ⚠️ **关闭**（2025）—— 我试了三种修法（跨 chunk 快照 / 步末结算 / 步首结算），**三种都失败** ✗✗✗
  //   实测（`consistency.mjs` 物质那条）：
  //     未接线        ⇒ 全绿 ✓
  //     + 跨 chunk 快照 ⇒ 仍红（该测试**直接调 tick**，不走 advance ⇒ 快照用不上 ✗）
  //     + 步末结算     ⇒ 仍红 97.8%（捕获落在被测量的那一步里 ✗）
  //     + 步首结算     ⇒ 更坏：四条速率全 100% 偏（"待结算"在测量前就落到 state 里 ✗）
  //   ⇒ 三个假设全错 ⇒ **停止猜测** ✗
  //   ⇒ 正确下一步：**先打点**（把测量前后/步首步末的 q、zpeMultiplier、zf、matterCoeff 全打出来），
  //      看清差在哪一层再动 ✗ —— 而不是继续猜 ✓
  //   ⚠️ 另注：`qOf(state)` + `state.quantumFrozen` 的快照（`advance` 用）是**无害的改进** ✓ 已保留 ✓
  // ★ 2025 状态：**设计已确认可行，卡在"加成数量"上** ✗
  //   打点定位后的结论：
  //     · 之前 97.8% 的"显示≠实发"**与量子无关** ✗ —— 是 `consistency` 拿"瞬时速率"
  //       和"整步闭式解"比（`1 + c·dt/(2P0)`）✗；改成 dt=1e-7 后**速率 8/8 全一致** ✓
  //     · 但接上 `+q³` 后，另外 3 条暗能量检查变成 0.00% ✗：
  //       该场景 q≈16 ⇒ `+q³ = 4096`，而 ZPE 倍率基础只有 ≈12 ⇒ 量子项大 340 倍
  //       ⇒ **把暗能量升级的效果淹没了** ✗（高效相变 / 相变增幅 / 凝聚斜率 都看不出变化）
  //   ⇒ 所以这条设计的**落点没问题** ✓，要定的是**系数**（用户：得算数据 ✓）
  //     候选见 `quantumZpeMultBonus`：+q²（温和）/ +q³（强势，会压过暗能量层 ✗）/ 2^q（✗ 不推荐）
  // ★★★ 2025（用户裁定）：量子的 ZPE 加法项也吃引擎倍率（5 条之一）
  m = m.add(quantumZpeMultBonus(qOf(state), engineBonusMult(state)));   // ★ 系数 0.1（q³/10）
  if (state.zpeFixedMultiplier) m = m.mul(state.zpeFixedMultiplier);
  if (hasVoid(state, "v8")) m = m.mul(1.5).mul(voidBoostMult(state));
  // ★ dm1「ZPE 倍率 ×2」。
  //
  //   原来这条里程碑靠 `state.zpeFixedMultiplier` 传递，但**没有任何代码
  //   往那个字段里写值** —— 效果对象 `{kind:"zpeFixedMultiplier"}` 没有处理器。
  //   所以 dm1 从移植起就是**死的**（探针实测：切换 dm1 标记，zpeRate 完全不变）。
  //
  //   现在改成直接检查里程碑标记，和 dm2/dm3/dm5/dm4b 的写法一致，
  //   数值从 DE_MILESTONES 读（单一数据源，不抄）。
  const dm1 = DE_MILESTONES.find((x) => x.id === "dm1");
  if (dm1 && hasDe(state, "dm1")) m = m.mul(dm1.effect.value);
  // ★ ∞ 层 ②「零点耦合」：无限点数量加进 ZPE 倍率的**加法区**（a区）
  //   ⚠️ 位置是加法：`m = m + 1×IP`，不是乘。它会被后面引擎那类"最终加成"再乘一遍。
  if (state.ipToZpeBought) {
    m = m.add(D(INFINITY_UPGRADES.ipToZpe.perIp).mul(state.infinityPoints ?? 0));
  }
  // ★ ZPE 引擎 ③：让 ZPE 倍率**吃「计数频率」加成**（用户原案第三条）。
  //
  //   位置说明（乘区）：落点仍然是 **ZPE 倍率**（蓝色），计数频率是**跨乘区的输入**。
  //   效果：计数频率对 ZPE 产出的指数从 2.00 → 3.74（因为倍率在产出里出现 ~1.74 次）。
  //   它安全的原因：计数频率是**仿射**项（1+0.05×等级），随资源只按对数增长，
  //   所以不会把自反馈指数 a 顶上去（见 docs/ZPE-ENGINE.md 第 4 节）。
  if (zpeEngineCountFreqUnlocked(state)) {
    m = m.mul(countFreqAddTerm(state));
  }
  return m;
}

/**
 * ZPE 产出倍率。
 * v1 给 ×3，且「每拥有一个虚空升级 +1000%」（即 ×(1+10n)），买齐 9 个共 ×273。
 * v6 再给 ×5。
 */
export function zpeBaseMultiplier(state) {
  let b = D(1);
  if (hasVoid(state, "v1")) {
    b = b.mul(3);
    const count = Object.values(state.voidUpgrades).filter(Boolean).length;
    b = b.mul(D(1).add(D(count).mul(10)));
  }
  if (hasVoid(state, "v6")) b = b.mul(5).mul(voidBoostMult(state));
  return b;
}

/**
 * 暗能量对 ZPE 产出的惩罚。返回的是「乘数」，越小惩罚越重。
 *
 * ── 两处修正（原稿问题）──
 *
 * ① **指数 1.5 -> 0.5**（方案 B）
 *    原稿是 `1/(1 + 0.001 × DE^1.5 × (1−减免))` —— 惩罚**超线性**，
 *    而暗能量的唯一来源就是 ZPE。于是它掐住自己的水管，形成死亡螺旋：
 *        暗能量 1e0  -> 1.00e-6/秒
 *        暗能量 1e4  -> 3.65e-9/秒
 *        暗能量 1e10 -> 9.31e-18/秒     ← 单调递减
 *    改成 0.5 次方后，惩罚是**次线性**的，而全局加成是指数增长，
 *    所以获取速度会重新转正。
 *
 * ② **加下限**（方案 B 附带）
 *    保证 ZPE 永远不会被完全掐死（否则一旦踩进螺旋就没救）。
 *
 * ③ **减免曲线平滑化**（方案 C）
 *    见下面 reduction 的注释。
 */
export function zpeProductionPenalty(state) {
  const de = state.darkEnergy;
  if (de.lte(0)) return D(1);
  const lv = deLevelOf(state, "dreamAnnihilation");

  // ★ 方案 C（改）：减免 = 等级 / 满级 —— 线性、平滑，**满级正好 100%**
  //
  //   原稿是 `min(等级,3)/3`：3 级拉满，4~10 级完全无效，
  //   而且 0/1/2 级几乎没感觉、第 3 级突然跳 10 个数量级。
  //
  //   先用了几何曲线 `1−0.85^等级`，但 10 级只到 80.3%，**惩罚还在**。
  //   用户指出：原稿的设计意图是「暗能量升级满级后不再有 ZPE 削弱倍率」。
  //   所以改成线性 —— 每级 10%，第 10 级正好 100%，惩罚彻底归零。
  const maxLv = DE_UPGRADES.dreamAnnihilation.maxLevel ?? 10;
  const reduction = Decimal.min(lv, D(maxLv)).div(maxLv);

  // ★ 方案 B：总系数 0.001 × DE^0.5（原来是 DE^1.5）
  const total = D(DE_PENALTY.coeff).mul(de.pow(DE_PENALTY.exponent)).mul(D(1).sub(reduction));
  const penalty = D(1).div(D(1).add(total));

  // ★ 下限：ZPE 永远不会被完全掐死
  return Decimal.max(penalty, D(DE_PENALTY.floor));
}

// ══════════════════════════════════════════════════════════
// 暗能量
// ══════════════════════════════════════════════════════════

/**
 * 暗能量倍率。
 *   x = log2(DE + 1)
 *   系数 = min(0.1 + x/20 × 0.15, 0.25)     展开后是 1 + 0.1x + 0.0075x²
 *   倍率 = (1 + x × 系数) × 1.1^真空加速等级
 *
 * 前期线性、中期二次、后期线性 —— 平滑的分段强度曲线。
 */
export function effectiveTraps(state) {
  let t = state.resources.traps;
  if (hasZpe(state, "m4")) {
    const bonus = hasV9(state) ? 2 : 1;
    t = t.mul(D(1).add(zpeMultiplier(state).mul(bonus)));
  }
  return t;
}

// ══════════════════════════════════════════════════════════
// 各产线速率（每秒）
// ══════════════════════════════════════════════════════════

/**
 * ★★★ 2025：**物质系数（唯一入口）** —— `dM/dt = particle × matterCoeff(state, particle)`
 *
 * ── 为什么搬到 formulas.js ──
 *   它原来在 `engine.js`，而 `matterRate()`（显示侧）在这里**各算一遍基础产出** ⇒
 *   两处极易分叉。项目已因此踩过 **4 次「显示 ≠ 实发」**：
 *     ① 铸币倍率只在界面生效
 *     ② `dm4b` 只加在 `darkEnergyRate()`
 *     ③ 沉潜蓄能只加在 `matterRate`
 *     ④ **2025 本轮**：`v3` 那里写裸 `D(1.5)`、`matterRate` 写 `D(1.5)×voidBoostMult`
 *        ⇒ 引擎 17 级时显示比实发大 **2.09e6**（再被 `^k` 放大）✗
 *   ⇒ 根治：**两边共用这一个函数**（`formulas.js` 里早先留的"理想解"注释，本次落实）✓
 *
 * ── 过载 / 爬升的落点 ──
 *   用户裁定「**有且只影响获得速率**」⇒ 两个因子乘在**系数**上：
 *     · 只改 `dM/dt`，不改物质存量、不改阈值 ✓
 *     · `matterRate` 读同一函数 ⇒ 显示 == 实发 ✓
 *
 * @param {object} state
 * @param {Decimal|number|null} particleCount 粒子数。
 *   ⚠️ **默认取 `state.resources.particle`** —— 因为「系数」按定义就是**完整**系数
 *     （含过载/爬升）。若默认给 null，`matterCoeff(state)` 与 `matterRate(state)` 就会
 *     给出不同的值（实测差 8.18e17）⇒ 又变成"两处各算一遍" ✗
 *     tick 里传**本片的 `P0`**（此刻 `state.resources.particle` 还是旧值）。
 */
export function zpeRate(state) {
  let prodMult = hasVoid(state, "v6") ? zpeMultiplier(state) : D(1);
  if (state.zpeFixedMultiplier) prodMult = prodMult.mul(state.zpeFixedMultiplier);
  const out = effectiveTraps(state)
    .mul(globalMultiplier(state))
    // ★ 方案 1：全局加成再进一次（见上方说明）
    .mul(globalMultiplier(state))
    .mul(zpeBaseMultiplier(state))
    .mul(prodMult)
    // ★ ZPE 引擎 ②：按**引擎等级**大幅提速 ZPE 产出（`(1 + 0.1×等级)²`）。
    //   等级用无限点买 ⇒ 随时间线性增长 ⇒ 这一项 ∝ t² ⇒ ZPE ∝ t³（越来越快）。
    //   它只改常数速率 c，不碰自反馈指数 a —— 见 docs/ZPE-ENGINE.md。
    .mul(zpeEngineProdMult(state))
    .mul(zpeProductionPenalty(state));

  // ★★★ 2026-10-22（用户新增）：「完成**前两组**拼装挑战后，
  //   neko 好感度系统提供的**指数**对 **ZPE 产量**生效」 ✓
  //   ⇒ `out ^ nekoGlobalExponent(state)`（指数 1.000 ~ 1.0221，来自 `config/neko.js`）
  //   ⚠️ 唯一入口仍是 `zpeRate()`（`tick` 与界面都读它 ⇒ 显示 == 实发 ✓）
  //   ⚠️ 是指数 ⇒ 会抬 `p` 一点点（≈ +2.2% 相对）；若以后把 neko 指数做大，**必须重算 p** ✗
  const rw = tangramRewardEffects(state?.tangramCleared);
  if (!rw.nekoExponentOnZpe) return out;
  const exp = nekoGlobalExponent(state);
  return exp === 1 ? out : out.pow(exp);
}

/**
 * 实际每次相变转换给多少暗能量（**含 dm4b**）。
 *
 * ⚠️ **必须两边共用这一个函数。**
 *
 * 踩过：dm4b 最初只加在 `darkEnergyRate()` 里，而 engine.js 的实际转换
 * 用的是 `darkEnergyGainPerConversion()` —— 于是 dm4b 变成死代码：
 * 界面上的速率显示变了，**实际产出一点没变**（玩家反馈「还是涨不动」）。
 *
 * 教训：一个效果如果有两条计算路径，它迟早只在一条上生效。
 * 正确做法是让两条路都走同一个函数。
 */