import { defineConfig, type Plugin } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

function aiDevMiddlewarePlugin(): Plugin {
  return {
    name: "ai-dev-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url === "/api/ai" || req.url.startsWith("/api/ai?"))) {
          let bodyStr = "";
          req.on("data", (chunk) => {
            bodyStr += chunk;
          });
          req.on("end", async () => {
            try {
              const { handleAiRequest } = await server.ssrLoadModule("/src/server/api/ai.ts");
              const fullUrl = `http://${req.headers.host || "localhost"}${req.url}`;
              const headers = new Headers();
              for (const [key, val] of Object.entries(req.headers)) {
                if (typeof val === "string") headers.set(key, val);
                else if (Array.isArray(val)) headers.set(key, val.join(", "));
              }
              const init: RequestInit = {
                method: req.method || "GET",
                headers,
              };
              if (req.method !== "GET" && req.method !== "HEAD" && bodyStr) {
                init.body = bodyStr;
              }
              const webReq = new Request(fullUrl, init);
              const webRes = await handleAiRequest(webReq);
              res.statusCode = webRes.status;
              webRes.headers.forEach((val: string, key: string) => {
                res.setHeader(key, val);
              });
              const text = await webRes.text();
              res.end(text);
            } catch (err) {
              console.error("[Vite Dev AI Error]:", err);
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Internal dev error", details: String(err) }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    aiDevMiddlewarePlugin(),
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
         * The command palette needs no rule here: `cmdk` is imported by exactly
         * one dynamically imported chunk, so the bundler already ships it with
         * that chunk. Grouping it manually would be actively harmful — Rollup
         * also drops a group's *unassigned* dependencies (react, react-dom, the
         * JSX runtime) into the manual chunk, which would then become part of
         * the eagerly loaded graph and pull cmdk into the initial payload.
         *
         * Only `node_modules` ids are routed so first-party code keeps its
         * route-based splitting, and tree-shaking (`sideEffects: false` in
         * package.json) still runs before chunks are assigned, so unused
         * exports never reach any chunk.
         */
        manualChunks(id: string): string | undefined {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules[\\/](recharts|d3-)/.test(id)) return "recharts-vendor";
          if (/node_modules[\\/]dexie/.test(id)) return "storage-vendor";
          if (/node_modules[\\/](@radix-ui|lucide-react)/.test(id)) return "ui-vendor";
          return undefined;
        },
      },
    },
  },
}));
