// Shared content helpers. Each section body is HTML; <div data-widget="x"> marks where a simulator mounts.
export const K = (t) => `<div class="callout key"><i class="ph ph-lightbulb"></i><div>${t}</div></div>`;
export const T = (t) => `<div class="callout trap"><i class="ph ph-warning"></i><div><strong>Exam trap.</strong> ${t}</div></div>`;
export const W = (name) => `<div class="bench" data-widget="${name}"></div>`;
export const terms = (list) => `<div class="term-grid">${list.map(([i, h, p]) => `<div class="term"><h4><i class="ph ph-${i}"></i>${h}</h4><p>${p}</p></div>`).join('')}</div>`;
export const compare = (a, b) => `<div class="compare">${[a, b].map(([icon, h, items]) => `<div><h4><i class="ph ph-${icon}"></i>${h}</h4><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`).join('')}</div>`;
export const steps = (list) => `<div class="steps">${list.map(([h, p]) => `<div><div><strong>${h}</strong><span>${p}</span></div></div>`).join('')}</div>`;
const escCode = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Code block. Pass RAW code (not escaped); lang is a short label shown above it.
export const code = (src, lang = '') => `${lang ? `<div class="tiny muted" style="margin:12px 0 -6px;font-family:var(--mono)">${lang}</div>` : ''}<pre class="code">${escCode(src.replace(/^\n/, '').replace(/\s+$/, ''))}</pre>`;
// Table: head = ['A','B'], rows = [['a','b'], ...] (cells may contain HTML)
export const table = (head, rows) => `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
// "Not in the midterm" note (used only where the doctor's email excludes content)
export const OUT = (t) => `<div class="callout"><i class="ph ph-prohibit"></i><div><strong>Not in the midterm.</strong> ${t}</div></div>`;
