#!/usr/bin/env bash

# TSM Nginx Integration
# Functions for generating and managing nginx configuration for tetra

tetra_nginx_generate() {
    local domain="${1:-localhost}"
    local template_file="$TETRA_SRC/templates/nginx/tetra.conf"
    local output_file="${2:-/tmp/tetra-nginx.conf}"

    if [[ ! -f "$template_file" ]]; then
        echo "Error: Nginx template not found: $template_file"
        return 1
    fi

    echo "Generating nginx configuration for domain: $domain"

    # Replace template variables
    sed "s/{{DOMAIN_NAME}}/$domain/g" "$template_file" > "$output_file"

    echo "Nginx configuration generated: $output_file"
    echo
    echo "To install:"
    echo "  sudo cp $output_file /etc/nginx/sites-available/tetra.conf"
    echo "  sudo ln -s /etc/nginx/sites-available/tetra.conf /etc/nginx/sites-enabled/"
    echo "  sudo nginx -t && sudo systemctl reload nginx"
}

tetra_nginx_install() {
    local domain="${1:-localhost}"
    local temp_file="/tmp/tetra-nginx-$$.conf"
    local sites_available="/etc/nginx/sites-available/tetra.conf"
    local sites_enabled="/etc/nginx/sites-enabled/tetra.conf"

    # Generate configuration
    if ! tetra_nginx_generate "$domain" "$temp_file"; then
        return 1
    fi

    echo "Installing nginx configuration..."

    # Install to sites-available
    if sudo cp "$temp_file" "$sites_available"; then
        echo "Configuration installed: $sites_available"
    else
        echo "Error: Failed to install nginx configuration"
        rm -f "$temp_file"
        return 1
    fi

    # Enable site
    if sudo ln -sf "$sites_available" "$sites_enabled"; then
        echo "Site enabled: $sites_enabled"
    else
        echo "Error: Failed to enable site"
        rm -f "$temp_file"
        return 1
    fi

    # Test configuration
    if sudo nginx -t; then
        echo "Nginx configuration test passed"

        # Reload nginx
        if sudo systemctl reload nginx; then
            echo "Nginx reloaded successfully"
        else
            echo "Error: Failed to reload nginx"
            rm -f "$temp_file"
            return 1
        fi
    else
        echo "Error: Nginx configuration test failed"
        rm -f "$temp_file"
        return 1
    fi

    rm -f "$temp_file"
    echo "Tetra nginx configuration installed successfully!"
    echo "Tetra should now be accessible at: https://$domain"
}

tetra_nginx_uninstall() {
    local sites_available="/etc/nginx/sites-available/tetra.conf"
    local sites_enabled="/etc/nginx/sites-enabled/tetra.conf"

    echo "Uninstalling tetra nginx configuration..."

    # Remove enabled site
    if sudo rm -f "$sites_enabled"; then
        echo "Disabled site: $sites_enabled"
    fi

    # Remove available site
    if sudo rm -f "$sites_available"; then
        echo "Removed configuration: $sites_available"
    fi

    # Test and reload nginx
    if sudo nginx -t; then
        if sudo systemctl reload nginx; then
            echo "Nginx reloaded successfully"
        else
            echo "Error: Failed to reload nginx"
            return 1
        fi
    else
        echo "Error: Nginx configuration test failed after removal"
        return 1
    fi

    echo "Tetra nginx configuration uninstalled successfully!"
}

tetra_nginx_status() {
    local sites_available="/etc/nginx/sites-available/tetra.conf"
    local sites_enabled="/etc/nginx/sites-enabled/tetra.conf"

    echo "=== Tetra Nginx Configuration Status ==="

    if [[ -f "$sites_available" ]]; then
        echo "Configuration: INSTALLED ($sites_available)"
    else
        echo "Configuration: NOT INSTALLED"
    fi

    if [[ -L "$sites_enabled" ]]; then
        echo "Site: ENABLED ($sites_enabled)"
    else
        echo "Site: DISABLED"
    fi

    # Check if nginx is running
    if systemctl is-active --quiet nginx; then
        echo "Nginx: RUNNING"
    else
        echo "Nginx: NOT RUNNING"
    fi

    # Check port 443/80 listeners
    echo
    echo "=== Port Status ==="
    if ss -tuln | grep -q ":80 "; then
        echo "Port 80: LISTENING"
    else
        echo "Port 80: NOT LISTENING"
    fi

    if ss -tuln | grep -q ":443 "; then
        echo "Port 443: LISTENING"
    else
        echo "Port 443: NOT LISTENING"
    fi

    # Show nginx error logs for tetra
    echo
    echo "=== Recent Nginx Errors ==="
    if [[ -f "/var/log/nginx/tetra-error.log" ]]; then
        tail -10 /var/log/nginx/tetra-error.log 2>/dev/null || echo "No recent errors"
    else
        echo "No tetra error log found"
    fi
}

tetra_nginx_test() {
    local domain="${1:-localhost}"
    local port="${2:-443}"
    local protocol="https"

    if [[ "$port" == "80" ]]; then
        protocol="http"
    fi

    echo "Testing tetra nginx configuration..."
    echo "Target: $protocol://$domain:$port"

    # Test basic connectivity
    if curl -s -o /dev/null -w "%{http_code}" "$protocol://$domain:$port" | grep -q "200\|301\|302"; then
        echo "✓ Basic connectivity: OK"
    else
        echo "✗ Basic connectivity: FAILED"
        return 1
    fi

    # Test tetra API endpoint
    if curl -s -o /dev/null -w "%{http_code}" "$protocol://$domain:$port/api/health" | grep -q "200"; then
        echo "✓ Tetra API: OK"
    else
        echo "✗ Tetra API: FAILED (check if tetra service is running)"
    fi

    echo "Nginx configuration test completed"
}

# Add nginx commands to TSM
tsm_nginx() {
    local action="${1:-}"

    case "$action" in
        "generate")
            tetra_nginx_generate "${2:-localhost}" "${3:-/tmp/tetra-nginx.conf}"
            ;;
        "install")
            tetra_nginx_install "${2:-localhost}"
            ;;
        "uninstall")
            tetra_nginx_uninstall
            ;;
        "status")
            tetra_nginx_status
            ;;
        "test")
            tetra_nginx_test "${2:-localhost}" "${3:-443}"
            ;;
        *)
            cat <<'EOF'
TSM Nginx Commands:
  tsm nginx generate <domain> [output_file]  Generate nginx config
  tsm nginx install <domain>                 Install nginx config
  tsm nginx uninstall                        Remove nginx config
  tsm nginx status                           Show nginx status
  tsm nginx test <domain> [port]             Test nginx configuration

Examples:
  tsm nginx generate dev.example.com         Generate config file
  tsm nginx install dev.example.com          Install config for domain
  tsm nginx test dev.example.com 443         Test HTTPS connectivity
EOF
            return 1
            ;;
    esac
}