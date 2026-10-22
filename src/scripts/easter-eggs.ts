/**
 * Member easter eggs carried over from the original JUST site, rebuilt as
 * self-cleaning overlays that respect reduced motion.
 */
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function injectStyles() {
  if (document.getElementById('easter-egg-styles')) return;
  const style = document.createElement('style');
  style.id = 'easter-egg-styles';
  style.textContent = `
  .egg-layer{position:fixed;inset:0;z-index:95;pointer-events:none;overflow:hidden}
  .egg-spider{position:absolute;left:var(--x);top:0;width:var(--w);transform:translate(-50%,-110%);animation:egg-drop 4s cubic-bezier(.2,.9,.25,1) forwards}
  .egg-spider::before{content:'';position:absolute;left:50%;bottom:92%;width:1.5px;height:100vh;background:linear-gradient(transparent,rgba(241,238,232,.75));transform:translateX(-50%)}
  .egg-spider img{width:100%;display:block;animation:egg-sway 1.6s ease-in-out .9s infinite alternate;transform-origin:50% 0}
  @keyframes egg-drop{0%{transform:translate(-50%,-110%)}35%{transform:translate(-50%,var(--y))}48%{transform:translate(-50%,calc(var(--y) - 40px))}60%,82%{transform:translate(-50%,var(--y))}100%{transform:translate(-50%,-110%)}}
  @keyframes egg-sway{from{rotate:-6deg}to{rotate:6deg}}
  .egg-grenade{position:absolute;width:30px;height:44px;margin:-22px 0 0 -15px;border-radius:9px;background:linear-gradient(90deg,#3c3f37,#6b7062 45%,#2c2e28);box-shadow:inset 0 -10px 0 #2a2b27}
  .egg-grenade::before{content:'';position:absolute;left:8px;top:-8px;width:14px;height:10px;border-radius:3px 3px 0 0;background:#9a9a90}
  .egg-grenade::after{content:'FLASH';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-90deg);font:700 7px/1 'Space Grotesk',sans-serif;letter-spacing:.1em;color:#f2ae45}
  .egg-smoke{position:absolute;width:14px;height:14px;margin:-7px;border-radius:50%;background:rgba(200,200,200,.35);animation:egg-smoke 1.4s ease-out forwards}
  @keyframes egg-smoke{to{opacity:0;transform:translate(var(--dx),var(--dy)) scale(3.2)}}
  .egg-flash{position:absolute;inset:0;background:#fff;opacity:0;animation:egg-flash 2.6s ease-out forwards}
  @keyframes egg-flash{0%{opacity:0}4%{opacity:1}35%{opacity:.96}100%{opacity:0}}
  `;
  document.head.append(style);
}

export function triggerSpiderDrop(anchor: HTMLElement, imageUrl: string) {
  injectStyles();
  document.querySelector('.egg-layer[data-egg="spider"]')?.remove();
  const rect = anchor.getBoundingClientRect();
  const w = clamp(window.innerWidth * 0.26, 200, 320);
  const layer = document.createElement('div');
  layer.className = 'egg-layer';
  layer.dataset.egg = 'spider';
  layer.setAttribute('aria-hidden', 'true');
  const spider = document.createElement('div');
  spider.className = 'egg-spider';
  spider.style.setProperty('--x', `${clamp(rect.left + rect.width / 2, w / 2 + 16, window.innerWidth - w / 2 - 16)}px`);
  spider.style.setProperty('--y', `${Math.min(window.innerHeight * 0.62, rect.top + 200) - w * 0.4}px`);
  spider.style.setProperty('--w', `${w}px`);
  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = '';
  spider.append(img);
  layer.append(spider);
  document.body.append(layer);
  if (reduced()) spider.style.animation = 'none';
  window.setTimeout(() => layer.remove(), reduced() ? 900 : 4200);
}

export function triggerFlashbang(anchor: HTMLElement, target?: HTMLElement) {
  injectStyles();
  const layer = document.createElement('div');
  layer.className = 'egg-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  const cleanup = () => layer.remove();

  if (reduced()) {
    const flash = document.createElement('div');
    flash.className = 'egg-flash';
    flash.style.animationDuration = '0.8s';
    flash.style.opacity = '0.4';
    layer.append(flash);
    window.setTimeout(cleanup, 900);
    return;
  }

  const rect = anchor.getBoundingClientRect();
  const grenade = document.createElement('div');
  grenade.className = 'egg-grenade';
  layer.append(grenade);

  const gravity = 1320;
  const startY = rect.top + rect.height / 2;
  const peak = target ? target.getBoundingClientRect().top + 40 : window.innerHeight * 0.3;
  const rise = Math.max(180, startY - peak);
  const dir = rect.left + rect.width / 2 > window.innerWidth / 2 ? -1 : 1;
  let x = rect.left + rect.width / 2;
  let y = startY;
  let vx = dir * (34 + Math.random() * 16);
  let vy = -Math.sqrt(2 * gravity * rise);
  let angle = -28;
  let spin = dir * 600;
  let apex = y;
  let last = performance.now();
  let lastSmoke = 0;

  const step = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.028);
    last = now;
    vx *= 0.992;
    vy += gravity * dt;
    x += vx * dt;
    y += vy * dt;
    angle += spin * dt;
    spin *= 0.986;
    apex = Math.min(apex, y);
    grenade.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg)`;
    if (now - lastSmoke > 45) {
      lastSmoke = now;
      const puff = document.createElement('i');
      puff.className = 'egg-smoke';
      puff.style.left = `${x}px`;
      puff.style.top = `${y}px`;
      puff.style.setProperty('--dx', `${(Math.random() - 0.5) * 20}px`);
      puff.style.setProperty('--dy', `${10 + Math.random() * 14}px`);
      layer.append(puff);
      window.setTimeout(() => puff.remove(), 1400);
    }
    if (vy > 170 && y > apex + 24) {
      grenade.remove();
      const flash = document.createElement('div');
      flash.className = 'egg-flash';
      layer.append(flash);
      window.setTimeout(cleanup, 2700);
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  window.setTimeout(cleanup, 6000);
}
