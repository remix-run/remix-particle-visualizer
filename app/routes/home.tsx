import { Suspense, lazy, useState, useRef, useCallback, useEffect } from "react";
import type { Route } from "./+types/home";
import { presets } from "~/lib/presets";
import { compile } from "~/lib/executor";
import { validate } from "~/lib/validator";
import { ControlManager } from "~/lib/controls";
import { createMorphState, tickAutoPlay, getActiveFunctions, getNearestStop } from "~/lib/morph";
import { loadModelPoints } from "~/lib/model-loader";
import type { ModelData } from "~/lib/model-loader";
import type { ParticleFn, SystemSettings, ControlDef, InfoState } from "~/lib/types";
import { DEFAULT_SETTINGS } from "~/lib/types";
import MorphSlider from "~/components/MorphSlider";
import ControlPanel from "~/components/ControlPanel";
import SystemPanel from "~/components/SystemPanel";
import HUD from "~/components/HUD";

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
  const [playing, setPlaying] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(() =>
    presets.some((p) => p.modelUrl),
  );

  const controlMgrRef = useRef(new ControlManager());
  const morphStateRef = useRef(createMorphState());
  const compiledPresetsRef = useRef<ParticleFn[]>([]);
  const presetCodesRef = useRef<string[]>(presets.map((p) => p.code));
  const modelDataRef = useRef<(ModelData | undefined)[]>(presets.map(() => undefined));
  const lastTickRef = useRef(performance.now());
  const animRef = useRef<{ target: number; raf: number } | null>(null);

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
    if (!playing) return;
    morphStateRef.current.playing = true;

    let raf: number;
    const tick = () => {
      const now = performance.now();
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      const newValue = tickAutoPlay(morphStateRef.current, dt, presets.length - 1);
      setMorphValue(newValue);
      raf = requestAnimationFrame(tick);
    };
    lastTickRef.current = performance.now();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      morphStateRef.current.playing = false;
    };
  }, [playing]);

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
    if (playing) {
      setPlaying(false);
    }
  }, [playing, cancelAnim]);

  const handlePresetClick = useCallback((idx: number) => {
    if (playing) setPlaying(false);
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
  }, [playing, cancelAnim]);

  const handleTogglePlay = useCallback(() => {
    cancelAnim();
    setPlaying((p) => !p);
  }, [cancelAnim]);

  const handleEdit = useCallback(() => {
    if (playing) setPlaying(false);
    const stop = getNearestStop(morphValue, presets.length - 1);
    setMorphValue(stop);
    morphStateRef.current.value = stop;
    setEditing(true);
    setEditError(null);
  }, [morphValue, playing]);

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

  const editingStop = getNearestStop(morphValue, presets.length - 1);

  if (modelsLoading) {
    return (
      <div className="visualizer-root">
        <div className="loading-screen">
          <div className="loading-text">Loading models...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="visualizer-root">
      <Suspense fallback={<div className="loading-screen"><div className="loading-text">Initializing particles...</div></div>}>
        <ParticleCanvas
          settings={settings}
          controlMgr={controlMgrRef.current}
          presets={presets}
          morphValue={morphValue}
          getActiveFn={getActiveFn}
          onFpsUpdate={setFps}
        />
      </Suspense>

      <div className="dot-grid ui-fade-in" />

      {uiVisible && <div className="ui-fade-in"><HUD info={hudInfo} /></div>}

      <div className="ui-fade-in" style={{ position: "relative", zIndex: 20 }}>
        <SystemPanel
          settings={settings}
          onSettingsChange={setSettings}
          fps={fps}
          uiVisible={uiVisible}
          onToggleUi={() => setUiVisible((v) => !v)}
        />
      </div>

      {uiVisible && (
        <div className="ui-fade-in">
          <ControlPanel
            controls={vizControls}
            onControlChange={handleControlChange}
          />
        </div>
      )}

      {uiVisible && (
        <div className="ui-fade-in">
          <MorphSlider
            presets={presets}
            value={morphValue}
            playing={playing}
            onValueChange={handleMorphChange}
            onPresetClick={handlePresetClick}
            onTogglePlay={handleTogglePlay}
            onEdit={handleEdit}
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
