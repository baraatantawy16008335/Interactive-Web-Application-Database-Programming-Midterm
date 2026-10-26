// Unit 1 simulators: RDBMS storage and conventional indices (Lecture 1, PA1, midterm 2025 Ex 1-2).
import { bench, $, $$, on, seg, setSeg, esc, fmt } from '../viz.js';
import { opsBench, parseInt10 } from './opsbench.js';
import { sorter } from './sorter.js';
import { recordScore } from '../store.js';
import { bitmap, bitAnd, bitOr } from '../engine/multidim.js';

// ============================================================ pure logic (tested in tests/u1.test.js)
// <logic>
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const ceilDiv = (a, b) => Math.ceil(a / b);
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
const cap1 = s => { s = String(s).trim(); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); };

// Binary search over sorted pages (arrays of keys). Reads a probed page, compares with its first and last key.
// Returns the leftmost page that can hold `key`, the pages read, and whether the key lies inside a page range.
function seek(pages, key) {
  let lo = 0, hi = pages.length - 1, at = -1; const probes = [];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1; probes.push(mid);
    const pg = pages[mid], f = pg[0], l = pg[pg.length - 1];
    if (cmp(key, f) < 0) hi = mid - 1; else if (cmp(key, l) > 0) lo = mid + 1; else { at = mid; break; }
  }
  if (at < 0) return { probes, page: pages.length ? Math.max(0, Math.min(lo - 1, pages.length - 1)) : 0, inside: false, back: [] };
  const back = [];
  while (at > 0 && cmp(pages[at][0], key) === 0 && cmp(pages[at - 1][pages[at - 1].length - 1], key) === 0) { at--; back.push(at); }
  return { probes, page: at, inside: true, back };
}
// Rows equal to key, starting at the leftmost page; reads following pages while a page ends with the key.
function findAll(pages, key) {
  const s = seek(pages, key), reads = [...s.probes, ...s.back], rows = [];
  if (!s.inside) return { ...s, reads, rows, pagesWithKey: [] };
  let p = s.page; const pagesWithKey = [];
  for (;;) {
    if (!reads.includes(p)) reads.push(p);
    const n = pages[p].filter(k => cmp(k, key) === 0).length;
    if (n) { pagesWithKey.push(p); for (let i = 0; i < n; i++) rows.push(p); }
    if (p + 1 < pages.length && cmp(pages[p][pages[p].length - 1], key) === 0) p++; else break;
  }
  return { ...s, reads, rows, pagesWithKey };
}
// Insert into a sorted paged file. Full pages push their largest row into the next page (cascade).
function insertSorted(pages0, key, cap) {
  const pages = pages0.map(p => [...p]); const s = seek(pages, key);
  const reads = [...s.probes, ...s.back], writes = []; let p = s.page;
  if (!pages.length) { pages.push([key]); return { pages, reads, writes: [0], page: 0, moved: [], newPage: true }; }
  let carry = key, first = true, moved = [], newPage = false;
  for (;;) {
    const pg = pages[p];
    if (first) { let i = pg.findIndex(k => cmp(k, carry) > 0); if (i < 0) i = pg.length; pg.splice(i, 0, carry); first = false; }
    else pg.unshift(carry);
    if (!reads.includes(p)) reads.push(p);
    writes.push(p);
    if (pg.length <= cap) break;
    carry = pg.pop(); moved.push({ key: carry, from: p, to: p + 1 });
    if (p + 1 >= pages.length) { pages.push([]); newPage = true; }
    p++;
  }
  return { pages, reads, writes, page: s.page, moved, newPage };
}
// Delete the first row equal to key. compact=true shifts later rows up so no hole is left.
function deleteSorted(pages0, key, cap, compact) {
  let pages = pages0.map(p => [...p]); const f = findAll(pages, key);
  if (!f.rows.length) return { pages, reads: f.reads, writes: [], found: false, page: -1 };
  const reads = [...f.reads], writes = []; let p = f.pagesWithKey[0];
  const i = pages[p].findIndex(k => cmp(k, key) === 0); pages[p].splice(i, 1); writes.push(p);
  if (compact) {
    for (let q = p; q + 1 < pages.length; q++) {
      if (pages[q].length >= cap) break;
      pages[q].push(pages[q + 1].shift()); if (!reads.includes(q + 1)) reads.push(q + 1); if (!writes.includes(q + 1)) writes.push(q + 1);
    }
  }
  const before = pages.length; pages = pages.filter(pg => pg.length);
  return { pages, reads, writes, found: true, page: p, dropped: before - pages.length };
}

// ---- derived conventional indices (entries are {k, p}: key and 0-based table page)
const denseAll = pages => pages.flatMap((pg, p) => pg.map(k => ({ k, p })));                        // one pair per row
const denseFirst = pages => { const seen = new Set(), o = []; pages.forEach((pg, p) => pg.forEach(k => { if (!seen.has(k)) { seen.add(k); o.push({ k, p }); } })); return o; };  // duplicates approach 2
const sparseMin = pages => pages.map((pg, p) => ({ k: pg[0], p })).filter(e => e.k !== undefined);  // one pair per page (minimum)
function pageNew(pages) {                                                                        // duplicates approach 3 (slide 39c): first value that is new on the page
  return pages.map((pg, p) => {
    const prev = p ? pages[p - 1][pages[p - 1].length - 1] : undefined;
    const nv = pg.find(k => prev === undefined || cmp(k, prev) > 0);
    return { k: nv !== undefined ? nv : pg[0], p };
  });
}
const secondaryAll = pages => denseAll(pages).sort((a, b) => cmp(a.k, b.k) || a.p - b.p);
const packEntries = (entries, per) => chunk(entries, per);

// ---- multilevel index sizes. Level 1 sits next to the table; every higher level is sparse.
function levelsOf(n, r, p, dense) {
  const tablePages = ceilDiv(n, r), L = []; let entries = dense ? n : tablePages, pages = ceilDiv(entries, p);
  L.push({ entries, pages });
  while (pages > 1) { entries = pages; pages = ceilDiv(entries, p); L.push({ entries, pages }); }
  return { tablePages, levels: L, total: L.reduce((s, l) => s + l.pages, 0) };
}
// Keep the top levels in memory while they fit; every other level costs one disk read, plus one table page.
function lookupIO(lv, mem) {
  let used = 0, inMem = 0;
  for (let i = lv.levels.length - 1; i >= 0; i--) { if (used + lv.levels[i].pages <= mem) { used += lv.levels[i].pages; inMem++; } else break; }
  return { inMem, disk: lv.levels.length - inMem + 1, memUsed: used };
}
// ---- BRIN
const brinOf = pages => pages.map((pg, i) => ({ p: i, min: Math.min(...pg), max: Math.max(...pg) }));
function brinQuery(pages, lo, hi) {
  return brinOf(pages).map(e => {
    const overlap = e.max >= lo && e.min <= hi, matches = pages[e.p].filter(v => v >= lo && v <= hi).length;
    return { ...e, read: overlap, matches, wasted: overlap && !matches };
  });
}
// </logic>

// ============================================================ shared drawing and UI pieces
const CSS = `<style>
.bench .cards{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}
.bench .pgc{border:1.5px solid var(--line-strong);border-radius:8px;background:var(--surface);min-width:132px;overflow:hidden;transition:box-shadow .2s,border-color .2s}
.bench .pgc h5{margin:0;padding:3px 9px;font-size:11px;font-weight:600;color:var(--muted);background:var(--surface-2);border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:8px;letter-spacing:0}
.bench .pgc .r{height:27px;padding:0 10px;display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:13px;border-bottom:1px solid var(--line)}
.bench .pgc .r:last-child{border-bottom:0}
.bench .pgc .r.free{color:var(--faint)}
.bench .pgc.read{border-color:var(--accent-viz);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent-viz) 22%,transparent)}
.bench .pgc.wrote h5{background:var(--accent-soft);color:var(--accent)}
.bench .pgc .r.hit{background:var(--good-soft);color:var(--good);font-weight:600}
.bench .pgc .r.new{background:var(--accent-soft);color:var(--accent);font-weight:600}
.bench .pgc .r.moved{background:var(--sunken);font-weight:600}
.bench .pgc.skip{opacity:.5;border-style:dashed}
.bench .stats{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px}
.bench .st{border:1px solid var(--line);border-radius:8px;padding:6px 11px;background:var(--surface-2);font-size:13px;color:var(--muted);display:flex;flex-direction:column;min-width:96px}
.bench .st b{font-family:var(--mono);font-size:18px;color:var(--ink);font-weight:600}
.bench .st.good b{color:var(--good)} .bench .st.bad b{color:var(--bad)} .bench .st.acc b{color:var(--accent)}
.bench .row{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin-bottom:10px}
.bench .row .field{margin:0}
.bench .log{margin:10px 0 0;padding:0;list-style:none;font-size:14px}
.bench .log li{padding:4px 0 4px 22px;position:relative;border-bottom:1px dashed var(--line)}
.bench .log li:last-child{border-bottom:0}
.bench .log li:before{content:"";position:absolute;left:6px;top:11px;width:7px;height:7px;border-radius:50%;background:var(--accent-viz)}
.bench .log li.ok:before{background:var(--good)} .bench .log li.bad:before{background:var(--bad)}
.bench .lab{font-size:12px;font-weight:600;color:var(--muted);margin:14px 0 4px;text-transform:uppercase;letter-spacing:.04em}
.bench .bits{display:flex;gap:2px;font-family:var(--mono);font-size:14px}
.bench .bits span{width:26px;height:26px;display:grid;place-items:center;border:1px solid var(--line-strong);border-radius:4px;background:var(--surface)}
.bench .bits span.one{background:var(--accent-soft);color:var(--accent);font-weight:600;border-color:var(--accent-viz)}
.bench .bits span.res.one{background:var(--good-soft);color:var(--good);border-color:var(--good)}
.bench .bar{height:22px;border-radius:5px;background:var(--accent-viz);min-width:3px}
.bench .tag{display:inline-block;padding:1px 8px;border-radius:99px;font-size:12px;font-weight:600;background:var(--sunken);color:var(--ink-2)}
.bench .tag.good{background:var(--good-soft);color:var(--good)} .bench .tag.bad{background:var(--bad-soft);color:var(--bad)} .bench .tag.acc{background:var(--accent-soft);color:var(--accent)}
.bench .q{border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:var(--surface-2);margin-bottom:10px}
.bench .scr{overflow-x:auto}
</style>`;
const SVGSTY = `<style>
.u1v text{font-family:var(--mono);font-size:12px;fill:var(--ink)}
.u1v .t2{font-family:var(--font);font-size:11px;fill:var(--muted)}
.u1v .pn{font-size:10px;fill:var(--muted)}
.u1v .cell{fill:var(--surface);stroke:var(--line-strong);stroke-width:1}
.u1v .ptrc{fill:var(--sunken);stroke:var(--line-strong);stroke-width:1}
.u1v .pg{fill:none;stroke:var(--ink-2);stroke-width:1.4}
.u1v .pg.hl{stroke:var(--accent-viz);stroke-width:2.6}
.u1v .pg.skip{stroke:var(--line-strong);stroke-dasharray:4 3;stroke-width:1.2}
.u1v .pg.over{stroke:var(--bad);stroke-dasharray:4 3}
.u1v .c.new .cell{fill:var(--accent-soft);stroke:var(--accent-viz)}
.u1v .c.chg .cell{fill:var(--accent-soft);stroke:var(--accent-viz);stroke-width:1.8}
.u1v .c.del .cell{fill:var(--bad-soft);stroke:var(--bad)}
.u1v .c.del text{text-decoration:line-through;fill:var(--bad)}
.u1v .c.hit .cell{fill:var(--good-soft);stroke:var(--good)}
.u1v .c.dim{opacity:.4}
.u1v .c.free text{fill:var(--faint)}
.u1v .arr{stroke:var(--muted);stroke-width:1.1;fill:none}
.u1v .arr.hl{stroke:var(--accent-viz);stroke-width:2.2}
.u1v .arr.skip{opacity:.22}
</style>`;
let UID = 0;
// cols: [{title, kind:'idx'|'tbl'|'ptr', w?, slots, pages:[{cells:[{k,p,r?,t?,cls?}], slots?, over?:[cells], label?}]}]
// idx cell = key + page pointer (shown 1-based, arrow to the next column); tbl cell = text; ptr cell = pointer only.
function drawCols(cols, o = {}) {
  const cellH = 22, gapV = 12, gapC = o.gapC || 78, padL = 30, padT = 24, hl = o.hl || {}, id = 'u1a' + (++UID);
  const geo = cols.map(c => {
    const kind = c.kind || 'tbl', kw = c.kw ?? 42, pw = c.pw ?? 26;
    const w = kind === 'idx' ? kw + pw : kind === 'ptr' ? (c.w || pw + 6) : (c.w || 64);
    let y = 0;
    const rects = c.pages.map(pg => {
      const slots = Math.max(pg.slots ?? c.slots ?? 2, pg.cells.length, 1), h = slots * cellH, overH = pg.over ? Math.max(1, pg.over.length) * cellH : 0;
      const r = { y, h, slots, overH }; y += h + (overH ? overH + 8 : 0) + gapV; return r;
    });
    return { kind, kw, pw, w, rects, H: Math.max(0, y - gapV) };
  });
  const H = Math.max(...geo.map(g => g.H)); let x = padL;
  geo.forEach((g, i) => { g.x = x; g.dy = padT + (H - g.H) / 2; x += g.w + gapC; });
  const W = x - gapC + padL + 4, Ht = H + padT + 8;
  let body = `<defs><marker id="${id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--muted)"/></marker><marker id="${id}h" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--accent-viz)"/></marker></defs>`;
  let arrows = '';
  cols.forEach((c, ci) => {
    const g = geo[ci];
    if (c.title) body += `<text class="t2" x="${g.x - 4}" y="14">${esc(c.title)}</text>`;
    c.pages.forEach((pg, pi) => {
      const r = g.rects[pi], y0 = g.dy + r.y, pk = `${ci}.${pi}`;
      const pcls = hl.pages?.has(pk) ? 'hl' : hl.skip?.has(pk) ? 'skip' : '';
      const cell = (cl, j, yy, xx, ww, inner, extra = '') => `<g class="c ${cl || ''}${extra}"><rect class="cell" x="${xx}" y="${yy}" width="${ww}" height="${cellH}"/>${inner}</g>`;
      for (let j = 0; j < r.slots; j++) {
        const cl = pg.cells[j], yy = y0 + j * cellH, free = !cl;
        const ccls = cl ? (cl.cls || '') + (hl.cells?.has(`${pk}.${j}`) ? ' hit' : '') : 'free';
        if (g.kind === 'idx') {
          body += `<g class="c ${ccls}"><rect class="cell" x="${g.x}" y="${yy}" width="${g.kw}" height="${cellH}"/><rect class="ptrc" x="${g.x + g.kw}" y="${yy}" width="${g.pw}" height="${cellH}"/>` +
            (free ? '' : `<text x="${g.x + g.kw / 2}" y="${yy + 15}" text-anchor="middle">${esc(cl.k)}</text><text class="pn" x="${g.x + g.kw + g.pw / 2}" y="${yy + 15}" text-anchor="middle">${cl.p !== undefined ? (cl.pl ?? cl.p + 1) : ''}</text>`) + `</g>`;
        } else if (g.kind === 'ptr') {
          body += `<g class="c ${ccls}"><rect class="ptrc" x="${g.x}" y="${yy}" width="${g.w}" height="${cellH}"/>${free ? '' : `<text class="pn" x="${g.x + g.w / 2}" y="${yy + 15}" text-anchor="middle">${cl.p !== undefined ? cl.p + 1 : ''}</text>`}</g>`;
        } else {
          body += `<g class="c ${ccls}"><rect class="cell" x="${g.x}" y="${yy}" width="${g.w}" height="${cellH}"/>${free ? '' : `<text x="${g.x + g.w / 2}" y="${yy + 15}" text-anchor="middle">${esc(cl.t ?? cl.k)}</text>`}</g>`;
        }
        if (cl && cl.p !== undefined && g.kind !== 'tbl' && geo[ci + 1]) {
          const ng = geo[ci + 1], tr = ng.rects[cl.p];
          if (tr) {
            const ty = ng.dy + tr.y + (cl.r !== undefined ? cl.r * cellH + cellH / 2 : tr.h / 2), x1 = g.x + g.w, y1 = yy + cellH / 2, x2 = ng.x - 2;
            const ak = `${ci}.${pi}.${j}`, cls = hl.arrows?.has(ak) ? 'hl' : hl.dimArrows?.has(ak) ? 'skip' : '';
            arrows += `<path class="arr ${cls}" d="M${x1} ${y1} C${x1 + gapC * .5} ${y1} ${x2 - gapC * .5} ${ty} ${x2} ${ty}" marker-end="url(#${id}${cls === 'hl' ? 'h' : ''})"/>`;
          }
        }
      }
      body += `<rect class="pg ${pcls}" x="${g.x - 1}" y="${y0 - 1}" width="${g.w + 2}" height="${r.h + 2}" rx="3"/>`;
      if (pg.label) body += `<text class="pn" x="${g.x - 5}" y="${y0 + 13}" text-anchor="end">${esc(pg.label)}</text>`;
      if (pg.over) {
        const oy = y0 + r.h + 8;
        pg.over.forEach((oc, j) => { body += `<g class="c ${oc.cls || ''}"><rect class="cell" x="${g.x + 10}" y="${oy + j * cellH}" width="${g.w - 10}" height="${cellH}"/><text x="${g.x + 10 + (g.w - 10) / 2}" y="${oy + j * cellH + 15}" text-anchor="middle">${esc(oc.k ?? oc.t)}</text></g>`; });
        if (!pg.over.length) body += `<g class="c free"><rect class="cell" x="${g.x + 10}" y="${oy}" width="${g.w - 10}" height="${cellH}"/></g>`;
        body += `<rect class="pg over" x="${g.x + 9}" y="${oy - 1}" width="${g.w - 8}" height="${r.overH + 2}" rx="3"/><text class="pn" x="${g.x - 5}" y="${oy + 14}" text-anchor="end">overflow</text>`;
        body += `<line x1="${g.x + 4}" x2="${g.x + 4}" y1="${y0 + r.h}" y2="${oy}" class="arr"/>`;
      }
    });
  });
  return `<svg class="viz u1v" viewBox="0 0 ${Math.ceil(W)} ${Math.ceil(Ht)}" width="100%" style="max-width:${Math.ceil(W)}px" role="img">${SVGSTY}${body}${arrows}</svg>`;
}
// entries -> an index column (pages of `per` entries)
const idxCol = (entries, per, title, extra = {}) => ({ title, kind: 'idx', slots: per, pages: chunk(entries, per).map((pg, i) => ({ cells: pg.map(e => ({ ...e })), label: extra.labels === false ? undefined : `I${i + 1}` })), ...extra });
// table pages -> a table column. fmt(row) gives the text of a row.
const tblCol = (pages, cap, title, f = r => String(r), extra = {}) => ({ title, kind: 'tbl', slots: cap, pages: pages.map((pg, i) => ({ cells: pg.map((r, j) => ({ t: f(r), cls: extra.cls ? extra.cls(r, i, j) : '' })), label: `P${i + 1}` })), ...extra });

const stat = (label, value, tone = '') => `<div class="st ${tone}"><b>${value}</b>${label}</div>`;
const log = items => `<ul class="log">${items.map(([t, c]) => `<li class="${c || ''}">${t}</li>`).join('')}</ul>`;
// HTML page cards for a sorted file
function cards(pages, cap, o = {}) {
  return `<div class="cards">${pages.map((pg, p) => `<div class="pgc ${o.read?.has(p) ? 'read' : ''} ${o.wrote?.has(p) ? 'wrote' : ''} ${o.skip?.has(p) ? 'skip' : ''}"><h5><span>Page ${p + 1}</span><span>${pg.length}/${cap} rows</span></h5>${Array.from({ length: Math.max(cap, pg.length) }, (_, i) => i < pg.length ? `<div class="r ${o.cls ? o.cls(pg[i], p, i) : ''}">${esc(o.fmt ? o.fmt(pg[i]) : pg[i])}</div>` : `<div class="r free">free</div>`).join('')}</div>`).join('')}</div>`;
}
const numIn = (id, label, val, attrs = '') => `<div class="field" style="max-width:130px"><label for="${id}">${label}</label><input type="text" inputmode="numeric" id="${id}" value="${val}" ${attrs} autocomplete="off"></div>`;
const sel = (id, label, opts, val) => `<div class="field"><label for="${id}">${label}</label><select id="${id}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
const pnames = (set, base = 1) => [...set].sort((a, b) => a - b).map(p => p + base).join(', ');

// ============================================================ 1. Sorted file in pages (slides 25-28, Scenarios 2a-2d)
const NAMES = ['Abdelrahman', 'Ahmed', 'Aya', 'Basma', 'Dina', 'Farida', 'Hana', 'Karim', 'Laila', 'Mohamed', 'Mohamed', 'Nada', 'Omar', 'Salma', 'Youssef'];
const SCEN = [
  { id: '2a', op: 'insert', key: 'Abdelrahman', label: '2a Insert Abdelrahman', q: 'You insert a new user with first name Abdelrahman. Which page receives the row first?', right: 'Page 1' },
  { id: '2b', op: 'delete', key: 'Abdelrahman', label: '2b Delete Abdelrahman', q: 'You delete the user with first name Abdelrahman. Which page do you have to change?', right: 'Page 1' },
  { id: '2c', op: 'find', key: 'Abdelrahman', label: '2c Retrieve Abdelrahman', q: 'You retrieve all users with first name Abdelrahman. Which page holds them?', right: 'Page 1' },
  { id: '2d', op: 'find', key: 'Mohamed', label: '2d Retrieve Mohamed', q: 'You retrieve all users with first name Mohamed. Which page(s) hold them?', right: 'Pages 2 and 3' },
];
function probeText(pages, key, probes) {
  return probes.map(p => {
    const f = pages[p][0], l = pages[p][pages[p].length - 1];
    const how = cmp(key, f) < 0 ? `${esc(key)} comes before ${esc(f)}, so go to the pages on the left` : cmp(key, l) > 0 ? `${esc(key)} comes after ${esc(l)}, so go to the pages on the right` : `${esc(f)} ≤ ${esc(key)} ≤ ${esc(l)}: the key belongs in this page`;
    return [`Read <strong>page ${p + 1}</strong> (rows ${esc(f)} to ${esc(l)}): ${how}.`];
  });
}
function runPageOp(pages, op, key, cap, compact) {
  const marks = new Map(), L = [];
  let out = pages, reads, wrote = new Set();
  if (op === 'find') {
    const f = findAll(pages, key); reads = new Set(f.reads);
    probeText(pages, key, f.probes).forEach(t => L.push(t));
    f.back.forEach(p => L.push([`The page before also ends with ${esc(key)}, so read <strong>page ${p + 1}</strong> too (duplicates can span a page boundary).`]));
    if (!f.rows.length) L.push([`No row named ${esc(key)}. The search still cost ${f.reads.length} page read${f.reads.length > 1 ? 's' : ''}.`, 'bad']);
    else {
      f.pagesWithKey.forEach(p => pages[p].forEach((k, i) => { if (cmp(k, key) === 0) marks.set(`${p}.${i}`, 'hit'); }));
      const extra = f.reads.filter(p => !f.probes.includes(p) && !f.back.includes(p));
      if (extra.length) L.push([`The last row of the page is still ${esc(key)}, so the next page <strong>${extra.map(p => p + 1).join(', ')}</strong> may continue the run: read it.`]);
      L.push([`Found <strong>${f.rows.length}</strong> row${f.rows.length > 1 ? 's' : ''} in page${f.pagesWithKey.length > 1 ? 's' : ''} <strong>${f.pagesWithKey.map(p => p + 1).join(' and ')}</strong>.`, 'ok']);
    }
    return { pages, reads, wrote, marks, log: L, nR: reads.size, nW: 0, heap: pages.length };
  }
  if (op === 'insert') {
    const r = insertSorted(pages, key, cap); out = r.pages; reads = new Set(r.reads); wrote = new Set(r.writes);
    const s = seek(pages, key); probeText(pages, key, s.probes).forEach(t => L.push(t));
    L.push([`The row ${esc(key)} belongs in <strong>page ${r.page + 1}</strong>, in sorted position.`]);
    r.moved.forEach(m => L.push([`Page ${m.from + 1} now has ${cap + 1} rows but a page holds ${cap}. Its last row <strong>${esc(m.key)}</strong> moves to the front of ${m.to < pages.length ? `page ${m.to + 1}` : 'a <strong>new page ' + (m.to + 1) + '</strong>'}.`, 'bad']));
    if (!r.moved.length) L.push([`Page ${r.page + 1} had a free slot: rows after the new one slide down by one, nothing else moves.`, 'ok']);
    L.push([`Pages written: <strong>${[...wrote].sort((a, b) => a - b).map(p => p + 1).join(', ')}</strong>. A full sorted file pays for the whole chain of shifts.`, r.moved.length ? 'bad' : 'ok']);
    const pg = r.pages[r.page]; let idx = pg.lastIndexOf(key);
    if (r.moved.length && r.moved[0].key === key) marks.set(`${r.moved[0].to}.0`, 'new'); else if (idx >= 0) marks.set(`${r.page}.${idx}`, 'new');
    r.moved.forEach(m => { if (!(m.key === key && marks.get(`${m.to}.0`) === 'new')) marks.set(`${m.to}.0`, 'moved'); });
    return { pages: out, reads, wrote, marks, log: L, nR: reads.size, nW: wrote.size, heap: 1 };
  }
  const r = deleteSorted(pages, key, cap, compact); out = r.pages; reads = new Set(r.reads); wrote = new Set(r.writes);
  const s = seek(pages, key); probeText(pages, key, s.probes).forEach(t => L.push(t));
  if (!r.found) { L.push([`No row named ${esc(key)}: nothing to delete (${reads.size} page reads for nothing).`, 'bad']); return { pages, reads, wrote: new Set(), marks, log: L, nR: reads.size, nW: 0, heap: pages.length }; }
  L.push([`Found it in <strong>page ${r.page + 1}</strong> and removed it.`, 'ok']);
  L.push(compact ? [`Later rows slide up to close the gap, so pages <strong>${[...wrote].sort((a, b) => a - b).map(p => p + 1).join(', ')}</strong> are rewritten (O(n) in the worst case).`] : [`The gap stays as a free slot: only page <strong>${r.page + 1}</strong> is rewritten. A later insert can reuse the slot.`, 'ok']);
  if (r.dropped) L.push([`A page became empty and was released.`]);
  return { pages: out, reads, wrote, marks, log: L, nR: reads.size, nW: wrote.size, heap: pages.length };
}
export function u1PageLayout(el) {
  const CAP = 5, orig = () => chunk(NAMES, CAP).map(p => [...p]);
  let mode = 'scen', pages = orig(), res = null, compact = false, scen = null, answers = {}, picked = null, name = 'Mohamed';
  const render = () => {
    const view = res || { reads: new Set(), wrote: new Set(), marks: new Map() };
    const nDone = Object.keys(answers).length, nRight = SCEN.filter(s => answers[s.id] === s.right).length;
    const sc = SCEN.find(s => s.id === scen);
    let top = '';
    if (mode === 'scen') {
      top = `<div class="chips" style="margin-bottom:10px">${SCEN.map(s => `<button type="button" class="chip" data-scen="${s.id}" aria-pressed="${scen === s.id}">${s.label}${answers[s.id] ? (answers[s.id] === s.right ? ' ✓' : ' ✗') : ''}</button>`).join('')}</div>
        ${sc ? `<div class="q"><strong>${sc.q}</strong><div class="chips" style="margin-top:8px">${['Page 1', 'Page 2', 'Page 3', 'Pages 2 and 3'].map(o => `<button type="button" class="chip ${answers[sc.id] ? (o === sc.right ? 'accent' : '') : ''}" data-ans="${o}" ${answers[sc.id] ? 'disabled' : ''} aria-pressed="${answers[sc.id] === o}">${o}</button>`).join('')}</div></div>` : `<p class="small muted">Pick a scenario from the slides, guess first, then watch the file react. ${nDone ? `Score so far: ${nRight}/${nDone}.` : ''}</p>`}`;
    } else {
      top = `<div class="row"><div class="field" style="max-width:190px"><label for="u1pl-n">First name</label><input type="text" id="u1pl-n" value="${esc(name)}" autocomplete="off"></div>
        <button type="button" class="btn sm primary" data-op="insert"><i class="ph ph-plus"></i>Insert</button>
        <button type="button" class="btn sm" data-op="delete"><i class="ph ph-minus"></i>Delete</button>
        <button type="button" class="btn sm" data-op="find"><i class="ph ph-magnifying-glass"></i>Retrieve</button>
        <button type="button" class="btn sm ghost" data-reset><i class="ph ph-arrow-counter-clockwise"></i>Reset</button></div>
        <div class="row"><span class="small muted">After a delete:</span>${seg([['hole', 'leave a free slot'], ['compact', 'shift rows up']], compact ? 'compact' : 'hole', 'data-cmp')}</div>
        <div class="chips"><span class="small muted" style="align-self:center">Try:</span>${['Abdelrahman', 'Mohamed', 'Zeinab', 'Hana', 'Nour'].map(n => `<button type="button" class="chip" data-nm="${n}">${n}</button>`).join('')}</div>`;
    }
    el.innerHTML = `${CSS}${bench('rows', 'A sorted table stored in pages', 'Scenarios 2a to 2d')}<div class="bench-body">
      <div class="row">${seg([['scen', 'Slide scenarios'], ['free', 'Free play']], mode, 'data-mode')}<span class="small muted">15 rows, sorted on first name, 5 rows per page</span></div>
      ${top}
      <div class="lab">The file on disk${res ? ' after the operation' : ''}</div>
      ${cards(pages, CAP, { read: view.reads, wrote: view.wrote, cls: (k, p, i) => view.marks.get(`${p}.${i}`) || '' })}
      ${res ? `<div class="stats">${stat('page reads', res.nR, 'acc')}${stat('page writes', res.nW, res.nW > 1 ? 'bad' : 'good')}${stat('reads if the file were unsorted (heap)', res.heap)}</div>${log(res.log)}
      <p class="small muted" style="margin-top:8px">Orange border = page read. Orange header = page rewritten. Green = rows found, orange row = the new row, grey = a row pushed into the next page.</p>` : ''}
      ${sc && answers[sc.id] ? `<div class="callout key"><i class="ph ph-lightbulb"></i><div>${answers[sc.id] === sc.right ? '<strong>Right.</strong> ' : `<strong>Not quite, it is ${sc.right.toLowerCase()}.</strong> `}${sc.id === '2a' ? 'The file is sorted, so the new row has exactly one correct place. A binary search over page boundaries finds it, but the pages below it must shift.' : sc.id === '2b' ? 'Deleting needs the same search as a lookup. You can leave a gap or shift everything up.' : sc.id === '2c' ? 'Sorted storage lets you jump to the page with a binary search instead of reading every page.' : 'Mohamed appears twice, and the two rows sit on either side of a page boundary, so you read two pages.'}</div></div>` : ''}
    </div>`;
  };
  const apply = (op, key, c) => { const r = runPageOp(pages, op, key, CAP, c); pages = r.pages; res = r; };
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.mode) { mode = b.dataset.mode; pages = orig(); res = null; scen = null; }
    else if (b.dataset.scen) { scen = b.dataset.scen; pages = orig(); res = null; }
    else if (b.dataset.ans) {
      const s = SCEN.find(x => x.id === scen); answers[s.id] = b.dataset.ans; pages = orig(); apply(s.op, s.key, false);
      if (Object.keys(answers).length === SCEN.length) recordScore('u1-scenarios', SCEN.filter(x => answers[x.id] === x.right).length, SCEN.length);
    }
    else if (b.dataset.op) {
      const v = cap1($(el, '#u1pl-n').value); if (!v) return; name = v; apply(b.dataset.op, v, compact);
    }
    else if (b.dataset.nm) { name = b.dataset.nm; }
    else if (b.dataset.cmp) { compact = b.dataset.cmp === 'compact'; }
    else if ('reset' in b.dataset) { pages = orig(); res = null; }
    render();
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'u1pl-n') { e.preventDefault(); name = cap1(e.target.value); if (name) { apply('find', name, compact); render(); } } });
  render();
}

// ============================================================ 2. Dense, sparse, secondary (slides 30-32, PA1-2)
const STUD = [[10, 'Ali', 22], [20, 'Bassem', 19], [30, 'Carol', 22], [40, 'Dina', 20], [50, 'Eman', 19], [60, 'Farah', 21], [70, 'Gamal', 20], [80, 'Hoda', 22], [90, 'Ibrahim', 21], [100, 'Jana', 19], [110, 'Khaled', 22], [120, 'Laura', 20]];
export function u1DenseSparse(el) {
  let kind = 'dense', rpp = 2, ipp = 4, q = '50', qAge = false;
  const render = () => {
    const rows = STUD, pages = chunk(rows, rpp), tp = pages.length;
    const age = kind === 'sec' || kind === 'secsparse';
    const keyOf = r => (age ? r[2] : r[0]);
    let entries, title, valid = true;
    const keyPages = pages.map(pg => pg.map(keyOf));
    if (kind === 'dense') entries = denseAll(keyPages);
    else if (kind === 'sparse') entries = sparseMin(keyPages);
    else if (kind === 'sec') entries = secondaryAll(keyPages);
    else { entries = keyPages.map((pg, p) => ({ k: Math.min(...pg), p })).sort((a, b) => a.k - b.k || a.p - b.p); valid = false; }
    const ipages = packEntries(entries, ipp);
    const keyNum = +q, lk = age ? (Number.isFinite(keyNum) ? keyNum : 19) : keyNum;
    // lookup cost
    let cost = null;
    if (Number.isFinite(keyNum)) {
      const ikeys = ipages.map(pg => pg.map(e => e.k));
      const hit = new Set(), arr = new Set(), readsI = new Set(); let tbl = new Set(), msg = '';
      if (kind === 'dense' || kind === 'sec') {
        const f = findAll(ikeys, lk); f.reads.forEach(x => readsI.add(x));
        let flat = ipages.flatMap((pg, i) => pg.map((e, j) => ({ ...e, i, j })));
        flat.filter(e => e.k === lk).forEach(e => { tbl.add(e.p); arr.add(`0.${e.i}.${e.j}`); hit.add(`0.${e.i}.${e.j}`); });
        msg = tbl.size ? `Index: binary search over ${ipages.length} index page${ipages.length > 1 ? 's' : ''} (${readsI.size} read${readsI.size > 1 ? 's' : ''}) finds ${[...arr].length} matching pair${arr.size > 1 ? 's' : ''}.` : `Index: ${readsI.size} read${readsI.size > 1 ? 's' : ''} and no pair with key ${lk}: the row does not exist, and the table is never touched.`;
      } else if (kind === 'sparse') {
        const flat = ipages.flatMap((pg, i) => pg.map((e, j) => ({ ...e, i, j })));
        let e = null; flat.forEach(x => { if (x.k <= lk) e = x; });
        if (e) {
          const s = seek(ikeys, lk); s.probes.forEach(x => readsI.add(x)); readsI.add(e.i);
          arr.add(`0.${e.i}.${e.j}`); hit.add(`0.${e.i}.${e.j}`); tbl.add(e.p);
          msg = `Index: binary search (${readsI.size} read${readsI.size > 1 ? 's' : ''}), take the <strong>last pair whose key ≤ ${lk}</strong>: &lt;${e.k}, ${e.p + 1}&gt;.`;
        } else msg = `Key ${lk} is smaller than every page minimum: not in the table.`;
      } else {
        const flat = ipages.flatMap((pg, i) => pg.map((e, j) => ({ ...e, i, j })));
        let e = null; flat.forEach(x => { if (x.k <= lk) e = x; });
        if (e) { arr.add(`0.${e.i}.${e.j}`); tbl.add(e.p); readsI.add(e.i); }
        msg = `A sparse index on age would send ${lk} to page ${e ? e.p + 1 : '?'}, the page of the last pair with minimum age ≤ ${lk}. But the table is not sorted on age, so ${lk} can sit in any page: <strong>the answer would be wrong</strong>.`;
      }
      const truth = new Set(); pages.forEach((pg, p) => pg.forEach(r => { if (keyOf(r) === lk) truth.add(p); }));
      cost = { hit, arr, readsI, tbl, truth, msg };
    }
    const tcol = tblCol(pages, rpp, 'Table pages' + (age ? ' (sorted on ID)' : ' (sorted on ID)'), r => `${r[0]} ${r[1]} ${r[2]}`, { w: 118 });
    if (cost) cost.tbl.forEach(p => { (tcol.pages[p]).cells.forEach(c => c.cls = ''); });
    const hlc = { pages: new Set([...(cost ? [...cost.tbl].map(p => `1.${p}`) : [])]), arrows: cost?.arr, cells: cost?.hit };
    const ic = idxCol(entries.map(e => ({ ...e })), ipp, kind === 'dense' ? 'Dense index on ID' : kind === 'sparse' ? 'Sparse index on ID' : kind === 'sec' ? 'Dense index on Age' : 'Sparse index on Age');
    const svg = drawCols([ic, tcol], { hl: hlc });
    const nIdx = ipages.length;
    el.innerHTML = `${CSS}${bench('list-numbers', 'Dense, sparse and secondary indices', 'One table, three indices')}<div class="bench-body">
      <div class="row">${seg([['dense', 'Primary dense'], ['sparse', 'Primary sparse'], ['sec', 'Secondary on Age'], ['secsparse', 'Sparse on Age?']], kind, 'data-kind')}</div>
      <div class="row">${sel('u1ds-r', 'Rows per table page', [[2, '2'], [3, '3'], [4, '4']], rpp)}${sel('u1ds-i', 'Pairs per index page', [[2, '2'], [4, '4'], [6, '6']], ipp)}
        ${numIn('u1ds-q', age ? 'Look up Age =' : 'Look up ID =', q)}<button class="btn sm primary" type="button" data-go><i class="ph ph-magnifying-glass"></i>Look up</button></div>
      <div class="stats">${stat('table rows', rows.length)}${stat('table pages', tp)}${stat('index pairs', entries.length, 'acc')}${stat('index pages', nIdx, 'acc')}</div>
      <div class="scr">${svg}</div>
      <p class="small" style="margin-top:8px">${kind === 'dense' ? `<strong>Dense:</strong> one pair per row: ${rows.length} rows / ${ipp} pairs per page = ${nIdx} index pages.` : kind === 'sparse' ? `<strong>Sparse:</strong> one pair per <em>table page</em>: ${tp} pages / ${ipp} pairs per page = ${nIdx} index page${nIdx > 1 ? 's' : ''}. It is only possible because the table is sorted on ID.` : kind === 'sec' ? `<strong>Secondary:</strong> the table is sorted on ID, not on Age, so the index must list every row (dense), sorted by Age. Equal ages sit next to each other in the index, but their rows are scattered over different pages.` : `<strong>Why a secondary index cannot be sparse:</strong> a page minimum tells you nothing about the other ages in that page, because the pages are not sorted on Age.`}</p>
      ${cost ? `<div class="callout ${valid ? 'key' : 'trap'}" style="max-width:none"><i class="ph ph-${valid ? 'path' : 'warning'}"></i><div>${cost.msg}${valid ? ` Then read table page${cost.tbl.size > 1 ? 's' : ''} <strong>${[...cost.tbl].sort((a, b) => a - b).map(p => p + 1).join(', ')}</strong>. <strong>${cost.readsI.size} index read${cost.readsI.size > 1 ? 's' : ''} + ${cost.tbl.size} table read${cost.tbl.size > 1 ? 's' : ''}.</strong>` : ` The rows with age ${lk} really are in page${cost.truth.size > 1 ? 's' : ''} ${[...cost.truth].sort((a, b) => a - b).map(p => p + 1).join(', ')}.`}${valid && kind !== 'sec' ? ` Without the index you would binary-search the sorted file (about ${Math.max(1, Math.ceil(Math.log2(tp)))} page reads).` : ''}${kind === 'sec' ? ` Without the index the table is not sorted on Age, so you would scan all ${tp} pages.` : ''}</div></div>` : ''}
    </div>`;
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.kind) { kind = b.dataset.kind; q = (kind === 'sec' || kind === 'secsparse') ? '21' : '50'; render(); }
    else if ('go' in b.dataset) { q = $(el, '#u1ds-q').value.trim(); render(); }
  });
  el.addEventListener('change', e => { if (e.target.id === 'u1ds-r') { rpp = +e.target.value; render(); } else if (e.target.id === 'u1ds-i') { ipp = +e.target.value; render(); } else if (e.target.id === 'u1ds-q') { q = e.target.value.trim(); render(); } });
  render();
}

// ============================================================ 3. Keeping an index up to date (slides 33-38)
const IPP = 4, MCAP = 2;
function deriveIdx(s) {
  if (s.mode === 'dense') return s.pages.flatMap((pg, p) => [...pg, ...(s.over[p] || [])].map(k => ({ k, p }))).sort((a, b) => a.k - b.k);
  return s.pages.map((pg, p) => ({ k: pg[0], p })).filter(e => e.k !== undefined);
}
function mkState(mode, pages, over, idx, extra = {}) {
  const s = { mode, pages: pages.map(p => [...p]), over: (over || pages.map(() => [])).map(o => [...o]), mk: { tbl: new Map(), idx: new Map(), over: new Map() }, hlp: new Set(), ...extra };
  s.idx = idx || deriveIdx(s); return s;
}
function idxDiff(a, b) {
  const o = new Map(a.map(e => [e.k, e])), n = new Map(b.map(e => [e.k, e]));
  return { gone: a.filter(e => !n.has(e.k)), added: b.filter(e => !o.has(e.k)), moved: b.filter(e => o.has(e.k) && o.get(e.k).p !== e.p) };
}
const pair = e => `&lt;${e.k}, ${e.p + 1}&gt;`;
function describeDiff(s0, d, dense) {
  const parts = [];
  if (!dense && d.gone.length === 1 && d.added.length === 1 && d.gone[0].p === d.added[0].p) parts.push(`replace ${pair(d.gone[0])} by ${pair(d.added[0])} (the page minimum changed)`);
  else { d.gone.forEach(e => parts.push(`remove ${pair(e)}`)); d.added.forEach(e => parts.push(`add ${pair(e)}`)); }
  d.moved.forEach(e => parts.push(`change the pointer of key ${e.k} to page ${e.p + 1}`));
  return parts;
}
function finishIdx(prev, nextPages, nextOver, mode, kind) {
  const fin = mkState(mode, nextPages, nextOver);
  const d = idxDiff(prev.idx, fin.idx);
  d.added.forEach(e => fin.mk.idx.set(e.k, 'new')); d.moved.forEach(e => fin.mk.idx.set(e.k, 'chg'));
  return { fin, d };
}
function maintain(s, key, op) {
  const dense = s.mode === 'dense', steps = [];
  const push = (text, st, kind = 'info') => steps.push({ text, state: st, kind });
  let p = -1, inOver = false;
  s.pages.forEach((pg, i) => { if (pg.includes(key)) p = i; else if ((s.over[i] || []).includes(key)) { p = i; inOver = true; } });
  const base = mkState(s.mode, s.pages, s.over, s.idx);
  // ---------- locate through the index
  const locate = () => {
    if (dense) { const e = s.idx.find(x => x.k === key); return e ? { e, text: `The dense index has the pair ${pair(e)}, so the row is in <strong>page ${e.p + 1}</strong>.` } : { e: null, text: `No pair with key ${key} in the dense index: the row does not exist.` }; }
    let e = null; s.idx.forEach(x => { if (x.k <= key) e = x; }); if (!e) e = s.idx[0];
    return { e, text: `The sparse index has no pair for ${key}. Take the <strong>last pair whose key ≤ ${key}</strong>: ${pair(e)}. The row can only be in <strong>page ${e.p + 1}</strong>.` };
  };
  if (op === 'delete') {
    const loc = locate();
    if (p < 0) { const b = mkState(s.mode, s.pages, s.over, s.idx); b.hlp = new Set(loc.e ? [`1.${loc.e.p}`] : []); push(loc.text + (dense ? '' : ` Page ${loc.e.p + 1} does not contain ${key}: nothing to delete.`), b, 'warn'); return steps; }
    const a = mkState(s.mode, s.pages, s.over, s.idx); if (loc.e) { const ix = s.idx.indexOf(loc.e); a.mk.idx.set(loc.e.k, 'hit'); } a.hlp = new Set([`1.${p}`]);
    push(`<strong>Find the row.</strong> ${loc.text} ${dense ? '' : `Read page ${p + 1} and find ${key}.`}`, a);
    const np = s.pages.map(x => [...x]), no = s.over.map(x => [...x]);
    if (inOver) no[p].splice(no[p].indexOf(key), 1); else np[p].splice(np[p].indexOf(key), 1);
    let drop = false; if (!np[p].length && !no[p].length) { drop = true; np.splice(p, 1); no.splice(p, 1); }
    const fin0 = mkState(s.mode, np, no); const d = idxDiff(s.idx, fin0.idx);
    const b = mkState(s.mode, np, no, s.idx); b.hlp = new Set(drop ? [] : [`1.${p}`]);
    d.gone.forEach(e => b.mk.idx.set(e.k, 'del')); d.moved.forEach(e => b.mk.idx.set(e.k, 'chg'));
    push(`<strong>Delete from the table page.</strong> ${key} is removed from ${inOver ? 'the overflow block' : `page ${p + 1}`}${inOver || drop ? '' : '; the remaining row slides up and the page now has a free slot'}${drop ? '. The page is now empty and is released (later pages are renumbered)' : ''}. ${d.gone.length || d.added.length || d.moved.length ? `<strong>The index still holds the old pair${d.gone.length ? '' : 's'}</strong> (marked).` : 'The index has not been touched yet.'}`, b, 'warn');
    const { fin } = finishIdx(s, np, no, s.mode);
    const parts = describeDiff(s, d, dense);
    fin.hlp = new Set(); d.gone.forEach(() => { });
    push(parts.length ? `<strong>Update the index:</strong> ${parts.join('; ')}.${dense ? ' Pairs after this one shift up one slot, so the cost grows with the index size, O(n).' : ''}` : `<strong>The sparse index does not change.</strong> ${key} was not the smallest key of page ${p + 1}, and a sparse index only stores one key per page (slide 35b).`, fin, parts.length ? 'ok' : 'ok');
    return steps;
  }
  // ---------- insert
  if (p >= 0) { push(`${key} already exists in the table. This simulator keeps keys unique: try another key.`, base, 'warn'); return steps; }
  const idxKeys = s.idx.map(e => e.k);
  let tp;
  { const pageMins = s.pages.map(pg => pg[0]); tp = 0; pageMins.forEach((m, i) => { if (m !== undefined && m <= key) tp = i; }); }
  const a = mkState(s.mode, s.pages, s.over, s.idx); a.hlp = new Set([`1.${tp}`]);
  const prevKey = (() => { let e = null; s.idx.forEach(x => { if (x.k < key) e = x; }); return e; })();
  push(`<strong>Find the page.</strong> The table is sorted, so ${key} belongs in <strong>page ${tp + 1}</strong>${dense ? (prevKey ? ` (right after ${prevKey.k}, whose pair is ${pair(prevKey)})` : '') : ` (the last sparse pair with key ≤ ${key} points there)`}.`, a);
  const np = s.pages.map(x => [...x]), no = s.over.map(x => [...x]); const full = np[tp].length >= MCAP;
  let b = null, text = '';
  if (!full) {
    np[tp].push(key); np[tp].sort((x, y) => x - y); text = `Page ${tp + 1} has a free slot, so ${key} goes straight in (rows below it slide down inside the page).`;
  } else if (op === 'insertOver') {
    no[tp].push(key); no[tp].sort((x, y) => x - y); text = `Page ${tp + 1} is full (${MCAP} rows). <strong>Overflow block:</strong> ${key} goes into a new block chained to page ${tp + 1}. Nothing else moves. The file is reorganised later, at a quiet moment.`;
  } else {
    const r = insertSorted(np, key, MCAP); r.pages.forEach((pg, i) => { np[i] = pg; });
    text = `Page ${tp + 1} is full. <strong>Immediate reorganisation:</strong> ${r.moved.map(m => `${m.key} is pushed into ${m.to < s.pages.length ? `page ${m.to + 1}` : `a new page ${m.to + 1}`}`).join(', then ')}. ${r.writes.length} table page${r.writes.length > 1 ? 's' : ''} rewritten.`;
  }
  b = mkState(s.mode, np, no, s.idx); b.hlp = new Set([`1.${tp}`]);
  const finT = mkState(s.mode, np, no); const d = idxDiff(s.idx, finT.idx);
  d.gone.forEach(e => b.mk.idx.set(e.k, 'del'));
  if (op === 'insertOver' && full) b.mk.over.set(`${tp}.${no[tp].indexOf(key)}`, 'new'); else np.forEach((pg, i) => pg.forEach((k, j) => { if (k === key) b.mk.tbl.set(`${i}.${j}`, 'new'); }));
  if (!(op === 'insertOver' && full)) { const r0 = s.pages; np.forEach((pg, i) => pg.forEach((k, j) => { if (k !== key && (r0[i] || [])[j] !== k) b.mk.tbl.set(`${i}.${j}`, 'chg'); })); }
  push(`<strong>Insert into the table.</strong> ${text}`, b, full ? 'warn' : 'ok');
  const { fin } = finishIdx(s, np, no, s.mode);
  const parts = describeDiff(s, d, dense);
  push(parts.length ? `<strong>Update the index:</strong> ${parts.join('; ')}.${dense ? ' Later pairs shift down one slot (and a full index page spills into the next), so this is O(n).' : ' Only page minimums are stored, so only a change in a page minimum reaches the index.'}` : `<strong>The sparse index does not change.</strong> ${key} is not the smallest key of its page, so no page minimum changed (slide 36).`, fin, 'ok');
  return steps;
}
export function u1IndexMaintain(el) {
  const full4 = [[10, 20], [30, 40], [50, 60], [70, 80]], free4 = [[10, 20], [30], [40, 50], [60]];
  const draw = (s, hl) => {
    const tc = tblCol(s.pages, MCAP, 'Table pages (2 rows each)', r => String(r), { w: 56, cls: (r, i, j) => s.mk.tbl.get(`${i}.${j}`) || '' });
    tc.pages.forEach((pg, i) => { if (s.over[i] && s.over[i].length) pg.over = s.over[i].map((k, j) => ({ k, cls: s.mk.over.get(`${i}.${j}`) || '' })); });
    const ic = idxCol(s.idx.map(e => ({ ...e, cls: s.mk.idx.get(e.k) || '' })), IPP, s.mode === 'dense' ? 'Dense index' : 'Sparse index');
    return CSS + drawCols([ic, tc], { hl: { pages: s.hlp } });
  };
  opsBench(el, {
    id: 'u1-maintain', icon: 'wrench', title: 'Insert and delete: what happens to the index?', hint: 'Slides 34 to 38. Step through each change.',
    presets: [
      { label: 'Dense, full pages (slide 34)', make: () => mkState('dense', full4), note: 'Dense index, table pages hold 2 rows, index pages hold 4 pairs.' },
      { label: 'Sparse, full pages (slide 35)', make: () => mkState('sparse', full4), note: 'Sparse index: one pair per table page (the page minimum).' },
      { label: 'Sparse, free space (slides 36-37)', make: () => mkState('sparse', free4), note: 'Pages 2 and 4 have a free slot. Try insert 34, insert 15 and insert 25.' },
      { label: 'Dense, free space', make: () => mkState('dense', free4), note: 'The same table with a dense index: every row has its own pair.' },
    ],
    input: { label: 'Key', placeholder: 'e.g. 34', parse: parseInt10 },
    ops: [
      { label: 'Delete', icon: 'minus', run: (s, k) => maintainSteps(s, k, 'delete') },
      { label: 'Insert (reorganise)', icon: 'arrows-down-up', run: (s, k) => maintainSteps(s, k, 'insert') },
      { label: 'Insert (overflow block)', icon: 'stack-plus', run: (s, k) => maintainSteps(s, k, 'insertOver') },
    ],
    quick: [
      { label: 'Delete 30', op: 0, value: 30 }, { label: 'Delete 40', op: 0, value: 40 }, { label: 'Insert 34', op: 1, value: 34 },
      { label: 'Insert 15 (reorganise)', op: 1, value: 15 }, { label: 'Insert 25 (overflow)', op: 2, value: 25 },
    ],
    draw, info: s => `${s.idx.length} index pair${s.idx.length === 1 ? '' : 's'} in ${Math.ceil(s.idx.length / IPP)} index page${s.idx.length > IPP ? 's' : ''}; table has ${s.pages.reduce((a, p) => a + p.length, 0) + s.over.reduce((a, o) => a + o.length, 0)} rows in ${s.pages.length} page${s.pages.length === 1 ? '' : 's'}.`,
  });
}
// opsBench keeps the state returned here as the new structure, so every sequence ends with a clean final picture
function maintainSteps(s, key, op) {
  const steps = maintain(s, key, op), l = steps[steps.length - 1].state;
  return { state: mkState(l.mode, l.pages, l.over, l.idx), steps };
}
// ============================================================ 4. Duplicate keys (slides 39-41)
const DUP = [[10, 10], [10, 20], [20, 30], [30, 30], [40, 45]];
const SEC = [[20, 10], [20, 40], [10, 40], [10, 40], [30, 40]];
const scanFrom = (pages, start, K) => { const s = new Set(); for (let p = start; p < pages.length; p++) { if (pages[p][0] > K) break; s.add(p); if (pages[p][pages[p].length - 1] > K) break; } return s; };
const DUPDESC = {
  'dense-1': ['Approach 1: duplicate keys inside the index', 'One pair per row, so equal keys repeat. Simple, but the index is as big as the table.'],
  'dense-2': ['Approach 2: point at the first new value', 'One pair per distinct key, pointing at the page of its first occurrence. Smaller. To read all rows with the key, continue through the table until the key changes.'],
  'dense-3': ['Approach 3: pick a value from each page', 'One pair per table page: the first value that is new on the page (or the page\'s value if none is new). Index size = number of pages.'],
  'sparse-3': ['Sparse index, approach 3: the minimum of each page', 'One pair per page. Careful with a key that appears in the middle of a run (slide 40: "careful if looking for 20 or 30"): the pair with that key is not the first page that holds it, so start from the last pair with a SMALLER key.'],
  'sec-1': ['Secondary, approach 1: duplicate keys inside the index', 'One pair per row, sorted by key. Problem: excess overhead in disk space and search time.'],
  'sec-2': ['Secondary, approach 2: buckets of pointers (clustering)', 'The index holds each key once, pointing to a bucket that lists all the row pointers. Problem: the buckets have variable size.'],
  'sec-3': ['Secondary, approach 3: chain the records', 'The index holds each key once, pointing at the first row; every row carries an extra pointer to the next row with the same key. Problem: extra field in every row, follow the chain to find all rows, maintenance nightmare.'],
};
export function u1Duplicates(el) {
  let kind = 'dense', ap = 2, K = 20;
  const IP = 4;
  const build = () => {
    const isSec = kind === 'sec', pages = isSec ? SEC : DUP, hl = { pages: new Set(), arrows: new Set(), cells: new Set() };
    const valid = kind === 'sparse' ? [3] : [1, 2, 3]; if (!valid.includes(ap)) ap = valid[0];
    let cols = [], entries = [], extra = '', idxReads = 1, tblSet = new Set();
    const truth = new Set(); pages.forEach((pg, p) => { if (pg.includes(K)) truth.add(p); });
    const mark = (ci, ent) => { const flat = chunk(ent, IP); flat.forEach((pg, i) => pg.forEach((e, j) => { if (e.k === K) { hl.cells.add(`${ci}.${i}.${j}`); hl.arrows.add(`${ci}.${i}.${j}`); } })); };
    if (!isSec) {
      entries = kind === 'sparse' ? sparseMin(pages) : ap === 1 ? denseAll(pages) : ap === 2 ? denseFirst(pages) : pageNew(pages);
      const ik = chunk(entries, IP).map(pg => pg.map(e => e.k));
      if (kind === 'dense' && ap === 1) { entries.forEach(e => { if (e.k === K) tblSet.add(e.p); }); mark(0, entries); }
      else if (kind === 'dense' && ap === 2) { const e = entries.find(x => x.k === K); if (e) { tblSet = scanFrom(pages, e.p, K); mark(0, entries); } }
      else { let st = 0, lastLess = -1; entries.forEach((e, i) => { if (e.k < K) lastLess = i; }); const le = lastLess >= 0 ? entries[lastLess] : null; st = le ? le.p : 0; tblSet = scanFrom(pages, st, K); if (le) { const flat = chunk(entries, IP); flat.forEach((pg, i) => pg.forEach((e, j) => { if (e === le) { hl.cells.add(`0.${i}.${j}`); hl.arrows.add(`0.${i}.${j}`); } })); } }
      const sk = seek(ik, K); idxReads = new Set([...sk.probes, ...sk.back]).size || 1;
      cols = [idxCol(entries, IP, 'Index'), tblCol(pages, 2, 'Table pages (sorted)', String, { w: 46 })];
      tblSet.forEach(p => hl.pages.add(`1.${p}`));
    } else {
      const keys = [...new Set(pages.flat())].sort((a, b) => a - b);
      const rowsOf = k => { const o = []; pages.forEach((pg, p) => pg.forEach((v, r) => { if (v === k) o.push({ p, r }); })); return o; };
      if (ap === 1) { entries = secondaryAll(pages); cols = [idxCol(entries, IP, 'Index (every row)'), tblCol(pages, 2, 'Table pages (not sorted on this column)', String, { w: 46 })]; mark(0, entries); entries.forEach(e => { if (e.k === K) tblSet.add(e.p); }); tblSet.forEach(p => hl.pages.add(`1.${p}`)); const sk = chunk(entries, IP); idxReads = sk.filter(pg => pg.some(e => e.k === K)).length || 1; }
      else if (ap === 2) {
        entries = keys.map((k, i) => ({ k, p: i }));
        const bk = keys.map(k => ({ cells: rowsOf(k).map(x => ({ p: x.p, r: x.r })), slots: 1 }));
        cols = [idxCol(entries, IP, 'Index (one pair per key)'), { title: 'Buckets of pointers', kind: 'ptr', slots: 1, pages: bk.map((b, i) => ({ cells: b.cells, label: `B${i + 1}` })) }, tblCol(pages, 2, 'Table pages', String, { w: 46 })];
        const ki = keys.indexOf(K); if (ki >= 0) { hl.cells.add(`0.${Math.floor(ki / IP)}.${ki % IP}`); hl.arrows.add(`0.${Math.floor(ki / IP)}.${ki % IP}`); hl.pages.add(`1.${ki}`); bk[ki].cells.forEach((c, j) => { hl.arrows.add(`1.${ki}.${j}`); tblSet.add(c.p); hl.pages.add(`2.${c.p}`); }); }
        idxReads = 1; extra = `${bk.length} bucket${bk.length > 1 ? 's' : ''}, sizes ${bk.map(b => b.cells.length).join(', ')} (variable)`;
      } else {
        entries = keys.map((k, i) => ({ k, p: rowsOf(k)[0].p, r: rowsOf(k)[0].r }));
        const nextTxt = (v, p, r) => { const rs = rowsOf(v), i = rs.findIndex(x => x.p === p && x.r === r), nx = rs[i + 1]; return nx ? `${v} › P${nx.p + 1}.${nx.r + 1}` : `${v} › nil`; };
        const tc = tblCol(pages.map((pg, p) => pg.map((v, r) => ({ v, p, r }))), 2, 'Table pages: value › next row with the same value', x => nextTxt(x.v, x.p, x.r), { w: 112 });
        cols = [idxCol(entries, IP, 'Index (one pair per key)'), tc];
        const ki = keys.indexOf(K); if (ki >= 0) { hl.cells.add(`0.${Math.floor(ki / IP)}.${ki % IP}`); hl.arrows.add(`0.${Math.floor(ki / IP)}.${ki % IP}`); rowsOf(K).forEach(x => { tblSet.add(x.p); hl.pages.add(`1.${x.p}`); }); }
        idxReads = 1; extra = `${pages.flat().length} extra pointer fields, one in every row`;
      }
    }
    return { cols, entries, hl, tblSet, truth, idxReads, extra, pages };
  };
  const render = () => {
    const b = build(), key = (kind === 'dense' ? 'dense-' : kind === 'sparse' ? 'sparse-' : 'sec-') + (kind === 'sparse' ? 3 : ap), d = DUPDESC[key];
    const total = b.pages.flat().length, nIdx = Math.ceil(b.entries.length / IP);
    const found = [...b.tblSet].sort((a, c) => a - c).map(p => p + 1).join(', ');
    el.innerHTML = `${CSS}${bench('copy', 'Duplicate keys: three ways out', 'Slides 39 to 41')}<div class="bench-body">
      <div class="row">${seg([['dense', 'Primary, dense'], ['sparse', 'Primary, sparse'], ['sec', 'Secondary']], kind, 'data-kind')}${kind === 'sparse' ? '' : seg([[1, 'Approach 1'], [2, 'Approach 2'], [3, 'Approach 3']], ap, 'data-ap')}
        ${sel('u1du-k', 'Find all rows with key', [...new Set(b.pages.flat())].sort((x, y) => x - y).map(v => [v, v]), K)}</div>
      <p class="small"><strong>${d[0]}.</strong> ${d[1]}</p>
      <div class="scr">${drawCols(b.cols, { hl: b.hl })}</div>
      <div class="stats">${stat('rows in the table', total)}${stat('index pairs', b.entries.length, 'acc')}${stat('index pages (4 pairs each)', nIdx, 'acc')}${stat('table pages read', b.tblSet.size, 'good')}${stat('index pages read (about)', b.idxReads)}</div>
      ${b.extra ? `<p class="small muted">Extra cost: ${b.extra}.</p>` : ''}
      <div class="callout key" style="max-width:none"><i class="ph ph-path"></i><div>Looking for <strong>${K}</strong>: the rows are in table page${b.truth.size > 1 ? 's' : ''} <strong>${[...b.truth].sort((a, c) => a - c).map(p => p + 1).join(', ')}</strong>. This structure reads page${b.tblSet.size > 1 ? 's' : ''} <strong>${found || 'none'}</strong>${[...b.tblSet].join() === [...b.truth].join() ? '' : ' (it also reads a page that has no match, because it starts from a pair with a smaller key)'}.</div></div>
    </div>`;
  };
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.kind) { kind = b.dataset.kind; if (kind === 'sec' && ![10, 20, 30, 40].includes(K)) K = 20; if (kind !== 'sec' && ![10, 20, 30, 40, 45].includes(K)) K = 20; render(); } else if (b.dataset.ap) { ap = +b.dataset.ap; render(); } });
  el.addEventListener('change', e => { if (e.target.id === 'u1du-k') { K = +e.target.value; render(); } });
  render();
}

// ============================================================ 5. BRIN (slides 42-43)
function lcg(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
const BRIN_SETS = (() => {
  const r = lcg(7), clustered = [], scattered = [], r2 = lcg(99);
  for (let i = 0; i < 10; i++) { clustered.push(Array.from({ length: 4 }, () => i * 100 + Math.floor(r() * 100)).sort((a, b) => a - b)); scattered.push(Array.from({ length: 4 }, () => Math.floor(r2() * 1000)).sort((a, b) => a - b)); }
  return { clustered, scattered, slide: [[10, 20], [30, 31, 33, 38], [40, 44, 50], [60]] };
})();
export function u1BRIN(el) {
  let set = 'clustered', lo = 420, hi = 450;
  const render = () => {
    const pages = BRIN_SETS[set], q = brinQuery(pages, lo, hi), max = set === 'slide' ? 65 : 1000;
    const read = q.filter(x => x.read).length, wasted = q.filter(x => x.wasted).length, matches = q.reduce((a, x) => a + x.matches, 0), rows = pages.flat().length;
    const pc = x => (x / max * 100).toFixed(2);
    const verdict = read <= pages.length * .3 ? ['good', 'BRIN pays off: most pages are skipped without being read.'] : read >= pages.length * .8 ? ['bad', 'BRIN barely helps: nearly every page range overlaps the query, so almost the whole table is read.'] : ['acc', 'Partly useful: some pages are skipped.'];
    el.innerHTML = `${CSS}${bench('arrows-horizontal', 'BRIN: which pages can be skipped?', 'Min and max per page')}<div class="bench-body">
      <div class="row">${seg([['clustered', 'Column follows the page order'], ['scattered', 'Scattered column'], ['slide', 'Slide 43 example']], set, 'data-set')}</div>
      <div class="row">${numIn('u1br-lo', 'Query from', lo)}${numIn('u1br-hi', 'to', hi)}<button class="btn sm primary" type="button" data-go><i class="ph ph-funnel"></i>Run</button>
        <button class="btn sm" type="button" data-pre="narrow">Narrow range</button><button class="btn sm" type="button" data-pre="wide">Wide range</button><button class="btn sm" type="button" data-pre="point">Single value</button></div>
      <div class="lab">BRIN entries (min to max of each page) on a number line, query shaded</div>
      <div style="position:relative;margin-top:6px">
        <div style="position:absolute;left:150px;right:0;top:0;bottom:0;pointer-events:none"><div style="position:absolute;left:${pc(Math.max(0, lo))}%;width:${Math.max(.6, pc(Math.min(max, hi) - Math.max(0, lo)))}%;top:-2px;bottom:-2px;background:color-mix(in srgb,var(--second) 22%,transparent);border-left:2px solid var(--second);border-right:2px solid var(--second)"></div></div>
        ${q.map(x => `<div style="display:flex;align-items:center;gap:8px;height:30px"><div style="width:142px;font-family:var(--mono);font-size:12px;color:${x.read ? 'var(--ink)' : 'var(--faint)'}">P${x.p + 1} [${x.min}, ${x.max}]</div><div style="position:relative;flex:1;height:14px;background:var(--sunken);border-radius:4px"><div style="position:absolute;left:${pc(x.min)}%;width:${Math.max(.8, pc(x.max - x.min))}%;top:0;bottom:0;border-radius:4px;background:${x.read ? 'var(--accent-viz)' : 'var(--context)'}"></div></div><div style="width:84px;font-size:12px"><span class="tag ${x.read ? (x.wasted ? 'bad' : 'acc') : ''}">${x.read ? (x.wasted ? 'read, no match' : 'read') : 'skipped'}</span></div></div>`).join('')}
      </div>
      <div class="stats">${stat('pages read', `${read}/${pages.length}`, read <= pages.length * .3 ? 'good' : 'bad')}${stat('pages skipped', pages.length - read, 'good')}${stat('read but no match', wasted, wasted ? 'bad' : '')}${stat('matching rows', matches)}${stat('BRIN pairs vs dense pairs', `${pages.length} vs ${rows}`)}</div>
      <div class="callout ${verdict[0] === 'bad' ? 'trap' : 'key'}" style="max-width:none"><i class="ph ph-${verdict[0] === 'bad' ? 'warning' : 'lightbulb'}"></i><div>${verdict[1]} ${set === 'scattered' ? 'Every page holds small and large values, so every min..max range spans almost the whole axis. A BRIN index only works when the column roughly follows the physical order of the table.' : set === 'clustered' ? 'The values rise with the page number, so each page covers a narrow slice of the range. A narrow query overlaps one or two pages. Widen the range and the saving shrinks.' : 'The ranges are 10 to 20, 30 to 38, 40 to 50 and 60: a lookup of 45 reads only page 3.'}</div></div>
    </div>`;
  };
  const run = () => { const a = parseFloat($(el, '#u1br-lo').value), b = parseFloat($(el, '#u1br-hi').value); if (Number.isFinite(a) && Number.isFinite(b)) { lo = Math.min(a, b); hi = Math.max(a, b); } render(); };
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.set) { set = b.dataset.set; if (set === 'slide') { lo = 45; hi = 45; } else { lo = 420; hi = 450; } render(); }
    else if ('go' in b.dataset) run();
    else if (b.dataset.pre) { const s = set === 'slide' ? { narrow: [30, 31], wide: [15, 55], point: [45, 45] } : { narrow: [420, 450], wide: [150, 750], point: [455, 455] }; [lo, hi] = s[b.dataset.pre]; render(); }
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); run(); } });
  render();
}

// ============================================================ 6. Multilevel index sizes (slides 44-45, PA1-3)
export function u1Multilevel(el) {
  let n = 1000000, r = 10, p = 100, mem = 15, dense = false;
  const PRE = { lec: [1000000, 10, 100, 15, false, 'Lecture: 1 M rows, memory 15 pages'], lec1: [1000000, 10, 100, 1, false, 'Lecture: memory of 1 page'], dense: [1000000, 10, 100, 15, true, 'Same table, dense first level'], pad: [1000, 1, 10, 1, true, 'PA1-3 dense, n = 1000'], pas: [3000, 3, 10, 1, false, 'PA1-3 sparse, n = 3000'] };
  const render = () => {
    const lv = levelsOf(n, r, p, dense), io = lookupIO(lv, mem), tp = lv.tablePages, rowsAll = [{ name: 'Table', pages: tp, tbl: true }, ...lv.levels.map((l, i) => ({ name: `Level ${i + 1}${i === 0 ? (dense ? ' (dense)' : ' (sparse)') : ' (sparse)'}`, pages: l.pages, entries: l.entries, i }))];
    const mx = Math.log10(Math.max(tp, 10)) + .3;
    const nLv = lv.levels.length, scan = tp, bin = Math.max(1, Math.ceil(Math.log2(tp)));
    const f = dense ? (n - 1) / (p - 1) : (n / r - 1) / (p - 1);
    el.innerHTML = `${CSS}${bench('stack', 'How many levels? How many pages?', 'Slides 44 to 45, PA1-3')}<div class="bench-body">
      <div class="chips" style="margin-bottom:10px">${Object.entries(PRE).map(([k, v]) => `<button type="button" class="chip" data-pre="${k}">${v[5]}</button>`).join('')}</div>
      <div class="row">${numIn('u1ml-n', 'Rows n', n)}${numIn('u1ml-r', 'Rows per table page', r)}${numIn('u1ml-p', 'Pairs per index page', p)}${numIn('u1ml-m', 'Memory (pages)', mem)}${seg([['sparse', 'Sparse first level'], ['dense', 'Dense first level']], dense ? 'dense' : 'sparse', 'data-d')}</div>
      <div class="lab">Pages per level (bar length is logarithmic)</div>
      ${rowsAll.slice().reverse().map(x => { const inMem = !x.tbl && x.i >= nLv - io.inMem; return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0"><div style="width:130px;font-size:13px">${x.name}</div><div style="flex:1"><div class="bar" style="width:${Math.max(1, Math.log10(x.pages + 1) / mx * 100).toFixed(1)}%;${x.tbl ? 'background:var(--context)' : inMem ? 'background:var(--good)' : ''}"></div></div><div class="num" style="width:150px;font-size:13px;text-align:right">${fmt(x.pages, 0)} page${x.pages > 1 ? 's' : ''}${inMem ? ' <span class="tag good">memory</span>' : ''}</div></div>`; }).join('')}
      <div class="stats">${stat('table pages', fmt(tp, 0))}${stat('index levels', nLv, 'acc')}${stat('index pages in total', fmt(lv.total, 0), 'acc')}${stat('disk reads per lookup', io.disk, 'good')}${stat('full scan reads', fmt(scan, 0), 'bad')}${stat('binary search on sorted table', bin)}</div>
      ${log([[`Level 1 has <strong>${fmt(lv.levels[0].entries, 0)}</strong> pairs (${dense ? 'one per row' : 'one per table page'}) / ${fmt(p, 0)} per page = <strong>${fmt(lv.levels[0].pages, 0)}</strong> pages.`], ...lv.levels.slice(1).map((l, i) => [`Level ${i + 2} indexes the ${fmt(l.entries, 0)} pages of level ${i + 1}: ${fmt(l.entries, 0)} pairs / ${fmt(p, 0)} = <strong>${fmt(l.pages, 0)}</strong> page${l.pages > 1 ? 's' : ''}.`]), [`The top level has one page, so the search starts there. Total index = <strong>${fmt(lv.total, 0)}</strong> pages (closed form (${dense ? 'n' : 'n/r'} − 1)/(p − 1) = ${fmt(f, 1)}).`, 'ok'], [`With ${mem} page${mem > 1 ? 's' : ''} of memory the top ${io.inMem} level${io.inMem === 1 ? '' : 's'} (${io.memUsed} page${io.memUsed === 1 ? '' : 's'}) stay in memory. A lookup costs ${nLv - io.inMem} index read${nLv - io.inMem === 1 ? '' : 's'} from disk + 1 table read = <strong>${io.disk}</strong>.`, io.disk <= 3 ? 'ok' : 'bad']])}
      <p class="small muted">PA1-3 formulas: dense with 10 pairs per page and one row per block: (n − 1)/9. Sparse with 3 rows per block: (n − 3)/27. They are exact when n is a clean power of 10 (dense) or 3 × power of 10 (sparse). Otherwise round every level up.</p>
    </div>`;
  };
  const read = () => { const g = id => parseInt(($(el, `#${id}`).value || '').replace(/[, ]/g, ''), 10); const a = g('u1ml-n'), b = g('u1ml-r'), c = g('u1ml-p'), d = g('u1ml-m'); if (a >= 1 && b >= 1 && c >= 2 && d >= 1 && a <= 1e12) { n = a; r = b; p = c; mem = d; } };
  el.addEventListener('change', e => { if (e.target.matches('input')) { read(); render(); } });
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.pre) { [n, r, p, mem, dense] = PRE[b.dataset.pre]; render(); } else if (b.dataset.d) { dense = b.dataset.d === 'dense'; render(); } });
  render();
}

// ============================================================ 7. Midterm 2025, Exercise 2 (MID-03, MID-04)
const MT = [['Ahmed', 18, 0.7], ['Sara', 20, 1.0], ['Youssef', 22, 1.3], ['Mariam', 18, 1.6], ['Omar', 20, 1.9], ['Nour', 22, 2.1], ['Karim', 18, 2.3], ['Salma', 20, 2.5]];
export function u1Midterm(el) {
  let tab = 'a', sortBy = 'gpa', step = 1, lo = 1.3, hi = 1.6, age = 20, picked = new Set([18]);
  const STEPS = { a: 3, b: 3, c: 2 };
  const render = () => {
    const rows = sortBy === 'gpa' ? MT : [...MT].sort((x, y) => x[1] - y[1] || x[2] - y[2]), pages = chunk(rows, 2);
    const tcol = tblCol(pages, 2, `Table pages (sorted on ${sortBy})`, r => `${r[0]} ${r[1]} ${r[2].toFixed(1)}`, { w: 124 });
    let body = '', note = '';
    if (tab === 'a') {
      const ent = pages.flatMap((pg, p) => pg.map(r => ({ k: r[1], p }))).sort((a, b) => a.k - b.k || a.p - b.p), dp = chunk(ent, 4), sp = dp.map((pg, i) => ({ k: pg[0].k, p: i }));
      const dcol = idxCol(ent, 4, 'L2 dense on age'), scol = idxCol(sp, 4, 'L1 sparse');
      const hl = { pages: new Set(), arrows: new Set(), cells: new Set() };
      if (step >= 3) { dp.forEach((pg, i) => pg.forEach((e, j) => { if (e.k === age) { hl.cells.add(`1.${i}.${j}`); hl.arrows.add(`1.${i}.${j}`); hl.pages.add(`2.${e.p}`); } })); let le = 0; sp.forEach((e, i) => { if (e.k < age) le = i; }); hl.cells.add(`0.0.${le}`); hl.arrows.add(`0.0.${le}`); hl.pages.add(`1.${sp[le].p}`); }
      const cols = step === 1 ? [tcol] : step === 2 ? [dcol, tcol] : [scol, dcol, tcol];
      if (step < 3) { hl.cells = new Set(); hl.arrows = new Set(); hl.pages = new Set(); }
      const hlx = step === 3 ? hl : {};
      body = `<div class="scr">${drawCols(cols, { hl: hlx })}</div>`;
      note = [`<strong>Step 1.</strong> Table sorted on ${sortBy}, 2 rows per page: ${pages.length} pages.`, `<strong>Step 2.</strong> Dense level on age: one pair per row (${ent.length} pairs), sorted by age, ${dp.length} pages of 4 pairs. Equal ages repeat (approach 1).`, `<strong>Step 3.</strong> ${dp.length} pages is more than 1, so add a sparse level with one pair per page of the dense level: ${sp.length} pairs fit in <strong>one</strong> page. Done. Trace a lookup with the selector.`][step - 1];
      if (step >= 2 && sortBy === 'gpa') note += `<div class="callout trap" style="max-width:none"><i class="ph ph-warning"></i><div><strong>Check against the official solution (MID-03).</strong> It prints &lt;20, 2&gt; as the fourth pair, but Sara (age 20) is in table page 1. The correct pair is &lt;20, 1&gt;. The rest of the figure matches.</div></div>`;
      if (sortBy === 'age') note += `<div class="callout key" style="max-width:none"><i class="ph ph-lightbulb"></i><div>With the table sorted on age, an index on age would be a <em>primary</em> index and could be sparse (one pair per page). The exam says the table is sorted on <strong>gpa</strong>, so the index on age is secondary and its first level must be dense.</div></div>`;
    } else if (tab === 'b') {
      const maps = bitmap(rows.map(r => r[1])), shown = maps.slice(0, step);
      const sel2 = maps.filter(m => picked.has(m.value)), res = sel2.length ? bitOr(...sel2.map(m => m.bits)) : '0'.repeat(rows.length);
      body = `<div class="scr"><div class="bits" style="margin:8px 0 2px"><span style="width:54px;border:0;background:none;font-size:11px;color:var(--muted)">row</span>${rows.map(r => `<span style="font-size:10px;width:50px;border:0;background:none;color:var(--muted)">${r[0]}</span>`).join('')}</div>
        ${shown.map(m => `<div class="bits" style="margin:4px 0;align-items:center"><span style="width:54px;border:0;background:none;font-weight:600">${m.value}:</span>${[...m.bits].map(c => `<span style="width:50px" class="${c === '1' ? 'one' : ''}">${c}</span>`).join('')}</div>`).join('')}</div>
        ${step >= 3 ? `<div class="lab">Combine vectors with OR: which students are aged ...</div><div class="chips">${maps.map(m => `<button type="button" class="chip" data-pick="${m.value}" aria-pressed="${picked.has(m.value)}">${m.value}</button>`).join('')}</div>
        <div class="scr"><div class="bits" style="margin-top:8px"><span style="width:54px;border:0;background:none;font-weight:600">result:</span>${[...res].map(c => `<span style="width:50px" class="res ${c === '1' ? 'one' : ''}">${c}</span>`).join('')}</div></div>
        <p class="small">Rows selected: <strong>${rows.filter((r, i) => res[i] === '1').map(r => r[0]).join(', ') || 'none'}</strong>. A bitmap index suits columns with few distinct values (here 3), and AND / OR / NOT on bit vectors answers combined conditions without touching the table.</p>` : ''}`;
      note = [`<strong>Step 1.</strong> One bit vector per distinct age, one bit per row in table order. The vector for 18 has a 1 where the age is 18.`, `<strong>Step 2.</strong> Vector for 20. The vectors never overlap: each row has exactly one 1 across all vectors of a column.`, `<strong>Step 3.</strong> Vector for 22. The three vectors together give every row exactly one 1. The order of the bits follows the row order in the file (${sortBy}-sorted here).`][step - 1];
    } else {
      const g = pages.map(pg => pg.map(r => r[2])), br = brinOf(g), ent = br.map(e => ({ k: `(${e.min.toFixed(1)}, ${e.max.toFixed(1)})`, p: e.p }));
      const bq = brinQuery(g, lo, hi), hl = { pages: new Set(), skip: new Set(), arrows: new Set(), dimArrows: new Set() };
      if (step >= 2) bq.forEach(x => { if (x.read) { hl.pages.add(`1.${x.p}`); hl.arrows.add(`0.0.${x.p}`); } else { hl.skip.add(`1.${x.p}`); hl.dimArrows.add(`0.0.${x.p}`); } });
      body = `<div class="scr">${drawCols([idxCol(ent, 4, 'BRIN index on GPA', { kw: 104 }), tcol], { hl })}</div>
        ${step >= 2 ? `<div class="row" style="margin-top:8px">${numIn('u1mt-lo', 'GPA from', lo)}${numIn('u1mt-hi', 'to', hi)}<button class="btn sm primary" type="button" data-q><i class="ph ph-funnel"></i>Run</button></div>
        <div class="stats">${stat('pages read', `${bq.filter(x => x.read).length}/${bq.length}`, bq.filter(x => x.read).length <= 2 ? 'good' : 'bad')}${stat('matching rows', bq.reduce((a, x) => a + x.matches, 0))}</div>` : ''}`;
      note = [`<strong>Step 1.</strong> For each table page store its minimum and maximum GPA: &lt;(0.7, 1.0), 1&gt;, &lt;(1.3, 1.6), 2&gt;, &lt;(1.9, 2.1), 3&gt;, &lt;(2.3, 2.5), 4&gt;. Four pairs fit in one index page (matches MID-04) when the table is sorted on GPA.`, `<strong>Step 2.</strong> Query on a GPA range: read only pages whose (min, max) overlaps it, skip the rest.`][step - 1];
      if (sortBy === 'age') note += `<div class="callout trap" style="max-width:none"><i class="ph ph-warning"></i><div>The table is now sorted on age, so every page holds small AND large GPAs. The ranges overlap and BRIN can skip almost nothing. BRIN needs the column to follow the physical order.</div></div>`;
    }
    el.innerHTML = `${CSS}${bench('exam', 'Midterm 2025, Exercise 2, step by step', 'MID-03 and MID-04')}<div class="bench-body">
      <div class="row">${seg([['a', '(a) Dense multilevel on age'], ['b', '(b) Bitmap on age'], ['c', '(c) BRIN on GPA']], tab, 'data-tab')}${seg([['gpa', 'Table sorted on GPA (exam)'], ['age', 'Sorted on age (what if?)']], sortBy, 'data-sort')}</div>
      ${tab === 'a' && step === 3 ? `<div class="row">${sel('u1mt-age', 'Trace a lookup of age', [[18, 18], [20, 20], [22, 22]], age)}</div>` : ''}
      ${body}
      <div class="small" style="margin-top:8px">${note}</div>
      <div class="row" style="margin-top:10px"><button class="btn sm" type="button" data-prev ${step <= 1 ? 'disabled' : ''}><i class="ph ph-caret-left"></i>Previous</button><button class="btn sm primary" type="button" data-next ${step >= STEPS[tab] ? 'disabled' : ''}>Next step<i class="ph ph-caret-right"></i></button><span class="small muted">Step ${step} of ${STEPS[tab]}</span></div>
    </div>`;
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.tab) { tab = b.dataset.tab; step = 1; } else if (b.dataset.sort) { sortBy = b.dataset.sort; }
    else if ('next' in b.dataset) step++; else if ('prev' in b.dataset) step--;
    else if (b.dataset.pick) { const v = +b.dataset.pick; picked.has(v) ? picked.delete(v) : picked.add(v); }
    else if ('q' in b.dataset) { const a = parseFloat($(el, '#u1mt-lo').value), c = parseFloat($(el, '#u1mt-hi').value); if (Number.isFinite(a) && Number.isFinite(c)) { lo = Math.min(a, c); hi = Math.max(a, c); } }
    render();
  });
  el.addEventListener('change', e => { if (e.target.id === 'u1mt-age') { age = +e.target.value; render(); } });
  render();
}

// ============================================================ 8. PA1 Exercise 1-4: three levels with duplicates
export function u1PA14(el) {
  const F = [50, 80, 100, 100, 100, 150, 150, 200, 200, 300, 410, 410, 410, 420, 430, 450], pages = chunk(F, 2);
  let ap = 2, step = 4, K = 100;
  const render = () => {
    const l1 = ap === 2 ? denseFirst(pages) : denseAll(pages); const L = [l1];
    while (L.length < 3) { const last = L[L.length - 1]; L.push(chunk(last, 2).map((pg, i) => ({ k: pg[0].k, p: i }))); }
    const tcol = tblCol(pages, 2, 'Table D', String, { w: 46 });
    const cols = [idxCol(L[2], 2, 'L3 sparse'), idxCol(L[1], 2, 'L2 sparse'), idxCol(L[0], 2, `L1 dense`), tcol];
    // lookup trace
    const hl = { pages: new Set(), arrows: new Set(), cells: new Set() }; const trace = [];
    const pick = (ent, pgIdx, rule) => { const flat = chunk(ent, 2); const pg = flat[pgIdx] || []; let j = 0; pg.forEach((e, i) => { if (rule === 'le' ? e.k <= K : e.k < K) j = i; }); return { pg, j, e: pg[j] }; };
    let pageAt = 0, ok = true; const rule = ap === 2 ? 'le' : 'lt';
    [2, 1].forEach(li => {
      const flatL = chunk(L[li], 2); let pi = li === 2 ? 0 : pageAt;
      if (li === 2) { let jj = 0; L[li].forEach((e, i) => { if (rule === 'le' ? e.k <= K : e.k < K) jj = i; }); pi = Math.floor(jj / 2); }
      const r = pick(L[li], pi, rule); hl.pages.add(`${2 - li}.${pi}`); hl.cells.add(`${2 - li}.${pi}.${r.j}`); hl.arrows.add(`${2 - li}.${pi}.${r.j}`); pageAt = r.e.p; trace.push(`Level ${li + 1}, page ${pi + 1}: take pair &lt;${r.e.k}, ${r.e.p + 1}&gt;`);
    });
    const l1p = chunk(L[0], 2); let startPage = null; let found = false;
    hl.pages.add(`2.${pageAt}`);
    outer: for (let pi = pageAt; pi < l1p.length; pi++) for (let j = 0; j < l1p[pi].length; j++) { const e = l1p[pi][j]; if (e.k === K) { hl.cells.add(`2.${pi}.${j}`); hl.arrows.add(`2.${pi}.${j}`); hl.pages.add(`2.${pi}`); startPage = e.p; found = true; break outer; } if (e.k > K) break outer; }
    const tset = found ? scanFrom(pages, startPage, K) : new Set(); tset.forEach(p => hl.pages.add(`3.${p}`));
    trace.push(found ? `Level 1: pair for ${K} points at table page ${startPage + 1}` : `Level 1: no pair with key ${K}, so the key is not in the table`);
    const useCols = cols.slice(4 - step); const shift = 4 - step;
    const sh = s => new Set([...s].map(k => { const a = k.split('.'); a[0] = +a[0] - shift; return a.join('.'); }).filter(k => +k.split('.')[0] >= 0));
    const hl2 = step === 4 ? { pages: sh(hl.pages), arrows: sh(hl.arrows), cells: sh(hl.cells) } : {};
    const keys = [...new Set(F), 120];
    el.innerHTML = `${CSS}${bench('stack', 'PA1-4: a 3-level index with duplicates', 'Page = 2 rows or 2 pairs')}<div class="bench-body">
      <div class="row">${seg([[2, 'Dense level: one pair per distinct value'], [1, 'Dense level: one pair per row']], ap, 'data-ap')}${sel('u1p4-k', 'Look up F =', keys.map(v => [v, v]), K)}</div>
      <div class="scr">${drawCols(useCols, { hl: hl2 })}</div>
      <div class="stats">${stat('level 1 pairs', L[0].length, 'acc')}${stat('level 1 pages', Math.ceil(L[0].length / 2), 'acc')}${stat('level 2 pages', Math.ceil(L[1].length / 2))}${stat('level 3 pages', Math.ceil(L[2].length / 2))}${stat('index pages in total', Math.ceil(L[0].length / 2) + Math.ceil(L[1].length / 2) + Math.ceil(L[2].length / 2), 'acc')}</div>
      <div class="row"><button class="btn sm" type="button" data-prev ${step <= 1 ? 'disabled' : ''}><i class="ph ph-caret-left"></i>Hide a level</button><button class="btn sm primary" type="button" data-next ${step >= 4 ? 'disabled' : ''}>Build next level<i class="ph ph-caret-right"></i></button><span class="small muted">${['', 'Table D stored in 8 pages of 2 rows.', 'Level 1 is dense: it lists each distinct value and points to the page of its FIRST occurrence.', 'Level 2 is sparse: one pair per page of level 1.', 'Level 3 is sparse: one pair per page of level 2. That is the 3-level index.'][step]}</span></div>
      ${step === 4 ? log([...trace.map(t => [t]), [found ? `Then read table page${tset.size > 1 ? 's' : ''} <strong>${[...tset].sort((a, b) => a - b).map(p => p + 1).join(', ')}</strong>: the first page where ${K} occurs, and keep reading while a page still ends in ${K}. Total page reads: 3 index + ${tset.size} table.` : 'Total page reads: 3 index pages and no table page.', found ? 'ok' : 'bad']]) : ''}
    </div>`;
  };
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; if (b.dataset.ap) ap = +b.dataset.ap; else if ('next' in b.dataset) step++; else if ('prev' in b.dataset) step--; render(); });
  el.addEventListener('change', e => { if (e.target.id === 'u1p4-k') { K = +e.target.value; render(); } });
  render();
}

// ============================================================ 9. PA1 Exercise 1-5: CRUD with three indices
const DIS = [[1, 'Mickey', 73], [2, 'Bat', 54], [3, 'Wonder', 39], [4, 'Donald', 65], [5, 'Bugs', 58], [6, 'Wiley', 61], [7, 'Cat', 32], [8, 'Tweety', 28]];
export function u1PA15(el) {
  let rows = DIS.map(r => [...r]), view = 'dense', info = null, hlq = null;
  const idxs = rs => {
    const pg = chunk(rs, 2);
    return {
      dense: pg.flatMap((p, i) => p.map(r => ({ k: r[0], p: i, id: r[0] }))),
      sparse: pg.map((p, i) => ({ k: p[0][0], p: i, id: p[0][0] })),
      sec: pg.flatMap((p, i) => p.map(r => ({ k: r[2], p: i, id: r[0] }))).sort((a, b) => a.k - b.k),
    };
  };
  const sig = e => `${e.id}:${e.k}:${e.p}`;
  const diff = (a, b) => { const sa = new Set(a.map(sig)), sb = new Set(b.map(sig)); return { added: b.filter(e => !sa.has(sig(e))).length, removed: a.filter(e => !sb.has(sig(e))).length }; };
  const doOp = op => {
    const before = idxs(rows); const L = []; let q = null;
    if (op === 'ins') { if (rows.some(r => r[1] === 'Minnie')) return; rows.push([rows.length ? Math.max(...rows.map(r => r[0])) + 1 : 1, 'Minnie', 72]); L.push('The table now has 9 rows. All 4 pages are full, so Minnie starts <strong>page 5</strong>.', 'Primary dense: new pair &lt;9, 5&gt; at the end. Primary sparse: new pair &lt;9, 5&gt; (page 5 is new). Secondary on age: &lt;72, 5&gt; goes between 65 and 73, so the pair for 73 shifts one slot down (and the index spills into a third page).'); }
    else if (op === 'del') { if (rows.length < 3) return; const g = rows[2]; rows.splice(2, 1); L.push(`Delete the third row (${g[1]}, age ${g[2]}). The official solution closes the gap, so every later row moves up and the later pages change (cost O(n)).`, 'Every index pair that pointed at a moved row needs a new page number. Primary indices change too (their keys are the IDs). The secondary index loses the pair for age ' + g[2] + '.'); }
    else if (op === 'upd') { const t = rows.find(r => r[1] === 'Tweety'); if (!t || t[2] === 29) return; t[2] = 29; L.push('Find Tweety in the table (via the primary index) and change the age 28 to 29 inside its page.', 'The primary indices are keyed on Char ID, which did not change: <strong>no change</strong>. Only the secondary index on age holds the old key: replace the pair &lt;28, page&gt; by &lt;29, page&gt;. 29 is still the smallest age, so the pair stays in the same slot: a simple in-place update without shifting.'); }
    else if (op === 'rng') {
      const sec = before.sec, hit = sec.filter(e => e.k >= 30 && e.k <= 60), pgs = new Set(hit.map(e => e.p));
      q = { hit, pgs }; L.push(`Index scan on the secondary index: find the first pair with age ≥ 30, then read pairs while age ≤ 60: ${hit.length} pair${hit.length > 1 ? 's' : ''} (${hit.map(e => e.k).join(', ')}). Cost O(log n) to find the start, then the matching pairs.`, `They point to table page${pgs.size > 1 ? 's' : ''} ${[...pgs].sort((a, b) => a - b).map(p => p + 1).join(', ')}: ${hit.map(e => rows.find(r => r[0] === e.id)[1]).join(', ')}.`, `The alternative is a sequential scan: read all ${chunk(rows, 2).length} table pages, O(n). The planner chooses between them.`);
    }
    const after = idxs(rows);
    info = { L, q, d: op === 'rng' ? null : { dense: diff(before.dense, after.dense), sparse: diff(before.sparse, after.sparse), sec: diff(before.sec, after.sec) } };
  };
  const render = () => {
    const ix = idxs(rows), pg = chunk(rows, 2), ent = ix[view];
    const hl = { pages: new Set(), arrows: new Set(), cells: new Set() };
    if (info && info.q && view === 'sec') { chunk(ent, 4).forEach((p, i) => p.forEach((e, j) => { if (info.q.hit.includes(e) || info.q.hit.some(h => h.id === e.id)) { hl.cells.add(`0.${i}.${j}`); hl.arrows.add(`0.${i}.${j}`); } })); info.q.pgs.forEach(p => hl.pages.add(`1.${p}`)); }
    const ic = idxCol(ent, 4, view === 'dense' ? 'Dense (ID)' : view === 'sparse' ? 'Sparse (ID)' : 'Secondary (Age)');
    const tc = tblCol(pg, 2, 'Table pages (2 rows each)', r => `${r[0]} ${r[1]} ${r[2]}`, { w: 130 });
    const D = info && info.d;
    el.innerHTML = `${CSS}${bench('mouse-simple', 'PA1-5: the cartoon table, CRUD step by step', 'Do the steps in order (d to g)')}<div class="bench-body">
      <div class="row">${seg([['dense', 'Primary dense'], ['sparse', 'Primary sparse'], ['sec', 'Secondary on age']], view, 'data-view')}</div>
      <div class="row"><button class="btn sm primary" type="button" data-op="ins"><i class="ph ph-plus"></i>(d) Insert Minnie, 72</button><button class="btn sm" type="button" data-op="del"><i class="ph ph-minus"></i>(e) Delete row 3</button><button class="btn sm" type="button" data-op="upd"><i class="ph ph-pencil"></i>(f) Tweety age to 29</button><button class="btn sm" type="button" data-op="rng"><i class="ph ph-funnel"></i>(g) Ages 30 to 60</button><button class="btn sm ghost" type="button" data-reset><i class="ph ph-arrow-counter-clockwise"></i>Reset</button></div>
      <div class="scr">${drawCols([ic, tc], { hl })}</div>
      <div class="stats">${stat('table rows', rows.length)}${stat('table pages', pg.length)}${stat('index pages', Math.ceil(ent.length / 4), 'acc')}</div>
      ${D ? `<div class="stats">${stat('dense: pairs added / removed', `${D.dense.added} / ${D.dense.removed}`, D.dense.added + D.dense.removed ? 'bad' : 'good')}${stat('sparse: pairs added / removed', `${D.sparse.added} / ${D.sparse.removed}`, D.sparse.added + D.sparse.removed ? 'bad' : 'good')}${stat('secondary: pairs added / removed', `${D.sec.added} / ${D.sec.removed}`, D.sec.added + D.sec.removed ? 'bad' : 'good')}</div><p class="small muted">Counts compare each pair (key and page) before and after.</p>` : ''}
      ${info ? log(info.L.map(t => [t])) : '<p class="small muted">The table shows the corrected version of the PA figure: Tweety lives in Law, age 28 (the official picture prints "Gotham 54" by mistake).</p>'}
    </div>`;
  };
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.view) view = b.dataset.view; else if (b.dataset.op) doOp(b.dataset.op); else if ('reset' in b.dataset) { rows = DIS.map(r => [...r]); info = null; } render(); });
  render();
}

// ============================================================ 10. Sorter games
export const u1SortDS = el => sorter(el, {
  id: 'u1-dense-sparse', title: 'Dense or sparse?', hint: 'Decide for each description whether it points to a dense or a sparse index.', options: ['Dense', 'Sparse'], cols: 300,
  items: [
    { t: 'One key-pointer pair for every row of the table.', a: 'Dense', why: 'That is the definition of dense.' },
    { t: 'One key-pointer pair per table page.', a: 'Sparse', why: 'Sparse = one pair per page.' },
    { t: 'An index on a column the table is NOT sorted on.', a: 'Dense', why: 'A secondary index must be dense: a page minimum says nothing about the other values in an unsorted page.' },
    { t: 'Needs the table to be sorted on the search key.', a: 'Sparse', why: 'Sparse gives a "sense of location", which only works on sorted data.' },
    { t: 'Blocks hold 3 rows or 10 pairs. The index needs n/10 blocks.', a: 'Dense', why: 'n pairs / 10 per block = n/10. PA1-2 b.' },
    { t: 'Blocks hold 3 rows or 10 pairs. The index needs n/30 blocks.', a: 'Sparse', why: '(n/3 pages) pairs / 10 per block = n/30. PA1-2 c.' },
    { t: 'Every level above the first level of a multilevel index.', a: 'Sparse', why: 'Each higher level has one pair per page of the level below.' },
    { t: 'The first level of a multilevel SECONDARY index.', a: 'Dense', why: 'Lecture takeaway: in secondary multilevel indices the first level must be dense.' },
    { t: 'A BRIN index.', a: 'Sparse', why: 'BRIN is a sparse index: one (min, max) pair per page.' },
    { t: 'Deleting a row that is not the smallest in its page never changes this index.', a: 'Sparse', why: 'Slide 35: deleting 40 left the sparse index untouched. A dense index always loses a pair.' },
    { t: 'Typically about 10% of the size of the column values.', a: 'Sparse', why: 'Lecture takeaway: sparse = a small percentage (typically 10%).' },
    { t: 'At least one instance of every value in the column.', a: 'Dense', why: 'Lecture takeaway on dense indices.' },
  ],
});
export const u1SortPS = el => sorter(el, {
  id: 'u1-primary-secondary', title: 'Primary or secondary?', hint: 'The question is always: is the table sorted on the indexed column?', options: ['Primary', 'Secondary'], cols: 300,
  items: [
    { t: 'Index on Char ID. The table is sorted by Char ID.', a: 'Primary', why: 'Same column as the sort order.' },
    { t: 'Index on Age. The table is sorted by Char ID.', a: 'Secondary', why: 'Not the sort column. PA1-5 c.' },
    { t: 'Index on a candidate key, but the rows are stored in insertion order.', a: 'Secondary', why: 'PA1-1 statement 5: any index on a column that does not sort the table is secondary, even on a candidate key.' },
    { t: 'An index that is allowed to be sparse.', a: 'Primary', why: 'Sparse needs a sorted table.' },
    { t: 'An index that MUST be dense.', a: 'Secondary', why: 'The table is not sorted on the key.' },
    { t: 'Midterm 2025 Ex 2a: dense multilevel index on age, table sorted on GPA.', a: 'Secondary', why: 'Sorted on GPA, indexed on age.' },
    { t: 'Midterm 2025 Ex 2c: BRIN on GPA, table sorted on GPA.', a: 'Primary', why: 'BRIN is a sparse index, so it belongs to the sorted column.' },
    { t: 'A clustered index: the table is sorted so that duplicates sit together.', a: 'Primary', why: 'Sorting on the key is what makes it primary / clustered.' },
    { t: 'Index on Age after Tweety changes from 28 to 29 (PA1-5 f): the index that has to change.', a: 'Secondary', why: 'Only the index keyed on the updated column changes.' },
    { t: 'Index whose duplicates need buckets of pointers or chained records.', a: 'Secondary', why: 'Equal keys scattered over many pages are a secondary-index problem.' },
  ],
});
export const u1SortTF = el => sorter(el, {
  id: 'u1-true-false', title: 'True or false?', hint: 'PA1-1 and the 2025 midterm statements (the course\'s official answers, with the catch).', options: ['True', 'False'], cols: 320,
  items: [
    { t: 'When a sparse index is used, each record must have an entry in the index.', a: 'False', why: 'Each block/page has an entry, not each record.' },
    { t: 'One-level secondary indices must be dense.', a: 'True', why: 'They index a column the table is not sorted on.' },
    { t: 'With two levels of secondary index, either level can be sparse or dense.', a: 'False', why: 'The first level must be dense. The second can be sparse.' },
    { t: 'A sparse index can only be used if the table is sorted by the search key, while a dense index works for any key.', a: 'True', why: 'Sparse gives a sense of location, so it needs sorted data.' },
    { t: 'An index on a candidate key or non-key field, with duplicates and a table not sorted by it, is a primary index.', a: 'False', why: 'It is a secondary index.' },
    { t: 'A primary index is non-dense because it is the main index and must be most efficient.', a: 'True', why: 'Official answer: True, because it needs the table ordered on the key, which allows a sparse index. Careful: the "most efficient" reason is weak, and the lecture also shows a dense primary index.' },
    { t: 'A clustered index is non-dense because sorting keeps duplicates together.', a: 'True', why: 'Official answer: True, each entry points at the page with the first value of the cluster. Careful: by the lecture\'s wording that is still "one instance per value".' },
    { t: 'Table data are stored as pages on the hard disk.', a: 'True', why: 'Midterm 2025 Ex 1.1.' },
    { t: 'A conventional index is a heap of key-pointer pairs.', a: 'False', why: 'It is a (sorted) list of key-pointer pairs, not a heap. Midterm 2025 Ex 1.2.' },
    { t: 'Inserting and deleting rows must be reflected in the indices on the table.', a: 'True', why: 'Midterm 2025 Ex 1.3.' },
  ],
});
