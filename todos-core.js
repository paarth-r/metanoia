/* Metanoia todo core: pure date and recurrence logic, no DOM, no network.
   Loaded by index.html as a plain script (window.TodoCore) and by Node for the
   tests. mobile/todos-core.js carries a byte-identical copy of the SHARED
   region below, because the web has no build step and Metro will not reach
   outside the mobile project root; test/todos-core.test.js fails if the two
   drift apart. Edit both, or neither. */

/* SHARED-START */

/* Local-time ISO date. Never build one from toISOString(): that is UTC, and
   after ~5pm Pacific it silently returns tomorrow. */
function isoOf(d) {
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}

function isoTodayLocal() { return isoOf(new Date()); }

function parseIsoLocal(iso) {
  var p = String(iso).split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}

function shiftIso(iso, days) {
  var d = parseIsoLocal(iso);
  d.setDate(d.getDate() + days);
  return isoOf(d);
}

/* ISO dates are lexicographically ordered, so plain string compares are safe. */
function todoAppearsOn(t, iso) {
  if (t.repeats) {
    if (!t.starts_on || t.starts_on > iso) return false;
    if (t.ends_on && iso > t.ends_on) return false;
    return true;
  }
  return t.on_date === iso;
}

/* todos: rows from public.todos. ticks: rows from public.todo_ticks.
   One repeating todo is a single row plus one tick per day it was done, so a
   day is "refreshed" by having no tick yet, and history is never rewritten. */
function resolveTodosForDate(todos, ticks, iso) {
  var done = {};
  for (var i = 0; i < ticks.length; i++) {
    if (ticks[i].on_date === iso) done[ticks[i].todo_id] = true;
  }
  var out = [];
  for (var j = 0; j < todos.length; j++) {
    var t = todos[j];
    if (!todoAppearsOn(t, iso)) continue;
    out.push({ id: t.id, body: t.body, repeats: !!t.repeats, done: !!done[t.id] });
  }
  /* Repeating commitments first, then one-offs, each oldest first. */
  out.sort(function (a, b) { return (b.repeats ? 1 : 0) - (a.repeats ? 1 : 0); });
  return out;
}

function todoCountsForDate(todos, ticks, iso) {
  var list = resolveTodosForDate(todos, ticks, iso);
  var done = 0;
  for (var i = 0; i < list.length; i++) if (list[i].done) done++;
  return { done: done, total: list.length };
}

/* Six-week grid starting Sunday, trailing all-outside weeks trimmed. */
function monthGrid(year, month) {
  var first = new Date(year, month, 1);
  var d = new Date(year, month, 1 - first.getDay());
  var cells = [];
  for (var i = 0; i < 42; i++) {
    cells.push({ iso: isoOf(d), day: d.getDate(), inMonth: d.getMonth() === month });
    d.setDate(d.getDate() + 1);
  }
  while (cells.length > 28) {
    var allOut = true;
    for (var k = cells.length - 7; k < cells.length; k++) if (cells[k].inMonth) allOut = false;
    if (!allOut) break;
    cells = cells.slice(0, cells.length - 7);
  }
  return cells;
}

var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
var WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function monthLabel(year, month) { return MONTH_NAMES[month] + ' ' + year; }

/* Which day of a 30-day plan an ISO date is, or null if outside it. */
function planDayOf(startISO, iso) {
  if (!startISO) return null;
  var n = Math.round((parseIsoLocal(iso) - parseIsoLocal(startISO)) / 864e5) + 1;
  return (n >= 1 && n <= 30) ? n : null;
}

/* Deleting a repeating todo ends it rather than erasing it. It has to stop
   appearing from `iso` forward, yet every day already ticked has to keep it,
   so the end is the later of yesterday and the last day it was ticked.
   Without the second half, deleting something on the same day you ticked it
   silently drops the day you just earned. */
function endDateForStop(todoId, ticks, iso) {
  var end = shiftIso(iso, -1);
  for (var i = 0; i < ticks.length; i++) {
    if (ticks[i].todo_id === todoId && ticks[i].on_date > end) end = ticks[i].on_date;
  }
  return end;
}

/* Whether a calendar cell gets a mark. Up to today it means unfinished work.
   Ahead of today it means something specific is scheduled: a daily repeat runs
   forever, so counting it would dot every future day to the end of time and
   tell you nothing. */
function dayHasMark(todos, ticks, iso, todayIso) {
  var list = resolveTodosForDate(todos, ticks, iso);
  var i;
  if (iso > todayIso) {
    for (i = 0; i < list.length; i++) if (!list[i].repeats) return true;
    return false;
  }
  for (i = 0; i < list.length; i++) if (!list[i].done) return true;
  return false;
}

/* SHARED-END */

var TODO_CORE_API = {
  isoOf: isoOf, isoTodayLocal: isoTodayLocal, parseIsoLocal: parseIsoLocal,
  shiftIso: shiftIso, todoAppearsOn: todoAppearsOn,
  resolveTodosForDate: resolveTodosForDate, todoCountsForDate: todoCountsForDate,
  monthGrid: monthGrid, monthLabel: monthLabel, planDayOf: planDayOf,
  endDateForStop: endDateForStop, dayHasMark: dayHasMark,
  MONTH_NAMES: MONTH_NAMES, WEEKDAYS: WEEKDAYS,
};

if (typeof module === 'object' && module.exports) {
  module.exports = TODO_CORE_API;            /* Node, for the tests */
} else if (typeof window !== 'undefined') {
  window.TodoCore = TODO_CORE_API;           /* browser: plain script, no build step */
}
