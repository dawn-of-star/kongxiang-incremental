/**
 * config/zpe-engine.js —— ZPE 引擎门面（barrel）
 *
 * ★ 2026 模块化：实现拆到 `src/config/zpe-engine/` 的 2 个模块。
 *   · config    参数 + 五条机制
 *   · economy   等级 / 价格 / 买满探针
 */
export * from "./zpe-engine/config.js";
export * from "./zpe-engine/economy.js";
