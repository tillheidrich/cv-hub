# Playwright base image — ships a matching Chromium + all OS deps.
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Alle Quelldateien, nicht namentlich aufgezählt.
#
# Die Liste war zweimal der Grund für einen fehlgeschlagenen Deploy: wer eine
# neue Datei anlegt, denkt nicht an das Dockerfile, und der Container startet
# dann gar nicht erst (ERR_MODULE_NOT_FOUND). Das Glob erwischt *.js; Tests
# heißen *.test.mjs und bleiben draußen.
COPY *.js ./

# Befund vom 14.09.2026: Der Dienst lief als root — und mit ihm ein Chromium
# ohne Sandbox, das HTML von nicht angemeldeten Aufrufern rendert. Ein Fehler im
# Renderer bedeutete damit Codeausführung als root, im selben Prozessraum wie
# DATABASE_URL, JWT_SECRET und SMTP_PASS. Das Playwright-Image bringt für genau
# diesen Zweck einen unprivilegierten Benutzer mit.
RUN chown -R pwuser:pwuser /app
USER pwuser

EXPOSE 3000
CMD ["node", "server.js"]
