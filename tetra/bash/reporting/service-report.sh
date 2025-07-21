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
    echo "  all       Run all reports in verbose mode."
    echo "  nginx     Show detailed NGINX report."
    echo "  systemd   Show detailed systemd report."
    echo "  docker    Show detailed Docker report."
    echo "  pm2       Show detailed PM2 report."
    echo "  ports     Show a report on all used ports."
    echo "  help      Display this help message."
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
        (echo -e "Port\tService\tAction\tDetails"; sort -u -k1,4 "$PORTS_DATA_FILE") | column -t -s $'\t' -o '  ' >> "$REPORT_FILE"
    else
        echo "No port information collected." >> "$REPORT_FILE"
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
