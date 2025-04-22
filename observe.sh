#!/usr/bin/env bash

# Define observability components to check
components=(grafana prometheus alloy node_exporter blackbox_exporter telegraf loki influxdb)

# Paths
SYSMON_DOCKER="$HOME/src/devops/sysmon/docker/simple"
systemd_dirs=("/etc/systemd/system" "/lib/systemd/system")
config_dirs=("/etc" "$SYSMON_DOCKER")

# Optional colors
GREEN=$(tput setaf 2)
RED=$(tput setaf 1)
BLUE=$(tput setaf 4)
YELLOW=$(tput setaf 3)
MAGENTA=$(tput setaf 5)
RESET=$(tput sgr0)
BOLD=$(tput bold)

echo "---- ${BOLD}Observability Summary${RESET} ----"
echo

# 1. Systemd Services
echo "${BLUE}[+] Checking for systemd services...${RESET}"
for component in "${components[@]}"; do
  found_service=0
  for dir in "${systemd_dirs[@]}"; do
    mapfile -t paths < <(find "$dir" -type f -iname "*${component}*.service" 2>/dev/null)
    if [[ ${#paths[@]} -gt 0 ]]; then
      for path in "${paths[@]}"; do
        service_file=$(basename "$path")
        status="${RED}(not running)${RESET}"
        pid=""
        user="N/A"
        if systemctl is-active --quiet "$service_file"; then
          status="${GREEN}(running)${RESET}"
          pid=$(systemctl show -p MainPID --value "$service_file" 2>/dev/null)
          if [[ "$pid" =~ ^[0-9]+$ ]] && [ "$pid" -gt 0 ]; then
            user=$(ps -o user= -p "$pid" 2>/dev/null)
          fi
        fi
        printf " - %-20s -> %s %s (owner: %s, pid: %s)\n" "$component" "$service_file" "$status" "${user:-N/A}" "${pid:-N/A}"
        found_service=1
      done
    fi
  done
  [[ $found_service -eq 0 ]] && printf " - %-20s -> No service found\n" "$component"
done
echo

# 2. Docker Compose Usage
echo "${BLUE}[+] Checking for Docker usage in $SYSMON_DOCKER...${RESET}"
for component in "${components[@]}"; do
  matches=$(grep -r -i "$component" "$SYSMON_DOCKER" --include="docker-compose*.yml" --include="*.yaml" --include="Dockerfile" 2>/dev/null)
  if [[ -n "$matches" ]]; then
    running_container=$(docker ps --format '{{.Names}}:{{.ID}}' | grep -i "$component" | head -n1)
    if [[ -n "$running_container" ]]; then
      container_name=$(cut -d: -f1 <<< "$running_container")
      container_id=$(cut -d: -f2 <<< "$running_container")
      container_user=$(docker inspect --format='{{.Config.User}}' "$container_id" 2>/dev/null)
      container_user="${container_user:-root}"
      printf " - %-20s -> ${GREEN}(running in Docker)${RESET} (name: %s, user: %s)\n" "$component" "$container_name" "$container_user"
    else
      printf " - %-20s -> ${YELLOW}(configured, not running)${RESET}\n" "$component"
    fi
  fi
done
echo

# 3. Config Files
echo "${BLUE}[+] Checking for configuration files...${RESET}"
for component in "${components[@]}"; do
  config_found=0
  for dir in "${config_dirs[@]}"; do
    mapfile -t results < <(find "$dir" -type f \( -iname "*${component}*.yml" -o -iname "*${component}*.yaml" -o -iname "*${component}*.conf" -o -iname "*${component}.ini" -o -iname "*${component}*.json" \) 2>/dev/null)
    if [[ ${#results[@]} -gt 0 ]]; then
      if [[ $config_found -eq 0 ]]; then
        echo " - ${component}:"
        config_found=1
      fi
      for result in "${results[@]}"; do
        owner=$(stat -c "%U:%G" "$result" 2>/dev/null)
        echo "   ${result} (owner: ${owner})"
      done
    fi
  done
done
echo

# 4. Port Usage
echo "${BLUE}[+] Checking network resolution and port conflicts...${RESET}"
for component in "${components[@]}"; do
  case "$component" in
    grafana) ports=(3000) ;;
    prometheus) ports=(9090) ;;
    loki) ports=(3100) ;;
    influxdb) ports=(8086) ;;
    node_exporter) ports=(9100) ;;
    blackbox_exporter) ports=(9115) ;;
    telegraf) ports=() ;;
    *) ports=() ;;
  esac

  for port in "${ports[@]}"; do
    mapfile -t pids < <(lsof -i :"$port" -sTCP:LISTEN -t 2>/dev/null)
    if [[ ${#pids[@]} -gt 0 ]]; then
      for pid in "${pids[@]}"; do
        proc=$(ps -p "$pid" -o comm= 2>/dev/null)
        user=$(ps -p "$pid" -o user= 2>/dev/null)
        printf " - %-20s -> Port %d is ${RED}in use${RESET} by %s (user: %s, pid: %d)\n" "$component" "$port" "$proc" "$user" "$pid"
      done
    else
      printf " - %-20s -> Port %d is ${GREEN}free${RESET}\n" "$component" "$port"
    fi
  done
done
echo

# 5. DNS Resolution
echo "${BLUE}[+] Checking DNS resolution for component names...${RESET}"
for component in "${components[@]}"; do
  result=$(getent hosts "$component" 2>/dev/null)
  if [[ -n "$result" ]]; then
    ip=$(echo "$result" | awk '{print $1}')
    printf " - %-20s -> ${GREEN}resolves to $ip${RESET}\n" "$component"
  else
    printf " - %-20s -> ${RED}cannot resolve DNS${RESET}\n" "$component"
  fi
done
echo

# 6. System Health
echo "${BLUE}[+] Checking for potential system issues...${RESET}"
disk_usage=$(df -h / | awk 'NR==2 {print $5}')
echo " - Disk usage on /: $disk_usage"

df_pct=$(df -h / | awk 'NR==2 {gsub("%", ""); print $5}')
if [[ "$df_pct" -gt 90 ]]; then
  echo "   ${RED}Warning:${RESET} Disk usage is above 90%."
fi

mem_free=$(free -m | awk '/^Mem:/ {print $4}')
if [[ "$mem_free" -lt 200 ]]; then
  echo " - ${RED}Warning:${RESET} Low free memory: ${mem_free}MB"
fi

for cmd in docker systemctl lsof grep find; do
  if ! command -v "$cmd" &>/dev/null; then
    echo " - ${RED}Missing command:${RESET} $cmd"
  fi
done

# 7. Cron Job Analysis
echo "${BLUE}[+] Checking for cron jobs related to components...${RESET}"
tmpfile=$(mktemp)
components_pattern=$(IFS='|'; echo "${components[*]}")

# User crontabs
for user in $(cut -f1 -d: /etc/passwd); do
    crontab_output=$(crontab -l -u "$user" 2>/dev/null | grep -E -i "$components_pattern")
    if [[ -n "$crontab_output" ]]; then
        echo " - User '$user' crontab:"
        echo "$crontab_output" | sed 's/^/   /'
    fi
done

# System-wide cron files
cron_paths=(
    "/etc/crontab"
    "/etc/cron.d/"
    "/etc/cron.daily/"
    "/etc/cron.hourly/"
    "/etc/cron.weekly/"
    "/etc/cron.monthly/"
    "/var/spool/cron"
)

for path in "${cron_paths[@]}"; do
    if [[ -d "$path" ]]; then
        mapfile -t cron_files < <(find "$path" -type f 2>/dev/null)
        for file in "${cron_files[@]}"; do
            matches=$(grep -E -i "$components_pattern" "$file" 2>/dev/null)
            if [[ -n "$matches" ]]; then
                echo " - Found in $file:"
                echo "$matches" | sed 's/^/   /'
            fi
        done
    elif [[ -f "$path" ]]; then
        matches=$(grep -E -i "$components_pattern" "$path" 2>/dev/null)
        if [[ -n "$matches" ]]; then
            echo " - Found in $path:"
            echo "$matches" | sed 's/^/   /'
        fi
    fi
done

# Systemd timer units
echo " - Checking systemd timer units..."
mapfile -t timers < <(systemctl list-timers --all --no-pager 2>/dev/null | tail -n +2 | awk '{print $1}')
for timer in "${timers[@]}"; do
    timer_info=$(systemctl cat "$timer" 2>/dev/null | grep -E -i "$components_pattern")
    if [[ -n "$timer_info" ]]; then
        echo " - Timer $timer references a component:"
        echo "$timer_info" | sed 's/^/   /'
    fi
done
rm -f "$tmpfile"

echo
echo "---- ${BOLD}End of Summary${RESET} ----"
