import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { ProjectedLabel } from "~/lib/label-projection";

interface Props {
  labelsRef: MutableRefObject<ProjectedLabel[]>;
  opacityRef: MutableRefObject<number>;
}

export default function LabelOverlay({ labelsRef, opacityRef }: Props) {
  const [labels, setLabels] = useState<ProjectedLabel[]>([]);
  const [opacity, setOpacity] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const tick = () => {
      setLabels(labelsRef.current);
      setOpacity(opacityRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [labelsRef, opacityRef]);

  if (opacity <= 0 || labels.length === 0) return null;

  return (
    <div className="label-overlay" style={{ opacity }}>
      <svg className="label-lines">
        <defs>
          <filter id="line-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {labels.map(
          (l) =>
            l.visible && (
              <line
                key={l.id}
                x1={l.labelX}
                y1={l.labelY}
                x2={l.anchorX}
                y2={l.anchorY}
                className="label-connector"
              />
            ),
        )}
      </svg>
      {labels.map(
        (l) =>
          l.visible && (
            <div
              key={l.id}
              className="scene-label"
              style={{
                left: l.labelX,
                top: l.labelY,
              }}
            >
              {l.text}
            </div>
          ),
      )}
    </div>
  );
}
