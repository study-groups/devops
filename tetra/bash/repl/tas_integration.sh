#!/usr/bin/env bash
# REPL TAS Integration
# Integrates TAS pipeline and action execution into REPL

# Source TAS dependencies
if [[ -f "$TETRA_SRC/bash/actions/pipeline.sh" ]]; then
    source "$TETRA_SRC/bash/actions/pipeline.sh"
fi

if [[ -f "$TETRA_SRC/bash/actions/tas_parser.sh" ]]; then
    source "$TETRA_SRC/bash/actions/tas_parser.sh"
fi

if [[ -f "$TETRA_SRC/bash/actions/aliases.sh" ]]; then
    source "$TETRA_SRC/bash/actions/aliases.sh"
fi

# Detect and dispatch TAS syntax in REPL input
# Usage: repl_tas_detect_and_dispatch input
# Returns: 0 if TAS was detected and executed, 1 if not TAS syntax
repl_tas_detect_and_dispatch() {
    local input="$1"

    # Check if input looks like TAS syntax
    if ! tas_is_tas_syntax "$input"; then
        return 1
    fi

    # Set module context for TAS resolution
    if [[ -n "$REPL_MODULE_CONTEXT" ]]; then
        export REPL_MODULE="$REPL_MODULE_CONTEXT"
    fi

    # Dispatch to TAS system
    tas_dispatch "$input"
    local status=$?

    # Clear module context
    unset REPL_MODULE

    return $status
}

# Enhanced REPL process input with TAS support
# This extends the existing repl_process_input function
repl_process_input_with_tas() {
    local input="$1"

    # First check if it's TAS syntax (starts with / and contains :)
    if [[ "$input" == /*:* ]]; then
        # TAS syntax detected
        repl_tas_detect_and_dispatch "$input"
        return $?
    fi

    # Fall back to standard REPL processing
    repl_process_input "$input"
}

# Tab completion for TAS actions in REPL
# Usage: repl_tas_complete current_word
# Returns: List of completions
repl_tas_complete() {
    local current_word="$1"

    # Remove leading /
    local word="${current_word#/}"

    # If word contains ::, complete contracts
    if [[ "$word" == *::* ]]; then
        # Extract everything after last ::
        local prefix="${word%::*}::"
        echo "${prefix}authenticated"
        echo "${prefix}confirmed"
        echo "${prefix}dryrun"
        echo "${prefix}idempotent"
        echo "${prefix}cached"
        echo "${prefix}logged"
        return 0
    fi

    # If word contains :, complete nouns (context-specific)
    if [[ "$word" == *:* ]]; then
        local action_part="${word%:*}"
        # Module-specific noun completion could go here
        # For now, just show common nouns
        echo "${action_part}:data"
        echo "${action_part}:file"
        echo "${action_part}:files"
        echo "${action_part}:config"
        echo "${action_part}:message"
        return 0
    fi

    # If word contains @, complete endpoints
    if [[ "$word" == *@* ]]; then
        local prefix="${word%@*}@"
        echo "${prefix}local"
        echo "${prefix}dev"
        echo "${prefix}staging"
        echo "${prefix}prod"
        return 0
    fi

    # Complete action names (from alias list and action registry)
    # First, aliases
    alias_list | awk '{print "/"$1}'

    # Then, actions from registry if available
    if type action_complete_list &>/dev/null; then
        if [[ -n "$REPL_MODULE_CONTEXT" ]]; then
            action_complete_list "$REPL_MODULE_CONTEXT" | sed 's/^/\//'
        else
            action_complete_list | sed 's/^/\//'
        fi
    fi
}

# Display TAS help in REPL
# Usage: repl_tas_help
repl_tas_help() {
    cat <<'EOF'
TAS (Tetra Action Specification) in REPL

Basic Syntax:
  /action:noun                      Execute action on noun
  /action:noun @endpoint            Execute at TES endpoint
  /action::contract:noun            Execute with contract
  /module.action:noun               Explicit module qualification

Pipelines:
  /action:noun | /action:noun       Compose actions with pipes

Contracts:
  ::authenticated    Requires authentication
  ::confirmed        Prompts for confirmation
  ::dryrun           Preview mode (no execution)
  ::idempotent       Safe to retry
  ::cached           May use cached data

Aliases:
  /q    = /query
  /s    = /send
  /ls   = /list
  /rm   = /delete

Examples:
  /query:users
  /send:message @prod
  /delete::confirmed:old-data
  /query:users | /filter::active | /map:emails

More Info:
  /help:tas          Full TAS documentation
  /aliases           List all aliases
  /actions           List available actions

EOF
}

# Register TAS help with REPL
if type repl_register_slash_command &>/dev/null; then
    repl_register_slash_command "tas" "repl_tas_help"
fi

# Export functions
export -f repl_tas_detect_and_dispatch
export -f repl_process_input_with_tas
export -f repl_tas_complete
export -f repl_tas_help
