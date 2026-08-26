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
- Privacy tiers per plan: private (owner only), friends (friends + group-mates),
  public (anyone, signed in or not). Enforced by Postgres row-level security,
  not client code.
- Guest mode: with no account the whole tracker still works, stored in
  localStorage; signing in later imports it.
- The original plan (the "paarth" account) ships built in and can be adopted
  by anyone with one click.

## Stack

- Frontend: one static page (index.html + style.css + app.js), vanilla JS, no
  build step, hosted on GitHub Pages. Fonts: Cormorant Garamond + IBM Plex Mono.
- Backend: Supabase free tier - magic-link auth (no passwords), Postgres with
  row-level security (schema in `supabase/schema.sql`), PostgREST API,
  realtime feed. `config.js` holds the project URL and public anon key.

## API

See `API.md`. Every table is a REST endpoint; users can hand their session
token to their own tools or Claude to manage goals programmatically.

## Setup (new deployment)

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Auth -> URL Configuration: set the site URL to your Pages URL.
4. Fill `config.js` with the project URL and anon key.

## Rules of the house

1. Never miss twice.
2. Done before dopamine.
3. The scorecard is the verdict on the day, not your feelings.

## Roadmap

- Web push notifications for feed events (currently in-app feed + badge).
- Native mobile app wrapping the same API.
