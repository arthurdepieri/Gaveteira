import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

interface PwaVersionInfo {
  version?: string;
  cacheName?: string;
  generatedAt?: string;
}

let pendingPwaRegistration: ServiceWorkerRegistration | null = null;
let reloadingForPwaUpdate = false;

async function readPwaVersion(): Promise<PwaVersionInfo> {
  try {
    const response = await fetch(`/pwa-version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return {};
    return await response.json() as PwaVersionInfo;
  } catch {
    return {};
  }
}

async function showPwaUpdate(registration: ServiceWorkerRegistration) {
  pendingPwaRegistration = registration;
  const version = await readPwaVersion();
  window.dispatchEvent(new CustomEvent("gaveteira:pwa-update-ready", { detail: version }));
}

function installPwaUpdateHandlers() {
  window.addEventListener("gaveteira:pwa-apply-update", () => {
    const waitingWorker = pendingPwaRegistration?.waiting;
    if (!waitingWorker) {
      window.location.reload();
      return;
    }

    reloadingForPwaUpdate = true;
    waitingWorker.postMessage({ type: "GAVETEIRA_SKIP_WAITING" });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloadingForPwaUpdate) return;
    window.location.reload();
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "GAVETEIRA_PWA_WAITING") {
      window.dispatchEvent(new CustomEvent("gaveteira:pwa-update-ready", { detail: event.data.detail || {} }));
    }
  });
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    installPwaUpdateHandlers();

    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          showPwaUpdate(registration);
        }

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;

          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              showPwaUpdate(registration);
            }
          });
        });

        window.setInterval(() => registration.update(), 60 * 60 * 1000);
      })
      .catch((error) => {
        console.warn("Não foi possível registrar o service worker da Gaveteira.", error);
      });
  });
}
