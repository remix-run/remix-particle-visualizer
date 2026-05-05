# Remix Particle Visualizer

A full-screen 3D particle visualizer powered by Remix, Vite, React, Tailwind CSS, and Three.js.

The app stays a single-page browser experience. Remix owns the route contract for local SPA
fallback behavior, while Vite builds the static client that GitHub Pages serves.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Start the Vite development server with the Remix SPA fallback:

```bash
pnpm dev
```

Your application will be available at `http://localhost:44100`.

## Preview

Create a production build:

```bash
pnpm build
```

Preview the static build locally:

```bash
pnpm preview
```

The preview server serves `build/client` at `http://127.0.0.1:44100`.

## GitHub Pages

Pushes to `main` deploy through the `Deploy GitHub Pages` workflow. The workflow uses
GitHub's Pages Actions to configure the site, build with the Pages base path, add `404.html`
for SPA fallback behavior, upload `build/client`, and publish the artifact.

## Model Assets

Source GLBs can be baked to `.pts` files with:

```bash
pnpm bake
```

Those generated model assets are served from `public/models` when present, with procedural
fallbacks in the visualizer when they are not.
