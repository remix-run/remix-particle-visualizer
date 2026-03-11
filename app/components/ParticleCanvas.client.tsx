import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import { Engine } from "~/lib/engine";
import { ParticleSystem } from "~/lib/particles";
import type { ParticleFn, SystemSettings } from "~/lib/types";
import type { ControlManager } from "~/lib/controls";

export interface CanvasHandle {
  engine: Engine;
  particles: ParticleSystem;
}

interface Props {
  settings: SystemSettings;
  controlMgr: ControlManager;
  getActiveFn: () => { fnA: ParticleFn; fnB: ParticleFn | null; blend: number };
  onFpsUpdate?: (fps: number) => void;
}

const ParticleCanvas = forwardRef<CanvasHandle, Props>(function ParticleCanvas(
  { settings, controlMgr, getActiveFn, onFpsUpdate },
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
  const fpsFrames = useRef<number[]>([]);

  settingsRef.current = settings;
  getActiveFnRef.current = getActiveFn;

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

    const animate = () => {
      const now = performance.now();
      const time = now / 1000 - startTimeRef.current;

      engine.updateSettings(settingsRef.current);
      particles.setPointSize(settingsRef.current.pointSize);

      const { fnA, fnB, blend } = getActiveFnRef.current();
      particles.update(fnA, fnB, blend, time, controlMgr, THREE);
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
