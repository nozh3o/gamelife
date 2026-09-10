/* =========================================================================
   views-body.js — замеры тела: вес и обхваты с историей.

   Зачем отдельный раздел, если вес уже есть в профиле питания: там он один
   и нужен только формуле Миффлина. Здесь важен не сам вес, а его движение —
   поэтому запись хранит дату, а профиль питания просто подтягивает свежее
   значение, чтобы норма КБЖУ не считалась по цифре трёхмесячной давности.

   V-taper (плечи ÷ талия) считается сам и стоит рядом с весом намеренно:
   если вес падает, а V-taper стоит на месте, уходит не только жир.
   ========================================================================= */

/* Поля замера: любое можно оставить пустым — записали что померили. */
const BODY_FIELDS = [
  { key: 'weight',    label: 'Вес',    unit: 'кг', step: '0.1', hint: 'утром, натощак, после туалета' },
  { key: 'waist',     label: 'Талия',  unit: 'см', step: '0.5', hint: 'на уровне пупка, не втягивая живот' },
  { key: 'shoulders', label: 'Плечи',  unit: 'см', step: '0.5', hint: 'по самой широкой точке' },
  { key: 'hips',      label: 'Бёдра',  unit: 'см', step: '0.5', hint: 'по самой широкой точке' },
];

function bodyEntries() {
  return [...state.body.entries].sort((a, b) => b.date.localeCompare(a.date));
}

/* Последнее непустое значение поля — замеры бывают частичными, и «талия»
   из позапрошлого раза всё равно полезнее прочерка. */
function bodyLast(key) {
  return bodyEntries().find(e => e[key] != null && e[key] !== '') || null;
}

function vTaper(e) {
  if (!e || !e.shoulders || !e.waist) return null;
  return e.shoulders / e.waist;
}

/* Ближайший замер, где есть и плечи, и талия. */
function lastWithTaper() {
  return bodyEntries().find(e => vTaper(e) != null) || null;
}

function daysSinceLastMeasure() {
  const last = bodyEntries()[0];
  return last ? daysBetween(last.date, todayStr()) : null;
}

/* Через сколько дней следующий замер: минус — просрочка. */
function measureDueIn() {
  const every = state.body.settings.everyDays || 0;
  if (!every) return null;
  const since = daysSinceLastMeasure();
  if (since == null) return null;
  return every - since;
}

function bodyDelta(key, entries = bodyEntries()) {
  const withVal = entries.filter(e => e[key] != null && e[key] !== '');
  if (withVal.length < 2) return null;
  return withVal[0][key] - withVal[1][key];
}

function deltaChipHtml(delta, unit, goodWhenDown = true) {
  if (delta == null || Math.abs(delta) < 0.01) return '';
  const down = delta < 0;
  const good = goodWhenDown ? down : !down;
  const sign = down ? '−' : '+';
  return `<span class="chip ${good ? 'green' : 'red'}">${sign}${Math.abs(delta).toFixed(1)} ${unit}</span>`;
}

function renderBody() {
  const entries = bodyEntries();
  const last = entries[0];
  const lastWeight = bodyLast('weight');
  const taperEntry = lastWithTaper();
  const taper = vTaper(taperEntry);
  const since = daysSinceLastMeasure();
  const due = measureDueIn();

  const weightPoints = [...entries].reverse()
    .filter(e => e.weight != null && e.weight !== '')
    .map(e => ({ label: fmtDateHuman(e.date).slice(0, 5), value: Number(e.weight) }));

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Замеры</h1>
        <p class="page-sub">Вес и обхваты. Мерить лучше в один и тот же день недели, утром, до еды.</p>
      </div>
      <div class="head-actions">
        <button class="btn primary" id="bodyAdd">${icon('plus',15)} Записать замер</button>
      </div>
    </div>

    ${dueBannerHtml(due, since)}

    <div class="grid cols-3 mt16">
      <div class="card kpi">
        <div class="kpi-label">Вес</div>
        <div class="big-number">${lastWeight ? Number(lastWeight.weight).toFixed(1) : '—'}${lastWeight ? '<span class="unit"> кг</span>' : ''}</div>
        <div class="kpi-sub">${deltaChipHtml(bodyDelta('weight'), 'кг') || (lastWeight ? 'первый замер' : 'ещё не мерили')}</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">V-taper <small>плечи ÷ талия</small></div>
        <div class="big-number">${taper ? taper.toFixed(2) : '—'}</div>
        <div class="kpi-sub">${taper ? 'считается по последнему полному замеру' : 'нужны плечи и талия'}</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">Последний замер</div>
        <div class="big-number">${since == null ? '—' : since === 0 ? 'сегодня' : since}${since ? `<span class="unit"> ${plural(since, 'день', 'дня', 'дней')} назад</span>` : ''}</div>
        <div class="kpi-sub"><a href="#" id="bodySettings">напоминать раз в ${state.body.settings.everyDays || '—'} дн.</a></div>
      </div>
    </div>

    ${weightPoints.length >= 2 ? `<div class="card mt16">
      <div class="card-title">Вес по замерам</div>
      ${lineChartSvg(weightPoints.slice(-20), { color: 'var(--cyan)', height: 150, valueFmt: v => v.toFixed(1) + ' кг' })}
    </div>` : ''}

    <div class="section-label">История</div>
    <div class="list" id="bodyHistory"></div>`;

  document.getElementById('bodyHistory').innerHTML = entries.length
    ? entries.slice(0, 60).map(bodyRowHtml).join('')
    : `<div class="empty-hint">Пока пусто. Первый замер — точка отсчёта: без него график весит ноль.</div>`;

  document.getElementById('bodyAdd').addEventListener('click', () => openBodyForm());
  document.getElementById('bodySettings').addEventListener('click', e => { e.preventDefault(); openBodySettingsForm(); });
  const dueBtn = document.getElementById('bodyDueAdd');
  if (dueBtn) dueBtn.addEventListener('click', () => openBodyForm());

  content().querySelectorAll('[data-body-edit]').forEach(b =>
    b.addEventListener('click', () => openBodyForm(b.dataset.bodyEdit)));
  content().querySelectorAll('[data-body-del]').forEach(b =>
    b.addEventListener('click', () => {
      const e = state.body.entries.find(x => x.id === b.dataset.bodyDel);
      if (!e) return;
      confirmAction(`Удалить замер от ${fmtDateHuman(e.date)}?`, () => {
        mutate(() => {
          state.body.entries = state.body.entries.filter(x => x.id !== e.id);
          markDeleted(e.id);
          syncWeightToNutrition();
        });
      });
    }));
}

/* Баннер сверху — единственное место, где приложение само напоминает про
   замер внутри интерфейса (системное уведомление живёт в reminders.js). */
function dueBannerHtml(due, since) {
  if (due == null) {
    return since == null
      ? `<div class="warn-box" style="margin-top:14px;">Замеров ещё нет. <button class="btn small primary" id="bodyDueAdd" style="margin-left:8px;">Записать первый</button></div>`
      : '';
  }
  if (due > 0) return '';
  const overdue = -due;
  return `<div class="warn-box" style="margin-top:14px;">
    ${overdue === 0 ? 'Сегодня день замера.' : `Замер просрочен на ${overdue} ${plural(overdue, 'день', 'дня', 'дней')} — последний был ${since} ${plural(since, 'день', 'дня', 'дней')} назад.`}
    <button class="btn small primary" id="bodyDueAdd" style="margin-left:8px;">Записать</button>
  </div>`;
}

function bodyRowHtml(e) {
  const taper = vTaper(e);
  const parts = BODY_FIELDS
    .filter(f => e[f.key] != null && e[f.key] !== '')
    .map(f => `<span>${f.label} ${Number(e[f.key]).toFixed(1)} ${f.unit}</span>`);
  if (taper) parts.push(`<span>V ${taper.toFixed(2)}</span>`);
  return `<div class="row-item">
    <span class="ic-badge">${icon('ruler', 17)}</span>
    <div class="main">
      <div class="title">${fmtDateHuman(e.date)}</div>
      <div class="meta">${parts.length ? parts.join('') : '<span>пустой замер</span>'}</div>
      ${e.note ? `<div class="note-line">${esc(e.note)}</div>` : ''}
    </div>
    <div class="row-actions">
      <button class="btn ghost small icon-only" data-body-edit="${e.id}" title="Изменить">${icon('edit',14)}</button>
      <button class="btn ghost small icon-only danger-text" data-body-del="${e.id}" title="Удалить">${icon('x',13)}</button>
    </div>
  </div>`;
}

function openBodyForm(id) {
  const existing = id ? state.body.entries.find(x => x.id === id) : null;
  const e = existing || {};
  const isEdit = !!existing;
  // подставляем прошлые обхваты: они меняются медленно, и перебивать одну
  // цифру быстрее, чем вводить все четыре заново
  const prev = isEdit ? null : bodyEntries()[0];

  openModal(isEdit ? 'Изменить замер' : 'Новый замер', `
    <form id="bodyForm" class="form-grid">
      <label class="field">Дата
        <input type="date" name="date" value="${esc(e.date || todayStr())}" max="${todayStr()}" required>
      </label>
      ${BODY_FIELDS.map(f => `
        <label class="field">${f.label}, ${f.unit}
          <input type="number" name="${f.key}" step="${f.step}" min="0"
            value="${e[f.key] ?? ''}" placeholder="${prev && prev[f.key] != null && prev[f.key] !== '' ? Number(prev[f.key]).toFixed(1) : f.hint}">
        </label>`).join('')}
      <label class="field" style="grid-column:1/-1;">Заметка
        <input type="text" name="note" value="${esc(e.note || '')}" placeholder="Например: после недели без зала">
      </label>
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="button" class="btn ghost" data-cancel>Отмена</button>
        <button type="submit" class="btn primary">${isEdit ? `${icon('save',15)} Сохранить` : `${icon('plus',15)} Записать`}</button>
      </div>
    </form>`, modal => {
    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
    modal.querySelector('#bodyForm').addEventListener('submit', ev => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      const date = String(f.get('date') || '') || todayStr();
      const data = { date, note: String(f.get('note') || '').trim() };
      let filled = 0;
      BODY_FIELDS.forEach(fl => {
        const raw = String(f.get(fl.key) || '').trim();
        if (raw === '') { data[fl.key] = null; return; }
        const num = Number(raw);
        if (!isFinite(num) || num <= 0) { data[fl.key] = null; return; }
        data[fl.key] = num;
        filled++;
      });
      if (!filled) { toast('Заполни хотя бы одно измерение', 'red'); return; }

      mutate(() => {
        if (isEdit) {
          Object.assign(existing, data);
        } else {
          // на одну дату — один замер: второй за день не плодит строку, а обновляет
          const sameDay = state.body.entries.find(x => x.date === date);
          if (sameDay) Object.assign(sameDay, data);
          else state.body.entries.push({ id: uid(), ...data, createdAt: nowISO() });
          addLog('📏', `Замер записан: ${fmtDateHuman(date)}`);
        }
        syncWeightToNutrition();
      });
      closeModal();
      if (!isEdit) toast('Замер записан', 'green');
    });
  });
}

function openBodySettingsForm() {
  const every = state.body.settings.everyDays || 0;
  openModal('Напоминание о замере', `
    <form id="bodySettingsForm" class="form-grid">
      <label class="field" style="grid-column:1/-1;">Напоминать раз в, дней
        <input type="number" name="everyDays" min="0" max="90" step="1" value="${every}">
      </label>
      <p class="text-dim" style="grid-column:1/-1;font-size:12.5px;margin:0;">
        0 — не напоминать. Уведомление придёт вместе с вечерними итогами дня,
        если они включены в настройках.
      </p>
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="button" class="btn ghost" data-cancel>Отмена</button>
        <button type="submit" class="btn primary">${icon('save',15)} Сохранить</button>
      </div>
    </form>`, modal => {
    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
    modal.querySelector('#bodySettingsForm').addEventListener('submit', ev => {
      ev.preventDefault();
      const v = clamp(Number(new FormData(ev.target).get('everyDays')) || 0, 0, 90);
      mutate(() => { state.body.settings.everyDays = v; });
      closeModal();
    });
  });
}

/* Свежий вес уезжает в профиль питания: норма КБЖУ считается по формуле
   Миффлина от веса, и без этого она осталась бы на цифре, введённой руками
   один раз при настройке. Обратной связи нет — профиль сюда не пишет. */
function syncWeightToNutrition() {
  const last = bodyLast('weight');
  if (!last) return;
  const w = Number(last.weight);
  if (!isFinite(w) || w <= 0) return;
  state.nutrition.profile.weight = Math.round(w * 10) / 10;
}
