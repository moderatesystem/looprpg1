// 簡易サウンド（素材前仮置き）：beep＋ジングル＋簡易BGM
let actx = null;
let master = null;
let bgmTimer = null;
let bgmStep = 0;
let bgmKind = null;
let muted = false;
try { muted = localStorage.getItem('looprpg-muted') === '1'; } catch (e) { /* no storage */ }

function ac() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(actx.destination);
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

export function isMuted() { return muted; }

export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem('looprpg-muted', muted ? '1' : '0'); } catch (e) { /* noop */ }
  if (master) master.gain.value = muted ? 0 : 0.5;
  if (muted) {
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  } else if (bgmKind) {
    startBgm(bgmKind);
  }
  return muted;
}

export function toggleMute() { return setMuted(!muted); }

// タブが隠れたら必ず無音（復帰時に元のBGMへ戻す）
function onVisibility() {
  if (typeof document === 'undefined') return;
  if (document.hidden) {
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    try { if (actx && actx.state === 'running') actx.suspend(); } catch (e) { /* noop */ }
  } else if (actx && !muted) {
    try { actx.resume(); } catch (e) { /* noop */ }
    if (bgmKind && !bgmTimer) startBgm(bgmKind);
  }
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => {
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    try { if (actx) actx.suspend(); } catch (e) { /* noop */ }
  });
}

export function beep(freq = 440, ms = 70, type = 'square', vol = 0.04) {
  if (muted) return;
  try {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(master);
    o.start();
    setTimeout(() => { try { o.stop(); } catch (e) {} }, ms);
  } catch (e) { /* 音なしでも続行 */ }
}

const JINGLES = {
  victory: [523, 659, 784, 1047],
  levelup: [523, 523, 659, 784, 784, 1047],
  inn: [392, 440, 523, 659],
  chest: [784, 880, 1175],
  escape: [660, 440],
  crit: [900, 1200],
  poison: [200, 150],
  pray: [880, 880, 1175],
  boss: [110, 90, 70, 55],
  shop: [784, 1047],
};

export function jingle(name) {
  if (muted) return;
  const notes = JINGLES[name] || [440];
  notes.forEach((f, i) => {
    setTimeout(() => beep(f, 110, 'square', 0.05), i * 100);
  });
}

const BGMS = {
  field: { step: 300, notes: [392, 0, 523, 0, 587, 0, 523, 0] },
  battle: { step: 220, notes: [196, 0, 262, 0, 175, 0, 220, 0] },
  dungeon: { step: 420, notes: [110, 0, 0, 131, 0, 0, 98, 0] },
};

export function startBgm(kind) {
  stopBgm();
  bgmKind = kind;
  const bgm = BGMS[kind];
  if (!bgm || muted) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  bgmStep = 0;
  try {
    bgmTimer = setInterval(() => {
      if (muted) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      const f = bgm.notes[bgmStep % bgm.notes.length];
      bgmStep += 1;
      if (f > 0) beep(f, bgm.step * 0.9, 'triangle', 0.010);
    }, bgm.step);
  } catch (e) { /* 音なしでも続行 */ }
}

export function stopBgm() {
  if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  bgmKind = null;
}

// 画面遷移時の保険：予約済みの音も含めて即座に止める
export function silenceAll() {
  if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  try { if (actx && actx.state === 'running') actx.suspend(); } catch (e) { /* noop */ }
}
