import { prefersReducedMotion } from '../lib/motion';

export function initAwards() {
  const root = document.querySelector<HTMLElement>('[data-records]');
  if (!root) return;
  const list = root.querySelector<HTMLElement>('[data-list]')!;
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-row]'));
  const search = root.querySelector<HTMLInputElement>('[data-search]')!;
  const year = root.querySelector<HTMLSelectElement>('[data-filter-year]')!;
  const gen = root.querySelector<HTMLSelectElement>('[data-filter-gen]')!;
  const tier = root.querySelector<HTMLSelectElement>('[data-filter-tier]')!;
  const sort = root.querySelector<HTMLSelectElement>('[data-sort]')!;
  const count = root.querySelector<HTMLElement>('[data-result-count]')!;
  const empty = root.querySelector<HTMLElement>('[data-empty]')!;

  const apply = () => {
    const q = search.value.trim().toLowerCase();
    let visible = 0;
    for (const row of rows) {
      const ok =
        (!q || row.dataset.searchText!.includes(q)) &&
        (year.value === 'all' || row.dataset.year === year.value) &&
        (gen.value === 'all' || row.dataset.gens!.split('|').includes(gen.value)) &&
        (tier.value === 'all' || row.dataset.tier === tier.value);
      row.hidden = !ok;
      if (ok) visible++;
    }
    count.textContent = String(visible);
    empty.hidden = visible > 0;

    const key = sort.value;
    const sorted = [...rows].sort((a, b) => {
      if (key === 'name') return a.dataset.name!.localeCompare(b.dataset.name!, 'ko');
      if (key === 'year') {
        const ya = a.dataset.year === 'archive' ? 0 : Number(a.dataset.year);
        const yb = b.dataset.year === 'archive' ? 0 : Number(b.dataset.year);
        return yb - ya || Number(a.dataset.index) - Number(b.dataset.index);
      }
      return Number(a.dataset.tier) - Number(b.dataset.tier) || Number(a.dataset.index) - Number(b.dataset.index);
    });
    list.append(...sorted);
  };

  [year, gen, tier, sort].forEach((el) => el.addEventListener('change', apply));
  search.addEventListener('input', apply);
  apply();

  // Expandable detail rows.
  const setOpen = (row: HTMLElement, open: boolean) => {
    const btn = row.querySelector<HTMLButtonElement>('.record__row')!;
    btn.setAttribute('aria-expanded', String(open));
    row.querySelector<HTMLElement>('.record__detail')!.hidden = !open;
  };
  rows.forEach((row) => {
    row.querySelector('.record__row')!.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      setOpen(row, btn.getAttribute('aria-expanded') !== 'true');
    });
  });

  // Deep link (#a25-01 from the home gallery or a profile) opens and reveals the record.
  const openHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id && rows.find((r) => r.id === id);
    if (!target) return;
    year.value = gen.value = tier.value = 'all';
    search.value = '';
    apply();
    setOpen(target, true);
    target.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  window.addEventListener('hashchange', openHash);
  if (location.hash) requestAnimationFrame(openHash);

  // Pointer tilt for exhibit plaques.
  if (prefersReducedMotion() || !matchMedia('(hover: hover)').matches) return;
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
      card.style.setProperty('--rx', `${(0.5 - y) * 8}deg`);
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}
