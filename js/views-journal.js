/* =========================================================================
   views-journal.js — дневник: запись дня, настроение, три победы
   ========================================================================= */

function renderJournal() {
  const today = todayStr();
  const todayEntry = state.journal.find(j => j.date === today);
  const entries = [...state.journal].sort((a, b) => b.date.localeCompare(a.date));
  const streak = journalStreak();

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Журнал</h1>
        <p class="page-sub">Короткая запись в конце дня превращает суету в осознанный прогресс.</p>
      </div>
    </div>

    <div class="grid cols-3">
      <div class="card kpi"><div class="kpi-label">Всего записей</div><div class="big-number">${state.journal.length}</div></div>
      <div class="card kpi"><div class="kpi-label">Дней подряд</div><div class="big-number gold-text">🔥 ${streak}</div></div>
      <div class="card kpi"><div class="kpi-label">Среднее настроение</div><div class="big-number">${avgMoodIcon()}</div></div>
    </div>

    <div class="card mt16">
      <div class="card-title">${todayEntry ? 'Запись за сегодня' : 'Как прошёл день?'} <small>${fmtDateHuman(today)}</small></div>
      <form id="journalForm">
        <div class="mood-row" id="moodRow">
          ${MOODS.map(m => `<button type="button" class="mood-btn ${todayEntry && todayEntry.mood === m.id ? 'on' : ''}" data-mood="${m.id}" title="${m.label}">${m.icon}</button>`).join('')}
        </div>
        <input type="hidden" name="mood" value="${todayEntry ? todayEntry.mood : 3}">

        <label class="field mt16">Три победы дня — по одной на строку
          <textarea name="wins" rows="3" placeholder="Сделал зарядку&#10;Закрыл сложную задачу&#10;Позвонил родителям">${esc(((todayEntry && todayEntry.wins) || []).join('\n'))}</textarea>
        </label>
        <label class="field mt8">За что благодарен сегодня — по одной на строку
          <textarea name="gratitude" rows="3" placeholder="Тёплый дом&#10;Друг помог с переездом&#10;Вкусный завтрак">${esc(((todayEntry && todayEntry.gratitude) || []).join('\n'))}</textarea>
        </label>
        <label class="field mt8">Свободная запись
          <textarea name="text" rows="4" placeholder="Что получилось, что мешало, что попробую завтра…">${esc((todayEntry && todayEntry.text) || '')}</textarea>
        </label>
        <div class="form-actions mt8">
          <button type="submit" class="btn primary">${todayEntry ? '💾 Обновить запись' : '➕ Сохранить'}</button>
        </div>
      </form>
    </div>

    <div class="section-label">История</div>
    <div class="list" id="journalList"></div>`;

  const form = document.getElementById('journalForm');
  const moodInput = form.querySelector('[name=mood]');
  document.getElementById('moodRow').addEventListener('click', e => {
    const b = e.target.closest('[data-mood]');
    if (!b) return;
    moodInput.value = b.dataset.mood;
    form.querySelectorAll('.mood-btn').forEach(x => x.classList.toggle('on', x === b));
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(form);
    const wins = String(f.get('wins') || '').split('\n').map(s => s.trim()).filter(Boolean);
    const gratitude = String(f.get('gratitude') || '').split('\n').map(s => s.trim()).filter(Boolean);
    const text = String(f.get('text') || '').trim();
    const mood = Number(f.get('mood')) || 3;
    if (!wins.length && !gratitude.length && !text) { toast('Напиши хотя бы одну строку', 'red'); return; }

    mutate(() => {
      const existing = state.journal.find(j => j.date === today);
      if (existing) {
        Object.assign(existing, { mood, wins, gratitude, text, updatedAt: nowISO() });
        toast('Запись обновлена', 'green');
      } else {
        state.journal.unshift({ id: uid(), date: today, mood, wins, gratitude, text, createdAt: nowISO() });
        addLog('📔', 'Сделана запись в журнале');
        toast('📔 День записан', 'green');
        SFX.complete();
      }
    });
  });

  const list = document.getElementById('journalList');
  list.innerHTML = entries.length ? entries.map(j => {
    const m = MOODS.find(x => x.id === j.mood);
    return `<div class="card journal-entry">
      <div class="flex-between">
        <div class="je-date">${m ? m.icon : ''} ${fmtDateHuman(j.date)}</div>
        <button class="btn ghost small icon-only danger-text" data-j-del="${j.id}" title="Удалить">✕</button>
      </div>
      ${(j.wins || []).length ? `<ul class="je-wins">${j.wins.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
      ${(j.gratitude || []).length ? `<ul class="je-wins je-gratitude">${j.gratitude.map(g => `<li>🙏 ${esc(g)}</li>`).join('')}</ul>` : ''}
      ${j.text ? `<p class="je-text">${esc(j.text)}</p>` : ''}
    </div>`;
  }).join('') : `<div class="empty-hint">Записей пока нет</div>`;

  list.querySelectorAll('[data-j-del]').forEach(b => b.addEventListener('click', () => {
    confirmAction('Удалить запись из журнала?', () => mutate(() => {
      state.journal = state.journal.filter(x => x.id !== b.dataset.jDel);
    }));
  }));
}

function journalStreak() {
  const set = new Set(state.journal.map(j => j.date));
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

function avgMoodIcon() {
  const moods = state.journal.filter(j => j.mood).map(j => j.mood);
  if (!moods.length) return '—';
  const avg = Math.round(moods.reduce((s, m) => s + m, 0) / moods.length);
  const m = MOODS.find(x => x.id === avg);
  return m ? m.icon : '—';
}
