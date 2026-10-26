import { K, T, W, terms, compare, steps, code, table } from './helpers.js';
import * as M from '../engine/multidim.js';
import * as D from '../engine/draw.js';

// ============================================================ data and engine-built figures (every number below comes from the engine)
const E = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const WS = (name, start) => `<div class="bench" data-widget="${name}" data-start="${start}"></div>`;
const fig = (svg, cap) => `<figure style="margin:14px 0"><div style="overflow-x:auto">${svg}</div><figcaption class="small muted" style="margin-top:4px">${cap}</figcaption></figure>`;
const side = (...items) => `<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;margin:14px 0">${items.map(i => `<div style="flex:1 1 280px;min-width:0">${i}</div>`).join('')}</div>`;
const bits = b => `<span class="num">${b}</span>`;
const ids = a => a.join(', ');
const PC = [[1001, 2.66, 1024, 250], [1002, 2.10, 512, 250], [1003, 1.42, 512, 160], [1004, 2.80, 1024, 250], [1005, 3.20, 512, 250], [1006, 3.20, 1024, 300], [1007, 2.20, 1024, 200], [1008, 2.20, 2048, 250], [1009, 2.00, 1024, 250], [1010, 2.80, 2048, 300], [1011, 1.86, 2048, 160], [1012, 2.80, 1024, 160]];
const pcTable = table(['Model', 'Speed', 'Ram', 'HD'], PC.map(([m, s, r, h]) => [m, s.toFixed(2), r, h]));

// ---- the lecture's 12 (age, salary) points
const LP = [[25, 60], [45, 60], [50, 75], [50, 100], [50, 120], [70, 110], [85, 140], [30, 260], [25, 400], [45, 350], [50, 275], [60, 260]];
const gridPts = LP.map(([x, y]) => ({ id: `${x},${y}`, x, y }));
const GB = { x0: 0, x1: 100, y0: 0, y1: 500 };
const gLines = { x: [40, 55], y: [90, 225] }, gLines2 = { x: [40, 55], y: [90, 130, 225] };
const newPt = { id: '52,200', x: 52, y: 200 };
const gridFig = (lines, pts, hl = []) => D.gridSVG(lines, GB, pts, { w: 280, h: 230, xLabel: 'Age', yLabel: 'Salary (K)', hl });
const stripes = (ls, max) => { const b = [0, ...ls, max]; return b.slice(0, -1).map((v, i) => i === b.length - 2 ? `${v}+` : `${v}–${b[i + 1]}`); };
// bucket table in the style of the lecture's "grid distribution of points in buckets"
function bucketTable(lines, pts, cap = 2, mark = []) {
  const cells = M.gridBuild(lines, pts, cap).cells, cl = stripes(lines.x, 100), rl = stripes(lines.y, 500);
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Salary \\ Age</th>${cl.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${[...rl.keys()].reverse().map(r => `<tr><td class="num"><b>${rl[r]}</b></td>${cl.map((_, c) => { const a = cells[c + ',' + r] || [], ch = []; for (let i = 0; i < Math.max(a.length, 1); i += cap) ch.push(a.slice(i, i + cap));
    return `<td class="num" style="font-size:12.5px">${a.length ? ch.map((x, i) => `<div style="${i ? 'border-top:1px dashed var(--bad);margin-top:3px;padding-top:3px' : ''}">${i ? '<span style="color:var(--bad)">overflow </span>' : ''}${x.map(p => mark.includes(p.id) ? `<b class="hl">(${p.x},${p.y})</b>` : `(${p.x},${p.y})`).join(' ')}</div>`).join('') : '<span class="muted">empty</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const gridAfter = [...gridPts, newPt];

// ---- lecture KD-tree
const KP = (age, sal) => ({ id: `${age},${sal}`, v: [sal, age] });
const kdLec = M.kdNew(['Salary', 'Age'], 2, {
  attr: 0, val: 150,
  left: { attr: 1, val: 60, left: { attr: 0, val: 80, left: { attr: 1, val: 38, left: { recs: [KP(25, 60)] }, right: { recs: [KP(45, 60), KP(50, 75)] } }, right: { recs: [KP(50, 100), KP(50, 120)] } }, right: { recs: [KP(70, 110), KP(85, 140)] } },
  right: { attr: 1, val: 47, left: { attr: 0, val: 300, left: { recs: [KP(30, 260)] }, right: { recs: [KP(25, 400), KP(45, 350)] } }, right: { recs: [KP(50, 275), KP(60, 260)] } } });
const kdA = M.kdInsert(kdLec, KP(35, 280)), kdB = M.kdInsert(kdLec, KP(35, 500));

// ---- lecture quad tree (the figure of slides 43 to 46; (50,100) sits in the SOUTH half of the square centred (75,100))
const QP = (x, y) => ({ x, y });
const quadLec = M.quadNew({ x0: 0, y0: 0, x1: 100, y1: 400 }, 2, { cx: 50, cy: 200,
  SW: { pts: [QP(25, 60), QP(45, 60)] },
  SE: { cx: 75, cy: 100, NW: { pts: [QP(50, 120), QP(70, 110)] }, NE: { pts: [QP(85, 140)] }, SW: { pts: [QP(50, 75), QP(50, 100)] }, SE: { pts: [] } },
  NE: { pts: [QP(50, 275), QP(60, 260)] },
  NW: { cx: 25, cy: 300, NW: { pts: [] }, NE: { pts: [QP(25, 400), QP(45, 350)] }, SW: { pts: [] }, SE: { pts: [QP(30, 260)] } } });
const quadQ1 = M.quadInsert(quadLec, QP(90, 150)).tree;
const quadQ2 = M.quadInsert(quadQ1, QP(100, 110)).tree;
let quadEng = M.quadNew({ x0: 0, y0: 0, x1: 100, y1: 400 }, 2);
LP.forEach(([x, y]) => { quadEng = M.quadInsert(quadEng, QP(x, y)).tree; });
const qFig = t => `<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start"><div style="flex:0 1 290px;min-width:230px">${D.quadPlaneSVG(t, { w: 220, h: 290, xLabel: 'Age', yLabel: 'Salary' })}</div><div style="flex:1 1 100%;min-width:0">${D.quadTreeSVG(t)}</div></div>`;

// ---- bitmaps
const FCOL = [30, 30, 40, 50, 40, 30], GCOL = ['foo', 'bar', 'baz', 'foo', 'bar', 'baz'];
const bmTable = (name, col, f = v => v) => table([`${name} value`, 'Bit vector'], M.bitmap(col).map(m => [f(m.value), bits(m.bits)]));
const speedBM = M.bitmap(PC.map(r => r[1])), ramBM = M.bitmap(PC.map(r => r[2])), hdBM = M.bitmap(PC.map(r => r[3]));
const vec = (maps, v) => maps.find(m => m.value === v).bits;
const rowsOf = b => [...b].map((c, i) => c === '1' ? PC[i][0] : null).filter(Boolean);
const orV = (maps, pred) => M.bitWhere(maps, pred);
const pcQ = {
  q1: M.bitAnd(vec(speedBM, 2.2), vec(hdBM, 250)),
  ramGE: orV(ramBM, v => v >= 1024), hdLE200: orV(hdBM, v => v <= 200),
  spR: orV(speedBM, v => v >= 2.1 && v < 2.5), hdLE250: orV(hdBM, v => v <= 250),
  spLE: orV(speedBM, v => v <= 2.8), ramLT: orV(ramBM, v => v < 1024), hdLT300: orV(hdBM, v => v < 300),
};
pcQ.q2 = M.bitAnd(pcQ.ramGE.bits, pcQ.hdLE200.bits);
pcQ.q3 = M.bitAnd(pcQ.spR.bits, pcQ.ramGE.bits, pcQ.hdLE250.bits);
pcQ.right4 = M.bitAnd(pcQ.ramLT.bits, pcQ.hdLT300.bits);
pcQ.q4 = M.bitOr(pcQ.spLE.bits, pcQ.right4);
const bmStep = (label, b) => `<tr><td>${label}</td><td>${bits(b)}</td></tr>`;

// ---- partitioned hashing (PA4-6)
const hHD = { 160: '00', 200: '01', 250: '10', 300: '11' }, hSp = { '1.42': '000', '1.86': '001', '2.00': '010', '2.10': '011', '2.20': '100', '2.66': '101', '2.80': '110', '3.20': '111' };
const pkey = (hd, sp) => M.partKey([hHD, hSp], [String(hd), sp.toFixed(2)]);
const keyed = PC.map(([m, s, , h]) => ({ m, s, h, k: pkey(h, s) }));
const byKey = {}; keyed.forEach(r => (byKey[r.k] ||= []).push(r.m));
const hashTable32 = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Hash</th><th>Model</th><th>Hash</th><th>Model</th></tr></thead><tbody>${Array.from({ length: 16 }, (_, i) => { const a = i.toString(2).padStart(5, '0'), b = (i + 16).toString(2).padStart(5, '0'); const c = k => k === '10100' ? ' style="background:var(--accent-soft);font-weight:700"' : ''; return `<tr><td class="num"${c(a)}>${a}</td><td class="num"${c(a)}>${(byKey[a] || []).join(', ')}</td><td class="num"${c(b)}>${b}</td><td class="num"${c(b)}>${(byKey[b] || []).join(', ')}</td></tr>`; }).join('')}</tbody></table></div>`;
const partOf = (hd, sp) => M.partBuckets([hHD, hSp], [hd, sp]);

// ---- PA4-5: KD-tree built from the PC table
let kdPA = M.kdNew(['Speed', 'Ram', 'HD'], 2);
const kdSplits = [];
PC.forEach(([id, ...v]) => { const r = M.kdInsert(kdPA, { id, v }); r.steps.filter(s => s.kind === 'warn').forEach(s => kdSplits.push([`Insert ${id}`, E(s.text)])); kdPA = r.tree; });

// ---- PA4-4 states
const q44 = {};
q44.start = (() => { let t = M.quadNew({ x0: -128, y0: -128, x1: 128, y1: 128 }, 1); t = M.quadInsert(t, { id: 'A', x: 100, y: 125 }).tree; return M.quadInsert(t, { id: 'B', x: 25, y: -30 }).tree; })();
q44.cd = M.quadInsert(M.quadInsert(q44.start, { id: 'C', x: -55, y: 80 }).tree, { id: 'D', x: 125, y: -60 }).tree;
q44.e = M.quadInsert(q44.cd, { id: 'E', x: 80, y: 80 }).tree;
q44.delE = M.quadDelete(q44.e, { x: 80, y: 80 }).tree;
q44.delA = M.quadDelete(q44.delE, { x: 100, y: 125 }).tree;
q44.delB = M.quadDelete(q44.delA, { x: 25, y: -30 }).tree;
q44.delBpa = M.quadDelete(q44.delA, { x: 25, y: -30 }, { collapse: false }).tree;
const q44fig = (t, cap) => fig(`<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start"><div style="flex:0 1 270px;min-width:230px">${D.quadPlaneSVG(t, { w: 200, h: 200 })}</div><div style="flex:1 1 260px;min-width:0">${D.quadTreeSVG(t)}</div></div>`, cap);

// ---- 2025 midterm Exercise 5
const GM = (name, age, gpa) => ({ id: `${name}, ${age}, ${gpa}`, v: [gpa, age] });
const mtKD = M.kdNew(['GPA', 'AGE'], 2, { attr: 0, val: 2.56, left: { recs: [GM('Jamal', 22, 1.2), GM('Fatima', 21, 0.9)] }, right: { attr: 1, val: 17.3, left: { recs: [GM('Sarah', 17, 3.8), GM('Michael', 16, 4)] }, right: { recs: [GM('Amina', 19, 2.7)] } } });
const mtA = M.kdInsert(mtKD, GM('Mohamed', 20, 1.6)), mtB = M.kdInsert(mtKD, GM('Mohamed', 20, 2.6));
let mtQ = M.quadNew({ x0: 0, y0: 0, x1: 100, y1: 200 }, 1);
mtQ = M.quadInsert(M.quadInsert(mtQ, { id: 'A', x: 60, y: 110 }).tree, { id: 'B', x: 30, y: 30 }).tree;
const mtC = M.quadInsert(mtQ, { id: 'C', x: 30, y: 150 }), mtD = M.quadInsert(mtQ, { id: 'D', x: 40, y: 40 });
const mtQfig = (t, h = 220) => `<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start"><div style="flex:0 1 230px;min-width:200px">${D.quadPlaneSVG(t, { w: 150, h, xLabel: 'x', yLabel: 'y' })}</div><div style="flex:1 1 260px;min-width:0">${D.quadTreeSVG(t)}</div></div>`;

// ============================================================ LECTURE 4
export const lecture = {
  id: 'l4', kind: 'lecture', num: 'L4', icon: 'cube',
  title: 'Lecture 4: Multidimensional Indices', navTitle: 'Multidimensional indices', mapLabel: 'Multi-dim',
  short: 'Indexing on several columns at once: partitioned hashing, grid index, KD-trees, quad trees and bitmaps, and which query types each one can answer.',
  goals: [
    'Explain with I/O numbers why a one-column index is not enough for dept = Toy AND salary > 50,000.',
    'Build partitioned-hash bucket numbers by concatenation and list the buckets an exact or partial-match query must read.',
    'Insert into a grid index with both overflow strategies and read cells for range, partial and nearest-neighbour queries.',
    'Search and insert in a KD-tree (rotating attributes, split at the mean) and in a quad tree (split a square into four quadrants).',
    'Read, build and combine bitmap indexes with AND, OR and XOR.',
    'Say which index supports exact, partial-match, range and nearest-neighbour queries, and why, following the slides.',
  ],
  sections: [
    // ------------------------------------------------------------------ 1
    { id: 'motivation', title: 'Recap and the motivating query', body: `<div class="prose">
<p>Every index so far (conventional, B+ tree, hash) is a set of <b>key-pointer pairs</b>: a key holds one column value, the pointer says where the row is. For example <span class="num">&lt;Mohamed, 4&gt;</span> says that the row with first name Mohamed is on page 4. All three structures index <b>one column</b>. Lecture 4 asks what to do when a query has conditions on <b>several columns</b> at once.</p>
<p>The lecture's query:</p>
${code(`SELECT employee.name
FROM Store
WHERE dept = 'Toy' AND salary > 50,000`, 'SQL')}
<p>Assumptions used in every strategy: the table has <b>100,000 rows</b>; a page holds <b>10 rows</b> (so 10,000 table pages); a B+ tree node holds <b>100 pointers</b> (and a page holds 100 key-pointer pairs); each department has <b>1,000 employees</b>; 50% of all employees earn more than 50,000.</p>
<p>A B+ tree over 100,000 rows with 100 pointers per node has 100,000 / 100 = <b>1,000 leaf nodes</b>, then 1,000 / 100 = <b>10 non-leaf nodes</b>, then <b>1 root</b>. The root is assumed to be in memory, so it costs no I/O.</p>
</div>
<h3>Strategy 1: a B+ tree on dept only</h3>
<div class="prose">
<p>Use the index to find all Toy employees, fetch them, and check the salary of each one afterwards.</p>
${steps([
  ['Index', '1,000 Toy pointers / 100 per leaf = <b>10 leaf nodes</b>. They share <b>1 non-leaf node</b>. Index cost: 1 + 10 = 11 I/Os.'],
  ['Table, best case', 'If the table is sorted by dept, the 1,000 Toy rows are packed together: 1,000 / 10 rows per page = <b>100 pages</b>. Total <b>11 + 100 = 111 I/Os</b>.'],
  ['Table, worst case', 'If the table is not sorted by dept, the 1,000 Toy rows can sit on <b>1,000 different pages</b>: one I/O per pointer. Total <b>11 + 1,000 = 1,011 I/Os</b>.'],
])}
<p>Half of the fetched rows (those with salary at or below 50,000) are thrown away. The index cannot use the salary condition.</p>
</div>
<h3>Strategy 2: indexes on both columns</h3>
<div class="prose">
<p>The slide says "an index on both columns, dept and salary", and then costs <b>two separate lookups</b>: one B+ tree on dept and one on salary. It adds the costs.</p>
${steps([
  ['Dept part', 'Exactly strategy 1: <b>111</b> (sorted) or <b>1,011</b> (not sorted).'],
  ['Salary index', '50% of 100,000 rows = <b>50,000 pointers</b>. 50,000 / 100 = <b>500 leaf nodes</b>, parented by 500 / 100 = <b>5 non-leaf nodes</b> (root in memory). Index cost: 500 + 5 = 505 I/Os.'],
  ['Salary table pages', 'Sorted by salary: 50,000 / 10 = <b>5,000 pages</b>. Not sorted: <b>50,000 pages</b> (one per pointer).'],
  ['Salary part', '505 + 5,000 = <b>5,505</b> or 505 + 50,000 = <b>50,505</b> I/Os.'],
  ['Total', '5,505 + 111, or 5,505 + 1,011, or 50,505 + 111, or 50,505 + 1,011. That is <b>5,616 / 6,516 / 50,616 / 51,516</b>.'],
])}
${T('A table file can be physically sorted on only <b>one</b> column, so you cannot have both "sorted by dept" and "sorted by salary". The slide lists all four combinations as the possible cases, not as four situations that can happen together. Also notice that strategy 2 is <b>worse</b> than strategy 1: salary &gt; 50,000 keeps half of the table, so that index is not selective. Scanning the whole table would cost only 100,000 / 10 = 10,000 I/Os.')}
</div>
<h3>Strategy 3: sort the file and build a multilevel index</h3>
<div class="prose">
<p>Sort the table on salary and dept and build a <b>multilevel dense index</b>, one level for salary and one for dept. The lecture leaves the I/O count as an exercise ("for you to find out"), so there is <b>no official number</b>. The important points are qualitative: only the rows you need are read, but <b>the rows of the table must be physically re-ordered</b>, the index only fits that one sort order, and the lecture says we "will use something like that later". Later is the grid index, the KD-tree and the quad tree.</p>
${K('Multidimensional indexes exist because a single-column index forces you to fetch every row that matches <b>one</b> condition and then filter by the others. One index that understands both columns reads (almost) only the rows that match both.')}
</div>
${W('u4Motivation')}` },

    // ------------------------------------------------------------------ 2
    { id: 'definition', title: 'What a multidimensional index is', body: `<div class="prose">
<p>A <b>multidimensional index</b> is a data structure made of <b>keylist-pointer pairs</b>. The key is no longer one value but a <b>list</b> of column values. Example: <span class="num">&lt;(Mohamed, 22), 4&gt;</span> points to all rows whose first name is Mohamed <b>and</b> whose age is 22.</p>
<p>Why care about several dimensions? Even beyond databases:</p>
<ul>
<li><b>Geographic data</b>: every location needs an x and a y coordinate.</li>
<li><b>Computer graphics</b>: to render something you must pinpoint locations on the screen.</li>
</ul>
<p>Just like one-dimensional indexes, multidimensional indexes come in two data-structure families:</p>
</div>
${compare(['tree-structure', 'Tree-structure based', ['<b>KD-tree</b>: a binary tree that rotates through the attributes', '<b>Quad tree</b>: squares split into four quadrants']], ['hash', 'Hash-structure based', ['<b>Partitioned hash table</b>: "hash" each dimension, every dimension contributes bits of the bucket number', '<b>Grid index</b>: "sort" the values along each dimension into stripes']])}
<div class="prose">
<p>The <b>bitmap index</b> is the last structure of the lecture. It does not belong to either family: it stores one bit vector per value.</p>
<h3>The four query types</h3>
<p>The whole lecture is organised around which queries each structure can answer. Index on (age, salary):</p>
${table(['Query type', 'Meaning', 'Example'], [
  ['Exact match', 'A value for <b>every</b> indexed attribute', 'age = 50 AND salary = 100'],
  ['Partial match', 'A value for <b>some</b> of the attributes, the others are free', 'age = 50 (salary unknown)'],
  ['Range', 'An interval on one or more attributes', 'age between 45 and 60 AND salary between 100 and 300'],
  ['Nearest neighbour', 'The point closest to a given point', 'the employee closest to age 52, salary 130'],
])}
${table(['Structure', 'Exact', 'Partial match', 'Range', 'Nearest neighbour', 'Slide verdict'], [
  ['Partitioned hash', 'yes', 'yes', 'no', 'no', 'O(1) + K'],
  ['Grid index', 'yes', 'yes', 'yes', 'yes', 'O(log m) + K, but space overhead and hard range choice'],
  ['KD-tree', 'yes', 'no', 'inefficient (Takeaways)', 'no', 'O(log n), small memory footprint'],
  ['Quad tree', 'not stated', 'not stated', 'good', 'not stated', 'sensitive to changes, deep on skewed data'],
  ['Bitmap', 'yes', 'yes (AND of columns)', 'yes (OR of values)', 'not stated', 'bitwise AND, OR, XOR; O(n) bits per value'],
])}
${K('Memorise this table. Most exam questions in this unit are "which index would you pick for this workload, and why".')}
</div>` },

    // ------------------------------------------------------------------ 3
    { id: 'partitioned-hash', title: 'Partitioned hash tables', body: `<div class="prose">
<p>Two kinds of hash-based multidimensional index appear in the lecture: the <b>grid index</b> ("sort" the values along each dimension) and the <b>partitioned hash table</b> ("hash" each dimension, each one contributing to the bucket number). We start with the second one.</p>
<h3>Mechanism I: one hash of everything</h3>
<p>Take the keylist <span class="num">a1, a2, ..., an</span> and apply a single hash function <span class="num">h(a1, a2, ..., an)</span>. This works for an exact match but has a <b>pitfall</b>: a query with conditions only on a1 and a2 cannot compute h, because h needs <b>all n values</b>. So this mechanism cannot answer partial-match queries.</p>
<h3>Mechanism II: concatenate one hash per attribute</h3>
<p>Use a separate hash function for each attribute: <span class="num">h1</span> for a1, <span class="num">h2</span> for a2, and so on. Each produces a few bits <span class="num">v1, v2, ..., vn</span>. The bucket number is the <b>concatenation</b> <span class="num">v1 ∘ v2 ∘ ... ∘ vn</span>. Now a query on a <b>subset</b> of the attributes fixes some bits and leaves the others free, so partial-match queries work.</p>
${table(['', 'Mechanism I', 'Mechanism II'], [
  ['Bucket number', 'h(a1, ..., an)', 'h1(a1) ∘ h2(a2) ∘ ... ∘ hn(an)'],
  ['Exact match', 'yes', 'yes'],
  ['Partial match', '<b>no</b>: needs every attribute', '<b>yes</b>: unknown parts take every bit pattern'],
])}
<h3>The lecture example: insertion</h3>
<p>Employees <span class="num">&lt;Name, dept, salary&gt;</span>. Hash functions: <span class="num">h1</span> (dept) gives <b>1 bit</b>: toy = 0, sales = 1, art = 1. <span class="num">h2</span> (salary) gives <b>2 bits</b>: 10k = 01, 20k = 11, 30k = 01, 40k = 00. The bucket number has 1 + 2 = 3 bits, so there are <b>8 buckets</b> (000 to 111).</p>
${table(['Person', 'h1(dept)', 'h2(salary)', 'Bucket'], [
  ['Fred (toy, 10k)', '0', '01', bits('001')], ['Joe (sales, 10k)', '1', '01', bits('101')], ['Sally (art, 30k)', '1', '01', bits('101')],
])}
<p>Joe and Sally land in the same bucket: sales and art both hash to 1, and 10k and 30k both hash to 01. Two different keylists sharing a bucket is a <b>collision</b>. The bucket must be checked against the real values.</p>
<h3>The lecture example: lookups</h3>
${table(['Query', 'Known bits', 'Buckets to read'], [
  ['Dept = Sales AND Sal = 40k', '1 and 00', `${bits('100')} (one bucket)`],
  ['Sal = 30k', 'h2 = 01, dept unknown', `${bits('001')} and ${bits('101')} (two buckets)`],
  ['Dept = Sales', 'h1 = 1, salary unknown', `${bits('100')}, ${bits('101')}, ${bits('110')}, ${bits('111')} (four buckets)`],
])}
<p>A partial-match query reads <b>2<sup>u</sup> buckets</b>, where u is the number of bits that belong to the unknown attributes.</p>
${T('The lookup figures on slides 19 to 21 show a bigger set of names (Jan, Marv, Tom, Bill, Andy) than the insertion figure on slide 18, and the slide-21 circle skips the empty bucket 101 even though 101 has to be read too. Do not copy bucket contents from the lookup slides. Compute the bucket numbers from h1 and h2, which is what the exam asks.')}
<h3>Pros and cons</h3>
${compare(['thumbs-up', 'Pros', ['<b>O(1) + K</b> access time (hash, then read the K records of the bucket)', 'Answers <b>partial-match</b> queries']], ['thumbs-down', 'Cons', ['<b>Range</b> queries are not possible', '<b>Nearest-neighbour</b> queries are not possible']])}
<p><b>Why do range and nearest-neighbour queries fail?</b> A hash function is chosen to <b>scatter</b> values. In the example 10k, 20k and 30k hash to 01, 11 and 01. Neighbouring values land in unrelated buckets, and values that are not stored yet (25k) can land anywhere. The hash gives no order, so you can never say "the answer lies in this group of buckets". The only safe plan for a range or nearest-neighbour query is to read every bucket.</p>
${K('You choose how many bits each attribute gets. More bits for an attribute means fewer buckets to read when it is given, but more buckets to read when it is missing. Try it below: click a code to change a hash value, insert people, then query.')}
</div>
${W('u4Partitioned')}` },

    // ------------------------------------------------------------------ 4
    { id: 'grid-index', title: 'Grid index', body: `<div class="prose">
<h3>The idea</h3>
<p>The space of points is cut into a <b>grid</b>. In each dimension, <b>grid lines</b> split the axis into <b>stripes</b>. The number of lines can differ per dimension and the spacing between lines does not have to be even. A point that falls exactly <b>on a grid line</b> belongs to the stripe for which that line is the <b>lower boundary</b>. Each cell of the grid points to a <b>bucket</b> that holds a fixed number of pointers.</p>
<p><b>Bigger picture (slide 25):</b> the grid itself (only pointers to buckets) lives <b>in memory</b>. The buckets are pages on <b>disk</b>, and they point to the pages of the table. Several cells may share a bucket, and an extra bucket can be chained when one is not enough.</p>
<p>The grid does not have to be built on raw numbers. Slide 31 shows a grid whose rows are salary ranges (0-20K = 1, 20K-50K = 2, 50K and up = 3) and whose columns are department codes (1 = Toy, 2 = Sales, 3 = Personnel): you may index <b>value ranges</b> or <b>categories mapped to numbers</b>.</p>
<h3>The 12-point example</h3>
<p>Points are (age, salary in K). Grid lines: age <b>40 and 55</b>, salary <b>90K and 225K</b>. A bucket holds <b>2</b> pointers. That gives 3 × 3 = 9 cells.</p>
${side(fig(gridFig(gLines, gridPts), 'Grid lines at age 40, 55 and salary 90K, 225K.'), `<div class="small muted" style="margin-bottom:4px">Grid distribution of points in buckets (slide 27)</div>${bucketTable(gLines, gridPts)}`)}
<h3>Insertion: inserting (52, 200) when the bucket is full</h3>
<p>(52, 200) falls in the cell <b>age 40–55, salary 90–225K</b>. Its bucket already holds (50,100) and (50,120): it is full. The lecture gives two options.</p>
<p><b>Approach 1: add an overflow bucket.</b> Chain a new bucket to the full one and store (52, 200) there. The grid does not change. The cost is that every lookup in that cell now reads two buckets.</p>
${fig(bucketTable(gLines, gridAfter, 2, ['52,200']), 'After approach 1: the cell age 40–55, salary 90–225K has a chained overflow bucket holding (52, 200).')}
<p><b>Approach 2: reorganise the grid lines</b> "similar to dynamic hashing". Add a new line that separates the points. In the lecture a new salary line at <b>130K</b> is added: (50,100) and (50,120) stay below it and (52,200) goes above it.</p>
${side(fig(gridFig(gLines2, gridAfter, ['52,200']), 'After approach 2: new salary line at 130K.'), `<div class="small muted" style="margin-bottom:4px">Buckets after the new line</div>${bucketTable(gLines2, gridAfter, 2, ['52,200'])}`)}
<p>A grid line cuts the <b>whole</b> space, not just the full cell. The new salary line adds a whole row of cells: the grid grows from 9 to 12 cells, and cells such as (age 0–40, salary 90–130K) are empty. Any value strictly between 120 and 200 would have worked as the new line.</p>
${T('A new grid line is not local. It adds a row or column of cells everywhere. That is the "space management overhead" the slide asks you to contemplate.')}
<h3>Lookups</h3>
${table(['Query', 'What you read'], [
  ['Exact match, e.g. X = 5, V = 200 (slide 31)', 'Compute the one cell, here <span class="num">Grid[V4][X3]</span>, and read its bucket.'],
  ['Range query', 'The block of cells that overlaps the range (slide 31 left: a value-range grid).'],
  ['Partial match, e.g. V &lt; 100 (slide 32)', 'The whole rows or columns the known attribute selects: <span class="num">Grid[V1], Grid[V2], Grid[V3]</span>.'],
  ['Nearest neighbour, e.g. NN for V = 120 and X ≥ 3 (slide 32)', 'The home cell <b>and its neighbours</b>: <span class="num">Grid[V3][X2], Grid[V3][X3], Grid[V4][X2]</span>. The closest point may sit just across a grid line.'],
])}
<h3>Too good to be true: dependence on the distribution</h3>
<p>The grid only works well if the points are spread out. With a <b>good distribution</b> each cell has a bucket of its own. With a <b>bad distribution</b> most points fall into the same cell and the lecture shows a long chain of overflow buckets: lookups degrade towards a linear scan of the chain.</p>
<h3>Pros and cons</h3>
${compare(['thumbs-up', 'Pros', ['<b>O(log m) + K</b> access time (our reading: locate the stripe on each axis by binary search over the m grid lines, then read the K records of the bucket)', 'Answers <b>partial-match, range, nearest-neighbour and exact-match</b> queries']], ['thumbs-down', 'Cons', ['<b>Space management overhead</b>: a new line adds a whole row or column, many cells are empty, buckets must be allocated and overflow chains kept', '<b>Choosing good ranges</b> is a hard problem and depends on the data distribution']])}
<p>Takeaway: because creating and updating the ranges is inefficient, the grid index is most useful when <b>most of the data is inserted first, then the index is created and queried</b>.</p>
</div>
${W('u4Grid')}` },

    // ------------------------------------------------------------------ 5
    { id: 'kd-tree', title: 'KD-trees', body: `<div class="prose">
<h3>Definition</h3>
<p>A <b>kd-tree</b> is a <b>binary tree</b>. Each interior node has an <b>attribute a</b> and a <b>value V</b>. The node splits the data points into two parts: those with a value <b>less than V</b> (left) and those with a value <b>equal to or greater than V</b> (right). The attribute is <b>different at different levels</b>: the levels <b>rotate</b> among the indexed attributes. The leaves are blocks (buckets) holding the data points.</p>
<h3>The lecture tree</h3>
<p>12 points <span class="num">(Age, Salary)</span>; leaves hold up to 2 points. The root splits on <b>Salary 150</b>, level 2 on <b>Age</b>, level 3 on <b>Salary</b>, level 4 on <b>Age</b>.</p>
${fig(D.kdSVG(kdLec), 'Lecture KD-tree. Leaves are written (age, salary). Left edge: value &lt; V. Right edge: value ≥ V.')}
<h3>Lookup: search for (50, 100)</h3>
${steps([
  ['Salary 150', 'The salary is 100, and 100 &lt; 150: go <b>left</b>.'],
  ['Age 60', 'The age is 50, and 50 &lt; 60: go <b>left</b>.'],
  ['Salary 80', 'The salary is 100, and 100 ≥ 80: go <b>right</b>.'],
  ['Leaf', 'The leaf holds (50,100) and (50,120). (50,100) is there: <b>found</b>.'],
])}
${fig(D.kdSVG(kdLec, { hl: ['0:150', '1:60', '0:80', '50,100', '50,120'] }), 'The search path for (50, 100) is highlighted.')}
<h3>Insertion, simple case: (35, 280)</h3>
<p>Salary 150: 280 ≥ 150, right. Age 47: 35 &lt; 47, left. Salary 300: 280 &lt; 300, left. The leaf holds only (30,260), so it has room: it now holds (30,260) and (35,280). Nothing else changes.</p>
${fig(D.kdSVG(kdA.tree, { hl: ['35,280'] }), 'After inserting (35, 280).')}
<h3>Insertion, overflow case: (35, 500)</h3>
<p>Salary 150: 500 ≥ 150, right. Age 47: 35 &lt; 47, left. Salary 300: 500 ≥ 300, right. The leaf already holds (25,400) and (45,350): it is <b>full</b>. Split it into a new interior node. The levels rotate, and this leaf is at level 4, so the new node splits on <b>Age</b>. The new value is the <b>mean</b> of the three ages: (25 + 45 + 35) / 3 = <b>35</b>, which is the value in the lecture figure. Ages below 35 go left, ages 35 and above go right.</p>
${fig(D.kdSVG(kdB.tree, { hl: ['35,500', '1:35'] }), 'After inserting (35, 500): the full leaf became the node Age 35 with two leaves.')}
${T('A new interior node always uses the <b>next attribute in the rotation</b>, not the attribute that looks most useful. In PA4-5 and the midterm the split value is the <b>mean of the records in hand</b> (the full leaf plus the new record). Left means &lt; V, right means ≥ V: a record whose value equals V goes right.')}
<h3>Pros and cons</h3>
${compare(['thumbs-up', 'Pros', ['<b>O(log n)</b> access time (one comparison per level)', '<b>Small memory footprint</b>: the tree stores only the split values and the buckets', 'Efficient for <b>exact-value</b> queries']], ['thumbs-down', 'Cons (per the slides)', ['<b>Partial-match</b> queries are not possible', '<b>Nearest-neighbour</b> queries are not possible', 'Takeaways II: inefficient for <b>range</b> queries too']])}
<p><b>Why are partial match and nearest neighbour poor?</b> A search is a single path: at each node you compare the one attribute of that level. If the query does not give that attribute, there is no way to choose a side, so <b>both</b> children must be explored, and this happens at every level that splits on a missing attribute. The cost climbs towards reading most of the leaves. Try "Age = 50" in the simulator below: 3 of the 7 leaves must be visited, against 1 for the exact search. For nearest neighbour, the closest point can be on the other side of a split value, so a descent to one leaf cannot prove that you have found it.</p>
${T('The lecture is not consistent about range queries on KD-trees: Takeaways II says a KD-tree is inefficient for range queries, while the quote on the same slide says both trees are "highly efficient in range searches". The pros and cons slide (slide 40) lists only partial match and nearest neighbour as the cons. If an exam asks, state which slide you follow.')}
</div>
${W('u4KD')}` },

    // ------------------------------------------------------------------ 6
    { id: 'quad-tree', title: 'Quad trees', body: `<div class="prose">
<h3>Definition</h3>
<p>In a <b>quad tree</b> each interior node corresponds to a <b>square region</b> in two dimensions (a k-dimensional cube in k dimensions). If the number of points in a square fits in a block, the square is a <b>leaf</b>, represented by the block that holds its points. If there are too many points, the square becomes an <b>interior node</b> whose four children are its <b>quadrants</b>: NW, NE, SW and SE. The split is at the <b>centre</b> of the square.</p>
<h3>The lecture tree</h3>
<p>The same 12 points, blocks of <b>2</b> points, in the square age 0–100, salary 0–400. The root centre is (50, 200). Two quadrants (SE and NW) held too many points, so they were split again: SE at centre (75, 100) and NW at centre (25, 300).</p>
${fig(qFig(quadLec), 'Lecture quad tree. Internal nodes show their centre. Dotted lines in the plane are the sub-squares.')}
${T('The lecture figure keeps (50, 100) in the <b>south</b> half of the square centred at (75, 100), although y = 100 is exactly the centre line. The course never states a rule for points on a centre line. The simulator uses "on the line goes North or East" for new points, which would send (50, 100) to the north half and split that square once more (shown in the PA4-3 section). In an exam answer <b>state your convention</b> and apply it consistently.')}
<h3>Insertion I: (90, 150)</h3>
<p>Root centre (50, 200): 90 ≥ 50 and 150 &lt; 200, so <b>SE</b>. Centre (75, 100): 90 ≥ 75 and 150 ≥ 100, so <b>NE</b>. That leaf holds only (85,140), so it has room. No split.</p>
${fig(qFig(quadQ1), 'After inserting (90, 150).')}
<h3>Insertion II: (100, 110)</h3>
<p>Same route: SE, then NE of (75, 100). That leaf already holds (85,140) and (90,150), so with (100,110) it would hold 3 points and must split at its own centre <b>(87.5, 150)</b>: (85,140) goes SW, (90,150) goes NE, (100,110) goes SE.</p>
${fig(qFig(quadQ2), 'After inserting (100, 110): the square NE of (75, 100) became an interior node with centre (87.5, 150).')}
<h3>Pros and cons</h3>
${compare(['thumbs-up', 'Pros', ['Good with <b>range</b> queries: squares that do not overlap the range are skipped', 'Simple geometry: every split is at a centre, so regions are easy to compute']], ['thumbs-down', 'Cons', ['<b>Very sensitive to changes</b> made to the data points', 'Can grow <b>very deep</b> for data that is not uniformly distributed (a crowded corner keeps splitting)']])}
<p>Why deep? The splits ignore the data: a square is always cut at its centre. If many points sit close together, the squares containing them keep splitting until the points are separated, and all the other squares stay empty. Empty quadrants still cost I/O when a range query touches them.</p>
<h3>KD-tree versus quad tree</h3>
<p>The lecture quotes a paper: "QuadTree and kD Tree are quite comparable. Some contend that kD Tree is a k-dimensional extension of QuadTree. Both trees are highly efficient in range searches, with the kD Tree edging out the QuadTree owing to its <b>superior fit to the data</b> and its <b>insignificant production of empty quadrants</b> if the data is not evenly distributed. Accessing empty quadrants increases the cost of the range search, giving kD Trees an advantage over non-uniform data." (Samoladas et al., 2023.)</p>
${K('KD-tree splits at a <b>data value</b> and fits the data. A quad tree splits at the <b>centre of a square</b> and produces empty quadrants on skewed data. Both have one pointer path per search.')}
</div>
${W('u4Quad')}` },

    // ------------------------------------------------------------------ 7
    { id: 'bitmap', title: 'Bitmap index', body: `<div class="prose">
<h3>Definition</h3>
<p>A <b>bitmap index</b> is a collection of <b>bit vectors of length n</b> (n = number of rows), one vector for <b>each value</b> that appears in the indexed column. The vector for value v has a <b>1 in position i</b> if the i-th record has v in field F, and a <b>0</b> if not.</p>
<h3>The lecture example</h3>
<p>A table with two columns, F and G, and six rows:</p>
${table(['Row', 'F', 'G'], FCOL.map((f, i) => [i + 1, f, GCOL[i]]))}
${side(`<div class="small muted" style="margin-bottom:4px">F bitmap index</div>${bmTable('F', FCOL)}`, `<div class="small muted" style="margin-bottom:4px">G bitmap index</div>${bmTable('G', GCOL)}`)}
<p>Why is 30 equal to <span class="num">110001</span>? Because 30 appears in <b>row 1, row 2 and row 6</b>. Every row has exactly one 1 across the vectors of a column, so the vectors of one column always add up to a column of ones.</p>
<h3>Answering queries</h3>
<p>The magic is that all work becomes <b>bitwise operations</b> on the vectors:</p>
${table(['Query', 'Operation', 'Example (F, G)'], [
  ['One value', 'read one vector', `F = 30: ${bits('110001')}`],
  ['A AND B (different columns)', 'bitwise AND', `F = 30 AND G = foo: ${bits(M.bitAnd('110001', '100100'))}  (row 1)`],
  ['A OR B', 'bitwise OR', `F = 30 OR G = baz: ${bits(M.bitOr('110001', '001001'))}  (rows 1, 2, 3, 6)`],
  ['A XOR B', 'bitwise XOR', `F = 30 XOR G = baz: ${bits('111000')}  (rows 1, 2, 3)`],
  ['A range on one column', 'OR the vectors of all values in the range', 'F between 30 and 40: OR the vectors of 30 and 40'],
])}
<h3>Pros and cons</h3>
${compare(['thumbs-up', 'Pros', ['Answers many query types: <b>specific value, AND, OR, XOR and range</b>', 'Bitwise operations are <b>super fast</b> (a CPU ANDs 64 bits at a time)', 'Works for single and multidimensional data: one vector per value, any number of columns']], ['thumbs-down', 'Cons', ['<b>Long bit sequences</b>: a vector has as many bits as the table has rows, <b>O(n) space</b> per value', 'Costly when a column has many distinct values (one vector per value)']])}
${T('A bitmap index holds n bits per <b>distinct value</b>, so its size is n × (number of distinct values) bits. It is ideal for few distinct values (gender, department) and poor for nearly unique columns such as an ID. The 2025 midterm used a bitmap on age (Exercise 2): the bit vector of 18 had a 1 in every row where age = 18.')}
</div>
${W('u4Bitmap')}` },

    // ------------------------------------------------------------------ 8
    { id: 'partial-expression', title: 'Partial and expression indexes', body: `<div class="prose">
<p>Slide 51 closes the list of index types in an RDBMS with two variations. They are not new data structures. They change <b>what</b> is indexed.</p>
<h3>Partial index</h3>
<p>Only the rows that satisfy a <span class="num">WHERE</span> clause are put in the index.</p>
${code(`CREATE INDEX index_name
ON table_name (column1, column2, ...)
USING data_structure
WHERE <where-clause>;`, 'lecture syntax')}
<p>Example: queries mostly ask about Toy employees, so index only those:</p>
${code(`CREATE INDEX toy_salary_idx
ON store (salary)
WHERE dept = 'Toy';`, 'example')}
<p>The index is <b>smaller</b> (fewer entries, fewer levels, cheaper to maintain) and it can only be used by queries whose condition implies the index condition, such as <span class="num">dept = 'Toy' AND salary &gt; 50000</span>.</p>
<h3>Expression index</h3>
<p>The key is an <b>expression over a column</b>, not the raw column. The lecture mentions lower-casing as an example.</p>
${code(`CREATE INDEX index_name
ON table_name (expression<column>);

-- example
CREATE INDEX name_lower_idx
ON employee (lower(name));`, 'lecture syntax and example')}
<p>This index helps <span class="num">WHERE lower(name) = 'mohamed'</span>. A plain index on <span class="num">name</span> cannot be used for that condition, because the stored keys are not lower-cased.</p>
${K('Partial index: <b>fewer rows</b> in the index. Expression index: <b>computed keys</b> in the index. The query must match the index definition to benefit from it.')}
</div>` },

    // ------------------------------------------------------------------ 9
    { id: 'takeaways', title: 'Takeaways and which index to choose', body: `<div class="prose">
<h3>Takeaways I: hash-structured indexes</h3>
<ul>
<li>A <b>partitioned hash</b> mechanism represents several columns in the same hash table.</li>
<li>A <b>grid index</b> efficiently supports exact value, partial, range and nearest-neighbour queries. But creating and updating the ranges is inefficient. It is most useful when most of the data is inserted first, and the index is created and queried afterwards.</li>
</ul>
<h3>Takeaways II: tree-structured indexes</h3>
<ul>
<li>A <b>KD-tree</b> efficiently supports exact-value queries. It is inefficient for range and partial queries. Its greatest advantage is the <b>small memory footprint</b> compared with other multidimensional indexes.</li>
<li>The quote on KD-tree versus quad tree (see the quad-tree section): the KD-tree edges out the quad tree because it fits the data and makes few empty quadrants.</li>
</ul>
<h3>Takeaways III: bitmap</h3>
<ul>
<li>A <b>bitmap index</b> supports both single and multidimensional data. Its greatest advantage is the use of <b>bitwise operations</b>. The disadvantage is the <b>long sequence of bits</b>.</li>
</ul>
${table(['If the workload needs...', 'Choose', 'Because'], [
  ['Exact and partial match, constant time, no ranges', 'Partitioned hash', 'O(1) + K; partial match by leaving bits free'],
  ['All four query types; data loaded first, then queried', 'Grid index', 'O(log m) + K; ranges are costly to change later'],
  ['Exact lookups with a small memory footprint', 'KD-tree', 'O(log n); only split values and buckets'],
  ['Range queries on roughly uniform 2-D data', 'Quad tree', 'Good with range queries; deep on skewed data'],
  ['Combining many conditions on few distinct values', 'Bitmap', 'AND, OR, XOR as bitwise operations; O(n) bits per value'],
])}
${T('"Which index supports partial match?" is not answered by "hash" alone. Partitioned hash: yes. Grid: yes. KD-tree: no (per the slides). Always name the structure, not the family.')}
<p>Next lecture: logical planning (query optimization), the final topic of the midterm.</p>
</div>
${W('u4Which')}
${W('u4Support')}` },
  ],
};

// ============================================================ PRACTICE ASSIGNMENT 4
const pcGrid = (hiRam, hiHd) => {
  const rams = [512, 1024, 2048], hds = [160, 200, 250, 300];
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ram \\ HD</th>${hds.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rams.map(r => `<tr><td class="num"><b>${r}</b></td>${hds.map(h => { const m = PC.filter(x => x[2] === r && x[3] === h).map(x => x[0]), on = hiRam(r) && hiHd(h); return `<td class="num" style="${on ? 'background:var(--accent-soft);font-weight:700;box-shadow:inset 0 0 0 2px var(--accent-viz)' : ''}">{${m.join(', ')}}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
};
const bmDump = (name, maps, f = v => v) => `<div style="flex:1 1 180px;min-width:0"><div class="small muted" style="margin-bottom:4px">${name}</div>${table(['Value', 'Bit vector'], maps.map(m => [f(m.value), bits(m.bits)]))}</div>`;
const exec = (rows) => `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Step</th><th>Bits (12 rows)</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;

export const lab = {
  id: 'pa4', kind: 'lab', num: 'PA4', icon: 'clipboard-text',
  title: 'Practice Assignment 4: Multidimensional indices', navTitle: 'PA4: multidim. indices', mapLabel: 'PA 4',
  short: 'A grid index, bitmaps and their bitwise query plans, two quad-tree exercises, a KD-tree on three columns and a partitioned hash table, plus the 2025 midterm Exercise 5.',
  goals: [
    'Build a grid index on the PC table and shade the cells a query must read.',
    'Construct bitmap indexes and write the AND/OR plan for four queries, including the precedence of AND over OR.',
    'Build and edit quad trees (insert, delete, collapse) and explain where the PA figures differ from the engine.',
    'Construct a three-attribute KD-tree with mean splits and read off the splitting attributes.',
    'Compute partitioned hash keys and the bucket of an exact query.',
    'Solve the 2025 midterm KD-tree and quad-tree questions in the exam format.',
  ],
  sections: [
    // ------------------------------------------------------------------ 4-1
    { id: 'pa-4-1', title: 'Exercise 4-1: Grid index', body: `<div class="prose">
<p>The PC table (reference to a record = the <b>Model</b> number):</p>
${pcTable}
<p>Build a grid index and mark the area that answers <span class="num">WHERE Ram &gt;= 1024 AND HD &lt;= 200</span>.</p>
${steps([
  ['Choose the axes', 'Ram has 3 distinct values (512, 1024, 2048) and HD has 4 (160, 200, 250, 300). With so few values the PA puts <b>one stripe per distinct value</b>: Ram on the rows, HD on the columns. That gives 3 × 4 = 12 cells.'],
  ['Fill every cell', 'Each row goes in the cell of its (Ram, HD) pair. Cells can hold several models, for example (1024, 250) holds 1001, 1004 and 1009.'],
  ['Mark the answer area', 'Ram ≥ 1024 selects the <b>rows</b> 1024 and 2048. HD ≤ 200 selects the <b>columns</b> 160 and 200. The query region is the 2 × 2 block where they cross.'],
])}
${fig(pcGrid(r => r >= 1024, h => h <= 200), 'The shaded block is the query area. The grid cells are exactly the PA solution table.')}
<p>The four cells read are {1012}, {1007}, {1011} and the empty cell (2048, 200). The <b>answer is 1007, 1011 and 1012</b>. Only 4 of the 12 cells are touched, and that is why a grid answers a two-sided range query without scanning the table.</p>
${T('Do not forget to <b>label the area</b> on the grid, the exercise asks for it. The empty cell is still part of the area. Also notice that the boundary is inclusive (≥ and ≤): a value exactly on 1024 or 200 is inside.')}
<p>Same cells, other queries: for the <b>partial</b> query HD = 250 you read the whole column 250, which holds {1002, 1005}, {1001, 1004, 1009} and {1008}: 3 non-empty cells.</p>
</div>` },

    // ------------------------------------------------------------------ 4-2
    { id: 'pa-4-2', title: 'Exercise 4-2: Bitmap indexes', body: `<div class="prose">
<p>Build bitmap indexes for <b>Speed, Ram, HD</b> over the 12 rows (bit i is the i-th row: 1001 is bit 1, 1012 is bit 12).</p>
<div style="display:flex;gap:14px;flex-wrap:wrap">${bmDump('Speed', speedBM, v => v.toFixed(2))}${bmDump('Ram', ramBM)}${bmDump('HD', hdBM)}</div>
${T('The PA solution prints the speed 1.86 as <b>"1.82"</b> (a typo). The vector <span class="num">000000000010</span> belongs to speed 1.86, model 1011. The official sheet differs here; the engine and this page show the correct value.')}
<p>For every query the physical planner reads the needed vectors and combines them with bitwise operations. A condition on a range of values becomes the <b>OR of the vectors of every value in the range</b>.</p>
<h3>Query 1: Speed = 2.20 AND HD = 250</h3>
${exec([bmStep('Speed 2.20', vec(speedBM, 2.2)), bmStep('HD 250', vec(hdBM, 250)), `<tr class="fixed"><td><b>AND</b></td><td>${bits(pcQ.q1)}</td></tr>`])}
<p>One 1 at position 8: <b>model ${rowsOf(pcQ.q1).join(', ')}</b>. Plan: bitwise AND of two vectors.</p>
<h3>Query 2: Ram &gt;= 1024 AND HD &lt;= 200</h3>
${exec([bmStep('Ram 1024 OR Ram 2048', pcQ.ramGE.bits), bmStep('HD 160 OR HD 200', pcQ.hdLE200.bits), `<tr class="fixed"><td><b>AND of the two results</b></td><td>${bits(pcQ.q2)}</td></tr>`])}
<p>Models <b>${ids(rowsOf(pcQ.q2))}</b>, the same answer as the grid in 4-1.</p>
<h3>Query 3: Speed &gt;= 2.10 AND Speed &lt; 2.50 AND Ram &gt;= 1024 AND HD &lt;= 250</h3>
${exec([bmStep('Speed 2.10 OR 2.20', pcQ.spR.bits), bmStep('Ram 1024 OR 2048', pcQ.ramGE.bits), bmStep('HD 160 OR 200 OR 250', pcQ.hdLE250.bits), `<tr class="fixed"><td><b>AND of the three results</b></td><td>${bits(pcQ.q3)}</td></tr>`])}
<p>Models <b>${ids(rowsOf(pcQ.q3))}</b>. The two Speed conditions are one range, so they become one OR.</p>
<h3>Query 4: Speed &lt;= 2.80 OR Ram &lt; 1024 AND HD &lt; 300</h3>
<p><b>AND binds tighter than OR</b>, so the query is <span class="num">Speed ≤ 2.80 OR (Ram &lt; 1024 AND HD &lt; 300)</span>.</p>
${exec([bmStep('Speed 1.42 ... 2.80 (OR of 7 vectors)', pcQ.spLE.bits), bmStep('HD 160 OR 200 OR 250 (HD &lt; 300)', pcQ.hdLT300.bits), bmStep('Ram 512', pcQ.ramLT.bits), bmStep('(HD &lt; 300) AND Ram 512', pcQ.right4), `<tr class="fixed"><td><b>(Speed &le; 2.80) OR the result above</b></td><td>${bits(pcQ.q4)}</td></tr>`])}
<p>Every row except 1006 (speed 3.20, Ram 1024, HD 300): models <b>${ids(rowsOf(pcQ.q4))}</b>.</p>
${T('Query 4 is the trap: if you OR first you get a different answer. Evaluate AND before OR, exactly as SQL does. The PA solution lists the same four steps: OR the speeds, OR the HDs, AND with Ram 512, OR the two results.')}
<p><b>Cost of the plan:</b> each vector has 12 bits (n = 12 rows). Query 1 reads 2 vectors; query 4 reads 7 + 3 + 1 = 11. After combining, only the rows whose result bit is 1 are fetched from the table.</p>
</div>
${WS('u4Bitmap', 'pc')}` },

    // ------------------------------------------------------------------ 4-3
    { id: 'pa-4-3', title: 'Exercise 4-3: Quad tree from 12 points', body: `<div class="prose">
<p>The 12 salary/age points are exactly the lecture's points, with <b>blocks of 2</b>. The PA solution figure (PA4-02) is the same tree as the lecture.</p>
${steps([
  ['The whole square', 'Age 0–100 and salary 0–400 (the PA plot is 0–100 by 0–400K). Centre (50, 200). Too many points for one block of 2, so split into four quadrants.'],
  ['Quadrants of the root', 'SW: (25,60) and (45,60), 2 points, a leaf. NE: (50,275) and (60,260), 2 points, a leaf. SE and NW hold too many points: they split again.'],
  ['SE, centre (75, 100)', 'Points (50,75), (50,100), (50,120), (70,110), (85,140): (50,75) and (50,100) stay in the south-west leaf, (50,120) and (70,110) go north-west, (85,140) goes north-east.'],
  ['NW, centre (25, 300)', 'Points (30,260), (25,400), (45,350): (30,260) is south-east, (25,400) and (45,350) are both north-east, which still fits a block of 2.'],
])}
${fig(qFig(quadLec), 'The solution tree (identical to the lecture figure).')}
<h3>The tie: where does (50, 100) go?</h3>
<p>(50, 100) sits exactly on the horizontal line y = 100 through the centre of the SE square. The figure puts it in the <b>south</b> half. The simulator's convention is that a point on a centre line goes <b>North/East</b>. Under that rule the north-west quadrant holds three points, (50,100), (50,120) and (70,110), so it splits once more at (62.5, 150):</p>
${fig(qFig(quadEng), 'Same 12 points, inserted in order, with "on the line goes North/East". The SE square has an extra level.')}
<p>Both are valid quad trees. The course never states a tie rule, so for an exam copy the lecture figure and, if the question allows, say which convention you used. Points on a vertical line (x = 50) go East in both figures.</p>
${T('A block holds 2 points here. A square is a leaf as long as it holds <b>at most</b> 2 points. Do not split a square that has exactly 2.')}
</div>
${WS('u4Quad', 'lec')}` },

    // ------------------------------------------------------------------ 4-4
    { id: 'pa-4-4', title: 'Exercise 4-4: Quad tree insertions and deletions', body: `<div class="prose">
<p>Square (−128, −128) to (128, 128), <b>one point per block</b>. Start tree: A (100, 125) in NE, B (25, −30) in SE, NW and SW empty.</p>
${q44fig(q44.start, 'Start: A in NE, B in SE.')}
<h3>a) Insert C (−55, 80) and D (125, −60)</h3>
<p>C: x &lt; 0 and y ≥ 0, so <b>NW</b>, an empty leaf: stored. D: x ≥ 0, y &lt; 0, so <b>SE</b>, which already holds B. Two points do not fit a block of 1: split the SE square (0,−128)–(128,0) at its centre <b>(64, −64)</b>. B (25,−30) is west and north of it: <b>NW</b>. D (125,−60) is east and north of it: <b>NE</b>.</p>
${q44fig(q44.cd, 'After inserting C and D.')}
<h3>b) Insert E (80, 80)</h3>
<p>E goes to <b>NE</b>, the square (0,0)–(128,128), which holds A. Split at <b>(64, 64)</b>: A (100,125) and E (80,80) are both ≥ 64 in x and y, so both go to NE again. Split that square (64,64)–(128,128) at <b>(96, 96)</b>: A is NE, E is SW. Two splits were needed.</p>
${q44fig(q44.e, 'After inserting E: two nested splits in NE.')}
<h3>c) Delete E</h3>
<p>Remove E. The square (64,64)–(128,128) now holds only A, which fits a block, so its four children are <b>merged back into one leaf</b>. The square (0,0)–(128,128) also holds only A, so it collapses too: NE is a single leaf with A again, as in the PA solution.</p>
${q44fig(q44.delE, 'After deleting E.')}
<h3>d) Delete A</h3>
<p>NE becomes an empty leaf. SE still holds two points (B and D), so it stays split.</p>
${q44fig(q44.delA, 'After deleting A.')}
<h3>e) Delete B</h3>
<p>The SE square now holds only D. <b>Two conventions</b> exist:</p>
<ul>
<li><b>Collapse</b> (the rule used for c and by the simulator): a square whose points fit in one block becomes a leaf. SE becomes a single leaf holding D.</li>
<li><b>No collapse</b> (what the PA solution figure shows): D stays in its small square (64,−64)–(128,0) and the other children stay empty.</li>
</ul>
${side(q44fig(q44.delB, 'e) with collapse: SE is one leaf holding D.'), q44fig(q44.delBpa, 'e) without collapse: D stays in its small square (the PA style).'))}
<p>Both trees answer queries correctly. The collapsed tree is smaller, which is the point of the lecture's definition: a square is a leaf when its points fit in a block. In the exam, <b>draw what the PA solution draws</b>, or the collapsed tree and write one sentence saying why.</p>
${T('Order matters in part b: you must split twice, because after the first split A and E land in the same quadrant again. A common mistake is to stop after one split.')}
</div>
${WS('u4Quad', 'pa44')}` },

    // ------------------------------------------------------------------ 4-5
    { id: 'pa-4-5', title: 'Exercise 4-5: KD-tree on Speed, Ram, HD', body: `<div class="prose">
<p>Build a KD-tree on <b>Speed, Ram, HD in this order</b>, <b>buckets of 2</b>. When a bucket is full, split it using the <b>mean of the three values in hand</b>, inserting the rows in table order (1001 to 1012). The levels rotate: Speed, Ram, HD, Speed, Ram, ...</p>
${pcTable}
<p>The tree after all 12 rows:</p>
${fig(D.kdSVG(kdPA), 'Engine result. Compare with PA4-04: S2.06, R1195, R853, H267, S2.55, R1024, H220.')}
<p>The PA figure rounds the split values (R1195, R853, H267) where the engine shows two decimals (1194.67, 853.33, 266.67). Same tree.</p>
<h3>What happens at each overflow</h3>
${table(['When', 'Split'], kdSplits)}
<p>The other rows (1001, 1002, 1005, 1008, 1009, 1010) just find room in a leaf.</p>
<h3>Reading the result</h3>
<ul>
<li>The root splits <b>Speed at 2.06</b>: 1003, 1009, 1011 are slower (left), the rest are at or above 2.06.</li>
<li>The node S2.55 is at level 4, so the rotation wraps back to <b>Speed</b>. R1024 is level 5 and H220 is level 6.</li>
<li>The split on Ram 1024 sends <b>nothing to the left</b>: the three records 1001, 1004, 1012 all have Ram = 1024 and 1024 ≥ 1024 goes right. The tree keeps an <b>empty leaf</b> and splits again one level down on HD (mean (250 + 250 + 160) / 3 = 220).</li>
</ul>
${T('In the mean, use the <b>three values of that level\'s attribute</b>, the two stored records plus the new one. A tie on the split attribute does not stop the split: equal values go right, so the next level does the separating.')}
</div>
${WS('u4KD', 'pa')}` },

    // ------------------------------------------------------------------ 4-6
    { id: 'pa-4-6', title: 'Exercise 4-6: Partitioned hash table', body: `<div class="prose">
<p>Hash value = <b>h(HD) followed by h(Speed)</b>. The reference stored in a bucket is the Model.</p>
<div style="display:flex;gap:14px;flex-wrap:wrap">${bmDump('h(HD): 2 bits', Object.entries(hHD).map(([value, b]) => ({ value, bits: b })))}${bmDump('h(Speed): 3 bits', Object.entries(hSp).map(([value, b]) => ({ value, bits: b })))}</div>
<p>2 + 3 = 5 bits, so <b>32 buckets</b>. Compute each key by concatenation, for example model 1007 (HD 200, Speed 2.20): 01 followed by 100 = <b>01100</b>.</p>
${table(['Model', 'HD', 'Speed', 'h(HD)', 'h(Speed)', 'Key'], keyed.map(r => [r.m, r.h, r.s.toFixed(2), bits(hHD[r.h]), bits(hSp[r.s.toFixed(2)]), `<b class="num">${r.k}</b>`]))}
<p>The table of all 32 buckets (the query bucket is shaded):</p>
${hashTable32}
<h3>The query: Speed = 2.20 AND HD = 250</h3>
<p>h(HD = 250) = 10, h(Speed = 2.20) = 100. The key is <b>10100</b>: one bucket, holding <b>model 1008</b>. An exact query reads exactly 1 bucket.</p>
<h3>Partial queries on the same table</h3>
${table(['Query', 'Pattern', 'Buckets read', 'Why'], [
  ['Speed = 2.20', '?? · 100', partOf(null, '2.20').join(', '), 'HD unknown: 2 free bits, 2<sup>2</sup> = 4 buckets'],
  ['HD = 250', '10 · ???', `${partOf('250', null).length} buckets: ${partOf('250', null)[0]} to ${partOf('250', null)[7]}`, 'Speed unknown: 3 free bits, 2<sup>3</sup> = 8 buckets'],
])}
${K('Giving the attribute with <b>more bits</b> shrinks the search more. Speed has 3 bits, so fixing it leaves 4 buckets. Fixing HD (2 bits) leaves 8. Range queries (Speed &gt;= 2.20) need all 32 buckets: hashing destroys the order.')}
</div>
${WS('u4Partitioned', 'pa')}` },

    // ------------------------------------------------------------------ Midterm
    { id: 'midterm-5', title: 'Midterm 2025, Exercise 5 (20 marks)', body: `<div class="prose">
<p>Exercise 5 of the November 2025 midterm covered a KD-tree and a quad tree. Treat it as the model for the exam format.</p>
<h3>5.1 KD-tree on AGE and GPA</h3>
<p>Given: the non-leaf value is the <b>average of the 3 records</b> a split is performed on, and a leaf holds at most 2 records. The two operations are independent. Records are written <span class="num">&lt;name, AGE, GPA&gt;</span>.</p>
${fig(D.kdSVG(mtKD), 'The given tree: GPA 2.56 at the root, AGE 17.3 below it on the right.')}
<h3>a) Insert &lt;Mohamed, 20, 1.6&gt;</h3>
${steps([
  ['Descend', 'GPA 2.56: 1.6 &lt; 2.56, go <b>left</b>. The left leaf holds Jamal (22, 1.2) and Fatima (21, 0.9): it is full.'],
  ['Split', 'The root used GPA, so the next level uses <b>AGE</b>. The three ages are 22, 21 and 20: mean = (22 + 21 + 20) / 3 = <b>21</b>.'],
  ['Distribute', 'AGE &lt; 21: Mohamed (20). AGE ≥ 21: Fatima (21) and Jamal (22).'],
])}
${fig(D.kdSVG(mtA.tree, { hl: ['Mohamed, 20, 1.6', '1:21'] }), 'Answer a. (The official answer lists Fatima before Jamal in the right leaf. The order inside a leaf does not matter.)')}
<h3>b) Insert &lt;Mohamed, 20, 2.6&gt;</h3>
<p>GPA 2.56: 2.6 ≥ 2.56, go <b>right</b>. AGE 17.3: 20 ≥ 17.3, go <b>right</b>. The leaf holds only Amina, so Mohamed is stored there. <b>No split.</b></p>
${fig(D.kdSVG(mtB.tree, { hl: ['Mohamed, 20, 2.6'] }), 'Answer b.')}
${T('Part a and part b are <b>independent</b>: part b starts from the original tree, not from the tree of part a. Using the tree of part a is a common mistake.')}
<h3>5.2 Quad tree, one point per block</h3>
<p>The square is 0–100 by 0–200, with A (60, 110) in NE and B (30, 30) in SW. The root centre is (50, 100).</p>
${mtQfig(mtQ)}
<h3>a) Where does C (30, 150) go?</h3>
<p>x = 30 &lt; 50 and y = 150 ≥ 100: the <b>NW</b> block, which is empty. C is stored there. No split.</p>
${mtQfig(mtC.tree)}
<h3>b) Insert D (40, 40)</h3>
${steps([
  ['Descend', 'x = 40 &lt; 50, y = 40 &lt; 100: <b>SW</b>, the square (0,0)–(50,100), which holds B. Two points, one block: split at its centre <b>(25, 50)</b>.'],
  ['Same quadrant again', 'B (30,30) and D (40,40) are both east of 25 and south of 50, so both are in the <b>SE</b> square (25,0)–(50,50). Split again at its centre <b>(37.5, 25)</b>.'],
  ['Separate', 'B (30,30): x &lt; 37.5, y ≥ 25, so <b>NW</b>. D (40,40): x ≥ 37.5, y ≥ 25, so <b>NE</b>.'],
])}
${mtQfig(mtD.tree, 240)}
${T('The official model answer draws the last level with B labelled NE and D labelled NW. With centre (37.5, 25), B (30, 30) is in the north-<b>west</b> and D (40, 40) is in the north-<b>east</b>. The region centres written on the official figure, (31.25, 37.5) and (43.7, 37.5), confirm this. The official sheet differs here, so trust the geometry.')}
</div>
${WS('u4KD', 'mid')}
${WS('u4Quad', 'mid')}` },

    // ------------------------------------------------------------------ exam tips
    { id: 'exam-tips', title: 'What the exam asks', body: `<div class="prose">
<p>The midterm covers lectures 1 to 5 and PA1 to PA5. For this unit expect any of these, in about this form:</p>
${table(['Question', 'How to answer'], [
  ['Build or update a KD-tree', 'State the attribute rotation, the leaf size, the split rule (mean of the records in hand). Write the descent path in one line. Draw left = &lt;, right = ≥.'],
  ['Build or update a quad tree', 'Give the centre of every square you split. State the rule for points on a line. Show a leaf only when the square holds at most the block size.'],
  ['Bitmap vectors and a query', 'Write each vector with row 1 at the left. For a range, OR the value vectors. AND before OR. Name the rows whose result bit is 1.'],
  ['Grid index', 'Mark the cells the query region overlaps (including empty ones). State overflow bucket versus a new grid line.'],
  ['Partitioned hash', 'Concatenate h1 and h2 in the stated order. Partial match: list 2<sup>free bits</sup> buckets.'],
  ['"Which index would you choose?"', 'Name the structure, the query types it supports per the slides, and one con that matters for the scenario (deep trees, space overhead, long bit vectors, no range support).'],
  ['True/false with correction', 'Typical false statements: "a KD-tree supports partial match", "partitioned hashing supports range queries", "a grid index never needs extra space", "mechanism I handles partial match".'],
])}
${K('The 2025 midterm weighted Exercise 5 at 20 marks: two KD-tree operations and two quad-tree operations. Practise them until you can write the split value and the descent path without hesitation.')}
<p>Related pages: the <a href="#/formula">formula sheet</a> (provided in the exam) does not contain multidimensional-index material, so everything on this page must come from your head.</p>
</div>` },
  ],
};

// ============================================================ QUESTIONS
const Q = (id, m, q, o, why) => ({ id, m, q, o, why });
export const questions = [
  // ---------------- lecture
  Q('l4-1', 'l4', 'Strategy 1 uses a B+ tree on dept only (100,000 rows, 10 rows per page, 100 pointers per node, 1,000 employees per dept). The best case costs 111 I/Os. What is 111 made of?',
    ['1 non-leaf node + 10 leaf nodes + 100 table pages', '1 root + 10 leaf nodes + 1,000 table pages', '10 leaf nodes + 100 table pages', '1,000 leaf nodes + 100 table pages'],
    '1,000 Toy pointers / 100 per leaf = 10 leaves, which share 1 non-leaf node (the root is in memory): 11 index I/Os. If the table is sorted by dept the 1,000 rows fill 1,000 / 10 = 100 pages: 11 + 100 = 111. The worst case replaces 100 by 1,000 pages: 1,011.'),
  Q('l4-2', 'l4', 'Strategy 2 also uses a B+ tree on salary. 50% of the 100,000 rows have salary &gt; 50,000. The lecture says that index costs 5,505 I/Os at best. Which breakdown gives 5,505?',
    ['500 leaf nodes + 5 non-leaf nodes + 5,000 table pages', '500 leaf nodes + 5 non-leaf nodes + 50,000 table pages', '5 leaf nodes + 500 non-leaf nodes + 5,000 table pages', '50,000 leaf nodes + 5,000 table pages'],
    '50,000 pointers / 100 = 500 leaves, parented by 500 / 100 = 5 non-leaf nodes: 505 index I/Os. Sorted by salary, 50,000 rows / 10 per page = 5,000 pages: 505 + 5,000 = 5,505. Unsorted, one page per pointer gives 505 + 50,000 = 50,505.'),
  Q('l4-4', 'l4', 'What does the multidimensional index entry <span class="num">&lt;(Mohamed, 22), 4&gt;</span> mean?',
    ['It points to all rows whose first name is Mohamed AND whose age is 22', 'It points to all rows whose first name is Mohamed OR whose age is 22', 'It is two separate entries, one on name and one on age', 'It points to the 4 rows whose age is between 22 and 26'],
    'A multidimensional index is made of keylist-pointer pairs. The keylist holds several column values together, and the pointer leads to the rows that match all of them.'),
  Q('l4-5', 'l4', 'A partitioned hash index uses mechanism I: one hash function h(a1, a2, a3) of all three attributes. Which query can it NOT answer?',
    ['a1 = x AND a2 = y, with a3 not given', 'a1 = x AND a2 = y AND a3 = z', 'An exact lookup of one full keylist', 'Inserting a new keylist'],
    'h needs the values of all n attributes. If a3 is missing the hash value cannot be computed, so partial match is impossible. Mechanism II (one hash per attribute, concatenated) fixes this.'),
  Q('l4-6', 'l4', 'h1(dept): toy = 0, sales = 1, art = 1. h2(salary): 10k = 01, 20k = 11, 30k = 01, 40k = 00. The bucket number is h1 followed by h2. Which bucket holds &lt;Joe, sales, 10k&gt;?',
    ['101', '011', '110', '001'],
    'Concatenate: h1(sales) = 1, then h2(10k) = 01 gives 1 01 = 101. (Fred, toy, 10k) gives 0 01 = 001.'),
  Q('l4-7', 'l4', 'Same hash functions. Which buckets must be read for the query Dept = Sales (salary not given)?',
    ['100, 101, 110, 111', '100 only', '000, 001, 010, 011', 'All 8 buckets'],
    'Dept = Sales fixes the first bit to 1. The two salary bits are free: 100, 101, 110 and 111. That is 2² = 4 buckets.'),
  Q('l4-8', 'l4', 'Same hash functions. Which buckets must be read for the query Salary = 30k (dept not given)?',
    ['001 and 101', '001 only', '100 and 110', '010 and 011'],
    'h2(30k) = 01 fixes the last two bits. The dept bit is free: 0 01 = 001 and 1 01 = 101.'),
  Q('l4-9', 'l4', 'Why can a partitioned hash table NOT answer range queries?',
    ['Hash functions scatter neighbouring values into unrelated buckets, so no group of buckets holds the range', 'A hash needs the values of all attributes', 'Buckets are stored on disk, which is too slow for ranges', 'Hash tables cannot store numbers'],
    'In the lecture example 10k, 20k and 30k hash to 01, 11 and 01. The order of the values is destroyed, and unseen values in between can hash anywhere. The only safe plan is to read every bucket. Nearest-neighbour fails for the same reason.'),
  Q('l4-11', 'l4', 'Lecture grid: age lines at 40 and 55, salary lines at 90K and 225K. Points on a line belong to the stripe for which the line is the lower boundary. Which cell holds the point (55, 90)?',
    ['Age 55 and above, salary 90K to 225K', 'Age 40 to 55, salary 90K to 225K', 'Age 55 and above, salary 0 to 90K', 'Age 40 to 55, salary 0 to 90K'],
    'The line 55 starts the stripe "55 and above", and the line 90 starts the stripe "90 to 225". So both coordinates go up, into the cell (55+, 90–225).'),
  Q('l4-12', 'l4', 'In the "bigger picture" of the grid index, where do the grid and the buckets live?',
    ['The grid (pointers to buckets) is in memory; the buckets are pages on disk', 'The grid is on disk; the buckets are in memory', 'Both are in memory', 'Both are on disk, next to the table'],
    'Slide 25: "Grid only contains pointers to buckets", "grid (in memory)", buckets as pages on disk, pointing to the table pages. So a lookup costs the bucket I/O, not the grid.'),
  Q('l4-13', 'l4', 'Insert (52, 200) into the lecture grid (buckets of 2) using approach 1. What happens?',
    ['The cell age 40–55, salary 90–225K is full, so an overflow bucket is chained to it and the grid lines stay the same', 'A new salary line at 130K is added', 'The point goes to the cell above salary 225K', 'The oldest point of the cell is deleted'],
    '(52, 200) falls in the cell holding (50,100) and (50,120). Approach 1 adds an overflow bucket and does not change the grid. Approach 2 would instead add a grid line (130K in the lecture).'),
  Q('l4-14', 'l4', 'Insert (52, 200) with approach 2 (new salary line at 130K). Which statement is correct?',
    ['The grid grows from 9 to 12 cells, because the line runs across the whole space and some of the new cells are empty', 'Only the full cell is split into two, the other cells are unchanged', 'The grid still has 9 cells but one bucket is larger', 'The grid shrinks because two lines merge'],
    'A grid line cuts the entire space. The 3 × 3 grid becomes 3 × 4. This is the space management overhead: new rows of cells, many of them empty, even though only one bucket overflowed.'),
  Q('l4-15', 'l4', 'Which are the cons of the grid index according to the lecture?',
    ['Space management overhead, and choosing good ranges is hard', 'It cannot answer range queries, and it cannot answer nearest-neighbour queries', 'O(n) access time and no partial match', 'It needs all attribute values for every query'],
    'Slide 34. Its pros are O(log m) + K and support for partial-match, range, nearest-neighbour and exact-match queries. Its cons are the space overhead and the difficult choice of ranges (and a strong dependence on the data distribution).'),
  Q('l4-17', 'l4', 'In the lecture KD-tree (root Salary 150), what happens when (35, 280) is inserted? Records are written (age, salary).',
    ['It goes to the leaf holding (30,260) and fits there; no node is added', 'The leaf holding (30,260) splits on Age', 'It goes to the left subtree of the root', 'The root value changes to 280'],
    'Salary 150: 280 ≥ 150, right. Age 47: 35 &lt; 47, left. Salary 300: 280 &lt; 300, left. The leaf has only 1 record and a leaf holds 2, so (35, 280) is simply added.'),
  Q('l4-18', 'l4', 'Insert (35, 500) into the lecture KD-tree. It reaches the full leaf (25,400), (45,350). The leaf is split. What is the new interior node?',
    ['Age 35: the mean of the three ages 25, 45 and 35 (the levels rotate, and this is an Age level)', 'Salary 450: the mean of the two stored salaries', 'Age 45: the largest age', 'Salary 500: the new salary'],
    'The root is Salary, the next level Age, then Salary, so this leaf is at an Age level (level 4). The mean of the three ages is (25 + 45 + 35) / 3 = 35. Ages &lt; 35 go left, ages ≥ 35 go right. This reproduces the lecture figure.'),
  Q('l4-20', 'l4', 'An index is a KD-tree on (Salary, Age). A query gives only Age = 50. Why is this a weakness of the KD-tree?',
    ['Nodes that split on Salary give no direction, so both children must be explored at those levels', 'The tree can only be searched from the leaves upward', 'Age is not stored in the tree', 'The tree has to be rebuilt first'],
    'A search follows one path by comparing the attribute of each level. A missing attribute makes the comparison impossible, so the search branches both ways at every such level. In the lecture tree Age = 50 visits 3 of 7 leaves. Slide 40 therefore lists partial match as a con.'),
  Q('l4-21', 'l4', 'The lecture quotes a paper saying the KD-tree edges out the quad tree for range searches. What reason is given?',
    ['It fits the data better and produces few empty quadrants when data is not evenly distributed', 'It is shallower on every data set', 'It does not need any memory', 'It splits at the centre of each square'],
    'A quad tree always splits at the centre of a square, so on skewed data it creates many empty quadrants and deep paths. Visiting empty quadrants raises the cost of a range search. A KD-tree splits at data values.'),
  Q('l4-22', 'l4', 'Insert (90, 150) into the lecture quad tree (blocks of 2). The route is SE of the root (50, 200), then NE of the square centred (75, 100). What happens?',
    ['The leaf already holds (85,140) only, so (90,150) is added with no split', 'The leaf splits at (87.5, 150)', 'A new root is created', 'The point is stored in the NW leaf of the root'],
    'The leaf holds one point, and a block holds 2, so there is room. The next insertion, (100, 110), makes the same leaf hold 3 points and forces the split.'),
  Q('l4-23', 'l4', 'After (90, 150), insert (100, 110) in the lecture quad tree. The leaf (85,140), (90,150) would hold 3 points. At which point is its square split?',
    ['(87.5, 150), the centre of the square NE of (75, 100)', '(75, 100)', '(100, 110)', '(62.5, 150)'],
    'The square NE of (75,100) spans x 75–100 and y 100–200, so its centre is (87.5, 150). (85,140) goes SW, (90,150) goes NE (on the line, North/East) and (100,110) goes SE.'),
  Q('l4-24', 'l4', 'Which are the cons of quad trees according to the lecture?',
    ['They are very sensitive to changes in the data points and can grow very deep for non-uniform data', 'They cannot answer range queries', 'They need one bit vector per value', 'They need all attribute values for every query'],
    'Slide 47. The only listed pro is that they are good with range queries.'),
  Q('l4-25', 'l4', 'Lecture bitmap example: column F holds 30, 30, 40, 50, 40, 30 (rows 1 to 6). What is the bit vector of the value 40?',
    ['001010', '110001', '000100', '010010'],
    '40 appears in rows 3 and 5, so bits 3 and 5 are 1: 001010. (30 is 110001, 50 is 000100.) The three vectors always add up to 111111: every row has exactly one value.'),
  Q('l4-26', 'l4', 'A table has 1,000,000 rows. A column has 4 distinct values. How much space does its bitmap index need?',
    ['4 vectors of 1,000,000 bits, that is 4,000,000 bits', '1,000,000 bits in total', 'about 20 bits (log2 of the number of rows)', '4 bits, one per distinct value'],
    'One vector per distinct value, each as long as the table has rows (n bits): O(n) per value. With few distinct values this is small; with many distinct values the long bit sequences are the con.'),
  Q('l4-28', 'l4', 'What is stored in a partial index?',
    ['Only the rows that satisfy the WHERE clause of the CREATE INDEX statement', 'Only the first column of each row', 'Every row, but sorted by the WHERE clause', 'The result of an expression over every row'],
    'Partial index: "only those entries matching the where-clause will be included in the index". The last option describes an expression index.'),
  Q('l4-29', 'l4', 'An expression index is created with <span class="num">CREATE INDEX i ON employee (lower(name))</span>. Which query can use it?',
    ['WHERE lower(name) = \'mohamed\'', 'WHERE name = \'Mohamed\'', 'WHERE upper(name) = \'MOHAMED\'', 'WHERE age = 22'],
    'The index stores lower(name) as its key, so only a condition on that same expression can use it. A plain condition on name does not match the stored keys.'),

  // ---------------- PA4 and midterm
  Q('pa4-1', 'pa4', 'PA4-1: PC grid with Ram on the rows (512, 1024, 2048) and HD on the columns (160, 200, 250, 300). Which models answer Ram &gt;= 1024 AND HD &lt;= 200?',
    ['1007, 1011, 1012', '1007, 1012', '1001, 1004, 1007, 1009, 1012', '1003, 1007, 1011, 1012'],
    'Rows 1024 and 2048 × columns 160 and 200: cell (1024,160) = {1012}, (1024,200) = {1007}, (2048,160) = {1011}, (2048,200) is empty. 1003 has Ram 512, so it is out.'),
  Q('pa4-2', 'pa4', 'PA4-2 query 1: Speed = 2.20 AND HD = 250. How does the planner answer it with bitmaps?',
    ['AND the vector of Speed 2.20 with the vector of HD 250; the single 1 is at position 8 (model 1008)', 'OR the two vectors; the 1s give models 1007 and 1008 and others', 'Scan the table and compare each row', 'AND all vectors of Speed with all vectors of HD'],
    'Speed 2.20 = 000000110000 and HD 250 = 110110011000. Their bitwise AND is 000000010000: only row 8, model 1008.'),
  Q('pa4-3', 'pa4', 'PA4-2 query 2: Ram &gt;= 1024 AND HD &lt;= 200. Which plan is right?',
    ['OR the vectors of Ram 1024 and 2048, OR the vectors of HD 160 and 200, then AND the two results', 'AND Ram 1024 with Ram 2048, then OR with HD 200', 'OR everything', 'AND the vectors of Ram 1024 and HD 160 only'],
    'A range on one column is the OR of the vectors of the values in the range. Different columns are combined with AND. Result 000000100011: models 1007, 1011, 1012.'),
  Q('pa4-4', 'pa4', 'PA4-2 query 4: Speed &lt;= 2.80 OR Ram &lt; 1024 AND HD &lt; 300. What is evaluated first?',
    ['Ram &lt; 1024 AND HD &lt; 300, and then the result is ORed with Speed &lt;= 2.80', 'Speed &lt;= 2.80 OR Ram &lt; 1024, then AND with HD &lt; 300', 'The conditions are evaluated left to right with no precedence', 'Only HD &lt; 300'],
    'AND binds tighter than OR in SQL, so the query is Speed ≤ 2.80 OR (Ram &lt; 1024 AND HD &lt; 300). The result is every row except 1006.'),
  Q('pa4-5', 'pa4', 'In the PA4-2 solution a vector <span class="num">000000000010</span> is labelled Speed "1.82". Which speed does it really belong to?',
    ['1.86 (model 1011), the label is a typo', '1.82 (model 1012)', '1.42 (model 1003)', '2.00 (model 1009)'],
    'The only speed value that appears in row 11 (model 1011) is 1.86. No row has speed 1.82, so the PA label is a typo.'),
  Q('pa4-6', 'pa4', 'PA4-4: a quad tree on (−128, −128) to (128, 128), one point per block, holds A (100,125) in NE. Insert E (80, 80). How many times is a square split?',
    ['Twice: NE at (64, 64), then its NE square at (96, 96)', 'Once: NE at (64, 64)', 'Three times', 'Never: E fits in the NE block'],
    'NE holds A, so it splits at (64,64). A and E are both ≥ 64 in x and y, so both fall into NE again. That square (64,64)–(128,128) splits at (96,96): A (100,125) is NE and E (80,80) is SW.'),
  Q('pa4-7', 'pa4', 'PA4-4: after inserting E, delete E. What happens to the NE part of the tree?',
    ['The squares merge back, and NE is again a single leaf holding A', 'E\'s square stays as an empty leaf and the two splits stay', 'A is also deleted', 'The root is split'],
    'After E is gone the square (64,64)–(128,128) holds only A, which fits a block, so its children merge into one leaf. Then (0,0)–(128,128) holds only A as well, so NE is a single leaf with A, as in the PA solution.'),
  Q('pa4-8', 'pa4', 'PA4-5: KD-tree on Speed, Ram, HD (buckets of 2, mean split). Row 1003 (speed 1.42) arrives and the first leaf holds 1001 (2.66) and 1002 (2.10). What is the root?',
    ['Speed 2.06', 'Speed 2.10', 'Ram 853', 'Speed 2.39'],
    'The first level uses Speed, the mean of the three speeds in hand is (2.66 + 2.10 + 1.42) / 3 = 2.06. 1003 goes left (1.42 &lt; 2.06), 1001 and 1002 go right.'),
  Q('pa4-9', 'pa4', 'PA4-5: the node S2.55 appears at level 4 of the tree. Why does it split on Speed?',
    ['The attributes rotate Speed, Ram, HD, Speed, so level 4 is Speed again', 'Speed has the most distinct values', 'It is the node with the highest value', 'Because the leaf has the smallest speeds'],
    'Levels rotate through the indexed attributes in the order given: level 1 Speed, level 2 Ram, level 3 HD, level 4 Speed, and so on. The split attribute does not depend on the data.'),
  Q('pa4-10', 'pa4', 'PA4-6: h(HD): 160 = 00, 200 = 01, 250 = 10, 300 = 11. h(Speed): 2.20 = 100. The key is h(HD) followed by h(Speed). What is the key of model 1007 (HD 200, Speed 2.20)?',
    ['01100', '10001', '10100', '01001'],
    'h(200) = 01 then h(2.20) = 100: 01100. The query Speed = 2.20 AND HD = 250 gives 10 followed by 100 = 10100, which holds model 1008.'),
  Q('pa4-11', 'pa4', 'PA4-6 (HD 2 bits, Speed 3 bits). How many buckets must be read for the query Speed = 2.20 alone?',
    ['4 buckets (the 2 HD bits are free)', '1 bucket', '8 buckets', '32 buckets'],
    'Speed = 2.20 fixes 3 bits (100). The 2 HD bits take every pattern: 2² = 4 buckets (00100, 01100, 10100, 11100). HD = 250 alone would leave 3 free bits and read 8 buckets.'),
  Q('pa4-12', 'pa4', 'Midterm 2025 5.1a: insert &lt;Mohamed, 20, 1.6&gt; (name, AGE, GPA) into the KD-tree with root GPA 2.56. The left leaf holds Jamal (22, 1.2) and Fatima (21, 0.9). What happens?',
    ['The leaf splits on AGE at 21: Mohamed goes left; Fatima and Jamal go right', 'The leaf splits on GPA at 1.23', 'Mohamed is added to the right subtree', 'No split: Mohamed is added to the leaf'],
    'GPA 1.6 &lt; 2.56 goes left, where the leaf is full. The next level uses AGE: (22 + 21 + 20) / 3 = 21. AGE &lt; 21: Mohamed. AGE ≥ 21: Fatima and Jamal.'),
  Q('pa4-13', 'pa4', 'Midterm 2025 5.1b: insert &lt;Mohamed, 20, 2.6&gt; into the original tree (root GPA 2.56, right child AGE 17.3 with leaves {Sarah, Michael} and {Amina}). What happens?',
    ['Mohamed goes to the leaf with Amina; no split is needed', 'The leaf with Sarah and Michael splits', 'The leaf with Amina splits on GPA', 'Mohamed goes to the left subtree'],
    '2.6 ≥ 2.56 goes right, then AGE 20 ≥ 17.3 goes right, to the leaf that holds only Amina, which has room for 2 records.'),
  Q('pa4-14', 'pa4', 'Midterm 2025 5.2a: quad tree on 0–100 by 0–200 (centre (50, 100)), one point per block, with A (60,110) in NE and B (30,30) in SW. In which block does C (30, 150) go?',
    ['NW', 'NE', 'SW', 'SE'],
    'x = 30 &lt; 50 means West and y = 150 ≥ 100 means North: NW, which is empty. No split.'),
  Q('pa4-15', 'pa4', 'Midterm 2025 5.2b: insert D (40, 40). The SW square splits at (25, 50) and again at (37.5, 25). Where do B (30, 30) and D (40, 40) end up in the last square?',
    ['B in NW and D in NE of the square centred (37.5, 25)', 'B in NE and D in NW (as drawn on the official answer)', 'B and D in the same block', 'B in SW and D in NE'],
    'With centre (37.5, 25): B has x = 30 &lt; 37.5, y = 30 ≥ 25, so NW. D has x = 40 ≥ 37.5, y = 40 ≥ 25, so NE. The official figure swaps the labels, but its own centres (31.25, 37.5) and (43.7, 37.5) agree with this.'),
];

// ============================================================ GLOSSARY
export const glossary = [
  ['Multidimensional index', 'An index whose keys are lists of several column values (keylist-pointer pairs), so one structure supports conditions on several columns.', 'l4'],
  ['Keylist', 'The list of column values that forms the key of a multidimensional index entry, for example (Mohamed, 22).', 'l4'],
  ['Exact-match query', 'A query that gives a value for every indexed attribute.', 'l4'],
  ['Partial-match query', 'A query that gives values for only some of the indexed attributes.', 'l4'],
  ['Range query', 'A query that asks for all points inside an interval on one or more attributes.', 'l4'],
  ['Nearest-neighbour query', 'A query for the stored point closest to a given point.', 'l4'],
  ['Partitioned hash table', 'A hash index whose bucket number is the concatenation of one hash value per attribute (mechanism II).', 'l4'],
  ['Collision (partitioned hash)', 'Two different keylists that hash to the same bucket, such as Joe (sales, 10k) and Sally (art, 30k) in bucket 101.', 'l4'],
  ['Grid index', 'The space is cut into cells by grid lines; the grid sits in memory and each cell points to a bucket on disk.', 'l4'],
  ['Stripe', 'The interval between two neighbouring grid lines in one dimension. A point on a line belongs to the stripe the line begins.', 'l4'],
  ['Overflow bucket', 'An extra bucket chained to a full bucket (grid approach 1). The grid does not change but lookups in that cell cost more I/Os.', 'l4'],
  ['Grid-line split', 'Approach 2 for a full grid bucket: add a new grid line. It cuts the whole space, so it adds a whole row or column of cells.', 'l4'],
  ['KD-tree', 'A binary tree with an attribute and a value V at each interior node (&lt; V left, ≥ V right); levels rotate through the attributes.', 'l4'],
  ['Mean split', 'The rule used in PA4-5 and the midterm: a full leaf plus the new record are split at the mean of the next attribute\'s values.', 'pa4'],
  ['Quad tree', 'A tree in which each interior node is a square split into NW, NE, SW and SE quadrants at its centre.', 'l4'],
  ['Block capacity', 'The number of points a leaf can hold. A square is a leaf if it holds no more than this.', 'l4'],
  ['Centre-line tie', 'A point exactly on a split line of a quad tree. The course states no rule, so state your convention (the simulator uses North and East).', 'pa4'],
  ['Collapse (quad tree)', 'After a deletion, merging the four children of a square back into one leaf when their points fit in a block.', 'pa4'],
  ['Bitmap index', 'One bit vector of length n (the number of rows) per distinct value; bit i is 1 if row i has that value.', 'l4'],
  ['Bitwise AND / OR / XOR', 'Operations on whole bit vectors that answer AND, OR and XOR conditions quickly; a range is the OR of the vectors in it.', 'l4'],
  ['Partial index', 'An index that contains only the entries of rows matching a WHERE clause given at creation.', 'l4'],
  ['Expression index', 'An index whose key is an expression over a column, such as lower(name).', 'l4'],
];

// ============================================================ CHEAT SHEET
export const cheat = [
  ['l4', 'Query types and who supports them', [
    'Exact, partial match, range, nearest neighbour.',
    'Partitioned hash: exact yes, partial yes, range no, NN no. O(1) + K.',
    'Grid: all four. O(log m) + K. Cons: space overhead, hard range choice, depends on distribution.',
    'KD-tree: exact yes, O(log n), small memory. Partial and NN no (slide 40).',
    'Quad tree: good with range queries. Cons: sensitive to changes, deep on skewed data.',
    'Bitmap: value, AND, OR, XOR, range. Con: n bits per value.',
  ]],
  ['l4', 'Motivation numbers', [
    '100,000 rows, 10 per page, 100 pointers per node, 1,000 per dept, 50% salary &gt; 50,000.',
    'Strategy 1: 1 + 10 + 100 = 111 (sorted) or 1 + 10 + 1,000 = 1,011.',
    'Salary index: 500 leaves + 5 non-leaf = 505, plus 5,000 or 50,000 pages: 5,505 or 50,505.',
    'Strategy 3: sort and multilevel dense index; the lecture gives no number.',
  ]],
  ['l4', 'Partitioned hashing and grid', [
    'Mechanism II: bucket = h1(a1) ∘ h2(a2) ∘ ... Partial match reads 2<sup>free bits</sup> buckets.',
    'Mechanism I (one hash of all attributes) cannot do partial match.',
    'Grid: a point on a line goes to the stripe it begins. Grid in memory, buckets on disk.',
    'Full bucket: approach 1 overflow bucket, approach 2 new grid line (cuts the whole space).',
  ]],
  ['l4', 'KD-tree and quad tree', [
    'KD: &lt; V left, ≥ V right; attributes rotate; split full leaf at the mean of the cap + 1 values.',
    'Lecture: insert (35,280) fits; insert (35,500) creates Age 35.',
    'Quad: square splits at its centre into NW, NE, SW, SE; leaf if points ≤ block size.',
    'Lecture: (90,150) fits; (100,110) splits the square at (87.5, 150). State your tie rule.',
  ]],
  ['pa4', 'PA4 and midterm answers', [
    'PA4-1: cells {1012}, {1007}, {1011}; PA4-2 AND/OR plans; AND binds tighter than OR.',
    'PA4-5 KD: S2.06, R1195 (1194.67), R853 (853.33), H267 (266.67), S2.55, R1024, H220.',
    'PA4-6: key = h(HD) h(Speed); Speed = 2.20 AND HD = 250 is bucket 10100 = model 1008.',
    'Midterm KD: Mohamed (1.6) splits AGE at 21; Mohamed (2.6) joins Amina. Quad: C in NW; D makes B NW and D NE of centre (37.5, 25).',
    'PA4-2 solution typo: Speed "1.82" is really 1.86.',
  ]],
];
