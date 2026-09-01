/* =========================================================================
   state.js — константы игры, состояние, хранилище, миграции
   ========================================================================= */

const STORAGE_KEY = 'gamelife_state_v2';
const LEGACY_KEY = 'gamelife_state_v1';

/* ---- Сложность задач (просто метка-приоритет, без наград) ------------ */
const DIFFICULTY = {
  trivial: { label: 'Тривиальная', icon: '○' },
  easy:    { label: 'Лёгкая',      icon: '◔' },
  medium:  { label: 'Средняя',     icon: '◑' },
  hard:    { label: 'Сложная',     icon: '●' },
};

/* ---- Настроение для журнала ------------------------------------------ */
const MOODS = [
  { id: 5, icon: '🤩', label: 'Отлично' },
  { id: 4, icon: '🙂', label: 'Хорошо' },
  { id: 3, icon: '😐', label: 'Нормально' },
  { id: 2, icon: '😕', label: 'Так себе' },
  { id: 1, icon: '😞', label: 'Плохо' },
];

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/* ---- Утилиты дат ----------------------------------------------------- */
function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
}
function dateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function todayStr() { return dateStr(new Date()); }
function parseDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function fmtDateHuman(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
function daysBetween(isoA, isoB) {
  return Math.round((parseDate(isoB) - parseDate(isoA)) / 86400000);
}
function nowISO() { return new Date().toISOString(); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

/* ---- Дефолтное состояние --------------------------------------------- */
function defaultState() {
  return {
    version: 2,
    settings: { theme: 'dark', accent: 'violet', currency: '₸', sound: true, confetti: true },
    player: {
      name: 'Игрок', avatar: '🧙',
      createdAt: nowISO(),
    },
    habits: [],
    dailies: [],
    todos: [],
    goals: [],
    wishes: [],   // карта желаний: {id, title, note, icon, image, done, doneAt}
    workouts: [], // тренировки: {id, date, title, note, exercises: [{id, name, sets: [{weight, reps}]}]}
    finance: {
      accounts: [
        { id: 'main', name: 'Основной счёт', icon: '💳', type: 'card', balance: 0, creditLimit: 0, color: '#7c5cff', createdAt: nowISO() },
      ],
      transactions: [],           // {id, date, time, amount, type: income|expense|transfer, category, note, accountId, toAccountId}
      customCategories: { income: [], expense: [] },  // {name, icon}
      budgets: [],                 // {id, category, limit} — лимит трат в месяц, category === '__total__' — общий лимит
    },
    journal: [],
    nutrition: {
      // профиль нужен только для расчёта суточной нормы
      profile: { sex: 'male', age: 30, height: 175, weight: 70, activity: 1.375, goal: 'maintain' },
      targets: { auto: true, kcal: 2000, protein: 120, fat: 65, carbs: 220 },
      entries: [],      // съеденное: по одной записи на приём пищи
      dictionary: [],   // личный словарь блюд для повторного добавления в один тап
    },
    log: [],
    lastCron: todayStr(),
    // очередь записей от Клода (через MCP-коннектор) — приходит с сервера через
    // синхронизацию, applyAgentItem() в main.js разбирает и сразу же очищает
    agentInbox: [],
  };
}

/* ---- Загрузка / сохранение ------------------------------------------ */
let state = loadState();

function deepMergeDefaults(target, def) {
  const out = { ...def, ...target };
  for (const key of Object.keys(def)) {
    const dv = def[key];
    if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
      out[key] = { ...dv, ...(target && target[key] ? target[key] : {}) };
    }
  }
  return out;
}

function loadState() {
  const d = defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw), d);

    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return migrateV1(JSON.parse(legacy), d);
  } catch (e) {
    console.error('Не удалось загрузить состояние:', e);
  }
  return d;
}

function normalize(parsed, d) {
  const s = deepMergeDefaults(parsed, d);
  s.player = deepMergeDefaults(parsed.player || {}, d.player);
  s.settings = deepMergeDefaults(parsed.settings || {}, d.settings);
  s.finance = deepMergeDefaults(parsed.finance || {}, d.finance);
  s.finance.customCategories = deepMergeDefaults((parsed.finance || {}).customCategories || {}, d.finance.customCategories);
  if (!Array.isArray(s.finance.accounts) || !s.finance.accounts.length) s.finance.accounts = d.finance.accounts.map(a => ({ ...a }));
  if (!Array.isArray(s.finance.transactions)) s.finance.transactions = [];
  if (!Array.isArray(s.finance.budgets)) s.finance.budgets = [];
  // старые операции могли быть записаны до появления счетов — привязываем к первому счёту
  // и пересчитываем его баланс, чтобы он совпадал с тем, что показывалось раньше
  const fallbackAccountId = s.finance.accounts[0].id;
  let needsBalanceRecalc = false;
  s.finance.transactions.forEach(t => {
    if (!t.accountId) { t.accountId = fallbackAccountId; needsBalanceRecalc = true; }
  });
  if (needsBalanceRecalc) {
    const acc = s.finance.accounts.find(a => a.id === fallbackAccountId);
    if (acc && !acc.balanceRecalculated) {
      acc.balance = s.finance.transactions
        .filter(t => t.accountId === fallbackAccountId)
        .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0);
      acc.balanceRecalculated = true;
    }
  }

  const pn = parsed.nutrition || {};
  s.nutrition = deepMergeDefaults(pn, d.nutrition);
  s.nutrition.profile = { ...d.nutrition.profile, ...(pn.profile || {}) };
  s.nutrition.targets = { ...d.nutrition.targets, ...(pn.targets || {}) };
  if (!Array.isArray(s.nutrition.entries)) s.nutrition.entries = [];
  if (!Array.isArray(s.nutrition.dictionary)) s.nutrition.dictionary = [];

  // массивы должны остаться массивами
  for (const key of ['habits', 'dailies', 'todos', 'goals', 'wishes', 'workouts', 'journal', 'log', 'agentInbox']) {
    if (!Array.isArray(s[key])) s[key] = d[key];
  }
  if (!s.lastCron) s.lastCron = todayStr();
  return s;
}

/* Перенос данных из первой версии приложения */
function migrateV1(old, d) {
  const s = d;
  if (old.player) {
    s.player.name = old.player.name || s.player.name;
    s.player.avatar = old.player.avatar || s.player.avatar;
    s.player.createdAt = old.player.createdAt || s.player.createdAt;
  }
  if (old.settings) {
    s.settings.theme = old.settings.theme || s.settings.theme;
    // валюту из первой версии не переносим: там по умолчанию стоял рубль
  }

  // старые квесты -> задачи (to-do)
  (old.quests || []).forEach(q => {
    s.todos.push({
      id: q.id || uid(), title: q.title, note: '',
      difficulty: 'easy', due: q.dueDate || null, tags: [], checklist: [],
      done: !!q.done, doneAt: q.doneAt || null, createdAt: q.createdAt || nowISO(),
    });
  });
  // старые привычки -> ежедневки (они были с ежедневным чекином)
  (old.habits || []).forEach(h => {
    s.dailies.push({
      id: h.id || uid(), title: h.title, icon: h.icon || '🔥', note: '',
      difficulty: 'easy', days: [0, 1, 2, 3, 4, 5, 6], checklist: [], tags: [],
      history: Array.isArray(h.history) ? h.history : [], streak: h.streak || 0, best: h.best || 0,
      createdAt: h.createdAt || nowISO(),
    });
  });
  (old.goals || []).forEach(g => {
    s.goals.push({ ...g, milestones: [], tags: [] });
  });
  if (old.finance && Array.isArray(old.finance.transactions)) s.finance.transactions = old.finance.transactions;
  if (Array.isArray(old.log)) s.log = old.log;
  s.migratedFromV1 = true;
  return s;
}

function saveState() {
  try {
    state.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // синхронизация подключается отдельным файлом и может отсутствовать
    if (typeof onStateSaved === 'function') onStateSaved();
  } catch (e) {
    console.error('Не удалось сохранить состояние:', e);
    if (typeof toast === 'function') toast('⚠️ Не удалось сохранить данные — хранилище браузера переполнено', 'red');
  }
}
