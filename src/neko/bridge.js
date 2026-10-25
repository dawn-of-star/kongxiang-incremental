/**
 * neko/bridge.js —— 宿主探测 / 握手 / 能力契约 / 助手上下文
 *
 * ★ 2026 模块化：由 907 行的 neko.js 按职责拆出（声明与注释逐字保留）。
 *    对外统一从 `src/neko.js`（barrel）导入。
 */
import { nekoLogEntry } from "./log.js";
import { createControlHandler } from "./control.js";
import { buildAssistContext, NEKO_ASK_POINTS, NEKO_ASK_SYSTEM_PROMPT } from "./assist.js";
import { chatWithHost, readHostContextFrom, speakViaHost } from "./chat.js";
import { NEKO_SNAPSHOT_SCHEMA, NEKO_SNAPSHOT_STATE_SCHEMA, nekoNum, nekoSnapshotForHost } from "./snapshot.js";

export { buildAssistContext };

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
export const NEKO_GAME_VERSION = "0.7.9";
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
    "dialogue", "speech-output", "context-read", "memory", "voice-input", "avatar-renderer",
  ]),
  contracts: Object.freeze({
    states: Object.freeze({ snapshot: NEKO_SNAPSHOT_STATE_SCHEMA }),
    events: Object.freeze({ "control-result": NEKO_CONTROL_RESULT_SCHEMA }),
    controls: Object.freeze({ action: NEKO_CONTROL_SCHEMA }),
  }),
});

/**
 * 造一个**宿主桥**。没有宿主时全部方法都是安全的 no-op。
 *
 * @param {object} opts
 * @param {() => object} opts.getState   取当前 state（**函数**，因为 state 会被整体替换）
 * @param {(phase:string, detail?:object) => void} [opts.onStatus] 连接状态变化（UI 用）
 * @returns 桥对象（`available` 为 false 时方法仍可安全调用 ✓）
 */
export function createNekoBridge({ getState, onStatus, actionApi } = {}) {
  const status = { available: false, connected: false, capabilities: [], declared: null, lastError: null, lastAsk: null, runtimeReady: false };
  // 主动问话的节流状态（每座桥独立；读档时"已达成点"会在首帧被预标记）
  const askState = { asked: new Set(), primed: false, lastAt: 0, count: 0, failedUntil: 0, sinceT: 0 };
  const report = (phase, detail) => {
    status.lastError = phase === "error" ? (detail?.message ?? String(detail)) : status.lastError;
    try { onStatus?.(phase, detail); } catch { /* UI 回调不该影响游戏 */ }
  };

  // 动作执行 + 3 秒去重（响应路径与 drain 路径共用同一判据）
  const handleControl = createControlHandler({
    getState,
    actionApi,
    status,
    report,
    publishSnapshot: () => { try { bridge.publishSnapshot(); } catch { /* 快照失败不影响执行 */ } },
  });

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
        // 角色名（聊天面板标题 / 语音都用它；有些宿主可能没有，留空即可）
        status.characterName = String(client?.runtime?.session?.characterName ?? "");
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

        // ★★ 必须先 configure，否则 outputs 永不轮询 ⇒ `controls.on()` 收不到任何东西。
        //    依据：SDK 里 `runtimeConfig` 初值是 null，`startRuntimeMonitoring()`
        //    开头就是 `if (disposed || !runtimeConfig) return;`（neko-minigame-sdk.js L3097）。
        //    对照：air_basketball 的 `configureGameRuntime()` 也是 configure → start 的顺序。
        //    heartbeat 2.5s / outputs 700ms 与官方示例同量级。
        if (typeof client?.runtime?.configure === "function") {
          try {
            client.runtime.configure({
              payload: () => ({ schema: NEKO_SNAPSHOT_SCHEMA }),
              heartbeat: { intervalMs: 2500, timeoutMs: 4500 },
              outputs: { intervalMs: 700, timeoutMs: 8000, limit: 50 },
            });
          } catch (err) {
            report("runtime-configure-failed", err);
          }
        }

        if (typeof client?.runtime?.start === "function") {
          Promise.resolve(client.runtime.start({ schema: NEKO_SNAPSHOT_SCHEMA }))
            .then(() => { status.runtimeReady = true; })
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
        const response = await client.dialogue.request(prompt ? { prompt } : {});
        // ★★ 响应里自带**已按契约校验过**的 control（SDK: `data.control`）。
        //    这意味着"她替玩家操作"**不依赖宿主侧的生产者** —— 只有"宿主主动推送"
        //    （语音/文本被游戏路由劫持时的那几处）才需要 `/route/drain`。
        //    这里直接执行，省掉 700ms 轮询延迟；drain 那条路仍保留作兜底。
        const control = response?.data?.control;
        const payload = control && typeof control === "object" ? control.action : null;
        if (payload && typeof payload === "object") {
          // 去重统一在 handleControl 里做（响应路径与 drain 路径共用同一判据）
          try {
            handleControl(client, { payload });
          } catch { /* 执行失败不影响对话本身 */ }
        }
        return response;
      } catch (err) {
        report("error", err);
        return null;
      }
    },

    /** 游戏内聊天：一句玩家输入 → 她的台词（+ 可选 control）。 */
    async chat(text, opts = {}) {
      if (!status.connected) return { ok: false, reason: status.lastError || "not-connected" };
      return chatWithHost(bridge.requestAssist, text, opts);
    },

    /** 让主窗口的角色把这句说出来（TTS）；没能力时静默 false。 */
    async speak(text) {
      if (!status.connected) return false;
      return speakViaHost(bridge.__client, text);
    },

    /** 页面关闭：显式结束路由，别等宿主心跳超时（会把模型悬在游戏态）。 */
    async end() {
      const client = bridge.__client;
      if (!client) return false;
      try { await client.runtime?.end?.({ reason: "page-close" }); } catch { /* 已经结束 */ }
      try { client.dispose?.(); } catch { /* ignore */ }
      status.connected = false;
      return true;
    },

    /** 当前角色描述（名字 + 可渲染的模型）。 */
    async getAvatarCharacter() {
      const client = bridge.__client;
      if (!client?.capabilities?.has?.("avatar-renderer")) return null;
      try { return await client.avatar.getCurrentCharacter(); } catch { return null; }
    },

    /** 把角色挂到页面里的容器（host 的 avatar-host 负责真正渲染）。 */
    async mountAvatar(config) {
      const client = bridge.__client;
      if (!client?.capabilities?.has?.("avatar-renderer")) return null;
      try { return await client.avatar.mount(config); } catch (err) { report("avatar-failed", err); return null; }
    },

    /** 读宿主上下文（角色名 + 最近聊天摘要）。 */
    async readHostContext() {
      if (!status.connected) return null;
      return readHostContextFrom(bridge.__client);
    },

    /**
     * 到**关键重置节点**时主动问她一次（带紧凑上下文，≤600 字符）。
     *
     * 触发点见 `NEKO_ASK_POINTS`（首次打破无限 / 第 1–3 次大坍缩 / 首次永恒 / 七巧板解锁）。
     * 节流：同一局最多 6 次、两次间隔 ≥120 秒、失败后 30 分钟内不重试。
     * ⚠️ 首帧会把"读档时**已经达成**的点"全部预标记 —— 否则一进游戏就会补问
     *   "恭喜你第一次大坍缩"（其实那是上一次存档里发生的）✗
     *
     * @returns {boolean} 本次是否真的发起了问话
     */
    maybeAskReset(stateLike) {
      const state = stateLike ?? getState?.() ?? {};
      if (!status.connected) return false;
      const client = bridge.__client;
      if (!client?.capabilities?.has?.("dialogue")) return false;

      const now = Date.now();
      if (now < askState.failedUntil) return false;

      if (!askState.primed) {
        for (const point of NEKO_ASK_POINTS) if (point.match(state)) askState.asked.add(point.id);
        askState.primed = true;
        return false;
      }

      if (now - askState.lastAt < 120_000) return false;
      if (askState.count >= 6) return false;

      const point = NEKO_ASK_POINTS.find((p) => !askState.asked.has(p.id) && p.match(state));
      if (!point) return false;

      askState.asked.add(point.id);
      askState.lastAt = now;
      askState.count += 1;

      const context = buildAssistContext(state, { sinceT: askState.sinceT });
      askState.sinceT = now;
      status.lastAsk = { point: point.id, label: point.label, at: now, chars: context.length, context };

      const prompt = {
        mode: "author-managed",
        messages: [
          { role: "system", content: NEKO_ASK_SYSTEM_PROMPT },
          { role: "user", content: `${context}\n\n现在到了「${point.label}」。` },
        ],
      };
      // 失败就冷却 30 分钟：不刷屏、也不把"模型不可用"当成每 5 秒一次的重试
      Promise.resolve(bridge.requestAssist(prompt)).then((result) => {
        if (!result) askState.failedUntil = Date.now() + 30 * 60_000;
      }).catch(() => { askState.failedUntil = Date.now() + 30 * 60_000; });
      return true;
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


