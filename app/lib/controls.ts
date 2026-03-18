import type { ControlDef, InfoState, AnnotationDef } from "./types";

export class ControlManager {
  controls = new Map<string, ControlDef>();
  info: InfoState = { title: "", description: "" };
  annotations = new Map<string, AnnotationDef>();

  private frameControlIds = new Set<string>();
  dirty = false;

  beginFrame() {
    this.frameControlIds.clear();
  }

  endFrame() {
    let changed = false;
    for (const [id] of this.controls) {
      if (!this.frameControlIds.has(id)) {
        this.controls.delete(id);
        changed = true;
      }
    }
    if (changed) this.dirty = true;
  }

  addControl(id: string, label: string, min: number, max: number, initial: number): number {
    this.frameControlIds.add(id);
    const existing = this.controls.get(id);
    if (existing) {
      if (existing.initial !== initial) {
        existing.initial = initial;
        existing.value = initial;
        existing.label = label;
        existing.min = min;
        existing.max = max;
        this.dirty = true;
      }
      return existing.value;
    }
    const def: ControlDef = { id, label, min, max, value: initial, initial };
    this.controls.set(id, def);
    this.dirty = true;
    return initial;
  }

  setControlValue(id: string, value: number) {
    const ctrl = this.controls.get(id);
    if (ctrl) {
      ctrl.value = value;
    }
  }

  setInfo(title: string, description: string) {
    if (this.info.title !== title || this.info.description !== description) {
      this.info = { title, description };
      this.dirty = true;
    }
  }

  annotate(id: string, position: { x: number; y: number; z: number }, label: string) {
    this.annotations.set(id, {
      id,
      position: position as AnnotationDef["position"],
      label,
    });
  }

  reset() {
    this.controls.clear();
    this.annotations.clear();
    this.info = { title: "", description: "" };
    this.dirty = true;
  }
}
