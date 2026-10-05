// 敵グラフィックの差し替え口
// fal.ai等で生成したPNGを public/assets/enemies/<id>.png に置くと自動で使用される
// （透過PNG推奨。なければ下の手描きシェイプにフォールバック）
// 対象id: slime, bat, goblin, wolf, ghost, skeleton, golem, orc, mage, dragon, demon
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
    g.fillStyle(0x1a5fb4, 1); g.fillEllipse(cx, cy + 26, 134, 102);
    g.fillStyle(c, 1); g.fillEllipse(cx, cy + 20, 130, 100);
    g.fillStyle(0xffffff, 0.85); g.fillEllipse(cx - 30, cy - 5, 34, 20);
    g.fillStyle(0xffffff, 1); g.fillCircle(cx - 25, cy + 10, 12); g.fillCircle(cx + 25, cy + 10, 12);
    g.fillStyle(0x000000, 1); g.fillCircle(cx - 25, cy + 12, 5); g.fillCircle(cx + 25, cy + 12, 5);
    g.lineStyle(2, 0x000000, 1); g.beginPath(); g.arc(cx, cy + 32, 14, 0.3, Math.PI - 0.3); g.strokePath();
  } else if (enemy.id === 'bat') {
    g.fillStyle(c, 1);
    g.fillTriangle(cx - 90, cy - 30, cx - 20, cy - 30, cx - 45, cy + 25);
    g.fillTriangle(cx + 90, cy - 30, cx + 20, cy - 30, cx + 45, cy + 25);
    g.fillCircle(cx, cy, 28);
    g.fillStyle(0xff0000, 1); g.fillCircle(cx - 10, cy - 5, 5); g.fillCircle(cx + 10, cy - 5, 5);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(cx - 8, cy + 8, cx - 4, cy + 8, cx - 6, cy + 14);
    g.fillTriangle(cx + 8, cy + 8, cx + 4, cy + 8, cx + 6, cy + 14);
  } else if (enemy.id === 'goblin') {
    g.fillStyle(c, 1);
    g.fillTriangle(cx - 30, cy - 20, cx - 60, cy - 55, cx - 15, cy - 45);
    g.fillTriangle(cx + 30, cy - 20, cx + 60, cy - 55, cx + 15, cy - 45);
    g.fillCircle(cx, cy, 42);
    g.fillStyle(0x2e7d32, 1); g.fillRect(cx - 30, cy - 34, 60, 8);
    g.fillStyle(0xffffff, 1); g.fillCircle(cx - 14, cy - 8, 9); g.fillCircle(cx + 14, cy - 8, 9);
    g.fillStyle(0x000000, 1); g.fillCircle(cx - 14, cy - 6, 4); g.fillCircle(cx + 14, cy - 6, 4);
    g.fillStyle(0x1b5e20, 1); g.fillTriangle(cx - 6, cy + 12, cx + 6, cy + 12, cx, cy + 20);
  } else if (enemy.id === 'ghost') {
    g.fillStyle(c, 0.9); g.fillCircle(cx, cy - 10, 45);
    g.fillTriangle(cx - 45, cy - 10, cx + 45, cy - 10, cx, cy + 70);
    g.fillStyle(0x101040, 1);
    g.fillCircle(cx - 30, cy + 55, 10); g.fillCircle(cx, cy + 62, 10); g.fillCircle(cx + 30, cy + 55, 10);
    g.fillStyle(0x000000, 1); g.fillCircle(cx - 15, cy - 15, 7); g.fillCircle(cx + 15, cy - 15, 7);
    g.fillStyle(0xffffff, 0.5); g.fillCircle(cx - 28, cy - 28, 8);
  } else if (enemy.id === 'wolf') {
    g.fillStyle(c, 1);
    g.fillEllipse(cx, cy + 20, 120, 70);
    g.fillCircle(cx + 45, cy, 30);
    g.fillTriangle(cx + 30, cy - 22, cx + 38, cy - 48, cx + 48, cy - 20);
    g.fillTriangle(cx + 52, cy - 20, cx + 62, cy - 46, cx + 68, cy - 18);
    g.fillTriangle(cx - 60, cy + 10, cx - 90, cy - 5, cx - 88, cy + 20);
    g.fillStyle(0xff0000, 1); g.fillCircle(cx + 52, cy - 5, 5);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(cx + 62, cy + 12, cx + 70, cy + 12, cx + 66, cy + 20);
  } else if (enemy.id === 'skeleton') {
    g.fillStyle(c, 1); g.fillCircle(cx, cy - 20, 34);
    g.fillRect(cx - 22, cy + 10, 44, 55);
    g.fillStyle(0x000000, 1);
    g.fillCircle(cx - 12, cy - 25, 8); g.fillCircle(cx + 12, cy - 25, 8);
    g.fillRect(cx - 10, cy - 2, 20, 6);
    g.lineStyle(3, 0x9e9e9e, 1);
    g.lineBetween(cx - 30, cy + 30, cx - 55, cy + 55); g.lineBetween(cx + 30, cy + 30, cx + 55, cy + 55);
    g.lineStyle(4, 0x9e9e9e, 1); g.lineBetween(cx + 40, cy - 40, cx + 70, cy + 40);
  } else if (enemy.id === 'orc') {
    g.fillStyle(c, 1);
    g.fillTriangle(cx - 35, cy - 25, cx - 55, cy - 60, cx - 18, cy - 45);
    g.fillTriangle(cx + 35, cy - 25, cx + 55, cy - 60, cx + 18, cy - 45);
    g.fillCircle(cx, cy, 46);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(cx - 18, cy + 12, cx - 10, cy + 12, cx - 14, cy + 24);
    g.fillTriangle(cx + 18, cy + 12, cx + 10, cy + 12, cx + 14, cy + 24);
    g.fillStyle(0xff0000, 1); g.fillCircle(cx - 15, cy - 10, 6); g.fillCircle(cx + 15, cy - 10, 6);
  } else if (enemy.id === 'mage') {
    g.fillStyle(c, 1);
    g.fillTriangle(cx, cy - 90, cx - 45, cy + 10, cx + 45, cy + 10);
    g.fillTriangle(cx, cy - 90, cx - 22, cy - 30, cx + 22, cy - 30);
    g.fillStyle(0x1a1a2e, 1); g.fillCircle(cx, cy - 15, 20);
    g.fillStyle(0xffeb00, 1); g.fillCircle(cx - 7, cy - 18, 3); g.fillCircle(cx + 7, cy - 18, 3);
    g.lineStyle(5, 0x5d4037, 1); g.lineBetween(cx + 55, cy - 40, cx + 55, cy + 60);
    g.fillStyle(0x00e5ff, 1); g.fillCircle(cx + 55, cy - 48, 10);
  } else if (enemy.id === 'dragon') {
    g.fillStyle(c, 1);
    g.fillTriangle(cx - 40, cy - 10, cx - 100, cy - 60, cx - 60, cy + 20);
    g.fillTriangle(cx + 40, cy - 10, cx + 100, cy - 60, cx + 60, cy + 20);
    g.fillEllipse(cx, cy + 25, 110, 70);
    g.fillCircle(cx + 45, cy - 15, 26);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(cx + 30, cy - 25, cx + 38, cy - 45, cx + 44, cy - 22);
    g.fillTriangle(cx + 52, cy - 22, cx + 58, cy - 42, cx + 64, cy - 20);
    g.fillStyle(0xffeb00, 1); g.fillCircle(cx + 52, cy - 15, 6);
    g.fillStyle(0xff9800, 1);
    g.fillTriangle(cx + 68, cy + 5, cx + 80, cy + 5, cx + 74, cy + 15);
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
