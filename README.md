# Uptime Location Service

Real-time location sharing and geofencing microservice using Node.js, Socket.IO, and PM2.

## 🚀 Quick Start

### Using Deployment Script (Recommended)

```bash
# Deploy the service (includes Docker installation if needed)
./deploy.sh
```

**Features:**

- ✅ **Auto-installs Docker** on Ubuntu/Debian systems
- ✅ **Creates default environment file** if missing
- ✅ **Complete deployment process** in one command
- ✅ **Health checks and validation**

### Using Docker Compose (Manual)

```bash
# Build and start
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop
docker-compose -f docker-compose.prod.yml down
```

### Using Docker directly

```bash
# Build image
docker build -t uptime-location-service:latest .

# Run container
docker run -d \
  --name uptime-location-service \
  -p 3001:3001 \
  --env-file env.production \
  -v $(pwd)/logs:/app/logs \
  uptime-location-service:latest
```

## 📋 Configuration

Update `env.production` with your settings:

- `LARAVEL_API_URL` - Your Laravel backend URL
- `LARAVEL_API_KEY` - Your Laravel API key
- `GOOGLE_MAPS_API_KEY` - Your Google Maps API key
- `JWT_SECRET` - Your JWT secret
- `SOCKET_CORS_ORIGIN` - Allowed CORS origins

## 🔍 Health Check

```bash
curl http://localhost:3001/health
```

## 📊 Monitoring

The service runs with PM2 inside Docker, providing:

- Automatic restarts on crashes
- Memory monitoring
- Log management
- Process monitoring

## 📁 Files

- `deploy.sh` - **Deployment script (run this to deploy)**
- `Dockerfile` - Docker configuration with PM2
- `ecosystem.config.js` - PM2 configuration
- `docker-compose.prod.yml` - Docker Compose configuration
- `env.production` - Environment variables
