import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "remix/node-serve";
import { staticFiles } from "remix/static-middleware";

import { createSpaRouter } from "./app/remix/router";

const rootDir = dirname(fileURLToPath(import.meta.url));
const clientBuildDir = resolve(rootDir, "build/client");
const indexPath = resolve(clientBuildDir, "index.html");

const router = createSpaRouter({
  middleware: [staticFiles(clientBuildDir)],
  renderIndex() {
    return readFile(indexPath, "utf8");
  },
});

const port = Number(process.env.PORT ?? 3000);
const server = serve((request) => router.fetch(request), { port });

await server.ready;
console.log(`Remix server running at http://localhost:${server.port}`);
