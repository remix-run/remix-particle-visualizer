import { on, type Handle, type RemixNode } from "remix/ui";
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

type SettingKey = keyof SystemSettings;

export default function SystemPanel(handle: Handle<Props>) {
  let open = false;
  let copyOpen = false;
  let copied = false;
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  handle.signal.addEventListener("abort", () => clearTimeout(copiedTimer));

  const update = (partial: Partial<SystemSettings>) => {
    handle.props.onSettingsChange({ ...handle.props.settings, ...partial });
  };

  const updateNumber = (key: SettingKey, value: number) => {
    update({ [key]: value } as Partial<SystemSettings>);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(COPY_PROMPT).then(() => {
      copied = true;
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => {
        copied = false;
        handle.update();
      }, 2000);
      handle.update();
    });
  };

  const renderSlider = (
    label: string,
    key: SettingKey,
    value: number,
    min: number,
    max: number,
    step: number,
    format: (value: number) => RemixNode,
    parse: (value: string) => number = parseFloat,
  ) => (
    <div className="control-row">
      <label className="control-label">{label}</label>
      <div className="control-slider-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          mix={on<HTMLInputElement>("input", (event) =>
            updateNumber(key, parse(event.currentTarget.value)),
          )}
          className="control-slider"
          style={sliderFillStyle(value, min, max)}
        />
        <span className="control-value">{format(value)}</span>
      </div>
    </div>
  );

  return () => {
    const { settings, fps, uiVisible, onToggleUi } = handle.props;

    return (
      <div className="system-panel">
        <div className="system-top-row">
          {settings.showFps && (
            <div className="fps-counter">{fps} FPS</div>
          )}
          {uiVisible && (
            <button
              className={`system-toggle ${open ? "system-toggle-active" : ""}`}
              mix={on("click", () => {
                open = !open;
                handle.update();
              })}
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
              mix={on("click", () => {
                copyOpen = true;
                handle.update();
              })}
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
            mix={on("click", onToggleUi)}
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

            {renderSlider("Particles", "particleCount", settings.particleCount, 1000, 500000, 1000, (value) => `${(value / 1000).toFixed(0)}k`, parseInt)}
            {renderSlider("Point Size", "pointSize", settings.pointSize, 0.1, 5, 0.1, (value) => value.toFixed(1))}

            <div className="control-row">
              <label className="control-label">Background</label>
              <input
                type="color"
                value={settings.backgroundColor}
                mix={on<HTMLInputElement>("input", (event) =>
                  update({ backgroundColor: event.currentTarget.value }),
                )}
                className="color-picker"
              />
            </div>

            {renderSlider("Bloom", "bloomStrength", settings.bloomStrength, 0, 3, 0.05, (value) => value.toFixed(1))}
            {renderSlider("Bloom Threshold", "bloomThreshold", settings.bloomThreshold, 0, 1, 0.01, (value) => value.toFixed(2))}
            {renderSlider("Trail Intensity", "trailIntensity", settings.trailIntensity, 0, 0.98, 0.01, (value) => value.toFixed(2))}
            {renderSlider("HDR Intensity", "hdrIntensity", settings.hdrIntensity, 0.5, 5, 0.1, (value) => value.toFixed(1))}
            {renderSlider("Cursor Repulsion", "cursorRepulsion", settings.cursorRepulsion, 0, 10, 0.1, (value) => value.toFixed(1))}
            {renderSlider("Morph Ease", "morphEase", settings.morphEase, 0.5, 5, 0.1, (value) => value.toFixed(1))}
            {renderSlider("Ambient Glow", "glowIntensity", settings.glowIntensity, 0, 0.5, 0.01, (value) => value.toFixed(2))}
            {renderSlider("Depth of Field", "dofAmount", settings.dofAmount, 0, 5, 0.1, (value) => value.toFixed(1))}
            {renderSlider("Focus Distance", "dofFocus", settings.dofFocus, 5, 300, 1, (value) => value, parseFloat)}
            {renderSlider("Camera FOV", "cameraFov", settings.cameraFov, 30, 120, 1, (value) => `${value}\u00B0`, parseInt)}

            <div className="control-row">
              <label className="control-label">Color Mode</label>
              <select
                className="color-mode-select"
                value={settings.colorMode}
                mix={on<HTMLSelectElement>("change", (event) =>
                  update({ colorMode: parseInt(event.currentTarget.value) }),
                )}
              >
                <option value={0}>Per-Preset</option>
                <option value={1}>Uniform</option>
                <option value={2}>Brand Gradient</option>
              </select>
            </div>

            <div className="control-row">
              <label className="control-label">Show FPS</label>
              <button
                className={`toggle-btn ${settings.showFps ? "toggle-on" : ""}`}
                mix={on("click", () => update({ showFps: !settings.showFps }))}
              >
                {settings.showFps ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        )}

        {copyOpen && (
          <div
            className="copy-backdrop"
            mix={[
              on("click", () => {
                copyOpen = false;
                handle.update();
              }),
              on<HTMLDivElement>("wheel", (event) => event.stopPropagation()),
              on<HTMLDivElement>("touchmove", (event) => event.stopPropagation()),
            ]}
          >
            <div
              className="copy-modal"
              mix={on("click", (event) => event.stopPropagation())}
            >
              <div className="copy-modal-header">
                <span className="copy-modal-title">AI Prompt</span>
                <div className="copy-modal-actions">
                  <button className="copy-modal-btn" mix={on("click", handleCopy)}>
                    {copied ? "Copied!" : "Copy to Clipboard"}
                  </button>
                  <button
                    className="copy-modal-btn"
                    mix={on("click", () => {
                      copyOpen = false;
                      handle.update();
                    })}
                  >
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
  };
}
