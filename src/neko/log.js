/**
 * neko/log.js —— 日志分类与结构化条目（kind / data）
 *
 * ★ 2026 模块化：由 907 行的 neko.js 按职责拆出（声明与注释逐字保留）。
 *    对外统一从 `src/neko.js`（barrel）导入。
 */


const KIND_RULES = [
  // ⚠️ **顺序有意义：先匹配到的赢**，所以"更具体的文本模式"必须排在"宽泛的 emoji"前面。
  //   ★ 2026：`[/无限挑战/, "system"]` 这条**已删除** ——
  //     IC 整个系统被用户删除 ⇒ 那类日志**永远不会再出现** ✓
  //     留一条永不命中的规则 = 分类表与实现脱节（本项目最忌讳的东西）✗
  //   （历史教训留档：它原来必须排在 `/🌌|💠/` **前面**，否则「开始无限挑战」会被判成 `crunch`）
  // 大坍缩 / 打破无限 —— 无限层的"事件"
  [/🌌|💠/, "crunch"],
  // 量子
  [/⚛/, "quantum"],
  // 购买（含买满/跨级）
  [/⬆|⚡|∞ 购买|💭 (购买|首次购买|新成就)/, "buy"],
  // 里程碑 / 成就
  [/🏆|成就/, "milestone"],
  // 永恒 / 引擎 / 相变仪 / 存档等 —— 归 system
  [/⏳|⚙|🔒|⚠️|📋|☢️|🌊|检测到|已解锁|已开启/, "system"],
];

/**
 * 推导一条日志的 `kind`（`NEKO.md` §9 的固定枚举）。
 * @param {string} text 日志原文
 * @returns {"crunch"|"buy"|"milestone"|"quantum"|"system"}
 */
export function nekoLogKind(text) {
  const s = String(text ?? "");
  for (const [re, kind] of KIND_RULES) if (re.test(s)) return kind;
  return "system";        // 兜底：不认识的都算 system（**不猜**，宁可粗）
}

/**
 * 把内部日志条目转成 `NEKO.md` §9 的形状 `{ t, kind, text, data }`。
 * @param {{t:number,text:string,kind?:string,data?:object}} entry
 */
export function nekoLogEntry(entry) {
  const text = String(entry?.text ?? "");
  return {
    t: Number(entry?.t) || Date.now(),
    kind: entry?.kind ?? nekoLogKind(text),
    text,
    data: entry?.data ?? {},
  };
}

/**
 * ★★★ `NEKO.md` §5：**只读状态快照**（喂给宿主 `StatePublisher`）。
 *
 * 原则（§5 原文）：「只读、版本化、不暴露可写入口」
 * ⚠️ 字段名我**逐个核对过实际 state**（避免又一份"文档 ≠ 实现"）：
 *   · `entropy` / `particle` / `matter` 在 `resources` 下，其余多数在**顶层** ✓
 *   · `darkMatter` **不存在**（属后续阶段）⇒ 不写进来，**不许编** ✓
 * @param {object} state
 * @param {number} [nowMs] 快照时间（测试可注入，保证可断言）
 */
const NEKO_KEY_LOG_RE = /解锁|已开启|首次|大坍缩|打破无限|永恒|里程碑|成就|相变|七巧板|时空|崩溃|重置/;

/**
 * 从 `state.log` 里取**最近的关键日志**（新的在前扫，最后按时间正序返回）。
 *
 * @param {object} state
 * @param {{limit?:number}} [opts] 最多返回多少条（默认 12）
 * @returns {Array<{t:number,kind:string,text:string}>}
 */
export function nekoKeyLogEntries(state, { limit = 12 } = {}) {
  const log = Array.isArray(state?.log) ? state.log : [];
  const out = [];
  for (let i = log.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const entry = nekoLogEntry(log[i]);
    // ★ 购买类**无条件丢弃** —— 「💭 首次购买…」会命中白名单里的 `首次`，
    //   但它属于流水而非"系统解锁"，只看文本会漏进来（实测抓到 3 条）。
    if (entry.kind === "buy") continue;
    if (!NEKO_KEY_LOG_RE.test(entry.text)) continue;
    out.push({ t: entry.t, kind: entry.kind, text: entry.text });
  }
  return out.reverse();
}

/**
 * 把 `nekoSnapshot()` 投影成**契约允许**的形状。
 *
 * 三处必要修剪（都是"契约 vs 语义"的取舍）：
 *   ① `rates` / `multipliers` 为 `null` 时**整个字段省略** —— 契约子集没有 `anyOf`，
 *      而它们**不该被编成 0**（0 是"真的没产出"的意思）；
 *   ② `log` 只保留**系统解锁 + 转生层**（见 `nekoKeyLogEntries`），
 *      且最多 12 条 —— 实测这能把日志从 1,329 字符压到 ~200；
 *   ③ `log[].data` 不发给宿主 —— 它可能含任意结构（引擎内部字段），
 *      契约里只声明 `t/kind/text`，砍掉比放宽校验更安全。
 */
