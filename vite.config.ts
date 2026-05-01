import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { createSpaRouter } from "./app/remix/router";

function normalizeBase(base: string): string {
  const trimmedBase = base.trim();
  if (!trimmedBase || trimmedBase === "/") return "/";

  return `/${trimmedBase.replace(/^\/+|\/+$/g, "")}/`;
}

function deploymentBase(): string {
  return normalizeBase(process.env.BASE_PATH ?? "/");
}

function requestHeaders(rawHeaders: string[]): Headers {
  const headers = new Headers();

  for (let i = 0; i < rawHeaders.length; i += 2) {
    headers.append(rawHeaders[i], rawHeaders[i + 1]);
  }

  return headers;
}

function remixSpaFallback(): Plugin {
  return {
    name: "remix-spa-fallback",
    configureServer(server) {
      return () => {
        const router = createSpaRouter({
          async renderIndex(request) {
            const pathname = new URL(request.url).pathname;
            const template = await readFile(resolve(server.config.root, "index.html"), "utf8");

            return server.transformIndexHtml(pathname, template);
          },
        });

        server.middlewares.use(async (req, res, next) => {
          if (!req.url || !req.method) return next();

          const host = req.headers.host ?? "localhost";
          const request = new Request(new URL(req.url, `http://${host}`), {
            method: req.method,
            headers: requestHeaders(req.rawHeaders),
          });

          const response = await router.fetch(request);
          if (response.status === 404) return next();

          res.statusCode = response.status;
          response.headers.forEach((value, name) => {
            res.setHeader(name, value);
          });

          if (req.method === "HEAD" || !response.body) {
            res.end();
            return;
          }

          res.end(await response.text());
        });
      };
    },
  };
}

export default defineConfig({
  base: deploymentBase(),
  server: {
    port: 44100,
    strictPort: true,
  },
  build: {
    outDir: "build/client",
  },
  plugins: [tailwindcss(), react(), tsconfigPaths(), remixSpaFallback()],
});
