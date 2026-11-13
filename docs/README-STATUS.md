# 技术文档状态索引 —— **文档的权威入口**（最后核对：0.8.4 / 2025）

> **这份文件是"哪些文档还有效、以哪份为准"的唯一入口。**
> 加/删/改任何 `docs/*.md` 时**必须回来同步这张表** ✓
>
> ⚠️ **自动化守卫（两件，都在 `npm test` 里）**：
>   · `tools/config-facts.mjs` —— **从代码生成 [`CONFIG-FACTS.md`](CONFIG-FACTS.md)**
>     并校验它是否与代码同步（**报红而非静默改写**，逼人确认机制变更）✓
>   · `tools/docs-audit.mjs` —— 机械检查
>     ① 引用的仓库内路径是否存在 ② 脚本数量口径 ③ 引用的标识符是否存在
>     ④ 每篇文档是否有"状态头" ⑤ **计数与代码是否相符**（乘区数/里程碑数/升级数…）
>   ⇒ 本文档与各篇的状态头**不再靠人肉维护**，漂移会被测试抓到 ✓
>
> ⚠️⚠️ **数字只准出现在 `CONFIG-FACTS.md`**（机器生成）。
>   叙述性文档只写「是什么 / 为什么」，**不要写计数** —— 手抄必然漂移 ✗
>   实证：`ZONES.md` 曾写「`ZONES` 11 个 / `ZONE_OF` 50 个」而实际是 **12 / 56** ✗

---

## 📊 当前实测口径

> ⚠️⚠️ **这整张表都是 `CONFIG-FACTS.md` 的重复** —— 之所以留在这里，只是让人
>   打开索引就能看到量级；**真正的权威是机器生成的 [`CONFIG-FACTS.md`](CONFIG-FACTS.md)** ✓
>   （表里数字过期会被 `tools/config-facts.mjs` 校验抓到时…… 严格说不会 ——
>     它只校验自己的文件 ⇒ **本表过期的风险仍在**，所以只放"改动极少"的项 ✓）

| 项 | 实测值 | 权威来源 |
|---|---|---|
| 默认批跑脚本数 | **52** | `node tools/run-all.mjs --list` |
| `npm test` 结果 | **✅ 默认全绿（55 脚本）**；`--strict` 历史 8 条红灯已于 2026-11-13 修完 | `tools/run-all.mjs` |
| `--strict` 的历史红灯 | ✅ **全部修完（2026-11-13）**：M2 六条 + `dark-matter-lab` / `de-span-lab`（均为工具模型过期，非坏实现） | `docs/TODO.md` M2 |
| 版本 | **0.8.4**（`package.json` 是唯一出处） | `package.json` |
| 文档篇数 / 脚本总数 / 各类计数 | ⇒ **见 [`CONFIG-FACTS.md`](CONFIG-FACTS.md)**（机器生成） | `tools/config-facts.mjs` |

> ⚠️ **历史教训（本文件被改写的直接原因）**：
>   本文件的旧版本写着「✅ **47 个脚本全绿**」—— 而实测
>   ① 默认批跑是 **45**（不是 47；那个数是"`tools/` 下文件数"的历史口径）
>   ② **`--strict` 当时有 7 个失败**（2026 模块化后已降到 **6**，见上表），那句"全绿"**从没验证过断言** ⇒ 属于盲区，不是事实 ✗
>   ⇒ 现在所有数字都写成"**权威来源 = 某条命令**"，不再手抄 ✓

---

## ✅ 权威（有效，可作为实现依据）

| 文档 | 状态 | 说明 |
|---|---|---|
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | ✅ 权威 | ★ **模块分层 / 目录职责 / 结构预算 / 维护性评分**（2026 模块化后的唯一结构依据） |
| **[CONFIG-FACTS.md](CONFIG-FACTS.md)** | ✅ 权威（**机器生成**） | ★ **所有计数/常量的唯一出处** —— 由 `tools/config-facts.mjs` 生成并校验，与代码不同步会**测试失败** ✓ |
| **ZONES.md** | ✅ 权威 | 乘区归属（**改乘区必看**）。计数见 `CONFIG-FACTS.md` |
| **[BONUS-POSITIONS.md](BONUS-POSITIONS.md)** | ✅ 权威 | ★ **全增益落点总表（a区 / b区 / c区 / 斜率）** + 中期为什么进不了指数区；加中期增益前必看 |
| **[SPACE-EXPANSION-FINAL.md](SPACE-EXPANSION-FINAL.md)** | ⚠️ **测试中（0.8.x，待用户验收）**：SE/ST/挑战/du1~du11/页面（du7=du 自动化） | ★ **空间膨胀**：du1~du11 / SE / ST / `^0.5` 挑战；解锁 EP 1e1200，目标 1e3600；IP 倍率合规见 §2.8 |
| **ZPE-ENGINE.md** | ✅ 权威 | ZPE 引擎（含第 5 条机制：基于自身倍数提升前 8 个虚空升级） |
| **QUANTUM-MILESTONES.md** | ✅ 权威 | 量子里程碑（qm1~qm7）的定义与阈值 |
| **COLLAPSE-MILESTONES-8.md** | ✅ 已落地 | `cm1`~`cm8` **全部实装并接线**；本文保留**设计依据与理由** |
| **NEKO.md** | ✅ 权威 | N.E.K.O / 好感度（§0 状态、§3.6 已核实的 SDK 契约、§8 未决问题） |
| **DARK-MATTER.md** | ✅ 权威 | ★ **暗物质 / 第二台相变仪**（「永恒之后」第一块）：用户 2026 重写的规则、落点（暗能量倍率加法区）、形状与标定值来源。**这条意图曾丢失过一次**，本文是防丢记录 |
| **TANGRAM.md** | ✅ **已实装（2026）**：几何 / 108 图案库 / 抽取兑换 / 摆位 / 三轴加成 / 挑战 / 被动 IP；仅剩三处待裁定（见文档状态头）。设计原文在 [`TODO.md`](TODO.md) §S3 |
| **PROGRESSION.md** | ⚠️ 待同步 | 主线节奏与标尺；改动多，读到具体数值时请对代码 |
| **[BALANCE-AUDIT.md](BALANCE-AUDIT.md)** | 🔍 只读审计（2026-11-13） | 外部锐评核验：坍缩间隔=引擎步长、60s 轮 2.4e9×、引擎①被淹没、升级曲线过平、**5.80h 停摆**；只给证据与参数建议，不改代码 |

## ⚠️ 待同步（框架仍对，但**具体数值/条目**可能已被改动覆盖）

| 文档 | 需要同步的点 |
|---|---|
| **BONUS-INVENTORY.md** | 逐行读公式的产物 ⇒ 公式改过之后条目会漂移（见文首状态头） |
| **IP-ECONOMY.md** | IP 公式与量子转 IP 的现役形态；含已删体系（`铸币`/`CRUNCH_ACCEL`）的历史表述 |
| **INFINITY-UPGRADES.md** | **`ipTime` 不是"待删"、而是活的**（见文首纠正）｜`unspentBoost` 才是真删了 |
| **TODO.md** | **工作台账**（保留"当时怎么想的"）⇒ **不要**当"当前还剩什么"的清单 ✗ |

## 🗄️ 已作废 / 已归档（保留作历史，**不要作为实现依据** ✗）

| 文档/目录 | 状态 |
|---|---|
| **COINAGE-TIER-ROLES.md** | 铸币体系已删除 ⇒ **作废**（历史价值：记录过"铸币/档位"的取舍） |
| **WIRING-NETWORK.md** / **WIRING-STEP1-PLAN.md** | 接线子系统已整体删除 ⇒ **作废** |
| **RESONANCE-AND-EXCHANGE.md** | 共振 / 兑换方案（**从未实现**）⇒ **作废** |
| 🗄️ [R-REPLACEMENT.md](archive/R-REPLACEMENT.md) | R（指数成长速率）已退休 ⇒ 记录**替换过程**（历史价值高） |
| 🗄️ [DEPRECATED-INVENTORY.md](archive/DEPRECATED-INVENTORY.md) | 废弃清单（按"非设计稿内容一律视为废弃"的规则整理） |
| 🗄️ [SPACE-EXPANSION.md](archive/SPACE-EXPANSION.md) | 空间膨胀原始逐字稿（已合并进 FINAL） |
| 🗄️ [TIMESPACE.md](archive/TIMESPACE.md) | 空间膨胀 / 时空层旧稿（只保留时空外层） |
| 🗄️ [CHANGELOG-legacy.md](archive/CHANGELOG-legacy.md) | 0.6.18~0.5.1 版本历史 |
| **docs/archive/** | **已删代码的快照**（8 个 `.txt`）：`wiring.js` / `ui-wiring.js` / 两个 wiring lab / runaway lab / infinity-sim / pace-model / post-break-engine-lab |

> ⚠️ **"已作废"的文档会故意引用已删除的路径与常量**（那正是"已作废"的含义）
>   ⇒ `docs-audit` 对这些文档**只查状态头**、不查引用存在性 ✓

---

## 🧪 测试与工具现状

```
· `npm test` = `node tools/run-all.mjs` ⇒ 自动发现 `tools/*.mjs`，
  跳过 GUI/打包类（SKIP）与重诊断类（HEAVY，默认不跑，`--all` 才跑）
· `--strict` 额外跑 `--check` 定点断言（历史 8 条已于 2026-11-13 修完，见 TODO M2；`stage-timing` 单跑可通过）
· ★ 文档守卫（两件）：
    `tools/config-facts.mjs` —— 生成并校验 `docs/CONFIG-FACTS.md`（事实表）
    `tools/docs-audit.mjs`   —— 引用路径 · 脚本数量 · 标识符 · 状态头 · **计数与代码**
· ★ 结构守卫（2026 模块化后新增）：
    `tools/structure-guard.mjs` —— 文件/函数预算 · barrel 纯度 · **死模块可达性** · 分层方向
    ⇒ 规则与阈值见 [`ARCHITECTURE.md`](ARCHITECTURE.md) §3
```

## 📌 开发分工（2025 用户裁定）

```
· 「永恒环节」的后续细节**不再由 AI 开发** —— 用户自己接手
· AI 的职责边界：**维护好「无限」与「ZPE 引擎」到「永恒初期」这一段的正确性** ✓
  ⇒ 这一段内：改代码必须同步改文档；改动必须过 `npm test` + `docs-audit`
```
