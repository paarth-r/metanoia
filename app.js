'use strict';
/* Metanoia - 30-day resets you run in public.
   Frontend: static SPA. Backend: Supabase (auth, Postgres with RLS, realtime).
   Guest mode works with no backend: plan and ticks in localStorage. */

/* ================= constants ================= */

var TOTAL = 30;
var PLAN_KEY = 'metanoia_plan_v1';
var STATE_KEY = 'metanoia_state_v1';
var SEEN_KEY = 'metanoia_feed_seen_v1';

var QUOTES = [
  ['You have power over your mind, not outside events. Realize this, and you will find strength.', 'Marcus Aurelius'],
  ['Waste no more time arguing about what a good man should be. Be one.', 'Marcus Aurelius'],
  ['It is not that we have a short time to live, but that we waste a lot of it.', 'Seneca'],
  ['No man is free who is not master of himself.', 'Epictetus'],
  ['The impediment to action advances action. What stands in the way becomes the way.', 'Marcus Aurelius'],
  ['First say to yourself what you would be; and then do what you have to do.', 'Epictetus'],
  ['Luck is what happens when preparation meets opportunity.', 'Seneca'],
  ['If it is not right, do not do it; if it is not true, do not say it.', 'Marcus Aurelius'],
  ['We suffer more often in imagination than in reality.', 'Seneca'],
  ['Do not explain your philosophy. Embody it.', 'Epictetus'],
  ['The best revenge is to be unlike him who performed the injury.', 'Marcus Aurelius'],
  ['Difficulties strengthen the mind, as labor does the body.', 'Seneca'],
  ['How long are you going to wait before you demand the best for yourself?', 'Epictetus'],
  ['Confine yourself to the present.', 'Marcus Aurelius'],
  ['While we wait for life, life passes.', 'Seneca'],
  ['Progress is not achieved by luck or accident, but by working on yourself daily.', 'Epictetus'],
  ['The soul becomes dyed with the color of its thoughts.', 'Marcus Aurelius'],
  ['He who is brave is free.', 'Seneca'],
  ['It is not what happens to you, but how you react to it that matters.', 'Epictetus'],
  ['Do every act of your life as though it were the last act of your life.', 'Marcus Aurelius'],
  ['Begin at once to live, and count each separate day as a separate life.', 'Seneca'],
  ['Wealth consists not in having great possessions, but in having few wants.', 'Epictetus'],
  ['Very little is needed to make a happy life; it is all within yourself.', 'Marcus Aurelius'],
  ['Nothing is ours, except time.', 'Seneca'],
  ['Only the educated are free.', 'Epictetus'],
  ['That which is not good for the swarm, neither is it good for the bee.', 'Marcus Aurelius'],
  ['Each night, ask yourself: what weakness did I overcome today? What virtue did I acquire?', 'Seneca'],
  ['Circumstances do not make the man; they only reveal him to himself.', 'Epictetus'],
  ['When you arise in the morning, think of what a precious privilege it is to be alive.', 'Marcus Aurelius'],
  ['As long as you live, keep learning how to live.', 'Seneca']
];

var HABIT_SUGGESTIONS = [
  'No phone, first 30 min', '90-min deep work block', 'Train (lift, run, or sport)',
  '20 min reading', '1 deliberate social rep', 'Zero short-form feeds',
  'Evening review (3 lines)', 'Wake before 7', '10 min meditation',
  'In bed by 11', 'No sugar', '10k steps'
];
var TARGET_SUGGESTIONS = [
  ['Lift', 3], ['Cardio', 2], ['Deep project session', 2],
  ['Reach out to someone', 1], ['Weekly review', 1], ['Practice a skill', 2]
];

var PAARTH_PLAN = {
  name: "Paarth's Reset",
  intent: 'Dopamine detox. Immaculate grades. Money, golf, iron discipline.',
  startISO: '2026-08-25',
  habits: ['No phone, first 30 min', '90-min deep work block', 'Homework + 30 min ahead',
    '20 min philosophy', '1 social rep', 'Zero short-form', 'Evening review'],
  targets: [['Lift', 3], ['Golf', 1], ['Mashgin', 2], ['Hyperform', 2],
    ['FRC', 2], ['Repair action', 1], ['Sunday review', 1]],
  weekMeta: [null,
    { social: 'Presence basics', reading: 'Meditations, Books I-VI' },
    { social: 'Initiation', reading: 'Meditations VII-XII + Seneca' },
    { social: 'Command', reading: 'Machiavelli, The Prince' },
    { social: 'Composure under stakes', reading: 'Notes from Underground' }]
};

/* ================= small utilities ================= */

function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function clear() { var r = document.getElementById('root'); r.textContent = ''; return r; }
var chipTimer = null;
function chip(msg) {
  var c = document.getElementById('chip');
  c.textContent = msg; c.classList.add('show');
  if (chipTimer) clearTimeout(chipTimer);
  chipTimer = setTimeout(function () { c.classList.remove('show'); }, 2400);
}
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

function parseISO(iso) {
  var p = String(iso || '').split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
function isoToday() {
  var n = new Date();
  return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' +
    String(n.getDate()).padStart(2, '0');
}
function dayNumOf(startISO) {
  var n = new Date();
  var t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.round((t0 - parseISO(startISO)) / 864e5) + 1;
}
function dateOfDay(startISO, d) {
  var x = parseISO(startISO);
  x.setDate(x.getDate() + (d - 1));
  return x;
}
function fmtDay(startISO, d) {
  var D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var x = dateOfDay(startISO, d);
  return D[x.getDay()] + ' ' + M[x.getMonth()] + ' ' + x.getDate();
}
function weekOf(d) { return Math.min(4, Math.ceil(d / 7)); }
function ago(ts) {
  var s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
function esc(s) { return String(s == null ? '' : s); }

/* A person's name, linked to their ledger only when they actually have a
   username. Linking a null one produced '#/u/' -> "No such account". */
function personLink(p) {
  var name = (p && (p.display_name || p.username)) || 'unnamed';
  if (p && p.username) {
    var a = el('a', 'tl2', name);
    a.href = '#/u/' + encodeURIComponent(p.username);
    return a;
  }
  return el('span', 'tl2', name);
}

/* ================= supabase ================= */

var CFG = window.METANOIA_CONFIG || {};
var sb = (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase)
  ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey)
  : null;
var session = null;
var myProfile = null;
var SP = null;              // {plan, days:{}, weeks:{}} - my server plan cache
var feedUnseen = 0;
var realtimeStarted = false;

function backendReady() { return !!sb; }
function signedIn() { return !!(sb && session); }
/* Signed in but with no username: every fallback in the app reads 'unnamed'
   and their profile link is a dead end, so the claim screen blocks the app
   until they pick one. New signups set it in the form; this catches accounts
   created before that existed. */
function needsClaim() { return signedIn() && myProfile && !myProfile.username; }

async function loadMyProfile() {
  if (!signedIn()) { myProfile = null; return; }
  var r = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  myProfile = r.data || null;
}
async function loadMyPlan() {
  SP = null;
  if (!signedIn()) return;
  var p = await sb.from('plans').select('*').eq('owner', session.user.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!p.data) return;
  var days = {}, weeks = {};
  var dr = await sb.from('plan_days').select('*').eq('plan_id', p.data.id);
  (dr.data || []).forEach(function (r) { days[r.day] = r.checks; });
  var wr = await sb.from('plan_weeks').select('*').eq('plan_id', p.data.id);
  (wr.data || []).forEach(function (r) { weeks[r.week] = r.checks; });
  SP = { plan: p.data, days: days, weeks: weeks };
}

/* debounced remote persistence */
var dirtyDays = {}, dirtyWeeks = {}, flushTimer = null;
function queueDay(d) { dirtyDays[d] = true; queueFlush(); }
function queueWeek(w) { dirtyWeeks[w] = true; queueFlush(); }
function queueFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushRemote, 1800);
}
async function flushRemote() {
  if (!signedIn() || !SP) return;
  var days = Object.keys(dirtyDays); dirtyDays = {};
  var weeks = Object.keys(dirtyWeeks); dirtyWeeks = {};
  var nH = SP.plan.habits.length;
  try {
    for (var i = 0; i < days.length; i++) {
      var d = +days[i];
      await sb.from('plan_days').upsert({
        plan_id: SP.plan.id, day: d, checks: SP.days[d] || [],
        updated_at: new Date().toISOString()
      });
      if (SP.plan.visibility !== 'private') {
        var sc = scoreOf(SP.days[d], nH);
        await sb.from('feed_events').insert({
          user_id: session.user.id, plan_id: SP.plan.id,
          kind: sc === nH ? 'perfect' : 'tick', day: d,
          payload: { score: sc, total: nH, plan_name: SP.plan.name }
        });
      }
    }
    for (var j = 0; j < weeks.length; j++) {
      var w = +weeks[j];
      await sb.from('plan_weeks').upsert({
        plan_id: SP.plan.id, week: w, checks: SP.weeks[w] || {},
        updated_at: new Date().toISOString()
      });
    }
    if (days.length || weeks.length) chip('Saved to your public ledger');
  } catch (e) { chip('Save failed. Check your connection.'); }
}

function scoreOf(arr, nH) {
  if (!arr) return 0;
  var c = 0; for (var i = 0; i < arr.length && i < nH; i++) if (arr[i]) c++;
  return c;
}

/* feed */
async function fetchFeed() {
  if (!signedIn()) return [];
  var r = await sb.from('feed_events')
    .select('*, profiles(username, display_name), plans(name)')
    .order('created_at', { ascending: false }).limit(120);
  var rows = r.data || [];
  /* keep only the newest tick event per (user, plan, day) */
  var seen = {}, out = [];
  rows.forEach(function (ev) {
    var key = (ev.kind === 'tick' || ev.kind === 'perfect')
      ? ev.user_id + '|' + ev.plan_id + '|' + ev.day : 'id' + ev.id;
    if (seen[key]) return;
    seen[key] = true;
    out.push(ev);
  });
  return out;
}
function startRealtime() {
  if (!signedIn() || realtimeStarted) return;
  realtimeStarted = true;
  sb.channel('feed-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_events' },
      function (msg) {
        if (msg.new && msg.new.user_id !== session.user.id) {
          feedUnseen++;
          renderNav();
          if (location.hash === '#/feed') route();
        }
      })
    .subscribe();
}

/* ================= reusable ledger renderer ================= */

/* ctx: {plan:{name,intent,startISO,habits,targets,weekMeta}, readOnly,
         getDay(d)->arr, toggleDay(d,i), getWeek(w)->obj, toggleWeek(w,t,p)} */
function renderLedger(wrap, ctx) {
  var plan = ctx.plan;
  var nH = plan.habits.length;
  var tn = dayNumOf(plan.startISO);
  var sel = ctx.sel != null ? ctx.sel : Math.max(1, Math.min(TOTAL, tn));

  var upto = Math.min(Math.max(tn, 0), TOTAL);
  var sum = 0, perfect = 0;
  for (var d0 = 1; d0 <= upto; d0++) {
    var s0 = scoreOf(ctx.getDay(d0), nH); sum += s0; if (s0 === nH) perfect++;
  }
  var streak = 0, sd = upto;
  if (upto >= 1 && scoreOf(ctx.getDay(upto), nH) < nH) sd = upto - 1;
  for (var d1 = sd; d1 >= 1; d1--) { if (scoreOf(ctx.getDay(d1), nH) === nH) streak++; else break; }

  var row = el('div', 'statrow');
  var pairs = tn < 1
    ? [[String(1 - tn), 'days to start'], ['-', 'streak'], ['-', 'perfect']]
    : tn > TOTAL
      ? [['Done', 'thirty days'], [String(perfect), 'perfect days'], [(sum / TOTAL).toFixed(1), 'avg score']]
      : [['Day ' + tn, 'of 30'], [String(streak), 'streak'], [upto ? (sum / upto).toFixed(1) : '-', 'avg /' + nH]];
  pairs.forEach(function (p) {
    var stEl = el('div', 'stat');
    stEl.appendChild(el('b', null, p[0]));
    stEl.appendChild(el('span', null, p[1]));
    row.appendChild(stEl);
  });
  wrap.appendChild(row);

  var q = QUOTES[(Math.max(1, Math.min(TOTAL, Math.max(tn, 1))) - 1) % QUOTES.length];
  wrap.appendChild(el('div', 'quote', '"' + q[0] + '"'));
  wrap.appendChild(el('div', 'quote-a', q[1]));

  /* day card */
  var editable = !ctx.readOnly && tn >= 1 && sel <= tn;
  var card = el('div', 'card');
  var dh = el('div', 'dayhead');
  dh.appendChild(el('span', 'dn', 'Day ' + sel));
  dh.appendChild(el('span', 'dd', fmtDay(plan.startISO, sel) + (sel === tn ? ' - today' : '')));
  card.appendChild(dh);
  var arr = ctx.getDay(sel) || [];
  for (var h = 0; h < nH; h++) {
    (function (h2) {
      var on = !!arr[h2];
      var b = el('button', 'habit' + (on ? ' on' : '') + (ctx.readOnly ? ' static' : ''));
      b.type = 'button';
      if (!editable) b.disabled = ctx.readOnly ? false : true;
      if (ctx.readOnly) b.disabled = false;
      b.appendChild(el('span', 'box'));
      b.appendChild(el('span', 'lbl', plan.habits[h2]));
      if (editable) b.addEventListener('click', function () {
        ctx.toggleDay(sel, h2);
        ctx.sel = sel;
        ctx.rerender();
      });
      card.appendChild(b);
    })(h);
  }
  var sl = el('div', 'scoreline');
  var sc = scoreOf(arr, nH);
  sl.appendChild(el('b', null, sc + ' / ' + nH));
  if (sel < tn && sc < nH) sl.appendChild(el('span', 'miss', (nH - sc) + ' missed'));
  if (dateOfDay(plan.startISO, sel).getDay() === 0) sl.appendChild(el('span', 'dd', 'Sunday: review the week'));
  card.appendChild(sl);
  wrap.appendChild(card);

  /* weekly targets */
  if (plan.targets && plan.targets.length) {
    var w = weekOf(Math.max(1, Math.min(TOTAL, sel)));
    var wcard = el('div', 'card');
    wcard.appendChild(el('h2', null, 'Week ' + w + ' targets'));
    if (plan.weekMeta && plan.weekMeta[w]) {
      var wm = el('div', 'wmeta');
      wm.appendChild(document.createTextNode('Social: '));
      wm.appendChild(el('em', null, plan.weekMeta[w].social));
      wm.appendChild(document.createTextNode('  -  Reading: '));
      wm.appendChild(el('em', null, plan.weekMeta[w].reading));
      wcard.appendChild(wm);
    }
    var wEditable = !ctx.readOnly && tn >= 1 && w <= weekOf(Math.max(1, Math.min(TOTAL, tn)));
    var tg = el('div', 'targets');
    var wo = ctx.getWeek(w) || {};
    for (var t = 0; t < plan.targets.length; t++) {
      var box = el('div', 'tgt');
      box.appendChild(el('span', 'tl', plan.targets[t][0]));
      var count = plan.targets[t][1];
      for (var p = 0; p < count; p++) {
        (function (t2, p2) {
          var on = !!(wo[t2] && wo[t2][p2]);
          var pip = el('button', 'pip' + (on ? ' on' : ''));
          pip.type = 'button';
          pip.setAttribute('aria-label', plan.targets[t2][0] + ' ' + (p2 + 1));
          if (!wEditable) pip.disabled = true;
          if (wEditable) pip.addEventListener('click', function () {
            ctx.toggleWeek(w, t2, p2);
            ctx.sel = sel;
            ctx.rerender();
          });
          box.appendChild(pip);
        })(t, p);
      }
      tg.appendChild(box);
    }
    wcard.appendChild(tg);
    wrap.appendChild(wcard);
  }

  /* grid */
  var gcard = el('div', 'card');
  gcard.appendChild(el('h2', null, 'The thirty days'));
  var grid = el('div', 'grid');
  for (var g = 1; g <= TOTAL; g++) {
    (function (g2) {
      var scG = scoreOf(ctx.getDay(g2), nH);
      var cls = 'cell';
      if (g2 > tn) cls += ' future';
      if (scG === nH && nH > 0) cls += ' perfect';
      if (g2 < tn && scG === 0) cls += ' zero-past';
      if (g2 === sel) cls += ' sel';
      if (ctx.readOnly) cls += ' static';
      var c = el(ctx.readOnly ? 'div' : 'button', cls);
      if (!ctx.readOnly) {
        c.type = 'button';
        if (g2 > tn) c.disabled = true;
        c.addEventListener('click', function () {
          if (g2 > tn) return;
          ctx.sel = g2;
          ctx.rerender();
          window.scrollTo({ top: 0 });
        });
      }
      c.appendChild(el('span', 'n', String(g2)));
      var bar = el('span', 'bar');
      var fill = el('i');
      fill.style.width = (nH ? Math.round(scG / nH * 100) : 0) + '%';
      bar.appendChild(fill);
      c.appendChild(bar);
      grid.appendChild(c);
    })(g);
  }
  gcard.appendChild(grid);
  wrap.appendChild(gcard);
}

/* ================= nav ================= */

function renderNav() {
  var nav = document.getElementById('topnav');
  nav.textContent = '';
  var brand = el('a', 'brand', 'Metanoia');
  brand.href = '#/';
  nav.appendChild(brand);
  var links = needsClaim()
    ? []
    : signedIn()
      ? [['#/track', 'Ledger'], ['#/days', 'Days'], ['#/feed', 'Feed'], ['#/people', 'Social'], ['#/settings', 'Account']]
      : (backendReady() ? [['#/auth', 'Sign in']] : []);
  var cur = location.hash || '#/';
  links.forEach(function (l) {
    var a = el('a', 'navlink' + (cur.indexOf(l[0]) === 0 ? ' active' : ''), l[1]);
    a.href = l[0];
    if (l[0] === '#/feed' && feedUnseen > 0) {
      a.appendChild(el('span', 'badge', feedUnseen > 9 ? '9+' : String(feedUnseen)));
    }
    nav.appendChild(a);
  });
}

/* ================= views ================= */

function renderLanding() {
  var root = clear();
  var wrap = el('div', 'wrap');
  wrap.appendChild(el('div', 'eyebrow', 'Thirty-day resets, run in public'));
  wrap.appendChild(el('h1', null, 'Metanoia'));
  wrap.appendChild(el('div', 'sub',
    'noun. A transformative change of heart and mind; the moment you turn your life around.'));

  var rules = el('div', 'rules');
  [['Choose your non-negotiables.', 'Three to seven things you will do every single day. Not goals. Actions.'],
   ['Tick them for thirty days.', 'The ledger fills in black when you are perfect and red when you were not there at all.'],
   ['Let people watch.', 'Share the ledger with friends and groups. Accountability is a feed they scroll.'],
   ['Never miss twice.', 'One slip is a data point. Two in a row is a new habit forming in the wrong direction.']
  ].forEach(function (r) {
    var ru = el('div', 'rule');
    ru.appendChild(el('b', null, r[0]));
    ru.appendChild(el('span', null, r[1]));
    rules.appendChild(ru);
  });
  wrap.appendChild(rules);

  var br = el('div', 'btnrow');
  if (signedIn()) {
    var b0 = el('a', 'btn', 'Open my ledger'); b0.href = '#/track';
    br.appendChild(b0);
  } else {
    var b1 = el('a', 'btn', backendReady() ? 'Sign in and start' : 'Start your 30 days');
    b1.href = backendReady() ? '#/auth' : '#/new';
    br.appendChild(b1);
    if (backendReady()) {
      var bg = el('a', 'btn ghost', 'Try it without an account'); bg.href = '#/new';
      br.appendChild(bg);
    }
  }
  wrap.appendChild(br);

  var q = QUOTES[new Date().getDate() % QUOTES.length];
  wrap.appendChild(el('div', 'quote', '"' + q[0] + '"'));
  wrap.appendChild(el('div', 'quote-a', q[1]));

  var foot = el('div', 'foot');
  foot.textContent = backendReady()
    ? 'Private goals stay private. Friends-only goals reach your friends and groups. Public goals are a page anyone can watch.'
    : 'Running in guest mode: your plan lives in this browser only. The shared backend is not configured yet.';
  wrap.appendChild(foot);
  root.appendChild(wrap);
}

var authMode = 'signin'; // 'signin' | 'signup' | 'forgot'

function renderAuth() {
  var root = clear();
  var wrap = el('div', 'wrap');
  wrap.appendChild(el('div', 'eyebrow', 'Metanoia'));
  wrap.appendChild(el('div', 'q',
    authMode === 'signup' ? 'Create account' : authMode === 'forgot' ? 'Reset password' : 'Sign in'));
  var card = el('div', 'card');
  if (!backendReady()) {
    card.appendChild(el('div', 'hint', 'The backend is not configured yet. Guest mode still works from the landing page.'));
    wrap.appendChild(card); root.appendChild(wrap); return;
  }
  var hint = authMode === 'signup'
    ? 'Pick the name people will see. You get one confirmation email; click its link, then sign in.'
    : authMode === 'forgot'
      ? 'We email you a reset link. Open it here and set a new password.'
      : 'Email and password.';
  card.appendChild(el('div', 'hint', hint));
  var em = el('input'); em.type = 'email'; em.placeholder = 'you@example.com';
  em.setAttribute('autocomplete', 'email');
  card.appendChild(em);
  var pw = null;
  if (authMode !== 'forgot') {
    pw = el('input'); pw.type = 'password';
    pw.placeholder = authMode === 'signup' ? 'Password (8+ characters)' : 'Password';
    pw.setAttribute('autocomplete', authMode === 'signup' ? 'new-password' : 'current-password');
    pw.style.marginTop = '8px';
    card.appendChild(pw);
  }
  var unIn = null, dnIn = null;
  if (authMode === 'signup') {
    unIn = el('input'); unIn.type = 'text'; unIn.placeholder = 'username (a-z, 0-9, underscore)';
    unIn.setAttribute('autocapitalize', 'none');
    unIn.setAttribute('autocomplete', 'username');
    unIn.maxLength = 20; unIn.style.marginTop = '8px';
    card.appendChild(unIn);
    dnIn = el('input'); dnIn.type = 'text'; dnIn.placeholder = 'Display name';
    dnIn.setAttribute('autocomplete', 'name');
    dnIn.maxLength = 40; dnIn.style.marginTop = '8px';
    card.appendChild(dnIn);
  }
  var go = el('button', 'btn',
    authMode === 'signup' ? 'Create account' : authMode === 'forgot' ? 'Send reset link' : 'Sign in');
  go.type = 'button'; go.style.marginTop = '10px';
  card.appendChild(go);
  var msg = el('div', 'ok', ''); msg.style.marginTop = '10px';
  card.appendChild(msg);

  go.addEventListener('click', async function () {
    var v = em.value.trim();
    if (!v) return;
    if (authMode === 'signin') {
      msg.textContent = 'Signing in...';
      var r = await sb.auth.signInWithPassword({ email: v, password: pw.value });
      if (r.error) msg.textContent = /confirm/i.test(r.error.message)
        ? 'Email not confirmed yet. Click the link in your confirmation email first.'
        : 'Could not sign in: ' + r.error.message;
      else location.hash = '#/track';
    } else if (authMode === 'signup') {
      if (pw.value.length < 8) { msg.textContent = 'Password needs 8+ characters.'; return; }
      var u = unIn.value.trim().toLowerCase();
      var dnv = dnIn.value.trim();
      if (!/^[a-z0-9_]{3,20}$/.test(u)) {
        msg.textContent = 'Username: 3-20 characters, a-z, 0-9, underscore.'; return;
      }
      if (!dnv) { msg.textContent = 'Pick a display name. It is what friends see.'; return; }
      msg.textContent = 'Checking that name...';
      var taken = await sb.from('profiles').select('id').eq('username', u).maybeSingle();
      if (taken.data) { msg.textContent = '"' + u + '" is taken. Pick another.'; return; }
      msg.textContent = 'Creating...';
      var r2 = await sb.auth.signUp({
        email: v, password: pw.value,
        options: {
          emailRedirectTo: location.origin + location.pathname,
          data: { username: u, display_name: dnv }
        }
      });
      msg.textContent = r2.error ? ('Could not create: ' + r2.error.message)
        : 'Account created as @' + u + '. Check your email for the confirmation link, then sign in.';
    } else {
      msg.textContent = 'Sending...';
      var r3 = await sb.auth.resetPasswordForEmail(v, {
        redirectTo: location.origin + location.pathname
      });
      msg.textContent = r3.error ? ('Could not send: ' + r3.error.message)
        : 'Sent. Open the link in that email; it lands back here to set a new password.';
    }
  });

  var sw = el('div', 'btnrow');
  if (authMode !== 'signin') {
    var b1 = el('button', 'btn ghost', 'Sign in instead'); b1.type = 'button';
    b1.addEventListener('click', function () { authMode = 'signin'; renderAuth(); });
    sw.appendChild(b1);
  }
  if (authMode !== 'signup') {
    var b2 = el('button', 'btn ghost', 'Create account'); b2.type = 'button';
    b2.addEventListener('click', function () { authMode = 'signup'; renderAuth(); });
    sw.appendChild(b2);
  }
  if (authMode === 'signin') {
    var b3 = el('button', 'btn ghost', 'Forgot password'); b3.type = 'button';
    b3.addEventListener('click', function () { authMode = 'forgot'; renderAuth(); });
    sw.appendChild(b3);
  }
  card.appendChild(sw);
  wrap.appendChild(card);
  root.appendChild(wrap);
}

function renderRecover() {
  var root = clear();
  var wrap = el('div', 'wrap');
  wrap.appendChild(el('div', 'eyebrow', 'Metanoia'));
  wrap.appendChild(el('div', 'q', 'Set a new password'));
  var card = el('div', 'card');
  var pw = el('input'); pw.type = 'password'; pw.placeholder = 'New password (8+ characters)';
  pw.setAttribute('autocomplete', 'new-password');
  card.appendChild(pw);
  var go = el('button', 'btn', 'Save password'); go.type = 'button'; go.style.marginTop = '10px';
  card.appendChild(go);
  var msg = el('div', 'ok', ''); msg.style.marginTop = '10px';
  card.appendChild(msg);
  go.addEventListener('click', async function () {
    if (pw.value.length < 8) { msg.textContent = 'Password needs 8+ characters.'; return; }
    var r = await sb.auth.updateUser({ password: pw.value });
    if (r.error) msg.textContent = 'Failed: ' + r.error.message;
    else { chip('Password set'); location.hash = '#/track'; }
  });
  wrap.appendChild(card);
  root.appendChild(wrap);
}

/* ---------- wizard ---------- */

var W = null;
function freshW() {
  return { step: 1, name: '', intent: '', startISO: isoToday(), habits: [], targets: [],
    visibility: 'friends', err: '' };
}

function renderWizard() {
  if (!W) W = freshW();
  var root = clear();
  var wrap = el('div', 'wrap');
  var steps = signedIn() ? 5 : 4;
  wrap.appendChild(el('div', 'eyebrow', 'Metanoia'));
  wrap.appendChild(el('div', 'steplbl', 'Step ' + W.step + ' of ' + steps));

  var card = el('div', 'card');
  if (W.err) card.appendChild(el('div', 'err', W.err));

  if (W.step === 1) {
    card.appendChild(el('div', 'q', 'What is this reset called, and why now?'));
    card.appendChild(el('div', 'hint',
      'Name it like it matters. Then one sentence on what you are turning around. You will read it every day for a month.'));
    var nameIn = el('input');
    nameIn.type = 'text'; nameIn.placeholder = 'My Reset'; nameIn.value = W.name; nameIn.maxLength = 40;
    nameIn.addEventListener('input', function () { W.name = nameIn.value; });
    card.appendChild(nameIn);
    card.appendChild(el('div', 'hint', ''));
    var intentIn = el('textarea');
    intentIn.placeholder = 'Why now. What changes.'; intentIn.value = W.intent; intentIn.maxLength = 140;
    intentIn.addEventListener('input', function () { W.intent = intentIn.value; });
    card.appendChild(intentIn);
  }

  if (W.step === 2) {
    card.appendChild(el('div', 'q', 'When does day one begin?'));
    card.appendChild(el('div', 'hint',
      'Today is the honest answer. A start date in the future is usually procrastination wearing a calendar.'));
    var dIn = el('input');
    dIn.type = 'date'; dIn.value = W.startISO;
    dIn.addEventListener('input', function () { if (dIn.value) W.startISO = dIn.value; });
    card.appendChild(dIn);
  }

  if (W.step === 3) {
    card.appendChild(el('div', 'q', 'Your daily non-negotiables.'));
    card.appendChild(el('div', 'hint',
      'Pick 3 to 7. Every one must be a concrete action you can tick before midnight on your worst day, not just your best.'));
    var chips = el('div', 'chips');
    HABIT_SUGGESTIONS.forEach(function (label) {
      var on = W.habits.indexOf(label) >= 0;
      var c = el('button', 'chipb' + (on ? ' on' : ''), label);
      c.type = 'button';
      c.addEventListener('click', function () {
        var ix = W.habits.indexOf(label);
        if (ix >= 0) W.habits.splice(ix, 1);
        else if (W.habits.length < 7) W.habits.push(label);
        W.err = ''; renderWizard();
      });
      chips.appendChild(c);
    });
    card.appendChild(chips);
    var ar = el('div', 'addrow');
    var custom = el('input'); custom.type = 'text'; custom.placeholder = 'Add your own'; custom.maxLength = 40;
    var addB = el('button', 'btn ghost', 'Add'); addB.type = 'button';
    function addCustom() {
      var v = custom.value.trim();
      if (!v) return;
      if (W.habits.length >= 7) { W.err = 'Seven is the cap. Discipline is subtraction.'; renderWizard(); return; }
      if (W.habits.indexOf(v) < 0) W.habits.push(v);
      custom.value = ''; W.err = ''; renderWizard();
    }
    addB.addEventListener('click', addCustom);
    custom.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } });
    ar.appendChild(custom); ar.appendChild(addB);
    card.appendChild(ar);
    card.appendChild(el('div', 'count', W.habits.length + ' of 7 chosen (minimum 3)'));
    if (W.habits.length) {
      var tl = el('div', 'tlist');
      W.habits.forEach(function (hb, ix) {
        var rowE = el('div', 'trow');
        rowE.appendChild(el('span', 'tl2', hb));
        var x = el('button', 'xb', 'remove'); x.type = 'button';
        x.addEventListener('click', function () { W.habits.splice(ix, 1); renderWizard(); });
        rowE.appendChild(x);
        tl.appendChild(rowE);
      });
      card.appendChild(tl);
    }
  }

  if (W.step === 4) {
    card.appendChild(el('div', 'q', 'Weekly targets.'));
    card.appendChild(el('div', 'hint',
      'Things that happen a few times a week, not daily. Optional but recommended. Tap a suggestion or add your own with a per-week count.'));
    var chips2 = el('div', 'chips');
    TARGET_SUGGESTIONS.forEach(function (sug) {
      var have = W.targets.some(function (t) { return t[0] === sug[0]; });
      var c = el('button', 'chipb' + (have ? ' on' : ''), sug[0] + ' x' + sug[1]);
      c.type = 'button';
      c.addEventListener('click', function () {
        var ix = -1;
        W.targets.forEach(function (t, k) { if (t[0] === sug[0]) ix = k; });
        if (ix >= 0) W.targets.splice(ix, 1);
        else if (W.targets.length < 8) W.targets.push([sug[0], sug[1]]);
        renderWizard();
      });
      chips2.appendChild(c);
    });
    card.appendChild(chips2);
    var ar2 = el('div', 'addrow');
    var tIn = el('input'); tIn.type = 'text'; tIn.placeholder = 'Custom target'; tIn.maxLength = 30;
    var cIn = el('input'); cIn.type = 'number'; cIn.min = 1; cIn.max = 7; cIn.value = 2;
    cIn.style.width = '70px'; cIn.style.flex = 'none';
    var addT = el('button', 'btn ghost', 'Add'); addT.type = 'button';
    addT.addEventListener('click', function () {
      var v = tIn.value.trim();
      var n = Math.max(1, Math.min(7, parseInt(cIn.value, 10) || 1));
      if (!v || W.targets.length >= 8) return;
      W.targets.push([v, n]); tIn.value = ''; renderWizard();
    });
    ar2.appendChild(tIn); ar2.appendChild(cIn); ar2.appendChild(addT);
    card.appendChild(ar2);
    if (W.targets.length) {
      var tl2 = el('div', 'tlist');
      W.targets.forEach(function (t, ix) {
        var rowE = el('div', 'trow');
        rowE.appendChild(el('span', 'tl2', t[0] + '  x' + t[1] + ' per week'));
        var x = el('button', 'xb', 'remove'); x.type = 'button';
        x.addEventListener('click', function () { W.targets.splice(ix, 1); renderWizard(); });
        rowE.appendChild(x);
        tl2.appendChild(rowE);
      });
      card.appendChild(tl2);
    }
  }

  if (W.step === 5) {
    card.appendChild(el('div', 'q', 'Who watches?'));
    card.appendChild(el('div', 'hint',
      'Accountability is the point, but it is your call. You can change this later in Account.'));
    [['public', 'Public', 'Anyone with your username can watch the ledger fill in. Maximum stakes.'],
     ['friends', 'Friends and groups', 'Accepted friends and your group-mates see it in their feed.'],
     ['private', 'Private', 'Yours alone. Not in any feed, invisible on your profile.']
    ].forEach(function (opt) {
      var lab = el('label', 'vradio');
      var inp = el('input'); inp.type = 'radio'; inp.name = 'vis'; inp.value = opt[0];
      inp.checked = W.visibility === opt[0];
      inp.addEventListener('change', function () { W.visibility = opt[0]; });
      lab.appendChild(inp);
      lab.appendChild(el('b', null, opt[1]));
      lab.appendChild(el('div', null, opt[2]));
      card.appendChild(lab);
    });
  }

  wrap.appendChild(card);

  var nav = el('div', 'navrow');
  var back = el('button', 'btn ghost', W.step === 1 ? 'Cancel' : 'Back'); back.type = 'button';
  back.addEventListener('click', function () {
    if (W.step === 1) { W = null; location.hash = '#/'; return; }
    W.step--; W.err = ''; renderWizard();
  });
  var fwd = el('button', 'btn', W.step === steps ? 'Begin the thirty days' : 'Continue');
  fwd.type = 'button';
  fwd.addEventListener('click', async function () {
    if (W.step === 3 && W.habits.length < 3) {
      W.err = 'Pick at least three. Fewer than that is not a reset.'; renderWizard(); return;
    }
    if (W.step < steps) { W.step++; W.err = ''; renderWizard(); return; }
    var planObj = {
      name: W.name.trim() || 'My Reset',
      intent: W.intent.trim(),
      startISO: W.startISO,
      habits: W.habits.slice(),
      targets: W.targets.slice(),
      weekMeta: null,
      visibility: W.visibility
    };
    if (signedIn()) {
      fwd.disabled = true; fwd.textContent = 'Creating...';
      var ok = await createRemotePlan(planObj);
      if (!ok) { fwd.disabled = false; fwd.textContent = 'Begin the thirty days'; return; }
    } else {
      lsSet(PLAN_KEY, planObj);
      lsSet(STATE_KEY, { days: {}, weeks: {} });
    }
    W = null;
    location.hash = '#/track';
  });
  nav.appendChild(back); nav.appendChild(fwd);
  wrap.appendChild(nav);
  root.appendChild(wrap);
}

async function createRemotePlan(planObj) {
  var r = await sb.from('plans').insert({
    owner: session.user.id,
    name: planObj.name, intent: planObj.intent,
    start_date: planObj.startISO,
    habits: planObj.habits, targets: planObj.targets,
    week_meta: planObj.weekMeta, visibility: planObj.visibility
  }).select().single();
  if (r.error) { chip('Could not create the plan: ' + r.error.message); return false; }
  SP = { plan: r.data, days: {}, weeks: {} };
  if (planObj.visibility !== 'private') {
    await sb.from('feed_events').insert({
      user_id: session.user.id, plan_id: r.data.id, kind: 'started',
      payload: { plan_name: r.data.name }
    });
  }
  return true;
}

/* ---------- tracker ---------- */

var trackerSel = null;

function planRowToObj(row) {
  return { name: row.name, intent: row.intent, startISO: row.start_date,
    habits: row.habits, targets: row.targets || [], weekMeta: row.week_meta,
    visibility: row.visibility };
}

function renderTracker() {
  var root = clear();
  var wrap = el('div', 'wrap');

  var ctx = null;
  if (signedIn() && SP && SP.plan) {
    var pobj = planRowToObj(SP.plan);
    ctx = {
      plan: pobj, readOnly: false, sel: trackerSel,
      getDay: function (d) { return SP.days[d]; },
      toggleDay: function (d, i) {
        if (!SP.days[d]) { SP.days[d] = []; for (var k = 0; k < pobj.habits.length; k++) SP.days[d].push(false); }
        while (SP.days[d].length < pobj.habits.length) SP.days[d].push(false);
        SP.days[d][i] = !SP.days[d][i];
        queueDay(d);
      },
      getWeek: function (w) { return SP.weeks[w]; },
      toggleWeek: function (w, t, p) {
        if (!SP.weeks[w]) SP.weeks[w] = {};
        if (!SP.weeks[w][t]) {
          SP.weeks[w][t] = [];
          for (var k = 0; k < pobj.targets[t][1]; k++) SP.weeks[w][t].push(false);
        }
        SP.weeks[w][t][p] = !SP.weeks[w][t][p];
        queueWeek(w);
      },
      rerender: function () { trackerSel = ctx.sel; renderTracker(); }
    };
  } else if (!signedIn()) {
    var lp = lsGet(PLAN_KEY);
    var st = lsGet(STATE_KEY) || { days: {}, weeks: {} };
    if (lp) {
      ctx = {
        plan: lp, readOnly: false, sel: trackerSel,
        getDay: function (d) { return st.days[d]; },
        toggleDay: function (d, i) {
          if (!st.days[d]) { st.days[d] = []; for (var k = 0; k < lp.habits.length; k++) st.days[d].push(false); }
          while (st.days[d].length < lp.habits.length) st.days[d].push(false);
          st.days[d][i] = !st.days[d][i];
          lsSet(STATE_KEY, st);
        },
        getWeek: function (w) { return st.weeks[w]; },
        toggleWeek: function (w, t, p) {
          if (!st.weeks[w]) st.weeks[w] = {};
          if (!st.weeks[w][t]) {
            st.weeks[w][t] = [];
            for (var k = 0; k < lp.targets[t][1]; k++) st.weeks[w][t].push(false);
          }
          st.weeks[w][t][p] = !st.weeks[w][t][p];
          lsSet(STATE_KEY, st);
        },
        rerender: function () { trackerSel = ctx.sel; renderTracker(); }
      };
    }
  }

  if (!ctx) {
    wrap.appendChild(el('div', 'eyebrow', 'Your ledger'));
    wrap.appendChild(el('h1', null, 'No reset yet'));
    var card = el('div', 'card');
    card.appendChild(el('div', 'hint', 'Build your thirty days, or adopt the original plan.'));
    var br = el('div', 'btnrow'); br.style.marginTop = '4px';
    var b1 = el('a', 'btn', 'Build my plan'); b1.href = '#/new';
    var b2 = el('a', 'btn ghost', 'See the original'); b2.href = '#/paarth';
    br.appendChild(b1); br.appendChild(b2);
    var localPlan = lsGet(PLAN_KEY);
    if (signedIn() && localPlan) {
      var imp = el('button', 'btn ghost', 'Import my guest ledger'); imp.type = 'button';
      imp.addEventListener('click', importLocal);
      br.appendChild(imp);
    }
    card.appendChild(br);
    wrap.appendChild(card);
    root.appendChild(wrap);
    return;
  }

  wrap.appendChild(el('div', 'eyebrow',
    fmtDay(ctx.plan.startISO, 1) + ' - ' + fmtDay(ctx.plan.startISO, TOTAL)));
  var h1 = el('h1', null, ctx.plan.name);
  wrap.appendChild(h1);
  if (ctx.plan.visibility) {
    var vt = el('span', 'vtag', ctx.plan.visibility);
    h1.appendChild(vt);
  }
  if (ctx.plan.intent) wrap.appendChild(el('div', 'sub', ctx.plan.intent));

  renderLedger(wrap, ctx);

  if (!ctx.readOnly) {
    wrap.appendChild(commitCard(function () { trackerSel = ctx.sel; renderTracker(); }));
  }

  if (!signedIn() && backendReady()) {
    var up = el('div', 'card');
    up.appendChild(el('h2', null, 'Guest mode'));
    up.appendChild(el('div', 'hint',
      'This ledger lives only in this browser. Sign in and import it to sync across devices, share with friends, and appear in feeds.'));
    var b = el('a', 'btn ghost', 'Sign in'); b.href = '#/auth';
    up.appendChild(b);
    wrap.appendChild(up);
  }

  var foot = el('div', 'foot');
  foot.textContent = 'Never miss twice. Done before dopamine. The scorecard is the verdict on the day, not your feelings.';
  wrap.appendChild(foot);
  root.appendChild(wrap);
}

/* ---------- committing to more, permanently ---------- */

var COMMIT_WARNING = 'Be careful: once you commit to something, you will see it '
  + 'for the next thirty days and cannot remove it.';

/* Works signed in (the plans row) and in guest mode (localStorage), so the
   commitment means the same thing either way. */
async function addHabitWeb(label) {
  if (signedIn() && SP && SP.plan) {
    if (SP.plan.habits.length >= 7) { chip('Seven is the cap. Discipline is subtraction.'); return false; }
    var habits = SP.plan.habits.concat([label]);
    var r = await sb.from('plans').update({ habits: habits }).eq('id', SP.plan.id);
    if (r.error) { chip('Could not commit.'); return false; }
    SP.plan.habits = habits;
    chip('Committed. Thirty days.');
    return true;
  }
  var lp = lsGet(PLAN_KEY);
  if (!lp) return false;
  if (lp.habits.length >= 7) { chip('Seven is the cap. Discipline is subtraction.'); return false; }
  lp.habits = lp.habits.concat([label]);
  lsSet(PLAN_KEY, lp);
  chip('Committed. Thirty days.');
  return true;
}

async function addTargetWeb(label, count) {
  if (signedIn() && SP && SP.plan) {
    var cur = SP.plan.targets || [];
    if (cur.length >= 8) { chip('Eight targets is the cap.'); return false; }
    var targets = cur.concat([[label, count]]);
    var r = await sb.from('plans').update({ targets: targets }).eq('id', SP.plan.id);
    if (r.error) { chip('Could not commit.'); return false; }
    SP.plan.targets = targets;
    chip('Committed. Thirty days.');
    return true;
  }
  var lp = lsGet(PLAN_KEY);
  if (!lp) return false;
  var cur2 = lp.targets || [];
  if (cur2.length >= 8) { chip('Eight targets is the cap.'); return false; }
  lp.targets = cur2.concat([[label, count]]);
  lsSet(PLAN_KEY, lp);
  chip('Committed. Thirty days.');
  return true;
}

/* Two steps on purpose: naming it is not committing to it. */
function commitCard(onDone) {
  var card = el('div', 'card');
  card.appendChild(el('h2', null, 'Commit more'));
  card.appendChild(el('div', 'hint', COMMIT_WARNING));
  var host = el('div');
  card.appendChild(host);

  function idle() {
    host.textContent = '';
    var row = el('div', 'btnrow');
    [['habit', 'New non-negotiable'], ['target', 'New weekly target']].forEach(function (k) {
      var b = el('button', 'btn ghost small', k[1]);
      b.type = 'button';
      b.addEventListener('click', function () { form(k[0]); });
      row.appendChild(b);
    });
    host.appendChild(row);
  }

  function form(kind) {
    host.textContent = '';
    var ar = el('div', 'addrow');
    var input = el('input'); input.type = 'text'; input.maxLength = 40;
    input.placeholder = kind === 'habit' ? 'The daily action' : 'The weekly target';
    ar.appendChild(input);
    var cnt = null;
    if (kind === 'target') {
      cnt = el('input'); cnt.type = 'number'; cnt.min = '1'; cnt.max = '7'; cnt.value = '2';
      cnt.style.maxWidth = '70px';
      ar.appendChild(cnt);
    }
    var go = el('button', 'btn', 'Commit'); go.type = 'button';
    var no = el('button', 'btn ghost', 'Cancel'); no.type = 'button';
    ar.appendChild(go); ar.appendChild(no);
    host.appendChild(ar);
    no.addEventListener('click', idle);
    input.focus();

    var ask = function () {
      var label = input.value.trim();
      if (!label) return;
      var n = cnt ? Math.max(1, Math.min(7, parseInt(cnt.value, 10) || 1)) : 0;
      host.textContent = '';
      host.appendChild(el('div', 'hint', COMMIT_WARNING + '  ' + (kind === 'habit'
        ? '"' + label + '" joins your daily non-negotiables.'
        : '"' + label + ' x' + n + '" joins your weekly targets.')));
      var row2 = el('div', 'btnrow');
      var yes = el('button', 'btn', 'Commit for thirty days'); yes.type = 'button';
      var back = el('button', 'btn ghost', 'Not yet'); back.type = 'button';
      row2.appendChild(yes); row2.appendChild(back);
      host.appendChild(row2);
      back.addEventListener('click', idle);
      yes.addEventListener('click', async function () {
        yes.disabled = true;
        var ok = kind === 'habit' ? await addHabitWeb(label) : await addTargetWeb(label, n);
        if (ok) onDone(); else idle();
      });
    };
    go.addEventListener('click', ask);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') ask(); });
  }

  idle();
  return card;
}

async function importLocal() {
  var lp = lsGet(PLAN_KEY);
  var st = lsGet(STATE_KEY) || { days: {}, weeks: {} };
  if (!lp) return;
  lp.visibility = lp.visibility || 'friends';
  var ok = await createRemotePlan(lp);
  if (!ok) return;
  for (var d in st.days) {
    await sb.from('plan_days').upsert({
      plan_id: SP.plan.id, day: +d, checks: st.days[d], updated_at: new Date().toISOString()
    });
    SP.days[+d] = st.days[d];
  }
  for (var w in st.weeks) {
    await sb.from('plan_weeks').upsert({
      plan_id: SP.plan.id, week: +w, checks: st.weeks[w], updated_at: new Date().toISOString()
    });
    SP.weeks[+w] = st.weeks[w];
  }
  lsDel(PLAN_KEY); lsDel(STATE_KEY);
  chip('Guest ledger imported');
  renderTracker();
}

/* ---------- days: a real calendar of non-negotiables and todos ---------- */

/* Todos live on real dates, outside any 30-day plan. Cache is per-load;
   the month grid needs every todo anyway (a repeat has no end date). */
var TODOS = null;    // rows from public.todos
var TICKS = null;    // rows from public.todo_ticks
var daysSel = null;  // selected ISO date
var daysMonth = null;// {y, m} being shown

var GUEST_TODOS_KEY = 'metanoia_todos_v1';
var GUEST_TICKS_KEY = 'metanoia_ticks_v1';

function todosLocal() { return lsGet(GUEST_TODOS_KEY) || []; }
function ticksLocal() { return lsGet(GUEST_TICKS_KEY) || []; }

async function loadTodos() {
  if (!signedIn()) { TODOS = todosLocal(); TICKS = ticksLocal(); return; }
  var r = await Promise.all([
    sb.from('todos').select('*').order('created_at'),
    sb.from('todo_ticks').select('*')
  ]);
  /* Table not migrated yet: fail visibly in one place, not on every tick. */
  TODOS = r[0].error ? null : (r[0].data || []);
  TICKS = r[1].error ? [] : (r[1].data || []);
}

async function addTodo(body, repeats, iso) {
  var row = repeats
    ? { body: body, repeats: true, starts_on: iso, on_date: null, ends_on: null }
    : { body: body, repeats: false, on_date: iso, starts_on: null, ends_on: null };
  if (!signedIn()) {
    row.id = 'g' + Date.now() + Math.floor(Math.random() * 1000);
    row.created_at = new Date().toISOString();
    var list = todosLocal(); list.push(row); lsSet(GUEST_TODOS_KEY, list);
    TODOS = list;
    return true;
  }
  row.owner = session.user.id;
  var r = await sb.from('todos').insert(row).select().single();
  if (r.error) { chip('Could not add that.'); return false; }
  TODOS.push(r.data);
  return true;
}

async function setTodoTick(todoId, iso, done) {
  if (!signedIn()) {
    var list = ticksLocal().filter(function (t) {
      return !(t.todo_id === todoId && t.on_date === iso);
    });
    if (done) list.push({ todo_id: todoId, on_date: iso });
    lsSet(GUEST_TICKS_KEY, list);
    TICKS = list;
    return;
  }
  if (done) {
    var r = await sb.from('todo_ticks').upsert(
      { todo_id: todoId, on_date: iso, updated_at: new Date().toISOString() },
      { onConflict: 'todo_id,on_date' });
    if (r.error) { chip('Could not save that tick.'); return; }
    TICKS.push({ todo_id: todoId, on_date: iso });
  } else {
    var r2 = await sb.from('todo_ticks').delete().eq('todo_id', todoId).eq('on_date', iso);
    if (r2.error) { chip('Could not clear that tick.'); return; }
    TICKS = TICKS.filter(function (t) { return !(t.todo_id === todoId && t.on_date === iso); });
  }
}

/* Deleting a repeat that has history ends it instead of erasing it: the days
   you already earned keep their record. A repeat nobody ever ticked (a typo)
   and any one-off go for good. */
async function removeTodo(todo, iso) {
  var hasHistory = todo.repeats && TICKS.some(function (t) { return t.todo_id === todo.id; });
  if (hasHistory) {
    var endsOn = TodoCore.endDateForStop(todo.id, TICKS, iso);
    if (!signedIn()) {
      var list = todosLocal().map(function (t) {
        return t.id === todo.id ? Object.assign({}, t, { ends_on: endsOn }) : t;
      });
      lsSet(GUEST_TODOS_KEY, list); TODOS = list;
      return;
    }
    var r = await sb.from('todos').update({ ends_on: endsOn }).eq('id', todo.id);
    if (r.error) { chip('Could not stop that.'); return; }
    TODOS.forEach(function (t) { if (t.id === todo.id) t.ends_on = endsOn; });
    chip('Stopped. The days you ticked keep it.');
    return;
  }
  if (!signedIn()) {
    lsSet(GUEST_TODOS_KEY, todosLocal().filter(function (t) { return t.id !== todo.id; }));
    lsSet(GUEST_TICKS_KEY, ticksLocal().filter(function (t) { return t.todo_id !== todo.id; }));
    TODOS = todosLocal(); TICKS = ticksLocal();
    return;
  }
  var r2 = await sb.from('todos').delete().eq('id', todo.id);
  if (r2.error) { chip('Could not delete that.'); return; }
  TODOS = TODOS.filter(function (t) { return t.id !== todo.id; });
  TICKS = TICKS.filter(function (t) { return t.todo_id !== todo.id; });
}

/* window.TodoCore is loaded by index.html before this script. */
function shiftIsoW(iso, n) { return TodoCore.shiftIso(iso, n); }

function activePlanForDays() {
  if (signedIn() && SP && SP.plan) return planRowToObj(SP.plan);
  return lsGet(PLAN_KEY) || null;
}
function planChecksFor(dayNum) {
  if (signedIn() && SP) return SP.days[dayNum];
  var st = lsGet(STATE_KEY) || { days: {} };
  return st.days[dayNum];
}

async function renderDays() {
  var root = clear();
  var wrap = el('div', 'wrap');
  wrap.appendChild(el('div', 'eyebrow', 'Every day, on the record'));
  wrap.appendChild(el('h1', null, 'Days'));
  root.appendChild(wrap);

  if (TODOS === null || TODOS === undefined) await loadTodos();
  if (TODOS === null) {
    var warn = el('div', 'card');
    warn.appendChild(el('div', 'hint',
      'Todos are not set up on the backend yet. Run supabase/migration-2026-08-29-todos.sql '
      + 'in the SQL editor, then reload.'));
    wrap.appendChild(warn);
    return;
  }

  var today = TodoCore.isoTodayLocal();
  if (!daysSel) daysSel = today;
  if (!daysMonth) {
    var d0 = TodoCore.parseIsoLocal(daysSel);
    daysMonth = { y: d0.getFullYear(), m: d0.getMonth() };
  }
  var plan = activePlanForDays();

  /* ----- month grid ----- */
  var cal = el('div', 'card');
  var chead = el('div', 'calhead');
  var prev = el('button', 'calnav', '<'); prev.type = 'button';
  var next = el('button', 'calnav', '>'); next.type = 'button';
  prev.addEventListener('click', function () {
    daysMonth = daysMonth.m === 0 ? { y: daysMonth.y - 1, m: 11 } : { y: daysMonth.y, m: daysMonth.m - 1 };
    renderDays();
  });
  next.addEventListener('click', function () {
    daysMonth = daysMonth.m === 11 ? { y: daysMonth.y + 1, m: 0 } : { y: daysMonth.y, m: daysMonth.m + 1 };
    renderDays();
  });
  chead.appendChild(prev);
  chead.appendChild(el('span', 'calmonth', TodoCore.monthLabel(daysMonth.y, daysMonth.m)));
  chead.appendChild(next);
  cal.appendChild(chead);

  var dow = el('div', 'calgrid dow');
  TodoCore.WEEKDAYS.forEach(function (w) { dow.appendChild(el('span', null, w)); });
  cal.appendChild(dow);

  var grid = el('div', 'calgrid');
  TodoCore.monthGrid(daysMonth.y, daysMonth.m).forEach(function (cell) {
    var b = el('button', 'calcell'); b.type = 'button';
    if (!cell.inMonth) b.className += ' out';
    if (cell.iso === today) b.className += ' today';
    if (cell.iso === daysSel) b.className += ' sel';
    b.appendChild(el('span', 'cd', String(cell.day)));

    /* Ledger colouring for dates inside the reset, exactly as the grid does. */
    var pd = plan ? TodoCore.planDayOf(plan.startISO, cell.iso) : null;
    if (pd) {
      var nH = plan.habits.length;
      var sc = scoreOf(planChecksFor(pd), nH);
      if (sc === nH) b.className += ' full';
      else if (sc === 0 && cell.iso < today) b.className += ' zero';
    }
    if (TodoCore.dayHasMark(TODOS, TICKS, cell.iso, today)) b.appendChild(el('i', 'dot'));
    b.addEventListener('click', function () { daysSel = cell.iso; renderDays(); });
    grid.appendChild(b);
  });
  cal.appendChild(grid);
  wrap.appendChild(cal);

  /* ----- the selected day ----- */
  var selDate = TodoCore.parseIsoLocal(daysSel);
  var D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var card = el('div', 'card');
  var dh = el('div', 'dayhead');
  dh.appendChild(el('span', 'dn', D[selDate.getDay()] + ' '
    + TodoCore.MONTH_NAMES[selDate.getMonth()].slice(0, 3) + ' ' + selDate.getDate()));
  var counts = TodoCore.todoCountsForDate(TODOS, TICKS, daysSel);
  var planDay = plan ? TodoCore.planDayOf(plan.startISO, daysSel) : null;
  var right = daysSel === today ? 'today' : (daysSel > today ? 'ahead' : 'past');
  dh.appendChild(el('span', 'dd', right));
  card.appendChild(dh);

  var future = daysSel > today;

  if (planDay) {
    card.appendChild(el('div', 'seclbl', 'Non-negotiables - day ' + planDay + ' of 30'));
    var nH = plan.habits.length;
    var arr = planChecksFor(planDay) || [];
    plan.habits.forEach(function (label, i) {
      var on = !!arr[i];
      var b = el('button', 'habit' + (on ? ' on' : ''));
      b.type = 'button';
      b.disabled = future;
      b.appendChild(el('span', 'box'));
      b.appendChild(el('span', 'lbl', label));
      if (!future) {
        b.addEventListener('click', async function () {
          await toggleHabitOnDay(planDay, i, plan);
          renderDays();
        });
      }
      card.appendChild(b);
    });
    card.appendChild(el('div', 'scoreline', scoreOf(arr, nH) + ' / ' + nH));
  }

  card.appendChild(el('div', 'seclbl',
    'Todos' + (counts.total ? '  ' + counts.done + ' / ' + counts.total : '')));
  var list = TodoCore.resolveTodosForDate(TODOS, TICKS, daysSel);
  if (!list.length) {
    card.appendChild(el('div', 'hint', 'Nothing on the books for this day.'));
  }
  list.forEach(function (t) {
    var rowE = el('div', 'todorow');
    var b = el('button', 'habit' + (t.done ? ' on' : ''));
    b.type = 'button';
    b.disabled = future;
    b.appendChild(el('span', 'box'));
    var lbl = el('span', 'lbl', t.body);
    if (t.repeats) lbl.appendChild(el('span', 'rep', 'daily'));
    b.appendChild(lbl);
    if (!future) {
      b.addEventListener('click', async function () {
        await setTodoTick(t.id, daysSel, !t.done);
        renderDays();
      });
    }
    rowE.appendChild(b);
    var x = el('button', 'xb', 'delete'); x.type = 'button';
    x.addEventListener('click', async function () {
      var full = TODOS.filter(function (r) { return r.id === t.id; })[0];
      if (!full) return;
      var hist = full.repeats && TICKS.some(function (k) { return k.todo_id === full.id; });
      var q = hist
        ? 'Stop "' + t.body + '" from here on? The days you already ticked keep it.'
        : 'Delete "' + t.body + '"?';
      if (!confirm(q)) return;
      await removeTodo(full, daysSel);
      renderDays();
    });
    rowE.appendChild(x);
    card.appendChild(rowE);
  });

  /* ----- add ----- */
  var addRow = el('div', 'addrow'); addRow.style.marginTop = '14px';
  var ti = el('input'); ti.type = 'text'; ti.maxLength = 120;
  ti.placeholder = 'Add a todo for this day';
  var addB = el('button', 'btn', 'Add'); addB.type = 'button';
  addRow.appendChild(ti); addRow.appendChild(addB);
  card.appendChild(addRow);

  var repWrap = el('label', 'repline');
  var rep = el('input'); rep.type = 'checkbox';
  repWrap.appendChild(rep);
  repWrap.appendChild(el('span', null, 'Repeat every day from here'));
  card.appendChild(repWrap);

  var go = async function () {
    var v = ti.value.trim();
    if (!v) return;
    addB.disabled = true;
    var ok = await addTodo(v, rep.checked, daysSel);
    addB.disabled = false;
    if (ok) { ti.value = ''; rep.checked = false; renderDays(); }
  };
  addB.addEventListener('click', go);
  ti.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });

  wrap.appendChild(card);

  var foot = el('div', 'foot');
  foot.textContent = 'Todos are yours alone: they are never shared, never in the feed, and '
    + 'never counted in your streak. The non-negotiables are the verdict.';
  wrap.appendChild(foot);
}

/* Ticking a non-negotiable from the calendar writes through the same paths the
   ledger uses, so the two views can never disagree. */
async function toggleHabitOnDay(dayNum, i, plan) {
  if (signedIn() && SP && SP.plan) {
    if (!SP.days[dayNum]) SP.days[dayNum] = [];
    while (SP.days[dayNum].length < plan.habits.length) SP.days[dayNum].push(false);
    SP.days[dayNum][i] = !SP.days[dayNum][i];
    queueDay(dayNum);
    return;
  }
  var st = lsGet(STATE_KEY) || { days: {}, weeks: {} };
  if (!st.days[dayNum]) st.days[dayNum] = [];
  while (st.days[dayNum].length < plan.habits.length) st.days[dayNum].push(false);
  st.days[dayNum][i] = !st.days[dayNum][i];
  lsSet(STATE_KEY, st);
}

/* ---------- feed ---------- */

var MUTED_KEY = 'metanoia_muted_groups_v1';
var REACTION_KINDS = [['respect', 'Respect'], ['locked_in', 'Locked in'], ['soft', 'Soft']];
var feedFilter = { kind: 'all' };
var groupSection = 'feed';
var liveChannel = null;   /* per-page realtime subscription, torn down on navigation */

function mutedGroups() { return lsGet(MUTED_KEY) || []; }
function setMutedGroups(ids) { lsSet(MUTED_KEY, ids); }

function dropLiveChannel() {
  if (liveChannel) { sb.removeChannel(liveChannel); liveChannel = null; }
}

/* Null means the reactions table is not there yet: callers hide the row
   rather than showing every event as having zero of everything. */
async function loadReactions(events) {
  var ids = events.map(function (e) { return e.id; });
  if (!ids.length) return {};
  var rr = await sb.from('feed_reactions').select('*').in('event_id', ids);
  if (rr.error) return null;
  var map = {};
  (rr.data || []).forEach(function (r) {
    if (!map[r.event_id]) map[r.event_id] = { counts: {}, mine: null };
    map[r.event_id].counts[r.kind] = (map[r.event_id].counts[r.kind] || 0) + 1;
    if (r.user_id === session.user.id) map[r.event_id].mine = r.kind;
  });
  return map;
}

function feedVerb(ev) {
  var pname = (ev.plans && ev.plans.name) || (ev.payload && ev.payload.plan_name) || 'a reset';
  if (ev.kind === 'started') return ' started "' + pname + '". Watch them.';
  if (ev.kind === 'perfect') return ' went perfect on day ' + ev.day + ' of "' + pname + '".';
  if (ev.kind === 'finished') return ' finished the thirty days of "' + pname + '".';
  if (ev.kind === 'streak') return ' is on a ' + esc(ev.payload && ev.payload.streak) + '-day streak.';
  return ' ticked ' + esc(ev.payload && ev.payload.score) + '/' + esc(ev.payload && ev.payload.total)
    + ' on day ' + ev.day + ' of "' + pname + '".';
}

/* Paints events into host. opts: {userFilter: [ids], hideUsers: {id:true},
   emptyText}. Repaints itself after a reaction so counts stay honest. */
async function paintFeed(host, events, opts) {
  opts = opts || {};
  var list = events.filter(function (ev) {
    if (opts.userFilter && opts.userFilter.indexOf(ev.user_id) < 0) return false;
    if (opts.hideUsers && opts.hideUsers[ev.user_id]) return false;
    return true;
  });
  var rx = await loadReactions(list);
  host.textContent = '';
  if (!list.length) {
    host.appendChild(el('div', 'hint', opts.emptyText
      || 'Quiet in here. Add friends or join a group under Social, and their ticks show up as they happen.'));
    return;
  }
  list.forEach(function (ev) {
    var prof = ev.profiles || {};
    var uname = prof.username || 'someone';
    var item = el('div', 'feeditem' + (ev.kind === 'perfect' ? ' perfect' : ''));
    item.appendChild(el('div', 'avatar', (uname[0] || '?')));
    var body = el('div', 'fbody');
    var line = el('div', 'fline');
    /* Only link a real username; '#/u/someone' is a dead end. */
    if (prof.username) {
      var a = el('a', null, prof.display_name || prof.username);
      a.href = '#/u/' + encodeURIComponent(prof.username);
      line.appendChild(a);
    } else {
      line.appendChild(el('b', null, prof.display_name || 'someone'));
    }
    line.appendChild(document.createTextNode(feedVerb(ev)));
    body.appendChild(line);
    body.appendChild(el('div', 'fmeta', ago(ev.created_at)));
    if ((ev.kind === 'tick' || ev.kind === 'perfect') && ev.payload && ev.payload.total) {
      var bar = el('div', 'fbar');
      var fill = el('i');
      fill.style.width = Math.round((ev.payload.score / ev.payload.total) * 100) + '%';
      bar.appendChild(fill);
      body.appendChild(bar);
    }
    if (rx) {
      var rrow = el('div', 'rxrow');
      REACTION_KINDS.forEach(function (k) {
        var mine = rx[ev.id] && rx[ev.id].mine === k[0];
        var count = (rx[ev.id] && rx[ev.id].counts[k[0]]) || 0;
        var b = el('button', 'rx' + (mine ? ' on' : '') + (k[0] === 'soft' ? ' soft' : ''));
        b.type = 'button';
        b.appendChild(el('span', null, k[1]));
        if (count > 0) b.appendChild(el('b', null, String(count)));
        b.addEventListener('click', async function () {
          b.disabled = true;
          if (mine) {
            await sb.from('feed_reactions').delete()
              .eq('event_id', ev.id).eq('user_id', session.user.id);
          } else {
            await sb.from('feed_reactions').upsert(
              { event_id: ev.id, user_id: session.user.id, kind: k[0] },
              { onConflict: 'event_id,user_id' });
          }
          paintFeed(host, events, opts);
        });
        rrow.appendChild(b);
      });
      body.appendChild(rrow);
    }
    item.appendChild(body);
    host.appendChild(item);
  });
}

function pillRow(chips) {
  var row = el('div', 'pills');
  chips.forEach(function (ch) {
    var b = el('button', 'pill' + (ch.active ? ' on' : ''), ch.label);
    b.type = 'button';
    b.addEventListener('click', ch.onClick);
    row.appendChild(b);
  });
  return row;
}

async function renderFeed() {
  var root = clear();
  var wrap = el('div', 'wrap');
  wrap.appendChild(el('div', 'eyebrow', 'The accountability wire'));
  wrap.appendChild(el('h1', null, 'Feed'));
  if (!signedIn()) {
    var c0 = el('div', 'card');
    c0.appendChild(el('div', 'hint', 'Sign in to see your friends and groups tick their days.'));
    wrap.appendChild(c0); root.appendChild(wrap); return;
  }
  var pillHost = el('div');
  wrap.appendChild(pillHost);
  var card = el('div', 'card');
  card.appendChild(el('div', 'hint', 'Loading...'));
  wrap.appendChild(card);
  root.appendChild(wrap);

  var res = await Promise.all([
    fetchFeed(),
    sb.from('groups').select('id, name, group_members(user_id)'),
    sb.from('friendships').select('*').eq('status', 'accepted')
  ]);
  var events = res[0];
  var groups = res[1].data || [];
  var friendIds = (res[2].data || []).map(function (r) {
    return r.user_a === session.user.id ? r.user_b : r.user_a;
  });

  feedUnseen = 0;
  lsSet(SEEN_KEY, new Date().toISOString());
  renderNav();

  function repaint() {
    var muted = mutedGroups();
    var opts = {};
    if (feedFilter.kind === 'friends') {
      opts.userFilter = friendIds.concat([session.user.id]);
      opts.emptyText = 'Nothing from your friends yet.';
    } else if (feedFilter.kind === 'group') {
      var g = groups.filter(function (x) { return x.id === feedFilter.id; })[0];
      opts.userFilter = g ? (g.group_members || []).map(function (m) { return m.user_id; }) : [];
      opts.emptyText = 'Nothing from this group yet.';
    } else {
      /* Silencing hides a group's members from the main feed, unless they
         reach you another way: a friend, or another group you did not silence. */
      var hide = {};
      groups.forEach(function (g2) {
        if (muted.indexOf(g2.id) < 0) return;
        (g2.group_members || []).forEach(function (m) { hide[m.user_id] = true; });
      });
      groups.forEach(function (g2) {
        if (muted.indexOf(g2.id) >= 0) return;
        (g2.group_members || []).forEach(function (m) { delete hide[m.user_id]; });
      });
      friendIds.forEach(function (id) { delete hide[id]; });
      delete hide[session.user.id];
      opts.hideUsers = hide;
    }

    pillHost.textContent = '';
    var chips = [
      { label: 'All', active: feedFilter.kind === 'all',
        onClick: function () { feedFilter = { kind: 'all' }; repaint(); } },
      { label: 'Friends', active: feedFilter.kind === 'friends',
        onClick: function () { feedFilter = { kind: 'friends' }; repaint(); } }
    ];
    groups.forEach(function (g3) {
      chips.push({
        label: muted.indexOf(g3.id) >= 0 ? g3.name + ' (silenced)' : g3.name,
        active: feedFilter.kind === 'group' && feedFilter.id === g3.id,
        onClick: function () { feedFilter = { kind: 'group', id: g3.id }; repaint(); }
      });
    });
    pillHost.appendChild(pillRow(chips));
    paintFeed(card, events, opts);
  }
  repaint();
}

/* ---------- social: groups first, friends behind a door ---------- */

function groupAvatar(g, cls) {
  if (g.image_url) {
    var img = el('img', 'gav' + (cls ? ' ' + cls : ''));
    img.src = g.image_url;
    img.alt = '';
    return img;
  }
  return el('div', 'gav' + (cls ? ' ' + cls : ''), (g.name || '?')[0]);
}

async function renderPeople() {
  var root = clear();
  var wrap = el('div', 'wrap');
  wrap.appendChild(el('div', 'eyebrow', 'Groups and friends'));
  wrap.appendChild(el('h1', null, 'Social'));
  if (!signedIn()) {
    var c0 = el('div', 'card');
    c0.appendChild(el('div', 'hint', 'Sign in to add friends and form groups.'));
    wrap.appendChild(c0); root.appendChild(wrap); return;
  }
  root.appendChild(wrap);

  var gc = el('div', 'card');
  gc.appendChild(el('h2', null, 'Your groups'));
  var glist = el('div');
  gc.appendChild(glist);

  var mkRow = el('div', 'addrow'); mkRow.style.marginTop = '14px';
  var gn = el('input'); gn.type = 'text'; gn.placeholder = 'New group name'; gn.maxLength = 40;
  var mk = el('button', 'btn', 'Create'); mk.type = 'button';
  mk.addEventListener('click', async function () {
    var v = gn.value.trim(); if (!v) return;
    var r = await sb.rpc('create_group', { gname: v });
    if (r.error) chip('Could not create: ' + r.error.message);
    gn.value = ''; loadGroups();
  });
  mkRow.appendChild(gn); mkRow.appendChild(mk);
  gc.appendChild(mkRow);

  var jnRow = el('div', 'addrow');
  var jc = el('input'); jc.type = 'text'; jc.placeholder = 'Invite code';
  jc.setAttribute('autocapitalize', 'none');
  var jn = el('button', 'btn ghost', 'Join'); jn.type = 'button';
  jn.addEventListener('click', async function () {
    var v = jc.value.trim(); if (!v) return;
    var r = await sb.rpc('join_group', { code: v });
    if (r.error) chip('Could not join: ' + r.error.message);
    else chip('Joined');
    jc.value = ''; loadGroups();
  });
  jnRow.appendChild(jc); jnRow.appendChild(jn);
  gc.appendChild(jnRow);
  wrap.appendChild(gc);

  var fdoor = el('div', 'card');
  var fb = el('a', 'btn', 'Friends'); fb.href = '#/friends';
  fdoor.appendChild(fb);
  fdoor.appendChild(el('div', 'hint', 'Requests, your friends list, and adding people by username.'));
  wrap.appendChild(fdoor);

  async function loadGroups() {
    glist.textContent = '';
    var gr = await sb.from('groups')
      .select('*, group_members(user_id, profiles(username, display_name))');
    var groups = gr.data || [];
    if (!groups.length) {
      glist.appendChild(el('div', 'hint',
        'No groups yet. Create one and share the invite code: the group sees each '
        + "other's ledgers and feed, and gets a private chat."));
      return;
    }
    groups.forEach(function (g) {
      var a = el('a', 'grow');
      a.href = '#/g/' + g.id;
      a.appendChild(groupAvatar(g));
      var mid = el('div', 'gmid');
      mid.appendChild(el('div', 'gname', g.name));
      var n = (g.group_members || []).length;
      mid.appendChild(el('div', 'count', n + ' member' + (n === 1 ? '' : 's')));
      a.appendChild(mid);
      a.appendChild(el('span', 'chev', '>'));
      glist.appendChild(a);
    });
  }
  loadGroups();
}

async function renderFriends() {
  var root = clear();
  var wrap = el('div', 'wrap');
  var back = el('a', 'backlink', '< Social'); back.href = '#/people';
  wrap.appendChild(back);
  wrap.appendChild(el('div', 'eyebrow', 'Witnesses to the thirty days'));
  wrap.appendChild(el('h1', null, 'Friends'));
  if (!signedIn()) {
    var c0 = el('div', 'card');
    c0.appendChild(el('div', 'hint', 'Sign in to add friends.'));
    wrap.appendChild(c0); root.appendChild(wrap); return;
  }
  root.appendChild(wrap);

  var find = el('div', 'card');
  find.appendChild(el('h2', null, 'Add a friend'));
  var ar = el('div', 'addrow');
  var un = el('input'); un.type = 'text'; un.placeholder = 'Their username';
  un.setAttribute('autocapitalize', 'none');
  var req = el('button', 'btn', 'Request'); req.type = 'button';
  ar.appendChild(un); ar.appendChild(req);
  find.appendChild(ar);
  var fmsg = el('div', 'ok', '');
  find.appendChild(fmsg);
  req.addEventListener('click', async function () {
    var v = un.value.trim().toLowerCase();
    if (!v) return;
    var p = await sb.from('profiles').select('id, username').eq('username', v).maybeSingle();
    if (!p.data) { fmsg.textContent = 'No one has claimed the username "' + v + '".'; return; }
    if (p.data.id === session.user.id) { fmsg.textContent = 'That is you.'; return; }
    var a = session.user.id < p.data.id ? session.user.id : p.data.id;
    var b = session.user.id < p.data.id ? p.data.id : session.user.id;
    var r = await sb.from('friendships').insert({
      user_a: a, user_b: b, requested_by: session.user.id, status: 'pending'
    });
    fmsg.textContent = r.error
      ? (r.error.code === '23505' ? 'Request already exists.' : 'Failed: ' + r.error.message)
      : 'Requested. They accept from their Friends page.';
    un.value = '';
    loadLists();
  });
  wrap.appendChild(find);

  var lists = el('div');
  wrap.appendChild(lists);

  async function loadLists() {
    lists.textContent = '';
    var r = await sb.from('friendships').select(
      '*, a:profiles!friendships_user_a_fkey(id, username, display_name), b:profiles!friendships_user_b_fkey(id, username, display_name)');
    var rows = r.data || [];
    var friends = [], incoming = [], outgoing = [];
    rows.forEach(function (row) {
      var other = row.a && row.a.id === session.user.id ? row.b : row.a;
      if (!other) return;
      if (row.status === 'accepted') friends.push({ row: row, other: other });
      else if (row.requested_by === session.user.id) outgoing.push({ row: row, other: other });
      else incoming.push({ row: row, other: other });
    });

    if (incoming.length) {
      var ic = el('div', 'card');
      ic.appendChild(el('h2', null, 'Requests for you'));
      incoming.forEach(function (f) {
        var rowE = el('div', 'trow');
        rowE.appendChild(personLink(f.other));
        var acc = el('button', 'btn small', 'Accept'); acc.type = 'button';
        acc.addEventListener('click', async function () {
          await sb.from('friendships').update({ status: 'accepted' })
            .eq('user_a', f.row.user_a).eq('user_b', f.row.user_b);
          loadLists();
        });
        var dec = el('button', 'xb', 'decline'); dec.type = 'button';
        dec.addEventListener('click', async function () {
          await sb.from('friendships').delete()
            .eq('user_a', f.row.user_a).eq('user_b', f.row.user_b);
          loadLists();
        });
        rowE.appendChild(acc); rowE.appendChild(dec);
        ic.appendChild(rowE);
      });
      lists.appendChild(ic);
    }

    var fc = el('div', 'card');
    fc.appendChild(el('h2', null, 'Friends'));
    if (!friends.length) fc.appendChild(el('div', 'hint', 'No friends yet. Accountability needs witnesses.'));
    friends.forEach(function (f) {
      var rowE = el('div', 'trow');
      rowE.appendChild(personLink(f.other));
      var rm = el('button', 'xb', 'remove'); rm.type = 'button';
      rm.addEventListener('click', async function () {
        if (!confirm('Remove this friend?')) return;
        await sb.from('friendships').delete()
          .eq('user_a', f.row.user_a).eq('user_b', f.row.user_b);
        loadLists();
      });
      rowE.appendChild(rm);
      fc.appendChild(rowE);
    });
    outgoing.forEach(function (f) {
      var rowE = el('div', 'trow');
      rowE.appendChild(el('span', 'tl2', (f.other.username || 'unnamed') + '  (pending)'));
      fc.appendChild(rowE);
    });
    lists.appendChild(fc);
  }
  loadLists();
}

/* ---------- one group: feed, chat, members, settings ---------- */

async function renderGroup(gid) {
  /* Section switches re-enter this function directly, not through route(),
     so drop any chat subscription here too or they stack up. */
  dropLiveChannel();
  var root = clear();
  var wrap = el('div', 'wrap');
  var back = el('a', 'backlink', '< Social'); back.href = '#/people';
  wrap.appendChild(back);
  root.appendChild(wrap);
  if (!signedIn()) {
    wrap.appendChild(el('h1', null, 'Sign in first'));
    return;
  }
  gid = decodeURIComponent(gid);
  var gr = await sb.from('groups')
    .select('*, group_members(user_id, profiles(username, display_name))')
    .eq('id', gid).maybeSingle();
  if (!gr.data) {
    wrap.appendChild(el('h1', null, 'No such group'));
    wrap.appendChild(el('div', 'hint', 'You are not a member of this group, or it no longer exists.'));
    return;
  }
  var g = gr.data;
  var members = g.group_members || [];

  var head = el('div', 'ghead');
  head.appendChild(groupAvatar(g, 'big'));
  var hmid = el('div', 'gmid');
  hmid.appendChild(el('h1', 'gtitle', g.name));
  hmid.appendChild(el('div', 'count',
    members.length + ' member' + (members.length === 1 ? '' : 's')));
  head.appendChild(hmid);
  wrap.appendChild(head);

  var tabs = el('div', 'seg');
  var body = el('div');
  [['feed', 'Feed'], ['chat', 'Chat'], ['members', 'Members'], ['settings', 'Settings']]
    .forEach(function (t) {
      var b = el('button', 'segb' + (groupSection === t[0] ? ' on' : ''), t[1]);
      b.type = 'button';
      b.addEventListener('click', function () {
        groupSection = t[0];
        renderGroup(gid);
      });
      tabs.appendChild(b);
    });
  wrap.appendChild(tabs);
  wrap.appendChild(body);

  if (groupSection === 'feed') {
    var fcard = el('div', 'card');
    fcard.appendChild(el('div', 'hint', 'Loading...'));
    body.appendChild(fcard);
    var events = await fetchFeed();
    paintFeed(fcard, events, {
      userFilter: members.map(function (m) { return m.user_id; }),
      emptyText: 'Nothing from this group yet. Ticks, perfect days, and new resets from members land here.'
    });
  }

  if (groupSection === 'chat') {
    var ccard = el('div', 'card');
    var log = el('div', 'chatlog');
    ccard.appendChild(log);
    var crow = el('div', 'addrow');
    var ci = el('input'); ci.type = 'text'; ci.placeholder = 'Write to the group'; ci.maxLength = 2000;
    var cs = el('button', 'btn', 'Send'); cs.type = 'button';
    crow.appendChild(ci); crow.appendChild(cs);
    ccard.appendChild(crow);
    body.appendChild(ccard);

    var loadMsgs = async function () {
      var r = await sb.from('group_messages')
        .select('*, profiles(username, display_name)')
        .eq('group_id', g.id)
        .order('created_at', { ascending: false }).limit(100);
      log.textContent = '';
      if (r.error) {
        log.appendChild(el('div', 'hint', 'Chat is being set up on the backend. Check back shortly.'));
        return;
      }
      var msgs = (r.data || []).slice().reverse();
      if (!msgs.length) {
        log.appendChild(el('div', 'hint', 'Quiet in here. Say something.'));
        return;
      }
      msgs.forEach(function (m) {
        var mine = m.user_id === session.user.id;
        var b = el('div', 'msg' + (mine ? ' mine' : ''));
        if (!mine) {
          b.appendChild(el('div', 'mwho',
            (m.profiles && (m.profiles.display_name || m.profiles.username)) || 'unnamed'));
        }
        b.appendChild(el('div', 'mbody', m.body));
        b.appendChild(el('div', 'mwhen', ago(m.created_at)));
        log.appendChild(b);
      });
      log.scrollTop = log.scrollHeight;
    };

    var send = async function () {
      var v = ci.value.trim(); if (!v) return;
      ci.value = '';
      var r = await sb.from('group_messages').insert({
        group_id: g.id, user_id: session.user.id, body: v
      });
      if (r.error) chip('Could not send.');
      loadMsgs();
    };
    cs.addEventListener('click', send);
    ci.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
    loadMsgs();

    liveChannel = sb.channel('chat-' + g.id)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: 'group_id=eq.' + g.id },
        function () { loadMsgs(); })
      .subscribe();
  }

  if (groupSection === 'members') {
    var inv = el('div', 'card');
    inv.appendChild(el('h2', null, 'Invite'));
    var invRow = el('div', 'btnrow');
    var addB = el('button', 'btn ghost', 'Add a friend'); addB.type = 'button';
    var shareB = el('button', 'btn ghost', 'Copy invite link'); shareB.type = 'button';
    shareB.addEventListener('click', async function () {
      var link = location.origin + location.pathname + '#/join/' + g.invite_code;
      try {
        await navigator.clipboard.writeText(
          'Join "' + g.name + '" on Metanoia. Invite code: ' + g.invite_code + '  ' + link);
        chip('Invite link copied');
      } catch (e) { chip(link); }
    });
    invRow.appendChild(addB); invRow.appendChild(shareB);
    inv.appendChild(invRow);
    var opts = el('div');
    inv.appendChild(opts);
    addB.addEventListener('click', async function () {
      if (opts.textContent) { opts.textContent = ''; return; }
      opts.appendChild(el('div', 'hint', 'Loading...'));
      var r = await sb.from('friendships').select(
        '*, a:profiles!friendships_user_a_fkey(id, username, display_name), b:profiles!friendships_user_b_fkey(id, username, display_name)')
        .eq('status', 'accepted');
      var cand = (r.data || []).map(function (row) {
        return row.a && row.a.id === session.user.id ? row.b : row.a;
      }).filter(function (p) {
        return p && !members.some(function (m) { return m.user_id === p.id; });
      });
      opts.textContent = '';
      if (!cand.length) {
        opts.appendChild(el('div', 'hint',
          'All of your friends are already here, or you have none yet. Share the code instead.'));
        return;
      }
      cand.forEach(function (p) {
        var rowE = el('div', 'trow');
        rowE.appendChild(el('span', 'tl2', p.display_name || p.username));
        var ab = el('button', 'btn small', 'Add'); ab.type = 'button';
        ab.addEventListener('click', async function () {
          var rr = await sb.rpc('add_friend_to_group', { gid: g.id, fid: p.id });
          if (rr.error) chip('Could not add them.');
          else { chip('Added to the group.'); renderGroup(gid); }
        });
        rowE.appendChild(ab);
        opts.appendChild(rowE);
      });
    });
    body.appendChild(inv);

    var mc = el('div', 'card');
    members.forEach(function (m) {
      var rowE = el('div', 'trow');
      rowE.appendChild(personLink(m.profiles));
      mc.appendChild(rowE);
    });
    mc.appendChild(el('div', 'hint',
      "Click a member to see their ledger. Group-mates see each other's friends-tier plans; private stays private."));
    body.appendChild(mc);
  }

  if (groupSection === 'settings') {
    var ic2 = el('div', 'card');
    ic2.appendChild(el('h2', null, 'Group image'));
    var imgRow = el('div', 'ghead');
    imgRow.appendChild(groupAvatar(g, 'big'));
    var fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = 'image/*';
    fileIn.style.display = 'none';
    var pick = el('button', 'btn ghost', 'Change image'); pick.type = 'button';
    pick.addEventListener('click', function () { fileIn.click(); });
    fileIn.addEventListener('change', async function () {
      var f = fileIn.files && fileIn.files[0];
      if (!f) return;
      chip('Uploading...');
      /* Fixed .jpg path so the app and the site overwrite the same object;
         the storage policy only reads the uuid before the first dot. */
      var path = g.id + '.jpg';
      var up = await sb.storage.from('group-images')
        .upload(path, f, { contentType: f.type || 'image/jpeg', upsert: true });
      if (up.error) { chip('Upload failed.'); return; }
      var pub = sb.storage.from('group-images').getPublicUrl(path);
      var url = pub.data.publicUrl + '?t=' + Date.now();
      var r = await sb.from('groups').update({ image_url: url }).eq('id', g.id);
      if (r.error) { chip('Could not save the image.'); return; }
      chip('Group image updated.');
      renderGroup(gid);
    });
    imgRow.appendChild(pick);
    imgRow.appendChild(fileIn);
    ic2.appendChild(imgRow);
    body.appendChild(ic2);

    var cc = el('div', 'card');
    cc.appendChild(el('h2', null, 'Invite code'));
    var code = el('div', 'invcode', g.invite_code);
    code.addEventListener('click', async function () {
      try { await navigator.clipboard.writeText(g.invite_code); chip('Invite code copied'); }
      catch (e) {}
    });
    cc.appendChild(code);
    cc.appendChild(el('div', 'hint',
      'Click to copy. Anyone with this code can join from the Social page.'));
    body.appendChild(cc);

    var sc = el('div', 'card');
    sc.appendChild(el('h2', null, 'This group in your main feed'));
    sc.appendChild(el('div', 'hint',
      'Silencing removes these members from your main feed unless they are your friends '
      + "or share another group with you. The group's own Feed tab stays."));
    var isMuted = mutedGroups().indexOf(g.id) >= 0;
    var mb = el('button', 'btn ghost', isMuted ? 'Allow in main feed' : 'Silence in main feed');
    mb.type = 'button';
    mb.addEventListener('click', function () {
      var ids = mutedGroups();
      setMutedGroups(isMuted
        ? ids.filter(function (i) { return i !== g.id; })
        : ids.concat([g.id]));
      chip(isMuted ? 'This group speaks in your main feed again.' : 'Group silenced in your main feed.');
      renderGroup(gid);
    });
    sc.appendChild(mb);
    body.appendChild(sc);

    var lc = el('div', 'card');
    var lb = el('button', 'btn ghost', 'Leave group'); lb.type = 'button';
    lb.addEventListener('click', async function () {
      if (!confirm('Leave ' + g.name + '?')) return;
      await sb.from('group_members').delete()
        .eq('group_id', g.id).eq('user_id', session.user.id);
      location.hash = '#/people';
    });
    lc.appendChild(lb);
    body.appendChild(lc);
  }
}

/* ---------- public profile ---------- */

async function renderProfile(username) {
  var root = clear();
  var wrap = el('div', 'wrap');
  root.appendChild(wrap);
  username = decodeURIComponent(username).toLowerCase();

  if (!backendReady()) {
    if (username === 'paarth') { renderPaarthTemplate(); return; }
    wrap.appendChild(el('h1', null, 'Not available'));
    wrap.appendChild(el('div', 'hint', 'The shared backend is not configured yet.'));
    return;
  }
  var p = await sb.from('profiles').select('*').eq('username', username).maybeSingle();
  if (!p.data) {
    if (username === 'paarth') { renderPaarthTemplate(); return; }
    wrap.appendChild(el('div', 'eyebrow', 'The ledger of'));
    wrap.appendChild(el('h1', null, 'No such account'));
    wrap.appendChild(el('div', 'hint', 'Nobody has claimed "' + username + '" yet.'));
    return;
  }
  var prof = p.data;
  wrap.appendChild(el('div', 'eyebrow', 'The ledger of'));
  wrap.appendChild(el('h1', null, prof.display_name || prof.username));

  if (signedIn() && prof.id !== session.user.id) {
    var a = session.user.id < prof.id ? session.user.id : prof.id;
    var b = session.user.id < prof.id ? prof.id : session.user.id;
    var fr = await sb.from('friendships').select('*').eq('user_a', a).eq('user_b', b).maybeSingle();
    var brw = el('div', 'btnrow');
    if (!fr.data) {
      var addB = el('button', 'btn ghost', 'Add friend'); addB.type = 'button';
      addB.addEventListener('click', async function () {
        await sb.from('friendships').insert({ user_a: a, user_b: b, requested_by: session.user.id, status: 'pending' });
        addB.textContent = 'Requested'; addB.disabled = true;
      });
      brw.appendChild(addB);
    } else {
      brw.appendChild(el('span', 'count', fr.data.status === 'accepted' ? 'Friends' : 'Request pending'));
    }
    wrap.appendChild(brw);
  }

  var plans = await sb.from('plans').select('*').eq('owner', prof.id)
    .order('created_at', { ascending: false });
  var rows = plans.data || [];
  if (!rows.length) {
    wrap.appendChild(el('div', 'card')).appendChild(el('div', 'hint',
      'Nothing visible here. Their plans are private, or friends-only and you are not friends yet.'));
    return;
  }
  for (var i = 0; i < rows.length; i++) {
    var planRow = rows[i];
    var days = {}, weeks = {};
    var both = await Promise.all([
      sb.from('plan_days').select('*').eq('plan_id', planRow.id),
      sb.from('plan_weeks').select('*').eq('plan_id', planRow.id)
    ]);
    (both[0].data || []).forEach(function (r) { days[r.day] = r.checks; });
    (both[1].data || []).forEach(function (r) { weeks[r.week] = r.checks; });
    var pobj = planRowToObj(planRow);
    var head = el('h1', null, pobj.name);
    head.style.fontSize = '30px'; head.style.marginTop = '18px';
    head.appendChild(el('span', 'vtag', pobj.visibility));
    wrap.appendChild(head);
    if (pobj.intent) wrap.appendChild(el('div', 'sub', pobj.intent));
    (function (daysM, weeksM, pO) {
      renderLedger(wrap, {
        plan: pO, readOnly: true,
        getDay: function (d) { return daysM[d]; },
        getWeek: function (w) { return weeksM[w]; },
        toggleDay: function () {}, toggleWeek: function () {},
        rerender: function () {}
      });
    })(days, weeks, pobj);
  }
}

/* ---------- the original (template) ---------- */

function renderPaarthTemplate() {
  var root = clear();
  var wrap = el('div', 'wrap');
  wrap.appendChild(el('div', 'eyebrow', 'The original - Aug 25 to Sep 23, 2026'));
  wrap.appendChild(el('h1', null, PAARTH_PLAN.name));
  wrap.appendChild(el('div', 'sub', PAARTH_PLAN.intent));

  var card = el('div', 'card'); card.style.marginTop = '24px';
  card.appendChild(el('h2', null, 'Daily non-negotiables'));
  PAARTH_PLAN.habits.forEach(function (h) {
    var b = el('div', 'habit static');
    b.appendChild(el('span', 'box'));
    b.appendChild(el('span', 'lbl', h));
    card.appendChild(b);
  });
  wrap.appendChild(card);

  var card2 = el('div', 'card');
  card2.appendChild(el('h2', null, 'Weekly targets'));
  var tg = el('div', 'targets');
  PAARTH_PLAN.targets.forEach(function (t) {
    var box = el('div', 'tgt');
    box.appendChild(el('span', 'tl', t[0] + ' x' + t[1]));
    tg.appendChild(box);
  });
  card2.appendChild(tg);
  var wm = el('div', 'wmeta'); wm.style.marginTop = '12px'; wm.style.marginBottom = '0';
  wm.appendChild(document.createTextNode('Four escalating weeks: '));
  wm.appendChild(el('em', null, 'presence, initiation, command, composure'));
  wm.appendChild(document.createTextNode(' - read alongside: Marcus Aurelius, Seneca, Machiavelli, Dostoevsky.'));
  card2.appendChild(wm);
  wrap.appendChild(card2);

  var br = el('div', 'btnrow');
  var use = el('button', 'btn', 'Use this plan'); use.type = 'button';
  use.addEventListener('click', async function () {
    var planObj = JSON.parse(JSON.stringify(PAARTH_PLAN));
    planObj.visibility = 'friends';
    if (!(myProfile && myProfile.username === 'paarth')) planObj.startISO = isoToday();
    if (signedIn()) {
      if (SP && SP.plan && !confirm('You already have a plan. Create this one as your new active plan?')) return;
      planObj.visibility = (myProfile && myProfile.username === 'paarth') ? 'public' : 'friends';
      var ok = await createRemotePlan(planObj);
      if (!ok) return;
    } else {
      if (lsGet(PLAN_KEY) && !confirm('Replace the plan already in this browser?')) return;
      lsSet(PLAN_KEY, planObj);
      lsSet(STATE_KEY, { days: {}, weeks: {} });
    }
    trackerSel = null;
    location.hash = '#/track';
  });
  var own = el('a', 'btn ghost', 'Build your own'); own.href = '#/new';
  br.appendChild(use); br.appendChild(own);
  wrap.appendChild(br);

  var foot = el('div', 'foot');
  foot.textContent = 'Adopting starts your own thirty days from today with these exact non-negotiables. Building your own takes about two minutes.';
  wrap.appendChild(foot);
  root.appendChild(wrap);
}

/* ---------- settings ---------- */

function renderSettings() {
  var root = clear();
  var wrap = el('div', 'wrap');
  wrap.appendChild(el('div', 'eyebrow', 'Account'));
  wrap.appendChild(el('h1', null, myProfile && myProfile.username ? '@' + myProfile.username : 'Unnamed'));
  root.appendChild(wrap);
  if (!signedIn()) {
    var c0 = el('div', 'card');
    c0.appendChild(el('div', 'hint', 'Sign in first.'));
    wrap.appendChild(c0); return;
  }

  var idc = el('div', 'card');
  idc.appendChild(el('h2', null, 'Identity'));
  idc.appendChild(el('div', 'hint',
    'Your username is your public address: it is how friends find you, and your ledger lives at #/u/<username>. Lowercase letters, digits, underscores.'));
  var ar = el('div', 'addrow');
  var un = el('input'); un.type = 'text'; un.placeholder = 'username';
  un.value = (myProfile && myProfile.username) || '';
  un.setAttribute('autocapitalize', 'none');
  var dn = el('input'); dn.type = 'text'; dn.placeholder = 'Display name';
  dn.value = (myProfile && myProfile.display_name) || '';
  var sv = el('button', 'btn', 'Save'); sv.type = 'button';
  ar.appendChild(un); ar.appendChild(dn); ar.appendChild(sv);
  idc.appendChild(ar);
  var imsg = el('div', 'ok', '');
  idc.appendChild(imsg);
  sv.addEventListener('click', async function () {
    var u = un.value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(u)) { imsg.textContent = '3-20 chars: a-z, 0-9, underscore.'; return; }
    var dnv = dn.value.trim();
    if (!dnv) { imsg.textContent = 'A display name is required. It is what friends see.'; return; }
    var r = await sb.from('profiles').update({ username: u, display_name: dnv })
      .eq('id', session.user.id);
    if (r.error) imsg.textContent = r.error.code === '23505' ? 'That username is taken.' : ('Failed: ' + r.error.message);
    else { imsg.textContent = 'Saved.'; await loadMyProfile(); renderNav(); }
  });
  wrap.appendChild(idc);

  if (SP && SP.plan) {
    var pc = el('div', 'card');
    pc.appendChild(el('h2', null, 'Plan visibility'));
    pc.appendChild(el('div', 'hint', '"' + SP.plan.name + '" is currently ' + SP.plan.visibility + '.'));
    var sel = el('select');
    ['private', 'friends', 'public'].forEach(function (v) {
      var o = el('option', null, v); o.value = v;
      if (v === SP.plan.visibility) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', async function () {
      var r = await sb.from('plans').update({ visibility: sel.value }).eq('id', SP.plan.id);
      if (!r.error) { SP.plan.visibility = sel.value; chip('Visibility: ' + sel.value); }
    });
    pc.appendChild(sel);
    var del = el('button', 'btn ghost', 'Delete this plan'); del.type = 'button';
    del.style.marginTop = '12px';
    del.addEventListener('click', async function () {
      if (!confirm('Delete "' + SP.plan.name + '" and all of its thirty days? This cannot be undone.')) return;
      await sb.from('plans').delete().eq('id', SP.plan.id);
      SP = null; chip('Deleted'); route();
    });
    pc.appendChild(el('div')).appendChild(del);
    wrap.appendChild(pc);
  }

  var pwc = el('div', 'card');
  pwc.appendChild(el('h2', null, 'Password'));
  pwc.appendChild(el('div', 'hint',
    'Set or change the password you use to sign in here and in the mobile app. Accounts created before password sign-in need to set one once.'));
  var pwIn = el('input'); pwIn.type = 'password'; pwIn.placeholder = 'New password (8+ characters)';
  pwIn.setAttribute('autocomplete', 'new-password');
  pwc.appendChild(pwIn);
  var pwB = el('button', 'btn ghost', 'Save password'); pwB.type = 'button'; pwB.style.marginTop = '10px';
  pwc.appendChild(pwB);
  var pwMsg = el('div', 'ok', ''); pwMsg.style.marginTop = '8px';
  pwc.appendChild(pwMsg);
  pwB.addEventListener('click', async function () {
    if (pwIn.value.length < 8) { pwMsg.textContent = 'Password needs 8+ characters.'; return; }
    var r = await sb.auth.updateUser({ password: pwIn.value });
    pwMsg.textContent = r.error ? ('Failed: ' + r.error.message) : 'Password saved. It works on the site and the mobile app.';
    if (!r.error) pwIn.value = '';
  });
  wrap.appendChild(pwc);

  var api = el('div', 'card');
  api.appendChild(el('h2', null, 'API access'));
  api.appendChild(el('div', 'hint',
    'Give this token to your own tools (or your Claude) to read and write your ledger through the REST API. It is your signed session token: treat it like a password. See API.md in the repo for endpoints.'));
  var show = el('button', 'btn ghost', 'Reveal token'); show.type = 'button';
  api.appendChild(show);
  var ta = el('textarea'); ta.style.display = 'none'; ta.style.marginTop = '10px'; ta.readOnly = true;
  api.appendChild(ta);
  show.addEventListener('click', async function () {
    var s = await sb.auth.getSession();
    ta.value = (s.data.session && s.data.session.access_token) || 'no session';
    ta.style.display = 'block'; ta.focus(); ta.select();
  });
  wrap.appendChild(api);

  var outc = el('div', 'card');
  var out = el('button', 'btn ghost', 'Sign out'); out.type = 'button';
  out.addEventListener('click', async function () {
    await sb.auth.signOut();
    location.hash = '#/';
  });
  outc.appendChild(out);
  wrap.appendChild(outc);
}

function renderJoin(code) {
  var root = clear();
  var wrap = el('div', 'wrap');
  wrap.appendChild(el('div', 'eyebrow', 'Group invitation'));
  wrap.appendChild(el('h1', null, 'Join a group'));
  var card = el('div', 'card');
  wrap.appendChild(card);
  root.appendChild(wrap);
  code = decodeURIComponent(code).trim().toLowerCase();
  if (!signedIn()) {
    card.appendChild(el('div', 'hint',
      'Sign in (or create an account), then open this invite link again to join with code ' + code + '.'));
    var b = el('a', 'btn', 'Sign in'); b.href = '#/auth';
    card.appendChild(b);
    return;
  }
  card.appendChild(el('div', 'hint', 'Joining with code ' + code + '...'));
  sb.rpc('join_group', { code: code }).then(function (r) {
    card.textContent = '';
    if (r.error) {
      card.appendChild(el('div', 'err', 'Could not join: ' + r.error.message));
    } else {
      card.appendChild(el('div', 'hint', 'You are in. The group sees your friends-tier ledger, and you see theirs.'));
      var b2 = el('a', 'btn', 'Open the group');
      b2.href = r.data ? '#/g/' + r.data : '#/people';
      card.appendChild(b2);
    }
  });
}

/* ================= router ================= */

function renderClaim() {
  var root = clear();
  var wrap = el('div', 'wrap');
  wrap.appendChild(el('div', 'eyebrow', 'One thing first'));
  wrap.appendChild(el('h1', null, 'Claim your name'));
  var card = el('div', 'card');
  card.appendChild(el('div', 'hint',
    'Your username is your public address: it is how friends find you and where '
    + 'your ledger lives. Your display name is what people read in the feed. '
    + 'Nothing else opens until both are set.'));
  var un = el('input'); un.type = 'text'; un.placeholder = 'username (a-z, 0-9, underscore)';
  un.setAttribute('autocapitalize', 'none');
  un.setAttribute('autocomplete', 'username');
  un.maxLength = 20;
  card.appendChild(un);
  var dn = el('input'); dn.type = 'text'; dn.placeholder = 'Display name';
  dn.setAttribute('autocomplete', 'name');
  dn.maxLength = 40; dn.style.marginTop = '8px';
  dn.value = (myProfile && myProfile.display_name) || '';
  card.appendChild(dn);
  var save = el('button', 'btn', 'Claim it'); save.type = 'button';
  save.style.marginTop = '10px';
  card.appendChild(save);
  var msg = el('div', 'ok', ''); msg.style.marginTop = '10px';
  card.appendChild(msg);
  save.addEventListener('click', async function () {
    var u = un.value.trim().toLowerCase();
    var d = dn.value.trim();
    if (!/^[a-z0-9_]{3,20}$/.test(u)) {
      msg.textContent = 'Username: 3-20 characters, a-z, 0-9, underscore.'; return;
    }
    if (!d) { msg.textContent = 'Pick a display name. It is what friends see.'; return; }
    save.disabled = true;
    msg.textContent = 'Claiming...';
    var r = await sb.from('profiles').update({ username: u, display_name: d })
      .eq('id', session.user.id);
    save.disabled = false;
    if (r.error) {
      msg.textContent = r.error.code === '23505'
        ? '"' + u + '" is taken. Pick another.'
        : 'Failed: ' + r.error.message;
      return;
    }
    await loadMyProfile();
    chip('Welcome, @' + u);
    location.hash = '#/track';
    route();
  });
  wrap.appendChild(card);
  var out = el('div', 'card');
  var so = el('button', 'btn ghost', 'Sign out'); so.type = 'button';
  so.addEventListener('click', async function () { await sb.auth.signOut(); location.hash = '#/'; });
  out.appendChild(so);
  wrap.appendChild(out);
  root.appendChild(wrap);
}

function route() {
  var h = location.hash || '#/';
  dropLiveChannel();
  renderNav();
  /* Password recovery has to get through; everything else waits for a name. */
  if (h === '#/recover') { renderRecover(); return; }
  if (needsClaim()) { renderClaim(); return; }
  if (h.indexOf('#/u/') === 0) { renderProfile(h.slice(4)); return; }
  if (h.indexOf('#/join/') === 0) { renderJoin(h.slice(7)); return; }
  if (h.indexOf('#/g/') === 0) { renderGroup(h.slice(4)); return; }
  if (h === '#/friends') { renderFriends(); return; }
  if (h === '#/new') { renderWizard(); return; }
  if (h === '#/track') { renderTracker(); return; }
  if (h === '#/days') { renderDays(); return; }
  if (h === '#/feed') { renderFeed(); return; }
  if (h === '#/people') { groupSection = 'feed'; renderPeople(); return; }
  if (h === '#/settings') { renderSettings(); return; }
  if (h === '#/auth') { renderAuth(); return; }
  if (h === '#/paarth') { renderPaarthTemplate(); return; }
  renderLanding();
}

if ('serviceWorker' in navigator) {
  addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}

async function boot() {
  if (sb) {
    var s = await sb.auth.getSession();
    session = s.data.session;
    sb.auth.onAuthStateChange(function (event, newSession) {
      var was = !!session;
      session = newSession;
      if (event === 'PASSWORD_RECOVERY') { location.hash = '#/recover'; return; }
      if (!!session !== was) {
        loadMyProfile().then(loadMyPlan).then(function () {
          startRealtime(); route();
        });
      }
    });
    if (session) {
      await loadMyProfile();
      await loadMyPlan();
      startRealtime();
    }
  }
  addEventListener('hashchange', route);
  route();
}
boot();
