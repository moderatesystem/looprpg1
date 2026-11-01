// メタ進行（保存）・ロスター・装備・道具
const META_KEY = 'expedition-meta-v2';

export const ROSTER = [
  {
    id: 'gald', name: 'ガルド', role: '前衛', img: 'assets/npcs/role-guard.png',
    maxHp: 46, atk: 8, def: 3,
    skill: { id: 'cover', name: 'かばう', desc: '味方への攻撃を自分が受ける（-40%）', uses: 99 },
  },
  {
    id: 'yu', name: 'ユウ', role: '火力', img: 'assets/hero.png',
    maxHp: 34, atk: 12, def: 1,
    skill: { id: 'power', name: '強撃', desc: '1.8倍のダメージ（1戦2回）', uses: 2 },
  },
  {
    id: 'sera', name: 'セラ', role: '支援', img: 'assets/npcs/role-priest.png',
    maxHp: 30, atk: 6, def: 1,
    skill: { id: 'heal', name: 'いやし', desc: '味方1人のHPを14回復（1戦2回）', uses: 2 },
  },
  {
    id: 'kai', name: 'カイ', role: '自由', img: 'assets/npcs/role-traveler.png',
    maxHp: 36, atk: 10, def: 2,
    skill: { id: 'weak', name: '弱点狙い', desc: '防御無視の10ダメージ（1戦2回）', uses: 2 },
  },
  {
    id: 'rina', name: 'リナ', role: '火力', img: 'assets/npcs/role-shopkeeper.png',
    maxHp: 28, atk: 13, def: 0,
    skill: { id: 'double', name: '連撃', desc: '2回攻撃（1戦2回）', uses: 2 },
  },
  {
    id: 'dolf', name: 'ドルフ', role: '前衛', img: 'assets/npcs/role-innkeeper.png',
    maxHp: 54, atk: 7, def: 4,
    skill: { id: 'taunt', name: '引きつけ', desc: 'このラウンド敵の狙いを自分に集める', uses: 3 },
  },
];

export const DEFAULT_PARTY = ['gald', 'yu', 'sera', 'kai'];

export const ITEMS = {
  herb: { id: 'herb', name: 'やくそう', cost: 15, desc: 'HPを15回復（戦闘中）' },
  revive: { id: 'revive', name: '気付け薬', cost: 45, desc: '倒れた味方を30%で復活' },
};

const DEFAULT_META = {
  days: 0,
  gold: 120,
  scout: 0,
  clears: 0,
  bestDepth: 0,
  runs: 0,
  party: [...DEFAULT_PARTY],
  equip: {},
  items: { herb: 2, revive: 0 },
  intel: 0,
};

export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { ...DEFAULT_META, party: [...DEFAULT_META.party], items: { ...DEFAULT_META.items }, equip: {} };
    const d = JSON.parse(raw);
    const m = {
      ...DEFAULT_META,
      ...d,
      party: Array.isArray(d.party) && d.party.length ? d.party.slice(0, 4) : [...DEFAULT_PARTY],
      items: { ...DEFAULT_META.items, ...(d.items || {}) },
      equip: d.equip || {},
    };
    return m;
  } catch (e) {
    return { ...DEFAULT_META, party: [...DEFAULT_PARTY], items: { ...DEFAULT_META.items }, equip: {} };
  }
}

export function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
    return true;
  } catch (e) {
    return false;
  }
}

export function resetMeta() {
  const m = { ...DEFAULT_META, party: [...DEFAULT_PARTY], items: { ...DEFAULT_META.items }, equip: {} };
  saveMeta(m);
  return m;
}

export function memberById(id) {
  return ROSTER.find((m) => m.id === id) || null;
}

export function equipOf(meta, id) {
  return (meta.equip && meta.equip[id]) || { w: 0, a: 0 };
}

export function weaponCost(level) { return 40 + level * 35; }
export function armorCost(level) { return 35 + level * 30; }
export const EQUIP_MAX = 5;

export function statsWithEquip(base, eq) {
  return {
    maxHp: base.maxHp + eq.a * 4,
    atk: base.atk + eq.w * 3,
    def: base.def + eq.a,
  };
}

// 選ばれた4人＋装備補正でパーティを作る
export function createParty(meta) {
  const ids = (meta.party && meta.party.length ? meta.party : DEFAULT_PARTY).slice(0, 4);
  return ids.map((id) => {
    const base = memberById(id) || ROSTER[0];
    const eq = equipOf(meta, base.id);
    const s = statsWithEquip(base, eq);
    return {
      ...base,
      atk: s.atk,
      def: s.def,
      maxHp: s.maxHp,
      hp: s.maxHp,
      skillUses: base.skill.uses,
    };
  });
}

export function healParty(party) {
  for (const p of party) p.hp = p.maxHp;
  return party;
}

export const SCOUT_TIERS = [
  { level: 0, label: '敵の数だけ' },
  { level: 1, label: '敵の名前' },
  { level: 2, label: '構成（硬さ・攻撃性）' },
  { level: 3, label: '特性（硬い/臆病/大技）' },
  { level: 4, label: '行動の傾向と交渉' },
];

export function scoutUpgradeCost(meta) {
  return 30 + meta.scout * 30;
}

export function canUpgradeScout(meta) {
  return meta.scout < 4 && meta.gold >= scoutUpgradeCost(meta);
}

export const INTEL_COST = 20;
export const INTEL_MAX = 3;
