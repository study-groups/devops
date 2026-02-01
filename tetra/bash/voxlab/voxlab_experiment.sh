#!/usr/bin/env bash

# voxlab_experiment.sh - Experiment lifecycle management

_voxlab_experiment_id() {
    # Generate experiment ID: pipeline_epoch
    local pipeline="$1"
    local epoch
    epoch=$(date +%s)
    echo "${pipeline}_${epoch}"
}

_voxlab_run() {
    local pipeline="${1:?Usage: voxlab run <pipeline> <golden_ref> [--param=val ...]}"
    local golden_ref="${2:?Usage: voxlab run <pipeline> <golden_ref> [--param=val ...]}"
    shift 2

    # Resolve pipeline
    local pipeline_file="$VOXLAB_DIR/pipelines/${pipeline}.json"
    if [[ ! -f "$pipeline_file" ]]; then
        echo "voxlab: pipeline '$pipeline' not found" >&2
        echo "  Use 'voxlab pipeline define $pipeline ...' first" >&2
        return 1
    fi

    # Resolve golden reference
    local golden_dir
    golden_dir=$(_voxlab_golden_resolve "$golden_ref")
    if [[ $? -ne 0 ]]; then
        echo "voxlab: golden ref '$golden_ref' not found" >&2
        return 1
    fi

    # Parse --param=val args into JSON
    local -A params=()
    local arg
    for arg in "$@"; do
        if [[ "$arg" == --*=* ]]; then
            local key="${arg%%=*}"
            key="${key#--}"
            local val="${arg#*=}"
            params["$key"]="$val"
        fi
    done

    # Create experiment directory
    local exp_id
    exp_id=$(_voxlab_experiment_id "$pipeline")
    local exp_dir="$VOXLAB_DIR/experiments/$exp_id"
    mkdir -p "$exp_dir"/{checkpoints,outputs}

    # Build config.json
    local config="$exp_dir/config.json"
    {
        echo "{"
        echo "  \"experiment_id\": \"$exp_id\","
        echo "  \"pipeline\": \"$pipeline\","
        echo "  \"golden_ref\": \"$golden_ref\","
        echo "  \"golden_dir\": \"$golden_dir\","
        echo "  \"created\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
        echo "  \"params\": {"
        local first=true
        local k
        for k in "${!params[@]}"; do
            $first || echo ","
            first=false
            printf '    "%s": "%s"' "$k" "${params[$k]}"
        done
        echo ""
        echo "  },"
        # Include trigger config if triggers exist
        echo "  \"triggers\": $(cat "$VOXLAB_DIR/logs/triggers.json" 2>/dev/null || echo '[]')"
        echo "}"
    } > "$config"

    # Log experiment start
    _voxlab_log_event "start" "$exp_id" "$pipeline" "$golden_ref"

    echo "voxlab: experiment $exp_id"
    echo "  pipeline: $pipeline"
    echo "  golden:   $golden_ref"
    echo "  dir:      $exp_dir"

    # Run the trainer
    local python_cmd="python3"
    if [[ -n "${TETRA_PYTHON_VENV:-}" && -f "$TETRA_PYTHON_VENV/bin/python3" ]]; then
        python_cmd="$TETRA_PYTHON_VENV/bin/python3"
    fi

    echo "  starting trainer..."
    $python_cmd "$VOXLAB_SRC/python/train.py" \
        --config "$config" \
        --output "$exp_dir/run.ndjson" \
        --checkpoint-dir "$exp_dir/checkpoints" \
        2>&1 | while IFS= read -r line; do
            echo "  $line"
        done
    local rc=${PIPESTATUS[0]}

    if [[ $rc -eq 0 ]]; then
        _voxlab_log_event "complete" "$exp_id"
        echo "  status: complete"
    else
        _voxlab_log_event "failed" "$exp_id" "exit_code=$rc"
        echo "  status: failed (rc=$rc)"
    fi

    return $rc
}

_voxlab_ls() {
    local exp_dir="$VOXLAB_DIR/experiments"
    if [[ ! -d "$exp_dir" ]] || [[ -z "$(ls -A "$exp_dir" 2>/dev/null)" ]]; then
        echo "No experiments found."
        return 0
    fi

    printf "%-40s %-10s %-12s %-10s\n" "EXPERIMENT" "STATUS" "BEST_LOSS" "STEPS"
    printf "%-40s %-10s %-12s %-10s\n" "----------" "------" "---------" "-----"

    local d
    for d in "$exp_dir"/*/; do
        [[ -d "$d" ]] || continue
        local name
        name=$(basename "$d")
        local status="unknown"
        local best_loss="-"
        local steps="-"

        # Check summary first
        if [[ -f "$d/summary.json" ]]; then
            status="done"
            best_loss=$(grep -o '"best_loss":[^,}]*' "$d/summary.json" | head -1 | cut -d: -f2 | tr -d ' ')
            steps=$(grep -o '"total_steps":[^,}]*' "$d/summary.json" | head -1 | cut -d: -f2 | tr -d ' ')
        elif [[ -f "$d/run.ndjson" ]]; then
            local last_line
            last_line=$(tail -1 "$d/run.ndjson" 2>/dev/null)
            if [[ -n "$last_line" ]]; then
                status="complete"
                best_loss=$(grep -o '"loss":[^,}]*' <<< "$last_line" | cut -d: -f2 | tr -d ' ')
                steps=$(grep -o '"step":[^,}]*' <<< "$last_line" | cut -d: -f2 | tr -d ' ')
            fi
        elif [[ -f "$d/config.json" ]]; then
            status="created"
        fi

        printf "%-40s %-10s %-12s %-10s\n" "$name" "$status" "$best_loss" "$steps"
    done
}

_voxlab_status() {
    local exp_id="${1:?Usage: voxlab status <experiment_id>}"
    local exp_dir="$VOXLAB_DIR/experiments/$exp_id"

    if [[ ! -d "$exp_dir" ]]; then
        echo "voxlab: experiment '$exp_id' not found" >&2
        return 1
    fi

    echo "Experiment: $exp_id"

    if [[ -f "$exp_dir/config.json" ]]; then
        echo "Config:"
        cat "$exp_dir/config.json"
    fi

    if [[ -f "$exp_dir/summary.json" ]]; then
        echo ""
        echo "Summary:"
        cat "$exp_dir/summary.json"
    elif [[ -f "$exp_dir/run.ndjson" ]]; then
        local total
        total=$(wc -l < "$exp_dir/run.ndjson" | tr -d ' ')
        echo ""
        echo "Steps logged: $total"
        echo "Latest:"
        tail -3 "$exp_dir/run.ndjson"
    fi
}

_voxlab_logs() {
    local exp_id="${1:?Usage: voxlab logs <experiment_id> [--tail=N]}"
    shift
    local tail_n=20

    local arg
    for arg in "$@"; do
        if [[ "$arg" == --tail=* ]]; then
            tail_n="${arg#--tail=}"
        fi
    done

    local run_file="$VOXLAB_DIR/experiments/$exp_id/run.ndjson"
    if [[ ! -f "$run_file" ]]; then
        echo "voxlab: no logs for '$exp_id'" >&2
        return 1
    fi

    tail -n "$tail_n" "$run_file"
}

_voxlab_compare() {
    local exp1="${1:?Usage: voxlab compare <exp1> <exp2>}"
    local exp2="${2:?Usage: voxlab compare <exp1> <exp2>}"

    local dir1="$VOXLAB_DIR/experiments/$exp1"
    local dir2="$VOXLAB_DIR/experiments/$exp2"

    if [[ ! -d "$dir1" ]]; then
        echo "voxlab: experiment '$exp1' not found" >&2
        return 1
    fi
    if [[ ! -d "$dir2" ]]; then
        echo "voxlab: experiment '$exp2' not found" >&2
        return 1
    fi

    printf "%-20s %-20s %-20s\n" "" "$exp1" "$exp2"
    printf "%-20s %-20s %-20s\n" "" "----" "----"

    local loss1="-" loss2="-" steps1="-" steps2="-"

    if [[ -f "$dir1/run.ndjson" ]]; then
        local last1
        last1=$(tail -1 "$dir1/run.ndjson")
        loss1=$(grep -o '"loss":[^,}]*' <<< "$last1" | cut -d: -f2 | tr -d ' ')
        steps1=$(grep -o '"step":[^,}]*' <<< "$last1" | cut -d: -f2 | tr -d ' ')
    fi
    if [[ -f "$dir2/run.ndjson" ]]; then
        local last2
        last2=$(tail -1 "$dir2/run.ndjson")
        loss2=$(grep -o '"loss":[^,}]*' <<< "$last2" | cut -d: -f2 | tr -d ' ')
        steps2=$(grep -o '"step":[^,}]*' <<< "$last2" | cut -d: -f2 | tr -d ' ')
    fi

    printf "%-20s %-20s %-20s\n" "final_loss" "$loss1" "$loss2"
    printf "%-20s %-20s %-20s\n" "total_steps" "$steps1" "$steps2"
}

_voxlab_summarize() {
    local exp_id="${1:?Usage: voxlab summarize <experiment_id>}"
    local exp_dir="$VOXLAB_DIR/experiments/$exp_id"

    if [[ ! -d "$exp_dir" ]]; then
        echo "voxlab: experiment '$exp_id' not found" >&2
        return 1
    fi

    local run_file="$exp_dir/run.ndjson"
    if [[ ! -f "$run_file" ]]; then
        echo "voxlab: no run data for '$exp_id'" >&2
        return 1
    fi

    # Find best loss and total steps from ndjson
    local best_loss="999" total_steps=0 best_step=0
    while IFS= read -r line; do
        local loss step
        loss=$(grep -o '"loss":[^,}]*' <<< "$line" | cut -d: -f2 | tr -d ' ')
        step=$(grep -o '"step":[^,}]*' <<< "$line" | cut -d: -f2 | tr -d ' ')
        if [[ -n "$loss" && -n "$step" ]]; then
            total_steps="$step"
            if awk "BEGIN{exit !($loss < $best_loss)}"; then
                best_loss="$loss"
                best_step="$step"
            fi
        fi
    done < "$run_file"

    # Write summary
    local summary="$exp_dir/summary.json"
    cat > "$summary" <<EOF
{
  "experiment_id": "$exp_id",
  "best_loss": $best_loss,
  "best_step": $best_step,
  "total_steps": $total_steps,
  "summarized_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

    echo "Summary written: $summary"
    cat "$summary"

    # Clean up checkpoints (keep best only)
    local ckpt_dir="$exp_dir/checkpoints"
    if [[ -d "$ckpt_dir" ]]; then
        local count
        count=$(find "$ckpt_dir" -name '*.pt' | wc -l | tr -d ' ')
        if [[ $count -gt 1 && -f "$ckpt_dir/best.pt" ]]; then
            find "$ckpt_dir" -name 'step_*.pt' -delete
            echo "Pruned checkpoints (kept best.pt)"
        fi
    fi
}

_voxlab_prune() {
    local keep_best=5
    local older_than=""

    local arg
    for arg in "$@"; do
        case "$arg" in
            --keep-best=*) keep_best="${arg#--keep-best=}" ;;
            --older-than=*) older_than="${arg#--older-than=}" ;;
        esac
    done

    local exp_dir="$VOXLAB_DIR/experiments"
    [[ -d "$exp_dir" ]] || return 0

    # Collect experiments with their best loss
    local -a exps=()
    local d
    for d in "$exp_dir"/*/; do
        [[ -d "$d" ]] || continue
        local name
        name=$(basename "$d")

        # Check age if --older-than specified
        if [[ -n "$older_than" ]]; then
            local days="${older_than%d}"
            local config_time
            config_time=$(stat -f %m "$d/config.json" 2>/dev/null || stat -c %Y "$d/config.json" 2>/dev/null)
            local now
            now=$(date +%s)
            local age_days=$(( (now - config_time) / 86400 ))
            if [[ $age_days -lt $days ]]; then
                continue
            fi
        fi

        local loss="999"
        if [[ -f "$d/summary.json" ]]; then
            loss=$(grep -o '"best_loss":[^,}]*' "$d/summary.json" | cut -d: -f2 | tr -d ' ')
        elif [[ -f "$d/run.ndjson" ]]; then
            local last
            last=$(tail -1 "$d/run.ndjson")
            loss=$(grep -o '"loss":[^,}]*' <<< "$last" | cut -d: -f2 | tr -d ' ')
        fi
        exps+=("$loss:$name")
    done

    # Sort by loss, keep best N
    local sorted
    sorted=$(printf '%s\n' "${exps[@]}" | sort -t: -k1 -n)
    local count=0
    local pruned=0
    while IFS= read -r entry; do
        [[ -z "$entry" ]] && continue
        count=$((count + 1))
        if [[ $count -gt $keep_best ]]; then
            local name="${entry#*:}"
            rm -rf "$exp_dir/$name"
            pruned=$((pruned + 1))
            echo "Pruned: $name"
        fi
    done <<< "$sorted"

    echo "Pruned $pruned experiments (kept best $keep_best)"
}

_voxlab_sweep() {
    local pipeline="${1:?Usage: voxlab sweep <pipeline> <golden_ref> --param k=v1,v2 ...}"
    local golden_ref="${2:?Usage: voxlab sweep <pipeline> <golden_ref> --param k=v1,v2 ...}"
    shift 2

    # Parse --param key=val1,val2 args
    local -A sweep_params=()
    local arg
    for arg in "$@"; do
        if [[ "$arg" == --param ]]; then
            continue
        fi
        if [[ "$arg" == *=* && "$arg" != --* ]]; then
            local key="${arg%%=*}"
            local vals="${arg#*=}"
            sweep_params["$key"]="$vals"
        fi
    done

    if [[ ${#sweep_params[@]} -eq 0 ]]; then
        echo "voxlab: no sweep params specified" >&2
        return 1
    fi

    # Generate parameter combinations (simple: one param at a time)
    echo "voxlab sweep: $pipeline / $golden_ref"
    local k
    for k in "${!sweep_params[@]}"; do
        local IFS=','
        local vals
        read -ra vals <<< "${sweep_params[$k]}"
        local v
        for v in "${vals[@]}"; do
            echo "  running: --$k=$v"
            voxlab run "$pipeline" "$golden_ref" "--$k=$v"
            echo ""
        done
    done
}

_voxlab_log_event() {
    local event="$1"
    shift
    local log_file="$VOXLAB_DIR/logs/experiments.ndjson"
    mkdir -p "$(dirname "$log_file")"
    local ts
    ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    printf '{"event":"%s","ts":"%s","args":[%s]}\n' \
        "$event" "$ts" \
        "$(printf '"%s",' "$@" | sed 's/,$//')" \
        >> "$log_file"
}

export -f _voxlab_run _voxlab_ls _voxlab_status
export -f _voxlab_logs _voxlab_compare _voxlab_summarize _voxlab_prune
export -f _voxlab_sweep _voxlab_log_event _voxlab_experiment_id
