/**
 * state/log.js —— 日志环形缓冲、关键等级与结构化日志
 *
 * ★ 2026 模块化：由 673 行的 state.js 按职责拆出（声明与注释逐字保留）。
 *    对外统一从 `src/state.js`（barrel）导入。
 */


export const LOG_MAX = 60;

/**
 * ★★★ 2025（`docs/NEKO.md` §9）：**日志的额外出口**（宿主桥）。
 *
 * 为什么用"注册回调"而不是让 `state.js` 直接 import `neko.js`：
 *   `pushLog` 有 **40+ 处调用点**，而它们全都只关心"记一条" ⇒
 *   在这里挂一个可选回调，就能让**全部**日志自动流向宿主桥，
 *   而**一处调用点都不用改** ✓（改 40 处必然漏，且会污染业务代码）
 * ⚠️ 回调必须**永不抛**（日志失败不该影响游戏）—— 这里包了 try/catch 兜底，
 *   但注册方也应自己吞异常（见 `neko.js` 的 `sendLog`）。
 */
let logSink = null;
export function setLogSink(fn) { logSink = typeof fn === "function" ? fn : null; }

/** ★ 原稿的 #log-panel 是死 UI（从没被写过）。这里补上。 */
export function pushLog(state, text, data = undefined) {
  const entry = { t: Date.now(), text };
  if (data !== undefined) entry.data = data;   // ★ §9：可选的结构化附加数据
  state.log.push(entry);
  if (state.log.length > LOG_MAX) state.log.splice(0, state.log.length - LOG_MAX);
  // ★ 顺带推给宿主桥（无宿主时它是 no-op ✓）；失败绝不影响游戏
  if (logSink) { try { logSink(entry); } catch { /* 忽略 */ } }
}

/**
 * 重复购买类升级的**日志关键节点**：`1, 5, 10, 50, 100, 500, 1000, …`
 * （×5、×2 交替 —— 用户指定"1，5，10，50，100 以此类推"）。
 *
 * 为什么需要：自动获取模式下一帧能买几百级，逐级写日志会把面板刷爆
 * （也让"真正重要的事件"被冲走）。
 */
export const KEY_LEVELS = (() => {
  const out = [1];
  let v = 1, i = 0;
  while (v < 1e18) { v *= i++ % 2 === 0 ? 5 : 2; out.push(v); }
  return out;
})();

/** 这个等级本身是不是关键节点 */
export function isKeyLevel(n) {
  return KEY_LEVELS.includes(n);
}

/**
 * ★★★ 2025（用户裁定）：**量子的日志节点 = `1 / 5 / 25 / 125 / 625 …`（纯 ×5）**。
 *
 * 用户原话：「顺手优化下量子的日志输出，每 1/5/25/125/625（以此类推）对量子输出」
 *
 * ⚠️ 为什么不复用 `KEY_LEVELS`（它是 ×5、×2 **交替**）：
 *   那是给"重复购买类升级"用的（用户当年指定 1、5、10、50…）；
 *   量子要的是**纯 ×5** 序列 ⇒ 两套判据**语义不同，不能混用** ✗
 *   （混用会让日志在 2、10、50… 也冒出来，与用户要的序列不符）
 *
 * 上界 `1e18` 与 `KEY_LEVELS` 同族：再大就不可能在一局里达到（防除法/比较开销）✓
 */
export const QUANTUM_LOG_LEVELS = (() => {
  const out = [];
  for (let v = 1; v <= 1e18; v *= 5) out.push(v);
  return out;
})();

/** 这一对数量是不是量子日志的关键节点 */
export function isQuantumLogLevel(n) {
  return QUANTUM_LOG_LEVELS.includes(n);
}

/** 从 `from` 买到 `to` 的过程中**跨过的最高关键节点**（没跨过返回 0） */
export function crossedKeyLevel(from, to) {
  let hit = 0;
  for (const k of KEY_LEVELS) if (k > from && k <= to) hit = k;
  return hit;
}

/**
 * 重复购买类升级的等级日志：**只在跨过关键节点时写一条**。
 *
 * 统一入口 —— 手动买、自动获取、暗能量升级、无限升级① 全部走这里，
 * 免得以后有人加新升级时忘了这条规矩（日志策略只在一个地方定义）。
 *
 * @returns {boolean} 是否真的写了一条
 */
export function pushLevelLog(state, name, from, to) {
  const hit = crossedKeyLevel(from, to);
  if (!hit) return false;
  pushLog(state, `⬆「${name}」→ ${to} 级（跨过 ${hit} 级）`);
  return true;
}

// ══════════════════════════════════════════════════════════
// 序列化（所有 Decimal 转字符串）
// ══════════════════════════════════════════════════════════

