/* =========================================================================
   engine.js — логика приложения: журнал событий, стрики ежедневок,
   суточный пересчёт (крон), финансовые хелперы
   ========================================================================= */

/* ---- Журнал событий --------------------------------------------------- */
function addLog(icon, text) {
  state.log.unshift({ id: uid(), date: nowISO(), icon, text });
  if (state.log.length > 120) state.log.length = 120;
}

/* ---- Стрики ежедневок -------------------------------------------------- */
function recomputeStreak(daily) {
  const set = new Set(daily.history);
  let streak = 0;
  const cursor = new Date();
  if (!set.has(dateStr(cursor))) cursor.setDate(cursor.getDate() - 1);
  // считаем подряд идущие запланированные дни
  let guard = 0;
  while (guard++ < 3650) {
    const ds = dateStr(cursor);
    const isScheduled = daily.days.includes(cursor.getDay());
    if (!isScheduled) { cursor.setDate(cursor.getDate() - 1); continue; }
    if (set.has(ds)) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  daily.streak = streak;
  daily.best = Math.max(daily.best || 0, streak);
}

function isDailyDueToday(d) {
  return d.days.includes(new Date().getDay());
}
function isDailyDoneToday(d) {
  return d.history.includes(todayStr());
}

/* ---- Суточный пересчёт (крон): просто продвигает дату и пересчитывает
   стрики — пропуски и так естественно обнуляют стрик в recomputeStreak */
function runCron() {
  const today = todayStr();
  if (state.lastCron === today) return null;
  state.dailies.forEach(recomputeStreak);
  state.lastCron = today;
  saveState();
  return null;
}

/* ---- Финансы (реальные деньги) -----------------------------------------
   Баланс каждого счёта хранится напрямую в state.finance.accounts[].balance
   и обновляется каждой операцией (доход/расход/перевод) — это и есть тот
   баланс, который можно поправить руками при сверке. Общий баланс — просто
   сумма по всем счетам (кредитки уходят в минус, что и есть их долг). */
function financeBalance() {
  return state.finance.accounts.reduce((s, a) => s + (a.balance || 0), 0);
}
/* income/expense считаем без переводов между своими счетами — перевод не доход и не расход */
function financeTotal(type) {
  return state.finance.transactions.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);
}
function financeMonth(type, monthKey) {
  return state.finance.transactions
    .filter(t => t.type === type && t.date.startsWith(monthKey))
    .reduce((s, t) => s + t.amount, 0);
}
function financeCategoryMonth(category, monthKey) {
  return state.finance.transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(monthKey) && t.category === category)
    .reduce((s, t) => s + t.amount, 0);
}
function financeAccount(id) { return state.finance.accounts.find(a => a.id === id); }

/* ---- Сон ---------------------------------------------------------------
   Оценка ночи — не игровые очки, а просто понятная сводка: насколько
   длительность попала в норму + (если указана) насколько хорошо
   субъективно спалось. Без нормы (targetHours) есть смысл сравнивать
   только с 8 часами — общепринятый ориентир для взрослого. */
const SLEEP_FALL_ASLEEP_MIN = 15; // «обычно человек засыпает за столько» — не считаем это время сном

function sleepDurationScore(durationMin, targetHours) {
  const targetMin = targetHours * 60;
  const diff = Math.abs(durationMin - targetMin);
  // на границе ±180 минут от нормы оценка длительности уходит в ноль
  return clamp(100 - diff * (100 / 180), 0, 100);
}
function computeSleepScore(durationMin, targetHours, quality) {
  const durationScore = sleepDurationScore(durationMin, targetHours);
  if (!quality) return Math.round(durationScore);
  const qualityScore = (quality / 5) * 100;
  return Math.round(durationScore * 0.7 + qualityScore * 0.3);
}
function fmtDuration(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h}ч ${String(m).padStart(2, '0')}м`;
}
function sleepAdvice(durationMin, targetHours) {
  const targetMin = targetHours * 60;
  const diffMin = Math.round(targetMin - durationMin);
  if (Math.abs(diffMin) <= 20) return 'Почти точно в норму — так держать.';
  if (diffMin > 0) return `Не хватило примерно ${fmtDuration(diffMin)} до нормы в ${targetHours} ч — стоит лечь пораньше.`;
  return `Спал(а) на ${fmtDuration(-diffMin)} больше нормы в ${targetHours} ч.`;
}
function sleepAvg(entries, days, field) {
  const cutoff = todayStr();
  const cursor = new Date(); cursor.setDate(cursor.getDate() - days + 1);
  const from = dateStr(cursor);
  const set = entries.filter(e => e.date >= from && e.date <= cutoff);
  if (!set.length) return 0;
  return set.reduce((s, e) => s + (e[field] || 0), 0) / set.length;
}
