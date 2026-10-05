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
  weaponBought: false,
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
  gameState.weaponBought = false;
  gameState.pendingMsg = null;
  gameState.encounterGraceUntil = 0;
  gameState.initialized = true;
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
