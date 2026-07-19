#!/usr/bin/env python3
"""ralph_compare.py — 시안 vs 캡처 픽셀 비교 (ralph.js가 호출)

usage: python3 ralph_compare.py <ref.png> <web.png> <cropTop> <outdir> <name>
stdout: JSON {size, quadrants[], blurredPct, blurredPct50, triptychs[]}
"""
import sys, os, json
from PIL import Image, ImageFilter
import numpy as np

ref_p, web_p, crop_top, outdir, name = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5]
ROWS, COLS, THR, TOP_N = 8, 2, 25, 4

ref = Image.open(ref_p).convert("RGB")
if crop_top:
    ref = ref.crop((0, crop_top, ref.width, ref.height))
web = Image.open(web_p).convert("RGB")

out = {"name": name, "refSize": list(ref.size), "webSize": list(web.size),
       "sizeMatch": ref.size == web.size}

W, H = min(ref.width, web.width), min(ref.height, web.height)
ref_c, web_c = ref.crop((0, 0, W, H)), web.crop((0, 0, W, H))

# ---- raw quadrant diff ----
ra = np.asarray(ref_c, dtype=np.int16)
wa = np.asarray(web_c, dtype=np.int16)
diff = np.abs(ra - wa).max(axis=2)

quads = []
th, tw = H // ROWS, W // COLS
for r in range(ROWS):
    for c in range(COLS):
        y0, x0 = r * th, c * tw
        y1 = H if r == ROWS - 1 else (r + 1) * th
        x1 = W if c == COLS - 1 else (c + 1) * tw
        d = diff[y0:y1, x0:x1]
        quads.append({"tag": f"r{r+1}c{c+1}", "y": [y0, y1], "x": [x0, x1],
                      "pct": round(float((d > THR).mean() * 100), 2),
                      "mean": round(float(d.mean()), 2)})
quads.sort(key=lambda q: -q["pct"])
out["quadrants"] = quads

# ---- blurred structural diff (폰트 AA 노이즈 제거) ----
rb = np.asarray(ref_c.filter(ImageFilter.GaussianBlur(2)), dtype=np.int16)
wb = np.asarray(web_c.filter(ImageFilter.GaussianBlur(2)), dtype=np.int16)
bd = np.abs(rb - wb).max(axis=2)
out["blurredPct"] = round(float((bd > 25).mean() * 100), 2)
out["blurredPct50"] = round(float((bd > 50).mean() * 100), 3)

# per-quadrant blurred (구조 문제 위치 파악용)
bq = []
for q in quads:
    (y0, y1), (x0, x1) = q["y"], q["x"]
    bq.append({"tag": q["tag"], "pct": round(float((bd[y0:y1, x0:x1] > 25).mean() * 100), 2)})
bq.sort(key=lambda q: -q["pct"])
out["blurredQuadrants"] = bq

# ---- triptychs for worst raw tiles ----
os.makedirs(outdir, exist_ok=True)
tris = []
for q in quads[:TOP_N]:
    (y0, y1), (x0, x1) = q["y"], q["x"]
    rt, wt = ref_c.crop((x0, y0, x1, y1)), web_c.crop((x0, y0, x1, y1))
    dmap = Image.fromarray(np.uint8(np.clip(diff[y0:y1, x0:x1], 0, 255)))
    heat = Image.merge("RGB", (dmap, Image.new("L", dmap.size, 0), Image.new("L", dmap.size, 0)))
    w, h = rt.size
    canvas = Image.new("RGB", (w * 3 + 20, h), "white")
    canvas.paste(rt, (0, 0)); canvas.paste(wt, (w + 10, 0)); canvas.paste(heat, (2 * w + 20, 0))
    path = os.path.join(outdir, f"{name}_{q['tag']}.png")
    canvas.save(path)
    tris.append(path)
out["triptychs"] = tris

print(json.dumps(out))
