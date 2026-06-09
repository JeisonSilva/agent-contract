# Stage 1: build
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Stage 2: production
FROM node:22-alpine AS production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY agents/ ./agents/

RUN mkdir -p /projetos /app/resultados

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
