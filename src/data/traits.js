// 特性プール全20種（Phase3完成）。plan/playsystem.md も参照
// apply: プレイヤーステータスへの加算・乗算。stack: 所持数
export const TRAITS = [
  { id: "power", name: "ちから+", desc: "攻撃力+20%", maxStacks: 99,
    apply: (p) => { p.atk = Math.floor(p.atk * 1.2); } },
  { id: "double", name: "れんだ", desc: "15%で2回攻撃", maxStacks: 3,
    apply: (p) => { p.doubleChance += 0.15; } },
  { id: "crit", name: "かいしん", desc: "会心率+10%", maxStacks: 5,
    apply: (p) => { p.critChance += 0.1; } },
  { id: "tough", name: "たいりょく+", desc: "最大HP+12＆12回復", maxStacks: 99,
    apply: (p) => { p.maxHp += 12; p.hp = Math.min(p.maxHp, p.hp + 12); } },
  { id: "skin", name: "かたい皮", desc: "被ダメ-2", maxStacks: 5,
    apply: (p) => { p.armor += 2; } },
  { id: "regen", name: "さいせい", desc: "攻撃時 HP+2回復", maxStacks: 3,
    apply: (p) => { p.regen += 2; } },
  { id: "vampire", name: "きゅうけつ", desc: "与ダメの10%吸収", maxStacks: 3,
    apply: (p) => { p.lifesteal += 0.1; } },
  { id: "scholar", name: "ものしり", desc: "獲得EXP+20%", maxStacks: 3,
    apply: (p) => { p.expBonus += 0.2; } },
  { id: "poison", name: "どく刃", desc: "25%で毒付与（3T）", maxStacks: 3,
    apply: (p) => { p.poisonChance += 0.25; } },
  { id: "fire", name: "ほのお", desc: "攻撃に+3追加", maxStacks: 3,
    apply: (p) => { p.burnDmg += 3; } },
  { id: "counter", name: "はんげき", desc: "15%で反撃", maxStacks: 3,
    apply: (p) => { p.counterChance += 0.15; } },
  { id: "evade", name: "かいひ", desc: "回避率+8%", maxStacks: 3,
    apply: (p) => { p.evadeChance += 0.08; } },
  { id: "prayer", name: "いのり", desc: "1戦闘1回 致死でHP1残る", maxStacks: 1,
    apply: (p) => { p.prayer = true; } },
  { id: "potion", name: "やくそう名人", desc: "やくそう回復+10", maxStacks: 2,
    apply: (p) => { p.potionPower += 10; } },
  { id: "hunter", name: "トレジャーハンター", desc: "獲得G+25%", maxStacks: 3,
    apply: (p) => { p.goldBonus += 0.25; } },
  { id: "focus", name: "カウンター体勢", desc: "3回毎の攻撃が確定会心", maxStacks: 1,
    apply: (p) => { p.focus = true; } },
  { id: "berserk", name: "どんそく猛攻", desc: "与ダメ+20% 被ダメ+10%", maxStacks: 2,
    apply: (p) => { p.berserkAtk += 0.2; p.berserkTaken += 0.1; } },
  { id: "gambler", name: "ギャンブラー", desc: "ダメージ幅拡大＆3連撃あり", maxStacks: 2,
    apply: (p) => { p.gambler += 1; } },
  { id: "growth", name: "せいちょう", desc: "LvUP時HP+3追加", maxStacks: 3,
    apply: (p) => { p.growthHp += 3; } },
  { id: "quick", name: "はやあし", desc: "逃走+15% 遭遇率-10%", maxStacks: 2,
    apply: (p) => { p.quick += 1; } },
];

export const LEVEL_CAP = 10;

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
    poisonChance: 0,
    burnDmg: 0,
    counterChance: 0,
    evadeChance: 0,
    prayer: false,
    prayed: false,
    potionPower: 0,
    goldBonus: 0,
    focus: false,
    berserkAtk: 0,
    berserkTaken: 0,
    gambler: 0,
    growthHp: 0,
    quick: 0,
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
