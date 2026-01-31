#!/usr/bin/env bash
# agents.sh - Agent Registry & Cost Tracking
#
# Centralizes API key management, per-call ledger logging,
# budget enforcement, and local backup for tetra agents.
#
# Data:
#   $TETRA_DIR/agents/agents.json  — registry
#   $TETRA_DIR/ledger/ledger.ndjson — append-only log (via ledger.sh)

: "${AGENTS_DIR:=$TETRA_DIR/agents}"

# =============================================================================
# INIT
# =============================================================================

_agent_init() {
    mkdir -p "$AGENTS_DIR"
    if [[ ! -f "$AGENTS_DIR/agents.json" ]]; then
        _agent_seed_defaults
    fi
}

_agent_seed_defaults() {
    local qa_model="chatgpt-4o-latest"
    # Read current engine from qa config if available
    if [[ -f "$TETRA_DIR/qa/engine" ]]; then
        qa_model=$(cat "$TETRA_DIR/qa/engine")
    fi

    cat > "$AGENTS_DIR/agents.json" <<EOF
{
  "qa": {
    "provider": "openai",
    "model": "$qa_model",
    "data_dir": "$TETRA_DIR/qa",
    "budget": { "daily_usd": 5.0, "total_usd": 100.0 }
  },
  "vox": {
    "provider": "openai",
    "model": "tts-1",
    "data_dir": "$TETRA_DIR/vox",
    "budget": { "daily_usd": 2.0, "total_usd": 50.0 }
  }
}
EOF
}

# =============================================================================
# REGISTRY LOOKUPS
# =============================================================================

# Usage: _agent_get <agent> <field>
# Fields: provider, model, data_dir, budget.daily_usd, budget.total_usd
_agent_get() {
    local agent="$1"
    local field="$2"
    _agent_init
    jq -r --arg a "$agent" --arg f "$field" \
        '.[$a] | getpath($f | split(".")) // empty' \
        "$AGENTS_DIR/agents.json" 2>/dev/null
}

_agent_exists() {
    local agent="$1"
    _agent_init
    jq -e --arg a "$agent" 'has($a)' "$AGENTS_DIR/agents.json" &>/dev/null
}

# =============================================================================
# API KEY RESOLUTION
# =============================================================================

# Centralized key lookup by provider
# Usage: _agent_get_api_key <provider>
_agent_get_api_key() {
    local provider="$1"

    case "$provider" in
        openai)
            if [[ -n "${OPENAI_API_KEY:-}" ]]; then
                echo "$OPENAI_API_KEY"
                return 0
            fi
            local keyfile="${QA_DIR:-$TETRA_DIR/qa}/api_key"
            if [[ -f "$keyfile" ]]; then
                cat "$keyfile"
                return 0
            fi
            ;;
        anthropic)
            if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
                echo "$ANTHROPIC_API_KEY"
                return 0
            fi
            local keyfile="$AGENTS_DIR/anthropic_key"
            if [[ -f "$keyfile" ]]; then
                cat "$keyfile"
                return 0
            fi
            ;;
    esac
    return 1
}

# =============================================================================
# LOGGING
# =============================================================================

# Log an API call for an agent, resolving model from registry
# Usage: _agent_log <agent> <input_tokens> <output_tokens> [run_id]
_agent_log() {
    local agent="$1"
    local input_tokens="$2"
    local output_tokens="$3"
    local run_id="${4:-}"

    _agent_init

    local model
    model=$(_agent_get "$agent" "model")
    [[ -z "$model" ]] && return 1

    # Ensure ledger functions are available
    if ! declare -f _ledger_log &>/dev/null; then
        source "$TETRA_SRC/bash/utils/ledger.sh" 2>/dev/null || return 1
    fi

    _ledger_log "$agent" "$model" "$input_tokens" "$output_tokens" "$agent" "$run_id"

    # Check budget after logging
    _agent_check_budget "$agent"
}

# =============================================================================
# BUDGET
# =============================================================================

# Check if agent is within budget, warn if exceeded
# Usage: _agent_check_budget <agent>
_agent_check_budget() {
    local agent="$1"

    local daily_limit total_limit
    daily_limit=$(_agent_get "$agent" "budget.daily_usd")
    total_limit=$(_agent_get "$agent" "budget.total_usd")

    [[ -z "$daily_limit" || -z "$total_limit" ]] && return 0

    local daily_spend total_spend
    daily_spend=$(_agent_get_spending "$agent" "day")
    total_spend=$(_agent_get_spending "$agent" "total")

    # Compare with awk (floating point)
    local daily_over total_over
    daily_over=$(awk -v s="$daily_spend" -v l="$daily_limit" 'BEGIN { print (s > l) ? 1 : 0 }')
    total_over=$(awk -v s="$total_spend" -v l="$total_limit" 'BEGIN { print (s > l) ? 1 : 0 }')

    if [[ "$total_over" == "1" ]]; then
        echo "WARNING: Agent '$agent' total budget exceeded: \$$total_spend / \$$total_limit" >&2
        return 1
    fi
    if [[ "$daily_over" == "1" ]]; then
        echo "WARNING: Agent '$agent' daily budget exceeded: \$$daily_spend / \$$daily_limit" >&2
        return 1
    fi
    return 0
}

# Sum spending from ledger for an agent
# Usage: _agent_get_spending <agent> <period>  (period: day, week, total)
_agent_get_spending() {
    local agent="$1"
    local period="${2:-total}"

    local ledger_file="${LEDGER_DIR:-$TETRA_DIR/ledger}/ledger.ndjson"
    [[ ! -s "$ledger_file" ]] && { echo "0"; return; }

    local filter_ts=0
    case "$period" in
        day)
            filter_ts=$(date -v-1d +%s 2>/dev/null || date -d '1 day ago' +%s 2>/dev/null)
            ;;
        week)
            filter_ts=$(date -v-7d +%s 2>/dev/null || date -d '7 days ago' +%s 2>/dev/null)
            ;;
        total)
            filter_ts=0
            ;;
    esac

    jq -s --arg svc "$agent" --argjson cutoff "$filter_ts" \
        '[.[] | select(.service == $svc and .ts >= $cutoff) | .cost_usd] | add // 0' \
        "$ledger_file" 2>/dev/null || echo "0"
}

# =============================================================================
# REGISTER
# =============================================================================

# Usage: _agent_register <name> <provider> <model> <data_dir> [daily_usd] [total_usd]
_agent_register() {
    local name="$1"
    local provider="$2"
    local model="$3"
    local data_dir="$4"
    local daily="${5:-5.0}"
    local total="${6:-100.0}"

    _agent_init

    local tmp="$AGENTS_DIR/agents.json.tmp"
    jq --arg n "$name" --arg p "$provider" --arg m "$model" \
       --arg d "$data_dir" --argjson dl "$daily" --argjson tl "$total" \
       '.[$n] = {provider:$p, model:$m, data_dir:$d, budget:{daily_usd:$dl, total_usd:$tl}}' \
       "$AGENTS_DIR/agents.json" > "$tmp" && mv "$tmp" "$AGENTS_DIR/agents.json"

    echo "Registered agent: $name ($provider/$model)"
}

# =============================================================================
# BACKUP
# =============================================================================

_agent_backup() {
    local agent="$1"
    if ! _agent_exists "$agent"; then
        echo "Agent not found: $agent" >&2
        return 1
    fi

    local data_dir
    data_dir=$(_agent_get "$agent" "data_dir")
    if [[ -z "$data_dir" || ! -d "$data_dir" ]]; then
        echo "Data directory not found: $data_dir" >&2
        return 1
    fi

    local backup_dir="$TETRA_DIR/backups"
    mkdir -p "$backup_dir"

    local ts=$(date +%Y%m%d_%H%M%S)
    local archive="$backup_dir/${agent}_${ts}.tar.gz"

    tar -czf "$archive" -C "$(dirname "$data_dir")" "$(basename "$data_dir")"
    echo "Backup created: $archive"
}

# =============================================================================
# CLI DISPLAY
# =============================================================================

_agent_status() {
    _agent_init

    local C="$TETRA_CYAN" Y="$TETRA_YELLOW" G="$TETRA_GREEN" D="$TETRA_GRAY" N="$TETRA_NC"

    echo -e "${G}Agent Registry${N}"
    echo ""

    local agents
    agents=$(jq -r 'keys[]' "$AGENTS_DIR/agents.json" 2>/dev/null)

    for agent in $agents; do
        local provider model daily_limit total_limit
        provider=$(_agent_get "$agent" "provider")
        model=$(_agent_get "$agent" "model")
        daily_limit=$(_agent_get "$agent" "budget.daily_usd")
        total_limit=$(_agent_get "$agent" "budget.total_usd")

        local key_status="${TETRA_YELLOW}missing${N}"
        if _agent_get_api_key "$provider" &>/dev/null; then
            key_status="${TETRA_GREEN}ok${N}"
        fi

        local daily_spend total_spend
        daily_spend=$(_agent_get_spending "$agent" "day")
        total_spend=$(_agent_get_spending "$agent" "total")

        echo -e "  ${C}$agent${N}"
        echo -e "    Provider: $provider  Model: $model"
        echo -e "    API Key:  $key_status"
        printf "    Daily:    \$%s / \$%s\n" "$daily_spend" "$daily_limit"
        printf "    Total:    \$%s / \$%s\n" "$total_spend" "$total_limit"
        echo ""
    done
}

_agent_list() {
    _agent_init
    jq -r 'keys[]' "$AGENTS_DIR/agents.json" 2>/dev/null
}

_agent_cost_report() {
    local agent="${1:-all}"
    local period="${2:---total}"

    _agent_init

    if ! declare -f _ledger_init &>/dev/null; then
        source "$TETRA_SRC/bash/utils/ledger.sh" 2>/dev/null || return 1
    fi

    if [[ "$agent" == "all" ]]; then
        local agents
        agents=$(jq -r 'keys[]' "$AGENTS_DIR/agents.json" 2>/dev/null)
        for a in $agents; do
            local spend
            spend=$(_agent_get_spending "$a" "${period#--}")
            printf "  %-10s \$%s\n" "$a" "$spend"
        done
    else
        if ! _agent_exists "$agent"; then
            echo "Agent not found: $agent" >&2
            return 1
        fi
        local spend
        spend=$(_agent_get_spending "$agent" "${period#--}")
        printf "  %-10s \$%s\n" "$agent" "$spend"
    fi
}

_agent_help() {
    local C="$TETRA_CYAN" Y="$TETRA_YELLOW" G="$TETRA_GREEN" N="$TETRA_NC"

    echo -e "${G}tetra agent${N} - Agent Registry & Cost Tracking"
    echo ""
    echo -e "  ${C}status${N}                          Registry + API key status"
    echo -e "  ${C}list${N}                            Agent names"
    echo -e "  ${C}cost${N} [agent] [--day|--week|--total]  Spending report"
    echo -e "  ${C}register${N} <name> <provider> <model> <data_dir> [daily] [total]"
    echo -e "  ${C}backup${N} <agent>                  Backup agent data_dir"
    echo -e "  ${C}help${N}                            This message"
}

# =============================================================================
# DISPATCHER
# =============================================================================

_tetra_agent() {
    local subcmd="${1:-status}"
    shift 2>/dev/null || true

    case "$subcmd" in
        status|s)
            _agent_status
            ;;
        list|ls)
            _agent_list
            ;;
        cost)
            _agent_cost_report "$@"
            ;;
        register|reg)
            if [[ $# -lt 4 ]]; then
                echo "Usage: tetra agent register <name> <provider> <model> <data_dir> [daily] [total]" >&2
                return 1
            fi
            _agent_register "$@"
            ;;
        backup)
            if [[ -z "${1:-}" ]]; then
                echo "Usage: tetra agent backup <agent>" >&2
                return 1
            fi
            _agent_backup "$1"
            ;;
        help|h|--help|-h)
            _agent_help
            ;;
        *)
            echo "Unknown: tetra agent $subcmd" >&2
            _agent_help
            return 1
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export AGENTS_DIR
export -f _agent_init _agent_seed_defaults
export -f _agent_get _agent_exists _agent_get_api_key
export -f _agent_log _agent_check_budget _agent_get_spending
export -f _agent_register _agent_backup
export -f _agent_status _agent_list _agent_cost_report _agent_help
export -f _tetra_agent
