// 敵定義＋生成（フィールド地形・プレイヤーLvでスケーリング）
export const TABLE = [
  { id: 'slime', name: 'スライム', hp: 14, atk: 6, exp: 5, gold: 5, color: 0x3aa0ff, minLv: 1 },
  { id: 'bat', name: 'コウモリ', hp: 10, atk: 7, exp: 8, gold: 7, color: 0x9a6bff, minLv: 1 },
  { id: 'slimebes', name: 'あかゼリー', hp: 15, atk: 6, exp: 6, gold: 8, color: 0xff5252, minLv: 1 },
  { id: 'dracky', name: 'ツノコウモリ', hp: 12, atk: 8, exp: 9, gold: 11, color: 0xce93d8, minLv: 2 },
  { id: 'goblin', name: 'ゴブリン', hp: 18, atk: 8, exp: 11, gold: 10, color: 0x4caf50, minLv: 2 },
  { id: 'wolf', name: 'オオカミ', hp: 14, atk: 7, exp: 9, gold: 8, color: 0x8d8d99, minLv: 2 },
  { id: 'ghost', name: 'ゴースト', hp: 20, atk: 10, exp: 15, gold: 13, color: 0xcccccc, minLv: 3 },
  { id: 'skeleton', name: 'スケルトン', hp: 18, atk: 9, exp: 13, gold: 11, color: 0xe8e8e8, minLv: 3 },
  { id: 'golem', name: 'ゴーレム', hp: 30, atk: 12, exp: 22, gold: 18, color: 0x8d6e63, minLv: 4 },
  { id: 'orc', name: 'オーク', hp: 24, atk: 11, exp: 18, gold: 14, color: 0x2e7d32, minLv: 4 },
  { id: 'mage', name: 'みならい魔道士', hp: 16, atk: 13, exp: 24, gold: 20, color: 0x7b1fa2, minLv: 5 },
  { id: 'dragon', name: 'ドラゴン', hp: 45, atk: 15, exp: 40, gold: 35, color: 0xd32f2f, minLv: 7 },
  // ---- 亜種・上位種ストック（将来エリア用。全種固有スプライト生成済み） ----
  { id: 'metal', name: 'すいぎんスライム', hp: 6, atk: 5, exp: 150, gold: 5, color: 0xcfd8dc, minLv: 4, shy: true, hardBody: true },
  { id: 'buchi', name: 'まだらゼリー', hp: 18, atk: 7, exp: 9, gold: 8, color: 0xa1887f, minLv: 2 },
  { id: 'tsumuri', name: 'やどかりスライム', hp: 26, atk: 5, exp: 12, gold: 10, color: 0x81c784, minLv: 3 },
  { id: 'ookoumori', name: 'かげコウモリ', hp: 16, atk: 10, exp: 14, gold: 10, color: 0x616161, minLv: 3 },
  { id: 'mage_dracky', name: 'まどうコウモリ', hp: 14, atk: 12, exp: 18, gold: 16, color: 0x7b1fa2, minLv: 4 },
  { id: 'goblin_leader', name: 'ゴブリンおやかた', hp: 22, atk: 10, exp: 16, gold: 14, color: 0x33691e, minLv: 3 },
  { id: 'orc_king', name: 'オークのおかしら', hp: 40, atk: 14, exp: 30, gold: 25, color: 0x1b5e20, minLv: 6 },
  { id: 'lycant', name: 'ワーウルフ', hp: 30, atk: 16, exp: 28, gold: 20, color: 0x6d4c41, minLv: 5 },
  { id: 'white_wolf', name: 'しろがねウルフ', hp: 20, atk: 9, exp: 14, gold: 12, color: 0xf5f5f5, minLv: 3 },
  { id: 'wight', name: 'やみゴースト', hp: 26, atk: 12, exp: 20, gold: 16, color: 0x90a4ae, minLv: 4 },
  { id: 'hell_ghost', name: 'かえんゴースト', hp: 32, atk: 14, exp: 28, gold: 22, color: 0xbf360c, minLv: 6 },
  { id: 'sk_knight', name: 'ボーンナイト', hp: 36, atk: 15, exp: 30, gold: 24, color: 0xbdbdbd, minLv: 6 },
  { id: 'stone_man', name: 'いわのきょじん', hp: 50, atk: 14, exp: 35, gold: 25, color: 0x9e9e9e, minLv: 7 },
  { id: 'archmage', name: 'くろまどう', hp: 24, atk: 18, exp: 40, gold: 32, color: 0x4a148c, minLv: 7 },
  { id: 'baby_dragon', name: 'こどものドラゴン', hp: 20, atk: 8, exp: 15, gold: 12, color: 0x66bb6a, minLv: 2 },
  { id: 'keith_dragon', name: 'ひょうがドラゴン', hp: 55, atk: 18, exp: 55, gold: 45, color: 0x00838f, minLv: 8 },
  { id: 'dars_dragon', name: 'こくえんドラゴン', hp: 80, atk: 22, exp: 90, gold: 70, color: 0x212121, minLv: 9 },
  { id: 'armor_knight', name: 'くろがねのきし', hp: 42, atk: 17, exp: 38, gold: 30, color: 0x78909c, minLv: 7, art: 'knight' },
  { id: 'shadow_knight', name: 'シャドウナイト', hp: 46, atk: 18, exp: 44, gold: 34, color: 0x37474f, minLv: 8 },
  { id: 'death_knight', name: 'めいかいのきし', hp: 60, atk: 21, exp: 70, gold: 55, color: 0x4a148c, minLv: 9 },
  { id: 'chimera', name: 'キメラ', hp: 38, atk: 16, exp: 34, gold: 40, color: 0x8d6e63, minLv: 6 },
  { id: 'star_chimera', name: 'きんばねキメラ', hp: 48, atk: 18, exp: 50, gold: 50, color: 0xfff176, minLv: 8 },
  { id: 'mage_chimera', name: 'まどうキメラ', hp: 42, atk: 20, exp: 55, gold: 48, color: 0x5c6bc0, minLv: 8 },
  { id: 'sand_ghost', name: 'すなけむりゴースト', hp: 24, atk: 12, exp: 20, gold: 16, color: 0xd7ccc8, minLv: 4 },
  { id: 'cursed_armor', name: 'なきがらのよろい', hp: 40, atk: 16, exp: 34, gold: 26, color: 0x616161, minLv: 6 },
  { id: 'goldman', name: 'きんかいゴーレム', hp: 30, atk: 10, exp: 8, gold: 300, color: 0xffd54f, minLv: 5, hardBody: true },
  { id: 'mole', name: 'きんのモグラ', hp: 8, atk: 4, exp: 80, gold: 40, color: 0xffd54f, minLv: 5, shy: true, hardBody: true },
  { id: 'demon_knight', name: 'ちぞめのきし', hp: 55, atk: 20, exp: 65, gold: 60, color: 0xb71c1c, minLv: 9 },
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
