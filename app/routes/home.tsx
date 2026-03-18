import { Suspense, lazy, useState, useRef, useCallback, useEffect } from "react";
import type { Route } from "./+types/home";
import { presets } from "~/lib/presets";
import { compile } from "~/lib/executor";
import { benchmarkParticleCount } from "~/lib/benchmark";
import { validate } from "~/lib/validator";
import { ControlManager } from "~/lib/controls";
import { createMorphState, getActiveFunctions, getNearestStop } from "~/lib/morph";
import { loadModelPoints } from "~/lib/model-loader";
import type { ModelData } from "~/lib/model-loader";
import type { ParticleFn, SystemSettings, ControlDef, InfoState } from "~/lib/types";
import { DEFAULT_SETTINGS } from "~/lib/types";
import MorphSlider from "~/components/MorphSlider";
import ControlPanel from "~/components/ControlPanel";
import SystemPanel from "~/components/SystemPanel";
import HUD from "~/components/HUD";
import LoaderRunner from "~/components/LoaderRunner";

const ParticleCanvas = lazy(() => import("~/components/ParticleCanvas.client"));
const CodeEditor = lazy(() => import("~/components/CodeEditor.client"));

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

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Particle Visualizer" },
    { name: "description", content: "3D particle swarm visualizer with morphing presets" },
  ];
}


export default function Home() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [fps, setFps] = useState(0);
  const [uiVisible, setUiVisible] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [vizControls, setVizControls] = useState<ControlDef[]>([]);
  const [hudInfo, setHudInfo] = useState<InfoState>({ title: "", description: "" });
  const [morphValue, setMorphValue] = useState(initialPresetIndex);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("Loading models...");

  const controlMgrRef = useRef(new ControlManager());
  const morphStateRef = useRef(createMorphState());
  const compiledPresetsRef = useRef<ParticleFn[]>([]);
  const presetCodesRef = useRef<string[]>(presets.map((p) => p.code));
  const modelDataRef = useRef<(ModelData | undefined)[]>(presets.map(() => undefined));

  const animRef = useRef<{ target: number; raf: number } | null>(null);
  const handlePresetClickRef = useRef<(idx: number) => void>(() => {});

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

      setLoadingStatus("Calibrating performance…");
      try {
        const optimalCount = await benchmarkParticleCount();
        if (cancelled) return;
        console.log(`Benchmark: optimal particle count = ${optimalCount.toLocaleString()}`);
        setSettings((prev) => ({ ...prev, particleCount: optimalCount }));
      } catch (err) {
        console.warn("Benchmark failed, keeping default:", err);
      }

      const compiled: ParticleFn[] = [];
      for (let i = 0; i < presets.length; i++) {
        try {
          compiled.push(compile(presets[i].code, modelDataRef.current[i]));
        } catch {
          compiled.push((() => {}) as unknown as ParticleFn);
        }
      }
      compiledPresetsRef.current = compiled;
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

  const getActiveFn = useCallback(() => {
    const compiled = compiledPresetsRef.current;
    if (compiled.length === 0) {
      const noop = (() => {}) as unknown as ParticleFn;
      return { fnA: noop, fnB: null, blend: 0 };
    }
    return getActiveFunctions(compiled, morphValue);
  }, [morphValue]);

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
      e.preventDefault();
      applyDelta(e.deltaY > 0 ? 0.02 : -0.02);
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

  const handleEdit = useCallback(() => {
    cancelAnim();
    const stop = getNearestStop(morphValue, presets.length - 1);
    setMorphValue(stop);
    morphStateRef.current.value = stop;
    setEditing(true);
    setEditError(null);
  }, [morphValue, cancelAnim]);

  const handleDoneEditing = useCallback(() => {
    setEditing(false);
    setEditError(null);
  }, []);

  const handleCodeChange = useCallback((code: string) => {
    const stop = getNearestStop(morphStateRef.current.value, presets.length - 1);
    const result = validate(code);
    if (!result.valid) {
      setEditError(result.error || "Validation failed");
      return;
    }
    try {
      const fn = compile(code, modelDataRef.current[stop]);
      compiledPresetsRef.current[stop] = fn;
      presetCodesRef.current[stop] = code;
      setEditError(null);
    } catch (err) {
      setEditError(`Compile error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const handleControlChange = useCallback((id: string, value: number) => {
    controlMgrRef.current.setControlValue(id, value);
  }, []);

  const [introDone, setIntroDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setIntroDone(true), 3000);
    return () => clearTimeout(id);
  }, []);

  const fadeClass = introDone ? "" : "ui-fade-in";

  const editingStop = getNearestStop(morphValue, presets.length - 1);

  if (modelsLoading) {
    return (
      <div className="visualizer-root">
        <div className="loading-screen">
          <LoaderRunner />
          <div className="loading-text">{loadingStatus}</div>
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
          getActiveFn={getActiveFn}
          onFpsUpdate={setFps}
        />
      </Suspense>

      {uiVisible && <div className={`dot-grid ${fadeClass}`} />}

      {uiVisible && <div className={fadeClass}><HUD info={hudInfo} /></div>}

      <div className={fadeClass} style={{ position: "relative", zIndex: 20 }}>
        <SystemPanel
          settings={settings}
          onSettingsChange={setSettings}
          fps={fps}
          uiVisible={uiVisible}
          onToggleUi={() => setUiVisible((v) => !v)}
          onEdit={handleEdit}
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
            disabled={editing}
          />
        </div>
      )}

      {uiVisible && editing && (
        <Suspense fallback={<div className="editor-loading">Loading editor...</div>}>
          <CodeEditor
            code={presetCodesRef.current[editingStop]}
            presetName={presets[editingStop].name}
            error={editError}
            onCodeChange={handleCodeChange}
            onDone={handleDoneEditing}
          />
        </Suspense>
      )}
    </div>
  );
}
