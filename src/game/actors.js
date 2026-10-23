// キャラクター（主人公・NPC）の共通描画／移動モーション
// 静止画像1枚から、歩行スライド・着地のつぶれ・待機の呼吸・左右反転・接地影を作る
import Phaser from 'phaser';

const SHADOW_TEX = '__actor-shadow';
const PROP_SHADOW_TEX = '__prop-shadow';

export function ensureActorTextures(scene) {
  if (!scene.textures.exists(SHADOW_TEX)) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0x000000, 1);
    g.fillEllipse(64, 64, 122, 46);
    g.generateTexture(SHADOW_TEX, 128, 128);
    g.destroy();
  }
  if (!scene.textures.exists(PROP_SHADOW_TEX)) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0x000000, 1);
    g.fillEllipse(128, 128, 244, 86);
    g.generateTexture(PROP_SHADOW_TEX, 256, 256);
    g.destroy();
  }
}

// 建物・木・岩などの接地影（静止オブジェクト用）
export function addPropShadow(scene, cx, bottomY, width, alpha = 0.30) {
  if (!scene.textures.exists(PROP_SHADOW_TEX)) ensureActorTextures(scene);
  return scene.add.image(cx, bottomY, PROP_SHADOW_TEX)
    .setDisplaySize(width, width * 0.28)
    .setAlpha(alpha)
    .setDepth(bottomY - 2);
}

// キャラクター生成。px,py は「立っているマスの中心」のピクセル座標
// 画像は足元が接地するよう原点を下端にし、接地影を足元へ密着させる
export function createActor(scene, px, py, key, size = 46) {
  ensureActorTextures(scene);
  const groundY = py + size * 0.40;
  const shadow = scene.add.image(px, groundY - 1, SHADOW_TEX)
    .setDisplaySize(size * 0.62, size * 0.20)
    .setAlpha(0.42)
    .setDepth(groundY - 2);
  const img = scene.add.image(px, groundY, key).setOrigin(0.5, 1);
  img.setScale(size / img.height);
  img.setDepth(groundY - 1);
  const actor = { img, shadow, size, px, py, groundY, label: null };
  startIdle(scene, actor);
  return actor;
}

function stopIdle(actor) {
  if (actor.idle) { actor.idle.stop(); actor.idle = null; }
}

export function startIdle(scene, actor) {
  stopIdle(actor);
  const base = actor.groundY;
  actor.idle = scene.tweens.add({
    targets: actor.img,
    y: base - 1.2,
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

export function faceActor(actor, dx) {
  if (!dx) return;
  actor.img.setFlipX(dx < 0);
}

export function destroyActor(actor) {
  if (!actor) return;
  stopIdle(actor);
  if (actor.img) actor.img.destroy();
  if (actor.shadow) actor.shadow.destroy();
  if (actor.label) actor.label.destroy();
}

export function setActorLabel(scene, actor, text, size = 46) {
  if (!actor) return;
  if (actor.label) actor.label.destroy();
  actor.label = scene.add.text(actor.px - 18, actor.py - size * 0.98, text, {
    fontSize: '12px', color: '#fff', backgroundColor: '#000000cc',
    padding: { x: 3, y: 1 }, fontFamily: "'DotGothic16', monospace",
  }).setDepth(9000);
}

// 1マス分を滑らかに移動。dx,dy は移動方向（向き反転に使用）
export function moveActor(scene, actor, px, py, dx, dy, duration = 140, onDone = null) {
  if (!actor) return;
  actor.px = px; actor.py = py;
  faceActor(actor, dx);
  stopIdle(actor);
  const { img, shadow, label, size } = actor;
  const groundY = py + size * 0.40;
  actor.groundY = groundY;
  scene.tweens.killTweensOf([img, shadow, label].filter(Boolean));
  img.setDepth(groundY - 1);
  shadow.setDepth(groundY - 2);
  scene.tweens.add({ targets: shadow, x: px, y: groundY - 1, duration, ease: 'Sine.easeInOut' });
  if (label) scene.tweens.add({ targets: label, x: px - 18, y: py - size * 0.98, duration, ease: 'Sine.easeInOut' });
  // 歩幅のつぶれ（接地で少し潰れ、持ち上がりで伸びる）
  const sx = Math.abs(img.scaleX) || 1;
  const sy = Math.abs(img.scaleY) || 1;
  scene.tweens.add({
    targets: img,
    x: px,
    y: groundY,
    duration,
    ease: 'Sine.easeInOut',
    onComplete: () => {
      img.y = groundY;
      img.setScale(sx, sy);
      startIdle(scene, actor);
      if (onDone) onDone();
    },
  });
  scene.tweens.add({
    targets: img,
    scaleY: sy * 1.06,
    scaleX: sx * 0.96,
    duration: duration * 0.45,
    yoyo: true,
    ease: 'Sine.easeInOut',
    onComplete: () => { img.setScale(sx, sy); },
  });
}

// その場で一歩も動かず向きだけ変える（会話時など）
export function turnTo(fromActor, targetActor) {
  if (!fromActor || !targetActor) return;
  faceActor(fromActor, targetActor.px - fromActor.px);
}

// NPCの散策AI。entries: [{ npc, actor }]
// opts: { tileAt(x,y), isFree(x,y), radius, canAct() }
export function setupWander(scene, entries, opts) {
  const radius = opts.radius ?? 3;
  const tile = opts.tileSize ?? 64;
  for (const { npc, actor } of entries) {
    if (!actor) continue;
    const home = { x: npc.x, y: npc.y };
    const delay = 900 + Math.random() * 1800;
    npc._wander = scene.time.addEvent({
      delay,
      loop: true,
      callback: () => {
        if (!opts.canAct || !opts.canAct()) return;
        if (Math.random() < 0.35) { // ときどき立ち止まる
          faceActor(actor, Math.random() < 0.5 ? -1 : 1);
          return;
        }
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5);
        for (const [dx, dy] of dirs) {
          const tx = npc.x + dx, ty = npc.y + dy;
          if (Math.abs(tx - home.x) > radius || Math.abs(ty - home.y) > radius) continue;
          const ch = opts.tileAt(tx, ty);
          if (ch == null || !isWalkableTile(ch)) continue;
          if (opts.isFree && !opts.isFree(tx, ty)) continue;
          npc.x = tx; npc.y = ty;
          moveActor(scene, actor, tx * tile + tile / 2, ty * tile + tile / 2, dx, dy, 260);
          return;
        }
        faceActor(actor, Math.random() < 0.5 ? -1 : 1);
      },
    });
  }
}

export function stopWander(entries) {
  for (const { npc } of entries) {
    if (npc._wander) { npc._wander.remove(); npc._wander = null; }
  }
}

function isWalkableTile(ch) {
  return ['.', 'T', ':', '+', 'S', 'C', 'V', 'D', 'K', 'B'].includes(ch);
}

// シーン終了時にタイマーを掃除
export function disposeWander(scene, entries) {
  stopWander(entries || []);
  scene.events.once('shutdown', () => stopWander(entries || []));
}
