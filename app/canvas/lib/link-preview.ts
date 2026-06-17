// ── Link node helpers ──────────────────────────────────────────────────────────
// URL normalization + best-effort page-title fetching for "link" nodes. The
// favicon comes from Google's service (no CORS), so it's just a constructed URL;
// the page title needs a real fetch that CORS usually blocks — callers must
// treat a null result as "couldn't read it, fall back to the URL".

// Add a scheme if the user typed a bare host ("example.com" → "https://…").
export function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

// Hostname without a leading "www.", or the raw string if it won't parse.
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Google's favicon service — works cross-origin (plain <img> load, no fetch).
export function faviconUrl(url: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    domainOf(url),
  )}&sz=32`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// Best-effort page title: og:title, then <title>. Returns null on any failure
// (CORS, network, no match) so the caller falls back to showing the URL.
export async function fetchLinkTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const html = await res.text();
    const og =
      html.match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      ) ??
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      );
    if (og?.[1]) return decodeEntities(og[1]).trim() || null;
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (title?.[1]) return decodeEntities(title[1]).trim() || null;
    return null;
  } catch {
    return null;
  }
}
