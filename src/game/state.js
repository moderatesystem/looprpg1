// キャンプ↔坑道シーン間で共有する可変状態（シーン切替えでも保持される）
import { basePlayer } from '../data/traits.js';
import { CAMP_START } from '../data/fieldMap.js';

// seed由来の周回変化プール
export const BOSS_NAMES = ['坑底のぬし', '深淵のぬし', '岩盤のぬし'];
export const CHEST_TRAITS = ['skin', 'tough', 'power'];

// 鉱脈候補（ '.' タイルであること。検証スクリプトが保証する）
export const VEIN_SPOTS = {
  0: [[2, 2], [5, 2], [9, 2], [4, 5], [8, 5], [12, 5], [2, 8], [6, 8], [11, 8]],
  1: [[3, 12], [7, 12], [11, 12]],
};
export const VEINS_PER_FLOOR = { 0: 3, 1: 1 };

export function rngFromSeed(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickN(rng, arr, n) {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

export function generateVeins(seed) {
  const rng = rngFromSeed(seed);
  return {
    0: pickN(rng, VEIN_SPOTS[0], VEINS_PER_FLOOR[0]),
    1: pickN(rng, VEIN_SPOTS[1], VEINS_PER_FLOOR[1]),
  };
}

export function pickFromSeed(seed, arr, salt) {
  const rng = rngFromSeed((seed ^ salt) >>> 0);
  return arr[Math.floor(rng() * arr.length)];
}

export const gameState = {
  player: basePlayer(),
  px: CAMP_START.x,
  py: CAMP_START.y,
  map: 'camp',
  floor: 0,
  seed: 1,
  loop: 1,
  veins: { 0: [], 1: [] },
  bossName: BOSS_NAMES[0],
  chestTrait: CHEST_TRAITS[0],
  hasOrder: false,
  cleared: false,
  chestOpened: false,
  bossDefeated: false,
  hasKey: false,
  weaponBought: false,
  shopBought: {},
  mineMined: {},
  townId: null,
  fieldX: 0,
  fieldY: 0,
  castleChests: {},
  pendingMsg: null,
  encounterGraceUntil: 0,
  initialized: false,
};

function applyLoopSetup(loop, seed) {
  gameState.loop = loop;
  gameState.seed = seed >>> 0;
  gameState.veins = generateVeins(gameState.seed);
  gameState.bossName = pickFromSeed(gameState.seed, BOSS_NAMES, 0x9e37);
  gameState.chestTrait = pickFromSeed(gameState.seed, CHEST_TRAITS, 0x51f3);
}

export function resetState(sx, sy) {
  gameState.player = basePlayer();
  gameState.px = sx;
  gameState.py = sy;
  gameState.map = 'camp';
  gameState.floor = 0;
  applyLoopSetup(loadMeta().loops || 1, (Math.random() * 1e9) | 0);
  gameState.hasOrder = false;
  gameState.cleared = false;
  gameState.chestOpened = false;
  gameState.bossDefeated = false;
  gameState.hasKey = false;
  gameState.weaponBought = false;
  gameState.shopBought = {};
  gameState.mineMined = {};
  gameState.townId = null;
  gameState.fieldX = 0;
  gameState.fieldY = 0;
  gameState.castleChests = {};
  gameState.pendingMsg = null;
  gameState.encounterGraceUntil = 0;
  gameState.initialized = true;
}

// 次の周回へ：進行リセット＋seed更新＋痕跡は別保存のため保持される
export function startNextLoop() {
  const meta = loadMeta();
  meta.loops = (meta.loops || 1) + 1;
  saveMeta(meta);
  const sx = CAMP_START.x;
  const sy = CAMP_START.y;
  resetState(sx, sy);
  gameState.loop = meta.loops;
}

const SAVE_KEY = 'looprpg1-save-v1';
const META_KEY = 'looprpg1-meta';
const LEGACY_KEY = 'looprpg1-legacy';

export function saveGame() {
  try {
    const data = {
      player: gameState.player,
      px: gameState.px,
      py: gameState.py,
      map: gameState.map,
      floor: gameState.floor,
      seed: gameState.seed,
      loop: gameState.loop,
      veins: gameState.veins,
      bossName: gameState.bossName,
      chestTrait: gameState.chestTrait,
      hasOrder: gameState.hasOrder,
      cleared: gameState.cleared,
      chestOpened: gameState.chestOpened,
      bossDefeated: gameState.bossDefeated,
      hasKey: gameState.hasKey,
      weaponBought: gameState.weaponBought,
      shopBought: gameState.shopBought,
      mineMined: gameState.mineMined,
      townId: gameState.townId,
      fieldX: gameState.fieldX,
      fieldY: gameState.fieldY,
      castleChests: gameState.castleChests,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    gameState.player = { ...basePlayer(), ...d.player };
    if (!gameState.player.mats) gameState.player.mats = { copper: 0 };
    gameState.px = d.px;
    gameState.py = d.py;
    gameState.map = d.map || 'camp';
    gameState.floor = d.floor || 0;
    gameState.seed = d.seed || 1;
    gameState.loop = d.loop || 1;
    gameState.veins = d.veins && d.veins[0] ? d.veins : generateVeins(gameState.seed);
    gameState.bossName = d.bossName || BOSS_NAMES[0];
    gameState.chestTrait = d.chestTrait || CHEST_TRAITS[0];
    gameState.hasOrder = !!d.hasOrder;
    gameState.cleared = !!d.cleared;
    gameState.chestOpened = !!d.chestOpened;
    gameState.bossDefeated = !!d.bossDefeated;
    gameState.hasKey = !!d.hasKey;
    gameState.weaponBought = !!d.weaponBought;
    gameState.shopBought = d.shopBought || {};
    gameState.mineMined = d.mineMined || {};
    gameState.townId = d.townId || null;
    gameState.fieldX = d.fieldX || 0;
    gameState.fieldY = d.fieldY || 0;
    gameState.castleChests = d.castleChests || {};
    gameState.pendingMsg = '冒険の記録から再開した！（つづきからスタート）';
    gameState.encounterGraceUntil = Date.now() + 1500;
    gameState.initialized = true;
    return true;
  } catch (e) {
    return false;
  }
}

export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { loops: 1, clears: 0 };
    const d = JSON.parse(raw);
    return { loops: d.loops || 1, clears: d.clears || 0 };
  } catch (e) {
    return { loops: 1, clears: 0 };
  }
}

export function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (e) { /* 続行 */ }
}

// 痕跡：クリア時に次の周回への置き土産を残す
export function writeLegacy(loop) {
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ copper: 2, herbs: 1, fromLoop: loop }));
  } catch (e) { /* 続行 */ }
}

export function takeLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    localStorage.removeItem(LEGACY_KEY);
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// 全滅＝所持金半減・キャンプ復活（経験・特性は保持）
export function respawn() {
  const p = gameState.player;
  p.gold = Math.floor(p.gold / 2);
  p.hp = p.maxHp;
  p.prayed = false;
  gameState.px = CAMP_START.x;
  gameState.py = CAMP_START.y;
  gameState.map = 'camp';
  gameState.floor = 0;
  gameState.townId = null;
  gameState.pendingMsg = '門兵「おっと、倒れていたぞ！ 城まで運んでやった。半分のゴールドは治療代だ。再び行くのだ！」';
}
