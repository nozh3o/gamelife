/* =========================================================================
   views-character.js — лист персонажа: класс, навык, характеристики,
   очки навыка, питомцы и арена боссов
   ========================================================================= */

function renderCharacter() {
  const p = state.player;
  const li = levelInfo(p.xp);
  const cls = currentClass();
  const daysPlayed = daysBetween(dateStr(new Date(p.createdAt)), todayStr()) + 1;

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Персонаж</h1>
        <p class="page-sub">Всё, что ты делаешь в жизни, качает конкретную характеристику героя.</p>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="card hero-card">
        <div class="hero-avatar">${esc(p.avatar)}</div>
        <div class="hero-info">
          <div class="hero-name">${esc(p.name)}</div>
          <div class="hero-class">${cls ? `${cls.icon} ${cls.name}` : 'Без класса'} · уровень ${li.level}</div>
          <div class="hero-stats-row">
            <span class="chip">❤️ ${Math.round(p.hp)}/${maxHp()}</span>
            <span class="chip">🔷 ${Math.round(p.mp)}/${maxMp()}</span>
            <span class="chip gold">🪙 ${fmtNum(p.gold)}</span>
            <span class="chip">💎 ${fmtNum(p.gems)}</span>
          </div>
          <div class="hero-stats-row">
            <span class="chip">⭐ всего ${fmtNum(p.xp)} XP</span>
            <span class="chip">📅 ${daysPlayed} ${plural(daysPlayed, 'день', 'дня', 'дней')} в игре</span>
            ${p.deaths ? `<span class="chip red">☠️ падений: ${p.deaths}</span>` : ''}
          </div>
          <div class="hero-bonus mt8">
            Множители: опыт ×${xpMultiplier().toFixed(2)} · золото ×${goldMultiplier().toFixed(2)} · урон ×${damageMultiplier().toFixed(2)}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Класс и навык</div>
        ${classPanelHtml()}
      </div>
    </div>

    <div class="section-label">Характеристики
      ${p.skillPoints > 0 ? `<span class="chip gold">свободных очков: ${p.skillPoints}</span>` : ''}
    </div>
    <p class="text-dim" style="font-size:13px;margin:-4px 0 12px;">
      Очки навыка выдаются за каждый новый уровень. Вложи их в ту сферу, которую хочешь развить — каждое очко даёт +60 XP характеристике.
    </p>
    <div class="grid cols-2" id="charStats"></div>

    <div class="section-label">Питомцы</div>
    <div class="grid cols-4" id="charPets"></div>

    <div class="section-label">Арена боссов</div>
    <div id="bossArena"></div>`;

  renderCharStats();
  renderCharPets();
  renderBossArena();
  bindClassPanel();
}

/* ---- Класс -------------------------------------------------------------- */
function classPanelHtml() {
  const lvl = playerLevel();
  const cls = currentClass();
  if (!cls) {
    if (lvl < 10) {
      const need = xpForLevel(10) - state.player.xp;
      return `<div class="locked-box">
        <div class="locked-ic">🔒</div>
        <div>
          <b>Класс откроется на 10 уровне</b>
          <p class="text-dim" style="font-size:13px;margin:4px 0 0;">Осталось ${fmtNum(Math.max(0, need))} XP. Класс даёт постоянный бонус и уникальный навык.</p>
        </div>
      </div>`;
    }
    return `<p class="text-dim" style="font-size:13px;margin:0 0 12px;">Выбери путь героя. Класс меняет множители наград и открывает навык. Сменить можно позже за 10 💎.</p>
      <div class="class-grid">
        ${Object.values(CLASSES).map(c => `
          <button class="class-opt" data-pick-class="${c.id}">
            <div class="class-ic">${c.icon}</div>
            <div class="class-name">${c.name}</div>
            <div class="class-desc">${esc(c.desc)}</div>
          </button>`).join('')}
      </div>`;
  }

  const sk = cls.skill;
  const canCast = state.player.mp >= sk.cost;
  return `<div class="class-current">
      <div class="class-ic big">${cls.icon}</div>
      <div>
        <div class="class-name">${cls.name}</div>
        <p class="text-dim" style="font-size:13px;margin:4px 0 0;">${esc(cls.desc)}</p>
      </div>
    </div>
    <div class="skill-box mt16">
      <div class="skill-head">
        <span class="skill-ic">${sk.icon}</span>
        <div>
          <b>${sk.name}</b>
          <div class="text-dim" style="font-size:12.5px;">${esc(sk.desc)}</div>
        </div>
      </div>
      <button class="btn ${canCast ? 'primary' : ''}" id="castSkill" ${canCast ? '' : 'disabled'}>Применить · ${sk.cost} 🔷</button>
    </div>
    <button class="btn ghost small mt16" id="changeClass">Сменить класс за 10 💎</button>`;
}

function bindClassPanel() {
  content().querySelectorAll('[data-pick-class]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.pickClass;
    mutate(() => {
      state.player.cls = id;
      state.player.mp = maxMp();
      addLog(CLASSES[id].icon, `Выбран класс: ${CLASSES[id].name}`);
    });
    toast(`${CLASSES[id].icon} Теперь ты ${CLASSES[id].name}!`, 'gold');
    confetti(80);
  }));

  const cast = document.getElementById('castSkill');
  if (cast) cast.addEventListener('click', () => mutate(castSkill));

  const change = document.getElementById('changeClass');
  if (change) change.addEventListener('click', () => {
    if (state.player.gems < 10) { toast('Нужно 10 кристаллов', 'red'); return; }
    confirmAction('Сменить класс за 10 💎?', () => {
      mutate(() => { state.player.gems -= 10; state.player.cls = null; });
    }, false);
  });
}

/* ---- Характеристики ------------------------------------------------------ */
function renderCharStats() {
  const canSpend = state.player.skillPoints > 0;
  document.getElementById('charStats').innerHTML = state.stats.map(s => {
    const li = levelInfo(s.xp, 60, 25);
    return `<div class="card stat-card">
      <div class="stat-card-head">
        <span class="stat-ic">${s.icon}</span>
        <div class="stat-name">${esc(s.name)}</div>
        <span class="chip gold">ур. ${li.level}</span>
      </div>
      ${barHtml(li.pct)}
      <div class="flex-between mt8">
        <span class="text-dim" style="font-size:12px;">${li.into} / ${li.need} XP · всего ${fmtNum(s.xp)}</span>
        <button class="btn small" data-spend="${s.id}" ${canSpend ? '' : 'disabled'}>＋ очко</button>
      </div>
    </div>`;
  }).join('') || `<div class="empty-hint">Характеристик нет — добавь их в Настройках</div>`;

  content().querySelectorAll('[data-spend]').forEach(b => b.addEventListener('click', () => {
    mutate(() => {
      if (state.player.skillPoints <= 0) return;
      const s = statById(b.dataset.spend);
      if (!s) return;
      state.player.skillPoints--;
      s.xp += 60;
      addLog('📈', `Очко навыка вложено в «${s.name}»`);
    });
    SFX.coin();
  }));
}

/* ---- Питомцы ------------------------------------------------------------- */
function renderCharPets() {
  const wrap = document.getElementById('charPets');
  if (!state.pets.length) {
    wrap.innerHTML = `<div class="empty-hint" style="grid-column:1/-1;">Питомцев пока нет. Их можно купить за кристаллы в Магазине — они дают постоянные бонусы к опыту, золоту или здоровью.</div>`;
    return;
  }
  wrap.innerHTML = state.pets.map(p => {
    const def = PETS.find(x => x.id === p.id);
    if (!def) return '';
    const pct = clamp(Math.round((p.fed / 100) * 100), 0, 100);
    const active = state.player.activePet === p.id;
    const bonusName = { xp: 'опыт', gold: 'золото', hp: 'здоровье' }[def.bonus];
    const bonusVal = Math.round((p.isMount ? def.bonusVal * 2 : def.bonusVal) * 100);
    return `<div class="card pet-card ${active ? 'active' : ''}">
      <div class="pet-ic">${p.isMount ? def.mountIcon : def.icon}</div>
      <div class="pet-name">${esc(def.name)}${p.isMount ? ' 🏆' : ''}</div>
      <div class="text-dim" style="font-size:12px;">+${bonusVal}% ${bonusName}</div>
      ${p.isMount ? `<div class="chip green mt8">Взрослый спутник</div>`
        : `<div class="mt8">${barHtml(pct, 'green')}<div class="text-dim" style="font-size:11.5px;margin-top:4px;">сытость ${pct}%</div></div>
           <button class="btn small mt8 wfull" data-feed="${p.id}">Покормить · 20 🪙</button>`}
      <button class="btn ${active ? 'success' : 'ghost'} small mt8 wfull" data-equip="${p.id}">${active ? 'Активен' : 'Сделать активным'}</button>
    </div>`;
  }).join('');

  wrap.querySelectorAll('[data-feed]').forEach(b => b.addEventListener('click', () => feedPet(b.dataset.feed)));
  wrap.querySelectorAll('[data-equip]').forEach(b => b.addEventListener('click', () => mutate(() => {
    state.player.activePet = state.player.activePet === b.dataset.equip ? null : b.dataset.equip;
  })));
}

function feedPet(id) {
  mutate(() => {
    const p = state.pets.find(x => x.id === id);
    if (!p || p.isMount) return;
    if (state.player.gold < 20) { toast('Не хватает золота', 'red'); return; }
    state.player.gold -= 20;
    p.fed = Math.min(100, (p.fed || 0) + 20);
    SFX.coin();
    if (p.fed >= 100) {
      p.isMount = true;
      const def = PETS.find(x => x.id === p.id);
      addLog('🏆', `${def ? def.name : 'Питомец'} вырос во взрослого спутника — бонус удвоен!`);
      toast('🏆 Питомец вырос! Бонус удвоен', 'gold');
      confetti(70);
    }
  });
}

/* ---- Арена боссов --------------------------------------------------------- */
function renderBossArena() {
  const lvl = playerLevel();
  const active = state.boss.active;
  const wrap = document.getElementById('bossArena');

  wrap.innerHTML = `<div class="grid cols-2">
    ${BOSSES.map(b => {
      const beaten = state.boss.defeated.filter(d => d.id === b.id).length;
      const locked = lvl < b.minLevel;
      const isActive = active && active.id === b.id;
      const pct = isActive ? clamp((active.hp / active.maxHp) * 100, 0, 100) : 0;
      return `<div class="card boss-entry ${locked ? 'locked' : ''} ${isActive ? 'fighting' : ''}">
        <div class="boss-entry-head">
          <span class="boss-entry-ic">${b.icon}</span>
          <div>
            <div class="boss-entry-name">${esc(b.name)}${beaten ? ` <span class="chip green">повержен ×${beaten}</span>` : ''}</div>
            <div class="text-dim" style="font-size:12.5px;">${esc(b.desc)}</div>
          </div>
        </div>
        <div class="task-meta mt8">
          <span class="chip">❤️ ${fmtNum(b.hp)} HP</span>
          <span class="chip gold">+${fmtNum(b.reward.xp)} XP</span>
          <span class="chip gold">+${fmtNum(b.reward.gold)} 🪙</span>
          <span class="chip">+${b.reward.gems} 💎</span>
          ${locked ? `<span class="chip red">🔒 с ${b.minLevel} уровня</span>` : ''}
        </div>
        ${isActive ? `<div class="mt8">${barHtml(pct, 'boss', true)}
          <div class="flex-between mt8">
            <span class="text-dim" style="font-size:12px;">осталось ${fmtNum(Math.max(0, active.hp))} HP</span>
            <button class="btn ghost small danger-text" data-boss-flee>Отступить</button>
          </div></div>`
        : `<button class="btn ${locked || active ? '' : 'primary'} small mt8" data-boss-start="${b.id}" ${locked || active ? 'disabled' : ''}>
             ${active ? 'Идёт другой бой' : locked ? 'Недоступен' : 'Вызвать на бой'}
           </button>`}
      </div>`;
    }).join('')}
  </div>`;

  wrap.querySelectorAll('[data-boss-start]').forEach(b => b.addEventListener('click', () => mutate(() => startBoss(b.dataset.bossStart))));
  const flee = wrap.querySelector('[data-boss-flee]');
  if (flee) flee.addEventListener('click', () => confirmAction('Отступить? Прогресс боя обнулится.', () => {
    mutate(() => { state.boss.active = null; });
  }));
}
