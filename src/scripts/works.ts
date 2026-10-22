import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { onPage, prefersReducedMotion } from "./lifecycle";

gsap.registerPlugin(Flip);

const VIEW_KEY = "just:works-view";

onPage<HTMLElement>("[data-works-page]", (page) => {
  const list = page.querySelector<HTMLElement>("[data-works]")!;
  const items = Array.from(list.querySelectorAll<HTMLElement>(".work"));
  const filterButtons = Array.from(page.querySelectorAll<HTMLButtonElement>("[data-filter]"));
  const viewButtons = Array.from(page.querySelectorAll<HTMLButtonElement>("[data-view]"));
  const status = page.querySelector<HTMLElement>("[data-works-status]");
  const preview = page.querySelector<HTMLImageElement>("[data-works-preview]");
  const reduced = prefersReducedMotion();
  const abort = new AbortController();
  const { signal } = abort;

  /** Animates any layout change of the list with FLIP so cards morph instead of jumping. */
  const morph = (change: () => void) => {
    if (reduced) return change();
    const state = Flip.getState(items, { props: "opacity" });
    change();
    Flip.from(state, {
      duration: 0.75,
      ease: "expo.inOut",
      absolute: false,
      nested: true,
      stagger: 0.02,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }),
      onLeave: (els) => gsap.to(els, { opacity: 0, duration: 0.3 }),
    });
  };

  const setView = (view: string, animate = true) => {
    const apply = () => {
      list.classList.toggle("is-grid", view === "grid");
      list.classList.toggle("is-list", view === "list");
      viewButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
    };
    animate ? morph(apply) : apply();
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  };

  const setFilter = (filter: string) => {
    morph(() => {
      let visible = 0;
      for (const item of items) {
        const show = filter === "all" || item.dataset.category === filter;
        item.hidden = !show;
        if (show) visible++;
      }
      filterButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === filter)));
      if (status) status.textContent = `${visible}개 프로젝트 표시`;
    });
  };

  let savedView = "grid";
  try {
    savedView = localStorage.getItem(VIEW_KEY) || "grid";
  } catch {
    /* ignore */
  }
  if (savedView === "list") setView("list", false);

  filterButtons.forEach((b) => b.addEventListener("click", () => setFilter(b.dataset.filter || "all"), { signal }));
  viewButtons.forEach((b) => b.addEventListener("click", () => setView(b.dataset.view || "grid"), { signal }));

  // list view: the project image floats next to the cursor
  if (preview && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    let x = 0;
    let y = 0;
    let px = 0;
    let py = 0;
    let raf = 0;
    let active = false;
    const loop = () => {
      px += (x - px) * (reduced ? 1 : 0.16);
      py += (y - py) * (reduced ? 1 : 0.16);
      const tilt = reduced ? 0 : Math.max(-8, Math.min(8, (x - px) * 0.08));
      preview.style.transform = `translate3d(${px + 28}px, ${py}px, 0) translate(0, -50%) rotate(${tilt}deg)`;
      raf = active ? requestAnimationFrame(loop) : 0;
    };
    list.addEventListener(
      "pointermove",
      (e) => {
        x = e.clientX;
        y = e.clientY;
        const link = (e.target as Element).closest<HTMLAnchorElement>(".work__link");
        const src = link?.dataset.preview;
        const show = list.classList.contains("is-list") && !!src;
        if (show && preview.getAttribute("src") !== src) preview.src = src!;
        preview.classList.toggle("is-visible", show);
        if (show && !active) {
          active = true;
          if (!raf) {
            px = x;
            py = y;
            raf = requestAnimationFrame(loop);
          }
        }
        if (!show) active = false;
      },
      { signal },
    );
    list.addEventListener(
      "pointerleave",
      () => {
        preview.classList.remove("is-visible");
        active = false;
      },
      { signal },
    );
  }

  return () => abort.abort();
});
