#!/usr/bin/env bash

# Tetra Organization Refresh Workflow
# Complete workflow to refresh organization configuration
#
# WORKFLOW:
#   1. Update digitalocean.json (optional)
#   2. Re-run discovery → mapping.json (if needed)
#   3. Validate secrets.env
#   4. Compile tetra.toml from all inputs
#   5. Backup and validate
#
# SAFETY:
#   - Creates timestamped backups before any changes
#   - Validates all inputs before compilation
#   - Can run partial refresh (skip discovery, just recompile)

set -euo pipefail

# Source required modules
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/discovery.sh"
source "$SCRIPT_DIR/compiler.sh"
source "$SCRIPT_DIR/secrets_manager.sh"

# Full refresh workflow
tetra_org_refresh() {
    local org_name="$1"
    local json_source="${2:-}"
    local options="${3:-}"

    if [[ -z "$org_name" ]]; then
        echo "Error: Organization name required" >&2
        return 1
    fi

    local org_dir="$TETRA_DIR/org/$org_name"
    local json_file="$org_dir/digitalocean.json"
    local mapping_file="$org_dir/mapping.json"
    local secrets_file="$org_dir/secrets.env"
    local toml_file="$org_dir/tetra.toml"
    local backup_dir="$org_dir/backups"

    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  TETRA ORGANIZATION REFRESH"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Organization: $org_name"
    echo "Directory: $org_dir"
    echo ""

    # Check org directory exists
    if [[ ! -d "$org_dir" ]]; then
        echo "❌ Organization directory not found: $org_dir"
        echo "   Create with: tetra org create $org_name"
        return 1
    fi

    # Create backup directory
    mkdir -p "$backup_dir"

    # Step 1: Update digitalocean.json
    echo "─────────────────────────────────────────────────────────"
    echo "[1/5] DigitalOcean Infrastructure Data"
    echo "─────────────────────────────────────────────────────────"

    if [[ -n "$json_source" ]]; then
        _refresh_infrastructure_data "$json_source" "$json_file" "$backup_dir"
    else
        if [[ -f "$json_file" ]]; then
            echo "✅ Using existing: $(basename "$json_file")"
            local json_age
            json_age=$(( $(date +%s) - $(stat -f %m "$json_file" 2>/dev/null || stat -c %Y "$json_file") ))
            echo "   Last updated: $((json_age / 86400)) days ago"
        else
            echo "⚠️  No digitalocean.json found"
            echo "   Provide source: tetra org refresh $org_name <path/to/digitalocean.json>"
            return 1
        fi
    fi
    echo ""

    # Step 2: Mapping (discovery)
    echo "─────────────────────────────────────────────────────────"
    echo "[2/5] Environment Mapping"
    echo "─────────────────────────────────────────────────────────"

    if [[ "$options" == *"--rediscover"* ]]; then
        _refresh_mapping "$org_name" "$json_file" "$mapping_file" "$backup_dir"
    else
        if [[ -f "$mapping_file" ]]; then
            echo "✅ Using existing: $(basename "$mapping_file")"
            echo "   To rediscover: add --rediscover flag"
        else
            echo "⚠️  No mapping.json found - running discovery..."
            _refresh_mapping "$org_name" "$json_file" "$mapping_file" "$backup_dir"
        fi
    fi
    echo ""

    # Step 3: Secrets validation
    echo "─────────────────────────────────────────────────────────"
    echo "[3/5] Secrets Validation"
    echo "─────────────────────────────────────────────────────────"

    if [[ ! -f "$secrets_file" ]]; then
        echo "❌ No secrets.env found"
        echo "   Initialize: tetra org secrets init $org_name"
        return 1
    else
        tetra_secrets_validate "$org_name" || {
            echo "   Fix secrets and re-run refresh"
            return 1
        }
    fi
    echo ""

    # Step 4: Backup existing tetra.toml
    echo "─────────────────────────────────────────────────────────"
    echo "[4/5] Backup Current Configuration"
    echo "─────────────────────────────────────────────────────────"

    if [[ -f "$toml_file" ]]; then
        local backup_name="tetra.toml.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$toml_file" "$backup_dir/$backup_name"
        echo "✅ Backed up: $backup_name"
    else
        echo "ℹ️  No existing tetra.toml (first compile)"
    fi
    echo ""

    # Step 5: Compile tetra.toml
    echo "─────────────────────────────────────────────────────────"
    echo "[5/5] Compile tetra.toml"
    echo "─────────────────────────────────────────────────────────"

    tetra_compile_toml "$org_name" --force || {
        echo ""
        echo "❌ Compilation failed"
        echo "   Check errors above"
        return 1
    }

    # Success summary
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  REFRESH COMPLETE"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    _show_refresh_summary "$org_name" "$org_dir"

    return 0
}

# Quick refresh (just recompile, don't touch infrastructure)
tetra_org_quick_refresh() {
    local org_name="$1"

    echo "⚡ Quick refresh: $org_name"
    echo "   (Skipping infrastructure and discovery)"
    echo ""

    tetra_quick_compile "$org_name"
}

# Refresh status
tetra_org_refresh_status() {
    local org_name="$1"

    if [[ -z "$org_name" ]]; then
        echo "Error: Organization name required" >&2
        return 1
    fi

    local org_dir="$TETRA_DIR/org/$org_name"

    if [[ ! -d "$org_dir" ]]; then
        echo "❌ Organization not found: $org_name"
        return 1
    fi

    local json_file="$org_dir/digitalocean.json"
    local mapping_file="$org_dir/mapping.json"
    local resources_file="$org_dir/resources.toml"
    local secrets_file="$org_dir/secrets.env"
    local toml_file="$org_dir/tetra.toml"

    echo ""
    echo "Refresh Status: $org_name"
    echo "Location: $org_dir"
    echo ""

    # Check files
    echo "Input Files:"
    _check_file_status "digitalocean.json" "$json_file"
    _check_file_status "mapping.json" "$mapping_file"
    _check_file_status "resources.toml" "$resources_file" "(optional)"
    _check_file_status "secrets.env" "$secrets_file"

    echo ""
    echo "Output Files:"
    _check_file_status "tetra.toml" "$toml_file"

    echo ""

    # Check if refresh needed
    local needs_refresh=false
    local refresh_reason=""

    if [[ ! -f "$json_file" ]]; then
        needs_refresh=true
        refresh_reason="Missing digitalocean.json"
    elif [[ ! -f "$mapping_file" ]]; then
        needs_refresh=true
        refresh_reason="Missing mapping.json"
    elif [[ ! -f "$secrets_file" ]]; then
        needs_refresh=true
        refresh_reason="Missing secrets.env"
    elif [[ ! -f "$toml_file" ]]; then
        needs_refresh=true
        refresh_reason="Missing tetra.toml"
    else
        # Check if inputs are newer than output
        if [[ "$json_file" -nt "$toml_file" ]] || \
           [[ "$mapping_file" -nt "$toml_file" ]] || \
           [[ "$secrets_file" -nt "$toml_file" ]] || \
           [[ -f "$resources_file" && "$resources_file" -nt "$toml_file" ]]; then
            needs_refresh=true
            refresh_reason="Input files newer than tetra.toml"
        fi
    fi

    if [[ "$needs_refresh" == "true" ]]; then
        echo "⚠️  Refresh needed: $refresh_reason"
        echo "   Run: tetra org refresh $org_name"
    else
        echo "✅ Configuration up to date"
    fi

    echo ""
}

# Helper: Update infrastructure data
_refresh_infrastructure_data() {
    local source="$1"
    local dest="$2"
    local backup_dir="$3"

    if [[ ! -f "$source" ]]; then
        echo "❌ Source file not found: $source"
        return 1
    fi

    # Backup existing
    if [[ -f "$dest" ]]; then
        local backup_name="digitalocean.json.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$dest" "$backup_dir/$backup_name"
        echo "📦 Backed up existing: $backup_name"
    fi

    # Copy new
    cp "$source" "$dest"
    echo "✅ Updated: $(basename "$dest")"
}

# Helper: Refresh mapping (run discovery)
_refresh_mapping() {
    local org_name="$1"
    local json_file="$2"
    local mapping_file="$3"
    local backup_dir="$4"

    # Backup existing mapping
    if [[ -f "$mapping_file" ]]; then
        local backup_name="mapping.json.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$mapping_file" "$backup_dir/$backup_name"
        echo "📦 Backed up existing mapping: $backup_name"
    fi

    # Run discovery
    echo "🔍 Running infrastructure discovery..."
    local temp_mapping="/tmp/${org_name}_mapping_$(date +%s).json"

    tetra_discover_infrastructure "$json_file" "$org_name" "$temp_mapping" || {
        echo "❌ Discovery failed"
        return 1
    }

    # Move to org directory
    mv "$temp_mapping" "$mapping_file"
    echo "✅ Updated: $(basename "$mapping_file")"
}

# Helper: Show refresh summary
_show_refresh_summary() {
    local org_name="$1"
    local org_dir="$2"

    local toml_file="$org_dir/tetra.toml"
    local secrets_file="$org_dir/secrets.env"
    local backup_dir="$org_dir/backups"

    echo "📁 Organization: $org_name"
    echo "   Location: $org_dir"
    echo ""

    echo "📄 Configuration Files:"
    echo "   ✓ digitalocean.json - Infrastructure data"
    echo "   ✓ mapping.json - Environment mappings"
    [[ -f "$org_dir/resources.toml" ]] && echo "   ✓ resources.toml - File sync definitions"
    [[ -f "$secrets_file" ]] && echo "   ✓ secrets.env - Secrets (600 perms)"
    echo "   ✓ tetra.toml - Compiled configuration"
    echo ""

    echo "💾 Backups: $backup_dir"
    local backup_count
    backup_count=$(find "$backup_dir" -type f 2>/dev/null | wc -l | tr -d ' ')
    echo "   Total backups: $backup_count"
    echo ""

    echo "🔐 Security:"
    local git_ignored
    if git -C "$org_dir/.." check-ignore -q "*/secrets.env" "*/tetra.toml" 2>/dev/null; then
        git_ignored="✅"
    else
        git_ignored="⚠️ "
    fi
    echo "   $git_ignored Secrets files gitignored"
    echo ""

    echo "Next steps:"
    echo "  1. Review: cat $toml_file"
    echo "  2. Validate: tetra org validate $org_name"
    echo "  3. Deploy: tetra org deploy $org_name @dev"
    echo ""
}

# Helper: Check file status
_check_file_status() {
    local name="$1"
    local file="$2"
    local note="${3:-}"

    if [[ -f "$file" ]]; then
        local mtime size
        mtime=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null || stat -c "%y" "$file" 2>/dev/null | cut -d. -f1)
        size=$(stat -f "%z" "$file" 2>/dev/null || stat -c "%s" "$file" 2>/dev/null)
        printf "  ✅ %-20s (%s, %s bytes) %s\n" "$name" "$mtime" "$size" "$note"
    else
        printf "  ❌ %-20s (missing) %s\n" "$name" "$note"
    fi
}

# Export functions
export -f tetra_org_refresh
export -f tetra_org_quick_refresh
export -f tetra_org_refresh_status

# CLI interface
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-help}" in
        refresh)
            shift
            tetra_org_refresh "$@"
            ;;
        quick)
            shift
            tetra_org_quick_refresh "$@"
            ;;
        status)
            shift
            tetra_org_refresh_status "$@"
            ;;
        help|--help|-h)
            cat << EOF
Tetra Organization Refresh Workflow

USAGE:
    refresh.sh <command> [options]

COMMANDS:
    refresh <org_name> [json_source] [--rediscover]
        Full refresh workflow
        Updates infrastructure, mapping, and recompiles tetra.toml

    quick <org_name>
        Quick refresh (just recompile tetra.toml)
        Skips infrastructure and discovery updates

    status <org_name>
        Show refresh status and check if refresh needed

    help
        Show this help

OPTIONS:
    --rediscover    Force re-run of infrastructure discovery

EXAMPLES:
    # Full refresh with new infrastructure data
    refresh.sh refresh my-org ~/downloads/digitalocean.json

    # Full refresh, re-run discovery
    refresh.sh refresh my-org --rediscover

    # Quick recompile only
    refresh.sh quick my-org

    # Check status
    refresh.sh status my-org

WORKFLOW:
    [1/5] Update digitalocean.json (if source provided)
    [2/5] Regenerate mapping.json (if missing or --rediscover)
    [3/5] Validate secrets.env exists and is secure
    [4/5] Backup existing tetra.toml
    [5/5] Compile new tetra.toml from all inputs

SAFETY:
    - All changes create timestamped backups
    - Validates inputs before compilation
    - Checks secrets.env permissions (600)
    - Never overwrites without backup

FILES MANAGED:
    INPUT (can check into git):
      - digitalocean.json
      - mapping.json
      - resources.toml (optional)

    SECRETS (NEVER check into git):
      - secrets.env
      - tetra.toml (compiled output with secrets)

    BACKUPS:
      - backups/*.backup.YYYYMMDD_HHMMSS
EOF
            ;;
        *)
            echo "Unknown command: $1"
            echo "Use 'refresh.sh help' for usage information"
            exit 1
            ;;
    esac
fi
