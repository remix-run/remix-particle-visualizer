import { ref, type Handle } from "remix/ui";
import { Matrix4, Vector3 } from "three";
import { Engine } from "~/lib/engine";
import { ParticleSystem } from "~/lib/particles";
import { getMorphBlend } from "~/lib/morph";
import { createModelTexture } from "~/lib/model-texture";
import { projectLabels, type ProjectedLabel } from "~/lib/label-projection";
import { MouseSim } from "~/lib/mouse-sim";
import { RestBaker } from "~/lib/rest-baker";
import type { SystemSettings, Preset, ShaderId } from "~/lib/types";
import type { ControlManager } from "~/lib/controls";
import type { ModelData } from "~/lib/model-loader";

const DEFAULT_CAM_POS: [number, number, number] = [0, 30, 80];
const DEFAULT_CAM_TARGET: [number, number, number] = [0, 0, 0];
const CAM_LERP_SPEED = 0.025;

const SHADER_ID_TO_INT: Record<ShaderId, number> = {
  racetrack: 0,
  racecar: 1,
  runner: 2,
  remixLogo: 3,
  mockups: 4,
  racetrackCar: 5,
};

type PresetRuntimeData = {
  presets: Preset[];
  controls: number[][];
  shaderInts: number[];
  racetrackIndex: number;
  driveIndex: number;
  driveCarPosY: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function setDesiredCameraInto(
  presets: Preset[],
  morphValue: number,
  outPos: Vector3,
  outTarget: Vector3,
) {
  const maxIdx = presets.length - 1;
  const clamped = clamp(morphValue, 0, maxIdx);
  const fromIdx = Math.min(Math.floor(clamped), maxIdx);
  const toIdx = Math.min(fromIdx + 1, maxIdx);
  const blend = clamped - fromIdx;

  const fromPos = presets[fromIdx].cameraPosition ?? DEFAULT_CAM_POS;
  const fromTarget = presets[fromIdx].cameraTarget ?? DEFAULT_CAM_TARGET;
  const toPos = presets[toIdx].cameraPosition ?? DEFAULT_CAM_POS;
  const toTarget = presets[toIdx].cameraTarget ?? DEFAULT_CAM_TARGET;

  outPos.set(
    lerp(fromPos[0], toPos[0], blend),
    lerp(fromPos[1], toPos[1], blend),
    lerp(fromPos[2], toPos[2], blend),
  );
  outTarget.set(
    lerp(fromTarget[0], toTarget[0], blend),
    lerp(fromTarget[1], toTarget[1], blend),
    lerp(fromTarget[2], toTarget[2], blend),
  );
}

function copyControlsInto(source: number[], target: number[]) {
  for (let i = 0; i < 8; i++) target[i] = source[i] ?? 0;
}

function copyManagedControlsInto(
  preset: Preset,
  controlMgr: ControlManager,
  target: number[],
) {
  for (let i = 0; i < 8; i++) {
    const control = preset.controls[i];
    target[i] = control
      ? (controlMgr.controls.get(control.id)?.value ?? control.initial)
      : 0;
  }
}

function buildInitialControls(preset: Preset): number[] {
  const controls = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < Math.min(preset.controls.length, 8); i++) {
    controls[i] = preset.controls[i].initial;
  }
  return controls;
}

function getControlInitial(preset: Preset, id: string, fallback = 0): number {
  return (
    preset.controls.find((control) => control.id === id)?.initial ?? fallback
  );
}

function buildPresetRuntimeData(presets: Preset[]): PresetRuntimeData {
  const driveIndex = presets.findIndex((preset) => preset.name === "Drive");
  return {
    presets,
    controls: presets.map(buildInitialControls),
    shaderInts: presets.map((preset) => SHADER_ID_TO_INT[preset.shaderId]),
    racetrackIndex: presets.findIndex((preset) => preset.name === "Racetrack"),
    driveIndex,
    driveCarPosY:
      driveIndex >= 0
        ? getControlInitial(presets[driveIndex], "_carPosY", 0)
        : 0,
  };
}

interface MutableRef<T> {
  current: T;
}

interface Props {
  settings: SystemSettings;
  controlMgr: ControlManager;
  presets: Preset[];
  morphValue: number;
  modelData: (ModelData | undefined)[];
  onFpsUpdate?: (fps: number) => void;
  onReady?: () => void;
  labelsRef: MutableRef<ProjectedLabel[]>;
  labelOpacityRef: MutableRef<number>;
}

export default function ParticleCanvas(handle: Handle<Props>) {
  const containerRef: MutableRef<HTMLDivElement | null> = { current: null };
  const canvasRef: MutableRef<HTMLCanvasElement | null> = { current: null };
  const engineRef: MutableRef<Engine | null> = { current: null };
  const particlesRef: MutableRef<ParticleSystem | null> = { current: null };
  const settingsRef: MutableRef<SystemSettings> = { current: handle.props.settings };
  const presetsRef: MutableRef<Preset[]> = { current: handle.props.presets };
  const morphValueRef: MutableRef<number> = { current: handle.props.morphValue };
  const fpsFrames: MutableRef<number[]> = { current: [] };
  const controlMgrRef: MutableRef<ControlManager> = { current: handle.props.controlMgr };
  const modelDataRef: MutableRef<(ModelData | undefined)[]> = { current: handle.props.modelData };
  const labelsRefInternal: MutableRef<MutableRef<ProjectedLabel[]>> = { current: handle.props.labelsRef };
  const labelOpInternal: MutableRef<MutableRef<number>> = { current: handle.props.labelOpacityRef };
  const onReadyRef: MutableRef<Props["onReady"]> = { current: handle.props.onReady };
  const onFpsUpdateRef: MutableRef<Props["onFpsUpdate"]> = { current: handle.props.onFpsUpdate };

  let cleanupRenderer: (() => void) | undefined;
  let initializedParticleCount: number | undefined;

  const syncProps = () => {
    settingsRef.current = handle.props.settings;
    presetsRef.current = handle.props.presets;
    morphValueRef.current = handle.props.morphValue;
    controlMgrRef.current = handle.props.controlMgr;
    modelDataRef.current = handle.props.modelData;
    labelsRefInternal.current = handle.props.labelsRef;
    labelOpInternal.current = handle.props.labelOpacityRef;
    onReadyRef.current = handle.props.onReady;
    onFpsUpdateRef.current = handle.props.onFpsUpdate;
  };

  const disposeRenderer = () => {
    cleanupRenderer?.();
    cleanupRenderer = undefined;
    initializedParticleCount = undefined;
  };

  const initRenderer = () => {
    if (cleanupRenderer || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const engine = new Engine();
    const restBakerRefs: { current: RestBaker | null } = { current: null };
    const mouseSimRefs: { current: MouseSim | null } = { current: null };
    const appliedModelSlots = new Set<number>();
    const desiredCameraPos = new Vector3();
    const desiredCameraTarget = new Vector3();
    const scratchViewProj = new Matrix4();
    const scratchCamRight = new Vector3();
    const scratchCamUp = new Vector3();
    const scratchControlsA = [0, 0, 0, 0, 0, 0, 0, 0];
    const scratchControlsB = [0, 0, 0, 0, 0, 0, 0, 0];

    let particles: ParticleSystem | null = null;
    let frameId = 0;
    let startTime = 0;
    let lastFrameNow = 0;
    let frozenTime: number | null = null;
    let previousNearest = -1;
    let presetRuntimeData: PresetRuntimeData | null = null;
    let didReportReady = false;

    let mouseNormX = 0;
    let mouseNormY = 0;
    let prevMouseNormX = 0;
    let prevMouseNormY = 0;
    let mouseVelPrimed = false;
    let mouseNdcSpeedSmoothed = 0;
    let mouseBrushSmoothed = 0;
    let smoothMouseOffsetX = 0;
    let smoothCarLane = 0;
    let prevCarLane = 0;
    let laneActivity = 0;
    let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const MOUSE_RANGE = 1;
    const MOUSE_LERP = 0.04;
    const CAR_LANE_LERP = 0.06;
    const ACTIVITY_DECAY = 0.97;
    const ACTIVITY_GAIN = 20.0;
    const RACETRACK_MOUSE_STRAFE_ATTENUATION = 0.4;
    const RACETRACK_MOUSE_STRAFE_OF_TRACKW = 0.18;
    const MOUSE_SIM_STRENGTH_SCALE = 3900;
    const MOUSE_SIM_REPULSION_REF = 0.2;
    const MOUSE_SIM_PEAK_DISP = 17.0;
    const MOUSE_SIM_FOLLOW_TAU = 10;
    const MOUSE_SIM_NDC_RADIUS = 0.154;
    const MOUSE_SIM_VEL_SMOOTH_TAU = 22;
    const MOUSE_SIM_VEL_GATE = 0.14;
    const MOUSE_SIM_VEL_FULL = 5.5;
    const MOUSE_SIM_BRUSH_SMOOTH_TAU = 14;
    const MOUSE_SIM_PUSH_GAIN =
      MOUSE_SIM_PEAK_DISP / (MOUSE_SIM_STRENGTH_SCALE * MOUSE_SIM_REPULSION_REF);

    function getPresetRuntimeData(presetList: Preset[]) {
      if (presetRuntimeData?.presets === presetList) return presetRuntimeData;
      presetRuntimeData = buildPresetRuntimeData(presetList);
      return presetRuntimeData;
    }

    function syncModelTextures() {
      const restBaker = restBakerRefs.current;
      if (!restBaker) return;

      for (const preset of presetsRef.current) {
        if (
          preset.modelUrl == null ||
          preset.modelSlot == null ||
          appliedModelSlots.has(preset.modelSlot)
        ) {
          continue;
        }

        const model = modelDataRef.current[presetsRef.current.indexOf(preset)];
        if (!model) continue;

        restBaker.setModelTexture(
          preset.modelSlot,
          createModelTexture(model),
          model.positions.length / 3,
        );
        appliedModelSlots.add(preset.modelSlot);
      }
    }

    function setMousePosition(clientX: number, clientY: number) {
      const rect = container.getBoundingClientRect();
      const rw = rect.width > 1e-4 ? rect.width : window.innerWidth;
      const rh = rect.height > 1e-4 ? rect.height : window.innerHeight;
      mouseNormX = ((clientX - rect.left) / rw) * 2 - 1;
      mouseNormY = ((clientY - rect.top) / rh) * 2 - 1;
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      setMousePosition(event.clientX, event.clientY);
    };
    const onMouseMove = (event: MouseEvent) => {
      if (window.PointerEvent) return;
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        return;
      }
      setMousePosition(event.clientX, event.clientY);
    };
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      reduceMotion = motionMedia.matches;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("mousemove", onMouseMove);
    motionMedia.addEventListener("change", onMotionChange);

    try {
      engine.init(canvas, container, settingsRef.current);
      engineRef.current = engine;

      const restBaker = new RestBaker(
        engine.renderer,
        settingsRef.current.particleCount,
      );
      restBaker.setCount(settingsRef.current.particleCount);
      restBakerRefs.current = restBaker;

      particles = new ParticleSystem();
      particles.init(
        engine.scene,
        settingsRef.current.particleCount,
        settingsRef.current.pointSize,
      );
      particles.setRestTextures(
        restBaker.getPosTexture(0),
        restBaker.getColTexture(0),
        restBaker.getPosTexture(1),
        restBaker.getColTexture(1),
      );
      particlesRef.current = particles;
      syncModelTextures();

      const mouseSim = new MouseSim(
        engine.renderer,
        settingsRef.current.particleCount,
      );
      mouseSim.setRestTextures(
        restBaker.getPosTexture(0),
        restBaker.getPosTexture(1),
      );
      mouseSim.setPushGain(MOUSE_SIM_PUSH_GAIN);
      mouseSim.setFollowTau(MOUSE_SIM_FOLLOW_TAU);
      mouseSimRefs.current = mouseSim;
      particles.setDispTexture(mouseSim.getDispTexture());

      startTime = performance.now() / 1000;
      setDesiredCameraInto(
        presetsRef.current,
        morphValueRef.current,
        desiredCameraPos,
        desiredCameraTarget,
      );
      engine.camera.position.copy(desiredCameraPos);
      engine.controls.target.copy(desiredCameraTarget);

      const initialPresetData = getPresetRuntimeData(presetsRef.current);
      const initialIndex = clamp(
        Math.floor(morphValueRef.current),
        0,
        initialPresetData.presets.length - 1,
      );
      copyControlsInto(initialPresetData.controls[initialIndex], scratchControlsA);
      restBaker.bake(
        0,
        initialPresetData.shaderInts[initialIndex],
        scratchControlsA,
        0,
      );
      engine.renderer.compile(engine.scene, engine.camera);
    } catch (error) {
      console.error("Failed to initialize particle renderer:", error);
    }

    const animate = () => {
      const restBaker = restBakerRefs.current;
      const mouseSim = mouseSimRefs.current;
      if (!particles || !restBaker || !mouseSim) return;

      const now = performance.now();
      const time = now / 1000 - startTime;
      const dtSeconds =
        lastFrameNow === 0 ? 1 / 60 : (now - lastFrameNow) / 1000;
      lastFrameNow = now;

      const currentSettings = settingsRef.current;
      const currentPresets = presetsRef.current;
      const presetData = getPresetRuntimeData(currentPresets);
      const currentMorph = morphValueRef.current;

      if (reduceMotion) {
        frozenTime ??= Math.max(time, 3.5);
      } else {
        frozenTime = null;
      }
      const visualTime = frozenTime ?? time;

      engine.updateSettings(currentSettings);
      syncModelTextures();

      const screenScale = engine.getScreenScale();
      particles.setPointSize(currentSettings.pointSize);
      particles.setHdrIntensity(currentSettings.hdrIntensity * screenScale);

      const effectiveMouseNormX = reduceMotion ? 0 : mouseNormX;
      const effectiveMouseNormY = reduceMotion ? 0 : mouseNormY;
      const dtClamp = Math.max(dtSeconds, 1e-4);
      let mouseBrushFactor = 0;

      if (reduceMotion) {
        mouseVelPrimed = false;
        mouseNdcSpeedSmoothed = 0;
        mouseBrushSmoothed = 0;
      } else {
        if (!mouseVelPrimed) {
          prevMouseNormX = effectiveMouseNormX;
          prevMouseNormY = effectiveMouseNormY;
          mouseVelPrimed = true;
        } else {
          const speed = Math.hypot(
            (effectiveMouseNormX - prevMouseNormX) / dtClamp,
            (effectiveMouseNormY - prevMouseNormY) / dtClamp,
          );
          const kVel = 1 - Math.exp(-MOUSE_SIM_VEL_SMOOTH_TAU * dtClamp);
          mouseNdcSpeedSmoothed += (speed - mouseNdcSpeedSmoothed) * kVel;
        }
        prevMouseNormX = effectiveMouseNormX;
        prevMouseNormY = effectiveMouseNormY;
        const span = Math.max(MOUSE_SIM_VEL_FULL - MOUSE_SIM_VEL_GATE, 1e-4);
        const linear = clamp01((mouseNdcSpeedSmoothed - MOUSE_SIM_VEL_GATE) / span);
        const brushTarget = linear * linear * (3 - 2 * linear);
        const kBrush = 1 - Math.exp(-MOUSE_SIM_BRUSH_SMOOTH_TAU * dtClamp);
        mouseBrushSmoothed += (brushTarget - mouseBrushSmoothed) * kBrush;
        mouseBrushFactor = mouseBrushSmoothed;
      }

      particles.setColorMode(currentSettings.colorMode);
      particles.setDof(currentSettings.dofAmount, currentSettings.dofFocus);
      particles.setIntroProgress(
        reduceMotion ? 1.5 : Math.min(visualTime / 3.5, 1.5),
      );
      particles.setTime(visualTime);

      const maxValue = currentPresets.length - 1;
      const { fromIndex, toIndex, blend } = getMorphBlend(
        currentMorph,
        maxValue,
      );

      const nearest = Math.round(clamp(currentMorph, 0, maxValue));
      if (nearest !== previousNearest) {
        previousNearest = nearest;
        controlMgrRef.current.loadPreset(currentPresets[nearest]);
      }

      let separation: number;
      if (blend < 0.001) {
        copyManagedControlsInto(
          currentPresets[fromIndex],
          controlMgrRef.current,
          scratchControlsA,
        );
        copyControlsInto(scratchControlsA, scratchControlsB);
        separation = currentPresets[fromIndex].separation;
      } else {
        copyControlsInto(presetData.controls[fromIndex], scratchControlsA);
        copyControlsInto(presetData.controls[toIndex], scratchControlsB);
        const easedBlend = blend * blend * (3 - 2 * blend);
        separation =
          currentPresets[fromIndex].separation * (1 - easedBlend) +
          currentPresets[toIndex].separation * easedBlend;
      }

      const racetrackIndex = presetData.racetrackIndex;
      const racetrackDist =
        racetrackIndex >= 0 ? Math.abs(currentMorph - racetrackIndex) : 0;
      const departingRacetrack =
        !reduceMotion && racetrackDist > 0.01 && racetrackDist < 1.0;

      if (departingRacetrack) {
        const surge = racetrackDist * racetrackDist * 32;
        if (fromIndex === racetrackIndex) scratchControlsA[7] = surge;
        if (toIndex === racetrackIndex) scratchControlsB[7] = surge;
      }

      let morphT = 0;
      if (blend > 0.001) {
        const ease = currentSettings.morphEase;
        const tk = Math.pow(blend, ease);
        morphT = tk / (tk + Math.pow(1 - blend, ease));
      }
      particles.setBlend(blend);
      particles.setMorphT(morphT);
      particles.setSeparation(separation);

      const overridesA = currentPresets[fromIndex].systemOverrides;
      const overridesB = currentPresets[toIndex].systemOverrides;
      const easedBlend = blend * blend * (3 - 2 * blend);
      const effectiveTrail =
        (1 - easedBlend) *
          (overridesA?.trailIntensity ?? currentSettings.trailIntensity) +
        easedBlend * (overridesB?.trailIntensity ?? currentSettings.trailIntensity);
      const effectiveRepulsion =
        (1 - easedBlend) *
          (overridesA?.cursorRepulsion ?? currentSettings.cursorRepulsion) +
        easedBlend * (overridesB?.cursorRepulsion ?? currentSettings.cursorRepulsion);
      const trailBoost = departingRacetrack
        ? Math.sin(racetrackDist * Math.PI) * 0.75
        : 0;
      engine.afterImagePass.uniforms.damp.value = reduceMotion
        ? 0
        : Math.min(effectiveTrail + trailBoost, 0.97);

      const driveIndex = presetData.driveIndex;
      const racetrackFogDist =
        racetrackIndex >= 0 ? Math.abs(currentMorph - racetrackIndex) : Infinity;
      const driveFogDist =
        driveIndex >= 0 ? Math.abs(currentMorph - driveIndex) : Infinity;
      const fogProximity = Math.max(
        0,
        1 - Math.min(racetrackFogDist, driveFogDist),
      );
      const fogModeValue =
        blend < 0.001
          ? (controlMgrRef.current.controls.get("_fogMode")?.value ?? 0)
          : lerp(scratchControlsA[4], scratchControlsB[4], easedBlend);
      particles.setFog(fogModeValue > 0.5 ? fogProximity : 0, 10, 180);

      const driveProximity =
        driveIndex >= 0 ? clamp01(1 - Math.abs(currentMorph - driveIndex)) : 0;
      const racetrackRoadLock =
        racetrackIndex >= 0
          ? clamp01(1 - racetrackDist) * (1 - driveProximity)
          : 0;

      if (!reduceMotion && driveProximity > 0) {
        smoothCarLane += (effectiveMouseNormX - smoothCarLane) * CAR_LANE_LERP;
      } else {
        smoothCarLane += (0 - smoothCarLane) * CAR_LANE_LERP;
      }

      const laneDelta = Math.abs(smoothCarLane - prevCarLane);
      laneActivity = Math.max(
        laneActivity * ACTIVITY_DECAY,
        clamp01(laneDelta * ACTIVITY_GAIN),
      );
      prevCarLane = smoothCarLane;

      const carLaneOffset = smoothCarLane * driveProximity;
      const carLaneActivity = laneActivity * driveProximity;
      const carPosYControl = controlMgrRef.current.controls.get("_carPosY");
      const carPosY =
        (carPosYControl?.value ?? presetData.driveCarPosY) * driveProximity;
      restBaker.setCarUniforms(carLaneOffset, carLaneActivity, carPosY);

      restBaker.bake(
        0,
        presetData.shaderInts[fromIndex],
        scratchControlsA,
        visualTime,
      );
      if (blend > 0.001) {
        restBaker.bake(
          1,
          presetData.shaderInts[toIndex],
          scratchControlsB,
          visualTime,
        );
      }

      engine.controls.enabled = !reduceMotion && driveProximity < 0.5;
      setDesiredCameraInto(
        currentPresets,
        currentMorph,
        desiredCameraPos,
        desiredCameraTarget,
      );

      const onPreset = Math.abs(currentMorph - Math.round(currentMorph)) < 0.01;
      if (onPreset) {
        const camCtrl = controlMgrRef.current.controls.get("_camPosX");
        if (camCtrl) {
          desiredCameraPos.set(
            camCtrl.value,
            controlMgrRef.current.controls.get("_camPosY")!.value,
            controlMgrRef.current.controls.get("_camPosZ")!.value,
          );
          desiredCameraTarget.set(
            controlMgrRef.current.controls.get("_camTgtX")!.value,
            controlMgrRef.current.controls.get("_camTgtY")!.value,
            controlMgrRef.current.controls.get("_camTgtZ")!.value,
          );
        }
      }

      if (reduceMotion) {
        engine.camera.position.copy(desiredCameraPos);
        engine.controls.target.copy(desiredCameraTarget);
      } else {
        engine.camera.position.lerp(desiredCameraPos, CAM_LERP_SPEED);
        engine.controls.target.lerp(desiredCameraTarget, CAM_LERP_SPEED);
      }

      const parallaxScale = 1 - driveProximity;
      smoothMouseOffsetX +=
        (effectiveMouseNormX * MOUSE_RANGE - smoothMouseOffsetX) * MOUSE_LERP;
      if (!reduceMotion) {
        const parallaxUncapped = smoothMouseOffsetX * parallaxScale;
        let parallaxX = parallaxUncapped;
        if (racetrackIndex >= 0 && racetrackRoadLock > 0) {
          const trackW = presetData.controls[racetrackIndex][1] ?? 40;
          const strafeCap = trackW * RACETRACK_MOUSE_STRAFE_OF_TRACKW;
          const parallaxRacetrack = clamp(
            parallaxUncapped * RACETRACK_MOUSE_STRAFE_ATTENUATION,
            -strafeCap,
            strafeCap,
          );
          parallaxX = lerp(parallaxUncapped, parallaxRacetrack, racetrackRoadLock);
        }
        engine.camera.position.x += parallaxX;
      }

      engine.controls.update();
      scratchViewProj.multiplyMatrices(
        engine.camera.projectionMatrix,
        engine.camera.matrixWorldInverse,
      );
      const cameraWorld = engine.camera.matrixWorld.elements;
      scratchCamRight.set(cameraWorld[0], cameraWorld[1], cameraWorld[2]).normalize();
      scratchCamUp.set(cameraWorld[4], cameraWorld[5], cameraWorld[6]).normalize();
      mouseSim.setViewProj(scratchViewProj);
      mouseSim.setCamBasis(scratchCamRight, scratchCamUp);
      mouseSim.setMouseNDC(effectiveMouseNormX, -effectiveMouseNormY);
      mouseSim.setBlend(blend);
      mouseSim.setMorphT(morphT);
      mouseSim.setMouseNdcRadius(MOUSE_SIM_NDC_RADIUS * mouseBrushFactor);
      mouseSim.setMouseStrength(
        reduceMotion
          ? 0
          : effectiveRepulsion * MOUSE_SIM_STRENGTH_SCALE * mouseBrushFactor,
      );
      mouseSim.step(dtSeconds);
      particles.setDispTexture(mouseSim.getDispTexture());

      const nearestPreset = currentPresets[nearest];
      if (nearestPreset?.labels && nearestPreset.labels.length > 0) {
        const activeCtrls =
          blend < 0.001
            ? controlMgrRef.current.getControlValues(nearestPreset)
            : presetData.controls[nearest];
        labelsRefInternal.current.current = projectLabels(
          nearestPreset,
          controlMgrRef.current,
          activeCtrls,
          visualTime,
          engine.camera,
          container.clientWidth,
          container.clientHeight,
        );
        const distFromNearest = Math.abs(currentMorph - nearest);
        labelOpInternal.current.current = Math.max(0, 1 - distFromNearest * 4);
      } else {
        labelsRefInternal.current.current = [];
        labelOpInternal.current.current = 0;
      }

      engine.render();

      if (!didReportReady) {
        didReportReady = true;
        onReadyRef.current?.();
      }

      const onFpsUpdate = onFpsUpdateRef.current;
      if (onFpsUpdate) {
        fpsFrames.current.push(now);
        const cutoff = now - 1000;
        while (fpsFrames.current.length > 0 && fpsFrames.current[0] < cutoff) {
          fpsFrames.current.shift();
        }
        onFpsUpdate(fpsFrames.current.length);
      }

      frameId = requestAnimationFrame(animate);
    };

    if (particles && restBakerRefs.current && mouseSimRefs.current && !didReportReady) {
      didReportReady = true;
      onReadyRef.current?.();
    }

    initializedParticleCount = settingsRef.current.particleCount;
    frameId = requestAnimationFrame(animate);

    cleanupRenderer = () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onMouseMove);
      motionMedia.removeEventListener("change", onMotionChange);
      if (particles) particles.dispose(engine.scene);
      mouseSimRefs.current?.dispose();
      restBakerRefs.current?.dispose();
      engine.dispose();
      engineRef.current = null;
      particlesRef.current = null;
    };
  };

  handle.signal.addEventListener("abort", disposeRenderer);

  return () => {
    syncProps();

    if (
      cleanupRenderer &&
      initializedParticleCount !== settingsRef.current.particleCount
    ) {
      handle.queueTask(() => {
        disposeRenderer();
        initRenderer();
      });
    } else {
      handle.queueTask(initRenderer);
    }

    return (
      <div
        mix={ref((node) => {
          containerRef.current = node;
        })}
        className="absolute inset-0"
      >
        <canvas
          mix={ref((node) => {
            canvasRef.current = node;
          })}
          className="block w-full h-full"
        />
      </div>
    );
  };
}
