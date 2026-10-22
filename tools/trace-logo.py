"""Trace the JUST logo bitmap into vector polygons for the 3D extrusion.

Usage: python3 tools/trace-logo.py <logo-transparent.png> <out.json>

Marching squares on the (lightly blurred) alpha channel, then
Ramer-Douglas-Peucker simplification. Output coordinates are normalised so the
logo is centred on the origin with a height of 1 unit and +y pointing up.
"""
import json
import sys

import numpy as np
from PIL import Image, ImageFilter


def marching_squares(field, iso=0.5):
    h, w = field.shape
    tl, tr = field[:-1, :-1], field[:-1, 1:]
    bl, br = field[1:, :-1], field[1:, 1:]
    case = (tl > iso) * 8 + (tr > iso) * 4 + (br > iso) * 2 + (bl > iso) * 1

    def lerp(a, b):
        d = b - a
        d[d == 0] = 1e-9
        return np.clip((iso - a) / d, 0, 1)

    ys, xs = np.mgrid[0 : h - 1, 0 : w - 1]
    top = np.stack([xs + lerp(tl, tr), ys.astype(float)], -1)
    right = np.stack([xs + 1.0, ys + lerp(tr, br)], -1)
    bottom = np.stack([xs + lerp(bl, br), ys + 1.0], -1)
    left = np.stack([xs.astype(float), ys + lerp(tl, bl)], -1)
    edges = {"t": top, "r": right, "b": bottom, "l": left}
    # segment table oriented so filled region is on the left when walking
    table = {
        1: [("l", "b")], 2: [("b", "r")], 3: [("l", "r")], 4: [("r", "t")],
        5: [("l", "t"), ("r", "b")], 6: [("b", "t")], 7: [("l", "t")],
        8: [("t", "l")], 9: [("t", "b")], 10: [("t", "r"), ("b", "l")],
        11: [("t", "r")], 12: [("r", "l")], 13: [("r", "b")], 14: [("b", "l")],
    }
    segments = []
    for c, segs in table.items():
        idx = np.argwhere(case == c)
        for a, b in segs:
            pa = edges[a][idx[:, 0], idx[:, 1]]
            pb = edges[b][idx[:, 0], idx[:, 1]]
            segments.extend(zip(map(tuple, np.round(pa, 4)), map(tuple, np.round(pb, 4))))
    return segments


def link(segments):
    nxt = {}
    for a, b in segments:
        nxt[a] = b
    loops, seen = [], set()
    for start in list(nxt.keys()):
        if start in seen:
            continue
        loop, p = [], start
        while p in nxt and p not in seen:
            seen.add(p)
            loop.append(p)
            p = nxt[p]
        if len(loop) > 8:
            loops.append(np.array(loop))
    return loops


def rdp(points, eps):
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    ab = b - a
    n = np.hypot(*ab) or 1e-9
    rel = points - a
    d = np.abs(ab[0] * rel[:, 1] - ab[1] * rel[:, 0]) / n
    i = int(np.argmax(d))
    if d[i] > eps:
        left = rdp(points[: i + 1], eps)
        right = rdp(points[i:], eps)
        return np.vstack([left[:-1], right])
    return np.vstack([a, b])


def area(poly):
    x, y = poly[:, 0], poly[:, 1]
    return 0.5 * np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y)


def inside(pt, poly):
    x, y = pt
    c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def main(src, out):
    img = Image.open(src).convert("RGBA").split()[-1]
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    alpha = np.pad(np.asarray(img, dtype=float) / 255.0, 2)
    loops = link(marching_squares(alpha))
    polys = []
    for loop in loops:
        # split the closed loop in two halves so RDP keeps both ends
        half = len(loop) // 2
        simplified = np.vstack([rdp(loop[: half + 1], 0.45)[:-1], rdp(np.vstack([loop[half:], loop[:1]]), 0.45)[:-1]])
        if abs(area(simplified)) > 40:
            polys.append(simplified)

    ys = np.concatenate([p[:, 1] for p in polys])
    xs = np.concatenate([p[:, 0] for p in polys])
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    scale = 1.0 / (ys.max() - ys.min())

    outers = [p for p in polys if not any(q is not p and inside(p[0], q) for q in polys)]
    shapes = []
    for o in outers:
        holes = [p for p in polys if p is not o and inside(p[0], o)]
        norm = lambda p: [[round((x - cx) * scale, 5), round(-(y - cy) * scale, 5)] for x, y in p]
        shapes.append({"outer": norm(o), "holes": [norm(h) for h in holes]})
    shapes.sort(key=lambda s: min(pt[0] for pt in s["outer"]))
    data = {"aspect": round(float((xs.max() - xs.min()) * scale), 5), "shapes": shapes}
    with open(out, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"{len(shapes)} shapes, {sum(len(s['outer']) for s in shapes)} points, aspect {data['aspect']}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
