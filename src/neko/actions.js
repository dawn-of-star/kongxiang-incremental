/**
 * neko/actions.js —— 猫娘动作白名单与派发器
 *
 * ★ 2026 模块化：由 907 行的 neko.js 按职责拆出（声明与注释逐字保留）。
 *    对外统一从 `src/neko.js`（barrel）导入。
 */


export function dispatchNekoActions(state, actions, api) {
  const out = { applied: 0, results: [], throttled: 0 };
  const list = Array.isArray(actions) ? actions : [];
  const cap = api?.maxPerTick ?? 8;
  if (list.length > cap) out.throttled = list.length - cap;

  for (const a of list.slice(0, cap)) {
    const type = String(a?.type ?? "");
    const p = a?.payload ?? {};
    const spec = NEKO_ACTION_SPECS[type];

    // ── 未知动作：**不抛**，报 unknown_action（对面是 LLM，会发奇怪的东西）──
    if (!spec) {
      out.results.push({ type, status: "unknown_action" });
      continue;
    }
    // ── ① 阶段白名单 ──
    if (!evalGuard(spec, state, p, api)) {
      out.results.push({ type, status: "rejected", reason: spec.guardWhy });
      continue;
    }
    // ── ② 只走既有购买函数 ──
    let ok = false, detail = null;
    try {
      const r = spec.fn(state, p, api);
      // ★ 引擎的返回约定**不统一**（实测）：
      //    · buyRepeatable / buyTrap      → 返回买到的**等级数**（0 = 失败）
      //    · buyVoidUpgrade / buyDeUpgrade → 返回 boolean
      //    · buyInfinityUpgrade            → 返回 { ok: boolean }
      //    · doBigCrunch / doEternity      → 返回非 null 对象
      //   ⚠️ 旧实现只认 `true` / `{ok:true}` ⇒ **买成功了也报 rejected**，
      //      于是猫娘会误以为失败并反复重试（实测：particleBoost 买到却被判失败）。
      if (r === true) {
        ok = true;
      } else if (typeof r === "number") {
        ok = r > 0;
        if (!ok) detail = "买不起或条件不满足（引擎返回 0）";
      } else if (r !== null && typeof r === "object") {
        ok = r.ok === true;
        detail = r.reason ?? null;
      }
    } catch (err) {
      ok = false;
      detail = err?.message ?? String(err);
    }
    if (ok) out.applied++;
    out.results.push({ type, status: ok ? "ok" : "rejected", reason: ok ? null : detail });
  }
  return out;
}

/**
 * 白名单的**唯一实现**（动作名 → 守卫 + 引擎函数）。
 *
 * ⚠️ `api` 由调用方注入（见 `main.js`），**不在这里 import engine** ——
 *   否则 `neko.js` 就有了依赖，而它的定位是"零依赖的接入层"（也避免循环依赖）✓
 * ⚠️ `guard` 一律"保守"：判据不清楚时**拒绝**（宁可少做，不可越界）✓
 */
const NEKO_ACTION_SPECS = {
  buyRepeatable: {
    // ⚠️ id 合法性**问注入的 api**（不在这里抄一份 id 表 —— 抄了就会与 config 脱节 ✗）
    guard: (s, p, api) => typeof p?.id === "string" && api?.hasRepeatable?.(p.id) === true,
    guardWhy: "缺少或未知的升级 id",
    fn: (s, p, api) => api.buyRepeatable(s, p.id, p.max === true),
  },
  buyVoidUpgrade: {
    guard: (s, p, api) => typeof p?.id === "string" && api?.hasVoid?.(p.id) === true,
    guardWhy: "缺少或未知的虚空升级 id",
    fn: (s, p, api) => api.buyVoidUpgrade(s, p.id),
  },
  buyDeUpgrade: {
    guard: (s, p, api) => typeof p?.id === "string" && api?.hasDe?.(p.id) === true,
    guardWhy: "缺少或未知的暗能量升级 id",
    // max 走专门的批量接口（buyDeUpgrade 本身不吃 max 参数）
    fn: (s, p, api) => (p.max === true && typeof api.buyDeUpgradeMax === "function"
      ? api.buyDeUpgradeMax(s, p.id)
      : api.buyDeUpgrade(s, p.id, p.max === true)),
  },
  // ── 其余升级：全部开放给指令（梦想升级不在此列）──
  buyTrap: {
    guard: (s, p, api) => typeof api?.buyTrap === "function",
    guardWhy: "宿主未提供陷阱升级接口",
    fn: (s, p, api) => api.buyTrap(s, p.max === true),
  },
  buyDarkMatter: {
    guard: (s, p, api) => typeof api?.buyDarkMatter === "function",
    guardWhy: "宿主未提供暗物质购买接口",
    fn: (s, p, api) => api.buyDarkMatter(s, typeof p.k === "number" ? p.k : null),
  },
  buyIpDoubleMax: {
    guard: (s, p, api) => typeof api?.buyIpDoubleMax === "function",
    guardWhy: "宿主未提供 IP 倍增接口",
    fn: (s, p, api) => api.buyIpDoubleMax(s),
  },
  buyEpMult: {
    guard: (s, p, api) => typeof api?.buyEpMult === "function",
    guardWhy: "宿主未提供 EP 倍率接口",
    fn: (s, p, api) => api.buyEpMult(s, typeof p.k === "number" ? p.k : null),
  },
  buyZpeEngineLevel: {
    guard: (s, p, api) => typeof api?.buyZpeEngineLevel === "function",
    guardWhy: "宿主未提供 ZPE 引擎升级接口",
    fn: (s, p, api) => api.buyZpeEngineLevel(s, p.max === true),
  },
  // ★ ① 无限增幅走它（`ipDouble`）；**未打破无限也能买**（见 K 段 bug #10）
  buyInfinityUpgrade: {
    guard: (s, p, api) => typeof p?.id === "string" && api?.hasInfinity?.(p.id) === true,
    guardWhy: "缺少或未知的无限升级 id",
    fn: (s, p, api) => api.buyInfinityUpgrade(s, p.id).ok === true,
  },
  // ★ 大坍缩：**必须已经打破无限**（打破前是硬顶强制触发，不该由猫娘代按）
  doBigCrunch: {
    guard: (s) => s?.brokenInfinity === true,
    guardWhy: "未打破无限（大坍缩是自动触发的，不该由猫娘代按）",
    fn: (s, p, api) => api.doBigCrunch(s) != null,
  },
  // ★ 永恒：门槛由 `canEternity` 自己判（这里只挡"没到过无限层"）
  doEternity: {
    guard: (s) => s?.brokenInfinity === true,
    guardWhy: "未打破无限（还没到过 ∞ 层）",
    fn: (s, p, api) => api.doEternity(s) != null,
  },
  /**
   * ★ **猫娘的自动化通道**（§6 末尾：不消耗梦想点、不占玩家已买槽位）。
   *
   * ⚠️ 本层**只登记契约、不做实现**，原因有二：
   *   ① 自动化在游戏内的实现是 `isAutoAcquire`（由 `v9` / `m2` / `m5` 推导）
   *      与梦想升级 `autoBuyDe` —— **都有各自的解锁前提**，
   *      猫娘"绕过前提"是**越界**（§6 约束①）⇒ 需要一个**玩家可授予**的开关，
   *      而那是 Neko 页面上还没做的 UI（等 SDK 接入后一起定）
   *   ② 现在硬做，就得在引擎里加一条"猫娘专用自动化"分支 ——
   *      正好是 §6 约束② 想避免的"自己写一套"✗
   * ⇒ 先返回 `rejected` 并**写清原因**（而不是假装成功）✓
   */
  setAuto: {
    guard: () => false,
    guardWhy: "尚未实装（需要玩家可授予的授权开关；见 TODO P9）",
    fn: () => false,
  },
};

/** `guard(state, payload, api)` 的统一调用点（`dispatchNekoActions` 里传 api） */
function evalGuard(spec, state, payload, api) {
  try { return spec.guard(state, payload, api) === true; } catch { return false; }
}


// ══════════════════════════════════════════════════════════
// 宿主桥（**无宿主时全部优雅降级**）
// ══════════════════════════════════════════════════════════

/**
 * 页面里有没有"宿主启动配置"。
 *
 * 判据来自 SDK 源码（`neko-minigame-same-origin-bootstrap.js`）：
 *   宿主模板必须在加载 bootstrap 前吐出一个 `<script id="neko-minigame-host-launch">`（JSON），
 *   bootstrap 会**同步吃掉并删掉**这个节点 ⇒ 所以**它此刻还在**就说明宿主刚启动 ✓
 * ⚠️ 不能只看 `window.lanlan_config` —— 那是**旧式集成**（soccer/badminton 用的），
 *   跟我们这条 SDK 路线不是一回事 ✗
 */
