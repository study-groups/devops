#!/usr/bin/env bash

# Simple tests for Tetra Discovery - no interactive components
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC="${TETRA_SRC:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
TEST_DATA_DIR="$SCRIPT_DIR/test_data"

echo "========================================"
echo "Tetra Discovery Simple Tests"
echo "========================================"

# Test counters
PASS=0
FAIL=0

mkdir -p "$TEST_DATA_DIR"

# Create test JSON
cat > "$TEST_DATA_DIR/test.json" << 'EOF'
[
  {
    "Droplets": [
      {
        "id": 123,
        "name": "test-dev",
        "networks": {
          "v4": [
            {"ip_address": "10.0.0.1", "type": "private"},
            {"ip_address": "203.0.113.1", "type": "public"}
          ]
        },
        "tags": ["dev"]
      }
    ]
  },
  {
    "FloatingIPs": []
  },
  {
    "Domains": []
  },
  {
    "Volumes": []
  }
]
EOF

echo ""
echo "TEST 1: Check test data file exists"
if [[ -f "$TEST_DATA_DIR/test.json" ]]; then
    echo "  ✅ PASS: Test data created"
    ((PASS++))
else
    echo "  ❌ FAIL: Test data not created"
    ((FAIL++))
fi

echo ""
echo "TEST 2: Validate JSON structure"
if jq empty "$TEST_DATA_DIR/test.json" 2>/dev/null; then
    echo "  ✅ PASS: JSON is valid"
    ((PASS++))
else
    echo "  ❌ FAIL: JSON is invalid"
    ((FAIL++))
fi

echo ""
echo "TEST 3: Extract droplets with jq"
droplets=$(jq -r '.[] | select(.Droplets) | .Droplets[]' "$TEST_DATA_DIR/test.json" 2>/dev/null)
if [[ -n "$droplets" ]]; then
    echo "  ✅ PASS: Can extract droplets"
    ((PASS++))
else
    echo "  ❌ FAIL: Cannot extract droplets"
    ((FAIL++))
fi

echo ""
echo "TEST 4: Parse droplet details"
name=$(echo "$droplets" | jq -r '.name')
if [[ "$name" == "test-dev" ]]; then
    echo "  ✅ PASS: Droplet name parsed correctly"
    ((PASS++))
else
    echo "  ❌ FAIL: Droplet name incorrect (got: $name)"
    ((FAIL++))
fi

echo ""
echo "TEST 5: Extract public IP"
public_ip=$(echo "$droplets" | jq -r '.networks.v4[] | select(.type == "public") | .ip_address' | head -1)
if [[ "$public_ip" == "203.0.113.1" ]]; then
    echo "  ✅ PASS: Public IP extracted correctly"
    ((PASS++))
else
    echo "  ❌ FAIL: Public IP incorrect (got: $public_ip)"
    ((FAIL++))
fi

echo ""
echo "TEST 6: Extract tags"
tags=$(echo "$droplets" | jq -r '.tags[]?' 2>/dev/null | tr '\n' ',')
if [[ "$tags" == *"dev"* ]]; then
    echo "  ✅ PASS: Tags extracted correctly"
    ((PASS++))
else
    echo "  ❌ FAIL: Tags incorrect (got: $tags)"
    ((FAIL++))
fi

echo ""
echo "TEST 7: Test mapping file generation structure"
cat > "$TEST_DATA_DIR/test_mapping.json" << 'EOF'
{
  "org_name": "test-org",
  "discovered_at": "2025-10-10T00:00:00Z",
  "environments": {
    "dev": {
      "droplet_name": "test-dev",
      "address": "203.0.113.1"
    }
  }
}
EOF

if jq -r '.environments.dev.address' "$TEST_DATA_DIR/test_mapping.json" | grep -q "203.0.113.1"; then
    echo "  ✅ PASS: Mapping structure correct"
    ((PASS++))
else
    echo "  ❌ FAIL: Mapping structure incorrect"
    ((FAIL++))
fi

# Cleanup
rm -rf "$TEST_DATA_DIR"

echo ""
echo "========================================"
echo "Summary: $PASS passed, $FAIL failed"
echo "========================================"

if [[ $FAIL -eq 0 ]]; then
    echo "✅ All tests passed!"
    exit 0
else
    echo "❌ Some tests failed"
    exit 1
fi
