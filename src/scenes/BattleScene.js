import Phaser from 'phaser';
import { makeEnemy } from '../data/enemies';
import { expForLevel, rollTraitChoices, applyTrait } from '../data/traits';
import { gameState } from '../game/state';
import { beep } from './FieldScene';

// DQ1風：戦闘はフィールドと完全分離した別画面
export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('battle');
    this.cmds = ['たたかう', 'とくせい', 'どうぐ', 'にげる'];
  }

  create(data) {
    this.cmdIndex = 0;
    this.over = false;
    this.returnTo = data.from || 'field';
    this.enemy = makeEnemy(gameState.player.lv + (data.lvBonus || 0), data.tile || '.');

    this.cameras.main.fadeIn(200, 0, 0, 0);
    this.drawScreen();
    this.setMessage(`${this.enemy.name} があらわれた！`);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown', (e) => this.handleKey(e));
  }

  drawScreen() {
    // 背景（上下ツートン＝DQ1風）
    const g = this.add.graphics();
    g.fillStyle(0x101040, 1); g.fillRect(0, 0, 800, 330);
    g.fillStyle(0x082008, 1); g.fillRect(0, 330, 800, 60);
    // 敵エリア枠
    g.lineStyle(2, 0xffffff, 1); g.strokeRect(230, 40, 340, 250);
    this.drawEnemy(400, 165);
    this.enemyText = this.add.text(240, 50, '', { fontSize: '16px', color: '#ff0', fontFamily: 'monospace' });
    // ステータス行
    this.statusText = this.add.text(12, 8, '', { fontSize: '14px', color: '#fff', fontFamily: 'monospace' });
    // メッセージ窓
    g.fillStyle(0x000000, 1); g.fillRect(0, 390, 800, 210);
    g.lineStyle(2, 0xffffff, 1); g.strokeRect(0, 390, 800, 210);
    this.msgText = this.add.text(16, 404, '', { fontSize: '17px', color: '#fff', fontFamily: 'monospace', wordWrap: { width: 500 } });
    // コマンド窓
    g.fillStyle(0x000000, 1); g.fillRect(560, 390, 240, 210);
    g.lineStyle(2, 0xffffff, 1); g.strokeRect(560, 390, 240, 210);
    this.cmdText = this.add.text(580, 410, '', { fontSize: '20px', color: '#fff', fontFamily: 'monospace', lineSpacing: 10 });
    this.refresh();
  }

  drawEnemy(cx, cy) {
    const g = this.add.graphics();
    const c = this.enemy.color;
    if (this.enemy.id === 'slime') {
      g.fillStyle(c, 1); g.fillEllipse(cx, cy + 20, 130, 100);
      g.fillStyle(0xffffff, 1); g.fillCircle(cx - 25, cy + 10, 12); g.fillCircle(cx + 25, cy + 10, 12);
      g.fillStyle(0x000000, 1); g.fillCircle(cx - 25, cy + 12, 5); g.fillCircle(cx + 25, cy + 12, 5);
    } else if (this.enemy.id === 'bat') {
      g.fillStyle(c, 1);
      g.fillTriangle(cx - 90, cy - 30, cx - 20, cy - 30, cx - 45, cy + 25);
      g.fillTriangle(cx + 90, cy - 30, cx + 20, cy - 30, cx + 45, cy + 25);
      g.fillCircle(cx, cy, 28);
      g.fillStyle(0xff0000, 1); g.fillCircle(cx - 10, cy - 5, 5); g.fillCircle(cx + 10, cy - 5, 5);
    } else if (this.enemy.id === 'goblin') {
      g.fillStyle(c, 1);
      g.fillTriangle(cx - 30, cy - 20, cx - 60, cy - 55, cx - 15, cy - 45);
      g.fillTriangle(cx + 30, cy - 20, cx + 60, cy - 55, cx + 15, cy - 45);
      g.fillCircle(cx, cy, 42);
      g.fillStyle(0xffffff, 1); g.fillCircle(cx - 14, cy - 8, 9); g.fillCircle(cx + 14, cy - 8, 9);
      g.fillStyle(0x000000, 1); g.fillCircle(cx - 14, cy - 6, 4); g.fillCircle(cx + 14, cy - 6, 4);
    } else if (this.enemy.id === 'ghost') {
      g.fillStyle(c, 0.9); g.fillCircle(cx, cy - 10, 45);
      g.fillTriangle(cx - 45, cy - 10, cx + 45, cy - 10, cx, cy + 70);
      g.fillStyle(0x000000, 1); g.fillCircle(cx - 15, cy - 15, 7); g.fillCircle(cx + 15, cy - 15, 7);
    } else {
      g.fillStyle(c, 1);
      g.fillRect(cx - 45, cy - 40, 90, 60);
      g.fillRect(cx - 35, cy + 20, 70, 55);
      g.fillStyle(0xff0000, 1); g.fillCircle(cx - 15, cy - 10, 6); g.fillCircle(cx + 15, cy - 10, 6);
    }
  }

  refresh() {
    const p = gameState.player;
    this.statusText.setText(`Lv${p.lv} HP ${p.hp}/${p.maxHp} ATK${p.atk} G${p.gold} 草${p.herbs}`);
    this.enemyText.setText(`${this.enemy.name}\nHP ${Math.max(0, this.enemy.hp)}/${this.enemy.maxHp}`);
    const lines = this.cmds.map((c, i) => `${i === this.cmdIndex ? '▶' : '　'}${c}`);
    this.cmdText.setText(lines.join('\n'));
  }

  setMessage(t) { this.msgText.setText(t); }

  handleKey(e) {
    if (this.over) return;
    const k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { this.cmdIndex = (this.cmdIndex + 3) % 4; this.refresh(); beep(500, 30); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { this.cmdIndex = (this.cmdIndex + 1) % 4; this.refresh(); beep(500, 30); }
    else if (k === 'Enter' || k === ' ' || k === 'z' || k === 'Z') this.execCommand();
  }

  playerAttack() {
    const p = gameState.player;
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
    const p = gameState.player;
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
        this.backToOrigin();
      } else {
        this.setMessage('にげきれなかった！');
        this.enemyTurn();
      }
    }
    this.refresh();
  }

  enemyTurn() {
    const p = gameState.player;
    const e = this.enemy;
    if (e.hp <= 0) return;
    const dmg = Math.max(1, e.atk + Math.floor(Math.random() * 4) - 2 - p.armor);
    p.hp -= dmg;
    beep(180, 90);
    if (p.hp <= 0) {
      p.hp = 0;
      this.over = true;
      this.setMessage(`敵の攻撃！ ${dmg}ダメージ！ 勇者は倒れた…（Rでリスタート）`);
      this.input.keyboard.once('keydown-R', () => location.reload());
      this.refresh();
      return;
    }
    this.setMessage(`${this.msgText.text} ／ 敵の攻撃！ ${dmg}ダメージ！（HP${p.hp}）`);
  }

  winBattle(prefix) {
    const p = gameState.player;
    const exp = Math.floor(this.enemy.exp * (1 + p.expBonus));
    p.exp += exp;
    p.gold += this.enemy.gold;
    beep(880, 120);
    this.setMessage(`${prefix} EXP+${exp} G+${this.enemy.gold}`);
    this.refresh();
    let ups = 0;
    while (p.exp >= p.next) {
      p.exp -= p.next;
      p.lv += 1;
      p.next = expForLevel(p.lv);
      p.maxHp += 6; p.atk += 2; p.hp = p.maxHp;
      ups += 1;
    }
    if (ups > 0) this.openTraitModal(ups);
    else this.backToOrigin();
  }

  backToOrigin() {
    this.over = true;
    gameState.encounterGraceUntil = Date.now() + 1500;
    const cam = this.cameras.main;
    cam.fadeOut(200, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start(this.returnTo);
    });
  }

  openTraitModal(left) {
    this.over = true;
    const choices = rollTraitChoices(gameState.player.traits);
    const modal = document.getElementById('trait-modal');
    const box = document.getElementById('trait-choices');
    document.getElementById('trait-lv').textContent = `Lv${gameState.player.lv} UP！ 特性を1つ選べ（残り${left}回）`;
    box.innerHTML = '';
    choices.forEach((t) => {
      const b = document.createElement('button');
      b.className = 'trait-card';
      const stack = gameState.player.traits[t.id] || 0;
      b.innerHTML = `<b>${t.name}</b><small>${t.desc}${stack > 0 ? `（所持x${stack}）` : ''}</small>`;
      b.onclick = () => {
        const got = applyTrait(gameState.player, t.id);
        beep(760, 100);
        this.setMessage(`「${got.name}」を覚えた！ ${got.desc}`);
        this.refresh();
        if (left - 1 > 0) this.openTraitModal(left - 1);
        else {
          modal.classList.add('hidden');
          this.backToOrigin();
        }
      };
      box.appendChild(b);
    });
    modal.classList.remove('hidden');
  }
}
