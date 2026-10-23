// 開発用デバッグパネル（F2で開閉）
// セーブデータには保存しない（実行中の状態だけを書き換える）
import { gameState } from './state';
import { LEVEL_CAP, expForLevel, TRAITS, applyTrait } from '../data/traits';

const KEY_NOENC = 'looprpg-debug-noenc';
const KEY_INVIN = 'looprpg-debug-invin';

const dbg = {
  open: false,
  noEncounter: false,
  invincible: false,
  el: null,
};

try {
  dbg.noEncounter = localStorage.getItem(KEY_NOENC) === '1';
  dbg.invincible = localStorage.getItem(KEY_INVIN) === '1';
} catch (e) { /* no storage */ }

export function debugNoEncounter() { return dbg.noEncounter; }
export function debugInvincible() { return dbg.invincible; }
export function isDebugOpen() { return dbg.open; }

function persist(k, v) {
  try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) { /* noop */ }
}

function activeScene() {
  const g = window.game;
  if (!g) return null;
  return g.scene.getScenes(true)[0] || null;
}

function refresh() {
  const s = activeScene();
  if (!s) return;
  if (typeof s.refreshStatus === 'function') s.refreshStatus();
  if (typeof s.drawPlayer === 'function') s.drawPlayer();
}

function fmt() {
  const p = gameState.player;
  return `Lv${p.lv}  HP ${p.hp}/${p.maxHp}  ATK ${p.atk}  G ${p.gold}  草 ${p.herbs}  銅 ${(p.mats && p.mats.copper) || 0}`;
}

function updateReadout() {
  if (!dbg.el) return;
  const p = gameState.player;
  dbg.el.querySelector('#dbg-read').textContent = fmt();
  dbg.el.querySelector('[data-act="noenc"]').classList.toggle('on', dbg.noEncounter);
  dbg.el.querySelector('[data-act="noenc"]').textContent = `エンカウント無効: ${dbg.noEncounter ? 'ON' : 'OFF'}`;
  dbg.el.querySelector('[data-act="invin"]').classList.toggle('on', dbg.invincible);
  dbg.el.querySelector('[data-act="invin"]').textContent = `無敵: ${dbg.invincible ? 'ON' : 'OFF'}`;
  const n = Object.keys(p.traits || {}).length;
  dbg.el.querySelector('#dbg-traits').textContent = `特性 ${n}種 / 所持 ${Object.values(p.traits || {}).reduce((a, b) => a + b, 0)}`;
}

const ACTIONS = {
  maxLevel: () => {
    const p = gameState.player;
    while (p.lv < LEVEL_CAP) {
      p.lv += 1;
      p.maxHp += 6 + p.growthHp;
      p.atk += 1;
    }
    p.exp = 0;
    p.next = expForLevel(p.lv);
    p.hp = p.maxHp;
  },
  heal: () => {
    const p = gameState.player;
    p.hp = p.maxHp;
    if (p.prayed) p.prayed = false;
  },
  gold: () => { gameState.player.gold += 1000; },
  herbs: () => { gameState.player.herbs += 10; },
  copper: () => { gameState.player.mats.copper = (gameState.player.mats.copper || 0) + 10; },
  allTraits: () => {
    const p = gameState.player;
    for (const t of TRAITS) {
      const have = p.traits[t.id] || 0;
      for (let i = have; i < t.maxStacks; i += 1) applyTrait(p, t.id);
    }
  },
  order: () => { gameState.hasOrder = true; },
  key: () => { gameState.hasKey = true; gameState.hasOrder = true; },
  gate: () => { gameState.gateOpen = true; },
  boss: () => { gameState.bossDefeated = true; gameState.hasOrder = true; },
};

const SCENES = {
  field: () => ({ key: 'field', data: {} }),
  town: () => ({ key: 'town', data: { townId: 'v_start', spawn: true } }),
  castle: () => ({ key: 'town', data: { townId: 'castle', spawn: true } }),
  dungeon: () => ({ key: 'dungeon', data: { floor: 0 } }),
};

function goScene(name) {
  const g = window.game;
  const target = SCENES[name]();
  for (const k of ['field', 'town', 'dungeon', 'battle']) {
    if (g.scene.isActive(k)) g.scene.stop(k);
  }
  g.scene.start(target.key, target.data);
  updateReadout();
}

function build() {
  const el = document.createElement('div');
  el.id = 'debug-panel';
  el.innerHTML = `
    <div class="dbg-head">
      <span>DEBUG</span>
      <button class="dbg-x" data-act="close">×</button>
    </div>
    <div id="dbg-read" class="dbg-read"></div>
    <div id="dbg-traits" class="dbg-sub"></div>
    <div class="dbg-grid">
      <button data-act="maxLevel">レベル最強</button>
      <button data-act="heal">HP全回復</button>
      <button data-act="gold">G +1000</button>
      <button data-act="herbs">やくそう +10</button>
      <button data-act="copper">銅 +10</button>
      <button data-act="allTraits">特性を全部</button>
      <button data-act="noenc" class="toggle">エンカウント無効: OFF</button>
      <button data-act="invin" class="toggle">無敵: OFF</button>
      <button data-act="order">王命を付与</button>
      <button data-act="key">鍵を付与</button>
      <button data-act="gate">門番を突破</button>
      <button data-act="boss">ボス撃破扱い</button>
    </div>
    <div class="dbg-sub">移動</div>
    <div class="dbg-grid">
      <button data-scene="field">フィールド</button>
      <button data-scene="town">はじまりの村</button>
      <button data-scene="castle">城</button>
      <button data-scene="dungeon">坑道</button>
    </div>
    <div class="dbg-note">F2で開閉 / 変更はセーブされません</div>
  `;
  document.body.appendChild(el);
  dbg.el = el;

  el.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    ev.preventDefault();
    const act = btn.dataset.act;
    const scene = btn.dataset.scene;
    if (act === 'close') { toggleDebug(false); return; }
    if (act === 'noenc') {
      dbg.noEncounter = !dbg.noEncounter;
      persist(KEY_NOENC, dbg.noEncounter);
    } else if (act === 'invin') {
      dbg.invincible = !dbg.invincible;
      persist(KEY_INVIN, dbg.invincible);
    } else if (act && ACTIONS[act]) {
      ACTIONS[act]();
      refresh();
    } else if (scene) {
      goScene(scene);
    }
    updateReadout();
  });

  const style = document.createElement('style');
  style.textContent = `
    #debug-panel {
      position: fixed; top: 8px; right: 8px; width: 300px; z-index: 9999;
      background: rgba(6,6,24,0.94); border: 2px solid #8fd3ff; color: #e8f5e9;
      font-family: monospace; font-size: 12px; padding: 8px; display: none;
      box-shadow: 0 4px 18px rgba(0,0,0,0.6); border-radius: 4px;
    }
    #debug-panel.open { display: block; }
    #debug-panel .dbg-head { display: flex; justify-content: space-between; align-items: center; color: #7fffaf; font-weight: bold; margin-bottom: 6px; letter-spacing: 1px; }
    #debug-panel .dbg-x { background: transparent; border: 1px solid #557; color: #fff; cursor: pointer; width: 22px; height: 20px; line-height: 1; }
    #debug-panel .dbg-read { color: #ff0; margin-bottom: 2px; }
    #debug-panel .dbg-sub { color: #8fd3ff; margin: 6px 0 4px; }
    #debug-panel .dbg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
    #debug-panel button { font-family: monospace; font-size: 11.5px; padding: 5px 4px; cursor: pointer;
      background: #1a1a50; color: #fff; border: 1px solid #557; border-radius: 3px; }
    #debug-panel button:hover { background: #2b2b78; border-color: #8fd3ff; }
    #debug-panel button.toggle.on { background: #1b5e20; border-color: #7fffaf; color: #b9ffcf; }
    #debug-panel .dbg-note { color: #888; margin-top: 6px; font-size: 10.5px; }
  `;
  document.head.appendChild(style);
}

export function toggleDebug(force) {
  if (!dbg.el) build();
  dbg.open = typeof force === 'boolean' ? force : !dbg.open;
  dbg.el.classList.toggle('open', dbg.open);
  if (dbg.open) updateReadout();
}

export function initDebug() {
  build();
  updateReadout();
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      toggleDebug();
    }
  }, true);
  // ?debug=1 で最初から開いておく
  try {
    if (new URLSearchParams(location.search).get('debug') === '1') toggleDebug(true);
  } catch (e) { /* noop */ }
  // 状態表示をゆるく更新
  setInterval(() => { if (dbg.open) updateReadout(); }, 600);
}
