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
  gameState.encounterGraceUntil = 0;
  gameState.initialized = true;
}
