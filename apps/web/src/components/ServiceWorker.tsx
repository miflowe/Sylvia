"use client";
import { useEffect } from "react";

// Registers the service worker that makes Sylvia installable; push handling is added in step 6.
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
