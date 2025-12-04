#!/usr/bin/env bash

# routing.sh
# Enhanced system routing and service summary tool.

# --- Configuration ---
NGINX_CONF_DIR="/etc/nginx"
SYSTEM_CRON_DIRS=("/etc/cron.d" "/etc/cron.hourly" "/etc/cron.daily" "/etc/cron.weekly" "/etc/cron.monthly")
SYSTEM_CRONTAB="/etc/crontab"
DEFAULT_COLUMNS=80 # Still used for header centering

# --- Flags ---
RUN_HELP=0
RUN_ALL=0
RUN_NGINX=0
RUN_SYSTEMD=0
RUN_DOCKER=0
RUN_CRON=0
RUN_PORTS=0

# --- Helper Functions ---

print_header() {
  local title="$1"
  local width=${COLUMNS:-$DEFAULT_COLUMNS}
  # Ensure width is at least title length + 2
  width=$(( width > ${#title} + 2 ? width : ${#title} + 2 ))
  local padding_total=$(( width - ${#title} - 2 ))
  local padding_left=$(( padding_total / 2 ))
  local padding_right=$(( padding_total - padding_left ))
  # Print header centered (approximately)
  printf "\n%*s%s%*s\n" $padding_left "" " $title " $padding_right "" | sed 's/ /=/g' | cut -c 1-$width
}

# Removed print_separator function

command_exists() {
  command -v "$1" &> /dev/null
}

# Simple trap cleanup function
cleanup() {
    rm -f /tmp/nginx_T_output.* /tmp/cron_out.* /tmp/cron_err.*
}
# Function to add files to the main cleanup trap
add_cleanup() {
    local current_trap
    current_trap=$(trap -p EXIT | sed "s/.*'\\(.*\\)'.*/\1/")
    if ! echo "$current_trap" | grep -q "rm -f \"$1\""; then
       trap "${current_trap} rm -f \"$1\";" EXIT HUP INT QUIT TERM
    fi
}

display_help() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Summarizes various system routing and service configurations."
  echo ""
  echo "Options:"
  echo "  --help           Display this help message and exit."
  echo "  --all            Run all summaries (nginx, systemd, docker, cron, ports)."
  echo "  --nginx          Summarize Nginx: config files and localhost proxy mappings."
  echo "  --systemd        Summarize systemd: active services (Exec, User, Ports, PID)."
  echo "  --docker         Summarize Docker status (running containers, networks)."
  echo "  --cron           Summarize user and system cron jobs."
  echo "  --ports          Summarize all listening network ports (TCP/UDP) using ss/netstat."
  echo ""
  echo "If no options are provided, this help message is displayed."
  echo "Note: Some summaries may require 'sudo' for full details (esp. lsof/port info)."

}

summarize_nginx() {
  print_header "Nginx Configuration Summary"
  local TEMP_FILE
  TEMP_FILE=$(mktemp /tmp/nginx_T_output.XXXXXX) || { echo "Failed to create temp file"; exit 1; }
  add_cleanup "$TEMP_FILE"

  if [ ! -d "$NGINX_CONF_DIR" ]; then
    echo "Status: Nginx configuration directory '$NGINX_CONF_DIR' not found."
    return
  fi

  if command_exists nginx; then
    echo "Status: Testing Nginx configuration and capturing effective setup..."
    if ! nginx -T > "$TEMP_FILE" 2>&1; then
      echo "Error: 'nginx -T' failed. Configuration might be invalid."
      echo "Error details:"
      echo "" # Replaced print_separator
      cat "$TEMP_FILE"
      echo "" # Replaced print_separator
      return
    fi

    echo "Status: Nginx configuration appears valid."
    echo "Nginx Configuration Files Found (from 'nginx -T'):"
    grep '^# configuration file' "$TEMP_FILE" | sed 's/^# configuration file //; s/:$//' | awk '{print "- "$0}'
    echo "" # Replaced print_separator

    echo "Potential URL -> Service Port Mappings (localhost/127.0.0.1):"
    local found_mapping=0
    grep -nE '(proxy|fastcgi|uwsgi)_pass\s+https?://(localhost|127\.0\.0\.1):[0-9]+' "$TEMP_FILE" | while IFS=: read -r line_num line_content; do
        found_mapping=1
        target=$(echo "$line_content" | grep -oE '(localhost|127\.0\.0\.1):[0-9]+')
        context_limit=30
        start_line=$(( line_num > context_limit ? line_num - context_limit : 1 ))
        context=$(sed -n "${start_line},${line_num}p" "$TEMP_FILE")
        current_location=$(echo "$context" | grep -Eo 'location\s+[^\{]+' | tail -n 1 | sed -e 's/location\s*//' -e 's/\s*{$//' | xargs)
        [ -z "$current_location" ] && current_location="<location N/A>"
        current_server_name=$(echo "$context" | grep -Eo 'server_name\s+[^;]+' | tail -n 1 | sed 's/server_name\s*//' | xargs)
        [ -z "$current_server_name" ] && current_server_name="<server_name N/A>"
        directive_line=$(echo "$line_content" | xargs)

        printf "  [File Context around line %s]\n" "$line_num"
        printf "  Server Name(s): %s\n" "$current_server_name"
        printf "  Location Block: %s\n" "$current_location"
        printf "  Directive:      %s\n" "$directive_line"
        printf "  Mapping Found:  %s %s -> %s\n\n" "$current_server_name" "$current_location" "$target"

    done

    if [ $found_mapping -eq 0 ]; then
        echo "No direct proxy directives (proxy_pass, fastcgi_pass, uwsgi_pass) to localhost:<port> or 127.0.0.1:<port> found in the effective configuration."
    fi
    echo "" # Replaced print_separator

  else
    echo "Warning: 'nginx' command not found. Cannot perform configuration analysis."
    echo "Listing contents of '$NGINX_CONF_DIR' recursively as fallback:"
    echo "" # Replaced print_separator
    ls -lR "$NGINX_CONF_DIR"
    echo "" # Replaced print_separator
  fi

  echo "Nginx Summary Complete."
}

summarize_systemd() {
  print_header "Systemd Summary"
  if ! command_exists systemctl; then
    echo "Status: 'systemctl' command not found. Cannot summarize systemd units."
    return
  fi

  echo "Active Service Details (including detected listening ports):"
  echo "(Port detection uses 'lsof'; run with 'sudo' for complete results across all users)"
  echo "" # Replaced print_separator

  local lsof_available=0
  if command_exists lsof; then
      lsof_available=1
  else
      echo "Warning: 'lsof' command not found. Port detection for services will be skipped."
      echo "" # Replaced print_separator
  fi

  systemctl list-units --type=service --state=running --no-pager --no-legend --plain | awk '{print $1}' | while read -r service_unit; do
    if [ -z "$service_unit" ]; then continue; fi

    local props main_pid main_pid_fallback=""
    props=$(systemctl show "$service_unit" --no-pager \
      --property=Description \
      --property=ExecStart \
      --property=User \
      --property=Group \
      --property=MainPID \
      --property=FragmentPath \
      2>/dev/null)

    main_pid=$(echo "$props" | grep '^MainPID=' | cut -d= -f2-)

    # Handle cases where 'show' fails but PID might be retrievable
    # Or when props are returned but PID is 0 or empty
    if [ -z "$props" ] || ( [ -n "$props" ] && ([ -z "$main_pid" ] || [ "$main_pid" -eq 0 ] ) ); then
      main_pid_fallback=$(systemctl show "$service_unit" --no-pager -p MainPID --value 2>/dev/null)
      # Check if fallback PID is valid
      if [ -z "$main_pid_fallback" ] || [ "$main_pid_fallback" -eq 0 ]; then
         echo "Service: $service_unit"
         echo "  Error: Could not retrieve details or PID (might have stopped or is transient?)"
         echo ""
         continue
      else
         # Got fallback PID, print minimal info
         echo "Service: $service_unit (PID: ${main_pid_fallback})"
         echo "  Desc:    <Details unavailable>"
         main_pid=$main_pid_fallback # Use this PID for lsof
         props="" # Clear props to prevent parsing below
      fi
    fi

    # Parse the key=value output if props were fetched successfully
    local description exec_start user group fragment_path command_line
    if [ -n "$props" ]; then
        # If main_pid wasn't set above (because props were initially valid), set it now.
        [ -z "$main_pid" ] && main_pid=$(echo "$props" | grep '^MainPID=' | cut -d= -f2-)

        description=$(echo "$props" | grep '^Description=' | cut -d= -f2-)
        exec_start=$(echo "$props" | grep '^ExecStart=' | cut -d= -f2-)
        user=$(echo "$props" | grep '^User=' | cut -d= -f2-)
        group=$(echo "$props" | grep '^Group=' | cut -d= -f2-)
        fragment_path=$(echo "$props" | grep '^FragmentPath=' | cut -d= -f2-)

        command_line=$(echo "$exec_start" | sed -n 's/^{ path=\([^ ;]*\).*argv\[\]=\([^;]*\).*$/\1 \2/p' | sed 's/;$//' | xargs)
        if [ -z "$command_line" ]; then
            command_line=$(echo "$exec_start" | sed 's/^{.*path=\([^ ;]*\).*$/\1/ ; s/.*=//' | xargs)
        fi

        echo "Service: $service_unit (PID: ${main_pid:-N/A})" # PID in title
        echo "  Desc:    ${description:-<Not Set>}"
        echo "  File:    ${fragment_path:-<Not Found>}"
        echo "  User:    ${user:-<Default (root)>}"
        echo "  Group:   ${group:-<Default (root)>}"
        echo "  Exec:    ${command_line:-<Not Set>}"
    fi # End if props not empty

    # Attempt to find listening ports using lsof for the MainPID
    if [ "$lsof_available" -eq 1 ] && [ -n "$main_pid" ] && [ "$main_pid" -gt 0 ]; then
        echo "  LPorts:" # Updated title
        local lsof_output ports_found=0
        lsof_output=$(LC_ALL=C lsof -P -n -p "$main_pid" -iTCP -sTCP:LISTEN -iUDP 2>/dev/null || true)

        if [ -n "$lsof_output" ]; then
            # Cleaned up awk script, ensuring braces match and syntax is valid
            echo "$lsof_output" | awk -v found=0 '
            NR > 1 && ($9 ~ /[*0-9]:[0-9]+$/ || $9 ~ /\[::\]:[0-9]+$/) {
                proto = "?";
                if ($5 == "IPv4" || $5 == "IPv6") {
                    if ($8 == "TCP") { proto = "TCP"; }
                    else if ($8 == "UDP") { proto = "UDP"; }
                } else if ($5 == "TCP" || $5 == "UDP") {
                    proto = $5;
                }
                listen_addr = $9;
                printf "    - %-5s %s\n", proto, listen_addr;
                found=1;
            }
            END { exit !found }' # END block outside main pattern block

             if [ $? -ne 0 ]; then
                 ports_found=0
             else
                 ports_found=1
             fi
        fi

        if [ $ports_found -eq 0 ]; then
             echo "    <No listening TCP/UDP sockets found by lsof for PID $main_pid>"
        fi
    elif [ "$lsof_available" -eq 1 ]; then
        echo "  LPorts: <PID not found/invalid>"
    fi

    echo "" # Spacing between services

  done
  echo "" # Replaced print_separator
  echo "Systemd Summary Complete."
}


summarize_docker() {
  print_header "Docker Summary"
  if ! command_exists docker; then
    echo "Status: 'docker' command not found. Docker summary skipped."
    return
  fi

  if ! docker info > /dev/null 2>&1; then
     echo "Warning: Cannot connect to the Docker daemon."
     echo "         Ensure Docker is running and you have permissions."
     return
  fi

  echo "Running Containers (docker ps):"
  echo "" # Replaced print_separator
  docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.Names}}"
  echo "" # Replaced print_separator

  echo "Docker Networks (docker network ls):"
  echo "" # Replaced print_separator
  docker network ls
  echo "" # Replaced print_separator
  echo "Docker Summary Complete."
}

summarize_cron() {
  print_header "Cron Job Summary"
  local CRON_TEMP_OUT CRON_TEMP_ERR
  CRON_TEMP_OUT=$(mktemp /tmp/cron_out.XXXXXX) || { echo "Failed to create temp file"; exit 1; }
  CRON_TEMP_ERR=$(mktemp /tmp/cron_err.XXXXXX) || { rm -f "$CRON_TEMP_OUT"; echo "Failed to create temp file"; exit 1; }
  add_cleanup "$CRON_TEMP_OUT"
  add_cleanup "$CRON_TEMP_ERR"

  echo "Current User Cron Jobs (crontab -l for $(whoami)):"
  echo "" # Replaced print_separator
  if crontab -l > "$CRON_TEMP_OUT" 2> "$CRON_TEMP_ERR"; then
    cat "$CRON_TEMP_OUT"
  else
    if grep -q "no crontab for" "$CRON_TEMP_ERR"; then
      echo "[No crontab found for user $(whoami)]"
    else
      echo "Error checking user crontab:"
      cat "$CRON_TEMP_ERR"
    fi
  fi

  echo "" # Replaced print_separator

  echo "System-Wide Cron File ($SYSTEM_CRONTAB):"
  echo "" # Replaced print_separator
  if [ -f "$SYSTEM_CRONTAB" ] && [ -r "$SYSTEM_CRONTAB" ]; then
    grep -v '^\s*#' "$SYSTEM_CRONTAB" | grep -v '^\s*$'
  elif [ ! -f "$SYSTEM_CRONTAB" ]; then
     echo "[$SYSTEM_CRONTAB not found]"
  else
     echo "[Cannot read $SYSTEM_CRONTAB (permission issue?)]"
  fi
  echo "" # Replaced print_separator

  echo "System Cron Directory Contents (/etc/cron.*):"
  echo "" # Replaced print_separator
  for dir in "${SYSTEM_CRON_DIRS[@]}"; do
    if [ -d "$dir" ]; then
      echo "[$dir]:"
      # Use find for cleaner output and handling of empty dirs
      find "$dir" -maxdepth 1 -mindepth 1 -printf "  %f\n" 2>/dev/null || echo "  <Error listing contents>"
      echo ""
    else
      echo "[$dir not found]"
    fi
  done
  echo "" # Replaced print_separator
  echo "Cron Summary Complete."
}

summarize_ports() {
  print_header "Global Listening Network Ports Summary (ss/netstat)"
  echo "(Shows all listening ports; ports for specific systemd services shown via --systemd)"
  echo "(May require 'sudo' for full process details. Output might wrap.)"

  local found_tool=0
  if command_exists ss; then
    echo "Using 'ss -tulnp':"
    echo "" # Replaced print_separator
    ss -tulnp
    echo "" # Replaced print_separator
    found_tool=1
  elif command_exists netstat; then
    echo "Warning: 'ss' command not found. Falling back to 'netstat -tulnp'."
    echo "" # Replaced print_separator
    netstat -tulnp
    echo "" # Replaced print_separator
    found_tool=1
  fi

  if [ $found_tool -eq 0 ]; then
    echo "Error: Neither 'ss' nor 'netstat' command found."
  fi
  echo "Global Port Summary Complete."
}


# --- Argument Parsing ---
trap cleanup EXIT HUP INT QUIT TERM

if ! ARGS=$(getopt -o h --long help,all,nginx,systemd,docker,cron,ports -n "$0" -- "$@"); then
    display_help
    exit 1
fi

eval set -- "$ARGS"

while true; do
    case "$1" in
        -h | --help) RUN_HELP=1; shift ;;
        --all) RUN_ALL=1; shift ;;
        --nginx) RUN_NGINX=1; shift ;;
        --systemd) RUN_SYSTEMD=1; shift ;;
        --docker) RUN_DOCKER=1; shift ;;
        --cron) RUN_CRON=1; shift ;;
        --ports) RUN_PORTS=1; shift ;;
        --) shift; break ;;
        *) echo "Internal error parsing options!" ; exit 1 ;;
    esac
done

# --- Main Execution Logic ---

if [ $RUN_HELP -eq 1 ]; then
  display_help
  trap - EXIT HUP INT QUIT TERM
  exit 0
fi

if [ $RUN_ALL -eq 0 ] && [ $RUN_NGINX -eq 0 ] && [ $RUN_SYSTEMD -eq 0 ] && [ $RUN_DOCKER -eq 0 ] && [ $RUN_CRON -eq 0 ] && [ $RUN_PORTS -eq 0 ]; then
  echo "No summary option specified."
  display_help
  trap - EXIT HUP INT QUIT TERM
  exit 1
fi

if [ $RUN_ALL -eq 1 ]; then
  RUN_NGINX=1
  RUN_SYSTEMD=1
  RUN_DOCKER=1
  RUN_CRON=1
  RUN_PORTS=1
fi

if [ $RUN_NGINX -eq 1 ]; then
  summarize_nginx
fi

if [ $RUN_SYSTEMD -eq 1 ]; then
  summarize_systemd
fi

if [ $RUN_DOCKER -eq 1 ]; then
  summarize_docker
fi

if [ $RUN_CRON -eq 1 ]; then
  summarize_cron
fi

if [ $RUN_PORTS -eq 1 ]; then
  summarize_ports
fi

print_header "Script Finished"
trap - EXIT HUP INT QUIT TERM
exit 0
