/**
 * state.js —— 状态层的公共门面（barrel）
 *
 * ★ 2026 模块化：实现拆到 `src/state/` 的 5 个模块；本文件只做 re-export。
 *   · schema      newState（字段与默认值）
 *   · accessors   等级 / 里程碑 / 成就计数
 *   · log         环形日志 / 关键等级
 *   · serialize   存档序列化 / 反序列化 + 旧档迁移
 *   · helpers     D()
 */
export * from "./state/helpers.js";
export * from "./state/schema.js";
export * from "./state/accessors.js";
export * from "./state/log.js";
export * from "./state/serialize.js";
