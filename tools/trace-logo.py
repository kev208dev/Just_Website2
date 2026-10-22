"""Vectorise the original JUST logo (transparent PNG) into an SVG path.

Usage: python3 -I tools/trace-logo.py <input.png> <output.svg>
The traced outline is used by the Three.js scene to extrude a true 3D logo.
"""
import sys
import cv2
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
img = cv2.imread(src, cv2.IMREAD_UNCHANGED)
alpha = img[:, :, 3]
scale = 4
big = cv2.resize(alpha, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
_, mask = cv2.threshold(big, 127, 255, cv2.THRESH_BINARY)
contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)

def smooth(c, sigma=2.0):
    pts = c[:, 0, :].astype(np.float64)
    n = len(pts)
    r = int(sigma * 3)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    out = np.empty_like(pts)
    for d in range(2):
        padded = np.concatenate([pts[-r:, d], pts[:, d], pts[:r, d]])
        out[:, d] = np.convolve(padded, k, mode="valid")
    return out

paths = []
xs, ys = [], []
for i, c in enumerate(contours):
    if cv2.contourArea(c) < 200 * scale * scale:
        continue
    pts = smooth(c)
    approx = cv2.approxPolyDP(pts.astype(np.float32).reshape(-1, 1, 2), 0.35 * scale, True)[:, 0, :] / scale
    xs += list(approx[:, 0]); ys += list(approx[:, 1])
    d = "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in approx) + " Z"
    paths.append(d)

minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
pad = 4
vb = f"{minx - pad:.2f} {miny - pad:.2f} {maxx - minx + 2 * pad:.2f} {maxy - miny + 2 * pad:.2f}"
svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">\n'
    f'  <title>JUST</title>\n'
    f'  <path fill="#F2AE45" fill-rule="nonzero" d="{" ".join(paths)}"/>\n'
    f"</svg>\n"
)
open(dst, "w").write(svg)
print(len(paths), "contours,", sum(p.count("L") + 1 for p in paths), "points, viewBox", vb)
