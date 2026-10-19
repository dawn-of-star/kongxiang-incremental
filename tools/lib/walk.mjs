/**
 * tools/lib/walk.mjs —— 源码文件枚举（**支持子目录**）
 *
 * 背景（2026 模块化）：`src/` 从"一层平铺"变成 `src/config/` 等多层目录后，
 * 原来写死 `readdirSync(src)` 的守卫会**静默漏掉子目录**（工具照样报绿，
 * 于是"模块化"顺手把守卫变瞎了 ✗）。
 * ⇒ 所有需要遍历 `src/` 的工具统一走这里。
 *
 * ⚠️ 本文件不是自检脚本（放在 tools/lib/ 下，`run-all` 只发现 tools/*.mjs）。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 递归列出目录下的文件。
 * @param {string} dir
 * @param {{ exts?: string[], skipDirs?: string[] }} [opts]
 * @returns {string[]} 绝对路径
 */
export function walkFiles(dir, { exts = [".js"], skipDirs = [] } = {}) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".git" || skipDirs.includes(e.name)) continue;
      out.push(...walkFiles(join(dir, e.name), { exts, skipDirs }));
    } else if (exts.some((x) => e.name.endsWith(x))) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

/** 把目录下所有匹配文件读成一段文本（用于"标识符是否出现过"这类判据）。 */
export function readAll(dir, opts) {
  return walkFiles(dir, opts).map((f) => readFileSync(f, "utf8")).join("\n");
}
