import { useState, useRef, useCallback } from "react";
import type { SystemSettings } from "~/lib/types";
import { sliderFillStyle } from "~/lib/ui-utils";
import { COPY_PROMPT } from "~/lib/copy-prompt";

interface Props {
  settings: SystemSettings;
  onSettingsChange: (s: SystemSettings) => void;
  fps: number;
  uiVisible: boolean;
  onToggleUi: () => void;
}

export default function SystemPanel({ settings, onSettingsChange, fps, uiVisible, onToggleUi }: Props) {
  const [open, setOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(COPY_PROMPT).then(() => {
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const update = (partial: Partial<SystemSettings>) =>
    onSettingsChange({ ...settings, ...partial });

  return (
    <div className="system-panel">
      <div className="system-top-row">
        {settings.showFps && (
          <div className="fps-counter">{fps} FPS</div>
        )}
        {uiVisible && (
          <button
            className="system-toggle"
            onClick={() => setOpen(!open)}
            title="System Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
        {uiVisible && (
          <button
            className="system-toggle"
            onClick={() => setCopyOpen(true)}
            title="Copy AI Prompt"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
          </button>
        )}
        <button
          className="system-toggle"
          onClick={onToggleUi}
          title={uiVisible ? "Hide UI" : "Show UI"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {uiVisible ? (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            ) : (
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open && uiVisible && (
        <div className="system-dropdown">
          <div className="panel-header">System Settings</div>

          <div className="control-row">
            <label className="control-label">Particles</label>
            <div className="control-slider-row">
              <input
                type="range"
                min={1000}
                max={500000}
                step={1000}
                value={settings.particleCount}
                onChange={(e) => update({ particleCount: parseInt(e.target.value) })}
                className="control-slider"
                style={sliderFillStyle(settings.particleCount, 1000, 500000)}
              />
              <span className="control-value">{(settings.particleCount / 1000).toFixed(0)}k</span>
            </div>
          </div>

          <div className="control-row">
            <label className="control-label">Point Size</label>
            <div className="control-slider-row">
              <input
                type="range"
                min={0.1}
                max={5}
                step={0.1}
                value={settings.pointSize}
                onChange={(e) => update({ pointSize: parseFloat(e.target.value) })}
                className="control-slider"
                style={sliderFillStyle(settings.pointSize, 0.1, 5)}
              />
              <span className="control-value">{settings.pointSize.toFixed(1)}</span>
            </div>
          </div>

          <div className="control-row">
            <label className="control-label">Background</label>
            <input
              type="color"
              value={settings.backgroundColor}
              onChange={(e) => update({ backgroundColor: e.target.value })}
              className="color-picker"
            />
          </div>

          <div className="control-row">
            <label className="control-label">Bloom</label>
            <div className="control-slider-row">
              <input
                type="range"
                min={0}
                max={3}
                step={0.05}
                value={settings.bloomStrength}
                onChange={(e) => update({ bloomStrength: parseFloat(e.target.value) })}
                className="control-slider"
                style={sliderFillStyle(settings.bloomStrength, 0, 3)}
              />
              <span className="control-value">{settings.bloomStrength.toFixed(1)}</span>
            </div>
          </div>

          <div className="control-row">
            <label className="control-label">Bloom Threshold</label>
            <div className="control-slider-row">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.bloomThreshold}
                onChange={(e) => update({ bloomThreshold: parseFloat(e.target.value) })}
                className="control-slider"
                style={sliderFillStyle(settings.bloomThreshold, 0, 1)}
              />
              <span className="control-value">{settings.bloomThreshold.toFixed(2)}</span>
            </div>
          </div>

          <div className="control-row">
            <label className="control-label">HDR Intensity</label>
            <div className="control-slider-row">
              <input
                type="range"
                min={0.5}
                max={5}
                step={0.1}
                value={settings.hdrIntensity}
                onChange={(e) => update({ hdrIntensity: parseFloat(e.target.value) })}
                className="control-slider"
                style={sliderFillStyle(settings.hdrIntensity, 0.5, 5)}
              />
              <span className="control-value">{settings.hdrIntensity.toFixed(1)}</span>
            </div>
          </div>

          <div className="control-row">
            <label className="control-label">Cursor Repulsion</label>
            <div className="control-slider-row">
              <input
                type="range"
                min={0}
                max={10}
                step={0.1}
                value={settings.cursorRepulsion}
                onChange={(e) => update({ cursorRepulsion: parseFloat(e.target.value) })}
                className="control-slider"
                style={sliderFillStyle(settings.cursorRepulsion, 0, 10)}
              />
              <span className="control-value">{settings.cursorRepulsion.toFixed(1)}</span>
            </div>
          </div>

          <div className="control-row">
            <label className="control-label">Ambient Glow</label>
            <div className="control-slider-row">
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.01}
                value={settings.glowIntensity}
                onChange={(e) => update({ glowIntensity: parseFloat(e.target.value) })}
                className="control-slider"
                style={sliderFillStyle(settings.glowIntensity, 0, 0.5)}
              />
              <span className="control-value">{settings.glowIntensity.toFixed(2)}</span>
            </div>
          </div>

          <div className="control-row">
            <label className="control-label">Depth of Field</label>
            <div className="control-slider-row">
              <input
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={settings.dofAmount}
                onChange={(e) => update({ dofAmount: parseFloat(e.target.value) })}
                className="control-slider"
                style={sliderFillStyle(settings.dofAmount, 0, 5)}
              />
              <span className="control-value">{settings.dofAmount.toFixed(1)}</span>
            </div>
          </div>

          <div className="control-row">
            <label className="control-label">Focus Distance</label>
            <div className="control-slider-row">
              <input
                type="range"
                min={5}
                max={300}
                step={1}
                value={settings.dofFocus}
                onChange={(e) => update({ dofFocus: parseFloat(e.target.value) })}
                className="control-slider"
                style={sliderFillStyle(settings.dofFocus, 5, 300)}
              />
              <span className="control-value">{settings.dofFocus}</span>
            </div>
          </div>

          <div className="control-row">
            <label className="control-label">Camera FOV</label>
            <div className="control-slider-row">
              <input
                type="range"
                min={30}
                max={120}
                step={1}
                value={settings.cameraFov}
                onChange={(e) => update({ cameraFov: parseInt(e.target.value) })}
                className="control-slider"
                style={sliderFillStyle(settings.cameraFov, 30, 120)}
              />
              <span className="control-value">{settings.cameraFov}°</span>
            </div>
          </div>

          <div className="control-row">
            <label className="control-label">Show FPS</label>
            <button
              className={`toggle-btn ${settings.showFps ? "toggle-on" : ""}`}
              onClick={() => update({ showFps: !settings.showFps })}
            >
              {settings.showFps ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      )}

      {copyOpen && (
        <div className="copy-backdrop" onClick={() => setCopyOpen(false)} onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
          <div className="copy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="copy-modal-header">
              <span className="copy-modal-title">AI Prompt</span>
              <div className="copy-modal-actions">
                <button className="copy-modal-btn" onClick={handleCopy}>
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </button>
                <button className="copy-modal-btn" onClick={() => setCopyOpen(false)}>
                  Close
                </button>
              </div>
            </div>
            <pre className="copy-code-block"><code>{COPY_PROMPT}</code></pre>
          </div>
        </div>
      )}
    </div>
  );
}
