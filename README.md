# JUST Website 2.0 — JUST Digital Atelier

**FROM ZERO. TO ANYTHING.**
The next-generation website of JUST, an independent creative technology collective.
The homepage is a real-time Three.js gallery: the JUST wordmark extruded in amber metal at the
centre, with the club's real projects and award records orbiting it on 3D rings or a spiral.

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
  pages/                 index, work/, work/[slug], about, people, awards, contact, 404
  layouts/BaseLayout     head/meta, header, footer, cursor, global script
  components/
    three/               the WebGL experience (see below)
    home/                HomeExperience — 3D stage + HTML overlay UI + 2D fallback
    navigation/          Header (desktop + mobile menu), Footer
    motion/              Cursor, RevealText (mask line reveal)
    ui/                  PageHero
  content/               projects / members / awards / archive / site JSON
  content.config.ts      collection schemas
  lib/                   data helpers (cross-linking), paths (base-aware), motion tokens
  scripts/               client scripts per page (home, works, project, people, awards, …)
  styles/                tokens.css (design + motion tokens), base.css
public/images/           optimised WebP project shots, brand assets
tools/                   one-off asset/data migration scripts
```

### 3D architecture (`src/components/three`)

| Module | Responsibility |
| --- | --- |
| `ExperienceCanvas` | Renderer, scene, camera, environment map, frame loop, DPR cap, resize, visibility pause, disposal |
| `GalleryController` | Orchestrates everything: texture loading, input → scroll, hover raycast, mode morph, click-to-zoom transition, keyboard, bfcache reset |
| `ProjectGallery3D` | Card set; blends Rings/Spiral poses with a per-card staggered morph; hit-testing; "front-most card" detection |
| `GalleryCard3D` | One card: pose application, hover lift, focus (full-screen) override |
| `layouts/RingsLayout` | Stacked horizontal rings around the logo, camera inside the cylinder |
| `layouts/SpiralLayout` | Tilted helix seen from outside, wrap-around with end fades |
| `CameraController` | Camera blend between layout presets + pointer parallax |
| `InputController` | Wheel / drag / touch with inertia, tap-vs-drag detection |
| `JustLogo3D` | Extruded wordmark (traced from the original logo), metal materials, orbiting rim light |
| `materials/DistortionMaterial` + `shaders/` | Velocity bend, wave, RGB shift, cover-fit UVs, rounded corners, depth fade |
| `textures/plateTexture` | Canvas-drawn "award plates" for real award records |

The logo geometry comes from `tools/trace-logo.py`, which traces the original
`just-logo-transparent.png` into polygons (`logo-shape.json`) so the 3D mark matches the real logo.

### Fallbacks & accessibility

- No WebGL2, a WebGL error, or `?mode=2d` → a regular 2D project grid. Without JS the grid is shown too.
- `prefers-reduced-motion`: no idle motion, inertia, distortion or long transitions.
- Keyboard: arrow keys / PageUp / PageDown rotate the gallery; the index list is focusable and focusing an
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
