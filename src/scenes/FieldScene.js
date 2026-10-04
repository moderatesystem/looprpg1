import Phaser from 'phaser';
import { FIELD_MAP, findTile } from '../data/fieldMap';
import { gameState, resetState } from '../game/state';

export const TILE = 32;

const COLORS = {
  '#': 0x6b6259, '.': 0x4a8f3c, T: 0x2f6b2a, '~': 0x3a6fd8,
  C: 0xd8c23a, V: 0xb0722e, D: 0x5b2a86, S: 0x4a8f3c,
};

// 簡易ピッ音（素材前仮置き）
let actx = null;
export function beep(freq = 440, ms = 70) {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.value = 0.04;
    o.connect(g); g.connect(actx.destination);
    o.start();
    setTimeout(() => o.stop(), ms);
  } catch (e) { /* 音なしでも続行 */ }
}

export default class FieldScene extends Phaser.Scene {
  constructor() {
    super('field');
  }

  create() {
    const st = gameState;
    if (!st.initialized) {
      const s = findTile(FIELD_MAP, 'S');
      resetState(s.x, s.y);
    }

    this.moveCd = 0;
    this.cmdLock = false;

    this.drawField();
    this.drawHud();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, FIELD_MAP[0].length * TILE, FIELD_MAP.length * TILE);
    cam.startFollow(this.follower, false, 0.15, 0.15);
    cam.fadeIn(200, 0, 0, 0);

    this.setMessage('30x30の世界：王様(C)に会い、洞窟(D)を目指せ。V:村で回復');

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey('W');
    this.keyA = this.input.keyboard.addKey('A');
    this.keyS = this.input.keyboard.addKey('S');
    this.keyD = this.input.keyboard.addKey('D');
    this.input.keyboard.on('keydown', (e) => this.handleKey(e));
    this.refreshStatus();
  }

  drawField() {
    if (this.fieldGfx) this.fieldGfx.destroy();
    if (this.playerGfx) this.playerGfx.destroy();
    if (this.follower) this.follower.destroy();
    const g = this.add.graphics();
    this.fieldGfx = g;
    for (let y = 0; y < FIELD_MAP.length; y++) {
      for (let x = 0; x < FIELD_MAP[y].length; x++) {
        const ch = FIELD_MAP[y][x];
        g.fillStyle(COLORS[ch] ?? 0x000000, 1);
        g.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
        if (ch === 'C') { g.fillStyle(0xffffff, 1); g.fillRect(x * TILE + 12, y * TILE + 6, 8, 12); }
        if (ch === 'D') { g.fillStyle(0x000000, 1); g.fillRect(x * TILE + 8, y * TILE + 12, 16, 12); }
        if (ch === 'V') { g.fillStyle(0x7a3b00, 1); g.fillRect(x * TILE + 10, y * TILE + 10, 12, 10); }
      }
    }
    this.follower = this.add.rectangle(
      gameState.px * TILE + TILE / 2, gameState.py * TILE + TILE / 2, 4, 4, 0xffffff, 0
    );
    const pg = this.add.graphics();
    this.playerGfx = pg;
    this.drawPlayer();
  }

  drawPlayer() {
    const pg = this.playerGfx;
    pg.clear();
    pg.fillStyle(0xffffff, 1);
    pg.fillRect(gameState.px * TILE + 8, gameState.py * TILE + 8, 16, 16);
    pg.lineStyle(2, 0x000000, 1);
    pg.strokeRect(gameState.px * TILE + 8, gameState.py * TILE + 8, 16, 16);
  }

  drawHud() {
    const g = this.add.graphics().setScrollFactor(0);
    // 上ステータスバー
    g.fillStyle(0x000000, 0.85); g.fillRect(0, 0, 800, 30);
    this.statusText = this.add.text(8, 6, '', { fontSize: '14px', color: '#fff', fontFamily: 'monospace' }).setScrollFactor(0);
    // 下メッセージ枠
    g.fillStyle(0x000000, 1); g.fillRect(0, 490, 800, 110);
    g.lineStyle(2, 0xffffff, 1); g.strokeRect(0, 490, 800, 110);
    this.msgText = this.add.text(12, 500, '', { fontSize: '15px', color: '#fff', fontFamily: 'monospace', wordWrap: { width: 770 } }).setScrollFactor(0);
  }

  refreshStatus() {
    const p = gameState.player;
    const n = Object.keys(p.traits).length;
    this.statusText.setText(
      `Lv${p.lv} HP ${p.hp}/${p.maxHp} ATK${p.atk} EXP${p.exp}/${p.next} G${p.gold} 草${p.herbs} 特性${n}種 ${gameState.hasOrder ? '★王命' : ''}`
    );
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

  passable(ch) { return ['.', 'T', 'C', 'V', 'D', 'S'].includes(ch); }

  tryMove(dx, dy) {
    const nx = gameState.px + dx, ny = gameState.py + dy;
    if (ny < 0 || nx < 0 || ny >= FIELD_MAP.length || nx >= FIELD_MAP[0].length) return;
    const ch = FIELD_MAP[ny][nx];
    if (!this.passable(ch)) { beep(120, 60); return; }
    gameState.px = nx; gameState.py = ny;
    this.follower.setPosition(nx * TILE + TILE / 2, ny * TILE + TILE / 2);
    this.drawPlayer();
    beep(660, 30);
    this.onEnterTile(ch);
    this.refreshStatus();
  }

  onEnterTile(ch) {
    if (ch === 'C') {
      gameState.hasOrder = true;
      this.setMessage('王「勇者よ！北東の洞窟(D)に魔物がおる。倒して参れ！」→ 王の命を受けた！');
      beep(880, 120);
      return;
    }
    if (ch === 'V') {
      const p = gameState.player;
      p.hp = p.maxHp;
      p.herbs += 1;
      this.setMessage('村に着いた。HPが全回復した！（やくそう+1）');
      beep(520, 100);
      return;
    }
    if (ch === 'D') {
      if (!gameState.hasOrder) {
        this.setMessage('試練の洞窟…。まだ王様(C)に会っていない。（先にCへ）');
        return;
      }
      if (!gameState.cleared) {
        gameState.cleared = true;
        this.setMessage('★ 試作クリア！洞窟にたどり着いた！（この先はダンジョン化予定）');
        beep(880, 200);
      }
      return;
    }
    if (Date.now() < gameState.encounterGraceUntil) return;
    const rate = ch === 'T' ? 0.16 : 0.08;
    if (Math.random() < rate) this.enterBattle(ch);
  }

  enterBattle(tile) {
    this.cmdLock = true;
    beep(200, 150);
    const cam = this.cameras.main;
    cam.fadeOut(200, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('battle', { tile });
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
