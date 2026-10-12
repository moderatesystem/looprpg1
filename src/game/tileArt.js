// fal.ai生成タイル・建物の差し替え口
// public/assets/tiles/*.png / public/assets/props/*.png を置くと自動で使用される
// （なければ手描き矩形にフォールバック。素材なしでも動作）
const FILES = {
  't-grass-a': 'assets/tiles/grass_a.png',
  't-grass-b': 'assets/tiles/grass_b.png',
  't-sand': 'assets/tiles/sand.png',
  't-water': 'assets/tiles/water.png',
  't-mountain': 'assets/tiles/mountain.png',
  't-bridge': 'assets/tiles/bridge.png',
  't-dungeon-floor': 'assets/tiles/dungeon_floor.png',
  't-dungeon-wall': 'assets/tiles/dungeon_wall.png',
  'p-tree': 'assets/props/tree.png',
  'p-castle': 'assets/props/castle.png',
  'p-house': 'assets/props/house.png',
  'p-mine': 'assets/props/mine.png',
};

export function preloadTiles(scene) {
  scene.load.on('loaderror', () => { /* 素材なしでも続行（フォールバック描画） */ });
  for (const [key, url] of Object.entries(FILES)) {
    scene.load.image(key, url);
  }
}

// 画像があれば描画してtrue、なければfalse（呼び出し側で矩形描画する）
export function putTile(scene, key, cx, cy, size) {
  if (!scene.textures.exists(key)) return false;
  const img = scene.add.image(cx, cy, key);
  img.setDisplaySize(size, size);
  return true;
}
