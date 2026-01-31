#!/usr/bin/env bash
# ledger.sh - Shared token estimation, cost tracking, rates registry
#
# Data lives at $TETRA_DIR/ledger/
#   rates.json      — API pricing registry
#   ledger.ndjson   — append-only log (one JSON line per API call)
#   summary.json    — cached rollup

: "${LEDGER_DIR:=$TETRA_DIR/ledger}"

# =============================================================================
# INIT
# =============================================================================

_ledger_init() {
    mkdir -p "$LEDGER_DIR"

    if [[ ! -f "$LEDGER_DIR/rates.json" ]]; then
        cat > "$LEDGER_DIR/rates.json" <<'RATES'
{
  "chatgpt-4o-latest": {
    "provider": "openai",
    "input_per_1k": 0.0025,
    "output_per_1k": 0.01,
    "context_window": 128000,
    "updated": "2026-01-30"
  },
  "gpt-4o-latest": {
    "provider": "openai",
    "input_per_1k": 0.0025,
    "output_per_1k": 0.01,
    "context_window": 128000,
    "updated": "2026-01-30"
  },
  "gpt-4o-mini": {
    "provider": "openai",
    "input_per_1k": 0.00015,
    "output_per_1k": 0.0006,
    "context_window": 128000,
    "updated": "2026-01-30"
  },
  "claude-sonnet-4": {
    "provider": "anthropic",
    "input_per_1k": 0.003,
    "output_per_1k": 0.015,
    "context_window": 200000,
    "updated": "2026-01-30"
  },
  "claude-opus-4": {
    "provider": "anthropic",
    "input_per_1k": 0.015,
    "output_per_1k": 0.075,
    "context_window": 200000,
    "updated": "2026-01-30"
  },
  "tts-1": {
    "provider": "openai",
    "input_per_1k": 0,
    "output_per_1k": 0.015,
    "context_window": 4096,
    "unit": "chars",
    "updated": "2026-01-30"
  },
  "tts-1-hd": {
    "provider": "openai",
    "input_per_1k": 0,
    "output_per_1k": 0.03,
    "context_window": 4096,
    "unit": "chars",
    "updated": "2026-01-30"
  }
}
RATES
    fi

    [[ -f "$LEDGER_DIR/ledger.ndjson" ]] || touch "$LEDGER_DIR/ledger.ndjson"
}

# =============================================================================
# TOKEN ESTIMATION
# =============================================================================

# Estimate tokens from bytes (rough: 1 token ~ 4 bytes)
# Usage: _ledger_estimate_tokens <bytes> [model]
_ledger_estimate_tokens() {
    local bytes="$1"
    local model="${2:-}"
    # bytes/4 is a reasonable default for English text across models
    echo $(( bytes / 4 ))
}

# Estimate tokens from a file
# Usage: _ledger_estimate_tokens_file <file> [model]
_ledger_estimate_tokens_file() {
    local file="$1"
    local model="${2:-}"
    [[ -f "$file" ]] || { echo 0; return; }
    local bytes
    bytes=$(wc -c < "$file")
    _ledger_estimate_tokens "$bytes" "$model"
}

# =============================================================================
# COST ESTIMATION
# =============================================================================

# Get a rate field for a model from rates.json
# Usage: _ledger_get_rate <model> <field>
_ledger_get_rate() {
    local model="$1"
    local field="$2"
    jq -r --arg m "$model" --arg f "$field" \
        '.[$m][$f] // empty' "$LEDGER_DIR/rates.json" 2>/dev/null
}

# Estimate cost in USD
# Usage: _ledger_estimate_cost <input_tokens> <output_tokens> <model>
_ledger_estimate_cost() {
    local input_tokens="$1"
    local output_tokens="$2"
    local model="$3"

    local input_rate output_rate
    input_rate=$(_ledger_get_rate "$model" "input_per_1k")
    output_rate=$(_ledger_get_rate "$model" "output_per_1k")

    if [[ -z "$input_rate" || -z "$output_rate" ]]; then
        echo "unknown"
        return 1
    fi

    # Use awk for floating point
    awk -v it="$input_tokens" -v ot="$output_tokens" \
        -v ir="$input_rate" -v or_="$output_rate" \
        'BEGIN { printf "%.6f", (it/1000)*ir + (ot/1000)*or_ }'
}

# Show a human-readable cost estimate before sending
# Usage: _ledger_show_estimate <input_tokens> <output_tokens> <model>
_ledger_show_estimate() {
    local input_tokens="$1"
    local output_tokens="$2"
    local model="$3"
    local cost
    cost=$(_ledger_estimate_cost "$input_tokens" "$output_tokens" "$model")

    printf "Model: %s | Input: %s tok | Output: ~%s tok | Est: \$%s\n" \
        "$model" "$input_tokens" "$output_tokens" "$cost" >&2
}

# =============================================================================
# LEDGER LOGGING
# =============================================================================

# Append an entry to the ledger
# Usage: _ledger_log <service> <model> <input_tokens> <output_tokens> <source> [run_id]
_ledger_log() {
    local service="$1"
    local model="$2"
    local input_tokens="$3"
    local output_tokens="$4"
    local source="$5"
    local run_id="${6:-}"
    local ts
    ts=$(date +%s)

    local cost
    cost=$(_ledger_estimate_cost "$input_tokens" "$output_tokens" "$model")

    _ledger_init

    local entry
    entry=$(jq -nc \
        --argjson ts "$ts" \
        --arg service "$service" \
        --arg model "$model" \
        --arg module "$source" \
        --argjson input_tokens "$input_tokens" \
        --argjson output_tokens "$output_tokens" \
        --arg cost_usd "$cost" \
        --arg source "$source" \
        --arg run_id "$run_id" \
        '{ts:$ts, service:$service, model:$model, module:$module,
          input_tokens:$input_tokens, output_tokens:$output_tokens,
          cost_usd:($cost_usd|tonumber), source:$source, run_id:$run_id}')

    echo "$entry" >> "$LEDGER_DIR/ledger.ndjson"
}

# =============================================================================
# LEDGER SUMMARY
# =============================================================================

# Summarize ledger entries
# Usage: _ledger_summary [--day|--week|--total]
_ledger_summary() {
    local period="${1:---total}"
    _ledger_init

    local filter_ts=0
    case "$period" in
        --day)
            filter_ts=$(date -v-1d +%s 2>/dev/null || date -d '1 day ago' +%s 2>/dev/null)
            ;;
        --week)
            filter_ts=$(date -v-7d +%s 2>/dev/null || date -d '7 days ago' +%s 2>/dev/null)
            ;;
        --total)
            filter_ts=0
            ;;
    esac

    if [[ ! -s "$LEDGER_DIR/ledger.ndjson" ]]; then
        echo "No ledger entries."
        return 0
    fi

    awk -F'' -v cutoff="$filter_ts" '
    BEGIN { total_in=0; total_out=0; total_cost=0; calls=0 }
    {
        # Parse JSON-ish with jq would be better, but awk for speed
    }
    END {
        # Fall through to jq
    }
    ' /dev/null

    # Use jq for correctness
    jq -s --argjson cutoff "$filter_ts" '
        [.[] | select(.ts >= $cutoff)] |
        {
            calls: length,
            input_tokens: (map(.input_tokens) | add // 0),
            output_tokens: (map(.output_tokens) | add // 0),
            total_cost_usd: (map(.cost_usd) | add // 0),
            by_model: (group_by(.model) | map({
                model: .[0].model,
                calls: length,
                input_tokens: (map(.input_tokens) | add),
                output_tokens: (map(.output_tokens) | add),
                cost_usd: (map(.cost_usd) | add)
            }))
        }
    ' "$LEDGER_DIR/ledger.ndjson" | jq -r '
        "API Calls:     \(.calls)",
        "Input tokens:  \(.input_tokens)",
        "Output tokens: \(.output_tokens)",
        "Total cost:    $\(.total_cost_usd | . * 1000000 | round / 1000000)",
        "",
        "By model:",
        (.by_model[] |
            "  \(.model): \(.calls) calls, $\(.cost_usd | . * 1000000 | round / 1000000)"
        )
    '
}

# =============================================================================
# RATES MANAGEMENT
# =============================================================================

# Update a rate field
# Usage: _ledger_rates_update <model> <field> <value>
_ledger_rates_update() {
    local model="$1"
    local field="$2"
    local value="$3"
    _ledger_init

    local tmp="$LEDGER_DIR/rates.json.tmp"
    jq --arg m "$model" --arg f "$field" --argjson v "$value" \
        '.[$m][$f] = $v | .[$m].updated = (now | strftime("%Y-%m-%d"))' \
        "$LEDGER_DIR/rates.json" > "$tmp" && mv "$tmp" "$LEDGER_DIR/rates.json"
}

# List all known models and rates
_ledger_rates_list() {
    _ledger_init
    jq -r 'to_entries[] | "\(.key): in=$\(.value.input_per_1k)/1k out=$\(.value.output_per_1k)/1k ctx=\(.value.context_window)"' \
        "$LEDGER_DIR/rates.json"
}

# Get context window for a model
# Usage: _ledger_context_window <model>
_ledger_context_window() {
    local model="$1"
    _ledger_get_rate "$model" "context_window"
}

# =============================================================================
# EXPORTS
# =============================================================================

export LEDGER_DIR
export -f _ledger_init _ledger_estimate_tokens _ledger_estimate_tokens_file
export -f _ledger_get_rate _ledger_estimate_cost _ledger_show_estimate
export -f _ledger_log _ledger_summary
export -f _ledger_rates_update _ledger_rates_list _ledger_context_window
