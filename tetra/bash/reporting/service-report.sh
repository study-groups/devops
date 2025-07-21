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
    echo "Usage: $0 [options]"
    echo ""
    echo "Generates a service interworking report."
    echo ""
    echo "Options:"
    echo "  --verbose   Show detailed information for all services."
    echo "  --summary   Show a summary view (default)."
    echo "  --ports     Include a report on all used ports."
    echo "  --help, -h  Display this help message."
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

VERBOSITY="summary" # Default verbosity
RUN_PORTS_REPORT=0

while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        --verbose)
        VERBOSITY="verbose"
        shift
        ;;
        --summary)
        VERBOSITY="summary"
        shift
        ;;
        --ports)
        RUN_PORTS_REPORT=1
        shift
        ;;
        --help | -h)
        display_help
        exit 0
        ;;
        *)
        echo "Unknown option: $key"
        exit 1
        ;;
    esac
done

# --- Main Logic ---

# Step 1: Always collect all data first
# The collection functions will now use add_port_info
touch "$PORTS_DATA_FILE"
collect_nginx_data
collect_docker_data
collect_pm2_data
collect_systemd_data

# Step 2: Generate reports based on flags
REPORT_FILE="$DEFAULT_REPORT_FILE"
> "$REPORT_FILE" # Clear the report file

echo "Service Interworking Report" >> "$REPORT_FILE"
echo "===========================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

process_env_report # Always include env report

if [ "$VERBOSITY" == "summary" ]; then
    generate_nginx_summary >> "$REPORT_FILE"
    generate_systemd_summary >> "$REPORT_FILE"
    generate_pm2_summary >> "$REPORT_FILE"
fi

if [ "$VERBOSITY" == "verbose" ]; then
    generate_nginx_detailed >> "$REPORT_FILE"
    generate_systemd_detailed >> "$REPORT_FILE"
    generate_pm2_detailed >> "$REPORT_FILE"
fi

if [ $RUN_PORTS_REPORT -eq 1 ]; then
    generate_ports_report
fi

echo "Report generated at: $REPORT_FILE"
