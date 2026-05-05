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

export type ShaderId =
  | "racetrack"
  | "racecar"
  | "runner"
  | "remixLogo"
  | "mockups"
  | "racetrackCar";

export interface Preset {
  name: string;
  shaderId: ShaderId;
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
  particleCount: 129000,
  pointSize: 0.2,
  backgroundColor: "#000000",
  bloomStrength: 0.7,
  bloomThreshold: 0,
  dofAmount: 0.5,
  dofFocus: 80,
  cameraFov: 60,
  glowIntensity: 0.50,
  hdrIntensity: 0.5,
  cursorRepulsion: 0.2,
  morphEase: 2.3,
  showFps: true,
  colorMode: 0,
  trailIntensity: 0.16,
};
