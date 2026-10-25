// pack-portable.mjs —— 产出「便携包」：把游戏打成可直接放进 N.E.K.O static 目录的文件夹
//
// 为什么这样能跑：
//   N.E.K.O 的 /static 是通用挂载。把本目录放进
//     <N.E.K.O>/static/game/games/kongxiang/
//   再打开 /static/game/games/kongxiang/index.html，页面与宿主 API 就**同源**，
//   SDK 握手、对话、以及"她代玩家操作"（control 随对话响应返回）全部成立。
//
// 注意：
//   · 相对路径保持原样（./css、./src、../dist）—— 页面位于该子目录时自然解析正确；
//   · 宿主提供的 SDK 用**绝对路径** /static/game/sdk/...，不随包分发；
//   · 不需要宿主改任何代码；只有"宿主主动推送 control"才需要那 20 行补丁（可选）。
import { readFileSync, writeFileSync, cpSync, mkdirSync, rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const PUB = process.argv[2] || dirname(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));
const OUT = join(PUB, 'release', 'kongxiang-portable');

const GAME_ID = 'kongxiang-incremental';
const ROUTE_TYPE = 'kongxiang';
const PUBLISHER = 'dawn-of-star';
const CAPS = ['runtime', 'logging', 'dialogue', 'speech-output', 'voice-input', 'context-read', 'memory', 'avatar-renderer'];

const pkg = JSON.parse(readFileSync(join(PUB, 'package.json'), 'utf8'));
const VERSION = pkg.version;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// ── 1. index.html：注入 SDK 注册块（顺序敏感，见注释）──
let html = readFileSync(join(PUB, 'index.html'), 'utf8');
const registration = {
  adapterUrl: '/static/game/sdk/neko-minigame-same-origin-host.js',
  registrations: {
    [GAME_ID]: {
      mode: 'registered',
      gameId: GAME_ID,
      routeGameType: ROUTE_TYPE,
      publisherId: PUBLISHER,
      version: VERSION,
      allowedCapabilities: CAPS,
    },
  },
};
const sdkBlock = `  <!-- ═══ N.E.K.O 小游戏 SDK 接入（便携包） ═══
       顺序敏感：sdk.js → launch JSON（bootstrap 同步吃掉并删除）→ bootstrap → 模块脚本。
       相对路径保持不变；宿主 SDK 走绝对路径 /static/game/sdk/。 -->
  <script src="/static/game/sdk/neko-minigame-sdk.js"></script>
  <script id="neko-minigame-host-launch" type="application/json">${JSON.stringify(registration)}</script>
  <script src="/static/game/sdk/neko-minigame-same-origin-bootstrap.js"></script>

`;
const marker = '<script type="module"';
const idx = html.lastIndexOf(marker);
if (idx < 0) throw new Error('index.html 里找不到 <script type="module" ...>');
html = html.slice(0, idx) + sdkBlock + html.slice(idx);
writeFileSync(join(OUT, 'index.html'), html, 'utf8');

// ── 2. 复制运行所需文件 ──
for (const dir of ['src', 'css', 'dist', 'assets']) {
  const from = join(PUB, dir);
  if (existsSync(from)) {
    cpSync(from, join(OUT, dir), { recursive: true });
    console.log(`  + ${dir}/`);
  }
}
for (const f of ['package.json', 'NOTICE.md', 'LICENSE', 'LICENSE.md']) {
  const from = join(PUB, f);
  if (existsSync(from)) {
    cpSync(from, join(OUT, f));
    console.log(`  + ${f}`);
  }
}

// ── 3. 安装脚本（UTF-8 BOM：PS 5.1 也能正确读中文）──
const installPs1 = String.raw`# install.ps1 - copy the portable pack into a N.E.K.O install
# Usage:
#   powershell -ExecutionPolicy Bypass -File install.ps1
#   powershell -ExecutionPolicy Bypass -File install.ps1 -HostDir "E:\SteamLibrary\steamapps\common\n.e.k.o"
param(
    [string]$HostDir = '',
    [string]$PackDir = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'

function Find-SteamRoots {
    $roots = @()
    foreach ($key in @(
        'HKCU:\Software\Valve\Steam',
        'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam',
        'HKLM:\SOFTWARE\Valve\Steam'
    )) {
        $p = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
        if ($p) {
            if ($p.SteamPath) { $roots += $p.SteamPath }
            if ($p.InstallPath) { $roots += (Join-Path $p.InstallPath 'steamapps') }
        }
    }
    $roots = $roots | Where-Object { $_ -and (Test-Path $_) }
    $libs = @()
    foreach ($r in $roots) {
        $vdf = Join-Path $r 'steamapps\libraryfolders.vdf'
        if (Test-Path $vdf) {
            foreach ($m in Select-String -Path $vdf -Pattern '"path"\s+"([^"]+)"' -AllMatches) {
                foreach ($mm in $m.Matches) { $libs += ($mm.Groups[1].Value -replace '\\\\', '\') }
            }
        }
        $libs += $r
    }
    return ($libs | Select-Object -Unique)
}

if (-not $HostDir) {
    $candidates = @()
    foreach ($root in (Find-SteamRoots)) {
        $candidates += (Join-Path $root 'steamapps\common\n.e.k.o')
        $candidates += (Join-Path $root 'common\n.e.k.o')
    }
    $candidates += @(
        'C:\Program Files (x86)\Steam\steamapps\common\n.e.k.o',
        'C:\Program Files\Steam\steamapps\common\n.e.k.o',
        'D:\SteamLibrary\steamapps\common\n.e.k.o',
        'E:\SteamLibrary\steamapps\common\n.e.k.o',
        'F:\SteamLibrary\steamapps\common\n.e.k.o'
    )
    # Pick the candidate that really is a N.E.K.O install: the packaged server
    # binary under resources\bin, or a source checkout's static\game\games.
    $HostDir = $candidates | Where-Object {
        if (-not $_) { return $false }
        (Test-Path (Join-Path $_ 'resources\bin\projectneko_server.exe')) -or
        (Test-Path (Join-Path $_ 'static\game\games'))
    } | Select-Object -First 1
}

if (-not $HostDir -or -not (Test-Path $HostDir)) {
    throw 'N.E.K.O install not found. Pass -HostDir "<path to n.e.k.o>".'
}
# The packaged game keeps the Python server (and its static/) under resources\bin;
# a source checkout keeps them at the repo root. Support both.
function Get-AppRoot([string]$Root) {
    $bin = Join-Path $Root 'resources\bin'
    if (Test-Path (Join-Path $bin 'projectneko_server.exe')) { return $bin }
    if (Test-Path (Join-Path $Root 'static\game\games')) { return $Root }
    if (Test-Path (Join-Path $bin 'static')) { return $bin }
    throw ('Not a N.E.K.O install (no resources\bin\projectneko_server.exe and no static\game\games): ' + $Root)
}
$appRoot = Get-AppRoot $HostDir
if (-not (Test-Path (Join-Path $PackDir 'index.html'))) {
    throw "Portable pack not found under $PackDir"
}

$dst = Join-Path $appRoot 'static\game\games\kongxiang'
New-Item -ItemType Directory -Path $dst -Force | Out-Null
Copy-Item -Path (Join-Path $PackDir '*') -Destination $dst -Recurse -Force
Write-Output ''
Write-Output ('App root:   ' + $appRoot)
Write-Output ('Installed to: ' + $dst)
Write-Output 'Start N.E.K.O, then open:'
Write-Output '  http://127.0.0.1:48911/static/game/games/kongxiang/index.html'
Write-Output ''
Write-Output 'No host code changes are required: the SDK registration lives in the page,'
Write-Output 'and her control actions come back inside the dialogue response.'
`;
writeFileSync(join(OUT, 'install.ps1'), '\uFEFF' + installPs1, 'utf8');

// ── 4. 说明 ──
const readme = `# 空想增量 portable pack (v${VERSION})

把本目录复制到 N.E.K.O 的静态目录即可联动，**不需要修改宿主任何代码**：

\`\`\`
<N.E.K.O>/static/game/games/kongxiang/
\`\`\`

然后启动 N.E.K.O，打开：

\`\`\`
http://127.0.0.1:48911/static/game/games/kongxiang/index.html
\`\`\`

自动安装：\`powershell -ExecutionPolicy Bypass -File install.ps1\`
（找不到安装目录时可传 \`-HostDir "E:\\SteamLibrary\\steamapps\\common\\n.e.k.o"\`）

## 原理（为什么不用改宿主）

- N.E.K.O 的 \`/static\` 是通用挂载 ⇒ 页面与宿主 API 同源，SDK 才能握手；
- \`dialogue.request\` 的响应里**自带已校验的 control** ⇒ 她替玩家操作不需要宿主侧生产者；
- 只有"宿主主动推送"（语音被游戏路由劫持等）才需要可选的 20 行补丁。
`;
writeFileSync(join(OUT, 'README-PORTABLE.md'), readme, 'utf8');

// ── 5. 打 zip（Windows 自带 Compress-Archive）──
const zip = join(PUB, 'release', `kongxiang-portable-${VERSION}.zip`);
try { rmSync(zip, { force: true }); } catch { /* ignore */ }
try {
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `Compress-Archive -Path '${join(OUT, '*')}' -DestinationPath '${zip}' -Force`], { stdio: 'inherit' });
  console.log(`  zip -> ${zip}`);
} catch (err) {
  console.log('  (zip skipped: ' + err.message + ')');
}

const total = (function walk(dir) {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? walk(join(dir, e.name)) : statSync(join(dir, e.name)).size;
  }
  return n;
})(OUT);
console.log(`\n  portable: ${OUT}`);
console.log(`  files: ${total} bytes`);
