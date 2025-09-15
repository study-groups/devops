#!/usr/bin/env bash

# QA Module Test Suite

# Ensure we're sourcing the main QA module
source "$TETRA_SRC/bash/qa/qa.sh"
source "$TETRA_SRC/bash/melvin/melvin.sh"  # Source Melvin for _truncate_middle

# Test Setup
setup() {
    # Ensure QA directory exists
    mkdir -p "$QA_DIR/db"
    
    # Set a test API key and engine
    echo "test-api-key" > "$OPENAI_API_FILE"
    echo "gpt-3.5-turbo" > "$QA_ENGINE_FILE"
    echo "Test Context" > "$QA_CONTEXT_FILE"
}

# Cleanup after tests
teardown() {
    # Remove test files
    rm -rf "$QA_DIR/db"
}

# Test qa_status function
test_qa_status() {
    # Capture the output of qa_status
    local status_output=$(qa_status)
    
    # Check for key components of the status output
    if [[ ! "$status_output" =~ "API Key file: $OPENAI_API_FILE" ]]; then
        echo "FAIL: Status output missing API Key file path"
        return 1
    fi
    
    if [[ ! "$status_output" =~ "API Key: test-api-key" ]]; then
        echo "FAIL: Status output missing API Key"
        return 1
    fi
    
    if [[ ! "$status_output" =~ "Engine: gpt-3.5-turbo" ]]; then
        echo "FAIL: Status output missing Engine"
        return 1
    fi
    
    if [[ ! "$status_output" =~ "Context: Test Context" ]]; then
        echo "FAIL: Status output missing Context"
        return 1
    fi
    
    echo "PASS: QA Status function"
}

# Test basic query sanitization
test_qa_sanitize_input() {
    local input="  Hello, world!  \n Test\t"
    local sanitized=$(_qa_sanitize_input "$input")
    
    if [[ "$sanitized" != "Hello, world! \n Test\t" ]]; then
        echo "FAIL: Input sanitization failed"
        echo "Expected: 'Hello, world! \n Test\t'"
        echo "Got: '$sanitized'"
        return 1
    fi
    echo "PASS: Input sanitization"
}

# Test shortcut function
test_qq_function() {
    # Temporarily replace q_gpt_query with a mock function
    local original_q_gpt_query=$(declare -f q_gpt_query)
    q_gpt_query() {
        echo "Mocked response to: $*"
    }
    
    local result=$(qq "Test query")
    
    # Restore original function
    eval "$original_q_gpt_query"
    
    # Trim trailing whitespace
    result=$(echo "$result" | sed 's/ *$//')
    
    if [[ "$result" != "Mocked response to: Test query" ]]; then
        echo "FAIL: QQ function not working"
        echo "Expected: 'Mocked response to: Test query'"
        echo "Got: '$result'"
        return 1
    fi
    echo "PASS: QQ function"
}

# Test helper functions
test_helper_functions() {
    # Test _qa_sanitize_index
    local index=$(_qa_sanitize_index "")
    if [[ "$index" != "0" ]]; then
        echo "FAIL: _qa_sanitize_index failed"
        echo "Expected: '0'"
        echo "Got: '$index'"
        return 1
    fi
    
    # Test a() function (simplified test)
    mkdir -p "$QA_DIR/db"
    echo "Test prompt" > "$QA_DIR/db/1.prompt"
    echo "Test answer" > "$QA_DIR/db/1.answer"
    
    # Temporarily replace _truncate_middle with a mock function
    local original_truncate_middle=$(declare -f _truncate_middle)
    _truncate_middle() {
        echo "$1"
    }
    
    # Capture the full output of a()
    local full_output=$(a)
    
    # Extract just the answer
    local answer=$(echo "$full_output" | sed -n '3p')
    
    # Restore original function
    eval "$original_truncate_middle"
    
    if [[ "$answer" != "Test answer" ]]; then
        echo "FAIL: a() function not working"
        echo "Expected: 'Test answer'"
        echo "Got: '$answer'"
        return 1
    fi
    
    echo "PASS: Helper functions"
}

# Main test runner
run_tests() {
    setup
    
    local test_failures=0
    
    test_qa_status || ((test_failures++))
    test_qa_sanitize_input || ((test_failures++))
    test_qq_function || ((test_failures++))
    test_helper_functions || ((test_failures++))
    
    teardown
    
    if [[ $test_failures -gt 0 ]]; then
        echo "TESTS FAILED: $test_failures test(s) failed"
        return 1
    fi
    
    echo "ALL TESTS PASSED"
}

# Run the tests
run_tests
