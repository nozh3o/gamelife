/* =========================================================================
   views-finance.js — финансы как в приложениях-кошельках: несколько счетов
   (наличные, карты, кредитки), операции с привязкой к счёту, переводы между
   своими счетами, категории с иконками, лимиты трат и аналитика
   ========================================================================= */

const DEFAULT_EXPENSE_CATS = [
  { name: 'Еда', icon: 'utensils' }, { name: 'Жильё', icon: 'home' }, { name: 'Транспорт', icon: 'car' },
  { name: 'Развлечения', icon: 'music' }, { name: 'Здоровье', icon: 'heart' }, { name: 'Одежда', icon: 'shirt' },
  { name: 'Образование', icon: 'book' }, { name: 'Подписки', icon: 'phone' }, { name: 'Связь', icon: 'wifi' },
  { name: 'Прочее', icon: 'box' },
];
const DEFAULT_INCOME_CATS = [
  { name: 'Зарплата', icon: 'briefcase' }, { name: 'Подработка', icon: 'tool' }, { name: 'Фриланс', icon: 'laptop' },
  { name: 'Подарок', icon: 'gift' }, { name: 'Инвестиции', icon: 'chart' }, { name: 'Прочее', icon: 'box' },
];
const ACCOUNT_TYPES = [
  { id: 'cash', label: 'Наличные', icon: 'banknote' },
  { id: 'card', label: 'Дебетовая карта', icon: 'card' },
  { id: 'credit', label: 'Кредитная карта', icon: 'card' },
  { id: 'savings', label: 'Накопительный счёт', icon: 'bank' },
  { id: 'other', label: 'Другое', icon: 'wallet' },
];
const CAT_COLORS = ['#7c5cff', '#5c8dff', '#3ecf8e', '#f5c04a', '#ff9f5c', '#ff5c72', '#35b8e0', '#b06cff', '#22c08a', '#e8a33d'];
// набор иконок, из которых можно выбрать при создании своей категории —
// вместо свободного ввода эмодзи (см. CAT_ICON_CHOICES ниже)
const CAT_ICON_CHOICES = [
  'utensils', 'home', 'car', 'music', 'heart', 'shirt', 'book', 'phone', 'wifi', 'box',
  'briefcase', 'tool', 'laptop', 'gift', 'chart', 'star', 'globe', 'camera', 'dumbbell', 'sparkle',
  'wallet', 'card', 'banknote', 'bank',
];
/* Иконка категории/счёта хранится ключом набора ICONS; если в данных
   остался старый эмодзи-символ — просто показываем его как есть. */
function catIconHtml(key, size = 16) {
  return ICONS[key] ? icon(key, size) : key ? esc(key) : icon('box', size);
}

let financeMonthFilter = '';
let financeAccountFilter = '';

function monthKey(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
}

function expenseCats() { return [...DEFAULT_EXPENSE_CATS, ...state.finance.customCategories.expense]; }
function incomeCats() { return [...DEFAULT_INCOME_CATS, ...state.finance.customCategories.income]; }
function catIcon(name, type) {
  const found = (type === 'income' ? incomeCats() : expenseCats()).find(c => c.name === name);
  return found ? found.icon : 'box';
}
function accountTypeDef(id) { return ACCOUNT_TYPES.find(t => t.id === id) || ACCOUNT_TYPES[1]; }

/* ---- Применение операции к балансам счетов ------------------------------- */
function applyTxEffect(tx, sign = 1) {
  const acc = financeAccount(tx.accountId);
  if (tx.type === 'income' && acc) acc.balance += tx.amount * sign;
  else if (tx.type === 'expense' && acc) acc.balance -= tx.amount * sign;
  else if (tx.type === 'transfer') {
    const to = financeAccount(tx.toAccountId);
    if (acc) acc.balance -= tx.amount * sign;
    if (to) to.balance += tx.amount * sign;
  }
}

/* Совместимость со старым вызовом из views-goals.js: addTransaction(amount, type, category, note, date, silent) */
function addTransaction(amount, type, category, note, date, silent = false, accountId) {
  const acc = accountId ? financeAccount(accountId) : state.finance.accounts[0];
  const tx = {
    id: uid(), date: date || todayStr(), time: new Date().toTimeString().slice(0, 5),
    amount: Math.abs(amount), type, category: category || 'Прочее', note: note || '',
    accountId: acc ? acc.id : state.finance.accounts[0].id,
  };
  state.finance.transactions.unshift(tx);
  applyTxEffect(tx, 1);
  if (!silent) {
    addLog(type === 'income' ? '💵' : '💸',
      `${type === 'income' ? 'Доход' : 'Расход'}: ${fmtMoney(Math.abs(amount))} · ${category || 'Прочее'}`);
  }
}

function deleteTransaction(id) {
  const tx = state.finance.transactions.find(x => x.id === id);
  if (!tx) return;
  applyTxEffect(tx, -1);
  state.finance.transactions = state.finance.transactions.filter(x => x.id !== id);
}

/* ---- Экран ----------------------------------------------------------------- */
function renderFinance() {
  const txs = state.finance.transactions;
  const thisMonth = monthKey();
  const balance = financeBalance();
  const monthIncome = financeMonth('income', thisMonth);
  const monthExpense = financeMonth('expense', thisMonth);
  const saved = monthIncome - monthExpense;
  const savingRate = monthIncome ? Math.round((saved / monthIncome) * 100) : 0;

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    months.push(monthKey(d));
  }

  const byCat = {};
  txs.filter(t => t.type === 'expense' && t.date.startsWith(thisMonth))
    .forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
  const catParts = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([label, value], i) => ({ label, value, color: CAT_COLORS[i % CAT_COLORS.length] }));

  const availableMonths = [...new Set(txs.map(t => t.date.slice(0, 7)))].sort().reverse();

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Финансы</h1>
        <p class="page-sub">Настоящие деньги в ${esc(state.settings.currency)}. Несколько счетов, лимиты трат и куда всё уходит.</p>
      </div>
      <div class="head-actions">
        <button class="btn" id="addAccount">${icon('plus',15)} Счёт</button>
        <button class="btn primary" id="addTx">${icon('plus',15)} Операция</button>
      </div>
    </div>

    <div class="section-label">Счета <span class="chip">${state.finance.accounts.length}</span></div>
    <div class="acc-row" id="accRow"></div>

    <div class="grid cols-4 mt16">
      <div class="card kpi"><div class="kpi-label">Общий баланс</div>
        <div class="big-number ${balance >= 0 ? 'green' : 'red'}">${fmtMoney(balance)}</div>
        <div class="kpi-sub">по всем счетам</div></div>
      <div class="card kpi"><div class="kpi-label">Доход за месяц</div>
        <div class="big-number green">${fmtMoney(monthIncome)}</div>
        <div class="kpi-sub">всего заработано ${fmtMoney(financeTotal('income'))}</div></div>
      <div class="card kpi"><div class="kpi-label">Расход за месяц</div>
        <div class="big-number red">${fmtMoney(monthExpense)}</div>
        <div class="kpi-sub">всего потрачено ${fmtMoney(financeTotal('expense'))}</div></div>
      <div class="card kpi"><div class="kpi-label">Отложено за месяц</div>
        <div class="big-number ${saved >= 0 ? 'green' : 'red'}">${fmtMoney(saved)}</div>
        <div class="kpi-sub">норма сбережений ${savingRate}%</div></div>
    </div>

    <div class="section-label">Лимиты трат <button class="btn small" id="addBudget" style="margin-left:8px;">${icon('plus',13)} Добавить</button></div>
    <div class="grid cols-3" id="budgetGrid"></div>

    <div class="grid cols-2 mt16">
      <div class="card">
        <div class="card-title">Доходы и расходы по месяцам</div>
        <div class="dual-chart">
          <div>
            <div class="chart-cap green-text">Доходы</div>
            ${barChartSvg(months.map(m => ({ label: monthLabel(m), value: financeMonth('income', m) })), { color: 'var(--green)', height: 110, valueFmt: fmtMoney })}
          </div>
          <div>
            <div class="chart-cap red-text">Расходы</div>
            ${barChartSvg(months.map(m => ({ label: monthLabel(m), value: financeMonth('expense', m) })), { color: 'var(--red)', height: 110, valueFmt: fmtMoney })}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Расходы этого месяца по категориям</div>
        ${donutSvg(catParts)}
      </div>
    </div>

    <div class="section-label">История операций
      <select id="accFilter" class="inline-select">
        <option value="">все счета</option>
        ${state.finance.accounts.map(a => `<option value="${a.id}" ${financeAccountFilter === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
      </select>
      <select id="monthFilter" class="inline-select">
        <option value="">все месяцы</option>
        ${availableMonths.map(m => `<option value="${m}" ${financeMonthFilter === m ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}
      </select>
    </div>
    <div class="list" id="txList"></div>`;

  document.getElementById('addTx').addEventListener('click', () => openTxForm());
  document.getElementById('addAccount').addEventListener('click', () => openAccountForm());
  document.getElementById('addBudget').addEventListener('click', () => openBudgetForm());
  document.getElementById('monthFilter').addEventListener('change', e => { financeMonthFilter = e.target.value; renderTxList(); });
  document.getElementById('accFilter').addEventListener('change', e => { financeAccountFilter = e.target.value; renderTxList(); });

  renderAccountsRow();
  renderBudgets();
  renderTxList();
}

/* ---- Счета ------------------------------------------------------------------ */
function renderAccountsRow() {
  const wrap = document.getElementById('accRow');
  wrap.innerHTML = state.finance.accounts.map(a => {
    const isCredit = a.type === 'credit';
    const available = isCredit ? (a.creditLimit || 0) + a.balance : null;
    const usedPct = isCredit && a.creditLimit ? clamp(Math.round((-a.balance / a.creditLimit) * 100), 0, 100) : 0;
    return `<div class="account-card" data-acc-click="${a.id}" style="--acc-color:${a.color || '#7c5cff'}">
      <div class="account-top">
        <span class="account-ic">${catIconHtml(a.icon, 20)}</span>
        <div class="account-actions">
          <button class="btn ghost small icon-only" data-acc-edit="${a.id}" title="Изменить">${icon('edit',14)}</button>
          <button class="btn ghost small icon-only danger-text" data-acc-del="${a.id}" title="Удалить">${icon('x',13)}</button>
        </div>
      </div>
      <div class="account-name">${esc(a.name)}</div>
      <div class="account-balance ${a.balance < 0 ? 'red' : ''}">${fmtMoney(a.balance)}</div>
      <div class="chip account-type-chip">${accountTypeDef(a.type).label}</div>
      ${isCredit ? `
        <div class="mt8">${barHtml(usedPct, usedPct > 90 ? 'red-fill' : 'gold')}</div>
        <div class="text-dim" style="font-size:11px;margin-top:4px;">доступно ${fmtMoney(Math.max(0, available))} из ${fmtMoney(a.creditLimit || 0)}</div>
      ` : ''}
    </div>`;
  }).join('') + `<button class="account-card add-account-tile" id="accAddTile">
      ${icon('plus',22)}<span style="font-size:12.5px;">Новый счёт</span>
    </button>`;

  wrap.querySelectorAll('[data-acc-edit]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    openAccountForm(financeAccount(b.dataset.accEdit));
  }));
  wrap.querySelectorAll('[data-acc-del]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    deleteAccount(b.dataset.accDel);
  }));
  wrap.querySelectorAll('[data-acc-click]').forEach(card => card.addEventListener('click', () => {
    financeAccountFilter = card.dataset.accClick;
    renderFinance();
    document.getElementById('txList').scrollIntoView({ block: 'center', behavior: 'smooth' });
  }));
  const addTile = document.getElementById('accAddTile');
  if (addTile) addTile.addEventListener('click', () => openAccountForm());
}

function openAccountForm(existing) {
  const a = existing || {};
  const isEdit = !!existing;
  const type = a.type || 'card';

  openModal(isEdit ? 'Изменить счёт' : 'Новый счёт', `
    <form id="accForm" class="form-grid">
      <label class="field" style="grid-column:1/-1;">Название
        <input type="text" name="name" value="${esc(a.name || '')}" placeholder="Например: Kaspi Gold" required autofocus>
      </label>
      <label class="field" style="grid-column:1/-1;">Тип счёта
        <select name="type" id="accType">
          ${ACCOUNT_TYPES.map(t => `<option value="${t.id}" ${type === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </label>
      <div class="field" style="grid-column:1/-1;">Иконка
        <div class="avatar-picker" id="accIconPicker">
          ${CAT_ICON_CHOICES.map(k => `<button type="button" class="avatar-opt ${(a.icon || accountTypeDef(type).icon) === k ? 'on' : ''}" data-icon="${k}" title="${k}">${icon(k, 19)}</button>`).join('')}
        </div>
        <input type="hidden" name="icon" value="${esc(a.icon || accountTypeDef(type).icon)}">
      </div>
      <label class="field">${isEdit ? 'Текущий баланс' : 'Начальный баланс'}
        <input type="number" name="balance" step="0.01" value="${a.balance ?? 0}">
      </label>
      <label class="field" id="creditLimitField" style="display:${type === 'credit' ? '' : 'none'};">Кредитный лимит
        <input type="number" name="creditLimit" step="0.01" min="0" value="${a.creditLimit ?? 0}">
      </label>
      <div class="field" style="grid-column:1/-1;">Цвет
        <div class="accent-picker">
          ${CAT_COLORS.map(c => `<button type="button" class="accent-opt ${(a.color || CAT_COLORS[0]) === c ? 'on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
        </div>
        <input type="hidden" name="color" value="${esc(a.color || CAT_COLORS[0])}">
      </div>
      ${isEdit ? `<p class="text-dim" style="font-size:12px;grid-column:1/-1;margin:0;">Баланс можно поправить прямо здесь — например, после сверки с настоящим счётом. История операций при этом не меняется.</p>` : ''}
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="button" class="btn ghost" data-cancel>Отмена</button>
        <button type="submit" class="btn primary">${isEdit ? `${icon('save',15)} Сохранить` : `${icon('plus',15)} Создать`}</button>
      </div>
    </form>`, modal => {
    const typeSel = modal.querySelector('#accType');
    const creditField = modal.querySelector('#creditLimitField');
    typeSel.addEventListener('change', () => { creditField.style.display = typeSel.value === 'credit' ? '' : 'none'; });

    const iconInput = modal.querySelector('[name=icon]');
    modal.querySelector('#accIconPicker').addEventListener('click', e => {
      const b = e.target.closest('[data-icon]');
      if (!b) return;
      iconInput.value = b.dataset.icon;
      modal.querySelectorAll('#accIconPicker .avatar-opt').forEach(x => x.classList.toggle('on', x === b));
    });

    modal.querySelector('.accent-picker').addEventListener('click', e => {
      const b = e.target.closest('[data-color]');
      if (!b) return;
      modal.querySelector('[name=color]').value = b.dataset.color;
      modal.querySelectorAll('.accent-opt').forEach(x => x.classList.toggle('on', x === b));
    });

    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
    modal.querySelector('#accForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const name = String(f.get('name') || '').trim();
      if (!name) return;
      const data = {
        name, icon: String(f.get('icon') || 'card').trim() || 'card', type: f.get('type'),
        balance: Number(f.get('balance')) || 0, creditLimit: Number(f.get('creditLimit')) || 0,
        color: f.get('color') || CAT_COLORS[0],
      };
      mutate(() => {
        if (isEdit) Object.assign(existing, data);
        else state.finance.accounts.push({ id: uid(), ...data, createdAt: nowISO() });
      });
      closeModal();
    });
  });
}

function deleteAccount(id) {
  if (state.finance.accounts.length <= 1) { toast('Должен остаться хотя бы один счёт', 'red'); return; }
  const a = financeAccount(id);
  const relatedCount = state.finance.transactions.filter(t => t.accountId === id || t.toAccountId === id).length;
  confirmAction(
    `Удалить счёт «${a ? a.name : ''}»?${relatedCount ? ` Вместе с ним удалится ${relatedCount} ${plural(relatedCount, 'операция', 'операции', 'операций')}.` : ''}`,
    () => mutate(() => {
      state.finance.accounts = state.finance.accounts.filter(x => x.id !== id);
      state.finance.transactions = state.finance.transactions.filter(t => t.accountId !== id && t.toAccountId !== id);
      if (financeAccountFilter === id) financeAccountFilter = '';
    }));
}

/* ---- Лимиты трат ------------------------------------------------------------- */
function renderBudgets() {
  const wrap = document.getElementById('budgetGrid');
  const thisMonth = monthKey();
  if (!state.finance.budgets.length) {
    wrap.innerHTML = `<div class="empty-hint" style="grid-column:1/-1;">Лимитов нет. Например: «Еда — 100 000 ₸ в месяц» — увидишь, сколько осталось, ещё до того как потратишь лишнее.</div>`;
    return;
  }
  wrap.innerHTML = state.finance.budgets.map(b => {
    const isTotal = b.category === '__total__';
    const spent = isTotal ? financeMonth('expense', thisMonth) : financeCategoryMonth(b.category, thisMonth);
    const pct = b.limit ? clamp(Math.round((spent / b.limit) * 100), 0, 999) : 0;
    const barCls = pct >= 100 ? 'red-fill' : pct >= 80 ? 'gold' : 'green';
    const bIcon = isTotal ? 'wallet' : catIcon(b.category, 'expense');
    return `<div class="card budget-card">
      <div class="flex-between">
        <div class="budget-title">${catIconHtml(bIcon, 16)} ${isTotal ? 'Все траты' : esc(b.category)}</div>
        <button class="btn ghost small icon-only danger-text" data-budget-del="${b.id}" title="Удалить">${icon('x',13)}</button>
      </div>
      ${barHtml(Math.min(pct, 100), barCls, true)}
      <div class="flex-between mt8" style="font-size:12px;">
        <span class="text-dim">${fmtMoney(spent)} из ${fmtMoney(b.limit)}</span>
        <span class="${pct >= 100 ? 'text-red' : 'text-dim'}">${pct}%${pct >= 100 ? ' — превышен' : ''}</span>
      </div>
    </div>`;
  }).join('');

  wrap.querySelectorAll('[data-budget-del]').forEach(b => b.addEventListener('click', () => {
    confirmAction('Удалить лимит?', () => mutate(() => {
      state.finance.budgets = state.finance.budgets.filter(x => x.id !== b.dataset.budgetDel);
    }));
  }));
}

function openBudgetForm() {
  const usedCats = new Set(state.finance.budgets.map(b => b.category));
  const options = [
    ...(usedCats.has('__total__') ? [] : [{ value: '__total__', label: 'Все траты' }]),
    ...expenseCats().filter(c => !usedCats.has(c.name)).map(c => ({ value: c.name, label: c.name })),
  ];
  if (!options.length) { toast('На все категории лимиты уже заданы', 'gold'); return; }

  openModal('Новый лимит', `
    <form id="budgetForm" class="form-grid">
      <label class="field" style="grid-column:1/-1;">Категория
        <select name="category">${options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select>
      </label>
      <label class="field" style="grid-column:1/-1;">Лимит в месяц (${esc(state.settings.currency)})
        <input type="number" name="limit" min="1" step="1" required autofocus>
      </label>
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="button" class="btn ghost" data-cancel>Отмена</button>
        <button type="submit" class="btn primary">${icon('plus',15)} Добавить</button>
      </div>
    </form>`, modal => {
    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
    modal.querySelector('#budgetForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const limit = Number(f.get('limit'));
      if (!limit) return;
      mutate(() => state.finance.budgets.push({ id: uid(), category: f.get('category'), limit }));
      closeModal();
    });
  });
}

/* ---- Список операций ---------------------------------------------------------- */
function renderTxList() {
  const list = state.finance.transactions
    .filter(t => !financeMonthFilter || t.date.startsWith(financeMonthFilter))
    .filter(t => !financeAccountFilter || t.accountId === financeAccountFilter || t.toAccountId === financeAccountFilter)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));

  const wrap = document.getElementById('txList');
  if (!list.length) {
    wrap.innerHTML = `<div class="empty-hint">Операций нет. Записывай хотя бы крупные — через месяц увидишь честную картину.</div>`;
    return;
  }
  wrap.innerHTML = list.slice(0, 150).map(txRowHtml).join('')
    + (list.length > 150 ? `<div class="text-dim" style="text-align:center;font-size:12.5px;padding:8px;">показаны последние 150 из ${list.length}</div>` : '');

  wrap.querySelectorAll('[data-tx-del]').forEach(b => b.addEventListener('click', () => {
    confirmAction('Удалить операцию? Баланс счёта пересчитается.', () => mutate(() => deleteTransaction(b.dataset.txDel)));
  }));
  wrap.querySelectorAll('[data-tx-edit]').forEach(b => b.addEventListener('click', () => {
    const tx = state.finance.transactions.find(x => x.id === b.dataset.txEdit);
    if (tx) openTxForm(tx);
  }));
}

function txRowHtml(t) {
  const acc = financeAccount(t.accountId);
  const isTransfer = t.type === 'transfer';
  const toAcc = isTransfer ? financeAccount(t.toAccountId) : null;
  const txIcon = isTransfer ? 'repeat' : t.type === 'income' ? 'banknote' : 'wallet';
  const title = isTransfer
    ? `${acc ? acc.name : '?'} → ${toAcc ? toAcc.name : '?'}`
    : esc(t.category);
  return `<div class="row-item">
      <span class="ic-badge">${!isTransfer ? catIconHtml(catIcon(t.category, t.type), 17) : icon(txIcon, 17)}</span>
      <div class="main">
        <div class="title">${title}${t.note ? ` <span class="text-dim">— ${esc(t.note)}</span>` : ''}</div>
        <div class="meta">
          <span class="chip">${fmtDateHuman(t.date)}${t.time ? ' · ' + esc(t.time) : ''}</span>
          ${!isTransfer && acc ? `<span class="chip">${catIconHtml(acc.icon, 12)} ${esc(acc.name)}</span>` : ''}
        </div>
      </div>
      <div class="tx-amount ${isTransfer ? '' : t.type === 'income' ? 'green' : 'red'}">${isTransfer ? '' : t.type === 'income' ? '+' : '−'}${fmtMoney(t.amount)}</div>
      <div class="actions">
        <button class="btn ghost small icon-only" data-tx-edit="${t.id}" title="Изменить">${icon('edit',14)}</button>
        <button class="btn ghost small icon-only danger-text" data-tx-del="${t.id}" title="Удалить">${icon('x',13)}</button>
      </div>
    </div>`;
}

/* ---- Форма операции ------------------------------------------------------------ */
function openTxForm(existing) {
  const isEdit = !!existing;
  const t = existing || {};
  const initialType = t.type || 'expense';
  const accounts = state.finance.accounts;

  openModal(isEdit ? 'Изменить операцию' : 'Новая операция', `
    <form id="txForm" class="form-grid">
      <div class="field" style="grid-column:1/-1;">Тип
        <div class="seg" id="txType">
          <button type="button" class="seg-btn ${initialType === 'expense' ? 'on' : ''}" data-type="expense">${icon('wallet',14)} Расход</button>
          <button type="button" class="seg-btn ${initialType === 'income' ? 'on' : ''}" data-type="income">${icon('banknote',14)} Доход</button>
          <button type="button" class="seg-btn ${initialType === 'transfer' ? 'on' : ''}" data-type="transfer">${icon('repeat',14)} Перевод</button>
        </div>
        <input type="hidden" name="type" value="${initialType}">
      </div>

      <label class="field" id="accField">Счёт
        <select name="accountId">${accounts.map(a => `<option value="${a.id}" ${t.accountId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
      </label>
      <label class="field" id="toAccField" style="display:none;">На счёт
        <select name="toAccountId">${accounts.map(a => `<option value="${a.id}" ${t.toAccountId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
      </label>
      <label class="field">Сумма (${esc(state.settings.currency)})
        <input type="number" name="amount" min="0" step="0.01" value="${t.amount || ''}" required>
      </label>
      <label class="field">Дата
        <input type="date" name="date" value="${t.date || todayStr()}">
      </label>

      <label class="field" id="catField" style="grid-column:1/-1;">Категория
        <input type="text" name="category" list="catList" value="${esc(t.category || '')}" placeholder="Еда" ${initialType !== 'transfer' ? 'required' : ''}>
        <datalist id="catList"></datalist>
        <div class="quick-cats" id="quickCats"></div>
        <div class="new-cat-row" id="newCatRow" style="display:none;">
          <button type="button" class="btn ghost icon-only" id="newCatIcon" data-icon="sparkle" title="Сменить иконку — просто кликай">${icon('sparkle', 16)}</button>
          <input type="text" id="newCatName" placeholder="Название категории">
          <button type="button" class="btn small" id="newCatOk">Добавить</button>
          <button type="button" class="btn ghost small" id="newCatCancel">${icon('x',13)}</button>
        </div>
      </label>
      <label class="field" style="grid-column:1/-1;">Заметка
        <input type="text" name="note" value="${esc(t.note || '')}" placeholder="необязательно">
      </label>
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="button" class="btn ghost" data-cancel>Отмена</button>
        <button type="submit" class="btn primary">${isEdit ? `${icon('save',15)} Сохранить` : `${icon('plus',15)} Записать`}</button>
      </div>
    </form>`, modal => {
    const typeInput = modal.querySelector('[name=type]');
    const catInput = modal.querySelector('[name=category]');
    const quick = modal.querySelector('#quickCats');
    const datalist = modal.querySelector('#catList');
    const toAccField = modal.querySelector('#toAccField');
    const catField = modal.querySelector('#catField');
    const toAccSelect = modal.querySelector('[name=toAccountId]');
    const accSelect = modal.querySelector('[name=accountId]');

    const newCatRow = modal.querySelector('#newCatRow');
    const newCatIcon = modal.querySelector('#newCatIcon');
    const newCatName = modal.querySelector('#newCatName');

    function fillCats() {
      const cats = typeInput.value === 'income' ? incomeCats() : expenseCats();
      quick.innerHTML = cats.map(c => `<button type="button" class="chip-btn" data-cat="${esc(c.name)}">${catIconHtml(c.icon, 13)} ${esc(c.name)}</button>`).join('')
        + `<button type="button" class="chip-btn" data-newcat="1">${icon('plus', 12)} Своя…</button>`;
      datalist.innerHTML = cats.map(c => `<option value="${esc(c.name)}">`).join('');
      quick.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { catInput.value = b.dataset.cat; }));
      const newBtn = quick.querySelector('[data-newcat]');
      if (newBtn) newBtn.addEventListener('click', () => {
        newCatRow.style.display = 'flex';
        newCatIcon.dataset.icon = 'sparkle'; newCatIcon.innerHTML = icon('sparkle', 16);
        newCatName.value = ''; newCatName.focus();
      });
    }

    newCatIcon.addEventListener('click', () => {
      const i = CAT_ICON_CHOICES.indexOf(newCatIcon.dataset.icon);
      const next = CAT_ICON_CHOICES[(i + 1) % CAT_ICON_CHOICES.length];
      newCatIcon.dataset.icon = next;
      newCatIcon.innerHTML = icon(next, 16);
    });

    newCatRow.querySelector('#newCatCancel').addEventListener('click', () => { newCatRow.style.display = 'none'; });
    newCatRow.querySelector('#newCatOk').addEventListener('click', () => {
      const name = newCatName.value.trim();
      if (!name) { newCatName.focus(); return; }
      const catIconKey = newCatIcon.dataset.icon || 'sparkle';
      const kind = typeInput.value === 'income' ? 'income' : 'expense';
      state.finance.customCategories[kind].push({ name, icon: catIconKey });
      saveState();
      catInput.value = name;
      newCatRow.style.display = 'none';
      fillCats();
      toast(`Категория «${name}» добавлена`, 'green');
    });

    function syncMode() {
      const isTransfer = typeInput.value === 'transfer';
      toAccField.style.display = isTransfer ? '' : 'none';
      catField.style.display = isTransfer ? 'none' : '';
      catInput.required = !isTransfer;
      if (isTransfer && toAccSelect.value === accSelect.value) {
        const other = accounts.find(a => a.id !== accSelect.value);
        if (other) toAccSelect.value = other.id;
      }
      fillCats();
    }
    syncMode();

    modal.querySelector('#txType').addEventListener('click', e => {
      const b = e.target.closest('[data-type]');
      if (!b) return;
      if (b.dataset.type === 'transfer' && accounts.length < 2) { toast('Нужно хотя бы два счёта для перевода', 'red'); return; }
      modal.querySelectorAll('.seg-btn').forEach(x => x.classList.toggle('on', x === b));
      typeInput.value = b.dataset.type;
      syncMode();
    });

    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
    modal.querySelector('#txForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const amount = Number(f.get('amount'));
      const type = f.get('type');
      if (!amount) return;
      if (type === 'transfer' && f.get('accountId') === f.get('toAccountId')) { toast('Выбери разные счета', 'red'); return; }

      const data = {
        type, amount,
        accountId: f.get('accountId'),
        toAccountId: type === 'transfer' ? f.get('toAccountId') : null,
        category: type === 'transfer' ? null : String(f.get('category') || '').trim() || 'Прочее',
        note: String(f.get('note') || '').trim(),
        date: f.get('date') || todayStr(),
      };

      mutate(() => {
        if (isEdit) {
          applyTxEffect(existing, -1);
          Object.assign(existing, data);
          applyTxEffect(existing, 1);
        } else {
          const tx = { id: uid(), time: new Date().toTimeString().slice(0, 5), ...data };
          state.finance.transactions.unshift(tx);
          applyTxEffect(tx, 1);
          addLog(type === 'income' ? '💵' : type === 'expense' ? '💸' : '🔁',
            type === 'transfer' ? `Перевод ${fmtMoney(amount)}` : `${type === 'income' ? 'Доход' : 'Расход'}: ${fmtMoney(amount)} · ${data.category}`);
        }
      });
      closeModal();
      SFX.coin();
    });
  });
}

