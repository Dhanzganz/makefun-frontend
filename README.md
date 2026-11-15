[![Bounty](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01)
[![Rank](https://make.fun/badge/makefun-frontend-01/Dhanzganz/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01)
[![Reward](https://make.fun/badge/makefun-frontend-01/Dhanzganz/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01)

# DhanzAI Frontend — a fast, light make.fun frontend

An entry for the make.fun bounty **[Build the best make.fun frontend](https://make.fun/bounty/makefun-frontend-01)**.

A complete make.fun client as plain static files — no build step, no
framework, no font files — reading make.fun's public API live. Open
`app/index.html` through any static server and it works.

## The four surfaces

Each surface has its own address and is reachable by links from the others:

| Address | Surface |
| --- | --- |
| `#/` | **The board** — every live bounty with its live pot, entry fee, ticking time left and entry count; search, category filter and sorting, all in place |
| `#/bounty/<slug>` | **A bounty's page** — summary, the full rewards table at live amounts (prize + entry-fee share per place), dates, description, rules and latest entries |
| `#/bounty/<slug>/leaderboard` | **Its leaderboard** — the bounty's own score columns, every ranked entry paged 50 at a time, filterable, each builder linking to a profile |
| `#/u/<handle>` | **A public profile** — links, wallet, the account's record (entered / placed / won / prizes paid) and every entry it has made |

A bounty counts as taking entries by its **deadline**, never by its status
field alone — the API leaves past-deadline bounties reading "open".

## Why it is fast

- **Tiny first load.** The board ships six small files (HTML, one CSS, four
  ES modules — 34 KB raw, 11.8 KB gzipped). The leaderboard and profile code
  loads later, only when a route needs it, via `import()`.
- **Few requests per view.** The board is one API call; the top-earners strip
  arrives on a second, non-blocking call. A bounty page is one call.
- **Answers are reused, not refetched.** `app/api.js` keeps an in-memory
  cache: a view revisited within 30 seconds makes no request at all, and past
  that the stored ETag goes back as `If-None-Match` — the API's tags turn on
  the minute, so revalidation usually answers 304 with no body. Concurrent
  requests for the same URL share one fetch.
- **Nothing rebuilds.** Countdowns tick by rewriting the text of the elements
  that carry a deadline, once a second. Leaderboards render in slices of 50
  rows with a "Show more" button instead of building thousands of rows.

## Run it

Requires Node.js 22 or later.

```sh
node serve.ts            # serves app/ on http://localhost:8080
node serve.ts --port 9000
```

Hand the entry in the way the scorer does:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes
`dossier.json` with the kit's vendored library (`vendor/makefun-frontend.ts`,
kept byte-for-byte identical to the kit's copy, as the scorer rebuilds the
dossier with its own).

## Layout

- `app/` — the frontend itself: `index.html`, `style.css`, `main.js` (the
  router), `api.js` (the caching API client), `format.js` (formatting and a
  small safe Markdown renderer), `views.js` (board + bounty page),
  `views-rank.js` (leaderboard + profile, loaded on demand), `favicon.svg`.
- `screenshots/` — three screenshots of the running app on live data, listed
  in `shots.json`; the first is the cover.
- `main.ts`, `serve.ts` — the hand-in program and the local static server.
- `vendor/` — the kit's dossier library, unchanged.

## License

MIT — see `LICENSE`.
