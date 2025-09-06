#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status.
# Treat unset variables as an error.
# The return value of a pipeline is the status of the last command to exit with a non-zero status.
set -euo pipefail

# --- Helper Functions ---
info() {
    # Blue color for info messages
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

success() {
    # Green color for success messages
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

error() {
    # Red color for error messages
    echo -e "\033[1;31m[ERROR]\033[0m $1" >&2
    exit 1
}

# --- Pipeline Steps ---

# Step 1: Clean up the workspace
cleanup() {
    info "Cleaning up workspace..."
    # Use find to safely delete files if they exist, avoiding errors if they don't
    find . -maxdepth 1 -type f \( -name "*.bak" -o -name "*.orig" -o -name "api.go" -o -name "render.go" -o -name "ui.go" -o -name "fs.go" -o -name "state.go" -o -name "input.go" \) -delete
    info "Cleanup complete."
}

# Step 2: Fetch Go module dependencies
fetch_deps() {
    info "Fetching Go module dependencies..."
    go mod tidy
    info "Dependencies are up to date."
}

# Step 3: Build the Go application
build() {
    info "Building the application..."
    # The 'go build' command will output its own errors if it fails.
    go build -o ./tgo .
    if [[ -f "./tgo" ]]; then
        success "Binary './tgo' built successfully."
    else
        error "Build failed. No binary was created."
    fi
}

# --- Main Execution ---
main() {
    # Ensure the script runs from its own directory
    cd "$(dirname "$0")"

    info "Starting build process..."
    
    cleanup
    fetch_deps
    build
    
    success "Build pipeline finished successfully."
}

# Run the main function
main
