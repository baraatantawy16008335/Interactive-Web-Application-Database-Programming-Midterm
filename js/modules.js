// Course content, one file per lecture + lab pair in js/content/.
import * as u1 from './content/u1.js';
import * as u2 from './content/u2.js';
import * as u3 from './content/u3.js';
import * as u4 from './content/u4.js';
import * as u5 from './content/u5.js';

export const UNITS = [u1, u2, u3, u4, u5];
export const MODULES = [...UNITS.map(u => u.lecture), ...UNITS.map(u => u.lab)];
export const byId = Object.fromEntries(MODULES.map(m => [m.id, m]));
