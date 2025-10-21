#!/usr/bin/env bash

# Test optimized env file parsing
# Verifies that env file is read once and cached properly

source "$(dirname "$0")/../core/environment.sh"

# Create test env file
test_env=$(mktemp)
cat > "$test_env" <<'EOF'
export PORT=8080
export NAME=testapp
TETRA_PORT=9999
TETRA_NAME=fallback
EOF

echo "Testing env file parsing optimization..."
echo "Test file: $test_env"
echo ""

# Test 1: Parse env file and populate cache
echo "Test 1: Parse env file"
tsm_parse_env_file "$test_env"
echo "  Cache PORT: ${TSM_ENV_CACHE[PORT]:-EMPTY}"
echo "  Cache NAME: ${TSM_ENV_CACHE[NAME]:-EMPTY}"
[[ "${TSM_ENV_CACHE[PORT]}" == "8080" ]] && echo "  ✅ PORT cached correctly" || echo "  ❌ PORT cache failed"
[[ "${TSM_ENV_CACHE[NAME]}" == "testapp" ]] && echo "  ✅ NAME cached correctly" || echo "  ❌ NAME cache failed"
echo ""

# Test 2: Get PORT using cache
echo "Test 2: Get PORT (should use cache)"
port=$(_tsm_get_env_port "$test_env")
[[ "$port" == "8080" ]] && echo "  ✅ Got correct PORT: $port" || echo "  ❌ Wrong PORT: $port"
echo ""

# Test 3: Get NAME using cache
echo "Test 3: Get NAME (should use cache)"
name=$(_tsm_get_env_name "$test_env")
[[ "$name" == "testapp" ]] && echo "  ✅ Got correct NAME: $name" || echo "  ❌ Wrong NAME: $name"
echo ""

# Test 4: Clear cache and test fallback
echo "Test 4: Clear cache and test direct extraction"
unset TSM_ENV_CACHE
port=$(_tsm_get_env_port "$test_env")
name=$(_tsm_get_env_name "$test_env")
[[ "$port" == "8080" ]] && echo "  ✅ Direct PORT extraction works: $port" || echo "  ❌ Direct PORT failed: $port"
[[ "$name" == "testapp" ]] && echo "  ✅ Direct NAME extraction works: $name" || echo "  ❌ Direct NAME failed: $name"
echo ""

# Test 5: Test with TETRA_ prefix fallback
echo "Test 5: Test TETRA_ prefix fallback"
cat > "$test_env" <<'EOF'
TETRA_PORT=7777
TETRA_NAME=tetraapp
EOF
tsm_parse_env_file "$test_env"
port=$(_tsm_get_env_port "$test_env")
name=$(_tsm_get_env_name "$test_env")
[[ "$port" == "7777" ]] && echo "  ✅ TETRA_PORT fallback works: $port" || echo "  ❌ TETRA_PORT failed: $port"
[[ "$name" == "tetraapp" ]] && echo "  ✅ TETRA_NAME fallback works: $name" || echo "  ❌ TETRA_NAME failed: $name"
echo ""

# Cleanup
rm -f "$test_env"
echo "✅ All env optimization tests completed"
