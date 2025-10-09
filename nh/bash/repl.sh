#!/usr/bin/env bash
# NH REPL - Interactive Infrastructure Management

nh_repl() {
    local context="${1:-$DIGITALOCEAN_CONTEXT}"
    local cmd args

    echo "NH Interactive Shell"
    echo "Context: ${context:-none}"
    echo "Type 'help' for commands, 'exit' to quit"
    echo ""

    # Load context if provided
    if [[ -n "$context" ]]; then
        nh_repl_context "$context"
    fi

    # Auto-load environment variables
    if [[ -n "$DIGITALOCEAN_CONTEXT" ]] && declare -f nh_load_env_vars >/dev/null; then
        echo "Loading environment variables from digocean.json..."
        nh_load_env_vars
        local var_count=$(env | grep -E '^(do[0-9]|nodeholder|ghost)' | wc -l | tr -d ' ')
        echo "Loaded $var_count server variables"
        echo ""
    fi

    while true; do
        printf "nh> "
        read -r cmd args

        case "$cmd" in
            "help"|"h"|"?")
                nh_repl_help
                ;;
            "context"|"ctx")
                nh_repl_context $args
                ;;
            "servers"|"list"|"ls")
                nh_repl_servers $args
                ;;
            "show"|"info")
                nh_repl_show $args
                ;;
            "vars"|"env")
                nh_repl_vars $args
                ;;
            "ssh")
                nh_repl_ssh $args
                ;;
            "tetra-export"|"tetra")
                nh_repl_tetra_export
                ;;
            "refresh"|"reload")
                nh_repl_refresh
                ;;
            "status")
                nh_repl_status
                ;;
            "exit"|"quit"|"q")
                echo "Goodbye!"
                break
                ;;
            "")
                # Empty command, continue
                ;;
            *)
                echo "Unknown command: $cmd"
                echo "Type 'help' for available commands"
                ;;
        esac
    done
}

nh_repl_help() {
    cat << 'EOF'
NH REPL Commands:

Context Management:
  context <name>     Switch to infrastructure context
  status             Show current context and loaded resources
  refresh            Reload infrastructure data

Server Operations:
  servers            List all servers with IPs and shortcuts
  show <server>      Show detailed server information
  ssh <server>       SSH to server (by shortcut or name)

Variable Management:
  vars               Show all generated variables
  tetra-export       Show Tetra integration variables

General:
  help               Show this help message
  exit               Exit NH REPL

Examples:
  nh> context pixeljam-arcade
  nh> servers
  nh> show paq
  nh> ssh paq
  nh> vars
  nh> tetra-export
EOF
}

nh_repl_context() {
    local new_context="$1"

    if [[ -z "$new_context" ]]; then
        echo "Current context: ${DIGITALOCEAN_CONTEXT:-none}"
        echo "Available contexts:"
        ls "$NH_DIR" 2>/dev/null | grep -v '\.' | while read ctx; do
            echo "  $ctx"
        done
        return
    fi

    if [[ ! -d "$NH_DIR/$new_context" ]]; then
        echo "Context '$new_context' not found"
        return 1
    fi

    export DIGITALOCEAN_CONTEXT="$new_context"
    echo "Switched to context: $new_context"

    # Load context data
    if [[ -f "$NH_DIR/$new_context/init.sh" ]]; then
        source "$NH_DIR/$new_context/init.sh" 2>/dev/null
        echo "Context loaded"
    fi
}

nh_repl_servers() {
    local format="${1:-table}"

    if [[ -z "$DIGITALOCEAN_CONTEXT" ]]; then
        echo "No context loaded. Use 'context <name>' first."
        return 1
    fi

    local json_file="$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json"
    if [[ ! -f "$json_file" ]]; then
        echo "No infrastructure data found. Try 'refresh' first."
        return 1
    fi

    echo "Servers in context '$DIGITALOCEAN_CONTEXT':"
    printf "%-20s %-16s %-15s %-8s %-8s %s\n" "Name" "Public IP" "Private IP" "Memory" "Region" "Tags"
    echo "--------------------------------------------------------------------------------------------"

    # Parse servers and show with environment variable names
    jq -r '.[] | select(.Droplets) | .Droplets[] |
        [.name,
         (.networks.v4[] | select(.type=="public") | .ip_address),
         ((.networks.v4[] | select(.type=="private") | .ip_address) // "none"),
         (.memory/1024|tostring+"GB"),
         .region.slug,
         (if .tags then (.tags | join(",")) else "" end)] | @tsv' \
        "$json_file" 2>/dev/null | while IFS=$'\t' read -r name public private memory region tags; do

        # Convert name to env var format (dashes to underscores)
        local varname=$(echo "$name" | tr '-' '_')

        printf "%-20s %-16s %-15s %-8s %-8s %s\n" \
               "$varname" "$public" "$private" "$memory" "$region" "$tags"
    done
}

nh_repl_show() {
    local server="$1"

    if [[ -z "$server" ]]; then
        echo "Usage: show <server_shortcut_or_name>"
        return 1
    fi

    # Try to resolve shortcut to IP first
    local ip_var="$server"
    local ip_value="${!ip_var}"

    if [[ -n "$ip_value" ]]; then
        echo "Server: $server"
        echo "Public IP: $ip_value (\$$server)"

        # Check for private/floating variants
        local private_var="${server}p"
        local floating_var="${server}f"
        local private_ip="${!private_var}"
        local floating_ip="${!floating_var}"

        [[ -n "$private_ip" ]] && echo "Private IP: $private_ip (\$$private_var)"
        [[ -n "$floating_ip" ]] && echo "Floating IP: $floating_ip (\$$floating_var)"

        # Try to find full server name
        local json_file="$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json"
        if [[ -f "$json_file" ]]; then
            local full_name=$(jq -r --arg ip "$ip_value" \
                '.[] | select(.Droplets) | .Droplets[] |
                 select(.networks.v4[] | select(.ip_address == $ip)) | .name' \
                "$json_file" 2>/dev/null)
            [[ -n "$full_name" ]] && echo "Full name: $full_name"

            # Show additional details
            jq -r --arg ip "$ip_value" \
                '.[] | select(.Droplets) | .Droplets[] |
                 select(.networks.v4[] | select(.ip_address == $ip)) |
                 "Memory: \(.memory)MB", "CPU: \(.vcpus) cores", "Disk: \(.disk)GB",
                 "Region: \(.region.name) (\(.region.slug))", "Tags: \(.tags | join(", "))"' \
                "$json_file" 2>/dev/null
        fi
    else
        echo "Server '$server' not found"
        echo "Available shortcuts: $(env | grep '^p[a-z]*=' | cut -d= -f1 | tr '\n' ' ')"
    fi
}

nh_repl_vars() {
    local filter="${1:-}"

    echo "Generated NH variables:"
    echo ""

    if [[ -n "$filter" ]]; then
        env | grep "^${filter}" | sort | while IFS='=' read -r var value; do
            printf "export %-25s = %s\n" "$var" "$value"
        done
    else
        # Show all server-related variables (public, private, floating)
        local vars=$(env | grep -E '^(do[0-9]|nodeholder|ghost)' | sort)

        if [[ -z "$vars" ]]; then
            echo "No variables loaded yet."
            echo "Try running: refresh"
            return
        fi

        echo "$vars" | while IFS='=' read -r var value; do
            printf "export %-25s = %s\n" "$var" "$value"
        done
    fi
}

nh_repl_ssh() {
    local server="$1"
    shift
    local ssh_args="$@"

    if [[ -z "$server" ]]; then
        echo "Usage: ssh <server_shortcut> [ssh_options]"
        return 1
    fi

    local ip_value="${!server}"
    if [[ -z "$ip_value" ]]; then
        echo "Server '$server' not found"
        return 1
    fi

    echo "Connecting to $server ($ip_value)..."
    ssh $ssh_args "root@$ip_value"
}

nh_repl_tetra_export() {
    echo "Tetra integration variables:"

    # Map NH variables to Tetra conventions
    echo "# Development"
    [[ -n "$pad" ]] && echo "export TETRA_DEV_IP=$pad"

    echo "# Staging/QA"
    [[ -n "$paq" ]] && echo "export TETRA_STAGING_IP=$paq"

    echo "# Production"
    [[ -n "$pap" ]] && echo "export TETRA_PROD_IP=$pap"

    echo ""
    echo "# Usage in Tetra:"
    echo "# tetra deploy --target dev      # → \$TETRA_DEV_IP"
    echo "# tetra deploy --target staging  # → \$TETRA_STAGING_IP"
    echo "# tetra deploy --target prod     # → \$TETRA_PROD_IP"
}

nh_repl_refresh() {
    if [[ -z "$DIGITALOCEAN_CONTEXT" ]]; then
        echo "No context loaded"
        return 1
    fi

    echo "Refreshing infrastructure data..."

    # Reload environment variables
    if declare -f nh_load_env_vars >/dev/null; then
        nh_load_env_vars
        echo "Environment variables refreshed"
    else
        echo "Warning: nh_load_env_vars function not available"
    fi
}

nh_repl_status() {
    echo "NH Status:"
    echo "  Context: ${DIGITALOCEAN_CONTEXT:-none}"
    echo "  NH_DIR: ${NH_DIR:-not set}"
    echo "  NH_SRC: ${NH_SRC:-not set}"

    if [[ -n "$DIGITALOCEAN_CONTEXT" ]]; then
        local json_file="$NH_DIR/$DIGITALOCEAN_CONTEXT/digocean.json"
        if [[ -f "$json_file" ]]; then
            local server_count=$(jq '[.[] | select(.Droplets) | .Droplets[]] | length' "$json_file" 2>/dev/null)
            echo "  Servers: ${server_count:-0}"
        fi

        # Count server-related variables
        local var_count=$( { env | grep "^do[0-9]"; env | grep "^nodeholder"; env | grep "^ghost"; } 2>/dev/null | wc -l | tr -d ' ')
        echo "  Variables: $var_count"
    fi

    echo ""
    echo "Functions available:"
    declare -f nh_load_env_vars >/dev/null && echo "  ✓ nh_load_env_vars" || echo "  ✗ nh_load_env_vars"
    declare -f nh_make_short_vars >/dev/null && echo "  ✓ nh_make_short_vars" || echo "  ✗ nh_make_short_vars"
}

# Main entry point
nh() {
    case "${1:-repl}" in
        "repl"|"interactive"|"i")
            nh_repl "${2:-$DIGITALOCEAN_CONTEXT}"
            ;;
        *)
            echo "NH - NodeHolder Infrastructure Management"
            echo "Usage: nh [repl] [context]"
            echo ""
            echo "Commands:"
            echo "  nh repl                Start interactive REPL"
            echo "  nh repl pixeljam-arcade Start REPL with context"
            ;;
    esac
}

# Export the main function
export -f nh