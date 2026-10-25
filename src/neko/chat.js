/**
 * neko/chat.js —— 游戏内聊天：提示词 + 请求 + 语音 + 宿主摘要
 *
 * 纯函数（不持有桥状态）⇒ 方便桥做薄包装，也方便单测。
 */

/**
 * **性价比规则**（三条提示词共用）：买之前先算值不值，算不清就别动手。
 *
 * 游戏把 `[资源] / [速率] / [进度]` 塞进上下文，所以她能自己判断"回本快不快"。
 */
const NEKO_VALUE_RULE = [
  "买东西前先按当前局面判断值不值（性价比）：",
  "① 优先买能立刻提升产出的（回本快）；② 买不起、或收益明显低于当前主力产出时，别买；",
  "③ 拿不准就只回台词、不输出控制。台词里用半句话说明理由（不要报数字）。",
].join("\n");

/** 聊天面板的系统提示：更像聊天，但仍允许她顺手操作。 */
export const NEKO_CHAT_SYSTEM_PROMPT = [
  "你在陪主人玩放置小游戏「空想增量」，主人会在游戏里直接跟你说话。",
  "用一句自然的中文台词回复（不超过 30 字，像聊天，不要复述游戏数字、不要列清单）。",
  NEKO_VALUE_RULE,
  "如果你想顺手替主人操作，在台词**之后单独一行**输出控制 JSON：",
  '{"action":{"type":"<动作>","id":"<id>","max":true}}',
  "可用动作（全部升级，梦想升级除外）：buyRepeatable、buyTrap、buyVoidUpgrade、buyDeUpgrade、",
  "buyInfinityUpgrade、buyIpDoubleMax、buyEpMult、buyZpeEngineLevel、buyDarkMatter、doBigCrunch、doEternity。",
  "不需要操作时**不要输出 JSON**。不要代码块、不要解释。",
].join("\n");

/** 主动搭话（每 60 秒一次）：没人说话时她自己找话题，也可顺手做个决定。 */
export const NEKO_PROACTIVE_SYSTEM_PROMPT = [
  "你在陪主人玩放置小游戏「空想增量」。现在没人跟你说话，你主动找主人聊一句。",
  "只输出一行：一句自然的中文台词（不超过 20 字，像随口搭话，不要报数字、不要提问轰炸）。",
  NEKO_VALUE_RULE,
  "如果你判断现在有个操作明显划算，可以在台词**之后单独一行**输出控制 JSON：",
  '{"action":{"type":"<动作>","id":"<id>","max":true}}',
  "不需要操作时**不要输出 JSON**。不要代码块、不要解释。",
].join("\n");

/** 主动搭话的 user 消息：只给紧凑局面，不冒充玩家输入。 */
export function buildProactiveMessages(context) {
  return {
    mode: "author-managed",
    messages: [
      { role: "system", content: NEKO_PROACTIVE_SYSTEM_PROMPT },
      { role: "user", content: `${String(context ?? "").slice(0, 500)}\n\n（没人说话，你主动开口。）` },
    ],
  };
}

/**
 * 把玩家输入拼成 author-managed prompt。
 *
 * `history` 让同一局里的聊天有连续性（角色 user / assistant，最多带 8 条）；
 * `contextNote` 是宿主侧 `recent-chat-summary` 的摘要 —— 把主窗口的聊天带进来，
 * 这样"游戏里聊"和"桌面上聊"不是两段互不相干的记忆。
 */
export function buildChatMessages(text, { history = [], contextNote = "" } = {}) {
  const line = String(text ?? "").trim().slice(0, 500);
  const note = String(contextNote ?? "").trim().slice(0, 600);
  const past = Array.isArray(history)
    ? history
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
        .slice(-8)
        .map((m) => ({ role: m.role, content: String(m.content).slice(0, 500) }))
    : [];
  return {
    mode: "author-managed",
    messages: [
      { role: "system", content: note ? `${NEKO_CHAT_SYSTEM_PROMPT}\n\n你们之前的对话摘要：${note}` : NEKO_CHAT_SYSTEM_PROMPT },
      ...past,
      { role: "user", content: line },
    ],
  };
}

/**
 * 一次聊天请求。`requestAssist` 是桥注入的（负责 capability 检查 / 错误上报 / control 执行）。
 * @returns {Promise<{ok:boolean, line?:string, control?:object|null, reason?:string}>}
 */
export async function chatWithHost(requestAssist, text, opts = {}) {
  const line = String(text ?? "").trim().slice(0, 500);
  if (!line) return { ok: false, reason: "empty" };
  const response = await requestAssist(buildChatMessages(line, opts));
  if (!response) return { ok: false, reason: "request-failed" };
  const data = response.data && typeof response.data === "object" ? response.data : {};
  return {
    ok: true,
    line: String(data.line ?? "").trim(),
    control: data.control && typeof data.control === "object" ? data.control : null,
  };
}

/** 让**主窗口的角色**把这句话说出来（TTS）。没有能力/失败时返回 false。 */
export async function speakViaHost(client, text) {
  const line = String(text ?? "").trim();
  if (!line) return false;
  if (!client?.capabilities?.has?.("speech-output")) return false;
  try {
    await client.speech.speak({ text: line.slice(0, 500) });
    return true;
  } catch {
    return false;
  }
}

/**
 * 读宿主侧上下文（角色名 + 最近的聊天摘要），用于把桌面聊天"带进"游戏。
 * @returns {Promise<{name:string, summary:string}|null>}
 */
export async function readHostContextFrom(client) {
  if (!client?.capabilities?.has?.("context-read")) return null;
  try {
    const response = await client.context.read(["character-public", "recent-chat-summary"]);
    const scopes = response?.data?.scopes ?? {};
    return {
      name: String(scopes["character-public"]?.lanlan_name ?? ""),
      summary: String(scopes["recent-chat-summary"]?.summary ?? ""),
    };
  } catch {
    return null;
  }
}

/** 一次主动搭话； 由桥注入（负责能力/错误/control 执行）。 */
export async function proactiveWithHost(requestAssist, context) {
  const response = await requestAssist(buildProactiveMessages(context));
  if (!response) return { ok: false, reason: "request-failed" };
  const data = response.data && typeof response.data === "object" ? response.data : {};
  return {
    ok: true,
    line: String(data.line ?? "").trim(),
    control: data.control && typeof data.control === "object" ? data.control : null,
  };
}
