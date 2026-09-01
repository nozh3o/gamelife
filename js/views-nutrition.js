/* =========================================================================
   views-nutrition.js — питание: суточная норма, дневник приёмов пищи,
   личный словарь блюд, поиск по открытой базе и разбор по фотографии
   ========================================================================= */

const ACTIVITY_LEVELS = [
  { v: 1.2,   label: 'Сидячий образ жизни' },
  { v: 1.375, label: 'Лёгкая активность (1–3 тренировки в неделю)' },
  { v: 1.55,  label: 'Средняя активность (3–5 тренировок)' },
  { v: 1.725, label: 'Высокая активность (6–7 тренировок)' },
  { v: 1.9,   label: 'Очень высокая (физическая работа, спорт дважды в день)' },
];
const GOALS = [
  { id: 'cut',      label: 'Похудение',    factor: 0.85 },
  { id: 'maintain', label: 'Поддержание',  factor: 1.0 },
  { id: 'bulk',     label: 'Набор массы',  factor: 1.1 },
];

let nutritionDate = null;   // какой день показываем; null = сегодня

function nutDate() { return nutritionDate || todayStr(); }

/* ---- Расчёт нормы: формула Миффлина — Сан Жеора ------------------------- */
function calcTargets(profile) {
  const { sex, age, height, weight, activity, goal } = profile;
  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'female' ? -161 : 5);
  const g = GOALS.find(x => x.id === goal) || GOALS[1];
  const kcal = Math.round(bmr * activity * g.factor);

  // белок по весу тела, жир — четверть калорий, остальное углеводы
  const protein = Math.round(weight * (goal === 'cut' ? 2.0 : 1.7));
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs };
}

function activeTargets() {
  const n = state.nutrition;
  return n.targets.auto ? calcTargets(n.profile) : n.targets;
}

/* ---- Суммы за день ------------------------------------------------------ */
function dayEntries(date = nutDate()) {
  return state.nutrition.entries.filter(e => e.date === date);
}
function dayTotals(date = nutDate()) {
  return dayEntries(date).reduce((t, e) => ({
    kcal: t.kcal + (e.kcal || 0),
    protein: t.protein + (e.protein || 0),
    fat: t.fat + (e.fat || 0),
    carbs: t.carbs + (e.carbs || 0),
  }), { kcal: 0, protein: 0, fat: 0, carbs: 0 });
}

/* Попадание в норму по калориям с допуском ±10% */
function hitTargetToday() {
  const t = activeTargets();
  const d = dayTotals(todayStr());
  if (!d.kcal) return false;
  return Math.abs(d.kcal - t.kcal) <= t.kcal * 0.1;
}

function nutritionStreak() {
  const byDate = {};
  state.nutrition.entries.forEach(e => { byDate[e.date] = true; });
  let streak = 0;
  const cursor = new Date();
  if (!byDate[dateStr(cursor)]) cursor.setDate(cursor.getDate() - 1);
  let guard = 0;
  while (byDate[dateStr(cursor)] && guard++ < 3650) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* ---- Экран -------------------------------------------------------------- */
function renderNutrition() {
  const t = activeTargets();
  const d = dayTotals();
  const entries = dayEntries().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const isToday = nutDate() === todayStr();
  const left = Math.max(0, t.kcal - d.kcal);

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Питание</h1>
        <p class="page-sub">Норма считается по формуле Миффлина — Сан Жеора из твоих параметров. Уложился в неё за день — получаешь опыт и качаешь «Здоровье».</p>
      </div>
      <div class="head-actions">
        <input type="date" id="nutDate" class="inline-date" value="${nutDate()}" max="${todayStr()}">
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        ${isToday ? 'Сегодня' : fmtDateHuman(nutDate())}
        <small>${d.kcal ? `осталось ${fmtNum(left)} ккал` : 'записей пока нет'}</small>
      </div>
      <div class="macro-grid">
        ${macroBlockHtml('Калории', d.kcal, t.kcal, 'ккал', 'kcal')}
        ${macroBlockHtml('Белки', d.protein, t.protein, 'г', 'protein')}
        ${macroBlockHtml('Жиры', d.fat, t.fat, 'г', 'fat')}
        ${macroBlockHtml('Углеводы', d.carbs, t.carbs, 'г', 'carbs')}
      </div>
    </div>

    <div class="add-row">
      <button class="btn primary" data-add-food="photo">📷 По фото</button>
      <button class="btn" data-add-food="barcode">📦 Штрихкод</button>
      <button class="btn" data-add-food="search">🔍 Найти по названию</button>
      <button class="btn" data-add-food="dict">📖 Мои блюда</button>
      <button class="btn" data-add-food="manual">✏️ Вручную</button>
    </div>

    <div class="section-label">Приёмы пищи <span class="chip">${entries.length}</span></div>
    <div class="list" id="mealList"></div>

    <div class="section-label">Профиль и норма</div>
    <div class="card" id="nutProfileCard"></div>`;

  document.getElementById('nutDate').addEventListener('change', e => {
    nutritionDate = e.target.value || todayStr();
    renderNutrition();
  });
  content().querySelectorAll('[data-add-food]').forEach(b =>
    b.addEventListener('click', () => openFoodAdd(b.dataset.addFood)));

  renderMealList(entries);
  renderNutProfile();
}

function macroBlockHtml(label, value, target, unit, kind) {
  const pct = target ? clamp(Math.round((value / target) * 100), 0, 100) : 0;
  const over = target && value > target * 1.1;
  return `<div class="macro-block ${over ? 'over' : ''}">
    <div class="macro-top"><span>${label}</span><b>${fmtNum(value)}<span class="macro-target"> / ${fmtNum(target)} ${unit}</span></b></div>
    ${barHtml(pct, kind === 'kcal' ? 'gold' : 'green')}
    <div class="macro-pct">${target ? Math.round((value / target) * 100) : 0}%${over ? ' · перебор' : ''}</div>
  </div>`;
}

function renderMealList(entries) {
  const wrap = document.getElementById('mealList');
  wrap.innerHTML = entries.length ? entries.map(e => `
    <div class="row-item">
      <span class="ic">${e.source === 'photo' ? '📷' : e.source === 'search' ? '🔍' : e.source === 'dict' ? '📖' : '🍽️'}</span>
      <div class="main">
        <div class="title">${esc(e.title)} <span class="text-dim">· ${fmtNum(e.grams)} г</span></div>
        <div class="meta">
          <span class="chip gold">${fmtNum(e.kcal)} ккал</span>
          <span class="chip">Б ${e.protein}</span>
          <span class="chip">Ж ${e.fat}</span>
          <span class="chip">У ${e.carbs}</span>
          ${e.time ? `<span class="chip">${esc(e.time)}</span>` : ''}
          ${e.approx ? `<span class="chip red">оценка</span>` : ''}
        </div>
      </div>
      <div class="actions">
        <button class="btn ghost small icon-only" data-meal-edit="${e.id}" title="Изменить">✎</button>
        <button class="btn ghost small icon-only danger-text" data-meal-del="${e.id}" title="Удалить">✕</button>
      </div>
    </div>`).join('')
    : `<div class="empty-hint">За этот день ничего не записано</div>`;

  wrap.querySelectorAll('[data-meal-edit]').forEach(b =>
    b.addEventListener('click', () => {
      const e = state.nutrition.entries.find(x => x.id === b.dataset.mealEdit);
      if (e) openMealForm(e, null);
    }));
  wrap.querySelectorAll('[data-meal-del]').forEach(b =>
    b.addEventListener('click', () => {
      const e = state.nutrition.entries.find(x => x.id === b.dataset.mealDel);
      confirmAction(`Удалить «${e ? e.title : ''}» из дневника?`, () => mutate(() => {
        state.nutrition.entries = state.nutrition.entries.filter(x => x.id !== b.dataset.mealDel);
      }));
    }));
}

/* ---- Профиль ------------------------------------------------------------- */
function renderNutProfile() {
  const p = state.nutrition.profile;
  const auto = state.nutrition.targets.auto;
  const t = activeTargets();

  document.getElementById('nutProfileCard').innerHTML = `
    <form id="nutProfileForm" class="form-grid">
      <label class="field">Пол
        <select name="sex">
          <option value="male" ${p.sex === 'male' ? 'selected' : ''}>Мужской</option>
          <option value="female" ${p.sex === 'female' ? 'selected' : ''}>Женский</option>
        </select>
      </label>
      <label class="field">Возраст
        <input type="number" name="age" value="${p.age}" min="10" max="100" required>
      </label>
      <label class="field">Рост, см
        <input type="number" name="height" value="${p.height}" min="100" max="250" required>
      </label>
      <label class="field">Вес, кг
        <input type="number" name="weight" step="0.1" value="${p.weight}" min="30" max="300" required>
      </label>
      <label class="field" style="grid-column:1/-1;">Активность
        <select name="activity">
          ${ACTIVITY_LEVELS.map(a => `<option value="${a.v}" ${Number(p.activity) === a.v ? 'selected' : ''}>${a.label}</option>`).join('')}
        </select>
      </label>
      <label class="field" style="grid-column:1/-1;">Цель
        <select name="goal">
          ${GOALS.map(g => `<option value="${g.id}" ${p.goal === g.id ? 'selected' : ''}>${g.label}</option>`).join('')}
        </select>
      </label>
      <div class="field" style="grid-column:1/-1;">
        <label class="switch"><input type="checkbox" name="auto" ${auto ? 'checked' : ''}>
          <span>Считать норму автоматически</span></label>
      </div>
      <label class="field manual-target">Калории
        <input type="number" name="kcal" value="${t.kcal}" min="500" ${auto ? 'disabled' : ''}>
      </label>
      <label class="field manual-target">Белки, г
        <input type="number" name="protein" value="${t.protein}" min="0" ${auto ? 'disabled' : ''}>
      </label>
      <label class="field manual-target">Жиры, г
        <input type="number" name="fat" value="${t.fat}" min="0" ${auto ? 'disabled' : ''}>
      </label>
      <label class="field manual-target">Углеводы, г
        <input type="number" name="carbs" value="${t.carbs}" min="0" ${auto ? 'disabled' : ''}>
      </label>
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="submit" class="btn primary">💾 Сохранить</button>
      </div>
    </form>
    <p class="text-dim" style="font-size:12.5px;line-height:1.5;margin:12px 0 0;">
      Текущая норма: <b>${fmtNum(t.kcal)} ккал</b> · Б ${t.protein} · Ж ${t.fat} · У ${t.carbs}.
      Это ориентир по формуле, а не медицинское предписание — при заболеваниях или особых состояниях
      норму стоит согласовать с врачом.
    </p>`;

  const form = document.getElementById('nutProfileForm');
  const autoBox = form.querySelector('[name=auto]');
  autoBox.addEventListener('change', () => {
    form.querySelectorAll('.manual-target input').forEach(i => i.disabled = autoBox.checked);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(form);
    mutate(() => {
      state.nutrition.profile = {
        sex: f.get('sex'),
        age: Number(f.get('age')) || 30,
        height: Number(f.get('height')) || 175,
        weight: Number(f.get('weight')) || 70,
        activity: Number(f.get('activity')) || 1.375,
        goal: f.get('goal'),
      };
      const isAuto = !!f.get('auto');
      state.nutrition.targets = isAuto
        ? { auto: true, ...calcTargets(state.nutrition.profile) }
        : {
            auto: false,
            kcal: Number(f.get('kcal')) || 2000,
            protein: Number(f.get('protein')) || 120,
            fat: Number(f.get('fat')) || 65,
            carbs: Number(f.get('carbs')) || 220,
          };
    });
    toast('Норма обновлена', 'green');
  });
}

/* ---- Добавление еды: выбор способа --------------------------------------- */
function openFoodAdd(kind) {
  if (kind === 'manual') return openMealForm(null, null);
  if (kind === 'dict') return openDictPicker();
  if (kind === 'search') return openFoodSearch();
  if (kind === 'barcode') return openBarcodeScanner();
  if (kind === 'photo') return openPhotoAnalyzer();
}

/* ---- Ручной ввод и правка ------------------------------------------------- */
function openMealForm(existing, prefill) {
  const e = existing || prefill || {};
  const isEdit = !!existing;
  const per100 = e.per100 || null;

  openModal(isEdit ? 'Изменить приём пищи' : 'Добавить в дневник', `
    ${e.approx ? `<div class="warn-box" style="margin-top:0;">Это оценка по фотографии. Проверь вес порции — он влияет на цифры сильнее всего.</div>` : ''}
    <form id="mealForm" class="form-grid">
      <label class="field" style="grid-column:1/-1;">Название
        <input type="text" name="title" value="${esc(e.title || '')}" placeholder="Например: гречка с курицей" required autofocus>
      </label>
      <label class="field">Вес порции, г
        <input type="number" name="grams" step="1" min="1" value="${e.grams || 100}" required>
      </label>
      <label class="field">Время
        <input type="time" name="time" value="${esc(e.time || new Date().toTimeString().slice(0, 5))}">
      </label>
      <label class="field">Калории
        <input type="number" name="kcal" step="1" min="0" value="${Math.round(e.kcal || 0)}" required>
      </label>
      <label class="field">Белки, г
        <input type="number" name="protein" step="0.1" min="0" value="${e.protein || 0}">
      </label>
      <label class="field">Жиры, г
        <input type="number" name="fat" step="0.1" min="0" value="${e.fat || 0}">
      </label>
      <label class="field">Углеводы, г
        <input type="number" name="carbs" step="0.1" min="0" value="${e.carbs || 0}">
      </label>
      ${!isEdit ? `<div class="field" style="grid-column:1/-1;">
        <label class="switch"><input type="checkbox" name="toDict" ${per100 ? 'checked' : ''}>
          <span>Запомнить в «Мои блюда» для быстрого повтора</span></label>
      </div>` : ''}
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="button" class="btn ghost" data-cancel>Отмена</button>
        <button type="submit" class="btn primary">${isEdit ? '💾 Сохранить' : '➕ Добавить'}</button>
      </div>
    </form>`, modal => {
    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);

    // при смене веса пересчитываем КБЖУ, если известны значения на 100 г
    const gramsInput = modal.querySelector('[name=grams]');
    if (per100) {
      gramsInput.addEventListener('input', () => {
        const g = Number(gramsInput.value) || 0;
        modal.querySelector('[name=kcal]').value = Math.round(per100.kcal * g / 100);
        modal.querySelector('[name=protein]').value = +(per100.protein * g / 100).toFixed(1);
        modal.querySelector('[name=fat]').value = +(per100.fat * g / 100).toFixed(1);
        modal.querySelector('[name=carbs]').value = +(per100.carbs * g / 100).toFixed(1);
      });
    }

    modal.querySelector('#mealForm').addEventListener('submit', ev => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      const grams = Number(f.get('grams')) || 100;
      const data = {
        title: String(f.get('title') || '').trim() || 'Приём пищи',
        grams,
        time: f.get('time') || '',
        kcal: Number(f.get('kcal')) || 0,
        protein: Number(f.get('protein')) || 0,
        fat: Number(f.get('fat')) || 0,
        carbs: Number(f.get('carbs')) || 0,
      };
      if (!data.kcal) { toast('Укажи калории', 'red'); return; }

      mutate(() => {
        if (isEdit) {
          Object.assign(existing, data);
        } else {
          addMealEntry({ ...data, source: e.source || 'manual', approx: !!e.approx });
          if (f.get('toDict')) {
            rememberDish(data.title, {
              kcal: data.kcal * 100 / grams,
              protein: data.protein * 100 / grams,
              fat: data.fat * 100 / grams,
              carbs: data.carbs * 100 / grams,
            });
          }
        }
      });
      closeModal();
    });
  });
}

/* Записываем приём пищи и начисляем игровые награды */
function addMealEntry(data) {
  const date = nutDate();
  const first = dayEntries(date).length === 0;
  state.nutrition.entries.push({ id: uid(), date, ...data });

  if (date === todayStr()) {
    if (first) {
      grantXp(8, 'health');
      recordActivity(8, 1);
      addLog('🍽️', `Начат дневник питания на ${fmtDateHuman(date)}`);
    }
    // бонус за попадание в норму — начисляем один раз за день
    if (hitTargetToday() && !state.nutrition.entries.some(e => e.date === date && e.bonusGiven)) {
      const last = state.nutrition.entries[state.nutrition.entries.length - 1];
      last.bonusGiven = true;
      grantXp(30, 'health');
      grantGold(15);
      recordActivity(30, 0);
      addLog('🎯', 'Дневная норма калорий выполнена (+30 XP)');
      toast('🎯 Уложился в норму — +30 XP', 'gold');
      confetti(50);
    }
  }
}

function rememberDish(title, per100) {
  const existing = state.nutrition.dictionary.find(d => d.title.toLowerCase() === title.toLowerCase());
  if (existing) {
    existing.per100 = per100;
    existing.timesUsed = (existing.timesUsed || 0) + 1;
  } else {
    state.nutrition.dictionary.push({ id: uid(), title, per100, timesUsed: 1 });
  }
}

/* ---- Словарь блюд --------------------------------------------------------- */
function openDictPicker() {
  const dict = [...state.nutrition.dictionary].sort((a, b) => (b.timesUsed || 0) - (a.timesUsed || 0));
  openModal('Мои блюда', dict.length ? `
    <input type="search" id="dictSearch" class="search-input wfull" placeholder="🔎 Фильтр по названию…" style="max-width:none;margin-bottom:12px;">
    <div class="list" id="dictList">
      ${dict.map(d => `<div class="row-item dict-row" data-dict="${d.id}">
        <span class="ic">📖</span>
        <div class="main">
          <div class="title">${esc(d.title)}</div>
          <div class="meta"><span class="chip gold">${Math.round(d.per100.kcal)} ккал/100 г</span>
            <span class="chip">Б ${d.per100.protein.toFixed(1)}</span>
            <span class="chip">Ж ${d.per100.fat.toFixed(1)}</span>
            <span class="chip">У ${d.per100.carbs.toFixed(1)}</span></div>
        </div>
        <div class="actions"><button class="btn ghost small icon-only danger-text" data-dict-del="${d.id}" title="Убрать">✕</button></div>
      </div>`).join('')}
    </div>`
    : `<div class="empty-hint">Словарь пуст. Добавь блюдо вручную или из поиска и поставь галочку «Запомнить» — потом оно будет добавляться в один тап.</div>`,
  modal => {
    const search = modal.querySelector('#dictSearch');
    if (search) search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      modal.querySelectorAll('.dict-row').forEach(row => {
        row.style.display = row.querySelector('.title').textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    modal.querySelectorAll('[data-dict]').forEach(row => row.addEventListener('click', ev => {
      if (ev.target.closest('[data-dict-del]')) return;
      const d = state.nutrition.dictionary.find(x => x.id === row.dataset.dict);
      if (!d) return;
      closeModal();
      openMealForm(null, {
        title: d.title, grams: 100, per100: d.per100, source: 'dict',
        kcal: Math.round(d.per100.kcal), protein: +d.per100.protein.toFixed(1),
        fat: +d.per100.fat.toFixed(1), carbs: +d.per100.carbs.toFixed(1),
      });
    }));

    modal.querySelectorAll('[data-dict-del]').forEach(b => b.addEventListener('click', () => {
      mutate(() => {
        state.nutrition.dictionary = state.nutrition.dictionary.filter(x => x.id !== b.dataset.dictDel);
      });
      closeModal();
    }));
  });
}

/* ---- Автоопределение КБЖУ по названию --------------------------------------
   Встроенный справочник (js/food-db.js) отвечает мгновенно и офлайн — это
   основной источник. Личные «Мои блюда» подмешиваются туда же. Открытая база
   Open Food Facts подключается в фоне как дополнение для магазинных марок —
   без неё поиск всё равно работает. */
function openFoodSearch() {
  openModal('Найти по названию', `
    <p class="text-dim" style="font-size:12.5px;line-height:1.5;margin:0 0 12px;">
      Начни печатать — КБЖУ подставится сам из встроенного справочника обычных блюд.
      Для магазинных марок надёжнее штрихкод — там цифры прямо с этикетки.
    </p>
    <input type="search" id="liveSearchInput" class="search-input wfull" style="max-width:none;"
           placeholder="Например: гречка, курица, банан…" autofocus>
    <div id="liveSearchResults" style="margin-top:12px;"></div>`, modal => {
    const input = modal.querySelector('#liveSearchInput');
    const out = modal.querySelector('#liveSearchResults');
    let remoteTimer = null;
    let requestSeq = 0;

    const pick = (p, source) => {
      closeModal();
      openMealForm(null, {
        title: p.title, grams: 100, per100: p.per100, source,
        kcal: Math.round(p.per100.kcal), protein: +p.per100.protein.toFixed(1),
        fat: +p.per100.fat.toFixed(1), carbs: +p.per100.carbs.toFixed(1),
      });
    };

    const groupHtml = (heading, items, source, offset) => !items.length ? '' : `
      <div class="section-label" style="margin:14px 0 8px;">${esc(heading)}</div>
      <div class="list">${items.map((p, i) => `
        <div class="row-item dict-row" data-pick="${source}:${offset + i}">
          <span class="ic">${source === 'dict' ? '📖' : source === 'search' ? '🌐' : '📚'}</span>
          <div class="main">
            <div class="title">${esc(p.title)}</div>
            <div class="meta"><span class="chip gold">${Math.round(p.per100.kcal)} ккал/100 г</span>
              <span class="chip">Б ${p.per100.protein.toFixed(1)}</span>
              <span class="chip">Ж ${p.per100.fat.toFixed(1)}</span>
              <span class="chip">У ${p.per100.carbs.toFixed(1)}</span></div>
          </div>
        </div>`).join('')}</div>`;

    let localResults = [], dictResults = [], remoteResults = [];
    const bindPicks = () => {
      modal.querySelectorAll('[data-pick]').forEach(row => row.addEventListener('click', () => {
        const [source, idxStr] = row.dataset.pick.split(':');
        const idx = Number(idxStr);
        const p = source === 'dict' ? dictResults[idx] : source === 'search' ? remoteResults[idx] : localResults[idx];
        if (p) pick(p, source);
      }));
    };

    const renderAllGroups = () => {
      out.innerHTML = groupHtml('Мои блюда', dictResults, 'dict', 0)
        + groupHtml('Справочник блюд', localResults, 'local', 0)
        + groupHtml('Открытая база продуктов', remoteResults, 'search', 0)
        + (!dictResults.length && !localResults.length && !remoteResults.length
            ? `<div class="empty-hint">Пока ничего не найдено. Продолжай печатать, попробуй другое слово или добавь вручную.</div>` : '');
      bindPicks();
    };

    input.addEventListener('input', () => {
      const q = input.value.trim();
      requestSeq++;
      const mySeq = requestSeq;
      clearTimeout(remoteTimer);

      if (q.length < 2) {
        localResults = []; dictResults = []; remoteResults = [];
        out.innerHTML = `<div class="empty-hint">Введи хотя бы 2 буквы</div>`;
        return;
      }

      // локальный поиск — мгновенно, без сети
      localResults = searchLocalFoodDb(q, 10);
      dictResults = state.nutrition.dictionary
        .filter(d => d.title.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 8)
        .map(d => ({ title: d.title, per100: d.per100 }));
      remoteResults = [];
      renderAllGroups();

      // удалённый поиск — с задержкой, чтобы не долбить сеть на каждую букву
      if (q.length >= 3 && navigator.onLine) {
        remoteTimer = setTimeout(async () => {
          try {
            const found = await searchFood(q);
            if (mySeq !== requestSeq) return; // ввод уже изменился
            remoteResults = found.slice(0, 10);
            renderAllGroups();
          } catch (e) { /* открытая база недоступна — локальных результатов достаточно */ }
        }, 450);
      }
    });

    out.innerHTML = `<div class="empty-hint">Введи хотя бы 2 буквы</div>`;
  });
}

/* Берём именно world.openfoodfacts.org: поддомен search.* не отдаёт заголовки CORS,
   и браузер режет запрос, хотя из консоли он работает. */
const OFF_BASE = 'https://world.openfoodfacts.org';
const OFF_FIELDS = 'product_name,brands,nutriments';

function offProduct(p) {
  const n = p.nutriments || {};
  const brand = (p.brands || '').split(',')[0].trim();
  const name = p.product_name || p.generic_name || 'Без названия';
  return {
    title: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} (${brand})` : name,
    per100: {
      kcal: Number(n['energy-kcal_100g']) || 0,
      protein: Number(n.proteins_100g) || 0,
      fat: Number(n.fat_100g) || 0,
      carbs: Number(n.carbohydrates_100g) || 0,
    },
  };
}

/* Поисковый бэкенд Open Food Facts периодически отвечает 503, поэтому пробуем
   несколько эндпоинтов подряд. Поиск по штрихкоду живёт отдельно и надёжнее. */
async function searchFood(query) {
  const q = encodeURIComponent(query);
  const endpoints = [
    `${OFF_BASE}/api/v2/search?product_name=${q}&fields=${OFF_FIELDS}&page_size=15`,
    `${OFF_BASE}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=15&fields=${OFF_FIELDS}`,
  ];

  let lastProblem = 'база не отвечает';
  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (!res.ok) { lastProblem = `база временно недоступна (${res.status})`; continue; }
      const data = await res.json();
      const list = (data.products || []).map(offProduct).filter(p => p.per100.kcal > 0);
      if (list.length) return list;
      lastProblem = 'ничего не нашлось';
    } catch (e) {
      lastProblem = 'база временно недоступна';
    }
  }
  throw new Error(lastProblem);
}

async function lookupBarcode(code) {
  const res = await fetch(`${OFF_BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (!res.ok) throw new Error('база недоступна');
  const data = await res.json();
  if (data.status !== 1 || !data.product) throw new Error('такого штрихкода нет в базе');
  const p = offProduct(data.product);
  if (!p.per100.kcal) throw new Error('в базе нет калорийности для этого продукта');
  return p;
}

/* ---- Сканер штрихкода ------------------------------------------------------ */
function barcodeSupported() { return 'BarcodeDetector' in window; }

function openBarcodeScanner() {
  const manualForm = `
    <form id="barcodeManual" style="display:flex;gap:8px;margin-top:14px;">
      <input type="text" name="code" inputmode="numeric" class="search-input" style="flex:1;max-width:none;"
             placeholder="Или введи цифры под штрихкодом" required>
      <button type="submit" class="btn primary">Найти</button>
    </form>
    <div id="barcodeResult" style="margin-top:12px;"></div>`;

  openModal('Штрихкод продукта', `
    <p class="text-dim" style="font-size:12.5px;line-height:1.5;margin:0 0 10px;">
      Точные цифры берутся прямо с упаковки из открытой базы Open Food Facts — это надёжнее
      оценки по фотографии. Бесплатно и без ключей.
    </p>
    ${barcodeSupported()
      ? `<button class="btn primary wfull" id="startScan">📷 Навести камеру</button>
         <video id="scanVideo" playsinline muted style="display:none;"></video>`
      : `<div class="mini-box" style="margin-top:0;">Этот браузер не умеет распознавать штрихкод камерой — введи цифры вручную.</div>`}
    ${manualForm}`, modal => {
    const out = modal.querySelector('#barcodeResult');

    const show = async (code) => {
      out.innerHTML = `<div class="empty-hint">Ищу ${esc(code)}…</div>`;
      try {
        const p = await lookupBarcode(code);
        closeModal();
        openMealForm(null, {
          title: p.title, grams: 100, per100: p.per100, source: 'search',
          kcal: Math.round(p.per100.kcal), protein: +p.per100.protein.toFixed(1),
          fat: +p.per100.fat.toFixed(1), carbs: +p.per100.carbs.toFixed(1),
        });
      } catch (e) {
        out.innerHTML = `<div class="warn-box">${esc(e.message)}</div>`;
      }
    };

    modal.querySelector('#barcodeManual').addEventListener('submit', ev => {
      ev.preventDefault();
      show(String(new FormData(ev.target).get('code') || '').trim());
    });

    const startBtn = modal.querySelector('#startScan');
    if (startBtn) startBtn.addEventListener('click', async () => {
      const video = modal.querySelector('#scanVideo');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        video.style.display = 'block';
        video.className = 'photo-preview';
        await video.play();
        startBtn.style.display = 'none';
        out.innerHTML = `<div class="empty-hint">Наведи камеру на штрихкод…</div>`;

        const detector = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
        });
        const stop = () => stream.getTracks().forEach(t => t.stop());

        const tick = async () => {
          if (!document.body.contains(video)) { stop(); return; }
          try {
            const found = await detector.detect(video);
            if (found.length) { stop(); show(found[0].rawValue); return; }
          } catch (e) { /* кадр не распознался — просто пробуем следующий */ }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } catch (e) {
        out.innerHTML = `<div class="warn-box">Камера недоступна: ${esc(e.message)}. Введи цифры вручную.</div>`;
      }
    });
  });
}

/* ---- Разбор по фотографии --------------------------------------------------- */
function foodApiConfigured() {
  return syncSignedIn() && !!syncCfg.foodFn;
}

function openPhotoAnalyzer() {
  if (!foodApiConfigured()) {
    openModal('Распознавание по фото', `
      <p style="font-size:13.5px;line-height:1.55;margin:0 0 12px;">
        Чтобы приложение считало КБЖУ по фотографии, нужно один раз развернуть функцию-посредник
        в твоём проекте Supabase: ключ от сервиса хранится там, а не в браузере.
      </p>
      <div class="mini-box">Пошаговая инструкция — в файле <b>SETUP-FOOD-AI.md</b> в папке проекта.</div>
      <p class="text-dim" style="font-size:12.5px;line-height:1.5;margin:12px 0 18px;">
        Пока это не настроено, работают «Найти продукт», «Мои блюда» и ручной ввод — они бесплатны
        и не требуют никаких ключей.
      </p>
      <div class="form-actions"><button class="btn primary" data-ok>Понятно</button></div>`, modal => {
      modal.querySelector('[data-ok]').addEventListener('click', closeModal);
    });
    return;
  }

  openModal('Фото еды', `
    <p class="text-dim" style="font-size:12.5px;line-height:1.5;margin:0 0 12px;">
      Сфотографируй тарелку целиком. Если рядом положить вилку или телефон — оценка размера порции
      будет заметно точнее.
    </p>
    <label class="btn primary wfull" style="cursor:pointer;justify-content:center;">
      📷 Сделать снимок или выбрать файл
      <input type="file" id="foodPhoto" accept="image/*" capture="environment" style="display:none;">
    </label>
    <div id="photoStage" style="margin-top:14px;"></div>`, modal => {
    modal.querySelector('#foodPhoto').addEventListener('change', async ev => {
      const file = ev.target.files[0];
      if (!file) return;
      const stage = modal.querySelector('#photoStage');
      try {
        const dataUrl = await shrinkImage(file, 1024, 0.82);
        stage.innerHTML = `<img src="${dataUrl}" class="photo-preview" alt="фото еды">
          <div class="empty-hint" style="margin-top:10px;">Распознаю блюдо…</div>`;
        const result = await analyzeFoodPhoto(dataUrl);
        closeModal();
        openMealForm(null, {
          title: result.title, grams: result.grams, source: 'photo', approx: true,
          kcal: result.kcal, protein: result.protein, fat: result.fat, carbs: result.carbs,
          time: new Date().toTimeString().slice(0, 5),
        });
        if (result.note) toast(result.note, 'gold');
      } catch (err) {
        stage.innerHTML = `<div class="warn-box">Не получилось разобрать фото: ${esc(err.message)}</div>
          <button class="btn wfull mt8" id="manualInstead">Ввести вручную</button>`;
        const b = stage.querySelector('#manualInstead');
        if (b) b.addEventListener('click', () => { closeModal(); openMealForm(null, null); });
      }
    });
  });
}

/* Уменьшаем снимок перед отправкой: меньше трафика, дешевле и быстрее разбор */
function shrinkImage(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('не удалось прочитать файл'));
    reader.onload = () => {
      img.onerror = () => reject(new Error('это не изображение'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function analyzeFoodPhoto(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const res = await fetch(syncCfg.foodFn, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: syncCfg.anonKey,
      Authorization: 'Bearer ' + syncCfg.accessToken,
    },
    body: JSON.stringify({ image: base64 }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `сервер ответил ${res.status}`);
  if (!body.kcal && !body.title) throw new Error('пустой ответ от модели');

  return {
    title: String(body.title || 'Блюдо'),
    grams: Math.max(1, Math.round(Number(body.grams) || 100)),
    kcal: Math.max(0, Math.round(Number(body.kcal) || 0)),
    protein: Math.max(0, +(Number(body.protein) || 0).toFixed(1)),
    fat: Math.max(0, +(Number(body.fat) || 0).toFixed(1)),
    carbs: Math.max(0, +(Number(body.carbs) || 0).toFixed(1)),
    note: body.note || '',
  };
}
