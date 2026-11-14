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
 * ★ 2026-11-14 稳定性修订（评审 6.6/10）：
 *   ① 退避轮询：空队列 2s→4s→8s→10s；领到动作立刻执行并再 poll 一次；快照同步 5s，
 *      失败 8s→12s→15s，成功恢复 5s；stop() 清掉全部 timer。
 *   ② 动作去重：`neko:exec:<pluginId>:executed` 记 action_id→{status,reason,t}（≤200 条）；
 *      dispatch 前写 in_progress、执行后写 ok/rejected；重投只补回执（in_progress ⇒ uncertain）；
 *      localStorage 不可用退回内存 Map。
 *   ③ 快照限流：log ≤12 条 / text ≤300 字；JSON >16KB 依次删 log、rates/multipliers，
 *      仍超限发最小摘要 {schema,t,error:"snapshot_too_large"}。
 */

const RUN_POLL_MS = 150;
const RUN_MAX_POLLS = 80;
// ── 轮询 / 同步节奏（全部是封顶退避，避免插件后端忙时被打爆）──
const POLL_IDLE_MS = [2000, 4000, 8000, 10000];
const POLL_AFTER_ACTION_MS = 200;
const SYNC_INTERVAL_MS = 5000;
const SYNC_RETRY_MS = [8000, 12000, 15000];
// ── 动作去重（页面刷新后不重复购买）──
const EXEC_CACHE_MAX = 200;
const REPORT_REASON_MAX = 200;
// ── 快照传输上限（客户端先裁，后端还会兜底）──
const SNAPSHOT_MAX_JSON_CHARS = 16 * 1024;
const SNAPSHOT_LOG_MAX = 12;
const SNAPSHOT_LOG_TEXT_MAX = 300;

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
 * 把快照裁成可传输形状（只动副本；顺序：log 限 12 条/300 字 → 删 log → 删
 * rates/multipliers → 最小摘要 {schema,t,error:"snapshot_too_large"}）。
 */
function trimSnapshotForTransport(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return snapshot;

  const fits = (value) => {
    try { return JSON.stringify(value).length <= SNAPSHOT_MAX_JSON_CHARS; } catch { return false; }
  };

  const trimmed = { ...snapshot };
  if (Array.isArray(trimmed.log)) {
    trimmed.log = trimmed.log.slice(-SNAPSHOT_LOG_MAX).map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const text = typeof entry.text === "string" ? entry.text : String(entry.text ?? "");
      if (text.length <= SNAPSHOT_LOG_TEXT_MAX) return entry;
      return { ...entry, text: text.slice(0, SNAPSHOT_LOG_TEXT_MAX) };
    });
  }
  if (fits(trimmed)) return trimmed;

  const withoutLog = { ...trimmed };
  delete withoutLog.log;
  if (fits(withoutLog)) return withoutLog;

  const withoutHeavy = { ...withoutLog };
  delete withoutHeavy.rates;
  delete withoutHeavy.multipliers;
  if (fits(withoutHeavy)) return withoutHeavy;

  return {
    schema: snapshot.schema ?? 1,
    t: snapshot.t ?? Date.now(),
    error: "snapshot_too_large",
  };
}

/**
 * 本地执行记录（action_id → {status, reason, t}）。
 *
 * 动作队列 at-least-once（lease 20s 重投），而购买不是幂等 ⇒ dispatch 前落 in_progress，
 * 重投只补回执、绝不重放。localStorage 不可用（隐私模式/配额/损坏）退回内存 Map，不抛。
 */
function createExecCache(pluginId) {
  const storageKey = `neko:exec:${pluginId}:executed`;
  const memory = new Map();
  let persistent = true;

  const normalize = (entry) => {
    const status = String(entry?.status ?? "");
    if (!status) return null;
    return {
      status,
      reason: String(entry?.reason ?? "").slice(0, REPORT_REASON_MAX),
      t: Number(entry?.t) || 0,
    };
  };

  const prune = () => {
    if (memory.size <= EXEC_CACHE_MAX) return;
    const oldest = [...memory.entries()].sort((a, b) => (a[1].t || 0) - (b[1].t || 0));
    for (let i = 0; i < oldest.length - EXEC_CACHE_MAX; i += 1) memory.delete(oldest[i][0]);
  };

  const persist = () => {
    if (!persistent) return;
    try {
      const plain = {};
      for (const [id, entry] of memory) plain[id] = entry;
      window.localStorage.setItem(storageKey, JSON.stringify(plain));
    } catch {
      persistent = false;           // 配额满 / 隐私模式：退回内存，不影响游戏
    }
  };

  let storage = null;
  try { storage = window.localStorage; } catch { storage = null; }
  if (storage) {
    try {
      const raw = storage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [id, entry] of Object.entries(parsed)) {
          const value = normalize(entry);
          if (id && value) memory.set(id, value);
        }
      }
    } catch { /* 旧数据损坏：当作空缓存，不阻断启动 */ }
    try {
      // 隐私模式下 getItem 可能不抛、setItem 才抛 ⇒ 用探针提前确认可写
      storage.setItem(`${storageKey}:probe`, "1");
      storage.removeItem(`${storageKey}:probe`);
    } catch {
      persistent = false;
    }
  } else {
    persistent = false;
  }
  prune();

  return {
    get: (actionId) => memory.get(String(actionId ?? "")) ?? null,
    set(actionId, entry) {
      const id = String(actionId ?? "");
      const value = normalize(entry);
      if (!id || !value) return;
      memory.set(id, value);
      prune();
      persist();
    },
    size: () => memory.size,
  };
}

/**
 * 对已执行过的动作只补回执，**绝不再次 dispatch**；`in_progress`（上次执行中断）
 * ⇒ 报 `uncertain`，由后端决定后续，客户端不重放。
 */
async function ackCachedAction(action, cached, deps) {
  const actionId = String(action?.action_id ?? "");
  if (!actionId) return;
  if (cached.status === "in_progress") {
    const reason = "页面中断，未确认是否执行";
    const acked = await deps.reportResult(actionId, "uncertain", reason);
    // 只有回执真的送达才把状态推进到 uncertain；否则留着 in_progress 等下次重投再补
    if (acked) deps.execCache.set(actionId, { status: "uncertain", reason, t: Date.now() });
    return;
  }
  await deps.reportResult(actionId, cached.status, cached.reason);
}

/**
 * 处理一批动作：已执行过的只补回执，其余 **先落 in_progress 再 dispatch**（至多一次）。
 * @returns {Promise<number>} 本批条数（含只补回执的）
 */
async function processActionBatch(actions, deps) {
  const { execCache, dispatchActions, reportResult, onError } = deps;
  const seen = new Set();
  const fresh = [];

  for (const action of actions) {
    const actionId = String(action?.action_id ?? "");
    if (!actionId) continue;        // 没有 id 就无法 ack（后端协议保证有）
    const cached = execCache.get(actionId);
    if (cached) {
      await ackCachedAction(action, cached, deps);
      continue;
    }
    if (seen.has(actionId)) continue;   // 同一批里的重复 id
    seen.add(actionId);
    fresh.push({ actionId, action });
  }

  if (!fresh.length) return actions.length;

  // ★ 至多一次：dispatch 之前先写 in_progress（如果这一行之后页面没了，重投只报 uncertain）
  for (const item of fresh) {
    execCache.set(item.actionId, { status: "in_progress", reason: "", t: Date.now() });
  }

  const batch = fresh.map(({ action }) => ({
    type: String(action?.type ?? ""),
    payload: {
      ...(action?.payload ?? {}),
      reason: action?.reason ?? action?.payload?.reason ?? "",
    },
  }));

  let results = [];
  let dispatchError = null;
  try {
    const dispatched = await dispatchActions(batch);
    results = Array.isArray(dispatched?.results) ? dispatched.results : [];
  } catch (err) {
    // dispatch 整体抛错 ⇒ 无法确认这批动作是否已部分生效，按 uncertain 处理（不重放）
    dispatchError = String(err?.message ?? err);
    onError?.(err);
  }

  for (let i = 0; i < fresh.length; i += 1) {
    const { actionId } = fresh[i];
    const outcome = results[i] ?? null;
    let status;
    let reason;
    if (outcome) {
      status = String(outcome.status || "unknown");
      reason = String(outcome.reason ?? "");
    } else if (dispatchError) {
      status = "uncertain";
      reason = `dispatch 异常：${dispatchError}`;
    } else {
      status = "unknown";
      reason = "dispatch 未返回结果";
    }
    reason = reason.slice(0, REPORT_REASON_MAX);
    // 缓存先写：即使 report 失败，下次重投也只补回执、不重买 ✓
    execCache.set(actionId, { status, reason, t: Date.now() });
    await reportResult(actionId, status, reason);
  }
  return actions.length;
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
  const execCache = createExecCache(pluginId);
  const timers = { poll: null, sync: null };
  let pollIdleStep = 0;
  let syncRetryStep = 0;
  let csrfPromise = null;

  function clearTimer(kind) {
    const timer = timers[kind];
    if (timer == null) return;
    clearTimeout(timer);
    timers[kind] = null;
  }

  function schedulePoll(delayMs) {
    clearTimer("poll");
    if (!state.running) return;
    timers.poll = setTimeout(() => {
      timers.poll = null;
      void pollLoop();
    }, Math.max(0, delayMs));
  }

  function scheduleSync(delayMs) {
    clearTimer("sync");
    if (!state.running) return;
    timers.sync = setTimeout(() => {
      timers.sync = null;
      void syncLoop();
    }, Math.max(0, delayMs));
  }

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

  /**
   * 回执。返回 false = 没送到（缓存保留，等后端 lease 过期重投时再补）。
   * ⚠️ 不在这里重试 —— 重投本身就是重试，且能避免把 poll 循环卡死。
   */
  async function reportResult(actionId, status, reason) {
    const id = String(actionId ?? "");
    if (!id) return false;
    try {
      const result = await callEntry("report_result", {
        action_id: id,
        status: String(status || "unknown"),
        reason: String(reason ?? "").slice(0, REPORT_REASON_MAX),
      });
      if (!result) return false;             // 没取到 trigger_response = 没确认 ack
      if (typeof result === "object" && (result.ok === false || result.acked === false)) return false;
      return true;
    } catch (err) {
      state.lastError = String(err?.message ?? err);
      return false;
    }
  }

  async function syncState() {
    if (!state.running || state.syncing) return false;
    state.syncing = true;
    try {
      await callEntry("sync_state", { snapshot: trimSnapshotForTransport(buildSnapshot()) });
      state.lastSyncAt = Date.now();
      return true;
    } catch (err) {
      state.lastError = String(err?.message ?? err);
      return false;
    } finally {
      state.syncing = false;
    }
  }

  async function pollOnce() {
    if (!state.running || state.polling) return 0;
    state.polling = true;
    try {
      const result = await callEntry("poll_actions", { limit: 8 });
      state.lastPollAt = Date.now();
      const actions = Array.isArray(result?.actions) ? result.actions : [];
      if (!actions.length) return 0;
      await processActionBatch(actions, {
        execCache,
        dispatchActions,
        reportResult,
        onError: (err) => { state.lastError = String(err?.message ?? err); },
      });
      return actions.length;
    } catch (err) {
      state.lastError = String(err?.message ?? err);
      return 0;
    } finally {
      state.polling = false;
    }
  }

  async function pollLoop() {
    if (!state.running) return;
    const received = await pollOnce();
    if (!state.running) return;
    if (received > 0) {
      pollIdleStep = 0;
      schedulePoll(POLL_AFTER_ACTION_MS);   // 队列里可能还有，立刻再领
      return;
    }
    const delay = POLL_IDLE_MS[Math.min(pollIdleStep, POLL_IDLE_MS.length - 1)];
    pollIdleStep += 1;
    schedulePoll(delay);
  }

  async function syncLoop() {
    if (!state.running) return;
    const ok = await syncState();
    if (!state.running) return;
    if (ok) {
      syncRetryStep = 0;
      scheduleSync(SYNC_INTERVAL_MS);
      return;
    }
    const delay = SYNC_RETRY_MS[Math.min(syncRetryStep, SYNC_RETRY_MS.length - 1)];
    syncRetryStep += 1;
    scheduleSync(delay);
  }

  function bindFullscreenButton() {
    const button = document.getElementById("neko-fullscreen");
    if (!button || button.dataset.nekoBound === "1") return;
    button.dataset.nekoBound = "1";
    button.hidden = false;
    const syncLabel = () => {
      button.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
    };
    button.addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    });
    document.addEventListener("fullscreenchange", syncLabel);
    syncLabel();
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

  const bridge = {
    pluginId,
    async start(snapshotBuilder) {
      if (state.running) return bridge;
      snapshotFn = snapshotBuilder;
      state.running = true;
      pollIdleStep = 0;
      bindFullscreenButton();
      const syncOk = await syncState();      // 首次同步失败也照常启动动作轮询
      if (!state.running) return bridge;
      if (syncOk) {
        syncRetryStep = 0;
        scheduleSync(SYNC_INTERVAL_MS);
      } else {
        syncRetryStep = 1;
        scheduleSync(SYNC_RETRY_MS[0]);
      }
      schedulePoll(0);
      return bridge;
    },
    stop() {
      state.running = false;
      clearTimer("poll");
      clearTimer("sync");
    },
    callEntry,
    status: () => ({ ...state, pluginId }),
  };
  return bridge;
}
