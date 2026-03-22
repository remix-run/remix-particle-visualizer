import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ParticleSystem } from "./particles";
import { DEFAULT_SETTINGS } from "./types";

const TARGET_FRAME_MS = 10.0;
const WARMUP_FRAMES = 3;
const BENCH_FRAMES = 12;
const CANDIDATES = [50000, 75000, 100000, 150000, 200000, 300000, 500000];
const FALLBACK_COUNT = 100000;

export function benchmarkParticleCount(): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      try {
        const width = window.innerWidth;
        const height = window.innerHeight;

        const canvas = document.createElement("canvas");
        canvas.style.cssText =
          "position:fixed;top:0;left:0;opacity:0;pointer-events:none;z-index:-1";
        document.body.appendChild(canvas);

        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: false,
          alpha: false,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
          DEFAULT_SETTINGS.cameraFov,
          width / height,
          0.1,
          2000,
        );
        camera.position.set(-0.80, -18.60, 81.40);
        camera.lookAt(0, -4.20, -30);

        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(
          new UnrealBloomPass(
            new THREE.Vector2(width, height),
            DEFAULT_SETTINGS.bloomStrength,
            0.4,
            DEFAULT_SETTINGS.bloomThreshold,
          ),
        );

        const gl = renderer.getContext();
        const particles = new ParticleSystem();

        const racetrackInitials = [0.2, 40, 10.25, 7.8, 1, 0, 0, 0];

        let bestCount = CANDIDATES[0];

        for (const count of CANDIDATES) {
          particles.init(scene, count, DEFAULT_SETTINGS.pointSize);
          particles.setIntroProgress(1.5);
          particles.setPresets(2, 2, 0);
          particles.setControls(racetrackInitials, racetrackInitials);
          particles.setSeparation(0);

          for (let f = 0; f < WARMUP_FRAMES; f++) {
            particles.setTime(performance.now() / 1000);
            composer.render();
            gl.finish();
          }

          const times: number[] = [];
          for (let f = 0; f < BENCH_FRAMES; f++) {
            const t0 = performance.now();
            particles.setTime(t0 / 1000);
            composer.render();
            gl.finish();
            times.push(performance.now() - t0);
          }

          times.sort((a, b) => a - b);
          const p90 = times[Math.floor(times.length * 0.9)];

          if (p90 <= TARGET_FRAME_MS) {
            bestCount = count;
          } else {
            break;
          }
        }

        particles.dispose(scene);
        composer.dispose();
        renderer.dispose();
        canvas.remove();

        resolve(bestCount);
      } catch (e) {
        console.warn("Benchmark failed, using fallback:", e);
        resolve(FALLBACK_COUNT);
      }
    });
  });
}
