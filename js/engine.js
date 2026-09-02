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

/* ---- Итоги недели -------------------------------------------------------
   Сводка по только что закончившейся неделе (прошлый понедельник — вчера),
   для карточки на главном экране, которая показывается только по
   понедельникам. Ничего отдельно не хранит — просто агрегирует то, что уже
   есть в остальных разделах. */
function lastWeekRange() {
  const end = new Date(); end.setDate(end.getDate() - 1); // вчера — если сегодня понедельник, это воскресенье
  const start = new Date(end); start.setDate(start.getDate() - 6);
  return { startStr: dateStr(start), endStr: dateStr(end) };
}
function weeklyDigest() {
  const { startStr, endStr } = lastWeekRange();
  const inWeek = ds => ds >= startStr && ds <= endStr;

  const txWeek = state.finance.transactions.filter(t => inWeek(t.date));
  const income = txWeek.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txWeek.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const workoutsWeek = state.workouts.filter(w => inWeek(w.date)).length;

  const kcalByDay = {};
  state.nutrition.entries.filter(e => inWeek(e.date)).forEach(e => { kcalByDay[e.date] = (kcalByDay[e.date] || 0) + (e.kcal || 0); });
  const nutritionDayCount = Object.keys(kcalByDay).length;
  const avgKcal = nutritionDayCount ? Math.round(Object.values(kcalByDay).reduce((a, b) => a + b, 0) / nutritionDayCount) : 0;

  const sleepWeek = state.sleep.entries.filter(e => inWeek(e.date));
  const avgSleepMin = sleepWeek.length ? Math.round(sleepWeek.reduce((s, e) => s + e.durationMin, 0) / sleepWeek.length) : 0;
  const avgSleepScore = sleepWeek.length ? Math.round(sleepWeek.reduce((s, e) => s + e.score, 0) / sleepWeek.length) : 0;

  const journalWeek = state.journal.filter(j => inWeek(j.date) && j.mood);
  const avgMood = journalWeek.length ? journalWeek.reduce((s, j) => s + j.mood, 0) / journalWeek.length : 0;

  let activeDays = 0;
  if (typeof computeActivityCounts === 'function') {
    const counts = computeActivityCounts();
    for (const cursor = parseDate(startStr); dateStr(cursor) <= endStr; cursor.setDate(cursor.getDate() + 1)) {
      if (counts[dateStr(cursor)]) activeDays++;
    }
  }

  return {
    startStr, endStr, income, expense, saved: income - expense,
    workoutsWeek, avgKcal, nutritionDayCount,
    avgSleepMin, avgSleepScore, sleepDayCount: sleepWeek.length,
    avgMood, moodDayCount: journalWeek.length, activeDays,
  };
}

/* ---- Сон -----------------------------------------------------------------
   Оценка ночи (0–100) собрана из трёх составляющих — по той же схеме, что
   публично описывают Oura и SleepScore Labs (у обоих оценка — сумма
   именованных «вкладов», а не одно чёрное число): длительность, режим
   (регулярность отбоя) и самочувствие. Настоящие носимые трекеры добавляют
   ещё фазы сна и пульс — у нас таких данных нет, оценка честно построена
   только на том, что реально вводит человек.

   - Длительность (вес 50): коридоры «оптимально»/«приемлемо» вокруг личной
     нормы (targetHours) — как у National Sleep Foundation (Hirshkowitz et
     al., 2015): полный балл в ±1 ч от нормы, ноль — на границе ±3 ч.
   - Режим (вес 25, если есть история): насколько время отбоя сегодня
     отличается от обычного времени за последние ночи — тот самый параметр
     «Timing/regularity», который Oura считает отдельным вкладом в оценку,
     потому что нерегулярный сон вреден даже при достаточной длительности.
   - Самочувствие (вес 25, если оценено): самооценка «как спалось», 1–5.

   Если каких-то составляющих ещё нет (мало истории для режима, не оценено
   самочувствие) — их вес честно перераспределяется на то, что есть, а не
   тянет оценку к нулю. */
const SLEEP_FALL_ASLEEP_MIN = 15; // «обычно человек засыпает за столько» — не считаем это время сном

function sleepDurationScore(durationMin, targetHours) {
  const targetMin = targetHours * 60;
  const diff = Math.abs(durationMin - targetMin);
  const optimal = 60, acceptable = 180; // ±1ч — полный балл, ±3ч — ноль
  if (diff <= optimal) return 100;
  if (diff >= acceptable) return 0;
  return 100 * (1 - (diff - optimal) / (acceptable - optimal));
}

/* Минуты от полудня — так типичное время отбоя (21:00–03:00) не рвётся
   через полночь пополам, как было бы при отсчёте от 00:00. */
function clockMinutesSinceNoon(iso) {
  const d = new Date(iso);
  return ((d.getHours() * 60 + d.getMinutes()) - 12 * 60 + 1440) % 1440;
}
function sleepTimingScore(bedAtISO, priorBedAtList) {
  if (!priorBedAtList || priorBedAtList.length < 3) return null; // мало истории — рано судить о режиме
  const cur = clockMinutesSinceNoon(bedAtISO);
  const priorMins = priorBedAtList.map(clockMinutesSinceNoon);
  const avg = priorMins.reduce((a, b) => a + b, 0) / priorMins.length;
  let diff = Math.abs(cur - avg);
  diff = Math.min(diff, 1440 - diff); // по кругу — 23:55 и 00:05 отличаются на 10 минут, не на сутки
  const grace = 20, zero = 120; // ±20 мин от привычного — полный балл, ±2ч — ноль
  if (diff <= grace) return 100;
  if (diff >= zero) return 0;
  return 100 * (1 - (diff - grace) / (zero - grace));
}

/* Возвращает и итог, и разбивку по составляющим — чтобы можно было
   показать не только число, но и откуда оно взялось. */
function computeSleepScore(durationMin, targetHours, quality, bedAtISO, priorBedAtList) {
  const parts = [{ key: 'duration', label: 'Длительность', weight: 50, value: Math.round(sleepDurationScore(durationMin, targetHours)) }];
  const timing = sleepTimingScore(bedAtISO, priorBedAtList);
  if (timing != null) parts.push({ key: 'timing', label: 'Режим', weight: 25, value: Math.round(timing) });
  if (quality) parts.push({ key: 'quality', label: 'Самочувствие', weight: 25, value: Math.round((quality / 5) * 100) });

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const score = Math.round(parts.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight);
  return { score, parts };
}

function fmtDuration(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h}ч ${String(m).padStart(2, '0')}м`;
}
function sleepScoreBreakdownText(parts) {
  return parts.map(p => `${p.label.toLowerCase()} ${p.value}`).join(', ');
}
function sleepAdvice(durationMin, targetHours, parts) {
  const targetMin = targetHours * 60;
  const diffMin = Math.round(targetMin - durationMin);
  const bits = [];
  if (Math.abs(diffMin) <= 20) bits.push('Длительность почти точно в норму.');
  else if (diffMin > 0) bits.push(`Не хватило примерно ${fmtDuration(diffMin)} до нормы в ${targetHours} ч.`);
  else bits.push(`Спал(а) на ${fmtDuration(-diffMin)} больше нормы в ${targetHours} ч.`);
  const timing = (parts || []).find(p => p.key === 'timing');
  if (timing && timing.value < 60) bits.push('Время отбоя сильно скачет ото дня ко дню — режим тоже влияет на оценку.');
  return bits.join(' ');
}
function sleepAvg(entries, days, field) {
  const cutoff = todayStr();
  const cursor = new Date(); cursor.setDate(cursor.getDate() - days + 1);
  const from = dateStr(cursor);
  const set = entries.filter(e => e.date >= from && e.date <= cutoff);
  if (!set.length) return 0;
  return set.reduce((s, e) => s + (e[field] || 0), 0) / set.length;
}
/* Время отбоя последних ночей до данной — вход для sleepTimingScore.
   excludeId нужен при редактировании, чтобы ночь не сравнивала себя саму с собой. */
function priorBedTimes(entries, beforeBedAtISO, excludeId) {
  const beforeMs = new Date(beforeBedAtISO).getTime();
  return entries
    .filter(e => e.id !== excludeId && e.bedAt && new Date(e.bedAt).getTime() < beforeMs)
    .sort((a, b) => new Date(b.bedAt) - new Date(a.bedAt))
    .slice(0, 7)
    .map(e => e.bedAt);
}
