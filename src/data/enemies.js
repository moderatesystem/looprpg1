// 敵定義＋生成（フィールド地形・プレイヤーLvでスケーリング）
export const TABLE = [
  { id: 'slime', name: 'スライム', hp: 14, atk: 6, exp: 5, gold: 5, color: 0x3aa0ff, minLv: 1 },
  { id: 'bat', name: 'コウモリ', hp: 10, atk: 7, exp: 8, gold: 7, color: 0x9a6bff, minLv: 1 },
  { id: 'slimebes', name: 'スライムベス', hp: 15, atk: 6, exp: 6, gold: 8, color: 0xff5252, minLv: 1 },
  { id: 'dracky', name: 'ドラキー', hp: 12, atk: 8, exp: 9, gold: 11, color: 0xce93d8, minLv: 2 },
  { id: 'goblin', name: 'ゴブリン', hp: 18, atk: 8, exp: 11, gold: 10, color: 0x4caf50, minLv: 2 },
  { id: 'wolf', name: 'オオカミ', hp: 14, atk: 7, exp: 9, gold: 8, color: 0x8d8d99, minLv: 2 },
  { id: 'ghost', name: 'ゴースト', hp: 20, atk: 10, exp: 15, gold: 13, color: 0xcccccc, minLv: 3 },
  { id: 'skeleton', name: 'スケルトン', hp: 18, atk: 9, exp: 13, gold: 11, color: 0xe8e8e8, minLv: 3 },
  { id: 'golem', name: 'ゴーレム', hp: 30, atk: 12, exp: 22, gold: 18, color: 0x8d6e63, minLv: 4 },
  { id: 'orc', name: 'オーク', hp: 24, atk: 11, exp: 18, gold: 14, color: 0x2e7d32, minLv: 4 },
  { id: 'mage', name: 'まほうつかい', hp: 16, atk: 13, exp: 24, gold: 20, color: 0x7b1fa2, minLv: 5 },
  { id: 'dragon', name: 'ドラゴン', hp: 45, atk: 15, exp: 40, gold: 35, color: 0xd32f2f, minLv: 7 },
  { id: 'mole', name: 'きんのモグラ', hp: 8, atk: 4, exp: 80, gold: 40, color: 0xffd54f, minLv: 5, shy: true, hardBody: true },
];

export const ENEMY_IDS = TABLE.map((e) => e.id);

const BY_ID = Object.fromEntries(TABLE.map((e) => [e.id, e]));

export function makeEnemy(playerLv, tile, danger = 1, pool = null) {
  // DQ式：テリトリーの遭遇表（pool）があればそこから抽選。なければ全種から重み付け。
  // dangerは重みと実効Lvの両方に効く
  const effLv = playerLv + Math.max(0, Math.floor((danger - 1) * 4));
  let candidates = TABLE;
  if (pool && pool.length) {
    candidates = pool.map((id) => BY_ID[id]).filter(Boolean);
    if (!candidates.length) candidates = TABLE;
  }
  // きんのモグラはレア枠（DQのメタルスライム枠）。硬くて逃げやすい
  if (pool && pool.includes('mole') && Math.random() < 0.08) {
    const m = BY_ID.mole;
    return { ...m, maxHp: m.hp, hp: m.hp, atk: m.atk, exp: m.exp, gold: m.gold, poisonTurns: 0 };
  }
  const weights = candidates.map((e) => {
    let w = 1;
    if (!pool && tile === 'T' && e.minLv >= 2) w += 1.5;
    if (effLv < e.minLv) w *= 0.15;
    if (effLv >= e.minLv + 3) w += 0.5;
    if (!pool && e.minLv >= 4) w *= danger;
    if (tile === '+' || tile === ':') w *= e.minLv >= 3 ? 1.5 : 0.8;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let base = candidates[0];
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) { base = candidates[i]; break; }
  }
  const lvBonus = Math.floor(effLv / 2);
  return {
    ...base,
    maxHp: base.hp + lvBonus * 3,
    hp: base.hp + lvBonus * 3,
    atk: base.atk + lvBonus,
    exp: base.exp + lvBonus * 2,
    gold: base.gold + lvBonus * 2,
    poisonTurns: 0,
  };
}

export const GUARDIAN = {
  id: 'golem', name: '門番ゴーレム', hp: 45, atk: 12, exp: 60, gold: 80,
  color: 0x8d6e63,
};

export const BOSS = {
  id: 'demon', name: '坑底のぬし', hp: 70, atk: 16, exp: 60, gold: 100,
  color: 0xb71c1c, boss: true,
};

export function makeBoss(playerLv, name) {
  const b = Math.floor(playerLv / 2);
  return {
    ...BOSS,
    name: name || BOSS.name,
    maxHp: BOSS.hp + b * 4,
    hp: BOSS.hp + b * 4,
    atk: BOSS.atk + b,
    exp: BOSS.exp + b * 4,
    gold: BOSS.gold + b * 5,
    poisonTurns: 0,
  };
}
