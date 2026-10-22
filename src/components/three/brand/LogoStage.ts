import {
  ACESFilmicToneMapping,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { createLogoGeometry, createLogoMaterials, LOGO_ASPECT } from './LogoAsset';
import { createStudioEnvironment } from './StudioEnvironment';
import { damp } from '../../../lib/motion';

export interface LogoStageOptions {
  reduced: boolean;
  onReady?: () => void;
}

/** Soft elliptical contact shadow, drawn once into a small canvas. */
function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 64, 0, 128, 64, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * Hero "sculpture": the JUST wordmark in dark brushed chrome with bronze
 * bevels, lit by a baked studio environment. Renders on demand — full rate
 * while something moves, 30 fps for the slow idle drift, nothing when hidden.
 */
export class LogoStage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(26, 1, 0.1, 50);
  private readonly pivot = new Group();
  private readonly logo: Mesh;
  private readonly shadow: Mesh;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly io: IntersectionObserver;
  private readonly ro: ResizeObserver;
  private readonly ac = new AbortController();
  private raf = 0;
  private visible = true;
  private running = false;
  private last = 0;
  private time = 0;
  private frame = 0;
  private lastInput = performance.now();
  private pointer = { x: 0, y: 0 };
  private tilt = { x: 0, y: 0 };
  private progress = 0;
  private shownProgress = 0;
  private intro = 0;
  private dpr: number;
  private frameTimes: number[] = [];
  /** Exposed for QA: frames actually rendered. */
  rendered = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly opts: LogoStageOptions,
  ) {
    const coarse = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
    this.dpr = Math.min(devicePixelRatio || 1, coarse ? 1 : 1.25);

    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);

    const env = createStudioEnvironment(this.renderer);
    this.scene.environment = env;
    this.disposables.push(env);

    const geometry = createLogoGeometry(0.34);
    const { face, edge, list } = createLogoMaterials();
    this.logo = new Mesh(geometry, [...list]);
    this.disposables.push(geometry, face, edge);
    this.pivot.add(this.logo);

    const shadowTex = shadowTexture();
    const shadowGeo = new PlaneGeometry(1, 1);
    const shadowMat = new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.75 });
    this.shadow = new Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.disposables.push(shadowTex, shadowGeo, shadowMat);

    this.scene.add(this.pivot, this.shadow);

    const opt = { signal: this.ac.signal, passive: true } as const;
    window.addEventListener(
      'pointermove',
      (e) => {
        this.pointer.x = (e.clientX / innerWidth) * 2 - 1;
        this.pointer.y = -((e.clientY / innerHeight) * 2 - 1);
        this.wake();
      },
      opt,
    );
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()), opt);

    this.io = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.start();
      else this.stop();
    });
    this.io.observe(container);
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(container);
    this.layout();
    this.render();
    this.start();
    opts.onReady?.();
  }

  /** 0 at rest, 1 when the hero has scrolled out. */
  setProgress(p: number) {
    this.progress = p;
    this.wake();
  }

  private wake() {
    this.lastInput = performance.now();
    if (!this.running) this.start();
  }

  private layout() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.position.set(0, 0.55, 9);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    const viewH = 2 * Math.tan((this.camera.fov * Math.PI) / 360) * 9;
    const viewW = viewH * aspect;
    const wide = aspect > 1.05;
    // Desktop: the sculpture sits right of centre, above the headline. Mobile: centred, upper half.
    const width = wide ? Math.min(viewW * 0.5, viewH * 1.35) : viewW * 0.86;
    const scale = width / LOGO_ASPECT;
    this.logo.scale.setScalar(scale);
    this.pivot.position.set(wide ? viewW * 0.16 : 0, wide ? viewH * 0.16 : viewH * 0.2, 0);
    this.shadow.position.set(this.pivot.position.x, this.pivot.position.y - scale * 0.78, 0.2);
    this.shadow.scale.set(width * 1.15, scale * 1.1, 1);
    this.render();
  }

  private loop = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min((now - (this.last || now)) / 1000, 1 / 20);
    this.last = now;
    this.time += dt;
    this.frame++;

    const reduced = this.opts.reduced;
    const sinceInput = (performance.now() - this.lastInput) / 1000;
    const active = sinceInput < 1.5 || this.intro < 1 || Math.abs(this.progress - this.shownProgress) > 0.0005;
    // Idle drift is slow enough to read smoothly at 30 fps, and stops entirely
    // 8 s after the last interaction; reduced motion renders only on change.
    const drifting = !reduced && sinceInput < 8;
    if (!active && (!drifting || this.frame % 2 === 1)) return;

    const t0 = performance.now();
    this.update(active ? dt : dt * 2, reduced);
    this.render();
    this.adapt(performance.now() - t0, dt);
  };

  private update(dt: number, reduced: boolean) {
    this.intro = Math.min(this.intro + dt / (reduced ? 0.01 : 2.2), 1);
    const e = 1 - Math.pow(1 - this.intro, 3);
    this.shownProgress += (this.progress - this.shownProgress) * damp(8, dt);
    this.tilt.x += (this.pointer.y * -0.07 - this.tilt.x) * damp(3, dt);
    this.tilt.y += (this.pointer.x * 0.14 - this.tilt.y) * damp(3, dt);

    const idle = reduced ? 0 : Math.sin(this.time * 0.35) * 0.07;
    const p = this.shownProgress;
    this.pivot.rotation.set(0.04 + this.tilt.x + p * 0.25, -0.38 + (1 - e) * -0.55 + idle + this.tilt.y + p * 0.9, 0);
    this.logo.position.y = reduced ? 0 : Math.sin(this.time * 0.6) * 0.035;
    this.pivot.scale.setScalar(0.94 + 0.06 * e - p * 0.12);
    this.container.style.opacity = String(Math.min(e * 1.4, 1) * (1 - p * 0.85));
  }

  /** If frames are slow at the current pixel ratio, step down once. */
  private adapt(cpuMs: number, dt: number) {
    this.frameTimes.push(dt * 1000);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (avg > 26 && this.dpr > 1) {
      this.dpr = 1;
      this.renderer.setPixelRatio(1);
      this.layout();
    }
    void cpuMs;
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
    this.rendered++;
  }

  start() {
    if (this.running || !this.visible || document.hidden) return;
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  get pixelRatio() {
    return this.dpr;
  }

  dispose() {
    this.stop();
    this.ac.abort();
    this.io.disconnect();
    this.ro.disconnect();
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
