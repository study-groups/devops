#!/usr/bin/env bash
# org.sh - Simplified Organization Management
# Focus: tab completion + working with THE tetra.toml
#
# The tetra.toml pattern:
#   $TETRA_DIR/config/tetra.toml  ->  symlink to active org
#   $TETRA_DIR/orgs/<name>/tetra.toml  ->  actual config files

ORG_SRC="${TETRA_SRC}/bash/org"

# Constants
ORG_NO_ACTIVE="none"

# Load colors
if [[ -f "$TETRA_SRC/bash/color/color.sh" ]]; then
    source "$TETRA_SRC/bash/color/color.sh" 2>/dev/null
fi
# Fallback colors if not loaded
: "${TETRA_CYAN:=\033[0;36m}"
: "${TETRA_YELLOW:=\033[1;33m}"
: "${TETRA_GREEN:=\033[0;32m}"
: "${TETRA_BLUE:=\033[1;34m}"
: "${TETRA_GRAY:=\033[0;90m}"
: "${TETRA_NC:=\033[0m}"

# =============================================================================
# HELP
# =============================================================================

_org_help() {
    local C="$TETRA_CYAN"
    local Y="$TETRA_YELLOW"
    local G="$TETRA_GREEN"
    local B="$TETRA_BLUE"
    local D="$TETRA_GRAY"
    local N="$TETRA_NC"

    echo -e "${B}org${N} - Organization Management"
    echo ""
    echo -e "${Y}FIRST USE${N}"
    echo -e "  ${C}init${N} <name>        Create \$TETRA_DIR/orgs/<name>/ with templates"
    echo -e "  ${C}import nh${N} <name>   Import \$NH_DIR/<name>/digocean.json"
    echo -e "  ${C}import validate${N}    Verify TOML matches source JSON"
    echo -e "  ${C}build${N} <name>       Assemble NN-*.toml into tetra.toml"
    echo ""
    echo -e "${Y}REGULAR USE${N}"
    echo -e "  ${C}status${N}             Show active org + connectors"
    echo -e "  ${C}list${N}               List all orgs"
    echo -e "  ${C}switch${N} <name>      Activate org, exports \$dev \$staging \$prod"
    echo -e "  ${C}env${N}                List connectors"
    echo -e "  ${G}ssh root@\$dev${N}      Connect using exported variables"
    echo ""
    echo -e "${Y}DOMAINS${N}"
    echo -e "  ${C}domain add${N} <domain>     Add domain to org"
    echo -e "  ${C}domain list${N}             List all domains"
    echo -e "  ${C}domain check${N} <domain>   DNS health check"
    echo ""
    echo -e "${Y}PDATA (Project Data)${N}"
    echo -e "  ${C}pdata status${N}       Show PData projects/subjects"
    echo -e "  ${C}pdata init${N}         Initialize PData for org"
    echo ""
    echo -e "${Y}SECRETS${N}"
    echo -e "  ${C}secrets sync${N}       Sync ~/nh/<org>/*.env → secrets.env"
    echo -e "  ${C}secrets list${N}       Show secret keys"
    echo -e "  ${C}secrets edit${N}       Edit secrets.env"
    echo ""
    echo -e "${Y}ALL COMMANDS${N}"
    echo -e "  ${D}Orgs${N}    status list switch create init alias unalias"
    echo -e "  ${D}Build${N}   sections build import domain pdata secrets"
    echo -e "  ${D}Toml${N}    view section get set edit validate path"
    echo -e "  ${D}Env${N}     env"
}

# =============================================================================
# SHARED HELPERS
# =============================================================================

# Extract section names from a TOML file
# Usage: _org_extract_sections <file>
_org_extract_sections() {
    local file="$1"
    [[ -f "$file" ]] || return 1
    grep -oE '^\[[^]]+\]' "$file" | tr -d '[]'
}

# Core TOML syntax validation - returns error count
# Usage: _org_validate_toml_syntax <file>
_org_validate_toml_syntax() {
    local file="$1"
    local errors=0
    local line_num=0

    while IFS= read -r line || [[ -n "$line" ]]; do
        ((line_num++))
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

        # Section headers
        if [[ "$line" =~ ^\[.*\]$ ]]; then
            local sect="${line#[}"; sect="${sect%]}"
            if [[ ! "$sect" =~ ^[a-zA-Z_][a-zA-Z0-9_.-]*$ ]]; then
                echo "Line $line_num: Invalid section: $sect" >&2
                ((errors++))
            fi
            continue
        fi

        # Key=value pairs (including quoted keys)
        [[ "$line" =~ ^[[:space:]]*[a-zA-Z_\"][a-zA-Z0-9_\"@.-]*[[:space:]]*= ]] && continue

        # Continuation lines
        [[ "$line" =~ ^[[:space:]]*[\]\}\"\'] ]] && continue
        [[ "$line" =~ ^[[:space:]]*[0-9] ]] && continue

        # Unrecognized
        if [[ ! "$line" =~ ^[[:space:]]*$ ]]; then
            echo "Line $line_num: Unrecognized: $line" >&2
            ((errors++))
        fi
    done < "$file"

    return $errors
}

# Source dependencies
source "$ORG_SRC/org_toml.sh"
source "$ORG_SRC/org_env.sh"
source "$ORG_SRC/org_build.sh"
source "$ORG_SRC/org_secrets.sh"
source "$ORG_SRC/org_domain.sh"
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
        echo "$ORG_NO_ACTIVE"
    fi
}

# List all organizations (canonical names, then aliases)
org_list() {
    local orgs_dir="$TETRA_DIR/orgs"
    local active=$(org_active)

    [[ ! -d "$orgs_dir" ]] && { echo "No orgs directory" >&2; return 1; }

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

    [[ -z "$name" ]] && { echo "Usage: org switch <name>" >&2; return 1; }

    local org_toml="$TETRA_DIR/orgs/$name/tetra.toml"
    local link="$TETRA_DIR/config/tetra.toml"

    [[ ! -f "$org_toml" ]] && { echo "Not found: $org_toml" >&2; return 1; }

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
    [[ -z "$canonical" ]] && { echo "Usage: org alias <short> <canonical>" >&2; return 1; }

    # Validate
    [[ ! "$alias_name" =~ ^[a-zA-Z0-9_-]+$ ]] && { echo "Invalid alias name" >&2; return 1; }

    local canonical_dir="$orgs_dir/$canonical"
    local alias_path="$orgs_dir/$alias_name"

    [[ ! -d "$canonical_dir" ]] && { echo "Not found: $canonical" >&2; return 1; }
    [[ -e "$alias_path" ]] && { echo "Already exists: $alias_name" >&2; return 1; }

    # Create relative symlink
    ln -s "$canonical" "$alias_path"
    echo "Created: $alias_name -> $canonical"
}

# Remove an alias
org_unalias() {
    local alias_name="$1"
    local orgs_dir="$TETRA_DIR/orgs"

    [[ -z "$alias_name" ]] && { echo "Usage: org unalias <name>" >&2; return 1; }

    local alias_path="$orgs_dir/$alias_name"

    if [[ -L "$alias_path" ]]; then
        rm "$alias_path"
        echo "Removed: $alias_name"
    elif [[ -d "$alias_path" ]]; then
        echo "Error: $alias_name is a canonical org, not an alias" >&2
        return 1
    else
        echo "Not found: $alias_name" >&2
        return 1
    fi
}

# Create new organization (interactive)
org_create() {
    local name="$1"
    local org_type="${2:-}"
    local dns_provider="${3:-}"

    [[ -z "$name" ]] && { echo "Usage: org create <name> [type] [dns-provider]" >&2; return 1; }
    [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]] && { echo "Invalid name (use a-z, 0-9, _, -)" >&2; return 1; }

    local org_dir="$TETRA_DIR/orgs/$name"
    [[ -d "$org_dir" ]] && { echo "Already exists: $name" >&2; return 1; }

    # Interactive org type selection if not provided
    if [[ -z "$org_type" ]]; then
        echo "Org type for $name:"
        echo ""
        echo "  1) cicd          - Full CI/CD infrastructure (servers, SSH, deploy)"
        echo "                     For: pixeljam-arcade, nodeholder style orgs"
        echo ""
        echo "  2) managed-google - Managed site (Google Sites + Analytics + Stripe)"
        echo "                     For: transreal style admin/analytics orgs"
        echo ""
        echo -n "Select [1-2]: "
        read -r choice
        case "$choice" in
            1|cicd)          org_type="cicd" ;;
            2|managed*|google) org_type="managed-google" ;;
            *)
                echo "Invalid selection" >&2
                return 1
                ;;
        esac
    fi

    # DNS provider selection for managed orgs
    if [[ "$org_type" == "managed-google" && -z "$dns_provider" ]]; then
        echo ""
        echo "DNS provider (routes traffic to Google Sites):"
        echo ""
        echo "  1) rc  - Reseller Club"
        echo "  2) do  - DigitalOcean DNS"
        echo "  3) cf  - CloudFlare"
        echo "  4) none - Configure later"
        echo ""
        echo -n "Select [1-4]: "
        read -r choice
        case "$choice" in
            1|rc)   dns_provider="rc" ;;
            2|do)   dns_provider="do" ;;
            3|cf)   dns_provider="cf" ;;
            4|none) dns_provider="" ;;
            *)      dns_provider="" ;;
        esac
    fi

    # Google credentials for managed-google orgs
    local google_email="" google_site_url="" custom_domain="" ga4_id=""

    if [[ "$org_type" == "managed-google" ]]; then
        echo ""
        echo "Google Site Configuration"
        echo "─────────────────────────"
        echo ""

        echo -n "Google account email: "
        read -r google_email

        echo ""
        echo "Google Site URL (from your browser, e.g.):"
        echo "  https://sites.google.com/view/mysite"
        echo "  https://sites.google.com/d/SITE_ID/edit"
        echo -n "Site URL: "
        read -r google_site_url

        echo ""
        echo -n "Custom domain for the site (e.g., www.${name}.com): "
        read -r custom_domain
        [[ -z "$custom_domain" ]] && custom_domain="www.${name}.com"

        echo ""
        echo "Google Analytics GA4 Measurement ID"
        echo "  (Found in GA4 > Admin > Data Streams, looks like G-XXXXXXXXXX)"
        echo -n "Measurement ID (or press Enter to skip): "
        read -r ga4_id
        [[ -z "$ga4_id" ]] && ga4_id="G-XXXXXXXXXX"
    fi

    echo ""
    echo "Creating: $name ($org_type)"

    # Create org directory structure
    mkdir -p "$org_dir/sections"
    mkdir -p "$org_dir/backups"
    mkdir -p "$org_dir/workspace"

    # Copy templates based on org type
    local template_dir="$ORG_SRC/templates/$org_type"

    if [[ -d "$template_dir" ]]; then
        local created_date
        created_date=$(date -Iseconds)

        for tmpl in "$template_dir"/*.toml; do
            [[ -f "$tmpl" ]] || continue
            local filename=$(basename "$tmpl")
            local dest="$org_dir/sections/$filename"

            # Template substitution
            # Escape slashes in URLs for sed
            local site_url_escaped="${google_site_url//\//\\/}"
            local custom_domain_clean="${custom_domain:-www.${name}.com}"

            sed -e "s/{{ORG_NAME}}/$name/g" \
                -e "s/{{CREATED}}/$created_date/g" \
                -e "s/{{DOMAIN}}/${name}.com/g" \
                -e "s/{{GOOGLE_EMAIL}}/${google_email:-}/g" \
                -e "s|{{GOOGLE_SITE_URL}}|${google_site_url:-}|g" \
                -e "s/{{CUSTOM_DOMAIN}}/${custom_domain_clean}/g" \
                -e "s/{{GA4_MEASUREMENT_ID}}/${ga4_id:-G-XXXXXXXXXX}/g" \
                "$tmpl" > "$dest"

            echo "  Created: sections/$filename"
        done

        # Add DNS provider section if selected
        if [[ -n "$dns_provider" ]]; then
            local dns_tmpl="$ORG_SRC/templates/dns/dns-${dns_provider}.toml"
            local base_domain="${name}.com"
            # Extract base domain from custom_domain (e.g., www.foo.com -> foo.com)
            if [[ -n "$custom_domain" ]]; then
                base_domain="${custom_domain#www.}"
            fi
            if [[ -f "$dns_tmpl" ]]; then
                sed -e "s/{{ORG_NAME}}/$name/g" \
                    -e "s/{{DOMAIN}}/${base_domain}/g" \
                    "$dns_tmpl" >> "$org_dir/sections/40-dns.toml"
                echo "  Added: DNS provider ($dns_provider)"
            fi
        fi

        # Create pd/ structure for managed orgs
        if [[ "$org_type" == "managed-google" ]]; then
            mkdir -p "$org_dir/pd/data/projects"
            mkdir -p "$org_dir/pd/config"
            mkdir -p "$org_dir/pd/cache"
            mkdir -p "$org_dir/workspace/content"
            mkdir -p "$org_dir/workspace/images"
            mkdir -p "$org_dir/workspace/documents"
        fi
    else
        # Fallback to simple creation
        cat > "$org_dir/tetra.toml" << EOF
# $name organization
# Created: $(date -Iseconds)
# Type: $org_type

[org]
name = "$name"
type = "$org_type"

[env.local]
description = "Local development"

[env.prod]
description = "Production"
EOF
        echo "  Created: tetra.toml (minimal)"
    fi

    echo ""
    echo "Next steps:"
    echo "  org build $name    - Assemble tetra.toml from sections"
    echo "  org switch $name   - Activate this org"

    if [[ "$org_type" == "managed-google" ]]; then
        local base_domain="${name}.com"
        [[ -n "$custom_domain" ]] && base_domain="${custom_domain#www.}"

        echo ""
        echo "DNS setup (point ${custom_domain:-www.${name}.com} to Google Sites):"
        if [[ -n "$dns_provider" ]]; then
            echo "  1. Add credentials to secrets.env:"
            case "$dns_provider" in
                rc) echo "       RC_AUTH_USERID=your-id" && echo "       RC_API_KEY=your-key" ;;
                do) echo "       DO_API_TOKEN=your-token" ;;
                cf) echo "       CF_API_TOKEN=your-token" && echo "       CF_ZONE_ID=your-zone" ;;
            esac
            echo "  2. Create CNAME record:"
            echo "       dns $dns_provider add $base_domain CNAME www ghs.googlehosted.com"
            echo "  3. In Google Sites > Settings > Custom domains:"
            echo "       Add: ${custom_domain:-www.${name}.com}"
        else
            echo "  1. Create CNAME: www -> ghs.googlehosted.com"
            echo "  2. In Google Sites, add custom domain"
        fi

        if [[ -n "$ga4_id" && "$ga4_id" != "G-XXXXXXXXXX" ]]; then
            echo ""
            echo "Analytics: GA4 ${ga4_id} configured"
        fi
    fi
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
            if [[ "$active" != "$ORG_NO_ACTIVE" ]]; then
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
                validate|val)
                    # Validate TOML matches source JSON
                    # Usage: org import validate [org_name]
                    local org_name="${1:-$(org_active 2>/dev/null)}"
                    [[ "$org_name" == "$ORG_NO_ACTIVE" ]] && org_name=""

                    if [[ -z "$org_name" ]]; then
                        echo "Usage: org import validate [org_name]"
                        return 1
                    fi

                    if ! type nh_validate &>/dev/null; then
                        source "$TETRA_SRC/bash/nh/nh_import.sh"
                    fi
                    nh_validate "$org_name"
                    ;;
                ""|help)
                    echo "Import infrastructure from nh (NodeHolder)"
                    echo ""
                    echo "Usage:"
                    echo "  org import nh <org_name>       Import \$NH_DIR/<org>/digocean.json"
                    echo "  org import nh <org> <json>     Import specific file"
                    echo "  org import list <org_name>     Preview droplets"
                    echo "  org import list <json_file>    Preview from file"
                    echo "  org import validate [org]      Verify TOML matches JSON"
                    echo ""
                    echo "Example:"
                    echo "  org import list myorg"
                    echo "  org import nh myorg"
                    echo "  org import validate"
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
            [[ "$name" == "$ORG_NO_ACTIVE" ]] && name=""

            case "$subcmd" in
                init|add)
                    if [[ -z "$name" ]]; then
                        echo "Usage: org pdata init [org_name]" >&2
                        return 1
                    fi

                    local org_dir="$TETRA_DIR/orgs/$name"
                    [[ ! -d "$org_dir" ]] && { echo "Org not found: $name" >&2; return 1; }

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

        # Domain management
        domain|dom|d)
            org_domain "$@"
            ;;

        # Secrets management
        secrets|sec)
            org_secrets "$@"
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
            _org_help
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

export ORG_NO_ACTIVE
export -f org org_active org_list org_names org_switch org_create org_alias org_unalias
export -f _org_extract_sections _org_validate_toml_syntax _org_export_env_vars
