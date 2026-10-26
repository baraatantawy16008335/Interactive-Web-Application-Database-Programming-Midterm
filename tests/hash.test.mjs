import * as H from '../js/engine/hash.js';
let pass = 0, fails = 0;
const S = x => JSON.stringify(x);
// canonical view of an extensible table: i plus, per directory entry, "j:sorted records"
const ext = s => ({ i: s.i, d: s.dir.map(id => `${s.buckets[id].j}:${[...s.buckets[id].recs].sort().join(',')}`) });
const lin = s => ({ n: s.n, b: s.buckets.map(b => [...b.recs].sort().join(',') + (b.over.length ? ' +' + [...b.over].sort().join(',') : '')) });
function eq(name, got, want) { if (S(got) !== S(want)) { fails++; console.log('FAIL', name, '\n  got ', S(got), '\n  want', S(want)); } else pass++; }
const insAll = (s, hs, f) => hs.reduce((a, h) => f(a, h).state, s);
// Lecture 3 extensible I (cap 3)
const L = H.extNew({ i: 1, cap: 3, buckets: [{ prefix: '0', j: 1, recs: [] }, { prefix: '1', j: 1, recs: ['1001', '1110'] }] });
const l3 = insAll(L, ['0000', '0001', '0010'], H.extInsert);
eq('L3 ext after 0010', ext(l3), { i: 1, d: ['1:0000,0001,0010', '1:1001,1110'] });
eq('L3 ext insert 0100', ext(H.extInsert(l3, '0100').state), { i: 2, d: ['2:0000,0001,0010', '2:0100', '1:1001,1110', '1:1001,1110'] });
eq('L3 ext insert 0011 (cascading split)', ext(H.extInsert(l3, '0011').state), { i: 3, d: ['3:0000,0001', '3:0010,0011', '2:', '2:', '1:1001,1110', '1:1001,1110', '1:1001,1110', '1:1001,1110'] });
// PA3-2 (cap 2)
let p = H.extNew({ i: 1, cap: 2, buckets: [{ prefix: '0', j: 1, recs: ['0001'] }, { prefix: '1', j: 1, recs: ['1001', '1100'] }] });
p = H.extInsert(p, '1010').state; eq('PA3-2 a', ext(p), { i: 2, d: ['1:0001', '1:0001', '2:1001,1010', '2:1100'] });
p = insAll(p, ['0000', '0111'], H.extInsert); eq('PA3-2 b', ext(p), { i: 2, d: ['2:0000,0001', '2:0111', '2:1001,1010', '2:1100'] });
p = H.extInsert(p, '1000').state; eq('PA3-2 c', ext(p), { i: 3, d: ['2:0000,0001', '2:0000,0001', '2:0111', '2:0111', '3:1000,1001', '3:1010', '2:1100', '2:1100'] });
// PA3-3 from an empty table (i = 0, one bucket)
const p33 = insAll(H.extNew({ i: 0, cap: 2, buckets: [{ prefix: '', j: 0, recs: [] }] }), ['0000', '0001', '0010', '0011', '0100', '0110', '1000'], H.extInsert);
eq('PA3-3', ext(p33), { i: 3, d: ['3:0000,0001', '3:0010,0011', '2:0100,0110', '2:0100,0110', '1:1000', '1:1000', '1:1000', '1:1000'] });
// Midterm 2025 (cap 3)
const M = H.extNew({ i: 1, cap: 3, buckets: [{ prefix: '0', j: 1, recs: ['0010', '0110', '0111'] }, { prefix: '1', j: 1, recs: ['1000'] }] });
eq('MT ext 0000', ext(H.extInsert(M, '0000').state), { i: 2, d: ['2:0000,0010', '2:0110,0111', '1:1000', '1:1000'] });
eq('MT ext 1111', ext(H.extInsert(M, '1111').state), { i: 1, d: ['1:0010,0110,0111', '1:1000,1111'] });
// Linear: Lecture 3
const LL = H.linNew({ n: 3, cap: 2, buckets: [['0000'], ['0001', '1001'], ['0110']] });
const l1 = H.linInsert(LL, '1111').state; eq('L3 lin 1111', lin(l1), { n: 3, b: ['0000', '0001,1001 +1111', '0110'] });
eq('L3 lin 0010', lin(H.linInsert(l1, '0010').state), { n: 4, b: ['0000', '0001,1001', '0010,0110', '1111'] });
// PA3-4
const p34 = insAll(H.linNew({ n: 2, cap: 2 }), ['0011', '1100', '0101', '1011', '0010', '1101', '0111', '1001', '0001'], H.linInsert);
eq('PA3-4', lin(p34), { n: 6, b: ['', '0001,1001', '0010', '0011,1011 +0111', '1100', '0101,1101'] });
// Midterm linear
const ML = H.linNew({ n: 3, cap: 2, buckets: [[], { recs: ['1001', '1101'], over: ['0011'] }, []] });
eq('MT lin 1111', lin(H.linInsert(ML, '1111').state), { n: 3, b: ['', '1001,1101 +0011,1111', ''] });
eq('MT lin 1110', lin(H.linInsert(ML, '1110').state), { n: 3, b: ['', '1001,1101 +0011', '1110'] });
// Static PA3-1 (cap 2): 0:[d] 1:[e,c] 2:[b] 3:[a,f]
let st = H.staticNew(4, 2, [['d'], ['e', 'c'], ['b'], ['a', 'f']]);
const sv = s => s.buckets.map(b => b.recs.join('') + (b.over.length ? '+' + b.over.map(o => o.join('')).join('|') : ''));
['g', 'h', 'i', 'j'].forEach((r, b) => st = H.staticInsert(st, b, r).state); eq('PA3-1 a', sv(st), ['dg', 'ec+h', 'bi', 'af+j']);
st = H.staticDelete(H.staticDelete(st, 'a').state, 'b').state; eq('PA3-1 b', sv(st), ['dg', 'ec+h', 'i', 'fj']);
['k', 'l', 'm', 'n'].forEach((r, b) => st = H.staticInsert(st, b, r).state); eq('PA3-1 c', sv(st), ['dg+k', 'ec+hl', 'im', 'fj+n']);
st = H.staticDelete(H.staticDelete(st, 'c').state, 'd').state; eq('PA3-1 d', sv(st), ['gk', 'eh+l', 'im', 'fj+n']);
console.log(`hash: ${pass} passed, ${fails} failed`);
