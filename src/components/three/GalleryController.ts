import { Quaternion, SRGBColorSpace, TextureLoader, Vector2, Vector3, type Texture } from 'three';
import { gsap } from 'gsap';
import { ExperienceCanvas } from './ExperienceCanvas';
import { CameraController } from './CameraController';
import { InputController } from './InputController';
import { JustLogo3D } from './JustLogo3D';
import { ProjectGallery3D } from './ProjectGallery3D';
import type { GalleryCard3D, GalleryItem } from './GalleryCard3D';
import type { GalleryMode } from './layouts/types';
import { createPlateTexture } from './textures/plateTexture';
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
  slots?: number;
  /** Wheel input target, so scrolling over overlay UI still drives the gallery. */
  wheelTarget?: HTMLElement;
}

/**
 * Interleave works and award plates so that neighbours on a ring, across
 * rows and along the spiral are always different items.
 */
function buildSequence(items: GalleryItem[], slots: number) {
  const projects = items.map((it, i) => ({ it, i })).filter((x) => x.it.kind === 'project');
  const plates = items.map((it, i) => ({ it, i })).filter((x) => x.it.kind === 'award');
  const pattern: number[] = [];
  let p = 0;
  let a = 0;
  // Two works, then a plate.
  while (p < projects.length) {
    pattern.push(projects[p++].i);
    if (p < projects.length) pattern.push(projects[p++].i);
    if (a < plates.length) pattern.push(plates[a++].i);
  }
  while (a < plates.length) pattern.push(plates[a++].i);
  return Array.from({ length: slots }, (_, s) => pattern[s % pattern.length]);
}

async function loadTextures(items: GalleryItem[], anisotropy: number) {
  const loader = new TextureLoader();
  const map = new Map<string, Texture>();
  await Promise.all(
    items.map(async (item) => {
      let tex: Texture;
      if (item.plate) {
        tex = await createPlateTexture(item.plate, anisotropy);
      } else {
        tex = await loader.loadAsync(item.image!);
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = anisotropy;
      }
      map.set(item.id, tex);
    }),
  );
  return map;
}

export async function createGallery(container: HTMLElement, options: GalleryOptions) {
  const { items, ui, reduced } = options;
  const slots = options.slots ?? 36;

  const stage = new ExperienceCanvas(container);
  const textures = await loadTextures(items, stage.maxAnisotropy);
  const gallery = new ProjectGallery3D(items, buildSequence(items, slots), textures);
  const logo = new JustLogo3D();
  logo.group.position.set(0, 0, -1.2);
  stage.scene.add(gallery.group, logo.group);

  const cameraCtl = new CameraController(stage.camera);
  const pointerNdc = new Vector2();
  let hovered: GalleryCard3D | null = null;
  let keyboardFocus: GalleryCard3D | null = null;
  let selected: GalleryCard3D | null = null;
  let activeId: string | null = null;
  let frame = 0;
  let mode: GalleryMode = 'rings';
  let morphTween: gsap.core.Tween | null = null;

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
    const tl = gsap.timeline({
      onComplete: () => {
        window.location.href = card.item.href;
      },
    });
    tl.to(gallery.cards.filter((c) => c !== card), { fade: 0, duration: 0.55, ease: 'power2.out' }, 0)
      .to(logo, { fade: 0, duration: 0.6, ease: 'power2.out' }, 0)
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

  stage.add({
    update(dt, time) {
      input.update(dt);
      const { rings, spiral } = gallery.layouts;
      cameraCtl.update(dt, rings.camera, spiral.camera, gallery.morph, selected ? { x: 0, y: 0 } : input.pointer, reduced);
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

      gallery.update(dt, time, input.current, input.velocity, stage.camera, reduced);
      logo.update(dt, time, input.pointer, input.velocity, reduced);

      const dimTarget = hovered || keyboardFocus ? 0.75 : 0;
      gallery.shared.uDim.value += (dimTarget - gallery.shared.uDim.value) * damp(8, dt);

      // Hover hit-test (mouse only, not while dragging or transitioning).
      if (!selected && input.client.inside && !input.dragging && matchMedia('(hover: hover)').matches) {
        pointerNdc.set(input.pointer.x, input.pointer.y);
        const hit = gallery.hitTest(pointerNdc, stage.camera);
        if (hit !== hovered) {
          if (hit) keyboardFocus = null;
          setHovered(hit);
          setCursorOverride(hit ? 'view' : 'drag', hit ? 'VIEW' : 'DRAG');
        }
        if (hit) ui.onHover(hit.item, input.client.x, input.client.y);
        else ui.onHover(null, 0, 0);
      } else if (!selected && input.dragging) {
        setCursorOverride('drag', '← →');
        ui.onHover(null, 0, 0);
      }

      if (++frame % 6 === 0 && !selected) {
        const front = gallery.frontmost(stage.camera);
        const id = front?.item.id ?? null;
        if (id !== activeId) {
          activeId = id;
          ui.onActive(front?.item ?? null);
        }
      }
    },
  });

  container.addEventListener('pointerleave', () => {
    if (selected) return;
    setHovered(null);
    setCursorOverride(null);
    ui.onHover(null, 0, 0);
  });

  const setMode = (next: GalleryMode) => {
    if (next === mode || selected) return;
    mode = next;
    ui.onModeChange(mode);
    morphTween?.kill();
    morphTween = gsap.to(gallery, {
      morph: mode === 'spiral' ? 1 : 0,
      duration: reduced ? 0.01 : 1.7,
      ease: 'none',
    });
  };

  /** Rotate the gallery so the given item faces front (keyboard / list focus). */
  const focusItem = (id: string) => {
    if (selected) return;
    input.target = gallery.focusScrollFor(id, input.current);
    const card = gallery.cards
      .filter((c) => c.item.id === id)
      .sort((a, b) => {
        const la = gallery.dominantLayout;
        return Math.abs(la.focusScroll(a.slot, input.current) - input.target) - Math.abs(la.focusScroll(b.slot, input.current) - input.target);
      })[0];
    keyboardFocus = card ?? null;
    setHovered(card ?? null);
  };

  const clearFocus = () => {
    keyboardFocus = null;
    setHovered(null);
  };

  const onKey = (e: KeyboardEvent) => {
    if (selected || e.altKey || e.metaKey || e.ctrlKey) return;
    const el = document.activeElement;
    if (el && el !== document.body && !container.contains(el)) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, PageDown: 3, PageUp: -3 }[e.key];
    if (step) {
      e.preventDefault();
      input.nudge(step);
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
    ui.onReset();
  };
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) reset();
  };
  window.addEventListener('pageshow', onPageShow);

  // Intro: cards and logo fade/scale in once textures are ready.
  stage.start();
  gsap.to([gallery, logo], { appear: 1, duration: reduced ? 0.01 : 1.8, ease: 'power2.out', delay: 0.05 });
  if (!reduced) {
    input.current = -2.5;
    input.target = 0;
  }
  ui.onReady();

  return {
    setMode,
    focusItem,
    clearFocus,
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
