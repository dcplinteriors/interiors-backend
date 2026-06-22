# --- Build stage: compile TypeScript with full (dev) deps ---
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Runtime stage: production deps only, run compiled JS ---
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Cloud Run injects PORT (defaults to 8080); server.ts already reads env.PORT.
EXPOSE 8080
CMD ["node", "dist/server.js"]
