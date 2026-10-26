// B+ tree engine following the ICS502 lecture rules (Lecture 2) and the PA2 conventions.
// Pure functions: every operation returns a NEW tree plus a list of steps for step-through simulators.
//
// A tree: { n, opts, root } where a node is { id, leaf, keys: [], children: [] (non-leaf only) }.
// Options (defaults follow the lecture text):
//   leafSplit:    'left'  -> on a leaf overflow the LEFT leaf keeps the extra key (PA2-4 rule, textbook)
//                 'right' -> the RIGHT leaf keeps the extra key (what the PA2-2 solution does for n = 2)
//   siblings:     'either' -> try to borrow from the left sibling, then the right one, then merge (Lecture 2 step 4, PA2-3)
//                 'left'   -> only look at the LEFT sibling when there is one (PA2-4: "prefer the left sibling")
//   mergeFirst:   false (default). true merges whenever both nodes fit in one node (the Lecture 2 slide 39 "delete 50" figure).
// Separator keys are kept equal to the smallest key of the subtree on their right (this is what every
// lecture, PA and midterm figure shows, including after deletions).

let NEXT = 1;
const mk = (leaf, keys = [], children = []) => (leaf ? { id: NEXT++, leaf: true, keys } : { id: NEXT++, leaf: false, keys, children });

export const DEFAULTS = { leafSplit: 'left', siblings: 'either', mergeFirst: false };

// ------------------------------------------------------------ thresholds (Lecture 2, slide 16)
export function limits(n) {
  const half = (n + 1) / 2;
  return {
    root: { maxKeys: n, maxPtrs: n + 1, minKeys: 1, minPtrs: 1 },
    nonleaf: { maxKeys: n, maxPtrs: n + 1, minKeys: Math.ceil(half) - 1, minPtrs: Math.ceil(half) },
    leaf: { maxKeys: n, maxPtrs: n + 1, minKeys: Math.floor(half), minPtrs: Math.floor(half) + 1 },
  };
}
// Lecture 2 slide 14: n keys of k bytes and n + 1 pointers of p bytes must fit in a block of b bytes.
export const nFromBlock = (block, keyBytes, ptrBytes, header = 0) => Math.floor((block - header - ptrBytes) / (keyBytes + ptrBytes));

// ------------------------------------------------------------ build / copy / compare
// Spec format: a leaf is an array of keys [2, 3, 5]; a non-leaf is { k: [13], c: [child, child] }.
export function fromSpec(n, spec, opts = {}) {
  const build = s => Array.isArray(s) ? mk(true, [...s]) : mk(false, [...s.k], s.c.map(build));
  return { n, opts: { ...DEFAULTS, ...opts }, root: spec == null ? null : build(spec) };
}
export function toSpec(t) {
  const out = nd => nd.leaf ? [...nd.keys] : { k: [...nd.keys], c: nd.children.map(out) };
  return t.root ? out(t.root) : null;
}
export const empty = (n, opts = {}) => ({ n, opts: { ...DEFAULTS, ...opts }, root: null });
const cloneNode = nd => nd.leaf ? { id: nd.id, leaf: true, keys: [...nd.keys] } : { id: nd.id, leaf: false, keys: [...nd.keys], children: nd.children.map(cloneNode) };
export const clone = t => ({ n: t.n, opts: { ...t.opts }, root: t.root ? cloneNode(t.root) : null });
export const sameShape = (a, b) => JSON.stringify(toSpec(a)) === JSON.stringify(toSpec(b));
export const specString = t => JSON.stringify(toSpec(t));

export function leaves(t) {
  const out = [];
  const walk = nd => nd.leaf ? out.push(nd) : nd.children.forEach(walk);
  if (t.root) walk(t.root);
  return out;
}
export const allKeys = t => leaves(t).flatMap(l => l.keys);
export function height(t) { let h = 0, nd = t.root; while (nd) { h++; nd = nd.leaf ? null : nd.children[0]; } return h; }
const minKey = nd => nd.leaf ? nd.keys[0] : minKey(nd.children[0]);
function normalize(nd) {
  if (!nd || nd.leaf) return;
  nd.children.forEach(normalize);
  nd.keys = nd.children.slice(1).map(minKey);
}

// Structural check against the n-rules. Returns a list of problems (empty = valid B+ tree).
export function validate(t) {
  const errs = [], L = limits(t.n);
  if (!t.root) return errs;
  const depths = new Set();
  const walk = (nd, isRoot, lo, hi, d) => {
    const k = nd.keys;
    if (k.some((v, i) => i && v <= k[i - 1])) errs.push(`node [${k}] keys not strictly increasing`);
    if (k.length > t.n) errs.push(`node [${k}] has more than n = ${t.n} keys`);
    if (k.some(v => (lo != null && v < lo) || (hi != null && v >= hi))) errs.push(`node [${k}] has a key outside its range [${lo}, ${hi})`);
    if (nd.leaf) {
      depths.add(d);
      if (!isRoot && k.length < L.leaf.minKeys) errs.push(`leaf [${k}] has fewer than ${L.leaf.minKeys} keys`);
    } else {
      if (nd.children.length !== k.length + 1) errs.push(`node [${k}] has ${nd.children.length} children for ${k.length} keys`);
      if (!isRoot && k.length < L.nonleaf.minKeys) errs.push(`non-leaf [${k}] has fewer than ${L.nonleaf.minKeys} keys`);
      if (isRoot && nd.children.length < 2) errs.push('root has fewer than two children');
      nd.children.forEach((c, i) => walk(c, false, i ? k[i - 1] : lo, i < k.length ? k[i] : hi, d + 1));
    }
  };
  walk(t.root, true, null, null, 0);
  if (depths.size > 1) errs.push('leaves are not all at the same depth (tree not balanced)');
  return errs;
}

// ------------------------------------------------------------ search
// Returns { found, path: [node ids], text: [one line per node visited] }.
export function search(t, key) {
  const path = [], text = [];
  let nd = t.root;
  if (!nd) return { found: false, path, text: ['The tree is empty.'] };
  while (!nd.leaf) {
    path.push(nd.id);
    let i = 0; while (i < nd.keys.length && key >= nd.keys[i]) i++;
    text.push(i === 0 ? `[${nd.keys}]: ${key} < ${nd.keys[0]}, follow pointer 1.`
      : i === nd.keys.length ? `[${nd.keys}]: ${key} ≥ ${nd.keys[i - 1]}, follow the last pointer (${i + 1}).`
        : `[${nd.keys}]: ${nd.keys[i - 1]} ≤ ${key} < ${nd.keys[i]}, follow pointer ${i + 1}.`);
    nd = nd.children[i];
  }
  path.push(nd.id);
  const found = nd.keys.includes(key);
  text.push(`Leaf [${nd.keys}]: ${found ? `${key} found, follow its pointer to the record.` : `${key} is not here, so no record has this key.`}`);
  return { found, path, leafId: nd.id, text, nodes: path.length };
}
// Range lookup lo <= key <= hi (use -Infinity / Infinity for open ends): descend once, then follow next-leaf pointers.
export function range(t, lo, hi) {
  const out = { keys: [], path: [], leafIds: [], text: [] };
  if (!t.root) return out;
  let nd = t.root;
  const start = Number.isFinite(lo) ? lo : -Infinity;
  while (!nd.leaf) { out.path.push(nd.id); let i = 0; while (i < nd.keys.length && start >= nd.keys[i]) i++; nd = nd.children[i]; }
  const ls = leaves(t); let li = ls.findIndex(l => l.id === nd.id);
  for (; li < ls.length; li++) {
    const l = ls[li], hit = l.keys.filter(k => k >= lo && k <= hi);
    out.leafIds.push(l.id); out.keys.push(...hit);
    out.text.push(`Leaf [${l.keys}]: ${hit.length ? `take ${hit.join(', ')}` : 'nothing in range'}${l.keys.some(k => k > hi) ? ', a key is past the end, stop.' : li < ls.length - 1 ? ', follow the next-leaf pointer.' : ', last leaf.'}`);
    if (l.keys.some(k => k > hi)) break;
  }
  return out;
}

// ------------------------------------------------------------ insert
function pathTo(root, key) {
  const path = []; let nd = root;
  while (!nd.leaf) { let i = 0; while (i < nd.keys.length && key >= nd.keys[i]) i++; path.push([nd, i]); nd = nd.children[i]; }
  return { path, leaf: nd };
}

export function insert(t0, key) {
  const t = clone(t0), steps = [], { n } = t;
  const snap = (text, hl = [], kind = 'info') => steps.push({ text, kind, hl, tree: clone(t) });
  if (!t.root) { t.root = mk(true, [key]); snap(`The tree was empty: ${key} becomes a root that is also a leaf.`, [t.root.id]); return { tree: t, steps }; }
  const { path, leaf } = pathTo(t.root, key);
  if (leaf.keys.includes(key)) { snap(`${key} is already in the tree. Keys in this B+ tree are unique, so nothing changes.`, [leaf.id], 'warn'); return { tree: t, steps, duplicate: true }; }
  leaf.keys.push(key); leaf.keys.sort((a, b) => a - b);
  if (leaf.keys.length <= n) { snap(`Find the leaf for ${key} and insert it in order: [${leaf.keys}] has room (at most n = ${n} keys). Done.`, [leaf.id], 'ok'); return { tree: t, steps }; }
  snap(`Insert ${key} into its leaf: [${leaf.keys}] now has ${leaf.keys.length} keys, more than n = ${n}. The leaf must split.`, [leaf.id], 'warn');
  // split leaf
  const total = leaf.keys.length, leftCount = t.opts.leafSplit === 'right' ? Math.floor(total / 2) : Math.ceil(total / 2);
  const right = mk(true, leaf.keys.slice(leftCount)); leaf.keys = leaf.keys.slice(0, leftCount);
  let sep = right.keys[0], newChild = right, child = leaf;
  snap(`Split the leaf into [${leaf.keys}] and [${right.keys}] (${t.opts.leafSplit === 'right' && total % 2 ? 'right' : 'left'} leaf keeps the extra key when it cannot split evenly). Copy ${sep}, the first key of the new right leaf, up to the parent.`, [leaf.id, right.id]);
  for (let lvl = path.length - 1; lvl >= -1; lvl--) {
    if (lvl === -1) { // split reached the root: grow a new root
      t.root = mk(false, [sep], [child, newChild]);
      snap(`There is no parent to absorb ${sep}, so create a new root [${sep}]. The tree grows one level taller.`, [t.root.id], 'ok');
      break;
    }
    const [p, i] = path[lvl];
    p.keys.splice(i, 0, sep); p.children.splice(i + 1, 0, newChild);
    if (p.keys.length <= n) { snap(`Insert ${sep} into the parent: [${p.keys}] has room. Done.`, [p.id], 'ok'); break; }
    snap(`Insert ${sep} into the parent: [${p.keys}] now has ${p.keys.length} keys (${p.children.length} pointers), so this non-leaf splits too.`, [p.id], 'warn');
    const ptrs = p.children.length, leftPtrs = Math.ceil(ptrs / 2);
    const up = p.keys[leftPtrs - 1];
    const r = mk(false, p.keys.slice(leftPtrs), p.children.slice(leftPtrs));
    p.keys = p.keys.slice(0, leftPtrs - 1); p.children = p.children.slice(0, leftPtrs);
    snap(`Split it into [${p.keys}] and [${r.keys}]. The middle key ${up} MOVES up (in a non-leaf it is not kept below, unlike a leaf split).`, [p.id, r.id]);
    sep = up; child = p; newChild = r;
  }
  return { tree: t, steps };
}

// ------------------------------------------------------------ delete
export function remove(t0, key) {
  const t = clone(t0), steps = [], { n } = t, L = limits(n), o = t.opts;
  const snap = (text, hl = [], kind = 'info') => { normalize(t.root); steps.push({ text, kind, hl, tree: clone(t) }); };
  if (!t.root) { snap('The tree is empty.', [], 'warn'); return { tree: t, steps, missing: true }; }
  const { path, leaf } = pathTo(t.root, key);
  const at = leaf.keys.indexOf(key);
  if (at < 0) { snap(`${key} is not in the tree, so nothing is deleted.`, [leaf.id], 'warn'); return { tree: t, steps, missing: true }; }
  leaf.keys.splice(at, 1);
  if (!path.length) { // the root is a leaf
    if (!leaf.keys.length) t.root = null;
    snap(leaf.keys.length ? `Delete ${key} from the root leaf. The root may hold as few as 1 key. Done.` : `Delete ${key}: the tree is now empty.`, leaf.keys.length ? [leaf.id] : [], 'ok');
    return { tree: t, steps };
  }
  if (leaf.keys.length >= L.leaf.minKeys) {
    snap(`Delete ${key} from its leaf: [${leaf.keys}] still has at least ${L.leaf.minKeys} keys (leaf minimum ⌊(n+1)/2⌋). ${at === 0 ? 'The first key changed, so the separator above it now shows the new smallest key. ' : ''}Done.`, [leaf.id], 'ok');
    return { tree: t, steps };
  }
  snap(`Delete ${key}: leaf [${leaf.keys}] now has ${leaf.keys.length} key${leaf.keys.length === 1 ? '' : 's'}, below the leaf minimum of ${L.leaf.minKeys}. Underflow.`, [leaf.id], 'warn');
  let node = leaf;
  for (let lvl = path.length - 1; lvl >= 0; lvl--) {
    const [p, i] = path[lvl], isLeaf = node.leaf, min = isLeaf ? L.leaf.minKeys : L.nonleaf.minKeys;
    const left = i > 0 ? p.children[i - 1] : null, right = i < p.children.length - 1 ? p.children[i + 1] : null;
    const cands = o.siblings === 'left' ? [left ? ['left', left] : ['right', right]] : [['left', left], ['right', right]];
    const usable = cands.filter(([, s]) => s);
    const fits = s => s.keys.length + node.keys.length + (isLeaf ? 0 : 1) <= n;
    // 1) borrow (redistribute)
    const tryBorrow = () => {
      for (const [side, s] of usable) {
        if (s.keys.length <= min) continue;
        const before = `[${s.keys}]`;
        if (isLeaf) {
          const k = side === 'left' ? s.keys.pop() : s.keys.shift();
          side === 'left' ? node.keys.unshift(k) : node.keys.push(k);
          snap(`Redistribute: the ${side} sibling ${before} has more than the minimum, so ${k} moves over. Now [${side === 'left' ? s.keys : node.keys}] and [${side === 'left' ? node.keys : s.keys}]; the parent's separator becomes the smallest key of the right one.`, [node.id, s.id, p.id], 'ok');
        } else {
          if (side === 'left') { node.keys.unshift(p.keys[i - 1]); node.children.unshift(s.children.pop()); p.keys[i - 1] = s.keys.pop(); }
          else { node.keys.push(p.keys[i]); node.children.push(s.children.shift()); p.keys[i] = s.keys.shift(); }
          snap(`Non-leaf redistribution: the ${side} sibling ${before} has a spare key. Rotate through the parent: the parent's separator comes down into the underfull node, the sibling's ${side === 'left' ? 'last' : 'first'} child pointer moves across with it, and a sibling key goes up to the parent.`, [node.id, s.id, p.id], 'ok');
        }
        return true;
      }
      return false;
    };
    // 2) merge (coalesce)
    const tryMerge = () => {
      for (const [side, s] of usable) {
        if (!fits(s)) continue;
        const [a, b, ai] = side === 'left' ? [s, node, i - 1] : [node, s, i];
        const sepKey = p.keys[ai];
        if (isLeaf) a.keys = a.keys.concat(b.keys);
        else { a.keys = a.keys.concat([sepKey], b.keys); a.children = a.children.concat(b.children); }
        p.keys.splice(ai, 1); p.children.splice(ai + 1, 1);
        snap(`Merge (coalesce) with the ${side} sibling into [${a.keys}]${isLeaf ? '' : `: the parent's separator ${sepKey} comes down between the two`}. One node disappears, so the parent loses the key ${sepKey} and one pointer.`, [a.id, p.id], 'warn');
        return true;
      }
      return false;
    };
    const how = o.mergeFirst ? (tryMerge() ? 'merge' : tryBorrow() ? 'borrow' : null) : (tryBorrow() ? 'borrow' : tryMerge() ? 'merge' : null);
    if (!how) { snap('No sibling can lend a key and no merge fits (this cannot happen in a valid tree).', [node.id], 'warn'); break; }
    if (how === 'borrow') return finish();
    if (lvl === 0) { // the parent is the root
      if (!p.keys.length) { t.root = p.children[0]; snap('The root has no keys left (only one pointer), so its single child becomes the new root. The tree shrinks one level.', [t.root.id], 'ok'); }
      else snap(`The root [${p.keys}] may hold as few as 1 key. Done.`, [p.id], 'ok');
      return finish();
    }
    if (p.keys.length >= L.nonleaf.minKeys) { snap(`The parent [${p.keys}] still has at least ${L.nonleaf.minKeys} key${L.nonleaf.minKeys === 1 ? '' : 's'} (non-leaf minimum ⌈(n+1)/2⌉ − 1). Done.`, [p.id], 'ok'); return finish(); }
    snap(`The parent [${p.keys}] now has ${p.keys.length} key${p.keys.length === 1 ? '' : 's'}, below the non-leaf minimum of ${L.nonleaf.minKeys}. Apply the same fix one level up.`, [p.id], 'warn');
    node = p;
  }
  return finish();
  function finish() { normalize(t.root); return { tree: t, steps }; }
}

// Apply a list of operations: [['insert', 12], ['delete', 7], ...]. Returns every intermediate tree.
export function run(t, ops) {
  const out = []; let cur = t;
  for (const [op, k] of ops) { const r = op === 'insert' ? insert(cur, k) : remove(cur, k); cur = r.tree; out.push({ op, key: k, tree: cur, steps: r.steps }); }
  return out;
}
export const build = (n, keys, opts = {}) => keys.reduce((t, k) => insert(t, k).tree, empty(n, opts));
