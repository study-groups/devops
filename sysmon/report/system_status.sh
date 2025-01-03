#!/bin/bash
# system_status.sh - Collect system information and status.

# Output file
OUTPUT_FILE="system_status_$(hostname).txt"

echo "### System Status Report - $(hostname) ###" > "$OUTPUT_FILE"
echo "Generated on: $(date)" >> "$OUTPUT_FILE"
echo "----------------------------------------" >> "$OUTPUT_FILE"

# 1. /etc/fstab Content
echo "1. /etc/fstab Content:" >> "$OUTPUT_FILE"
cat /etc/fstab >> "$OUTPUT_FILE"
echo "----------------------------------------" >> "$OUTPUT_FILE"

# 2. NGINX Status
echo "2. NGINX Status:" >> "$OUTPUT_FILE"
if systemctl status nginx &>/dev/null; then
    systemctl status nginx --no-pager >> "$OUTPUT_FILE"
else
    echo "NGINX is not installed or not running." >> "$OUTPUT_FILE"
fi
echo "----------------------------------------" >> "$OUTPUT_FILE"

# 3. NFS Mounts
echo "3. NFS Mounts:" >> "$OUTPUT_FILE"
mount | grep nfs >> "$OUTPUT_FILE" || echo "No NFS mounts found." >> "$OUTPUT_FILE"
echo "----------------------------------------" >> "$OUTPUT_FILE"

# 4. Public and Private IP
echo "4. Network Information:" >> "$OUTPUT_FILE"
echo "Private IPs:" >> "$OUTPUT_FILE"
ip addr show | grep 'inet ' | grep -v '127.0.0.1' >> "$OUTPUT_FILE"
echo "Public IP:" >> "$OUTPUT_FILE"
curl -s ifconfig.me || echo "Unable to fetch public IP." >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "----------------------------------------" >> "$OUTPUT_FILE"

# 5. Status of /var/phadmin
echo "5. /var/phadmin Status:" >> "$OUTPUT_FILE"
if [ -d "/var/phadmin" ]; then
    echo "/var/phadmin exists. Disk usage:" >> "$OUTPUT_FILE"
    du -sh /var/phadmin >> "$OUTPUT_FILE"
else
    echo "/var/phadmin does not exist." >> "$OUTPUT_FILE"
fi
echo "----------------------------------------" >> "$OUTPUT_FILE"

# 6. Status of /home/phadmin
echo "6. /home/phadmin Status:" >> "$OUTPUT_FILE"
if [ -d "/home/phadmin" ]; then
    echo "/home/phadmin exists. Disk usage:" >> "$OUTPUT_FILE"
    du -sh /home/phadmin >> "$OUTPUT_FILE"
else
    echo "/home/phadmin does not exist." >> "$OUTPUT_FILE"
fi
echo "----------------------------------------" >> "$OUTPUT_FILE"

echo "Report saved to $OUTPUT_FILE"
