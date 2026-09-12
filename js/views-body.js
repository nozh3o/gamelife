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
const BODY_FIELDS_BASE = [
  { key: 'weight',    label: 'Вес',    unit: 'кг', step: '0.1', hint: 'утром, натощак, после туалета' },
  { key: 'neck',      label: 'Шея',    unit: 'см', step: '0.5', hint: 'под кадыком, лента чуть вниз' },
  { key: 'shoulders', label: 'Плечи',  unit: 'см', step: '0.5', hint: 'по самой широкой точке' },
  { key: 'chest',     label: 'Грудь',  unit: 'см', step: '0.5', hint: 'на выдохе, по соскам' },
  { key: 'biceps',    label: 'Бицепс', unit: 'см', step: '0.5', hint: 'в напряжении, по самой толстой точке' },
  { key: 'waist',     label: 'Талия',  unit: 'см', step: '0.5', hint: 'на уровне пупка, не втягивая живот' },
  { key: 'hips',      label: 'Бёдра',  unit: 'см', step: '0.5', hint: 'по самой широкой точке' },
];

/* Пол живёт в профиле питания — второго места для него заводить не стали.
   Он меняет здесь три вещи: подсказку к обхвату груди, показатель формы
   и формулу процента жира. */
function isFemale() {
  return state.nutrition.profile.sex === 'female';
}

/* Грудь мужчина и женщина меряют по-разному, а замер не по той точке
   превращает историю обхвата в шум. */
function bodyFields() {
  return BODY_FIELDS_BASE.map(f => f.key === 'chest' && isFemale()
    ? { ...f, hint: 'по самой выступающей точке, лента горизонтально' }
    : f);
}

/* Показатель формы. У мужчин это V-taper: плечи растут, талия уходит —
   число растёт. У женщин плечи почти не меняются, и осмысленное отношение
   другое — талия к бёдрам: оно падает, когда жир уходит с живота, и стоит
   на месте, когда уходит всё подряд. Разные числа, вопрос один и тот же. */
function shapeMetric() {
  return isFemale()
    ? {
        short: 'Т/Б',
        label: 'Талия ÷ бёдра',
        formula: '',
        need: 'нужны талия и бёдра',
        note: 'падает — жир уходит с живота',
        goodWhenDown: true,
        of: e => (e && e.waist && e.hips) ? e.waist / e.hips : null,
      }
    : {
        short: 'V',
        label: 'V-taper',
        formula: 'плечи ÷ талия',
        need: 'нужны плечи и талия',
        note: 'растёт — уходит жир, а не мышцы',
        goodWhenDown: false,
        of: vTaper,
      };
}

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
function lastWithShape(metric) {
  return bodyEntries().find(e => metric.of(e) != null) || null;
}

/* % жира по формуле US Navy: разница «талия минус шея» отделяет живот от каркаса —
   поэтому без шеи считать нечего, и прочерк здесь честнее выдуманного числа.
   Рост берём из профиля питания, он там уже есть для нормы КБЖУ. Женский вариант
   формулы дополнительно требует бёдра. Это оценка, а не DEXA: смотреть надо
   на направление между замерами, а не на абсолютную цифру. */
function bodyFat(e) {
  if (!e) return null;
  const h = Number(state.nutrition.profile.height);
  const waist = Number(e.waist), neck = Number(e.neck);
  if (!isFinite(h) || h <= 0 || !waist || !neck || waist <= neck) return null;

  let bf;
  if (state.nutrition.profile.sex === 'female') {
    const hips = Number(e.hips);
    if (!hips) return null;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(waist + hips - neck) + 0.22100 * Math.log10(h)) - 450;
  } else {
    bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450;
  }
  // за границами диапазона формула ломается на кривом вводе, а не описывает тело
  return isFinite(bf) && bf > 0 && bf < 70 ? bf : null;
}

/* Что именно надо померить, чтобы формула заработала: у женской версии
   в знаменателе ещё и бёдра, и молча показывать прочерк — значит не сказать,
   какой сантиметр решает дело. */
function bodyFatHint() {
  const last = bodyEntries()[0];
  const labels = { waist: 'талию', neck: 'шею', hips: 'бёдра' };
  const need = isFemale() ? ['waist', 'neck', 'hips'] : ['waist', 'neck'];
  const miss = need.filter(k => !last || numOrNull(last[k]) == null);
  if (!miss.length) return 'по последнему полному замеру';
  return `померь ${miss.map(k => labels[k]).join(' и ')} — посчитаю % жира`;
}

/* Ближайший замер, где хватает данных на % жира. */
function lastWithFat() {
  return bodyEntries().find(e => bodyFat(e) != null) || null;
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

/* Дельта одного замера к предыдущему, где это значение вообще есть: замеры
   бывают частичными, и сравнение с пустой ячейкой оставило бы дыру в истории.
   valueOf позволяет считать так же и производные числа вроде V-taper. */
function deltaToPrev(entries, index, valueOf) {
  const cur = valueOf(entries[index]);
  if (cur == null) return null;
  for (let i = index + 1; i < entries.length; i++) {
    const prev = valueOf(entries[i]);
    if (prev != null) return cur - prev;
  }
  return null;
}

function numOrNull(v) {
  return v == null || v === '' || !isFinite(Number(v)) ? null : Number(v);
}

/* digits — не косметика: V-taper меняется в третьем знаке, и порог «меньше 0.01
   считаем нулём» проглотил бы весь его рост. Порог считается от точности. */
function deltaChipHtml(delta, unit, goodWhenDown = true, digits = 1) {
  const eps = Math.pow(10, -digits) / 2;
  if (delta == null || Math.abs(delta) < eps) return '';
  const down = delta < 0;
  const good = goodWhenDown ? down : !down;
  return `<span class="chip ${good ? 'green' : 'red'}">${down ? '↓' : '↑'}${Math.abs(delta).toFixed(digits)}${unit ? ' ' + unit : ''}</span>`;
}

function renderBody() {
  const entries = bodyEntries();
  const last = entries[0];
  const lastWeight = bodyLast('weight');
  const shape = shapeMetric();
  const shapeValue = shape.of(lastWithShape(shape));
  const fat = bodyFat(lastWithFat());
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
        <p class="page-sub">Считаю по ${isFemale() ? 'женскому' : 'мужскому'} профилю, рост ${state.nutrition.profile.height} см — <a href="#" id="bodyProfile">поменять</a>.</p>
      </div>
      <div class="head-actions">
        <button class="btn ghost" id="bodyGuide">${icon('clipboard',15)} Инструкция</button>
        <button class="btn primary" id="bodyAdd">${icon('plus',15)} Записать замер</button>
      </div>
    </div>

    ${dueBannerHtml(due, since)}

    <div class="grid cols-4 mt16">
      <div class="card kpi">
        <div class="kpi-label">Вес</div>
        <div class="big-number">${lastWeight ? Number(lastWeight.weight).toFixed(1) : '—'}${lastWeight ? '<span class="unit"> кг</span>' : ''}</div>
        <div class="kpi-sub">${deltaChipHtml(bodyDelta('weight'), 'кг') || (lastWeight ? 'первый замер' : 'ещё не мерили')}</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">${shape.label}${shape.formula ? ` <small>${shape.formula}</small>` : ''}</div>
        <div class="big-number">${shapeValue ? shapeValue.toFixed(2) : '—'}</div>
        <div class="kpi-sub">${shapeValue ? shape.note : shape.need}</div>
      </div>
      <div class="card kpi">
        <div class="kpi-label">% жира <small>US Navy</small></div>
        <div class="big-number">${fat ? fat.toFixed(1) : '—'}${fat ? '<span class="unit"> %</span>' : ''}</div>
        <div class="kpi-sub">${fat ? (isFemale() ? 'по талии, бёдрам, шее и росту' : 'по талии, шее и росту') : bodyFatHint()}</div>
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
    ? entries.slice(0, 60).map((e, i) => bodyRowHtml(e, i, entries)).join('')
    : `<div class="empty-hint">Пока пусто. Первый замер — точка отсчёта: без него график весит ноль.</div>`;

  document.getElementById('bodyAdd').addEventListener('click', () => openBodyForm());
  document.getElementById('bodyGuide').addEventListener('click', () => openBodyGuide());
  document.getElementById('bodySettings').addEventListener('click', e => { e.preventDefault(); openBodySettingsForm(); });
  // пол и рост живут в профиле питания, а решают, что здесь считается: без этой
  // строчки женщина видела бы мужские метрики и не знала, где это переключить
  document.getElementById('bodyProfile').addEventListener('click', e => { e.preventDefault(); goTab('nutrition'); });
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

/* Рядом с весом, талией и V-taper стоит дельта к предыдущему замеру: столбик
   абсолютных чисел не показывает направление, а именно оно отличает сушку
   от потери всего подряд. Остальные обхваты идут без дельт — иначе строка
   превращается в таблицу и перестаёт читаться с телефона. */
function bodyRowHtml(e, index = 0, entries = [e]) {
  const shape = shapeMetric();
  const shapeValue = shape.of(e);
  const deltas = {
    weight: deltaToPrev(entries, index, x => numOrNull(x.weight)),
    waist: deltaToPrev(entries, index, x => numOrNull(x.waist)),
  };
  const parts = bodyFields()
    .filter(f => e[f.key] != null && e[f.key] !== '')
    .map(f => `<span>${f.label} ${Number(e[f.key]).toFixed(1)} ${f.unit}${
      deltas[f.key] != null ? ' ' + deltaChipHtml(deltas[f.key], '') : ''}</span>`);
  if (shapeValue) {
    const dShape = deltaToPrev(entries, index, shape.of);
    parts.push(`<span>${shape.short} ${shapeValue.toFixed(2)}${
      dShape != null ? ' ' + deltaChipHtml(dShape, '', shape.goodWhenDown, 2) : ''}</span>`);
  }
  const fat = bodyFat(e);
  if (fat) parts.push(`<span>Жир ${fat.toFixed(1)} %</span>`);
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
  // цифру быстрее, чем вводить все шесть обхватов заново
  const prev = isEdit ? null : bodyEntries()[0];

  openModal(isEdit ? 'Изменить замер' : 'Новый замер', `
    <form id="bodyForm" class="form-grid">
      <label class="field">Дата
        <input type="date" name="date" value="${esc(e.date || todayStr())}" max="${todayStr()}" required>
      </label>
      ${bodyFields().map(f => `
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
      bodyFields().forEach(fl => {
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

/* Инструкция по замерам. Открывается по кнопке, а не висит на экране: читают
   её один раз, а мешала бы каждый день. Вариант по умолчанию — по профилю,
   но переключатель есть: точки замера у мужчин и женщин совпадают не везде,
   и в паре удобно прочитать оба.

   Смысл всей страницы в том, чтобы сравнивать замер с замером. Поэтому
   инструкция про повторяемость (одно время, одна лента, одна точка) важнее,
   чем абсолютная точность: систематическая ошибка в полсантиметра уходит
   в разнице, а плавающая техника замера делает историю бессмысленной. */
function bodyGuidePoints(female) {
  return [
    ['Вес', 'Утром, сразу после туалета, до еды и воды. Без одежды, те же весы, ровный пол — на ковре весы врут. Скачок в 1–1,5 кг за день это вода и еда в кишечнике, а не жир.'],
    ['Шея', 'Лента под кадыком, по самой узкой части, спереди чуть ниже, чем сзади. Плечи расслаблены, шею не напрягать и не вытягивать. Мерить аккуратнее всего: полсантиметра здесь двигают расчётный процент жира почти на процент.'],
    ['Плечи', 'Вокруг самых широких точек дельт, руки свободно опущены, лента горизонтально. Самое неудобное место для замера в одиночку — если есть кому помочь, лучше просить.'],
    ['Грудь', female
      ? 'По самой выступающей точке груди, лента горизонтально, спина прямая. В белье или без — не важно, важно всегда одинаково: обычный бюстгальтер без пуш-апа даёт стабильную цифру, пуш-ап рисует рост, которого нет.'
      : 'На уровне сосков, лента горизонтально, руки опущены. Спокойный выдох — не надутая грудь: вдох добавляет до 5 см и превращает график в качели.'],
    ['Бицепс', 'Рука согнута в локте, мышца напряжена, лента по самой толстой точке. Всегда одна и та же рука — обычно рабочая, она заметно больше второй.'],
    ['Талия', 'На уровне пупка, стоя прямо, живот не втягивать. Спокойный выдох, лента прилегает к коже, но не режет. Это главный обхват на сушке: он падает раньше веса.'],
    ['Бёдра', 'По самой широкой точке ягодиц, ноги вместе, лента горизонтально — проверь сзади в зеркале, там она чаще всего съезжает вверх.'],
  ];
}

function openBodyGuide(sex) {
  const female = sex ? sex === 'female' : isFemale();
  const shape = female
    ? 'Талия ÷ бёдра — падает, когда жир уходит с живота. Нужны талия и бёдра.'
    : 'V-taper (плечи ÷ талия) — растёт, когда уходит жир, а не мышцы. Нужны плечи и талия.';
  const fatNeeds = female ? 'талия, бёдра, шея и рост' : 'талия, шея и рост';

  openModal('Как мерить', `
    <div class="seg-row" style="display:flex;gap:8px;margin-bottom:16px;">
      <button class="btn small ${female ? 'ghost' : 'primary'}" data-guide-sex="male">Парни</button>
      <button class="btn small ${female ? 'primary' : 'ghost'}" data-guide-sex="female">Девушки</button>
    </div>

    <p class="text-dim" style="font-size:13.5px;line-height:1.55;margin:0 0 14px;">
      Цифры здесь сравниваются только сами с собой. Поэтому важнее не абсолютная
      точность, а одинаковая техника: одно время, одна лента, одна и та же точка.
    </p>

    <div class="section-label" style="margin-top:0;">Когда мерить</div>
    <ul class="text-dim" style="font-size:13.5px;line-height:1.6;margin:0 0 16px;padding-left:18px;">
      <li>Утром, натощак, до тренировки и до душа.</li>
      <li>Один и тот же день недели — раз в ${state.body.settings.everyDays || 10} дней по текущей настройке.</li>
      <li>Не на следующий день после солёного, алкоголя или перелёта: это вода, а не результат.</li>
      ${female ? '<li>В одну и ту же фазу цикла. За несколько дней до месячных вода даёт до +2 кг и пару сантиметров на талии — сравнивать такой замер с предыдущим бессмысленно.</li>' : ''}
    </ul>

    <div class="section-label" style="margin-top:0;">Как держать ленту</div>
    <ul class="text-dim" style="font-size:13.5px;line-height:1.6;margin:0 0 16px;padding-left:18px;">
      <li>Лента прилегает к коже, но не вдавливается — под ней не должно быть валика.</li>
      <li>Горизонтально полу, сзади на той же высоте, что спереди. Проверять в зеркале.</li>
      <li>Мышцы расслаблены (кроме бицепса), дыхание обычное, замер на спокойном выдохе.</li>
      <li>Каждый обхват мерить дважды и записывать среднее. Разошлось больше чем на сантиметр — мерить третий раз.</li>
    </ul>

    <div class="section-label" style="margin-top:0;">Точки замера</div>
    ${bodyGuidePoints(female).map(([name, text]) => `
      <div style="margin-bottom:12px;">
        <div style="font-size:13.5px;font-weight:600;margin-bottom:2px;">${name}</div>
        <div class="text-dim" style="font-size:13.5px;line-height:1.55;">${text}</div>
      </div>`).join('')}

    <div class="section-label" style="margin-top:4px;">Что из этого считается</div>
    <ul class="text-dim" style="font-size:13.5px;line-height:1.6;margin:0 0 16px;padding-left:18px;">
      <li>${shape}</li>
      <li>% жира по формуле US Navy: ${fatNeeds}. Рост берётся из профиля питания.</li>
      <li>Это оценка с погрешностью в несколько процентов, а не медицинское измерение. Смотреть надо, куда она идёт от замера к замеру, а не на саму цифру.</li>
    </ul>

    <div class="form-actions">
      <button type="button" class="btn primary" data-guide-close>Понятно</button>
    </div>`, modal => {
    modal.querySelector('[data-guide-close]').addEventListener('click', closeModal);
    modal.querySelectorAll('[data-guide-sex]').forEach(b =>
      b.addEventListener('click', () => openBodyGuide(b.dataset.guideSex)));
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
