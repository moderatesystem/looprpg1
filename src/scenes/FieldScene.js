import Phaser from 'phaser';
import { FIELD_MAP, findTile } from '../data/fieldMap';
import DIALOGUES from '../data/dialogues.json';
import { gameState, resetState } from '../game/state';
import { toggleStatus, isStatusOpen } from '../game/statusUi';
import { startBgm, stopBgm, jingle } from '../game/sound';
import { preloadCharArt, drawHeroFigure, drawNpcFigure } from '../game/charArt';

export const TILE = 32;
export { beep } from '../game/sound';

const COLORS = {
  '#': 0x6b6259, '.': 0x4a8f3c, T: 0x2f6b2a, '~': 0x3a6fd8,
  C: 0xd8c23a, V: 0xb0722e, D: 0x5b2a86, S: 0x4a8f3c,
};

function npcColor(n) {
  if (n.inn) return 0xffd54f;
  if (n.shop) return 0x4fc3f7;
  if (n.church) return 0xffffff;
  if (n.id === 'guard') return 0x7e9bff;
  return 0xff9800;
}

function shade(color, amt) {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (color & 255) + amt));
  return (r << 16) | (g << 8) | b;
}

export function villageAt(x, y) {
  return DIALOGUES.villages.find((v) => v.x === x && v.y === y) || null;
}

export function npcAt(x, y) {
  return DIALOGUES.npcs.find((n) => n.x === x && n.y === y) || null;
}

function kingStage() {
  if (!gameState.hasOrder) return 'first';
  if (gameState.bossDefeated) return 'clear';
  if (gameState.chestOpened) return 'chest';
  return 'ordered';
}

export default class FieldScene extends Phaser.Scene {
  constructor() {
    super('field');
  }

  preload() {
    preloadCharArt(this);
  }

  create() {
    const st = gameState;
    if (!st.initialized) {
      const s = findTile(FIELD_MAP, 'S');
      resetState(s.x, s.y);
    }

    this.moveCd = 0;
    this.cmdLock = false;
    this.talk = null;

    this.drawField();
    this.drawHud();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, FIELD_MAP[0].length * TILE, FIELD_MAP.length * TILE);
    cam.startFollow(this.follower, false, 0.15, 0.15);
    cam.fadeIn(200, 0, 0, 0);

    if (st.pendingMsg) {
      this.setMessage(st.pendingMsg);
      st.pendingMsg = null;
    } else {
      this.setMessage('大陸中央から出発。黄色＝城 紫＝洞窟 茶＝村。Eで話す、Tでステータス。隣の案内人に聞こう');
    }

    startBgm('field');
    this.events.once('shutdown', stopBgm);

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
    if (this.npcImgs) this.npcImgs.forEach((i) => i.destroy());
    this.npcImgs = [];
    const g = this.add.graphics();
    this.fieldGfx = g;
    for (let y = 0; y < FIELD_MAP.length; y++) {
      for (let x = 0; x < FIELD_MAP[y].length; x++) {
        const ch = FIELD_MAP[y][x];
        const v = ((x * 7 + y * 13) % 3) * 10 - 10;
        g.fillStyle(shade(COLORS[ch] ?? 0x000000, v), 1);
        g.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
        const ax = x * TILE, ay = y * TILE;
        const off = (x * 5 + y * 11) % 3;
        if (ch === '.') { g.fillStyle(shade(COLORS['.'], -25), 1); g.fillRect(ax + 6 + off * 6, ay + 18, 5, 5); }
        if (ch === 'T') { g.fillStyle(0x1d4d1a, 1); g.fillRect(ax + 7 + off * 4, ay + 8, 10, 12); }
        if (ch === '~') { g.fillStyle(0x9fc8ff, 1); g.fillRect(ax + 5, ay + 14 + (off % 2) * 6, 20, 2); }
        if (ch === 'C') { g.fillStyle(0xffffff, 1); g.fillRect(ax + 12, ay + 6, 8, 12); }
        if (ch === 'D') { g.fillStyle(0x000000, 1); g.fillRect(ax + 8, ay + 12, 16, 12); }
        if (ch === 'V') { g.fillStyle(0x7a3b00, 1); g.fillRect(ax + 10, ay + 10, 12, 10); }
      }
    }
    for (const n of DIALOGUES.npcs) {
      const img = drawNpcFigure(this, n, n.x * TILE, n.y * TILE);
      if (img) {
        this.npcImgs.push(img);
      } else {
        const c = npcColor(n);
        g.fillStyle(c, 1);
        g.fillRect(n.x * TILE + 9, n.y * TILE + 9, 14, 14);
        g.lineStyle(2, 0x000000, 1);
        g.strokeRect(n.x * TILE + 9, n.y * TILE + 9, 14, 14);
      }
      this.add.text(n.x * TILE - 2, n.y * TILE - 15, n.name, {
        fontSize: '10px', color: '#fff', backgroundColor: '#000', fontFamily: 'monospace',
      });
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
    const px = gameState.px * TILE, py = gameState.py * TILE;
    if (drawHeroFigure(this, pg, px, py, this.heroHolder || (this.heroHolder = {}))) return;
    pg.clear();
    pg.fillStyle(0xffffff, 1);
    pg.fillRect(px + 8, py + 8, 16, 16);
    pg.lineStyle(2, 0x000000, 1);
    pg.strokeRect(px + 8, py + 8, 16, 16);
    pg.fillStyle(0x000000, 1);
    pg.fillRect(px + 12, py + 11, 3, 5);
    pg.fillRect(px + 18, py + 11, 3, 5);
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
    // 移動はupdateループ側に一本化（keydown併用だと1押下で2マス進むため）
    if (e.repeat) return;
    const k = e.key;
    if (k === 't' || k === 'T') {
      if (!this.talk && !this.cmdLock) toggleStatus();
      return;
    }
    if (isStatusOpen()) return;
    if (this.talk) { this.advanceTalk(k); return; }
    if (this.cmdLock) return;
    if (k === 'e' || k === 'E' || k === ' ') { this.tryTalk(); return; }
  }

  adjacentNpc() {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]];
    for (const [dx, dy] of dirs) {
      const n = npcAt(gameState.px + dx, gameState.py + dy);
      if (n) return n;
    }
    return null;
  }

  tryTalk() {
    if (FIELD_MAP[gameState.py][gameState.px] === 'C') {
      const stage = kingStage();
      this.talk = { name: '王さま', lines: DIALOGUES.king[stage], idx: 0, choice: null, kingStage: stage };
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
    if (t.choice === 'shop') {
      if (k === 'z' || k === 'Z' || k === 'Enter' || k === ' ') return this.chooseShop(true);
      if (k === 'x' || k === 'X') return this.chooseShop(false);
      return;
    }
    if (!okKeys.includes(k)) return;
    t.idx += 1;
    if (t.idx < t.lines.length) { this.showTalk(); return; }
    if (t.npc && t.npc.inn) {
      t.choice = 'inn';
      this.setMessage(`${t.name}「一晩 ${t.npc.cost}Gだ。泊まるか？（Z=はい X=いいえ）」`);
      return;
    }
    if (t.npc && t.npc.shop) {
      const s = t.npc.shop;
      if (gameState.weaponBought) {
        this.setMessage(`${t.name}「${s.name}は売り切れだ。また来てくれ。」`);
        t.done = true;
        return;
      }
      t.choice = 'shop';
      this.setMessage(`${t.name}「${s.name} ${s.cost}G（ATK+${s.atk}）だ。買うか？（Z=買う X=やめる）」`);
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
        jingle('inn');
        this.setMessage('朝になった！ HPが全回復した！ ── 今日もいい天気だ。');
      }
    } else {
      this.setMessage(`${t.name}「そうか。また寄ってくれ。」`);
    }
    t.choice = null;
    t.done = true;
    this.refreshStatus();
  }

  chooseShop(yes) {
    const t = this.talk;
    const p = gameState.player;
    const s = t.npc.shop;
    if (yes) {
      if (gameState.weaponBought) {
        this.setMessage(`${t.name}「売り切れだよ。」`);
      } else if (p.gold < s.cost) {
        this.setMessage(`${t.name}「お金が足りないな。${s.cost}Gだ。」`);
      } else {
        p.gold -= s.cost;
        p.atk += s.atk;
        gameState.weaponBought = true;
        jingle('shop');
        this.setMessage(`「${s.name}」を買った！ ATK+${s.atk}！`);
      }
    } else {
      this.setMessage(`${t.name}「そうか。また来てくれ。」`);
    }
    t.choice = null;
    t.done = true;
    this.refreshStatus();
  }

  endTalk(t) {
    if (t.kingStage === 'first' && !gameState.hasOrder) {
      gameState.hasOrder = true;
      jingle('levelup');
    }
    this.talk = null;
    this.cmdLock = false;
    this.refreshStatus();
  }

  passable(ch) { return ['.', 'T', 'C', 'V', 'D', 'S'].includes(ch); }

  regionDanger() {
    const d = Math.abs(gameState.px - 1) + Math.abs(gameState.py - 6);
    if (d < 8) return 0.4;
    if (d < 16) return 0.8;
    return 1.2;
  }

  tryMove(dx, dy) {
    const nx = gameState.px + dx, ny = gameState.py + dy;
    if (ny < 0 || nx < 0 || ny >= FIELD_MAP.length || nx >= FIELD_MAP[0].length) return;
    if (npcAt(nx, ny)) return;
    const ch = FIELD_MAP[ny][nx];
    if (!this.passable(ch)) return;
    gameState.px = nx; gameState.py = ny;
    this.follower.setPosition(nx * TILE + TILE / 2, ny * TILE + TILE / 2);
    this.drawPlayer();
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
    stopBgm();
    const cam = this.cameras.main;
    cam.fadeOut(200, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('battle', { tile, from: 'field', danger: this.regionDanger() });
    });
  }

  enterDungeon() {
    this.cmdLock = true;
    stopBgm();
    const cam = this.cameras.main;
    cam.fadeOut(250, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('dungeon');
    });
  }

  update(time, delta) {
    if (this.cmdLock || isStatusOpen()) return;
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
