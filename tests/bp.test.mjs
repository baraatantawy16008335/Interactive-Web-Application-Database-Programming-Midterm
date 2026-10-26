import * as B from '../js/engine/bptree.js';
let fails = 0, pass = 0;
const S = x => JSON.stringify(x);
function eq(name, tree, exp) {
  const got = B.toSpec(tree), v = B.validate(tree);
  if (S(got) !== S(exp) || v.length) { fails++; console.log('FAIL', name, '\n  got ', S(got), '\n  want', S(exp), v.length ? '\n  invalid: ' + v.join('; ') : ''); }
  else pass++;
}
const ins = (t, ...ks) => ks.reduce((a, k) => B.insert(a, k).tree, t);
const del = (t, ...ks) => ks.reduce((a, k) => B.remove(a, k).tree, t);
// Lecture 2 tree, n = 3
const L13 = { k: [13], c: [{ k: [7], c: [[2, 3, 5], [7, 11]] }, { k: [23, 31, 43], c: [[13, 17, 19], [23, 29], [31, 37, 41], [43, 47]] }] };
const t13 = B.fromSpec(3, L13);
eq('L2 insert 12', ins(t13, 12), { k: [13], c: [{ k: [7], c: [[2, 3, 5], [7, 11, 12]] }, L13.c[1]] });
eq('L2 insert 40', ins(t13, 40), { k: [13, 40], c: [L13.c[0], { k: [23, 31], c: [[13, 17, 19], [23, 29], [31, 37]] }, { k: [43], c: [[40, 41], [43, 47]] }] });
eq('L2 delete 37', del(t13, 37), { k: [13], c: [L13.c[0], { k: [23, 31, 43], c: [[13, 17, 19], [23, 29], [31, 41], [43, 47]] }] });
const a7 = del(t13, 7);
eq('L2 delete 7', a7, { k: [13], c: [{ k: [5], c: [[2, 3], [5, 11]] }, L13.c[1]] });
eq('L2 delete 7 then 11', del(a7, 11), { k: [23], c: [{ k: [13], c: [[2, 3, 5], [13, 17, 19]] }, { k: [31, 43], c: [[23, 29], [31, 37, 41], [43, 47]] }] });
const s37 = B.search(t13, 37); if (s37.nodes !== 3 || !s37.found) { fails++; console.log('FAIL lookup 37', s37); } else pass++;
eq('L2 insert 45 (root split)', ins(B.fromSpec(3, { k: [10, 20, 30], c: [[1, 2, 3], [10, 12], [20, 25], [30, 32, 40]] }), 45),
  { k: [30], c: [{ k: [10, 20], c: [[1, 2, 3], [10, 12], [20, 25]] }, { k: [40], c: [[30, 32], [40, 45]] }] });
const T50 = { k: [10, 40, 100], c: [[1, 5], [10, 20, 30], [40, 50], [100, 110]] };
eq('L2 delete 50 (rules: borrow first)', del(B.fromSpec(4, T50), 50), { k: [10, 30, 100], c: [[1, 5], [10, 20], [30, 40], [100, 110]] });
eq('L2 delete 50 (slide figure: merge)', del(B.fromSpec(4, T50, { mergeFirst: true }), 50), { k: [10, 100], c: [[1, 5], [10, 20, 30, 40], [100, 110]] });
eq('L2 delete 37 n=4 non-leaf coalescing', del(B.fromSpec(4, { k: [25], c: [{ k: [10, 20], c: [[1, 3], [10, 14], [20, 22]] }, { k: [30, 40], c: [[25, 26], [30, 37], [40, 45]] }] }), 37),
  { k: [10, 20, 25, 40], c: [[1, 3], [10, 14], [20, 22], [25, 26, 30], [40, 45]] });
// PA2-1
const P21 = B.fromSpec(3, { k: [17], c: [{ k: [7], c: [[2, 3, 5], [7, 13]] }, { k: [37, 43], c: [[17, 18, 36], [37, 38], [43, 47, 49]] }] });
const P21R = { k: [37, 43], c: [[17, 18, 36], [37, 38], [43, 47, 49]] };
const p1 = ins(P21, 1); eq('PA2-1 insert 1', p1, { k: [17], c: [{ k: [3, 7], c: [[1, 2], [3, 5], [7, 13]] }, P21R] });
eq('PA2-1 insert 14', ins(p1, 14), { k: [17], c: [{ k: [3, 7], c: [[1, 2], [3, 5], [7, 13, 14]] }, P21R] });
eq('PA2-1 insert 14,15', ins(p1, 14, 15), { k: [17], c: [{ k: [3, 7, 14], c: [[1, 2], [3, 5], [7, 13], [14, 15]] }, P21R] });
eq('PA2-1 insert 14..16', ins(p1, 14, 15, 16), { k: [17], c: [{ k: [3, 7, 14], c: [[1, 2], [3, 5], [7, 13], [14, 15, 16]] }, P21R] });
{ const r = B.range(P21, 20, 45); if (S(r.keys) !== S([36, 37, 38, 43])) { fails++; console.log('FAIL range', r.keys); } else pass++; }
// PA2-2 n = 2, right leaf keeps the extra key
const keys22 = [12, 8, 1, 23, 5, 7, 2, 28, 9, 18, 24, 40, 48];
const t22 = B.build(2, keys22, { leafSplit: 'right' });
eq('PA2-2 after 7', B.build(2, [12, 8, 1, 23, 5, 7], { leafSplit: 'right' }), { k: [8], c: [{ k: [5], c: [[1], [5, 7]] }, { k: [12], c: [[8], [12, 23]] }] });
eq('PA2-2 after 24', B.build(2, keys22.slice(0, 11), { leafSplit: 'right' }), { k: [8, 23], c: [{ k: [5], c: [[1, 2], [5, 7]] }, { k: [12], c: [[8, 9], [12, 18]] }, { k: [24], c: [[23], [24, 28]] }] });
const F22 = { k: [23], c: [{ k: [8], c: [{ k: [5], c: [[1, 2], [5, 7]] }, { k: [12], c: [[8, 9], [12, 18]] }] }, { k: [28], c: [{ k: [24], c: [[23], [24]] }, { k: [40], c: [[28], [40, 48]] }] }] };
eq('PA2-2 final', t22, F22);
// PA2-3 deletions (redistribute first, either sibling)
let t = B.fromSpec(2, F22, { leafSplit: 'right' });
const exp23 = {
  48: { k: [23], c: [{ k: [8], c: [{ k: [5], c: [[1, 2], [5, 7]] }, { k: [12], c: [[8, 9], [12, 18]] }] }, { k: [28], c: [{ k: [24], c: [[23], [24]] }, { k: [40], c: [[28], [40]] }] }] },
  40: { k: [8, 23], c: [{ k: [5], c: [[1, 2], [5, 7]] }, { k: [12], c: [[8, 9], [12, 18]] }, { k: [24, 28], c: [[23], [24], [28]] }] },
  2: { k: [8, 23], c: [{ k: [5], c: [[1], [5, 7]] }, { k: [12], c: [[8, 9], [12, 18]] }, { k: [24, 28], c: [[23], [24], [28]] }] },
  18: { k: [8, 23], c: [{ k: [5], c: [[1], [5, 7]] }, { k: [12], c: [[8, 9], [12]] }, { k: [24, 28], c: [[23], [24], [28]] }] },
  12: { k: [8, 23], c: [{ k: [5], c: [[1], [5, 7]] }, { k: [9], c: [[8], [9]] }, { k: [24, 28], c: [[23], [24], [28]] }] },
  9: { k: [8, 24], c: [{ k: [5], c: [[1], [5, 7]] }, { k: [23], c: [[8], [23]] }, { k: [28], c: [[24], [28]] }] },
  5: { k: [8, 24], c: [{ k: [7], c: [[1], [7]] }, { k: [23], c: [[8], [23]] }, { k: [28], c: [[24], [28]] }] },
  23: { k: [24], c: [{ k: [7, 8], c: [[1], [7], [8]] }, { k: [28], c: [[24], [28]] }] },
  24: { k: [8], c: [{ k: [7], c: [[1], [7]] }, { k: [28], c: [[8], [28]] }] },
  28: { k: [7, 8], c: [[1], [7], [8]] },
};
for (const k of [48, 40, 2, 18, 12, 9, 5, 23, 24, 28]) { t = del(t, k); eq('PA2-3 delete ' + k, t, exp23[k]); }
// PA2-4 n = 4, left leaf keeps the extra key, prefer the left sibling
const P24 = B.fromSpec(4, { k: [65], c: [{ k: [14, 23], c: [[1, 2, 4], [14, 16], [23, 32, 40]] }, { k: [67, 80, 120], c: [[65, 66], [67, 68], [80, 90, 100], [120, 200, 220]] }] }, { siblings: 'left' });
const L24 = { k: [14, 23], c: [[1, 2, 4], [14, 16], [23, 32, 40]] };
let u = del(P24, 68); eq('PA2-4 a delete 68', u, { k: [65], c: [L24, { k: [80, 120], c: [[65, 66, 67], [80, 90, 100], [120, 200, 220]] }] });
u = del(u, 80); eq('PA2-4 b delete 80', u, { k: [65], c: [L24, { k: [90, 120], c: [[65, 66, 67], [90, 100], [120, 200, 220]] }] });
u = ins(u, 3); const L24b = { k: [14, 23], c: [[1, 2, 3, 4], [14, 16], [23, 32, 40]] }; eq('PA2-4 c insert 3', u, { k: [65], c: [L24b, { k: [90, 120], c: [[65, 66, 67], [90, 100], [120, 200, 220]] }] });
u = del(u, 200); eq('PA2-4 d delete 200', u, { k: [65], c: [L24b, { k: [90, 120], c: [[65, 66, 67], [90, 100], [120, 220]] }] });
u = del(u, 66); eq('PA2-4 e delete 66', u, { k: [65], c: [L24b, { k: [90, 120], c: [[65, 67], [90, 100], [120, 220]] }] });
// PA2-5 / 2-6
const keys25 = [2, 3, 5, 7, 11, 17, 19, 23, 29, 31];
const a25 = B.build(3, keys25); eq('PA2-5 a (4 pointers)', a25, { k: [19], c: [{ k: [5, 11], c: [[2, 3], [5, 7], [11, 17]] }, { k: [29], c: [[19, 23], [29, 31]] }] });
const b25 = B.build(5, keys25); eq('PA2-5 b (6 pointers)', b25, { k: [7, 19], c: [[2, 3, 5], [7, 11, 17], [19, 23, 29, 31]] });
let a = ins(a25, 9); eq('PA2-6 a1', a, { k: [19], c: [{ k: [5, 11], c: [[2, 3], [5, 7, 9], [11, 17]] }, { k: [29], c: [[19, 23], [29, 31]] }] });
a = ins(a, 10); eq('PA2-6 a2', a, { k: [19], c: [{ k: [5, 9, 11], c: [[2, 3], [5, 7], [9, 10], [11, 17]] }, { k: [29], c: [[19, 23], [29, 31]] }] });
a = ins(a, 8); eq('PA2-6 a3', a, { k: [19], c: [{ k: [5, 9, 11], c: [[2, 3], [5, 7, 8], [9, 10], [11, 17]] }, { k: [29], c: [[19, 23], [29, 31]] }] });
a = del(a, 23); eq('PA2-6 a4', a, { k: [11], c: [{ k: [5, 9], c: [[2, 3], [5, 7, 8], [9, 10]] }, { k: [19], c: [[11, 17], [19, 29, 31]] }] });
a = del(a, 19); eq('PA2-6 a5', a, { k: [11], c: [{ k: [5, 9], c: [[2, 3], [5, 7, 8], [9, 10]] }, { k: [29], c: [[11, 17], [29, 31]] }] });
let b = ins(b25, 9, 10); eq('PA2-6 b2', b, { k: [7, 19], c: [[2, 3, 5], [7, 9, 10, 11, 17], [19, 23, 29, 31]] });
b = ins(b, 8); eq('PA2-6 b3', b, { k: [7, 10, 19], c: [[2, 3, 5], [7, 8, 9], [10, 11, 17], [19, 23, 29, 31]] });
b = del(b, 23); eq('PA2-6 b4', b, { k: [7, 10, 19], c: [[2, 3, 5], [7, 8, 9], [10, 11, 17], [19, 29, 31]] });
b = del(b, 19); eq('PA2-6 b5', b, { k: [7, 10], c: [[2, 3, 5], [7, 8, 9], [10, 11, 17, 29, 31]] });
// Midterm 2025, n = 3
const MT = B.fromSpec(3, { k: [20], c: [{ k: [7, 12], c: [[1, 3, 5], [7, 9], [12, 14]] }, { k: [23], c: [[20, 21], [23, 35]] }] });
eq('MT insert 18', ins(MT, 18), { k: [20], c: [{ k: [7, 12], c: [[1, 3, 5], [7, 9], [12, 14, 18]] }, { k: [23], c: [[20, 21], [23, 35]] }] });
eq('MT delete 3', del(MT, 3), { k: [20], c: [{ k: [7, 12], c: [[1, 5], [7, 9], [12, 14]] }, { k: [23], c: [[20, 21], [23, 35]] }] });
eq('MT delete 7', del(MT, 7), { k: [20], c: [{ k: [5, 12], c: [[1, 3], [5, 9], [12, 14]] }, { k: [23], c: [[20, 21], [23, 35]] }] });
eq('MT delete 21 (correct answer)', del(MT, 21), { k: [12], c: [{ k: [7], c: [[1, 3, 5], [7, 9]] }, { k: [20], c: [[12, 14], [20, 23, 35]] }] });
// limits
const l3 = B.limits(3), l4 = B.limits(4);
if (S([l3.leaf.minKeys, l3.leaf.minPtrs, l3.nonleaf.minKeys, l3.nonleaf.minPtrs, l4.leaf.minKeys, l4.nonleaf.minKeys]) !== S([2, 3, 1, 2, 2, 2])) { fails++; console.log('FAIL limits'); } else pass++;
if (B.nFromBlock(4096, 4, 8) !== 340) { fails++; console.log('FAIL nFromBlock'); } else pass++;
// random stress: many inserts/deletes stay valid and keep the right key set
for (const n of [2, 3, 4, 5]) for (const opts of [{}, { leafSplit: 'right' }, { siblings: 'left' }, { mergeFirst: true }]) {
  let tt = B.empty(n, opts), set = new Set(), seed = n * 97 + Object.keys(opts).length;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let s = 0; s < 1500; s++) {
    const k = Math.floor(rnd() * 120);
    if (rnd() < .6) { tt = B.insert(tt, k).tree; set.add(k); } else { tt = B.remove(tt, k).tree; set.delete(k); }
    const v = B.validate(tt), ks = B.allKeys(tt);
    if (v.length || S(ks) !== S([...set].sort((x, y) => x - y))) { fails++; console.log('FAIL stress', n, S(opts), s, v, S(ks)); break; }
  }
  pass++;
}
console.log(`bptree: ${pass} passed, ${fails} failed`);
