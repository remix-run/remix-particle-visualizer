# Remix Particle Visualizer

A full-screen 3D particle visualizer powered by Remix, Vite, React, Tailwind CSS, and Three.js.

The app stays a single-page browser experience. Remix owns the route contract and production
Fetch-based server, while Vite builds and serves the React client.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Start the Vite development server with the Remix SPA fallback:

```bash
pnpm dev
```

Your application will be available at `http://localhost:5173`.

## Production

Create a production build:

```bash
pnpm build
```

Start the Remix server:

```bash
pnpm start
```

The server listens on `PORT` or `3000` by default and serves `build/client` through Remix
`fetch-router` middleware.

## Model Assets

Source GLBs can be baked to `.pts` files with:

```bash
pnpm bake
```

Those generated model assets are served from `public/models` when present, with procedural
fallbacks in the visualizer when they are not.
