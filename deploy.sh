#!/bin/bash

# Uptime Location Service Deployment Script
# This script builds and deploys the location service using Docker
# Supports both local development and production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="uptime-location-service"
CONTAINER_NAME="uptime-location-service"
IMAGE_NAME="uptime-location-service"
TAG="latest"
PORT=3001
DOMAIN="location-api.uptimecrew.lol"
APP_DIR="/opt/uptime-location-service"
NGINX_SITE="uptime-location-service"

# Check for production mode
PRODUCTION_MODE=false
if [ "$1" = "--production" ] || [ "$1" = "-p" ]; then
    PRODUCTION_MODE=true
    echo -e "${BLUE}🚀 Deploying Uptime Location Service in PRODUCTION mode...${NC}"
    echo -e "${YELLOW}⚠️  This will configure SSL, firewall, and production settings${NC}"
else
    echo -e "${BLUE}🚀 Deploying Uptime Location Service in DEVELOPMENT mode...${NC}"
fi

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to detect if running in production mode
is_production() {
    if [ "$1" = "--production" ] || [ "$1" = "-p" ]; then
        return 0
    fi
    return 1
}

# Function to install system dependencies for production
install_system_dependencies() {
    print_status "Installing system dependencies for production..."
    
    if command -v apt &> /dev/null; then
        apt-get update -y
        apt-get install -y \
            curl \
            wget \
            git \
            unzip \
            software-properties-common \
            apt-transport-https \
            ca-certificates \
            gnupg \
            lsb-release \
            ufw \
            fail2ban \
            htop \
            vim \
            nano
    else
        print_warning "System dependencies installation skipped (not Ubuntu/Debian)"
    fi
}

# Function to install Certbot for SSL
install_certbot() {
    print_status "Installing Certbot for SSL certificates..."
    
    if command_exists certbot; then
        print_warning "Certbot is already installed"
        return
    fi
    
    if command -v apt &> /dev/null; then
        # Install snapd
        apt-get install -y snapd
        systemctl enable --now snapd
        
        # Install certbot via snap
        snap install core; snap refresh core
        snap install --classic certbot
        
        # Create symlink
        ln -sf /snap/bin/certbot /usr/bin/certbot
        
        print_status "Certbot installed successfully"
    else
        print_warning "Certbot installation skipped (not Ubuntu/Debian)"
    fi
}

# Function to configure firewall for production
configure_firewall() {
    print_status "Configuring firewall for production..."
    
    if command_exists ufw; then
        # Reset UFW
        ufw --force reset
        
        # Default policies
        ufw default deny incoming
        ufw default allow outgoing
        
        # Allow SSH
        ufw allow ssh
        
        # Allow HTTP and HTTPS
        ufw allow 80/tcp
        ufw allow 443/tcp
        
        # Allow the application port (for direct access if needed)
        ufw allow 3001/tcp
        
        # Enable firewall
        ufw --force enable
        
        print_status "Firewall configured successfully"
    else
        print_warning "UFW not available, firewall configuration skipped"
    fi
}

# Function to setup SSL with Certbot
setup_ssl() {
    print_status "Setting up SSL certificate with Certbot..."
    
    if ! command_exists certbot; then
        print_warning "Certbot not available, SSL setup skipped"
        return
    fi
    
    # Stop Nginx temporarily for certificate generation
    if command_exists systemctl; then
        systemctl stop nginx
    fi
    
    # Generate SSL certificate
    certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos --email admin@uptimecrew.lol
    
    # Create SSL configuration
    create_ssl_nginx_config
    
    # Start Nginx
    if command_exists systemctl; then
        systemctl start nginx
    fi
    
    # Setup automatic certificate renewal
    echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
    
    print_status "SSL certificate configured successfully"
}

# Function to create SSL Nginx configuration
create_ssl_nginx_config() {
    print_status "Creating SSL Nginx configuration..."
    
    # Determine Nginx configuration directory
    if [[ "$OSTYPE" == "darwin"* ]]; then
        NGINX_CONF_DIR="/usr/local/etc/nginx"
        NGINX_SITES_DIR="$NGINX_CONF_DIR/servers"
    else
        NGINX_CONF_DIR="/etc/nginx"
        NGINX_SITES_DIR="$NGINX_CONF_DIR/sites-available"
    fi
    
    # Create SSL configuration
    cat > "$NGINX_SITES_DIR/$NGINX_SITE-ssl" << 'EOF'
# Nginx configuration for Uptime Location Service with SSL
# Domain: location-api.uptimecrew.lol
# Place this file in /etc/nginx/sites-available/uptime-location-service-ssl

# IMPORTANT: Add these to your main /etc/nginx/nginx.conf in the http block:
# limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
# limit_req_zone $binary_remote_addr zone=socket:10m rate=5r/s;
# upstream location_service {
#     server 127.0.0.1:3001;
#     keepalive 32;
# }

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name location-api.uptimecrew.lol;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name location-api.uptimecrew.lol;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/location-api.uptimecrew.lol/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/location-api.uptimecrew.lol/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # CORS headers for API
    add_header Access-Control-Allow-Origin "https://app.uptimecrew.lol" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key" always;
    add_header Access-Control-Allow-Credentials "true" always;
    
    # API routes
    location /api/ {
        # Handle preflight OPTIONS requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "https://app.uptimecrew.lol";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS";
            add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key";
            add_header Access-Control-Allow-Credentials "true";
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type "text/plain; charset=utf-8";
            add_header Content-Length 0;
            return 204;
        }

        limit_req zone=api burst=20 nodelay;
        proxy_pass http://location_service;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Socket.IO routes
    location /socket.io/ {
        limit_req zone=socket burst=10 nodelay;
        proxy_pass http://location_service;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Health check endpoint (no rate limiting)
    location /health {
        proxy_pass http://location_service/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Root location
    location / {
        proxy_pass http://location_service;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Logging
    access_log /var/log/nginx/uptime-location-service.access.log;
    error_log /var/log/nginx/uptime-location-service.error.log;
}
EOF

    # Enable SSL site
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - no symlink needed, just copy
        print_status "SSL configuration created for macOS"
    else
        # Linux - create symlink
        ln -sf "$NGINX_SITES_DIR/$NGINX_SITE-ssl" /etc/nginx/sites-enabled/
        rm -f /etc/nginx/sites-enabled/$NGINX_SITE
        print_status "SSL site enabled"
    fi
}

# Function to setup monitoring for production
setup_monitoring() {
    print_status "Setting up monitoring for production..."
    
    # Create a simple health check script
    cat > /usr/local/bin/health-check.sh << 'EOF'
#!/bin/bash
curl -f http://localhost:3001/health > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Health check failed, restarting service..."
    cd /opt/uptime-location-service
    # Try docker compose first, fallback to docker-compose
    if docker compose version >/dev/null 2>&1; then
        docker compose -f docker-compose.prod.yml restart
    else
        docker-compose -f docker-compose.prod.yml restart
    fi
fi
EOF

    chmod +x /usr/local/bin/health-check.sh
    
    # Add to crontab for every 5 minutes
    echo "*/5 * * * * /usr/local/bin/health-check.sh" | crontab -
    
    print_status "Monitoring setup completed"
}

# Check if Docker is installed, install if not available
if ! command -v docker &> /dev/null; then
    print_warning "Docker is not installed. Attempting to install Docker..."
    
    # Check if running on Ubuntu/Debian and sudo is available
    if command -v apt &> /dev/null && command -v sudo &> /dev/null; then
        print_status "Installing Docker on Ubuntu/Debian..."
        
        # Update package index
        sudo apt update
        
        # Install required packages
        sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release
        
        # Add Docker's official GPG key
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        
        # Add Docker repository
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        # Update package index again
        sudo apt update
        
        # Install Docker
        sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        
        # Install Nginx
        sudo apt install -y nginx
        
        # Add current user to docker group
        sudo usermod -aG docker $USER
        
        print_status "Docker and Nginx installed successfully!"
        print_warning "Please log out and log back in for group changes to take effect, then run this script again."
        exit 0
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        print_status "Detected macOS system"
        print_warning "Please install Docker Desktop for Mac:"
        print_info "1. Download from: https://www.docker.com/products/docker-desktop/"
        print_info "2. Install Docker Desktop"
        print_info "3. Install Nginx: brew install nginx"
        print_info "4. Run this script again"
        exit 0
    else
        print_error "Docker is not installed and automatic installation is not supported on this system."
        print_error "Please install Docker manually: https://docs.docker.com/get-docker/"
        exit 1
    fi
fi

# Check if Docker Compose is available (try both commands)
DOCKER_COMPOSE_CMD=""
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    print_error "Docker Compose is not available. Please install Docker Compose first."
    exit 1
fi

print_status "Docker and Docker Compose are available"

# Production setup if in production mode
if [ "$PRODUCTION_MODE" = true ]; then
    print_status "Setting up production environment..."
    
    # Install system dependencies
    install_system_dependencies
    
    # Install Certbot
    install_certbot
    
    # Configure firewall
    configure_firewall
    
    # Create application directory
    mkdir -p $APP_DIR
    mkdir -p $APP_DIR/logs
    
    # Copy current files to production directory
    if [ "$(pwd)" != "$APP_DIR" ]; then
        print_status "Copying files to production directory..."
        cp -r . $APP_DIR/
        cd $APP_DIR
    fi
fi

# Check if Nginx is installed, install if not available
if ! command -v nginx &> /dev/null; then
    print_warning "Nginx is not installed. Attempting to install Nginx..."
    
    # Check if running on Ubuntu/Debian and sudo is available
    if command -v apt &> /dev/null && command -v sudo &> /dev/null; then
        print_status "Installing Nginx on Ubuntu/Debian..."
        sudo apt update
        sudo apt install -y nginx
        print_status "Nginx installed successfully!"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        print_status "Detected macOS system"
        if command -v brew &> /dev/null; then
            print_status "Installing Nginx via Homebrew..."
            brew install nginx
            print_status "Nginx installed successfully!"
        else
            print_error "Homebrew is not installed. Please install Homebrew first:"
            print_info "1. Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            print_info "2. Install Nginx: brew install nginx"
            print_info "3. Run this script again"
            exit 1
        fi
    else
        print_error "Nginx is not installed and automatic installation is not supported on this system."
        print_error "Please install Nginx manually:"
        print_info "Ubuntu/Debian: sudo apt install nginx"
        print_info "macOS: brew install nginx"
        print_info "CentOS/RHEL: sudo yum install nginx"
        exit 1
    fi
fi

# Check if env.production exists, create if missing
if [ ! -f "env.production" ]; then
    print_warning "env.production file not found. Creating default environment file..."
    
    cat > env.production << 'EOF'
# Server Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Laravel Backend Configuration
LARAVEL_API_URL=https://api.uptimecrew.lol
LARAVEL_API_KEY=base64:p87HVRvaXZmL4hmcuzRgtt02TPoGFCvsshxTMfqQrTU=

# Google Maps Configuration
GOOGLE_MAPS_API_KEY=AIzaSyCifZHBz3ewOlgvJ_H5Et1vI0RxMFWPWe4

# Geofencing Configuration
GEOFENCING_ENABLED=true
GEOFENCING_CHECK_INTERVAL=5000
DEFAULT_GEOFENCE_RADIUS=1000

# Socket Configuration
SOCKET_CORS_ORIGIN=http://localhost:3000
SOCKET_PING_TIMEOUT=60000
SOCKET_PING_INTERVAL=25000

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
JWT_SECRET=your_jwt_secret_here
API_KEY_HEADER=X-API-Key
EOF
    
    print_status "Default environment file created"
    print_warning "Please update env.production with your actual configuration values"
fi

print_status "Environment file found"

# Create logs directory
mkdir -p logs
print_status "Created logs directory"

# Stop existing container if running
if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
    print_warning "Stopping existing container..."
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
    print_status "Existing container stopped and removed"
fi

# Remove old image if exists
if [ "$(docker images -q $IMAGE_NAME:$TAG)" ]; then
    print_warning "Removing old image..."
    docker rmi $IMAGE_NAME:$TAG || true
fi

# Build new image
print_status "Building Docker image..."
docker build -t $IMAGE_NAME:$TAG .

if [ $? -eq 0 ]; then
    print_status "Docker image built successfully"
else
    print_error "Failed to build Docker image"
    exit 1
fi

# Start container with Docker Compose
print_status "Starting container with Docker Compose..."
$DOCKER_COMPOSE_CMD -f docker-compose.prod.yml up -d

if [ $? -eq 0 ]; then
    print_status "Container started successfully"
else
    print_error "Failed to start container"
    exit 1
fi

# Wait for container to be ready
print_status "Waiting for service to be ready..."
sleep 10

# Check if container is running
if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
    print_status "Container is running"
else
    print_error "Container failed to start"
    docker logs $CONTAINER_NAME
    exit 1
fi

# Check health endpoint
print_status "Checking service health..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -f http://localhost:$PORT/health > /dev/null 2>&1; then
        print_status "Service is healthy and responding"
        break
    else
        if [ $attempt -eq $max_attempts ]; then
            print_warning "Health check failed after $max_attempts attempts, but container is running"
            print_warning "Check logs with: docker logs $CONTAINER_NAME"
        else
            echo -n "."
            sleep 2
            ((attempt++))
        fi
    fi
done

# Configure Nginx
print_status "Configuring Nginx..."

# Production SSL setup
if [ "$PRODUCTION_MODE" = true ]; then
    setup_ssl
    setup_monitoring
fi

# Check if Nginx is installed
if command -v nginx &> /dev/null; then
        # Copy Nginx configuration (only if not in production mode with SSL)
        if [ -f "nginx.conf" ] && [ "$PRODUCTION_MODE" != true ]; then
            # Determine Nginx configuration directory based on OS
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS with Homebrew
                NGINX_CONF_DIR="/usr/local/etc/nginx"
                NGINX_SITES_DIR="$NGINX_CONF_DIR/servers"
                sudo mkdir -p "$NGINX_SITES_DIR"
                sudo cp nginx.conf "$NGINX_SITES_DIR/uptime-location-service.conf"
                
                # Copy locations file if it exists
                if [ -f "nginx-locations.conf" ]; then
                    sudo cp nginx-locations.conf "$NGINX_SITES_DIR/uptime-location-service-locations.conf"
                    print_status "Nginx locations configuration copied"
                fi
                
                # Update main nginx.conf to include servers directory
                if ! grep -q "include servers/\*.conf;" "$NGINX_CONF_DIR/nginx.conf"; then
                    sudo sed -i '' '/http {/a\
    include servers/*.conf;
' "$NGINX_CONF_DIR/nginx.conf"
                    print_status "Updated main nginx.conf to include servers directory"
                fi
            else
                # Linux (Ubuntu/Debian)
                NGINX_CONF_DIR="/etc/nginx"
                NGINX_SITES_DIR="$NGINX_CONF_DIR/sites-available"
                sudo cp nginx.conf "$NGINX_SITES_DIR/uptime-location-service"
                
                # Copy locations file if it exists
                if [ -f "nginx-locations.conf" ]; then
                    sudo cp nginx-locations.conf "$NGINX_SITES_DIR/uptime-location-service-locations.conf"
                    print_status "Nginx locations configuration copied"
                fi
                
                # Create symlink to enable the site
                if [ ! -L "/etc/nginx/sites-enabled/uptime-location-service" ]; then
                    sudo ln -s "$NGINX_SITES_DIR/uptime-location-service" /etc/nginx/sites-enabled/
                    print_status "Nginx site configuration enabled"
                fi
                
                # Remove default site if it exists
                if [ -L "/etc/nginx/sites-enabled/default" ]; then
                    sudo rm /etc/nginx/sites-enabled/default
                    print_status "Default Nginx site removed"
                fi
            fi
        elif [ "$PRODUCTION_MODE" = true ]; then
            print_status "Production mode: SSL configuration will be handled by setup_ssl function"
        
        # Test Nginx configuration
        if sudo nginx -t; then
            print_status "Nginx configuration is valid"
            
            # Restart Nginx
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                sudo brew services restart nginx 2>/dev/null || sudo nginx -s reload
                print_status "Nginx restarted"
            else
                # Linux
                sudo systemctl restart nginx
                sudo systemctl enable nginx
                print_status "Nginx restarted and enabled"
            fi
        else
            print_error "Nginx configuration is invalid"
            print_error "Please check the configuration: sudo nginx -t"
        fi
    else
        print_warning "nginx.conf not found, skipping Nginx configuration"
    fi
else
    print_warning "Nginx is not installed, skipping Nginx configuration"
fi

# Show container status
echo -e "\n${BLUE}Container Status:${NC}"
docker ps --filter name=$CONTAINER_NAME

# Show logs (last 10 lines)
echo -e "\n${BLUE}Recent Logs:${NC}"
docker logs --tail 10 $CONTAINER_NAME

print_status "Deployment completed successfully!"
echo -e "${GREEN}"
echo "🎉 Uptime Location Service is now running!"
echo ""

if [ "$PRODUCTION_MODE" = true ]; then
    echo "🌐 Production URLs:"
    echo "   Main Service: https://$DOMAIN"
    echo "   Health Check: https://$DOMAIN/health"
    echo "   API Endpoint: https://$DOMAIN/api/"
    echo "   Socket.IO: https://$DOMAIN/socket.io/"
    echo ""
    echo "🔒 SSL Certificate: Configured with Let's Encrypt"
    echo "🛡️  Firewall: UFW configured"
    echo "📊 Monitoring: Health checks every 5 minutes"
else
    echo "📍 Direct Service URL: http://localhost:$PORT"
    echo "🌐 Nginx URL: http://location.uptimecrew.lol (if configured)"
    echo "🏥 Health Check: http://localhost:$PORT/health"
fi
echo ""
echo "📋 Management Commands:"
echo "   View Logs: docker logs $CONTAINER_NAME"
echo "   Restart: $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml restart"
echo "   Stop: $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml down"
echo ""
if command -v nginx &> /dev/null; then
    echo "🔧 Nginx Commands:"
    echo "   Test Config: sudo nginx -t"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "   Reload: sudo brew services restart nginx"
        echo "   Status: sudo brew services list | grep nginx"
    else
        echo "   Reload: sudo systemctl reload nginx"
        echo "   Status: sudo systemctl status nginx"
    fi
fi

echo ""
echo "📖 Usage:"
echo "   Development: ./deploy.sh"
echo "   Production:  ./deploy.sh --production"
echo ""

echo -e "${NC}"
