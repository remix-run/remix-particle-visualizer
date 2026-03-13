import type * as THREE from "three";

export interface ControlDef {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  initial: number;
}

export interface InfoState {
  title: string;
  description: string;
}

export interface AnnotationDef {
  id: string;
  position: THREE.Vector3;
  label: string;
}

export interface Preset {
  name: string;
  code: string;
}

export interface SystemSettings {
  particleCount: number;
  pointSize: number;
  particleSeparation: number;
  backgroundColor: string;
  bloomStrength: number;
  bloomThreshold: number;
  cameraFov: number;
  showFps: boolean;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  particleCount: 20000,
  pointSize: 0.3,
  particleSeparation: 0.40,
  backgroundColor: "#000000",
  bloomStrength: 2.0,
  bloomThreshold: 0.02,
  cameraFov: 60,
  showFps: true,
};

export type ParticleFn = (
  i: number,
  count: number,
  target: THREE.Vector3,
  color: THREE.Color,
  time: number,
  THREE: typeof import("three"),
  addControl: (id: string, label: string, min: number, max: number, initial: number) => number,
  setInfo: (title: string, description: string) => void,
  annotate: (id: string, position: THREE.Vector3, label: string) => void,
) => void;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}
