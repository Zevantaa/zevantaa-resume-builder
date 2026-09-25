import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zevantaa Resume Builder",
    short_name: "Zevantaa",
    description: "Zevantaa Careers multi-market resume builder and portal",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0b132b",
    icons: [
      {
        src: "/branding/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/branding/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
