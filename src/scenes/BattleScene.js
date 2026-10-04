import Phaser from 'phaser';
import { makeEnemy, makeBoss } from '../data/enemies';
import { expForLevel, rollTraitChoices, applyTrait, LEVEL_CAP } from '../data/traits';
import { gameState } from '../game/state';
import { preloadEnemyArt, drawEnemyArt } from '../game/enemyArt';
import { beep } from './FieldScene';

// DQ1風：戦闘はフィールドと完全分離した別画面
export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('battle');
    this.cmds = ['たたかう', 'とくせい', 'どうぐ', 'にげる'];
  }

  preload() {
    preloadEnemyArt(this);
  }

  create(data) {
    this.cmdIndex = 0;
    this.over = false;
    this.returnTo = data.from || 'field';
    this.focusCount = 0;
    gameState.player.prayed = false;
    this.enemy = data.boss
      ? makeBoss(gameState.player.lv)
      : makeEnemy(gameState.player.lv + (data.lvBonus || 0), data.tile || '.');

    this.cameras.main.fadeIn(200, 0, 0, 0);
    this.drawScreen();
    this.setMessage(`${this.enemy.name} があらわれた！`);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown', (e) => this.handleKey(e));
  }

  drawScreen() {
    const g = this.add.graphics();
    g.fillStyle(0x101040, 1); g.fillRect(0, 0, 800, 330);
    g.fillStyle(0x082008, 1); g.fillRect(0, 330, 800, 60);
    g.lineStyle(2, 0xffffff, 1); g.strokeRect(230, 40, 340, 250);
    drawEnemyArt(this, this.enemy, 400, 165);
    this.enemyText = this.add.text(240, 50, '', { fontSize: '16px', color: '#ff0', fontFamily: 'monospace' });
    this.statusText = this.add.text(12, 8, '', { fontSize: '14px', color: '#fff', fontFamily: 'monospace' });
    g.fillStyle(0x000000, 1); g.fillRect(0, 390, 800, 210);
    g.lineStyle(2, 0xffffff, 1); g.strokeRect(0, 390, 800, 210);
    this.msgText = this.add.text(16, 404, '', { fontSize: '17px', color: '#fff', fontFamily: 'monospace', wordWrap: { width: 500 } });
    g.fillStyle(0x000000, 1); g.fillRect(560, 390, 240, 210);
    g.lineStyle(2, 0xffffff, 1); g.strokeRect(560, 390, 240, 210);
    this.cmdText = this.add.text(580, 410, '', { fontSize: '20px', color: '#fff', fontFamily: 'monospace', lineSpacing: 10 });
    this.refresh();
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

  randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

  playerAttack() {
    const p = gameState.player;
    let hits = 1;
    if (Math.random() < p.doubleChance) hits = 2;
    if (p.gambler > 0 && Math.random() < 0.08 * p.gambler) hits += 1;
    this.focusCount += 1;
    const focusCrit = p.focus && this.focusCount % 3 === 0;
    let total = 0;
    let crit = focusCrit;
    let poisoned = false;
    for (let i = 0; i < hits; i++) {
      const isCrit = focusCrit || Math.random() < p.critChance;
      if (isCrit) crit = true;
      const vmax = 2 + 4 * p.gambler;
      let dmg = Math.floor(p.atk * (1 + p.berserkAtk)) + this.randInt(-2, vmax);
      if (isCrit) dmg = Math.floor(dmg * 1.8);
      dmg = Math.max(1, dmg);
      total += dmg;
      this.enemy.hp -= dmg;
      if (p.lifesteal > 0) p.hp = Math.min(p.maxHp, p.hp + Math.floor(dmg * p.lifesteal));
      if (!poisoned && p.poisonChance > 0 && Math.random() < p.poisonChance && this.enemy.hp > 0) {
        this.enemy.poisonTurns = 3;
        poisoned = true;
      }
    }
    if (p.burnDmg > 0 && this.enemy.hp > 0) {
      total += p.burnDmg;
      this.enemy.hp -= p.burnDmg;
    }
    return { total, hits, crit, poisoned, focusCrit };
  }

  execCommand() {
    const cmd = this.cmds[this.cmdIndex];
    const p = gameState.player;
    if (cmd === 'たたかう') {
      // 毒ダメージ（敵ターン開始時扱い）
      if (this.enemy.poisonTurns > 0) {
        this.enemy.hp -= 4;
        this.enemy.poisonTurns -= 1;
        if (this.enemy.hp <= 0) return this.winBattle('毒が効いた！ 4ダメージ！ ' + `${this.enemy.name}を倒した！`);
      }
      if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen);
      const r = this.playerAttack();
      beep(r.crit ? 900 : 600, 60);
      const tag = `${r.hits > 1 ? r.hits + '回攻撃！' : ''}${r.focusCrit ? '必殺の一撃！' : r.crit ? 'かいしん！' : ''}${r.poisoned ? '毒を浴びせた！' : ''}`;
      if (this.enemy.hp <= 0) return this.winBattle(`${tag}${r.total}ダメージ！ ${this.enemy.name}を倒した！`);
      this.setMessage(`勇者の攻撃！ ${tag}${r.total}ダメージ！`);
      this.enemyTurn();
    } else if (cmd === 'とくせい') {
      const list = Object.entries(p.traits).map(([k, v]) => `${k}x${v}`).join(', ') || 'なし（LvUPで獲得）';
      this.setMessage(`特性：${list} ※パッシブ発動中。ターンは進まない`);
    } else if (cmd === 'どうぐ') {
      if (p.herbs <= 0) { this.setMessage('やくそうがない！'); return; }
      p.herbs -= 1;
      p.hp = Math.min(p.maxHp, p.hp + 15 + p.potionPower);
      beep(700, 80);
      this.setMessage(`やくそうを使った！ HP+${15 + p.potionPower}（残り${p.herbs}）`);
      this.enemyTurn();
    } else if (cmd === 'にげる') {
      if (this.enemy.boss) {
        this.setMessage('まおうのてさきからは にげられない！');
        this.enemyTurn();
      } else if (Math.random() < Math.min(0.95, 0.55 + 0.15 * p.quick)) {
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
    if (Math.random() < p.evadeChance) {
      this.setMessage(`${this.msgText.text} ／ しかし 勇者はかわした！`);
      return;
    }
    let dmg = e.atk + this.randInt(-2, 2) - p.armor;
    dmg = Math.max(1, Math.floor(dmg * (1 + p.berserkTaken)));
    p.hp -= dmg;
    beep(180, 90);
    if (p.hp <= 0) {
      if (p.prayer && !p.prayed) {
        p.prayed = true;
        p.hp = 1;
        this.setMessage(`敵の攻撃！ ${dmg}ダメージ！ しかし いのりが通じた！ HP1で耐えた！`);
        this.refresh();
        return;
      }
      p.hp = 0;
      this.over = true;
      this.setMessage(`敵の攻撃！ ${dmg}ダメージ！ 勇者は倒れた…（Rでリスタート）`);
      this.input.keyboard.once('keydown-R', () => location.reload());
      this.refresh();
      return;
    }
    let msg = `${this.msgText.text} ／ 敵の攻撃！ ${dmg}ダメージ！（HP${p.hp}）`;
    // 反撃
    if (Math.random() < p.counterChance) {
      const cd = Math.max(1, Math.floor(p.atk / 2));
      e.hp -= cd;
      msg += ` はんげき！ ${cd}ダメージ！`;
      if (e.hp <= 0) return this.winBattle(`${msg} ${e.name}を倒した！`);
    }
    this.setMessage(msg);
  }

  winBattle(prefix) {
    const p = gameState.player;
    const isBoss = !!this.enemy.boss;
    const exp = Math.floor(this.enemy.exp * (1 + p.expBonus));
    const gold = Math.floor(this.enemy.gold * (1 + p.goldBonus));
    p.exp += exp;
    p.gold += gold;
    beep(880, 120);
    this.setMessage(`${prefix} EXP+${exp} G+${gold}`);
    this.refresh();
    let ups = 0;
    while (p.exp >= p.next && p.lv < LEVEL_CAP) {
      p.exp -= p.next;
      p.lv += 1;
      p.next = expForLevel(p.lv);
      p.maxHp += 6 + p.growthHp;
      p.atk += 2;
      p.hp = p.maxHp;
      ups += 1;
    }
    if (isBoss) {
      gameState.bossDefeated = true;
      gameState.cleared = true;
      this.over = true;
      this.setMessage(`${this.msgText.text} まおうのてさきを倒した！ 世界に平和が戻った！（プロトタイプクリア）`);
      this.refresh();
      return;
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
