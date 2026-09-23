import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => ({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    // Load Nitro only during production build to keep local dev server fast and stable
    ...(command === "build" ? [nitro()] : []),
    viteReact(),
  ],
  build: {
    // Production ships no source maps: they double every payload and expose
    // original sources. Devtool generation stays off for `vite build` only;
    // `vite dev` keeps its normal debugging behavior.
    sourcemap: false,
    rollupOptions: {
      output: {
        /**
         * Long-term cacheable vendor chunks. Each group isolates a heavy
         * dependency tree behind its own content hash so repeat visits only
         * re-download changed application code:
         *
         *  - `recharts-vendor`: the charting stack (`recharts` plus its
         *    transitive `d3-*` helpers). Only the Analytics route consumes it.
         *  - `storage-vendor`: `dexie` / `dexie-react-hooks`. Cadence currently
         *    ships a dependency-free IndexedDB wrapper, so the rule is a no-op
         *    until those packages are installed — kept for forward compatibility.
         *  - `ui-vendor`: Radix UI primitives and the `lucide-react` icon set
         *    shared by every screen.
         *
         * Only `node_modules` ids are routed so first-party code keeps its
         * route-based splitting, and tree-shaking (`sideEffects: false` in
         * package.json) still runs before chunks are assigned, so unused
         * exports never reach any chunk.
         */
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (/node_modules[\\/](recharts|d3-)/.test(id)) return "recharts-vendor";
          if (/node_modules[\\/]dexie/.test(id)) return "storage-vendor";
          if (/node_modules[\\/](@radix-ui|lucide-react)/.test(id)) return "ui-vendor";
        },
      },
    },
  },
}));