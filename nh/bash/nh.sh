#!/usr/bin/env bash
# nh.sh - NodeHolder Infrastructure Management
#
# Manages DigitalOcean infrastructure via doctl
# Pattern follows org/tkm modules from tetra
#
# Structure:
#   NH_SRC=/path/to/nh/bash     - Source directory
#   NH_DIR=~/nh                  - Data directory (contexts)
#   NH_DIR/<context>/digocean.json - Infrastructure data
#
# Usage:
#   nh status              Show current context and servers
#   nh servers             List servers with IPs
#   nh fetch               Fetch infrastructure from DO
#   nh ssh <server>        SSH to server

NH_SRC="${NH_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
NH_DIR="${NH_DIR:-$HOME/nh}"

# Source dependencies
source "$NH_SRC/nh_doctl.sh"
source "$NH_SRC/nh_env.sh"
source "$NH_SRC/nh_ssh.sh"
source "$NH_SRC/nh_md.sh"
source "$NH_SRC/nh_checklist.sh"
source "$NH_SRC/nh_complete.sh"

# =============================================================================
# CONTEXT MANAGEMENT
# =============================================================================

# Get current context name
nh_context() {
    echo "${DIGITALOCEAN_CONTEXT:-none}"
}

# List available contexts
nh_context_list() {
    local current=$(nh_context)

    [[ ! -d "$NH_DIR" ]] && { echo "No contexts found"; return 1; }

    for dir in "$NH_DIR"/*/; do
        [[ -d "$dir" ]] || continue
        local name=$(basename "$dir")
        [[ "$name" == "json" ]] && continue  # Skip json subdir

        if [[ "$name" == "$current" ]]; then
            printf "* %s\n" "$name"
        else
            printf "  %s\n" "$name"
        fi
    done
}

# Switch context
nh_switch() {
    local name="$1"

    [[ -z "$name" ]] && { echo "Usage: nh switch <context>"; return 1; }

    local ctx_dir="$NH_DIR/$name"
    [[ ! -d "$ctx_dir" ]] && { echo "Context not found: $name"; return 1; }

    export DIGITALOCEAN_CONTEXT="$name"
    doctl auth switch --context "$name" 2>/dev/null

    echo "Switched to: $name"

    # Auto-load environment variables
    if [[ -f "$ctx_dir/digocean.json" ]]; then
        nh_env_load
        local count=$(nh_env_count)
        echo "Loaded $count server variables"
    fi
}

# Create new context directory
nh_create() {
    local name="$1"

    [[ -z "$name" ]] && { echo "Usage: nh create <context>"; return 1; }
    [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]] && { echo "Invalid name"; return 1; }

    local ctx_dir="$NH_DIR/$name"
    [[ -d "$ctx_dir" ]] && { echo "Already exists: $name"; return 1; }

    mkdir -p "$ctx_dir"
    echo "Created: $ctx_dir"
    echo "Next: nh switch $name && nh fetch"
}

# =============================================================================
# SERVER OPERATIONS
# =============================================================================

# List servers in current context
nh_servers() {
    local ctx=$(nh_context)
    [[ "$ctx" == "none" ]] && { echo "No context. Run: nh switch <context>"; return 1; }

    local json="$NH_DIR/$ctx/digocean.json"
    [[ ! -f "$json" ]] && { echo "No data. Run: nh fetch"; return 1; }

    printf "%-20s %-16s %-15s %-8s %s\n" "Name" "Public IP" "Private IP" "Region" "Tags"
    printf "%s\n" "--------------------------------------------------------------------------------"

    jq -r '.[] | select(.Droplets) | .Droplets[] |
        [.name,
         (.networks.v4[] | select(.type=="public") | .ip_address),
         ((.networks.v4[] | select(.type=="private") | .ip_address) // "-"),
         .region.slug,
         (if .tags then (.tags | join(",")) else "" end)] | @tsv' \
        "$json" 2>/dev/null | while IFS=$'\t' read -r name public private region tags; do
        local varname=$(echo "$name" | tr '-' '_')
        printf "%-20s %-16s %-15s %-8s %s\n" "$varname" "$public" "$private" "$region" "$tags"
    done
}

# Show details for a specific server
nh_show() {
    local server="$1"

    [[ -z "$server" ]] && { echo "Usage: nh show <server>"; return 1; }

    # Try as variable first
    local ip="${!server}"

    if [[ -n "$ip" ]]; then
        echo "Server: $server"
        echo "Public IP: $ip (\$$server)"

        # Check for private/floating variants
        local private="${server}_private"
        local floating="${server}_floating"
        [[ -n "${!private}" ]] && echo "Private IP: ${!private} (\$$private)"
        [[ -n "${!floating}" ]] && echo "Floating IP: ${!floating} (\$$floating)"
    else
        echo "Server not found: $server"
        echo "Available: $(nh_env_names | tr '\n' ' ')"
        return 1
    fi
}

# =============================================================================
# STATUS
# =============================================================================

nh_status() {
    echo "NH Status"
    echo "========="
    echo ""
    echo "Context: $(nh_context)"
    echo "NH_DIR: $NH_DIR"
    echo "NH_SRC: $NH_SRC"
    echo ""

    local ctx=$(nh_context)
    if [[ "$ctx" != "none" ]]; then
        local json="$NH_DIR/$ctx/digocean.json"
        if [[ -f "$json" ]]; then
            local count=$(jq '[.[] | select(.Droplets) | .Droplets[]] | length' "$json" 2>/dev/null)
            echo "Servers: ${count:-0}"
            echo "Variables: $(nh_env_count)"

            # Show age of data
            local age=$(nh_json_age "$json")
            echo "Data age: ${age} days"
        else
            echo "No infrastructure data"
        fi
    fi
}

# Get age of JSON file in days
nh_json_age() {
    local json="$1"
    [[ ! -f "$json" ]] && { echo "999"; return; }

    local file_time
    if stat -f %m "$json" >/dev/null 2>&1; then
        file_time=$(stat -f %m "$json")
    else
        file_time=$(stat -c %Y "$json")
    fi

    local now=$(date +%s)
    echo $(( (now - file_time) / 86400 ))
}

# =============================================================================
# HELP
# =============================================================================

nh_help() {
    cat << 'EOF'
nh - NodeHolder Infrastructure Management

USAGE: nh [command] [args]

COMMANDS
    status          Current context and stats (default)
    list            List available contexts
    switch <name>   Switch to context
    create <name>   Create new context
    fetch           Fetch infrastructure from DigitalOcean
    servers         List servers with IPs
    show <server>   Show server details
    cat             Show raw digocean.json
    env             Environment variable commands (nh help env)
    ssh             SSH commands (nh help ssh)
    doctl           DigitalOcean CLI commands (nh help doctl)
    md <file>       Navigate any markdown file (nh help md)
    cl              Checklist with progress tracking (nh help cl)

Run 'nh help <command>' for subcommand details.
EOF
}

nh_help_env() {
    cat << 'EOF'
nh env - Environment variable management

USAGE: nh env [subcommand]

SUBCOMMANDS
    show            Show all exported variables (default)
    load            Load variables from digocean.json
    short <prefix>  Generate short variable names

EXAMPLES
    nh env              Show current variables
    nh env load         Reload from JSON
    nh env short pxj    Generate short names for pxj* servers
EOF
}

nh_help_ssh() {
    cat << 'EOF'
nh ssh - SSH operations

USAGE: nh ssh <server|subcommand>

SUBCOMMANDS
    status          Show ssh-agent status
    keys            List loaded keys
    add <keyfile>   Add key to agent
    <server>        Connect to server by variable name

EXAMPLES
    nh ssh status       Check agent
    nh ssh paq          SSH to $paq
    ssh root@$paq       Direct SSH using variable
EOF
}

nh_help_doctl() {
    cat << 'EOF'
nh doctl - DigitalOcean infrastructure management

USAGE: nh doctl [subcommand]

SUBCOMMANDS
    status      Show doctl auth status (default)
    droplets    List droplets live from DO API
    fetch       Fetch all infrastructure to digocean.json
    clean       Remove verbose fields from JSON
    age         Show digocean.json age in days
    resources   Summary counts of all resources
    info        Explain data flow and tetra integration

FETCH OPTIONS
    nh fetch              Fetch all resources to digocean.json
    nh fetch --dry-run    Show what would be fetched (no API calls)
    nh fetch -n           Short form of --dry-run

WORKFLOW
    1. doctl auth init --context myorg
    2. nh switch myorg && nh fetch --dry-run   # preview
    3. nh fetch                                 # execute
    4. org import nh ~/nh/myorg/digocean.json myorg  (tetra)
EOF
}

nh_help_cl() {
    cat << 'EOF'
nh cl - Interactive checklist with progress tracking

USAGE: nh cl [step|command]

COMMANDS
    (none)        List steps with completion status
    <step>        Show step content (01, 02, ...)
    browse [step] Interactive browser (arrow keys, uses glow)
    check <step>  Mark step as complete
    uncheck <step> Mark step as incomplete
    status        Show progress summary
    reset         Clear all progress
    env           Show checklist.env file

BROWSER KEYS
    <-/-> or j/k  Navigate steps
    c             Check current step
    u             Uncheck current step
    Enter         Show full content
    q             Quit

EXAMPLES
    nh cl               List steps with [x] for completed
    nh cl browse        Interactive step browser
    nh cl 01            Show step 01 content
    nh cl check 01      Mark step 01 complete
EOF
}

nh_help_md() {
    cat << 'EOF'
nh md - General markdown section navigator

USAGE: nh md <file> [section|command]

COMMANDS
    list        List all sections with line numbers (default)
    keys        List section keys only
    show <key>  Show section content
    <key>       Show section (shorthand for show)

KEY EXTRACTION
    Headers are converted to completion-friendly keys:
    "## Phase 1: Setup"     -> phase1
    "### 1.1 Create Thing"  -> 1.1
    "## Quick Reference"    -> quick

EXAMPLES
    nh md README.md              List sections in README
    nh md docs/guide.md intro    Show 'intro' section
    nh md ~/notes.md keys        List keys for scripting
EOF
}

# =============================================================================
# MARKDOWN SECTION NAVIGATOR
# =============================================================================

# General markdown navigator
nh_md_cmd() {
    local file="$1"
    local cmd="${2:-list}"
    shift 2 2>/dev/null || true

    [[ -z "$file" ]] && { nh_help_md; return 1; }
    [[ ! -f "$file" ]] && { echo "File not found: $file"; return 1; }

    # Parse if needed (different file or not parsed yet)
    if [[ ${#NH_MD_ORDER[@]} -eq 0 || "$NH_MD_FILE" != "$file" ]]; then
        nh_md_parse "$file" >/dev/null
    fi

    case "$cmd" in
        list|ls)
            nh_md_list
            ;;
        keys|k)
            nh_md_keys
            ;;
        show|s)
            local key="$1"
            [[ -z "$key" ]] && { echo "Usage: nh md <file> show <key>"; return 1; }
            nh_md_show "$key"
            ;;
        help|h)
            nh_help_md
            ;;
        *)
            # Treat as section key
            if [[ -v NH_MD_START["$cmd"] ]]; then
                nh_md_show "$cmd"
            else
                echo "Unknown section: $cmd"
                echo "Available: $(nh_md_keys | tr '\n' ' ')"
                return 1
            fi
            ;;
    esac
}

# Checklist-specific handler (convenience wrapper)
_nh_cl_ensure_parsed() {
    local cl_file="${NH_CHECKLIST:-${NH_SRC%/bash}/checklist.md}"
    if [[ ! -f "$cl_file" ]]; then
        echo "Checklist not found: $cl_file"
        echo "Set NH_CHECKLIST=/path/to/file.md"
        return 1
    fi
    if [[ ${#NH_MD_ORDER[@]} -eq 0 || "$NH_MD_FILE" != "$cl_file" ]]; then
        nh_md_parse "$cl_file" >/dev/null
    fi
}

nh_checklist() {
    local cmd="${1:-}"
    shift 2>/dev/null || true

    _nh_cl_ensure_parsed || return 1

    case "$cmd" in
        # State commands
        check|c)
            nh_cl_check "$@"
            ;;
        uncheck|uc)
            nh_cl_uncheck "$@"
            ;;
        status|st)
            nh_cl_status
            ;;
        reset)
            nh_cl_reset
            ;;
        env)
            nh_cl_env
            ;;
        # Interactive browser
        browse|b)
            nh_cl_browse "$@"
            ;;
        # Display commands
        list|ls|"")
            nh_cl_list
            ;;
        keys|k)
            nh_md_step_keys
            ;;
        help|h)
            nh_help_cl
            ;;
        # Treat as step number or section key
        *)
            if [[ -v NH_MD_START["$cmd"] ]]; then
                nh_md_show "$cmd" 50
            else
                echo "Unknown step/command: $cmd"
                echo "Steps: $(nh_md_step_keys | tr '\n' ' ')"
                return 1
            fi
            ;;
    esac
}

# =============================================================================
# MAIN COMMAND
# =============================================================================

nh() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Context
        status|s)           nh_status ;;
        list|ls|l)          nh_context_list ;;
        switch|sw)          nh_switch "$@" ;;
        create|new)         nh_create "$@" ;;

        # Infrastructure
        fetch|refresh)      nh_doctl_fetch "$@" ;;
        servers|srv)        nh_servers ;;
        show|info)          nh_show "$@" ;;
        cat)                nh_doctl_cat ;;

        # Environment
        env)
            local subcmd="${1:-show}"
            shift 2>/dev/null || true
            case "$subcmd" in
                show|"")    nh_env_show ;;
                load)       nh_env_load ;;
                short)      nh_env_short "$@" ;;
                *)          nh_env_show "$subcmd" ;;
            esac
            ;;

        # SSH
        ssh)
            local subcmd="${1:-}"
            shift 2>/dev/null || true
            case "$subcmd" in
                status)     nh_ssh_status ;;
                keys)       nh_ssh_key_list ;;
                add)        nh_ssh_key_add "$@" ;;
                "")         echo "Usage: nh ssh <server|status|keys>"; return 1 ;;
                *)          nh_ssh_connect "$subcmd" "$@" ;;
            esac
            ;;

        # Doctl
        doctl)
            local subcmd="${1:-status}"
            shift 2>/dev/null || true
            case "$subcmd" in
                status)     nh_doctl_status ;;
                droplets)   nh_doctl_droplets ;;
                fetch)      nh_doctl_fetch ;;
                clean)      nh_doctl_clean ;;
                age)        nh_doctl_age ;;
                resources)  nh_doctl_resources ;;
                info)       nh_doctl_info ;;
                *)          echo "Unknown doctl command: $subcmd" ;;
            esac
            ;;

        # Markdown
        md)             nh_md_cmd "$@" ;;
        checklist|cl)   nh_checklist "$@" ;;

        # Help
        help|h|--help|-h)
            local topic="${1:-}"
            case "$topic" in
                env)        nh_help_env ;;
                ssh)        nh_help_ssh ;;
                doctl)      nh_help_doctl ;;
                md)         nh_help_md ;;
                cl)         nh_help_cl ;;
                *)          nh_help ;;
            esac
            ;;

        # Unknown
        *)
            echo "Unknown command: $cmd"
            echo "Try: nh help"
            return 1
            ;;
    esac
}

# Register completion
complete -F _nh_complete nh

# Export functions
export -f nh nh_status nh_context nh_context_list nh_switch nh_create
export -f nh_servers nh_show nh_json_age
export -f nh_help nh_help_env nh_help_ssh nh_help_doctl nh_help_md nh_help_cl
export -f nh_md_cmd nh_checklist _nh_cl_ensure_parsed
