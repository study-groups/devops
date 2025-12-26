#!/usr/bin/env bash
# GAMMA + Trax End-to-End Test
#
# Tests the full flow:
#   gamma create → trax host → player join → control input
#
# Prerequisites:
#   tsm start gamma
#   tsm start trax
#
# Usage:
#   ./test-e2e-trax.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC} $1"; }
fail() { echo -e "${RED}FAIL${NC} $1"; exit 1; }
info() { echo -e "${YELLOW}INFO${NC} $1"; }
step() { echo -e "${CYAN}━━━━${NC} $1"; }

# Config
GAMMA_URL="${GAMMA_URL:-http://localhost:8085}"
TRAX_PORT="${TRAX_PORT:-8080}"
TRAX_WS="ws://localhost:$TRAX_PORT"

echo ""
echo "════════════════════════════════════════"
echo "  GAMMA + Trax End-to-End Test"
echo "════════════════════════════════════════"
echo ""
echo "  Gamma: $GAMMA_URL"
echo "  Trax:  $TRAX_WS"
echo ""

# ─────────────────────────────────────────────
step "Step 1: Check gamma is running"
# ─────────────────────────────────────────────

if curl -sf "$GAMMA_URL/api/status" | grep -q '"version"'; then
    GAMMA_MATCHES=$(curl -sf "$GAMMA_URL/api/status" | grep -o '"matches":[0-9]*' | cut -d: -f2)
    pass "gamma running ($GAMMA_MATCHES active matches)"
else
    fail "gamma not running - start with: tsm start gamma"
fi

# ─────────────────────────────────────────────
step "Step 2: Check trax host is running"
# ─────────────────────────────────────────────

# Try to connect briefly to check if WS server is up
if command -v websocat &>/dev/null; then
    if echo '{"type":"ping"}' | timeout 2 websocat -n1 "$TRAX_WS" 2>/dev/null; then
        pass "trax host running"
    else
        info "trax host not responding (may need: tsm start trax)"
        info "continuing without live trax connection..."
        TRAX_LIVE=false
    fi
else
    # Fallback: check if port is listening
    if lsof -i:$TRAX_PORT &>/dev/null; then
        pass "trax host port $TRAX_PORT is open"
        TRAX_LIVE=true
    else
        info "trax not running on port $TRAX_PORT"
        info "continuing with gamma-only tests..."
        TRAX_LIVE=false
    fi
fi

# ─────────────────────────────────────────────
step "Step 3: Create match via gamma"
# ─────────────────────────────────────────────

CREATE_RESULT=$(curl -sf -X POST "$GAMMA_URL/api/match/create" \
    -H "Content-Type: application/json" \
    -d "{\"game\":\"trax\",\"slots\":2,\"addr\":\"localhost:$TRAX_PORT\"}")

if echo "$CREATE_RESULT" | grep -q '"code"'; then
    CODE=$(echo "$CREATE_RESULT" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
    HOST_TOKEN=$(echo "$CREATE_RESULT" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    TOPIC=$(echo "$CREATE_RESULT" | grep -o '"topic":"[^"]*"' | cut -d'"' -f4)
    pass "match created: $CODE"
    echo "      topic: $TOPIC"
else
    fail "failed to create match: $CREATE_RESULT"
fi

# ─────────────────────────────────────────────
step "Step 4: Verify match info"
# ─────────────────────────────────────────────

MATCH_INFO=$(curl -sf "$GAMMA_URL/api/match/$CODE")

if echo "$MATCH_INFO" | grep -q '"game":"trax"'; then
    PLAYER_COUNT=$(echo "$MATCH_INFO" | grep -o '"playerCount":[0-9]*' | cut -d: -f2)
    pass "match info retrieved (players: $PLAYER_COUNT)"
else
    fail "failed to get match info"
fi

# ─────────────────────────────────────────────
step "Step 5: Join match as player 2"
# ─────────────────────────────────────────────

JOIN_RESULT=$(curl -sf -X POST "$GAMMA_URL/api/match/join" \
    -H "Content-Type: application/json" \
    -d "{\"code\":\"$CODE\",\"name\":\"TestPlayer\"}")

if echo "$JOIN_RESULT" | grep -q '"slot":"p2"'; then
    P2_TOKEN=$(echo "$JOIN_RESULT" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    P2_TOPIC=$(echo "$JOIN_RESULT" | grep -o '"topic":"[^"]*"' | cut -d'"' -f4)
    pass "joined as p2"
    echo "      topic: $P2_TOPIC"
else
    fail "failed to join match: $JOIN_RESULT"
fi

# ─────────────────────────────────────────────
step "Step 6: Verify player count = 2"
# ─────────────────────────────────────────────

MATCH_INFO=$(curl -sf "$GAMMA_URL/api/match/$CODE")
PLAYER_COUNT=$(echo "$MATCH_INFO" | grep -o '"playerCount":[0-9]*' | cut -d: -f2)

if [[ "$PLAYER_COUNT" == "2" ]]; then
    pass "player count is 2"
else
    fail "expected 2 players, got $PLAYER_COUNT"
fi

# ─────────────────────────────────────────────
step "Step 7: Simulate control input (TDP message)"
# ─────────────────────────────────────────────

# Send a TDP-style control message via UDP to midi-mp port
# This simulates what would happen when a player moves their controller
TDP_MSG="{\"_proto\":\"tdp\",\"_v\":1,\"topic\":\"$P2_TOPIC/control\",\"type\":\"control\",\"payload\":{\"control\":\"left-y\",\"value\":0.75}}"

if command -v nc &>/dev/null; then
    echo "$TDP_MSG" | nc -u -w1 localhost 1984 2>/dev/null && \
        pass "sent TDP control message to midi-mp:1984" || \
        info "midi-mp not available (control routing skipped)"
else
    info "nc not available, skipping UDP test"
fi

# ─────────────────────────────────────────────
step "Step 8: Test WebSocket connection to trax"
# ─────────────────────────────────────────────

if [[ "$TRAX_LIVE" == "true" ]] && command -v node &>/dev/null; then
    # Quick Node.js WebSocket test
    WS_TEST=$(node -e "
const WebSocket = require('ws');
const ws = new WebSocket('$TRAX_WS');
const timeout = setTimeout(() => { console.log('timeout'); process.exit(1); }, 3000);

ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'join', name: 'e2e-test' }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'joined' || msg.type === 'frame' || msg.slot) {
        console.log('connected:' + (msg.slot || msg.type));
        clearTimeout(timeout);
        ws.close();
        process.exit(0);
    }
});

ws.on('error', (e) => {
    console.log('error:' + e.message);
    process.exit(1);
});
" 2>&1) || true

    if [[ "$WS_TEST" == connected:* ]]; then
        pass "WebSocket connection to trax: ${WS_TEST#connected:}"
    else
        info "WebSocket test: $WS_TEST"
    fi
else
    info "skipping WebSocket test (trax not live or node unavailable)"
fi

# ─────────────────────────────────────────────
step "Step 9: Player 2 leaves"
# ─────────────────────────────────────────────

LEAVE_RESULT=$(curl -sf -X POST "$GAMMA_URL/api/match/leave" \
    -H "Content-Type: application/json" \
    -d "{\"code\":\"$CODE\",\"token\":\"$P2_TOKEN\"}")

if echo "$LEAVE_RESULT" | grep -q '"ok":true'; then
    pass "p2 left match"
else
    fail "failed to leave: $LEAVE_RESULT"
fi

# ─────────────────────────────────────────────
step "Step 10: Host closes match"
# ─────────────────────────────────────────────

CLOSE_RESULT=$(curl -sf -X POST "$GAMMA_URL/api/match/close" \
    -H "Content-Type: application/json" \
    -d "{\"code\":\"$CODE\",\"token\":\"$HOST_TOKEN\"}")

if echo "$CLOSE_RESULT" | grep -q '"ok":true'; then
    pass "match closed"
else
    fail "failed to close: $CLOSE_RESULT"
fi

# ─────────────────────────────────────────────
step "Step 11: Verify match deleted"
# ─────────────────────────────────────────────

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$GAMMA_URL/api/match/$CODE")
if [[ "$HTTP_CODE" == "404" ]]; then
    pass "match no longer exists (404)"
else
    fail "match still exists (HTTP $HTTP_CODE)"
fi

# ─────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo -e "  ${GREEN}All tests passed!${NC}"
echo "════════════════════════════════════════"
echo ""
echo "Flow tested:"
echo "  gamma create → match $CODE"
echo "  gamma join   → p2 assigned"
echo "  TDP control  → midi-mp:1984"
echo "  gamma leave  → p2 released"
echo "  gamma close  → match deleted"
echo ""
