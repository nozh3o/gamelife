/* =========================================================================
   views-tasks.js — Задачи / Привычки / Ежедневки: один список на экране,
   переключение сегментированным контролом сверху (в стиле iOS)
   ========================================================================= */

const taskFilters = { type: 'todo', tag: '', showDone: false };

const TASK_TYPES = [
  { key: 'todo', label: 'Задачи', icon: '✅' },
  { key: 'habit', label: 'Привычки', icon: '🔁' },
  { key: 'daily', label: 'Ежедневки', icon: '📅' },
];
const TASK_HINTS = {
  todo: 'Разовые дела со сроком и чек-листом. За просрочку не наказывают.',
  habit: 'Нажимаешь «+» сколько раз сделал за день, «−» — если сорвался.',
  daily: 'Отмечаешь раз в день по расписанию — ведёт стрик «дней подряд».',
};
const TASK_ADD_LABEL = { todo: 'задачу', habit: 'привычку', daily: 'ежедневку' };

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
        <button class="btn primary" id="addTaskBtn">＋ Добавить ${TASK_ADD_LABEL[type]}</button>
      </div>
    </div>

    <div class="seg wfull" id="typeSeg">
      ${TASK_TYPES.map(t => `<button class="seg-btn ${type === t.key ? 'on' : ''}" data-type="${t.key}">${t.icon} ${t.label}</button>`).join('')}
    </div>

    ${allTags.length ? `<div class="tag-filter mt16" id="tagFilter">
      <button class="chip-btn ${!taskFilters.tag ? 'on' : ''}" data-tag="">Все</button>
      ${allTags.map(tag => `<button class="chip-btn ${taskFilters.tag === tag ? 'on' : ''}" data-tag="${esc(tag)}">#${esc(tag)}</button>`).join('')}
    </div>` : ''}

    ${type === 'todo' ? `<label class="switch mt16"><input type="checkbox" id="showDone" ${taskFilters.showDone ? 'checked' : ''}><span>Показывать выполненные</span></label>` : ''}

    <div class="list mt16" id="taskList"></div>`;

  document.getElementById('addTaskBtn').addEventListener('click', () => openTaskForm(type));

  document.getElementById('typeSeg').addEventListener('click', e => {
    const b = e.target.closest('[data-type]');
    if (!b || b.dataset.type === taskFilters.type) return;
    taskFilters.type = b.dataset.type;
    renderTasks();
  });

  const tagFilterEl = document.getElementById('tagFilter');
  if (tagFilterEl) tagFilterEl.addEventListener('click', e => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    taskFilters.tag = b.dataset.tag;
    renderTasks();
  });

  const showDoneEl = document.getElementById('showDone');
  if (showDoneEl) showDoneEl.addEventListener('change', e => {
    taskFilters.showDone = e.target.checked;
    renderTaskLists();
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
    const items = state.todos.filter(matchesFilter);
    const active = items.filter(t => !t.done)
      .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.createdAt.localeCompare(a.createdAt));
    const done = items.filter(t => t.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
    list.innerHTML = (active.length ? active.map(todoCardHtml).join('') : `<div class="empty-hint">Активных задач нет</div>`)
      + (taskFilters.showDone && done.length
        ? `<div class="col-divider">Выполнено (${done.length})</div>` + done.slice(0, 40).map(todoCardHtml).join('')
        : '');
  }

  bindTaskHandlers();
}

/* ---- Карточки ---------------------------------------------------------- */
function habitCardHtml(h) {
  const net = (h.upCount || 0) - (h.downCount || 0);
  const toneClass = net > 3 ? 'tone-good' : net < -3 ? 'tone-bad' : '';
  return `<div class="task-card habit ${toneClass}">
    <div class="task-btns">
      ${h.positive ? `<button class="pm-btn up" data-habit-up="${h.id}" title="Сделал">＋</button>` : ''}
      ${h.negative ? `<button class="pm-btn down" data-habit-down="${h.id}" title="Сорвался">−</button>` : ''}
    </div>
    <div class="task-body">
      <div class="task-title">${esc(h.icon || '🔁')} ${esc(h.title)}</div>
      ${h.note ? `<div class="task-note">${esc(h.note)}</div>` : ''}
      <div class="task-meta">
        ${diffChip(h.difficulty)}${tagChips(h.tags)}
        <span class="chip ${net >= 0 ? 'green' : 'red'}">баланс: ${net > 0 ? '+' : ''}${net}</span>
        ${h.todayCount ? `<span class="chip">сегодня: ${h.todayCount}</span>` : ''}
      </div>
    </div>
    <div class="task-actions">
      <button class="btn ghost small icon-only" data-edit="habit:${h.id}" title="Изменить">✎</button>
      <button class="btn ghost small icon-only danger-text" data-del="habit:${h.id}" title="Удалить">✕</button>
    </div>
  </div>`;
}

function dailyCardHtml(d) {
  const due = isDailyDueToday(d);
  const done = isDailyDoneToday(d);
  const dots = last7Days().map(ds => {
    const dt = parseDate(ds);
    const scheduled = d.days.includes(dt.getDay());
    const hit = d.history.includes(ds);
    return `<div class="dot ${hit ? 'on' : scheduled ? 'sched' : ''}" title="${fmtDateHuman(ds)}"></div>`;
  }).join('');
  const checklistDone = (d.checklist || []).filter(c => c.done).length;

  return `<div class="task-card daily ${done ? 'is-done' : ''} ${!due ? 'not-due' : ''}">
    <button class="check-btn ${done ? 'checked' : ''}" data-daily="${d.id}" title="${done ? 'Отменить' : 'Выполнить'}">${done ? '✓' : ''}</button>
    <div class="task-body">
      <div class="task-title ${done ? 'strike' : ''}">${esc(d.icon || '📅')} ${esc(d.title)}</div>
      ${d.note ? `<div class="task-note">${esc(d.note)}</div>` : ''}
      ${(d.checklist || []).length ? `<div class="checklist">${d.checklist.map(c =>
        `<label class="cl-item"><input type="checkbox" ${c.done ? 'checked' : ''} data-cl="daily:${d.id}:${c.id}"><span>${esc(c.text)}</span></label>`).join('')}</div>` : ''}
      <div class="task-meta">
        ${diffChip(d.difficulty)}${tagChips(d.tags)}
        <span class="chip ${d.streak > 0 ? 'gold' : ''}">🔥 ${d.streak} ${plural(d.streak, 'день', 'дня', 'дней')}</span>
        ${d.best ? `<span class="chip">рекорд ${d.best}</span>` : ''}
        ${(d.checklist || []).length ? `<span class="chip">${checklistDone}/${d.checklist.length}</span>` : ''}
        ${!due ? `<span class="chip">сегодня не по плану</span>` : ''}
      </div>
      <div class="days-row">${d.days.length === 7 ? '<span class="chip">каждый день</span>'
        : d.days.map(n => `<span class="chip day">${WEEKDAYS[n]}</span>`).join('')}</div>
      <div class="dot-row">${dots}</div>
    </div>
    <div class="task-actions">
      <button class="btn ghost small icon-only" data-edit="daily:${d.id}" title="Изменить">✎</button>
      <button class="btn ghost small icon-only danger-text" data-del="daily:${d.id}" title="Удалить">✕</button>
    </div>
  </div>`;
}

function todoCardHtml(t) {
  const overdue = !t.done && t.due && t.due < todayStr();
  const dueSoon = !t.done && t.due && t.due === todayStr();
  const checklistDone = (t.checklist || []).filter(c => c.done).length;
  return `<div class="task-card todo ${t.done ? 'is-done' : ''} ${overdue ? 'overdue' : ''}">
    <button class="check-btn ${t.done ? 'checked' : ''}" data-todo="${t.id}" title="${t.done ? 'Вернуть в работу' : 'Выполнить'}">${t.done ? '✓' : ''}</button>
    <div class="task-body">
      <div class="task-title ${t.done ? 'strike' : ''}">${esc(t.title)}</div>
      ${t.note ? `<div class="task-note">${esc(t.note)}</div>` : ''}
      ${(t.checklist || []).length ? `<div class="checklist">${t.checklist.map(c =>
        `<label class="cl-item"><input type="checkbox" ${c.done ? 'checked' : ''} data-cl="todo:${t.id}:${c.id}"><span>${esc(c.text)}</span></label>`).join('')}</div>` : ''}
      <div class="task-meta">
        ${diffChip(t.difficulty)}${tagChips(t.tags)}
        ${(t.checklist || []).length ? `<span class="chip">${checklistDone}/${t.checklist.length}</span>` : ''}
        ${t.due ? `<span class="chip ${overdue ? 'red' : dueSoon ? 'gold' : ''}">${overdue ? '⏰ просрочено ' : '📆 до '}${fmtDateHuman(t.due)}</span>` : ''}
      </div>
    </div>
    <div class="task-actions">
      <button class="btn ghost small icon-only" data-edit="todo:${t.id}" title="Изменить">✎</button>
      <button class="btn ghost small icon-only danger-text" data-del="todo:${t.id}" title="Удалить">✕</button>
    </div>
  </div>`;
}

function last7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dateStr(d));
  }
  return days;
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
        toast(`🔥 ${d.title}: ${d.streak} ${plural(d.streak, 'день', 'дня', 'дней')} подряд!`, 'gold');
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
    mutate(() => { state[key] = state[key].filter(x => x.id !== id); });
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
      ${type !== 'todo' ? `<label class="field" style="max-width:90px;">Иконка
        <input type="text" name="icon" value="${esc(t.icon || (type === 'habit' ? '🔁' : '📅'))}" maxlength="4">
      </label>` : ''}
      <label class="field" style="grid-column: span 2;">Название
        <input type="text" name="title" value="${esc(t.title || '')}" placeholder="Что нужно делать?" required autofocus>
      </label>
      <label class="field" style="grid-column: 1/-1;">Заметка (необязательно)
        <textarea name="note" rows="2" placeholder="Детали, зачем это нужно…">${esc(t.note || '')}</textarea>
      </label>
      <label class="field">Сложность
        <select name="difficulty">${difficultyOptions(t.difficulty || 'easy')}</select>
      </label>
      <label class="field">Теги через запятую
        <input type="text" name="tags" value="${esc((t.tags || []).join(', '))}" placeholder="дом, спорт">
      </label>

      ${type === 'habit' ? `
      <div class="field" style="grid-column: 1/-1;">Тип привычки
        <div class="check-row">
          <label class="switch"><input type="checkbox" name="positive" ${t.positive !== false ? 'checked' : ''}><span>➕ Есть кнопка «сделал» (награда)</span></label>
          <label class="switch"><input type="checkbox" name="negative" ${t.negative ? 'checked' : ''}><span>➖ Есть кнопка «сорвался» (урон)</span></label>
        </div>
      </div>` : ''}

      ${type === 'daily' ? `
      <div class="field" style="grid-column: 1/-1;">Дни недели
        <div class="days-picker">
          ${[1, 2, 3, 4, 5, 6, 0].map(n =>
            `<label class="day-toggle"><input type="checkbox" name="day" value="${n}" ${days.includes(n) ? 'checked' : ''}><span>${WEEKDAYS[n]}</span></label>`).join('')}
        </div>
      </div>` : ''}

      ${type === 'todo' ? `
      <label class="field">Срок (необязательно)
        <input type="date" name="due" value="${esc(t.due || '')}">
      </label>` : ''}

      ${type !== 'habit' ? `
      <label class="field" style="grid-column: 1/-1;">Чек-лист — по одному пункту на строку
        <textarea name="checklist" rows="3" placeholder="Купить продукты&#10;Помыть посуду">${esc((t.checklist || []).map(c => c.text).join('\n'))}</textarea>
      </label>` : ''}

      <div class="form-actions" style="grid-column: 1/-1;">
        <button type="button" class="btn ghost" data-cancel>Отмена</button>
        <button type="submit" class="btn primary">${existing ? '💾 Сохранить' : '➕ Добавить'}</button>
      </div>
    </form>`;

  openModal(existing ? `Изменить: ${titles[type]}` : `Новая ${titles[type]}`, body, modal => {
    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
    modal.querySelector('#taskForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const title = String(f.get('title') || '').trim();
      if (!title) return;

      const oldChecklist = t.checklist || [];
      const checklist = String(f.get('checklist') || '').split('\n').map(s => s.trim()).filter(Boolean)
        .map(text => {
          const prev = oldChecklist.find(c => c.text === text);
          return { id: prev ? prev.id : uid(), text, done: prev ? prev.done : false };
        });

      const base = {
        title,
        note: String(f.get('note') || '').trim(),
        difficulty: f.get('difficulty') || 'easy',
        tags: parseTags(f.get('tags')),
      };

      mutate(() => {
        if (type === 'habit') {
          const positive = !!f.get('positive');
          const negative = !!f.get('negative');
          const data = { ...base, icon: String(f.get('icon') || '🔁').trim() || '🔁',
            positive: positive || !negative, negative };
          if (existing) Object.assign(existing, data);
          else state.habits.push({ id: uid(), ...data, upCount: 0, downCount: 0, todayCount: 0, lastDay: null, history: [], createdAt: nowISO() });
        }
        if (type === 'daily') {
          const picked = f.getAll('day').map(Number);
          const data = { ...base, icon: String(f.get('icon') || '📅').trim() || '📅',
            days: picked.length ? picked : [0, 1, 2, 3, 4, 5, 6], checklist };
          if (existing) { Object.assign(existing, data); recomputeStreak(existing); }
          else state.dailies.push({ id: uid(), ...data, history: [], streak: 0, best: 0, createdAt: nowISO() });
        }
        if (type === 'todo') {
          const data = { ...base, due: f.get('due') || null, checklist };
          if (existing) Object.assign(existing, data);
          else state.todos.push({ id: uid(), ...data, done: false, doneAt: null, createdAt: nowISO() });
        }
        if (!existing) addLog('➕', `Создано: ${title}`);
      });
      closeModal();
    });
  });
}
