/* =========================================================================
   sync.js — синхронизация прогресса между устройствами через Supabase.

   Проект Supabase и функция распознавания фото зашиты по умолчанию —
   любой, кто откроет приложение, может завести аккаунт (почта + пароль)
   и сразу получить синхронизацию и разбор фото, ни разу не увидев слово
   Supabase. Изоляция данных между разными людьми обеспечивается не
   отдельными базами, а политикой RLS внутри одной базы (каждый видит
   только свою строку по auth.uid()) — см. SQL в syncSetupHtml() ниже.

   Ключ anon — публичный по своей природе (Supabase сам называет его
   "anon public"), встраивать его в клиентский код — стандартная практика.
   Продвинутый пользователь всё ещё может подключить свой собственный
   проект через «Изменить настройки подключения» в Настройках.
   ========================================================================= */

const SYNC_KEY = 'gamelife_sync_v1';
const STATE_BACKUP_KEY = 'gamelife_state_backup';
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
      if (manual) toast('☁️ Прогресс выгружен в облако', 'green');
      return;
    }

    const remoteAt = Date.parse(remote.updated_at) || 0;
    const localAt = state.updatedAt || 0;
    const localChanged = localAt > syncCfg.lastSyncAt;
    const remoteChanged = remoteAt > syncCfg.lastRemoteAt;

    if (!localChanged && !remoteChanged) {
      markSynced({ updated_at: remote.updated_at });
      if (manual) toast('Всё уже синхронизировано', 'green');
      return;
    }
    if (remoteChanged && !localChanged) {
      applyRemoteState(remote.data);
      markSynced({ updated_at: remote.updated_at });
      toast(`☁️ Подтянут прогресс с устройства «${remote.device || 'другое'}»`, 'green');
      return;
    }
    if (localChanged && !remoteChanged) {
      const row = await pushRemote();
      markSynced(row);
      if (manual) toast('☁️ Изменения выгружены', 'green');
      return;
    }

    // менялось и там, и там — не спрашиваем, просто побеждает более свежая версия
    // (местная копия всё равно уходит в резервную копию перед перезаписью — applyRemoteState)
    if (remoteAt > localAt) {
      applyRemoteState(remote.data);
      markSynced({ updated_at: remote.updated_at });
      toast(`☁️ Подтянута более новая версия с «${remote.device || 'другого устройства'}»`, 'green');
    } else {
      const row = await pushRemote();
      markSynced(row);
      toast('☁️ Оставлена версия с этого устройства (она новее)', 'green');
    }
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

  const icons = { busy: '⏳', ok: '☁️', error: '⚠️', off: '⏸️', idle: '☁️' };
  const when = syncCfg.lastSyncAt ? fmtRelTime(syncCfg.lastSyncAt) : 'ещё не было';
  const text = syncStatus.kind === 'busy' ? 'Синхронизация…'
             : syncStatus.kind === 'error' ? 'Ошибка синхронизации'
             : `Синхронизировано ${when}`;
  el.innerHTML = `<button class="sync-badge ${syncStatus.kind}" id="syncBadgeBtn" title="Синхронизировать сейчас">
      <span>${icons[syncStatus.kind] || '☁️'}</span><span class="sync-badge-text">${esc(text)}</span>
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
  for each row execute function public.gamelife_touch();`;

/* ---- Карточка синхронизации в Настройках -------------------------------------- */
function syncCardHtml() {
  if (!syncConfigured()) return syncSetupHtml();
  if (!syncSignedIn()) return syncLoginHtml();
  return syncActiveHtml();
}

function syncSetupHtml() {
  return `<p class="text-dim" style="font-size:13px;line-height:1.55;margin:0 0 14px;">
      Синхронизация уже работает «из коробки» — обычно достаточно просто завести аккаунт
      на предыдущем экране. Сюда попадают, только если явно нажали «Использовать свой проект»:
      это для тех, кто хочет держать данные в собственном, отдельном хранилище Supabase,
      а не в общем.
    </p>

    <ol class="setup-steps">
      <li>Зайти на <b>supabase.com</b>, создать бесплатный аккаунт и новый проект (регион выбери поближе).</li>
      <li>В проекте открыть <b>SQL Editor</b>, вставить туда код ниже и нажать <b>Run</b>.</li>
      <li>Открыть <b>Authentication → Sign In / Providers → Email</b> и выключить <b>Confirm email</b>
          (иначе после регистрации придётся подтверждать адрес письмом).</li>
      <li>Открыть <b>Project Settings → API</b> и скопировать оттуда <b>Project URL</b>
          и ключ <b>anon public</b> в поля ниже.</li>
    </ol>

    <div class="sql-box">
      <button class="btn small" id="copySql">📋 Скопировать код</button>
      <pre id="sqlText">${esc(SYNC_SQL)}</pre>
    </div>

    <form id="syncCfgForm" class="form-grid mt16">
      <label class="field" style="grid-column:1/-1;">Project URL
        <input type="url" name="url" placeholder="https://xxxxxxxx.supabase.co" required>
      </label>
      <label class="field" style="grid-column:1/-1;">Ключ anon public
        <input type="text" name="anonKey" placeholder="eyJhbGciOi..." required>
      </label>
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="submit" class="btn primary">Подключить</button>
      </div>
    </form>`;
}

function syncLoginHtml() {
  const isCustom = syncCfg.url !== DEFAULT_SUPABASE_URL;
  return `<p class="text-dim" style="font-size:13px;line-height:1.55;margin-top:0;">
      Заведи аккаунт — просто почта и пароль, больше ничего настраивать не нужно.
      Он нужен только для того, чтобы твои данные видел лишь ты: у каждого своя
      изолированная копия прогресса, даже если приложением пользуется ещё кто-то.
      На втором устройстве войди этой же парой, и прогресс подтянется сам.
    </p>
    <form id="syncLoginForm" class="form-grid">
      <label class="field">Почта
        <input type="email" name="email" autocomplete="username" required>
      </label>
      <label class="field">Пароль
        <input type="password" name="password" autocomplete="current-password" minlength="6" required>
      </label>
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="button" class="btn" data-signup>Создать аккаунт</button>
        <button type="submit" class="btn primary">Войти</button>
      </div>
    </form>
    ${isCustom ? `<div class="text-dim" style="font-size:12px;margin-top:10px;">Подключён свой проект: ${esc(syncCfg.url)}</div>` : ''}
    <button class="btn ghost small mt8" id="syncReset">Использовать свой проект Supabase</button>`;
}

function syncActiveHtml() {
  const when = syncCfg.lastSyncAt ? fmtRelTime(syncCfg.lastSyncAt) : 'ещё не было';
  return `<div class="ok-box" style="margin-top:0;">
      Синхронизация включена · ${esc(syncCfg.email)}
    </div>
    <div class="summary-list">
      <div class="sum-row"><span>Это устройство</span><b>${esc(syncCfg.deviceName)}</b></div>
      <div class="sum-row"><span>Последняя синхронизация</span><b>${esc(when)}</b></div>
      <div class="sum-row"><span>Состояние</span><b>${esc(syncStatus.text || 'ожидание')}</b></div>
    </div>
    <label class="switch mt16"><input type="checkbox" id="syncAuto" ${syncCfg.auto ? 'checked' : ''}>
      <span>Синхронизировать автоматически</span></label>
    <p class="text-dim" style="font-size:12.5px;line-height:1.5;margin:10px 0 0;">
      Прогресс выгружается через несколько секунд после изменений и подтягивается при открытии
      приложения. Если менял на двух устройствах офлайн — победит более свежая версия, без вопросов;
      предыдущая всё равно на секунду сохраняется в резервную копию браузера на случай сомнений.
    </p>
    <div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap;margin-top:14px;">
      <button class="btn primary" id="syncNowBtn">☁️ Синхронизировать сейчас</button>
      <button class="btn ghost" id="syncOutBtn">Выйти на этом устройстве</button>
    </div>

    <hr class="hr">
    <div class="card-title" style="margin-bottom:8px;">Распознавание еды по фото</div>
    <p class="text-dim" style="font-size:12.5px;line-height:1.5;margin:0 0 10px;">
      ${syncCfg.foodFn
        ? 'Уже подключено — «По фото» во вкладке «Питание» готово к работе. Адрес ниже можно поменять на свой, если разворачивал отдельную функцию.'
        : 'Адрес Edge Function, которая разбирает фото. Инструкция — файл <b>SETUP-FOOD-AI.md</b> в папке проекта.'}
    </p>
    <form id="foodFnForm" class="form-grid">
      <label class="field" style="grid-column:1/-1;">Адрес функции
        <input type="url" name="foodFn" value="${esc(syncCfg.foodFn || '')}"
               placeholder="https://xxxx.supabase.co/functions/v1/analyze-food">
      </label>
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="submit" class="btn">Сохранить адрес</button>
      </div>
    </form>`;
}

function bindSyncCard(root) {
  const copyBtn = root.querySelector('#copySql');
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(SYNC_SQL);
      toast('Код скопирован — вставь его в SQL Editor', 'green');
    } catch (e) {
      const r = document.createRange();
      r.selectNodeContents(root.querySelector('#sqlText'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      toast('Код выделен — скопируй его сочетанием Ctrl+C', 'gold');
    }
  });

  const cfgForm = root.querySelector('#syncCfgForm');
  if (cfgForm) cfgForm.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const url = String(f.get('url') || '').trim().replace(/\/+$/, '');
    const key = String(f.get('anonKey') || '').trim();
    if (!/^https:\/\//.test(url)) { toast('Адрес должен начинаться с https://', 'red'); return; }
    syncCfg.url = url;
    syncCfg.anonKey = key;
    saveSyncCfg();
    renderAll();
    toast('Проект подключён — теперь войди или создай аккаунт', 'green');
  });

  const loginForm = root.querySelector('#syncLoginForm');
  if (loginForm) {
    const submit = async (createAccount) => {
      const f = new FormData(loginForm);
      const email = String(f.get('email') || '').trim();
      const password = String(f.get('password') || '');
      if (!email || password.length < 6) { toast('Нужны почта и пароль от 6 символов', 'red'); return; }
      setSyncStatus('busy', 'Вход…');
      try {
        await syncSignIn(email, password, createAccount);
        toast('Вход выполнен — синхронизирую', 'green');
        renderAll();
        await syncNow(true);
        renderAll();
      } catch (err) {
        setSyncStatus('error', err.message || 'Ошибка входа');
        toast(err.message || 'Не удалось войти', 'red');
        renderAll();
      }
    };
    loginForm.addEventListener('submit', e => { e.preventDefault(); submit(false); });
    loginForm.querySelector('[data-signup]').addEventListener('click', () => submit(true));
  }

  const resetBtn = root.querySelector('#syncReset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    confirmAction('Переключиться на собственный проект Supabase вместо общего? Прогресс на этом устройстве останется на месте, но синхронизация до входа в новый проект работать не будет.', () => {
      syncCfg = { ...defaultSyncCfg(), deviceId: syncCfg.deviceId, deviceName: syncCfg.deviceName, url: '', anonKey: '', foodFn: '' };
      saveSyncCfg();
      renderAll();
    }, false);
  });

  const nowBtn = root.querySelector('#syncNowBtn');
  if (nowBtn) nowBtn.addEventListener('click', async () => { await syncNow(true); renderAll(); });

  const autoBox = root.querySelector('#syncAuto');
  if (autoBox) autoBox.addEventListener('change', e => {
    syncCfg.auto = e.target.checked;
    saveSyncCfg();
    setSyncStatus(e.target.checked ? 'ok' : 'off', e.target.checked ? 'Синхронизировано' : 'Автосинхронизация выключена');
  });

  const foodForm = root.querySelector('#foodFnForm');
  if (foodForm) foodForm.addEventListener('submit', e => {
    e.preventDefault();
    const v = String(new FormData(e.target).get('foodFn') || '').trim();
    if (v && !/^https:\/\/.+\/functions\/v1\/.+/.test(v)) {
      toast('Адрес должен выглядеть как https://…supabase.co/functions/v1/analyze-food', 'red');
      return;
    }
    syncCfg.foodFn = v;
    saveSyncCfg();
    toast(v ? 'Адрес функции сохранён' : 'Распознавание по фото отключено', 'green');
    renderAll();
  });

  const outBtn = root.querySelector('#syncOutBtn');
  if (outBtn) outBtn.addEventListener('click', () => {
    confirmAction('Выйти из аккаунта на этом устройстве? Прогресс останется здесь и в облаке.', () => {
      syncSignOut();
      renderAll();
    });
  });
}
