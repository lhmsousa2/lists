// Pure data rules: no DOM, no storage. Tested in tests/model.test.js.

export const SCHEMA = 1;
export const LISTS = ['todo', 'shop'];
export const STARTER_CATEGORIES = {
  todo: ['Personal', 'Work', 'Admin', 'Home'],
  shop: ['Tech', 'Home', 'Food', 'Clothes'],
};
export const NO_CATEGORY = '__none';
export const MAX_TITLE = 120;
export const MAX_CATEGORY = 30;

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function newState() {
  const lists = {};
  for (const l of LISTS) lists[l] = { categories: STARTER_CATEGORIES[l].map((name) => ({ id: uid(), name })), items: [] };
  return { version: SCHEMA, lists };
}

// ---------- dates (local time, 'YYYY-MM-DD') ----------

export function dateStr(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return dateStr(parseDate(s)) === s; // rejects 2026-02-31 etc.
}

// Whole days from today to due (negative = overdue). Safe across daylight-saving changes.
export function daysUntil(due, today) {
  return Math.round((parseDate(due) - parseDate(today)) / 86400000);
}

// 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | null
export function dueStatus(due, today) {
  if (!due) return null;
  const n = daysUntil(due, today);
  if (n < 0) return 'overdue';
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 7) return 'week';
  return 'later';
}

export function dueLabel(due, today) {
  const st = dueStatus(due, today);
  const d = parseDate(due);
  const sameYear = d.getFullYear() === parseDate(today).getFullYear();
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  if (st === 'overdue') return `Overdue · ${md}`;
  if (st === 'today') return 'Today';
  if (st === 'tomorrow') return 'Tomorrow';
  if (st === 'week') return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return md;
}

// ---------- lists ----------

// Open items: priority 1 first, then earliest due date (no date last), then oldest first.
export function sortOpen(items) {
  return items
    .filter((i) => !i.doneAt)
    .sort((a, b) => a.priority - b.priority || cmpDue(a.due, b.due) || a.createdAt - b.createdAt);
}

function cmpDue(a, b) {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : 1;
}

// Done items: most recently finished first.
export function sortDone(items) {
  return items.filter((i) => i.doneAt).sort((a, b) => b.doneAt - a.doneAt);
}

export function matchesFilter(item, filter) {
  if (!filter || filter === 'all') return true;
  if (filter === NO_CATEGORY) return !item.categoryId;
  return item.categoryId === filter;
}

// To-dos that need attention now (overdue or due today).
export function dueCounts(items, today) {
  let overdue = 0;
  let dueToday = 0;
  for (const i of items) {
    if (i.doneAt) continue;
    const st = dueStatus(i.due, today);
    if (st === 'overdue') overdue++;
    else if (st === 'today') dueToday++;
  }
  return { overdue, dueToday };
}

export function cleanCategoryName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_CATEGORY);
}

export function categoryNameTaken(list, name, exceptId = null) {
  const n = name.toLowerCase();
  return list.categories.some((c) => c.id !== exceptId && c.name.toLowerCase() === n);
}

// ---------- validation / migration ----------

function validItem(i, list) {
  return (
    i && typeof i === 'object' &&
    typeof i.id === 'string' && i.id &&
    typeof i.title === 'string' && i.title.trim() &&
    Number.isInteger(i.priority) && i.priority >= 1 && i.priority <= 4 &&
    (i.categoryId === null || typeof i.categoryId === 'string') &&
    typeof i.notes === 'string' &&
    (i.due === null || (list === 'todo' && isDateStr(i.due))) &&
    Number.isFinite(i.createdAt) &&
    (i.doneAt === null || Number.isFinite(i.doneAt))
  );
}

export function validateState(s) {
  if (!s || typeof s !== 'object' || s.version !== SCHEMA || !s.lists || typeof s.lists !== 'object') return false;
  for (const l of LISTS) {
    const list = s.lists[l];
    if (!list || !Array.isArray(list.categories) || !Array.isArray(list.items)) return false;
    if (!list.categories.every((c) => c && typeof c.id === 'string' && c.id && typeof c.name === 'string' && c.name.trim())) return false;
    if (!list.items.every((i) => validItem(i, l))) return false;
  }
  return true;
}

// Bring older/partial data up to the current shape. Also repairs items pointing at a deleted category.
export function migrate(s) {
  if (!s || typeof s !== 'object') return s;
  if (s.version === SCHEMA && s.lists) {
    for (const l of LISTS) {
      const list = s.lists[l];
      if (!list || !Array.isArray(list.categories) || !Array.isArray(list.items)) continue;
      const ids = new Set(list.categories.map((c) => c?.id));
      for (const i of list.items) {
        if (!i || typeof i !== 'object') continue;
        if (i.categoryId && !ids.has(i.categoryId)) i.categoryId = null;
        i.notes ??= '';
        i.due ??= null;
        i.doneAt ??= null;
      }
    }
  }
  return s;
}

// ---------- notes ----------

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;

// Trailing punctuation usually ends the sentence, not the link. A ")" is kept when it closes a "(" inside the URL
// (e.g. https://en.wikipedia.org/wiki/Foo_(bar)).
function trimUrl(u) {
  for (;;) {
    const t = u.replace(/[.,;:!?\]]+$/, '');
    const opens = (t.match(/\(/g) || []).length;
    const closes = (t.match(/\)/g) || []).length;
    if (t.endsWith(')') && closes > opens) u = t.slice(0, -1);
    else return t;
  }
}

export function findLinks(text) {
  return [...String(text).matchAll(URL_RE)].map((m) => trimUrl(m[0]));
}

export function hrefFor(url) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// Escaped HTML with http(s)/www links turned into anchors. Only http(s) hrefs are ever produced.
export function linkify(text) {
  const s = String(text);
  let out = '';
  let last = 0;
  for (const m of s.matchAll(URL_RE)) {
    const url = trimUrl(m[0]);
    out += escapeHtml(s.slice(last, m.index));
    out += `<a href="${escapeHtml(hrefFor(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
    last = m.index + url.length;
  }
  return out + escapeHtml(s.slice(last));
}
