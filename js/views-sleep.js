/* =========================================================================
   views-sleep.js — трекер сна: тапнул «Ложусь спать», тапнул «Проснулся»,
   получил длительность и оценку ночи. Без будильника — приложение не может
   надёжно разбудить, когда полностью закрыто (см. заметку в reminders.js),
   поэтому это только самозаполняемый дневник сна.
   ========================================================================= */

const SLEEP_QUALITY = [
  { id: 1, icon: 'mood1', label: 'Ужасно' },
  { id: 2, icon: 'mood2', label: 'Плохо' },
  { id: 3, icon: 'mood3', label: 'Нормально' },
  { id: 4, icon: 'mood4', label: 'Хорошо' },
  { id: 5, icon: 'mood5', label: 'Отлично' },
];

let sleepTickTimer = null;

function renderSleep() {
  const entries = [...state.sleep.entries].sort((a, b) => b.date.localeCompare(a.date) || (b.wokeAt || '').localeCompare(a.wokeAt || ''));
  const target = state.sleep.profile.targetHours || 8;
  const avgDuration = sleepAvg(entries, 7, 'durationMin');
  const avgScore = sleepAvg(entries, 7, 'score');
  const last = entries[0];

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Сон</h1>
        <p class="page-sub">Тапни «Ложусь спать» перед сном и «Проснулся» утром — остальное посчитаем сами.</p>
      </div>
      <div class="head-actions">
        <button class="btn ghost" id="sleepManualAdd">${icon('plus',15)} Добавить ночь вручную</button>
      </div>
    </div>

    <div id="sleepActiveZone"></div>

    <div class="grid cols-3 mt16">
      <div class="card kpi"><div class="kpi-label">Средняя длительность · 7 дней</div><div class="big-number">${avgDuration ? fmtDuration(avgDuration) : '—'}</div></div>
      <div class="card kpi"><div class="kpi-label">Средняя оценка · 7 дней</div><div class="big-number">${avgScore ? Math.round(avgScore) : '—'}</div></div>
      <div class="card kpi">
        <div class="kpi-label">Норма сна</div>
        <div class="big-number">${target} ч</div>
        <div class="kpi-sub"><a href="#" id="sleepTargetEdit">изменить</a></div>
      </div>
    </div>

    ${entries.length ? `<div class="card mt16">
      <div class="card-title">Длительность за 14 ночей</div>
      ${barChartSvg(last14SleepData(entries), { color: 'var(--cyan)', height: 130, valueFmt: v => fmtDuration(v * 60) })}
    </div>` : ''}

    <div class="section-label">История</div>
    <div class="list" id="sleepHistory"></div>`;

  renderSleepActiveZone();

  document.getElementById('sleepHistory').innerHTML = entries.length
    ? entries.slice(0, 60).map(sleepRowHtml).join('')
    : `<div class="empty-hint">Пока пусто. Отметь первую ночь — «Ложусь спать» ниже.</div>`;

  document.getElementById('sleepManualAdd').addEventListener('click', () => openSleepForm());
  document.getElementById('sleepTargetEdit').addEventListener('click', e => { e.preventDefault(); openSleepTargetForm(); });

  content().querySelectorAll('[data-sleep-edit]').forEach(b => b.addEventListener('click', () => openSleepForm(b.dataset.sleepEdit)));
  content().querySelectorAll('[data-sleep-del]').forEach(b => b.addEventListener('click', () => {
    const e = state.sleep.entries.find(x => x.id === b.dataset.sleepDel);
    if (!e) return;
    confirmAction(`Удалить запись о ночи ${fmtDateHuman(e.date)}?`, () => {
      mutate(() => { state.sleep.entries = state.sleep.entries.filter(x => x.id !== e.id); markDeleted(e.id); });
    });
  }));
}

function last14SleepData(entries) {
  const byDate = {};
  entries.forEach(e => { byDate[e.date] = e.durationMin; });
  const out = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = dateStr(d);
    out.push({ label: String(d.getDate()), value: Math.round((byDate[ds] || 0) / 60 * 10) / 10 });
  }
  return out;
}

function sleepRowHtml(e) {
  const q = SLEEP_QUALITY.find(x => x.id === e.quality);
  return `<div class="row-item">
    <span class="ic-badge">${icon('moon', 17)}</span>
    <div class="main">
      <div class="title">${fmtDuration(e.durationMin)} <span class="chip ${scoreChipClass(e.score)}" title="${esc(sleepScoreBreakdownText(e.scoreParts || []))}">${e.score}</span></div>
      <div class="meta">
        <span>${fmtDateHuman(e.date)}</span>
        <span>${fmtTimeOfISO(e.bedAt)} → ${fmtTimeOfISO(e.wokeAt)}</span>
        ${q ? `<span>${icon(q.icon, 13)} ${q.label}</span>` : ''}
        ${e.note ? `<span>${esc(e.note)}</span>` : ''}
      </div>
    </div>
    <div class="actions">
      <button class="btn ghost small icon-only" data-sleep-edit="${e.id}" title="Изменить">${icon('edit',14)}</button>
      <button class="btn ghost small icon-only danger-text" data-sleep-del="${e.id}" title="Удалить">${icon('x',13)}</button>
    </div>
  </div>`;
}
function scoreChipClass(score) {
  if (score >= 80) return 'green';
  if (score >= 55) return 'gold';
  return 'red';
}
function fmtTimeOfISO(iso) {
  if (!iso) return '—';
  return new Date(iso).toTimeString().slice(0, 5);
}

/* ---- Активная ночь: «Ложусь спать» → ждём 15 минут на засыпание → «Проснулся» */
function renderSleepActiveZone() {
  const zone = document.getElementById('sleepActiveZone');
  if (!zone) return;
  const a = state.sleep.active;
  if (!a) {
    zone.innerHTML = `<div class="card sleep-start-card">
      <div>
        <div class="card-title" style="color:#fff;">${icon('moon',18)} Ещё не спишь</div>
        <p class="text-dim" style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.8);">Нажми, когда ложишься — отсчёт сна начнём через 15 минут (обычно столько нужно, чтобы заснуть).</p>
      </div>
      <button class="btn" id="sleepStartBtn" style="background:#fff;color:#15171f;">${icon('moon',15)} Ложусь спать</button>
    </div>`;
    document.getElementById('sleepStartBtn').addEventListener('click', () => {
      mutate(() => { state.sleep.active = { bedAt: nowISO() }; });
      toast('Спокойной ночи 🌙');
      renderSleepActiveZone();
    });
    if (sleepTickTimer) { clearInterval(sleepTickTimer); sleepTickTimer = null; }
    return;
  }

  zone.innerHTML = `<div class="card sleep-start-card">
    <div>
      <div class="card-title" style="color:#fff;" id="sleepActiveTitle"></div>
      <p class="text-dim" style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.8);" id="sleepActiveSub"></p>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn ghost" id="sleepCancelBtn" style="border-color:rgba(255,255,255,.4);color:#fff;">Отмена</button>
      <button class="btn" id="sleepWakeBtn" style="background:#fff;color:#15171f;">${icon('sun',15)} Проснулся</button>
    </div>
  </div>`;

  document.getElementById('sleepCancelBtn').addEventListener('click', () => {
    mutate(() => { state.sleep.active = null; });
    toast('Сон отменён', 'red');
    renderSleepActiveZone();
  });
  document.getElementById('sleepWakeBtn').addEventListener('click', () => {
    const bedAt = new Date(a.bedAt);
    const asleepAt = new Date(bedAt.getTime() + SLEEP_FALL_ASLEEP_MIN * 60000);
    if (Date.now() < asleepAt.getTime()) {
      toast(`Прошло меньше ${SLEEP_FALL_ASLEEP_MIN} минут — рано считать, что уже спал(а). Если это ошибка, нажми «Отмена».`, 'red');
      return;
    }
    openSleepForm(null, { bedAt: a.bedAt, asleepAt: asleepAt.toISOString(), wokeAt: nowISO(), closesActive: true });
  });

  tickSleepActive();
  if (sleepTickTimer) clearInterval(sleepTickTimer);
  sleepTickTimer = setInterval(tickSleepActive, 1000);
}

function tickSleepActive() {
  const titleEl = document.getElementById('sleepActiveTitle');
  const subEl = document.getElementById('sleepActiveSub');
  const a = state.sleep.active;
  if (!titleEl || !subEl || !a) { clearInterval(sleepTickTimer); sleepTickTimer = null; return; }

  const bedAt = new Date(a.bedAt);
  const asleepAt = new Date(bedAt.getTime() + SLEEP_FALL_ASLEEP_MIN * 60000);
  const now = new Date();

  if (now < asleepAt) {
    const leftSec = Math.max(0, Math.round((asleepAt - now) / 1000));
    titleEl.innerHTML = `${icon('hourglass',18)} Досыпаешь до отсчёта`;
    subEl.textContent = `Сон начнём считать в ${asleepAt.toTimeString().slice(0,5)} — через ${Math.floor(leftSec/60)}:${String(leftSec%60).padStart(2,'0')}`;
  } else {
    const elapsedMin = Math.floor((now - asleepAt) / 60000);
    titleEl.innerHTML = `${icon('moon',18)} Спишь уже ${fmtDuration(elapsedMin)}`;
    subEl.textContent = `Заснул(а) примерно в ${asleepAt.toTimeString().slice(0,5)}`;
  }
}

/* ---- Форма записи ночи: и для закрытия активной ночи, и для ручного
   добавления/редактирования — набор полей один и тот же. */
function openSleepForm(id, prefill) {
  const existing = id ? state.sleep.entries.find(x => x.id === id) : null;
  const e = existing || {};
  const bed = e.bedAt ? new Date(e.bedAt) : (prefill && prefill.bedAt ? new Date(prefill.bedAt) : new Date(Date.now() - 8 * 3600000));
  const woke = e.wokeAt ? new Date(e.wokeAt) : (prefill && prefill.wokeAt ? new Date(prefill.wokeAt) : new Date());
  const closesActive = !!(prefill && prefill.closesActive);

  const body = `
    <form id="sleepForm" class="form-grid">
      <label class="field">Лёг(ла) спать — дата
        <input type="date" name="bedDate" value="${dateStr(bed)}">
      </label>
      <label class="field">Лёг(ла) спать — время
        <input type="time" name="bedTime" value="${bed.toTimeString().slice(0,5)}">
      </label>
      <label class="field">Проснулся(лась) — дата
        <input type="date" name="wakeDate" value="${dateStr(woke)}">
      </label>
      <label class="field">Проснулся(лась) — время
        <input type="time" name="wakeTime" value="${woke.toTimeString().slice(0,5)}">
      </label>
      <div class="field" style="grid-column: 1/-1;">Как спалось?
        <div class="avatar-picker" id="sleepQualityPicker">
          ${SLEEP_QUALITY.map(q => `<button type="button" class="avatar-opt ${e.quality === q.id ? 'on' : ''}" data-quality="${q.id}" title="${q.label}">${icon(q.icon, 19)}</button>`).join('')}
        </div>
        <input type="hidden" name="quality" value="${e.quality || ''}">
      </div>
      <label class="field" style="grid-column: 1/-1;">Заметка (необязательно)
        <input type="text" name="note" value="${esc(e.note || '')}" placeholder="Например: проснулся среди ночи">
      </label>
      <p class="text-dim" id="sleepPreview" style="grid-column:1/-1;font-size:12.5px;margin:0;"></p>
      <div class="form-actions" style="grid-column: 1/-1;">
        <button type="button" class="btn ghost" data-cancel>Отмена</button>
        <button type="submit" class="btn primary">${existing ? `${icon('save',15)} Сохранить` : `${icon('checkmark',15)} Готово`}</button>
      </div>
    </form>`;

  openModal(existing ? 'Изменить ночь' : 'Как прошла ночь?', body, modal => {
    const form = modal.querySelector('#sleepForm');
    const qualityInput = form.quality;
    modal.querySelector('#sleepQualityPicker').addEventListener('click', ev => {
      const b = ev.target.closest('[data-quality]');
      if (!b) return;
      const val = Number(b.dataset.quality);
      qualityInput.value = qualityInput.value === String(val) ? '' : val;
      modal.querySelectorAll('#sleepQualityPicker .avatar-opt').forEach(x =>
        x.classList.toggle('on', x.dataset.quality === qualityInput.value));
    });

    const preview = modal.querySelector('#sleepPreview');
    const updatePreview = () => {
      const { asleepAt, wokeAt, durationMin } = readSleepFormTimes(form);
      if (durationMin > 0) {
        preview.textContent = `Считаем сон с ${asleepAt.toTimeString().slice(0,5)} (через ${SLEEP_FALL_ASLEEP_MIN} мин после «лёг спать») до ${wokeAt.toTimeString().slice(0,5)} — ${fmtDuration(durationMin)}.`;
      } else {
        preview.textContent = 'Время пробуждения должно быть позже времени засыпания.';
      }
    };
    form.querySelectorAll('input[type=date],input[type=time]').forEach(inp => inp.addEventListener('input', updatePreview));
    updatePreview();

    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      const { bedAt, asleepAt, wokeAt, durationMin } = readSleepFormTimes(form);
      if (durationMin <= 0) { toast('Проверь даты и время — пробуждение раньше засыпания', 'red'); return; }

      const target = state.sleep.profile.targetHours || 8;
      const quality = qualityInput.value ? Number(qualityInput.value) : null;
      const priors = priorBedTimes(state.sleep.entries, bedAt.toISOString(), existing && existing.id);
      const { score, parts } = computeSleepScore(durationMin, target, quality, bedAt.toISOString(), priors);
      const note = String(new FormData(form).get('note') || '').trim();

      mutate(() => {
        if (existing) {
          Object.assign(existing, {
            date: dateStr(wokeAt), bedAt: bedAt.toISOString(), asleepAt: asleepAt.toISOString(),
            wokeAt: wokeAt.toISOString(), durationMin, quality, note, score, scoreParts: parts,
          });
        } else {
          state.sleep.entries.push({
            id: uid(), date: dateStr(wokeAt), bedAt: bedAt.toISOString(), asleepAt: asleepAt.toISOString(),
            wokeAt: wokeAt.toISOString(), durationMin, quality, note, score, scoreParts: parts, createdAt: nowISO(),
          });
          addLog('🌙', `Сон: ${fmtDuration(durationMin)}, оценка ${score}`);
        }
        if (closesActive) state.sleep.active = null;
      });
      toast(`Оценка ночи: ${score} (${sleepScoreBreakdownText(parts)}) · ${sleepAdvice(durationMin, target, parts)}`, score >= 70 ? 'green' : '');
      closeModal();
    });
  });
}

/* Из полей формы (дата+время лёг/проснулся) считает asleepAt (+15 мин от «лёг»)
   и итоговую длительность — используется и при вводе, и на превью в реальном времени. */
function readSleepFormTimes(form) {
  const bedAt = new Date(`${form.bedDate.value}T${form.bedTime.value || '00:00'}`);
  let wokeAt = new Date(`${form.wakeDate.value}T${form.wakeTime.value || '00:00'}`);
  const asleepAt = new Date(bedAt.getTime() + SLEEP_FALL_ASLEEP_MIN * 60000);
  const durationMin = Math.round((wokeAt - asleepAt) / 60000);
  return { bedAt, asleepAt, wokeAt, durationMin };
}

function openSleepTargetForm() {
  const body = `
    <form id="sleepTargetForm" class="form-grid">
      <label class="field" style="grid-column:1/-1;">Сколько часов сна — твоя норма?
        <input type="number" name="targetHours" min="4" max="12" step="0.5" value="${state.sleep.profile.targetHours || 8}">
      </label>
      <div class="form-actions" style="grid-column: 1/-1;">
        <button type="button" class="btn ghost" data-cancel>Отмена</button>
        <button type="submit" class="btn primary">${icon('save',15)} Сохранить</button>
      </div>
    </form>`;
  openModal('Норма сна', body, modal => {
    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
    modal.querySelector('#sleepTargetForm').addEventListener('submit', ev => {
      ev.preventDefault();
      const v = clamp(Number(new FormData(ev.target).get('targetHours')) || 8, 4, 12);
      mutate(() => { state.sleep.profile.targetHours = v; });
      closeModal();
    });
  });
}
