/* =========================================================================
   main.js — навигация, карточка героя, цикл перерисовки, запуск
   ========================================================================= */

let currentTab = 'dashboard';
const content = () => document.getElementById('content');

/* Любое изменение состояния идёт через mutate: проверяем достижения,
   сохраняем и перерисовываем интерфейс. */
function mutate(fn) {
  fn();
  checkAchievements();
  saveState();
  renderAll();
}

/* ---- Карточка героя в боковой панели ---------------------------------- */
function renderPlayerCard() {
  const p = state.player;
  const li = levelInfo(p.xp);
  const cls = currentClass();
  const hpPct = clamp((p.hp / maxHp()) * 100, 0, 100);
  const mpPct = clamp((p.mp / maxMp()) * 100, 0, 100);
  const pet = p.activePet ? state.pets.find(x => x.id === p.activePet) : null;
  const petDef = pet ? PETS.find(x => x.id === pet.id) : null;

  document.getElementById('playerCard').innerHTML = `
    <div class="pc-top">
      <div class="pc-avatar">${esc(p.avatar || '🧙')}${petDef ? `<span class="pc-pet">${pet.isMount ? petDef.mountIcon : petDef.icon}</span>` : ''}</div>
      <div class="pc-id">
        <div class="pc-name">${esc(p.name || 'Игрок')}</div>
        <div class="pc-level">${cls ? cls.icon + ' ' + cls.name + ' · ' : ''}ур. ${li.level}</div>
      </div>
    </div>

    <div class="pc-bars">
      <div class="pc-bar-row" title="Здоровье">
        <span class="pc-bar-ic">❤️</span>
        ${barHtml(hpPct, 'hp')}
        <span class="pc-bar-val">${Math.round(p.hp)}/${maxHp()}</span>
      </div>
      <div class="pc-bar-row" title="Опыт до следующего уровня">
        <span class="pc-bar-ic">⭐</span>
        ${barHtml(li.pct, 'gold')}
        <span class="pc-bar-val">${li.into}/${li.need}</span>
      </div>
      <div class="pc-bar-row" title="Мана для навыков">
        <span class="pc-bar-ic">🔷</span>
        ${barHtml(mpPct, 'mp')}
        <span class="pc-bar-val">${Math.round(p.mp)}/${maxMp()}</span>
      </div>
    </div>

    <div class="pc-currency">
      <span class="cur-chip gold" title="Игровое золото">🪙 ${fmtNum(p.gold)}</span>
      <span class="cur-chip gem" title="Кристаллы за достижения">💎 ${fmtNum(p.gems)}</span>
    </div>
    ${buffsHtml()}`;
}

function buffsHtml() {
  const b = state.player.buffs;
  const parts = [];
  if (b.xp > 0) parts.push(`<span class="buff-chip">✨ ×2 XP (${b.xp})</span>`);
  if (b.gold > 0) parts.push(`<span class="buff-chip">🔥 ×2 золото (${b.gold})</span>`);
  if (b.shield > 0) parts.push(`<span class="buff-chip">🛡️ защита (${b.shield})</span>`);
  return parts.length ? `<div class="pc-buffs">${parts.join('')}</div>` : '';
}

/* ---- Навигация --------------------------------------------------------- */
function renderNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === currentTab);
  });
}
function goTab(tab) {
  currentTab = tab;
  document.getElementById('sidebar').classList.remove('open');
  renderAll();
  window.scrollTo({ top: 0 });
}

/* ---- Диспетчер вкладок -------------------------------------------------- */
const TAB_RENDERERS = {
  dashboard: renderDashboard,
  tasks: renderTasks,
  goals: renderGoals,
  character: renderCharacter,
  shop: renderShop,
  finance: renderFinance,
  stats: renderStats,
  journal: renderJournal,
  achievements: renderAchievements,
  settings: renderSettings,
};

function renderAll() {
  renderPlayerCard();
  renderNav();
  renderSyncBadge();
  (TAB_RENDERERS[currentTab] || renderDashboard)();
}

function applyTheme() {
  const root = document.documentElement;
  root.setAttribute('data-theme', state.settings.theme === 'light' ? 'light' : 'dark');
  root.setAttribute('data-accent', state.settings.accent || 'violet');
}

/* ---- Запуск ------------------------------------------------------------- */
function init() {
  // ярлыки приложения открывают нужную вкладку: index.html#tasks
  const hash = location.hash.replace('#', '');
  if (TAB_RENDERERS[hash]) currentTab = hash;

  document.getElementById('mainNav').addEventListener('click', e => {
    const btn = e.target.closest('.nav-btn');
    if (btn) goTab(btn.dataset.tab);
  });

  const sidebar = document.getElementById('sidebar');
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
  // на телефоне меню закрывается тапом мимо него
  document.addEventListener('click', e => {
    if (!sidebar.classList.contains('open')) return;
    if (sidebar.contains(e.target) || e.target.closest('#mobileMenuBtn')) return;
    sidebar.classList.remove('open');
  });

  document.getElementById('todayDate').textContent =
    new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  applyTheme();
  registerServiceWorker();
  initSync();

  // здоровье могло вырасти от питомцев — не даём выйти за максимум
  state.player.hp = clamp(state.player.hp, 0, maxHp());
  state.player.mp = clamp(state.player.mp, 0, maxMp());
  state.dailies.forEach(recomputeStreak);

  const cronResult = runCron();

  checkAchievements();
  saveState();
  renderAll();

  if (cronResult) {
    const list = cronResult.missed.slice(0, 5).map(t => '• ' + esc(t)).join('<br>');
    openModal('Новый день', `
      <p style="font-size:14px;line-height:1.55;margin:0 0 12px;">
        Пока тебя не было, накопились пропущенные ежедневки. Герой получил
        <b style="color:var(--red)">−${cronResult.damage} HP</b>.
      </p>
      <div class="mini-box">${list}${cronResult.missed.length > 5 ? '<br>…' : ''}</div>
      <p class="text-dim" style="font-size:13px;margin:14px 0 18px;">
        Ничего страшного — здоровье восстанавливается при повышении уровня, зельем из магазина
        или навыком Целителя. Главное — вернуться в строй.
      </p>
      <div class="form-actions"><button class="btn primary" data-ok>За дело!</button></div>`, modal => {
      modal.querySelector('[data-ok]').addEventListener('click', closeModal);
    });
  } else if (state.migratedFromV1) {
    delete state.migratedFromV1;
    saveState();
    toast('Данные из прошлой версии перенесены', 'green');
  }
}

/* ---- Установка на телефон и офлайн-режим -------------------------------- */
let installPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();               // показываем свою кнопку вместо баннера браузера
  installPrompt = e;
  if (currentTab === 'settings') renderAll();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  toast('Приложение установлено на устройство', 'green');
});

function canInstall() { return !!installPrompt; }

/* Запущено с домашнего экрана, а не во вкладке браузера? */
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}

async function promptInstall() {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  renderAll();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // при открытии файла напрямую (file://) service worker недоступен — это нормально
  if (location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .catch(err => console.warn('Офлайн-режим не включился:', err));
  });
}

function offlineReady() {
  return 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
}

init();
