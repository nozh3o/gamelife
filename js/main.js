/* =========================================================================
   main.js — навигация, цикл перерисовки, запуск
   ========================================================================= */

let currentTab = 'home';
const content = () => document.getElementById('content');

/* Любое изменение состояния идёт через mutate: сохраняем и перерисовываем интерфейс. */
function mutate(fn) {
  fn();
  saveState();
  renderAll();
}

/* ---- Навигация --------------------------------------------------------- */
function renderNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === currentTab);
  });
  positionNavIndicators();
}

/* Плавающая «пилюля» под активным пунктом — двигаем её transform'ом
   к позиции активной кнопки, а не пересоздаём фон на каждой кнопке. */
function positionNavIndicators() {
  const nav = document.getElementById('mainNav');
  const navInd = document.getElementById('navIndicator');
  if (nav && navInd) {
    const active = nav.querySelector('.nav-btn.active');
    if (active) {
      navInd.style.transform = `translateY(${active.offsetTop}px)`;
      navInd.style.height = active.offsetHeight + 'px';
      navInd.classList.add('on');
    } else {
      navInd.classList.remove('on');
    }
  }
  const bn = document.getElementById('bottomNav');
  const bnInd = document.getElementById('bnIndicator');
  if (bn && bnInd) {
    const active = bn.querySelector('.bn-btn.active');
    if (active) {
      bnInd.style.transform = `translateX(${active.offsetLeft}px)`;
      bnInd.style.width = active.offsetWidth + 'px';
      bnInd.classList.add('on');
    } else {
      bnInd.classList.remove('on');
    }
  }
}

function goTab(tab) {
  currentTab = tab;
  document.getElementById('sidebar').classList.remove('open');
  renderAll();
  // короткая анимация появления контента при переходе между вкладками —
  // снимаем и тут же ставим класс заново, иначе повторный переход не переиграет анимацию
  const c = content();
  c.classList.remove('tab-enter');
  void c.offsetWidth;
  c.classList.add('tab-enter');
  window.scrollTo({ top: 0 });
}

/* ---- Диспетчер вкладок -------------------------------------------------- */
const TAB_RENDERERS = {
  home: renderHome,
  tasks: renderTasks,
  goals: renderGoals,
  wishes: renderWishes,
  nutrition: renderNutrition,
  finance: renderFinance,
  stats: renderStats,
  journal: renderJournal,
  settings: renderSettings,
};

function renderAll() {
  renderNav();
  renderSyncBadge();
  (TAB_RENDERERS[currentTab] || renderHome)();
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

  // слушаем на всём сайдбаре — так под неё же попадает и «Настройки» из подвала
  document.getElementById('sidebar').addEventListener('click', e => {
    const btn = e.target.closest('.nav-btn[data-tab]');
    if (btn) goTab(btn.dataset.tab);
  });

  const sidebar = document.getElementById('sidebar');
  const toggleSidebar = () => sidebar.classList.toggle('open');
  document.getElementById('mobileMenuBtn').addEventListener('click', toggleSidebar);

  // нижняя панель на телефоне: прямые разделы работают как обычная навигация,
  // «Ещё» открывает ту же боковую панель со всем списком
  document.getElementById('bottomNav').addEventListener('click', e => {
    const tabBtn = e.target.closest('.nav-btn[data-tab]');
    if (tabBtn) { goTab(tabBtn.dataset.tab); return; }
    if (e.target.closest('#bottomMoreBtn')) toggleSidebar();
  });

  // на телефоне меню закрывается тапом мимо него
  document.addEventListener('click', e => {
    if (!sidebar.classList.contains('open')) return;
    if (sidebar.contains(e.target) || e.target.closest('#mobileMenuBtn') || e.target.closest('#bottomMoreBtn')) return;
    sidebar.classList.remove('open');
  });

  window.addEventListener('resize', positionNavIndicators);
  blockPinchZoom();

  document.getElementById('todayDate').textContent =
    new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  applyTheme();
  registerServiceWorker();
  initSync();

  state.dailies.forEach(recomputeStreak);
  runCron();
  saveState();
  renderAll();

  if (state.migratedFromV1) {
    delete state.migratedFromV1;
    saveState();
    toast('Данные из прошлой версии перенесены', 'green');
  }
}

/* ---- Блокировка приближения жестами -------------------------------------
   iOS Safari игнорирует user-scalable=no в самом Safari (доступность),
   а touch-action не всегда полностью гасит щипок — поэтому вручную
   гасим жесты на уровне событий, как делают нативные обёртки. */
function blockPinchZoom() {
  // Safari: специальные жестовые события для щипка (двумя пальцами)
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('gesturechange', e => e.preventDefault());
  document.addEventListener('gestureend', e => e.preventDefault());

  // Chrome/Android и подстраховка для Safari: щипок — это ≥2 касаний.
  // Двойной тап отдельно не гасим здесь — за это отвечает touch-action
  // в CSS, а ловить его через touchend рискованно: preventDefault там
  // может съесть настоящий клик при быстрых повторных тапах по кнопке.
  document.addEventListener('touchmove', e => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
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
