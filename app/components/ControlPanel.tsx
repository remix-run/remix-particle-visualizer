import type { ControlDef } from "~/lib/types";
import { sliderFillStyle } from "~/lib/ui-utils";

interface Props {
  controls: ControlDef[];
  onControlChange: (id: string, value: number) => void;
}

function parseBinaryControl(ctrl: ControlDef): { label: string; options: [string, string] } | null {
  if (ctrl.min !== 0 || ctrl.max !== 1) return null;
  const parts = ctrl.label.split(" / ");
  if (parts.length !== 2) return null;
  const colonIdx = parts[0].lastIndexOf(": ");
  const label = colonIdx >= 0 ? parts[0].slice(0, colonIdx) : "";
  const first = colonIdx >= 0 ? parts[0].slice(colonIdx + 2) : parts[0];
  return { label: label || ctrl.label, options: [first.trim(), parts[1].trim()] };
}

export default function ControlPanel({ controls, onControlChange }: Props) {
  if (controls.length === 0) return null;

  return (
    <div className="control-panel">
      <div className="panel-header">Visualization Controls</div>
      {controls.map((ctrl) => {
        const binary = parseBinaryControl(ctrl);
        if (binary) {
          return (
            <div key={ctrl.id} className="control-row">
              <label className="control-label">{binary.label}</label>
              <div className="segmented-toggle">
                {binary.options.map((opt, idx) => (
                  <button
                    key={idx}
                    className={`segmented-btn ${Math.round(ctrl.value) === idx ? "segmented-active" : ""}`}
                    onClick={() => onControlChange(ctrl.id, idx)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        return (
          <div key={ctrl.id} className="control-row">
            <label className="control-label">{ctrl.label}</label>
            <div className="control-slider-row">
              <input
                type="range"
                min={ctrl.min}
                max={ctrl.max}
                step={(ctrl.max - ctrl.min) / 200}
                value={ctrl.value}
                onChange={(e) => onControlChange(ctrl.id, parseFloat(e.target.value))}
                className="control-slider"
                style={sliderFillStyle(ctrl.value, ctrl.min, ctrl.max)}
              />
              <span className="control-value">{ctrl.value.toFixed(2)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
