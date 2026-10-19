/**
 * neko.js —— N.E.K.O 接入层的公共门面（显式 re-export）
 *
 * ★ 2026 模块化：实现拆到 `src/neko/` 的 4 个模块；本文件只 re-export **原公开 API**。
 *   · log       日志分类 / 结构化条目
 *   · snapshot  只读状态快照
 *   · actions   动作白名单 / 派发器
 *   · bridge    宿主探测 / 握手 / 助手上下文
 */
export { nekoLogKind, nekoLogEntry, nekoKeyLogEntries } from "./neko/log.js";
export { NEKO_SNAPSHOT_SCHEMA, nekoSnapshot, nekoSnapshotForHost } from "./neko/snapshot.js";
export { dispatchNekoActions } from "./neko/actions.js";
export {
  nekoHostPresent, NEKO_GAME_ID, NEKO_GAME_VERSION, NEKO_PROTOCOL_VERSION, NEKO_MANIFEST,
  buildAssistContext, createNekoBridge,
} from "./neko/bridge.js";
