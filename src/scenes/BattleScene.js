import Phaser from 'phaser';
import { makeEnemy, makeBoss } from '../data/enemies';
import { expForLevel, rollTraitChoices, applyTrait, traitLabel, LEVEL_CAP } from '../data/traits';
import { gameState, respawn } from '../game/state';
import { preloadEnemyArt, drawEnemyArt } from '../game/enemyArt';
import { toggleStatus, isStatusOpen } from '../game/statusUi';
import { startBgm, stopBgm, beep, jingle } from '../game/sound';

// DQ1風：戦闘はフィールドと完全分離した別画面
// メッセージはキュー制（Z送り／自動送り）で「間」を作る
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
    this.dead = false;
    this.returnTo = data.from || 'field';
    this.focusCount = 0;
    this.msgQueue = [];
    this.msgBusy = false;
    this.msgTimer = null;
    gameState.player.prayed = false;
    this.enemy = data.boss
      ? makeBoss(gameState.player.lv)
      : makeEnemy(gameState.player.lv + (data.lvBonus || 0), data.tile || '.', data.danger || 1, data.pool || null);

    this.cameras.main.fadeIn(200, 0, 0, 0);
    this.drawScreen();
    startBgm('battle');
    this.events.once('shutdown', stopBgm);
    if (this.enemy.boss) {
      this.cameras.main.shake(250, 0.008);
      jingle('boss');
    }
    this.say(`${this.enemy.name} があらわれた！`);

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

  // ---- メッセージキュー ----
  say(text, cb, color) {
    this.msgQueue.push({ text, cb, color });
    if (!this.msgBusy) this.nextMsg();
  }

  nextMsg() {
    const m = this.msgQueue[0];
    if (!m) { this.msgBusy = false; return; }
    this.msgBusy = true;
    this.msgText.setText(m.text + ' ▼');
    this.msgText.setColor(m.color || '#fff');
    if (this.msgTimer) clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => this.doneMsg(), 1100);
  }

  doneMsg() {
    if (this.msgTimer) { clearTimeout(this.msgTimer); this.msgTimer = null; }
    const m = this.msgQueue.shift();
    this.msgBusy = false;
    if (m && m.cb) { const cb = m.cb; cb(); return; }
    if (this.msgQueue.length) this.nextMsg();
  }

  advanceMsg() {
    if (this.msgBusy) this.doneMsg();
  }

  handleKey(e) {
    if (e.repeat) return;
    const k = e.key;
    if (this.dead) {
      if (k === 'r' || k === 'R') location.reload();
      return;
    }
    if (k === 't' || k === 'T') {
      if (!this.over && !this.msgBusy) toggleStatus();
      return;
    }
    if (isStatusOpen() || this.over) return;
    if (this.msgBusy) {
      if (['z', 'Z', ' ', 'Enter'].includes(k)) this.advanceMsg();
      return;
    }
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
      if (this.enemy.poisonTurns > 0) {
        this.enemy.hp -= 4;
        this.enemy.poisonTurns -= 1;
        if (this.enemy.hp <= 0) {
          jingle('poison');
          return this.winBattle('毒が効いた！ 4ダメージ！', `${this.enemy.name}を倒した！`);
        }
      }
      if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen);
      const r = this.playerAttack();
      if (r.crit) jingle('crit'); else beep(600, 60);
      const tag = `${r.hits > 1 ? r.hits + '回攻撃！' : ''}${r.focusCrit ? '必殺の一撃！' : r.crit ? 'かいしん！' : ''}${r.poisoned ? '毒を浴びせた！' : ''}`;
      if (this.enemy.hp <= 0) {
        return this.winBattle(`勇者の攻撃！ ${tag}${r.total}ダメージ！`, `${this.enemy.name}を倒した！`, r.crit);
      }
      this.say(`勇者の攻撃！ ${tag}${r.total}ダメージ！`, () => this.enemyTurn(), r.crit ? '#ff0' : undefined);
    } else if (cmd === 'とくせい') {
      const list = Object.entries(p.traits).map(([id, v]) => `${traitLabel(id)}x${v}`).join('、') || 'なし（LvUPで獲得）';
      this.say(`特性：${list}`);
    } else if (cmd === 'どうぐ') {
      if (p.herbs <= 0) { this.say('やくそうがない！'); return; }
      p.herbs -= 1;
      const heal = 15 + p.potionPower;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      beep(700, 80);
      this.say(`やくそうを使った！ HP+${heal}（残り${p.herbs}）`, () => this.enemyTurn());
    } else if (cmd === 'にげる') {
      if (this.enemy.boss) {
        this.say('まおうのてさきからは にげられない！', () => this.enemyTurn());
      } else if (Math.random() < Math.min(0.95, 0.55 + 0.15 * p.quick)) {
        jingle('escape');
        this.say('うまくにげきれた！', () => this.backToOrigin());
      } else {
        this.say('にげきれなかった！', () => this.enemyTurn());
      }
    }
    this.refresh();
  }

  enemyTurn() {
    const p = gameState.player;
    const e = this.enemy;
    if (e.hp <= 0) return;
    if (Math.random() < p.evadeChance) {
      this.say('しかし 勇者はかわした！');
      this.refresh();
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
        jingle('pray');
        this.say(`敵の攻撃！ ${dmg}ダメージ！ しかし いのりが通じた！ HP1で耐えた！`);
        this.refresh();
        return;
      }
      p.hp = 0;
      this.refresh();
      return this.onDeath(dmg);
    }
    let msg = `敵の攻撃！ ${dmg}ダメージ！（HP${p.hp}）`;
    if (Math.random() < p.counterChance) {
      const cd = Math.max(1, Math.floor(p.atk / 2));
      e.hp -= cd;
      msg += ` はんげき！ ${cd}ダメージ！`;
      if (e.hp <= 0) return this.winBattle(msg, `${e.name}を倒した！`);
    }
    this.say(msg);
    this.refresh();
  }

  onDeath(dmg) {
    this.over = true;
    stopBgm();
    this.say(`敵の攻撃！ ${dmg}ダメージ！ 勇者は倒れた…`, () => {
      respawn(1, 5);
      const cam = this.cameras.main;
      cam.fadeOut(300, 0, 0, 0);
      cam.once('camerafadeoutcomplete', () => {
        this.scene.start('field');
      });
    });
  }

  winBattle(line1, line2, highlight) {
    const p = gameState.player;
    const isBoss = !!this.enemy.boss;
    const exp = Math.floor(this.enemy.exp * (1 + p.expBonus));
    const gold = Math.floor(this.enemy.gold * (1 + p.goldBonus));
    p.exp += exp;
    p.gold += gold;
    jingle('victory');
    this.refresh();
    let ups = 0;
    let gainHp = 0;
    let gainAtk = 0;
    while (p.exp >= p.next && p.lv < LEVEL_CAP) {
      p.exp -= p.next;
      p.lv += 1;
      p.next = expForLevel(p.lv);
      const h = 6 + p.growthHp;
      p.maxHp += h;
      p.atk += 2;
      gainHp += h;
      gainAtk += 2;
      ups += 1;
    }
    // LvUP時は半分回復（宿屋の価値を残す）
    if (ups > 0) p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp / 2));
    const reward = `${line1} ${line2} EXP+${exp} G+${gold}`;
    if (isBoss) {
      gameState.bossDefeated = true;
      gameState.cleared = true;
      this.over = true;
      stopBgm();
      this.say(reward, () => {
        this.say(DIALOGUES_CLEAR, () => this.backToOrigin());
      }, '#ff0');
      this.refresh();
      return;
    }
    if (ups > 0) {
      this.say(reward, () => this.openTraitModal(ups, p.lv, gainHp, gainAtk), highlight ? '#ff0' : undefined);
    } else {
      this.say(reward, () => this.backToOrigin(), highlight ? '#ff0' : undefined);
    }
    this.refresh();
  }

  backToOrigin() {
    this.over = true;
    stopBgm();
    gameState.encounterGraceUntil = Date.now() + 1500;
    const cam = this.cameras.main;
    cam.fadeOut(200, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.scene.start(this.returnTo);
    });
  }

  openTraitModal(left, lv, gainHp, gainAtk) {
    this.over = true;
    stopBgm();
    jingle('levelup');
    this.cameras.main.flash(180, 255, 255, 255);
    const choices = rollTraitChoices(gameState.player.traits);
    const modal = document.getElementById('trait-modal');
    const box = document.getElementById('trait-choices');
    document.getElementById('trait-lv').textContent =
      `Lv${lv} UP！ HP+${gainHp} ATK+${gainAtk}！ 特性を1つ選べ（残り${left}回）`;
    box.innerHTML = '';
    choices.forEach((t) => {
      const b = document.createElement('button');
      b.className = 'trait-card';
      const stack = gameState.player.traits[t.id] || 0;
      b.innerHTML = `<b>${t.name}</b><small>${t.desc}${stack > 0 ? `（所持x${stack}）` : ''}</small>`;
      b.onclick = () => {
        const got = applyTrait(gameState.player, t.id);
        beep(760, 100);
        this.setDirectMessage(`「${got.name}」を覚えた！ ${got.desc}`);
        this.refresh();
        if (left - 1 > 0) this.openTraitModal(left - 1, lv, 0, 0);
        else {
          modal.classList.add('hidden');
          startBgm('battle');
          this.backToOrigin();
        }
      };
      box.appendChild(b);
    });
    modal.classList.remove('hidden');
  }

  setDirectMessage(t) {
    if (this.msgTimer) { clearTimeout(this.msgTimer); this.msgTimer = null; }
    this.msgQueue = [];
    this.msgBusy = false;
    this.msgText.setText(t);
    this.msgText.setColor('#fff');
  }
}

const DIALOGUES_CLEAR = 'まおうのてさきを倒した！ 世界に平和が戻った！（プロトタイプクリア）';
