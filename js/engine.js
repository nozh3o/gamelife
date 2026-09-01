/* =========================================================================
   engine.js — игровая механика: опыт, здоровье, мана, золото, классы,
   бонусы питомцев, босс, суточный пересчёт (крон), достижения
   ========================================================================= */

/* ---- Производные значения -------------------------------------------- */
function playerLevel() { return levelInfo(state.player.xp).level; }
function maxMp() { return 30 + playerLevel() * 2; }
function currentClass() { return state.player.cls ? CLASSES[state.player.cls] : null; }

function petBonus(kind) {
  let bonus = 0;
  for (const p of state.pets) {
    const def = PETS.find(x => x.id === p.id);
    if (!def || def.bonus !== kind) continue;
    bonus += p.isMount ? def.bonusVal * 2 : def.bonusVal;
  }
  return bonus;
}

function xpMultiplier() {
  const cls = currentClass();
  let m = cls ? cls.perks.xpMult : 1;
  m += petBonus('xp');
  if (state.player.buffs.xp > 0) m *= 2;
  return m;
}
function goldMultiplier() {
  const cls = currentClass();
  let m = cls ? cls.perks.goldMult : 1;
  m += petBonus('gold');
  if (state.player.buffs.gold > 0) m *= 2;
  return m;
}
function damageMultiplier() {
  const cls = currentClass();
  return cls ? cls.perks.damageMult : 1;
}
function maxHp() {
  return Math.round(50 * (1 + petBonus('hp')));
}

/* ---- Журнал событий --------------------------------------------------- */
function addLog(icon, text) {
  state.log.unshift({ id: uid(), date: nowISO(), icon, text });
  if (state.log.length > 120) state.log.length = 120;
}

/* ---- Учёт активности по дням ------------------------------------------ */
function recordActivity(xp, tasks = 1) {
  const key = todayStr();
  const a = state.activity[key] || { xp: 0, tasks: 0 };
  a.xp += Math.round(xp);
  a.tasks += tasks;
  state.activity[key] = a;
}

/* ---- Опыт и уровни ---------------------------------------------------- */
function grantXp(rawAmount, statId) {
  if (!rawAmount) return 0;
  const amount = Math.max(1, Math.round(rawAmount));
  const before = playerLevel();
  state.player.xp = Math.max(0, state.player.xp + amount);
  const after = playerLevel();

  if (statId) {
    const stat = statById(statId);
    if (stat) stat.xp = Math.max(0, stat.xp + amount);
  }
  if (after > before) {
    state.player.skillPoints += (after - before);
    state.player.hp = maxHp();      // на новом уровне здоровье восстанавливается
    state.player.mp = maxMp();
    showLevelUp(after);
    addLog('⭐', `Новый уровень персонажа: ${after}`);
    if (after === 10 && !state.player.cls) {
      addLog('🎓', 'Открыт выбор класса! Загляни во вкладку «Персонаж».');
      toast('🎓 Уровень 10 — открыт выбор класса!', 'gold');
    }
  }
  return amount;
}

function grantGold(rawAmount) {
  const amount = Math.round(rawAmount);
  state.player.gold = Math.max(0, state.player.gold + amount);
  return amount;
}
function grantMp(amount) {
  state.player.mp = clamp(state.player.mp + amount, 0, maxMp());
}
function healHp(amount) {
  state.player.hp = clamp(state.player.hp + amount, 0, maxHp());
}

/* ---- Награда за выполненное дело -------------------------------------- */
function rewardForTask(difficultyKey, statId, { streakBonus = 0, silent = false } = {}) {
  const mult = (DIFFICULTY[difficultyKey] || DIFFICULTY.easy).mult;
  const streakMult = 1 + Math.min(streakBonus * 0.02, 0.5); // до +50% за длинный стрик

  const xp = Math.max(1, Math.round(BASE_XP * mult * xpMultiplier() * streakMult));
  const gold = Math.max(1, Math.round(BASE_GOLD * mult * goldMultiplier() * streakMult));
  const mp = Math.round(BASE_MP * mult);

  grantXp(xp, statId);
  grantGold(gold);
  grantMp(mp);
  recordActivity(xp);
  consumeBuffs();
  damageBoss(mult);

  if (!silent) {
    SFX.complete();
    floatText(`+${xp} XP  +${gold} 🪙`, 'good');
  }
  return { xp, gold, mp };
}

/* Расход разовых баффов (действуют на 3 задачи) */
function consumeBuffs() {
  const b = state.player.buffs;
  if (b.xp > 0) b.xp--;
  if (b.gold > 0) b.gold--;
}

/* ---- Урон и смерть ---------------------------------------------------- */
function applyDamage(rawAmount, reason) {
  // Свиток защиты полностью поглощает урон
  if (state.player.buffs.shield > 0) {
    state.player.buffs.shield--;
    addLog('🛡️', `Свиток защиты поглотил урон: ${reason}`);
    return 0;
  }
  const dmg = Math.max(1, Math.round(rawAmount * damageMultiplier()));
  state.player.hp -= dmg;
  addLog('💔', `−${dmg} HP: ${reason}`);
  checkDeath();
  return dmg;
}

function checkDeath() {
  if (state.player.hp > 0) return false;
  const lvl = playerLevel();
  const newLevel = Math.max(1, lvl - 1);
  state.player.xp = xpForLevel(newLevel);
  state.player.gold = 0;
  state.player.hp = maxHp();
  state.player.mp = 0;
  state.player.deaths++;
  addLog('☠️', `Здоровье кончилось. Потерян уровень (теперь ${newLevel}) и всё золото.`);
  toast('☠️ Персонаж пал: минус уровень и всё золото. Начинаем заново!', 'red');
  SFX.damage();
  return true;
}

/* ---- Босс ------------------------------------------------------------- */
function damageBoss(mult) {
  const b = state.boss.active;
  if (!b) return;
  const dmg = Math.max(1, Math.round(3 * mult));
  b.hp -= dmg;
  if (b.hp <= 0) defeatBoss();
}
function defeatBoss() {
  const b = state.boss.active;
  if (!b) return;
  const def = BOSSES.find(x => x.id === b.id);
  state.boss.defeated.push({ id: b.id, date: nowISO() });
  state.boss.active = null;
  if (def) {
    grantXp(def.reward.xp);
    grantGold(def.reward.gold);
    state.player.gems += def.reward.gems;
    addLog('🏅', `Босс повержен: ${def.name}! +${def.reward.xp} XP, +${def.reward.gold} золота, +${def.reward.gems} 💎`);
    toast(`🏅 ${def.name} повержен!`, 'gold');
    confetti(120);
    SFX.levelUp();
  }
}
function startBoss(id) {
  const def = BOSSES.find(x => x.id === id);
  if (!def) return;
  state.boss.active = { id: def.id, hp: def.hp, maxHp: def.hp, startedAt: nowISO() };
  addLog(def.icon, `Начат бой с боссом: ${def.name}`);
}

/* ---- Навыки классов --------------------------------------------------- */
function castSkill() {
  const cls = currentClass();
  if (!cls) return;
  const sk = cls.skill;
  if (state.player.mp < sk.cost) {
    toast('Недостаточно маны', 'red');
    return;
  }
  state.player.mp -= sk.cost;
  switch (sk.id) {
    case 'rage':    state.player.buffs.gold = 3; toast('🔥 Ярость: следующие 3 задачи дают двойное золото', 'gold'); break;
    case 'insight': state.player.buffs.xp = 3;   toast('✨ Озарение: следующие 3 задачи дают двойной опыт', 'gold'); break;
    case 'heal':    healHp(20);                  toast('💊 Восстановлено 20 здоровья', 'green'); break;
    case 'steal':   state.player.buffs.shield += 1; toast('🎲 Получена защита от одного пропуска', 'green'); break;
  }
  addLog(sk.icon, `Применён навык: ${sk.name}`);
  SFX.coin();
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

/* ---- Суточный пересчёт (крон) ------------------------------------------ */
function runCron() {
  const today = todayStr();
  if (state.lastCron === today) return null;

  const cursor = parseDate(state.lastCron);
  const end = parseDate(today);
  let totalDmg = 0;
  const missedTitles = [];
  let daysProcessed = 0;

  while (cursor < end && daysProcessed < 60) {
    const ds = dateStr(cursor);
    for (const d of state.dailies) {
      const created = dateStr(new Date(d.createdAt));
      if (ds < created) continue;                 // задача ещё не существовала
      if (!d.days.includes(cursor.getDay())) continue;
      if (d.history.includes(ds)) continue;

      const mult = (DIFFICULTY[d.difficulty] || DIFFICULTY.easy).mult;
      const dealt = applyDamage(BASE_DAMAGE * mult, `пропущено «${d.title}»`);
      if (dealt > 0) {
        totalDmg += dealt;
        missedTitles.push(d.title);
        // босс тоже бьёт за пропуск
        if (state.boss.active) state.boss.hp = state.boss.hp; // босс не лечится, просто пропуск
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    daysProcessed++;
  }

  // пересчёт стриков после пропусков
  state.dailies.forEach(recomputeStreak);

  // ночное восстановление
  grantMp(10);
  const cls = currentClass();
  if (cls && cls.perks.regen) healHp(cls.perks.regen);

  state.lastCron = today;
  saveState();

  if (totalDmg > 0) {
    return { damage: totalDmg, missed: [...new Set(missedTitles)] };
  }
  return null;
}

/* ---- Достижения -------------------------------------------------------- */
const ACHIEVEMENTS = [
  // Задачи
  { id: 'first_todo',  icon: '📝', title: 'Первый шаг',        desc: 'Выполните первую задачу',           check: s => s.todos.some(t => t.done) },
  { id: 'todo_10',     icon: '🗒️', title: 'Разгребатель',      desc: 'Выполните 10 задач',                check: s => s.todos.filter(t => t.done).length >= 10 },
  { id: 'todo_50',     icon: '📚', title: 'Машина продуктивности', desc: 'Выполните 50 задач',            check: s => s.todos.filter(t => t.done).length >= 50 },
  { id: 'todo_200',    icon: '🚀', title: 'Двести дел',         desc: 'Выполните 200 задач',              check: s => s.todos.filter(t => t.done).length >= 200 },
  // Привычки и ежедневки
  { id: 'first_habit', icon: '🌱', title: 'Начало пути',        desc: 'Отметьте привычку хотя бы раз',    check: s => s.habits.some(h => (h.upCount || 0) + (h.downCount || 0) > 0) },
  { id: 'first_daily', icon: '☑️', title: 'День засчитан',      desc: 'Выполните первую ежедневку',       check: s => s.dailies.some(d => d.history.length > 0) },
  { id: 'streak_7',    icon: '🔥', title: 'Неделя дисциплины',  desc: 'Стрик ежедневки 7 дней подряд',    check: s => s.dailies.some(d => (d.best || 0) >= 7) },
  { id: 'streak_30',   icon: '🏅', title: 'Железная воля',      desc: 'Стрик ежедневки 30 дней подряд',   check: s => s.dailies.some(d => (d.best || 0) >= 30) },
  { id: 'streak_100',  icon: '💠', title: 'Сто дней',           desc: 'Стрик ежедневки 100 дней подряд',  check: s => s.dailies.some(d => (d.best || 0) >= 100) },
  { id: 'perfect_day', icon: '🌟', title: 'Идеальный день',     desc: 'Выполните все ежедневки за день (минимум 3)', check: s => {
      const due = s.dailies.filter(isDailyDueToday);
      return due.length >= 3 && due.every(isDailyDoneToday);
    } },
  // Цели
  { id: 'first_goal',  icon: '🎯', title: 'Цель достигнута',    desc: 'Завершите первую цель',            check: s => s.goals.some(g => g.done) },
  { id: 'goal_3',      icon: '🏆', title: 'Целеустремлённый',   desc: 'Завершите 3 цели',                 check: s => s.goals.filter(g => g.done).length >= 3 },
  { id: 'goal_10',     icon: '👑', title: 'Коллекционер целей', desc: 'Завершите 10 целей',               check: s => s.goals.filter(g => g.done).length >= 10 },
  // Уровни
  { id: 'level_5',     icon: '🆙', title: 'Пятый уровень',      desc: 'Достигните 5 уровня',              check: s => levelInfo(s.player.xp).level >= 5 },
  { id: 'level_10',    icon: '🎓', title: 'Выбор пути',         desc: 'Достигните 10 уровня и класса',    check: s => levelInfo(s.player.xp).level >= 10 },
  { id: 'level_25',    icon: '🌠', title: 'Двадцать пятый',     desc: 'Достигните 25 уровня',             check: s => levelInfo(s.player.xp).level >= 25 },
  { id: 'level_50',    icon: '💫', title: 'Легенда',            desc: 'Достигните 50 уровня',             check: s => levelInfo(s.player.xp).level >= 50 },
  { id: 'all_stats_5', icon: '🧭', title: 'Разносторонний',     desc: 'Все характеристики до 5 уровня',   check: s => s.stats.length > 0 && s.stats.every(st => levelInfo(st.xp, 60, 25).level >= 5) },
  // Экономика
  { id: 'gold_500',    icon: '🪙', title: 'Звон монет',         desc: 'Накопите 500 золота',              check: s => s.player.gold >= 500 },
  { id: 'gold_5000',   icon: '💰', title: 'Сундук сокровищ',    desc: 'Накопите 5000 золота',             check: s => s.player.gold >= 5000 },
  { id: 'first_reward',icon: '🎁', title: 'Заслуженная награда',desc: 'Купите свою первую награду',       check: s => s.rewards.some(r => (r.timesBought || 0) > 0) },
  // Реальные финансы
  { id: 'tracker_10',  icon: '📒', title: 'Учётчик',            desc: 'Запишите 10 финансовых операций',  check: s => s.finance.transactions.length >= 10 },
  { id: 'tracker_100', icon: '📊', title: 'Бухгалтер',          desc: 'Запишите 100 финансовых операций', check: s => s.finance.transactions.length >= 100 },
  { id: 'saver',       icon: '🏦', title: 'Накопитель',         desc: 'Реальный баланс от 100 000',       check: s => financeBalance() >= 100000 },
  // Боссы и питомцы
  { id: 'boss_1',      icon: '🦖', title: 'Первая победа',      desc: 'Победите первого босса',           check: s => s.boss.defeated.length >= 1 },
  { id: 'boss_3',      icon: '🐉', title: 'Охотник на боссов',  desc: 'Победите 3 боссов',                check: s => s.boss.defeated.length >= 3 },
  { id: 'boss_all',    icon: '👹', title: 'Победитель кошмаров',desc: 'Победите всех боссов',             check: s => s.boss.defeated.length >= BOSSES.length },
  { id: 'first_pet',   icon: '🐾', title: 'Не один',            desc: 'Заведите первого питомца',         check: s => s.pets.length >= 1 },
  { id: 'mount',       icon: '🐉', title: 'Верный спутник',     desc: 'Вырастите питомца до маунта',      check: s => s.pets.some(p => p.isMount) },
  // Журнал и стойкость
  { id: 'journal_7',   icon: '📔', title: 'Летописец',          desc: 'Сделайте 7 записей в журнале',     check: s => s.journal.length >= 7 },
  { id: 'journal_30',  icon: '📖', title: 'Хронист',            desc: 'Сделайте 30 записей в журнале',    check: s => s.journal.length >= 30 },
  { id: 'phoenix',     icon: '🔥', title: 'Восставший из пепла',desc: 'Продолжить игру после падения',    check: s => s.player.deaths >= 1 },
  { id: 'veteran',     icon: '⏳', title: 'Ветеран',            desc: '30 дней с момента создания героя', check: s => daysBetween(dateStr(new Date(s.player.createdAt)), todayStr()) >= 30 },
];

function checkAchievements() {
  for (const def of ACHIEVEMENTS) {
    if (state.achievements[def.id]) continue;
    let ok = false;
    try { ok = def.check(state); } catch (e) { ok = false; }
    if (ok) {
      state.achievements[def.id] = nowISO();
      state.player.gems += 1;
      addLog('🏆', `Достижение открыто: ${def.title} (+1 💎)`);
      toast(`🏆 ${def.title} — получен кристалл!`, 'gold');
      SFX.achieve();
    }
  }
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
