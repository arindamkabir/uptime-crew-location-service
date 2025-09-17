#!/bin/bash

# SSL Setup Script for Uptime Location Service
# This script helps set up SSL certificates using Let's Encrypt

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status messages
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print warning messages
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to print error messages
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to print info messages
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo -e "\n🔒 Setting up SSL for Uptime Location Service...\n"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root"
    print_info "Run as regular user, the script will use sudo when needed"
    exit 1
fi

# Check if domain is provided
if [ -z "$1" ]; then
    print_error "Please provide a domain name"
    print_info "Usage: ./setup-ssl.sh location.uptimecrew.lol"
    exit 1
fi

DOMAIN=$1
print_info "Setting up SSL for domain: $DOMAIN"

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    print_warning "Certbot is not installed. Installing..."
    
    # Install certbot
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
    
    if [ $? -eq 0 ]; then
        print_status "Certbot installed successfully"
    else
        print_error "Failed to install certbot"
        exit 1
    fi
fi

# Check if Nginx is running
if ! systemctl is-active --quiet nginx; then
    print_error "Nginx is not running. Please start Nginx first:"
    print_info "sudo systemctl start nginx"
    exit 1
fi

# Obtain SSL certificate
print_status "Obtaining SSL certificate for $DOMAIN..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@uptimecrew.lol

if [ $? -eq 0 ]; then
    print_status "SSL certificate obtained successfully"
    
    # Update Nginx configuration to use SSL
    print_status "Updating Nginx configuration for SSL..."
    
    if [ -f "nginx-ssl.conf" ]; then
        # Replace domain in SSL config
        sed "s/location.uptimecrew.lol/$DOMAIN/g" nginx-ssl.conf > nginx-ssl-temp.conf
        
        # Copy SSL configuration
        sudo cp nginx-ssl-temp.conf /etc/nginx/sites-available/uptime-location-service-ssl
        
        # Enable SSL site
        if [ ! -L "/etc/nginx/sites-enabled/uptime-location-service-ssl" ]; then
            sudo ln -s /etc/nginx/sites-available/uptime-location-service-ssl /etc/nginx/sites-enabled/
            print_status "SSL site configuration enabled"
        fi
        
        # Disable HTTP site
        if [ -L "/etc/nginx/sites-enabled/uptime-location-service" ]; then
            sudo rm /etc/nginx/sites-enabled/uptime-location-service
            print_status "HTTP site configuration disabled"
        fi
        
        # Test Nginx configuration
        if sudo nginx -t; then
            print_status "Nginx SSL configuration is valid"
            
            # Reload Nginx
            sudo systemctl reload nginx
            print_status "Nginx reloaded with SSL configuration"
        else
            print_error "Nginx SSL configuration is invalid"
            print_error "Please check the configuration: sudo nginx -t"
            exit 1
        fi
        
        # Clean up temp file
        rm -f nginx-ssl-temp.conf
        
        print_status "SSL setup completed successfully!"
        echo -e "${GREEN}"
        echo "🎉 SSL is now configured for $DOMAIN"
        echo "🔒 HTTPS URL: https://$DOMAIN"
        echo "🏥 Health Check: https://$DOMAIN/health"
        echo ""
        echo "📋 SSL Management Commands:"
        echo "   Renew certificates: sudo certbot renew"
        echo "   Test renewal: sudo certbot renew --dry-run"
        echo "   Check status: sudo certbot certificates"
        echo -e "${NC}"
    else
        print_warning "nginx-ssl.conf not found, using default Let's Encrypt configuration"
    fi
else
    print_error "Failed to obtain SSL certificate"
    print_info "Please check your domain DNS settings and try again"
    exit 1
fi

# Set up auto-renewal
print_status "Setting up automatic certificate renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
print_status "Auto-renewal cron job added"

print_info "SSL setup completed! Your location service is now accessible via HTTPS."
