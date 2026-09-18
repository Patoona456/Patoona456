# Emberfall Online - one container, no build step.
# The client is plain ES modules served straight from source, so there is
# nothing to bundle; the only dependency is `ws`.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    EMBERFALL_DATA=/data \
    EMBERFALL_STORE=sqlite

WORKDIR /app

# dependencies first, so a code change does not reinstall them
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY server ./server
COPY client ./client
COPY shared ./shared
COPY assets ./assets
COPY docs ./docs

# the world lives here; mount a volume over it to keep it between deploys
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
