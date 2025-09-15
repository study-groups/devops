#MULTICAT_START
# dir: .
# file: mpm-broken.sh
# mode: function
# cursor: mpm_start
#MULTICAT_END
mpm_start() {
  local name="$1"
  local cmd="$2"
  
  # Create MPM_DIR if it doesn't exist
  mkdir -p "$MPM_DIR"
  
  local pidfile="$MPM_DIR/$name.pid"
  local logfile="$MPM_DIR/$name.log"
  
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

#MULTICAT_START
# dir: .
# file: mpm-broken.sh
# mode: function
# cursor: mpm_list
#MULTICAT_END
mpm_list() {
  echo "Listing all managed processes:"
  printf "%-15s %-8s %-10s %s\n" "NAME" "PID" "STATUS" "COMMAND"
  printf "%-15s %-8s %-10s %s\n" "----" "---" "------" "-------"
  
  # Create MPM_DIR if it doesn't exist
  mkdir -p "$MPM_DIR"
  
  local found_any=0
  for pidfile in "$MPM_DIR"/*.pid; do
    if [[ ! -f "$pidfile" ]]; then
      continue
    fi
    
    found_any=1
    local name
    name=$(basename "$pidfile" .pid)
    local pid
    pid=$(cat "$pidfile" 2>/dev/null || echo "unknown")
    
    # Proper status checking using kill -0
    local status
    if [[ "$pid" != "unknown" ]] && kill -0 "$pid" 2>/dev/null; then
      status="running"
    else
      status="stopped" 
    fi
    
    # Try to get command from ps
    local command="unknown"
    if [[ "$pid" != "unknown" ]] && [[ "$status" == "running" ]]; then
      command=$(ps -p "$pid" -o command= 2>/dev/null | head -1 || echo "unknown")
    fi
    
    printf "%-15s %-8s %-10s %s\n" "$name" "$pid" "$status" "$command"
  done
  
  if [[ "$found_any" -eq 0 ]]; then
    echo "No processes found"
  fi
}

#MULTICAT_START
# dir: .
# file: mpm-broken.sh
# mode: function
# cursor: mpm_stop
#MULTICAT_END
mpm_stop() {
  local name="$1"
  local pidfile="$MPM_DIR/$name.pid"
  
  if [[ ! -f "$pidfile" ]]; then
    echo "Process '$name' not found"
    return 1
  fi
  
  # Handle case where pidfile is empty or contains invalid PID
  local pid
  if ! pid=$(cat "$pidfile" 2>/dev/null) || [[ -z "$pid" ]]; then
    echo "Invalid PID file for process '$name'"
    rm -f "$pidfile"
    return 1
  fi
  
  echo "Stopping process '$name' (PID: $pid)"
  
  # Graceful shutdown: try TERM first, then KILL
  if kill -0 "$pid" 2>/dev/null; then
    if kill -TERM "$pid" 2>/dev/null; then
      # Wait a bit for graceful shutdown
      sleep 2
      if kill -0 "$pid" 2>/dev/null; then
        # Still running, force kill
        kill -KILL "$pid" 2>/dev/null
      fi
    fi
    
    # Clean up PID file
    rm -f "$pidfile"
    echo "Process '$name' stopped"
  else
    echo "Process '$name' was already stopped"
    rm -f "$pidfile"
  fi
}

#MULTICAT_START
# dir: .
# file: mpm-broken.sh
# mode: function
# cursor: mpm_logs
#MULTICAT_END
mpm_logs() {
  local name="$1"
  local lines="${2:-50}"
  
  local logfile="$MPM_DIR/$name.log"
  
  if [[ ! -f "$logfile" ]]; then
    echo "No log file found for process '$name'"
    return 1
  fi
  
  echo "Last $lines lines from '$name':"
  tail -n "$lines" "$logfile"
}