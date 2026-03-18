import * as THREE from "three";
import type { ParticleFn } from "./types";
import type { ControlManager } from "./controls";

const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aRandom;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vViewDist;
  varying float vIntro;
  varying float vPulse;
  varying float vCoc;
  uniform float uPointSize;
  uniform float uPixelRatio;
  uniform float uIntroProgress;
  uniform float uDofAmount;
  uniform float uDofFocus;

  void main() {
    vColor = color;
    float delay = aRandom * 0.7;
    float fallDuration = 0.5;
    float local = clamp((uIntroProgress - delay) / fallDuration, 0.0, 1.0);
    float inv = 1.0 - local;
    float easedLocal = 1.0 - inv * inv * inv;
    float landTime = delay + fallDuration;
    float sinceL = max(uIntroProgress - landTime, 0.0);
    vPulse = (local >= 1.0) ? exp(-sinceL * 8.0) : 0.0;

    float landed = step(1.0, local);
    float opacityRamp = 1.0 - exp(-sinceL * 3.0);
    vIntro = mix(easedLocal * 0.5, 0.5 + 0.5 * opacityRamp, landed);

    float introOffset = (1.0 - easedLocal) * (10.0 + aRandom * 6.0);
    vec4 mvPosition = modelViewMatrix * vec4(position + vec3(0.0, introOffset, 0.0), 1.0);
    float dist = -mvPosition.z;
    vViewDist = dist;

    float baseSize = aSize * uPointSize * uPixelRatio * (300.0 / dist);

    float coc = uDofAmount > 0.0
      ? abs(dist - uDofFocus) * uDofAmount * 0.01
      : 0.0;
    vCoc = clamp(coc, 0.0, 1.0);

    gl_PointSize = clamp(baseSize + coc * 12.0, 1.0, 128.0);
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = smoothstep(500.0, 50.0, dist);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vViewDist;
  varying float vIntro;
  varying float vPulse;
  varying float vCoc;
  uniform float uFogEnabled;
  uniform float uFogNear;
  uniform float uFogFar;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float sharpness = mix(6.0, 2.0, vCoc);
    float glow = exp(-d * sharpness);
    float core = smoothstep(0.5, 0.1 + vCoc * 0.3, d);
    float alpha = (glow * 0.6 + core * 0.4) * vAlpha * vIntro;
    alpha *= mix(1.0, 0.35, vCoc);

    vec3 col = vColor * (0.8 + core * 0.4) * (1.0 + vPulse * 9.0);

    if (uFogEnabled > 0.0) {
      float fogFactor = smoothstep(uFogNear, uFogFar, vViewDist) * uFogEnabled;
      col *= 1.0 - fogFactor;
      alpha *= 1.0 - fogFactor;
    }

    gl_FragColor = vec4(col, alpha);
  }
`;

export class ParticleSystem {
  private points: THREE.Points | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private positionAttr: THREE.BufferAttribute | null = null;
  private colorAttr: THREE.BufferAttribute | null = null;
  private sizeAttr: THREE.BufferAttribute | null = null;
  private count = 0;

  private targetA = new THREE.Vector3();
  private targetB = new THREE.Vector3();
  private colorA = new THREE.Color();
  private colorB = new THREE.Color();
  private currentPointSize = 0.5;
  private separation = 0.40;

  init(scene: THREE.Scene, count: number, pointSize: number) {
    this.dispose(scene);
    this.count = count;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const randoms = new Float32Array(count);
    sizes.fill(1.0);
    for (let i = 0; i < count; i++) randoms[i] = Math.random();

    this.geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(positions, 3);
    this.colorAttr = new THREE.BufferAttribute(colors, 3);
    this.sizeAttr = new THREE.BufferAttribute(sizes, 1);

    this.geometry.setAttribute("position", this.positionAttr);
    this.geometry.setAttribute("color", this.colorAttr);
    this.geometry.setAttribute("aSize", this.sizeAttr);
    this.geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uPointSize: { value: pointSize },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uIntroProgress: { value: 0.0 },
        uFogEnabled: { value: 0.0 },
        uFogNear: { value: 10.0 },
        uFogFar: { value: 180.0 },
        uDofAmount: { value: 0.0 },
        uDofFocus: { value: 80.0 },
      },
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  setPointSize(size: number) {
    this.currentPointSize = size;
    if (this.material) {
      this.material.uniforms.uPointSize.value = size;
    }
  }

  setSeparation(value: number) {
    this.separation = value;
  }

  setIntroProgress(value: number) {
    if (this.material) {
      this.material.uniforms.uIntroProgress.value = value;
    }
  }

  setFog(intensity: number, near: number, far: number) {
    if (this.material) {
      this.material.uniforms.uFogEnabled.value = intensity;
      this.material.uniforms.uFogNear.value = near;
      this.material.uniforms.uFogFar.value = far;
    }
  }

  setDof(amount: number, focus: number) {
    if (this.material) {
      this.material.uniforms.uDofAmount.value = amount;
      this.material.uniforms.uDofFocus.value = focus;
    }
  }

  update(
    fnA: ParticleFn,
    fnB: ParticleFn | null,
    blend: number,
    time: number,
    controlMgr: ControlManager,
    THREELib: typeof THREE,
  ) {
    if (!this.positionAttr || !this.colorAttr) return;

    const positions = this.positionAttr.array as Float32Array;
    const colors = this.colorAttr.array as Float32Array;
    const count = this.count;

    const setInfo = (title: string, description: string) =>
      controlMgr.setInfo(title, description);
    const annotate = (id: string, pos: THREE.Vector3, label: string) =>
      controlMgr.annotate(id, pos, label);

    controlMgr.beginFrame();

    let sepA = this.separation;
    let sepB = this.separation;

    if (!fnB || blend < 0.001) {
      const addControlA = (id: string, label: string, min: number, max: number, initial: number) => {
        const v = controlMgr.addControl(id, label, min, max, initial);
        if (id === "_separation") sepA = v;
        return v;
      };

      for (let i = 0; i < count; i++) {
        this.targetA.set(0, 0, 0);
        this.colorA.setRGB(1, 1, 1);
        fnA(i, count, this.targetA, this.colorA, time, THREELib, addControlA, setInfo, annotate);
        const idx = i * 3;
        const h = i * 2.3999;
        positions[idx] = this.targetA.x + Math.sin(h) * sepA;
        positions[idx + 1] = this.targetA.y + Math.cos(h * 1.731) * sepA;
        positions[idx + 2] = this.targetA.z + Math.sin(h * 2.419) * sepA;
        colors[idx] = this.colorA.r;
        colors[idx + 1] = this.colorA.g;
        colors[idx + 2] = this.colorA.b;
      }
    } else {
      const t = blend * blend * (3 - 2 * blend); // smoothstep
      const initialsA = new Map<string, number>();
      const initialsB = new Map<string, number>();
      const addControlA = (id: string, label: string, min: number, max: number, initial: number) => {
        controlMgr.addControl(id, label, min, max, initial);
        initialsA.set(id, initial);
        if (id === "_separation") sepA = initial;
        return initial;
      };
      const addControlBFn = (id: string, _label: string, _min: number, _max: number, initial: number) => {
        initialsB.set(id, initial);
        if (id === "_separation") sepB = initial;
        return initial;
      };
      const noopInfo = () => {};
      const noopAnnotate = () => {};

      for (let i = 0; i < count; i++) {
        this.targetA.set(0, 0, 0);
        this.colorA.setRGB(1, 1, 1);
        this.targetB.set(0, 0, 0);
        this.colorB.setRGB(1, 1, 1);

        fnA(i, count, this.targetA, this.colorA, time, THREELib, addControlA, setInfo, annotate);
        fnB(i, count, this.targetB, this.colorB, time, THREELib, addControlBFn, noopInfo, noopAnnotate);

        const idx = i * 3;
        const invT = 1 - t;
        const h = i * 2.3999;
        const sep = sepA * invT + sepB * t;
        positions[idx] = this.targetA.x * invT + this.targetB.x * t + Math.sin(h) * sep;
        positions[idx + 1] = this.targetA.y * invT + this.targetB.y * t + Math.cos(h * 1.731) * sep;
        positions[idx + 2] = this.targetA.z * invT + this.targetB.z * t + Math.sin(h * 2.419) * sep;
        colors[idx] = this.colorA.r * invT + this.colorB.r * t;
        colors[idx + 1] = this.colorA.g * invT + this.colorB.g * t;
        colors[idx + 2] = this.colorA.b * invT + this.colorB.b * t;
      }

      for (const [id, ctrl] of controlMgr.controls) {
        const a = initialsA.get(id);
        const b = initialsB.get(id);
        if (a !== undefined && b !== undefined) {
          ctrl.value = a + (b - a) * t;
        } else if (a !== undefined) {
          ctrl.value = a;
        }
      }
    }

    controlMgr.endFrame();
    this.positionAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }

  dispose(scene?: THREE.Scene) {
    if (this.points && scene) {
      scene.remove(this.points);
    }
    this.geometry?.dispose();
    this.material?.dispose();
    this.points = null;
    this.geometry = null;
    this.material = null;
    this.positionAttr = null;
    this.colorAttr = null;
    this.sizeAttr = null;
  }
}
