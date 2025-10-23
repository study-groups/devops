#!/usr/bin/env bash

# TES-Compliant Org Push
# Push organization configuration to remote environments using TES v2.1 resolution

# Requires:
# - tes_resolve.sh
# - Unified logging (tetra_log)

# Push organization TOML to environment
org_push_tes() {
    local env="$1"
    local org_name="${2:-}"
    local force="${3:-false}"

    # Auto-detect org if not specified
    if [[ -z "$org_name" ]]; then
        source "$TETRA_SRC/bash/org/tetra_org.sh"
        org_name=$(org_active)
        if [[ "$org_name" == "none" ]]; then
            echo "Error: No active organization. Specify org name or switch to one." >&2
            return 1
        fi
    fi

    # Validate environment
    case "$env" in
        dev|staging|prod) ;;
        *)
            echo "Error: Invalid environment '$env'. Must be: dev, staging, prod" >&2
            echo "Usage: org_push_tes <env> [org_name]" >&2
            return 1
            ;;
    esac

    local symbol="@${env}"
    local org_dir="$TETRA_DIR/org/${org_name}"
    local org_toml="${org_dir}/tetra.toml"
    local remote_path="~/tetra/org/${org_name}/tetra.toml"

    # Validate local TOML exists
    if [[ ! -f "$org_toml" ]]; then
        echo "Error: Organization TOML not found: $org_toml" >&2
        return 1
    fi

    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  TES-COMPLIANT ORG PUSH"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Organization: $org_name"
    echo "Environment:  $env"
    echo "Symbol:       $symbol"
    echo ""

    # Source TES resolution helpers
    source "$TETRA_SRC/bash/org/tes_resolve.sh"

    # Progressive resolution
    echo "TES Resolution:"
    echo ""

    # Level 0 → 1: Symbol to Address
    local address
    address=$(tes_resolve_symbol "$symbol" "$org_toml")
    if [[ $? -ne 0 ]]; then
        echo "✗ Symbol resolution failed" >&2
        return 1
    fi
    echo "  Level 0 (Symbol):    $symbol"
    echo "  Level 1 (Address):   $address"

    # Level 1 → 2: Address to Channel
    local channel
    channel=$(tes_resolve_channel "$symbol" "$org_toml")
    if [[ $? -ne 0 ]]; then
        echo "✗ Channel resolution failed" >&2
        return 1
    fi
    echo "  Level 2 (Channel):   $channel"

    # Level 2 → 3: Channel to Connector
    local connector
    connector=$(tes_resolve_connector "$symbol" "$org_toml")
    if [[ $? -ne 0 ]]; then
        echo "✗ Connector resolution failed" >&2
        return 1
    fi
    echo "  Level 3 (Connector): ${connector%% -i*}... -i <key>"

    # Level 3 → 4: Connector to Handle (validate)
    echo ""
    echo "Validating SSH connection..."
    if ! tes_validate_connector "$symbol" "$org_toml" 5 >/dev/null 2>&1; then
        echo "✗ SSH validation failed" >&2
        echo ""
        echo "Troubleshooting:"
        echo "  1. Check SSH key: ${connector##* -i }"
        echo "  2. Verify host reachable: ping $address"
        echo "  3. Test manual SSH: ssh ${connector%% -i*}"
        return 1
    fi
    echo "  Level 4 (Handle):    ✓ SSH connection validated"

    # Level 4 → 5: Handle to Locator
    local locator
    locator=$(tes_resolve_locator "$symbol" "$remote_path" "$org_toml")
    echo "  Level 5 (Locator):   $locator"

    # Level 5 → 6: Locator to Binding
    echo "  Level 6 (Binding):   write($locator)"

    # Level 6 → 7: Binding to Plan (executable command)
    echo ""
    echo "Generating execution plan..."
    local plan
    plan=$(tes_create_plan "write" "$symbol" "$org_toml" "$remote_path" "$org_toml")
    echo "  Level 7 (Plan):      Generated"

    # Show plan
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  EXECUTION PLAN"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "$plan" | sed 's/^/  /'
    echo ""

    # Confirm execution
    if [[ "$force" != "true" ]]; then
        echo -n "Execute plan? [Y/n]: "
        read -r response
        if [[ "$response" =~ ^[Nn] ]]; then
            echo "Push cancelled"
            return 0
        fi
    fi

    # Execute plan
    echo ""
    echo "Executing..."

    # Portable millisecond timing (works on Linux and macOS)
    local start_time
    local test_ms=$(date +%s%3N 2>/dev/null)
    if [[ ! "$test_ms" =~ N ]]; then
        # Linux: native milliseconds
        start_time=$(date +%s%3N)
    else
        # macOS: use Python for milliseconds
        start_time=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || echo "$(date +%s)000")
    fi

    if eval "$plan"; then
        local end_time
        local test_ms=$(date +%s%3N 2>/dev/null)
        if [[ ! "$test_ms" =~ N ]]; then
            end_time=$(date +%s%3N)
        else
            end_time=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || echo "$(date +%s)000")
        fi
        local duration=$((end_time - start_time))
        echo ""
        echo "✓ Push successful (${duration}ms)"

        # Create deployment record
        local deployment_dir="${org_dir}/deployed"
        mkdir -p "$deployment_dir"
        local deployment_file="${deployment_dir}/${env}.deployment.toml"

        cat > "$deployment_file" << EOF
# Deployment Record
# Organization: ${org_name}
# Environment:  ${env}

[metadata]
timestamp = "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
environment = "${env}"
symbol = "${symbol}"
deployed_by = "$(whoami)"
hostname = "$(hostname)"
duration_ms = ${duration}

[tes_resolution]
symbol = "${symbol}"
address = "${address}"
channel = "${channel}"
connector = "${connector%% -i*}"
locator = "${locator}"

[status]
state = "deployed"
validated = true
EOF

        echo "  Deployment record: $deployment_file"

        # Unified logging
        if declare -f tetra_log >/dev/null 2>&1; then
            tetra_log org push "${env}" success \
                "{\"org\":\"${org_name}\",\"symbol\":\"${symbol}\",\"host\":\"${address}\",\"duration_ms\":${duration}}"
        fi

        return 0
    else
        local end_time
        local test_ms=$(date +%s%3N 2>/dev/null)
        if [[ ! "$test_ms" =~ N ]]; then
            end_time=$(date +%s%3N)
        else
            end_time=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || echo "$(date +%s)000")
        fi
        local duration=$((end_time - start_time))
        echo ""
        echo "✗ Push failed (${duration}ms)" >&2

        # Unified logging
        if declare -f tetra_log >/dev/null 2>&1; then
            tetra_log org push "${env}" fail \
                "{\"org\":\"${org_name}\",\"symbol\":\"${symbol}\",\"host\":\"${address}\",\"duration_ms\":${duration}}"
        fi

        return 1
    fi
}

# Pull organization TOML from environment
org_pull_tes() {
    local env="$1"
    local org_name="${2:-}"

    # Auto-detect org if not specified
    if [[ -z "$org_name" ]]; then
        source "$TETRA_SRC/bash/org/tetra_org.sh"
        org_name=$(org_active)
        if [[ "$org_name" == "none" ]]; then
            echo "Error: No active organization" >&2
            return 1
        fi
    fi

    # Validate environment
    case "$env" in
        dev|staging|prod) ;;
        *)
            echo "Error: Invalid environment '$env'" >&2
            return 1
            ;;
    esac

    local symbol="@${env}"
    local org_dir="$TETRA_DIR/org/${org_name}"
    local org_toml="${org_dir}/tetra.toml"
    local remote_path="~/tetra/org/${org_name}/tetra.toml"
    local backup_file="${org_toml}.backup.$(date +%s)"

    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  TES-COMPLIANT ORG PULL"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Organization: $org_name"
    echo "Environment:  $env"
    echo "Symbol:       $symbol"
    echo ""

    # Source TES resolution helpers
    source "$TETRA_SRC/bash/org/tes_resolve.sh"

    # Validate connector
    echo "Validating SSH connection..."
    if ! tes_validate_connector "$symbol" "$org_toml" 5 >/dev/null 2>&1; then
        echo "✗ SSH validation failed" >&2
        return 1
    fi
    echo "✓ Connection validated"
    echo ""

    # Create backup of local TOML
    if [[ -f "$org_toml" ]]; then
        cp "$org_toml" "$backup_file"
        echo "📦 Backup created: $backup_file"
    fi

    # Generate pull plan
    local plan
    plan=$(tes_create_plan "read" "$symbol" "$org_toml" "$remote_path" "$org_toml")

    echo ""
    echo "Pulling..."
    if eval "$plan"; then
        echo ""
        echo "✓ Pull successful"
        echo "  Updated: $org_toml"

        # Unified logging
        if declare -f tetra_log >/dev/null 2>&1; then
            tetra_log org pull "${env}" success "{\"org\":\"${org_name}\",\"symbol\":\"${symbol}\"}"
        fi

        return 0
    else
        echo ""
        echo "✗ Pull failed" >&2

        # Restore backup
        if [[ -f "$backup_file" ]]; then
            cp "$backup_file" "$org_toml"
            echo "📦 Restored from backup"
        fi

        if declare -f tetra_log >/dev/null 2>&1; then
            tetra_log org pull "${env}" fail "{\"org\":\"${org_name}\",\"symbol\":\"${symbol}\"}"
        fi

        return 1
    fi
}

# Show push status for all environments
org_push_status() {
    local org_name="${1:-}"

    if [[ -z "$org_name" ]]; then
        source "$TETRA_SRC/bash/org/tetra_org.sh"
        org_name=$(org_active)
        if [[ "$org_name" == "none" ]]; then
            echo "Error: No active organization" >&2
            return 1
        fi
    fi

    local org_dir="$TETRA_DIR/org/${org_name}"
    local deployment_dir="${org_dir}/deployed"

    echo ""
    echo "Deployment Status: $org_name"
    echo ""

    for env in dev staging prod; do
        local deployment_file="${deployment_dir}/${env}.deployment.toml"

        if [[ -f "$deployment_file" ]]; then
            local timestamp state
            timestamp=$(grep '^timestamp' "$deployment_file" | cut -d'"' -f2)
            state=$(grep '^state' "$deployment_file" | cut -d'"' -f2)

            echo "  @${env}: ✓ ${state} (${timestamp})"
        else
            echo "  @${env}: ✗ not deployed"
        fi
    done

    echo ""
}

# Export functions
export -f org_push_tes
export -f org_pull_tes
export -f org_push_status
