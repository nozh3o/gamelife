/* =========================================================================
   views-home.js — главный экран: быстрый ввод одной фразой, отсчёт
   до Бангкока, фраза дня, короткая сводка «Сегодня»
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
  const openTodos = state.todos.filter(t => !t.done && (t.date || today) === today);
  const soon = [...openTodos].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 6);

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">${greeting()}</h1>
        <p class="page-sub">${esc(new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
      </div>
    </div>

    ${quickBarHtml()}

    <div class="add-row" style="margin-top:0;">
      <button class="btn primary" data-quick="expense">${icon('wallet', 15)} Трата</button>
      <button class="btn" data-quick="meal">${icon('utensils', 15)} Приём пищи</button>
      <button class="btn" data-quick="journal">${icon('book', 15)} Запись в журнал</button>
    </div>

    ${weeklyDigestCardHtml()}

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
        <div class="card-title">Задачи на сегодня <small>${openTodos.length}</small></div>
        <div class="list" id="homeTodos"></div>
      </div>
    </div>`;

  document.getElementById('homeToday').innerHTML = dueToday.length
    ? dueToday.map(d => {
        const done = isDailyDoneToday(d);
        return `<div class="row-item compact ${done ? 'done' : ''}">
          <button class="check-btn small ${done ? 'checked' : ''}" data-home-daily="${d.id}">${done ? icon('checkmark',11) : ''}</button>
          <div class="main">
            <div class="title ${done ? 'strike' : ''}">${esc(d.title)}</div>
            ${d.streak ? `<div class="meta"><span class="chip gold">${icon('flame',12)} ${d.streak}</span></div>` : ''}
          </div>
        </div>`;
      }).join('')
    : `<div class="empty-hint">На сегодня ежедневок нет. Создай их во вкладке «Задачи».</div>`;

  document.getElementById('homeTodos').innerHTML = soon.length
    ? soon.map(t => `<div class="row-item compact">
          <button class="check-btn small" data-home-todo="${t.id}"></button>
          <div class="main">
            <div class="title">${esc(t.title)}</div>
          </div>
        </div>`).join('')
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

  bindQuickBar();
  startBangkokCountdown();
  bindWeeklyDigest();
}

/* ---- Итоги недели: карточка на главном экране только по понедельникам ---
   «Правильно реализовать» здесь означает три вещи: показывать строго в
   день недели === понедельник (не «раз в 7 дней от установки»), не лезть
   с пустой сводкой новым пользователям без данных, и давать спокойно
   скрыть карточку без риска, что она тут же появится опять при следующем
   действии в приложении (renderAll вызывается на каждый mutate). */
const WEEKLY_DIGEST_DISMISS_KEY = 'gamelife_weekdigest_dismissed_v1';
function isWeeklyDigestDismissed(startStr) {
  try { return localStorage.getItem(WEEKLY_DIGEST_DISMISS_KEY) === startStr; } catch (e) { return false; }
}
function dismissWeeklyDigest(startStr) {
  try { localStorage.setItem(WEEKLY_DIGEST_DISMISS_KEY, startStr); } catch (e) {}
}

function weeklyDigestCardHtml() {
  if (new Date().getDay() !== 1) return ''; // 1 = понедельник (getDay: вс=0)
  const d = weeklyDigest();
  if (isWeeklyDigestDismissed(d.startStr)) return '';

  const rows = [];
  if (d.income || d.expense) rows.push({ icon: 'wallet', color: SECTION_COLORS.finance, label: 'Отложено за неделю', value: fmtMoney(d.saved) });
  if (d.workoutsWeek) rows.push({ icon: 'dumbbell', color: SECTION_COLORS.workouts, label: 'Тренировки', value: `${d.workoutsWeek} ${plural(d.workoutsWeek, 'тренировка', 'тренировки', 'тренировок')}` });
  if (d.nutritionDayCount) rows.push({ icon: 'leaf', color: SECTION_COLORS.nutrition, label: 'Питание, в среднем за день', value: `${fmtNum(d.avgKcal)} ккал` });
  if (d.sleepDayCount) rows.push({ icon: 'moon', color: SECTION_COLORS.sleep, label: 'Сон, в среднем за ночь', value: `${fmtDuration(d.avgSleepMin)} · оценка ${d.avgSleepScore}` });
  if (d.moodDayCount) {
    const m = MOODS.find(x => x.id === Math.round(d.avgMood)) || MOODS[2];
    rows.push({ icon: 'book', color: SECTION_COLORS.journal, label: 'Настроение по дневнику', value: m.label });
  }
  if (d.activeDays) rows.push({ icon: 'check', color: SECTION_COLORS.tasks, label: 'Дней с активностью', value: `${d.activeDays} из 7` });

  if (!rows.length) return ''; // за неделю вообще ничего не вели — сводке нечего показать

  return `<div class="card mt16" id="weeklyDigestCard">
    <div class="card-title">
      <span>${icon('calendar', 16)} Итоги недели <small>${fmtDateHuman(d.startStr)} – ${fmtDateHuman(d.endStr)}</small></span>
      <button class="btn ghost small icon-only" id="weeklyDigestClose" title="Скрыть до следующего понедельника">${icon('x', 13)}</button>
    </div>
    <div class="weekly-digest-rows">
      ${rows.map(r => `<div class="wd-row">
        <span class="ic-badge" style="color:${r.color}">${icon(r.icon, 16)}</span>
        <span class="wd-label">${esc(r.label)}</span>
        <span class="wd-value">${esc(r.value)}</span>
      </div>`).join('')}
    </div>
  </div>`;
}

function bindWeeklyDigest() {
  const closeBtn = document.getElementById('weeklyDigestClose');
  if (!closeBtn) return;
  closeBtn.addEventListener('click', () => {
    dismissWeeklyDigest(weeklyDigest().startStr);
    document.getElementById('weeklyDigestCard').remove();
  });
}

/* ---- Отсчёт до вылета в Бангкок ------------------------------------------
   Дата зашита прямо в код, а не в state — значит её видят одинаково
   все, кто открывает это приложение (и ты, и друзья со своими аккаунтами). */
const BANGKOK_DEPARTURE = new Date(2026, 10, 30, 0, 0, 0);
let bangkokTimer = null;

function bangkokCountdownHtml() {
  return `<div class="card countdown-card" id="bangkokCountdown">
    <div class="card-title">${icon('plane',16)} До Бангкока <small>вылет 30 ноября</small></div>
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
    el.querySelector('.countdown-grid').innerHTML = `<div class="countdown-arrived">${icon('sparkle',18)} Уже летим (или улетели)!</div>`;
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
