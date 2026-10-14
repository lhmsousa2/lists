// UI: renders the two lists + settings, handles taps. Rules live in model.js, storage in store.js.
import * as M from './model.js';
import * as Store from './store.js';

const $ = (s) => document.querySelector(s);
const esc = M.escapeHtml;
const TEXT = {
  todo: { title: 'To-Do', one: 'task', done: 'Done', doneVerb: 'Done', emptyIcon: '✓', emptyTitle: 'Nothing to do', emptyHint: 'Tap + to add a task.' },
  shop: { title: 'Shopping', one: 'item', done: 'Bought', doneVerb: 'Bought', emptyIcon: '🛍️', emptyTitle: 'Nothing to buy', emptyHint: 'Tap + to add something you want to buy.' },
  settings: { title: 'Settings' },
};
const PRIORITY_DEFAULT = 3;

let { state, recovered } = Store.load();
let tab = 'todo';
const filter = { todo: 'all', shop: 'all' };
const doneOpen = { todo: false, shop: false };

const today = () => M.dateStr(new Date());

// Apply a change, save it, re-render. With undoable=true the toast offers Undo back to the previous state.
function change(mutate, message = '', undoable = false) {
  const before = JSON.stringify(state);
  mutate();
  if (!Store.save(state)) toast('⚠️ Could not save. Export a backup from Settings.');
  else if (message) toast(message, undoable ? before : null);
  render();
}

// ---------- toast ----------
let toastTimer;
let undoSnapshot = null;
function toast(msg, snapshot = null) {
  undoSnapshot = snapshot;
  $('#toast-text').textContent = msg;
  $('#toast-undo').hidden = !snapshot;
  const el = $('#toast');
  el.classList.toggle('has-undo', !!snapshot);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    undoSnapshot = null;
  }, snapshot ? 5000 : 2500);
}
$('#toast-undo').addEventListener('click', () => {
  if (!undoSnapshot) return;
  const restored = JSON.parse(undoSnapshot);
  undoSnapshot = null;
  state = restored;
  if (!Store.save(state)) toast('⚠️ Could not save. Export a backup from Settings.');
  else toast('Undone');
  render();
});

// ---------- theme (per device) ----------
const THEME_KEY = 'lists.theme';
function theme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}
function setTheme(t) {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* per-device convenience only */
  }
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

// ---------- rendering ----------
function render() {
  const t = today();
  $('#topbar-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  $('#topbar-title').textContent = TEXT[tab].title;
  for (const v of ['todo', 'shop', 'settings']) $(`#view-${v}`).hidden = v !== tab;
  for (const b of document.querySelectorAll('.tabbar button')) b.classList.toggle('active', b.dataset.tab === tab);
  $('#fab').hidden = tab === 'settings';
  $('#fab').setAttribute('aria-label', tab === 'shop' ? 'Add item' : 'Add task');

  const { overdue, dueToday } = M.dueCounts(state.lists.todo.items, t);
  const badge = $('#todo-count');
  badge.hidden = !(overdue + dueToday);
  badge.textContent = overdue + dueToday;

  if (tab === 'settings') renderSettings();
  else renderList(tab, t);
}

function renderList(l, t) {
  const list = state.lists[l];
  const cats = new Map(list.categories.map((c) => [c.id, c.name]));
  if (filter[l] !== 'all' && filter[l] !== M.NO_CATEGORY && !cats.has(filter[l])) filter[l] = 'all';
  const f = filter[l];
  const open = M.sortOpen(list.items);
  const done = M.sortDone(list.items);
  const shownOpen = open.filter((i) => M.matchesFilter(i, f));
  const shownDone = done.filter((i) => M.matchesFilter(i, f));
  const countFor = (id) => open.filter((i) => M.matchesFilter(i, id)).length;
  const hasUncategorized = list.items.some((i) => !i.categoryId);

  const chip = (id, name) => {
    const n = countFor(id);
    return `<button class="chip ${f === id ? 'on' : ''}" data-action="filter" data-id="${esc(id)}">${esc(name)}${n ? ` <span class="chip-n">${n}</span>` : ''}</button>`;
  };
  let html = '';
  if (recovered && l === 'todo') {
    html += `<div class="banner bad">Your saved data couldn't be read, so the app started fresh. A copy was kept on this phone. If you have a backup, import it in Settings.</div>`;
  }
  html += `<div class="chips scroll" role="toolbar" aria-label="Filter by category">
    ${chip('all', 'All')}
    ${list.categories.map((c) => chip(c.id, c.name)).join('')}
    ${hasUncategorized ? chip(M.NO_CATEGORY, 'No category') : ''}
  </div>`;

  if (l === 'todo') {
    const { overdue, dueToday } = M.dueCounts(list.items, t);
    const parts = [];
    if (overdue) parts.push(`${overdue} overdue`);
    if (dueToday) parts.push(`${dueToday} due today`);
    if (parts.length) html += `<div class="banner bad">⏰ ${parts.join(' · ')}</div>`;
  }

  if (shownOpen.length) {
    html += `<ul class="items">${shownOpen.map((i) => row(i, l, cats, t)).join('')}</ul>`;
  } else if (f === 'all') {
    html += `<div class="empty"><div class="empty-icon">${TEXT[l].emptyIcon}</div><h2>${TEXT[l].emptyTitle}</h2><p>${TEXT[l].emptyHint}</p></div>`;
  } else {
    const name = f === M.NO_CATEGORY ? 'No category' : cats.get(f);
    html += `<div class="empty small-empty"><p>Nothing open in <b>${esc(name)}</b>.</p></div>`;
  }

  if (shownDone.length) {
    html += `<details class="done-section" data-list="${l}" ${doneOpen[l] ? 'open' : ''}>
      <summary>${TEXT[l].done} <span class="muted">${shownDone.length}</span></summary>
      <ul class="items">${shownDone.map((i) => row(i, l, cats, t)).join('')}</ul>
      <button class="btn ghost small" data-action="clear-done">Clear ${shownDone.length === 1 ? 'this' : `all ${shownDone.length}`}</button>
    </details>`;
  }
  $(`#view-${l}`).innerHTML = html;
}

function row(i, l, cats, t) {
  const isDone = !!i.doneAt;
  const meta = [`<span class="prio p${i.priority}">P${i.priority}</span>`];
  if (i.categoryId && cats.has(i.categoryId)) meta.push(`<span class="badge">${esc(cats.get(i.categoryId))}</span>`);
  const st = M.dueStatus(i.due, t);
  if (isDone) {
    meta.push(`<span class="badge ok">${TEXT[l].doneVerb} ${new Date(i.doneAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>`);
  } else if (st) {
    const cls = st === 'overdue' || st === 'today' ? 'bad' : st === 'tomorrow' ? 'warn' : 'info';
    meta.push(`<span class="badge ${cls}">${esc(M.dueLabel(i.due, t))}</span>`);
  }
  const urgent = !isDone && (st === 'overdue' || st === 'today');
  const notes = !isDone && i.notes.trim() ? `<div class="item-notes">${M.linkify(i.notes.trim())}</div>` : '';
  return `<li class="item p${i.priority} ${isDone ? 'done' : ''} ${urgent ? 'urgent' : ''}">
    <button class="check" data-action="toggle" data-id="${esc(i.id)}" aria-label="${isDone ? 'Restore' : `Mark ${TEXT[l].doneVerb.toLowerCase()}`}">${isDone ? '✓' : ''}</button>
    <div class="item-body" data-action="edit" data-id="${esc(i.id)}" role="button" tabindex="0">
      <div class="item-title">${esc(i.title)}</div>
      <div class="item-meta">${meta.join('')}</div>
      ${notes}
    </div>
  </li>`;
}

function renderSettings() {
  const last = Store.lastBackup();
  const ago = last ? Math.floor((Date.now() - last) / 86400000) : null;
  const lastText = last == null ? 'Never backed up.' : ago === 0 ? 'Last backup: today.' : `Last backup: ${ago} day${ago === 1 ? '' : 's'} ago.`;
  const catCard = (l) => {
    const list = state.lists[l];
    const used = (id) => list.items.filter((i) => i.categoryId === id).length;
    return `<div class="card">
      <h3>${TEXT[l].title} categories</h3>
      <ul class="cat-rows">
        ${list.categories.map((c) => `<li>
          <button class="cat-name" data-action="rename-cat" data-list="${l}" data-id="${esc(c.id)}">${esc(c.name)} <span class="muted small">${used(c.id) || ''}</span></button>
          <button class="btn ghost small" data-action="rename-cat" data-list="${l}" data-id="${esc(c.id)}">Rename</button>
          <button class="btn danger small" data-action="delete-cat" data-list="${l}" data-id="${esc(c.id)}" aria-label="Delete ${esc(c.name)}">✕</button>
        </li>`).join('') || '<li class="muted small">No categories yet.</li>'}
      </ul>
      <button class="btn ghost small" data-action="add-cat" data-list="${l}">+ Add category</button>
    </div>`;
  };
  $('#view-settings').innerHTML = `
    <div class="card">
      <h3>Appearance</h3>
      <div class="segmented" role="radiogroup" aria-label="Theme">
        ${['system', 'light', 'dark'].map((t) => `<button role="radio" aria-checked="${theme() === t}" class="${theme() === t ? 'on' : ''}" data-action="theme" data-theme="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
      </div>
    </div>
    ${catCard('todo')}
    ${catCard('shop')}
    <div class="card">
      <h3>Backup</h3>
      <p class="muted small">Your lists live only on this phone. Removing the app or changing phones loses them unless you have a backup. Export saves a file to Files / iCloud Drive.</p>
      <p class="small ${ago == null || ago > 14 ? 'neg' : ''}">${lastText}</p>
      <div class="btn-row">
        <button class="btn primary" data-action="export">Export backup</button>
        <label class="btn ghost">Import backup<input type="file" accept="application/json,.json" id="import-file" hidden></label>
      </div>
    </div>
    <div class="card">
      <details class="howto">
        <summary><h3>Daily reminder (iPhone Shortcuts)</h3></summary>
        <p class="muted small">Web apps can't send their own notifications, so use the built-in Shortcuts app. About 2 minutes:</p>
        <ol class="small">
          <li>Open <b>Shortcuts</b> → <b>Automation</b> tab → <b>+</b>.</li>
          <li>Choose <b>Time of Day</b>, pick a time (e.g. 09:00), <b>Repeat: Daily</b>.</li>
          <li>Choose <b>Run Immediately</b> and turn off <b>Notify When Run</b>.</li>
          <li>Tap <b>Next</b> → <b>New Blank Automation</b> → <b>Add Action</b>.</li>
          <li>Add <b>Show Notification</b> and type e.g. “📝 Check your Lists”.</li>
          <li>Tap <b>Done</b>. Optional: a second one on Sundays saying “Export a Lists backup”.</li>
        </ol>
        <p class="muted small">Don't use an “Open URLs” action: it opens Safari, which has separate (empty) storage from the home-screen app.</p>
      </details>
    </div>
    <p class="muted small center">Lists · data stays on this phone</p>`;
}

// ---------- item dialog ----------
const dialog = $('#item-dialog');
const form = $('#item-form');
let editing = null; // { list, id } — id null when adding

function fillCategorySelect(l, selected) {
  const list = state.lists[l];
  const sel = form.elements.category;
  sel.innerHTML =
    `<option value="">No category</option>` +
    list.categories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('') +
    `<option value="__new">+ New category…</option>`;
  sel.value = selected && list.categories.some((c) => c.id === selected) ? selected : '';
  sel.dataset.prev = sel.value;
}

function updateNoteLinks() {
  const links = M.findLinks(form.elements.notes.value);
  const box = $('#note-links');
  box.hidden = !links.length;
  box.innerHTML = links.length
    ? `<span class="opt">Links</span>${links.map((u) => `<a href="${esc(M.hrefFor(u))}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>`).join('')}`
    : '';
}

function openItemDialog(l, id = null) {
  const item = id ? state.lists[l].items.find((i) => i.id === id) : null;
  if (id && !item) return;
  editing = { list: l, id };
  $('#item-dialog-title').textContent = item ? `Edit ${TEXT[l].one}` : `New ${TEXT[l].one}`;
  form.elements.title.value = item?.title ?? '';
  form.elements.title.placeholder = l === 'shop' ? 'e.g. 27" monitor' : 'e.g. Renew passport';
  form.elements.priority.value = String(item?.priority ?? PRIORITY_DEFAULT);
  const presetCat = filter[l] !== 'all' && filter[l] !== M.NO_CATEGORY ? filter[l] : '';
  fillCategorySelect(l, item ? item.categoryId : presetCat);
  $('#due-field').hidden = l !== 'todo';
  form.elements.due.value = item?.due ?? '';
  form.elements.notes.value = item?.notes ?? '';
  updateNoteLinks();
  $('#item-delete').hidden = !item;
  dialog.showModal();
  if (!item) form.elements.title.focus();
}

form.elements.notes.addEventListener('input', updateNoteLinks);
$('#due-clear').addEventListener('click', () => (form.elements.due.value = ''));
$('#item-cancel').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (ev) => {
  if (ev.target === dialog) dialog.close(); // tap on the dimmed backdrop
});

form.elements.category.addEventListener('change', (ev) => {
  const sel = ev.target;
  if (sel.value !== '__new') {
    sel.dataset.prev = sel.value;
    return;
  }
  const l = editing.list;
  const created = addCategory(l);
  fillCategorySelect(l, created ?? sel.dataset.prev);
});

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const title = form.elements.title.value.trim().slice(0, M.MAX_TITLE);
  if (!title) {
    form.elements.title.focus();
    toast('Give it a name first');
    return;
  }
  const { list: l, id } = editing;
  const list = state.lists[l];
  const catId = form.elements.category.value;
  const due = form.elements.due.value;
  const fields = {
    title,
    priority: Number(form.elements.priority.value) || PRIORITY_DEFAULT,
    categoryId: catId && list.categories.some((c) => c.id === catId) ? catId : null,
    notes: form.elements.notes.value.trim(),
    due: l === 'todo' && M.isDateStr(due) ? due : null,
  };
  if (id) {
    const item = list.items.find((i) => i.id === id);
    if (item) change(() => Object.assign(item, fields));
  } else {
    change(() => list.items.push({ id: M.uid(), ...fields, createdAt: Date.now(), doneAt: null }), `Added to ${TEXT[l].title}`);
  }
  dialog.close();
});

$('#item-delete').addEventListener('click', () => {
  const { list: l, id } = editing;
  const list = state.lists[l];
  dialog.close();
  change(() => (list.items = list.items.filter((i) => i.id !== id)), 'Deleted', true);
});

// ---------- categories ----------
// Returns the new category id, or null if cancelled/invalid.
function addCategory(l) {
  const list = state.lists[l];
  const name = M.cleanCategoryName(prompt(`New ${TEXT[l].title} category`));
  if (!name) return null;
  if (M.categoryNameTaken(list, name)) {
    toast(`“${name}” already exists`);
    return null;
  }
  const id = M.uid();
  change(() => list.categories.push({ id, name }), `Added “${name}”`);
  return id;
}

function renameCategory(l, id) {
  const list = state.lists[l];
  const cat = list.categories.find((c) => c.id === id);
  if (!cat) return;
  const name = M.cleanCategoryName(prompt('Rename category', cat.name));
  if (!name || name === cat.name) return;
  if (M.categoryNameTaken(list, name, id)) return toast(`“${name}” already exists`);
  change(() => (cat.name = name));
}

function deleteCategory(l, id) {
  const list = state.lists[l];
  const cat = list.categories.find((c) => c.id === id);
  if (!cat) return;
  const n = list.items.filter((i) => i.categoryId === id).length;
  const msg = n ? `Delete “${cat.name}”? Its ${n} item${n === 1 ? '' : 's'} will move to “No category”.` : `Delete “${cat.name}”?`;
  if (!confirm(msg)) return;
  change(() => {
    for (const i of list.items) if (i.categoryId === id) i.categoryId = null;
    list.categories = list.categories.filter((c) => c.id !== id);
  }, `Deleted “${cat.name}”`, true);
}

// ---------- taps ----------
document.addEventListener('click', async (ev) => {
  if (ev.target.closest('a')) return; // links in notes open normally
  const tabBtn = ev.target.closest('.tabbar button');
  if (tabBtn) {
    if (tab !== tabBtn.dataset.tab) {
      tab = tabBtn.dataset.tab;
      render();
      window.scrollTo(0, 0);
    }
    return;
  }
  if (ev.target.closest('#fab')) return openItemDialog(tab);

  const b = ev.target.closest('[data-action]');
  if (!b) return;
  const a = b.dataset.action;
  const l = b.dataset.list || tab;

  if (a === 'filter') {
    filter[l] = b.dataset.id;
    render();
  } else if (a === 'edit') {
    openItemDialog(l, b.dataset.id);
  } else if (a === 'toggle') {
    const item = state.lists[l].items.find((i) => i.id === b.dataset.id);
    if (!item) return;
    const msg = item.doneAt ? 'Restored' : `${TEXT[l].doneVerb} ✓`;
    change(() => (item.doneAt = item.doneAt ? null : Date.now()), msg, true);
  } else if (a === 'clear-done') {
    const list = state.lists[l];
    const ids = new Set(M.sortDone(list.items).filter((i) => M.matchesFilter(i, filter[l])).map((i) => i.id));
    if (!ids.size || !confirm(`Permanently delete ${ids.size} ${TEXT[l].done.toLowerCase()} item${ids.size === 1 ? '' : 's'}?`)) return;
    change(() => (list.items = list.items.filter((i) => !ids.has(i.id))), 'Cleared', true);
  } else if (a === 'add-cat') {
    addCategory(l);
  } else if (a === 'rename-cat') {
    renameCategory(l, b.dataset.id);
  } else if (a === 'delete-cat') {
    deleteCategory(l, b.dataset.id);
  } else if (a === 'theme') {
    setTheme(b.dataset.theme);
    render();
  } else if (a === 'export') {
    try {
      const r = await Store.exportBackup(state, today());
      if (r !== 'cancelled') toast('Backup exported');
    } catch (e) {
      toast(e.message);
    }
    render();
  }
});

// Keyboard: Enter/Space on a row opens it.
document.addEventListener('keydown', (ev) => {
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches?.('.item-body')) {
    ev.preventDefault();
    openItemDialog(tab, ev.target.dataset.id);
  }
});

// Remember whether the Done section is expanded ('toggle' doesn't bubble, so listen in capture phase).
document.addEventListener(
  'toggle',
  (ev) => {
    const d = ev.target;
    if (d.classList?.contains('done-section')) doneOpen[d.dataset.list] = d.open;
  },
  true,
);

document.addEventListener('change', async (ev) => {
  if (ev.target.id !== 'import-file') return;
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const imported = await Store.readBackup(file);
    const n = M.LISTS.reduce((s, l) => s + imported.lists[l].items.length, 0);
    if (!confirm(`Replace everything on this phone with this backup (${n} items)?`)) return;
    Store.keepSafetyCopy(state, 'import');
    state = imported;
    recovered = false;
    if (!Store.save(state)) toast('⚠️ Could not save. Export a backup from Settings.');
    else toast('Backup imported');
    render();
  } catch (e) {
    toast(e.message);
  }
});

// ---------- day changes ----------
// Re-render when the app comes back to the foreground and at midnight, so due dates stay correct.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});
function scheduleMidnight() {
  const n = new Date();
  const next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5);
  setTimeout(() => {
    render();
    scheduleMidnight();
  }, next - n);
}

// ---------- start ----------
render();
scheduleMidnight();
Store.requestPersistence();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW failed', e));
