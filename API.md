# Metanoia API

The backend is Supabase, so the API is PostgREST: every table is a REST
endpoint, and row-level security decides what a caller can see and touch.
This is the surface for scripts, agents, and Claude sessions that create
goals or read ledgers on a user's behalf.

## Base URL and keys

- Base: `https://<project-ref>.supabase.co/rest/v1`
- Every request needs the project's public anon key in `apikey`.
- Requests are made AS A USER by adding their JWT: `Authorization: Bearer <token>`.
  A user copies their token from Account -> API access on the site.
- Without a JWT you are anonymous: you can read public plans and profiles, nothing else.

Common headers:

```
apikey: <anon-key>
Authorization: Bearer <user-jwt>
Content-Type: application/json
Prefer: return=representation
```

## Objects

- `profiles` - id, username, display_name
- `plans` - id, owner, name, intent, start_date, habits (json array of labels),
  targets (json array of [label, per-week-count]), week_meta, visibility
  (`private` | `friends` | `public`)
- `plan_days` - plan_id, day (1-30), checks (json array of booleans, one per habit)
- `plan_weeks` - plan_id, week (1-4), checks (json object: target index -> array of booleans)
- `feed_events` - user_id, plan_id, kind (`started` | `tick` | `perfect` | `streak` | `finished`),
  day, payload
- `friendships`, `groups`, `group_members` - social graph; groups join via RPC
- `group_messages` - group_id, user_id, body; `feed_reactions` - event_id,
  user_id, kind (`respect` | `locked_in` | `soft`)
- `todos` - owner, body, repeats, and then either `on_date` (a one-off) or
  `starts_on` plus optional `ends_on` (a daily repeat). Owner-only, never shared.
- `todo_ticks` - todo_id, on_date. One row per day a todo was completed, which
  is what makes a repeat refresh daily. Absence of a row means not done.

Todo recipes (dates are plain `YYYY-MM-DD`, always in the user's local time -
do not derive them from a UTC timestamp):

```
POST /rest/v1/todos
{"owner": "<their-user-id>", "body": "Vitamins", "repeats": true,
 "starts_on": "2026-08-29"}

POST /rest/v1/todo_ticks
Prefer: resolution=merge-duplicates
{"todo_id": "<todo-id>", "on_date": "2026-08-29"}

DELETE /rest/v1/todo_ticks?todo_id=eq.<todo-id>&on_date=eq.2026-08-29
```

To stop a repeating todo without destroying its history, set `ends_on` to the
later of yesterday and its last tick, rather than deleting the row.

## Recipes

Read a public ledger (no auth needed beyond the anon key):

```
GET /rest/v1/profiles?username=eq.paarth&select=id,username
GET /rest/v1/plans?owner=eq.<profile-id>&select=*
GET /rest/v1/plan_days?plan_id=eq.<plan-id>&select=day,checks&order=day
```

Create a plan for the authenticated user:

```
POST /rest/v1/plans
{"owner": "<their-user-id>", "name": "My Reset", "intent": "why",
 "start_date": "2026-09-01", "habits": ["Train", "Read 20 min", "No feeds"],
 "targets": [["Lift", 3]], "visibility": "friends"}
```

Tick a day (upsert; checks must match the habit count):

```
POST /rest/v1/plan_days
Prefer: resolution=merge-duplicates
{"plan_id": "<plan-id>", "day": 4, "checks": [true, true, false]}
```

Emit the matching feed event so friends see it (skip for private plans):

```
POST /rest/v1/feed_events
{"user_id": "<their-user-id>", "plan_id": "<plan-id>", "kind": "tick",
 "day": 4, "payload": {"score": 2, "total": 3, "plan_name": "My Reset"}}
```

Read the feed the user is allowed to see:

```
GET /rest/v1/feed_events?select=*,profiles(username),plans(name)&order=created_at.desc&limit=50
```

RPCs:

```
POST /rest/v1/rpc/create_group  {"gname": "The Lab"}
POST /rest/v1/rpc/join_group    {"code": "ab12cd34"}
```

## For Claude sessions

The intended flow for "have Claude manage my goals": the user signs in on the
site, copies their token from Account -> API access, and hands it to their
Claude with this file. Everything above works with plain fetch/curl; RLS keeps
the blast radius to exactly what that user could do themselves in the UI.
Tokens expire on the project's JWT schedule, so long-running automations should
ask the user for a fresh one when calls start returning 401.

Admin access (bypasses RLS, owner only): the project's service_role key in
place of the anon key and JWT. Never ship it to a browser, never commit it.
