#!/usr/bin/env bash

# tetra_tsm_ inspect - Inspection and debugging commands for tsm

# Smart path shortening for terminal display
_tsm_shorten_path() {
    local path="$1"
    local max_width="${2:-60}"  # Default max width

    # If path is shorter than max, return as-is
    if [[ ${#path} -le $max_width ]]; then
        echo "$path"
        return
    fi

    # Replace HOME with ~
    path="${path/#$HOME/\~}"

    # If still too long, intelligently truncate
    if [[ ${#path} -gt $max_width ]]; then
        # Strategy: Keep filename and show truncated directory
        local filename=$(basename "$path")
        local dirname=$(dirname "$path")

        # Calculate available space for dirname
        local available=$((max_width - ${#filename} - 4))  # 4 for ".../"

        if [[ $available -lt 10 ]]; then
            # Very tight space - just show filename with leading ...
            echo ".../${filename}"
        else
            # Show start of path + ... + filename
            local start_len=$((available - 3))
            echo "${dirname:0:$start_len}.../$(basename "$path")"
        fi
    else
        echo "$path"
    fi
}

# Get system resource summary in watchdog format
_tsm_get_resource_summary() {
    case "$(uname)" in
        "Linux")
            _tsm_system_summary_linux
            ;;
        "Darwin")
            _tsm_system_summary_macos
            ;;
        *)
            echo "CPU: -, MEM: -, SWAP: -"
            ;;
    esac
}

# Linux system summary (from watchdog)
_tsm_system_summary_linux() {
    local cpu_us mem_used mem_total swap_used swap_total

    # Simple CPU using top (faster than /proc/stat method)
    cpu_us=$(top -bn1 | awk '/%Cpu\(s\):/ {print $2+$4}' | head -1)
    [[ -z "$cpu_us" ]] && cpu_us="0"

    # Memory info
    read mem_used mem_total < <(free -m | awk '/Mem:/ {print $3, $2}')
    read swap_used swap_total < <(free -m | awk '/Swap:/ {print $3, $2}')

    echo "CPU: ${cpu_us}/100, MEM: ${mem_used}/${mem_total}, SWAP: ${swap_used}/${swap_total}"
}

# macOS system summary
_tsm_system_summary_macos() {
    local cpu_us mem_used mem_total swap_used

    # CPU usage from top
    cpu_us=$(top -l1 -n0 | awk '/CPU usage:/ {print $3}' | sed 's/%//')
    [[ -z "$cpu_us" ]] && cpu_us="0"

    # Memory info from vm_stat and system_profiler
    local page_size=$(vm_stat | grep "page size" | awk '{print $8}')
    [[ -z "$page_size" ]] && page_size=4096

    local pages_free pages_active pages_inactive pages_wired
    eval $(vm_stat | awk '
        /Pages free:/ {print "pages_free=" $3}
        /Pages active:/ {print "pages_active=" $3}
        /Pages inactive:/ {print "pages_inactive=" $3}
        /Pages wired down:/ {print "pages_wired=" $4}
    ' | tr -d '.')

    # Calculate memory in MB
    mem_used=$(( (pages_active + pages_inactive + pages_wired) * page_size / 1024 / 1024 ))
    mem_total=$(( (pages_free + pages_active + pages_inactive + pages_wired) * page_size / 1024 / 1024 ))

    # macOS doesn't use traditional swap files, so simplified
    swap_used="-"

    echo "CPU: ${cpu_us}/100, MEM: ${mem_used}/${mem_total}, SWAP: ${swap_used}"
}

tetra_tsm_list() {
    _tetra_tsm_get_all_processes
    tsm_format_process_list
}

tetra_tsm_env() {
    local pattern="${1:-}"
    [[ -n "$pattern" ]] || { echo "tsm: env <process|id>" >&2; return 64; }

    # Colors
    local C_TITLE='\033[1;36m'
    local C_SECTION='\033[1;34m'
    local C_VAR='\033[0;33m'
    local C_VALUE='\033[0;37m'
    local C_GRAY='\033[0;90m'
    local C_NC='\033[0m'

    local resolved_id
    resolved_id=$(tetra_tsm_resolve_to_id "$pattern")
    if [[ $? -ne 0 ]]; then
        echo -e "${C_ERROR}✗ Process '$pattern' not found${C_NC}" >&2
        return 1
    fi

    local name
    name=$(tetra_tsm_id_to_name "$resolved_id")

    local env_file="$TSM_PROCESSES_DIR/$name.env"
    if [[ -f "$env_file" ]]; then
        local var_count=$(grep -c "^" "$env_file" 2>/dev/null || echo "0")

        echo -e "${C_TITLE}╔═══════════════════════════════════════════════════════╗${C_NC}"
        echo -e "${C_TITLE}║  Environment Variables: ${C_VALUE}$name${C_TITLE} (TSM ID: ${C_VALUE}$resolved_id${C_TITLE})${C_NC}"
        echo -e "${C_TITLE}╚═══════════════════════════════════════════════════════╝${C_NC}"
        echo -e "${C_GRAY}Captured at process start time ($var_count variables)${C_NC}"
        echo ""

        # Format variables with colors
        while IFS='=' read -r var_name var_value; do
            # Skip empty lines
            [[ -z "$var_name" ]] && continue

            # Highlight important variables
            case "$var_name" in
                PATH|PYTHONPATH|NODE_PATH|GOPATH)
                    echo -e "${C_SECTION}${var_name}${C_NC}=${C_VALUE}${var_value}${C_NC}"
                    ;;
                *PASSWORD*|*SECRET*|*TOKEN*|*KEY*)
                    # Mask sensitive values
                    echo -e "${C_VAR}${var_name}${C_NC}=${C_GRAY}***MASKED***${C_NC}"
                    ;;
                PORT|HOST|*_PORT|*_HOST)
                    echo -e "${C_VAR}${var_name}${C_NC}=${C_VALUE}${var_value}${C_NC}"
                    ;;
                *)
                    echo -e "${C_GRAY}${var_name}${C_NC}=${C_VALUE}${var_value}${C_NC}"
                    ;;
            esac
        done < <(sort "$env_file")

        echo ""
        echo -e "${C_GRAY}Tip: Environment variables are captured when the process starts${C_NC}"
    else
        echo -e "${C_GRAY}No environment snapshot for '$name'${C_NC}" >&2
        echo -e "${C_GRAY}This can happen if the process was started before env capturing was enabled${C_NC}" >&2
        return 1
    fi
}

tetra_tsm_paths() {
    local pattern="${1:-}"
    [[ -n "$pattern" ]] || { echo "tsm: paths <process|id>" >&2; return 64; }

    local resolved_id
    resolved_id=$(tetra_tsm_resolve_to_id "$pattern")
    if [[ $? -ne 0 ]]; then
        echo "tsm: process '$pattern' not found" >&2
        return 1
    fi

    local name
    name=$(tetra_tsm_id_to_name "$resolved_id")

    echo "Paths for process '$name' (ID: $resolved_id):"
    echo "  meta: $TSM_PROCESSES_DIR/$name/meta.json"
    echo "  pid:  $TSM_PIDS_DIR/$name.pid"
    echo "  env:  $TSM_PROCESSES_DIR/$name.env"
    echo "  out:  $TSM_LOGS_DIR/$name.out"
    echo "  err:  $TSM_LOGS_DIR/$name.err"
}

tetra_tsm_logs() {
    local pattern=""
    local lines="50"
    local follow=false

    # Correct argument parsing
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --lines)
                lines="$2"
                shift 2
                ;;
            -f|--follow)
                follow=true
                shift
                ;;
            --nostream) # Kept for compatibility, it's the default
                follow=false
                shift
                ;;
            -*)
                echo "tsm: unknown flag '$1' for logs command" >&2
                return 64
                ;;
            *)
                if [[ -z "$pattern" ]]; then
                    pattern="$1"
                else
                    echo "tsm: unexpected argument '$1'" >&2
                    return 64
                fi
                shift
                ;;
        esac
    done

    [[ -n "$pattern" ]] || { echo "tsm: logs <process|id|*> [--lines N] [-f|--follow]" >&2; return 64; }

    if [[ "$pattern" == "*" ]]; then
        # Show logs for all processes
        for metafile in "$TSM_PROCESSES_DIR"/*.meta; do
            [[ -f "$metafile" ]] || continue
            local tsm_id=""
            eval "$(cat "$metafile")"
            local name=$(basename "$metafile" .meta)
            echo "==> $name (ID: $tsm_id) <=="
            tetra_tsm_logs_by_id "$tsm_id" "$lines" "$follow"
            echo
        done
    else
        # Resolve name or ID to TSM ID
        local resolved_id
        resolved_id=$(tetra_tsm_resolve_to_id "$pattern")
        if [[ $? -eq 0 ]]; then
            tetra_tsm_logs_by_id "$resolved_id" "$lines" "$follow"
        else
            echo "tsm: process '$pattern' not found" >&2
            return 1
        fi
    fi
}

# Show logs by TSM ID
tetra_tsm_logs_by_id() {
    local id="$1"
    local lines="${2:-50}"
    local follow="${3:-false}"
    local name
    name=$(tetra_tsm_id_to_name "$id") || { echo "tsm: process ID '$id' not found" >&2; return 1; }
    tetra_tsm_logs_single "$name" "$lines" "$follow"
}

tetra_tsm_logs_single() {
    local name="$1"
    local lines="${2:-50}"
    local follow="${3:-false}"

    local meta_file="$TSM_PROCESSES_DIR/$name/meta.json"
    [[ -f "$meta_file" ]] || { echo "tsm: process '$name' not found" >&2; return 1; }

    # Logs are stored in the process directory
    local outlog="$TSM_PROCESSES_DIR/$name/current.out"
    local errlog="$TSM_PROCESSES_DIR/$name/current.err"
    
    # Colors
    local C_SECTION='\033[1;34m'
    local C_GRAY='\033[0;90m'
    local C_ERROR='\033[0;31m'
    local C_NC='\033[0m'

    if [[ "$follow" == "true" ]]; then
        # Follow logs in real-time
        echo -e "${C_SECTION}Following logs for '$name'${C_NC} ${C_GRAY}(Ctrl-C to exit)${C_NC}"
        tail -n "$lines" -f "$outlog" "$errlog" 2>/dev/null
    else
        # Default: show last N lines
        if [[ ! -f "$outlog" && ! -f "$errlog" ]]; then
            echo -e "${C_GRAY}No log files found for '$name'${C_NC}"
            echo -e "${C_GRAY}Log files will be created when the process produces output${C_NC}"
            return
        fi

        echo -e "${C_SECTION}Logs for $name${C_NC} ${C_GRAY}(last $lines lines)${C_NC}"
        echo ""

        # Show stdout
        if [[ -f "$outlog" ]]; then
            if [[ -s "$outlog" ]]; then
                echo -e "${C_SECTION}STDOUT${C_NC}"
                tail -n "$lines" "$outlog" 2>/dev/null
            else
                echo -e "${C_GRAY}stdout: (empty)${C_NC}"
            fi
        fi

        # Show stderr
        if [[ -f "$errlog" ]]; then
            if [[ -s "$errlog" ]]; then
                echo ""
                echo -e "${C_ERROR}STDERR${C_NC}"
                tail -n "$lines" "$errlog" 2>/dev/null
            else
                echo -e "${C_GRAY}stderr: (empty)${C_NC}"
            fi
        fi
    fi
}

tetra_tsm_scan_ports() {
    if ! command -v lsof >/dev/null 2>&1; then
        echo "tsm: 'lsof' command not found, which is required for scanning ports." >&2
        return 1
    fi

    _tetra_tsm_get_all_processes

    declare -A open_ports
    declare -A open_ports_pid
    declare -A open_ports_cmd
    
    while read -r cmd pid port; do
        [[ -n "$port" ]] || continue
        open_ports[$port]=1
        open_ports_pid[$port]=$pid
        open_ports_cmd[$port]=$cmd
    done < <(lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | tail -n +2 | awk '{port=$9; sub(/.*:/, "", port); print $1, $2, port}')

    tsm_format_port_scan

    declare -A reported_ports
    
    # Check ports managed by TSM
    for i in "${!_tsm_procs_name[@]}"; do
        local name="${_tsm_procs_name[i]}"
        local id="${_tsm_procs_id[i]}"
        local port="${_tsm_procs_port[i]}"
        local pid="${_tsm_procs_pid[i]}"
        local proc_status="${_tsm_procs_status[i]}"
        
        [[ "$port" == "-" ]] && continue
        reported_ports[$port]=1

        if [[ -n "${open_ports[$port]}" ]]; then
            # Port is open
            local open_pid="${open_ports_pid[$port]}"
            local open_cmd="${open_ports_cmd[$port]}"
            
            if [[ "$proc_status" == "online" ]]; then
                if [[ "$pid" == "$open_pid" ]]; then
                    tsm_format_port_line "$port" "$pid" "$open_cmd" "Online (TSM: $name)"
                else
                    tsm_format_port_line "$port" "$open_pid" "$open_cmd" "CONFLICT (TSM: $name)"
                fi
            else # status is stopped
                tsm_format_port_line "$port" "$open_pid" "$open_cmd" "LEAKED (TSM: $name)"
            fi
        else
            # Port is not open
            if [[ "$proc_status" == "online" ]]; then
                tsm_format_port_line "$port" "$pid" "-" "ERROR (port not open)"
            fi
        fi
    done

    # Report unmanaged open ports
    for port in "${!open_ports[@]}"; do
        if [[ -z "${reported_ports[$port]}" ]]; then
            local pid="${open_ports_pid[$port]}"
            local cmd="${open_ports_cmd[$port]}"
            tsm_format_port_line "$port" "$pid" "$cmd" "Unmanaged"
        fi
    done

    tsm_format_port_scan_close
}


tetra_tsm_ports() {
    for metafile in "$TSM_PROCESSES_DIR"/*.meta; do
        [[ -f "$metafile" ]] || continue
        
        local name=$(basename "$metafile" .meta)
        local port script
        eval "$(cat "$metafile")"
        
        if [[ "$name" =~ ^(.+)-([0-9]+)$ ]]; then
            local process_name="${BASH_REMATCH[1]}"
            local port_num="${BASH_REMATCH[2]}"
            echo "Process: $process_name, Port: $port_num"
        fi
    done
}

tetra_tsm_info() {
    # Parse arguments with verbosity levels
    # -v = level 1 (basic verbose)
    # -vv = level 2 (more details)
    # -vvv = level 3 (maximum detail)
    local pattern="" verbosity=0
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -vvv)
                verbosity=3
                shift
                ;;
            -vv)
                verbosity=2
                shift
                ;;
            -v|--verbose)
                verbosity=1
                shift
                ;;
            -*)
                echo "tsm: unknown flag '$1' for info command" >&2
                return 64
                ;;
            *)
                pattern="$1"
                shift
                ;;
        esac
    done

    [[ -n "$pattern" ]] || { echo "tsm: info <process|id> [-v|-vv|-vvv]" >&2; return 64; }

    # Colors
    local C_TITLE='\033[1;36m'     # Cyan bold
    local C_SECTION='\033[1;34m'   # Blue bold
    local C_LABEL='\033[0;33m'     # Yellow
    local C_VALUE='\033[0;37m'     # White
    local C_SUCCESS='\033[0;32m'   # Green
    local C_ERROR='\033[0;31m'     # Red
    local C_GRAY='\033[0;90m'      # Gray
    local C_NC='\033[0m'           # No color

    local resolved_id
    resolved_id=$(tetra_tsm_resolve_to_id "$pattern")
    if [[ $? -ne 0 ]]; then
        echo -e "${C_ERROR}✗ Process '$pattern' not found${C_NC}" >&2
        return 1
    fi

    local name
    name=$(tetra_tsm_id_to_name "$resolved_id")

    # --- Gather all data from JSON metadata ---
    local meta_file="$TSM_PROCESSES_DIR/$name/meta.json"
    local pid port start_time script tsm_id process_type interpreter cwd env_file
    pid=$(jq -r '.pid // empty' "$meta_file")
    port=$(jq -r '.port // empty' "$meta_file")
    start_time=$(jq -r '.start_time // empty' "$meta_file")
    script=$(jq -r '.command // empty' "$meta_file")
    tsm_id=$(jq -r '.tsm_id // empty' "$meta_file")
    process_type=$(jq -r '.process_type // "unknown"' "$meta_file")
    interpreter=$(jq -r '.interpreter // "default"' "$meta_file")
    cwd=$(jq -r '.cwd // "unknown"' "$meta_file")
    env_file=$(jq -r '.env_file // ""' "$meta_file")

    local proc_status uptime
    if tetra_tsm_is_running "$name"; then
        proc_status="online"
        local current_time
        current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        if (( elapsed < 60 )); then
            uptime="${elapsed}s"
        elif (( elapsed < 3600 )); then
            uptime="$((elapsed / 60))m"
        else
            uptime="$((elapsed / 3600))h"
        fi
    else
        proc_status="stopped"
        uptime="-"
    fi

    # --- Resource Usage ---
    local cpu_usage="-"
    local mem_usage="-"
    if [[ "$proc_status" == "online" ]]; then
        # Memory (RSS in KB)
        local mem_kb
        mem_kb=$(ps -p "$pid" -o rss= | awk '{print $1}')
        if [[ -n "$mem_kb" && "$mem_kb" -gt 0 ]]; then
            if (( mem_kb > 1024 * 1024 )); then
                mem_usage="$(printf "%.1f GB" "$(echo "$mem_kb / 1024 / 1024" | bc -l)")"
            elif (( mem_kb > 1024 )); then
                mem_usage="$(printf "%.1f MB" "$(echo "$mem_kb / 1024" | bc -l)")"
            else
                mem_usage="${mem_kb} KB"
            fi
        fi

        # CPU
        cpu_usage="$(ps -p "$pid" -o %cpu= | awk '{print $1}')%"
    fi


    # --- Output ---
    echo -e "${C_TITLE}╔═══════════════════════════════════════════════════════╗${C_NC}"
    echo -e "${C_TITLE}║  Process Info: ${C_VALUE}$name${C_TITLE} (TSM ID: ${C_VALUE}$resolved_id${C_TITLE})${C_NC}"
    echo -e "${C_TITLE}╚═══════════════════════════════════════════════════════╝${C_NC}"
    echo ""

    # Status with color and uptime on same line
    local status_display
    if [[ "$proc_status" == "online" ]]; then
        status_display="${C_SUCCESS}● online${C_NC}"
    else
        status_display="${C_ERROR}○ stopped${C_NC}"
    fi

    echo -e "${C_SECTION}PROCESS${C_NC}"
    printf "  ${C_LABEL}%-14s${C_NC} %b ${C_GRAY}(uptime: ${C_VALUE}%s${C_GRAY})${C_NC}\n" "Status:" "$status_display" "$uptime"
    printf "  ${C_LABEL}%-14s${C_NC} ${C_VALUE}%s${C_NC} ${C_GRAY}PID:${C_NC} ${C_VALUE}%s${C_NC}\n" "Type:" "$process_type" "$pid"
    printf "  ${C_LABEL}%-14s${C_NC} ${C_VALUE}%s${C_NC} ${C_GRAY}Memory:${C_NC} ${C_VALUE}%s${C_NC}\n" "CPU:" "$cpu_usage" "$mem_usage"

    echo ""
    # Get terminal width for smart path shortening
    local term_width=${COLUMNS:-$(tput cols 2>/dev/null || echo 80)}
    local max_path_width=$((term_width - 20))  # Leave room for labels and padding

    echo -e "${C_SECTION}RUNTIME${C_NC}"
    local interpreter_short=$(_tsm_shorten_path "$interpreter" "$max_path_width")
    printf "  ${C_LABEL}%-14s${C_NC} ${C_VALUE}%s${C_NC}\n" "Interpreter:" "$interpreter_short"

    local script_short=$(_tsm_shorten_path "$script" "$max_path_width")
    printf "  ${C_LABEL}%-14s${C_NC} ${C_VALUE}%s${C_NC}\n" "Command:" "$script_short"

    local cwd_short=$(_tsm_shorten_path "$cwd" "$max_path_width")
    printf "  ${C_LABEL}%-14s${C_NC} ${C_VALUE}%s${C_NC}\n" "CWD:" "$cwd_short"

    # Port with status indicator
    if [[ -n "$port" && "$port" != "none" && "$port" != "-" ]]; then
        # Check if port is actually open
        local port_status
        if command -v lsof >/dev/null 2>&1; then
            if lsof -iTCP:"$port" -sTCP:LISTEN -P -n 2>/dev/null | grep -q "$pid"; then
                port_status="${C_SUCCESS}listening${C_NC}"
            else
                port_status="${C_ERROR}not listening${C_NC}"
            fi
        else
            port_status="${C_GRAY}unknown${C_NC}"
        fi
        printf "  ${C_LABEL}%-14s${C_NC} ${C_VALUE}%s${C_NC} (%b)\n" "Port:" "$port" "$port_status"
    else
        printf "  ${C_LABEL}%-14s${C_NC} ${C_GRAY}none${C_NC}\n" "Port:"
    fi

    # Environment file
    echo ""
    echo -e "${C_SECTION}ENVIRONMENT${C_NC}"
    if [[ -n "$env_file" && "$env_file" != "null" ]]; then
        printf "  ${C_LABEL}%-14s${C_NC} ${C_VALUE}%s${C_NC}\n" "File:" "$env_file"
        # Check if env snapshot exists
        local env_snapshot="$TSM_PROCESSES_DIR/$name.env"
        if [[ -f "$env_snapshot" ]]; then
            local env_var_count=$(grep -c "^" "$env_snapshot" 2>/dev/null || echo "0")
            printf "  ${C_LABEL}%-14s${C_NC} ${C_GRAY}%d variables captured${C_NC}\n" "Snapshot:" "$env_var_count"
            printf "  ${C_GRAY}%-14s  Use 'tsm env %s' to view all variables${C_NC}\n" "" "$pattern"
        fi
    else
        printf "  ${C_LABEL}%-14s${C_NC} ${C_GRAY}none${C_NC}\n" "File:"
    fi

    # Git metadata (PM2-style)
    local git_branch git_revision git_comment
    git_branch=$(jq -r '.git.branch // empty' "$meta_file" 2>/dev/null)
    git_revision=$(jq -r '.git.revision // empty' "$meta_file" 2>/dev/null)
    git_comment=$(jq -r '.git.comment // empty' "$meta_file" 2>/dev/null)

    if [[ -n "$git_branch" ]]; then
        echo ""
        echo -e "${C_SECTION}REVISION CONTROL${C_NC}"
        printf "  ${C_LABEL}%-14s${C_NC} ${C_VALUE}git${C_NC}\n" "Type:"
        printf "  ${C_LABEL}%-14s${C_NC} ${C_VALUE}%s${C_NC}\n" "Branch:" "$git_branch"
        printf "  ${C_LABEL}%-14s${C_NC} ${C_VALUE}%s${C_NC}\n" "Revision:" "$git_revision"
        if [[ -n "$git_comment" ]]; then
            printf "  ${C_LABEL}%-14s${C_NC} ${C_GRAY}%s${C_NC}\n" "Comment:" "$git_comment"
        fi
    fi

    echo ""
    echo -e "${C_SECTION}LOG FILES${C_NC}"
    local stdout_log="$TSM_PROCESSES_DIR/$name/current.out"
    local stderr_log="$TSM_PROCESSES_DIR/$name/current.err"

    # Show log sizes and locations with shortened paths
    if [[ -f "$stdout_log" ]]; then
        local stdout_size=$(stat -f%z "$stdout_log" 2>/dev/null || stat -c%s "$stdout_log" 2>/dev/null || echo "0")
        local stdout_size_human
        if (( stdout_size > 1024*1024 )); then
            stdout_size_human="$(awk "BEGIN {printf \"%.1f MB\", $stdout_size/1024/1024}")"
        elif (( stdout_size > 1024 )); then
            stdout_size_human="$(awk "BEGIN {printf \"%.1f KB\", $stdout_size/1024}")"
        else
            stdout_size_human="${stdout_size}B"
        fi
        local stdout_short=$(_tsm_shorten_path "$stdout_log" "$max_path_width")
        printf "  ${C_LABEL}%-14s${C_NC} ${C_VALUE}%s${C_NC} ${C_GRAY}(%s)${C_NC}\n" "stdout:" "$stdout_short" "$stdout_size_human"
    else
        local stdout_short=$(_tsm_shorten_path "$stdout_log" "$max_path_width")
        printf "  ${C_LABEL}%-14s${C_NC} ${C_GRAY}%s (not created)${C_NC}\n" "stdout:" "$stdout_short"
    fi

    if [[ -f "$stderr_log" ]]; then
        local stderr_size=$(stat -f%z "$stderr_log" 2>/dev/null || stat -c%s "$stderr_log" 2>/dev/null || echo "0")
        local stderr_size_human
        if (( stderr_size > 1024*1024 )); then
            stderr_size_human="$(awk "BEGIN {printf \"%.1f MB\", $stderr_size/1024/1024}")"
        elif (( stderr_size > 1024 )); then
            stderr_size_human="$(awk "BEGIN {printf \"%.1f KB\", $stderr_size/1024}")"
        else
            stderr_size_human="${stderr_size}B"
        fi
        local stderr_short=$(_tsm_shorten_path "$stderr_log" "$max_path_width")
        printf "  ${C_LABEL}%-14s${C_NC} ${C_VALUE}%s${C_NC} ${C_GRAY}(%s)${C_NC}\n" "stderr:" "$stderr_short" "$stderr_size_human"
    else
        local stderr_short=$(_tsm_shorten_path "$stderr_log" "$max_path_width")
        printf "  ${C_LABEL}%-14s${C_NC} ${C_GRAY}%s (not created)${C_NC}\n" "stderr:" "$stderr_short"
    fi

    printf "  ${C_GRAY}%-14s  Use 'tsm logs %s' to view logs${C_NC}\n" "" "$pattern"

    # Verbosity level 1 (-v): Show metadata paths
    if [[ $verbosity -ge 1 ]]; then
        echo ""
        echo -e "${C_SECTION}METADATA & PATHS${C_NC}"
        local meta_short=$(_tsm_shorten_path "$meta_file" "$max_path_width")
        printf "  ${C_LABEL}%-14s${C_NC} ${C_GRAY}%s${C_NC}\n" "meta.json:" "$meta_short"

        local pid_file="$TSM_PROCESSES_DIR/$name/${name}.pid"
        local pid_short=$(_tsm_shorten_path "$pid_file" "$max_path_width")
        printf "  ${C_LABEL}%-14s${C_NC} ${C_GRAY}%s${C_NC}\n" "PID file:" "$pid_short"

        if [[ -f "$TSM_PROCESSES_DIR/$name.env" ]]; then
            local env_snap_short=$(_tsm_shorten_path "$TSM_PROCESSES_DIR/$name.env" "$max_path_width")
            printf "  ${C_LABEL}%-14s${C_NC} ${C_GRAY}%s${C_NC}\n" "env snapshot:" "$env_snap_short"
        fi
    fi

    # Verbosity level 2 (-vv): Add system resources and recent logs
    if [[ $verbosity -ge 2 ]]; then
        echo ""
        echo -e "${C_SECTION}SYSTEM RESOURCES${C_NC}"
        local resources="$(_tsm_get_resource_summary)"
        printf "  ${C_GRAY}%s${C_NC}\n" "$resources"

        # Show recent log lines
        echo ""
        echo -e "${C_SECTION}RECENT LOG OUTPUT (last 5 lines)${C_NC}"
        if [[ -f "$stdout_log" ]]; then
            echo -e "  ${C_GRAY}stdout:${C_NC}"
            tail -5 "$stdout_log" 2>/dev/null | sed 's/^/    /' || echo -e "    ${C_GRAY}(empty)${C_NC}"
        fi
        if [[ -f "$stderr_log" && -s "$stderr_log" ]]; then
            echo -e "  ${C_ERROR}stderr:${C_NC}"
            tail -5 "$stderr_log" 2>/dev/null | sed 's/^/    /' || echo -e "    ${C_GRAY}(empty)${C_NC}"
        fi
    fi

    # Verbosity level 3 (-vvv): Add full metadata JSON dump
    if [[ $verbosity -ge 3 ]]; then
        echo ""
        echo -e "${C_SECTION}FULL METADATA (JSON)${C_NC}"
        if [[ -f "$meta_file" ]]; then
            jq '.' "$meta_file" 2>/dev/null | sed 's/^/  /' || echo -e "  ${C_ERROR}(failed to parse JSON)${C_NC}"
        else
            echo -e "  ${C_ERROR}(metadata file not found)${C_NC}"
        fi
    fi

    echo ""
}
