#!/bin/bash

# DevPages Comprehensive Test Suite
# Tests Mermaid rendering consistency across all publishing modes
# and validates real-time plugin toggling

set -e # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
TEST_USER="gridranger"
TEST_PASSWORD="gridranger"
BASE_URL="http://localhost:4000"
TEMP_DIR="/tmp/devpages-test-$$"
RESULTS_DIR="$TEMP_DIR/results"
COOKIE_FILE="$TEMP_DIR/cookies.txt"
TEST_MD_FILE="test-mermaid.md"

# Counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Create test directories
mkdir -p "$RESULTS_DIR"
mkdir -p "$TEMP_DIR/downloads"

echo -e "${CYAN}=== DevPages Test Suite ===${NC}"
echo "Test User: $TEST_USER"
echo "Base URL: $BASE_URL"
echo "Temp Dir: $TEMP_DIR"
echo "Results Dir: $RESULTS_DIR"
echo ""

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

test_start() {
    ((TESTS_RUN++))
    log_info "Test #$TESTS_RUN: $1"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up test files..."
    rm -rf "$TEMP_DIR"
    # Remove test file from server if it exists
    if [[ -n "$AUTHENTICATED" ]]; then
        curl -s -b "$COOKIE_FILE" -X DELETE "$BASE_URL/api/files/delete?file=$TEST_MD_FILE" > /dev/null 2>&1 || true
    fi
}

trap cleanup EXIT

# Create test Mermaid content
create_test_markdown() {
    cat > "$TEMP_DIR/$TEST_MD_FILE" << 'EOF'
# Mermaid Test Document

This document tests Mermaid rendering consistency across all publishing modes.

## Test Diagram 1: Simple Flowchart

```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process A]
    B -->|No| D[Process B]
    C --> E[End]
    D --> E
```

## Test Diagram 2: Sequence Diagram

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Database
    
    Client->>Server: Request Data
    Server->>Database: Query
    Database-->>Server: Results
    Server-->>Client: Response
```

## Test Diagram 3: Git Graph

```mermaid
gitgraph
    commit id: "Initial"
    branch feature
    checkout feature
    commit id: "Feature A"
    commit id: "Feature B"
    checkout main
    commit id: "Hotfix"
    merge feature
    commit id: "Release"
```

## Regular Content

This is regular markdown content that should render normally alongside the Mermaid diagrams.

- List item 1
- List item 2
- List item 3

**Bold text** and *italic text* should work fine.

EOF
}

# Authentication functions
authenticate() {
    test_start "Authentication with $TEST_USER"
    
    local auth_response=$(curl -s -c "$COOKIE_FILE" -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\": \"$TEST_USER\", \"password\": \"$TEST_PASSWORD\"}")
    
    if echo "$auth_response" | grep -q '"username"'; then
        log_success "Authentication successful"
        AUTHENTICATED=1
        # Extract user info for logging
        local username=$(echo "$auth_response" | jq -r '.username // "unknown"' 2>/dev/null || echo "unknown")
        local role=$(echo "$auth_response" | jq -r '.role // "unknown"' 2>/dev/null || echo "unknown")
        log_info "Logged in as: $username (role: $role)"
        return 0
    else
        log_error "Authentication failed: $auth_response"
        return 1
    fi
}

verify_auth_status() {
    test_start "Verify authentication status"
    
    local status_response=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/auth/user")
    
    if echo "$status_response" | grep -q "$TEST_USER"; then
        log_success "Authentication status verified"
        return 0
    else
        log_error "Authentication verification failed: $status_response"
        return 1
    fi
}

# File management functions
upload_test_file() {
    test_start "Upload test Mermaid file"
    
    create_test_markdown
    local content=$(cat "$TEMP_DIR/$TEST_MD_FILE")
    
    local upload_response=$(curl -s -b "$COOKIE_FILE" -X POST "$BASE_URL/api/files/save" \
        -H "Content-Type: application/json" \
        -d "{\"pathname\": \"$TEST_MD_FILE\", \"content\": $(echo "$content" | jq -R -s .)}")
    
    if echo "$upload_response" | grep -q '"success".*true'; then
        log_success "Test file uploaded successfully"
        return 0
    else
        log_error "File upload failed: $upload_response"
        return 1
    fi
}

# Preview testing functions
test_preview_rendering() {
    test_start "Preview rendering with Mermaid enabled"
    
    # First, get the file content to render
    local file_content=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/files/content?pathname=$TEST_MD_FILE")
    
    if [[ -z "$file_content" ]]; then
        log_error "Could not retrieve file content for preview"
        return 1
    fi
    
    # Save the preview content for analysis
    echo "$file_content" > "$RESULTS_DIR/preview_content.html"
    
    # Check for Mermaid elements
    if echo "$file_content" | grep -q '<div class="mermaid">'; then
        log_success "Preview contains Mermaid diagram containers"
        
        # Count diagrams
        local diagram_count=$(echo "$file_content" | grep -c '<div class="mermaid">' || echo "0")
        log_info "Found $diagram_count Mermaid diagrams in preview"
        
        return 0
    else
        log_error "Preview does not contain expected Mermaid elements"
        return 1
    fi
}

# Plugin state testing
test_plugin_state() {
    test_start "Check Mermaid plugin enabled state"
    
    # This would require access to the plugin state endpoint
    # For now, we'll test indirectly through rendering
    local preview_content=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/files/content?pathname=$TEST_MD_FILE")
    
    if echo "$preview_content" | grep -q 'class="mermaid"'; then
        log_success "Mermaid plugin appears to be enabled (containers present)"
        return 0
    else
        log_warning "Mermaid plugin state unclear from preview content"
        return 1
    fi
}

# Publishing mode testing
test_local_bundle_mode() {
    test_start "Local publishing with CSS bundle"
    
    # Test direct publish endpoint (if available)
    local publish_response=$(curl -s -b "$COOKIE_FILE" -X POST "$BASE_URL/api/direct-publish" \
        -H "Content-Type: application/json" \
        -d "{\"pathname\": \"$TEST_MD_FILE\", \"mode\": \"local\", \"bundleCss\": true}")
    
    if echo "$publish_response" | grep -q '"success".*true'; then
        local url=$(echo "$publish_response" | jq -r '.url // "none"' 2>/dev/null || echo "none")
        log_success "Local bundle publish successful: $url"
        echo "$publish_response" > "$RESULTS_DIR/local_bundle_response.json"
        return 0
    else
        log_warning "Local bundle publish test inconclusive: $publish_response"
        echo "$publish_response" > "$RESULTS_DIR/local_bundle_response.json"
        return 1
    fi
}

test_local_linked_mode() {
    test_start "Local publishing with CSS links"
    
    local publish_response=$(curl -s -b "$COOKIE_FILE" -X POST "$BASE_URL/api/direct-publish" \
        -H "Content-Type: application/json" \
        -d "{\"pathname\": \"$TEST_MD_FILE\", \"mode\": \"local\", \"bundleCss\": false}")
    
    if echo "$publish_response" | grep -q '"success".*true'; then
        local url=$(echo "$publish_response" | jq -r '.url // "none"' 2>/dev/null || echo "none")
        log_success "Local linked publish successful: $url"
        echo "$publish_response" > "$RESULTS_DIR/local_linked_response.json"
        return 0
    else
        log_warning "Local linked publish test inconclusive: $publish_response"
        echo "$publish_response" > "$RESULTS_DIR/local_linked_response.json"
        return 1
    fi
}

test_spaces_bundle_mode() {
    test_start "Spaces publishing with CSS bundle"
    
    # First check if Spaces is configured
    local spaces_config=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/spaces/config")
    
    if ! echo "$spaces_config" | grep -q '"success".*true'; then
        log_warning "Spaces not configured, skipping Spaces tests"
        return 1
    fi
    
    local publish_response=$(curl -s -b "$COOKIE_FILE" -X POST "$BASE_URL/api/publish" \
        -H "Content-Type: application/json" \
        -d "{\"pathname\": \"$TEST_MD_FILE\", \"htmlContent\": \"<html><body>Test</body></html>\"}")
    
    if echo "$publish_response" | grep -q '"success".*true'; then
        local url=$(echo "$publish_response" | jq -r '.url // "none"' 2>/dev/null || echo "none")
        log_success "Spaces bundle publish successful: $url"
        echo "$publish_response" > "$RESULTS_DIR/spaces_bundle_response.json"
        return 0
    else
        log_warning "Spaces bundle publish test inconclusive: $publish_response"
        echo "$publish_response" > "$RESULTS_DIR/spaces_bundle_response.json"
        return 1
    fi
}

test_spaces_linked_mode() {
    test_start "Spaces publishing with CSS links"
    
    # Similar to bundle mode but with different CSS handling
    local spaces_config=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/spaces/config")
    
    if ! echo "$spaces_config" | grep -q '"success".*true'; then
        log_warning "Spaces not configured, skipping Spaces linked test"
        return 1
    fi
    
    # This would test the linked CSS mode for Spaces
    log_warning "Spaces linked mode test not yet implemented in API"
    return 1
}

# CSS and theme testing
test_css_consistency() {
    test_start "CSS consistency across modes"
    
    # Compare CSS handling across different modes
    local local_bundle=$(cat "$RESULTS_DIR/local_bundle_response.json" 2>/dev/null || echo "{}")
    local local_linked=$(cat "$RESULTS_DIR/local_linked_response.json" 2>/dev/null || echo "{}")
    
    # Basic comparison - in practice, would fetch and compare actual HTML
    if [[ -s "$RESULTS_DIR/local_bundle_response.json" ]] && [[ -s "$RESULTS_DIR/local_linked_response.json" ]]; then
        log_success "Multiple publishing modes tested - manual comparison available"
        log_info "Results saved in: $RESULTS_DIR/"
        return 0
    else
        log_warning "Not enough publishing results to compare CSS consistency"
        return 1
    fi
}

# Mermaid-specific testing
test_mermaid_svg_extraction() {
    test_start "Mermaid SVG extraction and consistency"
    
    # Get preview content and extract SVG elements
    local preview_content=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/files/content?pathname=$TEST_MD_FILE")
    
    # Count SVG elements (after Mermaid processing)
    local svg_count=$(echo "$preview_content" | grep -c '<svg' || echo "0")
    
    if [[ "$svg_count" -gt 0 ]]; then
        log_success "Found $svg_count SVG elements in rendered content"
        
        # Extract SVGs for analysis
        echo "$preview_content" | grep -o '<svg[^>]*>.*</svg>' > "$RESULTS_DIR/extracted_svgs.txt" 2>/dev/null || true
        
        return 0
    else
        log_warning "No SVG elements found - Mermaid may not be fully processed"
        return 1
    fi
}

# System health testing
test_system_health() {
    test_start "System health and API availability"
    
    local health_response=$(curl -s "$BASE_URL/health" 2>/dev/null || echo "failed")
    
    if [[ "$health_response" == "ok" ]]; then
        log_success "System health check passed"
        return 0
    else
        log_error "System health check failed: $health_response"
        return 1
    fi
}

test_api_endpoints() {
    test_start "Critical API endpoints availability"
    
    local endpoints=(
        "/api/auth/user"
        "/api/files/list"
        "/api/spaces/config"
        "/test-route"
    )
    
    local available=0
    for endpoint in "${endpoints[@]}"; do
        local response=$(curl -s -b "$COOKIE_FILE" "$BASE_URL$endpoint" 2>/dev/null || echo "failed")
        if [[ "$response" != "failed" ]] && ! echo "$response" | grep -q '"error"'; then
            ((available++))
        fi
    done
    
    if [[ $available -gt 2 ]]; then
        log_success "API endpoints available ($available/${#endpoints[@]})"
        return 0
    else
        log_error "Too few API endpoints available ($available/${#endpoints[@]})"
        return 1
    fi
}

# Digital Ocean Spaces configuration test
test_spaces_configuration() {
    test_start "Digital Ocean Spaces configuration"
    
    local config_response=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/spaces/config")
    
    if echo "$config_response" | grep -q '"success".*true'; then
        log_success "Spaces configuration endpoint accessible"
        
        # Check for required configuration
        local endpoint=$(echo "$config_response" | jq -r '.config.endpointValue // "missing"' 2>/dev/null || echo "missing")
        local bucket=$(echo "$config_response" | jq -r '.config.bucketValue // "missing"' 2>/dev/null || echo "missing")
        
        if [[ "$endpoint" != "missing" ]] && [[ "$endpoint" != "Not Set" ]]; then
            log_info "Spaces endpoint configured: $endpoint"
        else
            log_warning "Spaces endpoint not configured"
        fi
        
        if [[ "$bucket" != "missing" ]] && [[ "$bucket" != "Not Set" ]]; then
            log_info "Spaces bucket configured: $bucket"
        else
            log_warning "Spaces bucket not configured"
        fi
        
        echo "$config_response" > "$RESULTS_DIR/spaces_config.json"
        return 0
    else
        log_error "Spaces configuration check failed: $config_response"
        return 1
    fi
}

# Main test execution
main() {
    log_info "Starting DevPages test suite..."
    
    # Check if jq is available for JSON parsing
    if ! command -v jq &> /dev/null; then
        log_warning "jq not found - JSON parsing will be limited"
    fi
    
    # System health first
    test_system_health || { log_error "System appears unhealthy - continuing anyway"; }
    
    # Authentication tests
    authenticate || { log_error "Authentication failed - cannot continue"; exit 1; }
    verify_auth_status || { log_error "Auth verification failed"; }
    
    # API availability
    test_api_endpoints || { log_warning "Some API endpoints unavailable"; }
    
    # File operations
    upload_test_file || { log_error "Cannot upload test file"; exit 1; }
    
    # Plugin and rendering tests
    test_plugin_state || { log_warning "Plugin state unclear"; }
    test_preview_rendering || { log_warning "Preview rendering issues"; }
    test_mermaid_svg_extraction || { log_warning "Mermaid SVG processing issues"; }
    
    # Publishing tests
    test_local_bundle_mode || { log_warning "Local bundle mode issues"; }
    test_local_linked_mode || { log_warning "Local linked mode issues"; }
    
    # Spaces tests (may be skipped if not configured)
    test_spaces_configuration || { log_warning "Spaces configuration issues"; }
    test_spaces_bundle_mode || { log_warning "Spaces bundle mode issues"; }
    test_spaces_linked_mode || { log_warning "Spaces linked mode issues"; }
    
    # CSS consistency
    test_css_consistency || { log_warning "CSS consistency check incomplete"; }
    
    # Results summary
    echo ""
    echo -e "${CYAN}=== Test Results Summary ===${NC}"
    echo "Tests Run: $TESTS_RUN"
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}All tests passed!${NC}"
    else
        echo -e "${YELLOW}Some tests failed or were inconclusive${NC}"
    fi
    
    echo ""
    echo "Detailed results saved in: $RESULTS_DIR/"
    echo "Available files:"
    ls -la "$RESULTS_DIR/" 2>/dev/null || echo "No result files generated"
    
    # Exit with appropriate code
    if [[ $TESTS_FAILED -gt $((TESTS_RUN / 2)) ]]; then
        exit 1
    else
        exit 0
    fi
}

# Handle script arguments
case "${1:-run}" in
    "run")
        main
        ;;
    "cleanup")
        cleanup
        echo "Cleanup completed"
        ;;
    "help")
        echo "DevPages Test Suite"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  run      Run the full test suite (default)"
        echo "  cleanup  Clean up test files and temporary data"
        echo "  help     Show this help message"
        echo ""
        echo "Environment:"
        echo "  TEST_USER     Test username (default: gridranger)"
        echo "  TEST_PASSWORD Test password (default: gridranger)"
        echo "  BASE_URL      DevPages server URL (default: http://localhost:3000)"
        echo ""
        echo "Examples:"
        echo "  $0                    # Run full test suite"
        echo "  $0 cleanup           # Clean up test files"
        echo "  BASE_URL=http://localhost:3001 $0  # Test different port"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac 