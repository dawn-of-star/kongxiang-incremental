# 交接：当前已知问题（2026-10-19，供重写参考）

> **状态：待同步**（交接清单 —— 记录 2026-10-19 时点的问题，重写完成后作废）
> 基线：`HEAD = a9baa5d`，`npm test` → **48 个脚本全绿**；注意 `--strict` 下仍有 **7 项已知失败**（见 §7）
> ⚠️ 2026-10-19 模块化后：默认 **49 个脚本全绿**、`--strict` **6 项失败**（§7 已按实测更新）

---

## 0. 一句话现状

主流程能玩、七巧板与自动无限能跑通，但**离线补帧路径上仍会产生真正的 `Infinity`**（`darkEnergy` / `zpe`），
目前靠**三道创可贴**把它夹住（见 §2）。**根因未定位** ✗ —— 重写时请优先解决，别把创可贴当设计 ✓。

---

## 1. 未解决的真问题（P0）

### 1.1 离线补帧会产生 `Infinity`（`darkEnergy` / `zpe`）

**证据**（用户控制台，2026-10-19）：
```
[inf-sanitise] state.darkEnergy became non-finite; clamped to 1e308. Stack:
    at tickBody   (engine.js:287)
    at tick       (engine.js:115)
    at advance    (main.js:7?)
[inf-sanitise] state.zpe was non-finite; clamped to 1e308   (engine.js:289)
```

**已知事实**：
- ∞ **在进入 `tick` 时就已经存在**（栈里没有上游帧）⇒ 是 tick 之外/之间产生的 ✗
- 触发时机 = **刷新页面后的离线结算**（`main.js` 的 `advance(state, capped)`）
- **不是** `advance` 的 dt 过大：`advance(state, seconds, chunkSeconds = 5)` **本来就按 5 秒分块** ✓
  （我一度误判为「一次算 4 小时」✗，改动后回滚 ✓）

**已排除**：
- 不是渲染层（`format.js` 的 `toNumber()` 全部有量级守卫 ✓）
- 不是存档残留（读档自愈已在 `deserialize` 末尾夹回 ✓，但**仍会复发** ⇒ 运行时产生 ✗）

**下一步该查的地方**（重写时重点）：
1. `advance()` 的**分块循环体**（我还没读完它 ✗——它可能在块与块之间做了别的写入）
2. `zpeRate(state)` / `effectiveDarkEnergyGain(state)` 里有没有 `toNumber()` / `Math.*` 混入
3. 离线结算**是否还有第二条路径**（`offlineReport` / `neko` 桥 / `ui.js` 的 `showOfflineBanner`）

---

## 2. 现在的三道创可贴（**不是根因**，重写时应替换成结构性约束）

| # | 位置 | 做法 |
|---|---|---|
| 1 | `engine.js` 暗能量自增长块 | 单帧 `dt` 限 1 秒（`Math.min(Math.max(0, dt), 1)`）|
| 2 | `state.js` `deserialize` 末尾 | 非有限资源夹回 `1e308`（`darkEnergy/zpe/ip/ep/quantum/matter/entropy/particles`）|
| 3 | `engine.js` 每帧净化 | 同样 8 个字段，变非有限就夹回 `1e308`，并**首次打印调用栈** |

⚠️ 三处都只保「界面不出现 ∞」，**没有消除上游** ✗

---

## 3. 结构性债务（重写时的天然改进点）

| # | 问题 | 现状 |
|---|---|---|
| 3.1 | `Number()` / `Math.*` 混入大数 | 有 `tools/decimal-guard.mjs` 守着（资源类字段 ✓），但**表达式中间值**查不到 ✗ |
| 3.2 | 同一件事两条路 | 历史上反复出（显示 vs 实发、自动无限开关、DE 自动化解锁 ✗）。**规矩：唯一入口** ✓ |
| 3.3 | 梦想页重排 | `arrangeDreamPage` 是**追加式** ⇒ 重排前必须 `innerHTML = ""` ✓（已修 ✓） |
| 3.4 | 梦想页解锁 | 现值：暗能量自动化 **always**、其余（除自动无限）`eternityCount ≥ 8`、自动无限 `infinityCount ≥ 1` ✓ 判定在 `dream-ui.js::isDreamUnlocked` ✓ |
| 3.5 | 自动无限 `X_HIGHEST` | 已按本地 AD 源码 `core/autobuyers/big-crunch-autobuyer.js` 对齐：`gain ≥ records.thisEternity.maxIP × x` ✓（`maxIpThisEternity` 在 tick 里维护 ✓）|
| 3.6 | 自动购买 | 每次 **1 级** + **250ms 节流**（AD autobuyer 语义 ✓）；`deGainBase`/`convOutput` 的 `maxLevel` 已**撤回封顶** ✓ |
| 3.7 | 七巧板 | 三轴端点：引擎 10→10000 级、转化 0.1→1e13、计数系数 0.05→50；`knee = 0.85` ⇒ **增益严重后置**（85% 覆盖才发力 ✗）。挑战奖励已接线（免费引擎级 +185、deKnee ×4、转化 ×10、系数 ×5、被动 IP 1%）✓ |
| 3.8 | 被动 IP | 用 `passiveIpBase` 快照（破∞那一刻）⇒ **线性** ✓（早期用实时 gain 导致爆炸 ✗ 已修 ✓）|

---

## 4. 工程纪律（血泪，别重犯）

1. **改多行代码只用 node 脚本按行拼接** —— PowerShell 双引号里的 `\n` 是**字面量** ✗
   本轮我因此写坏 `config.js` / `engine.js` 共 **6 次**（含一次把 `deSelf` 声明注释掉 ✗、一次把模块头删掉 ✗）
2. **改完立刻 `node --check`**，再跑 `npm test`（48 脚本 ≈ 2 分钟）
3. **数值一律 `Decimal`**（README 数值约定 #3）；`Number()` 只用于下标/计数/0~1 比例
4. **超载 knee 在 `e308.25`**（约定 #4）；**界面出现 ∞ = 致命错误** ✗
5. 测验基线：`node tools/run-all.mjs` 全绿 = 没搞坏 ✓

---

## 5. 本轮关键提交（回溯用）

| commit | 内容 |
|---|---|
| `a9baa5d` | 净化器首次拦到时打印**调用栈**（就是它定位到 `advance`）|
| `8e7b5eb` | 每帧净化（创可贴 ③）|
| `58b4546` | 读档自愈（创可贴 ②）|
| `cfb4617` | DE 自增长 `dt` 限 1 秒（创可贴 ①）|
| `2165908` | 梦想升级解锁改**次数检测** |
| `ab2626b` | `X_HIGHEST` 对齐 AD `records.thisEternity.maxIP` |
| `5020dfa` | `tools/decimal-guard.mjs`（数值约定 #3 的守卫）|
| `5c4e849` | README 补「数值约定」两条硬线 |
| `9d836bb` / `bc15e52` | 空间膨胀设计稿评估 + du 购买表（EP 换算：+3434 阶 IP ⇒ EP 1e8）|

---

## 6. 重写时**必须保留**的外部契约

- 存档格式（`localStorage`）与 `state.js` 的字段名 —— 用户的档不能丢 ✗
- `docs/` 里用户**逐字原文**（`TANGRAM.md` §0.2、`SPACE-EXPANSION.md` §1、`NEKO.md` 原文段）**不许改** ✓
- 唯一入口约定：`effectiveEngineLevel` / `benefit` / `nekoGlobalExponent` / `tangramAxisParams` …
- 自动化语义：**间隔 + 每次 1 级**（不是每帧买满 ✗）
---

## 7. `--strict` 下的 6 项已知失败（不是本轮引入，长期存在）

`node tools/run-all.mjs --strict` 会额外跑一批历史断言，其中 **6 项长期红**
（2026 模块化重构后实测；`dark-matter-lab` 与 `eternity-lab` 已修好）：

```
base-vs-quantum ｜ cap-monotonic-lab ｜ check-web-bundle
ip-economy-lab ｜ quantum-particle-lab ｜ zpe-engine-lab
```

- 大部分是**旧数值标定**与当前公式脱节（如 `ip-economy-lab` 的斜率表 ✓）
- `check-web-bundle` 是**打包产物**检查（需要先构建 ✓）
- ~~`ic-lab`~~ 已随 IC 系统删除而不存在（原清单里的这一项是**幽灵条目** ✗）
⇒ **重写时请把这 6 项要么修好、要么删掉**，不要再留「默认绿、严格红」的双口径 ✗
