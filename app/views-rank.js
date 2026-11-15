// The leaderboard and the public profile. main.js loads this module with a
// dynamic import only when a route needs it, so the board's first load never
// carries it.

import { getLeaderboard, getProfile } from './api.js';
import { count, dateOnly, esc, money, safeUrl } from './format.js';

const PAGE = 50;
const BOUNTY_URL = (slug) => `#/bounty/${encodeURIComponent(slug)}`;
const PROFILE_URL = (handle) => `#/u/${encodeURIComponent(handle)}`;

/** An avatar image URL from the API, made absolute (avatars live on make.fun). */
function avatarUrl(image, avatar) {
  const raw = image ?? avatar?.url ?? null;
  if (!raw) return null;
  return raw.startsWith('/') ? `https://make.fun${raw}` : raw;
}

/** A round avatar, or the handle's initial when the account has no picture. */
function avatar(image, avatar, name, size) {
  const url = avatarUrl(image, avatar);
  if (url) return `<img class="avatar" crossorigin="anonymous" src="${safeUrl(url)}" alt="" width="${size}" height="${size}" loading="lazy">`;
  return `<span class="avatar avatar-initial" style="width:${size}px;height:${size}px">${esc(String(name ?? '?').slice(0, 1).toUpperCase())}</span>`;
}

/** One leaderboard row: rank, builder, then the bounty's own score columns. */
function row(entry, columns) {
  const cells = columns
    .filter((c) => !c.hidden)
    .map((c) => `<td>${esc(entry.display?.[c.key] ?? entry.values?.[c.key] ?? '—')}</td>`)
    .join('');
  const cost = entry.cost?.micro_usd ? money(Number(entry.cost.micro_usd) / 1e6) : '—';
  return `
  <tr${entry.house ? ' class="house"' : ''}>
    <td class="rank">${entry.rank ?? '—'}${entry.prize_rank ? ` <span class="prize-badge" title="In a paid place">🏆</span>` : ''}</td>
    <td class="builder">
      <a href="${PROFILE_URL(entry.handle)}">@${esc(entry.handle)}</a>
      <span class="entry-name">${esc(entry.title ?? '')}${entry.house ? ' <span class="tag">house</span>' : ''}</span>
    </td>
    ${cells}
    <td class="cost">${cost}</td>
  </tr>`;
}

/** A bounty's leaderboard: ranked entries, paged in slices of 50. */
export async function leaderboardView(mount, slug) {
  const data = await getLeaderboard(slug);
  const comp = data.competition ?? {};
  document.title = `Leaderboard — ${comp.title ?? slug} | make.fun`;
  const columns = data.columns ?? [];
  const entries = data.entries ?? [];
  mount.innerHTML = `
    <p class="crumbs"><a href="${BOUNTY_URL(slug)}">← ${esc(comp.title ?? slug)}</a></p>
    <h1>Leaderboard</h1>
    <p class="lead">${esc(data.phase?.title ?? data.title ?? 'Results')} · ${count(entries.length)} ranked entries${data.phase?.scores ? ` · scores ${esc(data.phase.scores)}` : ''}</p>
    <div class="controls">
      <input id="lq" type="search" placeholder="Filter by builder or entry…" aria-label="Filter leaderboard" autocomplete="off">
    </div>
    <div class="table-wrap"><table class="board-table">
      <thead><tr><th>#</th><th>Builder</th>${columns.filter((c) => !c.hidden).map((c) => `<th>${esc(c.title)}</th>`).join('')}<th>Build cost</th></tr></thead>
      <tbody id="lrows"></tbody>
    </table></div>
    <div class="more-row"><button id="lmore" type="button">Show more</button></div>`;

  const rowsEl = mount.querySelector('#lrows');
  const moreBtn = mount.querySelector('#lmore');
  let shown = 0;
  let filtered = entries;
  const paint = () => {
    const slice = filtered.slice(0, shown);
    rowsEl.innerHTML = slice.length
      ? slice.map((e) => row(e, columns)).join('')
      : '<tr><td colspan="99" class="empty">No entries match.</td></tr>';
    moreBtn.hidden = shown >= filtered.length;
    moreBtn.textContent = `Show more (${count(filtered.length - shown)} remaining)`;
  };
  const reset = () => {
    shown = PAGE;
    paint();
  };
  moreBtn.addEventListener('click', () => {
    shown += PAGE;
    paint();
  });
  mount.querySelector('#lq').addEventListener('input', (event) => {
    const q = event.target.value.trim().toLowerCase();
    filtered = q
      ? entries.filter((e) => `${e.handle} ${e.title ?? ''}`.toLowerCase().includes(q))
      : entries;
    reset();
  });
  reset();
  return data;
}

/** One record statistic on a profile. */
const stat = (label, value) => `<div class="stat"><span class="stat-label">${label}</span><strong>${value}</strong></div>`;

/** An account's public profile: links, record and every entry it has made. */
export async function profileView(mount, handle) {
  const p = await getProfile(handle);
  const name = p.display_name ?? p.handle;
  document.title = `@${p.handle} | make.fun`;
  const r = p.record ?? {};
  const links = [
    p.github_login ? `<a href="https://github.com/${encodeURIComponent(p.github_login)}" rel="noopener">GitHub ↗</a>` : '',
    p.x ? `<a href="https://x.com/${encodeURIComponent(String(p.x).replace(/^@/, ''))}" rel="noopener">X ↗</a>` : '',
    p.discord ? `<span>Discord: ${esc(p.discord)}</span>` : '',
    p.wallet?.address ? `<a href="${safeUrl(p.wallet.explorer_url)}" rel="noopener">Wallet ${esc(p.wallet.address.slice(0, 4))}…${esc(p.wallet.address.slice(-4))} ↗</a>` : '',
  ].filter(Boolean);
  mount.innerHTML = `
    <section class="profile-head">
      ${avatar(p.image, p.avatar, name, 72)}
      <div>
        <h1>${esc(name)}</h1>
        <p class="handle">@${esc(p.handle)}${p.house ? ' · house account' : ''} · joined ${dateOnly(p.joined_at)}</p>
        ${p.bio ? `<p class="lead">${esc(p.bio)}</p>` : ''}
        ${links.length ? `<p class="profile-links">${links.join(' · ')}</p>` : ''}
      </div>
    </section>
    <div class="stat-band">
      ${stat('Entered', count(r.competitions_entered ?? 0))}
      ${stat('Placed', count(r.competitions_placed ?? 0))}
      ${stat('Won', count(r.competitions_won ?? 0))}
      ${stat('Best place', r.best_placement ? `#${r.best_placement}` : '—')}
      ${stat('Prizes paid', money(r.prize_usd ?? 0))}
    </div>
    <h2>Entries</h2>
    ${
      (p.solutions ?? []).length
        ? `<ul class="solutions">${p.solutions
            .map(
              (s) => `
        <li>
          <div class="solution-main">
            <a href="${BOUNTY_URL(s.competition.slug)}">${esc(s.competition.title)}</a>
            <span class="entry-title">${esc(s.title ?? '')}</span>
          </div>
          <div class="solution-side">
            ${s.placement ? `<span class="prize-badge">#${s.placement}${s.prize_usd ? ` · ${money(s.prize_usd)}` : ''}</span>` : ''}
            ${s.score ? `<span class="score">${esc(s.score.column?.title ?? 'Score')}: <strong>${esc(s.score.display)}</strong></span>` : ''}
            <span class="entry-when">${dateOnly(s.entered_at)}</span>
          </div>
        </li>`,
            )
            .join('')}</ul>`
        : '<p class="empty">No entries yet.</p>'
    }`;
  return p;
}
