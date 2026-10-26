import { K, T, W, terms, compare, steps, code, table } from './helpers.js';
import * as H from '../engine/hash.js';
import * as D from '../engine/draw.js';

// ------------------------------------------------------------------ small builders (all structures come from the engine)
const fig = (svg, cap) => `<figure style="margin:10px 0;overflow-x:auto"><div>${svg}</div>${cap ? `<figcaption class="small muted" style="margin-top:4px">${cap}</figcaption>` : ''}</figure>`;
const E = (i, cap, buckets) => H.extNew({ i, cap, bits: 4, buckets });
const blab = (v, i) => v.toString(2).padStart(i, '0');
const pct = x => `${Math.round(x * 1000) / 10}%`;
const ol = items => `<ol class="small" style="margin:6px 0 8px 20px">${items.map(t => `<li>${t}</li>`).join('')}</ol>`;
const extFig = (s, hl, cap) => fig(D.extHashSVG(s, { hl: hl || {} }), cap);
const linFig = (s, hl, cap) => fig(D.linHashSVG(s, { hl: hl || {} }), cap);

// Insert keys one by one into an extensible table; list the engine's steps and draw the result.
function extTrace(s0, keys, { every = false, verb = 'Insert' } = {}) {
  let s = s0, html = '';
  keys.forEach(h => {
    const r = H.extInsert(s, h);
    let figs = '';
    r.steps.forEach((x, k) => {
      const last = k === r.steps.length - 1;
      if (last || (every && x.kind === 'info')) figs += extFig(x.state, x.hl, last ? `After inserting ${h}.` : 'Midway: the full bucket has been split, but the new key is not in yet.');
    });
    html += `<h4 style="margin-top:14px">${verb} ${h}</h4>${ol(r.steps.map(x => x.text))}${figs}`;
    s = r.state;
  });
  return { html, state: s };
}
// Same for linear hashing, with a summary table of utilization numbers.
function linTrace(s0, keys, { figs = true } = {}) {
  let s = s0, rows = [], out = '';
  keys.forEach((h, k) => {
    const r = H.linInsert(s, h), s2 = r.state, cnt = H.linCount(s), slots = s.n * s.cap, u = cnt / slots;
    const grew = s2.n > s.n, t = H.linTarget(s2, h), last = r.steps[r.steps.length - 1];
    const over = s2.buckets[t.b].over.includes(h);
    rows.push([k + 1, `<code>${h}</code>`, `${cnt} / ${slots} = ${pct(u)}`, grew ? `<strong>Yes</strong>: bucket ${blab(s.n, s2.i)} (n = ${s2.n}${s2.i !== s.i ? `, i = ${s2.i}` : ''})` : 'No', `${h.slice(-s2.i)} = ${t.m}`, t.flipped ? `${t.m} ≥ ${s2.n}: ${t.m} − ${2 ** (s2.i - 1)} = ${t.b}` : `${t.m} &lt; ${s2.n}: bucket ${t.m}`, `${blab(t.b, s2.i)}${over ? ' (overflow)' : ''}`]);
    if (figs) out += linFig(s2, last.hl, `<strong>After inserting ${h}.</strong> ${r.steps.map(x => x.text).join(' ')}`);
    s = s2;
  });
  return { table: table(['#', 'Insert', 'Utilization before', 'Add a bucket?', 'Last i bits = m', 'Rule', 'Bucket'], rows), figs: out, state: s };
}

// ------------------------------------------------------------------ lecture examples
const LEC1 = E(1, 3, [{ prefix: '0', j: 1, recs: [] }, { prefix: '1', j: 1, recs: ['1001', '1110'] }]);
const lecA = extTrace(LEC1, ['0000', '0001', '0010']);
const lecB = extTrace(lecA.state, ['0100'], { every: true });
const lecC = extTrace(lecA.state, ['0011'], { every: true });
const finalII = lecC.state;
const LL = H.linNew({ n: 3, cap: 2, buckets: [['0000'], ['0001', '1001'], ['0110']] });
const linI = H.linInsert(LL, '1111');
const linII = H.linInsert(linI.state, '0010');
const linIIsteps = linII.steps;
const stBase = H.staticNew(4, 2, [['d'], ['e', 'c'], ['b'], ['a', 'f']]);

// ------------------------------------------------------------------ PA3 pieces
let st = stBase; const stFigs = {};
const stStep = (k, ops, fn) => { ops.forEach(o => { st = fn(st, o).state; }); stFigs[k] = fig(D.staticHashSVG(st), ''); };
stStep('a', [['g', 0], ['h', 1], ['i', 2], ['j', 3]], (s, [r, b]) => H.staticInsert(s, b, r));
stStep('b', ['a', 'b'], (s, r) => H.staticDelete(s, r));
stStep('c', [['k', 0], ['l', 1], ['m', 2], ['n', 3]], (s, [r, b]) => H.staticInsert(s, b, r));
stStep('d', ['c', 'd'], (s, r) => H.staticDelete(s, r));

const P2 = E(1, 2, [{ prefix: '0', j: 1, recs: ['0001'] }, { prefix: '1', j: 1, recs: ['1001', '1100'] }]);
const p2a = extTrace(P2, ['1010']);
const p2b = extTrace(p2a.state, ['0000', '0111']);
const p2c = extTrace(p2b.state, ['1000']);
const P3 = E(0, 2, [{ prefix: '', j: 0, recs: [] }]);
const p3 = extTrace(P3, ['0000', '0001', '0010', '0011', '0100', '0110', '1000'], { every: false });
const P4keys = ['0011', '1100', '0101', '1011', '0010', '1101', '0111', '1001', '0001'];
const p4 = linTrace(H.linNew({ n: 2, cap: 2 }), P4keys);
const MX = E(1, 3, [{ prefix: '0', j: 1, recs: ['0010', '0110', '0111'] }, { prefix: '1', j: 1, recs: ['1000'] }]);
const mxA = extTrace(MX, ['0000']);
const mxB = extTrace(MX, ['1111']);
const ML = H.linNew({ n: 3, cap: 2, buckets: [[], { recs: ['1001', '1101'], over: ['0011'] }, []] });
const mlA = linTrace(ML, ['1111']);
const mlB = linTrace(ML, ['1110']);

// ================================================================== LECTURE 3
export const lecture = {
  id: 'l3', kind: 'lecture', num: 'L3', icon: 'hash',
  title: 'Lecture 3: Hash Index', navTitle: 'Hash Index', mapLabel: 'Hash Index',
  short: 'How a hash function sends a key straight to its bucket: static hashing, extensible hashing (directory, i and j) and linear hashing (80% rule, bits from the right).',
  goals: [
    'Explain how a hash table works in memory and what changes when the buckets are disk blocks with overflow chains.',
    'Say why static hashing degrades (the 100 values in one bucket of 5 problem) and why dynamic hashing fixes it.',
    'Run extensible hashing by hand: first i bits from the left, directory entries, j, splits, directory doubling and cascading splits.',
    'Run linear hashing by hand: utilization before the insert, add ONE bucket, last i bits from the right, the m ≥ n rule.',
    'Compare extensible and linear hashing (indirection, overflow, growth) and decide when a hash index is the right tool.',
  ],
  sections: [
    {
      id: 'hash-table', title: 'The hash table idea and why databases use it',
      body: `<div class="prose">
<p>A <strong>hash function</strong> <em>h</em> takes a search key <em>K</em> (the hash key) and computes an integer in the range <strong>0 to B − 1</strong>, where <strong>B</strong> is the number of <strong>buckets</strong>. A record with search key <em>K</em> is stored by linking it to the bucket list of bucket number <em>h(K)</em>. To find it again you compute <em>h(K)</em> and look only in that one bucket. You never scan the other B − 1 buckets.</p>
<p>In this course the hash value is usually shown directly as a short bit string such as <code>0110</code> or <code>1001</code>. You are <em>given</em> h(K). You never compute the hash function yourself, you only use its bits.</p>
</div>
${K('Hashing trades order for speed. Neighbouring keys land in unrelated buckets, so one exact key is found in about one step, but nothing about the order of keys survives.')}
${compare(['memory', 'Main-memory hash table', ['The bucket array holds <strong>pointers to the headers of linked lists</strong>.', 'Records with the same h(K) are chained in a list.', 'Cost is measured in pointer hops.']], ['hard-drives', 'Hash table in secondary storage', ['The bucket array holds <strong>blocks</strong>, not pointers.', 'Records hashed to bucket b are put in the block for b.', 'If a bucket has too many records, a <strong>chain of overflow blocks</strong> is added to it.', 'Cost is measured in block reads (I/O).']])}
<div class="prose"><h4>CRUD cost compared (slide 4)</h4></div>
${table(['Operation', 'Conventional index', 'B+ tree', 'Hash index'], [['Read', 'O(log n)', 'O(log n)', '<strong>O(1)</strong>'], ['Insert', 'O(n)', 'O(log n)', '<strong>O(1)</strong>'], ['Update', 'O(n)', 'O(log n)', '<strong>O(1)</strong>'], ['Delete', 'O(n)', 'O(log n)', '<strong>O(1)</strong>']])}
<div class="prose">
<p>Why O(n) for the conventional index on insert, update and delete? The index file is kept sorted, so making room for one new entry shifts on average half of it. A B+ tree only touches one root-to-leaf path (log n). A hash index jumps straight to one bucket, so the cost does not grow with n at all.</p>
</div>
${T('The O(1) in the table assumes the bucket is about one block long. Static hashing with a long overflow chain loses it (next section). Also, O(1) is only for <strong>exact match</strong>: hashing cannot answer a range query at all, while a B+ tree can.')}`
    },
    {
      id: 'static', title: 'Static hashing and its problem',
      body: `<div class="prose">
<p>A <strong>static hash table</strong> has a <strong>fixed number of buckets</strong>, chosen when the table is created. When a bucket fills up, an <strong>overflow block</strong> is chained to it. The number of buckets never changes, only the chains grow.</p>
<p><strong>Insertion.</strong> To insert a record with search key <em>K</em>, compute <em>h(K)</em>. If bucket h(K) has space, put the record into its block. If not, put it into one of the overflow blocks on its chain (add a new overflow block if all of them are full).</p>
<p><strong>Deletion</strong> works in the same bucket: remove the record, and records further down the chain move up so that no hole is left (PA3-1 b and d do exactly this).</p>
</div>
${fig(D.staticHashSVG(stBase), 'The PA3-1 table: B = 4 buckets, 2 records per block.')}
<div class="prose">
<h4>The problem (slide 6)</h4>
<p>Suppose 100 values hash to the <em>same</em> bucket and a block holds 5 entries. The bucket needs ⌈100 ÷ 5⌉ = <strong>20 blocks</strong>: the primary block plus <strong>19 chained overflow blocks</strong>. Finding a key at the end of that chain reads up to 20 blocks, which is no longer O(1). It is as bad as a linear scan of the bucket.</p>
<p>The same fixed B hurts in the other direction too: if you picked B too large for a small table, most buckets are nearly empty blocks and you waste space.</p>
</div>
${K('Static hashing cannot adapt: B is frozen, so the data size has to be guessed in advance. Too few buckets gives long chains, too many wastes blocks. Dynamic hashing exists to remove this guess.')}
${W('u3Static')}
${T('A bad hash function (or skewed keys) is enough to ruin static hashing even when the table is not full overall. The question "how many chained overflow buckets for 100 values, 5 per block" has the answer <strong>19 overflow blocks</strong> (20 blocks in total). Say which one you are counting.')}`
    },
    {
      id: 'dynamic', title: 'Dynamic hashing: the idea and the two techniques',
      body: `<div class="prose">
<p>In a <strong>dynamic hash table</strong> the number of buckets is allowed to <strong>vary</strong>, so that it approximates <strong>the number of records divided by the number of records that fit in a block</strong>. That gives about <strong>one block per bucket</strong>, and a lookup reads about one block.</p>
<p>Example: 100 records and 5 records per block need about 100 ÷ 5 = 20 buckets. The same data under static hashing with 4 buckets would have chains of about 5 blocks.</p>
</div>
${compare(['arrows-out-line-horizontal', '1. Extensible hashing', ['<strong>Doubles</strong> the number of directory entries when it must grow.', 'Buckets split <em>one at a time</em>, but the directory doubles.', 'Uses the <strong>first i bits</strong> of h(K), from the <strong>left</strong>.', 'Uses a directory (indirection).']], ['arrow-line-right', '2. Linear hashing', ['Adds <strong>one</strong> bucket at a time when utilization reaches 80%.', 'No directory: the bucket array is the table.', 'Uses the <strong>last i bits</strong> of h(K), from the <strong>right</strong>.', 'Overflow blocks are allowed.']])}
<div class="prose"><p>Both techniques read the hash value as a bit string, but they read opposite ends of it. Try the picker below: change the hash value, the number of bits and see which bucket each technique chooses.</p></div>
${W('u3BitPicker')}
${T('Mixing up the ends is the most common slip: <strong>extensible takes the first i bits (leftmost)</strong>, <strong>linear takes the last i bits (rightmost, low-order)</strong>. With h(K) = 0110 and i = 2 they give 01 and 10.')}`
    },
    {
      id: 'ext-mechanism', title: 'Extensible hashing: directory, i and j, and the insertion steps',
      body: `<div class="prose">
<h4>Key players (slide 9)</h4>
</div>
${terms([['list-numbers', 'Directory', 'An array of pointers to blocks; it represents the buckets. It has <strong>2<sup>i</sup> entries</strong>, indexed by i-bit strings.'], ['text-aa', 'i', 'How many leading bits of the hash value the <em>directory</em> uses to pick an entry. It grows over time.'], ['tag', 'j (the "nub")', 'Stored in each bucket header: how many leading bits <em>all records in that bucket share</em>. It is the inclusion criterion of the bucket.'], ['link', 'Many entries, one bucket', 'A bucket with j &lt; i is pointed to by <strong>2<sup>i−j</sup></strong> directory entries.']])}
<div class="prose">
<p>The slide's example hash value is <code>00110101</code>. The directory looks at a longer prefix as i grows:</p>
</div>
${table(['i', 'Bits used (from the left)', 'Directory entries'], [['1', '<code>0</code>', '2'], ['2', '<code>00</code>', '4'], ['3', '<code>001</code>', '8'], ['4', '<code>0011</code>', '16']])}
<div class="prose">
<h4>Insertion steps (slides 10-11)</h4>
</div>
${table(['Step', 'What to do'], [
        ['1', 'Compute h(K) and take the first i bits of this bit sequence <strong>from the left</strong>. Go to the entry of the bucket array (directory) indexed by these i bits.'],
        ['2', 'Follow the pointer in the directory to arrive at the designated bucket.'],
        ['3', 'If there is <strong>room</strong> to put the new record in the designated bucket, insert it. Done.'],
        ['4', 'If there is <strong>no room</strong>, inspect the j value of the designated bucket. Two cases follow.'],
        ['4.1', '<strong>If j &lt; i</strong>, nothing needs to be done to the directory size. Work on the buckets: <br><strong>4.1.1</strong> split the designated bucket into two. <br><strong>4.1.2</strong> distribute its records on their <strong>(j + 1)st bit</strong>: records with 0 in that bit stay, records with 1 go to the new block. <br><strong>4.1.3</strong> put j + 1 in each block\'s nub (header). <br><strong>4.1.4</strong> adjust the directory: entries that pointed to the designated bucket now point to it or to the new block, depending on their (j + 1)st bit.'],
        ['4.2', '<strong>If j = i</strong>, first increment i by 1. This makes the directory double to 2<sup>i+1</sup> entries. <br><strong>4.2.1</strong> for the unchanged buckets: if w is an i-bit entry of the old array, the new entries <em>w0</em> and <em>w1</em> both point to the block w pointed to; their j is unchanged. <br><strong>4.2.2</strong> for the affected bucket apply step 4.1.'],
        ['then', 'Try the insertion again. After a split the target bucket may <em>still</em> be full (all records had the same next bit). Repeat from step 4: this is the cascading split of Example II.'],
      ])}
${compare(['arrows-split', 'j &lt; i (4.1)', ['The bucket is shared by several directory entries.', 'Split the bucket, re-point entries.', '<strong>Directory size unchanged.</strong>'], ], ['arrows-out', 'j = i (4.2)', ['The bucket has exactly one directory entry.', 'No spare bit to split on: double the directory first.', '<strong>i grows by 1, then split.</strong>']])}
${K('Quick test for "does the directory double?": compare the full bucket\'s j with the current i. j &lt; i: no. j = i: yes. A full bucket can never have j &gt; i.')}
<div class="prose"><p>This is the picture to keep in mind after two doublings (the final table of Example II below). Count the arrows: j = 3 buckets have 1 entry, the j = 2 bucket has 2 entries, the j = 1 bucket has 4 entries.</p></div>
${extFig(finalII, {}, 'i = 3: entries per bucket = 2<sup>i−j</sup> = 1, 1, 2 and 4.')}
${T('<strong>i belongs to the directory, j belongs to a bucket.</strong> When a bucket splits you update j of the two buckets (j + 1) but i changes only when j = i. Students often raise i after every split. Do not.')}`
    },
    {
      id: 'ext-examples-1', title: 'Extensible hashing, worked example I (slides 12-16)',
      body: `<div class="prose">
<p>Start with i = 1. A bucket holds <strong>3 records</strong>. Bucket 0 is empty, bucket 1 holds 1001 and 1110. Both have j = 1. Insert 0000, then 0001, then 0010, then 0100.</p>
</div>
${extFig(LEC1, {}, 'Original table (slide 12): i = 1, each bucket has j = 1.')}
<div class="prose"><h4>Inserting 0000, 0001 and 0010 (slides 12-15)</h4><p>Each first bit is 0, so each goes to directory entry 0. The bucket has room for the first three, so steps 1-3 are enough: nothing is split.</p></div>
${lecA.html}
<div class="prose"><h4>Inserting 0100 (slide 16)</h4>
<p>0100 also goes to entry 0, but the bucket is now full and has j = 1 = i. Step 4.2 applies: the directory doubles, then the bucket is split on the <strong>2nd bit</strong>. Records 0000, 0001, 0010 have 0 there and stay (the bucket becomes j = 2). 0100 has 1 there, so it goes to a new bucket (j = 2). The old entry 1 turns into entries 10 and 11, both still pointing to the untouched bucket (j = 1).</p>
<p>The slide draws the split before the doubling and then the new directory. The engine, like the algorithm text, doubles first, then splits. The final table is the same.</p></div>
${lecB.html}
${K('Entry 0 became entries 00 and 01 (different buckets now). Entry 1 became entries 10 and 11 (same bucket as before, j still 1). That is "w0 and w1 point where w pointed" in action.')}
${W('u3Extensible')}`
    },
    {
      id: 'ext-examples-2', title: 'Extensible hashing, worked example II: a cascading split (slides 17-18)',
      body: `<div class="prose">
<p>Take the table after 0010 (i = 1, bucket 0 holds 0000, 0001, 0010, bucket 1 holds 1001, 1110). Now insert <strong>0011</strong>.</p>
<p>Entry 0 leads to the full bucket with j = 1 = i. So: double the directory (i = 2) and split on the 2nd bit. But 0000, 0001, 0010 <em>and</em> 0011 all begin with <code>00</code>, so nothing moves to the new bucket (slide 18 (b): "All of them start with 00"). The target bucket is <strong>still full</strong>. Repeat step 4: its j is now 2 = i, so the directory doubles again (i = 3) and the bucket is split on the 3rd bit: 000x stays, 001x moves. Now 0011 fits.</p>
</div>
${lecC.html}
${K('The empty bucket created by the first split stays in the table (j = 2, pointed to by entries 010 and 011). It will take future keys that start with 01.')}
${T('Insert 0011 ends with <strong>i = 3</strong>, not i = 2. Splitting once is not enough when the records are not separated by the next bit, and each extra split can double the directory again. This is why skewed hash values make an extensible directory large.')}
<div class="prose">
<h4>The same procedure from an empty table (PA3-3 preview)</h4>
<p>With i = 0 the directory has one entry. The very first overflow already needs j = i = 0, so the directory doubles from 1 to 2 entries. See Practice Assignment 3, exercise 3-3.</p>
</div>`
    },
    {
      id: 'ext-beyond', title: 'Extensible hashing beyond insertion: deletion, duplicates, lookup',
      body: `<div class="prose">
<h4>Deletion (slide 19)</h4>
<p>Deletion <strong>reverses the insertion procedure</strong>. Find the bucket through the directory and remove the record. If a bucket becomes empty, or two <em>buddy</em> buckets (same j, differing only in their j-th bit) now fit in one block, <strong>merge</strong> them and lower their j by 1. If every bucket then has j &lt; i, the directory can <strong>halve</strong> (i decreases by 1). Many systems skip this because a table that shrank usually grows again.</p>
<h4>Duplicates</h4>
<p>Many records with the <em>same</em> hash value can never be separated, however many bits you use. A bucket full of identical h(K) values would split forever, so the table finally adds an <strong>overflow block</strong>. The slide says this is rare: for a hash value of w bits two different keys collide completely with probability 2<sup>−w</sup>, so b + 1 keys agreeing on all w bits is very unlikely. It is certain only when the same key is stored many times (a non-unique indexed column).</p>
<h4>Lookup</h4>
<p>Compute h(K), take the first i bits, follow the directory entry to the bucket, read the block. If the directory is in memory that is <strong>one block read</strong>; if the directory itself is on disk it is two. Having duplicates makes lookup harder, because the overflow chain must be read as well. Generally an extensible table <strong>prohibits overflow buckets by splitting a bucket upon overflow</strong>, which keeps lookup to one block.</p>
</div>
${K('Extensible hashing normally has <strong>no overflow blocks</strong>. It pays for that with a directory (an extra indirection) that sometimes doubles.')}
${T('Do not say "extensible hashing never has overflow". Say: normally none, but identical hash values (duplicates) can force an overflow block. That is the exact wording of the slide.')}`
    },
    {
      id: 'linear-mechanism', title: 'Linear hashing: the strategy and the insertion steps',
      body: `<div class="prose">
<p>Linear hashing is designed to avoid two weak points of extensible hashing: the directory (indirection) and the sudden doubling. Its strategy (slide 21):</p>
</div>
${terms([['percent', 'Fixed utilization', 'The number of buckets <strong>n</strong> is chosen so that the average bucket is a fixed fraction, say <strong>80%</strong>, full.'], ['plus-circle', 'Add ONE bucket', 'When the table reaches 80% utilization, the number of buckets <strong>increases by 1</strong>, not doubles.'], ['stack', 'Overflow allowed', 'Blocks cannot always be split, so overflow blocks are permitted. The average number of overflow blocks per bucket stays far below 1.'], ['arrow-line-left', 'i = ⌈log<sub>2</sub> n⌉ bits, from the RIGHT', 'The bucket array is numbered with ⌈log<sub>2</sub> n⌉ bits, always taken from the <strong>right (low-order) end</strong> of the hash value.']])}
<div class="prose"><h4>Insertion steps (slide 22)</h4></div>
${steps([
        ['Utilization rate', 'Compute <b>(number of records in the table) ÷ (number of slots in the table − number of slots in overflow buckets)</b>. In other words: records ÷ (n × records-per-block). Overflow records count in the numerator, overflow slots are not in the denominator.'],
        ['80% or more: add a bucket', 'If the utilization rate is <b>≥ 0.8</b>, add another bucket (bucket number n, so n becomes n + 1). Do this <em>before</em> placing the new record.'],
        ['m = last i bits', 'Let m be the last i bits of h(K), read as an i-bit binary number (convert to base 10). Use the i that belongs to the <em>new</em> n if a bucket was just added.'],
        ['m &lt; n: the bucket exists', 'Bucket m exists, so put the record in bucket m (or its overflow chain if full).'],
        ['m ≥ n: it does not exist yet', 'Bucket m does not exist, so put the record in bucket <b>m − 2<sup>i−1</sup></b> (the same bits with the leading 1 turned off).'],
      ])}
${table(['n (buckets)', 'i = ⌈log₂ n⌉', 'Bucket labels'], [['2', '1', '0, 1'], ['3', '2', '00, 01, 10'], ['4', '2', '00, 01, 10, 11'], ['5', '3', '000, ..., 100'], ['6', '3', '000, ..., 101'], ['8', '3', '000, ..., 111'], ['9', '4', '0000, ..., 1000']])}
<div class="prose">
<h4>Which bucket gets re-hashed when a bucket is added?</h4>
<p>The new bucket n is the "1 twin" of bucket n − 2<sup>i−1</sup>. Only that one old bucket is re-hashed: records whose last i bits equal the new bucket's number move there, the others stay. All other buckets are untouched. That is why growth is smooth, one bucket at a time.</p>
</div>
${K('Utilization is computed <strong>before</strong> the new record goes in, and it only counts <em>primary</em> slots in the denominator. Overflow records raise the utilization (they are records) but add no slots, so heavy overflow pushes you towards adding a bucket.')}
${T('The slide says "If m &gt; n ... use m − 2<sup>i−1</sup>". The case <strong>m = n</strong> belongs there too: buckets are numbered 0 to n − 1, so bucket n does not exist. Use <strong>m ≥ n</strong>. In Lecture Example I (n = 3, key 1111, m = 3) a literal "m &gt; n" reading would have no rule for the key.')}`
    },
    {
      id: 'linear-examples', title: 'Linear hashing, worked examples I and II (slides 23-26)',
      body: `<div class="prose">
<h4>Example I: insert 1111 (slides 23-24)</h4>
<p>Start: n = 3, i = 2, a block holds 2 records. Buckets: 00 holds 0000; 01 holds 0001 and 1001; 10 holds 0110. Four records in 3 × 2 = 6 slots.</p>
</div>
${linFig(LL, {}, 'Original linear hash table, n = 3.')}
${ol(linI.steps.map(x => x.text))}
${linFig(linI.state, linI.steps[linI.steps.length - 1].hl, 'After inserting 1111: bucket 01 is full, so 1111 goes to an overflow block.')}
<div class="prose">
<h4>Example II: insert 0010 (slides 25-26)</h4>
<p>Now there are 5 records in 6 slots, so the utilization before the insert is 5 ÷ 6 = 83.3%, which is at least 80%. A bucket must be added <em>first</em>. n becomes 4, i stays 2, the new bucket is <strong>11</strong>. It is the twin of bucket 01, so bucket 01 is re-hashed: 0001 and 1001 end in 01 and stay, <strong>1111 ends in 11</strong> and moves to the new bucket. The overflow block is gone. Then 0010 ends in 10 = 2 &lt; 4, so it goes to bucket 10.</p>
</div>
${ol(linIIsteps.map(x => x.text))}
${linFig(linII.steps[0].state, {}, 'Utilization step shown first (before the new bucket).')}
${linFig(linII.steps[1].state, linII.steps[1].hl, 'After adding bucket 11 (slide 26 b): 1111 moved out of the overflow block.')}
${linFig(linII.state, linII.steps[2].hl, 'After inserting 0010 (slide 26 c).')}
${W('u3Linear')}
${T('Check the utilization <strong>before</strong> each insert and count it properly: Example I has 4 / 6 = 66.7% (no new bucket) but Example II has 5 / 6 = 83.3% (new bucket). One extra record flipped the decision. Also note the table looks different after the growth step even for keys that did not move.')}`
    },
    {
      id: 'takeaways', title: 'Takeaways: extensible vs linear, and when to use a hash index',
      body: `${table(['', 'Static', 'Extensible', 'Linear'], [
        ['Number of buckets', 'Fixed', 'Directory doubles; buckets split one at a time', '+1 bucket at a time'],
        ['Bits used', 'whole hash', 'first i from the <strong>left</strong>', 'last ⌈log₂ n⌉ from the <strong>right</strong>'],
        ['Indirection (directory)', 'No', '<strong>Yes</strong> (not bad if the directory is in memory)', '<strong>No</strong>'],
        ['Overflow blocks', 'Yes, chains grow', 'Normally none (duplicates only)', 'Yes, allowed (few on average)'],
        ['Growth trigger', 'None', 'A bucket overflows', 'Utilization ≥ 80%'],
        ['Weak point', 'Long chains, or wasted blocks', 'Directory doubles (may not fit in memory)', 'Overflow chains, keys may need an extra block read'],
        ['Reorganization', 'Full rebuild needed', 'No full reorganization', 'No full reorganization'],
      ])}
<div class="prose">
<h4>Takeaways I and II (slides 27-28)</h4>
<ul>
<li><strong>Extensible:</strong> handles growing files, with less wasted space, with no full reorganizations. Indirection (not bad if the directory is in memory). The directory doubles in size (sometimes it fits in memory, sometimes it does not).</li>
<li><strong>Linear:</strong> handles growing files, with less wasted space, with no full reorganizations. No indirection (unlike extensible hashing). Can still have overflow buckets.</li>
</ul>
<h4>When to use a hash index (slide 29)</h4>
<p>Use a hash index when you want to speed up SQL queries on an <strong>exact value</strong> and you do <em>not</em> care about (or do not have) any other query type.</p>
<ul>
<li>Good: <code>WHERE id = 16008335</code>, equality joins, lookups by key.</li>
<li>Useless: ranges (<code>BETWEEN</code>, <code>&lt;</code>, <code>&gt;</code>), <code>ORDER BY</code>, prefix searches (<code>LIKE 'Ah%'</code>), min or max. Neighbouring keys are scattered over unrelated buckets.</li>
<li>A hash index on (a, b) needs <em>both</em> a and b in the query. The hash of a pair says nothing about a alone.</li>
</ul>
</div>
${K('Hash for exact match, B+ tree when you also need ranges or order. A B+ tree is O(log n) but supports both; a hash index is O(1) for equality only.')}
<div class="prose"><h4>Compare them on the same data</h4></div>
${W('u3Compare')}
<div class="prose"><h4>Which technique is it?</h4></div>
${W('u3Technique')}
<div class="prose"><h4>Which index fits the workload?</h4></div>
${W('u3Fit')}
${T('"Hash index" is not "faster B+ tree". It is a different tool: every question that mentions a range, an ordering, a prefix or a partial key is a B+ tree question, even if the table is huge and equality lookups are also frequent.')}`
    },
  ],
};

// ================================================================== PRACTICE ASSIGNMENT 3
export const lab = {
  id: 'pa3', kind: 'lab', num: 'PA3', icon: 'clipboard-text',
  title: 'Practice Assignment 3: Hash Index', navTitle: 'PA 3: Hash Index', mapLabel: 'Hash practice',
  short: 'Static hashing with deletes, extensible hashing from a table and from empty, linear hashing with X = 2, plus Midterm 2025 exercise 4.',
  goals: [
    'Apply static hashing insertions and deletions, including how deleting compacts the chain.',
    'Run extensible insertions that split without doubling and that double the directory.',
    'Build an extensible table from empty and read off i, j and entries per bucket.',
    'Trace a linear hash table insertion by insertion with the utilization numbers.',
    'Solve both parts of Midterm 2025 exercise 4 (extensible, bucket holds 3; linear, 80%, bucket holds 2).',
  ],
  sections: [
    {
      id: 'pa3-1', title: 'Exercise 3-1: Static hashing with inserts and deletes',
      body: `<div class="prose">
<p><strong>Task.</strong> Starting from the table below (4 buckets, 2 records per block), (a) insert g to j into buckets 0 to 3 in turn, (b) delete a and b, (c) insert k to n into buckets 0 to 3 in turn, (d) delete c and d.</p>
</div>
${fig(D.staticHashSVG(stBase), 'Start: bucket 0 = d; bucket 1 = e, c; bucket 2 = b; bucket 3 = a, f.')}
<div class="prose"><h4>a) Insert g, h, i, j</h4><p>g goes to bucket 0 (it had one free slot). h goes to bucket 1, which is full, so a new overflow block holds h. i fits in bucket 2. j goes to bucket 3, which is full: overflow block with j.</p></div>
${stFigs.a}
<div class="prose"><h4>b) Delete a and b</h4><p>Deleting a from bucket 3 leaves a hole. The record from the overflow chain moves up (j), and the empty overflow block disappears. Deleting b from bucket 2 leaves just i.</p></div>
${stFigs.b}
<div class="prose"><h4>c) Insert k, l, m, n</h4><p>Bucket 0 (d, g) is full, so k starts a new overflow block. l goes into the existing overflow block of bucket 1, next to h, which fills it. m goes into bucket 2's free slot. Bucket 3 (f, j) is full again, so n starts a new overflow block.</p></div>
${stFigs.c}
<div class="prose"><h4>d) Delete c and d</h4><p>Deleting c from bucket 1 pulls h up into its slot, and l moves up into the overflow block's first slot. Deleting d from bucket 0 pulls k up. Bucket 0 is now g, k with no overflow.</p></div>
${stFigs.d}
${K('The rule to draw: after every delete, re-pack the bucket and its chain so that all blocks except the last are full, and drop any empty overflow block.')}
${W('u3Static')}
${T('The fixed bucket numbers (0 to 3) never change in static hashing, whatever the chain lengths. The exercise tells you which bucket each record goes to, so do not try to compute a hash function.')}`
    },
    {
      id: 'pa3-2', title: 'Exercise 3-2: Extensible insertions into a given table',
      body: `<div class="prose">
<p><strong>Task.</strong> The table has i = 1, a block holds 2 records. Bucket 0 holds 0001, bucket 1 holds 1001 and 1100, both with j = 1. Insert (a) 1010, (b) 0000 and 0111, (c) 1000, in this order (each change builds on the last).</p>
</div>
${extFig(P2, {}, 'Start.')}
<div class="prose"><h4>a) Insert 1010: j = i, so double</h4><p>1010 starts with 1, entry 1, whose bucket (1001, 1100) is full and has j = 1 = i. Double the directory (i = 2), split on the 2nd bit: 1001 (0) stays, 1100 (1) moves. Entries 10 and 11 now point to different buckets (j = 2). 1010 has 0 in the second place, so it joins 1001. Entries 00 and 01 both point to the old bucket 0 (j = 1).</p></div>
${p2a.html}
<div class="prose"><h4>b) Insert 0000 and 0111</h4><p>0000 goes to entry 00, whose bucket (0001) has room. 0111 goes to entry 01, which shares that same bucket, and now it is full with j = 1 &lt; i = 2. <strong>Split without doubling</strong>: 0001 and 0000 have 0 as the 2nd bit and stay; 0111 has 1 and moves to a new bucket. j = 2 for both and entry 01 re-points.</p></div>
${p2b.html}
<div class="prose"><h4>c) Insert 1000: double again</h4><p>1000 goes to entry 10: bucket (1001, 1010) is full with j = 2 = i. Double to i = 3 (8 entries). Split on the 3rd bit: 1000 and 1001 have 0 there, 1010 has 1. The three-bit buckets are 100 (1000, 1001) and 101 (1010) with j = 3. Entries 000 to 011 and 110, 111 point in pairs to the buckets that kept j = 2.</p></div>
${p2c.html}
${K('PA3-2 shows both outcomes: (a) and (c) double the directory because j = i; (b) splits a bucket that several entries share (j &lt; i) and does not double.')}
${W('u3ExtensiblePA')}
${T('Always name j when you justify the decision. "The bucket was full so I doubled" is wrong in part (b): the directory had a spare bit, and doubling there would be a mistake that costs marks.')}`
    },
    {
      id: 'pa3-3', title: 'Exercise 3-3: Extensible hashing from an empty table',
      body: `<div class="prose">
<p><strong>Task.</strong> A bucket holds exactly 2 records. Insert 0000, 0001, 0010, 0011, 0100, 0110, 1000 in this order, starting from an empty index (i = 0, one bucket with j = 0). Show the final table.</p>
<p>The first two keys sit in the single bucket. The third forces the first overflow, and since 0000, 0001, 0010 all start with 00 the split cascades until the third bit separates them: i goes 0 → 1 → 2 → 3 inside one insertion. The remaining keys fit in the new buckets or in the empty buckets created on the way.</p>
</div>
${p3.html}
<div class="prose"><h4>Final table (matches the official solution)</h4>
<p>i = 3, 8 directory entries and 4 buckets: <code>0000, 0001</code> (j = 3), <code>0010, 0011</code> (j = 3), <code>0100, 0110</code> (j = 2, entries 010 and 011), and <code>1000</code> (j = 1, entries 100 to 111).</p></div>
${extFig(p3.state, {}, 'Final extensible table for PA3-3.')}
${K('A quick sanity check for any extensible answer: the sum over buckets of 2<sup>i−j</sup> must equal 2<sup>i</sup>. Here 1 + 1 + 2 + 4 = 8.')}
${T('The third insertion (0010) makes the directory double <em>three</em> times because the first three keys share their first two bits. Students who stop after the first split draw a table that still has a full bucket.')}`
    },
    {
      id: 'pa3-4', title: 'Exercise 3-4: Linear hashing, X = 2, nine insertions',
      body: `<div class="prose">
<p><strong>Task.</strong> Buckets hold up to X = 2 records. The table grows by one bucket whenever the utilization reaches 80%, and the utilization is computed and the table reorganized <em>before every insert</em>. Start with n = 2 buckets (labels 0 and 1) and insert, in order: 0011, 1100, 0101, 1011, 0010, 1101, 0111, 1001, 0001.</p>
<p>For each key: (1) utilization = records ÷ (n × 2). (2) If ≥ 80%, add bucket n (and re-hash its twin). (3) Take the last i bits, convert to m. (4) m &lt; n: bucket m. m ≥ n: bucket m − 2<sup>i−1</sup>.</p>
</div>
${p4.table}
<div class="prose"><h4>Every step with the figure</h4></div>
${p4.figs}
<div class="prose"><h4>Final answer</h4><p>n = 6, i = 3. Bucket 000 is empty, 001 holds 0001 and 1001, 010 holds 0010, 011 holds 0011 and 1011 with an overflow block holding 0111, 100 holds 1100, 101 holds 0101 and 1101.</p></div>
${K('Look at the utilization column: 0, 25, 50, 75, then 100%. The first bucket is added at the fifth insert, not when the table feels full. The last one hits exactly 80% (8 records, 10 slots) and 80% counts as reached (≥).')}
${W('u3LinearPA')}
${T('Three traps in this exercise: (1) the utilization is computed <em>before</em> inserting; (2) overflow records count in the numerator but the overflow slots are not in the denominator (see 0111 and 1001); (3) when n goes from 4 to 5 the label grows to <strong>3 bits</strong> and every bucket is relabelled (01 becomes 001), yet only bucket 000 is re-hashed.')}`
    },
    {
      id: 'pa3-mid', title: 'Midterm 2025, Exercise 4: Hash indices (20 marks)',
      body: `<div class="prose">
<h4>4.1 Extensible hashing (a bucket holds at most 3 records)</h4>
<p>The two operations are <strong>independent</strong>: each starts from the table in the diagram, not from the result of the other.</p>
</div>
${extFig(MX, {}, 'Given: i = 1, bucket 0 = 0010, 0110, 0111 (full), bucket 1 = 1000.')}
<div class="prose"><h4>a) Insert 0000</h4><p>Entry 0, bucket full, j = 1 = i. Double (i = 2), split on the 2nd bit: 0010 has 0, 0110 and 0111 have 1. 0000 has 0 as the 2nd bit and joins 0010. Bucket 1 is untouched (j = 1), entries 10 and 11 both point to it.</p></div>
${mxA.html}
<div class="prose"><h4>b) Insert 1111</h4><p>Entry 1: bucket (1000) has room. 1111 is simply added. <strong>Nothing else changes</strong>: i = 1, no split, no doubling. This is the "do not over-work it" part of the question.</p></div>
${mxB.html}
<div class="prose">
<h4>4.2 Linear hashing (80% threshold, utilization before each insert, a bucket holds 2)</h4>
<p>Given n = 3 (labels 00, 01, 10). Bucket 01 holds 1001, 1101 and an overflow block holds 0011. Buckets 00 and 10 are empty. The utilization before an insert is 3 records ÷ 6 slots = <strong>50%</strong>, so no bucket is added in either part.</p>
</div>
${linFig(ML, {}, 'Given linear hash table.')}
<div class="prose"><h4>a) Insert 1111</h4><p>i = 2, last two bits 11 = 3. 3 ≥ n = 3, so bucket 3 does not exist: use 3 − 2 = 1, bucket 01. It is full (and already has an overflow block with one free slot), so 1111 goes into the existing overflow block next to 0011.</p></div>
${mlA.figs}
<div class="prose"><h4>b) Insert 1110</h4><p>Last two bits 10 = 2 &lt; 3, bucket 10 exists and is empty. 1110 goes there.</p></div>
${mlB.figs}
${T('In 4.2a the table looks overfull but the utilization is only 50% because the denominator counts <em>n × 2 = 6</em> primary slots and the numerator only 3 records. Do not add a bucket "because there is an overflow block". Also: part (b) is independent of part (a), so bucket 01 has no 1111 there.')}`
    },
    {
      id: 'pa3-exam', title: 'What the exam asks about hashing',
      body: `<div class="prose">
<p>Midterm 2025 exercise 4 was 20 marks of hash indices: one extensible and one linear table, two operations each, with the rules written in the question (bucket size, 80%, check before inserting). True/false items 6, 7 and 8 also came from this lecture (static hashing has a <em>fixed</em> number of buckets; an extensible directory can double; linear hashing can use overflow buckets).</p>
</div>
${compare(['checks', 'Extensible procedure', ['Write i and the first i bits of the key.', 'Follow the directory entry. Room? Insert.', 'No room: compare j and i. j &lt; i: split only. j = i: double, then split.', 'Check again: is it STILL full? Repeat.', 'Set j + 1 on both halves and re-point entries.']], ['checks', 'Linear procedure', ['Utilization = records ÷ (n × cap), BEFORE the insert.', '≥ 80%: add bucket n, re-hash only its twin.', 'm = last i bits, i = ⌈log<sub>2</sub> n⌉ for the NEW n.', 'm &lt; n: bucket m. m ≥ n: bucket m − 2<sup>i−1</sup>.', 'Full? Chain an overflow block.']])}
<div class="prose"><h4>Common mistakes</h4>
<ul>
<li>Taking bits from the wrong end (left for extensible, right for linear).</li>
<li>Doubling the extensible directory when j &lt; i, or not doubling when j = i.</li>
<li>Forgetting to repeat the split when all records fall on the same side (PA3-3, Example II).</li>
<li>Using the utilization after the insert, or counting overflow slots in the denominator.</li>
<li>Forgetting to relabel linear buckets with more bits when i grows.</li>
<li>Applying part (b) to the result of part (a) when the question says the operations are independent.</li>
<li>Writing "O(1)" for a range query: hash cannot do ranges.</li>
</ul></div>
<div class="prose"><h4>Practice: predict before you see it</h4><p>Each round gives you a small random table and a new key. Answer three questions, then check against the engine.</p></div>
${W('u3Predict')}
<div class="prose"><p>Related references: the <a href="#/formula">formula sheet</a> has no hashing formulas, so the procedures above must be known by heart.</p></div>`
    },
  ],
};

// ================================================================== QUESTIONS
const Q = (id, m, q, o, why) => ({ id, m, q, o, why });
export const questions = [
  // ---- lecture
  Q('l3-2', 'l3', 'How does a hash table in secondary storage differ from the main-memory version?', ['The bucket array holds blocks, and overflow blocks are chained when a bucket has too many records', 'It stores only pointers to record headers and never needs overflow', 'It sorts the records inside every bucket by key', 'It has a fixed bucket size of exactly one record'], 'In memory, buckets are linked lists reached through pointers. On disk the bucket is a block, and when it is full a chain of overflow blocks is added.'),
  Q('l3-3', 'l3', 'According to the CRUD table in Lecture 3, which statement is correct for INSERT?', ['Conventional index O(n), B+ tree O(log n), hash index O(1)', 'Conventional index O(log n), B+ tree O(log n), hash index O(log n)', 'Conventional index O(1), B+ tree O(log n), hash index O(n)', 'Conventional index O(n), B+ tree O(1), hash index O(1)'], 'The sorted conventional index must shift entries to make room (O(n)); a B+ tree touches one root-to-leaf path (O(log n)); a hash index jumps to one bucket (O(1)).'),
  Q('l3-4', 'l3', 'Which statement about static hashing is true?', ['It has a fixed number of buckets; a full bucket gets a chained overflow block', 'When a bucket is full, the number of buckets doubles', 'When a bucket is full, exactly one new bucket is added', 'It never needs overflow blocks'], 'Static means the bucket count is fixed. Growth is absorbed by overflow chains. Doubling is extensible hashing, adding one bucket is linear hashing.'),
  Q('l3-5', 'l3', 'In a static hash table 100 values hash to the same bucket and a block holds 5 entries. How many blocks does that bucket occupy in total (primary plus overflow)?', ['20', '19', '5', '100'], '100 ÷ 5 = 20 blocks: 1 primary and 19 chained overflow blocks. A lookup may have to read all 20, so the O(1) promise is lost.'),
  Q('l3-7', 'l3', 'Which pair correctly describes how the two dynamic techniques grow?', ['Extensible: the directory doubles. Linear: one bucket is added at a time.', 'Extensible: one bucket is added at a time. Linear: the directory doubles.', 'Both double the number of buckets.', 'Both add exactly one bucket at a time.'], 'Extensible hashing doubles the directory (while buckets split individually). Linear hashing expands the number of buckets by 1 when needed.'),
  Q('l3-8', 'l3', 'The hash value of a key is 0110 and the extensible directory uses i = 2. Which directory entry is used?', ['01', '10', '11', '00'], 'Extensible hashing takes the FIRST i bits from the left: the first two bits of 0110 are 01. (The last two bits, 10, are what linear hashing would use.)'),
  Q('l3-9', 'l3', 'An extensible table has i = 3. A bucket has j = 1. How many directory entries point to this bucket?', ['4', '1', '2', '8'], 'A bucket with nub j is pointed to by 2^(i−j) entries: 2^(3−1) = 4. All entries that start with the bucket\'s single shared bit lead to it.'),
  Q('l3-10', 'l3', 'The designated extensible bucket is full and has j = 2 while i = 3. What happens?', ['Split the bucket on the 3rd bit; the directory is not doubled', 'Double the directory to i = 4, then split', 'Add an overflow block', 'Split the bucket on the 4th bit'], 'j &lt; i: step 4.1. Records are distributed on their (j + 1)st = 3rd bit, both buckets get j = 3, and the entries that pointed to the old bucket are re-pointed. The directory stays at i = 3.'),
  Q('l3-11', 'l3', 'The designated extensible bucket is full and has j = i = 2. What is done first?', ['Increase i to 3 so the directory doubles to 8 entries', 'Split the bucket on the 2nd bit and keep i', 'Chain an overflow block', 'Rehash the whole table'], 'Step 4.2: when j = i there is no spare bit to separate the records, so i is incremented first (directory doubles), then step 4.1 is applied to the affected bucket.'),
  Q('l3-12', 'l3', 'Lecture example I (bucket holds 3): table i = 1 with bucket 0 = 0000, 0001, 0010 and bucket 1 = 1001, 1110. After inserting 0100, what are i and the number of buckets?', ['i = 2, three buckets', 'i = 1, three buckets', 'i = 2, four buckets', 'i = 3, three buckets'], 'The full bucket has j = 1 = i, so the directory doubles (i = 2). Split on the 2nd bit: 0100 has 1 there and goes to a new bucket. Buckets: 0000/0001/0010, 0100 and the untouched 1001/1110.'),
  Q('l3-14', 'l3', 'Lecture example II: the same table (0000, 0001, 0010 | 1001, 1110) and you insert 0011. What is the final i, and why?', ['i = 3: after the first split on the 2nd bit all four keys still start with 00, so the bucket splits again on the 3rd bit', 'i = 2: one split is always enough', 'i = 1: 0011 just fits', 'i = 4: every bit is needed'], 'The first split (i = 2) moves nothing, since all four keys begin with 00. The target bucket is still full with j = 2 = i, so the directory doubles again (i = 3) and the 3rd bit separates 000x from 001x.'),
  Q('l3-16', 'l3', 'Why can an extensible hash table still need an overflow block?', ['Many records with identical hash values cannot be separated by more bits', 'Because the directory is too small', 'Because j can exceed i', 'Because deletions leave holes'], 'Splitting separates records only if their bits differ. Duplicates (same h(K)) always land together, so the table finally chains an overflow block. The slide says it is rare.'),
  Q('l3-17', 'l3', 'How does deletion work in extensible hashing, according to the lecture?', ['Reverse the insertion procedure (merge buddy buckets, possibly halve the directory)', 'Mark the record deleted and never touch the structure', 'Rebuild the table from scratch', 'Delete the directory entry and its bucket'], 'The lecture says: reverse the insertion procedure. A full implementation may merge two buddy buckets and lower their j, and halve the directory when no bucket needs all i bits.'),
  Q('l3-18', 'l3', 'In linear hashing, a table has n = 3 buckets, 2 records per block, and 5 records (one is in an overflow block). What is the utilization rate before the next insert?', ['5 / 6 = 83.3%', '5 / 8 = 62.5%', '5 / 3 = 166%', '3 / 6 = 50%'], 'Utilization = records ÷ (slots in table − slots in overflow buckets) = 5 ÷ (3 × 2) = 83.3%. Overflow records count as records, overflow slots do not count as slots.'),
  Q('l3-19', 'l3', 'A linear hash table has n = 5 buckets. How many bits of the hash value (and from which end) are used to number the buckets?', ['3 bits, from the right', '3 bits, from the left', '2 bits, from the right', '5 bits, from the right'], 'i = ⌈log₂ 5⌉ = 3. Linear hashing always takes the low-order (right) bits.'),
  Q('l3-20', 'l3', 'Linear hash table with n = 3 and i = 2. The key 1111 arrives. Which bucket receives it (no new bucket is added)?', ['Bucket 01 (number 1)', 'Bucket 11 (number 3)', 'Bucket 10 (number 2)', 'Bucket 00 (number 0)'], 'Last two bits 11 = 3. m = 3 is not less than n = 3, so bucket 3 does not exist: use m − 2^(i−1) = 3 − 2 = 1, i.e. bucket 01.'),
  Q('l3-21', 'l3', 'The lecture says "if m > n use bucket m − 2^(i−1)". What is the correct reading?', ['It should be m ≥ n, since buckets are numbered 0 to n − 1', 'It should be m < n only', 'It is exactly m > n, and m = n has its own rule', 'It should be m ≥ 2n'], 'With n buckets numbered 0 to n − 1, bucket m = n does not exist either. The key 1111 in Lecture Example I has m = 3 = n and must go to bucket 1.'),
  Q('l3-22', 'l3', 'Lecture Example II: n = 3, buckets 00 = {0000}, 01 = {0001, 1001, +1111 overflow}, 10 = {0110}. You insert 0010. What happens first?', ['Utilization is 5/6 = 83.3% ≥ 80%: bucket 11 is added and bucket 01 is re-hashed (1111 moves to 11)', 'Nothing: 0010 goes to bucket 10', 'The overflow block is simply removed', 'All three buckets are re-hashed'], 'Utilization is checked first. It is above 80%, so bucket 11 is added. Only its twin, bucket 01, is re-hashed: 1111 ends in 11 and moves, 0001 and 1001 end in 01 and stay. Then 0010 (ends in 10) goes to bucket 10.'),
  Q('l3-23', 'l3', 'When a bucket is added to a linear hash table, which existing buckets are re-hashed?', ['Only the one bucket that is the new bucket\'s twin (n − 2^(i−1))', 'All buckets', 'The bucket that just overflowed', 'None of them'], 'The new bucket n is the "1 twin" of bucket n − 2^(i−1). Only that bucket\'s records can have the new number as their last i bits, so only it is re-hashed.'),
  Q('l3-24', 'l3', 'Which feature belongs to LINEAR hashing and not to extensible hashing?', ['No indirection: no directory; overflow blocks can exist', 'The directory doubles in size', 'Uses the first i bits from the left', 'Each bucket stores a nub j'], 'Takeaways: linear hashing has no indirection but may still have overflow buckets. Directory, doubling and j are extensible hashing.'),
  Q('l3-26', 'l3', 'Which query benefits from a hash index on salary?', ['SELECT * FROM Emp WHERE salary = 5000', 'SELECT * FROM Emp WHERE salary BETWEEN 4000 AND 6000', 'SELECT * FROM Emp ORDER BY salary', 'SELECT MAX(salary) FROM Emp'], 'A hash index answers exact-value queries. Ranges, ordering and max need an order on the keys, which hashing destroys.'),
  Q('l3-27', 'l3', 'A table is queried 99% of the time by <code>WHERE order_id = ?</code> and 1% by <code>WHERE order_date BETWEEN ? AND ?</code>. A sensible indexing plan is:', ['Hash index on order_id, B+ tree on order_date', 'Hash index on both columns', 'B+ tree on order_id only, because hash cannot be combined', 'No index on order_date, a hash index handles ranges'], 'Hash for the exact-match workload, a B+ tree for the range column. Hash cannot do ranges at all, so order_date needs the tree.'),
  Q('l3-29', 'l3', 'A hash index is created on (dept, grade). Which query can use it?', ['WHERE dept = \'CS\' AND grade = 3', 'WHERE dept = \'CS\'', 'WHERE grade = 3', 'WHERE dept = \'CS\' AND grade &gt; 2'], 'The hash is computed from the whole key (dept, grade). With only one attribute, or with a range on one of them, you cannot compute the bucket number.'),
  // ---- practice assignment
  Q('pa3-1', 'pa3', 'PA3-1 (a): the table has 4 buckets with 2 records per block; bucket 0 = d, bucket 1 = e, c, bucket 2 = b, bucket 3 = a, f. After inserting g, h, i, j into buckets 0, 1, 2, 3, how many overflow blocks exist?', ['2 (buckets 1 and 3)', '4', '1', '0'], 'g fits in bucket 0 and i fits in bucket 2. Bucket 1 and bucket 3 were full, so h and j each start an overflow block.'),
  Q('pa3-2', 'pa3', 'PA3-1 (b): after (a), records a and b are deleted. What does bucket 3 look like?', ['f and j in the primary block, no overflow block', 'f in the primary block and j in an overflow block', 'j only', 'a hole where a was, plus an overflow block with j'], 'When a is deleted the record at the end of the chain (j) moves up into the free slot and the now-empty overflow block is removed.'),
  Q('pa3-4', 'pa3', 'PA3-1 (d): after (c), c and d are deleted. What is in bucket 0?', ['g and k, with no overflow block', 'g in the primary block and k in an overflow block', 'k only', 'd and g'], 'Deleting d leaves a hole in the primary block and k (the end of the chain) moves up. The overflow block then empties and disappears.'),
  Q('pa3-5', 'pa3', 'PA3-2: i = 1, bucket 0 = {0001} (j = 1), bucket 1 = {1001, 1100} (j = 1), 2 records per block. After inserting 1010, what is i and which entries point to the bucket {0001}?', ['i = 2; entries 00 and 01', 'i = 1; entry 0 only', 'i = 2; entry 00 only', 'i = 3; entries 000 to 011'], 'Bucket 1 is full with j = 1 = i, so the directory doubles to i = 2. Bucket 0 is untouched (j = 1), so its old entry 0 became 00 and 01.'),
  Q('pa3-6', 'pa3', 'PA3-2 (b): after inserting 1010 the table has i = 2, with bucket {0001} (j = 1) shared by 00 and 01. You insert 0000 and then 0111. What happens when 0111 arrives?', ['The shared bucket (0001, 0000) is full with j = 1 &lt; i, so it splits and the directory does not double', 'The directory doubles to i = 3', 'An overflow block is chained', '0111 goes into the bucket with 1001'], '0111 goes to entry 01. That bucket holds 0001 and 0000 (full) and j = 1 &lt; i = 2. Split on the 2nd bit: 0111 moves to a new bucket (j = 2), 0001 and 0000 stay (j = 2).'),
  Q('pa3-7', 'pa3', 'PA3-2 (c): the table has i = 2 with buckets {0000, 0001}, {0111}, {1001, 1010}, {1100} (all j = 2). You insert 1000. What is the directory size afterwards?', ['8 entries (i = 3)', '4 entries (i = 2)', '16 entries (i = 4)', '2 entries'], 'Entry 10 leads to {1001, 1010}, which is full with j = 2 = i. The directory doubles to i = 3 and the bucket splits on the 3rd bit: 1000 and 1001 stay together (100), 1010 goes to 101.'),
  Q('pa3-8', 'pa3', 'PA3-3: bucket capacity 2, start empty (i = 0). After inserting 0000, 0001, 0010, 0011, 0100, 0110, 1000, how many directory entries point to the bucket {1000}?', ['4', '1', '2', '8'], 'The final table has i = 3. {1000} has j = 1, so 2^(3−1) = 4 entries (100, 101, 110, 111) point to it.'),
  Q('pa3-9', 'pa3', 'PA3-3: which key insertion first makes the directory grow?', ['0010, the third key (the first overflow)', '0001, the second key', '0000, the first key', '0100, the fifth key'], 'Two keys fit in the single bucket. The third (0010) finds it full with j = i = 0, so the directory has to double (and, because 0000, 0001, 0010 share their first two bits, it doubles three times in that one insertion).'),
  Q('pa3-11', 'pa3', 'PA3-4 (linear, X = 2, start n = 2): which insertion is the first to add a bucket?', ['0010, the fifth key (utilization 4/4 = 100%)', '1011, the fourth key', '0101, the third key', '0011, the first key'], 'Before the fifth insert there are 4 records in 4 slots: 100% ≥ 80%. Before the fourth insert it is 3/4 = 75%, below 80%.'),
  Q('pa3-12', 'pa3', 'PA3-4: what is the utilization rate before inserting the sixth key, 1101 (after 0010 was inserted and bucket 10 was added)?', ['5 / 6 = 83.3%', '5 / 4 = 125%', '4 / 6 = 66.7%', '6 / 6 = 100%'], 'After the fifth insert there are 5 records and n = 3 buckets with 2 slots each. 5 ÷ 6 = 83.3% ≥ 80%, so bucket 11 is added before 1101 goes in.'),
  Q('pa3-13', 'pa3', 'PA3-4: how does the final table look?', ['n = 6, i = 3; overflow block (0111) on bucket 011', 'n = 6, i = 3; no overflow blocks', 'n = 5, i = 3; overflow on bucket 001', 'n = 8, i = 3; overflow on bucket 011'], 'Nine keys with growth at inserts 5, 6, 8 and 9 gives n = 2 + 4 = 6. Bucket 011 holds 0011, 1011 and 0111 overflowed there.'),
  Q('pa3-14', 'pa3', 'PA3-4: the key 0001 is the last insert (utilization 8/10 = 80%). What happens?', ['A bucket is added (80% counts as reached), bucket 001 is re-hashed and 0001 goes to bucket 001', 'Nothing: 80% is not yet reached', 'The table doubles to 10 buckets', 'The last key is placed in an overflow block of bucket 101'], 'The rule is "at least 80%" (≥). With 8 records in 5 × 2 = 10 slots, bucket 101 is added. It is the twin of 001: 0101 and 1101 end in 101 and move there, 1001 (from the overflow block) moves up. Then 0001 (last 3 bits 001) joins 1001 in bucket 001.'),
  Q('pa3-15', 'pa3', 'Midterm 2025 Ex 4.1 (bucket holds 3; i = 1; bucket 0 = 0010, 0110, 0111; bucket 1 = 1000). After inserting 0000 (alone), what are i and the j values?', ['i = 2; j = 2, 2 and 1', 'i = 1; j = 1 and 1', 'i = 2; j = 2, 2 and 2', 'i = 3; j = 3, 3 and 1'], 'Bucket 0 is full with j = 1 = i: double to i = 2 and split on the 2nd bit. {0000, 0010} and {0110, 0111} get j = 2. Bucket 1 is untouched (j = 1, entries 10 and 11).'),
  Q('pa3-16', 'pa3', 'Midterm 2025 Ex 4.1 (b): the same starting table, insert 1111. What is the result?', ['1111 joins 1000 in bucket 1; i stays 1; no split', 'i becomes 2 and bucket 1 splits', 'i becomes 2 and an overflow block is added', 'The table rebuilds with i = 3'], 'Entry 1 leads to bucket {1000}, which has room for 3 records. Step 3 applies (insert) and nothing else changes.'),
  Q('pa3-17', 'pa3', 'Midterm 2025 Ex 4.2: n = 3, 2 per block, bucket 01 = 1001, 1101 + overflow 0011, other buckets empty. What is the utilization rate before inserting 1111?', ['3 / 6 = 50%, so no bucket is added', '3 / 4 = 75%', '4 / 6 = 66.7%', '3 / 2 = 150%'], 'There are 3 records in 3 × 2 = 6 primary slots: 50%. Below 80%, so no bucket is added and 1111 goes to bucket 3 − 2 = 1, into the existing overflow block.'),
];

// ================================================================== GLOSSARY
export const glossary = [
  ['Hash function h(K)', 'Maps a search key K to an integer from 0 to B − 1, the number of the bucket that stores (or will store) the record.', 'l3'],
  ['Bucket', 'The unit that h(K) selects. In secondary storage a bucket is a block (plus a chain of overflow blocks if it is full).', 'l3'],
  ['Overflow block', 'An extra block chained to a full bucket. Static and linear hashing use them; extensible hashing normally avoids them (except for duplicates).', 'l3'],
  ['Static hashing', 'A hash table with a fixed number of buckets. A full bucket grows an overflow chain. Cannot adapt to growth.', 'l3'],
  ['Dynamic hashing', 'Hashing where the number of buckets varies so that it is about the number of records divided by records per block. Two techniques: extensible and linear.', 'l3'],
  ['Extensible hashing', 'Dynamic hashing with a directory of 2^i pointers indexed by the first i bits of h(K). The directory doubles when needed.', 'l3'],
  ['Directory', 'The array of 2^i pointers to blocks in extensible hashing. Entries can share a bucket.', 'l3'],
  ['i (extensible)', 'The number of leading (leftmost) hash bits the directory uses. The directory has 2^i entries.', 'l3'],
  ['j (nub)', 'Stored in a bucket header: the number of leading bits that all records in the bucket share. A bucket is pointed to by 2^(i−j) entries.', 'l3'],
  ['Directory doubling', 'Step 4.2: when a full bucket has j = i, i grows by 1 and every entry w becomes two entries w0 and w1 pointing to the same block.', 'l3'],
  ['Bucket split (extensible)', 'Step 4.1: a full bucket with j &lt; i is divided on its (j + 1)st bit; the 0 records stay, the 1 records go to a new block; both get j + 1.', 'l3'],
  ['Cascading split', 'A split that does not separate the records (they share the next bit), so the bucket is still full and splits again, possibly doubling the directory more than once.', 'l3'],
  ['Duplicates', 'Records with identical hash values. They cannot be separated by more bits and may force overflow blocks even in extensible hashing.', 'l3'],
  ['Linear hashing', 'Dynamic hashing with no directory: n buckets, one bucket added when utilization reaches 80%, bucket number taken from the last i = ⌈log₂ n⌉ bits.', 'l3'],
  ['Utilization rate (linear)', 'Records ÷ (slots in the table − slots in overflow blocks) = records ÷ (n × records per block). Computed before the insertion; ≥ 0.8 adds a bucket.', 'l3'],
  ['m ≥ n rule', 'Let m be the last i bits as a number. If m &lt; n use bucket m, otherwise use bucket m − 2^(i−1). (The slide writes m &gt; n; it means m ≥ n.)', 'l3'],
  ['Bucket twin (split image)', 'In linear hashing the new bucket n pairs with n − 2^(i−1); only that old bucket is re-hashed when n is added.', 'l3'],
  ['Indirection', 'The extra directory lookup between the hash bits and the data block in extensible hashing. Linear hashing has none.', 'l3'],
  ['Exact-match query', 'A query that fixes the whole search key to one value (K = v). The only kind of query a hash index speeds up.', 'l3'],
  ['Skew (clustered hash values)', 'Hash values sharing many leading bits. In extensible hashing this causes cascading splits and a large directory.', 'pa3'],
  ['Independent operations', 'Exam wording: each operation starts from the diagram given, not from the result of the previous one (Midterm 2025 Ex 4).', 'pa3'],
];

// ================================================================== CHEAT SHEET
export const cheat = [
  ['l3', 'Hash index at a glance', ['h(K) in 0 to B − 1; look only in bucket h(K). O(1) for exact match.', 'On disk: buckets are blocks; full buckets chain overflow blocks.', 'Useless for ranges, ORDER BY, prefixes, partial keys.', 'Static: fixed B. Dynamic: B follows records ÷ records per block.']],
  ['l3', 'Extensible hashing steps', ['First i bits from the LEFT choose the directory entry (2^i entries).', 'Room? Insert. Full: look at j of the bucket.', 'j &lt; i: split bucket on bit j + 1, re-point entries, no doubling.', 'j = i: i + 1 (double directory), then split. Repeat if still full.', 'Both halves get j + 1. Entries per bucket = 2^(i−j).']],
  ['l3', 'Linear hashing steps', ['Utilization = records ÷ (n × cap), BEFORE inserting.', '≥ 80%: add bucket n (one at a time); re-hash only bucket n − 2^(i−1).', 'i = ⌈log₂ n⌉ bits from the RIGHT; m = last i bits.', 'm &lt; n: bucket m. m ≥ n: bucket m − 2^(i−1).', 'Bucket full: chain an overflow block.']],
  ['l3', 'Extensible vs linear', ['Extensible: directory (indirection), doubles, normally no overflow.', 'Linear: no indirection, +1 bucket, overflow allowed.', 'Both grow without full reorganization.']],
  ['pa3', 'Exam checklist: hash exercises', ['Read the capacity per bucket and the threshold in the question.', 'State i and the bits you used for every insert.', 'Extensible: after each split ask "still full?".', 'Linear: write the utilization fraction for every insert.', 'Independent operations start from the given diagram.', 'Relabel linear buckets when i grows (01 becomes 001).']],
];
