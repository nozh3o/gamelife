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
  flame: '<path d="M12 2.5c2.5 3 4 5.7 4 8.5a4 4 0 0 1-8 0c0-1.2.4-2 1-2.8.2 1 .8 1.5 1.5 1.3-.7-2 .3-3.7 1.5-7z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.3 2"/>',
  alert: '<path d="M12 3.5l9.5 16.5H2.5z"/><path d="M12 9.5v5"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.3"/>',
  image: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M3.5 17l5-5 3.5 3.5 3-3 5.5 5.5"/>',
  barcode: '<path d="M4 4.5v15" stroke-width="2.4"/><path d="M7 4.5v15"/><path d="M9.5 4.5v15" stroke-width="2.4"/><path d="M12.5 4.5v15"/><path d="M15 4.5v15" stroke-width="2.4"/><path d="M18 4.5v15"/><path d="M20.5 4.5v15" stroke-width="2.4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  edit: '<path d="M15.5 3.5l5 5L8 21H3v-5z"/><path d="M13.5 5.5l5 5"/>',
  x: '<path d="M5 5l14 14"/><path d="M19 5L5 19"/>',
  checkmark: '<path d="M4.5 12.5l5 5 10-11"/>',
  save: '<path d="M5 4.5h11l3.5 3.5v11.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z"/><path d="M8 4.5v5h7v-5"/><path d="M8 20v-6h8v6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.3"/><path d="M12 19.2v2.3"/><path d="M4.6 4.6l1.6 1.6"/><path d="M17.8 17.8l1.6 1.6"/><path d="M2.5 12h2.3"/><path d="M19.2 12h2.3"/><path d="M4.6 19.4l1.6-1.6"/><path d="M17.8 6.2l1.6-1.6"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  volume: '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a8 8 0 0 1 0 11"/>',
  download: '<path d="M12 3.5v11.5"/><path d="M7 10.5l5 5 5-5"/><path d="M4.5 19.5h15"/>',
  upload: '<path d="M12 19.5V8"/><path d="M7 13l5-5 5 5"/><path d="M4.5 19.5h15"/>',
  trash: '<path d="M5 7h14"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 19h2"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.5-9 5.5 5.5 0 0 1 10.6-1.7A4 4 0 0 1 17 18.5z"/>',
  hourglass: '<path d="M6 3.5h12"/><path d="M6 20.5h12"/><path d="M7 3.5v3.2c0 1.6 1.8 3 5 5.3 3.2-2.3 5-3.7 5-5.3V3.5"/><path d="M7 20.5v-3.2c0-1.6 1.8-3 5-5.3 3.2 2.3 5 3.7 5 5.3v3.2"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/>',
  clipboard: '<rect x="5.5" y="4.5" width="13" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3.5" rx="1"/><path d="M8.5 11h7"/><path d="M8.5 15h7"/>',
  key: '<circle cx="8" cy="15" r="3.7"/><path d="M10.5 12.5L18 5"/><path d="M15.5 7.5l2.3 2.3"/><path d="M13 10l2 2"/>',
  bot: '<rect x="5" y="8.5" width="14" height="10" rx="2.5"/><circle cx="9.3" cy="13.3" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.7" cy="13.3" r="1.1" fill="currentColor" stroke="none"/><path d="M12 5.5v3"/><circle cx="12" cy="4" r="1"/><path d="M2.5 12.5v3"/><path d="M21.5 12.5v3"/>',
  flag: '<path d="M6 3v18"/><path d="M6 4h11l-2.5 4 2.5 4H6z"/>',
  shirt: '<path d="M8 3.5L3.5 6.5 5.5 10l2-1v11.5h9V9l2 1 2-3.5L16 3.5c-.6 1.5-2.1 2.5-4 2.5s-3.4-1-4-2.5z"/>',
  wifi: '<path d="M4 9a12 12 0 0 1 16 0"/><path d="M7 12.5a7.5 7.5 0 0 1 10 0"/><path d="M10 16a3 3 0 0 1 4 0"/><circle cx="12" cy="19" r=".9" fill="currentColor" stroke="none"/>',
  box: '<path d="M3.5 8l8.5-4 8.5 4-8.5 4z"/><path d="M3.5 8v9l8.5 4 8.5-4V8"/><path d="M12 12v9"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/>',
  gift: '<rect x="4" y="9.5" width="16" height="10.5" rx="1.5"/><path d="M4 13.5h16"/><path d="M12 9.5v10.5"/><path d="M12 9.5C10 6 6.5 6 6.5 8.7c0 1.3 2 1.3 5.5.8zM12 9.5c2-3.5 5.5-3.5 5.5-.8 0 1.3-2 1.3-5.5.8z"/>',
  laptop: '<rect x="4.5" y="5" width="15" height="10" rx="1.5"/><path d="M2.5 19h19"/><path d="M9.5 19l1-2h3l1 2"/>',
  tool: '<path d="M14.5 3.5a4.5 4.5 0 0 0-5.9 5l-6 6a1.8 1.8 0 0 0 2.5 2.5l6-6a4.5 4.5 0 0 0 5-5.9l-3 3-2-2z"/>',
  bank: '<path d="M4 10h16"/><path d="M4 20h16"/><path d="M5.5 10v10"/><path d="M18.5 10v10"/><path d="M9.5 10v10"/><path d="M14.5 10v10"/><path d="M12 2.5l9 5.5H3z"/>',
  banknote: '<rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M5.5 9v-.01"/><path d="M18.5 15v-.01"/>',
  card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.2"/><path d="M2.5 9.5h19"/><path d="M5.5 14.5h4"/>',
  chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.4 11.4a6.6 6.6 0 0 0 13.2 0"/><path d="M12 18v3"/><path d="M8.6 21h6.8"/>',
  mood1: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><path d="M7.5 17.5Q12 13 16.5 17.5"/>',
  mood2: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><path d="M8 16.5Q12 15 16 16.5"/>',
  mood3: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><path d="M8.5 16.2h7"/>',
  mood4: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><path d="M8 15Q12 18 16 15"/>',
  mood5: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><path d="M7.5 14.5Q12 19.5 16.5 14.5"/>',
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
          <button class="btn ghost icon-only" data-modal-close aria-label="Закрыть">${icon('x',13)}</button>
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
