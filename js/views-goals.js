/* =========================================================================
   views-goals.js — долгосрочные цели: числовые, простые и с этапами
   ========================================================================= */

/* Прогресс числовой цели: либо то, что докидывали руками, либо баланс
   привязанного счёта. Именно баланс, а не сумма пополнений: цифра в цели
   должна равняться тому, что реально лежит на счету, иначе это счётчик
   заработанного, а не накопленного. Отсюда и откат назад при снятии — он
   честный. startBalance — снимок баланса в момент привязки: деньги, которые
   лежали на счету до цели, прогрессом не считаются. */
function goalCurrent(g) {
  if (g.kind !== 'numeric') return g.current || 0;
  if (!g.accountId) return g.current || 0;
  const acc = financeAccount(g.accountId);
  if (!acc) return g.current || 0;   // счёт удалили — показываем последнее ручное значение
  return Math.max(0, (acc.balance || 0) - (g.startBalance || 0));
}

function goalPct(g) {
  if (g.done) return 100;
  if (g.kind === 'numeric') return clamp(Math.round((goalCurrent(g) / (g.target || 1)) * 100), 0, 100);
  if (g.kind === 'steps') {
    const total = (g.milestones || []).length || 1;
    const done = (g.milestones || []).filter(m => m.done).length;
    return clamp(Math.round((done / total) * 100), 0, 100);
  }
  return 0;
}

function daysLeft(g) {
  if (!g.deadline) return null;
  return daysBetween(todayStr(), g.deadline);
}

/* Темп: сколько осталось добрать и по сколько в месяц это выходит до дедлайна.
   Процент прогресса говорит, где ты сейчас; темп — успеваешь ли ты вообще.
   Разница между «собрано 20%» и «нужно по 850 тысяч в месяц» — это разница
   между отчётом и решением. */
function goalPaceHtml(g) {
  if (g.done || g.kind !== 'numeric') return '';
  const left = (g.target || 0) - goalCurrent(g);
  if (left <= 0) return '';
  const dl = daysLeft(g);
  const unit = esc(g.unit || '');
  if (dl === null) return `<div class="goal-pace">осталось ${fmtNum(left)} ${unit}</div>`;
  if (dl < 0) return `<div class="goal-pace red-text">срок прошёл, не добрано ${fmtNum(left)} ${unit}</div>`;
  const days = Math.max(1, dl);
  const perDay = left / days;
  const perMonth = perDay * 30;
  // на коротком сроке «в месяц» — бессмыслица, там считаем по дням
  const main = days >= 45
    ? `${fmtNum(perMonth)} ${unit}/мес`
    : `${fmtNum(perDay)} ${unit}/день`;
  return `<div class="goal-pace">осталось ${fmtNum(left)} ${unit} · нужно ${main}</div>`;
}

function renderGoals() {
  const active = state.goals.filter(g => !g.done).sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  const done = state.goals.filter(g => g.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Цели</h1>
        <p class="page-sub">Большие задачи на месяцы. Числовые копят прогресс, пошаговые закрываются этапами.</p>
      </div>
      <div class="head-actions"><button class="btn primary" id="addGoal">${icon('plus',15)} Новая цель</button></div>
    </div>

    <div class="grid cols-3">
      <div class="card kpi"><div class="kpi-label">В работе</div><div class="big-number">${active.length}</div></div>
      <div class="card kpi"><div class="kpi-label">Достигнуто</div><div class="big-number green">${done.length}</div></div>
      <div class="card kpi"><div class="kpi-label">Средний прогресс</div><div class="big-number">${active.length ? Math.round(active.reduce((s, g) => s + goalPct(g), 0) / active.length) : 0}%</div></div>
    </div>

    <div class="section-label">Активные</div>
    <div class="goal-grid" id="goalsActive"></div>

    <div class="section-label">Достигнутые</div>
    <div class="goal-grid" id="goalsDone"></div>`;

  document.getElementById('addGoal').addEventListener('click', () => openGoalForm());

  document.getElementById('goalsActive').innerHTML = active.length
    ? active.map(goalCardHtml).join('')
    : `<div class="empty-hint">Активных целей нет. Например: «накопить 500 000 ₸», «прочитать 12 книг», «пробежать первый полумарафон».</div>`;

  document.getElementById('goalsDone').innerHTML = done.length
    ? done.map(goalCardHtml).join('')
    : `<div class="empty-hint">Пока ничего не завершено</div>`;

  bindGoalHandlers();
}

function goalCardHtml(g) {
  const pct = goalPct(g);
  const dl = daysLeft(g);
  const overdue = dl !== null && dl < 0 && !g.done;
  return `<div class="card goal-card ${g.done ? 'is-done' : ''} ${overdue ? 'overdue' : ''}">
    <div class="goal-head">
      <div class="goal-title">${icon(g.done ? 'flag' : 'target', 15)} ${esc(g.title)}</div>
      <div class="goal-actions">
        <button class="btn ghost small icon-only" data-goal-edit="${g.id}" title="Изменить">${icon('edit',14)}</button>
        <button class="btn ghost small icon-only danger-text" data-goal-del="${g.id}" title="Удалить">${icon('x',13)}</button>
      </div>
    </div>
    ${g.note ? `<p class="goal-note">${esc(g.note)}</p>` : ''}

    <div class="goal-progress">
      ${barHtml(pct, 'green', true)}
      <div class="goal-pct">${pct}%</div>
    </div>

    <div class="task-meta mt8">
      ${g.moneyReward ? `<span class="chip green">+${fmtMoney(g.moneyReward)}</span>` : ''}
      ${g.deadline ? `<span class="chip ${overdue ? 'red' : ''}">${icon(overdue ? 'alert' : 'calendar', 12)} ${overdue ? 'просрочено ' : ''}${fmtDateHuman(g.deadline)}${dl !== null && dl >= 0 ? ` · ${dl} ${plural(dl, 'день', 'дня', 'дней')}` : ''}</span>` : ''}
    </div>

    ${g.kind === 'numeric' ? `
      <div class="goal-numeric">
        <div class="text-dim" style="font-size:13px;">${fmtNum(goalCurrent(g))} / ${fmtNum(g.target)} ${esc(g.unit || '')}</div>
        ${goalPaceHtml(g)}
        ${goalLinkHtml(g)}
        ${!g.done && !g.accountId ? `<div class="goal-add-row">
          <input type="number" step="any" data-goal-input="${g.id}" placeholder="сколько добавить">
          <button class="btn small" data-goal-add="${g.id}">${icon('plus',13)}</button>
        </div>` : ''}
      </div>` : ''}

    ${g.kind === 'steps' ? `
      <div class="checklist mt8">
        ${(g.milestones || []).map(m =>
          `<label class="cl-item"><input type="checkbox" ${m.done ? 'checked' : ''} ${g.done ? 'disabled' : ''} data-goal-ms="${g.id}:${m.id}"><span>${esc(m.text)}</span></label>`).join('')
          || '<div class="text-dim" style="font-size:12.5px;">Этапы не заданы</div>'}
      </div>` : ''}

    ${g.kind === 'boolean' && !g.done ? `<button class="btn success small mt8" data-goal-finish="${g.id}">Отметить достигнутой</button>` : ''}
    ${g.done ? `<div class="chip green mt8">Достигнута ${fmtDateHuman(dateStr(new Date(g.doneAt)))}</div>` : ''}
  </div>`;
}

/* Подпись под привязанной целью: без неё непонятно, почему поле ручного
   ввода пропало и откуда берётся цифра. */
function goalLinkHtml(g) {
  if (g.kind !== 'numeric' || !g.accountId) return '';
  const acc = financeAccount(g.accountId);
  if (!acc) return `<div class="goal-pace red-text">счёт удалён — цель отвязана, цифра больше не обновляется</div>`;
  const start = g.startBalance || 0;
  return `<div class="goal-pace">${icon('bank',12)} считается по счёту «${esc(acc.name)}»${start ? ` · старт ${fmtMoney(start)} не в счёт` : ''}</div>`;
}

function bindGoalHandlers() {
  const root = content();
  root.querySelectorAll('[data-goal-add]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.goalAdd;
    const input = root.querySelector(`[data-goal-input="${id}"]`);
    const val = Number(input.value);
    if (!val) return;
    input.value = '';
    addGoalProgress(id, val);
  }));
  root.querySelectorAll('[data-goal-input]').forEach(inp => inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      root.querySelector(`[data-goal-add="${inp.dataset.goalInput}"]`).click();
    }
  }));
  root.querySelectorAll('[data-goal-ms]').forEach(cb => cb.addEventListener('change', () => {
    const [gid, mid] = cb.dataset.goalMs.split(':');
    toggleMilestone(gid, mid);
  }));
  root.querySelectorAll('[data-goal-finish]').forEach(b => b.addEventListener('click', () => finishGoal(b.dataset.goalFinish)));
  root.querySelectorAll('[data-goal-edit]').forEach(b => b.addEventListener('click', () => openGoalForm(b.dataset.goalEdit)));
  root.querySelectorAll('[data-goal-del]').forEach(b => b.addEventListener('click', () => {
    const g = state.goals.find(x => x.id === b.dataset.goalDel);
    if (!g) return;
    confirmAction(`Удалить цель «${g.title}»?`, () => {
      mutate(() => { state.goals = state.goals.filter(x => x.id !== b.dataset.goalDel); markDeleted(b.dataset.goalDel); });
    });
  }));
}

function completeGoal(g) {
  if (g.done) return;
  g.done = true;
  g.doneAt = nowISO();
  if (g.moneyReward) addTransaction(g.moneyReward, 'income', 'Цель', g.title, todayStr(), true);
  addLog('🏁', `Цель достигнута: ${g.title}`);
  toast(`Цель достигнута: ${g.title}!`, 'gold');
  confetti(110);
  SFX.achieve();
}

/* Вызывается из mutate() после любого изменения состояния. Внутрь mutate()
   не заворачиваем — мы уже внутри него, иначе получилась бы рекурсия. */
function checkLinkedGoals() {
  if (!state.goals) return;
  state.goals.forEach(g => {
    if (g.done || g.kind !== 'numeric' || !g.accountId) return;
    if (goalCurrent(g) >= (g.target || 0)) completeGoal(g);
  });
}

function addGoalProgress(id, amount) {
  mutate(() => {
    const g = state.goals.find(x => x.id === id);
    if (!g || g.done) return;
    g.current = Math.max(0, (g.current || 0) + amount);
    g.progressLog = g.progressLog || [];
    g.progressLog.push({ date: todayStr(), amount });
    if (g.progressLog.length > 200) g.progressLog = g.progressLog.slice(-200);
    if (g.current >= g.target) completeGoal(g);
  });
}
function toggleMilestone(gid, mid) {
  mutate(() => {
    const g = state.goals.find(x => x.id === gid);
    if (!g || g.done) return;
    const m = (g.milestones || []).find(x => x.id === mid);
    if (!m) return;
    m.done = !m.done;
    if ((g.milestones || []).length && g.milestones.every(x => x.done)) completeGoal(g);
  });
}
function finishGoal(id) {
  mutate(() => {
    const g = state.goals.find(x => x.id === id);
    if (g) completeGoal(g);
  });
}

/* ---- Форма цели --------------------------------------------------------- */
function openGoalForm(id) {
  const existing = id ? state.goals.find(x => x.id === id) : null;
  const g = existing || {};
  const body = `
    <form id="goalForm" class="form-grid">
      <label class="field" style="grid-column: 1/-1;">Название
        <input type="text" name="title" value="${esc(g.title || '')}" placeholder="Например: накопить 500 000 ₸" required autofocus>
      </label>
      <label class="field" style="grid-column: 1/-1;">Зачем эта цель (необязательно)
        <textarea name="note" rows="2" placeholder="Что изменится, когда я её достигну">${esc(g.note || '')}</textarea>
      </label>
      <label class="field">Тип
        <select name="kind" id="goalKind">
          <option value="numeric" ${g.kind === 'numeric' ? 'selected' : ''}>Числовая — копить прогресс</option>
          <option value="steps"   ${g.kind === 'steps' ? 'selected' : ''}>Пошаговая — список этапов</option>
          <option value="boolean" ${g.kind === 'boolean' ? 'selected' : ''}>Простая — сделано или нет</option>
        </select>
      </label>
      <label class="field goal-num">Цель (число)
        <input type="number" step="any" name="target" value="${g.target ?? 100}" min="0.01">
      </label>
      <label class="field goal-num">Единица измерения
        <input type="text" name="unit" value="${esc(g.unit || '')}" placeholder="₸, км, книг">
      </label>
      <label class="field goal-num" style="grid-column: 1/-1;">Откуда брать прогресс
        <select name="accountId">
          <option value="">Считаю сам — добавляю вручную</option>
          ${state.finance.accounts.map(a => `<option value="${a.id}" ${g.accountId === a.id ? 'selected' : ''}>По счёту «${esc(a.name)}» — ${fmtMoney(a.balance || 0)}</option>`).join('')}
        </select>
      </label>
      <p class="text-dim goal-num" style="grid-column:1/-1;font-size:12.5px;margin:-4px 0 0;">
        Привязка к счёту: прогрессом считается прирост баланса с этого момента.
        То, что уже лежит на счету, не засчитывается, а снятие откатывает цель назад.
      </p>
      <label class="field goal-steps" style="grid-column: 1/-1;">Этапы — по одному на строку
        <textarea name="milestones" rows="3" placeholder="Собрать документы&#10;Пройти собеседование">${esc((g.milestones || []).map(m => m.text).join('\n'))}</textarea>
      </label>
      <label class="field">Награда деньгами (необязательно)
        <input type="number" name="moneyReward" value="${g.moneyReward ?? ''}" min="0" placeholder="0">
      </label>
      <label class="field">Дедлайн
        <input type="date" name="deadline" value="${esc(g.deadline || '')}">
      </label>
      <div class="form-actions" style="grid-column: 1/-1;">
        <button type="button" class="btn ghost" data-cancel>Отмена</button>
        <button type="submit" class="btn primary">${existing ? `${icon('save',15)} Сохранить` : `${icon('plus',15)} Создать цель`}</button>
      </div>
    </form>`;

  openModal(existing ? 'Изменить цель' : 'Новая цель', body, modal => {
    const kindSel = modal.querySelector('#goalKind');
    const sync = () => {
      modal.querySelectorAll('.goal-num').forEach(el => el.style.display = kindSel.value === 'numeric' ? '' : 'none');
      modal.querySelectorAll('.goal-steps').forEach(el => el.style.display = kindSel.value === 'steps' ? '' : 'none');
    };
    kindSel.addEventListener('change', sync);
    sync();

    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
    modal.querySelector('#goalForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const title = String(f.get('title') || '').trim();
      if (!title) return;
      const kind = f.get('kind');
      const oldMs = g.milestones || [];
      const milestones = String(f.get('milestones') || '').split('\n').map(s => s.trim()).filter(Boolean)
        .map(text => {
          const prev = oldMs.find(m => m.text === text);
          return { id: prev ? prev.id : uid(), text, done: prev ? prev.done : false };
        });

      const data = {
        title, kind,
        note: String(f.get('note') || '').trim(),
        target: kind === 'numeric' ? (Number(f.get('target')) || 1) : 1,
        unit: f.get('unit') || '',
        milestones: kind === 'steps' ? milestones : [],
        moneyReward: Number(f.get('moneyReward')) || 0,
        deadline: f.get('deadline') || null,
        accountId: kind === 'numeric' ? String(f.get('accountId') || '') : '',
      };

      mutate(() => {
        // startBalance снимаем в момент привязки, а не создания цели: иначе
        // при переключении «считаю сам» → «по счёту» весь баланс счёта разом
        // засчитался бы как прогресс
        const wasLinkedTo = existing ? (existing.accountId || '') : '';
        if (data.accountId && data.accountId !== wasLinkedTo) {
          const acc = financeAccount(data.accountId);
          data.startBalance = acc ? (acc.balance || 0) : 0;
        } else if (!data.accountId) {
          data.startBalance = 0;
        }
        if (existing) Object.assign(existing, data);
        else {
          state.goals.push({ id: uid(), ...data, current: 0, progressLog: [], done: false, doneAt: null, createdAt: nowISO() });
          addLog('🎯', `Новая цель: ${title}`);
        }
      });
      closeModal();
    });
  });
}
