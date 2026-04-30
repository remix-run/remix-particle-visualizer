FROM node:24-alpine AS development-dependencies-env
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:24-alpine AS production-dependencies-env
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:24-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN corepack enable && pnpm build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY ./package.json pnpm-lock.yaml /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
COPY --from=build-env /app/app/remix /app/app/remix
COPY --from=build-env /app/app/routes.ts /app/app/routes.ts
COPY --from=build-env /app/server.ts /app/server.ts
CMD ["pnpm", "start"]