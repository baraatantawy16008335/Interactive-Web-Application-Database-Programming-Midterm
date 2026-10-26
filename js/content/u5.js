import { K, T, W, terms, compare, steps, code, table } from './helpers.js';
import { u5Model as M } from '../widgets/w-u5.js';
import { planSVG } from '../engine/draw.js';
import * as C from '../engine/cost.js';

// ---------------------------------------------------------------- small helpers for the drawings in the notes
const nf = C.fmt;
const fig = (svg, cap) => `<div class="figure" style="margin:14px 0"><div style="overflow-x:auto">${svg}</div>${cap ? `<div class="small muted" style="margin-top:4px">${cap}</div>` : ''}</div>`;
const figs = list => `<div style="display:flex;flex-wrap:wrap;gap:16px;margin:14px 0">${list.map(([svg, cap]) => `<div style="flex:1 1 270px;min-width:0"><div style="overflow-x:auto">${svg}</div><div class="small muted" style="margin-top:4px">${cap}</div></div>`).join('')}</div>`;
const A = (p, ctx) => M.annotate(M.strip(p), ctx.stats, ctx.schema);
const pl = (p, ctx, o) => M.draw(A(p, ctx), o);
const cst = (p, ctx) => M.cost(A(p, ctx));
const ctxt = (p, ctx) => M.costTxt(cst(p, ctx));
const X = (text, ...ks) => { const o = { op: 'x', text }; ['in', 'l', 'r'].forEach((k, i) => { if (ks[i]) o[k] = ks[i]; }); return o; };
const L = name => ({ op: 'rel', text: name });
const raw = nd => planSVG(nd, { sizes: false });
const { P, sc, FJ, R4 } = M;
const { prj, jn, sel, rel, eqc, dst } = M;
const sub = t => `<sub>${t}</sub>`;
const FS = '<a href="#/formula">formula sheet</a>';

// ---------------------------------------------------------------- plans reused by several sections
const bkF = () => prj(['customer_name'], jn(prj(['account_id'], jn(prj(['branch_id'], sel([eqc('branch_city', "'Brooklyn'")], rel('branch'))), rel('account'), [['branch_id', 'branch_id']])), rel('depositor'), [['account_id', 'account_id']]));
const logicalFig = X('π title', X('σ starName = name', X('×', L('StarsIn'), X("σ birthdate LIKE '%1960'", L('MovieStar')))));
const physicalFig = X('π title', X('join', X('Table scan', L('StarsIn')), X('Index scan', L('MovieStar'))));

// PA 5-1: the six plans of the official solution
const sR = X('σ R.D = 16', L('R')), sS = X('σ S.F = 17', L('S')), jj = (c, a, b) => X('⋈ ' + c, a, b), tp = (c, x) => X('σ ' + c, x);
const PA1 = [
  tp('S.C = T.C', jj('R.B = T.B', jj('R.A = S.A', sR, sS), L('T'))),
  tp('R.B = T.B', jj('S.C = T.C', jj('R.A = S.A', sR, sS), L('T'))),
  tp('S.C = T.C', jj('R.A = S.A', jj('R.B = T.B', sR, L('T')), sS)),
  tp('R.A = S.A', jj('S.C = T.C', jj('R.B = T.B', sR, L('T')), sS)),
  tp('R.B = T.B', jj('R.A = S.A', jj('S.C = T.C', L('T'), sS), sR)),
  tp('R.A = S.A', jj('R.B = T.B', jj('S.C = T.C', L('T'), sS), sR)),
];

// ================================================================================================ LECTURE 5
export const lecture = {
  id: 'l5', kind: 'lecture', num: 'L5', icon: 'tree-structure',
  title: 'Lecture 5: Query Optimization I, Logical Planning', navTitle: 'Logical planning', mapLabel: 'Logical planning',
  short: 'How a DBMS turns SQL into an algebra tree, which rewrite rules are legal, which rewrite is better, and how it estimates sizes to compare plans.',
  goals: [
    'Name the components of the query processor and say what each one produces.',
    'Tell logical planning, physical planning and buffer management apart.',
    'Apply every equivalence rule of the formula sheet correctly, and spot the cases where a rule does NOT apply (δ, γ, θ-joins, wrong side for σ).',
    'Use heuristics 1 to 5 to rewrite a plan, and explain why the result is better (or when it is not).',
    'Estimate the size of σ, ×, ⋈, ∪, ∩, −, δ and π with the lecture formulas, and the block count after a projection.',
    'Compare two equivalent plans by the sum of their intermediate results.',
  ],
  sections: [
    // ------------------------------------------------------------------------------------------------ 1
    { id: 'processor', title: 'The query processor (slides 3 to 5, 10)', body: `
<div class="prose">
<p>A user sends SQL. The DBMS cannot run SQL text, so a group of components turns it into operations on tables and then runs them. That group is the <strong>query processor</strong>: it turns user queries and data-modification commands into a sequence of database operations and executes those operations.</p>
${steps([
  ['Parser', 'Checks the syntax and builds a <strong>parse tree</strong> (the query expression tree of slide 4). Parsing is only for checking syntax.'],
  ['Preprocessor', 'Semantic checks against the catalog: do the relations and attributes exist, are the types right, are views replaced by their definitions. Output: a valid parse tree.'],
  ['Logical query plan generator', 'Turns the valid parse tree into an initial <strong>logical query plan</strong>: a relational algebra tree.'],
  ['Query rewriter', 'Transforms that tree into an equivalent one that should run faster. Output: the <strong>preferred logical query plan</strong>.'],
  ['Physical plan generator', 'Picks algorithms, the execution order, access paths (table scan or index scan) and sorting. Output: the <strong>physical query plan tree</strong>.'],
  ['Execution engine', 'Runs the physical plan.'],
])}
${K('Slide 4 has three kinds of tree: the <em>query expression tree</em> (after parsing), the <em>logical query plan tree</em> and the <em>physical query plan tree</em>. "Query optimization" is the brace around the last two stages. Slide 10 splits the front part again: parser and preprocessor on one side, and <strong>logical plan generator plus query rewriter</strong> as "today\'s topic".')}
<h3>The parse tree of slide 5</h3>
<p>Take the nested query from the slide:</p>
${code(M.PIPE.A.sql, 'SQL')}
<p>The parse tree has <em>non-terminals</em> in angle brackets (&lt;Query&gt;, &lt;SelList&gt;, &lt;FromList&gt;, &lt;Condition&gt;, &lt;Attribute&gt;, &lt;RelName&gt;, &lt;Pattern&gt;) and <em>atoms</em> at the leaves (keywords, names, constants). The subquery is simply another &lt;Query&gt; inside the outer &lt;Condition&gt;. To keep the figure narrow, the keywords SELECT, FROM and WHERE are written under each &lt;Query&gt; instead of being drawn as separate leaves.</p>
</div>
${fig(raw(M.PIPE.A.parse()), 'Parse tree of the nested StarsIn / MovieStar query (slide 5).')}
<div class="prose">
${T('Parsing says nothing about whether StarsIn exists or whether it is a good plan. The parser only checks syntax. The lecture\'s takeaway: a SQL query goes through <strong>three translations</strong>: parsing, logical, physical. Parsing is for syntax checking, logical and physical are for optimization and execution.')}
<p>Step through every stage for two example queries:</p>
</div>
${W('u5Pipeline')}` },

    // ------------------------------------------------------------------------------------------------ 2
    { id: 'logical-physical', title: 'Logical vs physical planning (slides 6 to 9)', body: `
<div class="prose">
${compare(
  ['tree-structure', 'Logical planning', [
    'Input: the parse tree. Output: an initial algebra tree, then an <strong>equivalent</strong> tree expected to need less time.',
    'Operators are relational algebra: σ, π, ×, ⋈, δ, γ.',
    'Answers: <em>which of the algebraically equivalent forms is the most efficient?</em>',
    'Tools: the algebraic laws (the ' + FS + '), heuristics, size estimates.'],
  ],
  ['gear', 'Physical planning', [
    'Selects an <strong>algorithm</strong> for every operator of the logical plan and the order of execution.',
    'Includes how relations are accessed (table scan, index scan) and when and if a relation is sorted.',
    'Answers: <em>which algorithm implements each operation?</em>',
    'Tools: sizes, statistics, which indexes exist, data layout. (Lecture 6.)'],
  ])}
<h3>The same query at both levels (slide 9)</h3>
</div>
${figs([[raw(logicalFig), 'Logical plan: what to compute. The slide omits the StarsIn leaf under ×; it is added here.'], [raw(physicalFig), 'Physical plan: how. A join algorithm, a table scan of StarsIn and an index scan of MovieStar.']])}
<div class="prose">
<h3>The three optimization questions (slides 7 and 8)</h3>
${steps([
  ['Logical plan', 'Which of the algebraically equivalent forms of a query leads to the most efficient algorithm for answering the query?'],
  ['Physical plan', 'For each operation of the selected form, which algorithm should we use to implement that operation?'],
  ['Buffer management', 'How should the operations pass data from one to the other: in a pipelined fashion, in main-memory buffers, or via the disk?'],
])}
<p>Every one of these choices depends on <strong>metadata</strong> about the database. Typical metadata available to the optimizer: the <strong>size of each relation</strong>, <strong>statistics</strong>, the <strong>existence of certain indexes</strong>, and the <strong>layout of data on disk</strong>.</p>
${K('This is where Lectures 1 to 4 connect to Lecture 5. The optimizer can only choose an index scan if the index (B+ tree, hash, grid, ...) exists, and the statistics (T, V, min, max) are what it uses to compare plans. This lecture covers question 1 only: the logical plan.')}
${T('Do not file "use an index" or "use a hash join" under logical planning. A logical plan has no algorithms: it has σ, π, ⋈ and so on. And "pipelined or via disk" is neither: it is buffer management.')}
<p>Try the sorting game: which stage makes each decision?</p>
</div>
${W('u5Layers')}` },

    // ------------------------------------------------------------------------------------------------ 3
    { id: 'plans', title: 'Many logical plans for one query (slides 11 and 12)', body: `
<div class="prose">
<p>Take R(a, b) and S(b, c) with the statistics of slide 40 (T(R) = 5000, V(R,a) = 50, V(R,b) = 100, T(S) = 2000, V(S,b) = 200) and the query</p>
${code('SELECT DISTINCT b\nFROM R, S\nWHERE R.a = 10;', 'SQL (R and S share the attribute b, so this is a natural join, as slide 40 writes it)')}
<p>All three trees below return the same answer. They are what slide 11 calls Logic Plan 1, 2 and 3. The sizes under each node are estimated with the rules of the second half of this lecture.</p>
</div>
${figs([
  [pl(P.s40p0(), sc.distinct), 'Plan 1: join everything, then select, then δ.'],
  [pl(P.s40a1(), sc.distinct), 'Plan 2: push σ to R, put δ on both inputs, join last.'],
  [pl(P.s40a2(), sc.distinct), 'Plan 3: push σ to R, join, one δ on top.'],
])}
<div class="prose">
<p>Their costs (sum of the intermediate results, defined in Section 9): plan 1 = <span class="num">${ctxt(P.s40p0(), sc.distinct)}</span>, plan 2 = <span class="num">${ctxt(P.s40a1(), sc.distinct)}</span>, plan 3 = <span class="num">${ctxt(P.s40a2(), sc.distinct)}</span>. Plan 1 is about 45 times worse, plans 2 and 3 are close. Which of 2 and 3 wins is not obvious from the shape alone. That is the whole difficulty of logical planning.</p>
<h3>How a DBMS picks one: two techniques (slide 12)</h3>
${compare(
  ['list-checks', 'Heuristic-based', [
    'Applies <strong>greedy rules</strong> that aim to improve the plan by rewriting the algebraic expression with the algebraic laws.',
    'Needs no statistics, is fast and predictable.',
    '<strong>Limited and does not always yield the optimal plan</strong>, but some RDBMS still use it.'],
  ],
  ['calculator', 'Cost-based', [
    'Uses a <strong>cost function</strong> to estimate the cost of each candidate plan and selects the cheapest one.',
    'Needs statistics (T, V, min, max).',
    'The estimate is only as good as the statistics and the uniformity assumption.'],
  ])}
${K('Real optimizers combine both: heuristics prune the huge space of equivalent plans, then costs choose among the survivors (this is the "pruning" step of the cost-based figure in Section 7).')}
</div>` },

    // ------------------------------------------------------------------------------------------------ 4
    { id: 'rules-1', title: 'The laws, part 1: order, grouping and σ (slides 13 to 16)', body: `
<div class="prose">
<p>These laws are printed on the exam's ${FS}. You will not need to remember them. You will need to know <strong>how to apply each one correctly</strong>, and that is where marks are lost: the sheet shows the equalities, not the conditions behind them. Throughout, "equivalent" means the two expressions always return the same result.</p>
<h3>Commutative and associative laws (slide 14)</h3>
${table(['Operator', 'R op S = S op R', '(R op S) op T = R op (S op T)', 'Comment'], [
  ['×', 'yes', 'yes', ''],
  ['⋈ (natural join)', 'yes', 'yes', 'Different groupings give the same result but different intermediate sizes (PA 5-4).'],
  ['∪, ∩', 'yes', 'yes', ''],
  ['⋈' + sub('c') + ' (with a condition)', 'yes', '<strong>not always</strong>', 'See the example below.'],
])}
<p>The sheet's counter-example is <span class="num">(R ⋈${sub('R.b&gt;S.b')} S) ⋈${sub('a&lt;d')} T ≠ R ⋈${sub('R.b&gt;S.b')} (S ⋈${sub('a&lt;d')} T)</span>. Why? Say a is an attribute of R and d of T. In the right-hand expression S ⋈ T is computed first, but its condition a &lt; d needs R.a, and R is not an input of S ⋈ T. The inner join has no usable condition.</p>
${K('<strong>Test before you regroup:</strong> the condition of the join that moves to the inside must only use attributes of the two relations it will now join. If it uses an attribute of the relation that is leaving the group, the rewrite is illegal.')}
<h3>Laws about selection σ (slides 15 and 16)</h3>
${table(['Law', 'How to apply it', 'When it does NOT apply'], [
  ['σ' + sub('c1 ∧ c2') + '(R) = σ' + sub('c1') + '(σ' + sub('c2') + '(R))', 'Split an <strong>AND</strong> into a cascade, then move each σ separately.', 'Not for OR: a cascade of σ is always an AND.'],
  ['σ' + sub('c1 ∨ c2') + '(R) = σ' + sub('c1') + '(R) ∪' + sub('s') + ' σ' + sub('c2') + '(R)', 'Split an <strong>OR</strong> into a <em>set</em> union of two selections.', 'Never σ' + sub('c1') + '(σ' + sub('c2') + '(R)) for an OR. Usually not worth doing: it scans R twice.'],
  ['σ' + sub('c1') + '(σ' + sub('c2') + '(R)) = σ' + sub('c2') + '(σ' + sub('c1') + '(R))', 'The order of cascaded selections is free.', 'Always legal. The <em>cost</em> is not the same: put the most restrictive one first (Heuristic 3).'],
  ['σ' + sub('c') + '(R ∪ S) = σ' + sub('c') + '(R) ∪ σ' + sub('c') + '(S)', 'Push to <strong>both</strong> sides.', 'σ' + sub('c') + '(R) ∪ S is wrong: the rows of S that fail c would stay in the answer.'],
  ['σ' + sub('c') + '(R − S) = σ' + sub('c') + '(R) − S = σ' + sub('c') + '(R) − σ' + sub('c') + '(S)', 'The σ must reach R. Reaching S as well is optional.', 'σ' + sub('c') + '(R − S) ≠ R − σ' + sub('c') + '(S).'],
  ['σ' + sub('c') + '(R × S) = σ' + sub('c') + '(R) × S<br>σ' + sub('c') + '(R ⋈ S) = σ' + sub('c') + '(R) ⋈ S<br>σ' + sub('c') + '(R ⋈' + sub('D') + ' S) = σ' + sub('c') + '(R) ⋈' + sub('D') + ' S<br>σ' + sub('c') + '(R ∩ S) = σ' + sub('c') + '(R) ∩ S', 'Only if <strong>R has all the attributes of c</strong>. If only S has them, push to S. If both have them, push to both.', 'If c needs attributes from both R and S, it cannot move to either side.'],
])}
<p>For the last row, ask where the attributes of the condition live. With R(a, b) and S(b, c) joined on b:</p>
${table(['Condition', 'Attributes found in', 'What you may do'], [
  ['a = 10', 'R only', 'σ' + sub('a=10') + '(R) ⋈ S'],
  ['c = 5', 'S only', 'R ⋈ σ' + sub('c=5') + '(S)'],
  ['b = 7', 'both (the join attribute)', 'σ' + sub('b=7') + '(R) ⋈ σ' + sub('b=7') + '(S), or just one side (slide 16: "both can be pushed")'],
  ['a = c', 'a is in R, c is in S', '<strong>Stays above</strong> a product, where it becomes the join condition (Heuristic 5). It cannot go to one side.'],
])}
${T('For σ over a join or product, the condition goes to <strong>the relation that has the attributes</strong>, not automatically to the left one. Pushing σ' + sub('S.f=17') + ' to R when only S has f is not a "smaller mistake", it is not a legal plan.')}
<p>The legality game that tests both sections is at the end of the next section.</p>
</div>` },

    // ------------------------------------------------------------------------------------------------ 5
    { id: 'rules-2', title: 'The laws, part 2: π, ⋈, δ, γ (slides 17 to 20)', body: `
<div class="prose">
<h3>Projection π (slide 17)</h3>
<p>We may <strong>introduce a projection anywhere</strong> in an expression tree, as long as it eliminates only attributes that are <em>neither used by an operator above nor in the result</em> of the entire expression.</p>
${steps([
  ['List what is needed above', 'The attributes in the final π, plus every attribute used by a σ condition, a join condition, a γ list or a π higher in the tree.'],
  ['Look at a node', 'Its attributes minus the needed ones are useless from this point up.'],
  ['Insert π on top of that node', 'Keep exactly the needed attributes. If nothing is useless, do not insert anything.'],
])}
<p>Example (Brooklyn query of Section 6): above the table <em>branch</em> the only things needed are the join attribute <span class="num">branch_id</span> and the selection attribute <span class="num">branch_city</span>. After the σ has used branch_city, only branch_id is needed: <span class="num">π${sub('branch_id')}(σ${sub('branch_city=Brooklyn')}(branch))</span>.</p>
<h3>Joins and products (slides 18 and 19)</h3>
${table(['Law', 'Meaning'], [
  ['R ⋈' + sub('c') + ' S = σ' + sub('c') + '(R × S)', 'A condition join is a selection over a product.'],
  ['R ⋈ S = π' + sub('L') + '(σ' + sub('C') + '(R × S))', 'C equates every pair of same-named attributes of R and S. L keeps one attribute of each pair plus all other attributes.'],
])}
<p><strong>Direction.</strong> The slide says the transformations are usually made <strong>from right to left</strong>, because joins are much faster than a product followed by a selection on large tables. In numbers (midterm 2025, exercise 6e): the product R × S has ${nf(40000 * 80000)} tuples. The join of the same tables on c has 80,000. Rewriting σ over × into ⋈ is Heuristic 5.</p>
<h3>Duplicate elimination δ (slide 19)</h3>
${compare(
  ['check-circle', 'δ CAN be pushed through', [
    'δ(R × S) = δ(R) × δ(S)',
    'δ(R ⋈ S) = δ(R) ⋈ δ(S), also with a condition: δ(R ⋈' + sub('c') + ' S) = δ(R) ⋈' + sub('c') + ' δ(S)',
    'δ(σ' + sub('c') + '(R)) = σ' + sub('c') + '(δ(R))',
    'δ(R ∩' + sub('B') + ' S) = δ(R) ∩' + sub('B') + ' S = R ∩' + sub('B') + ' δ(S) = δ(R) ∩' + sub('B') + ' δ(S)'],
  ],
  ['prohibit', 'δ CANNOT be pushed through', [
    '<strong>∪' + sub('B') + '</strong> (bag union)',
    '<strong>−' + sub('B') + '</strong> (bag difference)',
    '<strong>π</strong> (projection)'],
  ])}
<p>Why these three fail. Bags, so duplicates matter:</p>
${table(['Rewrite', 'Counter-example', 'Left side', 'Right side'], [
  ['δ(R ∪' + sub('B') + ' S) vs δ(R) ∪' + sub('B') + ' δ(S)', 'R = {1}, S = {1}', '{1}', '{1, 1}'],
  ['δ(R −' + sub('B') + ' S) vs δ(R) −' + sub('B') + ' δ(S)', 'R = {1, 1}, S = {1}', '{1}', '{ } (δ(R) − δ(S) = {1} − {1})'],
  ['δ(π' + sub('L') + '(R)) vs π' + sub('L') + '(δ(R))', 'R = {(1,a), (1,b)}, L = first column', '{1}', '{1, 1}'],
])}
<h3>Grouping γ (slide 20)</h3>
<p>What γ may do depends on the aggregate function:</p>
${table(['Law', 'Condition', 'Example'], [
  ['γ' + sub('L') + '(R) = γ' + sub('L') + '(δ(R))', '<strong>Only if the aggregates are MIN and/or MAX.</strong> They are duplicate-impervious.', 'MAX(salary): yes. SUM, COUNT, AVG: <strong>no</strong>, γ(R) ≠ γ(δ(R)).'],
  ['δ(γ' + sub('L') + '(R)) = γ' + sub('L') + '(R)', 'Always. Grouping returns one row per group, so its output has no duplicates.', 'The δ on top of a γ can be deleted.'],
  ['γ' + sub('L') + '(R) = γ' + sub('L') + '(π' + sub('M') + '(R))', 'M must contain <strong>at least every attribute of R mentioned in L</strong>.', 'Dropping an attribute that L uses breaks γ.'],
])}
${T('The most common slip: moving δ below a γ whatever the function. SUM over {100, 100} is 200; after δ it is 100. Only MIN and MAX survive duplicate removal. Also: "δ through ∪, −, π" is the exam\'s favourite negative.')}
${K('For every rule on the ' + FS + ' ask two questions. <strong>Is it legal?</strong> (this section). <strong>Is it a good idea?</strong> (next section). The sheet answers neither for you.')}
<p>Game time: decide whether each rewrite is legal. The explanations give the counter-example or the condition.</p>
</div>
${W('u5LegalRule')}` },

    // ------------------------------------------------------------------------------------------------ 6
    { id: 'heuristics', title: 'Heuristics 1 to 5: which rewrite is better (slides 21 and 22)', body: `
<div class="prose">
<p>The laws tell you what is <em>allowed</em>. The five heuristics tell you which direction usually <em>helps</em>. They aim to reduce the number of tuples that travel up the tree and the size of each tuple. A heuristic is greedy: no statistics, no guarantee.</p>
${table(['#', 'Heuristic', 'Law used', 'Why it helps', 'The catch'], [
  ['1', '<strong>Push selections early</strong>: as far down as they go; split an AND and push each piece separately.', 'σ laws (split, push through ×, ⋈, ∪, −, ∩)', 'Fewer rows to operate on early on.', 'Only to the side that has the attributes. A condition on both sides stays and becomes a join (heuristic 5).'],
  ['2', '<strong>Push projections early</strong>: down the tree, or add new ones.', 'π law (introduce π anywhere unused attributes are dropped)', 'Smaller rows: more tuples fit in a block, less data to move.', 'π does not reduce the number of tuples (bags), so a tuple-count cost does not see the gain. Never drop an attribute needed above.'],
  ['3', '<strong>Most restrictive selection and join first</strong>: those that produce the least rows go before the others of their kind.', 'Commutative/associative laws, swapping σ', 'The next operator then reads a small input.', 'You need to know which is the most restrictive. That takes size estimates, which is already cost-based thinking.'],
  ['4', '<strong>Push duplicate elimination conveniently</strong>: move it, or remove it when not needed.', 'δ laws, γ laws', 'δ on a small input is cheaper than on a big one. A δ above γ is useless.', 'Not always down: slide 40 shows pushing δ into both join inputs makes it costlier. Never through ∪, −, π.'],
  ['5', '<strong>Turn σ + × into a join</strong> (equijoin).', 'R ⋈' + sub('c') + ' S = σ' + sub('c') + '(R × S), right to left', 'A join algorithm avoids building the full product.', 'The condition must compare an attribute of each side.'],
])}
<h3>A reasoning checklist for "which plan is better?"</h3>
${steps([
  ['Any product left?', 'A × with a σ above that links its two sides should be a ⋈. A plan that still builds a product is almost always the worst.'],
  ['Selections as low as legally possible?', 'Compare where each σ sits. A σ on a base table beats the same σ on top of a join.'],
  ['Which join runs first?', 'The first join should be the one that produces the smallest result. Associativity lets you choose.'],
  ['Projections?', 'Is every unused attribute dropped early? Same tuple count, narrower tuples.'],
  ['δ placement?', 'A δ at the root is free in the cost. A δ pushed into big inputs costs its output size. Remove δ when the operator below already guarantees no duplicates (γ).'],
  ['Still tied or unsure?', 'Estimate the intermediate sizes and add them (Section 9). The sum decides.'],
])}
${K('Heuristics usually lead to a good plan and a cost comparison confirms it. An answer to "which plan is better?" should name the heuristic AND give sizes when statistics are provided.')}
<p>Rank plans from worst to best, then check against the real sums:</p>
</div>
${W('u5Heuristics')}` },

    // ------------------------------------------------------------------------------------------------ 7
    { id: 'heuristic-examples', title: 'Three worked examples (slides 23 to 25)', body: `
<div class="prose">
<h3>Example I: a query with γ (slide 23)</h3>
${code(M.sc.gamma.sql, 'SQL')}
<p>Statistics invented for the comparison: T(MovieStar) = 2,000, T(StarsIn) = 10,000, V(name) = V(starName) = 2,000. MovieStar and StarsIn have more columns than the query uses.</p>
</div>
${figs([
  [pl(P.g1(), sc.gamma), 'Plan 1: γ over σ over ×. The product alone is 20,000,000 tuples.'],
  [pl(P.g2(), sc.gamma), 'Plan 2: σ + × became ⋈; δ and π added above it.'],
  [pl(P.g3(), sc.gamma), 'Plan 3: δ and π pushed into both inputs of the join.'],
])}
<div class="prose">
${table(['Step', 'Law and heuristic', 'Why it is legal'], [
  ['Plan 1 → 2', 'σ' + sub('name=starName') + ' over × becomes ⋈ (Heuristic 5).', 'R ⋈' + sub('c') + ' S = σ' + sub('c') + '(R × S).'],
  ['… then add δ and π', 'δ (Heuristic 4) and π' + sub('movieYear, birthdate') + ' (Heuristic 2) between γ and ⋈.', 'γ(R) = γ(δ(R)) only because the aggregate is <strong>MAX</strong>. γ(R) = γ(π' + sub('M') + '(R)) because M holds every attribute of L.'],
  ['Plan 2 → 3', 'δ through ⋈: δ(R ⋈ S) = δ(R) ⋈ δ(S). π pushed to each input (Heuristic 2).', 'π keeps the join attribute and what is needed above. The π sits <em>below</em> δ here, which is safe only because MAX ignores duplicates.'],
])}
<p>Costs (sum of intermediate sizes, π and γ add nothing since they keep the tuple count): plan 1 = <span class="num">${ctxt(P.g1(), sc.gamma)}</span>, plan 2 = <span class="num">${ctxt(P.g2(), sc.gamma)}</span>, plan 3 = <span class="num">${ctxt(P.g3(), sc.gamma)}</span>. Plan 3 is best, and the gain from plan 1 to 2 is huge because the product disappears.</p>
${T('Replace MAX by SUM and plans 2 and 3 are <strong>wrong</strong>, not just different. The δ would remove duplicate (year, birthdate) pairs and the sum would shrink. Try it in the rewriter below.')}
<h3>Example II: × and σ (slide 24)</h3>
${code(M.sc.movies.sql, 'SQL')}
</div>
${figs([
  [pl(sc.movies.start(), sc.movies), 'Plan 1: one σ with an AND over the product.'],
  [pl(P.mv2(), sc.movies), 'Plan 2: split the AND, push the LIKE to MovieStar, join on the other condition.'],
])}
<div class="prose">
<p>Steps: split σ${sub('c1 ∧ c2')} (Heuristic 1); only MovieStar has birthdate, so σ goes to MovieStar; the remaining σ${sub('starName=name')} sits directly on a product, so it becomes a join (Heuristic 5). With the statistics shown in the rewriter, plan 1 costs <span class="num">${ctxt(sc.movies.start(), sc.movies)}</span> and plan 2 costs <span class="num">${ctxt(P.mv2(), sc.movies)}</span>.</p>
<h3>Example III: "do it yourself" (slide 25), fully worked</h3>
${code(M.sc.brooklyn.sql, 'SQL (the slide writes account.customer-name; the customer name belongs to depositor)')}
<p>The slide gives only the initial tree and a red arrow from the σ towards <em>branch</em>. Here is the whole answer. Statistics (invented): 50 branches in 10 cities, 10,000 accounts, 12,000 depositor rows. I made attribute names unique so every join is on a shared name: branch(branch_id, branch_city), account(account_id, branch_id), depositor(account_id, customer_name).</p>
</div>
${figs([
  [pl(M.P.bk0(), sc.brooklyn), 'Initial tree. Cost ' + ctxt(M.P.bk0(), sc.brooklyn) + '.'],
  [pl(M.P.bk1(), sc.brooklyn), 'Step 1, Heuristic 1: only branch has branch_city, so σ goes onto branch (the red arrow). Cost ' + ctxt(M.P.bk1(), sc.brooklyn) + '.'],
  [pl(M.P.bk2(), sc.brooklyn), 'Step 2, Heuristic 3: regroup the joins so the 5 Brooklyn branches meet account first. Cost ' + ctxt(M.P.bk2(), sc.brooklyn) + '.'],
  [M.draw(A(bkF(), sc.brooklyn), { wide: true }), 'Step 3, Heuristic 2: add π so each input keeps only needed attributes (see the attribute counts). Same tuple counts, cost ' + ctxt(bkF(), sc.brooklyn) + '.'],
])}
<div class="prose">
${steps([
  ['Push the selection', 'σ' + sub('branch_city=Brooklyn') + ' needs only branch_city, which only branch has. Push it onto branch: 50 rows become 5.'],
  ['Choose the join order', 'The initial tree joins account with depositor first (12,000 rows). Associativity: (branch ⋈ account) ⋈ depositor. The first join now produces 5 × 10,000 / 50 = 1,000 rows, the second 1,000 × 12,000 / 10,000 = 1,200. Legal because the second join condition (account_id) is an attribute of account, which is in the inner pair.'],
  ['Push the projections', 'branch only needs branch_id. After the first join only account_id is needed to join depositor. The last π keeps customer_name.'],
])}
${K('The same 3 ideas in the same order solve almost every "optimize this tree" question: <strong>push σ, order the joins, push π</strong>. Also say <em>why</em> each step is legal (the attribute test) and what it saves.')}
<p>Now do it yourself in the rewriter: choose a scenario, tap a node, apply a rule from the ${FS}. A rule that does not apply tells you why.</p>
</div>
${W('u5Rewrite')}` },

    // ------------------------------------------------------------------------------------------------ 8
    { id: 'cost-based', title: 'Cost-based logical planning (slides 26 to 29)', body: `
<div class="prose">
<h3>The idea (slide 27)</h3>
${steps([
  ['Generate', 'From the query, generate candidate logical plans (using the algebraic laws).'],
  ['Prune', 'Drop plans that are clearly bad (the figure marks some with an X), so the search stays small.'],
  ['Estimate cost', 'Give every remaining plan a cost from the statistics.'],
  ['Select', '<strong>Pick the minimum.</strong>'],
])}
<h3>Rationale (slide 28)</h3>
<p>To generate a physical plan we need the algorithm for each operator, the order of the operations and how arguments are passed. Cost estimation aims to <strong>predict the amount of work</strong> each plan needs, so the most efficient ones are chosen. A cost-based logical planner therefore chooses the logical plan that <strong>minimizes the size of the intermediate relations</strong> formed while executing the query.</p>
<p>Why intermediate sizes? Each intermediate result is produced by one operator and read by the next one. The smaller it is, the less work is spent writing it and reading it again. The base tables are the same in every equivalent plan, and so is the final answer, so only the intermediate results can differ.</p>
<h3>The notation (slide 29)</h3>
${table(['Symbol', 'Meaning'], [
  ['T(R)', 'number of <strong>tuples</strong> in relation R'],
  ['B(R)', 'number of <strong>blocks</strong> that hold R'],
  ['S(R)', 'number of <strong>bytes</strong> each tuple of R occupies'],
  ['V(R, a)', 'number of <strong>distinct values</strong> of attribute a in R'],
])}
<p>The DBMS gathers these statistics from the data. When a formula needs a value you do not have, the slides use fallbacks: DOM(R, a) (the size of the attribute's domain) instead of V, and T/2 or T/3 for inequalities.</p>
${K('All the estimates rest on one assumption: <strong>values are uniformly distributed</strong> (and independent between attributes). With gender, DOM = 2 and T(R) = 100, there are 50 rows per gender. Real data is rarely this even, so these are estimates, not predictions.')}
</div>` },

    // ------------------------------------------------------------------------------------------------ 9
    { id: 'estimates', title: 'Size estimation formulas (slides 30 to 37)', body: `
<div class="prose">
<h3>Projection π (slide 30)</h3>
<p>The bag version of π does <strong>not reduce the number of tuples</strong>. It reduces the <strong>size of each tuple</strong>, so a block holds more of them.</p>
<p>Example from the slide. R(a, b, c): a and b are 4-byte integers, c is a 100-byte string, the tuple header takes 12 bytes. So S(R) = 4 + 4 + 100 + 12 = 120 bytes. Blocks are 1024 bytes with a 24-byte header, so ⌊(1024 − 24) / 120⌋ = 8 tuples fit in one block. With T(R) = 10,000: <strong>B(R) = 10,000 / 8 = 1250</strong>.</p>
<p>Now U = π${sub('a,b')}(R): the tuples are 4 + 4 + 12 = 20 bytes. T(U) is still 10,000, but ⌊1000 / 20⌋ = 50 tuples fit in a block: <strong>B(U) = 10,000 / 50 = 200</strong>.</p>
<h3>Selection σ (slides 31 to 34)</h3>
${table(['Condition', 'Estimate', 'Slide assumption'], [
  ['a = v', '<span class="num">T(R) / V(R, a)</span> (or T(R) / DOM(R, a))', 'uniform distribution over the V (or DOM) values'],
  ['a &lt; v, a &gt; v', '<span class="num">T(R) / 2</span>, or <span class="num">T(R) / 3</span>, or <span class="num">T(R) × f</span>', 'half, one third, or f = (matching part of the range) / (whole range) using MIN and MAX'],
  ['a ≠ v', '<span class="num">T(R) × (1 − 1/V(R, a))</span> ≈ <span class="num">T(R)</span>', 'only one of the V values fails; 1/V is small'],
  ['c1 AND c2', '<span class="num">T(R) × f × g</span>', 'σ' + sub('c1∧c2') + ' = σ' + sub('c1') + '(σ' + sub('c2') + '(R)): a cascade, the fractions multiply'],
  ['c1 OR c2', '<span class="num">T(R) × f + T(R) × g</span>', 'σ' + sub('c1') + '(R) ∪' + sub('s') + ' σ' + sub('c2') + '(R): the slide ADDS the two sizes'],
])}
<p><strong>The range fraction f</strong>, with integer values, min and max known (this is how the model answers write it): the fraction f is cut to 2 decimals and then multiplied.</p>
${table(['Condition', 'f', 'Example (min 40, max 200)'], [
  ['a &gt; v', '(max − v) / (max − min + 1)', 'v = 80: 120 / 161 = 0.745, cut to 0.74'],
  ['a ≥ v', '(max − v + 1) / (max − min + 1)', 'v = 80: 121 / 161 = 0.7516, cut to 0.75. Midterm 6b: 40,000 × 0.75 = 30,000'],
  ['a &lt; v', '(v − min) / (max − min + 1)', 'v = 80: 40 / 161 = 0.248, cut to 0.24'],
  ['a ≤ v', '(v − min + 1) / (max − min + 1)', 'v = 80: 41 / 161 = 0.2546, cut to 0.25'],
])}
${T('<strong>"&gt;" and "≥" use different numerators.</strong> PA 5-2b (σ revenue &gt; 20,000,000, min 300,000, max 4,500,000,000) gives f = 0.9956, which the model answer cuts to 0.99 and 396 tuples (the unrounded value would be 398). The midterm 6b with "≥" uses max − v + 1. Copy the style of the question. The "T/3" fallback for an inequality is used when min and max are not given (PA 5-5 #6).')}
${T('<strong>OR adds, it does not subtract the overlap.</strong> σ a=10 OR b&lt;20 with T = 10,000, V(a) = 50: 200 + 3,333 = 3,533 (slide 39). Do not "fix" it with inclusion-exclusion unless the question asks. Also, <strong>AND with contradicting conditions is 0</strong> (a = 10 AND a &gt; 20): look before multiplying.')}
<h3>Product and join (slide 35)</h3>
${table(['Operation', 'Estimate', 'Comment'], [
  ['R × X', '<span class="num">T(R) × T(X)</span>', 'every pair'],
  ['R ⋈ X on a common attribute d', '<span class="num">T(R) × T(X) / max(V(R, d), V(X, d))</span>', 'for <strong>each</strong> shared attribute divide by its own max(V); with two shared attributes divide twice'],
  ['R ⋈' + sub('θ') + ' X, θ an inequality', '<span class="num">T(R) × T(X) / 3</span>', 'treated as an inequality selection on the product (PA 5-5 #9, midterm 6c); used when the condition is not an equality'],
])}
<p>A join of more than two relations: estimate left to right. R ⋈ S = X first, then X ⋈ U with T(X) as the new size (PA 5-4: 40,000, then 400,000).</p>
${T('Keep the original V(R, a) values in the formulas. PA 5-5 #4 computes σ<sub>c=20</sub>(Y) ⋈ Z as 6 × 400 / max(<strong>50</strong>, 40) = 48. V(Y, d) = 50 stays 50 even though only 6 tuples remain. (If you capped V by the new T you would get 60, a different answer.)')}
<h3>Other operations (slides 36 and 37)</h3>
${table(['Operation', 'Estimate'], [
  ['R ∪ X', '<span class="num">T(R) + T(X)</span>'],
  ['R ∩ X', '<span class="num">min(T(R), T(X)) / 2</span>'],
  ['R − X', '<span class="num">(T(R) − T(X)) / 2</span>'],
  ['δ(R)', '<span class="num">T(R) / 2</span>'],
])}
<p>Try any of them with your own numbers. The calculator shows the formula with your numbers filled in, the way an exam answer should read.</p>
</div>
${W('u5Estimator')}` },

    // ------------------------------------------------------------------------------------------------ 10
    { id: 'cost-examples', title: 'Cost examples and comparing plans (slides 38 to 40)', body: `
<div class="prose">
<h3>Example I (slide 38): AND</h3>
<p>R(a, b, c), T(R) = 10,000, V(R, a) = 50, W = σ${sub('a=10 and b&lt;20')}(R). The selection is a cascade of two simple ones:</p>
<p class="num">T(W) = (T(R) / V(R, a)) × (1/3) = (10,000 / 50) × (1/3) = 200 × 1/3 = <strong>67</strong></p>
<h3>Example II (slide 39): OR</h3>
<p>Same R, W = σ${sub('a=10 or b&lt;20')}(R):</p>
<p class="num">T(σ${sub('a=10')}) = 10,000 / 50 = 200, T(σ${sub('b&lt;20')}) = 10,000 / 3 = 3,333, T(W) = 200 + 3,333 = <strong>3,533</strong></p>
<h3>Example III (slide 40): comparing two plans</h3>
<p>Query: SELECT DISTINCT b FROM R ⋈ S WHERE R.a = 10. Statistics: T(R) = 5000, V(R,a) = 50, V(R,b) = 100; T(S) = 2000, V(S,b) = 200, V(S,c) = 100. The slide compares two plans and <strong>sums the inner nodes</strong>.</p>
</div>
${figs([
  [pl(P.s40a1(), sc.distinct), 'Alternative 1 (left on the slide).'],
  [pl(P.s40a2(), sc.distinct), 'Alternative 2 (right on the slide).'],
])}
<div class="prose">
${table(['Node', 'Alternative 1', 'Alternative 2'], [
  ['σ' + sub('a=10') + '(R)', '5000 / 50 = 100', '5000 / 50 = 100'],
  ['δ(σ(R))', '100 / 2 = 50', ''],
  ['δ(S)', '2000 / 2 = 1000', ''],
  ['join on b', '50 × 1000 / max(100, 200) = 250 (the root: not counted)', '100 × 2000 / max(100, 200) = 1000'],
  ['δ on top', '', '1000 / 2 = 500 (the root: not counted)'],
  ['<strong>Sum of inner nodes</strong>', '<strong>100 + 50 + 1000 = 1150</strong>', '<strong>100 + 1000 = 1100</strong>'],
])}
<p>Alternative 2 is cheaper, even though it pushes δ less. The reason: the inner nodes are what is counted. Alternative 1 adds δ(S) with 1000 tuples and δ(σ(R)) with 50, while alternative 2's single δ is the root.</p>
${K('<strong>Cost = sum of the intermediate results.</strong> Do not count the base tables (leaves): they are identical in every plan. Do not count the root: the final answer is identical in every equivalent plan (here the two roots differ in size only because their duplicate handling is estimated differently). Slide 40 writes "sum inner nodes".')}
${T('Do not put the leaves or the final result into the sum, and do not forget a δ or a σ in the middle. In the course convention a π node adds nothing here, since bag π keeps the tuple count: the exam question will show you which nodes to add.')}
<p>Guess before you look: which plan is cheaper? The sizes appear after you commit.</p>
</div>
${W('u5Compare')}` },

    // ------------------------------------------------------------------------------------------------ 11
    { id: 'takeaways', title: 'Takeaways and exam method (slides 41 to 43)', body: `
<div class="prose">
<h3>The lecture's takeaways</h3>
<ul>
<li>A SQL query goes through <strong>3 translations</strong>: parsing, logical and physical. Parsing is for syntax checking. Logical and physical planning are for optimization and execution.</li>
<li>Even for a simple SQL there are several alternative relational algebra trees, all producing the same result set. One of them is optimal.</li>
<li>Three common heuristics reduce the number of tuples propagated upward from the leaves: <strong>1) push selections down, 2) push projections down, 3) perform the most restrictive joins and selections first.</strong></li>
<li>The engine keeps statistics about each relation and its columns, to pick the tree with the <strong>minimum estimated sum in the internal nodes</strong>.</li>
<li>Next lecture: physical planning.</li>
</ul>
<h3>How the exam asks it (midterm 2025, exercise 6, 15 marks)</h3>
<p>Parts a to d are size estimates ("rely on the estimation rules discussed within class and show your workout"). Part e: <em>give 2 equivalent logical plans along with their plan trees</em> for a π σ over × expression. The ${FS} will be on the paper, the estimation rules will not.</p>
${steps([
  ['Estimates', 'Write the rule, then the numbers, then the result. Check for a contradiction (a = 10 AND a &gt; 20 is 0). Use the range fraction when min and max are given.'],
  ['Two equivalent plans', 'Name the rules you used (from the sheet). Typical pair: σ over ⋈ (turn σ + × into ⋈, keep the selection on top) and σ pushed to the one relation that has its attribute. Draw both trees and label every node.'],
  ['"Which is better?"', 'Say which heuristic the better plan satisfies (push σ, push π, restrictive join first) and, if statistics are given, add up the intermediate sizes.'],
  ['"Is this rewrite legal?"', 'Check the attribute test for σ and θ-joins, the operator list for δ (∪, −, π are out), and the aggregate for γ (only MIN and MAX).'],
])}
<p>Now the practice: <a href="#/m/pa5">Practice Assignment 5</a> works every PA and the 2025 midterm exercise step by step.</p>
</div>` },
  ],
};

// ================================================================================================ PRACTICE ASSIGNMENT 5
export const lab = {
  id: 'pa5', kind: 'lab', num: 'PA5', icon: 'clipboard-text',
  title: 'Practice Assignment 5: Logical planning and size estimation', navTitle: 'PA 5: Logical plans', mapLabel: 'PA 5: plans',
  short: 'Six legal plans for a three-table join, FruitJuice estimates, selection and join estimates, the nine-part estimation exercise, and the 2025 midterm exercise 6.',
  goals: [
    'Enumerate valid logical plans under stated constraints (no ×, selections pushed down, atomic join conditions).',
    'Compute the PA 5-2 to 5-5 estimates with the exact working an exam expects.',
    'Propose two equivalent plans for a query and show which is cheaper.',
    'Solve the 2025 midterm exercise 6 completely.',
  ],
  sections: [
    // ------------------------------------------------------------------------------------------------ 5-1
    { id: 'pa5-1', title: 'Exercise 5-1: six logical plans', body: `
<div class="prose">
${code('SELECT *\nFROM R, S, T\nWHERE R.A = S.A AND R.B = T.B AND T.C = S.C AND R.D = 16 AND S.F = 17', 'The query')}
<p>Give six logical plans that follow three rules: no Cartesian product (×), selections are pushed down, and each join has one <strong>atomic</strong> condition (one equality).</p>
<h3>How to enumerate them</h3>
${steps([
  ['Sort the conditions', 'Two are selections on one table: R.D = 16 (only R has D) and S.F = 17 (only S has F). Push them straight onto R and S. Three are join conditions: R.A = S.A, R.B = T.B, S.C = T.C. They form a triangle R, S, T.'],
  ['Two joins need two conditions', 'Three tables are joined by two joins, and each join takes exactly one atomic condition. So only two of the three join conditions can be used inside joins. A join with two conditions would not be atomic.'],
  ['The third condition', 'The leftover equality links two tables that are already joined, so it becomes a selection <strong>above</strong> the second join. It cannot be pushed lower, because it needs attributes of both inputs below it.'],
  ['Count', '3 choices for which condition is left on top, times 2 orders for the two joins = <strong>6 plans</strong>.'],
])}
</div>
${figs(PA1.map((p, i) => [raw(p), `Plan ${i + 1}`]))}
<div class="prose">
<p>Read the table: the top σ of each pair is the "leftover" condition; the two plans of a pair differ in which join is done first.</p>
${table(['Plans', 'σ on top', 'Joins used', 'First join'], [
  ['1 and 2', 'S.C = T.C (plan 1), R.B = T.B (plan 2)', 'plan 1: R.A = S.A, R.B = T.B; plan 2: R.A = S.A, S.C = T.C', 'R ⋈ S (both)'],
  ['3 and 4', 'S.C = T.C (plan 3), R.A = S.A (plan 4)', 'plan 3: R.B = T.B, R.A = S.A; plan 4: R.B = T.B, S.C = T.C', 'R ⋈ T (both)'],
  ['5 and 6', 'R.B = T.B (plan 5), R.A = S.A (plan 6)', 'plan 5: S.C = T.C, R.A = S.A; plan 6: S.C = T.C, R.B = T.B', 'T ⋈ S (both)'],
])}
${T('A plan like σ' + sub('R.A=S.A ∧ ...') + ' over a product, or a join with two conditions, violates the rules. Also check each σ on R or S really sits on the table that has the attribute: R.D = 16 goes on R, S.F = 17 goes on S, and never the other way round.')}
${K('This is a counting exercise built on one rule: <strong>push σ to the relation that has the attributes</strong>. A condition on two tables is a join condition. Which of the six is cheapest? The question gives no statistics, so no cost can be computed. The size estimates of the next exercises are what you would use.')}
</div>` },

    // ------------------------------------------------------------------------------------------------ 5-2
    { id: 'pa5-2', title: 'Exercise 5-2: FruitJuice, Factory, Loc', body: `
<div class="prose">
<p>Schema: FruitJuice(brand, name, type, sugar), Factory(brand, city, revenue), Loc(city, state). FruitJuice.brand references Factory.brand and Factory.city references Loc.city.</p>
${table(['Statistic', 'Value', 'Statistic', 'Value'], [
  ['T(FruitJuice)', '10,000', 'V(FruitJuice, name)', '8,000'],
  ['T(Factory)', '400', 'V(Factory, city)', '50'],
  ['T(Loc)', '2,000', 'V(Loc, state)', '50'],
  ['V(FruitJuice, brand)', '300', 'V(FruitJuice, type)', '10'],
  ['V(Factory, brand)', '400', 'V(Factory, revenue)', '200'],
  ['V(Loc, city)', '2,000', 'V(FruitJuice, sugar)', '10,000'],
])}
<h3>a) σ${sub('type=mango')}(FruitJuice)</h3>
<p>Equality: <span class="num">T / V = 10,000 / 10 = <strong>1,000</strong></span>.</p>
<h3>b) σ${sub('revenue&gt;20,000,000')}(Factory), min(revenue) = 300,000, max(revenue) = 4,500,000,000</h3>
<p>Inequality with min and max: <span class="num">f = (max − v) / (max − min + 1) = (4,500,000,000 − 20,000,000) / (4,500,000,000 − 300,000 + 1) = 4,480,000,000 / 4,499,700,001 = 0.9956</span>. The model answer cuts f to <strong>0.99</strong>: <span class="num">0.99 × 400 = <strong>396</strong></span>.</p>
${T('The official sheet writes f = 0.99 directly, which hides the cut. Computing f without cutting gives 0.9956 × 400 = 398.2, so 398 is the exact value and 396 is the course\'s answer. If your answer is 398, show the working and the grader should see why. Prefer 396 in line with the model, and state that f was cut to 2 decimals.')}
<h3>c) FruitJuice ⋈ Factory ⋈ Loc</h3>
<p>Two shared attributes, brand (FruitJuice, Factory) and city (Factory, Loc). Divide by the max of the V values of each:</p>
<p class="num">10,000 × 400 × 2,000 / (max(300, 400) × max(50, 2,000)) = 8,000,000,000 / (400 × 2,000) = <strong>10,000</strong></p>
<p>Step by step it is the same: FruitJuice ⋈ Factory = 10,000 × 400 / 400 = 10,000, then ⋈ Loc = 10,000 × 2,000 / 2,000 = 10,000.</p>
<h3>d) Unique banana-juice factories in Cairo with their states: two logical plans</h3>
<p>The result must be unique, so δ is needed on top. Both plans below are correct. Their trees:</p>
</div>
${figs([
  [pl(P.fj1(), FJ), 'Plan 1 (official): δ over σ' + '(type = banana ∧ city = cairo) over the three-way join. Cost ' + ctxt(P.fj1(), FJ) + '.'],
  [pl(P.fj2(), FJ), 'Plan 2 (official): σ pushed to FruitJuice and Factory, then the joins. Cost ' + ctxt(P.fj2(), FJ) + '.'],
])}
<div class="prose">
<p>Both are accepted as the answer to "propose two different plans". But the question "which is better" has a clear answer. In plan 1 the whole joins are computed first (400 and then 10,000 tuples) and only then filtered to 20. In plan 2 the selections are pushed to the relations that have the attributes (type in FruitJuice, city in Factory). FruitJuice shrinks to 1,000, Factory to 8, and every join result is tiny. This is Heuristic 1.</p>
<p>(The official figure leaves out the π that picks the factory and state columns. It would sit on top, keep the tuple count and change no intermediate size.)</p>
${K('For "propose two plans" the safest pair is: the plain translation (σ on top, joins below) and the version with σ pushed down. Label the rule: σ' + sub('c') + '(R ⋈ S) = σ' + sub('c') + '(R) ⋈ S when R has the attributes of c.')}
<p>Guess which is cheaper for this and other equivalent pairs, then compare the sizes:</p>
</div>
${W('u5CompareLab')}` },

    // ------------------------------------------------------------------------------------------------ 5-3
    { id: 'pa5-3', title: 'Exercise 5-3: selections', body: `
<div class="prose">
<p>R(a, b, c), T(R) = 10,000, V(R, a) = 50.</p>
<h3>1) σ${sub('a=10 AND a&gt;20')}(R)</h3>
<p>Contradiction: no value is equal to 10 and greater than 20 at the same time. <strong>T(S) = 0</strong>. Check for this before you multiply anything.</p>
<h3>2) σ${sub('a=10 AND b&lt;20')}(R)</h3>
<p>Cascade: first a = 10, then b &lt; 20 with no min/max, so the 1/3 rule. <span class="num">T / (V(R,a) × 3) = 10,000 / (50 × 3) = <strong>67</strong></span> (66.67).</p>
<h3>3) σ${sub('a=10 OR b&lt;20')}(R)</h3>
<p>Add: <span class="num">T/V + T/3 = 200 + 3,333 = <strong>3,533</strong></span>.</p>
${table(['Part', 'Operator', 'Estimate', 'Result'], [
  ['1', 'AND, contradicting', 'impossible', '0'],
  ['2', 'AND', 'multiply the fractions: 1/50 × 1/3', '67'],
  ['3', 'OR', 'add the sizes: 200 + 3,333', '3,533'],
])}
${T('Part 1 is a trap for students who multiply 1/50 × 1/3 again. Two conditions on the <em>same attribute</em> that exclude each other give an empty result. And in part 3 do not subtract the overlap: the lecture adds.')}
</div>` },

    // ------------------------------------------------------------------------------------------------ 5-4
    { id: 'pa5-4', title: 'Exercise 5-4: natural join of R, S, U', body: `
<div class="prose">
${table(['R(a, b)', 'S(b, c)', 'U(c, d)'], [
  ['T(R) = 1000', 'T(S) = 2000', 'T(U) = 5000'],
  ['V(R, b) = 20', 'V(S, b) = 50', ''],
  ['', 'V(S, c) = 100', 'V(U, c) = 500'],
])}
<p>How many tuples does R ⋈ S ⋈ U return? Work left to right. Let X = R ⋈ S.</p>
<p class="num">T(X) = T(R) × T(S) / max(V(R,b), V(S,b)) = 1000 × 2000 / 50 = <strong>40,000</strong></p>
<p>Then X ⋈ U on c (the shared attribute of X and U; V(X, c) is the original V(S, c) = 100):</p>
<p class="num">T(X) × T(U) / max(V(S,c), V(U,c)) = 40,000 × 5000 / 500 = <strong>400,000</strong></p>
<h3>Does the grouping matter?</h3>
<p>Not for the final result. R ⋈ (S ⋈ U) has the same 400,000 tuples (S ⋈ U = 2000 × 5000 / 500 = 20,000; then ⋈ R on b: 1000 × 20,000 / max(20, 50) = 400,000). But the <em>intermediate</em> result is different: 40,000 for (R ⋈ S), 20,000 for (S ⋈ U). The second grouping is cheaper (Heuristic 3).</p>
${K('Joins are associative, so any grouping gives the same <em>final</em> size. A cost-based planner picks the grouping whose <em>first</em> join is smallest. Check the two groupings in the comparison below (preset "PA 5-4 join order").')}
</div>
${W('u5Compare')}` },

    // ------------------------------------------------------------------------------------------------ 5-5
    { id: 'pa5-5', title: 'Exercise 5-5: nine estimates', body: `
<div class="prose">
${table(['W(a, b)', 'X(b, c)', 'Y(c, d)', 'Z(d, e)'], [
  ['T(W) = 100', 'T(X) = 200', 'T(Y) = 300', 'T(Z) = 400'],
  ['V(W, a) = 20', 'V(X, b) = 50', 'V(Y, c) = 50', 'V(Z, d) = 40'],
  ['V(W, b) = 60', 'V(X, c) = 100', 'V(Y, d) = 50', 'V(Z, e) = 100'],
])}
${table(['#', 'Expression', 'Working', 'Answer'], [
  ['1', 'W ⋈ X ⋈ Y ⋈ Z', '100 × 200 × 300 × 400 / (max(60,50) × max(100,50) × max(50,40)) = 2,400,000,000 / (60 × 100 × 50)', '<strong>8,000</strong>'],
  ['2', 'σ' + sub('a=10') + '(W)', 'T(W) / V(W,a) = 100 / 20', '<strong>5</strong>'],
  ['3', 'σ' + sub('c=20') + '(Y)', 'T(Y) / V(Y,c) = 300 / 50', '<strong>6</strong>'],
  ['4', 'σ' + sub('c=20') + '(Y) ⋈ Z', '6 × 400 / max(V(Y,d), V(Z,d)) = 2,400 / max(50, 40)', '<strong>48</strong>'],
  ['5', 'W × Y', '100 × 300', '<strong>30,000</strong>'],
  ['6', 'σ' + sub('d&gt;10') + '(Z)', 'inequality, no min/max given: 400 / 3', '<strong>133</strong>'],
  ['7', 'σ' + sub('a=1 AND b=2') + '(W)', '100 / (20 × 60) = 0.083', '<strong>≈ 0</strong> (the PA writes 0)'],
  ['8', 'σ' + sub('a=1 AND b&gt;2') + '(W)', '100 / (20 × 3) = 1.67', '<strong>2</strong>'],
  ['9', 'X ⋈' + sub('X.c&lt;Y.c') + ' Y', 'inequality join: 200 × 300 / 3', '<strong>20,000</strong>'],
])}
${T('#7: the exact value is 0.083 tuples and the PA rounds it to 0. A size below 1 means "expect no tuples", so 0 is accepted, but writing 0.083 and then "≈ 0" is the safe way. #1 uses <em>all three</em> shared attributes (b, c, d): forget one and the answer is off by that factor. #4: the σ is applied first (6 tuples), the original V(Y,d) = 50 is still used in the join.')}
<p>Type your answers to all of the PA questions and the midterm ones, one at a time. Each wrong answer shows the working.</p>
</div>
${W('u5Drill')}` },

    // ------------------------------------------------------------------------------------------------ midterm
    { id: 'pa5-mid', title: 'Midterm 2025, exercise 6 (15 marks)', body: `
<div class="prose">
<p>Statistics for R(a, b, c) and S(c, d):</p>
${table(['R', 'S'], [['T(R) = 40,000', 'T(S) = 80,000'], ['V(R, a) = 2000, V(R, b) = 4, V(R, c) = 20,000', 'V(S, c) = 40,000, V(S, d) = 2000'], ['max(a) = 200, min(a) = 40', '']])}
${steps([
  ['a) σ' + sub('a=4') + '(R)', 'Equality: T(R) / V(R, a) = 40,000 / 2000 = <strong>20</strong>.'],
  ['b) σ' + sub('a≥80') + '(R)', 'Range with min and max: f = (max − v + 1) / (max − min + 1) = (200 − 80 + 1) / (200 − 40 + 1) = 121 / 161 = 0.7516, cut to 0.75. T(R) × f = 40,000 × 0.75 = <strong>30,000</strong>.'],
  ['c) R ⋈' + sub('b&gt;80') + ' S', 'Inequality (θ) join: T(R) × T(S) / 3 = 40,000 × 80,000 / 3 = <strong>1,066,666,667</strong>.'],
  ['d) δ(S)', 'T(S) / 2 = 80,000 / 2 = <strong>40,000</strong>.'],
])}
${T('The "≥ 80" in part b makes the numerator max − v + 1 = 121. Using max − v = 120 (the "&gt;" form) gives 120/161 = 0.745 and 29,800. Part c as printed joins on b &gt; 80, an attribute S does not have: the model answer just applies the θ-join rule T(R) × T(S) / 3, so do the same and do not get stuck on the schema.')}
<h3>e) Two equivalent plans for π${sub('a,d')}(σ${sub('r.c=s.c ∧ d=5')}(R × S))</h3>
<p>The expression is a product, an AND of two conditions, and a projection. Plan trees (the official answer, with sizes added from the statistics):</p>
</div>
${figs([
  [pl(P.mt0(), sc.midterm), 'The expression as written: σ over ×. Cost ' + ctxt(P.mt0(), sc.midterm) + '.'],
  [pl(P.mt1(), sc.midterm), 'Official plan 1: π(σ d = 5 (R ⋈ S)). Cost ' + ctxt(P.mt1(), sc.midterm) + '.'],
  [pl(P.mt2(), sc.midterm), 'Official plan 2: π(R ⋈ σ d = 5 (S)). Cost ' + ctxt(P.mt2(), sc.midterm) + '.'],
])}
<div class="prose">
<p>How each plan comes from the expression, naming the sheet rules:</p>
${steps([
  ['Plan 1', 'σ' + sub('r.c=s.c') + ' over × becomes a join: R ⋈' + sub('c') + ' S = σ' + sub('c') + '(R × S) (right to left). The condition d = 5 stays above the join: σ' + sub('d=5') + '(R ⋈ S).'],
  ['Plan 2', 'Split the AND: σ' + sub('c1∧c2') + ' = σ' + sub('c1') + '(σ' + sub('c2') + '(R × S)). Push σ' + sub('d=5') + ' to S: <strong>only S has attribute d</strong>, so σ(R × S) = R × σ(S), and then the remaining σ turns × into ⋈.'],
])}
<p>Which is better? Plan 2: Heuristic 1. With the statistics the join input from S shrinks from 80,000 to 40 tuples, so the join result is 40 instead of 80,000 and the plan costs <span class="num">${ctxt(P.mt2(), sc.midterm)}</span> instead of <span class="num">${ctxt(P.mt1(), sc.midterm)}</span>. The exam asked only for two <em>equivalent</em> plans, and both qualify, but a strong answer adds the one-line reason.</p>
${T('A common wrong plan: pushing σ' + sub('d=5') + ' to R. R(a, b, c) has no d, so that plan is not even legal. Also do not leave a × in the answer: a σ with a condition on both sides directly over a × must become a ⋈.')}
<p>Try the rewriter on this exact expression. Follow the route above and watch the cost go from 3.2 billion to 80:</p>
</div>
${W('u5Rewrite')}` },

    // ------------------------------------------------------------------------------------------------ tips
    { id: 'pa5-tips', title: 'What the exam asks', body: `
<div class="prose">
${table(['Question type', 'What to write', 'Marks are lost when'], [
  ['Size of σ, ⋈, ∪, δ ...', 'The formula with the numbers in it, then the result.', 'You give only a number, use the wrong V, or forget a contradiction (answer 0).'],
  ['Range selection', 'f from min/max, cut to 2 decimals, × T.', '"&gt;" and "≥" mixed up; f not shown.'],
  ['Multi-way join', 'Left to right, one max(V) for each shared attribute, new T for the next join.', 'A shared attribute is left out.'],
  ['Two equivalent plans', 'Two trees with every node labelled, and the rule names.', 'A σ is pushed to a relation without the attribute, or a × remains.'],
  ['Which plan is better', 'The heuristic and the sums of intermediate sizes.', 'Leaves or the root are added to the sum.'],
  ['Is this rewrite legal', 'The condition: attribute test (σ, θ-join), operator (δ through ∪, −, π is out), aggregate (γ with MIN/MAX only).', 'You answer "yes" because the sheet shows a similar-looking rule.'],
])}
${K('The exam gives you the equivalence rules (' + FS + '). It does not say <em>which</em> side of a rule is better and it does not give the size formulas. Practise both: use a rule correctly, and justify the choice.')}
<p>Come back to the <a href="#/m/l5">lecture simulators</a> (rewriter, comparison, legality game, heuristics ranking) for more practice, and to the question bank for mixed questions.</p>
</div>` },
  ],
};

// ================================================================================================ QUESTIONS
const Q = (id, m, q, o, why) => ({ id, m, q, o, why });
export const questions = [
  // ---- lecture
  Q('l5-1', 'l5', 'Which component of the query processor turns a <strong>valid parse tree</strong> into an initial relational algebra tree?',
    ['The logical query plan generator', 'The parser', 'The preprocessor', 'The physical plan generator'],
    'The parser builds the parse tree (syntax), the preprocessor checks names and types, then the logical plan generator produces the first algebra tree. The rewriter then improves it. The physical generator comes after logical planning.'),
  Q('l5-2', 'l5', 'A query is rejected because the table named in FROM does not exist. Which stage catches it?',
    ['The preprocessor (semantic checks against the catalog)', 'The parser, while building the parse tree', 'The logical plan generator', 'The physical plan generator'],
    'The parser knows only grammar. Whether a relation or attribute exists is a semantic check done by the preprocessor, before any optimization.'),
  Q('l5-3', 'l5', 'Which decision is part of <strong>physical</strong> planning, not logical planning?',
    ['Reading MovieStar with an index scan instead of a table scan', 'Pushing σ below a join', 'Turning σ over × into a join', 'Moving δ from the root to the join inputs'],
    'Choosing algorithms and access paths (table scan, index scan, hash join) is physical planning. The other three are algebraic rewrites between equivalent trees: logical planning.'),
  Q('l5-4', 'l5', 'Which of the three optimization questions is "how should operators pass data to each other: pipelined, in main-memory buffers, or via the disk"?',
    ['Buffer management', 'The logical plan', 'The physical plan', 'The parse tree'],
    'Slide 8: logical plan (which equivalent form), physical plan (which algorithm for each operation), buffer management (how data moves between operations).'),
  Q('l5-5', 'l5', 'Which is NOT typical metadata the optimizer uses to make its choices?',
    ['The text of earlier queries by the same user', 'The size of each relation', 'Whether certain indexes exist', 'Statistics such as V(R, a)'],
    'The slide lists: size of each relation, statistics, existence of indexes, layout of data on disk.'),
  Q('l5-6', 'l5', 'What is true about heuristic-based logical planning compared with cost-based?',
    ['It applies greedy rewrite rules, is limited, and does not always give the optimal plan', 'It estimates every plan with statistics and always picks the cheapest', 'It chooses the physical algorithms', 'It needs no algebraic laws'],
    'Heuristic planning applies greedy rules with the algebraic laws. Cost-based planning estimates each plan and selects the cheapest. Neither chooses physical algorithms.'),
  Q('l5-7', 'l5', 'R(a, b) and S(b, c), joined on b. Which rewrite is <strong>legal</strong>?',
    ['σ<sub>a=10</sub>(R ⋈ S) → σ<sub>a=10</sub>(R) ⋈ S', 'σ<sub>c=5</sub>(R ⋈ S) → σ<sub>c=5</sub>(R) ⋈ S', 'σ<sub>a=c</sub>(R ⋈ S) → σ<sub>a=c</sub>(R) ⋈ S', 'σ<sub>a=10</sub>(R ⋈ S) → R ⋈ σ<sub>a=10</sub>(S)'],
    'A selection goes to the relation that has the attributes of its condition. Only R has a, so σ a=10 can go to R. c is only in S, and a = c needs both sides, so neither can take it.'),
  Q('l5-8', 'l5', 'For which operator is the rewrite δ(R op S) → δ(R) op δ(S) <strong>not</strong> valid?',
    ['Bag union ∪<sub>B</sub>', 'Natural join ⋈', 'Product ×', 'Join with a condition ⋈<sub>c</sub>'],
    'δ can be pushed through ×, ⋈ and ⋈c, but not through ∪B, −B or π. R = {1} and S = {1}: δ(R ∪B S) = {1} but δ(R) ∪B δ(S) = {1, 1}.'),
  Q('l5-9', 'l5', 'γ<sub>dept, SUM(salary)</sub>(R) is rewritten as γ<sub>dept, SUM(salary)</sub>(δ(R)). This is:',
    ['Not valid: SUM sees every duplicate, only MIN and MAX are duplicate-impervious', 'Valid for every aggregate function', 'Valid because δ(γ(R)) = γ(R)', 'Valid only if there is a GROUP BY'],
    'Duplicates change SUM, COUNT and AVG. Two identical rows with salary 100 add to 200; after δ only 100. For MIN and MAX duplicates do not matter.'),
  Q('l5-10', 'l5', 'Which expression is <strong>not</strong> equivalent to (R ⋈<sub>R.b&gt;S.b</sub> S) ⋈<sub>a&lt;d</sub> T when a is an attribute of R and d of T?',
    ['R ⋈<sub>R.b&gt;S.b</sub> (S ⋈<sub>a&lt;d</sub> T)', '(S ⋈<sub>R.b&gt;S.b</sub> R) ⋈<sub>a&lt;d</sub> T', 'T ⋈<sub>a&lt;d</sub> (R ⋈<sub>R.b&gt;S.b</sub> S)', 'σ<sub>a&lt;d</sub>((R ⋈<sub>R.b&gt;S.b</sub> S) × T)'],
    'θ-joins are not always associative. In the first expression S ⋈ T would need R.a, but R is not one of its inputs. The others only commute the operands or write the join as σ over ×.'),
  Q('l5-11', 'l5', 'σ<sub>c</sub>(R ∪ S) is equivalent to:',
    ['σ<sub>c</sub>(R) ∪ σ<sub>c</sub>(S)', 'σ<sub>c</sub>(R) ∪ S', 'σ<sub>c</sub>(R) − S', 'σ<sub>c</sub>(R) ∩ σ<sub>c</sub>(S)'],
    'For a union the selection must reach both sides. Leaving S unfiltered would keep its tuples that fail c.'),
  Q('l5-12', 'l5', 'σ<sub>c1 ∨ c2</sub>(R) can be rewritten as:',
    ['σ<sub>c1</sub>(R) ∪<sub>s</sub> σ<sub>c2</sub>(R)', 'σ<sub>c1</sub>(σ<sub>c2</sub>(R))', 'σ<sub>c1</sub>(R) ∩ σ<sub>c2</sub>(R)', 'σ<sub>c1</sub>(R) × σ<sub>c2</sub>(R)'],
    'A cascade of σ is an AND. An OR is the (set) union of the two separate selections.'),
  Q('l5-13', 'l5', 'Heuristic 5 says to turn σ combined with × into:',
    ['An equijoin, which is generally much more efficient to evaluate', 'A projection, to shrink the tuples', 'A union of two selections', 'A cascade of selections'],
    'σ_c(R × S) = R ⋈_c S, applied right to left, because a join is much faster than building the product and then filtering.'),
  Q('l5-14', 'l5', 'What does pushing a projection down the tree (Heuristic 2) reduce?',
    ['The size of each tuple, so more tuples fit in a block (the tuple count is unchanged)', 'The number of tuples (bag π removes duplicates)', 'The number of join operations', 'The number of selections'],
    'Bag π does not reduce T(R); it reduces S(R). That is also why a tuple-count cost does not show the gain.'),
  Q('l5-15', 'l5', 'T(R) = 10,000 tuples of 60 bytes each (header included), blocks of 1024 bytes with a 24-byte header. What is B(R)?',
    ['625', '589', '600', '167'],
    '⌊(1024 − 24) / 60⌋ = ⌊16.67⌋ = 16 tuples per block, so B = 10,000 / 16 = 625. Forgetting the header gives ⌊1024/60⌋ = 17 and 589. Forgetting to round down gives 600.'),
  Q('l5-16', 'l5', 'T(R) = 5000, V(R, a) = 50. Estimated size of σ<sub>a=10</sub>(R)?',
    ['100', '50', '1,667', '4,950'],
    'Equality: T / V = 5000 / 50 = 100. 4,950 would be the "a ≠ 10" style estimate T(1 − 1/V) = 4,900, and 1,667 is T/3.'),
  Q('l5-17', 'l5', 'T(R) = 2000, min(a) = 0, max(a) = 99. Estimate σ<sub>a≥60</sub>(R) the way the model answers do.',
    ['800', '780', '1,333', '1,000'],
    'f = (max − v + 1) / (max − min + 1) = (99 − 60 + 1) / (99 − 0 + 1) = 40 / 100 = 0.4, so 2000 × 0.4 = 800. With "&gt;" the numerator would be 99 − 60 = 39 (780). 1,333 is the wrong T/3 rule.'),
  Q('l5-18', 'l5', 'T(R) = 10,000, V(R, a) = 50. Estimated size of σ<sub>a=10 OR b&lt;20</sub>(R) according to the lecture?',
    ['3,533', '67', '3,466', '3,333'],
    'OR adds the two estimates: 10,000/50 + 10,000/3 = 200 + 3,333 = 3,533. 67 is the AND answer, and 3,466 would subtract the overlap, which the lecture does not do.'),
  Q('l5-19', 'l5', 'T(R) = 1000, T(S) = 500, V(R,b) = 100, V(S,b) = 25. Estimated size of R ⋈ S on b?',
    ['5,000', '20,000', '500,000', '12,500'],
    'T(R) × T(S) / max(V(R,b), V(S,b)) = 1000 × 500 / 100 = 5,000. Dividing by min instead gives 20,000, and 500,000 is the product.'),
  Q('l5-20', 'l5', 'T(R) = 600, T(S) = 200. Which estimate is <strong>wrong</strong> by the lecture formulas?',
    ['R ∪ S = 400', 'R ∩ S = 100', 'R − S = 200', 'δ(R) = 300'],
    'Union is the sum, 800. Intersection is min / 2 = 100, difference is (600 − 200) / 2 = 200, δ is T / 2 = 300.'),
  Q('l5-21', 'l5', 'What does the lecture\'s <em>cost</em> of a logical plan add up (slide 40)?',
    ['The sizes of the intermediate results (inner nodes)', 'The sizes of all the nodes, leaves and root included', 'Only the size of the final result', 'The number of operators in the tree'],
    'Cost-based planners choose the plan that minimizes the size of the intermediate relations. The base tables and the final answer are the same for all equivalent plans, so they are left out.'),
  Q('l5-22', 'l5', 'Slide 40: alternative 1 pushes δ below the join and costs 100 + 50 + 1000 = 1150. Alternative 2 has one δ on top and costs 1100. What is the lesson?',
    ['Pushing δ down is not always better: a heuristic needs the numbers to confirm it', 'δ should always stay at the root', 'Alternative 1 is not equivalent to alternative 2', 'Joins should never be done before δ'],
    'Both plans are equivalent. Alternative 1 pays for two extra intermediate δ results (50 and 1000); alternative 2\'s only δ is the root. Heuristic 4 means "convenient position", not "always down".'),
  Q('l5-23', 'l5', 'Why are the rules R ⋈<sub>c</sub> S = σ<sub>c</sub>(R × S) usually applied right to left?',
    ['A join is much faster than a product followed by a selection on large tables', 'The left side is not a valid expression', 'A product returns fewer tuples than a join', 'It is the only direction that preserves duplicates'],
    'Both directions are equivalent. The planner goes from σ(R × S) to R ⋈ S to avoid building the huge product (3.2 billion tuples in the midterm example).'),
  Q('l5-24', 'l5', 'A planner builds many equivalent plans, drops obviously bad ones, estimates the rest and takes the minimum. This is:',
    ['Cost-based logical planning (generate, prune, estimate, pick min)', 'Pure heuristic planning', 'Physical planning', 'Buffer management'],
    'The "Generate, Pruning, Estimate Cost, Select: Pick Min" figure of slide 27 describes cost-based logical planning.'),
  // ---- practice assignment
  Q('pa5-1', 'pa5', 'In PA 5-1 (R, S, T with three join conditions and no ×, one atomic condition per join), why can one of the three join conditions never be used inside a join?',
    ['Two joins take two atomic conditions, so the third becomes a σ above the second join', 'Because it is a selection on one table', 'Because it uses an attribute that does not exist', 'Because the optimizer forbids more than one σ'],
    'Three tables need two joins, each with one atomic condition. The leftover equality compares attributes of tables already joined, so it stays as a selection on top.'),
  Q('pa5-2', 'pa5', 'How many logical plans does PA 5-1 ask for, and what generates the count?',
    ['6: 3 choices for the condition left on top times 2 orders of the two joins', '3: one per join condition', '2: R ⋈ S first or T first', '9: every join condition with every table'],
    'Choose which of the three join conditions becomes the σ above (3), then the two remaining joins can be done in two orders (2): 3 × 2 = 6.'),
  Q('pa5-4', 'pa5', 'PA 5-2a: T(FruitJuice) = 10,000, V(FruitJuice, type) = 10. Estimate σ<sub>type=mango</sub>.',
    ['1,000', '100', '3,333', '10,000'],
    'Equality: T / V = 10,000 / 10 = 1,000.'),
  Q('pa5-5', 'pa5', 'PA 5-2b: T(Factory) = 400, revenue range 300,000 to 4,500,000,000, σ<sub>revenue&gt;20,000,000</sub>. What does the model answer give?',
    ['396, with f = 0.99', '133, with the T/3 rule', '200, with T/2', '8, with T/V'],
    'f = (max − v) / (max − min + 1) = 0.9956, cut to 0.99. 0.99 × 400 = 396. Min and max are given, so the T/3 and T/2 fallbacks are not used.'),
  Q('pa5-6', 'pa5', 'PA 5-2c: FruitJuice (10,000) ⋈ Factory (400) ⋈ Loc (2,000), V(FJ,brand) = 300, V(F,brand) = 400, V(F,city) = 50, V(Loc,city) = 2,000. Size?',
    ['10,000', '8,000,000,000', '16,000', '400'],
    '10,000 × 400 × 2,000 / (max(300,400) × max(50,2000)) = 8e9 / 800,000 = 10,000. Each join divides by the max of its own shared attribute.'),
  Q('pa5-7', 'pa5', 'PA 5-2d (banana juice in Cairo, unique). Why is the plan with σ<sub>type=banana</sub> on FruitJuice and σ<sub>city=cairo</sub> on Factory better than the plan with both σ on top?',
    ['Heuristic 1: the joins then work on 1,000 and 8 tuples instead of building 10,000 first', 'It removes the need for δ', 'It uses fewer joins', 'It changes the answer to a smaller set'],
    'Both plans are equivalent. With σ pushed down the intermediate results are about 1,036 in total instead of about 10,420. Pushing a σ to the relation that has the attribute never changes the result.'),
  Q('pa5-8', 'pa5', 'PA 5-3 #1: σ<sub>a=10 AND a&gt;20</sub>(R) with T(R) = 10,000, V(R,a) = 50. The estimate is:',
    ['0, the conditions contradict each other', '67', '200', '3,533'],
    'No value of a is both 10 and greater than 20. Do not multiply the fractions: the answer is empty.'),
  Q('pa5-9', 'pa5', 'PA 5-3 #2: σ<sub>a=10 AND b&lt;20</sub>(R), T(R) = 10,000, V(R,a) = 50. Estimate?',
    ['67', '3,533', '200', '3,333'],
    'AND multiplies: 10,000 / 50 × 1/3 = 66.67 ≈ 67.'),
  Q('pa5-11', 'pa5', 'In PA 5-4, (R ⋈ S) ⋈ U and R ⋈ (S ⋈ U) both give 400,000 tuples. Which is cheaper by the sum of intermediates, and why?',
    ['R ⋈ (S ⋈ U): its first join gives 20,000, against 40,000', '(R ⋈ S) ⋈ U: it is written left to right', 'They cost the same, since the final result is the same', 'R ⋈ (S ⋈ U): it uses fewer joins'],
    'The final size is the same, but the intermediate result differs: S ⋈ U = 2000 × 5000 / 500 = 20,000 while R ⋈ S = 40,000. Heuristic 3: do the more restrictive join first.'),
  Q('pa5-12', 'pa5', 'PA 5-5 #4: σ<sub>c=20</sub>(Y) ⋈ Z, T(Y) = 300, V(Y,c) = 50, V(Y,d) = 50, T(Z) = 400, V(Z,d) = 40. Size?',
    ['48', '60', '6', '2,400'],
    'σ gives 6 tuples. Join: 6 × 400 / max(50, 40) = 2,400 / 50 = 48. V(Y, d) keeps its original value 50 even though only 6 tuples remain.'),
  Q('pa5-13', 'pa5', 'PA 5-5 #9: X(T = 200) ⋈<sub>X.c&lt;Y.c</sub> Y(T = 300). The estimate is:',
    ['20,000', '60,000', '300', '12'],
    'The condition is an inequality, so the join counts one third of the pairs: 200 × 300 / 3 = 20,000.'),
  Q('pa5-14', 'pa5', 'Midterm 2025 6b: σ<sub>a≥80</sub>(R), T(R) = 40,000, min(a) = 40, max(a) = 200. Result?',
    ['30,000', '29,800', '20', '13,333'],
    'f = (200 − 80 + 1) / (200 − 40 + 1) = 121/161 = 0.7516, cut to 0.75. 40,000 × 0.75 = 30,000. With max − v only you would get 120/161 = 0.745 and 29,800.'),
  Q('pa5-15', 'pa5', 'Midterm 2025 6c: R ⋈<sub>b&gt;80</sub> S with T(R) = 40,000, T(S) = 80,000. Estimate:',
    ['1,066,666,667', '3,200,000,000', '120,000', '40,000'],
    'A non-equality join condition is estimated as T(R) × T(S) / 3 = 3.2e9 / 3 = 1,066,666,667.'),
  Q('pa5-17', 'pa5', 'Midterm 2025 6e: π<sub>a,d</sub>(σ<sub>r.c=s.c ∧ d=5</sub>(R × S)), R(a,b,c), S(c,d). Where may σ<sub>d=5</sub> be pushed?',
    ['Onto S only, because only S has attribute d', 'Onto R, because R is the left input', 'Onto either R or S', 'Onto neither: it must stay above the product'],
    'A selection goes to the relation that has its attributes. d is in S only. The other condition r.c = s.c compares both sides: that is the join condition.'),
  Q('pa5-18', 'pa5', 'In the midterm 6e statistics, which plan is cheaper: π(σ<sub>d=5</sub>(R ⋈ S)) or π(R ⋈ σ<sub>d=5</sub>(S))?',
    ['The second: σ(S) has 40 tuples, so the join gives 40 instead of 80,000', 'The first: the join runs before the selection', 'They are equal since both are correct plans', 'The first: it has fewer operators'],
    'Join of R and S on c is 40,000 × 80,000 / 40,000 = 80,000 tuples; σ d=5 on S first gives 80,000 / 2000 = 40 tuples and a 40-tuple join. Costs about 80,040 vs 80.'),
  Q('pa5-20', 'pa5', 'Which statement about the exam is correct?',
    ['The formula sheet gives the equivalence rules but does not say which rewrite is more optimal', 'The sheet also gives the size estimation formulas', 'The sheet says which rewrite is better in each case', 'No sheet is provided for logical planning'],
    'The email says the sheet has the relational algebra equivalence rules (slides 14 to 20) and the B+ tree thresholds, with no guidance on which substitution is more optimal. The size formulas must be known.'),
];

// ================================================================================================ GLOSSARY
export const glossary = [
  ['Query processor', 'The group of DBMS components that turns queries and data-modification commands into a sequence of database operations and executes them.', 'l5'],
  ['Parser', 'Checks the syntax of the SQL and builds the parse tree. Parsing is only for syntax.', 'l5'],
  ['Preprocessor', 'Semantic checks against the catalog (relations, attributes, types, views). Produces a valid parse tree.', 'l5'],
  ['Parse tree', 'Tree of non-terminals (&lt;Query&gt;, &lt;Condition&gt;, ...) and atoms (keywords, names, constants) for a SQL query.', 'l5'],
  ['Logical query plan', 'A relational algebra tree: what to compute (σ, π, ×, ⋈, δ, γ), without algorithms.', 'l5'],
  ['Physical query plan', 'A logical plan with an algorithm for each operator, the execution order, access paths and sorting.', 'l5'],
  ['Query rewriter', 'Transforms the initial logical plan into an equivalent plan expected to run faster, using the algebraic laws.', 'l5'],
  ['Buffer management', 'How operators pass data to each other: pipelined, in memory buffers, or via the disk.', 'l5'],
  ['Heuristic-based planning', 'Greedy rewriting with algebraic rules (push σ, push π, ...). Fast, limited, not always optimal.', 'l5'],
  ['Cost-based planning', 'Generate candidate plans, prune, estimate each with statistics, pick the minimum.', 'l5'],
  ['Formula sheet rules', 'The equivalence laws of slides 14 to 20, provided at the exam. They do not say which side is better.', 'l5'],
  ['Duplicate-impervious', 'An aggregate that ignores duplicates: MIN and MAX. For them γ(R) = γ(δ(R)).', 'l5'],
  ['θ-join', 'A join with a condition that is not an equality (for example R.b &gt; S.b). Estimated as T(R) T(S) / 3. Not always associative.', 'l5'],
  ['Equijoin', 'A join on equality of attributes. R ⋈<sub>c</sub> S = σ<sub>c</sub>(R × S).', 'l5'],
  ['Atomic join condition', 'A single equality attached to one join (PA 5-1).', 'pa5'],
  ['T(R)', 'Number of tuples of R.', 'l5'],
  ['B(R)', 'Number of blocks holding R.', 'l5'],
  ['S(R)', 'Number of bytes of one tuple of R.', 'l5'],
  ['V(R, a)', 'Number of distinct values of attribute a in R. Uniform distribution assumed.', 'l5'],
  ['Range fraction f', 'Share of the value range a selection keeps, from min and max. For "&gt;": (max − v)/(max − min + 1); for "≥": (max − v + 1)/(max − min + 1). Cut to 2 decimals in the model answers.', 'l5'],
  ['Intermediate result', 'Output of an inner node of the plan tree. Plan cost is the sum of their sizes, leaves and root excluded.', 'l5'],
  ['Plan cost (slide 40)', 'Sum of the estimated sizes of the inner nodes of a logical plan. The cheaper plan wins.', 'l5'],
  ['Contradicting conditions', 'An AND such as a = 10 AND a &gt; 20 gives 0 tuples. Check before multiplying fractions.', 'pa5'],
];

// ================================================================================================ CHEAT SHEET
export const cheat = [
  ['l5', 'Query processor pipeline', [
    'SQL → parser (syntax, parse tree) → preprocessor (semantics) → logical plan generator → query rewriter → physical plan → execution.',
    'Logical = algebra tree, which equivalent form. Physical = algorithms, access paths. Buffer management = how data moves between operators.',
    'Metadata: relation sizes, statistics, indexes, layout on disk.',
  ]],
  ['l5', 'Is the rewrite legal?', [
    'σ goes to the relation that has the attributes. A condition on both sides stays (join condition).',
    'σ over ∪: push to both sides. σ over −: the left side must get it.',
    'δ: through ×, ⋈, σ, ∩B yes. Through ∪B, −B, π NO.',
    'γ: δ below γ only for MIN and MAX. δ(γ) = γ. π below γ must keep all of L.',
    'θ-joins are not always associative: the moved condition may only use attributes of the pair it joins.',
  ]],
  ['l5', 'Heuristics: which rewrite is better', [
    '1 Push σ early (split AND). 2 Push π early (narrower tuples). 3 Most restrictive σ and ⋈ first.',
    '4 Place δ conveniently (not always down). 5 σ over × becomes ⋈.',
    'Cost-based: add the intermediate sizes (not leaves, not the root). Smallest sum wins.',
  ]],
  ['l5', 'Size estimates', [
    'σ a=v: T/V. ≠: T(1 − 1/V) ≈ T. Inequality: T/3 (or T/2), or T × f with min/max.',
    'f: ">" (max − v)/(max − min + 1); "≥" (max − v + 1)/(max − min + 1); cut to 2 decimals.',
    'AND: multiply. OR: add (slide). Contradiction: 0.',
    '× : T(R)T(S). ⋈: T(R)T(S)/max(V) for each shared attribute. θ-join: T(R)T(S)/3.',
    '∪: T(R)+T(S). ∩: min/2. −: (T(R) − T(S))/2. δ: T/2. π: same T, smaller tuples, B = T / ⌊(block − header)/tuple⌋ rounded up.',
  ]],
  ['pa5', 'PA 5 numbers to know', [
    '5-2: 1,000; 396 (f cut to 0.99); 10,000; plans with σ pushed cost far less.',
    '5-3: 0 (contradiction), 67, 3,533. 5-4: 40,000 then 400,000.',
    '5-5: 8,000, 5, 6, 48, 30,000, 133, ≈ 0, 2, 20,000.',
    '2025 midterm 6: 20; 30,000; 1,066,666,667; 40,000; two plans (σ over ⋈, or σ d=5 pushed to S).',
  ]],
];
