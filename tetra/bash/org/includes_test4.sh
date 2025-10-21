#!/usr/bin/env bash
# TEST 4: Log to file instead of stderr

ORG_SRC="${ORG_SRC:-$TETRA_SRC/bash/org}"
LOG="/tmp/org_load_trace.log"

echo "TEST 4: Starting - $(date)" > "$LOG"

echo "Loading tetra_org.sh..." >> "$LOG"
source "$ORG_SRC/tetra_org.sh" || {
    echo "FAILED tetra_org.sh" >> "$LOG"
    return 1
}
echo "SUCCESS tetra_org.sh" >> "$LOG"

echo "Loading discovery.sh..." >> "$LOG"
source "$ORG_SRC/discovery.sh" 2>/dev/null && echo "SUCCESS discovery.sh" >> "$LOG" || echo "SKIP discovery.sh" >> "$LOG"

echo "Loading converter.sh..." >> "$LOG"
source "$ORG_SRC/converter.sh" 2>/dev/null && echo "SUCCESS converter.sh" >> "$LOG" || echo "SKIP converter.sh" >> "$LOG"

echo "Loading compiler.sh..." >> "$LOG"
source "$ORG_SRC/compiler.sh" 2>/dev/null && echo "SUCCESS compiler.sh" >> "$LOG" || echo "SKIP compiler.sh" >> "$LOG"

echo "Loading refresh.sh..." >> "$LOG"
source "$ORG_SRC/refresh.sh" 2>/dev/null && echo "SUCCESS refresh.sh" >> "$LOG" || echo "SKIP refresh.sh" >> "$LOG"

echo "Loading secrets_manager.sh..." >> "$LOG"
source "$ORG_SRC/secrets_manager.sh" 2>/dev/null && echo "SUCCESS secrets_manager.sh" >> "$LOG" || echo "SKIP secrets_manager.sh" >> "$LOG"

echo "COMPLETE - ALL LOADED" >> "$LOG"
return 0
