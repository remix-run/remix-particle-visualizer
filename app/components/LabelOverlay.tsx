import { ref, type Handle } from "remix/ui";
import type { ProjectedLabel } from "~/lib/label-projection";

interface MutableRef<T> {
  current: T;
}

interface Props {
  labelsRef: MutableRef<ProjectedLabel[]>;
  opacityRef: MutableRef<number>;
}

export default function LabelOverlay(handle: Handle<Props>) {
  let container: HTMLDivElement | null = null;
  let raf = 0;
  const labelEls = new Map<string, HTMLDivElement>();
  const lineEls = new Map<string, SVGLineElement>();
  let svgEl: SVGSVGElement | null = null;

  const cleanupLabels = () => {
    cancelAnimationFrame(raf);
    labelEls.forEach((el) => el.remove());
    lineEls.forEach((el) => el.remove());
    labelEls.clear();
    lineEls.clear();
  };

  const tick = () => {
    if (!container) {
      raf = requestAnimationFrame(tick);
      return;
    }

    const labels = handle.props.labelsRef.current;
    const opacity = handle.props.opacityRef.current;
    container.style.opacity = String(opacity);

    if (!svgEl) {
      svgEl = container.querySelector("svg");
    }

    const activeIds = new Set<string>();

    for (const label of labels) {
      activeIds.add(label.id);

      if (!label.visible) {
        labelEls.get(label.id)?.remove();
        labelEls.delete(label.id);
        lineEls.get(label.id)?.remove();
        lineEls.delete(label.id);
        continue;
      }

      let el = labelEls.get(label.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "scene-label";
        el.textContent = label.text;
        container.appendChild(el);
        labelEls.set(label.id, el);
      }
      el.style.left = `${label.labelX}px`;
      el.style.top = `${label.labelY}px`;

      if (svgEl) {
        let line = lineEls.get(label.id);
        if (!line) {
          line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.classList.add("label-connector");
          svgEl.appendChild(line);
          lineEls.set(label.id, line);
        }
        line.setAttribute("x1", String(label.labelX));
        line.setAttribute("y1", String(label.labelY));
        line.setAttribute("x2", String(label.anchorX));
        line.setAttribute("y2", String(label.anchorY));
      }
    }

    for (const [id, el] of labelEls) {
      if (activeIds.has(id)) continue;
      el.remove();
      labelEls.delete(id);
    }
    for (const [id, el] of lineEls) {
      if (activeIds.has(id)) continue;
      el.remove();
      lineEls.delete(id);
    }

    raf = requestAnimationFrame(tick);
  };

  handle.signal.addEventListener("abort", cleanupLabels);

  return () => (
    <div
      mix={ref((node) => {
        if (container === node) return;
        cleanupLabels();
        container = node;
        svgEl = null;
        raf = requestAnimationFrame(tick);
      })}
      className="label-overlay"
    >
      <svg className="label-lines" />
    </div>
  );
}
