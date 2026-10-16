import Phaser from 'phaser';
import { FIELD_MAP, findTile } from '../data/fieldMap';
import DIALOGUES from '../data/dialogues.json';
import { gameState, resetState, saveGame, loadGame, hasSave, loadMeta } from '../game/state';
import { toggleStatus, isStatusOpen } from '../game/statusUi';
import { startBgm, stopBgm, jingle } from '../game/sound';
import { preloadCharArt, drawHeroFigure, drawNpcFigure } from '../game/charArt';
import { preloadTiles, putTile, tileHash } from '../game/tileArt';
import { regionAt, regionDanger } from '../data/regions';

export const TILE = 64;
export { beep } from '../game/sound';

const COLORS = {
  '#': 0x6b6259, '.': 0x4a8f3c, T: 0x2f6b2a, '~': 0x3a6fd8,
  C: 0xd8c23a, V: 0xb0722e, D: 0x5b2a86, S: 0x4a8f3c,
  '+': 0x9c5a2a, ':': 0xe0c070, M: 0x2a1a3a,
};

// DQ1式の地形別遭遇率（草原=低、森・砂浜・橋=中）。橋は出現率ではなく
// 「渡った先が強い」で警告するゲート扱いにする
const TILE_DANGER = { '.': 1, T: 1.1, ':': 1.3, '+': 2.0, S: 1, C: 1, V: 1, D: 1 };
const ENCOUNTER_RATE = { '.': 0.06, T: 0.12, ':': 0.12, '+': 0.12 };

function npcColor(n) {
  if (n.inn) return 0xffd54f;
  if (n.shop) return 0x4fc3f7;
  if (n.smith) return 0xff6f00;
  if (n.church) return 0xffffff;
  if (n.id === 'guard') return 0x7e9bff;
  if (n.foremanNpc) return 0xd84315;
  return 0xff9800;
}

function shade(color, amt) {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (color & 255) + amt));
  return (r << 16) | (g << 8) | b;
}

// テリトリー色（地面タイルのみ適用）。危険地帯ほど土の色が変わる
function tone(color, t) {
  if (!t) return color;
  const r = Math.max(0, Math.min(255, ((color >> 16) & 255) + t[0]));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 255) + t[1]));
  const b = Math.max(0, Math.min(255, (color & 255) + t[2]));
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

function foremanFieldStage() {
  if (!gameState.hasOrder) return 'pre';
  if (gameState.bossDefeated) return 'clearF';
  if (gameState.hasKey) return 'key';
  return 'ordered';
}

export default class FieldScene extends Phaser.Scene {
  constructor() {
    super('field');
  }

  preload() {
    preloadCharArt(this);
    preloadTiles(this);
  }

  // 生成タイルがあれば画像描画。なければfalse（矩形フォールバック用）
  drawTileImage(x, y, ch, cx, cy) {
    let baseKey = null;
    if (ch === '#') baseKey = 't-mountain';
    else if (ch === '~') baseKey = 't-water';
    else if (ch === ':') baseKey = 't-sand';
    else if (ch === '+') baseKey = 't-bridge';
    else if (ch === 'M') baseKey = 't-demon';
    else baseKey = (tileHash(x, y) % 2 === 0) ? 't-grass-a' : 't-grass-b';
    const baseImg = putTile(this, baseKey, cx, cy, TILE);
    if (!baseImg) return false;
    if (ch === '~') this.waterImgs.push(baseImg);
    // 同一テクスチャの繰り返し感を消すため反転を分散させる
    const h = tileHash(x + 101, y + 57);
    baseImg.setFlip(h % 2 === 0, h % 3 === 0);
    if (ch === 'T') putTile(this, 'p-tree', cx, cy, 54);
    else if (ch === 'C') putTile(this, 'p-castle', cx, cy - 6, 84);
    else if (ch === 'V') putTile(this, 'p-house', cx, cy, 84);
    else if (ch === 'D') putTile(this, 'p-mine', cx, cy, TILE);
    return true;
  }

  create() {
    const st = gameState;
    if (!st.initialized) {
      if (hasSave() && typeof confirm === 'function' && confirm('冒険の記録がある。つづきから始めるか？（OK=つづき／キャンセル=はじめから）')) {
        loadGame();
      } else {
        const s = findTile(FIELD_MAP, 'S');
        resetState(s.x, s.y);
      }
    }
    // セーブ地点が坑道・町内なら該当シーンへ直行する
    if (gameState.map === 'mine') {
      this.scene.start('dungeon', { floor: gameState.floor || 0, sx: gameState.px, sy: gameState.py });
      return;
    }
    if (gameState.map === 'town' && gameState.townId) {
      this.scene.start('town', { townId: gameState.townId });
      return;
    }

    this.moveCd = 0;
    this.cmdLock = false;
    this.talk = null;
    this.lastRegionId = this.currentRegion()?.id ?? null;

    this.drawField();
    this.drawHud();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, FIELD_MAP[0].length * TILE, FIELD_MAP.length * TILE);
    cam.startFollow(this.follower, true, 1, 1);
    cam.fadeIn(200, 0, 0, 0);

    if (st.pendingMsg) {
      this.setMessage(st.pendingMsg);
      st.pendingMsg = null;
    } else {
      this.setMessage('城前から出発。城や村に入ってみよう（Eで話す、Tでステータス）');
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
    this.waterImgs = [];
    const g = this.add.graphics();
    this.fieldGfx = g;
    for (let y = 0; y < FIELD_MAP.length; y++) {
      for (let x = 0; x < FIELD_MAP[y].length; x++) {
        const ch = FIELD_MAP[y][x];
        const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
        if (this.drawTileImage(x, y, ch, cx, cy)) continue;
        const v = ((x * 7 + y * 13) % 3) * 10 - 10;
        const region = regionAt(x, y);
        const ground = ['.', 'T', ':'].includes(ch);
        const base = ground ? tone(COLORS[ch] ?? 0x000000, region?.tone) : (COLORS[ch] ?? 0x000000);
        g.fillStyle(shade(base, v), 1);
        g.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
        const ax = x * TILE, ay = y * TILE;
        const off = tileHash(x, y) % 3;
        if (ch === '.') {
          g.fillStyle(shade(tone(COLORS['.'], region?.tone), -25), 1);
          g.fillRect(ax + 12 + off * 12, ay + 36, 10, 10);
          // 野花（開放感の小物）
          if ((x * 3 + y * 7) % 11 === 0) { g.fillStyle(0xfff176, 1); g.fillRect(ax + 30 - off * 8, ay + 14, 6, 6); }
          if ((x * 5 + y * 3) % 13 === 0) { g.fillStyle(0xffffff, 1); g.fillRect(ax + 44, ay + 46, 5, 5); }
        }
        if (ch === 'T') { g.fillStyle(0x1d4d1a, 1); g.fillRect(ax + 14 + off * 8, ay + 16, 20, 24); }
        if (ch === '~') { g.fillStyle(0x9fc8ff, 1); g.fillRect(ax + 10, ay + 28 + (off % 2) * 12, 40, 4); }
        if (ch === ':') { g.fillStyle(shade(COLORS[':'], -30), 1); g.fillRect(ax + 20 + off * 8, ay + 40, 8, 8); }
        if (ch === '+') { g.fillStyle(0x6e3e1c, 1); g.fillRect(ax + 8, ay, 6, TILE - 1); g.fillRect(ax + 50, ay, 6, TILE - 1); }
        if (ch === '#') { g.fillStyle(0x8a7d6d, 1); g.fillRect(ax + 8, ay + 8, 20, 10); }
        if (ch === 'C') {
          // 城：白壁＋赤屋根＋旗
          g.fillStyle(0xf5f5f5, 1); g.fillRect(ax + 18, ay + 20, 28, 28);
          g.fillStyle(0xc62828, 1); g.fillTriangle(ax + 14, ay + 20, ax + 32, ay + 4, ax + 50, ay + 20);
          g.fillStyle(0x333333, 1); g.fillRect(ax + 31, ay + 4, 2, 12);
          g.fillStyle(0xffeb3b, 1); g.fillRect(ax + 33, ay + 4, 10, 7);
        }
        if (ch === 'D') {
          // 坑口：坑木の枠＋暗い穴
          g.fillStyle(0x6e3e1c, 1); g.fillRect(ax + 10, ay + 8, 8, 48); g.fillRect(ax + 46, ay + 8, 8, 48);
          g.fillStyle(0x6e3e1c, 1); g.fillRect(ax + 10, ay + 8, 44, 8);
          g.fillStyle(0x000000, 1); g.fillRect(ax + 18, ay + 16, 28, 40);
        }
        if (ch === 'V') {
          // 家：壁＋三角屋根
          g.fillStyle(0xd7a86f, 1); g.fillRect(ax + 16, ay + 26, 32, 22);
          g.fillStyle(0x8d3b1f, 1); g.fillTriangle(ax + 12, ay + 26, ax + 32, ay + 10, ax + 52, ay + 26);
        }
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
        fontSize: '12px', color: '#fff', backgroundColor: '#000', fontFamily: "'DotGothic16', monospace",
      });
    }
    this.follower = this.add.rectangle(
      gameState.px * TILE + TILE / 2, gameState.py * TILE + TILE / 2, 4, 4, 0xffffff, 0
    );
    const pg = this.add.graphics();
    this.playerGfx = pg;
    this.drawPlayer();
    if (this.waterImgs.length) {
      this.tweens.add({ targets: this.waterImgs, alpha: 0.82, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
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
    this.statusText = this.add.text(8, 6, '', { fontSize: '14px', color: '#fff', fontFamily: "'DotGothic16', monospace" }).setScrollFactor(0);
    g.fillStyle(0x000000, 1); g.fillRect(0, 490, 800, 110);
    g.lineStyle(2, 0xffffff, 1); g.strokeRect(0, 490, 800, 110);
    this.msgText = this.add.text(12, 500, '', { fontSize: '15px', color: '#fff', fontFamily: "'DotGothic16', monospace", wordWrap: { width: 770 } }).setScrollFactor(0);
  }

  refreshStatus() {
    const p = gameState.player;
    const n = Object.keys(p.traits).length;
    const region = this.currentRegion ? this.currentRegion() : null;
    this.statusText.setText(
      `Lv${p.lv} HP ${p.hp}/${p.maxHp} ATK${p.atk} EXP${p.exp}/${p.next} G${p.gold} 草${p.herbs} 銅${copperCount()} 特性${n}種 ${gameState.hasOrder && !gameState.bossDefeated ? '★王命' : ''}${region ? ' ' + region.id : ''}`
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
    const n = this.adjacentNpc();
    if (!n) {
      this.setMessage('この辺りには 誰もいないようだ。');
      return;
    }
    if (n.foremanNpc) {
      const stage = this.foremanFieldStage();
      const lines = stage === 'ordered'
        ? [`銅鉱石は${copperCount()}/3個だ。`, '上層坑道の光る岩を Eキーで掘るんだ。']
        : DIALOGUES.foreman[stage];
      this.talk = { name: '親方', npc: n, lines, idx: 0, choice: null, foremanStage: stage };
      this.cmdLock = true;
      this.showTalk();
      return;
    }
    this.talk = { name: n.name, npc: n, lines: npcLines(n), idx: 0, choice: null };
    this.cmdLock = true;
    this.showTalk();
  }

  foremanFieldStage() {
    if (!gameState.hasOrder) return 'pre';
    if (gameState.bossDefeated) return 'clearF';
    if (gameState.hasKey) return 'key';
    return 'ordered';
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
    if (t.choice === 'herb') {
      if (k === 'z' || k === 'Z' || k === 'Enter' || k === ' ') return this.chooseHerb(true);
      if (k === 'x' || k === 'X') return this.chooseHerb(false);
      return;
    }
    if (t.choice === 'deliver') {
      if (k === 'z' || k === 'Z' || k === 'Enter' || k === ' ') return this.chooseDeliver(true);
      if (k === 'x' || k === 'X') return this.chooseDeliver(false);
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
    if (t.npc && t.npc.toolshop) {
      t.choice = 'herb';
      this.setMessage(`${t.name}「やくそう10Gだ。買うか？（Z=1個買う X=やめる）」`);
      return;
    }
    if (t.foremanStage === 'ordered' && !gameState.hasKey) {
      if (copperCount() >= 3) {
        t.choice = 'deliver';
        this.setMessage('銅鉱石3個を渡すか？（Z=渡す X=やめる）');
        return;
      }
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

  chooseHerb(yes) {
    const t = this.talk;
    const p = gameState.player;
    if (!yes) {
      this.setMessage(`${t.name}「そうか。また来てくれ。」`);
      t.choice = null;
      t.done = true;
      this.refreshStatus();
      return;
    }
    if (p.gold < 10) {
      this.setMessage(`${t.name}「お金が足りないな。10Gだ。」`);
      this.refreshStatus();
      return;
    }
    p.gold -= 10;
    p.herbs += 1;
    beep(700, 80);
    this.setMessage(`やくそうを買った！（残り${p.herbs}個・G${p.gold}）続けてどうぞ（X=やめる）`);
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

  endTalk(t) {
    this.talk = null;
    this.cmdLock = false;
    this.refreshStatus();
  }

  passable(ch) { return ['.', 'T', ':', '+', 'C', 'V', 'D', 'S'].includes(ch); }

  // DQ1式：テリトリー（3x3）×地形タイルの危険度の高い方を採用
  currentRegion() {
    return regionAt(gameState.px, gameState.py);
  }

  regionDanger() {
    const region = this.currentRegion();
    const ch = FIELD_MAP[gameState.py][gameState.px];
    return Math.max(regionDanger(region), TILE_DANGER[ch] ?? 1);
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
    const regionChanged = this.lastRegionId !== this.currentRegion()?.id;
    this.lastRegionId = this.currentRegion()?.id ?? null;
    this.onEnterTile(ch, regionChanged);
    this.refreshStatus();
  }

  onEnterTile(ch, regionChanged = false) {
    const town = (DIALOGUES.towns || []).find((t) => t.fieldX === gameState.px && t.fieldY === gameState.py);
    if (town && (ch === 'C' || ch === 'V')) {
      this.enterTown(town.id);
      return;
    }
    if (ch === 'D') {
      if (!gameState.hasOrder) {
        this.setMessage('北の山の坑口…。まだ王さまに会っていない。（西の城へ）');
        return;
      }
      this.enterDungeon();
      return;
    }
    if (Date.now() < gameState.encounterGraceUntil) return;
    if (ch === '+') {
      this.setMessage('橋を渡った！ この先は強い敵が出るぞ！（エリア' + (this.currentRegion()?.id ?? '?') + '）');
    } else if (regionChanged && !this.cmdLock) {
      const region = this.currentRegion();
      if (region) {
        this.setMessage(`― ${region.name}に入った！${region.lv >= 3 ? ' 強い敵に注意！' : ''}`);
      }
    }
    let rate = ENCOUNTER_RATE[ch] ?? 0;
    rate = Math.max(0.02, rate * (1 - 0.1 * gameState.player.quick));
    if (Math.random() < rate) {
      const region = this.currentRegion();
      this.enterBattle(ch, this.regionDanger(), region ? region.pool : null);
    }
  }

  enterBattle(tile, danger, pool) {
    this.cmdLock = true;
    stopBgm();
    const cam = this.cameras.main;
    cam.fadeOut(200, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('battle', { tile, from: 'field', danger: danger ?? this.regionDanger(), pool: pool ?? this.currentRegion()?.pool ?? null });
    });
  }

  enterTown(townId) {
    const town = (DIALOGUES.towns || []).find((t) => t.id === townId);
    if (!town) return;
    this.cmdLock = true;
    stopBgm();
    gameState.fieldX = gameState.px;
    gameState.fieldY = gameState.py;
    gameState.map = 'town';
    gameState.townId = townId;
    const cam = this.cameras.main;
    cam.fadeOut(250, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start('town', { townId, spawn: true });
    });
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
