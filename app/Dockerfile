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
#
# Token als BuildKit-Secret statt Build-Argument: Baut die Plattform mit
# BuildKit-Secrets (Coolify z. B. unter Build → „Build secrets" → „Docker
# BuildKit secrets"), setzt sie selbst vor jede RUN-Zeile
# `--mount=type=secret,id=<NAME>,env=<NAME>` und gibt die Werte NICHT mehr
# als --build-arg mit. Deshalb steht hier bewusst KEIN eigenes --mount: Eine
# RUN-Zeile mit eigenem Secret-Mount würde dort übersprungen, die übrigen
# Variablen (OUTLINE_URL, PUBLIC_BASE_URL) kämen nicht an. Die ARG-Zeilen
# bleiben für den Bau ohne BuildKit (dann als Build-Argument; der Wert steht
# in der Historie dieser Bau-Stufe auf dem Bauserver, nicht im ausgelieferten
# nginx-Image).
ARG OUTLINE_URL
ARG OUTLINE_RATGEBER_TOKEN
ARG PUBLIC_BASE_URL
RUN npm run ratgeber:sync && npm run build

# ── Stage 2: Serve ─────────────────────────────────────────────────────────
FROM nginx:alpine AS production

# CA-Bündel für den optionalen Umami-Weiterleiter (nginx.conf, location /u/:
# proxy_ssl_verify). In Alpine meist schon da; so ist es sicher.
RUN apk add --no-cache ca-certificates && test -s /etc/ssl/certs/ca-certificates.crt

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config for SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
