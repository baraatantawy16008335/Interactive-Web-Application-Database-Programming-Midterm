import * as w1 from './w-u1.js';
import * as w2 from './w-u2.js';
import * as w3 from './w-u3.js';
import * as w4 from './w-u4.js';
import * as w5 from './w-u5.js';

export const WIDGETS = { ...w1, ...w2, ...w3, ...w4, ...w5 };

function mountOne(el, cleanups) {
  if (el.dataset.mounted) return;
  el.dataset.mounted = '1';
  const fn = WIDGETS[el.dataset.widget];
  if (!fn) { el.innerHTML = `<div class="bench-body muted">Widget "${el.dataset.widget}" is missing.</div>`; return; }
  coalesceSliders(el);
  try {
    const c = fn(el);
    if (typeof c === 'function') cleanups.push(c);
    fitCharts(el);
    // widgets redraw their markup freely; re-apply the fit to whatever they draw next
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => { queued = false; fitCharts(el); });
    });
    mo.observe(el, { childList: true, subtree: true });
    cleanups.push(() => mo.disconnect());
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="bench-body muted">This simulator failed to load. The notes around it still apply.</div>`;
  }
}

// Wide charts (drawn on a ~720-unit canvas) would shrink their labels below a readable size
// on a phone. Each one gets a swipeable frame and a minimum width (set in CSS for narrow
// screens) so labels stay at least ~10.5 px.
function fitCharts(el) {
  el.querySelectorAll('svg.viz').forEach(svg => {
    const vbw = svg.viewBox?.baseVal?.width || 0;
    if (vbw < 440 || svg.parentElement.classList.contains('viz-scroll')) return;
    svg.style.setProperty('--minw', `${Math.round(vbw * 0.86)}px`);
    const wrap = document.createElement('div');
    wrap.className = 'viz-scroll';
    svg.replaceWith(wrap);
    wrap.appendChild(svg);
  });
}

// Sliders fire "input" far more often than the screen refreshes. Hold back all but the
// latest value until the next animation frame, so a drag redraws at most once per frame.
function coalesceSliders(el) {
  const pending = new Set();
  el.addEventListener('input', e => {
    const t = e.target;
    if (t.type !== 'range' || e.coalesced) return;
    e.stopImmediatePropagation();
    if (pending.has(t)) return;
    pending.add(t);
    requestAnimationFrame(() => {
      pending.delete(t);
      const ev = new Event('input', { bubbles: true });
      ev.coalesced = true;
      t.dispatchEvent(ev);
    });
  }, true);
}

// Simulators mount only when they come within ~1.5 screens of the viewport, so opening a
// module renders its text immediately and spreads the chart work across the scroll.
// The returned cleanup also has mountThrough(target): mounts every simulator up to and inside
// target first, so jumping to a section does not drift while charts above it appear.
export function mountWidgets(root) {
  const cleanups = [];
  const els = [...root.querySelectorAll('[data-widget]')];
  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      mountOne(en.target, cleanups);
    }), { rootMargin: '150% 0px 150% 0px' });
    els.forEach(el => io.observe(el));
  } else {
    els.forEach(el => mountOne(el, cleanups));
  }
  const api = () => { io?.disconnect(); cleanups.forEach(c => c()); };
  api.mountThrough = target => els.forEach(el => {
    if (target.contains(el) || el.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) { io?.unobserve(el); mountOne(el, cleanups); }
  });
  return api;
}
