// Static SVG drawings shared by the simulators and the Problem lab answers.
// Every function returns an <svg class="viz ..."> string that uses the app's colour tokens, so it follows the theme.
import { leaves as bpLeaves } from './bptree.js';
import { extBuckets } from './hash.js';
import { quadRegions } from './multidim.js';
import { label as planLabel, fmt as costFmt } from './cost.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STY = `<style>
.dbv text{font-family:var(--mono);font-size:12px;fill:var(--ink)}
.dbv .lbl{font-family:var(--font);font-size:11px;fill:var(--muted)}
.dbv .box{fill:var(--surface);stroke:var(--line-strong);stroke-width:1.2}
.dbv .box.hl{fill:var(--accent-soft);stroke:var(--accent-viz);stroke-width:2}
.dbv .box.hl2{fill:var(--good-soft);stroke:var(--good);stroke-width:2}
.dbv .box.dim{opacity:.45}
.dbv .cell{stroke:var(--line);stroke-width:1}
.dbv .empty{fill:var(--faint)}
.dbv .edge{stroke:var(--muted);stroke-width:1.2;fill:none}
.dbv .edge.hl{stroke:var(--accent-viz);stroke-width:2}
.dbv .link{stroke:var(--faint);stroke-width:1.2;fill:none;stroke-dasharray:3 3}
.dbv .over{fill:var(--surface-2);stroke:var(--bad);stroke-width:1.2;stroke-dasharray:4 3}
.dbv .op{font-family:var(--font);font-size:13px;font-weight:600;fill:var(--ink)}
.dbv .size{font-family:var(--mono);font-size:11px;fill:var(--accent)}
.dbv .pt{fill:var(--accent-viz)}
.dbv .gridln{stroke:var(--muted);stroke-dasharray:4 3;stroke-width:1}
.dbv .frame{fill:none;stroke:var(--line-strong)}
.dbv .area{fill:var(--accent-soft);stroke:var(--accent-viz);stroke-width:1.5}
</style>`;
const svg = (w, h, body, cls = '', title = '') => `<svg class="viz dbv ${cls}" viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}" width="100%" style="max-width:${Math.ceil(w)}px" role="img"${title ? ` aria-label="${esc(title)}"` : ''}>${STY}${body}</svg>`;
const marker = id => `<defs><marker id="${id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="var(--muted)"/></marker></defs>`;
let UID = 0;

// A box split into `slots` cells showing `vals` (missing cells drawn empty).
function slotBox(x, y, slots0, vals, { cw = 30, h = 26, cls = '' } = {}) {
  const slots = Math.max(slots0, vals.length);
  let s = `<rect class="box ${cls}" x="${x}" y="${y}" width="${slots * cw}" height="${h}" rx="4"/>`;
  for (let i = slots0; i < slots; i++) s += `<rect x="${x + i * cw + 1}" y="${y + 1}" width="${cw - 2}" height="${h - 2}" rx="3" style="fill:var(--bad-soft);stroke:var(--bad);stroke-width:1.2"><title>overflow: more than n keys</title></rect>`;
  for (let i = 1; i < slots; i++) s += `<line class="cell" x1="${x + i * cw}" x2="${x + i * cw}" y1="${y}" y2="${y + h}"/>`;
  for (let i = 0; i < slots; i++) s += i < vals.length ? `<text x="${x + i * cw + cw / 2}" y="${y + h / 2 + 4}" text-anchor="middle">${esc(vals[i])}</text>` : `<circle class="empty" cx="${x + i * cw + cw / 2}" cy="${y + h / 2}" r="1.6"/>`;
  return s;
}

// ================================================================ B+ tree
// opts: { hl: [node ids], hl2: [node ids], cw (cell width) }
export function bptreeSVG(tree, opts = {}) {
  if (!tree.root) return `<div class="empty small" style="margin:8px 0"><i class="ph ph-tree-structure"></i>Empty tree.</div>`;
  const n = tree.n, cw = opts.cw || (n > 4 ? 26 : 30), h = 26, gap = 14, vgap = 54, nodeW = n * cw;
  const hl = new Set(opts.hl || []), hl2 = new Set(opts.hl2 || []);
  const ls = bpLeaves(tree), pos = new Map(), wOf = nd => Math.max(n, nd.keys.length) * cw;
  let cx0 = 0; ls.forEach(l => { pos.set(l.id, cx0); cx0 += wOf(l) + gap; });
  const depth = nd => nd.leaf ? 0 : 1 + depth(nd.children[0]);
  const H = depth(tree.root);
  const place = nd => {
    if (nd.leaf) return pos.get(nd.id);
    const xs = nd.children.map(place), x = (xs[0] + xs[xs.length - 1] + wOf(nd.children[nd.children.length - 1]) - wOf(nd)) / 2;
    pos.set(nd.id, x); return x;
  };
  place(tree.root);
  const W = cx0 - gap, mk = 'bpa' + (++UID);
  let body = marker(mk);
  const draw = (nd, lvl) => {
    const x = pos.get(nd.id), y = lvl * (h + vgap) + 4;
    if (!nd.leaf) nd.children.forEach((c, i) => {
      const cx = pos.get(c.id) + wOf(c) / 2, cy = (lvl + 1) * (h + vgap) + 4;
      const px = x + Math.min(i, n) * cw + (i === 0 ? 3 : 0);
      body += `<path class="edge ${hl.has(c.id) && hl.has(nd.id) ? 'hl' : ''}" d="M${px} ${y + h} C ${px} ${y + h + vgap / 2}, ${cx} ${cy - vgap / 2}, ${cx} ${cy - 2}" marker-end="url(#${mk})"/>`;
      draw(c, lvl + 1);
    });
    body += slotBox(x, y, n, nd.keys, { cw, h, cls: hl.has(nd.id) ? 'hl' : hl2.has(nd.id) ? 'hl2' : '' });
  };
  draw(tree.root, 0);
  const ly = H * (h + vgap) + 4 + h / 2;
  ls.slice(0, -1).forEach(l => { const x = pos.get(l.id) + wOf(l); body += `<line class="link" x1="${x + 1}" x2="${x + gap - 2}" y1="${ly}" y2="${ly}" marker-end="url(#${mk})"/>`; });
  return svg(W + 2, (H + 1) * (h + vgap) - vgap + 10, body, 'bp', `B+ tree with n = ${n}`);
}

// ================================================================ extensible hashing
export function extHashSVG(s, opts = {}) {
  const hl = opts.hl || {}, groups = extBuckets(s), rowH = 26, dirW = Math.max(46, 14 + s.i * 10), cap = s.cap, cw = 54;
  const dirH = s.dir.length * rowH, bh = cap * 22, bgap = 16;
  const totalB = groups.length * (bh + bgap) - bgap, H = Math.max(dirH, totalB) + 40;
  const bx = dirW + 120, mk = 'exa' + (++UID);
  let body = marker(mk) + `<text class="lbl" x="0" y="12">i = ${s.i}</text>`;
  const dy = 22 + (H - 22 - dirH) / 2, by0 = 22 + (H - 22 - totalB) / 2;
  s.dir.forEach((id, e) => {
    const y = dy + e * rowH, w = s.i ? e.toString(2).padStart(s.i, '0') : '·';
    body += `<rect class="box ${hl.entry === e ? 'hl' : ''}" x="0" y="${y}" width="${dirW}" height="${rowH}" rx="3"/><text x="${dirW / 2}" y="${y + rowH / 2 + 4}" text-anchor="middle">${w}</text>`;
  });
  groups.forEach((g, gi) => {
    const y = by0 + gi * (bh + bgap), cls = hl.bucket === g.id ? 'hl' : hl.bucket2 === g.id ? 'hl2' : '';
    g.entries.forEach(e => { const sy = dy + e * rowH + rowH / 2; body += `<path class="edge" d="M${dirW} ${sy} C ${dirW + 60} ${sy}, ${bx - 60} ${y + bh / 2}, ${bx - 2} ${y + bh / 2}" marker-end="url(#${mk})"/>`; });
    body += `<rect class="box ${cls}" x="${bx}" y="${y}" width="${cw}" height="${bh}" rx="3"/>`;
    for (let k = 1; k < cap; k++) body += `<line class="cell" x1="${bx}" x2="${bx + cw}" y1="${y + k * 22}" y2="${y + k * 22}"/>`;
    g.recs.forEach((r, k) => body += `<text x="${bx + cw / 2}" y="${y + k * 22 + 15}" text-anchor="middle">${esc(r)}</text>`);
    body += `<rect x="${bx + cw + 4}" y="${y}" width="18" height="18" rx="3" class="box"/><text x="${bx + cw + 13}" y="${y + 13}" text-anchor="middle" style="font-size:11px">${g.j}</text>`;
    if (g.over && g.over.length) body += `<rect class="over" x="${bx + cw + 32}" y="${y}" width="${cw}" height="22" rx="3"/><text x="${bx + cw * 1.5 + 32}" y="${y + 15}" text-anchor="middle">${esc(g.over.join(' '))}</text>`;
  });
  body += `<text class="lbl" x="${bx + cw + 4}" y="${by0 - 6}">j</text>`;
  return svg(bx + cw * 2 + 40, H, body, 'ext', `Extensible hash table, i = ${s.i}`);
}

// ================================================================ linear hashing
export function linHashSVG(s, opts = {}) {
  const hl = opts.hl || {}, cap = s.cap, cw = 58, rh = 22, gap = 18, bh = cap * rh;
  const maxOver = Math.max(0, ...s.buckets.map(b => Math.ceil(b.over.length / cap)));
  const top = 8 + maxOver * (bh + 12);
  let body = '';
  s.buckets.forEach((b, i) => {
    const x = i * (cw + gap), cls = hl.bucket === i ? 'hl' : hl.bucket2 === i ? 'hl2' : '';
    body += `<rect class="box ${cls}" x="${x}" y="${top}" width="${cw}" height="${bh}" rx="3"/>`;
    for (let k = 1; k < cap; k++) body += `<line class="cell" x1="${x}" x2="${x + cw}" y1="${top + k * rh}" y2="${top + k * rh}"/>`;
    b.recs.forEach((r, k) => body += `<text x="${x + cw / 2}" y="${top + k * rh + 15}" text-anchor="middle">${esc(r)}</text>`);
    body += `<text class="lbl" x="${x + cw / 2}" y="${top + bh + 16}" text-anchor="middle">${i.toString(2).padStart(s.i, '0')}</text>`;
    for (let o = 0; o * cap < b.over.length; o++) {
      const oy = top - (o + 1) * (bh + 12), recs = b.over.slice(o * cap, o * cap + cap);
      body += `<path class="edge" d="M${x + cw / 2} ${oy + bh + 12} L${x + cw / 2} ${oy + bh}"/><rect class="over" x="${x}" y="${oy}" width="${cw}" height="${bh}" rx="3"/>`;
      recs.forEach((r, k) => body += `<text x="${x + cw / 2}" y="${oy + k * rh + 15}" text-anchor="middle">${esc(r)}</text>`);
    }
  });
  const W = s.buckets.length * (cw + gap) - gap;
  const r = s.buckets.reduce((a, b) => a + b.recs.length + b.over.length, 0);
  body += `<text class="lbl" x="0" y="${top + bh + 36}">n = ${s.n} buckets · i = ${s.i} bit${s.i === 1 ? '' : 's'} · ${r} records / ${s.n * cap} slots = ${Math.round(r / (s.n * cap) * 1000) / 10}%</text>`;
  return svg(Math.max(W, 300), top + bh + 44, body, 'lin', `Linear hash table with ${s.n} buckets`);
}

// ================================================================ static hashing
export function staticHashSVG(s, opts = {}) {
  const cap = s.cap, rh = 22, cw = 50, bh = cap * rh, vgap = 12;
  let body = '';
  s.buckets.forEach((b, i) => {
    const y = i * (bh + vgap) + 4;
    body += `<text class="lbl" x="0" y="${y + bh / 2 + 4}">${i}</text><rect class="box ${opts.hl === i ? 'hl' : ''}" x="18" y="${y}" width="${cw}" height="${bh}" rx="3"/>`;
    for (let k = 1; k < cap; k++) body += `<line class="cell" x1="18" x2="${18 + cw}" y1="${y + k * rh}" y2="${y + k * rh}"/>`;
    b.recs.forEach((r, k) => body += `<text x="${18 + cw / 2}" y="${y + k * rh + 15}" text-anchor="middle">${esc(r)}</text>`);
    b.over.forEach((blk, o) => {
      const x = 18 + (o + 1) * (cw + 24);
      body += `<path class="edge" d="M${x - 24} ${y + 10} L${x} ${y + 10}"/><rect class="over" x="${x}" y="${y}" width="${cw}" height="${bh}" rx="3"/>`;
      blk.forEach((r, k) => body += `<text x="${x + cw / 2}" y="${y + k * rh + 15}" text-anchor="middle">${esc(r)}</text>`);
    });
  });
  const maxO = Math.max(0, ...s.buckets.map(b => b.over.length));
  return svg(18 + (maxO + 1) * (cw + 24), s.B * (bh + vgap) + 4, body, 'static', 'Static hash table');
}

// ================================================================ generic tree layout (KD, quad, plans)
// node: { label: [lines], kind: 'split'|'leaf'|'op', hl, children: [], edge: 'label on the edge' }
function treeSVG(root, { nodeW = 96, lineH = 15, vgap = 40, hgap = 12, title = '' } = {}) {
  const sizeOf = nd => ({ w: Math.max(nodeW, ...nd.label.map(l => String(l).length * 7.4 + 16)), h: nd.label.length * lineH + 10 });
  let x = 0; const out = [];
  const layout = (nd, d) => {
    nd._s = sizeOf(nd); nd._d = d;
    if (!nd.children || !nd.children.length) { nd._x = x + nd._s.w / 2; x += nd._s.w + hgap; }
    else { nd.children.forEach(c => layout(c, d + 1)); nd._x = (nd.children[0]._x + nd.children[nd.children.length - 1]._x) / 2; }
    out.push(nd);
  };
  layout(root, 0);
  const rowH = Math.max(...out.map(n => n._s.h)) + vgap, mk = 'tra' + (++UID);
  let body = marker(mk);
  const yOf = nd => nd._d * rowH + 6;
  out.forEach(nd => (nd.children || []).forEach(c => {
    const y1 = yOf(nd) + nd._s.h, y2 = yOf(c);
    body += `<path class="edge ${c.hl && nd.hl ? 'hl' : ''}" d="M${nd._x} ${y1} C ${nd._x} ${y1 + vgap / 2}, ${c._x} ${y2 - vgap / 2}, ${c._x} ${y2 - 2}" marker-end="url(#${mk})"/>`;
    if (c.edge) body += `<text class="lbl" x="${c._x + 5}" y="${y2 - 9}" text-anchor="start" style="font-weight:600">${esc(c.edge)}</text>`;
  }));
  out.forEach(nd => {
    const y = yOf(nd), { w, h } = nd._s, cls = nd.hl ? 'hl' : nd.hl2 ? 'hl2' : '';
    body += nd.kind === 'split' ? `<ellipse class="box ${cls}" cx="${nd._x}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2 + 2}"/>`
      : `<rect class="box ${cls}" x="${nd._x - w / 2}" y="${y}" width="${w}" height="${h}" rx="${nd.kind === 'op' ? 8 : 3}"/>`;
    nd.label.forEach((l, i) => body += `<text x="${nd._x}" y="${y + 5 + (i + 1) * lineH - 3}" text-anchor="middle" class="${nd.kind === 'op' && i === 0 ? 'op' : i > 0 && nd.kind === 'op' ? 'size' : ''}">${esc(l)}</text>`);
  });
  const W = Math.max(...out.map(n => n._x + n._s.w / 2)) + 4, H = Math.max(...out.map(n => yOf(n) + n._s.h)) + 6;
  return svg(W, H, body, 'tree', title);
}

// KD-tree. opts.hl: list of record labels or "attr:val" split ids to highlight; opts.fmt(rec) label.
export function kdSVG(t, opts = {}) {
  const hl = new Set((opts.hl || []).map(String)), lab = opts.fmt || (r => (r.id != null ? `${r.id}` : `(${r.v.join(', ')})`));
  const conv = (nd, edge) => nd.recs
    ? { kind: 'leaf', label: nd.recs.length ? nd.recs.map(lab) : ['(empty)'], hl: nd.recs.some(r => hl.has(lab(r))), edge }
    : { kind: 'split', label: [`${t.attrs[nd.attr]} ${nd.val}`], hl: hl.has(`${nd.attr}:${nd.val}`), children: [conv(nd.left, '<'), conv(nd.right, '≥')], edge };
  return treeSVG(conv(t.root), { title: 'KD-tree', nodeW: 80 });
}

// Quad tree as a tree of squares. opts.centre: label internal nodes with their centre.
export function quadTreeSVG(t, opts = {}) {
  const hl = new Set(opts.hl || []), lab = p => `${p.id ? p.id : ''}(${p.x}, ${p.y})`;
  const conv = (nd, edge) => nd.pts
    ? { kind: 'leaf', label: nd.pts.length ? nd.pts.map(lab) : ['·'], hl: nd.pts.some(p => hl.has(p.id || lab(p))), edge }
    : { kind: 'split', label: [`(${nd.cx}, ${nd.cy})`], children: ['NW', 'NE', 'SW', 'SE'].map(q => conv(nd[q], q)), edge };
  return treeSVG(conv(t.root), { title: 'Quad tree', nodeW: 46, hgap: 8 });
}
// The plane with every leaf square and the points. opts: { w, h, xLabel, yLabel, hl: [ids], extra: svg string }
export function quadPlaneSVG(t, opts = {}) {
  const W = opts.w || 300, Hh = opts.h || 260, pad = 34, R = t.region;
  const sx = v => pad + (v - R.x0) / (R.x1 - R.x0) * W, sy = v => 8 + Hh - (v - R.y0) / (R.y1 - R.y0) * Hh;
  let body = `<rect class="frame" x="${pad}" y="8" width="${W}" height="${Hh}"/>`;
  quadRegions(t).forEach(({ r }) => body += `<rect x="${sx(r.x0)}" y="${sy(r.y1)}" width="${sx(r.x1) - sx(r.x0)}" height="${sy(r.y0) - sy(r.y1)}" fill="none" class="gridln"/>`);
  const hl = new Set(opts.hl || []);
  quadRegions(t).forEach(({ pts }) => pts.forEach(p => body += `<circle class="pt" cx="${sx(p.x)}" cy="${sy(p.y)}" r="${hl.has(p.id) ? 5 : 3.5}" ${hl.has(p.id) ? 'style="fill:var(--good)"' : ''}/>` + (p.id ? `<text x="${sx(p.x) + 6}" y="${sy(p.y) - 5}" style="font-size:11px">${esc(p.id)}</text>` : '')));
  body += `<text class="lbl" x="${pad}" y="${Hh + 24}">${R.x0}</text><text class="lbl" x="${pad + W}" y="${Hh + 24}" text-anchor="end">${R.x1}</text><text class="lbl" x="${pad - 4}" y="${Hh + 8}" text-anchor="end">${R.y0}</text><text class="lbl" x="${pad - 4}" y="16" text-anchor="end">${R.y1}</text>`;
  if (opts.xLabel) body += `<text class="lbl" x="${pad + W / 2}" y="${Hh + 26}" text-anchor="middle">${esc(opts.xLabel)}</text>`;
  if (opts.yLabel) body += `<text class="lbl" x="10" y="${8 + Hh / 2}" transform="rotate(-90 10 ${8 + Hh / 2})" text-anchor="middle">${esc(opts.yLabel)}</text>`;
  return svg(pad + W + 8, Hh + 34, body + (opts.extra || ''), 'plane', 'Quad tree regions');
}

// Grid plane: lines { x: [...], y: [...] }, bounds { x0, x1, y0, y1 }, pts [{ x, y, id }], opts.area { x0, x1, y0, y1 } shaded query region
export function gridSVG(lines, bounds, pts, opts = {}) {
  const W = opts.w || 300, Hh = opts.h || 240, pad = 40, B = bounds;
  const sx = v => pad + (v - B.x0) / (B.x1 - B.x0) * W, sy = v => 8 + Hh - (v - B.y0) / (B.y1 - B.y0) * Hh;
  let body = `<rect class="frame" x="${pad}" y="8" width="${W}" height="${Hh}"/>`;
  if (opts.area) { const a = opts.area; body += `<rect class="area" opacity=".55" x="${sx(a.x0)}" y="${sy(a.y1)}" width="${sx(a.x1) - sx(a.x0)}" height="${sy(a.y0) - sy(a.y1)}"/>`; }
  lines.x.forEach(v => body += `<line class="gridln" x1="${sx(v)}" x2="${sx(v)}" y1="8" y2="${8 + Hh}"/><text class="lbl" x="${sx(v)}" y="${Hh + 22}" text-anchor="middle">${v}</text>`);
  lines.y.forEach(v => body += `<line class="gridln" x1="${pad}" x2="${pad + W}" y1="${sy(v)}" y2="${sy(v)}"/><text class="lbl" x="${pad - 5}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`);
  const hl = new Set(opts.hl || []);
  pts.forEach(p => body += `<circle class="pt" cx="${sx(p.x)}" cy="${sy(p.y)}" r="${hl.has(p.id) ? 5 : 3.5}" ${hl.has(p.id) ? 'style="fill:var(--good)"' : ''}/>`);
  body += `<text class="lbl" x="${pad}" y="${Hh + 22}" text-anchor="middle">${B.x0}</text><text class="lbl" x="${pad + W}" y="${Hh + 22}" text-anchor="middle">${B.x1}</text><text class="lbl" x="${pad - 5}" y="${Hh + 10}" text-anchor="end">${B.y0}</text><text class="lbl" x="${pad - 5}" y="16" text-anchor="end">${B.y1}</text>`;
  if (opts.xLabel) body += `<text class="lbl" x="${pad + W / 2}" y="${Hh + 36}" text-anchor="middle">${esc(opts.xLabel)}</text>`;
  if (opts.yLabel) body += `<text class="lbl" x="10" y="${8 + Hh / 2}" transform="rotate(-90 10 ${8 + Hh / 2})" text-anchor="middle">${esc(opts.yLabel)}</text>`;
  return svg(pad + W + 10, Hh + (opts.xLabel ? 44 : 30), body, 'grid', 'Grid index');
}

// Logical plan tree. Accepts a plan or an estimate() result (then sizes are printed under each operator).
// Extra node fields: hl (highlight), note (text under the operator instead of the size).
export function planSVG(plan, opts = {}) {
  const conv = nd => {
    const kids = [nd.in, nd.l, nd.r].filter(Boolean);
    const lines = [nd.text || planLabel(nd)];
    if (nd.note) lines.push(nd.note); else if (nd.T != null && opts.sizes !== false) lines.push(`T = ${costFmt(Math.round(nd.T * 100) / 100)}`);
    return { kind: nd.op === 'rel' ? 'leaf' : 'op', label: lines, hl: nd.hl, children: kids.map(conv) };
  };
  return treeSVG(conv(plan), { title: 'Logical plan', nodeW: 70, vgap: 30 });
}
