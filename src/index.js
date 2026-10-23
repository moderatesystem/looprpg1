import Phaser from 'phaser';
import FieldScene from './scenes/FieldScene';
import BattleScene from './scenes/BattleScene';
import DungeonScene from './scenes/DungeonScene';
import TownScene from './scenes/TownScene';

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  backgroundColor: '#000',
  roundPixels: true,
  pixelArt: true,
  physics: { default: 'arcade' },
  scene: [FieldScene, BattleScene, DungeonScene, TownScene],
});

// 動作確認用：?scene=town&town=v_start / ?scene=dungeon&floor=0 で直接開ける
const q = new URLSearchParams(location.search);
const direct = q.get('scene');
if (direct === 'town' || direct === 'dungeon') {
  window.game.events.once('ready', () => {
    setTimeout(() => {
      if (direct === 'town') {
        window.game.scene.start('town', { townId: q.get('town') || 'v_start', spawn: true });
      } else {
        window.game.scene.start('dungeon', { floor: Number(q.get('floor') || 0) });
      }
    }, 50);
  });
}
