# Metanoia

A 30-day reset tracker. Metanoia: a transformative change of heart and mind; the moment you turn your life around.

Live at https://paarth-r.github.io/metanoia/

## What it does

- Guided walkthrough: name your reset, pick a start date, choose 3-7 daily non-negotiables (suggestions plus custom), and optional weekly targets with per-week counts.
- 30-day ledger: a daily scorecard of big tappable checkboxes, weekly target pips, streak / perfect-day / average stats, and a 30-cell grid where perfect days fill solid and zero days past show red.
- A rotating daily quote from Marcus Aurelius, Seneca, and Epictetus.
- Load account: type an account name on the landing page to open a built-in plan. The original ("paarth", Aug 25 - Sep 23, 2026) ships with the site; adopt it with one click or build your own.

## How data works

Visitors' plans and ticks live in their browser's localStorage; nothing is uploaded and there are no accounts. Export produces a JSON blob you can paste into Import on another device. "Start over" erases the plan and all ticks from the browser.

## Working in public

The built-in account publishes its progress. The backend is GitHub itself: ticks are written to `data/paarth.json` in this repo through the GitHub Contents API (each tick lands as a commit), and the public account page reads that file and renders a live, read-only ledger with streaks, today's open items, and the 30-day grid. Anyone can watch; only the holder of a fine-grained GitHub token (repo-scoped, Contents read/write, pasted once on the tracker page and kept in localStorage) can write. No servers, no cost.

## Rules of the house

1. Never miss twice.
2. Done before dopamine.
3. The scorecard is the verdict on the day, not your feelings.

## Stack

One static `index.html`: vanilla JS, no build step, no dependencies beyond Google Fonts (Cormorant Garamond and IBM Plex Mono). Light and dark themes follow the system, hash-based routing (`#/`, `#/new`, `#/track`, `#/paarth`). Hosted on GitHub Pages.
