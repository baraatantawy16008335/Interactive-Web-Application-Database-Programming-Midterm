// Exam practice setup: topic tiles, a length dropdown and a weak-spots switch.
import { MODULES } from './modules.js';
import { QUESTIONS } from './bank.js';
import { reduced, tween } from './viz.js';

const LENGTHS = [
  [5, 'Quick check'], [10, 'Short round'], [15, 'Standard round'], [25, 'Long round'], [99, 'Everything selected'],
];
const minutes = n => Math.max(1, Math.round(n * 0.5)); // about 30 s per question

// state: { sel: Set, count, weakFirst }; stats(id) → { right, answered, total }
export function quizSetup(view, state, stats, onStart) {
  const groups = [['lecture', 'Lectures'], ['lab', 'Labs']];
  const qCount = id => QUESTIONS.filter(q => q.m === id).length;
  const pool = () => QUESTIONS.filter(q => state.sel.has(q.m)).length;

  const tile = (m, i) => {
    const s = stats(m.id), acc = s.answered ? s.right / s.answered : null;
    return `<button type="button" class="tile" style="--t:${i}" data-m="${m.id}" aria-pressed="${state.sel.has(m.id)}">
      <span class="tile-check" aria-hidden="true"><i class="ph ph-check"></i></span>
      <span class="tile-num">${m.num}</span>
      <span class="tile-title">${m.title}</span>
      <span class="tile-meta">${qCount(m.id)} questions${acc === null ? ' · not tried yet' : ` · <b class="${acc >= .75 ? 'ok' : 'low'}">${Math.round(acc * 100)}%</b> last time`}</span>
      <span class="tile-bar" aria-hidden="true"><span style="transform:scaleX(${acc ?? 0})" class="${acc !== null && acc < .75 ? 'low' : ''}"></span></span>
    </button>`;
  };

  view.innerHTML = `<div class="quiz-shell qsetup">
    <h1>Exam practice</h1>
    <p class="lede" style="margin-top:10px">Pick the topics to cover, choose a length, then answer with keys 1-4 and move on with Enter.</p>

    <section class="qs-block" aria-labelledby="qsTopics">
      <div class="qs-head"><h2 id="qsTopics">Topics</h2><span class="qs-count" data-count></span></div>
      ${groups.map(([kind, label]) => `<div class="qs-group">
        <div class="qs-group-head"><span>${label}</span><button type="button" class="qs-link" data-group="${kind}"></button></div>
        <div class="tile-grid" role="group" aria-label="${label}">${MODULES.filter(m => m.kind === kind).map(tile).join('')}</div>
      </div>`).join('')}
    </section>

    <section class="qs-options">
      <div class="field">
        <span class="lbl" id="lenLbl">Length</span>
        <div class="dd" data-dd>
          <button type="button" class="dd-btn" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="lenLbl ddVal">
            <span id="ddVal" class="dd-val"></span><i class="ph ph-caret-down"></i>
          </button>
          <ul class="dd-list" role="listbox" aria-labelledby="lenLbl" tabindex="-1">
            ${LENGTHS.map(([v, name]) => `<li role="option" tabindex="-1" data-v="${v}" aria-selected="${state.count === v}">
              <span class="dd-opt-main"><strong>${name}</strong><small data-optinfo="${v}"></small></span><i class="ph ph-check"></i></li>`).join('')}
          </ul>
        </div>
      </div>
      <div class="field">
        <span class="lbl">Order</span>
        <button type="button" class="switch" role="switch" aria-checked="${state.weakFirst}" data-weak>
          <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
          <span class="switch-text"><strong>Weak spots first</strong><small>Questions you missed or have not seen come first</small></span>
        </button>
      </div>
    </section>

    <div class="qs-start">
      <div class="qs-summary" data-summary></div>
      <button class="btn primary" data-start><i class="ph ph-play"></i>Start</button>
    </div>
  </div>`;

  const $ = s => view.querySelector(s);
  let shownCount = pool();

  const refresh = () => {
    const p = pool(), n = Math.min(state.count, p), topics = state.sel.size;
    // count chip animates between values so the change is felt, not just read
    const el = $('[data-count]'), from = shownCount;
    shownCount = p;
    const paint = v => { el.innerHTML = `<b>${topics}</b> of ${MODULES.length} topics · <b>${Math.round(v)}</b> questions`; };
    if (reduced() || from === p) paint(p); else tween(from, p, 450, paint);
    groups.forEach(([kind]) => {
      const all = MODULES.filter(m => m.kind === kind).every(m => state.sel.has(m.id));
      $(`[data-group="${kind}"]`).textContent = all ? 'Clear' : 'Select all';
    });
    const cur = LENGTHS.find(l => l[0] === state.count);
    $('#ddVal').innerHTML = `<strong>${state.count === 99 ? `All ${p}` : n} question${n === 1 ? '' : 's'}</strong><small>${cur[1]} · about ${minutes(n)} min</small>`;
    LENGTHS.forEach(([v]) => {
      const info = view.querySelector(`[data-optinfo="${v}"]`);
      info.textContent = v === 99 ? `${p} questions · about ${minutes(p)} min` : `${v} questions · about ${minutes(v)} min${v > p ? ` (only ${p} available)` : ''}`;
    });
    $('[data-summary]').innerHTML = p
      ? `<strong>${n} questions</strong><span>${topics} topic${topics === 1 ? '' : 's'} · about ${minutes(n)} min${state.weakFirst ? ' · weak spots first' : ''}</span>`
      : `<strong>No topics selected</strong><span>Pick at least one tile above</span>`;
    $('[data-start]').disabled = !p;
  };

  // ---- tiles
  view.querySelectorAll('.tile').forEach(t => t.addEventListener('click', () => {
    const id = t.dataset.m, on = !state.sel.has(id);
    on ? state.sel.add(id) : state.sel.delete(id);
    t.setAttribute('aria-pressed', String(on));
    refresh();
  }));
  view.querySelectorAll('[data-group]').forEach(b => b.addEventListener('click', () => {
    const mods = MODULES.filter(m => m.kind === b.dataset.group), all = mods.every(m => state.sel.has(m.id));
    mods.forEach((m, i) => {
      all ? state.sel.delete(m.id) : state.sel.add(m.id);
      const t = view.querySelector(`.tile[data-m="${m.id}"]`);
      setTimeout(() => t.setAttribute('aria-pressed', String(!all)), reduced() ? 0 : i * 35); // ripple across the row
    });
    refresh();
  }));

  // ---- dropdown (listbox pattern)
  const dd = $('[data-dd]'), btn = dd.querySelector('.dd-btn'), list = dd.querySelector('.dd-list');
  const opts = () => [...list.querySelectorAll('[role="option"]')];
  const open = () => {
    // flip upward when the list would run past the bottom of the viewport
    const below = innerHeight - btn.getBoundingClientRect().bottom;
    dd.classList.toggle('up', below < list.offsetHeight + 24 && btn.getBoundingClientRect().top > below);
    dd.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    (opts().find(o => o.getAttribute('aria-selected') === 'true') || opts()[0]).focus();
  };
  const close = (focusBtn = true) => {
    dd.classList.remove('open'); btn.setAttribute('aria-expanded', 'false');
    if (focusBtn) btn.focus();
  };
  const choose = o => {
    state.count = +o.dataset.v;
    opts().forEach(x => x.setAttribute('aria-selected', String(x === o)));
    refresh(); close();
    btn.animate?.([{ transform: 'scale(.98)' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  };
  btn.addEventListener('click', () => dd.classList.contains('open') ? close() : open());
  btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } });
  list.addEventListener('click', e => { const o = e.target.closest('[role="option"]'); if (o) choose(o); });
  list.addEventListener('keydown', e => {
    const all = opts(), i = all.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); all[Math.min(all.length - 1, i + 1)].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); all[Math.max(0, i - 1)].focus(); }
    if (e.key === 'Home') { e.preventDefault(); all[0].focus(); }
    if (e.key === 'End') { e.preventDefault(); all.at(-1).focus(); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (i >= 0) choose(all[i]); }
    if (e.key === 'Escape' || e.key === 'Tab') close(e.key === 'Escape');
  });
  const outside = e => { if (!dd.contains(e.target) && dd.classList.contains('open')) close(false); };
  document.addEventListener('pointerdown', outside);

  // ---- switch
  const sw = $('[data-weak]');
  sw.addEventListener('click', () => { state.weakFirst = !state.weakFirst; sw.setAttribute('aria-checked', String(state.weakFirst)); refresh(); });

  $('[data-start]').addEventListener('click', () => onStart());
  refresh();
  return () => document.removeEventListener('pointerdown', outside);
}
