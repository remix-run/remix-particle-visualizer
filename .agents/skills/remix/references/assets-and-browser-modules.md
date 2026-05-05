# Browser Assets and Modules

## What This Covers

Client-side asset and module conventions for Remix UI apps built with Vite:

- Referencing files from `public/`
- Respecting Vite `base` / `import.meta.env.BASE_URL`
- Keeping asset paths stable for GitHub Pages or subpath deployments
- Importing browser modules from UI components
- Avoiding browser/runtime mismatches in client-only code

For component lifecycle and DOM behavior, see `component-model.md` and
`mixins-styling-events.md`. For client bootstrapping, see `hydration-frames-navigation.md`.

## Public Assets

Files in `public/` are served from the site root after Vite applies the configured base path. Build
asset URLs through a helper instead of hard-coding `/...` when the app may deploy under a subpath.

```ts
function deploymentBase(): string {
  return import.meta.env?.BASE_URL ?? "/";
}

export function publicAssetPath(path: string): string {
  const base = deploymentBase();
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.replace(/^\/+/, "");

  return `${normalizedBase}${normalizedPath}`;
}
```

Use that helper for images, model files, icons, worker URLs, and other static files referenced by
runtime code:

```tsx
<img src={publicAssetPath("remix-logo.svg")} alt="Remix" />
```

## Vite Base Path

When deploying to a subpath, configure Vite's `base` and use `import.meta.env.BASE_URL` for runtime
asset URLs. Avoid manually concatenating the repository name in components.

```ts
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: base.endsWith("/") ? base : `${base}/`,
});
```

In `index.html`, use `%BASE_URL%` for static preloads or fallback markup that Vite transforms:

```html
<link rel="preload" href="%BASE_URL%landing/remix-runner.avif" as="image" />
```

## Client Modules

Browser-only modules can import Web APIs directly when they are only loaded by the browser entry.
For modules that might be evaluated during tooling or tests, guard browser globals:

```ts
if (typeof window !== "undefined") {
  window.addEventListener("resize", onResize);
}
```

For heavy browser libraries such as WebGL, keep initialization inside component setup tasks, refs,
or event handlers so the DOM node exists before the library reads it.

## Asset Fallbacks

For static SPA builds, navigation paths should return the app shell while missing asset-like paths
should return 404. This keeps deep links working without masking broken JS, CSS, image, or model
URLs.

```ts
function looksLikeAsset(pathname: string) {
  return /\.[^/]+$/.test(pathname);
}
```

If a local Vite plugin customizes fallback behavior, verify all of these cases:

- `/` returns HTML
- a deep link such as `/some/deep/path` returns HTML
- a real built JS/CSS asset returns the correct file
- a missing dotted path such as `/assets/not-real.js` returns 404

## Common Mistakes

- Hard-coding root-relative asset paths in code that deploys under a subpath.
- Forgetting that `index.html` uses `%BASE_URL%`, while TypeScript uses
  `import.meta.env.BASE_URL`.
- Blocking real built assets when customizing SPA fallback behavior.
- Letting missing JS/CSS/image URLs return `index.html`, which hides broken references.
- Running DOM-dependent library setup before the target element exists.
