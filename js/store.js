// Per-browser study progress. Every access is guarded: storage can be unavailable.
const KEY = 'dbp-progress-v1';
const blank = () => ({ read: {}, scores: {}, quiz: {}, cards: {}, last: null });

let state = load();
const listeners = new Set();

function load() {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return blank(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: progress lives for this tab only */ }
  listeners.forEach(fn => fn(state));
}

export const getState = () => state;
export const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };

export function toggleRead(modId, secId) {
  const k = `${modId}/${secId}`;
  if (state.read[k]) delete state.read[k]; else state.read[k] = Date.now();
  save();
  return !!state.read[k];
}
export const isRead = (modId, secId) => !!state.read[`${modId}/${secId}`];
export function moduleProgress(mod) {
  const n = mod.sections.filter(s => isRead(mod.id, s.id)).length;
  return n / mod.sections.length;
}
export function setLast(route) { state.last = route; save(); }

export function recordScore(id, right, total) { state.scores[id] = { right, total, at: Date.now() }; save(); }

// quiz answers keyed by question id: last outcome + counts
export function recordAnswer(qid, correct) {
  const q = state.quiz[qid] || { right: 0, wrong: 0 };
  correct ? q.right++ : q.wrong++;
  q.last = correct;
  state.quiz[qid] = q;
  save();
}

// flashcards: box 0..3 (Leitner-style); higher box = known better
export function rateCard(cid, known) {
  const c = state.cards[cid] || { box: 0 };
  c.box = known ? Math.min(3, c.box + 1) : 0;
  c.at = Date.now();
  state.cards[cid] = c;
  save();
}
export const cardBox = cid => state.cards[cid]?.box ?? 0;

export function resetAll() { state = blank(); save(); }
