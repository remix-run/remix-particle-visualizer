import { ref, type Handle } from "remix/ui";
import { presets } from "~/lib/presets";
import { ControlManager } from "~/lib/controls";
import { createMorphState } from "~/lib/morph";
import { loadModelPoints } from "~/lib/model-loader";
import type { ModelData } from "~/lib/model-loader";
import type { SystemSettings, ControlDef, InfoState } from "~/lib/types";
import { DEFAULT_SETTINGS } from "~/lib/types";
import MorphSlider from "~/components/MorphSlider";
import ControlPanel from "~/components/ControlPanel";
import SystemPanel from "~/components/SystemPanel";
import HUD from "~/components/HUD";
import LoaderRunner from "~/components/LoaderRunner";
import LabelOverlay from "~/components/LabelOverlay";
import ParticleCanvas from "~/components/ParticleCanvas.client";
import type { ProjectedLabel } from "~/lib/label-projection";

const MIN_STARTUP_LOADER_MS = 900;

interface MutableRef<T> {
  current: T;
}

function presetSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function initialPresetIndex(): number {
  if (typeof window === "undefined") return 0;
  const hash = window.location.hash.replace("#", "");
  if (!hash) return 0;
  const idx = presets.findIndex((preset) => presetSlug(preset.name) === hash);
  return idx >= 0 ? idx : 0;
}

export default function Home(handle: Handle) {
  let settings: SystemSettings = DEFAULT_SETTINGS;
  let fps = 0;
  let uiVisible = true;
  let vizControls: ControlDef[] = [];
  let hudInfo: InfoState = { title: "", description: "" };
  let morphValue = initialPresetIndex();
  let modelsLoading = true;
  let sceneReady = false;
  let minimumLoaderElapsed = false;
  let introDone = false;
  let glowEl: HTMLDivElement | null = null;
  let glowRaf = 0;
  let queuedGlowKey = "";

  const loadingStatus = "Loading models...";
  const labelOpacityRef: MutableRef<number> = { current: 0 };
  const controlMgrRef: MutableRef<ControlManager> = { current: new ControlManager() };
  const morphStateRef: MutableRef<ReturnType<typeof createMorphState>> = { current: createMorphState() };
  const modelDataRef: MutableRef<(ModelData | undefined)[]> = { current: presets.map(() => undefined) };
  const projectedLabelsRef: MutableRef<ProjectedLabel[]> = { current: [] };
  const animRef: MutableRef<{ target: number; raf: number } | null> = { current: null };

  const update = () => {
    handle.update();
  };

  const syncHash = () => {
    if (typeof window === "undefined") return;
    const nearest = Math.round(morphValue);
    if (Math.abs(morphValue - nearest) >= 0.01) return;
    if (nearest < 0 || nearest >= presets.length) return;

    const slug = presetSlug(presets[nearest].name);
    if (window.location.hash !== `#${slug}`) {
      history.replaceState(null, "", `#${slug}`);
    }
  };

  const setMorphValue = (value: number) => {
    morphValue = value;
    morphStateRef.current.value = value;
    syncHash();
    update();
  };

  const cancelAnim = () => {
    if (!animRef.current) return;
    cancelAnimationFrame(animRef.current.raf);
    animRef.current = null;
  };

  const handleMorphChange = (value: number) => {
    cancelAnim();
    setMorphValue(value);
  };

  const handlePresetClick = (idx: number) => {
    cancelAnim();

    const anim = { target: idx, raf: 0 };
    animRef.current = anim;

    const tick = () => {
      if (animRef.current !== anim) return;
      const current = morphStateRef.current.value;
      const diff = anim.target - current;

      if (Math.abs(diff) < 0.005) {
        animRef.current = null;
        setMorphValue(anim.target);
        return;
      }

      const speed = 4.0;
      const dt = 1 / 60;
      const step = diff * (1 - Math.exp(-speed * dt));
      const next = current + step;
      morphStateRef.current.value = next;
      morphValue = next;
      syncHash();
      update();
      anim.raf = requestAnimationFrame(tick);
    };

    anim.raf = requestAnimationFrame(tick);
  };

  const handleControlChange = (id: string, value: number) => {
    controlMgrRef.current.setControlValue(id, value);
  };

  const handleSceneReady = () => {
    if (sceneReady) return;
    sceneReady = true;
    update();
  };

  const handleSettingsChange = (nextSettings: SystemSettings) => {
    settings = nextSettings;
    update();
  };

  const handleFpsUpdate = (nextFps: number) => {
    if (fps === nextFps) return;
    fps = nextFps;
    update();
  };

  const toggleUi = () => {
    uiVisible = !uiVisible;
    update();
  };

  const stopGlowAnimation = () => {
    cancelAnimationFrame(glowRaf);
    glowRaf = 0;
  };

  const syncGlowAnimation = () => {
    if (!glowEl || settings.colorMode !== 2 || settings.glowIntensity <= 0) {
      stopGlowAnimation();
      return;
    }
    if (glowRaf) return;

    const tick = () => {
      if (!glowEl || settings.colorMode !== 2) {
        stopGlowAnimation();
        return;
      }
      const intensity = settings.glowIntensity;
      const t = (performance.now() / 1000) * 0.25;
      const hue = (t * 0.51) % 1;
      const sat = 80 + Math.sin(t) * 15;
      const lum = 55 + 25 * Math.cos(t);
      const hDeg = Math.round(hue * 360);
      const inner = intensity;
      const mid = intensity * 0.3;
      glowEl.style.background = `radial-gradient(ellipse at 50% 50%, hsla(${hDeg},${Math.round(sat)}%,${Math.round(lum)}%,${inner}) 0%, hsla(${hDeg},${Math.round(sat)}%,${Math.round(lum)}%,${mid}) 40%, transparent 70%)`;
      glowRaf = requestAnimationFrame(tick);
    };

    glowRaf = requestAnimationFrame(tick);
  };

  if (typeof window !== "undefined") {
    const minimumLoaderTimer = window.setTimeout(() => {
      minimumLoaderElapsed = true;
      update();
    }, MIN_STARTUP_LOADER_MS);

    const introTimer = window.setTimeout(() => {
      introDone = true;
      update();
    }, 3000);

    let cancelled = false;
    const initModels = async () => {
      morphStateRef.current.value = morphValue;

      const modelLoads = presets.map((preset) =>
        preset.modelUrl ? loadModelPoints(preset.modelUrl) : Promise.resolve(undefined),
      );

      try {
        const results = await Promise.all(modelLoads);
        if (cancelled) return;
        modelDataRef.current = results;
      } catch (error) {
        console.error("Failed to load model(s):", error);
      }

      controlMgrRef.current.loadPreset(presets[Math.round(morphValue)] ?? presets[0]);
      modelsLoading = false;
      update();
    };

    const controlInterval = window.setInterval(() => {
      const manager = controlMgrRef.current;
      if (!manager.dirty) return;

      manager.dirty = false;
      vizControls = Array.from(manager.controls.values());
      hudInfo = { ...manager.info };
      update();
    }, 100);

    const maxVal = presets.length - 1;
    const applyDelta = (delta: number) => {
      const next = Math.max(0, Math.min(maxVal, morphValue + delta));
      cancelAnim();
      setMorphValue(next);
    };

    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".control-panel, .system-panel, .system-dropdown")) return;
      event.preventDefault();
      applyDelta(event.deltaY > 0 ? 0.01 : -0.01);
    };

    let touchStartY = 0;
    let lastTouchY = 0;

    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0].clientY;
      lastTouchY = touchStartY;
    };

    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      const currentY = event.touches[0].clientY;
      const dy = lastTouchY - currentY;
      lastTouchY = currentY;
      const sensitivity = maxVal / (window.innerHeight * 0.6);
      applyDelta(dy * sensitivity);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        const target = Math.min(maxVal, Math.floor(morphValue) + 1);
        if (target === Math.round(morphValue) && target < maxVal) {
          handlePresetClick(target + 1);
        } else {
          handlePresetClick(target);
        }
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        const target = Math.max(0, Math.ceil(morphValue) - 1);
        if (target === Math.round(morphValue) && target > 0) {
          handlePresetClick(target - 1);
        } else {
          handlePresetClick(target);
        }
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    initModels();

    handle.signal.addEventListener("abort", () => {
      cancelled = true;
      window.clearTimeout(minimumLoaderTimer);
      window.clearTimeout(introTimer);
      window.clearInterval(controlInterval);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      cancelAnim();
      stopGlowAnimation();
    });
  }

  return () => {
    const fadeClass = introDone ? "" : "ui-fade-in";
    const showStartupLoader = modelsLoading || !sceneReady || !minimumLoaderElapsed;
    const loaderMessage = modelsLoading ? loadingStatus : "Initializing Particles...";
    const glowKey = `${settings.colorMode}:${settings.glowIntensity}`;

    if (queuedGlowKey !== glowKey) {
      queuedGlowKey = glowKey;
      handle.queueTask(syncGlowAnimation);
    }

    if (modelsLoading) {
      return (
        <div className="visualizer-root">
          <div className="loading-screen">
            <LoaderRunner />
            <div className="loading-text">{loaderMessage}</div>
          </div>
        </div>
      );
    }

    const RACECAR_GLOW: [number, number, number] = [0.3, 0.35, 0.55];
    const glowStyle = (() => {
      const intensity = settings.glowIntensity;
      if (intensity <= 0) return { display: "none" as const };

      let r: number;
      let g: number;
      let bl: number;

      if (settings.colorMode === 1) {
        r = Math.round(RACECAR_GLOW[0] * 255);
        g = Math.round(RACECAR_GLOW[1] * 255);
        bl = Math.round(RACECAR_GLOW[2] * 255);
      } else if (settings.colorMode === 2) {
        r = 45;
        g = 172;
        bl = 249;
      } else {
        const idxA = Math.floor(morphValue);
        const idxB = Math.min(idxA + 1, presets.length - 1);
        const t = morphValue - idxA;
        const fallback: [number, number, number] = [0.3, 0.3, 0.3];
        const a = presets[idxA]?.glowColor ?? fallback;
        const b = presets[idxB]?.glowColor ?? fallback;
        r = Math.round((a[0] + (b[0] - a[0]) * t) * 255);
        g = Math.round((a[1] + (b[1] - a[1]) * t) * 255);
        bl = Math.round((a[2] + (b[2] - a[2]) * t) * 255);
      }

      const inner = intensity;
      const mid = intensity * 0.3;
      return {
        position: "fixed" as const,
        inset: 0,
        pointerEvents: "none" as const,
        zIndex: 0,
        background: `radial-gradient(ellipse at 50% 50%, rgba(${r},${g},${bl},${inner}) 0%, rgba(${r},${g},${bl},${mid}) 40%, transparent 70%)`,
      };
    })();

    return (
      <div className="visualizer-root">
        <ParticleCanvas
          settings={settings}
          controlMgr={controlMgrRef.current}
          presets={presets}
          morphValue={morphValue}
          modelData={modelDataRef.current}
          onFpsUpdate={handleFpsUpdate}
          onReady={handleSceneReady}
          labelsRef={projectedLabelsRef}
          labelOpacityRef={labelOpacityRef}
        />

        <LabelOverlay
          labelsRef={projectedLabelsRef}
          opacityRef={labelOpacityRef}
        />

        <div
          mix={ref((node) => {
            glowEl = node;
            syncGlowAnimation();
          })}
          style={glowStyle}
        />

        {uiVisible && <div className={`dot-grid ${fadeClass}`} />}

        {uiVisible && <div className={fadeClass}><HUD info={hudInfo} /></div>}

        <div className={fadeClass} style={{ position: "relative", zIndex: 20 }}>
          <SystemPanel
            settings={settings}
            onSettingsChange={handleSettingsChange}
            fps={fps}
            uiVisible={uiVisible}
            onToggleUi={toggleUi}
          />
        </div>

        {uiVisible && (
          <div className={fadeClass}>
            <ControlPanel
              controls={vizControls}
              onControlChange={handleControlChange}
            />
          </div>
        )}

        {uiVisible && (
          <div className={fadeClass}>
            <MorphSlider
              presets={presets}
              value={morphValue}
              onValueChange={handleMorphChange}
              onPresetClick={handlePresetClick}
            />
          </div>
        )}

        {showStartupLoader && (
          <div className="loading-screen">
            <LoaderRunner />
            <div className="loading-text">{loaderMessage}</div>
          </div>
        )}
      </div>
    );
  };
}
