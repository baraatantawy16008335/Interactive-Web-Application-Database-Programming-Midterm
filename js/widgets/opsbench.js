// Shared step-through simulator for index structures.
// opsBench(el, cfg) draws: a header, preset buttons, an input + operation buttons, the current drawing,
// and a step player (Previous / Next) that replays the steps an engine operation returned.
//
// cfg = {
//   icon, title, hint,                         // header + one-line instructions
//   presets: [{ label, make: () => state, note? }],   // starting structures (first one is loaded)
//   ops: [{ label, icon, run: (state, value) => ({ state | tree, steps }) }],
//   input: { label, placeholder, parse: str => value | throws Error('message') } | null,
//   draw: (state, hl) => svg string,           // hl = the step's highlight info
//   quick: [{ label, op: index into ops, value }],    // optional one-click examples (e.g. the lecture's)
//   info: state => html,                       // optional line under the drawing (e.g. n, limits)
//   id: 'u2-bp' (used for recordScore when a preset sequence is completed, optional)
// }
// Steps returned by the engines look like { text, kind: 'ok'|'warn'|'info', hl, tree|state }.
import { bench, esc } from '../viz.js';

const KIND = { ok: ['check-circle', 'var(--good)'], warn: ['warning', 'var(--accent)'], info: ['info', 'var(--muted)'] };

export function opsBench(el, cfg) {
  let preset = 0, state = cfg.presets[0].make(), steps = [], at = 0, history = [];
  const stateOf = s => s.tree || s.state;
  const render = () => {
    const step = steps[at], shown = step ? stateOf(step) : state;
    el.innerHTML = `${bench(cfg.icon || 'play', cfg.title, cfg.hintRight || '')}
    <div class="bench-body">
      ${cfg.hint ? `<p class="small muted" style="margin-bottom:10px">${cfg.hint}</p>` : ''}
      ${cfg.presets.length > 1 ? `<div class="chips" style="margin-bottom:10px">${cfg.presets.map((p, i) => `<button type="button" class="chip" data-preset="${i}" aria-pressed="${i === preset}">${p.label}</button>`).join('')}</div>` : ''}
      ${cfg.presets[preset].note ? `<p class="small" style="margin:-2px 0 10px">${cfg.presets[preset].note}</p>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
        ${cfg.input ? `<div class="field" style="max-width:170px;margin:0"><label for="ob-${cfg.id || 'x'}">${cfg.input.label || 'Key'}</label><input type="text" id="ob-${cfg.id || 'x'}" data-in placeholder="${esc(cfg.input.placeholder || '')}" autocomplete="off"></div>` : ''}
        ${cfg.ops.map((o, i) => `<button type="button" class="btn sm ${i === 0 ? 'primary' : ''}" data-op="${i}"><i class="ph ph-${o.icon || 'play'}"></i>${o.label}</button>`).join('')}
        <button type="button" class="btn sm ghost" data-undo ${history.length ? '' : 'disabled'}><i class="ph ph-arrow-u-up-left"></i>Undo</button>
        <button type="button" class="btn sm ghost" data-reset><i class="ph ph-arrow-counter-clockwise"></i>Reset</button>
      </div>
      ${cfg.quick && cfg.quick.length ? `<div class="chips" style="margin-top:10px"><span class="small muted" style="align-self:center">Try:</span>${cfg.quick.map((q, i) => `<button type="button" class="chip" data-quick="${i}">${q.label}</button>`).join('')}</div>` : ''}
      <div data-err class="small" style="color:var(--bad);min-height:0;margin-top:6px"></div>
      <div class="ob-stage" style="margin-top:8px;overflow-x:auto">${cfg.draw(shown, step ? step.hl : null)}</div>
      ${cfg.info ? `<div class="small muted" style="margin-top:6px">${cfg.info(shown)}</div>` : ''}
      ${step ? `<div class="callout" style="margin-top:10px;border-left:3px solid ${KIND[step.kind || 'info'][1]}"><i class="ph ph-${KIND[step.kind || 'info'][0]}" style="color:${KIND[step.kind || 'info'][1]}"></i><div><strong class="num">Step ${at + 1} of ${steps.length}.</strong> ${step.text}</div></div>
      <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
        <button type="button" class="btn sm" data-prev ${at ? '' : 'disabled'}><i class="ph ph-caret-left"></i>Previous</button>
        <button type="button" class="btn sm" data-next ${at < steps.length - 1 ? '' : 'disabled'}>Next<i class="ph ph-caret-right"></i></button>
        <button type="button" class="btn sm ghost" data-last ${at < steps.length - 1 ? '' : 'disabled'}>Jump to result</button>
      </div>` : ''}
    </div>`;
  };
  const apply = (opIdx, raw) => {
    const err = el.querySelector('[data-err]');
    let v = raw;
    if (cfg.input && raw === undefined) {
      const txt = el.querySelector('[data-in]').value.trim();
      try { v = cfg.input.parse ? cfg.input.parse(txt) : txt; } catch (e) { err.textContent = e.message; return; }
    }
    const r = cfg.ops[opIdx].run(state, v);
    history.push(state);
    state = r.tree || r.state;
    steps = r.steps || []; at = 0;
    render();
    const inp = el.querySelector('[data-in]'); if (inp) inp.focus();
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.preset) { preset = +b.dataset.preset; state = cfg.presets[preset].make(); steps = []; history = []; render(); }
    else if (b.dataset.op) apply(+b.dataset.op);
    else if (b.dataset.quick) { const q = cfg.quick[+b.dataset.quick]; apply(q.op, q.value); }
    else if ('reset' in b.dataset) { state = cfg.presets[preset].make(); steps = []; history = []; render(); }
    else if ('undo' in b.dataset) { state = history.pop(); steps = []; render(); }
    else if ('prev' in b.dataset) { at--; render(); }
    else if ('next' in b.dataset) { at++; render(); }
    else if ('last' in b.dataset) { at = steps.length - 1; render(); }
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-in]')) { e.preventDefault(); apply(0); } });
  render();
}

// Parse helpers for inputs
export const parseInt10 = s => { if (!/^-?\d+$/.test(s)) throw new Error('Type a whole number, e.g. 12.'); return +s; };
export const parseBits = (len = 4) => s => { if (!new RegExp(`^[01]{${len}}$`).test(s)) throw new Error(`Type a ${len}-bit hash value, e.g. ${'0101'.slice(0, len).padEnd(len, '0')}.`); return s; };
export const parsePoint = s => { const m = s.match(/^\(?\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)?$/); if (!m) throw new Error('Type a point as x, y (for example 52, 200).'); return [+m[1], +m[2]]; };
