#!/usr/bin/env bash

# Load the core TSM script
source "$(dirname "$0")/../tsm_core.sh"

# Test setup
setup() {
    # Create a temporary directory for testing
    TEST_DIR=$(mktemp -d)
    touch "$TEST_DIR/test.html"
    
    # Backup existing environment variables
    OLD_PORT="${PORT:-}"
    OLD_TETRA_DIR="${TETRA_DIR:-}"
    
    # Mock tetra_python_activate to do nothing or perform minimal setup
    tetra_python_activate() {
        # Simulate Python environment activation
        export PYENV_ROOT="/mock/pyenv/root"
        export PATH="$PYENV_ROOT/bin:$PATH"
        return 0
    }
}

# Test teardown
teardown() {
    # Remove temporary directory
    rm -rf "$TEST_DIR"
    
    # Restore original environment variables
    if [[ -n "$OLD_PORT" ]]; then
        PORT="$OLD_PORT"
    else
        unset PORT
    fi
    
    if [[ -n "$OLD_TETRA_DIR" ]]; then
        TETRA_DIR="$OLD_TETRA_DIR"
    else
        unset TETRA_DIR
    fi
    
    # Unset mocked environment variables
    unset PYENV_ROOT
}

# Assert function
assert() {
    local condition="$1"
    local message="${2:-Assertion failed}"
    
    if ! eval "$condition"; then
        echo "FAIL: $message" >&2
        exit 1
    fi
}

# Mock pyenv command
pyenv() { 
    # Simulate pyenv global command
    [[ "$1" == "global" ]] && [[ "$2" == "3.11.11" ]]
    return 0 
}

# Test case 1: Explicit port number
test_explicit_port() {
    setup
    
    tetra_tsm_start_python() {
        # Check arguments
        assert "[[ \"$1\" == \"python3 -m http.server 9999\" ]]" "Incorrect python command"
        assert "[[ \"$2\" == \"9999\" ]]" "Incorrect port"
        assert "[[ \"$3\" == \"$TEST_DIR\" ]]" "Incorrect directory"
        assert "[[ \"$4\" == \"webserver\" ]]" "Incorrect name"
        return 0
    }
    
    # Run the function
    tetra_tsm_start_webserver "$TEST_DIR" 9999
    
    teardown
}

# Test case 2: Use PORT environment variable
test_env_port() {
    setup
    
    # Set PORT environment variable
    PORT=7777
    
    tetra_tsm_start_python() {
        # Check arguments
        assert "[[ \"$1\" == \"python3 -m http.server 7777\" ]]" "Incorrect python command"
        assert "[[ \"$2\" == \"7777\" ]]" "Incorrect port"
        assert "[[ \"$3\" == \"$TEST_DIR\" ]]" "Incorrect directory"
        assert "[[ \"$4\" == \"webserver\" ]]" "Incorrect name"
        return 0
    }
    
    # Run the function with a non-numeric second argument
    tetra_tsm_start_webserver "$TEST_DIR" "myserver"
    
    teardown
}

# Test case 3: Default port
test_default_port() {
    setup
    
    # Unset PORT environment variable
    unset PORT
    
    tetra_tsm_start_python() {
        # Check arguments
        assert "[[ \"$1\" == \"python3 -m http.server 8888\" ]]" "Incorrect python command"
        assert "[[ \"$2\" == \"8888\" ]]" "Incorrect port"
        assert "[[ \"$3\" == \"$TEST_DIR\" ]]" "Incorrect directory"
        assert "[[ \"$4\" == \"webserver\" ]]" "Incorrect name"
        return 0
    }
    
    # Run the function with no second argument
    tetra_tsm_start_webserver "$TEST_DIR"
    
    teardown
}

# Test case 4: Invalid directory
test_invalid_directory() {
    setup
    
    # Try to start webserver with non-existent directory
    set +e
    output=$(tetra_tsm_start_webserver "/path/to/nonexistent/dir" 2>&1)
    result=$?
    set -e
    
    assert "[[ $result -ne 0 ]]" "Should fail for non-existent directory"
    assert "[[ \"$output\" == *\"not found\"* ]]" "Should output directory not found error"
    
    teardown
}

# Test case 5: Default directory and port
test_default_dir_and_port() {
    setup
    
    # Mock TETRA_DIR
    TETRA_DIR="$TEST_DIR"
    
    # Create default directory
    mkdir -p "$TEST_DIR/public"
    touch "$TEST_DIR/public/test.html"
    
    tetra_tsm_start_python() {
        # Check arguments
        assert "[[ \"$1\" == \"python3 -m http.server 8888\" ]]" "Incorrect python command"
        assert "[[ \"$2\" == \"8888\" ]]" "Incorrect port"
        assert "[[ \"$3\" == \"$TEST_DIR/public\" ]]" "Incorrect directory"
        assert "[[ \"$4\" == \"webserver\" ]]" "Incorrect name"
        return 0
    }
    
    # Run the function with no arguments after webserver
    tetra_tsm_start webserver
    
    teardown
}

# Run all tests
main() {
    echo "Running TSM Webserver Start Tests..."
    
    test_explicit_port
    test_env_port
    test_default_port
    test_invalid_directory
    test_default_dir_and_port
    
    echo "All tests passed!"
}

# Execute tests
main
