// 遠征ループのバランス検証（純ロジックのみ・ブラウザ不要）
//
//   npm run sim
//   npm run sim -- --n 3000 --tactic tank
//   npm run sim -- --gear 0 1 --asc 0 1 3 5
//   npm run sim -- --boss-bonus 0 --hp-scale 0.10      # 修正案の事前検証
//
// 前提:
//   - 1遠征 = ノード1..NODES。NODES はボス固定、それ以外は nodeKind() の抽選
//   - 戦闘は「作戦オート」で解決（手動の対象選択・道具使用はしない＝下限値）
//   - 泉はHP+12、分岐（休む）はHP+8。敗北した時点で打ち切り
//   - 装備段階 gear は4人全員の武器・防具を同じ段階まで上げた状態

import { createParty, DEFAULT_PARTY } from '../src/next/core/state.js';
import { buildEncounter, enemyImg } from '../src/next/core/enemies.js';
import { nodeKind, NODES } from '../src/next/core/expedition.js';
import { initBattle, resolveRound, planRound } from '../src/next/core/battle.js';
import { BOSS } from '../src/data/enemies.js';

/* ---------------- 引数 ---------------- */
const argv = process.argv.slice(2);

// `--name=v` / `--name v` / `--name v1 v2 ...` を受け付ける（値が無ければ undefined）
function optionValues(name) {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return [eq.slice(name.length + 3)];
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const out = [];
  for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j += 1) out.push(argv[j]);
  return out.length ? out : undefined;
}

function scalar(name, fallback) {
  const v = optionValues(name);
  return v === undefined ? fallback : v[0];
}

function numList(name, fallback) {
  const v = optionValues(name);
  if (v === undefined) return fallback;
  return v.flatMap((s) => String(s).split(',')).filter(Boolean).map(Number);
}

const N = Math.max(1, Number(scalar('n', 1000)));
const ASCS = numList('asc', [0, 1, 2, 3, 4, 5]);
const GEARS = numList('gear', [0, 1, 2, 3, 4, 5]);
const TACTIC = String(scalar('tactic', 'attack'));
const BOSS_BONUS = Number(scalar('boss-bonus', 2));
const HP_SCALE = Number(scalar('hp-scale', 0.16));
const CUSTOM_BOSS = optionValues('boss-bonus') !== undefined || optionValues('hp-scale') !== undefined;

/* ---------------- シミュレーション ---------------- */
function metaFor(gear, asc) {
  const equip = {};
  for (const id of DEFAULT_PARTY) equip[id] = { w: gear, a: gear };
  return { party: [...DEFAULT_PARTY], equip, ascension: asc };
}

// ゲーム側の buildEncounter と同じ式。--boss-bonus / --hp-scale で先に調整案を試せる
function bossFoe(depth, asc) {
  const hp = Math.max(6, Math.round(BOSS.hp * (1 + HP_SCALE * (depth + BOSS_BONUS)) * 1.1 * (1 + 0.18 * asc)));
  const atk = Math.max(2, Math.round(BOSS.atk * (1 + 0.1 * (depth + BOSS_BONUS)) * (1 + 0.12 * asc)));
  return {
    id: 'demon', name: BOSS.name, img: enemyImg(BOSS),
    maxHp: hp, hp, atk, def: 2, boss: true, big: true,
  };
}

function simBattle(party, depth, asc, isBoss) {
  const foes = isBoss && CUSTOM_BOSS
    ? [bossFoe(depth, asc)]
    : buildEncounter(depth, isBoss, asc).foes;
  const battle = initBattle({ party, foes, items: { herb: 2, revive: 0 } });
  let rounds = 0;
  while (!battle.status && rounds < 60) {
    resolveRound(battle, planRound(battle, TACTIC));
    rounds += 1;
  }
  return { battle, status: battle.status || 'timeout', rounds };
}

function simRun(gear, asc) {
  let party = createParty(metaFor(gear, asc));
  let battles = 0;
  for (let node = 1; node <= NODES; node += 1) {
    const kind = node >= NODES ? 'boss' : nodeKind({ node });
    if (kind === 'battle' || kind === 'boss') {
      const r = simBattle(party, node, asc, kind === 'boss');
      battles += 1;
      party = r.battle.party;
      if (r.status !== 'win') return { win: false, node, battles };
    } else if (kind === 'shrine') {
      for (const p of party) p.hp = Math.min(p.maxHp, p.hp + 12);
    } else if (kind === 'event') {
      for (const p of party) p.hp = Math.min(p.maxHp, p.hp + 8);
    }
  }
  return { win: true, node: NODES, battles };
}

/* ---------------- 実行・表示 ---------------- */
const padL = (s, n) => String(s).padEnd(n);
const padR = (s, n) => String(s).padStart(n);

const rows = [];
let totalRuns = 0;
let totalWins = 0;
let totalBattles = 0;
let totalReached = 0;

for (const gear of GEARS) {
  const cells = [];
  for (const asc of ASCS) {
    let wins = 0;
    for (let i = 0; i < N; i += 1) {
      const r = simRun(gear, asc);
      totalRuns += 1;
      totalBattles += r.battles;
      totalReached += r.node;
      if (r.win) { wins += 1; totalWins += 1; }
    }
    cells.push(`${(wins / N * 100).toFixed(1)}%`);
  }
  rows.push({ label: `装備+${gear}`, cells });
}

const head = padL('装備\\A', 10) + ASCS.map((a) => padR(`A${a}`, 8)).join('');
const lines = [
  `作戦: ${TACTIC} / 試行: ${N}回/セル（各セルは独立に遠征を再現）`,
  CUSTOM_BOSS
    ? `ボス式: 上書き（深度+${BOSS_BONUS} / HP傾斜 ${HP_SCALE}）`
    : 'ボス式: src/next/core/enemies.js の実装そのまま',
  '',
  head,
  '-'.repeat(head.length),
  ...rows.map((r) => padL(r.label, 10) + r.cells.map((c) => padR(c, 8)).join('')),
  '',
  `平均: 制覇 ${(totalWins / totalRuns * 100).toFixed(1)}% / 到達 ${(totalReached / totalRuns).toFixed(2)}層 / 戦闘 ${(totalBattles / totalRuns).toFixed(2)}回`,
  '※ 戦闘は作戦オート。道具使用と手動の対象選択を含まないため、実際の勝率はこれより高い。',
];

console.log(lines.join('\n'));
