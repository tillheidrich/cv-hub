# Playwright base image — ships a matching Chromium + all OS deps.
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js db.js markdown.js mail.js ssrf.js ./

# Befund vom 14.09.2026: Der Dienst lief als root — und mit ihm ein Chromium
# ohne Sandbox, das HTML von nicht angemeldeten Aufrufern rendert. Ein Fehler im
# Renderer bedeutete damit Codeausführung als root, im selben Prozessraum wie
# DATABASE_URL, JWT_SECRET und SMTP_PASS. Das Playwright-Image bringt für genau
# diesen Zweck einen unprivilegierten Benutzer mit.
RUN chown -R pwuser:pwuser /app
USER pwuser

EXPOSE 3000
CMD ["node", "server.js"]
