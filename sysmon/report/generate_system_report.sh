#!/bin/bash
# generate_system_report.sh - Collects system info and generates a Mermaid diagram.

# Configuration
source ~/nh/nodeholder/ip.env
SERVERS=("159.65.106.21" "68.183.248.67")
SERVERS=("$do4_n2" "$do4")
SSH_USER="root"
REMOTE_SCRIPT="system_status.sh"
LOCAL_OUTPUT_DIR="system_reports"
MERMAID_OUTPUT="system_status_diagram.mmd"

# Ensure output directory exists
mkdir -p "$LOCAL_OUTPUT_DIR"

# Function to run remote system status script and fetch the report
collect_remote_info() {
    local server=$1

    echo "Collecting system info from $server..."

    # Copy the system_status.sh script to the remote server
    scp "$REMOTE_SCRIPT" "${SSH_USER}@${server}:/tmp/${REMOTE_SCRIPT}"

    # Execute the script remotely
    ssh "${SSH_USER}@${server}" "bash /tmp/${REMOTE_SCRIPT}"

    # Fetch the generated report
    scp "${SSH_USER}@${server}:/root/system_status_*.txt" "${LOCAL_OUTPUT_DIR}/system_status_${server}.txt"

    # Clean up remote script
    ssh "${SSH_USER}@${server}" "rm /tmp/${REMOTE_SCRIPT}"
}

# Step 1: Collect system info from each server
for server in "${SERVERS[@]}"; do
    collect_remote_info "$server"
done

# Step 2: Generate Mermaid Diagram
echo "Generating Mermaid diagram..."

# Initialize Mermaid file
echo 'flowchart TB' > "$MERMAID_OUTPUT"

# Parse each report and add nodes to the diagram
for report in ${LOCAL_OUTPUT_DIR}/*.txt; do
    server_name=$(basename "$report" | sed 's/system_status_\(.*\)\.txt/\1/')

    echo "  subgraph ${server_name^^}[\"$server_name\"]" >> "$MERMAID_OUTPUT"

    # Add components based on report content
    grep -q "/etc/fstab" "$report" && echo "    ${server_name}_fstab[\"fstab\"]" >> "$MERMAID_OUTPUT"
    grep -q "NGINX Status" "$report" && echo "    ${server_name}_nginx[\"NGINX Status\"]" >> "$MERMAID_OUTPUT"
    grep -q "NFS Mounts" "$report" && echo "    ${server_name}_nfs[\"NFS Mounts\"]" >> "$MERMAID_OUTPUT"
    grep -q "Private IPs" "$report" && echo "    ${server_name}_network[\"Private/Public IPs\"]" >> "$MERMAID_OUTPUT"
    grep -q "/var/phadmin" "$report" && echo "    ${server_name}_varphadmin[\"/var/phadmin\"]" >> "$MERMAID_OUTPUT"
    grep -q "/home/phadmin" "$report" && echo "    ${server_name}_homephadmin[\"/home/phadmin\"]" >> "$MERMAID_OUTPUT"

    echo "  end" >> "$MERMAID_OUTPUT"
done

# Add connections
echo "  159.65.106.21 --- 68.183.248.67" >> "$MERMAID_OUTPUT"

echo "Mermaid diagram saved to $MERMAID_OUTPUT"
echo "Reports saved to $LOCAL_OUTPUT_DIR/"
