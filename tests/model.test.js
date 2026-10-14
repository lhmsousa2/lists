import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';

const item = (o) => ({ id: M.uid(), title: 'x', priority: 3, categoryId: null, notes: '', due: null, createdAt: 1, doneAt: null, ...o });

test('new state has both lists with starter categories and validates', () => {
  const s = M.newState();
  assert.deepEqual(Object.keys(s.lists), ['todo', 'shop']);
  assert.equal(s.lists.shop.categories[0].name, 'Tech');
  assert.ok(M.validateState(s));
});

test('open items sort by priority, then due date (none last), then oldest', () => {
  const items = [
    item({ id: 'a', priority: 2, createdAt: 1 }),
    item({ id: 'b', priority: 1, due: '2026-10-20', createdAt: 2 }),
    item({ id: 'c', priority: 1, createdAt: 3 }),
    item({ id: 'd', priority: 1, due: '2026-10-15', createdAt: 4 }),
    item({ id: 'e', priority: 2, createdAt: 0 }),
    item({ id: 'f', priority: 1, doneAt: 5 }),
  ];
  assert.deepEqual(M.sortOpen(items).map((i) => i.id), ['d', 'b', 'c', 'e', 'a']);
});

test('done items: most recent first, open ones excluded', () => {
  const items = [item({ id: 'a', doneAt: 10 }), item({ id: 'b' }), item({ id: 'c', doneAt: 20 })];
  assert.deepEqual(M.sortDone(items).map((i) => i.id), ['c', 'a']);
});

test('due status around today', () => {
  const t = '2026-10-14';
  assert.equal(M.dueStatus(null, t), null);
  assert.equal(M.dueStatus('2026-10-13', t), 'overdue');
  assert.equal(M.dueStatus('2026-10-14', t), 'today');
  assert.equal(M.dueStatus('2026-10-15', t), 'tomorrow');
  assert.equal(M.dueStatus('2026-10-20', t), 'week');
  assert.equal(M.dueStatus('2026-10-21', t), 'later');
  assert.equal(M.dueStatus('2026-11-02', '2026-10-31'), 'week'); // crosses daylight-saving end
  assert.equal(M.dueLabel('2026-10-12', t), 'Overdue · Oct 12');
  assert.equal(M.dueLabel('2027-01-05', t), 'Jan 5, 2027');
});

test('due counts ignore done items', () => {
  const t = '2026-10-14';
  const items = [item({ due: '2026-10-01' }), item({ due: '2026-10-14' }), item({ due: '2026-10-14', doneAt: 1 }), item({ due: '2026-10-30' })];
  assert.deepEqual(M.dueCounts(items, t), { overdue: 1, dueToday: 1 });
});

test('isDateStr rejects impossible dates', () => {
  assert.ok(M.isDateStr('2026-02-28'));
  assert.ok(!M.isDateStr('2026-02-31'));
  assert.ok(!M.isDateStr('2026-2-1'));
  assert.ok(!M.isDateStr(''));
});

test('category filter', () => {
  assert.ok(M.matchesFilter(item({ categoryId: 'x' }), 'all'));
  assert.ok(M.matchesFilter(item({ categoryId: 'x' }), 'x'));
  assert.ok(!M.matchesFilter(item({ categoryId: 'x' }), 'y'));
  assert.ok(M.matchesFilter(item({ categoryId: null }), M.NO_CATEGORY));
  assert.ok(!M.matchesFilter(item({ categoryId: 'x' }), M.NO_CATEGORY));
});

test('category names: cleaned and duplicate check is case-insensitive', () => {
  const list = { categories: [{ id: 'a', name: 'Tech' }] };
  assert.equal(M.cleanCategoryName('  Home   office  '), 'Home office');
  assert.equal(M.cleanCategoryName(null), '');
  assert.ok(M.categoryNameTaken(list, 'tech'));
  assert.ok(!M.categoryNameTaken(list, 'tech', 'a')); // renaming itself
});

test('validation rejects bad data', () => {
  const ok = M.newState();
  ok.lists.todo.items.push(item({ due: '2026-10-14' }));
  assert.ok(M.validateState(ok));
  const bad = (mut) => {
    const s = structuredClone(ok);
    mut(s);
    return M.validateState(s);
  };
  assert.ok(!bad((s) => (s.version = 99)));
  assert.ok(!bad((s) => (s.lists.todo.items[0].priority = 5)));
  assert.ok(!bad((s) => (s.lists.todo.items[0].title = '  ')));
  assert.ok(!bad((s) => (s.lists.todo.items[0].due = '14/10/2026')));
  assert.ok(!bad((s) => s.lists.shop.items.push(item({ due: '2026-10-14' })))); // shopping has no due dates
  assert.ok(!bad((s) => delete s.lists.shop));
  assert.ok(!M.validateState(null));
});

test('migrate drops links to deleted categories and fills missing fields', () => {
  const s = M.newState();
  s.lists.shop.items.push({ id: 'z', title: 'Desk', priority: 1, categoryId: 'gone', createdAt: 1 });
  M.migrate(s);
  assert.equal(s.lists.shop.items[0].categoryId, null);
  assert.equal(s.lists.shop.items[0].notes, '');
  assert.ok(M.validateState(s));
});

test('linkify escapes HTML and links only http(s)/www', () => {
  assert.equal(M.linkify('<b>hi</b>'), '&lt;b&gt;hi&lt;/b&gt;');
  assert.equal(
    M.linkify('see https://amazon.com/x?a=1&b=2.'),
    'see <a href="https://amazon.com/x?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">https://amazon.com/x?a=1&amp;b=2</a>.',
  );
  assert.match(M.linkify('www.ikea.com'), /href="https:\/\/www\.ikea\.com"/);
  assert.ok(!M.linkify('javascript:alert(1)').includes('<a'));
  assert.ok(!M.linkify('https://x.com/"onmouseover="alert(1)').includes('"onmouseover'));
  assert.deepEqual(M.findLinks('a https://a.com, b (www.b.com)'), ['https://a.com', 'www.b.com']);
});
