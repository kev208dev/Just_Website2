import { onPage } from "./lifecycle";

onPage<HTMLElement>("[data-awards]", (page) => {
  const list = page.querySelector<HTMLOListElement>("[data-award-rows]")!;
  const rows = Array.from(list.querySelectorAll<HTMLLIElement>(".row"));
  const search = page.querySelector<HTMLInputElement>("[data-award-search]")!;
  const year = page.querySelector<HTMLSelectElement>("[data-award-year]")!;
  const gen = page.querySelector<HTMLSelectElement>("[data-award-gen]")!;
  const sort = page.querySelector<HTMLSelectElement>("[data-award-sort]")!;
  const tierButtons = Array.from(page.querySelectorAll<HTMLButtonElement>("[data-tier]"));
  const count = page.querySelector<HTMLElement>("[data-award-count]")!;
  const empty = page.querySelector<HTMLElement>("[data-award-empty]")!;
  const abort = new AbortController();
  const { signal } = abort;
  let tier = "all";
  const collator = new Intl.Collator("ko");

  const apply = () => {
    const q = search.value.trim().toLowerCase();
    let visible = 0;
    for (const row of rows) {
      const d = row.dataset;
      const ok =
        (!q || (d.search ?? "").includes(q)) &&
        (year.value === "all" || d.year === year.value) &&
        (gen.value === "all" || (d.gens ?? "").split(" ").includes(gen.value)) &&
        (tier === "all" || d.tier === tier);
      row.hidden = !ok;
      if (ok) visible++;
    }
    count.textContent = String(visible);
    empty.hidden = visible > 0;
  };

  const reorder = () => {
    const by = sort.value;
    const sorted = [...rows].sort((a, b) => {
      if (by === "tier") return Number(a.dataset.tierRank) - Number(b.dataset.tierRank) || Number(a.dataset.order) - Number(b.dataset.order);
      if (by === "name") return collator.compare(a.dataset.name ?? "", b.dataset.name ?? "");
      return Number(a.dataset.order) - Number(b.dataset.order);
    });
    list.append(...sorted);
  };

  search.addEventListener("input", apply, { signal });
  year.addEventListener("change", apply, { signal });
  gen.addEventListener("change", apply, { signal });
  sort.addEventListener("change", reorder, { signal });
  tierButtons.forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        tier = b.dataset.tier || "all";
        tierButtons.forEach((t) => t.setAttribute("aria-pressed", String(t === b)));
        apply();
      },
      { signal },
    ),
  );

  const toggle = (row: HTMLElement, open?: boolean) => {
    const head = row.querySelector<HTMLButtonElement>(".row__head")!;
    const detail = row.querySelector<HTMLElement>(".row__detail")!;
    const next = open ?? head.getAttribute("aria-expanded") !== "true";
    head.setAttribute("aria-expanded", String(next));
    detail.hidden = !next;
  };

  list.addEventListener(
    "click",
    (e) => {
      const head = (e.target as Element).closest<HTMLButtonElement>(".row__head");
      if (head) toggle(head.closest(".row")!);
    },
    { signal },
  );

  // deep link (#a012) from people / project pages: reveal and open the record
  const openHash = () => {
    const id = location.hash.slice(1);
    const row = id ? rows.find((r) => r.id === id) : undefined;
    if (!row) return;
    row.hidden = false;
    toggle(row, true);
    row.classList.add("is-target");
    row.scrollIntoView({ block: "center" });
  };
  openHash();
  window.addEventListener("hashchange", openHash, { signal });

  return () => abort.abort();
});
