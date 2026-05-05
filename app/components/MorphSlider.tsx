import { on, ref, type Handle } from "remix/ui";
import type { Preset } from "~/lib/types";

interface Props {
  presets: Preset[];
  value: number;
  onValueChange: (v: number) => void;
  onPresetClick: (idx: number) => void;
  disabled?: boolean;
}

export default function MorphSlider(handle: Handle<Props>) {
  let track: HTMLDivElement | null = null;
  let dragging = false;

  const valueFromEvent = (event: MouseEvent) => {
    if (!track) return handle.props.value;

    const maxValue = handle.props.presets.length - 1;
    const rect = track.getBoundingClientRect();
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    return y * maxValue;
  };

  const handlePointerDown = (event: MouseEvent) => {
    if (handle.props.disabled) return;
    dragging = true;
    handle.props.onValueChange(valueFromEvent(event));
    event.preventDefault();
  };

  const handleMove = (event: MouseEvent) => {
    if (!dragging) return;
    handle.props.onValueChange(valueFromEvent(event));
  };
  const handleUp = () => {
    dragging = false;
  };

  if (typeof window !== "undefined") {
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    handle.signal.addEventListener("abort", () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    });
  }

  return () => {
    const { presets, value, onPresetClick, disabled } = handle.props;
    const maxValue = presets.length - 1;
    const pct = (value / maxValue) * 100;

    return (
      <div className="morph-slider-container">
        <div className="morph-track-area">
          <div
            mix={[
              ref((node) => {
                track = node;
              }),
              on<HTMLDivElement, "mousedown">("mousedown", handlePointerDown),
            ]}
            className="morph-track"
            style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? "none" : "auto" }}
          >
            <div className="morph-track-fill" style={{ top: -5, height: `calc(${pct}% + 10px)` }} />
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
            {presets.map((preset, idx) => {
              const dist = Math.abs(value - idx);
              const active = dist < 0.3;
              return (
                <button
                  key={preset.name}
                  className={`morph-label ${active ? "morph-label-active" : ""}`}
                  mix={on("click", () => {
                    if (!disabled) onPresetClick(idx);
                  })}
                  style={{
                    opacity: disabled ? 0.4 : 1,
                    top: `${(idx / maxValue) * 100}%`,
                  }}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };
}
