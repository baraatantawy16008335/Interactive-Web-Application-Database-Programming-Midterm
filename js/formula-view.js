// Formula sheet: exactly what the doctor's email says will be provided in the midterm
// (Lecture 5 slides 14-20 equivalence rules, Lecture 2 slide 16 B+ tree thresholds), and what is NOT provided.
import { limits } from './engine/bptree.js';

const rule = (l, r, note = '') => `<tr><td class="num" style="white-space:normal">${l}</td><td style="text-align:center">=</td><td class="num" style="white-space:normal">${r}</td>${note ? `<td class="small muted">${note}</td>` : '<td></td>'}</tr>`;
const ruleNe = (l, r, note = '') => `<tr><td class="num" style="white-space:normal">${l}</td><td style="text-align:center">≠</td><td class="num" style="white-space:normal">${r}</td><td class="small muted">${note}</td></tr>`;
const tbl = rows => `<div class="tbl-wrap"><table class="tbl formula"><tbody>${rows.join('')}</tbody></table></div>`;
const card = (title, sub, body) => `<section class="bench" style="margin:18px 0"><div class="bench-head"><i class="ph ph-function"></i><h3>${title}</h3>${sub ? `<span class="hint">${sub}</span>` : ''}</div><div class="bench-body">${body}</div></section>`;

export function renderFormula(view) {
  const n = 3;
  view.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:end;gap:16px;flex-wrap:wrap"><div><h1>Formula sheet</h1>
    <p class="lede" style="margin-top:10px">This is what the doctor said you will be <strong>given</strong> in the midterm: the relational algebra equivalence rules (Lecture 5, slides 14 to 20) and the B+ tree threshold table (Lecture 2, slide 16). Learn to <em>use</em> them; the sheet will <strong>not</strong> tell you which rewrite is more optimal.</p></div>
    <button class="btn" onclick="window.print()"><i class="ph ph-printer"></i>Print</button></div>

  ${card('B+ tree thresholds', 'Lecture 2, slide 16 · given', `
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Node type</th><th>Max keys</th><th>Max pointers</th><th>Min keys</th><th>Min pointers</th></tr></thead><tbody>
      <tr><td>Root</td><td class="num">n</td><td class="num">n + 1</td><td class="num">1</td><td class="num">1</td></tr>
      <tr><td>Non-leaf</td><td class="num">n</td><td class="num">n + 1</td><td class="num">⌈(n+1)/2⌉ − 1</td><td class="num">⌈(n+1)/2⌉</td></tr>
      <tr><td>Leaf</td><td class="num">n</td><td class="num">n + 1</td><td class="num">⌊(n+1)/2⌋</td><td class="num">⌊(n+1)/2⌋ + 1</td></tr>
    </tbody></table></div>
    <p class="small muted" style="margin-top:8px">The root normally uses at least two pointers; it can be a single leaf with one key only when the whole table has one record. A leaf's extra pointer is the link to the next leaf, which is why its minimum pointers is "+ 1".</p>
    <div class="field" style="max-width:220px;margin-top:12px"><label for="fn">Try a value of n</label><input id="fn" type="number" min="2" max="12" value="${n}"></div>
    <div data-lim style="margin-top:10px"></div>`)}

  ${card('Commutative and associative laws', 'Lecture 5, slide 14 · given', tbl([
    rule('R × S', 'S × R'), rule('(R × S) × T', 'R × (S × T)'),
    rule('R ⋈ S', 'S ⋈ R'), rule('(R ⋈ S) ⋈ T', 'R ⋈ (S ⋈ T)'),
    rule('R ∪ S', 'S ∪ R'), rule('(R ∪ S) ∪ T', 'R ∪ (S ∪ T)'),
    rule('R ∩ S', 'S ∩ R'), rule('(R ∩ S) ∩ T', 'R ∩ (S ∩ T)'),
    rule('R ⋈<sub>c</sub> S', 'S ⋈<sub>c</sub> R'),
    ruleNe('(R ⋈<sub>R.b&gt;S.b</sub> S) ⋈<sub>a&lt;d</sub> T', 'R ⋈<sub>R.b&gt;S.b</sub> (S ⋈<sub>a&lt;d</sub> T)', 'theta-joins are not always associative: a condition may need an attribute that is not available yet'),
  ]))}

  ${card('Laws involving selection σ', 'Lecture 5, slides 15-16 · given', tbl([
    rule('σ<sub>c1 ∧ c2</sub>(R)', 'σ<sub>c1</sub>(σ<sub>c2</sub>(R))', 'split an AND'),
    rule('σ<sub>c1 ∨ c2</sub>(R)', 'σ<sub>c1</sub>(R) ∪<sub>s</sub> σ<sub>c2</sub>(R)', 'split an OR (set union)'),
    rule('σ<sub>c1</sub>(σ<sub>c2</sub>(R))', 'σ<sub>c2</sub>(σ<sub>c1</sub>(R))', 'order of selections is free'),
    rule('σ<sub>c</sub>(R ∪ S)', 'σ<sub>c</sub>(R) ∪ σ<sub>c</sub>(S)', 'push to both sides'),
    rule('σ<sub>c</sub>(R − S)', 'σ<sub>c</sub>(R) − S = σ<sub>c</sub>(R) − σ<sub>c</sub>(S)', ''),
    rule('σ<sub>c</sub>(R × S)', 'σ<sub>c</sub>(R) × S', 'if only R has the attributes of c'),
    rule('σ<sub>c</sub>(R ⋈ S)', 'σ<sub>c</sub>(R) ⋈ S', 'same condition'),
    rule('σ<sub>c</sub>(R ⋈<sub>D</sub> S)', 'σ<sub>c</sub>(R) ⋈<sub>D</sub> S', ''),
    rule('σ<sub>c</sub>(R ∩ S)', 'σ<sub>c</sub>(R) ∩ S', ''),
  ]) + `<p class="small muted" style="margin-top:8px">Slide 16: assuming R has the attributes of c. If S has them instead, apply the selection to S. If both R and S have them, the selection can be pushed to both.</p>`)}

  ${card('Laws involving projection π', 'Lecture 5, slide 17 · given', `<p>We may introduce a projection anywhere in an expression tree, as long as it eliminates only attributes that are neither used by an operator above nor are in the result of the entire expression.</p>`)}

  ${card('Laws involving joins and products', 'Lecture 5, slide 18 · given', tbl([
    rule('R ⋈<sub>c</sub> S', 'σ<sub>c</sub>(R × S)'),
    rule('R ⋈ S', 'π<sub>L</sub>(σ<sub>C</sub>(R × S))', 'C equates each pair of same-named attributes; L keeps one of each pair plus all other attributes'),
  ]) + `<p class="small muted" style="margin-top:8px">The slide adds that these are usually applied from right to left, because a join is much faster than a product followed by a selection on large tables.</p>`)}

  ${card('Laws involving duplicate elimination δ', 'Lecture 5, slide 19 · given', tbl([
    rule('δ(R × S)', 'δ(R) × δ(S)'), rule('δ(R ⋈ S)', 'δ(R) ⋈ δ(S)'), rule('δ(R ⋈<sub>c</sub> S)', 'δ(R) ⋈<sub>c</sub> δ(S)'),
    rule('δ(σ<sub>c</sub>(R))', 'σ<sub>c</sub>(δ(R))'),
    rule('δ(R ∩<sub>B</sub> S)', 'δ(R) ∩<sub>B</sub> S = R ∩<sub>B</sub> δ(S) = δ(R) ∩<sub>B</sub> δ(S)'),
  ]) + `<p style="margin-top:8px"><strong>δ cannot be pushed through ∪<sub>B</sub>, −<sub>B</sub> or π.</strong></p>`)}

  ${card('Laws involving grouping γ', 'Lecture 5, slide 20 · given', tbl([
    rule('γ<sub>L</sub>(R)', 'γ<sub>L</sub>(δ(R))', 'only for MIN and MAX (duplicate-impervious)'),
    ruleNe('γ<sub>L</sub>(R)', 'γ<sub>L</sub>(δ(R))', 'for SUM, COUNT, AVG'),
    rule('δ(γ<sub>L</sub>(R))', 'γ<sub>L</sub>(R)', 'grouping output has no duplicates'),
    rule('γ<sub>L</sub>(R)', 'γ<sub>L</sub>(π<sub>M</sub>(R))', 'M contains at least every attribute of R mentioned in L'),
  ]))}

  <div class="section-head"><div><h2>Not on the sheet: know these by heart</h2><p>The email says guidelines on which substitution is more optimal will not be given. Neither are the size-estimation rules.</p></div></div>
  <div class="cheat">
    <div class="cheat-card"><h3>Which rewrite is better (heuristics)<a href="#/m/l5">L5</a></h3><ul>
      <li><strong>1. Push selections down</strong> as far as they go; split an AND into separate selections first.</li>
      <li><strong>2. Push projections down</strong> (or add new ones) to shrink each row.</li>
      <li><strong>3. Most restrictive selection and join first</strong>: the ones producing the fewest rows.</li>
      <li><strong>4. Move δ to a convenient place</strong>, or remove it when it is not needed.</li>
      <li><strong>5. Turn σ over × into a join</strong> (equijoin).</li>
      <li>Cost-based planners pick the plan whose <strong>intermediate results</strong> (not the leaves, not the final result) add up to the least.</li></ul></div>
    <div class="cheat-card"><h3>Size estimation<a href="#/m/l5">L5</a></h3><ul>
      <li>σ<sub>a = v</sub>: T(R) / V(R, a)</li>
      <li>σ<sub>a ≠ v</sub>: T(R) × (1 − 1/V(R, a)) ≈ T(R)</li>
      <li>σ<sub>a &lt; v</sub> or <sub>&gt; v</sub>: T(R) / 3 (or / 2), or T(R) × f with f = matching range / whole range, e.g. a &gt; v: (max − v)/(max − min + 1)</li>
      <li>AND: multiply the fractions. OR: add the two estimates.</li>
      <li>R × S: T(R) × T(S). R ⋈ S on y: T(R) T(S) / max(V(R, y), V(S, y)), one max per shared attribute.</li>
      <li>⋈ with &lt; or &gt;: T(R) T(S) / 3. ∪: T(R) + T(S). ∩: min(T(R), T(S)) / 2. −: (T(R) − T(S)) / 2. δ: T(R) / 2.</li></ul></div>
    <div class="cheat-card"><h3>B+ tree: how to use the table<a href="#/m/l2">L2</a></h3><ul>
      <li>n comes from the block: n keys + (n + 1) pointers ≤ block size. 4n + 8(n + 1) ≤ 4096 gives n = 340.</li>
      <li>Underflow in a leaf: borrow from a sibling with spare keys, otherwise merge and delete a key from the parent.</li>
      <li>Leaf split: the first key of the new right leaf is <strong>copied</strong> up. Non-leaf split: the middle key <strong>moves</strong> up.</li></ul></div>
  </div>`;
  const lim = view.querySelector('[data-lim]'), inp = view.querySelector('#fn');
  const paint = () => {
    const v = Math.max(2, Math.min(12, Math.round(+inp.value || 3))), L = limits(v);
    lim.innerHTML = `<div class="chips"><span class="chip accent">n = ${v}</span><span class="chip">Leaf: ${L.leaf.minKeys} to ${v} keys, ${L.leaf.minPtrs} to ${v + 1} pointers</span><span class="chip">Non-leaf: ${L.nonleaf.minKeys} to ${v} keys, ${L.nonleaf.minPtrs} to ${v + 1} pointers</span><span class="chip">Root: 1 to ${v} keys</span></div>`;
  };
  inp.addEventListener('input', paint); paint();
}
