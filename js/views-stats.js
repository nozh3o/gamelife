/* =========================================================================
   views-stats.js — аналитика: финансы за полгода, питание за две недели
   ========================================================================= */

function renderStats() {
  // ---- Активность: сколько разных дел в какой день --------------------
  const activityCounts = computeActivityCounts();
  const activityStreak = computeActivityStreak(activityCounts);

  // ---- Финансы: последние 6 месяцев -------------------------------------
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    months.push(monthKey(d));
  }
  const savedByMonth = months.map(m => ({
    label: monthLabel(m), value: financeMonth('income', m) - financeMonth('expense', m),
  }));

  const byCatAll = {};
  state.finance.transactions.filter(t => t.type === 'expense')
    .forEach(t => { byCatAll[t.category] = (byCatAll[t.category] || 0) + t.amount; });
  const catPartsAll = Object.entries(byCatAll).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([label, value], i) => ({ label, value, color: CAT_COLORS[i % CAT_COLORS.length] }));

  // ---- Питание: последние 14 дней ----------------------------------------
  const days14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days14.push({ label: String(d.getDate()), value: dayTotals(dateStr(d)).kcal });
  }
  const protein14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    protein14.push({ label: String(d.getDate()), value: Math.round(dayTotals(dateStr(d)).protein) });
  }
  const daysWithEntries = new Set(state.nutrition.entries.map(e => e.date));
  const avgKcal = daysWithEntries.size
    ? Math.round(state.nutrition.entries.reduce((s, e) => s + (e.kcal || 0), 0) / daysWithEntries.size)
    : 0;

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Аналитика</h1>
        <p class="page-sub">Финансы и питание за последнее время.</p>
      </div>
    </div>

    <div class="section-label">Активность <span class="chip ${activityStreak ? 'gold' : ''}">${icon('flame',12)} ${activityStreak} ${plural(activityStreak, 'день', 'дня', 'дней')} подряд</span></div>
    <div class="card">
      <div class="card-title">Карта активности <small>последние 20 недель</small></div>
      ${activityHeatmapHtml(activityCounts, 20)}
    </div>

    <div class="section-label">Финансы</div>
    <div class="grid cols-2">
      <div class="card">
        <div class="card-title">Отложено по месяцам <small>доход минус расход</small></div>
        ${barChartSvg(savedByMonth, { color: 'var(--green)', height: 130, valueFmt: fmtMoney })}
      </div>
      <div class="card">
        <div class="card-title">Расходы по категориям <small>за всё время</small></div>
        ${catPartsAll.length ? donutSvg(catPartsAll) : '<div class="empty-hint">Пока нет расходов</div>'}
      </div>
    </div>

    <div class="section-label">Питание</div>
    <div class="grid cols-3">
      <div class="card kpi"><div class="kpi-label">Дней подряд с записями</div><div class="big-number gold-text">${icon('flame',22)} ${nutritionStreak()}</div></div>
      <div class="card kpi"><div class="kpi-label">Записей всего</div><div class="big-number">${fmtNum(state.nutrition.entries.length)}</div></div>
      <div class="card kpi"><div class="kpi-label">Средние калории в день</div><div class="big-number">${fmtNum(avgKcal)}</div></div>
    </div>
    <div class="card mt16">
      <div class="card-title">Калории за 14 дней</div>
      ${barChartSvg(days14, { color: 'var(--gold)', height: 140, valueFmt: fmtNum })}
    </div>
    <div class="card mt16">
      <div class="card-title">Белок за 14 дней <small>норма ${fmtNum(activeTargets().protein)} г</small></div>
      ${barChartSvg(protein14, { color: 'var(--cyan)', height: 140, valueFmt: v => fmtNum(v) + ' г' })}
    </div>

    ${bodyStatsHtml()}
    ${weeklyActivityHtml()}
    ${moodChartHtml()}`;
}

/* Считаем «сколько видов активности» было в каждый день: привычка/ежедневка
   отмечена, запись в журнале, запись в дневнике питания — без всякого XP,
   просто честный след того, что днём что-то делалось. */
function computeActivityCounts() {
  const map = {};
  const touch = ds => { map[ds] = (map[ds] || 0) + 1; };

  const seenDaily = {};
  state.dailies.forEach(d => (d.history || []).forEach(ds => {
    seenDaily[ds] = seenDaily[ds] || new Set();
    if (!seenDaily[ds].has('daily')) { seenDaily[ds].add('daily'); touch(ds); }
  }));
  const seenJournal = new Set();
  state.journal.forEach(j => { if (!seenJournal.has(j.date)) { seenJournal.add(j.date); touch(j.date); } });
  const seenNutrition = new Set();
  state.nutrition.entries.forEach(e => { if (!seenNutrition.has(e.date)) { seenNutrition.add(e.date); touch(e.date); } });
  const seenWorkout = new Set();
  state.workouts.forEach(w => { if (!seenWorkout.has(w.date)) { seenWorkout.add(w.date); touch(w.date); } });

  return map;
}

function computeActivityStreak(counts) {
  let streak = 0;
  const cursor = new Date();
  if (!counts[dateStr(cursor)]) cursor.setDate(cursor.getDate() - 1);
  let guard = 0;
  while (counts[dateStr(cursor)] && guard++ < 3650) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* Тело: вес по замерам и показатель формы рядом. Разнесённые по разным экранам, эти два
   числа ничего не значат — вместе они отвечают на вопрос «уходит жир или мышцы».
   Раздел не показывается, пока замеров меньше двух: одна точка — не динамика. */
function bodyStatsHtml() {
  const entries = [...state.body.entries].sort((a, b) => a.date.localeCompare(b.date));
  const withWeight = entries.filter(e => e.weight != null && e.weight !== '');
  if (withWeight.length < 2) return '';

  const points = withWeight.map(e => ({ label: fmtDateHuman(e.date).slice(0, 5), value: Number(e.weight) }));
  const first = withWeight[0], last = withWeight[withWeight.length - 1];
  const totalDelta = Number(last.weight) - Number(first.weight);
  const days = daysBetween(first.date, last.date) || 1;
  // темп считаем по всей истории, а не по последним двум замерам: недельные
  // качели воды дают ±1 кг и превращают любой тренд в шум
  const perWeek = (totalDelta / days) * 7;

  // какой именно показатель формы рисуем, решает пол в профиле: см. shapeMetric()
  const shape = shapeMetric();
  const shapePoints = entries.filter(e => shape.of(e) != null)
    .map(e => ({ label: fmtDateHuman(e.date).slice(0, 5), value: Math.round(shape.of(e) * 1000) / 1000 }));

  return `
    <div class="section-label">Тело</div>
    <div class="grid cols-3">
      <div class="card kpi"><div class="kpi-label">Изменение веса <small>за ${days} ${plural(days, 'день', 'дня', 'дней')}</small></div>
        <div class="big-number">${totalDelta > 0 ? '+' : totalDelta < 0 ? '−' : ''}${Math.abs(totalDelta).toFixed(1)}<span class="unit"> кг</span></div></div>
      <div class="card kpi"><div class="kpi-label">Темп</div>
        <div class="big-number">${perWeek > 0 ? '+' : perWeek < 0 ? '−' : ''}${Math.abs(perWeek).toFixed(2)}<span class="unit"> кг/нед</span></div></div>
      <div class="card kpi"><div class="kpi-label">Замеров</div><div class="big-number">${entries.length}</div></div>
    </div>
    <div class="card mt16">
      <div class="card-title">Вес по замерам</div>
      ${lineChartSvg(points.slice(-20), { color: 'var(--cyan)', height: 140, valueFmt: v => v.toFixed(1) + ' кг' })}
    </div>
    ${shapePoints.length >= 2 ? `<div class="card mt16">
      <div class="card-title">${shape.label} <small>${shape.note}</small></div>
      ${lineChartSvg(shapePoints.slice(-20), { color: 'var(--green)', height: 120, valueFmt: v => v.toFixed(2) })}
    </div>` : ''}`;
}

/* Тренировки по неделям: один день ничего не говорит, а восемь недель показывают,
   держится ли ритм. Неделя считается с понедельника. */
function weeklyActivityHtml() {
  if (!state.workouts.length) return '';
  const weeks = [];
  const cursor = new Date();
  // отматываем к понедельнику текущей недели
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  for (let i = 7; i >= 0; i--) {
    const start = new Date(cursor); start.setDate(start.getDate() - i * 7);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const from = dateStr(start), to = dateStr(end);
    const count = new Set(state.workouts.filter(w => w.date >= from && w.date <= to).map(w => w.date)).size;
    weeks.push({ label: fmtDateHuman(from).slice(0, 5), value: count });
  }
  const avg = weeks.reduce((s, w) => s + w.value, 0) / weeks.length;
  return `
    <div class="section-label">Тренировки</div>
    <div class="card">
      <div class="card-title">Дней в зале по неделям <small>в среднем ${avg.toFixed(1)} в неделю за 8 недель</small></div>
      ${barChartSvg(weeks, { color: 'var(--orange)', height: 130, valueFmt: v => v + ' ' + plural(v, 'день', 'дня', 'дней') })}
    </div>`;
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
