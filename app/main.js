// The router: four surfaces, each by its own hash address —
//   #/                                the bounty board
//   #/bounty/<slug>                   one bounty's page
//   #/bounty/<slug>/leaderboard      that bounty's leaderboard
//   #/u/<handle>                      an account's public profile
//
// window.__shotReady is false while a route loads and true once its data is
// on screen, so a screenshot script knows when to capture. Countdowns are
// patched in place once a second by the ticker below; a route change never
// rebuilds more than its own view.

import { boardView, bountyView } from './views.js';
import { duration, until } from './format.js';

const app = document.getElementById('app');
let routeToken = 0;

async function render() {
  const token = ++routeToken;
  window.__shotReady = false;
  const hash = location.hash || '#/';
  const bounty = hash.match(/^#\/bounty\/([^/]+)(\/leaderboard)?\/?$/);
  const profile = hash.match(/^#\/u\/([^/]+)\/?$/);
  try {
    if (bounty && bounty[2]) {
      app.innerHTML = '<p class="loading">Loading the leaderboard…</p>';
      const { leaderboardView } = await import('./views-rank.js');
      if (token !== routeToken) return;
      await leaderboardView(app, decodeURIComponent(bounty[1]));
    } else if (bounty) {
      app.innerHTML = '<p class="loading">Loading the bounty…</p>';
      await bountyView(app, decodeURIComponent(bounty[1]));
    } else if (profile) {
      app.innerHTML = '<p class="loading">Loading the profile…</p>';
      const { profileView } = await import('./views-rank.js');
      if (token !== routeToken) return;
      await profileView(app, decodeURIComponent(profile[1]));
    } else {
      document.title = 'make.fun — live bounties';
      app.innerHTML = '<p class="loading">Loading the board…</p>';
      await boardView(app);
    }
  } catch (error) {
    if (token !== routeToken) return;
    app.innerHTML = `
      <section class="error">
        <h1>That page did not load</h1>
        <p>${String(error?.message ?? error)}</p>
        <p><a href="#/">Back to the board</a></p>
      </section>`;
  }
  if (token !== routeToken) return;
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

// One ticker for every countdown on the page: it rewrites only the text of
// the elements that carry a deadline, once a second.
setInterval(() => {
  for (const el of document.querySelectorAll('[data-countdown]')) {
    const ms = until(el.dataset.countdown);
    el.textContent = ms <= 0 ? 'ended' : duration(ms);
  }
}, 1000);

// The header's jump form opens a builder's profile by handle.
document.getElementById('jump').addEventListener('submit', (event) => {
  event.preventDefault();
  const handle = document.getElementById('jump-input').value.trim().replace(/^@/, '');
  if (handle) location.hash = `#/u/${encodeURIComponent(handle)}`;
});

window.addEventListener('hashchange', render);
render();
