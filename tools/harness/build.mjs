// Local harness for iterating on the 3D home page without Astro (no npm registry in the
// sandbox). Bundles src/scripts/home.ts with esbuild against vendored three/gsap and
// renders a page that mirrors src/pages/index.astro.
import { build } from "/opt/npm-tools/node_modules/esbuild/lib/main.js";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const out = path.join(root, "tools/.harness");
const vendor = path.join(root, "tools/vendor");
fs.mkdirSync(out, { recursive: true });

const glslRaw = {
  name: "glsl-raw",
  setup(b) {
    b.onResolve({ filter: /\.glsl\?raw$/ }, (a) => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?raw$/, "")), namespace: "raw" }));
    b.onLoad({ filter: /.*/, namespace: "raw" }, (a) => ({ contents: fs.readFileSync(a.path, "utf8"), loader: "text" }));
  },
};
const alias = {
  name: "alias",
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: path.join(vendor, "three/build/three.module.js") }));
    b.onResolve({ filter: /^three\/examples\/jsm\// }, (a) => ({ path: path.join(vendor, "three", a.path.replace(/^three\//, "")) }));
    b.onResolve({ filter: /^gsap$/ }, () => ({ path: path.join(vendor, "gsap/esm/index.js") }));
    b.onResolve({ filter: /^gsap\/ScrollTrigger$/ }, () => ({ path: path.join(vendor, "gsap/esm/ScrollTrigger.js") }));
    b.onResolve({ filter: /^astro:transitions\/client$/ }, () => ({ path: path.join(root, "tools/harness/astro-stub.ts") }));
  },
};

await build({
  entryPoints: [path.join(root, "src/scripts/home.ts")],
  bundle: true,
  format: "esm",
  splitting: true,
  outdir: path.join(out, "js"),
  sourcemap: true,
  define: { "import.meta.env.BASE_URL": '"/"' },
  plugins: [glslRaw, alias],
  logLevel: "warning",
});

const projects = JSON.parse(fs.readFileSync(path.join(root, "src/data/projects.json"), "utf8"));
const items = projects.map((p, index) => ({
  index, slug: p.slug, title: p.title, category: p.category, year: p.year, summary: p.summary,
  href: `/work/${p.slug}/`, image: p.image ? `/${p.image}` : null,
  imageAspect: p.imageSize ? p.imageSize[0] / p.imageSize[1] : 1.6,
}));

// copy public assets
fs.cpSync(path.join(root, "public"), out, { recursive: true });
for (const f of ["tokens.css", "global.css", "home.css"]) fs.copyFileSync(path.join(root, "src/styles", f), path.join(out, f));

const astro = fs.readFileSync(path.join(root, "src/pages/index.astro"), "utf8");
let body = astro.slice(astro.indexOf("<section"), astro.indexOf("</section>") + "</section>".length);
// resolve the few Astro expressions used in the markup
body = body
  .replace('data-logo={asset("models/just-logo.svg")}', 'data-logo="/models/just-logo.svg"')
  .replace("{SITE.collective}", "An independent creative technology collective.")
  .replace(/\{total\}/g, String(items.length).padStart(2, "0"))
  .replace("href={first.href}", `href="${items[0].href}"`)
  .replace("{first.title}", items[0].title)
  .replace('{[first.category, first.year].filter(Boolean).join(" · ")}', items[0].category)
  .replace(/<nav class="sr-only"[\s\S]*?<\/nav>/, "")
  .replace(/<div class="home-fallback"[\s\S]*?<script type="application\/json"[^>]*\/>/, `<div class="home-fallback" data-fallback hidden></div><script type="application/json" id="gallery-data">${JSON.stringify(items)}</script>`);

fs.writeFileSync(path.join(out, "index.html"), `<!doctype html><html lang="ko" class="js"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JUST harness</title>
<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/home.css">
<style>html.js [data-reveal] .split-line > span{transform:none} html.js [data-reveal]{opacity:1;visibility:visible}</style>
</head><body class="is-home"><main id="main">${body}</main>
<script type="module" src="/js/home.js"></script></body></html>`);
console.log("harness built →", out);
