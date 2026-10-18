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
const KIND_RULES = [
  // ⚠️ **顺序有意义：先匹配到的赢**，所以"更具体的文本模式"必须排在"宽泛的 emoji"前面。
  //   ★ 2026：`[/无限挑战/, "system"]` 这条**已删除** ——
  //     IC 整个系统被用户删除 ⇒ 那类日志**永远不会再出现** ✓
  //     留一条永不命中的规则 = 分类表与实现脱节（本项目最忌讳的东西）✗
  //   （历史教训留档：它原来必须排在 `/🌌|💠/` **前面**，否则「开始无限挑战」会被判成 `crunch`）
  // 大坍缩 / 打破无限 —— 无限层的"事件"
  [/🌌|💠/, "crunch"],
  // 量子
  [/⚛/, "quantum"],
  // 购买（含买满/跨级）
  [/⬆|⚡|∞ 购买|💭 (购买|首次购买|新成就)/, "buy"],
  // 里程碑 / 成就
  [/🏆|成就/, "milestone"],
  // 永恒 / 引擎 / 相变仪 / 存档等 —— 归 system
  [/⏳|⚙|🔒|⚠️|📋|☢️|🌊|检测到|已解锁|已开启/, "system"],
];

/**
 * 推导一条日志的 `kind`（`NEKO.md` §9 的固定枚举）。
 * @param {string} text 日志原文
 * @returns {"crunch"|"buy"|"milestone"|"quantum"|"system"}
 */
export function nekoLogKind(text) {
  const s = String(text ?? "");
  for (const [re, kind] of KIND_RULES) if (re.test(s)) return kind;
  return "system";        // 兜底：不认识的都算 system（**不猜**，宁可粗）
}

/**
 * 把内部日志条目转成 `NEKO.md` §9 的形状 `{ t, kind, text, data }`。
 * @param {{t:number,text:string,kind?:string,data?:object}} entry
 */
export function nekoLogEntry(entry) {
  const text = String(entry?.text ?? "");
  return {
    t: Number(entry?.t) || Date.now(),
    kind: entry?.kind ?? nekoLogKind(text),
    text,
    data: entry?.data ?? {},
  };
}

/**
 * ★★★ `NEKO.md` §5：**只读状态快照**（喂给宿主 `StatePublisher`）。
 *
 * 原则（§5 原文）：「只读、版本化、不暴露可写入口」
 * ⚠️ 字段名我**逐个核对过实际 state**（避免又一份"文档 ≠ 实现"）：
 *   · `entropy` / `particle` / `matter` 在 `resources` 下，其余多数在**顶层** ✓
 *   · `darkMatter` **不存在**（属后续阶段）⇒ 不写进来，**不许编** ✓
 * @param {object} state
 * @param {number} [nowMs] 快照时间（测试可注入，保证可断言）
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
export function dispatchNekoActions(state, actions, api) {
  const out = { applied: 0, results: [], throttled: 0 };
  const list = Array.isArray(actions) ? actions : [];
  const cap = api?.maxPerTick ?? 8;
  if (list.length > cap) out.throttled = list.length - cap;

  for (const a of list.slice(0, cap)) {
    const type = String(a?.type ?? "");
    const p = a?.payload ?? {};
    const spec = NEKO_ACTION_SPECS[type];

    // ── 未知动作：**不抛**，报 unknown_action（对面是 LLM，会发奇怪的东西）──
    if (!spec) {
      out.results.push({ type, status: "unknown_action" });
      continue;
    }
    // ── ① 阶段白名单 ──
    if (!evalGuard(spec, state, p, api)) {
      out.results.push({ type, status: "rejected", reason: spec.guardWhy });
      continue;
    }
    // ── ② 只走既有购买函数 ──
    let ok = false, detail = null;
    try {
      const r = spec.fn(state, p, api);
      ok = r === true || r?.ok === true;
      detail = typeof r === "object" && r !== null ? (r.reason ?? null) : null;
    } catch (err) {
      ok = false;
      detail = err?.message ?? String(err);
    }
    if (ok) out.applied++;
    out.results.push({ type, status: ok ? "ok" : "rejected", reason: ok ? null : detail });
  }
  return out;
}

/**
 * 白名单的**唯一实现**（动作名 → 守卫 + 引擎函数）。
 *
 * ⚠️ `api` 由调用方注入（见 `main.js`），**不在这里 import engine** ——
 *   否则 `neko.js` 就有了依赖，而它的定位是"零依赖的接入层"（也避免循环依赖）✓
 * ⚠️ `guard` 一律"保守"：判据不清楚时**拒绝**（宁可少做，不可越界）✓
 */
const NEKO_ACTION_SPECS = {
  buyRepeatable: {
    // ⚠️ id 合法性**问注入的 api**（不在这里抄一份 id 表 —— 抄了就会与 config 脱节 ✗）
    guard: (s, p, api) => typeof p?.id === "string" && api?.hasRepeatable?.(p.id) === true,
    guardWhy: "缺少或未知的升级 id",
    fn: (s, p, api) => api.buyRepeatable(s, p.id, p.max === true),
  },
  buyVoidUpgrade: {
    guard: (s, p, api) => typeof p?.id === "string" && api?.hasVoid?.(p.id) === true,
    guardWhy: "缺少或未知的虚空升级 id",
    fn: (s, p, api) => api.buyVoidUpgrade(s, p.id),
  },
  buyDeUpgrade: {
    guard: (s, p, api) => typeof p?.id === "string" && api?.hasDe?.(p.id) === true,
    guardWhy: "缺少或未知的暗能量升级 id",
    fn: (s, p, api) => api.buyDeUpgrade(s, p.id, p.max === true),
  },
  // ★ ① 无限增幅走它（`ipDouble`）；**未打破无限也能买**（见 K 段 bug #10）
  buyInfinityUpgrade: {
    guard: (s, p, api) => typeof p?.id === "string" && api?.hasInfinity?.(p.id) === true,
    guardWhy: "缺少或未知的无限升级 id",
    fn: (s, p, api) => api.buyInfinityUpgrade(s, p.id).ok === true,
  },
  // ★ 大坍缩：**必须已经打破无限**（打破前是硬顶强制触发，不该由猫娘代按）
  doBigCrunch: {
    guard: (s) => s?.brokenInfinity === true,
    guardWhy: "未打破无限（大坍缩是自动触发的，不该由猫娘代按）",
    fn: (s, p, api) => api.doBigCrunch(s) != null,
  },
  // ★ 永恒：门槛由 `canEternity` 自己判（这里只挡"没到过无限层"）
  doEternity: {
    guard: (s) => s?.brokenInfinity === true,
    guardWhy: "未打破无限（还没到过 ∞ 层）",
    fn: (s, p, api) => api.doEternity(s) != null,
  },
  /**
   * ★ **猫娘的自动化通道**（§6 末尾：不消耗梦想点、不占玩家已买槽位）。
   *
   * ⚠️ 本层**只登记契约、不做实现**，原因有二：
   *   ① 自动化在游戏内的实现是 `isAutoAcquire`（由 `v9` / `m2` / `m5` 推导）
   *      与梦想升级 `autoBuyDe` —— **都有各自的解锁前提**，
   *      猫娘"绕过前提"是**越界**（§6 约束①）⇒ 需要一个**玩家可授予**的开关，
   *      而那是 Neko 页面上还没做的 UI（等 SDK 接入后一起定）
   *   ② 现在硬做，就得在引擎里加一条"猫娘专用自动化"分支 ——
   *      正好是 §6 约束② 想避免的"自己写一套"✗
   * ⇒ 先返回 `rejected` 并**写清原因**（而不是假装成功）✓
   */
  setAuto: {
    guard: () => false,
    guardWhy: "尚未实装（需要玩家可授予的授权开关；见 TODO P9）",
    fn: () => false,
  },
};

/** `guard(state, payload, api)` 的统一调用点（`dispatchNekoActions` 里传 api） */
function evalGuard(spec, state, payload, api) {
  try { return spec.guard(state, payload, api) === true; } catch { return false; }
}


// ══════════════════════════════════════════════════════════
// 宿主桥（**无宿主时全部优雅降级**）
// ══════════════════════════════════════════════════════════

/**
 * 页面里有没有"宿主启动配置"。
 *
 * 判据来自 SDK 源码（`neko-minigame-same-origin-bootstrap.js`）：
 *   宿主模板必须在加载 bootstrap 前吐出一个 `<script id="neko-minigame-host-launch">`（JSON），
 *   bootstrap 会**同步吃掉并删掉**这个节点 ⇒ 所以**它此刻还在**就说明宿主刚启动 ✓
 * ⚠️ 不能只看 `window.lanlan_config` —— 那是**旧式集成**（soccer/badminton 用的），
 *   跟我们这条 SDK 路线不是一回事 ✗
 */
export function nekoHostPresent(doc = globalThis.document) {
  if (!doc?.getElementById) return false;
  if (doc.getElementById("neko-minigame-host-launch")) return true;
  // bootstrap 已经吃掉节点的情况：它会在 window 上留一个 Promise
  return typeof globalThis.nekoMiniGameSameOriginHostReady !== "undefined";
}

// ══════════════════════════════════════════════════════════
// SDK 接入清单（manifest）
// ══════════════════════════════════════════════════════════

/**
 * 身份常量 —— **必须与宿主模板里 `#neko-minigame-host-launch` 的注册 JSON 逐字一致**。
 *
 * 宿主握手时会比对 `manifest.id` / `manifest.version` 与注册项；差任何一个字符
 * 都会得到 `code: 'game_unregistered'`（见 docs/NEKO.md §1.5.3 ③）。
 * `routeGameType` 只影响端点路径（`/api/game/<routeGameType>/*`），可以在注册项里
 * 单独给（默认等于 `gameId`）。
 */
export const NEKO_GAME_ID = "kongxiang-incremental";
export const NEKO_GAME_VERSION = "0.7.1";
export const NEKO_PROTOCOL_VERSION = "1";

/**
 * `states.snapshot` 的契约。
 *
 * ⚠️ 这是 **SDK 支持的 schema 子集**（不是完整 JSON Schema）：
 *    支持 `type` / `properties` / `required` / `additionalProperties` / `items` /
 *    `enum` / `minimum` / `maximum` / `maxLength` / `maxItems`；
 *    **不支持** `$ref` / `oneOf` / `anyOf` / 正则 `pattern`。
 *    硬上限：单契约 ≤256 节点、深度 ≤12（`connect()` 自己再校验一遍）。
 * ⚠️ `rates` / `multipliers` **不在 required 里**：没有注入时调用方会**整个字段省略**
 *    （而不是编 0）—— 见 `nekoSnapshotForHost()`。
 */
const NEKO_SNAPSHOT_STATE_SCHEMA = {
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
const NEKO_CONTROL_SCHEMA = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["buyRepeatable", "buyVoidUpgrade", "buyDeUpgrade", "buyInfinityUpgrade",
             "doBigCrunch", "doEternity", "setAuto"],
    },
    id: { type: "string", minLength: 1, maxLength: 64 },
    max: { type: "boolean" },
    reason: { type: "string", maxLength: 200 },
  },
  required: ["type"],
  additionalProperties: false,
};

/** `events['control-result']` —— 每条指令的**回执**（她下完指令要知道成没成）。 */
const NEKO_CONTROL_RESULT_SCHEMA = {
  type: "object",
  properties: {
    actionType: { type: "string", maxLength: 40 },
    status: { type: "string", enum: ["ok", "rejected", "unknown_action"] },
    reason: { type: "string", maxLength: 200 },
  },
  required: ["actionType", "status"],
  additionalProperties: false,
};

/**
 * 交给 `NekoMiniGame.connect()` 的清单。
 *
 * - `requiredCapabilities` 只放**真的没有就跑不起来**的：`runtime`（生命周期）与
 *   `logging`（SDK 唯一强制项）。
 * - `dialogue` / `speech-output` / `context-read` / `memory` / `voice-input` 一律 optional：
 *   没授予也能玩，只是对应功能降级（调用点用 `client.capabilities.has()` 自检）。
 */
export const NEKO_MANIFEST = Object.freeze({
  id: NEKO_GAME_ID,
  version: NEKO_GAME_VERSION,
  protocolVersion: NEKO_PROTOCOL_VERSION,
  requiredCapabilities: Object.freeze(["runtime", "logging"]),
  optionalCapabilities: Object.freeze([
    "dialogue", "speech-output", "context-read", "memory", "voice-input",
  ]),
  contracts: Object.freeze({
    states: Object.freeze({ snapshot: NEKO_SNAPSHOT_STATE_SCHEMA }),
    events: Object.freeze({ "control-result": NEKO_CONTROL_RESULT_SCHEMA }),
    controls: Object.freeze({ action: NEKO_CONTROL_SCHEMA }),
  }),
});

/**
 * 把 `nekoSnapshot()` 投影成**契约允许**的形状。
 *
 * 两处必要修剪（都是"契约 vs 语义"的取舍）：
 *   ① `rates` / `multipliers` 为 `null` 时**整个字段省略** —— 契约子集没有 `anyOf`，
 *      而它们**不该被编成 0**（0 是"真的没产出"的意思）；
 *   ② `log[].data` 不发给宿主 —— 它可能含任意结构（引擎内部字段），
 *      契约里只声明 `t/kind/text`，砍掉比放宽校验更安全。
 */
export function nekoSnapshotForHost(state, nowMs = Date.now()) {
  const snap = nekoSnapshot(state, nowMs);
  if (snap.rates == null) delete snap.rates;
  if (snap.multipliers == null) delete snap.multipliers;
  snap.log = snap.log.map((e) => ({ t: e.t, kind: e.kind, text: e.text }));
  return snap;
}

/**
 * 造一个**宿主桥**。没有宿主时全部方法都是安全的 no-op。
 *
 * @param {object} opts
 * @param {() => object} opts.getState   取当前 state（**函数**，因为 state 会被整体替换）
 * @param {(phase:string, detail?:object) => void} [opts.onStatus] 连接状态变化（UI 用）
 * @returns 桥对象（`available` 为 false 时方法仍可安全调用 ✓）
 */
export function createNekoBridge({ getState, onStatus, actionApi } = {}) {
  const status = { available: false, connected: false, capabilities: [], declared: null, lastError: null };
  const report = (phase, detail) => {
    status.lastError = phase === "error" ? (detail?.message ?? String(detail)) : status.lastError;
    try { onStatus?.(phase, detail); } catch { /* UI 回调不该影响游戏 */ }
  };

  /**
   * 处理**一条**宿主下发的 control（`controls.on("action")` 的 handler）。
   *
   * 三条纪律：
   *   ① **不直接调引擎** —— 一律转交 `dispatchNekoActions()`（阶段守卫 + 未知动作不抛 + 限流）；
   *   ② **必须回执** —— 通过 `events.emit("control-result")` 告诉宿主成没成，
   *      否则她不知道结果，会反复下同一条指令（docs/NEKO.md §1.5.3 ⑨）；
   *   ③ **回执失败不影响执行** —— 指令已经生效了，回执只是通知。
   */
  function handleControl(client, envelope) {
    const payload = envelope?.payload ?? {};
    const type = String(payload?.type ?? "");
    let result = { type, status: "unknown_action" };
    try {
      const api = actionApi ?? {};
      const dispatched = dispatchNekoActions(
        getState?.() ?? {},
        [{ type, payload: { id: payload?.id, max: payload?.max === true } }],
        api,
      );
      result = dispatched?.results?.[0] ?? result;
    } catch (err) {
      result = { type, status: "rejected", reason: err?.message ?? String(err) };
    }

    const receipt = { actionType: type || "(unknown)", status: result.status };
    if (typeof result.reason === "string" && result.reason) {
      receipt.reason = result.reason.slice(0, 200);
    }
    try {
      const sent = client?.events?.emit?.("control-result", receipt);
      if (sent && typeof sent.catch === "function") sent.catch(() => {});
    } catch { /* 回执只是通知，失败不影响已生效的指令 */ }

    try { bridge.publishSnapshot(); } catch { /* 同上 */ }
    return result;
  }

  const bridge = {
    /** 宿主在不在（**查询是纯读**，没有副作用） */
    get available() { return status.available; },
    get connected() { return status.connected; },
    get status() { return { ...status, capabilities: [...status.capabilities] }; },

    /**
     * 尝试连接宿主。**没有宿主就立刻返回 false**（不抛、不重试、不阻塞游戏）✓
     *
     * 握手四步（每一步失败都只上报，游戏照常单机玩）：
     *   ① 等 `window.nekoMiniGameSameOriginHostReady`（宿主 bootstrap 暴露的 Promise）
     *   ② `factory({ gameType, gameVersion, sessionId })` ⇒ transport（**同步抛**表示未注册）
     *   ③ `NekoMiniGame.connect(NEKO_MANIFEST, { transport })` ⇒ client（**校验 id/version**）
     *   ④ `client.runtime.start()` —— 不 start 的话 `runtime.state` 会停在 degraded/inactive
     *
     * ⚠️ 第 ② 步用 `gameType = NEKO_GAME_ID`（= 注册表键 = `registration.gameId`），
     *    **不是** `routeGameType` —— 传错会得到 `game_unregistered`。
     * ⚠️ 第 ④ 步**不阻塞** `connect()` 的返回值：start 失败只上报，不把已建立的手握回滚
     *    （否则一次 runtime 抖动会让整局游戏掉线）。
     */
    async connect() {
      if (status.connected) return true;
      if (!nekoHostPresent()) {
        status.available = false;
        report("absent");
        return false;
      }
      status.available = true;
      report("detected");

      try {
        const ready = globalThis.nekoMiniGameSameOriginHostReady;
        const factory = (ready && typeof ready.then === "function") ? await ready : ready;
        if (typeof factory !== "function") {
          report("host-ready-but-no-factory");
          return false;
        }

        const sdk = globalThis.NekoMiniGame;
        if (!sdk || typeof sdk.connect !== "function") {
          report("sdk-missing");
          return false;
        }

        const pageParams = new URLSearchParams(globalThis.location?.search ?? "");
        const sessionId = String(pageParams.get("session_id") ?? "").trim();

        const transport = factory({
          gameType: NEKO_GAME_ID,
          gameVersion: NEKO_GAME_VERSION,
          ...(sessionId ? { sessionId } : {}),
        });

        const client = await sdk.connect(NEKO_MANIFEST, { transport, connectTimeoutMs: 15000 });

        bridge.__client = client;
        status.connected = true;
        status.capabilities = Array.isArray(client?.capabilities?.granted)
          ? [...client.capabilities.granted] : [];
        // 宿主实际接受的契约（用于端到端断言：controls 里有 action 才说明我们的控制契约生效）
        status.declared = {
          states: [...(client?.state?.declared ?? [])],
          events: [...(client?.events?.declared ?? [])],
          controls: [...(client?.controls?.declared ?? [])],
        };

        // ★ 宿主 → 游戏：她下发的动作落到 `dispatchNekoActions()`（白名单 + 守卫 + 限流）
        if (typeof client?.controls?.on === "function") {
          client.controls.on("action", (envelope) => handleControl(client, envelope));
        }

        report("connected", { host: client?.host ?? null });

        if (typeof client?.runtime?.start === "function") {
          Promise.resolve(client.runtime.start({ schema: NEKO_SNAPSHOT_SCHEMA }))
            .catch((err) => report("runtime-start-failed", err));
        }
        return true;
      } catch (err) {
        status.connected = false;
        report("error", err);
        return false;
      }
    },

    /**
     * 请她**看一眼并给建议**（会起一个 LLM turn）。
     *
     * 她的回复里若带 `control` 对象，SDK 会校验后自动投递到 `controls.on("action")` ——
     * 也就是说**"她帮玩家操作"不需要我们解析回复**，只要这里把上下文递上去。
     * 没有 `dialogue` 能力时返回 `null`（不抛）。
     */
    async requestAssist(prompt) {
      if (!status.connected) return null;
      const client = bridge.__client;
      if (!client?.capabilities?.has?.("dialogue")) {
        report("dialogue-unavailable");
        return null;
      }
      try {
        return await client.dialogue.request(prompt ? { prompt } : {});
      } catch (err) {
        report("error", err);
        return null;
      }
    },

    /** 当前能力（只读；没有宿主时为空） */
    get capabilities() {
      return [...status.capabilities];
    },

    /** 推一条日志给宿主（无宿主 ⇒ 丢弃，**不报错**） */
    sendLog(entry) {
      if (!status.connected) return false;
      const e = nekoLogEntry(entry);
      try {
        bridge.__client?.logger?.log?.(`[${e.kind}] ${e.text}`, e.data);
        return true;
      } catch (err) { report("error", err); return false; }
    },

    /** 推一份状态快照（无宿主 ⇒ 丢弃 ✓）*/
    publishSnapshot() {
      if (!status.connected) return false;
      try {
        const snap = nekoSnapshotForHost(getState?.() ?? {});
        const sent = bridge.__client?.state?.update?.("snapshot", snap);
        // 契约不符/会话过期时 SDK 会 reject —— 不能让它变成 unhandled rejection
        if (sent && typeof sent.catch === "function") {
          sent.catch((err) => report("snapshot-rejected", err));
        }
        return true;
      } catch (err) { report("error", err); return false; }
    },
  };
  return bridge;
}
