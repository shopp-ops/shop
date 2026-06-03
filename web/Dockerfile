FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && \
    mkdir /out && \
    cp -r .next/standalone/. /out && \
    cp -r .next/static /out/.next/static && \
    cp -r public /out/public

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /out ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
