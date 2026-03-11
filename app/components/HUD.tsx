import type { InfoState } from "~/lib/types";

interface Props {
  info: InfoState;
}

export default function HUD({ info }: Props) {
  return (
    <div className="hud">
      <img src="/remix-logo.svg" alt="Remix" className="hud-logo" />
      <h2 className="hud-title">
        <span className="hud-prefix">Particle Visualizer: </span>
        {info.title || "\u00A0"}
      </h2>
      {info.description && <p className="hud-desc">{info.description}</p>}
    </div>
  );
}
