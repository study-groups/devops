#!/usr/bin/env bash
# mpm-broken.sh - Mini Process Manager (broken version for tutorial)
# A simplified process manager based on pm2 semantics

set -euo pipefail

# Configuration - intentionally missing initialization
MPM_DIR=${MPM_DIR:-}  # This will cause issues

usage() {
  cat <<EOF
Mini Process Manager (mpm) - A simplified process manager

Usage: $0 <command> [options]

Commands:
  start <name> <command>    Start a new process
  stop <name>              Stop a process
  list                     List all processes
  logs <name> [lines]      Show process logs
  
Examples:
  $0 start webserver "python -m http.server 8080"
  $0 stop webserver
  $0 list
  $0 logs webserver 50
EOF
}

# Broken function - missing directory creation, wrong pidfile path
mpm_start() {
  local name="$1"
  local cmd="$2"
  
  local pidfile="$name.pid"  # Should be in MPM_DIR
  local logfile="$name.log"  # Should be in MPM_DIR
  
  if [[ -f "$pidfile" ]]; then
    local pid
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      echo "Process '$name' is already running (PID: $pid)"
      return 1
    fi
  fi
  
  echo "Starting process '$name': $cmd"
  nohup bash -c "$cmd" > "$logfile" 2>&1 &
  local pid=$!
  echo "$pid" > "$pidfile"
  echo "Started '$name' with PID $pid"
}

# Broken function - incorrect process status checking
mpm_list() {
  echo "Listing all managed processes:"
  printf "%-15s %-8s %-10s %s\n" "NAME" "PID" "STATUS" "COMMAND"
  printf "%-15s %-8s %-10s %s\n" "----" "---" "------" "-------"
  
  # Wrong: looking in current directory instead of MPM_DIR
  for pidfile in *.pid; do
    if [[ ! -f "$pidfile" ]]; then
      echo "No processes found"
      return
    fi
    
    local name="${pidfile%.pid}"
    local pid
    pid=$(cat "$pidfile" 2>/dev/null || echo "unknown")
    
    # Broken status checking - should use kill -0
    if ps -p "$pid" >/dev/null 2>&1; then
      local status="running"
    else
      local status="stopped" 
    fi
    
    # Can't get command info easily - this is a limitation
    printf "%-15s %-8s %-10s %s\n" "$name" "$pid" "$status" "unknown"
  done
}

# Broken function - incorrect PID reading and wrong kill signal
mpm_stop() {
  local name="$1"
  local pidfile="$name.pid"  # Should be in MPM_DIR
  
  if [[ ! -f "$pidfile" ]]; then
    echo "Process '$name' not found"
    return 1
  fi
  
  # Broken: should handle case where pidfile is empty or contains invalid PID
  local pid
  pid=$(cat "$pidfile")
  
  echo "Stopping process '$name' (PID: $pid)"
  
  # Wrong signal - should try TERM first, then KILL
  if kill -9 "$pid" 2>/dev/null; then
    rm -f "$pidfile"
    echo "Process '$name' stopped"
  else
    echo "Failed to stop process '$name'"
    return 1
  fi
}

# Somewhat working function - shows logs
mpm_logs() {
  local name="$1"
  local lines="${2:-50}"
  
  local logfile="$name.log"  # Should be in MPM_DIR
  
  if [[ ! -f "$logfile" ]]; then
    echo "No log file found for process '$name'"
    return 1
  fi
  
  echo "Last $lines lines from '$name':"
  tail -n "$lines" "$logfile"
}

# Main command dispatcher
main() {
  if [[ $# -eq 0 ]]; then
    usage
    exit 1
  fi
  
  local command="$1"
  shift
  
  case "$command" in
    start)
      if [[ $# -ne 2 ]]; then
        echo "Usage: $0 start <name> <command>"
        exit 1
      fi
      mpm_start "$1" "$2"
      ;;
    stop)
      if [[ $# -ne 1 ]]; then
        echo "Usage: $0 stop <name>"
        exit 1
      fi
      mpm_stop "$1"
      ;;
    list)
      mpm_list
      ;;
    logs)
      if [[ $# -lt 1 ]]; then
        echo "Usage: $0 logs <name> [lines]"
        exit 1
      fi
      mpm_logs "$@"
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      echo "Unknown command: $command"
      usage
      exit 1
      ;;
  esac
}

main "$@"