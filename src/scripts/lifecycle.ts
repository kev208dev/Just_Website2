/**
 * Page lifecycle for Astro's ClientRouter.
 *
 * Bundled module scripts execute once per session, but pages are swapped
 * client-side. `onPage` runs an initializer every time a page containing
 * `selector` is shown, and runs its cleanup right before the page is swapped
 * out (so WebGL contexts, listeners and tweens never leak between pages).
 */
type Cleanup = void | (() => void);

export function onPage<T extends HTMLElement = HTMLElement>(
  selector: string,
  init: (el: T) => Cleanup | Promise<Cleanup>,
) {
  let pending: Promise<Cleanup> | null = null;

  const run = () => {
    const el = document.querySelector<T>(selector);
    if (!el || el.dataset.lifecycle === "on") return;
    el.dataset.lifecycle = "on";
    pending = Promise.resolve()
      .then(() => init(el))
      .catch((err) => {
        console.error(`[JUST] failed to initialise ${selector}`, err);
      });
  };

  const teardown = () => {
    const current = pending;
    pending = null;
    current?.then((cleanup) => {
      if (typeof cleanup === "function") cleanup();
    });
  };

  document.addEventListener("astro:page-load", run);
  document.addEventListener("astro:before-swap", teardown);
  if (document.readyState !== "loading") run();
  else document.addEventListener("DOMContentLoaded", run, { once: true });
}

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const isFinePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Broadcast a cursor state change (handled by the custom cursor component). */
export function setCursor(state: "default" | "view" | "drag" | "explore" | "hidden", label?: string) {
  document.dispatchEvent(new CustomEvent("just:cursor", { detail: { state, label } }));
}
