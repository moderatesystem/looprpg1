import Phaser from 'phaser';
import { FIELD_MAP, CAMP_START } from '../data/fieldMap';
import DIALOGUES from '../data/dialogues.json';
import { gameState, resetState, saveGame, loadGame, hasSave, loadMeta, startNextLoop } from '../game/state';
import { toggleStatus, isStatusOpen } from '../game/statusUi';
import { startBgm, stopBgm, jingle } from '../game/sound';
import { preloadCharArt, drawHeroFigure, drawNpcFigure } from '../game/charArt';

export const TILE = 64;
export { beep } from '../game/sound';

// 坑道キャンプは安全地帯（遭遇なし）。危険は坑道フロア側で管理する
const COLORS = {
  '#': 0x6b6259, '.': 0x8a7a4a, T: 0x2f6b2a, '~': 0x3a6fd8,
  C: 0xd8c23a, V: 0xb0722e, D: 0x5b2a86, S: 0x8a7a4a,
  '+': 0x9c5a2a, ':': 0xe0c070,
};

function npcColor(n) {
  if (n.inn) return 0xffd54f;
  if (n.shop) return 0x4fc3f7;
  if (n.smith) return 0xff6f00;
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

export function copperCount() {
  return (gameState.player.mats && gameState.player.mats.copper) || 0;
}

function npcLines(npc) {
  if (gameState.bossDefeated && npc.clear) return npc.clear;
  if (gameState.hasOrder && npc.mid) return npc.mid;
  return npc.lines;
}

function foremanStage() {
  if (!gameState.hasOrder) return 'first';
  if (gameState.bossDefeated) return 'clear';
  if (gameState.hasKey) return 'key';
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
      if (hasSave() && typeof confirm === 'function' && confirm('冒険の記録がある。つづきから始めるか？（OK=つづき／キャンセル=はじめから）')) {
        loadGame();
      } else {
        resetState(CAMP_START.x, CAMP_START.y);
      }
    }
    // セーブ地点が坑道内なら坑道シーンへ直行する
    if (gameState.map === 'mine') {
      this.scene.start('dungeon', { floor: gameState.floor || 0, sx: gameState.px, sy: gameState.py });
      return;
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
      this.setMessage('坑道キャンプだ。西の小屋で親方に会おう（Eで話す、Tでステータス）。ここは安全地帯だ');
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
        if (ch === 'C') { g.fillStyle(0xffffff, 1); g.fillRect(ax + 24, ay + 12, 16, 24); }
        if (ch === 'D') { g.fillStyle(0x000000, 1); g.fillRect(ax + 16, ay + 24, 32, 24); }
        if (ch === 'V') { g.fillStyle(0x7a3b00, 1); g.fillRect(ax + 20, ay + 20, 24, 20); }
      }
    }
    for (const n of DIALOGUES.npcs) {
      const img = drawNpcFigure(this, n, n.x * TILE, n.y * TILE);
      if (img) {
        this.npcImgs.push(img);
      } else {
        const c = npcColor(n);
        g.fillStyle(c, 1);
        g.fillRect(n.x * TILE + 18, n.y * TILE + 18, 28, 28);
        g.lineStyle(3, 0x000000, 1);
        g.strokeRect(n.x * TILE + 18, n.y * TILE + 18, 28, 28);
      }
      this.add.text(n.x * TILE + 2, n.y * TILE - 18, n.name, {
        fontSize: '12px', color: '#fff', backgroundColor: '#000', fontFamily: 'monospace',
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
    pg.fillRect(px + 16, py + 16, 32, 32);
    pg.lineStyle(3, 0x000000, 1);
    pg.strokeRect(px + 16, py + 16, 32, 32);
    pg.fillStyle(0x000000, 1);
    pg.fillRect(px + 24, py + 22, 6, 10);
    pg.fillRect(px + 36, py + 22, 6, 10);
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
      `Lv${p.lv} HP ${p.hp}/${p.maxHp} ATK${p.atk} EXP${p.exp}/${p.next} G${p.gold} 草${p.herbs} 銅${copperCount()} 特性${n}種 ${gameState.hasOrder && !gameState.bossDefeated ? '★依頼' : ''}`
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
      const stage = foremanStage();
      const lines = this.foremanLines(stage);
      this.talk = { name: '親方', lines, idx: 0, choice: null, foremanStage: stage };
      this.cmdLock = true;
      this.showTalk();
      return;
    }
    const n = this.adjacentNpc();
    if (!n) { this.setMessage('この辺りには 誰もいないようだ。'); return; }
    this.talk = { name: n.name, npc: n, lines: npcLines(n), idx: 0, choice: null };
    this.cmdLock = true;
    this.showTalk();
  }

  foremanLines(stage) {
    if (stage === 'ordered') return [`銅鉱石は${copperCount()}/3個だ。`, '上層坑道の光る岩を Eキーで掘るんだ。'];
    if (stage === 'first' && loadMeta().loops >= 2) return DIALOGUES.foreman.firstDeja;
    if (stage === 'clear') {
      const c = loadMeta().clears || 1;
      if (c >= 3) return DIALOGUES.foreman.clear3;
      if (c === 2) return DIALOGUES.foreman.clear2;
      return DIALOGUES.foreman.clear1;
    }
    return DIALOGUES.foreman[stage];
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
    if (t.choice === 'church') {
      if (k === 'z' || k === 'Z' || k === 'Enter' || k === ' ') return this.chooseChurch(true);
      if (k === 'x' || k === 'X') return this.chooseChurch(false);
      return;
    }
    if (t.choice === 'sell-ore') {
      if (k === 'z' || k === 'Z' || k === 'Enter' || k === ' ') return this.chooseSellOre(true);
      if (k === 'x' || k === 'X') return this.chooseSellOre(false);
      return;
    }
    if (t.choice === 'deliver') {
      if (k === 'z' || k === 'Z' || k === 'Enter' || k === ' ') return this.chooseDeliver(true);
      if (k === 'x' || k === 'X') return this.chooseDeliver(false);
      return;
    }
    if (t.choice === 'next') {
      if (k === 'z' || k === 'Z' || k === 'Enter' || k === ' ') return this.chooseNextLoop(true);
      if (k === 'x' || k === 'X') return this.chooseNextLoop(false);
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
      const stock = t.npc.shop.stock || [];
      const idx = gameState.shopBought[t.npc.id] || 0;
      const s = stock[idx];
      if (!s) {
        this.setMessage(`${t.name}「売り切れだ。また来てくれ。」`);
        t.done = true;
        return;
      }
      t.choice = 'shop';
      const effect = s.atk ? `ATK+${s.atk}` : `守備+${s.armor}`;
      const rest = stock.length - idx - 1 > 0 ? `（残り${stock.length - idx}品）` : '';
      this.setMessage(`${t.name}「${s.name} ${s.cost}G（${effect}）だ${rest}。買うか？（Z=買う X=やめる）」`);
      return;
    }
    if (t.npc && t.npc.church) {
      t.choice = 'church';
      this.setMessage(`${t.name}「おいのり（セーブ）をするか？（Z=する X=やめる）」`);
      return;
    }
    if (t.npc && t.npc.smith) {
      if (copperCount() <= 0) {
        this.setMessage(`${t.name}「銅鉱石を持ってないな。上層坑道で掘ってこい。」`);
        t.done = true;
        return;
      }
      t.choice = 'sell-ore';
      this.setMessage(`${t.name}「銅${copperCount()}個だな。1個12Gで全部買い取るぜ。（Z=売る X=やめる）」`);
      return;
    }
    if (t.foremanStage === 'ordered' && !gameState.hasKey) {
      if (copperCount() >= 3) {
        t.choice = 'deliver';
        this.setMessage(`銅鉱石3個を渡すか？（Z=渡す X=やめる）`);
        return;
      }
    }
    if (t.foremanStage === 'clear') {
      t.choice = 'next';
      this.setMessage('次の坑道へ行くか？（Z=行く X=やめる）');
      return;
    }
    this.endTalk(t);
  }

  chooseInn(yes) {
    const t = this.talk;
    const p = gameState.player;
    if (yes) {
      if (p.gold < t.npc.cost) {
        this.setMessage(`${t.name}「お金が足りないようだ。銅を売って 稼いでくるといい。」`);
      } else {
        p.gold -= t.npc.cost;
        p.hp = p.maxHp;
        jingle('inn');
        this.setMessage('朝になった！ HPが全回復した！ ── 今日も掘るぞ。');
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
    const stock = t.npc.shop.stock || [];
    const idx = gameState.shopBought[t.npc.id] || 0;
    const s = stock[idx];
    if (!s) {
      this.setMessage(`${t.name}「売り切れだよ。」`);
    } else if (yes) {
      if (p.gold < s.cost) {
        this.setMessage(`${t.name}「お金が足りないな。${s.cost}Gだ。」`);
      } else {
        p.gold -= s.cost;
        if (s.atk) p.atk += s.atk;
        if (s.armor) p.armor += s.armor;
        gameState.shopBought[t.npc.id] = idx + 1;
        if (t.npc.id === 'shop1' && idx === 0) gameState.weaponBought = true;
        jingle('shop');
        const effect = s.atk ? `ATK+${s.atk}` : `守備+${s.armor}`;
        this.setMessage(`「${s.name}」を買った！ ${effect}！`);
      }
    } else {
      this.setMessage(`${t.name}「そうか。また来てくれ。」`);
    }
    t.choice = null;
    t.done = true;
    this.refreshStatus();
  }

  chooseChurch(yes) {
    const t = this.talk;
    if (yes) {
      if (saveGame()) {
        jingle('pray');
        this.setMessage('冒険の記録を残した！（セーブ完了）坑道の中でも再開できる。');
      } else {
        this.setMessage('記録に失敗した…。また試してくれ。');
      }
    } else {
      this.setMessage(`${t.name}「そうか。ケガには気をつけろ。」`);
    }
    t.choice = null;
    t.done = true;
    this.refreshStatus();
  }

  chooseSellOre(yes) {
    const t = this.talk;
    const p = gameState.player;
    if (yes) {
      const n = copperCount();
      if (n <= 0) {
        this.setMessage(`${t.name}「持ってないな。」`);
      } else {
        p.mats.copper = 0;
        const gain = n * 12;
        p.gold += gain;
        jingle('shop');
        this.setMessage(`銅${n}個を売った！ ${gain}G手に入れた！`);
      }
    } else {
      this.setMessage(`${t.name}「そうか。また持ってこい。」`);
    }
    t.choice = null;
    t.done = true;
    this.refreshStatus();
  }

  chooseDeliver(yes) {
    const t = this.talk;
    const p = gameState.player;
    if (yes) {
      if (copperCount() < 3 || gameState.hasKey) {
        this.setMessage('渡せる銅鉱石がない。');
      } else {
        p.mats.copper -= 3;
        gameState.hasKey = true;
        jingle('levelup');
        this.setMessage(DIALOGUES.deliver.done);
      }
    } else {
      this.setMessage('親方「そうか。待ってるぞ。」');
    }
    t.choice = null;
    t.done = true;
    this.refreshStatus();
  }

  chooseNextLoop(yes) {
    if (yes) {
      startNextLoop();
      jingle('levelup');
      this.setMessage('新しい坑道の噂だ！ 親方に会いに行こう。');
    } else {
      this.setMessage('親方「そうか。ゆっくり休んでいけ。」');
    }
    this.talk.choice = null;
    this.talk.done = true;
    this.refreshStatus();
  }

  endTalk(t) {
    if (t.foremanStage === 'first' && !gameState.hasOrder) {
      gameState.hasOrder = true;
      jingle('levelup');
    }
    this.talk = null;
    this.cmdLock = false;
    this.refreshStatus();
  }

  passable(ch) { return ['.', 'T', ':', '+', 'C', 'V', 'D', 'S'].includes(ch); }

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
      this.setMessage('親方の小屋だ。Eキーで 親方に会える。');
      return;
    }
    if (ch === 'V') {
      const v = villageAt(gameState.px, gameState.py);
      this.setMessage(`「${v ? v.name : '施設'}」だ。Eキーで 話しかけられる。`);
      return;
    }
    if (ch === 'D') {
      if (!gameState.hasOrder) {
        this.setMessage('坑口…。まだ親方の許可がない。（西の小屋へ）');
        return;
      }
      this.enterDungeon();
      return;
    }
    // キャンプ内は安全地帯。遭遇なし
  }

  enterDungeon() {
    this.cmdLock = true;
    stopBgm();
    gameState.map = 'mine';
    gameState.floor = 0;
    gameState.mineMined = {};
    const cam = this.cameras.main;
    cam.fadeOut(250, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('dungeon', { floor: 0 });
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
