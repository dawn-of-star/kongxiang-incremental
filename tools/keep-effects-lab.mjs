/**
 * tools/keep-effects-lab.mjs —— **「保留」类梦想升级的定点断言**
 *
 * 覆盖两条（2026-10-22 用户要求分开验证）：
 *   ① `applyEternityKeeps`：**永恒**时保留暗能量（`keepDeEternity`）✓
 *   ② `applyCollapseKeeps`：**无限（大坍缩）**时也保留 —— **今天新增** ✓
 *      且**没买**时必须照常清空（基线不许被改动 ✗）
 *
 * ⚠️ 为什么单独一个文件：这两条都是"重置流程里的写回"，
 *   一旦顺序写错（快照在 reset 之后取），测试就会全绿但效果全无 ✗
 *   所以必须**真的跑一次 `doBigCrunch`** ✓（历史教训：IC 删掉后 doBigCrunch 抛 ReferenceError，
 *   而没有一个工具跑过它 ⇒ 全绿了整整一个版本 ✗）
 */
import { newState } from "../src/state.js";
import { doBigCrunch } from "../src/engine.js";
import { applyEternityKeeps } from "../src/dream-effects.js";
import Decimal from "../dist/break_eternity.esm.js";

const D = (x) => new Decimal(x);
let fails = 0;
const ck = (label, ok, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? "[ok]" : "[FAIL]"} ${label}${detail ? "  " + detail : ""}`);
};

console.log("=".repeat(96));
console.log("「保留」类梦想升级：永恒 / 无限 两条路径");
console.log("=".repeat(96));

// ① 永恒保留
{
  const s = newState();
  s.dreamUpgrades = { keepDeEternity: true };
  s.darkEnergy = D("1e50");
  applyEternityKeeps(s, { darkEnergy: D("1e50") });
  ck("① 永恒：买了暗能量永存 ⇒ DE 保留", s.darkEnergy.eq(D("1e50")), `DE=${s.darkEnergy.toString()}`);
}

// ② 无限（大坍缩）保留 —— 今天新增
{
  const mk = (bought) => {
    const s = newState();
    s.dreamUpgrades = bought ? { keepDeEternity: true } : {};
    s.darkEnergy = D("1e50");
    s.peakMatter = D("1e400");
    s.resources.matter = D("1e400");
    return s;
  };
  const off = mk(false);
  const r1 = doBigCrunch(off);
  ck("②a 无限：**没买** ⇒ DE 照常清空", r1 != null && off.darkEnergy.eq(D(1)), `DE=${off.darkEnergy.toString()}`);

  const on = mk(true);
  const r2 = doBigCrunch(on);
  ck("②b 无限：**买了** ⇒ DE 保留（新效果）", r2 != null && on.darkEnergy.eq(D("1e50")), `DE=${on.darkEnergy.toString()}`);
}

console.log("=".repeat(96));
console.log(fails === 0 ? "  全部通过（3 条断言）" : `  ${fails} 项失败`);
console.log("=".repeat(96));
process.exit(fails ? 1 : 0);
