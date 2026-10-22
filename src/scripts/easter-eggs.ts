/**
 * Member easter eggs carried over from the original JUST website, rebuilt for
 * the new design: 김도연 → spider drop, 이채호 → flashbang flare.
 */
import gsap from "gsap";

const STYLE_ID = "just-easter-style";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .egg-layer { position: fixed; inset: 0; z-index: 95; pointer-events: none; overflow: hidden; }
    .egg-thread { position: absolute; top: 0; width: 1px; background: rgba(241,238,232,.55); transform-origin: top; }
    .egg-spider { position: absolute; top: 0; width: clamp(180px, 24vw, 300px); transform-origin: 50% 0; filter: drop-shadow(0 24px 40px rgba(0,0,0,.55)); }
    .egg-shell { position: absolute; width: 22px; height: 40px; margin: -20px 0 0 -11px; border-radius: 6px 6px 4px 4px;
      background: linear-gradient(90deg,#3b3d40,#9a9ca0 45%,#46484b); box-shadow: inset 0 9px 0 -6px #f2ae45; }
    .egg-shell::before { content: ""; position: absolute; left: 6px; top: -7px; width: 10px; height: 8px; border-radius: 2px; background: #6b6d70; }
    .egg-smoke { position: absolute; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: rgba(241,238,232,.35); filter: blur(3px); }
    .egg-burst { position: absolute; width: 20px; height: 20px; margin: -10px 0 0 -10px; border-radius: 50%;
      background: radial-gradient(circle, #fff 0%, rgba(255,240,210,.9) 30%, rgba(242,174,69,.35) 60%, transparent 70%); }
    .egg-flash { position: absolute; inset: 0; background: #fffaf0; opacity: 0; }
  `;
  document.head.appendChild(style);
}

function layer() {
  ensureStyles();
  const el = document.createElement("div");
  el.className = "egg-layer";
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  return el;
}

export function spiderDrop(origin: DOMRect, imageUrl: string, reduced: boolean) {
  const root = layer();
  const x = Math.min(Math.max(origin.left + origin.width / 2, 140), window.innerWidth - 140);
  const img = new Image();
  img.src = imageUrl;
  img.alt = "";
  img.className = "egg-spider";
  img.draggable = false;
  const thread = document.createElement("div");
  thread.className = "egg-thread";
  thread.style.left = `${x}px`;
  root.append(thread, img);

  const endY = Math.min(window.innerHeight * 0.62, origin.top + 160);
  img.addEventListener(
    "load",
    () => {
      const w = img.getBoundingClientRect().width;
      gsap.set(img, { x: x - w / 2, y: -w });
      if (reduced) {
        gsap.set(img, { y: endY - w * 0.3 });
        gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.2, yoyo: true, repeat: 1, repeatDelay: 1.2, onComplete: () => root.remove() });
        return;
      }
      const tl = gsap.timeline({ onComplete: () => root.remove() });
      tl.to(img, {
        y: endY - w * 0.3,
        duration: 1.3,
        ease: "elastic.out(1, 0.45)",
        onUpdate: () => {
          const y = Number(gsap.getProperty(img, "y")) + w * 0.12;
          thread.style.height = `${Math.max(0, y)}px`;
        },
      })
        .fromTo(img, { rotate: -7 }, { rotate: 7, duration: 0.9, ease: "sine.inOut", yoyo: true, repeat: 2 }, 0.2)
        .to(
          img,
          {
            y: -w * 1.2,
            duration: 0.7,
            ease: "power3.in",
            onUpdate: () => {
              const y = Number(gsap.getProperty(img, "y")) + w * 0.12;
              thread.style.height = `${Math.max(0, y)}px`;
            },
          },
          "+=0.4",
        );
    },
    { once: true },
  );
  img.addEventListener("error", () => root.remove(), { once: true });
}

export function flare(origin: DOMRect, reduced: boolean) {
  if (reduced) return; // a flash is exactly what reduced-motion users opt out of
  const root = layer();
  const shell = document.createElement("i");
  shell.className = "egg-shell";
  const burst = document.createElement("i");
  burst.className = "egg-burst";
  const flash = document.createElement("i");
  flash.className = "egg-flash";
  root.append(shell, burst, flash);

  const startX = origin.left + origin.width / 2;
  const startY = origin.top + origin.height / 2;
  const dir = startX > window.innerWidth / 2 ? -1 : 1;
  const apexY = Math.max(window.innerHeight * 0.18, startY - 360);
  const apexX = startX + dir * 90;

  gsap.set([shell, burst], { left: startX, top: startY });
  gsap.set(burst, { scale: 0, opacity: 0 });

  const smoke = () => {
    const s = document.createElement("i");
    s.className = "egg-smoke";
    s.style.left = `${gsap.getProperty(shell, "left")}px`;
    s.style.top = `${gsap.getProperty(shell, "top")}px`;
    root.appendChild(s);
    gsap.to(s, {
      scale: 2.4 + Math.random(),
      opacity: 0,
      x: (Math.random() - 0.5) * 30,
      y: 10 + Math.random() * 20,
      duration: 1.2,
      ease: "power2.out",
      onComplete: () => s.remove(),
    });
  };
  const smokeTimer = window.setInterval(smoke, 45);

  const tl = gsap.timeline({
    onComplete: () => {
      window.clearInterval(smokeTimer);
      root.remove();
    },
  });
  tl.to(shell, { left: apexX, duration: 0.95, ease: "none" }, 0)
    .to(shell, { top: apexY, duration: 0.95, ease: "power2.out" }, 0)
    .to(shell, { rotate: dir * 620, duration: 0.95, ease: "power1.out" }, 0)
    .add(() => {
      window.clearInterval(smokeTimer);
      gsap.set(burst, { left: gsap.getProperty(shell, "left"), top: gsap.getProperty(shell, "top") });
      shell.style.opacity = "0";
    })
    .to(burst, { scale: 60, opacity: 1, duration: 0.25, ease: "expo.out" })
    .to(flash, { opacity: 0.85, duration: 0.08 }, "<")
    .to([flash, burst], { opacity: 0, duration: 1.1, ease: "power2.out" }, ">0.05");
}
