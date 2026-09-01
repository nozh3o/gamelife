/* =========================================================================
   views-stats.js — аналитика: финансы за полгода, питание за две недели
   ========================================================================= */

function renderStats() {
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

function moodChartHtml() {
  const entries = state.journal.filter(j => j.mood).slice(0, 30).reverse();
  if (entries.length < 2) return '';
  const data = entries.map(j => ({ label: fmtDateHuman(j.date).slice(0, 5), value: j.mood }));
  return `<div class="card mt16">
    <div class="card-title">Настроение по записям в журнале <small>чем выше, тем лучше</small></div>
    ${barChartSvg(data, { color: 'var(--orange)', height: 120, valueFmt: v => (MOODS.find(m => m.id === v) || {}).label || v })}
  </div>`;
}
