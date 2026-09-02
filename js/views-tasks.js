/* =========================================================================
   views-tasks.js — Задачи / Привычки / Ежедневки: один список на экране,
   переключение сегментированным контролом сверху (в стиле iOS)
   ========================================================================= */

const taskFilters = { type: 'todo', tag: '' };

const TASK_TYPES = [
  { key: 'todo', label: 'Задачи', icon: 'check' },
  { key: 'habit', label: 'Привычки', icon: 'repeat' },
  { key: 'daily', label: 'Ежедневки', icon: 'calendar' },
];
const TASK_HINTS = {
  todo: 'Список на день — новый день начинается с чистого листа, старые дни видно стрелками.',
  habit: 'Нажимаешь «+» сколько раз сделал за день, «−» — если сорвался.',
  daily: 'Отмечаешь раз в день по расписанию — ведёт стрик «дней подряд».',
};
const TASK_ADD_LABEL = { todo: 'задачу', habit: 'привычку', daily: 'ежедневку' };

/* ---- Задачи привязаны к дню: null значит «сегодня» ------------------------ */
let taskDate = null;
function curTaskDate() { return taskDate || todayStr(); }
function taskDayLabel(iso) {
  const diff = daysBetween(todayStr(), iso);
  if (diff === 0) return 'Сегодня';
  if (diff === -1) return 'Вчера';
  if (diff === 1) return 'Завтра';
  const d = parseDate(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('ru-RU', sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
}
function shiftTaskDate(delta) {
  const d = parseDate(curTaskDate());
  d.setDate(d.getDate() + delta);
  taskDate = dateStr(d);
  renderTasks();
}

function renderTasks() {
  const type = taskFilters.type;
  const allTags = [...new Set([
    ...state.habits.flatMap(t => t.tags || []),
    ...state.dailies.flatMap(t => t.tags || []),
    ...state.todos.flatMap(t => t.tags || []),
  ])];

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Задачи</h1>
        <p class="page-sub">${TASK_HINTS[type]}</p>
      </div>
      <div class="head-actions">
        <button class="btn primary" id="addTaskBtn">${icon('plus',15)} Добавить ${TASK_ADD_LABEL[type]}</button>
      </div>
    </div>

    <div class="seg wfull" id="typeSeg">
      ${TASK_TYPES.map(t => `<button class="seg-btn ${type === t.key ? 'on' : ''}" data-type="${t.key}">${icon(t.icon, 15)} ${t.label}</button>`).join('')}
    </div>

    ${type === 'todo' ? `<div class="task-day-nav" id="taskDayNav">
      <button class="day-nav-btn" data-day-shift="-1" title="Предыдущий день">${icon('chevronLeft',16)}</button>
      <div class="task-day-label">${esc(taskDayLabel(curTaskDate()))}</div>
      <button class="day-nav-btn" data-day-shift="1" title="Следующий день">${icon('chevronRight',16)}</button>
      ${curTaskDate() !== todayStr() ? `<button type="button" class="btn ghost small task-day-today" data-day-today>Сегодня</button>` : ''}
    </div>` : ''}

    ${allTags.length ? `<div class="tag-filter mt16" id="tagFilter">
      <button class="chip-btn ${!taskFilters.tag ? 'on' : ''}" data-tag="">Все</button>
      ${allTags.map(tag => `<button class="chip-btn ${taskFilters.tag === tag ? 'on' : ''}" data-tag="${esc(tag)}">#${esc(tag)}</button>`).join('')}
    </div>` : ''}

    <div class="flat-list mt16" id="taskList"></div>`;

  document.getElementById('addTaskBtn').addEventListener('click', () => openTaskForm(type));

  document.getElementById('typeSeg').addEventListener('click', e => {
    const b = e.target.closest('[data-type]');
    if (!b || b.dataset.type === taskFilters.type) return;
    taskFilters.type = b.dataset.type;
    renderTasks();
  });

  const dayNav = document.getElementById('taskDayNav');
  if (dayNav) dayNav.addEventListener('click', e => {
    const shiftBtn = e.target.closest('[data-day-shift]');
    if (shiftBtn) { shiftTaskDate(Number(shiftBtn.dataset.dayShift)); return; }
    if (e.target.closest('[data-day-today]')) { taskDate = null; renderTasks(); }
  });

  const tagFilterEl = document.getElementById('tagFilter');
  if (tagFilterEl) tagFilterEl.addEventListener('click', e => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    taskFilters.tag = b.dataset.tag;
    renderTasks();
  });

  renderTaskLists();
}

function matchesFilter(t) {
  if (taskFilters.tag && !(t.tags || []).includes(taskFilters.tag)) return false;
  return true;
}

function renderTaskLists() {
  const list = document.getElementById('taskList');
  if (!list) return;
  const type = taskFilters.type;

  if (type === 'habit') {
    const items = state.habits.filter(matchesFilter);
    list.innerHTML = items.length ? items.map(habitCardHtml).join('')
      : `<div class="empty-hint">Нет привычек. Например: «выпить воды», «залипнуть в телефон» (со знаком минус).</div>`;
  } else if (type === 'daily') {
    const items = state.dailies.filter(matchesFilter);
    const dueFirst = [...items].sort((a, b) => (isDailyDueToday(b) ? 1 : 0) - (isDailyDueToday(a) ? 1 : 0));
    list.innerHTML = dueFirst.length ? dueFirst.map(dailyCardHtml).join('')
      : `<div class="empty-hint">Нет ежедневок. Например: «зарядка», «30 минут чтения».</div>`;
  } else {
    const day = curTaskDate();
    const items = state.todos.filter(t => (t.date || todayStr()) === day).filter(matchesFilter);
    const active = items.filter(t => !t.done).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const done = items.filter(t => t.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
    const emptyMsg = day === todayStr() ? 'Пока пусто — самое время добавить дело'
      : day < todayStr() ? 'В этот день задач не было'
      : 'Пока ничего не запланировано';
    list.innerHTML = (active.length ? active.map(todoCardHtml).join('') : `<div class="task-day-empty">${emptyMsg}</div>`)
      + (done.length
        ? `<div class="col-divider">Выполнено (${done.length})</div>` + done.slice(0, 40).map(todoCardHtml).join('')
        : '');
  }

  bindTaskHandlers();
}

/* ---- Карточки ------------------------------------------------------------
   Минималистичный плоский вид: заголовок + (по желанию) заметка, вся
   дополнительная информация — тихой мелкой строкой под названием, а не
   цветными чипами. Чекбокс/кнопки — справа, кнопки редактирования
   полупрозрачны, пока на строку не наведёшься (на телефоне видны всегда). */
function habitCardHtml(h) {
  const net = (h.upCount || 0) - (h.downCount || 0);
  const toneClass = net > 3 ? 'tone-good' : net < -3 ? 'tone-bad' : '';
  const subParts = [];
  if (net) subParts.push(`<span class="${net > 0 ? '' : 'warn'}">баланс ${net > 0 ? '+' : ''}${net}</span>`);
  if (h.todayCount) subParts.push(`<span>сегодня ${h.todayCount}</span>`);
  if ((h.tags || []).length) subParts.push(`<span>${h.tags.map(t => '#' + esc(t)).join(' ')}</span>`);

  return `<div class="task-card habit ${toneClass}">
    <div class="task-body">
      <div class="task-title">${esc(h.title)}</div>
      ${h.note ? `<div class="task-note">${esc(h.note)}</div>` : ''}
      ${subParts.length ? `<div class="task-sub">${subParts.join('')}</div>` : ''}
    </div>
    <div class="task-actions">
      <button class="btn ghost small icon-only" data-edit="habit:${h.id}" title="Изменить">${icon('edit',14)}</button>
      <button class="btn ghost small icon-only danger-text" data-del="habit:${h.id}" title="Удалить">${icon('x',13)}</button>
    </div>
    <div class="task-btns">
      ${h.positive ? `<button class="pm-btn up" data-habit-up="${h.id}" title="Сделал">${icon('plus',16)}</button>` : ''}
      ${h.negative ? `<button class="pm-btn down" data-habit-down="${h.id}" title="Сорвался">${icon('minus',16)}</button>` : ''}
    </div>
  </div>`;
}

function dailyCardHtml(d) {
  const due = isDailyDueToday(d);
  const done = isDailyDoneToday(d);
  const checklistDone = (d.checklist || []).filter(c => c.done).length;
  const subParts = [];
  if (d.streak > 0) subParts.push(`<span class="fire">${icon('flame',12)} ${d.streak}</span>`);
  if ((d.checklist || []).length) subParts.push(`<span>${checklistDone}/${d.checklist.length}</span>`);
  if (!due) subParts.push(`<span>сегодня не по плану</span>`);
  if ((d.tags || []).length) subParts.push(`<span>${d.tags.map(t => '#' + esc(t)).join(' ')}</span>`);

  return `<div class="task-card daily ${done ? 'is-done' : ''} ${!due ? 'not-due' : ''}">
    <div class="task-body">
      <div class="task-title ${done ? 'strike' : ''}">${esc(d.title)}</div>
      ${d.note ? `<div class="task-note ${done ? 'strike' : ''}">${esc(d.note)}</div>` : ''}
      ${(d.checklist || []).length ? `<div class="checklist">${d.checklist.map(c =>
        `<label class="cl-item"><input type="checkbox" ${c.done ? 'checked' : ''} data-cl="daily:${d.id}:${c.id}"><span>${esc(c.text)}</span></label>`).join('')}</div>` : ''}
      ${subParts.length ? `<div class="task-sub">${subParts.join('')}</div>` : ''}
    </div>
    <div class="task-actions">
      <button class="btn ghost small icon-only" data-edit="daily:${d.id}" title="Изменить">${icon('edit',14)}</button>
      <button class="btn ghost small icon-only danger-text" data-del="daily:${d.id}" title="Удалить">${icon('x',13)}</button>
    </div>
    <button class="check-btn ${done ? 'checked' : ''}" data-daily="${d.id}" title="${done ? 'Отменить' : 'Выполнить'}">${done ? icon('checkmark',12) : ''}</button>
  </div>`;
}

function todoCardHtml(t) {
  const checklistDone = (t.checklist || []).filter(c => c.done).length;
  const subParts = [];
  if ((t.checklist || []).length) subParts.push(`<span>${checklistDone}/${t.checklist.length}</span>`);
  if ((t.tags || []).length) subParts.push(`<span>${t.tags.map(tag => '#' + esc(tag)).join(' ')}</span>`);

  return `<div class="task-card todo ${t.done ? 'is-done' : ''}">
    <div class="task-body">
      <div class="task-title ${t.done ? 'strike' : ''}">${esc(t.title)}</div>
      ${t.note ? `<div class="task-note ${t.done ? 'strike' : ''}">${esc(t.note)}</div>` : ''}
      ${(t.checklist || []).length ? `<div class="checklist">${t.checklist.map(c =>
        `<label class="cl-item"><input type="checkbox" ${c.done ? 'checked' : ''} data-cl="todo:${t.id}:${c.id}"><span>${esc(c.text)}</span></label>`).join('')}</div>` : ''}
      ${subParts.length ? `<div class="task-sub">${subParts.join('')}</div>` : ''}
    </div>
    <div class="task-actions">
      <button class="btn ghost small icon-only" data-edit="todo:${t.id}" title="Изменить">${icon('edit',14)}</button>
      <button class="btn ghost small icon-only danger-text" data-del="todo:${t.id}" title="Удалить">${icon('x',13)}</button>
    </div>
    <button class="check-btn ${t.done ? 'checked' : ''}" data-todo="${t.id}" title="${t.done ? 'Вернуть в работу' : 'Выполнить'}">${t.done ? icon('checkmark',12) : ''}</button>
  </div>`;
}

/* ---- Обработчики -------------------------------------------------------- */
function bindTaskHandlers() {
  const root = content();
  root.querySelectorAll('[data-habit-up]').forEach(b => b.addEventListener('click', () => clickHabit(b.dataset.habitUp, 1)));
  root.querySelectorAll('[data-habit-down]').forEach(b => b.addEventListener('click', () => clickHabit(b.dataset.habitDown, -1)));
  root.querySelectorAll('[data-daily]').forEach(b => b.addEventListener('click', () => toggleDaily(b.dataset.daily)));
  root.querySelectorAll('[data-todo]').forEach(b => b.addEventListener('click', () => toggleTodo(b.dataset.todo)));
  root.querySelectorAll('[data-cl]').forEach(cb => cb.addEventListener('change', () => {
    const [type, taskId, itemId] = cb.dataset.cl.split(':');
    toggleChecklist(type, taskId, itemId);
  }));
  root.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    const [type, id] = b.dataset.edit.split(':');
    openTaskForm(type, id);
  }));
  root.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    const [type, id] = b.dataset.del.split(':');
    deleteTask(type, id);
  }));
}

function clickHabit(id, dir) {
  mutate(() => {
    const h = state.habits.find(x => x.id === id);
    if (!h) return;
    const today = todayStr();
    if (h.lastDay !== today) { h.lastDay = today; h.todayCount = 0; }

    if (dir > 0) {
      h.upCount = (h.upCount || 0) + 1;
      h.todayCount = (h.todayCount || 0) + 1;
      SFX.complete();
      addLog('🔁', `Привычка «${h.title}» отмечена`);
    } else {
      h.downCount = (h.downCount || 0) + 1;
      addLog('⚠️', `Сорвался на «${h.title}»`);
    }
    h.history = h.history || [];
    h.history.push({ date: today, dir });
    if (h.history.length > 400) h.history = h.history.slice(-400);
  });
}

function toggleDaily(id) {
  mutate(() => {
    const d = state.dailies.find(x => x.id === id);
    if (!d) return;
    const today = todayStr();
    const idx = d.history.indexOf(today);
    if (idx === -1) {
      d.history.push(today);
      d.history.sort();
      recomputeStreak(d);
      SFX.complete();
      addLog('📅', `Ежедневка выполнена: ${d.title} (стрик ${d.streak})`);
      if (d.streak > 0 && d.streak % 7 === 0) {
        toast(`${d.title}: ${d.streak} ${plural(d.streak, 'день', 'дня', 'дней')} подряд!`, 'gold');
        confetti(50);
      }
    } else {
      d.history.splice(idx, 1);
      recomputeStreak(d);
    }
  });
}

function toggleTodo(id) {
  mutate(() => {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    if (!t.done) {
      t.done = true; t.doneAt = nowISO();
      SFX.complete();
      addLog('✅', `Задача выполнена: ${t.title}`);
    } else {
      t.done = false; t.doneAt = null;
    }
  });
}

function toggleChecklist(type, taskId, itemId) {
  mutate(() => {
    const list = type === 'daily' ? state.dailies : state.todos;
    const task = list.find(x => x.id === taskId);
    if (!task) return;
    const item = (task.checklist || []).find(c => c.id === itemId);
    if (item) item.done = !item.done;
  });
}

function deleteTask(type, id) {
  const key = type === 'habit' ? 'habits' : type === 'daily' ? 'dailies' : 'todos';
  const item = state[key].find(x => x.id === id);
  if (!item) return;
  confirmAction(`Удалить «${item.title}»? Историю и стрик восстановить будет нельзя.`, () => {
    mutate(() => { state[key] = state[key].filter(x => x.id !== id); markDeleted(id); });
  });
}

/* ---- Форма создания / редактирования ------------------------------------ */
function openTaskForm(type, id) {
  const key = type === 'habit' ? 'habits' : type === 'daily' ? 'dailies' : 'todos';
  const existing = id ? state[key].find(x => x.id === id) : null;
  const t = existing || {};
  const titles = { habit: 'привычка', daily: 'ежедневка', todo: 'задача' };
  const days = t.days || [1, 2, 3, 4, 5, 6, 0];

  const body = `
    <form id="taskForm" class="form-grid">
      <label class="field" style="grid-column: 1/-1;">Название
        <input type="text" name="title" value="${esc(t.title || '')}" placeholder="Что нужно делать?" required autofocus>
      </label>

      ${type === 'habit' ? `
      <div class="field" style="grid-column: 1/-1;">Тип привычки
        <div class="check-row">
          <label class="switch"><input type="checkbox" name="positive" ${t.positive !== false ? 'checked' : ''}><span>${icon('plus',14)} Есть кнопка «сделал»</span></label>
          <label class="switch"><input type="checkbox" name="negative" ${t.negative ? 'checked' : ''}><span>${icon('minus',14)} Есть кнопка «сорвался»</span></label>
        </div>
      </div>` : ''}

      ${type === 'todo' ? `
      <label class="field" style="grid-column: 1/-1;">Дата
        <input type="date" name="date" value="${esc(t.date || curTaskDate())}">
      </label>` : ''}

      ${type === 'daily' ? `
      <div class="field" style="grid-column: 1/-1;">Дни недели
        <div class="days-picker">
          ${[1, 2, 3, 4, 5, 6, 0].map(n =>
            `<label class="day-toggle"><input type="checkbox" name="day" value="${n}" ${days.includes(n) ? 'checked' : ''}><span>${WEEKDAYS[n]}</span></label>`).join('')}
        </div>
      </div>` : ''}

      <div class="form-actions" style="grid-column: 1/-1;">
        <button type="button" class="btn ghost" data-cancel>Отмена</button>
        <button type="submit" class="btn primary">${existing ? `${icon('save',15)} Сохранить` : `${icon('plus',15)} Добавить`}</button>
      </div>
    </form>`;

  openModal(existing ? `Изменить: ${titles[type]}` : `Новая ${titles[type]}`, body, modal => {
    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
    modal.querySelector('#taskForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const title = String(f.get('title') || '').trim();
      if (!title) return;

      const base = { title };

      mutate(() => {
        if (type === 'habit') {
          const positive = !!f.get('positive');
          const negative = !!f.get('negative');
          const data = { ...base, positive: positive || !negative, negative };
          if (existing) Object.assign(existing, data);
          else state.habits.push({ id: uid(), ...data, upCount: 0, downCount: 0, todayCount: 0, lastDay: null, history: [], createdAt: nowISO() });
        }
        if (type === 'daily') {
          const picked = f.getAll('day').map(Number);
          const data = { ...base, days: picked.length ? picked : [0, 1, 2, 3, 4, 5, 6] };
          if (existing) { Object.assign(existing, data); recomputeStreak(existing); }
          else state.dailies.push({ id: uid(), ...data, history: [], streak: 0, best: 0, createdAt: nowISO() });
        }
        if (type === 'todo') {
          const date = String(f.get('date') || '').trim() || curTaskDate();
          const data = { ...base, date };
          if (existing) Object.assign(existing, data);
          else state.todos.push({ id: uid(), ...data, done: false, doneAt: null, createdAt: nowISO() });
          // сразу переключаем экран на день задачи — иначе новая задача
          // «пропадает» из виду, пока не подвигаешь стрелки дней вручную
          taskDate = date === todayStr() ? null : date;
        }
        if (!existing) addLog('➕', `Создано: ${title}`);
      });
      closeModal();
    });
  });
}
