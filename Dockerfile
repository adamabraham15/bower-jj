# ==============================================================================
# BOWER JJ — Production Multi-Stage Container Dockerfile
# Builds the Vite React SPA and runs the Authoritative Game Server
# ==============================================================================

# --- STAGE 1: Frontend & Backend Builder ---
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy full source and compile
COPY . .
RUN npm run build

# --- STAGE 2: Production Lightweight Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy package manifests, tsconfig, and production dependencies
COPY package*.json ./
COPY tsconfig*.json ./
RUN npm ci --omit=dev && npm install -g tsx

# Copy compiled frontend distribution
COPY --from=builder /app/dist ./dist

# Copy backend server code, database migrations, and schema
COPY server ./server
COPY supabase ./supabase
COPY src/engine ./src/engine

# Create persistent data directories and declare volume
RUN mkdir -p server/data/backups server/data/active_matches
VOLUME ["/app/server/data"]

# Expose HTTP / WSS port
EXPOSE 3001

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start Authoritative Multiplayer Server
CMD ["npx", "tsx", "server/index.ts"]
