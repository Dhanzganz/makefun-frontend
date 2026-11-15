// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json.
//
// Two layers of restraint keep views fast and cheap:
//  - an in-memory cache keyed by URL: a view revisited within FRESH_MS is
//    served with no request at all, and past it the stored ETag is sent back
//    as If-None-Match — the API's tags turn on the minute, so a revalidation
//    inside the minute answers 304 and costs no body;
//  - in-flight de-duplication: two views asking for the same URL at once
//    share one request.

const API = 'https://make.fun/api';
const FRESH_MS = 30000;

const cache = new Map(); // url -> { etag, data, at }
const pending = new Map(); // url -> Promise<data>

async function get(path) {
  const url = API + path;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.data;
  if (pending.has(url)) return pending.get(url);
  const request = (async () => {
    try {
      const headers = hit?.etag ? { 'If-None-Match': hit.etag } : {};
      const res = await fetch(url, { headers });
      if (res.status === 304 && hit) {
        hit.at = Date.now();
        return hit.data;
      }
      if (!res.ok) throw new Error(`make.fun API ${res.status} for ${path}`);
      const data = await res.json();
      cache.set(url, { etag: res.headers.get('etag'), data, at: Date.now() });
      return data;
    } finally {
      pending.delete(url);
    }
  })();
  pending.set(url, request);
  return request;
}

/** The live bounty board: { items, next_cursor }. Pass a cursor for the next page. */
export const getBounties = (cursor) =>
  get(`/competitions?status=open&activity=times${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);

/** One bounty in full: summary, description, rules, the live rewards table, dates. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: its phase, its columns and every ranked entry. */
export const getLeaderboard = (slug) => get(`/competitions/${encodeURIComponent(slug)}/leaderboard`);

/** An account's public profile: its links, its record and its entries. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);

/** The accounts ranked by prize money paid: the board's top-earners strip. */
export const getRankings = () => get('/rankings?order=paid');

/** Drop every cached answer (used by the board's refresh button). */
export function clearCache() {
  cache.clear();
}
