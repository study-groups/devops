#!/usr/bin/env bash
# tps/core/segments.sh - Segment area registry
#
# Areas:
#   info  - Above context line (status indicators, duration)
#   right - Right-aligned (future use)

# Segment registries: key=name, value="priority:function"
declare -gA _TPS_SEGMENTS_INFO=()
declare -gA _TPS_SEGMENTS_RIGHT=()

# Register a segment
# Usage: tps_register_segment <area> <priority> <name> <function>
# Priority: 0-99, lower renders first (left-to-right)
tps_register_segment() {
    local area="$1"
    local priority="$2"
    local name="$3"
    local func="$4"

    if ! declare -f "$func" &>/dev/null; then
        echo "tps_register_segment: function not found: $func" >&2
        return 1
    fi

    case "$area" in
        info)
            _TPS_SEGMENTS_INFO["$name"]="$priority:$func"
            ;;
        right)
            _TPS_SEGMENTS_RIGHT["$name"]="$priority:$func"
            ;;
        *)
            echo "tps_register_segment: unknown area: $area" >&2
            echo "  Valid: info, right" >&2
            return 1
            ;;
    esac
}

# Unregister a segment
tps_unregister_segment() {
    local area="$1"
    local name="$2"

    case "$area" in
        info)  unset "_TPS_SEGMENTS_INFO[$name]" ;;
        right) unset "_TPS_SEGMENTS_RIGHT[$name]" ;;
    esac
}

# Render all segments in an area (returns concatenated output)
# Usage: output=$(tps_render_area <area>)
tps_render_area() {
    local area="$1"
    local -n segs_ref

    case "$area" in
        info)  segs_ref=_TPS_SEGMENTS_INFO ;;
        right) segs_ref=_TPS_SEGMENTS_RIGHT ;;
        *)     return 1 ;;
    esac

    [[ ${#segs_ref[@]} -eq 0 ]] && return 0

    # Collect outputs sorted by priority
    local sorted=() output=""
    local name entry
    for name in "${!segs_ref[@]}"; do
        sorted+=("${segs_ref[$name]}:$name")
    done

    while IFS=: read -r priority func name; do
        local seg_output
        seg_output=$("$func" 2>/dev/null)
        [[ -n "$seg_output" ]] && output+="$seg_output "
    done < <(printf '%s\n' "${sorted[@]}" | sort -t: -k1 -n)

    # Trim trailing space
    echo "${output% }"
}

# List registered segments (diagnostic)
tps_segment_list() {
    echo "TPS Segments"
    echo "============"
    echo ""
    echo "info area:"
    if [[ ${#_TPS_SEGMENTS_INFO[@]} -eq 0 ]]; then
        echo "  (none)"
    else
        for name in "${!_TPS_SEGMENTS_INFO[@]}"; do
            local entry="${_TPS_SEGMENTS_INFO[$name]}"
            local priority="${entry%%:*}"
            local func="${entry#*:}"
            printf "  [%2d] %-15s %s\n" "$priority" "$name" "$func"
        done
    fi
    echo ""
    echo "right area:"
    if [[ ${#_TPS_SEGMENTS_RIGHT[@]} -eq 0 ]]; then
        echo "  (none)"
    else
        for name in "${!_TPS_SEGMENTS_RIGHT[@]}"; do
            local entry="${_TPS_SEGMENTS_RIGHT[$name]}"
            local priority="${entry%%:*}"
            local func="${entry#*:}"
            printf "  [%2d] %-15s %s\n" "$priority" "$name" "$func"
        done
    fi
}

export -f tps_register_segment tps_unregister_segment tps_render_area tps_segment_list
