#!/bin/bash

# Source all library files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "loading from $SCRIPT_DIR/lib"

# Load all library files
for lib in "$SCRIPT_DIR/lib"/*.sh; do
    if [ -f "$lib" ]; then  # Check if file exists
        source "$lib"
    fi
done

parse_url() {
    local url="$1"
    local output_file="$2"
    
    # Extract path and ensure it defaults to '/' if empty
    local path
    path=$(echo "$url" | sed -E 's#^https?://[^/]+/?(.*)#\1#')
    [ -z "$path" ] && path="/"
    
    {
        echo "URL_FULL=$url"
        echo "URL_SCHEME=${url%%://*}"
        echo "URL_HOST=$(echo "$url" | sed -E 's#^https?://([^/]+).*#\1#')"
        echo "URL_PATH=$path"
        echo "URL_PORT=$(echo "$url" | grep -oP ':\K[0-9]+(?=/?|$)' || echo '80')"
    } > "$output_file"
}

main() {
    if [ -z "$1" ]; then
        show_usage
        return 1
    fi

    URL="$1"
    # Strip any -report suffix from the URL
    URL="${URL%-report}"
    
    if [[ "$URL" != http* ]]; then
        URL="http://$URL"
    fi
    
    # Extract domain first
    DOMAIN=$(echo "$URL" | sed -E 's#^https?://([^/]+).*#\1#')
    
    # Initialize report directory with domain
    init_report_dir "$DOMAIN"
    
    # Now parse URL components
    parse_url "$URL" "$REPORT_DIR/url.env"
    
    # Source URL components for use in script
    source "$REPORT_DIR/url.env"
    
    log_status "Starting trace for domain: $DOMAIN"
    
    # Resolve DNS first
    if ! resolve_dns "$DOMAIN"; then
        log_status "DNS resolution failed for $DOMAIN"
        return 1
    fi
    
    # Process each resolved IP
    while read -r ip; do
        [ -z "$ip" ] && continue
        analyze_ip "$ip"
        process_nginx "$ip" "${2:-/}"
        
        # Source the location environment variables
        if [ -f "$REPORT_DIR/nginx/location.env" ]; then
            source "$REPORT_DIR/nginx/location.env"
        fi
    done < "$REPORT_DIR/dns.txt"
}

generate_final_report() {
    local report_file="$REPORT_DIR/trace_report.md"
    
    cat > "$report_file" << EOF
# URL Trace Report
URL: $URL
Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

## DNS Resolution
$(cat "$REPORT_DIR/dns/"*.env 2>/dev/null)

## NGINX Configuration
$(for f in "$REPORT_DIR/nginx/"*.env; do
    if [ -f "$f" ]; then
        echo "### $(basename "$f" .env)"
        cat "$f"
        echo
    fi
done)

## Service Mappings
$(for f in "$REPORT_DIR/services/"*.env; do
    if [ -f "$f" ]; then
        echo "### $(basename "$f" .env)"
        cat "$f"
        echo
    fi
done)

## Execution Log
\`\`\`
$(cat "$REPORT_DIR/meta/tasks.log")
\`\`\`
EOF
}

discover_services() {
    local ip="$1"
    
    # Get listening ports
    if ssh -o ConnectTimeout=10 root@"$ip" "true" 2>/dev/null; then
        ssh -o ConnectTimeout=10 root@"$ip" bash << 'ENDSSH' | process_service_info "$ip"
# Get systemd services
systemctl list-units --type=service --state=running --no-pager --no-legend

# Get listening ports
netstat -tlpn 2>/dev/null | grep LISTEN

# Get PM2 processes if available
if command -v pm2 &>/dev/null; then
    pm2 jlist
fi
ENDSSH
    fi
}

process_service_info() {
    local ip="$1"
    while IFS= read -r line; do
        if [[ $line =~ :([0-9]+).*LISTEN.*\/(.+)$ ]]; then
            local port="${BASH_REMATCH[1]}"
            local service="${BASH_REMATCH[2]}"
            record_service_mapping "$ip" "$port" "$service" "system"
        fi
    done
}

# Only run main if the script is executed, not sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
