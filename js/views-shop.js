/* =========================================================================
   views-shop.js — магазин: собственные награды за золото, зелья,
   питомцы за кристаллы и инвентарь
   ========================================================================= */

const REWARD_IDEAS = [
  { title: 'Серия любимого сериала', icon: '📺', cost: 40 },
  { title: 'Час игры без чувства вины', icon: '🎮', cost: 60 },
  { title: 'Доставка вкусной еды', icon: '🍕', cost: 120 },
  { title: 'Выходной без будильника', icon: '😴', cost: 200 },
  { title: 'Покупка для себя', icon: '🛍️', cost: 300 },
];

function renderShop() {
  const p = state.player;

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Магазин</h1>
        <p class="page-sub">Золото зарабатывается делами и тратится на настоящие удовольствия. Это и есть главный трюк геймификации: сначала дело, потом награда.</p>
      </div>
      <div class="head-actions">
        <span class="cur-chip gold big">🪙 ${fmtNum(p.gold)}</span>
        <span class="cur-chip gem big">💎 ${fmtNum(p.gems)}</span>
      </div>
    </div>

    <div class="section-label">Мои награды <button class="btn primary small" id="addReward" style="margin-left:8px;">＋ Добавить</button></div>
    <div class="grid cols-3" id="rewardGrid"></div>

    <div class="section-label">Расходники</div>
    <div class="grid cols-3" id="itemGrid"></div>

    <div class="section-label">Инвентарь</div>
    <div class="grid cols-3" id="invGrid"></div>

    <div class="section-label">Питомцы за кристаллы</div>
    <p class="text-dim" style="font-size:13px;margin:-4px 0 12px;">Кристаллы выдаются за достижения и победы над боссами. Питомец даёт постоянный бонус, а откормленный — вдвое больший.</p>
    <div class="grid cols-3" id="petShop"></div>`;

  document.getElementById('addReward').addEventListener('click', () => openRewardForm());

  renderRewardGrid();
  renderItemGrid();
  renderInventory();
  renderPetShop();
}

/* ---- Пользовательские награды -------------------------------------------- */
function renderRewardGrid() {
  const wrap = document.getElementById('rewardGrid');
  if (!state.rewards.length) {
    wrap.innerHTML = `<div class="card" style="grid-column:1/-1;">
      <div class="card-title">Награды ещё не заданы</div>
      <p class="text-dim" style="font-size:13.5px;margin:0 0 14px;">Придумай, что будешь «покупать» за заработанное золото. Идеи для старта:</p>
      <div class="idea-row">
        ${REWARD_IDEAS.map((r, i) => `<button class="btn small" data-idea="${i}">${r.icon} ${esc(r.title)} · ${r.cost} 🪙</button>`).join('')}
      </div>
    </div>`;
    wrap.querySelectorAll('[data-idea]').forEach(b => b.addEventListener('click', () => {
      const idea = REWARD_IDEAS[Number(b.dataset.idea)];
      mutate(() => state.rewards.push({ id: uid(), ...idea, timesBought: 0, createdAt: nowISO() }));
    }));
    return;
  }

  wrap.innerHTML = state.rewards.map(r => {
    const afford = state.player.gold >= r.cost;
    return `<div class="card reward-card ${afford ? '' : 'poor'}">
      <div class="reward-ic">${esc(r.icon || '🎁')}</div>
      <div class="reward-title">${esc(r.title)}</div>
      ${r.timesBought ? `<div class="chip">куплено ${r.timesBought} ${plural(r.timesBought, 'раз', 'раза', 'раз')}</div>` : ''}
      <button class="btn ${afford ? 'primary' : ''} small mt8 wfull" data-buy-reward="${r.id}" ${afford ? '' : 'disabled'}>
        Купить · ${fmtNum(r.cost)} 🪙
      </button>
      <div class="reward-edit">
        <button class="btn ghost small icon-only" data-reward-edit="${r.id}" title="Изменить">✎</button>
        <button class="btn ghost small icon-only danger-text" data-reward-del="${r.id}" title="Удалить">✕</button>
      </div>
    </div>`;
  }).join('');

  wrap.querySelectorAll('[data-buy-reward]').forEach(b => b.addEventListener('click', () => buyReward(b.dataset.buyReward)));
  wrap.querySelectorAll('[data-reward-edit]').forEach(b => b.addEventListener('click', () => openRewardForm(b.dataset.rewardEdit)));
  wrap.querySelectorAll('[data-reward-del]').forEach(b => b.addEventListener('click', () => {
    const r = state.rewards.find(x => x.id === b.dataset.rewardDel);
    confirmAction(`Удалить награду «${r ? r.title : ''}»?`, () =>
      mutate(() => { state.rewards = state.rewards.filter(x => x.id !== b.dataset.rewardDel); }));
  }));
}

function buyReward(id) {
  mutate(() => {
    const r = state.rewards.find(x => x.id === id);
    if (!r || state.player.gold < r.cost) return;
    state.player.gold -= r.cost;
    r.timesBought = (r.timesBought || 0) + 1;
    addLog('🎁', `Куплена награда: ${r.title} (−${r.cost} 🪙)`);
    toast(`🎁 ${r.title} — заслужено, иди получай!`, 'green');
    SFX.coin();
    confetti(40);
  });
}

function openRewardForm(id) {
  const existing = id ? state.rewards.find(x => x.id === id) : null;
  const r = existing || {};
  openModal(existing ? 'Изменить награду' : 'Новая награда', `
    <form id="rewardForm" class="form-grid">
      <label class="field" style="max-width:90px;">Иконка
        <input type="text" name="icon" value="${esc(r.icon || '🎁')}" maxlength="4">
      </label>
      <label class="field" style="grid-column: span 2;">Что за награда
        <input type="text" name="title" value="${esc(r.title || '')}" placeholder="Например: вечер сериалов" required autofocus>
      </label>
      <label class="field">Цена в золоте
        <input type="number" name="cost" value="${r.cost ?? 50}" min="1">
      </label>
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="button" class="btn ghost" data-cancel>Отмена</button>
        <button type="submit" class="btn primary">${existing ? '💾 Сохранить' : '➕ Добавить'}</button>
      </div>
    </form>`, modal => {
    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
    modal.querySelector('#rewardForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const title = String(f.get('title') || '').trim();
      if (!title) return;
      const data = { title, icon: String(f.get('icon') || '🎁').trim() || '🎁', cost: Math.max(1, Number(f.get('cost')) || 1) };
      mutate(() => {
        if (existing) Object.assign(existing, data);
        else state.rewards.push({ id: uid(), ...data, timesBought: 0, createdAt: nowISO() });
      });
      closeModal();
    });
  });
}

/* ---- Расходники ----------------------------------------------------------- */
function renderItemGrid() {
  const wrap = document.getElementById('itemGrid');
  wrap.innerHTML = SHOP_ITEMS.map(it => {
    const afford = state.player.gold >= it.cost;
    return `<div class="card reward-card ${afford ? '' : 'poor'}">
      <div class="reward-ic">${it.icon}</div>
      <div class="reward-title">${esc(it.name)}</div>
      <div class="text-dim" style="font-size:12.5px;">${esc(it.desc)}</div>
      <button class="btn ${afford ? 'primary' : ''} small mt8 wfull" data-buy-item="${it.id}" ${afford ? '' : 'disabled'}>
        Купить · ${it.cost} 🪙
      </button>
    </div>`;
  }).join('');
  wrap.querySelectorAll('[data-buy-item]').forEach(b => b.addEventListener('click', () => buyItem(b.dataset.buyItem)));
}

function buyItem(id) {
  mutate(() => {
    const it = SHOP_ITEMS.find(x => x.id === id);
    if (!it || state.player.gold < it.cost) return;
    state.player.gold -= it.cost;
    state.inventory[id] = (state.inventory[id] || 0) + 1;
    addLog(it.icon, `Куплено: ${it.name}`);
    SFX.coin();
    toast(`${it.icon} ${it.name} — в инвентаре`, 'green');
  });
}

/* ---- Инвентарь ------------------------------------------------------------ */
function renderInventory() {
  const wrap = document.getElementById('invGrid');
  const owned = SHOP_ITEMS.filter(it => (state.inventory[it.id] || 0) > 0);
  if (!owned.length) {
    wrap.innerHTML = `<div class="empty-hint" style="grid-column:1/-1;">Инвентарь пуст</div>`;
    return;
  }
  wrap.innerHTML = owned.map(it => `<div class="card reward-card">
      <div class="reward-ic">${it.icon}</div>
      <div class="reward-title">${esc(it.name)} <span class="chip">×${state.inventory[it.id]}</span></div>
      <div class="text-dim" style="font-size:12.5px;">${esc(it.desc)}</div>
      <button class="btn success small mt8 wfull" data-use-item="${it.id}">Использовать</button>
    </div>`).join('');
  wrap.querySelectorAll('[data-use-item]').forEach(b => b.addEventListener('click', () => useItem(b.dataset.useItem)));
}

function useItem(id) {
  mutate(() => {
    if ((state.inventory[id] || 0) <= 0) return;
    if (id === 'potion') {
      if (state.player.hp >= maxHp()) { toast('Здоровье и так полное', 'red'); return; }
      healHp(20); toast('🧪 +20 здоровья', 'green');
    }
    if (id === 'mana') {
      if (state.player.mp >= maxMp()) { toast('Мана и так полная', 'red'); return; }
      grantMp(30); toast('🔵 +30 маны', 'green');
    }
    if (id === 'shield') {
      state.player.buffs.shield += 1;
      toast('🛡️ Защита активирована', 'green');
    }
    state.inventory[id]--;
    SFX.coin();
  });
}

/* ---- Питомцы за кристаллы -------------------------------------------------- */
function renderPetShop() {
  const wrap = document.getElementById('petShop');
  wrap.innerHTML = PETS.map(def => {
    const owned = state.pets.some(p => p.id === def.id);
    const afford = state.player.gems >= def.gems;
    const bonusName = { xp: 'к опыту', gold: 'к золоту', hp: 'к здоровью' }[def.bonus];
    return `<div class="card reward-card ${owned ? '' : afford ? '' : 'poor'}">
      <div class="reward-ic">${def.icon}</div>
      <div class="reward-title">${esc(def.name)}</div>
      <div class="text-dim" style="font-size:12.5px;">+${Math.round(def.bonusVal * 100)}% ${bonusName} · вдвое больше, когда вырастет</div>
      ${owned
        ? `<div class="chip green mt8">Уже у тебя</div>`
        : `<button class="btn ${afford ? 'primary' : ''} small mt8 wfull" data-buy-pet="${def.id}" ${afford ? '' : 'disabled'}>Завести · ${def.gems} 💎</button>`}
    </div>`;
  }).join('');
  wrap.querySelectorAll('[data-buy-pet]').forEach(b => b.addEventListener('click', () => buyPet(b.dataset.buyPet)));
}

function buyPet(id) {
  mutate(() => {
    const def = PETS.find(x => x.id === id);
    if (!def || state.pets.some(p => p.id === id) || state.player.gems < def.gems) return;
    state.player.gems -= def.gems;
    state.pets.push({ id: def.id, fed: 0, isMount: false, since: nowISO() });
    if (!state.player.activePet) state.player.activePet = def.id;
    state.player.hp = clamp(state.player.hp, 0, maxHp());
    addLog('🐾', `Появился питомец: ${def.name}`);
    toast(`${def.icon} ${def.name} теперь с тобой!`, 'gold');
    confetti(60);
  });
}
