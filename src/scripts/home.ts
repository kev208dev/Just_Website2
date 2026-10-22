import type { GalleryItem, GalleryMode } from "../components/three/types";
import { onPage, prefersReducedMotion, setCursor } from "./lifecycle";

const STORAGE_KEY = "just:gallery";

function readState(): { mode?: GalleryMode; offset?: number } {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeState(state: { mode: GalleryMode; offset: number }) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — nothing to restore */
  }
}

function enableFallback(root: HTMLElement) {
  document.documentElement.classList.add("no-webgl");
  root.querySelector<HTMLElement>("[data-fallback]")?.removeAttribute("hidden");
}

onPage<HTMLElement>("[data-home]", async (root) => {
  const stage = root.querySelector<HTMLElement>("[data-stage]")!;
  const dataEl = root.querySelector<HTMLScriptElement>("#gallery-data");
  const items: GalleryItem[] = dataEl ? JSON.parse(dataEl.textContent || "[]") : [];
  const forceFallback = new URLSearchParams(location.search).has("2d");

  const { ExperienceCanvas, supportsWebGL } = await import("../components/three/ExperienceCanvas");
  if (forceFallback || !items.length || !supportsWebGL()) {
    enableFallback(root);
    return;
  }

  const ui = {
    index: root.querySelector<HTMLElement>("[data-active-index]"),
    title: root.querySelector<HTMLElement>("[data-active-title]"),
    category: root.querySelector<HTMLElement>("[data-active-category]"),
    link: root.querySelector<HTMLAnchorElement>("[data-active-link]"),
    modes: Array.from(root.querySelectorAll<HTMLButtonElement>("[data-mode]")),
    steps: Array.from(root.querySelectorAll<HTMLButtonElement>("[data-step]")),
    live: root.querySelector<HTMLElement>("[data-live]"),
  };

  const reducedMotion = prefersReducedMotion();
  const saved = readState();
  let swapTimer = 0;
  let experience: InstanceType<typeof ExperienceCanvas> | null = null;
  let navigating = false;

  const showActive = (item: GalleryItem, index: number) => {
    if (!ui.title || !ui.link) return;
    const apply = () => {
      ui.index!.textContent = String(index + 1).padStart(2, "0");
      ui.title!.textContent = item.title;
      ui.category!.textContent = [item.category, item.year].filter(Boolean).join(" · ");
      ui.link!.href = item.href;
      ui.link!.setAttribute("aria-label", `${item.title} 프로젝트 보기`);
      ui.link!.classList.remove("is-swapping");
      if (ui.live) ui.live.textContent = `${index + 1}번째 프로젝트: ${item.title}`;
    };
    if (reducedMotion) return apply();
    ui.link.classList.add("is-swapping");
    window.clearTimeout(swapTimer);
    swapTimer = window.setTimeout(apply, 200);
  };

  const setModeUI = (mode: GalleryMode) => {
    ui.modes.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    root.dataset.mode = mode;
  };

  try {
    experience = new ExperienceCanvas({
      container: stage,
      items,
      logoUrl: root.dataset.logo || "",
      reducedMotion,
      initialMode: saved.mode,
      initialOffset: saved.offset,
      onReady: () => root.classList.add("is-ready"),
      onActiveChange: showActive,
      onHoverChange: (item) => {
        if (item) setCursor("view", item.title);
        else setCursor("explore");
      },
      onDragChange: (dragging) => setCursor(dragging ? "drag" : "explore"),
      onSelectStart: () => {
        root.classList.add("is-selecting");
        setCursor("hidden");
      },
      onSelected: (item, rect) => openProject(item, rect),
    });
  } catch (err) {
    console.warn("[JUST] WebGL initialisation failed, using the 2D gallery", err);
    enableFallback(root);
    return;
  }

  setModeUI(experience.mode);
  if (new URLSearchParams(location.search).has("debug")) (window as unknown as { __just: unknown }).__just = experience;

  async function openProject(item: GalleryItem, rect: DOMRect) {
    if (navigating) return;
    navigating = true;
    if (experience) writeState(experience.snapshot());

    // hand the card over to the detail page hero through a shared-element view transition
    if (item.image && rect.width > 10) {
      const img = new Image();
      img.src = item.image;
      img.alt = "";
      img.className = "handoff-image";
      Object.assign(img.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        viewTransitionName: `project-${item.slug}`,
      });
      document.body.appendChild(img);
      try {
        await img.decode();
      } catch {
        /* the hero will still load on the next page */
      }
    }
    try {
      const { navigate } = await import("astro:transitions/client");
      await navigate(item.href);
    } catch {
      location.href = item.href;
    }
  }

  ui.modes.forEach((button) =>
    button.addEventListener("click", () => {
      const mode = button.dataset.mode as GalleryMode;
      experience?.setMode(mode);
      setModeUI(mode);
      if (experience) writeState(experience.snapshot());
    }),
  );
  ui.steps.forEach((button) =>
    button.addEventListener("click", () => experience?.step(Number(button.dataset.step) as 1 | -1)),
  );

  // the "view project" link opens through the same cinematic selection
  ui.link?.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    experience?.selectActive();
  });

  stage.addEventListener("pointerenter", () => setCursor("explore"));
  stage.addEventListener("pointerleave", () => setCursor("default"));

  await experience.init();

  return () => {
    window.clearTimeout(swapTimer);
    if (experience && !navigating) writeState(experience.snapshot());
    experience?.dispose();
    experience = null;
    setCursor("default");
  };
});
