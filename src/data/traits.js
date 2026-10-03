// 特性プール（試作8種）。本リスト20種は plan/playsystem.md 参照
// apply: プレイヤーステータスへの加算・乗算。stack: 所持数
export const TRAITS = [
  {
    id: "power",
    name: "ちから+",
    desc: "攻撃力+20%",
    maxStacks: 99,
    apply: (p) => { p.atk = Math.floor(p.atk * 1.2); },
  },
  {
    id: "double",
    name: "れんだ",
    desc: "15%で2回攻撃",
    maxStacks: 3,
    apply: (p) => { p.doubleChance += 0.15; },
  },
  {
    id: "crit",
    name: "かいしん",
    desc: "会心率+10%",
    maxStacks: 5,
    apply: (p) => { p.critChance += 0.1; },
  },
  {
    id: "tough",
    name: "たいりょく+",
    desc: "最大HP+12＆12回復",
    maxStacks: 99,
    apply: (p) => { p.maxHp += 12; p.hp = Math.min(p.maxHp, p.hp + 12); },
  },
  {
    id: "skin",
    name: "かたい皮",
    desc: "被ダメ-2",
    maxStacks: 5,
    apply: (p) => { p.armor += 2; },
  },
  {
    id: "regen",
    name: "さいせい",
    desc: "戦闘中 毎ターンHP+2",
    maxStacks: 3,
    apply: (p) => { p.regen += 2; },
  },
  {
    id: "vampire",
    name: "きゅうけつ",
    desc: "与ダメの10%吸収",
    maxStacks: 3,
    apply: (p) => { p.lifesteal += 0.1; },
  },
  {
    id: "scholar",
    name: "ものしり",
    desc: "獲得EXP+20%",
    maxStacks: 3,
    apply: (p) => { p.expBonus += 0.2; },
  },
];

export function basePlayer() {
  return {
    lv: 1,
    exp: 0,
    next: 12,
    atk: 8,
    maxHp: 30,
    hp: 30,
    armor: 0,
    regen: 0,
    lifesteal: 0,
    doubleChance: 0,
    critChance: 0.05,
    expBonus: 0,
    gold: 0,
    herbs: 3,
    traits: {}, // id -> stack数
  };
}

export function expForLevel(lv) {
  return 12 + (lv - 1) * 10;
}

// 重複なし・上限除外でn枚引く
export function rollTraitChoices(owned) {
  const pool = TRAITS.filter((t) => (owned[t.id] || 0) < t.maxStacks);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(3, shuffled.length));
}

export function applyTrait(player, traitId) {
  const t = TRAITS.find((x) => x.id === traitId);
  if (!t) return null;
  t.apply(player);
  player.traits[t.id] = (player.traits[t.id] || 0) + 1;
  return t;
}
