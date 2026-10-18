# TODO 已完成章节归档（2026-10）

> 来源：`docs/TODO.md`。这里存放**已经完成、但保留"当时怎么想的"**的章节。
> 搬运规则：原文逐字保留，只在 `TODO.md` 原地留一行指针；要回滚直接 `git revert` 这次提交。
> 生成时间：2026-10-18。
>
> **⚠️ 归档后的状态补充**：P9 里写的「SDK 连接（真握手）⏳ 仅差注册」**已于 2026-10-18 完成** ——
> `connect()` / `contracts` / `runtime.start()` 已实装，并用本地 N.E.K.O 宿主进程做了端到端验证
> （握手、能力、契约、状态、事件全绿）。注册表仍是唯一的对外阻塞点，PR 材料见
> `_dsh-tools/PR-kongxiang-mini-game.md`。

---
## D9. 本轮新增：永恒升级「永恒增幅」（第三层设计稿 33~35 行）✅

> **用户裁定**：「目前这个会话这个阶段理论上结束了**无限-永恒**的开发」
> ⇒ 本轮补上本阶段最后一块真正缺失的开发内容 ✓

**设计稿原文**：「永恒升级面板：将最终获得的永恒点 *5（价格初始 1ep，每次购买后 *5）」

| 落点 | 实现 |
|---|---|
| `config.js` | `ETERNITY_UPGRADES.epMult` + `epMultPriceAt` / `epMultFactor` / `epMultAffordableIn`（**价格与效果各只有一处实现** ✓） |
| `state.js` | 新字段 `epMultLevel: 0` + 反序列化（旧档默认 0 ✓）；**不随永恒重置** |
| `engine.js` | `doEternity` 里 `gained = eternityPointGain(...).mul(epMultFactor(state))`；新增 `buyEpMult(state, k)` |
| `index.html` | 永恒面板新增「永恒升级」小节（单按钮 + 买满）|
| `ui.js` | `renderEternityUpgrades`（与实发同源）+ 乘区上色；新增 `ZONES.eternity` / `ZONE_OF.epMult` |
| `main.js` | `onBuyEpMult(max)` |
| `consistency.mjs` | **3 条断言**：价格序列精确 / 买满==逐级 / 永恒时实得 EP == 基础×倍率（且等级不重置）✓ |

**实测闭环**：
```
价格 1 → 5 → 25 → 125 → 625 → 3125 → 15625 ✓（精确整数）
效果 5^等级：等级 0/1/2/3 ⇒ 永恒实得 EP 1/5/25/125 ✓
买满 == 逐级实买（5 个池子全一致，1e6 ⇒ 9 级）✓
永恒不重置 epMultLevel ✓
```

⚠️ **实现中修掉的一个自己埋的 bug（同类，第 2 次）**：
```
`Decimal.pow(5, 2)` 给 **25.000000000000007**（不是 25）✗ —— 价格/倍率都是玩家天天看的数字
⇒ 改成整数幂 `Math.pow(5, n)`（n 是整数且实际到不了几百）⇒ 精确 ✓
教训：**"看起来精确"的 Decimal 幂在某些底数上会漂移**；显示用的数字要用整数幂 ✗
```

---


---

## K. 本轮已修的 bug（存档，防复发）

| # | bug | 根因 | 防复发 |
|---|---|---|---|
| 1 | **① 那一行数值不更新**（你报的：「购买一次后仍显示 ×1」）| 循环里 `$(\`inf-btn-${id}\`)` 取不到 ①（壳 id 是小写 d 的 `inf-ipdouble-row`）⇒ `if (!btn) continue` **每帧跳过它** ⇒ `state`/`cost`/`max-n` **从没被渲染** | `dom-smoke` 新增断言「① 行数值更新」（已验证：禁掉渲染块就报红 ✓）|
| 2 | **`ipDouble` 价格形状**：三次方累计 ∝ L⁴ ⇒ 级数 ∝ 池^0.25 ⇒ 1e28 池买到 **2.4 亿级** | 幂次价格追不上 IP 池增长；且"首价可读"与"满级卡住"在幂次下**不可兼得** | 改成 **AD 式两段指数**（见 F 段基线）|
| 3 | **`v3` 少了 `voidBoostMult`**（"显示≠实发"第四例）| `matterCoeff` 与 `matterRate` 各算一遍 | 已统一为**唯一入口** `matterCoeff` |
| 4 | **衰减乘了两次**（`overload`/`climb` 既在 `matterCoeff` 又在 tick）| 移动落点后忘了删旧的 | `consistency` 报 2.32% 误差时抓到 ✓ |
| 5 | **`Math.pow` 下溢成 0** | `d(Math.pow(1.2,−12687))` ⇒ number 域下溢 | 改用 `Decimal.pow`（项目早有此规矩）|
| **6** | **`ipDouble` 6 级买 7 级要 1e16**（你报的）| `IP_DOUBLE_AD.costIncreaseThreshold = 1e6` ⇒ `purchasesAtIncrease = 5` ⇒ **陡段从第 5 级就开始**（`10^6 × 1e10^1 = 1e16`）✗ 而 AD 原文是 `1e3e6`，我上一轮擅自把门槛改成 1e6，让浅段只剩 5 级 | 门槛 `1e6 → 1e31`（浅段到第 30 级，每级 ×10）+ 封顶 `1e300 → 1e320` ✓ 实测 L6⇒1e7、L7⇒1e8、L8⇒1e9 ✓ |
| **7** | **量子面板显示 ≠ 实发**（面板 +21600 / 实发 +1e36，差 1e31.7）| 引擎账只乘在 `formulas.js` 的**调用处**，而面板显示"纯量子给的"✗ | 改成 `engineBonusMult` 作**第二参**传进同一函数 ⇒ 两边共用一条公式 ✓（实测 4 项全一致）|
| **8** | **`check-web-bundle` 报"文件不存在 `src/…`"** ⇒ **构建被挡住** | 扫描器**不剥 JS 注释**（HTML 早剥了）⇒ 我写的 JSDoc 里 `from "…"` 被当成真 import ✗ | 加 `stripJsComments()`（块 + 行注释，避开 `https://`），并把 `.cjs` 纳入 ✓ |
| **9** | **永恒后页面退回"待推进"**（用户截图）| `pageUnlocked` 只在"解锁那一刻"打点；永恒把实时条件清零 ⇒ `live=false`；记录为空 ⇒ `perma=false` ⇒ 退回 ✗ | ① `doEternity` 里**永恒成功即打点全部页面**（自愈）② 载入兜底用 `> 0` ③ **`render()` 开头按 `eternityCount > 0` 实时补齐**（下一帧自愈，**不用再永恒一次**）✓（`dom-smoke` 三条断言，均已验证禁掉就报红 ✓）|
| **10** | **未打破无限时买不了 ① 无限增幅**（用户报的：「开局还买不到重要的升级不扯淡么？」）| 实发侧 `buyInfinityUpgrade` **本来就没这个门槛**（只对 `thresholdFlat` 强制），是 **UI 多写了 `state.brokenInfinity &&`** + 文案显示"需先打破无限" ⇒ **显示门槛比实发严** ✗ | **删掉 UI 的门槛**（按用户裁定）⇒ 开局即可买 ✓ 实测 L0→L1 花 10、L1→L2 花 100、倍率 ×2→×4 ✓（`dom-smoke` 新增「① 未打破可买」，已验证加回门槛就报红 ✓）|
| **11** | **① 的首价是 10 而不是 1**（用户报的：「无限增幅的初始价格不应该就是 1 无限点么？」）| 照抄 AD 的 `10^(count+1)` ⇒ 首价 **10** ⇒ 开局凑不出（打破无限要 128）✗ | 改成用户裁定的序列 **`1 → 1 → 10 → 100 → …`**（`ipDoubleLogCost(0)=0`、`n≥1` 用 `10^(n−1)`）✓ 门槛后仍是 AD 的 `×1e10`（用户：「后续阈值我不管」）✓ |

### ⚠️ 改首价时踩的坑（同一类错误犯了两次，必须记）

```
现象：`ipDoubleAffordableIn`（买满）比"逐级实买"**少算 1 级**（池 5 ⇒ 说 1 级，实买 2 级）
根因：用户的价格序列**第 1 级是特例**（1 点），而 `10^(n−1)` 在 n=0 处是 **0.1** ⇒
     它不是纯等比序列 ⇒ **任何"当纯等比处理"的闭式都会错** ✗
我错了两次：① 浅段求和写成 `(10^span−1)/9`（应为 `/90`）
            ② 又想用 `/9` 反解 `k`（其实那次系数是对的，但前提"纯等比"本身就错）
修法：**不再推导新公式** —— 改成
  ① 解析求上界（当纯等比，只会高估）② 从 kUB **逐级阶梯回退**到真实可行值 ⇒ 保证精确 ✓
  （两段都做了这个校验；步长 ≤30 级 ⇒ 开销可忽略）
教训：**序列里有特例时，别推闭式** —— 求上界 + 回退校验，比"再推导一次"便宜得多 ✓
断言：`consistency.mjs` 新增两条（价格序列三入口一致 / 买满 == 逐级实买）
      —— 后者就是"能抓住这个 off-by-one"的那条 ✓
```

### ⚠️ 排查记录：一个"看起来像渲染 bug"的假象（值得记）

```
现象：断言里 `infinityUpgradeCost(s5)` 返回 100，而界面文案是 10000（= 等级 3 的值）
     且 state 文案仍是 "Lv 3" ⇒ 看起来像"渲染读了错的状态" ✗
真相：**无限页 `inf-content` 是 hidden 的**（`peakMatter` 不够 ⇒ `live=false`）
     ⇒ 面板里那条渲染分支**根本不跑** ⇒ 元素停在**上一次渲染的旧值**
⇒ 教训：**"显示 ≠ 实发"的排查必须先确认"渲染到底跑了没有"**（看 `hidden` / 打异常），
   否则会把"没渲染"误判成"渲染算错"，然后在错误的地方改半天 ✗
   （我是靠"打印现场"打出 `inf-content hidden=true` 才定位的 —— 印证 G⑤「打印现场，不要猜」）
```

---


---

## P9. ✅ 本轮实现：**N.E.K.O 接入层（无宿主版本）**

> 用户裁定：「我同意先做无宿主版本」
> 并确认：「**真的没有 SDK 调用范例，我们是首个这么干的开发者/工具组**」

### P9-1. 互通机制（**实测** Steam 版 SDK 源码，不是推测）

```
传输 = **同一份 HTTP 服务上的 REST**（不是 WebSocket、不是 postMessage、不是 iframe）
  · 我们推：POST /api/game/logs（日志）｜POST /api/game/logs/enable
  · 双向：POST /api/game/<gameType>/<op>
          protocol｜route/start｜route/heartbeat｜route/drain｜route/voice-transcript
          chat｜speak｜speech/preload｜mirror-assistant
          character｜context/read｜realtime-context｜memory/submit｜end
  · 端点由 `_gameEndpoint(p) => /api/game/${gameType}/${p}` 拼出（**游戏类型是路径段**）
证据：适配器里全是 `this._post(...)`；`WebSocket`/`EventSource` **零**引用；
      `postMessage` 仅 1 处（avatar bridge，非主通道）
```

**页面引导顺序**（SDK 源码要求）
```
① 宿主模板（Python 渲染）在加载 SDK 前吐出：
     <script type="application/json" id="neko-minigame-host-launch">{...registrations...}</script>
② <script src="/static/game/sdk/neko-minigame-same-origin-bootstrap.js">
③ bootstrap 吃掉并**删除**①的节点 → 加载适配器 → 暴露
     window.nekoMiniGameSameOriginHostReady（Promise）
④ 我们 connect() → 拿 transport → NekoMiniGame.connect(manifest, { transport })
```

**宿主会校验身份**（`connectGame()` 源码）
```
if (manifest.id !== registration.gameId || manifest.version !== registration.version)
  ⇒ { accepted: false, code: 'game_unregistered' }
⇒ manifest 的 id/version 必须与宿主注册表**完全一致**
⇒ 「怎么注册进邀请列表」是接入的前提 = `NEKO.md` §8 问题 1（**等对面回话**）
```

**manifest 必填**（schema 权威）
```
required: ["id", "version", "requiredCapabilities"]
要求 requiredCapabilities **contains { const: "logging" }** ⇒ **logging 是唯一强制能力**
```

### P9-2. 两个必须先说清的发现

| # | 发现 | 影响 |
|---|---|---|
| **1** | **`badminton_demo.html`（10546 行）与 `soccer-demo.js`（6878 行）都没用 SDK** —— 它们是旧式集成（`window.lanlan_config` + 同源 fetch）| ⇒ **没有范例可抄**。我们得自己钉契约，且**风险要自担**（对面可能没测过第三方接入）|
| **2** | `NEKO.md` §9 说日志是 `{ t, kind, text, data }` + 固定枚举，**实际 `pushLog` 只推 `{ t, text }`** ✗ | 文档与实现不一致（与 UI 那次同类）⇒ 本轮补上 ✓ |

### P9-3. 本轮做了什么（**零依赖、可独立验证**）

| 落点 | 内容 |
|---|---|
| **`src/neko.js`（新）** | **零 import**（不依赖 ui/engine/state，也不会成环）：`nekoLogKind` / `nekoLogEntry` / `nekoSnapshot` / `nekoHostPresent` / `createNekoBridge` |
| `state.js` | `pushLog(state, text, data?)` 支持可选 `data` + **`setLogSink()`** ⇒ 40+ 处调用点**一处都不用改**就全部流向宿主 ✓ |
| `main.js` | 造桥 + 挂日志出口 + 探测宿主（**不阻塞**）+ 每 5 秒推一次快照（速率/乘区/档位里程碑由**引擎既有函数**现算后注入 ⇒ 快照不重算公式 ✓）|
| `ui.js` | 猫猫子页显示**接入状态**（`nekoHostPresent()` 判据，**不是**看 `window.lanlan_config`——那是旧式集成 ✗）|

**kind 判据**：从日志的 **emoji 前缀 + 文本模式**推导（枚举 `crunch/buy/milestone/quantum/system`）
```
⚠️ 顺序有意义（先匹配到的赢）。踩过：「开始无限挑战 1／3」被 `/无限挑战/` 与 `/🌌|💠/` 并成
   一条规则 ⇒ 误判成 crunch ✗ ⇒ 拆开并前置（更具体的文本模式先判）✓
```

### P9-4. 降级契约的断言（`dom-smoke` 的「N.E.K.O 接入层」）
```
✅ 无宿主时全 no-op（available=false、sendLog/publishSnapshot 返回 false 且**不抛**）✓
✅ 日志形状 {t,kind,text,data} ✓｜kind 枚举 6/6 ✓（⚠️ 2026：IC 删除后少了一条）
✅ 快照 schema=1、未注入速率给 **null**（不是假的 0）、**不编 darkMatter**（后续阶段的字段）✓
✅ pushLog 出口已挂桥（哨兵 sink 验）✓
```

### P9-5. ✅ 接入契约**已 100% 核清**（用户要求"1 在 2 完成时跑"）

**完整链路**（逐字读 Steam 版源码得到，不再是推测）
```js
// ① 宿主模板（Python 渲染）在加载 SDK 前吐出：
//    <script type="application/json" id="neko-minigame-host-launch">{ registrations, adapterUrl? }</script>
// ② <script src="/static/game/sdk/neko-minigame-same-origin-bootstrap.js">
//    bootstrap **同步**吃掉并删除①的节点，加载适配器，然后暴露：
//    window.nekoMiniGameSameOriginHostReady   ← Promise，resolve 出工厂函数
const factory   = await window.nekoMiniGameSameOriginHostReady;
const transport = factory({ gameType: "<注册过的 id>" });   // ← 未注册 ⇒ **构造就抛**
const client    = await NekoMiniGame.connect(manifest, { transport });
//                  ↑ window.NekoMiniGame = Object.freeze({ version, protocolVersion,
//                    supportedCapabilities, mandatoryCapabilities, connect, Error })
```

**关键签名（已核实）**
```
· `createNekoMiniGameSameOriginHost(options)`  ← 只需 `{ gameType }`
    ⇒ `new NekoMiniGameSameOriginHost({ ...options,
         launchRegistration: HOST_BOOTSTRAP.registrations.get(gameType) || null })`
· 构造函数：`launchRegistration` 为空 ⇒ **抛** `game_unregistered`
            `options.gameType/gameVersion` 与注册不一致 ⇒ **也抛** ✗
· `connect(manifestInput, options)`：**只需 `options.transport`**；
    `windowImpl` / `documentImpl` / `AbortController` 都可注入 ⇒ **测试友好** ✓
· manifest 必填：`["id","version","requiredCapabilities"]`，且
    `requiredCapabilities` **必须 contains { const: "logging" }**（logging 是唯一强制能力）
```

⇒ **对接只需 4 行**（写在 `createNekoBridge.connect()` 里）：
  `await ready` → `factory({gameType})` → `connect(manifest,{transport})` → 把
  `client.logger` / `client.state` / `client.controls` 挂到桥上。
  **本层其余部分不用改** ✓

### P9-6. ✅ 本轮实现：**§6 动作白名单 + 派发器**

| 落点 | 内容 |
|---|---|
| `config.js` | `NEKO_ACTIONS`（7 条，**清单唯一来源**，UI/文档/断言共用）/ `NEKO_MAX_ACTIONS_PER_TICK` / `NEKO_ACTION_RESULT` |
| `neko.js` | **`dispatchNekoActions(state, actions, api)`** —— 三条硬约束的唯一实现 |
| `main.js` | 注入 `nekoActionApi`（**每一项都是 engine 的导出** + `has*` id 探针）+ 控制台验证入口 `__game.nekoActions(batch)` |

**三条约束怎么落实**
```
① 阶段白名单：每条动作带 `guard(state, payload, api)`，未到 ⇒ `rejected` + 原因
   （`doBigCrunch`/`doEternity` 要求 `brokenInfinity`；购买类要求 id 在 config 里存在）
② 只走既有购买函数：`fn` 全是 engine 导出，**零自写扣款**（踩过"自动化与手动双倍发放"）
③ 限流 + 幂等：
   · 限流 = 每批 ≤ `NEKO_MAX_ACTIONS_PER_TICK`(8)，超出记 `throttled`
   · 幂等 = **由购买函数保证**（买不起就返回 false ⇒ 重复调用天然不叠加）
     ⚠️ 不需要额外记账：我们从不自己扣钱，"调两次 = 买两次"在游戏里是**合法行为** ✓
```

**⚠️ `setAuto` 故意返回 `rejected`（而不是假装成功）**：§6 末尾要求"猫娘驱动的自动化
不消耗梦想点、不占玩家已买的槽位" ⇒ 那是一个**独立通道**，需要一个**玩家可授予的授权开关**，
而那个开关是 Neko 页面上还没做的 UI。硬做就得在引擎里加"猫娘专用分支"
—— 正好是约束② 想避免的"自己写一套"✗ ⇒ 先登记契约、写清原因 ✓

**断言**（`dom-smoke` 的「猫娘动作白名单」，已验证**去掉阶段守卫就报红** ✓）
```
✅ 派发批次：合法 2 条执行 ✓｜未知id / 阶段未到(doBigCrunch) / setAuto未实装 各拒绝 ✓
✅ 未知名不抛(1 条 unknown_action) ✓｜applied=2 < 总数6 ✓
   ⚠️ 判别式**必须含 `applied < 总数`** —— 否则"把一切都拒绝"的退化实现也能全绿（假断言 ✗）
✅ 限流单独验：5 条样本 / 上限 3 ⇒ 执行 3、截掉 2 ✓
✅ 白名单 7 个动作、engine 侧 6 个派发函数全在 ✓
```

**⚠️ 写这条断言时踩的坑**：`maxPerTick` 设成 3 配 6 条样本 ⇒ 后面样本被**限流截掉** ⇒
`results[i]` 是 `undefined`，**看起来像"守卫没生效"** ✗ ⇒ 派发样本的 `maxPerTick`
必须 ≥ 样本数，限流**单独**用第二段验 ✓

### P9-7. ⏳ 接入前仅剩（**全在对面**）
```
① 注册：宿主注册表里要有我们的 id/version（§8 问题 1）—— 这是唯一"硬阻塞"
② §8 其余问题（运行时配置元素、avatar/audio 是否必需、记忆同意流程…）
技术侧**没有未知项了** ✓
```

---


---

## P10. ✅ 本轮实现：**好感度三道具**（`NEKO.md` §10）

> 用户裁定：「**先按照目前的要求做，不管平衡性**」
> ⇒ 稿子怎么写就怎么做：**不做套利分析、不加冷却、不改成比例消耗** ✓
> （稿子末尾自标的套利风险**已知但本轮不处理** —— 它由 §7 的波动窗口天然兜住一部分）

| 道具 | 成本（§10 原文）| 好感度 | 来源 |
|---|---|---|---|
| **猫条** | **免费** | +1 | 稿子明写"免费" |
| **棒棒糖** | **当前所有物质** | +3 | 稿子原文 |
| **猫爪** | **当前所有 ZPE** | +5 | 稿子原文 |

⚠️ **「给多少好感度」稿子没写，是我补的**（按"越贵给越多"：1/3/5）——
   已在 `config.js` 的注释里**显式标注**，不许假装是稿子的 ✓

| 落点 | 内容 |
|---|---|
| `config.js` | `NEKO_ITEMS`（三个，含 `can` 判据）+ **`useNekoItem`（唯一入口：扣款与好感度写入都在这里）** + `nekoDriftRoom`（窗口剩余额度）|
| `index.html` | 道具卡从"待定稿"表换成**三个真按钮**；波动额度挪到好感度卡（它是道具的真实约束）|
| `ui.js` | 按钮可用态 / 成本文案全部走 `NEKO_ITEMS` + `nekoDriftRoom`（**不重写判据** ✗）|
| `main.js` | `onUseNekoItem(id)`（取代原来的 `onNekoTest` —— **那对 ±8 调试按钮已删除** ✓）|

**实测（含发现）**
```
✅ 猫条 ⇒ +1 ✓｜棒棒糖 ⇒ +3 且**物质清零** ✓｜猫爪 ⇒ ZPE 清零 ✓
★ **三个道具共用 §7 的 8 点窗口** ⇒ 1+3+5=9 会被削成 8（猫爪实得 4）
  —— 这是 §7 明文规定的效果，**不是缺陷**；UI 里 `neko-drift` 会如实显示"还剩 N 点" ✓
✅ 额度用完 ⇒ 猫条被拒（原因写明）✓｜被拒时**不扣款、不加好感度** ✓
✅ 零资源 ⇒ 棒棒糖/猫爪 被拒（免费猫条仍可用）✓｜未知道具 ⇒ 拒绝 ✓
```

**断言**（`dom-smoke` 的「机制可见性」，原来点的是**被删的调试按钮** ⇒ 已改成点**真道具**）
```
✅ 自动化未开启时指明 v9/梦想升级 ✓｜开启后显示已生效 ✓｜档位阶梯 3 条且只亮 1 档 ✓
✅ 猫条 +1 ✓｜**棒棒糖清空物质（0）且 +3** ✓ ← 最容易写错的一条
```

---


---

## P11. ✅ 顺手优化：**量子日志节点 = 纯 ×5**（用户裁定）

> 用户原话：「顺手优化下量子的日志输出，每 **1/5/25/125/625**（以此类推）对量子输出」

```
问题：原来**每捕获一对都写一条** ⇒ 一局几百对就把 #log-panel 刷爆，
      把真正重要的事件（大坍缩 / 里程碑）冲走 ✗
修法：`state.js` 新增 `QUANTUM_LOG_LEVELS` / `isQuantumLogLevel`（**纯 ×5**，26 项到 1e18）
      `engine.js` 的 `phaseQuantumCapture` 只在节点上 pushLog ✓
⚠️ **不能复用** `isKeyLevel` —— 那是 **×5、×2 交替**（给重复购买升级用的，用户当年指定 1/5/10/50…）
   ⇒ 两套判据**语义不同**，混用会让日志在 2、10、50… 也冒出来，与用户要的序列不符 ✗
```

**采样验证**：`1✅ 2— 4— 5✅ 6— 10— 25✅ 50— 124— 125✅ 625✅ 626— 3125✅` ✓

---


---

## Q. ★ **0.6.17 = 「无限-永恒前期」收尾版**（用户裁定：「结合我的感觉就算完成了」）
### Q1. 本版做了什么（详见 [`CHANGELOG.md`](../CHANGELOG.md) 的 0.6.17 段）
```
接入层（无宿主版本）：src/neko.js（零依赖）+ pushLog 结构化 + setLogSink
游戏内：好感度系统 / 三道具 / 量子日志纯×5 / Neko 子页（两列）/ 梦想页壳子
工程：测试批跑 31× 提速｜--check 接入批跑｜科学计数法统一｜4 个「显示≠实发」修复｜页面永不重锁
```

### Q2. 文档同步
```
✅ docs/NEKO.md  **已重写**（276 行）= 当前进度 + **全部要求** + 已核清的接入契约
   · §0 完成态速览｜§3.6 接入契约（逐字核，含工厂/connect 签名/端点表）
   · §5 快照｜§6 动作白名单（三条约束 + setAuto 为什么没做）｜§7 好感度｜§8 待你们确认的 8 个问题
   · §10 你的原始设计原文**保留原样** + §10.1 **我们对原文的偏离/补充清单**（诚实记录）
✅ CHANGELOG.md  已加 0.6.17 段（159 行）
✅ package.json / package-lock.json / README.md / main.js 的控制台横幅 ⇒ 全部 0.6.17
```

### Q3. 本阶段**真正的**未完成项（都不是"遗漏"，是明确后置）
| 事项 | 为什么后置 |
|---|---|
| SDK 真握手 | **唯一硬阻塞在对面**：宿主注册表要有我们的 id/version（`NEKO.md` §8 问题 1）|
| Neko 页聊天区 | 依赖握手；UI 位置与状态卡**已就位** |
| `setAuto` 授权开关 | 需要一个"玩家可授予"的 UI（P12-2）|
| **永恒梦想升级**（设计稿 46~47 行）| 「自动化前面的可重复购买的 zpe 引擎和 IP 点倍增」—— 是"自动化"那条链的**上游**；用户说「P2-2 属永恒后，但**不影响先开发**」⇒ **下一批** |
| em2 / em4 / em7 / em8 | 分别等 暗物质页 / IC 关卡数 / 自动化页 ⇒ **属后续阶段** |

### Q5. ✅ D5（本阶段最后一项欠账）已闭环
```
设计稿第 27 行两半都做了：
  ① 「日志系统输出会调整到梦想页面」      ⇒ `#log-panel` 搬到 `panel-dream` ✓
  ② 「升级中心/点击获取熵/各项加成比例都合并为主面板页面下」
     ⇒ 4 张卡收进**可折叠分组「手动操作」，默认收起** ✓
        （用户从 a/b 两案里选了 **b（可折叠）**，并要求「下拉条 + 记住展开状态的复选框」）

⚠️ 用户的原话是"要是用户估计会倾向于 b 方案" ⇒ 我的选择只是**跟随他的倾向**，
   不是替他决定；随时可以改回"默认展开"（`config.js` 的 `UI_FOLDS.manual.defaultOpen`）✓
```

### Q4. 仍未清的 7 条过期断言（**不影响玩法**，见 M2）
```
base-vs-quantum｜cap-monotonic-lab｜eternity-lab｜ic-lab
ip-economy-lab｜quantum-particle-lab｜zpe-engine-lab
⇒ 清完后可把 `run-all.mjs` 的 `--strict` 设为默认（现在是"默认绿、--strict 红"）
⚠️ **2026 更正**：上面那份 7 条清单**已过期**。本会话实测的 `--strict` 七条是：
```
base-vs-quantum｜cap-monotonic-lab｜check-web-bundle｜ic-lab
ip-economy-lab｜quantum-particle-lab｜zpe-engine-lab
```
（`eternity-lab` **已不在列**（本轮修好了它的写死门槛夹具）；`check-web-bundle` 在列但上面漏写了 ⇒
以本清单为准 ✓ 数字口径见 `CONFIG-FACTS.md` 的「--strict 已知失败数」）
```

---


---
