#!/usr/bin/env bash
# recording.sh - Terminal recording operations
# Usage: tut recording <verb> [args]

_tut_recording() {
    local verb="${1:-help}"
    shift || true

    case "$verb" in
        list|ls)     _tut_recording_list "$@" ;;
        play|p)      _tut_recording_play "$@" ;;
        capture|c)   _tut_recording_capture "$@" ;;
        help|"")     _tut_recording_help ;;
        *)
            _tut_error "Unknown: recording $verb"
            _tut_recording_help
            return 1
            ;;
    esac
}

_tut_recording_help() {
    _tut_heading 2 "tut recording"
    echo
    echo "  Manage terminal recordings"
    echo
    _tut_section "COMMANDS"
    echo "  list, ls      List recordings"
    echo "  play, p       Play back recording"
    echo "  capture, c    Start new recording"
    echo
    _tut_section "EXAMPLES"
    echo "  tut recording list"
    echo "  tut recording play demo-session"
    echo "  tut recording capture my-tutorial"
}

# =============================================================================
# LIST
# =============================================================================

_tut_recording_list() {
    _tut_heading 2 "Recordings"
    echo

    if [[ -d "$TUT_DIR/recordings" ]]; then
        local count=0
        shopt -s nullglob
        for dir in "$TUT_DIR/recordings"/*/; do
            if [[ -d "$dir" ]]; then
                local name=$(basename "$dir")
                local flags=""
                [[ -f "$dir/typescript.txt" ]] && flags+="ts "
                [[ -f "$dir/timing.txt" ]] && flags+="tm"
                _tut_row "$name" "[$flags]" ""
                ((count++))
            fi
        done
        shopt -u nullglob

        if [[ $count -eq 0 ]]; then
            _tut_dim "  (none)"; echo
        else
            echo
            _tut_info "Total: $count recording(s)"
        fi
    else
        _tut_warn "No recordings directory"
    fi
}

# =============================================================================
# PLAY
# =============================================================================

_tut_recording_play() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: tut recording play <name>"
        return 1
    fi

    local rec_dir="$TUT_DIR/recordings/$name"

    if [[ ! -d "$rec_dir" ]]; then
        _tut_error "Recording not found: $name"
        return 1
    fi

    if [[ -f "$rec_dir/typescript.txt" && -f "$rec_dir/timing.txt" ]]; then
        _tut_info "Playing recording: $name"
        echo "Press Ctrl+C to stop"
        echo
        scriptreplay "$rec_dir/timing.txt" "$rec_dir/typescript.txt"
    else
        _tut_error "Recording incomplete (missing typescript or timing file)"
        return 1
    fi
}

# =============================================================================
# CAPTURE
# =============================================================================

_tut_recording_capture() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: tut recording capture <name>"
        return 1
    fi

    local rec_dir="$TUT_DIR/recordings/$name"

    if [[ -d "$rec_dir" ]]; then
        _tut_warn "Recording exists: $name"
        echo -n "Overwrite? [y/N] "
        read -r response
        [[ "$response" != "y" && "$response" != "Y" ]] && return 1
        rm -rf "$rec_dir"
    fi

    mkdir -p "$rec_dir"

    _tut_info "Starting recording: $name"
    echo "Type 'exit' to stop recording"
    echo

    script -t 2>"$rec_dir/timing.txt" "$rec_dir/typescript.txt"

    _tut_success "Recording saved: $rec_dir"
}
