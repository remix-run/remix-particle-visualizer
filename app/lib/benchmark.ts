import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ParticleSystem } from "./particles";
import { compile } from "./executor";
import { ControlManager } from "./controls";
import { DEFAULT_SETTINGS } from "./types";

/**
 * Stripped-down racetrack preset — the heaviest workload in the app with 5-way
 * branching, hill terrain noise, fog, and dense trig per particle. Hardcodes
 * all control values so it runs without addControl/setInfo.
 */
const BENCH_CODE = `
const fogMode = 1;
const speed = 0.2;
const trackW = 40;
const curveAmp = 10.25;
const hillH = 7.8;

const zNear = 72;
const zFar = -100;
const trackY = -24;

const surfaceEnd = Math.floor(count * 0.30);
const leftCurbEnd = surfaceEnd + Math.floor(count * 0.05);
const rightCurbEnd = leftCurbEnd + Math.floor(count * 0.05);
const leftHillEnd = rightCurbEnd + Math.floor(count * 0.30);

const phi = 1.6180339887;
const hillWidth = 50;

if (i < surfaceEnd) {
  const along = (((i * phi) % 1.0 - time * speed * 0.12) % 1.0 + 1.0) % 1.0;
  const across = (i * 0.7071067812) % 1.0;
  const t2 = along * along;
  const z = zNear + (zFar - zNear) * t2;
  const cx = Math.sin(along * Math.PI * 3) * curveAmp
           + Math.sin(along * Math.PI * 5.5 + 2.0) * curveAmp * 0.3;
  const perspNarrow = 1.0 - along * 0.5;
  const lane = (across - 0.5) * trackW * perspNarrow;
  const jx = Math.sin(i * 7.37) * 0.2;
  target.set(cx + lane + jx, trackY, z);

  const tarmac = 0.06 + 0.03 * Math.sin(i * 3.77 + along * 20);
  color.setHSL(0, 0, tarmac);
  if (fogMode < 0.5) {
    const fog = 1.0 - along;
    color.r *= fog; color.g *= fog; color.b *= fog;
  }

} else if (i < leftCurbEnd) {
  const bi = i - surfaceEnd;
  const bt = (((bi * phi) % 1.0 - time * speed * 0.12) % 1.0 + 1.0) % 1.0;
  const bt2 = bt * bt;
  const bz = zNear + (zFar - zNear) * bt2;
  const bcx = Math.sin(bt * Math.PI * 3) * curveAmp
            + Math.sin(bt * Math.PI * 5.5 + 2.0) * curveAmp * 0.3;
  const bNarrow = 1.0 - bt * 0.5;
  const stripOff = (bi % 8) / 8 * 1.5;
  target.set(bcx - trackW * 0.5 * bNarrow - stripOff, trackY, bz);

  const isRed = Math.floor(bt * 35) % 2 === 0;
  if (isRed) color.setHSL(0, 0.85, 0.45);
  else color.setHSL(0, 0, 0.85);
  if (fogMode < 0.5) {
    const fog = 1.0 - bt;
    color.r *= fog; color.g *= fog; color.b *= fog;
  }

} else if (i < rightCurbEnd) {
  const bi = i - leftCurbEnd;
  const bt = (((bi * phi) % 1.0 - time * speed * 0.12) % 1.0 + 1.0) % 1.0;
  const bt2 = bt * bt;
  const bz = zNear + (zFar - zNear) * bt2;
  const bcx = Math.sin(bt * Math.PI * 3) * curveAmp
            + Math.sin(bt * Math.PI * 5.5 + 2.0) * curveAmp * 0.3;
  const bNarrow = 1.0 - bt * 0.5;
  const stripOff = (bi % 8) / 8 * 1.5;
  target.set(bcx + trackW * 0.5 * bNarrow + stripOff, trackY, bz);

  const isRed = Math.floor(bt * 35) % 2 === 0;
  if (isRed) color.setHSL(0, 0.85, 0.45);
  else color.setHSL(0, 0, 0.85);
  if (fogMode < 0.5) {
    const fog = 1.0 - bt;
    color.r *= fog; color.g *= fog; color.b *= fog;
  }

} else if (i < leftHillEnd) {
  const hi = i - rightCurbEnd;
  const ht = (((hi * phi) % 1.0 - time * speed * 0.12) % 1.0 + 1.0) % 1.0;
  const ht2 = ht * ht;
  const hz = zNear + (zFar - zNear) * ht2;
  const hcx = Math.sin(ht * Math.PI * 3) * curveAmp
            + Math.sin(ht * Math.PI * 5.5 + 2.0) * curveAmp * 0.3;
  const hNarrow = 1.0 - ht * 0.5;

  const lat = (hi * 0.7071067812) % 1.0;
  const xOff = (trackW * 0.5 + 1.5 + lat * hillWidth) * hNarrow;

  const nx = lat * 3.5;
  const nz = ht * 8.0;
  const ridge = Math.sin(nz * 1.1 + nx * 0.7) * 0.5 + 0.5;
  const broad = Math.sin(nz * 0.4 + nx * 1.3 + 2.0) * 0.5 + 0.5;
  const fine = Math.sin(nz * 3.7 + nx * 2.1 + 5.0) * 0.3;
  const slope = lat * 0.4 + 0.1;
  const nearCurb = 1.0 - Math.exp(-lat * 6.0);
  const elev = (ridge * 0.5 + broad * 0.35 + fine * 0.15 + slope) * hillH * nearCurb;

  target.set(hcx - xOff, trackY + elev, hz);

  const elevNorm = Math.min(elev / hillH, 1.0);
  const hue = 0.30 - elevNorm * 0.06;
  const sat = 0.75 - elevNorm * 0.35;
  const lit = 0.08 + elevNorm * 0.14 + 0.03 * Math.sin(hi * 1.73);
  color.setHSL(hue, sat, lit);
  if (fogMode < 0.5) {
    const fog = 1.0 - ht;
    color.r *= fog; color.g *= fog; color.b *= fog;
  }

} else {
  const hi = i - leftHillEnd;
  const ht = (((hi * phi) % 1.0 - time * speed * 0.12) % 1.0 + 1.0) % 1.0;
  const ht2 = ht * ht;
  const hz = zNear + (zFar - zNear) * ht2;
  const hcx = Math.sin(ht * Math.PI * 3) * curveAmp
            + Math.sin(ht * Math.PI * 5.5 + 2.0) * curveAmp * 0.3;
  const hNarrow = 1.0 - ht * 0.5;

  const lat = (hi * 0.7071067812) % 1.0;
  const xOff = (trackW * 0.5 + 1.5 + lat * hillWidth) * hNarrow;

  const nx = lat * 3.5;
  const nz = ht * 8.0;
  const ridge = Math.sin(nz * 1.1 + nx * 0.7 + 1.5) * 0.5 + 0.5;
  const broad = Math.sin(nz * 0.4 + nx * 1.3 + 4.0) * 0.5 + 0.5;
  const fine = Math.sin(nz * 3.7 + nx * 2.1 + 8.0) * 0.3;
  const slope = lat * 0.4 + 0.1;
  const nearCurb = 1.0 - Math.exp(-lat * 6.0);
  const elev = (ridge * 0.5 + broad * 0.35 + fine * 0.15 + slope) * hillH * nearCurb;

  target.set(hcx + xOff, trackY + elev, hz);

  const elevNorm = Math.min(elev / hillH, 1.0);
  const hue = 0.30 - elevNorm * 0.06;
  const sat = 0.75 - elevNorm * 0.35;
  const lit = 0.08 + elevNorm * 0.14 + 0.03 * Math.sin(hi * 1.73);
  color.setHSL(hue, sat, lit);
  if (fogMode < 0.5) {
    const fog = 1.0 - ht;
    color.r *= fog; color.g *= fog; color.b *= fog;
  }
}
`.trim();

const TARGET_FRAME_MS = 10.0;
const WARMUP_FRAMES = 8;
const BENCH_FRAMES = 30;
const CANDIDATES = [10000, 15000, 20000, 25000, 30000, 40000, 50000];
const FALLBACK_COUNT = 20000;

export function benchmarkParticleCount(): Promise<number> {
  return new Promise((resolve) => {
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
      camera.position.set(0, 30, 80);
      camera.lookAt(0, 0, 0);

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

      const fn = compile(BENCH_CODE);
      const controlMgr = new ControlManager();
      const gl = renderer.getContext();
      const particles = new ParticleSystem();

      let bestCount = CANDIDATES[0];
      let candidateIdx = 0;

      function cleanup() {
        particles.dispose(scene);
        composer.dispose();
        renderer.dispose();
        canvas.remove();
      }

      function testNext() {
        if (candidateIdx >= CANDIDATES.length) {
          cleanup();
          resolve(bestCount);
          return;
        }

        const count = CANDIDATES[candidateIdx];
        particles.init(scene, count, DEFAULT_SETTINGS.pointSize);
        particles.setIntroProgress(1.5);

        let frameIdx = 0;
        const times: number[] = [];

        function frame() {
          const time = performance.now() / 1000;

          const t0 = performance.now();
          particles.update(fn, null, 0, time, controlMgr, THREE);
          composer.render();
          gl.finish();
          const elapsed = performance.now() - t0;

          if (frameIdx >= WARMUP_FRAMES) {
            times.push(elapsed);
          }
          frameIdx++;

          if (frameIdx < WARMUP_FRAMES + BENCH_FRAMES) {
            requestAnimationFrame(frame);
          } else {
            times.sort((a, b) => a - b);
            const p90 = times[Math.floor(times.length * 0.9)];

            if (p90 <= TARGET_FRAME_MS) {
              bestCount = count;
              candidateIdx++;
              testNext();
            } else {
              cleanup();
              resolve(bestCount);
            }
          }
        }

        requestAnimationFrame(frame);
      }

      testNext();
    } catch (e) {
      console.warn("Benchmark failed, using fallback:", e);
      resolve(FALLBACK_COUNT);
    }
  });
}
