# Gehosteter MCP-Server (HTTP-Modus). stdio-Modus braucht kein Docker.
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY cv-mcp.mjs ./

ENV MCP_HTTP=1
ENV PORT=3000
EXPOSE 3000

# CV_API_KEY und MCP_GATE_TOKEN kommen als Secrets aus der Deploy-Umgebung
# (Coolify), niemals ins Image.
CMD ["node", "cv-mcp.mjs"]
