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

export interface PresetControlDef {
  id: string;
  label: string;
  min: number;
  max: number;
  initial: number;
}

export interface Preset {
  name: string;
  modelUrl?: string;
  modelSlot?: number;
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
  glowColor?: [number, number, number];
  controls: PresetControlDef[];
  cameraControls?: PresetControlDef[];
  separation: number;
  info: InfoState;
}

export interface SystemSettings {
  particleCount: number;
  pointSize: number;
  backgroundColor: string;
  bloomStrength: number;
  bloomThreshold: number;
  dofAmount: number;
  dofFocus: number;
  cameraFov: number;
  glowIntensity: number;
  showFps: boolean;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  particleCount: 301000,
  pointSize: 0.1,
  backgroundColor: "#000000",
  bloomStrength: 0.7,
  bloomThreshold: 0,
  dofAmount: 0,
  dofFocus: 80,
  cameraFov: 60,
  glowIntensity: 0.40,
  showFps: true,
};
