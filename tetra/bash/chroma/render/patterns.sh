#!/usr/bin/env bash
# Chroma - Pattern Grammar System
# Generic pattern detection and styling for text

#==============================================================================
# PATTERN REGISTRY
#==============================================================================

# Pattern definitions: name → regex
declare -gA CHROMA_PATTERNS=()

# Pattern token mappings: name → space-separated list of tokens for each group
declare -gA CHROMA_PATTERN_TOKENS=()

# Pattern guard functions: name → guard_function_name
declare -gA CHROMA_PATTERN_GUARDS=()

# Pattern order (first match wins)
declare -ga CHROMA_PATTERN_ORDER=()

# Enable/disable patterns
declare -g CHROMA_PATTERNS_ENABLED="${CHROMA_PATTERNS_ENABLED:-1}"

#==============================================================================
# PATTERN REGISTRATION
#==============================================================================

# Register a pattern
# Usage: chroma_pattern_register <name> <regex> <tokens...> [--guard <func>]
# Tokens are applied to capture groups in order
# Example: chroma_pattern_register "numbered_item" '^([0-9]+)\. (.+) – (.+)$' "pattern.number" "pattern.topic" "pattern.desc"
# Example with guard: chroma_pattern_register "topic_desc" '^...$' "t1" "t2" --guard "_chroma_guard_topic"
chroma_pattern_register() {
    local name="$1"
    local regex="$2"
    shift 2

    [[ -z "$name" || -z "$regex" ]] && {
        echo "Usage: chroma_pattern_register <name> <regex> <tokens...> [--guard <func>]" >&2
        return 1
    }

    # Parse tokens and --guard option
    local tokens="" guard=""
    while (( $# )); do
        if [[ "$1" == "--guard" ]]; then
            shift
            guard="$1"
        else
            tokens+="${tokens:+ }$1"
        fi
        shift
    done

    CHROMA_PATTERNS["$name"]="$regex"
    CHROMA_PATTERN_TOKENS["$name"]="$tokens"
    [[ -n "$guard" ]] && CHROMA_PATTERN_GUARDS["$name"]="$guard"

    # Add to order if not present
    local found=0
    for p in "${CHROMA_PATTERN_ORDER[@]}"; do
        [[ "$p" == "$name" ]] && { found=1; break; }
    done
    (( found )) || CHROMA_PATTERN_ORDER+=("$name")
}

# Remove a pattern
chroma_pattern_remove() {
    local name="$1"
    unset "CHROMA_PATTERNS[$name]"
    unset "CHROMA_PATTERN_TOKENS[$name]"
    unset "CHROMA_PATTERN_GUARDS[$name]"

    local new_order=()
    for p in "${CHROMA_PATTERN_ORDER[@]}"; do
        [[ "$p" != "$name" ]] && new_order+=("$p")
    done
    CHROMA_PATTERN_ORDER=("${new_order[@]}")
}

#==============================================================================
# GUARD FUNCTIONS
#==============================================================================

# Guard for topic_desc pattern - rejects prose masquerading as topics
# $1 = topic (first capture group)
# Returns 0 if valid topic, 1 if prose
_chroma_guard_topic() {
    local topic="$1"
    local lower="${topic,,}"

    # Reject common sentence starters
    [[ "$lower" =~ ^(this|that|it|these|those|there|here|i|we|you|a|an|the)[[:space:]] ]] && return 1

    # Reject if > 5 words (topics are short)
    local spaces="${topic//[^ ]}"
    (( ${#spaces} > 4 )) && return 1

    return 0
}

#==============================================================================
# BUILT-IN PATTERNS
#==============================================================================

# Initialize built-in patterns
_chroma_init_patterns() {
    # Bracketed ID format: [ID: action content...]
    # Matches: "[1765923743: update content here...]"
    chroma_pattern_register "bracketed_id" \
        '^\[([0-9]+): ([a-z_]+) (.+)$' \
        "pattern.number" "pattern.key" "pattern.desc"

    # Simple bracketed ID: [ID: ] or [ID: optional text]
    # Matches: "[1765923743: ]" or "[1765923743: some text]"
    chroma_pattern_register "bracketed_id_simple" \
        '^\[([0-9]+): ?(.*)?\]$' \
        "pattern.number" "pattern.desc"

    # Topic with description (for titles/names, not general sentences)
    # Matches: "Andre Kronert – Raw, psychedelic repetition..."
    # Guard rejects prose (sentence starters like "This is...", >5 words)
    chroma_pattern_register "topic_desc" \
        '^([A-Z][^–—-]{0,38}[^[:space:]]) [–—-] (.+)$' \
        "pattern.topic" "pattern.desc" \
        --guard "_chroma_guard_topic"

    # Key: Value pairs
    chroma_pattern_register "key_value" \
        '^([A-Za-z_][A-Za-z0-9_]*): (.+)$' \
        "pattern.key" "pattern.value"

    # Time/timestamp: HH:MM content
    chroma_pattern_register "timestamp" \
        '^([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?) (.+)$' \
        "pattern.time" "pattern.desc"
}

#==============================================================================
# PATTERN MATCHING
#==============================================================================

# Try to match text against registered patterns
# Sets CHROMA_PATTERN_MATCH_NAME and CHROMA_PATTERN_MATCH_GROUPS on success
# Returns 0 if matched, 1 if no match
_chroma_pattern_match() {
    local text="$1"

    (( ! CHROMA_PATTERNS_ENABLED )) && return 1

    for name in "${CHROMA_PATTERN_ORDER[@]}"; do
        local regex="${CHROMA_PATTERNS[$name]}"
        [[ -z "$regex" ]] && continue

        if [[ "$text" =~ $regex ]]; then
            # Save BASH_REMATCH before guard (guard may use regex internally)
            local -a saved_groups=("${BASH_REMATCH[@]}")

            # Run guard if defined
            local guard="${CHROMA_PATTERN_GUARDS[$name]:-}"
            if [[ -n "$guard" ]]; then
                # Pass captured groups (excluding full match) to guard
                if ! "$guard" "${saved_groups[@]:1}"; then
                    continue  # Guard rejected, try next pattern
                fi
            fi

            CHROMA_PATTERN_MATCH_NAME="$name"
            CHROMA_PATTERN_MATCH_GROUPS=("${saved_groups[@]}")
            return 0
        fi
    done

    return 1
}

#==============================================================================
# PATTERN RENDERING
#==============================================================================

# Smart wrap for topic-description patterns with clamping
# Prevents the "bottleneck effect" where long topics create narrow text towers
# $1 = topic
# $2 = desc
# $3 = pad (left padding)
# $4 = width (total available width)
_chroma_render_smart_wrap() {
    local topic="$1"
    local desc="$2"
    local pad="$3"
    local -i width="${4:-${COLUMNS:-80}}"

    # Config: only align if topic < 25% of width, else fall back to 4-space indent
    local -i max_align_percent=25
    local -i fallback_indent=4
    local separator=" – "

    # Geometry
    local prefix="${topic}${separator}"
    local -i prefix_len=${#prefix}
    local -i align_limit=$(( width * max_align_percent / 100 ))
    local -i indent_len

    # Indentation strategy: clamp if prefix is too long
    if (( prefix_len < align_limit )); then
        indent_len=$prefix_len  # Align to separator
    else
        indent_len=$fallback_indent  # Clamp to fixed indent
    fi

    # Available widths
    local -i first_line_room=$(( width - ${#pad} - prefix_len ))
    local -i body_room=$(( width - ${#pad} - indent_len ))

    # Render topic + separator
    printf '%s' "$pad"
    _chroma_color "$(_chroma_token pattern.topic)"
    printf '%s' "$topic"
    _chroma_reset
    _chroma_color "$(_chroma_token pattern.dash)"
    printf '%s' "$separator"
    _chroma_reset

    # If desc fits on first line, done
    if (( ${#desc} <= first_line_room )); then
        _chroma_color "$(_chroma_token pattern.desc)"
        printf '%s' "$desc"
        _chroma_reset
        echo
        return
    fi

    # Variable wrap: first line narrow, rest wide
    local wrapped_lines
    mapfile -t wrapped_lines < <(_chroma_word_wrap_variable "$desc" "$first_line_room" "$body_room")

    local first=1
    for wline in "${wrapped_lines[@]}"; do
        if (( first )); then
            _chroma_color "$(_chroma_token pattern.desc)"
            printf '%s' "$wline"
            _chroma_reset
            echo
            first=0
        else
            printf '%s%*s' "$pad" "$indent_len" ""
            _chroma_color "$(_chroma_token pattern.desc)"
            printf '%s' "$wline"
            _chroma_reset
            echo
        fi
    done
}

# Render text with pattern styling (width-aware)
# $1 = text to render
# $2 = fallback token for unmatched text
# $3 = available width (optional)
# $4 = left padding for continuation lines (optional)
_chroma_render_pattern() {
    local text="$1"
    local fallback="${2:-text.primary}"
    local width="${3:-0}"
    local cont_pad="${4:-}"

    if ! _chroma_pattern_match "$text"; then
        # No pattern match - render with fallback
        _chroma_color "$(_chroma_token "$fallback")"
        _chroma_inline "$text" "$fallback"
        _chroma_reset
        return 1
    fi

    local name="$CHROMA_PATTERN_MATCH_NAME"
    local -a groups=("${CHROMA_PATTERN_MATCH_GROUPS[@]}")
    local tokens
    read -ra tokens <<< "${CHROMA_PATTERN_TOKENS[$name]}"

    # Track how many chars we've used
    local used=0

    # Handle topic_desc with smart wrap (prevents bottleneck effect)
    if [[ "$name" == "topic_desc" ]]; then
        local topic="${groups[1]}"
        local desc="${groups[2]}"
        _chroma_render_smart_wrap "$topic" "$desc" "$cont_pad" "$width"
        return 0
    fi

    # Handle bracketed_id_simple: [ID: optional_content]
    if [[ "$name" == "bracketed_id_simple" ]]; then
        local id="${groups[1]}"
        local content="${groups[2]:-}"

        # Opening bracket
        _chroma_color "$(_chroma_token text.secondary)"
        printf '['
        _chroma_reset

        # Accent color for ID
        _chroma_color "$(_chroma_token heading.1)"
        printf '%s' "$id"
        _chroma_reset

        # Separator
        _chroma_color "$(_chroma_token text.secondary)"
        printf ': '
        _chroma_reset

        # Content if any
        if [[ -n "$content" ]]; then
            _chroma_color "$(_chroma_token pattern.desc)"
            printf '%s' "$content"
            _chroma_reset
        fi

        # Closing bracket
        _chroma_color "$(_chroma_token text.secondary)"
        printf ']'
        _chroma_reset

        return 0
    fi

    # Handle bracketed_id specially for proper structure preservation
    if [[ "$name" == "bracketed_id" ]]; then
        local id="${groups[1]}"
        local action="${groups[2]}"
        local rest="${groups[3]}"

        # Opening bracket
        _chroma_color "$(_chroma_token text.secondary)"
        printf '['
        _chroma_reset
        ((used++))

        # Accent color for outer ID (heading.h1 = bold cyan)
        _chroma_color "$(_chroma_token heading.1)"
        printf '%s' "$id"
        _chroma_reset
        ((used += ${#id}))

        # Separator
        _chroma_color "$(_chroma_token text.secondary)"
        printf ': '
        _chroma_reset
        ((used += 2))

        # Action in key color
        _chroma_color "$(_chroma_token pattern.key)"
        printf '%s' "$action"
        _chroma_reset
        ((used += ${#action}))

        printf ' '
        ((used++))

        # Handle nested or plain content
        local remaining=$((width - used))
        if [[ "$rest" == \[* ]]; then
            # Strip one trailing ] for the outer bracket
            rest="${rest%]}"
            _chroma_render_nested_bracket "$rest" "$((remaining - 2))"
            # Add outer closing bracket
            _chroma_color "$(_chroma_token text.secondary)"
            printf ' ]'
            _chroma_reset
        else
            # Strip trailing ] if present
            rest="${rest%]}"
            # Truncate description only, preserve structure
            if (( width > 0 && remaining > 2 && ${#rest} > (remaining - 2) )); then
                if (( remaining > 8 )); then
                    rest="${rest:0:$((remaining - 6))} ..."
                fi
            fi
            _chroma_color "$(_chroma_token pattern.desc)"
            printf '%s' "$rest"
            _chroma_reset
            _chroma_color "$(_chroma_token text.secondary)"
            printf ' ]'
            _chroma_reset
        fi

        return 0
    fi

    # Render pattern prefix if needed
    case "$name" in
        *)
            ;;
    esac

    # Render each captured group with its token
    local i=1
    local num_groups=$(( ${#groups[@]} - 1 ))

    for ((i=1; i<=num_groups; i++)); do
        local group="${groups[$i]}"
        local token="${tokens[$((i-1))]:-text.primary}"

        # For the last group (usually description), wrap if needed
        if (( i == num_groups )); then
            local remaining=$((width - used))

            # Word-wrap long content instead of truncating
            if (( width > 0 && remaining > 10 && ${#group} > remaining )); then
                # First line - what fits
                local wrapped_lines
                mapfile -t wrapped_lines < <(_chroma_word_wrap "$group" "$remaining" "")

                local first=1
                for wline in "${wrapped_lines[@]}"; do
                    if (( first )); then
                        _chroma_color "$(_chroma_token "$token")"
                        printf '%s' "$wline"
                        _chroma_reset
                        first=0
                    else
                        # Continuation lines - pad + indent to align with content start
                        echo
                        printf '%s%*s' "$cont_pad" "$used" ""
                        _chroma_color "$(_chroma_token "$token")"
                        printf '%s' "$wline"
                        _chroma_reset
                    fi
                done
            else
                _chroma_color "$(_chroma_token "$token")"
                printf '%s' "$group"
                _chroma_reset
            fi
        else
            _chroma_color "$(_chroma_token "$token")"
            printf '%s' "$group"
            _chroma_reset
            ((used += ${#group}))
        fi

        # Add separator between groups (except last)
        if (( i < num_groups )); then
            case "$name" in
                topic_desc)
                    _chroma_color "$(_chroma_token pattern.dash)"
                    printf ' – '
                    _chroma_reset
                    ((used += 3))
                    ;;
                key_value)
                    _chroma_color "$(_chroma_token text.secondary)"
                    printf ': '
                    _chroma_reset
                    ((used += 2))
                    ;;
                timestamp)
                    printf ' '
                    ((used++))
                    ;;
                *)
                    printf ' '
                    ((used++))
                    ;;
            esac
        fi
    done

    return 0
}

# Render nested bracket with distinct styling
# $1 = nested bracket content like "[ID: action content]"
# $2 = remaining width (optional)
_chroma_render_nested_bracket() {
    local content="$1"
    local width="${2:-0}"
    local used=0

    # Parse nested bracket: [ID: action rest...]
    local nested_regex='^\[([0-9]+): ([a-z_]+) (.+)$'
    if [[ "$content" =~ $nested_regex ]]; then
        local nested_id="${BASH_REMATCH[1]}"
        local nested_action="${BASH_REMATCH[2]}"
        local nested_rest="${BASH_REMATCH[3]}"

        # Strip trailing ] from nested_rest if present
        nested_rest="${nested_rest%]}"

        # Render bracket structure with accent colors for IDs
        _chroma_color "$(_chroma_token text.secondary)"
        printf '['
        _chroma_reset
        ((used++))

        # Accent color for nested ID (use heading.h2 for prominence)
        _chroma_color "$(_chroma_token heading.2)"
        printf '%s' "$nested_id"
        _chroma_reset
        ((used += ${#nested_id}))

        _chroma_color "$(_chroma_token text.secondary)"
        printf ': '
        _chroma_reset
        ((used += 2))

        _chroma_color "$(_chroma_token pattern.key)"
        printf '%s' "$nested_action"
        _chroma_reset
        ((used += ${#nested_action}))

        printf ' '
        ((used++))

        # Calculate remaining width for content (reserve 2 for closing ])
        local remaining=$((width - used - 2))

        # Recursively check for more nested content
        if [[ "$nested_rest" == \[* ]]; then
            _chroma_render_nested_bracket "$nested_rest" "$remaining"
        else
            # Truncate description only if needed, preserve structure
            if (( width > 0 && remaining > 0 && ${#nested_rest} > remaining )); then
                if (( remaining > 6 )); then
                    nested_rest="${nested_rest:0:$((remaining - 4))} ..."
                fi
            fi
            _chroma_color "$(_chroma_token pattern.desc)"
            printf '%s' "$nested_rest"
            _chroma_reset
        fi

        # Close the bracket
        _chroma_color "$(_chroma_token text.secondary)"
        printf ' ]'
        _chroma_reset
    else
        # No nested pattern, just render as description
        _chroma_color "$(_chroma_token pattern.desc)"
        printf '%s' "$content"
        _chroma_reset
    fi
}

# Render list item content with pattern detection
# Falls back to standard inline rendering if no pattern matches
_chroma_render_list_content() {
    local content="$1"
    local base_token="${2:-text}"

    if _chroma_pattern_match "$content"; then
        _chroma_render_pattern "$content" "$base_token"
    else
        _chroma_color "$(_chroma_token "$base_token")"
        _chroma_inline "$content" "$base_token"
        _chroma_reset
    fi
}

#==============================================================================
# EXPANDED PATTERN RENDERING
#==============================================================================

# Render pattern match with header line + full wrapped content
# Format:
#   [number: topic – desc...]
#
#   Full wrapped content here with proper indentation
#   continuing as needed.
#
# $1 = list number (level)
# $2 = content
# $3 = padding
# $4 = width
_chroma_render_pattern_expanded() {
    local level="$1"
    local content="$2"
    local pad="$3"
    local width="$4"

    # Must have already matched - get match info
    local name="$CHROMA_PATTERN_MATCH_NAME"
    local -a groups=("${CHROMA_PATTERN_MATCH_GROUPS[@]}")

    # Calculate available width for header
    local header_width=$((width - ${#pad} - 4))  # Reserve for "[ " and " ]"
    local indent="    "  # 4-space indent for content

    # Build header based on pattern type
    local topic="" desc=""

    case "$name" in
        topic_desc)
            topic="${groups[1]}"
            desc="${groups[2]}"
            ;;
        key_value)
            topic="${groups[1]}"
            desc="${groups[2]}"
            ;;
        timestamp)
            topic="${groups[1]}"
            desc="${groups[2]}"
            ;;
        *)
            # Fallback: use full content as desc
            topic=""
            desc="$content"
            ;;
    esac

    # Build truncated header content
    local header_content
    if [[ -n "$topic" ]]; then
        header_content="$topic – $desc"
    else
        header_content="$desc"
    fi

    # Truncate header content if needed, showing end snippet
    local max_header=$((header_width - ${#level} - 2))  # Reserve for "N: "
    if (( ${#header_content} > max_header && max_header > 20 )); then
        # Split: show start...end
        local front_len=$(( (max_header - 5) / 2 ))
        local back_len=$(( max_header - front_len - 5 ))
        header_content="${header_content:0:$front_len}...${header_content: -$back_len}"
    fi

    # Render header line: [N: truncated content...]
    printf '%s' "$pad"
    _chroma_color "$(_chroma_token text.secondary)"
    printf '['
    _chroma_reset
    _chroma_color "$(_chroma_token heading.1)"
    printf '%s' "$level"
    _chroma_reset
    _chroma_color "$(_chroma_token text.secondary)"
    printf ': '
    _chroma_reset
    _chroma_color "$(_chroma_token pattern.topic)"
    printf '%s' "$header_content"
    _chroma_reset
    _chroma_color "$(_chroma_token text.secondary)"
    printf ' ]'
    _chroma_reset
    echo

    # Blank line
    echo

    # Full wrapped content with indent
    local content_width=$((width - ${#pad} - ${#indent}))
    local wrapped_lines
    mapfile -t wrapped_lines < <(_chroma_word_wrap "$desc" "$content_width" "")

    for wline in "${wrapped_lines[@]}"; do
        printf '%s%s' "$pad" "$indent"
        _chroma_color "$(_chroma_token text)"
        _chroma_inline "$wline" "text"
        _chroma_reset
        echo
    done
}

#==============================================================================
# PATTERN LISTING
#==============================================================================

chroma_pattern_list() {
    echo
    echo "Chroma Patterns"
    echo "  Enabled: $CHROMA_PATTERNS_ENABLED"
    echo

    if [[ ${#CHROMA_PATTERN_ORDER[@]} -eq 0 ]]; then
        echo "  (no patterns registered)"
    else
        for name in "${CHROMA_PATTERN_ORDER[@]}"; do
            printf "  %-20s %s\n" "$name" "${CHROMA_PATTERNS[$name]}"
            printf "    tokens: %s\n" "${CHROMA_PATTERN_TOKENS[$name]}"
            local guard="${CHROMA_PATTERN_GUARDS[$name]:-}"
            [[ -n "$guard" ]] && printf "    guard: %s\n" "$guard"
        done
    fi
    echo
}

# Initialize patterns on source
_chroma_init_patterns
