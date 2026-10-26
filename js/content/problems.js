// Problem lab content. Every structure and number below is computed by the engine at load time.
import * as B from '../engine/bptree.js';
import * as H from '../engine/hash.js';
import * as M from '../engine/multidim.js';
import * as C from '../engine/cost.js';
import * as D from '../engine/draw.js';

// ------------------------------------------------------------ layout helpers
const wrap = s => `<div style="overflow-x:auto;margin:6px 0">${s}</div>`;
const fig = (cap, svg) => `<div class="small muted" style="margin:14px 0 0"><strong>${cap}</strong></div>${wrap(svg)}`;
const side = (...parts) => `<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start">${parts.map(p => `<div style="flex:1 1 300px;min-width:0;overflow-x:auto">${p}</div>`).join('')}</div>`;
const tbl = (head, rows) => `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const stack = (...p) => p.map(wrap).join('');
const note = html => `<p class="small"><strong>Note.</strong> ${html}</p>`;
const pair = (k, p) => `&lt;${k}, ${p}&gt;`;
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const stackBox = (title, lines, cap) => {
  const rows = [...lines]; while (rows.length < cap) rows.push('');
  return `<div style="border:1px solid var(--line-strong);border-radius:6px;background:var(--surface);min-width:100px;flex:none"><div class="small muted" style="padding:2px 8px;border-bottom:1px solid var(--line-strong);font-size:11px">${title}</div>${rows.map(l => `<div style="padding:3px 8px;min-height:24px;font-family:var(--mono);font-size:13px;border-bottom:1px solid var(--line);white-space:nowrap">${l || '&nbsp;'}</div>`).join('')}</div>`;
};
const column = (title, boxes) => `<div style="display:flex;flex-direction:column;gap:8px;flex:none"><div class="small muted"><strong>${title}</strong></div>${boxes.join('')}</div>`;
const columns = cols => wrap(`<div style="display:flex;gap:24px;align-items:flex-start;padding:4px 2px">${cols.join('')}</div>`);
// plain-text wrapping for the monospace "answer" blocks
const wt = (s, w = 96) => String(s).split('\n').map(line => {
  const ind = (line.match(/^\s*(- )?/) || [''])[0].length, pad = ' '.repeat(ind);
  const out = []; let cur = '';
  for (const word of line.trimEnd().split(' ')) {
    if (cur && (cur + ' ' + word).length > w) { out.push(cur); cur = pad + word; } else cur = cur ? cur + ' ' + word : word;
  }
  out.push(cur); return out.join('\n');
}).join('\n');
const fx = C.fmt;
const pct = v => `${Math.round(v * 1000) / 10}%`;

// ------------------------------------------------------------ B+ tree helpers
function bpRun(t, ops) {
  const out = []; let cur = t;
  for (const [op, k] of ops) { const r = op === 'insert' ? B.insert(cur, k) : B.remove(cur, k); cur = r.tree; out.push({ op, k, tree: cur, steps: r.steps }); }
  return { final: cur, out };
}
const bpWork = out => wt(out.map(o => `${o.op === 'insert' ? 'Insert' : 'Delete'} ${o.k}:\n` + o.steps.map(s => '  - ' + s.text).join('\n')).join('\n\n'));
const bpFigs = out => out.map(o => fig(`After ${o.op} ${o.k}`, D.bptreeSVG(o.tree))).join('');
const tr = t => wrap(D.bptreeSVG(t));
const specStr = t => JSON.stringify(B.toSpec(t));

// ------------------------------------------------------------ conventional index helpers
function levelsOf(entries, per) { // entries: [[key, ptr]] sorted. Returns levels from the dense/bottom level up to the single top page.
  const out = []; let cur = entries;
  for (let g = 0; g < 12; g++) { const pgs = chunks(cur, per); out.push(pgs); if (pgs.length === 1) break; cur = pgs.map((p, i) => [p[0][0], i + 1]); }
  return out;
}
const levelColumns = (levels, per, bottomName) => [...levels].reverse().map((pgs, ri) => {
  const li = levels.length - 1 - ri;
  return column(`${li === 0 ? bottomName : `Level ${li + 1} (sparse)`}`, pgs.map((p, i) => stackBox(`Index page ${i + 1}`, p.map(([k, q]) => pair(k, q)), per)));
});
const tableColumn = (rows, perPage, label = 'Table data') => column(label, chunks(rows, perPage).map((p, i) => stackBox(`Table page ${i + 1}`, p.map(r => r.join(', ')), perPage)));

// ============================================================ MIDTERM 2025 (in exam order)
const MT = 'Midterm 2025';
const MID = [];

// ---- Exercise 1
MID.push({
  id: 'mt-1', m: 'l1', kind: 'explain', topic: MT, title: 'Ex 1: ten statements, true or false with correction (20 marks)',
  prompt: 'For each statement say <strong>true</strong> or <strong>false</strong>. If it is false, write the correction. If it is true, explain why. Write all ten before you reveal.',
  data: `<ol class="small" style="padding-left:20px;display:grid;gap:4px">
    <li>Table data are stored as pages on the hard disk.</li>
    <li>A conventional index is a heap of key-pointer pairs.</li>
    <li>Inserting and deleting rows in a table must be reflected in the indices built on the affected table.</li>
    <li>A B+ tree node contains at most n keys and n + 3 pointers.</li>
    <li>A B+ tree keeps O(log n) performance because the tree can get skewed.</li>
    <li>In static hashing, the number of buckets varies with the number of records stored.</li>
    <li>In extensible hashing, the directory can double in size with some insertions.</li>
    <li>In linear hashing, overflow buckets can be used when the designated bucket is full and the records in the table are below the utilization rate.</li>
    <li>Logical planning is part of the logs and recovery module of the RDBMS.</li>
    <li>The logical planner chooses plans that minimize the number of rows to operate on as early as possible.</li></ol>`,
  answerHtml: tbl(['#', 'T / F', 'Correction or reason'], [
    ['1', 'True', 'The disk is read and written in pages (blocks); a page holds several rows.'],
    ['2', '<strong>False</strong>', 'It is a <strong>sorted list</strong> of key-pointer pairs, not a heap. Sorted order is what makes binary search and sparse indices possible.'],
    ['3', 'True', 'An index is a copy of the key plus a pointer. If a row is inserted, deleted or its key changes, the index would point to stale data unless it is updated too (this is the cost of having indices).'],
    ['4', '<strong>False</strong>', 'At most n keys and <strong>n + 1</strong> pointers.'],
    ['5', '<strong>False</strong>', 'It keeps O(log n) because the tree is <strong>always balanced</strong>: every leaf is at the same depth (splits and merges keep it so).'],
    ['6', '<strong>False</strong>', 'The number of buckets is <strong>fixed</strong> in static hashing (extra records go to overflow chains). Extensible and linear hashing are the dynamic ones.'],
    ['7', 'True', 'When a bucket is full and j = i, i is incremented and the directory doubles (2<sup>i</sup> entries).'],
    ['8', 'True', 'A new bucket is added only when the utilization threshold is reached. Below it, a full designated bucket simply gets an overflow block.'],
    ['9', '<strong>False</strong>', 'Logical planning belongs to the <strong>query processor</strong> (parser, logical planner, optimizer). Logs and recovery is the transaction manager side.'],
    ['10', 'True', 'Push selections (and projections) down so that joins and products see as few rows as possible.'],
  ]),
  checklist: ['Statements 2, 4, 5, 6, 9 identified as false with the right correction', 'Statements 1, 3, 7, 8, 10 identified as true with a one-line reason', 'Count: 5 false, 5 true'],
});

// ---- Exercise 2
const E2 = [['Ahmed', 18, 0.7], ['Sara', 20, 1.0], ['Youssef', 22, 1.3], ['Mariam', 18, 1.6], ['Omar', 20, 1.9], ['Nour', 22, 2.1], ['Karim', 18, 2.3], ['Salma', 20, 2.5]];
const e2Table = tbl(['Name', 'Age', 'GPA'], E2.map(r => [r[0], r[1], r[2].toFixed(1)]));
{
  const dense = E2.map((r, i) => [r[1], Math.floor(i / 2) + 1]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lv = levelsOf(dense, 4);
  MID.push({
    id: 'mt-2a', m: 'l1', kind: 'build', topic: MT, title: 'Ex 2a: dense multilevel index on age (Exercise 2, 15 marks in total)',
    prompt: 'Build a <strong>dense multilevel</strong> index on column <strong>age</strong> of the table below. Add as many levels as needed so that the last level (furthest from the table) is a single page. The table on disk is <strong>sorted on gpa</strong>. A page holds 2 rows or 4 key-pointer pairs. Show the table pages and every index level split across pages (pointers are page numbers).',
    data: e2Table,
    answerHtml: columns([...levelColumns(lv, 4, 'Dense level (bottom)'), tableColumn(E2.map(r => [r[0], r[1], r[2].toFixed(1)]), 2)]) +
      note('The table is sorted on gpa, not on age, so the index must be <strong>dense</strong> (one pair per row) and sorted on age. Equal ages are listed in table order. The pointer is the table page that holds the row. The 8 pairs fill 2 index pages; a sparse level on top of them (first key of each page, pointing to the index page) is 2 pairs and fits one page, so we stop. The official sheet prints &lt;20, 2&gt; for Sara; Sara is in table page 1, so the pair is &lt;20, 1&gt; (a typo on the sheet).'),
    answer: `Table pages (2 rows each): ${chunks(E2, 2).map((p, i) => `P${i + 1} = ${p.map(r => r[0]).join(', ')}`).join('; ')}
Dense level: 8 pairs sorted by age, 4 per page -> ${lv[0].length} pages
Sparse level above: ${lv[1][0].length} pairs (first key of each dense page) -> 1 page, stop.`,
    checklist: ['Table shown as 4 pages of 2 rows in gpa order', 'Dense level has 8 pairs sorted by age, split into 2 index pages of 4', 'Pointers are the table page numbers (18 → 1, 2, 4; 20 → 1, 3, 4; 22 → 2, 3)', 'A top sparse level of one page pointing to the 2 dense index pages'],
  });
}
{
  const ages = E2.map(r => r[1]);
  const bm = M.bitmap(ages);
  MID.push({
    id: 'mt-2b', m: 'l4', kind: 'build', topic: MT, title: 'Ex 2b: bitmap index on age (Exercise 2)',
    prompt: 'Construct a <strong>bitmap index</strong> on column <strong>age</strong> of the same table (rows in the order shown).',
    data: e2Table,
    answerHtml: tbl(['Value', ...E2.map((r, i) => `row ${i + 1}<br><span class="muted">${r[0]}</span>`)], bm.map(b => [`<strong>${b.value}</strong>`, ...[...b.bits].map(c => `<span class="num">${c}</span>`)])) +
      note('One bit vector per distinct value, one bit per row. Check: every column of the table must contain exactly one 1 (each row has exactly one age).'),
    answer: bm.map(b => `${b.value}: ${b.bits}`).join('\n'),
    checklist: ['Three vectors (18, 20, 22) of 8 bits', 'Each row has exactly one 1 across the three vectors'],
  });
}
{
  const per = chunks(E2, 2).map((p, i) => [`${Math.min(...p.map(r => r[2])).toFixed(1)}, ${Math.max(...p.map(r => r[2])).toFixed(1)}`, i + 1]);
  MID.push({
    id: 'mt-2c', m: 'l1', kind: 'build', topic: MT, title: 'Ex 2c: BRIN index on gpa (Exercise 2)',
    prompt: 'Construct a <strong>BRIN index on column gpa</strong>. A page holds 2 rows or 4 key-pointer pairs. Show the index split across pages.',
    data: e2Table,
    answerHtml: columns([column('BRIN index', chunks(per, 4).map((p, i) => stackBox(`Index page ${i + 1}`, p.map(([r, q]) => pair(`(${r})`, q)), 4))), tableColumn(E2.map(r => [r[0], r[1], r[2].toFixed(1)]), 2)]) +
      note('BRIN stores <strong>one pair per table page</strong>: the (min, max) of the column in that page and the page number. 4 table pages give 4 pairs, which fit one index page. Because gpa is already sorted, the ranges do not overlap, which is the best case for BRIN.'),
    answer: per.map(([r, q]) => `page ${q}: (${r})`).join('\n'),
    checklist: ['One entry per table page, not per row', 'Each entry is (min, max) of gpa in that page plus the page pointer', '4 pairs fit in a single index page'],
  });
}

// ---- Exercise 3 (B+ tree, n = 3)
const MT3 = B.fromSpec(3, { k: [20], c: [{ k: [7, 12], c: [[1, 3, 5], [7, 9], [12, 14]] }, { k: [23], c: [[20, 21], [23, 35]] }] });
const mt3Data = fig('The B+ tree (n = 3). The four parts are independent: each starts from this tree.', D.bptreeSVG(MT3));
{
  const r = bpRun(MT3, [['insert', 18]]);
  MID.push({
    id: 'mt-3a', m: 'l2', kind: 'build', topic: MT, title: 'Ex 3a: insert 18 (B+ tree, Exercise 3, 20 marks in total)',
    prompt: 'Show the B+ tree (n = 3) after inserting key <strong>18</strong>.', data: mt3Data,
    answerHtml: tr(r.final) + note('18 belongs in leaf [12, 14], which has room (max 3 keys). Nothing else changes.'),
    answer: bpWork(r.out), checklist: ['Found the right leaf (12 ≤ 18 < 20)', 'Leaf is [12, 14, 18] with no split', 'Rest of the tree untouched'],
  });
}
{
  const r = bpRun(MT3, [['remove', 3]]);
  MID.push({
    id: 'mt-3b', m: 'l2', kind: 'build', topic: MT, title: 'Ex 3b: delete 3 (B+ tree, Exercise 3)',
    prompt: 'Show the B+ tree (n = 3) after deleting key <strong>3</strong>.', data: mt3Data,
    answerHtml: tr(r.final) + note('A leaf needs at least ⌊(n + 1) / 2⌋ = 2 keys. [1, 3, 5] drops to [1, 5], which is still fine.'),
    answer: bpWork(r.out), checklist: ['Knows the leaf minimum is 2 keys for n = 3', 'Leaf [1, 5], no borrowing or merging'],
  });
}
{
  const r = bpRun(MT3, [['remove', 7]]);
  MID.push({
    id: 'mt-3c', m: 'l2', kind: 'build', topic: MT, title: 'Ex 3c: delete 7 (B+ tree, Exercise 3)',
    prompt: 'Show the B+ tree (n = 3) after deleting key <strong>7</strong>.', data: mt3Data,
    answerHtml: tr(r.final) + note('[7, 9] drops to [9]: underflow. The left sibling [1, 3, 5] has 3 keys, one more than the minimum, so it lends 5. The leaves become [1, 3] and [5, 9], and the separator in the parent changes from 7 to the new smallest key of the right leaf, 5.'),
    answer: bpWork(r.out), checklist: ['Detected underflow of [9]', 'Borrowed 5 from the left sibling (not merged)', 'Updated the parent separator from 7 to 5'],
  });
}
{
  const r = bpRun(MT3, [['remove', 21]]);
  MID.push({
    id: 'mt-3d', m: 'l2', kind: 'build', topic: MT, title: 'Ex 3d: delete 21 (B+ tree, Exercise 3)',
    prompt: 'Show the B+ tree (n = 3) after deleting key <strong>21</strong>. This is the hardest part: it cascades up to the root.', data: mt3Data,
    why: 'A non-leaf can underflow too. Its minimum is ⌈(n + 1) / 2⌉ − 1 = 1 key (2 pointers). When it is empty it borrows through the parent from a sibling that has a spare key: the separator comes down, a sibling key goes up.',
    answerHtml: tr(r.final) + note('The official solution sheet shows root [7, 20] over leaves [1, 3, 5], [7, 9], [20, 23, 35]. That <strong>loses keys 12 and 14</strong>, so it cannot be right (every key of the table must still be in a leaf). The correct result by the lecture algorithm is above.'),
    answer: bpWork(r.out), checklist: ['Leaf [20] underflows and merges with [23, 35] into [20, 23, 35]', 'The parent [23] is left with no key and underflows', 'Its left sibling [7, 12] has a spare key, so it borrows through the root: new root 12', 'All keys 1, 3, 5, 7, 9, 12, 14, 20, 23, 35 are still present'],
  });
}

// ---- Exercise 4 (hash)
const EX = H.extNew({ i: 1, cap: 3, buckets: [{ prefix: '0', j: 1, recs: ['0010', '0110', '0111'] }, { prefix: '1', j: 1, recs: ['1000'] }] });
const extData = fig('The extensible hash table (a bucket holds 3 records). Each part starts from this table.', D.extHashSVG(EX));
const extWork = (s, h) => wt(H.extInsert(s, h).steps.map((x, i) => `${i + 1}. ${x.text}`).join('\n'));
{
  const r = H.extInsert(EX, '0000');
  MID.push({
    id: 'mt-4-1a', m: 'l3', kind: 'build', topic: MT, title: 'Ex 4.1a: extensible hashing, insert 0000 (Exercise 4, 20 marks in total)',
    prompt: 'Show the extensible hash table after inserting <strong>0000</strong>.', data: extData,
    answerHtml: wrap(D.extHashSVG(r.state)) + note('0000 goes to the bucket of first bit 0, which is full with j = i = 1. So i becomes 2 (directory doubles to 4 entries), and the bucket splits on its <strong>second</strong> bit: 00xx gets 0000, 0010; 01xx gets 0110, 0111. The bucket for 1 is untouched (j stays 1) and now has two directory entries, 10 and 11.'),
    answer: extWork(EX, '0000'), checklist: ['i grows from 1 to 2 and the directory has 4 entries', 'Split on the second bit: 0000, 0010 | 0110, 0111, both with j = 2', 'The 1-bucket keeps j = 1 and is pointed to by 10 and 11'],
  });
}
{
  const r = H.extInsert(EX, '1111');
  MID.push({
    id: 'mt-4-1b', m: 'l3', kind: 'build', topic: MT, title: 'Ex 4.1b: extensible hashing, insert 1111 (Exercise 4)',
    prompt: 'Show the extensible hash table after inserting <strong>1111</strong>.', data: extData,
    answerHtml: wrap(D.extHashSVG(r.state)) + note('First bit 1: the bucket [1000] has room (cap 3). Just add 1111. No split, no doubling.'),
    answer: extWork(EX, '1111'), checklist: ['Looks at the first i = 1 bit only', 'Adds 1111 to the 1-bucket without any restructuring'],
  });
}
const MLIN = H.linNew({ n: 3, cap: 2, buckets: [[], { recs: ['1001', '1101'], over: ['0011'] }, []] });
const linData = fig('The linear hash table (bucket capacity 2, expands at 80% utilization computed before each insertion). Each part starts from this table.', D.linHashSVG(MLIN));
const linWork = (s, h) => wt(H.linInsert(s, h).steps.map((x, i) => `${i + 1}. ${x.text}`).join('\n'));
{
  const r = H.linInsert(MLIN, '1111');
  MID.push({
    id: 'mt-4-2a', m: 'l3', kind: 'build', topic: MT, title: 'Ex 4.2a: linear hashing, insert 1111 (Exercise 4)',
    prompt: 'Show the linear hash table after inserting key <strong>1111</strong>.', data: linData,
    answerHtml: wrap(D.linHashSVG(r.state)) + note('Utilization before inserting = 3 records / (3 buckets × 2) = 50% < 80%, so no new bucket. The last i = 2 bits of 1111 are 11 = 3, but only buckets 0..2 exist, so use 3 − 2<sup>i−1</sup> = 3 − 2 = 1: bucket 01. It is full, so 1111 goes into its overflow block (next to 0011).'),
    answer: linWork(MLIN, '1111'), checklist: ['Computed utilization BEFORE inserting: 3/6 = 50%', 'Used the LAST 2 bits (11), not the first', 'Bucket 3 does not exist, so flipped the top bit to bucket 01', 'Put 1111 in the overflow block of 01'],
  });
}
{
  const r = H.linInsert(MLIN, '1110');
  MID.push({
    id: 'mt-4-2b', m: 'l3', kind: 'build', topic: MT, title: 'Ex 4.2b: linear hashing, insert 1110 (Exercise 4)',
    prompt: 'Show the linear hash table after inserting key <strong>1110</strong>.', data: linData,
    answerHtml: wrap(D.linHashSVG(r.state)) + note('Utilization is again 50%, so no expansion. Last 2 bits of 1110 are 10 = 2 < n = 3, so bucket 10 exists and is empty: 1110 goes there.'),
    answer: linWork(MLIN, '1110'), checklist: ['No expansion (50% < 80%)', 'Last two bits 10 → bucket 10', 'Overflow of bucket 01 left as it is'],
  });
}

// ---- Exercise 5 (multidimensional)
const KDM = M.kdNew(['GPA', 'AGE'], 2, { attr: 0, val: 2.56, left: { recs: [{ id: 'Jamal', v: [1.2, 22] }, { id: 'Fatima', v: [0.9, 21] }] }, right: { attr: 1, val: 17.3, left: { recs: [{ id: 'Sarah', v: [3.8, 17] }, { id: 'Michael', v: [4, 16] }] }, right: { recs: [{ id: 'Amina', v: [2.7, 19] }] } } });
const kdFmt = r => `${r.id}, ${r.v[1]}, ${r.v[0]}`;
const kdData = fig('The KD-tree (rows are Name, Age, GPA). A leaf holds at most 2 rows. When a leaf must split, the split value is the average of the 3 rows involved, on the attribute of that level. Each part starts from this tree.', D.kdSVG(KDM, { fmt: kdFmt }));
{
  const r = M.kdInsert(KDM, { id: 'Mohamed', v: [1.6, 20] });
  MID.push({
    id: 'mt-5-1a', m: 'l4', kind: 'build', topic: MT, title: 'Ex 5.1a: KD-tree, insert Mohamed (20, 1.6) (Exercise 5, 20 marks in total)',
    prompt: 'Show the KD-tree after inserting the row <strong>&lt;Mohamed, 20, 1.6&gt;</strong>.', data: kdData,
    answerHtml: wrap(D.kdSVG(r.tree, { fmt: kdFmt })) + note('GPA 1.6 < 2.56, so go left into the full leaf [Jamal, Fatima]. Split the 3 rows: the leaf is on level 2, which uses AGE. Average age = (22 + 21 + 20) / 3 = 21. Ages below 21 go left (Mohamed), ages ≥ 21 go right (Jamal, Fatima).'),
    answer: wt(r.steps.map((s, i) => `${i + 1}. ${s.text}`).join('\n')),
    checklist: ['Went left at the root (1.6 < 2.56)', 'Split on AGE (the second level) not GPA', 'Split value 21 = (22 + 21 + 20) / 3', 'Left leaf [Mohamed], right leaf [Jamal, Fatima]'],
  });
}
{
  const r = M.kdInsert(KDM, { id: 'Mohamed', v: [2.6, 20] });
  MID.push({
    id: 'mt-5-1b', m: 'l4', kind: 'build', topic: MT, title: 'Ex 5.1b: KD-tree, insert Mohamed (20, 2.6) (Exercise 5)',
    prompt: 'Show the KD-tree after inserting the row <strong>&lt;Mohamed, 20, 2.6&gt;</strong>.', data: kdData,
    answerHtml: wrap(D.kdSVG(r.tree, { fmt: kdFmt })) + note('GPA 2.6 ≥ 2.56 goes right; AGE 20 ≥ 17.3 goes right again, into the leaf [Amina], which has room for a second row. No split.'),
    answer: wt(r.steps.map((s, i) => `${i + 1}. ${s.text}`).join('\n')),
    checklist: ['Right at GPA 2.56, right at AGE 17.3', 'Leaf [Amina, Mohamed], no split'],
  });
}
const Q0 = (() => { let q = M.quadNew({ x0: 0, y0: 0, x1: 100, y1: 200 }, 1); q = M.quadInsert(q, { id: 'A', x: 60, y: 110 }).tree; return M.quadInsert(q, { id: 'B', x: 30, y: 30 }).tree; })();
const quadData = fig('The quad tree: region x from 0 to 100, y from 0 to 200. Each block holds at most one point.', stack(D.quadPlaneSVG(Q0, { xLabel: 'x', yLabel: 'y' }), D.quadTreeSVG(Q0)));
{
  const r = M.quadInsert(Q0, { id: 'C', x: 30, y: 150 });
  MID.push({
    id: 'mt-5-2a', m: 'l4', kind: 'build', topic: MT, title: 'Ex 5.2a: quad tree, which block gets C(30, 150)? (Exercise 5)',
    prompt: 'In the quad tree below (each block holds at most one point), within which block would <strong>C(30, 150)</strong> be inserted? Name the block, and say whether anything splits.', data: quadData,
    answerHtml: `<p><strong>NW.</strong></p>` + stack(D.quadPlaneSVG(r.tree, { xLabel: 'x', yLabel: 'y', hl: ['C'] }), D.quadTreeSVG(r.tree)) + note('The root centre is (50, 100). C has x = 30 < 50 (west) and y = 150 ≥ 100 (north), so it goes to the NW child, which is an empty leaf. No split is needed.'),
    answer: wt(r.steps.map((s, i) => `${i + 1}. ${s.text}`).join('\n')), checklist: ['Compared with the centre (50, 100): west and north', 'Answer NW', 'The NW block was empty, so no split'],
  });
}
{
  const r = M.quadInsert(Q0, { id: 'D', x: 40, y: 40 });
  MID.push({
    id: 'mt-5-2b', m: 'l4', kind: 'build', topic: MT, title: 'Ex 5.2b: quad tree, insert D(40, 40) (Exercise 5)',
    prompt: 'Show the quad tree after inserting point <strong>D(40, 40)</strong> (each block holds at most one point).', data: quadData,
    why: 'When two points land in the same block, split that block at its centre and re-insert both. Keep splitting until each point is alone. Always compute the new centre from the square being split.',
    answerHtml: stack(D.quadPlaneSVG(r.tree, { xLabel: 'x', yLabel: 'y', hl: ['D'] }), D.quadTreeSVG(r.tree)) + note('D goes to the SW square (0..50 × 0..100, centre (25, 50)), where B(30, 30) already sits: D is east and south, B is east and south, so both land in the SE child (25..50 × 0..50, centre (37.5, 25)). Split again: B(30, 30) is west of 37.5 and north of 25, so NW; D(40, 40) is east and north, so NE. The official sheet writes these two labels the other way round (NE for B and NW for D), but its own region centres (31.25, 37.5) and (43.7, 37.5) show B on the left and D on the right.'),
    answer: wt(r.steps.map((s, i) => `${i + 1}. ${s.text}`).join('\n')), checklist: ['SW square centre (25, 50): D and B both in SE', 'SE square centre (37.5, 25): split again', 'B in NW and D in NE of that square', 'A(60, 110) unchanged in the NE block of the root'],
  });
}

// ---- Exercise 6 (logical planning)
const S6 = tbl(['R(a, b, c)', 'S(c, d)'], [['T(R) = 40,000', 'T(S) = 80,000'], ['V(R, a) = 2000', 'V(S, c) = 40,000'], ['V(R, c) = 20,000', 'V(S, d) = 2000'], ['Max(a) = 200', ''], ['Min(a) = 40', ''], ['V(R, b) = 4', '']]);
{
  const r = C.eq(40000, 2000);
  MID.push({
    id: 'mt-6a', m: 'pa5', kind: 'calc', topic: MT, title: 'Ex 6a: size of σ a=4 (R) (Exercise 6, 15 marks in total)',
    prompt: 'Using the estimation rules from class, estimate the size of <strong>σ<sub>a=4</sub>(R)</strong>. Show your working.', data: S6,
    answers: [{ label: 'T(σ a=4 (R))', value: r.value, tol: 0.5, unit: 'tuples' }],
    answer: wt(`Equality selection on a: T(R) / V(R, a)\n${r.work}`), why: 'Selection with equality: T(R) / V(R, a). The value 4 does not matter (it is not compared to min or max).',
  });
}
{
  const r = C.rangeSel(40000, '>=', 80, 40, 200);
  MID.push({
    id: 'mt-6b', m: 'pa5', kind: 'calc', topic: MT, title: 'Ex 6b: size of σ a≥80 (R) (Exercise 6)',
    prompt: 'Estimate the size of <strong>σ<sub>a≥80</sub>(R)</strong>, using Min(a) and Max(a). Use the course convention: cut the fraction f to 2 decimals before multiplying.', data: S6,
    answers: [{ label: 'f (fraction of values kept)', value: 0.75, tol: 0.011 }, { label: 'T(σ a≥80 (R))', value: r.value, tol: 100, unit: 'tuples' }],
    answer: wt(`For ≥ the count of values from v up to max includes v itself: (max − v + 1) / (max − min + 1)\n${r.work}`),
    why: 'For a ≥ v the fraction is (max − v + 1) / (max − min + 1) (the +1 counts v itself). For a strict > v it is (max − v) / (max − min + 1). Without min and max you would use T(R) / 3.',
  });
}
{
  const r = C.thetaJoin(40000, 80000);
  MID.push({
    id: 'mt-6c', m: 'pa5', kind: 'calc', topic: MT, title: 'Ex 6c: size of R ⋈ b>80 S (Exercise 6)',
    prompt: 'Estimate the size of <strong>R ⋈<sub>b&gt;80</sub> S</strong>. Show your working and name the rule.', data: S6,
    answers: [{ label: 'T(R ⋈ b>80 S)', value: Math.round(r.value), tol: 0.001, rel: true, unit: 'tuples' }],
    answer: wt(`The join condition is an inequality (b > 80), not equality on shared attributes, so use the product divided by 3.\n${r.work}`),
    why: 'A θ-join with an inequality is estimated as T(R) × T(S) / 3. The equality rule (divide by max of V) applies only to equality on shared attributes (natural join / equi-join).',
  });
}
{
  const r = C.distinct(80000);
  MID.push({
    id: 'mt-6d', m: 'pa5', kind: 'calc', topic: MT, title: 'Ex 6d: size of δ(S) (Exercise 6)',
    prompt: 'Estimate the size of <strong>δ(S)</strong> (duplicate elimination).', data: S6,
    answers: [{ label: 'T(δ(S))', value: r.value, tol: 1, unit: 'tuples' }],
    answer: wt(`δ removes duplicates; the course rule is T(S) / 2.\n${r.work}`), why: 'The rule for δ is T(R) / 2 (a guess halfway between "no duplicates" and "all duplicates").',
  });
}
{
  const E = { op: 'project', text: 'π a,d', in: { op: 'select', text: 'σ d=5', in: { op: 'join', text: '⋈ R.c = S.c', l: { op: 'rel', name: 'R' }, r: { op: 'rel', name: 'S' } } } };
  const F = { op: 'project', text: 'π a,d', in: { op: 'join', text: '⋈ R.c = S.c', l: { op: 'rel', name: 'R' }, r: { op: 'select', text: 'σ d=5', in: { op: 'rel', name: 'S' } } } };
  const G = { op: 'project', text: 'π a,d', in: { op: 'select', text: 'σ R.c = S.c ∧ d=5', in: { op: 'product', text: '×', l: { op: 'rel', name: 'R' }, r: { op: 'rel', name: 'S' } } } };
  const dS = C.eq(80000, 2000);
  MID.push({
    id: 'mt-6e', m: 'l5', kind: 'build', topic: MT, title: 'Ex 6e: two equivalent logical plans (Exercise 6)',
    prompt: 'Give <strong>2 equivalent logical plans</strong>, with their plan trees, for the expression <strong>π<sub>a,d</sub>(σ<sub>R.c=S.c ∧ d=5</sub>(R × S))</strong>. Use the <a href="#/formula">formula sheet</a> rules. Then say which one you would run.',
    why: 'Two rules do the work: σ over a product with an equality between the two sides is a join (σ<sub>R.c=S.c</sub>(R × S) = R ⋈ S), and a selection on d (an attribute of S only) can be pushed below the join onto S.',
    answerHtml: fig('Original expression', D.planSVG(G)) + side(`<div class="small muted"><strong>Plan 1</strong> π a,d (σ d=5 (R ⋈ S))</div>` + D.planSVG(E), `<div class="small muted"><strong>Plan 2</strong> π a,d (R ⋈ σ d=5 (S))</div>` + D.planSVG(F)) +
      note(`Plan 2 is better. Plan 1 joins all 40,000 and 80,000 rows first. Plan 2 filters S first: σ d=5 (S) = ${C.eq(80000, 2000).work.replace('T(R) / V(R, a)', 'T(S) / V(S, d)')} rows, so the join sees only about 40 rows of S.`),
    checklist: ['Merged σ R.c = S.c with × into a join (⋈)', 'Plan 1: selection d=5 above the join, projection on top', 'Plan 2: selection d=5 pushed down onto S (it only mentions S attributes)', 'Says plan 2 is cheaper because the join input from S shrinks from 80,000 to about 40'],
  });
}

// ============================================================ NEW PROBLEMS, in course order
// ---------------- L1 / PA1: conventional indices and storage
const CONV = [];
{
  const T = 48000, rowB = 100, blk = 4096, pairB = 16;
  const rpb = Math.floor(blk / rowB), tb = Math.ceil(T / rpb), ppb = blk / pairB;
  const dense = Math.ceil(T / ppb), sparse = Math.ceil(tb / ppb);
  const dl = levelsOf(Array.from({ length: T }, (_, i) => [i, 1]), ppb), sl = levelsOf(Array.from({ length: tb }, (_, i) => [i, 1]), ppb);
  const denseML = dl.reduce((a, l) => a + l.length, 0), sparseML = sl.reduce((a, l) => a + l.length, 0);
  CONV.push({
    id: 'cv-blocks', m: 'pa1', kind: 'calc', topic: 'Conventional indices', title: 'Block counts for the table and its indices',
    prompt: `A table has <strong>${fx(T)}</strong> rows of <strong>${rowB} bytes</strong>, sorted on the key, stored in blocks of <strong>${fx(blk)} bytes</strong> (no header). A key-pointer pair takes <strong>${pairB} bytes</strong>. Compute the sizes below. For the multilevel questions keep adding levels (each level is a sparse index on the level below) until the last level is a single block, and count every block of every level.`,
    answers: [
      { label: 'Table blocks', value: tb, tol: 0.5, unit: 'blocks' },
      { label: 'Dense index, single level', value: dense, tol: 0.5, unit: 'blocks' },
      { label: 'Sparse index, single level', value: sparse, tol: 0.5, unit: 'blocks' },
      { label: 'Sparse multilevel, all levels together', value: sparseML, tol: 0.5, unit: 'blocks' },
    ],
    answer: wt(`Rows per block = floor(${blk} / ${rowB}) = ${rpb}; table blocks = ceil(${fx(T)} / ${rpb}) = ${fx(tb)}
Pairs per block = ${blk} / ${pairB} = ${ppb}
Dense: one pair per row: ceil(${fx(T)} / ${ppb}) = ${dense} blocks
Sparse: one pair per TABLE BLOCK (the table is sorted): ceil(${fx(tb)} / ${ppb}) = ${sparse} blocks
Sparse multilevel: levels of ${sl.map(l => l.length).join(' + ')} blocks = ${sparseML} blocks
(For comparison: dense multilevel levels of ${dl.map(l => l.length).join(' + ')} = ${denseML} blocks.)`),
    why: 'Always round rows per block DOWN (a row cannot straddle blocks) and round block counts UP. A sparse index has one pair per table block, a dense one has one pair per row, so sparse is about rows-per-block times smaller.',
  });
}
{
  const ids = [5, 12, 19, 23, 31, 40, 44, 52, 60, 71];
  const rows = ids.map((id, i) => [id, ['Mona', 'Adel', 'Hana', 'Tarek', 'Dina', 'Omar', 'Lina', 'Sami', 'Rana', 'Yara'][i]]);
  const sparseE = chunks(rows, 2).map((p, i) => [p[0][0], i + 1]);
  const lv = levelsOf(sparseE, 2);
  CONV.push({
    id: 'cv-sparse', m: 'l1', kind: 'build', topic: 'Conventional indices', title: 'Sparse multilevel index on a sorted file',
    prompt: 'The table below is sorted on <strong>id</strong>. A table page holds <strong>2 rows</strong> and an index page holds <strong>2 key-pointer pairs</strong>. Build a <strong>sparse multilevel</strong> index on id (add levels until the last is one page; pointers are page numbers). Then count how many pages are read to find id = 52.',
    data: tbl(['id', 'name'], rows),
    answerHtml: columns([...levelColumns(lv, 2, 'Level 1 (sparse)'), tableColumn(rows, 2)]) +
      note(`Level 1 has one pair per table page (${sparseE.length} pairs, ${lv[0].length} pages). Each higher level has one pair per page of the level below. The top level is one page. Finding 52: ${lv.length} index pages (one per level) + 1 table page = <strong>${lv.length + 1} page reads</strong>.`),
    answer: wt(`Table pages: ${chunks(rows, 2).length}; level 1 pairs: ${sparseE.length}; levels (pages): ${lv.map(l => l.length).join(', ')}.
Search 52: top page picks the largest key ≤ 52, follow down each level, then read the table page: ${lv.length + 1} reads.`),
    checklist: ['Sparse: only the first key of each table page is indexed', `${lv.length} index levels with ${lv.map(l => l.length).join(', ')} pages`, 'Each higher level points to pages of the level below with their first keys', `Read count = levels (${lv.length}) + 1 table page = ${lv.length + 1}`],
  });
}
{
  const P = [['P1', 12.5], ['P2', 7.0], ['P3', 3.5], ['P4', 9.0], ['P5', 15.0], ['P6', 4.0], ['P7', 8.5], ['P8', 20.0], ['P9', 11.0], ['P10', 6.5], ['P11', 13.0], ['P12', 5.0]];
  const pg = chunks(P, 2), ent = pg.map((p, i) => [`${Math.min(...p.map(r => r[1])).toFixed(1)}, ${Math.max(...p.map(r => r[1])).toFixed(1)}`, i + 1]);
  const lo = 7, hi = 9, hit = pg.map((p, i) => ({ i: i + 1, min: Math.min(...p.map(r => r[1])), max: Math.max(...p.map(r => r[1])) })).filter(x => x.max >= lo && x.min <= hi);
  CONV.push({
    id: 'cv-brin', m: 'pa1', kind: 'build', topic: 'Conventional indices', title: 'BRIN index on an unsorted column, then a range query',
    prompt: 'The table below is stored in this order (not sorted). A table page holds <strong>2 rows</strong> and an index page holds <strong>4 key-pointer pairs</strong>. Build a <strong>BRIN index on price</strong>, split across index pages. Then say which table pages must be read for <strong>price between 7 and 9</strong>.',
    data: tbl(['item', 'price'], P.map(r => [r[0], r[1].toFixed(1)])),
    answerHtml: columns([column('BRIN index', chunks(ent, 4).map((p, i) => stackBox(`Index page ${i + 1}`, p.map(([r, q]) => pair(`(${r})`, q)), 4))), tableColumn(P.map(r => [r[0], r[1].toFixed(1)]), 2)]) +
      note(`One pair per table page: (min price, max price) and the page number. 6 pages give 6 pairs, so 2 index pages. For 7 ≤ price ≤ 9 read every page whose range overlaps [7, 9]: pages <strong>${hit.map(h => h.i).join(', ')}</strong>. A page is read even if only the range overlaps (it may hold no match), because BRIN cannot say. Since the data is unsorted, ranges are wide and overlap a lot.`),
    answer: wt(ent.map(([r, q]) => `page ${q}: (${r})`).join('\n') + `\nPages overlapping [${lo}, ${hi}]: ${hit.map(h => h.i).join(', ')}`),
    checklist: ['One pair per table page (not per row)', 'Each pair is (min, max) with the page pointer', '2 index pages of at most 4 pairs', `Pages to read: ${hit.map(h => h.i).join(', ')} (every range that overlaps 7 to 9)`],
  });
}
CONV.push({
  id: 'cv-explain', m: 'l1', kind: 'explain', topic: 'Conventional indices', title: 'What does an insert cost with sparse, dense and BRIN indices?',
  prompt: 'A table is stored <strong>sorted on id</strong>. It has a <strong>sparse index on id</strong>, a <strong>dense index on email</strong>, and a <strong>BRIN index on created_at</strong>. A new row is inserted (its email is new, its created_at is the newest, its id falls in the middle of the file). Explain what has to change in each of the three indices and in the table, and which operation is the most expensive.',
  answerHtml: `<ul>
    <li><strong>Table.</strong> The row must go into the right page by id. If that page is full, rows shift or a new page is allocated (overflow or split of the page), so the table itself is the costly part of keeping a file sorted.</li>
    <li><strong>Sparse index on id.</strong> Only changes if the first key of a page changes or a page is added or removed. Often no change at all.</li>
    <li><strong>Dense index on email.</strong> It has one pair per row, so a new pair must be inserted in sorted position. That can push pairs into the next index page and ripple on, and the upper levels may need new entries too.</li>
    <li><strong>BRIN on created_at.</strong> Only the (min, max) of the table page that received the row may need widening. Because the row has the newest date it only raises the max of that page: cheap.</li></ul>
    <p>Most expensive: keeping the table sorted (shifting rows and splitting pages), then the dense index. Sparse and BRIN indices are small and cheap to maintain. A deletion is the mirror image (remove one pair from the dense index; a BRIN range is not shrunk).</p>`,
  checklist: ['Dense index: one new pair in sorted position, maybe page shifts', 'Sparse index: changes only when page boundaries change', 'BRIN: only widens one (min, max) range', 'Names the table / dense index as the costly parts'],
});

// ---------------- L2 / PA2: B+ trees
const BP = [];
{
  const blk = 4096, kB = 12, pB = 8, n = B.nFromBlock(blk, kB, pB), L = B.limits(n);
  const cap3 = n * (n + 1) ** 2;
  BP.push({
    id: 'bp-n', m: 'pa2', kind: 'calc', topic: 'B+ tree', title: 'Choose n from the block size, then the node limits',
    prompt: `A B+ tree node is one block of <strong>${fx(blk)} bytes</strong> (no header). A key takes <strong>${kB} bytes</strong> and a pointer <strong>${pB} bytes</strong>. A node holds n keys and n + 1 pointers. Find the largest n, then the minimums from the <a href="#/formula">formula sheet</a> table, and the maximum number of keys a tree with 3 levels (root, one non-leaf level, leaves) can index.`,
    answers: [
      { label: 'n', value: n, tol: 0.5 },
      { label: 'Minimum keys in a leaf', value: L.leaf.minKeys, tol: 0.5, unit: 'keys' },
      { label: 'Minimum pointers in a non-leaf (not root)', value: L.nonleaf.minPtrs, tol: 0.5, unit: 'pointers' },
      { label: 'Max keys indexed by a 3-level tree', value: cap3, tol: 0.5, unit: 'keys' },
    ],
    answer: wt(`n keys and n + 1 pointers: ${kB}n + ${pB}(n + 1) ≤ ${blk}  =>  n ≤ (${blk} − ${pB}) / (${kB} + ${pB}) = ${(blk - pB) / (kB + pB)}  =>  n = ${n}
Leaf minimum keys = floor((n + 1) / 2) = floor(${(n + 1) / 2}) = ${L.leaf.minKeys}
Non-leaf minimum pointers = ceil((n + 1) / 2) = ceil(${(n + 1) / 2}) = ${L.nonleaf.minPtrs} (minimum keys ${L.nonleaf.minKeys})
3 levels: root with n + 1 = ${n + 1} children, each with n + 1 children, so ${fx((n + 1) ** 2)} leaves of up to n = ${n} keys: ${fx(cap3)} keys.`),
    why: 'Round n DOWN. The leaf minimum is a floor, the non-leaf minimum number of pointers is a ceiling: the two formulas are not the same, a classic slip.',
  });
}
{
  const t0 = B.fromSpec(3, { k: [10, 20], c: [[2, 5, 8], [10, 14, 17], [20, 25, 29]] });
  const r = bpRun(t0, [['insert', 12], ['insert', 27], ['insert', 6]]);
  BP.push({
    id: 'bp-ins3', m: 'l2', kind: 'build', topic: 'B+ tree', title: 'Insert 12, 27, 6 into an n = 3 tree (leaf split, then root split)',
    prompt: 'Starting from the B+ tree below (<strong>n = 3</strong>), insert <strong>12</strong>, then <strong>27</strong>, then <strong>6</strong> (one after another). Draw the tree after each insertion.',
    data: fig('Start (n = 3)', D.bptreeSVG(t0)),
    why: 'Leaf split: the middle key is <strong>copied</strong> up (it stays in the right leaf). Non-leaf split: the middle key is <strong>moved</strong> up (it leaves both halves). A split that reaches the root makes a new root and the tree grows by one level.',
    answerHtml: bpFigs(r.out), answer: bpWork(r.out),
    checklist: ['12: leaf [10, 12, 14, 17] splits into [10, 12] and [14, 17]; 14 copied up', '27: leaf split, then the parent [10, 14, 20, 27] splits too; 20 MOVES up', 'New root [20]: the tree is now 3 levels', '6: leaf [2, 5, 6, 8] splits; 6 copied up into [6, 10, 14]'],
  });
}
{
  const t0 = B.fromSpec(4, { k: [30, 60, 90, 120], c: [[10, 20], [30, 40], [60, 70], [90, 100], [120, 130, 140, 150]] });
  const r = bpRun(t0, [['insert', 35], ['insert', 125]]);
  BP.push({
    id: 'bp-ins4', m: 'pa2', kind: 'build', topic: 'B+ tree', title: 'n = 4: insert 35 and 125 (the root splits)',
    prompt: 'The B+ tree below has <strong>n = 4</strong>. Insert <strong>35</strong>, then <strong>125</strong>. When a leaf of 5 keys must split, the <strong>left</strong> leaf keeps the extra key. Draw the tree after each insertion.',
    data: fig('Start (n = 4)', D.bptreeSVG(t0)),
    answerHtml: bpFigs(r.out), answer: bpWork(r.out),
    checklist: ['35 fits into [30, 40] (max 4 keys): no split', '125: leaf [120, 125, 130, 140, 150] splits into [120, 125, 130] and [140, 150]', 'Root becomes [30, 60, 90, 120, 140]: 5 keys, so it splits', 'Middle key 90 moves up to a new root; halves [30, 60] and [120, 140]'],
  });
}
{
  const t0 = B.fromSpec(3, { k: [20], c: [{ k: [10], c: [[5, 8], [10, 15]] }, { k: [30], c: [[20, 25], [30, 35, 38]] }] });
  const r = bpRun(t0, [['remove', 25], ['remove', 8]]);
  BP.push({
    id: 'bp-del3', m: 'l2', kind: 'build', topic: 'B+ tree', title: 'Delete 25 then 8 (borrow, then merges and a shorter tree)',
    prompt: 'Starting from this B+ tree (<strong>n = 3</strong>), delete <strong>25</strong>, then <strong>8</strong>. Try to borrow from a sibling first; merge only if you cannot. Draw the tree after each deletion.',
    data: fig('Start (n = 3)', D.bptreeSVG(t0)),
    why: 'Minimums for n = 3: a leaf needs ≥ 2 keys, a non-leaf (not the root) needs ≥ 1 key (2 pointers). A sibling that sits exactly at its minimum cannot lend.',
    answerHtml: bpFigs(r.out), answer: bpWork(r.out),
    checklist: ['25: leaf [20] borrows 30 from the right sibling [30, 35, 38]; separator becomes 35', '8: leaf [5] cannot borrow (the sibling [10, 15] is at the minimum), so it merges into [5, 10, 15]', 'The parent runs out of keys and merges with its sibling, pulling the old separator down', 'The old root is empty, so the tree loses one level'],
  });
}
{
  const t0 = B.fromSpec(4, { k: [40], c: [{ k: [20, 30], c: [[10, 15], [20, 25], [30, 35]] }, { k: [60, 70], c: [[40, 50], [60, 65], [70, 80, 90]] }] });
  const r = bpRun(t0, [['remove', 35], ['remove', 15], ['remove', 50]]);
  BP.push({
    id: 'bp-del4', m: 'pa2', kind: 'build', topic: 'B+ tree', title: 'n = 4: delete 35, 15 and 50',
    prompt: 'The B+ tree below has <strong>n = 4</strong> (leaf minimum 2 keys, non-leaf minimum 2 keys). Delete <strong>35</strong>, then <strong>15</strong>, then <strong>50</strong>. Borrow before merging, trying the left sibling first. Draw the tree after each deletion.',
    data: fig('Start (n = 4)', D.bptreeSVG(t0)),
    answerHtml: bpFigs(r.out), answer: bpWork(r.out),
    checklist: ['35: leaf [30] merges with [20, 25] (the left sibling is at the minimum); the parent then has too few keys and merges with its sibling, the tree gets one level shorter', '15: leaf [10] borrows 20 from its right sibling [20, 25, 30]', '50: [40] merges with the left leaf; the root keeps three keys', 'Checks every leaf still has ≥ 2 keys and all leaves are at the same depth'],
  });
}
{
  const t0 = B.fromSpec(3, { k: [30], c: [{ k: [12, 20], c: [[5, 8], [12, 15], [20, 25, 28]] }, { k: [40], c: [[30, 33], [40, 45, 50]] }] });
  const r = B.remove(t0, 15).tree;
  BP.push({
    id: 'bp-fix-sep', m: 'l2', kind: 'fix', topic: 'B+ tree', title: 'Spot the wrong step: borrowing from a sibling',
    prompt: 'A student deletes 15 from this n = 3 tree. Find the wrong step.',
    data: fig('Start (n = 3)', D.bptreeSVG(t0)),
    code: [
      'Tree: root [30]; left child [12, 20] over leaves [5, 8] [12, 15] [20, 25, 28]; right child [40] over [30, 33] [40, 45, 50]. Delete 15.',
      'Leaf [12, 15] becomes [12]: 1 key, below the leaf minimum of 2, so it underflows.',
      'The left sibling [5, 8] has exactly 2 keys (the minimum), so it cannot lend.',
      'The right sibling [20, 25, 28] has 3 keys, so move its first key 20 over: leaves [12, 20] and [25, 28].',
      'The parent [12, 20] keeps its keys unchanged, because 20 is still a key of the tree.',
      'No node is below its minimum, so we are done.',
    ].join('\n'),
    bugLines: [5],
    answer: wt([
      'Tree: root [30]; left child [12, 20] over leaves [5, 8] [12, 15] [20, 25, 28]; right child [40] over [30, 33] [40, 45, 50]. Delete 15.',
      'Leaf [12, 15] becomes [12]: 1 key, below the leaf minimum of 2, so it underflows.',
      'The left sibling [5, 8] has exactly 2 keys (the minimum), so it cannot lend.',
      'The right sibling [20, 25, 28] has 3 keys, so move its first key 20 over: leaves [12, 20] and [25, 28].',
      `The separator in the parent must become the smallest key of the right leaf: [12, 20] becomes [12, 25].`,
      `No node is below its minimum, so we are done. Result: ${specStr(r)}`,
    ].join('\n')),
    why: 'After redistribution the parent key must be the <strong>smallest key of the subtree on its right</strong>. The leaf [25, 28] now starts with 25, so the parent changes from [12, 20] to [12, 25]. Forgetting this update makes later searches for 20 and 25 go to the wrong leaf.',
  });
}
{
  const t1 = B.insert(B.fromSpec(3, { k: [10, 20], c: [[2, 5, 8], [10, 14, 17], [20, 25, 29]] }), 12).tree, r = B.insert(t1, 27);
  BP.push({
    id: 'bp-fix-copy', m: 'l2', kind: 'fix', topic: 'B+ tree', title: 'Spot the wrong step: copying or moving the middle key',
    prompt: 'A student inserts 27 into this n = 3 tree and the insertion splits two levels. Find the wrong step.',
    data: fig('Start (n = 3)', D.bptreeSVG(t1)),
    code: [
      'Tree: root [10, 14, 20] over leaves [2, 5, 8] [10, 12] [14, 17] [20, 25, 29]. Insert 27.',
      '27 belongs in the last leaf: [20, 25, 27, 29] has 4 keys, more than n = 3, so it splits.',
      'Split the leaf into [20, 25] and [27, 29]; copy 27 up to the parent.',
      'The parent becomes [10, 14, 20, 27]: 4 keys, so the root splits as well.',
      'Split the root into [10, 14] and [20, 27]: the middle key 20 is copied up and also stays in the right half.',
      'Create a new root [20]. The tree has grown by one level.',
    ].join('\n'),
    bugLines: [5],
    answer: wt([
      'Tree: root [10, 14, 20] over leaves [2, 5, 8] [10, 12] [14, 17] [20, 25, 29]. Insert 27.',
      '27 belongs in the last leaf: [20, 25, 27, 29] has 4 keys, more than n = 3, so it splits.',
      'Split the leaf into [20, 25] and [27, 29]; copy 27 up to the parent.',
      'The parent becomes [10, 14, 20, 27]: 4 keys, so the root splits as well.',
      'Split the root into [10, 14] and [27]: the middle key 20 MOVES up and is removed from both halves.',
      `Create a new root [20]. The tree has grown by one level. Result: ${specStr(r.tree)}`,
    ].join('\n')),
    why: 'Only a <strong>leaf</strong> split copies the middle key up (leaves must keep every key, because they are the data). A <strong>non-leaf</strong> split moves the middle key up: it leaves the node. Check by counting pointers: [20, 27] would need 3 children but the split only provides 2 ([20, 25] and [27, 29]).',
  });
}
{
  const r = B.remove(MT3, 21).tree;
  BP.push({
    id: 'bp-fix-sheet', m: 'pa2', kind: 'fix', topic: 'B+ tree', title: 'Spot the wrong step: the 2025 solution sheet for delete 21',
    prompt: 'This is the solution as printed on the 2025 model answer for Exercise 3d (delete 21, n = 3). One conclusion is wrong, because some keys disappear. Find it.',
    data: fig('The tree (n = 3)', D.bptreeSVG(MT3)),
    code: [
      'Delete 21: leaf [20, 21] becomes [20], below the minimum of 2 keys, so it underflows.',
      'It has no left sibling under the same parent. The right sibling [23, 35] has only 2 keys, so it cannot lend.',
      'Merge them into one leaf [20, 23, 35]. The parent [23] loses its only key and is now empty.',
      'The empty parent is simply dropped and the root key is 20, so the left child [7, 12] becomes [7, 20].',
      'Result: root [7, 20] over leaves [1, 3, 5] [7, 9] [20, 23, 35].',
    ].join('\n'),
    bugLines: [4, 5],
    answer: wt([
      'Delete 21: leaf [20, 21] becomes [20], below the minimum of 2 keys, so it underflows.',
      'It has no left sibling under the same parent. The right sibling [23, 35] has only 2 keys, so it cannot lend.',
      'Merge them into one leaf [20, 23, 35]. The parent [23] loses its only key and is now empty (minimum is 1 key).',
      'The empty node borrows through the root from its left sibling [7, 12], which has 2 keys: separator 20 comes down, 12 goes up.',
      `Result: ${specStr(r)}  (all keys kept, including 12 and 14).`,
    ].join('\n')),
    why: 'Count the keys. The tree held 1, 3, 5, 7, 9, 12, 14, 20, 21, 23, 35. After deleting 21 there must be ten keys left, but line 5 only has eight: <strong>12 and 14 are gone</strong> (the leaf [12, 14] vanished). An empty non-leaf must be repaired by <strong>borrowing</strong> from its sibling through the parent (rotation) or merging, never by dropping it. The printed answer sheet makes this mistake; the correct tree is above.',
  });
}
BP.push({
  id: 'bp-explain', m: 'l2', kind: 'explain', topic: 'B+ tree', title: 'Why does a B+ tree stay balanced?',
  prompt: 'In 4 to 6 sentences explain <strong>how</strong> a B+ tree stays balanced under inserts and deletes, and why that gives O(log n) lookups. Mention what happens when the root splits and when the root is left with a single child.',
  answerHtml: `<p>Every leaf is at the same depth, and the only operations that change depth act at the <strong>root</strong>. An insert goes into a leaf; if the leaf overflows it splits and sends one key to its parent. A split that overflows the parent propagates up. Only when the <em>root</em> splits do we create a new root, so the whole tree grows one level at once and all leaves move down together. A delete that underflows a node first borrows from a sibling, otherwise merges with it, and the parent may then underflow in turn. When the root is left with a single child, that child becomes the root and every leaf moves up one level together.</p>
    <p>Since every node (except the root) is at least half full, the fan-out is large (hundreds) and the height is about log<sub>fan-out</sub>(number of keys). A lookup reads one node per level, so it costs O(log n) block reads, and the tree can never become skewed.</p>`,
  checklist: ['Splits and merges propagate up; depth only changes at the root', 'Root split: new root, height + 1', 'Root with one child after a merge: child becomes root, height − 1', 'Nodes at least half full gives large fan-out and logarithmic height'],
});

// ---------------- L3 / PA3: hashing
const HS = [];
{
  const Bk = 4, cap = 2, keys = [8, 13, 5, 21, 6, 12, 17, 9, 32];
  let s = H.staticNew(Bk, cap), logs = [];
  keys.forEach(k => { const r = H.staticInsert(s, k % Bk, k); s = r.state; logs.push(`Insert ${k}: ${k} mod ${Bk} = ${k % Bk}. ${r.steps[0].text}`); });
  const full = s;
  let s2 = H.staticDelete(H.staticDelete(full, 5).state, 17).state;
  const reads = st => { const b = st.buckets[1]; const all = [...b.recs, ...b.over.flat()]; return all.includes(9) ? (b.recs.includes(9) ? 1 : 1 + 1 + b.over.findIndex(o => o.includes(9))) : null; };
  HS.push({
    id: 'hs-static', m: 'pa3', kind: 'build', topic: 'Static hashing', title: 'Static hashing with overflow chains, then deletions',
    prompt: `A static hash table has <strong>${Bk} buckets</strong>, each block holds <strong>${cap} records</strong>, and h(k) = k mod ${Bk}. Insert ${keys.join(', ')} in this order into an empty table (full buckets get overflow blocks chained to them). Then delete <strong>5</strong> and <strong>17</strong> (records from the overflow chain move up to fill gaps). Draw both tables, and say how many block reads are needed to find key 9 at the end.`,
    why: 'Static hashing never changes the number of buckets, so a hot bucket just grows a chain of overflow blocks and lookups in it get slower. That is the weakness extensible and linear hashing fix.',
    answerHtml: side(`<div class="small muted"><strong>After the 9 insertions</strong></div>` + D.staticHashSVG(full), `<div class="small muted"><strong>After deleting 5 and 17</strong></div>` + D.staticHashSVG(s2)) + note(`Key 9 is in bucket 1 (9 mod 4 = 1). At the end bucket 1 holds ${s2.buckets[1].recs.join(', ')} in its primary block and ${s2.buckets[1].over.map(o => o.join(', ')).join(' | ')} in an overflow block, so finding 9 needs <strong>${reads(s2)} block reads</strong>.`),
    answer: wt(logs.join('\n') + `\nDelete 5 and 17 from bucket 1: the overflow records move up.`),
    checklist: ['Bucket 1 receives 13, 5, 21, 17, 9: two blocks of overflow after the primary', 'Buckets 0 gets 8, 12, 32 (one overflow block)', 'Deleting compacts bucket 1', `Reads for key 9 = ${reads(s2)}`],
  });
}
{
  const EXs = H.extNew({ i: 2, cap: 2, buckets: [{ prefix: '00', j: 2, recs: ['0010', '0001'] }, { prefix: '01', j: 2, recs: ['0110'] }, { prefix: '1', j: 1, recs: ['1001', '1011'] }] });
  let cur = EXs; const figs = [], logs = [];
  ['1101', '1110', '0011'].forEach(h => { const r = H.extInsert(cur, h); cur = r.state; figs.push(fig(`After inserting ${h}`, D.extHashSVG(cur))); logs.push(`Insert ${h}:\n` + r.steps.map(x => '  - ' + x.text).join('\n')); });
  HS.push({
    id: 'hs-ext', m: 'l3', kind: 'build', topic: 'Extensible hashing', title: 'Extensible hashing: a split without doubling, then a doubling',
    prompt: 'The extensible hash table below holds <strong>2 records per bucket</strong> and uses the <strong>first i bits</strong> of the hash value. Insert <strong>1101</strong>, then <strong>1110</strong>, then <strong>0011</strong> (one after another). Draw the table after each insertion and label every bucket with its j.',
    data: fig('Start (i = 2)', D.extHashSVG(EXs)),
    why: 'Split rule: if j &lt; i, split the bucket and re-point some directory entries (no doubling). If j = i, first double the directory (i + 1), then split. A bucket with j = 1 in a directory of i = 2 is pointed to by two entries.',
    answerHtml: figs.join(''), answer: wt(logs.join('\n')),
    checklist: ['1101: the 1-bucket is full with j = 1 &lt; i = 2, so it splits WITHOUT doubling (10 and 11 get their own buckets, j = 2)', '1110 joins 1101 in the 11 bucket', '0011: bucket 00 is full with j = i = 2, so the directory doubles to i = 3', 'The split of 00 gives 000 and 001 (j = 3); 01 keeps j = 2 and is pointed to by 010 and 011'],
  });
}
{
  const L0 = H.linNew({ n: 2, cap: 2, buckets: [['0100', '1000'], ['0011', '1111']] });
  let cur = L0; const figs = [], logs = [];
  ['0110', '1010', '0101', '1001'].forEach(h => { const r = H.linInsert(cur, h); cur = r.state; figs.push(fig(`After inserting ${h}`, D.linHashSVG(cur))); logs.push(`Insert ${h}:\n` + r.steps.map(x => '  - ' + x.text).join('\n')); });
  HS.push({
    id: 'hs-lin', m: 'pa3', kind: 'build', topic: 'Linear hashing', title: 'Linear hashing: four insertions, with expansions',
    prompt: 'The linear hash table below holds <strong>2 records per bucket</strong>. It adds a bucket when utilization (records / (buckets × 2)) is <strong>≥ 80%, computed before each insertion</strong>. Bucket numbers use the <strong>last i bits</strong> of the key. Insert <strong>0110, 1010, 0101, 1001</strong> in this order and draw the table after each.',
    data: fig('Start (n = 2, i = 1)', D.linHashSVG(L0)),
    why: 'New bucket n splits bucket n − 2<sup>i−1</sup> (its "twin" with the top bit cleared); only that bucket is re-hashed. i = ⌈log₂ n⌉ grows when n passes a power of two.',
    answerHtml: figs.join(''), answer: wt(logs.join('\n')),
    checklist: ['0110: utilization 4/4 = 100%: add bucket 10, twin is bucket 0; then 0110 goes to bucket 10', '1010: 5/6 = 83% ≥ 80%: add bucket 11 (twin: bucket 1); 1010 ends in 10', '0101: 6/8 = 75% < 80%: no new bucket', '1001: 7/8 = 87.5%: add bucket 100, i grows to 3, twin is bucket 0'],
  });
}
{
  const keys = ['0101', '1010', '0011', '1100', '0110', '1001', '0001', '1110', '0111'];
  let cur = H.linNew({ n: 2, cap: 2 });
  keys.forEach(h => { cur = H.linInsert(cur, h).state; });
  const over = cur.buckets.reduce((a, b) => a + b.over.length, 0), rec = H.linCount(cur);
  HS.push({
    id: 'hs-linutil', m: 'l3', kind: 'calc', topic: 'Linear hashing', title: 'Linear hashing: what does the table look like at the end?',
    prompt: `An empty linear hash table starts with <strong>n = 2 buckets</strong> (i = 1), holds <strong>2 records per bucket</strong> and adds a bucket when utilization before an insertion is <strong>≥ 80%</strong>. Insert ${keys.join(', ')} in this order. Work it out on paper (or step through it in the lecture simulator), then answer.`,
    data: '<p class="small muted">Bucket numbers use the last i bits of the key; a bucket m ≥ n is mapped to m − 2<sup>i−1</sup>.</p>',
    answers: [
      { label: 'Number of buckets n', value: cur.n, tol: 0.5 },
      { label: 'Bits used, i', value: cur.i, tol: 0.5, unit: 'bits' },
      { label: 'Records in overflow blocks', value: over, tol: 0.5, unit: 'records' },
      { label: 'Utilization at the end', value: Math.round(rec / (cur.n * cur.cap) * 1000) / 10, tol: 0.2, unit: '%' },
    ],
    answer: wt(`Final table:\n` + cur.buckets.map((b, i) => `  bucket ${i.toString(2).padStart(cur.i, '0')}: ${b.recs.join(', ') || '(empty)'}${b.over.length ? ' + overflow ' + b.over.join(', ') : ''}`).join('\n') + `\nn = ${cur.n}, i = ceil(log2 ${cur.n}) = ${cur.i}\nRecords = ${rec}; slots in primary buckets = ${cur.n} × ${cur.cap} = ${cur.n * cur.cap}; utilization = ${rec}/${cur.n * cur.cap} = ${pct(rec / (cur.n * cur.cap))}`),
    why: 'Utilization counts all records divided by primary slots only (overflow blocks are not slots). Remember it is checked BEFORE each insertion, so the last key may leave the table above 80% without triggering a new bucket yet.',
  });
}
{
  const L = H.linNew({ n: 3, cap: 2, buckets: [['0000'], ['0001', '1001'], ['0110']] });
  const r = H.linInsert(L, '1011');
  HS.push({
    id: 'hs-fix-bits', m: 'l3', kind: 'fix', topic: 'Linear hashing', title: 'Spot the wrong step: which bits pick the bucket?',
    prompt: 'A student inserts 1011 into this linear hash table (bucket capacity 2, expand at 80%, utilization checked before inserting). Find the wrong step.',
    data: fig('Start (n = 3, i = 2)', D.linHashSVG(L)),
    code: [
      'State: n = 3, i = 2. Buckets: 00 [0000], 01 [0001, 1001], 10 [0110]. Insert 1011.',
      'Utilization before inserting = 4 records / (3 × 2) = 67% < 80%, so no new bucket.',
      'Take the first i = 2 bits of 1011: 10 = 2.',
      '2 < n = 3, so bucket 10 exists and has room: 10 [0110, 1011].',
      'Done.',
    ].join('\n'),
    bugLines: [3],
    answer: wt([
      'State: n = 3, i = 2. Buckets: 00 [0000], 01 [0001, 1001], 10 [0110]. Insert 1011.',
      'Utilization before inserting = 4 records / (3 × 2) = 67% < 80%, so no new bucket.',
      'Take the LAST i = 2 bits of 1011: 11 = 3.',
      '3 ≥ n = 3, so bucket 11 does not exist yet: use 3 − 2^(i−1) = 3 − 2 = 1, bucket 01. It is full, so 1011 goes to an overflow block.',
      `Done. ${r.steps.length ? '' : ''}Final: 00 [0000]; 01 [0001, 1001] + overflow [1011]; 10 [0110].`,
    ].join('\n')),
    why: 'Linear hashing uses the <strong>low-order (last) i bits</strong>, because that is what lets a new bucket n split just one old bucket. Extensible hashing uses the FIRST bits; mixing them up is the most common slip. Line 4 is wrong only because it follows from line 3.',
  });
}
{
  const L = H.linNew({ n: 3, cap: 2, buckets: [['0100'], ['0001', '1001'], ['0110']] });
  const r = H.linInsert(L, '1110');
  HS.push({
    id: 'hs-fix-util', m: 'pa3', kind: 'fix', topic: 'Linear hashing', title: 'Spot the wrong step: when is utilization measured?',
    prompt: 'The rule is: add a bucket when utilization reaches 80%, <strong>computed before the insertion</strong>. Bucket capacity is 2. A student inserts 1110 into this table. Find the wrong step(s).',
    data: fig('Start (n = 3, i = 2)', D.linHashSVG(L)),
    code: [
      'State: n = 3, i = 2. Buckets: 00 [0100], 01 [0001, 1001], 10 [0110]. Insert 1110.',
      'First put 1110 in its bucket: last 2 bits 10 = 2, so bucket 10 becomes [0110, 1110].',
      'Now utilization = 5 records / (3 × 2) = 83% ≥ 80%, so add bucket 11 (n = 4).',
      'Bucket 11 splits bucket 01; re-hash its records. Both end in 01 so nothing moves.',
      'Result: 00 [0100]; 01 [0001, 1001]; 10 [0110, 1110]; 11 [].',
    ].join('\n'),
    bugLines: [2, 3],
    answer: wt([
      'State: n = 3, i = 2. Buckets: 00 [0100], 01 [0001, 1001], 10 [0110]. Insert 1110.',
      'Check utilization BEFORE inserting: 4 records / (3 × 2) = 67% < 80%, so no new bucket.',
      'Last 2 bits of 1110 are 10 = 2 < n = 3, so bucket 10 exists: it becomes [0110, 1110].',
      'Nothing else changes.',
      `Result: ${r.state.buckets.map((b, i) => `${i.toString(2).padStart(2, '0')} [${b.recs.join(', ')}]`).join('; ')}.`,
    ].join('\n')),
    why: 'The 2025 midterm states the rule explicitly: utilization is calculated <strong>before</strong> each insertion. Counting the new record first (lines 2 and 3) gives 83% and a bucket that should not exist. Always: 1) compute records / (n × capacity) from the CURRENT table, 2) expand if ≥ threshold, 3) then insert.',
  });
}
{
  const E0 = H.extNew({ i: 1, cap: 2, buckets: [{ prefix: '0', j: 1, recs: ['0010', '0110'] }, { prefix: '1', j: 1, recs: ['1000'] }] });
  const r = H.extInsert(E0, '0111');
  HS.push({
    id: 'hs-fix-ext', m: 'l3', kind: 'fix', topic: 'Extensible hashing', title: 'Spot the wrong step: j equals i',
    prompt: 'A student inserts 0111 into this extensible hash table (bucket capacity 2). Find the wrong step(s).',
    data: fig('Start (i = 1)', D.extHashSVG(E0)),
    code: [
      'State: i = 1. Entry 0 → [0010, 0110] (j = 1); entry 1 → [1000] (j = 1). Insert 0111.',
      'First bit 0 leads to a full bucket.',
      'j = i = 1, but the directory is already big enough: just split the bucket on its second bit into two buckets with j = 2 and keep i = 1.',
      'Entry 0 now points to both new buckets, [0010] and [0110, 0111], and entry 1 still points to [1000].',
    ].join('\n'),
    bugLines: [3, 4],
    answer: wt([
      'State: i = 1. Entry 0 → [0010, 0110] (j = 1); entry 1 → [1000] (j = 1). Insert 0111.',
      'First bit 0 leads to a full bucket.',
      'j = i = 1, so the directory must double first: i becomes 2 (entries 00, 01, 10, 11); 10 and 11 both still point to [1000].',
      `Split the bucket on its second bit: 00 → [0010] (j = 2) and 01 → [0110, 0111] (j = 2). The 1-bucket keeps j = 1.`,
    ].join('\n')),
    why: 'When <strong>j = i</strong> the bucket already uses every directory bit, so there is no spare entry to give the new bucket. The directory must double (i + 1) before splitting. A directory entry can point to only ONE bucket, so line 4 is impossible. Only when j &lt; i can you split without doubling.',
  });
}
HS.push({
  id: 'hs-explain', m: 'l3', kind: 'explain', topic: 'Extensible hashing', title: 'Choosing a hash index: static, extensible or linear',
  prompt: 'A table of orders starts with 50,000 rows and grows to 5 million over three years. Queries are mostly equality lookups on order_id. Compare <strong>static</strong>, <strong>extensible</strong> and <strong>linear</strong> hashing for this table: how each grows, what a lookup costs, and what the downside is. Recommend one.',
  answerHtml: tbl(['', 'Static', 'Extensible', 'Linear'], [
    ['Number of buckets', 'Fixed forever', 'Grows by splitting one bucket; the directory doubles', 'Grows by one bucket at a time, in order; no directory'],
    ['Growth problem', 'Overflow chains get long, lookups slow down; rebuilding is expensive', 'Directory can get large (2<sup>i</sup> entries); one split may be a big step', 'Overflow blocks stay around until the split pointer reaches them'],
    ['Lookup cost', '1 block + chain length', '1 directory access + 1 bucket (directory usually in memory)', '1 bucket + short overflow chain'],
    ['Bits used', 'whole hash mod B', 'first i bits', 'last i bits'],
  ]) + `<p><strong>Recommendation.</strong> The table grows 100 times, so static hashing would end with long chains unless rebuilt. Extensible hashing keeps lookups at one bucket and grows smoothly, at the price of the directory. Linear hashing needs no directory and grows in small steps but tolerates some overflow. Either dynamic scheme is right; none of them helps range queries (use a B+ tree for those).</p>`,
  checklist: ['Static: fixed buckets, overflow chains degrade lookups', 'Extensible: directory doubling, first bits, j per bucket', 'Linear: n grows one at a time, last bits, utilization threshold, overflow blocks allowed', 'A clear recommendation with a reason; hashing does not support ranges'],
});

// ---------------- L4 / PA4: multidimensional indices
const MD = [];
{
  const lines = { x: [30, 50], y: [40, 70] }, bounds = { x0: 20, x1: 70, y0: 20, y1: 100 };
  const pts = [['A', 25, 35], ['B', 32, 45], ['C', 47, 80], ['D', 55, 60], ['E', 28, 72], ['F', 60, 38], ['G', 40, 55], ['H', 52, 90], ['I', 35, 40]].map(([id, x, y]) => ({ id, x, y }));
  const g = M.gridBuild(lines, pts, 2);
  const area = { x0: 28, x1: 45, y0: 38, y1: 60 };
  const cells = M.gridRangeCells(lines, area.x0, area.x1, area.y0, area.y1);
  const inCells = pts.filter(p => cells.some(([c, r]) => { const [pc, pr] = M.gridCell(lines, p.x, p.y); return pc === c && pr === r; }));
  const hits = pts.filter(p => p.x >= area.x0 && p.x <= area.x1 && p.y >= area.y0 && p.y <= area.y1);
  const rowsHtml = [2, 1, 0].map(r => [`<strong>salary ${r === 0 ? '&lt; 40' : r === 1 ? '40 to 69' : '≥ 70'}</strong>`, ...[0, 1, 2].map(c => (g.cells[c + ',' + r] || []).map(p => `${p.id}(${p.x}, ${p.y})`).join(', ') || '·')]);
  MD.push({
    id: 'md-grid', m: 'l4', kind: 'build', topic: 'Grid', title: 'Grid index: fill the cells, then answer a range query',
    prompt: 'Points are (age, salary in thousands): ' + pts.map(p => `${p.id}(${p.x}, ${p.y})`).join(', ') + '. Build a <strong>grid index</strong> with vertical lines at age 30 and 50 and horizontal lines at salary 40 and 70 (a value on a line belongs to the stripe above/right of it). List the points of every cell. Then for the query <strong>age 28 to 45 and salary 38 to 60</strong>, list the cells you must read and the points that actually qualify.',
    answerHtml: side(D.gridSVG(lines, bounds, pts, { area, xLabel: 'age', yLabel: 'salary' }), tbl(['', 'age &lt; 30', 'age 30 to 49', 'age ≥ 50'], rowsHtml)) +
      note(`The query corners fall in columns 0 to 1 and rows 0 to 1, so <strong>${cells.length} cells</strong> are read: ${cells.map(([c, r]) => `(${c}, ${r})`).join(', ')} (column, row). They contain ${inCells.map(p => p.id).join(', ')}. Only <strong>${hits.map(p => p.id).join(', ')}</strong> truly satisfy both conditions: the grid narrows the search, the points still have to be checked. I(35, 40) sits on the line salary = 40, so it belongs to the row above.`),
    answer: wt(`Cells read: ${cells.map(([c, r]) => `(${c},${r})`).join(' ')}\nPoints in them: ${inCells.map(p => p.id).join(', ')}\nQualifying points: ${hits.map(p => p.id).join(', ')}`),
    checklist: ['Every point placed in the right cell, I(35, 40) in the upper row', 'The 4 cells covering the query rectangle identified', 'Final answer filtered point by point', 'Knows that a grid reads whole cells, so candidates are a superset'],
  });
}
{
  const sizes = [2, 3, 1]; // dept, salary band, city bits
  const hs = sizes.map(w => ({ x: '0'.repeat(w) }));
  const count = vals => M.partBuckets(hs, vals).length;
  MD.push({
    id: 'md-part', m: 'pa4', kind: 'calc', topic: 'Partitioned hashing', title: 'Partitioned hashing: how many buckets must a query read?',
    prompt: 'A partitioned hash index on <strong>(dept, salary_band, city)</strong> uses <strong>2 bits</strong> from dept, <strong>3 bits</strong> from salary_band and <strong>1 bit</strong> from city. Compute the total number of buckets and the number of buckets read by each partial-match query.',
    answers: [
      { label: 'Total buckets', value: count([null, null, null]), tol: 0.5 },
      { label: 'dept = "IT" only', value: count(['x', null, null]), tol: 0.5, unit: 'buckets' },
      { label: 'salary_band = 5 and city = "Cairo"', value: count([null, 'x', 'x']), tol: 0.5, unit: 'buckets' },
      { label: 'city = "Cairo" only', value: count([null, null, 'x']), tol: 0.5, unit: 'buckets' },
      { label: 'all three known', value: count(['x', 'x', 'x']), tol: 0.5, unit: 'bucket' },
    ],
    answer: wt(`Total bits = 2 + 3 + 1 = 6, so 2^6 = ${count([null, null, null])} buckets.\nKnown attributes fix their bits; every unknown bit doubles the buckets to read.\ndept only: unknown bits = 3 + 1 = 4 -> 2^4 = ${count(['x', null, null])}\nsalary + city: unknown bits = 2 -> 2^2 = ${count([null, 'x', 'x'])}\ncity only: unknown bits = 2 + 3 = 5 -> 2^5 = ${count([null, null, 'x'])}\nall known: 1 bucket`),
    why: 'Partitioned hashing handles exact and partial-match queries (fix the known bits, try all unknown ones) but NOT range queries, because hashing destroys order.',
  });
}
{
  const G = (id, a, s) => ({ id, v: [a, s] });
  let kd = M.kdNew(['Age', 'Salary'], 2);
  [G('A', 30, 50), G('B', 45, 80), G('C', 25, 60), G('D', 50, 40)].forEach(r => kd = M.kdInsert(kd, r).tree);
  const f = r => `${r.id} (${r.v[0]}, ${r.v[1]})`;
  const rE = M.kdInsert(kd, G('E', 35, 90)), rG = M.kdInsert(rE.tree, G('G', 28, 55));
  MD.push({
    id: 'md-kd', m: 'pa4', kind: 'build', topic: 'KD-tree', title: 'KD-tree: two insertions that split leaves',
    prompt: 'The KD-tree below indexes (Age, Salary). Levels alternate: <strong>Age</strong> at the root, then <strong>Salary</strong>, and so on. A leaf holds at most <strong>2 rows</strong>. When a leaf is full, split the <strong>3 rows involved</strong> at their <strong>average</strong> on the attribute of that level (values below go left, values ≥ go right). Insert <strong>E(35, 90)</strong>, then <strong>G(28, 55)</strong>, and draw the tree after each.',
    data: fig('Start', D.kdSVG(kd, { fmt: f })),
    answerHtml: fig('After E(35, 90)', D.kdSVG(rE.tree, { fmt: f })) + fig('After G(28, 55)', D.kdSVG(rG.tree, { fmt: f })),
    answer: wt([...rE.steps, ...rG.steps].map((s, i) => `${i + 1}. ${s.text}`).join('\n')),
    checklist: ['E goes right (35 ≥ 33.33) into the full leaf [B, D]; split on SALARY (level 2): average (80 + 40 + 90) / 3 = 70', 'G goes left (28 < 33.33) into the full leaf [A, C]; split on SALARY: average (50 + 60 + 55) / 3 = 55', 'Each new split node is one level deeper than the leaf it replaces'],
  });
}
{
  const pts = [['A', 20, 20], ['B', 30, 35], ['C', 70, 80], ['D', 80, 60], ['E', 25, 30], ['F', 60, 90]].map(([id, x, y]) => ({ id, x, y }));
  let q = M.quadNew({ x0: 0, y0: 0, x1: 100, y1: 100 }, 2); const logs = [];
  pts.forEach(p => { const r = M.quadInsert(q, p); q = r.tree; logs.push(`Insert ${p.id}(${p.x}, ${p.y}):\n` + r.steps.map(s => '  - ' + s.text).join('\n')); });
  MD.push({
    id: 'md-quad', m: 'l4', kind: 'build', topic: 'Quad tree', title: 'Quad tree with 2 points per block',
    prompt: 'Insert the points ' + pts.map(p => `${p.id}(${p.x}, ${p.y})`).join(', ') + ' in this order into an empty quad tree over the square (0, 0) to (100, 100). A block holds at most <strong>2 points</strong>; a block that would hold 3 splits at its centre into NW, NE, SW, SE. Draw the final tree and the plane with its regions.',
    answerHtml: stack(D.quadPlaneSVG(q, { xLabel: 'x', yLabel: 'y' }), D.quadTreeSVG(q)) + note('Splits happen at C (root splits at (50, 50)), at E (the SW square splits at (25, 25)) and at F (the NE square splits at (75, 75)). A point exactly on a centre line goes north / east; state that convention if one of your points lies on a line.'),
    answer: wt(logs.join('\n')),
    checklist: ['Root splits at (50, 50) when C arrives (3 points)', 'SW square splits at (25, 25) when E arrives', 'NE square splits at (75, 75) when F arrives', 'All six points are in leaves with at most 2 points'],
  });
}
{
  const col = ['Red', 'Green', 'Blue', 'Red', 'Blue', 'Green', 'Red', 'Blue', 'Green', 'Red'], siz = ['S', 'M', 'L', 'L', 'S', 'M', 'L', 'M', 'L', 'S'];
  const bc = M.bitmap(col), bs = M.bitmap(siz), get = (m, v) => m.find(x => x.value === v).bits;
  const orRB = M.bitOr(get(bc, 'Red'), get(bc, 'Blue')), res = M.bitAnd(orRB, M.bitNot(get(bs, 'S')));
  const rowsIdx = [...res].map((c, i) => c === '1' ? i + 1 : null).filter(Boolean);
  MD.push({
    id: 'md-bitmap', m: 'l4', kind: 'build', topic: 'Bitmap', title: 'Bitmap indices: build two and combine them with AND, OR, NOT',
    prompt: 'Build bitmap indices on <strong>color</strong> and <strong>size</strong>, then compute the bit vector of <strong>(color = Red OR color = Blue) AND size ≠ S</strong> and list the matching rows.',
    data: tbl(['row', ...col.map((_, i) => i + 1)], [['color', ...col], ['size', ...siz]]),
    answerHtml: tbl(['vector', 'bits'], [...bc.map(b => [`color = ${b.value}`, `<span class="num">${b.bits}</span>`]), ...bs.map(b => [`size = ${b.value}`, `<span class="num">${b.bits}</span>`]), ['Red OR Blue', `<span class="num">${orRB}</span>`], ['NOT (size = S)', `<span class="num">${M.bitNot(get(bs, 'S'))}</span>`], ['<strong>AND of the two</strong>', `<span class="num"><strong>${res}</strong></span>`]]) + note(`Matching rows: <strong>${rowsIdx.join(', ')}</strong> (${rowsIdx.length} rows). Bitmaps answer such combinations with cheap bitwise operations and never touch the table until the final fetch, which is why they suit low-cardinality columns.`),
    answer: wt(`Red  : ${get(bc, 'Red')}\nBlue : ${get(bc, 'Blue')}\nOR   : ${orRB}\nS    : ${get(bs, 'S')}\nNOT S: ${M.bitNot(get(bs, 'S'))}\nAND  : ${res}  -> rows ${rowsIdx.join(', ')}`),
    checklist: ['3 vectors for color and 3 for size, 10 bits each, one 1 per row per attribute', 'OR of Red and Blue, NOT of size S, then AND', `Rows ${rowsIdx.join(', ')}`],
  });
}
MD.push({
  id: 'md-explain', m: 'l4', kind: 'explain', topic: 'Grid', title: 'Which multidimensional index fits each workload?',
  prompt: 'For each workload choose the best index among <strong>grid, KD-tree, quad tree, partitioned hashing, bitmap</strong> and give one reason (and one reason why a close alternative is worse):<br>(a) rectangles on (latitude, longitude) of delivery drivers, which cluster heavily in a few districts;<br>(b) a read-mostly table of orders with columns status (5 values), priority (3 values) and is_gift (2 values), queried with combinations of ANDs and ORs;<br>(c) exact-match or partial-match lookups on (country, product_code, store_id) with no range queries.',
  answerHtml: `<ul><li><strong>(a) Quad tree (or KD-tree).</strong> The data is skewed: a grid has fixed cells, so crowded districts overflow cells while empty areas waste cells. A quad or KD-tree splits only where the data is dense and supports range (rectangle) queries.</li>
    <li><strong>(b) Bitmap.</strong> Few distinct values, read-mostly, and combinations are answered with AND / OR / NOT on bit vectors. A grid or KD-tree is built for ordered numeric ranges, and bitmaps get expensive only for high-cardinality columns or heavy updates.</li>
    <li><strong>(c) Partitioned hashing.</strong> Exact and partial matches are handled by fixing the known attribute bits and trying the unknown ones. It cannot do ranges, but none are needed; it is also the cheapest to keep up to date.</li></ul>`,
  checklist: ['(a) tree-based index because of skew, with the grid weakness named', '(b) bitmap: low cardinality, many AND/OR combinations', '(c) partitioned hashing: no range queries, partial match', 'Each answer has a reason, not just a name'],
});
{
  const G = (id, a, s) => ({ id, v: [a, s] });
  let kd = M.kdNew(['Age', 'Salary'], 2);
  [G('A', 30, 50), G('B', 45, 80), G('C', 25, 60), G('D', 50, 40)].forEach(r => kd = M.kdInsert(kd, r).tree);
  const r = M.kdInsert(kd, G('E', 35, 90));
  const f = x => `${x.id} (${x.v[0]}, ${x.v[1]})`;
  MD.push({
    id: 'md-fix-kd', m: 'l4', kind: 'fix', topic: 'KD-tree', title: 'Spot the wrong step: the KD split value',
    prompt: 'A student inserts E(35, 90) into this KD-tree (Age at level 1, Salary at level 2, leaf capacity 2, split at the average of the 3 rows). Find the wrong step.',
    data: fig('Start', D.kdSVG(kd, { fmt: f })),
    code: [
      'Root is Age 33.33. E has age 35 ≥ 33.33, so go right to the leaf [B(45, 80), D(50, 40)].',
      'The leaf is full (2 rows), so split the 3 rows B, D, E.',
      'This leaf is on level 2, which uses Salary. The three salaries are 80, 40 and 90.',
      'Split value = (80 + 40 + 90) / 2 = 105, because a leaf holds 2 rows.',
      'Rows with salary < 105 go left and the others go right.',
    ].join('\n'),
    bugLines: [4],
    answer: wt([
      'Root is Age 33.33. E has age 35 ≥ 33.33, so go right to the leaf [B(45, 80), D(50, 40)].',
      'The leaf is full (2 rows), so split the 3 rows B, D, E.',
      'This leaf is on level 2, which uses Salary. The three salaries are 80, 40 and 90.',
      'Split value = (80 + 40 + 90) / 3 = 70, the average of the THREE rows being split.',
      'Rows with salary < 70 go left (D) and the others go right (B, E).',
    ].join('\n')),
    why: 'The average is over the 3 rows involved in the split (the 2 in the full leaf plus the new one), so you divide by 3. Dividing by the leaf capacity (2) gives 105, which is above every salary: all three rows would go left and the split would separate nothing.',
  });
}

// ---------------- L5 / PA5: size estimation and logical plans
const CS = [];
const ST = { R: { T: 6000, a: 120, b: 50, c: 3000, min: 10, max: 250 }, S: { T: 9000, c: 4500, d: 300 }, U: { T: 2000, b: 40, c: 1000, e: 100 } };
const stTable = tbl(['R(a, b, c)', 'S(c, d)', 'U(b, c, e)'], [[`T(R) = ${fx(ST.R.T)}`, `T(S) = ${fx(ST.S.T)}`, `T(U) = ${fx(ST.U.T)}`], [`V(R, a) = ${ST.R.a}, min(a) = ${ST.R.min}, max(a) = ${ST.R.max}`, `V(S, c) = ${fx(ST.S.c)}`, `V(U, b) = ${ST.U.b}`], [`V(R, b) = ${ST.R.b}`, `V(S, d) = ${ST.S.d}`, `V(U, c) = ${fx(ST.U.c)}`], [`V(R, c) = ${fx(ST.R.c)}`, '', `V(U, e) = ${ST.U.e}`]]);
{
  const { T, min, max } = ST.R;
  const a = C.rangeSel(T, '>=', 70, min, max), b = C.rangeSel(T, '>', 200, min, max), c = C.rangeSel(T, '<', 40, min, max), d = C.rangeSel(T, '<=', 40, min, max);
  CS.push({
    id: 'cs-range', m: 'pa5', kind: 'calc', topic: 'Size estimation', title: 'Range selections with min and max',
    prompt: 'Use the statistics below. For each selection compute f from Min(a) and Max(a), <strong>cut f to 2 decimals</strong> as the course does, and multiply by T(R).',
    data: stTable,
    answers: [{ label: 'σ a ≥ 70 (R)', value: a.value, tol: 60, unit: 'tuples' }, { label: 'σ a > 200 (R)', value: b.value, tol: 60, unit: 'tuples' }, { label: 'σ a < 40 (R)', value: c.value, tol: 60, unit: 'tuples' }, { label: 'σ a ≤ 40 (R)', value: d.value, tol: 60, unit: 'tuples' }],
    answer: wt([['a ≥ 70', a], ['a > 200', b], ['a < 40', c], ['a ≤ 40', d]].map(([n, r]) => `${n}: ${r.work}`).join('\n')),
    why: 'Memorise the four forms. With max − min + 1 below the line: <strong>a ≥ v</strong>: max − v + 1; <strong>a > v</strong>: max − v; <strong>a ≤ v</strong>: v − min + 1; <strong>a < v</strong>: v − min. A strict inequality drops the +1 because v itself does not count. (If min and max are not given, use T(R) / 3.)',
  });
}
{
  const { T } = ST.R;
  const fa = C.rangeSel(T, '>=', 100, 10, 250).frac;
  const and = C.and(T, [1 / ST.R.b, fa]), lo = C.rangeSel(T, '<', 40, 10, 250), hi = C.rangeSel(T, '>', 200, 10, 250), orv = C.or(T, [lo.frac, hi.frac]), ne = C.neq(T, ST.R.b);
  CS.push({
    id: 'cs-andor', m: 'l5', kind: 'calc', topic: 'Size estimation', title: 'AND, OR and ≠ in a selection',
    prompt: 'Same statistics as before. Estimate the three selections. AND multiplies the fractions, OR adds the two estimated sizes.',
    data: stTable,
    answers: [{ label: 'σ b = 7 AND a ≥ 100 (R)', value: and.value, tol: 2, unit: 'tuples' }, { label: 'σ a < 40 OR a > 200 (R)', value: orv.value, tol: 100, unit: 'tuples' }, { label: 'σ b ≠ 7 (R)', value: ne.value, tol: 125, unit: 'tuples' }],
    answer: wt(`b = 7: f = 1/V(R, b) = 1/${ST.R.b}\na ≥ 100: f = ${fx(fa)}  (cut to 2 decimals)\nAND: ${and.work}\nOR: (a < 40) ${fx(lo.value)} + (a > 200) ${fx(hi.value)}: ${orv.work}\nb ≠ 7: ${ne.work}`),
    why: 'AND: independent conditions, multiply the fractions (the result gets smaller). OR: add the two sizes (the result gets bigger, capped by T(R)). b ≠ 7 is almost the whole table.',
  });
}
{
  const j1 = C.join(ST.R.T, ST.S.T, [[ST.R.c, ST.S.c]]), j2 = C.join(ST.R.T, ST.U.T, [[ST.R.b, ST.U.b], [ST.R.c, ST.U.c]]), p = C.product(ST.R.T, ST.U.T);
  CS.push({
    id: 'cs-join', m: 'pa5', kind: 'calc', topic: 'Size estimation', title: 'Natural joins on one and on two attributes',
    prompt: 'Estimate the sizes. R and S share only <strong>c</strong>. R and U share <strong>b and c</strong> (a natural join matches on both). R × U has no condition.',
    data: stTable,
    answers: [{ label: 'R ⋈ S', value: j1.value, tol: 1, unit: 'tuples' }, { label: 'R ⋈ U', value: j2.value, tol: 0.5, unit: 'tuples' }, { label: 'R × U', value: p.value, tol: 1, unit: 'tuples' }],
    answer: wt(`R ⋈ S on c: ${j1.work}\nR ⋈ U on b and c: ${j2.work}\nR × U: ${p.work}`),
    why: 'For each shared attribute divide by the <strong>larger</strong> of the two V values; with two shared attributes, divide by both maxima. A product has no shared attribute to divide by.',
  });
}
{
  const th = C.thetaJoin(ST.R.T, ST.S.T), dl = C.distinct(ST.S.T), un = C.union(ST.R.T, ST.S.T), it = C.intersect(ST.R.T, ST.S.T), df = C.difference(ST.R.T, ST.U.T);
  CS.push({
    id: 'cs-sets', m: 'l5', kind: 'calc', topic: 'Size estimation', title: 'θ-join, δ and set operations',
    prompt: 'Use the same statistics (treat R and S, R and U as union-compatible bags for the set operations). Estimate: the θ-join <strong>R ⋈<sub>R.a &lt; S.d</sub> S</strong>, <strong>δ(S)</strong>, <strong>R ∪ S</strong> (bag union), <strong>R ∩ S</strong> and <strong>R − U</strong>.',
    data: stTable,
    answers: [{ label: 'R ⋈ a<d S', value: th.value, tol: 1, unit: 'tuples' }, { label: 'δ(S)', value: dl.value, tol: 1, unit: 'tuples' }, { label: 'R ∪ S', value: un.value, tol: 1, unit: 'tuples' }, { label: 'R ∩ S', value: it.value, tol: 1, unit: 'tuples' }, { label: 'R − U', value: df.value, tol: 1, unit: 'tuples' }],
    answer: wt(`θ-join: ${th.work}\nδ(S): ${dl.work}\nR ∪ S: ${un.work}\nR ∩ S: ${it.work}\nR − U: ${df.work}`),
    why: 'Memorise: θ-join (inequality) = product / 3; δ = T / 2; union = sum; intersection = min / 2; difference = (T(R) − T(S)) / 2.',
  });
}
{
  const blk = 4096, hdr = 96, tupB = 200, projB = 16;
  const full = C.blocks({ T: ST.R.T, tupleBytes: tupB, blockBytes: blk, blockHeader: hdr }), proj = C.blocks({ T: ST.R.T, tupleBytes: projB, blockBytes: blk, blockHeader: hdr });
  const sel = C.eq(ST.R.T, ST.R.b), selB = C.blocks({ T: sel.value, tupleBytes: tupB, blockBytes: blk, blockHeader: hdr });
  CS.push({
    id: 'cs-blocks', m: 'pa5', kind: 'calc', topic: 'Size estimation', title: 'Projection and block counts',
    prompt: `R has T(R) = <strong>${fx(ST.R.T)}</strong> tuples of <strong>${tupB} bytes</strong>. Blocks are <strong>${fx(blk)} bytes</strong> with a <strong>${hdr}-byte header</strong>. The projection π<sub>a,b</sub> keeps <strong>${projB} bytes</strong> per tuple (and does not remove duplicates). V(R, b) = ${ST.R.b}.`,
    answers: [{ label: 'Tuples per block of R', value: full.perBlock, tol: 0.5 }, { label: 'Blocks of R', value: full.value, tol: 0.5, unit: 'blocks' }, { label: 'Blocks of π a,b (R)', value: proj.value, tol: 0.5, unit: 'blocks' }, { label: 'Blocks of σ b = 7 (R)', value: selB.value, tol: 0.5, unit: 'blocks' }],
    answer: wt(`R: ${full.work}\nπ a,b(R): same number of tuples (${fx(ST.R.T)}), smaller tuples: ${proj.work}\nσ b = 7: T = ${sel.work}; blocks: ${selB.work}`),
    why: 'A projection does not remove tuples (bag semantics), it only makes each tuple smaller, so it shrinks the number of <strong>blocks</strong> but not T. Subtract the header before dividing, round tuples per block down and blocks up.',
  });
}
{
  const T1 = 6000, T2 = 9000, v1 = 3000, v2 = 4500;
  CS.push({
    id: 'cs-fix-max', m: 'pa5', kind: 'fix', topic: 'Size estimation', title: 'Spot the wrong step: the join denominator',
    prompt: 'A student estimates R ⋈ S on the shared attribute c. Find the wrong step.',
    code: [
      `Given T(R) = ${fx(T1)}, T(S) = ${fx(T2)}, V(R, c) = ${fx(v1)}, V(S, c) = ${fx(v2)}.`,
      'R and S share only c, so this is an equality join: use T(R) × T(S) / (a V value).',
      `Divide by the smaller of the two V values: min(${fx(v1)}, ${fx(v2)}) = ${fx(v1)}.`,
      `T(R ⋈ S) = ${fx(T1)} × ${fx(T2)} / ${fx(v1)} = ${fx(T1 * T2 / v1)}.`,
    ].join('\n'),
    bugLines: [3],
    answer: wt([
      `Given T(R) = ${fx(T1)}, T(S) = ${fx(T2)}, V(R, c) = ${fx(v1)}, V(S, c) = ${fx(v2)}.`,
      'R and S share only c, so this is an equality join: use T(R) × T(S) / (a V value).',
      `Divide by the LARGER of the two V values: max(${fx(v1)}, ${fx(v2)}) = ${fx(v2)}.`,
      `T(R ⋈ S) = ${fx(T1)} × ${fx(T2)} / ${fx(v2)} = ${fx(T1 * T2 / v2)}.`,
    ].join('\n')),
    why: 'The rule is T(R) × T(S) / <strong>max</strong>(V(R, c), V(S, c)). Dividing by the smaller V overestimates (' + fx(T1 * T2 / v1) + ' instead of ' + fx(T1 * T2 / v2) + '). Think: each value of the attribute with fewer distinct values can only match values the bigger side has.',
  });
}
{
  const T = 6000, fb = 1 / 50, fa = C.rangeSel(T, '>=', 100, 10, 250).frac;
  const ok = C.and(T, [fb, fa]);
  CS.push({
    id: 'cs-fix-and', m: 'l5', kind: 'fix', topic: 'Size estimation', title: 'Spot the wrong step: combining two conditions',
    prompt: 'A student estimates σ<sub>b=7 AND a≥100</sub>(R) with T(R) = 6,000, V(R, b) = 50, min(a) = 10, max(a) = 250. Find the wrong step.',
    code: [
      'Condition 1, b = 7: T(R) / V(R, b) = 6,000 / 50 = 120 tuples.',
      `Condition 2, a ≥ 100: f = (250 − 100 + 1) / (250 − 10 + 1) = 151 / 241 = ${fa}, so ${fx(T * fa)} tuples.`,
      `The conditions are joined by AND, so add the two results: 120 + ${fx(T * fa)} = ${fx(120 + T * fa)} tuples.`,
      `Answer: ${fx(120 + T * fa)} tuples.`,
    ].join('\n'),
    bugLines: [3],
    answer: wt([
      'Condition 1, b = 7: T(R) / V(R, b) = 6,000 / 50 = 120 tuples (f = 1/50 = 0.02).',
      `Condition 2, a ≥ 100: f = (250 − 100 + 1) / (250 − 10 + 1) = 151 / 241 = ${fa}, so ${fx(T * fa)} tuples.`,
      `AND means both must hold: multiply the fractions: ${ok.work}.`,
      `Answer: ${fx(ok.value)} tuples.`,
    ].join('\n')),
    why: 'AND multiplies the fractions: T(R) × f1 × f2. Adding is the rule for <strong>OR</strong>. Sanity check: an AND can never return more tuples than its more selective condition alone (here 120).',
  });
}
{
  CS.push({
    id: 'cs-fix-delta', m: 'l5', kind: 'fix', topic: 'Logical plans', title: 'Spot the wrong step: pushing δ below a projection',
    prompt: 'A student wants to speed up δ(π<sub>b</sub>(R)) (the distinct values of b), where R has 6,000 tuples and V(R, b) = 50. Find the wrong step(s).',
    code: [
      'Plan 1: δ(π b (R)): project b first, then remove duplicates.',
      'To shrink the input early, push δ down: δ(π b (R)) = π b (δ(R)), because δ just removes duplicates.',
      'Plan 2: π b (δ(R)): δ(R) halves R to about 3,000 tuples, then π b keeps 3,000 tuples.',
      'Plan 2 is cheaper, since removing duplicates early means fewer rows are processed later.',
    ].join('\n'),
    bugLines: [2, 4],
    answer: wt([
      'Plan 1: δ(π b (R)): project b first, then remove duplicates.',
      'δ cannot be pushed below π: δ(π b (R)) ≠ π b (δ(R)). δ(R) removes only rows that are identical in ALL attributes.',
      'π b (δ(R)) still has many rows with the same b (a bag projection keeps duplicates), so it is not a duplicate-free list of b values.',
      'Keep δ above π. (π b (δ(R)) is simply a different query.)',
    ].join('\n')),
    why: 'δ and π do not commute under bag semantics. Two rows can differ in another attribute, survive δ(R), and then become identical after π<sub>b</sub>. The result of π<sub>b</sub>(δ(R)) would still contain duplicates of b, so the two plans are <strong>not equivalent</strong> and the "cheaper" claim is meaningless.',
  });
}
{
  const stats = { R: { T: 10000, V: { a: 10, b: 100, c: 500 } }, S: { T: 8000, V: { c: 250, d: 20 } } };
  const rel = n => ({ op: 'rel', name: n }), sel = (attr, val, inn) => ({ op: 'select', cond: { attr, cmp: '=', val }, in: inn });
  const pA = { op: 'project', attrs: ['a', 'd'], in: sel('d', 5, sel('a', 10, { op: 'join', on: ['c'], l: rel('R'), r: rel('S') })) };
  const pB = { op: 'project', attrs: ['a', 'd'], in: { op: 'join', on: ['c'], l: sel('a', 10, rel('R')), r: sel('d', 5, rel('S')) } };
  const eA = C.estimate(pA, stats), eB = C.estimate(pB, stats), cA = C.planCost(eA), cB = C.planCost(eB);
  const stT = tbl(['R(a, b, c)', 'S(c, d)'], [[`T(R) = ${fx(10000)}`, `T(S) = ${fx(8000)}`], ['V(R, a) = 10', 'V(S, c) = 250'], ['V(R, c) = 500', 'V(S, d) = 20']]);
  CS.push({
    id: 'lp-push', m: 'l5', kind: 'build', topic: 'Logical plans', title: 'Push the selections down and compare the two plans',
    prompt: 'Expression: <strong>π<sub>a,d</sub>(σ<sub>d=5</sub>(σ<sub>a=10</sub>(R ⋈ S)))</strong> with the statistics below. Draw <strong>Plan A</strong> (as written) and <strong>Plan B</strong> (each selection pushed to the relation it mentions, using the <a href="#/formula">formula sheet</a>), annotate every operator with its estimated size, and give the cost of each plan as the <strong>sum of the intermediate results</strong> (not the base tables and not the final result). Which plan do you run?',
    data: stT,
    why: 'The final result has the same size in both plans (equivalent plans), so only the <strong>intermediate</strong> sizes differ. Selections shrink data, so do them first; the join, which can blow up, then sees small inputs.',
    answerHtml: side(`<div class="small muted"><strong>Plan A</strong> cost = ${cA.parts.map(fx).join(' + ')} = ${fx(cA.value)}</div>` + D.planSVG(eA), `<div class="small muted"><strong>Plan B</strong> cost = ${cB.parts.map(fx).join(' + ')} = ${fx(cB.value)}</div>` + D.planSVG(eB)) +
      note(`Both end with ${fx(eA.T)} tuples. Plan A builds a ${fx(eA.in.in.in.T)}-tuple join first (${eA.in.in.in.work}). Plan B filters R to ${fx(eB.in.l.T)} and S to ${fx(eB.in.r.T)} first, so its join is tiny. Run <strong>Plan B</strong> (${fx(cB.value)} vs ${fx(cA.value)}).`),
    answer: wt(`Plan A:\n  R ⋈ S: ${eA.in.in.in.work}\n  σ a=10: ${eA.in.in.work}\n  σ d=5: ${eA.in.work}\n  cost = ${cA.parts.map(fx).join(' + ')} = ${fx(cA.value)}\nPlan B:\n  σ a=10 (R): ${eB.in.l.work}\n  σ d=5 (S): ${eB.in.r.work}\n  join: ${eB.in.work}\n  cost = ${cB.parts.map(fx).join(' + ')} = ${fx(cB.value)}`),
    checklist: ['Plan B: σ a=10 on R and σ d=5 on S below the join', 'Sizes: join 160,000 (plan A) vs 1,000 and 400 (plan B)', 'Both plans return the same number of tuples', 'Costs 176,800 vs 2,200 and a choice of Plan B'],
  });
  const stats2 = { R: { T: 40000, V: { a: 20, b: 200 } }, S: { T: 6000, V: { b: 100, c: 30 } } };
  const selA = { op: 'select', cond: { attr: 'a', cmp: '=', val: 5 }, in: rel('R') };
  const pA2 = { op: 'join', on: ['b'], l: { op: 'distinct', in: selA }, r: { op: 'distinct', in: rel('S') } };
  const pB2 = { op: 'distinct', in: { op: 'join', on: ['b'], l: selA, r: rel('S') } };
  const e1 = C.estimate(pA2, stats2), e2 = C.estimate(pB2, stats2), c1 = C.planCost(e1), c2 = C.planCost(e2);
  CS.push({
    id: 'lp-delta', m: 'pa5', kind: 'calc', topic: 'Logical plans', title: 'Two plans with δ: compare sizes and costs',
    prompt: 'Statistics: T(R) = 40,000, V(R, a) = 20, V(R, b) = 200; T(S) = 6,000, V(S, b) = 100, V(S, c) = 30. Two plans for the same query:<br><strong>Plan 1:</strong> δ(σ<sub>a=5</sub>(R)) ⋈<sub>b</sub> δ(S)<br><strong>Plan 2:</strong> δ(σ<sub>a=5</sub>(R) ⋈<sub>b</sub> S)<br>Estimate the size of the final result and the cost (sum of the sizes of intermediate results, excluding base tables and the final result) of each.',
    data: side(`<div class="small muted"><strong>Plan 1</strong></div>` + D.planSVG(e1), `<div class="small muted"><strong>Plan 2</strong></div>` + D.planSVG(e2)),
    answers: [{ label: 'Plan 1: final size', value: e1.T, tol: 1, unit: 'tuples' }, { label: 'Plan 1: cost', value: c1.value, tol: 1 }, { label: 'Plan 2: final size', value: e2.T, tol: 1, unit: 'tuples' }, { label: 'Plan 2: cost', value: c2.value, tol: 1 }],
    answer: wt(`Plan 1: σ a=5: ${e1.l.in.work}\n  δ: ${e1.l.work}\n  δ(S): ${e1.r.work}\n  join: ${e1.work}\n  cost = ${c1.parts.map(fx).join(' + ')} = ${fx(c1.value)}\nPlan 2: σ a=5: ${e2.in.l.work}\n  join: ${e2.in.work}\n  δ (final): ${e2.work}\n  cost = ${c2.parts.map(fx).join(' + ')} = ${fx(c2.value)}`),
    why: 'The two final estimates differ although the plans are "the same query": the δ rule (T / 2) is only a rough guess, so estimates depend on where δ sits. Plan 1 is cheaper because it removes duplicates early, before the join multiplies rows. A smaller intermediate size is what the planner tries to reach.',
  });
}
CS.push({
  id: 'lp-explain', m: 'l5', kind: 'explain', topic: 'Logical plans', title: 'Which rewrites are valid?',
  prompt: 'For each claim say whether the rewrite is valid and, if it is, whether it usually makes the plan cheaper.<br>(a) σ<sub>p∧q</sub>(R) = σ<sub>p</sub>(σ<sub>q</sub>(R))<br>(b) σ<sub>p</sub>(R ⋈ S) = σ<sub>p</sub>(R) ⋈ S, where p mentions only attributes of R<br>(c) σ<sub>p</sub>(R ⋈ S) = σ<sub>p</sub>(R) ⋈ S, where p mentions an attribute of S<br>(d) δ(π<sub>L</sub>(R)) = π<sub>L</sub>(δ(R))<br>(e) R ⋈ S = S ⋈ R, and (R ⋈ S) ⋈ U = R ⋈ (S ⋈ U) (join order)',
  answerHtml: tbl(['', 'Valid?', 'Cheaper?'], [
    ['(a)', 'Yes (cascade of selections, in any order)', 'Lets you push each condition to a different relation, then it is cheaper'],
    ['(b)', 'Yes', 'Yes: the join input shrinks before the join'],
    ['(c)', '<strong>No</strong>: R has no attribute of p, so σ<sub>p</sub>(R) is not even defined', 'Not applicable: push it to S instead'],
    ['(d)', '<strong>No</strong> under bag semantics: π keeps duplicates, so π<sub>L</sub>(δ(R)) can still have duplicates', 'Irrelevant: the plans are different queries'],
    ['(e)', 'Yes (commutative and associative)', 'The <strong>order</strong> is what matters for cost: join the pair with the smallest estimated result first'],
  ]) + '<p>The formula sheet lists the rules but does not say which side is better; the usual guidance is <em>push selections and projections down, and join the small results first</em>.</p>',
  checklist: ['(a), (b), (e) valid; (c), (d) not valid', 'Gives the reason for (c): attribute scope; for (d): bag duplicates', 'Says that validity and cost are separate questions', 'Push selections down, smallest join first'],
});

// ============================================================ the lab, in course order (Midterm 2025 block first)
export const CODE = [...MID, ...CONV, ...BP, ...HS, ...MD, ...CS];
