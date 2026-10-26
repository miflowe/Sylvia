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
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
