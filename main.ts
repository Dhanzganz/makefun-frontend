// DhanzAI Frontend — a makefun-frontend-01 entry (Node 22, standard library only).
//
// The entry itself is the static frontend in app/: plain files a browser opens
// at app/index.html (ES modules and CSS, no build step) that read make.fun's
// public API at https://make.fun/api — the board of live bounties, a page for
// each bounty with its live rewards table, its leaderboard, and public
// profiles, all on hash routes.
//
// This program hands the frontend in: it copies app/ and screenshots/ from
// beside this file to /output and writes /output/dossier.json, the summary
// the judge reads (the screenshots, the first load's files and bytes, and the
// source), using the kit's vendored library. vendor/makefun-frontend.ts stays
// byte for byte the kit's copy: the scorer rebuilds the dossier with its own
// copy and compares the two.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the app locally with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own: at most 3 screenshots of 256 KiB each, at
// most 993 files and directories and 16 MiB in app/, and the dossier text
// capped at 160 KiB — an entry past any of them is one the scorer refuses.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 3, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 16777216,
  }),
);
