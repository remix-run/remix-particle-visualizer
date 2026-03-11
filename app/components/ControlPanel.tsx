import type { ControlDef } from "~/lib/types";

interface Props {
  controls: ControlDef[];
  onControlChange: (id: string, value: number) => void;
}

export default function ControlPanel({ controls, onControlChange }: Props) {
  if (controls.length === 0) return null;

  return (
    <div className="control-panel">
      <div className="panel-header">Visualization Controls</div>
      {controls.map((ctrl) => (
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
            />
            <span className="control-value">{ctrl.value.toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
