# ── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .

# Magazin (content/magazin → statische Seiten unter /magazin/, früher
# „Ratgeber" unter /ratgeber/) und vorgerenderte Startseite.
# Sind OUTLINE_MAGAZIN_TOKEN und OUTLINE_MAGAZIN_COLLECTION (alte Namen
# OUTLINE_RATGEBER_* gehen weiter) als Build-Variablen gesetzt, holt der Sync
# vor dem Bau die veröffentlichten Artikel aus Outline; ohne sie bleibt es bei
# den Dateien im Repo. Der Sync lässt den Bau nie scheitern. Der Token wird
# nur in dieser Bau-Stufe gebraucht und landet nicht im ausgelieferten Image.
# PUBLIC_BASE_URL setzt canonical, hreflang, og:url, Sitemap und llms.txt
# (Standard https://cv.example.com aus src/landing/brand.js — für jede echte
# Instanz setzen). Beim Bau liest scripts/landing-prerender.mjs einmal das
# Angebot unter <PUBLIC_BASE_URL>/pdfapi/api/billing/offer (Preisabschnitt,
# JSON-LD offers); ist es nicht erreichbar, rendert er ohne Preise, und die
# Seite lädt sie im Browser nach. Gerendert wird mit react-dom/server, ohne
# Chromium.
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
ARG OUTLINE_MAGAZIN_TOKEN
ARG OUTLINE_RATGEBER_TOKEN
ARG OUTLINE_MAGAZIN_COLLECTION
ARG OUTLINE_RATGEBER_COLLECTION
ARG PUBLIC_BASE_URL
RUN npm run magazin:sync && npm run build

# ── Stage 2: Serve ─────────────────────────────────────────────────────────
FROM nginx:alpine AS production

# CA-Bündel für den optionalen Umami-Weiterleiter (nginx.conf, location /u/:
# proxy_ssl_verify). In Alpine meist schon da; so ist es sicher.
RUN apk add --no-cache ca-certificates && test -s /etc/ssl/certs/ca-certificates.crt

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx-Konfiguration als Vorlage (Runde 8b, 10.10.2026): Das nginx-Image
# ersetzt beim Start ${ADMIN_HOST} aus der Umgebung und schreibt das Ergebnis
# nach /etc/nginx/conf.d/default.conf. Der Filter lässt nur diese eine
# Variable zu — alle $-Variablen von nginx bleiben, wie sie sind, auch wenn
# die Hosting-Plattform weitere Umgebungsvariablen in den Container gibt. Ohne ADMIN_HOST
# (Selbsthoster) gilt admin.invalid: kein Admin-Host, Admin-Seite unter
# /admin/ (pdf-service/ADMIN.md).
ENV ADMIN_HOST=admin.invalid
ENV NGINX_ENVSUBST_FILTER=^ADMIN_HOST$
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
