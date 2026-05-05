# Client Boot and Hydration

## What This Covers

Browser-side Remix UI startup:

- Mounting a client-only app with `createRoot`
- Hydrating client entries with `run`
- Loading component modules in the browser
- Handling app startup errors
- Keeping entry props serializable when using client entries

For component lifecycle, see `component-model.md`. For asset paths and Vite base behavior, see
`assets-and-browser-modules.md`.

## Client-Only Mount

For a Vite app that mounts directly into `index.html`, use `createRoot` from `remix/ui`.

```tsx
import { createRoot } from "remix/ui";

import App from "./App";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing root element");
}

rootElement.replaceChildren();
createRoot(rootElement).render(<App />);
```

Use this shape when the whole experience is browser-owned and already has an HTML shell from Vite.

## Client Entries

Use `clientEntry` when a component needs to be marked as a browser-hydrated entry.

```tsx
import { clientEntry, on, type Handle } from "remix/ui";

export const Counter = clientEntry(
  import.meta.url,
  function Counter(handle: Handle<{ initialCount: number; label: string }>) {
    let count = handle.props.initialCount;

    return () => (
      <button
        mix={on("click", () => {
          count++;
          handle.update();
        })}
      >
        {handle.props.label}: {count}
      </button>
    );
  },
);
```

Client-entry props must be serializable: strings, numbers, booleans, `null`, `undefined`, plain
objects/arrays of serializable values, and JSX that the runtime supports. Do not pass functions,
class instances, DOM nodes, WebGL objects, or other opaque runtime objects through a serialized
entry boundary.

## Booting Hydrated Entries

Use `run` to start the Remix UI browser runtime for hydrated entries. It scans the document,
loads modules, and wires components back to their DOM markers.

```tsx
import { run } from "remix/ui";

let app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl);
    return mod[exportName];
  },
});

app.addEventListener("error", (event) => {
  console.error("Component error:", event.error);
});

await app.ready();
```

### App Methods

- `app.ready()` resolves when initial entries are ready.
- `app.flush()` synchronously flushes pending updates; useful in tests.
- `app.dispose()` tears down hydrated components and aborts their handles.

## Startup Rules

- Keep entry modules small and explicit.
- Put app-wide CSS imports in the main browser entry.
- Throw early when required mount nodes are missing.
- Clear static loading markup before mounting if the runtime app owns the whole root.
- Attach a runtime error listener so component errors are visible during development.
- Do not initialize DOM-dependent libraries until the target node exists.

## Common Mistakes

- Importing `createRoot` from React instead of `remix/ui`.
- Passing callbacks or class instances through client-entry props.
- Running browser startup code from a module that might be imported outside the browser.
- Forgetting `app.dispose()` in tests.
- Leaving duplicate static fallback DOM inside the app root after mounting.
