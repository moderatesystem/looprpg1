// 敵定義＋生成（フィールド地形・プレイヤーLvでスケーリング）
const TABLE = [
  { id: 'slime', name: 'スライム', hp: 12, atk: 5, exp: 4, gold: 5, color: 0x3aa0ff, minLv: 1 },
  { id: 'bat', name: 'コウモリ', hp: 10, atk: 7, exp: 8, gold: 7, color: 0x9a6bff, minLv: 1 },
  { id: 'goblin', name: 'ゴブリン', hp: 16, atk: 8, exp: 11, gold: 10, color: 0x4caf50, minLv: 2 },
  { id: 'wolf', name: 'オオカミ', hp: 14, atk: 7, exp: 9, gold: 8, color: 0x8d8d99, minLv: 2 },
  { id: 'ghost', name: 'ゴースト', hp: 20, atk: 10, exp: 15, gold: 13, color: 0xcccccc, minLv: 3 },
  { id: 'skeleton', name: 'スケルトン', hp: 18, atk: 9, exp: 13, gold: 11, color: 0xe8e8e8, minLv: 3 },
  { id: 'golem', name: 'ゴーレム', hp: 30, atk: 12, exp: 22, gold: 18, color: 0x8d6e63, minLv: 4 },
  { id: 'orc', name: 'オーク', hp: 24, atk: 11, exp: 18, gold: 14, color: 0x2e7d32, minLv: 4 },
  { id: 'mage', name: 'まほうつかい', hp: 16, atk: 13, exp: 24, gold: 20, color: 0x7b1fa2, minLv: 5 },
  { id: 'dragon', name: 'ドラゴン', hp: 45, atk: 15, exp: 40, gold: 35, color: 0xd32f2f, minLv: 7 },
];

export const ENEMY_IDS = TABLE.map((e) => e.id);

export function makeEnemy(playerLv, tile, danger = 1) {
  // 森は強めが出やすい。minLv未満は出にくい。dangerで地域補正（城周辺ほど弱い）
  const weights = TABLE.map((e, i) => {
    let w = 1;
    if (tile === 'T' && i >= 2) w += 1.5;
    if (playerLv < e.minLv) w *= 0.15;
    if (playerLv >= e.minLv + 3) w += 0.5;
    if (i >= 6) w *= danger;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let base = TABLE[0];
  for (let i = 0; i < TABLE.length; i++) {
    r -= weights[i];
    if (r <= 0) { base = TABLE[i]; break; }
  }
  const lvBonus = Math.floor(playerLv / 2);
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

export const BOSS = {
  id: 'demon', name: 'まおうのてさき', hp: 70, atk: 16, exp: 60, gold: 100,
  color: 0xb71c1c, boss: true,
};

export function makeBoss(playerLv) {
  const b = Math.floor(playerLv / 2);
  return {
    ...BOSS,
    maxHp: BOSS.hp + b * 4,
    hp: BOSS.hp + b * 4,
    atk: BOSS.atk + b,
    exp: BOSS.exp + b * 4,
    gold: BOSS.gold + b * 5,
    poisonTurns: 0,
  };
}
