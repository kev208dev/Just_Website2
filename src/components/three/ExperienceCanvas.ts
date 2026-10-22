import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Timer,
  WebGLRenderer,
} from 'three';
import { createStudioEnvironment } from './brand/StudioEnvironment';

export interface Tickable {
  /** Advance state; return true when the frame needs to be drawn. */
  update(dt: number, time: number): boolean;
}

/** Feature-detect WebGL2 without keeping a context around. */
export function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    const ok = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Renderer, scene, camera and an on-demand frame loop: the rAF keeps ticking
 * (cheap) but the GPU only draws when a tickable reports a change. Pixel ratio
 * is capped (1.25 desktop / 1.0 touch) and steps down once if frames run slow.
 */
export class ExperienceCanvas {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(36, 1, 0.1, 80);
  readonly maxAnisotropy: number;
  private readonly timer = new Timer();
  private readonly tickables = new Set<Tickable>();
  private readonly resizeObserver: ResizeObserver;
  private readonly resizeHandlers = new Set<(w: number, h: number) => void>();
  private raf = 0;
  private running = false;
  private disposed = false;
  private dirty = true;
  private dpr: number;
  private slowFrames = 0;
  private sampledFrames = 0;
  /** QA counters. */
  readonly stats = { rendered: 0, ticks: 0 };

  constructor(private readonly container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);
    this.maxAnisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 4);

    const coarse = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
    this.dpr = Math.min(devicePixelRatio || 1, coarse ? 1 : 1.25);

    this.scene.environment = createStudioEnvironment(this.renderer);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.timer.connect(document);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get size() {
    return { width: this.container.clientWidth, height: this.container.clientHeight };
  }

  get pixelRatio() {
    return this.dpr;
  }

  onResize(fn: (w: number, h: number) => void) {
    this.resizeHandlers.add(fn);
  }

  add(t: Tickable) {
    this.tickables.add(t);
  }

  /** Force a draw on the next frame. */
  invalidate() {
    this.dirty = true;
  }

  private resize() {
    const { width, height } = this.size;
    if (!width || !height) return;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.resizeHandlers.forEach((fn) => fn(width, height));
    this.dirty = true;
  }

  private onVisibility = () => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    this.timer.update(now);
    const dt = Math.min(this.timer.getDelta(), 1 / 20);
    const time = this.timer.getElapsed();
    this.stats.ticks++;
    let needs = this.dirty;
    this.tickables.forEach((t) => {
      if (t.update(dt, time)) needs = true;
    });
    if (!needs) return;
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
    this.stats.rendered++;
    this.adapt(dt);
  };

  /** One-way quality step: if most sampled frames miss ~40fps, drop to DPR 1. */
  private adapt(dt: number) {
    if (this.dpr <= 1) return;
    this.sampledFrames++;
    if (dt > 0.025) this.slowFrames++;
    if (this.sampledFrames < 120) return;
    if (this.slowFrames > 70) {
      this.dpr = 1;
      this.resize();
    }
    this.sampledFrames = this.slowFrames = 0;
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.timer.reset();
    this.dirty = true;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.disposed = true;
    this.stop();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.resizeObserver.disconnect();
    this.timer.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
