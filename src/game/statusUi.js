// ステータス画面（DOMオーバーレイ）。Tキーで開閉
import { gameState } from './state';
import { TRAITS } from '../data/traits';

export function isStatusOpen() {
  const m = document.getElementById('status-modal');
  return m && !m.classList.contains('hidden');
}

export function toggleStatus() {
  if (isStatusOpen()) closeStatus();
  else openStatus();
}

export function openStatus() {
  const p = gameState.player;
  const modal = document.getElementById('status-modal');
  const body = document.getElementById('status-body');
  if (!modal || !body) return;
  const traitLines = Object.entries(p.traits).map(([id, n]) => {
    const t = TRAITS.find((x) => x.id === id);
    const name = t ? t.name : id;
    const desc = t ? t.desc : '';
    return `<div>・${name} x${n}（${desc}）</div>`;
  }).join('') || '<div>（まだ特性なし。LvUPで獲得）</div>';
  body.innerHTML =
    `<div class="st-row">Lv ${p.lv} ／ EXP ${p.exp}/${p.next} ／ G ${p.gold}G ／ やくそう${p.herbs}個</div>` +
    `<div class="st-row">HP ${p.hp}/${p.maxHp} ／ ATK ${p.atk} ／ 守備 ${p.armor}</div>` +
    `<div class="st-row">LvUPまでEXPあと${Math.max(0, p.next - p.exp)}（約${Math.max(1, Math.ceil(Math.max(0, p.next - p.exp) / (8 + p.lv * 3)))}戦）</div>` +
    `<div class="st-head">― 特性 ―</div>${traitLines}` +
    `<div class="st-hint">Tキーで閉じる</div>`;
  modal.classList.remove('hidden');
}

export function closeStatus() {
  const modal = document.getElementById('status-modal');
  if (modal) modal.classList.add('hidden');
}
