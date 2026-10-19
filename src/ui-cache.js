/**
 * ui-cache.js —— DOM 缓存 / 写入去重 / 真实写入计数
 *
 * ★ 2026 模块化：从 ui-core.js 再拆一层。本文件只做一件事：
 *   把 `$()` 查到的节点缓存进 `el`，并给高频写入装"值没变就不写"的拦截器。
 *
 * ⚠️ CACHE_IDS 里的每个 id 都必须在 index.html 里静态存在；
 *    `cache()` 找不到时会 console.error 点名（dom-smoke 也会查这张表）。
 */

const $ = (id) => document.getElementById(id);
const el = {};

/**
 * textContent 的原生访问器。
 * 在 Node 环境下（tools/dom-smoke.mjs）没有 Node 全局，所以允许为 null。
 */
const TEXT_DESC = typeof Node !== "undefined" && Node.prototype
  ? Object.getOwnPropertyDescriptor(Node.prototype, "textContent")
  : null;
/** `innerHTML` / `className` 在 `Element.prototype` 上 */
const EL_PROTO = typeof Element !== "undefined" ? Element.prototype : null;
const HTML_DESC = EL_PROTO ? Object.getOwnPropertyDescriptor(EL_PROTO, "innerHTML") : null;
const CLASS_DESC = EL_PROTO ? Object.getOwnPropertyDescriptor(EL_PROTO, "className") : null;
/** `hidden` / `disabled` 在 `HTMLElement.prototype` 上 */
const HTMLEL_PROTO = typeof HTMLElement !== "undefined" ? HTMLElement.prototype : null;
const HIDDEN_DESC = HTMLEL_PROTO ? Object.getOwnPropertyDescriptor(HTMLEL_PROTO, "hidden") : null;
const DISABLED_DESC = HTMLEL_PROTO ? Object.getOwnPropertyDescriptor(HTMLEL_PROTO, "disabled") : null;

/**
 * ★★★ 2025（用户报「数字跳动速率及其低下」）：**DOM 写入的真实计数器**。
 *
 * 背景（很重要，我为此错过一次）：
 *   本项目**早就有** `wrapEl` 做 `textContent` 的去重 —— 但它有 `if (!TEXT_DESC) return node`
 *   的早退，而 `TEXT_DESC` 在 **Node 里是 null** ⇒
 *   **我所有的 Node 基准测的都是"没有去重"的版本**，于是我一直复现不出用户看到的 170ms ✗
 *   （Node 里每帧 233 次 textContent、100% 冗余；浏览器里这些早被拦掉了）
 * ⇒ 真正剩下的写入是 `innerHTML` / `classList` / `hidden` 这几类 —— 本文件现在也去重了它们，
 *   并且**把"真实写入数"暴露出来**，这样 HUD 能显示"每帧到底碰了几次 DOM"✓
 */
export const domWriteStats = { text: 0, html: 0, cls: 0, bool: 0, skipped: 0 };
export function domResetStats() { domWriteStats.text = 0; domWriteStats.html = 0; domWriteStats.cls = 0; domWriteStats.bool = 0; domWriteStats.skipped = 0; }

/**
 * 拦截重复的 DOM 写入（`textContent` / `innerHTML` / `className` / `hidden` / `disabled`）。
 *
 * 为什么值得：给这些属性赋值会标记节点 dirty，触发样式重算 + 布局。
 * 增量游戏里大部分数字每秒才变一次，20fps 下约 95% 的写入是白写的。
 *
 * ⚠️ 这里**必须用 defineProperty，不能用 Proxy**。
 *    Proxy 的问题：`proxy.appendChild(x)` 时 `this` 是 Proxy 而不是真实节点，
 *    而原生 DOM 方法要求 `this` 是真元素 —— 浏览器会抛
 *    `TypeError: Illegal invocation`。
 *    （踩过这个坑。defineProperty 直接改元素自身的属性，不碰 this。）
 *
 * ⚠️ 每个节点**各自一份** last（在闭包里）—— 这是对的；
 *    原来我就把 `let last` 写在函数体里、每个节点独立 ✓（没写错）
 */
function wrapEl(node) {
  if (!node) return node;
  // ★★★ 2025：**性能诊断开关**（见 index.html 顶部的说明）
  //   `?nowrap=1` 或控制台 `window.__NO_DOM_WRAP = true` ⇒ 完全跳过拦截器。
  //   用途：A/B 判断"拦截器是否制造了 V8 性能悬崖"（用户报 150ms/帧）
  if (globalThis.__NO_DOM_WRAP === true) return node;
  /** 给一个属性装"值没变就不写"的拦截器 */
  const dedupe = (prop, desc, bucket) => {
    if (!desc) return;
    let last;
    let first = true;
    Object.defineProperty(node, prop, {
      configurable: true,
      enumerable: true,
      get() { return desc.get.call(this); },
      set(v) {
        // ⚠️ 第一次必须放行：`last` 初值 `undefined` 与真实初值可能相同，
        //    但那不影响正确性（反正要写的是同一个值）；这里放行是为了
        //    让"首帧一定把 DOM 写对"这条更直观 ✓
        if (!first && last === v) { domWriteStats.skipped++; return; }
        first = false;
        last = v;
        domWriteStats[bucket]++;
        desc.set.call(this, v);
      },
    });
  };
  dedupe("textContent", TEXT_DESC, "text");
  dedupe("innerHTML", HTML_DESC, "html");
  dedupe("className", CLASS_DESC, "cls");
  dedupe("hidden", HIDDEN_DESC, "bool");
  dedupe("disabled", DISABLED_DESC, "bool");
  wrapClassList(node);
  return node;
}

/**
 * ★★★ 2025：`classList` 的**去重包裹**（`classList.toggle` 每帧约 150 次，是剩下的大头）。
 *
 * ⚠️ 为什么必须包 `classList` 本身、而不是只包 `className`：
 *   `el.classList.toggle("affordable", can)` 直接操作 **DOMTokenList**，
 *   完全绕过 `className` 的 setter ⇒ 上面给 `className` 装的拦截器**抓不到它** ✗
 *   （这正是"我改了一处却还剩 150 次写入"的原因）
 *
 * ⚠️ `WeakMap` 记"每个节点当前的 class 集合"：只对**我们自己写过**的类去重；
 *   外部改动（极少）顶多让某次 toggle 白写一次，不影响正确性 ✓
 */
const classCache = new WeakMap();
function wrapClassList(node) {
  const list = node.classList;
  if (!list || typeof list.toggle !== "function") return node;
  const origAdd = list.add.bind(list);
  const origRemove = list.remove.bind(list);
  const origToggle = list.toggle.bind(list);
  const setOf = (n) => {
    let s = classCache.get(n);
    if (!s) { s = new Set(Array.from(list)); classCache.set(n, s); }
    return s;
  };
  const api = {
    contains: (c) => list.contains(c),
    add: (...cs) => {
      const s = setOf(node);
      const real = cs.filter((c) => !s.has(c));
      if (!real.length) { domWriteStats.skipped += cs.length; return; }
      domWriteStats.cls += real.length;
      for (const c of real) s.add(c);
      origAdd(...real);
    },
    remove: (...cs) => {
      const s = setOf(node);
      const real = cs.filter((c) => s.has(c));
      if (!real.length) { domWriteStats.skipped += cs.length; return; }
      domWriteStats.cls += real.length;
      for (const c of real) s.delete(c);
      origRemove(...real);
    },
    toggle: (c, force) => {
      const s = setOf(node);
      const want = force === undefined ? !s.has(c) : !!force;
      if (s.has(c) === want) { domWriteStats.skipped++; return want; }   // 状态没变 ⇒ 不碰 DOM ✓
      domWriteStats.cls++;
      if (want) s.add(c); else s.delete(c);
      return origToggle(c, want);
    },
  };
  // ⚠️ 返回**稳定对象**（不能每次新建 —— 调用方可能缓存引用）
  Object.defineProperty(node, "classList", { configurable: true, enumerable: true, get() { return api; } });
  return node;
}



/** 页面上所有需要缓存的静态 id（顺序不影响功能，只影响首次缓存顺序） */
const CACHE_IDS = [
    "offline-banner", "fatal", "zone-legend",
    "val-entropy", "rate-entropy", "val-particle", "rate-particle",
    "val-matter", "rate-matter", "val-dream", "val-zpe", "rate-zpe",
    "val-de", "rate-de", "global-multiplier", "countfreq-detail", "gm-dream", "gm-countfreq", "gm-de",
    "btn-click", "click-gain",
    "upgrade-list", "upgrade-count",
    "btn-buy-trap", "trap-lv", "trap-cost", "trap-badge", "trap-effective", "entropy-rule",
    "d-entropy-rate", "d-particle-rate", "d-matter-rate", "d-zpe-rate",
    "d-zpe-mult", "d-zpe-prod", "d-de-mult", "d-zpe-penalty",
    "d-clicks", "d-playtime",
    "log-panel",
    "tab-tag-void", "void-count", "zpe-multiplier", "void-upgrade-list", "milestone-list",
    "de-locked", "de-content", "de-unlock-cond", "btn-unlock-transmuter",   // ← 暗能量页**保留**锁定块（用户只要求删量子/无限/永恒）
    // ★ 2025：各面板「已解锁过」的提示（第一次永恒后不再上锁，见 config.js 的 pageUnlocked）
    "de-locked-title", "de-perma-hint",
    // ⚠️ `inf-locked*` / `eternity-locked*` / `q-locked*` 等**已全部删除**
    //   （用户裁定：量子/无限/永恒的锁定块删掉，`eternity` 的"待推进"墙是他截图报的 bug）
    //   ⇒ 这里不再登记它们；新元素见下面的 `*-hint` / `*-progress` ✓
    "de-multiplier", "de-penalty", "de-upgrade-list", "de-milestone-list",
    // ── 标签页 ──
    "tabs", "tab-void", "tab-de", "tab-quantum", "tab-infinity", "tab-eternity",
    "panel-void", "panel-zpe", "panel-de", "panel-quantum", "panel-infinity", "panel-eternity",
    // ★★★ 2026：暗能量的第二个子页（设计稿第 50 行）
    "panel-darkm",
    // ★★★ 2025（用户裁定）：主控台的子页（梦想 / 猫猫）
    "panel-dream", "panel-neko",
    "tab-wrap-console", "tab-flyout-console", "flyout-console-core", "flyout-console-dream", "flyout-console-neko",
    "tab-tag-void", "tab-tag-de", "tab-tag-quantum", "tab-tag-infinity", "tab-tag-eternity",
    // ── 永恒（**先占位**：门槛 + 永恒点公式，内容待设计）──
    "eternity-content", "eternity-need-inline",
    "btn-eternity", "eternity-status",
    "val-eternity", "eternity-gain", "eternity-count",
    // ── 主控台（原左列的 5 张卡并进标签页后的第一个面板）──
    "panel-console",
    // ── 虚空科技的子页悬浮入口（悬停/聚焦时浮出两条）──
    "tab-wrap-void", "tab-flyout-void", "flyout-void-core", "flyout-void-zpe",
    // ── 无限的子页悬浮入口（悬停「无限」浮出两条）──
    "tab-wrap-infinity", "tab-flyout-infinity", "flyout-inf-core", "flyout-inf-deep", "panel-infdeep",
    // ── ★★★ 2026：暗能量的子页悬浮入口（悬停「暗能量」浮出两条）──
    "tab-wrap-de", "tab-flyout-de", "flyout-de-core", "flyout-de-darkm",
    // ── ★★★ 2026：暗物质面板（暗能量的第二个子页）──
    "darkm-locked", "darkm-locked-title", "darkm-unlock-cond", "darkm-content",
    "darkm-count", "darkm-price", "darkm-ep", "darkm-afford",
    "darkm-speed", "darkm-eff", "darkm-target", "darkm-effect", "darkm-term",
    // ★ 第二台相变仪的动态环（形制照第一台的 de-ring-*）✓
    "darkm-ring-wrap", "darkm-ring-fill", "darkm-ring-pct", "darkm-ring-progress",
    "btn-darkm", "darkm-status", "darkm-cost",
    "btn-max-darkm", "max-darkm-n",
    // ── ★★★ 2026：永恒的第二个子页 = **七巧板**（骨架；机制见 docs/TANGRAM.md）──
    "tab-wrap-eternity", "tab-flyout-eternity", "flyout-eternity-core", "flyout-eternity-tangram",
    "panel-tangram", "tangram-hint", "tangram-progress",
    //   ★ 2026 用户指定版式：左 = 坐标轴（三条线 + 覆盖率读数）｜右 = 托盘 15%｜下 = 拼装挑战
    "tg-cov-vert", "tg-cov-horz", "tg-cov-diag",
    "tangram-cov-vert", "tangram-cov-horz", "tangram-cov-diag",
    "tangram-chal-need", "tangram-chal-progress",
    // ── ZPE 引擎（虚空科技第二个子页）──
    "zpe-engine-locked", "zpe-engine-content", "zpe-engine-unlock-cost", "btn-unlock-zpe-engine",
    "zpe-engine-level", "zpe-engine-prod", "zpe-engine-exp", "zpe-engine-ip",
    "btn-buy-zpe-engine", "btn-buy-zpe-engine-max", "zpe-engine-afford",
    "zpe-engine-buy-desc", "zpe-engine-cost", "zpe-engine-mechanisms",
    // ── 量子（第四层，红色）──
    // ⚠️ `q-locked` / `q-need` 已删除（用户裁定：锁定块删掉 ⇒ 内容常显）✓
    "q-content", "q-hint",
    "val-quantum", "quantum-sub", "quantum-mult", "quantum-demult", "quantum-degain", "quantum-zpemult", "quantum-grow",
    // ★ 量子共振（原名「跨度层」）：k / 乘数 / 基准 / 徽标
    "span-badge", "span-de", "span-state", "span-k", "span-mult", "span-base", "span-kmax",
    // ★★★ 2025：三页描述里的数字（由 buildDynamicText 从常量渲染，**不手写** ✗）
    "zpe-price-shape", "zpe-price-anchor", "zpe-k-shape",
    "perf-hud",
    // ★★★ 2025（用户裁定）：量子/无限/永恒的**锁定块已删除**，改为页内提示条 + 行内进度
    "q-hint", "inf-hint", "inf-progress", "eternity-hint", "eternity-progress", "eternity-need-inline",
    "quantum-pairs", "quantum-next-cost", "quantum-cur-zpe",
    "quantum-bar", "quantum-bar-text",
    "dream-badge", "dream-upgrade-list",
    
    // ── 相变环（暗能量页）──
    "de-ring-wrap", "de-ring-fill", "de-ring-pct", "de-ring-rate", "de-ring-de",
    // ── 无限（金色）──
    // ⚠️ `inf-locked` 已删除；`inf-need` / `inf-content` 保留（内容常显）✓
    "inf-content", "bigcrunch-need", "inf-hint", "inf-progress",
    "val-infinity", "bigcrunch-count", "bigcrunch-need",
    "bigcrunch-gain", "btn-bigcrunch", "bigcrunch-status",
    "bigcrunch-desc", "btn-break-infinity", "break-state", "overload-state",
    // ── 坍缩里程碑（铸币与坍缩加速器都已删除）──
    "tier-ms-badge", "tier-milestone-list",
    // ★ 2025：永恒里程碑（设计稿 36~44 行）
    "eternity-ms-badge", "eternity-milestone-list",
    // ★★★ 2025：永恒升级「永恒增幅」（设计稿 33~35 行）
    "btn-eternity-upg-epMult", "eternity-upg-epMult-lv", "eternity-upg-epMult-desc",
    "eternity-upg-epMult-cost", "btn-max-eternity-upg-epMult", "max-eternity-upg-epMult-n",
    // ★★★ 2025（NEKO.md §7 / 设计稿 §10）：猫猫**子页**（主控台 → 猫猫；两列布局）
    "neko-badge", "neko-affinity", "neko-exponent", "neko-next", "neko-bar", "neko-bar-text",
    "neko-drift", "neko-note", "neko-tier-list",
    // 左列：道具（定价按 `NEKO.md` §10；★ 2025 已实装 ⇒ 是三个真按钮）+ 调试按钮
    "neko-item-badge", "neko-item-list", "neko-item-note",
    "btn-neko-item-catFood", "neko-item-catFood-cost", "neko-item-catFood-gain",
    "btn-neko-item-lollipop", "neko-item-lollipop-cost", "neko-item-lollipop-gain",
    "btn-neko-item-paw", "neko-item-paw-cost", "neko-item-paw-gain",
    // 右列：对话（等 SDK）
    "neko-chat-badge", "neko-chat", "neko-msg-placeholder", "neko-sdk-state",
    // ★★★ 2025：梦想（自动化）子页（用户裁定归属主控台；目前是壳 + 自动化状态）
    "dream-page-badge",
    // ★ 2025（设计稿第 27 行）：**日志搬到梦想子页**后的徽标
    "log-badge",
    // ★★★ 2025（设计稿第 27 行）：主面板**折叠分组**（下拉条 + "记住"复选框）
    "fold-log-head", "fold-log-body", "fold-log-remember", "fold-log-hint",
    // ★★★ 2025：全局加成槽的**好感度指数**那一格（生效时才显示）
    "gm-neko",
    // ★★★ 2025：**自动化状态**（已移到梦想子页 ⇒ id 仍是这两个）
    "auto-acquire", "auto-de",
    // ⚠️ 2026：无限挑战的宿主 id（ic 开头那个）**已移除** ——
    //   无限挑战（IC）整个系统被用户删除 ⇒ 那个宿主节点 + `ui-ic.js` 一起没了 ✓
    //   （`index.html` 的对应块也已删除）
    //   ⚠️ 这段注释**故意不写出那个 id 字面量** —— `dom-smoke` 的「缺失的 id」守卫
    //      会扫 `cache()` 区域的引号字符串，而它**不剥离行注释** ⇒ 写出来会误报 ✗（我踩过两次）
    // ★★★ 2025：**全页面悬浮重置窗**（用户要求）——
    //   ⚠️ 这几个 id **必须进 cache()**，否则 `el[...]` 是 undefined
    //     ⇒ 「点了没反应」且不会报错（本项目踩过多次：漏登记 id）✗
    //     ⚠️⚠️ 本注释**故意不写出"取 id 的那种下标字面量"**（就是
    //       `el` + 方括号 + 引号 id 的那个写法）—— `dom-smoke` 的
    //       "缺失的 id" 守卫**不剥行注释**，会把它当成真的 id 去 index.html 找、
    //       然后误报「缺失的 id ❌ x」✗（我第一版就是那么写的，烟测立刻报红）
    //     注意：**不需要**把占位按钮（时空/梦想）放进来 —— 它们永远不可点，
    //     也没有需要刷新的文案（副标题写死"占位"）⇒ 放进来只是噪音 ✓
    "fr-min", "fr-btn-infinity", "fr-btn-eternity", "fr-sub-infinity", "fr-sub-eternity",
    //   ⚠️ 容器**自己**也要进（折叠是给容器加 class，不是给按钮）✓
    "float-resets",
    // ── ∞ 层：无限升级 ──
    "inf-upgrade-list", "inf-upgrade-count", "inf-income", "inf-elapsed",
    // ★ 2025：① 无限增幅置顶行（主按钮 + 买满按钮；形态与升级中心一致）
    "inf-ipdouble-row", "inf-btn-ipDouble", "inf-ipDouble-state", "inf-ipDouble-desc", "inf-ipDouble-cost",
    "btn-max-ipDouble", "max-ipDouble-n",
    "btn-save", "btn-export", "btn-reset",
];

export function cache() {
  const missing = [];
  for (const id of CACHE_IDS) {
    el[id] = wrapEl($(id));
    if (!el[id]) missing.push(id);
  }
  // ★ 防再犯：这里列出的 id 都必须在 index.html 里静态存在。
  //   少一个 -> render 里 `el["x"].textContent = ...` 会抛 TypeError
  //   -> 一旦没有 try/catch 包住，rAF 循环会**永久停住**（页面看着有内容但完全不动）。
  if (missing.length) {
    console.error(
      `[ui] 这些 id 在 index.html 里找不到：${missing.join(", ")}\n` +
      "     它们会在 render() 里抛 TypeError。请检查 index.html 是否漏了元素。",
    );
  }
}

export { el, $ };
