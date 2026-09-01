/* =========================================================================
   ui.js — общие помощники интерфейса: экранирование, тосты, модалки,
   эффекты (конфетти, звук) и простые графики на SVG
   ========================================================================= */

const toastRoot = () => document.getElementById('toastRoot');
const fxRoot = () => document.getElementById('fxRoot');
const modalRoot = () => document.getElementById('modalRoot');

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

/* ---- Оверлей повышения уровня ---------------------------------------- */
function showLevelUp(level) {
  const root = fxRoot();
  if (!root) return;
  const wrap = document.createElement('div');
  wrap.className = 'levelup-pop';
  wrap.innerHTML = `<div class="levelup-card">
      <div class="lu-1">Новый уровень</div>
      <div class="lu-2">⭐ ${level} ⭐</div>
      <div class="lu-3">+1 очко навыка</div>
    </div>`;
  root.appendChild(wrap);
  SFX.levelUp();
  confetti(90);
  setTimeout(() => wrap.remove(), 2200);
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

/* Тепловая карта активности (как на GitHub) */
function heatmapHtml(activity, weeks = 20) {
  const cells = [];
  const today = new Date();
  const totalDays = weeks * 7;
  const start = new Date(today);
  start.setDate(start.getDate() - totalDays + 1);
  // выравниваем на понедельник
  const shift = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - shift);

  const values = Object.values(activity).map(a => a.xp || 0);
  const max = Math.max(1, ...values);

  const cursor = new Date(start);
  const columns = [];
  while (cursor <= today) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const ds = dateStr(cursor);
      const xp = (activity[ds] && activity[ds].xp) || 0;
      const level = xp === 0 ? 0 : Math.min(4, Math.ceil((xp / max) * 4));
      col.push(cursor > today
        ? `<div class="hm-cell empty"></div>`
        : `<div class="hm-cell l${level}" title="${fmtDateHuman(ds)}: ${fmtNum(xp)} XP"></div>`);
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(`<div class="hm-col">${col.join('')}</div>`);
  }
  return `<div class="heatmap-wrap">
      <div class="heatmap">${columns.join('')}</div>
      <div class="hm-legend">
        <span>меньше</span>
        <div class="hm-cell l0"></div><div class="hm-cell l1"></div><div class="hm-cell l2"></div>
        <div class="hm-cell l3"></div><div class="hm-cell l4"></div>
        <span>больше</span>
      </div>
    </div>`;
}

/* ---- Вспомогательное для форм ---------------------------------------- */
function statOptions(selectedId) {
  let html = `<option value="">— без характеристики —</option>`;
  for (const s of state.stats) {
    html += `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${s.icon} ${esc(s.name)}</option>`;
  }
  return html;
}
function difficultyOptions(selected = 'easy') {
  return Object.entries(DIFFICULTY).map(([k, v]) =>
    `<option value="${k}" ${k === selected ? 'selected' : ''}>${v.label} (×${v.mult})</option>`).join('');
}
function statById(id) { return state.stats.find(s => s.id === id); }
function statChip(statId) {
  const s = statById(statId);
  return s ? `<span class="chip">${s.icon} ${esc(s.name)}</span>` : '';
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
