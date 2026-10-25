/**
 * neko/control.js —— 宿主下发的 control 处理器（含 3 秒去重）
 *
 * 两条路都可能送来同一条 control：
 *   ① `dialogue.request` 响应的 `data.control`（游戏主动问时）；
 *   ② `/route/drain` 的 outputs（宿主有生产者时，例如语音劫持/主动推送）。
 * 两条路都走这里 ⇒ 3 秒内同签名只执行一次，避免"买一次变买两次"。
 */
import { dispatchNekoActions } from "./actions.js";

export function createControlHandler({ getState, actionApi, status, report, publishSnapshot } = {}) {
  let lastControlSig = { sig: "", at: 0 };

  return function handleControl(client, envelope) {
    const payload = envelope?.payload ?? {};
    const type = String(payload?.type ?? "");
    const signature = `${type}|${payload?.id ?? ""}|${payload?.max === true}`;
    const now = Date.now();
    if (lastControlSig.sig === signature && now - lastControlSig.at < 3000) {
      return { type, status: "duplicate", reason: "3 秒内重复的 control，已忽略" };
    }
    lastControlSig = { sig: signature, at: now };

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

    // 端到端调试出口（不参与业务）：最后一条 control 与它的执行结果。
    if (status) {
      status.lastControl = {
        type,
        payload: { id: payload?.id, max: payload?.max === true },
        result,
        at: Date.now(),
      };
    }

    try { publishSnapshot?.(); } catch { /* 同上 */ }
    return result;
  };
}
