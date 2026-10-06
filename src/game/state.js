// フィールド↔戦闘シーン間で共有する可変状態（シーン切替えでも保持される）
import { basePlayer } from '../data/traits';

export const gameState = {
  player: basePlayer(),
  px: 1,
  py: 1,
  hasOrder: false,
  cleared: false,
  chestOpened: false,
  bossDefeated: false,
  hasKey: false,
  weaponBought: false,
  shopBought: {},
  pendingMsg: null,
  encounterGraceUntil: 0,
  initialized: false,
};

export function resetState(sx, sy) {
  gameState.player = basePlayer();
  gameState.px = sx;
  gameState.py = sy;
  gameState.hasOrder = false;
  gameState.cleared = false;
  gameState.chestOpened = false;
  gameState.bossDefeated = false;
  gameState.hasKey = false;
  gameState.weaponBought = false;
  gameState.shopBought = {};
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
      hasOrder: gameState.hasOrder,
      cleared: gameState.cleared,
      chestOpened: gameState.chestOpened,
      bossDefeated: gameState.bossDefeated,
      hasKey: gameState.hasKey,
      weaponBought: gameState.weaponBought,
      shopBought: gameState.shopBought,
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
    gameState.hasOrder = !!d.hasOrder;
    gameState.cleared = !!d.cleared;
    gameState.chestOpened = !!d.chestOpened;
    gameState.bossDefeated = !!d.bossDefeated;
    gameState.hasKey = !!d.hasKey;
    gameState.weaponBought = !!d.weaponBought;
    gameState.shopBought = d.shopBought || {};
    gameState.pendingMsg = '冒険の記録から再開した！（つづきからスタート）';
    gameState.encounterGraceUntil = Date.now() + 1500;
    gameState.initialized = true;
    return true;
  } catch (e) {
    return false;
  }
}

// DQ1式：全滅＝所持金半減・城前復活（経験・特性は保持）
export function respawn(rx, ry) {
  const p = gameState.player;
  p.gold = Math.floor(p.gold / 2);
  p.hp = p.maxHp;
  p.prayed = false;
  gameState.px = rx;
  gameState.py = ry;
  gameState.pendingMsg = '王「おお勇者よ、死んでしまうとはなさけない。半分のゴールドを失ったが、再び旅立つのだ！」';
}
