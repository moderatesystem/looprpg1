import Phaser from 'phaser';
import DIALOGUES from '../data/dialogues.json';
import { gameState, saveGame, loadMeta, startNextLoop } from '../game/state';
import { applyTrait } from '../data/traits';
import { toggleStatus, isStatusOpen } from '../game/statusUi';
import { startBgm, stopBgm, jingle, toggleMute } from '../game/sound';
import { preloadCharArt, drawHeroFigure, npcKey } from '../game/charArt';
import { preloadTiles, putTile, putObject, tileHash } from '../game/tileArt';
import { createActor, moveActor, destroyActor, setActorLabel, setupWander, stopWander, turnTo } from '../game/actors';
import { beep, TILE, copperCount } from './FieldScene';

// 町・城マップ（DQ1式の分離マップ）。凡例 #:壁 .:地面 H:家 T:木 K:玉座 B:宝箱 D:出入口
// 戦闘・採取なし。宿/店/教会/鍛冶/王の玉座を扱う
export function townById(id) {
  return (DIALOGUES.towns || []).find((t) => t.id === id) || null;
}

function npcColor(n) {
  if (n.inn) return 0xffd54f;
  if (n.shop) return 0x4fc3f7;
  if (n.smith) return 0xff6f00;
  if (n.church) return 0xffffff;
  if (n.id === 'guard' || n.id === 'guard_in' || n.id === 'soldier') return 0x7e9bff;
  return 0xff9800;
}

function npcLines(npc) {
  if (gameState.bossDefeated && npc.clear) return npc.clear;
  if (gameState.hasOrder && npc.mid) return npc.mid;
  return npc.lines;
}

function kingStage() {
  if (!gameState.hasOrder) return 'first';
  if (gameState.bossDefeated) return 'clear';
  if (gameState.chestOpened) return 'chest';
  return 'ordered';
}

export default class TownScene extends Phaser.Scene {
  constructor() {
    super('town');
  }

  preload() {
    preloadCharArt(this);
    preloadTiles(this);
  }

  town() {
    return townById(this.townId);
  }

  create(data) {
    this.townId = data.townId;
    const town = this.town();
    if (!town) {
      this.scene.start('field');
      return;
    }
    gameState.map = 'town';
    gameState.townId = this.townId;
    if (data.spawn) {
      this.tx = town.spawn.x; this.ty = town.spawn.y;
      gameState.px = this.tx; gameState.py = this.ty;
    } else {
      this.tx = gameState.px; this.ty = gameState.py;
    }

    this.moveCd = 0;
    this.cmdLock = false;
    this.talk = null;
    this.npcs = (town.npcs || []).map((n) => ({ ...n }));
    this.npcEntries = [];
    this.npcActors = [];
    this.decalImgs = [];

    this.drawTown();
    this.drawHud();

    const cam = this.cameras.main;
    const MAP = town.map;
    cam.setBounds(0, 0, MAP[0].length * TILE, MAP.length * TILE);
    cam.startFollow(this.heroActor ? this.heroActor.img : this.follower, true, 0.16, 0.16);
    cam.fadeIn(200, 0, 0, 0);
    this.setMessage(`「${town.name}」に入った。`);

    startBgm('field');
    this.events.once('shutdown', () => { stopBgm(); stopWander(this.npcEntries || []); });

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey('W');
    this.keyA = this.input.keyboard.addKey('A');
    this.keyS = this.input.keyboard.addKey('S');
    this.keyD = this.input.keyboard.addKey('D');
    this.input.keyboard.on('keydown', (e) => this.handleKey(e));
    this.refreshStatus();
  }

  tileAt(x, y) { return this.town().map[y][x]; }

  npcAt(x, y) {
    return (this.npcs || []).find((n) => n.x === x && n.y === y) || null;
  }

  actorFor(npc) {
    const e = (this.npcEntries || []).find((it) => it.npc === npc);
    return e ? e.actor : null;
  }

  drawTown() {
    if (this.townGfx) this.townGfx.destroy();
    if (this.markGfx) this.markGfx.destroy();
    if (this.playerGfx) this.playerGfx.destroy();
    if (this.follower) this.follower.destroy();
    if (this.npcImgs) this.npcImgs.forEach((i) => i.destroy());
    this.npcImgs = [];
    if (this.decalImgs) this.decalImgs.forEach((i) => i.destroy());
    this.decalImgs = [];
    if (this.heroActor) { destroyActor(this.heroActor); this.heroActor = null; }
    if (this.npcActors) this.npcActors.forEach((a) => destroyActor(a));
    this.npcActors = [];
    if (this.tileImgs) this.tileImgs.forEach((i) => i.destroy());
    this.tileImgs = [];
    const g = this.add.graphics();
    this.townGfx = g;
    const town = this.town();
    const MAP = town.map;
    const stone = town.ground === 'stone';
    const wallKey = town.id === 'castle' ? 't-castle-wall' : 't-dungeon-wall';
    const floorKey = town.id === 'castle' ? 't-castle-floor' : 't-dungeon-floor';
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[y].length; x++) {
        const ch = MAP[y][x];
        const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
        let imgOk = null;
        if (ch === '#') imgOk = putTile(this, wallKey, cx, cy, TILE + 6);
        else if (stone) imgOk = putTile(this, floorKey, cx, cy, TILE + 6);
        else {
          imgOk = putTile(this, 't-grass', cx, cy, TILE + 8);
          if (imgOk) { const hh = tileHash(x + 457, y + 291); imgOk.setFlip(hh % 2 === 0, hh % 3 === 0); }
        }
        if (imgOk) this.tileImgs.push(imgOk);
        else {
          if (ch === '#') g.fillStyle(0x3a3a4a, 1);
          else if (stone) g.fillStyle(0x5a4a3a, 1);
          else g.fillStyle(0x4a8f3c, 1);
          g.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
        }
      }
    }
    // 立体オブジェクト＋マーカー（足元のYで奥行きソート）
    const m = this.add.graphics();
    this.markGfx = m;
    // 壁際の落ち影
    const atT = (ax, ay) => MAP[ay]?.[ax];
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[y].length; x++) {
        if (MAP[y][x] === '#') continue;
        const px = x * TILE, py = y * TILE;
        if (atT(x, y - 1) === '#') {
          m.fillStyle(0x000000, 0.32); m.fillRect(px, py, TILE, 5);
          m.fillStyle(0x000000, 0.14); m.fillRect(px, py + 5, TILE, 9);
        }
        if (atT(x - 1, y) === '#') {
          m.fillStyle(0x000000, 0.26); m.fillRect(px, py, 4, TILE);
          m.fillStyle(0x000000, 0.10); m.fillRect(px + 4, py, 8, TILE);
        }
        if (atT(x + 1, y) === '#') {
          m.fillStyle(0x000000, 0.20); m.fillRect(px + TILE - 4, py, 4, TILE);
        }
      }
    }
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[y].length; x++) {
        const ch = MAP[y][x];
        const px = x * TILE, py = y * TILE;
        const cx = px + TILE / 2, cy = py + TILE / 2;
        const bottom = py + TILE;
        if (ch === 'H') {
          if (!putObject(this, 'p-house', cx, bottom + 2, TILE * 1.36)) {
            m.fillStyle(0x7a3b00, 1); m.fillRect(px + 10, py + 10, 44, 40);
          }
        }
        if (ch === 'T') {
          if (!putObject(this, 'p-tree', cx, bottom + 4, TILE * 1.18)) {
            m.fillStyle(0x2f6b2a, 1); m.fillRect(px + 14, py + 16, 36, 32);
          }
        }
        if (ch === 'K') {
          if (!putObject(this, 'p-throne', cx, bottom, TILE * 1.06)) {
            m.fillStyle(0xd8c23a, 1); m.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
          }
        }
        if (ch === 'P') {
          if (!putObject(this, 'p-pot', cx, bottom, 46)) {
            m.fillStyle(0x8d5a2b, 1); m.fillRect(px + 18, py + 22, 28, 26);
          }
        }
        if (ch === 'N') {
          if (!putObject(this, 'p-sign', cx, bottom, 44)) {
            m.fillStyle(0x6e3e1c, 1); m.fillRect(px + 26, py + 14, 12, 36);
          }
        }
        if (ch === 'F') {
          if (!putObject(this, 'p-fountain', cx, bottom, TILE * 1.02)) {
            m.fillStyle(0x3a6fd8, 1); m.fillRect(px + 12, py + 12, 40, 40);
          }
        }
        if (ch === 'B') {
          const b = (town.chests || []).find((c) => c.x === x && c.y === y);
          const opened = b && gameState.castleChests[`${this.townId}:${b.id}`];
          if (!opened) {
            m.fillStyle(0x000000, 0.28); m.fillEllipse(cx, bottom - 8, 40, 12);
            m.fillStyle(0xd8a03a, 1); m.fillRect(px + 12, py + 16, 40, 32);
            m.fillStyle(0x8a5a1a, 1); m.fillRect(px + 12, py + 30, 40, 5);
            m.fillStyle(0xffe082, 1); m.fillRect(px + 12, py + 16, 40, 3);
            m.fillStyle(0x000000, 1); m.fillRect(px + 28, py + 28, 10, 10);
          }
        }
        if (ch === 'D') {
          m.fillStyle(0x000000, 0.35); m.fillRect(px + 14, py + 14, TILE - 28, TILE - 22);
          m.fillStyle(0x6e3e1c, 1);
          m.fillRect(px + 14, py + 14, 6, TILE - 22);
          m.fillRect(px + TILE - 20, py + 14, 6, TILE - 22);
          m.fillRect(px + 14, py + 14, TILE - 28, 6);
        }
        // 外の草地・石畳に小物を散らす
        if ((ch === '.' || ch === 'T') && !stone) {
          const h = tileHash(x * 5 + 3, y * 9 + 7) % 100;
          const ox = (tileHash(x + 5, y + 6) % 22) - 11;
          if (h < 7) this.addDecal('d-flower-a', cx + ox, cy, 16, bottom);
          else if (h < 13) this.addDecal('d-tuft', cx + ox, cy, 18, bottom);
          else if (h < 16) this.addDecal('d-stone', cx + ox, cy, 15, bottom);
        }
      }
    }
    // NPC（店・宿・教会・王・衛兵は固定、村人・旅人は散策）
    if (this.npcEntries) stopWander(this.npcEntries);
    this.npcEntries = [];
    this.npcActors = [];
    for (const n of this.npcs) {
      const px = n.x * TILE + TILE / 2, py = n.y * TILE + TILE / 2;
      let actor = null;
      if (this.textures.exists(npcKey(n.id))) {
        actor = createActor(this, px, py, npcKey(n.id), 46);
        setActorLabel(this, actor, n.name);
        this.npcActors.push(actor);
      } else {
        const c = npcColor(n);
        g.fillStyle(c, 1);
        g.fillRect(n.x * TILE + 18, n.y * TILE + 18, 28, 28);
        g.lineStyle(3, 0x000000, 1);
        g.strokeRect(n.x * TILE + 18, n.y * TILE + 18, 28, 28);
      }
      const fixed = !!(n.inn || n.shop || n.church || n.smith || n.toolshop || n.king || n.guard || n.guard_in || n.soldier);
      if (actor && !fixed) this.npcEntries.push({ npc: n, actor });
    }
    if (this.npcEntries.length) {
      setupWander(this, this.npcEntries, {
        radius: 2,
        tileAt: (tx, ty) => {
          const c = this.town().map[ty]?.[tx];
          return ['.', 'T'].includes(c) ? c : null;
        },
        isFree: (tx, ty) => !this.npcAt(tx, ty) && !(this.tx === tx && this.ty === ty),
        canAct: () => !this.cmdLock && !this.talk && !isStatusOpen(),
      });
    }
    this.follower = this.add.rectangle(
      this.tx * TILE + TILE / 2, this.ty * TILE + TILE / 2, 4, 4, 0xffffff, 0
    );
    const pg = this.add.graphics();
    this.playerGfx = pg;
    if (this.textures.exists('hero')) {
      this.heroActor = createActor(this, this.tx * TILE + TILE / 2, this.ty * TILE + TILE / 2, 'hero', 50);
      pg.clear();
    } else {
      this.heroActor = null;
      this.drawPlayer();
    }
  }

  addDecal(key, x, y, size, depthY) {
    if (!this.textures.exists(key)) return null;
    const img = this.add.image(x, y, key).setDisplaySize(size, size).setDepth(depthY - 3);
    if (!this.decalImgs) this.decalImgs = [];
    this.decalImgs.push(img);
    return img;
  }

  drawPlayer() {
    if (this.heroActor) return;
    const pg = this.playerGfx;
    const px = this.tx * TILE, py = this.ty * TILE;
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
    this.statusText = this.add.text(8, 6, '', { fontSize: '14px', color: '#fff', fontFamily: "'DotGothic16', monospace" }).setScrollFactor(0);
    g.fillStyle(0x000000, 1); g.fillRect(0, 490, 800, 110);
    g.lineStyle(2, 0xffffff, 1); g.strokeRect(0, 490, 800, 110);
    this.msgText = this.add.text(12, 500, '', { fontSize: '15px', color: '#fff', fontFamily: "'DotGothic16', monospace", wordWrap: { width: 770 } }).setScrollFactor(0);
  }

  refreshStatus() {
    const p = gameState.player;
    const n = Object.keys(p.traits).length;
    this.statusText.setText(
      `Lv${p.lv} HP ${p.hp}/${p.maxHp} ATK${p.atk} EXP${p.exp}/${p.next} G${p.gold} 草${p.herbs} 銅${copperCount()} 特性${n}種 ＠${this.town().name}`
    );
  }

  setMessage(t) { this.msgText.setText(t); }

  handleKey(e) {
    if (e.repeat) return;
    const k = e.key;
    if (k === 'm' || k === 'M') {
      const m = toggleMute();
      this.setMessage(m ? '音を消した（Mで元に戻す）' : '音を出した');
      return;
    }
    if (k === 't' || k === 'T') {
      if (!this.talk && !this.cmdLock) toggleStatus();
      return;
    }
    if (isStatusOpen()) return;
    if (this.talk) { this.advanceTalk(k); return; }
    if (this.cmdLock) return;
    if (k === 'e' || k === 'E' || k === ' ') { this.tryTalk(); return; }
  }

  adjacentKing() {
    const MAP = this.town().map;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]];
    for (const [dx, dy] of dirs) {
      const nx = this.tx + dx, ny = this.ty + dy;
      if (ny < 0 || nx < 0 || ny >= MAP.length || nx >= MAP[0].length) continue;
      if (MAP[ny][nx] === 'K') return true;
    }
    return false;
  }

  tryTalk() {
    if (this.adjacentKing()) {
      const stage = kingStage();
      const lines = this.kingLines(stage);
      this.talk = { name: '王さま', lines, idx: 0, choice: null, kingStage: stage };
      this.cmdLock = true;
      this.showTalk();
      return;
    }
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]];
    for (const [dx, dy] of dirs) {
      const n = this.npcAt(this.tx + dx, this.ty + dy);
      if (n) {
        const a = this.actorFor(n);
        if (a) turnTo(a, this.heroActor);
        if (n.king) {
          const stage = kingStage();
          const lines = this.kingLines(stage);
          this.talk = { name: '王さま', lines, idx: 0, choice: null, kingStage: stage };
        } else {
          this.talk = { name: n.name, npc: n, lines: npcLines(n), idx: 0, choice: null };
        }
        this.cmdLock = true;
        this.showTalk();
        return;
      }
    }
    const found = this.adjacentProp();
    if (found) {
      if (found.kind === 'P') { this.openPot(found); return; }
      if (found.kind === 'N') {
        const s = (this.town().signs || []).find((v) => v.x === found.x && v.y === found.y);
        this.setMessage(s ? `「${s.text}」と書いてある。` : '古い立て札だ。文字が読めない。');
        return;
      }
      if (found.kind === 'F') {
        this.setMessage(this.town().fountain || '冷たい水が湧いている。');
        return;
      }
    }
    this.setMessage('この辺りには 誰もいないようだ。');
  }

  adjacentProp() {
    const MAP = this.town().map;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const nx = this.tx + dx, ny = this.ty + dy;
      if (ny < 0 || nx < 0 || ny >= MAP.length || nx >= MAP[0].length) continue;
      const ch = MAP[ny][nx];
      if (ch === 'P' || ch === 'N' || ch === 'F') return { kind: ch, x: nx, y: ny };
    }
    return null;
  }

  openPot(found) {
    const key = `${this.townId}:${found.x},${found.y}`;
    if (gameState.castleChests[key]) {
      this.setMessage('空っぽの壺だ。');
      return;
    }
    const pot = ((this.town().pots) || []).find((p) => p.x === found.x && p.y === found.y);
    gameState.castleChests[key] = true;
    const p = gameState.player;
    const g = (pot && pot.gold) || 0;
    const h = (pot && pot.herbs) || 0;
    p.gold += g;
    p.herbs += h;
    beep(700, 80);
    if (!g && !h) this.setMessage('壺を調べたが 何もなかった。');
    else this.setMessage(`壺を調べた！${g ? ` ${g}G` : ''}${h ? ` やくそう${h}個` : ''}手に入れた！`);
    this.drawTown();
    this.refreshStatus();
  }

  kingLines(stage) {
    if (stage === 'first' && loadMeta().loops >= 2) return DIALOGUES.king.firstDeja;
    if (stage === 'clear') {
      const c = loadMeta().clears || 1;
      if (c >= 3) return DIALOGUES.king.clear3;
      if (c === 2) return DIALOGUES.king.clear2;
      return DIALOGUES.king.clear1;
    }
    return DIALOGUES.king[stage];
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
    if (t.kingStage === 'clear') {
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
      this.setMessage(`${t.name}「そうか。神のご加護を。」`);
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

  chooseNextLoop(yes) {
    if (yes) {
      startNextLoop();
      jingle('levelup');
      this.scene.start('field');
      return;
    }
    this.setMessage('王さま「そうか。ゆっくり休んでいけ。」');
    this.talk.choice = null;
    this.talk.done = true;
    this.refreshStatus();
  }

  endTalk(t) {
    if (t.kingStage === 'first' && !gameState.hasOrder) {
      gameState.hasOrder = true;
      gameState.player.herbs += 1;
      jingle('levelup');
    }
    this.talk = null;
    this.cmdLock = false;
    this.refreshStatus();
  }

  passable(ch) { return ['.', 'T', 'D', 'K', 'B'].includes(ch); }

  tryMove(dx, dy) {
    const MAP = this.town().map;
    const nx = this.tx + dx, ny = this.ty + dy;
    if (ny < 0 || nx < 0 || ny >= MAP.length || nx >= MAP[0].length) return;
    if (this.npcAt(nx, ny)) { beep(120, 60); return; }
    const ch = MAP[ny][nx];
    if (!this.passable(ch)) { beep(120, 60); return; }
    this.tx = nx; this.ty = ny;
    gameState.px = nx; gameState.py = ny;
    this.follower.setPosition(nx * TILE + TILE / 2, ny * TILE + TILE / 2);
    if (this.heroActor) moveActor(this, this.heroActor, nx * TILE + TILE / 2, ny * TILE + TILE / 2, dx, dy, 130);
    else this.drawPlayer();
    beep(660, 30);
    this.onEnterTile(ch);
    this.refreshStatus();
  }

  onEnterTile(ch) {
    if (ch === 'D') {
      this.exitTown();
      return;
    }
    if (ch === 'B') {
      this.openTownChest();
      return;
    }
  }

  openTownChest() {
    const town = this.town();
    const b = (town.chests || []).find((c) => c.x === this.tx && c.y === this.ty);
    if (!b) return;
    const key = `${this.townId}:${b.id}`;
    if (gameState.castleChests[key]) {
      this.setMessage('空っぽの宝箱だ。');
      return;
    }
    gameState.castleChests[key] = true;
    const p = gameState.player;
    p.gold += b.gold || 0;
    p.herbs += b.herbs || 0;
    let msg = `宝箱を開けた！${b.gold ? ` ${b.gold}G` : ''}${b.herbs ? ` やくそう${b.herbs}個` : ''}を手に入れた！`;
    if (b.trait) {
      const got = applyTrait(p, b.trait);
      if (got) msg += ` さらに「${got.name}」の力を得た！`;
    }
    jingle('chest');
    this.setMessage(msg);
    this.drawTown();
    this.refreshStatus();
  }

  exitTown() {
    this.cmdLock = true;
    stopBgm();
    gameState.px = gameState.fieldX;
    gameState.py = gameState.fieldY;
    gameState.map = 'camp';
    gameState.townId = null;
    gameState.encounterGraceUntil = Date.now() + 1500;
    const cam = this.cameras.main;
    cam.fadeOut(250, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('field');
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
