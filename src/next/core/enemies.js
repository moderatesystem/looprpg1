// 敵の生成と斥候情報（既存の敵40種データを再利用）
import { TABLE, BOSS } from '../../data/enemies.js';

const byMinLv = (lv) => TABLE.filter((e) => e.minLv <= lv && e.id !== 'mole');

export function enemyImg(e) {
  return `assets/enemies/${e.art || e.id}.png`;
}

function foeFrom(base, depth, mod = 1, asc = 0) {
  const ascHp = 1 + 0.18 * asc;
  const ascAtk = 1 + 0.12 * asc;
  const hpScale = (1 + 0.16 * depth) * ascHp;
  const atkScale = (1 + 0.10 * depth) * ascAtk;
  const maxHp = Math.max(6, Math.round(base.hp * hpScale * mod));
  return {
    id: base.id,
    name: base.name,
    img: enemyImg(base),
    maxHp,
    hp: maxHp,
    atk: Math.max(2, Math.round(base.atk * atkScale)),
    def: base.hardBody ? 2 : (maxHp >= 45 ? 2 : maxHp >= 26 ? 1 : 0),
    hardBody: !!base.hardBody,
    shy: !!base.shy,
    big: maxHp >= 45,
    boss: !!base.boss,
  };
}

// depth: 1..  n: ノード番号 asc: アセンション 0..5
export function buildEncounter(depth, isBoss = false, asc = 0) {
  if (isBoss) {
    return { foes: [foeFrom({ ...BOSS, boss: true }, depth + 2, 1.1, asc)], isBoss: true };
  }
  const pool = byMinLv(Math.max(1, depth));
  const size = depth <= 1 ? (Math.random() < 0.55 ? 1 : 2)
    : depth <= 3 ? 2
      : 3;
  const foes = [];
  for (let i = 0; i < size; i += 1) {
    const base = pool[Math.floor(Math.random() * pool.length)];
    foes.push(foeFrom(base, depth, 1, asc));
  }
  return { foes, isBoss: false };
}

// 斥候情報。tier 0..4
export function scoutReport(foes, tier) {
  const out = { count: foes.length, names: null, compose: null, traits: null, behavior: null };
  if (tier >= 1) out.names = foes.map((f) => f.name);
  if (tier >= 2) {
    out.compose = foes.map((f) => {
      const hard = f.def >= 2 || f.hardBody;
      const aggr = f.atk >= 12;
      return `${f.name}: ${hard ? '硬い' : aggr ? '攻撃的' : '標準'}`;
    });
  }
  if (tier >= 3) {
    out.traits = foes.map((f) => {
      const t = [];
      if (f.hardBody) t.push('硬い（ダメージ減少）');
      if (f.shy) t.push('臆病（逃げる）');
      if (f.big) t.push('大技（3Rごと）');
      return `${f.name}: ${t.length ? t.join('・') : '特徴なし'}`;
    });
  }
  if (tier >= 4) {
    out.behavior = foes.map((f) => `${f.name}: ${f.atk >= 12 ? '大ダメージ重視' : '手数で攻める'}`);
  }
  return out;
}

// 斥候値で増える選択肢
export function scoutChoices(tier) {
  return {
    bypass: tier >= 1,
    ambush: tier >= 2,
    weakpoint: tier >= 3,
    negotiate: tier >= 4,
  };
}
