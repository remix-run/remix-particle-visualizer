import type { Preset } from "./types";

const remixLogo: Preset = {
  name: "Remix Logo",
  modelUrl: "/models/remix-logo.pts",
  modelSlot: 0,
  glowColor: [0.5, 0.5, 0.6],
  separation: 0,
  controls: [
    { id: "scale", label: "Scale", min: 5, max: 80, initial: 60 },
    { id: "rotX", label: "Rotate X", min: -180, max: 180, initial: 0 },
    { id: "rotY", label: "Rotate Y", min: -180, max: 180, initial: 0 },
    { id: "rotZ", label: "Rotate Z", min: -180, max: 180, initial: 0 },
  ],
  info: { title: "Remix Logo", description: "The Remix framework logo as particles" },
};

const racecar: Preset = {
  name: "Racecar",
  modelUrl: "/models/racecar.pts",
  modelSlot: 1,
  glowColor: [0.3, 0.35, 0.55],
  separation: 0,
  controls: [
    { id: "scale", label: "Scale", min: 5, max: 150, initial: 48 },
    { id: "spin", label: "Spin Speed", min: 0, max: 1, initial: 0.2 },
    { id: "shimmer", label: "Shimmer", min: 0, max: 2, initial: 0.6 },
  ],
  info: { title: "Racecar", description: "Race car rendered as a particle cloud" },
};

const racetrack: Preset = {
  name: "Racetrack",
  cameraPosition: [-0.80, -18.60, 81.40],
  cameraTarget: [0, -4.20, -30],
  glowColor: [0.15, 0.25, 0.08],
  separation: 0,
  controls: [
    { id: "speed", label: "Speed", min: 0.1, max: 2, initial: 0.2 },
    { id: "trackW", label: "Track Width", min: 5, max: 60, initial: 40 },
    { id: "curveAmp", label: "Curve Intensity", min: 0, max: 25, initial: 10.25 },
    { id: "hillH", label: "Hill Height", min: 5, max: 40, initial: 7.8 },
    { id: "_fogMode", label: "Fog: Color / Scene", min: 0, max: 1, initial: 1 },
  ],
  cameraControls: [
    { id: "_camPosX", label: "Camera X", min: -80, max: 80, initial: -0.80 },
    { id: "_camPosY", label: "Camera Y", min: -60, max: 60, initial: -18.60 },
    { id: "_camPosZ", label: "Camera Z", min: 10, max: 150, initial: 81.40 },
    { id: "_camTgtX", label: "Look-at X", min: -80, max: 80, initial: 0 },
    { id: "_camTgtY", label: "Look-at Y", min: -60, max: 60, initial: -4.20 },
    { id: "_camTgtZ", label: "Look-at Z", min: -120, max: 60, initial: -30 },
  ],
  info: { title: "Racetrack", description: "A mountain circuit streaming past at speed" },
};

const runner: Preset = {
  name: "Model Kit Runner",
  modelUrl: "/models/model-kit-runner.pts",
  modelSlot: 2,
  glowColor: [0.3, 0.35, 0.55],
  separation: 0,
  controls: [
    { id: "scale", label: "Scale", min: 5, max: 150, initial: 42 },
    { id: "spin", label: "Spin Speed", min: 0, max: 1, initial: 0.20 },
    { id: "shimmer", label: "Shimmer", min: 0, max: 2, initial: 0.5 },
  ],
  info: { title: "Model Kit Runner", description: "Runner figure rendered as a particle cloud" },
};

const tesseract: Preset = {
  name: "4D Tesseract",
  glowColor: [0.35, 0.2, 0.55],
  separation: 0.2,
  controls: [
    { id: "sxw", label: "Rotation XW", min: 0.1, max: 2, initial: 0.5 },
    { id: "syz", label: "Rotation YZ", min: 0.1, max: 2, initial: 0.3 },
    { id: "proj", label: "Projection Dist", min: 1.5, max: 5, initial: 1.5 },
    { id: "dens", label: "Edge Spread", min: 0.5, max: 3, initial: 1.09 },
  ],
  info: { title: "4D Tesseract", description: "Hypercube projected from 4D space" },
};

export const presets: Preset[] = [racetrack, racecar, runner, remixLogo, tesseract];
