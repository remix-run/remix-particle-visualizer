import type { ControlDef, InfoState, Preset } from "./types";

export class ControlManager {
  controls = new Map<string, ControlDef>();
  info: InfoState = { title: "", description: "" };
  dirty = false;

  loadPreset(preset: Preset) {
    this.controls.clear();
    const allControls = [...preset.controls, ...(preset.cameraControls ?? [])];
    for (const c of allControls) {
      this.controls.set(c.id, {
        id: c.id,
        label: c.label,
        min: c.min,
        max: c.max,
        value: c.initial,
        initial: c.initial,
      });
    }
    this.info = { ...preset.info };
    this.dirty = true;
  }

  setControlValue(id: string, value: number) {
    const ctrl = this.controls.get(id);
    if (ctrl) ctrl.value = value;
  }

  getControlValues(preset: Preset): number[] {
    return preset.controls.map((c) => {
      const ctrl = this.controls.get(c.id);
      return ctrl ? ctrl.value : c.initial;
    });
  }

  reset() {
    this.controls.clear();
    this.info = { title: "", description: "" };
    this.dirty = true;
  }
}
