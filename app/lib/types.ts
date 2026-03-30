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

export interface PresetLabelDef {
  id: string;
  text: string;
  anchor: [number, number, number];
  offset: [number, number];
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
  labels?: PresetLabelDef[];
  labelColor?: string;
  separation: number;
  info: InfoState;
  systemOverrides?: Partial<SystemSettings>;
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
  hdrIntensity: number;
  cursorRepulsion: number;
  morphEase: number;
  showFps: boolean;
  colorMode: number;
  trailIntensity: number;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  particleCount: 160000,
  pointSize: 0.2,
  backgroundColor: "#000000",
  bloomStrength: 0.8,
  bloomThreshold: 0,
  dofAmount: 0,
  dofFocus: 80,
  cameraFov: 60,
  glowIntensity: 0.40,
  hdrIntensity: 1.0,
  cursorRepulsion: 0.2,
  morphEase: 2.3,
  showFps: true,
  colorMode: 0,
  trailIntensity: 0.23,
};
