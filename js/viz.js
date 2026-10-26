// Small helpers shared by every widget: DOM, scales, stats, SVG pieces.

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function html(strings, ...vals) {
  return strings.reduce((acc, s, i) => acc + s + (i < vals.length ? (Array.isArray(vals[i]) ? vals[i].join('') : vals[i] ?? '') : ''), '');
}

export function mount(el, markup) { el.innerHTML = markup; return el; }
export const $ = (root, sel) => root.querySelector(sel);
export const $$ = (root, sel) => [...root.querySelectorAll(sel)];

export function on(root, sel, type, fn) {
  root.addEventListener(type, e => {
    const t = e.target.closest(sel);
    if (t && root.contains(t)) fn(e, t);
  });
}

export const scale = (d0, d1, r0, r1) => {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return v => r0 + (v - d0) * k;
};

export function niceTicks(min, max, count = 5) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

export const fmt = (v, d = 2) => {
  if (v === null || v === undefined || Number.isNaN(v)) return 'NaN';
  const r = +(+v).toFixed(d);
  return r.toLocaleString('en-US', { maximumFractionDigits: d });
};

// ---------- statistics ----------
export const sum = a => a.reduce((s, v) => s + v, 0);
export const mean = a => (a.length ? sum(a) / a.length : NaN);
export const sorted = a => [...a].sort((x, y) => x - y);
export function median(a) {
  if (!a.length) return NaN;
  const s = sorted(a), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function modes(a) {
  const c = new Map();
  a.forEach(v => c.set(v, (c.get(v) || 0) + 1));
  const max = Math.max(...c.values());
  if (max <= 1) return [];
  const m = [...c].filter(([, n]) => n === max).map(([v]) => v);
  return m.length === c.size ? [] : m;
}
export function variance(a, sample = false) {
  const m = mean(a);
  return sum(a.map(v => (v - m) ** 2)) / (a.length - (sample ? 1 : 0));
}
export const std = (a, sample = false) => Math.sqrt(variance(a, sample));
// Linear interpolation, the same rule pandas .quantile() uses by default.
export function quantile(a, q) {
  const s = sorted(a), pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
export function fiveNum(a) {
  return { min: Math.min(...a), q1: quantile(a, .25), med: quantile(a, .5), q3: quantile(a, .75), max: Math.max(...a) };
}
export function skewness(a) {
  const m = mean(a), sd = std(a);
  return sum(a.map(v => ((v - m) / sd) ** 3)) / a.length;
}
export function pearson(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  let n = 0, dx = 0, dy = 0;
  xs.forEach((x, i) => { n += (x - mx) * (ys[i] - my); dx += (x - mx) ** 2; dy += (ys[i] - my) ** 2; });
  return n / Math.sqrt(dx * dy);
}

// Deterministic random so demos look the same on every visit.
export function rng(seed = 7) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function normal(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ---------- SVG building blocks ----------
export function xAxis(x, ticks, y, fmtFn = v => fmt(v, 2)) {
  return `<g class="axis">${ticks.map(t => `<line x1="${x(t)}" x2="${x(t)}" y1="${y}" y2="${y + 5}"/><text x="${x(t)}" y="${y + 18}" text-anchor="middle">${fmtFn(t)}</text>`).join('')}</g>`;
}
export function yGrid(y, ticks, x0, x1, fmtFn = v => fmt(v, 2)) {
  return `<g class="grid">${ticks.map(t => `<line x1="${x0}" x2="${x1}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>
  <g>${ticks.map(t => `<text x="${x0 - 8}" y="${y(t) + 4}" text-anchor="end">${fmtFn(t)}</text>`).join('')}</g>`;
}

export function boxplotSVG({ data, x, y, h = 26, color = 'var(--accent-viz)', k = 1.5, showOutliers = true }) {
  const f = fiveNum(data), iqr = f.q3 - f.q1;
  const lo = Math.min(...data.filter(v => v >= f.q1 - k * iqr)), hi = Math.max(...data.filter(v => v <= f.q3 + k * iqr));
  const outs = data.filter(v => v < f.q1 - k * iqr || v > f.q3 + k * iqr);
  return `<g>
    <line x1="${x(lo)}" x2="${x(f.q1)}" y1="${y}" y2="${y}" stroke="var(--ink-2)"/>
    <line x1="${x(f.q3)}" x2="${x(hi)}" y1="${y}" y2="${y}" stroke="var(--ink-2)"/>
    <line x1="${x(lo)}" x2="${x(lo)}" y1="${y - h / 3}" y2="${y + h / 3}" stroke="var(--ink-2)"/>
    <line x1="${x(hi)}" x2="${x(hi)}" y1="${y - h / 3}" y2="${y + h / 3}" stroke="var(--ink-2)"/>
    <rect x="${x(f.q1)}" y="${y - h / 2}" width="${Math.max(1, x(f.q3) - x(f.q1))}" height="${h}" rx="3" fill="color-mix(in srgb, ${color} 18%, transparent)" stroke="${color}" stroke-width="1.5"/>
    <line x1="${x(f.med)}" x2="${x(f.med)}" y1="${y - h / 2}" y2="${y + h / 2}" stroke="${color}" stroke-width="3"/>
    ${showOutliers ? outs.map(v => `<circle cx="${x(v)}" cy="${y}" r="3.5" fill="none" stroke="var(--bad)" stroke-width="1.5"/>`).join('') : ''}
  </g>`;
}

export function histogram(data, bins, lo, hi) {
  const w = (hi - lo) / bins, counts = Array(bins).fill(0);
  data.forEach(v => { let i = Math.floor((v - lo) / w); if (i === bins) i--; if (i >= 0 && i < bins) counts[i]++; });
  return counts.map((c, i) => ({ x0: lo + i * w, x1: lo + (i + 1) * w, c }));
}

export function bench(icon, title, hint = '') {
  return `<div class="bench-head"><i class="ph ph-${icon}"></i><h3>${title}</h3>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
}

export function seg(options, active, attr = 'data-v') {
  return `<div class="seg" role="group">${options.map(o => {
    const [v, label] = Array.isArray(o) ? o : [o, o];
    return `<button type="button" ${attr}="${v}" aria-pressed="${v === active}">${label}</button>`;
  }).join('')}</div>`;
}
export function setSeg(segEl, v, attr = 'data-v') {
  segEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === String(v))));
}

export function tween(from, to, dur, step, done) {
  if (reduced()) { step(to); done && done(); return () => {}; }
  const t0 = performance.now(); let raf;
  const ease = t => 1 - Math.pow(1 - t, 4);
  const frame = now => {
    const t = Math.min(1, (now - t0) / dur);
    step(from + (to - from) * ease(t));
    if (t < 1) raf = requestAnimationFrame(frame); else done && done();
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
