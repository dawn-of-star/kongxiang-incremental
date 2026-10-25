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
| 最大源文件 | 4,973 行（`config.js`） | **762 行**（`ui.js`，只做装配/编排） |
| 最大函数 | 560 行（`render`） | **265 行**（`createNekoBridge`） |
| 导出入口 | `config.js` / `engine.js` 各自是 god module | 9 个 **≤ 22 行的 barrel**（config / engine / formulas / state / neko / config-infinity / config-quantum / config-zpe / engine-purchases） |
| `ui.js` | 2,784 行 | **761 行**（只做 build / init / render 编排） |
| 模块数 | 23 个平铺 `.js` | **79 个模块**（含 barrel） |
| 死模块 | 1 个（235 行） | **0**（`structure-guard` 守可达性） |
| 自检脚本 | 48 | **49**（新增结构守卫） |

> 完整的分维度评分见 §5。重构的本地备份在
> `../_backup/kongxiang-pre-modular-2026-10-19/`（源码 tar + git bundle），
> 并打了 tag `pre-modular-refactor-2026-10-19`。

---

## 0.5 🧊 冻结区：N.E.K.O 协同代码（**未经用户明确解除，不许动**）

用户 2026 裁定：**「涉及到协同的暂时不要动 —— 与 N.E.K.O 通讯、并让对方能操控游戏的函数千万不要动。」**

| 冻结文件 / 段落 | 冻结原因 |
|---|---|
| `src/neko.js` + `src/neko/**` | 宿主握手、状态发布、动作白名单、派发器 —— 对面按契约调用 |
| `src/ui-neko.js` | 猫猫子页的通讯状态/对话展示 |
| `src/config/neko.js` | 好感度、道具、动作白名单数据 |
| `src/main.js` 的 Neko 段落 | `createNekoBridge` / `nekoActionApi` / `dispatchNekoActions` / `__game.nekoActions` |
| `src/state/serialize.js` 的 `nekoAffinity` / `nekoDriftStamps` 迁移 | 玩家好感度存档 |
| `src/state/schema.js` 的 Neko 字段 | 同上 |

> 这些文件可以**读**、可以跑它的测试，但**不要改结构/签名/行为**。
> 其它模块如果只是「被 Neko 调用」（如 `engine` 的购买函数），可以在**保持导出签名**的前提下重构；
> 本轮的 `engine/purchases` / `config/quantum` 拆分都属于这一类。

---

## 1. 分层（从下到上，**只许上层依赖下层**）

```
main.js            装配 + rAF 主循环
  ├─ ui.js         静态结构构建 + 编排；唯一初始化入口
  │    ├─ ui-core.js        乘区上色 / 效果文案 / 格式化 / 共享回调
  │    ├─ ui-cache.js       DOM 缓存 / 写入去重 / 真实写入计数
  │    ├─ ui-panels.js      主面板 11 个区块的 render
  │    └─ ui-<panel>.js    量子 / 无限 / 永恒 / 暗物质 / 猫猫 / 七巧板
  ├─ engine.js     引擎门面（barrel）
  │    ├─ engine/{tick,actions,collapse,eternity}.js
  │    └─ engine/purchases/{misc,infinity,zpe,darkmatter}.js
  ├─ formulas.js   纯计算门面（barrel）
  │    └─ formulas/{core,global,zpe,dark-energy,dark-energy-rate,entropy,matter,costs,quantum,infinity}.js
  ├─ state.js      状态门面（barrel）
  │    └─ state/{schema,accessors,log,serialize,helpers}.js
  ├─ config.js     配置门面（barrel）
  │    ├─ config/<12 个领域模块>.js
  │    ├─ config/infinity/{tier,break,upgrades,ip}.js
  │    ├─ config/quantum/{gates,growth}.js
  │    └─ config/zpe-engine/{config,economy}.js
  └─ domain        七巧板 / N.E.K.O（neko.js + neko/）/ 梦想 / 自动无限 / 性能 / 存档 / 格式化
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
| `zpe-engine.js` | 引擎门面；实现见 `zpe-engine/{config,economy}.js` |
| `eternity.js` | 永恒门槛、EP 公式、永恒升级、8 条永恒里程碑 |
| `dream.js` | 梦想升级、效果聚合、离线上限、`computeS`、分段价格 |
| `dark-energy.js` | 暗能量升级、惩罚、有效量软上限 |
| `quantum.js` | 量子层门面；实现见 `quantum/{gates,growth}.js` |
| `infinity.js` | 无限层门面；实现见 `infinity/{tier,break,upgrades,ip}.js` |
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
| `purchases.js` | 购买门面；实现见 `purchases/{misc,infinity,zpe,darkmatter}.js` |
| `eternity.js` | 永恒保留规则 + `doEternity` |

### 2.3 `src/ui*.js`

| 文件 | 职责 |
|---|---|
| `ui.js` | 构建静态 DOM、标签/按钮绑定、`render()` 编排（26 行） |
| `ui-core.js` | `applyZone` / `effectText` / 格式化 re-export / `uiHandlers`（re-export 缓存层） |
| `ui-cache.js` | `el` / `$` / `cache()` / `domWriteStats`（CACHE_IDS 表 + 写入去重） |
| `ui-panels.js` | 资源条、升级中心、虚空、永恒、坍缩里程碑、ZPE 引擎、自动化、ZPE 里程碑、暗能量、日志 |
| `ui-quantum.js` / `ui-infinity.js` / `ui-eternity.js` / `ui-darkmatter.js` / `ui-neko.js` / `ui-tangram-panel.js` | 各自面板的 render |

### 2.4 `src/formulas/`（纯计算，不碰 DOM）

| 文件 | 职责 |
|---|---|
| `core.js` | `D` / `floorDiv` / 等比求和 / 梦想系数 / `kindProduct` |
| `global.js` | 全局加成与三因子分解 |
| `zpe.js` | ZPE 倍率 / 产出 / 惩罚 / 熵阱 / ZPE 速率 |
| `dark-energy.js` / `dark-energy-rate.js` | 暗能量倍率、单次转换量、产出速率 |
| `entropy.js` / `matter.js` | 熵→粒子→物质生产链 |
| `costs.js` | 三类价格入口 |
| `quantum.js` / `infinity.js` | 量子里程碑 / 坍缩与无限层判据 |

### 2.5 `src/state/`

| 文件 | 职责 |
|---|---|
| `schema.js` | `newState()` 字段与默认值 |
| `serialize.js` | 序列化 / 反序列化 + 旧档迁移 |
| `accessors.js` | 等级 / 里程碑 / 成就计数 |
| `log.js` | 环形日志 / 关键等级 |
| `helpers.js` | `D()` |

### 2.6 `src/neko/`

| 文件 | 职责 |
|---|---|
| `log.js` | 日志 kind 与结构化条目 |
| `snapshot.js` | 只读状态快照（含宿主快照） |
| `actions.js` | 动作白名单与派发器 |
| `bridge.js` | 宿主探测 / 握手 / 能力契约 / 助手上下文 |

---

## 3. 结构守卫（`tools/structure-guard.mjs`）

| 规则 | 阈值（当前） |
|---|---|
| barrel 文件（6 个） | ≤ 80 行，且只含 re-export |
| `ui.js` | ≤ 850 行（现 761） |
| `config/*` | ≤ 800 行（现最大 740） |
| `config/infinity/*` | ≤ 500 行（现最大 434） |
| `config/quantum/*` | ≤ 500 行（现最大 478） |
| `engine/*` | ≤ 600 行（现最大 559） |
| `formulas/*` | ≤ 300 行（现最大 239） |
| `state/*` | ≤ 350 行（现最大 273） |
| `neko/*` | ≤ 500 行（现最大 461） |
| `ui-*.js` | ≤ 700 行（现最大 554） |
| 任意 `src/**/*.js` | ≤ 850 行（现最大 762） |
| 任意顶层函数 | ≤ 300 行（现最大 `createNekoBridge` 265） |
| 可达性 | `src/` 下每个 `.js` 都必须能从 `main.js` 的 import 图到达 |
| 分层 | 见 §1 的禁止表 |

> 改预算之前先问：**是文件真的该长，还是逻辑放错了层？**
> 预算不是"目标"，是"防回退警报"。

---

## 4. 新增代码放哪里（决策表）

| 你要加的东西 | 放这里 | 不要放 |
|---|---|---|
| 一个新数值 / 新升级表 | 对应 `src/config/<领域>.js`（无限层在 `config/infinity/`） | `src/config.js`（barrel） |
| 一个纯计算公式 | `src/formulas/<领域>.js` | `formulas.js`（barrel）/ `ui.js` |
| 一个状态字段 / 迁移 | `state/schema.js` + `state/serialize.js`（**两边必须同时改**） | 只改其中一边 |
| 一个 N.E.K.O 能力 | `neko/<log / snapshot / actions / bridge>.js` | 把逻辑塞回 `neko.js`（barrel） |
| 一个 tick 内的新阶段 | `engine/tick.js`（先抽成命名函数再接线） | 直接往 `tickBody` 里塞 50 行 |
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
| 模块边界 / 职责 | 25% | 70 | **20** | 3 个 god module → **79 个模块（含 9 个 barrel）**；config / ui / engine / formulas / state / neko 全部按领域拆开 |
| 文件 / 函数规模 | 20% | 85 | **30** | 最大文件 4,973 → 762；最大函数 560 → 265；`render` 560 → 26；`tickBody` 298 → 30 |
| 耦合 / 依赖方向 | 15% | 55 | **30** | import 图单向分层；结构守卫拦反向依赖；少量函数级循环（config/infinity、formulas）已确认无顶层调用 |
| 重复 / 死代码 | 15% | 50 | **30** | 删除 235 行死模块；`ui.js` 清掉 121 个未使用 import；死代码审计修复假绿；barrel 纯度有守卫 |
| 复杂度 / 可读性 | 15% | 55 | **45** | `createNekoBridge` 265 / `deserialize` 245 / `newState` 232 仍在；注释密度高（是资产，不是负担） |
| 测试 / 文档 | 10% | 15 | **10** | 48 → **49** 个脚本；守卫全部递归到子目录 |
| **加权** | 100% | **60.0** | **27.8** | 已低于 50% 阈值 |

**结论**：重构前 **60.0%**（> 50% ⇒ 触发重构）；重构后 **27.8%**（< 50%）。
**仍高于"理想"的 20%**，主要因为 §6 列出的三个长函数（都是行为敏感区）。

---

## 6. 明确保留的债务（诚实清单）

| # | 债务 | 为什么这轮不动 | 建议 |
|---|---|---|---|
| D1 | `neko/bridge.js` 的 `createNekoBridge()` **265 行** | **N.E.K.O 冻结区**（用户 2026 明令：协同代码不许动） | 等用户解除冻结后，按「connection / lifecycle / assist」三段拆 |
| D2 | `state/serialize.js` 的 `deserialize()` **245 行**、`state/schema.js` 的 `newState()` **232 行** | 两处都含 Neko 字段（`nekoAffinity` / `nekoDriftStamps`）⇒ 属冻结区；且旧档迁移拆错会丢存档 | 解除冻结后先补「newState 字段 == deserialize 读字段」守卫，再按迁移批次拆 |
| D3 | 注释密度 45%~61% | **刻意保留**：项目规矩是"理由住在注释与 docs/"，防回退 | 不要为了行数删注释；把长推导搬到 `docs/` 再留链接 |

---

## 7. 重构记录（可回溯）

| commit | 内容 |
|---|---|
| `b39cb8d` | `config.js` 4,973 行 → `src/config/` 12 个领域模块 + 22 行 barrel；守卫递归化；死代码审计修复 |
| `1e75536` | `ui.js` 2,784 行 → `ui-core` + `ui-panels` + 6 个面板模块；`render()` 560 → 26 行；删除死模块 `ui-tangram.js`；修掉 `drawTangramPiece` 未 import 的潜在 ReferenceError |
| `cbea9b8` | `engine.js` 1,660 行 → `src/engine/` 5 个动作域模块 + 18 行 barrel |
| `11ae6b1` | 新增 `tools/structure-guard.mjs`（49th 脚本）；本文件 + README / README-STATUS / CONFIG-FACTS 同步 |
| `e29d7e4` | `formulas.js` 1,116 行 → `src/formulas/` 10 个领域模块 + 19 行 barrel |
| `02fab0c` | `state.js` 673 行 → `src/state/` 5 个职责模块 + 16 行 barrel |
| `e7857ba` | `neko.js` 907 行 → `src/neko/` 4 个职责模块 + 17 行 barrel（公开 API 14 个不变） |
| `f553a52` | `tickBody()` 298 → 30 行：11 个阶段抽成命名函数（运算顺序与代码逐字保留） |
| `1ef3e09` | `config/infinity.js` 1,009 行 → `src/config/infinity/` 4 个模块（tier / break / upgrades / ip） |
| `76fc94d` | `ui-core.js` 437 → 134 行：DOM 缓存/去重下沉到 `ui-cache.js`；七巧板面板与自动无限面板的长绘制函数拆成命名子函数 |
| `0befb22` | `config/quantum.js` 740 行 → `quantum/` 2 个模块（gates / growth） |
| `5c5b9d2` | `engine/purchases.js` 512 行 → `purchases/` 4 个模块（misc / infinity / zpe / darkmatter） |
| `cbde401` | `config/zpe-engine.js` 624 行 → `zpe-engine/` 2 个模块（config / economy） |
| 本轮末 | 冻结 N.E.K.O 协同代码（§0.5）；收紧结构预算；ARCHITECTURE 同步为 79 模块、加权 27.8% |

**验收基线**：`npm test` → **52/52 全绿**（默认批跑；`--strict` 仍有 6 个已知失败，
见 [`TODO.md`](TODO.md) M 段，属过期断言/坏工具/数值漂移，非坏实现）；`node tools/dom-smoke.mjs` 全绿；
`node tools/consistency.mjs` 速率 8/8 一致、其他 34/34 通过。
