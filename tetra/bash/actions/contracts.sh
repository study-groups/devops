#!/usr/bin/env bash
# TAS Contract Validation
# Implements semantic contract validation for TAS actions

# Global contract state
declare -g CONFIRMED=false
declare -g DRYRUN_MODE=false
declare -g AUTH_TOKEN=""
declare -g AUTH_USER=""

# Validate a single contract
# Usage: contract_validate contract_name
# Returns: 0 if valid, 1 if contract fails
contract_validate() {
    local contract="$1"

    if [[ -z "$contract" ]]; then
        echo "Error: contract_validate requires contract_name" >&2
        return 1
    fi

    case "$contract" in
        authenticated)
            contract_validate_authenticated
            ;;
        confirmed)
            contract_validate_confirmed
            ;;
        dryrun)
            contract_validate_dryrun
            ;;
        idempotent)
            contract_validate_idempotent
            ;;
        cached)
            contract_validate_cached
            ;;
        logged)
            contract_validate_logged
            ;;
        validated)
            contract_validate_validated
            ;;
        *)
            # Unknown contract - check if custom contract handler exists
            if declare -f "contract_validate_${contract}" &>/dev/null; then
                "contract_validate_${contract}"
            else
                echo "Warning: Unknown contract: $contract (skipping)" >&2
                return 0  # Don't fail on unknown contracts
            fi
            ;;
    esac
}

# Validate all contracts in array
# Usage: contract_validate_all contracts_array
# Returns: 0 if all valid, 1 if any fails
contract_validate_all() {
    local contracts=("$@")

    if [[ ${#contracts[@]} -eq 0 ]]; then
        return 0  # No contracts to validate
    fi

    for contract in "${contracts[@]}"; do
        if ! contract_validate "$contract"; then
            return 1
        fi
    done

    return 0
}

# Contract: authenticated
# Requires AUTH_TOKEN or AUTH_USER to be set
contract_validate_authenticated() {
    if [[ -z "$AUTH_TOKEN" && -z "$AUTH_USER" ]]; then
        echo "Error: Action requires authentication" >&2
        echo "Set AUTH_TOKEN or AUTH_USER environment variable" >&2
        return 1
    fi

    if [[ -n "$AUTH_TOKEN" ]]; then
        # Validate token format (basic check)
        if [[ ${#AUTH_TOKEN} -lt 10 ]]; then
            echo "Error: AUTH_TOKEN appears invalid (too short)" >&2
            return 1
        fi
    fi

    echo "✓ Authenticated as: ${AUTH_USER:-token}" >&2
    return 0
}

# Contract: confirmed
# Prompts user for confirmation
contract_validate_confirmed() {
    # Skip prompt if already confirmed (e.g., in batch mode)
    if $CONFIRMED; then
        echo "✓ Confirmation already provided" >&2
        return 0
    fi

    # Show what will be executed
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "CONFIRMATION REQUIRED" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

    if [[ -n "$TAS_MODULE" && -n "$TAS_ACTION" ]]; then
        echo "Action: /${TAS_MODULE}.${TAS_ACTION}:${TAS_NOUN}" >&2
    fi

    if [[ -n "$TAS_ENDPOINT" ]]; then
        echo "Endpoint: @${TAS_ENDPOINT}" >&2
    fi

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "" >&2

    # Prompt for confirmation
    read -p "Type 'yes' to proceed, anything else to cancel: " confirm

    if [[ "$confirm" == "yes" ]]; then
        CONFIRMED=true
        echo "✓ Confirmed" >&2
        return 0
    else
        echo "✗ Cancelled by user" >&2
        return 1
    fi
}

# Contract: dryrun
# Enables preview mode (no actual execution)
contract_validate_dryrun() {
    DRYRUN_MODE=true
    echo "✓ Dry-run mode enabled (preview only, no changes)" >&2
    return 0
}

# Contract: idempotent
# Just a marker - no validation needed
contract_validate_idempotent() {
    echo "✓ Action marked as idempotent (safe to retry)" >&2
    return 0
}

# Contract: cached
# Check if cache is available (implementation-specific)
contract_validate_cached() {
    # This is a marker contract - actual caching is implementation-specific
    echo "✓ Cached mode enabled (may return stale data)" >&2
    return 0
}

# Contract: logged
# Ensure audit logging is enabled
contract_validate_logged() {
    # Check if audit module is available
    if ! type audit_log &>/dev/null; then
        echo "Warning: Audit logging not available (contract::logged)" >&2
        # Don't fail - logging is advisory
    else
        echo "✓ Audit logging enabled" >&2
    fi
    return 0
}

# Contract: validated
# Marker for pre-validated data (e.g., schema validation passed)
contract_validate_validated() {
    echo "✓ Data pre-validated" >&2
    return 0
}

# Check if in dryrun mode
# Usage: is_dryrun
# Returns: 0 if dryrun, 1 if not
is_dryrun() {
    $DRYRUN_MODE
}

# Check if confirmed
# Usage: is_confirmed
# Returns: 0 if confirmed, 1 if not
is_confirmed() {
    $CONFIRMED
}

# Reset contract state (for new action)
# Usage: contract_reset
contract_reset() {
    CONFIRMED=false
    DRYRUN_MODE=false
    # Note: AUTH_TOKEN and AUTH_USER persist across actions
}

# Set confirmation (for batch mode)
# Usage: contract_set_confirmed
contract_set_confirmed() {
    CONFIRMED=true
}

# Set authentication
# Usage: contract_set_auth token [user]
contract_set_auth() {
    local token="$1"
    local user="${2:-}"

    AUTH_TOKEN="$token"
    if [[ -n "$user" ]]; then
        AUTH_USER="$user"
    fi
}

# Clear authentication
# Usage: contract_clear_auth
contract_clear_auth() {
    AUTH_TOKEN=""
    AUTH_USER=""
}

# Get contract status as JSON
# Usage: contract_status
# Returns: JSON with contract state
contract_status() {
    cat <<EOF
{
    "confirmed": $CONFIRMED,
    "dryrun_mode": $DRYRUN_MODE,
    "authenticated": $([ -n "$AUTH_TOKEN" ] || [ -n "$AUTH_USER" ] && echo "true" || echo "false"),
    "auth_user": "${AUTH_USER}"
}
EOF
}

# Register custom contract validator
# Usage: contract_register contract_name validator_function
contract_register() {
    local contract_name="$1"
    local validator_fn="$2"

    if [[ -z "$contract_name" || -z "$validator_fn" ]]; then
        echo "Error: contract_register requires contract_name and validator_function" >&2
        return 1
    fi

    if ! declare -f "$validator_fn" &>/dev/null; then
        echo "Error: Validator function not found: $validator_fn" >&2
        return 1
    fi

    # Create alias function
    eval "contract_validate_${contract_name}() { $validator_fn \"\$@\"; }"

    echo "Registered custom contract: $contract_name → $validator_fn" >&2
}

# List all available contracts
# Usage: contract_list
contract_list() {
    cat <<EOF
Standard Contracts:
  ::authenticated   Requires authentication (AUTH_TOKEN or AUTH_USER)
  ::confirmed       Prompts user for confirmation before execution
  ::dryrun          Preview mode - no actual execution
  ::idempotent      Marks action as safe to retry
  ::cached          May return cached/stale data
  ::logged          Ensures audit logging is enabled
  ::validated       Data pre-validated (e.g., schema check passed)

Custom Contracts:
EOF

    # List custom contract validators
    declare -F | grep "^declare -f contract_validate_" | sed 's/declare -f contract_validate_/  ::/' | grep -v -E "::(authenticated|confirmed|dryrun|idempotent|cached|logged|validated)$" || echo "  (none registered)"
}

# Help text for a specific contract
# Usage: contract_help contract_name
contract_help() {
    local contract="$1"

    case "$contract" in
        authenticated)
            cat <<EOF
Contract: ::authenticated

Requires authentication context before executing action.

Environment Variables:
  - AUTH_TOKEN: Authentication token (minimum 10 characters)
  - AUTH_USER: Authenticated user name

Example:
  export AUTH_TOKEN="your_token_here"
  /query::authenticated:data @prod

Failure:
  Action will not execute if AUTH_TOKEN or AUTH_USER is not set.
EOF
            ;;
        confirmed)
            cat <<EOF
Contract: ::confirmed

Prompts user for explicit confirmation before executing action.

User must type 'yes' exactly to proceed. Any other input cancels.

Example:
  /delete::confirmed:database @prod

Use Case:
  Prevents accidental execution of destructive operations.

Batch Mode:
  Call contract_set_confirmed to skip prompt in scripts.
EOF
            ;;
        dryrun)
            cat <<EOF
Contract: ::dryrun

Enables preview mode - shows what would happen without executing.

Action implementation should check is_dryrun and only perform
validation/planning without making actual changes.

Example:
  /deploy::dryrun:config @prod

Use Case:
  Test commands safely before running for real.
EOF
            ;;
        idempotent)
            cat <<EOF
Contract: ::idempotent

Marks action as safe to retry.

Action produces same result when called multiple times with same input.
Enables automatic retry on transient failures.

Example:
  /sync::idempotent:files @staging

Use Case:
  Safe operations that can be retried without side effects.
EOF
            ;;
        cached)
            cat <<EOF
Contract: ::cached

May return cached data instead of fresh query.

Action can check is_cached and skip expensive operations if cache valid.
Faster but potentially stale data.

Example:
  /query::cached:metrics @monitoring

Use Case:
  Performance optimization for expensive queries.
EOF
            ;;
        *)
            echo "No help available for contract: $contract"
            echo "Run 'contract_list' to see all contracts."
            ;;
    esac
}

# Export globals
export CONFIRMED
export DRYRUN_MODE
export AUTH_TOKEN
export AUTH_USER

# Export functions
export -f contract_validate
export -f contract_validate_all
export -f contract_validate_authenticated
export -f contract_validate_confirmed
export -f contract_validate_dryrun
export -f contract_validate_idempotent
export -f contract_validate_cached
export -f contract_validate_logged
export -f contract_validate_validated
export -f is_dryrun
export -f is_confirmed
export -f contract_reset
export -f contract_set_confirmed
export -f contract_set_auth
export -f contract_clear_auth
export -f contract_status
export -f contract_register
export -f contract_list
export -f contract_help
