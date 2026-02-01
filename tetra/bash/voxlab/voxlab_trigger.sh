#!/usr/bin/env bash

# voxlab_trigger.sh - Loss-based trigger system

_voxlab_trigger_cmd() {
    local subcmd="${1:-list}"
    shift || true

    case "$subcmd" in
        add)     _voxlab_trigger_add "$@" ;;
        list|ls) _voxlab_trigger_list "$@" ;;
        rm)      _voxlab_trigger_rm "$@" ;;
        help)    echo "Usage: voxlab trigger {add|list|rm} ..." ;;
        *)
            echo "voxlab trigger: unknown '$subcmd'" >&2
            return 1
            ;;
    esac
}

_voxlab_trigger_add() {
    local name="${1:?Usage: voxlab trigger add <name> --type=TYPE --value=X --action=ACTION}"
    shift

    local type="" value="" action=""
    local arg
    for arg in "$@"; do
        case "$arg" in
            --type=*)   type="${arg#--type=}" ;;
            --value=*)  value="${arg#--value=}" ;;
            --action=*) action="${arg#--action=}" ;;
        esac
    done

    if [[ -z "$type" || -z "$value" || -z "$action" ]]; then
        echo "voxlab: --type, --value, and --action required" >&2
        echo "  Types: threshold, plateau, divergence" >&2
        echo "  Actions: stop, checkpoint, alert" >&2
        return 1
    fi

    # Validate type
    case "$type" in
        threshold|plateau|divergence) ;;
        *)
            echo "voxlab: unknown trigger type '$type'" >&2
            return 1
            ;;
    esac

    # Validate action
    case "$action" in
        stop|checkpoint|alert) ;;
        *)
            echo "voxlab: unknown action '$action'" >&2
            return 1
            ;;
    esac

    # Load existing triggers
    local triggers_file="$VOXLAB_DIR/logs/triggers.json"
    mkdir -p "$(dirname "$triggers_file")"

    local triggers="[]"
    [[ -f "$triggers_file" ]] && triggers=$(cat "$triggers_file")

    # Append new trigger via python (safe JSON manipulation)
    local new_trigger
    new_trigger=$(printf '{"name":"%s","type":"%s","value":%s,"action":"%s"}' \
        "$name" "$type" "$value" "$action")

    python3 -c "
import json, sys
triggers = json.loads(sys.argv[1])
triggers.append(json.loads(sys.argv[2]))
print(json.dumps(triggers, indent=2))
" "$triggers" "$new_trigger" > "$triggers_file"

    echo "Trigger '$name' added: $type @ $value → $action"

    # Log event
    _voxlab_log_event "trigger_add" "$name" "$type" "$value" "$action"
}

_voxlab_trigger_list() {
    local triggers_file="$VOXLAB_DIR/logs/triggers.json"

    if [[ ! -f "$triggers_file" ]]; then
        echo "No triggers defined."
        echo "  Use 'voxlab trigger add <name> --type=... --value=... --action=...'"
        return 0
    fi

    printf "%-20s %-12s %-10s %-10s\n" "NAME" "TYPE" "VALUE" "ACTION"
    printf "%-20s %-12s %-10s %-10s\n" "----" "----" "-----" "------"

    python3 -c "
import json, sys
triggers = json.load(open(sys.argv[1]))
for t in triggers:
    print(f\"{t['name']:<20s} {t['type']:<12s} {str(t['value']):<10s} {t['action']:<10s}\")
" "$triggers_file"
}

_voxlab_trigger_rm() {
    local name="${1:?Usage: voxlab trigger rm <name>}"
    local triggers_file="$VOXLAB_DIR/logs/triggers.json"

    if [[ ! -f "$triggers_file" ]]; then
        echo "No triggers defined." >&2
        return 1
    fi

    python3 -c "
import json, sys
triggers = json.load(open(sys.argv[1]))
triggers = [t for t in triggers if t['name'] != sys.argv[2]]
with open(sys.argv[1], 'w') as f:
    json.dump(triggers, f, indent=2)
print(f'Trigger \"{sys.argv[2]}\" removed.')
" "$triggers_file" "$name"
}

export -f _voxlab_trigger_cmd _voxlab_trigger_add _voxlab_trigger_list _voxlab_trigger_rm
