// Metanoia mobile: shared constants, helpers, and the Supabase client.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://peoqnpellvuhsltfmvnb.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Olh2Tp5978qDrGQXoOA2Gw_PtpvHR1t';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const TOTAL = 30;

export const QUOTES = [
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
  ['As long as you live, keep learning how to live.', 'Seneca'],
];

export const HABIT_SUGGESTIONS = [
  'No phone, first 30 min', '90-min deep work block', 'Train (lift, run, or sport)',
  '20 min reading', '1 deliberate social rep', 'Zero short-form feeds',
  'Evening review (3 lines)', 'Wake before 7', '10 min meditation',
  'In bed by 11', 'No sugar', '10k steps',
];

export const TARGET_SUGGESTIONS = [
  ['Lift', 3], ['Cardio', 2], ['Deep project session', 2],
  ['Reach out to someone', 1], ['Weekly review', 1], ['Practice a skill', 2],
];

export const PAARTH_PLAN = {
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
    { social: 'Composure under stakes', reading: 'Notes from Underground' }],
};

export function parseISO(iso) {
  const p = String(iso || '').split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
export function isoToday() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}
export function dayNumOf(startISO) {
  const n = new Date();
  const t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.round((t0 - parseISO(startISO)) / 864e5) + 1;
}
export function dateOfDay(startISO, d) {
  const x = parseISO(startISO);
  x.setDate(x.getDate() + (d - 1));
  return x;
}
export function fmtDay(startISO, d) {
  const D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const x = dateOfDay(startISO, d);
  return `${D[x.getDay()]} ${M[x.getMonth()]} ${x.getDate()}`;
}
export function weekOf(d) { return Math.min(4, Math.ceil(d / 7)); }
export function scoreOf(arr, nH) {
  if (!arr) return 0;
  let c = 0;
  for (let i = 0; i < arr.length && i < nH; i++) if (arr[i]) c++;
  return c;
}
export function ago(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export function planRowToObj(row) {
  return {
    name: row.name, intent: row.intent, startISO: row.start_date,
    habits: row.habits, targets: row.targets || [], weekMeta: row.week_meta,
    visibility: row.visibility,
  };
}
export function ledgerStats(plan, getDay) {
  const nH = plan.habits.length;
  const tn = dayNumOf(plan.startISO);
  const upto = Math.min(Math.max(tn, 0), TOTAL);
  let sum = 0, perfect = 0;
  for (let d = 1; d <= upto; d++) {
    const s = scoreOf(getDay(d), nH);
    sum += s;
    if (s === nH) perfect++;
  }
  let streak = 0;
  let sd = upto;
  if (upto >= 1 && scoreOf(getDay(upto), nH) < nH) sd = upto - 1;
  for (let d = sd; d >= 1; d--) {
    if (scoreOf(getDay(d), nH) === nH) streak++;
    else break;
  }
  return { tn, upto, sum, perfect, streak, nH };
}
