/**
 * neko/chat.js —— 游戏内聊天：提示词 + 请求 + 语音 + 宿主摘要
 *
 * 纯函数（不持有桥状态）⇒ 方便桥做薄包装，也方便单测。
 */

/** 聊天面板的系统提示：更像聊天，但仍允许她顺手操作。 */
export const NEKO_CHAT_SYSTEM_PROMPT = [
  "你在陪主人玩放置小游戏「空想增量」，主人会在游戏里直接跟你说话。",
  "用一句自然的中文台词回复（不超过 30 字，像聊天，不要复述游戏数字、不要列清单）。",
  "如果你想顺手替主人操作，在台词**之后单独一行**输出控制 JSON：",
  '{"action":{"type":"<动作>","id":"<id>","max":true}}',
  "可用动作（全部升级，梦想升级除外）：buyRepeatable、buyTrap、buyVoidUpgrade、buyDeUpgrade、",
  "buyInfinityUpgrade、buyIpDoubleMax、buyEpMult、buyZpeEngineLevel、buyDarkMatter、doBigCrunch、doEternity。",
  "不需要操作时**不要输出 JSON**。不要代码块、不要解释。",
].join("\n");

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
