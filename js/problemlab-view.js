// Problem lab: build a structure on paper, spot the wrong step in a worked solution, calculate, and explain.
// The midterm asks you to draw indices after operations, estimate sizes and reason about plans; this page drills all of it.
// Data lives in js/content/problems.js. Scores are stored under 'code-<id>' so the stats keep working.
import { CODE } from './content/problems.js';
import { byId } from './modules.js';
import { getState, recordScore } from './store.js';
import { esc } from './viz.js';

const KINDS = {
  build: ['tree-structure', 'Build it'],
  calc: ['calculator', 'Calculate'],
  fix: ['magnifying-glass', 'Spot the wrong step'],
  explain: ['chat-text', 'Explain'],
};
const SELF = k => k === 'explain' || k === 'build'; // self-marked kinds: scratch space, then reveal

const lines = src => src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
const mono = src => esc(src.replace(/^\n/, '').replace(/\s+$/, ''));
const fmtNum = v => Number(v).toLocaleString('en-US', { maximumFractionDigits: 4 });
const parseNum = s => { const t = String(s).replace(/[\s,%$]/g, '').replace(/[−–]/g, '-'); return /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(t) ? parseFloat(t) : NaN; };
const within = (x, a) => Number.isFinite(x) && Math.abs(x - a.value) <= (a.rel ? Math.abs(a.value) * a.tol : a.tol) + 1e-9;
const labelOf = a => `${a.label}${a.unit ? ` (${a.unit})` : ''}`;

function codeLines(src, cls = {}) {
  return `<pre class="code cl-code">${lines(src).map((l, i) => `<span class="cl-line ${cls[i + 1] || ''}" data-ln="${i + 1}"><span class="cl-n">${i + 1}</span>${esc(l) || ' '}</span>`).join('')}</pre>`;
}

function statusHTML(it) {
  const done = getState().scores['code-' + it.id];
  return done ? `<span class="${done.right ? 'hl' : ''}">${done.right ? 'Solved' : 'Reviewed'}</span> · ` : '';
}

function itemHTML(it, n) {
  const [icon, label] = KINDS[it.kind];
  const mod = byId[it.m];
  const id = it.id;
  return `<article class="bench cl-item" id="cl-${id}" data-id="${id}" data-n="${n}">
    <div class="bench-head"><i class="ph ph-${icon}"></i><h3>${n}. ${it.title}</h3>
      <span class="hint" data-status>${statusHTML(it)}${label}</span></div>
    <div class="bench-body">
      <div class="chips" style="margin-bottom:12px">${mod ? `<a class="chip accent" href="#/m/${mod.id}">${mod.num}</a>` : ''}<span class="chip">${it.topic}</span></div>
      <div class="prose"><p>${it.prompt}</p></div>
      ${it.data ? `<div style="margin-top:12px">${it.data}</div>` : ''}
      ${it.code ? `<div data-code style="margin-top:12px">${codeLines(it.code)}</div>` : ''}
      ${it.kind === 'fix' ? `<p class="small muted" data-hint style="margin-top:8px">Tap the line${it.bugLines.length > 1 ? 's' : ''} you think ${it.bugLines.length > 1 ? 'are' : 'is'} wrong (${it.bugLines.length} to find), then check.</p>` : ''}
      ${it.kind === 'calc' ? `<div class="cl-fields" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:14px">${it.answers.map((a, i) => `<div class="field"><label for="in-${id}-${i}">${esc(labelOf(a))}</label><input type="text" inputmode="decimal" autocomplete="off" class="num-in" id="in-${id}-${i}" data-i="${i}" placeholder="Your answer"></div>`).join('')}</div>` : ''}
      ${SELF(it.kind) ? `<div class="field" style="margin-top:14px"><label for="in-${id}">Your answer (scratch space)</label><textarea id="in-${id}" rows="${it.kind === 'build' ? 4 : 6}" placeholder="${it.kind === 'build' ? 'Draw it on paper first. Note the key steps here (splits, merges, bits used)' : 'Write it as you would in the exam'}"></textarea></div>` : ''}
      <div class="cl-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        ${it.kind === 'fix' ? `<button class="btn primary sm" data-act="check"><i class="ph ph-check"></i>Check my lines</button>` : ''}
        ${it.kind === 'calc' ? `<button class="btn primary sm" data-act="check"><i class="ph ph-check"></i>Check</button><button class="btn sm" data-act="reveal"><i class="ph ph-eye"></i>Reveal</button>` : ''}
        ${SELF(it.kind) ? `<button class="btn primary sm" data-act="reveal"><i class="ph ph-eye"></i>Reveal the model answer</button>` : ''}
      </div>
      <div data-out aria-live="polite"></div>
    </div>
  </article>`;
}

function solutionHTML(it) {
  const marks = `<div class="cl-marks" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><span class="small muted" style="align-self:center">Mark yourself:</span><button class="btn sm" data-act="got"><i class="ph ph-check"></i>I got it</button><button class="btn sm" data-act="miss"><i class="ph ph-x"></i>I missed it</button></div>`;
  return { marks };
}

function outputHTML(it, { verdict = '', marks = false } = {}) {
  const answerLabel = it.kind === 'fix' ? 'Corrected solution' : it.kind === 'calc' ? 'Worked solution' : it.kind === 'build' ? 'Answer' : 'Model answer';
  const body = (it.answerHtml ? `<div class="tiny muted" style="margin:12px 0 -6px;font-family:var(--mono)">${answerLabel}</div><div class="prose cl-answer" style="margin-top:12px">${it.answerHtml}</div>` : '')
    + (it.answer ? `<div class="tiny muted" style="margin:12px 0 -6px;font-family:var(--mono)">${it.answerHtml ? 'Working' : answerLabel}</div><pre class="code">${mono(it.answer)}</pre>` : '');
  return `${verdict}
    ${it.why ? `<div class="callout key" style="margin-top:12px"><i class="ph ph-lightbulb"></i><div class="prose">${it.why}</div></div>` : ''}
    ${body}
    ${it.checklist ? `<div class="prose" style="margin-top:14px"><p class="small"><strong>A grader looks for:</strong></p><ul class="small">${it.checklist.map(c => `<li>${c}</li>`).join('')}</ul></div>` : ''}
    ${marks ? solutionHTML(it).marks : ''}`;
}

function refresh(view, card, it) {
  const s = card.querySelector('[data-status]');
  if (s) s.innerHTML = `${statusHTML(it)}${KINDS[it.kind][1]}`;
  const c = view.querySelector('[data-solved]');
  if (c) c.textContent = CODE.filter(x => getState().scores['code-' + x.id]?.right).length;
}

function check(view, card, it) {
  const out = card.querySelector('[data-out]');
  if (it.kind === 'fix') {
    const picked = [...card.querySelectorAll('.cl-line.pick')].map(l => +l.dataset.ln);
    const cls = {};
    it.bugLines.forEach(n => cls[n] = 'bug');
    picked.forEach(n => cls[n] = it.bugLines.includes(n) ? 'hit' : 'miss');
    card.querySelector('[data-code]').innerHTML = codeLines(it.code, cls);
    const hits = picked.filter(n => it.bugLines.includes(n)).length, extra = picked.length - hits;
    const ok = hits === it.bugLines.length && extra === 0;
    const verdict = `<p class="small" style="margin-top:10px"><strong class="${ok ? 'hl' : ''}">${ok ? (it.bugLines.length > 1 ? 'You found every wrong line.' : 'You found the wrong line.') : `You found ${hits} of ${it.bugLines.length}${extra ? `, plus ${extra} line${extra > 1 ? 's' : ''} that ${extra > 1 ? 'were' : 'was'} fine` : ''}.`}</strong> Red = wrong${it.bugLines.length > 1 ? ' lines' : ' line'}.</p>`;
    recordScore('code-' + it.id, ok ? 1 : 0, 1);
    card.querySelector('[data-hint]')?.remove();
    out.innerHTML = outputHTML(it, { verdict }) + `<div style="margin-top:10px"><button class="btn sm" data-act="retry"><i class="ph ph-arrow-counter-clockwise"></i>Try again</button></div>`;
    card.querySelector('[data-act="check"]').remove();
    refresh(view, card, it);
    return;
  }
  // calc
  const inputs = [...card.querySelectorAll('input[data-i]')];
  const vals = inputs.map(i => parseNum(i.value));
  if (inputs.some((i, k) => !i.value.trim() || !Number.isFinite(vals[k]))) {
    out.innerHTML = `<p class="small" style="margin-top:10px;color:var(--bad)">Type a number in every box (or press Reveal to see the solution).</p>`;
    inputs.forEach((i, k) => { if (!i.value.trim() || !Number.isFinite(vals[k])) i.setAttribute('aria-invalid', 'true'); });
    return;
  }
  let right = 0;
  inputs.forEach((inp, k) => {
    const a = it.answers[k], ok = within(vals[k], a);
    if (ok) right++;
    inp.disabled = true;
    inp.removeAttribute('aria-invalid');
    inp.style.borderColor = ok ? 'var(--good)' : 'var(--bad)';
    inp.style.background = ok ? 'var(--good-soft)' : 'var(--bad-soft)';
    inp.closest('.field').insertAdjacentHTML('beforeend', `<span class="small" style="color:var(${ok ? '--good' : '--bad'})">${ok ? 'Correct' : `Not quite, expected ${fmtNum(a.value)}${a.unit === '%' ? '%' : ''}`}</span>`);
  });
  const all = right === inputs.length;
  recordScore('code-' + it.id, all ? 1 : 0, 1);
  const verdict = `<p class="small" style="margin-top:10px"><strong class="${all ? 'hl' : ''}">${all ? 'All correct.' : `${right} of ${inputs.length} correct.`}</strong> ${all ? '' : 'Compare with the worked solution below.'}</p>`;
  out.innerHTML = outputHTML(it, { verdict }) + `<div style="margin-top:10px"><button class="btn sm" data-act="retry"><i class="ph ph-arrow-counter-clockwise"></i>Try again</button></div>`;
  card.querySelector('.cl-actions').remove();
  refresh(view, card, it);
}

function reveal(card, it) {
  const out = card.querySelector('[data-out]');
  let verdict = '';
  if (it.kind === 'calc') {
    verdict = `<div class="chips" style="margin-top:12px">${it.answers.map(a => `<span class="chip accent">${esc(a.label)}: <span class="num">${fmtNum(a.value)}${a.unit === '%' ? '%' : a.unit ? ' ' + esc(a.unit) : ''}</span></span>`).join('')}</div>`;
    card.querySelectorAll('input[data-i]').forEach(i => i.disabled = true);
  }
  out.innerHTML = outputHTML(it, { verdict, marks: true });
  card.querySelector('.cl-actions').remove();
}

export function renderProblemLab(view, params) {
  let kind = params.get('k') || 'all', mod = params.get('m') || 'all', topic = params.get('t') || 'all';
  const mods = [...new Set(CODE.map(c => c.m))].filter(m => byId[m]);
  const topics = [...new Set(CODE.map(c => c.topic))].sort();
  const render = () => {
    const list = CODE.filter(c => (kind === 'all' || c.kind === kind) && (mod === 'all' || c.m === mod) && (topic === 'all' || c.topic === topic));
    const solved = CODE.filter(c => getState().scores['code-' + c.id]?.right).length;
    view.innerHTML = `<h1>Problem lab</h1>
      <p class="lede" style="margin-top:10px">The midterm (25% of the grade) asks you to <strong>draw indices after operations</strong>, <strong>estimate sizes</strong> and <strong>reason about plans</strong>. Work each problem on paper first, then check or reveal. Filter the topic to <strong>Midterm 2025</strong> to sit last year's exam. <span class="num"><span data-solved>${solved}</span>/${CODE.length}</span> solved so far.</p>
      <div class="controls" style="margin-top:18px">
        <div class="seg" role="group" aria-label="Problem type">${[['all', 'All'], ...Object.entries(KINDS).map(([k, [, l]]) => [k, l])].map(([k, l]) => `<button data-k="${k}" aria-pressed="${kind === k}">${l} <span class="num">${k === 'all' ? CODE.length : CODE.filter(c => c.kind === k).length}</span></button>`).join('')}</div>
        <div class="field" style="max-width:260px"><label for="clm">Module</label><select id="clm"><option value="all">All modules</option>${mods.map(m => `<option value="${m}" ${mod === m ? 'selected' : ''}>${byId[m].num}: ${byId[m].title}</option>`).join('')}</select></div>
        <div class="field" style="max-width:220px"><label for="clt">Topic</label><select id="clt"><option value="all">All topics</option>${topics.map(t => `<option ${topic === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      </div>
      <div style="display:grid;gap:18px;margin-top:22px">${list.map((it, i) => itemHTML(it, i + 1)).join('') || `<div class="empty"><i class="ph ph-funnel"></i>No problems match.</div>`}</div>`;
  };
  view.onclick = e => {
    const k = e.target.closest('[data-k]');
    if (k) { kind = k.dataset.k; render(); return; }
    const card = e.target.closest('.cl-item'); if (!card) return;
    const it = CODE.find(c => c.id === card.dataset.id);
    const line = e.target.closest('.cl-line');
    if (line && it.kind === 'fix' && card.querySelector('[data-act="check"]')) { line.classList.toggle('pick'); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'check') check(view, card, it);
    if (act === 'reveal') reveal(card, it);
    if (act === 'retry') { card.outerHTML = itemHTML(it, +card.dataset.n); }
    if (act === 'got' || act === 'miss') {
      recordScore('code-' + it.id, act === 'got' ? 1 : 0, 1);
      e.target.closest('.cl-marks').innerHTML = `<span class="small ${act === 'got' ? 'hl' : 'muted'}">${act === 'got' ? 'Marked as solved.' : 'Marked for review. Try it again tomorrow morning.'}</span>`;
      refresh(view, card, it);
    }
  };
  view.onchange = e => { if (e.target.id === 'clm') { mod = e.target.value; render(); } if (e.target.id === 'clt') { topic = e.target.value; render(); } };
  view.onkeydown = e => {
    if (e.key === 'Enter' && e.target.matches('input[data-i]')) { const card = e.target.closest('.cl-item'); if (card && card.querySelector('[data-act="check"]')) check(view, card, CODE.find(c => c.id === card.dataset.id)); }
  };
  render();
  return () => { view.onkeydown = null; };
}
