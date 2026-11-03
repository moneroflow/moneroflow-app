import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { native, isNative } from "./lib/native";

// Surface the native bridge on window for any legacy/inline handlers.
declare global {
  interface Window {
    moneroflowNative?: typeof native;
  }
}
window.moneroflowNative = native;

console.info(
  `[MoneroFlow] runtime: ${isNative() ? "native (Capacitor)" : "web browser"}`,
);

createRoot(document.getElementById("root")!).render(<App />);
