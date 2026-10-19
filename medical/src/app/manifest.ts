import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dosar medical",
    short_name: "Dosar",
    description: "Dosar medical personal pentru familie.",
    id: "/",
    start_url: "/profiles",
    scope: "/",
    display: "standalone",
    background_color: "#f4f8f8",
    theme_color: "#1f4f57",
    lang: "ro",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
