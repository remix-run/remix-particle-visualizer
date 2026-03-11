import type { ParticleFn } from "./types";

export interface MorphState {
  value: number;
  playing: boolean;
  speed: number;
  direction: 1 | -1;
}

export function createMorphState(): MorphState {
  return {
    value: 0,
    playing: false,
    speed: 0.3,
    direction: 1,
  };
}

export function tickAutoPlay(state: MorphState, dt: number): number {
  if (!state.playing) return state.value;

  state.value += state.direction * state.speed * dt;

  if (state.value >= 3) {
    state.value = 3;
    state.direction = -1;
  } else if (state.value <= 0) {
    state.value = 0;
    state.direction = 1;
  }

  return state.value;
}

export function getMorphBlend(morphValue: number): {
  fromIndex: number;
  toIndex: number;
  blend: number;
} {
  const clamped = Math.max(0, Math.min(3, morphValue));
  const fromIndex = Math.min(Math.floor(clamped), 2);
  const toIndex = fromIndex + 1;
  const blend = clamped - fromIndex;

  if (clamped >= 3) {
    return { fromIndex: 3, toIndex: 3, blend: 0 };
  }

  return { fromIndex, toIndex, blend };
}

export function getActiveFunctions(
  compiledPresets: ParticleFn[],
  morphValue: number,
): { fnA: ParticleFn; fnB: ParticleFn | null; blend: number } {
  const { fromIndex, toIndex, blend } = getMorphBlend(morphValue);

  if (blend < 0.001) {
    return { fnA: compiledPresets[fromIndex], fnB: null, blend: 0 };
  }

  return {
    fnA: compiledPresets[fromIndex],
    fnB: compiledPresets[toIndex],
    blend,
  };
}

export function getNearestStop(morphValue: number): number {
  return Math.round(Math.max(0, Math.min(3, morphValue)));
}
