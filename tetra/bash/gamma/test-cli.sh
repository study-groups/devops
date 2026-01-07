#!/usr/bin/env bash
# GAMMA CLI Test Script
# Tests against a running gamma service
#
# Usage:
#   tsm start gamma      # Start service first
#   ./test-cli.sh        # Run tests

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC} $1"; }
fail() { echo -e "${RED}FAIL${NC} $1"; exit 1; }
info() { echo -e "${YELLOW}INFO${NC} $1"; }

# Setup
GAMMA_HTTP_PORT="${GAMMA_HTTP_PORT:-1980}"
GAMMA_URL="http://localhost:$GAMMA_HTTP_PORT"

echo "========================================"
echo "GAMMA CLI Test"
echo "========================================"
echo ""
echo "Testing against: $GAMMA_URL"
echo ""

# Check if gamma is running
info "Checking gamma service..."
if ! curl -sf "$GAMMA_URL/api/status" &>/dev/null; then
    fail "gamma not running at $GAMMA_URL - start with: tsm start gamma"
fi
pass "gamma is running"

# Test 1: Health check
info "Test 1: Health check"
if curl -sf "$GAMMA_URL/api/status" | grep -q '"version"'; then
    pass "API status endpoint"
else
    fail "API status endpoint not responding"
fi

# Test 2: Dashboard
info "Test 2: Dashboard"
if curl -sf "$GAMMA_URL/" | grep -q 'GAMMA'; then
    pass "Dashboard HTML"
else
    fail "Dashboard not serving"
fi

# Test 3: Create match
info "Test 3: Create match"
CREATE_RESULT=$(curl -sf -X POST "$GAMMA_URL/api/match/create" \
    -H "Content-Type: application/json" \
    -d '{"game":"trax","slots":2}')

if echo "$CREATE_RESULT" | grep -q '"code"'; then
    CODE=$(echo "$CREATE_RESULT" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
    TOKEN=$(echo "$CREATE_RESULT" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    pass "Create match: $CODE"
else
    fail "Create match failed: $CREATE_RESULT"
fi

# Test 4: Get match info
info "Test 4: Get match info"
if curl -sf "$GAMMA_URL/api/match/$CODE" | grep -q '"game":"trax"'; then
    pass "Get match info"
else
    fail "Get match info failed"
fi

# Test 5: List matches
info "Test 5: List matches"
if curl -sf "$GAMMA_URL/api/matches" | grep -q "$CODE"; then
    pass "List matches"
else
    fail "List matches - code not found"
fi

# Test 6: Join match
info "Test 6: Join match"
JOIN_RESULT=$(curl -sf -X POST "$GAMMA_URL/api/match/join" \
    -H "Content-Type: application/json" \
    -d "{\"code\":\"$CODE\"}")

if echo "$JOIN_RESULT" | grep -q '"slot":"p2"'; then
    P2_TOKEN=$(echo "$JOIN_RESULT" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    pass "Join match as p2"
else
    fail "Join match failed: $JOIN_RESULT"
fi

# Test 7: Match should show 2 players
info "Test 7: Player count"
MATCH_INFO=$(curl -sf "$GAMMA_URL/api/match/$CODE")
if echo "$MATCH_INFO" | grep -q '"playerCount":2'; then
    pass "Player count is 2"
else
    fail "Player count wrong: $MATCH_INFO"
fi

# Test 8: Leave match
info "Test 8: Leave match"
LEAVE_RESULT=$(curl -sf -X POST "$GAMMA_URL/api/match/leave" \
    -H "Content-Type: application/json" \
    -d "{\"code\":\"$CODE\",\"token\":\"$P2_TOKEN\"}")

if echo "$LEAVE_RESULT" | grep -q '"ok":true'; then
    pass "Leave match"
else
    fail "Leave match failed: $LEAVE_RESULT"
fi

# Test 9: Player count back to 1
info "Test 9: Player count after leave"
MATCH_INFO=$(curl -sf "$GAMMA_URL/api/match/$CODE")
if echo "$MATCH_INFO" | grep -q '"playerCount":1'; then
    pass "Player count is 1"
else
    fail "Player count wrong after leave"
fi

# Test 10: Close match
info "Test 10: Close match"
CLOSE_RESULT=$(curl -sf -X POST "$GAMMA_URL/api/match/close" \
    -H "Content-Type: application/json" \
    -d "{\"code\":\"$CODE\",\"token\":\"$TOKEN\"}")

if echo "$CLOSE_RESULT" | grep -q '"ok":true'; then
    pass "Close match"
else
    fail "Close match failed: $CLOSE_RESULT"
fi

# Test 11: Match should be gone (404)
info "Test 11: Match deleted"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$GAMMA_URL/api/match/$CODE")
if [[ "$HTTP_CODE" == "404" ]]; then
    pass "Match no longer exists (404)"
else
    fail "Match still exists after close (got HTTP $HTTP_CODE)"
fi

# Test 12: Code generation uniqueness
info "Test 12: Code uniqueness"
CODES=""
for i in {1..5}; do
    RESULT=$(curl -sf -X POST "$GAMMA_URL/api/match/create" \
        -H "Content-Type: application/json" \
        -d '{"game":"test"}')
    NEW_CODE=$(echo "$RESULT" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)

    if echo "$CODES" | grep -q "$NEW_CODE"; then
        fail "Duplicate code generated: $NEW_CODE"
    fi
    CODES="$CODES $NEW_CODE"
done
pass "5 unique codes generated"

# Test 13: UDP status query
info "Test 13: UDP status query"
UDP_RESULT=$(echo "status" | nc -u -w1 localhost 1985 2>/dev/null || echo "")
if echo "$UDP_RESULT" | grep -q "OK"; then
    pass "UDP status query"
else
    info "UDP query skipped (nc may not support UDP)"
fi

echo ""
echo "========================================"
echo -e "${GREEN}All tests passed!${NC}"
echo "========================================"
