import { publicAssetPath } from "~/lib/public-assets";
import type { InfoState } from "~/lib/types";
import type { Handle } from "remix/ui";

interface Props {
  info: InfoState;
}

const TYPE_SPEED = 45;

export default function HUD(handle: Handle<Props>) {
  let displayed = handle.props.info.title;
  let typing = false;
  let prevTitle = handle.props.info.title;
  let typeTimer: ReturnType<typeof setInterval> | undefined;

  const clearTyping = () => {
    clearInterval(typeTimer);
    typeTimer = undefined;
  };

  const startTyping = (title: string) => {
    clearTyping();

    if (!title) {
      displayed = "";
      typing = false;
      handle.update();
      return;
    }

    displayed = "";
    typing = true;
    let index = 0;
    handle.update();

    typeTimer = setInterval(() => {
      index++;
      displayed = title.slice(0, index);
      if (index >= title.length) {
        clearTyping();
        typing = false;
      }
      handle.update();
    }, TYPE_SPEED);
  };

  handle.signal.addEventListener("abort", clearTyping);

  return () => {
    const { info } = handle.props;

    if (info.title !== prevTitle) {
      prevTitle = info.title;
      handle.queueTask(() => startTyping(info.title));
    }

    return (
      <div className="hud">
        <img src={publicAssetPath("remix-logo.svg")} alt="Remix" className="hud-logo" />
        <h2 className="hud-title">
          <span className="hud-prefix">Particle Visualizer: </span>
          {displayed || "\u00A0"}
          {typing && <span className="hud-cursor">|</span>}
        </h2>
        {info.description && <p className="hud-desc">{info.description}</p>}
        <p className="hud-hint">Scroll or press down and up arrows to cycle through presets</p>
      </div>
    );
  };
}
