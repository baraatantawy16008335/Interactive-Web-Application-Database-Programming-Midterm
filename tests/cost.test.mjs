import * as C from '../js/engine/cost.js';
let pass = 0, fails = 0;
const near = (name, got, want, tol = 0.6) => { if (Math.abs(got - want) > tol) { fails++; console.log('FAIL', name, got, want); } else pass++; };
// Lecture 5 projection
const b1 = C.blocks({ T: 10000, tupleBytes: 120, blockBytes: 1024, blockHeader: 24 }); near('B(R)', b1.value, 1250); near('per', b1.perBlock, 8);
near('B(U)', C.blocks({ T: 10000, tupleBytes: 20, blockBytes: 1024, blockHeader: 24 }).value, 200);
// PA5 5-2
near('5-2a', C.eq(10000, 10).value, 1000);
near('5-2b', C.rangeSel(400, '>', 20000000, 300000, 4500000000).value, 396, 1.5);
near('5-2c', C.join(10000 * 400 / 400, 2000, [[50, 2000]]).value, 10000);
// PA5 5-3
near('5-3-2', C.and(10000, [1 / 50, 1 / 3]).value, 66.67); near('5-3-3', C.or(10000, [1 / 50, 1 / 3]).value, 3533.33);
// PA5 5-4
const x = C.join(1000, 2000, [[20, 50]]).value; near('5-4 R⋈S', x, 40000); near('5-4 ⋈U', C.join(x, 5000, [[100, 500]]).value, 400000);
// PA5 5-5
near('5-5-1', 100 * 200 * 300 * 400 / (60 * 100 * 50), 8000);
near('5-5-4', C.join(6, 400, [[50, 40]]).value, 48); near('5-5-6', C.ineqThird(400).value, 133.33); near('5-5-9', C.thetaJoin(200, 300).value, 20000);
// Midterm 2025
near('MT a', C.eq(40000, 2000).value, 20); near('MT b', C.rangeSel(40000, '>=', 80, 40, 200).value, 30000, 1);
near('MT c', C.thetaJoin(40000, 80000).value, 1066666666.67, 1); near('MT d', C.distinct(80000).value, 40000);
console.log(C.rangeSel(40000, '>=', 80, 40, 200).work);
// Lecture 5 slide 40: two plans
const stats = { R: { T: 5000, V: { a: 50, b: 100 } }, S: { T: 2000, V: { b: 200, c: 100 } } };
const sel = { op: 'select', cond: { attr: 'a', cmp: '=', val: 10 }, in: { op: 'rel', name: 'R' } };
const alt1 = C.estimate({ op: 'join', on: ['b'], l: { op: 'distinct', in: sel }, r: { op: 'distinct', in: { op: 'rel', name: 'S' } } }, stats);
const alt2 = C.estimate({ op: 'distinct', in: { op: 'join', on: ['b'], l: sel, r: { op: 'rel', name: 'S' } } }, stats);
near('alt1 root', alt1.T, 250); near('alt1 cost', C.planCost(alt1).value, 1150); near('alt2 root', alt2.T, 500); near('alt2 cost', C.planCost(alt2).value, 1100);
console.log(`cost: ${pass} passed, ${fails} failed`);
{ // PA5 5-5 #4 through estimate(): V(Y,d) must stay 50 after the selection
  const st = { Y: { T: 300, V: { c: 50, d: 50 } }, Z: { T: 400, V: { d: 40, e: 100 } } };
  const e = C.estimate({ op: 'join', on: ['d'], l: { op: 'select', cond: { attr: 'c', cmp: '=', val: 20 }, in: { op: 'rel', name: 'Y' } }, r: { op: 'rel', name: 'Z' } }, st);
  console.log(Math.abs(e.T - 48) < 0.6 ? 'estimate 5-5 #4 ok (48)' : 'FAIL estimate 5-5 #4 ' + e.T);
}
