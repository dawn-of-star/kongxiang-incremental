/**
 * neko/assist.js —— 「主动问话 / 助手上下文」：紧凑上下文 + 触发点 + 系统提示
 *
 * 与 `snapshot.js` 的分工：
 *   · 快照 = 她随时能读到的状态（每 5 秒发布，字段受 manifest 契约约束）；
 *   · 本模块 = **一次问话**需要的最小信息（一次性塞进 prompt，不受契约限制）。
 */
import { nekoKeyLogEntries } from "./log.js";
import { nekoFmt, nekoNum } from "./snapshot.js";

/**
 * 构造**一次问话**用的紧凑上下文（默认 ≤ 600 字符）。
 *
 * @param {object} state
 * @param {{sinceT?:number, maxChars?:number}} [opts]
 *   `sinceT`：只叙述这个时间戳之后的**关键日志**（通常是上次问话时间）。
 * @returns {string}
 */
export function buildAssistContext(state, { sinceT = 0, maxChars = 600 } = {}) {
  const lines = [];

  // ── 阶段 ──
  const stage = [];
  if (state?.brokenInfinity === true) stage.push("已打破无限");
  const crunches = nekoNum(state?.bigCrunchCount);
  if (crunches > 0) stage.push(`大坍缩#${crunches}`);
  const eternities = nekoNum(state?.eternityCount);
  if (eternities > 0) stage.push(`永恒#${eternities}`);
  if (eternities >= 8) stage.push("七巧板已解锁");
  lines.push(`[阶段] ${stage.join(" · ") || "开局"}`);

  // ── 资源（只列非零）──
  const res = state?.resources ?? {};
  const resourcePairs = [
    ["熵", res.entropy], ["粒子", res.particle], ["物质", res.matter],
    ["ZPE", state?.zpe], ["暗能量", state?.darkEnergy], ["量子", state?.quantum],
    ["无限点", state?.infinityPoints], ["永恒点", state?.eternityPoints],
    ["梦想点", state?.dreamPoints],
  ].filter(([, v]) => nekoNum(v) > 0).map(([k, v]) => `${k} ${nekoFmt(v)}`);
  if (resourcePairs.length) lines.push(`[资源] ${resourcePairs.join(" | ")}`);

  // ── 速率（由 main.js 注入；没有就不写）──
  const rates = state?.__nekoRates;
  if (rates && typeof rates === "object") {
    const ratePairs = [["熵", rates.entropy], ["粒子", rates.particle], ["物质", rates.matter]]
      .filter(([, v]) => nekoNum(v) > 0).map(([k, v]) => `${k} +${nekoFmt(v)}/s`);
    if (ratePairs.length) lines.push(`[速率] ${ratePairs.join(" | ")}`);
  }

  // ── 进度 ──
  const progress = [];
  const pairs = nekoNum(state?.quantumPairs);
  if (pairs > 0) progress.push(`量子对 ${nekoFmt(pairs)}`);
  if (state?.zpeEngineUnlocked === true) progress.push(`引擎 Lv${nekoFmt(state?.zpeEngineLevel)}`);
  const tiers = Array.isArray(state?.__nekoTierMilestones) ? state.__nekoTierMilestones.length : 0;
  if (tiers > 0) progress.push(`档位里程碑 ${tiers}`);
  if (progress.length) lines.push(`[进度] ${progress.join(" · ")}`);

  // ── 关键日志（只取 sinceT 之后、最多 5 条、每条 50 字）──
  const logs = nekoKeyLogEntries(state, { limit: 12 })
    .filter((e) => e.t > sinceT)
    .slice(-5);
  if (logs.length) {
    lines.push(`[最近] ${logs.map((e) => e.text.slice(0, 50)).join("｜")}`);
  }

  let text = lines.join("\n");
  if (text.length > maxChars) text = text.slice(0, maxChars);
  return text;
}

/**
 * **主动问话的触发点**（用户 2026 裁定：「一些关键的重置节点……前几次的转生层」）。
 *
 * 每条只在**首次达成**时触发一次（`asked` 集合去重）。`match` 一律用"≥"而不是"=="，
 * 因为掉帧/读档可能跳过某个精确值。
 */
export const NEKO_ASK_POINTS = Object.freeze([
  { id: "broken-infinity", label: "第一次打破无限", match: (s) => s?.brokenInfinity === true },
  { id: "crunch-1", label: "第 1 次大坍缩", match: (s) => nekoNum(s?.bigCrunchCount) >= 1 },
  { id: "crunch-2", label: "第 2 次大坍缩", match: (s) => nekoNum(s?.bigCrunchCount) >= 2 },
  { id: "crunch-3", label: "第 3 次大坍缩", match: (s) => nekoNum(s?.bigCrunchCount) >= 3 },
  { id: "eternity-1", label: "第 1 次永恒", match: (s) => nekoNum(s?.eternityCount) >= 1 },
  { id: "tangram-unlock", label: "七巧板解锁", match: (s) => nekoNum(s?.eternityCount) >= 8 },
]);

/** 问话的系统提示：台词 + 一行 control JSON。 */
export const NEKO_ASK_SYSTEM_PROMPT = [
  "你在陪主人玩放置小游戏「空想增量」，下面会给你当前局面。",
  "只输出两行：",
  "第一行：一句不超过 20 字的中文台词（自然、像在陪玩，不要复述数字）。",
  '第二行：控制指令 JSON，格式 {"action":{"type":"<动作>","id":"<id>","max":true}}。',
  "可用动作：buyRepeatable（id 如 particleBoost/matterBoost/entropyCoeff）、",
  "buyVoidUpgrade、buyDeUpgrade、buyInfinityUpgrade、doBigCrunch、doEternity。",
  "**不需要操作时只输出第一行**，不要编造 id。",
  "数字里的 e 是科学计数法（1.2e5 = 120000）。不要代码块、不要解释。",
].join("\n");
