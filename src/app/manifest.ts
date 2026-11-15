import type { MetadataRoute } from "next";

/** Lets families add Ladle to their home screen and open it like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ladle",
    short_name: "Ladle",
    description: "Dinner planned around what's on sale. You approve the cart.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F8F4EC",
    theme_color: "#F8F4EC",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "This week", url: "/" },
      { name: "Grocery cart", url: "/cart" },
      { name: "Recipes", url: "/recipes" },
    ],
  };
}
