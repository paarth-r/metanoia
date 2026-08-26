# Metanoia

A 30-day reset tracker. Metanoia: a transformative change of heart and mind; the moment you turn your life around.

Live at https://paarth-r.github.io/metanoia/

## What it does

- Guided walkthrough: name your reset, pick a start date, choose 3-7 daily non-negotiables (suggestions plus custom), and optional weekly targets with per-week counts.
- 30-day ledger: a daily scorecard of big tappable checkboxes, weekly target pips, streak / perfect-day / average stats, and a 30-cell grid where perfect days fill solid and zero days past show red.
- A rotating daily quote from Marcus Aurelius, Seneca, and Epictetus.
- Load account: type an account name on the landing page to open a built-in plan. The original ("paarth", Aug 25 - Sep 23, 2026) ships with the site; adopt it with one click or build your own.

## How data works

There is no backend. Your plan and every tick live in your browser's localStorage; nothing is uploaded and there are no accounts. Export produces a JSON blob you can paste into Import on another device. "Start over" erases the plan and all ticks from the browser.

## Rules of the house

1. Never miss twice.
2. Done before dopamine.
3. The scorecard is the verdict on the day, not your feelings.

## Stack

One static `index.html`: vanilla JS, no build step, no dependencies beyond Google Fonts (Cormorant Garamond and IBM Plex Mono). Light and dark themes follow the system, hash-based routing (`#/`, `#/new`, `#/track`, `#/paarth`). Hosted on GitHub Pages.
