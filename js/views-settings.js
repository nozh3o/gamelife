/* =========================================================================
   views-settings.js — профиль, оформление, характеристики, бэкапы
   ========================================================================= */

const ACCENTS = [
  { id: 'violet', name: 'Фиолетовый', color: '#7c5cff' },
  { id: 'blue',   name: 'Синий',      color: '#3b82f6' },
  { id: 'green',  name: 'Зелёный',    color: '#22c08a' },
  { id: 'amber',  name: 'Янтарный',   color: '#e8a33d' },
  { id: 'rose',   name: 'Розовый',    color: '#f43f7e' },
  { id: 'cyan',   name: 'Бирюзовый',  color: '#17b7c9' },
];
const AVATARS = ['🧙', '🧝', '🦸', '🥷', '🧑‍🚀', '🧑‍💻', '🧑‍🎨', '🐺', '🦊', '🦁', '🐉', '🦉'];

function renderSettings() {
  const p = state.player;

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Настройки</h1>
        <p class="page-sub">Профиль, внешний вид, свои характеристики и резервные копии.</p>
      </div>
    </div>

    <div class="grid cols-2">
      <div class="card">
        <div class="card-title">Профиль героя</div>
        <form id="profileForm" class="form-grid">
          <label class="field" style="grid-column:1/-1;">Имя
            <input type="text" name="name" value="${esc(p.name)}" maxlength="24">
          </label>
          <div class="field" style="grid-column:1/-1;">Аватар
            <div class="avatar-picker" id="avatarPicker">
              ${AVATARS.map(a => `<button type="button" class="avatar-opt ${a === p.avatar ? 'on' : ''}" data-avatar="${a}">${a}</button>`).join('')}
            </div>
            <input type="hidden" name="avatar" value="${esc(p.avatar)}">
          </div>
          <label class="field">Валюта
            <select name="currency">
              ${['₸', '₽', '$', '€', '₴', '£', '¥'].map(c => `<option ${c === state.settings.currency ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </label>
          <div class="form-actions" style="grid-column:1/-1;">
            <button type="submit" class="btn primary">💾 Сохранить профиль</button>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="card-title">Оформление</div>
        <div class="field">Тема
          <div class="seg" id="themeSeg">
            <button class="seg-btn ${state.settings.theme === 'dark' ? 'on' : ''}" data-theme="dark">🌙 Тёмная</button>
            <button class="seg-btn ${state.settings.theme === 'light' ? 'on' : ''}" data-theme="light">☀️ Светлая</button>
          </div>
        </div>
        <div class="field mt16">Акцентный цвет
          <div class="accent-picker" id="accentPicker">
            ${ACCENTS.map(a => `<button class="accent-opt ${state.settings.accent === a.id ? 'on' : ''}" data-accent="${a.id}" style="background:${a.color}" title="${a.name}"></button>`).join('')}
          </div>
        </div>
        <hr class="hr">
        <label class="switch"><input type="checkbox" id="soundToggle" ${state.settings.sound ? 'checked' : ''}><span>🔊 Звуки наград и уровней</span></label>
        <label class="switch mt8"><input type="checkbox" id="confettiToggle" ${state.settings.confetti ? 'checked' : ''}><span>🎉 Конфетти на важных событиях</span></label>
      </div>
    </div>

    <div class="card mt16">
      <div class="card-title">Характеристики персонажа <small>используются в задачах, привычках и целях</small></div>
      <form id="statForm" class="form-grid" style="margin-bottom:14px;">
        <label class="field" style="max-width:90px;">Иконка<input type="text" name="icon" value="✨" maxlength="4"></label>
        <label class="field" style="grid-column: span 2;">Название<input type="text" name="name" placeholder="Например: Английский" required></label>
        <div class="form-actions" style="grid-column:1/-1;"><button type="submit" class="btn primary">➕ Добавить</button></div>
      </form>
      <div class="list" id="statsList"></div>
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
          <button class="btn" id="exportBtn">⬇️ Экспорт в файл</button>
          <label class="btn" style="cursor:pointer;">⬆️ Импорт из файла
            <input type="file" id="importInput" accept="application/json" style="display:none;">
          </label>
        </div>
      </div>

      <div class="card">
        <div class="card-title" style="color:var(--red);">Опасная зона</div>
        <p class="text-dim" style="font-size:13px;line-height:1.5;">
          Сброс удалит весь прогресс: задачи, стрики, цели, финансы, достижения и уровень.
          Перед этим лучше сделать экспорт.
        </p>
        <div class="form-actions" style="justify-content:flex-start;flex-wrap:wrap;">
          <button class="btn danger" id="resetProgressBtn">♻️ Обнулить только героя</button>
          <button class="btn danger-solid" id="resetBtn">🗑️ Удалить всё</button>
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
        <div><b>🔁 Привычки</b><p>Нажимаешь «+» столько раз, сколько сделал. «−» — за срыв, он бьёт по здоровью.</p></div>
        <div><b>📅 Ежедневки</b><p>Отмечаешь раз в день по расписанию. Пропуск = урон и обнуление стрика.</p></div>
        <div><b>✅ Задачи</b><p>Разовые дела. Чем выше сложность — тем больше опыта и золота.</p></div>
        <div><b>❤️ Здоровье</b><p>Кончилось — минус уровень и всё золото. Лечится зельем, уровнем или навыком Целителя.</p></div>
        <div><b>🪙 Золото</b><p>Тратится в Магазине на награды, которые ты придумал сам. Это ключевая часть системы.</p></div>
        <div><b>💎 Кристаллы</b><p>Выдаются за достижения и боссов. Тратятся на питомцев с постоянными бонусами.</p></div>
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
        Учти: сохранение на телефоне отдельное от компьютера — это два независимых героя.
        Чтобы перенести прогресс, выгрузи бэкап на одном устройстве и загрузи на другом.
      </p>${offline}`;
  }

  const install = canInstall()
    ? `<button class="btn primary" id="installBtn">📱 Установить как приложение</button>`
    : `<div class="help-grid" style="margin-top:4px;">
         <div><b>Android · Chrome</b><p>Меню ⋮ → «Установить приложение» (или «Добавить на главный экран»).</p></div>
         <div><b>iPhone · Safari</b><p>Кнопка «Поделиться» → «На экран «Домой»». В Chrome на iPhone этого пункта нет — нужен именно Safari.</p></div>
         <div><b>Windows · Chrome или Edge</b><p>Значок с монитором и стрелкой справа в адресной строке → «Установить». Появится ярлык в меню «Пуск» и своё окно без адресной строки.</p></div>
       </div>`;

  return `<p class="text-dim" style="font-size:13px;line-height:1.5;margin:0 0 12px;">
      GameLife ставится как обычное приложение — и на телефон, и на компьютер:
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

  // профиль
  const avatarInput = root.querySelector('[name=avatar]');
  root.querySelector('#avatarPicker').addEventListener('click', e => {
    const b = e.target.closest('[data-avatar]');
    if (!b) return;
    avatarInput.value = b.dataset.avatar;
    root.querySelectorAll('.avatar-opt').forEach(x => x.classList.toggle('on', x === b));
  });
  root.querySelector('#profileForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target);
    mutate(() => {
      state.player.name = String(f.get('name') || 'Игрок').trim() || 'Игрок';
      state.player.avatar = String(f.get('avatar') || '🧙').trim() || '🧙';
      state.settings.currency = f.get('currency');
    });
    toast('Профиль сохранён', 'green');
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

  // характеристики
  root.querySelector('#statForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = String(f.get('name') || '').trim();
    if (!name) return;
    mutate(() => state.stats.push({ id: uid(), name, icon: String(f.get('icon') || '✨').trim() || '✨', xp: 0 }));
  });

  root.querySelector('#statsList').innerHTML = state.stats.map(s => {
    const li = levelInfo(s.xp, 60, 25);
    return `<div class="row-item">
      <span class="ic">${s.icon}</span>
      <div class="main">
        <div class="title">${esc(s.name)}</div>
        <div class="meta"><span class="chip gold">ур. ${li.level}</span><span class="chip">${fmtNum(s.xp)} XP</span></div>
      </div>
      <div class="actions"><button class="btn ghost small icon-only danger-text" data-del-stat="${s.id}" title="Удалить">✕</button></div>
    </div>`;
  }).join('') || `<div class="empty-hint">Характеристик нет</div>`;

  root.querySelectorAll('[data-del-stat]').forEach(b => b.addEventListener('click', () => {
    const s = statById(b.dataset.delStat);
    confirmAction(`Удалить характеристику «${s ? s.name : ''}»? Задачи, привязанные к ней, останутся без категории.`, () => {
      mutate(() => {
        const id = b.dataset.delStat;
        state.stats = state.stats.filter(x => x.id !== id);
        [...state.habits, ...state.dailies, ...state.todos, ...state.goals]
          .forEach(t => { if (t.statId === id) t.statId = null; });
      });
    });
  }));

  // синхронизация
  bindSyncCard(root);

  // установка на телефон
  const installBtn = root.querySelector('#installBtn');
  if (installBtn) installBtn.addEventListener('click', promptInstall);

  // бэкапы
  root.querySelector('#exportBtn').addEventListener('click', exportData);
  root.querySelector('#importInput').addEventListener('change', importData);
  root.querySelector('#resetProgressBtn').addEventListener('click', resetHeroOnly);
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
      toast('Файл повреждён или это не бэкап GameLife', 'red');
      return;
    }
    if (!parsed || !parsed.player) {
      toast('Не похоже на бэкап GameLife', 'red');
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

function resetHeroOnly() {
  confirmAction('Обнулить уровень, опыт, золото и кристаллы? Задачи, цели и финансы останутся на месте.', () => {
    mutate(() => {
      const d = defaultState();
      state.player = { ...d.player, name: state.player.name, avatar: state.player.avatar, createdAt: state.player.createdAt };
      state.stats.forEach(s => s.xp = 0);
      state.pets = [];
      state.inventory = { potion: 0, mana: 0, shield: 0 };
      state.boss = { active: null, defeated: [] };
      state.activity = {};
      state.achievements = {};
      addLog('♻️', 'Герой обнулён — новый забег');
    });
    toast('Герой обнулён', 'green');
  });
}

function resetAll() {
  confirmAction('Это удалит ВСЕ данные без возможности вернуть: задачи, стрики, цели, финансы, журнал и достижения. Точно?', () => {
    confirmAction('Последнее предупреждение. Бэкап сделан?', () => {
      state = defaultState();
      saveState();
      applyTheme();
      currentTab = 'dashboard';
      renderAll();
      toast('Все данные удалены', 'red');
    });
  });
}
