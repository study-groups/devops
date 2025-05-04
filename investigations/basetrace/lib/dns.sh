#!/bin/bash

resolve_dns() {
    local domain="$1"
    log_status "DNS resolving domain: $domain"
    
    # Get DNS resolution results
    dig +short "$domain" | grep -v '\.$' > "$REPORT_DIR/dns.txt" || true
    
    # Get the first resolved IP
    local resolved_ip
    resolved_ip=$(head -1 "$REPORT_DIR/dns.txt")
    
    if [ -n "$resolved_ip" ]; then
        # Initialize resolved.env with DNS resolution
        update_resolved_env "$resolved_ip" "$domain" "" "" ""
        log_status "DNS resolved $domain to $resolved_ip"
    else
        log_status "DNS resolution failed for $domain"
        return 1
    fi
    
    return 0
} 