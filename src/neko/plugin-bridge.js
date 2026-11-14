/**
 * neko/plugin-bridge.js —— 插件面板模式（Static UI）下的最小通道
 *
 * 背景（2026）：
 *   · 插件静态页挂在 `/plugin/<id>/ui/`，**没有** minigame SDK（无 launch JSON）；
 *   · 页面与插件后端走宿主 Run 协议：
 *       POST /runs {plugin_id, entry_id, args}
 *       GET  /runs/{id}      轮询状态
 *       GET  /runs/{id}/export 取 `trigger_response`
 *   · 写请求需要 CSRF token（拿不到就按 tokenless 兼容模式继续）。
 *
 * MVP 只做两件事：
 *   ① 每 3 秒把 `nekoSnapshotForHost(state)` 同步给插件；
 *   ② 每 2 秒领一次动作队列，交给 dispatch() 执行，再回报结果。
 */

const RUN_POLL_MS = 150;
const RUN_MAX_POLLS = 80;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 判断当前页面是不是插件静态 UI；是则返回 pluginId，否则 null。 */
export function detectPluginId(locationLike = window.location) {
  const path = String(locationLike?.pathname ?? "");
  const parts = path.split("/");
  // "/plugin/<id>/ui/..." → ["", "plugin", "<id>", "ui", ...]
  if (parts[1] !== "plugin" || parts[3] !== "ui") return null;
  return parts[2] ? decodeURIComponent(parts[2]) : null;
}

/**
 * 创建插件通道。非插件页面返回 null（不影响 standalone / minigame 模式）。
 * @param {{getState?:Function, dispatchActions?:Function}} options
 */
export function createPluginBridge(options = {}) {
  const pluginId = detectPluginId();
  if (!pluginId) return null;
  const getState = typeof options.getState === "function" ? options.getState : () => null;
  const dispatchActions = typeof options.dispatchActions === "function"
    ? options.dispatchActions
    : () => ({ results: [] });

  const base = window.location.origin;
  const state = { syncing: false, polling: false, running: false, lastError: null, lastSyncAt: 0, lastPollAt: 0 };
  let csrfPromise = null;

  async function csrfToken() {
    if (!csrfPromise) {
      csrfPromise = fetch(`${base}/security/csrf-token`, { credentials: "same-origin" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => (data && data.csrf_token) || "")
        .catch(() => "");
    }
    return csrfPromise;
  }

  async function postJson(url, body) {
    const headers = { "Content-Type": "application/json" };
    const token = await csrfToken();
    if (token) headers["X-CSRF-Token"] = token;
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers,
      body: JSON.stringify(body),
    });
  }

  /** 调一个插件 entry，等 run 结束并取回 `trigger_response`。 */
  async function callEntry(entryId, args = {}) {
    const created = await postJson(`${base}/runs`, { plugin_id: pluginId, entry_id: entryId, args });
    if (!created.ok) throw new Error(`runs/${entryId} HTTP ${created.status}`);
    const run = await created.json();
    const runId = String(run?.run_id ?? "");
    if (!runId) throw new Error(`runs/${entryId} no run_id`);

    for (let i = 0; i < RUN_MAX_POLLS; i += 1) {
      await sleep(RUN_POLL_MS);
      const response = await fetch(`${base}/runs/${runId}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`run ${runId} HTTP ${response.status}`);
      const record = await response.json();
      if (record.status === "succeeded") {
        await sleep(80);
        const exported = await fetch(`${base}/runs/${runId}/export`, { credentials: "same-origin" });
        if (!exported.ok) return null;
        const data = await exported.json();
        const item = (data?.items ?? []).find((entry) => entry?.label === "trigger_response");
        const json = item?.json;
        if (!json) return null;
        return json.plugin_response ?? json.data ?? json;
      }
      if (["failed", "canceled", "timeout", "cancel_requested"].includes(record.status)) {
        throw new Error(`run ${runId} ${record.status}: ${record?.error?.message ?? ""}`);
      }
    }
    throw new Error(`run ${runId} poll timeout`);
  }

  async function syncState() {
    if (!state.running || state.syncing) return;
    state.syncing = true;
    try {
      await callEntry("sync_state", { snapshot: buildSnapshot() });
      state.lastSyncAt = Date.now();
    } catch (err) {
      state.lastError = String(err?.message ?? err);
    } finally {
      state.syncing = false;
    }
  }

  async function pollActions() {
    if (!state.running || state.polling) return;
    state.polling = true;
    try {
      const result = await callEntry("poll_actions", { limit: 8 });
      state.lastPollAt = Date.now();
      const actions = Array.isArray(result?.actions) ? result.actions : [];
      if (!actions.length) return;
      const batch = actions.map((action) => ({
        type: String(action?.type ?? ""),
        payload: {
          ...(action?.payload ?? {}),
          reason: action?.reason ?? action?.payload?.reason ?? "",
        },
      }));
      const dispatched = dispatchActions(batch) ?? { results: [] };
      const results = Array.isArray(dispatched.results) ? dispatched.results : [];
      for (let i = 0; i < actions.length; i += 1) {
        const action = actions[i];
        const outcome = results[i] ?? { status: "unknown" };
        await callEntry("report_result", {
          action_id: String(action?.action_id ?? ""),
          status: String(outcome.status ?? "unknown"),
          reason: String(outcome.reason ?? "").slice(0, 200),
        }).catch(() => null);
      }
    } catch (err) {
      state.lastError = String(err?.message ?? err);
    } finally {
      state.polling = false;
    }
  }

  function buildSnapshot() {
    try {
      const current = getState?.();
      return current ? snapshotFn(current) : null;
    } catch (err) {
      state.lastError = String(err?.message ?? err);
      return null;
    }
  }

  // 延迟引入，避免非插件页面也加载快照模块（其实很小，但这保持 bridge 纯净）
  let snapshotFn = null;

  return {
    pluginId,
    async start(snapshotBuilder) {
      snapshotFn = snapshotBuilder;
      state.running = true;
      await syncState();
      void pollActions();
      const syncTimer = setInterval(() => { void syncState(); }, 3000);
      const pollTimer = setInterval(() => { void pollActions(); }, 2000);
      this.stop = () => {
        state.running = false;
        clearInterval(syncTimer);
        clearInterval(pollTimer);
      };
      return this;
    },
    callEntry,
    status: () => ({ ...state, pluginId }),
  };
}
