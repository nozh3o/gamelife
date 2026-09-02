/* =========================================================================
   views-workouts.js — трекер тренировок: упражнения и подходы (вес×повторы),
   прогресс по конкретному упражнению во времени
   ========================================================================= */

function renderWorkouts() {
  const workouts = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const weekAgo = dateStr(new Date(Date.now() - 6 * 86400000));
  const thisWeek = state.workouts.filter(w => w.date >= weekAgo).length;
  const streak = workoutStreak();

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Тренировки</h1>
        <p class="page-sub">Упражнения и подходы — вес и повторы, прогресс виден по каждому упражнению отдельно.</p>
      </div>
      <div class="head-actions">
        <button class="btn ghost" id="importWorkoutText">${icon('clipboard',15)} Импорт из текста</button>
        <button class="btn primary" id="addWorkout">${icon('plus',15)} Тренировка</button>
      </div>
    </div>

    <div class="grid cols-3">
      <div class="card kpi"><div class="kpi-label">Всего тренировок</div><div class="big-number">${state.workouts.length}</div></div>
      <div class="card kpi"><div class="kpi-label">На этой неделе</div><div class="big-number green">${thisWeek}</div></div>
      <div class="card kpi"><div class="kpi-label">Дней подряд</div><div class="big-number gold-text">${icon('flame',22)} ${streak}</div></div>
    </div>

    ${exerciseProgressHtml()}

    <div class="section-label">История <span class="chip">${workouts.length}</span></div>
    <div class="list" id="workoutList"></div>`;

  document.getElementById('addWorkout').addEventListener('click', () => openWorkoutForm());
  document.getElementById('importWorkoutText').addEventListener('click', () => openWorkoutImportForm());

  document.getElementById('workoutList').innerHTML = workouts.length
    ? workouts.map(workoutCardHtml).join('')
    : `<div class="empty-hint">Пока пусто. Например: «Верх тела» — жим лёжа, тяга блока, подъём гантель.</div>`;

  const progSel = document.getElementById('progressExercise');
  if (progSel) progSel.addEventListener('change', () => renderExerciseProgressChart(progSel.value));
  if (progSel && progSel.value) renderExerciseProgressChart(progSel.value);

  bindWorkoutHandlers();
}

/* ---- Список уникальных упражнений и график прогресса по выбранному -------- */
function allExerciseNames() {
  const seen = new Map(); // ключ в нижнем регистре -> оригинальное написание
  state.workouts.forEach(w => (w.exercises || []).forEach(ex => {
    const key = ex.name.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, ex.name.trim());
  }));
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'ru'));
}

function exerciseProgressHtml() {
  const names = allExerciseNames();
  if (!names.length) return '';
  return `<div class="card mt16">
    <div class="card-title">Прогресс по упражнению
      <select class="inline-select" id="progressExercise">
        ${names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
      </select>
    </div>
    <div id="progressChart"></div>
  </div>`;
}

function renderExerciseProgressChart(name) {
  const el = document.getElementById('progressChart');
  if (!el) return;
  const key = name.trim().toLowerCase();
  const points = [];
  [...state.workouts].sort((a, b) => a.date.localeCompare(b.date)).forEach(w => {
    (w.exercises || []).forEach(ex => {
      if (ex.name.trim().toLowerCase() !== key) return;
      const maxWeight = Math.max(0, ...ex.sets.map(s => s.weight || 0));
      if (maxWeight > 0) points.push({ label: fmtDateHuman(w.date).slice(0, 5), value: maxWeight });
    });
  });
  el.innerHTML = points.length
    ? barChartSvg(points.slice(-14), { color: 'var(--accent-2)', height: 130, valueFmt: v => v + ' кг' })
    : `<div class="empty-hint">Это упражнение пока без веса (только повторы) — графику показывать нечего</div>`;
}

/* ---- Карточка тренировки ------------------------------------------------- */
function workoutCardHtml(w) {
  const volume = (w.exercises || []).reduce((sum, ex) =>
    sum + (ex.sets || []).reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0), 0);
  return `<div class="card workout-card">
    <div class="flex-between">
      <div>
        <div class="workout-title">${esc(w.title || 'Тренировка')}</div>
        <div class="text-dim" style="font-size:12px;margin-top:2px;">${fmtDateHuman(w.date)}${volume ? ` · объём ${fmtNum(volume)} кг` : ''}</div>
      </div>
      <div class="goal-actions">
        <button class="btn ghost small icon-only" data-workout-edit="${w.id}" title="Изменить">${icon('edit',14)}</button>
        <button class="btn ghost small icon-only danger-text" data-workout-del="${w.id}" title="Удалить">${icon('x',13)}</button>
      </div>
    </div>
    ${w.note ? `<p class="workout-note">${esc(w.note)}</p>` : ''}
    <div class="exercise-list">
      ${(w.exercises || []).map(ex => `
        <div class="exercise-row">
          <div class="exercise-name">${esc(ex.name)}</div>
          <div class="exercise-sets">${(ex.sets || []).map(setChipHtml).join('')}</div>
        </div>`).join('') || '<div class="text-dim" style="font-size:12.5px;">Упражнения не указаны</div>'}
    </div>
  </div>`;
}
function setChipHtml(s) {
  return `<span class="chip">${s.weight ? `${fmtNum(s.weight)}×${fmtNum(s.reps)}` : fmtNum(s.reps)}</span>`;
}

function bindWorkoutHandlers() {
  const root = content();
  root.querySelectorAll('[data-workout-edit]').forEach(b => b.addEventListener('click', () => openWorkoutForm(b.dataset.workoutEdit)));
  root.querySelectorAll('[data-workout-del]').forEach(b => b.addEventListener('click', () => {
    const w = state.workouts.find(x => x.id === b.dataset.workoutDel);
    if (!w) return;
    confirmAction(`Удалить тренировку «${w.title || 'без названия'}» от ${fmtDateHuman(w.date)}?`, () => {
      mutate(() => { state.workouts = state.workouts.filter(x => x.id !== w.id); });
    });
  }));
}

/* ---- Редактор упражнений в форме: имя — текстом, вес/повторы — скроллом --- */
const WEIGHT_OPTIONS = Array.from({ length: 301 }, (_, i) => i);   // 0..300 кг
const REP_OPTIONS = Array.from({ length: 100 }, (_, i) => i + 1);  // 1..100 повторов

function nearestOption(v, options, fallback) {
  v = Math.round(Number(v));
  if (!Number.isFinite(v)) return fallback;
  if (options.includes(v)) return v;
  return options.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a, options[0]);
}

function setRowHtml(s) {
  const w = nearestOption(s ? s.weight : 0, WEIGHT_OPTIONS, 0);
  const r = nearestOption(s ? s.reps : 10, REP_OPTIONS, 10);
  return `<div class="ex-set-row">
    <div class="set-pick">
      <select class="wheel-select weight-select">${WEIGHT_OPTIONS.map(v => `<option value="${v}"${v === w ? ' selected' : ''}>${v}</option>`).join('')}</select>
      <span class="set-unit">кг</span>
    </div>
    <span class="set-x">×</span>
    <div class="set-pick">
      <select class="wheel-select reps-select">${REP_OPTIONS.map(v => `<option value="${v}"${v === r ? ' selected' : ''}>${v}</option>`).join('')}</select>
      <span class="set-unit">повт</span>
    </div>
    <button type="button" class="btn ghost small icon-only" data-remove-set title="Убрать подход">${icon('x',13)}</button>
  </div>`;
}

function exerciseBlockHtml(ex) {
  const sets = (ex && ex.sets && ex.sets.length) ? ex.sets : [null];
  return `<div class="ex-editor-item">
    <div class="ex-editor-head">
      <input type="text" class="ex-name-input" placeholder="Название упражнения" value="${esc(ex ? ex.name : '')}">
      <button type="button" class="btn ghost small icon-only" data-remove-ex title="Удалить упражнение">${icon('x',13)}</button>
    </div>
    <div class="ex-sets">${sets.map(setRowHtml).join('')}</div>
    <button type="button" class="btn ghost small" data-add-set>${icon('plus',13)} Подход</button>
  </div>`;
}

/* при добавлении нового подхода удобнее не начинать с нуля, а повторить
   вес/повторы последнего — обычно в тренировке подходы похожи друг на друга */
function lastSetValues(block) {
  const rows = block.querySelectorAll('.ex-set-row');
  if (!rows.length) return null;
  const last = rows[rows.length - 1];
  return {
    weight: Number(last.querySelector('.weight-select').value) || 0,
    reps: Number(last.querySelector('.reps-select').value) || 10,
  };
}

function readExercisesFromEditor(editor) {
  return [...editor.querySelectorAll('.ex-editor-item')].map(block => {
    const name = block.querySelector('.ex-name-input').value.trim();
    const sets = [...block.querySelectorAll('.ex-set-row')].map(row => ({
      weight: Number(row.querySelector('.weight-select').value) || 0,
      reps: Number(row.querySelector('.reps-select').value) || 0,
    })).filter(s => s.reps > 0 || s.weight > 0);
    return { name, sets };
  }).filter(ex => ex.name && ex.sets.length)
    .map(ex => ({ id: uid(), name: ex.name, sets: ex.sets }));
}

/* ---- Форма тренировки ------------------------------------------------------ */
function openWorkoutForm(id) {
  const existing = id ? state.workouts.find(x => x.id === id) : null;
  const w = existing || {};
  const exercises = (w.exercises && w.exercises.length) ? w.exercises : [null];

  const body = `
    <form id="workoutForm" class="form-grid">
      <label class="field" style="grid-column: span 2;">Название
        <input type="text" name="title" value="${esc(w.title || '')}" placeholder="Например: Верх тела" required autofocus>
      </label>
      <label class="field">Дата
        <input type="date" name="date" value="${esc(w.date || todayStr())}" max="${todayStr()}">
      </label>

      <div style="grid-column: 1/-1;">
        <span class="field-label">Упражнения</span>
        <div class="ex-editor" id="exEditor">${exercises.map(exerciseBlockHtml).join('')}</div>
        <button type="button" class="btn ghost small mt8" id="addExerciseBtn">${icon('plus',13)} Упражнение</button>
      </div>

      <label class="field" style="grid-column: 1/-1;">Заметка (необязательно)
        <textarea name="note" rows="2" placeholder="Самочувствие, что менять в следующий раз…">${esc(w.note || '')}</textarea>
      </label>

      <div class="form-actions" style="grid-column: 1/-1;">
        <button type="button" class="btn ghost" data-cancel>Отмена</button>
        <button type="submit" class="btn primary">${existing ? `${icon('save',15)} Сохранить` : `${icon('plus',15)} Добавить`}</button>
      </div>
    </form>`;

  openModal(existing ? 'Изменить тренировку' : 'Новая тренировка', body, modal => {
    const editor = modal.querySelector('#exEditor');

    modal.querySelector('#addExerciseBtn').addEventListener('click', () => {
      editor.insertAdjacentHTML('beforeend', exerciseBlockHtml(null));
      editor.lastElementChild.querySelector('.ex-name-input').focus();
    });

    editor.addEventListener('click', e => {
      const addSetBtn = e.target.closest('[data-add-set]');
      if (addSetBtn) {
        const block = addSetBtn.closest('.ex-editor-item');
        block.querySelector('.ex-sets').insertAdjacentHTML('beforeend', setRowHtml(lastSetValues(block)));
        return;
      }
      const removeSetBtn = e.target.closest('[data-remove-set]');
      if (removeSetBtn) { removeSetBtn.closest('.ex-set-row').remove(); return; }
      const removeExBtn = e.target.closest('[data-remove-ex]');
      if (removeExBtn) removeExBtn.closest('.ex-editor-item').remove();
    });

    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
    modal.querySelector('#workoutForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const title = String(f.get('title') || '').trim();
      if (!title) return;

      const data = {
        title,
        date: f.get('date') || todayStr(),
        note: String(f.get('note') || '').trim(),
        exercises: readExercisesFromEditor(editor),
      };

      mutate(() => {
        if (existing) Object.assign(existing, data);
        else {
          state.workouts.push({ id: uid(), ...data, createdAt: nowISO() });
          addLog('🏋️', `Тренировка записана: ${title}`);
        }
      });
      closeModal();
    });
  });
}

/* ---- Импорт тренировок из текста ------------------------------------------
   Многие ведут записи тренировок в заметках телефона в свободной форме —
   даём вставить такой текст целиком, без ручного повторного ввода.
   Понимаем формат вида:
     30 августа
     (грудь, бицепс)
     Жим на грудь горизонтально:
     20кг - 15 повторений - 1 подход
     по 14кг - 9 повторений - 1 подход
   Строка-дата начинает новый день, «(...)» сразу под ней — заголовок
   тренировки (группы мышц), дальше — название упражнения, потом его подходы.
   Несколько дней в одном тексте — тоже ок. */

const RU_MONTHS = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
  'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11,
};

function parseRuDateLine(line) {
  const m = line.trim().match(/^(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?\.?$/iu);
  if (!m || !(m[2].toLowerCase() in RU_MONTHS)) return null;
  const day = Number(m[1]);
  const month = RU_MONTHS[m[2].toLowerCase()];
  let year = m[3] ? Number(m[3]) : new Date().getFullYear();
  let d = new Date(year, month, day);
  if (!m[3]) {
    // без года — считаем, что запись из прошлого, а не из будущего
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (d > today) d = new Date(--year, month, day);
  }
  return Number.isNaN(d.getTime()) ? null : dateStr(d);
}

/* «20кг - 15 повторений - 1 подход» / «по 14кг - 9 повторений - 1 подход» —
   вес необязателен (упражнения с телом), «по» означает вес на руку/сторону,
   но хранится как есть — так же, как при ручном вводе одного числа веса. */
function parseSetLine(line) {
  const s = line.trim().replace(/[–—−]/g, '-');
  const m = s.match(/^(?:по\s+)?(?:([\d]+(?:[.,]\d+)?)\s*кг\s*-\s*)?(\d+)\s*повторени[а-яё]*\s*-\s*(\d+)\s*подход/iu);
  if (!m) return null;
  return {
    weight: m[1] ? Number(m[1].replace(',', '.')) : 0,
    reps: Number(m[2]),
    count: Math.max(1, Number(m[3]) || 1),
  };
}

function parseWorkoutBlock(date, rawLines) {
  const lines = rawLines.map(l => l.trim()).filter(Boolean);
  let title = '', start = 0;
  if (lines.length && /^\(.+\)$/.test(lines[0])) { title = lines[0].slice(1, -1).trim(); start = 1; }

  const exercises = [];
  let current = null;
  for (let i = start; i < lines.length; i++) {
    const set = parseSetLine(lines[i]);
    if (set) {
      if (!current) { current = { id: uid(), name: 'Упражнение', sets: [] }; exercises.push(current); }
      for (let k = 0; k < set.count; k++) current.sets.push({ weight: set.weight, reps: set.reps });
    } else {
      current = { id: uid(), name: lines[i].replace(/:\s*$/, '').trim(), sets: [] };
      exercises.push(current);
    }
  }
  return { title: title || 'Тренировка', date, note: '', exercises: exercises.filter(ex => ex.sets.length) };
}

function parseWorkoutsFromText(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim());
  const dateIdx = [];
  lines.forEach((l, i) => { if (l && parseRuDateLine(l)) dateIdx.push(i); });

  const blocks = dateIdx.length
    ? dateIdx.map((idx, i) => ({ date: parseRuDateLine(lines[idx]), lines: lines.slice(idx + 1, dateIdx[i + 1] ?? lines.length) }))
    : [{ date: todayStr(), lines }];

  return blocks.map(b => parseWorkoutBlock(b.date, b.lines)).filter(w => w.exercises.length);
}

function openWorkoutImportForm() {
  const body = `
    <p class="text-dim" style="font-size:13px;line-height:1.5;margin:0 0 12px;">
      Вставь запись тренировки текстом — понимаем строку с датой («30 августа»), заголовок
      в скобках, название упражнения и подходы вида «20кг - 15 повторений - 1 подход».
      Можно вставить сразу несколько дней подряд.
    </p>
    <label class="field">Текст тренировки
      <textarea id="importText" rows="14" placeholder="30 августа
(грудь, бицепс)

Жим на грудь горизонтально:
20кг - 15 повторений - 1 подход
40кг - 15 повторений - 1 подход"></textarea>
    </label>
    <div id="importPreview" class="mt16"></div>
    <div class="form-actions mt16">
      <button type="button" class="btn ghost" data-cancel>Отмена</button>
      <button type="button" class="btn primary" id="importParseBtn">${icon('checkmark',15)} Разобрать</button>
    </div>`;

  openModal('Импорт тренировки из текста', body, modal => {
    const textarea = modal.querySelector('#importText');
    const preview = modal.querySelector('#importPreview');
    let parsed = [];

    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
    modal.querySelector('#importParseBtn').addEventListener('click', () => {
      parsed = parseWorkoutsFromText(textarea.value);
      if (!parsed.length) {
        preview.innerHTML = `<div class="empty-hint">Не удалось распознать ни одной тренировки — проверь формат текста.</div>`;
        return;
      }
      preview.innerHTML = parsed.map(w => `
        <div class="card mt8">
          <div class="flex-between">
            <div class="workout-title">${esc(w.title)}</div>
            <div class="text-dim" style="font-size:12px;">${fmtDateHuman(w.date)}</div>
          </div>
          <div class="exercise-list">
            ${w.exercises.map(ex => `
              <div class="exercise-row">
                <div class="exercise-name">${esc(ex.name)}</div>
                <div class="exercise-sets">${ex.sets.map(setChipHtml).join('')}</div>
              </div>`).join('')}
          </div>
        </div>`).join('')
        + `<div class="form-actions mt16">
            <button type="button" class="btn primary" id="importSaveBtn">${icon('save',15)} Сохранить ${parsed.length} ${plural(parsed.length, 'тренировку', 'тренировки', 'тренировок')}</button>
           </div>`;
      preview.querySelector('#importSaveBtn').addEventListener('click', () => {
        mutate(() => {
          parsed.forEach(w => {
            state.workouts.push({ id: uid(), ...w, createdAt: nowISO() });
            addLog('🏋️', `Тренировка записана: ${w.title}`);
          });
        });
        toast(`Импортировано ${parsed.length} ${plural(parsed.length, 'тренировка', 'тренировки', 'тренировок')}`, 'gold');
        closeModal();
      });
    });
  });
}

function workoutStreak() {
  const set = new Set(state.workouts.map(w => w.date));
  let streak = 0;
  const cursor = new Date();
  if (!set.has(dateStr(cursor))) cursor.setDate(cursor.getDate() - 1);
  let guard = 0;
  while (set.has(dateStr(cursor)) && guard++ < 3650) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
