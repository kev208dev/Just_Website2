import gsap from "gsap";
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  PMREMGenerator,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CameraController } from "./CameraController";
import { CARD_HEIGHT, CARD_WIDTH, type GalleryCard3D } from "./GalleryCard3D";
import { GalleryController } from "./GalleryController";
import { InputController } from "./InputController";
import { JustLogo3D } from "./JustLogo3D";
import { ProjectGallery3D } from "./ProjectGallery3D";
import type { GalleryItem, GalleryMode } from "./types";
import { clamp } from "./utils/math";
import { clearTextureCache } from "./utils/textures";

export interface ExperienceOptions {
  container: HTMLElement;
  items: GalleryItem[];
  logoUrl: string;
  reducedMotion: boolean;
  initialMode?: GalleryMode;
  initialOffset?: number;
  onReady?(): void;
  onActiveChange?(item: GalleryItem, index: number): void;
  onHoverChange?(item: GalleryItem | null): void;
  onDragChange?(dragging: boolean): void;
  /** fired once the selected card fills the view — `rect` is its on-screen box */
  onSelected?(item: GalleryItem, rect: DOMRect): void;
  onSelectStart?(item: GalleryItem): void;
}

export const BACKGROUND = "#090A0B";

/** Returns false when WebGL (1 or 2) cannot be created on this device. */
export function supportsWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Orchestrates the home page scene: renderer, camera, logo, gallery, input and
 * the render loop. Everything is created asynchronously after first paint and
 * fully disposed when the page is left.
 */
export class ExperienceCanvas {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly root = new Group();
  readonly cameraCtl = new CameraController();
  readonly controller: GalleryController;
  readonly gallery: ProjectGallery3D;
  readonly logo = new JustLogo3D();
  private input: InputController;
  private dust: Points;
  private rim: PointLight;
  private pmrem: PMREMGenerator;
  private resizeObserver: ResizeObserver;
  private ndc = new Vector2();
  private state = { intro: 0, focus: 0, time: 0 };
  private lastActive = -1;
  private lastTime = 0;
  private running = false;
  private disposed = false;
  private selecting = false;
  private onVisibility = () => (document.hidden ? this.stop() : this.start());

  constructor(private opts: ExperienceOptions) {
    const { container, items, reducedMotion } = opts;
    const canvas = document.createElement("canvas");
    canvas.className = "experience-canvas";
    canvas.setAttribute("aria-hidden", "true");

    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 720 ? 1.5 : 1.75);
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: dpr < 2,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(new Color(BACKGROUND), 1);
    container.appendChild(canvas);

    // image based lighting for the metallic logo
    this.pmrem = new PMREMGenerator(this.renderer);
    const env = this.pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.85;

    const fogColor = new Color(BACKGROUND);
    this.scene.add(this.root);
    this.scene.add(new AmbientLight(0xffffff, 0.15));
    const key = new DirectionalLight(0xffe2b8, 1.6);
    key.position.set(-6, 8, 10);
    this.scene.add(key);
    this.rim = new PointLight(0xf2ae45, 30, 30, 1.6);
    this.rim.position.set(4, 2, -5);
    this.scene.add(this.rim);

    this.controller = new GalleryController(reducedMotion);
    if (opts.initialOffset) this.controller.target = this.controller.offset = opts.initialOffset;
    if (opts.initialMode === "spiral") {
      this.controller.mode = "spiral";
      this.controller.morph = 1;
    }

    this.gallery = new ProjectGallery3D(items, fogColor);
    this.root.add(this.logo.group, this.gallery.group);
    this.dust = this.createDust();
    this.root.add(this.dust);

    this.input = new InputController(container, {
      onScroll: (d) => this.controller.scrollBy(d),
      onDragStart: () => {
        this.controller.dragStart();
        opts.onDragChange?.(true);
      },
      onDrag: (d) => this.controller.scrollBy(d),
      onDragEnd: (v) => {
        this.controller.dragEnd(v);
        opts.onDragChange?.(false);
      },
      onTap: (x, y) => this.handleTap(x, y),
      onStep: (dir) => this.controller.step(dir),
      onActivate: () => this.selectActive(),
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  /** Loads the logo and textures, then starts rendering and plays the entrance. */
  async init() {
    await this.logo.load(this.opts.logoUrl).catch((err) => console.warn("[JUST] logo failed to load", err));
    if (this.disposed) return;
    // render a first frame so shaders compile before the reveal
    this.update(0);
    this.renderer.compile(this.scene, this.cameraCtl.camera);
    this.start();
    this.opts.onReady?.();
    gsap.to(this.state, {
      intro: 1,
      duration: this.opts.reducedMotion ? 0.01 : 1.8,
      ease: "power3.out",
    });
    this.gallery.load(this.renderer);
  }

  private createDust() {
    const count = 260;
    const pos: number[] = [];
    for (let i = 0; i < count; i++) {
      const r = 6 + Math.random() * 16;
      const a = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 14;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r - 4);
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
    const mat = new PointsMaterial({
      color: new Color("#F2AE45"),
      size: 0.035,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    return new Points(geo, mat);
  }

  setMode(mode: GalleryMode) {
    if (this.selecting) return;
    this.controller.setMode(mode);
  }

  get mode() {
    return this.controller.mode;
  }

  step(dir: 1 | -1) {
    this.controller.step(dir);
  }

  goTo(index: number) {
    this.controller.goTo(index, this.gallery.items.length);
  }

  private handleTap(x: number, y: number) {
    if (this.selecting) return;
    this.ndc.set(x, y);
    const card = this.gallery.pick(this.ndc, this.cameraCtl.camera);
    if (card) this.select(card);
  }

  /** Opens the active project (keyboard / UI button). */
  selectActive() {
    if (this.selecting) return;
    const card = this.gallery.focusCard(this.controller.offset, this.controller.morph);
    this.select(card);
  }

  private resize() {
    const { container } = this.opts;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.cameraCtl.setViewport(w, h);
    this.root.scale.setScalar(this.cameraCtl.layoutScale);
    this.gallery.setCompact(this.cameraCtl.compact);
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastTime = performance.now();
    this.renderer.setAnimationLoop(this.tick);
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private tick = (now: number) => {
    const dt = clamp((now - this.lastTime) / 1000, 0, 0.05);
    this.lastTime = now;
    this.update(dt);
    this.renderer.render(this.scene, this.cameraCtl.camera);
  };

  private update(dt: number) {
    const { reducedMotion } = this.opts;
    const c = this.controller;
    this.state.time += dt;
    const time = this.state.time;

    if (!this.selecting) c.update(dt);

    this.cameraCtl.update({
      dt,
      morph: c.morph,
      pointer: this.input.isCoarse ? { x: 0, y: 0 } : this.input.pointer,
      reducedMotion,
      focus: this.state.focus,
    });
    this.gallery.spiral.cameraZ = this.cameraCtl.localZ;

    this.gallery.update({
      dt,
      time,
      offset: c.offset,
      morph: c.morph,
      bend: c.bend,
      intro: this.state.intro,
      reducedMotion,
    });

    this.logo.update({
      dt,
      time,
      pointer: this.input.isCoarse ? { x: 0, y: 0 } : this.input.pointer,
      velocity: c.velocity,
      morph: c.morph,
      intro: this.state.intro,
      reducedMotion,
    });

    // slowly orbiting rim light keeps reflections alive on the metal
    if (!reducedMotion) {
      this.rim.position.set(Math.cos(time * 0.25) * 6, 2 + Math.sin(time * 0.4), Math.sin(time * 0.25) * 6 - 2);
      this.dust.rotation.y = time * 0.012;
    }

    // hover picking (desktop pointers only; never while dragging)
    if (!this.selecting && !this.input.isCoarse) {
      if (this.input.pointerInside && !c.dragging && this.state.intro > 0.6) {
        this.ndc.set(this.input.pointer.x, this.input.pointer.y);
        const hit = this.gallery.pick(this.ndc, this.cameraCtl.camera);
        if (hit !== this.gallery.hovered) {
          this.gallery.setHovered(hit);
          this.opts.onHoverChange?.(hit ? hit.item : null);
        }
      } else if (this.gallery.hovered) {
        this.gallery.setHovered(null);
        this.opts.onHoverChange?.(null);
      }
    }

    const active = this.gallery.activeItem(c.offset);
    if (active !== this.lastActive) {
      this.lastActive = active;
      this.opts.onActiveChange?.(this.gallery.items[active], active);
    }
  }

  /** Selection sequence: highlight → travel to centre → enlarge → others fade → navigate. */
  private select(card: GalleryCard3D) {
    if (this.selecting) return;
    this.selecting = true;
    this.controller.locked = true;
    this.opts.onSelectStart?.(card.item);
    this.gallery.setHovered(card);

    const cam = this.cameraCtl.camera;
    const scale = this.cameraCtl.layoutScale;
    const start = {
      position: card.current.position.clone(),
      quaternion: card.current.quaternion.clone(),
      scale: card.current.scale,
    };

    // destination: centred in front of the camera, filling most of the view
    const dist = 7;
    const viewH = 2 * dist * Math.tan((cam.fov * Math.PI) / 360);
    const viewW = viewH * cam.aspect;
    const worldH = Math.min(viewH * 0.62, (viewW * 0.84) / (CARD_WIDTH / CARD_HEIGHT));
    const dir = new Vector3();
    cam.getWorldDirection(dir);
    const worldPos = cam.position.clone().addScaledVector(dir, dist);
    const endPos = this.root.worldToLocal(worldPos.clone());
    const endQuat = cam.quaternion.clone();
    const endScale = worldH / (CARD_HEIGHT * scale) / 1.12; // the card is still hovered (+12%)

    const override = {
      position: start.position.clone(),
      quaternion: start.quaternion.clone(),
      scale: start.scale,
      opacity: 1,
    };
    card.override = override;
    const others = this.gallery.cards.filter((c) => c !== card);
    const p = { t: 0, fade: 0 };
    const rm = this.opts.reducedMotion;

    const finish = () => {
      const rect = this.screenRect(card);
      this.opts.onSelected?.(card.item, rect);
    };

    if (rm) {
      override.position.copy(endPos);
      override.quaternion.copy(endQuat);
      override.scale = endScale;
      others.forEach((c) => (c.visibility = 0));
      this.logo.opacity = 0;
      this.update(0);
      this.renderer.render(this.scene, cam);
      finish();
      return;
    }

    const tl = gsap.timeline({ onComplete: finish });
    tl.to(p, {
      fade: 1,
      duration: 0.6,
      ease: "power2.out",
      onUpdate: () => {
        for (const c of others) c.visibility = 1 - p.fade;
        this.logo.opacity = 1 - p.fade;
      },
    });
    tl.to(
      p,
      {
        t: 1,
        duration: 1.0,
        ease: "expo.inOut",
        onUpdate: () => {
          override.position.lerpVectors(start.position, endPos, p.t);
          override.quaternion.slerpQuaternions(start.quaternion, endQuat, p.t);
          override.scale = start.scale + (endScale - start.scale) * p.t;
        },
      },
      0.05,
    );
    tl.to(this.state, { focus: 1, duration: 1.0, ease: "power2.inOut" }, 0);
  }

  /** Projects the card's four corners to CSS pixels. */
  private screenRect(card: GalleryCard3D): DOMRect {
    const cam = this.cameraCtl.camera;
    card.mesh.updateMatrixWorld(true);
    const hw = CARD_WIDTH / 2;
    const hh = CARD_HEIGHT / 2;
    const el = this.renderer.domElement.getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const v = new Vector3();
    for (const [x, y] of [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ]) {
      v.set(x, y, 0).applyMatrix4(card.mesh.matrixWorld).project(cam);
      const sx = el.left + ((v.x + 1) / 2) * el.width;
      const sy = el.top + ((1 - v.y) / 2) * el.height;
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy);
      maxY = Math.max(maxY, sy);
    }
    return new DOMRect(minX, minY, maxX - minX, maxY - minY);
  }

  /** Test hook: advances the simulation by `seconds` at 60 Hz, then renders once. */
  debugAdvance(seconds: number) {
    const steps = Math.round(seconds * 60);
    for (let i = 0; i < steps; i++) this.update(1 / 60);
    this.renderer.render(this.scene, this.cameraCtl.camera);
    return {
      offset: this.controller.offset,
      morph: this.controller.morph,
      hovered: this.gallery.hovered?.item.slug ?? null,
      active: this.gallery.items[this.gallery.activeItem(this.controller.offset)].slug,
    };
  }

  /** Current scroll state, persisted so returning to home restores the view. */
  snapshot() {
    return { mode: this.controller.mode, offset: Math.round(this.controller.target) };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    gsap.killTweensOf(this.state);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.resizeObserver.disconnect();
    this.input.dispose();
    this.controller.dispose();
    this.gallery.dispose();
    this.logo.dispose();
    this.dust.geometry.dispose();
    (this.dust.material as PointsMaterial).dispose();
    this.scene.environment?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    clearTextureCache();
  }
}

