const BRAND_BLUE = "#2dacf9";
const TRACK_BG = "rgba(255, 255, 255, 0.08)";

export function sliderFillStyle(value: number, min: number, max: number): { background: string } {
  const pct = ((value - min) / (max - min)) * 100;
  return {
    background: `linear-gradient(to right, ${BRAND_BLUE} ${pct}%, ${TRACK_BG} ${pct}%)`,
  };
}
