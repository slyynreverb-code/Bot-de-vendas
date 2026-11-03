FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && mkdir -p .state reports \
    && chown -R node:node /app
COPY --from=build --chown=node:node /app/dist ./dist

USER node
VOLUME ["/app/.state", "/app/reports"]
CMD ["node", "dist/bot.js"]
