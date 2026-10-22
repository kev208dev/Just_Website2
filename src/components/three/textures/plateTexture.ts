import { CanvasTexture, SRGBColorSpace } from 'three';

export interface PlateSpec {
  eyebrow: string;
  grade: string;
  title: string;
  subtitle: string;
}

export const PLATE_ASPECT = 1.6;

/**
 * Typographic "award plate" card drawn in brand style. Used for real award
 * records so the gallery mixes works and achievements without inventing
 * imagery.
 */
export async function createPlateTexture(spec: PlateSpec, maxAnisotropy = 1) {
  const w = 1280;
  const h = Math.round(w / PLATE_ASPECT);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  try {
    await Promise.all([
      document.fonts.load('500 64px "Space Grotesk"'),
      document.fonts.load('600 64px "Pretendard Variable"', '대상수여경진대회'),
    ]);
  } catch {
    /* fall back to system fonts */
  }

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#1d1e21');
  bg.addColorStop(1, '#0f1011');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Amber metallic glow in the corner.
  const glow = ctx.createRadialGradient(w * 0.92, h * 0.05, 0, w * 0.92, h * 0.05, w * 0.7);
  glow.addColorStop(0, 'rgba(242,174,69,0.30)');
  glow.addColorStop(1, 'rgba(242,174,69,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const pad = 72;
  ctx.strokeStyle = 'rgba(241,238,232,0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(pad / 2, pad / 2, w - pad, h - pad);

  ctx.fillStyle = '#999999';
  ctx.font = '500 26px "Space Grotesk", sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(spec.eyebrow.toUpperCase().split('').join(String.fromCharCode(8202)), pad, pad);
  ctx.textAlign = 'right';
  ctx.fillText('JUST® AWARDS', w - pad, pad);
  ctx.textAlign = 'left';

  const metal = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.62);
  metal.addColorStop(0, '#fbe0ad');
  metal.addColorStop(0.45, '#f2ae45');
  metal.addColorStop(1, '#b06c1f');
  ctx.fillStyle = metal;
  ctx.font = '700 230px "Pretendard Variable", sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(spec.grade, pad - 8, h * 0.6);

  ctx.fillStyle = '#f1eee8';
  ctx.font = '600 50px "Pretendard Variable", sans-serif';
  wrapText(ctx, spec.title, pad, h * 0.6 + 86, w - pad * 2, 62, 2);

  ctx.fillStyle = '#999999';
  ctx.font = '500 30px "Pretendard Variable", sans-serif';
  ctx.fillText(spec.subtitle, pad, h - pad - 4);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
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
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      line = word;
      if (lines >= maxLines) return;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y + lines * lineHeight);
}
