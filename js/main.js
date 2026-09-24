/* =========================================================================
   main.js — навигация, цикл перерисовки, запуск
   ========================================================================= */

let currentTab = 'home';
const content = () => document.getElementById('content');

/* Любое изменение состояния идёт через mutate: сохраняем и перерисовываем интерфейс. */
function mutate(fn) {
  fn();
  // цели, привязанные к счёту, не имеют своего момента «прогресс добавили» —
  // их двигает любая операция по счёту, поэтому проверяем здесь же
  if (typeof checkLinkedGoals === 'function') checkLinkedGoals();
  saveState();
  renderAll();
  if (typeof checkBudgetAlerts === 'function') checkBudgetAlerts();
}

/* ---- Очередь записей от Клода (MCP-коннектор) ---------------------------
   Клод пишет через личный токен прямо в облачное сохранение (Postgres-функция
   gamelife_agent_add кладёт запись в state.agentInbox), а разбирает её уже
   приложение — переиспользуя обычные addTransaction/addMealEntry и т.п.,
   чтобы не дублировать всю бизнес-логику (баланс счетов, стрики и т.д.)
   ещё и на сервере. Вызывается из sync.js после каждой синхронизации. */
/* Типы, которые это приложение умеет применять. Список нужен именно здесь:
   Клод узнаёт о новых командах сразу после деплоя коннектора, а установленное
   приложение может ещё неделю работать на старой версии — и раньше такие
   команды молча пропадали, потому что очередь чистилась целиком. */
const KNOWN_AGENT_KINDS = new Set([
  'transaction', 'workout', 'workout_update', 'workout_delete',
  'meal', 'meal_update', 'meal_delete',
  'task', 'journal', 'goal', 'wish', 'habit_log', 'daily_done', 'measurement',
  'task_update', 'task_delete', 'transaction_update', 'transaction_delete',
  'goal_update', 'goal_delete', 'wish_update', 'wish_delete', 'measurement_delete',
]);

/* Общий поиск записи для правки и удаления. Клод не знает id, поэтому
   называет запись по куску названия (и дате, если она есть). Правило то же,
   что у еды и тренировок: несколько совпадений без all=true — не трогаем
   ничего, молча задеть не ту запись хуже, чем не задеть никакую.
   Возвращает найденные записи или null, если уже показан тост с отказом. */
function agentFind(list, p, what, opts = {}) {
  const needle = String(p.title || '').trim().toLowerCase();
  const date = String(p.date || '').trim();
  if (!needle && !(opts.dateOnly && date)) return null;
  let found = list.filter(x =>
    (!needle || String(x.title || '').toLowerCase().includes(needle)) &&
    (!date || x.date === date));
  // точное совпадение названия сильнее вхождения: «Атлант: АВР» не должна
  // упираться в неоднозначность только потому, что есть «Атлант: АВР + …»
  if (found.length > 1 && needle) {
    const exact = found.filter(x => String(x.title || '').trim().toLowerCase() === needle);
    if (exact.length) found = exact;
  }
  const label = needle ? `«${p.title}»` : '';
  const when = date ? ` за ${fmtDateHuman(date)}` : '';
  if (!found.length) {
    toast(`Клод не нашёл ${what} ${label}${when}`, 'red');
    return null;
  }
  if (found.length > 1 && !p.all) {
    toast(`Под ${what} ${label}${when} подходит ${found.length} — Клод не стал угадывать`, 'red');
    return null;
  }
  return found;
}

const agentStr = v => v != null && String(v).trim() ? String(v).trim() : null;

function processAgentInbox() {
  const inbox = state.agentInbox || [];
  if (!inbox.length) return;
  let changed = false;
  const unknown = [];
  inbox.forEach(item => {
    if (!KNOWN_AGENT_KINDS.has(item && item.kind)) { unknown.push(item); return; }
    try { applyAgentItem(item); changed = true; }
    catch (e) { console.warn('Не удалось применить запись от Клода:', item, e); }
  });
  // непонятые команды остаются ждать обновления, а не исчезают
  state.agentInbox = unknown;
  if (unknown.length) {
    toast(`Клод прислал ${unknown.length} ${plural(unknown.length, 'команду', 'команды', 'команд')}, которых эта версия не знает — обнови приложение`, 'red');
  }
  if (changed || unknown.length !== inbox.length) { saveState(); renderAll(); }
}

function applyAgentItem(item) {
  const p = item.payload || {};
  if (item.kind === 'transaction') {
    const type = p.type === 'income' ? 'income' : 'expense';
    const amount = Number(p.amount) || 0;
    let accountId;
    if (p.account) {
      const acc = state.finance.accounts.find(a => a.name.toLowerCase() === String(p.account).trim().toLowerCase());
      if (acc) accountId = acc.id;
    }
    addTransaction(amount, type, p.category, p.note, p.date, false, accountId);
    toast(`Клод добавил ${type === 'income' ? 'доход' : 'расход'}: ${fmtMoney(amount)}${p.category ? ' · ' + p.category : ''}`, 'gold');
  } else if (item.kind === 'workout') {
    const exercises = (p.exercises || []).map(ex => ({
      id: uid(),
      name: String(ex.name || 'Упражнение').trim() || 'Упражнение',
      sets: (ex.sets || []).map(s => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 }))
        .filter(s => s.reps > 0 || s.weight > 0),
    })).filter(ex => ex.sets.length);
    const title = String(p.title || 'Тренировка').trim() || 'Тренировка';
    state.workouts.push({
      id: uid(), title, date: p.date || todayStr(), note: String(p.note || '').trim(),
      exercises, createdAt: nowISO(),
    });
    addLog('🏋️', `Тренировка записана Клодом: ${title}`);
    toast(`Клод добавил тренировку: ${title}`, 'gold');
  } else if (item.kind === 'workout_update' || item.kind === 'workout_delete') {
    // То же правило адресации, что у приёмов пищи: Клод не видит историю
    // и не знает id, поэтому называет тренировку по имени и дате. При
    // нескольких совпадениях по умолчанию не делаем ничего.
    const needle = String(p.title || '').trim().toLowerCase();
    const date = String(p.date || '').trim();
    if (!needle || !date) return;
    const found = state.workouts.filter(w =>
      w.date === date && String(w.title || '').toLowerCase().includes(needle));

    if (!found.length) {
      toast(`Клод не нашёл тренировку «${p.title}» за ${fmtDateHuman(date)}`, 'red');
      return;
    }
    if (found.length > 1 && !p.all) {
      toast(`Под «${p.title}» за ${fmtDateHuman(date)} подходит ${found.length} тренировки — Клод не стал угадывать`, 'red');
      return;
    }

    if (item.kind === 'workout_delete') {
      const ids = new Set(found.map(w => w.id));
      state.workouts = state.workouts.filter(w => !ids.has(w.id));
      ids.forEach(id => markDeleted(id));
      addLog('🗑️', `Клод удалил тренировку: ${p.title}`);
      toast(`Клод удалил ${found.length === 1 ? `«${p.title}»` : `${found.length} тренировки`}`, 'gold');
      return;
    }

    const readSets = list => (list || [])
      .map(s => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 }))
      .filter(s => s.reps > 0 || s.weight > 0);

    let touched = false;
    found.forEach(w => {
      if (p.new_title != null && String(p.new_title).trim()) { w.title = String(p.new_title).trim(); touched = true; }
      if (p.new_date != null && String(p.new_date).trim()) { w.date = String(p.new_date).trim(); touched = true; }
      if (p.note != null) { w.note = String(p.note).trim(); touched = true; }

      if (Array.isArray(p.exercises) && p.exercises.length) {
        const list = p.exercises.map(ex => ({
          id: uid(),
          name: String(ex.name || 'Упражнение').trim() || 'Упражнение',
          sets: readSets(ex.sets),
        })).filter(ex => ex.sets.length);
        if (list.length) { w.exercises = list; touched = true; }
      }

      const patch = p.exercise;
      if (patch && String(patch.name || '').trim()) {
        const exNeedle = String(patch.name).trim().toLowerCase();
        w.exercises = w.exercises || [];
        const ex = w.exercises.find(e => String(e.name || '').toLowerCase().includes(exNeedle));
        if (patch.remove) {
          if (ex) { w.exercises = w.exercises.filter(e => e !== ex); touched = true; }
        } else if (ex) {
          if (patch.new_name != null && String(patch.new_name).trim()) ex.name = String(patch.new_name).trim();
          // подходы заменяются целиком: дописывать их вслепую значит
          // удваивать тренировку при повторной правке
          const sets = readSets(patch.sets);
          if (sets.length) ex.sets = sets;
          touched = true;
        } else {
          const sets = readSets(patch.sets);
          if (sets.length) {
            w.exercises.push({ id: uid(), name: String(patch.name).trim(), sets });
            touched = true;
          }
        }
      }
    });

    if (!touched) return;
    addLog('✏️', `Клод поправил тренировку: ${p.title}`);
    toast(`Клод поправил «${p.title}»`, 'gold');
  } else if (item.kind === 'meal') {
    const title = String(p.title || 'Приём пищи').trim() || 'Приём пищи';
    // date поддерживают все остальные kind — у приёмов пищи он терялся, и еда,
    // записанная задним числом, всё равно ложилась на сегодняшний день
    const mealDate = p.date || todayStr();
    addMealEntry({
      title, grams: Number(p.grams) || 100, date: mealDate, time: p.time || '',
      kcal: Number(p.kcal) || 0, protein: Number(p.protein) || 0,
      fat: Number(p.fat) || 0, carbs: Number(p.carbs) || 0, source: 'agent',
    });
    toast(`Клод добавил приём пищи: ${title}${mealDate !== todayStr() ? ' · ' + fmtDateHuman(mealDate) : ''}`, 'gold');
  } else if (item.kind === 'meal_update' || item.kind === 'meal_delete') {
    // Клод не видит дневник и не знает id записей, поэтому адресует их по
    // названию и дате. При нескольких совпадениях по умолчанию не делаем
    // ничего: молча тронуть не ту запись хуже, чем не тронуть никакую.
    const needle = String(p.title || '').trim().toLowerCase();
    const date = String(p.date || '').trim();
    if (!needle || !date) return;
    const found = state.nutrition.entries.filter(e =>
      e.date === date && String(e.title || '').toLowerCase().includes(needle));

    if (!found.length) {
      toast(`Клод не нашёл «${p.title}» за ${fmtDateHuman(date)}`, 'red');
      return;
    }
    if (found.length > 1 && !p.all) {
      toast(`Под «${p.title}» за ${fmtDateHuman(date)} подходит ${found.length} записи — Клод не стал угадывать`, 'red');
      return;
    }

    if (item.kind === 'meal_delete') {
      const ids = new Set(found.map(e => e.id));
      state.nutrition.entries = state.nutrition.entries.filter(e => !ids.has(e.id));
      ids.forEach(id => markDeleted(id));
      addLog('🗑️', `Клод удалил из дневника: ${p.title}`);
      toast(`Клод удалил ${found.length === 1 ? `«${p.title}»` : `${found.length} записи`}`, 'gold');
      return;
    }

    const patch = {};
    if (p.new_title != null && String(p.new_title).trim()) patch.title = String(p.new_title).trim();
    if (p.new_date != null && String(p.new_date).trim()) patch.date = String(p.new_date).trim();
    if (p.time != null) patch.time = String(p.time);
    ['grams', 'kcal', 'protein', 'fat', 'carbs'].forEach(k => {
      if (p[k] != null && isFinite(Number(p[k]))) patch[k] = Number(p[k]);
    });
    if (!Object.keys(patch).length) return;
    found.forEach(e => Object.assign(e, patch));
    addLog('✏️', `Клод поправил запись: ${p.title}`);
    toast(patch.date
      ? `Клод перенёс «${p.title}» на ${fmtDateHuman(patch.date)}`
      : `Клод поправил «${p.title}»`, 'gold');
  } else if (item.kind === 'measurement') {
    // На одну дату — один замер, то же правило, что и в форме. Поэтому запись
    // от Клода не плодит вторую строку за день, а дописывает поля в ту, что уже
    // есть: этим же путём диктуется «в замер от 6 августа добавь грудь 118».
    // Пустые поля не трогаются — замер частичный по своей природе, и обнулять
    // то, о чём не сказали, значит терять данные.
    const date = String(p.date || '').trim() || todayStr();
    const patch = {};
    ['weight', 'neck', 'shoulders', 'chest', 'biceps', 'waist', 'hips'].forEach(k => {
      if (p[k] == null || p[k] === '') return;
      const num = Number(p[k]);
      if (isFinite(num) && num > 0) patch[k] = num;
    });
    if (p.note != null && String(p.note).trim()) patch.note = String(p.note).trim();
    if (!Object.keys(patch).length) return;
    const existing = state.body.entries.find(e => e.date === date);
    if (existing) Object.assign(existing, patch);
    else state.body.entries.push({ id: uid(), date, note: '', ...patch, createdAt: nowISO() });
    // свежий вес уезжает в профиль питания той же дорогой, что и при ручном вводе
    syncWeightToNutrition();
    addLog('📏', `Замер записан Клодом: ${fmtDateHuman(date)}`);
    toast(`Клод ${existing ? 'дополнил' : 'записал'} замер за ${fmtDateHuman(date)}`, 'gold');
  } else if (item.kind === 'task') {
    const title = String(p.title || '').trim();
    if (!title) return;
    state.todos.push({
      id: uid(), title, date: p.date || todayStr(),
      note: String(p.note || '').trim(), done: false, doneAt: null, createdAt: nowISO(),
    });
    addLog('➕', `Задача создана Клодом: ${title}`);
    toast(`Клод добавил задачу: ${title}`, 'gold');
  } else if (item.kind === 'journal') {
    const date = p.date || todayStr();
    const wins = Array.isArray(p.wins) ? p.wins.map(s => String(s).trim()).filter(Boolean) : [];
    const gratitude = Array.isArray(p.gratitude) ? p.gratitude.map(s => String(s).trim()).filter(Boolean) : [];
    const text = String(p.text || '').trim();
    const mood = Number(p.mood) || 3;
    if (!wins.length && !gratitude.length && !text) return;
    const existing = state.journal.find(j => j.date === date);
    if (existing) Object.assign(existing, { mood, wins, gratitude, text, updatedAt: nowISO() });
    else state.journal.unshift({ id: uid(), date, mood, wins, gratitude, text, createdAt: nowISO() });
    addLog('📔', 'Запись в журнале от Клода');
    toast('Клод сделал запись в журнале', 'gold');
  } else if (item.kind === 'goal') {
    const title = String(p.title || '').trim();
    if (!title) return;
    const hasTarget = p.target != null && Number(p.target) > 0;
    state.goals.push({
      id: uid(), title, note: String(p.note || '').trim(),
      kind: hasTarget ? 'numeric' : 'boolean',
      target: hasTarget ? Number(p.target) : 1,
      unit: p.unit || '', milestones: [],
      moneyReward: Number(p.moneyReward) || 0, deadline: p.deadline || null,
      current: 0, progressLog: [], done: false, doneAt: null, createdAt: nowISO(),
    });
    addLog('🎯', `Цель создана Клодом: ${title}`);
    toast(`Клод добавил цель: ${title}`, 'gold');
  } else if (item.kind === 'wish') {
    const title = String(p.title || '').trim();
    if (!title) return;
    state.wishes.push({
      id: uid(), title, note: String(p.note || '').trim(), icon: 'sparkle', image: null,
      done: false, doneAt: null, createdAt: nowISO(),
    });
    addLog('🌠', `Желание добавлено Клодом: ${title}`);
    toast(`Клод добавил желание: ${title}`, 'gold');
  } else if (item.kind === 'habit_log') {
    const name = String(p.name || '').trim().toLowerCase();
    const h = state.habits.find(x => x.title.trim().toLowerCase() === name);
    if (!h) { toast(`Клод не нашёл привычку «${p.name}»`, 'red'); return; }
    const today = todayStr();
    if (h.lastDay !== today) { h.lastDay = today; h.todayCount = 0; }
    if (p.direction === 'down') { h.downCount = (h.downCount || 0) + 1; addLog('⚠️', `Сорвался на «${h.title}» (Клод)`); }
    else { h.upCount = (h.upCount || 0) + 1; h.todayCount = (h.todayCount || 0) + 1; addLog('🔁', `Привычка «${h.title}» отмечена Клодом`); }
    h.history = h.history || [];
    h.history.push({ date: today, dir: p.direction === 'down' ? -1 : 1 });
    if (h.history.length > 400) h.history = h.history.slice(-400);
    toast(`Клод отметил привычку: ${h.title}`, 'gold');
  } else if (item.kind === 'daily_done') {
    const name = String(p.name || '').trim().toLowerCase();
    const d = state.dailies.find(x => x.title.trim().toLowerCase() === name);
    if (!d) { toast(`Клод не нашёл ежедневку «${p.name}»`, 'red'); return; }
    const today = todayStr();
    if (!d.history.includes(today)) {
      d.history.push(today); d.history.sort(); recomputeStreak(d);
      addLog('📅', `Ежедневка выполнена Клодом: ${d.title} (стрик ${d.streak})`);
    }
    toast(`Клод выполнил ежедневку: ${d.title}`, 'gold');
  } else if (item.kind === 'task_update' || item.kind === 'task_delete') {
    const found = agentFind(state.todos, p, 'задачу');
    if (!found) return;
    const name = found.length === 1 ? `«${found[0].title}»` : `${found.length} задачи`;
    if (item.kind === 'task_delete') {
      const ids = new Set(found.map(t => t.id));
      state.todos = state.todos.filter(t => !ids.has(t.id));
      ids.forEach(id => markDeleted(id));
      addLog('🗑️', `Клод удалил задачу: ${p.title}`);
      toast(`Клод удалил ${name}`, 'gold');
      return;
    }
    found.forEach(t => {
      if (agentStr(p.new_title)) t.title = agentStr(p.new_title);
      if (agentStr(p.new_date)) t.date = agentStr(p.new_date);
      if (p.note != null) t.note = String(p.note).trim();
      if (p.done === true && !t.done) {
        t.done = true; t.doneAt = nowISO();
        addLog('✅', `Задача выполнена (Клод): ${t.title}`);
      } else if (p.done === false && t.done) {
        t.done = false; t.doneAt = null;
      }
    });
    toast(`Клод ${p.done === true ? 'закрыл' : 'поправил'} ${name}`, 'gold');
  } else if (item.kind === 'transaction_update' || item.kind === 'transaction_delete') {
    // у операции нет названия — ищем по дате, сумме и куску категории или
    // заметки; дата обязательна, иначе под «5000» попадёт полгода истории
    if (!agentStr(p.date)) return;
    const cat = String(p.category || '').trim().toLowerCase();
    const list = state.finance.transactions.filter(tx =>
      (p.amount == null || Number(tx.amount) === Math.abs(Number(p.amount))) &&
      (!cat || `${tx.category} ${tx.note}`.toLowerCase().includes(cat)));
    const found = agentFind(list, { ...p, title: '' }, 'операцию', { dateOnly: true });
    if (!found) return;
    if (item.kind === 'transaction_delete') {
      found.forEach(tx => deleteTransaction(tx.id));
      addLog('🗑️', `Клод удалил операцию за ${fmtDateHuman(p.date)}`);
      toast(`Клод удалил ${found.length === 1 ? `операцию ${fmtMoney(found[0].amount)}` : `${found.length} операции`}`, 'gold');
      return;
    }
    // баланс счёта держится на эффекте операции: снимаем старый, правим,
    // накладываем новый — иначе правка суммы разъедется с остатком на счёте
    found.forEach(tx => {
      applyTxEffect(tx, -1);
      if (p.new_amount != null && Number(p.new_amount) > 0) tx.amount = Math.abs(Number(p.new_amount));
      if (p.new_type === 'income' || p.new_type === 'expense') tx.type = p.new_type;
      if (agentStr(p.new_category)) tx.category = agentStr(p.new_category);
      if (p.note != null) tx.note = String(p.note).trim();
      if (agentStr(p.new_date)) tx.date = agentStr(p.new_date);
      applyTxEffect(tx, 1);
    });
    addLog('✏️', `Клод поправил операцию за ${fmtDateHuman(p.date)}`);
    toast('Клод поправил операцию', 'gold');
  } else if (item.kind === 'goal_update' || item.kind === 'goal_delete') {
    const found = agentFind(state.goals, p, 'цель');
    if (!found) return;
    if (item.kind === 'goal_delete') {
      const ids = new Set(found.map(g => g.id));
      state.goals = state.goals.filter(g => !ids.has(g.id));
      ids.forEach(id => markDeleted(id));
      addLog('🗑️', `Клод удалил цель: ${p.title}`);
      toast(`Клод удалил цель «${found[0].title}»`, 'gold');
      return;
    }
    found.forEach(g => {
      if (agentStr(p.new_title)) g.title = agentStr(p.new_title);
      if (p.note != null) g.note = String(p.note).trim();
      if (p.deadline != null) g.deadline = agentStr(p.deadline);
      if (p.target != null && Number(p.target) > 0 && g.kind === 'numeric') g.target = Number(p.target);
      if (p.moneyReward != null) g.moneyReward = Number(p.moneyReward) || 0;
    });
    addLog('✏️', `Клод поправил цель: ${p.title}`);
    toast(`Клод поправил цель «${found[0].title}»`, 'gold');
  } else if (item.kind === 'wish_update' || item.kind === 'wish_delete') {
    const found = agentFind(state.wishes, p, 'желание');
    if (!found) return;
    if (item.kind === 'wish_delete') {
      const ids = new Set(found.map(w => w.id));
      state.wishes = state.wishes.filter(w => !ids.has(w.id));
      ids.forEach(id => markDeleted(id));
      addLog('🗑️', `Клод удалил желание: ${p.title}`);
      toast(`Клод удалил желание «${found[0].title}»`, 'gold');
      return;
    }
    found.forEach(w => {
      if (agentStr(p.new_title)) w.title = agentStr(p.new_title);
      if (p.note != null) w.note = String(p.note).trim();
      if (p.done === true && !w.done) { w.done = true; w.doneAt = nowISO(); }
      else if (p.done === false) { w.done = false; w.doneAt = null; }
    });
    toast(`Клод поправил желание «${found[0].title}»`, 'gold');
  } else if (item.kind === 'measurement_delete') {
    // замер на дату один, так что дата называет его однозначно;
    // правка идёт через add_measurement — он дописывает поля в тот же замер
    const date = agentStr(p.date);
    if (!date) return;
    const gone = state.body.entries.filter(e => e.date === date);
    if (!gone.length) { toast(`Клод не нашёл замер за ${fmtDateHuman(date)}`, 'red'); return; }
    state.body.entries = state.body.entries.filter(e => e.date !== date);
    gone.forEach(e => markDeleted(e.id));
    syncWeightToNutrition();
    addLog('🗑️', `Клод удалил замер за ${fmtDateHuman(date)}`);
    toast(`Клод удалил замер за ${fmtDateHuman(date)}`, 'gold');
  }
}

/* ---- Навигация --------------------------------------------------------- */
function renderNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === currentTab);
  });
  positionNavIndicators();
}

/* Плавающая «пилюля» под активным пунктом — двигаем её transform'ом
   к позиции активной кнопки, а не пересоздаём фон на каждой кнопке. */
function positionNavIndicators() {
  const nav = document.getElementById('mainNav');
  const navInd = document.getElementById('navIndicator');
  if (nav && navInd) {
    const active = nav.querySelector('.nav-btn.active');
    if (active) {
      navInd.style.transform = `translateY(${active.offsetTop}px)`;
      navInd.style.height = active.offsetHeight + 'px';
      navInd.classList.add('on');
    } else {
      navInd.classList.remove('on');
    }
  }
  const bn = document.getElementById('bottomNav');
  const bnInd = document.getElementById('bnIndicator');
  if (bn && bnInd) {
    const active = bn.querySelector('.bn-btn.active');
    if (active) {
      bnInd.style.transform = `translateX(${active.offsetLeft}px)`;
      bnInd.style.width = active.offsetWidth + 'px';
      bnInd.classList.add('on');
    } else {
      bnInd.classList.remove('on');
    }
  }
}

function goTab(tab) {
  currentTab = tab;
  closeSidebar();
  renderAll();
  // короткая анимация появления контента при переходе между вкладками —
  // снимаем и тут же ставим класс заново, иначе повторный переход не переиграет анимацию
  const c = content();
  c.classList.remove('tab-enter');
  void c.offsetWidth;
  c.classList.add('tab-enter');
  window.scrollTo({ top: 0 });
}

/* ---- Диспетчер вкладок -------------------------------------------------- */
const TAB_RENDERERS = {
  home: renderHome,
  tasks: renderTasks,
  goals: renderGoals,
  wishes: renderWishes,
  nutrition: renderNutrition,
  workouts: renderWorkouts,
  sleep: renderSleep,
  body: renderBody,
  finance: renderFinance,
  stats: renderStats,
  journal: renderJournal,
  settings: renderSettings,
};

/* Разделы с закреплённым цветом (см. --sec в style.css) — используется и для
   точки перед заголовком страницы, и для цветных иконок в «Итогах недели».
   Главная и настройки нейтральные — dataset.section для них не выставляем,
   чтобы точка перед заголовком там не появлялась вовсе. */
const SECTION_COLORS = {
  tasks: 'var(--accent)', stats: 'var(--accent)',
  goals: 'var(--gold)', journal: 'var(--gold)',
  wishes: 'var(--accent-2)', sleep: 'var(--accent-2)',
  finance: 'var(--green)', nutrition: 'var(--cyan)', workouts: 'var(--orange)',
  body: 'var(--cyan)',
};

function renderAll() {
  renderNav();
  renderSyncBadge();
  if (SECTION_COLORS[currentTab]) content().dataset.section = currentTab;
  else delete content().dataset.section;
  (TAB_RENDERERS[currentTab] || renderHome)();
}

/* ---- Боковая панель на телефоне (сайдбар как оверлей) --------------------
   Первая попытка (position:fixed на body + подложка) на реальном iOS у
   пользователя залипала — экран темнел и переставал скроллиться вообще,
   хотя в эмуляции работало нормально. Откатил на минимальный, ничего не
   двигающий вариант: пока панель открыта, просто гасим тач-скролл вне
   самой панели через touchmove — без position:fixed, без подложки, без
   пересчёта scrollY. Внутри панели свой overflow-y работает как обычно
   (слушатель ничего не делает, если жест начался внутри неё). */
function sidebarOpen() { return document.getElementById('sidebar').classList.contains('open'); }
function openSidebar() { document.getElementById('sidebar').classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); }
function toggleSidebar() { sidebarOpen() ? closeSidebar() : openSidebar(); }

function blockScrollOutsideSidebar(e) {
  if (!sidebarOpen()) return;
  const sidebar = document.getElementById('sidebar');
  const insideSidebar = e.target.closest('#sidebar');
  // Список пунктов почти всегда целиком помещается на экран — скроллить
  // внутри панели физически нечего. Раньше здесь просто пропускался любой
  // жест, начавшийся внутри неё — а раз внутри скроллить некому, жест
  // проваливался на страницу позади. Теперь гасим ВСЕГДА, кроме случая,
  // когда пунктов реально стало больше высоты экрана — тогда даём панели
  // проскроллить саму себя как обычно.
  if (insideSidebar && sidebar.scrollHeight > sidebar.clientHeight) return;
  e.preventDefault();
}

function applyTheme() {
  const root = document.documentElement;
  root.setAttribute('data-theme', state.settings.theme === 'light' ? 'light' : 'dark');
  root.setAttribute('data-accent', state.settings.accent || 'violet');
}

/* ---- Запуск ------------------------------------------------------------- */
function init() {
  renderStaticIcons();

  // ярлыки приложения открывают нужную вкладку: index.html#tasks
  const hash = location.hash.replace('#', '');
  if (TAB_RENDERERS[hash]) currentTab = hash;

  // слушаем на всём сайдбаре — так под неё же попадает и «Настройки» из подвала
  document.getElementById('sidebar').addEventListener('click', e => {
    const btn = e.target.closest('.nav-btn[data-tab]');
    if (btn) goTab(btn.dataset.tab);
  });

  const sidebar = document.getElementById('sidebar');
  document.getElementById('mobileMenuBtn').addEventListener('click', toggleSidebar);

  // нижняя панель на телефоне: прямые разделы работают как обычная навигация,
  // «Ещё» открывает ту же боковую панель со всем списком
  document.getElementById('bottomNav').addEventListener('click', e => {
    const tabBtn = e.target.closest('.nav-btn[data-tab]');
    if (tabBtn) { goTab(tabBtn.dataset.tab); return; }
    if (e.target.closest('#bottomMoreBtn')) toggleSidebar();
  });

  // на телефоне меню закрывается тапом мимо него
  document.addEventListener('click', e => {
    if (!sidebar.classList.contains('open')) return;
    if (sidebar.contains(e.target) || e.target.closest('#mobileMenuBtn') || e.target.closest('#bottomMoreBtn')) return;
    closeSidebar();
  });
  // пока панель открыта — не даём странице позади неё скроллиться от тача
  document.addEventListener('touchmove', blockScrollOutsideSidebar, { passive: false });

  window.addEventListener('resize', positionNavIndicators);
  blockPinchZoom();

  document.getElementById('todayDate').textContent =
    new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  applyTheme();
  registerServiceWorker();
  initSync();
  initReminders();

  state.dailies.forEach(recomputeStreak);
  runCron();
  saveState();
  renderAll();

  if (state.migratedFromV1) {
    delete state.migratedFromV1;
    saveState();
    toast('Данные из прошлой версии перенесены', 'green');
  }
}

/* ---- Блокировка приближения жестами -------------------------------------
   iOS Safari игнорирует user-scalable=no в самом Safari (доступность),
   а touch-action не всегда полностью гасит щипок — поэтому вручную
   гасим жесты на уровне событий, как делают нативные обёртки. */
function blockPinchZoom() {
  // Safari: специальные жестовые события для щипка (двумя пальцами)
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('gesturechange', e => e.preventDefault());
  document.addEventListener('gestureend', e => e.preventDefault());

  // Chrome/Android и подстраховка для Safari: щипок — это ≥2 касаний.
  // Двойной тап отдельно не гасим здесь — за это отвечает touch-action
  // в CSS, а ловить его через touchend рискованно: preventDefault там
  // может съесть настоящий клик при быстрых повторных тапах по кнопке.
  document.addEventListener('touchmove', e => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
}

/* ---- Установка на телефон и офлайн-режим -------------------------------- */
let installPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();               // показываем свою кнопку вместо баннера браузера
  installPrompt = e;
  if (currentTab === 'settings') renderAll();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  toast('Приложение установлено на устройство', 'green');
});

function canInstall() { return !!installPrompt; }

/* Запущено с домашнего экрана, а не во вкладке браузера? */
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}

async function promptInstall() {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  renderAll();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // при открытии файла напрямую (file://) service worker недоступен — это нормально
  if (location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .catch(err => console.warn('Офлайн-режим не включился:', err));
  });
}

function offlineReady() {
  return 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
}

init();
