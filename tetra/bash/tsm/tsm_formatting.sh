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

# Calculate optimal name column width based on terminal width and content
_tsm_calculate_name_width() {
    local width=$(_tsm_get_terminal_width)
    local mode="$1"

    # Find longest name
    local max_name_len=4  # minimum for "Name" header
    for name in "${_tsm_procs_name[@]}"; do
        if [[ ${#name} -gt $max_name_len ]]; then
            max_name_len=${#name}
        fi
    done

    if [[ "$mode" == "compact" ]]; then
        # Compact: ID(4) + Name(flexible) + Status(9) + Port(6) + spaces(6) = 25 + name
        local available=$((width - 25))
        local name_width=$((available > max_name_len ? max_name_len : available))
        echo $((name_width < 8 ? 8 : name_width))  # minimum 8 chars
    else
        # Normal: ID(4) + Name(flexible) + Status(9) + PID(6) + Port(6) + Uptime(10) + spaces(30) = 65 + name
        local available=$((width - 65))
        local name_width=$((available > max_name_len ? max_name_len : available))
        echo $((name_width < 12 ? 12 : name_width))  # minimum 12 chars
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
    local name_width=$(_tsm_calculate_name_width "compact")

    printf "%-2s  %-${name_width}s  %-7s  %-4s\n" "ID" "NAME" "STATUS" "PORT"
    printf "%-2s  %-${name_width}s  %-7s  %-4s\n" "--" "$(printf '%*s' $name_width '' | tr ' ' '-')" "-------" "----"

    for i in "${!_tsm_procs_name[@]}"; do
        local name="${_tsm_procs_name[i]}"
        local status="${_tsm_procs_status[i]}"
        local port="${_tsm_procs_port[i]}"

        # Truncate name if too long
        if [[ ${#name} -gt $name_width ]]; then
            name="${name:0:$((name_width-3))}..."
        fi
        # Truncate status if too long
        if [[ ${#status} -gt 7 ]]; then
            status="${status:0:7}"
        fi

        printf "%-2s  %-${name_width}s  %-7s  %-4s\n" \
            "${_tsm_procs_id[i]}" "$name" "$status" "$port"
    done
}

# Normal format: simple table without borders
_tsm_format_list_normal() {
    local name_width=$(_tsm_calculate_name_width "normal")

    printf "%-2s  %-${name_width}s  %-7s  %-4s  %-4s  %-8s\n" \
        "ID" "Name" "Status" "PID" "Port" "Uptime"
    printf "%-2s  %-${name_width}s  %-7s  %-4s  %-4s  %-8s\n" \
        "--" "$(printf '%*s' $name_width '' | tr ' ' '-')" "-------" "----" "----" "--------"

    for i in "${!_tsm_procs_name[@]}"; do
        local name="${_tsm_procs_name[i]}"
        local status="${_tsm_procs_status[i]}"
        local pid="${_tsm_procs_pid[i]}"
        local port="${_tsm_procs_port[i]}"
        local uptime="${_tsm_procs_uptime[i]}"

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

        printf "%-2s  %-${name_width}s  %-7s  %-4s  %-4s  %-8s\n" \
            "${_tsm_procs_id[i]}" "$name" "$status" "$pid" "$port" "$uptime"
    done
}


# Format services list - responsive
tsm_format_services_list() {
    local mode=$(_tsm_get_format_mode)
    local services_file="$TETRA_SRC/bash/tsm/services.conf"

    [[ -f "$services_file" ]] || {
        echo "tsm: services file not found: $services_file" >&2
        return 1
    }

    case "$mode" in
        compact)
            echo "Available Services:"
            printf "%-12s %-4s %-4s %s\n" "NAME" "TYPE" "PORT" "DESCRIPTION"
            printf "%-12s %-4s %-4s %s\n" "────" "────" "────" "───────────"

            while IFS= read -r line; do
                [[ "$line" =~ ^#.*$ ]] && continue
                [[ -z "$line" ]] && continue

                local name type command port directory description
                IFS=':' read -r name type command port directory description <<< "$line"

                printf "%-12s %-4s %-4s %s\n" "$name" "$type" "$port" "$description"
            done < "$services_file"
            ;;
        normal)
            local width=$(_tsm_get_terminal_width)
            local desc_width=$((width - 24))  # Leave room for name(12) + type(6) + port(6)

            echo "Available Services:"
            printf "%-12s  %-4s  %-4s  %s\n" "Name" "Type" "Port" "Description"
            printf "%-12s  %-4s  %-4s  %s\n" "----" "----" "----" "-----------"

            while IFS= read -r line; do
                [[ "$line" =~ ^#.*$ ]] && continue
                [[ -z "$line" ]] && continue

                local name type command port directory description
                IFS=':' read -r name type command port directory description <<< "$line"

                # Truncate description if too long
                if [[ ${#description} -gt $desc_width ]]; then
                    description="${description:0:$((desc_width-3))}..."
                fi

                printf "%-12s  %-4s  %-4s  %s\n" "$name" "$type" "$port" "$description"
            done < "$services_file"
            ;;
    esac
}

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