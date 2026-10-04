import Phaser from 'phaser';
import { FIELD_MAP, findTile } from '../data/fieldMap';
import DIALOGUES from '../data/dialogues.json';
import { gameState, resetState } from '../game/state';

export const TILE = 32;

const COLORS = {
  '#': 0x6b6259, '.': 0x4a8f3c, T: 0x2f6b2a, '~': 0x3a6fd8,
  C: 0xd8c23a, V: 0xb0722e, D: 0x5b2a86, S: 0x4a8f3c,
};
const NPC_COLOR = 0xff9800;

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

export function villageAt(x, y) {
  return DIALOGUES.villages.find((v) => v.x === x && v.y === y) || null;
}

export function npcAt(x, y) {
  return DIALOGUES.npcs.find((n) => n.x === x && n.y === y) || null;
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
    this.talk = null; // {npc|null king, lines, idx, choice}

    this.drawField();
    this.drawHud();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, FIELD_MAP[0].length * TILE, FIELD_MAP.length * TILE);
    cam.startFollow(this.follower, false, 0.15, 0.15);
    cam.fadeIn(200, 0, 0, 0);

    this.setMessage('Eキー/Spaceで話す。王様(C)に会い、洞窟(D)を目指せ');

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
    // NPC
    for (const n of DIALOGUES.npcs) {
      g.fillStyle(NPC_COLOR, 1);
      g.fillRect(n.x * TILE + 9, n.y * TILE + 9, 14, 14);
      g.lineStyle(2, 0x000000, 1);
      g.strokeRect(n.x * TILE + 9, n.y * TILE + 9, 14, 14);
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
    g.fillStyle(0x000000, 0.85); g.fillRect(0, 0, 800, 30);
    this.statusText = this.add.text(8, 6, '', { fontSize: '14px', color: '#fff', fontFamily: 'monospace' }).setScrollFactor(0);
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
    const k = e.key;
    if (this.talk) { this.advanceTalk(k); return; }
    if (this.cmdLock) return;
    if (k === 'e' || k === 'E' || k === ' ') { this.tryTalk(); return; }
    let dx = 0, dy = 0;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') dy = -1;
    else if (k === 'ArrowDown' || k === 's' || k === 'S') dy = 1;
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') dx = -1;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') dx = 1;
    else return;
    this.tryMove(dx, dy);
  }

  // ---- 会話 ----
  adjacentNpc() {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]];
    for (const [dx, dy] of dirs) {
      const n = npcAt(gameState.px + dx, gameState.py + dy);
      if (n) return n;
    }
    return null;
  }

  tryTalk() {
    // 城の床の上なら王に謁見
    if (FIELD_MAP[gameState.py][gameState.px] === 'C') {
      const lines = gameState.hasOrder ? DIALOGUES.king.after : DIALOGUES.king.first;
      this.talk = { name: '王さま', lines, idx: 0, choice: null, king: !gameState.hasOrder };
      this.cmdLock = true;
      this.showTalk();
      return;
    }
    const n = this.adjacentNpc();
    if (!n) { this.setMessage('この辺りには 誰もいないようだ。'); return; }
    this.talk = { name: n.name, npc: n, lines: n.lines, idx: 0, choice: null };
    this.cmdLock = true;
    this.showTalk();
  }

  showTalk() {
    const t = this.talk;
    this.setMessage(`${t.name}「${t.lines[t.idx]}」`);
    beep(520, 40);
  }

  advanceTalk(k) {
    const t = this.talk;
    const okKeys = ['z', 'Z', ' ', 'Enter', 'e', 'E'];
    if (t.done) {
      if (!okKeys.includes(k) && k !== 'x' && k !== 'X') return;
      return this.endTalk(t);
    }
    if (t.choice === 'inn') {
      if (k === 'z' || k === 'Z' || k === 'Enter' || k === ' ') return this.chooseInn(true);
      if (k === 'x' || k === 'X') return this.chooseInn(false);
      return;
    }
    if (!okKeys.includes(k)) return;
    t.idx += 1;
    if (t.idx < t.lines.length) { this.showTalk(); return; }
    if (t.npc && t.npc.inn) {
      t.choice = 'inn';
      this.setMessage(`${t.name}「一晩 ${t.npc.cost}ゴールドだ。泊まるか？（Z=はい X=いいえ）」`);
      return;
    }
    this.endTalk(t);
  }

  chooseInn(yes) {
    const t = this.talk;
    const p = gameState.player;
    if (yes) {
      if (p.gold < t.npc.cost) {
        this.setMessage(`${t.name}「お金が足りないようだ。魔物を倒して 稼いでくるといい。」`);
      } else {
        p.gold -= t.npc.cost;
        p.hp = p.maxHp;
        beep(700, 150);
        this.setMessage('朝になった！ HPが全回復した！ ── 今日もいい天気だ。');
      }
    } else {
      this.setMessage(`${t.name}「そうか。また寄ってくれ。」`);
    }
    t.choice = null;
    t.done = true;
    this.refreshStatus();
  }

  endTalk(t) {
    if (t.king && !gameState.hasOrder) {
      gameState.hasOrder = true;
      beep(880, 120);
    }
    this.talk = null;
    this.cmdLock = false;
    this.refreshStatus();
  }

  // ---- 移動 ----
  passable(ch) { return ['.', 'T', 'C', 'V', 'D', 'S'].includes(ch); }

  tryMove(dx, dy) {
    const nx = gameState.px + dx, ny = gameState.py + dy;
    if (ny < 0 || nx < 0 || ny >= FIELD_MAP.length || nx >= FIELD_MAP[0].length) return;
    if (npcAt(nx, ny)) { beep(120, 60); return; } // NPCは障害物
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
      this.setMessage('王の城だ。Eキーで 王さまに謁見できる。');
      return;
    }
    if (ch === 'V') {
      const v = villageAt(gameState.px, gameState.py);
      this.setMessage(`「${v ? v.name : '村'}」だ。Eキーで 村人に話しかけられる。`);
      return;
    }
    if (ch === 'D') {
      if (!gameState.hasOrder) {
        this.setMessage('試練の洞窟…。まだ王さまに会っていない。（先に城Cへ）');
        return;
      }
      this.enterDungeon();
      return;
    }
    if (Date.now() < gameState.encounterGraceUntil) return;
    let rate = ch === 'T' ? 0.16 : 0.08;
    rate = Math.max(0.02, rate * (1 - 0.1 * gameState.player.quick));
    if (Math.random() < rate) this.enterBattle(ch);
  }

  enterBattle(tile) {
    this.cmdLock = true;
    beep(200, 150);
    const cam = this.cameras.main;
    cam.fadeOut(200, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('battle', { tile, from: 'field' });
    });
  }

  enterDungeon() {
    this.cmdLock = true;
    beep(440, 120);
    const cam = this.cameras.main;
    cam.fadeOut(250, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('dungeon');
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
