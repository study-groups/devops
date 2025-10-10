#!/usr/bin/env bash

# Test TES-compliant converter
set -e

echo "========================================"
echo "Tetra Converter Tests"
echo "========================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TETRA_SRC="${TETRA_SRC:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
TEST_DATA="$SCRIPT_DIR/test_data"

mkdir -p "$TEST_DATA"

# Create test mapping file
cat > "$TEST_DATA/test_mapping.json" << 'EOF'
{
  "org_name": "test-org",
  "discovered_at": "2025-10-10T00:00:00Z",
  "source": "/test/digocean.json",
  "environments": {
    "local": {
      "type": "localhost",
      "address": "127.0.0.1"
    },
    "dev": {
      "droplet_id": 123,
      "droplet_name": "test-dev-server",
      "address": "203.0.113.1",
      "private_ip": "10.0.0.1",
      "domain": "dev.example.com"
    },
    "prod": {
      "droplet_id": 456,
      "droplet_name": "test-prod-server",
      "address": "203.0.113.2",
      "private_ip": "10.0.0.2",
      "floating_ip": "203.0.113.100",
      "domain": "example.com"
    }
  }
}
EOF

# Create test digocean.json
cat > "$TEST_DATA/test_do.json" << 'EOF'
[
  {
    "Droplets": [
      {
        "id": 123,
        "name": "test-dev-server",
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
    "Domains": [
      {
        "name": "example.com",
        "zone_file": "dev.example.com. IN A 203.0.113.1\nexample.com. IN A 203.0.113.100\n"
      }
    ]
  },
  {
    "FloatingIPs": []
  },
  {
    "Volumes": []
  }
]
EOF

echo ""
echo "TEST 1: Mapping file is valid JSON"
if jq empty "$TEST_DATA/test_mapping.json" 2>/dev/null; then
    echo "  ✅ PASS"
else
    echo "  ❌ FAIL"
    exit 1
fi

echo ""
echo "TEST 2: Mapping has required fields"
org_name=$(jq -r '.org_name' "$TEST_DATA/test_mapping.json")
if [[ "$org_name" == "test-org" ]]; then
    echo "  ✅ PASS: org_name = $org_name"
else
    echo "  ❌ FAIL: org_name = $org_name"
    exit 1
fi

echo ""
echo "TEST 3: Mapping has dev environment"
dev_address=$(jq -r '.environments.dev.address' "$TEST_DATA/test_mapping.json")
if [[ "$dev_address" == "203.0.113.1" ]]; then
    echo "  ✅ PASS: dev address = $dev_address"
else
    echo "  ❌ FAIL: dev address = $dev_address"
    exit 1
fi

echo ""
echo "TEST 4: Source converter module"
if source "$TETRA_SRC/bash/org/converter.sh" 2>/dev/null; then
    echo "  ✅ PASS: Converter module loaded"
else
    echo "  ❌ FAIL: Could not load converter"
    exit 1
fi

echo ""
echo "TEST 5: Run converter with mapping"
output_toml="$TEST_DATA/test_output.toml"
if tetra_convert_with_mapping "$TEST_DATA/test_do.json" "$TEST_DATA/test_mapping.json" "$output_toml" > /dev/null 2>&1; then
    echo "  ✅ PASS: Converter ran successfully"
else
    echo "  ❌ FAIL: Converter failed"
    exit 1
fi

echo ""
echo "TEST 6: Output TOML file exists"
if [[ -f "$output_toml" ]]; then
    echo "  ✅ PASS: Output file created"
else
    echo "  ❌ FAIL: No output file"
    exit 1
fi

echo ""
echo "TEST 7: Output contains [symbols] section"
if grep -q '\[symbols\]' "$output_toml"; then
    echo "  ✅ PASS: Has [symbols] section"
else
    echo "  ❌ FAIL: Missing [symbols] section"
    exit 1
fi

echo ""
echo "TEST 8: Output contains [connectors] section"
if grep -q '\[connectors\]' "$output_toml"; then
    echo "  ✅ PASS: Has [connectors] section"
else
    echo "  ❌ FAIL: Missing [connectors] section"
    exit 1
fi

echo ""
echo "TEST 9: Output contains @dev symbol"
if grep -q '"@dev"' "$output_toml"; then
    echo "  ✅ PASS: Has @dev symbol"
else
    echo "  ❌ FAIL: Missing @dev symbol"
    exit 1
fi

echo ""
echo "TEST 10: Output has TES version"
if grep -q 'tes_version = "2.1"' "$output_toml"; then
    echo "  ✅ PASS: Has TES version 2.1"
else
    echo "  ❌ FAIL: Missing or wrong TES version"
    exit 1
fi

# Cleanup
rm -rf "$TEST_DATA"

echo ""
echo "========================================"
echo "✅ All converter tests passed!"
echo "========================================"
exit 0
