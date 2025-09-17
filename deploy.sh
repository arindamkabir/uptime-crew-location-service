#!/bin/bash

# Uptime Location Service Deployment Script
# This script builds and deploys the location service using Docker

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

echo -e "${BLUE}🚀 Deploying Uptime Location Service...${NC}"

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

# Check if Nginx is installed
if command -v nginx &> /dev/null; then
    # Copy Nginx configuration
    if [ -f "nginx.conf" ]; then
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
echo "📍 Direct Service URL: http://localhost:$PORT"
echo "🌐 Nginx URL: http://location.uptimecrew.lol (if configured)"
echo "🏥 Health Check: http://localhost:$PORT/health"
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
echo -e "${NC}"
