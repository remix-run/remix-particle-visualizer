import type { ParticleFn } from "./types";

export interface MorphState {
  value: number;
  playing: boolean;
  speed: number;
  direction: 1 | -1;
  pauseRemaining: number;
}

export function createMorphState(): MorphState {
  return {
    value: 0,
    playing: false,
    speed: 0.3,
    direction: 1,
    pauseRemaining: 0,
  };
}

const PAUSE_DURATION = 2.0;

export function tickAutoPlay(state: MorphState, dt: number, maxValue: number): number {
  if (!state.playing) return state.value;

  if (state.pauseRemaining > 0) {
    state.pauseRemaining -= dt;
    return state.value;
  }

  state.value += state.direction * state.speed * dt;

  if (state.value >= maxValue) {
    state.value = maxValue;
    state.direction = -1;
    state.pauseRemaining = PAUSE_DURATION;
  } else if (state.value <= 0) {
    state.value = 0;
    state.direction = 1;
    state.pauseRemaining = PAUSE_DURATION;
  } else {
    const nearest = Math.round(state.value);
    const dist = Math.abs(state.value - nearest);
    const step = state.speed * dt;
    if (dist < step && nearest > 0 && nearest < maxValue) {
      const prev = state.value - state.direction * step;
      const prevDist = Math.abs(prev - nearest);
      if (prevDist >= step) {
        state.value = nearest;
        state.pauseRemaining = PAUSE_DURATION;
      }
    }
  }

  return state.value;
}

export function getMorphBlend(morphValue: number, maxValue: number): {
  fromIndex: number;
  toIndex: number;
  blend: number;
} {
  const clamped = Math.max(0, Math.min(maxValue, morphValue));
  const fromIndex = Math.min(Math.floor(clamped), maxValue - 1);
  const toIndex = fromIndex + 1;
  const blend = clamped - fromIndex;

  if (clamped >= maxValue) {
    return { fromIndex: maxValue, toIndex: maxValue, blend: 0 };
  }

  return { fromIndex, toIndex, blend };
}

export function getActiveFunctions(
  compiledPresets: ParticleFn[],
  morphValue: number,
): { fnA: ParticleFn; fnB: ParticleFn | null; blend: number } {
  const maxValue = compiledPresets.length - 1;
  const { fromIndex, toIndex, blend } = getMorphBlend(morphValue, maxValue);

  if (blend < 0.001) {
    return { fnA: compiledPresets[fromIndex], fnB: null, blend: 0 };
  }

  return {
    fnA: compiledPresets[fromIndex],
    fnB: compiledPresets[toIndex],
    blend,
  };
}

export function getNearestStop(morphValue: number, maxValue: number): number {
  return Math.round(Math.max(0, Math.min(maxValue, morphValue)));
}
