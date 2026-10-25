/**
 * neko-avatar-provider.js —— 头像 provider（**经典脚本**，必须在 bootstrap 之前加载）
 *
 * 为什么必须是经典脚本：N.E.K.O 在 **connect 握手时**决定是否授予 `avatar-renderer`，
 * 依据是 launch 节点上 `nekoCapabilityProviders[gameId].avatarHostFactory` 是否存在。
 * bootstrap 会立刻消费并删除 launch 节点，所以 factory 必须在它之前挂好（同步）。
 *
 * 真正的渲染发生在 `avatar.mount()` 之后（mount 里才 initPIXI / loadModel）。
 * 失败只影响形象，不影响游戏 —— factory 返回 null 时宿主照常握手。
 */
(function (global) {
  'use strict';

  function container() {
    return global.document?.getElementById?.('neko-avatar-live2d') || null;
  }

  function createController(ctx, slot) {
    var signal = ctx?.signal;
    var fitLive2DModel = null;
    var manager = null;
    var disposed = false;
    var modelType = '';

    function throwIfAborted() {
      if (signal && signal.aborted) {
        var err = new Error('Avatar mount was cancelled');
        err.name = 'AbortError';
        throw err;
      }
    }

    function show() {
      var box = container();
      if (!box) return;
      box.hidden = false;
      box.dataset.renderer = 'live2d';
    }

    function disposeCurrent() {
      if (!manager) return;
      var current = manager;
      manager = null;
      try {
        if (typeof current.destroy === 'function') current.destroy();
        else if (typeof current.pauseRendering === 'function') current.pauseRendering();
      } catch (_) { /* cosmetic */ }
    }

    function waitForModel(host, timeoutMs) {
      var started = Date.now();
      return new Promise(function (resolve, reject) {
        function tick() {
          if (signal && signal.aborted) {
            var err = new Error('Avatar mount was cancelled');
            err.name = 'AbortError';
            reject(err);
            return;
          }
          var model = host.currentModel;
          if (model && model.width && model.height) { resolve(model); return; }
          if (Date.now() - started > (timeoutMs || 15000)) { reject(new Error('Live2D model timeout')); return; }
          setTimeout(tick, 120);
        }
        tick();
      });
    }

    return {
      async setModel(model) {
        if (disposed) throw new Error('Avatar controller is disposed');
        throwIfAborted();
        await disposeCurrent();
        modelType = model.type;
        if (model.type !== 'live2d') throw new Error('Unsupported avatar type: ' + model.type);
        var host = global.live2dManager;
        if (!host) throw new Error('Live2D renderer is unavailable');
        show();
        await host.initPIXI('neko-avatar-live2d-canvas', 'neko-avatar-live2d', {
          resizeMode: 'fixed',
          width: 320,
          height: 440,
        });
        manager = host;
        ['setupFloatingButtons', 'setupHTMLLockIcon', 'setupReturnButtonContainerDrag'].forEach(function (name) {
          if (typeof host[name] !== 'function') host[name] = function () {};
        });
        throwIfAborted();
        await host.loadModel(model.path);
        await waitForModel(host);
        try { host.setEmotion && host.setEmotion('neutral'); } catch (_) { /* cosmetic */ }
      },
      focus(point) {
        try { manager && manager.currentModel && manager.currentModel.focus && manager.currentModel.focus(point.x || 0, point.y || 0); } catch (_) { /* cosmetic */ }
      },
      setEmotion(name) {
        try { return manager && manager.setEmotion ? manager.setEmotion(name) : undefined; } catch (_) { return undefined; }
      },
      pause() { try { return manager && manager.pauseRendering ? manager.pauseRendering() : undefined; } catch (_) { return undefined; } },
      resume() { try { return manager && manager.resumeRendering ? manager.resumeRendering() : undefined; } catch (_) { return undefined; } },
      getState() { return { modelType: modelType, ready: Boolean(manager) }; },
      resize(viewport, fit) {
        if (!manager || !manager.currentModel) return;
        try {
          if (manager.pixi_app && manager.pixi_app.renderer) manager.pixi_app.renderer.resize(viewport.width, viewport.height);
          if (typeof fitLive2DModel === 'function') fitLive2DModel(manager.currentModel, viewport, fit);
        } catch (_) { /* cosmetic */ }
      },
      async dispose() {
        if (disposed) return;
        disposed = true;
        await disposeCurrent();
      },
    };
  }

  /**
   * bootstrap 读取的 factory：同步返回 provider（否则握手会忽略它）。
   * 容器不存在时返回 null —— 能力不授予，但游戏照常。
   */
  global.createKongxiangAvatarHost = function createKongxiangAvatarHost(options) {
    try {
      if (!global.NekoMiniGameAvatarHost || typeof global.NekoMiniGameAvatarHost.create !== 'function') return null;
      var box = container();
      if (!box) return null;
      return global.NekoMiniGameAvatarHost.create({
        rendererLimit: 1,
        slots: {
          neko: {
            container: box,
            createController: function (ctx) {
              var controller = createController(ctx, 'neko');
              return controller;
            },
          },
        },
      });
    } catch (_) {
      return null;
    }
  };
})(window);
