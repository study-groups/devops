#!/usr/bin/env bash

# TUI Formatting Module - Rich Text and Paragraph Formatting
# Responsibility: Advanced text formatting, margins, color variations
# Supports bold topics, justified text, and expressive color schemes

# ===== FORMATTING TOKENS =====

declare -A FORMAT_TOKENS=(
    # Margin and Layout
    [LEFT_MARGIN]="4"               # Left margin for paragraphs
    [RIGHT_MARGIN]="4"              # Right margin for paragraphs
    [PARAGRAPH_SPACING]="1"         # Lines between paragraphs
    [TOPIC_INDENT]="0"              # Additional indent for topics

    # Text Intensity Levels
    [BRIGHT_LEVEL]="1"              # Bold/bright text
    [NORMAL_LEVEL]="0"              # Normal text
    [DIM_LEVEL]="2"                 # Dimmed text
    [FAINT_LEVEL]="2;3"             # Very dim + italic

    # Color Intensity Variations
    [VIVID_PREFIX]="1;38;5;"        # Bold + 256 color
    [NORMAL_PREFIX]="38;5;"         # 256 color
    [DIM_PREFIX]="2;38;5;"          # Dim + 256 color
    [FAINT_PREFIX]="2;3;38;5;"      # Dim + italic + 256 color
)

# ===== COLOR VARIATION SYSTEM =====

# Rich color palette for expressive formatting
declare -A EXPRESSIVE_COLORS=(
    # Topic Colors (Bold, High Contrast)
    [topic_primary]="196"           # Bright red
    [topic_secondary]="202"         # Orange
    [topic_accent]="226"            # Yellow
    [topic_success]="46"            # Bright green
    [topic_info]="39"               # Bright blue
    [topic_special]="165"           # Magenta

    # Content Colors (Readable, Varied)
    [content_primary]="252"         # Light gray
    [content_secondary]="244"       # Medium gray
    [content_accent]="117"          # Light blue
    [content_highlight]="227"       # Light yellow
    [content_emphasis]="186"        # Light orange
    [content_subtle]="240"          # Dark gray

    # Context Colors (Environmental)
    [env_app]="82"                  # Bright green
    [env_dev]="214"                 # Orange
    [mode_learn]="75"               # Blue
    [mode_try]="156"                # Green-blue
    [mode_tui]="99"                 # Purple
    [mode_dmod]="203"               # Pink
)

# ===== FORMATTING FUNCTIONS =====

# Format bold topic with color
# Usage: format_topic "color_name" "topic_text"
format_topic() {
    local color_name="$1"
    local topic_text="$2"
    local color_code="${EXPRESSIVE_COLORS[$color_name]:-252}"

    printf "\033[${FORMAT_TOKENS[BRIGHT_LEVEL]};38;5;%sm%s:\033[0m" "$color_code" "$topic_text"
}

# Format content with specific intensity and color
# Usage: format_content "intensity" "color_name" "text"
format_content() {
    local intensity="$1"
    local color_name="$2"
    local content_text="$3"
    local color_code="${EXPRESSIVE_COLORS[$color_name]:-252}"

    case "$intensity" in
        "vivid")
            printf "\033[${FORMAT_TOKENS[VIVID_PREFIX]}%sm%s\033[0m" "$color_code" "$content_text"
            ;;
        "normal")
            printf "\033[${FORMAT_TOKENS[NORMAL_PREFIX]}%sm%s\033[0m" "$color_code" "$content_text"
            ;;
        "dim")
            printf "\033[${FORMAT_TOKENS[DIM_PREFIX]}%sm%s\033[0m" "$color_code" "$content_text"
            ;;
        "faint")
            printf "\033[${FORMAT_TOKENS[FAINT_PREFIX]}%sm%s\033[0m" "$color_code" "$content_text"
            ;;
        *)
            printf "\033[${FORMAT_TOKENS[NORMAL_PREFIX]}%sm%s\033[0m" "$color_code" "$content_text"
            ;;
    esac
}

# Format paragraph with topic and content, handling margins
# Usage: format_paragraph "topic_color" "topic" "content_intensity" "content_color" "content"
format_paragraph() {
    local topic_color="$1"
    local topic="$2"
    local content_intensity="$3"
    local content_color="$4"
    local content="$5"

    local term_width=${COLUMNS:-80}
    local left_margin="${FORMAT_TOKENS[LEFT_MARGIN]}"
    local right_margin="${FORMAT_TOKENS[RIGHT_MARGIN]}"
    local text_width=$((term_width - left_margin - right_margin))

    # Format topic
    local topic_formatted="$(format_topic "$topic_color" "$topic")"

    # Format content with word wrapping
    local content_formatted="$(format_content "$content_intensity" "$content_color" "$content")"

    # Output with proper margins
    printf "%*s%s %s\n" "$left_margin" "" "$topic_formatted" "$content_formatted"

    # Add paragraph spacing
    local spacing="${FORMAT_TOKENS[PARAGRAPH_SPACING]}"
    for ((i=0; i<spacing; i++)); do
        echo
    done
}

# Advanced word wrapping with ANSI codes preserved
# Usage: wrap_text_with_ansi "text_with_codes" width
wrap_text_with_ansi() {
    local text="$1"
    local width="$2"

    # For now, simple implementation - could be enhanced with proper ANSI handling
    echo "$text" | fold -w "$width" -s
}

# ===== EXPRESSIVE COLOR SCHEMES =====

# Get color based on current action for dynamic theming
get_dynamic_topic_color() {
    local action="$1"

    case "$action" in
        *"show"*)
            echo "topic_info"
            ;;
        *"configure"*)
            echo "topic_accent"
            ;;
        *"test"*)
            echo "topic_success"
            ;;
        *"analyze"*)
            echo "topic_special"
            ;;
        *)
            echo "topic_primary"
            ;;
    esac
}

# Get content color scheme for variety
get_content_color_scheme() {
    local index="$1"
    local schemes=("content_primary" "content_accent" "content_emphasis" "content_highlight" "content_secondary")
    local scheme_index=$((index % ${#schemes[@]}))
    echo "${schemes[$scheme_index]}"
}

# Get intensity variation for visual hierarchy
get_intensity_variation() {
    local index="$1"
    local current_action_index="${2:-0}"

    # Current action gets vivid, others get varied intensities
    if [[ $index -eq $current_action_index ]]; then
        echo "vivid"
    else
        local intensities=("normal" "dim" "normal" "faint" "normal")
        local intensity_index=$((index % ${#intensities[@]}))
        echo "${intensities[$intensity_index]}"
    fi
}

# ===== SECTION FORMATTING =====

# Format section header with decorative elements
format_section_header() {
    local section_title="$1"
    local color_name="${2:-topic_primary}"
    local term_width=${COLUMNS:-80}

    local title_formatted="$(format_topic "$color_name" "$section_title")"
    local decoration="$(printf '%.20s' '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓')"

    printf "\n%s %s %s\n\n" "$(format_content "dim" "content_subtle" "$decoration")" "$title_formatted" "$(format_content "dim" "content_subtle" "$decoration")"
}

# Initialize formatting module
init_tui_format() {
    if command -v log_action >/dev/null 2>&1; then
        log_action "Format: TUI Formatting module initialized with expressive colors"
    fi
}

# Call initialization
init_tui_format