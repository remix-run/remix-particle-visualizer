import type { ParticleFn } from "./types";

export function compile(code: string): ParticleFn {
  const fn = new Function(
    "i", "count", "target", "color", "time", "THREE", "addControl", "setInfo", "annotate",
    code
  );
  return fn as ParticleFn;
}
