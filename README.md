# Uptime Location Service

Real-time location sharing and geofencing microservice using Node.js, Socket.IO, and PM2.

## 🚀 Quick Start

### Using Deployment Script (Recommended)

```bash
# Deploy the service (includes Docker installation if needed)
./deploy.sh
```

**Features:**

- ✅ **Auto-installs Docker & Nginx** on Ubuntu/Debian systems
- ✅ **Creates default environment file** if missing
- ✅ **Complete deployment process** in one command
- ✅ **Health checks and validation**
- ✅ **Nginx reverse proxy configuration**
- ✅ **SSL certificate setup** (optional)

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

## 🔒 SSL Setup (Optional)

### Automatic SSL Setup

```bash
# Set up SSL with Let's Encrypt
./setup-ssl.sh location.uptimecrew.lol
```

### Manual SSL Setup

1. **Obtain SSL certificate:**

   ```bash
   sudo certbot --nginx -d location.uptimecrew.lol
   ```

2. **Update Nginx configuration:**

   ```bash
   sudo cp nginx-ssl.conf /etc/nginx/sites-available/uptime-location-service-ssl
   sudo ln -s /etc/nginx/sites-available/uptime-location-service-ssl /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

3. **Set up auto-renewal:**
   ```bash
   (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
   ```

## 🔍 Health Check

```bash
# Direct service
curl http://localhost:3001/health

# Through Nginx (if configured)
curl http://location.uptimecrew.lol/health
```

## 📊 Monitoring

The service runs with PM2 inside Docker, providing:

- Automatic restarts on crashes
- Memory monitoring
- Log management
- Process monitoring

## 📁 Files

- `deploy.sh` - **Deployment script (run this to deploy)**
- `setup-ssl.sh` - **SSL setup script (run this for HTTPS)**
- `Dockerfile` - Docker configuration with PM2
- `ecosystem.config.js` - PM2 configuration
- `docker-compose.prod.yml` - Docker Compose configuration
- `env.production` - Environment variables
- `nginx.conf` - Nginx HTTP configuration
- `nginx-ssl.conf` - Nginx HTTPS configuration
- `nginx-locations.conf` - Nginx location blocks
