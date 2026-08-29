FROM node:24-bookworm-slim

WORKDIR /app

COPY --chown=node:node server ./server
COPY --chown=node:node web/ ./public/

RUN mkdir -p /app/data /app/updates && chown -R node:node /app/data /app/updates

USER node

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    STATIC_ROOT=/app/public \
    DATA_FILE=/app/data/focusflow.sqlite \
    UPDATES_ROOT=/app/updates

EXPOSE 3000

CMD ["node", "server/index.mjs"]
