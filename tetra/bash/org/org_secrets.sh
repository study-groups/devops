#!/usr/bin/env bash
# org_secrets.sh - Manage organization secrets
#
# Syncs credentials from ~/nh/<org>/*.env to $TETRA_DIR/orgs/<org>/secrets.env
# Single source of truth: secrets.env in the tetra org
#
# Usage:
#   org secrets sync [org]    Sync credentials from nh
#   org secrets edit [org]    Edit secrets.env
#   org secrets list [org]    Show available secrets
#   org secrets path [org]    Show secrets.env path

# =============================================================================
# SECRETS FUNCTIONS
# =============================================================================

# Get secrets.env path for org
_org_secrets_path() {
    local org="${1:-$(org_active 2>/dev/null)}"
    [[ "$org" == "$ORG_NO_ACTIVE" || -z "$org" ]] && return 1
    echo "$TETRA_DIR/orgs/$org/secrets.env"
}

# List secrets (keys only, no values)
_org_secrets_list() {
    local org="${1:-$(org_active 2>/dev/null)}"
    [[ "$org" == "$ORG_NO_ACTIVE" || -z "$org" ]] && { echo "No active org" >&2; return 1; }

    local secrets_file="$TETRA_DIR/orgs/$org/secrets.env"

    echo "Secrets: $org"
    echo "File: $secrets_file"
    echo ""

    if [[ -f "$secrets_file" ]]; then
        echo "Keys:"
        grep -E '^export [A-Z_]+=' "$secrets_file" 2>/dev/null | \
            sed 's/^export /  /' | \
            sed 's/=.*//' || echo "  (none)"
    else
        echo "(secrets.env not found)"
        echo ""
        echo "Create with: org secrets sync $org"
    fi
}

# Edit secrets.env
_org_secrets_edit() {
    local org="${1:-$(org_active 2>/dev/null)}"
    [[ "$org" == "$ORG_NO_ACTIVE" || -z "$org" ]] && { echo "No active org" >&2; return 1; }

    local secrets_file="$TETRA_DIR/orgs/$org/secrets.env"

    if [[ ! -f "$secrets_file" ]]; then
        echo "Creating: $secrets_file"
        mkdir -p "$(dirname "$secrets_file")"
        cat > "$secrets_file" << EOF
# Secrets for $org
# Synced from: ~/nh/$org/*.env
# Created: $(date -Iseconds)
#
# DO NOT commit this file to git
# Regenerate with: org secrets sync $org

EOF
    fi

    ${EDITOR:-vim} "$secrets_file"
}

# Sync secrets from nh to tetra org
_org_secrets_sync() {
    local org="${1:-$(org_active 2>/dev/null)}"
    [[ "$org" == "$ORG_NO_ACTIVE" || -z "$org" ]] && { echo "No active org" >&2; return 1; }

    local nh_dir="${NH_DIR:-$HOME/nh}/$org"
    local secrets_file="$TETRA_DIR/orgs/$org/secrets.env"

    echo "Secrets Sync: $org"
    echo ""
    echo "Source: $nh_dir"
    echo "Target: $secrets_file"
    echo ""

    if [[ ! -d "$nh_dir" ]]; then
        echo "Error: NH directory not found: $nh_dir" >&2
        return 1
    fi

    # Find all .env files in nh org directory
    local env_files=()
    while IFS= read -r -d '' f; do
        env_files+=("$f")
    done < <(find "$nh_dir" -maxdepth 1 -name "*.env" -type f -print0 2>/dev/null)

    if [[ ${#env_files[@]} -eq 0 ]]; then
        echo "No .env files found in $nh_dir"
        return 1
    fi

    echo "Found ${#env_files[@]} credential files:"
    for f in "${env_files[@]}"; do
        local name=$(basename "$f")
        local keys
        keys=$(grep -cE '^export [A-Z_]+=' "$f" 2>/dev/null) || keys=0
        printf "  %-25s %d keys\n" "$name" "$keys"
    done
    echo ""

    # Create backup if exists
    if [[ -f "$secrets_file" ]]; then
        cp "$secrets_file" "$secrets_file.bak"
        echo "Backed up: $secrets_file.bak"
    fi

    # Generate new secrets.env
    mkdir -p "$(dirname "$secrets_file")"
    cat > "$secrets_file" << EOF
# Secrets for $org
# Auto-synced from: $nh_dir
# Generated: $(date -Iseconds)
#
# DO NOT commit this file to git
# Regenerate with: org secrets sync $org

EOF

    # Append each .env file
    for f in "${env_files[@]}"; do
        local name=$(basename "$f")
        echo "" >> "$secrets_file"
        echo "# --- $name ---" >> "$secrets_file"
        # Copy only export lines, skip comments and empty lines
        grep -E '^export [A-Z_]+=' "$f" >> "$secrets_file" 2>/dev/null || true
    done

    echo ""
    echo "Synced to: $secrets_file"
    echo ""

    # Show summary
    local total_keys=$(grep -cE '^export [A-Z_]+=' "$secrets_file" 2>/dev/null || echo 0)
    echo "Total keys: $total_keys"
}

# Show status
_org_secrets_status() {
    local org="${1:-$(org_active 2>/dev/null)}"
    [[ "$org" == "$ORG_NO_ACTIVE" || -z "$org" ]] && { echo "No active org" >&2; return 1; }

    local nh_dir="${NH_DIR:-$HOME/nh}/$org"
    local secrets_file="$TETRA_DIR/orgs/$org/secrets.env"

    echo "Secrets Status: $org"
    echo ""

    # Check nh source
    if [[ -d "$nh_dir" ]]; then
        local nh_files=$(find "$nh_dir" -maxdepth 1 -name "*.env" -type f 2>/dev/null | wc -l | tr -d ' ')
        echo "NH Source: $nh_dir ($nh_files .env files)"
    else
        echo "NH Source: not found ($nh_dir)"
    fi

    # Check tetra secrets
    if [[ -f "$secrets_file" ]]; then
        local age_days=0
        local mtime
        if stat -f %m "$secrets_file" >/dev/null 2>&1; then
            mtime=$(stat -f %m "$secrets_file")
        else
            mtime=$(stat -c %Y "$secrets_file")
        fi
        local now=$(date +%s)
        age_days=$(( (now - mtime) / 86400 ))

        local key_count=$(grep -cE '^export [A-Z_]+=' "$secrets_file" 2>/dev/null || echo 0)
        echo "Secrets:   $secrets_file ($key_count keys, ${age_days}d old)"
    else
        echo "Secrets:   not synced"
        echo ""
        echo "Run: org secrets sync $org"
    fi
}

# Main dispatcher
org_secrets() {
    local subcmd="${1:-status}"
    shift 2>/dev/null || true

    case "$subcmd" in
        sync|s)
            _org_secrets_sync "$@"
            ;;
        edit|e)
            _org_secrets_edit "$@"
            ;;
        list|ls|l)
            _org_secrets_list "$@"
            ;;
        path|p)
            _org_secrets_path "$@"
            ;;
        status|"")
            _org_secrets_status "$@"
            ;;
        help|h)
            echo "org secrets - Manage organization secrets"
            echo ""
            echo "Usage:"
            echo "  org secrets [status]    Show secrets status"
            echo "  org secrets sync [org]  Sync from ~/nh/<org>/*.env"
            echo "  org secrets list [org]  List secret keys (not values)"
            echo "  org secrets edit [org]  Edit secrets.env"
            echo "  org secrets path [org]  Show secrets.env path"
            echo ""
            echo "The secrets.env file is sourced by:"
            echo "  - tsm build (resolves \$VAR in [secrets] section)"
            echo "  - deploy push (template variable expansion)"
            echo "  - cf-dns, s3, and other credential-using commands"
            ;;
        *)
            echo "Unknown secrets command: $subcmd" >&2
            echo "Try: org secrets help" >&2
            return 1
            ;;
    esac
}

# Export functions
export -f org_secrets _org_secrets_path _org_secrets_list _org_secrets_edit _org_secrets_sync _org_secrets_status
