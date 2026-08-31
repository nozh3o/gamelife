/* =========================================================================
   views-finance.js — реальные деньги: доходы, расходы, категории, аналитика
   ========================================================================= */

const INCOME_CATS = ['Зарплата', 'Подработка', 'Фриланс', 'Подарок', 'Инвестиции', 'Прочее'];
const EXPENSE_CATS = ['Еда', 'Жильё', 'Транспорт', 'Развлечения', 'Здоровье', 'Одежда', 'Образование', 'Прочее'];
const CAT_COLORS = ['#7c5cff', '#5c8dff', '#3ecf8e', '#f5c04a', '#ff9f5c', '#ff5c72', '#35b8e0', '#b06cff'];

let financeMonthFilter = '';

function monthKey(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
}

function addTransaction(amount, type, category, note, date, silent = false) {
  state.finance.transactions.unshift({
    id: uid(), date: date || todayStr(), amount: Math.abs(amount),
    type, category: category || 'Прочее', note: note || '',
  });
  grantXp(4, 'wealth');
  recordActivity(4, 0);
  if (!silent) {
    addLog(type === 'income' ? '💵' : '💸',
      `${type === 'income' ? 'Доход' : 'Расход'}: ${fmtMoney(Math.abs(amount))} · ${category || 'Прочее'}`);
  }
}

function renderFinance() {
  const txs = state.finance.transactions;
  const thisMonth = monthKey();
  const balance = financeBalance();
  const monthIncome = financeMonth('income', thisMonth);
  const monthExpense = financeMonth('expense', thisMonth);
  const saved = monthIncome - monthExpense;
  const savingRate = monthIncome ? Math.round((saved / monthIncome) * 100) : 0;

  // последние 6 месяцев
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(monthKey(d));
  }

  // категории расходов текущего месяца
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
        <p class="page-sub">Настоящие деньги в ${esc(state.settings.currency)}. Каждая записанная операция качает характеристику «Финансы».</p>
      </div>
      <div class="head-actions"><button class="btn primary" id="addTx">＋ Операция</button></div>
    </div>

    <div class="grid cols-4">
      <div class="card kpi"><div class="kpi-label">Баланс</div>
        <div class="big-number ${balance >= 0 ? 'green' : 'red'}">${fmtMoney(balance)}</div>
        <div class="kpi-sub">за всё время</div></div>
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
      <select id="monthFilter" class="inline-select">
        <option value="">все месяцы</option>
        ${availableMonths.map(m => `<option value="${m}" ${financeMonthFilter === m ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}
      </select>
    </div>
    <div class="list" id="txList"></div>`;

  document.getElementById('addTx').addEventListener('click', () => openTxForm());
  document.getElementById('monthFilter').addEventListener('change', e => {
    financeMonthFilter = e.target.value;
    renderTxList();
  });
  renderTxList();
}

function renderTxList() {
  const list = state.finance.transactions
    .filter(t => !financeMonthFilter || t.date.startsWith(financeMonthFilter))
    .sort((a, b) => b.date.localeCompare(a.date));

  const wrap = document.getElementById('txList');
  if (!list.length) {
    wrap.innerHTML = `<div class="empty-hint">Операций нет. Записывай хотя бы крупные — через месяц увидишь честную картину.</div>`;
    return;
  }
  wrap.innerHTML = list.slice(0, 100).map(t => `<div class="row-item">
      <span class="ic">${t.type === 'income' ? '💵' : '💸'}</span>
      <div class="main">
        <div class="title">${esc(t.category)}${t.note ? ` <span class="text-dim">— ${esc(t.note)}</span>` : ''}</div>
        <div class="meta"><span class="chip">${fmtDateHuman(t.date)}</span></div>
      </div>
      <div class="tx-amount ${t.type === 'income' ? 'green' : 'red'}">${t.type === 'income' ? '+' : '−'}${fmtMoney(t.amount)}</div>
      <div class="actions"><button class="btn ghost small icon-only danger-text" data-tx-del="${t.id}" title="Удалить">✕</button></div>
    </div>`).join('')
    + (list.length > 100 ? `<div class="text-dim" style="text-align:center;font-size:12.5px;padding:8px;">показаны последние 100 из ${list.length}</div>` : '');

  wrap.querySelectorAll('[data-tx-del]').forEach(b => b.addEventListener('click', () => {
    confirmAction('Удалить операцию?', () => mutate(() => {
      state.finance.transactions = state.finance.transactions.filter(x => x.id !== b.dataset.txDel);
    }));
  }));
}

function openTxForm() {
  openModal('Новая операция', `
    <form id="txForm" class="form-grid">
      <div class="field" style="grid-column:1/-1;">Тип
        <div class="seg" id="txType">
          <button type="button" class="seg-btn on" data-type="expense">💸 Расход</button>
          <button type="button" class="seg-btn" data-type="income">💵 Доход</button>
        </div>
        <input type="hidden" name="type" value="expense">
      </div>
      <label class="field">Сумма (${esc(state.settings.currency)})
        <input type="number" name="amount" min="0" step="0.01" required autofocus>
      </label>
      <label class="field">Дата
        <input type="date" name="date" value="${todayStr()}">
      </label>
      <label class="field" style="grid-column:1/-1;">Категория
        <input type="text" name="category" list="catList" placeholder="Еда" required>
        <datalist id="catList">${EXPENSE_CATS.map(c => `<option value="${c}">`).join('')}</datalist>
        <div class="quick-cats" id="quickCats"></div>
      </label>
      <label class="field" style="grid-column:1/-1;">Заметка
        <input type="text" name="note" placeholder="необязательно">
      </label>
      <div class="form-actions" style="grid-column:1/-1;">
        <button type="button" class="btn ghost" data-cancel>Отмена</button>
        <button type="submit" class="btn primary">➕ Записать</button>
      </div>
    </form>`, modal => {
    const typeInput = modal.querySelector('[name=type]');
    const catInput = modal.querySelector('[name=category]');
    const quick = modal.querySelector('#quickCats');
    const datalist = modal.querySelector('#catList');

    function fillCats() {
      const cats = typeInput.value === 'income' ? INCOME_CATS : EXPENSE_CATS;
      quick.innerHTML = cats.map(c => `<button type="button" class="chip-btn" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
      datalist.innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
      quick.querySelectorAll('[data-cat]').forEach(b =>
        b.addEventListener('click', () => { catInput.value = b.dataset.cat; }));
    }
    fillCats();

    modal.querySelector('#txType').addEventListener('click', e => {
      const b = e.target.closest('[data-type]');
      if (!b) return;
      modal.querySelectorAll('.seg-btn').forEach(x => x.classList.toggle('on', x === b));
      typeInput.value = b.dataset.type;
      fillCats();
    });

    modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
    modal.querySelector('#txForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const amount = Number(f.get('amount'));
      if (!amount) return;
      mutate(() => addTransaction(amount, f.get('type'), String(f.get('category') || '').trim(),
        String(f.get('note') || '').trim(), f.get('date') || todayStr()));
      closeModal();
      SFX.coin();
    });
  });
}
