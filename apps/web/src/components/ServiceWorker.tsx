"use client";
import { useEffect } from "react";

// Registers the service worker that makes Sylvia installable and receives push alerts.
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
