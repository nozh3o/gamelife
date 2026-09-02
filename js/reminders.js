/* =========================================================================
   reminders.js — локальные напоминания: вечерний итог дня и предупреждения
   о лимитах трат, через системные уведомления браузера.

   Это НЕ пуш-уведомления — они приходят, только пока вкладка (или
   установленное на телефон приложение) открыта или свёрнута, но не выгружена
   из памяти. Настоящий пуш при полностью закрытом приложении требует
   отдельного сервера-будильника (VAPID-подписка + периодический запуск на
   Supabase) — здесь этого нет, всё считается на устройстве.

   Кому что напоминаем и когда решается локально: время и флаги хранятся в
   localStorage (REM_KEY), а не в state — это личная настройка устройства,
   синхронизировать её между телефоном и компьютером незачем.
   ========================================================================= */

const REM_KEY = 'gamelife_reminders_v1';
let remState = loadRemState();
let remTimer = null;

function defaultRemState() {
  return { lastEveningDate: '', budgetAlerted: {} };
}
function loadRemState() {
  try {
    const raw = localStorage.getItem(REM_KEY);
    if (raw) return { ...defaultRemState(), ...JSON.parse(raw) };
  } catch (e) { console.warn('Не удалось прочитать настройки напоминаний', e); }
  return defaultRemState();
}
function saveRemState() {
  try { localStorage.setItem(REM_KEY, JSON.stringify(remState)); } catch (e) {}
}

/* ---- Разрешение и отправка ------------------------------------------- */
function remindersSupported() { return 'Notification' in window; }
function remindersPermission() { return remindersSupported() ? Notification.permission : 'unsupported'; }
function remindersOn() {
  const r = state.settings.reminders;
  return !!(r && r.enabled) && remindersPermission() === 'granted';
}

async function enableReminders() {
  if (!remindersSupported()) { toast('Этот браузер не поддерживает уведомления', 'red'); return false; }
  if (remindersPermission() === 'denied') {
    toast('Уведомления заблокированы в настройках сайта у браузера — включи вручную', 'red');
    return false;
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Уведомления не разрешены', 'red'); return false; }
  return true;
}

function sendReminder(title, body, tag) {
  if (remindersPermission() !== 'granted') return;
  const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
  // через service worker уведомление переживает сворачивание вкладки;
  // если воркера нет (например, открыто как file://) — обычный Notification
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification(title, opts))
      .catch(() => { try { new Notification(title, opts); } catch (e) {} });
  } else {
    try { new Notification(title, opts); } catch (e) {}
  }
}

/* ---- Вечерний итог дня -------------------------------------------------- */
function eveningSummaryParts() {
  const today = todayStr();
  const pendingDailies = state.dailies.filter(isDailyDueToday).filter(d => !isDailyDoneToday(d));
  const todayTodos = state.todos.filter(t => !t.done && (t.date || today) === today);
  const overdueTodos = state.todos.filter(t => !t.done && t.date && t.date < today);

  const parts = [];
  if (pendingDailies.length) {
    parts.push(`${pendingDailies.length} ${plural(pendingDailies.length, 'ежедневка', 'ежедневки', 'ежедневок')} не отмечено`);
  }
  if (todayTodos.length) {
    parts.push(`${todayTodos.length} ${plural(todayTodos.length, 'задача', 'задачи', 'задач')} на сегодня`);
  }
  if (overdueTodos.length) {
    parts.push(`${overdueTodos.length} просрочено`);
  }
  return parts;
}

function checkEveningReminder() {
  const r = state.settings.reminders;
  if (!remindersOn() || !r.evening) return;
  const today = todayStr();
  if (remState.lastEveningDate === today) return;
  // сравнение строк "ЧЧ:ММ" работает лексикографически, время можно не парсить
  if (new Date().toTimeString().slice(0, 5) < (r.eveningTime || '20:00')) return;

  const parts = eveningSummaryParts();
  if (parts.length) sendReminder('Итоги дня', parts.join(' · '), 'gamelife-evening');
  remState.lastEveningDate = today;
  saveRemState();
}

/* ---- Лимиты трат --------------------------------------------------------
   Вызывается из mutate() после каждого изменения состояния — дёшево, если
   лимитов нет или напоминания выключены, поэтому отдельный хук не заводим. */
function checkBudgetAlerts() {
  const r = state.settings.reminders;
  if (!remindersOn() || !r.budgetAlerts) return;
  if (!state.finance.budgets.length) return;

  const mk = monthKey();
  state.finance.budgets.forEach(b => {
    if (!b.limit) return;
    const spent = b.category === '__total__' ? financeMonth('expense', mk) : financeCategoryMonth(b.category, mk);
    const pct = (spent / b.limit) * 100;
    const bucket = pct >= 100 ? 100 : pct >= 90 ? 90 : 0;
    if (!bucket) return;

    const key = mk + '|' + b.category;
    if ((remState.budgetAlerted[key] || 0) >= bucket) return;

    const label = b.category === '__total__' ? 'Все траты' : b.category;
    sendReminder(
      bucket >= 100 ? 'Лимит трат превышен' : 'Лимит трат почти исчерпан',
      `${label}: ${fmtMoney(spent)} из ${fmtMoney(b.limit)} (${Math.round(pct)}%)`,
      'gamelife-budget-' + key,
    );
    remState.budgetAlerted[key] = bucket;
    saveRemState();
  });
}

/* ---- Запуск --------------------------------------------------------------
   Проверяем не чаще раза в минуту — этого достаточно для времени с точностью
   до минуты, а для лимитов проверка идёт сразу в mutate(), без таймера. */
function initReminders() {
  checkEveningReminder();
  if (remTimer) clearInterval(remTimer);
  remTimer = setInterval(checkEveningReminder, 60000);
}

/* ---- Карточка в Настройках ---------------------------------------------- */
function remindersCardHtml() {
  if (!remindersSupported()) {
    return `<p class="text-dim" style="font-size:13px;line-height:1.5;">Этот браузер не поддерживает уведомления.</p>`;
  }
  const r = state.settings.reminders;
  const blocked = remindersPermission() === 'denied';
  const on = r.enabled && !blocked;

  return `
    <p class="text-dim" style="font-size:13px;line-height:1.5;">
      Вечером напомнит, если остались невыполненные ежедневки или задачи на сегодня,
      и предупредит, когда траты подбираются к лимиту. Работает, пока приложение
      открыто или свёрнуто — это не пуш, при полностью закрытом приложении не сработает.
    </p>
    ${blocked ? `<div class="warn-box">Уведомления заблокированы в настройках сайта у браузера — включи вручную и обнови страницу.</div>` : ''}
    <label class="switch mt8"><input type="checkbox" id="remEnabled" ${on ? 'checked' : ''} ${blocked ? 'disabled' : ''}><span>${icon('bell', 14)} Включить уведомления</span></label>
    <div id="remOptions" ${on ? '' : 'style="display:none;"'}>
      <div class="check-row mt12">
        <label class="switch"><input type="checkbox" id="remEvening" ${r.evening ? 'checked' : ''}><span>Вечерний итог дня</span></label>
        <input type="time" id="remEveningTime" value="${esc(r.eveningTime || '20:00')}" ${r.evening ? '' : 'disabled'} style="max-width:110px;">
      </div>
      <label class="switch mt8"><input type="checkbox" id="remBudget" ${r.budgetAlerts ? 'checked' : ''}><span>Предупреждать о лимитах трат</span></label>
      <div class="form-actions mt12" style="justify-content:flex-start;">
        <button type="button" class="btn ghost small" id="remTest">${icon('sparkle', 13)} Тестовое уведомление</button>
      </div>
    </div>`;
}

function bindRemindersCard(root) {
  const enabledBox = root.querySelector('#remEnabled');
  if (!enabledBox) return;
  const options = root.querySelector('#remOptions');

  enabledBox.addEventListener('change', async e => {
    if (e.target.checked) {
      const ok = await enableReminders();
      if (!ok) { e.target.checked = false; return; }
      state.settings.reminders.enabled = true;
      saveState();
      options.style.display = '';
      toast('Напоминания включены', 'green');
      checkEveningReminder();
    } else {
      state.settings.reminders.enabled = false;
      saveState();
      options.style.display = 'none';
    }
  });

  const eveningBox = root.querySelector('#remEvening');
  const eveningTime = root.querySelector('#remEveningTime');
  eveningBox.addEventListener('change', e => {
    state.settings.reminders.evening = e.target.checked;
    eveningTime.disabled = !e.target.checked;
    saveState();
  });
  eveningTime.addEventListener('change', e => {
    state.settings.reminders.eveningTime = e.target.value || '20:00';
    saveState();
  });

  root.querySelector('#remBudget').addEventListener('change', e => {
    state.settings.reminders.budgetAlerts = e.target.checked;
    saveState();
  });

  root.querySelector('#remTest').addEventListener('click', () => {
    sendReminder('One', 'Так будет выглядеть напоминание', 'gamelife-test');
    toast('Отправлено — проверь уведомления', 'green');
  });
}
