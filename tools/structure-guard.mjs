#!/usr/bin/env node
/**
 * tools/structure-guard.mjs —— **模块化之后的结构守卫**
 *
 * 为什么需要它：2026 的模块化把三个 god module（config 4,973 / ui 2,784 / engine 1,660 行）
 * 拆成了领域模块。但拆分本身**不会自动保持**：
 *   · 下一个人（或下一次 AI 会话）很容易把新逻辑塞回 barrel / ui.js；
 *   · 一个没人 import 的新模块会静默腐烂（`ui-tangram.js` 就是这么躺了 235 行）。
 *
 * 本守卫钉住四条：
 *   ① **文件预算**：barrel ≤ 80 行；ui.js ≤ 850；任何 src 文件 ≤ 1150
 *   ② **函数预算**：任何顶层函数 ≤ 320 行（当前最大 tickBody 298）
 *   ③ **可达性**：从 `src/main.js` 出发的 import 图必须覆盖 src/ 下每一个 .js
 *   ④ **分层方向**：config/formulas/state 不许 import engine/ui；
 *      engine 不许 import ui；ui-core / 面板不许 import ui.js（编排层）
 *
 * 退出码：0 = 全过；1 = 有违规（run-all 会判失败）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { walkFiles } from "./lib/walk.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const files = walkFiles(SRC).sort();
const relOf = (f) => path.relative(SRC, f).replace(/\\/g, "/");
const relSet = new Set(files.map(relOf));

const problems = [];
const notes = [];
const add = (kind, msg) => problems.push({ kind, msg });

// ── ① 文件预算 ──
const BARRELS = ["config.js", "engine.js", "formulas.js", "state.js", "neko.js", "config/infinity.js"];
const budget = (rel) => {
  if (BARRELS.includes(rel)) return 80;
  if (rel === "ui.js") return 850;
  if (rel.startsWith("config/infinity/")) return 500;
  if (rel.startsWith("config/")) return 800;
  if (rel.startsWith("engine/")) return 600;
  if (rel.startsWith("formulas/")) return 300;
  if (rel.startsWith("state/")) return 350;
  if (rel.startsWith("neko/")) return 500;
  if (rel.startsWith("ui-")) return 700;
  return 850;
};
let maxFile = { rel: "", lines: 0 };
for (const f of files) {
  const rel = relOf(f);
  const lines = fs.readFileSync(f, "utf8").split(/\r?\n/).length;
  if (lines > maxFile.lines) maxFile = { rel, lines };
  const b = budget(rel);
  if (lines > b) add("文件预算", `${rel} = ${lines} 行 > 预算 ${b} 行（拆小它，或把纯注释移到 docs/）`);
}
for (const barrel of BARRELS) {
  const text = fs.readFileSync(path.join(SRC, barrel), "utf8");
  const body = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (/\b(function|const|let)\s+[A-Za-z_$]/.test(body)) {
    add("barrel 纯度", `${barrel} 里出现了实现（只该 re-export）`);
  }
}

// ── ② 函数预算（只量顶层 function；tickBody 这类长函数要拆时先改这里）──
let maxFn = { rel: "", name: "", lines: 0 };
for (const f of files) {
  const rel = relOf(f);
  const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
  let cur = null, depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(?:export )?function\s+([A-Za-z_$][\w$]*)/);
    if (m && !cur) { cur = { name: m[1], start: i }; depth = 0; }
    if (!cur) continue;
    for (const ch of lines[i]) { if (ch === "{") depth++; else if (ch === "}") depth--; }
    if (depth <= 0 && i > cur.start && lines[i].trim() === "}") {
      const len = i - cur.start + 1;
      if (len > maxFn.lines) maxFn = { rel, name: cur.name, lines: len };
      if (len > 300) add("函数预算", `${rel} 的 ${cur.name}() = ${len} 行 > 300 行`);
      cur = null;
    }
  }
}

// ── ③ import 图可达性 ──
const graph = new Map();
for (const f of files) {
  const rel = relOf(f);
  const text = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const deps = [];
  for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)) {
    const spec = m[1];
    if (!spec.startsWith(".")) continue;
    const target = path.resolve(path.dirname(f), spec);
    if (relSet.has(path.relative(SRC, target).replace(/\\/g, "/"))) deps.push(path.relative(SRC, target).replace(/\\/g, "/"));
  }
  graph.set(rel, deps);
}
const reachable = new Set();
const queue = ["main.js"];
while (queue.length) {
  const cur = queue.shift();
  if (reachable.has(cur)) continue;
  reachable.add(cur);
  for (const d of graph.get(cur) ?? []) queue.push(d);
}
for (const rel of relSet) {
  if (!reachable.has(rel)) add("可达性", `${rel} 从未被 main.js 的 import 图引用（死模块）`);
}

// ── ④ 分层方向 ──
const layer = (rel) => {
  if (rel === "config.js" || rel.startsWith("config/")) return "config";
  if (rel === "formulas.js") return "formulas";
  if (rel === "state.js") return "state";
  if (rel === "engine.js" || rel.startsWith("engine/")) return "engine";
  if (rel === "ui-core.js") return "ui-core";
  if (rel === "ui.js") return "ui";
  if (rel.startsWith("ui-")) return "ui-panel";
  if (rel === "main.js") return "main";
  return "domain";
};
const forbidden = {
  config: [/^engine\//, /^engine\.js$/, /^ui/, /^main\.js$/, /^save\.js$/],
  formulas: [/^engine\//, /^engine\.js$/, /^ui/, /^main\.js$/, /^save\.js$/],
  state: [/^engine\//, /^engine\.js$/, /^ui/, /^main\.js$/, /^save\.js$/],
  engine: [/^ui/, /^main\.js$/],
  "ui-core": [/^ui\.js$/, /^ui-(?!cache\.js$)/, /^main\.js$/],
  "ui-panel": [/^ui\.js$/, /^main\.js$/],
  ui: [/^main\.js$/],
};
for (const [rel, deps] of graph) {
  const rules = forbidden[layer(rel)];
  if (!rules) continue;
  for (const d of deps) {
    if (rules.some((re) => re.test(d))) add("分层方向", `${rel}（${layer(rel)}）import 了 ${d}（${layer(d)}）`);
  }
}

// ── 报告 ──
console.log("=".repeat(80));
console.log("结构守卫：模块预算 / 函数预算 / 可达性 / 分层方向");
console.log("=".repeat(80));
console.log(`  扫描 ${files.length} 个模块｜最大文件 ${maxFile.rel} = ${maxFile.lines} 行｜最长函数 ${maxFn.rel} ${maxFn.name}() = ${maxFn.lines} 行`);
console.log(`  可达性：${reachable.size}/${files.length} 个模块可从 main.js 到达`);
console.log();
if (problems.length) {
  console.log(`  ❌ ${problems.length} 处违规：`);
  for (const p of problems) console.log(`     [${p.kind}] ${p.msg}`);
  process.exitCode = 1;
} else {
  console.log("  ✅ 全部结构预算与分层规则通过");
}
console.log("=".repeat(80));
