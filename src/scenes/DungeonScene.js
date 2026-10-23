import Phaser from 'phaser';
import DIALOGUES from '../data/dialogues.json';
import { gameState, takeLegacy, generateVeins } from '../game/state';
import { applyTrait } from '../data/traits';
import { toggleStatus, isStatusOpen } from '../game/statusUi';
import { startBgm, stopBgm, jingle, toggleMute } from '../game/sound';
import { preloadCharArt, drawHeroFigure } from '../game/charArt';
import { preloadTiles, putTile, tileHash } from '../game/tileArt';
import { createActor, moveActor, destroyActor } from '../game/actors';
import { debugNoEncounter } from '../game/debug';
import { beep, TILE, copperCount } from './FieldScene';

// 坑道（複層）。凡例 #:壁 .:床 S:入口（キャンプに戻る） H:宝箱 B:ボス床
// K:鍵扉（納品の鍵） G:階段（上下層を行き来） O:銅鉱脈（隣接Eキーで採取）
export default class DungeonScene extends Phaser.Scene {
  constructor() {
    super('dungeon');
  }

  preload() {
    preloadCharArt(this);
    preloadTiles(this);
  }

  floorCfg() {
    return DIALOGUES.dungeon.floors[this.floorIdx];
  }

  floorMap() {
    return this.floorCfg().map;
  }

  create(data) {
    this.moveCd = 0;
    this.cmdLock = false;
    this.moved = false;
    this.floorIdx = data.floor || 0;
    gameState.map = 'mine';
    gameState.floor = this.floorIdx;
    const MAP = this.floorMap();
    if (data.sx != null && data.sy != null) {
      this.dx = data.sx; this.dy = data.sy;
    } else {
      const s = this.findCh('S') || this.findCh('G');
      this.dx = s.x; this.dy = s.y;
    }
    if (!gameState.mineMined) gameState.mineMined = {};
    if (!gameState.mineMined[this.floorIdx]) gameState.mineMined[this.floorIdx] = {};
    if (!gameState.veins || !gameState.veins[0] || !gameState.veins[0].length) {
      gameState.veins = generateVeins(gameState.seed || 1);
    }

    this.drawMap();
    this.drawHud();
    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP[0].length * TILE, MAP.length * TILE);
    cam.startFollow(this.heroActor ? this.heroActor.img : this.follower, true, 0.16, 0.16);
    cam.fadeIn(250, 0, 0, 0);
    this.setMessage(`「${this.floorCfg().name}」にもぐった。光る岩は隣でEキーだ`);
    startBgm('dungeon');
    this.events.once('shutdown', stopBgm);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey('W');
    this.keyA = this.input.keyboard.addKey('A');
    this.keyS = this.input.keyboard.addKey('S');
    this.keyD = this.input.keyboard.addKey('D');
    this.input.keyboard.on('keydown', (e) => this.handleKey(e));
    this.refreshStatus();
  }

  findCh(ch) {
    const MAP = this.floorMap();
    for (let y = 0; y < MAP.length; y++)
      for (let x = 0; x < MAP[y].length; x++)
        if (MAP[y][x] === ch) return { x, y };
    return null;
  }

  tileAt(x, y) { return this.floorMap()[y][x]; }

  minedKey(x, y) { return `${x},${y}`; }

  veinAt(x, y) {
    const veins = (gameState.veins && gameState.veins[this.floorIdx]) || [];
    return veins.some(([vx, vy]) => vx === x && vy === y);
  }

  isMined(x, y) {
    const m = gameState.mineMined[this.floorIdx] || {};
    return !!m[this.minedKey(x, y)];
  }

  drawMap() {
    if (this.follower) this.follower.destroy();
    if (this.heroActor) { destroyActor(this.heroActor); this.heroActor = null; }
    const g = this.add.graphics();
    this.mapGfx = g;
    this.drawTiles();
    this.follower = this.add.rectangle(
      this.dx * TILE + TILE / 2, this.dy * TILE + TILE / 2, 4, 4, 0xffffff, 0
    );
    const pg = this.add.graphics();
    this.playerGfx = pg;
    if (this.textures.exists('hero')) {
      this.heroActor = createActor(this, this.dx * TILE + TILE / 2, this.dy * TILE + TILE / 2, 'hero', 50);
      pg.clear();
    } else {
      this.drawPlayer();
    }
  }

  drawTiles() {
    if (this.tileImgs) this.tileImgs.forEach((i) => i.destroy());
    this.tileImgs = [];
    if (this.markGfx) this.markGfx.destroy();
    const g = this.mapGfx;
    const MAP = this.floorMap();
    g.clear();
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[y].length; x++) {
        const ch = MAP[y][x];
        const px = x * TILE, py = y * TILE;
        const cx = px + TILE / 2, cy = py + TILE / 2;
        let imgOk = null;
        if (ch === '#') imgOk = putTile(this, 't-dungeon-wall', cx, cy, TILE + 6);
        else imgOk = putTile(this, 't-dungeon-floor', cx, cy, TILE + 8);
        if (imgOk) {
          if (ch !== '#') { const hh = tileHash(x + 31, y + 17); imgOk.setFlip(hh % 2 === 0, hh % 3 === 0); }
          this.tileImgs.push(imgOk);
        }
        if (!imgOk) {
          if (ch === '#') g.fillStyle(0x3a3a4a, 1);
          else g.fillStyle(0x5a4a3a, 1);
          g.fillRect(px, py, TILE - 1, TILE - 1);
        }
      }
    }
    // マーカー類は前面レイヤーに描く（タイル画像は後生成＝前面になるため同Graphicsだと隠れる）
    const m = this.add.graphics();
    this.markGfx = m;
    // 壁と床の境目に落ち影を入れて立体感を出す
    const atD = (ax, ay) => MAP[ay]?.[ax];
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[y].length; x++) {
        if (MAP[y][x] === '#') continue;
        const px = x * TILE, py = y * TILE;
        const D = 12;
        if (atD(x, y - 1) === '#') {
          m.fillStyle(0x000000, 0.34); m.fillRect(px, py, TILE, 5);
          m.fillStyle(0x000000, 0.16); m.fillRect(px, py + 5, TILE, D - 5);
        }
        if (atD(x - 1, y) === '#') {
          m.fillStyle(0x000000, 0.28); m.fillRect(px, py, 4, TILE);
          m.fillStyle(0x000000, 0.12); m.fillRect(px + 4, py, D - 4, TILE);
        }
        if (atD(x + 1, y) === '#') {
          m.fillStyle(0x000000, 0.22); m.fillRect(px + TILE - 4, py, 4, TILE);
        }
      }
    }
    const hasFloorImg = this.textures.exists('t-dungeon-floor');
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[y].length; x++) {
        const ch = MAP[y][x];
        const px = x * TILE, py = y * TILE;
        if (ch === 'S') { m.fillStyle(0x3a6fd8, 1); m.fillRect(px + 14, py + 14, TILE - 28, TILE - 28); }
        if (ch === 'G' && !hasFloorImg) { m.fillStyle(0x6e4a1c, 1); m.fillRect(px, py, TILE - 1, TILE - 1); }
        if (this.veinAt(x, y)) {
          if (this.isMined(x, y)) {
            m.fillStyle(0x4a4a4a, 1);
            m.fillRect(px + 14, py + 14, 36, 36);
          } else {
            m.fillStyle(0xd87818, 1);
            m.fillRect(px + 8, py + 8, 48, 48);
            m.fillStyle(0xffe9a0, 1);
            m.fillRect(px + 14, py + 14, 8, 8);
            m.fillRect(px + 40, py + 36, 8, 8);
          }
        }
        if (ch === 'K' && !gameState.hasKey) {
          m.fillStyle(0xffd54f, 1); m.fillRect(px + 26, py + 24, 12, 16);
        }
        if (ch === 'B' && !gameState.bossDefeated) {
          m.fillStyle(0xffffff, 1);
          m.fillTriangle(px + 12, py + 20, px + 24, py + 44, px + 12, py + 44);
          m.fillTriangle(px + 52, py + 20, px + 40, py + 44, px + 52, py + 44);
        }
        if (ch === 'H' && !gameState.chestOpened) {
          m.fillStyle(0x000000, 1); m.fillRect(px + 20, py + 24, 24, 16);
        }
        if (ch === 'G') {
          m.fillStyle(0x2a1a0a, 1); m.fillRect(px + 16, py + 40, 32, 12);
        }
      }
    }
  }

  drawPlayer() {
    if (this.heroActor) return;
    const pg = this.playerGfx;
    const px = this.dx * TILE, py = this.dy * TILE;
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
    this.statusText.setText(`Lv${p.lv} HP ${p.hp}/${p.maxHp} ATK${p.atk} G${p.gold} 草${p.herbs} 銅${copperCount()} ＠${this.floorCfg().name}`);
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
      if (!this.cmdLock) toggleStatus();
      return;
    }
    if (this.cmdLock || isStatusOpen()) return;
    if (k === 'e' || k === 'E' || k === ' ') { this.tryMine(); return; }
  }

  adjacentOre() {
    const MAP = this.floorMap();
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const nx = this.dx + dx, ny = this.dy + dy;
      if (ny < 0 || nx < 0 || ny >= MAP.length || nx >= MAP[0].length) continue;
      if (this.veinAt(nx, ny) && !this.isMined(nx, ny)) return { x: nx, y: ny };
    }
    return null;
  }

  tryMine() {
    const ore = this.adjacentOre();
    if (!ore) {
      // 枯渇済みの鉱脈に隣接しているか
      const MAP = this.floorMap();
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of dirs) {
        const nx = this.dx + dx, ny = this.dy + dy;
        if (ny < 0 || nx < 0 || ny >= MAP.length || nx >= MAP[0].length) continue;
        if (this.veinAt(nx, ny)) { this.setMessage('掘り尽くされた鉱脈だ…。また今度な。'); return; }
      }
      return;
    }
    const rich = this.floorIdx >= 1;
    const n = rich ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 2);
    const p = gameState.player;
    if (!p.mats) p.mats = { copper: 0 };
    p.mats.copper += n;
    gameState.mineMined[this.floorIdx][this.minedKey(ore.x, ore.y)] = true;
    beep(760, 90);
    this.setMessage(`銅鉱石を${n}個掘り当てた！（所持${p.mats.copper}個）`);
    this.drawTiles();
    this.refreshStatus();
  }

  passable(ch) { return ['.', 'S', 'H', 'B', 'K', 'G'].includes(ch); }

  tryMove(dx, dy) {
    const MAP = this.floorMap();
    const nx = this.dx + dx, ny = this.dy + dy;
    if (ny < 0 || nx < 0 || ny >= MAP.length || nx >= MAP[0].length) return;
    const ch = this.tileAt(nx, ny);
    if (ch === 'K' && !gameState.hasKey) { beep(120, 60); this.setMessage('かぎがかかっている。銅3個を親方に渡して鍵をもらおう。'); return; }
    if (this.veinAt(nx, ny) && !this.isMined(nx, ny)) { beep(120, 60); this.setMessage('銅の鉱脈だ。隣でEキーだ。'); return; }
    if (!this.passable(ch)) { beep(120, 60); return; }
    this.dx = nx; this.dy = ny;
    gameState.px = nx; gameState.py = ny;
    this.moved = true;
    this.follower.setPosition(nx * TILE + TILE / 2, ny * TILE + TILE / 2);
    if (this.heroActor) moveActor(this, this.heroActor, nx * TILE + TILE / 2, ny * TILE + TILE / 2, dx, dy, 130);
    else this.drawPlayer();
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
    if (ch === 'G') {
      this.switchFloor();
      return;
    }
    if (ch === 'H') {
      if (!gameState.chestOpened) this.openChest();
      else this.setMessage('空っぽの宝箱だ。');
      return;
    }
    if (ch === 'B') {
      if (!gameState.bossDefeated) {
        this.enterBattle(true);
        return;
      }
      this.setMessage('番人を倒した証が残っている。');
      return;
    }
    if (Date.now() < gameState.encounterGraceUntil) return;
    const cfg = this.floorCfg();
    const rate = debugNoEncounter() ? 0 : Math.max(0.02, cfg.rate * (1 - 0.1 * gameState.player.quick));
    if (Math.random() < rate) this.enterBattle(false);
  }

  openChest() {
    gameState.chestOpened = true;
    const p = gameState.player;
    const c = DIALOGUES.dungeon.chest;
    p.gold += c.gold;
    p.herbs += c.herbs;
    const got = applyTrait(p, gameState.chestTrait);
    let msg = `${c.message} さらに「${got.name}」の力を得た！`;
    const legacy = takeLegacy();
    if (legacy) {
      if (!p.mats) p.mats = { copper: 0 };
      p.mats.copper += legacy.copper || 0;
      p.herbs += legacy.herbs || 0;
      msg += ` 誰かの置き土産（銅${legacy.copper || 0}・草${legacy.herbs || 0}）もあった！`;
    }
    jingle('chest');
    this.setMessage(`${msg} ${DIALOGUES.dungeon.bossWarning}`);
    this.drawTiles();
    this.refreshStatus();
  }

  enterBattle(isBoss) {
    this.cmdLock = true;
    stopBgm();
    beep(200, 150);
    const cfg = this.floorCfg();
    gameState.px = this.dx; gameState.py = this.dy;
    const cam = this.cameras.main;
    cam.fadeOut(200, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('battle', {
        tile: '.', from: 'dungeon', floor: this.floorIdx,
        sx: this.dx, sy: this.dy,
        lvBonus: cfg.lvBonus || 0, boss: isBoss,
        danger: cfg.danger || 1, pool: cfg.pool || null,
      });
    });
  }

  switchFloor() {
    const next = this.floorIdx >= 1 ? 0 : 1;
    const target = DIALOGUES.dungeon.floors[next];
    let sx = 1, sy = 1;
    outer: for (let y = 0; y < target.map.length; y++) {
      for (let x = 0; x < target.map[y].length; x++) {
        if (target.map[y][x] === 'G') { sx = x; sy = y; break outer; }
      }
    }
    this.cmdLock = true;
    stopBgm();
    const cam = this.cameras.main;
    cam.fadeOut(250, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('dungeon', { floor: next, sx, sy });
    });
  }

  exitDungeon() {
    this.cmdLock = true;
    stopBgm();
    gameState.map = 'camp';
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
