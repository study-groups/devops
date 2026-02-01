#!/usr/bin/env bash
# test-tetra-qa.sh - Tests for tetra qa (indexer, 4-tier query, ledger)
set +e

source "$(dirname "$0")/test-framework.sh"

startup_test_setup "Tetra QA Tests"

# Source the modules under test
source "$TETRA_SRC/bash/utils/ledger.sh"
source "$TETRA_SRC/bash/tetra/tetra_qa.sh"

# ─── Ledger Init ───

test_ledger_init_creates_dir() {
    _ledger_init
    [[ -d "$TETRA_DIR/ledger" ]]
}

test_ledger_init_seeds_rates() {
    _ledger_init
    [[ -f "$TETRA_DIR/ledger/rates.json" ]]
}

test_ledger_init_creates_ndjson() {
    _ledger_init
    [[ -f "$TETRA_DIR/ledger/ledger.ndjson" ]]
}

test_ledger_rates_has_models() {
    _ledger_init
    jq -e '."gpt-4o-latest"' "$TETRA_DIR/ledger/rates.json" >/dev/null &&
    jq -e '."claude-sonnet-4"' "$TETRA_DIR/ledger/rates.json" >/dev/null
}

# ─── Token Estimation ───

test_estimate_tokens_basic() {
    local result
    result=$(_ledger_estimate_tokens 4000)
    [[ "$result" -eq 1000 ]]
}

test_estimate_tokens_zero() {
    local result
    result=$(_ledger_estimate_tokens 0)
    [[ "$result" -eq 0 ]]
}

test_estimate_tokens_file() {
    echo "hello world test content" > "$TETRA_DIR/test_token_file.txt"
    local result
    result=$(_ledger_estimate_tokens_file "$TETRA_DIR/test_token_file.txt")
    [[ "$result" -gt 0 ]]
}

test_estimate_tokens_file_missing() {
    local result
    result=$(_ledger_estimate_tokens_file "$TETRA_DIR/nonexistent.txt")
    [[ "$result" -eq 0 ]]
}

# ─── Cost Estimation ───

test_estimate_cost_gpt4o() {
    _ledger_init
    local result
    result=$(_ledger_estimate_cost 1000 1000 "gpt-4o-latest")
    # 1000/1000 * 0.0025 + 1000/1000 * 0.01 = 0.0125
    [[ "$result" == "0.012500" ]]
}

test_estimate_cost_unknown_model() {
    _ledger_init
    local result
    result=$(_ledger_estimate_cost 1000 1000 "unknown-model")
    [[ "$result" == "unknown" ]]
}

test_context_window_lookup() {
    _ledger_init
    local result
    result=$(_ledger_context_window "gpt-4o-latest")
    [[ "$result" == "128000" ]]
}

# ─── Ledger Logging ───

test_ledger_log_appends() {
    _ledger_init
    _ledger_log "openai" "gpt-4o-latest" 500 100 "test-source" "test-run-1"
    [[ -s "$TETRA_DIR/ledger/ledger.ndjson" ]]
}

test_ledger_log_valid_json() {
    local last_line
    last_line=$(tail -1 "$TETRA_DIR/ledger/ledger.ndjson")
    echo "$last_line" | jq -e '.ts' >/dev/null 2>&1
}

test_ledger_log_fields() {
    local last_line
    last_line=$(tail -1 "$TETRA_DIR/ledger/ledger.ndjson")
    echo "$last_line" | jq -e '.service == "openai"' >/dev/null &&
    echo "$last_line" | jq -e '.model == "gpt-4o-latest"' >/dev/null &&
    echo "$last_line" | jq -e '.input_tokens == 500' >/dev/null &&
    echo "$last_line" | jq -e '.output_tokens == 100' >/dev/null
}

# ─── Rates Management ───

test_rates_list() {
    _ledger_init
    local result
    result=$(_ledger_rates_list)
    [[ "$result" == *"gpt-4o-latest"* ]]
}

# ─── Similarity Engine ───

test_tokenize_basic() {
    local result
    result=$(_tqa_tokenize "How does org build work?")
    [[ "$result" == *"how"* ]] &&
    [[ "$result" == *"org"* ]] &&
    [[ "$result" == *"build"* ]]
}

test_tokenize_strips_short() {
    local result
    result=$(_tqa_tokenize "I am a cat")
    # "I", "am", "a" are 1-char tokens, stripped; "cat" stays
    [[ "$result" == *"cat"* ]] &&
    [[ "$result" != *" a "* ]]
}

test_similarity_identical() {
    local t1 t2
    t1=$(_tqa_tokenize "what functions does qa provide")
    t2=$(_tqa_tokenize "what functions does qa provide")
    local score
    score=$(_tqa_similarity "$t1" "$t2")
    [[ "$score" -eq 100 ]]
}

test_similarity_disjoint() {
    local t1 t2
    t1=$(_tqa_tokenize "alpha bravo charlie")
    t2=$(_tqa_tokenize "delta echo foxtrot")
    local score
    score=$(_tqa_similarity "$t1" "$t2")
    [[ "$score" -eq 0 ]]
}

test_similarity_partial() {
    local t1 t2
    t1=$(_tqa_tokenize "what functions does qa provide")
    t2=$(_tqa_tokenize "what functions does org provide")
    local score
    score=$(_tqa_similarity "$t1" "$t2")
    [[ "$score" -gt 50 ]] && [[ "$score" -lt 100 ]]
}

# ─── Module Priority Table ───

test_tier_a_modules() {
    local result
    result=$(_tqa_modules_for_rank A)
    [[ "$result" == *"tetra"* ]] &&
    [[ "$result" == *"qa"* ]] &&
    [[ "$result" == *"rag"* ]]
}

test_tier_b_modules() {
    local result
    result=$(_tqa_modules_for_rank B)
    [[ "$result" == *"utils"* ]] &&
    [[ "$result" == *"vox"* ]]
}

test_tier_d_finds_unlisted() {
    local result
    result=$(_tqa_modules_for_rank D)
    # D should find modules not in A/B/C (there are many in bash/)
    [[ -n "$result" ]]
}

# ─── Indexer ───

test_index_creates_channel_dir() {
    _tetra_qa_index --rank A >/dev/null 2>&1
    [[ -d "$TETRA_DIR/qa/channels/tetra" ]]
}

test_index_creates_prompt_files() {
    local count
    count=$(ls "$TETRA_DIR/qa/channels/tetra"/*.prompt 2>/dev/null | wc -l | tr -d ' ')
    [[ "$count" -gt 0 ]]
}

test_index_creates_answer_files() {
    local count
    count=$(ls "$TETRA_DIR/qa/channels/tetra"/*.answer 2>/dev/null | wc -l | tr -d ' ')
    [[ "$count" -gt 0 ]]
}

test_index_creates_run() {
    [[ -d "$TETRA_DIR/qa/channels/tetra/runs" ]]
    local run_count
    run_count=$(ls -d "$TETRA_DIR/qa/channels/tetra/runs"/*/ 2>/dev/null | wc -l | tr -d ' ')
    [[ "$run_count" -ge 1 ]]
}

test_index_run_has_metadata() {
    local last_run
    last_run=$(ls -d "$TETRA_DIR/qa/channels/tetra/runs"/*/ 2>/dev/null | sort | tail -1)
    [[ -f "${last_run}run.json" ]] &&
    jq -e '.run_id' "${last_run}run.json" >/dev/null
}

test_index_run_has_modules() {
    local last_run
    last_run=$(ls -d "$TETRA_DIR/qa/channels/tetra/runs"/*/ 2>/dev/null | sort | tail -1)
    local mod_count
    mod_count=$(jq '.modules_indexed | length' "${last_run}run.json")
    [[ "$mod_count" -gt 0 ]]
}

test_index_prompt_content() {
    # At least one prompt should mention a module name
    grep -ql "tetra\|qa\|rag\|org\|magicfind" \
        "$TETRA_DIR/qa/channels/tetra"/*.prompt 2>/dev/null
}

test_index_answer_content() {
    # At least one answer should list functions or files
    grep -ql '\.sh\|()' \
        "$TETRA_DIR/qa/channels/tetra"/*.answer 2>/dev/null
}

# ─── Tier 1: Index Hit ───

test_tier1_exact_hit() {
    # Indexed prompt: "What does the tetra module do? What functions does it provide?"
    local result
    result=$(_tqa_tier1_index_hit "What does the tetra module do? What functions does it provide?" 2>/dev/null)
    [[ -n "$result" ]]
}

test_tier1_fuzzy_hit() {
    # Close enough to "What files are in the tetra module?"
    local result
    result=$(_tqa_tier1_index_hit "What files are in tetra?" 2>/dev/null)
    [[ -n "$result" ]]
}

test_tier1_miss() {
    # Totally unrelated query should not match
    ! _tqa_tier1_index_hit "recipe for chocolate cake" 2>/dev/null
}

# ─── Tier 3: Local Context ───

test_tier3_finds_files() {
    local result
    result=$(_tqa_tier3_local_context "how does org build work" 2>/dev/null)
    [[ "$result" == *"bash/"* ]]
}

test_tier3_miss_on_nonsense() {
    ! _tqa_tier3_local_context "xyzzy plugh" 2>/dev/null
}

# ─── Ask (full pipeline) ───

test_ask_returns_answer() {
    local result
    result=$(_tetra_qa_ask "What files are in the tetra module?" 2>/dev/null)
    [[ -n "$result" ]]
}

test_ask_tier1_used_for_indexed() {
    # Use exact indexed prompt to guarantee tier 1 hit
    local stderr_output
    stderr_output=$(_tetra_qa_ask "What does the qa module do? What functions does it provide?" 2>&1 1>/dev/null)
    [[ "$stderr_output" == *"Stage 1"* ]]
}

# ─── Search ───

test_search_finds_indexed() {
    local result
    result=$(_tetra_qa_search "tetra" 2>/dev/null)
    [[ -n "$result" ]]
}

test_search_empty_for_nonsense() {
    local result
    result=$(_tetra_qa_search "xyzzyplugh" 2>/dev/null)
    [[ -z "$result" ]]
}

# ─── Status ───

test_status_shows_counts() {
    local result
    result=$(_tetra_qa_status 2>/dev/null)
    [[ "$result" == *"QA pairs"* ]]
}

test_status_shows_runs() {
    local result
    result=$(_tetra_qa_status 2>/dev/null)
    [[ "$result" == *"Runs"* ]]
}

# ─── Runs ───

test_runs_lists_entries() {
    local result
    result=$(_tetra_qa_runs 2>/dev/null)
    [[ "$result" == *"RUN ID"* ]]
}

# ─── Context Export ───

test_context_outputs_markdown() {
    local result
    result=$(_tetra_qa_context --rank A 2>/dev/null)
    [[ "$result" == *"# Tetra Codebase Context"* ]] &&
    [[ "$result" == *'```bash'* ]]
}

# ─── Reindex ───

test_reindex_clears_and_rebuilds() {
    local before after
    before=$(ls "$TETRA_DIR/qa/channels/tetra"/*.prompt 2>/dev/null | wc -l | tr -d ' ')
    _tetra_qa_reindex --rank A >/dev/null 2>&1
    after=$(ls "$TETRA_DIR/qa/channels/tetra"/*.prompt 2>/dev/null | wc -l | tr -d ' ')
    # Should have roughly the same count (rebuilt)
    [[ "$after" -gt 0 ]]
}

# ─── Cost (ledger summary) ───

test_cost_runs_without_error() {
    _tetra_qa_cost --total >/dev/null 2>&1
}

# =============================================================================
# RUN ALL TESTS
# =============================================================================

log_section "Ledger Init"
run_test "ledger init creates directory"     test_ledger_init_creates_dir
run_test "ledger init seeds rates.json"      test_ledger_init_seeds_rates
run_test "ledger init creates ledger.ndjson" test_ledger_init_creates_ndjson
run_test "rates.json has expected models"    test_ledger_rates_has_models

log_section "Token Estimation"
run_test "estimate tokens basic (4000 bytes = 1000 tok)" test_estimate_tokens_basic
run_test "estimate tokens zero"                          test_estimate_tokens_zero
run_test "estimate tokens from file"                     test_estimate_tokens_file
run_test "estimate tokens missing file returns 0"        test_estimate_tokens_file_missing

log_section "Cost Estimation"
run_test "cost estimate gpt-4o-latest"     test_estimate_cost_gpt4o
run_test "cost estimate unknown model"     test_estimate_cost_unknown_model
run_test "context window lookup"           test_context_window_lookup

log_section "Ledger Logging"
run_test "ledger log appends to ndjson"    test_ledger_log_appends
run_test "ledger log entry is valid JSON"  test_ledger_log_valid_json
run_test "ledger log has correct fields"   test_ledger_log_fields

log_section "Rates Management"
run_test "rates list shows models"         test_rates_list

log_section "Similarity Engine"
run_test "tokenize extracts words"         test_tokenize_basic
run_test "tokenize strips short tokens"    test_tokenize_strips_short
run_test "identical strings = 100%"        test_similarity_identical
run_test "disjoint strings = 0%"           test_similarity_disjoint
run_test "partial overlap = 50-99%"        test_similarity_partial

log_section "Module Ranks"
run_test "rank A has core modules"         test_tier_a_modules
run_test "rank B has utility modules"      test_tier_b_modules
run_test "rank D finds unlisted modules"   test_tier_d_finds_unlisted

log_section "Indexer"
run_test "index creates channel dir"       test_index_creates_channel_dir
run_test "index creates .prompt files"     test_index_creates_prompt_files
run_test "index creates .answer files"     test_index_creates_answer_files
run_test "index creates run directory"     test_index_creates_run
run_test "run has valid metadata"          test_index_run_has_metadata
run_test "run lists indexed modules"       test_index_run_has_modules
run_test "prompts mention modules"         test_index_prompt_content
run_test "answers have code content"       test_index_answer_content

log_section "Stage 1: Index Hit"
run_test "exact match returns answer"      test_tier1_exact_hit
run_test "fuzzy match returns answer"      test_tier1_fuzzy_hit
run_test "unrelated query misses"          test_tier1_miss

log_section "Stage 3: Local Context"
run_test "finds relevant files"            test_tier3_finds_files
run_test "misses on nonsense"              test_tier3_miss_on_nonsense

log_section "Ask (Full Pipeline)"
run_test "ask returns an answer"           test_ask_returns_answer
run_test "ask uses stage 1 for indexed Q"  test_ask_tier1_used_for_indexed

log_section "Search"
run_test "search finds indexed entries"    test_search_finds_indexed
run_test "search empty for nonsense"       test_search_empty_for_nonsense

log_section "Status & Runs"
run_test "status shows QA pair count"      test_status_shows_counts
run_test "status shows run count"          test_status_shows_runs
run_test "runs lists entries"              test_runs_lists_entries

log_section "Context Export"
run_test "context outputs markdown"        test_context_outputs_markdown

log_section "Reindex"
run_test "reindex clears and rebuilds"     test_reindex_clears_and_rebuilds

log_section "Cost"
run_test "cost runs without error"         test_cost_runs_without_error

# =============================================================================

startup_test_results "Tetra QA Results"
exit $TESTS_FAILED
