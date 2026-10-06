// キャンプ↔坑道シーン間で共有する可変状態（シーン切替えでも保持される）
import { basePlayer } from '../data/traits';
import { CAMP_START } from '../data/fieldMap';

export const gameState = {
  player: basePlayer(),
  px: CAMP_START.x,
  py: CAMP_START.y,
  map: 'camp',
  floor: 0,
  hasOrder: false,
  cleared: false,
  chestOpened: false,
  bossDefeated: false,
  hasKey: false,
  weaponBought: false,
  shopBought: {},
  mineMined: {},
  pendingMsg: null,
  encounterGraceUntil: 0,
  initialized: false,
};

export function resetState(sx, sy) {
  gameState.player = basePlayer();
  gameState.px = sx;
  gameState.py = sy;
  gameState.map = 'camp';
  gameState.floor = 0;
  gameState.hasOrder = false;
  gameState.cleared = false;
  gameState.chestOpened = false;
  gameState.bossDefeated = false;
  gameState.hasKey = false;
  gameState.weaponBought = false;
  gameState.shopBought = {};
  gameState.mineMined = {};
  gameState.pendingMsg = null;
  gameState.encounterGraceUntil = 0;
  gameState.initialized = true;
}

const SAVE_KEY = 'looprpg1-save-v1';

export function saveGame() {
  try {
    const data = {
      player: gameState.player,
      px: gameState.px,
      py: gameState.py,
      map: gameState.map,
      floor: gameState.floor,
      hasOrder: gameState.hasOrder,
      cleared: gameState.cleared,
      chestOpened: gameState.chestOpened,
      bossDefeated: gameState.bossDefeated,
      hasKey: gameState.hasKey,
      weaponBought: gameState.weaponBought,
      shopBought: gameState.shopBought,
      mineMined: gameState.mineMined,
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
    gameState.px = d.px;
    gameState.py = d.py;
    gameState.map = d.map || 'camp';
    gameState.floor = d.floor || 0;
    gameState.hasOrder = !!d.hasOrder;
    gameState.cleared = !!d.cleared;
    gameState.chestOpened = !!d.chestOpened;
    gameState.bossDefeated = !!d.bossDefeated;
    gameState.hasKey = !!d.hasKey;
    gameState.weaponBought = !!d.weaponBought;
    gameState.shopBought = d.shopBought || {};
    gameState.mineMined = d.mineMined || {};
    gameState.pendingMsg = '冒険の記録から再開した！（つづきからスタート）';
    gameState.encounterGraceUntil = Date.now() + 1500;
    gameState.initialized = true;
    return true;
  } catch (e) {
    return false;
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
  gameState.pendingMsg = '親方「おおっ、死んでしまうとはなさけない。半分のゴールドを失ったが、再び掘るのだ！」';
}
