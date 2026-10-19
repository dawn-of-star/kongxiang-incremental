/**
 * neko/snapshot.js —— 只读状态快照（含宿主用快照与数字格式化）
 *
 * ★ 2026 模块化：由 907 行的 neko.js 按职责拆出（声明与注释逐字保留）。
 *    对外统一从 `src/neko.js`（barrel）导入。
 */
import { nekoKeyLogEntries, nekoLogEntry } from "./log.js";

/**
 * src/neko.js —— **N.E.K.O 接入层**（`docs/NEKO.md` §5 / §9）
 *
 * ══════════════════════════════════════════════════════════
 * ★★★ 定位：**无宿主版本**（用户裁定「我同意先做无宿主版本」）
 * ══════════════════════════════════════════════════════════
 * 我们是**纯静态**项目（可部署到 GitHub Pages）⇒ **不能假设宿主存在**。
 * 所以这一层的纪律是：
 *   ① 本文件**不 import 任何 N.E.K.O 的东西**（SDK 由宿主注入，不是我们的依赖）
 *   ② 对外接口在**没有宿主时全部优雅降级**（no-op / 返回 false），
 *      游戏主流程一行都不会因为它而改变 ✓
 *   ③ 它提供的是**我们这侧的数据契约**（§5 快照 / §9 日志 / §6 动作白名单）——
 *      这些东西**对内也有用**（调试、回放、断言），所以不依赖对面回话就能做 ✓
 *
 * ── 背景（实测，见 TODO「P9」）──
 *   · SDK 的传输机制 = **同源 HTTP**（不是 WebSocket / postMessage）：
 *     `POST /api/game/logs`、`POST /api/game/<type>/<op>`
 *   · 宿主在页面里注入 `#neko-minigame-host-launch`（JSON）→ bootstrap 吃掉它 →
 *     提供 `window.createNekoMiniGameSameOriginHost` → 我们 `connect()` 拿 transport
 *   · 宿主会校验 `manifest.id` / `manifest.version` 与注册表**完全一致**
 *     （不一致 ⇒ `code: 'game_unregistered'`）⇒ 所以**注册**是接入的前提（§8 问题 1）
 *   · ⚠️ **现有小游戏（badminton / soccer）都没用 SDK** ⇒ 我们**没有范例可抄**，
 *     这一层是我们自己钉的契约（用户原话：「我们是首个这么干的开发者/工具组」）
 *
 * ── 与 `NEKO.md` 的差异（诚实记录）──
 *   §9 写的是「日志格式 `{ t, kind, text, data }`，kind 用固定枚举」
 *   而实现里 `pushLog` 原来只推 `{ t, text }` ⇒ **文档与实现不一致** ✗
 *   本文件补上 `kind` / `data`，并**把判据写成"从既有文本推导"** ⇒ 不必改 40+ 处调用点 ✓
 */

/**
 * 快照 schema 版本（`NEKO.md` §9：字段**只增不删**，删则 bump）。
 * ⚠️ 改字段含义时**必须** bump，否则对面按旧含义解读 ⇒ 静默错 ✗
 */
export const NEKO_SNAPSHOT_SCHEMA = 1;

/**
 * 日志 kind 的**固定枚举**（`NEKO.md` §9 原文）：
 * `crunch` / `buy` / `milestone` / `quantum` / `system`
 *
 * ★ 判据：**从日志文本的 emoji 前缀推导**（不改 40+ 处 `pushLog` 调用点 ✓）。
 *   为什么用 emoji 而不是改签名：现有日志已经**稳定用这些前缀**表达分类
 *   （🌌 大坍缩 / ⬆·⚡ 购买 / 🏆 里程碑 / ⚛ 量子 / 💭 梦想 / ⏳ 永恒 / ⚙ 引擎…），
 *   把它**显式化**比给每个调用点加参数更省、也不会漏 ✓
 * ⚠️ 顺序有意义：**先匹配到的赢**（例如 `🌌` 同时出现在"大坍缩"与"相变仪解锁"里，
 *   前者才是 crunch ⇒ 具体模式写在前面）。
 */
export function nekoSnapshot(state, nowMs = Date.now()) {
  const r = state?.resources ?? {};
  const num = (v) => (v && typeof v.toNumber === "function" ? v.toNumber() : Number(v) || 0);
  const log = (state?.log ?? []).slice(-40).map(nekoLogEntry);

  // 三项速率：用**引擎已有函数**的原始值（不在这里重算公式 ⇒ 不会与实发脱节 ✓）
  const rates = state?.__nekoRates ?? null;   // 由调用方注入（ui/main 有现成的 rate 函数）

  return {
    schema: NEKO_SNAPSHOT_SCHEMA,
    t: nowMs,
    resources: {
      entropy: num(r.entropy),
      particle: num(r.particle),
      matter: num(r.matter),
      zpe: num(state?.zpe),
      darkEnergy: num(state?.darkEnergy),
      quantum: num(state?.quantum),
      infinityPoints: num(state?.infinityPoints),
      eternityPoints: num(state?.eternityPoints),
      dreamPoints: num(state?.dreamPoints),
    },
    // 速率：没有注入就**给 null**（而不是编一个 0 —— 0 是"真的没产出"的意思 ✗）
    rates: rates ?? null,
    progress: {
      phaseTransmuterUnlocked: state?.phaseTransmuterUnlocked === true,
      brokenInfinity: state?.brokenInfinity === true,
      bigCrunchCount: num(state?.bigCrunchCount),
      quantumPairs: num(state?.quantumPairs),
      zpeMilestones: Object.entries(state?.zpeMilestones ?? {}).filter(([, v]) => v).map(([k]) => k),
      deMilestones: Object.entries(state?.deMilestones ?? {}).filter(([, v]) => v).map(([k]) => k),
      // ★ 档位里程碑：**调既有函数**（它返回对象数组，这里取 id）
      tierMilestones: (state?.__nekoTierMilestones ?? []),
      zpeEngine: {
        unlocked: state?.zpeEngineUnlocked === true,
        level: num(state?.zpeEngineLevel),
      },
      eternityCount: num(state?.eternityCount),
    },
    multipliers: state?.__nekoMultipliers ?? null,
    log,
  };
}

// ══════════════════════════════════════════════════════════
// 动作派发（`NEKO.md` §6 的**动作白名单**）
// ══════════════════════════════════════════════════════════
/**
 * 把宿主下发的一批动作**派发**到引擎上。
 *
 * ══════════════════════════════════════════════════════════
 * 三条硬约束怎么落实（`NEKO.md` §6）
 * ══════════════════════════════════════════════════════════
 * ① **阶段白名单**：每条动作有 `guard(state)`，没到该阶段 ⇒ `rejected`（**不替玩家越门槛**）
 * ② **只走既有购买函数**：`fn` 全部是 engine 的导出（**零自写扣款**）——
 *    这是本项目踩过坑之后的纪律（"自动化与手动双倍发放"）
 * ③ **限流 + 幂等**：
 *    · 限流 = 每批最多 `NEKO_MAX_ACTIONS_PER_TICK` 条，超出的记 `throttled`
 *    · 幂等 = **由购买函数本身保证**（`buyX` 买不起就返回 false ⇒ 重复调用天然不叠加）✓
 *
 * ⚠️ 为什么"幂等"不需要额外记账：我们**从不自己扣钱**，
 *   所以"调用两次"= "买两次"（这在游戏里是**合法行为**，不是重复发放）；
 *   而"重复调用同一条 `doBigCrunch`"也不会多发 —— 大坍缩的收益由深度算出 ✓
 *
 * @param {object} state
 * @param {Array<{type:string, payload?:object}>} actions 宿主给的批次
 * @param {object} api 引擎函数集合（**注入**，便于测试与避免循环依赖）
 * @returns {{applied:number, results:Array<object>, throttled:number}}
 */
export const NEKO_SNAPSHOT_STATE_SCHEMA = {
  type: "object",
  properties: {
    schema: { type: "integer", minimum: 1 },
    t: { type: "number" },
    resources: {
      type: "object",
      properties: {
        entropy: { type: "number" },
        particle: { type: "number" },
        matter: { type: "number" },
        zpe: { type: "number" },
        darkEnergy: { type: "number" },
        quantum: { type: "number" },
        infinityPoints: { type: "number" },
        eternityPoints: { type: "number" },
        dreamPoints: { type: "number" },
      },
      required: ["entropy", "particle", "matter", "zpe", "darkEnergy", "quantum",
                 "infinityPoints", "eternityPoints", "dreamPoints"],
      additionalProperties: false,
    },
    rates: { type: "object", additionalProperties: true },
    multipliers: { type: "object", additionalProperties: true },
    progress: {
      type: "object",
      properties: {
        phaseTransmuterUnlocked: { type: "boolean" },
        brokenInfinity: { type: "boolean" },
        bigCrunchCount: { type: "number" },
        quantumPairs: { type: "number" },
        zpeMilestones: { type: "array", items: { type: "string", maxLength: 64 }, maxItems: 64 },
        deMilestones: { type: "array", items: { type: "string", maxLength: 64 }, maxItems: 64 },
        tierMilestones: { type: "array", items: { type: "string", maxLength: 64 }, maxItems: 64 },
        zpeEngine: {
          type: "object",
          properties: {
            unlocked: { type: "boolean" },
            level: { type: "number" },
          },
          required: ["unlocked", "level"],
          additionalProperties: false,
        },
        eternityCount: { type: "number" },
      },
      required: ["phaseTransmuterUnlocked", "brokenInfinity", "bigCrunchCount", "quantumPairs",
                 "zpeMilestones", "deMilestones", "tierMilestones", "zpeEngine", "eternityCount"],
      additionalProperties: false,
    },
    log: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        properties: {
          t: { type: "number" },
          kind: { type: "string", enum: ["crunch", "buy", "milestone", "quantum", "system"] },
          text: { type: "string", maxLength: 400 },
        },
        required: ["t", "kind", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["schema", "t", "resources", "progress", "log"],
  additionalProperties: false,
};

/**
 * `controls.action` 的契约 —— **猫娘能调用的游戏内动作**。
 *
 * 方向是 **宿主 → 游戏**（她下指令，我们执行），来源是 `dialogue.request()` 的
 * 响应里夹带的 `control` 对象（见 docs/NEKO.md §1.5.3 ⑨ 与 SDK README §Contracts）。
 *
 * ⚠️ 刻意用**一个** `action` 键 + `type` 枚举，而不是七个键：
 *    ① 每加一个动作不用改契约（只改枚举）；
 *    ② 我们的 `dispatchNekoActions()` 本来就是"批处理 + 未知动作不抛"的形状；
 *    ③ 节点数/字符串预算更省（契约有硬上限）。
 * ⚠️ `setAuto` 目前在 `NEKO_ACTION_SPECS` 里是**故意拒绝**的（需要玩家授权开关），
 *    留在枚举里是为了让对面知道"这个动作存在但当前不可用"，而不是得到 `unknown_action`。
 */
export const nekoNum = (v) => {
  const n = v && typeof v.toNumber === "function" ? v.toNumber() : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 紧凑数字：3 位有效数字 + 科学计数法（`1.23e5`）。 */
export function nekoFmt(v) {
  const n = nekoNum(v);
  if (n === 0) return "0";
  const a = Math.abs(n);
  if (Number.isInteger(n) && a < 1000) return String(n);   // 计数/等级别写成 2.00
  if (a >= 1e6 || a < 1e-2) return n.toExponential(2).replace("e+", "e");
  if (a >= 1000) return Math.round(n).toString();
  if (a >= 100) return n.toFixed(0);
  return n.toFixed(2);
}

/**
 * 构造**一次问话**用的紧凑上下文（默认 ≤ 600 字符）。
 *
 * ⚠️ 与 `nekoSnapshotForHost()` 的分工：
 *   · 快照 = "她随时能读到的状态"（每 5 秒发布，字段受 manifest 契约约束）；
 *   · 本函数 = "这次问话需要的最小信息"（一次性塞进 prompt，**不计入**状态契约）。
 *   所以这里可以自由裁剪、换行、加解释，不受契约限制 ✓
 *
 * @param {object} state
 * @param {{sinceT?:number, maxChars?:number}} [opts]
 *   `sinceT`：只叙述这个时间戳之后的**关键日志**（通常是上次问话时间）。
 * @returns {string}
 */
export function nekoSnapshotForHost(state, nowMs = Date.now()) {
  const snap = nekoSnapshot(state, nowMs);
  if (snap.rates == null) delete snap.rates;
  if (snap.multipliers == null) delete snap.multipliers;
  snap.log = nekoKeyLogEntries(state, { limit: 12 });
  return snap;
}

// ══════════════════════════════════════════════════════════
// 主动问话：上下文构造 + 触发点
// ══════════════════════════════════════════════════════════

/** 数值归一化：Decimal / number / 字符串都转成 number（非有限值 → 0）。 */
