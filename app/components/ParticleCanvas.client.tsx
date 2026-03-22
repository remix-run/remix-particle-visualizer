import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { Engine } from "~/lib/engine";
import { ParticleSystem } from "~/lib/particles";
import { getMorphBlend } from "~/lib/morph";
import { createModelTexture } from "~/lib/model-texture";
import type { SystemSettings, Preset } from "~/lib/types";
import type { ControlManager } from "~/lib/controls";
import type { ModelData } from "~/lib/model-loader";

const DEFAULT_CAM_POS: [number, number, number] = [0, 30, 80];
const DEFAULT_CAM_TARGET: [number, number, number] = [0, 0, 0];
const CAM_LERP_SPEED = 0.025;
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function getDesiredCamera(
  presets: Preset[],
  morphValue: number,
): { pos: THREE.Vector3; target: THREE.Vector3 } {
  const maxIdx = presets.length - 1;
  const clamped = Math.max(0, Math.min(maxIdx, morphValue));
  const fromIdx = Math.min(Math.floor(clamped), maxIdx);
  const toIdx = Math.min(fromIdx + 1, maxIdx);
  const blend = clamped - fromIdx;

  const fromPos = presets[fromIdx].cameraPosition ?? DEFAULT_CAM_POS;
  const fromTarget = presets[fromIdx].cameraTarget ?? DEFAULT_CAM_TARGET;
  const toPos = presets[toIdx].cameraPosition ?? DEFAULT_CAM_POS;
  const toTarget = presets[toIdx].cameraTarget ?? DEFAULT_CAM_TARGET;

  return {
    pos: new THREE.Vector3().lerpVectors(
      new THREE.Vector3(...fromPos),
      new THREE.Vector3(...toPos),
      blend,
    ),
    target: new THREE.Vector3().lerpVectors(
      new THREE.Vector3(...fromTarget),
      new THREE.Vector3(...toTarget),
      blend,
    ),
  };
}

function padCtrl(arr: number[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < Math.min(arr.length, 8); i++) out[i] = arr[i];
  return out;
}

export interface CanvasHandle {
  engine: Engine;
  particles: ParticleSystem;
}

interface Props {
  settings: SystemSettings;
  controlMgr: ControlManager;
  presets: Preset[];
  morphValue: number;
  modelData: (ModelData | undefined)[];
  onFpsUpdate?: (fps: number) => void;
}

const ParticleCanvas = forwardRef<CanvasHandle, Props>(function ParticleCanvas(
  { settings, controlMgr, presets, morphValue, modelData, onFpsUpdate },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const particlesRef = useRef<ParticleSystem | null>(null);
  const frameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const settingsRef = useRef(settings);
  const presetsRef = useRef(presets);
  const morphValueRef = useRef(morphValue);
  const prevMorphRef = useRef(morphValue);
  const fpsFrames = useRef<number[]>([]);
  const controlMgrRef = useRef(controlMgr);
  const modelDataRef = useRef(modelData);
  const prevNearestRef = useRef(-1);

  settingsRef.current = settings;
  presetsRef.current = presets;
  morphValueRef.current = morphValue;
  controlMgrRef.current = controlMgr;
  modelDataRef.current = modelData;

  useImperativeHandle(ref, () => ({
    get engine() { return engineRef.current!; },
    get particles() { return particlesRef.current!; },
  }));

  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;

    const engine = new Engine();
    engine.init(canvas, container, settingsRef.current);
    engineRef.current = engine;

    const particles = new ParticleSystem();
    particles.init(engine.scene, settingsRef.current.particleCount, settingsRef.current.pointSize);
    particlesRef.current = particles;

    for (const preset of presetsRef.current) {
      if (preset.modelUrl != null && preset.modelSlot != null) {
        const md = modelDataRef.current[presetsRef.current.indexOf(preset)];
        if (md) {
          const tex = createModelTexture(md);
          particles.setModelTexture(preset.modelSlot, tex, md.positions.length / 3);
        }
      }
    }

    startTimeRef.current = performance.now() / 1000;

    {
      const initCam = getDesiredCamera(presetsRef.current, morphValueRef.current);
      engine.camera.position.copy(initCam.pos);
      engine.controls.target.copy(initCam.target);
    }

    let camAnimating = false;
    let mouseNormX = 0;
    let smoothMouseOffsetX = 0;
    const MOUSE_RANGE = 9;
    const MOUSE_LERP = 0.04;

    const onMouseMove = (e: MouseEvent) => {
      mouseNormX = (e.clientX / window.innerWidth) * 2 - 1;
    };
    window.addEventListener("mousemove", onMouseMove);

    const animate = () => {
      const now = performance.now();
      const time = now / 1000 - startTimeRef.current;
      const prs = presetsRef.current;
      const currentMorph = morphValueRef.current;

      engine.updateSettings(settingsRef.current);
      particles.setPointSize(settingsRef.current.pointSize);
      particles.setDof(settingsRef.current.dofAmount, settingsRef.current.dofFocus);
      particles.setIntroProgress(Math.min(time / 3.5, 1.5));
      particles.setTime(time);

      const maxVal = prs.length - 1;
      const { fromIndex, toIndex, blend } = getMorphBlend(currentMorph, maxVal);

      const nearest = Math.round(Math.max(0, Math.min(maxVal, currentMorph)));
      if (nearest !== prevNearestRef.current) {
        prevNearestRef.current = nearest;
        controlMgrRef.current.loadPreset(prs[nearest]);
      }

      let ctrlA: number[];
      let ctrlB: number[];
      let separation: number;

      if (blend < 0.001) {
        ctrlA = controlMgrRef.current.getControlValues(prs[fromIndex]);
        ctrlB = ctrlA;
        separation = prs[fromIndex].separation;
      } else {
        ctrlA = prs[fromIndex].controls.map((c) => c.initial);
        ctrlB = prs[toIndex].controls.map((c) => c.initial);
        const t = blend * blend * (3 - 2 * blend);
        separation = prs[fromIndex].separation * (1 - t) + prs[toIndex].separation * t;
      }

      particles.setPresets(fromIndex, toIndex, blend);
      particles.setControls(padCtrl(ctrlA), padCtrl(ctrlB));
      particles.setSeparation(separation);

      const fogCtrl = controlMgrRef.current.controls.get("_fogMode");
      const racetrackIdx = prs.findIndex((p) => p.name === "Racetrack");
      const fogProximity =
        racetrackIdx >= 0 ? Math.max(0, 1 - Math.abs(currentMorph - racetrackIdx)) : 0;
      const fogActive = fogCtrl !== undefined && fogCtrl.value > 0.5 ? 1 : 0;
      particles.setFog(fogActive * fogProximity, 10, 180);

      engine.camera.position.x -= smoothMouseOffsetX;

      if (Math.abs(currentMorph - prevMorphRef.current) > 0.001) {
        prevMorphRef.current = currentMorph;
        camAnimating = true;
      }

      if (camAnimating) {
        const desired = getDesiredCamera(prs, currentMorph);
        engine.camera.position.lerp(desired.pos, CAM_LERP_SPEED);
        engine.controls.target.lerp(desired.target, CAM_LERP_SPEED);

        const posDist = engine.camera.position.distanceTo(desired.pos);
        const tgtDist = engine.controls.target.distanceTo(desired.target);
        if (posDist < 0.05 && tgtDist < 0.05) {
          engine.camera.position.copy(desired.pos);
          engine.controls.target.copy(desired.target);
          camAnimating = false;
        }
      }

      const onPreset = Math.abs(currentMorph - Math.round(currentMorph)) < 0.01;
      if (onPreset) {
        const camCtrl = controlMgrRef.current.controls.get("_camPosX");
        if (camCtrl) {
          const ctrlPos = _v1.set(
            camCtrl.value,
            controlMgrRef.current.controls.get("_camPosY")!.value,
            controlMgrRef.current.controls.get("_camPosZ")!.value,
          );
          const ctrlTgt = _v2.set(
            controlMgrRef.current.controls.get("_camTgtX")!.value,
            controlMgrRef.current.controls.get("_camTgtY")!.value,
            controlMgrRef.current.controls.get("_camTgtZ")!.value,
          );
          engine.camera.position.lerp(ctrlPos, CAM_LERP_SPEED);
          engine.controls.target.lerp(ctrlTgt, CAM_LERP_SPEED);
          camAnimating = false;
        }
      }

      smoothMouseOffsetX += (mouseNormX * MOUSE_RANGE - smoothMouseOffsetX) * MOUSE_LERP;
      engine.camera.position.x += smoothMouseOffsetX;

      engine.render();

      if (onFpsUpdate) {
        fpsFrames.current.push(now);
        const cutoff = now - 1000;
        while (fpsFrames.current.length > 0 && fpsFrames.current[0] < cutoff) {
          fpsFrames.current.shift();
        }
        onFpsUpdate(fpsFrames.current.length);
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("mousemove", onMouseMove);
      particles.dispose(engine.scene);
      engine.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const particles = particlesRef.current;
    const engine = engineRef.current;
    if (particles && engine) {
      particles.init(engine.scene, settings.particleCount, settings.pointSize);
      for (const preset of presetsRef.current) {
        if (preset.modelUrl != null && preset.modelSlot != null) {
          const md = modelDataRef.current[presetsRef.current.indexOf(preset)];
          if (md) {
            const tex = createModelTexture(md);
            particles.setModelTexture(preset.modelSlot, tex, md.positions.length / 3);
          }
        }
      }
    }
  }, [settings.particleCount]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
});

export default ParticleCanvas;
