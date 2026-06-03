FROM node:20-bookworm-slim

# Chromium + the fonts/libs Puppeteer needs to render PDFs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-noto-color-emoji \
      ca-certificates \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Use the system Chromium; don't let npm download a second copy.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY templates ./templates

# Cloud Run sends traffic to $PORT (default 8080).
ENV PORT=8080
EXPOSE 8080

# dumb-init reaps zombie Chromium processes.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
