// Unit 2 simulators: B+ tree (Lecture 2, PA2, midterm 2025 Exercise 3).
import { opsBench } from './opsbench.js';
import { sorter } from './sorter.js';
import { bench, $, $$, on, seg, setSeg, esc, fmt } from '../viz.js';
import { recordScore } from '../store.js';
import * as B from '../engine/bptree.js';
import { bptreeSVG } from '../engine/draw.js';
import { SPEC, KEYS22, KEYS25 } from '../content/u2.js';

// ------------------------------------------------------------ shared helpers
const ks = a => '[' + a.join(', ') + ']';
const svgBox = (t, o) => { const s = bptreeSVG(t, o || {}), m = s.match(/viewBox="0 0 ([\d.]+)/), w = m ? Math.round(+m[1] * 0.8) : 0; return `<div style="overflow-x:auto;max-width:100%"><div style="min-width:${w}px">${s}</div></div>`; };
const nodeLimits = n => B.limits(n);
const parseList = s => {
  const parts = s.split(/[\s,;]+/).filter(Boolean);
  if (!parts.length || parts.some(p => !/^-?\d+$/.test(p))) throw new Error('Type whole numbers separated by commas, for example 12 or 12, 8, 1.');
  return parts.map(Number);
};
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const KIND = { ok: ['check-circle', 'var(--good)'], warn: ['warning', 'var(--accent)'], info: ['info', 'var(--muted)'] };
// Step player markup: tree at step `at` plus the explanation and Previous/Next buttons (attrs data-sp="prev|next|last").
const stepPanel = (steps, at, base) => {
  if (!steps.length) return '';
  const s = steps[at], [ic, col] = KIND[s.kind || 'info'];
  return `<div style="margin-top:10px"><div class="small muted" style="margin-bottom:4px">Step-through of the correct answer</div>${svgBox(s.tree || base, { hl: s.hl || [] })}
  <div class="callout" style="margin-top:8px;border-left:3px solid ${col}"><i class="ph ph-${ic}" style="color:${col}"></i><div><strong class="num">Step ${at + 1} of ${steps.length}.</strong> ${s.text}</div></div>
  <div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn sm" data-sp="prev" ${at ? '' : 'disabled'}><i class="ph ph-caret-left"></i>Previous</button><button type="button" class="btn sm" data-sp="next" ${at < steps.length - 1 ? '' : 'disabled'}>Next<i class="ph ph-caret-right"></i></button><button type="button" class="btn sm ghost" data-sp="last" ${at < steps.length - 1 ? '' : 'disabled'}>Jump to result</button></div></div>`;
};
const specKey = t => B.specString(t);

// ============================================================ 1. u2Lab: main playground
const LAB_DEFAULT = { leafSplit: 'left', siblings: 'either', mergeFirst: false };
export function u2Lab(el) {
  const opt = { ...LAB_DEFAULT };
  const P = [
    { label: 'Lecture tree (n = 3)', n: 3, spec: SPEC.L13, about: 'The tree of slides 17-20 and 23-37. Try the examples below.' },
    { label: 'Root-overflow tree (n = 3)', n: 3, spec: SPEC.ROOTOV, about: 'Slides 27-29: insert 45 and watch a new root appear.' },
    { label: 'Delete-50 tree (n = 4)', n: 4, spec: SPEC.T50, about: 'Slide 38-39. Minimum 2 keys in leaf and non-leaf.' },
    { label: 'Non-leaf coalescing (n = 4)', n: 4, spec: SPEC.NL37, about: 'Slides 40-42: delete 37 and the height shrinks.' },
    { label: 'PA2-1 tree (n = 3)', n: 3, spec: SPEC.P21, about: 'Practice assignment 2-1: lookups and inserts 1, 14, 15, 16.' },
    { label: 'PA2-2 empty (n = 2)', n: 2, spec: null, opts: { leafSplit: 'right' }, about: 'Type 12, 8, 1, 23, 5, 7, 2, 28, 9, 18, 24, 40, 48 (one list works). The PA solution gives the extra key to the right leaf.' },
    { label: 'PA2-2 final tree (n = 2)', n: 2, spec: SPEC.F22, opts: { leafSplit: 'right' }, about: 'Start of PA2-3: delete 48, 40, 2, 18, 12, 9, 5, 23, 24, 28.' },
    { label: 'PA2-4 tree (n = 4)', n: 4, spec: SPEC.P24, opts: { siblings: 'left' }, about: 'PA2-4 conventions: prefer the left sibling.' },
    { label: 'Midterm 2025 (n = 3)', n: 3, spec: SPEC.MT, about: 'Exercise 3: insert 18, delete 3, delete 7, delete 21 (each from the original: press Reset in between).' },
  ];
  const EX = [
    { label: 'Insert 12', p: 0, ops: [[0, 12]] }, { label: 'Insert 40', p: 0, ops: [[0, 40]] }, { label: 'Insert 45', p: 1, ops: [[0, 45]] },
    { label: 'Delete 37', p: 0, ops: [[1, 37]] }, { label: 'Delete 7', p: 0, ops: [[1, 7]] }, { label: 'Delete 7 then 11', p: 0, ops: [[1, 7], [1, 11]] },
    { label: 'Delete 50 (borrow first)', p: 2, ops: [[1, 50]] }, { label: 'Delete 50 (slide figure)', p: 2, ops: [[1, 50]], opts: { mergeFirst: true } },
    { label: 'Delete 37 (n = 4)', p: 3, ops: [[1, 37]] },
    { label: 'Search 37', p: 0, ops: [[2, 37]] },
    { label: 'Midterm: insert 18', p: 8, ops: [[0, 18]] }, { label: 'Midterm: delete 3', p: 8, ops: [[1, 3]] }, { label: 'Midterm: delete 7', p: 8, ops: [[1, 7]] }, { label: 'Midterm: delete 21', p: 8, ops: [[1, 21]] },
  ];
  const mkTree = i => { Object.assign(opt, LAB_DEFAULT, P[i].opts || {}); return P[i].spec ? B.fromSpec(P[i].n, P[i].spec, opt) : B.empty(P[i].n, opt); };
  const toggles = () => `<div style="display:grid;gap:8px;margin-bottom:10px">
    <div><div class="small muted">Leaf split: which leaf keeps the extra key when n + 1 keys cannot split evenly (next operation)</div>${seg([['left', 'Left leaf'], ['right', 'Right leaf']], opt.leafSplit, 'data-ls')}</div>
    <div><div class="small muted">Underflow: which sibling may lend or merge?</div>${seg([['either', 'Left, then right'], ['left', 'Left only (PA2-4)']], opt.siblings, 'data-sb')}</div>
    <div><div class="small muted">Underflow: order of actions</div>${seg([['borrow', 'Borrow, then merge (rule)'], ['merge', 'Merge if it fits (slide 39 figure)']], opt.mergeFirst ? 'merge' : 'borrow', 'data-mf')}</div></div>
    <div class="chips" style="margin-bottom:10px"><span class="small muted" style="align-self:center">Lecture, PA and midterm examples:</span>${EX.map((e, i) => `<button type="button" class="chip accent" data-ex="${i}">${e.label}</button>`).join('')}</div>`;
  const presets = P.map((p, i) => ({ label: p.label, make: () => mkTree(i), get note() { return `${esc(p.about)}</p>${toggles()}<p class="small" style="display:none">`; } }));
  const withOpts = t => ({ ...t, opts: { ...t.opts, ...opt } });
  const seq = (f, word) => (t, v) => {
    const list = Array.isArray(v) ? v : [v]; let cur = withOpts(t); const all = [];
    list.forEach(k => { const r = f(cur, k); r.steps.forEach(s => all.push(list.length > 1 ? { ...s, text: `<strong>${word} ${k}:</strong> ${s.text}` } : s)); cur = r.tree; });
    return { tree: cur, steps: all };
  };
  const searchOp = (t, v) => {
    const k = Array.isArray(v) ? v[0] : v, r = B.search(t, k);
    return { tree: t, steps: r.path.map((id, i) => ({ text: (i === 0 ? `<strong>Search ${k}.</strong> ` : '') + r.text[i], kind: i === r.path.length - 1 ? (r.found ? 'ok' : 'warn') : 'info', hl: [id], tree: t })), };
  };
  opsBench(el, {
    id: 'u2-lab', icon: 'tree-structure', title: 'B+ tree playground', hint: 'Insert or delete keys and step through every split, borrow and merge. Several keys at once are allowed (12, 8, 1).',
    presets,
    ops: [{ label: 'Insert', icon: 'plus', run: seq(B.insert, 'Insert') }, { label: 'Delete', icon: 'minus', run: seq(B.remove, 'Delete') }, { label: 'Search', icon: 'magnifying-glass', run: searchOp }],
    input: { label: 'Key(s)', placeholder: 'e.g. 40 or 12, 8, 1', parse: parseList },
    quick: [],
    draw: (t, hl) => svgBox(t, { hl: hl || [] }),
    info: t => {
      const L = nodeLimits(t.n), v = B.validate(t);
      return t.root ? `n = ${t.n}, ${t.n + 1} pointers per node. Height ${B.height(t)}, ${B.allKeys(t).length} keys in ${B.leaves(t).length} leaves. Minimums: leaf ${L.leaf.minKeys} keys, non-leaf ${L.nonleaf.minKeys} keys, root 1. ${v.length ? `<span style="color:var(--bad)">Invalid: ${esc(v.join('; '))}</span>` : 'Valid B+ tree.'}` : `n = ${t.n}. The tree is empty.`;
    },
  });
  const setOpt = (btn, key, val, attr) => { opt[key] = val; setSeg(btn.parentElement, key === 'mergeFirst' ? (val ? 'merge' : 'borrow') : val, attr); };
  on(el, '[data-ls]', 'click', (e, b) => setOpt(b, 'leafSplit', b.dataset.ls, 'data-ls'));
  on(el, '[data-sb]', 'click', (e, b) => setOpt(b, 'siblings', b.dataset.sb, 'data-sb'));
  on(el, '[data-mf]', 'click', (e, b) => setOpt(b, 'mergeFirst', b.dataset.mf === 'merge', 'data-mf'));
  on(el, '[data-ex]', 'click', (e, b) => {
    const ex = EX[+b.dataset.ex];
    el.querySelector(`[data-preset="${ex.p}"]`).click();
    Object.assign(opt, ex.opts || {});
    ex.ops.forEach(([op, k]) => { el.querySelector('[data-in]').value = String(k); el.querySelector(`[data-op="${op}"]`).click(); });
  });
}

// ============================================================ 2. u2Predict: predict the resulting tree
const A = SPEC.L13.c[0], R = SPEC.L13.c[1];
const SCEN = [
  { title: 'Lecture tree, insert 40', n: 3, spec: SPEC.L13, op: 'insert', key: 40, rule: 'Leaf split: left leaf keeps the extra key. Non-leaf split of 4 keys: the middle key from the right half moves up.',
    bad: [
      { label: 'Moved up at the leaf: 40 is no longer in a leaf, so a key (and its record) disappears from the leaf level.', spec: { k: [13, 40], c: [A, { k: [23, 31], c: [[13, 17, 19], [23, 29], [31, 37]] }, { k: [43], c: [[41], [43, 47]] }] } },
      { label: 'Wrong middle key at the non-leaf split: [23, 31, 40, 43] must split into [23, 31] and [43] with 40 moving up.', spec: { k: [13, 31], c: [A, { k: [23], c: [[13, 17, 19], [23, 29]] }, { k: [40, 43], c: [[31, 37], [40, 41], [43, 47]] }] } },
      { label: '40 inserted in the wrong leaf: 40 is below 43, so it belongs next to 41, not into [43, 47].', spec: { k: [13], c: [A, { k: [23, 31, 43], c: [[13, 17, 19], [23, 29], [31, 37, 41], [40, 43, 47]] }] } },
    ] },
  { title: 'Root-overflow tree, insert 45', n: 3, spec: SPEC.ROOTOV, op: 'insert', key: 45, rule: 'Leaf split copies up. A root split makes a new root.',
    bad: [
      { label: 'Uneven non-leaf split: [10, 20, 30, 40] splits into [10, 20] and [40]; the left half keeps 3 pointers.', spec: { k: [20], c: [{ k: [10], c: [[1, 2, 3], [10, 12]] }, { k: [30, 40], c: [[20, 25], [30, 32], [40, 45]] }] } },
      { label: 'No new root: the root cannot hold 4 keys. When the root splits the tree grows one level.', spec: { k: [10, 20, 30, 40], c: [[1, 2, 3], [10, 12], [20, 25], [30, 32], [40, 45]] } },
      { label: 'Uneven leaf split: leaf [30, 32, 40, 45] must split into [30, 32] and [40, 45]; [45] alone is below the minimum of 2.', spec: { k: [30], c: [{ k: [10, 20], c: [[1, 2, 3], [10, 12], [20, 25]] }, { k: [45], c: [[30, 32, 40], [45]] }] } },
    ] },
  { title: 'Lecture tree, delete 7', n: 3, spec: SPEC.L13, op: 'delete', key: 7, rule: 'Borrow before merge. The separator is the smallest key of the right subtree.',
    bad: [
      { label: 'Separator not updated: after borrowing 5 the parent must show 5, not the deleted 7.', spec: { k: [13], c: [{ k: [7], c: [[2, 3], [5, 11]] }, R] } },
      { label: 'Underflow ignored: leaf [11] has 1 key, but a leaf needs at least 2 when n = 3.', spec: { k: [13], c: [{ k: [11], c: [[2, 3, 5], [11]] }, R] } },
      { label: 'A key vanished: 11 was not deleted, it should still be in the leaf level.', spec: { k: [13], c: [{ k: [5], c: [[2, 3], [5]] }, R] } },
    ] },
  { title: 'Lecture tree after delete 7, now delete 11', n: 3, spec: SPEC.L13, pre: [['delete', 7]], op: 'delete', key: 11, rule: 'Merge at the leaf, then the empty non-leaf borrows through the root.',
    bad: [
      { label: 'Rotated without going through the root: the root key 13 must come down and 23 go up.', spec: { k: [13], c: [{ k: [23], c: [[2, 3, 5], [13, 17, 19]] }, { k: [31, 43], c: [[23, 29], [31, 37, 41], [43, 47]] }] } },
      { label: 'A key vanished: the leaf [23, 29] became [29], losing 23.', spec: { k: [23], c: [{ k: [13], c: [[2, 3, 5], [13, 17, 19]] }, { k: [31, 43], c: [[29], [31, 37, 41], [43, 47]] }] } },
      { label: 'Parent left empty: a non-leaf with 0 keys is below its minimum of 1 and must borrow or merge.', spec: { k: [13], c: [{ k: [], c: [[2, 3, 5]] }, R] } },
    ] },
  { title: 'n = 4, delete 50', n: 4, spec: SPEC.T50, op: 'delete', key: 50, rule: 'Follow the lecture algorithm: borrow first, merge only if no sibling can lend. Min 2 keys.',
    alts: [{ label: 'Merged although the left sibling could lend (the figure of slide 39). It is a valid tree but skips step 4.1.', opts: { mergeFirst: true } }],
    bad: [
      { label: 'Separator not updated: after borrowing 30 the parent must show 30, not 40.', spec: { k: [10, 40, 100], c: [[1, 5], [10, 20], [30, 40], [100, 110]] } },
      { label: 'A key vanished: 40 was lost while moving keys around.', spec: { k: [10, 30, 100], c: [[1, 5], [10, 20], [30], [100, 110]] } },
    ] },
  { title: 'n = 4, delete 37 (non-leaf coalescing)', n: 4, spec: SPEC.NL37, op: 'delete', key: 37, rule: 'Min 2 keys in leaf and non-leaf. A merge pulls the parent separator down.',
    bad: [
      { label: 'Underflow ignored at the non-leaf: [40] has 1 key but needs 2. Its sibling is at the minimum, so they merge.', spec: { k: [25], c: [{ k: [10, 20], c: [[1, 3], [10, 14], [20, 22]] }, { k: [40], c: [[25, 26, 30], [40, 45]] }] } },
      { label: 'A key vanished: 30 is missing from the leaf level.', spec: { k: [10, 20, 25, 40], c: [[1, 3], [10, 14], [20, 22], [25, 26], [40, 45]] } },
      { label: 'The root key 25 was not pulled down, so 5 children sit under 3 keys. A merge moves the separator into the merged node.', spec: { k: [10, 20, 40], c: [[1, 3], [10, 14], [20, 22], [25, 26, 30], [40, 45]] } },
    ] },
  { title: 'PA2-2 (n = 2, right leaf keeps the extra key): insert 24', n: 2, keys: KEYS22.slice(0, 10), opts: { leafSplit: 'right' }, op: 'insert', key: 24, rule: 'n = 2: a leaf holds 2 keys, a 3-key overflow splits 1 + 2 (right keeps the extra).',
    alts: [{ label: 'Left leaf keeps the extra key. Valid in general, but this exercise states the right leaf.', opts: { leafSplit: 'left' } }], generic: true },
  { title: 'PA2-1 tree, insert 1', n: 3, spec: SPEC.P21, op: 'insert', key: 1, rule: 'Leaf [2, 3, 5] is full. Left leaf keeps the extra key.',
    bad: [
      { label: 'No split: [1, 2, 3, 5] has 4 keys, more than n = 3.', spec: { k: [17], c: [{ k: [7], c: [[1, 2, 3, 5], [7, 13]] }, SPEC.P21.c[1]] } },
      { label: 'Wrong separator: the key copied up is the first key of the right leaf (3), not 2.', spec: { k: [17], c: [{ k: [2, 7], c: [[1], [2, 3, 5], [7, 13]] }, SPEC.P21.c[1]] } },
    ], generic: true },
  { title: 'Midterm 2025, delete 21 (n = 3)', n: 3, spec: SPEC.MT, op: 'delete', key: 21, rule: 'Merge [20] with [23, 35]; the emptied non-leaf borrows from [7, 12] through the root.',
    bad: [
      { label: 'The printed model answer: it has only 3 leaves and has lost the keys 12 and 14.', spec: SPEC.MT21_OFFICIAL },
      { label: 'Parent left empty after the merge: a non-leaf with 0 keys is not allowed.', spec: { k: [20], c: [{ k: [7, 12], c: [[1, 3, 5], [7, 9], [12, 14]] }, { k: [], c: [[20, 23, 35]] }] } },
      { label: 'Right non-leaf separator not updated: the right leaf [20, 23, 35] must be separated by 20.', spec: { k: [12], c: [{ k: [7], c: [[1, 3, 5], [7, 9]] }, { k: [23], c: [[12, 14], [20, 23, 35]] }] } },
    ] },
  { title: 'PA2-4 (n = 4, prefer the left sibling): delete 68', n: 4, spec: SPEC.P24, opts: { siblings: 'left' }, op: 'delete', key: 68, rule: 'Redistribute first, then merge. Both prefer the LEFT sibling.',
    alts: [{ label: 'Looked at the right sibling too and borrowed from it. The PA2-4 convention only looks at the left sibling.', opts: { siblings: 'either' } }] },
];
const nonleafKeys = t => { const s = new Set(); const w = n => { if (!n.leaf) { n.keys.forEach(k => s.add(k)); n.children.forEach(w); } }; if (t.root) w(t.root); return s; };
function buildScenario(sc) {
  let t0 = sc.keys ? B.build(sc.n, sc.keys, sc.opts || {}) : B.fromSpec(sc.n, sc.spec, sc.opts || {});
  (sc.pre || []).forEach(([o, k]) => { t0 = (o === 'insert' ? B.insert : B.remove)(t0, k).tree; });
  const run = (t, extra) => (sc.op === 'insert' ? B.insert : B.remove)({ ...t, opts: { ...t.opts, ...(extra || {}) } }, sc.key);
  const right = run(t0), seen = new Set([specKey(right.tree)]), wrongs = [];
  const add = (label, tree) => { const k = specKey(tree); if (seen.has(k)) return; seen.add(k); wrongs.push({ label, tree }); };
  (sc.bad || []).forEach(b => add(b.label, B.fromSpec(sc.n, b.spec)));
  (sc.alts || []).forEach(a => add(a.label, run(t0, a.opts).tree));
  if (sc.generic && sc.op === 'insert') {
    const orig = nonleafKeys(t0), fresh = [...nonleafKeys(right.tree)].filter(k => !orig.has(k));
    const spec = B.toSpec(right.tree), strip = s => Array.isArray(s) ? s.filter(k => !fresh.includes(k)) : { k: s.k, c: s.c.map(strip) };
    const sp = strip(spec), emptyLeaf = (s) => Array.isArray(s) ? !s.length : s.c.some(emptyLeaf);
    if (fresh.length && !emptyLeaf(sp)) add('Moved up instead of copied: the key that went up from the leaf split is missing in the leaf level.', B.fromSpec(sc.n, sp));
  }
  return { t0, right, wrongs };
}
export function u2Predict(el) {
  const ROUNDS = 6;
  let order, round, score, picked, cands, cur, at, done;
  const start = () => { order = shuffle(SCEN).slice(0, ROUNDS); round = 0; score = 0; done = false; load(); };
  const load = () => {
    const sc = order[round]; cur = { sc, ...buildScenario(sc) };
    cands = shuffle([{ ok: true, label: 'Correct. This is what the algorithm gives.', tree: cur.right.tree }, ...shuffle(cur.wrongs).slice(0, 3)]);
    picked = null; at = 0; render();
  };
  const render = () => {
    if (done) {
      el.innerHTML = `${bench('target', 'Predict the resulting tree', '')}<div class="bench-body"><p><strong class="num">${score} / ${ROUNDS}</strong> correct.</p><p class="small muted">${score === ROUNDS ? 'Perfect. You track copy up, move up, borrow and merge without slips.' : 'Replay and read the red labels: each one is a real mistake students make in the exam.'}</p><button type="button" class="btn primary sm" data-new><i class="ph ph-arrow-counter-clockwise"></i>New game</button></div>`;
      return;
    }
    const sc = cur.sc, L = nodeLimits(sc.n);
    el.innerHTML = `${bench('target', 'Predict the resulting tree', `<span class="num">Round ${round + 1}/${ROUNDS}</span> · score ${score}`)}
    <div class="bench-body">
      <p><strong>${sc.title}</strong> <span class="small muted">(n = ${sc.n}: leaf min ${L.leaf.minKeys} keys, non-leaf min ${L.nonleaf.minKeys} keys)</span></p>
      <p class="small muted" style="margin-bottom:6px">${sc.rule}</p>
      <div class="small muted">Starting tree${sc.pre ? ' (after ' + sc.pre.map(p => p.join(' ')).join(', ') + ')' : ''}</div>${svgBox(cur.t0)}
      <p style="margin:12px 0 6px"><strong>${sc.op === 'insert' ? 'Insert' : 'Delete'} ${sc.key}.</strong> Which tree is the result?</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:10px">
        ${cands.map((c, i) => {
          const sel = picked === i, show = picked !== null, col = show ? (c.ok ? 'var(--good)' : sel ? 'var(--bad)' : 'var(--line)') : 'var(--line)';
          return `<div style="border:2px solid ${col};border-radius:10px;padding:8px;background:var(--surface);min-width:0">
            ${svgBox(c.tree)}
            ${show ? `<div class="small" style="margin-top:6px;color:${c.ok ? 'var(--good)' : 'var(--ink)'}">${c.ok ? '<strong>Correct.</strong> ' : sel ? '<strong style="color:var(--bad)">Your pick. </strong>' : ''}${c.ok ? 'This follows the algorithm.' : esc(c.label)}</div>` : `<button type="button" class="btn sm" style="margin-top:6px" data-pick="${i}">This one</button>`}
          </div>`;
        }).join('')}
      </div>
      ${picked !== null ? `<p style="margin-top:10px" class="${cands[picked].ok ? 'hl' : ''}"><strong>${cands[picked].ok ? 'Right.' : 'Not quite.'}</strong> ${cands[picked].ok ? '' : 'See the labels above, then step through the correct answer.'}</p>${stepPanel(cur.right.steps, at, cur.t0)}
      <div style="margin-top:12px"><button type="button" class="btn primary sm" data-next-round>${round + 1 < ROUNDS ? 'Next round' : 'See score'}<i class="ph ph-caret-right"></i></button></div>` : ''}
    </div>`;
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.pick !== undefined && picked === null) { picked = +b.dataset.pick; if (cands[picked].ok) score++; at = 0; render(); }
    else if (b.dataset.sp) { const last = cur.right.steps.length - 1; at = b.dataset.sp === 'prev' ? Math.max(0, at - 1) : b.dataset.sp === 'next' ? Math.min(last, at + 1) : last; render(); }
    else if ('nextRound' in b.dataset) { if (round + 1 < ROUNDS) { round++; load(); } else { done = true; recordScore('u2-predict', score, ROUNDS); render(); } }
    else if ('new' in b.dataset) start();
  });
  start();
}

// ============================================================ 3. u2Limits: n calculator, threshold table, legal-node checker, height range
export function u2Limits(el) {
  const st = { b: 4096, k: 4, p: 8, h: 0, type: 'leaf', keys: 2, nOver: '', K: 1000000 };
  const num = (id, label, v, w = 110) => `<div class="field" style="max-width:${w}px;margin:0"><label for="u2l-${id}">${label}</label><input type="number" min="0" id="u2l-${id}" data-f="${id}" value="${v}" inputmode="numeric"></div>`;
  el.innerHTML = `${bench('calculator', 'n calculator, threshold table and node checker', '')}
  <div class="bench-body">
    <div class="small muted" style="margin-bottom:6px">1. How many keys fit in one block?</div>
    <div class="chips" style="margin-bottom:8px">${[['4096 / 4 / 8 (lecture)', 4096, 4, 8, 0], ['8192 / 8 / 8', 8192, 8, 8, 0], ['1024 / 4 / 4, header 24', 1024, 4, 4, 24], ['4096 / 8 / 8', 4096, 8, 8, 0]].map(([l, b, k, p, h]) => `<button type="button" class="chip" data-pre="${b},${k},${p},${h}">${l}</button>`).join('')}</div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:end">${num('b', 'Block (bytes)', st.b)}${num('k', 'Key (bytes)', st.k, 90)}${num('p', 'Pointer (bytes)', st.p, 100)}${num('h', 'Header (bytes)', st.h, 100)}</div>
    <div data-n style="margin-top:10px"></div>
    <div class="small muted" style="margin:16px 0 6px">2. Threshold table for n (the formula-sheet table, filled in for you)</div>
    <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">${num('nOver', 'n (blank = computed above)', '', 190)}</div>
    <div data-table style="margin-top:8px"></div>
    <div class="small muted" style="margin:16px 0 6px">3. Is this node legal? (uses the n above)</div>
    <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">${seg([['leaf', 'Leaf'], ['nonleaf', 'Non-leaf'], ['root', 'Root (tree has other nodes)'], ['rootleaf', 'Root that is the only node']], st.type, 'data-t')}${num('keys', 'Keys in the node', st.keys, 130)}</div>
    <div data-legal style="margin-top:8px"></div>
    <div class="small muted" style="margin:16px 0 6px">4. How many levels for K keys?</div>
    <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">${num('K', 'Keys in the index (K)', st.K, 180)}</div>
    <div data-height style="margin-top:8px"></div>
  </div>`;
  const val = id => { const v = $(el, `[data-f="${id}"]`).value; return v === '' ? NaN : Math.floor(+v); };
  const theN = () => { const o = val('nOver'); return Number.isFinite(o) && o >= 2 ? o : B.nFromBlock(st.b, st.k, st.p, st.h); };
  const update = () => {
    ['b', 'k', 'p', 'h', 'keys', 'K'].forEach(id => { const v = val(id); st[id] = Number.isFinite(v) ? v : 0; });
    const n = B.nFromBlock(st.b, st.k, st.p, st.h), used = st.k * n + st.p * (n + 1) + st.h, next = st.k * (n + 1) + st.p * (n + 2) + st.h;
    $(el, '[data-n]').innerHTML = n < 1 ? `<div class="callout"><i class="ph ph-warning"></i><div>Not even one key fits in this block.</div></div>` :
      `<div class="callout key" style="margin:0"><i class="ph ph-lightbulb"></i><div>${st.k}n + ${st.p}(n + 1)${st.h ? ' + ' + st.h : ''} ≤ ${st.b}  gives  <strong class="num">n = ${fmt(n, 0)}</strong>.<br><span class="small">Check: n = ${fmt(n, 0)} uses ${fmt(used, 0)} bytes. n + 1 would need ${fmt(next, 0)} bytes, which is more than ${fmt(st.b, 0)}. Formula: ⌊(${st.b} − ${st.h} − ${st.p}) / (${st.k} + ${st.p})⌋ = ⌊${fmt((st.b - st.h - st.p) / (st.k + st.p), 2)}⌋.</span></div></div>`;
    const N = theN(); if (!(N >= 2)) { $(el, '[data-table]').innerHTML = '<span class="small muted">Needs n ≥ 2.</span>'; $(el, '[data-legal]').innerHTML = ''; $(el, '[data-height]').innerHTML = ''; return; }
    const L = nodeLimits(N), half = (N + 1) / 2;
    $(el, '[data-table]').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>n = ${fmt(N, 0)}</th><th>Max keys</th><th>Max ptrs</th><th>Min keys</th><th>Min ptrs</th></tr></thead><tbody>
      <tr><td>Root</td><td class="num">${N}</td><td class="num">${N + 1}</td><td class="num">1</td><td class="num">1 (2 if not a lone leaf)</td></tr>
      <tr><td>Non-leaf</td><td class="num">${N}</td><td class="num">${N + 1}</td><td class="num">⌈${fmt(half, 1)}⌉ − 1 = ${L.nonleaf.minKeys}</td><td class="num">⌈${fmt(half, 1)}⌉ = ${L.nonleaf.minPtrs}</td></tr>
      <tr><td>Leaf</td><td class="num">${N}</td><td class="num">${N + 1}</td><td class="num">⌊${fmt(half, 1)}⌋ = ${L.leaf.minKeys}</td><td class="num">⌊${fmt(half, 1)}⌋ + 1 = ${L.leaf.minPtrs}</td></tr></tbody></table></div>`;
    // legal checker
    const k = st.keys, t = st.type; let ok, why;
    if (t === 'leaf') { ok = k >= L.leaf.minKeys && k <= N; why = `A leaf holds ${L.leaf.minKeys} to ${N} keys (${L.leaf.minPtrs} to ${N + 1} pointers, the last one to the next leaf). ${k} keys = ${k + 1} pointers.`; }
    else if (t === 'nonleaf') { ok = k >= L.nonleaf.minKeys && k <= N; why = `A non-leaf holds ${L.nonleaf.minKeys} to ${N} keys (${L.nonleaf.minPtrs} to ${N + 1} child pointers). ${k} keys = ${k + 1} pointers.`; }
    else if (t === 'root') { ok = k >= 1 && k <= N; why = `A root with children holds 1 to ${N} keys, at least 2 pointers. ${k} keys = ${k + 1} pointers.`; }
    else { ok = k >= 1 && k <= N; why = `If the whole tree is one node, the root is also the leaf and may hold 1 to ${N} keys.`; }
    $(el, '[data-legal]').innerHTML = `<div class="callout" style="margin:0;border-left:3px solid ${ok ? 'var(--good)' : 'var(--bad)'}"><i class="ph ph-${ok ? 'check-circle' : 'x-circle'}" style="color:${ok ? 'var(--good)' : 'var(--bad)'}"></i><div><strong>${ok ? 'Legal.' : k > N ? 'Illegal: overflow.' : 'Illegal: underflow.'}</strong> ${why}</div></div>`;
    // height range
    const m = Math.ceil(half), K = st.K;
    const cap = h => Math.pow(N + 1, h - 1) * N, min = h => h === 1 ? 1 : 2 * Math.pow(m, h - 2) * L.leaf.minKeys;
    let hmin = 1; while (cap(hmin) < K && hmin < 40) hmin++;
    let hmax = 1; while (hmax < 40 && min(hmax + 1) <= K) hmax++;
    $(el, '[data-height]').innerHTML = K < 1 ? '' : `<div class="small">With n = ${fmt(N, 0)}, a tree of height h holds at most (n+1)<sup>h−1</sup>·n keys and at least 2·⌈(n+1)/2⌉<sup>h−2</sup>·⌊(n+1)/2⌋ keys (h ≥ 2). For K = <span class="num">${fmt(K, 0)}</span> the height is between <strong class="num">${hmin}</strong> and <strong class="num">${Math.max(hmin, hmax)}</strong> levels: a lookup reads that many nodes.<br><span class="muted">Height 3 holds at most ${fmt(cap(3), 0)} keys and at least ${fmt(min(3), 0)}.</span></div>`;
  };
  el.addEventListener('input', e => { if (e.target.matches('[data-f]')) update(); });
  on(el, '[data-pre]', 'click', (e, b) => { const [bb, k, p, h] = b.dataset.pre.split(',').map(Number); [['b', bb], ['k', k], ['p', p], ['h', h]].forEach(([id, v]) => { $(el, `[data-f="${id}"]`).value = v; }); update(); });
  on(el, '[data-t]', 'click', (e, b) => { st.type = b.dataset.t; setSeg(b.parentElement, st.type, 'data-t'); update(); });
  update();
}

// ============================================================ 4. u2Search: lookups and range scans with I/O counts
export function u2Search(el) {
  const T = [
    { label: 'Lecture tree', n: 3, spec: SPEC.L13 }, { label: 'PA2-1 tree', n: 3, spec: SPEC.P21 }, { label: 'Midterm tree', n: 3, spec: SPEC.MT },
    { label: 'Deep tree (n = 2)', n: 2, spec: SPEC.F22 },
  ];
  const Q = [{ l: 'Lecture: 37', t: 0, kind: 'exact', a: 37 }, { l: 'PA2-1: 41', t: 1, kind: 'exact', a: 41 }, { l: 'PA2-1: 38', t: 1, kind: 'exact', a: 38 }, { l: 'PA2-1: 20 to 45', t: 1, kind: 'range', a: 20, b: 45 }, { l: 'PA2-1: < 30', t: 1, kind: 'lt', a: 30 }, { l: 'PA2-1: > 30', t: 1, kind: 'gt', a: 30 }];
  const st = { t: 0, kind: 'exact', a: 37, b: 45 };
  el.innerHTML = `${bench('magnifying-glass', 'Lookup and range scan: count node accesses', '')}
  <div class="bench-body">
    <p class="small muted" style="margin-bottom:8px">Pick a tree and a query. Orange nodes are visited while descending, green leaves are read along the leaf chain. Every node is one page read (I/O).</p>
    ${seg(T.map((t, i) => [i, t.label]), st.t, 'data-tree')}
    <div style="margin:10px 0">${seg([['exact', 'Exact key'], ['range', 'Range lo to hi'], ['lt', 'Less than'], ['gt', 'Greater than']], st.kind, 'data-kind')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
      <div class="field" style="max-width:110px;margin:0"><label for="u2s-a" data-la>Key</label><input type="number" id="u2s-a" data-a value="${st.a}"></div>
      <div class="field" style="max-width:110px;margin:0" data-bw><label for="u2s-b">Upper bound</label><input type="number" id="u2s-b" data-b value="${st.b}"></div>
      <button type="button" class="btn sm primary" data-run><i class="ph ph-play"></i>Search</button></div>
    <div class="chips" style="margin-top:10px"><span class="small muted" style="align-self:center">Try:</span>${Q.map((q, i) => `<button type="button" class="chip" data-q="${i}">${q.l}</button>`).join('')}</div>
    <div data-out style="margin-top:10px"></div></div>`;
  const run = () => {
    const tr = T[st.t], t = B.fromSpec(tr.n, tr.spec), a = +$(el, '[data-a]').value, b = +$(el, '[data-b]').value;
    $(el, '[data-bw]').style.display = st.kind === 'range' ? '' : 'none';
    $(el, '[data-la]').textContent = st.kind === 'range' ? 'Lower bound' : 'Key';
    const L = B.leaves(t).length, bin = Math.ceil(Math.log2(L + 1)); let html, hl = [], hl2 = [], nodes, scan, binary, lines, res;
    if (st.kind === 'exact') {
      const r = B.search(t, a); hl = r.path; nodes = r.nodes; lines = r.text;
      const idx = B.leaves(t).findIndex(l => l.id === r.leafId); scan = r.found ? idx + 1 : L; binary = bin;
      res = r.found ? `Found ${a}: follow its pointer to the data page (+1 page read).` : `${a} is not in the index: no data page is read.`;
    } else {
      const lo = st.kind === 'lt' ? -Infinity : st.kind === 'gt' ? a + 1 : a, hi = st.kind === 'lt' ? a - 1 : st.kind === 'gt' ? Infinity : b;
      const r = B.range(t, lo, hi); hl = r.path; hl2 = r.leafIds; nodes = r.path.length + r.leafIds.length; lines = r.path.map(id => 'Descend through a non-leaf node.').slice(0, 0).concat(['Descend from the root to the first leaf (' + r.path.length + ' non-leaf node' + (r.path.length === 1 ? '' : 's') + ').'], r.text);
      const lastIdx = B.leaves(t).findIndex(l => l.id === r.leafIds[r.leafIds.length - 1]);
      scan = lastIdx + 1; binary = bin + r.leafIds.length - 1;
      res = `Result: ${r.keys.length ? ks(r.keys) : 'no keys'}. Each result key still needs a data page (+${r.keys.length} at most).`;
    }
    $(el, '[data-out]').innerHTML = `${svgBox(t, { hl, hl2 })}
      <ol class="small" style="margin:8px 0 0 18px">${lines.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      <p style="margin-top:8px">${res}</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Method</th><th>Pages read</th></tr></thead><tbody>
        <tr><td><strong>B+ tree</strong></td><td class="num"><strong>${nodes}</strong> (${st.kind === 'exact' ? 'height ' + B.height(t) : B.height(t) - 1 + ' non-leaf + ' + hl2.length + ' leaves'})</td></tr>
        <tr><td>Binary search on a sorted file of ${L} leaf-sized pages${st.kind === 'exact' ? '' : ', then read on'}</td><td class="num">${binary}</td></tr>
        <tr><td>Read the sorted file from the start until done</td><td class="num">${scan}</td></tr></tbody></table></div>
      <p class="small muted" style="margin-top:6px">The gap is tiny in this small tree. For K = 1,000,000 keys with n = 340 the tree has 3 levels, a file scan reads thousands of pages and a binary search about 12.</p>`;
  };
  const sync = () => { setSeg($(el, '[data-tree]').parentElement.querySelector('.seg'), st.t, 'data-tree'); };
  on(el, '[data-tree]', 'click', (e, b) => { st.t = +b.dataset.tree; setSeg(b.parentElement, st.t, 'data-tree'); run(); });
  on(el, '[data-kind]', 'click', (e, b) => { st.kind = b.dataset.kind; setSeg(b.parentElement, st.kind, 'data-kind'); run(); });
  on(el, '[data-run]', 'click', run);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) run(); });
  on(el, '[data-q]', 'click', (e, b) => {
    const q = Q[+b.dataset.q]; st.t = q.t; st.kind = q.kind; $(el, '[data-a]').value = q.a; if (q.b !== undefined) $(el, '[data-b]').value = q.b;
    setSeg($(el, '[data-tree]').parentElement, st.t, 'data-tree'); setSeg($(el, '[data-kind]').parentElement, st.kind, 'data-kind'); run();
  });
  run();
}

// ============================================================ 5. u2Build: watch the tree grow insert by insert
export function u2Build(el) {
  const PRE = [
    { l: 'PA2-2 (n = 2, right leaf)', n: 2, ls: 'right', keys: KEYS22 }, { l: 'PA2-2 with the left leaf rule', n: 2, ls: 'left', keys: KEYS22 },
    { l: 'PA2-5a (4 pointers, n = 3)', n: 3, ls: 'left', keys: KEYS25 }, { l: 'PA2-5b (6 pointers, n = 5)', n: 5, ls: 'left', keys: KEYS25 },
  ];
  const st = { n: 2, ls: 'right', text: KEYS22.join(', '), res: null, at: 0, err: '' };
  const compute = () => {
    try { const keys = parseList(st.text); if (keys.length > 40) throw new Error('Use at most 40 keys.'); st.res = B.run(B.empty(st.n, { leafSplit: st.ls }), keys.map(k => ['insert', k])); st.at = st.res.length - 1; st.err = ''; }
    catch (e) { st.err = e.message; }
    render();
  };
  const render = () => {
    const r = st.res && st.res[st.at], t = r && r.tree;
    el.innerHTML = `${bench('tree-evergreen', 'Build a tree key by key', '')}
    <div class="bench-body">
      <div class="chips" style="margin-bottom:10px">${PRE.map((p, i) => `<button type="button" class="chip" data-pre="${i}">${p.l}</button>`).join('')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:end">
        <div><div class="small muted">n (max keys per node)</div>${seg([2, 3, 4, 5, 6].map(v => [v, v]), st.n, 'data-n')}</div>
        <div><div class="small muted">Leaf split: extra key goes to</div>${seg([['left', 'Left leaf'], ['right', 'Right leaf']], st.ls, 'data-ls')}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:10px"><div class="field" style="flex:1 1 220px;margin:0"><label for="u2b-k">Keys, inserted in this order</label><input type="text" id="u2b-k" data-keys value="${esc(st.text)}" autocomplete="off"></div><button type="button" class="btn primary sm" data-build><i class="ph ph-hammer"></i>Build</button></div>
      <div class="small" style="color:var(--bad);min-height:0;margin-top:4px">${esc(st.err)}</div>
      ${r ? `<div class="chips" style="margin:10px 0">${st.res.map((x, i) => `<button type="button" class="chip" data-at="${i}" aria-pressed="${i === st.at}">${x.key}</button>`).join('')}</div>
      ${svgBox(t, { hl: r.steps[r.steps.length - 1].hl })}
      <div class="small muted" style="margin-top:6px">After inserting <strong>${r.key}</strong> (${st.at + 1} of ${st.res.length}): height ${B.height(t)}, ${B.leaves(t).length} leaves, ${B.allKeys(t).length} keys, leaves ${Math.round(100 * B.allKeys(t).length / (B.leaves(t).length * t.n))}% full. ${B.validate(t).length ? 'INVALID' : 'Valid.'}</div>
      <ol class="small" style="margin:8px 0 0 18px">${r.steps.map(s => `<li>${s.text}</li>`).join('')}</ol>
      <div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="btn sm" data-prev ${st.at ? '' : 'disabled'}><i class="ph ph-caret-left"></i>Previous key</button><button type="button" class="btn sm" data-next ${st.at < st.res.length - 1 ? '' : 'disabled'}>Next key<i class="ph ph-caret-right"></i></button><button type="button" class="btn sm ghost" data-final ${st.at < st.res.length - 1 ? '' : 'disabled'}>Final tree</button></div>` : ''}
    </div>`;
  };
  on(el, '[data-pre]', 'click', (e, b) => { const p = PRE[+b.dataset.pre]; Object.assign(st, { n: p.n, ls: p.ls, text: p.keys.join(', ') }); compute(); });
  on(el, '[data-n]', 'click', (e, b) => { st.text = $(el, '[data-keys]').value; st.n = +b.dataset.n; compute(); });
  on(el, '[data-ls]', 'click', (e, b) => { st.text = $(el, '[data-keys]').value; st.ls = b.dataset.ls; compute(); });
  on(el, '[data-build]', 'click', () => { st.text = $(el, '[data-keys]').value; compute(); });
  on(el, '[data-at]', 'click', (e, b) => { st.at = +b.dataset.at; render(); });
  on(el, '[data-prev]', 'click', () => { st.at--; render(); });
  on(el, '[data-next]', 'click', () => { st.at++; render(); });
  on(el, '[data-final]', 'click', () => { st.at = st.res.length - 1; render(); });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-keys]')) { st.text = e.target.value; compute(); } });
  compute();
}

// ============================================================ 6. u2Midterm: Exercise 3 of the 2025 midterm
export function u2Midterm(el) {
  const MT = B.fromSpec(3, SPEC.MT), OFF = B.fromSpec(3, SPEC.MT21_OFFICIAL);
  const OPS = [
    { id: 'a', op: 'insert', key: 18, label: '(a) insert 18' }, { id: 'b', op: 'delete', key: 3, label: '(b) delete 3' },
    { id: 'c', op: 'delete', key: 7, label: '(c) delete 7' }, { id: 'd', op: 'delete', key: 21, label: '(d) delete 21' },
  ];
  const st = { i: 0, shown: false, at: 0, msg: '', text: '' };
  const res = o => (o.op === 'insert' ? B.insert : B.remove)(MT, o.key);
  const render = () => {
    const o = OPS[st.i], r = res(o), exp = B.leaves(r.tree).map(l => ks(l.keys)).join(' '), isD = o.id === 'd';
    const okKeys = B.allKeys(OFF), want = B.allKeys(r.tree), lost = want.filter(k => !okKeys.includes(k));
    el.innerHTML = `${bench('exam', 'Midterm 2025, Exercise 3 (n = 3)', 'operations are independent')}
    <div class="bench-body">
      ${seg(OPS.map((x, i) => [i, x.label]), st.i, 'data-op')}
      <div class="small muted" style="margin:10px 0 4px">Original tree (every operation starts from this one)</div>${svgBox(MT)}
      <p style="margin-top:10px"><strong>Your turn.</strong> Do <strong>${o.op} ${o.key}</strong> on paper, then type the leaves of your answer from left to right, groups separated by <code>|</code>, for example <code>1 3 5 | 7 9 | 12 14</code>.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end"><div class="field" style="flex:1 1 260px;margin:0"><label for="u2m-t">Leaves</label><input type="text" id="u2m-t" data-text value="${esc(st.text)}" autocomplete="off"></div><button type="button" class="btn sm primary" data-check><i class="ph ph-check"></i>Check</button><button type="button" class="btn sm" data-show>${st.shown ? 'Hide' : 'Show'} the answer</button></div>
      <div data-msg class="small" style="margin-top:8px">${st.msg}</div>
      ${st.shown ? `<div style="margin-top:10px">${isD ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:10px"><div style="border:2px solid var(--good);border-radius:10px;padding:8px;overflow-x:auto"><div class="small"><strong>Correct (lecture algorithm)</strong></div>${svgBox(r.tree)}</div><div style="border:2px solid var(--bad);border-radius:10px;padding:8px;overflow-x:auto"><div class="small"><strong>Printed model answer</strong></div>${svgBox(OFF)}</div></div>
        <div class="callout trap" style="margin-top:10px"><i class="ph ph-warning"></i><div><strong>Erratum.</strong> The original tree minus 21 has ${want.length} keys: ${want.join(', ')}. The printed answer has ${okKeys.length}: it has lost <strong>${lost.join(' and ')}</strong>. Correct: leaf [20] merges with [23, 35], the empty parent borrows from [7, 12] through the root, and the root becomes [12]. The printed picture is a valid-looking B+ tree, but it no longer indexes all the records. Count the keys!</div></div>`
        : `<div style="overflow-x:auto">${bptreeSVG(r.tree)}</div><p class="small" style="margin-top:6px">The printed model answer for this part is the same tree.</p>`}
        ${stepPanel(r.steps, st.at, MT)}</div>` : ''}
    </div>`;
    st._r = r; st._exp = exp;
  };
  const check = () => {
    const o = OPS[st.i], r = res(o), want = B.leaves(r.tree).map(l => l.keys);
    let got; try { got = st.text.split(/[|;/]/).map(g => g.trim()).filter(Boolean).map(g => g.split(/[\s,]+/).filter(Boolean).map(Number)); if (got.flat().some(Number.isNaN) || !got.length) throw 0; } catch (e) { st.msg = 'Type the leaves as numbers, groups separated by |.'; return; }
    const same = JSON.stringify(got) === JSON.stringify(want), flatW = want.flat(), flatG = got.flat();
    if (same) st.msg = `<span style="color:var(--good)"><strong>Correct leaves.</strong></span> Also check the non-leaf keys above them (open the answer to compare).`;
    else {
      const lost = flatW.filter(k => !flatG.includes(k)), extra = flatG.filter(k => !flatW.includes(k));
      const offLeaves = JSON.stringify(B.leaves(OFF).map(l => l.keys));
      st.msg = lost.length || extra.length ? `<span style="color:var(--bad)"><strong>Different key set.</strong></span> ${lost.length ? `Missing: ${lost.join(', ')}. ` : ''}${extra.length ? `Extra: ${extra.join(', ')}. ` : ''}${o.id === 'd' && JSON.stringify(got) === offLeaves ? 'This is the printed model answer, which loses 12 and 14.' : 'An insert adds one key and a delete removes exactly one.'}` : `<span style="color:var(--bad)"><strong>Same keys, different leaves.</strong></span> Check which keys sit in which leaf (borrowing moves one key over).`;
    }
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.op !== undefined) { st.i = +b.dataset.op; st.shown = false; st.msg = ''; st.text = ''; st.at = 0; render(); }
    else if ('check' in b.dataset) { st.text = $(el, '[data-text]').value; check(); render(); if (st.msg.includes('Correct leaves')) recordScore('u2-midterm-' + OPS[st.i].id, 1, 1); }
    else if ('show' in b.dataset) { st.text = $(el, '[data-text]').value; st.shown = !st.shown; st.at = 0; render(); }
    else if (b.dataset.sp) { const last = st._r.steps.length - 1; st.text = $(el, '[data-text]').value; st.at = b.dataset.sp === 'prev' ? Math.max(0, st.at - 1) : b.dataset.sp === 'next' ? Math.min(last, st.at + 1) : last; render(); }
  });
  render();
}

// ============================================================ 7. sorters
export function u2CopyMove(el) {
  sorter(el, {
    id: 'u2-copymove', icon: 'arrows-split', title: 'Copied up or moved up?', hint: 'A split sends one key to the parent. Does the key also stay below (copied up), or does it leave the node (moved up)?',
    options: ['Copied up', 'Moved up'],
    items: [
      { t: 'n = 3. Leaf [31, 37, 40, 41] splits into [31, 37] and [40, 41]. The key 40 goes to the parent.', a: 'Copied up', why: 'Leaf split: 40 must stay in the leaf level, where the record pointers are.' },
      { t: 'n = 3. Non-leaf [23, 31, 40, 43] splits into [23, 31] and [43]. The key 40 goes to the parent.', a: 'Moved up', why: 'Non-leaf split: keys are only signposts, so the middle key leaves both halves.' },
      { t: 'n = 2. The single root leaf [5, 8, 12] overflows and splits. A new root with 8 is created.', a: 'Copied up', why: 'The old root is a leaf, so it is a leaf split: 8 stays in the right leaf [8, 12].' },
      { t: 'n = 3. The root [10, 20, 30, 40] splits into [10, 20] and [40]. The key 30 becomes the new root.', a: 'Moved up', why: 'The root is a non-leaf. 30 is removed from both halves and is only in the new root.' },
      { t: 'n = 3. Leaf [12, 14, 18, 20] splits into [12, 14] and [18, 20]. The key 18 goes to the parent.', a: 'Copied up', why: 'Always the first key of the new right leaf, and it stays there.' },
      { t: 'n = 3. A non-leaf [3, 7, 14, 20] (after an insert from below) splits into [3, 7] and [20]. The key 14 goes up.', a: 'Moved up', why: 'Middle key of a non-leaf split: moved up.' },
      { t: 'n = 4. Leaf [1, 2, 3, 4, 5] splits into [1, 2, 3] and [4, 5]. Key 4 goes to the parent.', a: 'Copied up', why: 'Even with the extra key on the left, a leaf split copies the first key of the right leaf.' },
      { t: 'n = 2. Non-leaf [8, 12, 23] splits into [8] and [23]. The key 12 goes up.', a: 'Moved up', why: 'With n = 2 a non-leaf of 3 keys splits 1 + 1 and the middle key moves up.' },
    ],
  });
}
export function u2BorrowMerge(el) {
  sorter(el, {
    id: 'u2-borrowmerge', icon: 'git-merge', title: 'Borrow or merge?', hint: 'A deletion just happened. What is the first correct repair step? Remember: borrow if a sibling has more than the minimum, merge only otherwise.',
    options: ['Nothing to do', 'Borrow', 'Merge'], cols: 280,
    items: [
      { t: 'n = 3 (leaf min 2). Leaf [2, 3, 5] loses 5 and becomes [2, 3].', a: 'Nothing to do', why: '2 keys is still the minimum.' },
      { t: 'n = 3. Leaf [11] after a deletion. Its left sibling is [2, 3, 5]; there is no right sibling under this parent.', a: 'Borrow', why: 'The sibling has 3 keys, more than the minimum 2. Move 5 over.' },
      { t: 'n = 3. Leaf [5] after a deletion. Its only sibling is [2, 3].', a: 'Merge', why: 'The sibling is at the minimum and cannot lend. [2, 3, 5] fits in a node of 3 keys.' },
      { t: 'n = 4 (min 2). Leaf [40] after deleting 50. The left sibling is [10, 20, 30].', a: 'Borrow', why: 'Left sibling has 3 keys, one spare. Borrow 30 (the slide 39 figure merges instead, but the rule says borrow first).' },
      { t: 'n = 4. Leaf [40]. Left sibling [10, 20] and right sibling [100, 110], both at the minimum.', a: 'Merge', why: 'Neither can lend. Merge with a sibling: [10, 20, 40] fits (3 ≤ 4).' },
      { t: 'n = 3. A non-leaf is left with 0 keys (one pointer). Its sibling holds [23, 31, 43].', a: 'Borrow', why: 'Rotate through the parent: the sibling has more than the minimum 1 key.' },
      { t: 'n = 4 (non-leaf min 2 keys). A non-leaf has [40]. Its sibling is [10, 20] and the parent key between them is 25.', a: 'Merge', why: 'The sibling is at the minimum. Merge into [10, 20, 25, 40]: the parent key comes down (1 + 1 + 2 = 4 ≤ 4).' },
      { t: 'n = 5 (leaf min 3). Leaf [7, 9] after a deletion. Its right sibling is [10, 11, 17, 19].', a: 'Borrow', why: 'The sibling has 4 keys, more than the minimum 3. Borrow 10.' },
      { t: 'n = 5 (leaf min 3). Leaf [7, 9] after a deletion. Its right sibling is [10, 11, 17].', a: 'Merge', why: 'The sibling is at the minimum 3. 2 + 3 = 5 keys fit in one leaf.' },
      { t: 'n = 3. The root [30] has leaves [10, 20] and [30, 40]. Delete 40, then [30] must be repaired.', a: 'Merge', why: 'Leaf [30] is below 2 keys and [10, 20] is at the minimum, so merge into [10, 20, 30]. The root then has no keys and the tree shrinks to one leaf.' },
    ],
  });
}
