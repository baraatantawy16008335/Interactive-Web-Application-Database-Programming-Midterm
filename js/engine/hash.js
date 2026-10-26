// Hash index engines following Lecture 3 and PA3. Keys are already-hashed bit strings like "0110".
// Every operation returns a NEW state plus steps (text + snapshot) for step-through simulators.

const copy = x => JSON.parse(JSON.stringify(x));

// ================================================================ static hashing
// { B: number of buckets, cap, buckets: [{ recs: [], over: [[...], ...] }] }  (over = chain of overflow blocks)
export function staticNew(B, cap, initial = []) {
  const s = { B, cap, buckets: Array.from({ length: B }, () => ({ recs: [], over: [] })) };
  initial.forEach((recs, b) => recs.forEach(r => staticPut(s, b, r)));
  return s;
}
function staticPut(s, b, r) {
  const bk = s.buckets[b];
  if (bk.recs.length < s.cap) { bk.recs.push(r); return 'primary'; }
  for (const blk of bk.over) if (blk.length < s.cap) { blk.push(r); return 'overflow'; }
  bk.over.push([r]); return 'new overflow block';
}
export function staticInsert(s0, bucket, rec) {
  const s = copy(s0), where = staticPut(s, bucket, rec);
  return { state: s, steps: [{ text: where === 'primary' ? `Bucket ${bucket} has room: ${rec} goes into its block.` : where === 'overflow' ? `Bucket ${bucket} is full: ${rec} goes into the existing overflow block on its chain.` : `Bucket ${bucket} and its chain are full: chain a NEW overflow block and put ${rec} there.`, state: copy(s), hl: bucket, kind: where === 'primary' ? 'ok' : 'warn' }] };
}
// Deleting compacts the bucket: records from the overflow chain move up into the free slot (PA3-1 b and d).
export function staticDelete(s0, rec) {
  const s = copy(s0);
  for (let b = 0; b < s.B; b++) {
    const bk = s.buckets[b], all = [...bk.recs, ...bk.over.flat()], i = all.indexOf(rec);
    if (i < 0) continue;
    all.splice(i, 1);
    bk.recs = all.slice(0, s.cap); bk.over = [];
    for (let k = s.cap; k < all.length; k += s.cap) bk.over.push(all.slice(k, k + s.cap));
    return { state: s, steps: [{ text: `Delete ${rec} from bucket ${b}.${all.length >= s.cap ? ' Records from the overflow chain move up to fill the gap, and an empty overflow block is removed.' : ''}`, state: copy(s), hl: b, kind: 'ok' }] };
  }
  return { state: s, steps: [{ text: `${rec} is not in the table.`, state: copy(s), hl: null, kind: 'warn' }] };
}

// ================================================================ extensible hashing
// { i, cap, bits, dir: [bucketId, ...] (length 2^i), buckets: { id: { j, recs: [] } } }
// The directory uses the FIRST i bits (from the left) of h(K). Each bucket stores j, the number of bits its
// records share. Lecture 3 insertion steps 1-4 (split when j < i, double the directory when j = i).
export function extNew({ i = 1, cap = 2, bits = 4, buckets }) {
  // buckets: list of { prefix: '0', j: 1, recs: [] } describing which directory entries point where
  const s = { i, cap, bits, dir: [], buckets: {} };
  let id = 0;
  for (const b of buckets) { const key = 'b' + id++; s.buckets[key] = { j: b.j ?? i, recs: [...(b.recs || [])] }; b._k = key; }
  for (let e = 0; e < 2 ** i; e++) {
    const w = i ? e.toString(2).padStart(i, '0') : '';
    const owner = buckets.find(b => w.startsWith(b.prefix ?? ''));
    s.dir.push(owner._k);
  }
  return s;
}
const prefixOf = (h, i) => (i ? parseInt(h.slice(0, i), 2) : 0);
let EXT_ID = 1000;
export function extInsert(s0, h) {
  const s = copy(s0), steps = [];
  const snap = (text, hl = {}, kind = 'info') => steps.push({ text, kind, hl, state: copy(s) });
  for (let guard = 0; guard < 12; guard++) {
    const e = prefixOf(h, s.i), id = s.dir[e], bk = s.buckets[id];
    const w = s.i ? h.slice(0, s.i) : '(none)';
    if (bk.recs.length < s.cap) {
      bk.recs.push(h);
      snap(`h(K) = ${h}. The first i = ${s.i} bit${s.i === 1 ? '' : 's'} (${w}) pick${s.i === 1 ? 's' : ''} directory entry ${w}; its bucket has room, so ${h} goes in.`, { entry: e, bucket: id }, 'ok');
      return { state: s, steps };
    }
    snap(`h(K) = ${h}. The first i = ${s.i} bit${s.i === 1 ? '' : 's'} (${w}) lead${s.i === 1 ? 's' : ''} to a full bucket (j = ${bk.j}).`, { entry: e, bucket: id }, 'warn');
    if (bk.j >= s.bits) { // every bit already used: fall back to an overflow chain
      (bk.over ||= []).push(h);
      snap(`All ${s.bits} bits are already used by this bucket, so it cannot split any further. Add an overflow block (rare: it only happens with many identical hash values).`, { bucket: id }, 'warn');
      return { state: s, steps };
    }
    if (bk.j === s.i) {
      const old = s.dir;
      s.dir = old.flatMap(x => [x, x]); s.i++;
      snap(`j = i, so first increment i to ${s.i}: the directory doubles to ${s.dir.length} entries. Entries w0 and w1 both point where w used to point; the other buckets keep their j.`, { bucket: id }, 'warn');
    }
    // split bucket id on bit j (0-based index j, i.e. the (j+1)st bit from the left)
    const j = bk.j, nid = 'b' + EXT_ID++;
    const all = bk.recs;
    bk.recs = all.filter(r => r[j] === '0'); bk.j = j + 1;
    s.buckets[nid] = { j: j + 1, recs: all.filter(r => r[j] === '1') };
    s.dir = s.dir.map((x, ei) => x === id && ei.toString(2).padStart(s.i, '0')[j] === '1' ? nid : x);
    snap(`Split the bucket on bit ${j + 1} (from the left): records with 0 there stay, records with 1 move to a new bucket. Both get j = ${j + 1}, and the directory entries are re-pointed by their bit ${j + 1}.`, { bucket: id, bucket2: nid }, 'info');
  }
  return { state: s, steps };
}
export function extDelete(s0, h) {
  const s = copy(s0);
  const id = s.dir[prefixOf(h, s.i)], bk = s.buckets[id], i = bk.recs.indexOf(h);
  if (i < 0) return { state: s, steps: [{ text: `${h} is not in the table.`, state: copy(s), kind: 'warn', hl: {} }] };
  bk.recs.splice(i, 1);
  return { state: s, steps: [{ text: `Remove ${h} from its bucket. (A full implementation may then merge buddy buckets and halve the directory: the reverse of insertion.)`, state: copy(s), kind: 'ok', hl: { bucket: id } }] };
}
// Groups of directory entries per bucket, in directory order (for drawing).
export function extBuckets(s) {
  const seen = []; s.dir.forEach(id => { if (!seen.includes(id)) seen.push(id); });
  return seen.map(id => ({ id, ...s.buckets[id], entries: s.dir.map((x, e) => x === id ? e : -1).filter(e => e >= 0) }));
}

// ================================================================ linear hashing
// { n, i, cap, bits, threshold, buckets: [{ recs: [], over: [] }] }  (bucket b is labelled with i bits)
// Lecture 3 + PA3-4 rules, checked against every worked example:
//  * utilization = records / (n * cap)   (= "# records / (# slots in table - # slots in overflow buckets)")
//    computed BEFORE inserting the new record; if it is >= threshold, add bucket n first.
//  * i = ceil(log2 n), bits taken from the RIGHT (low-order) end.
//  * m = last i bits as a number. If m < n put the record in bucket m, otherwise in bucket m - 2^(i-1).
export const linBits = n => Math.max(1, Math.ceil(Math.log2(n)));
export function linNew({ n = 2, cap = 2, bits = 4, threshold = 0.8, buckets = [] }) {
  const s = { n, i: linBits(n), cap, bits, threshold, buckets: Array.from({ length: n }, (_, b) => ({ recs: [...((buckets[b] || {}).recs || buckets[b] || [])], over: [...((buckets[b] || {}).over || [])] })) };
  return s;
}
export const linCount = s => s.buckets.reduce((a, b) => a + b.recs.length + b.over.length, 0);
export const linUtil = s => linCount(s) / (s.n * s.cap);
const lowBits = (h, i) => parseInt(h.slice(-i), 2);
export function linTarget(s, h) {
  const m = lowBits(h, s.i);
  return m < s.n ? { m, b: m, flipped: false } : { m, b: m - 2 ** (s.i - 1), flipped: true };
}
function linPlace(s, b, h) {
  const bk = s.buckets[b];
  if (bk.recs.length < s.cap) { bk.recs.push(h); return false; }
  bk.over.push(h); return true;
}
export function linInsert(s0, h) {
  const s = copy(s0), steps = [];
  const snap = (text, hl = {}, kind = 'info') => steps.push({ text, kind, hl, state: copy(s) });
  const r = linCount(s), slots = s.n * s.cap, u = r / slots;
  const pct = x => `${Math.round(x * 1000) / 10}%`;
  if (u >= s.threshold) {
    snap(`Before inserting ${h}: utilization = ${r} records / ${slots} slots in primary buckets = ${pct(u)} ≥ ${pct(s.threshold)}. Add one bucket first.`, {}, 'warn');
    const nb = s.n; s.n++; const oldI = s.i; s.i = linBits(s.n);
    const split = nb - 2 ** (s.i - 1);
    s.buckets.push({ recs: [], over: [] });
    const moving = [...s.buckets[split].recs, ...s.buckets[split].over];
    s.buckets[split] = { recs: [], over: [] };
    moving.forEach(x => linPlace(s, lowBits(x, s.i) === nb ? nb : split, x));
    const lab = v => v.toString(2).padStart(s.i, '0');
    snap(`New bucket ${lab(nb)} (n = ${s.n}${s.i !== oldI ? `, so i grows to ${s.i} bits` : `, i stays ${s.i}`}). It is the "1" twin of bucket ${lab(split)}, so only that bucket's records are re-hashed: those ending in ${lab(nb)} move over, the rest stay.`, { bucket: nb, bucket2: split }, 'info');
  } else {
    snap(`Before inserting ${h}: utilization = ${r} / ${slots} = ${pct(u)} < ${pct(s.threshold)}, no new bucket needed.`, {}, 'info');
  }
  const t = linTarget(s, h), lab = v => v.toString(2).padStart(s.i, '0');
  const over = linPlace(s, t.b, h);
  snap(`Last i = ${s.i} bits of ${h} are ${h.slice(-s.i)} = ${t.m}. ${t.flipped ? `${t.m} ≥ n = ${s.n}, so bucket ${t.m} does not exist yet: use ${t.m} − 2^${s.i - 1} = ${t.b} (bucket ${lab(t.b)}). ` : `${t.m} < n = ${s.n}, so bucket ${lab(t.b)} exists. `}${over ? 'It is full, so the record goes into an overflow block chained to it.' : `${h} goes in.`}`, { bucket: t.b }, over ? 'warn' : 'ok');
  return { state: s, steps };
}
export function linDelete(s0, h) {
  const s = copy(s0);
  for (const bk of s.buckets) {
    const all = [...bk.recs, ...bk.over], k = all.indexOf(h);
    if (k < 0) continue;
    all.splice(k, 1); bk.recs = all.slice(0, s.cap); bk.over = all.slice(s.cap);
    return { state: s, steps: [{ text: `Remove ${h}. Linear hashing does not shrink here; a record from the overflow chain (if any) moves up.`, state: copy(s), kind: 'ok', hl: {} }] };
  }
  return { state: s, steps: [{ text: `${h} is not in the table.`, state: copy(s), kind: 'warn', hl: {} }] };
}

export const runOps = (s, ops, fn) => ops.reduce((acc, h) => { const r = fn(acc.state, h); return { state: r.state, all: [...acc.all, { h, steps: r.steps, state: r.state }] }; }, { state: s, all: [] });
