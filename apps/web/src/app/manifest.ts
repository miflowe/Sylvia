import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sylvia",
    short_name: "Sylvia",
    description: "Wildfire risk, early warnings, and fire-wise native plants for your home.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ee",
    theme_color: "#1f4a33",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // The design system's full-bleed master keeps the mark inside the maskable safe zone.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
