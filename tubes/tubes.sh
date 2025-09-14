#!/usr/bin/env bash

# Tubes helper script for building and running the application

tubes_build() {
    echo "Building Tubes..."
    go mod tidy
    go build -o tubes ./cmd/tubes
    echo "Build complete: ./tubes"
}

tubes_run() {
    if [[ ! -f "./tubes" ]]; then
        echo "Binary not found. Building first..."
        tubes_build
    fi
    echo "Starting Tubes TUI..."
    ./tubes
}

tubes_clean() {
    echo "Cleaning build artifacts..."
    rm -f tubes tubes.log
    echo "Clean complete"
}

tubes_test() {
    echo "Running tests..."
    go test ./...
}

# Helper for MULTIDIFF operations (placeholder)
tubes_mdiff_gen() {
    echo "MULTIDIFF generation not yet implemented"
    echo "Args: $*"
}

tubes_mdiff_apply() {
    echo "MULTIDIFF apply not yet implemented"
    echo "Args: $*"
}

tubes_mdiff_from_git() {
    echo "MULTIDIFF from git not yet implemented"
    echo "Args: $*"
}

# Show available functions
tubes_help() {
    echo "Tubes Helper Functions:"
    echo "  tubes_build          - Build the application"
    echo "  tubes_run            - Run the application"
    echo "  tubes_clean          - Clean build artifacts"
    echo "  tubes_test           - Run tests"
    echo ""
    echo "MULTIDIFF (planned):"
    echo "  tubes_mdiff_gen      - Generate MULTIDIFF"
    echo "  tubes_mdiff_apply    - Apply MULTIDIFF patch"
    echo "  tubes_mdiff_from_git - Convert git diff to MULTIDIFF"
}

# If script is sourced, just define functions
# If run directly, show help
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    tubes_help
fi