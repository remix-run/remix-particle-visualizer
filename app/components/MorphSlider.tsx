import { useCallback, useRef, useEffect } from "react";
import type { Preset } from "~/lib/types";

interface Props {
  presets: Preset[];
  value: number;
  onValueChange: (v: number) => void;
  onPresetClick: (idx: number) => void;
  disabled?: boolean;
}

export default function MorphSlider({
  presets,
  value,
  onValueChange,
  onPresetClick,
  disabled,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const maxValue = presets.length - 1;

  const valueFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      const track = trackRef.current;
      if (!track) return value;
      const rect = track.getBoundingClientRect();
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      return y * maxValue;
    },
    [value, maxValue],
  );

  const handlePointerDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      dragging.current = true;
      onValueChange(valueFromEvent(e));
      e.preventDefault();
    },
    [disabled, onValueChange, valueFromEvent],
  );

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      onValueChange(valueFromEvent(e));
    };
    const handleUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [onValueChange, valueFromEvent]);

  const pct = (value / maxValue) * 100;

  return (
    <div className="morph-slider-container">
      <div className="morph-track-area">
        <div
          ref={trackRef}
          className="morph-track"
          onMouseDown={handlePointerDown}
          style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? "none" : "auto" }}
        >
          <div className="morph-track-fill" style={{ height: `${pct}%` }} />
          <div className="morph-thumb" style={{ top: `${pct}%` }} />
          {presets.map((_, stop) => (
            <div
              key={stop}
              className={`morph-stop ${Math.abs(value - stop) < 0.05 ? "morph-stop-active" : ""}`}
              style={{ top: `${(stop / maxValue) * 100}%` }}
            />
          ))}
        </div>

        <div className="morph-labels">
          {presets.map((p, idx) => {
            const dist = Math.abs(value - idx);
            const active = dist < 0.3;
            return (
              <button
                key={p.name}
                className={`morph-label ${active ? "morph-label-active" : ""}`}
                onClick={() => !disabled && onPresetClick(idx)}
                style={{
                  opacity: disabled ? 0.4 : 1,
                  top: `${(idx / maxValue) * 100}%`,
                }}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
