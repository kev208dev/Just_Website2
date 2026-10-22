# JUST Website 2.0 — JUST Digital Atelier

> **From zero. To anything.**
> An independent creative technology collective.

The next-generation website of the JUST club: a real-time Three.js gallery on the
home page, an editorial project archive, and member / awards archives — all built
from the content of the original site ([kev208dev/JustWebsite](https://github.com/kev208dev/JustWebsite)).

**Live:** https://kev208dev.github.io/Just_Website2/ (after GitHub Pages is enabled — see _Deployment_)

## Stack

| Layer | Choice |
| --- | --- |
| Framework | [Astro 5](https://astro.build) (static output) |
| Language | TypeScript (strict) |
| 3D | [Three.js](https://threejs.org) r180 + custom GLSL |
| Motion | [GSAP](https://gsap.com) (ScrollTrigger, Flip) + Astro view transitions |
| Styling | CSS custom properties + scoped component CSS |
| Fonts | Space Grotesk (variable), Pretendard (variable, dynamic subset) |
| Deploy | GitHub Actions → GitHub Pages |

No UI framework is used; interactive parts are small TypeScript modules.

## Getting started

```sh
npm install
npm run dev        # http://localhost:4321/Just_Website2/
npm run build      # astro check + astro build → dist/
npm run preview
```

The site is served from a sub path. `astro.config.mjs` reads `BASE_PATH`
(default `/Just_Website2/`); CI derives it from the repository name.

## Project structure

```
src/
├── components/
│   ├── three/                 # the 3D home experience (framework agnostic TS)
│   │   ├── ExperienceCanvas.ts   renderer, scene, loop, selection sequence
│   │   ├── JustLogo3D.ts         extruded metallic logo (traced from the original artwork)
│   │   ├── ProjectGallery3D.ts   cards + rings/spiral blending + picking
│   │   ├── GalleryCard3D.ts      one card: mesh + animation state
│   │   ├── GalleryController.ts  scroll physics, inertia, snapping, mode morph
│   │   ├── CameraController.ts   framing per mode, parallax, responsive fit
│   │   ├── InputController.ts    wheel / drag / touch / keyboard, click vs drag
│   │   ├── layouts/              RingsLayout, SpiralLayout
│   │   ├── materials/            DistortionMaterial (velocity driven)
│   │   └── shaders/              card.vert.glsl, card.frag.glsl
│   ├── navigation/            Header, Footer
│   ├── motion/                Cursor
│   └── projects/              ProjectThumb (shared-element transitions)
├── data/                      projects.json, members.json, awards.json, practices.json
├── layouts/BaseLayout.astro
├── lib/                       data access, base-aware paths, site constants, motion tokens
├── pages/                     index, work/, work/[slug], about, people, awards, contact, 404
├── scripts/                   page scripts (home, works, people, awards, motion, easter eggs)
└── styles/                    tokens.css, global.css, home.css
public/
├── images/                    brand, projects, easter
└── models/just-logo.svg       vector outline used for the 3D logo
tools/                         content migration + local QA helpers (not part of the build)
```

## The home gallery

- **Rings** (default): three orbits around the logo; the middle "reading" ring defines the active project.
- **Spiral**: the same cards re-arranged as a vortex along the view axis — scrolling travels through it.
- **Morphing**: switching modes interpolates every card's position (lerp), rotation (slerp) and scale with a staggered ease, while the camera moves between framings. Cards are never recreated or hidden.
- **Input**: wheel/trackpad, mouse drag, touch swipe and arrow keys, with damped inertia and snapping. A press only becomes a drag after 6 px, so clicks never misfire.
- **Distortion**: scroll / drag velocity bends the cards in the vertex shader and adds a subtle chromatic split; everything eases back at rest.
- **Selection**: the clicked card travels to the centre and fills the view while the rest fade, then hands over to the detail page hero through a shared-element view transition.
- **Fallback**: without WebGL (or with `?2d`) a regular 2D project grid is shown. `prefers-reduced-motion` disables idle motion, distortion and long transitions.

## Content

All content lives in `src/data/*.json` and is referenced by slug / id — nothing
is duplicated across pages. Only information present in the original site (or
visible in the linked projects themselves) is used; empty fields are hidden.

- `tools/migrate-awards.py` rebuilds `awards.json` from the original repository.
- `tools/trace-logo.py` vectorises the original logo PNG into `public/models/just-logo.svg`.

## Deployment

`.github/workflows/deploy.yml` builds on every push to `main` (`astro check` + `astro build`),
publishes the output to the `build-preview` branch for inspection, and deploys to
GitHub Pages.

To go live, enable Pages once: **Settings → Pages → Build and deployment → Source: GitHub Actions**,
then re-run the workflow (or push to `main`).
