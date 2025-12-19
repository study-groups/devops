#!/usr/bin/env bash
# org.sh - Simplified Organization Management
# Focus: tab completion + working with THE tetra.toml
#
# The tetra.toml pattern:
#   $TETRA_DIR/config/tetra.toml  ->  symlink to active org
#   $TETRA_DIR/orgs/<name>/tetra.toml  ->  actual config files

ORG_SRC="${TETRA_SRC}/bash/org"

# Source dependencies
source "$ORG_SRC/org_toml.sh"
source "$ORG_SRC/org_env.sh"
source "$ORG_SRC/org_build.sh"
source "$ORG_SRC/org_complete.sh"

# =============================================================================
# CORE FUNCTIONS
# =============================================================================

# Get active organization name (reads symlink)
org_active() {
    local link="$TETRA_DIR/config/tetra.toml"
    if [[ -L "$link" ]]; then
        local target=$(readlink "$link")
        basename "$(dirname "$target")"
    else
        echo "none"
    fi
}

# List all organizations (canonical names, then aliases)
org_list() {
    local orgs_dir="$TETRA_DIR/orgs"
    local active=$(org_active)

    [[ ! -d "$orgs_dir" ]] && { echo "No orgs directory"; return 1; }

    # First list canonical orgs (real directories)
    for dir in "$orgs_dir"/*/; do
        [[ -d "$dir" && ! -L "${dir%/}" ]] || continue
        local name=$(basename "$dir")
        if [[ "$name" == "$active" ]]; then
            printf "* %s\n" "$name"
        else
            printf "  %s\n" "$name"
        fi
    done

    # Then list aliases (symlinks)
    for link in "$orgs_dir"/*/; do
        local path="${link%/}"
        [[ -L "$path" ]] || continue
        local alias_name=$(basename "$path")
        local target=$(readlink "$path")
        local canonical=$(basename "$target")
        if [[ "$alias_name" == "$active" ]]; then
            printf "* %s -> %s\n" "$alias_name" "$canonical"
        else
            printf "  %s -> %s\n" "$alias_name" "$canonical"
        fi
    done
}

# List org names only (for completion)
org_names() {
    local orgs_dir="$TETRA_DIR/orgs"
    [[ -d "$orgs_dir" ]] || return
    for dir in "$orgs_dir"/*/; do
        [[ -d "$dir" ]] && basename "$dir"
    done
}

# Switch active organization
org_switch() {
    local name="$1"

    [[ -z "$name" ]] && { echo "Usage: org switch <name>"; return 1; }

    local org_toml="$TETRA_DIR/orgs/$name/tetra.toml"
    local link="$TETRA_DIR/config/tetra.toml"

    [[ ! -f "$org_toml" ]] && { echo "Not found: $org_toml"; return 1; }

    # Ensure config dir exists
    mkdir -p "$TETRA_DIR/config"

    # Update symlink
    ln -sf "$org_toml" "$link"
    echo "Switched to: $name"

    # Export environment IPs as shell variables
    _org_export_env_vars
}

# Export environment IPs as shell variables ($dev, $staging, $prod)
_org_export_env_vars() {
    local toml=$(org_toml_path 2>/dev/null) || return

    for env in $(org_env_names 2>/dev/null); do
        local ip=$(_org_get_host "$env")
        if [[ -n "$ip" && "$ip" != "127.0.0.1" ]]; then
            export "$env=$ip"
        fi
    done
}

# Create alias (symlink) for an organization
org_alias() {
    local alias_name="$1"
    local canonical="$2"
    local orgs_dir="$TETRA_DIR/orgs"

    # No args: list aliases
    if [[ -z "$alias_name" ]]; then
        echo "Aliases:"
        local found=0
        for link in "$orgs_dir"/*/; do
            local path="${link%/}"
            [[ -L "$path" ]] || continue
            local name=$(basename "$path")
            local target=$(basename "$(readlink "$path")")
            printf "  %s -> %s\n" "$name" "$target"
            ((found++))
        done
        [[ $found -eq 0 ]] && echo "  (none)"
        echo ""
        echo "Create: org alias <short> <canonical>"
        return 0
    fi

    # Need both args to create
    [[ -z "$canonical" ]] && { echo "Usage: org alias <short> <canonical>"; return 1; }

    # Validate
    [[ ! "$alias_name" =~ ^[a-zA-Z0-9_-]+$ ]] && { echo "Invalid alias name"; return 1; }

    local canonical_dir="$orgs_dir/$canonical"
    local alias_path="$orgs_dir/$alias_name"

    [[ ! -d "$canonical_dir" ]] && { echo "Not found: $canonical"; return 1; }
    [[ -e "$alias_path" ]] && { echo "Already exists: $alias_name"; return 1; }

    # Create relative symlink
    ln -s "$canonical" "$alias_path"
    echo "Created: $alias_name -> $canonical"
}

# Remove an alias
org_unalias() {
    local alias_name="$1"
    local orgs_dir="$TETRA_DIR/orgs"

    [[ -z "$alias_name" ]] && { echo "Usage: org unalias <name>"; return 1; }

    local alias_path="$orgs_dir/$alias_name"

    if [[ -L "$alias_path" ]]; then
        rm "$alias_path"
        echo "Removed: $alias_name"
    elif [[ -d "$alias_path" ]]; then
        echo "Error: $alias_name is a canonical org, not an alias"
        return 1
    else
        echo "Not found: $alias_name"
        return 1
    fi
}

# Create new organization
org_create() {
    local name="$1"

    [[ -z "$name" ]] && { echo "Usage: org create <name>"; return 1; }
    [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]] && { echo "Invalid name (use a-z, 0-9, _, -)"; return 1; }

    local org_dir="$TETRA_DIR/orgs/$name"
    [[ -d "$org_dir" ]] && { echo "Already exists: $name"; return 1; }

    mkdir -p "$org_dir"

    cat > "$org_dir/tetra.toml" << EOF
# $name organization
# Created: $(date -Iseconds)

[org]
name = "$name"

[env.local]
description = "Local development"

[env.dev]
description = "Development server"

[env.staging]
description = "Staging server"

[env.prod]
description = "Production server"
EOF

    echo "Created: $org_dir/tetra.toml"
    echo "Switch with: org switch $name"
}

# =============================================================================
# MAIN COMMAND
# =============================================================================

org() {
    local cmd="${1:-status}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Status/info
        status|s)
            local active=$(org_active)
            echo "Active: $active"
            if [[ "$active" != "none" ]]; then
                local toml=$(org_toml_path)

                # Check dirty status
                local dirty=""
                if _org_is_dirty "$active" 2>/dev/null; then
                    dirty=" (dirty)"
                fi
                echo "Config: $toml$dirty"

                # Show connectors (the SSH connection info)
                local envs=$(org_env_names 2>/dev/null | grep -v '^local$')
                local env_count=$(echo "$envs" | grep -c . 2>/dev/null || echo 0)

                if [[ $env_count -gt 0 ]]; then
                    echo ""
                    echo "Connectors:"
                    for env in $envs; do
                        local ip=$(_org_get_host "$env" 2>/dev/null)
                        local auth=$(_org_get_user "$env" 2>/dev/null)
                        local work=$(_org_get_work_user "$env" 2>/dev/null)
                        if [[ -n "$ip" ]]; then
                            local user_info="$auth"
                            [[ -n "$work" && "$work" != "$auth" ]] && user_info+="→$work"
                            printf "  @%-10s %s@%s\n" "$env" "$user_info" "$ip"
                        fi
                    done
                    echo ""
                    echo "Usage: ssh \$dev  or  ssh root@\$dev"
                fi

                # Show optional configured sections
                local extras=""
                grep -q '^\[storage' "$toml" 2>/dev/null && extras+="storage "
                grep -q '^\[resources' "$toml" 2>/dev/null && extras+="resources "
                grep -q '^\[services' "$toml" 2>/dev/null && extras+="services "
                [[ -n "$extras" ]] && echo "" && echo "Also: $extras"

                # Prompt to rebuild if dirty
                [[ -n "$dirty" ]] && echo "" && echo "Run 'org build' to rebuild"
            fi
            ;;

        # List orgs
        list|ls|l)
            org_list
            ;;

        # Switch org
        switch|sw)
            org_switch "$@"
            ;;

        # Create org
        create|new)
            org_create "$@"
            ;;

        # Initialize org with sections structure
        init)
            org_build_init "$@"
            ;;

        # Build tetra.toml from sections
        build)
            org_build "$@"
            ;;

        # List sections
        sections)
            org_build_list "$@"
            ;;

        # Aliases
        alias)
            org_alias "$@"
            ;;

        unalias)
            org_unalias "$@"
            ;;

        # View tetra.toml (or section)
        view|v)
            org_toml_view "$@"
            ;;

        # Edit tetra.toml
        edit|e)
            org_toml_edit
            ;;

        # Show specific section
        section|sec)
            org_toml_section "$@"
            ;;

        # List sections in tetra.toml
        sections)
            org_toml_sections
            ;;

        # Validate tetra.toml
        validate|val)
            org_toml_validate
            ;;

        # Get value by key path (org get env.dev.host)
        get)
            org_toml_get "$@"
            ;;

        # Set value (org set env.dev.host 1.2.3.4)
        set)
            org_toml_set "$@"
            ;;

        # Show path to active tetra.toml
        path)
            org_toml_path
            ;;

        # Environment commands
        env)
            local subcmd="${1:-}"
            shift 2>/dev/null || true
            case "$subcmd" in
                ""|list)
                    org_env_list
                    ;;
                *)
                    # Treat as environment name
                    org_env_show "$subcmd"
                    ;;
            esac
            ;;

        # Import from digocean.json (NodeHolder)
        import)
            local subcmd="${1:-}"
            shift 2>/dev/null || true

            # Use NH_DIR if set, otherwise default to ~/nh
            local nh_dir="${NH_DIR:-$HOME/nh}"

            case "$subcmd" in
                nh|nodeholder)
                    # Import from NodeHolder digocean.json
                    # Usage: org import nh <org_name> [json_file]
                    # Defaults json_file to $NH_DIR/<org_name>/digocean.json
                    local org_name="${1:-}"
                    local json_file="${2:-}"

                    if [[ -z "$org_name" ]]; then
                        echo "Usage: org import nh <org_name> [json_file]"
                        echo ""
                        echo "  json_file defaults to \$NH_DIR/<org_name>/digocean.json"
                        return 1
                    fi

                    # Default to $NH_DIR/<org>/digocean.json
                    if [[ -z "$json_file" ]]; then
                        json_file="$nh_dir/$org_name/digocean.json"
                    fi

                    if [[ ! -f "$json_file" ]]; then
                        echo "Not found: $json_file"
                        echo ""
                        echo "Run 'nh fetch' first, or specify path:"
                        echo "  org import nh $org_name /path/to/digocean.json"
                        return 1
                    fi

                    if ! type nh_import &>/dev/null; then
                        source "$TETRA_SRC/bash/nh/nh_import.sh"
                    fi
                    nh_import "$json_file" "$org_name"
                    ;;
                list|ls)
                    # List droplets in a JSON file
                    # Usage: org import list [org_name|json_file]
                    local arg="${1:-}"
                    local json_file=""

                    if [[ -z "$arg" ]]; then
                        echo "Usage: org import list <org_name|json_file>"
                        return 1
                    elif [[ -f "$arg" ]]; then
                        json_file="$arg"
                    elif [[ -f "$nh_dir/$arg/digocean.json" ]]; then
                        json_file="$nh_dir/$arg/digocean.json"
                    else
                        echo "Not found: $arg or $nh_dir/$arg/digocean.json"
                        return 1
                    fi

                    if ! type nh_list &>/dev/null; then
                        source "$TETRA_SRC/bash/nh/nh_import.sh"
                    fi
                    nh_list "$json_file"
                    ;;
                ""|help)
                    echo "Import infrastructure from nh (NodeHolder)"
                    echo ""
                    echo "Usage:"
                    echo "  org import nh <org_name>       Import \$NH_DIR/<org>/digocean.json"
                    echo "  org import nh <org> <json>     Import specific file"
                    echo "  org import list <org_name>     Preview droplets"
                    echo "  org import list <json_file>    Preview from file"
                    echo ""
                    echo "Example:"
                    echo "  org import list myorg"
                    echo "  org import nh myorg"
                    ;;
                *)
                    echo "Unknown import source: $subcmd"
                    echo "Try: org import help"
                    return 1
                    ;;
            esac
            ;;

        # PData - add project data structure to an org
        pdata)
            local subcmd="${1:-status}"
            shift 2>/dev/null || true

            local name="${1:-$(org_active 2>/dev/null)}"
            [[ "$name" == "none" ]] && name=""

            case "$subcmd" in
                init|add)
                    if [[ -z "$name" ]]; then
                        echo "Usage: org pdata init [org_name]"
                        return 1
                    fi

                    local org_dir="$TETRA_DIR/orgs/$name"
                    [[ ! -d "$org_dir" ]] && { echo "Org not found: $name"; return 1; }

                    local sections_dir="$org_dir/sections"
                    local pd_dir="$org_dir/pd"

                    echo "PData Init: $name"
                    echo ""

                    # Create pd/ structure
                    if [[ ! -d "$pd_dir/data/projects" ]]; then
                        mkdir -p "$pd_dir/data/projects"
                        mkdir -p "$pd_dir/config"
                        mkdir -p "$pd_dir/cache"
                        echo "Created: $pd_dir/"
                        echo "  data/projects/"
                        echo "  config/"
                        echo "  cache/"
                    else
                        echo "Exists:  $pd_dir/"
                    fi

                    # Create section file if using sections/ structure
                    if [[ -d "$sections_dir" ]]; then
                        if [[ ! -f "$sections_dir/25-pdata.toml" ]]; then
                            cat > "$sections_dir/25-pdata.toml" << EOF
# PData - Project Data organization
# Used by tdocs for project/subject context
# Safe from nh_bridge (only touches 10-infrastructure.toml)

[pdata]
enabled = true
# path defaults to \$TETRA_DIR/orgs/$name/pd
EOF
                            echo ""
                            echo "Created: sections/25-pdata.toml"
                            echo ""
                            echo "Run 'org build' to update tetra.toml"
                        else
                            echo ""
                            echo "Exists:  sections/25-pdata.toml"
                        fi
                    fi
                    ;;

                status|"")
                    if [[ -z "$name" ]]; then
                        echo "No active org. Use: org pdata status <org_name>"
                        return 1
                    fi

                    local org_dir="$TETRA_DIR/orgs/$name"
                    local pd_dir="$org_dir/pd"

                    echo "PData: $name"
                    echo ""

                    if [[ -d "$pd_dir" ]]; then
                        echo "Root:     $pd_dir"
                        local project_count=$(find "$pd_dir/data/projects" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
                        echo "Projects: $project_count"

                        if [[ $project_count -gt 0 ]]; then
                            echo ""
                            for proj_dir in "$pd_dir/data/projects"/*/; do
                                [[ -d "$proj_dir" ]] || continue
                                local proj_name=$(basename "${proj_dir%/}")
                                local subj_count=$(find "$proj_dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
                                printf "  %-20s %d subjects\n" "$proj_name" "$subj_count"
                            done
                        fi
                    else
                        echo "Not initialized"
                        echo ""
                        echo "Run: org pdata init $name"
                    fi
                    ;;

                *)
                    echo "Usage: org pdata <command> [org_name]"
                    echo ""
                    echo "Commands:"
                    echo "  status   Show PData status (default)"
                    echo "  init     Initialize PData for org"
                    ;;
            esac
            ;;

        # SSH - delegate to tkm or use variables directly
        ssh)
            echo "Use shell variables instead:"
            echo "  ssh root@\$dev"
            echo "  ssh dev@\$dev"
            echo ""
            echo "Or test connectivity with: tkm test"
            ;;

        # Help
        help|h|--help|-h)
            cat << 'EOF'
org - Organization Management

FIRST USE
  init <name>        Create $TETRA_DIR/orgs/<name>/ with templates
  import nh <name>   Import $NH_DIR/<name>/digocean.json
  build <name>       Assemble NN-*.toml into tetra.toml

REGULAR USE
  status             Show active org + connectors (dirty flag)
  list               List all orgs
  switch <name>      Activate org, exports $dev $staging $prod
  env                List connectors
  ssh root@$dev      Connect using exported variables

PDATA (Project Data)
  pdata status       Show PData projects/subjects
  pdata init         Initialize PData for org

ALL COMMANDS
  Orgs      status list switch create init alias unalias
  Build     sections build import pdata
  Toml      view section get set edit validate path
  Env       env
EOF
            ;;

        *)
            echo "Unknown command: $cmd"
            echo "Try: org help"
            return 1
            ;;
    esac
}

# Register completion
complete -F _org_complete org

export -f org org_active org_list org_names org_switch org_create org_alias org_unalias _org_export_env_vars
