import { CODE } from './content/problems.js';
import { MODULES, byId } from './modules.js';
import { QUESTIONS, GLOSSARY, CHEAT } from './bank.js';
import { renderProblemLab } from './problemlab-view.js';
import { renderFormula } from './formula-view.js';
import { mountWidgets } from './widgets/index.js';
import { getState, subscribe, toggleRead, isRead, moduleProgress, setLast, recordAnswer, rateCard, cardBox, resetAll } from './store.js';
import { esc } from './viz.js';
import { initBrand, placeIndicator, reveal, countUp, spotlight, topbarShadow, pageTransition, themeTransition, swapCard, pauseOffscreen } from './motion.js';
import { quizSetup } from './quiz-setup.js';

const view = document.getElementById('view');
const nav = document.getElementById('nav');
let cleanup = () => {};
let spy = null;

// ---------------------------------------------------------------- helpers
const LECTURES = MODULES.filter(m => m.kind === 'lecture');
const LABS = MODULES.filter(m => m.kind === 'lab');
const totalSections = MODULES.reduce((n, m) => n + m.sections.length, 0);
const CODE_COUNT = CODE.length;
const SIM_COUNT = new Set(MODULES.flatMap(m => m.sections.flatMap(s => [...s.body.matchAll(/data-widget="(\w+)"/g)].map(x => x[1])))).size;

function ring(p) {
  const c = 2 * Math.PI * 6;
  return `<svg class="ring" viewBox="0 0 16 16" aria-hidden="true"><circle class="track" cx="8" cy="8" r="6"/><circle class="fill" cx="8" cy="8" r="6" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/></svg>`;
}
function shuffle(a, seed) {
  const r = [...a]; let s = seed;
  for (let i = r.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor(s / 233280 * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
const hash = str => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

function quizStats(filterMods) {
  const st = getState().quiz;
  const qs = QUESTIONS.filter(q => !filterMods || filterMods.includes(q.m));
  let right = 0, answered = 0;
  qs.forEach(q => { const s = st[q.id]; if (s) { answered++; if (s.last) right++; } });
  return { right, answered, total: qs.length };
}

// ---------------------------------------------------------------- nav
function renderNav(route) {
  const link = (href, icon, label, num, p, active) => `<a class="nav-link" href="${href}" ${active ? 'aria-current="page"' : ''}>
    ${num ? `<span class="nav-num">${num}</span>` : `<i class="ph ph-${icon}"></i>`}<span>${label}</span>${p !== undefined ? ring(p) : '<span></span>'}</a>`;
  const cur = route.join('/');
  nav.innerHTML = `
    <div class="nav-group">${link('#/', 'house', 'Overview', null, undefined, cur === '')}</div>
    <div class="nav-group"><div class="nav-label">Lectures</div>${LECTURES.map(m => link(`#/m/${m.id}`, m.icon, m.navTitle || m.title, m.num, moduleProgress(m), route[0] === 'm' && route[1] === m.id)).join('')}</div>
    <div class="nav-group"><div class="nav-label">Practice assignments</div>${LABS.map(m => link(`#/m/${m.id}`, m.icon, m.navTitle || m.title, m.num, moduleProgress(m), route[0] === 'm' && route[1] === m.id)).join('')}</div>
    <div class="nav-group"><div class="nav-label">Practice</div>
      ${link('#/quiz', 'exam', 'Exam practice', null, undefined, cur === 'quiz')}
      ${link('#/problems', 'tree-structure', 'Problem lab', null, undefined, cur === 'problems')}
      ${link('#/formula', 'function', 'Formula sheet', null, undefined, cur === 'formula')}
      ${link('#/cards', 'cards', 'Flashcards', null, undefined, cur === 'cards')}
      ${link('#/glossary', 'book-bookmark', 'Glossary', null, undefined, cur === 'glossary')}
      ${link('#/cheatsheet', 'note', 'Cheat sheet', null, undefined, cur === 'cheatsheet')}
    </div>`;
  const read = Object.keys(getState().read).length;
  document.getElementById('sideProgress').innerHTML = `<div>Sections understood <strong>${read}/${totalSections}</strong></div><div class="meter"><span style="transform:scaleX(${read / totalSections})"></span></div>`;
  // stagger order for the mobile drawer's entrance
  const items = nav.querySelectorAll('.nav-label, .nav-link');
  items.forEach((el, i) => el.style.setProperty('--s', i + 1));
  document.getElementById('sideProgress').style.setProperty('--s', items.length + 1);
  placeIndicator(nav);
}

function crumbs(parts) {
  document.getElementById('crumbs').innerHTML = parts.map((p, i) => i === parts.length - 1 ? `<strong>${p[0]}</strong>` : `<a href="${p[1]}">${p[0]}</a><i class="ph ph-caret-right"></i>`).join('');
}

// ---------------------------------------------------------------- home
function courseMap() {
  const W = 540, nw = 92, gap = (W - LECTURES.length * nw) / (LECTURES.length - 1), lab = Object.fromEntries(LABS.map((m, i) => [m.id, [i]]));
  const short = Object.fromEntries(MODULES.map(m => [m.id, m.mapLabel || m.title]));
  const pos = {};
  LECTURES.forEach((m, i) => pos[m.id] = [i * (nw + gap), 30]);
  const lgap = (W - LABS.length * nw) / (LABS.length - 1);
  LABS.forEach((m, i) => pos[m.id] = [i * (nw + lgap), 196]);
  const node = m => {
    const [x, y] = pos[m.id], p = moduleProgress(m);
    const words = short[m.id].split(' ');
    const l1 = words.slice(0, Math.ceil(words.length / 2)).join(' '), l2 = words.slice(Math.ceil(words.length / 2)).join(' ');
    return `<g class="map-node ${p === 1 ? 'done' : ''}" style="--n:${MODULES.indexOf(m)}" data-href="#/m/${m.id}" tabindex="0" role="link" aria-label="${m.num}: ${m.title}">
      <rect x="${x}" y="${y}" width="${nw}" height="66" rx="10"/>
      <text class="n" x="${x + 9}" y="${y + 17}">${m.num}</text>
      <text x="${x + 9}" y="${y + 35}">${l1}</text><text x="${x + 9}" y="${y + 49}">${l2}</text>
      <rect x="${x + 9}" y="${y + 56}" width="${nw - 18}" height="3" rx="1.5" fill="var(--line)" stroke="none"/>
      <rect x="${x + 9}" y="${y + 56}" width="${(nw - 18) * p}" height="3" rx="1.5" fill="var(--accent-viz)" stroke="none"/></g>`;
  };
  const lecPath = LECTURES.map((m, i) => `${i ? 'L' : 'M'}${pos[m.id][0] + nw / 2} ${pos[m.id][1] + 33}`).join(' ');
  const links = Object.entries(lab).flatMap(([lid, ls]) => [...new Set(ls)].map(li => {
    const [lx, ly] = pos[LECTURES[li].id], [bx, by] = pos[lid];
    return `<path class="map-flow" d="M${lx + nw / 2} ${ly + 66} C ${lx + nw / 2} ${ly + 120}, ${bx + nw / 2} ${by - 54}, ${bx + nw / 2} ${by}" stroke-dasharray="3 4" opacity=".8"/>`;
  })).join('');
  return `<svg viewBox="-6 0 ${W + 12} 280" role="img" aria-label="Course map: five lectures and five practice assignments">
    <text x="0" y="16" style="font:600 11px var(--font);fill:var(--muted)">Lectures</text>
    <text x="0" y="186" style="font:600 11px var(--font);fill:var(--muted)">Practice assignments</text>
    <path class="map-flow" d="${lecPath}"/><path class="map-pulse" d="${lecPath}"/>
    ${links}
    ${MODULES.map(node).join('')}
  </svg>`;
}

function renderHome() {
  crumbs([['Overview']]);
  const st = getState(), read = Object.keys(st.read).length, qs = quizStats();
  const mastered = GLOSSARY.filter(g => cardBox(g.id) >= 2).length;
  const sims = Object.keys(st.scores).length;
  const weak = MODULES.map(m => { const s = quizStats([m.id]); return { m, s, acc: s.answered ? s.right / s.answered : null }; })
    .filter(x => x.acc !== null && x.acc < .75).sort((a, b) => a.acc - b.acc).slice(0, 5);
  const last = st.last && st.last !== '#/' ? st.last : null;
  const lastMod = last && last.startsWith('#/m/') ? byId[last.split('/')[2]] : null;
  const card = m => {
    const p = moduleProgress(m);
    return `<a class="mcard ${m.kind === 'lab' ? '' : ''}" href="#/m/${m.id}">
      <div class="top"><span class="tag">${m.num}</span><i class="ph ph-${m.icon}" style="font-size:20px;color:var(--faint)"></i></div>
      <h3>${m.title}</h3><p>${m.short}</p>
      <div class="foot"><div class="meter"><span style="transform:scaleX(${p})"></span></div><span class="num">${Math.round(p * 100)}%</span></div></a>`;
  };
  view.innerHTML = `
    <section class="hero">
      <div>
        <h1>Database Programming, <em>ready for the midterm.</em></h1>
        <p class="lede">Lectures 1 to 5 and their practice assignments as notes you can play with: ${SIM_COUNT} simulators, ${QUESTIONS.length} exam questions, ${CODE_COUNT} worked problems (including last year's midterm) and ${GLOSSARY.length} flashcards. Exactly the scope of the doctor's email: conventional, B+ tree, hash and multidimensional indices, and logical planning.</p>
        <div class="hero-cta">
          ${lastMod ? `<a class="btn primary" href="${last}"><i class="ph ph-play"></i>Continue ${lastMod.num}</a>` : `<a class="btn primary" href="#/m/l1"><i class="ph ph-play"></i>Start with Lecture 1</a>`}
          <a class="btn" href="#/quiz"><i class="ph ph-exam"></i>Practice questions</a>
          <a class="btn" href="#/problems"><i class="ph ph-tree-structure"></i>Problem lab</a>
        </div>
      </div>
      <div class="course-map">${courseMap()}</div>
    </section>
    <div class="stats-row">
      <div class="stat"><div class="k">Sections understood</div><div class="v">${read}<small>/${totalSections}</small></div></div>
      <div class="stat"><div class="k">Quiz accuracy</div><div class="v">${qs.answered ? Math.round(qs.right / qs.answered * 100) + '%' : 'none'}<small>${qs.answered ? ` of ${qs.answered}` : ''}</small></div></div>
      <div class="stat"><div class="k">Flashcards known</div><div class="v">${mastered}<small>/${GLOSSARY.length}</small></div></div>
      <div class="stat"><div class="k">Games completed</div><div class="v">${sims}</div></div>
    </div>
    ${weak.length ? `<div class="section-head"><div><h2>Your weak spots</h2><p>Modules where your last answers were under 75% correct. Revisit the notes, then retry.</p></div></div>
      <div class="weak-list">${weak.map(w => `<a class="chip accent" href="#/m/${w.m.id}">${w.m.num} · ${Math.round(w.acc * 100)}%</a>`).join('')}<a class="chip" href="#/quiz?weak=1">Drill weak questions</a></div>` : ''}
    <div class="section-head"><div><h2>Lectures</h2><p>How each index and the logical planner work: the mechanisms, their characteristics, and when each one is the right choice.</p></div></div>
    <div class="module-grid">${LECTURES.map(card).join('')}</div>
    <div class="section-head"><div><h2>Practice assignments</h2><p>Every PA exercise worked step by step: build the index, apply the operations, estimate the sizes. The exam questions look just like these.</p></div></div>
    <div class="module-grid">${LABS.map(card).join('')}</div>
    <div class="section-head"><div><h2>A study loop that works</h2></div></div>
    <div class="plan">
      <div><h3><i class="ph ph-book-open"></i>Understand</h3><p>Read a section, play with its simulator until the result surprises you less, then mark it understood.</p></div>
      <div><h3><i class="ph ph-exam"></i>Test</h3><p>Answer exam-style questions, then work the Problem lab on paper: build the tree, split the bucket, estimate the size. Wrong answers feed your weak-spot list.</p></div>
      <div><h3><i class="ph ph-cards"></i>Recall</h3><p>Flashcards resurface the terms you miss until you know them. Finish with the one-page cheat sheet.</p></div>
    </div>`;
  view.querySelectorAll('.map-node[data-href]').forEach(g => {
    g.addEventListener('click', () => location.hash = g.dataset.href);
    g.addEventListener('keydown', e => { if (e.key === 'Enter') location.hash = g.dataset.href; });
  });
}

// ---------------------------------------------------------------- inline question
function questionHTML(q, idx, total, opts = {}) {
  const order = shuffle(q.o.map((t, i) => ({ t, ok: i === 0 })), hash(q.id) + (opts.salt || 0));
  const mod = byId[q.m];
  return `<div class="q" data-qid="${q.id}">
    <div class="q-meta">${total ? `<span class="num">${idx + 1}/${total}</span>` : ''}<span class="chip" style="padding:2px 8px">${mod.num}</span></div>
    <div class="q-text">${q.q}</div>
    <div class="q-opts">${order.map((o, i) => `<button class="q-opt" data-ok="${o.ok}"><span class="letter">${'ABCD'[i]}</span><span>${o.t}</span></button>`).join('')}</div>
  </div>`;
}
function wireQuestion(root, onAnswer) {
  root.addEventListener('click', e => {
    const b = e.target.closest('.q-opt'); if (!b || b.disabled) return;
    const box = b.closest('.q'), q = QUESTIONS.find(x => x.id === box.dataset.qid), ok = b.dataset.ok === 'true';
    box.querySelectorAll('.q-opt').forEach(o => { o.disabled = true; if (o.dataset.ok === 'true') o.classList.add('correct'); });
    if (!ok) b.classList.add('incorrect');
    box.insertAdjacentHTML('beforeend', `<div class="q-why ${ok ? 'good' : 'bad'}"><strong>${ok ? 'Correct.' : 'Not quite.'}</strong> ${q.why}</div>`);
    recordAnswer(q.id, ok);
    onAnswer && onAnswer(ok, q);
  });
}

// ---------------------------------------------------------------- module page
function renderModule(id, secId) {
  const m = byId[id];
  if (!m) return renderNotFound();
  crumbs([['Overview', '#/'], [m.kind === 'lab' ? 'Practice assignments' : 'Lectures', '#/'], [`${m.num}: ${m.title}`]]);
  const idx = MODULES.indexOf(m), prev = MODULES[idx - 1], next = MODULES[idx + 1];
  const check = QUESTIONS.filter(q => q.m === id).slice(0, 5);
  view.innerHTML = `
    <header class="mod-head">
      <div><div class="kicker">${m.kind === 'lab' ? 'Practice assignment ' + m.num.slice(2) : 'Lecture ' + m.num.slice(1)}</div><h1>${m.title}</h1><p class="lede">${m.short}</p>
        <div class="mod-goals">${m.goals.map(g => `<span class="chip"><i class="ph ph-target"></i>${g}</span>`).join('')}</div></div>
    </header>
    <div class="mod-layout">
      <nav class="toc" aria-label="Sections"><div class="toc-title">On this page</div>
        ${m.sections.map(s => `<a href="#/m/${id}/${s.id}" data-sec="${s.id}" class="${isRead(id, s.id) ? 'read' : ''}"><i class="ph ph-${isRead(id, s.id) ? 'check-circle' : 'circle'}"></i>${s.title}</a>`).join('')}
        <a href="#/m/${id}/check" data-sec="check"><i class="ph ph-exam"></i>Check yourself</a></nav>
      <div>
        ${m.sections.map(s => `<section class="sec" id="sec-${s.id}" data-sec="${s.id}">
          <div class="sec-head"><h2>${s.title}</h2><button class="btn sm read-btn" data-read="${s.id}" aria-pressed="${isRead(id, s.id)}"><i class="ph ph-${isRead(id, s.id) ? 'check-circle' : 'circle'}"></i>${isRead(id, s.id) ? 'Understood' : 'Mark understood'}</button></div>
          ${s.body}</section>`).join('')}
        <section class="sec" id="sec-check" data-sec="check">
          <div class="sec-head"><h2>Check yourself</h2><a class="btn sm" href="#/quiz?m=${id}"><i class="ph ph-exam"></i>All ${QUESTIONS.filter(q => q.m === id).length} questions</a></div>
          <div data-check>${check.map((q, i) => questionHTML(q, i, check.length)).join('')}</div>
        </section>
        <div class="pager">${prev ? `<a href="#/m/${prev.id}"><small>Previous</small><strong>${prev.num}: ${prev.title}</strong></a>` : '<span></span>'}${next ? `<a class="next" href="#/m/${next.id}"><small>Next</small><strong>${next.num}: ${next.title}</strong></a>` : `<a class="next" href="#/quiz"><small>Next</small><strong>Exam practice</strong></a>`}</div>
      </div>
    </div>`;
  cleanup = mountWidgets(view);
  wireQuestion(view.querySelector('[data-check]'));
  view.addEventListener('click', onReadClick);
  // scroll spy for the table of contents
  const links = [...view.querySelectorAll('.toc a')];
  spy = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) links.forEach(a => a.classList.toggle('active', a.dataset.sec === en.target.dataset.sec)); });
  }, { rootMargin: '-30% 0px -60% 0px' });
  view.querySelectorAll('.sec').forEach(s => spy.observe(s));
  if (secId) jumpToSection(secId);
}
function jumpToSection(secId) {
  const target = document.getElementById('sec-' + secId);
  if (!target) return;
  cleanup.mountThrough?.(target);
  requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}
function onReadClick(e) {
  const b = e.target.closest('[data-read]'); if (!b) return;
  const id = currentRoute()[1], s = b.dataset.read, now = toggleRead(id, s);
  b.setAttribute('aria-pressed', now);
  b.innerHTML = `<i class="ph ph-${now ? 'check-circle' : 'circle'}"></i>${now ? 'Understood' : 'Mark understood'}`;
  const a = view.querySelector(`.toc a[data-sec="${s}"]`);
  if (a) { a.classList.toggle('read', now); a.querySelector('i').className = `ph ph-${now ? 'check-circle' : 'circle'}`; }
  if (now && moduleProgress(byId[id]) === 1) toast(`${byId[id].num} complete. Nice work.`);
}

// ---------------------------------------------------------------- quiz
function renderQuiz(params) {
  crumbs([['Overview', '#/'], ['Exam practice']]);
  const pre = params.get('m');
  const state = quizPrefs.state || { sel: new Set(MODULES.map(m => m.id)), count: 15, weakFirst: false };
  if (pre) { state.sel = new Set([pre]); state.count = 99; }
  if (params.get('weak') === '1') state.weakFirst = true;
  quizPrefs.state = state; // remembered while the tab is open
  const run = () => {
    if (setupCleanup) { setupCleanup(); setupCleanup = null; }
    const st = getState().quiz;
    let pool = shuffle(QUESTIONS.filter(q => state.sel.has(q.m)), Date.now() % 100000);
    if (state.weakFirst) pool.sort((a, b) => (st[a.id]?.last === true ? 1 : 0) - (st[b.id]?.last === true ? 1 : 0));
    pool = pool.slice(0, state.count);
    let i = 0; const results = [];
    const show = () => {
      const q = pool[i];
      view.innerHTML = `<div class="quiz-shell">
        <div class="quiz-top"><button class="btn sm ghost" data-quit><i class="ph ph-x"></i>Stop</button><div class="meter"><span style="transform:scaleX(${i / pool.length})"></span></div><span class="num small">${i + 1}/${pool.length}</span></div>
        <div data-q>${questionHTML(q, i, pool.length, { salt: Date.now() % 97 })}</div>
        <div style="margin-top:14px;display:flex;justify-content:flex-end"><button class="btn primary" data-next disabled>${i === pool.length - 1 ? 'See results' : 'Next'}<i class="ph ph-arrow-right"></i></button></div>
      </div>`;
      wireQuestion(view.querySelector('[data-q]'), ok => { results.push({ q, ok }); const n = view.querySelector('[data-next]'); n.disabled = false; n.focus(); });
    };
    const done = () => {
      const right = results.filter(r => r.ok).length, pct = Math.round(right / results.length * 100);
      const byMod = {}; results.forEach(r => { (byMod[r.q.m] ||= [0, 0])[r.ok ? 0 : 1]++; });
      view.innerHTML = `<div class="quiz-shell">
        <div class="tiny muted">Result</div><div class="result-big" style="color:${pct >= 75 ? 'var(--good)' : 'var(--accent)'}">${pct}%</div>
        <p class="lede" style="margin-top:6px">${right} of ${results.length} correct. ${pct >= 85 ? 'Exam-ready on these topics.' : pct >= 60 ? 'Solid base. Review the misses below, then run weak spots first.' : 'Go back to the notes for the modules below, play with their simulators, then retry.'}</p>
        <div class="chips" style="margin:16px 0">${Object.entries(byMod).map(([m, [r, w]]) => `<a class="chip ${w ? 'accent' : ''}" href="#/m/${m}">${byId[m].num}: ${r}/${r + w}</a>`).join('')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-again><i class="ph ph-arrow-counter-clockwise"></i>New round</button><a class="btn" href="#/cards">Flashcards</a></div>
        ${results.some(r => !r.ok) ? `<h2 style="margin:32px 0 12px">Review your misses</h2>${results.filter(r => !r.ok).map(r => `<div class="q"><div class="q-meta"><span class="chip" style="padding:2px 8px">${byId[r.q.m].num}</span></div><div class="q-text">${r.q.q}</div><div class="q-why good" style="margin-top:10px"><strong>${r.q.o[0].replace(/\.$/, '')}.</strong> ${r.q.why}</div></div>`).join('')}` : ''}
      </div>`;
    };
    view.onclick = e => {
      if (e.target.closest('[data-next]')) { i++; i < pool.length ? show() : done(); }
      if (e.target.closest('[data-quit]')) { view.onclick = null; renderQuiz(params); }
      if (e.target.closest('[data-again]')) run();
    };
    keyHandler = e => {
      if (e.target.matches('input, textarea, select')) return;
      const opts = view.querySelectorAll('.q-opt');
      if (/^[1-4]$/.test(e.key) && opts[+e.key - 1] && !opts[0].disabled) opts[+e.key - 1].click();
      if (e.key === 'Enter') { const n = view.querySelector('[data-next]:not([disabled])'); if (n && document.activeElement !== n) n.click(); }
    };
    show();
  };
  let setupCleanup = quizSetup(view, state, id => quizStats([id]), run);
  cleanup = () => setupCleanup && setupCleanup();
}
const quizPrefs = {};

// ---------------------------------------------------------------- flashcards
function renderCards(params) {
  crumbs([['Overview', '#/'], ['Flashcards']]);
  let filter = params.get('m') || 'all', deck = [], i = 0, flipped = false;
  const build = () => {
    deck = GLOSSARY.filter(g => filter === 'all' || g.m === filter);
    deck = shuffle(deck, Date.now() % 9999).sort((a, b) => cardBox(a.id) - cardBox(b.id));
    i = 0; flipped = false;
  };
  const render = () => {
    const boxes = [0, 1, 2, 3].map(b => GLOSSARY.filter(g => (filter === 'all' || g.m === filter) && cardBox(g.id) === b).length);
    const c = deck[i];
    view.innerHTML = `<h1>Flashcards</h1>
      <p class="lede" style="margin-top:10px">Recall the definition before you flip. Cards you miss come back first. Space flips, arrow keys rate.</p>
      <div class="controls" style="margin-top:18px"><select data-f aria-label="Deck"><option value="all">All ${GLOSSARY.length} terms</option>${MODULES.map(m => `<option value="${m.id}" ${filter === m.id ? 'selected' : ''}>${m.num}: ${m.title}</option>`).join('')}</select>
        <div class="chips">${['New / missed', 'Seen once', 'Known', 'Mastered'].map((l, b) => `<span class="chip"><span class="num">${boxes[b]}</span>${l}</span>`).join('')}</div></div>
      ${c ? `<div class="fc-stage"><div class="fc ${flipped ? 'flipped' : ''}" data-flip tabindex="0" role="button" aria-label="Flip card">
          <div class="fc-face"><span class="tag">${byId[c.m].num} · ${i + 1} of ${deck.length}</span><div class="term-big">${c.t}</div><span class="hint">Click or press Space to flip</span></div>
          <div class="fc-face back"><span class="tag">${c.t}</span><div class="def">${c.d}</div><a class="hint" href="#/m/${c.m}" style="color:var(--accent)">Open ${byId[c.m].num} notes</a></div>
        </div></div>
        <div class="fc-actions"><button class="btn" data-rate="0"><i class="ph ph-arrow-left"></i>Again</button><button class="btn primary" data-rate="1">Got it<i class="ph ph-arrow-right"></i></button></div>`
      : `<div class="empty" style="margin-top:20px;max-width:640px"><i class="ph ph-confetti"></i>Deck finished. <button class="btn sm" data-restart style="margin-left:8px">Go again</button></div>`}`;
  };
  build(); render();
  let busy = false;
  const rate = known => {
    if (busy || !deck[i]) return;
    busy = true;
    rateCard(deck[i].id, known);
    swapCard(view.querySelector('.fc-stage'), known, () => { i++; flipped = false; render(); busy = false; });
  };
  view.onclick = e => {
    if (e.target.closest('a')) return;
    if (e.target.closest('[data-flip]')) { flipped = !flipped; view.querySelector('.fc').classList.toggle('flipped', flipped); }
    const r = e.target.closest('[data-rate]'); if (r) rate(r.dataset.rate === '1');
    if (e.target.closest('[data-restart]')) { build(); render(); }
  };
  view.onchange = e => { if (e.target.matches('[data-f]')) { filter = e.target.value; build(); render(); } };
  keyHandler = e => {
    if (e.target.matches('input, textarea, select') || !deck[i]) return;
    if (e.key === ' ') { e.preventDefault(); flipped = !flipped; view.querySelector('.fc')?.classList.toggle('flipped', flipped); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') rate(e.key === 'ArrowRight');
  };
}

// ---------------------------------------------------------------- glossary
function renderGlossary() {
  crumbs([['Overview', '#/'], ['Glossary']]);
  let q = '', m = 'all';
  const render = () => {
    const list = GLOSSARY.filter(g => (m === 'all' || g.m === m) && (g.t + ' ' + g.d).toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.t.localeCompare(b.t));
    view.querySelector('[data-list]').innerHTML = list.length ? list.map(g => `<div class="gloss-item"><h4>${g.t}</h4><p>${g.d}</p><a href="#/m/${g.m}">${byId[g.m].num}</a></div>`).join('') : `<div class="empty"><i class="ph ph-magnifying-glass"></i>No term matches "${esc(q)}".</div>`;
  };
  view.innerHTML = `<h1>Glossary</h1><p class="lede" style="margin-top:10px">${GLOSSARY.length} terms, each linked to the module that teaches it.</p>
    <div class="controls" style="margin-top:18px"><div class="field" style="max-width:360px"><label for="gq">Filter</label><input id="gq" type="search" placeholder="Type to filter"></div>
      <div class="field" style="max-width:260px"><label for="gm">Module</label><select id="gm"><option value="all">All modules</option>${MODULES.map(x => `<option value="${x.id}">${x.num}: ${x.title}</option>`).join('')}</select></div></div>
    <div class="gloss" data-list></div>`;
  view.oninput = e => { if (e.target.id === 'gq') { q = e.target.value; render(); } };
  view.onchange = e => { if (e.target.id === 'gm') { m = e.target.value; render(); } };
  render();
}

// ---------------------------------------------------------------- cheat sheet
function renderCheat() {
  crumbs([['Overview', '#/'], ['Cheat sheet']]);
  view.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:end;gap:16px;flex-wrap:wrap"><div><h1>Cheat sheet</h1><p class="lede" style="margin-top:10px">Everything on one page for the last review before the exam.</p></div><button class="btn" onclick="window.print()"><i class="ph ph-printer"></i>Print</button></div>
    <div class="cheat" style="margin-top:24px">${CHEAT.map(([id, t, items]) => `<div class="cheat-card"><h3>${t}<a href="#/m/${id}">${byId[id].num}</a></h3><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`).join('')}</div>`;
}

function renderNotFound() {
  crumbs([['Overview', '#/'], ['Not found']]);
  view.innerHTML = `<div class="empty"><i class="ph ph-signpost"></i>That page does not exist. <a href="#/">Back to the overview</a>.</div>`;
}

// ---------------------------------------------------------------- router
let keyHandler = null;
const currentRoute = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || '').split('/').filter(Boolean);

function go() {
  const r = currentRoute();
  if (view.dataset.mod && r[0] === 'm' && r[1] === view.dataset.mod && r[2]) { // section link inside the open module: just scroll
    jumpToSection(r[2]);
    return;
  }
  closeDrawer();
  pageTransition(route);
}

function route(viaTransition = false) {
  const r = currentRoute(), params = new URLSearchParams(location.hash.split('?')[1] || '');
  cleanup(); cleanup = () => {};
  spy?.disconnect(); spy = null;
  keyHandler = null;
  view.onclick = view.onchange = view.oninput = null;
  view.removeEventListener('click', onReadClick);
  view.dataset.mod = '';
  if (!r.length) renderHome();
  else if (r[0] === 'm') { renderModule(r[1], r[2]); view.dataset.mod = r[1]; }
  else if (r[0] === 'quiz') renderQuiz(params);
  else if (r[0] === 'cards') renderCards(params);
  else if (r[0] === 'glossary') renderGlossary();
  else if (r[0] === 'cheatsheet') renderCheat();
  else if (r[0] === 'problems') { crumbs([['Overview', '#/'], ['Problem lab']]); cleanup = renderProblemLab(view, params) || cleanup; }
  else if (r[0] === 'formula') { crumbs([['Overview', '#/'], ['Formula sheet']]); cleanup = renderFormula(view) || cleanup; }
  else renderNotFound();
  renderNav(r);
  setLast(location.hash || '#/');
  view.classList.remove('view-enter');
  if (!viaTransition) { void view.offsetWidth; view.classList.add('view-enter'); }
  if (!(r[0] === 'm' && r[2])) window.scrollTo({ top: 0 });
  reveal(view);
  if (!r.length) { countUp(view); cleanup = pauseOffscreen(view.querySelector('.course-map')); }
  const h1 = view.querySelector('h1'), name = 'Database Programming';
  document.title = h1 && r.length ? `${h1.textContent.replace(/\s+/g, ' ').trim()} · ${name}` : name;
}

window.addEventListener('hashchange', go);
document.addEventListener('keydown', e => {
  if (e.key === '/' && !e.target.matches('input, textarea, select')) { e.preventDefault(); openSearch(); return; }
  keyHandler && keyHandler(e);
});
subscribe(() => renderNav(currentRoute()));

// ---------------------------------------------------------------- theme
const themeBtn = document.getElementById('themeBtn');
function effectiveTheme() { return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
function paintThemeIcon() { themeBtn.innerHTML = `<i class="ph ph-${effectiveTheme() === 'dark' ? 'sun' : 'moon'}"></i>`; }
themeBtn.addEventListener('click', () => {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  themeTransition(themeBtn, () => {
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('dbp-theme', next); } catch { /* storage blocked */ }
    paintThemeIcon();
  });
});
paintThemeIcon();

// ---------------------------------------------------------------- mobile nav
const sidebar = document.getElementById('sidebar'), scrim = document.getElementById('scrim'), menuBtn = document.getElementById('menuBtn');
function openDrawer() {
  sidebar.classList.add('open'); scrim.classList.add('on');
  menuBtn.setAttribute('aria-expanded', 'true');
}
function closeDrawer() {
  if (!sidebar.classList.contains('open')) return;
  sidebar.classList.remove('open'); scrim.classList.remove('on');
  menuBtn.setAttribute('aria-expanded', 'false');
}
menuBtn.addEventListener('click', openDrawer);
scrim.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

initBrand();
topbarShadow();
spotlight(view);

// Offline + instant repeat visits on the deployed site (skipped on localhost so edits show up)
if ('serviceWorker' in navigator && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ---------------------------------------------------------------- search
const dlg = document.getElementById('searchDialog'), sIn = document.getElementById('searchInput'), sOut = document.getElementById('searchResults');
const INDEX = [
  ...GLOSSARY.map(g => ({ t: g.t, d: g.d, href: `#/m/${g.m}`, tag: byId[g.m].num })),
  ...MODULES.flatMap(m => m.sections.map(s => ({ t: s.title, d: `${m.num}: ${m.title}`, href: `#/m/${m.id}/${s.id}`, tag: 'section' }))),
];
let sIdx = 0, sRes = [];
function openSearch() { dlg.showModal(); sIn.value = ''; doSearch(); sIn.focus(); }
function doSearch() {
  const q = sIn.value.trim().toLowerCase();
  sRes = (q ? INDEX.filter(x => (x.t + ' ' + x.d).toLowerCase().includes(q)).sort((a, b) => (b.t.toLowerCase().startsWith(q) ? 1 : 0) - (a.t.toLowerCase().startsWith(q) ? 1 : 0)) : INDEX.filter(x => x.tag === 'section')).slice(0, 30);
  sIdx = 0;
  sOut.innerHTML = sRes.length ? sRes.map((r, i) => `<button class="sr ${i === 0 ? 'active' : ''}" data-href="${r.href}"><em>${r.tag}</em> <strong>${r.t}</strong><span>${r.d}</span></button>`).join('') : `<div class="empty" style="margin:8px"><i class="ph ph-magnifying-glass"></i>Nothing matches "${esc(sIn.value)}".</div>`;
}
document.getElementById('searchBtn').addEventListener('click', openSearch);
sIn.addEventListener('input', doSearch);
sIn.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); dlg.close(); return; }
  const items = sOut.querySelectorAll('.sr');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sIdx = (sIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items.forEach((it, i) => it.classList.toggle('active', i === sIdx)); items[sIdx]?.scrollIntoView({ block: 'nearest' }); }
  if (e.key === 'Enter' && items[sIdx]) { location.hash = items[sIdx].dataset.href; dlg.close(); }
});
sOut.addEventListener('click', e => { const b = e.target.closest('.sr'); if (b) { location.hash = b.dataset.href; dlg.close(); } });
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

// expose a reset for anyone who wants a clean slate from the console
window.signalReset = () => { resetAll(); route(); };

route();
