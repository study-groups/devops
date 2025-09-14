#!/usr/bin/env bash

# Essential TKM functionality tests

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TKM_SCRIPT="$SCRIPT_DIR/../tkm.sh"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0

test_result() {
    if [[ $1 -eq 0 ]]; then
        echo "✅ PASS"
        ((TESTS_PASSED++))
    else
        echo "❌ FAIL: $2"
    fi
    ((TESTS_RUN++))
    echo
}

# Test 1: TKM Initialization
test_tkm_init() {
    echo "🧪 Testing TKM initialization..."

    local test_dir=$(mktemp -d)
    export TETRA_DIR="$test_dir"

    if ! source "$TKM_SCRIPT" >/dev/null 2>&1; then
        rm -rf "$test_dir"
        test_result 1 "Failed to source TKM script"
        return
    fi

    if ! tkm init >/dev/null 2>&1; then
        rm -rf "$test_dir"
        test_result 1 "TKM init failed"
        return
    fi

    local result=0
    [[ -d "$test_dir/tkm/keys/active" ]] || result=1
    [[ -d "$test_dir/tkm/config" ]] || result=1
    [[ -d "$test_dir/tkm/logs" ]] || result=1

    rm -rf "$test_dir"
    test_result $result "Missing required directories"
}

# Test 2: Key Generation
test_key_generation() {
    echo "🧪 Testing key generation..."

    local test_dir=$(mktemp -d)
    export TETRA_DIR="$test_dir"

    if ! source "$TKM_SCRIPT" >/dev/null 2>&1; then
        rm -rf "$test_dir"
        test_result 1 "Failed to source TKM script"
        return
    fi

    if ! tkm init >/dev/null 2>&1; then
        rm -rf "$test_dir"
        test_result 1 "TKM init failed"
        return
    fi

    # Add test environment
    echo "test:test.example.com:tetra:deploy" > "$test_dir/tkm/config/environments.conf"

    # Generate key
    tkm generate test deploy 1 >/dev/null 2>&1

    local result=0
    local key_count=$(find "$test_dir/tkm/keys/active" -name "test_deploy_*" 2>/dev/null | wc -l)
    [[ $key_count -ge 2 ]] || result=1  # Should have private and public key

    rm -rf "$test_dir"
    test_result $result "Key generation failed or wrong location"
}

# Test 3: SSH Inspector Basic Function
test_ssh_inspector() {
    echo "🧪 Testing SSH inspector..."

    local test_dir=$(mktemp -d)
    export TETRA_DIR="$test_dir"

    if ! source "$TKM_SCRIPT" >/dev/null 2>&1; then
        rm -rf "$test_dir"
        test_result 1 "Failed to source TKM script"
        return
    fi

    if ! tkm init >/dev/null 2>&1; then
        rm -rf "$test_dir"
        test_result 1 "TKM init failed"
        return
    fi

    local result=0
    local output
    output=$(tkm_ssh_inspect keys 2>&1) || result=1
    [[ "$output" == *"SSH Keys Analysis"* ]] || result=1

    rm -rf "$test_dir"
    test_result $result "SSH inspector output unexpected"
}

# Test 4: History Isolation
test_history_isolation() {
    echo "🧪 Testing history isolation..."

    local test_dir=$(mktemp -d)
    export TETRA_DIR="$test_dir"

    # Save original history settings
    local orig_histfile="$HISTFILE"
    local orig_histsize="$HISTSIZE"

    # Create test history
    local test_histfile=$(mktemp)
    echo "test_command_1" > "$test_histfile"
    echo "test_command_2" >> "$test_histfile"

    export HISTFILE="$test_histfile"
    export HISTSIZE=1000

    # Load and test
    history -c 2>/dev/null || true
    history -r "$test_histfile" 2>/dev/null || true

    if ! source "$TKM_SCRIPT" >/dev/null 2>&1; then
        rm -rf "$test_dir"
        test_result 1 "Failed to source TKM script"
        return
    fi

    if ! tkm init >/dev/null 2>&1; then
        rm -rf "$test_dir"
        test_result 1 "TKM init failed"
        return
    fi

    # Check history preservation
    local result=0
    local has_test_cmd=$(history | grep -c "test_command" 2>/dev/null || echo "0")
    [[ $has_test_cmd -ge 2 ]] || result=1

    # Restore settings
    export HISTFILE="$orig_histfile"
    export HISTSIZE="$orig_histsize"

    rm -f "$test_histfile"
    rm -rf "$test_dir"
    test_result $result "History isolation failed"
}

# Run all tests
main() {
    echo "🚀 Running Essential TKM Tests"
    echo "=============================="
    echo

    test_tkm_init
    test_key_generation
    test_ssh_inspector
    test_history_isolation

    echo "📊 Results: $TESTS_PASSED/$TESTS_RUN tests passed"

    if [[ $TESTS_PASSED -eq $TESTS_RUN ]]; then
        echo "🎉 All tests passed!"
        exit 0
    else
        echo "💥 Some tests failed!"
        exit 1
    fi
}

main "$@"