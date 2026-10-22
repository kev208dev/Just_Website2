import { Quaternion, SRGBColorSpace, TextureLoader, Vector2, Vector3, type Texture } from 'three';
import { gsap } from 'gsap';
import { ExperienceCanvas } from './ExperienceCanvas';
import { CameraController } from './CameraController';
import { InputController } from './InputController';
import { JustLogo3D } from './JustLogo3D';
import { ProjectGallery3D } from './ProjectGallery3D';
import type { GalleryCard3D, GalleryItem } from './GalleryCard3D';
import type { GalleryMode } from './layouts/types';
import { setCursorOverride } from '../../scripts/cursor';
import { damp } from '../../lib/motion';

export interface GalleryUI {
  onReady(): void;
  onActive(item: GalleryItem | null): void;
  onHover(item: GalleryItem | null, x: number, y: number): void;
  onModeChange(mode: GalleryMode): void;
  onSelect(item: GalleryItem): void;
  onReset(): void;
}

export interface GalleryOptions {
  items: GalleryItem[];
  ui: GalleryUI;
  reduced: boolean;
  /** Wheel input target, so scrolling over overlay UI still drives the gallery. */
  wheelTarget?: HTMLElement;
}

/** After the last interaction the logo drifts at 30 fps for this long, then the scene goes fully static. */
const IDLE_DRIFT_SECONDS = 8;

async function loadTextures(items: GalleryItem[], anisotropy: number) {
  const loader = new TextureLoader();
  const map = new Map<string, Texture>();
  await Promise.all(
    items.map(async (item) => {
      const tex = await loader.loadAsync(item.image);
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = anisotropy;
      map.set(item.id, tex);
    }),
  );
  return map;
}

export async function createGallery(container: HTMLElement, options: GalleryOptions) {
  const { items, ui, reduced } = options;

  const stage = new ExperienceCanvas(container);
  const textures = await loadTextures(items, stage.maxAnisotropy);
  const gallery = new ProjectGallery3D(items, textures);
  const logo = new JustLogo3D();
  logo.group.position.set(0, 1.25, 0);
  stage.scene.add(gallery.group, logo.group);

  const cameraCtl = new CameraController(stage.camera);
  const pointerNdc = new Vector2();
  let hovered: GalleryCard3D | null = null;
  let keyboardFocus: GalleryCard3D | null = null;
  let selected: GalleryCard3D | null = null;
  let activeId: string | null = null;
  let mode: GalleryMode = 'rings';
  let morphTween: gsap.core.Tween | null = null;
  let lastInteraction = 0;
  let tick = 0;
  const intro = { p: 0 };

  const setHovered = (card: GalleryCard3D | null) => {
    if (hovered === card) return;
    if (hovered) hovered.hoverTarget = 0;
    hovered = card;
    if (card) card.hoverTarget = 1;
  };

  const select = (card: GalleryCard3D) => {
    if (selected) return;
    selected = card;
    input.enabled = false;
    setHovered(null);
    setCursorOverride(null);
    ui.onSelect(card.item);
    if (reduced) {
      window.location.href = card.item.href;
      return;
    }
    gsap
      .timeline({ onComplete: () => void (window.location.href = card.item.href) })
      .to(gallery.cards.filter((c) => c !== card), { fade: 0, duration: 0.5, ease: 'power2.out' }, 0)
      .to(logo, { fade: 0, duration: 0.5, ease: 'power2.out' }, 0)
      .to(card, { focus: 1, duration: 1.05, ease: 'expo.inOut' }, 0.05);
  };

  const input = new InputController(
    container,
    {
      onTap: (x, y) => {
        const rect = container.getBoundingClientRect();
        pointerNdc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
        const card = gallery.hitTest(pointerNdc, stage.camera);
        if (card) select(card);
      },
      onDragChange: (dragging) => {
        container.classList.toggle('is-dragging', dragging);
        if (dragging) setHovered(null);
      },
    },
    reduced,
    options.wheelTarget,
  );

  const resize = (w: number, h: number) => gallery.configure(w / h);
  stage.onResize(resize);
  resize(stage.size.width, stage.size.height);

  const focusPos = new Vector3();
  const focusQuat = new Quaternion();
  const forward = new Vector3();
  const canHover = matchMedia('(hover: hover)').matches;

  stage.add({
    update(dt, time) {
      tick++;
      const moving = input.update(dt);
      if (moving) lastInteraction = time;
      const { rings, spiral } = gallery.layouts;
      const cameraMoving = cameraCtl.update(dt, rings.camera, spiral.camera, gallery.morph, selected ? { x: 0, y: 0 } : input.pointer, reduced);
      gallery.shared.uFogNear.value = cameraCtl.fogNear;
      gallery.shared.uFogFar.value = cameraCtl.fogFar;

      if (selected) {
        // Keep the focus target glued to the camera so the card fills the viewport exactly.
        const d = 2.4;
        stage.camera.getWorldDirection(forward);
        focusPos.copy(stage.camera.position).addScaledVector(forward, d);
        focusQuat.copy(stage.camera.quaternion);
        const view = cameraCtl.viewSizeAt(d);
        selected.focusPose.position.copy(focusPos);
        selected.focusPose.quaternion.copy(focusQuat);
        selected.focusPose.sx = view.width;
        selected.focusPose.sy = view.height;
      }

      gallery.appear = intro.p;
      logo.appear = intro.p;
      gallery.update(dt, input.current, input.velocity, stage.camera, reduced);
      const logoMoving = logo.update(dt, time, input.pointer, input.velocity, reduced);

      const dimTarget = hovered || keyboardFocus ? 0.7 : 0;
      const dim = gallery.shared.uDim;
      dim.value += (dimTarget - dim.value) * damp(8, dt);
      const dimMoving = Math.abs(dimTarget - dim.value) > 0.002;
      if (!dimMoving) dim.value = dimTarget;

      // Hit-test only when the pointer moved, or while cards slide under it.
      if (!selected && canHover && input.client.inside && !input.dragging && (input.pointerMoved || (moving && tick % 2 === 0))) {
        input.pointerMoved = false;
        pointerNdc.set(input.pointer.x, input.pointer.y);
        const hit = gallery.hitTest(pointerNdc, stage.camera);
        if (hit !== hovered) {
          if (hit) keyboardFocus = null;
          setHovered(hit);
          setCursorOverride(hit ? 'view' : 'drag', hit ? 'VIEW' : 'DRAG');
        }
        ui.onHover(hit?.item ?? null, input.client.x, input.client.y);
      } else if (!selected && input.dragging) {
        setCursorOverride('drag', '← →');
        ui.onHover(null, 0, 0);
      }

      if (!selected) {
        // Both layouts bring work i to the front at scroll ≡ i (mod n).
        const n = gallery.count;
        const front = gallery.cards[((Math.round(input.current) % n) + n) % n];
        const id = front?.item.id ?? null;
        if (id !== activeId) {
          activeId = id;
          ui.onActive(front?.item ?? null);
        }
      }

      const busy =
        moving ||
        cameraMoving ||
        logoMoving ||
        dimMoving ||
        gallery.animating ||
        intro.p < 1 ||
        !!selected ||
        !!morphTween?.isActive();
      if (busy) {
        lastInteraction = Math.max(lastInteraction, time);
        return true;
      }
      // Idle: slow logo drift at 30 fps for a few seconds, then nothing at all.
      return !reduced && time - lastInteraction < IDLE_DRIFT_SECONDS && tick % 2 === 0;
    },
  });

  container.addEventListener('pointerleave', () => {
    if (selected) return;
    setHovered(null);
    setCursorOverride(null);
    ui.onHover(null, 0, 0);
  });
  container.addEventListener('pointermove', () => stage.invalidate(), { passive: true });

  const setMode = (next: GalleryMode) => {
    if (next === mode || selected) return;
    mode = next;
    ui.onModeChange(mode);
    morphTween?.kill();
    morphTween = gsap.to(gallery, { morph: mode === 'spiral' ? 1 : 0, duration: reduced ? 0.01 : 1.5, ease: 'none' });
    input.target = Math.round(input.target);
    stage.invalidate();
  };

  /** Rotate the gallery so the given item faces front (keyboard / list focus). */
  const focusItem = (id: string) => {
    if (selected) return;
    input.target = gallery.focusScrollFor(id, input.current);
    input.lastInput = 0;
    const card = gallery.cards.find((c) => c.item.id === id) ?? null;
    keyboardFocus = card;
    setHovered(card);
    stage.invalidate();
  };

  const clearFocus = () => {
    keyboardFocus = null;
    setHovered(null);
    stage.invalidate();
  };

  const onKey = (e: KeyboardEvent) => {
    if (selected || e.altKey || e.metaKey || e.ctrlKey) return;
    const el = document.activeElement;
    if (el && el !== document.body && !container.contains(el)) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) {
      e.preventDefault();
      input.nudge(step);
      stage.invalidate();
    }
  };
  window.addEventListener('keydown', onKey);

  /** Restore state when the page is shown again from the back/forward cache. */
  const reset = () => {
    selected = null;
    input.enabled = true;
    gallery.cards.forEach((c) => {
      c.focus = 0;
      c.fade = 1;
    });
    logo.fade = 1;
    stage.invalidate();
    ui.onReset();
  };
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) reset();
  };
  window.addEventListener('pageshow', onPageShow);

  stage.start();
  gsap.to(intro, { p: 1, duration: reduced ? 0.01 : 1.6, ease: 'power2.out', delay: 0.05 });
  if (!reduced) {
    input.current = -1.2;
    input.target = 0;
  }
  ui.onReady();

  return {
    setMode,
    focusItem,
    clearFocus,
    stats: stage.stats,
    get pixelRatio() {
      return stage.pixelRatio;
    },
    get mode() {
      return mode;
    },
    destroy() {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pageshow', onPageShow);
      input.dispose();
      gallery.dispose();
      logo.dispose();
      textures.forEach((t) => t.dispose());
      stage.dispose();
    },
  };
}

export type GalleryHandle = Awaited<ReturnType<typeof createGallery>>;
