/**
 * Site-wide motion system (GSAP + ScrollTrigger).
 *
 *  data-reveal="lines"  — headline lines (.split-line > span) rise out of a mask
 *  data-reveal="mask"   — image / block unmasked from the bottom
 *  data-reveal="fade"   — soft fade-up for secondary content
 *  data-parallax="0.12" — vertical parallax while scrolling (fraction of height)
 *
 * Only headlines and key media are animated; body copy stays static.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE } from "../lib/motion";
import { onPage, prefersReducedMotion } from "./lifecycle";

gsap.registerPlugin(ScrollTrigger);
document.documentElement.classList.add("motion-ready");

onPage<HTMLElement>("main", (main) => {
  const reduced = prefersReducedMotion();
  const ctx = gsap.context(() => {
    const targets = gsap.utils.toArray<HTMLElement>("[data-reveal]", main);
    if (reduced) {
      gsap.set(targets, { clearProps: "all" });
      targets.forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    for (const el of targets) {
      const kind = el.dataset.reveal;
      const delay = Number(el.dataset.revealDelay || 0);
      const inView = el.getBoundingClientRect().top < window.innerHeight * 0.92;
      const trigger = inView ? undefined : { trigger: el, start: "top 88%", once: true };

      if (kind === "lines") {
        const lines = el.querySelectorAll<HTMLElement>(".split-line > span");
        gsap.fromTo(
          lines,
          // y: 0 overrides the CSS pre-hide transform GSAP would otherwise read as a pixel offset
          { yPercent: 112, y: 0, rotate: 2 },
          {
            yPercent: 0,
            y: 0,
            rotate: 0,
            duration: 1.1,
            ease: EASE.out,
            stagger: 0.08,
            delay: inView ? 0.15 + delay : delay,
            scrollTrigger: trigger,
            onComplete: () => el.classList.add("is-revealed"),
          },
        );
      } else if (kind === "mask") {
        gsap.fromTo(
          el,
          { clipPath: "inset(0% 0% 100% 0%)" },
          {
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 1.2,
            ease: EASE.inOut,
            delay: inView ? 0.2 + delay : delay,
            scrollTrigger: trigger,
            onComplete: () => el.classList.add("is-revealed"),
          },
        );
        const img = el.querySelector("img");
        if (img) {
          gsap.fromTo(
            img,
            { scale: 1.18 },
            { scale: 1, duration: 1.6, ease: EASE.out, delay: inView ? 0.2 + delay : delay, scrollTrigger: trigger },
          );
        }
      } else {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 28 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.9,
            ease: EASE.standard,
            delay: inView ? 0.35 + delay : delay,
            scrollTrigger: trigger,
            onComplete: () => el.classList.add("is-revealed"),
          },
        );
      }
    }

    gsap.utils.toArray<HTMLElement>("[data-parallax]", main).forEach((el) => {
      const amount = Number(el.dataset.parallax || 0.1);
      gsap.fromTo(
        el,
        { yPercent: -amount * 100 },
        {
          yPercent: amount * 100,
          ease: "none",
          scrollTrigger: { trigger: el.parentElement || el, start: "top bottom", end: "bottom top", scrub: true },
        },
      );
    });
  }, main);

  // fonts can shift layout — re-measure once they are ready
  document.fonts?.ready.then(() => ScrollTrigger.refresh());

  return () => {
    ctx.revert();
    ScrollTrigger.getAll().forEach((t) => t.kill());
  };
});
