// 4人 vs 敵群の戦闘解決（DOM非依存・純ロジック）
const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

export function initBattle({ party, foes, opts = {}, items = {} }) {
  return {
    party: party.map((p) => ({ ...p, guard: false, down: p.hp <= 0 })),
    foes: foes.map((f) => ({ ...f })),
    items: { herb: 0, revive: 0, ...items },
    round: 1,
    status: null, // null | 'win' | 'lose'
    coverId: null,
    tauntId: null,
    ambush: !!opts.ambush,
    weakpoint: !!opts.weakpoint,
    log: [],
    fx: [],
  };
}

export const aliveParty = (b) => b.party.filter((p) => p.hp > 0);
export const aliveFoes = (b) => b.foes.filter((f) => f.hp > 0);

export function actorOf(b, id) {
  return b.party.find((p) => p.id === id) || null;
}

function damageTo(target, raw, mult = 1) {
  let dmg = Math.floor(raw * mult);
  if (target.hardBody) dmg = Math.min(dmg, 2);
  return Math.max(1, dmg);
}

function hitFoe(b, foe, dmg, label) {
  foe.hp = Math.max(0, foe.hp - dmg);
  b.log.push(`${label} ${foe.name}に ${dmg} ダメージ`);
  b.fx.push({ side: 'foe', id: foe.id, dmg, kind: 'dmg' });
  if (foe.hp <= 0) b.log.push(`${foe.name}を倒した！`);
}

function hitParty(b, member, dmg, label) {
  member.hp = Math.max(0, member.hp - dmg);
  b.log.push(`${label} ${member.name}に ${dmg} ダメージ`);
  b.fx.push({ side: 'party', id: member.id, dmg, kind: 'dmg' });
  if (member.hp <= 0) b.log.push(`${member.name}は倒れた…`);
}

const lowestAlly = (b) => [...b.party]
  .filter((p) => p.hp > 0)
  .sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0] || null;

function useItem(b, actor, itemId) {
  if (itemId === 'herb') {
    if ((b.items.herb || 0) <= 0) { b.log.push('やくそうがない'); return; }
    const t = lowestAlly(b);
    if (!t) return;
    b.items.herb -= 1;
    const amt = Math.min(t.maxHp - t.hp, 15);
    t.hp += amt;
    b.log.push(`${actor.name}はやくそうを使った ${t.name}のHPが ${amt} 回復`);
    b.fx.push({ side: 'party', id: t.id, dmg: amt, kind: 'heal' });
  } else if (itemId === 'revive') {
    if ((b.items.revive || 0) <= 0) { b.log.push('気付け薬がない'); return; }
    const downed = b.party.find((p) => p.hp <= 0);
    if (!downed) { b.log.push('倒れている味方がいない'); return; }
    b.items.revive -= 1;
    downed.hp = Math.max(1, Math.floor(downed.maxHp * 0.3));
    b.log.push(`${actor.name}は気付け薬を使った ${downed.name}が復活！`);
    b.fx.push({ side: 'party', id: downed.id, dmg: downed.hp, kind: 'heal' });
  }
}

// actions: [{ actorId, type: 'attack'|'skill'|'guard'|'item', targetId, skillId, itemId }]
export function resolveRound(b, actions) {
  const log = [];
  b.log = log;
  b.fx = [];
  if (b.status) return { log, status: b.status, fx: b.fx };

  b.coverId = null;
  b.tauntId = null;
  for (const p of b.party) p.guard = false;

  if (b.weakpoint) {
    for (const f of b.foes) {
      if (f.hp > 0) {
        const d = Math.max(1, Math.floor(f.maxHp * 0.25));
        f.hp = Math.max(1, f.hp - d);
      }
    }
    log.push('弱点を突いた！ 敵の体力が削れている');
    b.weakpoint = false;
  }

  // 構え系を先に処理
  for (const a of actions) {
    const p = actorOf(b, a.actorId);
    if (!p || p.hp <= 0) continue;
    if (a.type === 'guard') p.guard = true;
    if (a.type === 'skill' && a.skillId === 'cover') {
      b.coverId = p.id;
      log.push(`${p.name}は味方をかばう構え`);
    }
    if (a.type === 'skill' && a.skillId === 'taunt') {
      if (p.skillUses > 0) {
        p.skillUses -= 1;
        b.tauntId = p.id;
        log.push(`${p.name}は敵の注意を引きつけた`);
      }
    }
  }

  // 味方の行動
  for (const p of b.party) {
    if (p.hp <= 0) continue;
    const a = actions.find((x) => x.actorId === p.id);
    if (!a) continue;
    if (a.type === 'attack') {
      const foe = b.foes.find((f) => f.id === a.targetId && f.hp > 0) || aliveFoes(b)[0];
      if (!foe) break;
      const raw = p.atk + rnd(-1, 2) - foe.def;
      hitFoe(b, foe, damageTo(foe, raw), `${p.name}の攻撃！`);
    } else if (a.type === 'guard') {
      log.push(`${p.name}は身を守っている`);
    } else if (a.type === 'item') {
      useItem(b, p, a.itemId);
    } else if (a.type === 'skill') {
      const sid = a.skillId;
      if (sid === 'cover' || sid === 'taunt') {
        // 上で処理済み
      } else if (sid === 'power') {
        const foe = b.foes.find((f) => f.id === a.targetId && f.hp > 0) || aliveFoes(b)[0];
        if (foe && p.skillUses > 0) {
          p.skillUses -= 1;
          const raw = Math.round(p.atk * 1.8) + rnd(-1, 1) - foe.def;
          hitFoe(b, foe, damageTo(foe, raw), `${p.name}の強撃！`);
        }
      } else if (sid === 'heal') {
        if (p.skillUses > 0) {
          p.skillUses -= 1;
          const t = lowestAlly(b);
          if (t) {
            const amt = Math.min(t.maxHp - t.hp, 14);
            t.hp += amt;
            log.push(`${p.name}のいやし！ ${t.name}のHPが ${amt} 回復`);
            b.fx.push({ side: 'party', id: t.id, dmg: amt, kind: 'heal' });
          }
        }
      } else if (sid === 'weak') {
        const foe = b.foes.find((f) => f.id === a.targetId && f.hp > 0) || aliveFoes(b)[0];
        if (foe && p.skillUses > 0) {
          p.skillUses -= 1;
          hitFoe(b, foe, 10, `${p.name}の弱点狙い！`);
        }
      } else if (sid === 'double') {
        if (p.skillUses > 0) {
          p.skillUses -= 1;
          for (let i = 0; i < 2; i += 1) {
            const foe = aliveFoes(b).find((f) => f.id === a.targetId) || aliveFoes(b)[0];
            if (!foe) break;
            const raw = Math.round(p.atk * 0.8) + rnd(-1, 2) - foe.def;
            hitFoe(b, foe, damageTo(foe, raw), `${p.name}の連撃！`);
          }
        }
      }
    }
    if (aliveFoes(b).length === 0) break;
  }

  if (aliveFoes(b).length === 0) {
    b.status = 'win';
    return { log, status: b.status, fx: b.fx };
  }

  // 敵の行動
  if (b.ambush && b.round === 1) {
    log.push('待ち伏せ成功！ 敵は動けない');
  } else {
    const bossAoe = b.foes.some((f) => f.boss) && b.round % 3 === 0;
    for (const foe of b.foes) {
      if (foe.hp <= 0) continue;
      if (foe.shy && Math.random() < 0.25) {
        foe.hp = 0;
        log.push(`${foe.name}は逃げ出した`);
        continue;
      }
      if (bossAoe) {
        log.push(`${foe.name}の大技！`);
        for (const p of aliveParty(b)) {
          const raw = foe.atk * 0.8 + rnd(-1, 2) - p.def;
          const mult = p.guard ? 0.5 : 1;
          hitParty(b, p, damageTo(p, raw, mult), '');
        }
        continue;
      }
      let target;
      if (b.tauntId) target = actorOf(b, b.tauntId);
      if (!target || target.hp <= 0) target = aliveParty(b)[rnd(0, aliveParty(b).length - 1)];
      if (!target) break;
      let mult = 1;
      if (b.coverId && b.coverId !== target.id) {
        const cover = actorOf(b, b.coverId);
        if (cover && cover.hp > 0 && Math.random() < 0.85) {
          target = cover;
          mult = 0.6;
          log.push(`${cover.name}が攻撃を受け止めた！`);
        }
      }
      if (target.guard) mult *= 0.5;
      const raw = foe.atk + rnd(-1, 2) - target.def;
      hitParty(b, target, damageTo(target, raw, mult), `${foe.name}の攻撃！`);
    }
  }

  if (aliveParty(b).length === 0) {
    b.status = 'lose';
    return { log, status: b.status, fx: b.fx };
  }

  b.round += 1;
  for (const p of b.party) p.guard = false;
  b.coverId = null;
  b.tauntId = null;
  return { log, status: null, fx: b.fx };
}

export function availableSkills(actor) {
  if (!actor || !actor.skill) return [];
  const s = actor.skill;
  const usable = s.id === 'cover' || s.id === 'taunt' ? true : actor.skillUses > 0;
  return [{ ...s, usable }];
}

// 作戦（オート）用：このラウンドの行動を組み立てる
export const TACTICS = [
  { id: 'manual', name: '指示', desc: '各キャラに自分で指示する' },
  { id: 'attack', name: '突撃', desc: '技も使い、とにかく攻める' },
  { id: 'tank', name: '堅守', desc: '危険なら守る・かばう' },
  { id: 'save', name: '温存', desc: '技を使わず通常攻撃だけ' },
  { id: 'heal', name: '回復', desc: '回復を優先し、無理をしない' },
];

export function planRound(b, tactic = 'attack') {
  const foes = aliveFoes(b).slice().sort((x, y) => x.hp - y.hp);
  const target = foes[0] ? foes[0].id : undefined;
  const allies = aliveParty(b);
  const low = allies.slice().sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0] || null;
  const allyLow = !!low && low.hp / low.maxHp < 0.65;
  return allies.map((p) => {
    const hpRatio = p.hp / p.maxHp;
    const sid = p.skill ? p.skill.id : null;
    const skillReady = sid && (sid === 'cover' || sid === 'taunt' ? true : p.skillUses > 0);
    if (tactic === 'save') {
      if (hpRatio < 0.25) return { actorId: p.id, type: 'guard' };
      return { actorId: p.id, type: 'attack', targetId: target };
    }
    if (tactic === 'heal') {
      if (sid === 'heal' && skillReady && allyLow) return { actorId: p.id, type: 'skill', skillId: 'heal' };
      if (hpRatio < 0.35) return { actorId: p.id, type: 'guard' };
      return { actorId: p.id, type: 'attack', targetId: target };
    }
    if (tactic === 'tank') {
      if (sid === 'cover' && allyLow) return { actorId: p.id, type: 'skill', skillId: 'cover' };
      if (sid === 'taunt' && skillReady && allyLow) return { actorId: p.id, type: 'skill', skillId: 'taunt' };
      if (hpRatio < 0.45) return { actorId: p.id, type: 'guard' };
      if (sid === 'heal' && skillReady && allyLow) return { actorId: p.id, type: 'skill', skillId: 'heal' };
      return { actorId: p.id, type: 'attack', targetId: target };
    }
    // attack
    if (skillReady && (sid === 'power' || sid === 'weak' || sid === 'double' || sid === 'heal')) {
      if (sid === 'heal' && !allyLow) return { actorId: p.id, type: 'attack', targetId: target };
      return { actorId: p.id, type: 'skill', skillId: sid, targetId: target };
    }
    return { actorId: p.id, type: 'attack', targetId: target };
  });
}
