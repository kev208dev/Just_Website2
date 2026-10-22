import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  type WebGLRenderer,
} from "three";
import type { GalleryItem } from "../types";

const loader = new TextureLoader();
const cache = new Map<string, Promise<Texture>>();

function prepare(texture: Texture, renderer: WebGLRenderer) {
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}

/** Loads (and caches) an image texture. Rejects on network/decoding failure. */
export function loadImageTexture(url: string, renderer: WebGLRenderer): Promise<Texture> {
  let pending = cache.get(url);
  if (!pending) {
    pending = loader.loadAsync(url).then((t) => prepare(t, renderer));
    cache.set(url, pending);
    pending.catch(() => cache.delete(url));
  }
  return pending;
}

const FONT_DISPLAY = '"Space Grotesk Variable", "Space Grotesk", "Pretendard Variable", Pretendard, system-ui, sans-serif';
const FONT_TEXT = '"Pretendard Variable", Pretendard, "Space Grotesk Variable", system-ui, sans-serif';

/**
 * Typographic card for projects that have no screenshot yet. Only real data is
 * printed: title, category, year and summary.
 */
export async function createTypographicTexture(item: GalleryItem, renderer: WebGLRenderer): Promise<Texture> {
  const W = 1280;
  const H = 800;
  try {
    await Promise.all([
      document.fonts.load(`700 120px ${FONT_TEXT}`, item.title),
      document.fonts.load(`500 40px ${FONT_DISPLAY}`, "ARCHIVE 2026"),
    ]);
  } catch {
    /* fall back to system fonts */
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // surface
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#1c1d20");
  g.addColorStop(1, "#0e0f10");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // fine technical grid
  ctx.strokeStyle = "rgba(241,238,232,0.05)";
  ctx.lineWidth = 1;
  for (let x = 80; x < W; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let y = 80; y < H; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }

  // amber orbit mark
  ctx.strokeStyle = "rgba(242,174,69,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W - 170, 170, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#F2AE45";
  ctx.beginPath();
  ctx.arc(W - 170 + 70, 170, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#F2AE45";
  ctx.font = `500 34px ${FONT_DISPLAY}`;
  ctx.textBaseline = "alphabetic";
  const meta = [item.category.toUpperCase(), item.year ? String(item.year) : null].filter(Boolean).join("  ·  ");
  ctx.fillText(meta, 80, 120);

  // title — shrink to fit
  ctx.fillStyle = "#F1EEE8";
  let size = 150;
  do {
    ctx.font = `700 ${size}px ${FONT_TEXT}`;
    size -= 6;
  } while (ctx.measureText(item.title).width > W - 160 && size > 60);
  ctx.fillText(item.title, 76, H - 250);

  ctx.fillStyle = "rgba(241,238,232,0.62)";
  ctx.font = `400 38px ${FONT_TEXT}`;
  wrapText(ctx, item.summary, 80, H - 170, W - 160, 52, 2);

  ctx.fillStyle = "rgba(241,238,232,0.4)";
  ctx.font = `500 26px ${FONT_DISPLAY}`;
  ctx.fillText("JUST — ARCHIVE ENTRY", 80, H - 64);

  return prepare(new CanvasTexture(canvas), renderer);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const chars = Array.from(text);
  let line = "";
  let lines = 0;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines++;
      line = ch;
      if (lines >= maxLines) return;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
}

/** Forget cached textures (call after the renderer that used them is disposed). */
export function clearTextureCache() {
  cache.clear();
}

/** A tiny 1×1 placeholder so materials can exist before their image arrives. */
export function placeholderTexture(): Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 2;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#141517";
  ctx.fillRect(0, 0, 2, 2);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
