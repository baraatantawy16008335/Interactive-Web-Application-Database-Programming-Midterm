# Interactive Web Application: Database Programming Midterm

An interactive study companion for **ICS502 Database Programming** (GIU, Winter 2026, Dr. Eng. Amal Yassien): Lectures 1 to 5 and Practice Assignments 1 to 5 as notes you can play with, built for midterm preparation.

**Scope follows the course emails:** conventional indices and RDBMS storage, B+ tree, hash, and multidimensional indices, and logical planning, each with its PA. The exam's formula sheet (the Lecture 5 equivalence rules and the B+ tree threshold table) has its own page, and the practice focuses on using it: applying the rules and reasoning about which rewrite is cheaper.

## What's inside

| Area | Content |
|---|---|
| **Lectures 1-5** | RDBMS storage and conventional indices (dense, sparse, primary, secondary, duplicates, BRIN, multilevel), B+ trees (n, thresholds, search, insert, delete), static, extensible and linear hashing, multidimensional indices (partitioned hashing, grid, KD-tree, quad tree, bitmap), and logical planning (algebraic laws, heuristics, size estimation, plan cost) |
| **PAs 1-5** | Every practice-assignment exercise worked step by step, with every structure drawn by the simulator engine |
| **Simulators** | Step-through B+ tree, extensible hashing, linear hashing, KD-tree and quad tree playgrounds, a grid and bitmap query lab, a size-estimation calculator, a plan rewriter and more |
| **Problem lab** | Build-it, calculate, spot-the-wrong-step and explain problems, including all of the 2025 midterm with corrected answers |
| **Practice** | Exam-style questions with explanations, flashcards with spaced repetition, a glossary, a printable cheat sheet and the formula sheet |

## Correct by construction

All trees, hash tables and estimates come from one small engine (`js/engine/`) that follows the lecture algorithms and the PA conventions. It is tested against every worked example in the slides, the PA solutions and the 2025 midterm (125 checks; run `node tests/bp.test.mjs`, `hash.test.mjs`, `md.test.mjs` and `cost.test.mjs`). Where an official solution has a slip, the app shows the correct version and says so:

- 2025 midterm, B+ tree "delete 21": the official answer loses keys 12 and 14. The correct tree has root [12].
- 2025 midterm, dense index on age: the official answer gives Sara the pair ⟨20, 2⟩, but she is on table page 1, so it is ⟨20, 1⟩.
- 2025 midterm, quad tree "insert D(40, 40)": the official answer swaps the NE and NW labels of B and D.
- PA4 bitmap: speed "1.82" should be 1.86. PA1 figure: Tweety's row is shown with another row's city and age.

Progress (sections understood, quiz history, flashcard boxes, solved problems) is saved in your browser's local storage.

## Run it

Static site, no build step. ES modules need to be served over HTTP:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Structure

```
index.html
css/                     styles, quiz, motion
js/app.js                router, home, module pages, quiz, flashcards, glossary, cheat sheet, search
js/problemlab-view.js    the Problem lab page
js/formula-view.js       the exam formula sheet
js/engine/               B+ tree, hashing, multidimensional and cost engines, plus SVG drawings
js/content/u1-u5.js      one file per lecture + PA: notes, questions, glossary, cheat sheet
js/content/problems.js   Problem lab exercises (built from the engine)
js/widgets/              the simulators (opsbench.js is the shared step player)
js/store.js              local progress
```

## Credits

The app framework (layout, router, quiz, flashcards, motion, service worker) is adapted from [Ahmed Atef Youssef's Data Engineering & Visualization study app](https://github.com/ahmedatefyoussef/Interactive-Web-Application-Data-Engineering-Visualization-Midterm), as in the [Software Construction & Testing](https://github.com/baraatantawy16008335/Interactive-Web-Application-Software-Construction-Testing-Midterm) and [Financial Technology](https://github.com/baraatantawy16008335/Interactive-Web-Application-Financial-Technology-Midterm) apps. Course content, the engine and the simulators are new.
