import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import type { SystemSettings } from "./types";

export class Engine {
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  controls!: OrbitControls;
  composer!: EffectComposer;
  bloomPass!: UnrealBloomPass;

  private resizeObserver: ResizeObserver | null = null;

  init(canvas: HTMLCanvasElement, container: HTMLElement, settings: SystemSettings) {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      settings.cameraFov,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    this.camera.position.set(0, 30, 80);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(new THREE.Color(settings.backgroundColor));

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.5;
    this.controls.enableZoom = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 500;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const bloomSize = new THREE.Vector2(container.clientWidth, container.clientHeight);
    this.bloomPass = new UnrealBloomPass(bloomSize, settings.bloomStrength, 0.4, settings.bloomThreshold);
    this.composer.addPass(this.bloomPass);

    this.resizeObserver = new ResizeObserver(() => this.handleResize(container));
    this.resizeObserver.observe(container);
  }

  private handleResize(container: HTMLElement) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  updateSettings(settings: SystemSettings) {
    this.renderer.setClearColor(new THREE.Color(settings.backgroundColor));
    this.bloomPass.strength = settings.bloomStrength;
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
    this.controls.dispose();
    this.renderer.dispose();
    this.composer.dispose();
  }
}
