#!/usr/bin/env bash
# test-tetra-agent.sh - Tests for tetra agent registry & cost tracking
#
# Usage: bash tests/startup/test-tetra-agent.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/test-framework.sh"

# Override TETRA_DIR to isolate tests
export TETRA_DIR="$STARTUP_TEST_DIR/tetra-home"
export TETRA_SRC="${TETRA_SRC:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
export AGENTS_DIR="$TETRA_DIR/agents"
export LEDGER_DIR="$TETRA_DIR/ledger"

mkdir -p "$TETRA_DIR"

# Source dependencies
source "$TETRA_SRC/bash/utils/ledger.sh"
source "$TETRA_SRC/bash/utils/agents.sh"

# Provide color vars for display functions
: "${TETRA_CYAN:=\033[0;36m}"
: "${TETRA_YELLOW:=\033[1;33m}"
: "${TETRA_GREEN:=\033[0;32m}"
: "${TETRA_GRAY:=\033[0;90m}"
: "${TETRA_NC:=\033[0m}"

# =============================================================================
log_section "Agent Init"
# =============================================================================

test_agent_init_creates_dir() {
    rm -rf "$AGENTS_DIR"
    _agent_init
    [[ -d "$AGENTS_DIR" ]]
}
run_test "agent init creates agents dir" test_agent_init_creates_dir

test_agent_init_seeds_json() {
    rm -rf "$AGENTS_DIR"
    _agent_init
    [[ -f "$AGENTS_DIR/agents.json" ]]
}
run_test "agent init seeds agents.json" test_agent_init_seeds_json

test_agent_init_idempotent() {
    _agent_init
    local before=$(cat "$AGENTS_DIR/agents.json")
    _agent_init
    local after=$(cat "$AGENTS_DIR/agents.json")
    [[ "$before" == "$after" ]]
}
run_test "agent init is idempotent" test_agent_init_idempotent

# =============================================================================
log_section "Agent Registry"
# =============================================================================

test_agent_get_provider() {
    _agent_init
    local provider=$(_agent_get "qa" "provider")
    [[ "$provider" == "openai" ]]
}
run_test "agent get qa provider" test_agent_get_provider

test_agent_get_model() {
    _agent_init
    local model=$(_agent_get "vox" "model")
    [[ "$model" == "tts-1" ]]
}
run_test "agent get vox model" test_agent_get_model

test_agent_get_budget() {
    _agent_init
    local daily=$(_agent_get "qa" "budget.daily_usd")
    [[ "$daily" == "5" || "$daily" == "5.0" ]]
}
run_test "agent get qa budget.daily_usd" test_agent_get_budget

test_agent_exists_true() {
    _agent_init
    _agent_exists "qa"
}
run_test "agent exists returns true for qa" test_agent_exists_true

test_agent_exists_false() {
    _agent_init
    ! _agent_exists "nonexistent"
}
run_test "agent exists returns false for unknown" test_agent_exists_false

test_agent_list() {
    _agent_init
    local list=$(_agent_list)
    [[ "$list" == *"qa"* ]] && [[ "$list" == *"vox"* ]]
}
run_test "agent list shows qa and vox" test_agent_list

# =============================================================================
log_section "Agent Register"
# =============================================================================

test_agent_register() {
    _agent_init
    _agent_register "test-agent" "anthropic" "claude-sonnet-4" "$TETRA_DIR/test" 3.0 50.0
    _agent_exists "test-agent"
}
run_test "agent register adds new agent" test_agent_register

test_agent_register_fields() {
    local provider=$(_agent_get "test-agent" "provider")
    local model=$(_agent_get "test-agent" "model")
    [[ "$provider" == "anthropic" ]] && [[ "$model" == "claude-sonnet-4" ]]
}
run_test "registered agent has correct fields" test_agent_register_fields

# =============================================================================
log_section "API Key Resolution"
# =============================================================================

test_api_key_env() {
    local OPENAI_API_KEY="sk-test-123"
    local key=$(_agent_get_api_key "openai")
    [[ "$key" == "sk-test-123" ]]
}
run_test "api key from env var" test_api_key_env

test_api_key_file() {
    unset OPENAI_API_KEY 2>/dev/null || true
    local QA_DIR="$TETRA_DIR/qa"
    mkdir -p "$QA_DIR"
    echo "sk-file-key" > "$QA_DIR/api_key"
    local key=$(_agent_get_api_key "openai")
    [[ "$key" == "sk-file-key" ]]
}
run_test "api key from file" test_api_key_file

test_api_key_missing() {
    unset OPENAI_API_KEY 2>/dev/null || true
    unset ANTHROPIC_API_KEY 2>/dev/null || true
    ! _agent_get_api_key "anthropic"
}
run_test "api key missing returns error" test_api_key_missing

# =============================================================================
log_section "Agent Logging"
# =============================================================================

test_agent_log_writes() {
    _ledger_init
    _agent_init
    # Ensure rates exist for the model
    local before_lines=0
    [[ -s "$LEDGER_DIR/ledger.ndjson" ]] && before_lines=$(wc -l < "$LEDGER_DIR/ledger.ndjson")

    _agent_log "qa" 100 200 "test-run-1"

    local after_lines=$(wc -l < "$LEDGER_DIR/ledger.ndjson")
    [[ $after_lines -gt $before_lines ]]
}
run_test "agent log writes to ledger" test_agent_log_writes

test_agent_log_correct_fields() {
    local last_entry=$(tail -n1 "$LEDGER_DIR/ledger.ndjson")
    local service=$(echo "$last_entry" | jq -r '.service')
    local run_id=$(echo "$last_entry" | jq -r '.run_id')
    [[ "$service" == "qa" ]] && [[ "$run_id" == "test-run-1" ]]
}
run_test "agent log has correct fields" test_agent_log_correct_fields

# =============================================================================
log_section "Budget Checking"
# =============================================================================

test_budget_within() {
    _agent_check_budget "qa" 2>/dev/null
}
run_test "budget check passes within limits" test_budget_within

test_budget_exceeded() {
    # Register agent with tiny budget
    _agent_register "tiny" "openai" "chatgpt-4o-latest" "$TETRA_DIR/tiny" 0.0001 0.0001
    # Log a call that exceeds budget
    _agent_log "tiny" 10000 10000 "budget-test" 2>/dev/null
    # Budget check should fail (return 1)
    ! _agent_check_budget "tiny" 2>/dev/null
}
run_test "budget check fails when exceeded" test_budget_exceeded

# =============================================================================
log_section "Spending Calculation"
# =============================================================================

test_spending_day() {
    local spend=$(_agent_get_spending "qa" "day")
    # Should be a number (possibly 0)
    [[ "$spend" =~ ^[0-9.]+$ ]]
}
run_test "spending day returns number" test_spending_day

test_spending_total() {
    local spend=$(_agent_get_spending "qa" "total")
    [[ "$spend" =~ ^[0-9.]+$ ]]
}
run_test "spending total returns number" test_spending_total

# =============================================================================
log_section "Cost Report"
# =============================================================================

test_cost_report_all() {
    local output=$(_agent_cost_report "all" "--total")
    [[ "$output" == *"qa"* ]]
}
run_test "cost report all includes qa" test_cost_report_all

test_cost_report_single() {
    local output=$(_agent_cost_report "vox" "--day")
    [[ "$output" == *"vox"* ]]
}
run_test "cost report single agent" test_cost_report_single

# =============================================================================
log_section "Backup"
# =============================================================================

test_backup() {
    mkdir -p "$TETRA_DIR/qa/db"
    echo "test" > "$TETRA_DIR/qa/db/test.prompt"
    _agent_backup "qa"
    local backups=("$TETRA_DIR/backups"/qa_*.tar.gz)
    [[ -f "${backups[0]}" ]]
}
run_test "backup creates tar.gz" test_backup

# =============================================================================
log_section "CLI Dispatcher"
# =============================================================================

test_cli_status() {
    local output=$(_tetra_agent "status")
    [[ "$output" == *"Agent Registry"* ]]
}
run_test "cli status works" test_cli_status

test_cli_list() {
    local output=$(_tetra_agent "list")
    [[ "$output" == *"qa"* ]]
}
run_test "cli list works" test_cli_list

test_cli_help() {
    local output=$(_tetra_agent "help")
    [[ "$output" == *"tetra agent"* ]]
}
run_test "cli help works" test_cli_help

test_cli_unknown() {
    ! _tetra_agent "bogus" 2>/dev/null
}
run_test "cli unknown returns error" test_cli_unknown

# =============================================================================
# LEDGER RATES (tts-1 seed)
# =============================================================================

log_section "Ledger TTS Rates"

test_tts_rates_seeded() {
    # Force re-init with fresh rates
    rm -f "$LEDGER_DIR/rates.json"
    _ledger_init
    local rate=$(_ledger_get_rate "tts-1" "output_per_1k")
    [[ "$rate" == "0.015" ]]
}
run_test "tts-1 rate seeded in rates.json" test_tts_rates_seeded

test_tts_hd_rates_seeded() {
    local rate=$(_ledger_get_rate "tts-1-hd" "output_per_1k")
    [[ "$rate" == "0.03" ]]
}
run_test "tts-1-hd rate seeded in rates.json" test_tts_hd_rates_seeded

# =============================================================================
# SUMMARY
# =============================================================================

startup_test_results "Agent Tests"

# Cleanup
if [[ "$STARTUP_TEST_CLEANUP" == "true" ]]; then
    rm -rf "$STARTUP_TEST_DIR"
fi
