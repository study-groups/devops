#!/usr/bin/env bash
# org_volumes.sh - DigitalOcean Volumes (block storage)
#
# Commands:
#   org volumes list         List all volumes for current doctl context
#   org volumes status       Show volumes attached to org's environments
#   org volumes init         Create volume, configure tetra.toml
#   org volumes attach       Attach volume to droplet
#
# Configuration:
#   Reads [volumes] from org's tetra.toml
#   Requires: doctl configured with appropriate context

# === HELPERS ===

# Check doctl is available and authenticated
_org_volumes_check_doctl() {
    if ! command -v doctl &>/dev/null; then
        echo "doctl not found. Install with: brew install doctl" >&2
        return 1
    fi

    if ! doctl account get &>/dev/null; then
        echo "doctl not authenticated. Run: doctl auth init" >&2
        return 1
    fi
    return 0
}

# Get volume config from tetra.toml [volumes] section
_org_volumes_get_config() {
    local toml
    toml=$(org_toml_path 2>/dev/null) || return 1

    # Parse [volumes.*] sections
    VOLUMES_CONFIG=()
    local current_name="" current_size="" current_region="" current_mount=""

    while IFS= read -r line; do
        if [[ "$line" =~ ^\[volumes\.([^\]]+)\] ]]; then
            # Save previous volume if exists
            if [[ -n "$current_name" ]]; then
                VOLUMES_CONFIG+=("$current_name|$current_size|$current_region|$current_mount")
            fi
            current_name="${BASH_REMATCH[1]}"
            current_size="" current_region="" current_mount=""
        elif [[ "$line" =~ ^\[.*\] ]]; then
            # Exiting volumes section
            if [[ -n "$current_name" ]]; then
                VOLUMES_CONFIG+=("$current_name|$current_size|$current_region|$current_mount")
            fi
            current_name=""
        elif [[ -n "$current_name" ]]; then
            if [[ "$line" =~ ^size[[:space:]]*=[[:space:]]*\"?([^\"]+)\"? ]]; then
                current_size="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^region[[:space:]]*=[[:space:]]*\"?([^\"]+)\"? ]]; then
                current_region="${BASH_REMATCH[1]}"
            elif [[ "$line" =~ ^mount[[:space:]]*=[[:space:]]*\"?([^\"]+)\"? ]]; then
                current_mount="${BASH_REMATCH[1]}"
            fi
        fi
    done < "$toml"

    # Don't forget the last one
    if [[ -n "$current_name" ]]; then
        VOLUMES_CONFIG+=("$current_name|$current_size|$current_region|$current_mount")
    fi
}

# === LIST ===

# List all volumes in current doctl context
org_volumes_list() {
    echo "Volumes (doctl context: $(doctl auth list --format Current,Name --no-header 2>/dev/null | grep true | awk '{print $2}'))"
    echo ""

    if ! _org_volumes_check_doctl; then
        return 1
    fi

    doctl compute volume list --format ID,Name,Size,Region,DropletIDs,Tags --no-header 2>/dev/null | \
    while read -r id name size region droplets tags; do
        local attached="detached"
        [[ -n "$droplets" && "$droplets" != "[]" ]] && attached="attached"
        printf "  %-20s %4sGB  %-6s  %s\n" "$name" "$size" "$region" "$attached"
    done

    local count
    count=$(doctl compute volume list --format ID --no-header 2>/dev/null | wc -l | tr -d ' ')
    echo ""
    echo "Total: $count volumes"
}

# === STATUS ===

# Show volumes configured for this org
org_volumes_status() {
    local name="${1:-$(org_active 2>/dev/null)}"
    [[ "$name" == "$ORG_NO_ACTIVE" ]] && name=""

    if [[ -z "$name" ]]; then
        echo "Usage: org volumes status [org_name]" >&2
        return 1
    fi

    echo "Volumes Status: $name"
    echo ""

    if ! _org_volumes_check_doctl; then
        return 1
    fi

    _org_volumes_get_config

    if [[ ${#VOLUMES_CONFIG[@]} -eq 0 ]]; then
        echo "No volumes configured in tetra.toml"
        echo ""
        echo "Add [volumes.<name>] sections or run: org volumes init"
        return 0
    fi

    # Get actual volumes from DO
    local do_volumes
    do_volumes=$(doctl compute volume list --format Name,Size,Region,DropletIDs --no-header 2>/dev/null)

    for vol_config in "${VOLUMES_CONFIG[@]}"; do
        IFS='|' read -r vol_name vol_size vol_region vol_mount <<< "$vol_config"

        echo "Volume: $vol_name"
        echo "  Config:  ${vol_size:-?}GB in ${vol_region:-?}"
        [[ -n "$vol_mount" ]] && echo "  Mount:   $vol_mount"

        # Check if exists in DO
        local do_info
        do_info=$(echo "$do_volumes" | grep "^$vol_name " || true)
        if [[ -n "$do_info" ]]; then
            local do_size do_region do_droplets
            read -r _ do_size do_region do_droplets <<< "$do_info"
            echo "  Actual:  ${do_size}GB in $do_region"
            if [[ -n "$do_droplets" && "$do_droplets" != "[]" ]]; then
                echo "  Status:  attached to droplet $do_droplets"
            else
                echo "  Status:  detached"
            fi
        else
            echo "  Status:  NOT FOUND in DigitalOcean"
        fi
        echo ""
    done
}

# === INIT ===

# Create a new volume
org_volumes_init() {
    local name="${1:-$(org_active 2>/dev/null)}"
    [[ "$name" == "$ORG_NO_ACTIVE" ]] && name=""

    if [[ -z "$name" ]]; then
        echo "Usage: org volumes init [org_name]" >&2
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$name"
    [[ ! -d "$org_dir" ]] && { echo "Org not found: $name" >&2; return 1; }

    echo "Volumes Init: $name"
    echo ""

    if ! _org_volumes_check_doctl; then
        return 1
    fi

    # Get volume details
    echo -n "Volume name (e.g., ${name}-data): "
    read -r vol_name
    [[ -z "$vol_name" ]] && vol_name="${name}-data"

    echo -n "Size in GB [10]: "
    read -r vol_size
    [[ -z "$vol_size" ]] && vol_size="10"

    # Get region from org's environments or prompt
    local vol_region=""
    _org_spaces_get_config 2>/dev/null
    if [[ -n "$SPACES_REGION" ]]; then
        vol_region="$SPACES_REGION"
        echo "Region: $vol_region (from spaces config)"
    else
        echo ""
        echo "Region options:"
        echo "  1) nyc3 - New York"
        echo "  2) sfo3 - San Francisco"
        echo "  3) ams3 - Amsterdam"
        echo -n "Select [1-3, default=1]: "
        read -r choice
        case "$choice" in
            2) vol_region="sfo3" ;;
            3) vol_region="ams3" ;;
            *) vol_region="nyc3" ;;
        esac
    fi

    echo ""
    echo "Creating volume: $vol_name"
    echo "  Size:   ${vol_size}GB"
    echo "  Region: $vol_region"
    echo ""

    # Create volume
    if doctl compute volume create "$vol_name" --size "${vol_size}GiB" --region "$vol_region" --format ID,Name,Size,Region; then
        echo ""
        echo "Volume created!"
    else
        echo "Failed to create volume" >&2
        return 1
    fi

    # Write config to sections/26-volumes.toml
    local sections_dir="$org_dir/sections"
    mkdir -p "$sections_dir"

    local volumes_file="$sections_dir/26-volumes.toml"

    # Append or create
    if [[ -f "$volumes_file" ]]; then
        echo "" >> "$volumes_file"
    else
        echo "# DigitalOcean Volumes (block storage)" > "$volumes_file"
        echo "# Auto-generated by: org volumes init" >> "$volumes_file"
        echo "" >> "$volumes_file"
    fi

    cat >> "$volumes_file" << EOF
[volumes.$vol_name]
size = "$vol_size"
region = "$vol_region"
mount = "/mnt/$vol_name"
EOF

    echo ""
    echo "Updated: sections/26-volumes.toml"
    echo ""
    echo "Run 'org build' to update tetra.toml"
    echo "Attach with: org volumes attach $vol_name <droplet>"
}

# === ATTACH ===

# Attach volume to droplet
org_volumes_attach() {
    local vol_name="$1"
    local droplet="$2"

    if [[ -z "$vol_name" || -z "$droplet" ]]; then
        echo "Usage: org volumes attach <volume-name> <droplet-id-or-name>" >&2
        return 1
    fi

    if ! _org_volumes_check_doctl; then
        return 1
    fi

    # Get volume ID
    local vol_id
    vol_id=$(doctl compute volume list --format ID,Name --no-header 2>/dev/null | grep " $vol_name$" | awk '{print $1}')

    if [[ -z "$vol_id" ]]; then
        echo "Volume not found: $vol_name" >&2
        return 1
    fi

    # Get droplet ID if name provided
    local droplet_id="$droplet"
    if ! [[ "$droplet" =~ ^[0-9]+$ ]]; then
        droplet_id=$(doctl compute droplet list --format ID,Name --no-header 2>/dev/null | grep " $droplet$" | awk '{print $1}')
        if [[ -z "$droplet_id" ]]; then
            echo "Droplet not found: $droplet" >&2
            return 1
        fi
    fi

    echo "Attaching $vol_name to droplet $droplet_id..."

    if doctl compute volume-action attach "$vol_id" "$droplet_id"; then
        echo ""
        echo "Attached! Mount on the droplet with:"
        echo "  sudo mkdir -p /mnt/$vol_name"
        echo "  sudo mount -o defaults,nofail,discard,noatime /dev/disk/by-id/scsi-0DO_Volume_$vol_name /mnt/$vol_name"
    else
        echo "Failed to attach volume" >&2
        return 1
    fi
}

# === DETACH ===

org_volumes_detach() {
    local vol_name="$1"

    if [[ -z "$vol_name" ]]; then
        echo "Usage: org volumes detach <volume-name>" >&2
        return 1
    fi

    if ! _org_volumes_check_doctl; then
        return 1
    fi

    local vol_id
    vol_id=$(doctl compute volume list --format ID,Name --no-header 2>/dev/null | grep " $vol_name$" | awk '{print $1}')

    if [[ -z "$vol_id" ]]; then
        echo "Volume not found: $vol_name" >&2
        return 1
    fi

    # Get attached droplet
    local droplet_id
    droplet_id=$(doctl compute volume get "$vol_id" --format DropletIDs --no-header 2>/dev/null | tr -d '[]')

    if [[ -z "$droplet_id" ]]; then
        echo "Volume is not attached"
        return 0
    fi

    echo "Detaching $vol_name from droplet $droplet_id..."

    if doctl compute volume-action detach "$vol_id" "$droplet_id"; then
        echo "Detached!"
    else
        echo "Failed to detach volume" >&2
        return 1
    fi
}

# === SUBCOMMAND ROUTER ===

org_volumes() {
    local subcmd="${1:-list}"
    shift 2>/dev/null || true

    case "$subcmd" in
        list|ls)
            org_volumes_list "$@"
            ;;
        status)
            org_volumes_status "$@"
            ;;
        init|create)
            org_volumes_init "$@"
            ;;
        attach)
            org_volumes_attach "$@"
            ;;
        detach)
            org_volumes_detach "$@"
            ;;
        help|--help|-h)
            echo "org volumes - DigitalOcean Volumes (block storage)"
            echo ""
            echo "Commands:"
            echo "  list              List all volumes in doctl context"
            echo "  status [org]      Show volumes configured for org"
            echo "  init [org]        Create volume, configure tetra.toml"
            echo "  attach <vol> <droplet>  Attach volume to droplet"
            echo "  detach <vol>      Detach volume from droplet"
            echo ""
            echo "Requirements:"
            echo "  - doctl (brew install doctl)"
            echo "  - doctl auth init (for authentication)"
            ;;
        *)
            echo "Unknown volumes command: $subcmd" >&2
            echo "Try: org volumes help" >&2
            return 1
            ;;
    esac
}

# Functions available via source (no exports per CLAUDE.md)
