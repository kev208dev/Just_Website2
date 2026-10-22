/**
 * Base-path aware URL helpers. The site is served from a sub path on GitHub
 * Pages (e.g. /Just_Website2/), so every internal link and asset goes through here.
 */
const BASE = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

/** Internal page URL with a trailing slash: url("work") → /Just_Website2/work/ */
export function url(path = ""): string {
  const clean = path.replace(/^\/+/, "");
  if (!clean) return BASE;
  const [pathname, hash] = clean.split("#");
  const withSlash = pathname.endsWith("/") || pathname.includes(".") ? pathname : `${pathname}/`;
  return `${BASE}${withSlash}${hash ? `#${hash}` : ""}`;
}

/** Public asset URL: asset("images/x.webp") → /Just_Website2/images/x.webp */
export function asset(path: string): string {
  return `${BASE}${path.replace(/^\/+/, "")}`;
}

/** True when `current` (a pathname) is inside the section `href` points to. */
export function isActive(current: string, href: string): boolean {
  const norm = (p: string) => (p.endsWith("/") ? p : `${p}/`);
  return norm(current).startsWith(norm(href)) && norm(href) !== BASE;
}
