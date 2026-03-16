import { useState, useEffect, useRef } from "react";
import type { InfoState } from "~/lib/types";

interface Props {
  info: InfoState;
}

const TYPE_SPEED = 45;

export default function HUD({ info }: Props) {
  const [displayed, setDisplayed] = useState(info.title);
  const [typing, setTyping] = useState(false);
  const prevTitle = useRef(info.title);

  useEffect(() => {
    if (info.title === prevTitle.current) return;
    prevTitle.current = info.title;

    if (!info.title) {
      setDisplayed("");
      setTyping(false);
      return;
    }

    setDisplayed("");
    setTyping(true);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(info.title.slice(0, i));
      if (i >= info.title.length) {
        clearInterval(id);
        setTyping(false);
      }
    }, TYPE_SPEED);

    return () => clearInterval(id);
  }, [info.title]);

  return (
    <div className="hud">
      <img src="/remix-logo.svg" alt="Remix" className="hud-logo" />
      <h2 className="hud-title">
        <span className="hud-prefix">Particle Visualizer: </span>
        {displayed || "\u00A0"}
        {typing && <span className="hud-cursor">|</span>}
      </h2>
      {info.description && <p className="hud-desc">{info.description}</p>}
    </div>
  );
}
