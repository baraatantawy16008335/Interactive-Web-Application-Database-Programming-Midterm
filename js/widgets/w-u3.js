// Unit 3 simulators: hash index (static, extensible, linear hashing)
import { opsBench, parseBits } from './opsbench.js';
import { sorter } from './sorter.js';
import { bench, $, $$, on, esc } from '../viz.js';
import { recordScore } from '../store.js';
import * as H from '../engine/hash.js';
import * as D from '../engine/draw.js';

const pct = x => `${Math.round(x * 1000) / 10}%`;
const noop = (s, text) => ({ state: s, steps: [{ text, kind: 'warn', state: s, hl: null }] });
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// Apply an insert/delete function to one value or to a list of values, joining the steps.
function fold(fn) {
  return (s, v) => {
    if (v === null || v === undefined || (Array.isArray(v) && !v.length)) return null;
    const list = Array.isArray(v) ? v : [v];
    let cur = s; const all = [];
    list.forEach(h => {
      const r = fn(cur, h);
      r.steps.forEach(x => all.push(list.length > 1 ? { ...x, text: `<strong>${esc(typeof h === 'string' ? h : h.rec)}:</strong> ${x.text}` } : x));
      cur = r.state;
    });
    return { state: cur, steps: all };
  };
}

// ================================================================== static hashing
const allRecs = s => s.buckets.flatMap(b => [...b.recs, ...b.over.flat()]);
const stParse = txt => {
  if (!txt) return null;
  const m = txt.match(/^([A-Za-z0-9]+)(?:@(\d+))?$/);
  if (!m) throw new Error('Type a whole number (bucket = K mod B) or name@bucket, for example 17 or g@0.');
  return { rec: m[1], b: m[2] === undefined ? null : +m[2] };
};
const stIns = fold((s, it) => {
  const b = it.b !== null && it.b !== undefined ? it.b : /^\d+$/.test(it.rec) ? +it.rec % s.B : null;
  if (b === null || b < 0 || b >= s.B) return noop(s, `${esc(it.rec)} needs a bucket number between 0 and ${s.B - 1}: type it as ${esc(it.rec)}@bucket.`);
  const r = H.staticInsert(s, b, it.rec);
  r.steps[0].text = `h(${esc(it.rec)}) = ${it.b !== null && it.b !== undefined ? `bucket ${b} (given)` : `${it.rec} mod ${s.B} = ${b}`}. ${r.steps[0].text}`;
  return r;
});
const stDel = fold((s, it) => H.staticDelete(s, it.rec));
function stPile(s, v) {
  const N = Math.max(1, Math.min(300, v && /^\d+$/.test(v.rec) ? +v.rec : 10));
  const have = new Set(allRecs(s)); let cur = s, k = 1; const steps = [];
  for (let c = 0; c < N; c++) {
    while (have.has(String(k * s.B))) k++;
    const rec = String(k * s.B); have.add(rec);
    const r = H.staticInsert(cur, 0, rec); cur = r.state;
    if (N <= 12) steps.push({ ...r.steps[0], text: `<strong>${rec}</strong> mod ${s.B} = 0. ${r.steps[0].text}` });
  }
  const blocks = 1 + cur.buckets[0].over.length;
  if (N > 12) steps.push({ kind: 'warn', hl: 0, state: cur, text: `${N} more keys all hash to bucket 0 (multiples of ${s.B}). With ${s.cap} records per block, bucket 0 now has ${cur.buckets[0].recs.length + cur.buckets[0].over.flat().length} records: 1 primary block plus ${blocks - 1} overflow blocks = <strong>${blocks} blocks</strong>. Finding the last key reads ${blocks} blocks. The other buckets are untouched and the bucket count is still ${s.B}.` });
  return { state: cur, steps };
}
export function u3Static(el) {
  opsBench(el, {
    id: 'u3-static', icon: 'hash', title: 'Static hashing playground',
    hint: 'Fixed number of buckets, overflow chains, compacting deletes. Type a number (goes to bucket K mod B) or name@bucket (for example g@0), then Insert or Delete. The last button piles keys onto bucket 0 to show the chain problem.',
    presets: [
      { label: 'PA3-1 start (B = 4, 2 per block)', make: () => H.staticNew(4, 2, [['d'], ['e', 'c'], ['b'], ['a', 'f']]), note: 'The PA3-1 table. Use the quick buttons to replay parts a to d.' },
      { label: 'Empty (B = 4, 2 per block)', make: () => H.staticNew(4, 2) },
      { label: 'Lecture problem (B = 4, 5 per block)', make: () => H.staticNew(4, 5), note: 'Slide 6: 100 values hashed to the same bucket, 5 per block.' },
    ],
    ops: [
      { label: 'Insert', icon: 'plus', run: (s, v) => stIns(s, v) || noop(s, 'Type a key first, for example 17 or g@0.') },
      { label: 'Delete', icon: 'minus', run: (s, v) => stDel(s, v) || noop(s, 'Type the key to delete, for example g.') },
      { label: 'Pile N keys on bucket 0', icon: 'stack', run: (s, v) => stPile(s, v) },
    ],
    input: { label: 'Key or N', placeholder: 'e.g. 17 or g@0', parse: stParse },
    quick: [
      { label: 'PA3-1 a: insert g,h,i,j', op: 0, value: [{ rec: 'g', b: 0 }, { rec: 'h', b: 1 }, { rec: 'i', b: 2 }, { rec: 'j', b: 3 }] },
      { label: 'b: delete a,b', op: 1, value: [{ rec: 'a' }, { rec: 'b' }] },
      { label: 'c: insert k,l,m,n', op: 0, value: [{ rec: 'k', b: 0 }, { rec: 'l', b: 1 }, { rec: 'm', b: 2 }, { rec: 'n', b: 3 }] },
      { label: 'd: delete c,d', op: 1, value: [{ rec: 'c' }, { rec: 'd' }] },
      { label: 'Pile 10 keys on bucket 0', op: 2, value: { rec: '10' } },
      { label: 'Pile 100 keys on bucket 0', op: 2, value: { rec: '100' } },
    ],
    draw: (s, hl) => D.staticHashSVG(s, { hl }),
    info: s => {
      const lens = s.buckets.map(b => 1 + b.over.length), worst = Math.max(...lens), n = allRecs(s).length;
      return `B = ${s.B} buckets (never changes) · ${n} records · ${s.cap} per block · longest chain: <strong>${worst} block${worst === 1 ? '' : 's'}</strong> (bucket ${lens.indexOf(worst)}), so a lookup there can read up to ${worst} block${worst === 1 ? '' : 's'}.`;
    },
  });
}

// ================================================================== extensible hashing
const extList = (...b) => b;
const EXTP = {
  lec1: { label: 'Lecture I (cap 3, bucket 0 empty)', make: () => H.extNew({ i: 1, cap: 3, bits: 4, buckets: extList({ prefix: '0', j: 1, recs: [] }, { prefix: '1', j: 1, recs: ['1001', '1110'] }) }), note: 'Slide 12: i = 1, a block holds 3 records. Insert 0000, 0001, 0010, then 0100 (the directory doubles).' },
  lec2: { label: 'Lecture II (bucket 0 full)', make: () => H.extNew({ i: 1, cap: 3, bits: 4, buckets: extList({ prefix: '0', j: 1, recs: ['0000', '0001', '0010'] }, { prefix: '1', j: 1, recs: ['1001', '1110'] }) }), note: 'Slide 17: insert 0011 and watch the cascade to i = 3.' },
  pa2: { label: 'PA3-2 start (cap 2)', make: () => H.extNew({ i: 1, cap: 2, bits: 4, buckets: extList({ prefix: '0', j: 1, recs: ['0001'] }, { prefix: '1', j: 1, recs: ['1001', '1100'] }) }), note: 'Exercise 3-2: insert 1010, then 0000 and 0111, then 1000.' },
  pa3: { label: 'PA3-3 empty (i = 0, cap 2)', make: () => H.extNew({ i: 0, cap: 2, bits: 4, buckets: extList({ prefix: '', j: 0, recs: [] }) }), note: 'Exercise 3-3: insert 0000, 0001, 0010, 0011, 0100, 0110, 1000 from nothing.' },
  mid: { label: 'Midterm 2025 Ex 4.1 (cap 3)', make: () => H.extNew({ i: 1, cap: 3, bits: 4, buckets: extList({ prefix: '0', j: 1, recs: ['0010', '0110', '0111'] }, { prefix: '1', j: 1, recs: ['1000'] }) }), note: 'The operations are independent: insert 0000, then press Reset and try 1111.' },
  free: { label: 'Free play (cap 2, i = 1)', make: () => H.extNew({ i: 1, cap: 2, bits: 4, buckets: extList({ prefix: '0', j: 1, recs: [] }, { prefix: '1', j: 1, recs: [] }) }), note: 'Type any 4-bit hash values and predict i, j and the directory before you press Next.' },
};
const extIns = fold((s, h) => H.extInsert(s, h));
const extDel = fold((s, h) => H.extDelete(s, h));
function extWidget(el, id, order, quick) {
  opsBench(el, {
    id, icon: 'arrows-out-line-horizontal', title: 'Extensible hashing playground',
    hint: 'Type a 4-bit hash value and press Insert. Step through each insertion: the highlighted directory entry and bucket show what the algorithm looks at.',
    presets: order.map(k => EXTP[k]),
    ops: [
      { label: 'Insert', icon: 'plus', run: (s, v) => extIns(s, v) || noop(s, 'Type a 4-bit hash value first, for example 0101.') },
      { label: 'Delete', icon: 'minus', run: (s, v) => extDel(s, v) || noop(s, 'Type the hash value to delete.') },
    ],
    input: { label: 'Hash value', placeholder: 'e.g. 0101', parse: s => s === '' ? null : parseBits(4)(s) },
    quick,
    draw: (s, hl) => D.extHashSVG(s, { hl: hl || {} }),
    info: s => {
      const nb = Object.keys(s.buckets).length, n = Object.values(s.buckets).reduce((a, b) => a + b.recs.length + (b.over || []).length, 0);
      const sum = Object.values(s.buckets).reduce((a, b) => a + 2 ** (s.i - b.j), 0);
      return `<strong>i = ${s.i}</strong> · directory has 2<sup>${s.i}</sup> = ${s.dir.length} entries · ${nb} bucket${nb === 1 ? '' : 's'} · ${n} record${n === 1 ? '' : 's'} · a block holds ${s.cap}<br>Check: the sum of 2<sup>i−j</sup> over the buckets is ${sum}${sum === s.dir.length ? ' = 2<sup>i</sup>, as it must be.' : ' (should equal the directory size).'}`;
    },
  });
}
export function u3Extensible(el) {
  extWidget(el, 'u3-ext', ['lec1', 'lec2', 'mid', 'free'], [
    { label: '0000, 0001, 0010', op: 0, value: ['0000', '0001', '0010'] },
    { label: '0100 (doubles)', op: 0, value: '0100' },
    { label: '0011 (cascade, use Lecture II)', op: 0, value: '0011' },
    { label: '0111', op: 0, value: '0111' },
    { label: '1011', op: 0, value: '1011' },
  ]);
}
export function u3ExtensiblePA(el) {
  extWidget(el, 'u3-extpa', ['pa2', 'pa3', 'mid', 'free'], [
    { label: 'PA3-2 a: 1010', op: 0, value: '1010' },
    { label: 'b: 0000, 0111', op: 0, value: ['0000', '0111'] },
    { label: 'c: 1000', op: 0, value: '1000' },
    { label: 'PA3-3: all 7 keys (PA3-3 preset)', op: 0, value: ['0000', '0001', '0010', '0011', '0100', '0110', '1000'] },
    { label: 'Midterm: 0000 (Midterm preset)', op: 0, value: '0000' },
    { label: 'Midterm: 1111 (Midterm preset)', op: 0, value: '1111' },
  ]);
}

// ================================================================== linear hashing
const LINP = {
  lec: { label: 'Lecture (n = 3, cap 2)', make: () => H.linNew({ n: 3, cap: 2, buckets: [['0000'], ['0001', '1001'], ['0110']] }), note: 'Slides 23-26: insert 1111, then 0010.' },
  pa: { label: 'PA3-4 start (n = 2, cap 2)', make: () => H.linNew({ n: 2, cap: 2 }), note: 'Exercise 3-4: insert 0011, 1100, 0101, 1011, 0010, 1101, 0111, 1001, 0001.' },
  mid: { label: 'Midterm 2025 Ex 4.2', make: () => H.linNew({ n: 3, cap: 2, buckets: [[], { recs: ['1001', '1101'], over: ['0011'] }, []] }), note: 'The operations are independent: try 1111, press Reset, then try 1110.' },
  one: { label: 'Free play (n = 2, cap 3)', make: () => H.linNew({ n: 2, cap: 3 }), note: 'Three records per block: watch how the 80% rule behaves with a bigger block.' },
};
function linIns1(s, h) {
  const r = H.linInsert(s, h), last = r.steps[r.steps.length - 1], st = last.state, t = H.linTarget(st, h);
  last.text += `<br><span class="hl"><strong>Rule:</strong> m = ${t.m}, n = ${st.n}, i = ${st.i}. ${t.flipped ? `m ≥ n, so use m − 2<sup>i−1</sup> = ${t.m} − ${2 ** (st.i - 1)} = ${t.b}` : 'm &lt; n, so bucket m exists and is used'}.</span>`;
  return r;
}
const linIns = fold(linIns1);
const linDel = fold((s, h) => H.linDelete(s, h));
const meter = s => {
  const r = H.linCount(s), slots = s.n * s.cap, u = r / slots, hot = u >= s.threshold;
  return `<div style="color:var(--ink)"><strong class="num">Utilization = records ÷ (n × cap) = ${r} ÷ ${slots} = ${pct(u)}</strong>
  <div style="position:relative;height:12px;border-radius:6px;background:var(--sunken);border:1px solid var(--line);margin:6px 0 4px"><div style="height:100%;width:${Math.min(100, u * 100)}%;border-radius:6px;background:${hot ? 'var(--bad)' : 'var(--accent-viz)'}"></div><div style="position:absolute;left:${s.threshold * 100}%;top:-3px;bottom:-3px;width:2px;background:var(--ink)"></div></div>
  <span class="muted">Marker at ${pct(s.threshold)}. ${hot ? '<strong style="color:var(--bad)">At or above the threshold: the NEXT insert adds a bucket first.</strong>' : 'Below the threshold: the next insert adds no bucket.'} n = ${s.n}, i = ${s.i} bit${s.i === 1 ? '' : 's'} from the right.</span></div>`;
};
function linWidget(el, id, order, quick) {
  opsBench(el, {
    id, icon: 'arrow-line-right', title: 'Linear hashing playground',
    hint: 'Type a 4-bit hash value and press Insert. Each insertion shows the utilization check first, then the bucket choice with the m &lt; n / m ≥ n rule.',
    presets: order.map(k => LINP[k]),
    ops: [
      { label: 'Insert', icon: 'plus', run: (s, v) => linIns(s, v) || noop(s, 'Type a 4-bit hash value first, for example 0101.') },
      { label: 'Delete', icon: 'minus', run: (s, v) => linDel(s, v) || noop(s, 'Type the hash value to delete.') },
    ],
    input: { label: 'Hash value', placeholder: 'e.g. 0101', parse: s => s === '' ? null : parseBits(4)(s) },
    quick,
    draw: (s, hl) => D.linHashSVG(s, { hl: hl || {} }),
    info: meter,
  });
}
export function u3Linear(el) {
  linWidget(el, 'u3-lin', ['lec', 'mid', 'pa', 'one'], [
    { label: 'Insert 1111', op: 0, value: '1111' },
    { label: 'then 0010', op: 0, value: '0010' },
    { label: 'Midterm: 1111 (Midterm preset)', op: 0, value: '1111' },
    { label: 'Midterm: 1110 (Midterm preset)', op: 0, value: '1110' },
  ]);
}
export function u3LinearPA(el) {
  linWidget(el, 'u3-linpa', ['pa', 'mid', 'lec', 'one'], [
    { label: 'All 9 PA3-4 keys', op: 0, value: ['0011', '1100', '0101', '1011', '0010', '1101', '0111', '1001', '0001'] },
    { label: 'First 4 keys', op: 0, value: ['0011', '1100', '0101', '1011'] },
    { label: 'Next: 0010', op: 0, value: '0010' },
  ]);
}

// ================================================================== bit picker
export function u3BitPicker(el) {
  el.innerHTML = `${bench('binary', 'Which bits pick the bucket?', 'extensible vs linear')}
  <div class="bench-body">
    <p class="small muted" style="margin-bottom:10px">Same hash value, two techniques. Extensible hashing reads the <strong>first i bits (left)</strong>. Linear hashing reads the <strong>last i bits (right)</strong>, with i = ⌈log₂ n⌉.</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end">
      <div class="field" style="max-width:170px;margin:0"><label for="u3bp-h">Hash value (1 to 8 bits)</label><input type="text" id="u3bp-h" data-h value="00110101" maxlength="8" autocomplete="off"></div>
      <div class="chips"><button type="button" class="chip" data-set="00110101">00110101 (slide 9)</button><button type="button" class="chip" data-set="0110">0110</button><button type="button" class="chip" data-set="1111">1111</button><button type="button" class="chip" data-set="0010">0010</button></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:12px">
      <div><label class="small" for="u3bp-i">Extensible: i = <strong data-iv>2</strong> bits</label><input type="range" id="u3bp-i" data-i min="0" max="8" value="2" style="width:100%"></div>
      <div><label class="small" for="u3bp-n">Linear: n = <strong data-nv>5</strong> buckets</label><input type="range" id="u3bp-n" data-n min="2" max="16" value="5" style="width:100%"></div>
    </div>
    <div data-err class="small" style="color:var(--bad);margin-top:6px"></div>
    <div data-out style="margin-top:10px"></div>
  </div>`;
  const bit = (c, on, color) => `<span style="display:inline-block;width:28px;height:34px;line-height:34px;text-align:center;font-family:var(--mono);font-size:17px;border:1px solid ${on ? color : 'var(--line)'};border-radius:6px;margin:0 3px 3px 0;${on ? `background:var(--accent-soft);font-weight:700;color:var(--ink)` : 'color:var(--muted)'}">${c}</span>`;
  const update = () => {
    const inp = $(el, '[data-h]'), h = inp.value.trim(), err = $(el, '[data-err]'), out = $(el, '[data-out]');
    if (!/^[01]{1,8}$/.test(h)) { err.textContent = 'Type 1 to 8 bits (only 0 and 1).'; out.innerHTML = ''; return; }
    err.textContent = '';
    const L = h.length, iEl = $(el, '[data-i]'), nEl = $(el, '[data-n]');
    iEl.max = L; if (+iEl.value > L) iEl.value = L;
    nEl.max = Math.min(16, 2 ** L); if (+nEl.value > +nEl.max) nEl.value = nEl.max;
    nEl.min = 2; if (L < 1) nEl.value = 2;
    const i = +iEl.value, n = Math.max(2, +nEl.value), li = Math.ceil(Math.log2(n));
    $(el, '[data-iv]').textContent = i; $(el, '[data-nv]').textContent = n;
    const eBits = i ? h.slice(0, i) : '', eNum = i ? parseInt(eBits, 2) : 0;
    const lBits = h.slice(-li), m = parseInt(lBits, 2), flip = m >= n, b = flip ? m - 2 ** (li - 1) : m;
    const row = (mark) => [...h].map((c, k) => bit(c, mark(k), 'var(--accent)')).join('');
    out.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
        <div class="callout" style="display:block"><strong>Extensible (first i = ${i} from the left)</strong><div style="margin:8px 0">${row(k => k < i)}</div>
          <div class="small">${i ? `Bits <code>${eBits}</code> = ${eNum}. Directory entry <strong>${eBits}</strong>. The directory has 2<sup>${i}</sup> = ${2 ** i} entries.` : 'i = 0: no bits are used. The directory has 1 entry, so every key goes to the same bucket.'}</div></div>
        <div class="callout" style="display:block"><strong>Linear (last i = ⌈log₂ ${n}⌉ = ${li} from the right)</strong><div style="margin:8px 0">${row(k => k >= L - li)}</div>
          <div class="small">Bits <code>${lBits}</code> = m = ${m}. ${flip ? `m ≥ n (${m} ≥ ${n}): bucket ${m} does not exist, so use m − 2<sup>${li - 1}</sup> = ${m} − ${2 ** (li - 1)} = <strong>bucket ${b}</strong> (label ${b.toString(2).padStart(li, '0')}).` : `m &lt; n (${m} &lt; ${n}): bucket m exists. Use <strong>bucket ${b}</strong> (label ${b.toString(2).padStart(li, '0')}).`}</div></div>
      </div>
      <div class="tbl-wrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>Bits i</th><th>Extensible: first i (left)</th><th>Linear: last i (right)</th></tr></thead><tbody>
        ${Array.from({ length: Math.min(L, 4) }, (_, k) => `<tr><td>${k + 1}</td><td><code>${h.slice(0, k + 1)}</code></td><td><code>${h.slice(-(k + 1))}</code></td></tr>`).join('')}
      </tbody></table></div>`;
  };
  on(el, '[data-set]', 'click', (e, b) => { $(el, '[data-h]').value = b.dataset.set; update(); });
  el.addEventListener('input', e => { if (e.target.matches('[data-h],[data-i],[data-n]')) update(); });
  update();
}

// ================================================================== predict then reveal
export function u3Predict(el) {
  const ROUNDS = 5;
  let mode = 'ext', round = 0, score = 0, total = 0, cur = null, picked = {}, checked = false, kinds = [];
  const rnd = n => Math.floor(Math.random() * n);
  const key = () => rnd(16).toString(2).padStart(4, '0');
  const freshKinds = () => shuffle(['room', 'split', 'double', 'split', 'room']);
  const extStart = () => H.extNew({ i: 1, cap: 2, bits: 4, buckets: [{ prefix: '0', j: 1, recs: [] }, { prefix: '1', j: 1, recs: [] }] });
  function makeExt(target) {
    let best = null;
    for (let t = 0; t < 120; t++) {
      let s = extStart(); const used = new Set(), cnt = 2 + rnd(5);
      for (let k = 0; k < cnt; k++) { let h; do { h = key(); } while (used.has(h)); used.add(h); s = H.extInsert(s, h).state; }
      let h, g = 0; do { h = key(); g++; } while (used.has(h) && g < 40);
      if (used.has(h) || s.i > 3) continue;
      const res = H.extInsert(s, h);
      if (res.state.i > 4) continue;
      const nb0 = Object.keys(s.buckets).length, nb1 = Object.keys(res.state.buckets).length;
      const kind = res.state.i > s.i ? 'double' : nb1 > nb0 ? 'split' : 'room';
      best = { s, h, res, nb0, nb1 };
      if (kind === target) break;
    }
    const { s, h, res, nb0, nb1 } = best, entries = Array.from({ length: 2 ** s.i }, (_, e) => e.toString(2).padStart(s.i, '0'));
    return {
      before: s, key: h, res,
      qs: [
        { t: `h(K) = <code>${h}</code> and the directory uses i = ${s.i}. Which directory entry is used?`, opts: entries.map(e => [e, e]), truth: h.slice(0, s.i), why: `The first i = ${s.i} bit${s.i === 1 ? '' : 's'} from the LEFT of ${h}: ${h.slice(0, s.i)}.` },
        { t: 'Does the directory double during this insertion?', opts: [['yes', 'Yes'], ['no', 'No']], truth: res.state.i > s.i ? 'yes' : 'no', why: res.state.i > s.i ? `A full bucket with j = i forced i from ${s.i} to ${res.state.i}.` : 'Either the bucket had room, or it was full with j < i, which only splits the bucket.' },
        { t: 'How many NEW buckets exist after the insertion?', opts: [['0', '0'], ['1', '1'], ['2', '2 or more']], truth: String(Math.min(2, nb1 - nb0)), why: `Before: ${nb0} bucket${nb0 === 1 ? '' : 's'}, after: ${nb1}.` },
      ],
    };
  }
  const linStart = () => H.linNew({ n: 2, cap: 2 });
  function makeLin(target) {
    let best = null;
    for (let t = 0; t < 120; t++) {
      let s = linStart(); const used = new Set(), cnt = 3 + rnd(5);
      for (let k = 0; k < cnt; k++) { let h; do { h = key(); } while (used.has(h)); used.add(h); s = H.linInsert(s, h).state; }
      let h, g = 0; do { h = key(); g++; } while (used.has(h) && g < 40);
      if (used.has(h)) continue;
      const res = H.linInsert(s, h), grew = res.state.n > s.n;
      best = { s, h, res };
      if ((target === 'double') === grew) break;
    }
    const { s, h, res } = best, r = H.linCount(s), slots = s.n * s.cap, u = r / slots, post = res.state, t = H.linTarget(post, h);
    const cand = new Set([`${r} / ${slots} = ${pct(u)}`]);
    [[r + 1, slots], [Math.max(0, r - 1), slots], [r, slots + s.cap], [r + 2, slots]].forEach(([a, b]) => cand.size < 4 && cand.add(`${a} / ${b} = ${pct(a / b)}`));
    return {
      before: s, key: h, res,
      qs: [
        { t: `Bucket size ${s.cap}, n = ${s.n}. What is the utilization rate BEFORE inserting <code>${h}</code>?`, opts: shuffle([...cand]).map(x => [x, x]), truth: `${r} / ${slots} = ${pct(u)}`, why: `Utilization = records ÷ (n × cap) = ${r} ÷ ${slots}. Overflow records count as records, overflow slots are not counted.` },
        { t: 'Is a bucket added before the record is placed?', opts: [['yes', 'Yes'], ['no', 'No']], truth: post.n > s.n ? 'yes' : 'no', why: `${pct(u)} is ${u >= s.threshold ? 'at least' : 'below'} 80%.` },
        { t: `Which bucket number receives <code>${h}</code>? (use the new n if a bucket was added)`, opts: Array.from({ length: s.n + 1 }, (_, b) => [String(b), `bucket ${b}`]), truth: String(t.b), why: `i = ${post.i}, last ${post.i} bits = ${h.slice(-post.i)} = ${t.m}. ${t.flipped ? `m ≥ n = ${post.n}, so ${t.m} − 2^${post.i - 1} = ${t.b}.` : `m < n = ${post.n}, so bucket ${t.m}.`}` },
      ],
    };
  }
  const newRound = () => { if (!kinds.length) kinds = freshKinds(); const target = kinds.pop(); cur = mode === 'ext' ? makeExt(target) : makeLin(target); picked = {}; checked = false; };
  const render = () => {
    if (!cur) newRound();
    const finished = round >= ROUNDS;
    if (finished) {
      el.innerHTML = `${bench('target', 'Predict, then reveal', `${mode === 'ext' ? 'extensible' : 'linear'}`)}<div class="bench-body"><div class="callout key"><i class="ph ph-trophy"></i><div><strong class="num">Game over: ${score} / ${total}.</strong> ${score === total ? 'Perfect. You can run this by hand.' : 'Replay and say the rule out loud for each answer: j against i for extensible, utilization then m against n for linear.'}</div></div><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn primary sm" data-restart>Play again</button><span class="small muted">or switch to</span><div class="seg" role="group"><button type="button" data-mode="ext" aria-pressed="${mode === 'ext'}">Extensible</button><button type="button" data-mode="lin" aria-pressed="${mode === 'lin'}">Linear</button></div></div></div>`;
      return;
    }
    const allPicked = cur.qs.every((q, k) => picked[k] !== undefined), after = cur.res.steps[cur.res.steps.length - 1];
    el.innerHTML = `${bench('target', 'Predict, then reveal', `round ${round + 1} / ${ROUNDS} · score ${score} / ${total}`)}
    <div class="bench-body">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><span class="small muted">Technique</span><div class="seg" role="group"><button type="button" data-mode="ext" aria-pressed="${mode === 'ext'}">Extensible</button><button type="button" data-mode="lin" aria-pressed="${mode === 'lin'}">Linear</button></div><span class="small muted">${mode === 'ext' ? 'A block holds 2 records.' : 'A block holds 2 records, 80% threshold.'} New key: <code>${cur.key}</code></span></div>
      <div style="overflow-x:auto">${mode === 'ext' ? D.extHashSVG(cur.before) : D.linHashSVG(cur.before)}</div>
      ${cur.qs.map((q, k) => `<div style="margin-top:12px"><div style="margin-bottom:6px">${k + 1}. ${q.t}</div><div class="chips">${q.opts.map(([v, l]) => {
        const sel = picked[k] === v, mark = checked ? (v === q.truth ? ' style="outline:2px solid var(--good)"' : sel ? ' style="outline:2px solid var(--bad)"' : '') : '';
        return `<button type="button" class="chip" data-q="${k}" data-v="${esc(v)}" aria-pressed="${sel}" ${checked ? 'disabled' : ''}${mark}>${esc(l)}</button>`;
      }).join('')}</div>${checked ? `<div class="small" style="margin-top:4px;color:${picked[k] === q.truth ? 'var(--good)' : 'var(--bad)'}"><strong>${picked[k] === q.truth ? 'Correct.' : 'Not quite.'}</strong> ${q.why}</div>` : ''}</div>`).join('')}
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">${checked ? `<button class="btn primary sm" data-next>${round + 1 >= ROUNDS ? 'Finish' : 'Next round'}</button>` : `<button class="btn primary sm" data-check ${allPicked ? '' : 'disabled'}>Check my answers</button>`}</div>
      ${checked ? `<div class="callout" style="margin-top:12px"><i class="ph ph-info"></i><div><strong>Engine steps:</strong> ${cur.res.steps.map(x => x.text).join('<br>')}</div></div><div style="overflow-x:auto;margin-top:8px">${mode === 'ext' ? D.extHashSVG(after.state, { hl: after.hl }) : D.linHashSVG(after.state, { hl: after.hl })}</div>` : ''}
    </div>`;
  };
  on(el, '[data-q]', 'click', (e, b) => { picked[+b.dataset.q] = b.dataset.v; render(); });
  on(el, '[data-check]', 'click', () => { checked = true; cur.qs.forEach((q, k) => { total++; if (picked[k] === q.truth) score++; }); render(); });
  on(el, '[data-next]', 'click', () => { round++; if (round >= ROUNDS) recordScore('u3-predict', score, total); else newRound(); render(); });
  on(el, '[data-restart]', 'click', () => { round = 0; score = 0; total = 0; kinds = []; newRound(); render(); });
  on(el, '[data-mode]', 'click', (e, b) => { if (mode === b.dataset.mode && round < ROUNDS) return; mode = b.dataset.mode; round = 0; score = 0; total = 0; kinds = []; newRound(); render(); });
  render();
}

// ================================================================== compare extensible and linear
export function u3Compare(el) {
  const PRE = [
    { l: 'PA3-3 keys', s: '0000 0001 0010 0011 0100 0110 1000' },
    { l: 'Spread out', s: '0001 1010 0110 1101 0011 1000 0101 1110' },
    { l: 'Same high bits (00xx)', s: '0000 0001 0010 0011' },
    { l: 'Same low bits (xx01)', s: '0001 0101 1001 1101' },
    { l: 'Duplicates', s: '0101 0101 0101 0101 0101' },
  ];
  let cap = 2, snaps = [], k = 0;
  el.innerHTML = `${bench('git-diff', 'Extensible vs linear on the same keys', 'directory, buckets, overflow')}
  <div class="bench-body">
    <p class="small muted" style="margin-bottom:10px">Both tables start empty (extensible: i = 0, one bucket; linear: n = 2). Feed the same 4-bit keys to both and compare how they grow.</p>
    <div class="chips" style="margin-bottom:10px">${PRE.map((p, i) => `<button type="button" class="chip" data-pre="${i}">${p.l}</button>`).join('')}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
      <div class="field" style="flex:1;min-width:220px;margin:0"><label for="u3cmp-seq">Keys (4-bit values, separated by spaces)</label><input type="text" id="u3cmp-seq" data-seq value="${PRE[0].s}" autocomplete="off"></div>
      <div><div class="small muted">Block holds</div><div class="seg" role="group" data-capseg>${[2, 3, 4].map(c => `<button type="button" data-cap="${c}" aria-pressed="${c === cap}">${c}</button>`).join('')}</div></div>
    </div>
    <div data-err class="small" style="color:var(--bad);margin-top:6px"></div>
    <div style="margin-top:10px"><label class="small" for="u3cmp-k">After <strong data-kv>0</strong> insertions</label><input type="range" id="u3cmp-k" data-k min="0" max="0" value="0" style="width:100%"></div>
    <div data-out></div>
  </div>`;
  const ovE = s => Object.values(s.buckets).reduce((a, b) => a + Math.ceil((b.over || []).length / s.cap), 0);
  const ovL = s => s.buckets.reduce((a, b) => a + Math.ceil(b.over.length / s.cap), 0);
  const build = () => {
    const err = $(el, '[data-err]'), toks = $(el, '[data-seq]').value.trim().split(/[\s,]+/).filter(Boolean);
    if (!toks.length || toks.some(t => !/^[01]{4}$/.test(t))) { err.textContent = 'Type 4-bit values like 0101, separated by spaces.'; return false; }
    if (toks.length > 16) { err.textContent = 'Use at most 16 keys.'; return false; }
    err.textContent = '';
    let e = H.extNew({ i: 0, cap, bits: 4, buckets: [{ prefix: '', j: 0, recs: [] }] }), l = H.linNew({ n: 2, cap });
    snaps = [{ key: null, e, l }];
    toks.forEach(t => { e = H.extInsert(e, t).state; l = H.linInsert(l, t).state; snaps.push({ key: t, e, l }); });
    const kEl = $(el, '[data-k]'); kEl.max = toks.length; k = toks.length; kEl.value = k;
    return true;
  };
  const show = () => {
    const sn = snaps[k], { e, l } = sn; $(el, '[data-kv]').textContent = k;
    const rows = snaps.map((x, idx) => `<tr style="${idx === k ? 'background:var(--accent-soft)' : ''}"><td>${idx}</td><td>${x.key ? `<code>${x.key}</code>` : '(empty)'}</td><td>${x.e.dir.length}</td><td>${Object.keys(x.e.buckets).length}</td><td>${ovE(x.e)}</td><td>${x.l.n}</td><td>${ovL(x.l)}</td><td>${pct(H.linUtil(x.l))}</td></tr>`).join('');
    const last = snaps[snaps.length - 1];
    $(el, '[data-out]').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-top:10px">
        <div><strong>Extensible</strong> <span class="small muted">(i = ${e.i}, directory ${e.dir.length} entries)</span><div style="overflow-x:auto">${D.extHashSVG(e)}</div></div>
        <div><strong>Linear</strong> <span class="small muted">(n = ${l.n}, i = ${l.i})</span><div style="overflow-x:auto">${D.linHashSVG(l)}</div></div>
      </div>
      <div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>#</th><th>Key</th><th>Ext: dir entries</th><th>Ext: buckets</th><th>Ext: overflow blocks</th><th>Lin: buckets</th><th>Lin: overflow blocks</th><th>Lin: utilization</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="callout" style="margin-top:10px"><i class="ph ph-lightbulb"></i><div>After all ${snaps.length - 1} keys: extensible has <strong>${last.e.dir.length}</strong> directory entries pointing to <strong>${Object.keys(last.e.buckets).length}</strong> buckets with <strong>${ovE(last.e)}</strong> overflow blocks. Linear has <strong>${last.l.n}</strong> buckets and <strong>${ovL(last.l)}</strong> overflow blocks, and no directory. ${ovE(last.e) ? 'Identical keys cannot be split apart, so extensible hashing finally chains an overflow block too.' : ovL(last.l) > ovE(last.e) ? 'Linear hashing tolerates overflow blocks; extensible hashing paid for avoiding them with a larger directory.' : last.e.dir.length > 2 * last.l.n ? 'The directory grew much faster than the number of buckets: that is the cost of the indirection.' : ''}</div></div>`;
  };
  const go = () => { if (build()) show(); };
  on(el, '[data-pre]', 'click', (e, b) => { $(el, '[data-seq]').value = PRE[+b.dataset.pre].s; go(); });
  on(el, '[data-cap]', 'click', (e, b) => { cap = +b.dataset.cap; $$(el, '[data-cap]').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.cap === cap))); go(); });
  el.addEventListener('input', e => {
    if (e.target.matches('[data-seq]')) go();
    else if (e.target.matches('[data-k]')) { k = +e.target.value; show(); }
  });
  go();
}

// ================================================================== sorters
export function u3Technique(el) {
  sorter(el, {
    id: 'u3-technique', icon: 'list-checks', title: 'Which hashing technique is it?', hint: 'Pick Static, Extensible or Linear for each statement.',
    options: ['Static', 'Extensible', 'Linear'], cols: 260,
    items: [
      { t: 'The number of buckets never changes after the table is created.', a: 'Static', why: 'Fixed B: growth is absorbed by overflow chains.' },
      { t: 'A directory of 2<sup>i</sup> pointers sits between the hash bits and the blocks.', a: 'Extensible', why: 'The directory is the indirection of extensible hashing.' },
      { t: 'When utilization reaches 80%, exactly one bucket is added.', a: 'Linear', why: 'Linear hashing grows by 1, driven by the utilization rate.' },
      { t: 'The bucket is chosen by the first i bits of h(K), read from the left.', a: 'Extensible', why: 'Linear hashing uses the right-hand bits.' },
      { t: 'The bucket is chosen by the last ⌈log₂ n⌉ bits of h(K).', a: 'Linear', why: 'Low-order bits from the right, with i = ⌈log₂ n⌉.' },
      { t: 'Each bucket header stores a nub j.', a: 'Extensible', why: 'j is the number of leading bits the bucket members share.' },
      { t: 'No indirection: the bucket array is the table, but overflow blocks can occur.', a: 'Linear', why: 'Takeaways II: no indirection, can still have overflow buckets.' },
      { t: 'With 100 keys in one bucket of 5 the chain grows to 20 blocks and nothing is done about it.', a: 'Static', why: 'Static hashing never rebalances.' },
      { t: 'An insertion can double the size of the structure (and again, in a cascading split).', a: 'Extensible', why: 'j = i doubles the directory; skewed bits can repeat it.' },
      { t: 'Adding a bucket re-hashes only one existing bucket, its twin n − 2<sup>i−1</sup>.', a: 'Linear', why: 'Only the twin\'s records can carry the new bucket\'s bit pattern.' },
      { t: 'Overflow blocks are normally avoided by splitting; only duplicates force them.', a: 'Extensible', why: 'Lecture, slide 19: extensible tables prohibit overflow by splitting.' },
    ],
  });
}
export function u3Fit(el) {
  sorter(el, {
    id: 'u3-fit', icon: 'scales', title: 'Which index fits the workload?', hint: 'Hash index, B+ tree, or neither one helps?',
    options: ['Hash index', 'B+ tree', 'Neither helps'], cols: 270,
    items: [
      { t: 'Login: <code>WHERE username = ?</code>, millions of lookups per second, no other query on username.', a: 'Hash index', why: 'Pure exact match: O(1) beats O(log n).' },
      { t: '<code>WHERE price BETWEEN 100 AND 200</code>', a: 'B+ tree', why: 'A range needs ordered keys. Hash scatters neighbours.' },
      { t: '<code>ORDER BY registration_date</code> on a big table.', a: 'B+ tree', why: 'Leaves are chained in key order.' },
      { t: 'Session table: <code>WHERE session_id = ?</code> only.', a: 'Hash index', why: 'Exact match only.' },
      { t: '<code>WHERE name LIKE \'Ah%\'</code> (prefix search).', a: 'B+ tree', why: 'A prefix is a range on sorted keys. A hash value of the prefix is unrelated to the hash of the full name.' },
      { t: '<code>WHERE name LIKE \'%med\'</code> (leading wildcard).', a: 'Neither helps', why: 'Neither structure can seek on a suffix; a scan is needed.' },
      { t: 'The only index is a hash index on (a, b). Query: <code>WHERE a = 5</code>.', a: 'Neither helps', why: 'The bucket number comes from the hash of the whole pair (a, b). With only a known, the index cannot be used.' },
      { t: 'Top 10 largest orders: <code>ORDER BY amount DESC LIMIT 10</code>.', a: 'B+ tree', why: 'Walk the leaves from the right end.' },
      { t: 'Equality join where one side probes an index with one key at a time.', a: 'Hash index', why: 'Each probe is an exact match.' },
      { t: '<code>SELECT MAX(salary) FROM Emp</code>', a: 'B+ tree', why: 'The largest key is at the right end of the leaf level. A hash has no order.' },
      { t: '<code>WHERE salary * 12 &gt; 100000</code> with an index on salary.', a: 'Neither helps', why: 'The index is on salary, not on the expression, and the predicate is a range anyway.' },
    ],
  });
}
