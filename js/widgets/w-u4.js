// Unit 4 simulators: Multidimensional indices (Lecture 4, PA4, 2025 midterm Exercise 5)
import { opsBench } from './opsbench.js';
import { sorter } from './sorter.js';
import * as M from '../engine/multidim.js';
import * as D from '../engine/draw.js';
import { bench, on, seg, esc } from '../viz.js';

const callout = (icon, html, color) => `<div class="callout" style="margin-top:10px${color ? `;border-left:3px solid ${color}` : ''}"><i class="ph ph-${icon}"${color ? ` style="color:${color}"` : ''}></i><div>${html}</div></div>`;
const fm = n => Number(n).toLocaleString('en-US');
const ceil = Math.ceil;
const PC = [[1001, 2.66, 1024, 250], [1002, 2.10, 512, 250], [1003, 1.42, 512, 160], [1004, 2.80, 1024, 250], [1005, 3.20, 512, 250], [1006, 3.20, 1024, 300], [1007, 2.20, 1024, 200], [1008, 2.20, 2048, 250], [1009, 2.00, 1024, 250], [1010, 2.80, 2048, 300], [1011, 1.86, 2048, 160], [1012, 2.80, 1024, 160]];
const chip = (attrs, label, pressed) => `<button type="button" class="chip" ${attrs} aria-pressed="${!!pressed}">${label}</button>`;

// ====================================================================================== 1. Motivation I/O calculator
export function u4Motivation(el) {
  const DEF = { N: 100000, P: 10, K: 100, D: 1000, f: 50, sd: false, ss: false, root: true };
  let s = { ...DEF, tab: 's1' };
  const sum = a => a.reduce((x, y) => x + y, 0);
  // Cost of reading `entries` consecutive pointers from a B+ tree that indexes all N rows (K pointers per node).
  const idx = entries => {
    const total = ceil(s.N / s.K), sizes = []; let n = total;
    while (n > 1) { sizes.push(n); n = ceil(n / s.K); }          // sizes[0] = leaves, then each non-leaf level (root excluded)
    let nodes = Math.max(1, ceil(entries / s.K)); const leaf = nodes, inner = [];
    for (let i = 1; i < sizes.length; i++) { nodes = ceil(nodes / s.K); inner.push(nodes); }
    const rootRead = !s.root && sizes.length ? 1 : 0;
    return { leaf, inner, rootRead, total: leaf + sum(inner) + rootRead, leaves: total, sizes };
  };
  const rowsDept = () => Math.min(s.D, s.N), rowsSal = () => Math.round(s.N * s.f / 100);
  const pages = (rows, sorted) => sorted ? ceil(rows / s.P) : rows;
  const idxText = (entries, I) => `${fm(entries)} pointers ÷ ${s.K} per leaf = <b>${fm(I.leaf)}</b> leaf node${I.leaf > 1 ? 's' : ''}${I.inner.map((v, i) => `, then ${fm(v)} non-leaf node${v > 1 ? 's' : ''} above them (level ${i + 1})`).join('')}${I.rootRead ? ', plus the root' : s.root && I.sizes.length ? ' (the root is in memory, not counted)' : ''} = <b>${fm(I.total)}</b> index I/Os`;
  const row = (a, b, c) => `<tr><td>${a}</td><td class="num">${b}</td><td>${c || ''}</td></tr>`;
  const render = () => {
    const rd = rowsDept(), rs = rowsSal(), Id = idx(rd), Is = idx(rs), tablePages = ceil(s.N / s.P);
    const dBest = Id.total + pages(rd, true), dWorst = Id.total + pages(rd, false);
    const sBest = Is.total + pages(rs, true), sWorst = Is.total + pages(rs, false);
    const dNow = Id.total + pages(rd, s.sd), sNow = Is.total + pages(rs, s.ss);
    const match = Math.round(rd * s.f / 100), s3pages = ceil(match / s.P), s3idx = Math.max(1, Id.sizes.length), s3 = s3idx + s3pages;
    let panel = '';
    if (s.tab === 's1') {
      panel = `<p class="small">Strategy 1: one B+ tree on <b>dept</b>. Fetch every Toy employee through it, then look at each row's salary.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Step</th><th>I/Os</th><th>Why</th></tr></thead><tbody>
      ${row('Index (dept)', fm(Id.total), idxText(rd, Id))}
      ${row('Table, best case', fm(pages(rd, true)), `${fm(rd)} rows ÷ ${s.P} rows per page = ${fm(ceil(rd / s.P))} pages: Toy rows are packed together (table sorted by dept)`)}
      ${row('Table, worst case', fm(pages(rd, false)), `${fm(rd)} rows, each on a different page: one I/O per pointer`)}
      <tr class="fixed"><td><b>Total</b></td><td class="num"><b>${fm(dBest)} best / ${fm(dWorst)} worst</b></td><td>${fm(Id.total)} + ${fm(pages(rd, true))} and ${fm(Id.total)} + ${fm(pages(rd, false))}</td></tr>
      </tbody></table></div>
      ${callout('info', `The salary condition is not used by the index. All ${fm(rd)} Toy rows are fetched and the salary is checked afterwards, so about ${fm(rd - match)} fetched rows are wasted.`)}`;
    } else if (s.tab === 's2') {
      const combos = [[true, true], [true, false], [false, true], [false, false]];
      panel = `<p class="small">Strategy 2 (as the slides count it): a B+ tree on dept and a B+ tree on salary. Look up both, then add the costs. The salary condition <span class="num">salary &gt; 50,000</span> matches ${s.f}% of all ${fm(s.N)} rows = <b>${fm(rs)}</b> rows.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Step</th><th>I/Os</th><th>Why</th></tr></thead><tbody>
      ${row('Index (salary)', fm(Is.total), idxText(rs, Is))}
      ${row('Table via salary, sorted', fm(pages(rs, true)), `${fm(rs)} ÷ ${s.P} = ${fm(ceil(rs / s.P))} pages`)}
      ${row('Table via salary, not sorted', fm(pages(rs, false)), `one page per pointer`)}
      <tr class="fixed"><td><b>Salary part</b></td><td class="num"><b>${fm(sBest)} or ${fm(sWorst)}</b></td><td>${fm(Is.total)} + ${fm(pages(rs, true))} or ${fm(Is.total)} + ${fm(pages(rs, false))}</td></tr>
      <tr class="fixed"><td><b>Dept part</b></td><td class="num"><b>${fm(dBest)} or ${fm(dWorst)}</b></td><td>same as strategy 1</td></tr>
      </tbody></table></div>
      <div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Dept part</th><th>Salary part</th><th>Total I/Os</th></tr></thead><tbody>
      ${combos.map(([a, b]) => { const v = (Id.total + pages(rd, a)) + (Is.total + pages(rs, b)), cur = a === s.sd && b === s.ss; return `<tr${cur ? ' class="fixed"' : ''}><td>${a ? 'sorted' : 'not sorted'} (${fm(Id.total + pages(rd, a))})</td><td>${b ? 'sorted' : 'not sorted'} (${fm(Is.total + pages(rs, b))})</td><td class="num">${fm(v)}${cur ? ' &larr; your toggles' : ''}</td></tr>`; }).join('')}
      </tbody></table></div>
      ${s.sd && s.ss ? callout('warning', 'A table file can be physically sorted on only one column, so "sorted by dept and by salary" cannot both be true. At most one of the two parts gets the cheap number.', 'var(--accent)') : ''}
      ${callout('info', `The slides add the two lookups. A cleverer plan would intersect the two pointer lists first and fetch only the ${fm(match)} rows that satisfy both. The numbers to know for the exam are the lecture's: <b>5505</b> or <b>50,505</b> for salary, plus <b>111</b> or <b>1011</b> for dept.`)}`;
    } else if (s.tab === 's3') {
      panel = `<p class="small">Strategy 3: sort the table on (dept, salary) and build a multilevel dense index with one level per column. The lecture leaves the I/O count as an exercise ("for you to find out"), so this is <b>our estimate</b>, not an official number.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Step</th><th>I/Os</th><th>Why</th></tr></thead><tbody>
      ${row('Matching rows', fm(match), `${fm(rd)} Toy rows × ${s.f}% with salary &gt; 50,000`)}
      ${row('Table pages', fm(s3pages), `Toy rows with high salary are contiguous after sorting: ${fm(match)} ÷ ${s.P} per page`)}
      ${row('Index levels', fm(s3idx), 'one block per level below the memory-resident top (rough)')}
      <tr class="fixed"><td><b>Total (estimate)</b></td><td class="num"><b>about ${fm(s3)}</b></td><td>only the needed rows are read</td></tr>
      </tbody></table></div>
      ${callout('warning', 'The price is that rows must be physically reordered, the index is tied to that one sort order, and every insert has to keep the file sorted. This idea returns later as the grid index and the KD-tree.', 'var(--accent)')}`;
    } else {
      const items = [['Strategy 1', dNow], ['Strategy 2', dNow + sNow], ['Strategy 3 (estimate)', s3], ['Full table scan', tablePages]];
      const mx = Math.max(...items.map(i => i[1]), 10);
      panel = `<p class="small muted">Bars use a log scale so the small numbers stay visible. Strategy 1 and 2 use your sorted toggles above.</p>
      ${items.map(([l, v]) => `<div style="display:flex;align-items:center;gap:10px;margin:6px 0"><div style="width:150px;font-size:13px">${l}</div><div style="flex:1;background:var(--sunken);border-radius:6px;height:20px"><div style="width:${Math.max(2, Math.log10(Math.max(v, 1)) / Math.log10(mx) * 100)}%;height:100%;border-radius:6px;background:var(--accent-viz)"></div></div><div class="num" style="width:76px;text-align:right">${fm(v)}</div></div>`).join('')}
      ${sWorst + dNow > tablePages ? callout('warning', `With these numbers the worst case of strategy 2 (${fm(dNow + sNow)}) is larger than simply scanning the table (${fm(tablePages)} I/Os). The lecture counts one I/O per pointer, even though a scan would be cheaper. Real optimisers would choose the scan.`, 'var(--accent)') : ''}`;
    }
    el.innerHTML = `${bench('calculator', 'Motivation: counting the I/Os', 'dept = Toy AND salary &gt; 50,000')}
    <div class="bench-body">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:12px">
        ${[['N', 'Rows in table'], ['P', 'Rows per page'], ['K', 'Pointers per node'], ['D', 'Rows per dept'], ['f', '% with salary &gt; 50K']].map(([k, l]) => `<div class="field"><label for="u4m-${k}">${l}</label><input type="number" id="u4m-${k}" data-k="${k}" min="1" value="${s[k]}"></div>`).join('')}
      </div>
      <div class="chips" style="margin-bottom:10px">
        ${chip('data-tg="sd"', 'Table sorted by dept', s.sd)}${chip('data-tg="ss"', 'Table sorted by salary', s.ss)}${chip('data-tg="root"', 'Root kept in memory', s.root)}
        <button type="button" class="chip accent" data-preset="lec">Lecture numbers</button><button type="button" class="chip" data-preset="big">1M rows</button><button type="button" class="chip" data-preset="wide">Dept = 10,000 rows</button>
      </div>
      <div style="margin-bottom:10px">${seg([['s1', 'Strategy 1'], ['s2', 'Strategy 2'], ['s3', 'Strategy 3'], ['cmp', 'Compare']], s.tab)}</div>
      ${panel}
    </div>`;
  };
  el.addEventListener('change', e => {
    const k = e.target.dataset.k; if (!k) return;
    let v = Math.max(1, Math.round(+e.target.value || 1));
    if (k === 'f') v = Math.min(100, v);
    if (k === 'K') v = Math.max(2, v); // a node needs at least 2 pointers, or the tree never narrows
    s[k] = v; if (s.D > s.N) s.D = s.N; render();
  });
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.v) s.tab = b.dataset.v;
    else if (b.dataset.tg) s[b.dataset.tg] = !s[b.dataset.tg];
    else if (b.dataset.preset === 'lec') s = { ...DEF, tab: s.tab };
    else if (b.dataset.preset === 'big') s = { ...DEF, N: 1000000, D: 10000, tab: s.tab };
    else if (b.dataset.preset === 'wide') s = { ...DEF, D: 10000, tab: s.tab };
    else return;
    render();
  });
  render();
}

// ====================================================================================== 2. Partitioned hashing
export function u4Partitioned(el) {
  const LEC = () => ({
    name: 'lec', title: 'Lecture: dept + salary', editable: true,
    attrs: [
      { name: 'dept', fn: 'h1', bits: 1, values: ['toy', 'sales', 'art'], map: { toy: '0', sales: '1', art: '1' } },
      { name: 'salary', fn: 'h2', bits: 2, values: ['10k', '20k', '30k', '40k'], map: { '10k': '01', '20k': '11', '30k': '01', '40k': '00' } }],
    recs: [{ n: 'Fred', v: ['toy', '10k'] }, { n: 'Joe', v: ['sales', '10k'] }, { n: 'Sally', v: ['art', '30k'] }],
    q: [null, null], range: false, rangeAttr: 1,
  });
  const PA = () => ({
    name: 'pa', title: 'PA4-6: HD + Speed', editable: false,
    attrs: [
      { name: 'HD', fn: 'h(HD)', bits: 2, values: ['160', '200', '250', '300'], map: { 160: '00', 200: '01', 250: '10', 300: '11' } },
      { name: 'Speed', fn: 'h(Speed)', bits: 3, values: ['1.42', '1.86', '2.00', '2.10', '2.20', '2.66', '2.80', '3.20'], map: { '1.42': '000', '1.86': '001', '2.00': '010', '2.10': '011', '2.20': '100', '2.66': '101', '2.80': '110', '3.20': '111' } }],
    recs: PC.map(([id, sp, , hd]) => ({ n: String(id), v: [String(hd), sp.toFixed(2)] })),
    q: ['250', '2.20'], range: false, rangeAttr: 1,
  });
  let s = el.dataset.start === 'pa' ? PA() : LEC();
  let sel = null; // last message
  const hashes = () => s.attrs.map(a => a.map);
  const keyOf = r => M.partKey(hashes(), r.v);
  const total = () => s.attrs.reduce((n, a) => n + a.bits, 0);
  const split = k => { let o = 0; return s.attrs.map(a => { const p = k.slice(o, o + a.bits); o += a.bits; return p; }); };
  const render = () => {
    const keys = Array.from({ length: 2 ** total() }, (_, n) => n.toString(2).padStart(total(), '0'));
    const rangeOn = s.range, ra = s.rangeAttr;
    // buckets to read
    const qv = s.q.map((v, i) => (rangeOn && i === ra ? null : v));
    const visit = new Set(M.partBuckets(hashes(), qv));
    const matches = r => s.q.every((v, i) => {
      if (v == null) return true;
      if (rangeOn && i === ra) return s.attrs[i].values.indexOf(r.v[i]) >= s.attrs[i].values.indexOf(v);
      return r.v[i] === v;
    });
    const byKey = {}; s.recs.forEach(r => (byKey[keyOf(r)] ||= []).push(r));
    const unknownBits = s.attrs.reduce((n, a, i) => n + (qv[i] == null ? a.bits : 0), 0);
    const pat = s.attrs.map((a, i) => qv[i] == null ? '?'.repeat(a.bits) : a.map[qv[i]]).join(' · ');
    const found = s.recs.filter(r => visit.has(keyOf(r)) && matches(r));
    const falseHits = s.recs.filter(r => visit.has(keyOf(r)) && !matches(r));
    const qDesc = s.attrs.map((a, i) => s.q[i] == null ? null : `${a.name} ${rangeOn && i === ra ? '≥' : '='} ${s.q[i]}`).filter(Boolean).join(' AND ') || 'no condition (full scan)';
    el.innerHTML = `${bench('hash', 'Partitioned hash table', 'concatenate one hash per attribute')}
    <div class="bench-body">
      <div style="margin-bottom:10px">${seg([['lec', 'Lecture: dept + salary'], ['pa', 'PA4-6: HD + Speed']], s.name)}</div>
      <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:10px">
        ${s.attrs.map((a, ai) => `<div style="min-width:150px"><div class="small muted" style="margin-bottom:4px"><b>${a.fn}</b> (${a.name}) gives ${a.bits} bit${a.bits > 1 ? 's' : ''}${s.editable ? ', click a code to change it' : ''}</div>
          <div class="chips">${a.values.map(v => `<button type="button" class="chip" ${s.editable ? `data-edit="${ai}|${v}"` : 'disabled style="cursor:default"'}><span>${v}</span><b class="num" style="color:var(--accent)">${a.map[v]}</b></button>`).join('')}</div></div>`).join('')}
      </div>
      ${s.editable ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:10px">
        <div class="field" style="max-width:110px;margin:0"><label for="u4p-n">Name</label><input type="text" id="u4p-n" placeholder="Fred" autocomplete="off"></div>
        ${s.attrs.map((a, ai) => `<div class="field" style="margin:0"><label for="u4p-${ai}">${a.name}</label><select id="u4p-${ai}">${a.values.map(v => `<option>${v}</option>`).join('')}</select></div>`).join('')}
        <button type="button" class="btn sm primary" data-ins><i class="ph ph-plus"></i>Insert</button>
        <button type="button" class="btn sm" data-sample><i class="ph ph-users"></i>Add more people</button>
        <button type="button" class="btn sm ghost" data-clear><i class="ph ph-trash"></i>Clear</button></div>` : `<p class="small muted" style="margin-bottom:10px">The 12 PC models are already hashed. The bucket key is h(HD) followed by h(Speed): 2 + 3 = 5 bits, so 32 buckets.</p>`}
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-bottom:6px">
        ${s.attrs.map((a, ai) => `<div class="field" style="margin:0"><label for="u4q-${ai}">Query: ${a.name}</label><select id="u4q-${ai}" data-q="${ai}"><option value="">(any)</option>${a.values.map(v => `<option ${s.q[ai] === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`).join('')}
        <label class="small" style="display:flex;gap:6px;align-items:center;padding-bottom:8px"><input type="checkbox" data-range ${rangeOn ? 'checked' : ''}> treat ${s.attrs[ra].name} as a range (≥ value)</label>
      </div>
      <div class="small" style="margin:8px 0"><span class="muted">Query:</span> <span class="num">${qDesc}</span> &rarr; bucket pattern <b class="num hl">${pat}</b> &rarr; read <b>${visit.size}</b> of ${keys.length} bucket${visit.size > 1 ? 's' : ''}${rangeOn && s.q[ra] != null ? ' (a range gives no pattern: the unknown part takes every value)' : ` (2<sup>${unknownBits}</sup> = ${2 ** unknownBits})`}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(${total() > 3 ? 92 : 118}px,1fr));gap:6px">
        ${keys.map(k => { const on = visit.has(k), rs = byKey[k] || [], parts = split(k); return `<div style="border:1px solid ${on ? 'var(--accent-viz)' : 'var(--line)'};background:${on ? 'var(--accent-soft)' : 'var(--surface)'};border-radius:8px;padding:5px 8px;min-height:44px;${rs.length || on ? '' : 'opacity:.7'}">
          <div class="num" style="font-size:12px;color:var(--muted)">${parts.map((p, i) => `<span${i === 0 ? ' style="color:var(--second)"' : ''}>${p}</span>`).join('·')}</div>
          <div style="font-size:13px">${rs.map(r => { const m = on && matches(r); return `<span title="${r.v.join(', ')}" style="${m ? 'font-weight:700;color:var(--good)' : ''}">${r.n}</span>`; }).join(' ') || '<span class="muted">·</span>'}</div></div>`; }).join('')}
      </div>
      ${sel ? callout('info', sel) : ''}
      ${callout(found.length ? 'check-circle' : 'magnifying-glass', `<b>Result:</b> ${found.length ? found.map(r => `${r.n} (${r.v.join(', ')})`).join('; ') : 'no matching record'}.${falseHits.length ? ` The read buckets also held ${falseHits.map(r => r.n).join(', ')}: different values that hash to the same bits (a collision). Hash buckets must always be checked against the real values.` : ''}`, found.length ? 'var(--good)' : '')}
      ${rangeOn && s.q[ra] != null ? callout('warning', `<b>Why a range fails.</b> The values that qualify (${s.attrs[ra].values.filter(v => s.attrs[ra].values.indexOf(v) >= s.attrs[ra].values.indexOf(s.q[ra])).map(v => `${v} → <span class="num">${s.attrs[ra].map[v]}</span>`).join(', ')}) hash to scattered bit patterns, and values between them (such as 25k) hash anywhere too. Neighbouring values do not land in neighbouring buckets, so the only safe plan is to read every bucket. Nearest-neighbour queries fail for the same reason.`, 'var(--accent)') : ''}
    </div>`;
  };
  on(el, '[data-v]', 'click', (e, b) => { if (b.dataset.v === s.name) return; s = b.dataset.v === 'pa' ? PA() : LEC(); sel = null; render(); });
  on(el, '[data-edit]', 'click', (e, b) => {
    const [ai, v] = b.dataset.edit.split('|'), a = s.attrs[+ai], opts = Array.from({ length: 2 ** a.bits }, (_, n) => n.toString(2).padStart(a.bits, '0'));
    a.map[v] = opts[(opts.indexOf(a.map[v]) + 1) % opts.length];
    sel = `You changed ${a.fn}(${v}) to <b class="num">${a.map[v]}</b>. Every stored person is re-placed by the new hash values: the table is rebuilt, so in a real index the hash functions are chosen once.`; render();
  });
  on(el, '[data-ins]', 'click', () => {
    const name = el.querySelector('#u4p-n').value.trim() || `P${s.recs.length + 1}`, v = s.attrs.map((a, i) => el.querySelector(`#u4p-${i}`).value);
    s.recs.push({ n: name, v }); const k = M.partKey(hashes(), v), p = split(k);
    sel = `Insert &lt;${name}, ${v.join(', ')}&gt;: ${s.attrs.map((a, i) => `${a.fn}(${v[i]}) = <b class="num">${p[i]}</b>`).join(', ')}. Concatenate: <b class="num">${p.join(' · ')}</b> = bucket <b class="num">${k}</b>.`; render();
  });
  on(el, '[data-sample]', 'click', () => {
    [['Jan', 'sales', '30k'], ['Marv', 'art', '20k'], ['Tom', 'toy', '40k'], ['Bill', 'art', '40k'], ['Andy', 'sales', '40k']].forEach(([n, d, sa]) => { if (!s.recs.some(r => r.n === n)) s.recs.push({ n, v: [d, sa] }); });
    sel = 'Added Jan, Marv, Tom, Bill and Andy. Records with the same bits share a bucket (for example Joe, Sally and Jan all hash to 1·01).'; render();
  });
  on(el, '[data-clear]', 'click', () => { s.recs = []; sel = 'All records removed. The hash functions stay.'; render(); });
  el.addEventListener('change', e => {
    if (e.target.dataset.q != null) { const v = e.target.value; s.q[+e.target.dataset.q] = v === '' ? null : v; sel = null; render(); }
    else if ('range' in e.target.dataset) { s.range = e.target.checked; render(); }
  });
  render();
}

// ====================================================================================== 3. Grid index
export function u4Grid(el) {
  const BOUND = { x0: 0, x1: 100, y0: 0, y1: 500 }, CAP = 2, W = 300, H = 250, PAD = 40;
  const base = () => ({ pts: [[25, 60], [45, 60], [50, 75], [50, 100], [50, 120], [70, 110], [85, 140], [30, 260], [25, 400], [45, 350], [50, 275], [60, 260]].map(([x, y]) => ({ id: `${x},${y}`, x, y })), lines: { x: [40, 55], y: [90, 225] } });
  let s = { ...base(), appr: 'overflow', mode: 'insert', msg: '', qf: { xlo: '', xhi: '', ylo: '', yhi: '' }, nn: null, hist: [] };
  const snap = () => JSON.stringify({ pts: s.pts, lines: s.lines });
  const stripeLabels = (ls, max) => { const b = [0, ...ls, max]; return b.slice(0, -1).map((v, i) => i === b.length - 2 ? `${v}+` : `${v}–${b[i + 1]}`); };
  const nf = v => (v === '' || v == null || isNaN(+v) ? null : +v);
  const cellsOf = () => M.gridBuild(s.lines, s.pts, CAP).cells;
  const edges = (ls, lo, hi) => [lo, ...ls, hi];
  // ---- queries
  const runQuery = () => {
    const f = s.qf, q = { xlo: nf(f.xlo), xhi: nf(f.xhi), ylo: nf(f.ylo), yhi: nf(f.yhi) };
    const cells = M.gridRangeCells(s.lines, q.xlo, q.xhi, q.ylo, q.yhi);
    const hits = s.pts.filter(p => (q.xlo == null || p.x >= q.xlo) && (q.xhi == null || p.x <= q.xhi) && (q.ylo == null || p.y >= q.ylo) && (q.yhi == null || p.y <= q.yhi));
    return { cells, hits, q };
  };
  const runNN = () => {
    if (!s.nn) return null;
    const [qx, qy] = s.nn, cells = cellsOf(), nx = s.lines.x.length + 1, ny = s.lines.y.length + 1;
    const ex = edges(s.lines.x, BOUND.x0, BOUND.x1), ey = edges(s.lines.y, BOUND.y0, BOUND.y1);
    const dist = (x, y) => Math.hypot((x - qx) / (BOUND.x1 - BOUND.x0), (y - qy) / (BOUND.y1 - BOUND.y0));
    const cellDist = (c, r) => dist(Math.min(Math.max(qx, ex[c]), ex[c + 1]), Math.min(Math.max(qy, ey[r]), ey[r + 1]));
    const home = M.gridCell(s.lines, qx, qy), read = new Set([home.join(',')]), order = [`${home.join(',')}`];
    let ring = 0, best = null;
    for (let guard = 0; guard < 100; guard++) {
      best = null;
      read.forEach(k => (cells[k] || []).forEach(p => { const d = dist(p.x, p.y); if (!best || d < best.d) best = { p, d }; }));
      const add = [];
      for (let c = 0; c < nx; c++) for (let r = 0; r < ny; r++) {
        const k = c + ',' + r; if (read.has(k)) continue;
        if (best ? cellDist(c, r) <= best.d : Math.max(Math.abs(c - home[0]), Math.abs(r - home[1])) === ring + 1) add.push(k);
      }
      if (!best) ring++;
      if (!add.length) break;
      add.forEach(k => { read.add(k); order.push(k); });
    }
    return { best, read: [...read].map(k => k.split(',').map(Number)), home };
  };
  // ---- insertion
  const insertPoint = (x, y) => {
    if (x < BOUND.x0 || x > BOUND.x1 || y < BOUND.y0 || y > BOUND.y1) { s.msg = `(${x}, ${y}) is outside the space (age 0–100, salary 0–500K).`; return; }
    s.hist.push(snap());
    const cells = cellsOf(), [c, r] = M.gridCell(s.lines, x, y), key = c + ',' + r, cur = cells[key] || [], p = { id: `${x},${y}`, x, y };
    const ex = edges(s.lines.x, BOUND.x0, BOUND.x1), ey = edges(s.lines.y, BOUND.y0, BOUND.y1);
    const where = `Age ${ex[c]}–${ex[c + 1]}, salary ${ey[r]}–${ey[r + 1]}K`;
    if (cur.length < CAP) { s.pts.push(p); s.msg = `(${x}, ${y}) falls in the cell ${where}. Its bucket has room (${cur.length} of ${CAP}), so it is stored there.`; return; }
    if (s.appr === 'overflow') { s.pts.push(p); s.msg = `(${x}, ${y}) falls in the cell ${where}, whose bucket is full (${cur.map(q => `(${q.x}, ${q.y})`).join(', ')}). <b>Approach 1:</b> chain an overflow bucket to it. The grid does not change, but every lookup in this cell now costs ${ceil((cur.length + 1) / CAP)} I/Os.`; return; }
    // approach 2: split the cell with a new grid line on one axis
    const all = [...cur, p];
    for (const axis of ['y', 'x']) {
      const vals = all.map(q => q[axis]).sort((a, b) => a - b), step = axis === 'y' ? 10 : 5;
      for (let k = vals.length - 1; k >= 1; k--) {
        if (k > CAP || vals.length - k > CAP || vals[k] === vals[k - 1]) continue;
        let line = (Math.floor(vals[k - 1] / step) + 1) * step; if (line > vals[k]) line = (vals[k - 1] + vals[k]) / 2;
        if (line <= vals[k - 1] || line > vals[k] || s.lines[axis].includes(line)) continue;
        s.lines[axis] = [...s.lines[axis], line].sort((a, b) => a - b); s.pts.push(p);
        const nm = axis === 'y' ? 'salary' : 'age', before = vals.slice(0, k).join(', '), after = vals.slice(k).join(', ');
        s.msg = `(${x}, ${y}) falls in the full cell ${where}. <b>Approach 2:</b> add a new ${nm} grid line at <b>${line}${axis === 'y' ? 'K' : ''}</b>, which separates ${nm} values ${before} from ${after} (any value strictly between ${vals[k - 1]} and ${vals[k]} would do). The line runs across the whole space, so every column gets one more cell: the grid grows from ${(s.lines.x.length + (axis === 'x' ? 0 : 1)) * (s.lines.y.length + (axis === 'y' ? 0 : 1))} to ${(s.lines.x.length + 1) * (s.lines.y.length + 1)} cells, and several of the new cells are empty.`;
        return;
      }
    }
    s.pts.push(p); s.msg = `(${x}, ${y}) falls in the full cell ${where}, and no single new line separates the points enough, so an overflow bucket is used instead.`;
  };
  // ---- drawing
  const shade = (svgStr, cells, color = 'area') => {
    const ex = edges(s.lines.x, BOUND.x0, BOUND.x1), ey = edges(s.lines.y, BOUND.y0, BOUND.y1);
    const sx = v => PAD + (v - BOUND.x0) / (BOUND.x1 - BOUND.x0) * W, sy = v => 8 + H - (v - BOUND.y0) / (BOUND.y1 - BOUND.y0) * H;
    const rects = cells.map(([c, r]) => `<rect class="${color}" opacity=".5" stroke-width="0" x="${sx(ex[c])}" y="${sy(ey[r + 1])}" width="${sx(ex[c + 1]) - sx(ex[c])}" height="${sy(ey[r]) - sy(ey[r + 1])}"/>`).join('');
    return svgStr.replace(/(<rect class="frame"[^>]*\/>)/, `$1${rects}`);
  };
  const render = () => {
    const cells = cellsOf(), nx = s.lines.x.length + 1, ny = s.lines.y.length + 1;
    let readCells = [], hl = [], result = '';
    if (s.mode === 'query') {
      const r = runQuery(); readCells = r.cells; hl = r.hits.map(p => p.id);
      const reads = r.cells.reduce((n, [c, rr]) => n + ceil(((cells[c + ',' + rr] || []).length) / CAP), 0);
      result = callout('magnifying-glass', `<b>${r.cells.length}</b> cell${r.cells.length === 1 ? '' : 's'} overlap the query region (shaded), costing <b>${reads}</b> bucket I/O${reads === 1 ? '' : 's'} (empty cells have no bucket). Matching points: ${r.hits.length ? r.hits.map(p => `(${p.x}, ${p.y})`).join(', ') : 'none'}. Cells that are read but hold no match are the price of the grid being coarse.`);
    } else if (s.mode === 'nn') {
      const r = runNN();
      if (r) { readCells = r.read; if (r.best) hl = [r.best.p.id]; result = callout('target', `Query point (${s.nn[0]}, ${s.nn[1]}) falls in cell (${r.home.join(', ')}). Read <b>${r.read.length}</b> cell${r.read.length === 1 ? '' : 's'} (shaded). ${r.best ? `Nearest point: <b>(${r.best.p.x}, ${r.best.p.y})</b>. It is not enough to read only the home cell: a closer point may sit just across a grid line, so every cell within that distance must be read too (distances use age/100 and salary/500 so both axes weigh the same).` : 'The grid holds no points.'}`); }
      else result = callout('cursor-click', 'Click on the plot (or type a point and press Set) to choose the query point.');
    }
    let svg = D.gridSVG(s.lines, BOUND, s.pts, { w: W, h: H, hl, xLabel: 'Age', yLabel: 'Salary (K)' });
    svg = shade(svg, readCells);
    if (s.mode === 'nn' && s.nn) { const sx = PAD + (s.nn[0] - BOUND.x0) / (BOUND.x1 - BOUND.x0) * W, sy = 8 + H - (s.nn[1] - BOUND.y0) / (BOUND.y1 - BOUND.y0) * H; svg = svg.replace('</svg>', `<path d="M${sx - 6} ${sy - 6} L${sx + 6} ${sy + 6} M${sx + 6} ${sy - 6} L${sx - 6} ${sy + 6}" stroke="var(--bad)" stroke-width="2.5"/></svg>`); }
    const cl = stripeLabels(s.lines.x, 100), rl = stripeLabels(s.lines.y, 500), rs = new Set(readCells.map(c => c.join(',')));
    const nonEmpty = Object.keys(cells).length, buckets = Object.values(cells).reduce((n, a) => n + ceil(a.length / CAP), 0);
    const table = `<div class="tbl-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>Salary \\ Age</th>${cl.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>
      ${[...Array(ny).keys()].reverse().map(r => `<tr><td class="num"><b>${rl[r]}</b></td>${[...Array(nx).keys()].map(c => { const a = cells[c + ',' + r] || [], chunks = []; for (let i = 0; i < Math.max(a.length, 1); i += CAP) chunks.push(a.slice(i, i + CAP));
        return `<td class="num" style="font-size:12px;${rs.has(c + ',' + r) ? 'background:var(--accent-soft)' : ''}">${a.length ? chunks.map((ch, i) => `<div style="${i ? 'border-top:1px dashed var(--bad);margin-top:3px;padding-top:3px' : ''}">${i ? '<span style="color:var(--bad)">overflow </span>' : ''}${ch.map(p => `(${p.x},${p.y})`).join(' ')}</div>`).join('') : '<span class="muted">empty</span>'}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div>`;
    const f = s.qf, fld = (k, l) => `<div class="field" style="margin:0;width:78px"><label for="u4g-${k}">${l}</label><input type="number" id="u4g-${k}" data-f="${k}" value="${esc(f[k])}" placeholder="any"></div>`;
    el.innerHTML = `${bench('grid-four', 'Grid index', 'age × salary, buckets of 2')}
    <div class="bench-body">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
        ${seg([['insert', 'Insert points'], ['query', 'Range / partial query'], ['nn', 'Nearest neighbour']], s.mode, 'data-mode')}
        <span class="small muted">When a bucket overflows:</span>${seg([['overflow', 'Approach 1: overflow bucket'], ['split', 'Approach 2: new grid line']], s.appr, 'data-appr')}
      </div>
      ${s.mode === 'insert' ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:8px">
        <div class="field" style="margin:0;width:78px"><label for="u4g-ix">Age</label><input type="number" id="u4g-ix" value="52"></div><div class="field" style="margin:0;width:90px"><label for="u4g-iy">Salary (K)</label><input type="number" id="u4g-iy" value="200"></div>
        <button type="button" class="btn sm primary" data-ins><i class="ph ph-plus"></i>Insert</button><span class="small muted">or click the plot</span></div>` : ''}
      ${s.mode === 'query' ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:6px">${fld('xlo', 'Age from')}${fld('xhi', 'Age to')}${fld('ylo', 'Salary from')}${fld('yhi', 'Salary to')}</div>
        <div class="chips" style="margin-bottom:8px"><span class="small muted" style="align-self:center">Try:</span>
        <button type="button" class="chip" data-qs="45,60,100,300">Range: age 45–60, salary 100–300</button><button type="button" class="chip" data-qs="50,50,100,100">Exact: (50, 100)</button><button type="button" class="chip" data-qs="50,50,,">Partial: age = 50</button><button type="button" class="chip" data-qs=",,,99">Partial: salary &lt; 100</button></div>` : ''}
      ${s.mode === 'nn' ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:8px"><div class="field" style="margin:0;width:78px"><label for="u4g-nx">Age</label><input type="number" id="u4g-nx" value="${s.nn ? s.nn[0] : 52}"></div><div class="field" style="margin:0;width:90px"><label for="u4g-ny">Salary (K)</label><input type="number" id="u4g-ny" value="${s.nn ? s.nn[1] : 130}"></div><button type="button" class="btn sm primary" data-setnn><i class="ph ph-target"></i>Set</button><span class="small muted">or click the plot</span></div>` : ''}
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
        <div data-plot style="flex:1 1 300px;min-width:0;cursor:crosshair">${svg}</div>
        <div style="flex:1 1 280px;min-width:0">${table}<div class="small muted" style="margin-top:6px">Grid: ${nx} × ${ny} = <b>${nx * ny}</b> cells, ${nonEmpty} non-empty, ${buckets} bucket${buckets > 1 ? 's' : ''} on disk. A point on a line belongs to the stripe that line starts (lower boundary).</div></div>
      </div>
      ${s.msg && s.mode === 'insert' ? callout('info', s.msg) : ''}${result}
      <div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn sm ghost" data-undo ${s.hist.length ? '' : 'disabled'}><i class="ph ph-arrow-u-up-left"></i>Undo</button><button type="button" class="btn sm ghost" data-reset><i class="ph ph-arrow-counter-clockwise"></i>Reset to the lecture grid</button></div>
    </div>`;
  };
  const toData = (e, svg) => { const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, px = (e.clientX - r.left) * vb.width / r.width, py = (e.clientY - r.top) * vb.height / r.height;
    const x = BOUND.x0 + (px - PAD) / W * (BOUND.x1 - BOUND.x0), y = BOUND.y0 + (8 + H - py) / H * (BOUND.y1 - BOUND.y0);
    return (x < BOUND.x0 || x > BOUND.x1 || y < BOUND.y0 || y > BOUND.y1) ? null : [Math.round(x), Math.round(y / 5) * 5]; };
  el.addEventListener('click', e => {
    const plot = e.target.closest('[data-plot]');
    if (plot && !e.target.closest('button')) { const svg = plot.querySelector('svg'); const d = svg && toData(e, svg); if (!d) return;
      if (s.mode === 'insert') { insertPoint(d[0], d[1]); render(); } else if (s.mode === 'nn') { s.nn = d; render(); } return; }
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mode) { s.mode = b.dataset.mode; if (s.mode === 'query' && !Object.values(s.qf).some(v => v !== '')) s.qf = { xlo: '45', xhi: '60', ylo: '100', yhi: '300' }; }
    else if (b.dataset.appr) s.appr = b.dataset.appr;
    else if ('ins' in b.dataset) { const x = +el.querySelector('#u4g-ix').value, y = +el.querySelector('#u4g-iy').value; if (isNaN(x) || isNaN(y)) return; insertPoint(x, y); }
    else if (b.dataset.qs != null) { const [a, c, d, g] = b.dataset.qs.split(','); s.qf = { xlo: a, xhi: c, ylo: d, yhi: g }; }
    else if ('setnn' in b.dataset) { const x = +el.querySelector('#u4g-nx').value, y = +el.querySelector('#u4g-ny').value; if (isNaN(x) || isNaN(y)) return; s.nn = [x, y]; }
    else if ('undo' in b.dataset) { const h = s.hist.pop(); if (h) { const o = JSON.parse(h); s.pts = o.pts; s.lines = o.lines; s.msg = ''; } }
    else if ('reset' in b.dataset) { Object.assign(s, base(), { hist: [], msg: '', nn: null }); }
    else return;
    render();
  });
  el.addEventListener('change', e => { if (e.target.dataset.f) { s.qf[e.target.dataset.f] = e.target.value; render(); } });
  render();
}

// ====================================================================================== 4. KD-tree playground
export function u4KD(el) {
  const P = (age, sal) => ({ id: `${age},${sal}`, v: [sal, age] });
  const lecture = () => ({ ...M.kdNew(['Salary', 'Age'], 2, {
    attr: 0, val: 150,
    left: { attr: 1, val: 60, left: { attr: 0, val: 80, left: { attr: 1, val: 38, left: { recs: [P(25, 60)] }, right: { recs: [P(45, 60), P(50, 75)] } }, right: { recs: [P(50, 100), P(50, 120)] } }, right: { recs: [P(70, 110), P(85, 140)] } },
    right: { attr: 1, val: 47, left: { attr: 0, val: 300, left: { recs: [P(30, 260)] }, right: { recs: [P(25, 400), P(45, 350)] } }, right: { recs: [P(50, 275), P(60, 260)] } } }), order: [1, 0], named: false, idFull: false });
  const G = (id, age, gpa) => ({ id: `${id}, ${age}, ${gpa}`, v: [gpa, age] });
  const midterm = () => ({ ...M.kdNew(['GPA', 'AGE'], 2, { attr: 0, val: 2.56, left: { recs: [G('Jamal', 22, 1.2), G('Fatima', 21, 0.9)] }, right: { attr: 1, val: 17.3, left: { recs: [G('Sarah', 17, 3.8), G('Michael', 16, 4)] }, right: { recs: [G('Amina', 19, 2.7)] } } }), order: [1, 0], named: true, idFull: true });
  const pa = () => ({ ...M.kdNew(['Speed', 'Ram', 'HD'], 2), order: [0, 1, 2], named: true, idFull: false, qi: 0, queue: PC.map(([id, ...v]) => ({ id, v })) });
  let cur = el.dataset.start === 'pa' ? 'pa' : el.dataset.start === 'mid' ? 'mid' : 'lec';
  const NOTES = {
    lec: 'The lecture tree (slide 36 to 39). Records are typed as <b>Age, Salary</b>, exactly as the slides write them, but the root splits on Salary.',
    pa: 'PA4-5: attributes Speed, Ram, HD in this order, buckets of 2, mean split. Press <b>Insert next row</b> to add the table rows one by one and watch the splits.',
    mid: '2025 midterm Exercise 5.1: the non-leaf value is the average of the 3 records being split, leaves hold 2. The two operations are independent: press <b>Reset</b> between them.',
  };
  const fail = (t, text) => ({ tree: t, steps: [{ text, kind: 'warn', tree: t }] });
  const parseRec = (t, s) => {
    const toks = s.replace(/[<>()]/g, '').split(/\s*,\s*|\s+/).filter(Boolean), need = t.order.length + (t.named ? 1 : 0);
    if (toks.length !== need) throw new Error(`Type ${need} values separated by commas${t.named ? ' (name first)' : ''}: ${t.named ? 'name, ' : ''}${t.order.map(i => t.attrs[i]).join(', ')}.`);
    const nums = (t.named ? toks.slice(1) : toks).map(Number); if (nums.some(isNaN)) throw new Error('The attribute values must be numbers.');
    const v = []; t.order.forEach((ai, i) => { v[ai] = nums[i]; });
    return { id: t.idFull ? toks.join(', ') : t.named ? toks[0] : toks.join(','), v };
  };
  const insert = (t, s) => { try { return M.kdInsert(t, parseRec(t, s)); } catch (e) { return fail(t, e.message); } };
  const searchSteps = (t, v) => {
    const steps = [], hl = []; let nd = t.root;
    while (!nd.recs) { const go = v[nd.attr] < nd.val ? 'left' : 'right'; hl.push(`${nd.attr}:${nd.val}`); steps.push({ text: `${t.attrs[nd.attr]} ${nd.val}: the search value is ${v[nd.attr]}, and ${v[nd.attr]} ${go === 'left' ? '<' : '≥'} ${nd.val}, so go ${go}.`, kind: 'info', hl: [...hl], tree: t }); nd = nd[go]; }
    const hit = nd.recs.find(r => r.v.every((x, i) => x === v[i])), labels = nd.recs.map(r => r.id);
    steps.push({ text: hit ? `Leaf reached: ${labels.join(' and ')}. The record is found after ${hl.length} comparisons. That is O(log n) for a balanced tree.` : `Leaf reached: ${labels.join(' and ') || 'empty'}. No record equals the search value: not found.`, kind: hit ? 'ok' : 'warn', hl: [...hl, ...labels], tree: t });
    return steps;
  };
  const search = (t, s) => { try { return { tree: t, steps: searchSteps(t, parseRec({ ...t, named: false }, s).v) }; } catch (e) { return fail(t, e.message); } };
  const condQuery = (t, s) => {
    const lo = t.attrs.map(() => null), hi = t.attrs.map(() => null), conds = [];
    for (const part of s.split(/\s*(?:,|and)\s*/i).filter(Boolean)) {
      const m = part.match(/^([A-Za-z]+)\s*(>=|<=|=|>|<)\s*(-?[\d.]+)$/); const ai = m ? t.attrs.findIndex(a => a.toLowerCase() === m[1].toLowerCase()) : -1;
      if (!m || ai < 0) return fail(t, `Could not read "${part}". Write conditions like ${t.attrs[0]}=50 or ${t.attrs[0]}&gt;=40, ${t.attrs[t.attrs.length - 1]}&lt;100.`);
      const v = +m[3], op = m[2]; conds.push({ ai, op, v });
      if (op === '=' || op === '>=' || op === '>') lo[ai] = lo[ai] == null ? v : Math.max(lo[ai], v);
      if (op === '=' || op === '<=' || op === '<') hi[ai] = hi[ai] == null ? v : Math.min(hi[ai], v);
    }
    const ok = r => conds.every(({ ai, op, v }) => { const x = r.v[ai]; return op === '=' ? x === v : op === '>=' ? x >= v : op === '<=' ? x <= v : op === '>' ? x > v : x < v; });
    let leaves = 0, visited = 0; const hl = [], hits = [];
    const count = nd => nd.recs ? (leaves++, 0) : (count(nd.left), count(nd.right));
    const walk = nd => {
      if (nd.recs) { visited++; nd.recs.forEach(r => { hl.push(r.id); if (ok(r)) hits.push(r); }); return; }
      hl.push(`${nd.attr}:${nd.val}`);
      if (lo[nd.attr] == null || lo[nd.attr] < nd.val) walk(nd.left);
      if (hi[nd.attr] == null || hi[nd.attr] >= nd.val) walk(nd.right);
    };
    count(t.root); walk(t.root);
    const given = conds.map(c => t.attrs[c.ai]);
    const why = t.attrs.filter(a => !given.includes(a)).length ? ` A node that splits on a column you did not mention (${t.attrs.filter(a => !given.includes(a)).join(', ')}) gives no hint which side to take, so <b>both</b> children must be explored. The more levels split on unmentioned columns, the closer this gets to reading every leaf. The slides therefore list partial match as a weakness of the KD-tree.` : '';
    return { tree: t, steps: [{ text: `Condition: ${s}. Leaves visited: <b>${visited}</b> of ${leaves}. Matching records: ${hits.length ? hits.map(r => r.id).join(', ') : 'none'}.${why}`, kind: visited === leaves ? 'warn' : 'ok', hl, tree: t }] };
  };
  const nextRow = (t, many) => {
    if (!t.queue) return fail(t, 'This preset has no table to read rows from. Use Insert, or pick the PA4-5 preset.');
    let tree = t; const steps = []; let n = 0;
    while (tree.qi < tree.queue.length && (many || n === 0)) {
      const row = tree.queue[tree.qi], r = M.kdInsert(tree, { id: row.id, v: row.v }); tree = r.tree; tree.qi = t.qi + n + 1; n++;
      r.steps.forEach((st, i) => steps.push({ ...st, text: `<b>Row ${row.id}</b> (Speed ${row.v[0]}, Ram ${row.v[1]}, HD ${row.v[2]}). ${st.text}`, tree: { ...st.tree, qi: tree.qi, queue: tree.queue } }));
    }
    return n ? { tree, steps } : fail(t, 'All 12 table rows are already inserted.');
  };
  let quickList = () => [];
  const quicks = {
    lec: [{ label: 'Insert (35, 280)', op: 0, value: '35, 280' }, { label: 'Insert (35, 500)', op: 0, value: '35, 500' }, { label: 'Search (50, 100)', op: 1, value: '50, 100' }, { label: 'Query: Age = 50', op: 2, value: 'Age=50' }, { label: 'Query: Salary = 260', op: 2, value: 'Salary=260' }],
    pa: [{ label: 'Insert next row', op: 3 }, { label: 'Insert all 12 rows', op: 4 }, { label: 'Query: HD = 250', op: 2, value: 'HD=250' }, { label: 'Query: Ram = 1024', op: 2, value: 'Ram=1024' }],
    mid: [{ label: 'Insert <Mohamed, 20, 1.6>', op: 0, value: 'Mohamed, 20, 1.6' }, { label: 'Insert <Mohamed, 20, 2.6>', op: 0, value: 'Mohamed, 20, 2.6' }, { label: 'Query: AGE = 20', op: 2, value: 'AGE=20' }],
  };
  const make = (k, f) => () => { cur = k; return f(); };
  const cfg = {
    id: 'u4kd', icon: 'tree-structure', title: 'KD-tree playground', hint: 'Type a record, or use the quick buttons. Step through the explanation.',
    presets: [
      { label: 'Lecture tree (12 points)', make: make('lec', lecture), get note() { return NOTES.lec; } },
      { label: 'PA4-5: build from the PC table', make: make('pa', pa), get note() { return NOTES.pa; } },
      { label: '2025 midterm: GPA / AGE', make: make('mid', midterm), get note() { return NOTES.mid; } },
    ],
    ops: [
      { label: 'Insert', icon: 'plus', run: insert },
      { label: 'Search', icon: 'magnifying-glass', run: search },
      { label: 'Partial / range query', icon: 'funnel', run: condQuery },
      { label: 'Insert next row', icon: 'arrow-fat-line-down', run: t => nextRow(t, false) },
      { label: 'Insert all rows', icon: 'arrows-down-up', run: t => nextRow(t, true) },
    ],
    input: { label: 'Record / condition', placeholder: 'e.g. 35, 280', parse: s => s },
    get quick() { return quicks[cur]; },
    draw: (t, hl) => D.kdSVG(t, { hl: hl || [] }),
    info: t => `Level 1 splits on <b>${t.attrs[0]}</b>${t.attrs.length > 1 ? `, level 2 on ${t.attrs[1]}` : ''}${t.attrs.length > 2 ? `, level 3 on ${t.attrs[2]}` : ''}, then the attributes rotate. Left: value &lt; V, right: value ≥ V. Leaf capacity ${t.cap}.${t.queue ? ` Rows inserted: ${t.qi} of ${t.queue.length}.` : ''} Input order: ${t.named ? 'name, ' : ''}${t.order.map(i => t.attrs[i]).join(', ')}.`,
  };
  const start = { lec: 0, pa: 1, mid: 2 }[cur];
  opsBench(el, cfg);
  if (start) el.querySelector(`[data-preset="${start}"]`).click();
}

// ====================================================================================== 5. Quad tree playground
export function u4Quad(el) {
  const L = (x, y) => ({ x, y });
  // The lecture figure treats (50,100) as lying in the SOUTH half of the square centred (75,100); see the PA4-3 notes.
  const lecture = () => ({ ...M.quadNew({ x0: 0, y0: 0, x1: 100, y1: 400 }, 2, { cx: 50, cy: 200,
    SW: { pts: [L(25, 60), L(45, 60)] },
    SE: { cx: 75, cy: 100, NW: { pts: [L(50, 120), L(70, 110)] }, NE: { pts: [L(85, 140)] }, SW: { pts: [L(50, 75), L(50, 100)] }, SE: { pts: [] } },
    NE: { pts: [L(50, 275), L(60, 260)] },
    NW: { cx: 25, cy: 300, NW: { pts: [] }, NE: { pts: [L(25, 400), L(45, 350)] }, SW: { pts: [] }, SE: { pts: [L(30, 260)] } } }), xl: 'Age', yl: 'Salary', w: 230, h: 300 });
  const pa44 = () => { let t = M.quadNew({ x0: -128, y0: -128, x1: 128, y1: 128 }, 1);
    t = M.quadInsert(t, { id: 'A', x: 100, y: 125 }).tree; t = M.quadInsert(t, { id: 'B', x: 25, y: -30 }).tree; return { ...t, xl: 'x', yl: 'y', w: 270, h: 270 }; };
  const mid = () => { let t = M.quadNew({ x0: 0, y0: 0, x1: 100, y1: 200 }, 1);
    t = M.quadInsert(t, { id: 'A', x: 60, y: 110 }).tree; t = M.quadInsert(t, { id: 'B', x: 30, y: 30 }).tree; return { ...t, xl: 'x', yl: 'y', w: 200, h: 300 }; };
  let cur = el.dataset.start === 'pa44' ? 'pa' : el.dataset.start === 'mid' ? 'mid' : 'lec';
  const NOTES = {
    lec: 'The lecture tree (slides 43 to 46): blocks of 2 points, square 0–100 by 0–400. The lecture figure keeps (50, 100) in the south half of the square centred (75, 100). A point exactly on a centre line is a tie: the engine sends ties North and East, so state your convention in an answer.',
    pa: 'PA4-4: blocks of 1 point on the square (−128, −128) to (128, 128). Do the steps in order: insert C and D, insert E, delete E, delete A, delete B. Compare the two delete buttons.',
    mid: '2025 midterm Exercise 5.2: blocks of 1 point on 0–100 by 0–200. Insert D(40, 40) and see the SW square split twice. The official answer swaps the labels NE and NW on the last level; the geometry below is correct.',
  };
  const quicks = {
    lec: [{ label: 'Insert (90, 150)', op: 0, value: '90, 150' }, { label: 'Insert (100, 110)', op: 0, value: '100, 110' }],
    pa: [{ label: 'Insert C(−55, 80)', op: 0, value: 'C, -55, 80' }, { label: 'Insert D(125, −60)', op: 0, value: 'D, 125, -60' }, { label: 'Insert E(80, 80)', op: 0, value: 'E, 80, 80' }, { label: 'Delete E', op: 1, value: 'E' }, { label: 'Delete A', op: 1, value: 'A' }, { label: 'Delete B', op: 1, value: 'B' }],
    mid: [{ label: 'Insert C(30, 150)', op: 0, value: 'C, 30, 150' }, { label: 'Insert D(40, 40)', op: 0, value: 'D, 40, 40' }],
  };
  const fail = (t, text) => ({ tree: t, steps: [{ text, kind: 'warn', tree: t }] });
  const pts = t => M.quadRegions(t).flatMap(r => r.pts);
  const parse = s => { const m = s.match(/^\s*(?:([A-Za-z]\w*)\s*)?\(?\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*\)?\s*$/); if (m) return { id: m[1], x: +m[2], y: +m[3] }; const n = s.trim().match(/^[A-Za-z]\w*$/); return n ? { name: n[0] } : null; };
  const tag = (t, id) => ({ ...t, last: id });
  const ins = (t, s) => {
    const p = parse(s); if (!p || p.name) return fail(t, 'Type a point such as 52, 200 or C, -55, 80.');
    const R = t.region; if (p.x < R.x0 || p.x > R.x1 || p.y < R.y0 || p.y > R.y1) return fail(t, `(${p.x}, ${p.y}) is outside the square (${R.x0}, ${R.y0}) to (${R.x1}, ${R.y1}).`);
    if (pts(t).some(q => q.x === p.x && q.y === p.y)) return fail(t, `A point at (${p.x}, ${p.y}) already exists. Two points at the same place could never be separated by splitting, so this demo refuses them.`);
    const pt = p.id ? { id: p.id, x: p.x, y: p.y } : { x: p.x, y: p.y }, r = M.quadInsert(t, pt);
    return { tree: tag(r.tree, pt.id), steps: r.steps.map(st => ({ ...st, tree: tag(st.tree, pt.id) })) };
  };
  const del = collapse => (t, s) => {
    let p = parse(s); if (!p) return fail(t, 'Type the point to delete, such as E or 80, 80.');
    if (p.name) { const q = pts(t).find(q => q.id === p.name); if (!q) return fail(t, `No point named ${p.name} in the tree.`); p = q; }
    const r = M.quadDelete(t, { x: p.x, y: p.y }, { collapse });
    return { tree: tag(r.tree, null), steps: r.steps.map(st => ({ ...st, text: collapse ? st.text : `${st.text} This button does not collapse squares: a lone point stays in its small square, like in the PA solution figures.`, tree: tag(st.tree, null) })) };
  };
  const make = (k, f) => () => { cur = k; return f(); };
  const cfg = {
    id: 'u4quad', icon: 'squares-four', title: 'Quad tree playground', hint: 'Plane and tree side by side. Insert or delete a point, then step through the explanation.',
    presets: [
      { label: 'Lecture tree (blocks of 2)', make: make('lec', lecture), get note() { return NOTES.lec; } },
      { label: 'PA4-4 (blocks of 1)', make: make('pa', pa44), get note() { return NOTES.pa; } },
      { label: '2025 midterm', make: make('mid', mid), get note() { return NOTES.mid; } },
    ],
    ops: [
      { label: 'Insert', icon: 'plus', run: ins },
      { label: 'Delete (collapse)', icon: 'minus', run: del(true) },
      { label: 'Delete (PA style)', icon: 'minus-circle', run: del(false) },
    ],
    input: { label: 'Point', placeholder: 'C, 30, 150  or  52, 200', parse: s => s },
    get quick() { return quicks[cur]; },
    draw: t => `<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start"><div style="flex:0 1 ${t.w + 60}px;min-width:240px">${D.quadPlaneSVG(t, { w: t.w, h: t.h, xLabel: t.xl, yLabel: t.yl, hl: t.last ? [t.last] : [] })}</div><div style="flex:1 1 100%;min-width:0">${D.quadTreeSVG(t)}</div></div>`,
    info: t => `Block capacity ${t.cap}. Quadrants: NW, NE, SW, SE. A square that holds more than ${t.cap} point${t.cap > 1 ? 's' : ''} splits at its centre; internal nodes show the centre. Highlighted point: the last one inserted.`,
  };
  const start = { lec: 0, pa: 1, mid: 2 }[cur];
  opsBench(el, cfg);
  if (start) el.querySelector(`[data-preset="${start}"]`).click();
}

// ====================================================================================== 6. Bitmap index workbench
export function u4Bitmap(el) {
  const DS = {
    pc: { label: 'PA4-2: PC table', ids: PC.map(r => r[0]), idName: 'Model', cols: [{ name: 'Speed', d: 2, vals: PC.map(r => r[1]) }, { name: 'Ram', d: 0, vals: PC.map(r => r[2]) }, { name: 'HD', d: 0, vals: PC.map(r => r[3]) }] },
    fg: { label: 'Lecture: F and G', ids: [1, 2, 3, 4, 5, 6], idName: 'Row', cols: [{ name: 'F', d: 0, vals: [30, 30, 40, 50, 40, 30] }, { name: 'G', d: 0, vals: ['foo', 'bar', 'baz', 'foo', 'bar', 'baz'] }] },
  };
  const f = (c, v) => typeof v === 'number' ? v.toFixed(c.d) : String(v);
  let key = 'pc', sel = [new Set(), new Set(), new Set()], ops = ['AND', 'AND'];
  const QUICK = {
    pc: [
      ['1. Speed = 2.20 AND HD = 250', [['2.20'], [], ['250']], ['AND', 'AND']],
      ['2. Ram ≥ 1024 AND HD ≤ 200', [[], ['1024', '2048'], ['160', '200']], ['AND', 'AND']],
      ['3. Speed in [2.10, 2.50) AND Ram ≥ 1024 AND HD ≤ 250', [['2.10', '2.20'], ['1024', '2048'], ['160', '200', '250']], ['AND', 'AND']],
      ['4. Speed ≤ 2.80 OR Ram &lt; 1024 AND HD &lt; 300', [['1.42', '1.86', '2.00', '2.10', '2.20', '2.66', '2.80'], ['512'], ['160', '200', '250']], ['OR', 'AND']],
    ],
    fg: [['F = 30 AND G = foo', [['30'], ['foo']], ['AND']], ['F = 30 OR G = baz', [['30'], ['baz']], ['OR']], ['F = 30 XOR G = baz', [['30'], ['baz']], ['XOR']]],
  };
  const xor = (a, b) => [...a].map((c, i) => (c === b[i] ? '0' : '1')).join('');
  const OP = { AND: M.bitAnd, OR: M.bitOr, XOR: xor };
  const spaced = (b, hl) => `<span class="num" style="letter-spacing:.08em">${[...b].map(c => c === '1' ? `<b style="color:${hl || 'var(--accent)'}">1</b>` : '<span style="color:var(--faint)">0</span>').join('')}</span>`;
  const render = () => {
    const ds = DS[key], n = ds.ids.length, maps = ds.cols.map(c => M.bitmap(c.vals));
    const used = ds.cols.map((c, i) => i).filter(i => sel[i].size);
    const terms = used.map(i => { const picked = maps[i].filter(m => sel[i].has(f(ds.cols[i], m.value))); return { i, picked, bits: picked.length > 1 ? M.bitOr(...picked.map(m => m.bits)) : picked[0].bits }; });
    // precedence AND > XOR > OR over consecutive used terms; ops[k] sits between used term k and k+1
    let items = terms.map(t => ({ bits: t.bits, txt: `${ds.cols[t.i].name}` })), oo = used.slice(0, -1).map((_, k) => ops[k] || 'AND'), log = [];
    for (const lvl of ['AND', 'XOR', 'OR']) for (let k = 0; k < oo.length;) { if (oo[k] === lvl) { const b = OP[lvl](items[k].bits, items[k + 1].bits); log.push([`(${items[k].txt}) ${lvl} (${items[k + 1].txt})`, b]); items.splice(k, 2, { bits: b, txt: `${items[k].txt} ${lvl} ${items[k + 1].txt}` }); oo.splice(k, 1); } else k++; }
    const res = items.length ? items[0].bits : null, rows = res ? [...res].map((c, i) => c === '1' ? ds.ids[i] : null).filter(x => x != null) : [];
    const where = used.length ? used.map((i, k) => { const c = ds.cols[i], v = [...sel[i]].map(x => typeof c.vals[0] === 'number' ? x : `'${x}'`), cond = v.length === 1 ? `${c.name} = ${v[0]}` : `${c.name} IN (${v.join(', ')})`; return (k ? ` ${ops[k - 1] || 'AND'} ` : '') + cond; }).join('') : '';
    el.innerHTML = `${bench('binary', 'Bitmap workbench', 'one bit vector per value, combined with bitwise operations')}
    <div class="bench-body">
      <div style="margin-bottom:10px">${seg(Object.entries(DS).map(([k, d]) => [k, d.label]), key, 'data-ds')}</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>${ds.idName}</th>${ds.cols.map(c => `<th>${c.name}</th>`).join('')}</tr></thead><tbody>
        ${ds.ids.map((id, r) => `<tr${res && res[r] === '1' ? ' class="fixed"' : ''}><td class="num muted">${r + 1}</td><td class="num">${id}</td>${ds.cols.map((c, ci) => `<td class="num">${f(c, c.vals[r])}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
      <p class="small muted" style="margin:10px 0 6px">Each value has a vector of ${n} bits: bit <i>i</i> is 1 when row <i>i</i> holds that value. <b>Tap values</b> to include them in the query (several values of one column are combined with OR, which is how a range is answered).</p>
      ${ds.cols.map((c, ci) => `<div style="margin-bottom:8px"><div class="small" style="font-weight:600;margin-bottom:4px">${c.name} bitmap index</div>
        <div style="display:flex;flex-direction:column;gap:3px">${maps[ci].map(m => { const on = sel[ci].has(f(c, m.value)); return `<button type="button" data-sel="${ci}|${esc(f(c, m.value))}" style="all:unset;cursor:pointer;display:flex;gap:10px;align-items:center;padding:3px 8px;border-radius:7px;border:1px solid ${on ? 'var(--accent-viz)' : 'var(--line)'};background:${on ? 'var(--accent-soft)' : 'var(--surface)'}"><span class="num" style="width:56px;font-size:13px;font-weight:${on ? 700 : 500}">${f(c, m.value)}</span>${spaced(m.bits)}</button>`; }).join('')}</div></div>`).join('')}
      <div class="chips" style="margin:10px 0"><span class="small muted" style="align-self:center">Load:</span>${QUICK[key].map((q, i) => `<button type="button" class="chip" data-quick="${i}">${q[0]}</button>`).join('')}<button type="button" class="chip" data-clear>Clear</button></div>
      ${used.length ? `<div class="small" style="margin-bottom:6px"><span class="muted">Operators between the columns (AND binds tighter than XOR, then OR, like SQL):</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px">${used.map((i, k) => `<span class="chip accent">${ds.cols[i].name}</span>${k < used.length - 1 ? `<select data-op="${k}" aria-label="operator">${['AND', 'OR', 'XOR'].map(o => `<option ${((ops[k] || 'AND') === o) ? 'selected' : ''}>${o}</option>`).join('')}</select>` : ''}`).join('')}</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Step</th><th>Bits</th></tr></thead><tbody>
        ${terms.map(t => `<tr><td>${ds.cols[t.i].name}: ${t.picked.map(m => f(ds.cols[t.i], m.value)).join(' OR ')}${t.picked.length > 1 ? ` (${t.picked.length - 1} bitwise OR${t.picked.length > 2 ? 's' : ''})` : ''}</td><td>${spaced(t.bits)}</td></tr>`).join('')}
        ${log.map(l => `<tr><td>${l[0]}</td><td>${spaced(l[1])}</td></tr>`).join('')}
        <tr class="fixed"><td><b>Result</b></td><td>${spaced(res, 'var(--good)')}</td></tr></tbody></table></div>
      ${callout('check-circle', `<span class="num">${where}</span><br><b>${rows.length}</b> matching row${rows.length === 1 ? '' : 's'}: ${rows.length ? rows.map(r => `<b class="num">${r}</b>`).join(', ') : 'none'}. The planner read <b>${terms.reduce((a, t) => a + t.picked.length, 0)}</b> bit vector${terms.reduce((a, t) => a + t.picked.length, 0) === 1 ? '' : 's'} of ${n} bits, combined them with ${terms.reduce((a, t) => a + t.picked.length - 1, 0) + terms.length - 1} bitwise operation${terms.reduce((a, t) => a + t.picked.length - 1, 0) + terms.length - 1 === 1 ? '' : 's'}, and then fetched only the ${rows.length} row${rows.length === 1 ? '' : 's'} whose bit is 1.`, 'var(--good)')}` : callout('cursor-click', 'Tap one or more values above to build a WHERE clause.')}
    </div>`;
  };
  on(el, '[data-ds]', 'click', (e, b) => { key = b.dataset.ds; sel = [new Set(), new Set(), new Set()]; ops = ['AND', 'AND']; render(); });
  on(el, '[data-sel]', 'click', (e, b) => { const [ci, v] = b.dataset.sel.split('|'), s = sel[+ci]; s.has(v) ? s.delete(v) : s.add(v); render(); });
  on(el, '[data-quick]', 'click', (e, b) => { const q = QUICK[key][+b.dataset.quick]; sel = [0, 1, 2].map(i => new Set(q[1][i] || [])); ops = q[2].slice(); render(); });
  on(el, '[data-clear]', 'click', () => { sel = [new Set(), new Set(), new Set()]; render(); });
  el.addEventListener('change', e => { if (e.target.dataset.op != null) { ops[+e.target.dataset.op] = e.target.value; render(); } });
  render();
}

// ====================================================================================== 7. Sorters
export function u4Which(el) {
  const O = ['Partitioned hash', 'Grid index', 'KD-tree', 'Quad tree', 'Bitmap'];
  sorter(el, { id: 'u4-which', icon: 'list-checks', title: 'Which multidimensional index?', hint: 'Pick the index the lecture slides would name for each requirement.', options: O, cols: 270, items: [
    { t: 'A workload that needs exact, partial-match, range and nearest-neighbour queries on two columns.', a: 'Grid index', why: 'The grid index is the only structure on the slides that lists all four query types as supported.' },
    { t: 'Only exact and partial-match lookups, O(1) + K time, no range or nearest-neighbour queries.', a: 'Partitioned hash', why: 'Partitioned hashing: O(1) + K, partial match yes, range and nearest neighbour no.' },
    { t: 'The index must have a very small memory footprint and only exact-value lookups are needed.', a: 'KD-tree', why: 'The KD-tree is O(log n), efficient for exact values, and its greatest advantage is a small memory footprint.' },
    { t: 'The tree can grow very deep when the data is not uniformly distributed and it is very sensitive to changes in the data points.', a: 'Quad tree', why: 'These are the slide 47 cons of quad trees.' },
    { t: 'Many conditions on a few distinct values combined with AND, OR and XOR using fast bitwise operations, at the price of one bit per row per value.', a: 'Bitmap', why: 'Bitmap pros: AND, OR, XOR and range with super-fast bitwise operations. Cons: long bit sequences, O(n) space.' },
    { t: 'Most data is inserted first, then the index is built and queried. Choosing the ranges of the stripes is hard and changing them later is costly.', a: 'Grid index', why: 'Takeaways I: creating and updating the grid ranges is inefficient, so it suits data that is loaded first and queried afterwards.' },
    { t: 'The index is built by concatenating hash values, one per attribute, to form the bucket number.', a: 'Partitioned hash', why: 'Mechanism II: bucket = h1(a1) ∘ h2(a2) ∘ ... concatenated bits.' },
    { t: 'The structure is a binary tree whose levels rotate among the attributes, each interior node storing an attribute and a value V.', a: 'KD-tree', why: 'That is the definition of a KD-tree: less than V goes left, equal or greater goes right.' },
    { t: 'Each interior node is a square region with four children: its quadrants.', a: 'Quad tree', why: 'Quad tree: a square with too many points splits into NW, NE, SW and SE.' },
    { t: 'The index keeps the grid in memory and each cell points to a bucket (page) on disk, with overflow buckets chained when a cell is too full.', a: 'Grid index', why: 'Slide 25: the grid is in memory, the buckets are pages on disk.' },
  ] });
}
export function u4Support(el) {
  sorter(el, { id: 'u4-support', icon: 'check-square', title: 'Which queries does it support?', hint: 'Follow the lecture slides: each card names an index and a query type.', options: ['Supported', 'Not supported'], cols: 250, items: [
    { t: '<b>Partitioned hash</b>: partial-match query (only one of the attributes is given).', a: 'Supported', why: 'Concatenated per-attribute hashes fix only some bits; the other bits take every value.' },
    { t: '<b>Partitioned hash</b>: range query.', a: 'Not supported', why: 'Hashing scatters neighbouring values over unrelated buckets.' },
    { t: '<b>Partitioned hash</b>: nearest-neighbour query.', a: 'Not supported', why: 'Close values do not hash to close buckets, so the hash order says nothing about nearness.' },
    { t: '<b>Partitioned hash, Mechanism I</b> (one hash of all attributes): a query that gives only a1 and a2 of n attributes.', a: 'Not supported', why: 'Mechanism I needs the values of all n attributes to compute h(a1, ..., an).' },
    { t: '<b>Grid index</b>: partial-match query.', a: 'Supported', why: 'Read the whole row or column of cells that the known attribute selects.' },
    { t: '<b>Grid index</b>: nearest-neighbour query.', a: 'Supported', why: 'The grid keeps nearby values in nearby cells: read the home cell and its neighbours.' },
    { t: '<b>Grid index</b>: range query.', a: 'Supported', why: 'Read the block of cells that overlaps the range.' },
    { t: '<b>KD-tree</b>: exact-value query.', a: 'Supported', why: 'Compare level by level: O(log n).' },
    { t: '<b>KD-tree</b>: partial-match query.', a: 'Not supported', why: 'Slide 40 lists it as a con: a node that splits on an unmentioned attribute gives no direction.' },
    { t: '<b>KD-tree</b>: nearest-neighbour query.', a: 'Not supported', why: 'Slide 40 lists it as a con: the closest point may sit on the other side of a split.' },
    { t: '<b>Quad tree</b>: range query.', a: 'Supported', why: 'Slide 47 lists good range queries as the quad tree\'s pro.' },
    { t: '<b>Bitmap</b>: a range, AND, OR or XOR over values.', a: 'Supported', why: 'OR the vectors of the values in the range, then AND/OR/XOR the columns together: all cheap bitwise operations.' },
  ] });
}
