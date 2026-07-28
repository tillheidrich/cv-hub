# Playwright base image — ships a matching Chromium + all OS deps.
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js db.js markdown.js mail.js ./

EXPOSE 3000
CMD ["node", "server.js"]
