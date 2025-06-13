import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// For MVP: No authentication wrapper needed
createRoot(document.getElementById("root")!).render(
  <App />
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((reg) => {
        console.log('✅ Service worker registered:', reg);
      })
      .catch((err) => {
        console.warn('❌ Service worker registration failed:', err);
      });
  });
}
