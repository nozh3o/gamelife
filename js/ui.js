/* =========================================================================
   ui.js — общие помощники интерфейса: экранирование, тосты, модалки,
   эффекты (конфетти, звук) и простые графики на SVG
   ========================================================================= */

const toastRoot = () => document.getElementById('toastRoot');
const fxRoot = () => document.getElementById('fxRoot');
const modalRoot = () => document.getElementById('modalRoot');

/* ---- Иконки — тонкие line-иконки вместо эмодзи в интерфейсе -------------
   Используются в навигации, шапках разделов и т.п. — везде, где иконка
   часть самого интерфейса, а не личный выбор пользователя для конкретной
   записи. Цвет — currentColor, наследуется от текста кнопки/элемента. */
const ICONS = {
  home: '<path d="M4 11.5l8-7 8 7"/><path d="M6 10.5V19a1 1 0 0 0 1 1h3.5v-6h3v6H17a1 1 0 0 0 1-1v-8.5"/>',
  check: '<circle cx="12" cy="12" r="8.2"/><path d="M8.3 12.3l2.3 2.3 4.6-5"/>',
  target: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none"/>',
  star: '<path d="M12 3.3l2.5 5.3 5.7.7-4.2 4 1.2 5.7-5.2-2.9-5.2 2.9 1.2-5.7-4.2-4 5.7-.7z"/>',
  book: '<path d="M4.2 5.8C4.2 4.8 5 4 6 4h6v16H6c-1 0-1.8-.8-1.8-1.8z"/><path d="M19.8 5.8c0-1-.8-1.8-1.8-1.8h-6v16h6c1 0 1.8-.8 1.8-1.8z"/>',
  wallet: '<rect x="3" y="6.3" width="18" height="12.4" rx="2.3"/><path d="M3 10.2h18"/><circle cx="16.3" cy="14.3" r="1" fill="currentColor" stroke="none"/>',
  leaf: '<path d="M6 18.5C3.7 12.8 7.5 5.3 18 5c1 6.4-3 14-12 13.5z"/><path d="M6.3 18C8.3 13.6 11.5 10 15.7 7.8"/>',
  dumbbell: '<path d="M2.3 10v4"/><path d="M4.8 8.3v7.4"/><path d="M7.3 9.6v5"/><path d="M16.7 9.6v5"/><path d="M19.2 8.3v7.4"/><path d="M21.7 10v4"/><path d="M7.3 12h9.4"/>',
  chart: '<rect x="4" y="12.5" width="3.6" height="7" rx="1" fill="currentColor" stroke="none"/><rect x="10.2" y="6.5" width="3.6" height="13" rx="1" fill="currentColor" stroke="none"/><rect x="16.4" y="9.5" width="3.6" height="10" rx="1" fill="currentColor" stroke="none"/>',
  sliders: '<path d="M4 6.3h8.5"/><path d="M16.5 6.3H20"/><circle cx="14.5" cy="6.3" r="2"/><path d="M4 12h2.5"/><path d="M10.5 12H20"/><circle cx="8.5" cy="12" r="2"/><path d="M4 17.7h8.5"/><path d="M16.5 17.7H20"/><circle cx="14.5" cy="17.7" r="2"/>',
  menu: '<path d="M4 6.5h16"/><path d="M4 12h16"/><path d="M4 17.5h16"/>',
  repeat: '<path d="M17 2.3l3.7 3.7-3.7 3.7"/><path d="M3.3 11V9a4 4 0 0 1 4-4h13.4"/><path d="M7 21.7L3.3 18l3.7-3.7"/><path d="M20.7 13v2a4 4 0 0 1-4 4H3.3"/>',
  calendar: '<rect x="3.4" y="5" width="17.2" height="15" rx="2.2"/><path d="M3.4 9.7h17.2"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  utensils: '<path d="M6.2 2v6.3a2 2 0 0 0 4 0V2"/><path d="M8.2 8.3V22"/><path d="M16.5 2c-2.1 1.9-2.4 6-.4 8.8.5.6.7 1.1.7 1.7V22"/>',
  sparkle: '<path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="M5.6 5.6l2.8 2.8"/><path d="M15.6 15.6l2.8 2.8"/><path d="M18.4 5.6l-2.8 2.8"/><path d="M8.4 15.6l-2.8 2.8"/>',
  palm: '<path d="M12 22V11"/><path d="M12 11c-2-3-6-4-9-2 2 3 6 3.6 9 2z"/><path d="M12 11c2-3 6-4 9-2-2 3-6 3.6-9 2z"/><path d="M12 11c-1-2.6-.6-5 1-7"/><path d="M12 11c1-2.6.6-5-1-7"/>',
  plane: '<path d="M12 2.5c.7 0 1.2.9 1.2 2v5.4l6.3 4v2l-6.3-1.7v3.8l1.8 1.4v1.5l-3-.8-3 .8v-1.5l1.8-1.4v-3.8L4.5 16v-2l6.3-4V4.5c0-1.1.5-2 1.2-2z"/>',
  cap: '<path d="M12 4.5L2.5 9 12 13.5 21.5 9z"/><path d="M6.5 11v4.3c0 1.5 2.5 2.7 5.5 2.7s5.5-1.2 5.5-2.7V11"/><path d="M21.5 9v5.5"/>',
  car: '<path d="M4.5 16V12l1.8-4.3A2 2 0 0 1 8.2 6.5h7.6a2 2 0 0 1 1.9 1.2L19.5 12v4"/><path d="M4.5 16h15"/><circle cx="7.5" cy="16.5" r="1.6"/><circle cx="16.5" cy="16.5" r="1.6"/>',
  heart: '<path d="M12 20.3S3.5 15 3.5 8.9C3.5 5.9 5.8 4 8.3 4c1.6 0 3 .9 3.7 2.2C12.7 4.9 14.1 4 15.7 4c2.5 0 4.8 1.9 4.8 4.9 0 6.1-8.5 11.4-8.5 11.4z"/>',
  music: '<circle cx="6.5" cy="18" r="2.3"/><circle cx="17" cy="16" r="2.3"/><path d="M8.8 18V5.5L19.3 3.5V13.7"/><path d="M8.8 8.5l10.5-2"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.3 3.7 5.3 3.7 8.5s-1.3 6.2-3.7 8.5c-2.4-2.3-3.7-5.3-3.7-8.5S9.6 5.8 12 3.5z"/>',
};
function icon(name, size = 18, cls = '') {
  const p = ICONS[name];
  if (!p) return '';
  return `<svg class="ic${cls ? ' ' + cls : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}
/* Заполняет все элементы с data-icon="имя" соответствующей SVG-иконкой —
   так навигацию в index.html можно разметить один раз, а иконки менять
   только здесь, в одном месте. */
function renderStaticIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = icon(el.dataset.icon, Number(el.dataset.iconSize) || 18);
  });
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtMoney(n) {
  const cur = state.settings.currency || '₸';
  const sign = n < 0 ? '−' : '';
  return sign + Math.abs(Math.round(n)).toLocaleString('ru-RU') + ' ' + cur;
}
function fmtNum(n) { return Math.round(n).toLocaleString('ru-RU'); }
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

/* ---- Тосты ----------------------------------------------------------- */
function toast(text, kind = '') {
  const root = toastRoot();
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = text;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

/* ---- Всплывающие «+XP» рядом с курсором ------------------------------- */
function floatText(text, kind = '') {
  const root = fxRoot();
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'float-text ' + kind;
  el.textContent = text;
  const p = window.__lastPointer || { x: window.innerWidth / 2, y: 120 };
  el.style.left = p.x + 'px';
  el.style.top = p.y + 'px';
  root.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}
document.addEventListener('pointerdown', e => { window.__lastPointer = { x: e.clientX, y: e.clientY }; });

/* ---- Звук (WebAudio, без файлов) ------------------------------------- */
let audioCtx = null;
function beep(freqs = [660, 880], dur = 0.12) {
  if (!state.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const t0 = audioCtx.currentTime + i * dur;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    });
  } catch (e) { /* звук не критичен */ }
}
const SFX = {
  complete: () => beep([720, 960], 0.09),
  levelUp:  () => beep([523, 659, 784, 1047], 0.14),
  damage:   () => beep([220, 160], 0.16),
  coin:     () => beep([1046, 1318], 0.07),
  achieve:  () => beep([784, 988, 1318], 0.12),
};

/* ---- Конфетти -------------------------------------------------------- */
function confetti(count = 70) {
  if (!state.settings.confetti) return;
  const root = fxRoot();
  if (!root) return;
  const colors = ['#7c5cff', '#5c8dff', '#f5c04a', '#3ecf8e', '#ff5c72', '#ff9f5c'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = (Math.random() * 100) + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = (Math.random() * 0.4) + 's';
    p.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    root.appendChild(p);
    setTimeout(() => p.remove(), 3400);
  }
}

/* ---- Модалка --------------------------------------------------------- */
function openModal(title, bodyHtml, onMount) {
  const root = modalRoot();
  root.innerHTML = `<div class="modal-backdrop" data-modal-close>
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="btn ghost icon-only" data-modal-close aria-label="Закрыть">✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
      </div>
    </div>`;
  root.querySelectorAll('[data-modal-close]').forEach(el => {
    el.addEventListener('click', ev => { if (ev.target === el) closeModal(); });
  });
  document.addEventListener('keydown', escCloseModal);
  if (onMount) onMount(root.querySelector('.modal'));
}
function closeModal() {
  modalRoot().innerHTML = '';
  document.removeEventListener('keydown', escCloseModal);
}
function escCloseModal(e) { if (e.key === 'Escape') closeModal(); }

/* Подтверждение вместо стандартного confirm — чтобы стиль не выбивался */
function confirmAction(text, onYes, danger = true) {
  openModal('Подтверждение', `
    <p class="text-dim" style="font-size:14px;line-height:1.5;margin:0 0 18px;">${esc(text)}</p>
    <div class="form-actions">
      <button class="btn ghost" data-no>Отмена</button>
      <button class="btn ${danger ? 'danger-solid' : 'primary'}" data-yes>Подтвердить</button>
    </div>`, modal => {
    modal.querySelector('[data-no]').addEventListener('click', closeModal);
    modal.querySelector('[data-yes]').addEventListener('click', () => { closeModal(); onYes(); });
  });
}

/* ---- Полоски прогресса ----------------------------------------------- */
function barHtml(pct, cls = '', big = false) {
  return `<div class="bar ${big ? 'big' : 'thin'}"><div class="bar-fill ${cls}" style="width:${clamp(pct, 0, 100)}%"></div></div>`;
}

/* ---- Графики на чистом SVG ------------------------------------------- */

/* Столбчатый график: data = [{label, value}] */
function barChartSvg(data, { height = 140, color = 'var(--accent)', valueFmt = fmtNum } = {}) {
  if (!data.length) return `<div class="empty-hint">Нет данных</div>`;
  const max = Math.max(1, ...data.map(d => d.value));
  const bw = 100 / data.length;
  const bars = data.map((d, i) => {
    const h = (d.value / max) * 100;
    return `<g>
      <rect x="${i * bw + bw * 0.15}%" y="${100 - h}%" width="${bw * 0.7}%" height="${h}%" rx="3" fill="${color}" opacity="${d.value ? 1 : 0.18}">
        <title>${esc(d.label)}: ${valueFmt(d.value)}</title>
      </rect>
    </g>`;
  }).join('');
  const labels = data.map(d => `<span>${esc(d.label)}</span>`).join('');
  return `<div class="chart">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="height:${height}px" class="chart-svg">${bars}</svg>
    <div class="chart-labels">${labels}</div>
  </div>`;
}

/* Кольцевая диаграмма: parts = [{label, value, color}] */
function donutSvg(parts, { size = 150, valueFmt = fmtMoney, showPct = true } = {}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return `<div class="empty-hint">Нет данных</div>`;
  const r = 40, c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = parts.map(p => {
    const frac = p.value / total;
    const seg = `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${p.color}" stroke-width="16"
      stroke-dasharray="${(frac * c).toFixed(2)} ${(c - frac * c).toFixed(2)}"
      stroke-dashoffset="${(-offset * c).toFixed(2)}" transform="rotate(-90 50 50)"><title>${esc(p.label)}: ${valueFmt(p.value)} (${Math.round(frac * 100)}%)</title></circle>`;
    offset += frac;
    return seg;
  }).join('');
  const legend = parts.map(p => {
    const pct = Math.round((p.value / total) * 100);
    return `<div class="legend-row">
      <span class="legend-dot" style="background:${p.color}"></span>
      <span class="legend-name">${esc(p.label)}</span>
      <span class="legend-val">${valueFmt(p.value)}${showPct ? ` <b class="legend-pct">${pct}%</b>` : ''}</span>
    </div>`;
  }).join('');
  return `<div class="donut-wrap">
    <svg viewBox="0 0 100 100" width="${size}" height="${size}">${arcs}</svg>
    <div class="legend">${legend}</div>
  </div>`;
}

/* Тепловая карта активности (как на GitHub): counts — { 'YYYY-MM-DD': 0..4 },
   чем больше видов активности в этот день (привычка/журнал/питание/тренировка), тем ярче клетка. */
function activityHeatmapHtml(counts, weeks = 20) {
  const today = new Date();
  const totalDays = weeks * 7;
  const start = new Date(today);
  start.setDate(start.getDate() - totalDays + 1);
  const shift = (start.getDay() + 6) % 7; // выравниваем на понедельник
  start.setDate(start.getDate() - shift);

  const cursor = new Date(start);
  const columns = [];
  while (cursor <= today) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const ds = dateStr(cursor);
      const level = Math.min(4, counts[ds] || 0);
      col.push(cursor > today
        ? `<div class="hm-cell empty"></div>`
        : `<div class="hm-cell l${level}" title="${fmtDateHuman(ds)}${level ? ' · были активны' : ''}"></div>`);
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(`<div class="hm-col">${col.join('')}</div>`);
  }
  return `<div class="heatmap-wrap">
      <div class="heatmap">${columns.join('')}</div>
      <div class="hm-legend">
        <span>меньше</span>
        <div class="hm-cell l0"></div><div class="hm-cell l1"></div><div class="hm-cell l2"></div><div class="hm-cell l3"></div><div class="hm-cell l4"></div>
        <span>больше</span>
      </div>
    </div>`;
}

/* Кольцо прогресса (Apple Activity Ring): одно значение 0–100%,
   опционально крупная подпись и мелкая — в центре. */
function ringSvg(pct, { size = 108, stroke = 10, color = 'var(--accent)', trackColor = 'var(--panel-2)', label = '', sub = '' } = {}) {
  const r = (100 - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = clamp(pct, 0, 100) / 100;
  const dash = frac * c;
  return `<div class="ring" style="width:${size}px;height:${size}px;">
    <svg viewBox="0 0 100 100" width="${size}" height="${size}">
      <circle cx="50" cy="50" r="${r}" fill="none" stroke="${trackColor}" stroke-width="${stroke}"></circle>
      <circle class="ring-fill" cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}"
        transform="rotate(-90 50 50)"></circle>
    </svg>
    ${(label || sub) ? `<div class="ring-center">${label ? `<div class="ring-label">${esc(label)}</div>` : ''}${sub ? `<div class="ring-sub">${esc(sub)}</div>` : ''}</div>` : ''}
  </div>`;
}

/* ---- Вспомогательное для форм ---------------------------------------- */
function difficultyOptions(selected = 'easy') {
  return Object.entries(DIFFICULTY).map(([k, v]) =>
    `<option value="${k}" ${k === selected ? 'selected' : ''}>${v.label}</option>`).join('');
}
function diffChip(key) {
  const d = DIFFICULTY[key] || DIFFICULTY.easy;
  return `<span class="chip diff-${key}">${d.icon} ${d.label}</span>`;
}
function tagChips(tags) {
  return (tags || []).map(t => `<span class="chip tag">#${esc(t)}</span>`).join('');
}
function parseTags(str) {
  return String(str || '').split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean).slice(0, 6);
}
