#!/usr/bin/env bash

# Tests for Tetra Discovery Module
# Tests parsing, display, and auto-suggestion logic

set -euo pipefail

# Setup test environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC="${TETRA_SRC:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
TEST_DATA_DIR="$SCRIPT_DIR/test_data"

# Source the module under test
source "$TETRA_SRC/bash/org/discovery.sh"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test helpers
test_start() {
    echo ""
    echo "TEST: $1"
    ((TESTS_RUN++))
}

test_pass() {
    echo "  ✅ PASS: $1"
    ((TESTS_PASSED++))
}

test_fail() {
    echo "  ❌ FAIL: $1"
    echo "     Expected: $2"
    echo "     Got: $3"
    ((TESTS_FAILED++))
}

assert_equals() {
    local expected="$1"
    local actual="$2"
    local message="${3:-values should be equal}"

    if [[ "$expected" == "$actual" ]]; then
        test_pass "$message"
    else
        test_fail "$message" "$expected" "$actual"
    fi
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local message="${3:-should contain substring}"

    if [[ "$haystack" == *"$needle"* ]]; then
        test_pass "$message"
    else
        test_fail "$message" "contains '$needle'" "$haystack"
    fi
}

assert_not_empty() {
    local value="$1"
    local message="${2:-value should not be empty}"

    if [[ -n "$value" ]]; then
        test_pass "$message"
    else
        test_fail "$message" "non-empty string" "empty string"
    fi
}

# Create test data directory
mkdir -p "$TEST_DATA_DIR"

# Create minimal test digocean.json
cat > "$TEST_DATA_DIR/test_digocean.json" << 'EOF'
[
  {
    "Droplets": [
      {
        "id": 123456,
        "name": "test-dev-server",
        "memory": 2048,
        "vcpus": 1,
        "disk": 50,
        "region": {
          "slug": "sfo3",
          "name": "San Francisco 3"
        },
        "networks": {
          "v4": [
            {
              "ip_address": "10.0.0.1",
              "type": "private"
            },
            {
              "ip_address": "203.0.113.1",
              "type": "public"
            }
          ]
        },
        "tags": ["dev", "development"],
        "created_at": "2024-01-01T00:00:00Z"
      },
      {
        "id": 789012,
        "name": "test-prod-server",
        "memory": 8192,
        "vcpus": 4,
        "disk": 160,
        "region": {
          "slug": "sfo3",
          "name": "San Francisco 3"
        },
        "networks": {
          "v4": [
            {
              "ip_address": "10.0.0.2",
              "type": "private"
            },
            {
              "ip_address": "203.0.113.2",
              "type": "public"
            }
          ]
        },
        "tags": ["production"],
        "created_at": "2024-01-01T00:00:00Z"
      }
    ]
  },
  {
    "Volumes": []
  },
  {
    "FloatingIPs": [
      {
        "ip": "203.0.113.100",
        "droplet": {
          "id": 789012,
          "name": "test-prod-server"
        }
      }
    ]
  },
  {
    "Domains": [
      {
        "name": "example.com",
        "ttl": 1800,
        "zone_file": "$ORIGIN example.com.\ndev.example.com. 600 IN A 203.0.113.1\nexample.com. 600 IN A 203.0.113.100\n"
      }
    ]
  }
]
EOF

echo "========================================"
echo "Tetra Discovery Module Tests"
echo "========================================"

# Test 1: Parse droplets
test_start "Parse droplets from digocean.json"
droplets_data=$(_discover_parse_droplets "$TEST_DATA_DIR/test_digocean.json")
assert_not_empty "$droplets_data" "Should parse droplets data"

droplet_count=$(echo "$droplets_data" | wc -l | tr -d ' ')
assert_equals "2" "$droplet_count" "Should find 2 droplets"

# Test 2: Parse floating IPs
test_start "Parse floating IPs from digocean.json"
floating_ips=$(_discover_parse_floating_ips "$TEST_DATA_DIR/test_digocean.json")
assert_not_empty "$floating_ips" "Should parse floating IPs"

# Test 3: Parse domains
test_start "Parse domains from digocean.json"
domains=$(_discover_parse_domains "$TEST_DATA_DIR/test_digocean.json")
assert_not_empty "$domains" "Should parse domains"

# Test 4: Auto-suggest mappings
test_start "Auto-suggest environment mappings"
droplets=$(_discover_parse_droplets "$TEST_DATA_DIR/test_digocean.json")
domains=$(_discover_parse_domains "$TEST_DATA_DIR/test_digocean.json")
floating_ips=$(_discover_parse_floating_ips "$TEST_DATA_DIR/test_digocean.json")

mappings=$(_discover_suggest_mappings "$TEST_DATA_DIR/test_digocean.json" "$droplets" "$domains" "$floating_ips")
assert_not_empty "$mappings" "Should generate mappings"

# Check for expected environment suggestions
assert_contains "$mappings" "@dev" "Should suggest dev environment"
assert_contains "$mappings" "@prod" "Should suggest prod environment"
assert_contains "$mappings" "test-dev-server" "Should map dev server"
assert_contains "$mappings" "test-prod-server" "Should map prod server"

# Test 5: Mapping data format
test_start "Mapping data format validation"
mapping_data=$(echo "$mappings" | sed -n '/__MAPPINGS_DATA__/,$p' | tail -n +2)
assert_not_empty "$mapping_data" "Should have parseable mapping data"

# Check that dev mapping contains expected components
dev_mapping=$(echo "$mapping_data" | grep "^dev:")
assert_contains "$dev_mapping" "test-dev-server" "Dev mapping should have server name"
assert_contains "$dev_mapping" "203.0.113.1" "Dev mapping should have IP address"

# Test 6: Generate mapping JSON
test_start "Generate mapping JSON file"
output_mapping="$TEST_DATA_DIR/test_mapping.json"
_discover_generate_mapping \
    "$TEST_DATA_DIR/test_digocean.json" \
    "test-org" \
    "$mappings" \
    "$output_mapping"

if [[ -f "$output_mapping" ]]; then
    test_pass "Mapping file created"
else
    test_fail "Mapping file creation" "file exists" "file not found"
fi

# Test 7: Validate mapping JSON structure
test_start "Validate mapping JSON structure"
if [[ -f "$output_mapping" ]]; then
    # Check JSON is valid
    if jq empty "$output_mapping" 2>/dev/null; then
        test_pass "Mapping JSON is valid"
    else
        test_fail "Mapping JSON validity" "valid JSON" "invalid JSON"
    fi

    # Check required fields
    org_name=$(jq -r '.org_name' "$output_mapping")
    assert_equals "test-org" "$org_name" "Should have correct org name"

    # Check environments exist
    local_env=$(jq -r '.environments.local' "$output_mapping")
    assert_not_empty "$local_env" "Should have local environment"

    dev_env=$(jq -r '.environments.dev' "$output_mapping")
    assert_not_empty "$dev_env" "Should have dev environment"

    # Validate dev environment structure
    dev_address=$(jq -r '.environments.dev.address' "$output_mapping")
    assert_equals "203.0.113.1" "$dev_address" "Dev address should match"

    dev_droplet=$(jq -r '.environments.dev.droplet_name' "$output_mapping")
    assert_equals "test-dev-server" "$dev_droplet" "Dev droplet name should match"
fi

# Test 8: Display functions (smoke test - just ensure they don't crash)
test_start "Display functions smoke test"
droplets=$(_discover_parse_droplets "$TEST_DATA_DIR/test_digocean.json")
display_output=$(_discover_display_droplets "$droplets" 2>&1)
if [[ $? -eq 0 ]]; then
    test_pass "Display droplets function runs without error"
else
    test_fail "Display droplets function" "exit 0" "exit $?"
fi

# Test 9: Test with invalid JSON
test_start "Handle invalid JSON gracefully"
echo "invalid json" > "$TEST_DATA_DIR/invalid.json"
droplets=$(_discover_parse_droplets "$TEST_DATA_DIR/invalid.json" 2>/dev/null || true)
if [[ -z "$droplets" ]]; then
    test_pass "Handles invalid JSON gracefully"
else
    test_fail "Invalid JSON handling" "empty result" "non-empty result"
fi

# Test 10: Test with missing file
test_start "Handle missing file gracefully"
droplets=$(_discover_parse_droplets "$TEST_DATA_DIR/nonexistent.json" 2>/dev/null || true)
if [[ -z "$droplets" ]]; then
    test_pass "Handles missing file gracefully"
else
    test_fail "Missing file handling" "empty result" "non-empty result"
fi

# Cleanup
rm -rf "$TEST_DATA_DIR"

# Summary
echo ""
echo "========================================"
echo "Test Summary"
echo "========================================"
echo "Tests run:    $TESTS_RUN"
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo "✅ All tests passed!"
    exit 0
else
    echo "❌ Some tests failed"
    exit 1
fi
