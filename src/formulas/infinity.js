/**
 * formulas/infinity.js —— 坍缩与无限层判据 / 里程碑 / 自动化判据
 *
 * ★ 2026 模块化：由 1,116 行的 formulas.js 按领域拆出（声明与注释逐字保留）。
 *    对外统一从 `src/formulas.js`（barrel）导入。
 */
import { COLLAPSE, DE_MILESTONES, ZPE_MILESTONES, crunchThreshold, em5IpMult, engineBonusMult, infinityPointGain, ipDoubleMult, quantumToIPGain } from "../config.js";
import { hasV9, hasZpe } from "../state.js";
import { spaceChallengePower } from "../space.js";

export function collapseUnlocked(state) {
  return state.peakMatter.gte(COLLAPSE.unlockMatter);
}

/** 能不能大坍缩（物质到双精度上限） */
export function canBigCrunch(state) {
  return collapseUnlocked(state) && state.resources.matter.gte(crunchThreshold());
}

/**
 * 大坍缩能拿多少无限点（**唯一数据源**：界面显示与引擎实际发点都必须走这里）。
 *
 * ⚠️ 踩过的坑：`doBigCrunch` 曾经自己算 `infinityPointGain × 3^①`，**没走这个函数** ——
 *    于是"显示"与"实发"会脱节（我加铸币倍率后立刻发生：界面乘了铸币、引擎没乘）。
 *    现在引擎直接 `const ip = bigCrunchGain(state)`，并由
 */
export function bigCrunchGain(state) {
  const ipMult = ipDoubleMult(state);
  // ① 的加成（3^等级） → 铸币倍率 → 量子铸币的额外点数
  // ★★ 2025：再乘 **em5**（永恒里程碑 5：永恒点倍增无限点 —— `1 + log10(累计EP)`）。
  //   放在**最外层**：它是"最终乘区"语义，乘在所有 IP 来源之后（与 ① 同一位置）✓
  // ★★★ 2025（用户裁定）：**量子 → IP 的加成也吃引擎倍率**（5 条量子加成之一）
  //   `engineBonusMult = costGrowth^引擎等级` ⇒ 买一级 ⇒ 价格 ×1.87、这条 ×1.87 ⇒ 同速 ✓
  return infinityPointGain(state.resources.matter, state.brokenInfinity, state)
    .mul(ipMult)
    .add(quantumToIPGain(state).mul(engineBonusMult(state)))
    .mul(em5IpMult(state))
    .mul(spaceChallengePower(state));
}

// ══════════════════════════════════════════════════════════
// ZPE
// ══════════════════════════════════════════════════════════

/**
 * ZPE 倍率。
 *
 * 原稿：`1 + 0.1 × log10(ZPE+1)` —— 太弱（ZPE 从 1e10 到 1e100，倍率只从 ×2 到 ×11）
 * 现在：`(ZPE+1)^ZPE_EXPONENT`，其中 `ZPE_EXPONENT = 0.02`（**别写成 0.05，那是候选值**）。
 *     `1e10 → ×1.58`、`1e30 → ×3.98`、`1e100 → ×100`。
 *     0.02 是**刻意贴近原稿**的：在 1e30 处与原稿几乎相等，早期还略弱一点。
 *
 * ⚠️ 这个指数是**自反馈**的源头：ZPE 越高 → 倍率越高 → 产出越快 → ZPE 更高。
 *    它（以及它在 `zpeRate` 里被乘了几次）决定 ZPE 随时间是线性还是超线性增长 ——
 *    见 tools/zpe-engine-lab.mjs 的 `a < 1` 安全线。
 *
 * 用 `ZPE+1` 而不是 `ZPE`，是为了 ZPE=0 时得到 1 而不是 0。
 */
export function checkZpeMilestones(state) {
  const got = [];
  for (const m of ZPE_MILESTONES) {
    if (!state.zpeMilestones[m.id] && state.zpeTotal.gte(m.need)) {
      state.zpeMilestones[m.id] = true;
      got.push(m);
    }
  }
  return got;
}

/**
 * ★ 量子里程碑（2025 草案）：键在**累计量子对数**上（`quantumPairsTotal`，大坍缩不清零）。
 *
 * 为什么用累计量：当前量子数每次大坍缩归零 ⇒ 键在它上面的里程碑第一轮就拿完、之后形同虚设。
 * 这正是 AD 的手法③（`totalAMMult` 用累计反物质、`currentAMMult` 用当前值）。
 * 详见 docs/QUANTUM-MILESTONES.md。
 */
export function checkDeMilestones(state) {
  const got = [];
  for (const m of DE_MILESTONES) {
    if (state.deMilestones[m.id]) continue;
    if (!gateOpen(state, m)) continue;
    if (state.darkEnergyTotal.gte(m.need)) {
      state.deMilestones[m.id] = true;
      got.push(m);
    }
  }
  return got;
}

function gateOpen(state, m) {
  if (!m.gate) return true;
  if (m.gate.voidUpgrade && !state.voidUpgrades[m.gate.voidUpgrade]) return false;
  if (m.gate.matter && state.resources.matter.lt(m.gate.matter)) return false;
  return true;
}

/**
 * 返回本次新达成的暗能量里程碑 id 列表。
 *
 * ⚠️ 判定用 **darkEnergyTotal（历史总量）**，不是 darkEnergy（当前余额）。
 *
 * 踩过：原来用余额判定，而界面显示的是总量 —— 两边不是同一个变量。
 * 玩家花暗能量买升级后余额 < 总量，于是看到「1.88e10 / 1e10」却判定未达成。
 *
 * 更糟的是这不只是显示问题：**如果玩家一直把暗能量花掉，
 * 余额可能永远攒不到门槛，里程碑就永远拿不到** —— 一个和玩家行为对赌的陷阱。
 *
 * darkEnergyTotal 从不被坍缩/大坍缩重置，所以「累计产出过多少」才是正确语义。
 */
export function isAutoAcquire(state, kind) {
  if (!hasV9(state)) return false;
  if (kind === "upgrade") return hasZpe(state, "m2");
  if (kind === "trap") return hasZpe(state, "m5");
  return false;
}

// ══════════════════════════════════════════════════════════
// 里程碑达成检测
// ══════════════════════════════════════════════════════════

/** 返回本次新达成的 ZPE 里程碑 id 列表 */

