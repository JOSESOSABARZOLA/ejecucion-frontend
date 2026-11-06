# Frontend Dockerfile - Multi-stage build: Node (build) + Nginx (runtime)
# Stage 1: Build React application with Vite

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files (.npmrc fija @amc-automatizacion a GitHub Packages y solo lleva el marcador
# de NODE_AUTH_TOKEN, nunca el token)
COPY package*.json .npmrc ./

# Install dependencies
# El token de GitHub Packages (read:packages) llega como SECRETO de BuildKit, no como build-arg:
# el secreto vive solo durante este RUN y no entra en capas, caché ni historial de builds. Un
# build-arg sí quedaría en la caché de esta etapa y en el historial de Docker Desktop aunque la
# imagen final sea nginx. Exige BuildKit (el constructor por omisión desde Docker 23).
#   git archive <commit> | docker build --secret id=npmtoken,env=NODE_AUTH_TOKEN -t ... -
RUN --mount=type=secret,id=npmtoken \
  if [ ! -s /run/secrets/npmtoken ]; then \
    echo "Falta el secreto npmtoken: construir con --secret id=npmtoken,env=NODE_AUTH_TOKEN y un token de GitHub Packages con read:packages en NODE_AUTH_TOKEN (con compose, definir NODE_AUTH_TOKEN antes de docker compose build)." >&2; \
    exit 1; \
  fi; \
  NODE_AUTH_TOKEN="$(cat /run/secrets/npmtoken)" npm ci

# Copy source code
COPY . .

# Build-time configuration for backend URL (defaults to /api for docker nginx proxy)
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build React application with Vite
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled React app from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:5173/health || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
