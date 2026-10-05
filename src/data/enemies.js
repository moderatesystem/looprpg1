// 敵定義＋生成（フィールド地形・プレイヤーLvでスケーリング）
const TABLE = [
  { id: 'slime', name: 'スライム', hp: 12, atk: 5, exp: 4, gold: 5, color: 0x3aa0ff },
  { id: 'bat', name: 'コウモリ', hp: 10, atk: 7, exp: 8, gold: 7, color: 0x9a6bff },
  { id: 'goblin', name: 'ゴブリン', hp: 16, atk: 8, exp: 11, gold: 10, color: 0x4caf50 },
  { id: 'ghost', name: 'ゴースト', hp: 20, atk: 10, exp: 15, gold: 13, color: 0xcccccc },
  { id: 'golem', name: 'ゴーレム', hp: 30, atk: 12, exp: 22, gold: 18, color: 0x8d6e63 },
];

export const ENEMY_IDS = TABLE.map((e) => e.id);

export function makeEnemy(playerLv, tile, danger = 1) {
  // 森は強めが出やすい。dangerで地域補正（城周辺ほど弱い）
  const weights = TABLE.map((_, i) => {
    let w = 1;
    if (tile === 'T') w += i >= 2 ? 1.5 : 0;
    if (i >= 3) w *= danger;
    if (playerLv >= 4 && i >= 3) w += 1;
    if (playerLv < 3 && i >= 3) w *= 0.3;
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
