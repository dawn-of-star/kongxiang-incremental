# 架构与维护性（**模块化的权威入口**）

> **状态：✅ 权威（有效，可作为实现依据）** —— 2026-10-19 模块化重构后
> 生成方式：本页由重构者手写；**结构预算由 `tools/structure-guard.mjs` 自动守**
> （`run-all` 默认包含它，违反即红）。
> 相关：目录速查见 [`README.md`](../README.md)；机械计数见 [`CONFIG-FACTS.md`](CONFIG-FACTS.md)。

---

## 0. 为什么有这份文档

2026-10-19 的评估结论是：**加权不可维护性 60%**，超过 50% 的阈值 ⇒ 执行模块化重构。
依据不是"感觉"，而是三条可复核的事实：

| 事实（重构前） | 数字 |
|---|---|
| `src/config.js` | **4,973 行 / 157 个导出**（数据 + 逻辑 + UI 折叠配置混在一起） |
| `src/ui.js` | **2,784 行**，其中 `render()` 一个函数 **560 行**（圈复杂度 125） |
| `src/engine.js` | **1,660 行**，其中 `tickBody()` **298 行** |
| 死模块 | `ui-tangram.js` **235 行**，从未被 import（旧实现，已被 `tangram-board.js` 取代） |
| 守卫盲区 | 多个 `tools/*.mjs` 只扫 `src/*.js`，拆目录后会**静默变瞎** |

重构后（2026-10-19，HEAD 见 git log）：

| 指标 | 重构前 | 重构后 |
|---|---|---|
| 最大源文件 | 4,973 行（`config.js`） | **1,117 行**（`formulas.js`，注释占 59%） |
| 最大函数 | 560 行（`render`） | **298 行**（`tickBody`，保留为已知债务） |
| 导出入口 | `config.js` / `engine.js` 各自是 god module | 两者都是 **≤ 22 行的 barrel**，实现按领域拆开 |
| `ui.js` | 2,784 行 | **761 行**（只做 build / init / render 编排） |
| 死模块 | 1 个（235 行） | **0**（`structure-guard` 守可达性） |
| 自检脚本 | 48 | **49**（新增结构守卫） |

> 完整的分维度评分见 §5。重构的本地备份在
> `../_backup/kongxiang-pre-modular-2026-10-19/`（源码 tar + git bundle），
> 并打了 tag `pre-modular-refactor-2026-10-19`。

---

## 1. 分层（从下到上，**只许上层依赖下层**）

```
main.js            装配 + rAF 主循环
  ├─ ui.js         静态结构构建 + 编排；唯一初始化入口
  │    ├─ ui-core.js        DOM 缓存 / 写入去重 / 乘区上色 / 格式化
  │    ├─ ui-panels.js      主面板 11 个区块的 render
  │    └─ ui-<panel>.js    量子 / 无限 / 永恒 / 暗物质 / 猫猫 / 七巧板
  ├─ engine.js     引擎门面（barrel）
  │    └─ engine/{tick,actions,collapse,purchases,eternity}.js
  ├─ formulas.js   纯计算（不碰 DOM）
  ├─ state.js      状态工厂 + 序列化
  ├─ config.js     配置门面（barrel）
  │    └─ config/<12 个领域模块>.js
  └─ domain        七巧板 / N.E.K.O / 梦想 / 自动无限 / 性能 / 存档 / 格式化
```

**允许的方向**：上层 → 下层。
**禁止的方向**（`structure-guard.mjs` 会拦）：

| 下层 | 不许 import |
|---|---|
| `config/`、`formulas.js`、`state.js` | `engine/`、`ui*`、`main.js`、`save.js` |
| `engine/` | `ui*`、`main.js` |
| `ui-core.js` | `ui.js`、任何 `ui-<panel>.js`、`main.js` |
| `ui-<panel>.js` | `ui.js`（编排层）、`main.js` |

> 为什么要禁：`ui-core` 若反向 import 面板，就会形成
> `ui.js → 面板 → ui-core → 面板` 的环；`config` 若 import engine，
> 则无头测试再也拿不到"纯数据层"。这两条都是重构前踩过的结构债。

---

## 2. 模块清单

### 2.1 `src/config/`（数据 + 与该数据强相关的唯一入口）

| 文件 | 职责 |
|---|---|
| `base.js` | `BASE` / `ZONE_RULES` / 页面解锁 / `COLLAPSE` / `UI_FOLDS` |
| `upgrades.js` | `REPEATABLE` / `VOID_UPGRADES` / 虚空加成 / 相变仪/时间加成 |
| `milestones.js` | 坍缩 / ZPE / 暗能量 / 量子四套里程碑**数据表** |
| `zpe-engine.js` | ZPE 引擎价格、等级、五条机制、`effectiveEngineLevel` |
| `eternity.js` | 永恒门槛、EP 公式、永恒升级、8 条永恒里程碑 |
| `dream.js` | 梦想升级、效果聚合、离线上限、`computeS`、分段价格 |
| `dark-energy.js` | 暗能量升级、惩罚、有效量软上限 |
| `quantum.js` | 量子、粒子增幅 `b`、跨度幂 `k`、暗能量自增长 |
| `infinity.js` | 无限门槛、过载、∞ 升级、IP 经济、无限增幅、档位里程碑 |
| `dark-matter.js` | 暗物质 / 第二台相变仪 |
| `zones.js` | 乘区颜色与归属 |
| `neko.js` | 好感度、道具、动作白名单 |

⚠️ **`src/config.js` 只是 barrel**：新增常量/函数时放进对应领域文件，
**不要**写回 `config.js`（`structure-guard` 会检查 barrel 纯度）。

### 2.2 `src/engine/`

| 文件 | 职责 |
|---|---|
| `tick.js` | `tick` / `advance`（离线闭式解）/ 层间重置钩子 |
| `actions.js` | 点击、可重复升级、熵阱、自动获取 |
| `collapse.js` | 大坍缩、打破无限、`resetForCollapse` |
| `purchases.js` | 虚空 / 暗能量 / 梦想 / ∞ / ZPE 引擎 / 暗物质购买 |
| `eternity.js` | 永恒保留规则 + `doEternity` |

### 2.3 `src/ui*.js`

| 文件 | 职责 |
|---|---|
| `ui.js` | 构建静态 DOM、标签/按钮绑定、`render()` 编排（26 行） |
| `ui-core.js` | `el` / `$` / `cache` / 写入去重 / `applyZone` / 格式化 re-export |
| `ui-panels.js` | 资源条、升级中心、虚空、永恒、坍缩里程碑、ZPE 引擎、自动化、ZPE 里程碑、暗能量、日志 |
| `ui-quantum.js` / `ui-infinity.js` / `ui-eternity.js` / `ui-darkmatter.js` / `ui-neko.js` / `ui-tangram-panel.js` | 各自面板的 render |

---

## 3. 结构守卫（`tools/structure-guard.mjs`）

| 规则 | 阈值（当前） |
|---|---|
| barrel 文件 | ≤ 80 行，且只含 re-export |
| `ui.js` | ≤ 850 行（现 761） |
| `config/*` | ≤ 1,150 行（现最大 1,009） |
| `engine/*` | ≤ 700 行（现最大 512） |
| `ui-*.js` | ≤ 700 行（现最大 554） |
| 任意 `src/**/*.js` | ≤ 1,150 行（现最大 1,117） |
| 任意顶层函数 | ≤ 320 行（现最大 `tickBody` 298） |
| 可达性 | `src/` 下每个 `.js` 都必须能从 `main.js` 的 import 图到达 |
| 分层 | 见 §1 的禁止表 |

> 改预算之前先问：**是文件真的该长，还是逻辑放错了层？**
> 预算不是"目标"，是"防回退警报"。

---

## 4. 新增代码放哪里（决策表）

| 你要加的东西 | 放这里 | 不要放 |
|---|---|---|
| 一个新数值 / 新升级表 | 对应 `src/config/<领域>.js` | `src/config.js`（barrel） |
| 一个纯计算公式 | `formulas.js`（若够独立，再新开模块） | `ui.js` / 面板文件 |
| 一个 tick 内的新阶段 | `engine/tick.js`（先抽成局部函数再接线） | 直接往 `tickBody` 里塞 50 行 |
| 一个购买动作 | `engine/actions.js` 或 `purchases.js` | `ui.js` 的 handler 里自写扣款 |
| 一个面板的渲染 | `ui-<panel>.js` 或 `ui-panels.js` | 写回 `ui.js` 的 `render()` |
| 一个 DOM 工具 | `ui-core.js`（并确认不 import 面板） | 面板模块各写一份 |
| 一个新机制 | 新模块 + `docs/` 一页 + `tools/` 断言 | 只改代码不改文档/断言 |

---

## 5. 维护性评分（同一把尺子，前后对照）

> **这是加权评估，不是物理测量。** 5 个维度，0 = 很好，100 = 不可维护。
> 分数是重构者按可复核证据打的；争议维度在"依据"列给出数字。

| 维度 | 权重 | 前 | 后 | 依据（前 → 后） |
|---|---:|---:|---:|---|
| 模块边界 / 职责 | 25% | 70 | **25** | 3 个 god module → 47 个领域模块 + 3 个 barrel；`config` 不再混 UI |
| 文件 / 函数规模 | 20% | 85 | **40** | 最大文件 4,973 → 1,117；最大函数 560 → 298；`render` 560 → 26 |
| 耦合 / 依赖方向 | 15% | 55 | **30** | import 图单向分层；结构守卫拦反向依赖 |
| 重复 / 死代码 | 15% | 50 | **30** | 删除 235 行死模块；`ui.js` 清掉 121 个未使用 import；死代码审计修复假绿 |
| 复杂度 / 可读性 | 15% | 55 | **50** | `tickBody` 298 / `deserialize` 245 仍在；注释密度高（是资产，不是负担） |
| 测试 / 文档 | 10% | 15 | **10** | 48 → **49** 个脚本；守卫全部递归到子目录 |
| **加权** | 100% | **60.0** | **31.8** | 已低于 50% 阈值 |

**结论**：重构前 **60%**（> 50% ⇒ 触发重构）；重构后 **31.8%**（< 50%）。
**仍高于"理想"的 20%**，主要因为 §6 列出的三处长函数/大文件。

---

## 6. 明确保留的债务（诚实清单）

| # | 债务 | 为什么这轮不动 | 建议 |
|---|---|---|---|
| D1 | `engine/tick.js` 的 `tickBody()` **298 行** | 11 个阶段共享 `P0` / `entropy` / `particleGain` / `k` 等中间量；硬拆要改状态传递，属行为变更 | 下次动 tick 时按"阶段返回对象"重构，并补 `consistency` |
| D2 | `formulas.js` **1,117 行**（代码 397 行，注释 659 行） | 它是纯函数层，注释是公式推导；拆分收益低于 config/ui | 若要拆，按"熵/粒子/物质/ZPE/DE/IP"分 6 个文件 |
| D3 | `neko.js` **907 行**、`state.js` **673 行** | 各自是独立域；`deserialize` 245 行是旧档兼容的集中处 | 后续可拆 `state/serialize.js` 与 `neko/bridge.js` |
| D4 | `config/infinity.js` **1,009 行** | 已按领域聚合；再拆会把 IP 经济与 ∞ 升级割开 | 若继续长，拆 `infinity-ip.js` |
| D5 | 注释密度 45%~61% | **刻意保留**：项目规矩是"理由住在注释与 docs/"，防回退 | 不要为了行数删注释；把长推导搬到 `docs/` 再留链接 |

---

## 7. 重构记录（可回溯）

| commit | 内容 |
|---|---|
| `b39cb8d` | `config.js` 4,973 行 → `src/config/` 12 个领域模块 + 22 行 barrel；守卫递归化；死代码审计修复 |
| `1e75536` | `ui.js` 2,784 行 → `ui-core` + `ui-panels` + 6 个面板模块；`render()` 560 → 26 行；删除死模块 `ui-tangram.js`；修掉 `drawTangramPiece` 未 import 的潜在 ReferenceError |
| `cbea9b8` | `engine.js` 1,660 行 → `src/engine/` 5 个动作域模块 + 18 行 barrel |
| 本轮末 | 新增 `tools/structure-guard.mjs`（49th 脚本）；本文件 + README / README-STATUS / CONFIG-FACTS 同步 |

**验收基线**：`npm test` → **49/49 全绿**（默认批跑；`--strict` 仍有 6 个已知失败，
见 [`TODO.md`](TODO.md) M 段，属过期断言/坏工具/数值漂移，非坏实现）；`node tools/dom-smoke.mjs` 全绿；
`node tools/consistency.mjs` 速率 8/8 一致、其他 33/33 通过。
