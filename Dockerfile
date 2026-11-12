# --- SPA build ---
FROM node:24-alpine AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# --- API server build ---
FROM rust:1-slim-bookworm AS server
WORKDIR /app/server
COPY server/Cargo.toml server/Cargo.lock ./
# Build dependencies first so they are cached between source changes.
RUN mkdir src && echo 'fn main() {}' > src/main.rs && cargo build --release && rm -rf src
COPY server/ ./
RUN touch src/main.rs && cargo build --release

# --- Runtime ---
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 duely
WORKDIR /app
COPY --from=server /app/server/target/release/duely-server /app/duely-server
COPY --from=web /app/web/dist /app/web/dist
ENV STATIC_DIR=/app/web/dist \
    COOKIE_SECURE=true \
    PORT=10000
USER duely
EXPOSE 10000
CMD ["/app/duely-server"]
