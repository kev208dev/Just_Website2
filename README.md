# JUST ATELIER 3.0

**FROM ZERO. TO ANYTHING.** — *A digital gallery of ideas, technology, and creation.*

The website of JUST, an independent creative technology collective, art-directed as a digital
exhibition. The home page is a sequence of six scenes opening on a 3D sculpture of the JUST
wordmark (dark brushed chrome, bronze bevels, studio lighting); the 3D Rings / Spiral gallery of
the club's real works lives at `/explore`.

## Art direction

- **Palette:** Obsidian `#08090B`, Graphite `#28292C`, Bone `#D6D0C5`, Bronze `#C88F47`, Ivory `#F5F3EE`.
  Bronze is reserved for the brand object and key interactions. `.theme-light` re-maps the tokens
  for ivory pages/sections (Awards archive, home Archive scene, About numbers).
- **Type:** Space Grotesk (display, uppercase, tight tracking), Instrument Serif italic (sparse
  editorial accents), Pretendard (Korean/body).
- **Key visuals:** each project has its own poster (16:10) — `tools/keyvisuals/*.html` are HTML
  compositions built only from the project's real screenshots and app content, rendered to
  `public/images/keyvisuals/` by `node tools/keyvisuals/render.mjs`. They share one frame system so the
  five read as a series.

| Project | Direction |
| --- | --- |
| 명준현 게임 | Playful object composition — physics pile, game-over line, real board |
| 명준현 도박장 | Three reels, one bet — oxblood, real reel crops, payout ladder from the code |
| 판교어 듀오링고 | Editorial learning app — dictionary entry and level ladder from the app data |
| JUST 순발력 게임 | Kinetic typography — Stroop colour words, real 3.0s limit and rules |
| JUST 퀴즈 | Touch-first experience — ripple rings, journey path, real start screen |

## Home scenes

1. **Identity** — headline + 3D sculpture (`components/three/brand/LogoStage`). A pre-rendered still
   (`public/images/brand/hero-logo*.webp`, `tools/render-hero-poster.mjs`) paints instantly and is the
   no-WebGL fallback; the live canvas fades in over it.
2. **Selected works** — one work per viewport, key visual + giant title, per-project accent.
3. **Manifesto** — "We don't just think. We build."; the section turns from obsidian to ivory on scroll.
4. **JUST Universe** — CSS 3D ring of the five key visuals, entry to `/explore`.
5. **Archive** — verified 2025 records and grand prizes, ivory.
6. **Collective** — members as a typographic wall, then the giant JUST® wordmark footer.

## Performance policy

- One card per real work in `/explore` (no duplicated slots); 5 cards ≈ 10–16 draw calls.
- Render on demand: the rAF loop ticks, but the GPU draws only when something moves (input, inertia,
  morph, hover easing, camera parallax). After the last interaction the logo drifts at 30 fps for 8 s,
  then the scene is fully static (0 renders). The hero stops entirely when scrolled out of view.
- Pixel ratio capped at 1.25 (desktop) / 1.0 (touch), stepping down to 1.0 if frames run slow.
- Hit-testing only on pointer movement or while cards slide under the cursor.
- Card shader: one texture fetch; the velocity curl has a dead zone so browsing stays perfectly flat.
- Measured with SwiftShader (relative numbers): 2.0 home 5.7/5.6/6.1 fps (idle/scroll/hover, 1440)
  → 3.0 explore 9.7/9.1/11.4 fps; at 390px 9.7/12.2/14.2 → 39.5/23.6/30.8 fps.

- Live (once Pages is enabled): https://kev208dev.github.io/Just_Website2/
- Legacy site (unchanged, content source): https://github.com/kev208dev/JustWebsite

## Stack

| Area | Choice |
| --- | --- |
| Framework | Astro 7 (static output), TypeScript (strict) |
| 3D | Three.js r186, custom GLSL shaders |
| Motion | GSAP 3 (+ ScrollTrigger, Flip), CSS view transitions |
| Styling | CSS custom properties + component-scoped CSS |
| Data | Astro content collections (JSON `file()` loader) |
| Fonts | Space Grotesk (Fontsource), Pretendard Variable — self-hosted |
| Deploy | GitHub Actions → GitHub Pages (`base: /Just_Website2/`) |

## Commands

```sh
npm ci            # install
npm run dev       # dev server → http://localhost:4321/Just_Website2/
npm run check     # astro check (TypeScript + .astro diagnostics)
npm run build     # production build → dist/
npm run preview   # serve dist/ under the production base path
```

Node 22.12+ is required (Astro 7).

## Structure

```
src/
  pages/                 index, explore, work/, work/[slug], about, people, awards, contact, 404
  layouts/BaseLayout     head/meta, header, footer, cursor, global script
  components/
    three/               the WebGL experience (see below)
    home/                home scenes (Hero … Collective) + ExploreExperience (/explore UI, 2D fallback)
    navigation/          Header (desktop + mobile menu), Footer
    motion/              Cursor, RevealText (mask line reveal)
    ui/                  PageHero
  content/               projects / members / awards / archive / site JSON
  content.config.ts      collection schemas
  lib/                   data helpers (cross-linking), paths (base-aware), motion tokens
  scripts/               client scripts per page (home, works, project, people, awards, …)
  styles/                tokens.css (design + motion tokens), base.css
public/images/           key visuals, hero stills, project screenshots (WebP), brand assets
tools/                   key-visual posters + renderers, logo tracer, data migration
```

### 3D architecture (`src/components/three`)

| Module | Responsibility |
| --- | --- |
| `ExperienceCanvas` | Renderer, scene, camera, environment map, frame loop, DPR cap, resize, visibility pause, disposal |
| `GalleryController` | Orchestrates everything: texture loading, input → scroll, hover raycast, mode morph, click-to-zoom transition, keyboard, bfcache reset |
| `ProjectGallery3D` | One card per work; blends Rings/Spiral poses with a staggered morph; hit-testing; orbit guides |
| `GalleryCard3D` | One card: pose application, hover lift, focus (full-screen) override |
| `layouts/RingsLayout` | A single orbit sized to the number of works, seen from above; concentric guide orbits |
| `layouts/SpiralLayout` | A helix window around the focused work; the loop seam is faded out |
| `brand/LogoAsset`, `brand/StudioEnvironment`, `brand/LogoStage` | Shared wordmark geometry + materials, baked studio PMREM, home hero stage |
| `CameraController` | Camera blend between layout presets + pointer parallax |
| `InputController` | Wheel / drag / touch with inertia, tap-vs-drag detection |
| `JustLogo3D` | The wordmark at the centre of `/explore` |
| `materials/DistortionMaterial` + `shaders/` | Cover-fit UVs, rounded corners, depth fade, subtle velocity curl only while moving fast |

The logo geometry comes from `tools/trace-logo.py`, which traces the original
`just-logo-transparent.png` into polygons (`logo-shape.json`) so the 3D mark matches the real logo.

### Fallbacks & accessibility

- No WebGL2, a WebGL error, or `?mode=2d` → the hero keeps its pre-rendered still and `/explore` shows a 2D grid of key visuals. Without JS the same fallbacks apply.
- `prefers-reduced-motion`: no idle motion, inertia, distortion or long transitions.
- Keyboard: arrow keys move the `/explore` gallery one work at a time; the index list is focusable and focusing an
  item brings it to the front. All interactive elements have visible focus styles.
- The custom cursor is desktop-only (`hover: hover` and `pointer: fine`).

## Content & data review

Content was migrated from the legacy repository; nothing was invented. Items to confirm:

1. **Duplicate award rows.** Legacy `data/awards.json` lists the same 19 records twice (year 2024 and 2025).
   The legacy site displayed them as a single "2025 수상 아카이브 · 19 records" block, so they are merged
   into 19 records with year 2025 (`tools/migrate-awards.mjs`).
2. **Archive records (39)** come from the legacy "2024 프로젝트 아카이브" block: title and grade only, no
   year/institution/members.
3. **Member name mismatches:** `김정휘` (members.json) vs `김청휘` (legacy page) — the page version is used;
   `아!미르!`/`구석기` vs `아미르`/`One Flap` — the page version is used.
4. **Dept codes** (HD, WP, DC, EB) are shown as-is; their meaning isn't documented in the source.
5. **Prize money** (4,750만원) is the 2025 total stated on the legacy site; there is no per-award amount data.
6. **Project credits** (members, process, outcomes) aren't in the source data, so those fields are hidden.
   Project years come from the first commit of each public repo; JUST 순발력 게임 / JUST 퀴즈 have no year.
   `https://부스.kro.kr/` (JUST 퀴즈) wasn't reachable during migration.
7. Award participants who aren't in the members list (e.g. 정하은, 한준혁) are shown as plain text.
8. Student IDs from the legacy members.json are intentionally not published.

## Deployment

`.github/workflows/deploy.yml` builds on every push to `main` and deploys `dist/` to GitHub Pages.
Enable it once in **Settings → Pages → Build and deployment → Source: GitHub Actions**.
