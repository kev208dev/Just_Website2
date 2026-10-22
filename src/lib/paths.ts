/** Prefix a site-relative path with the deploy base (`/Just_Website2/`). */
export function withBase(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (/^(https?:)?\/\//.test(path) || path.startsWith('mailto:')) return path;
  const clean = path.replace(/^\//, '');
  return clean ? `${base}/${clean}` : `${base}/`;
}

export const routes = {
  home: withBase(),
  work: withBase('work/'),
  explore: withBase('explore/'),
  project: (slug: string) => withBase(`work/${slug}/`),
  about: withBase('about/'),
  people: withBase('people/'),
  awards: withBase('awards/'),
  contact: withBase('contact/'),
};

export const navItems = [
  { label: 'Work', href: routes.work, key: 'work' },
  { label: 'Explore', href: routes.explore, key: 'explore' },
  { label: 'About', href: routes.about, key: 'about' },
  { label: 'People', href: routes.people, key: 'people' },
  { label: 'Awards', href: routes.awards, key: 'awards' },
  { label: 'Contact', href: routes.contact, key: 'contact' },
] as const;

export type NavKey = (typeof navItems)[number]['key'] | 'home';
