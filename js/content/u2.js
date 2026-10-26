import { K, T, W, terms, compare, steps, code, table } from './helpers.js';
import * as B from '../engine/bptree.js';
import * as D from '../engine/draw.js';

// ============================================================ shared specs (also used by the simulators)
export const SPEC = {
  L13: { k: [13], c: [{ k: [7], c: [[2, 3, 5], [7, 11]] }, { k: [23, 31, 43], c: [[13, 17, 19], [23, 29], [31, 37, 41], [43, 47]] }] },
  ROOTOV: { k: [10, 20, 30], c: [[1, 2, 3], [10, 12], [20, 25], [30, 32, 40]] },
  T50: { k: [10, 40, 100], c: [[1, 5], [10, 20, 30], [40, 50], [100, 110]] },
  NL37: { k: [25], c: [{ k: [10, 20], c: [[1, 3], [10, 14], [20, 22]] }, { k: [30, 40], c: [[25, 26], [30, 37], [40, 45]] }] },
  P21: { k: [17], c: [{ k: [7], c: [[2, 3, 5], [7, 13]] }, { k: [37, 43], c: [[17, 18, 36], [37, 38], [43, 47, 49]] }] },
  F22: { k: [23], c: [{ k: [8], c: [{ k: [5], c: [[1, 2], [5, 7]] }, { k: [12], c: [[8, 9], [12, 18]] }] }, { k: [28], c: [{ k: [24], c: [[23], [24]] }, { k: [40], c: [[28], [40, 48]] }] }] },
  P24: { k: [65], c: [{ k: [14, 23], c: [[1, 2, 4], [14, 16], [23, 32, 40]] }, { k: [67, 80, 120], c: [[65, 66], [67, 68], [80, 90, 100], [120, 200, 220]] }] },
  MT: { k: [20], c: [{ k: [7, 12], c: [[1, 3, 5], [7, 9], [12, 14]] }, { k: [23], c: [[20, 21], [23, 35]] }] },
  MT21_OFFICIAL: { k: [7, 20], c: [[1, 3, 5], [7, 9], [20, 23, 35]] },
};
export const KEYS22 = [12, 8, 1, 23, 5, 7, 2, 28, 9, 18, 24, 40, 48];
export const KEYS25 = [2, 3, 5, 7, 11, 17, 19, 23, 29, 31];

// ============================================================ engine helpers (every number below comes from the engine)
const mkT = (n, spec, o) => B.fromSpec(n, spec, o);
const ins = (t, ...ks) => ks.reduce((a, k) => B.insert(a, k).tree, t);
const del = (t, ...ks) => ks.reduce((a, k) => B.remove(a, k).tree, t);
const ks = a => '[' + a.join(', ') + ']';
const rootKeys = t => ks(t.root.keys);
const leafStr = t => B.leaves(t).map(l => ks(l.keys)).join(' ');
const wrap = (t, extra = '') => `<div style="overflow-x:auto">${D.bptreeSVG(t, extra)}</div>`;
const svgW = s => { const m = s.match(/viewBox="0 0 ([\d.]+)/); return m ? +m[1] : 300; };
const fig = (t, cap, hl) => {
  const s = D.bptreeSVG(t, { hl: hl || [] }), w = svgW(s);
  return `<div style="flex:1 1 ${Math.min(Math.round(w) + 34, 600)}px;min-width:0;max-width:100%;overflow-x:auto;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--surface)"><div style="min-width:${Math.round(w * 0.82)}px">${s}</div>${cap ? `<div class="small muted" style="margin-top:6px">${cap}</div>` : ''}</div>`;
};
const row = (...items) => `<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;margin:14px 0">${items.join('')}</div>`;
const sf = (res, i, cap) => fig(res.steps[i].tree, cap, res.steps[i].hl);
const last = res => res.steps.length - 1;
const tags = steps_ => {
  const out = [];
  steps_.forEach(s => {
    if (/^Redistribute/.test(s.text)) out.push('leaf borrow');
    else if (/^Non-leaf redistribution/.test(s.text)) out.push('non-leaf borrow');
    else if (/^Merge/.test(s.text)) out.push(/separator \d+ comes down/.test(s.text) ? 'non-leaf merge' : 'leaf merge');
    else if (/shrinks one level/.test(s.text)) out.push('tree shrinks');
    else if (/^The tree was empty|become/.test(s.text)) out.push('new root');
    else if (/Split the leaf/.test(s.text)) out.push('leaf split');
    else if (/^Split it/.test(s.text)) out.push('non-leaf split');
    else if (/new root/.test(s.text)) out.push('tree grows');
  });
  return out.length ? out.join(', ') : 'no restructuring';
};
const opSeq = (t0, ops) => { let cur = t0; return ops.map(([op, k]) => { const r = op === 'insert' ? B.insert(cur, k) : B.remove(cur, k); cur = r.tree; return { op, k, tree: cur, steps: r.steps }; }); };
const seqFigs = (t0, ops) => row(...opSeq(t0, ops).map(r => fig(r.tree, `<strong>${r.op} ${r.k}</strong>: ${tags(r.steps)}`, r.steps[r.steps.length - 1].hl)));

// ============================================================ trees used in the notes
const L13 = mkT(3, SPEC.L13), ROOTOV = mkT(3, SPEC.ROOTOV), T50 = mkT(4, SPEC.T50), NL37 = mkT(4, SPEC.NL37);
const P21 = mkT(3, SPEC.P21), MT = mkT(3, SPEC.MT);
const P24 = mkT(4, SPEC.P24, { siblings: 'left' });
const F22 = mkT(2, SPEC.F22, { leafSplit: 'right' });
const r12 = B.insert(L13, 12), r40 = B.insert(L13, 40), r45 = B.insert(ROOTOV, 45);
const d37 = B.remove(L13, 37), d7 = B.remove(L13, 7), d7_11 = B.remove(d7.tree, 11);
const d50 = B.remove(T50, 50), d50m = B.remove(mkT(4, SPEC.T50, { mergeFirst: true }), 50), dNL = B.remove(NL37, 37);
const lim = n => B.limits(n);
const limRows = [2, 3, 4, 5, 6, 340].map(n => { const l = lim(n); return [`<strong>${n}</strong>`, l.leaf.minKeys, l.leaf.minPtrs, l.nonleaf.minKeys, l.nonleaf.minPtrs, l.root.minKeys + ' / ' + l.root.minPtrs, n + ' / ' + (n + 1)]; });
const fmtN = x => x.toLocaleString('en-US');
const maxKeys340h3 = 341 * 341 * 340;

// ============================================================ LECTURE 2
export const lecture = {
  id: 'l2', kind: 'lecture', num: 'L2', icon: 'tree-structure',
  title: 'Lecture 2: B+ Tree Index', navTitle: 'B+ Tree Index', mapLabel: 'B+ tree',
  short: 'How a balanced tree of index pages keeps lookups, inserts and deletes at O(log n), and the exact rules for splitting, borrowing and merging nodes.',
  goals: [
    'Explain why a multilevel index becomes a tree, and why a B+ tree is PostgreSQL\'s default index.',
    'Compute n from a block size, and fill in the minimum/maximum keys and pointers of root, non-leaf and leaf nodes (formula sheet).',
    'Look up a key and a key range, and count the nodes accessed.',
    'Insert a key, including leaf splits, non-leaf splits and a new root, and know which key is copied up and which is moved up.',
    'Delete a key using borrow (redistribute) first and merge (coalesce) second, and recognise when the height shrinks.',
    'Say when a B+ tree is the right index (exact, range, aggregate) and what the clustering column has to do with it.',
  ],
  sections: [
    { id: 'multilevel', title: 'Recap: why a multilevel index', body: `<div class="prose">
<p>A <strong>multilevel index</strong> is an index built on top of another index. The "why" is in the lecture's example: a table of <span class="num">1,000,000</span> rows, 10 rows per table page, 100 pointer-pairs per index page. We want the primary index to fit in main memory, but memory holds only <strong>one page</strong>.</p>
<p>Work from the bottom up. Each level is the index of the level below it.</p></div>
${table(['Level', 'What it points to', 'Entries', 'Pages (100 per page)'], [
  ['Table data file', 'the rows', '1,000,000 rows', '1,000,000 / 10 = <strong>100,000</strong> pages'],
  ['Index level 2 (lowest)', 'one pair per table page', '100,000', '100,000 / 100 = <strong>1,000</strong> pages'],
  ['Index level 1', 'one pair per level-2 page', '1,000', '1,000 / 100 = <strong>10</strong> pages'],
  ['Index level 0 (top)', 'one pair per level-1 page', '10', '10 / 100 = <strong>1</strong> page, fits in memory'],
])}
<div class="prose"><p>So we keep level 0 in memory and each lookup reads one page per remaining level: level 1, level 2, then the table page. The number of levels grows like log<sub>100</sub> of the table size, which is why a lookup stays cheap even for a million rows.</p></div>
${K('Each index level shrinks by the fan-out (here 100). Keep adding levels until the top level is one page. That page is the <strong>root</strong>.')}` },

    { id: 'tree-shape', title: 'From levels to a tree, and the CRUD table', body: `<div class="prose">
<p>Draw the same structure rotated: level 0 on top, every page pointing to the pages below it. It is a <strong>tree</strong> (the slide shows it as "View 1" and "View 2" of the same file structure). A B+ tree is exactly this idea, plus rules that keep it balanced while rows are inserted and deleted.</p>
<p>The reason for the extra rules is update cost. A conventional (single-level, sorted) index must shift entries when you insert or delete, so those cost O(n). A tree only touches one path from root to leaf.</p></div>
${table(['Operation', 'Conventional index', 'B+ tree'], [['Read', 'O(log n)', 'O(log n)'], ['Insert', 'O(n)', 'O(log n)'], ['Update', 'O(n)', 'O(log n)'], ['Delete', 'O(n)', 'O(log n)']])}
<div class="prose"><p>The B+ tree is not the fastest at any single operation, but it has <strong>stable, moderate performance on all of them</strong>. That is why it is the <strong>default index type in PostgreSQL</strong>.</p></div>
${T('Reads are O(log n) for both. The B+ tree wins on <em>insert, update and delete</em>, not on reads.')}` },

    { id: 'balance-n', title: 'Balance and the parameter n', body: `<div class="prose">
<p>A B+ tree is <strong>balanced</strong>: all paths from the root to a leaf have the same length. Usually there are three layers (root, intermediate, leaves) but any number is possible. Balance is what keeps the cost at O(log n). A normal binary search tree can become <strong>skewed</strong> (a chain), and then a lookup is O(n).</p>
<p>How does the B+ tree stay balanced? Rule (1): there is a parameter <strong>n</strong> for the whole index. Every block has room for <strong>n search keys and n + 1 pointers</strong>. It is the conventional index block plus one extra pointer.</p></div>
${terms([
  ['key', 'n keys', 'Search-key values, sorted inside the node.'],
  ['arrow-right', 'n + 1 pointers', 'In a leaf: n pointers to records plus 1 pointer to the next leaf. In a non-leaf: n + 1 pointers to child nodes.'],
])}
<div class="prose"><h4>Computing n from the block size</h4>
<p>Rule (2): n depends on the block (page) size. A node must fit in one block.</p>
<p><strong>Lecture example:</strong> block 4096 bytes, key 4 bytes, pointer 8 bytes, no header.</p></div>
${code(`4n + 8(n + 1) <= 4096
12n + 8 <= 4096
12n <= 4088
n <= 340.67   ->   n = 340`, 'lecture slides 11-14')}
<div class="prose"><p><strong>General formula</strong> for block size <em>b</em>, key size <em>k</em>, pointer size <em>p</em> and header size <em>h</em>:</p></div>
${code(`k*n + p*(n + 1) + h <= b     =>     n = floor( (b - h - p) / (k + p) )`)}
<div class="prose"><p>Check: 8192-byte block, 8-byte keys and pointers, no header: n = ⌊(8192 − 8) / 16⌋ = ⌊511.5⌋ = <strong>511</strong>. Round <strong>down</strong>: a node that does not fit is not allowed. Use the <em>n calculator</em> below the next section to try your own numbers.</p></div>
${T('There are <strong>n + 1</strong> pointers, not n. Forgetting the extra pointer gives 4096/12 = 341, which does not fit (12 × 341 + 8 = 4100 &gt; 4096).')}` },

    { id: 'node-rules', title: 'Node structure and the threshold table', body: `<div class="prose">
<p>Rules (3) to (5) say how full each kind of node must stay. Full nodes waste no space and half-full nodes keep the tree shallow and make updates rare.</p></div>
${terms([
  ['leaf', 'Leaf node', 'Its keys are <strong>copies</strong> of keys of the data file, sorted left to right across all leaves. Pointers 1..n go to records. The <strong>last pointer goes to the next leaf</strong>. Minimum pointers: <strong>⌊(n+1)/2⌋ + 1</strong> (so at least ⌊(n+1)/2⌋ keys).'],
  ['git-fork', 'Non-leaf (interior) node', 'All n + 1 pointers point to nodes one level down. At least <strong>⌈(n+1)/2⌉</strong> pointers are used, so at least ⌈(n+1)/2⌉ − 1 keys.'],
  ['tree', 'Root', 'At least <strong>2 used pointers</strong> (1 key). Exception: a tree with a single leaf. Then the root is also the leaf and may hold just 1 key and 1 pointer.'],
])}
<div class="prose"><p>Put together, this is the <strong>threshold table</strong>. It is printed on the <a href="#/formula">formula sheet</a> in the exam, but you must know how to <em>use</em> it (and recompute it for a new n quickly).</p></div>
${table(['Node type', 'Max keys', 'Max pointers', 'Min keys', 'Min pointers'], [
  ['Root', 'n', 'n + 1', '1', '1 (2 if the tree has more than one node)'],
  ['Non-leaf', 'n', 'n + 1', '⌈(n+1)/2⌉ − 1', '⌈(n+1)/2⌉'],
  ['Leaf', 'n', 'n + 1', '⌊(n+1)/2⌋', '⌊(n+1)/2⌋ + 1'],
])}
<div class="prose"><p>Values for common n (from the engine):</p></div>
${table(['n', 'Leaf min keys', 'Leaf min ptrs', 'Non-leaf min keys', 'Non-leaf min ptrs', 'Root min keys / ptrs', 'Max keys / ptrs'], limRows)}
${T('Odd and even n behave differently. For <strong>n = 3</strong> a leaf needs 2 keys but a non-leaf needs only 1 key. For <strong>n = 4</strong> both need 2 keys. The leaf pointer count includes the next-leaf pointer, so the leaf <em>key</em> minimum is the <em>pointer</em> minimum minus 1.')}
<div class="prose"><h4>The lecture's example tree (n = 3)</h4>
<p>"(1) What is n? (2) What are the minimum and maximum keys and pointers?" Count the slots of any node: three keys, four pointers, so <strong>n = 3</strong>. Then: leaf min keys 2 and min pointers 3; non-leaf min keys 1 and min pointers 2; max keys 3 and max pointers 4.</p></div>
${row(fig(L13, 'The lecture tree, n = 3. Used again in the examples below.'))}
${W('u2Limits')}
<div class="prose"><h4>Why the minimums guarantee a shallow tree</h4>
<p>Every non-leaf has at least ⌈(n+1)/2⌉ children, so the tree fans out by at least that factor at each level. With n = 340 every non-leaf has at least 171 children and at most 341. The maximum number of keys in a tree of height 3 (root, one non-leaf level, leaves) is 341 × 341 × 340 = <span class="num">${fmtN(maxKeys340h3)}</span>. So 1 million keys fit in a tree with <strong>3 or fewer levels</strong>. The height range for your own numbers is in the calculator above.</p></div>` },

    { id: 'lookup', title: 'Lookup and range search', body: `<div class="prose">
<p><strong>Exact lookup.</strong> Start at the root. In each non-leaf, find the pointer whose key range contains the search key: follow pointer <em>i</em> when key<sub>i−1</sub> ≤ search key &lt; key<sub>i</sub>. Equal to a separator goes <strong>right</strong>. At the leaf, scan for the key. Cost: one node per level, so the <strong>height</strong> of the tree.</p>
<p><strong>Lecture example:</strong> look up 37 in the lecture tree. Root [13]: 37 ≥ 13, take the last pointer. Node [23, 31, 43]: 31 ≤ 37 &lt; 43, take the third pointer. Leaf [31, 37, 41]: found. That is <strong>3 B+ tree nodes accessed</strong> (plus one data page for the record).</p></div>
${row(fig(L13, 'Lookup of 37: root, then [23, 31, 43], then leaf [31, 37, 41].', [...B.search(L13, 37).path]))}
<div class="prose"><p><strong>Range lookup.</strong> Descend once to the leaf holding the lower bound, then follow the <strong>next-leaf pointers</strong> until you pass the upper bound. This is what the conventional index cannot do as cheaply, and why the last pointer of every leaf matters. A "less than" search starts at the leftmost leaf, a "greater than" search ends at the last leaf.</p></div>
${T('A range search does <strong>not</strong> go back up to the root between leaves. It descends once and then walks the leaf chain.')}
${W('u2Search')}` },

    { id: 'insertion', title: 'Insertion', body: `<div class="prose"><h4>The steps (slide 22)</h4></div>
${steps([
  ['1. Know your structure', 'Find n and write down the min and max keys and pointers for leaf and non-leaf nodes.'],
  ['2. Insert into the right leaf', 'Descend to the leaf where the key belongs. If there is room (at most n keys), insert it in order. Done.'],
  ['3. No room: split the leaf', 'The leaf now has n + 1 keys. Split it into two nodes and divide the keys between them.'],
  ['4. Insert upward', 'The split looks to the level above like a new key-pointer pair to insert there. If the parent has room, insert it. If not, split the parent and continue up.'],
  ['5. Root exception', 'If the root has no room, split it and create a <strong>new root</strong> on top. This is the only way the tree gets taller.'],
])}
<div class="prose"><h4>Copy up or move up?</h4>
<ul><li><strong>Leaf split: copy up.</strong> The first key of the new right leaf is <em>copied</em> to the parent. It must stay in the leaf too, because every key (and its record pointer) lives in a leaf.</li>
<li><strong>Non-leaf split: move up.</strong> The middle key is <em>moved</em> to the parent and removed from both halves. A non-leaf key is only a signpost, it does not need to appear twice.</li></ul>
<p>When a leaf of n + 1 keys cannot be split evenly (n + 1 is odd), one half gets the extra key. The lecture figures give it to the <strong>left</strong> leaf. Both conventions are valid, so in the exam follow the rule the question states (PA2-2 and PA2-4 differ, see the practice assignment).</p></div>
${T('Mixing up copy and move is the most common insertion mistake. If you <em>move</em> a key out of a leaf, the key (and its record) disappears from the leaf level.')}
<div class="prose"><h4>Example 1: simple insertion, insert 12</h4>
<p>12 belongs in leaf [7, 11], which has room (it has 2 of 3 keys). Nothing else changes.</p></div>
${row(fig(L13, 'Original'), sf(r12, 0, 'After inserting 12'))}
<div class="prose"><h4>Example 2: leaf overflow that propagates, insert 40</h4>
<p>40 goes into leaf [31, 37, 41], which is full. Inserting gives [31, 37, 40, 41], 4 keys, too many. <strong>Split the leaf</strong> into [31, 37] and [40, 41] and copy 40 up. The parent [23, 31, 43] gets 40 and would hold [23, 31, 40, 43], also too many, so <strong>split it too</strong>: [23, 31] and [43], and the middle key 40 moves up. The root [13] has room and becomes [13, 40]. Height stays 3.</p></div>
${row(fig(L13, '(a) Original'), sf(r40, 2, '(b) Leaf split done, the parent overflows'), sf(r40, last(r40), '(c) After the whole insertion'))}
<div class="prose"><h4>Example 3: root overflow, insert 45</h4>
<p>This tree (n = 3) has a root with 3 keys and four leaves. 45 goes into the last leaf [30, 32, 40], which splits into [30, 32] and [40, 45], copying 40 up. The root would become [10, 20, 30, 40], too full, so it splits into [10, 20] and [40], moving 30 up. There is no parent, so <strong>30 becomes a new root</strong>. The tree is now one level taller.</p></div>
${row(fig(ROOTOV, '(a) Original'), sf(r45, 2, '(b) After the leaf split, the root overflows'), sf(r45, last(r45), '(c) New root [30]'))}
${K('Height grows only when the <strong>root</strong> splits. Splits at the leaf or a middle level never change the height.')}
${W('u2CopyMove')}
${W('u2Lab')}` },

    { id: 'deletion', title: 'Deletion', body: `<div class="prose"><h4>The steps (slides 31-32)</h4></div>
${steps([
  ['1-2. Find and remove', 'Locate the key-pointer pair in its leaf and delete it.'],
  ['3. Still enough?', 'If the leaf still has at least its minimum number of keys and pointers (⌊(n+1)/2⌋ keys), nothing more to do.'],
  ['4. Underflow in node N', 'Look at the adjacent siblings of N (same parent).'],
  ['4.1 Borrow (redistribute)', 'If a sibling has <strong>more than the minimum</strong>, move one key-pointer pair from it to N, keeping the order. Adjust the parent\'s key.'],
  ['4.2 Merge (coalesce)', 'If no sibling can lend, N and a sibling M together fit in one node. Merge them, delete the parent\'s key and pointer for the removed node. If the parent now underflows, apply the same algorithm to the parent, recursively.'],
])}
${T('The order is <strong>borrow first, merge second</strong>. Merging is only allowed when no sibling has a spare key. If an exam question states its own order (for example "prefer the left sibling"), follow it.')}
<div class="prose"><p>For a <strong>non-leaf</strong> node the same two options exist, but they move keys through the parent: a borrow <em>rotates</em> (the parent\'s key comes down, a sibling key goes up, and a child pointer moves across). A merge pulls the parent\'s separator <strong>down</strong> into the merged node.</p>
<h4>Example 1: simple deletion, delete 37</h4>
<p>Leaf [31, 37, 41] keeps 2 keys (the minimum), so no repair is needed.</p></div>
${row(fig(L13, '(a) Original'), sf(d37, 0, '(b) After deleting 37'))}
<div class="prose"><h4>Example 2: borrow at the leaf, delete 7</h4>
<p>Leaf [7, 11] drops to [11], 1 key (below 2). The only sibling [2, 3, 5] has 3 keys, one more than the minimum, so 5 moves over: [2, 3] and [5, 11]. The parent's separator becomes <strong>5</strong> (the smallest key of the right leaf).</p></div>
${row(fig(L13, '(a) Original'), sf(d7, last(d7), '(b) After deleting 7'))}
<div class="prose"><h4>Example 3: non-leaf borrow, then delete 11 (continuing from Example 2)</h4>
<p>Leaf [5, 11] becomes [5]. Its only sibling [2, 3] is at the minimum, so the two <strong>merge</strong> into [2, 3, 5]. The parent loses a key and is left with 0 keys, below its minimum of 1. The parent's sibling [23, 31, 43] has a spare key, so we <strong>rotate through the root</strong>: the root's 13 comes down, the sibling's first child moves across, and 23 goes up to be the new root key.</p></div>
${row(sf(d7_11, 1, '(b) The leaf merge leaves the parent empty'), sf(d7_11, last(d7_11), '(c) After rotating through the root'))}
<div class="prose"><h4>Example 4: sibling coalescing, delete 50 (n = 4, minimum 2 keys)</h4>
<p>Leaf [40, 50] drops to [40] (1 key). The left sibling [10, 20, 30] has 3 keys, so by step 4.1 we <strong>borrow</strong> 30: leaves [10, 20] and [30, 40], separator 30. The lecture's figure instead <strong>merges</strong> [10, 20, 30] with [40] into [10, 20, 30, 40], which also fits (4 = n) and produces a smaller tree. Both are valid B+ trees, but the figure skips the borrow step, so <strong>follow the rule your question gives</strong>. The simulator below can show both (the "merge before borrow" switch).</p></div>
${row(fig(T50, '(a) Original, n = 4'), sf(d50, last(d50), '(b) Borrow first (stated rule)'), sf(d50m, last(d50m), '(b\') Lecture figure: merged'))}
<div class="prose"><h4>Example 5: non-leaf coalescing that shrinks the tree, delete 37 (n = 4)</h4>
<p>Leaf [30, 37] becomes [30] (min is 2). Left sibling [25, 26] is at the minimum, so merge into [25, 26, 30]. The parent [30, 40] loses 30 and holds only [40], below its minimum of 2 keys. Its sibling [10, 20] is also at the minimum, so the two non-leaf nodes <strong>merge</strong> and the root's key 25 comes down between them: [10, 20, 25, 40]. The old root is now empty, so its single child becomes the new root. <strong>The tree is one level shorter.</strong></p></div>
${row(fig(NL37, '(a) Original, n = 4'), sf(dNL, 1, '(b) Leaf merge, the parent underflows'), sf(dNL, last(dNL), '(c) After merging the non-leaf nodes'))}
${K('Height shrinks only when the <strong>root</strong> is left with one child after a merge. Height grows only when the root splits. Every other case leaves the height unchanged.')}
${T('After a borrow or merge, the parent keys must match the new situation. In the course figures a separator is always the <strong>smallest key of the subtree to its right</strong>. Recheck every separator on your path before you finish drawing.')}
${W('u2BorrowMerge')}` },

    { id: 'takeaways', title: 'Takeaways and exam checklist', body: `<div class="prose">
<h4>When to use a B+ tree</h4>
<p>Use a B+ tree index to speed up SQL that has: <strong>exact-value</strong> conditions, <strong>range</strong> conditions, and <strong>aggregate</strong> functions (for example MIN, MAX, or counting a range, which can be answered from the sorted leaves).</p>
<p><strong>Clustering.</strong> The clustering (sorting) column of the table does not have to be the key column. Any column can be used to sort the data in the table pages. The link to B+ trees: if the table is clustered on the indexed column, the records of a leaf range sit in few adjacent pages, so a range scan reads few data pages. If the table is not clustered on it, each leaf pointer in the range may point to a different data page.</p></div>
${table(['Operation', 'Conventional index', 'B+ tree'], [['Read', 'O(log n)', 'O(log n)'], ['Insert', 'O(n)', 'O(log n)'], ['Update', 'O(n)', 'O(log n)'], ['Delete', 'O(n)', 'O(log n)']])}
<div class="prose"><h4>Checklist for any B+ tree exam question</h4></div>
${steps([
  ['Write n and the limits', 'Max keys n. Leaf min ⌊(n+1)/2⌋ keys. Non-leaf min ⌈(n+1)/2⌉ − 1 keys. Root min 1 key.'],
  ['Read the conventions', 'Which leaf gets the extra key on a split? Which sibling first? Borrow before merge? If it is not stated, use the lecture defaults (left leaf gets the extra key, borrow first, left sibling first).'],
  ['Do one key at a time', 'Draw the tree after each operation. Operations in a list are usually consecutive, unless the question says "independent".'],
  ['Check at the end', 'All leaves at the same depth. Every node within its min and max. Keys in order across the leaf chain. Separators are the smallest key of the right subtree. <strong>Count your keys: none may disappear</strong> (the official 2025 midterm sheet loses two, see the midterm section of PA2).'],
])}
${W('u2Predict')}` },
  ],
};

// ============================================================ PRACTICE ASSIGNMENT 2
const q21 = B.search(P21, 41), q38 = B.search(P21, 38), r2045 = B.range(P21, 20, 45), rLess = B.range(P21, -Infinity, 29), rGreater = B.range(P21, 31, Infinity);
const li = o => `<ul>${o.map(x => `<li>${x}</li>`).join('')}</ul>`;
const p1 = B.insert(P21, 1), p14 = B.insert(p1.tree, 14), p15 = B.insert(p14.tree, 15), p16 = B.insert(p15.tree, 16);
const b22 = B.build(2, KEYS22, { leafSplit: 'right' }), b22l = B.build(2, KEYS22, { leafSplit: 'left' });
const ops22 = KEYS22.map(k => ['insert', k]);
const dseq = [48, 40, 2, 18, 12, 9, 5, 23, 24, 28].map(k => ['delete', k]);
const F22p = mkT(2, SPEC.F22, { leafSplit: 'right' });
const o24 = [['delete', 68], ['delete', 80], ['insert', 3], ['delete', 200], ['delete', 66]];
const b25a = B.build(3, KEYS25), b25b = B.build(5, KEYS25);
const o26 = [['insert', 9], ['insert', 10], ['insert', 8], ['delete', 23], ['delete', 19]];
const mA = B.insert(MT, 18), mB = B.remove(MT, 3), mC = B.remove(MT, 7), mD = B.remove(MT, 21);
const mOff = mkT(3, SPEC.MT21_OFFICIAL);

export const lab = {
  id: 'pa2', kind: 'lab', num: 'PA2', icon: 'clipboard-text',
  title: 'Practice Assignment 2: B+ Tree Index', navTitle: 'PA2: B+ Tree', mapLabel: 'B+ practice',
  short: 'Every PA2 exercise worked step by step with engine-drawn trees, plus the 2025 midterm B+ tree exercise with its erratum.',
  goals: [
    'Trace lookups, range lookups and inserts on the PA2-1 tree.',
    'Build a tree for n = 2 insert by insert and know why the PA2-2 solution gives the extra key to the right leaf.',
    'Run a long delete sequence with the stated order: redistribute, then coalesce, then delete the node.',
    'Apply explicit conventions (left leaf gets the extra key, prefer the left sibling) as in PA2-4.',
    'Build trees from "number of pointers per node" and run an operation series.',
    'Solve the 2025 midterm B+ tree exercise, including delete 21, where the official sheet loses keys.',
  ],
  sections: [
    { id: 'conventions', title: 'Read the conventions first', body: `<div class="prose">
<p>A B+ tree operation is not always uniquely defined. When a leaf of an <em>odd</em> number of keys splits, one half gets the extra key. When a node underflows, there may be a left and a right sibling that could lend a key. A good answer follows the conventions of the question. PA2 uses these:</p></div>
${table(['Exercise', 'n', 'Leaf split (extra key goes to)', 'Underflow rule', 'Engine option'], [
  ['2-1', '3', 'default (left)', 'not needed (only inserts)', 'defaults'],
  ['2-2', '2', '<strong>right</strong> leaf (this is what the printed solution draws)', 'n/a', '<code>leafSplit: right</code>'],
  ['2-3', '2', 'n/a', '1. redistribute, 2. coalesce, 3. delete the node; either sibling', 'defaults'],
  ['2-4', '4', 'left leaf; non-leaf: middle value taken from the right', 'redistribute first, then merge; <strong>prefer the left sibling</strong>', '<code>siblings: left</code>'],
  ['2-5, 2-6', '3 and 5', 'default (left)', 'default', 'defaults'],
])}
${T('PA2-2 gives the extra key to the <strong>right</strong> leaf, but PA2-4 says the <strong>left</strong> leaf gets it. Both are legal B+ trees for an odd split. In the exam, use the rule written in the question. If none is given, say which one you assume.')}
<div class="prose"><p>Try the same sequence with both conventions in the <em>Build a tree</em> simulator of the next section and compare the final trees.</p></div>` },

    { id: 'ex-2-1', title: 'Exercise 2-1: lookups and inserts', body: `<div class="prose">
<p>The tree (n = 3, so leaf min 2 keys, non-leaf min 1 key):</p></div>
${row(fig(P21, 'PA2-1 tree'))}
<div class="prose"><h4>Reads</h4>
<p><strong>1. Lookup 41.</strong> The official solution says "we do not find any of the keys is 40", which is a typo for 41.</p>${li(q21.text)}<p>Not found, <strong>${q21.nodes} nodes</strong> accessed, no data page.</p>
<p><strong>2. Lookup 38.</strong></p>${li(q38.text)}<p>Found, ${q38.nodes} nodes plus the data page.</p>
<p><strong>3. Range 20 to 45.</strong> Descend to the leaf that would hold 20 (20 ≥ 17 goes right, 20 &lt; 37 takes the first pointer), then walk the leaf chain.</p>${li(r2045.text)}<p>Result keys: <strong>${r2045.keys.join(', ')}</strong>. Nodes accessed: ${r2045.path.length} while descending plus ${r2045.leafIds.length} leaves = ${r2045.path.length + r2045.leafIds.length}.</p>
<p><strong>4. Keys less than 30.</strong> Follow the leftmost pointers to the first leaf and walk right until a key reaches 30: leaves holding ${ks(rLess.keys)}.</p>
<p><strong>5. Keys greater than 30.</strong> Descend for 30 (30 &gt; 17, then 30 &lt; 37), then walk to the last leaf: ${ks(rGreater.keys)}.</p></div>
${row(
  fig(P21, 'Range 20 to 45: path and leaf chain', [...r2045.path, ...r2045.leafIds]),
  fig(P21, 'Keys less than 30: leftmost leaf chain', [...rLess.path, ...rLess.leafIds]),
  fig(P21, 'Keys greater than 30', [...rGreater.path, ...rGreater.leafIds]))}
<div class="prose"><h4>Inserts</h4>
<p><strong>6. Insert 1.</strong> Leaf [2, 3, 5] is full, becomes [1, 2, 3, 5] and splits into [1, 2] and [3, 5]. 3 is copied up to the parent [7], giving [3, 7] (2 keys, room). The root is not touched.</p>
<p><strong>7a. Insert 14.</strong> Goes into leaf [7, 13], which has room: [7, 13, 14].</p>
<p><strong>7b. Insert 15.</strong> Leaf [7, 13, 14] is full and splits to [7, 13] and [14, 15]. 14 is copied up: parent [3, 7, 14]. That is full, not over.</p>
<p><strong>7c. Insert 16.</strong> Leaf [14, 15] takes 16 with room: [14, 15, 16].</p></div>
${row(sf(p1, last(p1), 'Insert 1'), sf(p14, last(p14), 'Insert 14'), sf(p15, last(p15), 'Insert 15'), sf(p16, last(p16), 'Insert 16'))}
${K('Counting nodes for a range query: descent (one node per level) plus every leaf you read. Data pages come on top and depend on whether the table is clustered.')}` },

    { id: 'ex-2-2', title: 'Exercise 2-2: inserts with n = 2', body: `<div class="prose">
<p>Insert <strong>12, 8, 1, 23, 5, 7, 2, 28, 9, 18, 24, 40, 48</strong> into an empty tree with n = 2 (max 2 keys, 3 pointers). Limits for n = 2: leaf min 1 key, non-leaf min 1 key (2 pointers). A leaf holds up to 2 keys, so a 3-key overflow splits 1 + 2 or 2 + 1. <strong>The PA solution gives the right leaf the extra key (1 + 2).</strong> This is the "right" convention.</p>
<p>The first two keys fill the root leaf [8, 12]. Everything after that is shown below. Each picture is the tree after that one insert, with the last touched nodes highlighted, and the caption says what restructuring happened.</p></div>
${seqFigs(B.empty(2, { leafSplit: 'right' }), ops22)}
<div class="prose"><p>Final tree (right convention), ${rootKeys(b22)} at the root, height ${B.height(b22)}, and ${B.leaves(b22).length} leaves: ${leafStr(b22)}.</p>
<p>With the <strong>left</strong> convention (left leaf gets the extra key) the same input gives a different but equally valid tree:</p></div>
${row(fig(b22, 'Right leaf keeps the extra key (PA2-2 solution)'), fig(b22l, 'Left leaf keeps the extra key (lecture default)'))}
${T('When your tree differs from the printed one, check which leaf got the extra key before you decide you are wrong. The exam will state the convention. Both trees here hold the same 13 keys and are valid.')}
<div class="prose"><p>The sequence also shows a <strong>non-leaf split</strong>: with n = 2, a non-leaf with 3 keys splits into 2 + 2 pointers and the middle key moves up. When it happens at the root, the tree grows (here to ${B.height(b22)} levels).</p></div>
${W('u2Build')}` },

    { id: 'ex-2-3', title: 'Exercise 2-3: a long delete sequence', body: `<div class="prose">
<p>Start from the final tree of 2-2 and delete <strong>48, 40, 2, 18, 12, 9, 5, 23, 24, 28</strong>. The stated order at the leaf level is: <strong>1. redistribute</strong> (if a sibling has a spare key), <strong>2. sibling coalesce</strong> (merge), <strong>3. delete the node</strong> (the merged-away node disappears). Then fix the levels above one at a time. Either sibling is allowed here.</p></div>
${row(fig(F22p, 'Starting tree'))}
${seqFigs(F22p, dseq)}
<div class="prose"><p>Things to notice. Deleting 48, 2, 18 and 5 needs no repair (the leaf keeps its 1 key). Deleting <strong>40</strong> is the big one: the leaf is empty, nothing can lend, and the merges cascade up, so the root [23] and its left child combine into [8, 23] and the tree shrinks from ${B.height(F22p)} to ${B.height(opSeq(F22p, dseq)[1].tree)} levels. Deleting 12 is a plain leaf borrow. Deleting 9 merges and then rotates a key through the root. Deleting 23 merges twice. Deleting 24 merges and rotates. The last deletion merges the remaining nodes and shrinks the tree to 2 levels, a root over three one-key leaves.</p></div>
${T('A node with <strong>no keys</strong> but one pointer is not allowed (non-leaf min is 1 key for n = 2). It must borrow through the parent or merge. Never leave it empty.')}` },

    { id: 'ex-2-4', title: 'Exercise 2-4: explicit conventions (n = 4)', body: `<div class="prose">
<p>Tree with n = 4: leaf min 2 keys, non-leaf min 2 keys. Operations are <strong>consecutive</strong>: delete 68, delete 80, insert 3, delete 200, delete 66. Conventions: left leaf gets the extra key; for a non-leaf split the middle value comes from the right half; on underflow redistribute first, then merge, and <strong>prefer the left sibling for both</strong>.</p></div>
${row(fig(P24, 'Initial tree'))}
${seqFigs(P24, o24)}
<div class="prose"><p><strong>(a) Delete 68:</strong> leaf [67, 68] becomes [67]. Left sibling [65, 66] is at the minimum, so merge with it (the left sibling is preferred, and a merge with it is the only thing the convention allows). [65, 66, 67] fits. <strong>(b) Delete 80:</strong> leaf [80, 90, 100] drops to [90, 100], which is still the minimum 2, so only the separator changes to 90. <strong>(c) Insert 3:</strong> leaf [1, 2, 4] gets 3 and holds [1, 2, 3, 4] = n keys, no split. <strong>(d) Delete 200:</strong> [120, 200, 220] still has 2 keys. <strong>(e) Delete 66:</strong> [65, 66, 67] has room to lose one.</p></div>
${K('A leaf with exactly n keys is not overflowing. Overflow means n + 1. Many students split too early.')}` },

    { id: 'ex-2-5', title: 'Exercise 2-5: construction from "pointers per node"', body: `<div class="prose">
<p>Build trees for 2, 3, 5, 7, 11, 17, 19, 23, 29, 31 inserted in ascending order, when the node holds (a) <strong>4 pointers</strong> and (b) <strong>6 pointers</strong>. Pointers = n + 1, so <strong>(a) n = 3</strong> and <strong>(b) n = 5</strong>.</p></div>
${row(fig(b25a, '(a) n = 3: root ' + rootKeys(b25a)), fig(b25b, '(b) n = 5: root ' + rootKeys(b25b)))}
<div class="prose"><p>Leaves are not packed completely full: inserting in ascending order always splits the rightmost leaf, so each earlier leaf is left with just over half. With n = 3 a leaf of 4 keys splits 2 + 2; with n = 5, 6 keys split 3 + 3.</p></div>
${T('The question gives <strong>pointers</strong>, not n. Convert first: n = pointers − 1.')}` },

    { id: 'ex-2-6', title: 'Exercise 2-6: insert and delete series', body: `<div class="prose">
<p>For both trees of 2-5: insert 9, insert 10, insert 8, delete 23, delete 19 (consecutive).</p><h4>(a) n = 3</h4></div>
${seqFigs(b25a, o26)}
<div class="prose"><h4>(b) n = 5</h4></div>
${seqFigs(b25b, o26)}
<div class="prose"><p>In (a), inserting 10 splits a leaf and the non-leaf grows to [5, 9, 11] (full). Deleting 23 triggers a leaf merge and a non-leaf rotation through the root, and deleting 19 is then plain. In (b), the larger nodes absorb 9 and 10, inserting 8 splits one leaf, deleting 23 is plain, and deleting 19 merges two leaves.</p></div>` },

    { id: 'midterm', title: 'Midterm 2025, Exercise 3 (20 marks)', body: `<div class="prose">
<p>The exam gives a B+ tree with <strong>n = 3</strong> and four <strong>independent</strong> operations (each starts from the original tree): insert 18, delete 3, delete 7, delete 21.</p></div>
${row(fig(MT, 'Original tree (n = 3)'))}
${row(sf(mA, last(mA), '(a) insert 18: leaf [12, 14] has room'), sf(mB, last(mB), '(b) delete 3: leaf [1, 5] keeps 2 keys'), sf(mC, last(mC), '(c) delete 7: borrow 5 from [1, 3, 5], separator 5'))}
<div class="prose"><h4>(d) delete 21: the official answer is wrong</h4>
<p>Leaf [20, 21] becomes [20], 1 key. Its left sibling is not under the same parent. Its only sibling [23, 35] is at the minimum, so they <strong>merge</strong> into [20, 23, 35]. The parent [23] loses its only key and is empty (min is 1), so it must borrow. Its sibling [7, 12] has a spare key, so we rotate through the root: root key 20 comes down, 12 goes up. Result: root [12], left [7] over leaves [1, 3, 5] [7, 9], right [20] over leaves [12, 14] [20, 23, 35].</p>
<p>The model answer printed on the exam sheet shows a root [7, 20] over only three leaves, [1, 3, 5] [7, 9] [20, 23, 35]. That sheet <strong>has lost the keys 12 and 14</strong> (the leaf [12, 14] is gone) and is not a valid answer for the stored data. Follow the lecture algorithm, not the sheet.</p></div>
${row(sf(mD, last(mD), 'Correct result of delete 21'), fig(mOff, 'Official answer: keys 12 and 14 are missing'))}
${T('Always count the keys of the original tree (here 11 keys: 1, 3, 5, 7, 9, 12, 14, 20, 21, 23, 35; after deleting 21 there must be 10) and compare with your final leaves. A deletion removes exactly one key. Nothing else may vanish.')}
${W('u2Midterm')}` },

    { id: 'exam-tips', title: 'What the exam asks', body: `<div class="prose">
<p>The exam <strong>always</strong> has a B+ tree exercise (2025: 20 of 100 marks). Expect a given tree, a value of n, and several operations (inserts and deletes, often a split that propagates and a delete that merges). Typical other questions: compute n from a block size, state min/max keys or pointers for a node type, count nodes accessed for a lookup, and say which operation changes the height.</p></div>
${steps([
  ['Know the formula sheet', 'The threshold table is given. Practise reading n off a drawn node (slots) and filling in min keys for leaf and non-leaf, since you must use them for every underflow decision.'],
  ['Show your reasoning', 'Write "leaf [x] has k keys, minimum is m, so borrow/merge" for each delete. Partial marks come from the process.'],
  ['Mind independence', 'Midterm 2025: "operations are independent" means each one starts from the original tree. PA2-4 is the opposite: consecutive. Read this first.'],
  ['Re-check the root', 'After any split that reached the top or merge that emptied the root, redraw the root. The height changes only there.'],
  ['Keep every key', 'Insert adds one key, delete removes one. Count the leaves at the end.'],
])}
<div class="prose"><p>For extra practice: the <em>Predict the result</em> game (lecture, takeaways section) and the simulator in the lecture insertion section both contain every tree of this assignment.</p></div>` },
  ],
};

// ============================================================ QUESTIONS
const Q = (id, m, q, o, why) => ({ id, m, q, o, why });
const rk = (t) => rootKeys(t);
const bits = {
  ins40root: rk(r40.tree), ins45root: rk(r45.tree), del7sep: ks(d7.tree.root.children[0].keys),
};
const d50leaves = leafStr(d50.tree), d50mleaves = leafStr(d50m.tree);
const d7_11root = rk(d7_11.tree), dNLroot = rk(dNL.tree);
const p1left = ks(p1.tree.root.children[0].keys), p15left = ks(p15.tree.root.children[0].keys);
const a3_1 = rk(B.build(2, [12, 8, 1], { leafSplit: 'right' }));
const dd40 = rk(opSeq(F22p, dseq)[1].tree), dFinal = leafStr(opSeq(F22p, dseq)[9].tree);
const a6_2 = ks(opSeq(b25a, o26)[1].tree.root.children[0].keys);
const b6_5 = leafStr(opSeq(b25b, o26)[4].tree);
const d68 = B.remove(P24, 68), a24 = leafStr(d68.tree);
const mCleft = ks(mC.tree.root.children[0].keys), mDroot = rk(mD.tree);

export const questions = [
  Q('l2-1', 'l2', 'In the lecture\'s multilevel-index example (1,000,000 rows, 10 rows per table page, 100 pairs per index page), how many pages does the <em>lowest</em> index level need?', ['1,000 pages (100,000 table pages / 100 pairs)', '10,000 pages (1,000,000 rows / 100 pairs)', '100,000 pages (one per table page)', '10 pages (the level just below the root)'], 'The table has 1,000,000 / 10 = 100,000 pages. One pair per table page gives 100,000 pairs, and 100 pairs fit in a page: 100,000 / 100 = 1,000 pages. The next level up needs 10 pages and the top level 1 page.'),
  Q('l2-3', 'l2', 'Which row of the lecture\'s CRUD table is <em>not</em> an advantage of the B+ tree over a conventional index?', ['Read: both are O(log n)', 'Insert: O(n) versus O(log n)', 'Update: O(n) versus O(log n)', 'Delete: O(n) versus O(log n)'], 'Both are O(log n) for reads. The B+ tree wins on insert, update and delete because it does not have to shift a whole sorted file.'),
  Q('l2-5', 'l2', 'What does it mean that a B+ tree is <em>balanced</em>?', ['All paths from the root to a leaf have the same length', 'Every node has exactly the same number of keys', 'The left subtree always has the same number of keys as the right', 'Every key appears exactly once in the tree'], 'Balance is about path length, not key counts. It keeps lookup cost equal to the height, O(log n). A skewed binary search tree has O(n) paths.'),
  Q('l2-6', 'l2', 'Block = 4096 bytes, key = 4 bytes, pointer = 8 bytes, no header. What is n?', ['340', '341', '512', '1024'], '4n + 8(n + 1) ≤ 4096 gives 12n ≤ 4088, so n ≤ 340.67 and n = 340. 341 would need 12 × 341 + 8 = 4100 bytes. Do not forget the extra pointer.'),
  Q('l2-7', 'l2', `Block = 8192 bytes, key = 8 bytes, pointer = 8 bytes, no header. What is n?`, [String(B.nFromBlock(8192, 8, 8)), '512', '1023', '1024'], 'n = ⌊(8192 − 8) / (8 + 8)⌋ = ⌊511.5⌋ = 511. 512 would need 16 × 512 + 8 = 8200 bytes > 8192.'),
  Q('l2-8', 'l2', `Block = 1024 bytes, key = 4 bytes, pointer = 4 bytes, and a 24-byte block header. What is n?`, [String(B.nFromBlock(1024, 4, 4, 24)), '125', '127', '126'], 'n = ⌊(1024 − 24 − 4) / (4 + 4)⌋ = ⌊124.5⌋ = 124. The header comes off the block first, then the extra pointer.'),
  Q('l2-10', 'l2', 'For n = 5, what is the <em>minimum</em> number of keys in a leaf (not the root)?', [String(lim(5).leaf.minKeys), '2', '4', '5'], '⌊(n+1)/2⌋ = ⌊6/2⌋ = 3 keys. Minimum pointers = 3 + 1 = 4 (the last one goes to the next leaf).'),
  Q('l2-11', 'l2', 'For n = 4, what is the minimum number of <em>pointers</em> in a non-leaf node (not the root)?', [String(lim(4).nonleaf.minPtrs), '2', '4', '5'], '⌈(n+1)/2⌉ = ⌈5/2⌉ = 3 pointers, which means at least 2 keys.'),
  Q('l2-12', 'l2', 'For n = 3, a non-leaf node (not the root) must have at least how many keys?', ['1', '2', '3', '0'], '⌈4/2⌉ − 1 = 1 key (2 pointers). A leaf for n = 3 needs 2 keys. Do not use the leaf formula for non-leaf nodes.'),
  Q('l2-13', 'l2', 'For n = 7, what is the minimum number of pointers in a leaf node?', [String(lim(7).leaf.minPtrs), '4', '6', '3'], '⌊(7+1)/2⌋ + 1 = 5 pointers (4 keys and the next-leaf pointer).'),
  Q('l2-14', 'l2', 'In the lecture\'s tree (n = 3), how many B+ tree nodes are accessed to look up 37?', ['3', '2', '4', '5'], 'Root [13], then [23, 31, 43], then leaf [31, 37, 41]. One node per level, and the tree has 3 levels.'),
  Q('l2-15', 'l2', 'How does a range query (for example keys 20 to 45) proceed after reaching the first leaf?', ['It follows the next-leaf pointers until a key past the upper bound', 'It goes back up to the root for each leaf', 'It scans the whole leaf level from the left', 'It runs a new lookup for every integer in the range'], 'Leaves are chained in key order. One descent, then a sequential walk.'),
  Q('l2-16', 'l2', `Lecture tree (n = 3). After inserting 40, what keys does the root hold?`, [bits.ins40root, '[13]', '[13, 31]', '[13, 43]'], 'Leaf [31, 37, 41] splits to [31, 37] and [40, 41]; 40 is copied up. The parent [23, 31, 43] then overflows to [23, 31, 40, 43] and splits to [23, 31] and [43], moving 40 up into the root.'),
  Q('l2-17', 'l2', 'A leaf splits and the first key of the new right leaf goes up to the parent. What happens to that key?', ['It is copied up: it stays in the right leaf and also appears in the parent', 'It is moved up: it is removed from the leaf', 'It is deleted from the tree', 'It stays only in the left leaf'], 'All keys must remain in the leaf level (that is where the record pointers are). Only non-leaf splits move a key up.'),
  Q('l2-18', 'l2', `Tree with root [10, 20, 30] over leaves [1, 2, 3] [10, 12] [20, 25] [30, 32, 40] (n = 3). After inserting 45, what is the new root?`, [bits.ins45root, '[10, 20, 30, 40]', '[40]', '[20]'], 'Leaf split copies 40 up; the root [10, 20, 30, 40] overflows and splits into [10, 20] and [40], moving 30 up as the new root. The tree grows one level.'),
  Q('l2-19', 'l2', 'Which event is the only one that increases the height of a B+ tree?', ['Splitting the root', 'Splitting a leaf', 'Splitting any non-leaf', 'Inserting a duplicate key'], 'A leaf or middle split pushes a key up into an existing parent. Only a root split creates a new level above it.'),
  Q('l2-20', 'l2', 'Which event decreases the height of a B+ tree?', ['A merge that leaves the root with a single child', 'A borrow between two leaves', 'Deleting the smallest key', 'A leaf underflow'], 'Only when the root has no keys left (one pointer) does its single child become the new root.'),
  Q('l2-21', 'l2', `Lecture tree (n = 3). After deleting 7, what is the key of the left non-leaf node?`, [bits.del7sep, '[7]', '[3]', '[11]'], 'Leaf [7, 11] becomes [11] (below 2). The left sibling [2, 3, 5] lends 5, giving [2, 3] and [5, 11]. The separator becomes 5, the smallest key of the right leaf.'),
  Q('l2-22', 'l2', `n = 4, leaf [40, 50] loses 50. The left sibling is [10, 20, 30]. Following the stated algorithm (borrow first), what are the leaves?`, [d50leaves, d50mleaves, '[1, 5] [10, 20, 30] [40] [100, 110]', '[1, 5] [10, 20, 30] [100, 110]'], 'The sibling has more than the minimum 2 keys, so step 4.1 applies: 30 moves over. The lecture figure that merges instead is also a valid tree, but it skips the borrow step.'),
  Q('l2-23', 'l2', `n = 4, delete 37 from root [25] over non-leaf [10, 20] and non-leaf [30, 40] with leaves [1,3] [10,14] [20,22] | [25,26] [30,37] [40,45]. What happens to the height?`, [`It shrinks by one; the new root is ${dNLroot}`, 'It stays the same; the new root is [25]', 'It grows by one', 'It stays the same; the new root is [10, 20]'], 'The leaf merge leaves [40] in the right non-leaf (min 2). Its sibling [10, 20] is at the minimum, so they merge with 25 coming down, and the empty old root disappears.'),
  Q('l2-24', 'l2', 'When a non-leaf node splits, what happens to the middle key?', ['It moves up to the parent and is removed from both halves', 'It is copied up and kept in the right half', 'It stays in the left half only', 'It is deleted'], 'Non-leaf keys are only signposts, so a split moves the middle one up. Leaf splits copy up instead.'),
  Q('l2-25', 'l2', 'When may a node merge with a sibling during deletion?', ['Only when no adjacent sibling has more than the minimum number of keys', 'Whenever the node has fewer than n keys', 'Always before trying to borrow', 'Only when the node is the root'], 'The algorithm is borrow first (4.1), merge only if that fails (4.2). Together the two nodes then fit in one.'),
  Q('l2-26', 'l2', 'Which queries benefit from a B+ tree index on column <code>price</code>?', ['price = 50, price BETWEEN 10 AND 20, and MAX(price)', 'Only price = 50', 'Only price BETWEEN 10 AND 20', 'None unless the table is stored in price order'], 'Exact lookups, ranges and aggregates are the three use cases of the lecture takeaways.'),
  Q('l2-27', 'l2', 'True or false, with correction: "The clustering (sorting) column of a table must be the index key column."', ['False. Any column can be used to cluster the data in the table pages', 'True. The index key and the clustering column are always the same', 'True, but only for B+ trees', 'False. Tables are never clustered'], 'Clustering decides the order of rows in pages, the key column decides what the index searches by. A range scan is cheapest when they coincide.'),
  Q('l2-28', 'l2', `For n = 340, at most how many keys can a tree of height 3 (root, one non-leaf level, leaves) hold?`, [fmtN(maxKeys340h3), '340 × 340 × 340 = 39,304,000', '341 × 340 = 115,940', '340 × 3 = 1,020'], 'At most 341 children per node: 341 × 341 leaves, each with 340 keys. Using n instead of n + 1 for the fan-out is the typical slip.'),

  Q('pa2-1', 'pa2', 'PA2-1 tree: how many nodes are accessed when looking up key 41 (which does not exist)?', [String(q21.nodes), '2', '4', '1'], 'Root [17] (41 ≥ 17 goes right), [37, 43] (37 ≤ 41 < 43, middle pointer), leaf [37, 38]: no 41. The printed solution says "40" by mistake, but the path is the same.'),
  Q('pa2-2', 'pa2', 'PA2-1 tree: which keys does the range query 20 to 45 return?', [r2045.keys.join(', '), '36, 37, 38, 43, 47', '17, 18, 36, 37, 38', '37, 38, 43'], 'Descend to the leaf [17, 18, 36] (20 ≥ 17 right, 20 < 37 left), take 36, follow the next-leaf pointers to [37, 38] and [43, 47, 49] and stop after 43.'),
  Q('pa2-3', 'pa2', `PA2-1 tree (n = 3). After inserting 1, what is the left child of the root?`, [p1left, '[7]', '[1, 7]', '[2, 7]'], 'Leaf [2, 3, 5] overflows to [1, 2, 3, 5], splits to [1, 2] and [3, 5], and 3 is copied up into [7], making [3, 7].'),
  Q('pa2-4', 'pa2', 'PA2-1: after inserting 1, 14 and 15 (in order), what is the left non-leaf node?', [p15left, '[3, 7]', '[3, 7, 13]', '[3, 14]'], 'Inserting 15 overflows leaf [7, 13, 14] to [7, 13] and [14, 15]. The key 14 is copied up into [3, 7], giving [3, 7, 14]. That is full but still legal.'),
  Q('pa2-5', 'pa2', 'PA2-2 (n = 2, right leaf keeps the extra key): after inserting 12, 8, 1, what is the root?', [a3_1, '[12]', '[1]', '[1, 8]'], 'Leaf [8, 12] gets 1 and holds [1, 8, 12]. With the right convention the split is [1] and [8, 12], and the first key of the right leaf, 8, goes up. (With the left convention it would be [1, 8] and [12], root [12].)'),
  Q('pa2-7', 'pa2', 'PA2-3 names three actions at the leaf level. In which order are they tried?', ['Redistribute, then sibling coalesce, then delete the node', 'Coalesce, then redistribute, then delete the node', 'Delete the node, then redistribute, then coalesce', 'Redistribute only; coalescing is never needed'], 'Borrow from a sibling if possible, else merge, and the merged-away node disappears. Afterwards the changes are applied to the levels above.'),
  Q('pa2-8', 'pa2', 'PA2-3: after the first two deletions (48, then 40), what is the root?', [dd40, '[23]', '[8]', '[8, 24]'], 'Deleting 40 empties a leaf with no spare key anywhere, so the merges cascade, the root [23] and its left child combine into [8, 23], and the tree shrinks from 4 to 3 levels.'),
  Q('pa2-9', 'pa2', 'PA2-3: after all ten deletions, what is left?', [dFinal + ' under one root', 'An empty tree', 'One leaf with 3 keys', 'Two levels with a root of [7]'], 'Three keys remain (1, 7 and 8), each in its own leaf (n = 2 allows a leaf with 1 key) under a single root [7, 8].'),
  Q('pa2-10', 'pa2', `PA2-4 (n = 4, prefer the left sibling). After deleting 68, what are the leaves of the right subtree?`, [a24.replace(/^.*\[1, 2, 4\] \[14, 16\] \[23, 32, 40\] /, ''), '[65, 66] [67] [80, 90, 100] [120, 200, 220]', '[65, 66] [80, 90, 100] [120, 200, 220]', '[65, 66, 67] [90, 100] [120, 200, 220]'], 'Leaf [67] is below 2 keys. The convention prefers the left sibling [65, 66], which is at the minimum, so they merge. The key 80 stays in the parent: [80, 120].'),
  Q('pa2-11', 'pa2', 'PA2-4 (c): inserting 3 into the leaf [1, 2, 4] with n = 4. What happens?', ['The leaf becomes [1, 2, 3, 4]: it has n keys, so there is no split', 'The leaf splits into [1, 2] and [3, 4]', 'The leaf splits and 3 goes up', 'The parent splits'], 'A leaf may hold up to n = 4 keys. Overflow means n + 1 = 5.'),
  Q('pa2-12', 'pa2', 'PA2-5 asks for a tree where a node holds "six pointers". What is n and what is the root for the keys 2, 3, 5, 7, 11, 17, 19, 23, 29, 31 in ascending order?', [`n = 5, root ${rk(b25b)}`, 'n = 6, root [7, 19]', 'n = 5, root [19]', 'n = 6, root [11]'], 'Pointers = n + 1, so n = 5. Leaves split 3 + 3: [2,3,5] [7,11,17] [19,23,29,31] with 7 and 19 as separators.'),
  Q('pa2-13', 'pa2', `PA2-6a (n = 3): after inserting 9 and then 10, what is the left non-leaf node?`, [a6_2, '[5, 11]', '[5, 9]', '[9, 11]'], 'Leaf [5, 7, 9] gets 10 and overflows, so it splits into [5, 7] and [9, 10]. The key 9 is copied up into [5, 11], giving [5, 9, 11].'),
  Q('pa2-14', 'pa2', 'PA2-6b (n = 5): what are the leaves after the last operation (delete 19)?', [b6_5, '[2, 3, 5] [7, 8, 9] [10, 11, 17] [29, 31]', '[2, 3, 5] [7, 8, 9] [10, 11, 17, 19, 29, 31]', '[2, 3, 5] [7, 8, 9, 10, 11, 17] [29, 31]'], 'Leaf [29, 31] would have 2 keys (min is 3) and its left sibling [10, 11, 17] is at the minimum, so they merge into [10, 11, 17, 29, 31] (5 keys fit).'),
  Q('pa2-15', 'pa2', 'Midterm 2025, delete 7 (n = 3, independent operations). What is the left non-leaf node afterwards?', [mCleft, '[7, 12]', '[3, 12]', '[1, 12]'], 'Leaf [7, 9] becomes [9] (min 2). The left sibling [1, 3, 5] lends 5, leaves [1, 3] and [5, 9], separator 5.'),
  Q('pa2-16', 'pa2', 'Midterm 2025, delete 21. What is the correct root, and what is wrong with the printed answer?', [`Root ${mDroot}. The printed answer (root [7, 20]) loses the keys 12 and 14`, 'Root [7, 20]. The printed answer is correct', 'Root [20]. The printed answer is missing key 7', 'Root [12, 20]. The printed answer has too many keys'], 'Merge [20] with [23, 35]; the emptied non-leaf borrows through the root from [7, 12]. The official figure has only 3 leaves and misses [12, 14].'),
];

// ============================================================ GLOSSARY
export const glossary = [
  ['Multilevel index', 'An index built on top of another index, repeated until the top level fits in one page.', 'l2'],
  ['B+ tree', 'A balanced tree of index blocks. All keys with record pointers are in the leaves, which are chained for range scans. Default index in PostgreSQL.', 'l2'],
  ['Balanced', 'All paths from the root to a leaf have the same length, so every lookup costs the height.', 'l2'],
  ['Parameter n', 'Each B+ tree block holds up to n keys and n + 1 pointers. It follows from the block size.', 'l2'],
  ['n from block size', 'n = ⌊(b − h − p) / (k + p)⌋ for block b, header h, key size k, pointer size p. 4096/4/8 gives 340.', 'l2'],
  ['Leaf node', 'Holds keys and record pointers in order, plus a pointer to the next leaf. Min ⌊(n+1)/2⌋ keys.', 'l2'],
  ['Non-leaf node', 'Holds separator keys and child pointers. Min ⌈(n+1)/2⌉ pointers, so ⌈(n+1)/2⌉ − 1 keys.', 'l2'],
  ['Root', 'Needs at least 2 pointers (1 key), unless the whole tree is a single leaf.', 'l2'],
  ['Threshold table', 'Max/min keys and pointers for root, non-leaf and leaf. Printed on the exam formula sheet.', 'l2'],
  ['Next-leaf pointer', 'Last pointer of a leaf: it links leaves in key order, enabling range scans.', 'l2'],
  ['Range lookup', 'Descend once to the first leaf, then follow next-leaf pointers until the upper bound is passed.', 'l2'],
  ['Node access', 'Reading one B+ tree node (one page). Counts the cost of a lookup: the height for exact matches.', 'l2'],
  ['Leaf split', 'Overflow of a leaf (n + 1 keys) into two leaves. The first key of the right leaf is copied up.', 'l2'],
  ['Non-leaf split', 'Overflow of a non-leaf node: the middle key is moved up (removed from both halves).', 'l2'],
  ['Copy up / move up', 'Leaf split copies the key up; non-leaf split moves it up.', 'l2'],
  ['New root', 'Created when the old root splits. The only way the tree grows taller.', 'l2'],
  ['Underflow', 'A node has fewer keys than its minimum after a deletion.', 'l2'],
  ['Redistribute (borrow)', 'Move one key from a sibling with a spare key to the underflowing node and adjust the parent.', 'l2'],
  ['Coalesce (merge)', 'Merge the underflowing node with a minimum-size sibling into one node and delete the parent key.', 'l2'],
  ['Clustering column', 'The column the table rows are sorted by on disk; it does not have to be the index key.', 'l2'],
  ['Leaf split convention', 'On an odd split one leaf gets the extra key. PA2-2 gives it to the right, PA2-4 to the left. Follow the question.', 'pa2'],
  ['Sibling preference', 'Rule for which sibling to try first on underflow. PA2-4: the left one.', 'pa2'],
];

// ============================================================ CHEAT SHEET
export const cheat = [
  ['l2', 'Structure and n', ['Each node: n keys, n + 1 pointers.', 'n = ⌊(block − header − pointer) / (key + pointer)⌋.', '4096-byte block, 4-byte key, 8-byte pointer: n = 340.', 'Balanced: all leaves at the same depth, lookup = height.']],
  ['l2', 'Thresholds (formula sheet)', ['Leaf: min keys ⌊(n+1)/2⌋, min pointers ⌊(n+1)/2⌋ + 1.', 'Non-leaf: min pointers ⌈(n+1)/2⌉, min keys ⌈(n+1)/2⌉ − 1.', 'Root: min 1 key / 2 pointers (a lone leaf may have 1 key).', 'n = 3: leaf 2 keys, non-leaf 1 key. n = 4: both 2.']],
  ['l2', 'Insert', ['Insert in the leaf. If it has n + 1 keys, split.', 'Leaf split: copy up the first key of the right leaf.', 'Non-leaf split: move up the middle key.', 'Root split creates a new root: the only height increase.']],
  ['l2', 'Delete', ['Underflow: borrow from a sibling that has more than the minimum.', 'Else merge with a sibling and delete the parent key.', 'Recurse up. Root left with 1 child: the height shrinks.', 'Separators = smallest key of the right subtree.']],
  ['l2', 'Search and use', ['Exact: one node per level. Range: descend once, then follow next-leaf pointers.', 'Use for exact, range and aggregate queries.', 'Insert/update/delete: O(log n) versus O(n) for a conventional index.']],
  ['pa2', 'Exam pitfalls', ['Read conventions: extra key left or right, sibling order, consecutive or independent ops.', 'Pointers per node = n + 1, so "4 pointers" means n = 3.', 'A leaf with n keys is full, not overflowing.', 'Count keys at the end: the 2025 midterm sheet for delete 21 loses 12 and 14.']],
];
