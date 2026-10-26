// Motion helpers. Each one is a no-op (or instant) under prefers-reduced-motion.
import { reduced, tween } from './viz.js';

const canTransition = () => !!document.startViewTransition && !reduced() && !document.hidden;

// Logo: bars and trend line replay on hover, focus or touch.
export function initBrand() {
  const mark = document.getElementById('brandMark');
  if (!mark) return;
  const brand = mark.closest('.brand');
  // the intro (grow + draw) runs once on load; afterwards the mark sits still until played
  setTimeout(() => mark.classList.add('ready'), 2100);
  const play = () => {
    if (reduced() || !mark.classList.contains('ready') && !mark.classList.contains('play')) return;
    mark.classList.remove('ready', 'play');
    void mark.getBoundingClientRect();
    mark.classList.add('play');
  };
  brand.addEventListener('mouseenter', play);
  brand.addEventListener('focus', play);
  brand.addEventListener('touchstart', play, { passive: true });
  mark.addEventListener('animationend', e => {
    if (e.target.classList.contains('bm-ring')) { mark.classList.remove('play'); mark.classList.add('ready'); }
  });
}

// Sidebar: a pill that slides from the previous page's link to the current one.
let indTop = null;
export function placeIndicator(nav) {
  const cur = nav.querySelector('[aria-current="page"]');
  const ind = document.createElement('div');
  ind.className = 'nav-indicator';
  nav.prepend(ind);
  nav.classList.add('has-ind');
  if (!cur) { ind.style.opacity = 0; return; }
  const top = cur.offsetTop, h = cur.offsetHeight;
  ind.style.height = h + 'px';
  if (indTop === null || indTop === top || reduced()) {
    ind.style.transform = `translateY(${top}px)`;
  } else {
    ind.style.transition = 'none';
    ind.style.transform = `translateY(${indTop}px)`;
    void ind.offsetHeight;
    ind.style.transition = '';
    ind.style.transform = `translateY(${top}px)`;
  }
  indTop = top;
}

// Scroll reveals: content rises into place as it enters the viewport, staggered per batch.
const REVEAL = [
  '.hero > div > *', '.course-map', '.stats-row', '.section-head', '.weak-list', '.mcard', '.plan > div',
  '.mod-head > div > *', '.sec > *', '.pager > a',
  '#view > h1', '#view > .lede', '#view > .controls', '.quiz-shell > *', '.fc-stage', '.fc-actions', '.cheat-card', '.gloss-item',
].join(',');
let io = null;
export function reveal(root) {
  io?.disconnect();
  const els = [...root.querySelectorAll(REVEAL)];
  if (reduced() || !('IntersectionObserver' in window)) { els.forEach(introBench); return; }
  els.forEach(el => el.classList.add('reveal'));
  io = new IntersectionObserver(entries => {
    let k = 0;
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.style.setProperty('--d', Math.min(k++, 6));
      el.classList.add('in');
      io.unobserve(el);
      if (el.matches('.bench')) introBench(el);
      el.querySelectorAll?.('.bench').forEach(introBench);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach(el => io.observe(el));
}

// Charts inside a simulator draw themselves (bars rise, dots pop) the first time they are seen.
function introBench(b) {
  if (reduced() || b.dataset.intro) return;
  b.dataset.intro = '1';
  b.querySelectorAll('.viz rect, .viz circle').forEach((n, i) => n.style.setProperty('--k', i % 40));
  b.classList.add('intro');
  setTimeout(() => b.classList.remove('intro'), 1800);
}

// Pause looping animations (the course-map data flow) while they are off screen.
export function pauseOffscreen(el) {
  if (!el || !('IntersectionObserver' in window)) return () => {};
  const o = new IntersectionObserver(([e]) => el.classList.toggle('offscreen', !e.isIntersecting));
  o.observe(el);
  return () => o.disconnect();
}

// Home stats count up from zero.
export function countUp(root) {
  if (reduced()) return;
  root.querySelectorAll('.stat .v').forEach(v => {
    const n = v.firstChild;
    const m = n && n.nodeType === 3 && n.textContent.match(/^(\d+)(%?)$/);
    if (!m || +m[1] === 0) return;
    tween(0, +m[1], 1100, x => { n.textContent = Math.round(x) + m[2]; });
  });
}

// Module cards: spotlight follows the pointer (desktop pointers only).
export function spotlight(root) {
  if (!matchMedia('(hover: hover)').matches) return;
  root.addEventListener('pointermove', e => {
    const c = e.target.closest('.mcard');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
}

// Topbar shadow appears once the page scrolls under it.
export function topbarShadow() {
  const s = document.createElement('div');
  s.setAttribute('aria-hidden', 'true');
  s.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none';
  document.body.prepend(s);
  new IntersectionObserver(([e]) => document.querySelector('.topbar').classList.toggle('scrolled', !e.isIntersecting)).observe(s);
}

// Page change: the new page fades up while sidebar and topbar stay put.
export function pageTransition(update) {
  if (!canTransition()) { update(false); return; }
  let ran = false;
  const t = document.startViewTransition(() => { ran = true; update(true); });
  // a newer navigation can skip this one; that is expected, not an error
  [t.ready, t.finished, t.updateCallbackDone].forEach(p => p?.catch(() => {}));
  guard(t, () => ran);
}

// If the browser never gets a frame to capture (e.g. a throttled or hidden view), skipping the
// transition still runs the update, so content never waits on an animation.
function guard(t, ran) {
  setTimeout(() => { if (!ran()) t.skipTransition?.(); }, 400);
}

// Theme change: the new theme grows as a circle from the toggle button.
export function themeTransition(btn, apply) {
  if (!canTransition()) { apply(); return; }
  const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const html = document.documentElement;
  html.dataset.vt = 'theme';
  let ran = false;
  const t = document.startViewTransition(() => { ran = true; apply(); });
  guard(t, () => ran);
  t.ready.then(() => html.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] },
    { duration: 700, easing: 'cubic-bezier(.16, 1, .3, 1)', pseudoElement: '::view-transition-new(root)' },
  )).catch(() => {});
  t.updateCallbackDone?.catch(() => {});
  t.finished.catch(() => {}).finally(() => delete html.dataset.vt);
}

// Flashcard rating: the card leaves toward the side you chose, the next one slides in.
export function swapCard(stage, known, next) {
  if (!stage || reduced()) { next(); return; }
  stage.animate(
    [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${known ? 70 : -70}px) rotate(${known ? 5 : -5}deg)` }],
    { duration: 230, easing: 'cubic-bezier(.7, 0, .84, 0)' },
  ).finished.then(() => {
    next();
    document.querySelector('.fc-stage')?.animate(
      [{ opacity: 0, transform: `translateX(${known ? -28 : 28}px) scale(.97)` }, { opacity: 1, transform: 'none' }],
      { duration: 420, easing: 'cubic-bezier(.16, 1, .3, 1)' },
    );
  });
}
