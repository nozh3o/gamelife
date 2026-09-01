/* =========================================================================
   views-wishes.js — карта желаний: пишешь, что хочешь, по желанию
   добавляешь картинку, отмечаешь, когда сбылось
   ========================================================================= */

function renderWishes() {
  const active = state.wishes.filter(w => !w.done).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const done = state.wishes.filter(w => w.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Карта желаний</h1>
        <p class="page-sub">Запиши, чего хочешь, добавь картинку для настроения — и отметь, когда сбудется.</p>
      </div>
      <div class="head-actions">
        <button class="btn primary" id="addWish">＋ Новое желание</button>
      </div>
    </div>

    <div class="grid cols-3">
      <div class="card kpi"><div class="kpi-label">В процессе</div><div class="big-number">${active.length}</div></div>
      <div class="card kpi"><div class="kpi-label">Сбылось</div><div class="big-number green">${done.length}</div></div>
      <div class="card kpi"><div class="kpi-label">Всего загадано</div><div class="big-number">${state.wishes.length}</div></div>
    </div>

    <div class="section-label">В процессе</div>
    <div class="wish-grid" id="wishesActive"></div>

    ${done.length ? `<div class="section-label">Сбылось 🎉</div>
    <div class="wish-grid" id="wishesDone"></div>` : ''}`;

  document.getElementById('addWish').addEventListener('click', () => openWishForm());

  document.getElementById('wishesActive').innerHTML = active.length
    ? active.map(wishCardHtml).join('')
    : `<div class="empty-hint">Пока пусто. Например: «слетать в Бангкок», «выучить корейский», «своя квартира».</div>`;

  const doneEl = document.getElementById('wishesDone');
  if (doneEl) doneEl.innerHTML = done.map(wishCardHtml).join('');

  bindWishHandlers();
}

function wishCardHtml(w) {
  return `<div class="card wish-card ${w.done ? 'is-done' : ''}">
    <div class="wish-media">
      ${w.image ? `<img src="${w.image}" class="wish-img" alt="">` : `<div class="wish-ic">${wishIconHtml(w.icon)}</div>`}
    </div>
    <div class="wish-body">
      <div class="wish-title">${esc(w.title)}</div>
      ${w.note ? `<div class="wish-note">${esc(w.note)}</div>` : ''}
      ${w.done ? `<div class="chip gold mt8">🎉 Сбылось ${fmtDateHuman(dateStr(new Date(w.doneAt)))}</div>` : ''}
    </div>
    <div class="wish-actions">
      ${!w.done
        ? `<button class="btn success small wfull" data-wish-done="${w.id}">🎉 Сбылось!</button>`
        : `<button class="btn ghost small wfull" data-wish-undone="${w.id}">Вернуть в процесс</button>`}
      <button class="btn ghost small icon-only" data-wish-edit="${w.id}" title="Изменить">✎</button>
      <button class="btn ghost small icon-only danger-text" data-wish-del="${w.id}" title="Удалить">✕</button>
    </div>
  </div>`;
}

function bindWishHandlers() {
  const root = content();
  root.querySelectorAll('[data-wish-done]').forEach(b => b.addEventListener('click', () => {
    mutate(() => {
      const w = state.wishes.find(x => x.id === b.dataset.wishDone);
      if (!w) return;
      w.done = true; w.doneAt = nowISO();
      addLog('🌠', `Желание сбылось: ${w.title}`);
      toast(`🎉 Сбылось: ${w.title}!`, 'gold');
      confetti(130);
      SFX.achieve();
    });
  }));
  root.querySelectorAll('[data-wish-undone]').forEach(b => b.addEventListener('click', () => {
    mutate(() => {
      const w = state.wishes.find(x => x.id === b.dataset.wishUndone);
      if (w) { w.done = false; w.doneAt = null; }
    });
  }));
  root.querySelectorAll('[data-wish-edit]').forEach(b => b.addEventListener('click', () => openWishForm(b.dataset.wishEdit)));
  root.querySelectorAll('[data-wish-del]').forEach(b => b.addEventListener('click', () => {
    const w = state.wishes.find(x => x.id === b.dataset.wishDel);
    if (!w) return;
    confirmAction(`Удалить желание «${w.title}»?`, () => {
      mutate(() => { state.wishes = state.wishes.filter(x => x.id !== w.id); });
    });
  }));
}

const WISH_ICONS = ['sparkle', 'palm', 'home', 'plane', 'wallet', 'book', 'cap', 'car', 'dumbbell', 'heart', 'music', 'globe'];

/* Иконка желания хранится ключом набора ICONS; если в данных остался
   старый эмодзи-символ (записи до этого перехода) — просто показываем
   его как есть, чтобы старые желания не остались без картинки вовсе. */
function wishIconHtml(key) {
  return ICONS[key] ? icon(key, 40) : esc(key || '✨');
}

function openWishForm(id) {
  const existing = id ? state.wishes.find(x => x.id === id) : null;
  const w = existing || {};

  const body = `
    <form id="wishForm" class="form-grid">
      <label class="field" style="grid-column: 1/-1;">Что хочешь?
        <input type="text" name="title" value="${esc(w.title || '')}" placeholder="Например: слетать в Бангкок" required autofocus>
      </label>
      <label class="field" style="grid-column: 1/-1;">Зачем это тебе (необязательно)
        <textarea name="note" rows="2" placeholder="Что изменится, когда сбудется">${esc(w.note || '')}</textarea>
      </label>
      <div class="field" style="grid-column: 1/-1;">Иконка (если без картинки)
        <div class="avatar-picker" id="wishIconPicker">
          ${WISH_ICONS.map(ic => `<button type="button" class="avatar-opt ${(w.icon || 'sparkle') === ic ? 'on' : ''}" data-icon="${ic}" title="${ic}">${icon(ic, 19)}</button>`).join('')}
        </div>
        <input type="hidden" name="icon" value="${esc(w.icon || 'sparkle')}">
      </div>
      <label class="field" style="grid-column: 1/-1;">Картинка для настроения (необязательно)
        <input type="file" name="image" accept="image/*">
      </label>
      ${w.image ? `<div style="grid-column:1/-1;"><img src="${w.image}" class="photo-preview" alt=""><label class="switch mt8"><input type="checkbox" name="removeImage"><span>Убрать текущую картинку</span></label></div>` : ''}
      <div class="form-actions" style="grid-column: 1/-1;">
        <button type="button" class="btn ghost" data-cancel>Отмена</button>
        <button type="submit" class="btn primary">${existing ? '💾 Сохранить' : '➕ Загадать'}</button>
      </div>
    </form>`;

  openModal(existing ? 'Изменить желание' : 'Новое желание', body, modal => {
    const iconInput = modal.querySelector('[name=icon]');
    modal.querySelector('#wishIconPicker').addEventListener('click', e => {
      const b = e.target.closest('[data-icon]');
      if (!b) return;
      iconInput.value = b.dataset.icon;
      modal.querySelectorAll('#wishIconPicker .avatar-opt').forEach(x => x.classList.toggle('on', x === b));
    });

    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
    modal.querySelector('#wishForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const title = String(f.get('title') || '').trim();
      if (!title) return;

      const submitBtn = e.target.querySelector('button[type=submit]');
      const file = f.get('image');
      let image = w.image || null;
      if (f.get('removeImage')) image = null;
      if (file && file.size) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Сжимаю картинку…';
        try {
          image = await shrinkImage(file, 900, 0.82);
        } catch (err) {
          toast('Не получилось прочитать картинку: ' + err.message, 'red');
          submitBtn.disabled = false;
          submitBtn.textContent = existing ? '💾 Сохранить' : '➕ Загадать';
          return;
        }
      }

      const data = {
        title,
        note: String(f.get('note') || '').trim(),
        icon: String(f.get('icon') || 'sparkle').trim() || 'sparkle',
        image,
      };

      mutate(() => {
        if (existing) Object.assign(existing, data);
        else {
          state.wishes.push({ id: uid(), ...data, done: false, doneAt: null, createdAt: nowISO() });
          addLog('🌠', `Новое желание: ${title}`);
        }
      });
      closeModal();
    });
  });
}
