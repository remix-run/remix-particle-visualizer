import * as THREE from "three";
import type { ParticleFn } from "./types";
import type { ControlManager } from "./controls";

const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uPointSize;
  uniform float uPixelRatio;

  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float dist = -mvPosition.z;
    gl_PointSize = aSize * uPointSize * uPixelRatio * (300.0 / dist);
    gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = smoothstep(500.0, 50.0, dist);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float glow = exp(-d * 6.0);
    float core = smoothstep(0.5, 0.0, d);
    float alpha = (glow * 0.6 + core * 0.4) * vAlpha;
    gl_FragColor = vec4(vColor * (0.8 + core * 0.4), alpha);
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

  init(scene: THREE.Scene, count: number, pointSize: number) {
    this.dispose(scene);
    this.count = count;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    sizes.fill(1.0);

    this.geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(positions, 3);
    this.colorAttr = new THREE.BufferAttribute(colors, 3);
    this.sizeAttr = new THREE.BufferAttribute(sizes, 1);

    this.geometry.setAttribute("position", this.positionAttr);
    this.geometry.setAttribute("color", this.colorAttr);
    this.geometry.setAttribute("aSize", this.sizeAttr);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uPointSize: { value: pointSize },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
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
    if (this.material) {
      this.material.uniforms.uPointSize.value = size;
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

    const addControl = (id: string, label: string, min: number, max: number, initial: number) =>
      controlMgr.addControl(id, label, min, max, initial);
    const setInfo = (title: string, description: string) =>
      controlMgr.setInfo(title, description);
    const annotate = (id: string, pos: THREE.Vector3, label: string) =>
      controlMgr.annotate(id, pos, label);

    controlMgr.beginFrame();

    if (!fnB || blend < 0.001) {
      for (let i = 0; i < count; i++) {
        this.targetA.set(0, 0, 0);
        this.colorA.setRGB(1, 1, 1);
        fnA(i, count, this.targetA, this.colorA, time, THREELib, addControl, setInfo, annotate);
        const idx = i * 3;
        positions[idx] = this.targetA.x;
        positions[idx + 1] = this.targetA.y;
        positions[idx + 2] = this.targetA.z;
        colors[idx] = this.colorA.r;
        colors[idx + 1] = this.colorA.g;
        colors[idx + 2] = this.colorA.b;
      }
    } else {
      const t = blend * blend * (3 - 2 * blend); // smoothstep
      const addControlB = (id: string, _label: string, _min: number, _max: number, initial: number) => {
        const existing = controlMgr.controls.get(id);
        return existing ? existing.value : initial;
      };
      const noopInfo = () => {};
      const noopAnnotate = () => {};

      for (let i = 0; i < count; i++) {
        this.targetA.set(0, 0, 0);
        this.colorA.setRGB(1, 1, 1);
        this.targetB.set(0, 0, 0);
        this.colorB.setRGB(1, 1, 1);

        fnA(i, count, this.targetA, this.colorA, time, THREELib, addControl, setInfo, annotate);
        fnB(i, count, this.targetB, this.colorB, time, THREELib, addControlB, noopInfo, noopAnnotate);

        const idx = i * 3;
        const invT = 1 - t;
        positions[idx] = this.targetA.x * invT + this.targetB.x * t;
        positions[idx + 1] = this.targetA.y * invT + this.targetB.y * t;
        positions[idx + 2] = this.targetA.z * invT + this.targetB.z * t;
        colors[idx] = this.colorA.r * invT + this.colorB.r * t;
        colors[idx + 1] = this.colorA.g * invT + this.colorB.g * t;
        colors[idx + 2] = this.colorA.b * invT + this.colorB.b * t;
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
