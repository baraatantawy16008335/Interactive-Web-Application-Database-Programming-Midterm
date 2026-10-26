// Question bank and glossary, gathered from each unit file.
// In a question the FIRST option is always the correct one; options are shuffled when shown.
import { UNITS } from './modules.js';

export const QUESTIONS = UNITS.flatMap(u => u.questions);
export const GLOSSARY = UNITS.flatMap(u => u.glossary).map(([t, d, m], i) => ({ id: 'g' + i, t, d, m }));
export const CHEAT = UNITS.flatMap(u => u.cheat);
