import { useEffect, useRef, type MutableRefObject } from "react";
import type { ProjectedLabel } from "~/lib/label-projection";

interface Props {
  labelsRef: MutableRefObject<ProjectedLabel[]>;
  opacityRef: MutableRefObject<number>;
}

export default function LabelOverlay({ labelsRef, opacityRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const labelEls = new Map<string, HTMLDivElement>();
    const lineEls = new Map<string, SVGLineElement>();
    let svgEl: SVGSVGElement | null = null;

    const tick = () => {
      const container = containerRef.current;
      if (!container) { raf = requestAnimationFrame(tick); return; }

      const labels = labelsRef.current;
      const opacity = opacityRef.current;
      container.style.opacity = String(opacity);

      if (!svgEl) {
        svgEl = container.querySelector("svg");
      }

      const activeIds = new Set<string>();

      for (const l of labels) {
        activeIds.add(l.id);

        if (!l.visible) {
          labelEls.get(l.id)?.remove();
          labelEls.delete(l.id);
          lineEls.get(l.id)?.remove();
          lineEls.delete(l.id);
          continue;
        }

        let el = labelEls.get(l.id);
        if (!el) {
          el = document.createElement("div");
          el.className = "scene-label";
          el.textContent = l.text;
          container.appendChild(el);
          labelEls.set(l.id, el);
        }
        el.style.left = `${l.labelX}px`;
        el.style.top = `${l.labelY}px`;

        if (svgEl) {
          let line = lineEls.get(l.id);
          if (!line) {
            line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.classList.add("label-connector");
            svgEl.appendChild(line);
            lineEls.set(l.id, line);
          }
          line.setAttribute("x1", String(l.labelX));
          line.setAttribute("y1", String(l.labelY));
          line.setAttribute("x2", String(l.anchorX));
          line.setAttribute("y2", String(l.anchorY));
        }
      }

      for (const [id, el] of labelEls) {
        if (!activeIds.has(id)) { el.remove(); labelEls.delete(id); }
      }
      for (const [id, el] of lineEls) {
        if (!activeIds.has(id)) { el.remove(); lineEls.delete(id); }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      labelEls.forEach((el) => el.remove());
      lineEls.forEach((el) => el.remove());
    };
  }, [labelsRef, opacityRef]);

  return (
    <div ref={containerRef} className="label-overlay">
      <svg className="label-lines" />
    </div>
  );
}
