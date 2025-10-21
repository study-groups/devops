#!/usr/bin/env bash
# Test script for RAG REPL history and tab completion

set -e

: "${TETRA_SRC:=$HOME/src/devops/tetra}"
: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

# Test runner
run_test() {
    local test_name="$1"
    local test_func="$2"

    ((test_count++))
    echo -e "\n${BLUE}Test $test_count: $test_name${NC}"

    if $test_func; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((pass_count++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((fail_count++))
        return 1
    fi
}

# History tests
test_history_init() {
    source "$RAG_SRC/bash/rag_history.sh"
    rag_history_init
    [[ -f "$RAG_HISTORY_FILE" ]]
}

test_history_add() {
    source "$RAG_SRC/bash/rag_history.sh"
    rag_history_init

    # Clear history first
    > "$RAG_HISTORY_FILE"

    rag_history_add "/evidence list"
    rag_history_add "/flow status"

    local line_count
    line_count=$(wc -l < "$RAG_HISTORY_FILE")
    [[ $line_count -eq 2 ]]
}

test_history_no_duplicates() {
    source "$RAG_SRC/bash/rag_history.sh"
    rag_history_init

    # Clear history first
    > "$RAG_HISTORY_FILE"

    rag_history_add "/evidence list"
    rag_history_add "/evidence list"  # Duplicate

    local line_count
    line_count=$(wc -l < "$RAG_HISTORY_FILE")
    [[ $line_count -eq 1 ]]
}

test_history_search() {
    source "$RAG_SRC/bash/rag_history.sh"
    rag_history_init

    # Clear and populate
    > "$RAG_HISTORY_FILE"
    rag_history_add "/evidence list"
    rag_history_add "/flow status"
    rag_history_add "/evidence add test.sh"

    local result
    result=$(rag_history_search "evidence")

    # Should find 2 commands with "evidence"
    [[ $(echo "$result" | wc -l) -eq 2 ]]
}

test_history_clear() {
    source "$RAG_SRC/bash/rag_history.sh"
    rag_history_init

    rag_history_add "/test command"
    rag_history_clear

    local line_count
    line_count=$(wc -l < "$RAG_HISTORY_FILE")
    [[ $line_count -eq 0 ]]
}

test_history_export_import() {
    source "$RAG_SRC/bash/rag_history.sh"
    rag_history_init

    # Clear and populate
    > "$RAG_HISTORY_FILE"
    rag_history_add "/evidence list"
    rag_history_add "/flow status"

    # Export
    local temp_file
    temp_file=$(mktemp)
    rag_history_export "$temp_file" > /dev/null

    # Clear
    > "$RAG_HISTORY_FILE"

    # Import
    rag_history_import "$temp_file" > /dev/null

    # Check count
    local line_count
    line_count=$(wc -l < "$RAG_HISTORY_FILE")
    rm -f "$temp_file"

    [[ $line_count -eq 2 ]]
}

# Completion tree tests
test_completion_init() {
    source "$RAG_SRC/bash/rag_completion_tree.sh"
    rag_completion_init_tree

    local root_cmds
    root_cmds=$(rag_completion_get_node "/")

    [[ -n "$root_cmds" ]] && [[ "$root_cmds" == *"/evidence"* ]]
}

test_completion_evidence_subcommands() {
    source "$RAG_SRC/bash/rag_completion_tree.sh"
    rag_completion_init_tree

    local evidence_cmds
    evidence_cmds=$(rag_completion_get_node "/evidence")

    [[ -n "$evidence_cmds" ]] && \
    [[ "$evidence_cmds" == *"add"* ]] && \
    [[ "$evidence_cmds" == *"list"* ]] && \
    [[ "$evidence_cmds" == *"toggle"* ]]
}

test_completion_flow_subcommands() {
    source "$RAG_SRC/bash/rag_completion_tree.sh"
    rag_completion_init_tree

    local flow_cmds
    flow_cmds=$(rag_completion_get_node "/flow")

    [[ -n "$flow_cmds" ]] && \
    [[ "$flow_cmds" == *"create"* ]] && \
    [[ "$flow_cmds" == *"status"* ]] && \
    [[ "$flow_cmds" == *"resume"* ]]
}

test_completion_history_subcommands() {
    source "$RAG_SRC/bash/rag_completion_tree.sh"
    rag_completion_init_tree

    local history_cmds
    history_cmds=$(rag_completion_get_node "/history")

    [[ -n "$history_cmds" ]] && \
    [[ "$history_cmds" == *"list"* ]] && \
    [[ "$history_cmds" == *"search"* ]] && \
    [[ "$history_cmds" == *"clear"* ]]
}

test_completion_path_building() {
    source "$RAG_SRC/bash/rag_completion_tree.sh"

    local path
    path=$(rag_completion_build_path "/evidence" "add")

    [[ "$path" == "/evidence:add" ]]
}

test_completion_needs_file() {
    source "$RAG_SRC/bash/rag_completion_tree.sh"
    rag_completion_init_tree

    # /evidence:add should need file
    rag_completion_needs_file "/evidence:add"
}

test_completion_mc_flags() {
    source "$RAG_SRC/bash/rag_completion_tree.sh"
    rag_completion_init_tree

    local mc_flags
    mc_flags=$(rag_completion_get_node "/mc:flags")

    [[ -n "$mc_flags" ]] && \
    [[ "$mc_flags" == *"--agent"* ]] && \
    [[ "$mc_flags" == *"--ulm-rank"* ]]
}

# Integration test
test_repl_integration() {
    # Source everything
    source "$RAG_SRC/bash/rag_history.sh"
    source "$RAG_SRC/bash/rag_completion_tree.sh"

    # Init both
    rag_history_init
    rag_completion_init_tree

    # Add some history
    > "$RAG_HISTORY_FILE"
    rag_history_add "/evidence list"
    rag_history_add "/flow status"

    # Check history
    local history_count
    history_count=$(wc -l < "$RAG_HISTORY_FILE")

    # Check completion
    local root_cmds
    root_cmds=$(rag_completion_get_node "/")

    [[ $history_count -eq 2 ]] && [[ -n "$root_cmds" ]]
}

# Run all tests
echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}RAG History & Completion Tests${NC}"
echo -e "${BLUE}=================================${NC}"

# History tests
run_test "History initialization" test_history_init
run_test "History add commands" test_history_add
run_test "History prevents duplicates" test_history_no_duplicates
run_test "History search" test_history_search
run_test "History clear" test_history_clear
run_test "History export/import" test_history_export_import

# Completion tests
run_test "Completion tree initialization" test_completion_init
run_test "Evidence subcommands" test_completion_evidence_subcommands
run_test "Flow subcommands" test_completion_flow_subcommands
run_test "History subcommands" test_completion_history_subcommands
run_test "Completion path building" test_completion_path_building
run_test "Completion file detection" test_completion_needs_file
run_test "MC flags completion" test_completion_mc_flags

# Integration test
run_test "REPL integration" test_repl_integration

# Summary
echo -e "\n${BLUE}=================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}=================================${NC}"
echo -e "Total: $test_count"
echo -e "${GREEN}Passed: $pass_count${NC}"
echo -e "${RED}Failed: $fail_count${NC}"

if [[ $fail_count -eq 0 ]]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
fi
