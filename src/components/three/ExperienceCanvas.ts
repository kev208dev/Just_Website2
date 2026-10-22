import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Timer,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface Tickable {
  update(dt: number, time: number): void;
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
 * Owns the renderer, scene, camera, environment and the frame loop.
 * Pauses when the tab is hidden and cleans up GPU resources on dispose.
 */
export class ExperienceCanvas {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(50, 1, 0.1, 80);
  readonly maxAnisotropy: number;
  private readonly timer = new Timer();
  private readonly tickables = new Set<Tickable>();
  private readonly resizeObserver: ResizeObserver;
  private readonly resizeHandlers = new Set<(w: number, h: number) => void>();
  private raf = 0;
  private running = false;
  private disposed = false;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);
    this.maxAnisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8);

    const pmrem = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.035).texture;
    room.dispose();
    pmrem.dispose();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.timer.connect(document);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get size() {
    return { width: this.container.clientWidth, height: this.container.clientHeight };
  }

  onResize(fn: (w: number, h: number) => void) {
    this.resizeHandlers.add(fn);
  }

  add(t: Tickable) {
    this.tickables.add(t);
  }

  private resize() {
    const { width, height } = this.size;
    if (!width || !height) return;
    const mobile = Math.min(width, height) < 700;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.6 : 1.75));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.resizeHandlers.forEach((fn) => fn(width, height));
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
    this.tickables.forEach((t) => t.update(dt, time));
    this.renderer.render(this.scene, this.camera);
  };

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.timer.reset();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Render a single frame synchronously (used before the loop starts). */
  renderOnce() {
    this.renderer.render(this.scene, this.camera);
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
