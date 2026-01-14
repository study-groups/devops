#!/usr/bin/env bash
# tcaddy/includes.sh - Entry point for tcaddy module
#
# Provides caddy server management with sticky context
# Context: CADDY[host:site:focus]

[[ -n "$_CADDY_LOADED" ]] && return 0
_CADDY_LOADED=1

# Require bash 5.2+
if ((BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 2))); then
    echo "caddy: requires bash 5.2+" >&2
    return 1
fi

CADDY_SRC="${TETRA_SRC}/bash/tcaddy"

# Load TPS context if available
if [[ -f "$TETRA_SRC/bash/tps/core/context_kv.sh" ]]; then
    source "$TETRA_SRC/bash/utils/kv_store.sh" 2>/dev/null
    source "$TETRA_SRC/bash/tps/core/context_kv.sh" 2>/dev/null
fi

# Load context first (registers with TPS)
source "$CADDY_SRC/caddy_ctx.sh"

# Load main module
source "$CADDY_SRC/caddy.sh"

# Load completion
source "$CADDY_SRC/caddy_complete.sh"

export CADDY_SRC
