import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import { Engine } from "~/lib/engine";
import { ParticleSystem } from "~/lib/particles";
import type { ParticleFn, SystemSettings, Preset } from "~/lib/types";
import type { ControlManager } from "~/lib/controls";

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

export interface CanvasHandle {
  engine: Engine;
  particles: ParticleSystem;
}

interface Props {
  settings: SystemSettings;
  controlMgr: ControlManager;
  presets: Preset[];
  morphValue: number;
  getActiveFn: () => { fnA: ParticleFn; fnB: ParticleFn | null; blend: number };
  onFpsUpdate?: (fps: number) => void;
}

const ParticleCanvas = forwardRef<CanvasHandle, Props>(function ParticleCanvas(
  { settings, controlMgr, presets, morphValue, getActiveFn, onFpsUpdate },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const particlesRef = useRef<ParticleSystem | null>(null);
  const frameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const settingsRef = useRef(settings);
  const getActiveFnRef = useRef(getActiveFn);
  const presetsRef = useRef(presets);
  const morphValueRef = useRef(morphValue);
  const prevMorphRef = useRef(morphValue);
  const fpsFrames = useRef<number[]>([]);

  settingsRef.current = settings;
  getActiveFnRef.current = getActiveFn;
  presetsRef.current = presets;
  morphValueRef.current = morphValue;

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

    startTimeRef.current = performance.now() / 1000;

    {
      const initCam = getDesiredCamera(presetsRef.current, morphValueRef.current);
      engine.camera.position.copy(initCam.pos);
      engine.controls.target.copy(initCam.target);
    }

    let camAnimating = false;

    const animate = () => {
      const now = performance.now();
      const time = now / 1000 - startTimeRef.current;

      engine.updateSettings(settingsRef.current);
      particles.setPointSize(settingsRef.current.pointSize);
      particles.setSeparation(settingsRef.current.particleSeparation);

      const currentMorph = morphValueRef.current;
      if (Math.abs(currentMorph - prevMorphRef.current) > 0.001) {
        prevMorphRef.current = currentMorph;
        camAnimating = true;
      }

      if (camAnimating) {
        const desired = getDesiredCamera(presetsRef.current, currentMorph);
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

      const { fnA, fnB, blend } = getActiveFnRef.current();
      particles.update(fnA, fnB, blend, time, controlMgr, THREE);

      const onPreset = Math.abs(currentMorph - Math.round(currentMorph)) < 0.01;
      if (onPreset) {
        const camCtrl = controlMgr.controls.get("_camPosX");
        if (camCtrl) {
          const ctrlPos = _v1.set(
            camCtrl.value,
            controlMgr.controls.get("_camPosY")!.value,
            controlMgr.controls.get("_camPosZ")!.value,
          );
          const ctrlTgt = _v2.set(
            controlMgr.controls.get("_camTgtX")!.value,
            controlMgr.controls.get("_camTgtY")!.value,
            controlMgr.controls.get("_camTgtZ")!.value,
          );
          engine.camera.position.lerp(ctrlPos, CAM_LERP_SPEED);
          engine.controls.target.lerp(ctrlTgt, CAM_LERP_SPEED);
          camAnimating = false;
        }
      }

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
      particles.dispose(engine.scene);
      engine.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const particles = particlesRef.current;
    const engine = engineRef.current;
    if (particles && engine) {
      particles.init(engine.scene, settings.particleCount, settings.pointSize);
    }
  }, [settings.particleCount]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
});

export default ParticleCanvas;
