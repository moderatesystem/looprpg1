// 効果音のみ（BGMなし）。Mキーで消音、localStorageに保存
let actx = null;
let master = null;
let muted = false;
try { muted = localStorage.getItem('expedition-muted') === '1'; } catch (e) { /* noop */ }

function ac() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = muted ? 0 : 0.35;
    master.connect(actx.destination);
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

export function isMuted() { return muted; }

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('expedition-muted', muted ? '1' : '0'); } catch (e) { /* noop */ }
  if (master) master.gain.value = muted ? 0 : 0.35;
  return muted;
}

export function beep(freq = 440, ms = 80, type = 'square', vol = 0.05) {
  if (muted) return;
  try {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(master);
    o.start();
    setTimeout(() => { try { o.stop(); } catch (e) { /* noop */ } }, ms);
  } catch (e) { /* noop */ }
}

const SEQ = {
  click: [[660, 40]],
  hit: [[220, 60], [160, 70]],
  heal: [[700, 60], [900, 80]],
  skill: [[880, 50], [1100, 60]],
  win: [[523, 100], [659, 100], [784, 140]],
  lose: [[300, 160], [220, 200]],
  step: [[520, 40]],
};

export function sfx(name) {
  const seq = SEQ[name] || SEQ.click;
  seq.forEach(([f, ms], i) => setTimeout(() => beep(f, ms), i * 90));
}
