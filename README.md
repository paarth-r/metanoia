# Metanoia

Thirty-day resets you run in public. Metanoia: a transformative change of
heart and mind; the moment you turn your life around.

Live at https://paarth-r.github.io/metanoia/

## What it is

- A guided walkthrough builds anyone a 30-day plan: name it, pick a start
  date, choose 3-7 daily non-negotiables, optional weekly targets, and decide
  who watches (private / friends and groups / public).
- The ledger: a daily scorecard of big tappable checkboxes, weekly target
  pips, streak / perfect-day / average stats, and a 30-cell grid where perfect
  days fill solid and zero days past show red. Rotating quotes from Marcus
  Aurelius, Seneca, and Epictetus.
- Social accountability: friends (request/accept), groups (create, join by
  invite code) where members see each other's friends-tier ledgers, public
  profile pages at `#/u/<username>`, and a notification-style feed of everyone
  you follow ticking their days, going perfect, and starting resets - live via
  Supabase realtime.
- Every group is a page (`#/g/<id>` on the web, a screen in the app) with four
  sections: a feed filtered to members, a realtime private chat, a member list
  that links to each ledger and can pull in a friend directly, and settings for
  the group image, invite code, and silencing.
- The feed carries reactions (respect / locked in / soft), filter pills for All,
  Friends, and each group, and per-group silencing that hides those members
  unless they reach you another way.
- The ledger can grow but never shrink: commit a new daily non-negotiable (up to
  seven) or weekly target (up to eight) mid-reset, behind a two-step confirm
  that says plainly you will see it for the next thirty days and cannot remove
  it. Days you already ticked keep their scores.
- Privacy tiers per plan: private (owner only), friends (friends + group-mates),
  public (anyone, signed in or not). Enforced by Postgres row-level security,
  not client code.
- Identity is claimed at signup: the account form takes a username and display
  name and passes them as auth metadata, and the `handle_new_user()` trigger
  writes them into the profile as the account is created. Accounts that predate
  this (or whose name was taken mid-signup) hit a claim screen that blocks the
  app until they pick one, so nobody ever shows up as "unnamed".
- Days: a real calendar, month by month, outside the thirty-day box. Open any
  date to see that day's non-negotiables (when it falls inside a reset) over its
  todos. A todo is a one-off on its date or a daily repeat that refreshes each
  morning; either way you can go back and tick a day late, and yesterday keeps
  its own record. Todos are private - never shared, never in the feed, and never
  counted in your streak, so an errand cannot dilute the verdict.
- Guest mode: with no account the whole tracker still works, stored in
  localStorage; signing in later imports it.
- The original plan (the "paarth" account) ships built in and can be adopted
  by anyone with one click.

## Stack

- Frontend: one static page (index.html + style.css + app.js), vanilla JS, no
  build step, hosted on GitHub Pages. `todos-core.js` holds the pure date and
  recurrence logic; because there is no bundler and Metro cannot reach outside
  `mobile/`, `mobile/todos-core.js` carries a byte-identical copy of its shared
  region and `npm test` fails if the two drift. Fonts: Cormorant Garamond + IBM Plex Mono.
- Backend: Supabase free tier - email + password auth with no email
  confirmation step (you sign up and you are in; password reset still goes by
  email, which is rare enough for the built-in mailer), Postgres with
  row-level security (schema in `supabase/schema.sql`), PostgREST API,
  realtime feed. `config.js` holds the project URL and public anon key.

## Tests

`npm test` (Node's built-in runner, no dependencies) covers the todo recurrence
and calendar date logic in `todos-core.js` - end-date boundaries, ticking a past
day late, daylight saving, leap years, and the drift guard between the two
copies. The UI has no tests; it is verified by driving it in a browser.

## API

See `API.md`. Every table is a REST endpoint; users can hand their session
token to their own tools or Claude to manage goals programmatically.

## Setup (new deployment)

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor, then every
   `supabase/migration-*.sql` in date order.
3. Auth -> URL Configuration: set the site URL to your Pages URL.
4. Fill `config.js` with the project URL and anon key.

## Rules of the house

1. Never miss twice.
2. Done before dopamine.
3. The scorecard is the verdict on the day, not your feelings.

## Mobile

Two tiers, same backend:

- **PWA**: the site installs from the browser (iPhone: Safari -> Share -> Add
  to Home Screen; Android: Chrome offers Install). Manifest, icons, and a
  network-first service worker; API traffic is never cached.
- **Native app**: `mobile/` is a React Native app on Expo SDK 57. The site and
  the app are at feature parity - anything you can do on one you can do on the
  other. Same design system (Cormorant Garamond + IBM Plex Mono, bone/ink,
  automatic dark mode), same features: email-code sign-in (no passwords, no deep links), the
  editable ledger, the five-step wizard, the realtime feed with unread badge,
  friends, groups, public profiles, and account settings including the API
  token. Run it with `cd mobile && npx expo start` and scan the QR with Expo
  Go; ship it with EAS Build when App Store distribution is wanted.

## Roadmap

- Push notifications for feed events (Supabase edge function + VAPID for web
  push; expo-notifications for the native app).
- EAS build profiles + App Store release.
