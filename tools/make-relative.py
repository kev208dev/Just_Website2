"""Rewrite an Astro build made for base /Just_Website2/ into a relative,
host-anywhere copy (used for the shareable preview). Usage:
python3 -I tools/make-relative.py <dist> <out>"""
import os, re, shutil, sys
src, out = sys.argv[1], sys.argv[2]
BASE = "/Just_Website2/"
shutil.rmtree(out, ignore_errors=True)
shutil.copytree(src, out)

def rel(target, depth):
    prefix = "../" * depth
    path, _, frag = target.partition("#")
    if path == "" or path.endswith("/"):
        path = path + "index.html"
    return prefix + path + ("#" + frag if frag else "")

for root, _, files in os.walk(out):
    for f in files:
        p = os.path.join(root, f)
        r = os.path.relpath(p, out)
        if f.endswith(".html"):
            depth = r.count(os.sep)
            s = open(p, encoding="utf-8").read()
            s = re.sub(re.escape(BASE) + r'([^"\'\s<>)]*)', lambda m: rel(m.group(1), depth), s)
            # Astro's client router resolves swapped-in relative URLs against the old page,
            # so the relative copy uses native cross-document view transitions instead
            s = s.replace('<meta name="astro-view-transitions-enabled" content="true">', "")
            s = s.replace('<meta name="astro-view-transitions-fallback" content="animate">', "")
            s = s.replace("</head>", "<style>@view-transition{navigation:auto}</style></head>", 1)
            # absolute site URLs (canonical / og) are left pointing at GitHub Pages
            s = s.replace("https://kev208dev.github.io" + "../" * depth, "https://kev208dev.github.io/Just_Website2/")
            open(p, "w", encoding="utf-8").write(s)
        elif f.endswith(".css"):
            s = open(p, encoding="utf-8").read()
            s = s.replace("url(" + BASE + "_assets/", "url(")
            open(p, "w", encoding="utf-8").write(s)
        elif f.endswith(".js"):
            s = open(p, encoding="utf-8").read()
            n = s.replace('return"' + BASE + '"+a', 'return new URL("../"+a,import.meta.url).href')
            if BASE in n:
                print("WARN base left in", r)
            open(p, "w", encoding="utf-8").write(n)
# hosts that reserve leading-underscore paths: move _assets/ to assets/
os.rename(os.path.join(out, "_assets"), os.path.join(out, "assets"))
for root, _, files in os.walk(out):
    for f in files:
        if f.endswith((".html", ".js", ".css")):
            p = os.path.join(root, f)
            s = open(p, encoding="utf-8").read()
            open(p, "w", encoding="utf-8").write(s.replace("_assets/", "assets/"))
print("ok")
