/**
 * chat-ui.js —— 游戏内「对话」区（接活既有占位，不另起浮窗）
 *
 * 两种模式：
 *   · 页面里有 `#neko-chat`（游戏自带的右列对话区）⇒ **原地接管**：清掉占位、
 *     追加消息、在下面补输入框；标题旁的 `#neko-chat-badge` 显示连接状态。
 *   · 没有该容器（被单独嵌进别的页面）⇒ 退化成右下角浮窗。
 *
 * 设计原则：
 *   · 只调用桥的 `chat()` / `speak()`，动作仍由 `dispatchNekoActions` 执行；
 *   · 失败可见：状态行显示 connected / 能力数 / lastError，便于排查"对话没触发"；
 *   · L2D 由 N.E.K.O **主窗口**渲染；本页不嵌模型，页脚给「独立窗口」按钮，
 *     在浏览器新窗口打开本页时主窗口的 L2D 不会被顶掉。
 */
export function createChatUi({ bridge, getState } = {}) {
  const inlineHost = document.getElementById('neko-chat');
  const inline = Boolean(inlineHost);

  const style = document.createElement('style');
  style.textContent = `
  .neko-chat-row { display:flex; gap:6px; margin-top:8px; }
  .neko-chat-row textarea { flex:1; min-width:0; resize:none; height:34px; max-height:96px;
    padding:6px 8px; border-radius:8px; border:1px solid var(--line); background:var(--bg-card);
    color:var(--text); font:inherit; outline:none; }
  .neko-chat-row textarea:focus { border-color:#7aa2ff; }
  .neko-chat-row button { flex:none; padding:0 14px; height:34px; border-radius:8px; border:0;
    cursor:pointer; background:#7aa2ff; color:#0b0f1a; font-weight:600; }
  .neko-chat-row button:disabled { opacity:.5; cursor:default; }
  .neko-chat-foot { display:flex; gap:8px; align-items:center; margin-top:6px; font-size:12px; color:var(--text-dim); }
  .neko-chat-foot span { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .neko-chat-foot button { border:1px solid var(--line); background:none; color:var(--text-dim);
    border-radius:6px; padding:2px 8px; cursor:pointer; font-size:12px; }
  .neko-msg.neko { background:var(--bg-card); border:1px solid var(--line); }
  .neko-msg .neko-act { display:block; margin-top:4px; color:#fbbf24; font-size:12px; }
  `;
  document.head.appendChild(style);

  // 容器：优先用页面自带的 #neko-chat；否则建浮窗
  let root;
  let logEl;
  let statusEl;
  let badgeEl = document.getElementById('neko-chat-badge');
  let floatMode = false;
  if (inline) {
    root = inlineHost;
    logEl = inlineHost;
    logEl.innerHTML = '';
    statusEl = document.createElement('div');
    statusEl.className = 'neko-chat-foot';
    const span = document.createElement('span');
    span.id = 'neko-chat-status';
    span.textContent = '未连接';
    const pop = document.createElement('button');
    pop.textContent = '独立窗口';
    pop.title = '在浏览器新窗口打开本页：主窗口的 L2D 不会被顶掉';
    pop.addEventListener('click', () => { try { window.open(location.href, '_blank', 'noopener'); } catch { /* ignore */ } });
    statusEl.append(span, pop);
    root.after(statusEl);
    statusEl.id = 'neko-chat-foot';
  } else {
    floatMode = true;
    root = document.createElement('div');
    root.id = 'neko-chat-float';
    Object.assign(root.style, {
      position: 'fixed', right: '16px', bottom: '16px', width: '340px',
      background: 'rgba(10,12,18,0.94)', color: '#e8ecf5', borderRadius: '12px',
      border: '1px solid rgba(122,162,255,.35)', boxShadow: '0 8px 32px rgba(0,0,0,.45)',
      zIndex: 9999, padding: '10px', font: "13px/1.5 system-ui,'Segoe UI','Microsoft YaHei',sans-serif",
    });
    logEl = document.createElement('div');
    logEl.className = 'neko-chat';
    logEl.style.maxHeight = '260px';
    logEl.style.overflowY = 'auto';
    root.appendChild(logEl);
    statusEl = document.createElement('div');
    statusEl.className = 'neko-chat-foot';
    statusEl.innerHTML = '<span id="neko-chat-status">未连接</span>';
    root.appendChild(statusEl);
    document.body.appendChild(root);
  }

  const row = document.createElement('div');
  row.className = 'neko-chat-row';
  row.innerHTML = '<textarea rows="1" placeholder="跟她说点什么…（Enter 发送）"></textarea><button>发送</button>';
  const inputEl = row.querySelector('textarea');
  const sendEl = row.querySelector('button');
  if (inline) statusEl.before(row);
  else root.insertBefore(row, statusEl);

  const statusText = () => document.getElementById('neko-chat-status');
  let herName = '她';
  let lastActivityAt = Date.now();
  let hostSummary = '';
  const history = [];
  let pending = false;

  function addMessage(role, text, extra) {
    lastActivityAt = Date.now();
    const el = document.createElement('div');
    el.className = `neko-msg ${role === 'user' ? 'you' : role === 'sys' ? 'sys' : 'neko'}`;
    if (role === 'neko') el.classList.add('her');
    el.textContent = text;
    if (extra) {
      const act = document.createElement('span');
      act.className = 'neko-act';
      act.textContent = extra;
      el.appendChild(act);
    }
    logEl.appendChild(el);
    logEl.scrollTop = logEl.scrollHeight;
    return el;
  }

  function setStatus() {
    const status = bridge?.status ?? {};
    const caps = status.capabilities || [];
    if (status.characterName) herName = status.characterName;
    const text = status.connected
      ? `${herName}已连接 · ${caps.length} 项能力`
      : (status.lastError ? `未连接：${status.lastError}` : '未连接（等宿主）');
    const span = statusText();
    if (span) { span.textContent = text; span.title = status.lastError || caps.join(', '); }
    if (badgeEl) {
      badgeEl.textContent = status.connected ? '已接入' : (status.lastError ? '连接失败' : '未接入');
    }
  }

  async function send(text) {
    const line = String(text ?? inputEl.value ?? '').trim();
    if (!line || pending) return false;
    if (!bridge?.chat) { addMessage('sys', '桥未就绪'); return false; }
    inputEl.value = '';
    addMessage('user', line);
    pending = true;
    sendEl.disabled = true;
    try {
      const result = await bridge.chat(line, { history, contextNote: hostSummary });
      if (!result?.ok) {
        addMessage('sys', `没接通：${result?.reason || '未知原因'}`);
        return false;
      }
      const controlLabel = result.control?.action
        ? `已执行：${result.control.action.type}${result.control.action.id ? ' / ' + result.control.action.id : ''}`
        : '';
      addMessage('neko', result.line || '（她没说话）', controlLabel);
      if (result.line) {
        history.push({ role: 'user', content: line });
        history.push({ role: 'assistant', content: result.line });
        while (history.length > 8) history.shift();
      }
      // 让主窗口的 L2D 开口（没有 speech-output 能力时静默跳过）
      try { await bridge.speak?.(result.line || ''); } catch { /* 语音失败不影响文本 */ }
      return true;
    } finally {
      pending = false;
      sendEl.disabled = false;
      setStatus();
    }
  }

  /**
   * 每 60 秒的主动搭话：没人说话时她自己找话题；可顺手做个划算的操作。
   * 只在页面可见、已连接、距上次消息 ≥55 秒时触发。
   */
  async function proactive(force = false) {
    if (!bridge?.proactive || pending) return false;
    if (document.visibilityState === 'hidden') return false;
    if (!bridge.status?.connected) return false;
    if (!force && Date.now() - lastActivityAt < 55000) return false;
    pending = true;
    sendEl.disabled = true;
    try {
      const result = await bridge.proactive(getState?.());
      if (!result?.ok || !result.line) return false;
      const controlLabel = result.control?.action
        ? `已执行：${result.control.action.type}${result.control.action.id ? ' / ' + result.control.action.id : ''}`
        : '';
      addMessage('neko', result.line, controlLabel);
      try { await bridge.speak?.(result.line); } catch { /* 语音失败不影响文本 */ }
      return true;
    } catch {
      return false;
    } finally {
      pending = false;
      sendEl.disabled = false;
      setStatus();
    }
  }

  sendEl.addEventListener('click', () => { void send(); });
  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  });

  const status0 = bridge?.status ?? {};
  if (status0.characterName) herName = status0.characterName;
  setStatus();
  addMessage('sys', inline
    ? '在游戏里直接跟她说话；她会回台词，必要时替你操作（买升级 / 坍缩 / 永恒）。'
    : '独立窗口模式：主窗口的 L2D 不受影响。');
  const timer = setInterval(setStatus, 2000);

  // 连上后拉一次宿主上下文：把**桌面聊天**的摘要带进游戏（"同步聊天"的可用部分）
  let contextLoaded = false;
  const contextTimer = setInterval(async () => {
    if (contextLoaded) { clearInterval(contextTimer); return; }
    if (!bridge?.status?.connected || !bridge.readHostContext) return;
    contextLoaded = true;
    clearInterval(contextTimer);
    try {
      const ctx = await bridge.readHostContext();
      if (ctx?.name) { herName = ctx.name; setStatus(); }
      if (ctx?.summary) {
        hostSummary = ctx.summary;
        addMessage('sys', `她记得桌面上聊过：${ctx.summary.slice(0, 100)}${ctx.summary.length > 100 ? '…' : ''}`);
      }
    } catch { /* 摘要读不到不影响聊天 */ }
  }, 2000);

  // 每 15 秒检查一次：距上次消息 ≥55 秒就让她主动搭话（真正的 60 秒节奏）
  const proactiveTimer = setInterval(() => { void proactive(); }, 15000);

  return {
    root,
    floatMode,
    addMessage,
    send,
    proactive,
    setStatus,
    dispose() {
      clearInterval(timer);
      clearInterval(contextTimer);
      clearInterval(proactiveTimer);
      if (floatMode) root.remove();
      style.remove();
    },
  };
}
