"""Playwright screenshot/QA helper.
usage: python3 tools/shoot.py <url> <out.png> [--w 1440 --h 900] [--wait 4000] [--script "js;..."] [--mobile]
Prints console errors and page errors.
"""
import argparse, json, sys
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("url"); ap.add_argument("out")
ap.add_argument("--w", type=int, default=1440); ap.add_argument("--h", type=int, default=900)
ap.add_argument("--wait", type=int, default=4000)
ap.add_argument("--steps", default="[]", help='JSON list: ["wheel:600", "wait:800", "click:x,y", "eval:js", "shot:path", "move:x,y", "drag:x1,y1,x2,y2", "key:ArrowRight"]')
ap.add_argument("--mobile", action="store_true")
ap.add_argument("--full", action="store_true")
ap.add_argument("--reduced", action="store_true")
a = ap.parse_args()

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    ctx_args = dict(viewport={"width": a.w, "height": a.h}, device_scale_factor=1)
    if a.mobile:
        ctx_args.update(is_mobile=True, has_touch=True, device_scale_factor=2)
    if a.reduced:
        ctx_args["reduced_motion"] = "reduce"
    ctx = b.new_context(**ctx_args)
    pg = ctx.new_page()
    logs = []
    pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    pg.on("requestfailed", lambda r: logs.append(f"[requestfailed] {r.url} {r.failure}"))
    pg.on("response", lambda r: logs.append(f"[http {r.status}] {r.url}") if r.status >= 400 else None)
    pg.goto(a.url, wait_until="load")
    pg.wait_for_timeout(a.wait)
    for s in json.loads(a.steps):
        kind, _, arg = s.partition(":")
        if kind == "wheel":
            for _ in range(6): pg.mouse.wheel(0, int(arg) / 6); pg.wait_for_timeout(40)
        elif kind == "wait": pg.wait_for_timeout(int(arg))
        elif kind == "move":
            x, y = map(float, arg.split(",")); pg.mouse.move(x, y, steps=8)
        elif kind == "click":
            x, y = map(float, arg.split(",")); pg.mouse.click(x, y)
        elif kind == "tap":
            x, y = map(float, arg.split(",")); pg.touchscreen.tap(x, y)
        elif kind == "drag":
            x1, y1, x2, y2 = map(float, arg.split(",")); pg.mouse.move(x1, y1); pg.mouse.down(); pg.mouse.move(x2, y2, steps=12); pg.mouse.up()
        elif kind == "key": pg.keyboard.press(arg)
        elif kind == "dblclick":
            x, y = map(float, arg.split(",")); pg.mouse.dblclick(x, y)
        elif kind == "eval":
            try:
                print("eval:", pg.evaluate(arg))
            except Exception:
                pg.wait_for_load_state("load"); pg.wait_for_timeout(1500)
                print("eval(retry):", pg.evaluate(arg))
        elif kind == "shot": pg.screenshot(path=arg, full_page=a.full)
        elif kind == "goto": pg.goto(arg, wait_until="load")
        elif kind == "scrollthrough":
            h = pg.evaluate("document.body.scrollHeight")
            for y in range(0, h, 400):
                pg.evaluate(f"window.scrollTo(0,{y})"); pg.wait_for_timeout(120)
            pg.wait_for_timeout(1500); pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(400)
            print("reveals:", pg.evaluate("document.querySelectorAll('[data-reveal]').length"), "revealed:", pg.evaluate("document.querySelectorAll('.is-revealed').length"))
    pg.screenshot(path=a.out, full_page=a.full)
    print("\n".join(logs[:40]) or "no console errors")
    b.close()
