#!/usr/bin/env bash

# TSM Responsive Formatting Functions
# Provides small/medium/large output formatting based on terminal width

# Get terminal width, default to 80 if not detectable
_tsm_get_terminal_width() {
    local width="${COLUMNS:-}"

    # Try tput if COLUMNS not set
    if [[ -z "$width" ]]; then
        width=$(tput cols 2>/dev/null || echo "80")
    fi

    # Ensure numeric and reasonable
    if ! [[ "$width" =~ ^[0-9]+$ ]] || [[ "$width" -lt 40 ]]; then
        width=80
    fi

    echo "$width"
}

# Determine format mode based on terminal width
_tsm_get_format_mode() {
    local width=$(_tsm_get_terminal_width)

    if [[ $width -lt 60 ]]; then
        echo "compact"
    else
        echo "normal"
    fi
}

# Calculate optimal column widths based on terminal width and content
_tsm_calculate_column_widths() {
    local width=$(_tsm_get_terminal_width)
    local mode="$1"

    # Find longest name
    local max_name_len=4  # minimum for "Name" header
    for name in "${_tsm_procs_name[@]}"; do
        if [[ ${#name} -gt $max_name_len ]]; then
            max_name_len=${#name}
        fi
    done

    # Find longest env file name
    local max_env_len=3  # minimum for "Env" header
    for env_file in "${_tsm_procs_env_file[@]}"; do
        if [[ ${#env_file} -gt $max_env_len ]]; then
            max_env_len=${#env_file}
        fi
    done

    if [[ "$mode" == "compact" ]]; then
        # Compact: ID(4) + Name(flexible) + Status(9) + Port(6) + Env(10) + spaces(8) = 37 + name
        local available=$((width - 37))
        local name_width=$((available > max_name_len ? max_name_len : available))
        echo "$((name_width < 8 ? 8 : name_width)) 8"  # name_width env_width
    else
        # Normal mode: assume at least 80 columns
        local min_width=80
        if [[ $width -lt $min_width ]]; then
            width=$min_width
        fi

        # Fixed columns: ID(4) + Status(9) + PID(6) + Port(6) + Restarts(4) + Uptime(10) + spaces(33) = 70
        # Flexible: Name + Env
        local available=$((width - 70))

        # Give env column priority up to its max needed, then rest to name
        local env_width=$((max_env_len > 12 ? 12 : max_env_len))  # max 12 chars for env
        local remaining=$((available - env_width))
        local name_width=$((remaining > max_name_len ? max_name_len : remaining))
        name_width=$((name_width < 20 ? 20 : name_width))  # minimum 20 chars

        echo "$name_width $env_width"
    fi
}

# Format process list - responsive based on terminal width
tsm_format_process_list() {
    local mode=$(_tsm_get_format_mode)

    if [[ ${#_tsm_procs_name[@]} -eq 0 ]]; then
        echo "No processes found"
        return
    fi

    case "$mode" in
        compact)
            _tsm_format_list_compact
            ;;
        normal)
            _tsm_format_list_normal
            ;;
    esac
}

# Compact format: left-aligned, essential info only
_tsm_format_list_compact() {
    local widths=$(_tsm_calculate_column_widths "compact")
    local name_width=${widths% *}
    local env_width=${widths#* }

    printf "%-2s  %-${name_width}s  %-${env_width}s  %-4s  %-4s  %-7s  %-3s\n" "ID" "NAME" "ENV" "PID" "PORT" "STATUS" "↻"
    printf "%-2s  %-${name_width}s  %-${env_width}s  %-4s  %-4s  %-7s  %-3s\n" "--" "$(printf '%*s' $name_width '' | tr ' ' '-')" "$(printf '%*s' $env_width '' | tr ' ' '-')" "----" "----" "-------" "---"

    for i in "${!_tsm_procs_name[@]}"; do
        local name="${_tsm_procs_name[i]}"
        local status="${_tsm_procs_status[i]}"
        local port="${_tsm_procs_port[i]}"
        local env_file="${_tsm_procs_env_file[i]}"
        local restarts="${_tsm_procs_restarts[i]}"

        # Truncate name if too long
        if [[ ${#name} -gt $name_width ]]; then
            name="${name:0:$((name_width-3))}..."
        fi
        # Truncate status if too long
        if [[ ${#status} -gt 7 ]]; then
            status="${status:0:7}"
        fi
        # Truncate env file if too long
        if [[ ${#env_file} -gt $env_width ]]; then
            env_file="${env_file:0:$((env_width-3))}..."
        fi

        printf "%-2s  %-${name_width}s  %-${env_width}s  %-4s  %-4s  %-7s  %-3s\n" \
            "${_tsm_procs_id[i]}" "$name" "$env_file" "${_tsm_procs_pid[i]}" "$port" "$status" "$restarts"
    done
}

# Normal format: simple table without borders
_tsm_format_list_normal() {
    local widths=$(_tsm_calculate_column_widths "normal")
    local name_width=${widths% *}
    local env_width=${widths#* }

    printf "%-2s  %-${name_width}s  %-${env_width}s  %-4s  %-4s  %-7s  %-3s  %-8s\n" \
        "ID" "Name" "Env" "PID" "Port" "Status" "↻" "Uptime"
    printf "%-2s  %-${name_width}s  %-${env_width}s  %-4s  %-4s  %-7s  %-3s  %-8s\n" \
        "--" "$(printf '%*s' $name_width '' | tr ' ' '-')" "$(printf '%*s' $env_width '' | tr ' ' '-')" "----" "----" "-------" "---" "--------"

    for i in "${!_tsm_procs_name[@]}"; do
        local name="${_tsm_procs_name[i]}"
        local status="${_tsm_procs_status[i]}"
        local pid="${_tsm_procs_pid[i]}"
        local port="${_tsm_procs_port[i]}"
        local uptime="${_tsm_procs_uptime[i]}"
        local env_file="${_tsm_procs_env_file[i]}"
        local restarts="${_tsm_procs_restarts[i]}"

        # Truncate fields if necessary
        if [[ ${#name} -gt $name_width ]]; then
            name="${name:0:$((name_width-3))}..."
        fi
        if [[ ${#status} -gt 7 ]]; then
            status="${status:0:7}"
        fi
        if [[ ${#pid} -gt 4 ]]; then
            pid="${pid:0:4}"
        fi
        if [[ ${#port} -gt 4 ]]; then
            port="${port:0:4}"
        fi
        if [[ ${#uptime} -gt 8 ]]; then
            uptime="${uptime:0:5}..."
        fi
        # Truncate env file if too long
        if [[ ${#env_file} -gt $env_width ]]; then
            env_file="${env_file:0:$((env_width-3))}..."
        fi

        printf "%-2s  %-${name_width}s  %-${env_width}s  %-4s  %-4s  %-7s  %-3s  %-8s\n" \
            "${_tsm_procs_id[i]}" "$name" "$env_file" "$pid" "$port" "$status" "$restarts" "$uptime"
    done
}


# Format services list - responsive

# Format port scan results - responsive
tsm_format_port_scan() {
    local mode=$(_tsm_get_format_mode)

    case "$mode" in
        compact)
            printf "%-6s %-6s %s\n" "PORT" "PID" "STATUS"
            printf "%-6s %-6s %s\n" "────" "───" "──────"
            ;;
        normal)
            printf "%-6s  %-6s  %s\n" "Port" "PID" "Status"
            printf "%-6s  %-6s  %s\n" "----" "---" "------"
            ;;
    esac
}

# Helper for port scan output
tsm_format_port_line() {
    local port="$1" pid="$2" cmd="$3" status="$4"
    local mode=$(_tsm_get_format_mode)

    case "$mode" in
        compact)
            printf "%-6s %-6s %s\n" "$port" "$pid" "$status"
            ;;
        normal)
            printf "%-6s  %-6s  %s\n" "$port" "$pid" "$status"
            ;;
    esac
}

# Close table for port scan
tsm_format_port_scan_close() {
    # No closing needed for simple format
    :
}