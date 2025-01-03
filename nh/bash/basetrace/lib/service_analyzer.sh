#!/bin/bash

collect_system_services() {
    source "$REPORT_DIR/resolved.env"
    log_status "Collecting system services from RESOLVED_IP: $RESOLVED_IP"
    
    ssh -o ConnectTimeout=10 root@"$RESOLVED_IP" bash << 'ENDSSH' > "$REPORT_DIR/services.env"
echo "RUNNING_SERVICES={"
systemctl list-units --type=service --state=running | \
    grep -v " loaded active running" | \
    awk 'NR>1 {print $1 " - " $NF}'
echo "}"

# Only show services on standard ports
echo "SERVICE_PORTS={"
netstat -tlpn 2>/dev/null | grep LISTEN | \
    awk '$4 !~ /:3[2-9][0-9]{3}/ && $4 !~ /:[4-9][0-9]{4}/ {print $4 " " $7}' | \
    while read -r port prog; do
        echo "PORT_${port##*:}=${prog#*/}"
    done
echo "}"
# Note: Ports above 32000 are excluded
ENDSSH
}

collect_pm2_services() {
    source "$REPORT_DIR/resolved.env"
    log_status "Collecting PM2 services from RESOLVED_IP: $RESOLVED_IP"
    
    ssh -o ConnectTimeout=10 root@"$RESOLVED_IP" bash << 'ENDSSH' >> "$REPORT_DIR/services.env"
if command -v pm2 &>/dev/null; then
    echo "RUNNING_SERVICES_PM2={"
    pm2 list
    echo "}"
fi
ENDSSH
}

analyze_services() {
    source "$REPORT_DIR/resolved.env"
    log_status "Analyzing services for RESOLVED_IP: $RESOLVED_IP"
    
    collect_system_services
    collect_pm2_services
}
