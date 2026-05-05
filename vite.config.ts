import { existsSync } from "node:fs";
import { normalize, relative, resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Connect, type Plugin, type ResolvedConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const base = process.env.BASE_PATH ?? "/";

function preserveAssetNotFound(): Plugin {
  const middleware = (config: ResolvedConfig): Connect.NextHandleFunction => (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }

    let pathname = req.url ? new URL(req.url, "http://localhost").pathname : "";
    if (config.base !== "/" && pathname.startsWith(config.base)) {
      pathname = pathname.slice(config.base.length - 1);
    }

    if (/\.[^/]+$/.test(pathname)) {
      const relativePath = pathname.replace(/^\/+/, "");
      const candidates = [
        resolve(config.publicDir, relativePath),
        resolve(config.root, relativePath),
        resolve(config.root, config.build.outDir, relativePath),
      ];
      const hasFile = candidates.some((candidate) => {
        const isInsideRoot = !relative(config.root, candidate).startsWith("..");
        return isInsideRoot && existsSync(normalize(candidate));
      });

      if (hasFile) {
        next();
        return;
      }

      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    next();
  };

  return {
    name: "preserve-asset-not-found",
    configureServer(server) {
      server.middlewares.use(middleware(server.config));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(server.config));
    },
  };
}

export default defineConfig({
  base: base.endsWith("/") ? base : `${base}/`,
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "remix/ui",
  },
  server: {
    port: 44100,
    strictPort: true,
  },
  build: {
    outDir: "build/client",
  },
  plugins: [tailwindcss(), tsconfigPaths(), preserveAssetNotFound()],
});
