/**
 * config/quantum.js —— 量子层的门面（barrel）
 *
 * ★ 2026 模块化：实现拆到 `src/config/quantum/` 的 2 个模块。
 *   · gates    门槛 / 捕获 / 量子加成
 *   · growth   粒子增幅 b / 跨度幂 k / 暗能量自增长 / 档位加速
 */
export * from "./quantum/gates.js";
export * from "./quantum/growth.js";
