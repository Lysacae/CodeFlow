import React from "react";
import ReactDOM from "react-dom/client";
import { listen } from "@tauri-apps/api/event";
import App from "./App";
import "@/styles/index.css";

function applyViewport(width?: number, height?: number) {
  const w = Math.max(320, Math.round(width ?? window.innerWidth));
  const h = Math.max(320, Math.round(height ?? window.innerHeight));
  const root = document.getElementById("root");
  for (const el of [document.documentElement, document.body, root]) {
    if (!el) continue;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
  }
}

applyViewport();
window.addEventListener("resize", () => applyViewport());
if ("__TAURI_INTERNALS__" in window) {
  void listen<{ width: number; height: number; scale: number }>("cf-resized", (event) => {
    const { width, height } = event.payload;
    // Une taille nulle correspond à une fenêtre minimisée (Alt+Tab) : ne pas figer le DOM.
    if (!width || !height) return;
    const scale = event.payload.scale || window.devicePixelRatio || 1;
    applyViewport(width / scale, height / scale);
  });
}
document.addEventListener(
  "contextmenu",
  (event) => {
    event.preventDefault();
  },
  true,
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
