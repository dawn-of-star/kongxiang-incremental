/**
 * format.js —— **数字 / 时长的格式化（唯一实现）**
 *
 * 为什么单独成模块（2025）：
 *   `fmt` / `sci` / `fmtMult` / `fmtTime` 原来住在 `ui.js` 里，但 `engine.js` 的**日志**
 *   也要用它们（`pushLog` 里拼 `1e${...}` 的那些）。
 *   而 `ui.js` 已经 `import` 了 `engine.js` ⇒ 若 `engine.js` 反过来 import `ui.js`
 *   就成了**循环依赖**（ESM 下大概率拿到未初始化的绑定 ⇒ ReferenceError）✗
 *   ⇒ 抽到这一层：**两边都 import 它**，谁都不依赖谁 ✓
 *
 * ★★★ 2025（用户裁定）：**统一科学计数法 = `1.00e308`**
 *   ⚠️ 项目里原有一批**手拼的 `1e${log10}`**（如 `1e308.2547`）—— 那个写法**是误导的**：
 *     它的意思是 `10^308.2547` = **1.80e308**，但字面看着像"e 后面跟了个小数" ✗
 *   ⇒ 规范写法 = 尾数 `.toFixed(2)` + `e` + **整数**指数 ✓（`sci()` 就是干这个的）
 *   **用法**：把 `` `1e${x.log10().toFixed(2)}` `` 换成 `sci(x)`（传**值**，不是 log10）
 */
import Decimal from "../dist/break_eternity.esm.js";

/** 尾数去尾零：`1.00` → `1`，`1.20` → `1.2`（只作用于 e 前面的部分） */
function trimMantissa(s) {
  const i = s.indexOf("e");
  const m = i < 0 ? s : s.slice(0, i);
  const rest = i < 0 ? "" : s.slice(i);
  return (m.includes(".") ? m.replace(/0+$/, "").replace(/\.$/, "") : m) + rest;
}

/**
 * ★ 2026-10-23（用户裁定）：
 *   · 数值 **> 1e6** ⇒ 只许科学计数（`1.00e6`）；
 *   · 数值 **> 1e100000** ⇒ 指数本身也用科学计数（`e1e6` 这种“双 e”格式）✓
 *
 *   例：`1e1000000` → `e1e6`；`1e100001` → `e1e5`。
 *   ⚠️ 旧 `fmt` 只在 `layer>=2` 或指数 ≥1e6 时才用双 e ⇒ 1e100001 会显示成
 *      `1.00e100001`（一长串指数），不符合新口径 ✗
 */
const SCI_MIN = new Decimal("1e6");
const DOUBLE_EXP_MIN = new Decimal("1e5");     // log10 > 1e5 即 value > 1e100000

/** 把 log10 值格式化成指数文本：100001 → `1e5`，1000000 → `1e6` */
function fmtExponent(exp) {
  if (exp.lt(SCI_MIN)) {
    // ⚠️ 不能用 `exp / Decimal.pow(10,e)`：1e100001 时 pow 的舍入会让比值落到 1e-99996 ✗
    const n = exp.toNumber();                  // <1e6 ⇒ 精确到整数足够
    const e = Math.floor(Math.log10(n));
    const mant = n / Math.pow(10, e);
    return `${trimMantissa(mant.toFixed(2))}e${e}`;
  }
  return trimMantissa(sci(exp));               // exp 本身也可能是双 e（极端值）
}

/** 双 e 格式：value > 1e100000（或 layer>=2） */
function fmtDoubleExponential(d) {
  return `e${fmtExponent(d.log10())}`;
}

/** 大数格式化：1e6 以下保留原样；以上科学计数；1e100000 以上双 e */
export function fmt(value, places = 2) {
  const d = value instanceof Decimal ? value : new Decimal(value);
  if (!d.isFinite()) return d.sign > 0 ? "∞" : "-∞";
  if (d.sign < 0) return "-" + fmt(d.neg(), places);
  if (d.eq(0)) return "0";

  if (d.lt(1000)) {
    const n = d.toNumber();
    const s = n.toFixed(places);
    return s.includes(".") ? trimMantissa(s) : s;
  }
  if (d.lt(SCI_MIN)) return d.toNumber().toFixed(0);

  const L = d.log10();
  if ((d.layer ?? 0) >= 2 || L.gt(DOUBLE_EXP_MIN)) return fmtDoubleExponential(d);

  const exp = Math.floor(L.toNumber());
  const mant = d.div(Decimal.pow(10, exp)).toNumber();
  return trimMantissa(`${mant.toFixed(places)}e${exp}`);
}

/**
 * **规范科学计数法** `1.00e308` —— 用户裁定的统一格式。
 * 超过 1e100000 后返回双 e（`e1e6`），不是 `1.00e1000000`。
 * @param {Decimal|number} value 要显示的数（**不是它的 log10**）
 */
export function sci(value) {
  const d = value instanceof Decimal ? value : new Decimal(value ?? 0);
  if (!d.isFinite()) return d.sign > 0 ? "∞" : "-∞";
  if (d.lte(0)) return "0";
  if (d.lt(1000)) return d.toNumber().toFixed(2);
  if (d.lt(SCI_MIN)) return d.toNumber().toFixed(0);

  const L = d.log10();
  if ((d.layer ?? 0) >= 2 || L.gt(DOUBLE_EXP_MIN)) return fmtDoubleExponential(d);

  const exp = Math.floor(L.toNumber());
  const mant = d.div(Decimal.pow(10, exp)).toNumber();
  return `${mant.toFixed(2)}e${exp}`;
}

/** 倍率格式化（`×1.00e308`）—— 大数也走 `sci` 的规范格式 */
export function fmtMult(value) {
  const d = value instanceof Decimal ? value : new Decimal(value);
  if (d.lt(1000)) return `×${d.toNumber().toFixed(2)}`;
  return `×${sci(d)}`;
}

/** 时长格式化 */
export function fmtTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}
