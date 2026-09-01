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
