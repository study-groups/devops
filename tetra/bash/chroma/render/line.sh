#!/usr/bin/env bash
# Chroma - Line rendering dispatcher
# Part of the chroma modular markdown renderer

# Render a single classified line
_chroma_render_line() {
    local classified="$1"
    local pad="$2"
    local width="$3"

    # Parse type:level:content
    local type="${classified%%:*}"
    local rest="${classified#*:}"
    local level="${rest%%:*}"
    local content="${rest#*:}"

    # Pre-line hook
    _chroma_run_hooks pre_line "$type" "$level" "$content" "$pad" "$width"

    # Transform content through registered hooks
    content=$(_chroma_run_transform_hooks "transform_content" "$content")

    # Handle table state transitions
    if [[ "$type" != table.* ]] && (( _CHROMA_IN_TABLE )); then
        _chroma_flush_table "$pad" "$width"
    fi

    case "$type" in
        table.row)
            _CHROMA_IN_TABLE=1
            _CHROMA_TABLE_ROWS+=("$content")
            return  # Don't render yet, accumulate
            ;;

        table.sep)
            # Parse alignment from separator
            _chroma_parse_table_align "$content" _CHROMA_TABLE_ALIGNS
            return  # Don't render separator, just store alignment
            ;;

        heading)
            # Try plugin hook first
            if ! _chroma_run_hooks render_heading "$level" "$content" "$pad"; then
                _chroma_color "$(_chroma_token heading.$level)"
                printf '%s' "$pad"
                # Add # prefix for visual hierarchy
                local prefix=""
                for ((h=0; h<level; h++)); do prefix+="#"; done
                printf '%s %s' "$prefix" "$content"
                _chroma_reset
                echo
            fi
            ;;

        code.start)
            _chroma_color "$(_chroma_token code.fence)"
            printf '%s```%s' "$pad" "$level"
            _chroma_reset
            echo
            ;;

        code.end)
            _chroma_color "$(_chroma_token code.fence)"
            printf '%s```' "$pad"
            _chroma_reset
            echo
            ;;

        code.line)
            # Try plugin hook first (for syntax highlighting)
            if ! _chroma_run_hooks render_code "$_CHROMA_CODE_LANG" "$content" "$pad"; then
                _chroma_color "$(_chroma_token code.block)"
                printf '%s  %s' "$pad" "$content"
                _chroma_reset
                echo
            fi
            ;;

        quote)
            # Try plugin hook first
            if ! _chroma_run_hooks render_quote "$content" "$pad"; then
                _chroma_color "$(_chroma_token quote)"
                printf '%s│ ' "$pad"
                _chroma_inline "$content" "quote"
                _chroma_reset
                echo
            fi
            ;;

        list.bullet)
            # Try plugin hook first
            if ! _chroma_run_hooks render_list "bullet" "$content" "$pad"; then
                # Check if pattern matching is enabled and content matches a pattern
                if (( CHROMA_PATTERNS_ENABLED )) && _chroma_pattern_match "$content"; then
                    # Pattern matched - render bullet + styled content
                    printf '%s' "$pad"
                    _chroma_color "$(_chroma_token list.bullet)"
                    printf '• '
                    _chroma_reset
                    _chroma_render_pattern "$content" "text" "$((width - ${#pad} - 2))"
                    echo
                else
                    # No pattern match - use standard bullet list rendering
                    local bullet_indent="  "  # 2 spaces to align with text after "• "
                    local list_width=$((width - ${#pad} - 2))  # Account for "• "
                    local wrapped_lines
                    mapfile -t wrapped_lines < <(_chroma_word_wrap "$content" "$list_width" "")

                    local first=1
                    for wline in "${wrapped_lines[@]}"; do
                        printf '%s' "$pad"
                        if (( first )); then
                            _chroma_color "$(_chroma_token list.bullet)"
                            printf '• '
                            _chroma_reset
                            first=0
                        else
                            printf '%s' "$bullet_indent"
                        fi
                        _chroma_color "$(_chroma_token text)"
                        _chroma_inline "$wline" "text"
                        _chroma_reset
                        echo
                    done
                fi
            fi
            ;;

        list.number)
            # Try plugin hook first
            if ! _chroma_run_hooks render_list "number" "$content" "$pad" "$level"; then
                # Check if pattern matching is enabled and content matches a pattern
                if (( CHROMA_PATTERNS_ENABLED )) && _chroma_pattern_match "$content"; then
                    if (( CHROMA_TRUNCATE )); then
                        # Truncate mode - single line with truncated content
                        local num_prefix="${level}. "
                        printf '%s' "$pad"
                        _chroma_color "$(_chroma_token pattern.number)"
                        printf '%s' "$num_prefix"
                        _chroma_reset
                        _chroma_render_pattern "$content" "text" "$((width - ${#pad} - ${#num_prefix}))"
                        echo
                    else
                        # Expanded mode - header line + full wrapped content
                        _chroma_render_pattern_expanded "$level" "$content" "$pad" "$width"
                    fi
                else
                    # No pattern match - use standard numbered list rendering
                    local num_prefix="${level}. "
                    local num_indent
                    printf -v num_indent "%*s" "${#num_prefix}" ""  # Match number prefix width
                    local list_width=$((width - ${#pad} - ${#num_prefix}))
                    local wrapped_lines
                    mapfile -t wrapped_lines < <(_chroma_word_wrap "$content" "$list_width" "")

                    local first=1
                    for wline in "${wrapped_lines[@]}"; do
                        printf '%s' "$pad"
                        if (( first )); then
                            _chroma_color "$(_chroma_token list.number)"
                            printf '%s' "$num_prefix"
                            _chroma_reset
                            first=0
                        else
                            printf '%s' "$num_indent"
                        fi
                        _chroma_color "$(_chroma_token text)"
                        _chroma_inline "$wline" "text"
                        _chroma_reset
                        echo
                    done
                fi
            fi
            ;;

        hr)
            # Try plugin hook first
            if ! _chroma_run_hooks render_hr "$pad" "$width"; then
                _chroma_color "$(_chroma_token hr)"
                printf '%s' "$pad"
                local hrlen=$((width - ${#pad}))
                printf '%*s' "$hrlen" '' | tr ' ' '─'
                _chroma_reset
                echo
            fi
            ;;

        blank)
            echo
            ;;

        text|*)
            # Check if pattern matching is enabled and content matches a pattern
            if (( CHROMA_PATTERNS_ENABLED )) && _chroma_pattern_match "$content"; then
                # Pattern matched - render with pattern styling
                printf '%s' "$pad"
                _chroma_render_pattern "$content" "text" "$((width - ${#pad}))" "$pad"
                echo
            else
                # No pattern match - word-wrap long lines
                local text_width=$((width - ${#pad}))
                local wrapped_lines
                mapfile -t wrapped_lines < <(_chroma_word_wrap "$content" "$text_width" "")

                local first=1
                for wline in "${wrapped_lines[@]}"; do
                    printf '%s' "$pad"
                    _chroma_color "$(_chroma_token text)"
                    _chroma_inline "$wline" "text"
                    _chroma_reset
                    echo
                done
            fi
            ;;
    esac

    # Post-line hook
    _chroma_run_hooks post_line "$type" "$level" "$content"
}
