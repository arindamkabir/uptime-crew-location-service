# Use Node.js 20 slim (Debian) for latest features and compatibility
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        wget \
        curl \
        procps \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install && npm install -g pm2@latest

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Create non-root user (Debian-compatible)
# Use groupadd/useradd on Debian-based images to avoid Alpine-specific flags
RUN groupadd -g 1001 nodejs || true && \
    useradd -u 1001 -g nodejs -M -s /usr/sbin/nologin nodejs || true
RUN chown -R nodejs:nodejs /app
# Create pm2 log directory and set ownership
RUN mkdir -p /var/log/pm2 && chown -R nodejs:nodejs /var/log/pm2

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV LOG_LEVEL=info
ENV GEOFENCING_ENABLED=true
ENV GEOFENCING_CHECK_INTERVAL=5000
ENV DEFAULT_GEOFENCE_RADIUS=1000
ENV SOCKET_PING_TIMEOUT=60000
ENV SOCKET_PING_INTERVAL=25000
ENV RATE_LIMIT_WINDOW_MS=900000
ENV RATE_LIMIT_MAX_REQUESTS=100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the application with PM2 (logs redirected to stdout/stderr by ecosystem.config.js)
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
