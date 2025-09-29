# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    wget \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install && npm install -g pm2

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Create non-root user first
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Create logs directory with proper permissions
RUN mkdir -p logs && \
    chmod 755 logs && \
    chown -R nodejs:nodejs /app

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

# Start the application with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js", "--env", "production"]
