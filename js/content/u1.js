import { K, T, W, terms, compare, steps, code, table } from './helpers.js';

const stp = list => steps(list.map(([h, p]) => [h, p.replace(/<strong>/g, '<b>').replace(/<\/strong>/g, '</b>')]));
// ---------------------------------------------------------------- static figures (inline SVG, theme aware)
const FSTY = `<style>.f1 text{font-family:var(--font);font-size:13px;fill:var(--ink)}.f1 .s{font-size:11px;fill:var(--muted)}.f1 .b{fill:var(--surface);stroke:var(--ink-2);stroke-width:1.3}.f1 .b2{fill:var(--accent-soft);stroke:var(--accent-viz);stroke-width:1.5}.f1 .l{stroke:var(--muted);stroke-width:1.3;fill:none}.f1 .hatch{fill:var(--sunken);stroke:var(--line-strong)}.f1 .ring{fill:none;stroke:var(--ink-2);stroke-width:1}.f1 .sec{stroke:var(--accent-viz);stroke-width:2}</style>`;
const box = (x, y, w, h, t, c = 'b', s = '') => `<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/><text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle">${t}</text>${s ? `<text class="s" x="${x + w / 2}" y="${y + h / 2 + 19}" text-anchor="middle">${s}</text>` : ''}`;
const ARCH = `<svg class="viz f1" viewBox="0 0 640 352" width="100%" style="max-width:640px" role="img" aria-label="RDBMS architecture: query processor, transaction manager with scheduler, log manager, buffer manager, recovery manager, data files and log">${FSTY}
<defs><marker id="ah1" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" fill="var(--muted)"/></marker></defs>
<rect class="b" x="90" y="10" width="540" height="320" rx="8" style="fill:none"/>
<text class="s" x="20" y="62">SQL</text><text class="s" x="14" y="100">Result</text>
<path class="l" d="M45 56H110" marker-end="url(#ah1)"/><path class="l" d="M110 92H45" marker-end="url(#ah1)"/>
${box(110, 40, 120, 64, 'Query processor', 'b2')}
${box(300, 28, 150, 96, '', 'b')}<text x="375" y="52" text-anchor="middle">Transaction manager</text>${box(325, 82, 100, 30, 'Scheduler', 'b')}
${box(500, 40, 110, 64, 'Log manager', 'b')}
${box(300, 170, 110, 60, 'Buffer manager', 'b2')}${box(480, 170, 130, 60, 'Recovery manager', 'b')}
<ellipse class="b" cx="360" cy="285" rx="56" ry="12"/><rect class="b" x="304" y="285" width="112" height="34"/><ellipse class="b" cx="360" cy="319" rx="56" ry="12"/><text x="360" y="302" text-anchor="middle">Data files</text><text class="s" x="360" y="344" text-anchor="middle">(table files + log)</text>
<path class="l" d="M230 70H300" marker-start="url(#ah1)" marker-end="url(#ah1)"/><path class="l" d="M450 70H500" marker-start="url(#ah1)" marker-end="url(#ah1)"/>
<path class="l" d="M190 104L330 170" marker-start="url(#ah1)" marker-end="url(#ah1)"/><path class="l" d="M360 124V170" marker-start="url(#ah1)" marker-end="url(#ah1)"/>
<path class="l" d="M520 104L410 175" marker-start="url(#ah1)" marker-end="url(#ah1)"/><path class="l" d="M545 104V170" marker-start="url(#ah1)" marker-end="url(#ah1)"/>
<path class="l" d="M410 200H480" marker-start="url(#ah1)" marker-end="url(#ah1)"/><path class="l" d="M360 230V270" marker-start="url(#ah1)" marker-end="url(#ah1)"/><path class="l" d="M540 230L410 282" marker-end="url(#ah1)"/>
</svg>`;
const DISK = `<svg class="viz f1" viewBox="0 0 640 230" width="100%" style="max-width:640px" role="img" aria-label="Hard disk: platters, tracks, sectors and a cylinder">${FSTY}
<g transform="translate(120 115)">${[26, 44, 62, 80, 98].map(r => `<circle class="ring" r="${r}"/>`).join('')}<circle class="ring" r="14" style="fill:var(--sunken)"/>${Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5; return `<line class="ring" x1="${(14 * Math.cos(a)).toFixed(1)}" y1="${(14 * Math.sin(a)).toFixed(1)}" x2="${(98 * Math.cos(a)).toFixed(1)}" y2="${(98 * Math.sin(a)).toFixed(1)}"/>`; }).join('')}
<path class="sec" d="M ${(62 * Math.cos(0.1)).toFixed(1)} ${(62 * Math.sin(0.1)).toFixed(1)} A62 62 0 0 1 ${(62 * Math.cos(0.58)).toFixed(1)} ${(62 * Math.sin(0.58)).toFixed(1)}"/></g>
<text x="120" y="226" text-anchor="middle" class="s">Top view: tracks (rings), sectors (slices)</text>
<g transform="translate(340 0)"><line class="l" x1="110" y1="20" x2="110" y2="190" style="stroke-width:5"/>
${[50, 100, 150].map(y => `<ellipse class="ring" cx="110" cy="${y}" rx="76" ry="14" style="fill:var(--surface)"/><ellipse class="ring" cx="110" cy="${y}" rx="48" ry="8"/>`).join('')}
${[50, 100, 150].map(y => `<line class="l" x1="10" x2="40" y1="${y}" y2="${y}" style="stroke-width:3"/>`).join('')}<line class="l" x1="10" y1="40" x2="10" y2="160" style="stroke-width:3"/>
<line x1="134" y1="30" x2="134" y2="172" stroke="var(--accent-viz)" stroke-dasharray="4 3" stroke-width="2"/>
<text x="150" y="24" style="fill:var(--accent)">cylinder</text><text x="2" y="186" class="s">disk heads move together</text><text x="150" y="208" class="s">platter = 2 surfaces</text></g>
</svg>`;
const FIXED = `<svg class="viz f1" viewBox="0 0 600 70" width="100%" style="max-width:600px" role="img" aria-label="Fixed length records in a page">${FSTY}${box(10, 14, 78, 40, 'header')}${box(88, 14, 90, 40, 'record 1')}${box(178, 14, 90, 40, 'record 2')}${box(268, 14, 90, 40, 'record 3')}<text x="388" y="40">...</text>${box(416, 14, 90, 40, 'record n')}<rect class="hatch" x="506" y="14" width="80" height="40"/><text class="s" x="546" y="38" text-anchor="middle">unused</text></svg>`;
const VAR = `<svg class="viz f1" viewBox="0 0 600 120" width="100%" style="max-width:600px" role="img" aria-label="Variable length records in a page">${FSTY}
<defs><marker id="ah2" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--muted)"/></marker></defs>
<rect class="b" x="10" y="20" width="580" height="44" rx="4" style="fill:var(--surface)"/>
<rect class="b2" x="10" y="20" width="150" height="44" rx="4"/><text x="38" y="46" text-anchor="middle">#rows</text>
<text x="110" y="46" text-anchor="middle">ptrs</text>
<text x="260" y="46" text-anchor="middle" class="s">free space</text>
<rect class="b" x="400" y="26" width="60" height="32"/><text x="430" y="46" text-anchor="middle">row 3</text><rect class="b" x="466" y="26" width="52" height="32"/><text x="492" y="46" text-anchor="middle">row 2</text><rect class="b" x="524" y="26" width="60" height="32"/><text x="554" y="46" text-anchor="middle">row 1</text>
<path class="l" d="M94 64V96H554V64" marker-end="url(#ah2)"/><path class="l" d="M110 64V86H492V64" marker-end="url(#ah2)"/>
<text class="s" x="10" y="14">page header (grows right)</text><text class="s" x="590" y="14" text-anchor="end">rows (grow left)</text><text class="s" x="300" y="112" text-anchor="middle">each header pointer = start of one row</text></svg>`;

// ---------------------------------------------------------------- LECTURE 1
export const lecture = {
  id: 'l1', kind: 'lecture', num: 'L1', icon: 'database',
  title: 'RDBMS Storage and Conventional Indices', navTitle: 'RDBMS storage, indices', mapLabel: 'Storage, indices',
  short: 'How an RDBMS keeps tables on disk in pages, and how dense, sparse, secondary, BRIN and multilevel indices find rows without reading everything.',
  goals: [
    'Name the parts of an RDBMS and say where storage fits in.',
    'Explain why the page (block) is the unit of disk I/O and count page reads.',
    'Tell dense from sparse and primary from secondary, and say which combinations are allowed.',
    'Update dense and sparse indices after an insert or delete, including overflow blocks.',
    'Handle duplicate keys in primary and secondary indices and compare the costs.',
    'Explain BRIN and size a multilevel index (levels, pages, disk reads).',
  ],
  sections: [
    {
      id: 'course-rdbms', title: 'The course and the RDBMS',
      body: `<div class="prose">
<p>ICS502 Database Programming (Dr. Eng. Amal Yassien) looks <em>inside</em> a database system. The previous databases course taught you to use one. This course asks how it works: which algorithms and data structures let an RDBMS answer a query on a billion rows in milliseconds. The software used is PostgreSQL, and the textbook is <em>Databases: The Complete Book</em>, 2nd edition (Garcia-Molina, Ullman, Widom).</p>
<p>Grading: quizzes 15%, project 20%, midterm 25%, final 40%. Lectures and tutorials have mandatory attendance. The doctor's study tips: solve the practice assignments by hand before reading the solutions, and keep asking how technique X changes the performance of the server. That second tip is the real exam skill.</p>
${table(['Component', 'Share'], [['Quizzes', '15%'], ['Project', '20%'], ['Midterm', '25%'], ['Final', '40%']])}
<h3>Three definitions</h3>
${terms([
        ['database', 'Database', 'An organised collection of structured information, or data, typically stored electronically in a computer system.'],
        ['table', 'Relational database', 'A database that organises data into rows and columns. Rows and columns form a table, and the data points are related to each other.'],
        ['gear', 'RDBMS', 'A relational database management system: the program used to create, update and manage relational databases.'],
      ])}
<h3>The 2nd most powerful software</h3>
<p>Every computing system rests on a few building blocks: the <strong>operating system</strong> (manages hardware and software), the <strong>RDBMS</strong> (the backbone of an enterprise system, for example a bank), the <strong>network stack</strong>, and distributed and cloud systems. The lecture's claim: an RDBMS is the 2nd most powerful piece of software after the operating system. It is not a toy library. It manages memory, disks, concurrency and crashes by itself.</p>
<h3>RDBMS architecture</h3>
<p>The architecture figure of the lecture has seven boxes. The query processor receives SQL and returns the result. It talks to the buffer manager to get pages. The transaction manager (with its scheduler) orders concurrent work. The log manager and the recovery manager protect you from crashes. The data files and the log live on disk.</p></div>
<div class="tbl-wrap" style="padding:8px 0">${ARCH}</div>
<div class="prose">${terms([
        ['magnifying-glass', 'Query processor', 'Parses and plans the SQL (Lecture 5 is about its logical planning). It decides which index or scan to use.'],
        ['arrows-left-right', 'Transaction manager and scheduler', 'Orders the operations of concurrent transactions so that the results stay correct.'],
        ['memory', 'Buffer manager', 'Moves pages between disk and main memory. It is the only door to the data files.'],
        ['notebook', 'Log manager', 'Writes a record of every change to the log so that nothing is lost.'],
        ['first-aid-kit', 'Recovery manager', 'Uses the log to bring the database back to a consistent state after a crash.'],
        ['hard-drives', 'Data files and log', 'The nonvolatile part: tables, indices and the log, stored as files on disk.'],
      ])}
${K('Today\'s agenda has two parts. First: how the RDBMS stores tables (files, pages, rows). Second: conventional indices, which are the simplest structures that avoid scanning every page. Everything in Lectures 2 to 4 (B+ tree, hash, multidimensional) replaces the weak points of what you learn here.')}
</div>`,
    },
    {
      id: 'storage-players', title: 'Storage: key players and data flow',
      body: `<div class="prose">
<p>Three parties take part in storing and reading the data of a database system:</p>
${terms([['folder', 'OS file system', 'Gives the RDBMS files. A table is mapped to one or more files.'], ['stack', 'Memory hierarchy', 'Fast and small (cache, main memory) down to slow and large (disk).'], ['hard-drive', 'Secondary storage', 'Typically an HDD or an SSD. It holds the data when the power is off.']])}
<h3>What does an RDBMS store?</h3>
<ul><li><strong>Tables</strong>: the data itself.</li><li><strong>Metadata</strong>: schema, constraints and so on.</li><li><strong>Log records</strong>: the history of changes (used for recovery).</li><li><strong>Statistics</strong>: sizes, frequency of certain values (Lecture 5 uses them to estimate result sizes).</li><li><strong>Indices</strong>: today's topic.</li></ul>
<p>The data must still be there after the server restarts. That is why it cannot live only in memory.</p>
<h3>Volatile and nonvolatile memory</h3>
${compare(['lightning', 'Volatile (main memory, buffer, cache)', ['Very fast', 'Small and expensive', 'Data disappears when the power goes off', 'Used while the server runs']], ['hard-drives', 'Nonvolatile (HDD, SSD)', ['Very slow compared to memory', 'Cheap and large', 'Data stays after power off', 'Stores the database permanently']])}
<p>An RDBMS takes the best of both: it works in volatile memory during execution and keeps the permanent copy on nonvolatile storage. So it keeps moving data from disk to memory and back.</p>
<h3>Database I/O and Scenario 1</h3>
<p><strong>Database I/O</strong> happens when the engine reads or writes data between disk and memory. The disk is the bottleneck, so we count I/Os, not CPU steps.</p>
${K('<strong>Scenario 1: read a table with 1 billion rows. How many I/Os? How many files?</strong> The honest answer on the slides: it depends on how the table is stored on the disk. An I/O moves a whole page, not one row. With 100 rows per page, 1 billion rows are 10 million page reads. Fewer rows per page means more I/Os.')}
<h3>Organising a table in files</h3>
${compare(['file', 'Simple approach', ['Map each table (relation) to <strong>one file</strong>.', 'The file holds a sequence of rows.', 'Easy, but one huge file for a huge table.']], ['files', 'Sophisticated approach', ['Map each table to <strong>several files</strong>.', 'Each file holds a sequence of rows.', 'Parts can be read, moved or processed separately, which helps on a huge table. (PostgreSQL, for example, splits big tables into 1 GB segments.)']])}
<h3>What the files must support</h3>
<ul><li>Insert and delete rows (tuples, records).</li><li>Fetch one particular row.</li><li>Find all rows that match a condition.</li></ul>
<p>To design algorithms for these three jobs we need to know how rows sit inside a file. That is the next section.</p>
</div>`,
    },
    {
      id: 'pages', title: 'Pages, disks and row layout',
      body: `<div class="prose">
<p>A <strong>page</strong> (also called a <strong>block</strong>) is the unit of storage on the hard disk and the unit of every I/O. Its size depends on the mechanical properties of the disk. Reading one row costs the same as reading its whole page, so the cost model of this unit is: <em>count page reads and writes</em>.</p></div>
<div class="tbl-wrap" style="padding:6px 0">${DISK}</div>
<div class="prose">
<ul><li>A hard disk has several <strong>platters</strong>; each platter has 2 surfaces.</li><li>Each surface has concentric <strong>tracks</strong>, cut into <strong>sectors</strong> separated by gaps.</li><li>The <strong>disk heads</strong> sit on one arm and move together. The set of tracks under all heads at one position is a <strong>cylinder</strong>.</li><li>Takeaway of the lecture: <em>page size is related to the cylinder size</em>. Data in one cylinder can be read without moving the arm.</li></ul>
<h3>Fixed-length records</h3>
<p>The simplest layout. The page is divided into fixed-size chunks, and each row is stored in one chunk after a small header. Row k sits at a computable position, but space is wasted if rows differ in size.</p></div>
<div class="tbl-wrap" style="padding:6px 0">${FIXED}</div>
<div class="prose"><h3>Variable-length records</h3>
<p>More sophisticated. The page has a <strong>header</strong> and a <strong>body</strong>. The header holds the <strong>number of rows</strong> in the page and a <strong>pointer to the beginning of each row</strong>. The body holds the rows (they fill the page from the far end towards the header). Rows can have any size, and moving a row inside a page only changes its header pointer.</p></div>
<div class="tbl-wrap" style="padding:6px 0">${VAR}</div>
<div class="prose">${K('Why pointers in the header? Other structures can point at "page 3, row 2" and keep working even if row 2 moves inside the page. Indices will store exactly such page pointers.')}</div>`,
    },
    {
      id: 'sorted-file', title: 'A sorted table: Scenarios 2a to 2d',
      body: `<div class="prose">
<p>Most RDBMSs keep the rows of a table sorted by the value of one column. The slides use a table with <strong>15 rows sorted on first name</strong> and <strong>5 rows per page</strong>, so 3 pages. Four scenarios ask: <em>in which page does the row with first name "Abdelrahman" (or "Mohamed") live?</em></p>
${table(['Scenario', 'Operation', 'What happens'], [
        ['2a', 'Insert a user "Abdelrahman"', 'The file is sorted, so there is exactly one right place: the first page. If that page is full, rows must shift: the last row of page 1 moves to page 2, and so on (a cascade).'],
        ['2b', 'Delete "Abdelrahman"', 'Search for the page (binary search over page boundaries), remove the row. Leave a free slot, or shift later rows up.'],
        ['2c', 'Retrieve all "Abdelrahman"', 'Binary search over pages: about log2(number of pages) page reads instead of reading every page.'],
        ['2d', 'Retrieve all "Mohamed"', 'Equal names sit next to each other. They can straddle a page boundary, so read the next page as long as a page still ends with the key.'],
      ])}
<h3>Binary search over pages</h3>
<p>Because the file is sorted, you read the middle page, compare the key with its first and last row, and go left or right. Each probe is one page read. With P pages that is about log2(P) reads. An unsorted (heap) file would need up to P reads. But sorted storage has a price: an insert in the middle has to make room.</p></div>
${W('u1PageLayout')}
<div class="prose">
${K('Sorted data makes <strong>search cheap</strong> (log P page reads) and <strong>insert and delete expensive</strong> (many pages may shift, O(n) in the worst case). Indices will try to give you the cheap search without paying that price on every column.')}
${T('Duplicates break the "one page" answer. For Mohamed the answer to "which page?" is <strong>pages 2 and 3</strong>, not one page. When the question says "retrieve all", always check whether the run of equal keys continues into the next page.')}
</div>`,
    },
    {
      id: 'index-basics', title: 'Indices: dense, sparse, primary, secondary',
      body: `<div class="prose">
<p>An <strong>index</strong> is a data structure that contains <strong>key-pointer pairs</strong>. The key is a column value. The pointer is the address of a row with that value. The slides write <code>&lt;Mohamed, 4&gt;</code>: the key is the first name "Mohamed", the pointer is page 4. Because an index is much smaller than the table, you can search it quickly and then read exactly the right table page.</p>
<h3>Dense vs sparse</h3>
${compare(['list-numbers', 'Dense index', ['A key-pointer pair for <strong>every row</strong> of the table, or at least one instance of every distinct value when there are duplicates.', 'Works for any column.', 'About as many pairs as rows.']], ['list-dashes', 'Sparse index', ['<strong>One key-pointer pair per page</strong> of the table.', 'Usually about 10% of the size (takeaway).', 'Needs the table sorted on the key: it gives a "sense of location".']])}
<h3>Primary vs secondary</h3>
${compare(['sort-ascending', 'Primary index', ['The table data file is <strong>sorted by the search key K</strong>.', 'May be dense (every row) or sparse (every page).', 'The lecture figures show both.']], ['shuffle', 'Secondary index', ['The table is <strong>not sorted</strong> by K.', 'Must be <strong>dense</strong>: the minimum of a page says nothing about the other values in an unsorted page.', 'In multilevel secondary indices the first level must be dense.']])}
${W('u1DenseSparse')}
<div class="prose">
<h3>Counting index pages (PA1-2 preview)</h3>
<p>If a table page holds r rows and an index page holds p pairs: table pages = n/r, dense index pages = n/p, sparse index pages = (n/r)/p. With r = 3 and p = 10 that is n/3, n/10 and n/30. The sparse index is r times smaller than the dense one.</p>
${T('"Sparse" is a statement about <em>how many pairs</em>, "primary" is a statement about <em>the sort order of the table</em>. They are not opposites. Primary indices can be dense or sparse. Secondary indices can only be dense. A secondary index can never be sparse, but a dense index is not necessarily secondary.')}
</div>
${W('u1SortDS')}${W('u1SortPS')}`,
    },
    {
      id: 'maintenance', title: 'Keeping indices up to date: delete and insert',
      body: `<div class="prose">
<p>Any change in a table file must be reflected in the indices on that table:</p>
<ul><li><strong>Insert</strong> a row: insert a key-pointer pair in <em>each</em> index on the table.</li><li><strong>Update</strong> a row: change the key in the pairs of each index <em>whose column changed</em>.</li><li><strong>Delete</strong> a row: delete the pair(s) of that row in each index.</li></ul>
<p>The slides then show how, with tiny examples (pages of 2 rows). Use the simulator below: each operation plays the slide panels (a), (b), (c) as steps.</p>
<h3>Deletion from a dense index (slide 34)</h3>
<p>Table pages hold (10,20), (30,40), (50,60), (70,80) and the dense index has a pair for each key. <strong>Delete 30</strong>: remove the row from page 2 (40 slides up, one free slot appears), then remove the pair <code>&lt;30, 2&gt;</code> from the index. The pairs after it shift up. A dense index always loses exactly one pair per deleted row.</p>
<h3>Deletion from a sparse index (slide 35)</h3>
<p>The sparse index holds 10, 30, 50, 70 (one per page). <strong>Delete 40</strong>: 40 is not the first key of its page, so the index does not change at all. <strong>Delete 30</strong> (when 40 is still there): 30 was the page's first key, so the pair <code>&lt;30, 2&gt;</code> is replaced by <code>&lt;40, 2&gt;</code>. If a delete empties a page, its pair is removed.</p>
<h3>Insertion in a sparse index (slides 36 to 38)</h3>
<p>Start with pages (10,20), (30,_), (40,50), (60,_) and the sparse index 10, 30, 40, 60.</p>
${stp([
        ['Simple case: insert 34', 'It belongs after 30, and page 2 has a free slot. Put it there. No page minimum changed, so the index is untouched ("we have free space where we need it").'],
        ['Immediate reorganisation: insert 15', 'It belongs in page 1 (10,20), which is full. Slide the last row, 20, into page 2, which becomes (20,30). The page minimum of page 2 changed from 30 to 20, so the index pair 30 becomes 20.'],
        ['Overflow block: insert 25', 'It belongs after 20 in the full page 1. Instead of shifting rows, chain a new <strong>overflow block</strong> to page 1 and put 25 there. The index does not change. The file is reorganised later.'],
      ])}
<p>The slide ends with: <em>the same for dense indices. It can even get more complicated!</em> A dense index also needs a new pair for each insert, and the pair of every row that moved must get its new page pointer.</p></div>
${W('u1IndexMaintain')}
<div class="prose">
${K('<strong>Immediate reorganisation</strong> keeps the file tidy but rewrites several pages and may change index pairs. <strong>Overflow blocks</strong> make one insert cheap but make later searches slower (an extra block to read) until the reorganisation happens. That is the trade-off to state in an exam.')}
${T('Sparse indices only react to changes of a <em>page minimum</em>. A common mistake is to remove a pair from a sparse index after every delete. Deleting a row that is not the first of its page changes nothing. Dense indices, in contrast, change on every insert and delete.')}
<p>Because pairs and rows are kept in sorted order, a change can shift everything behind it. The takeaway of the lecture: conventional indices are simple and good for scans, but inserting and updating them is expensive, <strong>O(n)</strong>. Lecture 2 (B+ tree) fixes this.</p>
</div>`,
    },
    {
      id: 'duplicates', title: 'Duplicate keys',
      body: `<div class="prose">
<p>Real columns have repeated values. The lecture shows three approaches for each kind of index. Use the simulator to switch between them. It reports the number of pairs, the index pages (4 pairs each) and the table pages read for a chosen key.</p>
<h3>Dense primary index (slide 39)</h3>
<p>Table pages: (10,10), (10,20), (20,30), (30,30), (40,45).</p>
${table(['Approach', 'Pairs', 'Idea', 'Catch'], [
        ['1. Duplicate keys inside the index', 'One per row (10)', 'Every row has its pair, so equal keys repeat.', 'Large index.'],
        ['2. Point at the first new value', 'One per distinct key (5)', 'Pair 10 points at the first page with 10, pair 20 at the first page with 20, and so on.', 'To get all rows read the table forward until the key changes.'],
        ['3. Pick a value from each page', 'One per page (5)', 'For each page keep a key that is new on it. The figure shows 10, 20, 30, 30.', 'Behaves like a sparse index: the pair with key K is not always the first page that holds K.'],
      ])}
<h3>Sparse primary index (slide 40)</h3>
<p>A sparse index is always primary too, and it also uses approach 3: one value from each page. With pages (10,10), (10,20), (20,30), (30,30) the pairs are 10, 10, 20, 30. The slide warns: <em>careful if looking for 20 or 30!</em> The pair "20" points at page 3, but 20 also appears in page 2. The safe rule: <strong>start from the last pair whose key is smaller than the search key</strong> and read forward until a row is larger.</p>
<h3>Secondary index (slide 41)</h3>
<p>The table is not sorted on the column, so equal keys are scattered over pages. Table pages (20,10), (20,40), (10,40), (10,40), (30,40).</p>
${table(['Approach', 'Structure', 'Problem named on the slide'], [
        ['1. Duplicate keys inside the index', 'One pair per row, sorted by key.', 'Excess overhead: disk space and search time.'],
        ['2. Clustering: pointers to the duplicated key in index files', 'Each key appears once and points to a <strong>bucket</strong> of pointers to all rows with that key.', 'Variable size records in the index.'],
        ['3. Chain duplicated records in the table files', 'Each key appears once and points at the first row. Each row has an extra pointer to the next row with the same key.', 'Need to add fields to records, follow the chain to know the rows, maintenance nightmare.'],
      ])}</div>
${W('u1Duplicates')}
<div class="prose">${T('Approach 3 for a dense index does not guarantee a pair for every distinct value (the slide-39 figure has no pair for 45). When asked how to search it, say what you do for a key that has no pair of its own: go to the last pair with a smaller key and read forward.')}</div>`,
    },
    {
      id: 'brin', title: 'BRIN: block-range index',
      body: `<div class="prose">
<h3>What</h3>
<p>A <strong>Block-Range Index (BRIN)</strong> is a type of sparse index. For each table page it stores the <strong>minimum and maximum</strong> value of the column that appear in that page. One pair per page: <code>&lt;(min, max), page&gt;</code>.</p>
<h3>Why</h3>
<p>It lets the query processor <strong>skip large portions of the table</strong> that cannot contain matching rows. It is useful for low-selectivity queries and analytical queries, and it is tiny (one pair per page instead of one per row).</p>
<h3>How (slide 43)</h3>
<p>Pages: (10,20), (30,31,33,38), (40,44,50), (60). The BRIN index holds (10,20), (30,38), (40,50), (60,60). To find 45: only the range (40,50) contains it, so read only page 3 and skip the other three.</p>
<h3>When is it efficient?</h3>
<p>The lecture's takeaway says BRIN is efficient only in two scenarios: <strong>analytical queries</strong> (they scan big parts of the table anyway, and cheap skipping of the rest helps) and <strong>narrow-range search on a column with a huge range of values</strong>. The reason: a range must be narrow compared with the page ranges, so that most pages do not overlap it.</p></div>
${W('u1BRIN')}
<div class="prose">
${K('BRIN works when the column roughly follows the physical order of the table (for example a timestamp in an append-only table, or a table sorted on that column). Then each page covers a short slice of the value range. If values are scattered, every page has a min near the bottom and a max near the top, and BRIN skips nothing.')}
${T('A page may be <em>read and still hold no match</em>: its (min, max) overlaps the query but none of its values falls inside. BRIN tells you which pages to skip, never which pages certainly contain the answer.')}
</div>`,
    },
    {
      id: 'multilevel', title: 'Multilevel indices',
      body: `<div class="prose">
<h3>What</h3>
<p>A <strong>multilevel index</strong> is an index built on an index: one or more indices are created on a particular index. The first level sits next to the table. Each higher level has one pair per <em>page</em> of the level below (so every higher level is sparse), until the top level fits on a single page.</p>
<h3>Why: the lecture's example</h3>
<p>A primary index on a table with <strong>1 million rows</strong>. A table page holds <strong>10 rows</strong>, an index page holds <strong>100 key-pointer pairs</strong>. The index should fit in main memory, and memory has only <strong>15 pages</strong>. What do we do?</p>
${stp([
        ['Table', '1,000,000 rows / 10 per page = <strong>100,000</strong> table pages.'],
        ['Level 1 (sparse)', 'One pair per table page: 100,000 pairs / 100 = <strong>1,000</strong> index pages. Too many for 15 pages.'],
        ['Level 2', 'An index on level 1: 1,000 pairs / 100 = <strong>10</strong> pages.'],
        ['Level 3', 'An index on level 2: 10 pairs fit in <strong>1</strong> page. Stop: the top is one page.'],
        ['Memory', 'Levels 2 and 3 together are 11 pages, so they fit in the 15 pages of memory. A lookup then needs 1 read for the level-1 page + 1 for the table page = <strong>2 disk I/Os</strong>. With only <strong>1 page</strong> of memory (the later version of the question) keep just the top page: 3 disk I/Os.'],
      ])}
<h3>Dense or sparse first level</h3>
<p>If the first level is dense, it has 1,000,000 pairs, so 10,000 pages, then 100, then 1. Total 10,101 pages versus 1,011 for the sparse version. The figure on slide 45 shows (a) a dense multilevel primary index and (b) a sparse multilevel primary index: the second level is sparse in both cases. For a secondary index the first level must be dense and the levels above are sparse.</p></div>
${W('u1Multilevel')}
<div class="prose">${K('Each extra level divides the number of pages by p (the pairs per page). The number of levels is about log base p of the first-level size, so a lookup costs roughly <strong>one page read per level</strong>: O(log n) instead of O(n). Keeping the top levels in memory removes their cost.')}
${T('Count levels until <strong>one page</strong>, not until the entries are fewer than the memory. And remember the first level: n pairs if dense, n/r pairs if sparse (r = rows per table page).')}</div>`,
    },
    {
      id: 'takeaways', title: 'Takeaways',
      body: `<div class="prose">
<ul>
<li>An index is a structure on one or more columns that makes queries on them faster. Without one the engine does a <strong>linear search, O(n)</strong>. With one it is typically <strong>O(log n)</strong> or <strong>O(1)</strong>.</li>
<li>A <strong>primary</strong> index is built on the column the table is sorted on.</li>
<li><strong>Dense</strong>: at least one instance of every value of the column. <strong>Sparse</strong>: a small percentage of the values, typically about 10%.</li>
<li>A <strong>secondary</strong> index is built on a non-sorting column. In secondary multilevel indices, the <strong>first level must be dense</strong>.</li>
<li>Tables and indices are stored in pages. <strong>Page size is related to the hard disk's cylinder size.</strong></li>
<li><strong>BRIN</strong> stores min and max per table page. It is efficient only for analytical queries and for narrow-range searches on a column with a huge range of values.</li>
<li>Conventional indices are simple and good for scans, but <strong>inserting and updating is O(n)</strong>. We can do better: next time, the B+ tree.</li>
</ul>
${table(['Question', 'Answer'], [
        ['Rows per page r, pairs per page p, n rows: dense index pages?', 'n/p'],
        ['Same, sparse index pages?', '(n/r)/p = n/(r·p)'],
        ['Can a secondary index be sparse?', 'No, it must be dense.'],
        ['Does deleting a non-minimum row change a sparse index?', 'No.'],
        ['Which index stores (min, max) per page?', 'BRIN (a sparse index).'],
        ['Cost of one lookup in a multilevel index', 'About one page read per level, plus the table page.'],
      ])}
${K('Exam habit: before building or searching an index, write down (1) is the table sorted on this column? (2) how many rows per page and pairs per page? (3) are there duplicates? Those three answers decide dense or sparse, the page counts and the search rule.')}
</div>
${W('u1SortTF')}`,
    },
  ],
};

// ---------------------------------------------------------------- PRACTICE ASSIGNMENT 1
export const lab = {
  id: 'pa1', kind: 'lab', num: 'PA1', icon: 'clipboard-text',
  title: 'Practice Assignment 1: Conventional Indices', navTitle: 'PA1: conventional indices', mapLabel: 'PA1 indices',
  short: 'True or false with justification, block counts, worst-case multilevel formulas, a 3-level index with duplicates, CRUD on a cartoon table, and the 2025 midterm exercises 1 and 2.',
  goals: [
    'Justify true or false statements about dense, sparse, primary and secondary indices with the course\'s wording.',
    'Count the blocks of a table, a dense index and a sparse index from rows per block and pairs per block.',
    'Derive the worst-case size of a multilevel index (n−1)/9 and (n−3)/27.',
    'Build a 3-level index over a column with duplicates and say how duplicates are handled.',
    'Update a primary and a secondary index after insert, delete and update, and plan a range read.',
    'Solve the 2025 midterm exercises 1 and 2 (dense multilevel, bitmap, BRIN).',
  ],
  sections: [
    {
      id: 'pa-1-1', title: 'Exercise 1-1: true or false',
      body: `<div class="prose">
<p>Seven statements. The task: say true or false <strong>with justification</strong>. The official answers are below. Statements 6 and 7 are the debatable ones: read the notes on what the course means.</p>
${table(['#', 'Statement', 'Official', 'Why'], [
        ['1', 'When a sparse index is used, each record must have an entry in the index.', '<strong>False</strong>', 'Each <em>block (page)</em> has an entry, not each record. That is the difference to dense.'],
        ['2', 'One-level secondary indices must be dense.', '<strong>True</strong>', 'They index a column the table is not sorted on, so a page minimum would tell you nothing.'],
        ['3', 'With two levels of secondary index, either level can be sparse or dense.', '<strong>False</strong>', 'The first level (next to the table) must be dense. Only the level above it can be sparse.'],
        ['4', 'You can only use a sparse index if the table is sorted by the search key, while a dense index can be used for any search key.', '<strong>True</strong>', 'A sparse index gives a "sense of location", which only works on sorted data.'],
        ['5', 'An index on any candidate key or non-key field, with possible duplicates, and the table is not clustered or sorted by this key, is a primary index.', '<strong>False</strong>', 'Any index on a column that does not sort the table is a <em>secondary</em> index, even on a candidate key.'],
        ['6', 'A primary index is a non-dense index because it is the main index of a table and must be most efficient.', '<strong>True</strong> (see note)', 'It requires the table to be ordered on the indexing attribute.'],
        ['7', 'A clustered index is a non-dense index because sorting is needed to keep duplicate values together.', '<strong>True</strong> (see note)', 'Each entry points at the page with the pivot element (first value of the cluster of duplicates).'],
      ])}
${T('<strong>Statement 6 as written is shaky.</strong> The official answer is True and gives the real reason: a primary index needs the table sorted on the key, and that is what <em>allows</em> it to be non-dense (sparse). But the lecture draws a dense primary index too (slide 31a), and the reason "because it is the main index and must be most efficient" is not a reason at all. If you write this on an exam, follow the official verdict and use the sorting argument: "True: the table is sorted on the key, so one pair per page is enough. It may also be dense."')}
${T('<strong>Statement 7</strong> uses "non-dense" for an index with one pair per <em>distinct value</em> (the cluster pivot), which is approach 2 of the duplicates slide. By the lecture\'s own definition (at least one instance of every value) that index would still count as dense. So the course means: not one pair per row. Write the official reasoning: duplicates sit together, so one pair pointing at the first value of each cluster is enough.')}
</div>
${W('u1SortTF')}`,
    },
    {
      id: 'pa-1-2', title: 'Exercise 1-2: dense vs sparse block counts',
      body: `<div class="prose">
<p>Blocks hold either <strong>3 records</strong> or <strong>10 key-pointer pairs</strong>. How many blocks for (a) the table with n rows, (b) a dense index, (c) a sparse index?</p>
${table(['Part', 'Reasoning', 'Blocks'], [
        ['a) Table', '3 rows per block, n rows', '<strong>n/3</strong>'],
        ['b) Dense index', 'one pair per row, 10 pairs per block', '<strong>n/10</strong>'],
        ['c) Sparse index', 'one pair per <em>table block</em>: n/3 pairs, 10 per block', '<strong>(n/3)/10 = n/30</strong>'],
      ])}
<p>Example with n = 30,000: table 10,000 blocks, dense index 3,000 blocks, sparse index 1,000 blocks. The sparse index is 3 times smaller than the dense one, because there are 3 rows per table block.</p>
${T('The sparse index counts <em>pages of the table</em>, not rows. The common slip is writing n/10 for both. Round up (ceiling) when n is not divisible.')}
${K('General form: table n/r, dense n/p, sparse n/(r·p). Check with the simulator in Lecture 1, "Dense, sparse and secondary indices": change rows per page and pairs per page and watch the index page counts.')}
</div>`,
    },
    {
      id: 'pa-1-3', title: 'Exercise 1-3: worst-case multilevel index size',
      body: `<div class="prose">
<p>Blocks hold 3 records or 10 pairs. The multilevel index has as many levels as needed until the last level fits in <strong>one block</strong>. In the worst case, how many blocks does it use when it is (i) dense, (ii) sparse?</p>
<h3>Dense</h3>
${stp([
        ['Draw it from the top', 'Level 0 is one block (10 pairs). Each pair points to one block of level 1, so level 1 has 10 blocks (100 pairs). Level 2 has 100 blocks. Level i has 10<sup>i</sup> blocks.'],
        ['Find the bottom level', 'A dense index has n pairs, 10 per block, so the bottom level has n/10 blocks. That is 10<sup>k</sup> with k = log<sub>10</sub>(n) − 1.'],
        ['Add the geometric series', '1 + 10 + 100 + ... + 10<sup>k</sup> = (10<sup>k+1</sup> − 1)/(10 − 1) = (n − 1)/9.'],
      ])}
<p>The official text writes the sum up to log<sub>10</sub>(n) and calls the last level "n blocks". That wording is loose, since 10<sup>log n</sup> = n counts pairs, not blocks. Its closed form (1 − 10<sup>log n</sup>)/(1 − 10) = (n − 1)/9 is the sum of the blocks above and including the bottom index level. Use <strong>(n − 1)/9</strong>.</p>
<h3>Sparse</h3>
<p>The table has n/3 blocks, and a sparse first level has one pair per table block: n/3 pairs, so the bottom level has (n/3)/10 blocks. The series is the same, with n replaced by n/3:</p>
<p style="text-align:center;font-size:1.1em">(n/3 − 1)/9 = <strong>(n − 3)/27</strong></p>
<h3>Check with numbers</h3>
${table(['Index', 'n', 'Levels (blocks)', 'Total', 'Formula'], [
        ['Dense', '1,000', '100 + 10 + 1', '111', '(1000 − 1)/9 = 111'],
        ['Dense', '1,000,000', '100,000 + 10,000 + ... + 1', '111,111', '(10<sup>6</sup> − 1)/9 = 111,111'],
        ['Sparse', '3,000', '(1,000 table blocks) 100 + 10 + 1', '111', '(3000 − 3)/27 = 111'],
      ])}
<p>"Worst case" in the solution means: take the full, clean hierarchy where every block of a level is pointed to by a full block above. The formulas are exact when n is a power of 10 (dense) or 3 times a power of 10 (sparse). Otherwise round each level up.</p></div>
${W('u1Multilevel')}
<div class="prose">${T('Do not forget the first level of a <em>sparse</em> multilevel index counts table blocks (n/3), not rows. That is why the denominator becomes 27 = 3 · 9.')}</div>`,
    },
    {
      id: 'pa-1-4', title: 'Exercise 1-4: three levels with duplicates',
      body: `<div class="prose">
<p>Build a <strong>3-level</strong> index on column F of table D, where <strong>one level must be dense</strong>. Clearly explain how you handle duplicates. A page holds 2 rows or 2 pairs. Table D has 16 rows:</p>
<p class="mono" style="font-size:.95em">F = [50, 80, 100, 100, 100, 150, 150, 200, 200, 300, 410, 410, 410, 420, 430, 450]</p>
<h3>Solution (follows PA1-03)</h3>
${stp([
        ['Table pages', '16 rows / 2 = <strong>8 pages</strong>: (50,80) (100,100) (100,150) (150,200) (200,300) (410,410) (410,420) (430,450).'],
        ['Level 1: dense, one pair per distinct value', 'There are 10 distinct values: 50, 80, 100, 150, 200, 300, 410, 420, 430, 450. Each pair points at the page of the <strong>first occurrence</strong> of the value: 100 at page 2, 150 at page 3 (its first 150 is the second row of page 3), 200 at page 4, 410 at page 6, 430 and 450 at page 8. That is 10 pairs, <strong>5 pages</strong>.'],
        ['Level 2: sparse', 'One pair per page of level 1: 50, 100, 200, 410, 430. Five pairs, <strong>3 pages</strong>.'],
        ['Level 3: sparse', 'One pair per page of level 2: 50, 200, 430. Three pairs, <strong>2 pages</strong>. That is the 3-level index. (A 4th level would need one more page with 50 and 430.)'],
      ])}
<h3>How duplicates are handled</h3>
<p>Level 1 uses <strong>approach 2: point at the first occurrence</strong>. Each distinct value appears once. To read all rows with value 100 you follow its pair to table page 2 and keep reading pages while the page still ends with 100: pages 2 and 3. The chained pages in the official figure (the little squares) show that you continue to the next page. Without duplicates in the index, the index is smaller: 10 pairs instead of 16 (5 pages instead of 8).</p>
<p>Compare with approach 1 (a pair for every row): level 1 would have 16 pairs, 8 pages, then 4, then 2: 14 index pages instead of 10. Use the simulator to switch and to trace a lookup.</p></div>
${W('u1PA14')}
<div class="prose">${T('With approach 1 (repeated keys in level 1) equal keys can straddle page boundaries, so in the upper levels take the last pair with a SMALLER key than the search key. With approach 2 each key appears once, so the last pair with key ≤ F is right.')}</div>`,
    },
    {
      id: 'pa-1-5', title: 'Exercise 1-5: CRUD with primary and secondary indices',
      body: `<div class="prose">
<p>A table of 8 cartoon characters. A page holds <strong>2 rows</strong> or <strong>4 key-pointer pairs</strong>.</p>
${table(['Char ID', 'First name', 'Last name', 'City', 'Age'], [['1', 'Mickey', 'Mouse', 'Anaheim', '73'], ['2', 'Bat', 'Man', 'Gotham', '54'], ['3', 'Wonder', 'Woman', 'Paradise', '39'], ['4', 'Donald', 'Duck', 'Mallard', '65'], ['5', 'Bugs', 'Bunny', 'Rascal', '58'], ['6', 'Wiley', 'Coyote', 'Canyon', '61'], ['7', 'Cat', 'Woman', 'Hairball', '32'], ['8', 'Tweety', 'Bird', 'Law', '28']])}
<div class="callout trap"><i class="ph ph-warning"></i><div><strong>Typo in the official figure.</strong> The solution picture for block 4, row 8 shows Tweety Bird in "Gotham, 54". The table in the question says Law, 28, and the later answers (secondary index with 28 → page 4, update to 29) use 28. This page uses the correct row: Tweety, Bird, 543 Parrot Street, Law, 28.</div></div>
${stp([
        ['a) Store the table', '8 rows / 2 per page = <strong>4 pages</strong>: (1,2) (3,4) (5,6) (7,8).'],
        ['b) Primary index', 'Dense: 8 pairs / 4 per page = <strong>2 index pages</strong>: [1→1, 2→1, 3→2, 4→2] [5→3, 6→3, 7→4, 8→4]. Sparse: one pair per table page = 4 pairs = <strong>1 index page</strong>: [1→1, 3→2, 5→3, 7→4].'],
        ['c) Secondary index on age', 'The table is not sorted on age, so it must be dense: 8 pairs sorted by age, <strong>2 pages</strong>: [28→4, 32→4, 39→2, 54→1] [58→3, 61→3, 65→2, 73→1].'],
        ['d) Insert Minnie Mouse, age 72', 'It is the 9th row and all 4 pages are full: a <strong>5th page</strong>. Dense primary: 9 pairs, 3 pages (new pair 9→5). Sparse primary: new pair 9→5, 5 pairs, 2 pages. Secondary: 72→5 goes between 65 and 73: [28,32,39,54] [58,61,65,72] [73]. The pair for 73 moves to a 3rd page.'],
        ['e) Delete the 3rd row (Wonder)', 'Rows 4 to 9 move up: pages (1,2) (4,5) (6,7) (8,9), 4 pages again. Dense primary: [1→1, 2→1, 4→2, 5→2] [6→3, 7→3, 8→4, 9→4]. Sparse: [1→1, 4→2, 6→3, 8→4]. Secondary: the pair for 39 disappears and Cat (32) now points at page 3: [28→4, 32→3, 54→1, 58→2] [61→3, 65→2, 72→4, 73→1].'],
        ['f) Update Tweety\'s age to 29', 'Go to page 4 and change 28 to 29. The primary indices are keyed on Char ID, which did not change, so <strong>they stay untouched</strong>. Only the secondary index changes: 28 becomes 29. It is still the smallest age, so the pair is replaced in place without shifting.'],
        ['g) Read first names with age 30 to 60', 'Either an <strong>index scan</strong> with the secondary index on age (find the first age ≥ 30 in O(log n), then read pairs up to 60: 32, 54, 58 after step e), or a <strong>sequential scan</strong> of all table pages, O(n). The planner picks one.'],
      ])}
</div>
${W('u1PA15')}
<div class="prose">
${K('Think "which index is keyed on the column that changed?" An insert or delete touches <em>every</em> index of the table. An update touches only the indices on the changed column (and nothing else, unless the row moves).')}
${T('Deleting a row from the middle and closing the gap (as the official answer does) changes the page of every later row, so <strong>every index pair of those rows needs a new pointer</strong>. If the exam says "leave a free slot", only the pages and pairs of that one row change.')}
</div>`,
    },
    {
      id: 'mid-ex1', title: 'Midterm 2025, Exercise 1: true or false with correction',
      body: `<div class="prose">
<p>Exercise 1 (20 marks): <em>"For the statements below, indicate whether each statement is true or false. If false, give a correction. If true, explain why."</em> Two marks per statement. Three of the ten (1 to 3) belong to this unit; the rest come back with B+ trees, hashing and logical planning.</p>
${table(['#', 'Statement', 'Verdict', 'Correction or reason'], [
        ['1', 'Table data are stored as pages on the hard disk.', 'True', 'The page is the unit of storage and of I/O.'],
        ['2', 'A conventional index is a heap of key-pointer pairs.', 'False', 'It is a <strong>list</strong> of key-pointer pairs (sorted), not a heap.'],
        ['3', 'Insertion and deletion of rows must be reflected in the indices on the affected table.', 'True', 'Each index holds a pair per row (dense) or per page (sparse), which can be affected.'],
        ['4', 'A B+ tree node contains at most n keys and n + 3 pointers.', 'False', 'n + <strong>1</strong> pointers.'],
        ['5', 'A B+ tree keeps O(log n) performance because the tree can get skewed.', 'False', 'Because it is <strong>always balanced</strong>.'],
        ['6', 'In static hashing the number of buckets varies with the number of records.', 'False', 'That is <strong>dynamic</strong> hashing. Static hashing has a fixed number of buckets.'],
        ['7', 'In extensible hashing the directory can double in size with some insertions.', 'True', 'When a full bucket with i = j must split.'],
        ['8', 'In linear hashing, overflow buckets can be used when the designated bucket is full and utilisation is below the threshold.', 'True', 'The index only adds a bucket when utilisation reaches the threshold, so until then overflow buckets absorb extra records.'],
        ['9', 'Logical planning is part of the logs and recovery module.', 'False', 'It is part of the <strong>query processor</strong>.'],
        ['10', 'The logical planner chooses plans that minimise the number of rows to operate on as early as possible.', 'True', 'Selections and projections are pushed down to shrink intermediate results.'],
      ])}
${T('The marks need both parts: the verdict <em>and</em> the correction (if false) or the reason (if true). Write the correction as a replacement phrase, e.g. "n + 1 pointers", not a new sentence.')}
</div>`,
    },
    {
      id: 'mid-ex2', title: 'Midterm 2025, Exercise 2: indices on Name, Age, GPA',
      body: `<div class="prose">
<p>Exercise 2 (15 marks). The table, in the order of the question:</p>
${table(['Name', 'Age', 'GPA'], [['Ahmed', '18', '0.7'], ['Sara', '20', '1.0'], ['Youssef', '22', '1.3'], ['Mariam', '18', '1.6'], ['Omar', '20', '1.9'], ['Nour', '22', '2.1'], ['Karim', '18', '2.3'], ['Salma', '20', '2.5']])}
<h3>a) Dense multilevel index on age, table sorted on GPA</h3>
<p>A page holds 2 rows or 4 pairs. Show the table pages and every index level, until the last level is one page.</p>
${stp([
        ['Table pages', 'Already sorted on GPA: (Ahmed, Sara) (Youssef, Mariam) (Omar, Nour) (Karim, Salma) = pages 1 to 4.'],
        ['Dense level', 'The table is sorted on GPA, so an index on age is secondary: dense, one pair per row, sorted by age: &lt;18,1&gt; &lt;18,2&gt; &lt;18,4&gt; &lt;20,1&gt; | &lt;20,3&gt; &lt;20,4&gt; &lt;22,2&gt; &lt;22,3&gt;. 8 pairs, 2 index pages.'],
        ['Sparse level', '2 index pages need a level above: one pair per page: &lt;18,1&gt; &lt;20,2&gt; in <strong>one</strong> page. Stop.'],
      ])}
<div class="callout trap"><i class="ph ph-warning"></i><div><strong>Small error in the official solution (MID-03).</strong> The 4th dense pair is printed &lt;20, 2&gt;. Sara (age 20) is on table page 1, so it must be &lt;20, 1&gt;. The ages 20 are on pages 1, 3 and 4. A marker will probably accept the structure; do not copy the typo.</div></div>
<h3>b) Bitmap index on age</h3>
<p>One bit vector per distinct age, one bit per row in table order:</p>
${table(['Age', 'Ahmed', 'Sara', 'Youssef', 'Mariam', 'Omar', 'Nour', 'Karim', 'Salma'], [['18', '1', '0', '0', '1', '0', '0', '1', '0'], ['20', '0', '1', '0', '0', '1', '0', '0', '1'], ['22', '0', '0', '1', '0', '0', '1', '0', '0']])}
<h3>c) BRIN index on GPA (page = 2 rows or 4 pairs)</h3>
<p>One pair per table page with (min GPA, max GPA): &lt;(0.7, 1.0), 1&gt;, &lt;(1.3, 1.6), 2&gt;, &lt;(1.9, 2.1), 3&gt;, &lt;(2.3, 2.5), 4&gt;. Four pairs: one index page.</p></div>
${W('u1Midterm')}
<div class="prose">${K('Use the simulator\'s "sorted on age" switch to see the reverse case: when the table is sorted on age, the index on age is primary and could be sparse, and a BRIN on GPA would be useless because every page then mixes small and large GPA.')}
${T('Order matters. Write the table as pages first, then the dense level, then the sparse level. The marks are given for <em>each level partitioned across pages</em>: draw the page boundaries (4 pairs per index page), not one long list.')}
<h3>What the exam asks, in this unit</h3>
<ul><li>True or false with correction (two marks each).</li><li>Build a multilevel index until the top is one page, showing the pages (dense first level for a secondary index).</li><li>Bitmap vectors for a column with few distinct values.</li><li>A BRIN index: (min, max) per page of a column.</li><li>Know when each index is suitable: BRIN for ordered columns and analytical ranges, bitmap for a few distinct values, dense secondary for lookups on unsorted columns.</li></ul></div>`,
    },
  ],
};

// ---------------------------------------------------------------- QUESTIONS (o[0] is the correct option)
const Q = (id, m, q, o, why) => ({ id, m, q, o, why });
export const questions = [
  Q('l1-1', 'l1', 'The lecture calls the RDBMS "the 2nd most powerful piece of software". After which software?', ['The operating system', 'The network stack', 'The compiler', 'The web browser'], 'The OS manages the hardware and software of the computer and comes first. The RDBMS is called the backbone of an enterprise system (for example a bank).'),
  Q('l1-2', 'l1', 'Which RDBMS component moves pages between the data files on disk and main memory?', ['Buffer manager', 'Scheduler', 'Recovery manager', 'Log manager'], 'The buffer manager is the door to the data files. The scheduler orders transactions, and the log and recovery managers deal with the log and crashes.'),
  Q('l1-3', 'l1', 'Scenario 1: how many I/Os does it take to read a table with 1 billion rows?', ['It depends on how the table is stored on the disk (rows per page, file layout)', 'Exactly 1 billion, one per row', 'One I/O, because the file is read sequentially', 'Zero, because the table is cached in volatile memory'], 'An I/O moves a whole page, so the count is about rows / rows per page. That is why the slide answers "depends on how the table is stored".'),
  Q('l1-4', 'l1', 'What does the header of a page with variable-length records contain?', ['The number of rows in the page and a pointer to the beginning of each row', 'Only the page number', 'The key-pointer pairs of all indices of the table', 'The minimum and maximum value of every column'], 'Slide 24: the header holds the row count and one pointer per row, the body holds the rows. Min and max per page is what a BRIN index stores, outside the page.'),
  Q('l1-5', 'l1', '15 rows sorted on first name, 5 rows per page. Rows 10 and 11 are both "Mohamed". Why does "retrieve all Mohamed" read two pages?', ['Equal keys sit next to each other and this run straddles the boundary between page 2 and page 3', 'A binary search always reads exactly two pages', 'Sorted files store duplicates twice', 'Because the first name column is not indexed'], 'Row 10 is the last row of page 2 and row 11 the first row of page 3. When a page still ends with the key, the next page may continue the run (Scenario 2d).'),
  Q('l1-6', 'l1', 'Which statement defines a DENSE index?', ['At least one key-pointer pair for every row, or for every distinct value when there are duplicates', 'One pair for each page of the table', 'A pair only for the first row of the file', 'An index with more than one level'], 'Slide 30. One pair per page is the definition of a sparse index.'),
  Q('l1-7', 'l1', 'Why must a secondary index be dense?', ['The table is not sorted on the key, so a page minimum says nothing about the other values in the page', 'Because sparse indices cannot store duplicate keys', 'Because secondary indices are always multilevel', 'Because the pointers of a secondary index point to rows, not pages'], 'A sparse index gives a "sense of location", and that only works if the table is sorted on the indexed column.'),
  Q('l1-8', 'l1', 'Sparse index 10, 30, 50, 70 over pages (10,20) (30,40) (50,60) (70,80). You delete the row 40. What happens to the index?', ['Nothing: 40 is not the first key of its page', 'The pair for 30 is replaced by 40', 'The pair for 30 is deleted', 'A pair for 40 is deleted from the end'], 'Slide 35(b). A sparse index only stores page minimums. Deleting 40 leaves the page minimum 30 unchanged.'),
  Q('l1-9', 'l1', 'Same sparse index. Now you delete the row 30 (40 is still there). What is the new index entry for page 2?', ['<40, 2>: the pair 30 is replaced by 40', '<30, 2> stays, since page 2 still exists', 'The pair for page 2 is removed', '<20, 2>'], 'Slide 35(c). 30 was the page minimum, so the pair is rewritten with the new minimum 40.'),
  Q('l1-10', 'l1', 'Pages (10,20) (30,_) (40,50) (60,_) with sparse index 10, 30, 40, 60. Insert 15 with IMMEDIATE REORGANISATION. What is the index afterwards?', ['10, 20, 40, 60 (20 moves into page 2, so 30 becomes 20)', '10, 15, 30, 40, 60', '10, 30, 40, 60 (unchanged)', '10, 15, 40, 60'], 'Slide 37(b). 15 goes into page 1, so 20 is pushed into page 2 and becomes its first key: (20,30). The page minimum changed from 30 to 20.'),
  Q('l1-11', 'l1', 'Same file. Insert 25 into the full page (10,20) using an OVERFLOW BLOCK. What changes?', ['25 goes into an overflow block chained to page 1; the index does not change', 'Page 2 is rewritten and the index pair 30 becomes 25', 'A new pair <25, 1> is added to the sparse index', 'The whole file is sorted again immediately'], 'Slide 37(c). The overflow block is reorganised later. No page minimum changed, so the sparse index stays as it is.'),
  Q('l1-12', 'l1', 'Table pages (10,10) (10,20) (20,30) (30,30) (40,45). How many pairs does a dense index have with approach 1 (duplicate keys) and with approach 2 (point at the first new value)?', ['10 and 5', '10 and 10', '5 and 5', '5 and 10'], 'Approach 1 keeps one pair per row (10). Approach 2 keeps one pair per distinct value: 10, 20, 30, 40, 45 (5).'),
  Q('l1-13', 'l1', 'Sparse index with pairs 10, 10, 20, 30 over pages (10,10) (10,20) (20,30) (30,30). You look for all rows with 20. Where do you start reading the table?', ['Page 2, the page of the last pair with a smaller key (10)', 'Page 3, where the pair 20 points', 'Page 1, the first page', 'Page 4, the page of the pair 30'], 'Slide 40: "careful if looking for 20 or 30". The pair 20 points to page 3, but a 20 also sits in page 2. Start from the last pair with a smaller key and read forward.'),
  Q('l1-14', 'l1', 'What is the main problem of secondary-index approach 2 (buckets of pointers)?', ['Variable-size records (buckets) in the index', 'Every row needs an extra pointer field', 'It only works when the table is sorted', 'Excess disk space because every row has a pair'], 'Slide 41(b). Approach 1 wastes space, approach 3 needs an extra field in every record and is a maintenance nightmare.'),
  Q('l1-15', 'l1', 'What does a BRIN index store?', ['The minimum and maximum value of the column in each table page', 'One pair for each row of the table', 'A bit vector for each distinct value', 'A pointer to every duplicate of a key'], 'Slide 42. BRIN is a sparse index with a (min, max) range per page.'),
  Q('l1-16', 'l1', 'A BRIN index is built on a column whose values are scattered randomly over the pages. A narrow range query is run. What happens?', ['Nearly every page range overlaps the query, so almost all pages are read', 'Most pages are skipped, because the query is narrow', 'The index returns wrong answers', 'The query uses a binary search over the index'], 'The takeaway: BRIN is efficient for narrow-range search on a column with a huge range, and that needs the column to follow the physical order. Scattered values give every page a wide (min, max).'),
  Q('l1-17', 'l1', 'Lecture example: 1 million rows, 10 rows per page, 100 pairs per index page, SPARSE first level. How many index pages in total until the top level is one page?', ['1,011 (1,000 + 10 + 1)', '10,101 (10,000 + 100 + 1)', '1,000', '100,000'], '100,000 table pages give 100,000 pairs, 1,000 pages. Then 10 pages, then 1. The dense version would be 10,101.'),
  Q('l1-18', 'l1', 'Same index, memory of 15 pages. How many disk I/Os does a lookup cost?', ['2: the top two levels (11 pages) stay in memory, then read one level-1 page and the table page', '1: the whole index fits in memory', '3: one page per level', '1,011: the whole index must be loaded'], 'Levels 2 and 3 total 11 pages and fit in 15. The level-1 page (1,000 pages do not fit) and the table page are read from disk. With 1 page of memory it would be 3.'),
  Q('l1-m1', 'l1', 'Midterm 2025, Ex 1.1: "Table data are stored as pages on the hard disk." True or false?', ['True: the page is the unit of storage and of I/O', 'False: tables are stored row by row, without pages', 'False: only indices are paged', 'True, but only for fixed-length rows'], 'Pages are the unit of storage on the disk for tables and indices, for fixed and variable-length rows.'),
  Q('l1-m2', 'l1', 'Midterm 2025, Ex 1.2: "A conventional index is a heap of key-pointer pairs." True or false? Give the correction.', ['False: it is a list of key-pointer pairs', 'True: pairs are stored in any order', 'False: it is a tree of key-pointer pairs', 'False: it is a hash table of key-pointer pairs'], 'The lecture defines an index as a data structure that contains key-pointer pairs. The official correction is "list". Trees and hash tables are Lectures 2 and 3.'),
  Q('l1-m3', 'l1', 'Midterm 2025, Ex 1.3: "Insertion and deletion of rows needs to be reflected in the indices created on the affected table." True or false?', ['True: every index on the table must be updated', 'False: only the primary index is updated', 'False: indices are rebuilt only at restart', 'True, but only for deletions'], 'Slide 33: inserts add pairs to each index, deletes remove them, and updates change the key in the indices on the changed column.'),
  Q('pa1-m4', 'pa1', 'Midterm 2025, Ex 1.4: "A B+ tree node contains at most n keys and n + 3 pointers." What is the verdict and correction?', ['False: n + 1 pointers', 'True', 'False: at most n/2 keys', 'False: n pointers'], 'A node with n keys has n + 1 pointers (n + 1 children for a non-leaf, or n record pointers and one next-leaf pointer).'),
  Q('pa1-m5', 'pa1', 'Midterm 2025, Ex 1.5: "A B+ tree keeps O(log n) performance because the tree can get skewed." Verdict and correction?', ['False: it keeps O(log n) because it is always balanced', 'True', 'False: it is O(n) in all cases', 'False: because it is sorted'], 'All leaves are at the same depth, so the height stays logarithmic. A skewed tree would degrade to O(n).'),
  Q('pa1-m6', 'pa1', 'Midterm 2025, Ex 1.6: "In static hashing the number of buckets varies according to the number of records." Verdict and correction?', ['False: that is dynamic hashing; static hashing has a fixed number of buckets', 'True', 'False: static hashing has no buckets', 'False: the number of buckets varies only in extensible hashing, not in linear hashing'], 'Extensible and linear hashing are the dynamic ones: they grow the directory or the bucket count.'),
  Q('pa1-m7', 'pa1', 'Midterm 2025, Ex 1.7: "In extensible hashing, a directory can double in size with some insertions." True or false?', ['True: when a full bucket with i = j has to split', 'False: the directory never changes size', 'False: only the buckets double', 'True: after every insertion'], 'If the full bucket has j = i, the directory needs a new bit, so it doubles. If j < i, only the bucket splits.'),
  Q('pa1-m8', 'pa1', 'Midterm 2025, Ex 1.8: "In linear hashing, overflow buckets can be used when the designated bucket is full and the records in the table are below the utilisation rate." True or false?', ['True: a new bucket is added only when utilisation reaches the threshold, so an overflow bucket absorbs the extra record until then', 'False: linear hashing never uses overflow buckets', 'False: a full bucket always splits at once', 'True, but only in static hashing'], 'Linear hashing splits one bucket per expansion, in order, not the one that overflowed. Until utilisation is reached, a full bucket gets an overflow bucket.'),
  Q('pa1-m9', 'pa1', 'Midterm 2025, Ex 1.9: "Logical planning is part of the logs and recovery module within the RDBMS." Verdict and correction?', ['False: it is part of the query processor', 'True', 'False: it is part of the buffer manager', 'False: it is part of the transaction manager'], 'Look at the architecture figure: planning belongs to the query processor.'),
  Q('pa1-m10', 'pa1', 'Midterm 2025, Ex 1.10: "The logical planner chooses plans that minimise the number of rows to operate on as early as possible." True or false?', ['True: it pushes selections and projections down to shrink intermediate results', 'False: it maximises the rows early to keep options open', 'False: it only decides the order of the pages', 'False: it chooses the index to use'], 'Lecture 5: fewer rows early means smaller intermediate results and a smaller plan cost.'),
  Q('pa1-1', 'pa1', 'PA1-1: "With two levels of secondary indices, any of them can be either sparse or dense." Verdict?', ['False: the first level (next to the table) must be dense', 'True', 'False: both levels must be dense', 'False: both levels must be sparse'], 'The first level of a secondary multilevel index must be dense. The upper levels index pages of the level below and are sparse.'),
  Q('pa1-2', 'pa1', 'PA1-1: "You can only use a sparse index if the table is sorted by the search key, while a dense index can be used for any search key." Verdict?', ['True: sparse indices give a sense of location, so they need sorted data', 'False: a sparse index works on any column', 'False: a dense index also needs sorted data', 'True, but only for the primary key'], 'A page minimum locates a value only if the pages are sorted on that column. A dense index lists every row and does not care about the order.'),
  Q('pa1-3', 'pa1', 'PA1-1: "An index on a candidate key that may have duplicate values, where the table is not clustered or sorted by this key, can be classified as a primary index." Verdict?', ['False: any index on a column that does not sort the table is secondary', 'True: a candidate key always gives a primary index', 'True, because the index is dense', 'False: it is a BRIN index'], 'Primary vs secondary depends only on whether the table is sorted on the indexed column.'),
  Q('pa1-4', 'pa1', 'PA1-1 #6: "A primary index is a non-dense index because it is the main index of a table requiring it to be most efficient." What is the official verdict and the argument the course means?', ['True: the table is sorted on the key, which allows one pair per page (sparse); it may also be dense', 'False: primary indices are always dense', 'True: because primary indices have fewer levels', 'False: only secondary indices can be non-dense'], 'The official answer is True with "it requires the table to be ordered on the indexing attribute". Be careful: the lecture also shows a dense primary index. "Most efficient" is not the reason.'),
  Q('pa1-5', 'pa1', 'PA1-1 #7: "A clustered index is a non-dense index because sorting is needed to keep the duplicate values together." What does the official answer say?', ['True: each entry points at the page with the first value (pivot) of its cluster of duplicates', 'False: a clustered index is always dense', 'True: because clustered indices need no pointers', 'False: sorting is never needed for duplicates'], 'Official verdict: True. The index has one pair per cluster of equal keys (approach 2), not one per row. By the lecture\'s wording that is still "at least one instance per value", so the course means "not one pair per row".'),
  Q('pa1-6', 'pa1', 'PA1-2: blocks hold 3 records or 10 pairs. A table has n = 30,000 rows. How many blocks does a SPARSE index need?', ['1,000', '3,000', '10,000', '300'], 'The table has 30,000 / 3 = 10,000 blocks. A sparse index has one pair per table block: 10,000 / 10 = 1,000 = n/30. A dense index would need 3,000.'),
  Q('pa1-7', 'pa1', 'PA1-3: the worst-case size of a dense multilevel index with 10 pairs per block is (n − 1)/9 blocks. For n = 1,000,000, how many blocks?', ['111,111', '100,000', '1,000,000', '11,111'], '100,000 + 10,000 + 1,000 + 100 + 10 + 1 = 111,111 = (10^6 − 1)/9.'),
  Q('pa1-8', 'pa1', 'PA1-3 sparse: 3 rows per block, 10 pairs per block, n = 30,000. Total blocks of the sparse multilevel index?', ['1,111', '3,333', '10,000', '1,000'], 'Table blocks: 10,000. Index levels: 1,000 + 100 + 10 + 1 = 1,111 = (30,000 − 3)/27.'),
  Q('pa1-9', 'pa1', 'PA1-4: 16 rows, 2 per page, F = 50, 80, 100, 100, 100, 150, 150, 200, 200, 300, 410, 410, 410, 420, 430, 450. Level 1 is dense with one pair per distinct value, and there are two sparse levels above. How many index pages in total?', ['10 (5 + 3 + 2)', '14 (8 + 4 + 2)', '8', '16'], 'There are 10 distinct values: 5 pages. Level 2 has 5 pairs: 3 pages. Level 3 has 3 pairs: 2 pages. With one pair per row it would be 8 + 4 + 2 = 14.'),
  Q('pa1-10', 'pa1', 'PA1-5 f: Tweety\'s age changes from 28 to 29. Which indices must be updated?', ['Only the secondary index on age', 'The primary dense and sparse indices on Char ID', 'All three indices', 'None, because the table page is simply rewritten'], 'The primary indices are keyed on Char ID, which did not change. The secondary index holds the old age, so the pair 28 becomes 29, in place because it is still the smallest.'),
  Q('pa1-11', 'pa1', 'PA1-5 d: the full 8-row table (2 rows per page, 4 pairs per index page) gets a 9th row. How many pages do the table and the dense primary index need afterwards?', ['Table 5 pages, dense primary index 3 pages', 'Table 4 pages, dense primary index 2 pages', 'Table 5 pages, dense primary index 2 pages', 'Table 5 pages, dense primary index 5 pages'], 'All 4 table pages are full, so the 9th row starts page 5. The dense index has 9 pairs: 3 pages of at most 4.'),
  Q('pa1-12', 'pa1', 'Midterm 2025, Ex 2a: the table is sorted on GPA (Ahmed 18 and Sara 20 in page 1). In the dense level on age, which pair belongs to Sara?', ['<20, 1>', '<20, 2>', '<18, 1>', '<22, 1>'], 'Sara is aged 20 and sits in table page 1. The official figure prints <20, 2> by mistake. The 20-year-olds are in pages 1, 3 and 4.'),
  Q('pa1-13', 'pa1', 'Midterm 2025, Ex 2c: BRIN on GPA, 2 rows per page, table sorted on GPA (0.7, 1.0, 1.3, 1.6, 1.9, 2.1, 2.3, 2.5). Which pair is stored for table page 3?', ['<(1.9, 2.1), 3>', '<(1.3, 1.6), 3>', '<(2.1, 2.3), 3>', '<(1.9, 2.5), 3>'], 'Page 3 holds Omar (1.9) and Nour (2.1), so min = 1.9 and max = 2.1. All four pairs fit in one index page.'),
];

export const glossary = [
  ['RDBMS', 'Relational database management system: the program that creates, updates and manages relational databases.', 'l1'],
  ['Page (block)', 'The unit of storage on the disk and of every I/O. Its size depends on the mechanics of the disk (related to the cylinder size).', 'l1'],
  ['Database I/O', 'Reading or writing data between disk and memory. The cost measure of this unit: count page reads and writes.', 'l1'],
  ['Volatile memory', 'Fast, small, expensive memory (main memory, cache, buffer) that loses its data when the power is off.', 'l1'],
  ['Nonvolatile memory', 'Slow, cheap, large storage (HDD, SSD) whose data survives power off.', 'l1'],
  ['Cylinder', 'The set of tracks under all disk heads at one arm position.', 'l1'],
  ['Fixed-length records', 'Page layout with equal-size chunks, one row per chunk.', 'l1'],
  ['Variable-length records', 'Page layout with a header (row count and one pointer per row) and a body holding the rows.', 'l1'],
  ['Index', 'A data structure of key-pointer pairs. The key is a column value and the pointer is the address (page) of a row.', 'l1'],
  ['Key-pointer pair', 'One index entry, for example <Mohamed, 4>: key = first name, pointer = page 4.', 'l1'],
  ['Dense index', 'A pair for every row, or at least one instance of every distinct value. Works for any column.', 'l1'],
  ['Sparse index', 'One pair per table page (typically about 10% of the pairs). Needs the table sorted on the key.', 'l1'],
  ['Primary index', 'An index on the column the table is sorted by. May be dense or sparse.', 'l1'],
  ['Secondary index', 'An index on a column the table is not sorted by. Must be dense.', 'l1'],
  ['Clustered index', 'An index on a column the table is sorted by, so that duplicate values sit together; entries point at the first value of each cluster.', 'pa1'],
  ['Overflow block', 'An extra block chained to a full page to hold a new row without shifting rows. Reorganised later.', 'l1'],
  ['Immediate reorganisation', 'Making room for an insert at once by pushing rows into the next page and updating the index.', 'l1'],
  ['Bucket (secondary index)', 'A variable-size block listing the pointers to all rows with one key (duplicates approach 2).', 'l1'],
  ['Chained records', 'Duplicates approach 3 for secondary indices: each row holds a pointer to the next row with the same key.', 'l1'],
  ['BRIN', 'Block-range index: a sparse index storing the minimum and maximum of a column for each table page. Skips pages that cannot match.', 'l1'],
  ['Multilevel index', 'An index built on an index, until the top level is one page. The first level is dense for a secondary index; higher levels are sparse.', 'l1'],
  ['Index scan vs sequential scan', 'Using an index (O(log n) to find the start) versus reading all table pages (O(n)).', 'pa1'],
  ['Bitmap index', 'One bit vector per distinct value of a column, one bit per row. Good for few distinct values (midterm 2025 Ex 2b).', 'pa1'],
];

export const cheat = [
  ['l1', 'Dense vs sparse vs secondary', ['Dense: a pair per row (or per distinct value). Works for any column.', 'Sparse: a pair per page. Needs the table sorted on the key.', 'Primary: table sorted on the key (dense or sparse). Secondary: not sorted, must be dense.', 'Index pages: dense n/p, sparse n/(r·p), table n/r.']],
  ['l1', 'Maintenance rules', ['Insert or delete touches every index of the table; update touches only indices on the changed column.', 'Dense: always add or remove a pair.', 'Sparse: only a change of a page minimum reaches the index.', 'Full page: shift rows (immediate reorganisation) or chain an overflow block. Conventional indices cost O(n) to update.']],
  ['l1', 'Duplicate keys', ['Dense primary: (1) duplicate keys, (2) point at the first new value, (3) one value per page.', 'Sparse: start from the last pair with a SMALLER key, read forward.', 'Secondary: (1) duplicate pairs, (2) buckets of pointers (variable size), (3) chain the records (extra field, hard to maintain).']],
  ['l1', 'BRIN and multilevel', ['BRIN: (min, max) per page; skips pages. Good for analytical queries and narrow ranges on an ordered column with a huge range. Useless on scattered values.', 'Multilevel: add levels until the top is one page; each higher level is sparse.', 'Lecture example: 100,000 table pages, levels 1,000, 10, 1 = 1,011 pages. Memory 15 pages gives 2 disk I/Os.']],
  ['pa1', 'PA1 formulas and the midterm', ['PA1-2: n/3, n/10, n/30.', 'PA1-3 worst case: dense (n − 1)/9, sparse (n − 3)/27 (geometric series).', 'PA1-4: dense level of distinct values pointing at first occurrence, then sparse levels.', 'Midterm 2025: dense multilevel on age (secondary, sorted on GPA), bitmap on age, BRIN on GPA. Sara\'s pair is <20, 1>.']],
];
