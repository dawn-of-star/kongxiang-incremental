/**
 * config.js —— 配置层的公共门面（barrel）
 *
 * ★ 2026 模块化：`src/config/` 下按领域拆成 12 个文件，本文件只做 re-export。
 *   ⇒ `import { ... } from "./config.js"`（src 与 tools 的既有写法）**一行都不用改** ✓
 *   ⇒ 依赖方向与各领域职责见 `docs/ARCHITECTURE.md`。
 *
 * ⚠️ 新增常量/函数时：放进对应的领域模块，**不要**把逻辑写回本文件。
 */

export * from "./config/base.js";
export * from "./config/upgrades.js";
export * from "./config/milestones.js";
export * from "./config/zpe-engine.js";
export * from "./config/eternity.js";
export * from "./config/dream.js";
export * from "./config/dark-energy.js";
export * from "./config/quantum.js";
export * from "./config/infinity.js";
export * from "./config/dark-matter.js";
export * from "./config/zones.js";
export * from "./config/neko.js";
