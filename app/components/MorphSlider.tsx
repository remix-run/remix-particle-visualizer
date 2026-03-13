import { useCallback, useRef, useEffect } from "react";
import type { Preset } from "~/lib/types";

interface Props {
  presets: Preset[];
  value: number;
  playing: boolean;
  onValueChange: (v: number) => void;
  onPresetClick: (idx: number) => void;
  onTogglePlay: () => void;
  onEdit: () => void;
  disabled?: boolean;
}

export default function MorphSlider({
  presets,
  value,
  playing,
  onValueChange,
  onPresetClick,
  onTogglePlay,
  onEdit,
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
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      return x * maxValue;
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
      <div className="morph-labels">
        {presets.map((p, idx) => {
          const dist = Math.abs(value - idx);
          const active = dist < 0.3;
          return (
            <button
              key={p.name}
              className={`morph-label ${active ? "morph-label-active" : ""}`}
              onClick={() => !disabled && onPresetClick(idx)}
              style={{ opacity: disabled ? 0.4 : 1 }}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      <div
        ref={trackRef}
        className="morph-track"
        onMouseDown={handlePointerDown}
        style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? "none" : "auto" }}
      >
        <div className="morph-track-fill" style={{ width: `${pct}%` }} />
        <div className="morph-thumb" style={{ left: `${pct}%` }} />
        {presets.map((_, stop) => (
          <div
            key={stop}
            className={`morph-stop ${Math.abs(value - stop) < 0.05 ? "morph-stop-active" : ""}`}
            style={{ left: `${(stop / maxValue) * 100}%` }}
          />
        ))}
      </div>

      <div className="morph-buttons">
        <button
          className="morph-btn"
          onClick={onTogglePlay}
          title={playing ? "Pause" : "Play auto-cycle"}
          disabled={disabled}
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="2" width="4" height="12" rx="1" />
              <rect x="9" y="2" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2l10 6-10 6V2z" />
            </svg>
          )}
        </button>
        <button
          className="morph-btn"
          onClick={onEdit}
          title="Edit preset code"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
