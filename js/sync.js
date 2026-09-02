/* =========================================================================
   sync.js — синхронизация прогресса между устройствами через Supabase.

   Проект Supabase и функция распознавания фото зашиты по умолчанию —
   любой, кто откроет приложение, может завести аккаунт (почта + пароль)
   и сразу получить синхронизацию и разбор фото, ни разу не увидев слово
   Supabase. Изоляция данных между разными людьми обеспечивается не
   отдельными базами, а политикой RLS внутри одной базы (каждый видит
   только свою строку по auth.uid()) — см. константу SYNC_SQL ниже
   (текст показывается пользователю через syncSetupHtml() в sync-ui.js).

   Ключ anon — публичный по своей природе (Supabase сам называет его
   "anon public"), встраивать его в клиентский код — стандартная практика.
   Продвинутый пользователь всё ещё может подключить свой собственный
   проект через «Изменить настройки подключения» в Настройках.
   ========================================================================= */

const SYNC_KEY = 'gamelife_sync_v1';
const STATE_BACKUP_KEY = 'gamelife_state_backup';
// одноразовая метка: ставит resetAll() перед намеренным полным сбросом,
// чтобы синхронизация знала, что пустое состояние — это осознанный выбор,
// а не случайно опустевшее хранилище (переустановка приложения и т.п.)
const INTENTIONAL_RESET_KEY = 'gamelife_intentional_reset';
const PUSH_DEBOUNCE_MS = 4000;

// Проект и функция по умолчанию — общие для всех, кто открыл приложение
const DEFAULT_SUPABASE_URL = 'https://tmbqcsdwbplxahuegzmp.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtYnFjc2R3YnBseGFodWVnem1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTM1NTUsImV4cCI6MjEwMzgyOTU1NX0.be9I43nGhxwGmn4V6reWNW98m2qVSikI6isXUQdKzgU';
const DEFAULT_FOOD_FN = 'https://tmbqcsdwbplxahuegzmp.supabase.co/functions/v1/clever-action';

let syncCfg = loadSyncCfg();
let syncStatus = { kind: 'idle', text: '' };   // idle | busy | ok | error | off
let pushTimer = null;
let syncBusy = false;

/* ---- Конфигурация ------------------------------------------------------- */
function defaultSyncCfg() {
  return {
    url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY,
    accessToken: '', refreshToken: '', userId: '', email: '',
    deviceId: uid(), deviceName: guessDeviceName(),
    auto: true,
    foodFn: DEFAULT_FOOD_FN,   // адрес Edge Function для разбора фото еды
    lastSyncAt: 0,     // локальное время последней удачной синхронизации
    lastRemoteAt: 0,   // серверное updated_at на тот же момент
  };
}
function loadSyncCfg() {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (raw) return { ...defaultSyncCfg(), ...JSON.parse(raw) };
  } catch (e) { console.warn('Не удалось прочитать настройки синхронизации', e); }
  return defaultSyncCfg();
}
function saveSyncCfg() {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(syncCfg)); } catch (e) {}
}
function guessDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Телефон Android';
  if (/Macintosh/.test(ua)) return 'Mac';
  return 'Компьютер';
}

function syncConfigured() { return !!(syncCfg.url && syncCfg.anonKey); }
function syncSignedIn() { return syncConfigured() && !!syncCfg.accessToken && !!syncCfg.userId; }

/* ---- Низкоуровневые запросы --------------------------------------------- */
async function supaFetch(path, opts = {}, allowRetry = true) {
  const base = syncCfg.url.replace(/\/+$/, '');
  const headers = {
    apikey: syncCfg.anonKey,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  if (syncCfg.accessToken) headers.Authorization = 'Bearer ' + syncCfg.accessToken;

  const res = await fetch(base + path, { ...opts, headers });
  if (res.status === 401 && allowRetry && syncCfg.refreshToken) {
    if (await refreshSession()) return supaFetch(path, opts, false);
  }
  return res;
}

async function errorText(res) {
  let body = {};
  try { body = await res.json(); } catch (e) {}
  return body.msg || body.message || body.error_description || body.error || body.hint
      || `Сервер ответил ${res.status}`;
}

function applySession(json) {
  syncCfg.accessToken = json.access_token || '';
  syncCfg.refreshToken = json.refresh_token || '';
  const user = json.user || json;
  syncCfg.userId = user.id || '';
  syncCfg.email = user.email || '';
  saveSyncCfg();
}

async function refreshSession() {
  try {
    const res = await fetch(syncCfg.url.replace(/\/+$/, '') + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: syncCfg.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: syncCfg.refreshToken }),
    });
    if (!res.ok) return false;
    applySession(await res.json());
    return true;
  } catch (e) { return false; }
}

/* ---- Вход и регистрация -------------------------------------------------- */
async function syncSignIn(email, password, createAccount) {
  const path = createAccount ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password';
  const res = await supaFetch(path, { method: 'POST', body: JSON.stringify({ email, password }) }, false);
  if (!res.ok) throw new Error(await errorText(res));

  const json = await res.json();
  if (!json.access_token) {
    // включено подтверждение адреса — сессии ещё нет
    throw new Error('Аккаунт создан. Подтверди адрес по ссылке из письма и войди обычной кнопкой «Войти».');
  }
  applySession(json);
}

function syncSignOut() {
  syncCfg.accessToken = '';
  syncCfg.refreshToken = '';
  syncCfg.userId = '';
  syncCfg.email = '';
  syncCfg.lastSyncAt = 0;
  syncCfg.lastRemoteAt = 0;
  saveSyncCfg();
  setSyncStatus('off', 'Синхронизация выключена');
}

/* ---- Чтение и запись сохранения ------------------------------------------ */
async function pullRemote() {
  const res = await supaFetch(
    `/rest/v1/gamelife_saves?user_id=eq.${encodeURIComponent(syncCfg.userId)}&select=data,updated_at,device`,
    { method: 'GET' });
  if (!res.ok) throw new Error(await errorText(res));
  const rows = await res.json();
  return rows[0] || null;
}

async function pushRemote() {
  const res = await supaFetch('/rest/v1/gamelife_saves', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([{ user_id: syncCfg.userId, data: state, device: syncCfg.deviceName }]),
  });
  if (!res.ok) throw new Error(await errorText(res));
  const rows = await res.json();
  return rows[0] || null;
}

/* Применяем облачную копию, предварительно сохранив местную «на всякий случай» */
function applyRemoteState(data) {
  try { localStorage.setItem(STATE_BACKUP_KEY, JSON.stringify(state)); } catch (e) {}
  state = normalize(data, defaultState());
  state.updatedAt = Date.now();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  state.dailies.forEach(recomputeStreak);
  applyTheme();
  renderAll();
}

/* ---- История сохранений: список версий + восстановление -------------------
   Каждая перезапись строки в Supabase сначала уводит прошлую версию в
   отдельную таблицу (см. триггер gamelife_save_history в SYNC_SQL) — это
   подстраховка независимо от того, уцелел ли где-то localStorage. */
async function listSaveHistory() {
  const res = await supaFetch(
    `/rest/v1/gamelife_saves_history?user_id=eq.${encodeURIComponent(syncCfg.userId)}&select=id,device,saved_at&order=saved_at.desc&limit=30`,
    { method: 'GET' });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}
async function fetchSaveHistoryItem(id) {
  const res = await supaFetch(`/rest/v1/gamelife_saves_history?id=eq.${encodeURIComponent(id)}&select=data`, { method: 'GET' });
  if (!res.ok) throw new Error(await errorText(res));
  const rows = await res.json();
  return rows[0] || null;
}
async function restoreFromHistory(id) {
  const item = await fetchSaveHistoryItem(id);
  if (!item) throw new Error('Эта версия больше недоступна');
  applyRemoteState(item.data);
  const row = await pushRemote();
  markSynced(row);
}

/* Есть ли в состоянии хоть что-то настоящее — задачи, финансы, дневник и т.д.
   Нужно, чтобы отличить «реально пустой прогресс» от «переустановил
   приложение / почистил браузер, хранилище обнулилось» — оба случая
   дают одинаково пустой state, но пустое хранилище получает свежую метку
   времени и по одним таймстемпам выглядит «новее» настоящих данных. */
function hasRealContent(s) {
  if (!s) return false;
  return !!(
    (s.todos && s.todos.length) ||
    (s.dailies && s.dailies.length) ||
    (s.habits && s.habits.length) ||
    (s.goals && s.goals.length) ||
    (s.wishes && s.wishes.length) ||
    (s.workouts && s.workouts.length) ||
    (s.journal && s.journal.length) ||
    (s.log && s.log.length) ||
    (s.finance && s.finance.transactions && s.finance.transactions.length) ||
    (s.nutrition && s.nutrition.entries && s.nutrition.entries.length) ||
    (s.sleep && s.sleep.entries && s.sleep.entries.length)
  );
}

/* Пути к самостоятельным категориям данных внутри state. Раньше синхронизация
   сравнивала состояния только целиком («чьё новее — то и победило»), а это
   значит: если на одном устройстве, например, привычки новее, но финансы там
   пустые просто потому что их тут никогда не вели — побеждает ВСЁ состояние
   целиком, вместе с пустыми финансами, тихо стирая настоящие траты в облаке.
   hasRealContent() выше защищает только от полностью пустого устройства —
   этого мало. mergeMissingCategories() ниже чинит именно этот случай: перед
   тем как решать, чья версия новее, подмешивает в обе стороны те категории,
   которые пусты с одной стороны, но не пусты с другой — так после решения
   обе стороны содержат объединение, и «пустая просто потому что не вели»
   категория никогда не перетирает настоящие данные. */
const CATEGORY_PATHS = [
  ['todos'], ['dailies'], ['habits'], ['goals'], ['wishes'], ['workouts'], ['journal'],
  ['finance', 'transactions'], ['finance', 'budgets'],
  ['nutrition', 'entries'], ['nutrition', 'dictionary'],
  ['sleep', 'entries'],
];
function getPath(obj, path) {
  return path.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}
function setPath(obj, path, value) {
  let o = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (!o[path[i]] || typeof o[path[i]] !== 'object') o[path[i]] = {};
    o = o[path[i]];
  }
  o[path[path.length - 1]] = value;
}
function mergeMissingCategories(target, source) {
  if (!target || !source) return false;
  let changed = false;
  for (const path of CATEGORY_PATHS) {
    const targetArr = getPath(target, path);
    const sourceArr = getPath(source, path);
    if ((!Array.isArray(targetArr) || !targetArr.length) && Array.isArray(sourceArr) && sourceArr.length) {
      setPath(target, path, sourceArr);
      changed = true;
    }
  }
  return changed;
}

/* Счета — особый случай, тот самый «счёт удалился, появился новый»: normalize()
   гарантирует хотя бы один счёт всегда (см. state.js), поэтому «массив пуст»
   для них никогда не сработает — вместо пустоты там оказывается один свежий
   счёт по умолчанию с нулевым балансом. Сравниваем именно с этой формой:
   если у одной стороны только дефолтный «Основной счёт» с балансом 0, а у
   другой — что-то настоящее (другое имя, другой баланс, больше одного счёта),
   подменяем дефолтную сторону на настоящую. */
function isFreshDefaultAccounts(accounts) {
  return Array.isArray(accounts) && accounts.length === 1
    && (accounts[0].balance || 0) === 0
    && accounts[0].name === 'Основной счёт';
}
function mergeAccountsIfDefault(target, source) {
  if (!target || !source || !target.finance || !source.finance) return false;
  const tAcc = target.finance.accounts;
  const sAcc = source.finance.accounts;
  if (isFreshDefaultAccounts(tAcc) && Array.isArray(sAcc) && sAcc.length && !isFreshDefaultAccounts(sAcc)) {
    target.finance.accounts = sAcc;
    return true;
  }
  return false;
}

/* Объединяет два массива по id вместо выбора одной стороны целиком — иначе
   при конфликте «менялось и там, и там» (см. ниже) элемент, добавленный на
   проигравшей по общей метке времени стороне, просто исчезал бы, даже если
   на другой стороне о нём никогда и не знали. Здесь ни один id не теряется:
   берём объединение, а при совпадении id побеждает версия из preferred
   (более свежая по общей метке времени сторона — её правка вероятнее новее). */
/* deleted — набор id, которые кто-то из сторон уже удалил (см. markDeleted
   в state.js). Без этого фильтра удалённый на одном устройстве элемент,
   который другая сторона ещё не успела «забыть» (её собственный push с
   удалением до этого не дошёл), просто воскресал бы обратно через union. */
function mergeArraysById(preferred, other, deleted) {
  const skip = deleted instanceof Set ? deleted : new Set(deleted || []);
  const a = (Array.isArray(preferred) ? preferred : []).filter(item => !item || item.id == null || !skip.has(item.id));
  const b = (Array.isArray(other) ? other : []).filter(item => !item || item.id == null || !skip.has(item.id));
  if (!a.length) return b.slice();
  if (!b.length) return a.slice();
  const byId = new Map();
  for (const item of b) if (item && item.id != null) byId.set(item.id, item);
  for (const item of a) if (item && item.id != null) byId.set(item.id, item); // preferred побеждает при совпадении id
  const withoutId = [...a, ...b].filter(item => item && item.id == null);
  return [...byId.values(), ...withoutId];
}

/* Баг: «записал операцию — баланс не изменился». Счета выше (finance.accounts)
   слиты через mergeArraysById — при совпадении id побеждает объект ОДНОЙ
   стороны целиком, включая его balance. А операции (finance.transactions)
   слиты как ОБЪЕДИНЕНИЕ обеих сторон — значит после слияния список операций
   может содержать то, чего в выигравшем balance ещё нет (операция создана
   на другой стороне и до неё синк ещё не доехал), либо наоборот не
   содержать то, что в balance ещё осталось (операцию удалили на другой
   стороне). Операция в истории видна (список слит), а сумма — нет.

   Чиним через «остаток»: у каждого счёта берём СОБСТВЕННЫЙ исходный список
   операций той стороны, чей объект счёта победил, и находим разницу
   balance − сумма(эффектов этих операций) — это ручная правка при сверке
   (см. engine.js) или любое иное расхождение, которое нужно сохранить.
   Итоговый баланс = эта разница + сумма(эффектов уже слитого списка
   операций) — так учитываются и правки руками, и чужие операции, и
   удалённые операции разом. */
function txAccountEffect(tx, accId) {
  if (!tx || !accId) return 0;
  if (tx.type === 'income') return tx.accountId === accId ? (tx.amount || 0) : 0;
  if (tx.type === 'expense') return tx.accountId === accId ? -(tx.amount || 0) : 0;
  if (tx.type === 'transfer') {
    let n = 0;
    if (tx.accountId === accId) n -= (tx.amount || 0);
    if (tx.toAccountId === accId) n += (tx.amount || 0);
    return n;
  }
  return 0;
}
function reconcileAccountBalances(merged, base, other) {
  if (!merged || !merged.finance || !Array.isArray(merged.finance.accounts)) return;
  const baseAccIds = new Set(((base && base.finance && base.finance.accounts) || []).map(a => a.id));
  const baseTx = (base && base.finance && base.finance.transactions) || [];
  const otherTx = (other && other.finance && other.finance.transactions) || [];
  const mergedTx = merged.finance.transactions || [];
  const sumEffect = (list, accId) => list.reduce((s, t) => s + txAccountEffect(t, accId), 0);
  for (const acc of merged.finance.accounts) {
    const sourceTx = baseAccIds.has(acc.id) ? baseTx : otherTx;
    const manualResidual = (acc.balance || 0) - sumEffect(sourceTx, acc.id);
    acc.balance = manualResidual + sumEffect(mergedTx, acc.id);
  }
}

/* ---- Основной алгоритм ---------------------------------------------------- */
async function syncNow(manual = false) {
  if (!syncSignedIn() || syncBusy) return;
  if (!navigator.onLine) {
    if (manual) toast('Нет интернета — синхронизирую, когда появится', 'red');
    return;
  }

  syncBusy = true;
  setSyncStatus('busy', 'Синхронизация…');
  try {
    const remote = await pullRemote();

    // в облаке ещё ничего нет — просто выгружаем текущее
    if (!remote) {
      const row = await pushRemote();
      markSynced(row);
      if (manual) toast('Прогресс выгружен в облако', 'green');
      return;
    }

    // записи от Клода могли прилететь в облако между синхронизациями (через
    // gamelife_agent_add) — подмешиваем их в локальное состояние независимо
    // от того, чья версия победит ниже, иначе push «локальная новее» стёр бы
    // их простой полной перезаписью строки
    if (remote.data && Array.isArray(remote.data.agentInbox) && remote.data.agentInbox.length) {
      const known = new Set((state.agentInbox || []).map(x => x.id));
      const extra = remote.data.agentInbox.filter(x => !known.has(x.id));
      if (extra.length) state.agentInbox = [...(state.agentInbox || []), ...extra];
    }

    // Разбираем очередь Клода СРАЗУ, а не в конце функции (раньше это было
    // в finally, ПОСЛЕ push ниже) — иначе в облако успевала уйти ещё не
    // пустая agentInbox, следующая синхронизация тянула те же записи
    // обратно и применяла их заново: очередь бесконечно переигрывалась,
    // плодя дубли трат/тренировок/приёмов пищи на каждой синхронизации.
    if (typeof processAgentInbox === 'function') processAgentInbox();
    // то, что было в remote.data, мы уже забрали и обработали строкой выше —
    // обнуляем и здесь, иначе шаги ниже, которые могут целиком принять
    // remote.data как новую локальную версию, притащат старую очередь назад
    if (remote.data) remote.data.agentInbox = [];

    // объединяем «надгробия» удалений с обеих сторон ДО слияния категорий —
    // именно из-за их отсутствия удалённое иногда возвращалось обратно
    // (см. markDeleted в state.js и mergeArraysById ниже)
    const deletedSet = new Set([
      ...(Array.isArray(state.deletedIds) ? state.deletedIds : []),
      ...(remote.data && Array.isArray(remote.data.deletedIds) ? remote.data.deletedIds : []),
    ]);
    const deletedList = [...deletedSet].slice(-2000);
    state.deletedIds = deletedList;
    if (remote.data) remote.data.deletedIds = deletedList;

    // «Удалить всё» в Настройках ставит одноразовую метку — тогда пустому
    // состоянию доверяем как есть (и категории ниже намеренно НЕ подмешиваем,
    // иначе осознанный сброс тут же откатился бы обратно чужими данными).
    // Иначе пустое устройство/категория не должны затирать чужой настоящий
    // прогресс просто потому, что общая метка времени свежее.
    let intentionalReset = false;
    try {
      intentionalReset = localStorage.getItem(INTENTIONAL_RESET_KEY) === '1';
      if (intentionalReset) localStorage.removeItem(INTENTIONAL_RESET_KEY);
    } catch (e) {}

    // Победитель определяется по состоянию ЦЕЛИКОМ (по общей метке времени),
    // но отдельная категория (финансы, питание и т.д.) может быть пустой на
    // «победившей» стороне просто потому, что её тут не вели — а не потому,
    // что её осознанно очистили. Подмешиваем такие категории в обе стороны
    // заранее, чтобы после решения обе содержали объединение и ни одна
    // непустая категория не потерялась, какая бы сторона ни победила.
    if (!intentionalReset) {
      let stateChanged = mergeMissingCategories(state, remote.data);
      mergeMissingCategories(remote.data, state);
      stateChanged = mergeAccountsIfDefault(state, remote.data) || stateChanged;
      mergeAccountsIfDefault(remote.data, state);
      // подмешали категорию локально — сохраняем сразу, иначе если по общим
      // таймстемпам ничего «не менялось», объединённые данные повиснут
      // только в памяти и потеряются при следующей перезагрузке
      if (stateChanged) saveState();
    }

    const remoteAt = Date.parse(remote.updated_at) || 0;
    const localAt = state.updatedAt || 0;
    const localChanged = localAt > syncCfg.lastSyncAt;
    const remoteChanged = remoteAt > syncCfg.lastRemoteAt;

    if (!intentionalReset && (localChanged || remoteChanged)) {
      const localEmpty = !hasRealContent(state);
      const remoteEmpty = !hasRealContent(remote.data);
      if (localEmpty && !remoteEmpty) {
        applyRemoteState(remote.data);
        markSynced({ updated_at: remote.updated_at });
        toast('Это устройство было пустым — подтянул настоящий прогресс из облака', 'gold');
        return;
      }
      if (remoteEmpty && !localEmpty) {
        const row = await pushRemote();
        markSynced(row);
        toast('В облаке оказалось пусто — выгрузил туда прогресс с этого устройства', 'red');
        return;
      }
    }

    if (!localChanged && !remoteChanged) {
      markSynced({ updated_at: remote.updated_at });
      if (manual) toast('Всё уже синхронизировано', 'green');
      return;
    }

    // Хоть одна сторона изменилась — раньше отсюда либо целиком применялась
    // облачная версия, либо целиком выгружалась локальная, либо (если
    // менялись обе) целиком побеждала более свежая по общей метке времени.
    // Всё это по факту означало «взять один снимок целиком и выбросить
    // другой» — а всё, чего не было в выбранном снимке (например, задачу,
    // которую только что добавили и она не успела улететь в облако, или
    // которую параллельно дописало другое устройство), молча теряли. Даже
    // когда изменилась вроде бы только одна сторона: если два устройства
    // синхронизировались почти одновременно, вторая запись в облако могла
    // тихо перезаписать первую без всякого слияния — и следующее устройство,
    // которое просто «подтягивало» изменения, получало уже урезанную версию.
    // Поэтому вместо выбора снимка целиком объединяем каждую категорию
    // (задачи, привычки, цели, счета и т.д.) по id — ни один элемент,
    // добавленный на любой стороне, больше не пропадает; при совпадении id
    // побеждает версия из более свежей по общей метке времени стороны.
    const localNewer = localAt >= remoteAt;
    const base = localNewer ? state : remote.data;
    const other = localNewer ? remote.data : state;
    const merged = JSON.parse(JSON.stringify(base || {}));
    for (const path of [...CATEGORY_PATHS, ['finance', 'accounts'], ['log']]) {
      setPath(merged, path, mergeArraysById(getPath(base, path), getPath(other, path), deletedSet));
    }
    // счета слиты целиком по стороне-победителю (balance включительно), а
    // операции — объединением; без этого шага баланс не совпадал бы с
    // операцией, которая только что «приехала» с другого устройства
    reconcileAccountBalances(merged, base, other);
    merged.deletedIds = deletedList;
    applyRemoteState(merged);
    const row = await pushRemote();
    markSynced(row);
    toast(localChanged && remoteChanged
      ? 'Объединил изменения с обоих устройств — ничего не потерялось'
      : remoteChanged ? `Подтянут прогресс с устройства «${remote.device || 'другое'}»` : 'Изменения выгружены', 'green');
  } catch (e) {
    console.warn('Синхронизация не удалась:', e);
    setSyncStatus('error', e.message || 'Ошибка синхронизации');
    if (manual) toast('Не удалось синхронизировать: ' + (e.message || ''), 'red');
  } finally {
    syncBusy = false;
    renderSyncBadge();
  }
}

function markSynced(row) {
  syncCfg.lastSyncAt = state.updatedAt || Date.now();
  if (row && row.updated_at) syncCfg.lastRemoteAt = Date.parse(row.updated_at) || Date.now();
  saveSyncCfg();
  setSyncStatus('ok', 'Синхронизировано');
}

function setSyncStatus(kind, text) {
  syncStatus = { kind, text };
  renderSyncBadge();
}

/* ---- Автоматическая синхронизация ------------------------------------------ */
/* Вызывается из saveState() при любом изменении состояния */
function onStateSaved() {
  if (!syncSignedIn() || !syncCfg.auto) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => syncNow(false), PUSH_DEBOUNCE_MS);
}

function initSync() {
  if (!syncSignedIn()) {
    setSyncStatus(syncConfigured() ? 'off' : 'idle', '');
    return;
  }
  setTimeout(() => syncNow(false), 800);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && syncCfg.auto) syncNow(false);
  });
  window.addEventListener('online', () => { if (syncCfg.auto) syncNow(false); });
  // выгружаем несохранённое перед закрытием
  window.addEventListener('pagehide', () => {
    if (pushTimer && syncSignedIn() && syncCfg.auto) { clearTimeout(pushTimer); syncNow(false); }
  });
}

/* ---- Значок состояния в боковой панели -------------------------------------- */
function renderSyncBadge() {
  const el = document.getElementById('syncBadge');
  if (!el) return;
  if (!syncSignedIn()) { el.innerHTML = ''; return; }

  const statusIcons = { busy: 'hourglass', ok: 'cloud', error: 'alert', off: 'pause', idle: 'cloud' };
  const when = syncCfg.lastSyncAt ? fmtRelTime(syncCfg.lastSyncAt) : 'ещё не было';
  const text = syncStatus.kind === 'busy' ? 'Синхронизация…'
             : syncStatus.kind === 'error' ? 'Ошибка синхронизации'
             : `Синхронизировано ${when}`;
  el.innerHTML = `<button class="sync-badge ${syncStatus.kind}" id="syncBadgeBtn" title="Синхронизировать сейчас">
      <span>${icon(statusIcons[syncStatus.kind] || 'cloud', 15)}</span><span class="sync-badge-text">${esc(text)}</span>
    </button>`;
  el.querySelector('#syncBadgeBtn').addEventListener('click', () => syncNow(true));
}

function fmtRelTime(ms) {
  const diff = Math.max(0, Date.now() - ms);
  const min = Math.round(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} ${plural(min, 'минуту', 'минуты', 'минут')} назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${plural(h, 'час', 'часа', 'часов')} назад`;
  const d = Math.round(h / 24);
  return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
}

/* ---- SQL для настройки проекта ---------------------------------------------- */
const SYNC_SQL = `create table if not exists public.gamelife_saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  device     text,
  updated_at timestamptz not null default now()
);

alter table public.gamelife_saves enable row level security;

drop policy if exists "own save" on public.gamelife_saves;
create policy "own save" on public.gamelife_saves
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.gamelife_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists gamelife_touch on public.gamelife_saves;
create trigger gamelife_touch before insert or update
  on public.gamelife_saves
  for each row execute function public.gamelife_touch();

-- Личные токены для записи из Клода (MCP-коннектор) и функция, которая
-- по такому токену кладёт запись в очередь agentInbox внутри сохранения.
-- Хранится только хеш токена — сам токен показывается один раз при создании.
-- pgcrypto у Supabase обычно уже стоит, но в схеме extensions, а не public —
-- поэтому ниже у функции явно прописан search_path с обеими схемами,
-- иначе digest() внутри неё будет «не найден».
create extension if not exists pgcrypto;

create table if not exists public.agent_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  label text default 'Клод',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.agent_tokens enable row level security;

drop policy if exists "own tokens" on public.agent_tokens;
create policy "own tokens" on public.agent_tokens
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.gamelife_agent_add(p_token text, p_kind text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_hash text;
  v_item jsonb;
  v_recent_dupe boolean;
begin
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select user_id into v_user_id from public.agent_tokens where token_hash = v_hash;
  if v_user_id is null then
    raise exception 'invalid token';
  end if;

  update public.agent_tokens set last_used_at = now() where token_hash = v_hash;

  -- защита от задвоения: если точно такая же запись (тип + содержимое) уже
  -- лежит в очереди за последние 3 минуты — не добавляем ещё раз. Спасает
  -- от повторных «попробуй ещё раз» и случайных повторных вызовов инструмента.
  select exists (
    select 1
    from public.gamelife_saves s, jsonb_array_elements(coalesce(s.data->'agentInbox', '[]'::jsonb)) item
    where s.user_id = v_user_id
      and item->>'kind' = p_kind
      and item->'payload' = p_payload
      and (item->>'createdAt')::timestamptz > now() - interval '3 minutes'
  ) into v_recent_dupe;

  if v_recent_dupe then
    return;
  end if;

  v_item := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'kind', p_kind,
    'payload', p_payload,
    'createdAt', now()
  );

  update public.gamelife_saves
  set data = jsonb_set(
        coalesce(data, '{}'::jsonb),
        '{agentInbox}',
        coalesce(data->'agentInbox', '[]'::jsonb) || jsonb_build_array(v_item),
        true
      ),
      updated_at = now()
  where user_id = v_user_id;

  if not found then
    insert into public.gamelife_saves (user_id, data, device)
    values (v_user_id, jsonb_build_object('agentInbox', jsonb_build_array(v_item)), 'Клод');
  end if;
end;
$$;

grant execute on function public.gamelife_agent_add(text, text, jsonb) to anon, authenticated;

-- История сохранений: перед каждой перезаписью строки прошлая версия
-- уходит сюда — подстраховка на случай ошибки синхронизации (даже ещё не
-- найденной), а не только на удачно уцелевший localStorage на устройстве.
-- Хранится последние 30 версий на пользователя, старые чистятся сами.
create table if not exists public.gamelife_saves_history (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  data     jsonb not null,
  device   text,
  saved_at timestamptz not null default now()
);

alter table public.gamelife_saves_history enable row level security;

drop policy if exists "own history" on public.gamelife_saves_history;
create policy "own history" on public.gamelife_saves_history
  for select to authenticated
  using (auth.uid() = user_id);
-- пишет и чистит только функция ниже (security definer) — обычным
-- пользователям вставка/удаление истории не нужны и не даны политикой

create index if not exists gamelife_saves_history_user_saved_idx
  on public.gamelife_saves_history (user_id, saved_at desc);

create or replace function public.gamelife_save_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.data is not null and old.data is distinct from new.data then
    insert into public.gamelife_saves_history (user_id, data, device, saved_at)
    values (old.user_id, old.data, old.device, old.updated_at);

    delete from public.gamelife_saves_history
    where id in (
      select id from public.gamelife_saves_history
      where user_id = old.user_id
      order by saved_at desc
      offset 30
    );
  end if;
  return new;
end $$;

drop trigger if exists gamelife_save_history on public.gamelife_saves;
create trigger gamelife_save_history before update
  on public.gamelife_saves
  for each row execute function public.gamelife_save_history();`;

/* ---- Личные токены для записи из Клода (MCP-коннектор) --------------------
   Токен генерируется в браузере, на сервер уходит только его SHA-256 хеш —
   сам токен показывается пользователю один раз и нигде больше не хранится.
   HTML-обвязка (карточка настроек, список ссылок, модалки) — в sync-ui.js. */
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function randomAgentToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return 'gl_' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}
function agentMcpUrl(token) {
  return syncCfg.url.replace(/\/+$/, '') + '/functions/v1/agent-mcp/' + token;
}

async function listAgentTokens() {
  const res = await supaFetch('/rest/v1/agent_tokens?select=id,label,created_at,last_used_at&order=created_at.desc', { method: 'GET' });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}
async function createAgentToken(label) {
  const token = randomAgentToken();
  const hash = await sha256Hex(token);
  const res = await supaFetch('/rest/v1/agent_tokens', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([{ user_id: syncCfg.userId, token_hash: hash, label: label || 'Клод' }]),
  });
  if (!res.ok) throw new Error(await errorText(res));
  return token;
}
async function revokeAgentToken(id) {
  const res = await supaFetch(`/rest/v1/agent_tokens?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await errorText(res));
}
