/**
 * neko/avatar.js —— 把当前角色挂到页面里的槽位（薄封装）
 *
 * 渲染器本身由 `avatar-provider.js`（经典脚本）在 **connect 之前**注册给宿主；
 * 这里只负责：等 runtime 跑起来 → 取当前角色 → `avatar.mount`。
 * 任何一步失败都返回原因（页面显示为"不可用"），不影响游戏。
 */
export async function mountAvatar({ bridge, timeoutMs = 30000 } = {}) {
  if (!bridge) return { ok: false, reason: 'no-bridge' };

  // 等 runtime 进入 running（avatar.mount 要求活跃路由）
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = bridge.status || {};
    if (status.connected && status.runtimeReady) break;
    if (status.lastError) return { ok: false, reason: status.lastError };
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  const status = bridge.status || {};
  if (!status.connected) return { ok: false, reason: status.lastError || 'not-connected' };
  if (!(status.capabilities || []).includes('avatar-renderer')) return { ok: false, reason: 'no-capability' };

  const desc = await bridge.getAvatarCharacter();
  if (!desc || !desc.model) return { ok: false, reason: 'no-model' };

  const controller = await bridge.mountAvatar({
    slot: 'neko',
    characterName: desc.name,
    model: desc.model,
    viewport: { mode: 'container' },
    fit: { mode: 'contain', align: 'bottom-center', padding: 4, scaleMultiplier: 1 },
    resize: { mode: 'container' },
  });
  if (!controller) return { ok: false, reason: 'mount-failed' };
  window.__nekoAvatarController = controller;
  return { ok: true, controller };
}
