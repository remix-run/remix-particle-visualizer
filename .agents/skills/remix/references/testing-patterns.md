# UI Testing Patterns

## What This Covers

Testing Remix UI components and browser-owned behavior:

- Rendering components with `createRoot`
- Interacting with real DOM elements
- Flushing updates with `root.flush()`
- Testing timers, global listeners, and cleanup
- Choosing between unit-style component tests and served-app verification

For lifecycle rules, see `component-model.md`. For event and ref behavior, see
`mixins-styling-events.md`.

## Component Tests

Render components into a real DOM node with `createRoot(...)`.

```tsx
import { createRoot } from "remix/ui";
import { test, expect } from "vitest";

import { Counter } from "../app/components/Counter";

test("increments on click", async () => {
  let host = document.createElement("div");
  document.body.append(host);

  let root = createRoot(host);
  root.render(<Counter label="Count" />);
  await root.flush();

  let button = host.querySelector("button");
  expect(button?.textContent).toBe("Count: 0");

  button?.click();
  await root.flush();

  expect(button?.textContent).toBe("Count: 1");

  root.dispose();
  host.remove();
});
```

Use real DOM events (`click`, `dispatchEvent`, `KeyboardEvent`, `PointerEvent`) instead of calling
component internals. This keeps tests aligned with mixin behavior.

## Cleanup Tests

For components that create timers, animation frames, observers, or global listeners, test that
disposing the root stops the effect when the behavior is risky.

```tsx
let root = createRoot(host);
root.render(<Ticker />);
await root.flush();

root.dispose();

// Advance fake timers or dispatch the global event that used to be listened to.
// Assert no update, callback, or thrown error occurs after dispose.
```

Prefer fake timers for timer-driven UI and explicit event dispatches for global listener cleanup.

## Async and Queued Work

When a component uses `handle.queueTask(...)`, call `await root.flush()` after the interaction that
queues the work. If the queued task awaits a promise, resolve that promise and flush again.

```tsx
button.click();
await root.flush();

resolveFetch();
await root.flush();
```

Assert the final DOM state rather than private setup-scope variables.

## Served-App Verification

For changes involving Vite, asset paths, canvas/WebGL, viewport layout, or production transforms,
run the built or dev-served app and verify the actual URLs or interactions.

Useful checks:

- root page returns HTML
- deep link returns HTML for SPA fallback
- real JS/CSS asset returns the asset
- missing JS/CSS/image asset returns 404
- canvas or image assets are visible at the target viewport
- pointer/keyboard controls still work after UI updates

## Common Mistakes

- Forgetting `await root.flush()` after render or interaction.
- Testing setup-scope variables instead of user-observable DOM behavior.
- Leaving mounted roots or DOM nodes behind between tests.
- Using snapshots for highly dynamic UI where a targeted assertion would be clearer.
- Skipping served-app verification for asset, canvas, or production-build changes.
