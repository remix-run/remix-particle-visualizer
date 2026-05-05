import {
  Color,
  HalfFloatType,
  PerspectiveCamera,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { AfterimagePass } from "three/addons/postprocessing/AfterimagePass.js";
import type { SystemSettings } from "./types";

function screenScale(width: number): number {
  const ref = 1440;
  return Math.min(width / ref, 1);
}

export class Engine {
  renderer!: WebGLRenderer;
  scene!: Scene;
  camera!: PerspectiveCamera;
  controls!: CameraTargetControls;
  composer!: EffectComposer;
  afterImagePass!: AfterimagePass;
  bloomPass!: UnrealBloomPass;

  private resizeObserver: ResizeObserver | null = null;
  private containerWidth = 1440;
  private lastAppliedSettings: SystemSettings | null = null;
  private lastAppliedWidth = -1;
  private clearColor = new Color();

  invalidateSettings() {
    this.lastAppliedSettings = null;
    this.lastAppliedWidth = -1;
  }

  init(canvas: HTMLCanvasElement, container: HTMLElement, settings: SystemSettings) {
    this.scene = new Scene();

    this.camera = new PerspectiveCamera(
      settings.cameraFov,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    this.camera.position.set(0, 30, 80);

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.clearColor.set(settings.backgroundColor);
    this.renderer.setClearColor(this.clearColor);

    this.controls = new CameraTargetControls(this.camera);

    const composerTarget = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.composer = new EffectComposer(this.renderer, composerTarget);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.afterImagePass = new AfterimagePass(settings.trailIntensity);
    this.composer.addPass(this.afterImagePass);

    this.containerWidth = container.clientWidth;
    const s = screenScale(this.containerWidth);
    const bloomSize = new Vector2(container.clientWidth, container.clientHeight);
    this.bloomPass = new UnrealBloomPass(bloomSize, settings.bloomStrength * s, 0.4, settings.bloomThreshold);
    this.composer.addPass(this.bloomPass);

    this.resizeObserver = new ResizeObserver(() => this.handleResize(container));
    this.resizeObserver.observe(container);
  }

  private handleResize(container: HTMLElement) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.containerWidth = w;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  getScreenScale(): number {
    return screenScale(this.containerWidth);
  }

  updateSettings(settings: SystemSettings) {
    if (
      settings === this.lastAppliedSettings &&
      this.containerWidth === this.lastAppliedWidth
    ) {
      return;
    }
    this.lastAppliedSettings = settings;
    this.lastAppliedWidth = this.containerWidth;

    const s = screenScale(this.containerWidth);
    this.clearColor.set(settings.backgroundColor);
    this.renderer.setClearColor(this.clearColor);
    this.bloomPass.strength = settings.bloomStrength * s;
    this.bloomPass.threshold = settings.bloomThreshold;

    if (this.camera.fov !== settings.cameraFov) {
      this.camera.fov = settings.cameraFov;
      this.camera.updateProjectionMatrix();
    }
  }

  render() {
    this.controls.update();
    this.composer.render();
  }

  dispose() {
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.renderer?.dispose();
    this.composer?.dispose();
  }
}

class CameraTargetControls {
  target = new Vector3();
  enabled = true;

  constructor(private camera: PerspectiveCamera) {}

  update() {
    this.camera.lookAt(this.target);
  }

  dispose() {}
}
