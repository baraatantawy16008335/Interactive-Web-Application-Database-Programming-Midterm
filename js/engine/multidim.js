// Multidimensional indices (Lecture 4, PA4): KD-tree, quad tree, grid, bitmap and partitioned hashing.
const copy = x => JSON.parse(JSON.stringify(x));
const r2 = v => Math.round(v * 100) / 100;

// ================================================================ KD-tree
// A record is { id?: label, v: [value per attribute] }. attrs = ['Age', 'GPA'] in the order the levels rotate.
// node: { attr: index, val, left, right }  (left: value < val, right: value >= val)  or  leaf: { recs: [...] }
// Split rule (PA4-5 and the 2025 midterm): when a leaf already holds cap records and a new one arrives,
// split the cap + 1 records on the attribute of that level, at their MEAN (rounded to 2 decimals for display).
export function kdNew(attrs, cap = 2, root = { recs: [] }) { return { attrs, cap, root: copy(root) }; }
const kdLabel = r => r.id != null ? r.id : `(${r.v.join(', ')})`;
export function kdInsert(t0, rec, { split = 'mean' } = {}) {
  const t = copy(t0), steps = [], k = t.attrs.length;
  const snap = (text, hl = [], kind = 'info') => steps.push({ text, kind, hl, tree: copy(t) });
  let nd = t.root, depth = 0, path = [];
  while (!nd.recs) {
    const a = nd.attr, go = rec.v[a] < nd.val ? 'left' : 'right';
    path.push(`${t.attrs[a]} ${nd.val}: ${rec.v[a]} ${go === 'left' ? '<' : '≥'} ${nd.val}, go ${go}`);
    nd = nd[go]; depth++;
  }
  if (path.length) snap(`Descend: ${path.join('; ')}.`);
  if (nd.recs.length < t.cap) { nd.recs.push(rec); snap(`The leaf has room, so ${kdLabel(rec)} is stored there.`, [kdLabel(rec)], 'ok'); return { tree: t, steps }; }
  let recs = [...nd.recs, rec], d = depth;
  const splitInto = (node, recs, d) => {
    if (recs.length <= t.cap) { node.recs = recs; return; }
    const a = d % k, vals = recs.map(r => r.v[a]);
    let val = split === 'median' ? [...vals].sort((x, y) => x - y)[Math.floor(vals.length / 2)] : vals.reduce((s, v) => s + v, 0) / vals.length;
    val = r2(val);
    const L = recs.filter(r => r.v[a] < val), R = recs.filter(r => r.v[a] >= val);
    delete node.recs; Object.assign(node, { attr: a, val, left: {}, right: {} });
    snap(`The leaf is full: split the ${recs.length} records on ${t.attrs[a]} (level ${d + 1} uses ${t.attrs[a]}). ${split === 'median' ? 'Median' : 'Mean'} = (${vals.join(' + ')}) / ${vals.length} = ${val}. Values < ${val} go left: ${L.map(kdLabel).join(', ') || 'none'}; values ≥ ${val} go right: ${R.map(kdLabel).join(', ') || 'none'}.`, recs.map(kdLabel), 'warn');
    if (!L.length || !R.length) { // every value tied on this attribute: keep the (empty) side and split again one level down
      node.left = { recs: [] }; node.right = { recs: [] };
      splitInto(L.length ? node.left : node.right, L.length ? L : R, d + 1); return;
    }
    node.left = {}; node.right = {};
    splitInto(node.left, L, d + 1); splitInto(node.right, R, d + 1);
  };
  splitInto(nd, recs, d);
  snap(`Done: ${kdLabel(rec)} is in the tree.`, [kdLabel(rec)], 'ok');
  return { tree: t, steps };
}
export function kdSearch(t, v) {
  const out = []; let nd = t.root;
  while (!nd.recs) { const go = v[nd.attr] < nd.val ? 'left' : 'right'; out.push(`${t.attrs[nd.attr]} ${nd.val}: ${v[nd.attr]} ${go === 'left' ? '<' : '≥'} ${nd.val}, go ${go}`); nd = nd[go]; }
  const hit = nd.recs.find(r => r.v.every((x, i) => x === v[i]));
  out.push(hit ? `Leaf holds ${nd.recs.map(kdLabel).join(' and ')}: found.` : `Leaf holds ${nd.recs.map(kdLabel).join(' and ') || 'nothing'}: not found.`);
  return { found: !!hit, text: out };
}
// Partial-match / range: which leaves must be visited? (shows why a KD-tree is weak for partial match)
export function kdRange(t, lo, hi) { // lo/hi: arrays, use null for "no condition"
  let visited = 0; const hits = [];
  const walk = nd => {
    if (nd.recs) { visited++; nd.recs.forEach(r => { if (r.v.every((x, i) => (lo[i] == null || x >= lo[i]) && (hi[i] == null || x <= hi[i]))) hits.push(r); }); return; }
    const a = nd.attr;
    if (lo[a] == null || lo[a] < nd.val) walk(nd.left);
    if (hi[a] == null || hi[a] >= nd.val) walk(nd.right);
  };
  walk(t.root);
  return { hits, visited };
}

// ================================================================ quad tree
// Region { x0, y0, x1, y1 } (y grows upward, like the lecture plots). Points { id?, x, y }.
// A point on a centre line goes to the East / North side (it is >= the centre), as in Lecture 4.
// node: leaf { pts: [] }  or  { cx, cy, NW, NE, SW, SE }.
export function quadNew(region, cap = 1, root = { pts: [] }) { return { region: { ...region }, cap, root: copy(root) }; }
const quadOf = (nd, p) => (p.y >= nd.cy ? 'N' : 'S') + (p.x >= nd.cx ? 'E' : 'W');
const sub = (r, q) => {
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  return { x0: q[1] === 'W' ? r.x0 : cx, x1: q[1] === 'W' ? cx : r.x1, y0: q[0] === 'S' ? r.y0 : cy, y1: q[0] === 'S' ? cy : r.y1 };
};
const qLabel = p => `${p.id ? p.id : ''}(${p.x}, ${p.y})`;
export function quadInsert(t0, p) {
  const t = copy(t0), steps = [];
  const snap = (text, kind = 'info') => steps.push({ text, kind, tree: copy(t) });
  let nd = t.root, r = { ...t.region }; const path = [];
  while (!nd.pts) { const q = quadOf(nd, p); path.push(`centre (${nd.cx}, ${nd.cy}) → ${q}`); r = sub(r, q); nd = nd[q]; }
  if (path.length) snap(`Descend: ${path.join(', ')}.`);
  const place = (node, reg, pts) => {
    if (pts.length <= t.cap) { node.pts = pts; return; }
    const cx = (reg.x0 + reg.x1) / 2, cy = (reg.y0 + reg.y1) / 2;
    delete node.pts; Object.assign(node, { cx, cy, NW: { pts: [] }, NE: { pts: [] }, SW: { pts: [] }, SE: { pts: [] } });
    snap(`Square (${reg.x0}, ${reg.y0}) to (${reg.x1}, ${reg.y1}) would hold ${pts.length} points but a block holds ${t.cap}: split it at its centre (${cx}, ${cy}) into NW, NE, SW and SE.`, 'warn');
    for (const q of ['NW', 'NE', 'SW', 'SE']) place(node[q], sub(reg, q), pts.filter(x => quadOf(node, x) === q));
  };
  place(nd, r, [...nd.pts, p]);
  snap(`${qLabel(p)} is stored.`, 'ok');
  return { tree: t, steps };
}
export function quadDelete(t0, p, { collapse = true } = {}) {
  const t = copy(t0);
  const count = nd => nd.pts ? nd.pts.length : ['NW', 'NE', 'SW', 'SE'].reduce((s, q) => s + count(nd[q]), 0);
  const gather = nd => nd.pts ? nd.pts : ['NW', 'NE', 'SW', 'SE'].flatMap(q => gather(nd[q]));
  const walk = nd => {
    if (nd.pts) { const i = nd.pts.findIndex(x => x.x === p.x && x.y === p.y); if (i >= 0) { nd.pts.splice(i, 1); return true; } return false; }
    const ok = walk(nd[quadOf(nd, p)]);
    if (ok && collapse && count(nd) <= t.cap) { const pts = gather(nd); for (const k of Object.keys(nd)) delete nd[k]; nd.pts = pts; }
    return ok;
  };
  const ok = walk(t.root);
  return { tree: t, steps: [{ text: ok ? `Delete ${qLabel(p)}.${collapse ? ' Any square whose four children now hold no more than a block\'s worth of points collapses back into a single leaf.' : ''}` : `${qLabel(p)} is not in the tree.`, kind: ok ? 'ok' : 'warn', tree: copy(t) }] };
}
export function quadRegions(t) { // flat list of leaves with their squares (for drawing the plane)
  const out = [];
  const walk = (nd, r, path) => { if (nd.pts) out.push({ r, pts: nd.pts, path }); else ['NW', 'NE', 'SW', 'SE'].forEach(q => walk(nd[q], sub(r, q), [...path, q])); };
  walk(t.root, t.region, []);
  return out;
}

// ================================================================ grid index
// lines: { x: [40, 55], y: [90, 225] } interior grid lines. A value on a line belongs to the stripe it is the
// LOWER boundary of (Lecture 4). Cells are [col, row].
export function gridCell(lines, x, y) {
  const c = lines.x.filter(l => x >= l).length, r = lines.y.filter(l => y >= l).length;
  return [c, r];
}
export function gridBuild(lines, pts, cap = 2) {
  const cells = {};
  pts.forEach(p => { const [c, r] = gridCell(lines, p.x, p.y), k = c + ',' + r; (cells[k] ||= []).push(p); });
  return { lines: copy(lines), cap, cells };
}
// Which cells a range query must look in (inclusive bounds; null = unbounded)
export function gridRangeCells(lines, xlo, xhi, ylo, yhi) {
  const nx = lines.x.length + 1, ny = lines.y.length + 1, out = [];
  const colLo = xlo == null ? 0 : gridCell(lines, xlo, 0)[0], colHi = xhi == null ? nx - 1 : gridCell(lines, xhi, 0)[0];
  const rowLo = ylo == null ? 0 : gridCell(lines, 0, ylo)[1], rowHi = yhi == null ? ny - 1 : gridCell(lines, 0, yhi)[1];
  for (let c = colLo; c <= colHi; c++) for (let r = rowLo; r <= rowHi; r++) out.push([c, r]);
  return out;
}

// ================================================================ bitmap index
// rows: array of values for one column. Returns [{ value, bits: '0101...' }] sorted by value.
export function bitmap(rows) {
  const vals = [...new Set(rows)].sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))));
  return vals.map(v => ({ value: v, bits: rows.map(x => (x === v ? '1' : '0')).join('') }));
}
export const bitAnd = (...bs) => bs.reduce((a, b) => [...a].map((c, i) => (c === '1' && b[i] === '1' ? '1' : '0')).join(''));
export const bitOr = (...bs) => bs.reduce((a, b) => [...a].map((c, i) => (c === '1' || b[i] === '1' ? '1' : '0')).join(''));
export const bitNot = b => [...b].map(c => (c === '1' ? '0' : '1')).join('');
// OR together the vectors whose value satisfies pred, e.g. v => v >= 1024
export function bitWhere(maps, pred) {
  const pick = maps.filter(m => pred(m.value));
  return { used: pick.map(m => m.value), bits: pick.length ? bitOr(...pick.map(m => m.bits)) : '0'.repeat(maps[0].bits.length) };
}

// ================================================================ partitioned hashing
// hashes: [ {value: bits} per attribute ], e.g. [{ toy: '0', sales: '1' }, { '10k': '01', ... }]
export const partKey = (hashes, vals) => vals.map((v, i) => hashes[i][v]).join('');
// Buckets a partial-match query must visit: known attributes fixed, unknown ones take every bit pattern.
export function partBuckets(hashes, vals) { // vals: value or null per attribute
  let keys = [''];
  vals.forEach((v, i) => {
    const width = Object.values(hashes[i])[0].length;
    const opts = v == null ? Array.from({ length: 2 ** width }, (_, n) => n.toString(2).padStart(width, '0')) : [hashes[i][v]];
    keys = keys.flatMap(k => opts.map(o => k + o));
  });
  return keys;
}
