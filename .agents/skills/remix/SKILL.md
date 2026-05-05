---
name: remix
description: Build and review Remix UI components using `remix/ui`. Use when working on component setup, state, lifecycle, mixins, refs, event handlers, styles, animation, client bootstrapping, or component tests.
---

# Build Remix UI

Use this skill for UI-only Remix work. This repository uses `remix/ui` as the component runtime,
not React. Focus on component behavior, browser lifecycle, and visual correctness.

## What Remix UI Is

Remix UI components are functions that receive a `handle` and return a render function.

- Read current props from `handle.props`.
- Keep local state in setup-scope variables.
- Call `handle.update()` when state changes.
- Use `handle.queueTask(...)` for post-render DOM work.
- Use `handle.signal` to clean up timers, global listeners, observers, and animation loops.
- Use host-element mixins such as `on(...)` and `ref(...)` instead of React props like `onClick`
  and `ref`.

```tsx
import { on, type Handle } from "remix/ui";

export function Counter(handle: Handle<{ label: string }>) {
  let count = 0;

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
}
```

## When To Use This Skill

Use this skill for:

- converting React-style components to `remix/ui`
- component setup, props, local state, lifecycle, context, and update behavior
- browser-only effects, refs, global listeners, timers, observers, and cleanup
- event handlers, forms as DOM interactions, keyboard/pointer behavior, and inline styles
- simple transitions, spring/tween helpers, and `requestAnimationFrame` loops
- client bootstrapping with `createRoot` or hydration with `run`
- component tests and UI verification

## Load Only The References You Need

Each reference starts with a "What This Covers" section. Load the smallest useful set.

| Task involves...                                                   | Start with                                  |
| ------------------------------------------------------------------ | ------------------------------------------- |
| Component setup, state, props, `handle.update`, `queueTask`        | `references/component-model.md`             |
| Event handlers, refs, styles, keyboard/pointer behavior            | `references/mixins-styling-events.md`       |
| Authoring reusable custom mixins                                   | `references/create-mixins.md`               |
| Spring physics, tweens, layout transitions, animation loops        | `references/animate-elements.md`            |
| Client boot, `createRoot`, `run`, browser entry behavior           | `references/hydration-frames-navigation.md` |
| Browser asset paths, client modules, and static asset conventions  | `references/assets-and-browser-modules.md`  |
| Component tests and DOM interaction tests                          | `references/testing-patterns.md`            |

Common bundles:

- **Interactive component** -> component model, mixins and styling
- **Canvas/WebGL or animation-heavy UI** -> component model, animation, mixins and styling
- **Browser app entry or hydration issue** -> hydration/client boot, assets
- **Reusable event/ref behavior** -> create mixins, mixins and styling
- **UI regression or bug** -> component model, testing patterns

## Default Workflow

1. **Classify the UI surface.** Decide whether the change is component state, DOM behavior,
   styling, animation, client boot, or tests.
2. **Start with the component contract.** Identify props, setup-scope state, and which state
   changes require `handle.update()`.
3. **Put browser work in the right phase.** Event handlers can do immediate work; DOM reads/writes
   that need rendered nodes belong in `queueTask(...)` or refs.
4. **Clean up every long-lived effect.** Timers, `requestAnimationFrame`, observers, and global
   listeners must be tied to `handle.signal`.
5. **Use mixins for host behavior.** Prefer `mix={on(...)}`, `mix={ref(...)}`, and custom mixins
   over React-style host props.
6. **Keep props live.** Read `handle.props.foo` inside callbacks when the value can change; do not
   close over a stale destructured prop unless a snapshot is intentional.
7. **Verify in the browser shape that matters.** Run typecheck/build and, for visual or interactive
   work, verify the served app or a component test.

## Project Layout

For this app, keep UI code where the existing app already keeps it:

- `app/components/` for visualizer UI components
- `app/lib/` for visualizer-specific browser helpers and runtime logic
- `app/main.tsx` for client bootstrapping
- `public/` for static assets served by Vite

## Core UI Rules

- Import from `remix/ui`, never from top-level `remix`.
- Remix UI is not React: do not use React hooks, `React.MutableRefObject`, `forwardRef`, or React
  event props in Remix UI components.
- Components receive `handle`; props live on `handle.props`.
- Setup runs once; the returned render function reruns on updates.
- State changes do not rerender implicitly; call `handle.update()`.
- Use `handle.queueTask(...)` for reactive async work and DOM work that should happen after render.
- Use `handle.signal` for cleanup.
- Hydrated/client-entry props must be serializable. Do not pass functions, class instances, or
  opaque runtime objects through serialized hydration boundaries.
- Prefer deriving render-only values in the render function instead of mirroring props into local
  state.
- Prefer stable dimensions and predictable layout for interactive controls so updates do not shift
  UI unexpectedly.

## Testing Defaults

- Use `tsc`/`pnpm typecheck` for API and JSX correctness.
- Use `pnpm build` for Vite and production JSX transform coverage.
- For interactive behavior, render with `createRoot(...)`, interact with the real DOM, and call
  `root.flush()` between assertions.
- For visual behavior, verify the served app in preview/dev and check the specific interaction or
  viewport that changed.
- Prefer one representative component interaction test over broad brittle snapshots.

## Common Mistakes To Avoid

- Treating setup-scope variables like React state and expecting implicit rerenders.
- Destructuring prop values once and then reading stale values inside long-lived callbacks.
- Creating timers, animation frames, observers, or global listeners without cleanup.
- Doing DOM measurement or mutation during render instead of in a ref callback, event handler, or
  queued task.
- Calling `handle.update()` in render unconditionally.
- Using React-only APIs or types in Remix UI components.
- Passing non-serializable values through a hydrated/client-entry boundary.
- Letting animation loops continue after a component is removed.

## UI Package Map

- `remix/ui` — component runtime, `Handle`, `createRoot`, `clientEntry`, `run`, host mixins such as
  `on` and `ref`, and UI utilities.
