/* =========================================================================
   state.js — константы игры, состояние, хранилище, миграции
   ========================================================================= */

const STORAGE_KEY = 'gamelife_state_v2';
const LEGACY_KEY = 'gamelife_state_v1';

/* ---- Сложность задач (как в Habitica) ------------------------------- */
const DIFFICULTY = {
  trivial: { label: 'Тривиальная', mult: 0.1, icon: '○' },
  easy:    { label: 'Лёгкая',      mult: 1,   icon: '◔' },
  medium:  { label: 'Средняя',     mult: 1.5, icon: '◑' },
  hard:    { label: 'Сложная',     mult: 2,   icon: '●' },
};
const BASE_XP = 12;
const BASE_GOLD = 7;
const BASE_MP = 3;
const BASE_DAMAGE = 5;

/* ---- Классы персонажа (открываются на 10 уровне) -------------------- */
const CLASSES = {
  warrior: {
    id: 'warrior', name: 'Воин', icon: '⚔️',
    desc: 'Крепкий и упорный. Получает на 30% меньше урона и больше золота за сложные задачи.',
    perks: { damageMult: 0.7, goldMult: 1.15, xpMult: 1 },
    skill: { id: 'rage', name: 'Ярость', icon: '🔥', cost: 30, desc: 'Следующие 3 задачи приносят двойное золото.' },
  },
  mage: {
    id: 'mage', name: 'Маг', icon: '🔮',
    desc: 'Учится быстрее всех. Получает на 25% больше опыта и больше маны.',
    perks: { damageMult: 1, goldMult: 1, xpMult: 1.25 },
    skill: { id: 'insight', name: 'Озарение', icon: '✨', cost: 30, desc: 'Следующие 3 задачи приносят двойной опыт.' },
  },
  healer: {
    id: 'healer', name: 'Целитель', icon: '💚',
    desc: 'Устойчив к провалам. Урон снижен вдвое, здоровье само восстанавливается за ночь.',
    perks: { damageMult: 0.5, goldMult: 1, xpMult: 1, regen: 3 },
    skill: { id: 'heal', name: 'Исцеление', icon: '💊', cost: 25, desc: 'Мгновенно восстанавливает 20 здоровья.' },
  },
  rogue: {
    id: 'rogue', name: 'Разбойник', icon: '🗡️',
    desc: 'Мастер выгоды. Получает на 50% больше золота за любое дело.',
    perks: { damageMult: 1, goldMult: 1.5, xpMult: 1 },
    skill: { id: 'steal', name: 'Ловкость рук', icon: '🎲', cost: 25, desc: 'Даёт защиту от урона за одну пропущенную ежедневку.' },
  },
};

/* ---- Боссы ----------------------------------------------------------- */
const BOSSES = [
  { id: 'proc', name: 'Прокрастинозавр', icon: '🦖', hp: 120, minLevel: 1,  reward: { xp: 120, gold: 80, gems: 1 },
    desc: 'Древний ящер, который шепчет «сделаешь завтра».' },
  { id: 'chaos', name: 'Дракон Хаоса', icon: '🐉', hp: 260, minLevel: 4,  reward: { xp: 280, gold: 180, gems: 2 },
    desc: 'Живёт в куче несделанных дел и питается беспорядком.' },
  { id: 'couch', name: 'Владыка Дивана', icon: '🛋️', hp: 450, minLevel: 8,  reward: { xp: 500, gold: 320, gems: 3 },
    desc: 'Обещает уют и забирает годы. Победим только регулярностью.' },
  { id: 'excuse', name: 'Титан Отговорок', icon: '👹', hp: 750, minLevel: 14, reward: { xp: 900, gold: 600, gems: 5 },
    desc: '«Не сегодня», «нет настроения», «начну с понедельника».' },
  { id: 'doubt', name: 'Тень Сомнения', icon: '👤', hp: 1200, minLevel: 22, reward: { xp: 1500, gold: 1000, gems: 8 },
    desc: 'Последний противник. Побеждается только накопленным прогрессом.' },
];

/* ---- Питомцы --------------------------------------------------------- */
const PETS = [
  { id: 'cat',    name: 'Котёнок',   icon: '🐱', gems: 2, bonus: 'xp',   bonusVal: 0.05, mountIcon: '🐈' },
  { id: 'dog',    name: 'Щенок',     icon: '🐶', gems: 2, bonus: 'gold', bonusVal: 0.05, mountIcon: '🐕' },
  { id: 'owl',    name: 'Совёнок',   icon: '🦉', gems: 3, bonus: 'xp',   bonusVal: 0.08, mountIcon: '🦅' },
  { id: 'fox',    name: 'Лисёнок',   icon: '🦊', gems: 3, bonus: 'gold', bonusVal: 0.08, mountIcon: '🦊' },
  { id: 'dragon', name: 'Дракончик', icon: '🐲', gems: 6, bonus: 'xp',   bonusVal: 0.15, mountIcon: '🐉' },
  { id: 'phoenix',name: 'Феникс',    icon: '🐣', gems: 8, bonus: 'hp',   bonusVal: 0.15, mountIcon: '🔥' },
];

/* ---- Системные товары ------------------------------------------------ */
const SHOP_ITEMS = [
  { id: 'potion', name: 'Зелье здоровья', icon: '🧪', cost: 25, desc: 'Восстанавливает 20 здоровья.' },
  { id: 'mana',   name: 'Зелье маны',     icon: '🔵', cost: 30, desc: 'Восстанавливает 30 маны.' },
  { id: 'shield', name: 'Свиток защиты',  icon: '🛡️', cost: 60, desc: 'Спасает от урона и сохраняет стрик при одном пропуске ежедневки.' },
];

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

/* ---- Формула уровня -------------------------------------------------- */
function levelInfo(xp, base = 100, growth = 50) {
  let level = 1, rem = Math.max(0, xp), need = base;
  while (rem >= need) {
    rem -= need;
    level++;
    need = base + (level - 1) * growth;
  }
  return { level, into: Math.round(rem), need, pct: clamp(Math.round((rem / need) * 100), 0, 100) };
}
/* Сколько всего XP нужно, чтобы достичь начала уровня N */
function xpForLevel(level, base = 100, growth = 50) {
  let total = 0;
  for (let l = 1; l < level; l++) total += base + (l - 1) * growth;
  return total;
}

/* ---- Дефолтное состояние --------------------------------------------- */
function defaultStats() {
  return [
    { id: 'health',     name: 'Здоровье',   icon: '💪', xp: 0 },
    { id: 'intellect',  name: 'Интеллект',  icon: '🧠', xp: 0 },
    { id: 'discipline', name: 'Дисциплина', icon: '🎯', xp: 0 },
    { id: 'social',     name: 'Отношения',  icon: '❤️', xp: 0 },
    { id: 'wealth',     name: 'Финансы',    icon: '💰', xp: 0 },
    { id: 'career',     name: 'Карьера',    icon: '💼', xp: 0 },
    { id: 'creativity', name: 'Творчество', icon: '🎨', xp: 0 },
    { id: 'spirit',     name: 'Спокойствие',icon: '🧘', xp: 0 },
  ];
}

function defaultState() {
  return {
    version: 2,
    settings: { theme: 'dark', accent: 'violet', currency: '₸', sound: true, confetti: true },
    player: {
      name: 'Игрок', avatar: '🧙',
      xp: 0, hp: 50, maxHp: 50, mp: 10, gold: 0, gems: 0,
      cls: null, skillPoints: 0, deaths: 0,
      buffs: { xp: 0, gold: 0, shield: 0 },
      activePet: null,
      createdAt: nowISO(),
    },
    stats: defaultStats(),
    habits: [],
    dailies: [],
    todos: [],
    goals: [],
    rewards: [],
    inventory: { potion: 0, mana: 0, shield: 0 },
    pets: [],
    boss: { active: null, defeated: [] },
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
    achievements: {},
    activity: {},
    log: [],
    lastCron: todayStr(),
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
  s.player.buffs = deepMergeDefaults((parsed.player || {}).buffs || {}, d.player.buffs);
  s.settings = deepMergeDefaults(parsed.settings || {}, d.settings);
  s.inventory = deepMergeDefaults(parsed.inventory || {}, d.inventory);
  s.boss = deepMergeDefaults(parsed.boss || {}, d.boss);
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
  for (const key of ['stats', 'habits', 'dailies', 'todos', 'goals', 'rewards', 'pets', 'journal', 'log']) {
    if (!Array.isArray(s[key])) s[key] = d[key];
  }
  if (!s.activity || typeof s.activity !== 'object') s.activity = {};
  if (!s.achievements || typeof s.achievements !== 'object') s.achievements = {};
  if (!s.lastCron) s.lastCron = todayStr();
  return s;
}

/* Перенос данных из первой версии приложения */
function migrateV1(old, d) {
  const s = d;
  if (old.player) {
    s.player.name = old.player.name || s.player.name;
    s.player.avatar = old.player.avatar || s.player.avatar;
    s.player.xp = old.player.xp || 0;
    s.player.createdAt = old.player.createdAt || s.player.createdAt;
  }
  if (old.settings) {
    s.settings.theme = old.settings.theme || s.settings.theme;
    // валюту из первой версии не переносим: там по умолчанию стоял рубль
  }
  if (Array.isArray(old.stats) && old.stats.length) s.stats = old.stats;

  // старые квесты -> задачи (to-do)
  (old.quests || []).forEach(q => {
    s.todos.push({
      id: q.id || uid(), title: q.title, note: '', statId: q.statId || null,
      difficulty: 'easy', due: q.dueDate || null, tags: [], checklist: [],
      done: !!q.done, doneAt: q.doneAt || null, createdAt: q.createdAt || nowISO(),
    });
  });
  // старые привычки -> ежедневки (они были с ежедневным чекином)
  (old.habits || []).forEach(h => {
    s.dailies.push({
      id: h.id || uid(), title: h.title, icon: h.icon || '🔥', note: '', statId: h.statId || null,
      difficulty: 'easy', days: [0, 1, 2, 3, 4, 5, 6], checklist: [], tags: [],
      history: Array.isArray(h.history) ? h.history : [], streak: h.streak || 0, best: h.best || 0,
      createdAt: h.createdAt || nowISO(),
    });
  });
  (old.goals || []).forEach(g => {
    s.goals.push({ ...g, milestones: [], tags: [] });
  });
  if (old.finance && Array.isArray(old.finance.transactions)) s.finance.transactions = old.finance.transactions;
  if (old.achievements) s.achievements = old.achievements;
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
