import { createRouter, type Middleware } from "remix/fetch-router";
import { createHtmlResponse } from "remix/response/html";

import { routes } from "../routes";

interface CreateSpaRouterOptions {
  middleware?: readonly Middleware[];
  renderIndex(request: Request): string | Promise<string>;
}

function canRenderSpa(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;

  const url = new URL(request.url);
  if (url.pathname !== "/" && /\.[^/]+$/.test(url.pathname)) return false;

  const accept = request.headers.get("accept");
  return !accept || accept.includes("text/html");
}

export function createSpaRouter({ middleware = [], renderIndex }: CreateSpaRouterOptions) {
  const router = createRouter({ middleware });

  async function renderSpa({ request }: { request: Request }) {
    if (!canRenderSpa(request)) {
      return new Response("Not Found", { status: 404 });
    }

    return createHtmlResponse(await renderIndex(request));
  }

  router.map(routes, {
    actions: {
      home: renderSpa,
      spa: renderSpa,
    },
  });

  return router;
}
