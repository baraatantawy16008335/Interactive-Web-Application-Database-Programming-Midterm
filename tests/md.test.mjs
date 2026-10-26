import * as M from '../js/engine/multidim.js';
let pass = 0, fails = 0; const S = x => JSON.stringify(x);
function eq(name, got, want) { if (S(got) !== S(want)) { fails++; console.log('FAIL', name, '\n  got ', S(got), '\n  want', S(want)); } else pass++; }
const R = (id, ...v) => ({ id, v });
// KD: lecture tree (attrs Salary, Age? the root is Salary): use [Age, Salary] values with attr index
// Lecture tree: Salary150 / Age60 / Salary80 / Age38 ...  attrs = ['Salary','Age'], records v = [salary, age]
const P = (a, s) => ({ id: `${a},${s}`, v: [s, a] });
const lec = M.kdNew(['Salary', 'Age'], 2, {
  attr: 0, val: 150,
  left: { attr: 1, val: 60, left: { attr: 0, val: 80, left: { attr: 1, val: 38, left: { recs: [P(25, 60)] }, right: { recs: [P(45, 60), P(50, 75)] } }, right: { recs: [P(50, 100), P(50, 120)] } }, right: { recs: [P(70, 110), P(85, 140)] } },
  right: { attr: 1, val: 47, left: { attr: 0, val: 300, left: { recs: [P(30, 260)] }, right: { recs: [P(25, 400), P(45, 350)] } }, right: { recs: [P(50, 275), P(60, 260)] } },
});
const ids = nd => nd.recs ? nd.recs.map(r => r.id) : { [`${nd.attr}:${nd.val}`]: [ids(nd.left), ids(nd.right)] };
const a1 = M.kdInsert(lec, P(35, 280)).tree;
eq('L4 kd insert (35,280)', ids(a1.root.right.left), { '0:300': [['30,260', '35,280'], ['25,400', '45,350']] });
const a2 = M.kdInsert(lec, P(35, 500)).tree;
eq('L4 kd insert (35,500)', ids(a2.root.right.left), { '0:300': [['30,260'], { '1:35': [['25,400'], ['45,350', '35,500']] }] });
eq('L4 kd search (50,100)', M.kdSearch(lec, [100, 50]).found, true);
// Midterm KD: attrs [GPA, AGE]
const G = (id, age, gpa) => ({ id, v: [gpa, age] });
const mt = M.kdNew(['GPA', 'AGE'], 2, { attr: 0, val: 2.56, left: { recs: [G('Jamal', 22, 1.2), G('Fatima', 21, 0.9)] }, right: { attr: 1, val: 17.3, left: { recs: [G('Sarah', 17, 3.8), G('Michael', 16, 4)] }, right: { recs: [G('Amina', 19, 2.7)] } } });
eq('MT kd a', ids(M.kdInsert(mt, G('Mohamed', 20, 1.6)).tree.root.left), { '1:21': [['Mohamed'], ['Jamal', 'Fatima']] });
eq('MT kd b', ids(M.kdInsert(mt, G('Mohamed', 20, 2.6)).tree.root.right.right), ['Amina', 'Mohamed']);
// PA4-5: Speed, Ram, HD; cap 2; mean split; insert in table order
const PC = [[1001, 2.66, 1024, 250], [1002, 2.10, 512, 250], [1003, 1.42, 512, 160], [1004, 2.80, 1024, 250], [1005, 3.20, 512, 250], [1006, 3.20, 1024, 300], [1007, 2.20, 1024, 200], [1008, 2.20, 2048, 250], [1009, 2.00, 1024, 250], [1010, 2.80, 2048, 300], [1011, 1.86, 2048, 160], [1012, 2.80, 1024, 160]];
let kd = M.kdNew(['Speed', 'Ram', 'HD'], 2);
PC.forEach(([id, ...v]) => kd = M.kdInsert(kd, { id, v }).tree);
console.log('PA4-5 kd:', S(ids(kd.root)));
// Quad: midterm
let q = M.quadNew({ x0: 0, y0: 0, x1: 100, y1: 200 }, 1);
q = M.quadInsert(q, { id: 'A', x: 60, y: 110 }).tree; q = M.quadInsert(q, { id: 'B', x: 30, y: 30 }).tree;
const qd = nd => nd.pts ? nd.pts.map(p => p.id).join('') : Object.fromEntries(['NW', 'NE', 'SW', 'SE'].map(k => [k, qd(nd[k])]).filter(([, v]) => v !== ''));
eq('MT quad start', qd(q.root), { NE: 'A', SW: 'B' });
const qc = M.quadInsert(q, { id: 'C', x: 30, y: 150 }).tree; eq('MT quad C → NW', qd(qc.root), { NW: 'C', NE: 'A', SW: 'B' });
const qD = M.quadInsert(q, { id: 'D', x: 40, y: 40 }).tree; eq('MT quad D', qd(qD.root), { NE: 'A', SW: { SE: { NW: 'B', NE: 'D' } } });
console.log('  centres', qD.root.SW.cx, qD.root.SW.cy, qD.root.SW.SE.cx, qD.root.SW.SE.cy);
// PA4-4
let r = M.quadNew({ x0: -128, y0: -128, x1: 128, y1: 128 }, 1);
r = M.quadInsert(r, { id: 'A', x: 100, y: 125 }).tree; r = M.quadInsert(r, { id: 'B', x: 25, y: -30 }).tree;
r = M.quadInsert(M.quadInsert(r, { id: 'C', x: -55, y: 80 }).tree, { id: 'D', x: 125, y: -60 }).tree;
eq('PA4-4 a', qd(r.root), { NW: 'C', NE: 'A', SE: { NW: 'B', NE: 'D' } });
r = M.quadInsert(r, { id: 'E', x: 80, y: 80 }).tree;
eq('PA4-4 b', qd(r.root), { NW: 'C', NE: { NE: { NE: 'A', SW: 'E' } }, SE: { NW: 'B', NE: 'D' } });
r = M.quadDelete(r, { x: 80, y: 80 }).tree; eq('PA4-4 c', qd(r.root), { NW: 'C', NE: 'A', SE: { NW: 'B', NE: 'D' } });
// Lecture quad: root (50,200) over 0..100 x 0..400, cap 2
const lp = [[25, 60], [45, 60], [50, 75], [50, 100], [85, 140], [50, 120], [70, 110], [50, 275], [60, 260], [30, 260], [25, 400], [45, 350]];
let lq = M.quadNew({ x0: 0, y0: 0, x1: 100, y1: 400 }, 2);
lp.forEach(([x, y]) => lq = M.quadInsert(lq, { id: `${x},${y}`, x, y }).tree);
console.log('L4 quad:', S(qd(lq.root)), lq.root.SE.cx, lq.root.SE.cy);
lq = M.quadInsert(lq, { id: '90,150', x: 90, y: 150 }).tree; console.log('  +90,150', S(qd(lq.root.SE)));
lq = M.quadInsert(lq, { id: '100,110', x: 100, y: 110 }).tree; console.log('  +100,110', S(qd(lq.root.SE)), lq.root.SE.NE.cx, lq.root.SE.NE.cy);
// Grid PA4-1: x = HD lines, y = Ram (use cells by value)
const lines = { x: [40, 55], y: [90, 225] };
eq('grid (52,200)', M.gridCell(lines, 52, 200), [1, 1]); eq('grid on line (40, 90)', M.gridCell(lines, 40, 90), [1, 1]);
// Bitmap midterm
const bm = M.bitmap([18, 20, 22, 18, 20, 22, 18, 20]);
eq('MT bitmap', bm, [{ value: 18, bits: '10010010' }, { value: 20, bits: '01001001' }, { value: 22, bits: '00100100' }]);
// PA4-2 bitmaps
const speed = PC.map(r => r[1]), ram = PC.map(r => r[2]), hd = PC.map(r => r[3]);
console.log('PA4-2 speed', S(M.bitmap(speed))); console.log('PA4-2 ram', S(M.bitmap(ram))); console.log('PA4-2 hd', S(M.bitmap(hd)));
const q1 = M.bitAnd(M.bitmap(speed).find(m => m.value === 2.2).bits, M.bitmap(hd).find(m => m.value === 250).bits);
eq('PA4-2 q1 (Speed=2.20 and HD=250) -> 1008', q1, '000000010000');
const q2 = M.bitAnd(M.bitWhere(M.bitmap(ram), v => v >= 1024).bits, M.bitWhere(M.bitmap(hd), v => v <= 200).bits);
eq('PA4-2 q2 (Ram>=1024 and HD<=200) -> 1007,1011,1012', q2, '000000100011');
// Partitioned hash PA4-6
const hHD = { 160: '00', 200: '01', 250: '10', 300: '11' }, hS = { 1.42: '000', 1.86: '001', 2: '010', 2.1: '011', 2.2: '100', 2.66: '101', 2.8: '110', 3.2: '111' };
const keys = Object.fromEntries(PC.map(([id, s, , h]) => [id, M.partKey([hHD, hS], [h, s])]));
eq('PA4-6 keys', keys, { 1001: '10101', 1002: '10011', 1003: '00000', 1004: '10110', 1005: '10111', 1006: '11111', 1007: '01100', 1008: '10100', 1009: '10010', 1010: '11110', 1011: '00001', 1012: '00110' });
eq('partial match buckets', M.partBuckets([{ toy: '0', sales: '1' }, { '10k': '01', '30k': '01', '20k': '11', '40k': '00' }], ['sales', null]), ['100', '101', '110', '111']);
console.log(`multidim: ${pass} passed, ${fails} failed`);
