// Unit 5 simulators: query processing, logical plans, rewrite rules and size estimation.
import { bench, $, $$, on, seg, setSeg, esc } from '../viz.js';
import { recordScore } from '../store.js';
import { sorter } from './sorter.js';
import * as C from '../engine/cost.js';
import { planSVG } from '../engine/draw.js';

const nf = C.fmt, f2 = C.f2;
const KEYS = ['in', 'l', 'r'];
const kids = nd => KEYS.filter(k => nd[k]);
const uniq = a => [...new Set(a)];
const CMPSYM = { '>': '>', '>=': '≥', '<': '<', '<=': '≤' };

// ====================================================================================
// A small plan model on top of the engine's size formulas (cost.js).
// Course convention (PA5 5-5 #4, slide 40): the V(R,a) values stay as given, they are NOT capped after a selection.
// ====================================================================================
// conditions
const eqc = (attr, val) => ({ kind: 'eq', attr, text: `${attr} = ${val}`, attrs: [attr] });
const rgc = (attr, cmp, val, min, max) => ({ kind: 'range', attr, cmp, val, min, max, text: `${attr} ${CMPSYM[cmp]} ${val}`, attrs: [attr] });
const lkc = (attr, pat, num, den, why) => ({ kind: 'like', attr, frac: num / den, fracTxt: `${num}/${den}`, why, text: `${attr} LIKE '${pat}'`, attrs: [attr] });
const aeq = (a, b, text) => ({ kind: 'attreq', a, b, text: text || `${a} = ${b}`, attrs: [a, b] });
// nodes
const rel = name => ({ op: 'rel', name });
const sel = (conds, nd) => ({ op: 'select', conds: [].concat(conds), in: nd });
const jn = (l, r, pairs) => ({ op: 'join', pairs, l, r });
const prod = (l, r) => ({ op: 'product', l, r });
const dst = nd => ({ op: 'distinct', in: nd });
const prj = (attrs, nd) => ({ op: 'project', attrs, in: nd });
const grp = (fn, by, agg, nd) => ({ op: 'group', fn, by, agg, in: nd });

const pairTxt = ([a, b]) => (a === b ? a : `${a} = ${b}`);
const lbl = nd => nd.op === 'rel' ? nd.name
  : nd.op === 'select' ? 'σ ' + nd.conds.map(c => c.text).join(' ∧ ')
  : nd.op === 'join' ? '⋈ ' + (nd.theta ? nd.theta.text : nd.pairs.map(pairTxt).join(', '))
  : nd.op === 'product' ? '×' : nd.op === 'distinct' ? 'δ'
  : nd.op === 'project' ? 'π ' + nd.attrs.join(', ')
  : `γ ${nd.by.join(', ')}, ${nd.fn}(${nd.agg})`;
const joinAttrs = nd => nd.op !== 'join' ? [] : nd.theta ? nd.theta.attrs : uniq(nd.pairs.flat());

function attrsOf(nd, S) {
  switch (nd.op) {
    case 'rel': return S[nd.name];
    case 'select': case 'distinct': return attrsOf(nd.in, S);
    case 'project': return nd.attrs;
    case 'group': return [...nd.by, nd.agg];
    default: return uniq([...attrsOf(nd.l, S), ...attrsOf(nd.r, S)]);
  }
}

// size of one condition applied to T tuples; V = distinct counts, sides = {l, r} V maps for an input made of two relations
function condEst(c, T, V, sides) {
  if (c.kind === 'eq') { const r = C.eq(T, V[c.attr]); return { T: r.value, work: `${c.text}: ${r.work}` }; }
  if (c.kind === 'range') {
    const r = c.min != null ? C.rangeSel(T, c.cmp, c.val, c.min, c.max) : C.ineqThird(T);
    return { T: r.value, work: `${c.text}: ${r.work}` };
  }
  if (c.kind === 'like') return { T: T * c.frac, work: `${c.text}: ${c.why}, so f = ${c.fracTxt} and T × f = ${nf(T)} × ${c.fracTxt} = ${nf(T * c.frac)}` };
  const va = (sides && sides.l[c.a] != null) ? sides.l[c.a] : V[c.a], vb = (sides && sides.r[c.b] != null) ? sides.r[c.b] : V[c.b];
  const v = T / Math.max(va, vb);
  return { T: v, work: `${c.text}: compares two attributes, like a join condition: T / max(V(${c.a}), V(${c.b})) = ${nf(T)} / max(${nf(va)}, ${nf(vb)}) = ${nf(v)}` };
}

// annotate(plan, stats) -> new tree with T, V, text, work, w (number of attributes, needs S)
function annotate(nd, st, S) {
  const n = { ...nd };
  kids(nd).forEach(k => { n[k] = annotate(nd[k], st, S); });
  n.text = lbl(nd);
  if (S) n.w = attrsOf(nd, S).length;
  if (nd.op === 'rel') { const s = st[nd.name]; n.T = s.T; n.V = { ...s.V }; n.work = `T(${nd.name}) = ${nf(s.T)}`; }
  else if (nd.op === 'select') {
    let T = n.in.T; const works = [];
    nd.conds.forEach(c => { const r = condEst(c, T, n.in.V, n.in.sides); works.push(r.work); T = r.T; });
    n.T = T; n.V = n.in.V; n.sides = n.in.sides; n.work = works.join('. Then ');
    if (nd.conds.length > 1) n.work = 'AND: apply each condition in turn (multiply the fractions). ' + n.work;
  } else if (nd.op === 'distinct') { const r = C.distinct(n.in.T); n.T = r.value; n.V = n.in.V; n.sides = n.in.sides; n.work = `δ: ${r.work}`; }
  else if (nd.op === 'project') { n.T = n.in.T; n.V = Object.fromEntries(Object.entries(n.in.V).filter(([k]) => nd.attrs.includes(k))); n.work = 'π (bag): same number of tuples, narrower tuples'; }
  else if (nd.op === 'group') { n.T = null; n.V = {}; n.work = 'γ: the final answer'; }
  else {
    let r;
    if (nd.op === 'product') r = C.product(n.l.T, n.r.T);
    else if (nd.theta) r = C.thetaJoin(n.l.T, n.r.T);
    else r = C.join(n.l.T, n.r.T, nd.pairs.map(([a, b]) => [n.l.V[a], n.r.V[b]]));
    n.T = r.value; n.work = (nd.op === 'product' ? '×: ' : '⋈: ') + r.work;
    n.sides = { l: n.l.V, r: n.r.V };
    n.V = { ...n.l.V };
    Object.entries(n.r.V).forEach(([k, v]) => { n.V[k] = n.V[k] != null ? Math.min(n.V[k], v) : v; });
  }
  return n;
}
// Cost = sum of the intermediate results: not leaves, not the root, and (our convention) not π or γ,
// because π keeps the number of tuples (it only narrows them).
function cost(root) {
  const parts = [];
  const walk = (nd, isRoot) => {
    if (nd.op === 'rel') return;
    if (!isRoot && nd.op !== 'project' && nd.op !== 'group') parts.push({ text: nd.text, T: nd.T });
    kids(nd).forEach(k => walk(nd[k], false));
  };
  walk(root, true);
  return { value: parts.reduce((a, p) => a + p.T, 0), parts };
}
const costTxt = c => c.parts.length ? c.parts.map(p => nf(p.T)).join(' + ') + ' = ' + nf(c.value) : '0';

// drawing: show sizes (and number of attributes if wide)
function draw(root, { sizes = true, wide = false, hlPath = null } = {}) {
  const cl = structuredClone(root);
  const mark = (nd, path) => {
    if (nd.op !== 'rel' || true) {
      if (sizes && nd.T != null) nd.note = `T = ${nf(f2(nd.T))}${wide && nd.w != null ? ` · ${nd.w} attrs` : ''}`;
      else if (!sizes) nd.note = wide && nd.w != null ? `${nd.w} attrs` : undefined;
      else if (nd.op === 'group') nd.note = 'result';
      if (hlPath && path.join('.') === hlPath.join('.')) nd.hl = true;
    }
    kids(nd).forEach(k => mark(nd[k], [...path, k]));
  };
  mark(cl, []);
  if (!sizes && !wide) { const strip = nd => { delete nd.note; kids(nd).forEach(k => strip(nd[k])); }; strip(cl); }
  return planSVG(cl, { sizes: false });
}

// ---- tree surgery on raw plans
const getAt = (root, path) => path.reduce((n, k) => n && n[k], root);
function setAt(root, path, node) {
  if (!path.length) return node;
  const c = structuredClone(root); let n = c;
  path.slice(0, -1).forEach(k => { n = n[k]; });
  n[path[path.length - 1]] = node; return c;
}
const strip = nd => { const o = { ...nd }; ['T', 'V', 'work', 'text', 'w', 'note', 'hl', 'sides'].forEach(k => delete o[k]); kids(nd).forEach(k => { o[k] = strip(nd[k]); }); return o; };

// which input can evaluate a condition: 'l', 'r', 'both' or 'span'
function sideOf(c, l, r, S) {
  const A = attrsOf(l, S), B = attrsOf(r, S);
  if (c.kind === 'attreq') return (A.includes(c.a) && B.includes(c.b)) || (A.includes(c.b) && B.includes(c.a)) ? 'span' : A.includes(c.a) && A.includes(c.b) ? 'l' : 'r';
  const inA = c.attrs.every(a => A.includes(a)), inB = c.attrs.every(a => B.includes(a));
  return inA && inB ? 'both' : inA ? 'l' : inB ? 'r' : 'span';
}
const imperviousAbove = (root, path) => {
  let n = root, ok = false;
  for (const k of path) { if (n.op === 'group') ok = n.fn === 'MIN' || n.fn === 'MAX'; n = n[k]; }
  return ok;
};

// ---- the rules of the formula sheet, as moves. run(nd, S, ctx) -> { node, msg, better? } | { why }
const RULES = {
  split: { name: 'Split an AND', eq: 'σ<sub>c1∧c2</sub>(R) = σ<sub>c1</sub>(σ<sub>c2</sub>(R))', heur: 'Heuristic 1 prepares the push', ops: ['select'],
    run(nd) {
      if (nd.conds.length < 2) return { why: 'This selection has a single condition, so there is nothing to split.' };
      let out = nd.in; [...nd.conds].reverse().forEach(c => { out = sel([c], out); });
      return { node: out, msg: `The AND is now ${nd.conds.length} separate selections. Each one can travel down on its own (Heuristic 1).` };
    } },
  swap: { name: 'Swap two selections', eq: 'σ<sub>c1</sub>(σ<sub>c2</sub>(R)) = σ<sub>c2</sub>(σ<sub>c1</sub>(R))', heur: 'Heuristic 3: the most restrictive selection goes first', ops: ['select'],
    run(nd) {
      if (nd.in.op !== 'select') return { why: 'There is no selection directly below this one to swap with.' };
      return { node: sel(nd.in.conds, sel(nd.conds, nd.in.in)), msg: 'The two selections traded places. The result is the same, but the size of the intermediate result between them changes.' };
    } },
  push: { name: 'Push σ below', eq: 'σ<sub>c</sub>(R × S) = σ<sub>c</sub>(R) × S (only R has the attributes of c)', heur: 'Heuristic 1: push selections down', ops: ['select'],
    run(nd, S) {
      if (nd.conds.length > 1) return { why: 'This σ is an AND of several conditions. Split it first (σ<sub>c1∧c2</sub> = σ<sub>c1</sub>(σ<sub>c2</sub>)), then push each piece on its own.' };
      const c = nd.conds[0], ch = nd.in;
      if (ch.op === 'product' || ch.op === 'join') {
        const s = sideOf(c, ch.l, ch.r, S), name = k => `the ${k === 'l' ? 'left' : 'right'} input`;
        if (s === 'span') return { why: ch.op === 'product'
          ? `"${c.text}" compares an attribute of the left input with one of the right input, so neither side alone has everything it needs. It is a join condition: turn σ over × into a join (Heuristic 5).`
          : `"${c.text}" needs attributes from both inputs, so it cannot be evaluated on just one of them.` };
        if (s === 'both') return { node: { ...ch, l: sel([c], ch.l), r: sel([c], ch.r) }, msg: `Both inputs have the attribute of "${c.text}" (it is the join attribute), so the selection can be applied to both (Lecture 5, slide 16).` };
        return { node: { ...ch, [s]: sel([c], ch[s]) }, msg: `Only ${name(s)} has the attribute${c.attrs.length > 1 ? 's' : ''} of "${c.text}", so the selection goes there. The other input is untouched.` };
      }
      if (ch.op === 'distinct') return { node: dst(sel([c], ch.in)), msg: 'δ(σ<sub>c</sub>(R)) = σ<sub>c</sub>(δ(R)): the selection moves below δ, so δ has fewer tuples to sort out.' };
      if (ch.op === 'select') return { why: 'Another σ sits directly below. Use "Swap two selections" to reorder them, or select the lower σ and push that one.' };
      if (ch.op === 'rel') return { why: 'The selection already sits directly on the base table. It cannot go lower.' };
      return { why: 'The formula sheet has no rule for pushing σ through this operator.' };
    } },
  tojoin: { name: 'σ over × becomes ⋈', eq: 'R ⋈<sub>c</sub> S = σ<sub>c</sub>(R × S), read right to left', heur: 'Heuristic 5: turn σ + × into a join', ops: ['select'],
    run(nd, S) {
      if (nd.conds.length > 1) return { why: 'Split the AND first. Only the condition that links the two inputs can become the join condition; the others are pushed down.' };
      const ch = nd.in, c = nd.conds[0];
      if (ch.op !== 'product') return { why: ch.op === 'join' ? 'The input is already a join.' : 'This σ must sit directly on a × to be merged into it. Push other selections out of the way first.' };
      if (sideOf(c, ch.l, ch.r, S) !== 'span') return { why: `"${c.text}" tests attributes of one input only, so it is an ordinary selection, not a join condition. Push it down to that input instead.` };
      if (c.kind === 'attreq') {
        const A = attrsOf(ch.l, S), pair = A.includes(c.a) ? [c.a, c.b] : [c.b, c.a];
        return { node: jn(ch.l, ch.r, [pair]), msg: 'σ<sub>c</sub>(R × S) became R ⋈<sub>c</sub> S. A join is evaluated much faster than building the full product and then filtering it.' };
      }
      return { why: 'That condition is not an equality, so it would give a θ-join.' };
    } },
  expand: { name: 'Join becomes σ over ×', eq: 'R ⋈<sub>c</sub> S = σ<sub>c</sub>(R × S), read left to right', heur: 'The wrong way round: legal but expensive', ops: ['join'],
    run(nd) {
      const conds = nd.theta ? [nd.theta] : nd.pairs.map(([a, b]) => aeq(a, b, a === b ? `${a} (both sides)` : undefined));
      return { node: sel(conds, prod(nd.l, nd.r)), msg: 'Legal, because the sheet rule is an equality. But the product of both inputs is now built first. Rewrites go from right to left (slide 19).' };
    } },
  commute: { name: 'Swap the two inputs', eq: 'R ⋈ S = S ⋈ R, R × S = S × R', heur: 'Neutral for sizes', ops: ['join', 'product'],
    run(nd) {
      return { node: { ...nd, l: nd.r, r: nd.l, ...(nd.pairs ? { pairs: nd.pairs.map(([a, b]) => [b, a]) } : {}) }, msg: 'Always legal. The output size and every intermediate size stay the same, so the size model sees no difference. Which side is outer or inner matters in physical planning (next lecture).' };
    } },
  assocR: { name: 'Regroup to the right', eq: '(R ⋈ S) ⋈ T = R ⋈ (S ⋈ T)', heur: 'Heuristic 3: do the most restrictive join first', ops: ['join', 'product'],
    run(nd, S) {
      if (nd.l.op !== nd.op) return { why: 'The left input must be a join (or a product) of the same kind to regroup it.' };
      const A = nd.l.l, B = nd.l.r, Cc = nd.r;
      if (nd.op === 'product') return { node: prod(A, prod(B, Cc)), msg: 'Products are associative without any condition.' };
      const need = (nd.theta ? nd.theta.attrs : nd.pairs.map(p => p[0])).filter(a => !attrsOf(Cc, S).includes(a) || nd.theta);
      const BB = attrsOf(B, S);
      if (need.some(a => !BB.includes(a))) return { why: `The outer join condition uses ${need.filter(a => !BB.includes(a)).join(', ')}, which comes from ${attrsOf(A, S).includes(need.find(a => !BB.includes(a))) ? 'the first input' : 'the first join'} and is not an attribute of the inner pair. The new inner join would have no usable condition (a hidden product). This is exactly why θ-joins are not always associative.` };
      return { node: { ...nd.l, op: 'join', pairs: nd.l.pairs, theta: nd.l.theta, l: A, r: { ...nd, l: B, r: Cc } }, msg: 'Same result. Now the join of the last two inputs is done first, which changes the intermediate size.' };
    } },
  assocL: { name: 'Regroup to the left', eq: 'R ⋈ (S ⋈ T) = (R ⋈ S) ⋈ T', heur: 'Heuristic 3: do the most restrictive join first', ops: ['join', 'product'],
    run(nd, S) {
      if (nd.r.op !== nd.op) return { why: 'The right input must be a join (or a product) of the same kind to regroup it.' };
      const A = nd.l, B = nd.r.l, Cc = nd.r.r;
      if (nd.op === 'product') return { node: prod(prod(A, B), Cc), msg: 'Products are associative without any condition.' };
      const need = (nd.theta ? nd.theta.attrs : nd.pairs.map(p => p[1])).filter(a => !attrsOf(A, S).includes(a) || nd.theta);
      const BB = attrsOf(B, S);
      if (need.some(a => !BB.includes(a))) return { why: `The outer join condition connects the first input with ${need.filter(a => !BB.includes(a)).join(', ')}, which belongs to the third input, not to the pair that would be joined first. That inner join would have no condition (a hidden product).` };
      return { node: { ...nd.r, op: 'join', pairs: nd.r.pairs, theta: nd.r.theta, l: { ...nd, l: A, r: B }, r: Cc }, msg: 'Same result. Now the join of the first two inputs is done first, which changes the intermediate size.' };
    } },
  pushpi: { name: 'Push π down', eq: 'introduce π anywhere, if it only drops attributes that nothing above needs', heur: 'Heuristic 2: push projections down', ops: ['project'],
    run(nd, S, ctx) {
      const ch = nd.in;
      if (ch.op === 'join' || ch.op === 'product') {
        const used = joinAttrs(ch); let changed = 0, why = [];
        const wrap = X => {
          const A = attrsOf(X, S), need = A.filter(a => nd.attrs.includes(a) || used.includes(a));
          if (need.length >= A.length) return X;
          changed++;
          if (X.op === 'distinct') {
            if (ctx.impervious) return dst(prj(need, X.in));
            why.push('The π was put above the δ, not below it: δ compares whole tuples, so a π under δ could merge rows that δ would keep apart. That is only safe when the γ above is MIN or MAX.');
            return prj(need, X);
          }
          return prj(need, X);
        };
        const l = wrap(ch.l), r = wrap(ch.r);
        if (!changed) return { why: 'Every attribute of both inputs is still needed (by this π or by the join condition), so a new π would drop nothing.' };
        return { node: prj(nd.attrs, { ...ch, l, r }), msg: 'A π now cuts each input down to the attributes needed above and in the join condition. The number of tuples is unchanged, but each tuple is narrower, so more fit in a block (Heuristic 2).' + (why.length ? ' ' + why[0] : '') };
      }
      if (ch.op === 'select') {
        const used = uniq(ch.conds.flatMap(c => c.attrs)), A = attrsOf(ch.in, S), need = A.filter(a => nd.attrs.includes(a) || used.includes(a));
        if (need.length >= A.length) return { why: 'The selection and this π together still need every attribute of the input, so a lower π would drop nothing.' };
        return { node: prj(nd.attrs, { ...ch, in: prj(need, ch.in) }), msg: 'A π below the selection keeps only the attributes that σ and the π above need.' };
      }
      if (ch.op === 'distinct') return { why: 'δ cannot be pushed through π (and π cannot slip below δ in general): π can create duplicates that δ then handles differently. The sheet lists π among the operators δ cannot pass.' };
      if (ch.op === 'rel') return { why: 'The input is a base table. Nothing lies below to push into.' };
      return { why: 'No rule applies here. Select a π that sits on a ⋈, ×, or σ.' };
    } },
  pushdelta: { name: 'Push δ down', eq: 'δ(R ⋈ S) = δ(R) ⋈ δ(S), δ(σ<sub>c</sub>(R)) = σ<sub>c</sub>(δ(R))', heur: 'Heuristic 4: move δ somewhere convenient', ops: ['distinct'],
    run(nd) {
      const ch = nd.in;
      if (ch.op === 'join' || ch.op === 'product') return { node: { ...ch, l: dst(ch.l), r: dst(ch.r) }, msg: 'δ(R ⋈ S) = δ(R) ⋈ δ(S). Duplicates are removed before the join. This is NOT always cheaper: the two new δ nodes each cost their output size.' };
      if (ch.op === 'select') return { node: sel(ch.conds, dst(ch.in)), msg: 'δ(σ<sub>c</sub>(R)) = σ<sub>c</sub>(δ(R)). Legal, but δ now works on the larger, unfiltered input.' };
      if (ch.op === 'project') return { why: 'δ cannot be pushed through π (the sheet says so). Example: R = {(1,a), (1,b)} and π keeps the first column: δ(π(R)) = {1} but π(δ(R)) = {1, 1}.' };
      if (ch.op === 'group') return { node: ch, msg: 'δ(γ<sub>L</sub>(R)) = γ<sub>L</sub>(R): grouping already produces one row per group, so the δ is redundant. It is removed.' };
      if (ch.op === 'rel') return { why: 'The input is a base table. There is nothing below to push δ into.' };
      return { why: 'The sheet has no rule for pushing δ through this operator.' };
    } },
  insdelta: { name: 'Add δ below γ', eq: 'γ<sub>L</sub>(R) = γ<sub>L</sub>(δ(R)), only for MIN and MAX', heur: 'Heuristic 4 for duplicate-impervious aggregates', ops: ['group'],
    run(nd) {
      if (nd.fn !== 'MIN' && nd.fn !== 'MAX') return { why: `${nd.fn} counts every duplicate. Removing duplicates first changes the answer: two rows with the same value give SUM = 2v, but after δ only v. The rule holds only for MIN and MAX, which ignore duplicates.` };
      if (nd.in.op === 'distinct') return { why: 'There is already a δ directly below γ.' };
      return { node: { ...nd, in: dst(nd.in) }, msg: `${nd.fn} is duplicate-impervious, so γ(R) = γ(δ(R)). Adding δ is legal, and now δ can be pushed further down.` };
    } },
  inspi: { name: 'Add π below γ', eq: 'γ<sub>L</sub>(R) = γ<sub>L</sub>(π<sub>M</sub>(R)), M ⊇ attributes of L', heur: 'Heuristic 2', ops: ['group'],
    run(nd, S) {
      const M = uniq([...nd.by, nd.agg]), A = attrsOf(nd.in, S);
      if (nd.in.op === 'project') return { why: 'There is already a π directly below γ.' };
      if (A.every(a => M.includes(a))) return { why: 'The input has no attribute that γ does not use, so a π would drop nothing.' };
      return { node: { ...nd, in: prj(M, nd.in) }, msg: `π keeps exactly the attributes mentioned in L (${M.join(', ')}). The rule needs M to contain every attribute of L, and it does.` };
    } },
};
const RULE_ORDER = ['split', 'swap', 'push', 'tojoin', 'expand', 'commute', 'assocR', 'assocL', 'pushpi', 'pushdelta', 'insdelta', 'inspi'];

// ---- scenarios
const sc = {};
sc.movies = {
  title: 'Slide 24: stars born in 1960', sql: `SELECT title FROM StarsIn, MovieStar\nWHERE name = starName AND birthdate LIKE '%1960'`,
  schema: { StarsIn: ['movieTitle', 'movieYear', 'starName'], MovieStar: ['name', 'address', 'birthdate'] },
  stats: { StarsIn: { T: 10000, V: { movieTitle: 4000, movieYear: 80, starName: 2000 } }, MovieStar: { T: 2000, V: { name: 2000, address: 2000, birthdate: 1500 } } },
  start: () => prj(['movieTitle'], sel([aeq('starName', 'name'), lkc('birthdate', '%1960', 1, 50, 'assume 1 star in 50 was born in 1960')], prod(rel('StarsIn'), rel('MovieStar')))),
  route: ['Split the AND.', 'Push σ birthdate LIKE … to MovieStar (only MovieStar has birthdate).', 'Turn σ starName = name over × into a join (Heuristic 5).', 'Push π to cut the tuple width (Heuristic 2).'],
  note: 'Statistics (invented for the exercise): T(StarsIn) = 10,000, T(MovieStar) = 2,000, V(starName) = V(name) = 2,000, and 1 star in 50 was born in 1960.',
};
sc.brooklyn = {
  title: 'Slide 25: Brooklyn customers', sql: `SELECT customer_name FROM branch, account, depositor\nWHERE branch_city = 'Brooklyn' AND branch.branch_id = account.branch_id\n  AND account.account_id = depositor.account_id`,
  schema: { branch: ['branch_id', 'branch_city'], account: ['account_id', 'branch_id'], depositor: ['account_id', 'customer_name'] },
  stats: { branch: { T: 50, V: { branch_id: 50, branch_city: 10 } }, account: { T: 10000, V: { account_id: 10000, branch_id: 50 } }, depositor: { T: 12000, V: { account_id: 10000, customer_name: 8000 } } },
  start: () => prj(['customer_name'], sel([eqc('branch_city', "'Brooklyn'")], jn(rel('branch'), jn(rel('account'), rel('depositor'), [['account_id', 'account_id']]), [['branch_id', 'branch_id']]))),
  route: ['Push σ branch_city = Brooklyn onto branch (the red arrow on the slide).', 'Regroup the joins so the tiny σ(branch) joins account first (Heuristic 3).', 'Push π to drop unused columns (Heuristic 2).'],
  note: 'Invented statistics: 50 branches (10 cities), 10,000 accounts, 12,000 depositor rows. Attribute names are made unique so that every join is on a shared name.',
};
sc.distinct = {
  title: 'Slide 11 and 40: SELECT DISTINCT b', sql: `SELECT DISTINCT b FROM R ⋈ S\nWHERE R.a = 10`,
  schema: { R: ['a', 'b'], S: ['b', 'c'] },
  stats: { R: { T: 5000, V: { a: 50, b: 100 } }, S: { T: 2000, V: { b: 200, c: 100 } } },
  start: () => dst(sel([eqc('a', 10)], jn(rel('R'), rel('S'), [['b', 'b']]))),
  route: ['Push σ a = 10 onto R (only R has a): cost drops from 51,000 to 1,100.', 'Now try pushing δ through the join. Cost rises to 1,150: a heuristic is not a guarantee.'],
  note: 'Statistics from slide 40: T(R) = 5000, V(R,a) = 50, V(R,b) = 100, T(S) = 2000, V(S,b) = 200.',
};
sc.midterm = {
  title: 'Midterm 2025, exercise 6e', sql: 'π a,d ( σ r.c = s.c ∧ d = 5 ( R × S ) )',
  schema: { R: ['a', 'b', 'c'], S: ['c', 'd'] },
  stats: { R: { T: 40000, V: { a: 2000, b: 4, c: 20000 } }, S: { T: 80000, V: { c: 40000, d: 2000 } } },
  start: () => prj(['a', 'd'], sel([aeq('c', 'c', 'R.c = S.c'), eqc('d', 5)], prod(rel('R'), rel('S')))),
  route: ['Split the AND.', 'Push σ d = 5 to S (R has no attribute d, so it can only go right).', 'Turn σ R.c = S.c over × into a join.', 'Compare with the model answer, which keeps σ d = 5 above the join: it costs about 80,000 more.'],
  note: 'Statistics from the exam: T(R) = 40,000, T(S) = 80,000, V(R,c) = 20,000, V(S,c) = 40,000, V(S,d) = 2000.',
};
sc.gamma = {
  title: 'Slide 23: MAX(birthdate) per year', sql: `SELECT movieYear, MAX(birthdate)\nFROM MovieStar, StarsIn\nWHERE MovieStar.name = StarsIn.starName\nGROUP BY StarsIn.movieYear`,
  schema: { MovieStar: ['name', 'address', 'gender', 'birthdate'], StarsIn: ['movieTitle', 'movieYear', 'starName'] }, fns: ['MAX', 'SUM'],
  stats: { MovieStar: { T: 2000, V: { name: 2000, address: 2000, gender: 2, birthdate: 1500 } }, StarsIn: { T: 10000, V: { movieTitle: 4000, movieYear: 80, starName: 2000 } } },
  start: fn => grp(fn || 'MAX', ['movieYear'], 'birthdate', sel([aeq('name', 'starName')], prod(rel('MovieStar'), rel('StarsIn')))),
  route: ['σ name = starName over × becomes a join.', 'Add δ below γ (legal for MAX only), then push it through the join.', 'Add π below γ, then push π to each input. Try the same with SUM and see which steps are refused.'],
  note: 'Invented statistics: T(MovieStar) = 2,000, T(StarsIn) = 10,000. Both tables have more columns than the query uses.',
};
const SC_ORDER = ['movies', 'brooklyn', 'distinct', 'midterm', 'gamma'];

// plans shared by the compare / ordering widgets (raw plans + the scenario they use)
const P = {
  s40a1: () => jn(dst(sel([eqc('a', 10)], rel('R'))), dst(rel('S')), [['b', 'b']]),
  s40a2: () => dst(jn(sel([eqc('a', 10)], rel('R')), rel('S'), [['b', 'b']])),
  s40p0: () => dst(sel([eqc('a', 10)], jn(rel('R'), rel('S'), [['b', 'b']]))),
};
const FJ = {
  schema: { FruitJuice: ['brand', 'name', 'type', 'sugar'], Factory: ['brand', 'city', 'revenue'], Loc: ['city', 'state'] },
  stats: { FruitJuice: { T: 10000, V: { brand: 300, name: 8000, type: 10, sugar: 10000 } }, Factory: { T: 400, V: { brand: 400, city: 50, revenue: 200 } }, Loc: { T: 2000, V: { city: 2000, state: 50 } } },
};
const FJ_BRAND = [['brand', 'brand']], FJ_CITY = [['city', 'city']];
P.fj1 = () => dst(sel([eqc('type', 'banana'), eqc('city', 'cairo')], jn(rel('FruitJuice'), jn(rel('Factory'), rel('Loc'), FJ_CITY), FJ_BRAND)));
P.fj2 = () => dst(jn(sel([eqc('type', 'banana')], rel('FruitJuice')), jn(sel([eqc('city', 'cairo')], rel('Factory')), rel('Loc'), FJ_CITY), FJ_BRAND));
P.fj3 = () => dst(jn(sel([eqc('type', 'banana')], rel('FruitJuice')), sel([eqc('city', 'cairo')], jn(rel('Factory'), rel('Loc'), FJ_CITY)), FJ_BRAND));
const R4 = { schema: { R: ['a', 'b'], S: ['b', 'c'], U: ['c', 'd'] }, stats: { R: { T: 1000, V: { a: 100, b: 20 } }, S: { T: 2000, V: { b: 50, c: 100 } }, U: { T: 5000, V: { c: 500, d: 5000 } } } };
P.r4a = () => jn(jn(rel('R'), rel('S'), [['b', 'b']]), rel('U'), [['c', 'c']]);
P.r4b = () => jn(rel('R'), jn(rel('S'), rel('U'), [['c', 'c']]), [['b', 'b']]);

// exported for the content file (static drawings and numbers)


// ---- more plans used by the compare / ordering widgets
P.mv2 = () => prj(['movieTitle'], jn(rel('StarsIn'), sel([sc.movies.start().in.conds[1]], rel('MovieStar')), [['starName', 'name']]));
P.bk0 = () => sc.brooklyn.start();
P.bk1 = () => prj(['customer_name'], jn(sel([eqc('branch_city', "'Brooklyn'")], rel('branch')), jn(rel('account'), rel('depositor'), [['account_id', 'account_id']]), [['branch_id', 'branch_id']]));
P.bk2 = () => prj(['customer_name'], jn(jn(sel([eqc('branch_city', "'Brooklyn'")], rel('branch')), rel('account'), [['branch_id', 'branch_id']]), rel('depositor'), [['account_id', 'account_id']]));
P.mt0 = () => sc.midterm.start();
P.mt1 = () => prj(['a', 'd'], sel([eqc('d', 5)], jn(rel('R'), rel('S'), [['c', 'c']])));
P.mt2 = () => prj(['a', 'd'], jn(rel('R'), sel([eqc('d', 5)], rel('S')), [['c', 'c']]));
const GM = ['name', 'starName'];
P.g1 = () => sc.gamma.start('MAX');
P.g2 = () => grp('MAX', ['movieYear'], 'birthdate', prj(['movieYear', 'birthdate'], dst(jn(rel('MovieStar'), rel('StarsIn'), [GM]))));
P.g3 = () => grp('MAX', ['movieYear'], 'birthdate', prj(['movieYear', 'birthdate'], jn(dst(prj(['name', 'birthdate'], rel('MovieStar'))), dst(prj(['movieYear', 'starName'], rel('StarsIn'))), [GM])));

const ann = (plan, ctx) => annotate(strip(plan), ctx.stats, ctx.schema);
const fmtN = v => nf(f2(v));
const body = (icon, title, hint, inner) => `${bench(icon, title, hint)}<div class="bench-body">${inner}</div>`;
const pre = t => `<pre class="code" style="margin:8px 0">${esc(t)}</pre>`;
const msgBox = (kind, html) => `<div class="callout ${kind === 'bad' ? 'trap' : 'key'}" style="margin:10px 0;max-width:none"><i class="ph ph-${kind === 'bad' ? 'prohibit' : 'check-circle'}"></i><div>${html}</div></div>`;
const chipRow = (items, cur, attr) => `<div class="chips" style="margin-bottom:10px">${items.map(([k, t]) => `<button type="button" class="chip" ${attr}="${k}" aria-pressed="${k === cur}">${t}</button>`).join('')}</div>`;
const scroll = svg => `<div style="overflow-x:auto">${svg}</div>`;

// ====================================================================================
// 1. SQL -> parse -> logical plan -> rewrite -> physical plan
// ====================================================================================
const tk = (text, note) => ({ op: 'rel', text, note });
const nt = (text, note, kidsArr = []) => { const o = { op: 'x', text, note }; ['in', 'l', 'r'].forEach((k, i) => { if (kidsArr[i]) o[k] = kidsArr[i]; }); return o; };
const PIPE = {
  A: {
    label: 'Nested query (slide 5)', sql: "SELECT movieTitle FROM StarsIn\nWHERE starName IN (\n  SELECT name FROM MovieStar\n  WHERE birthdate LIKE '%1960');",
    parse: () => nt('<Query>', 'SELECT … FROM … WHERE …', [
      nt('<SelList>', null, [nt('<Attribute>', null, [tk('movieTitle')])]),
      nt('<FromList>', null, [nt('<RelName>', null, [tk('StarsIn')])]),
      nt('<Condition>', 'attr IN ( query )', [nt('<Attribute>', null, [tk('starName')]), tk('IN ( )'),
        nt('<Query>', 'SELECT … FROM … WHERE …', [
          nt('<SelList>', null, [nt('<Attribute>', null, [tk('name')])]),
          nt('<FromList>', null, [nt('<RelName>', null, [tk('MovieStar')])]),
          nt('<Condition>', 'attr LIKE pattern', [nt('<Attribute>', null, [tk('birthdate')]), tk('LIKE'), nt('<Pattern>', null, [tk("'%1960'")])])])])]),
    initial: () => ({ op: 'project', attrs: ['movieTitle'], text: 'π movieTitle', in: { op: 'select', text: 'σ starName = name', in: { op: 'product', text: '×', l: tk('StarsIn'), r: { op: 'select', text: "σ birthdate LIKE '%1960'", in: tk('MovieStar') } } } }),
    initNote: 'The IN subquery becomes a selection on the product: starName must equal a name that passed the inner query. The inner WHERE is already a σ directly on MovieStar. This is the left tree of the slide 9 figure.',
    rules: ['σ starName = name over × becomes a join (Heuristic 5, sheet rule R ⋈<sub>c</sub> S = σ<sub>c</sub>(R × S) read right to left).', "σ birthdate LIKE '%1960' is already on MovieStar, so Heuristic 1 has nothing left to push."],
  },
  B: {
    label: 'Join form (slide 24)', sql: "SELECT movieTitle FROM StarsIn, MovieStar\nWHERE name = starName AND birthdate LIKE '%1960';",
    parse: () => nt('<Query>', 'SELECT … FROM … WHERE …', [
      nt('<SelList>', null, [nt('<Attribute>', null, [tk('movieTitle')])]),
      nt('<FromList>', null, [nt('<RelName>', null, [tk('StarsIn')]), nt('<RelName>', null, [tk('MovieStar')])]),
      nt('<Condition>', 'cond AND cond', [nt('<Condition>', 'attr = attr', [nt('<Attribute>', null, [tk('name')]), nt('<Attribute>', null, [tk('starName')])]), nt('<Condition>', 'attr LIKE pattern', [nt('<Attribute>', null, [tk('birthdate')]), nt('<Pattern>', null, [tk("'%1960'")])])])]),
    initial: () => ({ op: 'project', text: 'π movieTitle', in: { op: 'select', text: "σ starName = name ∧ birthdate LIKE '%1960'", in: { op: 'product', text: '×', l: tk('StarsIn'), r: tk('MovieStar') } } }),
    initNote: 'The FROM list becomes a product, and the whole WHERE becomes one big σ above it. This is plan 1 of slide 24. It is correct but expensive: it builds every StarsIn × MovieStar pair first.',
    rules: ['Split the AND and push σ birthdate LIKE … onto MovieStar (Heuristic 1; only MovieStar has the attribute).', 'Turn σ starName = name over × into a join (Heuristic 5).'],
  },
};
const PIPE_STEPS = [
  ['SQL', 'chat-text'], ['Parser', 'brackets-curly'], ['Preprocessor', 'check-square'], ['Logical plan', 'tree-structure'], ['Query rewriter', 'shuffle'], ['Physical plan', 'gear'], ['Execute', 'play'],
];
export function u5Pipeline(el) {
  let q = 'A', at = 0;
  const physical = () => nt('π movieTitle', 'result', [nt('join', 'algorithm: chosen from sizes and indexes', [nt('Table scan', null, [tk('StarsIn')]), nt('Index scan', null, [tk('MovieStar')])])]);
  const final = () => ({ op: 'project', text: 'π movieTitle', in: { op: 'join', text: '⋈ starName = name', l: tk('StarsIn'), r: { op: 'select', text: "σ birthdate LIKE '%1960'", in: tk('MovieStar') } } });
  const stage = () => {
    const d = PIPE[q];
    switch (at) {
      case 0: return `<p class="small"><strong>Input:</strong> a SQL query, plain text. The DBMS cannot run text, it first needs to know what the text means.</p>${pre(d.sql)}<p class="small muted">Components so far: none. The query processor is the whole group of components that turns this text (and data-modification commands) into database operations and runs them.</p>`;
      case 1: return `<p class="small"><strong>Parser</strong> checks the syntax and builds a <em>parse tree</em> (query expression tree). It only knows grammar: it does not know whether StarsIn exists.</p>${scroll(planSVG(d.parse(), { sizes: false }))}<p class="small muted">Syntax errors (a missing FROM, a misspelt keyword) are rejected here.</p>`;
      case 2: return `<p class="small"><strong>Preprocessor</strong> does the semantic checks, using the catalog (metadata):</p>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Check</th><th>Against the catalog</th><th>Result</th></tr></thead><tbody>
        <tr><td>Relation names</td><td class="num">StarsIn, MovieStar</td><td class="hl">found</td></tr>
        <tr><td>Attributes exist and are unambiguous</td><td class="num">movieTitle, starName in StarsIn; name, birthdate in MovieStar</td><td class="hl">found</td></tr>
        <tr><td>Types make sense</td><td class="num">birthdate is a date/string, LIKE needs a string pattern</td><td class="hl">ok</td></tr>
        <tr><td>Views</td><td class="num">none used (a view would be replaced by its definition here)</td><td class="hl">nothing to expand</td></tr></tbody></table></div>
        <p class="small muted" style="margin-top:8px">If a check fails, the query stops here with an error. Parser and preprocessor together produce a valid parse tree. Everything after this point is optimization.</p>`;
      case 3: return `<p class="small"><strong>Logical plan generator</strong> converts the valid parse tree into an initial relational algebra tree.</p>${scroll(planSVG(d.initial(), { sizes: false }))}<p class="small">${d.initNote}</p>`;
      case 4: return `<p class="small"><strong>Query rewriter</strong> applies the algebraic laws of the <a href="#/formula">formula sheet</a>, guided by the heuristics, to reach the preferred logical plan.</p>${scroll(planSVG(final(), { sizes: false }))}<ul class="small" style="margin:6px 0 0;padding-left:18px">${d.rules.map(r => `<li>${r}</li>`).join('')}</ul><p class="small muted" style="margin-top:8px">Logical planning ends here (slide 10: "today's topic" is the generator plus the rewriter). Open the <a href="#/m/l5">rewriter simulator</a> below to apply rules yourself.</p>`;
      case 5: return `<p class="small"><strong>Physical plan generator</strong> picks an algorithm for every operator, the order of execution, how tables are accessed (table scan or index scan) and whether anything must be sorted. It uses the metadata: sizes, statistics, existing indexes, data layout.</p>${scroll(planSVG(physical(), { sizes: false }))}<p class="small muted">This is the right-hand tree of the slide 9 figure. The same logical plan could become many physical plans (hash join, nested loops, index join). That is the next lecture.</p>`;
      default: return `<p class="small"><strong>Execution engine</strong> runs the physical plan. Here the third optimization question is answered too: how do the operators hand tuples to each other? Pipelined, in main-memory buffers, or through the disk (buffer management).</p><div class="flow-row"><span class="chip">Table scan StarsIn</span><span class="arrow">→</span><span class="chip">join</span><span class="arrow">←</span><span class="chip">Index scan MovieStar</span><span class="arrow">→</span><span class="chip on">π movieTitle</span><span class="arrow">→</span><span class="chip">result rows</span></div>`;
    }
  };
  const render = () => {
    el.innerHTML = body('flow-arrow', 'From SQL to a physical plan', 'Step through the query processor', `
      ${chipRow(Object.entries(PIPE).map(([k, v]) => [k, v.label]), q, 'data-q')}
      <div class="flow-row">${PIPE_STEPS.map(([t], i) => `${i ? '<span class="arrow">›</span>' : ''}<button type="button" class="chip ${i === at ? 'on' : i > at ? 'dim' : ''}" data-at="${i}">${i + 1}. ${t}</button>`).join('')}</div>
      <div style="margin:10px 0 14px;min-height:150px">${stage()}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-prev ${at ? '' : 'disabled'}><i class="ph ph-caret-left"></i>Previous</button><button type="button" class="btn sm primary" data-next ${at < 6 ? '' : 'disabled'}>Next stage<i class="ph ph-caret-right"></i></button></div>`);
  };
  on(el, '[data-q]', 'click', (e, b) => { q = b.dataset.q; render(); });
  on(el, '[data-at]', 'click', (e, b) => { at = +b.dataset.at; render(); });
  on(el, '[data-prev]', 'click', () => { at = Math.max(0, at - 1); render(); });
  on(el, '[data-next]', 'click', () => { at = Math.min(6, at + 1); render(); });
  render();
}

// ====================================================================================
// 2. The interactive rewriter
// ====================================================================================
const TARGET = { movies: 240, brooklyn: 2205, distinct: 1100, midterm: 80, gamma: 8500 };
export function u5Rewrite(el) {
  let key = 'brooklyn', fn = 'MAX', tree = sc[key].start(fn), hist = [], sel0 = [], msg = null, solved = new Set(), wide = true;
  const S = () => sc[key];
  const cur = () => ann(tree, S());
  const reset = () => { tree = S().start(fn); hist = []; sel0 = []; msg = null; };
  const outline = (nd, path, depth, out) => {
    const id = path.length ? path.join('.') : 'root', on_ = path.join('.') === sel0.join('.');
    out.push(`<button type="button" data-node="${id}" class="chip ${on_ ? 'accent' : ''}" aria-pressed="${on_}" style="margin:2px 0 2px ${depth * 16}px;max-width:calc(100% - ${depth * 16}px);border-radius:8px;text-align:left"><span class="num" style="font-size:12.5px">${esc(nd.text)}</span><span class="muted tiny num" style="margin-left:6px">${nd.T != null ? fmtN(nd.T) : ''}</span></button>`);
    kids(nd).forEach(k => outline(nd[k], [...path, k], depth + 1, out));
    return out;
  };
  const render = () => {
    const s = S(), a = cur(), c = cost(a), c0 = hist.length ? cost(ann(hist[0].tree, s)) : c, node = getAt(a, sel0), rawNode = getAt(tree, sel0);
    const rules = RULE_ORDER.filter(r => RULES[r].ops.includes(rawNode.op));
    const best = key === 'gamma' && fn !== 'MAX' ? null : TARGET[key];
    const done = best != null && c.value <= best;
    if (done && !solved.has(key)) { solved.add(key); recordScore('u5-rewrite', solved.size, SC_ORDER.length); }
    el.innerHTML = body('arrows-split', 'Plan rewriter', 'Pick a node, apply a rule from the formula sheet', `
      ${chipRow(SC_ORDER.map(k => [k, sc[k].title]), key, 'data-sc')}
      ${key === 'gamma' ? `<div style="margin-bottom:8px"><span class="small muted">Aggregate function:&nbsp;</span>${seg([['MAX', 'MAX'], ['SUM', 'SUM']], fn, 'data-fn')}</div>` : ''}
      ${pre(s.sql)}
      <p class="small muted" style="margin:0 0 10px">${s.note}</p>
      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">
        <div style="flex:2 1 320px;min-width:0">${scroll(draw(a, { wide, hlPath: sel0 }))}
          <label class="small muted" style="display:inline-flex;gap:6px;align-items:center;margin-top:4px"><input type="checkbox" data-wide ${wide ? 'checked' : ''}> show the number of attributes per node (tuple width)</label></div>
        <div style="flex:1 1 220px;min-width:0"><div class="small muted" style="margin-bottom:4px">Nodes (tap to select, size T on the right)</div>${outline(a, [], 0, []).join('')}</div>
      </div>
      <div style="margin-top:14px"><div class="small"><strong>Selected:</strong> <span class="num">${esc(node.text)}</span> <span class="muted">(${rawNode.op === 'rel' ? 'base table' : rawNode.op})</span></div>
        <p class="small muted" style="margin:4px 0 8px">${node.work ? esc(node.work.replace(/<[^>]+>/g, '')) : ''}</p>
        ${rules.length ? `<div class="chips">${rules.map(r => `<button type="button" class="btn sm" data-rule="${r}" title="${esc(RULES[r].eq.replace(/<[^>]+>/g, ''))}">${RULES[r].name}</button>`).join('')}</div>
        <div class="tiny muted" style="margin-top:6px">${rules.map(r => `<span class="num">${RULES[r].eq}</span>`).join(' &nbsp;·&nbsp; ')}</div>` : '<p class="small muted">A base table has no rewrite rules. Select an operator node.</p>'}
        ${msg ? msgBox(msg.why ? 'bad' : 'good', msg.why ? `<strong>Does not apply.</strong> ${msg.why}` : `<strong>${msg.name}.</strong> ${msg.text}${msg.dc != null ? ` <span class="num">Cost ${nf(msg.from)} → ${nf(msg.to)} (${msg.dc < 0 ? 'down' : msg.dc > 0 ? 'UP' : 'unchanged'}).</span>` : ''}<div class="tiny muted" style="margin-top:4px">${msg.heur}</div>`) : ''}
      </div>
      <div class="tbl-wrap" style="margin-top:12px"><table class="tbl"><tbody>
        <tr><td><strong>Plan cost now</strong><div class="tiny muted">sum of the intermediate results (slide 40), π and γ add nothing: they keep the tuple count</div></td><td class="num">${costTxt(c)}</td></tr>
        ${hist.length ? `<tr><td>Start</td><td class="num">${nf(c0.value)}</td></tr>` : ''}
        ${best != null ? `<tr><td>Best plan we know</td><td class="num">${nf(best)} ${done ? '<span class="hl">reached</span>' : ''}</td></tr>` : '<tr><td colspan="2" class="small muted">With SUM the best moves are refused: see which rules say no.</td></tr>'}
      </tbody></table></div>
      ${hist.length ? `<div class="small" style="margin-top:8px"><strong>Your steps:</strong> ${hist.map((h, i) => `${i + 1}. ${h.name} <span class="num ${h.to < h.from ? 'hl' : ''}">(${nf(h.from)} → ${nf(h.to)})</span>`).join('; ')}</div>` : ''}
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button type="button" class="btn sm ghost" data-undo ${hist.length ? '' : 'disabled'}><i class="ph ph-arrow-u-up-left"></i>Undo</button><button type="button" class="btn sm ghost" data-reset><i class="ph ph-arrow-counter-clockwise"></i>Reset</button></div>
      <details style="margin-top:10px"><summary class="small">Show one good route</summary><ol class="small" style="margin:6px 0 0;padding-left:20px">${s.route.map(r => `<li>${r}</li>`).join('')}</ol></details>`);
  };
  on(el, '[data-sc]', 'click', (e, b) => { key = b.dataset.sc; reset(); render(); });
  on(el, '[data-fn]', 'click', (e, b) => { fn = b.dataset.fn; reset(); render(); });
  on(el, '[data-node]', 'click', (e, b) => { sel0 = b.dataset.node === 'root' ? [] : b.dataset.node.split('.'); msg = null; render(); });
  on(el, '[data-wide]', 'change', (e, b) => { wide = b.checked; render(); });
  on(el, '[data-rule]', 'click', (e, b) => {
    const id = b.dataset.rule, R = RULES[id], nd = getAt(tree, sel0);
    const r = R.run(nd, S().schema, { impervious: imperviousAbove(tree, sel0) });
    if (r.why) { msg = { why: r.why }; render(); return; }
    const before = cost(cur()).value, nt_ = setAt(tree, sel0, r.node), after = cost(ann(nt_, S())).value;
    hist.push({ tree, name: R.name, from: before, to: after });
    tree = nt_; msg = { name: R.name, text: r.msg, heur: R.heur, from: before, to: after, dc: after - before };
    if (!getAt(tree, sel0)) sel0 = [];
    render();
  });
  on(el, '[data-undo]', 'click', () => { const h = hist.pop(); tree = h.tree; msg = null; if (!getAt(tree, sel0)) sel0 = []; render(); });
  on(el, '[data-reset]', 'click', () => { reset(); render(); });
  render();
}

// ====================================================================================
// 3. Size estimator
// ====================================================================================
const num = (id, label, def, extra = {}) => ({ id, label, def, type: 'num', ...extra });
const choose = (id, label, opts, def) => ({ id, label, def, type: 'sel', opts });
const CONDS = [['eq', 'a = v (T/V)'], ['ne', 'a ≠ v'], ['third', 'inequality, T/3'], ['half', 'inequality, T/2'], ['range', 'inequality with min/max']];
const condFields = (p, v) => {
  const k = v[p + 'k'], out = [choose(p + 'k', `Condition ${p === 'c1' ? 1 : 2}`, CONDS, p === 'c1' ? 'eq' : 'third')];
  if (k === 'eq' || k === 'ne') out.push(num(p + 'V', 'V(R, a)', 50));
  if (k === 'range') out.push(choose(p + 'op', 'Operator', [['>', '>'], ['>=', '≥'], ['<', '<'], ['<=', '≤']], '>'), num(p + 'v', 'Value', 20), num(p + 'min', 'min', 0), num(p + 'max', 'max', 100));
  return out;
};
const condFrac = (p, v, T) => {
  const k = v[p + 'k'];
  if (k === 'eq') return { frac: 1 / v[p + 'V'], txt: `1 / V = 1/${nf(v[p + 'V'])}` };
  if (k === 'ne') return { frac: 1 - 1 / v[p + 'V'], txt: `1 − 1/${nf(v[p + 'V'])}` };
  if (k === 'third') return { frac: 1 / 3, txt: '1/3' };
  if (k === 'half') return { frac: 1 / 2, txt: '1/2' };
  const r = C.rangeSel(T, v[p + 'op'], v[p + 'v'], v[p + 'min'], v[p + 'max']);
  return { frac: r.frac, txt: `f = ${f2(r.frac)} (${r.work.split(';')[0].replace(/^f = /, '')})` };
};
const OPS5 = {
  eq: { label: 'σ a = v', fields: () => [num('T', 'T(R)', 10000), num('V', 'V(R, a) or DOM(R, a)', 50)], run: v => { const r = C.eq(v.T, v.V); return { value: r.value, work: r.work, why: 'Assume the values are uniformly distributed: each of the V distinct values owns T/V tuples.' }; } },
  ne: { label: 'σ a ≠ v', fields: () => [num('T', 'T(R)', 10000), num('V', 'V(R, a)', 50)], run: v => { const r = C.neq(v.T, v.V); return { value: r.value, work: r.work, why: 'Only the tuples with the one excluded value fail. When V is not tiny, that is almost nobody, so answering T(R) is accepted.' }; } },
  rng: { label: 'σ a < v, a > v', fields: v => [num('T', 'T(R)', 10000), choose('mode', 'Estimate', [['third', 'T/3'], ['half', 'T/2'], ['mm', 'T × f (min and max known)']], 'third'),
    ...(v.mode === 'mm' ? [choose('op', 'Operator', [['>', '>'], ['>=', '≥'], ['<', '<'], ['<=', '≤']], '>'), num('val', 'Value v', 20), num('min', 'min(a)', 0), num('max', 'max(a)', 100)] : [])],
    run: v => { if (v.mode === 'third') { const r = C.ineqThird(v.T); return { value: r.value, work: r.work, why: 'Rule of thumb: one third of the table satisfies an inequality.' }; }
      if (v.mode === 'half') { const r = C.ineqHalf(v.T); return { value: r.value, work: r.work, why: 'Rule of thumb: half of the table satisfies an inequality.' }; }
      const r = C.rangeSel(v.T, v.op, v.val, v.min, v.max); return { value: r.value, work: r.work, why: 'f = size of the matching part of the value range / size of the whole range. The model answers cut f to 2 decimals before multiplying. ">" uses max − v, "≥" uses max − v + 1.' }; } },
  and: { label: 'AND', fields: v => [num('T', 'T(R)', 10000), ...condFields('c1', v), ...condFields('c2', v), choose('contra', 'Do the conditions contradict?', [['no', 'No'], ['yes', 'Yes (e.g. a = 10 AND a > 20)']], 'no')],
    run: v => { if (v.contra === 'yes') return { value: 0, work: 'The conditions cannot hold together, so no tuple qualifies: T(S) = 0.', why: 'Check for contradictions first (PA 5-3 #1).' };
      const a = condFrac('c1', v, v.T), b = condFrac('c2', v, v.T), val = v.T * a.frac * b.frac;
      return { value: val, work: `T(R) × f × g = ${nf(v.T)} × (${a.txt}) × (${b.txt}) = ${nf(val)}`, why: 'σ<sub>c1∧c2</sub>(R) = σ<sub>c1</sub>(σ<sub>c2</sub>(R)): a cascade, so the fractions multiply.' }; } },
  or: { label: 'OR', fields: v => [num('T', 'T(R)', 10000), ...condFields('c1', v), ...condFields('c2', v)],
    run: v => { const a = condFrac('c1', v, v.T), b = condFrac('c2', v, v.T), x = v.T * a.frac, y = v.T * b.frac;
      return { value: x + y, work: `T(R) × f + T(R) × g = ${nf(x)} + ${nf(y)} = ${nf(x + y)}`, why: 'σ<sub>c1∨c2</sub>(R) = σ<sub>c1</sub>(R) ∪<sub>s</sub> σ<sub>c2</sub>(R): the slide simply ADDS the two sizes (it ignores the overlap).' }; } },
  prod: { label: 'R × S', fields: () => [num('T1', 'T(R)', 1000), num('T2', 'T(S)', 2000)], run: v => { const r = C.product(v.T1, v.T2); return { value: r.value, work: r.work, why: 'Every tuple of R pairs with every tuple of S.' }; } },
  join: { label: 'R ⋈ S', fields: v => [num('T1', 'T(R)', 1000), num('T2', 'T(S)', 2000), choose('n', 'Shared attributes', [['1', '1'], ['2', '2']], '1'), num('a1', 'V(R, y1)', 20), num('b1', 'V(S, y1)', 50), ...(v.n === '2' ? [num('a2', 'V(R, y2)', 10), num('b2', 'V(S, y2)', 10)] : [])],
    run: v => { const pairs = [[v.a1, v.b1], ...(v.n === '2' ? [[v.a2, v.b2]] : [])], r = C.join(v.T1, v.T2, pairs); return { value: r.value, work: r.work, why: 'Divide the product by max(V(R,y), V(S,y)) for each shared attribute y. Chain joins left to right, using the previous result as the new T.' }; } },
  theta: { label: 'R ⋈θ S (non-equality)', fields: () => [num('T1', 'T(R)', 40000), num('T2', 'T(S)', 80000)], run: v => { const r = C.thetaJoin(v.T1, v.T2); return { value: r.value, work: r.work, why: 'An inequality join condition is treated like an inequality selection on the product: one third of the pairs. (Midterm 2025, exercise 6c.)' }; } },
  uni: { label: 'R ∪ S', fields: () => [num('T1', 'T(R)', 1000), num('T2', 'T(S)', 2000)], run: v => { const r = C.union(v.T1, v.T2); return { value: r.value, work: r.work, why: 'Bag union keeps everything.' }; } },
  int: { label: 'R ∩ S', fields: () => [num('T1', 'T(R)', 1000), num('T2', 'T(S)', 2000)], run: v => { const r = C.intersect(v.T1, v.T2); return { value: r.value, work: r.work, why: 'At most min(T(R), T(S)) can match; the slide assumes half of that.' }; } },
  dif: { label: 'R − S', fields: () => [num('T1', 'T(R)', 2000), num('T2', 'T(S)', 1000)], run: v => { const r = C.difference(v.T1, v.T2); return { value: r.value, work: r.work, why: 'The slide formula (T(R) − T(S)) / 2. Note it can go negative if T(S) > T(R): then read it as 0.' }; } },
  dis: { label: 'δ(R)', fields: () => [num('T', 'T(R)', 80000)], run: v => { const r = C.distinct(v.T); return { value: r.value, work: r.work, why: 'Rule of thumb: half the tuples are duplicates (midterm 6d: 80,000 → 40,000).' }; } },
  pro: { label: 'π: bytes and blocks', fields: () => [num('T', 'T(R)', 10000), num('s0', 'Tuple bytes before π', 120), num('s1', 'Tuple bytes after π', 20), num('blk', 'Block bytes', 1024), num('hdr', 'Block header bytes', 24)],
    run: v => { const a = C.blocks({ T: v.T, tupleBytes: v.s0, blockBytes: v.blk, blockHeader: v.hdr }), b = C.blocks({ T: v.T, tupleBytes: v.s1, blockBytes: v.blk, blockHeader: v.hdr });
      return { value: b.value, label: 'B after π', work: `Before: ${a.work}. After π: ${b.work}. T stays ${nf(v.T)}.`, why: 'Bag π does not change T(R). It shrinks S(R), so more tuples fit in a block and B(R) drops.' }; } },
};
const OP5_ORDER = ['eq', 'ne', 'rng', 'and', 'or', 'prod', 'join', 'theta', 'uni', 'int', 'dif', 'dis', 'pro'];
const EST_PRESETS = [
  ['Slide 38: 67', 'and', { T: 10000, c1k: 'eq', c1V: 50, c2k: 'third', contra: 'no' }],
  ['Slide 39: 3,533', 'or', { T: 10000, c1k: 'eq', c1V: 50, c2k: 'third' }],
  ['PA 5-2b: 396', 'rng', { T: 400, mode: 'mm', op: '>', val: 20000000, min: 300000, max: 4500000000 }],
  ['Midterm 6b: 30,000', 'rng', { T: 40000, mode: 'mm', op: '>=', val: 80, min: 40, max: 200 }],
  ['Midterm 6c', 'theta', { T1: 40000, T2: 80000 }],
  ['PA 5-4: R ⋈ S', 'join', { T1: 1000, T2: 2000, n: '1', a1: 20, b1: 50 }],
  ['Slide 30: blocks', 'pro', { T: 10000, s0: 120, s1: 20, blk: 1024, hdr: 24 }],
];
export function u5Estimator(el) {
  let op = 'and', vals = {}, sig = '';
  const fieldsOf = () => OPS5[op].fields(vals);
  const ensureDefaults = () => { let again = true, guard = 0; while (again && guard++ < 4) { again = false; fieldsOf().forEach(f => { if (vals[f.id] === undefined) { vals[f.id] = f.def; again = true; } }); } };
  const form = () => fieldsOf().map(f => f.type === 'sel'
    ? `<div class="field" style="min-width:150px;flex:1 1 150px"><label>${f.label}</label><select data-f="${f.id}">${f.opts.map(([k, t]) => `<option value="${k}" ${String(vals[f.id]) === String(k) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`
    : `<div class="field" style="min-width:130px;flex:1 1 130px"><label>${f.label}</label><input type="number" data-f="${f.id}" value="${vals[f.id]}" step="any"></div>`).join('');
  const result = () => {
    ensureDefaults();
    let r; try { r = OPS5[op].run(vals); } catch (e) { r = null; }
    if (!r || !isFinite(r.value)) return '<p class="small muted">Fill in every field with a number.</p>';
    const shown = Math.abs(r.value) >= 100 ? Math.round(r.value) : f2(r.value);
    return `<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span class="small muted">${r.label || 'Estimated size T(S)'}</span><span class="num hl" style="font-size:28px">${nf(shown)}</span>${Number.isInteger(r.value) ? '' : `<span class="small muted num">exact ${nf(f2(r.value))}</span>`}</div>
      <p class="num small" style="margin:8px 0;overflow-wrap:anywhere">${esc(r.work)}</p><p class="small muted">${r.why}</p>`;
  };
  const sigOf = () => op + '|' + fieldsOf().map(f => f.id).join(',');
  const render = () => {
    ensureDefaults(); sig = sigOf();
    el.innerHTML = body('calculator', 'Size estimator', 'Pick an operation, enter statistics', `
      <div class="chips" style="margin-bottom:8px">${OP5_ORDER.map(k => `<button type="button" class="chip" data-op="${k}" aria-pressed="${k === op}">${OPS5[k].label}</button>`).join('')}</div>
      <div class="chips" style="margin-bottom:10px"><span class="small muted" style="align-self:center">Try:</span>${EST_PRESETS.map(([t], i) => `<button type="button" class="chip accent" data-pre="${i}">${t}</button>`).join('')}</div>
      <div data-form style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">${form()}</div><div data-res>${result()}</div>`);
  };
  on(el, '[data-op]', 'click', (e, b) => { op = b.dataset.op; vals = {}; render(); });
  on(el, '[data-pre]', 'click', (e, b) => { const [, o, v] = EST_PRESETS[+b.dataset.pre]; op = o; vals = { ...v }; render(); });
  el.addEventListener('input', e => {
    const t = e.target.closest('[data-f]'); if (!t) return;
    vals[t.dataset.f] = t.type === 'number' ? parseFloat(t.value) : t.value;
    if (sigOf() !== sig) { sig = sigOf(); ensureDefaults(); el.querySelector('[data-form]').innerHTML = form(); }
    el.querySelector('[data-res]').innerHTML = result();
  });
  render();
}

// ====================================================================================
// 4. Compare two equivalent plans
// ====================================================================================
const CMP = [
  { id: 's40', title: 'Slide 40', ctx: sc.distinct, sql: 'SELECT DISTINCT b FROM R ⋈ S WHERE R.a = 10', stats: 'T(R) = 5000, V(R,a) = 50, V(R,b) = 100, T(S) = 2000, V(S,b) = 200',
    A: ['Alternative 1: δ pushed into both inputs', P.s40a1], B: ['Alternative 2: one δ on top', P.s40a2],
    why: 'Pushing δ below the join (alternative 1) adds two δ nodes whose outputs (50 and 1000 tuples) are both counted, while the single δ of alternative 2 is the root and is not counted. The final answer is different in size (250 vs 500) but the cost compares intermediate results only. Heuristic 4 says "move δ conveniently", not "always down".' },
  { id: 'pa52d', title: 'PA 5-2d', ctx: FJ, sql: 'Unique banana-juice factories in Cairo (FruitJuice ⋈ Factory ⋈ Loc)', stats: 'T(FruitJuice) = 10,000, V(type) = 10; T(Factory) = 400, V(city) = 50; T(Loc) = 2000',
    A: ['Plan 1: both selections on top', P.fj1], B: ['Plan 2: both selections pushed down', P.fj2],
    why: 'Plan 1 builds the whole three-way join (400 and then 10,000 tuples) before filtering. Plan 2 shrinks Factory to 8 tuples and FruitJuice to 1,000 first, so every join afterwards is tiny (Heuristic 1).' },
  { id: 'mid6e', title: 'Midterm 6e', ctx: sc.midterm, sql: 'π a,d ( σ R.c = S.c ∧ d = 5 ( R × S ) )', stats: 'T(R) = 40,000, T(S) = 80,000, V(R,c) = 20,000, V(S,c) = 40,000, V(S,d) = 2000',
    A: ['Model plan 1: σ d = 5 above the join', P.mt1], B: ['Model plan 2: σ d = 5 on S', P.mt2],
    why: 'Both plans are correct (that is all the exam asked: two equivalent plans). Plan 2 is also far cheaper: the join sees 40 tuples of S instead of 80,000, so it produces 40 tuples instead of 80,000. Only S has attribute d, so σ can only go to S.' },
  { id: 'r4', title: 'PA 5-4 join order', ctx: R4, sql: 'R ⋈ S ⋈ U (natural joins)', stats: 'T(R) = 1000, V(R,b) = 20; T(S) = 2000, V(S,b) = 50, V(S,c) = 100; T(U) = 5000, V(U,c) = 500',
    A: ['(R ⋈ S) ⋈ U', P.r4a], B: ['R ⋈ (S ⋈ U)', P.r4b],
    why: 'Both orders give the same final 400,000 tuples (associativity). The cost differs because the first join is different: R ⋈ S makes 40,000 tuples, S ⋈ U makes only 20,000. Heuristic 3: do the join that produces fewer rows first.' },
  { id: 'bk', title: 'Brooklyn (slide 25)', ctx: sc.brooklyn, sql: 'Customers with an account at a Brooklyn branch', stats: '50 branches (10 cities), 10,000 accounts, 12,000 depositors',
    A: ['σ(branch) ⋈ (account ⋈ depositor)', P.bk1], B: ['(σ(branch) ⋈ account) ⋈ depositor', P.bk2],
    why: 'In both plans the σ is already on branch. The difference is the join order. account ⋈ depositor first produces 12,000 tuples; joining the 5 Brooklyn branches with account first produces only 1,000. Heuristic 3 again.' },
  { id: 'mv', title: 'Slide 24', ctx: sc.movies, sql: "SELECT title … WHERE name = starName AND birthdate LIKE '%1960'", stats: 'T(StarsIn) = 10,000, T(MovieStar) = 2,000, 1 star in 50 born in 1960',
    A: ['Plan 1: σ over ×', sc.movies.start], B: ['Plan 2: σ pushed, then a join', P.mv2],
    why: 'Plan 1 builds all 20,000,000 pairs first. Plan 2 filters MovieStar down to 40 stars and then joins: 240 tuples in total. Heuristics 1 and 5 together.' },
];
function cmpBoard(el, startAt, idTag) {
  const g = {}; let at = startAt;
  const render = () => {
    const c = CMP[at], A = ann(c.A[1](), c.ctx), B = ann(c.B[1](), c.ctx), cA = cost(A), cB = cost(B), done = g[c.id] != null;
    const win = cA.value === cB.value ? '=' : cA.value < cB.value ? 'A' : 'B';
    const right = Object.entries(g).filter(([id, v]) => { const x = CMP.find(z => z.id === id); const a = cost(ann(x.A[1](), x.ctx)).value, b = cost(ann(x.B[1](), x.ctx)).value; return v === (a === b ? '=' : a < b ? 'A' : 'B'); }).length;
    const plan = (lab, p, nm, cc) => `<div style="flex:1 1 300px;min-width:0"><div class="small"><strong>${lab}</strong> ${nm}</div>${scroll(draw(p, { sizes: done }))}${done ? `<p class="num small" style="margin:4px 0">intermediate sizes: ${costTxt(cc)}</p>` : ''}</div>`;
    el.innerHTML = body('scales', 'Which plan is cheaper?', `<span class="num">${Object.keys(g).length}/${CMP.length}</span> guessed`, `
      ${chipRow(CMP.map((x, i) => [i, `${g[x.id] != null ? '✓ ' : ''}${x.title}`]), at, 'data-pr')}
      <p class="small" style="margin:0"><strong>${esc(c.sql)}</strong></p><p class="small muted" style="margin:2px 0 10px">${c.stats}</p>
      <div style="display:flex;gap:14px;flex-wrap:wrap">${plan('A.', A, c.A[0], cA)}${plan('B.', B, c.B[0], cB)}</div>
      ${done ? `<div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><tbody><tr><td>Plan A cost</td><td class="num">${nf(cA.value)}</td></tr><tr><td>Plan B cost</td><td class="num">${nf(cB.value)}</td></tr></tbody></table></div>
        ${msgBox(g[c.id] === win ? 'good' : 'bad', `<strong>${g[c.id] === win ? 'Correct.' : `Not quite (you said ${g[c.id]}).`}</strong> ${win === '=' ? 'They are equal.' : `Plan ${win} is cheaper by ${nf(Math.abs(cA.value - cB.value))}.`} ${c.why}`)}
        <p class="small muted">Cost = sum of all intermediate results: not the base tables, not the final result (slide 40).${c.id === 'mid6e' ? ' The exam only asked for two equivalent plans, no cost.' : ''}</p>`
        : `<p class="small" style="margin:12px 0 6px">Both plans return the same result. Which one has the smaller total of intermediate results? Decide first, then the sizes appear.</p>
        <div class="chips"><button type="button" class="btn sm" data-g="A">Plan A is cheaper</button><button type="button" class="btn sm" data-g="B">Plan B is cheaper</button></div>`}
      ${Object.keys(g).length === CMP.length ? `<p class="small hl" style="margin-top:8px">All guessed: ${right}/${CMP.length} right.</p>` : ''}`);
  };
  on(el, '[data-pr]', 'click', (e, b) => { at = +b.dataset.pr; render(); });
  on(el, '[data-g]', 'click', (e, b) => {
    g[CMP[at].id] = b.dataset.g;
    if (Object.keys(g).length === CMP.length) {
      const right = CMP.filter(x => { const a = cost(ann(x.A[1](), x.ctx)).value, b2 = cost(ann(x.B[1](), x.ctx)).value; return g[x.id] === (a === b2 ? '=' : a < b2 ? 'A' : 'B'); }).length;
      recordScore('u5-compare', right, CMP.length);
    }
    render();
  });
  render();
}
export const u5Compare = el => cmpBoard(el, 0);
export const u5CompareLab = el => cmpBoard(el, 1);

// ====================================================================================
// 5. Order plans from worst to best
// ====================================================================================
const ORD = [
  { title: 'Brooklyn query', ctx: sc.brooklyn, plans: [['Selection still on top', P.bk0], ['σ pushed onto branch', P.bk1], ['σ pushed and joins regrouped', P.bk2]], shuffle: [1, 2, 0],
    note: 'Pushing σ (Heuristic 1) helps a lot; ordering the joins so the tiny result goes first (Heuristic 3) helps again.' },
  { title: 'Midterm 6e', ctx: sc.midterm, plans: [['σ over ×', P.mt0], ['σ d = 5 above a join', P.mt1], ['σ d = 5 pushed to S', P.mt2]], shuffle: [2, 0, 1],
    note: 'Turning σ + × into a join (Heuristic 5) removes the 3.2 billion tuple product; pushing σ d = 5 (Heuristic 1) removes the 80,000 tuple join result.' },
  { title: 'Slide 11 and 40', ctx: sc.distinct, plans: [['δ(σ(R ⋈ S))', P.s40p0], ['δ(σ(R) ⋈ S)', P.s40a2], ['δ(σ(R)) ⋈ δ(S)', P.s40a1]], shuffle: [0, 2, 1],
    note: 'The surprise: the plan that pushes δ furthest down (alternative 1) is NOT the cheapest. The heuristics narrow the field, the numbers decide.' },
  { title: 'Slide 23 (MAX)', ctx: sc.gamma, plans: [['Plan 1: γ over σ over ×', P.g1], ['Plan 2: δ and π above the join', P.g2], ['Plan 3: δ and π pushed into the inputs', P.g3]], shuffle: [1, 2, 0],
    note: 'Valid only because MAX ignores duplicates. Each step (σ + × to ⋈, add δ, push δ, push π) shrinks the intermediate results.' },
];
export function u5Heuristics(el) {
  let pi = 0; const picks = ORD.map(() => []), scored = new Set();
  const render = () => {
    const o = ORD[pi], ps = o.plans.map(([name, f]) => { const a = ann(f(), o.ctx); return { name, a, c: cost(a) }; });
    const pick = picks[pi], fin = pick.length === ps.length, truth = [...ps.keys()].sort((x, y) => ps[y].c.value - ps[x].c.value);
    const ok = fin && pick.every((p, i) => ps[p].c.value === ps[truth[i]].c.value);
    if (fin && !scored.has(pi)) { scored.add(pi); if (scored.size === ORD.length) recordScore('u5-order', ORD.filter((_, i) => { const pp = ORD[i].plans.map(([, f]) => cost(ann(f(), ORD[i].ctx)).value); const t = [...pp.keys()].sort((x, y) => pp[y] - pp[x]); return picks[i].every((p, j) => pp[p] === pp[t[j]]); }).length, ORD.length); }
    el.innerHTML = body('sort-descending', 'Rank the plans', 'Tap the plans from WORST to BEST', `
      ${chipRow(ORD.map((x, i) => [i, `${picks[i].length === x.plans.length ? '✓ ' : ''}${x.title}`]), pi, 'data-p')}
      <p class="small muted" style="margin:0 0 10px">Same query, equivalent plans. Tap the one you think is the most expensive first, the cheapest last. Then the sizes and costs are revealed.</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap">${o.shuffle.map(i => { const p = ps[i], r = pick.indexOf(i);
        return `<div style="flex:1 1 280px;min-width:0;border:1px solid ${r >= 0 ? 'var(--accent)' : 'var(--line)'};border-radius:12px;padding:10px;background:var(--surface)">
          <button type="button" class="btn sm ${r >= 0 ? '' : 'primary'}" data-pk="${i}" ${r >= 0 || fin ? 'disabled' : ''}>${r >= 0 ? `Rank ${r + 1} of ${ps.length}${r === 0 ? ' (worst)' : r === ps.length - 1 ? ' (best)' : ''}` : 'Pick next'}</button>
          <div class="small" style="margin:6px 0 2px"><strong>${p.name}</strong></div>${scroll(draw(p.a, { sizes: fin }))}
          ${fin ? `<p class="num small" style="margin:4px 0">cost ${costTxt(p.c)}</p>` : ''}</div>`; }).join('')}</div>
      <div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn sm ghost" data-clr ${pick.length ? '' : 'disabled'}><i class="ph ph-arrow-counter-clockwise"></i>Clear ranking</button></div>
      ${fin ? msgBox(ok ? 'good' : 'bad', `<strong>${ok ? 'Right order.' : 'Not the order the numbers give.'}</strong> Worst to best: ${truth.map(i => `${ps[i].name} (${nf(ps[i].c.value)})`).join(' → ')}. ${o.note}`) : ''}`);
  };
  on(el, '[data-p]', 'click', (e, b) => { pi = +b.dataset.p; render(); });
  on(el, '[data-pk]', 'click', (e, b) => { picks[pi].push(+b.dataset.pk); render(); });
  on(el, '[data-clr]', 'click', () => { picks[pi] = []; render(); });
  render();
}

// ====================================================================================
// 6. Games: is this rewrite legal?  Which layer decides?
// ====================================================================================
const sb = t => `<sub>${t}</sub>`;
export function u5LegalRule(el) {
  const it = (t, a, why) => ({ t, a, why });
  sorter(el, {
    id: 'u5-legal', icon: 'scales', title: 'Is this rewrite legal?', hint: 'Check each rewrite against the formula sheet. "Legal" means the two expressions always return the same result.', options: ['Legal', 'Not legal'], cols: 300,
    items: [
      it(`δ(R ⋈ S) → δ(R) ⋈ δ(S)`, 'Legal', 'Slide 19 rule. Duplicates in R or S produce exactly the duplicates in the join, so removing them first gives the same set of distinct results.'),
      it(`δ(R ∪${sb('B')} S) → δ(R) ∪${sb('B')} δ(S)`, 'Not legal', 'δ cannot be pushed through ∪B. R = {1} and S = {1}: δ(R ∪B S) = {1}, but δ(R) ∪B δ(S) = {1, 1}. The duplicate is across the two inputs.'),
      it(`δ(R −${sb('B')} S) → δ(R) −${sb('B')} δ(S)`, 'Not legal', 'δ cannot be pushed through −B. R = {1, 1}, S = {1}: R −B S = {1}, so δ gives {1}; but δ(R) −B δ(S) = {1} − {1} = {}.'),
      it(`δ(π${sb('L')}(R)) → π${sb('L')}(δ(R))`, 'Not legal', 'δ cannot be pushed through π. R = {(1,a), (1,b)}, L = first column: δ(π(R)) = {1} but π(δ(R)) = {1, 1}.'),
      it(`γ${sb('dept, SUM(salary)')}(R) → γ${sb('dept, SUM(salary)')}(δ(R))`, 'Not legal', 'SUM counts duplicates. Two identical rows (dept d, salary 100) give SUM = 200; after δ only 100. Only MIN and MAX are duplicate-impervious.'),
      it(`γ${sb('dept, MAX(salary)')}(R) → γ${sb('dept, MAX(salary)')}(δ(R))`, 'Legal', 'MAX ignores duplicates, so removing them first changes nothing (slide 20, and the 3 plans of slide 23).'),
      it(`δ(γ${sb('L')}(R)) → γ${sb('L')}(R)`, 'Legal', 'The output of grouping has one row per group, so it has no duplicates. The δ is redundant and can be removed.'),
      it(`(R ⋈${sb('R.b&gt;S.b')} S) ⋈${sb('a&lt;d')} T → R ⋈${sb('R.b&gt;S.b')} (S ⋈${sb('a&lt;d')} T), where a is an attribute of R`, 'Not legal', 'θ-joins are not always associative. The condition a < d needs R.a, but R is not an input of S ⋈ T, so the inner join cannot be evaluated.'),
      it(`(R ⋈ S) ⋈ T → R ⋈ (S ⋈ T) (natural joins)`, 'Legal', 'Natural joins and products are associative. (The result is the same; the sizes of the intermediate results can differ a lot.)'),
      it(`σ${sb('S.f = 17')}(R ⋈ S) → σ${sb('S.f = 17')}(R) ⋈ S, only S has attribute f`, 'Not legal', 'The selection may only be pushed to the relation that has the attributes. R has no f, so the σ must go to S: R ⋈ σ(S).'),
      it(`σ${sb('R.d = 16')}(R ⋈ S) → σ${sb('R.d = 16')}(R) ⋈ S, only R has attribute d`, 'Legal', 'Only R has d, so the selection can be applied to R before the join (Heuristic 1).'),
      it(`σ${sb('c')}(R ∪ S) → σ${sb('c')}(R) ∪ S`, 'Not legal', 'For ∪ the selection must go to BOTH sides: σc(R) ∪ σc(S). Otherwise the tuples of S that fail c would stay in the answer.'),
      it(`σ${sb('c')}(R − S) → σ${sb('c')}(R) − S`, 'Legal', 'Slide 15: σc(R − S) = σc(R) − S = σc(R) − σc(S). The tuples of S that fail c could never cancel anything in σc(R) anyway.'),
      it(`σ${sb('c1 ∨ c2')}(R) → σ${sb('c1')}(σ${sb('c2')}(R))`, 'Not legal', 'A cascade of selections is an AND. An OR splits into a union: σc1(R) ∪s σc2(R).'),
      it(`σ${sb('c1 ∧ c2')}(R) → σ${sb('c1')}(σ${sb('c2')}(R))`, 'Legal', 'An AND is the same as applying the two selections one after the other, in either order.'),
      it(`σ${sb('R.a = S.b')}(R × S) → σ${sb('R.a = S.b')}(R) × S`, 'Not legal', 'The condition uses attributes of both R and S. It cannot be pushed to one side. This pattern is the one to turn into a join: R ⋈ S.'),
      it(`R ⋈${sb('c')} S → σ${sb('c')}(R × S)`, 'Legal', 'This is the sheet rule. It is legal in both directions, but the planner applies it right to left because a join beats a product followed by a selection.'),
      it(`γ${sb('L')}(R) → γ${sb('L')}(π${sb('M')}(R)) where M omits an attribute mentioned in L`, 'Not legal', 'M must contain at least every attribute of R mentioned in L, otherwise γ would be missing an input column.'),
      it(`δ(σ${sb('c')}(R)) → σ${sb('c')}(δ(R))`, 'Legal', 'Slide 19: δ and σ commute. Whether it is cheaper is a different question: usually σ first is better.'),
    ],
  });
}
export function u5Layers(el) {
  const it = (t, a, why) => ({ t, a, why });
  sorter(el, {
    id: 'u5-layers', icon: 'stack', title: 'Which part of the query processor decides this?', hint: 'Parser and preprocessor, logical plan, physical plan, or buffer management.', cols: 300,
    options: ['Parser / preprocessor', 'Logical plan', 'Physical plan', 'Buffer management'],
    items: [
      it('Reject a query because the keyword FORM is misspelt.', 'Parser / preprocessor', 'Syntax is checked by the parser. Parsing is only for checking syntax.'),
      it('Reject a query because table StarsIn does not exist in the catalog.', 'Parser / preprocessor', 'Names and types are checked by the preprocessor, before any optimization.'),
      it('Push σ birthdate LIKE … below the join.', 'Logical plan', 'Choosing between algebraically equivalent forms is logical planning (the query rewriter applies the laws).'),
      it('Decide whether δ goes above or below a join.', 'Logical plan', 'Which of the equivalent expressions is cheapest is the logical-plan question.'),
      it('Use a hash join instead of a nested-loop join.', 'Physical plan', 'The algorithm for each operator is physical planning.'),
      it('Read MovieStar with an index scan instead of a table scan.', 'Physical plan', 'How a relation is accessed depends on the available indexes: physical plan.'),
      it('Sort one input before a join (when and if a relation is sorted).', 'Physical plan', 'The slide lists "when and if a relation should be sorted" under the physical plan.'),
      it('Pass the output of a selection straight into the next operator in main memory.', 'Buffer management', 'How operators hand data to each other (pipelined, buffers, or through disk) is the third question.'),
      it('Write an intermediate result to disk because it does not fit in memory.', 'Buffer management', 'Passing data via the disk is a buffer-management decision.'),
      it('Estimate that σ a = 10 returns T(R)/V(R,a) tuples to choose between two equivalent trees.', 'Logical plan', 'Cost-based logical planning compares equivalent trees by estimated intermediate sizes.'),
      it('Turn σ over × into an equijoin.', 'Logical plan', 'Heuristic 5, an algebraic rewrite. Picking which join algorithm runs it comes later.'),
      it('Decide the order in which the operators of the chosen plan are executed.', 'Physical plan', 'The physical plan includes the algorithms AND the order of execution of the operators.'),
    ],
  });
}

// ====================================================================================
// 7. Numeric drill
// ====================================================================================
const DRILL = [
  { src: 'Slide 38', q: 'R(a,b,c), T(R) = 10,000, V(R,a) = 50. Estimate σ<sub>a=10 AND b&lt;20</sub>(R).', a: [66.67], work: 'T(R) / V(R,a) × 1/3 = 10,000 / 50 × 1/3 = 66.67 ≈ 67' },
  { src: 'Slide 39', q: 'Same R. Estimate σ<sub>a=10 OR b&lt;20</sub>(R).', a: [3533.33], work: 'T/V + T/3 = 200 + 3,333 = 3,533' },
  { src: 'Slide 30', q: 'T(R) = 10,000, 120-byte tuples, 1024-byte blocks with 24-byte headers. How many blocks B(R)?', a: [1250], work: '⌊(1024 − 24) / 120⌋ = 8 tuples per block, B = ⌈10,000 / 8⌉ = 1,250' },
  { src: 'Slide 30', q: 'Same R, but π<sub>a,b</sub> leaves 20-byte tuples. How many blocks B(U)?', a: [200], work: '⌊1000 / 20⌋ = 50 tuples per block, B = ⌈10,000 / 50⌉ = 200' },
  { src: 'PA 5-2a', q: 'T(FruitJuice) = 10,000, V(FruitJuice,type) = 10. Estimate σ<sub>type=mango</sub>(FruitJuice).', a: [1000], work: '10,000 / 10 = 1,000' },
  { src: 'PA 5-2b', q: 'T(Factory) = 400, min(revenue) = 300,000, max(revenue) = 4,500,000,000. Estimate σ<sub>revenue&gt;20,000,000</sub>(Factory).', a: [396, 398.2], work: 'f = (4.5e9 − 2e7) / (4.5e9 − 3e5 + 1) = 0.9956, cut to 0.99, so T = 0.99 × 400 = 396 (the unrounded f gives 398)' },
  { src: 'PA 5-2c', q: 'FruitJuice ⋈ Factory ⋈ Loc with T = 10,000, 400, 2,000; V(FruitJuice,brand) = 300, V(Factory,brand) = 400; V(Factory,city) = 50, V(Loc,city) = 2,000. Estimate the size.', a: [10000], work: '10,000 × 400 × 2,000 / (max(300, 400) × max(50, 2,000)) = 8e9 / 800,000 = 10,000' },
  { src: 'PA 5-3 #1', q: 'T(R) = 10,000, V(R,a) = 50. Estimate σ<sub>a=10 AND a&gt;20</sub>(R).', a: [0], work: 'The conditions contradict each other: no tuple has a = 10 and a > 20. T(S) = 0' },
  { src: 'PA 5-4', q: 'R(a,b), S(b,c), U(c,d): T = 1000, 2000, 5000; V(R,b) = 20, V(S,b) = 50, V(S,c) = 100, V(U,c) = 500. Size of R ⋈ S ⋈ U (left to right)?', a: [400000], work: 'R ⋈ S = 1000 × 2000 / max(20, 50) = 40,000. Then 40,000 × 5000 / max(100, 500) = 400,000' },
  { src: 'PA 5-5 #1', q: 'W(a,b) 100, X(b,c) 200, Y(c,d) 300, Z(d,e) 400 tuples; V(W,b) = 60, V(X,b) = 50, V(X,c) = 100, V(Y,c) = 50, V(Y,d) = 50, V(Z,d) = 40. Size of W ⋈ X ⋈ Y ⋈ Z?', a: [8000], work: '100 × 200 × 300 × 400 / (max(60, 50) × max(100, 50) × max(50, 40)) = 2.4e9 / 300,000 = 8,000' },
  { src: 'PA 5-5 #2', q: 'T(W) = 100, V(W,a) = 20. Estimate σ<sub>a=10</sub>(W).', a: [5], work: '100 / 20 = 5' },
  { src: 'PA 5-5 #3', q: 'T(Y) = 300, V(Y,c) = 50. Estimate σ<sub>c=20</sub>(Y).', a: [6], work: '300 / 50 = 6' },
  { src: 'PA 5-5 #4', q: 'σ<sub>c=20</sub>(Y) ⋈ Z, with V(Y,d) = 50, V(Z,d) = 40, T(Z) = 400.', a: [48], work: '6 × 400 / max(50, 40) = 2,400 / 50 = 48 (V(Y,d) keeps its original value 50)' },
  { src: 'PA 5-5 #5', q: 'T(W) = 100, T(Y) = 300. Size of W × Y?', a: [30000], work: '100 × 300 = 30,000' },
  { src: 'PA 5-5 #6', q: 'T(Z) = 400. Estimate σ<sub>d&gt;10</sub>(Z) with the T/3 rule.', a: [133.33], work: '400 / 3 = 133.3 ≈ 133' },
  { src: 'PA 5-5 #7', q: 'T(W) = 100, V(W,a) = 20, V(W,b) = 60. Estimate σ<sub>a=1 AND b=2</sub>(W).', a: [0.08, 0], work: '100 / (20 × 60) = 0.083. The PA writes 0 (it rounds), an exam would accept 0 or a fraction near 0' },
  { src: 'PA 5-5 #8', q: 'T(W) = 100, V(W,a) = 20. Estimate σ<sub>a=1 AND b&gt;2</sub>(W) (inequality = T/3).', a: [1.67, 2], work: '100 / (20 × 3) = 1.67 ≈ 2' },
  { src: 'PA 5-5 #9', q: 'T(X) = 200, T(Y) = 300. Estimate X ⋈<sub>X.c&lt;Y.c</sub> Y.', a: [20000], work: '200 × 300 / 3 = 20,000' },
  { src: 'Midterm 6a', q: 'T(R) = 40,000, V(R,a) = 2000. Estimate σ<sub>a=4</sub>(R).', a: [20], work: '40,000 / 2000 = 20' },
  { src: 'Midterm 6b', q: 'T(R) = 40,000, min(a) = 40, max(a) = 200. Estimate σ<sub>a≥80</sub>(R).', a: [30000], work: 'f = (200 − 80 + 1) / (200 − 40 + 1) = 121/161 = 0.75 (cut), T = 0.75 × 40,000 = 30,000' },
  { src: 'Midterm 6c', q: 'T(R) = 40,000, T(S) = 80,000. Estimate R ⋈<sub>b&gt;80</sub> S.', a: [1066666666.67], work: '40,000 × 80,000 / 3 = 1,066,666,667' },
  { src: 'Midterm 6d', q: 'T(S) = 80,000. Estimate δ(S).', a: [40000], work: '80,000 / 2 = 40,000' },
  { src: 'Slide 40', q: 'T(R) = 5000, V(R,a) = 50, V(R,b) = 100, T(S) = 2000, V(S,b) = 200. Size of δ(σ<sub>a=10</sub>(R)) ⋈ δ(S) (alternative 1)?', a: [250], work: 'σ = 5000/50 = 100, δ = 50; δ(S) = 1000; join = 50 × 1000 / max(100, 200) = 250' },
  { src: 'Slide 40', q: 'Same statistics. Cost (sum of intermediate nodes) of alternative 2, δ(σ<sub>a=10</sub>(R) ⋈ S)?', a: [1100], work: 'σ = 100, join = 100 × 2000 / 200 = 1,000, δ = 500 is the root. Cost = 100 + 1,000 = 1,100' },
];
const drillOk = (it, x) => it.a.some(a => Math.abs(x - a) <= Math.max(0.6, Math.abs(a) * 0.0005));
export function u5Drill(el) {
  let at = 0, ans = {}, done = {};
  const render = () => {
    const it = DRILL[at], d = done[at], n = Object.keys(done).length, right = Object.entries(done).filter(([i, v]) => v.ok).length;
    el.innerHTML = body('target', 'Number drill', `<span class="num">${right}/${n}</span> right of ${DRILL.length}`, `
      ${chipRow(DRILL.map((x, i) => [i, `${done[i] ? (done[i].ok ? '✓' : '✗') : i + 1}`]), at, 'data-i')}
      <p class="small muted" style="margin:0">${it.src}</p><p style="margin:4px 0 10px">${it.q}</p>
      <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap"><div class="field" style="max-width:220px;margin:0"><label>Your answer</label><input type="number" step="any" data-ans value="${ans[at] ?? ''}" ${d ? 'disabled' : ''}></div>
        <button type="button" class="btn sm primary" data-chk ${d ? 'disabled' : ''}>Check</button>
        <button type="button" class="btn sm" data-nx ${at < DRILL.length - 1 ? '' : 'disabled'}>Next<i class="ph ph-caret-right"></i></button></div>
      ${d ? msgBox(d.ok ? 'good' : 'bad', `<strong>${d.ok ? 'Right.' : 'Not this time.'}</strong> <span class="num">${esc(it.work)}</span>`) : ''}
      ${n === DRILL.length ? `<p class="small hl" style="margin-top:8px">Finished: ${right}/${DRILL.length}.</p>` : ''}`);
  };
  on(el, '[data-i]', 'click', (e, b) => { at = +b.dataset.i; render(); });
  on(el, '[data-nx]', 'click', () => { at = Math.min(DRILL.length - 1, at + 1); render(); });
  on(el, '[data-chk]', 'click', () => {
    const v = parseFloat(el.querySelector('[data-ans]').value); if (!isFinite(v)) return;
    ans[at] = v; done[at] = { ok: drillOk(DRILL[at], v) };
    if (Object.keys(done).length === DRILL.length) recordScore('u5-drill', Object.values(done).filter(x => x.ok).length, DRILL.length);
    render();
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-ans]')) el.querySelector('[data-chk]').click(); });
  render();
}

// exported for the content file (static drawings and numbers): not a simulator
export const u5Model = { eqc, rgc, lkc, aeq, rel, sel, jn, prod, dst, prj, grp, annotate, cost, costTxt, draw, sc, P, FJ, R4, RULES, strip, PIPE };
