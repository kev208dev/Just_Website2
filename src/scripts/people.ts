import { flare, spiderDrop } from "./easter-eggs";
import { onPage, prefersReducedMotion } from "./lifecycle";

interface Profile {
  name: string;
  generation: string;
  unit: string;
  role: string | null;
  nickname: string | null;
  easterEgg: "spider-drop" | "flare" | null;
  awards: { id: string; event: string; award: string | null; year: number | null }[];
}

const CLICK_DELAY = 240; // ms — distinguishes a single click (profile) from a double click (nickname)

onPage<HTMLElement>("[data-people]", (page) => {
  const data: Record<string, Profile> = JSON.parse(page.querySelector("#people-data")?.textContent || "{}");
  const reduced = prefersReducedMotion();
  const awardsUrl = page.dataset.awardsUrl || "";
  const spiderUrl = page.dataset.spider || "";
  const panel = page.querySelector<HTMLElement>("[data-panel]")!;
  const backdrop = page.querySelector<HTMLElement>("[data-panel-backdrop]")!;
  const q = <T extends HTMLElement>(sel: string) => panel.querySelector<T>(sel)!;
  const abort = new AbortController();
  const { signal } = abort;
  let current: string | null = null;
  let lastTrigger: HTMLElement | null = null;
  let clickTimer = 0;
  let closeTimer = 0;

  /* ------------------------------------------------ nickname easter egg */
  const toggleNickname = (id: string) => {
    const profile = data[id];
    const button = page.querySelector<HTMLElement>(`[data-member="${id}"]`);
    const nameEl = button?.querySelector<HTMLElement>(".member__name");
    if (!profile || !button || !nameEl || !profile.nickname) return;
    const open = button.classList.toggle("nickname-open");
    nameEl.textContent = open ? profile.nickname : profile.name;
    if (current === id) q("[data-panel-nick]").textContent = open ? `별명: ${profile.nickname}` : "별명 보기";
    if (open && profile.easterEgg) {
      const rect = button.getBoundingClientRect();
      if (profile.easterEgg === "spider-drop") spiderDrop(rect, spiderUrl, reduced);
      if (profile.easterEgg === "flare") flare(rect, reduced);
    }
  };

  /* ------------------------------------------------ profile panel */
  const render = (id: string) => {
    const p = data[id];
    q("[data-panel-gen]").textContent = `${p.generation} — ${p.unit}`;
    q("[data-panel-name]").textContent = p.name;
    q("[data-panel-role]").textContent = p.role ?? "";
    q("[data-panel-generation]").textContent = p.generation;
    q("[data-panel-unit]").textContent = p.unit;
    const nickOpen = page.querySelector(`[data-member="${id}"]`)?.classList.contains("nickname-open");
    const nick = q<HTMLButtonElement>("[data-panel-nick]");
    nick.hidden = !p.nickname;
    nick.textContent = nickOpen && p.nickname ? `별명: ${p.nickname}` : "별명 보기";
    const list = q("[data-panel-awards]");
    list.replaceChildren(
      ...p.awards.map((a) => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = `${awardsUrl}#${a.id}`;
        const title = document.createElement("span");
        title.textContent = a.event;
        const tag = document.createElement("span");
        tag.className = "award-tag";
        tag.textContent = [a.award, a.year].filter(Boolean).join(" · ");
        link.append(title, tag);
        li.appendChild(link);
        return li;
      }),
    );
    q("[data-panel-awards-wrap]").hidden = p.awards.length === 0;
  };

  const open = (id: string, trigger?: HTMLElement | null) => {
    if (!data[id]) return;
    current = id;
    lastTrigger = trigger ?? null;
    render(id);
    window.clearTimeout(closeTimer);
    panel.hidden = false;
    backdrop.hidden = false;
    requestAnimationFrame(() => document.documentElement.classList.add("panel-open"));
    document.documentElement.style.overflow = "hidden";
    q<HTMLButtonElement>("[data-panel-close]").focus({ preventScroll: true });
    history.replaceState(null, "", `#member-${id}`);
  };

  const close = () => {
    if (!current) return;
    current = null;
    document.documentElement.classList.remove("panel-open");
    document.documentElement.style.overflow = "";
    closeTimer = window.setTimeout(() => {
      panel.hidden = true;
      backdrop.hidden = true;
    }, reduced ? 0 : 650);
    history.replaceState(null, "", location.pathname + location.search);
    lastTrigger?.focus({ preventScroll: true });
  };

  page.querySelectorAll<HTMLButtonElement>("[data-member]").forEach((button) => {
    const id = button.dataset.member!;
    button.addEventListener(
      "click",
      (e) => {
        // keyboard activation has no detail count — open immediately
        if (e.detail === 0) return open(id, button);
        window.clearTimeout(clickTimer);
        if (e.detail >= 2) return;
        clickTimer = window.setTimeout(() => open(id, button), CLICK_DELAY);
      },
      { signal },
    );
    button.addEventListener(
      "dblclick",
      (e) => {
        e.preventDefault();
        window.clearTimeout(clickTimer);
        toggleNickname(id);
      },
      { signal },
    );
  });

  q("[data-panel-nick]").addEventListener("click", () => current && toggleNickname(current), { signal });
  q("[data-panel-close]").addEventListener("click", close, { signal });
  backdrop.addEventListener("click", close, { signal });
  document.addEventListener(
    "keydown",
    (e) => {
      if (!current) return;
      if (e.key === "Escape") close();
      // keep focus inside the dialog
      if (e.key === "Tab") {
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>("button:not([hidden]), a[href]"));
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    { signal },
  );

  /* ------------------------------------------------ generation filter */
  const chips = Array.from(page.querySelectorAll<HTMLButtonElement>("[data-gen]"));
  const groups = Array.from(page.querySelectorAll<HTMLElement>("[data-gen-group]"));
  chips.forEach((chip) =>
    chip.addEventListener(
      "click",
      () => {
        const gen = chip.dataset.gen;
        chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
        groups.forEach((g) => (g.hidden = gen !== "all" && g.dataset.genGroup !== gen));
      },
      { signal },
    ),
  );

  // deep links from other pages: /people/#member-<id>
  const fromHash = location.hash.match(/^#member-(.+)$/);
  if (fromHash && data[fromHash[1]]) {
    const target = page.querySelector<HTMLElement>(`[data-member="${fromHash[1]}"]`);
    target?.scrollIntoView({ block: "center" });
    open(fromHash[1], target);
  }

  return () => {
    abort.abort();
    window.clearTimeout(clickTimer);
    window.clearTimeout(closeTimer);
    document.documentElement.classList.remove("panel-open");
    document.documentElement.style.overflow = "";
  };
});
