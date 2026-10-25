# 便携包接入 N.E.K.O（零宿主改动）

> 状态：**已实装**（2026-10）｜本文是便携包的操作说明，随 `tools/pack-portable.mjs` 一起维护。

## 一句话

把本仓库打包成一个"便携包"，复制进 N.E.K.O 的静态目录即可联动 ——
**不需要修改宿主任何代码**。

## 为什么可以不改宿主

| 需求 | 宿主是否已提供 | 说明 |
|---|---|---|
同源页面 | ✅ 已有 | `/static` 是通用挂载，任何放进 `static/` 的文件都同源可访问 |
SDK 握手 | ✅ 已有 | `/static/game/sdk/neko-minigame-sdk.js` + same-origin bootstrap |
她的对话 | ✅ 已有 | 宿主 LLM，与游戏无关 |
**她代玩家操作** | ✅ 已有 | `dialogue.request` 的响应里**自带已校验的 control**（`data.control`）|

> 唯一仍需宿主补丁的场景：**宿主主动推送** control（语音被游戏路由劫持、
> 宿主自己发起的回合）。那条路走 `/route/drain`，需要可选的 20 行生产者。

## 用法

### 1. 打包

```bash
node tools/pack-portable.mjs
```

产物：

```
release/kongxiang-portable/           # 文件夹（2.0 MB）
release/kongxiang-portable-<版本>.zip # 压缩包
```

### 2. 安装

```powershell
# 自动定位 Steam / 本地安装
powershell -ExecutionPolicy Bypass -File release\kongxiang-portable\install.ps1

# 或手动指定安装目录（包含 resources\bin 的那一层）
powershell -ExecutionPolicy Bypass -File release\kongxiang-portable\install.ps1 -HostDir "E:\SteamLibrary\steamapps\common\n.e.k.o"
```

安装目标：

```
<N.E.K.O>\resources\bin\static\game\games\kongxiang\
```

### 3. 启动

启动 N.E.K.O 后打开：

```
http://127.0.0.1:48911/static/game/games/kongxiang/index.html
```

## 注意

- **Steam 更新会覆盖** `resources\bin`，更新后重新跑一次 `install.ps1` 即可；
- 页面里的 SDK 用绝对路径 `/static/game/sdk/...`（宿主自带，不随包分发）；
- 包内 `install.ps1` 带 UTF-8 BOM，PowerShell 5.1 / 7 都能正确读中文注释。
