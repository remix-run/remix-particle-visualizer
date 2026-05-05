import { Suspense, lazy, useState, useRef, useCallback, useEffect, useMemo } from "react";
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
import type { ProjectedLabel } from "~/lib/label-projection";

const ParticleCanvas = lazy(() => import("~/components/ParticleCanvas.client"));
const MIN_STARTUP_LOADER_MS = 900;

function presetSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function initialPresetIndex(): number {
  if (typeof window === "undefined") return 0;
  const hash = window.location.hash.replace("#", "");
  if (!hash) return 0;
  const idx = presets.findIndex((p) => presetSlug(p.name) === hash);
  return idx >= 0 ? idx : 0;
}

export default function Home() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [fps, setFps] = useState(0);
  const [uiVisible, setUiVisible] = useState(true);
  const [vizControls, setVizControls] = useState<ControlDef[]>([]);
  const [hudInfo, setHudInfo] = useState<InfoState>({ title: "", description: "" });
  const [morphValue, setMorphValue] = useState(initialPresetIndex);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [loadingStatus] = useState("Loading models...");
  const [sceneReady, setSceneReady] = useState(false);
  const [minimumLoaderElapsed, setMinimumLoaderElapsed] = useState(false);
  const labelOpacityRef = useRef(0);

  const controlMgrRef = useRef(new ControlManager());
  const morphStateRef = useRef(createMorphState());
  const modelDataRef = useRef<(ModelData | undefined)[]>(presets.map(() => undefined));
  const projectedLabelsRef = useRef<ProjectedLabel[]>([]);

  const animRef = useRef<{ target: number; raf: number } | null>(null);
  const handlePresetClickRef = useRef<(idx: number) => void>(() => {});

  useEffect(() => {
    const id = window.setTimeout(
      () => setMinimumLoaderElapsed(true),
      MIN_STARTUP_LOADER_MS,
    );
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    morphStateRef.current.value = morphValue;

    let cancelled = false;

    async function init() {
      const modelLoads = presets.map((p) =>
        p.modelUrl ? loadModelPoints(p.modelUrl) : Promise.resolve(undefined),
      );

      try {
        const results = await Promise.all(modelLoads);
        if (cancelled) return;
        modelDataRef.current = results;
      } catch (err) {
        console.error("Failed to load model(s):", err);
      }

      controlMgrRef.current.loadPreset(presets[initialPresetIndex()]);
      setModelsLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const nearest = Math.round(morphValue);
    if (Math.abs(morphValue - nearest) < 0.01 && nearest >= 0 && nearest < presets.length) {
      const slug = presetSlug(presets[nearest].name);
      if (window.location.hash !== `#${slug}`) {
        history.replaceState(null, "", `#${slug}`);
      }
    }
  }, [morphValue]);

  useEffect(() => {
    const interval = setInterval(() => {
      const mgr = controlMgrRef.current;
      if (mgr.dirty) {
        mgr.dirty = false;
        setVizControls(Array.from(mgr.controls.values()));
        setHudInfo({ ...mgr.info });
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const cancelAnim = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current.raf);
      animRef.current = null;
    }
  }, []);

  const handleMorphChange = useCallback((v: number) => {
    cancelAnim();
    setMorphValue(v);
    morphStateRef.current.value = v;
  }, [cancelAnim]);

  useEffect(() => {
    const maxVal = presets.length - 1;

    const applyDelta = (delta: number) => {
      setMorphValue((prev) => {
        const next = Math.max(0, Math.min(maxVal, prev + delta));
        morphStateRef.current.value = next;
        return next;
      });
      cancelAnim();
    };

    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".control-panel, .system-panel, .system-dropdown")) return;
      e.preventDefault();
      applyDelta(e.deltaY > 0 ? 0.01 : -0.01);
    };

    let touchStartY = 0;
    let lastTouchY = 0;

    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      lastTouchY = touchStartY;
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const currentY = e.touches[0].clientY;
      const dy = lastTouchY - currentY;
      lastTouchY = currentY;
      const sensitivity = maxVal / (window.innerHeight * 0.6);
      applyDelta(dy * sensitivity);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setMorphValue((prev) => {
          const target = Math.min(maxVal, Math.floor(prev) + 1);
          if (target === Math.round(prev) && target < maxVal) {
            handlePresetClickRef.current(target + 1);
          } else {
            handlePresetClickRef.current(target);
          }
          return prev;
        });
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setMorphValue((prev) => {
          const target = Math.max(0, Math.ceil(prev) - 1);
          if (target === Math.round(prev) && target > 0) {
            handlePresetClickRef.current(target - 1);
          } else {
            handlePresetClickRef.current(target);
          }
          return prev;
        });
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [cancelAnim]);

  const handlePresetClick = useCallback((idx: number) => {
    cancelAnim();

    const anim = { target: idx, raf: 0 };
    animRef.current = anim;

    const tick = () => {
      if (animRef.current !== anim) return;
      const current = morphStateRef.current.value;
      const diff = anim.target - current;

      if (Math.abs(diff) < 0.005) {
        morphStateRef.current.value = anim.target;
        setMorphValue(anim.target);
        animRef.current = null;
        return;
      }

      const speed = 4.0;
      const dt = 1 / 60;
      const step = diff * (1 - Math.exp(-speed * dt));
      const next = current + step;
      morphStateRef.current.value = next;
      setMorphValue(next);
      anim.raf = requestAnimationFrame(tick);
    };

    anim.raf = requestAnimationFrame(tick);
  }, [cancelAnim]);

  handlePresetClickRef.current = handlePresetClick;

  const handleControlChange = useCallback((id: string, value: number) => {
    controlMgrRef.current.setControlValue(id, value);
  }, []);

  const handleSceneReady = useCallback(() => {
    setSceneReady(true);
  }, []);

  const [introDone, setIntroDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setIntroDone(true), 3000);
    return () => clearTimeout(id);
  }, []);

  const fadeClass = introDone ? "" : "ui-fade-in";

  const RACECAR_GLOW: [number, number, number] = [0.3, 0.35, 0.55];

  const glowRef = useRef<HTMLDivElement>(null);
  const glowRafRef = useRef<number>(0);

  const glowStyle = useMemo(() => {
    const intensity = settings.glowIntensity;
    if (intensity <= 0) return { display: "none" as const };

    let r: number, g: number, bl: number;

    if (settings.colorMode === 1) {
      r = Math.round(RACECAR_GLOW[0] * 255);
      g = Math.round(RACECAR_GLOW[1] * 255);
      bl = Math.round(RACECAR_GLOW[2] * 255);
    } else if (settings.colorMode === 2) {
      r = 45; g = 172; bl = 249;
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
  }, [morphValue, settings.glowIntensity, settings.colorMode]);

  useEffect(() => {
    if (settings.colorMode !== 2) {
      cancelAnimationFrame(glowRafRef.current);
      return;
    }
    const intensity = settings.glowIntensity;
    const tick = () => {
      const el = glowRef.current;
      if (!el) { glowRafRef.current = requestAnimationFrame(tick); return; }
      const t = (performance.now() / 1000) * 0.25;
      const hue = (t * 0.51) % 1;
      const sat = 80 + Math.sin(t) * 15;
      const lum = 55 + 25 * Math.cos(t);
      const hDeg = Math.round(hue * 360);
      const inner = intensity;
      const mid = intensity * 0.3;
      el.style.background = `radial-gradient(ellipse at 50% 50%, hsla(${hDeg},${Math.round(sat)}%,${Math.round(lum)}%,${inner}) 0%, hsla(${hDeg},${Math.round(sat)}%,${Math.round(lum)}%,${mid}) 40%, transparent 70%)`;
      glowRafRef.current = requestAnimationFrame(tick);
    };
    glowRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(glowRafRef.current);
  }, [settings.colorMode, settings.glowIntensity]);

  const showStartupLoader = modelsLoading || !sceneReady || !minimumLoaderElapsed;
  const loaderMessage = modelsLoading ? loadingStatus : "Initializing Particles...";

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

  return (
    <div className="visualizer-root">
      <Suspense fallback={<div className="loading-screen"><LoaderRunner /><div className="loading-text">Initializing Particles...</div></div>}>
        <ParticleCanvas
          settings={settings}
          controlMgr={controlMgrRef.current}
          presets={presets}
          morphValue={morphValue}
          modelData={modelDataRef.current}
          onFpsUpdate={setFps}
          onReady={handleSceneReady}
          labelsRef={projectedLabelsRef}
          labelOpacityRef={labelOpacityRef}
        />
      </Suspense>

      <LabelOverlay
        labelsRef={projectedLabelsRef}
        opacityRef={labelOpacityRef}
      />

      <div ref={glowRef} style={glowStyle} />

      {uiVisible && <div className={`dot-grid ${fadeClass}`} />}

      {uiVisible && <div className={fadeClass}><HUD info={hudInfo} /></div>}

      <div className={fadeClass} style={{ position: "relative", zIndex: 20 }}>
        <SystemPanel
          settings={settings}
          onSettingsChange={setSettings}
          fps={fps}
          uiVisible={uiVisible}
          onToggleUi={() => setUiVisible((v) => !v)}
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
}
