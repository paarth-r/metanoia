'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../todos-core.js');

const ROOT = path.join(__dirname, '..');
const sharedOf = (file) => {
  const s = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return s.slice(s.indexOf('/* SHARED-START */'), s.indexOf('/* SHARED-END */'));
};

test('the web and mobile copies have not drifted', () => {
  assert.strictEqual(sharedOf('todos-core.js'), sharedOf('mobile/todos-core.js'),
    'todos-core.js and mobile/todos-core.js SHARED regions differ');
});

test('isoOf uses local time, not UTC', () => {
  // 11pm local on the 29th is already the 30th in UTC for western zones.
  assert.strictEqual(C.isoOf(new Date(2026, 7, 29, 23, 30)), '2026-08-29');
  assert.strictEqual(C.isoOf(new Date(2026, 0, 1, 0, 0)), '2026-01-01');
  assert.strictEqual(C.isoOf(new Date(2026, 11, 31)), '2026-12-31');
});

test('shiftIso crosses month and year boundaries', () => {
  assert.strictEqual(C.shiftIso('2026-08-31', 1), '2026-09-01');
  assert.strictEqual(C.shiftIso('2026-09-01', -1), '2026-08-31');
  assert.strictEqual(C.shiftIso('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(C.shiftIso('2028-02-28', 1), '2028-02-29'); // leap year
});

test('a one-off todo appears only on its own date', () => {
  const t = { id: 'a', body: 'Order glove', repeats: false, on_date: '2026-08-27' };
  assert.ok(C.todoAppearsOn(t, '2026-08-27'));
  assert.ok(!C.todoAppearsOn(t, '2026-08-26'));
  assert.ok(!C.todoAppearsOn(t, '2026-08-28'));
});

test('a repeating todo runs from starts_on forever until ends_on', () => {
  const t = { id: 'b', body: 'Vitamins', repeats: true, starts_on: '2026-08-25', ends_on: null };
  assert.ok(!C.todoAppearsOn(t, '2026-08-24'), 'not before it starts');
  assert.ok(C.todoAppearsOn(t, '2026-08-25'), 'inclusive on the first day');
  assert.ok(C.todoAppearsOn(t, '2030-01-01'), 'runs forever with no end');

  const ended = Object.assign({}, t, { ends_on: '2026-08-28' });
  assert.ok(C.todoAppearsOn(ended, '2026-08-28'), 'inclusive on the last day');
  assert.ok(!C.todoAppearsOn(ended, '2026-08-29'), 'gone the day after');
});

test('deleting a repeating todo leaves the days already ticked intact', () => {
  // Delete sets ends_on to yesterday; the tick on an earlier day must survive.
  const todos = [{ id: 'b', body: 'Vitamins', repeats: true, starts_on: '2026-08-25', ends_on: '2026-08-27' }];
  const ticks = [{ todo_id: 'b', on_date: '2026-08-26' }];
  assert.deepStrictEqual(C.resolveTodosForDate(todos, ticks, '2026-08-26'),
    [{ id: 'b', body: 'Vitamins', repeats: true, done: true }]);
  assert.deepStrictEqual(C.resolveTodosForDate(todos, ticks, '2026-08-28'), []);
});

test('a tick only counts on its own date, so each day starts fresh', () => {
  const todos = [{ id: 'b', body: 'Vitamins', repeats: true, starts_on: '2026-08-25', ends_on: null }];
  const ticks = [{ todo_id: 'b', on_date: '2026-08-26' }];
  assert.strictEqual(C.resolveTodosForDate(todos, ticks, '2026-08-26')[0].done, true);
  assert.strictEqual(C.resolveTodosForDate(todos, ticks, '2026-08-27')[0].done, false,
    'a new day is not pre-ticked by yesterday');
  assert.strictEqual(C.resolveTodosForDate(todos, ticks, '2026-08-25')[0].done, false,
    'ticking today does not backfill yesterday');
});

test('repeating and one-off todos coexist on one date, repeats first', () => {
  const todos = [
    { id: 'a', body: 'Order glove', repeats: false, on_date: '2026-08-27' },
    { id: 'b', body: 'Vitamins', repeats: true, starts_on: '2026-08-01', ends_on: null },
  ];
  const out = C.resolveTodosForDate(todos, [{ todo_id: 'a', on_date: '2026-08-27' }], '2026-08-27');
  assert.deepStrictEqual(out.map((t) => t.body), ['Vitamins', 'Order glove']);
  assert.deepStrictEqual(out.map((t) => t.done), [false, true]);
});

test('counts report done over total for the day', () => {
  const todos = [
    { id: 'a', body: 'One', repeats: false, on_date: '2026-08-27' },
    { id: 'b', body: 'Two', repeats: false, on_date: '2026-08-27' },
    { id: 'c', body: 'Elsewhere', repeats: false, on_date: '2026-08-28' },
  ];
  assert.deepStrictEqual(C.todoCountsForDate(todos, [{ todo_id: 'a', on_date: '2026-08-27' }], '2026-08-27'),
    { done: 1, total: 2 });
  assert.deepStrictEqual(C.todoCountsForDate(todos, [], '2026-08-30'), { done: 0, total: 0 });
});

test('monthGrid starts on Sunday and covers the whole month', () => {
  // August 2026 starts on a Saturday and has 31 days.
  const g = C.monthGrid(2026, 7);
  assert.strictEqual(g.length % 7, 0, 'whole weeks only');
  assert.strictEqual(g[0].iso, '2026-07-26', 'pads back to Sunday');
  const inMonth = g.filter((c) => c.inMonth);
  assert.strictEqual(inMonth.length, 31);
  assert.strictEqual(inMonth[0].iso, '2026-08-01');
  assert.strictEqual(inMonth[30].iso, '2026-08-31');
});

test('monthGrid trims a trailing week that belongs entirely to the next month', () => {
  for (let m = 0; m < 12; m++) {
    const g = C.monthGrid(2026, m);
    const last7 = g.slice(-7);
    assert.ok(last7.some((c) => c.inMonth),
      `${C.monthLabel(2026, m)} ends with a week containing no day of the month`);
    assert.ok(g.length === 35 || g.length === 42 || g.length === 28);
  }
});

test('February in a leap year lands correctly', () => {
  const g = C.monthGrid(2028, 1);
  assert.strictEqual(g.filter((c) => c.inMonth).length, 29);
});

test('planDayOf maps dates onto the thirty days and nothing outside them', () => {
  assert.strictEqual(C.planDayOf('2026-08-25', '2026-08-25'), 1);
  assert.strictEqual(C.planDayOf('2026-08-25', '2026-08-29'), 5);
  assert.strictEqual(C.planDayOf('2026-08-25', '2026-09-23'), 30);
  assert.strictEqual(C.planDayOf('2026-08-25', '2026-09-24'), null, 'day 31 is outside');
  assert.strictEqual(C.planDayOf('2026-08-25', '2026-08-24'), null, 'before the start');
  assert.strictEqual(C.planDayOf(null, '2026-08-25'), null, 'no plan, no day');
});

test('planDayOf is not thrown off by daylight saving', () => {
  // US DST ends Nov 1 2026; a naive hour-based diff drifts here.
  assert.strictEqual(C.planDayOf('2026-10-25', '2026-11-03'), 10);
});

test('stopping a repeat never hides a day it was already ticked', () => {
  // Ticked today, deleted today: yesterday alone would drop today's tick.
  assert.strictEqual(
    C.endDateForStop('b', [{ todo_id: 'b', on_date: '2026-08-29' }], '2026-08-29'),
    '2026-08-29', 'ends today because today was ticked');

  // Only older ticks: end at yesterday, nothing earned is lost.
  assert.strictEqual(
    C.endDateForStop('b', [{ todo_id: 'b', on_date: '2026-08-26' }], '2026-08-29'),
    '2026-08-28');

  // Another todo's ticks must not extend this one.
  assert.strictEqual(
    C.endDateForStop('b', [{ todo_id: 'other', on_date: '2026-09-30' }], '2026-08-29'),
    '2026-08-28');

  // The resolved view agrees: visible on the ticked day, gone the day after.
  const todo = { id: 'b', body: 'Vitamins', repeats: true, starts_on: '2026-08-29' };
  const ticks = [{ todo_id: 'b', on_date: '2026-08-29' }];
  todo.ends_on = C.endDateForStop('b', ticks, '2026-08-29');
  assert.strictEqual(C.resolveTodosForDate([todo], ticks, '2026-08-29').length, 1);
  assert.strictEqual(C.resolveTodosForDate([todo], ticks, '2026-08-30').length, 0);
});

test('calendar marks mean unfinished up to today, scheduled after it', () => {
  const TODAY = '2026-08-29';
  const daily = { id: 'v', body: 'Vitamins', repeats: true, starts_on: '2026-08-01' };
  const oneOff = { id: 'o', body: 'Email Coach Kim', repeats: false, on_date: '2026-08-31' };

  // A daily repeat must not mark every future day to the end of time.
  assert.strictEqual(C.dayHasMark([daily], [], '2026-09-15', TODAY), false);
  assert.strictEqual(C.dayHasMark([daily], [], '2030-01-01', TODAY), false);

  // But a one-off scheduled ahead is worth seeing.
  assert.strictEqual(C.dayHasMark([daily, oneOff], [], '2026-08-31', TODAY), true);

  // Up to today, a mark means unfinished.
  assert.strictEqual(C.dayHasMark([daily], [], TODAY, TODAY), true, 'untick today = unfinished');
  assert.strictEqual(C.dayHasMark([daily], [{ todo_id: 'v', on_date: TODAY }], TODAY, TODAY), false,
    'all done today = no mark');
  assert.strictEqual(C.dayHasMark([daily], [], '2026-08-20', TODAY), true, 'missed past day');
  assert.strictEqual(C.dayHasMark([], [], '2026-08-20', TODAY), false, 'nothing on the books');
});
