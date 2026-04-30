import { createRoot } from "react-dom/client";

import Home from "~/routes/home";

import "./app.css";
import "./styles/visualizer.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing root element");
}

createRoot(rootElement).render(<Home />);
