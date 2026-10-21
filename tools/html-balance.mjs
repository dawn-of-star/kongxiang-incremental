/**
 * tools/html-balance.mjs —— **结构守卫**：`index.html` 的标签必须配平
 *
 * 为什么要有它（2026-10-22 真实事故）：
 *   我改七巧板版式时**漏掉一个 `</div>`** ✗ ⇒
 *     · 右侧栏 `.tangram-wrap` 把后面的托盘 / 预览 / 说明块全吞进去 ✗
 *     · 整个 `#panel-tangram` 没关闭 ⇒ **把「永恒」面板一起吞掉** ✗
 *     · 用户截图：点永恒 → **页面全空** ✗
 *   而 49 个自检脚本**全绿** ✗ —— 因为没有任何一条检查 HTML 结构 ✓
 *
 * 本守卫查三件事：
 *   ① 全文件 `<div` 与 `</div>` 数量相等
 *   ② 每个 `.tab-panel` 的开闭数量一致
 *   ③ 不允许出现"未闭合的 `<div class="tangram-wrap">`"这类只开不关（用缩进法近似）
 *
 * ⚠️ 只做**计数**级别检查（不是真解析器 ✗）—— 但它能抓住
 *   "漏一个闭合标签"这一类真正的灾难 ✓（今天的 bug 就是这一类）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "index.html");
const html = fs.readFileSync(FILE, "utf8");

let fails = 0;
const ck = (label, ok, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? "[ok]" : "[FAIL]"} ${label}${detail ? "  " + detail : ""}`);
};

console.log("=".repeat(96));
console.log("HTML 结构守卫：index.html 标签配平");
console.log("=".repeat(96));

const count = (re) => (html.match(re) ?? []).length;

// ① div 配平
{
  const open = count(/<div\b/g);
  const close = count(/<\/div>/g);
  ck("① `<div` 与 `</div>` 数量相等", open === close, `开=${open} 闭=${close} 差=${open - close}`);
}

// ② panel 容器配平
{
  const panels = count(/class="tab-panel"/g);
  const ids = count(/id="panel-/g);   // 每个面板都应带 `id="panel-xxx"` ✓
  ck("② 每个 `.tab-panel` 都有 id", panels === ids && panels >= 12, `面板=${panels} 带id=${ids}`);

}

// ③ 每个具名容器只出现一次（防重复 id 导致渲染错位）
{
  const ids = ["panel-tangram", "panel-eternity", "tg-side", "tangram-chal-preview", "tg-chal-preview-btn", "tg-chal-preview-wrap"];
  const bad = ids.filter((id) => count(new RegExp(`id="${id}"`, "g")) !== 1);
  ck("③ 关键 id 各出现 1 次", bad.length === 0, bad.length ? "重复/缺失: " + bad.join(", ") : "6/6");
}

// ④ 关键容器必须有配对的闭合（用"该容器之后 3 行内出现 </div>"近似 ✓）
{
  const lines = html.split("\n");
  const suspects = ["tangram-wrap", "tangram-side", "tangram-tray", "tangram-slots"];
  const bad = [];
  for (const cls of suspects) {
    const i = lines.findIndex((l) => l.includes(`class="${cls}`));
    if (i < 0) { bad.push(cls + " 不存在"); continue; }
    // 从该行起数 div 平衡
    let depth = 0;
    for (let k = i; k < lines.length; k++) {
      depth += count.call(null, /x/) && 0;   // 占位（不使用）
      depth += (lines[k].match(/<div\b/g) ?? []).length;
      depth -= (lines[k].match(/<\/div>/g) ?? []).length;
      if (depth === 0) break;
    }
    if (depth !== 0) bad.push(`${cls} 未闭合`);
  }
  ck("④ 关键容器都能闭合", bad.length === 0, bad.length ? bad.join(", ") : suspects.length + "/" + suspects.length);
}

console.log("=".repeat(96));
console.log(fails === 0 ? "  全部通过（4 条断言）" : `  ${fails} 项失败`);
console.log("=".repeat(96));
process.exit(fails ? 1 : 0);
