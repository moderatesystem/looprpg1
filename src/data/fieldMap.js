// Phase2: 30x30ワールドマップ。凡例は plan/game/worldbase.md 参照
// #:山(不可) .:草原 T:森 ~:水(不可) +:橋 ::砂浜 C:城 V:村 D:洞窟 S:開始位置
export const FIELD_MAP = [
  "##############################",
  "#....TT...:~++~:...D.........#",
  "#...TT...:~~~~:..............#",
  "#.......TTTT......##.........#",
  "#.......TTTT.....##..........#",
  "#...##...........TT....##....#",
  "#...##..TT........TT...##....#",
  "#...##..TT..V.....TT...##....#",
  "#........TT.......TT...##....#",
  "#...TT....................####",
  "#...TT...##......~~~~.......##",
  "#........##.....:~~~~:......##",
  "#..##....##.....:~~~~:......##",
  "#..##.......................##",
  "#..##.......SC..............##",
  "#.........V.................##",
  "#..~~~~~:...................##",
  "#..~~~~~:...TT..............##",
  "#..~~~~~:...TT.....V........##",
  "#............TT.....##......##",
  "#............TT.....##......##",
  "#.....TT..........##........##",
  "#.....TT....................##",
  "#.........##................##",
  "#.........##.....TT.........##",
  "#..V......##.....TT.........##",
  "#................TT.........##",
  "#............................#",
  "#............................#",
  "##############################",
];

export const CAMP_START = { x: 12, y: 14 };

export function findTile(map, ch) {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] === ch) return { x, y };
    }
  }
  return null;
}

export function findAllTiles(map, ch) {
  const out = [];
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] === ch) out.push({ x, y });
    }
  }
  return out;
}

// BFSで到達可能か（テキストマップ検証用）
export function isReachable(map, sx, sy, tx, ty) {
  const passable = new Set([".", "T", ":", "+", "C", "V", "D", "S"]);
  const h = map.length;
  const w = map[0].length;
  const seen = new Set([`${sx},${sy}`]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (seen.has(`${nx},${ny}`)) continue;
      if (!passable.has(map[ny][nx])) continue;
      seen.add(`${nx},${ny}`);
      q.push([nx, ny]);
    }
  }
  return false;
}
