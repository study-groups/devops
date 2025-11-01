#!/usr/bin/env bash
# TEST 1: Only load tetra_org.sh

ORG_SRC="${ORG_SRC:-$TETRA_SRC/bash/org}"

echo "TEST: Loading ONLY tetra_org.sh" >&2
source "$ORG_SRC/tetra_org.sh" || {
    echo "FAILED to load tetra_org.sh" >&2
    return 1
}

echo "TEST: tetra_org.sh loaded successfully" >&2
return 0
