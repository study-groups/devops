#!/usr/bin/env bash
# TAS Pipeline Engine
# Execute composed actions with fail-fast and atomic cleanup

# Source dependencies
if [[ -f "$TETRA_SRC/bash/actions/tas_parser.sh" ]]; then
    source "$TETRA_SRC/bash/actions/tas_parser.sh"
fi

if [[ -f "$TETRA_SRC/bash/actions/contracts.sh" ]]; then
    source "$TETRA_SRC/bash/actions/contracts.sh"
fi

if [[ -f "$TETRA_SRC/bash/actions/interrupt_handler.sh" ]]; then
    source "$TETRA_SRC/bash/actions/interrupt_handler.sh"
fi

if [[ -f "$TETRA_SRC/bash/actions/aliases.sh" ]]; then
    source "$TETRA_SRC/bash/actions/aliases.sh"
fi

if [[ -f "$TETRA_SRC/bash/actions/executor.sh" ]]; then
    source "$TETRA_SRC/bash/actions/executor.sh"
fi

# Execute a pipeline
# Usage: pipeline_exec pipeline_string
# Returns: 0 on success, non-zero on failure
pipeline_exec() {
    local pipeline="$1"

    if [[ -z "$pipeline" ]]; then
        echo "Error: pipeline_exec requires pipeline string" >&2
        return 1
    fi

    # Parse pipeline into stages
    tas_parse_pipeline "$pipeline" || return 1

    local total_stages=${#TAS_PIPELINE_STAGES[@]}

    if [[ $total_stages -eq 0 ]]; then
        echo "Error: No stages found in pipeline" >&2
        return 1
    fi

    # Generate pipeline ID
    local pipeline_id="pipeline-$(date +%s)-$(echo "$pipeline" | md5sum | cut -c1-8 2>/dev/null || echo "$$")"

    # Initialize pipeline tracking
    pipeline_init "$pipeline_id" "$total_stages"

    echo "Starting pipeline: $pipeline_id ($total_stages stages)" >&2
    echo "" >&2

    # Execute each stage
    local data=""
    local stage_num=0

    for stage in "${TAS_PIPELINE_STAGES[@]}"; do
        ((stage_num++))
        pipeline_set_stage "$stage_num"

        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        echo "Stage $stage_num of $total_stages" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

        # Execute stage
        data=$(execute_stage "$stage" "$data" "$pipeline_id" "$stage_num")
        local status=$?

        if [[ $status -ne 0 ]]; then
            # Failure - invoke failure handler
            echo "" >&2
            pipeline_failure_handler "$stage_num" "Stage execution failed" "$status"
            return $status
        fi

        echo "" >&2
    done

    # Success - cleanup and return
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "✓ Pipeline completed successfully" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

    pipeline_cleanup

    # Return final data
    echo "$data"
}

# Execute a single pipeline stage
# Usage: execute_stage stage_string input_data pipeline_id stage_num
# Returns: Output data for next stage
execute_stage() {
    local stage="$1"
    local input_data="$2"
    local pipeline_id="$3"
    local stage_num="$4"

    # Expand aliases
    stage=$(alias_expand_tas "$stage")

    # Parse stage TAS syntax
    if ! tas_parse_and_validate "$stage"; then
        echo "Error: Invalid TAS syntax in stage $stage_num: $stage" >&2
        return 1
    fi

    # Display formatted action
    echo "Action: $(tas_format)" >&2

    # Validate contracts
    if [[ ${#TAS_CONTRACTS[@]} -gt 0 ]]; then
        echo "Contracts: ${TAS_CONTRACTS[*]}" >&2

        # Reset contract state for this stage
        contract_reset

        # Validate all contracts
        if ! contract_validate_all "${TAS_CONTRACTS[@]}"; then
            echo "Error: Contract validation failed" >&2
            return 1
        fi

        echo "" >&2
    fi

    # Get fully qualified action name
    local fqn=$(tas_get_fqn)
    if [[ -z "$fqn" ]]; then
        echo "Error: Could not resolve action" >&2
        return 1
    fi

    # Check if action exists
    if type action_exists &>/dev/null && ! action_exists "$fqn"; then
        echo "Error: Action not found: $fqn" >&2
        echo "Run 'action_list' to see available actions" >&2
        return 1
    fi

    # Build function name to call
    local impl_fn="${TAS_MODULE}_${TAS_ACTION}_impl"
    local direct_fn="${TAS_MODULE}_${TAS_ACTION}"

    local fn_to_call=""
    if declare -f "$impl_fn" &>/dev/null; then
        fn_to_call="$impl_fn"
    elif declare -f "$direct_fn" &>/dev/null; then
        fn_to_call="$direct_fn"
    else
        echo "Error: Implementation function not found: $impl_fn or $direct_fn" >&2
        return 1
    fi

    # Handle plural/singular execution
    local output=""
    if $TAS_IS_PLURAL && [[ -n "$input_data" ]]; then
        # Plural - iterate over input (assume newline-delimited)
        echo "Processing multiple items..." >&2
        local item_count=0

        while IFS= read -r line; do
            [[ -z "$line" ]] && continue

            ((item_count++))

            # Execute action on this item
            local result
            if [[ -n "$TAS_ENDPOINT" ]]; then
                result=$("$fn_to_call" "$TAS_ENDPOINT" "$line" 2>&1)
            else
                result=$("$fn_to_call" "$line" 2>&1)
            fi

            local item_status=$?

            if [[ $item_status -ne 0 ]]; then
                echo "Error: Failed on item $item_count" >&2
                return $item_status
            fi

            # Collect output
            output+="$result"$'\n'

            # Track any artifacts created
            if [[ "$result" =~ $TETRA_DIR/.*\..*\..* ]]; then
                pipeline_track_artifact "$result"
            fi
        done <<< "$input_data"

        echo "Processed $item_count items" >&2

    else
        # Singular execution
        if [[ -n "$TAS_ENDPOINT" ]]; then
            output=$("$fn_to_call" "$TAS_ENDPOINT" "$input_data" 2>&1)
        else
            output=$("$fn_to_call" "$input_data" 2>&1)
        fi

        local exec_status=$?

        if [[ $exec_status -ne 0 ]]; then
            return $exec_status
        fi

        # Track any artifacts created
        if [[ "$output" =~ $TETRA_DIR/.*\..*\..* ]]; then
            # Extract file path from output
            local artifact=$(echo "$output" | grep -o "$TETRA_DIR/[^ ]*" | head -1)
            if [[ -n "$artifact" ]]; then
                pipeline_track_artifact "$artifact"
            fi
        fi
    fi

    # Log stage execution if audit available
    if type audit_log &>/dev/null; then
        audit_log "pipeline" "stage_complete" "$pipeline_id" "stage_$stage_num" "$fqn"
    fi

    # Return output for next stage
    echo "$output"
}

# Execute a single TAS action (not a pipeline)
# Usage: tas_exec tas_string
# Returns: 0 on success, non-zero on failure
tas_exec() {
    local tas_input="$1"

    if [[ -z "$tas_input" ]]; then
        echo "Error: tas_exec requires TAS input" >&2
        return 1
    fi

    # Expand aliases
    tas_input=$(alias_expand_tas "$tas_input")

    # Parse and validate
    if ! tas_parse_and_validate "$tas_input"; then
        return 1
    fi

    # Display formatted action
    echo "Executing: $(tas_format)" >&2

    # Validate contracts
    if [[ ${#TAS_CONTRACTS[@]} -gt 0 ]]; then
        echo "Contracts: ${TAS_CONTRACTS[*]}" >&2

        contract_reset

        if ! contract_validate_all "${TAS_CONTRACTS[@]}"; then
            echo "Error: Contract validation failed" >&2
            return 1
        fi

        echo "" >&2
    fi

    # Get fully qualified action name
    local fqn=$(tas_get_fqn)
    if [[ -z "$fqn" ]]; then
        echo "Error: Could not resolve action" >&2
        return 1
    fi

    # Use existing action_exec if available
    if type action_exec &>/dev/null; then
        if [[ -n "$TAS_ENDPOINT" ]]; then
            action_exec "$fqn" "$TAS_ENDPOINT"
        else
            action_exec "$fqn"
        fi
    else
        # Fallback: direct execution
        local impl_fn="${TAS_MODULE}_${TAS_ACTION}_impl"
        local direct_fn="${TAS_MODULE}_${TAS_ACTION}"

        local fn_to_call=""
        if declare -f "$impl_fn" &>/dev/null; then
            fn_to_call="$impl_fn"
        elif declare -f "$direct_fn" &>/dev/null; then
            fn_to_call="$direct_fn"
        else
            echo "Error: Implementation function not found: $impl_fn or $direct_fn" >&2
            return 1
        fi

        if [[ -n "$TAS_ENDPOINT" ]]; then
            "$fn_to_call" "$TAS_ENDPOINT"
        else
            "$fn_to_call"
        fi
    fi
}

# Execute a conditional expression
# Usage: conditional_exec conditional_string
# Returns: Exit code of executed branch
conditional_exec() {
    local input="$1"

    if [[ -z "$input" ]]; then
        echo "Error: conditional_exec requires input" >&2
        return 1
    fi

    # Parse conditional
    if ! tas_parse_conditional "$input"; then
        return 1
    fi

    echo "Conditional: $TAS_CONDITION" >&2
    echo "  True branch:  $TAS_CONDITION_TRUE" >&2
    echo "  False branch: $TAS_CONDITION_FALSE" >&2
    echo "" >&2

    # Execute condition
    echo "Evaluating condition..." >&2
    tas_exec "$TAS_CONDITION" >/dev/null 2>&1
    local status=$?

    if [[ $status -eq 0 ]]; then
        echo "Condition succeeded (exit 0), executing true branch" >&2
        tas_dispatch "$TAS_CONDITION_TRUE"
    else
        echo "Condition failed (exit $status), executing false branch" >&2
        tas_dispatch "$TAS_CONDITION_FALSE"
    fi
}

# Execute actions in parallel with fail-fast
# Usage: parallel_exec parallel_string
# Returns: 0 if all succeed, first failure exit code otherwise
parallel_exec() {
    local input="$1"

    if [[ -z "$input" ]]; then
        echo "Error: parallel_exec requires input" >&2
        return 1
    fi

    # Parse parallel actions
    if ! tas_parse_parallel "$input"; then
        return 1
    fi

    local total=${#TAS_PARALLEL_ACTIONS[@]}
    echo "Parallel execution: $total actions" >&2
    echo "" >&2

    # Create temp directory for status tracking
    local tmpdir=$(mktemp -d)
    local pids=()

    # Launch all actions in background
    for i in "${!TAS_PARALLEL_ACTIONS[@]}"; do
        local action="${TAS_PARALLEL_ACTIONS[$i]}"
        echo "  [$((i+1))/$total] Launching: $action" >&2
        (
            tas_exec "$action" >/dev/null 2>&1
            echo $? > "$tmpdir/$i.status"
        ) &
        pids+=($!)
    done

    echo "" >&2
    echo "Monitoring for completion..." >&2

    # Monitor for first failure (fail-fast)
    local failed_idx=-1
    local failed_status=0

    while true; do
        local running=0

        for i in "${!pids[@]}"; do
            local pid=${pids[$i]}

            # Skip if already processed
            [[ -z "$pid" ]] && continue

            # Check if still running
            if kill -0 "$pid" 2>/dev/null; then
                ((running++))
            else
                # Process finished - check status
                wait "$pid" 2>/dev/null
                local status=$?

                if [[ $status -ne 0 ]]; then
                    # Fail-fast: kill remaining processes
                    echo "  Action $((i+1)) failed (exit $status)" >&2
                    failed_idx=$i
                    failed_status=$status

                    echo "  Killing remaining processes..." >&2
                    for other_pid in "${pids[@]}"; do
                        [[ -n "$other_pid" ]] && kill "$other_pid" 2>/dev/null
                    done

                    rm -rf "$tmpdir"
                    return $failed_status
                fi

                echo "  Action $((i+1)) completed successfully" >&2
                unset 'pids[$i]'
            fi
        done

        # All done?
        if [[ $running -eq 0 ]]; then
            break
        fi

        sleep 0.1
    done

    rm -rf "$tmpdir"
    echo "" >&2
    echo "✓ All $total actions completed successfully" >&2
    return 0
}

# Main TAS dispatcher
# Usage: tas_dispatch input
# Detects if input is pipeline, conditional, parallel, or single action
tas_dispatch() {
    local input="$1"

    if [[ -z "$input" ]]; then
        echo "Error: tas_dispatch requires input" >&2
        return 1
    fi

    # Validate no mixed operators
    if ! tas_validate_operators "$input"; then
        return 1
    fi

    # Route to appropriate executor (order matters: conditional > parallel > pipeline > single)
    if tas_is_conditional "$input"; then
        conditional_exec "$input"
    elif tas_is_parallel "$input"; then
        parallel_exec "$input"
    elif tas_is_pipeline "$input"; then
        pipeline_exec "$input"
    else
        tas_exec "$input"
    fi
}

# Export functions
export -f pipeline_exec
export -f execute_stage
export -f tas_exec
export -f tas_dispatch
export -f conditional_exec
export -f parallel_exec
