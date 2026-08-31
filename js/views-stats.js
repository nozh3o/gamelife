/* =========================================================================
   views-stats.js — аналитика: тепловая карта, графики опыта,
   стрики, распределение по характеристикам, настроение
   ========================================================================= */

function renderStats() {
  const act = state.activity;
  const days14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = dateStr(d);
    days14.push({ label: String(d.getDate()), value: (act[ds] && act[ds].xp) || 0, date: ds });
  }
  const tasks14 = days14.map(d => ({ label: d.label, value: (act[d.date] && act[d.date].tasks) || 0 }));

  const totalXp = Object.values(act).reduce((s, a) => s + (a.xp || 0), 0);
  const activeDays = Object.values(act).filter(a => (a.xp || 0) > 0).length;
  const avgXp = activeDays ? Math.round(totalXp / activeDays) : 0;
  const bestDay = Object.entries(act).sort((a, b) => (b[1].xp || 0) - (a[1].xp || 0))[0];
  const currentDayStreak = computeDayStreak();

  const statParts = state.stats
    .map((s, i) => ({ label: s.name, value: s.xp, color: CAT_COLORS[i % CAT_COLORS.length] }))
    .filter(p => p.value > 0);

  const topDailies = [...state.dailies].sort((a, b) => (b.streak || 0) - (a.streak || 0)).slice(0, 6);
  const habitTop = [...state.habits]
    .map(h => ({ ...h, net: (h.upCount || 0) - (h.downCount || 0) }))
    .sort((a, b) => b.net - a.net);

  const doneTodos = state.todos.filter(t => t.done).length;
  const totalTodos = state.todos.length;
  const completion = totalTodos ? Math.round((doneTodos / totalTodos) * 100) : 0;

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Аналитика</h1>
        <p class="page-sub">Здесь видно правду: не как ты себя чувствуешь, а что реально происходило.</p>
      </div>
    </div>

    <div class="grid cols-4">
      <div class="card kpi"><div class="kpi-label">Опыт всего</div><div class="big-number">${fmtNum(state.player.xp)}</div><div class="kpi-sub">за ${activeDays} ${plural(activeDays, 'активный день', 'активных дня', 'активных дней')}</div></div>
      <div class="card kpi"><div class="kpi-label">Дней подряд</div><div class="big-number gold-text">🔥 ${currentDayStreak}</div><div class="kpi-sub">хотя бы одно дело в день</div></div>
      <div class="card kpi"><div class="kpi-label">Средний день</div><div class="big-number">${fmtNum(avgXp)}</div><div class="kpi-sub">XP в активный день</div></div>
      <div class="card kpi"><div class="kpi-label">Лучший день</div><div class="big-number">${bestDay ? fmtNum(bestDay[1].xp) : 0}</div><div class="kpi-sub">${bestDay ? fmtDateHuman(bestDay[0]) : '—'}</div></div>
    </div>

    <div class="card mt16">
      <div class="card-title">Карта активности <small>последние 20 недель</small></div>
      ${heatmapHtml(act, 20)}
    </div>

    <div class="grid cols-2 mt16">
      <div class="card">
        <div class="card-title">Опыт за 14 дней</div>
        ${barChartSvg(days14, { color: 'var(--accent)', height: 150 })}
      </div>
      <div class="card">
        <div class="card-title">Выполнено дел за 14 дней</div>
        ${barChartSvg(tasks14, { color: 'var(--green)', height: 150 })}
      </div>
    </div>

    <div class="grid cols-2 mt16">
      <div class="card">
        <div class="card-title">Куда уходит опыт</div>
        ${statParts.length ? donutSvg(statParts.map(p => ({ ...p })), { size: 160 }) : '<div class="empty-hint">Выполни задачи с привязкой к характеристике</div>'}
      </div>
      <div class="card">
        <div class="card-title">Лучшие стрики</div>
        <div class="list">
          ${topDailies.length ? topDailies.map(d => `
            <div class="row-item compact">
              <span class="ic">${esc(d.icon || '📅')}</span>
              <div class="main">
                <div class="title">${esc(d.title)}</div>
                ${barHtml(clamp(((d.streak || 0) / Math.max(7, d.best || 7)) * 100, 0, 100), 'gold')}
              </div>
              <span class="chip gold">🔥 ${d.streak || 0}</span>
              <span class="chip">рекорд ${d.best || 0}</span>
            </div>`).join('') : '<div class="empty-hint">Ежедневок пока нет</div>'}
        </div>
      </div>
    </div>

    <div class="grid cols-2 mt16">
      <div class="card">
        <div class="card-title">Привычки: плюсы против минусов</div>
        <div class="list">
          ${habitTop.length ? habitTop.map(h => {
            const total = (h.upCount || 0) + (h.downCount || 0) || 1;
            const upPct = Math.round(((h.upCount || 0) / total) * 100);
            return `<div class="habit-stat">
              <div class="flex-between" style="font-size:13px;margin-bottom:5px;">
                <span>${esc(h.icon || '🔁')} ${esc(h.title)}</span>
                <span class="text-dim">+${h.upCount || 0} / −${h.downCount || 0}</span>
              </div>
              <div class="split-bar"><div class="split-good" style="width:${upPct}%"></div><div class="split-bad" style="width:${100 - upPct}%"></div></div>
            </div>`;
          }).join('') : '<div class="empty-hint">Привычек пока нет</div>'}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Итоги</div>
        <div class="summary-list">
          <div class="sum-row"><span>Выполнено задач</span><b>${doneTodos} из ${totalTodos} (${completion}%)</b></div>
          <div class="sum-row"><span>Отмечено ежедневок</span><b>${fmtNum(state.dailies.reduce((s, d) => s + d.history.length, 0))}</b></div>
          <div class="sum-row"><span>Отмечено привычек</span><b>${fmtNum(state.habits.reduce((s, h) => s + (h.upCount || 0), 0))}</b></div>
          <div class="sum-row"><span>Достигнуто целей</span><b>${state.goals.filter(g => g.done).length}</b></div>
          <div class="sum-row"><span>Побеждено боссов</span><b>${state.boss.defeated.length}</b></div>
          <div class="sum-row"><span>Открыто достижений</span><b>${Object.keys(state.achievements).length} из ${ACHIEVEMENTS.length}</b></div>
          <div class="sum-row"><span>Куплено наград</span><b>${state.rewards.reduce((s, r) => s + (r.timesBought || 0), 0)}</b></div>
          <div class="sum-row"><span>Падений героя</span><b>${state.player.deaths}</b></div>
        </div>
      </div>
    </div>

    ${moodChartHtml()}`;
}

function computeDayStreak() {
  let streak = 0;
  const cursor = new Date();
  const has = ds => state.activity[ds] && state.activity[ds].xp > 0;
  if (!has(dateStr(cursor))) cursor.setDate(cursor.getDate() - 1);
  let guard = 0;
  while (has(dateStr(cursor)) && guard++ < 3650) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function moodChartHtml() {
  const entries = state.journal.filter(j => j.mood).slice(0, 30).reverse();
  if (entries.length < 2) return '';
  const data = entries.map(j => ({ label: fmtDateHuman(j.date).slice(0, 5), value: j.mood }));
  return `<div class="card mt16">
    <div class="card-title">Настроение по записям в журнале <small>чем выше, тем лучше</small></div>
    ${barChartSvg(data, { color: 'var(--orange)', height: 120, valueFmt: v => (MOODS.find(m => m.id === v) || {}).label || v })}
  </div>`;
}
