/**
 * neko/cat-pet.js —— 游戏页里的「猫猫漫游」
 *
 * 复用 N.E.K.O 自己的猫资源（GIF + 可见区域元数据）：
 *   `/static/avatar/avatar-ui-buttons/cat-resource-registry.js`
 * 但物理**不搬桌面那套**（那套移动的是 Electron 窗口）——这里是纯页内坐标：
 * 重力 / 落地弹 / 撞墙 / 拖拽 / 点击反应，边界 = 页面视口。
 *
 * 设置尽量跟随宿主：
 *   · 外观组：`window.__nekoCatResourceGroup`（桌面 preload 注入，没有就 dev_neko）
 *   · 重力开关：`localStorage['neko.gravityCat.enabled']`（宿主设置，没有就默认开）
 * 自己只加一个开关：`localStorage['kongxiang.catPet.enabled']`（默认开）。
 */

const REGISTRY_SRC = '/static/avatar/avatar-ui-buttons/cat-resource-registry.js';
const ENABLED_KEY = 'kongxiang.catPet.enabled';
const HOST_GRAVITY_KEY = 'neko.gravityCat.enabled';

export const CAT_GRAVITY = 1440;      // px/s²（与宿主 playground 同量级）
export const CAT_FLOOR_BOUNCE = 0.52; // 落地弹性（宿主 0.52）
export const CAT_WALL_BOUNCE = 0.6;
export const CAT_WALK_SPEED = 70;     // px/s

const IDLE_SLOTS = ['idle.cat1', 'idle.cat2', 'idle.cat3'];
const CLICK_SLOTS = ['click.cat1', 'click.cat2', 'click.cat3'];
const ANIM = {
  idle: IDLE_SLOTS,
  walk: ['movement.cat1.walking'],
  drag: ['drag.cat1', 'drag.rapid'],
  fall: ['playground.cat1.air', 'movement.cat1.stretch'],
  click: CLICK_SLOTS,
};

const pick = (list, rand = Math.random) => list[Math.floor(rand() * list.length) % list.length];

/** 猫猫开关（默认开）。 */
export function catPetEnabled() {
  try { return localStorage.getItem(ENABLED_KEY) !== 'false'; } catch { return true; }
}

export function setCatPetEnabled(enabled) {
  try { localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false'); } catch { /* ignore */ }
}

/** 重力是否开启：跟随宿主设置，宿主没设就默认开。 */
export function catGravityEnabled() {
  try {
    const host = localStorage.getItem(HOST_GRAVITY_KEY);
    if (host === 'true' || host === 'false') return host === 'true';
  } catch { /* ignore */ }
  try { return localStorage.getItem(`${ENABLED_KEY}.gravity`) !== 'false'; } catch { return true; }
}

/**
 * 页面内物理一步（纯函数，导出给 lab 测试）。
 * body: { x, feetY, vx, vy, halfWidth, height, onGround, facing }
 * bounds: { width, height, floor }
 */
export function stepCatPhysics(body, bounds, dt) {
  const events = { landed: false, hitWall: 0 };
  if (dt <= 0) return events;

  if (!body.onGround) {
    body.vy += CAT_GRAVITY * dt;
    body.feetY += body.vy * dt;
    if (body.feetY >= bounds.floor) {
      body.feetY = bounds.floor;
      if (Math.abs(body.vy) > 90) {
        body.vy = -body.vy * CAT_FLOOR_BOUNCE;
        events.landed = true;
      } else {
        body.vy = 0;
        body.onGround = true;
      }
    }
  }

  body.x += body.vx * dt;
  const minX = body.halfWidth + 4;
  const maxX = Math.max(minX, bounds.width - body.halfWidth - 4);
  if (body.x < minX) { body.x = minX; body.vx = Math.abs(body.vx) * CAT_WALL_BOUNCE; events.hitWall = -1; }
  else if (body.x > maxX) { body.x = maxX; body.vx = -Math.abs(body.vx) * CAT_WALL_BOUNCE; events.hitWall = 1; }
  body.facing = body.vx < -1 ? -1 : (body.vx > 1 ? 1 : body.facing);
  return events;
}

/** 下一次 idle 的时长（3~7 秒）。 */
export function nextIdleDelay(rand = Math.random) {
  return 3000 + rand() * 4000;
}

/** 下一次 walk 的时长（1.5~4 秒）。 */
export function nextWalkDelay(rand = Math.random) {
  return 1500 + rand() * 2500;
}

/** 把「可见区域」从 512 盒子换算成像素（导出给 lab 测试）。 */
export function resolveCatBox(boxPx, insets) {
  const i = insets || { left: 0, top: 0, right: 1, bottom: 1 };
  return {
    boxPx,
    width: Math.max(8, (i.right - i.left) * boxPx),
    height: Math.max(8, (i.bottom - i.top) * boxPx),
    offsetX: i.left * boxPx,
    offsetY: i.top * boxPx,
  };
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { resolve(); return; }
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`cat resources failed: ${src}`));
    document.head.appendChild(el);
  });
}

async function ensureRegistry() {
  if (window.NekoCatResourceRegistry) return window.NekoCatResourceRegistry;
  try { await loadScript(REGISTRY_SRC); } catch { return null; }
  return window.NekoCatResourceRegistry || null;
}

function readInsets(registry, url, facing) {
  if (!registry || typeof registry.getAppearanceVisibleInsets !== 'function') return null;
  try { return registry.getAppearanceVisibleInsets(url, { facingRight: facing > 0 }) || null; } catch { return null; }
}

/**
 * 挂一只猫到页面上。
 * @returns {Promise<{ok:boolean, reason?:string, toggle?:Function, dispose?:Function, state?:Function}>}
 */
export async function mountCatPet(options = {}) {
  if (!catPetEnabled()) return { ok: false, reason: 'disabled' };
  const registry = await ensureRegistry();
  if (!registry || typeof registry.getAppearance !== 'function') return { ok: false, reason: 'no-registry' };

  const layer = document.createElement('div');
  layer.className = 'neko-cat-pet-layer';
  layer.setAttribute('aria-hidden', 'true');
  const el = document.createElement('img');
  el.className = 'neko-cat-pet';
  el.alt = '';
  el.draggable = false;
  layer.appendChild(el);
  (options.container || document.body).appendChild(layer);

  const scale = clamp(Number(options.scale) || Number(localStorage.getItem(`${ENABLED_KEY}.scale`)) || 0.34, 0.2, 0.6);
  const boxPx = Math.round(512 * scale);
  el.style.width = `${boxPx}px`;
  el.style.height = `${boxPx}px`;

  const state = {
    mode: 'idle',
    body: {
      x: Math.max(boxPx / 2 + 8, window.innerWidth * (0.55 + Math.random() * 0.3)),
      feetY: 0,
      vx: 0,
      vy: 0,
      halfWidth: boxPx * 0.35,
      height: boxPx * 0.8,
      onGround: true,
      facing: -1,
    },
    timer: nextIdleDelay(),
    frame: null,
    lastTs: 0,
    disposed: false,
    animUrl: '',
    dragging: null,
    gravity: catGravityEnabled(),
  };
  const box = { width: window.innerWidth, height: window.innerHeight, floor: window.innerHeight - 6 };
  const bounds = () => ({ width: window.innerWidth, height: window.innerHeight, floor: window.innerHeight - 6 });
  state.body.feetY = bounds().floor;

  const applyInsets = (insets) => {
    if (!insets) return;
    const resolved = resolveCatBox(boxPx, insets);
    state.body.halfWidth = resolved.width / 2;
    state.body.height = resolved.height;
    state.offsetY = resolved.offsetY;
    state.visibleHeight = resolved.height;
  };
  state.offsetY = boxPx * 0.1;

  function setAnim(slotList, opts = {}) {
    const slot = opts.slot || pick(slotList);
    const entry = registry.getAppearance(slot, { random: false });
    if (!entry || !entry.available || !entry.url) return false;
    if (!state.animUrl) {
      const insets = readInsets(registry, entry.url, state.body.facing);
      applyInsets(insets);
    }
    if (state.animUrl !== entry.url) {
      state.animUrl = entry.url;
      el.src = entry.url;
    }
    return true;
  }

  function render() {
    const b = state.body;
    el.style.left = `${Math.round(b.x - boxPx / 2)}px`;
    el.style.top = `${Math.round(b.feetY - (state.offsetY + (state.visibleHeight || boxPx * 0.8)))}px`;
    el.style.transform = b.facing < 0 ? 'scaleX(-1)' : '';
  }

  function toIdle() {
    state.mode = 'idle';
    state.body.vx = 0;
    state.timer = nextIdleDelay();
    setAnim(ANIM.idle);
  }

  function toWalk() {
    state.mode = 'walk';
    const dir = Math.random() < 0.5 ? -1 : 1;
    state.body.vx = dir * CAT_WALK_SPEED;
    state.body.facing = dir;
    state.timer = nextWalkDelay();
    setAnim(ANIM.walk);
  }

  function toDrag() {
    state.mode = 'drag';
    state.body.vx = 0;
    state.body.vy = 0;
    state.body.onGround = false;
    setAnim(ANIM.drag);
  }

  function toFall() {
    state.mode = 'fall';
    state.body.vy = 0;
    setAnim(ANIM.fall) || setAnim(ANIM.idle);
  }

  function onClick() {
    state.mode = 'click';
    state.timer = 700;
    setAnim(ANIM.click);
  }

  function tick(ts) {
    if (state.disposed) return;
    state.frame = requestAnimationFrame(tick);
    if (document.hidden) return;
    const last = state.lastTs || ts;
    const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
    state.lastTs = ts;
    if (dt <= 0) return;

    const b = state.body;
    const bd = bounds();

    if (state.mode === 'idle' || state.mode === 'walk') {
      state.timer -= dt * 1000;
      if (state.mode === 'walk' && b.onGround) {
        state.vx = b.vx;
      }
      const ev = stepCatPhysics(b, bd, dt);
      if (ev.hitWall) {
        b.vx = -b.vx;
        setAnim(ANIM.walk);
      }
      if (state.timer <= 0) {
        if (state.mode === 'idle') toWalk(); else toIdle();
      }
    } else if (state.mode === 'fall') {
      stepCatPhysics(b, bd, dt);
      if (b.onGround) toIdle();
    } else if (state.mode === 'click') {
      state.timer -= dt * 1000;
      stepCatPhysics(b, bd, dt);
      if (state.timer <= 0) toIdle();
    }
    render();
  }

  el.addEventListener('pointerdown', (event) => {
    if (state.disposed) return;
    event.preventDefault();
    el.setPointerCapture?.(event.pointerId);
    const b = state.body;
    state.dragging = { id: event.pointerId, dx: b.x - event.clientX, dy: b.feetY - event.clientY, moved: 0 };
    state.mode = 'drag';
    toDrag();
    render();
  });

  el.addEventListener('pointermove', (event) => {
    const drag = state.dragging;
    if (!drag || drag.id !== event.pointerId) return;
    const b = state.body;
    drag.moved += Math.abs(event.movementX || 0) + Math.abs(event.movementY || 0);
    b.x = clamp(event.clientX + drag.dx, b.halfWidth + 4, window.innerWidth - b.halfWidth - 4);
    b.feetY = clamp(event.clientY + drag.dy, b.height + 4, window.innerHeight - 4);
    b.vx = 0;
    b.vy = 0;
    render();
  });

  const release = (event) => {
    const drag = state.dragging;
    if (!drag || drag.id !== event.pointerId) return;
    state.dragging = null;
    try { el.releasePointerCapture?.(event.pointerId); } catch { /* ignore */ }
    if (drag.moved < 6) onClick();
    else toFall();
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  setAnim(ANIM.idle);
  render();
  state.frame = requestAnimationFrame(tick);

  return {
    ok: true,
    state: () => ({ mode: state.mode, x: state.body.x, feetY: state.body.feetY, gravity: state.gravity, anim: state.animUrl }),
    setGravity: (on) => { state.gravity = on !== false; if (!state.gravity) { state.body.vy = 0; state.body.onGround = true; } },
    dispose() {
      state.disposed = true;
      if (state.frame) cancelAnimationFrame(state.frame);
      layer.remove();
    },
  };
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
