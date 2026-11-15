// Small helpers for turning API values into safe, readable text.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A URL made safe for an href: only http(s) and root-relative paths survive. */
export function safeUrl(value) {
  const s = String(value ?? '').trim();
  if (/^https?:\/\//i.test(s) || s.startsWith('/')) return esc(s);
  return '#';
}

/** A dollar amount ('1000.00', '0.50' or 250) as '$1,000' or '$0.50'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** A count with thousands separators: 7972 -> '7,972'. */
export function count(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
}

/** A date as 'Nov 17, 2026, 7:30 PM UTC'. */
export function dateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** A date as 'Nov 17, 2026'. */
export function dateOnly(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
}

/** Milliseconds from now until an ISO time (negative once it has passed). */
export function until(iso) {
  return new Date(iso).getTime() - Date.now();
}

/** A duration as '2d 4h', '3h 12m', '41m' or '58s'. */
export function duration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** The time until a deadline: '2d 4h left', or 'ended'. */
export function timeLeft(iso) {
  const ms = until(iso);
  return ms <= 0 ? 'ended' : `${duration(ms)} left`;
}

/** Whether a bounty still takes entries: by its deadline, never its status alone. */
export function takingEntries(bounty) {
  if (!bounty) return false;
  if (bounty.acceptingSubmissions === false) return false;
  return until(bounty.deadline) > 0;
}

/** A short relative time for activity lists: 'just now', '12m ago', '3h ago', '2d ago'. */
export function ago(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 60000) return 'just now';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * A small, safe Markdown renderer for bounty descriptions and rules.
 * The input is escaped first; only headings, lists, quotes, code, bold,
 * italic and http(s) links are turned back into markup.
 */
export function markdown(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let list = null;
  let code = null;
  let para = [];
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  const closePara = () => {
    if (para.length) {
      out.push(`<p>${para.map(inline).join(' ')}</p>`);
      para = [];
    }
  };
  const inline = (text) =>
    esc(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (code !== null) {
      if (line.trim().startsWith('```')) {
        out.push(`<pre><code>${code.map(esc).join('\n')}</code></pre>`);
        code = null;
      } else code.push(raw);
      continue;
    }
    if (line.trim().startsWith('```')) {
      closePara();
      closeList();
      code = [];
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closePara();
      closeList();
      const level = Math.min(heading[1].length + 1, 4);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      closePara();
      closeList();
      out.push('<hr>');
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      closePara();
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((bullet || numbered)[1])}</li>`);
      continue;
    }
    if (line.trim().startsWith('>')) {
      closePara();
      closeList();
      out.push(`<blockquote>${inline(line.trim().replace(/^>\s?/, ''))}</blockquote>`);
      continue;
    }
    if (!line.trim()) {
      closePara();
      closeList();
      continue;
    }
    para.push(line.trim());
  }
  if (code !== null) out.push(`<pre><code>${code.map(esc).join('\n')}</code></pre>`);
  closePara();
  closeList();
  return out.join('\n');
}
