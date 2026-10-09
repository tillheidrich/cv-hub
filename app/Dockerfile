# ── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .

# Ratgeber (content/ratgeber → statische Seiten unter /ratgeber/).
# Ist OUTLINE_RATGEBER_TOKEN als Build-Variable gesetzt, holt der Sync vor dem
# Bau die veröffentlichten Artikel aus Outline; ohne Token bleibt es bei den
# Dateien im Repo. Der Sync lässt den Bau nie scheitern. Der Token wird nur
# in dieser Bau-Stufe gebraucht und landet nicht im ausgelieferten Image.
# PUBLIC_BASE_URL setzt canonical, og:url und Sitemap (Standard
# https://cv.example.com — für jede echte Instanz setzen).
ARG OUTLINE_URL
ARG OUTLINE_RATGEBER_TOKEN
ARG PUBLIC_BASE_URL
RUN npm run ratgeber:sync && npm run build

# ── Stage 2: Serve ─────────────────────────────────────────────────────────
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config for SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
