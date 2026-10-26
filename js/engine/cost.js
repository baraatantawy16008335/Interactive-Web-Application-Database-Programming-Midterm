// Size estimation and logical plans (Lecture 5 and PA5). Every function returns { value, work } where
// work is the line of working an exam answer should show.
const f2 = v => Math.round(v * 100) / 100;
const fmt = v => (Number.isInteger(v) ? v : f2(v)).toLocaleString('en-US');

// -------------------------------------------------- projection: tuple size and blocks (Lecture 5 slide 30)
export function blocks({ T, tupleBytes, blockBytes, blockHeader = 0 }) {
  const per = Math.floor((blockBytes - blockHeader) / tupleBytes), B = Math.ceil(T / per);
  return { perBlock: per, value: B, work: `⌊(${blockBytes} − ${blockHeader}) / ${tupleBytes}⌋ = ${per} tuples per block, B = ⌈${fmt(T)} / ${per}⌉ = ${fmt(B)}` };
}
// -------------------------------------------------- selection
export const eq = (T, V) => ({ value: T / V, frac: 1 / V, work: `T(R) / V(R, a) = ${fmt(T)} / ${fmt(V)} = ${fmt(T / V)}` });
export const neq = (T, V) => ({ value: T * (1 - 1 / V), frac: 1 - 1 / V, work: `T(R) × (1 − 1/V(R, a)) = ${fmt(T)} × (1 − 1/${fmt(V)}) = ${fmt(T * (1 - 1 / V))} (≈ T(R) when V is large)` });
export const ineqThird = T => ({ value: T / 3, frac: 1 / 3, work: `T(R) / 3 = ${fmt(T)} / 3 = ${fmt(T / 3)}` });
export const ineqHalf = T => ({ value: T / 2, frac: 1 / 2, work: `T(R) / 2 = ${fmt(T)} / 2 = ${fmt(T / 2)}` });
// With known MIN and MAX (integers), the fraction of the value range that matches:
//   a > v : (max − v) / (max − min + 1)        a >= v : (max − v + 1) / (max − min + 1)
//   a < v : (v − min) / (max − min + 1)        a <= v : (v − min + 1) / (max − min + 1)
// (PA5 5-2b uses the "> v" form, the 2025 midterm uses the ">= v" form.)
export function rangeFrac(op, v, min, max) {
  const den = max - min + 1;
  const num = op === '>' ? max - v : op === '>=' ? max - v + 1 : op === '<' ? v - min : v - min + 1;
  const f = Math.max(0, Math.min(1, num / den));
  const numTxt = op === '>' ? `${fmt(max)} − ${fmt(v)}` : op === '>=' ? `${fmt(max)} − ${fmt(v)} + 1` : op === '<' ? `${fmt(v)} − ${fmt(min)}` : `${fmt(v)} − ${fmt(min)} + 1`;
  return { frac: f, work: `f = (${numTxt}) / (${fmt(max)} − ${fmt(min)} + 1) = ${fmt(num)} / ${fmt(den)} ≈ ${Math.floor(f * 100 + 1e-9) / 100}` };
}
// The course model answers cut f to 2 decimals before multiplying (PA5: 0.9956 → 0.99, 0.99 × 400 = 396; midterm: 0.7516 → 0.75, 0.75 × 40,000 = 30,000).
export function rangeSel(T, op, v, min, max, { roundF = true } = {}) {
  const r = rangeFrac(op, v, min, max), f = roundF ? Math.floor(r.frac * 100 + 1e-9) / 100 : r.frac;
  return { value: T * f, frac: f, work: `${r.work}; T(S) = T(R) × f = ${fmt(T)} × ${f2(f)} = ${fmt(T * f)}` };
}
// AND: multiply the fractions. OR: add the two estimates (Lecture 5 slide 34). Contradictions give 0.
export const and = (T, fracs) => ({ value: fracs.reduce((a, f) => a * f, T), work: `T(R) × ${fracs.map(f2).join(' × ')} = ${fmt(fracs.reduce((a, f) => a * f, T))}` });
export const or = (T, fracs) => ({ value: fracs.reduce((a, f) => a + T * f, 0), work: fracs.map(f => fmt(T * f)).join(' + ') + ` = ${fmt(fracs.reduce((a, f) => a + T * f, 0))}` });

// -------------------------------------------------- products and joins
export const product = (T1, T2) => ({ value: T1 * T2, work: `T(R) × T(S) = ${fmt(T1)} × ${fmt(T2)} = ${fmt(T1 * T2)}` });
// Natural / equi-join on one or more shared attributes: divide by max(V) for EACH shared attribute.
export function join(T1, T2, pairs) { // pairs: [[V(R,y), V(S,y)], ...]
  const den = pairs.reduce((a, [x, y]) => a * Math.max(x, y), 1), v = T1 * T2 / den;
  return { value: v, work: `${fmt(T1)} × ${fmt(T2)} / ${pairs.map(([x, y]) => `max(${fmt(x)}, ${fmt(y)})`).join(' × ')} = ${fmt(T1 * T2)} / ${fmt(den)} = ${fmt(v)}` };
}
export const thetaJoin = (T1, T2) => ({ value: T1 * T2 / 3, work: `Non-equality join condition: T(R) × T(S) / 3 = ${fmt(T1)} × ${fmt(T2)} / 3 = ${fmt(T1 * T2 / 3)}` });
// -------------------------------------------------- set operations and δ (Lecture 5 slides 36-37)
export const union = (a, b) => ({ value: a + b, work: `T(R) + T(S) = ${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}` });
export const intersect = (a, b) => ({ value: Math.min(a, b) / 2, work: `min(T(R), T(S)) / 2 = ${fmt(Math.min(a, b))} / 2 = ${fmt(Math.min(a, b) / 2)}` });
export const difference = (a, b) => ({ value: (a - b) / 2, work: `(T(R) − T(S)) / 2 = (${fmt(a)} − ${fmt(b)}) / 2 = ${fmt((a - b) / 2)}` });
export const distinct = a => ({ value: a / 2, work: `T(R) / 2 = ${fmt(a)} / 2 = ${fmt(a / 2)}` });

// -------------------------------------------------- whole logical plans
// stats: { R: { T: 5000, V: { a: 50, b: 100 } }, S: {...} }
// plan node: { op: 'rel', name } | { op: 'select', cond: { attr, cmp: '=', '!=', '<', '>', '<=', '>=', val }, in }
//   | { op: 'join', on: ['b'] (shared attrs; [] = product), theta?: true, l, r } | { op: 'product', l, r }
//   | { op: 'distinct', in } | { op: 'project', attrs, in }
// Returns the plan annotated with .T (estimated size), .V (distinct counts carried up) and .work.
// V values carry up UNCHANGED from the base relations, as in every course example (PA5 5-5 #4 uses V(Y,d) = 50 after
// σc=20(Y) shrank Y to 6 tuples; slide 40 keeps V(R,b) = 100 after σ and δ). An equality selection sets V(attr) = 1.
export function estimate(plan, stats) {
  const go = nd => {
    const n = { ...nd };
    if (nd.op === 'rel') { const s = stats[nd.name]; n.T = s.T; n.V = { ...s.V }; n.work = `T(${nd.name}) = ${fmt(s.T)}`; return n; }
    if (nd.op === 'select') {
      n.in = go(nd.in); const T = n.in.T, c = nd.cond, V = n.in.V[c.attr];
      let r;
      if (c.cmp === '=') r = eq(T, V); else if (c.cmp === '!=') r = neq(T, V);
      else if (c.min != null && c.max != null) r = rangeSel(T, c.cmp, c.val, c.min, c.max); else r = ineqThird(T);
      n.T = r.value; n.work = `σ ${c.attr} ${c.cmp} ${c.val}: ${r.work}`;
      n.V = Object.fromEntries(Object.entries(n.in.V).map(([k, v]) => [k, c.cmp === '=' && k === c.attr ? 1 : v]));
      return n;
    }
    if (nd.op === 'distinct') { n.in = go(nd.in); const r = distinct(n.in.T); n.T = r.value; n.V = { ...n.in.V }; n.work = `δ: ${r.work}`; return n; }
    if (nd.op === 'project') { n.in = go(nd.in); n.T = n.in.T; n.V = Object.fromEntries(Object.entries(n.in.V).filter(([k]) => nd.attrs.includes(k))); n.work = `π (bag): the number of tuples does not change, T = ${fmt(n.T)}`; return n; }
    if (nd.op === 'join' || nd.op === 'product') {
      n.l = go(nd.l); n.r = go(nd.r);
      let r;
      if (nd.op === 'product' || !nd.on || !nd.on.length) r = nd.theta ? thetaJoin(n.l.T, n.r.T) : product(n.l.T, n.r.T);
      else r = join(n.l.T, n.r.T, nd.on.map(a => [n.l.V[a], n.r.V[a]]));
      n.T = r.value; n.work = (nd.op === 'join' && nd.on?.length ? `⋈ on ${nd.on.join(', ')}: ` : nd.theta ? '⋈θ: ' : '×: ') + r.work;
      n.V = { ...n.l.V };
      Object.entries(n.r.V).forEach(([k, v]) => { n.V[k] = n.V[k] != null ? Math.min(n.V[k], v) : v; });
      return n;
    }
    throw new Error('unknown op ' + nd.op);
  };
  return go(plan);
}
// Cost of a plan = sum of the sizes of its INTERMEDIATE results: every node except the leaves (base tables)
// and the root (the final answer, the same for every equivalent plan). Lecture 5 slide 40.
export function planCost(est) {
  const parts = [];
  const walk = (nd, isRoot) => {
    if (nd.op === 'rel') return;
    if (!isRoot) parts.push(nd.T);
    [nd.in, nd.l, nd.r].filter(Boolean).forEach(c => walk(c, false));
  };
  walk(est, true);
  return { value: parts.reduce((a, b) => a + b, 0), parts };
}
export const label = nd => nd.op === 'rel' ? nd.name : nd.op === 'select' ? `σ ${nd.cond.attr} ${nd.cond.cmp === '!=' ? '≠' : nd.cond.cmp === '>=' ? '≥' : nd.cond.cmp === '<=' ? '≤' : nd.cond.cmp} ${nd.cond.val}`
  : nd.op === 'distinct' ? 'δ' : nd.op === 'project' ? `π ${nd.attrs.join(', ')}` : nd.op === 'product' ? '×' : nd.theta ? `⋈ ${nd.cond || 'θ'}` : `⋈${nd.on && nd.on.length ? ' ' + nd.on.join(', ') : ''}`;
export { fmt, f2 };
