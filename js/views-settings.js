/* =========================================================================
   views-settings.js — оформление, валюта, бэкапы
   ========================================================================= */

const ACCENTS = [
  { id: 'violet', name: 'Фиолетовый', color: '#7c5cff' },
  { id: 'blue',   name: 'Синий',      color: '#3b82f6' },
  { id: 'green',  name: 'Зелёный',    color: '#22c08a' },
  { id: 'amber',  name: 'Янтарный',   color: '#e8a33d' },
  { id: 'rose',   name: 'Розовый',    color: '#f43f7e' },
  { id: 'cyan',   name: 'Бирюзовый',  color: '#17b7c9' },
];

function renderSettings() {
  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Настройки</h1>
        <p class="page-sub">Внешний вид, валюта и резервные копии.</p>
      </div>
    </div>

    <div class="card">
        <div class="card-title">Оформление</div>
        <div class="field">Тема
          <div class="seg" id="themeSeg">
            <button class="seg-btn ${state.settings.theme === 'dark' ? 'on' : ''}" data-theme="dark">${icon('moon',14)} Тёмная</button>
            <button class="seg-btn ${state.settings.theme === 'light' ? 'on' : ''}" data-theme="light">${icon('sun',14)} Светлая</button>
          </div>
        </div>
        <div class="field mt16">Акцентный цвет
          <div class="accent-picker" id="accentPicker">
            ${ACCENTS.map(a => `<button class="accent-opt ${state.settings.accent === a.id ? 'on' : ''}" data-accent="${a.id}" style="background:${a.color}" title="${a.name}"></button>`).join('')}
          </div>
        </div>
        <label class="field mt16">Валюта
          <select name="currency" id="currencySelect">
            ${['₸', '₽', '$', '€', '₴', '£', '¥'].map(c => `<option ${c === state.settings.currency ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </label>
        <hr class="hr">
        <label class="switch"><input type="checkbox" id="soundToggle" ${state.settings.sound ? 'checked' : ''}><span>${icon('volume',14)} Звук при выполнении</span></label>
        <label class="switch mt8"><input type="checkbox" id="confettiToggle" ${state.settings.confetti ? 'checked' : ''}><span>${icon('sparkle',14)} Конфетти на важных событиях</span></label>
      </div>

    <div class="grid cols-2 mt16">
      <div class="card">
        <div class="card-title">Резервная копия</div>
        <p class="text-dim" style="font-size:13px;line-height:1.5;">
          Данные лежат только в этом браузере. Если почистить его данные или открыть приложение
          на другом компьютере — прогресс не подтянется. Делай экспорт раз в пару недель.
        </p>
        ${backupWarningHtml()}
        <div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap;">
          <button class="btn" id="exportBtn">${icon('download',15)} Экспорт в файл</button>
          <label class="btn" style="cursor:pointer;">${icon('upload',15)} Импорт из файла
            <input type="file" id="importInput" accept="application/json" style="display:none;">
          </label>
        </div>
      </div>

      <div class="card">
        <div class="card-title" style="color:var(--red);">Опасная зона</div>
        <p class="text-dim" style="font-size:13px;line-height:1.5;">
          Сброс удалит весь прогресс: задачи, стрики, цели, финансы и журнал.
          Перед этим лучше сделать экспорт.
        </p>
        <div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap;">
          <button class="btn danger-solid" id="resetBtn">${icon('trash',15)} Удалить всё</button>
        </div>
      </div>
    </div>

    <div class="card mt16">
      <div class="card-title">Синхронизация между устройствами</div>
      ${syncCardHtml()}
    </div>

    <div class="card mt16">
      <div class="card-title">На телефоне и компьютере</div>
      ${phoneCardHtml()}
    </div>

    <div class="card mt16">
      <div class="card-title">Как это работает</div>
      <div class="help-grid">
        <div><b>${icon('repeat',14)} Привычки</b><p>Нажимаешь «+» столько раз, сколько сделал за день. «−» — за срыв. Просто счётчик.</p></div>
        <div><b>${icon('calendar',14)} Ежедневки</b><p>Отмечаешь раз в день по расписанию. Пропуск обнуляет стрик «дней подряд».</p></div>
        <div><b>${icon('check',14)} Задачи</b><p>Список на день. Новый день — чистый лист, старые дни смотри стрелками.</p></div>
        <div><b>${icon('target',14)} Цели</b><p>Числовые, пошаговые или простые. Можно привязать денежную награду.</p></div>
        <div><b>${icon('wallet',14)} Финансы</b><p>Настоящие счета и операции в твоей валюте.</p></div>
        <div><b>${icon('leaf',14)} Питание</b><p>Дневная норма БЖУ и дневник приёмов пищи.</p></div>
      </div>
    </div>`;

  bindSettings();
}

/* Блок «На телефоне»: установка на домашний экран и статус офлайн-режима */
function phoneCardHtml() {
  const offline = offlineReady()
    ? `<div class="ok-box" style="margin-bottom:0;">Офлайн-режим включён — приложение открывается без интернета.</div>`
    : location.protocol === 'file:'
      ? `<div class="warn-box" style="margin-bottom:0;">Файл открыт напрямую с диска, поэтому офлайн-режим и установка недоступны. Они появятся, если открыть приложение по ссылке (см. README).</div>`
      : `<div class="warn-box" style="margin-bottom:0;">Офлайн-режим готовится — перезагрузи страницу, чтобы он включился.</div>`;

  if (isStandalone()) {
    return `<div class="ok-box">Приложение запущено с домашнего экрана.</div>
      <p class="text-dim" style="font-size:13px;line-height:1.5;">
        Учти: сохранение на телефоне отдельное от компьютера — это два независимых набора данных.
        Чтобы перенести прогресс, выгрузи бэкап на одном устройстве и загрузи на другом.
      </p>${offline}`;
  }

  const install = canInstall()
    ? `<button class="btn primary" id="installBtn">${icon('phone',15)} Установить как приложение</button>`
    : `<div class="help-grid" style="margin-top:4px;">
         <div><b>Android · Chrome</b><p>Меню ⋮ → «Установить приложение» (или «Добавить на главный экран»).</p></div>
         <div><b>iPhone · Safari</b><p>Кнопка «Поделиться» → «На экран «Домой»». В Chrome на iPhone этого пункта нет — нужен именно Safari.</p></div>
         <div><b>Windows · Chrome или Edge</b><p>Значок с монитором и стрелкой справа в адресной строке → «Установить». Появится ярлык в меню «Пуск» и своё окно без адресной строки.</p></div>
       </div>`;

  return `<p class="text-dim" style="font-size:13px;line-height:1.5;margin:0 0 12px;">
      One ставится как обычное приложение — и на телефон, и на компьютер:
      своя иконка, отдельное окно, работа без интернета.
    </p>
    ${install}
    <div style="margin-top:12px;">${offline}</div>`;
}

function backupWarningHtml() {
  const last = state.settings.lastBackup;
  if (!last) return `<div class="warn-box">Ты ещё ни разу не делал резервную копию.</div>`;
  const days = daysBetween(last, todayStr());
  if (days >= 14) return `<div class="warn-box">Последний бэкап был ${days} ${plural(days, 'день', 'дня', 'дней')} назад.</div>`;
  return `<div class="ok-box">Последний бэкап: ${fmtDateHuman(last)}</div>`;
}

function bindSettings() {
  const root = content();

  root.querySelector('#currencySelect').addEventListener('change', e => {
    mutate(() => { state.settings.currency = e.target.value; });
  });

  // тема и акцент
  root.querySelector('#themeSeg').addEventListener('click', e => {
    const b = e.target.closest('[data-theme]');
    if (!b) return;
    mutate(() => { state.settings.theme = b.dataset.theme; applyTheme(); });
  });
  root.querySelector('#accentPicker').addEventListener('click', e => {
    const b = e.target.closest('[data-accent]');
    if (!b) return;
    mutate(() => { state.settings.accent = b.dataset.accent; applyTheme(); });
  });
  root.querySelector('#soundToggle').addEventListener('change', e => {
    state.settings.sound = e.target.checked;
    saveState();
    if (e.target.checked) SFX.complete();
  });
  root.querySelector('#confettiToggle').addEventListener('change', e => {
    state.settings.confetti = e.target.checked;
    saveState();
    if (e.target.checked) confetti(30);
  });

  // синхронизация
  bindSyncCard(root);

  // установка на телефон
  const installBtn = root.querySelector('#installBtn');
  if (installBtn) installBtn.addEventListener('click', promptInstall);

  // бэкапы
  root.querySelector('#exportBtn').addEventListener('click', exportData);
  root.querySelector('#importInput').addEventListener('change', importData);
  root.querySelector('#resetBtn').addEventListener('click', resetAll);
}

/* ---- Экспорт / импорт ---------------------------------------------------- */
function exportData() {
  state.settings.lastBackup = todayStr();
  saveState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gamelife-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Файл бэкапа скачан', 'green');
  renderAll();
}

function importData(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (err) {
      toast('Файл повреждён или это не бэкап One', 'red');
      return;
    }
    if (!parsed || !parsed.player) {
      toast('Не похоже на бэкап One', 'red');
      return;
    }
    confirmAction('Импортировать файл? Текущий прогресс в браузере будет заменён.', () => {
      state = parsed.version >= 2 ? normalize(parsed, defaultState()) : migrateV1(parsed, defaultState());
      saveState();
      applyTheme();
      state.dailies.forEach(recomputeStreak);
      renderAll();
      toast('Данные импортированы', 'green');
    }, false);
  };
  reader.readAsText(file);
}

function resetAll() {
  confirmAction('Это удалит ВСЕ данные без возможности вернуть: задачи, стрики, цели, финансы и журнал. Точно?', () => {
    confirmAction('Последнее предупреждение. Бэкап сделан?', () => {
      state = defaultState();
      // помечаем сброс как осознанный — иначе синхронизация примет пустое
      // состояние за случайно опустевшее хранилище и подтянет старые данные назад
      try { localStorage.setItem(INTENTIONAL_RESET_KEY, '1'); } catch (e) {}
      saveState();
      applyTheme();
      currentTab = 'home';
      renderAll();
      toast('Все данные удалены', 'red');
    });
  });
}
