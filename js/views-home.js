/* =========================================================================
   views-home.js — главный экран: отсчёт до Бангкока, фраза дня,
   короткая сводка «Сегодня»
   ========================================================================= */

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function renderHome() {
  const today = todayStr();
  const dueToday = state.dailies.filter(isDailyDueToday);
  const doneToday = dueToday.filter(isDailyDoneToday);
  const openTodos = state.todos.filter(t => !t.done);
  const overdue = openTodos.filter(t => t.due && t.due < today);
  const soon = [...openTodos]
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">${greeting()} 👋</h1>
        <p class="page-sub">${esc(new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
      </div>
    </div>

    <div class="add-row" style="margin-top:0;">
      <button class="btn primary" data-quick="expense">${icon('wallet', 15)} Трата</button>
      <button class="btn" data-quick="meal">${icon('utensils', 15)} Приём пищи</button>
      <button class="btn" data-quick="journal">${icon('book', 15)} Запись в журнал</button>
    </div>

    ${bangkokCountdownHtml()}

    <div class="card phrase-card mt16">
      <div class="phrase-mark">❝</div>
      <p class="phrase-text">${esc(phraseOfDay())}</p>
    </div>

    <div class="grid cols-2 mt16">
      <div class="card">
        <div class="card-title">Сегодня <small>${doneToday.length}/${dueToday.length}</small></div>
        <div class="list" id="homeToday"></div>
      </div>
      <div class="card">
        <div class="card-title">Ближайшие задачи <small>${openTodos.length}${overdue.length ? ` · <span class="text-red">${overdue.length} просрочено</span>` : ''}</small></div>
        <div class="list" id="homeTodos"></div>
      </div>
    </div>`;

  document.getElementById('homeToday').innerHTML = dueToday.length
    ? dueToday.map(d => {
        const done = isDailyDoneToday(d);
        return `<div class="row-item compact ${done ? 'done' : ''}">
          <button class="check-btn small ${done ? 'checked' : ''}" data-home-daily="${d.id}">${done ? '✓' : ''}</button>
          <div class="main">
            <div class="title ${done ? 'strike' : ''}">${esc(d.title)}</div>
            <div class="meta">${diffChip(d.difficulty)}<span class="chip ${d.streak ? 'gold' : ''}">🔥 ${d.streak}</span></div>
          </div>
        </div>`;
      }).join('')
    : `<div class="empty-hint">На сегодня ежедневок нет. Создай их во вкладке «Задачи».</div>`;

  document.getElementById('homeTodos').innerHTML = soon.length
    ? soon.map(t => {
        const late = t.due && t.due < today;
        return `<div class="row-item compact">
          <button class="check-btn small" data-home-todo="${t.id}"></button>
          <div class="main">
            <div class="title">${esc(t.title)}</div>
            <div class="meta">${diffChip(t.difficulty)}${t.due ? `<span class="chip ${late ? 'red' : ''}">${late ? '⏰ ' : '📆 '}${fmtDateHuman(t.due)}</span>` : ''}</div>
          </div>
        </div>`;
      }).join('')
    : `<div class="empty-hint">Открытых задач нет — можно выдохнуть</div>`;

  content().querySelectorAll('[data-home-daily]').forEach(b =>
    b.addEventListener('click', () => toggleDaily(b.dataset.homeDaily)));
  content().querySelectorAll('[data-home-todo]').forEach(b =>
    b.addEventListener('click', () => toggleTodo(b.dataset.homeTodo)));

  content().querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => {
    const kind = b.dataset.quick;
    if (kind === 'expense') openTxForm();
    else if (kind === 'meal') openFoodAdd('photo');
    else if (kind === 'journal') goTab('journal');
  }));

  startBangkokCountdown();
}

/* ---- Отсчёт до вылета в Бангкок ------------------------------------------
   Дата зашита прямо в код, а не в state — значит её видят одинаково
   все, кто открывает это приложение (и ты, и друзья со своими аккаунтами). */
const BANGKOK_DEPARTURE = new Date(2026, 10, 30, 0, 0, 0);
let bangkokTimer = null;

function bangkokCountdownHtml() {
  return `<div class="card countdown-card" id="bangkokCountdown">
    <div class="card-title">✈️ До Бангкока <small>вылет 30 ноября</small></div>
    <div class="countdown-grid">
      <div class="countdown-cell"><div class="countdown-num" id="cdDays">0</div><div class="countdown-label">дней</div></div>
      <div class="countdown-cell"><div class="countdown-num" id="cdHours">00</div><div class="countdown-label">часов</div></div>
      <div class="countdown-cell"><div class="countdown-num" id="cdMins">00</div><div class="countdown-label">минут</div></div>
      <div class="countdown-cell"><div class="countdown-num" id="cdSecs">00</div><div class="countdown-label">секунд</div></div>
    </div>
  </div>`;
}

function tickBangkokCountdown() {
  const el = document.getElementById('bangkokCountdown');
  // вкладку сменили — узел из DOM исчез, таймер больше не нужен
  if (!el) { clearInterval(bangkokTimer); bangkokTimer = null; return; }

  const diff = BANGKOK_DEPARTURE - new Date();
  if (diff <= 0) {
    el.querySelector('.countdown-grid').innerHTML = `<div class="countdown-arrived">🎉 Уже летим (или улетели)!</div>`;
    clearInterval(bangkokTimer); bangkokTimer = null;
    return;
  }
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  document.getElementById('cdDays').textContent = days;
  document.getElementById('cdHours').textContent = String(hours).padStart(2, '0');
  document.getElementById('cdMins').textContent = String(mins).padStart(2, '0');
  document.getElementById('cdSecs').textContent = String(secs).padStart(2, '0');
}

function startBangkokCountdown() {
  if (bangkokTimer) clearInterval(bangkokTimer);
  tickBangkokCountdown();
  bangkokTimer = setInterval(tickBangkokCountdown, 1000);
}
