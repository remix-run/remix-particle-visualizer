import { createRoot } from "remix/ui";

import Home from "~/routes/home";

import "./app.css";
import "./styles/visualizer.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing root element");
}

rootElement.replaceChildren();
createRoot(rootElement).render(<Home />);
