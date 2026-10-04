import Phaser from 'phaser';
import FieldScene from './scenes/FieldScene';
import BattleScene from './scenes/BattleScene';

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  backgroundColor: '#000',
  roundPixels: true,
  physics: { default: 'arcade' },
  scene: [FieldScene, BattleScene],
});
