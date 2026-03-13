import type { ParticleFn } from "./types";
import type { ModelData } from "./model-loader";

const ARGS = [
  "i", "count", "target", "color", "time", "THREE", "addControl", "setInfo", "annotate",
];

export function compile(code: string, modelData?: ModelData): ParticleFn {
  if (modelData) {
    const wrappedCode = [
      "const modelPositions = this._pos;",
      "const modelColors = this._col;",
      code,
    ].join("\n");
    const fn = new Function(...ARGS, wrappedCode);
    return fn.bind({ _pos: modelData.positions, _col: modelData.colors }) as ParticleFn;
  }

  return new Function(...ARGS, code) as ParticleFn;
}
