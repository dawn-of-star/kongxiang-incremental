/**
 * engine.js —— 引擎层的公共门面（barrel）
 *
 * ★ 2026 模块化：实现拆到 `src/engine/` 的 5 个模块；本文件只做 re-export。
 *   ⇒ `import { tick, doBigCrunch } from "./engine.js"` 的既有写法一行都不用改 ✓
 *   · tick / advance      → engine/tick.js
 *   · 点击 / 可重复 / 自动 → engine/actions.js
 *   · 大坍缩 / 重置        → engine/collapse.js
 *   · 其余购买            → engine/purchases.js
 *   · 永恒                → engine/eternity.js
 */
export * from "./engine/tick.js";
export * from "./engine/actions.js";
export * from "./engine/collapse.js";
export * from "./engine/purchases.js";
export * from "./engine/eternity.js";
export { matterCoeff } from "./formulas.js";
