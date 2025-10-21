#!/usr/bin/env bash
# Example: Deploy using TTM
# Demonstrates complete TTM transaction lifecycle

set -e

# Source TTM
: "${TETRA_SRC:=~/tetra}"
source "$TETRA_SRC/bash/ttm/ttm.sh"

# Initialize TTM
ttm_init

# Deploy function
deploy() {
    local target="${1:?Target required (e.g., @staging)}"
    local artifact="${2:?Artifact required (e.g., build/app.tar.gz)}"

    echo "=== Starting Deployment ==="
    echo "Target: $target"
    echo "Artifact: $artifact"
    echo ""

    # 1. Create transaction
    echo "Step 1: Creating transaction..."
    local txn_id=$(txn_create "deploy to $target" "$target" "human")
    echo "Transaction created: $txn_id"
    echo ""

    # 2. Add context (SELECT stage)
    echo "Step 2: Adding context..."
    txn_transition "SELECT" "$txn_id"

    if [[ -f "$artifact" ]]; then
        txn_add_ctx "$artifact" "artifact" "$txn_id"
    else
        echo "Warning: Artifact not found: $artifact (using placeholder)"
        echo "placeholder artifact" > /tmp/deploy-artifact.txt
        txn_add_ctx /tmp/deploy-artifact.txt "artifact" "$txn_id"
    fi

    # Add deployment config if exists
    local config_file="deploy/${target#@}.yaml"
    if [[ -f "$config_file" ]]; then
        txn_add_ctx "$config_file" "config" "$txn_id"
    fi

    echo "Context added"
    echo ""

    # 3. Assemble (resolve TES)
    echo "Step 3: Resolving target endpoint..."
    txn_transition "ASSEMBLE" "$txn_id"
    txn_resolve_tes "$txn_id"

    local plan=$(txn_state "$txn_id" | jq -r '.tes_plan')
    echo "Resolved: $target → $plan"
    echo ""

    # 4. Execute
    echo "Step 4: Executing deployment..."
    txn_transition "EXECUTE" "$txn_id"

    # Initialize evidence variables
    init_evidence_vars "$txn_id"

    # Simulate deployment steps
    echo "  - Uploading artifact..."
    # In real deployment: scp "$e1" "$plan:/opt/app/artifact.tar.gz"
    echo "    Artifact: $e1"

    echo "  - Extracting on remote..."
    # In real deployment: ssh "$plan" "cd /opt/app && tar xzf artifact.tar.gz"

    echo "  - Restarting service..."
    # In real deployment: ssh "$plan" "systemctl restart app"

    echo "Deployment executed"
    echo ""

    # 5. Validate
    echo "Step 5: Validating deployment..."
    txn_transition "VALIDATE" "$txn_id"

    # Simulate health check
    local health_url="https://${target#@}.example.com/health"
    echo "  - Checking health endpoint: $health_url"
    # In real deployment: curl -f "$health_url" || txn_fail "$txn_id" "Health check failed"

    echo "Validation passed"
    echo ""

    # 6. Commit
    echo "Step 6: Committing transaction..."
    txn_commit "$txn_id"
    echo ""

    echo "=== Deployment Complete ==="
    echo "Transaction: $txn_id"
    echo "Status: $(txn_state "$txn_id" | jq -r '.stage')"
    echo ""

    # Show transaction status
    txn_status "$txn_id"
}

# Rollback function (example of failure handling)
rollback() {
    local txn_id="${1:?Transaction ID required}"

    echo "=== Rolling Back Deployment ==="

    # Mark transaction as failed
    txn_fail "$txn_id" "Rollback requested by user"

    # Perform rollback steps
    echo "Rollback steps would go here..."

    echo "Rollback complete"
}

# Main entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        "deploy")
            shift
            deploy "$@"
            ;;
        "rollback")
            shift
            rollback "$@"
            ;;
        *)
            cat <<'EOF'
Usage: deploy.sh <command> [args]

Commands:
  deploy <target> <artifact>    Deploy artifact to target
  rollback <txn_id>             Rollback deployment

Examples:
  deploy.sh deploy @staging build/app-v2.1.0.tar.gz
  deploy.sh rollback deploy-to-staging-20251017T143022

Targets:
  @local      Local deployment
  @dev        Development environment
  @staging    Staging environment
  @prod       Production environment
EOF
            ;;
    esac
fi
