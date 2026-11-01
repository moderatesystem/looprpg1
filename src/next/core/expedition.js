// 遠征（ノード進行・戦利品・日数）
import { createParty } from './state.js';

export const NODES = 6;
export const COPPER_VALUE = 12;
export const RELIC_VALUE = 80;

export function createRun(meta, party) {
  return {
    node: 1,
    loot: { copper: 0, relic: 0 },
    party: party || createParty(meta),
    scout: Math.min(4, (meta.scout || 0) + (meta.intel || 0)),
    intelUsed: meta.intel || 0,
    kind: null,
    enc: null,
    bossDefeated: false,
  };
}

export function nodeKind(run) {
  if (run.node >= NODES) return 'boss';
  const r = Math.random();
  if (r < 0.58) return 'battle';
  if (r < 0.78) return 'event';
  if (r < 0.9) return 'treasure';
  return 'shrine';
}

export const NODE_LABEL = {
  battle: { icon: '⚔', name: '敵の気配', desc: 'この先に敵がいる。' },
  event: { icon: '❓', name: '分かれ道', desc: '何かが埋まっているようだ。' },
  treasure: { icon: '✦', name: '古い宝箱', desc: '埃をかぶった宝箱がある。' },
  shrine: { icon: '✚', name: '小さな泉', desc: '澄んだ水が湧いている。' },
  boss: { icon: '☠', name: '深部の主', desc: '奥から重い気配がする。' },
};

export function battleLoot(node) {
  return {
    copper: 1 + Math.floor(Math.random() * 3) + Math.floor(node / 2),
    relic: 0,
  };
}

export function treasureLoot() {
  if (Math.random() < 0.35) return { copper: 0, relic: 1 };
  return { copper: 2 + Math.floor(Math.random() * 3), relic: 0 };
}

export function addLoot(run, loot) {
  run.loot.copper += loot.copper || 0;
  run.loot.relic += loot.relic || 0;
}

export function lootGold(run) {
  return run.loot.copper * COPPER_VALUE + run.loot.relic * RELIC_VALUE;
}

// 遠征終了（帰還／敗北）。meta を更新して返す
export function finishRun(meta, run, { status }) {
  const next = { ...meta };
  next.days += 1;
  next.runs += 1;
  if (run.node > next.bestDepth) next.bestDepth = run.node;
  if (status === 'win') {
    next.gold += lootGold(run);
    next.clears += 1;
  } else if (status === 'lose') {
    next.gold += Math.floor(lootGold(run) * 0.3);
  } else {
    next.gold += lootGold(run);
  }
  return next;
}
