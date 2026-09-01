/* =========================================================================
   views-dashboard.js — главный экран: сводка дня, босс, цели, характеристики
   ========================================================================= */

const QUOTES = [
  'Каждый маленький квест приближает к следующему уровню.',
  'Дисциплина — это характеристика, которую качаешь только ты сам.',
  'Прогресс не обязан быть быстрым. Он обязан быть.',
  'Сегодняшний чекин — завтрашний стрик.',
  'Ты не проигрываешь, пока не бросил забег.',
  'Один процент в день — это в 37 раз больше за год.',
  'Сложные задачи дают больше опыта. Это не баг, это фича.',
  'Провалил день? В этой игре всегда есть респаун.',
];

function renderDashboard() {
  const p = state.player;
  const li = levelInfo(p.xp);
  const today = todayStr();
  const dueToday = state.dailies.filter(isDailyDueToday);
  const doneToday = dueToday.filter(isDailyDoneToday);
  const openTodos = state.todos.filter(t => !t.done);
  const overdue = openTodos.filter(t => t.due && t.due < today);
  const dayXp = (state.activity[today] && state.activity[today].xp) || 0;
  const bestStreak = state.dailies.reduce((m, d) => Math.max(m, d.streak || 0), 0);
  const activeGoals = state.goals.filter(g => !g.done);
  const quote = QUOTES[(new Date().getDate() + new Date().getMonth()) % QUOTES.length];
  const dayPct = dueToday.length ? Math.round((doneToday.length / dueToday.length) * 100) : 0;

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">С возвращением, ${esc(p.name)} ${esc(p.avatar)}</h1>
        <p class="page-sub">${esc(quote)}</p>
      </div>
      <div class="head-actions">
        <button class="btn primary" data-quick="todo">＋ Задача</button>
        <button class="btn" data-quick="daily">＋ Ежедневка</button>
      </div>
    </div>

    <div class="hero-grid">
      <div class="hero-main-card">
        <div class="hero-top-row">
          <div class="hero-avatar-mini">${esc(p.avatar)}</div>
          <div class="hero-streak-chip">🔥 ${bestStreak} ${plural(bestStreak, 'день', 'дня', 'дней')} лучший стрик</div>
        </div>
        <div class="hero-level-label">Уровень персонажа</div>
        <div class="hero-level-num">${li.level}</div>
        <div class="hero-xp-row">
          <div class="hero-xp-bar"><div class="hero-xp-fill" style="width:${li.pct}%"></div></div>
          <div class="hero-xp-text">${li.into} / ${li.need} XP · сегодня +${fmtNum(dayXp)}</div>
        </div>
      </div>
      <div class="hero-side">
        <div class="card kpi" style="display:flex;align-items:center;gap:14px;">
          ${ringSvg(dayPct, { size: 80, stroke: 8, color: 'var(--green)', label: dayPct + '%' })}
          <div>
            <div class="kpi-label">День закрыт на</div>
            <div class="kpi-sub" style="margin-top:4px;">${doneToday.length} из ${dueToday.length} ${plural(dueToday.length, 'ежедневки', 'ежедневок', 'ежедневок')}</div>
          </div>
        </div>
        <div class="card kpi">
          <div class="kpi-label">Кошелёк</div>
          <div class="big-number gold-text">🪙 ${fmtNum(p.gold)}</div>
          <div class="kpi-sub">💎 ${fmtNum(p.gems)} · реальный баланс ${fmtMoney(financeBalance())}</div>
        </div>
      </div>
    </div>

    ${bossPanelHtml()}

    <div class="grid cols-2 mt16">
      <div class="card">
        <div class="card-title">Сегодня <small>${doneToday.length}/${dueToday.length}</small></div>
        <div class="list" id="dashToday"></div>
      </div>
      <div class="card">
        <div class="card-title">Ближайшие задачи <small>${openTodos.length}${overdue.length ? ` · <span class="text-red">${overdue.length} просрочено</span>` : ''}</small></div>
        <div class="list" id="dashTodos"></div>
      </div>
    </div>

    <div class="section-label">Характеристики персонажа</div>
    <div class="section-card">
      <div class="grid cols-4" id="dashStats"></div>
    </div>

    <div class="grid cols-2 mt16">
      <div class="card">
        <div class="card-title">Активные цели <small>${activeGoals.length}</small></div>
        <div class="list" id="dashGoals"></div>
      </div>
      <div class="card">
        <div class="card-title">Лента событий</div>
        <div class="list log-list" id="dashLog"></div>
      </div>
    </div>`;

  content().querySelectorAll('[data-quick]').forEach(b =>
    b.addEventListener('click', () => openTaskForm(b.dataset.quick)));

  // Сегодняшние ежедневки
  document.getElementById('dashToday').innerHTML = dueToday.length
    ? dueToday.map(d => {
        const done = isDailyDoneToday(d);
        return `<div class="row-item compact ${done ? 'done' : ''}">
          <button class="check-btn small ${done ? 'checked' : ''}" data-dash-daily="${d.id}">${done ? '✓' : ''}</button>
          <div class="main">
            <div class="title ${done ? 'strike' : ''}">${esc(d.icon)} ${esc(d.title)}</div>
            <div class="meta">${diffChip(d.difficulty)}<span class="chip ${d.streak ? 'gold' : ''}">🔥 ${d.streak}</span></div>
          </div>
        </div>`;
      }).join('')
    : `<div class="empty-hint">На сегодня ежедневок нет. Создай их во вкладке «Задачи».</div>`;

  // Ближайшие задачи
  const soon = [...openTodos].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0, 6);
  document.getElementById('dashTodos').innerHTML = soon.length
    ? soon.map(t => {
        const late = t.due && t.due < today;
        return `<div class="row-item compact">
          <button class="check-btn small" data-dash-todo="${t.id}"></button>
          <div class="main">
            <div class="title">${esc(t.title)}</div>
            <div class="meta">${diffChip(t.difficulty)}${t.due ? `<span class="chip ${late ? 'red' : ''}">${late ? '⏰ ' : '📆 '}${fmtDateHuman(t.due)}</span>` : ''}</div>
          </div>
        </div>`;
      }).join('')
    : `<div class="empty-hint">Открытых задач нет — можно выдохнуть</div>`;

  // Характеристики
  document.getElementById('dashStats').innerHTML = state.stats.map(statMiniHtml).join('')
    || `<div class="empty-hint">Характеристик нет</div>`;

  // Цели
  document.getElementById('dashGoals').innerHTML = activeGoals.length
    ? activeGoals.slice(0, 5).map(goalMiniHtml).join('')
    : `<div class="empty-hint">Нет активных целей — загляни во вкладку «Цели»</div>`;

  // Лента
  document.getElementById('dashLog').innerHTML = state.log.length
    ? state.log.slice(0, 10).map(l =>
        `<div class="log-row"><span class="log-ic">${l.icon}</span><span class="log-text">${esc(l.text)}</span>
         <span class="log-time">${new Date(l.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>`).join('')
    : `<div class="empty-hint">Событий пока нет</div>`;

  content().querySelectorAll('[data-dash-daily]').forEach(b =>
    b.addEventListener('click', () => toggleDaily(b.dataset.dashDaily)));
  content().querySelectorAll('[data-dash-todo]').forEach(b =>
    b.addEventListener('click', () => toggleTodo(b.dataset.dashTodo)));
  content().querySelectorAll('[data-goto]').forEach(b =>
    b.addEventListener('click', () => goTab(b.dataset.goto)));
}

function statMiniHtml(s) {
  const li = levelInfo(s.xp, 60, 25);
  return `<div class="stat-mini">
    <div class="ic">${s.icon}</div>
    <div class="body">
      <div class="row1"><b>${esc(s.name)}</b><span class="lvl">ур. ${li.level}</span></div>
      ${barHtml(li.pct)}
    </div>
  </div>`;
}

function goalMiniHtml(g) {
  const pct = goalPct(g);
  return `<div class="goal-mini">
    <div class="flex-between" style="font-size:13.5px;margin-bottom:5px;">
      <span>${esc(g.title)}</span>
      <span class="text-dim">${g.kind === 'numeric' ? `${fmtNum(g.current)}/${fmtNum(g.target)} ${esc(g.unit || '')}` : pct + '%'}</span>
    </div>
    ${barHtml(pct, 'green')}
  </div>`;
}

function bossPanelHtml() {
  const b = state.boss.active;
  if (!b) {
    const next = BOSSES.find(x => !state.boss.defeated.some(d => d.id === x.id) && playerLevel() >= x.minLevel);
    if (!next) return '';
    return `<div class="card boss-card mt16">
      <div class="boss-icon">${next.icon}</div>
      <div class="boss-body">
        <div class="card-title" style="margin-bottom:4px;">Доступен новый босс: ${esc(next.name)}</div>
        <p class="text-dim" style="font-size:13px;margin:0 0 10px;">${esc(next.desc)} Каждое выполненное дело наносит ему урон.</p>
        <button class="btn primary small" data-goto="character">Открыть арену →</button>
      </div>
    </div>`;
  }
  const def = BOSSES.find(x => x.id === b.id);
  const pct = clamp((b.hp / b.maxHp) * 100, 0, 100);
  return `<div class="card boss-card active mt16">
    <div class="boss-icon shake">${def ? def.icon : '👹'}</div>
    <div class="boss-body">
      <div class="card-title" style="margin-bottom:6px;">Бой: ${esc(def ? def.name : 'Босс')} <small>${fmtNum(Math.max(0, b.hp))} / ${fmtNum(b.maxHp)} HP</small></div>
      ${barHtml(pct, 'boss', true)}
      <p class="text-dim" style="font-size:12.5px;margin:8px 0 0;">Урон наносится автоматически за каждое выполненное дело. Чем сложнее задача — тем сильнее удар.</p>
    </div>
  </div>`;
}
