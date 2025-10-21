#!/usr/bin/env bash
# TTM - Tetra Transaction Manager
# Main entry point for TTS-compliant transaction management

# TTM Module Environment Variables with proper override guards
: "${TETRA_SRC:=~/tetra}"
: "${TTM_SRC:=$TETRA_SRC/bash/ttm}"
: "${TTM_DIR:=$TETRA_DIR/ttm}"

# TTM Directory Convention under TETRA_DIR
TTM_TXNS_DIR="${TTM_DIR}/txns"
TTM_CONFIG_DIR="${TTM_DIR}/config"
TTM_LOGS_DIR="${TTM_DIR}/logs"

# TTM Module Management
TTM_MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source TTM modules
source "$TTM_MODULE_DIR/txn.sh"
source "$TTM_MODULE_DIR/ctx.sh"
source "$TTM_MODULE_DIR/query.sh"
source "$TTM_MODULE_DIR/tes.sh"
source "$TTM_MODULE_DIR/events.sh"

# Initialize TTM environment
ttm_init() {
    # Validate TETRA_DIR first
    if [[ -z "$TETRA_DIR" ]]; then
        echo "❌ Error: TETRA_DIR environment variable not set" >&2
        return 1
    fi

    # Create necessary directories
    mkdir -p "$TTM_TXNS_DIR" "$TTM_CONFIG_DIR" "$TTM_LOGS_DIR"

    return 0
}

# Main ttm command interface
ttm() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        cat <<'EOF'
Usage: ttm <command> [args]

Transaction Lifecycle:
  create "<desc>" [@target] [agent]   Create new transaction
  commit [txn_id]                      Commit transaction (transition to DONE)
  fail [txn_id] "<error>"             Fail transaction (transition to FAIL)
  transition <stage> [txn_id]          Transition to new stage

Context Management:
  add <file> <desc> [txn_id]          Add context/evidence file
  list-ctx [txn_id]                    List context files
  init-vars [txn_id]                   Initialize evidence variables ($e1, $e2, etc.)

Query:
  active                               Get active transaction ID
  status [txn_id]                      Show transaction status
  list [stage]                         List all transactions (optionally filtered by stage)
  state [txn_id]                       Get transaction state (JSON)
  events [txn_id] [event_type]        Get transaction events

TES Integration:
  resolve [txn_id]                     Resolve TES endpoint for transaction target

Examples:
  ttm create "deploy api v2.1" @staging human
  ttm add build/api.tar.gz "artifact"
  ttm transition EXECUTE
  ttm resolve
  ttm commit
EOF
        return 0
    fi

    # Initialize if not already done
    ttm_init || return 1

    shift || true

    case "$action" in
        "create")
            txn_create "$@"
            ;;
        "commit")
            txn_commit "$@"
            ;;
        "fail")
            txn_fail "$@"
            ;;
        "transition")
            txn_transition "$@"
            ;;
        "add")
            txn_add_ctx "$@"
            ;;
        "list-ctx")
            txn_list_ctx "$@"
            ;;
        "init-vars")
            init_evidence_vars "$@"
            ;;
        "active")
            txn_active
            ;;
        "status")
            txn_status "$@"
            ;;
        "list")
            txn_list "$@"
            ;;
        "state")
            txn_state "$@"
            ;;
        "events")
            txn_events "$@"
            ;;
        "resolve")
            txn_resolve_tes "$@"
            ;;
        "help"|"h")
            ttm
            ;;
        *)
            echo "Unknown command: $action" >&2
            echo "Use 'ttm help' for available commands" >&2
            return 1
            ;;
    esac
}

# Export essential module variables
export TTM_SRC TTM_DIR TTM_TXNS_DIR
