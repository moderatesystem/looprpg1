// モンスター図鑑生成： public/bestiary.html をデータから作る
// 使い方: node scripts/gen-bestiary.mjs
import { TABLE, BOSS, GUARDIAN } from '../src/data/enemies.js';
import { REGIONS } from '../src/data/regions.js';
import D from '../src/data/dialogues.json' with { type: 'json' };
import fs from 'node:fs';

const poolAreas = (id) => {
  const areas = REGIONS.filter((r) => r.pool.includes(id)).map((r) => `${r.id}(Lv${r.lv})`);
  (D.dungeon.floors || []).forEach((f) => {
    if ((f.pool || []).includes(id)) areas.push(`${f.name}`);
  });
  return areas;
};

const rows = [
  ...TABLE.map((e) => ({ ...e, areas: poolAreas(e.id), note: [
    e.shy ? '臆病（逃走しやすい）' : null,
    e.hardBody ? '硬い（攻撃ほぼ1）' : null,
  ].filter(Boolean).join('／') })),
  { ...GUARDIAN, areas: ['北の橋（固定戦）', ...poolAreas('golem')], note: '北の橋の関所（固定戦）' },
  { ...BOSS, areas: ['下層ボス床'], note: '下層ボス床（逃走不可）' },
];

const card = (e) => {
  const areas = (e.areas || []).join('・') || '—';
  const special = e.note ? `<div class="sp">${e.note}</div>` : '';
  const img = `<img src="assets/enemies/${e.art || e.id}.png" alt="${e.name}" loading="lazy" onerror="this.style.display='none'">`;
  return `<div class="card${e.boss ? ' boss' : ''}">
    ${img}
    <div class="name">${e.name}</div>
    <div class="stat">HP ${e.hp} ／ ATK ${e.atk}</div>
    <div class="stat">EXP ${e.exp} ／ G ${e.gold}</div>
    <div class="stat">出現Lv ${e.minLv ?? '—'}</div>
    <div class="area">${areas}</div>
    ${special}
  </div>`;
};

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>モンスターずかん - Loop RPG</title>
<style>
  body { background: #101040; color: #fff; font-family: monospace; margin: 0; padding: 16px; }
  h1 { font-size: 20px; border: 3px solid #fff; display: inline-block; padding: 6px 14px; background: #000; }
  .meta { color: #ff0; font-size: 13px; margin: 8px 0 16px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
  .card { background: #000; border: 3px solid #fff; padding: 10px; text-align: center; }
  .card.boss { border-color: #f00; }
  .card img { width: 96px; height: 96px; object-fit: contain; image-rendering: pixelated; background: #082008; }
  .name { color: #ff0; font-size: 16px; margin: 6px 0; }
  .stat { font-size: 13px; }
  .area { font-size: 12px; color: #8fd3ff; margin-top: 4px; }
  .sp { font-size: 12px; color: #ffa; margin-top: 4px; }
</style>
</head>
<body>
<h1>モンスターずかん（全${rows.length}種）</h1>
<div class="meta">数値は素の値（Lv補正前）。出現域はテリトリーID＋坑道。画像は透過PNG（なければ矩形表示）</div>
<div class="grid">
${rows.map(card).join('\n')}
</div>
</body>
</html>
`;
fs.writeFileSync(new URL('../public/bestiary.html', import.meta.url), html);
console.log('wrote bestiary.html', rows.length, 'entries');
