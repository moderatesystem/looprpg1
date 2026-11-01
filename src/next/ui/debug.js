// 開発用（F2）。DOMパネルから直接メタを書き換える
import { loadMeta, saveMeta, resetMeta } from '../core/state.js';

let el = null;
let open = false;

function build() {
  el = document.createElement('div');
  el.id = 'debug-panel';
  el.innerHTML = `
    <div class="dbg-head"><span>DEBUG</span><button data-d="close">×</button></div>
    <div class="dbg-read"></div>
    <div class="dbg-grid">
      <button data-d="gold">G +200</button>
      <button data-d="scout">斥候 +1</button>
      <button data-d="day">日数 +1</button>
      <button data-d="heal">パーティ全回復</button>
      <button data-d="reset">セーブ初期化</button>
    </div>
    <div class="dbg-note">F2で開閉</div>
  `;
  document.body.appendChild(el);
  const style = document.createElement('style');
  style.textContent = `
    #debug-panel{position:fixed;top:10px;left:10px;z-index:9999;width:240px;display:none;
      background:#060a18ee;border:1px solid #8fd3ff;border-radius:8px;padding:8px;font-size:12px;color:#e8eefc}
    #debug-panel.open{display:block}
    #debug-panel .dbg-head{display:flex;justify-content:space-between;align-items:center;color:#7fffaf;font-weight:bold;margin-bottom:6px}
    #debug-panel .dbg-read{color:#ffd54f;margin-bottom:6px}
    #debug-panel .dbg-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}
    #debug-panel button{font-family:inherit;font-size:11px;padding:6px 4px;border:1px solid #35507f;background:#16213f;color:#fff;border-radius:4px}
    #debug-panel .dbg-note{color:#7f90b8;font-size:10px;margin-top:6px}
  `;
  document.head.appendChild(style);

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset.d;
    const m = loadMeta();
    if (d === 'close') { toggle(false); return; }
    if (d === 'gold') m.gold += 200;
    if (d === 'scout') m.scout = Math.min(4, m.scout + 1);
    if (d === 'day') m.days += 1;
    if (d === 'reset') { resetMeta(); m.gold = 60; m.scout = 0; m.days = 0; }
    if (d === 'heal') window.dispatchEvent(new CustomEvent('app:heal'));
    if (d !== 'heal') saveMeta(m);
    window.dispatchEvent(new CustomEvent('app:refresh'));
    update();
  });
}

function update() {
  if (!el) return;
  const m = loadMeta();
  el.querySelector('.dbg-read').textContent = `日数 ${m.days} / G ${m.gold} / 斥候 ${m.scout} / クリア ${m.clears}`;
}

export function toggle(force) {
  if (!el) build();
  open = typeof force === 'boolean' ? force : !open;
  el.classList.toggle('open', open);
  if (open) update();
}

export function initDebug() {
  build();
  update();
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') { e.preventDefault(); toggle(); }
  }, true);
  window.addEventListener('app:refresh', update);
  if (new URLSearchParams(location.search).get('debug') === '1') toggle(true);
}
