#!/usr/bin/env bash

# voxlab.sh - CLI dispatcher for ML experiment tracking

voxlab() {
    local cmd="${1:-help}"
    shift || true

    case "$cmd" in
        run)              _voxlab_run "$@" ;;
        ls|list)          _voxlab_ls "$@" ;;
        status)           _voxlab_status "$@" ;;
        logs)             _voxlab_logs "$@" ;;
        compare)          _voxlab_compare "$@" ;;
        summarize)        _voxlab_summarize "$@" ;;
        notebook|nb)      _voxlab_notebook "$@" ;;
        prune)            _voxlab_prune "$@" ;;
        pipeline|pipe)    _voxlab_pipeline_cmd "$@" ;;
        golden|gold)      _voxlab_golden_cmd "$@" ;;
        trigger|trig)     _voxlab_trigger_cmd "$@" ;;
        sweep)            _voxlab_sweep "$@" ;;
        help|--help|-h)   _voxlab_help ;;
        *)
            echo "voxlab: unknown command '$cmd'" >&2
            _voxlab_help
            return 1
            ;;
    esac
}

_voxlab_help() {
    cat <<'EOF'
voxlab - ML Experiment Tracking + TTS Pipeline Composition

USAGE:
    voxlab <command> [arguments]

EXPERIMENTS:
    run <pipeline> <golden_ref> [--param=val ...]   Run experiment
    ls                                               List experiments
    status <experiment_id>                           Show experiment status
    logs <experiment_id> [--tail=N]                  Tail run log
    compare <exp1> <exp2>                            Compare experiments
    summarize <experiment_id>                        Freeze summary
    notebook <experiment_id>                          Generate notebook.md
    prune [--keep-best=N] [--older-than=Nd]          Cleanup old experiments

PIPELINES:
    pipeline define <name> <stage1> <stage2> ...     Define pipeline
    pipeline list                                    List pipelines
    pipeline show <name>                             Show pipeline stages

GOLDEN REFERENCES:
    golden create <text> [voice_spec]                Create golden ref
    golden list                                      List golden refs
    golden compare <golden_id> <audio_file>          Compare to golden

TRIGGERS:
    trigger add <name> --type=TYPE --value=X --action=ACTION
    trigger list                                     List triggers

SWEEPS:
    sweep <pipeline> <golden> --param k=v1,v2 ...    Parameter sweep

    help          Show this help
EOF
}

_voxlab_notebook() {
    local exp_id="${1:?Usage: voxlab notebook <experiment_id>}"
    local exp_dir="$VOXLAB_DIR/experiments/$exp_id"

    if [[ ! -d "$exp_dir" ]]; then
        echo "voxlab: experiment '$exp_id' not found" >&2
        return 1
    fi

    local nb="$exp_dir/notebook.md"
    local config="$exp_dir/config.json"
    local run_file="$exp_dir/run.ndjson"
    local summary="$exp_dir/summary.json"
    local now
    now=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # --- Extract config fields ---
    local pipeline="" golden_ref="" golden_dir="" created=""
    local -A params=()
    if [[ -f "$config" ]]; then
        pipeline=$(python3 -c "import json; print(json.load(open('$config')).get('pipeline',''))" 2>/dev/null)
        golden_ref=$(python3 -c "import json; print(json.load(open('$config')).get('golden_ref',''))" 2>/dev/null)
        golden_dir=$(python3 -c "import json; print(json.load(open('$config')).get('golden_dir',''))" 2>/dev/null)
        created=$(python3 -c "import json; print(json.load(open('$config')).get('created',''))" 2>/dev/null)
    fi

    # --- Extract golden text ---
    local golden_text=""
    if [[ -n "$golden_dir" && -f "$golden_dir/text.txt" ]]; then
        golden_text=$(cat "$golden_dir/text.txt")
    fi

    # --- Extract pipeline stages ---
    local stages=""
    local pipe_file="$VOXLAB_DIR/pipelines/${pipeline}.json"
    if [[ -f "$pipe_file" ]]; then
        stages=$(python3 -c "
import json
p = json.load(open('$pipe_file'))
print(' → '.join(p.get('stages',[])))
" 2>/dev/null)
    fi

    # --- Extract run stats ---
    local total_steps=0 first_loss="" final_loss="" best_loss="999"
    local trigger_events=""
    if [[ -f "$run_file" ]]; then
        total_steps=$(wc -l < "$run_file" | tr -d ' ')

        first_loss=$(head -1 "$run_file" | python3 -c "import json,sys; print(json.load(sys.stdin).get('loss',''))" 2>/dev/null)
        final_loss=$(tail -1 "$run_file" | python3 -c "import json,sys; print(json.load(sys.stdin).get('loss',''))" 2>/dev/null)

        # Best loss + trigger events
        python3 -c "
import json, sys
best = float('inf')
triggers = []
for line in open('$run_file'):
    d = json.loads(line)
    loss = d.get('loss', float('inf'))
    if loss < best:
        best = loss
    if 'trigger' in d:
        triggers.append(f\"step {d['step']}: {d['trigger']}\")
print(f'BEST:{best}')
# Deduplicate consecutive identical triggers
seen = set()
unique = []
for t in triggers:
    if t not in seen:
        seen.add(t)
        unique.append(t)
for t in unique[:10]:
    print(f'TRIG:{t}')
" 2>/dev/null | while IFS= read -r line; do
            if [[ "$line" == BEST:* ]]; then
                best_loss="${line#BEST:}"
            fi
        done

        # Re-extract since subshell lost the var
        best_loss=$(python3 -c "
import json
best = float('inf')
for line in open('$run_file'):
    d = json.loads(line)
    loss = d.get('loss', float('inf'))
    if loss < best: best = loss
print(round(best, 6))
" 2>/dev/null)

        trigger_events=$(python3 -c "
import json
seen = {}
for line in open('$run_file'):
    d = json.loads(line)
    if 'trigger' in d:
        key = d['trigger']
        step = d['step']
        if key not in seen:
            seen[key] = {'first': step, 'last': step, 'count': 1}
        else:
            seen[key]['last'] = step
            seen[key]['count'] += 1
for name, info in seen.items():
    if info['count'] == 1:
        print(f\"- **{name}** fired at step {info['first']}\")
    else:
        print(f\"- **{name}** fired {info['count']}x (steps {info['first']}–{info['last']})\")
" 2>/dev/null)
    fi

    # --- Check for samples ---
    local samples_section=""
    local has_samples=false
    for phase in before during after; do
        if [[ -f "$exp_dir/outputs/sample_${phase}.wav" ]]; then
            has_samples=true
        fi
    done

    # --- Check for summary ---
    local summary_block=""
    if [[ -f "$summary" ]]; then
        summary_block=$(cat "$summary")
    fi

    # --- Write notebook ---
    cat > "$nb" <<NOTEBOOK
# Experiment: $exp_id

Generated: $now

---

## Input

| Field | Value |
|-------|-------|
| Pipeline | \`$pipeline\` |
| Stages | $stages |
| Golden ref | \`$golden_ref\` |
| Created | $created |

### Parameters

\`\`\`json
$(python3 -c "import json; print(json.dumps(json.load(open('$config')).get('params',{}), indent=2))" 2>/dev/null || echo '{}')
\`\`\`

### Golden Reference

$(if [[ -n "$golden_text" ]]; then
    echo '> '"$golden_text"
else
    echo '*No golden text available.*'
fi)

$(if [[ -n "$golden_dir" ]]; then
    echo "Source: \`$golden_dir\`"
    local gfiles
    gfiles=$(ls "$golden_dir" 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
    echo "Files: $gfiles"
fi)

### Triggers

\`\`\`json
$(python3 -c "import json; print(json.dumps(json.load(open('$config')).get('triggers',[]), indent=2))" 2>/dev/null || echo '[]')
\`\`\`

---

## Testing

| Metric | Value |
|--------|-------|
| Total steps | $total_steps |
| Initial loss | $first_loss |
| Best loss | $best_loss |
| Final loss | $final_loss |

### Loss Curve (first 5 → last 5)

\`\`\`
$(if [[ -f "$run_file" ]]; then
    echo "--- first 5 steps ---"
    head -5 "$run_file" | python3 -c "
import json, sys
for line in sys.stdin:
    d = json.loads(line)
    print(f\"  step {d['step']:>4d}  epoch {d['epoch']}  loss {d['loss']:.6f}  val_loss {d['val_loss']:.6f}\")
" 2>/dev/null
    echo ""
    echo "--- last 5 steps ---"
    tail -5 "$run_file" | python3 -c "
import json, sys
for line in sys.stdin:
    d = json.loads(line)
    t = f\"  trigger={d['trigger']}\" if 'trigger' in d else ''
    print(f\"  step {d['step']:>4d}  epoch {d['epoch']}  loss {d['loss']:.6f}  val_loss {d['val_loss']:.6f}{t}\")
" 2>/dev/null
fi)
\`\`\`

### Trigger Events

$(if [[ -n "$trigger_events" ]]; then
    echo "$trigger_events"
else
    echo "*No triggers fired.*"
fi)

---

## Output

### Voice Samples

| Phase | File | Description |
|-------|------|-------------|
$(if [[ -f "$exp_dir/outputs/sample_before.wav" ]]; then
    local sz; sz=$(wc -c < "$exp_dir/outputs/sample_before.wav" | tr -d ' ')
    echo "| Before | \`outputs/sample_before.wav\` (${sz}B) | Untrained model output — noisy, off-pitch |"
else
    echo "| Before | — | Not generated |"
fi)
$(if [[ -f "$exp_dir/outputs/sample_during.wav" ]]; then
    local sz; sz=$(wc -c < "$exp_dir/outputs/sample_during.wav" | tr -d ' ')
    echo "| During | \`outputs/sample_during.wav\` (${sz}B) | Mid-training — tone emerging, some noise |"
else
    echo "| During | — | Not generated |"
fi)
$(if [[ -f "$exp_dir/outputs/sample_after.wav" ]]; then
    local sz; sz=$(wc -c < "$exp_dir/outputs/sample_after.wav" | tr -d ' ')
    echo "| After | \`outputs/sample_after.wav\` (${sz}B) | Trained model output — clean target tone |"
else
    echo "| After | — | Not generated |"
fi)

### Checkpoints

$(if [[ -d "$exp_dir/checkpoints" ]]; then
    local ckpts
    ckpts=$(ls "$exp_dir/checkpoints"/*.pt 2>/dev/null | wc -l | tr -d ' ')
    echo "$ckpts checkpoint file(s) in \`checkpoints/\`"
    if [[ -f "$exp_dir/checkpoints/best.pt" ]]; then
        echo "- \`best.pt\` — best model weights"
    fi
else
    echo "*No checkpoints.*"
fi)

### Summary

$(if [[ -n "$summary_block" ]]; then
    echo '```json'
    echo "$summary_block"
    echo '```'
else
    echo "*Run \`voxlab summarize $exp_id\` to generate.*"
fi)

### Files

\`\`\`
$(ls -lh "$exp_dir"/ "$exp_dir"/outputs/ "$exp_dir"/checkpoints/ 2>/dev/null | grep -v '^total' | grep -v '^$')
\`\`\`
NOTEBOOK

    echo "Notebook: $nb"
}

export -f voxlab _voxlab_help _voxlab_notebook
