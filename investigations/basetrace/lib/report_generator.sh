#!/bin/bash

generate_network_path() {
    log_status "report"
    
    {
        echo "URL Trace Report for $URL"
        echo "Generated: $(date)"
        echo
        echo "1. DNS Resolution:"
        echo "   Domain: $DOMAIN"
        cat "$REPORT_DIR/dns.txt" | while read -r ip; do
            echo "   IP: $ip"
        done
    } > "$REPORT_DIR/network_path.txt"
}

summarize_nginx_configs() {
    log_status "NETWORK_PATH=$NETWORK_PATH"
    local config_files
    config_files=($(grep "NGINX_CONFIG_FILES=(" "$DEVOPS_FILE" | sed 's/NGINX_CONFIG_FILES=(//' | sed 's/)//' | tr ' ' '\n'))
    echo "NGINX Summary:" >> "$NETWORK_PATH"
    for f in "${config_files[@]}"; do
        echo "  - $f" >> "$NETWORK_PATH"
    done
}

create_report_directory() {
    local report_dir="${DOMAIN}-report"
    mkdir -p "$report_dir"
    echo "Writing NGINX configurations to $report_dir/nginx.sh"
    {
        echo "#!/bin/bash"
        echo "NGINX_CONFIG_FILES=("
        grep -A 100 "NGINX_CONFIG_FILES=" "$DEVOPS_FILE" | grep -B 100 ")" | tail -n +2
        echo ")"
        # Append the raw NGINX_CONFIGS we captured
        grep "NGINX_CONFIGS={" -A 1000 "$DEVOPS_FILE" | grep -B 1000 "SERVICE_PORTS={"
    } > "$report_dir/nginx.sh"

    echo "Extracting location block for $DOMAIN and path $NGINX_PATH"
    local block
    block=$(extract_location_block "$DOMAIN" "$NGINX_PATH")
    {
        echo "#!/bin/bash"
        echo "# Path Analysis for $URL"
        echo "TARGET_URL=\"$URL\""
        echo "REQUESTED_PATH=\"$NGINX_PATH\""
        echo
        echo "# Extracted Location Block"
        echo "$block"
    } > "$report_dir/nginx-path.sh"

    echo "Path Analysis Summary for $URL" > "$report_dir/summary.txt"
    echo "See $DEVOPS_FILE and $NETWORK_PATH for details." >> "$report_dir/summary.txt"
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

## Location Directives
$(if [ -f "$REPORT_DIR/nginx/location.env" ]; then
    echo "### Location Directives"
    cat "$REPORT_DIR/nginx/location.env"
    echo
fi)

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