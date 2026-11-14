# CHANGELOG

> 更早版本见 [docs/archive/CHANGELOG-legacy.md](docs/archive/CHANGELOG-legacy.md)。

本文件把"版本惯性"写成明文 —— 在它之前，版本号只存在于提交信息里。

约定（沿用本仓库既有惯性）：
**一个功能批次跳一位小数位，批内的小修 / 文案 / UI 走补丁号。**

---

## 0.8.6 — 插件面板全屏 + 动作闭环实测

> **公告**：插件面板里现在可以**一键全屏**（右上角「⛶ 全屏」，退出会变「退出全屏」）。
> 同时把「猫自己操作游戏」的最后一环实测补上了：
>
> · 原生聊天说「帮我升一下计数频率」→ Main 调用 `kongxiang_action`（回调 HTTP 200）
>   → 插件队列 → 游戏页 2 秒内轮询执行 → `report_result` 回执；
> · 页面快照 `multipliers.countFreq = 1.6`（= 8 级计数频率 × 1.075），确认动作真的落进了游戏。
>
> 结论：**聊天 → 模型调工具 → 插件排队 → 页面执行 → 回执** 全链路打通。
>
> ⚠️ Steam 生态已放弃，插件面板是唯一发行路径；插件仓库独立维护，版本与游戏解耦。

**这一版做了什么**

1. `index.html` + `css/amoled.css`：插件模式下显示全屏按钮（固定右上角）。
2. `src/neko/plugin-bridge.js`：启动时绑定全屏按钮，`requestFullscreen()/exitFullscreen()`，
   监听 `fullscreenchange` 更新文案。
3. 插件仓库：新增 `queue_action` entry、LICENSE、CI/tests 脚手架、实测记录
   （`kongxiang-neko-plugin`，提交 `93b6317`）。
4. 版本 0.8.5 → 0.8.6；插件 `static/` 同步到 0.8.6。

## 0.8.5 — 插件面板模式（MVP）

> **公告**：游戏现在能在 N.E.K.O **插件面板**里跑起来（Static UI），并打通了「快照 / 动作」通道。
>
> · 插件 `kongxiang_incremental`（独立仓库）用 `register_static_ui("static")` 托管全量游戏；
> · 游戏页新增 `src/neko/plugin-bridge.js`：`POST /runs` → 轮询 → `/runs/{id}/export`
>   取 `trigger_response`，带 CSRF；
> · 每 3 秒上报 `nekoSnapshotForHost(state)`；每 2 秒领取动作并执行 / 回执；
> · 猫咪侧工具：`kongxiang_state`（读快照）/ `kongxiang_action`（排动作）。
>
> ⚠️ Steam 生态已被上游放弃 ⇒ 本版起**插件面板是唯一发行路径**。
>
> 验证（本地独立插件服务器 48916）：
> `/plugin/kongxiang_incremental/ui/` 200；main.js / css / esm MIME 正确；
> `sync_state` run succeeded，export 返回 `data.ok=true`。

**这一版做了什么**

1. 新增 plugin-bridge（只识别 `/plugin/<id>/ui/`，不影响 standalone / minigame）。
2. main.js 在插件模式下启动快照/动作通道；动作仍走 `dispatchNekoActions` 白名单。
3. 插件仓库独立维护：`plugin/plugins/kongxiang_incremental/`（plugin.toml + __init__.py +
   static + sync-static.mjs），版本与游戏解耦。

## 0.8.4 — 五项修复：离线/后台计时、存档回退与导出、坏档自愈

> **公告**：这一版修的是“计时与存档”的五个真实 bug，外加两处体验：
>
> ① **离线时长扩展升级真正生效**：原来 `advance()` 内部又按基础 4h 裁了一次，
>   升级买再多也只结算 4 小时；
> ② **切后台/休眠回来按实际时长补**（受离线上限约束），不再只补 1 秒；
>   隐藏期间不再计帧，避免和补时双计；
> ③ **保存失败不再闪「已保存 ✓」**：改为右上角提示；每次成功存档留一份备份，
>   主档损坏/校验失败时自动回退并提示「已加载上一轮安全存档」；
> ④ **导出改为当前内存状态**：不再“先 save 再读 localStorage”（写失败会导出旧档）；
> ⑤ **坏档里的 Infinity/NaN 资源修成 1e308**：原来先被 `dec()` 归零，且自愈路径写成
>   `s.matter`/`s.entropy`（实际在 `resources.*`），永远修不到；
>
> 附：旧档的自动坍缩开关不再“关掉后读档复活”（迁移只在没有 `autoToggles` 键的老档做一次）。
>
> 附：本版还包含并发的 **N.E.K.O 自动化授权**（`setAuto` / `__game.nekoGrant` /
>   猫页授权勾选框，用户授权），提交见 `b8f52cd`、`8ab0de5`。

**这一版做了什么**

1. `src/engine/tick.js`：`advance(..., cap)`；新增 `hiddenCatchUpSeconds()`。
2. `src/main.js`：离线/后台补时走升级后的 cap；隐藏期间不计帧；保存失败提示；
   导出当前内存档；回退/损坏提示。
3. `src/save.js`：`lastSavedAt` 只在写成功后提交；成功写备份 `<saveKey>.bak`；
   `load()` 主档坏了先回退备份（`fallback:true`）；`clear()` 连同备份清理。
4. `src/state/serialize.js` + `src/autocrunch.js`：坏资源先判后转 → 1e308；
   自愈路径改真实 `resources.*`；旧 `autoCrunch.isActive` 迁移收窄并恒写 false。
5. `src/ui.js` + `css/amoled.css`：右上角 `showToast()`。
6. 测试：新增 `tools/offline-timing-lab.mjs`（24 条）；`save-integrity-lab` 扩到 **65 条**。

## 0.8.3 — 空间膨胀标为测试状态；文档对账与归档

> **公告**：空间膨胀页面**暂标为「测试中」**（等你亲手跑一轮再定正式上线），
> 不是正式上线；数值与实现未动（du8/du10 仍按设计暂缓）。
> 另外把两处文档漂移按当前代码改正，并把已结束的稿子移入 `docs/archive/`。
>
> · **空间膨胀状态**：UI 徽章 / 页面注释 / 文档状态统一为「测试中 · 待验收」。
> · **文档对账**：`BONUS-INVENTORY §6` 去掉已删的 `a(DE)` 衰减；
>   `PROGRESSION §2.2` 按现价重写（b0 0.0335 / a0 0.003112 / tierAccel 1.10，实测窗口 3.48h）；
>   `src/config/quantum/growth.js` 的 a0 注释同步。
> · **归档**：SPACE-EXPANSION / TIMESPACE / R-REPLACEMENT / DEPRECATED-INVENTORY
>   移入 `docs/archive/`；README 树与 README-STATUS 索引同步。

**这一版做了什么**

1. 空间膨胀：`src/space/page.js` 徽章「已上线」→「测试中」；页面注释与三份文档状态同步。
2. 文档对账：BONUS-INVENTORY §6（a(DE) 衰减已删）、PROGRESSION §2.2（当前常量与 3.48h 窗口）。
3. 归档：4 篇已结束稿进入 `docs/archive/`，相关链接全部改写。
4. 版本 0.8.2 → 0.8.3。

## 0.8.2 — strict 清零 + 存档校验 + 平衡审计 + 文档瘦身

> **公告**：这批不是新玩法，是把锐评里的债务还掉。
>
> ① **strict 清零**：`--strict` 的 8 条红灯全部修完（TODO M2 的六条 + 新发现的两条：
>   `dark-matter-lab` / `de-span-lab`），只改 `tools/`，未动游戏公式。
> ② **存档完整性**：外层加 `{formatVersion, checksum, payload}`（FNV-1a）；校验失败 →
>   保留原档 + 暂停写入（不自动覆盖）；旧档（裸档 / v1 无 checksum）兼容读取；
>   顺带补回 5 个 deserialize 漏读字段（`deAccum` / `spanDeBase` / `runElapsed` 等）。
> ③ **平衡审计**：新增 `docs/BALANCE-AUDIT.md`（只读）——实测坍缩间隔 = 引擎步长、
>   60s 轮 vs 1s 轮实测 2.4e9×、引擎①被淹没、升级曲线过平，并发现默认路径 **5.80h 停摆**；
>   只给证据与参数区间，未改数值。
> ④ **文档瘦身**：CHANGELOG 128,873 B → 60,327 B（0.6.x 及更早移入
>   `docs/archive/CHANGELOG-legacy.md`）。
> ⑤ **README 同步**：空间膨胀 / neko / 七巧板标为已实装、`em1~em8` 全部实装、脚本数 54。

**这一版做了什么**

1. `tools/`：zpe-engine-lab / cap-monotonic-lab / quantum-particle-lab / base-vs-quantum /
   ip-economy-lab / check-web-bundle + dark-matter-lab / de-span-lab 的 `--check` 全部转绿；
   `run-all --no-check` = **54 脚本全绿**。
2. `src/save.js` + `src/state/serialize.js` + `src/main.js`：存档信封 / 校验和 / 写保护 / 旧档迁移 /
   漏读字段补回；新增 `tools/save-integrity-lab.mjs`（37 条断言）。
3. `docs/BALANCE-AUDIT.md`：只读审计报告（403 行），含可复现附录。
4. `docs/archive/CHANGELOG-legacy.md`：0.6.18→0.5.1 共 10 段归档；CHANGELOG 顶部加链接。
5. 文档状态同步：README / README-STATUS / TODO M2 / TANGRAM / SPACE-EXPANSION-FINAL。

## 0.8.1 — 游戏页里的「猫猫漫游」

> **公告**：N.E.K.O 的小猫来串门了 —— 她会在游戏页面上自己溜达：走两步、发呆、
> 被你拎起来，松手掉下去还会弹一下；点她一下也有反应。
>
> **在哪看**：宿主页（`/kongxiang_demo` 或 `/static/game/games/kongxiang/`）里，
> 默认开启。`__game.nekoCatPetToggle(false)` 关、`true` 开。
> 独立打开游戏页时不会出现（猫资源由宿主提供，走 `/static/`）。
>
> **资源与物理**：直接复用宿主 `/static/assets/cat-resources/` 的 GIF 和
> `cat-resource-registry.js` 的可见区域元数据；物理是**页内坐标**
> （重力 1440 / 落地弹性 0.52 / 撞墙反弹 0.6），不碰 Electron 窗口，
> 不影响任何游戏逻辑；加载失败只写一条日志。
>
> **跟随宿主设置**：
> · 重力开关 `localStorage['neko.gravityCat.enabled']`（宿主设置，没有就默认开）
> · 外观组 `window.__nekoCatResourceGroup`（桌面 preload 注入，没有就 `dev_neko`）
>
> **这一版没做**（先把最小闭环跑通）：吃饭 / 玩毛线 / 睡觉 / 探头 / 猫叫，
> 以及桌面窗口级物理（那套要移动 Electron 窗口，页面里做不到）。

**这一版做了什么**

1. **猫猫漫游**：随机 idle（cat1~3）↔ 走动（walking GIF）↔ 被拖（drag）
   ↔ 下落（air）↔ 点击（click）；左右转身、页面边缘撞墙反弹。
2. **页内物理**：重力 / 落地弹 / 撞墙 / 拖拽释放；边界 = 视口，不碰窗口坐标。
3. **资源复用**：GIF 走宿主 `/static`，不复制进游戏包；失败静默降级。
4. **可测**：`tools/cat-pet-lab.mjs` 定点断言物理 / 可见区域换算（无需浏览器）。
5. **文档同步**：ARCHITECTURE 补 `cat-pet.js` 并把模块数更新为 88；
   CONFIG-FACTS 更新脚本总数（53 / 61）。

## 0.8.0 — 空间膨胀落地；后端 JS 整理

> **大版本**：空间膨胀从"设计草案"变成**可玩系统** —— EP ≥ 1e1200 解锁，
> 挑战内 IP 峰值结算成 SE（膨胀点数），ST（膨胀时间）由全局加成主动生产，
> du1~du11 把自动化 / 价格修正接进现有链路，页面、挑战、升级齐活。
> 同时把后端 JS 按领域收拢：`src/space/`（core / config / upgrades / ui）与
> `src/tangram/`（core / board / bonus / game / passive / patterns / reward），
> 所有相对导入重算，结构守卫 **87/87 可达**。
>
> 统计：自 `0.7.11` 起 **0 个功能提交** —— 空间膨胀的代码在此前已随提交落地，
> 本版是**大版本标记** + 目录整理（文档同步：ARCHITECTURE / TANGRAM / TODO）。
>
> 权威文档：[`docs/SPACE.md`](docs/SPACE.md)（若存在）、[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

**这一版做了什么**

1. **空间膨胀落地**：SE / ST 两种货币、挑战进入 / 退出、du1~du11 升级与自动化、
   页面（空间膨胀页）、价格修正与 DE 链路接入。
2. **后端目录整理**：`space*` 与 `tangram*` 共 11 个顶层文件收进领域目录；
   导入路径全部重算（含 tools / tests），无重复导出，无死模块。
3. **文档同步**：ARCHITECTURE 增加 `src/space/`、`src/tangram/` 两节并把模块数
   更新为 87；TANGRAM / TODO / TANGRAM-CHALLENGE-REWARDS 的旧路径一并更新。

## 0.7.11 — 每 60 秒主动搭话 + 性价比规则

> **公告**：聊天区新增"她会主动开口"—— 距上次消息 **55 秒**后、每 15 秒检查一次，
> 由她自己找话题（页面不可见 / 未连接 / 正在回复时不打扰）。三条提示词都加了
> **性价比规则**：买之前先按 `[资源] / [速率] / [进度]` 判断值不值，
> 买不起或收益明显低于主力产出时**只回台词、不动手**。
> 另外把 control 的 `type` 从硬枚举改成字符串（真正的白名单仍在派发器里）——
> 模型偶尔编错动作名时，不会再把整条台词一起丢掉。
>
> 统计：自 `0.7.10` 起 **1 个提交**（feat 1）。

**这一版做了什么**

1. **60 秒主动搭话**：`bridge.proactive()` + 聊天面板定时器；
   主动消息同样走对话区、同样会调 `speech.speak`（主窗口角色开口）。
2. **性价比规则**：聊天 / 问话 / 主动搭话三条提示词共用同一段规则
   （优先回本快的；买不起或收益低就不买；拿不准只回台词）。
3. **抗幻觉**：control.type 不再枚举校验，未知动作由派发器返回 `unknown_action`，
   台词照常显示（实测：模型编错动作名时整条回复曾一起丢失）。
4. 调试入口：`__game.nekoProactive(true)` 可立即触发一次主动搭话。

## 0.7.10 — 删掉游戏内角色渲染；对话区可滚动；所有升级可被指令调用

> **公告**：头像渲染这条路放弃（宿主对第三方游戏的 `avatar-renderer` 握手太挑，
> 投入产出不划算）—— 页面里的「她」卡片、provider 脚本与相关接口全部移除。
> 对话区改成**可滚动**（长聊天不再把页面撑爆）。
> 更实用的一项：**除梦想升级外的所有升级都能被指令调用** —— 陷阱、暗物质、IP 倍增、
> EP 倍率、ZPE 引擎、虚空 / 暗能量 / 无限升级都在白名单里，且一律由引擎函数执行。
>
> 统计：自 `0.7.9` 起 **1 个提交**（feat 1）。

**这一版做了什么**

1. **删掉头像**：`index.html` 的「她」卡片、`.neko-avatar` 样式、`host/avatar-provider.js`、
   `src/neko/avatar.js`、bridge 的 `getAvatarCharacter` / `mountAvatar`、
   manifest 的 `avatar-renderer`、页面注入的 live2d 脚本。
2. **对话区可滚动**：`.neko-chat` 加 `max-height: 420px` + `overflow-y: auto`（细滚动条）。
3. **所有升级可被指令调用**（梦想升级除外）：新增 `buyTrap` / `buyDarkMatter` /
   `buyIpDoubleMax` / `buyEpMult` / `buyZpeEngineLevel`；`buyDeUpgrade` 的 `max`
   改走 `buyDeUpgradeMax`（原来多传的参数被忽略）。
4. **契约与提示同步**：control 的 `enum` 增加上述类型、payload 增加可选 `k`；
   问话/聊天提示词都列出完整动作表。

## 0.7.9 — 修好头像握手（provider 必须在 connect 之前注册）

> **公告**：0.7.8 的头像"挂不上"，根因不是渲染失败，而是**握手时能力没授予**：
> 宿主只在 `connect` 时看 launch 节点上的 `nekoCapabilityProviders[gameId].avatarHostFactory`，
> 没有 factory 就不给 `avatar-renderer`；我们原来是在连上之后才创建 provider ⇒ 永远拿不到。
> 现在照内置游戏的做法，在 **bootstrap 之前**用经典脚本注册 factory（`host/avatar-provider.js`），
> 并且只在「她」页面可见、runtime 已 running 时才挂载，失败原因写进游戏日志。
>
> 统计：自 `0.7.8` 起 **1 个提交**（fix 1）。

**这一版做了什么**

1. **provider 前置注册**：页面在 launch JSON 与 bootstrap 之间插入 live2d 脚本 +
   `host/avatar-provider.js` + `nekoCapabilityProviders` 赋值 ⇒ 握手就能授予
   `avatar-renderer`（实测能力列表已出现）。
2. **可见才挂载**：容器宽高为 0（不在「她」标签页）时不初始化 Live2D；切过去/改窗口大小自动重试，
   直到挂上为止。
3. **原因可见**：失败写 `🎭 角色渲染失败：<reason>` 到游戏日志，徽章显示 `no-capability` /
   `no-model` / `mount-failed` 等。
4. 挂载前等 `runtime.start` 完成（`avatar.mount` 要求活跃路由）。

## 0.7.8 — 游戏内角色渲染（Live2D）+ 关闭即结束路由

> **公告**：游戏页右侧新增「她」—— 挂载宿主当前的 Live2D（照内置游戏的
> `avatar-renderer` 方式：加载宿主的 live2d 运行时 + `NekoMiniGameAvatarHost` + `avatar.mount`），
> 说话时由 SDK 自动同步口型；页面关闭/刷新时会**显式结束宿主路由**
> （不再干等 10 秒心跳超时，把模型悬在游戏态）。
>
> 说明：**原生聊天（主窗口）的文本目前不会回传到第三方游戏页** —— 宿主只把那一轮
> 跑成游戏 LLM 并让主窗口角色开口；SDK 的 drain 只分发 `control`，不分发
> `game_llm_result`。要做"两个聊天框互通"，需要宿主侧补一条事件
> （源码分支可以加，Steam 二进制版要等上游）。
>
> 统计：自 `0.7.7` 起 **1 个提交**（feat 1）。

**这一版做了什么**

1. **游戏内 Live2D**：新增 `src/neko/avatar.js` —— 按序懒加载宿主的 live2d 脚本，
   实现 `NekoMiniGameAvatarHost.create` 的槽位控制器，再走 `client.avatar.mount`；
   失败只显示"角色资源暂不可用"，不影响游戏。
2. **关闭即结束**：`pagehide` / `beforeunload` 调用 `runtime.end({reason:'page-close'})`
   并 `dispose()`，让宿主立刻释放路由（模型不会停在游戏态）。
3. **许可清单**：manifest 与页面注册都加上 `avatar-renderer`。
4. **保留聊天**：0.7.7 的对话区（历史 + 宿主摘要 + 语音）不变。

## 0.7.7 — 游戏内对话区接活（她 + 输入 + 语音）

> **公告**：N.E.K.O 页面右列的「对话」不再是占位 —— 直接打字跟她说话，她回台词，
> 需要时顺手替你操作；每条回复都会通过 `speech.speak` 让**主窗口的角色开口**。
> 桌面端想同时看见原本的 Live2D：用对话区的「独立窗口」按钮（或浏览器新窗口）打开游戏，
> 主窗口保持原样即可。连上后会读一次宿主的 `recent-chat-summary`，
> 把桌面聊天的摘要带进游戏 —— "游戏里聊"和"桌面上聊"不再是两段记忆。
>
> 统计：自 `0.7.6` 起 **1 个提交**（feat 1）。

**这一版做了什么**

1. **对话区接活**：消息列表 + 输入框 + Enter 发送 + 状态徽章（已接入 / 连接失败）；
   没有 `#neko-chat` 容器时退化成右下角浮窗，同一套逻辑。
2. **语音**：每条回复调用 `speech.speak({text})`，主窗口的 L2D 会说出来；
   没有 `speech-output` 能力时静默跳过，不影响文本。
3. **连续性**：本地最近 8 条对话 + 宿主 `recent-chat-summary` 一起进 prompt。
4. **可排查**：状态行直接显示 `connected` / 能力数 / `lastError` ——
   "对话没触发"时能一眼看出是没连上、没授权、还是宿主报错。
5. **L2D 留在主窗口**：本页不嵌模型；「独立窗口」按钮在浏览器新窗口打开本页，
   主窗口的 Live2D 不会被顶掉。

## 0.7.6 — 零宿主改动接入 N.E.K.O（便携包）

> **公告**：这一版换了一条"过江"的路 —— 不再要求宿主改代码。把游戏放进
> N.E.K.O 的静态目录即可联动：SDK 握手、对话、以及"她替玩家操作"全部成立。
> `control` 现在优先从 `dialogue.request` 的**响应**里读（SDK 已按契约校验过），
> 只有在"宿主主动推送"的场合才需要那条可选的 `/route/drain` 生产者。
>
> 用法见 [`docs/PORTABLE.md`](docs/PORTABLE.md)：`node tools/pack-portable.mjs`
> 生成便携包 → 运行 `install.ps1`（自动定位 Steam 安装目录）→ 打开
> `/static/game/games/kongxiang/index.html`。
>
> 统计：自 `0.7.5` 起 **1 个提交**（feat 1）。

**为什么这样能成（三条都验证过）**

1. **同源**：宿主 `/static` 是通用挂载 ⇒ 放进 `resources\bin\static\game\games\kongxiang\`
   的页面与宿主 API 同源，SDK 才能握手；
2. **她代操作不需要宿主补丁**：`dialogue.request` 的响应自带已校验的 `control`。
   实测：把宿主生产者整段禁用（日志 `game_control` 0 行），她仍完成了购买
   （`status:"ok"`）；
3. **不会重复执行**：响应路径与 drain 路径共用 3 秒同签名去重 ——
   两条路同时到达也只执行一次。

## 0.7.5 — 七巧板系统基本完成

> **公告**：这一版把七巧板从"能拼"补成"**能看、能对、能拿奖**" —— 挑战目标直接画在
> 棋盘上（淡淡的红色单位三角形），边框不再是墙、重置停回左侧奖励区，底部原点、
> 旋转中心与旧坐标迁移全部对齐；**11 个挑战奖励逐条审计过"确实生效"**，奖励表会高亮
> 当前档位。另含被动 IP 改为"持有峰值 IP 的 1%"、大数格式化统一（1e6 起科学计数法、
> 1e100000 起双 e 记法）、永恒面板下加空间扩展占位。
>
> 统计：自 `0.7.4` 起共 **16 个提交** —— fix 7 / feat 6 / docs 1 / revert 2，其中七巧板相关 14 个。

**这一版最值得看的五件事**

1. **挑战目标画在棋盘上了**：按玩家自己形状的 bbox 左下角对齐，用淡红色单位三角形
   铺出"还缺哪几块"；提示不再跟着玩家乱跑，固定钉在 8×8 画布的视觉中心。
2. **边框不再是墙**：块可以放到目标区外；「重置」不再把块扔进停车区，而是停回
   **左侧 4×4 奖励区**，并且标记了奖励原点。
3. **原点/旋转/旧存档全部对齐**：恢复左下原点（屏幕左中）、旋转绕自身中心；
   y 轴翻转后旧存档的摆位坐标会自动迁移，不会一读档就乱。
4. **奖励不再是"写了但没生效"**：11 个挑战奖励逐条审计，每个都实测有量；奖励表
   高亮当前档位（只由 `tangramRewardEffects` 驱动，显示与实付同源）。
5. **大数显示统一**：1e6 起强制科学计数法，1e100000 起改用双 e 记法，避免
   "一长串 0"和精度丢失。

### ★ 修手感：梦想自动买暗能量升级**太慢**（用户：「购买速度还是太慢了」）

**根因：速率绑定**帧率**，而不是游戏时间**
```
原实现：每 tick **最多买 1 级**（`k = Math.min(k, 1)`、`deGainBase` 的 for i<1）
⇒ 实际速率 = 每秒帧数：
   · 60fps ⇒ 60 级/秒（还行）
   · 6fps  ⇒ **6 级/秒**（慢 10 倍，看起来像"自动化没干活"）✗
   · 大池子（如 DE 1e100 够买几百级）被压成 1 级/帧 ⇒ 要**几千帧**才追平 ✗
（这是 2026 年初为修"每帧买满 ⇒ 每帧复利、DE 10 分钟 3e2→6e19"而加的硬限，
  它把**复利频率**治住了，但也把**吞吐**钉死在帧率上 ✗）
```

**修法：按**游戏秒**给预算（与帧率无关、仍然有界）**
```
新增 `DE_AUTO = { buyPerSecond: 1e6 }`（`config/dark-energy.js`，唯一旋钮）
`autoAcquireDream(state, dt)`：每条升级 预算 = buyPerSecond × dt，
  小数余量存 `state.deAutoCarry[id]`（**不进存档**，丢了最多差 1 级）
`autoBuyDeUpgrade(state, id, allow)`：本次最多买 `allow` 级
```

**实测（同一份 state，只改帧率；池子给足，排除资源影响）**
| 帧率 | 1 秒内每条升级的级数 |
|---|---|
| 6 fps | **999 999** |
| 60 fps | 999 999 |
| 144 fps | 999 999 |

⇒ **与帧率无关**；对照旧行为：6fps 从 6 级/秒 → **1e6 级/秒（×16.7 万）**，
60fps 从 60 级/秒 → **1e6 级/秒（×1.7 万）** ✓

### ★★ 追加：**百万级**量级的收尾（用户：「我现在的购买量级马上到百万了」）

一句话：光提速不够 —— **买满按钮和自动化的"逐级循环"在百万级会直接废掉**。
```
① 买满按钮：`main.js` 写死 `while (n < 500 && buyDeUpgrade(...))` ⇒ **只买 500 级** ✗
   实测池 1e300：deGainBase 真正可买 1663 级、convOutput 989 级 ⇒ 被截断 ✗
② 自动化：`deGainBase` 原来是"每次最多 5000 级"的**逐级累加循环** ⇒ 百万级跑不完 ✗
③ 速率：300 级/秒 追平 100 万级要 **55 分钟** ✗
```

**修法：级数改成 O(1) 闭式解（按价格段求和），买满与自动化共用一个入口**
```
新增 `deLevelsAffordable(state, id, cap)`（formulas/costs.js）
  · 等比价格：k = ⌊log_r(1 + 池·(r−1)/P₀)⌋        ← O(1)
  · deGainBase 三段（×3→×1.5→×2）：按段边界逐段解   ← O(段数) ≤ 3
  · 价格仍取 `deUpgradeCost`（唯一来源），付款 = 同一套等比和
新增 `buyDeUpgradeBatch(state, id, cap)`（engine/purchases/misc.js）
  · 「买满」按钮与自动化**共用**它 ⇒ 不可能再分叉 ✓
  · `dreamAnnihilation`（梦想点+物质、上限 10）单独走 ≤10 次循环 ✓
速率 300 → **1e6 级/秒**（追平百万级 ≈ 1 秒）
```

**实测（闭式解 == 逐级实买，含扣款）**
| 池子 | phaseShift | vacuumAccel | convOutput | deGainBase |
|---|---|---|---|---|
| 1e100 | 163 = 163 ✅ | 100 = 100 ✅ | 325 = 325 ✅ | 528 = 528 ✅ |
| 1e300 | 495 = 495 ✅ | 300 = 300 ✅ | 989 = 989 ✅ | 1663 = 1663 ✅ |
| 1e1000 | 1658 = 1658 ✅ | 1000 = 1000 ✅ | 3315 = 3315 ✅ | 4009 = 4009 ✅ |

**百万级性能**
```
一次调用买 500 万 ~ 1000 万级：**0.01 ~ 0.04ms**（O(1)，与级数无关）✓
每帧 tick 成本：自动化只加 **0.25ms**（4 条各买满 16667 级/帧）✓
复利安全（10 分钟，DE 1e20 起）：DE 1e20 → 5.21｜总级数 184 ⇒ 花完就停，不爆炸 ✓
```

**验证**
```
✅ `consistency` 新断言「暗能量升级『买满』：闭式解 == 逐级实买」——
   3 个池子 × 4 条升级，**级数与扣款**都必须一致；且百万级必须在 200ms 内完成 ✓
✅ 原「梦想自动化④：6/60/144fps 速率一致」改成百万量级（池子给到 1e2000000、
   容差改**相对 0.5%** —— 固定 ±3 在 1e6 量级会假红）✓
✅ `config-facts` 的 `DE_AUTO.buyPerSecond` 自动跟到 1000000 ✓
✅ UI tooltip 写「（100 万级/秒，按游戏时间、与帧率无关）」✓
✅ `npm test` 51 个脚本全绿
```

**⚠️ 两个被我自己的测试坑到的假象（记档）**
```
① 用 particle=1e300 造"大池子"测速率时，1 秒内买了 0 级 —— 真因是**物质一帧就顶到
   1.8e308 上限 ⇒ 强制大坍缩**（DE 被清成 1）⇒ 池子没了，不是自动化的问题 ✗
   ⇒ 测速率必须 `brokenInfinity = true` + 池子给足 ✓
② 闭式解断言第一版用"逐级上限 3000"做对照 ⇒ 真值 3315/4009 时**假红** ✗
   ⇒ 对照上限抬到 2 万；同时池子要够 1e6 级（1e400 只够几千级）✓
```

**复利安全检查（怕又回到"每帧买满"）**
```
10 分钟模拟（DE 1e20 起、四条自动化全开）：
  DE 1e20 → 5.21（被花掉）｜总级数 184
⇒ 没有爆炸：速率有界（1e6/秒），花完就停；与当年"每帧买满"（10 分钟冲到 6e19）完全不同 ✓
```

**验证（第一轮）**
```
✅ `consistency` 断言「梦想自动化④：6/60/144fps 的 1 秒级数必须一致且 ≈ buyPerSecond」
✅ `config-facts` 新增 `DE_AUTO.buyPerSecond`
✅ UI：自动化开关的 tooltip 写明速率与"按游戏时间、与帧率无关"
✅ `npm test` 全绿
```

**⚠️ 一个被我自己的测试坑到的假象（记档）**
```
用 particle=1e300 造"大池子"测速率时，1 秒内买了 0 级 —— 排查发现是**物质一帧就顶到
1.8e308 上限 ⇒ 强制大坍缩**（`resetForCollapse` 把 DE 清成 1）⇒ 池子没了，
不是自动化的问题 ✗
⇒ 测速率必须 `brokenInfinity = true`（已破∞ ⇒ 不强制坍缩）+ 池子给足 ✓
```

### 空间膨胀：核心 + du（2026-10-25）

- 永恒子页「空间膨胀」从占位文案换成真页面：SE / ST 双货币、挑战状态、目标进度、
  du1~du6 的 SE 复购卡、du7~du11 的 ST 单次卡；旧 du11 删除，新 du11 是单次
  DE 超载缓解；du8/du10 标记暂缓。
- 解锁改为 **EP ≥ 1e1200**；页面目标 **EP 1e3600**。
- `state.space` 已落盘（se/st/challenge/ipPeak/upgrades），刷新不丢。
- **挑战流程**：EP 1e1200 后随时能进；进入时自动执行一次永恒重置（保留七巧板/
  暗物质，不发 EP、不涨永恒次数），清当前/累计 EP 后进入 `^0.5` 挑战；退出后可再来。
- **SE/ST/挑战核心已接**：SE 按挑战内新增 IP 峰值增量；ST 按游戏秒生产；挑战内
  `bigCrunchGain` / `ipTime` / ST 都走唯一 `^0.5` 包装。
- **du 已接**：du1~6（SE）、du9/du11（ST）购买与效果；du4/du6 软上限；du11
  单次 1e5 ST，用当前 ST 抬高**新 DE 倍率削弱**的下限 0.3→0.95（不再接物质超载）。
  du7 改为单次解锁 du1~du6 自动购买（开关在梦想/自动化页）；du8/du10 价格侧暂缓。
- **设计结论修正**：实测挂机 EP 已到 **1e1296**，此前“静态模型爬不到 1e3600”的结论
  降级为旧起点下的敏感度示例；目标重定为 1e3600，从当前档还差约 101.5 万 IP 阶
  （见 `docs/SPACE-EXPANSION-FINAL.md` §2.7）。

## 0.7.4

> **修复批**：七巧板的**交互**（点选、重叠、旋转绕自身中心、确认完成按钮）和**存档字段**
> （`deserialize` 白名单漏了七巧板 7 个键，刷新即丢进度）一起补上；同时把永恒层的
> 自动化链路修通 —— `brokenInfinity` 改为"曾打破无限"、`v9` 跨永恒保留、陷阱价在
> 自动获取时如实显示 0，并给 `eternityGain()` 一个统一入口（面板显示与实付一致）。
>
> 权威文档：[`docs/TANGRAM.md`](docs/TANGRAM.md)、[`docs/FORMULAS.md`](docs/FORMULAS.md)。
>
> 统计：自 `0.7.3` 起共 **34 个提交** —— fix 16 / feat 7 / chore 4 / test 2 / refactor 1 / docs 1 / balance 1 / revert 2。

**本批最值得读的四件事**

1. **七巧板从"能摆"变成"能拼"**：点击选中/再点取消；`R` / `F` 对选中块也生效；
   允许重叠（重叠块渲染成红色，覆盖面积取并集，不会白送加成）；旋转/翻转改为
   **绕自身 bbox 中心**且**跳过合法性门**（原地旋转不会再被判非法）；吸附 0.2 格后
   挑战完成按整格取指纹；新增「确认完成」按钮，直接报告还差/多了几个单位三角形。
2. **刷新丢七巧板进度**：`serialize` 是全量，但 `deserialize` 是显式白名单，七个
   `tangram*` 字段一个都没写进去 —— 页面一刷新全部归零。已补白名单并做真实往返验证。
3. **"物质钉在 e200"的真凶**：`brokenInfinity` 被永恒无条件清零 ⇒ 重新武装自动坍缩，
   叠加"起始跳跃跨永恒保留"，形成每秒一次的坍缩循环（实测 140 秒 86 次）。
   改为"曾打破无限"（`infinityCount>=1`）后恢复正常；另加回归测试锁死
   （从 e200 跳变开一 tick，物质必须增长到 e11410）。
4. **暗能量不再"到顶就死"**：指数上限衰减改成过载式减速 `1/(1+over/span)` 并给
   5% 地板；谜题种子首次进入即冻结（只有空间层重掷）。顺带统一 `eternityGain()`，
   面板显示与实付不再打架（EP 乘区此前只影响实付）。
5. **七巧板边框不再是墙**：手动拖拽不再被 `CANVAS_MIN..MAX` 拦住，块可以停到目标/
   画布外（拖丢用重置找回）；重置改为把七块放回左侧 4×4 加成区（经典摆放，三轴满覆盖），不再因为
   “允许重叠”而全叠在 `(0,0)`。判定仍是目标并集 —— 目标外的块不算过关。
6. **七巧板原点/旋转中心**：棋盘 y 轴恢复翻转，原点 (0,0) 落在画布**左中**
   （SVG (0,100)），正方形仍在左上；静态三条轴同步成右/上/左下→右上。
   面板「旋转/翻转」改走 `transformPieceInPlace`，和 R/F 一样绕**自身 bbox 中心**，
   不再绕棋盘原点把块甩飞。旧存档用 `tangramCoordVersion` 一次性迁移
   （`dy→4−dy`、`rot+2`、`flip` 取反），旧块不会再跑到页面上方。
   **加成原点**仍是三条加成轴交点 `(4,4)`（右上），与摆位原点 `(0,0)`（左下）区分；按用户要求不再画视觉标记。
7. **数值格式统一**：>1e6 一律科学计数（`1.00e6`），>1e100000 指数本身也科学计数
   （`e1e5` / `e1e6`），不再出现 `1.00e100001` 这种长指数；日志 / 面板 / 升级描述都走
   `fmt` / `sci` 同一入口。七巧板右上角的「加成原点」视觉标记已删除。

## 0.7.3

> **功能批**：七巧板三条轴的上限各 ×1000（引擎 `1e7` / 转化 `1e16` / 计数频率 `5e4`）并把
> 挑战奖励真正接进产出（每个挑战 `×1+0.10n`、每 6 个一组再翻倍）；`neko.js` 907 行拆成
> `log` / `snapshot` / `actions` / `bridge` 四个模块；修掉"未闭合 `tangram-wrap` 吞掉右侧
> 面板"这个把永恒页变成空白的 HTML 结构 bug，并补上防回归检查。
>
> 权威文档：[`docs/TANGRAM.md`](docs/TANGRAM.md)、[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。
>
> 统计：自 `0.7.2` 起共 **83 个提交** —— fix 24 / docs 24 / feat 17 / refactor 12 / chore 4 / test 1 / rewrite 1，
> 其中七巧板相关 16 个。

**本批最值得读的四件事**

1. **七巧板的三条轴不再"到顶就废"**：引擎 `1e7`、转化 `1e16`、计数频率 `5e4` 各 ×1000；
   轴读数改成对数进度 + 实时加成；挑战奖励接进 `quantumPerPair`（每个挑战 ×1+0.10n，
   每 6 个完成一组再 ×2，全清额外 ×2，全部**按永恒重置**），`ipDoubleKneeMult` 也接进
   买满路径与 UI，显示与实付一致。
2. **一个 HTML 结构 bug 让整页空白**：`<div class="tangram-wrap">` 少闭合，把托盘/预览
   吞进右栏、并让左侧 `panel-tangram` 一直开着，结果永恒面板被挤没。修好后加
   `tools/html-balance.mjs`，标签不平衡不再能过 CI。
3. **自动化不再失控**：暗能量自动购买从"每帧买满"改成 1 级/250ms；暗能量自增长补上
   `DE_EFF_CAP` 软上限（knee 40 / span 30，原来 knee 300 等于从未生效）；两条自喂养
   升级封顶 60 级。顺带修了"JS `*` 把 Decimal 变成 Infinity/NaN"与梦想页卡片缓存
   （`em8` 自动化不出现 / 分组重复 / 规则条错位）。
4. **N.E.K.O 接入层收口**：`runtime.configure` 补上（不配就永不轮询 outputs ⇒ `controls`
   永远收不到）、成功判据兼容引擎三种返回约定、快照日志只留"系统解锁 + 转生层"
   （1,799 → 496 字符），并加了第 1–3 次大坍缩 / 首次永恒 / 七巧板解锁的**主动问话**。

### ★ 修复：自动无限面板——开/关是死的、阈值输入被每帧覆盖、时间阈值被抬到 1s

**症状**：
- 梦想页「无限自动化」卡里的规则条，开/关按钮点了不生效；
- 阈值输入框很难输入，刚敲的数字会被重置；
- 时间模式填 `0.1` 会被改成 `1`。

**根因**：
- 面板的 `tg-ac-on` 只翻 `autoCrunch.isActive`，而引擎只认 `autoToggles.autoInfinities`
  （`autoEnabled()` 唯一判据）⇒ 开关是**死的**；
- `syncAutoCrunchPanel()` 只看 `document.activeElement`，输入框短暂失焦就被旧 state 覆盖；
- `setAutoCrunchValue('time')` 用 `Math.max(1, ...)`，把默认 `0.1s` 抬成 `1s`。

**修复**：
- 面板开关改走 `setAutoCrunchActive()`（与梦想页卡右侧开关同一个状态）；
- 输入框加 `input` / `focus` 时间戳，1.5s 内不被 sync 覆盖；初始值从当前 state 填；
- 时间模式允许 `0.1`，与 `deserialize` 的下限一致；
- 模式按钮加稳定 id `tg-ac-mode-*`，sync 不再依赖 `querySelectorAll`；
- `consistency` 新增三模式 / 开关 / 时间输入的断言。

---

### ★ 修复：梦想（自动化）页——em8 新卡不出现 / 分组与开关重复 / 自动无限规则条嵌错位置

**症状**（用户截图）：
- 解锁 `em8` 后，IP 倍增 / ZPE 引擎 / 永恒保留 5 条卡不出来；
- 页面分组标题和开关重复；「梦想点 / 离线」下面挂了一条自动无限规则条；
- 买了 em8 自动化后不知道是否真的生效。

**根因**：
- `arrangeDreamPage()` 首次构建时没有 `state` ⇒ 只把 always 卡放进 DOM，
  `box.textContent=""` 把其余卡**物理删除**；后续 `em8`/破∞ 解锁时 `getElementById` 找不到它们；
- 重排时先 `innerHTML=""` 再让 arrange 去找卡片，等于先删后找；
- 每次重排都 `addEventListener` ⇒ 开关一次点击可能切换多次；
- `paintAutoCrunchUI()` 找不到「无限自动化」卡时 fallback 到 `dream-upgrade-list`，
  把规则条挂到页面末尾。

**修复**：
- `dream-ui.js`：模块级 `cardCache` 缓存**全部 11 张卡**；锁定卡只“不 append”，解锁时取回同一节点；
  重排不再预先清空，由 `arrange` 统一清空后重建；分组 wrap 加稳定 id；事件委托只绑一次；
  分组按 2 / 3 列分开（永恒保留 3 列，其余 2 列）；
- `ui-cache.js`：`textContent=""` / `innerHTML=""` 是**清空结构**，空字符串永不被去重跳过
  （否则第二次清空被 dedupe 吞掉，旧分组残留 ⇒ “上面和下面重复”）；
- `ui.js`：先 `renderDreamPage()` 再画自动无限面板；绑定点击时走 `getDreamCard()`（缓存节点）；
- `autocrunch-ui.js`：规则条只认 `dream-wrap-autoInfinities`，卡不可见时移除，不再 fallback；
- `dream-page-badge` 改为「已实装」；`dream-badge` 初值改为 `0 / 11`；
- `dom-smoke` 新增 em8 动态解锁断言（5 张卡 + wrap + 规则条 + 分组不重复 + IP/引擎自动买真的生效）。

**验证**：`npm test` 49/49；`dom-smoke` 全绿；`consistency` 仍 8/8 + 33/33。

---

### ★ 修复：物质「显示 == 实发」但实际不相等（显示用的是瞬时值）

**症状**：界面 `物质 +X/s` 与物质实际增长对不上；高速凝聚时偏差可达几个数量级。

**根因**：
- 界面原来调 `matterRate(state) = 粒子 × 系数`，这是 **dt→0 的瞬时速率**。
- 引擎一步实际是闭式解 `ΔM = k·(P0·dt + c·dt²/2)`（本步内新生的粒子也会产物质）。
- 两者相差 `1 + c·dt/(2P0)`；当粒子每秒被替换几十万次时，这个二阶项会反超一阶项。

**修复**：
- 新增 `matterGainOver(state, dt)`（`formulas/matter.js`）：引擎与显示侧**共用**的唯一步进函数。
- `tick` 的 ①② 阶段改为只写回 `matterGainOver` 的结果，并把 `step.rate` 记到
  `lastMatterRate`；界面直接显示 `lastMatterRatePerSecond()` —— **刚刚实际执行那一步**的速率。
- `consistency.mjs` 的物质检查用 `dt=0.05` 对照公式，并新增
  “UI 的 `lastMatterRatePerSecond()` 与本次 `ΔM/dt` **逐字相等**”断言。
- `matterRate` 保留为瞬时值（过载判据等内部用途），文档明确“不要拿它当界面速率”。

**验证**：`npm test` 49/49；`consistency` 8/8，物质 UI 显示与实测逐字相等。

---

### ★ 修复：离线结算时 `darkEnergy` / `zpe` 变成 ∞（根因 = Decimal 被 JS 的 `*` 转成 Number）

**症状**（用户控制台）：
```
[inf-sanitise] state.darkEnergy became non-finite; clamped to 1e308
[inf-sanitise] state.zpe was non-finite; clamped to 1e308
```
发生在刷新页面后的离线结算（`advance → tick → advanceDarkEnergy`）。

**根因**：
- `src/formulas/dark-energy-rate.js` 的 `effectiveDarkEnergyGain()` 最后一行是
  `return ((g) * _deKnee) * deCapDecay;`，而 `g` 是 `Decimal`。
- JS 的 `*` 会先 `valueOf()` 成 Number：`g > 1e308 ⇒ Infinity`；`g` 为 `ee…` 层 ⇒ `NaN`。
- 于是 `darkEnergyRate()` 变成非有限值，`darkEnergy` 被污染；下一帧累计量继续污染 ⇒ 每帧复发。
- 这正是 README「数值约定 #3」禁止的写法。

**修复**：
```js
return g.mul(_deKnee).mul(deCapDecay);   // 全程 Decimal
```
只改这一处，不改变数值语义。

**同时补齐守卫**：
- `engine/tick.js` 每帧净化清单改为**真实字段**（`state.resources.*`）并加入
  `darkEnergyTotal` / `zpeTotal` 等会反喂公式的累计量。
- `tools/decimal-guard.mjs` 新增运行时回归：`phaseShift = 2000` ⇒ 收益 `4.57e352`，
  `advance(state, 60)` 后四个资源字段必须全部有限。

**验证**：`npm test` 49/49 全绿；`consistency` 速率 8/8；该回归在旧写法下会报红。

---

### ★ 改名为「量子共振」+ 新增**硬上限**（用户：「跨度层重命名为量子共振，效果不变，但设立大于 1e100000 基础物质不再生效的硬上限」）

**一、改名：跨度层 → **量子共振**（机制/数值完全不变）**
```
玩家可见的全部改掉：
· 量子页面板标题、两行标签（共振幂 k / 共振乘数（物质产出））、说明段 ✓
· 徽标与状态文案（由 `matterSpanStatus().reason` 统一给出）✓
· HUD 的 perfSection 标签（性能分段表里也叫「量子共振」）✓
· 面板新增一段「硬上限」说明 —— 玩家得知道为什么会突然失效 ✓

⚠️ **内部标识符仍是 `span*`**（`DE_SPAN` / `matterSpanMult` / `matterSpanStatus` /
  `renderSpanLayer` / `state.spanDeBase`）—— 其中 `spanDeBase` 是**存档字段**，
  改名要写迁移且零收益 ⇒ 保留，并在 `DE_SPAN` 顶部写明"看到 span 就是量子共振" ✓
文档同步：BONUS-INVENTORY / DARK-MATTER / PROGRESSION / R-REPLACEMENT / TODO
  （第一次出现处保留"（原名跨度层）"，其余直接换名）✓
```

**二、硬上限：基础物质 **> 1e100000** ⇒ 共振不再生效（乘数恒 ×1）**
```
· `DE_SPAN.offAboveMatterLog10 = 100000`（唯一数据源）✓
· `matterSpanMult()` 里早退：`matter.gt(SPAN_OFF_ABOVE_MATTER) ⇒ return 1` ✓
  ⚠️ 阈值是**模块级预构造的 Decimal**（`new Decimal("1e" + 100000)`）——
     不在热路径上构造/求 log10；也不用 `pow(10,100000)`（有浮点尾巴）✓
  ⚠️ **严格「大于」**：物质正好 = 1e100000 仍生效，> 1e100000 才失效 ✓
· `matterSpanStatus()` 新增 `capped` 字段，且**原因判断把 capped 排在最前** ——
  否则会显示"已生效"而乘数其实是 ×1（本项目头号老 bug）✓
· 界面徽标新增一档：**「已失效（硬上限）」**（优先于"已生效/待超过基准/未开启"）✓
```

**验证**
```
✅ `consistency` 新断言：= 1e100000 仍生效（×100000）｜> 1e100000 失效（×1）｜
   刚过线 1e100000.0001 也失效｜`on` 与 `matterSpanMult>1` **严格同源**｜失效原因含「硬上限」
✅ `dom-smoke`「量子共振」断言扩到 5 阶段：新增「> 1e100000 ⇒ 徽标『已失效（硬上限）』
   + 乘数 ×1.00 + 状态文案含『硬上限』」，并验**边界 = 1e100000 仍显示「已生效」**
✅ 页面静态内容实测：`curl index.html` ⇒ 「量子共振」3 处、「跨度层」仅剩 1 处（"原名"说明）
✅ `config-facts` 新增 `DE_SPAN.offAboveMatterLog10` 一行（35 项事实）
✅ `npm test` 48 个脚本全绿
```

**⚠️ 一条我**没加**的断言（避免误导）**
```
本来想断言 `matterRate(越界) / matterRate(未越界) == 1/共振乘数`，
实测差了 ~1.4% —— 因为**物质本身也参与产率计算**（matterCoeff 等），
比值不是干净不变式 ⇒ 加进去会变成"看起来在守、其实噪声"的假断言 ✗
⇒ 改为只守 `matterSpanMult == 1`（`formulas.js:534` 是它唯一的产率落点）✓
```

## 0.7.2

> **功能批**：把 0.7.1 埋下的两条线接活 —— **七巧板**从"能摆"做成"能挑战 / 能奖励"，
> **自动坍缩**从"能跑"做成"可配置"（AD 三种模式 + 时间模式 + 科学计数法输入）；
> 同时补上**永恒层**的 `em7` / `em8`，修掉两处**自动化持久化** bug，并删除整个「无限挑战（IC）」系统。
> 另含 **N.E.K.O 接入层的 SDK 化**（无宿主版本：`connect()` / `contracts` / `runtime.start()`）。
>
> 权威文档：[`docs/TANGRAM.md`](docs/TANGRAM.md)、[`docs/NEKO.md`](docs/NEKO.md)、
> [`docs/TIMESPACE.md`](docs/TIMESPACE.md)（**设计草案，未实装**）。
>
> 统计：自 `0.7.1` 起共 **69 个提交** —— feat 31 / fix 17 / docs 9 / style 7 / chore 3 / revert 1，
> 其中七巧板相关 39 个。下面各节按"修了什么 / 为什么 / 怎么验"记录。

### ★★ 修 bug：梦想页**自动化升级的效果全是死的**（用户：「自动化升级都不正常工作怎么办？还不修？」）

**用户是对的 —— 四类自动化里三类从没接上过效果。三个真 bug：**

**① 4 条「自动买暗能量升级」：id 传错 ⇒ 恒不生效**
```
原代码：for (const id of dreamUpgradeEffects(state).autoBuyDe) if (autoEnabled(state, id)) …
`autoBuyDe` 装的是 **DE 升级 id**（phaseShift / vacuumAccel / deGainBase / convOutput），
而 `autoEnabled` 查的是 `state.dreamUpgrades[id]` + `autoToggles[id]` ——
那两个 key **永远不存在**（梦想 id 叫 autoPhase / autoVacuum / …）⇒ 恒 false ✗
开关写的是 autoToggles.autoPhase，引擎读的是 autoToggles.phaseShift ⇒ 也对不上 ✗
```
**修法**：遍历 `DREAM_UPGRADES`，用**梦想 id** 判"已买 + 已开"，再用 `effect.deUpgrade` 真正购买 ✓

**② `autoInfinities`：有**两个开关**，梦想页那个是摆设**
```
引擎原判据：`state.dreamUpgrades.autoInfinities === true`（**买下就自动坍缩**）
 ⇒ 梦想页 `autoToggles.autoInfinities` **完全被无视** ✗
 ⇒ 而自动坍缩面板上还有第二个开关 `autoCrunch.isActive` ⇒ 两个开关互不同步 ✗
```
**修法**：统一成**一个开关** = `autoToggles.autoInfinities`（走 `autoEnabled`）✓
- 自动坍缩面板的「开/关」按钮改成写同一个 toggle（原来写 `isActive`）
- 老档迁移：`deserialize` 时若 `autoCrunch.isActive === true` 且没有新 toggle ⇒ 置为 true ✓
  （原来开着自动坍缩的玩家升级后仍然开着）

**③ 三条「永恒保留」（被动）：`applyEternityKeeps()` 从来没被调用**
```
keepDeEternity / keepVoidEternity / engineAtStart —— 写好了、engine.js 也 import 了，
但**一次都没被调用** ⇒ 买了等于没买 ✗
另外它们的判据错用 `autoEnabled`（要求 autoToggles[id]），而它们是**被动型**、
梦想页根本不给开关（见 dream-ui 的 AUTOMATION_IDS 只有 7 条）⇒ 恒 false ✗
```
**修法**：
- `doEternity` 开头**拍快照**（darkEnergy / voidUpgrades / zpeMilestones），
  重置完成后调 `applyEternityKeeps(state, snapshot)` 写回 ✓
- 三条判据改用 `hasMilestone`（**已买即生效**，与「永恒保留（被动）」的组名一致）✓
- 删掉 `doEternity` 里那行 ad-hoc 的 `engineAtStart`（`zpeEngineLevel = D(1)`）——
  统一由 `applyEternityKeeps` 负责（两处实现必然分叉）✗

**验证（三层，全部实测）**
```
① `consistency.mjs` 新增 3 条断言：
   · 4 条 autoBuy：开关开 ⇒ 自动买（phaseShift 63 级 / vacuumAccel 40 / deGainBase 187 / convOutput 126）
                   开关关 ⇒ 一级都不买 ✓
   · autoInfinities：开关开 ⇒ 判据 true｜关 ⇒ false（旧字段 isActive 不再参与）✓
   · 三条永恒保留：买了 ⇒ 暗能量/虚空升级/开局引擎 Lv1 都保留｜**没买 ⇒ 照常清零**（对照组）✓
② 真实浏览器（同一份模块）：15 条断言全绿，见截图
③ npm test ✅ 47 个脚本全绿
```

**⚠️ 断言里踩到的两个"假红/假绿"（都记档了）**
```
· 假红①：测试状态给 matter=1e40 ⇒ 量子层激活 ⇒ 捕获量子会 `state.zpe = 0`
        ⇒ `vacuumAccel`（ZPE 计价）根本轮不到买 ✗ ⇒ 改成 matter=1e10 + `eternityCount=3`（em3 豁免）✓
· 假绿②：探针里把手写 `1e280` 当永恒门槛，而门槛早已是 **1e308.25**
        ⇒ `doEternity` 直接 return null、什么都没重置 ⇒ "保留"断言全部**假绿** ✗
        ⇒ 用 `ETERNITY.goalLog10` 取门槛 + **断言 `doEternity` 不为 null** ✓
        （是对照组「没买 ⇒ 照常清零」把这个假绿抓出来的）
```

### ★ 修 bug：**永恒前**梦想升级不刷新（用户报：「主控台下子页面中梦想（自动化）永恒前梦想升级未正常工作」）

**症状（实测复现）**
```
传入 state：peakMatter=1e10（< 门槛 1e25）｜dreamPoints=1000
卡片实际显示：花费 1.00 梦想点（持有 3.00）   ← 1000 点，却写"持有 3.00"
```
⇒ 不只是"不刷新"，而是显示**上一份 state 的陈旧数字**；`affordable` 高亮也停在旧值，
玩家看不出买不买得起、买了也没反馈。

**根因：梦想卡片有**两个渲染器**，其中一个被量子页的门控挡住**
| 元素 | 原写入点 | 是否受门控 |
|---|---|---|
| 价格 / `affordable` / `disabled` | `ui.js` 的 `renderQuantum()` **内部** | ❌ 受 `if (!showContent) return`（`peakMatter ≥ 1e25`）|
| 等级文字（未购买 / 已购买·未开启） | `dream-ui.js` 的 `renderDreamPage()` | ✅ 不受 |

⇒ 永恒前那段循环**一次都不执行**，"等级会变、价格不动"的诡异现象由此而来 ✓
（同一类坑本项目踩过：跨度层也曾因为写在 `!showContent` 之后而永不刷新）

**修法：收口成唯一渲染器 + 与页面门控彻底解耦**
```
· `dream-ui.js` 的 `renderDreamPage(state)` 接管**全部**：价格 / affordable /
  `disabled` / 等级 / 可重复升级的 `Lv n / max` / 页头 `dream-badge` ✓
· 等级与价格走 `dreamUpgradeLevelOf` / `dreamUpgradeCostAt`（唯一入口）✓
· `ui.js` 里那段 legacy 循环**整块删除**（双写是"显示 ≠ 实发"的老根源）✗
· 调用点从 `renderTangram()`（**七巧板**，永恒期页面）搬到 `render()` 主流程，
  **无条件**调用（与 `renderFloatResets` 同一处）⇒ 不再被任何页面牵连 ✓
```

**验证（三层）**
```
① 单测：`consistency` 全绿（梦想升级价格/一次性断言未受影响）
② DOM 冒烟新增断言（先写断言复现 → 再修）：
   「梦想升级(永恒前)」peakMatter=1e10 时 11 条卡片 affordable 与价格一致、
   价格含「持有」、等级文字正确、可重复升级 Lv3 ⇒「Lv 3 / 12」+「花费 16.00（持有 1000）」✓
   ⚠️ 这条断言同时守住"**价格必须与传入 state 精确一致**"（原 bug 就是不一致）✓
③ **真实浏览器端到端**：写存档（peakMatter=1e10、1000 梦想点）→ iframe 载入真游戏 →
   点开「主控台 → 梦想」→ 读卡片：11 条全部 affordable=true、价格「持有 1000」、
   `dream-badge = 0 / 11` ⇒ ✅ 正常刷新
```

### ★★ 删除「无限挑战（IC）」整个系统（用户裁定）

**用户原话**
```
「我发现无限挑战做不做都不影响我永恒了……把无限挑战（和相关的）删了」
```

**删除范围（整块，非半删 —— 本项目最忌讳半删）**
| 层 | 删掉的东西 |
|---|---|
| UI | `src/ui-ic.js` **整个文件**（160 行）｜`index.html` 的 `#ic-host` 块｜浮出菜单里的「· 无限挑战」字样 |
| 配置 | `INFINITY_CHALLENGES`｜`icEntropyMult()`｜`icIpJumpMult()`｜**`IC_MODS` + `icMod()`**（"挑战中引擎生效等级压到 1"的修饰器） |
| 引擎 | `startInfinityChallenge` / `abandonInfinityChallenge` / `icCompleteOnCrunch` / `icAutoAdvance`（尾部 90 行）｜`tick` 与 `doBigCrunch` 里各 1 处调用 |
| 状态 | `state.ic`｜`state.icAutoTimer`｜`state.fastestInfinitySec` |
| 公式 | `formulas.conversion()` 里 `threshold.mul(icEntropyMult(state))`（IC 放大熵需求） |
| 其它 | `ui.js` 的 import/缓存 id/`buildIcUI`/`renderIc`/`perfSection("IC 面板")`｜`neko.js` 的 `/无限挑战/` 日志分类｜`tools/ic-lab.mjs` + `tools/ic-ladder-lab.mjs` |

**⚠️ 两个连带决定**
```
① em7（永恒里程碑 7）的**唯一内容**就是「按最快无限速度自动完成无限挑战」
   ⇒ IC 一删，它没有任何效果。
   我**没有替用户决定删它**（永恒里程碑属用户自己的开发范围）⇒ 问过之后按 **B 方案**：
   **退回 `pending: true`** + `pendingWhy` + 新的 desc，等用户给新效果 ✓
   （删掉会动里程碑编号 8→7 与老档达成状态，风险更大）

② `state.fastestInfinitySec` 只服务 em7 的 IC 自动化 ⇒ 一并删除
   ⚠️ 但**代码里没有任何"梦想页解锁依赖 IC"的判定** —— 实测确认 ⇒
     删 IC **不会**让任何页面变得不可解锁 ✓
     （`docs/TODO.md` 里那句"梦想页解锁 = 第一次完成无限挑战"是**过期文档**，已一并更正）
```

**顺带发现：还有第二块 IC 子系统（差点漏成"半删"）**
```
`IC_MODS` + `icMod()` —— 「IC 第 5 关引擎生效等级恒为 1」的修饰器，
被 `effectiveEngineLevel()` 读取（那是"看引擎效果"的唯一入口，多处依赖）
⇒ 修饰器删除，但 **`effectiveEngineLevel()` 保留**（它的价值是"收口"，
   以后若有类似修饰器只改一处）⇒ 现在恒等于真实等级 ✓
```

**验证**
```
· 老存档兼容：`deserialize` **明文忽略** `raw.ic` / `fastestInfinitySec` / `icAutoTimer`
  （不读、不迁移、不报错）⇒ 老档不会崩 ✓
· 工具：删 2 个 lab；改 consistency（去 em7-IC 断言）/ dom-smoke（去 IC 挂载守卫与
  neko 用例、删「缺失的 id」误报）/ docs-audit（去掉 `INFINITY_CHALLENGES.max` 那行，
  否则 `TypeError: …reading 'max'` 直接崩）/ config-facts（去掉 IC 两行）✓
· 文档：TODO 的 D3 标删除、梦想页解锁条件更正、菜单文本、neko 枚举计数；
  DEPRECATED-INVENTORY 把 IC 记入"曾实现过、2026 删除" ✓
· `npm test` ✅ 47 个脚本全绿｜`config-facts` 34 项一致｜`docs-audit` 一致 ✓
```

**⚠️ 本次踩到的一个环境问题（必须记）**
```
编辑过程中，`src/config.js` / `src/engine.js` / `src/formulas.js` 与两个 lab
**被外部进程整批还原了 4 次**（时间戳同一秒批量写回：20:29:04 / 20:33:31 / 20:34:55）
⇒ 症状是"我明明改了、跑测试却是旧代码"。
⇒ 对策：**每改一处立刻 `node --check` + grep 复验**，最后再做一次**延迟复核**。
   若你本机有 OneDrive / 编辑器自动还原 / 文件同步在跑，建议先暂停它再改代码 ✗
```

## 0.7.1

> **功能批**：第三层设计稿「**永恒之后**」的第一块 —— **暗物质 / 第二台相变仪**，
> 外加同批完成的 **七巧板系统**（`em8` 永恒自动化之后的新层，对标 AD 的时间研究树）。
> 权威文档见 [`docs/DARK-MATTER.md`](docs/DARK-MATTER.md) 与 [`docs/TANGRAM.md`](docs/TANGRAM.md)；
> 验收工具 `tools/dark-matter-lab.mjs`。
>
> ⚠️ **关于编号**：本批工作原先在草稿里记为 `0.7.0`，但**暗物质与七巧板是同时做完的**，
> 故合并为 **`0.7.1` 一次发布**，`0.7.0` 从未发布、不占用版本号。

### 机制：`em4`「**优化暗能量获取公式**」落地（设计稿第 40 行那半句，此前一直欠着）

- **用户 2026 裁定**：「我选择那个**能减时间最少**的方案，即刻执行」
  ⇒ 从候选表（见 `docs/DARK-MATTER.md` §8-1）里选中 **−1.9 分** 的那一行 ✓
- **落点**：`DE_UPGRADES.deGainBase.em4EffectMult` —— 相变增幅的每级倍率 **`1.10` → `1.12`**
  - **唯一入口** `deGainBaseEffectMult(state)`：**实发**（`darkEnergyGainPerConversion`）／
    **S 判据**（`computeS`）／**显示**（`deGainBase.desc`）三处共用 ⇒ 显示 == 实发 ✓
  - ⚠️ 它是 **em4 的效果**（挂里程碑），**不是全局改数** —— 依据就是 em4 文案的「**优化**」二字；
    不传 `state` 的旧调用点读到的永远是 `1.10` ⇒ 对既有 S 数字与全部工具**零回归** ✓
- **实测手感（刻意保守）**：基线首次永恒 5.62 h ⇒ 只省 **1.9 分钟（0.56%）**
- **S 判据**：无 em4 = `0.726282`｜有 em4 = **`0.770721`**（两者都 < 1 ✓ 余量 0.229）
- **新增 3 条断言**（`tools/eternity-lab.mjs` 的 `④b` 系列）：倍率挂载正确、
  **真的流到实发**（比的是 `(1.12/1.10)^等级 = 1.197439`，只改配置不改实现会当场红 ✗）、
  S 在两态都 < 1
- 顺手修掉 `eternity-lab` 的一处「注释说不许手写、代码却手写」的断言计数
  （加完本条后从"12 条"漂到"15 条"）⇒ 现在**真的从 `ck()` 调用次数推** ✓

### UI：**七巧板页面骨架**（永恒的子页；机制列为代办）

- **用户 2026**：「七巧板系统列为代办，因为这个玩意的复杂度不亚于再开发一个系统……
  **但你可以先把七巧板作为永恒后的子页面开发出来**」
- `index.html`：**永恒标签改成第五组悬浮子页**（`tab-wrap-eternity` ＋ `tab-flyout-eternity`）：
  「永恒升级 · 里程碑」＋「**七巧板**」；新增 `panel-tangram`
- `src/ui.js`：`TAB_PARENT.tangram` / `SUB_WRAP.tangram` / `ALL_PANELS` ＋
  `renderTangram(state)` —— **只报告 `em8` 是否达成，并明说机制未实现**（不许假装有进度 ✗）
- `tools/dom-smoke.mjs`：子页守卫从「四组」升级为**五组**（含 tangram 的切换验证），
  面板 emoji 白名单升到**八个**面板
- ★ **版式（用户 2026 指定）**：**左右布局** —— 左 = **坐标轴**（目标正方形 ＋ 三条轴 ＋ 覆盖率读数），
  右 = **巧板托盘（约占 15%）**，下方 = **拼装挑战**（走**阈值逻辑**，但图案/阈值未定 ⇒ 暂列代办）
  - 坐标系：原点 = 正方形**左下角**；三条轴 = 左边缘 / 下边缘 / 主对角线
  - 覆盖率高亮用 `stroke-dashoffset` 驱动（形制同暗物质的环）；现在 dashoffset = 全长 ⇒ **看不见**，
    读数一律 `—`（**不写 0%** —— 机制未实现就不许假装有覆盖 ✗）
- `tools/dom-smoke.mjs`：**新增版式守卫**（钉住右列 `15%` / **坐标轴 ≥760px** /
  **没有假装有覆盖率** / 三条轴 / 七个槽位 / 挑战节），并已做**三次反向测试**：
  `15%→20%`、`950px→190px`、`dashoffset 141.42→70` 均当场红且诊断精确；还原经哈希校验**字节精确** ✓
- ★ **坐标轴尺寸（用户 2026）**：「加成坐标轴太小了，大小**翻 5 倍**差不多」⇒ `190px → 950px`
  ｜随后用户二次调整「以当前尺度**缩小约 10%**」（并声明是最后一次动版块）⇒ **`855px`**（守卫门槛 ≥760px 仍满足）
  - ⚠️ **尺寸与线宽耦合**：`stroke-width` 是 viewBox 单位 ⇒ 放大 5 倍线会粗 5 倍 ✗
    ⇒ 线宽同步缩 5 倍（`2→0.4` 等）以保持屏幕粗细不变；⚠️ 二次那 10% **有意不再动线宽**（低于感知阈值）
  - ⚠️ **不能用** `vector-effect: non-scaling-stroke`：它会让 `stroke-dasharray` 也变成屏幕像素
    ⇒ 覆盖率高亮的 dash 数学（全长 `100/141.42`）会算错 ✗
- ★ **三条轴的端点实测（2026）**：真引擎 · 同一状态分叉 **14 轮永恒** ⇒
  **纵轴 0.0**（否掉）｜**横轴 ×1e14 ⇒ 中期 −4.9%**｜**斜轴 ×1000 ⇒ 中期 −12.8%**（最强）
  - ★ 中期是**平台**（基线 R7~14 稳定 2.9~3.3 h/轮，不再随轮次加速）⇒ 正是需要机制去压缩的形状
  - ⚠️ 但端点合计只压 5~13% ⇒ "贯穿中期"**必须**由覆盖率斜坡 + 拼装挑战奖励共同承担（光靠轴不够）
  - 详见 [`docs/TANGRAM.md`](docs/TANGRAM.md) §0.2
- 机制本身（覆盖率内核 / 三条轴 / 拼装 / 概率 / 挑战）**全部未实现** ⇒
  设计、待定项与**开发主旨**见 [`docs/TANGRAM.md`](docs/TANGRAM.md) ✓
- ★ **开发主旨（用户 2026）**：对标 AD 的「时间研究树 + 永恒挑战」。
  ⚠️ **范围已由用户二次裁定**：**前期末 → 贯穿中期 → 送到永恒后期的门口**
  （与 `em8` 解锁点对齐 —— 见 `TANGRAM.md` §0.2；先前的"充斥整个永恒前期"已作废）
  ⇒ 巧板要能"一个一个从早期拿到"、挑战分层、三条轴收益随覆盖率**连续**增长
  （⚠️ 明令禁止做成"集齐 7 块才给全额"的开关 ✗）

### 暗物质 / 第二台相变仪（设计稿第 50~52 行的落地）

- **解锁**：永恒里程碑 **em4**（第 4 次永恒）—— 设计稿第 40 行把两者写在同一句
- **获取**：消耗**永恒点（EP）**，等比价格 `1·3^n`（首价 1 EP）
- **落点**：暗能量倍率（`darkEnergyMultiplier`）的**加法区**，与既有 `q²` 同一个池子
- **形状**：`T = 1 + min( effectCoeff·((log10(1+余额))^(n^effectNExp) − 1), effectCap )`
  - `effectNExp = 0.32`｜`effectCap = 1e12`｜**`effectCoeff = 30000`** —— 三个数都是 **`--calibrate` 真引擎标定**的
    （推导见 `docs/DARK-MATTER.md` §3）
  - 实测（第 5 轮同状态分叉，对照无暗物质的 3.72 小时）：
    `n=2 ⇒ 7.2%`｜**`n=4（40 EP）⇒ 10.4%`**｜**`n=7（1145 EP）⇒ 13.6%`**｜
    `n=10 ⇒ 15.6%`｜撞顶区 `n≥30 ⇒ 21.8~25.1%`，且**无 runaway**（硬封顶把项锁在 1e12）
  - ⚠️ 它是**尖峰**不是长坡（`n ∈ [2, 10]` 走完从有感到撞顶）—— 结构性质，见文档 §3 二·六
- **第二台相变仪**：速度 = 第一台速率 `^0.01` × 暗物质个数 `^0.25`；
  用**效率形式** `转化值 = 1 + (T−1)·min(1, v2/v2Ref)` ⇒ 有界、`v2` 不需要封顶
- **读的是暗能量「余额」**（不是终身累计）—— 用户裁定：累计无界、更容易爆
- **新状态字段**：`eternityDarkMatter`（**不随永恒重置**）、`v1Log10`（第一台速率的 log10 快照）
  - ⚠️ 字段名**刻意不用** `darkMatter`（那是已删除的「临界坍缩 → 暗物质」的旧键，
    `state.js` 明文忽略它 ⇒ 复用会让老存档白得一批）
  - ⚠️ `v1Log10` 是**快照**：现算 `darkEnergyRate()` 会成环
    （`… → darkEnergyMultiplier → v2 → darkEnergyRate`），且换 `zpeRate` 同样成环
- **UI**：暗能量改为**第四组悬浮子页**（相变仪 / 里程碑 ＋ **暗物质**），
  与虚空科技 / 无限 / 主控台同一形制；新面板 `panel-darkm`
- **工具**：新增 `tools/dark-matter-lab.mjs`（参数表 + **32 条断言** + `--calibrate` 真引擎标定）；
  `tools/stage-timing.mjs` 抽出 `greedyPlay()` 供复用（行为逐字不变）
- **守卫**：`dom-smoke` 的子页守卫从「三组」升级为**四组**（写成会真报红的版本），
  面板 emoji 白名单加入 `panel-darkm`

### 一条长期设计原则（本次确立）

> **暗物质 / 第二台相变仪不许动游戏的 `a` / `k` / `b`** —— 指数型杠杆是
> **量子跨度层独占的特例**；其它机制必须靠**自己的数值**做出效果。
> ⇒ 兑现方式是调**机制自己的** `effectNExp` / `effectCap`，而不是去动 `a`/`k`/`b`。

### UI：**第二台相变仪的动态环**（用户要求：形似第一台）

- `index.html` 的 `panel-darkm` 加了一组 `ring-row`（`darkm-ring-wrap/fill/pct/progress`），
  形制与第一台的 `de-ring-*` **逐字同源**：`r = 42` ⇒ 周长 **263.9**，
  填充由**行内 `strokeDashoffset`** 驱动（不用 CSS 变量 —— 两台驱动方式必须一致，否则调一处忘一处 ✗）
- ⚠️⚠️ **环的含义与第一台不同，这处必须想清楚**（否则就是"自创一套 UI" ✗）：
  · 第一台 = 「攒够 1e8 ZPE 转一次」的**累积进度**（有 `deAccum`）
  · 第二台**没有累加器**（实现是效率形式、转化为瞬时）⇒ 若照抄一个"攒进度"的环，
    那环就在**画一个不存在的机制** ✗
  ⇒ 所以画的是**真实存在、且真的在动**的那个量：**当前转化值相对效果封顶的对数进度**
  `pct = log10(1 + 项) / log10(1 + effectCap)`（项横跨 12 个数量级 ⇒ 必须对数刻度）
  ⇒ 它**每次大坍缩都会归零重扫**（余额被 `resetForCollapse` 置回 1）⇒ 真的动态 ✓
- **新增 dom-smoke 守卫（`第二台动态环`）**：三档严格单调 + 两端取到 0% / 100%
  ```
  余额 1        →   0% @ 263.9  （空）
  1e3950, n=4   →  84% @ 42.18   （项 1.21e10，与文档记的 n=4 峰值**逐位一致** ✓）
  1e3950, n=122 → 100% @ 0       （撞 effectCap）
  ```
  ⚠️ 顺带记一条：**第一台的环 `de-ring-*` 从来没有任何断言** ⇒「它会动」这件事一直
  没被验证过（也可能是死的）。本次只补了第二台 —— 第一台那条**建议也补**（未做）。

### 修 bug：永恒门槛 `1e280` → **`1e308.25`**（用户报）

- **`ETERNITY.goalLog10`：`280` → `308.25`** —— 这一个常量**同时**是「能不能按永恒」的门槛
  和 `eternityPointGain()` 的起点。原先写 280（理由记为"比 AD 早"），
  但**界面文案 / `docs/` / `stage-timing` 的标签一直写的是 1e308.25** ⇒
  又一处「显示 vs 实际」不符 ✗ ⇒ 用户裁定统一到 **308.25**（= AD 的 1.79e308）
- 门槛处仍然**正好 1 点**：`5^(308.25/308 − 0.7) = 5^0.3008 = 1.62 → floor 1` ✓
- **节奏影响极小**（实测）：`stage-timing` 的永恒门槛 **5.43 h → 5.46 h**（+1.8 分钟），
  最终 IP 1e280 → **1e309** —— 因为末段 IP 是复利加速的 ✓
- 连带修掉两处**写死门槛**的测试夹具（`tools/eternity-lab.mjs` 的 `pow(300)`、
  `tools/dom-smoke.mjs` 的 `1e300`）⇒ 改为从 `ETERNITY.goalLog10` 取，
  否则下次再动门槛会原样重犯 ✗

### 修 bug：`config-facts.mjs` 把「**无法测量**」当成了「**测得 `-` 分**」

- 症状（实测触发）：沙箱禁止**管道 stdio** ⇒ `execFileSync` 抛 `EPERM` ⇒
  `defaultRun` 留在字符串 `"-"` ⇒ 一次 `--write` 把 `**-**` **写进权威事实表**（污染 ✗），
  而校验模式拿文件里的 `-` 与代码算出的 `-` 一比 ⇒ **假绿** ✗✗
- ⚠️ 这与「文件访问被拒」是**两套**限制 —— 修 ACL 治不了它（本次实测确认）
- 修法：`null` = **未能测量**（与「测得 0」彻底区分）；此时
  ① `--write` **沿用文件里已有的值**（并打印"未重新测量"警告），没有可沿用值时**拒绝生成**；
  ② 校验模式**明说这一项没有被真正校验** ⇒ 不再制造假绿 ✓

### 平衡：**量子铸币 `^2` → `^1.75`**（用户报「效果有点过于强了」）

- `INFINITY_UPGRADES.ipFromQuantum.power`：**`2` → `1.75`** —— 指数从**硬编码的平方**
  改到**升级定义里**（单一数据源，`quantumToIPGain()` 读它）✓
- 实测收益变化（同一量子数）：`q=83 ⇒ 6889 → 2282`（−66.9%）｜
  `q=138 ⇒ 19043 → 5556`（−70.8%）｜`q=1000 ⇒ 1e6 → 177827`（−82.2%）
  ⇒ **量子越多砍得越狠**（`q^1.75/q² = q^(−0.25)`），正是"过于强"的那部分 ✓
- ⚠️ 精度纪律：**整数指数不能用 `Decimal.pow`**（`pow(5,2)` 会给 `25.000000000000007`）
  ⇒ 实现按指数**分路**：整数走 `powExactInt`（精确），非整数才用 `.pow()` ✓
  （所以若将来改回 `2`，会自动回到精确路径）
- 新增 **4 条断言**（`tools/audit.mjs` 的 `D2e` 系列）：独立用 `Math.pow` 复算、
  指数与 `power` 同源、未购买恒为 0、**`desc` 里的指数必须等于 `power`**（防"显示 ≠ 实发"）✓
- ⚠️ 已知缺口（**未修**）：∞ 升级卡用的是静态 `cfg.desc`，而 `ui.js` 的 `effectText()`
  只服务 REPEATABLE 卡 ⇒ **铸币的实际点数界面上看不到**（`ui.js` 里那个
  `quantumToIPGain` import 因此一直无人调用）。要显示得扩 ∞ 卡的渲染路径 —— 待用户定夺。

### 记录一条踩过的坑（写测量工具时）

`--calibrate` 头两版都量错：① 分叉点取在 `doEternity` **之前**（`eternityCount` 还没 +1
⇒ 暗物质锁着）；② 跑完那一刻往往**刚坍缩过** ⇒ `v1Log10` 与暗能量余额读到的都是重置后的极小值。
⇒ 一律改读**轮内峰值**。这是 `docs/TODO.md` J4「合成长时标状态不可信 / 测量工具反复出错」的又一例。

---
