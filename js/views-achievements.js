/* =========================================================================
   views-achievements.js — витрина достижений
   ========================================================================= */

function renderAchievements() {
  const unlockedCount = Object.keys(state.achievements).length;
  const pct = Math.round((unlockedCount / ACHIEVEMENTS.length) * 100);
  const unlocked = ACHIEVEMENTS.filter(a => state.achievements[a.id]);
  const locked = ACHIEVEMENTS.filter(a => !state.achievements[a.id]);

  content().innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Достижения</h1>
        <p class="page-sub">За каждое открытое достижение выдаётся кристалл 💎 — на них покупаются питомцы.</p>
      </div>
    </div>

    <div class="card">
      <div class="flex-between" style="margin-bottom:10px;">
        <b style="font-size:15px;">Открыто ${unlockedCount} из ${ACHIEVEMENTS.length}</b>
        <span class="chip gold">${pct}%</span>
      </div>
      ${barHtml(pct, 'gold', true)}
    </div>

    ${unlocked.length ? `<div class="section-label">Получено (${unlocked.length})</div>
      <div class="grid cols-3">${unlocked.map(achCardHtml).join('')}</div>` : ''}

    <div class="section-label">Ещё не открыто (${locked.length})</div>
    <div class="grid cols-3">${locked.map(achCardHtml).join('')}</div>`;
}

function achCardHtml(a) {
  const at = state.achievements[a.id];
  return `<div class="ach-card ${at ? 'unlocked' : 'locked'}">
    <div class="ic">${a.icon}</div>
    <div class="ach-body">
      <div class="title">${esc(a.title)}</div>
      <div class="desc">${esc(a.desc)}</div>
      ${at ? `<div class="ach-date">получено ${new Date(at).toLocaleDateString('ru-RU')}</div>` : ''}
    </div>
  </div>`;
}
