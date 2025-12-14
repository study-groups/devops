#!/usr/bin/env bash

# TSM Service Listing
# List and show service definitions across all orgs

# Helper: wrap command for display (max width, indent continuation lines)
_tsm_wrap_command() {
    local cmd="$1"
    local max_width="${2:-50}"
    local indent="${3:-36}"

    # If command fits, just return it
    if [[ ${#cmd} -le $max_width ]]; then
        echo "$cmd"
        return
    fi

    # Split on spaces, rebuild with wrapping
    local words=($cmd)
    local line=""
    local first_line=true
    local indent_str=$(printf '%*s' "$indent" '')

    for word in "${words[@]}"; do
        if [[ -z "$line" ]]; then
            line="$word"
        elif [[ $((${#line} + 1 + ${#word})) -le $max_width ]]; then
            line="$line $word"
        else
            if [[ "$first_line" == "true" ]]; then
                echo "$line"
                first_line=false
            else
                echo "${indent_str}${line}"
            fi
            line="$word"
        fi
    done

    if [[ -n "$line" ]]; then
        if [[ "$first_line" == "true" ]]; then
            echo "$line"
        else
            echo "${indent_str}${line}"
        fi
    fi
}

# Truncate string with ellipsis in middle
# Uses TDS ansi-aware version if available, falls back to simple version
_tsm_truncate_middle() {
    local str="$1"
    local max_width="${2:-40}"

    # Use TDS if available (ANSI-aware)
    if declare -f tds_truncate_middle >/dev/null 2>&1; then
        tds_truncate_middle "$str" "$max_width"
        return
    fi

    # Fallback: simple truncation
    if [[ ${#str} -le $max_width ]]; then
        echo "$str"
        return
    fi

    local side_width=$(( (max_width - 3) / 2 ))
    local start="${str:0:$side_width}"
    local end="${str: -$side_width}"
    echo "${start}...${end}"
}

# List available services across all orgs
tetra_tsm_list_services() {
    # Load color system if available
    local has_colors=false
    if [[ -f "$TETRA_SRC/bash/color/color_core.sh" ]]; then
        source "$TETRA_SRC/bash/color/color_core.sh" 2>/dev/null
        source "$TETRA_SRC/bash/color/color_palettes.sh" 2>/dev/null
        has_colors=true
    fi

    # Load TDS ansi utilities for ANSI-aware text manipulation
    if [[ -f "$TETRA_SRC/bash/tds/core/ansi.sh" ]]; then
        source "$TETRA_SRC/bash/tds/core/ansi.sh" 2>/dev/null
    fi

    # Parse arguments
    local verbose=false
    local filter="all"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -v|--verbose) verbose=true; shift ;;
            --enabled) filter="enabled"; shift ;;
            --disabled) filter="disabled"; shift ;;
            --available) filter="all"; shift ;;
            *)
                echo "tsm: unknown flag '$1' for services command" >&2
                echo "Usage: tsm services [-v|--verbose] [--enabled|--disabled|--available]" >&2
                return 64
                ;;
        esac
    done

    # Set title based on filter (only for filtered views)
    if [[ "$filter" != "all" ]]; then
        [[ "$has_colors" == "true" ]] && text_color "00AAAA"
        case "$filter" in
            enabled)  echo "Enabled:" ;;
            disabled) echo "Disabled:" ;;
        esac
        [[ "$has_colors" == "true" ]] && reset_color
    fi

    local total_shown=0

    for org in $(_tsm_get_orgs); do
        local services_dir="$TETRA_DIR/orgs/$org/tsm/services-available"
        [[ -d "$services_dir" ]] || continue

        local org_has_services=false

        for service_file in "$services_dir"/*.tsm; do
            [[ -f "$service_file" ]] || continue

            local service_name=$(basename "$service_file" .tsm)
            local is_enabled=false

            # Check central services-enabled
            [[ -L "$TSM_SERVICES_ENABLED/${org}-${service_name}.tsm" ]] && is_enabled=true

            # Apply filter
            case "$filter" in
                enabled)  [[ "$is_enabled" != "true" ]] && continue ;;
                disabled) [[ "$is_enabled" == "true" ]] && continue ;;
            esac

            # Print org header on first service
            if [[ "$org_has_services" == "false" ]]; then
                org_has_services=true
                [[ "$has_colors" == "true" ]] && text_color "AA77DD"
                echo "  [$org]"
                [[ "$has_colors" == "true" ]] && reset_color
            fi

            ((total_shown++))

            # Source service definition to extract values
            local cmd port
            cmd=$(source "$service_file" 2>/dev/null && echo "$TSM_COMMAND")
            port=$(source "$service_file" 2>/dev/null && echo "$TSM_PORT")

            # Check if service is currently running (process name may include port suffix)
            local is_running=false
            if [[ -d "$TSM_PROCESSES_DIR" ]]; then
                for proc_dir in "$TSM_PROCESSES_DIR"/"$service_name"*/; do
                    [[ -d "$proc_dir" ]] || continue
                    local meta="$proc_dir/meta.json"
                    [[ -f "$meta" ]] || continue
                    local pid=$(jq -r '.pid // empty' "$meta" 2>/dev/null)
                    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
                        is_running=true
                        break
                    fi
                done
            fi

            if [[ "$verbose" == "true" ]]; then
                # Verbose view: full org/service name, multi-line wrapping
                local full_name="$org/$service_name"

                [[ "$has_colors" == "true" ]] && text_color "5599FF"
                printf "    %-24s" "$full_name"
                [[ "$has_colors" == "true" ]] && reset_color

                # Status: running > enabled > nothing
                if [[ "$is_running" == "true" ]]; then
                    [[ "$has_colors" == "true" ]] && text_color "00FFAA"
                    printf " %-8s" "running"
                    [[ "$has_colors" == "true" ]] && reset_color
                elif [[ "$is_enabled" == "true" ]]; then
                    [[ "$has_colors" == "true" ]] && text_color "00DD66"
                    printf " %-8s" "enabled"
                    [[ "$has_colors" == "true" ]] && reset_color
                else
                    printf " %-8s" ""
                fi

                # Wrap long commands
                local wrapped=$(_tsm_wrap_command "$cmd" 38 37)

                local -a lines=()
                while IFS= read -r line; do
                    lines+=("$line")
                done <<< "$wrapped"

                [[ "$has_colors" == "true" ]] && text_color "FFAA44"
                local i
                for ((i=0; i<${#lines[@]}; i++)); do
                    if ((i == ${#lines[@]} - 1)); then
                        echo -n "${lines[i]}"
                    else
                        echo "${lines[i]}"
                    fi
                done
                [[ "$has_colors" == "true" ]] && reset_color

                if [[ -n "$port" ]]; then
                    [[ "$has_colors" == "true" ]] && text_color "00AAAA"
                    echo -n " :$port"
                    [[ "$has_colors" == "true" ]] && reset_color
                fi
                echo
            else
                # Compact view: service name only, truncated command, one line
                # Layout: 4 indent + 18 name + 1 space + 7 enabled + 1 space + cmd + port
                [[ "$has_colors" == "true" ]] && text_color "5599FF"
                printf "    %-18s" "$service_name"
                [[ "$has_colors" == "true" ]] && reset_color

                # Status: running > enabled > nothing
                if [[ "$is_running" == "true" ]]; then
                    [[ "$has_colors" == "true" ]] && text_color "00FFAA"
                    printf " %-7s " "running"
                    [[ "$has_colors" == "true" ]] && reset_color
                elif [[ "$is_enabled" == "true" ]]; then
                    [[ "$has_colors" == "true" ]] && text_color "00DD66"
                    printf " %-7s " "enabled"
                    [[ "$has_colors" == "true" ]] && reset_color
                else
                    printf " %-7s " ""
                fi

                # Fixed command width for alignment (35 chars)
                local cmd_width=35
                local truncated=$(_tsm_truncate_middle "$cmd" "$cmd_width")

                [[ "$has_colors" == "true" ]] && text_color "FFAA44"
                printf "%-${cmd_width}s" "$truncated"
                [[ "$has_colors" == "true" ]] && reset_color

                # Port column (always same position)
                if [[ -n "$port" ]]; then
                    [[ "$has_colors" == "true" ]] && text_color "00AAAA"
                    printf " :%-5s" "$port"
                    [[ "$has_colors" == "true" ]] && reset_color
                fi
                echo
            fi
        done
    done

    if [[ $total_shown -eq 0 ]]; then
        case "$filter" in
            enabled)  echo "  No enabled services"; echo "  Use 'tsm enable <service>' to enable" ;;
            disabled) echo "  No disabled services" ;;
            *)        echo "  No services found" ;;
        esac
    fi
}

# Show service details
tetra_tsm_show_service() {
    local service_ref="$1"

    if [[ -z "$service_ref" ]]; then
        echo "Usage: tsm show [org/]<service-name>"
        return 1
    fi

    local _found_org _found_file
    if ! _tsm_find_service "$service_ref" _found_org _found_file; then
        echo "❌ Service not found: $service_ref"
        return 1
    fi

    local parsed_org service_name
    _tsm_parse_service_ref "$service_ref" parsed_org service_name

    echo "🔍 Service: $_found_org/$service_name"
    echo "📄 File: $_found_file"
    echo

    # Source and display variables
    (
        source "$_found_file"
        echo "Configuration:"
        echo "  Org: $_found_org"
        echo "  Name: ${TSM_NAME:-}"
        echo "  Command: ${TSM_COMMAND:-}"
        echo "  Directory: ${TSM_CWD:-}"
        echo "  Environment: ${TSM_ENV:-none}"
        echo "  Port: ${TSM_PORT:-none}"
    )

    # Check if enabled
    if [[ -L "$TSM_SERVICES_ENABLED/${_found_org}-${service_name}.tsm" ]]; then
        echo "  Status: enabled ✅"
    else
        echo "  Status: disabled"
    fi
}

export -f _tsm_wrap_command
export -f _tsm_truncate_middle
export -f tetra_tsm_list_services
export -f tetra_tsm_show_service
