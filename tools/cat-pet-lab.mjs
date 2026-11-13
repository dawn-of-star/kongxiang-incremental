/**
 * tools/cat-pet-lab.mjs —— 猫猫漫游的**页内物理**定点断言
 *
 * 只测纯函数（`stepCatPhysics` / `resolveCatBox` / 定时器），不碰 DOM/GIF:
 *   · 重力下落 → 落地弹一下 → 静止
 *   · 撞墙 → 反弹 + 朝向翻转
 *   · 可见区域换算
 *
 * 用法：`node tools/cat-pet-lab.mjs [--check]`
 */
import {
  stepCatPhysics, resolveCatBox, nextIdleDelay, nextWalkDelay,
  CAT_GRAVITY, CAT_FLOOR_BOUNCE, CAT_WALL_BOUNCE, CAT_WALK_SPEED,
} from '../src/neko/cat-pet.js';

let failed = 0;
const check = (name, cond, detail = '') => {
  if (cond) { console.log(`  ✅ ${name}`); return; }
  failed += 1;
  console.log(`  ❌ ${name}${detail ? `：${detail}` : ''}`);
};

console.log('=== 猫猫物理 ===');

// ① 自由落体 → 落地弹起
{
  const body = { x: 100, feetY: 0, vx: 0, vy: 0, halfWidth: 60, height: 120, onGround: false, facing: 1 };
  const bounds = { width: 800, height: 600, floor: 600 };
  let landed = 0;
  for (let i = 0; i < 240; i += 1) {
    const ev = stepCatPhysics(body, bounds, 1 / 60);
    if (ev.landed) landed += 1;
    if (body.onGround) break;
  }
  check('落地后静止在 floor', body.feetY === 600 && body.onGround === true, `feetY=${body.feetY}`);
  check('落地时弹过一次', landed >= 1, `landed=${landed}`);
  check('弹起速度衰减（0.52）', Math.abs(CAT_FLOOR_BOUNCE - 0.52) < 1e-9);
}

// ② 撞左墙 → 反弹 + 朝右
{
  const body = { x: 64.5, feetY: 600, vx: -200, vy: 0, halfWidth: 60, height: 120, onGround: true, facing: -1 };
  const bounds = { width: 800, height: 600, floor: 600 };
  const ev = stepCatPhysics(body, bounds, 1 / 60);
  check('撞左墙被夹住', body.x >= 64, `x=${body.x}`);
  check('撞墙反向', body.vx > 0, `vx=${body.vx}`);
  check('朝向翻右', body.facing === 1);
  check('记录 hitWall', ev.hitWall === -1);
  check('墙弹性 0.6', Math.abs(CAT_WALL_BOUNCE - 0.6) < 1e-9);
}

// ③ 朝右走 → facing=1
{
  const body = { x: 300, feetY: 600, vx: CAT_WALK_SPEED, vy: 0, halfWidth: 60, height: 120, onGround: true, facing: -1 };
  stepCatPhysics(body, { width: 800, height: 600, floor: 600 }, 1 / 60);
  check('向右走朝向翻右', body.facing === 1, `vx=${body.vx} facing=${body.facing}`);
}

// ④ 可见区域换算（512 盒子，留白 10% / 90%）
{
  const box = resolveCatBox(512, { left: 0.1, top: 0.2, right: 0.9, bottom: 0.9 });
  check('可见宽度 = 80%', Math.abs(box.width - 409.6) < 1e-6, `${box.width}`);
  check('可见高度 = 70%', Math.abs(box.height - 358.4) < 1e-6, `${box.height}`);
  check('水平偏移 = 10%', Math.abs(box.offsetX - 51.2) < 1e-6, `${box.offsetX}`);
}

// ⑤ 定时器范围
{
  let ok = true;
  for (let i = 0; i < 200; i += 1) {
    const idle = nextIdleDelay();
    const walk = nextWalkDelay();
    if (idle < 3000 || idle > 7000) ok = false;
    if (walk < 1500 || walk > 4000) ok = false;
  }
  check('idle 3~7s / walk 1.5~4s', ok);
}

check('重力常量 1440', CAT_GRAVITY === 1440);

console.log(failed === 0 ? '\n✅ 猫猫物理全部通过' : `\n❌ ${failed} 项失败`);
process.exitCode = failed === 0 ? 0 : 1;
