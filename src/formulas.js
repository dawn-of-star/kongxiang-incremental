/**
 * formulas.js —— 计算层的公共门面（barrel）
 *
 * ★ 2026 模块化：实现拆到 `src/formulas/` 的 10 个领域模块；本文件只做 re-export。
 *   ⇒ `import { matterRate } from "./formulas.js"` 的既有写法一行都不用改 ✓
 *   · core 工具 / global 全局 / zpe / dark-energy / dark-energy-rate
 *   · entropy / matter / costs / quantum / infinity
 */
export * from "./formulas/core.js";
export * from "./formulas/global.js";
export * from "./formulas/zpe.js";
export * from "./formulas/dark-energy.js";
export * from "./formulas/dark-energy-rate.js";
export * from "./formulas/entropy.js";
export * from "./formulas/matter.js";
export * from "./formulas/costs.js";
export * from "./formulas/quantum.js";
export * from "./formulas/infinity.js";
