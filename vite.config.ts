import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// Note: If you use TanStack Router for file-based routing, import it here:
// import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    // TanStackRouterVite(), // Uncomment if you are using TanStack Router
    viteReact(),
  ],
});