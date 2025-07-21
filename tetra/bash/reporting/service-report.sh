#!/bin/bash
# Main reporting script

# --- Privilege Check ---
if [ "$(id -u)" -ne 0 ]; then
    # Check if sudo is installed
    if ! command -v sudo &> /dev/null; then
        echo "sudo command not found. Please run this script as root." >&2
        exit 1
    fi
    echo "This script needs root privileges. Re-running with sudo..." >&2
    # Use exec to replace the current process with the sudo one
    exec sudo bash "$0" "$@"
fi

# --- Configuration ---
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
TEMP_DIR=$(mktemp -d)
export TEMP_DIR # Make TEMP_DIR available to sourced scripts
PORTS_DATA_FILE="$TEMP_DIR/ports.tsv"

# --- Source Reporting Modules ---
source "$SCRIPT_DIR/services/env-report.sh"
source "$SCRIPT_DIR/services/nginx-report.sh"
source "$SCRIPT_DIR/services/systemd-report.sh"
source "$SCRIPT_DIR/services/docker-report.sh"
source "$SCRIPT_DIR/services/pm2-report.sh"
source "$SCRIPT_DIR/services/ports-report.sh" # For add_port_info
# Summary modules are now controlled via CLI flags

# --- Cleanup ---
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# --- Helper Functions ---
display_help() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Generates a service interworking report and prints to stdout."
    echo ""
    echo "Commands:"
    echo "  all          Run all reports in verbose mode."
    echo "  abbreviated  Show a report of services on ports >1024 and <10000."
    echo "  connections  Analyze and show connections between services."
    echo "  domains      List all active NGINX domains."
    echo "  nginx        Show detailed NGINX report."
    echo "  systemd      Show detailed systemd report."
    echo "  docker       Show detailed Docker report."
    echo "  pm2          Show detailed PM2 report."
    echo "  ports        Show a report on all used ports."
    echo "  help         Display this help message."
    echo ""
    echo "If no command is provided, a summary report is generated."
}

# --- Report Generation Functions ---

generate_ports_report() {
    echo ""
    echo "Port Usage Report"
    echo "-----------------"
    if [ -s "$PORTS_DATA_FILE" ]; then
        # Prepend header, sort, and format with a 2-space separator
        (
            echo -e "Port\tService\tAction\tDetails"
            awk -F'\t' '{
                if ($3 == "proxy_pass") {
                    print "1\t" $0
                } else {
                    print "2\t" $0
                }
            }' "$PORTS_DATA_FILE" | \
            sort -u -k1,1 -k5,5 -k2,2n | \
            cut -f2-
        ) | column -t -s $'\t' -o '  '
    else
        echo "No port information collected."
    fi
}

generate_abbreviated_ports_report() {
    echo ""
    echo "Abbreviated Port Usage Report (Ports >1024 & <10000)"
    echo "----------------------------------------------------"
    if [ -s "$PORTS_DATA_FILE" ]; then
        (
            echo -e "Port\tService\tAction\tDetails"
            awk -F'\t' '$1 > 1024 && $1 < 10000 {print}' "$PORTS_DATA_FILE" | \
            sort -u -k1,1n
        ) | column -t -s $'\t' -o '  '
    else
        echo "No port information collected."
    fi
}

generate_connections_report() {
    echo ""
    echo "Service Connection Analysis"
    echo "---------------------------"
    if [ ! -s "$PORTS_DATA_FILE" ]; then
        echo "No port information collected."
        return
    fi

    (
        echo -e "Port\tSource (NGINX)\t->\tDestination"
        awk -F'\t' '
            # First pass: Build listeners map
            FNR==NR {
                if ($3 != "proxy_pass") {
                    if ($1 in listeners) {
                        listeners[$1] = listeners[$1] "; " $2 " (" $4 ")"
                    } else {
                        listeners[$1] = $2 " (" $4 ")"
                    }
                }
                next
            }
            # Second pass: Check proxies and print connections
            {
                if ($3 == "proxy_pass") {
                    port = $1
                    proxy_info = $2 " (" $4 ")"
                    if (port in listeners) {
                        print port, proxy_info, "->", listeners[port]
                    } else {
                        print port, proxy_info, "->", "!! NO LISTENER FOUND !!"
                    }
                }
            }
        ' "$PORTS_DATA_FILE" "$PORTS_DATA_FILE"
    ) | column -t -s $'\t' -o '  '
}

generate_domains_report() {
    echo ""
    echo "Active NGINX Domains"
    echo "--------------------"
    if [ -s "$SCRIPT_DIR/services/nginx-report.sh" ]; then
        cat "$SCRIPT_DIR/services/nginx-report.sh" | grep -E "server_name" | awk -F'server_name' '{print $2}' | tr -d ';' | tr -d ' ' | sort -u
    else
        echo "NGINX report not available."
    fi
}

# --- Argument Parsing ---
if [ $# -eq 0 ]; then
    display_help
    exit 0
fi

COMMANDS=("$@")

# --- Main Logic ---

# Step 1: Always collect all data first
# The collection functions will now use add_port_info
touch "$PORTS_DATA_FILE"
collect_nginx_data
collect_docker_data
collect_systemd_data

# Discover and collect PM2 data for all users running it as a systemd service
if command -v systemctl &> /dev/null; then
    mapfile -t PM2_USERS < <(systemctl list-units 'pm2-*.service' --state=running --no-legend --plain | awk '{print $1}' | sed -e 's/pm2-//' -e 's/\.service//')
    for user in "${PM2_USERS[@]}"; do
        if id "$user" &>/dev/null; then
            collect_pm2_data_for_user "$user"
        fi
    done
fi

# Step 2: Generate reports based on commands
echo "Service Interworking Report"
echo "==========================="
echo ""

process_env_report # Always include env report

# Default to summary if no specific command given
if [ ${#COMMANDS[@]} -eq 0 ]; then
    generate_nginx_summary
    generate_systemd_summary
    for user in "${PM2_USERS[@]}"; do
        if id "$user" &>/dev/null; then
            generate_pm2_summary_for_user "$user"
        fi
    done
    generate_docker_summary
fi

for cmd in "${COMMANDS[@]}"; do
    case "$cmd" in
        all)
            generate_nginx_detailed
            generate_systemd_detailed
            generate_docker_detailed
            for user in "${PM2_USERS[@]}"; do
                if id "$user" &>/dev/null; then
                    generate_pm2_detailed_for_user "$user"
                fi
            done
            generate_ports_report
            generate_connections_report
            ;;
        abbreviated)
            generate_abbreviated_ports_report
            ;;
        connections)
            generate_connections_report
            ;;
        domains)
            generate_domains_report
            ;;
        nginx)
            generate_nginx_detailed
            ;;
        systemd)
            generate_systemd_detailed
            ;;
        docker)
            generate_docker_detailed
            ;;
        pm2)
            for user in "${PM2_USERS[@]}"; do
                if id "$user" &>/dev/null; then
                    generate_pm2_detailed_for_user "$user"
                fi
            done
            ;;
        ports)
            generate_ports_report
            ;;
        help)
            display_help
            ;;
        *)
            echo "Unknown command: $cmd" >&2
            display_help
            exit 1
            ;;
    esac
done
