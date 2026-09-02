/* =========================================================================
   sync-ui.js — карточка синхронизации в Настройках: разметка и обработчики.

   Вся сетевая логика и алгоритм слияния — в sync.js, этот файл только
   рисует HTML и вешает обработчики поверх функций оттуда (общая область
   видимости классических скриптов, порядок в index.html: sync.js раньше).
   ========================================================================= */

function historyRowHtml(h) {
  const when = fmtRelTime(Date.parse(h.saved_at));
  const exact = new Date(h.saved_at).toLocaleString('ru-RU');
  return `<div class="sum-row">
    <span title="${esc(exact)}">${esc(when)}${h.device ? ' · ' + esc(h.device) : ''}</span>
    <button type="button" class="btn ghost small" data-restore-history="${h.id}">Восстановить</button>
  </div>`;
}

function openHistoryModal() {
  const body = `<div id="historyList"><div class="text-dim" style="font-size:12.5px;">Загрузка…</div></div>`;
  openModal('История сохранений', body, async modal => {
    const listEl = modal.querySelector('#historyList');
    try {
      const items = await listSaveHistory();
      if (!items.length) {
        listEl.innerHTML = `<div class="text-dim" style="font-size:12.5px;">Пока пусто — история появится после первых нескольких синхронизаций.</div>`;
        return;
      }
      listEl.innerHTML = `<div class="summary-list">${items.map(historyRowHtml).join('')}</div>`;
      listEl.querySelectorAll('[data-restore-history]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.restoreHistory;
        confirmAction('Вернуть состояние на эту версию? Текущее перед этим сохранится в резервную копию браузера на случай ошибки.', async () => {
          b.disabled = true;
          try {
            await restoreFromHistory(id);
            closeModal();
            toast('Прогресс восстановлен', 'green');
          } catch (err) {
            toast('Не удалось восстановить: ' + err.message, 'red');
            b.disabled = false;
          }
        });
      }));
    } catch (err) {
      listEl.innerHTML = `<div class="text-dim" style="font-size:12.5px;">Не удалось загрузить: ${esc(err.message)}. Если история ещё не подключена — обнови SQL в разделе синхронизации (кнопка «Скопировать код») и выполни его в Supabase заново.</div>`;
    }
  });
}

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
      <button class="btn small" id="copySql">${icon('clipboard',15)} Скопировать код</button>
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
      <button class="btn primary" id="syncNowBtn">${icon('cloud',15)} Синхронизировать сейчас</button>
      <button class="btn ghost" id="syncOutBtn">Выйти на этом устройстве</button>
    </div>
    <button class="btn ghost small mt8" id="showSqlBtn">${icon('clipboard',13)} SQL-код настройки</button>
    <p class="text-dim" style="font-size:11.5px;line-height:1.5;margin:6px 0 0;">
      Нужен, если приложение обновилось новой функцией (например «Запись из Клода»),
      а нужной таблицы ещё нет в Supabase — код безопасно выполнять повторно.
    </p>

    <hr class="hr">
    <div class="card-title" style="margin-bottom:8px;">История сохранений</div>
    <p class="text-dim" style="font-size:12.5px;line-height:1.5;margin:0 0 10px;">
      Каждый раз, когда прогресс сохраняется в облако, прошлая версия остаётся здесь —
      подстраховка на случай, если синхронизация что-то перепутает. Хранятся последние 30 версий,
      восстановить можно на любую из них.
    </p>
    <button class="btn ghost small" id="showHistoryBtn">${icon('clock',15)} Посмотреть историю</button>

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
    </form>

    <hr class="hr">
    <div class="card-title" style="margin-bottom:8px;">Запись из Клода</div>
    <p class="text-dim" style="font-size:12.5px;line-height:1.5;margin:0 0 10px;">
      Подключи One как личный коннектор в Клоде — и прямо в переписке сможешь диктовать
      траты, тренировки и приёмы пищи, а они сами появятся в приложении. Каждая ссылка
      действует только на твои данные и её можно отозвать в любой момент.
      Инструкция по подключению — файл <b>SETUP-AGENT-API.md</b> в папке проекта.
    </p>
    <div id="agentTokenList" class="summary-list">
      <div class="text-dim" style="font-size:12.5px;">Загрузка…</div>
    </div>
    <form id="agentTokenForm" class="form-grid mt8">
      <label class="field" style="grid-column:1/-1;">Название ссылки (необязательно)
        <input type="text" name="label" placeholder="Например: Клод на телефоне" maxlength="40">
      </label>
      <div class="form-actions" style="grid-column:1/-1;justify-content:flex-start;">
        <button type="submit" class="btn">${icon('key',15)} Создать личную ссылку</button>
      </div>
    </form>`;
}

function agentTokenRowHtml(t) {
  const when = t.last_used_at ? `использован ${fmtRelTime(Date.parse(t.last_used_at))}` : 'ещё не использован Клодом';
  return `<div class="sum-row">
    <span>${esc(t.label || 'Клод')}<br><span class="text-faint" style="font-size:11px;">${esc(when)}</span></span>
    <button type="button" class="btn ghost small icon-only danger-text" data-revoke-token="${t.id}" title="Отозвать">${icon('x',13)}</button>
  </div>`;
}

async function refreshAgentTokensList(root) {
  const el = root.querySelector('#agentTokenList');
  if (!el) return;
  try {
    const tokens = await listAgentTokens();
    el.innerHTML = tokens.length
      ? tokens.map(agentTokenRowHtml).join('')
      : `<div class="text-dim" style="font-size:12.5px;">Пока нет ни одной ссылки.</div>`;
    el.querySelectorAll('[data-revoke-token]').forEach(b => b.addEventListener('click', () => {
      confirmAction('Отозвать эту ссылку? Клод больше не сможет ею пользоваться.', async () => {
        try {
          await revokeAgentToken(b.dataset.revokeToken);
          refreshAgentTokensList(root);
          toast('Ссылка отозвана', 'green');
        } catch (e) { toast('Не удалось отозвать: ' + e.message, 'red'); }
      });
    }));
  } catch (e) {
    el.innerHTML = `<div class="text-dim" style="font-size:12.5px;">Не удалось загрузить: ${esc(e.message)}</div>`;
  }
}

function showAgentTokenOnce(url) {
  const body = `
    <p class="text-dim" style="font-size:13px;line-height:1.55;margin:0 0 12px;">
      Это единственный раз, когда ссылка показывается целиком — сохрани её сейчас.
      Дальше в Клоде: раздел коннекторов → добавить личный коннектор → вставить ссылку
      как есть. Подробности — файл <b>SETUP-AGENT-API.md</b>.
    </p>
    <div class="sql-box">
      <button class="btn small" id="copyAgentUrl">${icon('clipboard',15)} Скопировать ссылку</button>
      <pre id="agentUrlText" style="white-space:pre-wrap;word-break:break-all;">${esc(url)}</pre>
    </div>
    <div class="form-actions" style="margin-top:14px;">
      <button type="button" class="btn primary" data-modal-close>Сохранил, закрыть</button>
    </div>`;
  openModal('Личная ссылка для Клода', body, modal => {
    modal.querySelector('#copyAgentUrl').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        toast('Ссылка скопирована', 'green');
      } catch (e) {
        const r = document.createRange();
        r.selectNodeContents(modal.querySelector('#agentUrlText'));
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        toast('Ссылка выделена — скопируй сочетанием Ctrl+C', 'gold');
      }
    });
  });
}

/* Тот же SQL, что и на экране первичной настройки, но доступный и после
   подключения — понадобится, если в новой версии приложения появилась
   таблица/функция, которой ещё нет в уже настроенном проекте Supabase
   (например, «Запись из Клода» добавили в код позже, чем человек в
   последний раз запускал этот SQL). Код идемпотентный — повторный запуск
   ничего не портит. */
function showSyncSqlModal() {
  const body = `
    <p class="text-dim" style="font-size:13px;line-height:1.55;margin:0 0 12px;">
      Этот код можно выполнять повторно в любой момент — ничего не удаляет
      и не трогает уже сохранённые данные, только создаёт то, чего не хватает.
      Вставь в Supabase → <b>SQL Editor</b> → <b>Run</b>.
    </p>
    <div class="sql-box">
      <button class="btn small" id="copySqlModal">${icon('clipboard',15)} Скопировать код</button>
      <pre id="sqlTextModal">${esc(SYNC_SQL)}</pre>
    </div>
    <div class="form-actions" style="margin-top:14px;">
      <button type="button" class="btn primary" data-modal-close>Закрыть</button>
    </div>`;
  openModal('SQL-код синхронизации', body, modal => {
    modal.querySelector('#copySqlModal').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(SYNC_SQL);
        toast('Код скопирован — вставь его в SQL Editor', 'green');
      } catch (e) {
        const r = document.createRange();
        r.selectNodeContents(modal.querySelector('#sqlTextModal'));
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        toast('Код выделен — скопируй его сочетанием Ctrl+C', 'gold');
      }
    });
  });
}

function bindSyncCard(root) {
  const showSqlBtn = root.querySelector('#showSqlBtn');
  if (showSqlBtn) showSqlBtn.addEventListener('click', showSyncSqlModal);


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

  const historyBtn = root.querySelector('#showHistoryBtn');
  if (historyBtn) historyBtn.addEventListener('click', () => openHistoryModal());

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

  const tokenForm = root.querySelector('#agentTokenForm');
  if (tokenForm) {
    refreshAgentTokensList(root);
    tokenForm.addEventListener('submit', async e => {
      e.preventDefault();
      const label = String(new FormData(tokenForm).get('label') || '').trim();
      const btn = tokenForm.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const token = await createAgentToken(label);
        tokenForm.reset();
        showAgentTokenOnce(agentMcpUrl(token));
        refreshAgentTokensList(root);
      } catch (err) {
        toast('Не удалось создать ссылку: ' + err.message, 'red');
      } finally {
        btn.disabled = false;
      }
    });
  }
}
