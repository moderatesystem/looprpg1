// 敵グラフィックの差し替え口
// fal.ai等で生成したPNGを public/assets/enemies/<id>.png に置くと自動で使用される
// （透過PNG推奨。なければ下の手描きシェイプにフォールバック）
// 対象id: slime, bat, goblin, ghost, golem, demon
import { ENEMY_IDS } from '../data/enemies';

export const ENEMY_ART_IDS = [...ENEMY_IDS, 'demon'];

export function preloadEnemyArt(scene) {
  scene.load.on('loaderror', () => { /* 素材なしでも続行（フォールバック描画） */ });
  for (const id of ENEMY_ART_IDS) {
    scene.load.image(`enemy-${id}`, `assets/enemies/${id}.png`);
  }
}

// テクスチャがあれば画像、なければ手描きシェイプ
export function drawEnemyArt(scene, enemy, cx, cy) {
  if (scene.textures.exists(`enemy-${enemy.id}`)) {
    const img = scene.add.image(cx, cy, `enemy-${enemy.id}`);
    img.setDisplaySize(170, 170);
    return;
  }
  drawEnemyShape(scene, enemy, cx, cy);
}

function drawEnemyShape(scene, enemy, cx, cy) {
  const g = scene.add.graphics();
  const c = enemy.color;
  if (enemy.id === 'slime') {
    g.fillStyle(c, 1); g.fillEllipse(cx, cy + 20, 130, 100);
    g.fillStyle(0xffffff, 1); g.fillCircle(cx - 25, cy + 10, 12); g.fillCircle(cx + 25, cy + 10, 12);
    g.fillStyle(0x000000, 1); g.fillCircle(cx - 25, cy + 12, 5); g.fillCircle(cx + 25, cy + 12, 5);
  } else if (enemy.id === 'bat') {
    g.fillStyle(c, 1);
    g.fillTriangle(cx - 90, cy - 30, cx - 20, cy - 30, cx - 45, cy + 25);
    g.fillTriangle(cx + 90, cy - 30, cx + 20, cy - 30, cx + 45, cy + 25);
    g.fillCircle(cx, cy, 28);
    g.fillStyle(0xff0000, 1); g.fillCircle(cx - 10, cy - 5, 5); g.fillCircle(cx + 10, cy - 5, 5);
  } else if (enemy.id === 'goblin') {
    g.fillStyle(c, 1);
    g.fillTriangle(cx - 30, cy - 20, cx - 60, cy - 55, cx - 15, cy - 45);
    g.fillTriangle(cx + 30, cy - 20, cx + 60, cy - 55, cx + 15, cy - 45);
    g.fillCircle(cx, cy, 42);
    g.fillStyle(0xffffff, 1); g.fillCircle(cx - 14, cy - 8, 9); g.fillCircle(cx + 14, cy - 8, 9);
    g.fillStyle(0x000000, 1); g.fillCircle(cx - 14, cy - 6, 4); g.fillCircle(cx + 14, cy - 6, 4);
  } else if (enemy.id === 'ghost') {
    g.fillStyle(c, 0.9); g.fillCircle(cx, cy - 10, 45);
    g.fillTriangle(cx - 45, cy - 10, cx + 45, cy - 10, cx, cy + 70);
    g.fillStyle(0x000000, 1); g.fillCircle(cx - 15, cy - 15, 7); g.fillCircle(cx + 15, cy - 15, 7);
  } else if (enemy.id === 'demon') {
    g.fillStyle(c, 1);
    g.fillTriangle(cx - 40, cy - 40, cx - 70, cy - 100, cx - 15, cy - 60);
    g.fillTriangle(cx + 40, cy - 40, cx + 70, cy - 100, cx + 15, cy - 60);
    g.fillRect(cx - 55, cy - 45, 110, 75);
    g.fillRect(cx - 40, cy + 30, 80, 60);
    g.fillStyle(0xffeb00, 1); g.fillCircle(cx - 20, cy - 10, 9); g.fillCircle(cx + 20, cy - 10, 9);
    g.fillStyle(0x000000, 1); g.fillCircle(cx - 20, cy - 8, 4); g.fillCircle(cx + 20, cy - 8, 4);
  } else {
    g.fillStyle(c, 1);
    g.fillRect(cx - 45, cy - 40, 90, 60);
    g.fillRect(cx - 35, cy + 20, 70, 55);
    g.fillStyle(0xff0000, 1); g.fillCircle(cx - 15, cy - 10, 6); g.fillCircle(cx + 15, cy - 10, 6);
  }
}
