// Lecture 1 & 2 widgets, plus the shared "sorter" classification game.
import { bench, $, $$, on, seg, setSeg, scale, fmt, esc } from '../viz.js';
import { recordScore } from '../store.js';

// A classification game: every item gets one of N labels, feedback explains why.
export function sorter(el, { id, icon = 'list-checks', title, hint = 'Pick a label for each card', options, items, cols }) {
  const state = {};
  const render = () => {
    const done = Object.keys(state).length, right = items.filter((it, i) => state[i] === it.a).length;
    el.innerHTML = `${bench(icon, title, `<span class="num">${right}/${items.length}</span> correct`)}
    <div class="bench-body">
      <p class="small muted" style="margin-bottom:12px">${hint}</p>
      <div class="sort-grid" ${cols ? `style="grid-template-columns:repeat(auto-fill,minmax(${cols}px,1fr))"` : ''}>
        ${items.map((it, i) => {
          const a = state[i], cls = a === undefined ? '' : a === it.a ? 'right' : 'wrong';
          return `<div class="sort-item ${cls}">
            <div>${it.t}</div>
            ${a === undefined
              ? `<div class="opts">${options.map(o => `<button type="button" data-i="${i}" data-o="${esc(o)}">${o}</button>`).join('')}</div>`
              : `<div class="why"><strong>${it.a}.</strong> ${a !== it.a ? `You said ${a}. ` : ''}${it.why || ''}</div>`}
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:14px">
        <button class="btn sm" data-reset><i class="ph ph-arrow-counter-clockwise"></i>Reset</button>
        ${done === items.length ? `<span class="small ${right === items.length ? 'hl' : 'muted'}">${right === items.length ? 'Perfect run.' : `Review the red cards, then reset and try again.`}</span>` : ''}
      </div>
    </div>`;
  };
  on(el, '[data-o]', 'click', (e, b) => {
    state[+b.dataset.i] = b.dataset.o;
    if (Object.keys(state).length === items.length && id) recordScore(id, items.filter((it, i) => state[i] === it.a).length, items.length);
    render();
  });
  on(el, '[data-reset]', 'click', () => { Object.keys(state).forEach(k => delete state[k]); render(); });
  render();
}

