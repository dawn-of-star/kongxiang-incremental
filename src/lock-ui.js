/**
 * ★★★ 2026（用户：「页面解锁逻辑能不能和 ad 一样？」）—— **AD 式锁态**
 *
 * AD 的行为：标签**永远显示**（不是隐藏 ✗），未解锁的只是"锁着"——
 *   变暗 + 一个锁角标 + 悬停写明条件；满足条件后**自动**开锁，且**永不重新上锁** ✓
 *
 * 我们的实现本来就已经符合前两条（标签常显、页内写条件、解锁永久），
 *   缺的只是**标签上的视觉锁** ⇒ 本模块只做那一件事 ✓
 *
 * ⚠️ 独立模块 + `ui.js` 里**一行**调用（本轮教训：别动大结构）
 */
import { pageUnlocked, PAGE_KEYS } from "./config.js";

/** 各页的解锁条件文案（唯一数据源 —— 以后要改就改这里）✓ */
export const PAGE_UNLOCK_HINTS = {
  void: "达成第一次相变（解锁虚空科技）",
  zpe: "ZPE 引擎首次产出物质",
  de: "首次进入暗能量层",
  quantum: "首次捕获量子",
  infinity: "首次打破无限（物质触顶）",
  eternity: "首次永恒（IP 达到门槛）",
  space: "首次永恒（空间膨胀是永恒的子页）",
};

/**
 * 更新标签的锁态（每帧调；**幂等**、只改 class/属性，不建节点 ✓）
 * @param {object} state
 */
export function updateTabLocks(state) {
  if (typeof document === "undefined" || !document.getElementById) return;
  for (const key of PAGE_KEYS) {
    const tab = document.querySelector(`[data-tab="${key}"]`);
    if (!tab) continue;
    // ⚠️ `pageUnlocked` 记的是「**曾经**解锁过」⇒ 一旦为真就**永不回头** ✓（与 AD 一致）
    const unlocked = !!pageUnlocked(state, key);
    tab.classList.toggle("locked", !unlocked);
    if (unlocked) {
      tab.removeAttribute("title");
      tab.setAttribute("aria-disabled", "false");
    } else {
      tab.title = "尚未解锁 —— " + (PAGE_UNLOCK_HINTS[key] ?? "进入本页可看到条件");
      tab.setAttribute("aria-disabled", "true");
    }
  }
}

/** `ui.js` 里唯一的接管入口（不依赖它的私有 el[] 缓存 ✓） */
export function setupTabLocks() {
  if (typeof document === "undefined") return false;
  if (document.getElementById("tab-lock-style")) return true;
  // 样式也由本模块注入（不改 css 文件 ⇒ 零冲突 ✓）
  const st = document.createElement("style");
  st.id = "tab-lock-style";
  st.textContent = [
    ".tab.locked { opacity: 0.5; }",
    ".tab.locked::after {",
    '  content: "\\9501";',            // 「锁」的 Unicode 码位，避免源码里的字体问题 ✓
    "  margin-left: 6px; font-size: 10px; padding: 0 4px;",
    "  border: 1px solid var(--line-strong, #444); border-radius: 3px; color: var(--text-dim, #888);",
    "}",
  ].join("\n");
  (document.head ?? document.body)?.appendChild?.(st);
  return true;
}
