/**
 * neko/avatar.js —— 游戏内的角色渲染（Live2D）
 *
 * N.E.K.O 的约定：**第三方游戏自己渲染角色**。内置游戏都是这么做的：
 *   1. 加载宿主的 live2d 运行时（/static/libs + /static/live2d）；
 *   2. 用 `NekoMiniGameAvatarHost.create({ slots })` 提供渲染控制器；
 *   3. `client.avatar.mount({ slot, model, viewport, fit, resize })` 让 SDK 接管。
 *
 * 本模块把这些步骤封装成一次 `mountAvatar()`：脚本按序懒加载（只有宿主页才加载），
 * 失败就退回文字占位，不影响游戏本身。
 */

const SDK_BASE = '/static/game/sdk/neko-minigame-avatar-host.js';
const SCRIPTS = [
  '/static/libs/live2dcubismcore.min.js',
  '/static/libs/live2d.min.js',
  '/static/libs/pixi.min.js',
  '/static/live2d/live2d-core.js',
  '/static/live2d/live2d-emotion.js',
  '/static/live2d/live2d-model.js',
  '/static/live2d/live2d-init.js',
  SDK_BASE,
];

let loadingPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-neko-avatar="${src}"]`);
    if (existing) { existing.dataset.loaded === '1' ? resolve() : existing.addEventListener('load', () => resolve(), { once: true }); return; }
    const el = document.createElement('script');
    el.src = src;
    el.dataset.nekoAvatar = src;
    el.addEventListener('load', () => { el.dataset.loaded = '1'; resolve(); }, { once: true });
    el.addEventListener('error', () => reject(new Error(`script failed: ${src}`)), { once: true });
    document.head.appendChild(el);
  });
}

async function ensureScripts() {
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    for (const src of SCRIPTS) await loadScript(src);
  })();
  return loadingPromise;
}

function waitForLive2DModel(manager, signal, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (signal?.aborted) { reject(Object.assign(new Error('Avatar mount was cancelled'), { name: 'AbortError' })); return; }
      if (manager.currentModel?.width && manager.currentModel?.height) { resolve(manager.currentModel); return; }
      if (Date.now() - started > timeoutMs) { reject(new Error('Live2D model timeout')); return; }
      setTimeout(tick, 120);
    };
    tick();
  });
}

/**
 * 在 host 页里挂载当前角色。
 * @param {{bridge:object, container:HTMLElement, canvasId:string, slotId:string, onState?:(s:string)=>void}} opts
 * @returns {Promise<{ok:boolean, reason?:string, controller?:object}>}
 */
export async function mountAvatar({ bridge, container, canvasId = 'neko-avatar-live2d-canvas', slotId = 'neko-avatar-live2d', onState } = {}) {
  if (!bridge || !container) return { ok: false, reason: 'missing-container' };
  const caps = bridge.status?.capabilities || [];
  if (!caps.includes('avatar-renderer')) return { ok: false, reason: 'no-capability' };

  try { await ensureScripts(); } catch (err) { return { ok: false, reason: `scripts: ${err.message}` }; }
  if (!window.NekoMiniGameAvatarHost?.create) return { ok: false, reason: 'host-unavailable' };

  let controller = null;
  const host = window.NekoMiniGameAvatarHost.create({
    rendererLimit: 1,
    slots: {
      neko: {
        container,
        createController({ signal, fitLive2DModel }) {
          let manager = null;
          let disposed = false;
          const show = () => { container.dataset.renderer = 'live2d'; container.hidden = false; };
          const throwIfAborted = () => {
            if (signal?.aborted) throw Object.assign(new Error('Avatar mount was cancelled'), { name: 'AbortError' });
          };
          async function disposeCurrent() {
            if (!manager) return;
            const current = manager;
            manager = null;
            try { current.destroy?.() ?? current.pauseRendering?.(); } catch { /* ignore */ }
          }
          return {
            async setModel(model) {
              if (disposed) throw new Error('Avatar controller is disposed');
              throwIfAborted();
              await disposeCurrent();
              if (model.type !== 'live2d') throw new Error(`Unsupported avatar type: ${model.type}`);
              const next = window.live2dManager;
              if (!next) throw new Error('Live2D renderer is unavailable');
              show();
              await next.initPIXI(canvasId, slotId, { resizeMode: 'fixed', width: 320, height: 440 });
              manager = next;
              for (const name of ['setupFloatingButtons', 'setupHTMLLockIcon', 'setupReturnButtonContainerDrag']) {
                if (typeof next[name] !== 'function') next[name] = () => {};
              }
              throwIfAborted();
              await next.loadModel(model.path);
              await waitForLive2DModel(next, signal);
              void Promise.resolve(next.setEmotion?.('neutral')).catch(() => undefined);
            },
            focus(point) {
              try { manager?.currentModel?.focus?.(point?.x ?? 0, point?.y ?? 0); } catch { /* cosmetic */ }
            },
            setEmotion(name) {
              try { return manager?.setEmotion?.(name); } catch { return undefined; }
            },
            pause() { return manager?.pauseRendering?.(); },
            resume() { return manager?.resumeRendering?.(); },
            getState() { return { modelType: 'live2d', ready: Boolean(manager) }; },
            resize(viewport, fit) {
              if (!manager?.currentModel) return;
              try {
                manager.pixi_app?.renderer?.resize?.(viewport.width, viewport.height);
                fitLive2DModel?.(manager.currentModel, viewport, fit);
              } catch { /* ignore */ }
            },
            async dispose() {
              if (disposed) return;
              disposed = true;
              await disposeCurrent();
            },
          };
        },
      },
    },
  });

  try {
    const desc = await bridge.getAvatarCharacter();
    if (!desc?.model) { onState?.('no-model'); return { ok: false, reason: 'no-model' }; }
    controller = await bridge.mountAvatar({
      slot: 'neko',
      characterName: desc.name,
      model: desc.model,
      viewport: { mode: 'container' },
      fit: { mode: 'contain', align: 'bottom-center', padding: 4, scaleMultiplier: 1 },
      resize: { mode: 'container' },
    });
    if (!controller) return { ok: false, reason: 'mount-failed' };
    window.__nekoAvatarHost = host;
    window.__nekoAvatarController = controller;
    onState?.('mounted');
    return { ok: true, controller };
  } catch (err) {
    try { host.dispose?.(); } catch { /* ignore */ }
    onState?.('failed');
    return { ok: false, reason: String(err?.message ?? err) };
  }
}
