#!/usr/bin/env bash
# TAS Parser - Parse Tetra Action Specification syntax
# Handles: /action::contract:noun @endpoint

# Parse TAS syntax string
# Usage: tas_parse input_string
# Returns: Sets global variables TAS_MODULE, TAS_ACTION, TAS_CONTRACTS, TAS_NOUN, TAS_ENDPOINT, TAS_IS_PLURAL
tas_parse() {
    local input="$1"

    if [[ -z "$input" ]]; then
        echo "Error: tas_parse requires input string" >&2
        return 1
    fi

    # Reset globals
    TAS_MODULE=""
    TAS_ACTION=""
    TAS_CONTRACTS=()
    TAS_NOUN=""
    TAS_ENDPOINT=""
    TAS_IS_PLURAL=false
    TAS_RAW_INPUT="$input"

    # Trim whitespace
    input=$(echo "$input" | xargs)

    # Remove leading / if present
    if [[ "$input" == /* ]]; then
        input="${input#/}"
    fi

    # Extract endpoint if present (everything after @)
    if [[ "$input" == *@* ]]; then
        TAS_ENDPOINT="${input##*@}"
        input="${input%@*}"
        # Trim again
        input=$(echo "$input" | xargs)
        TAS_ENDPOINT=$(echo "$TAS_ENDPOINT" | xargs)
    fi

    # Now parse the action part: [module.]action[::contract...]:noun

    # Extract noun (everything after last :)
    if [[ "$input" == *:* ]]; then
        TAS_NOUN="${input##*:}"
        input="${input%:*}"
    else
        echo "Error: TAS syntax requires ':noun' (missing colon)" >&2
        return 1
    fi

    # Check if noun is plural (simple heuristic: ends with 's')
    if [[ "$TAS_NOUN" =~ s$ ]]; then
        TAS_IS_PLURAL=true
    fi

    # Extract contracts (everything after ::)
    local action_part="$input"
    if [[ "$input" == *::* ]]; then
        # Split on :: to get action and contracts
        action_part="${input%%::*}"
        local contract_string="${input#*::}"

        # Multiple contracts separated by ::
        IFS='::' read -ra TAS_CONTRACTS <<< "$contract_string"
    fi

    # Parse action part: [module.]action
    if [[ "$action_part" == *.* ]]; then
        # Explicit module
        TAS_MODULE="${action_part%%.*}"
        TAS_ACTION="${action_part#*.}"
    else
        # No explicit module - will need to resolve from context
        TAS_ACTION="$action_part"
        TAS_MODULE=""  # To be resolved
    fi

    return 0
}

# Resolve module from context if not explicit
# Usage: tas_resolve_module
# Returns: Module name via TAS_MODULE variable
tas_resolve_module() {
    if [[ -n "$TAS_MODULE" ]]; then
        # Already explicit
        return 0
    fi

    # Try REPL context
    if [[ -n "$REPL_MODULE" ]]; then
        TAS_MODULE="$REPL_MODULE"
        return 0
    fi

    # Try action registry lookup
    if type action_exists &>/dev/null; then
        # Search registry for action
        local registry_file="${TETRA_DIR}/actions.registry"
        if [[ -f "$registry_file" ]]; then
            local match=$(grep -E "^[^.]+\\.${TAS_ACTION}:" "$registry_file" | head -1)
            if [[ -n "$match" ]]; then
                TAS_MODULE="${match%%.*}"
                return 0
            fi
        fi
    fi

    echo "Error: Could not resolve module for action: $TAS_ACTION" >&2
    return 1
}

# Get fully qualified action name
# Usage: tas_get_fqn
# Returns: module.action
tas_get_fqn() {
    if [[ -z "$TAS_MODULE" ]]; then
        tas_resolve_module || return 1
    fi

    echo "${TAS_MODULE}.${TAS_ACTION}"
}

# Check if action requires TES endpoint
# Usage: tas_requires_endpoint
# Returns: 0 if requires endpoint, 1 if not
tas_requires_endpoint() {
    local fqn=$(tas_get_fqn)

    if [[ -z "$fqn" ]]; then
        return 1
    fi

    # Check action registry
    if type action_is_tes_capable &>/dev/null; then
        action_is_tes_capable "$fqn"
        return $?
    fi

    # If registry not available, assume no endpoint needed
    return 1
}

# Validate parsed TAS syntax
# Usage: tas_validate
# Returns: 0 if valid, 1 if invalid
tas_validate() {
    # Action is required
    if [[ -z "$TAS_ACTION" ]]; then
        echo "Error: TAS syntax requires action" >&2
        return 1
    fi

    # Noun is required
    if [[ -z "$TAS_NOUN" ]]; then
        echo "Error: TAS syntax requires noun" >&2
        return 1
    fi

    # Resolve module if not explicit
    if [[ -z "$TAS_MODULE" ]]; then
        tas_resolve_module || return 1
    fi

    # Check if endpoint required but missing
    if tas_requires_endpoint && [[ -z "$TAS_ENDPOINT" ]]; then
        local fqn=$(tas_get_fqn)
        echo "Error: Action $fqn requires @endpoint" >&2
        return 1
    fi

    return 0
}

# Format TAS for display (with colors if TDS available)
# Usage: tas_format
# Returns: Formatted string
tas_format() {
    local output=""

    # Module
    if type tds_text_color &>/dev/null; then
        output+="$(tds_text_color 'action.module')"
    fi
    output+="${TAS_MODULE}"
    if type tput &>/dev/null; then
        output+="$(tput sgr0)"
    fi

    # Separator
    if type tds_text_color &>/dev/null; then
        output+="$(tds_text_color 'action.separator')"
    fi
    output+="."
    if type tput &>/dev/null; then
        output+="$(tput sgr0)"
    fi

    # Action
    if type tds_text_color &>/dev/null; then
        output+="$(tds_text_color 'action.name')"
    fi
    output+="${TAS_ACTION}"
    if type tput &>/dev/null; then
        output+="$(tput sgr0)"
    fi

    # Contracts
    if [[ ${#TAS_CONTRACTS[@]} -gt 0 ]]; then
        for contract in "${TAS_CONTRACTS[@]}"; do
            output+="::"
            if type tds_text_color &>/dev/null; then
                output+="$(tds_text_color 'action.contract')"
            fi
            output+="$contract"
            if type tput &>/dev/null; then
                output+="$(tput sgr0)"
            fi
        done
    fi

    # Noun
    output+=":"
    if type tds_text_color &>/dev/null; then
        output+="$(tds_text_color 'action.noun')"
    fi
    output+="${TAS_NOUN}"
    if type tput &>/dev/null; then
        output+="$(tput sgr0)"
    fi

    # Endpoint
    if [[ -n "$TAS_ENDPOINT" ]]; then
        output+=" "
        if type tds_text_color &>/dev/null; then
            output+="$(tds_text_color 'action.tes.prefix')"
        fi
        output+="@"
        if type tput &>/dev/null; then
            output+="$(tput sgr0)"
        fi
        if type tds_text_color &>/dev/null; then
            output+="$(tds_text_color 'action.tes.endpoint')"
        fi
        output+="${TAS_ENDPOINT}"
        if type tput &>/dev/null; then
            output+="$(tput sgr0)"
        fi
    fi

    echo "$output"
}

# Get TAS parse results as JSON
# Usage: tas_to_json
# Returns: JSON representation
tas_to_json() {
    local contracts_json="[]"
    if [[ ${#TAS_CONTRACTS[@]} -gt 0 ]]; then
        contracts_json="[$(printf '"%s",' "${TAS_CONTRACTS[@]}" | sed 's/,$//')]"
    fi

    cat <<EOF
{
    "module": "${TAS_MODULE}",
    "action": "${TAS_ACTION}",
    "contracts": $contracts_json,
    "noun": "${TAS_NOUN}",
    "is_plural": $TAS_IS_PLURAL,
    "endpoint": "${TAS_ENDPOINT}",
    "fqn": "$(tas_get_fqn 2>/dev/null || echo '')"
}
EOF
}

# Parse and validate in one call
# Usage: tas_parse_and_validate input_string
# Returns: 0 if valid, 1 if invalid
tas_parse_and_validate() {
    local input="$1"

    tas_parse "$input" || return 1
    tas_validate || return 1

    return 0
}

# Test if string looks like TAS syntax
# Usage: tas_is_tas_syntax string
# Returns: 0 if looks like TAS, 1 if not
tas_is_tas_syntax() {
    local input="$1"

    # Must start with / or contain : and not be a file path
    if [[ "$input" == /* && "$input" == *:* ]]; then
        # Looks like TAS
        return 0
    fi

    return 1
}

# Parse pipeline (split on |)
# Usage: tas_parse_pipeline pipeline_string
# Returns: Array of stage strings in TAS_PIPELINE_STAGES
tas_parse_pipeline() {
    local pipeline="$1"

    if [[ -z "$pipeline" ]]; then
        echo "Error: tas_parse_pipeline requires pipeline string" >&2
        return 1
    fi

    # Split on |
    IFS='|' read -ra TAS_PIPELINE_STAGES <<< "$pipeline"

    # Trim each stage
    local -a trimmed_stages=()
    for stage in "${TAS_PIPELINE_STAGES[@]}"; do
        trimmed_stages+=("$(echo "$stage" | xargs)")
    done

    TAS_PIPELINE_STAGES=("${trimmed_stages[@]}")

    return 0
}

# Check if input is a pipeline (contains |)
# Usage: tas_is_pipeline string
# Returns: 0 if pipeline, 1 if not
tas_is_pipeline() {
    local input="$1"

    [[ "$input" == *\|* ]]
}

# Check if input is a conditional (contains ? and :)
# Usage: tas_is_conditional string
# Returns: 0 if conditional, 1 if not
tas_is_conditional() {
    local input="$1"

    [[ "$input" == *" ? "* && "$input" == *" : "* ]]
}

# Check if input is parallel (contains &)
# Usage: tas_is_parallel string
# Returns: 0 if parallel, 1 if not
tas_is_parallel() {
    local input="$1"

    [[ "$input" == *" & "* ]]
}

# Check for mixed operators (not allowed in v1.1)
# Usage: tas_has_mixed_operators string
# Returns: 0 if mixed (error), 1 if single operator type
tas_has_mixed_operators() {
    local input="$1"
    local op_count=0

    [[ "$input" == *\|* ]] && ((op_count++))
    [[ "$input" == *" & "* ]] && ((op_count++))
    [[ "$input" == *" ? "* ]] && ((op_count++))

    [[ $op_count -gt 1 ]]
}

# Validate operator usage
# Usage: tas_validate_operators string
# Returns: 0 if valid, 1 if invalid (mixed operators)
tas_validate_operators() {
    local input="$1"

    if tas_has_mixed_operators "$input"; then
        echo "Error: Mixed operators not supported. Use one of: | (pipeline), & (parallel), ? : (conditional)" >&2
        return 1
    fi

    return 0
}

# Conditional parsing globals
declare -g TAS_CONDITION=""
declare -g TAS_CONDITION_TRUE=""
declare -g TAS_CONDITION_FALSE=""

# Parse conditional expression
# Usage: tas_parse_conditional string
# Sets: TAS_CONDITION, TAS_CONDITION_TRUE, TAS_CONDITION_FALSE
tas_parse_conditional() {
    local input="$1"

    if [[ -z "$input" ]]; then
        echo "Error: tas_parse_conditional requires input" >&2
        return 1
    fi

    # Reset globals
    TAS_CONDITION=""
    TAS_CONDITION_TRUE=""
    TAS_CONDITION_FALSE=""

    if ! tas_is_conditional "$input"; then
        echo "Error: Not a conditional expression" >&2
        return 1
    fi

    # Split on " ? " and " : "
    # Format: condition ? true_branch : false_branch
    TAS_CONDITION="${input%% \? *}"
    local rest="${input#* \? }"
    TAS_CONDITION_TRUE="${rest%% : *}"
    TAS_CONDITION_FALSE="${rest#* : }"

    # Trim whitespace
    TAS_CONDITION=$(echo "$TAS_CONDITION" | xargs)
    TAS_CONDITION_TRUE=$(echo "$TAS_CONDITION_TRUE" | xargs)
    TAS_CONDITION_FALSE=$(echo "$TAS_CONDITION_FALSE" | xargs)

    return 0
}

# Parallel parsing globals
declare -ga TAS_PARALLEL_ACTIONS=()

# Parse parallel expression
# Usage: tas_parse_parallel string
# Sets: TAS_PARALLEL_ACTIONS array
tas_parse_parallel() {
    local input="$1"

    if [[ -z "$input" ]]; then
        echo "Error: tas_parse_parallel requires input" >&2
        return 1
    fi

    # Reset globals
    TAS_PARALLEL_ACTIONS=()

    if ! tas_is_parallel "$input"; then
        echo "Error: Not a parallel expression" >&2
        return 1
    fi

    # Split on " & "
    IFS='&' read -ra TAS_PARALLEL_ACTIONS <<< "$input"

    # Trim each action
    local -a trimmed=()
    for action in "${TAS_PARALLEL_ACTIONS[@]}"; do
        trimmed+=("$(echo "$action" | xargs)")
    done

    TAS_PARALLEL_ACTIONS=("${trimmed[@]}")

    return 0
}

# Export globals
export TAS_MODULE
export TAS_ACTION
export TAS_CONTRACTS
export TAS_NOUN
export TAS_ENDPOINT
export TAS_IS_PLURAL
export TAS_RAW_INPUT
export TAS_PIPELINE_STAGES

# Export new globals
export TAS_CONDITION
export TAS_CONDITION_TRUE
export TAS_CONDITION_FALSE
export TAS_PARALLEL_ACTIONS

# Export functions
export -f tas_parse
export -f tas_resolve_module
export -f tas_get_fqn
export -f tas_requires_endpoint
export -f tas_validate
export -f tas_format
export -f tas_to_json
export -f tas_parse_and_validate
export -f tas_is_tas_syntax
export -f tas_parse_pipeline
export -f tas_is_pipeline
export -f tas_is_conditional
export -f tas_is_parallel
export -f tas_has_mixed_operators
export -f tas_validate_operators
export -f tas_parse_conditional
export -f tas_parse_parallel
