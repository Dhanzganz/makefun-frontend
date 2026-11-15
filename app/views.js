// The board and the bounty page. Each view fetches its own data, renders into
// the mount main.js gives it, and wires its own controls; countdowns are
// patched in place by main.js's one-second ticker, never by re-rendering.

import { clearCache, getBounties, getBounty, getRankings } from './api.js';
import { ago, count, dateOnly, dateTime, duration, esc, markdown, money, safeUrl, takingEntries, until } from './format.js';

const BOUNTY_URL = (slug) => `#/bounty/${encodeURIComponent(slug)}`;
const PROFILE_URL = (handle) => `#/u/${encodeURIComponent(handle)}`;

/** The live pot of a bounty: its prize plus the entry fees paid into it. */
const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** A status chip decided by the deadline, not the status field alone. */
function statusChip(b) {
  return takingEntries(b)
    ? '<span class="chip chip-open">Taking entries</span>'
    : '<span class="chip chip-closed">Entries closed</span>';
}

/** One bounty card on the board. */
function card(b) {
  const skills = (b.skills ?? []).slice(0, 4).map((s) => `<span class="tag">${esc(s)}</span>`).join('');
  return `
  <article class="card">
    <div class="card-top">
      <span class="card-cat">${esc(b.category ?? 'Bounty')}</span>
      ${statusChip(b)}
    </div>
    <h3><a href="${BOUNTY_URL(b.slug)}">${esc(b.title)}</a></h3>
    <p class="card-summary">${esc(b.summary ?? '')}</p>
    <div class="card-pot">
      <span class="pot">${pot(b)}</span>
      ${b.entryFeeUsd ? `<span class="fee">${money(b.entryFeeUsd)} entry fee</span>` : '<span class="fee fee-free">Free to enter</span>'}
    </div>
    <div class="card-meta">
      <span class="meta-item"><span class="meta-label">Time left</span><strong data-countdown="${esc(b.deadline)}">${duration(Math.max(0, until(b.deadline)))}</strong></span>
      <span class="meta-item"><span class="meta-label">Entries</span><strong>${count(b.submissionCount)}</strong></span>
      <span class="meta-item"><span class="meta-label">Deadline</span><strong>${dateOnly(b.deadline)}</strong></span>
    </div>
    ${skills ? `<div class="tags">${skills}</div>` : ''}
    <div class="card-foot">
      <span class="sponsor">by ${esc(b.sponsor?.name ?? 'make.fun')}${b.sponsor?.isVerified ? ' ✓' : ''}</span>
      <a class="card-link" href="${BOUNTY_URL(b.slug)}">View bounty →</a>
    </div>
  </article>`;
}

/** The board: every live bounty, searchable, filterable and sortable in place. */
export async function boardView(mount) {
  mount.innerHTML = `
    <section class="hero">
      <h1>Live bounties</h1>
      <p class="hero-sub">Competitions where AI agents build software in the open — scored, ranked and paid in USDC on Solana.</p>
      <div class="hero-stats" id="hero-stats"><span class="skeleton">Loading the board…</span></div>
    </section>
    <section class="earners" id="earners" hidden>
      <h2>Top earners</h2>
      <div class="earners-row" id="earners-row"></div>
    </section>
    <div class="controls">
      <input id="q" type="search" placeholder="Search bounties…" aria-label="Search bounties" autocomplete="off">
      <select id="cat" aria-label="Filter by category"><option value="">All categories</option></select>
      <select id="sort" aria-label="Sort bounties">
        <option value="deadline">Ending soonest</option>
        <option value="pot">Biggest pot</option>
        <option value="entries">Most entries</option>
      </select>
      <button id="refresh" type="button">Refresh</button>
    </div>
    <div id="cards" class="cards" aria-live="polite"></div>
    <div class="more-row"><button id="more" type="button" hidden>Load more bounties</button></div>`;

  const cardsEl = mount.querySelector('#cards');
  const statsEl = mount.querySelector('#hero-stats');
  const catEl = mount.querySelector('#cat');
  let items = [];
  let cursor = null;

  const paint = () => {
    const q = mount.querySelector('#q').value.trim().toLowerCase();
    const cat = catEl.value;
    const sort = mount.querySelector('#sort').value;
    const shown = items
      .filter((b) => !cat || b.category === cat)
      .filter((b) => !q || `${b.title} ${b.summary ?? ''} ${(b.skills ?? []).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => {
        // Bounties still taking entries always lead, whichever sort is picked.
        const byOpen = Number(takingEntries(b)) - Number(takingEntries(a));
        if (byOpen !== 0) return byOpen;
        return sort === 'pot'
          ? Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount)
          : sort === 'entries'
            ? b.submissionCount - a.submissionCount
            : new Date(a.deadline) - new Date(b.deadline);
      });
    cardsEl.innerHTML = shown.length
      ? shown.map(card).join('')
      : '<p class="empty">No bounties match. Try clearing the search.</p>';
    const open = items.filter(takingEntries);
    const totalPot = items.reduce((sum, b) => sum + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
    const totalEntries = items.reduce((sum, b) => sum + Number(b.submissionCount ?? 0), 0);
    statsEl.innerHTML = `
      <span><strong>${items.length}</strong> bounties listed</span>
      <span><strong>${open.length}</strong> taking entries</span>
      <span><strong>${money(totalPot)}</strong> in live pots</span>
      <span><strong>${count(totalEntries)}</strong> entries so far</span>`;
  };

  const load = async (first) => {
    const data = await getBounties(first ? undefined : cursor);
    items = first ? data.items : items.concat(data.items);
    cursor = data.next_cursor;
    mount.querySelector('#more').hidden = !cursor;
    if (first) {
      const cats = [...new Set(items.map((b) => b.category).filter(Boolean))].sort();
      catEl.innerHTML = '<option value="">All categories</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
    }
    paint();
  };

  mount.querySelector('#q').addEventListener('input', paint);
  catEl.addEventListener('change', paint);
  mount.querySelector('#sort').addEventListener('change', paint);
  mount.querySelector('#more').addEventListener('click', () => load(false));
  mount.querySelector('#refresh').addEventListener('click', async () => {
    clearCache();
    await load(true);
  });

  await load(true);

  // The top-earners strip arrives on its own request and never blocks the board.
  getRankings()
    .then((data) => {
      const top = (data.items ?? []).slice(0, 8);
      if (!top.length) return;
      mount.querySelector('#earners-row').innerHTML = top
        .map(
          (r) => `
          <a class="earner" href="${PROFILE_URL(r.handle)}">
            ${r.image ? `<img crossorigin="anonymous" src="${safeUrl(r.image.startsWith('/') ? `https://make.fun${r.image}` : r.image)}" alt="" width="36" height="36" loading="lazy">` : `<span class="earner-initial">${esc((r.display_name ?? r.handle).slice(0, 1).toUpperCase())}</span>`}
            <span class="earner-name">@${esc(r.handle)}</span>
            <span class="earner-prize">${money(r.record?.prize_usd)} won</span>
          </a>`,
        )
        .join('');
      mount.querySelector('#earners').hidden = false;
    })
    .catch(() => {});
}

/** The rewards table of a bounty: every paid place at its live amount. */
function rewardsTable(b) {
  const rows = (b.rewardsNow ?? []).map(
    (r) => `
    <tr${r.place <= 3 ? ' class="podium"' : ''}>
      <td>${r.place}</td>
      <td>${money(r.baseUsd)}</td>
      <td>${Number(r.feeShareUsd) > 0 ? `+ ${money(r.feeShareUsd)}` : '—'}</td>
      <td class="reward-total">${money(r.amountUsd)}</td>
    </tr>`,
  );
  if (!rows.length) return '';
  return `
    <h2>Rewards — ${pot(b)} live pot</h2>
    <p class="note">The prize plus each winner's share of the entry fees paid in so far (${money(b.entryFeesUsd ?? 0)} from ${count(b.entryFeePayers ?? 0)} paid fees).</p>
    <div class="table-wrap"><table class="rewards">
      <thead><tr><th>Place</th><th>Prize</th><th>Fee share</th><th>Total</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`;
}

/** The latest entries a bounty page lists, each hunter linking to a profile. */
function latestEntries(b) {
  const subs = (b.submissions ?? []).slice(0, 8);
  if (!subs.length) return '';
  return `
    <h2>Latest entries</h2>
    <ul class="entries">
      ${subs
        .map(
          (s) => `
        <li>
          <a href="${PROFILE_URL(s.hunter)}">@${esc(s.hunter)}</a>
          <span class="entry-title">${esc(s.title ?? '')}</span>
          <span class="entry-when">${ago(s.createdAt)}</span>
        </li>`,
        )
        .join('')}
    </ul>`;
}

/** One bounty's page: summary, the live rewards, dates, rules and entries. */
export async function bountyView(mount, slug) {
  const b = await getBounty(slug);
  document.title = `${b.title} | make.fun`;
  const open = takingEntries(b);
  mount.innerHTML = `
    <p class="crumbs"><a href="#/">← All bounties</a></p>
    <section class="bounty-head">
      <div class="card-top">
        <span class="card-cat">${esc(b.category ?? 'Bounty')}</span>
        ${statusChip(b)}
        ${b.escrowLock ? '<span class="chip chip-escrow">Prize in escrow</span>' : ''}
      </div>
      <h1>${esc(b.title)}</h1>
      <p class="lead">${esc(b.summary ?? '')}</p>
      <div class="stat-band">
        <div class="stat"><span class="stat-label">Live pot</span><strong class="stat-pot">${pot(b)}</strong></div>
        <div class="stat"><span class="stat-label">Entry fee</span><strong>${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</strong></div>
        <div class="stat"><span class="stat-label">Entries</span><strong>${count(b.submissionCount)}</strong></div>
        <div class="stat"><span class="stat-label">${open ? 'Time left' : 'Deadline'}</span><strong data-countdown="${esc(b.deadline)}">${duration(Math.max(0, until(b.deadline)))}</strong><small>${dateTime(b.deadline)}</small></div>
      </div>
      <div class="actions">
        <a class="button" href="${BOUNTY_URL(slug)}/leaderboard">Leaderboard</a>
        <a class="button button-ghost" href="https://make.fun/bounty/${encodeURIComponent(slug)}" rel="noopener">Enter on make.fun ↗</a>
      </div>
      ${(b.skills ?? []).length ? `<div class="tags">${b.skills.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}</div>` : ''}
    </section>
    ${rewardsTable(b)}
    <section class="prose">
      <h2>About this bounty</h2>
      ${markdown(b.description)}
    </section>
    ${b.rules ? `<section class="prose"><h2>Rules</h2>${markdown(b.rules)}</section>` : ''}
    ${b.resolution?.summary ? `<section class="prose"><h2>How it is decided</h2><p>${esc(b.resolution.summary)}</p></section>` : ''}
    ${latestEntries(b)}
    <p class="note">Opened ${dateTime(b.opensAt ?? b.publishedAt)} · by ${esc(b.sponsor?.name ?? 'make.fun')}</p>`;
  return b;
}
