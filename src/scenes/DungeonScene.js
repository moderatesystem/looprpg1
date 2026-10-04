import Phaser from 'phaser';
import DIALOGUES from '../data/dialogues.json';
import { gameState } from '../game/state';
import { applyTrait } from '../data/traits';
import { beep, TILE } from './FieldScene';

const MAP = DIALOGUES.dungeon.map;
const OX = 160;
const OY = 5;

// 試練の洞窟（単層）。凡例 #:壁 .:床 S:入口（戻る） H:宝箱
export default class DungeonScene extends Phaser.Scene {
  constructor() {
    super('dungeon');
  }

  create() {
    this.moveCd = 0;
    this.cmdLock = false;
    this.moved = false;
    const s = this.findCh('S');
    this.dx = s.x; this.dy = s.y;

    this.drawMap();
    this.drawHud();
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.setMessage(`「${DIALOGUES.dungeon.name}」にもぐった。奥の宝箱(H)を探せ。入口(S)で戻れる`);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey('W');
    this.keyA = this.input.keyboard.addKey('A');
    this.keyS = this.input.keyboard.addKey('S');
    this.keyD = this.input.keyboard.addKey('D');
    this.input.keyboard.on('keydown', (e) => this.handleKey(e));
    this.refreshStatus();
  }

  findCh(ch) {
    for (let y = 0; y < MAP.length; y++)
      for (let x = 0; x < MAP[y].length; x++)
        if (MAP[y][x] === ch) return { x, y };
    return { x: 1, y: 1 };
  }

  tileAt(x, y) { return MAP[y][x]; }

  drawMap() {
    const g = this.add.graphics();
    this.mapGfx = g;
    this.drawTiles();
    const pg = this.add.graphics();
    this.playerGfx = pg;
    this.drawPlayer();
  }

  drawTiles() {
    const g = this.mapGfx;
    g.clear();
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[y].length; x++) {
        const ch = MAP[y][x];
        const px = OX + x * TILE, py = OY + y * TILE;
        if (ch === '#') g.fillStyle(0x3a3a4a, 1);
        else if (ch === 'S') g.fillStyle(0x3a6fd8, 1);
        else if (ch === 'H') g.fillStyle(gameState.chestOpened ? 0x5a2a2a : 0xd8a03a, 1);
        else g.fillStyle(0x5a4a3a, 1);
        g.fillRect(px, py, TILE - 1, TILE - 1);
        if (ch === 'H' && !gameState.chestOpened) {
          g.fillStyle(0x000000, 1); g.fillRect(px + 10, py + 12, 12, 8);
        }
      }
    }
  }

  drawPlayer() {
    const pg = this.playerGfx;
    pg.clear();
    pg.fillStyle(0xffffff, 1);
    pg.fillRect(OX + this.dx * TILE + 8, OY + this.dy * TILE + 8, 16, 16);
    pg.lineStyle(2, 0x000000, 1);
    pg.strokeRect(OX + this.dx * TILE + 8, OY + this.dy * TILE + 8, 16, 16);
  }

  drawHud() {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.85); g.fillRect(0, 0, 800, 30);
    this.statusText = this.add.text(8, 6, '', { fontSize: '14px', color: '#fff', fontFamily: 'monospace' });
    g.fillStyle(0x000000, 1); g.fillRect(0, 490, 800, 110);
    g.lineStyle(2, 0xffffff, 1); g.strokeRect(0, 490, 800, 110);
    this.msgText = this.add.text(12, 500, '', { fontSize: '15px', color: '#fff', fontFamily: 'monospace', wordWrap: { width: 770 } });
  }

  refreshStatus() {
    const p = gameState.player;
    this.statusText.setText(`Lv${p.lv} HP ${p.hp}/${p.maxHp} ATK${p.atk} G${p.gold} 草${p.herbs} ＠${DIALOGUES.dungeon.name}`);
  }

  setMessage(t) { this.msgText.setText(t); }

  handleKey(e) {
    if (this.cmdLock) return;
    const k = e.key;
    let dx = 0, dy = 0;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') dy = -1;
    else if (k === 'ArrowDown' || k === 's' || k === 'S') dy = 1;
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') dx = -1;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') dx = 1;
    else return;
    this.tryMove(dx, dy);
  }

  passable(ch) { return ['.', 'S', 'H'].includes(ch); }

  tryMove(dx, dy) {
    const nx = this.dx + dx, ny = this.dy + dy;
    if (ny < 0 || nx < 0 || ny >= MAP.length || nx >= MAP[0].length) return;
    const ch = this.tileAt(nx, ny);
    if (!this.passable(ch)) { beep(120, 60); return; }
    this.dx = nx; this.dy = ny;
    this.moved = true;
    this.drawPlayer();
    beep(660, 30);
    this.onEnterTile(ch);
    this.refreshStatus();
  }

  onEnterTile(ch) {
    if (ch === 'S') {
      if (!this.moved) return;
      this.exitDungeon();
      return;
    }
    if (ch === 'H') {
      if (!gameState.chestOpened) this.openChest();
      else this.setMessage('空っぽの宝箱だ。');
      return;
    }
    if (Date.now() < gameState.encounterGraceUntil) return;
    // 宝箱取得後はボスが徘徊する（1回限り）
    if (gameState.chestOpened && !gameState.bossDefeated && Math.random() < 0.3) {
      this.enterBattle(true);
      return;
    }
    const rate = Math.max(0.02, 0.12 * (1 - 0.1 * gameState.player.quick));
    if (Math.random() < rate) this.enterBattle(false);
  }

  openChest() {
    gameState.chestOpened = true;
    const p = gameState.player;
    const c = DIALOGUES.dungeon.chest;
    p.gold += c.gold;
    p.herbs += c.herbs;
    const got = applyTrait(p, c.trait);
    gameState.cleared = true;
    beep(880, 200);
    this.setMessage(`${c.message} ${DIALOGUES.dungeon.clearMessage}`);
    this.drawTiles();
  }

  enterBattle(isBoss) {
    this.cmdLock = true;
    beep(200, 150);
    const cam = this.cameras.main;
    cam.fadeOut(200, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('battle', { tile: '.', from: 'dungeon', lvBonus: 2, boss: isBoss });
    });
  }

  exitDungeon() {
    this.cmdLock = true;
    const cam = this.cameras.main;
    cam.fadeOut(250, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('field');
    });
  }

  update(time, delta) {
    if (this.cmdLock) return;
    this.moveCd -= delta;
    if (this.moveCd > 0) return;
    const keys = this.cursors;
    let dx = 0, dy = 0;
    if (keys.left.isDown || this.keyA.isDown) dx = -1;
    else if (keys.right.isDown || this.keyD.isDown) dx = 1;
    else if (keys.up.isDown || this.keyW.isDown) dy = -1;
    else if (keys.down.isDown || this.keyS.isDown) dy = 1;
    if (dx !== 0 || dy !== 0) {
      this.tryMove(dx, dy);
      this.moveCd = 150;
    }
  }
}
