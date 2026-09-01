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

    <div class="section-label">Активность <span class="chip ${activityStreak ? 'gold' : ''}">🔥 ${activityStreak} ${plural(activityStreak, 'день', 'дня', 'дней')} подряд</span></div>
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
      <div class="card kpi"><div class="kpi-label">Дней подряд с записями</div><div class="big-number gold-text">🔥 ${nutritionStreak()}</div></div>
      <div class="card kpi"><div class="kpi-label">Записей всего</div><div class="big-number">${fmtNum(state.nutrition.entries.length)}</div></div>
      <div class="card kpi"><div class="kpi-label">Средние калории в день</div><div class="big-number">${fmtNum(avgKcal)}</div></div>
    </div>
    <div class="card mt16">
      <div class="card-title">Калории за 14 дней</div>
      ${barChartSvg(days14, { color: 'var(--gold)', height: 140, valueFmt: fmtNum })}
    </div>

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

function moodChartHtml() {
  const entries = state.journal.filter(j => j.mood).slice(0, 30).reverse();
  if (entries.length < 2) return '';
  const data = entries.map(j => ({ label: fmtDateHuman(j.date).slice(0, 5), value: j.mood }));
  return `<div class="card mt16">
    <div class="card-title">Настроение по записям в журнале <small>чем выше, тем лучше</small></div>
    ${barChartSvg(data, { color: 'var(--orange)', height: 120, valueFmt: v => (MOODS.find(m => m.id === v) || {}).label || v })}
  </div>`;
}
