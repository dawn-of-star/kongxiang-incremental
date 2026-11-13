import { quantumToIPGain } from "./config.js";
import { buyVoidUpgrade } from "./engine.js";   // ★ 自动补（删铸币的连带损伤 ✓）
import { buyTrap } from "./engine.js";   // ★ 自动补（删铸币的连带损伤 ✓）
import { doClick } from "./engine.js";   // ★ 自动补（删铸币的连带损伤 ✓）
/**
 * main.js —— 装配 + 主循环
 *
 * 这一层只做三件事：
 *   1. 把 state / engine / ui / save 接起来
 *   2. 跑 requestAnimationFrame 循环
 *   3. 处理离线结算和自动存档
 *
 * 主循环用 requestAnimationFrame 而不是 setInterval：
 * SPEC §5.1 —— 推进靠「真实经过了多少秒」，不靠定时器精度。
 * 掉帧、切后台、断点调试都不会让产出失真。
 */

import { BASE, DE_MILESTONES, qOf, quantumZpeMultBonus, ETERNITY, eternityPointGain, tierMilestonesDone, COLLAPSE, crunchThreshold, CRUNCH_AT_LABEL,
  // ★★★ 2025（`docs/NEKO.md` §7）：好感度的**唯一写入点** + 窗口额度常量
  addNekoAffinity, NEKO, useNekoItem,
  // ★★★ 2025（`docs/NEKO.md` §6）：动作白名单的清单 + 限流上限
  NEKO_ACTIONS, NEKO_MAX_ACTIONS_PER_TICK,
  // ★ 2025：`has*` 探针要用的 id 表（**白名单不自己抄一份** ✓）
  REPEATABLE, VOID_UPGRADES, DE_UPGRADES, INFINITY_UPGRADES,
  // ★★★ 2025：离线时间上限的**唯一入口** —— 基础 4h + 「离线时长扩展」等级 × 1h ✓
  //   （原来这里直接读 `BASE.offlineCapSeconds`，两处各读一次 ⇒ 加了升级必然不一致 ✗）
  offlineCapSeconds } from "./config.js";
import {
  advance, breakInfinity, buyDeUpgrade, buyDeUpgradeMax, buyDreamUpgrade, buyInfinityUpgrade, buyIpDoubleMax, buyRepeatable, affordableCount, zpeEngineAffordable, tick,
  // ★★★ 2026：后台/休眠回来要补多少秒（纯函数，见 engine/tick.js）
  hiddenCatchUpSeconds,
  // ★★★ 2025：永恒升级「永恒增幅」（第三层设计稿 33~35 行）
  buyEpMult,
  // ★★ 2025 修复：这四个**被 handlers 调用却从未 import** ⇒ 每次点击都抛
  //   `ReferenceError: xxx is not defined`，表现就是「点了没反应」✗
  //   （用户报：「点大坍缩和购买 zpe 引擎目前无效」）
  //   根因：主循环侧的 import 不在任何自检的覆盖范围内 ——
  //     `node --check` 只查语法、查不出未定义标识符；而 `dom-smoke` 原来的
  //     `addEventListener` 是空函数 ⇒ 点了什么也不会发生，这类 bug **测不出来** ✗
  //   ⇒ 现在 dom-smoke 会真的派发 click（见那里的 `click()`）并断言状态变化 ✓
  doBigCrunch, doEternity, unlockZpeEngine, buyZpeEngineLevel,
  // ★★★ 2026：获取暗物质（消耗永恒点）
  buyDarkMatter } from "./engine.js";
// ★★★ 2025（`docs/NEKO.md` §5）：状态快照要**现算**速率与乘区 ——
//   必须走引擎/公式的**既有函数**（快照里绝不重算公式 ⇒ 不会与实发脱节 ✓）
import { entropyRate, matterRate, particleRate, globalMultiplierParts } from "./formulas.js";
import { clear as clearSave, createSaveEnvelope, load, save } from "./save.js";
import { newState, pushLog, serialize, setLogSink } from "./state.js";
// ★★★ 2025（`docs/NEKO.md`）：N.E.K.O 接入层（**无宿主时全部 no-op** ✓）
//   `dispatchNekoActions` = §6 动作白名单的派发器（三条约束都实现在 `neko.js` 里）
import { createNekoBridge, dispatchNekoActions, nekoHostPresent } from "./neko.js";
import { createChatUi } from "./neko/chat-ui.js";
import { mountCatPet, setCatPetEnabled, catPetEnabled } from "./neko/cat-pet.js";
// ★★★ 2025：**性能监视器**（用户报「数字跳动速率及其低下」⇒ 装仪表而不是猜）
import { perfFrame, perfOn, perfSummary, perfToggle, perfFrames, perfSections } from "./perf.js";
// ★★★ 2025：**真实 DOM 写入计数** + **构建标记**（区分"代码 bug"与"浏览器旧缓存"）
import { domWriteStats, domResetStats, UI_BUILD } from "./ui.js";
import { flashSave, initUI, render, showOfflineBanner, showToast } from "./ui.js";

const AUTOSAVE_SECONDS = 15;

// ══════════════════════════════════════════════════════════
// 启动
// ══════════════════════════════════════════════════════════

let state = newState();
let offlineReport = null;

const loaded = load();
if (loaded) {
  state = loaded.state;
  if (loaded.fallback) {
    // ★ 2026：主档损坏/校验失败时回退到上一轮安全存档，右上角告知玩家
    showToast("已加载上一轮安全存档", "warn");
  }
  if (loaded.corrupted) {
    // ★ 2026 存档完整性：校验失败时 save.js 已暂停写入 ⇒ 原档还在 localStorage 里。
    //   这里只提示，**不自动覆盖**；玩家确认要重开时点「重置」即可。
    pushLog(state, `⚠️ 存档完整性校验失败（${loaded.reason ?? "unknown"}）：原档已保留，自动存档暂停；如需重开请点重置`);
    showToast("存档损坏且没有可用备份：已新开，自动存档暂停（原档保留）", "error");
  } else {
    if (loaded.offlineSeconds > 5) {
      // ★★★ 2025：上限走**唯一入口** `offlineCapSeconds(state)` ✓
      //   它 = 基础 4 小时 + 已买的「离线时长扩展」等级 × 1 小时
      //   ⚠️ 原来这里**两处各自**读 `BASE.offlineCapSeconds` ⇒ 加了升级后
      //      "结算用的上限"与"提示是否被截断用的上限"会不一致 ✗
      //      （正是本项目反复出现的"同一件事两条路"）
      const cap = offlineCapSeconds(state);
      const capped = Math.min(loaded.offlineSeconds, cap);
      // ★★★ 2026 修 bug（「离线上限升级无效」）——
      //   `cap` 必须**显式传进去**：`advance` 的默认值是基础 4h，
      //   不传的话「离线时长扩展」升级会在这里被内层二次裁掉 ✗
      advance(state, capped, 5, cap);
      offlineReport = { seconds: capped, capped: loaded.offlineSeconds > cap, cap };
    }
    pushLog(state, loaded.legacy
      ? "检测到旧版存档，已按兼容路径读取（下次保存会写成新格式）"
      : "检测到历史存档，数据已恢复");
  }
}

// ══════════════════════════════════════════════════════════
// ★★★ 2025：N.E.K.O 接入层（`docs/NEKO.md`）—— **无宿主版本**
// ══════════════════════════════════════════════════════════
// 纪律（用户裁定「先做无宿主版本」）：**没有宿主时一切 no-op**，
//   游戏主流程一行都不因为它而改变 ✓
//   三件事：① 日志出口挂到桥上 ② 探测宿主并连接（连不上就静默）③ 定期推状态快照
// ⚠️ 顺序要紧：`nekoBridgeLastPhase` **必须先声明**（`onStatus` 闭包里会读写它，
//   而且 `connect()` 可能在造桥后**同步**触发一次 onStatus ⇒ 声明在后会 TDZ 报错 ✗）
let nekoBridgeLastPhase = null;
/**
 * ★★★ 2025（`docs/NEKO.md` §6）：动作派发用的**引擎函数集合**（注入给 `neko.js`）。
 *
 * ⚠️ 为什么用注入而不是让 `neko.js` 直接 import engine：
 *   ① `neko.js` 的定位是**零依赖接入层**（也避免循环依赖 ✗）
 *   ② 这样"白名单里有哪些动作"**一眼可见**（就在下面这张表里），
 *      而 id 合法性问 `has*` 探针（**不在这里抄 id 表** ⇒ 不会与 config 脱节）✓
 * ⚠️ 约束②（只走既有购买函数）：下面每一个 `fn` 都是 **engine 的导出**，零自写扣款 ✓
 */
const nekoActionApi = {
  maxPerTick: NEKO_MAX_ACTIONS_PER_TICK,
  hasRepeatable: (id) => id in REPEATABLE,
  hasVoid: (id) => id in VOID_UPGRADES,
  hasDe: (id) => id in DE_UPGRADES,
  hasInfinity: (id) => id in INFINITY_UPGRADES,
  buyRepeatable,
  buyVoidUpgrade,
  buyDeUpgrade,
  buyDeUpgradeMax,
  buyInfinityUpgrade,
  buyIpDoubleMax,
  buyEpMult,
  buyTrap,
  buyZpeEngineLevel,
  buyDarkMatter,
  doBigCrunch,
  doEternity,
};

const nekoBridge = createNekoBridge({
  getState: () => state,
  // ★ 她下发的动作要落到白名单派发器上 —— `api` 是引擎函数的注入集合（零自写扣款）
  actionApi: nekoActionApi,
  onStatus: (phase, detail) => {
    // 只在**状态真的变了**时写日志，避免每帧刷屏（宿主探测每帧都会跑）
    if (phase === nekoBridgeLastPhase) return;
    nekoBridgeLastPhase = phase;
    if (phase === "connected") {
      const caps = nekoBridge.capabilities;
      pushLog(state, `🐍 已接入 N.E.K.O 宿主（能力：${caps.join(", ") || "无"}）`);
    } else if (phase === "runtime-start-failed") {
      pushLog(state, `🐍 N.E.K.O runtime.start 失败：${detail?.message ?? String(detail)}`);
    } else if (phase === "snapshot-rejected") {
      pushLog(state, `🐍 快照被宿主拒绝（契约不符？）：${detail?.message ?? String(detail)}`);
    } else if (phase === "error") {
      pushLog(state, `🐍 N.E.K.O 接入错误：${detail?.message ?? String(detail)}`);
    }
  },
});
// ★ 游戏内聊天面板：只在**宿主页**里出现（独立打开时不留一块"未连接"的浮窗）
const nekoChatUi = nekoHostPresent()
  ? createChatUi({ bridge: nekoBridge, getState: () => state })
  : null;

/**
 * ★ 猫猫漫游：复用 N.E.K.O 的猫资源（GIF）在游戏页里自己走。
 *   只在宿主页里挂（资源由宿主 /static 提供）；失败不影响游戏。
 */
let nekoCatPet = null;
function startCatPet() {
  void mountCatPet().then((pet) => {
    nekoCatPet = pet.ok ? pet : null;
    if (pet.ok) pushLog(state, "🐾 猫猫漫游已开启（拖一下 / 点一下试试）");
    else if (pet.reason && pet.reason !== "disabled") pushLog(state, `🐾 猫猫不可用：${pet.reason}`);
  }).catch(() => { /* 猫挂了也不影响游戏 */ });
}
if (nekoChatUi) startCatPet();
// ★ 页面关闭：显式结束宿主路由（否则只能等 10 秒心跳超时，模型会悬在游戏态）
const endHostRoute = () => { try { void nekoBridge.end(); } catch { /* ignore */ } };
window.addEventListener('pagehide', endHostRoute);
window.addEventListener('beforeunload', endHostRoute);

// ① 把**全部** `pushLog` 自动导向宿主（无宿主 ⇒ 桥内部直接丢弃 ✓）
setLogSink((entry) => nekoBridge.sendLog(entry));
// ② 探测（不阻塞：失败就是"没有宿主"，正常单机玩）
nekoBridge.connect();
// ③ 快照节流推送（无宿主 ⇒ no-op；有宿主 ⇒ 每 5 秒一份）
let nekoSnapshotAccum = 0;
const NEKO_SNAPSHOT_SECONDS = 5;

// ══════════════════════════════════════════════════════════
// 动作
// ══════════════════════════════════════════════════════════

function afterAction() {
  render(state);
}

/** 上一次"存档失败"写进日志的时间（自动路径限流用） */
let lastSaveFailLogAt = 0;

/**
 * ★★★ 2026 修 bug（「保存失败仍闪已保存 ✓」）——
 * 存档失败时**用既有的 `pushLog` 日志面板**提示（不新造 toast 系统）。
 *
 * `save()` 内部已经 `console.warn` 了技术细节（隐私模式 / 配额 / setItem 抛异常），
 * 这里负责让**玩家**也看得见 —— 否则表现就是"点了保存、闪了绿字、刷新却回到旧档"✗
 *
 * @param {string} via 触发路径（手动 / 自动 / 切到后台），写进日志方便排查
 * @param {boolean} [throttled=false] 自动路径限流：同一条失败最多每分钟一条，
 *   免得 localStorage 长期不可用时每 15 秒刷屏、把真正的事件冲出日志面板
 */
function warnSaveFailed(via, throttled = false) {
  const now = Date.now();
  if (throttled && now - lastSaveFailLogAt < 60_000) return;
  lastSaveFailLogAt = now;
  pushLog(state, `⚠️ 存档失败（${via}）：浏览器拒绝写入本地存储，进度还只在内存里；请检查隐私模式 / 存储配额`);
  showToast("存档失败：已保留上一轮安全存档（本次进度仅在内存里）", "error");
}

const handlers = {
  onClick() {
    doClick(state);
    afterAction();
  },
  /** @param {boolean} max 是否一次买满（闭式解） */
  onBuyRepeatable(id, max) {
    buyRepeatable(state, id, !!max);
    afterAction();
  },
  /** ★ 2025：① 无限增幅「买满」（分段闭式；与升级中心的买满同一套路） */
  onBuyIpDoubleMax() {
    if (buyIpDoubleMax(state) > 0) {
      save(state);
      afterAction();
    }
  },
  /**
   * ★★★ 2025 新实现（第三层设计稿 33~35 行）：永恒升级「永恒增幅」。
   * @param {boolean} max true = 买满（闭式反解），false = 买一级
   */
  onBuyEpMult(max) {
    if (buyEpMult(state, max === true ? null : 1) > 0) {
      save(state);
      afterAction();
    }
  },
  /**
   * ★★★ 2026（用户 2026 重写的规则）：**获取暗物质**（消耗永恒点）。
   *
   * 落点是暗能量倍率的加法区（`darkEnergyMultiplier` 里的 `darkMatterAdditiveTerm`）——
   * 所以这里只负责买 + 存档 + 重绘；**效果由引擎侧同一函数给出**（显示 == 实发）✓
   * @param {boolean} max true = 买满（逐级真价之和），false = 买一个
   */
  onBuyDarkMatter(max) {
    if (buyDarkMatter(state, max === true ? null : 1) > 0) {
      save(state);
      afterAction();
    }
  },
  /**
   * ★★★ 2025（`docs/NEKO.md` §10）：**使用一个好感度道具**（猫条 / 棒棒糖 / 猫爪）。
   *
   * 走 `useNekoItem`（**唯一入口**）—— 扣款与好感度写入都在那里，这里只负责存档+重绘 ✓
   * ⚠️ 它取代了原来的 `onNekoTest`（那对 ±8 调试按钮）——
   *   道具实装后调试按钮已删除（它们是"没有道具时的可见性补丁"）✓
   */
  onUseNekoItem(id) {
    const r = useNekoItem(state, id);
    if (r.ok) {
      pushLog(state, `🐍 用了「${id}」，好感度 +${r.gain}（现 ${Number(state.nekoAffinity)}）`);
      save(state);
      afterAction();
    } else if (r.reason) {
      pushLog(state, `🐍 用不了「${id}」：${r.reason}`);
      afterAction();
    }
  },
  /** @param {boolean} max 右键或买满 */
  onBuyTrap(max) {
    buyTrap(state, max === true);
    afterAction();
  },
  onBuyVoid(id) {
    if (buyVoidUpgrade(state, id)) save(state);
    afterAction();
  },
  /** @param {boolean} max 连续购买直到买不起 */
  onBuyDe(id, max) {
    if (max) {
      // ★★★ 2026 修 bug（用户：「买满按钮不买满又怎么回事？」）——
      //   原来这里是 `while (n < 500 && buyDeUpgrade(...)) n++`：**硬上限 500 级**，
      //   而单买一次只 +1 级 ⇒ 真正可买 1663 级时也只买 500 ✗
      //   ⇒ 改用 `buyDeUpgradeMax`（只由"买得起吗"决定，20000 只是安全阀）✓
      const n = buyDeUpgradeMax(state, id);
      if (n > 0) save(state);
    } else if (buyDeUpgrade(state, id)) {
      save(state);
    }
    afterAction();
  },
  onUnlockTransmuter() {
    const gate = DE_MILESTONES.find((m) => m.id === "dm0")?.gate;
    if (!gate) return;
    const hasVoidOk = !gate.voidUpgrade || state.voidUpgrades[gate.voidUpgrade];
    const matterOk = !gate.matter || state.resources.matter.gte(gate.matter);
    if (!hasVoidOk || !matterOk) return;
    // 复刻原稿的手动按钮：解锁 + 记 dm0
    state.deMilestones.dm0 = true;
    state.phaseTransmuterUnlocked = true;
    pushLog(state, "🌌 相变仪已解锁！暗能量工程开始运作");
    save(state);
    afterAction();
  },

  // ── 第四层：量子 / 大坍缩 ──
  // ★ `onCollapse` 已删除 —— 「临界坍缩」体系整个移除（暗物质不应存在）。
  //   第三层现在是**量子涨落**：ZPE 到门槛自动捕获，不需要按钮。
  /** 大坍缩：打破无限后**手动**触发；未打破时由 tick 强制触发 */
  onBigCrunch() {
    if (!state.brokenInfinity) return;
    if (doBigCrunch(state)) {
      save(state);
      afterAction();
    }
  },
  onBreakInfinity() {
    if (breakInfinity(state)) {
      save(state);
      afterAction();
    }
  },
  onBuyDream(id) {
    if (buyDreamUpgrade(state, id)) {
      save(state);
      afterAction();
    }
  },
  /** @param {string} id 无限升级 id（∞ 层，用无限点购买） */
  onBuyInfinity(id) {
    if (buyInfinityUpgrade(state, id).ok) {
      save(state);
      afterAction();
    }
  },
  /** 永恒：手动触发（门槛 = 无限点 1e308.25，见 `ETERNITY.goalLog10`） */
  onEternity() {
    if (doEternity(state)) {
      save(state);
      afterAction();
      // ★★★ 2026-10-22（用户裁定："直接用最笨的办法吧（刷新一次网页）"）——
      //   永恒后**主动刷新一次** ✓
      //   背景：永恒后的内存状态会进入一种"物质不涨"的异常态（本地复算系数健康、
      //   刷新后读档就恢复正常 ⇒ 判定为**运行时状态污染** ✗，短期定位不到写入者 ✗）
      //   用户要求先用最笨但可靠的办法：永恒结束 ⇒ 存档 ⇒ 重载页面 ✓
      //   ⚠️ 重载会走**离线结算**（`advance`），间隔只有几百毫秒 ⇒ 影响可忽略 ✓
      try { save(state); } catch { /* 存不上也要刷新 ✗ 否则丢档 */ }
      setTimeout(() => { try { location.reload(); } catch { /* 非浏览器环境 */ } }, 60);
    }
  },
  /** ZPE 引擎：解锁（条件 = **1 次大坍缩**，里程碑奖励、不花无限点、送 1 级） */
  onUnlockZpeEngine() {
    if (unlockZpeEngine(state)) {
      save(state);
      afterAction();
    }
  },
  /** ZPE 引擎：买等级（max = 买满） */
  onBuyZpeEngine(max) {
    if (buyZpeEngineLevel(state, max) > 0) {
      save(state);
      afterAction();
    }
  },
  onSave() {
    // ★★★ 2026 修 bug：`save()` 返回 0 = 没写成功（暂停写入 / setItem 抛异常）。
    //   原来无条件 `flashSave()` ⇒ 失败也闪「已保存 ✓」，玩家以为存上了 ✗
    const bytes = save(state);
    if (bytes > 0) {
      flashSave();
      return;
    }
    warnSaveFailed("手动存档");
    afterAction();          // 让失败日志立刻出现在日志面板里
  },
  onExport() {
    // ★ 2026（用户裁定）：导出**当前内存里的状态**，不再“先 save 再读 localStorage”。
    //   原来写失败会导出上一次成功存档（可能是旧档），且刚开局还没存过档时会导出空对象 ✗
    let json = "";
    try {
      const payload = serialize(state);
      payload.lastSavedAt = Date.now();
      json = JSON.stringify(createSaveEnvelope(payload));
    } catch (err) {
      pushLog(state, `⚠️ 导出失败：${err?.message ?? err}`);
      afterAction();
      return;
    }
    navigator.clipboard?.writeText(json).then(
      () => pushLog(state, "📋 存档已复制到剪贴板"),
      () => pushLog(state, "⚠️ 复制失败，请手动从控制台取 window.__game.export()"),
    );
    afterAction();
  },
  onReset() {
    if (!confirm("确定要重置宇宙吗？所有进度都会消失。")) return;
    clearSave();
    state = newState();
    pushLog(state, "☢️ 宇宙已重置");
    afterAction();
  } };

// ══════════════════════════════════════════════════════════
// 主循环
// ══════════════════════════════════════════════════════════

let lastFrame = performance.now();
let lastRender = 0;
/** ★ 2025：上一帧的**真实**时间戳（与节流的 lastRender 不同 —— 它每帧都更新） */
let lastFrameReal = 0;
/**
 * ★★★ 2026：页面进入 hidden 的时间戳（0 = 当前不在后台）。
 * 记的是 `Date.now()`（墙钟）而不是 `performance.now()` ——
 * 电脑休眠/跨天时墙钟一定往前走，性能计时器在部分平台上会漏掉休眠时间。
 * ⚠️ 初始值也判一次：**在后台标签页里打开游戏**时不会收到 hidden 事件，
 *   不预置时间戳的话，切到前台那一刻的这段时长会被整个吞掉 ✗
 */
let hiddenAtMs = typeof document !== "undefined" && document.visibilityState === "hidden"
  ? Date.now()
  : 0;
let autosaveAccum = 0;
let errorCount = 0;
let lastErrorKey = "";
let lastErrorAt = 0;

/**
 * 报错但**不停机**。
 *
 * ⚠️ 这是硬性要求，不是可选项。
 * 如果 render() 抛异常而没被捕获，`requestAnimationFrame(frame)` 那一行
 * 永远不会执行 —— 循环就永久停住了，页面看着有内容但完全不动。
 * （真实踩过的坑：ui.js 里写了一个已经被删掉的 id，第一帧就抛 TypeError。）
 */
function reportRuntimeError(err, phase) {
  const key = `${phase}:${err?.message ?? err}`;
  const now = performance.now();
  // 同一种错误 3 秒内只报一次，避免刷屏
  if (key === lastErrorKey && now - lastErrorAt < 3000) return;
  lastErrorKey = key;
  lastErrorAt = now;
  errorCount++;

  console.error(`[${phase}] 第 ${errorCount} 次异常：`, err);

  const box = document.getElementById("fatal");
  if (box) {
    box.style.display = "block";
    box.textContent =
      `运行时异常（${phase}）：\n${err?.stack ?? err}\n\n` +
      `游戏循环**仍在运行**，但这个错误会反复出现。\n` +
      `累计 ${errorCount} 次。把上面这段发给我就能定位。`;
  }
}

// ══════════════════════════════════════════════════════════
// 主循环
// ══════════════════════════════════════════════════════════

/**
 * 渲染节流。
 *
 * 逻辑按 rAF 跑（约 60fps），但 **DOM 不跟着跑** —— 一个增量游戏里
 * 绝大多数数字每秒才变一次，60fps 重写 79 个元素纯属浪费。
 * 20fps 肉眼看不出差别，但 DOM 写入量降到 1/3。
 */
const RENDER_INTERVAL_MS = 50;

function frame(nowMs) {
  // ★ 2026：隐藏期间**不计帧** —— 后台 rAF 若仍以 1fps 跑，这里每帧记 1 秒，
  //   回前台再按整段 gap 补一次 ⇒ 同一段时间被计两遍（双计）✗
  //   隐藏时间统一交给 visibilitychange 的 catch-up，只补一次。
  if (document.visibilityState === "hidden") {
    lastFrame = nowMs;
    lastFrameReal = nowMs;
    requestAnimationFrame(frame);
    return;
  }
  // 帧间隔上限 1 秒：标签页切后台回来时不要一次性补太多
  const dt = Math.min((nowMs - lastFrame) / 1000, 1);
  const frameGap = nowMs - lastFrameReal;      // ★ 真实帧间隔（性能监视器用）
  lastFrameReal = nowMs;
  lastFrame = nowMs;

  let tickMs = 0, renderMs = 0;

  if (dt > 0) {
    const t0 = performance.now();
    try {
      tick(state, dt);
      state.playTimeMs += dt * 1000;
    } catch (err) {
      reportRuntimeError(err, "tick");
    }
    tickMs = performance.now() - t0;

    autosaveAccum += dt;
    if (autosaveAccum >= AUTOSAVE_SECONDS) {
      autosaveAccum = 0;
      try {
        // ★ 自动存档失败也要留痕（限流），绝不静默当成功
        if (save(state) === 0) warnSaveFailed("自动存档", true);
      } catch { /* 存档失败不该影响游戏 */ }
    }

    // ★ ③ 状态快照：节流推给宿主（**无宿主时是 no-op** ✓）
    //   节奏与存档同族（都按秒累计）⇒ 不引入新的时间源 ✓
    nekoSnapshotAccum += dt;
    if (nekoSnapshotAccum >= NEKO_SNAPSHOT_SECONDS) {
      nekoSnapshotAccum = 0;
      try {
        // 速率/乘区/档位里程碑由**引擎既有函数**现算后注入 ⇒ 快照不重算公式 ✓
        state.__nekoRates = {
          entropy: entropyRate(state),
          particle: particleRate(state),
          matter: matterRate(state),
        };
        state.__nekoMultipliers = globalMultiplierParts(state);
        state.__nekoTierMilestones = tierMilestonesDone(state).map((m) => m.id ?? m.at);
        nekoBridge.publishSnapshot();
      } catch { /* 快照失败不影响游戏 */ }
      // ★ 关键重置节点（第 1–3 次大坍缩 / 首次永恒 / 七巧板解锁 / 首次打破无限）
      //   到点时**主动**问她一次（自带 ≤600 字符的紧凑上下文 + 冷却）。
      //   放在快照同一拍里：只在有宿主时才可能触发，且天然 5 秒一次的检查频率足够。
      try { nekoBridge.maybeAskReset(state); } catch { /* 问话失败不影响游戏 */ }
    }
  }

  // ── 节流渲染 ──
  if (nowMs - lastRender >= RENDER_INTERVAL_MS) {
    lastRender = nowMs;
    const t0 = performance.now();
    // ★ 每帧把写入计数清零 —— HUD 显示的就是"**上一帧**真实碰了几次 DOM" ✓
    if (perfOn()) domResetStats();
    try {
      render(state);
    } catch (err) {
      reportRuntimeError(err, "render");
    }
    renderMs = performance.now() - t0;
  }

  // ★ 性能监视器：关闭时 `perfFrame` 立刻返回 ⇒ 开销 ≈ 0 ✓
  perfFrame({ frameMs: frameGap, dtMs: dt * 1000, tickMs, renderMs });
  if (perfOn()) perfDraw();

  // ★ 这一行必须在 try 之外，否则异常会让循环停住
  requestAnimationFrame(frame);
}

/**
 * ★★★ 2025：性能监视器的**绘制**（右上角一块小面板；只在打开时跑）。
 *
 * ⚠️⚠️ 原来"每 20 帧才更新一次文字"—— 那个想法在 **6fps** 下是**灾难性的误导**：
 *   20 帧 = **3 秒** ⇒ 用户截图时看到的可能是好几秒前的旧文本，
 *   于是"我加的行没出现"被误判成"跑的是旧代码" ✗（我为此浪费了好几轮）
 * ⇒ 改成**每帧都刷**（1 个元素的 textContent，代价可忽略；
 *   而且它已经在 `perfOn()` 分支里 ⇒ 关掉监视器时完全不跑）✓
 */
function perfDraw() {
  const el = document.getElementById("perf-hud");
  if (!el) return;
  el.hidden = false;
  const s = perfSummary();
  if (!s) { el.textContent = "性能监视（采样中…）"; return; }
  const f = (v) => v.toFixed(1);
  // ★★★ 2025：**分段表 + 真实写入数 + 构建标记** ——
  //   用户连续两轮 FAQ"HUD 没变" ⇒ 无法区分"代码 bug"与"浏览器旧缓存" ✗
  //   ⇒ 把构建标记打在 HUD 上，一眼可辨 ✓
  const secs = perfSections();
  const secTxt = secs.length
    ? "\n── render 分段（累计 / max）──\n" +
      secs.slice(0, 7).map((r) => `${r.label}  ${r.ms.toFixed(0)}ms / ${r.max.toFixed(0)}ms`).join("\n")
    : "\n（分段表为空 —— 说明跑的**不是**最新 ui.js）";
  el.textContent =
    `[${UI_BUILD}]\n` +
    `FPS ${f(s.fps)}（间隔 ${f(s.frameAvg)}ms，p95 ${f(s.frameP95)}ms）\n` +
    `tick ${f(s.tickAvg)}ms（max ${f(s.tickMax)}）\n` +
    `render ${f(s.renderAvg)}ms（p95 ${f(s.renderP95)}，max ${f(s.renderMax)}）\n` +
    `我们的占用 ${f(s.busyAvg)}ms/帧\n` +
    `真实 DOM 写入 ${domWriteStats.text + domWriteStats.html + domWriteStats.cls + domWriteStats.bool}` +
    `（text ${domWriteStats.text} / html ${domWriteStats.html} / cls ${domWriteStats.cls} / bool ${domWriteStats.bool}）\n` +
    `被去重拦掉 ${domWriteStats.skipped}\n` +
    (s.browserSide
      ? "⇒ 瓶颈在**浏览器侧**（样式重算/布局/绘制）"
      : "⇒ 瓶颈在**我们的 JS**（tick/render）") +
    `\n样本 ${s.n} 帧` +
    secTxt;
}

// ══════════════════════════════════════════════════════════
// 起跑
// ══════════════════════════════════════════════════════════

initUI(handlers);

// 首次渲染也要防：它抛异常的话整个模块就挂了，画面完全不动
try {
  render(state);
} catch (err) {
  reportRuntimeError(err, "首次渲染");
}

requestAnimationFrame(frame);

if (offlineReport) showOfflineBanner(offlineReport.seconds, offlineReport.capped, offlineReport.cap);

window.addEventListener("beforeunload", () => { save(state); });

/**
 * ★★★ 2026 修 bug（用户：「切后台 / 休眠回来只算了 1 秒」）——
 *
 * 病根：标签页进后台后浏览器**停掉 rAF**，而主循环的 `dt` 硬顶 1 秒
 * （那是防卡顿的，**不能**在 rAF 里取消 ✗）⇒ hidden 的整段时间没推进。
 * 原来 visible 时也什么都不做，只 save，于是 10 分钟只算到 1 秒级别 ✗
 *
 * 修法：hidden 时**立刻**记时间戳；可见时按这段 gap 补一次 `advance`，
 * 上限走离线 cap（与读档离线结算同一条入口），补完**重置帧锚点**，
 * 避免下一帧 rAF 再把同一段 gap 算一次（否则会双计 1 秒）✗
 */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    // ① 先记时间戳 —— 不能等 visible 再取，那时 gap 已经量不到了
    hiddenAtMs = Date.now();
    if (save(state) === 0) warnSaveFailed("切到后台", true);
    return;
  }
  // ② 回到前台：按 hidden 时长补一次
  const gapMs = hiddenAtMs > 0 ? Date.now() - hiddenAtMs : 0;
  hiddenAtMs = 0;
  if (gapMs <= 0) return;
  const cap = offlineCapSeconds(state);
  const catchUp = hiddenCatchUpSeconds(gapMs, cap);
  // gap < 1 秒 ⇒ 不补（下一帧 rAF 的 1 秒上限已经覆盖这一小段，不必也不该双计）
  if (catchUp <= 0) return;
  try {
    advance(state, catchUp, 5, cap);
  } catch (err) {
    // 补时抛异常不该让页面停摆（主循环仍在跑）；照常报错但继续
    reportRuntimeError(err, "后台补时");
  } finally {
    // ③ 补完重置帧锚点：否则下一帧 rAF 会按 (nowMs - lastFrame) 再算一次 ✗
    lastFrame = performance.now();
    lastFrameReal = lastFrame;
  }
});

/**
 * ★★★ 2025：`F8` = 性能监视器开关（用户在 Edge 上跑，`performance.now()` 通用 ✓）
 * ⚠️ 用 `F8` 而不是 `F12`（那是开发者工具，浏览器会吃掉）；也不与游戏内的空格冲突 ✓
 */
document.addEventListener("keydown", (e) => {
  if (e.code === "F8") {
    e.preventDefault();
    const on = perfToggle();
    const hud = document.getElementById("perf-hud");
    if (hud) hud.hidden = !on;
  }
});

// 控制台调试入口
window.__game = {
  get state() { return state; },
  tick, advance, doClick,
  buyRepeatable, buyTrap, buyVoidUpgrade, buyDeUpgrade, buyDreamUpgrade, buyInfinityUpgrade,
  save: () => save(state),
  // ★ 返回的是**存档 JSON 原文**（可直接粘贴）。
  //   原来写的是 JSON.stringify(localStorage.getItem(...)) —— 那是把 JSON
  //   再包一层引号（双重编码），控制台里复制出来根本没法用。
  export: () => { save(state); return localStorage.getItem(BASE.saveKey) ?? ""; },
  reset: () => { clearSave(); state = newState(); render(state); },
  /**
   * ★★★ 2025（`docs/NEKO.md` §6）：**动作白名单的手动验证入口**。
   *
   * 为什么需要它：`controls.on` 那条路要**有宿主**才会触发，而我们现在是纯单机
   *   ⇒ 派发器写完**无法验证** ⇒ 就会变成"写了但没人知道对不对"✗
   *   （用户原则：「没有 ui 真的很容易误判」的同族问题：**没有调用方 = 无法验证**）
   * ⇒ 在控制台里可以手动喂一批动作，与宿主下发**走完全同一条路** ✓
   *   用法：`__game.nekoActions([{type:"buyRepeatable",payload:{id:"m1",max:true}}])`
   */
  nekoActions: (batch) => {
    const r = dispatchNekoActions(state, batch, nekoActionApi);
    render(state);
    return r;
  },
  /**
   * ★★★ 2026-11-13（`setAuto` 实装后配套的**玩家授权**入口）——
   *
   * 猫娘不能自己开门 ✓：`setAuto` 要求 `state.nekoAutoGrants[id] === true`，
   * 而**只有这个函数会写那个字段** ✓（玩家的动作 ✓）
   *
   * 用法：
   *   `__game.nekoGrant("autoIpDouble", true)`   只授权一条
   *   `__game.nekoGrant(null, true)`             授权**全部**已知自动化
   *   `__game.nekoGrant(null, false)`            全部收回（并关掉猫娘已开的 ✓）
   */
  nekoGrant: (id, on = true) => {
    state.nekoAutoGrants ??= {};
    state.nekoAuto ??= {};
    if (id) {
      if (on) state.nekoAutoGrants[String(id)] = true;
      else { delete state.nekoAutoGrants[String(id)]; delete state.nekoAuto[String(id)]; }
      render(state);
      return { granted: 1, on: !!on };
    }
    // 全部：用一个通配授权（不依赖 id 清单 ⇒ 猫娘后续新增的自动化也能覆盖 ✓）
    if (on) state.nekoAutoGrants.__all = true;
    else { state.nekoAutoGrants = {}; state.nekoAuto = {}; }
    render(state);
    return { granted: on ? "all" : 0, on: !!on };
  },
  /** 白名单清单（给控制台/文档看） */
  nekoActionList: () => Object.keys(NEKO_ACTIONS),
  /**
   * ★ SDK 握手状态（给端到端测试 / 控制台排查用）。
   * 返回的是**只读快照**（桥内部每次 status 都复制一份），不含 client 引用。
   */
  nekoStatus: () => nekoBridge.status,
  /** 主动请她看一眼（会起一个 LLM turn；没有 dialogue 能力时返回 null） */
  nekoAsk: (prompt) => nekoBridge.requestAssist(prompt),
  /** 游戏内聊天（走聊天面板同一条路：台词 + 可选 control + 语音） */
  nekoChat: (text) => (nekoChatUi ? nekoChatUi.send(text) : Promise.resolve(false)),
  /** 触发一次主动搭话（测试用；正常由 60 秒定时器触发） */
  nekoProactive: (force = true) => (nekoChatUi ? nekoChatUi.proactive(force) : Promise.resolve(false)),
  /** 猫猫漫游：只读状态（给控制台 / e2e 看） */
  nekoCatPet: () => (nekoCatPet ? nekoCatPet.state?.() : null),
  /** 猫猫漫游开关：`__game.nekoCatPetToggle(false)` 关掉，`true` 打开 */
  nekoCatPetToggle: (on) => {
    const enabled = on !== false;
    setCatPetEnabled(enabled);
    if (!enabled) {
      nekoCatPet?.dispose?.();
      nekoCatPet = null;
    } else if (!nekoCatPet) {
      startCatPet();
    }
    return enabled;
  },
  /** ★ 2025：**性能监视器**（`__game.perf(true)` 打开 / `__game.perf()` 切换 / `F8`） */
  perf: (force) => {
    const on = perfToggle(force);
    const hud = document.getElementById("perf-hud");
    if (hud) hud.hidden = !on;      // 关掉时立刻藏起来（否则留着最后一帧的数字）
    return on;
  },
  perfSummary,
  perfFrames,
};

console.log(
  // 版本号由 index.html 的内联脚本从 package.json 读出后广播到 window（见那里的注释）。
  // 它是异步取的，极端情况下可能还没到 —— 那就退化成不带版本号的横幅，不影响调试。
  `%c[空想增量${window.__APP_VERSION ? " v" + window.__APP_VERSION : ""}]%c 控制台可用 window.__game 调试（.state / .advance(秒) / .reset()）`,
  "color:#2fa6f7;font-weight:bold", "color:#757575",
);