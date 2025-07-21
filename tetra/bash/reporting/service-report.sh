#!/bin/bash
# Main reporting script

# --- Configuration ---
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
DEFAULT_REPORT_FILE="service-report.txt"
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
    echo "Generates a service interworking report."
    echo ""
    echo "Commands:"
    echo "  all          Run all reports in verbose mode."
    echo "  abbreviated  Show a report of services on ports >1024 and <10000."
    echo "  connections  Analyze and show connections between services."
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
    echo "" >> "$REPORT_FILE"
    echo "Port Usage Report" >> "$REPORT_FILE"
    echo "-----------------" >> "$REPORT_FILE"
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
        ) | column -t -s $'\t' -o '  ' >> "$REPORT_FILE"
    else
        echo "No port information collected." >> "$REPORT_FILE"
    fi
}

generate_abbreviated_ports_report() {
    echo "" >> "$REPORT_FILE"
    echo "Abbreviated Port Usage Report (Ports >1024 & <10000)" >> "$REPORT_FILE"
    echo "----------------------------------------------------" >> "$REPORT_FILE"
    if [ -s "$PORTS_DATA_FILE" ]; then
        (
            echo -e "Port\tService\tAction\tDetails"
            awk -F'\t' '$1 > 1024 && $1 < 10000 {print}' "$PORTS_DATA_FILE" | \
            sort -u -k1,1n
        ) | column -t -s $'\t' -o '  ' >> "$REPORT_FILE"
    else
        echo "No port information collected." >> "$REPORT_FILE"
    fi
}

generate_connections_report() {
    echo "" >> "$REPORT_FILE"
    echo "Service Connection Analysis" >> "$REPORT_FILE"
    echo "---------------------------" >> "$REPORT_FILE"
    if [ ! -s "$PORTS_DATA_FILE" ]; then
        echo "No port information collected." >> "$REPORT_FILE"
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
    ) | column -t -s $'\t' -o '  ' >> "$REPORT_FILE"
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
collect_pm2_data
collect_systemd_data

# Step 2: Generate reports based on commands
REPORT_FILE="$DEFAULT_REPORT_FILE"
> "$REPORT_FILE" # Clear the report file

echo "Service Interworking Report" >> "$REPORT_FILE"
echo "===========================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

process_env_report # Always include env report

# Default to summary if no specific command given
if [ ${#COMMANDS[@]} -eq 0 ]; then
    generate_nginx_summary >> "$REPORT_FILE"
    generate_systemd_summary >> "$REPORT_FILE"
    generate_pm2_summary >> "$REPORT_FILE"
    generate_docker_summary >> "$REPORT_FILE"
fi

for cmd in "${COMMANDS[@]}"; do
    case "$cmd" in
        all)
            generate_nginx_detailed >> "$REPORT_FILE"
            generate_systemd_detailed >> "$REPORT_FILE"
            generate_docker_detailed >> "$REPORT_FILE"
            generate_pm2_detailed >> "$REPORT_FILE"
            generate_ports_report >> "$REPORT_FILE"
            generate_connections_report >> "$REPORT_FILE"
            ;;
        abbreviated)
            generate_abbreviated_ports_report >> "$REPORT_FILE"
            ;;
        connections)
            generate_connections_report >> "$REPORT_FILE"
            ;;
        nginx)
            generate_nginx_detailed >> "$REPORT_FILE"
            ;;
        systemd)
            generate_systemd_detailed >> "$REPORT_FILE"
            ;;
        docker)
            generate_docker_detailed >> "$REPORT_FILE"
            ;;
        pm2)
            generate_pm2_detailed >> "$REPORT_FILE"
            ;;
        ports)
            generate_ports_report >> "$REPORT_FILE"
            ;;
        help)
            display_help
            ;;
        *)
            echo "Unknown command: $cmd"
            display_help
            exit 1
            ;;
    esac
done

echo "Report generated at: $REPORT_FILE"
