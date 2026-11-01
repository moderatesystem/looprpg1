// 画面（村 / 遠征ノード / 戦闘）— DOM/CSSのみ
import {
  ROSTER, loadMeta, saveMeta, SCOUT_TIERS, scoutUpgradeCost, canUpgradeScout,
  memberById, equipOf, weaponCost, armorCost, EQUIP_MAX, statsWithEquip,
  ITEMS, INTEL_COST, ASCENSION, ascensionOf, canRaiseAscension,
} from '../core/state.js';
import {
  createRun, nodeKind, NODE_LABEL, NODES,
  battleLoot, treasureLoot, addLoot, lootGold, finishRun, RESULT_LABEL,
} from '../core/expedition.js';
import { buildEncounter, scoutReport, scoutChoices } from '../core/enemies.js';
import { initBattle, resolveRound, aliveParty, aliveFoes, planRound, TACTICS } from '../core/battle.js';
import { sfx, toggleMute, isMuted } from './audio.js';

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');

let meta = loadMeta();
let run = null;
let view = 'village';
let bs = null;
let bui = null;
let overlay = null;
let tab = 'party';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (hp, max) => Math.max(0, Math.min(100, Math.round((hp / max) * 100)));

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1500);
}

function syncItems() {
  if (!bs) return;
  meta.items = { ...bs.items };
  saveMeta(meta);
}

/* ---------------- 村 ---------------- */
function hud() {
  return `<div class="hud">
    <span>日数 <b>${meta.days}</b></span>
    <span class="gold">G <b>${meta.gold}</b></span>
    <span>斥候 <b>${meta.scout}</b></span>
    <span>A <b>${meta.ascension || 0}</b></span>
    <span class="spacer"></span>
    <button class="tag" data-act="mute">${isMuted() ? '🔇 音OFF' : '🔊 音ON'}</button>
  </div>`;
}

function statLine(base, eq) {
  const s = statsWithEquip(base, eq);
  return `HP ${s.maxHp} / ATK ${s.atk} / DEF ${s.def}`;
}

function partyTab() {
  return `<div class="roster">
    ${ROSTER.map((m) => {
      const picked = meta.party.includes(m.id);
      const eq = equipOf(meta, m.id);
      const disabled = (!picked && meta.party.length >= 4) || (picked && meta.party.length <= 1);
      return `<div class="member ${picked ? 'picked' : ''}">
        <img src="${m.img}" alt="">
        <div>
          <div class="name">${m.name} <span class="role">${m.role}</span></div>
          <div class="pstat">${statLine(m, eq)}</div>
        </div>
        <button class="mini ${picked ? 'off' : ''}" data-act="toggle-member" data-id="${m.id}" ${disabled ? 'disabled' : ''}>
          ${picked ? '外す' : '入れる'}
        </button>
      </div>`;
    }).join('')}
  </div>
  <p class="hint">4人まで編成できます。外した仲間は控えになります。</p>`;
}

function gearTab() {
  const ids = meta.party.length ? meta.party : ['gald'];
  return `<div class="roster">
    ${ids.map((id) => {
      const base = memberById(id);
      if (!base) return '';
      const eq = equipOf(meta, id);
      const wc = weaponCost(eq.w);
      const ac = armorCost(eq.a);
      const wMax = eq.w >= EQUIP_MAX;
      const aMax = eq.a >= EQUIP_MAX;
      return `<div class="gear">
        <div class="gear-head">
          <img src="${base.img}" alt="">
          <div>
            <div class="name">${base.name} <span class="role">${base.role}</span></div>
            <div class="pstat">${statLine(base, eq)}</div>
          </div>
        </div>
        <div class="gear-buttons">
          <button class="mini" data-act="weapon" data-id="${id}" ${wMax || meta.gold < wc ? 'disabled' : ''}>
            武器 +${eq.w + 1}（${wMax ? '最大' : `${wc}G`}）
          </button>
          <button class="mini" data-act="armor" data-id="${id}" ${aMax || meta.gold < ac ? 'disabled' : ''}>
            防具 +${eq.a + 1}（${aMax ? '最大' : `${ac}G`}）
          </button>
        </div>
      </div>`;
    }).join('')}
  </div>
  <p class="hint">武器はATK+3、防具はHP+4・DEF+1。</p>`;
}

function itemTab() {
  return `<div class="roster">
    ${Object.values(ITEMS).map((it) => `<div class="item-row">
      <div>
        <div class="name">${it.name} <span class="role">所持 ${meta.items[it.id] || 0}</span></div>
        <div class="pstat">${it.desc}</div>
      </div>
      <button class="mini" data-act="buy-item" data-id="${it.id}" ${meta.gold < it.cost ? 'disabled' : ''}>買う（${it.cost}G）</button>
    </div>`).join('')}
  </div>
  <p class="hint">道具は戦闘中の「道具」コマンドで使えます。</p>`;
}

function infoTab() {
  const cost = scoutUpgradeCost(meta);
  const pips = [1, 2, 3, 4].map((i) => `<i class="${meta.scout >= i ? 'on' : ''}"></i>`).join('');
  const asc = ascensionOf(meta);
  const canUp = canRaiseAscension(meta);
  return `<div class="info-block">
    <div class="scout-row">
      <div class="scout-pips">${pips}</div>
      <span class="pstat">${SCOUT_TIERS[Math.min(meta.scout, 4)].label}</span>
    </div>
    <button class="btn" data-act="upgrade" ${canUpgradeScout(meta) ? '' : 'disabled'}>
      ${meta.scout >= 4 ? '斥候は最大' : `斥候を鍛える（${cost}G）`}
    </button>
  </div>
  <div class="info-block">
    <div class="name">${asc.name} <span class="role">現在 A${asc.level}</span></div>
    <div class="pstat">${asc.desc}。上げるにはこの段階での制覇が必要（制覇 ${meta.clears}回）。</div>
    <div class="btn-row">
      <button class="btn" data-act="asc-up" ${canUp ? '' : 'disabled'}>上げる</button>
      <button class="btn ghost" data-act="asc-down" ${(meta.ascension || 0) > 0 ? '' : 'disabled'}>下げる</button>
    </div>
  </div>
  <div class="info-block">
    <div class="name">情報収集 <span class="role">次の遠征 +${meta.intel || 0}</span></div>
    <div class="pstat">1回の遠征だけ斥候値を上げる（${INTEL_COST}G・最大+3）</div>
    <button class="btn" data-act="buy-intel" ${(meta.intel || 0) >= 3 || meta.gold < INTEL_COST ? 'disabled' : ''}>情報を買う（${INTEL_COST}G）</button>
  </div>
  <p class="hint">情報は出発時に消費されます。</p>`;
}

function resultBanner() {
  const r = meta.lastResult;
  if (!r) return '';
  const label = RESULT_LABEL[r.status] || r.status;
  return `<div class="panel result-line">前回：${label} / 深度${r.depth} / +${r.earned}G / ${r.days}日目（A${r.asc || 0}）</div>`;
}

function recordLine() {
  return `<div class="record-line">最深 ${meta.bestDepth} / 最大持ち帰り ${meta.bestCarry || 0}G / 制覇 ${meta.clears} / 遠征 ${meta.runs}回</div>`;
}

function villageHtml() {
  const tabs = [
    ['party', '編成'], ['gear', '装備'], ['item', '道具'], ['info', '情報'],
  ];
  const body = tab === 'party' ? partyTab() : tab === 'gear' ? gearTab() : tab === 'item' ? itemTab() : infoTab();
  return `${hud()}
  <div>
    <h1 class="title">遠征隊</h1>
    <p class="subtitle">村で整えて、坑道へ。深く潜るほど報酬も危険も増える。</p>
  </div>
  ${resultBanner()}
  ${recordLine()}
  <div class="tabs">
    ${tabs.map(([k, label]) => `<button class="tabbtn ${tab === k ? 'active' : ''}" data-act="tab" data-tab="${k}">${label}</button>`).join('')}
  </div>
  <div class="panel">${body}</div>
  <button class="btn primary" data-act="depart">坑道へ出発</button>
  <div class="footer-links">
    <a href="/bestiary.html">ずかん</a>
    <a href="/compare.html">比較</a>
    <span>F2: デバッグ</span>
  </div>`;
}

/* ---------------- 遠征 ---------------- */
function depthTrack() {
  let out = '';
  for (let i = 1; i <= NODES; i += 1) {
    const cls = i < run.node ? 'done' : i === run.node ? 'now' : '';
    const boss = i === NODES ? 'boss' : '';
    out += `<div class="dot ${cls} ${boss}">${i === NODES ? '★' : i}</div>`;
  }
  return `<div class="depth-track">${out}</div>`;
}

function lootLine() {
  return `<div class="loot-line">
    <span>銅 <b>${run.loot.copper}</b></span>
    <span>遺物 <b>${run.loot.relic}</b></span>
    <span>換金 <b>${lootGold(run)}G</b></span>
    <span>A${run.asc || 0}</span>
  </div>`;
}

function scoutBox() {
  if (!run.enc) {
    return `<div class="scout-box">
      <div class="row"><span>斥候</span><span>${SCOUT_TIERS[Math.min(run.scout, 4)].label}</span></div>
      <div class="scout-hint">ここには敵の気配はない。</div>
    </div>`;
  }
  const r = scoutReport(run.enc.foes, run.scout);
  const rows = [`<div class="row"><span>敵の数</span><span>${r.count}</span></div>`];
  if (r.names) rows.push(`<div class="row"><span>名前</span><span>${r.names.map(esc).join(' / ')}</span></div>`);
  if (r.compose) rows.push(`<div class="row"><span>構成</span><span>${r.compose.map(esc).join(' / ')}</span></div>`);
  if (r.traits) rows.push(`<div class="row"><span>特性</span><span>${r.traits.map(esc).join(' / ')}</span></div>`);
  if (r.behavior) rows.push(`<div class="row"><span>傾向</span><span>${r.behavior.map(esc).join(' / ')}</span></div>`);
  const hint = run.scout < 4
    ? `<div class="scout-hint">斥候を鍛えると構成・特性・行動傾向が見える。</div>`
    : '';
  return `<div class="scout-box">${rows.join('')}${hint}</div>`;
}

function nodeActions() {
  const k = run.kind;
  if (k === 'battle' || k === 'boss') {
    const c = scoutChoices(run.scout);
    const rows = [];
    rows.push(`<button class="btn primary" data-act="fight">戦う</button>`);
    if (c.ambush) rows.push(`<button class="btn" data-act="ambush">待ち伏せして戦う</button>`);
    if (c.weakpoint) rows.push(`<button class="btn" data-act="weak">弱点を突いて戦う</button>`);
    if (c.negotiate) rows.push(`<button class="btn" data-act="negotiate" ${meta.gold < 15 ? 'disabled' : ''}>交渉して通る（15G）</button>`);
    if (c.bypass) rows.push(`<button class="btn ghost" data-act="bypass">迂回する（戦利品なし）</button>`);
    rows.push(`<button class="btn danger" data-act="retreat">撤退して村へ</button>`);
    return `<div style="display:flex;flex-direction:column;gap:8px">${rows.join('')}</div>`;
  }
  if (run.resolved) {
    return `<button class="btn primary" data-act="next">先へ進む</button>`;
  }
  if (k === 'treasure') {
    return `<div class="btn-row">
      <button class="btn primary" data-act="open">宝箱を開ける</button>
      <button class="btn ghost" data-act="retreat">撤退</button>
    </div>`;
  }
  if (k === 'event') {
    return `<div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn" data-act="dig">掘り返す（銅+2 / 全員HP-3）</button>
      <button class="btn" data-act="rest">休む（全員HP+8）</button>
      <button class="btn ghost" data-act="retreat">撤退</button>
    </div>`;
  }
  return `<div style="display:flex;flex-direction:column;gap:8px">
    <button class="btn primary" data-act="drink">泉の水を飲む（全員HP+12）</button>
    <button class="btn ghost" data-act="retreat">撤退</button>
  </div>`;
}

function nodeHtml() {
  const label = NODE_LABEL[run.kind] || NODE_LABEL.battle;
  return `${hud()}
  <div class="panel" style="display:flex;flex-direction:column;gap:10px">
    ${depthTrack()}
    ${lootLine()}
  </div>
  <div class="panel node-card">
    <div class="node-icon">${label.icon}</div>
    <div class="node-name">${label.name}</div>
    <div class="node-desc">${label.desc}</div>
  </div>
  ${scoutBox()}
  ${nodeActions()}`;
}

/* ---------------- 戦闘 ---------------- */
function currentActor() {
  if (!bui || !bs) return null;
  return bs.party.find((p) => p.id === bui.order[bui.idx]) || null;
}

function battleHtml() {
  const back = run.node >= 3 ? 'assets/battle/cave.png' : 'assets/battle/field.png';
  const fxFor = (side, id) => (bs.fx || []).filter((f) => f.side === side && f.id === id);
  const hitIds = new Set((bs.fx || []).filter((f) => f.kind === 'dmg').map((f) => `${f.side}:${f.id}`));
  const foes = bs.foes.map((f) => `
    <div class="enemy ${f.hp <= 0 ? 'dead' : ''} ${bui.targetId === f.id ? 'selected' : ''} ${f.hp > 0 ? 'selectable' : ''} ${hitIds.has(`foe:${f.id}`) ? 'shake' : ''}"
         data-act="target" data-id="${f.id}">
      <img src="${f.img}" alt="">
      <div class="ename">${esc(f.name)}</div>
      <div class="ehp"><i style="width:${pct(f.hp, f.maxHp)}%"></i></div>
      ${fxFor('foe', f.id).map((x) => `<div class="dmg-float">${x.kind === 'heal' ? '+' : '-'}${x.dmg}</div>`).join('')}
    </div>`).join('');

  const party = bs.party.map((p) => `
    <div class="pcard ${p.hp <= 0 ? 'down' : ''} ${currentActor() && currentActor().id === p.id ? 'active' : ''} ${hitIds.has(`party:${p.id}`) ? 'shake' : ''}">
      <img src="${p.img}" alt="">
      <div>
        <div class="pname">${p.name}</div>
        <div class="bar ${p.hp / p.maxHp <= 0.3 ? 'low' : ''}"><i style="width:${pct(p.hp, p.maxHp)}%"></i></div>
        <div class="pstat">HP ${p.hp}/${p.maxHp}${p.skill && p.skill.id !== 'cover' ? ` ・技${p.skillUses}` : ''}</div>
      </div>
      ${fxFor('party', p.id).map((x) => `<div class="dmg-float ${x.kind === 'heal' ? 'heal' : ''}">${x.kind === 'heal' ? '+' : '-'}${x.dmg}</div>`).join('')}
    </div>`).join('');

  const actor = currentActor();
  const skill = actor && actor.skill;
  const skillDisabled = !skill || (skill.id !== 'cover' && skill.id !== 'taunt' && actor.skillUses <= 0);
  const tactic = TACTICS.find((t) => t.id === bui.tactic) || TACTICS[0];
  const manual = bui.tactic === 'manual';
  const canBack = bui.idx > 0;

  return `<div class="stage">
    <img class="backdrop" src="${back}" alt="">
    <div class="enemies">${foes}</div>
  </div>

  <div class="battle-party">${party}</div>

  <div class="log">${bs.log.map((l) => `<div>${esc(l)}</div>`).join('')}</div>

  <div class="actor-line">
    R${bs.round} ${actor ? `${actor.name} の番（${bui.idx + 1}/${bui.order.length}）` : '解決中…'}
    <small>${manual ? '敵をタップで対象選択' : '作戦実行でラウンドを進めます'}</small>
  </div>

  <div class="party-cmd">
    <button class="btn" data-act="tactic">作戦: ${tactic.name}</button>
    <button class="btn" data-act="auto" ${manual || !actor ? 'disabled' : ''}>作戦実行</button>
    <button class="btn danger" data-act="battle-retreat" ${actor ? '' : 'disabled'}>撤退</button>
  </div>
  <div class="tactic-desc">${tactic.desc}</div>

  ${manual ? `<div class="cmd-grid">
    <button class="btn" data-act="attack" ${actor ? '' : 'disabled'}>攻撃</button>
    <button class="btn" data-act="skill" ${actor && !skillDisabled ? '' : 'disabled'}>
      ${skill ? `${skill.name}${skill.id === 'cover' || skill.id === 'taunt' ? '' : `（${actor && actor.skillUses}）`}` : '技'}
    </button>
    <button class="btn" data-act="item" ${actor ? '' : 'disabled'}>道具</button>
    <button class="btn" data-act="guard" ${actor ? '' : 'disabled'}>防御</button>
    <button class="btn ghost span2" data-act="undo" ${canBack ? '' : 'disabled'}>戻る</button>
  </div>` : ''}`;
}

/* ---------------- オーバーレイ ---------------- */
function overlayHtml() {
  if (!overlay) return '';
  const acts = overlay.acts.map((a) => `<button class="btn ${a.cls || ''}" data-act="${a.act}" ${a.item ? `data-item="${a.item}"` : ''} ${a.disabled ? 'disabled' : ''}>${a.label}</button>`).join('');
  return `<div class="overlay"><div class="sheet">
    <h3 class="${overlay.cls || ''}">${overlay.title}</h3>
    <p>${overlay.text}</p>
    <div style="display:flex;flex-direction:column;gap:8px">${acts}</div>
  </div></div>`;
}

function render() {
  let html = '';
  if (view === 'village') html = villageHtml();
  else if (view === 'node') html = nodeHtml();
  else if (view === 'battle') html = battleHtml();
  app.innerHTML = html + overlayHtml();
}

/* ---------------- 進行 ---------------- */
function goVillage(status) {
  if (bs) syncItems();
  if (run) {
    meta = finishRun(meta, run, { status });
    saveMeta(meta);
  }
  run = null;
  bs = null;
  bui = null;
  overlay = null;
  view = 'village';
  render();
}

function enterNode() {
  if (!run) return;
  run.kind = run.node >= NODES ? 'boss' : nodeKind(run);
  run.enc = (run.kind === 'battle' || run.kind === 'boss') ? buildEncounter(run.node, run.kind === 'boss', run.asc || 0) : null;
  run.resolved = false;
  view = 'node';
  overlay = null;
  render();
  sfx('step');
}

function startRun() {
  run = createRun(meta);
  if (meta.intel) {
    meta.intel = 0;
    saveMeta(meta);
  }
  enterNode();
}

function nextNode() {
  run.node += 1;
  if (run.node > NODES) { goVillage('retreat'); return; }
  enterNode();
}

function beginBattle(opts = {}) {
  bs = initBattle({ party: run.party, foes: run.enc.foes, opts, items: meta.items });
  bui = {
    order: aliveParty(bs).map((p) => p.id),
    idx: 0,
    actions: [],
    targetId: (aliveFoes(bs)[0] || {}).id,
    tactic: 'manual',
  };
  view = 'battle';
  render();
}

function afterRound(res) {
  syncItems();
  if (res.status === 'win') {
    const isBoss = run.kind === 'boss';
    if (!isBoss) addLoot(run, battleLoot(run.node, run.asc || 0));
    run.party = bs.party.map((p) => ({ ...p, guard: false }));
    sfx('win');
    overlay = {
      title: isBoss ? '深部の主を倒した' : '勝利',
      cls: 'win',
      text: isBoss
        ? `遠征成功！ 持ち帰り ${lootGold(run)}G（${run.node}層・A${run.asc || 0}）`
        : `戦利品を手に入れた（銅 ${run.loot.copper} / 遺物 ${run.loot.relic}）`,
      acts: [{ act: 'overlay-continue', label: isBoss ? '村へ帰還' : '先へ進む', cls: 'primary' }],
    };
    if (isBoss) run.bossDefeated = true;
    render();
    return;
  }
  if (res.status === 'lose') {
    run.party = bs.party;
    sfx('lose');
    overlay = {
      title: '全滅',
      cls: 'lose',
      text: `持ち帰れたのは ${Math.floor(lootGold(run) * 0.3)}G だけだった…`,
      acts: [{ act: 'overlay-return', label: '村へ戻る', cls: 'danger' }],
    };
    render();
    return;
  }
  bui.order = aliveParty(bs).map((p) => p.id);
  bui.idx = 0;
  bui.actions = [];
  if (!bs.foes.some((f) => f.id === bui.targetId && f.hp > 0)) {
    bui.targetId = (aliveFoes(bs)[0] || {}).id;
  }
  render();
}

function commitAction(action) {
  const actor = currentActor();
  if (!actor || !bs) return;
  bui.actions.push({ actorId: actor.id, ...action });
  bui.idx += 1;
  if (bui.idx >= bui.order.length) {
    const res = resolveRound(bs, bui.actions);
    afterRound(res);
  } else {
    render();
  }
}

function runAuto() {
  if (!bs || !bui || bui.tactic === 'manual') return;
  const actions = planRound(bs, bui.tactic);
  bui.actions = actions;
  const res = resolveRound(bs, actions);
  afterRound(res);
}

/* ---------------- 入力 ---------------- */
function onAct(act, el) {
  sfx('click');
  if (act === 'mute') { toggleMute(); render(); return; }

  if (view === 'village') {
    if (act === 'tab') { tab = el.dataset.tab; render(); return; }
    if (act === 'toggle-member') {
      const id = el.dataset.id;
      const i = meta.party.indexOf(id);
      if (i >= 0) {
        if (meta.party.length <= 1) { toast('最低1人は必要'); return; }
        meta.party.splice(i, 1);
      } else {
        if (meta.party.length >= 4) { toast('4人まで'); return; }
        meta.party.push(id);
      }
      saveMeta(meta);
      render();
      return;
    }
    if (act === 'weapon' || act === 'armor') {
      const id = el.dataset.id;
      const eq = { ...equipOf(meta, id) };
      const level = act === 'weapon' ? eq.w : eq.a;
      const cost = act === 'weapon' ? weaponCost(level) : armorCost(level);
      if (level >= EQUIP_MAX) return;
      if (meta.gold < cost) { toast('Gが足りない'); return; }
      meta.gold -= cost;
      if (act === 'weapon') eq.w += 1; else eq.a += 1;
      meta.equip[id] = eq;
      saveMeta(meta);
      sfx('heal');
      toast(act === 'weapon' ? '武器を強化した' : '防具を強化した');
      render();
      return;
    }
    if (act === 'buy-item') {
      const it = ITEMS[el.dataset.id];
      if (!it || meta.gold < it.cost) { toast('Gが足りない'); return; }
      meta.gold -= it.cost;
      meta.items[it.id] = (meta.items[it.id] || 0) + 1;
      saveMeta(meta);
      toast(`${it.name}を買った`);
      render();
      return;
    }
    if (act === 'buy-intel') {
      if (meta.gold < INTEL_COST || (meta.intel || 0) >= 3) return;
      meta.gold -= INTEL_COST;
      meta.intel = (meta.intel || 0) + 1;
      saveMeta(meta);
      toast('情報を買った（次の遠征）');
      render();
      return;
    }
    if (act === 'asc-up') {
      if (!canRaiseAscension(meta)) { toast('制覇が足りない'); return; }
      meta.ascension = Math.min(5, (meta.ascension || 0) + 1);
      saveMeta(meta);
      sfx('skill');
      toast(`${ASCENSION[meta.ascension].name}へ`);
      render();
      return;
    }
    if (act === 'asc-down') {
      if ((meta.ascension || 0) <= 0) return;
      meta.ascension -= 1;
      saveMeta(meta);
      toast(`${ASCENSION[meta.ascension].name}へ`);
      render();
      return;
    }
    if (act === 'upgrade') {
      const cost = scoutUpgradeCost(meta);
      if (!canUpgradeScout(meta)) { toast('Gが足りない'); return; }
      meta.gold -= cost;
      meta.scout += 1;
      saveMeta(meta);
      sfx('heal');
      toast(`斥候を鍛えた（${meta.scout}）`);
      render();
      return;
    }
    if (act === 'depart') { startRun(); return; }
  }

  if (view === 'node') {
    if (act === 'fight') { beginBattle(); return; }
    if (act === 'ambush') { beginBattle({ ambush: true }); return; }
    if (act === 'weak') { beginBattle({ weakpoint: true }); return; }
    if (act === 'negotiate') {
      if (meta.gold < 15) { toast('Gが足りない'); return; }
      meta.gold -= 15; saveMeta(meta);
      toast('供物を渡して通してもらった');
      run.resolved = true; render(); return;
    }
    if (act === 'bypass') {
      toast('遠回りして敵を避けた');
      run.resolved = true; render(); return;
    }
    if (act === 'next') { nextNode(); return; }
    if (act === 'retreat') { goVillage('retreat'); return; }
    if (act === 'open') {
      addLoot(run, treasureLoot(run.asc || 0));
      run.resolved = true; sfx('skill');
      toast('宝箱を開けた'); render(); return;
    }
    if (act === 'dig') {
      addLoot(run, { copper: 2, relic: 0 });
      for (const p of run.party) p.hp = Math.max(1, p.hp - 3);
      run.resolved = true; sfx('hit'); toast('銅を掘り当てた'); render(); return;
    }
    if (act === 'rest') {
      for (const p of run.party) p.hp = Math.min(p.maxHp, p.hp + 8);
      run.resolved = true; sfx('heal'); toast('少し休んだ'); render(); return;
    }
    if (act === 'drink') {
      for (const p of run.party) p.hp = Math.min(p.maxHp, p.hp + 12);
      run.resolved = true; sfx('heal'); toast('泉の水で回復した'); render(); return;
    }
  }

  if (view === 'battle') {
    const actor = currentActor();

    if (act === 'tactic') {
      const i = TACTICS.findIndex((t) => t.id === bui.tactic);
      bui.tactic = TACTICS[(i + 1) % TACTICS.length].id;
      bui.idx = 0;
      bui.actions = [];
      render();
      return;
    }
    if (act === 'auto') { runAuto(); return; }
    if (act === 'undo') {
      if (bui.idx <= 0) return;
      bui.idx -= 1;
      bui.actions.pop();
      render();
      return;
    }
    if (act === 'item') {
      overlay = {
        title: '道具',
        text: `やくそう ${bs.items.herb || 0} ／ 気付け薬 ${bs.items.revive || 0}`,
        acts: [
          { act: 'use-item', item: 'herb', label: `やくそう（${bs.items.herb || 0}）`, disabled: (bs.items.herb || 0) <= 0 },
          { act: 'use-item', item: 'revive', label: `気付け薬（${bs.items.revive || 0}）`, disabled: (bs.items.revive || 0) <= 0 },
          { act: 'close-item', label: 'やめる', cls: 'ghost' },
        ],
      };
      render();
      return;
    }
    if (act === 'use-item') {
      const item = el.dataset.item;
      overlay = null;
      commitAction({ type: 'item', itemId: item });
      return;
    }
    if (act === 'close-item') { overlay = null; render(); return; }

    if (act === 'target') {
      const id = el.dataset.id;
      const foe = bs.foes.find((f) => f.id === id);
      if (foe && foe.hp > 0) { bui.targetId = id; render(); }
      return;
    }
    if (act === 'attack') {
      if (!actor) return;
      commitAction({ type: 'attack', targetId: bui.targetId });
      sfx('hit');
      return;
    }
    if (act === 'guard') {
      if (!actor) return;
      commitAction({ type: 'guard' });
      return;
    }
    if (act === 'skill') {
      if (!actor || !actor.skill) return;
      const s = actor.skill;
      if (s.id !== 'cover' && s.id !== 'taunt' && actor.skillUses <= 0) { toast('技の残りがない'); return; }
      if (s.id === 'heal') {
        commitAction({ type: 'skill', skillId: 'heal' });
        sfx('heal');
      } else {
        commitAction({ type: 'skill', skillId: s.id, targetId: bui.targetId });
        sfx('skill');
      }
      return;
    }
    if (act === 'battle-retreat') {
      const half = Math.floor(lootGold(run) / 2);
      run.loot.copper = Math.floor(run.loot.copper / 2);
      run.loot.relic = Math.floor(run.loot.relic / 2);
      toast(`撤退した（${half}G分は置いてきた）`);
      goVillage('retreat');
      return;
    }
  }

  if (act === 'overlay-continue') {
    overlay = null;
    if (run.bossDefeated) { goVillage('win'); return; }
    nextNode();
    return;
  }
  if (act === 'overlay-return') {
    overlay = null;
    goVillage('lose');
  }
}

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  e.preventDefault();
  onAct(el.dataset.act, el);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') { toggleMute(); render(); }
});

window.addEventListener('app:refresh', () => {
  meta = loadMeta();
  render();
});

window.addEventListener('app:heal', () => {
  if (run) {
    for (const p of run.party) p.hp = p.maxHp;
    toast('パーティを全回復した');
    render();
  } else {
    toast('遠征中のみ回復できます');
  }
});

const qTab = new URLSearchParams(location.search).get('tab');
if (['party', 'gear', 'item', 'info'].includes(qTab)) tab = qTab;

render();

// 動作確認用ジャンプ（?jump=battle / ?jump=node / ?jump=nodebattle）
const jump = new URLSearchParams(location.search).get('jump');
if (jump === 'battle' || jump === 'node' || jump === 'nodebattle') {
  startRun();
  if (run) {
    if (jump === 'battle' || jump === 'nodebattle') {
      run.kind = 'battle';
      run.enc = buildEncounter(run.node, false, run.asc || 0);
      run.resolved = false;
      if (jump === 'battle') beginBattle();
      else { view = 'node'; overlay = null; render(); }
    }
  }
}
