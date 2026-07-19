import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/index.css";

const elementoRadice = document.getElementById("root");
if (!elementoRadice) {
  throw new Error("Elemento #root non trovato in index.html");
}

createRoot(elementoRadice).render(
  <StrictMode>
    <App />
  </StrictMode>
);
