// fal.ai生成タイル・建物の差し替え口
// public/assets/tiles/*.png / public/assets/props/*.png / public/assets/decals/*.png を置くと自動で使用される
// （なければ手描き矩形にフォールバック。素材なしでも動作）
import { addPropShadow } from './actors';

const FILES = {
  't-grass': 'assets/tiles/grass_base.png',
  't-grass-a': 'assets/tiles/grass_a.png',
  't-grass-b': 'assets/tiles/grass_b.png',
  't-sand': 'assets/tiles/sand_base.png',
  't-water': 'assets/tiles/water.png',
  't-bridge': 'assets/tiles/bridge.png',
  't-dungeon-floor': 'assets/tiles/dungeon_floor.png',
  't-dungeon-wall': 'assets/tiles/dungeon_wall.png',
  't-castle-floor': 'assets/tiles/castle_floor.png',
  't-castle-wall': 'assets/tiles/castle_wall.png',
  't-demon': 'assets/tiles/demon.png',
  'p-tree': 'assets/props/tree.png',
  'p-tree-pine': 'assets/props/tree_pine.png',
  'p-rock-mountain': 'assets/props/rock_mountain.png',
  'p-castle': 'assets/props/castle.png',
  'p-house': 'assets/props/house.png',
  'p-mine': 'assets/props/mine.png',
  'p-pot': 'assets/props/pot.png',
  'p-sign': 'assets/props/sign.png',
  'p-throne': 'assets/props/throne.png',
  'p-fountain': 'assets/props/fountain.png',
  'd-flower-a': 'assets/decals/flower_a.png',
  'd-flower-b': 'assets/decals/flower_b.png',
  'd-tuft': 'assets/decals/tuft.png',
  'd-stone': 'assets/decals/stone.png',
  'b-field': 'assets/battle/field.png',
  'b-forest': 'assets/battle/forest.png',
  'b-cave': 'assets/battle/cave.png',
};

export function preloadTiles(scene) {
  scene.load.on('loaderror', () => { /* 素材なしでも続行（フォールバック描画） */ });
  for (const [key, url] of Object.entries(FILES)) {
    scene.load.image(key, url);
  }
}

// 斜め縞を出さない整数ハッシュ（x*a+y*b の線形和は斜め模様になるため）
export function tileHash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// 画像があれば描画して画像を返す、なければnull（呼び出し側で矩形描画する）
export function putTile(scene, key, cx, cy, size) {
  if (!scene.textures.exists(key)) return null;
  const img = scene.add.image(cx, cy, key);
  img.setDisplaySize(size, size);
  return img;
}

// 地面上に置く立体オブジェクト（木・岩山・建物）。足元基準で接地影つき
export function putObject(scene, key, cx, bottomY, size, opts = {}) {
  if (!scene.textures.exists(key)) return null;
  const depth = bottomY + (opts.depthOffset || 0);
  const shadowW = size * (opts.shadowScale ?? 0.62);
  addPropShadow(scene, cx, bottomY - size * 0.02, shadowW).setDepth(depth - 2);
  const img = scene.add.image(cx, bottomY, key).setOrigin(0.5, 1);
  img.setDisplaySize(size, size);
  img.setDepth(depth);
  return img;
}
