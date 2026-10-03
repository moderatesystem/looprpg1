import Phaser from 'phaser';
import { FIELD_MAP, findTile, isReachable } from './data/fieldMap';
import { basePlayer, expForLevel, rollTraitChoices, applyTrait } from './data/traits';

const TILE = 32;
const ENEMIES = [
  { name: 'スライム', hp: 12, atk: 5, exp: 6, gold: 5 },
  { name: 'コウモリ', hp: 10, atk: 7, exp: 8, gold: 7 },
  { name: 'ゴブリン', hp: 16, atk: 8, exp: 11, gold: 10 },
];

// 簡易ピッ音（素材前仮置き）
let actx = null;
function beep(freq = 440, ms = 70) {
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

const COLORS = {
  '#': 0x6b6259, '.': 0x4a8f3c, T: 0x2f6b2a, '~': 0x3a6fd8,
  C: 0xd8c23a, V: 0xb0722e, D: 0x5b2a86, S: 0x4a8f3c,
};

class MainScene extends Phaser.Scene {
  constructor() {
    super('main');
  }

  create() {
    this.player = basePlayer();
    const s = findTile(FIELD_MAP, 'S');
    this.px = s.x; this.py = s.y;
    this.mode = 'field'; // field | battle | trait | talk
    this.hasOrder = false;
    this.cleared = false;
    this.moveCd = 0;
    this.pendingTraits = 0;

    // 到達チェック（デバッグ表示用）
    const c = this.findCh('C');
    const d = this.findCh('D');
    this.reachOK = isReachable(FIELD_MAP, s.x, s.y, c.x, c.y)
      && isReachable(FIELD_MAP, s.x, s.y, d.x, d.y);

    this.drawField();
    this.drawHud();
    this.setMessage('DQ1風試作：歩く→戦う→LvUPで特性3択。王様(C)に会い、洞窟(D)を目指せ');

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyZ = this.input.keyboard.addKey('Z');
    this.keyW = this.input.keyboard.addKey('W');
    this.keyA = this.input.keyboard.addKey('A');
    this.keyS = this.input.keyboard.addKey('S');
    this.keyD = this.input.keyboard.addKey('D');
    this.cmdIndex = 0;
    this.cmds = ['たたかう', 'とくせい', 'どうぐ', 'にげる'];

    this.input.keyboard.on('keydown', (e) => this.onKey(e));
  }

  findCh(ch) { return findTile(FIELD_MAP, ch); }

  drawField() {
    if (this.fieldGfx) this.fieldGfx.destroy();
    if (this.playerGfx) this.playerGfx.destroy();
    const g = this.add.graphics();
    this.fieldGfx = g;
    for (let y = 0; y < FIELD_MAP.length; y++) {
      for (let x = 0; x < FIELD_MAP[y].length; x++) {
        const ch = FIELD_MAP[y][x];
        g.fillStyle(COLORS[ch] ?? 0x000000, 1);
        g.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
        if (ch === 'C') { g.fillStyle(0xffffff, 1); g.fillRect(x * TILE + 12, y * TILE + 6, 8, 12); }
        if (ch === 'D') { g.fillStyle(0x000000, 1); g.fillRect(x * TILE + 8, y * TILE + 12, 16, 12); }
      }
    }
    const pg = this.add.graphics();
    this.playerGfx = pg;
    this.drawPlayer();
  }

  drawPlayer() {
    const pg = this.playerGfx;
    pg.clear();
    pg.fillStyle(0xffffff, 1);
    pg.fillRect(this.px * TILE + 8, this.py * TILE + 8, 16, 16);
    pg.lineStyle(2, 0x000000, 1);
    pg.strokeRect(this.px * TILE + 8, this.py * TILE + 8, 16, 16);
  }

  drawHud() {
    // 右ステータス枠
    const g = this.add.graphics();
    g.fillStyle(0x000000, 1); g.fillRect(640, 0, 160, 480);
    g.lineStyle(2, 0xffffff, 1); g.strokeRect(640, 0, 160, 480);
    this.statusText = this.add.text(650, 12, '', { fontSize: '14px', color: '#fff', fontFamily: 'monospace' });
    // 下メッセージ枠
    g.fillStyle(0x000000, 1); g.fillRect(0, 480, 800, 120);
    g.lineStyle(2, 0xffffff, 1); g.strokeRect(0, 480, 800, 120);
    this.msgText = this.add.text(12, 492, '', { fontSize: '15px', color: '#fff', fontFamily: 'monospace', wordWrap: { width: 770 } });
    // バトル表示用
    this.battleGfx = this.add.graphics();
    this.battleText = this.add.text(360, 60, '', { fontSize: '18px', color: '#ff0', fontFamily: 'monospace' });
    this.cmdText = this.add.text(60, 60, '', { fontSize: '18px', color: '#fff', fontFamily: 'monospace' });
    this.refreshStatus();
  }

  refreshStatus() {
    const p = this.player;
    const traitNames = Object.entries(p.traits).map(([k, v]) => `${k}x${v}`).join(' ') || 'なし';
    this.statusText.setText(
      `Lv ${p.lv}\nHP ${p.hp}/${p.maxHp}\nATK ${p.atk}\nEXP ${p.exp}/${p.next}\nG ${p.gold}\n草 ${p.herbs}\n特性:${traitNames}\n王命:${this.hasOrder ? 'あり' : 'なし'}`
    );
  }

  setMessage(t) { this.msgText.setText(t); }

  onKey(e) {
    if (this.mode === 'field') this.handleFieldKey(e);
    else if (this.mode === 'battle') this.handleBattleKey(e);
  }

  handleFieldKey(e) {
    let dx = 0, dy = 0;
    const k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') dy = -1;
    else if (k === 'ArrowDown' || k === 's' || k === 'S') dy = 1;
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') dx = -1;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') dx = 1;
    else return;
    this.tryMove(dx, dy);
  }

  passable(ch) { return ['.', 'T', 'C', 'V', 'D', 'S'].includes(ch); }

  tryMove(dx, dy) {
    const nx = this.px + dx, ny = this.py + dy;
    if (ny < 0 || nx < 0 || ny >= FIELD_MAP.length || nx >= FIELD_MAP[0].length) return;
    const ch = FIELD_MAP[ny][nx];
    if (!this.passable(ch)) { beep(120, 60); return; }
    this.px = nx; this.py = ny;
    this.drawPlayer();
    beep(660, 30);
    this.onEnterTile(ch);
    this.refreshStatus();
  }

  onEnterTile(ch) {
    if (ch === 'C') {
      this.hasOrder = true;
      this.setMessage('王「勇者よ！北東の洞窟(D)に魔物がおる。倒して参れ！」→ 王の命を受けた！');
      beep(880, 120);
      this.refreshStatus();
      return;
    }
    if (ch === 'V') {
      this.player.hp = this.player.maxHp;
      this.setMessage('村に着いた。HPが全回復した！（やくそう+1）');
      this.player.herbs += 1;
      beep(520, 100);
      this.refreshStatus();
      return;
    }
    if (ch === 'D') {
      if (!this.hasOrder) {
        this.setMessage('試練の洞窟…。まだ王様(C)に会っていない。（先にCへ）');
        return;
      }
      if (!this.cleared) {
        this.cleared = true;
        this.setMessage('★ 試作クリア！洞窟にたどり着いた！（この先はダンジョン化予定）');
        beep(880, 200);
      }
      return;
    }
    // エンカウント
    const rate = ch === 'T' ? 0.16 : 0.08;
    if (Math.random() < rate) this.startBattle();
  }

  startBattle() {
    const base = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
    const lvBonus = Math.floor(this.player.lv / 2);
    this.enemy = {
      name: base.name, maxHp: base.hp + lvBonus * 3, hp: base.hp + lvBonus * 3,
      atk: base.atk + lvBonus, exp: base.exp + lvBonus * 2, gold: base.gold + lvBonus * 2,
    };
    this.mode = 'battle';
    this.cmdIndex = 0;
    beep(200, 150);
    this.setMessage(`${this.enemy.name} があらわれた！`);
    this.drawBattle();
  }

  drawBattle() {
    const g = this.battleGfx;
    g.clear();
    if (this.mode !== 'battle') { this.battleText.setText(''); this.cmdText.setText(''); return; }
    g.fillStyle(0x111144, 0.92); g.fillRect(40, 40, 560, 220);
    g.lineStyle(2, 0xffffff, 1); g.strokeRect(40, 40, 560, 220);
    this.battleText.setText(`${this.enemy.name}\nHP ${Math.max(0, this.enemy.hp)}/${this.enemy.maxHp}`);
    this.drawCmd();
  }

  drawCmd() {
    const lines = this.cmds.map((c, i) => `${i === this.cmdIndex ? '▶' : '　'}${c}`);
    this.cmdText.setText(lines.join('\n'));
  }

  handleBattleKey(e) {
    const k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { this.cmdIndex = (this.cmdIndex + 3) % 4; this.drawCmd(); beep(500, 30); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { this.cmdIndex = (this.cmdIndex + 1) % 4; this.drawCmd(); beep(500, 30); }
    else if (k === 'Enter' || k === ' ' || k === 'z' || k === 'Z') this.execCommand();
  }

  playerAttack() {
    const p = this.player;
    let hits = 1;
    if (Math.random() < p.doubleChance) hits = 2;
    let total = 0;
    let crit = false;
    for (let i = 0; i < hits; i++) {
      const isCrit = Math.random() < p.critChance;
      if (isCrit) crit = true;
      let dmg = p.atk + Math.floor(Math.random() * 5) - 2;
      if (isCrit) dmg = Math.floor(dmg * 1.8);
      dmg = Math.max(1, dmg);
      total += dmg;
      this.enemy.hp -= dmg;
      if (p.lifesteal > 0) p.hp = Math.min(p.maxHp, p.hp + Math.floor(dmg * p.lifesteal));
    }
    return { total, hits, crit };
  }

  execCommand() {
    const cmd = this.cmds[this.cmdIndex];
    const p = this.player;
    if (cmd === 'たたかう') {
      if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen);
      const r = this.playerAttack();
      beep(r.crit ? 900 : 600, 60);
      if (this.enemy.hp <= 0) return this.winBattle(`${r.hits > 1 ? '2回攻撃！' : ''}${r.crit ? 'かいしん！' : ''}${r.total}ダメージ！ ${this.enemy.name}を倒した！`);
      this.setMessage(`勇者の攻撃！ ${r.total}ダメージ！${r.crit ? '（会心）' : ''}`);
      this.enemyTurn();
    } else if (cmd === 'とくせい') {
      const list = Object.entries(p.traits).map(([k, v]) => `${k}x${v}`).join(', ') || 'なし（LvUPで獲得）';
      this.setMessage(`特性：${list} ※パッシブ発動中。ターンは進まない`);
    } else if (cmd === 'どうぐ') {
      if (p.herbs <= 0) { this.setMessage('やくそうがない！'); return; }
      p.herbs -= 1;
      p.hp = Math.min(p.maxHp, p.hp + 15);
      beep(700, 80);
      this.setMessage(`やくそうを使った！ HP+15（残り${p.herbs}）`);
      this.enemyTurn();
    } else if (cmd === 'にげる') {
      if (Math.random() < 0.55) {
        this.setMessage('うまくにげきれた！');
        this.endBattle();
      } else {
        this.setMessage('にげきれなかった！');
        this.enemyTurn();
      }
    }
    this.drawBattle();
    this.refreshStatus();
  }

  enemyTurn() {
    const p = this.player;
    const e = this.enemy;
    if (e.hp <= 0) return;
    let dmg = Math.max(1, e.atk + Math.floor(Math.random() * 4) - 2 - p.armor);
    p.hp -= dmg;
    beep(180, 90);
    if (p.hp <= 0) {
      p.hp = 0;
      this.setMessage(`敵の攻撃！ ${dmg}ダメージ！ 勇者は倒れた…（Rでリスタート）`);
      this.mode = 'talk';
      this.input.keyboard.once('keydown-R', () => location.reload());
      this.drawBattle();
      this.refreshStatus();
      return;
    }
    this.setMessage(`${this.msgText.text} ／ 敵の攻撃！ ${dmg}ダメージ！（HP${p.hp}）`);
  }

  winBattle(prefix) {
    const p = this.player;
    const exp = Math.floor(this.enemy.exp * (1 + p.expBonus));
    p.exp += exp;
    p.gold += this.enemy.gold;
    beep(880, 120);
    this.setMessage(`${prefix} EXP+${exp} G+${this.enemy.gold}`);
    this.endBattle();
    this.checkLevelUp();
    this.refreshStatus();
  }

  endBattle() {
    this.mode = 'field';
    this.enemy = null;
    this.battleGfx.clear();
    this.battleText.setText('');
    this.cmdText.setText('');
  }

  checkLevelUp() {
    const p = this.player;
    while (p.exp >= p.next) {
      p.exp -= p.next;
      p.lv += 1;
      p.next = expForLevel(p.lv);
      p.maxHp += 6; p.atk += 2; p.hp = p.maxHp;
      this.pendingTraits += 1;
    }
    if (this.pendingTraits > 0) this.openTraitModal();
  }

  openTraitModal() {
    this.mode = 'trait';
    const choices = rollTraitChoices(this.player.traits);
    const modal = document.getElementById('trait-modal');
    const box = document.getElementById('trait-choices');
    document.getElementById('trait-lv').textContent = `Lv${this.player.lv} UP！ 特性を1つ選べ（残り${this.pendingTraits}回）`;
    box.innerHTML = '';
    choices.forEach((t) => {
      const b = document.createElement('button');
      b.className = 'trait-card';
      const stack = this.player.traits[t.id] || 0;
      b.innerHTML = `<b>${t.name}</b><small>${t.desc}${stack > 0 ? `（所持x${stack}）` : ''}</small>`;
      b.onclick = () => {
        const got = applyTrait(this.player, t.id);
        beep(760, 100);
        this.pendingTraits -= 1;
        this.setMessage(`「${got.name}」を覚えた！ ${got.desc}`);
        this.refreshStatus();
        if (this.pendingTraits > 0) this.openTraitModal();
        else {
          modal.classList.add('hidden');
          this.mode = 'field';
        }
      };
      box.appendChild(b);
    });
    modal.classList.remove('hidden');
  }

  update(time, delta) {
    // 押しっぱなし移動用
    if (this.mode !== 'field') return;
    this.moveCd -= delta;
    if (this.moveCd > 0) return;
    const keys = this.input.keyboard.createCursorKeys ? this.cursors : null;
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

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  backgroundColor: '#222',
  physics: { default: 'arcade' },
  scene: MainScene,
});
