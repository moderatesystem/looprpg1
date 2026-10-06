// DQ1式エリア分割の簡略版
// 本家は8x8=64テリトリー（各15x15マス）＋テリトリー毎に5種の遭遇表。
// 本作30x30に合わせて3x3=9テリトリー（各10x10マス）に落とし込む。
// 城のある西を安全、洞窟のある北東を危険にする勾配＋橋ゲートで警告する。
export const REGION_COLS = 3;
export const REGION_ROWS = 3;
export const REGION_W = 10;
export const REGION_H = 10;

// lv: エリアレベル（高いほど強い）。pool: 出現5種（DQ式・重み付き順）。
// tone: 地面タイルへの色補正 [r,g,b]。西=安全な緑、東=枯れた大地、北東=禍々しい紫
export const REGIONS = [
  // y 0-9（北）
  { id: 'A1', col: 0, row: 0, lv: 0, name: '城周辺', tone: [10, 10, 0], pool: ['slime', 'slime', 'bat', 'bat', 'goblin'] },
  { id: 'A2', col: 1, row: 0, lv: 1, name: '北の森', tone: [0, 12, 0], pool: ['slime', 'bat', 'goblin', 'wolf', 'ghost'] },
  { id: 'A3', col: 2, row: 0, lv: 4, name: '洞窟周辺', tone: [18, -6, 18], pool: ['ghost', 'skeleton', 'golem', 'mage', 'dragon'] },
  // y 10-19（中央）
  { id: 'B1', col: 0, row: 1, lv: 1, name: '西の街道', tone: [8, 8, 0], pool: ['slime', 'bat', 'goblin', 'wolf', 'ghost'] },
  { id: 'B2', col: 1, row: 1, lv: 1, name: '中央平原', tone: [0, 0, 0], pool: ['slime', 'bat', 'goblin', 'wolf', 'ghost'] },
  { id: 'B3', col: 2, row: 1, lv: 3, name: '東の荒野', tone: [20, -4, -10], pool: ['goblin', 'wolf', 'ghost', 'skeleton', 'orc'] },
  // y 20-29（南）
  { id: 'C1', col: 0, row: 2, lv: 2, name: '南の村周辺', tone: [0, 6, 6], pool: ['bat', 'goblin', 'wolf', 'ghost', 'skeleton'] },
  { id: 'C2', col: 1, row: 2, lv: 2, name: '南の街道', tone: [6, 0, 0], pool: ['bat', 'goblin', 'wolf', 'ghost', 'skeleton'] },
  { id: 'C3', col: 2, row: 2, lv: 3, name: '南東の辺境', tone: [16, -8, 6], pool: ['goblin', 'wolf', 'ghost', 'orc', 'golem'] },
];

export function regionAt(x, y) {
  const col = Math.max(0, Math.min(REGION_COLS - 1, Math.floor(x / REGION_W)));
  const row = Math.max(0, Math.min(REGION_ROWS - 1, Math.floor(y / REGION_H)));
  return REGIONS.find((r) => r.col === col && r.row === row);
}

// エリアレベル→危険度（旧regionDanger相当）。0.6〜1.4
export function regionDanger(region) {
  if (!region) return 1;
  return 0.6 + region.lv * 0.2;
}
