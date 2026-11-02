# コード棚卸し（2026-11-02）

削除はしない。次に触るときの候補一覧。行番号はこの時点のもの。

## 1. 未使用の export

| 場所 | 名前 | 状態 |
|---|---|---|
| `src/next/core/state.js:154` | `healParty` | どこからも import されない（村に宿・回復がないため用途未定） |
| `src/next/core/state.js:176` | `INTEL_MAX` | `app.js` が上限 `3` を直書きしている |
| `src/next/core/battle.js:226` | `availableSkills` | 未使用（UIは `actor.skill` を直接見る） |
| `src/next/core/battle.js:23` | `actorOf` | ファイル内のみ（export 不要） |
| `src/next/core/expedition.js:5-6` | `COPPER_VALUE` / `RELIC_VALUE` | `lootGold` 内のみ（export 不要） |
| `src/next/ui/audio.js:28` | `beep` | `sfx` 経由のみ（export 不要） |

## 2. 未使用の CSS

`public/style.css` 内で、どのテンプレートからも付与されないクラス。

| 行 | セレクタ | 代替 |
|---|---|---|
| 115 | `.tag.on` | ミュートは `tag` のみ |
| 136 | `.party-list` | `roster` を使用 |
| 150 | `.member .stat` | `pstat` を使用 |
| 241 | `.enemy.hit` | 被弾は `shake` |
| 258 | `.pcard.covered` | `coverId` を描画に反映していない |
| 297 | `.overlay .retreat` | overlay の `cls` は `win`/`lose` のみ |

## 3. 数値の二重管理（バグ候補）

`state.js` の `ASCENSION` 表は**表示専用**で、実装は別計算。

| 段階 | 表の敵倍率 | 実装（HP / ATK） | 表の報酬 | 実装の報酬 |
|---|---|---|---|---|
| A1 | 1.18 | 1.18 / 1.12 | 1.2 | 1.2 |
| A2 | 1.38 | 1.36 / 1.24 | 1.45 | 1.4 |
| A3 | 1.60 | 1.54 / 1.36 | 1.7 | 1.6 |
| A4 | 1.85 | 1.72 / 1.48 | 2.0 | 1.8 |
| A5 | 2.15 | 1.90 / 1.60 | 2.4 | 2.0 |

→ A2以降で表示より弱い。`ASCENSION` を唯一の情報源にして両方そこから引くべき。

## 4. 旧DQ1前提のドキュメント（2026-10-24 の転換前に作成）

`plan/full-plan.md` / `plan/dungeons.md` / `plan/playthrough.md` / `plan/playsystem.md` /
`plan/loopsystem.md` / `plan/abstract.md` / `plan/game/materials.md` / `plan/game/worldbase.md`

現行の仕様は `plan/adventure-party.md` と `plan/battle-rework.md`。上記はアーカイブ候補（削除は判断待ち）。
`plan/memo.txt` と `docs/ref/dq1/` は履歴・参照用として残す。

## 5. その他

- `server.log`: 旧エントリ `src/index.js` のエラーが残る（gitignore済み・削除可）
- `package.json` に `"type": "module"` が無いため、Node 実行時に警告が出る
  （`webpack.config.js` が CommonJS なので、付けるなら `.cjs` へ改名が必要。`npm run sim` は警告を抑制している）
- `dist/` は gitignore 済み。古いバンドルが残っていても配信は dev server のメモリ上
