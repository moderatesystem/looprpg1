// 主人公・NPCグラフィックの差し替え口
// fal.ai等で生成したPNGを置くと自動で使用される（なければ手描きにフォールバック）
// - public/assets/hero.png（主人公、透過PNG推奨）
// - public/assets/npcs/<npcId>.png（npcIdは dialogues.json の id）
import DIALOGUES from '../data/dialogues.json';

export function npcKey(id) {
  return `npc-${id}`;
}

export function preloadCharArt(scene) {
  scene.load.on('loaderror', () => { /* 素材なしでも続行 */ });
  scene.load.image('hero', 'assets/hero.png');
  const all = [...DIALOGUES.npcs];
  for (const t of DIALOGUES.towns || []) {
    for (const n of t.npcs || []) all.push(n);
  }
  for (const n of all) {
    scene.load.image(npcKey(n.id), `assets/npcs/${n.id}.png`);
  }
}

// 戻り値：画像を使ったか
export function drawHeroFigure(scene, gfx, px, py, imgHolder) {
  if (imgHolder.img) { imgHolder.img.destroy(); imgHolder.img = null; }
  if (scene.textures.exists('hero')) {
    imgHolder.img = scene.add.image(px + 16, py + 16, 'hero');
    imgHolder.img.setDisplaySize(44, 44);
    gfx.clear();
    return true;
  }
  return false;
}

export function drawNpcFigure(scene, n, px, py) {
  const key = npcKey(n.id);
  if (scene.textures.exists(key)) {
    const img = scene.add.image(px + 16, py + 16, key);
    img.setDisplaySize(40, 40);
    return img;
  }
  return null;
}
