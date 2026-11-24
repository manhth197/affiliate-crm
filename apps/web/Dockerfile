# syntax=docker/dockerfile:1
# Affiliate CRM web: Vite build served by nginx, which also proxies /api and /socket.io to the
# API so the browser sees one origin (no CORS, the SameSite=Strict refresh cookie just works).
#   docker build -t affiliate-crm-web apps/web
#   docker run -p 8080:80 -e API_UPSTREAM=http://api:3000 affiliate-crm-web
ARG NODE_IMAGE=node:26-alpine
ARG NGINX_IMAGE=nginx:1.30-alpine

# 1. Build the static site. VITE_* values are baked into the JavaScript at build time.
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Relative by default: the API is reached through this image's own nginx.
ARG VITE_API_URL=/api/v1
# Empty = same origin as the page.
ARG VITE_SOCKET_URL=
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_SOCKET_URL=${VITE_SOCKET_URL}
RUN npm run build

# 2. Serve it. The official image renders /etc/nginx/templates/*.template with envsubst at start.
FROM ${NGINX_IMAGE} AS runtime
# Where nginx forwards /api/ and /socket.io/ (scheme://host:port, no path).
ENV API_UPSTREAM=http://api:3000
# DNS used to resolve API_UPSTREAM at request time (127.0.0.11 = Docker's embedded DNS), so
# nginx also starts when the API is not up yet.
ENV NGINX_RESOLVER=127.0.0.11
# Extra origins the page may call (CSP connect-src), e.g. an API on another domain.
ENV CSP_CONNECT_SRC=""
COPY nginx/default.conf.template nginx/security-headers.inc.template /etc/nginx/templates/
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz > /dev/null || exit 1
