#!/usr/bin/env bash

# Vox Voice Management - Voice profiles, grading, and comparison
# Uses nginx-style voice-available/voice-enabled pattern with TOML configs

# Source TOML parser utilities
source "${TETRA_SRC}/bash/utils/toml_parser.sh"

# Voice configuration directories
VOX_VOICE_AVAILABLE="${VOX_DIR}/voice-available"
VOX_VOICE_ENABLED="${VOX_DIR}/voice-enabled"

# Initialize default voice profiles
vox_init_profiles() {
    # Create voice directories
    mkdir -p "$VOX_VOICE_AVAILABLE" "$VOX_VOICE_ENABLED"

    # Create three default voice configs
    cat > "$VOX_VOICE_AVAILABLE/sally.toml" <<'EOF'
# Sally - Warm, friendly female voice

[voice]
id = "sally"
display_name = "Sally"
description = "Warm, friendly conversational voice"

[provider]
name = "openai"
model = "tts-1"
voice_id = "nova"
api_endpoint = "https://api.openai.com/v1/audio/speech"

[pricing]
cost_per_1m_chars = 15.00
currency = "USD"

[metadata]
tags = ["female", "warm", "friendly", "conversational"]
quality = "standard"
use_cases = ["podcasts", "audiobooks", "general"]
language = "en-US"
EOF

    cat > "$VOX_VOICE_AVAILABLE/marcus.toml" <<'EOF'
# Marcus - Deep, authoritative male voice

[voice]
id = "marcus"
display_name = "Marcus"
description = "Deep, authoritative professional voice"

[provider]
name = "openai"
model = "tts-1"
voice_id = "onyx"
api_endpoint = "https://api.openai.com/v1/audio/speech"

[pricing]
cost_per_1m_chars = 15.00
currency = "USD"

[metadata]
tags = ["male", "deep", "authoritative", "professional"]
quality = "standard"
use_cases = ["presentations", "news", "documentation"]
language = "en-US"
EOF

    cat > "$VOX_VOICE_AVAILABLE/alex.toml" <<'EOF'
# Alex - Balanced, neutral non-binary voice

[voice]
id = "alex"
display_name = "Alex"
description = "Balanced, neutral voice for all contexts"

[provider]
name = "openai"
model = "tts-1"
voice_id = "alloy"
api_endpoint = "https://api.openai.com/v1/audio/speech"

[pricing]
cost_per_1m_chars = 15.00
currency = "USD"

[metadata]
tags = ["non-binary", "neutral", "balanced", "versatile"]
quality = "standard"
use_cases = ["general", "education", "accessibility"]
language = "en-US"
EOF

    # Enable Sally by default (symlink)
    ln -sf "$VOX_VOICE_AVAILABLE/sally.toml" "$VOX_VOICE_ENABLED/sally.toml"

    # Set default active voice
    echo "sally" > "$VOX_VOICE_FILE"
}

# Load voice configuration file
_vox_load_voice_config() {
    local voice_id="$1"
    local config_file="$VOX_VOICE_ENABLED/${voice_id}.toml"

    if [[ ! -f "$config_file" ]]; then
        # Try available directory
        config_file="$VOX_VOICE_AVAILABLE/${voice_id}.toml"
    fi

    if [[ ! -f "$config_file" ]]; then
        echo "Voice config not found: $voice_id" >&2
        return 1
    fi

    echo "$config_file"
}

# Parse voice TOML and extract value from section
_vox_toml_get() {
    local file="$1"
    local section="$2"
    local key="$3"
    local default="${4:-}"

    if [[ ! -f "$file" ]]; then
        echo "$default"
        return 1
    fi

    # Parse TOML file with unique prefix per file to avoid collisions
    local prefix="VOX_$(basename "$file" .toml | tr '[:lower:]' '[:upper:]')"
    toml_parse "$file" "$prefix" 2>/dev/null || { echo "$default"; return 1; }

    # Get value from section
    local value=$(toml_get "$section" "$key" "$prefix" 2>/dev/null)

    if [[ -z "$value" ]]; then
        echo "$default"
    else
        echo "$value"
    fi
}

# Get array value from TOML (returns space-separated string)
_vox_toml_get_array() {
    local file="$1"
    local section="$2"
    local key="$3"

    if [[ ! -f "$file" ]]; then
        return 1
    fi

    local prefix="VOX_$(basename "$file" .toml | tr '[:lower:]' '[:upper:]')"
    toml_parse "$file" "$prefix" 2>/dev/null || return 1

    # Arrays are already space-separated by toml_parser
    toml_get "$section" "$key" "$prefix" 2>/dev/null
}

# List all available voice profiles (compact, 80-column friendly)
vox_list_voices() {
    # Header with color
    echo
    vox_element_text "vox_playing" "bright"
    printf "🎤 "
    reset_color
    printf "\033[1m"
    vox_element_text "vox_action" "normal"
    echo "Voice Profiles"
    reset_color
    vox_element_text "vox_action" "dim"
    echo "   ══════════════"
    reset_color
    echo

    local active_voice="$(_vox_get_active_voice)"

    # Collect and display enabled voices
    local found_enabled=0
    for config in "$VOX_VOICE_ENABLED"/*.toml; do
        [[ ! -f "$config" ]] && continue
        found_enabled=1

        local voice_id=$(basename "$config" .toml)
        local display_name=$(_vox_toml_get "$config" "voice" "display_name" "$voice_id")

        # Extract first tag directly from TOML (simpler approach)
        local first_tag=$(grep -A1 "^\[metadata\]" "$config" | grep "^tags" | sed 's/.*\[\s*"\([^"]*\)".*/\1/' | head -1)

        # Active marker
        if [[ "$voice_id" == "$active_voice" ]]; then
            text_color "22DD22"
            printf "▶ "
            reset_color
        else
            text_color "666666"
            printf "  "
            reset_color
        fi

        # Voice ID - purple
        vox_voice_text "normal"
        printf "%-10s" "$voice_id"
        reset_color

        # Display name - white
        printf " %-18s" "$display_name"

        # First tag - gray
        text_color "888888"
        printf " [%s]" "$first_tag"
        reset_color
        echo
    done

    if [[ $found_enabled -eq 0 ]]; then
        text_color "666666"
        echo "  (No voices enabled)"
        reset_color
    fi

    echo
    text_color "666666"
    echo "  Commands:"
    echo "    v <id>   Set active    test <id>  Test voice"
    echo "    enable   Add voice     disable    Remove voice"
    reset_color
    echo
}

# Get list of voice profile names only (enabled voices)
vox_list_voice_names() {
    for config in "$VOX_VOICE_ENABLED"/*.toml; do
        [[ ! -f "$config" ]] && continue
        basename "$config" .toml
    done
}

# Enable a voice
vox_voice_enable() {
    local voice_id="$1"

    if [[ -z "$voice_id" ]]; then
        echo "Usage: vox voice-enable <voice_id>" >&2
        return 1
    fi

    local available="$VOX_VOICE_AVAILABLE/${voice_id}.toml"

    if [[ ! -f "$available" ]]; then
        echo "Voice not found in available: $voice_id" >&2
        return 1
    fi

    ln -sf "$available" "$VOX_VOICE_ENABLED/${voice_id}.toml"
    echo "✓ Enabled voice: $voice_id"
}

# Disable a voice
vox_voice_disable() {
    local voice_id="$1"

    if [[ -z "$voice_id" ]]; then
        echo "Usage: vox voice-disable <voice_id>" >&2
        return 1
    fi

    local enabled="$VOX_VOICE_ENABLED/${voice_id}.toml"

    if [[ ! -f "$enabled" ]]; then
        echo "Voice not enabled: $voice_id" >&2
        return 1
    fi

    rm "$enabled"
    echo "✓ Disabled voice: $voice_id"
}

# Show active voice
vox_get_active_voice() {
    local voice="$(_vox_get_active_voice)"
    echo "Active voice: $voice"

    # Show voice info
    vox_voice_info "$voice"
}

# Set active voice
vox_set_voice() {
    local voice="$1"

    if [[ -z "$voice" ]]; then
        echo "Usage: vox voice <profile>" >&2
        return 1
    fi

    # Validate voice exists
    local valid_voices=($(vox_list_voice_names))
    local found=0
    for v in "${valid_voices[@]}"; do
        if [[ "$v" == "$voice" ]]; then
            found=1
            break
        fi
    done

    if [[ $found -eq 0 ]]; then
        echo "Invalid voice profile: $voice" >&2
        echo "Use 'vox voices' to see available profiles" >&2
        return 1
    fi

    echo "$voice" > "$VOX_VOICE_FILE"
    echo "✓ Active voice set to: $voice"
}

# Show detailed voice info
vox_voice_info() {
    local voice="${1:-$(_vox_get_active_voice)}"

    if [[ -z "$voice" ]]; then
        echo "Usage: vox voice-info <profile>" >&2
        return 1
    fi

    IFS='|' read -r provider model voice_name <<< "$(_vox_parse_voice "$voice")"

    echo "Voice Profile: $voice"
    echo "===================="
    echo "Provider: $provider"
    echo "Model: $model"
    echo "Voice: $voice_name"
    echo

    # Show cost info
    case "$provider-$model" in
        openai-tts1)
            echo "Cost: \$15.00 per 1M characters"
            echo "Quality: Standard"
            ;;
        openai-tts1-hd)
            echo "Cost: \$30.00 per 1M characters"
            echo "Quality: High Definition"
            ;;
        *)
            echo "Cost: Unknown"
            ;;
    esac

    echo

    # Show usage stats if available
    if [[ -f "$VOX_LOGS_DIR/usage.jsonl" ]]; then
        local usage_count=$(grep -c "\"voice\":\"$voice\"" "$VOX_LOGS_DIR/usage.jsonl" 2>/dev/null || echo "0")
        local total_cost=$(grep "\"voice\":\"$voice\"" "$VOX_LOGS_DIR/usage.jsonl" 2>/dev/null | \
            jq -s 'map(.cost) | add' 2>/dev/null || echo "0")

        echo "Usage Statistics:"
        echo "  Generations: $usage_count"
        echo "  Total cost: \$$total_cost"
    fi
}

# Test a voice with sample text
vox_voice_test() {
    local voice="${1:-$(_vox_get_active_voice)}"

    if [[ -z "$voice" ]]; then
        echo "Usage: vox voice-test <profile>" >&2
        return 1
    fi

    local test_text="Hello! This is a test of the $voice voice profile. The quick brown fox jumps over the lazy dog."

    echo "Testing voice: $voice"
    echo "Text: $test_text"
    echo

    vox text "$test_text" "$voice"
}

# Grade a voice/answer combination
vox_grade() {
    local qa_id="$1"
    local voice="$2"
    local rating="$3"
    local notes="${4:-}"

    if [[ -z "$qa_id" || -z "$voice" || -z "$rating" ]]; then
        echo "Usage: vox grade <qa_id> <voice> <1-5> [notes]" >&2
        return 1
    fi

    # Validate rating
    if [[ ! "$rating" =~ ^[1-5]$ ]]; then
        echo "Rating must be 1-5" >&2
        return 1
    fi

    # Verify audio exists
    if ! _vox_is_cached "$qa_id" "$voice"; then
        echo "Audio not found for QA #$qa_id with voice '$voice'" >&2
        echo "Generate it first with: vox id $qa_id $voice" >&2
        return 1
    fi

    local grade_file="$(_vox_get_grade_path "$qa_id" "$voice")"

    cat > "$grade_file" <<EOF
{
  "qa_id": "$qa_id",
  "voice": "$voice",
  "rating": $rating,
  "notes": "$notes",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "graded_by": "${USER:-unknown}"
}
EOF

    echo "✓ Graded QA #$qa_id / $voice: $rating/5"
    [[ -n "$notes" ]] && echo "  Notes: $notes"
}

# Show grades for a QA ID
vox_show_grades() {
    local qa_id="$1"

    if [[ -z "$qa_id" ]]; then
        # Show summary of all grades
        echo "All Graded Voice/Answer Combinations"
        echo "====================================="
        echo

        local count=0
        for grade_file in "$QA_DB_DIR"/*.vox.*.grade; do
            [[ ! -f "$grade_file" ]] && continue
            count=$((count + 1))

            local qa=$(echo "$grade_file" | sed 's/.*\/\([0-9]*\)\.say\..*/\1/')
            local voice=$(echo "$grade_file" | sed 's/.*\.say\.\(.*\)\.grade/\1/')
            local rating=$(jq -r '.rating' "$grade_file" 2>/dev/null || echo "?")
            local notes=$(jq -r '.notes' "$grade_file" 2>/dev/null || echo "")

            printf "QA #%-15s  %-25s  %s/5  %s\n" "$qa" "$voice" "$rating" "$notes"
        done

        if [[ $count -eq 0 ]]; then
            echo "No grades found"
            echo "Use 'vox grade <qa_id> <voice> <1-5> [notes]' to grade combinations"
        fi
    else
        # Show grades for specific QA ID
        echo "Grades for QA #$qa_id"
        echo "====================="
        echo

        local answer_file="$QA_DB_DIR/${qa_id}.answer"
        if [[ ! -f "$answer_file" ]]; then
            echo "QA answer not found: $qa_id" >&2
            return 1
        fi

        local prompt=$(head -n1 "$QA_DB_DIR/${qa_id}.prompt" 2>/dev/null || echo "[no prompt]")
        echo "Question: $prompt"
        echo

        local count=0
        for grade_file in "$QA_DB_DIR/${qa_id}.vox."*.grade; do
            [[ ! -f "$grade_file" ]] && continue
            count=$((count + 1))

            local voice=$(echo "$grade_file" | sed "s/.*\.say\.\(.*\)\.grade/\1/")
            local rating=$(jq -r '.rating' "$grade_file" 2>/dev/null || echo "?")
            local notes=$(jq -r '.notes' "$grade_file" 2>/dev/null || echo "")
            local timestamp=$(jq -r '.timestamp' "$grade_file" 2>/dev/null || echo "")

            printf "  %-30s  %s/5  %s\n" "$voice" "$rating" "$notes"
            [[ -n "$timestamp" ]] && echo "    Graded: $timestamp"
        done

        if [[ $count -eq 0 ]]; then
            echo "  (No grades for this QA answer)"
        fi
    fi
}

# Play best-rated voice for a QA ID
vox_play_best() {
    local qa_id="$1"

    if [[ -z "$qa_id" ]]; then
        echo "Usage: vox best <qa_id>" >&2
        return 1
    fi

    local answer_file="$QA_DB_DIR/${qa_id}.answer"
    if [[ ! -f "$answer_file" ]]; then
        echo "QA answer not found: $qa_id" >&2
        return 1
    fi

    # Find best-rated voice
    local best_voice=""
    local best_rating=0

    for grade_file in "$QA_DB_DIR/${qa_id}.vox."*.grade; do
        [[ ! -f "$grade_file" ]] && continue

        local voice=$(echo "$grade_file" | sed "s/.*\.say\.\(.*\)\.grade/\1/")
        local rating=$(jq -r '.rating' "$grade_file" 2>/dev/null || echo "0")

        if [[ $rating -gt $best_rating ]]; then
            best_rating=$rating
            best_voice=$voice
        fi
    done

    if [[ -z "$best_voice" ]]; then
        echo "No graded voices found for QA #$qa_id" >&2
        echo "Grade some voices first with: vox grade $qa_id <voice> <1-5>" >&2
        return 1
    fi

    echo "Playing best-rated voice: $best_voice ($best_rating/5)"
    vox_by_id "$qa_id" "$best_voice"
}

# Cost summary
vox_cost_summary() {
    echo "Vox Cost Summary"
    echo "================"
    echo

    if [[ ! -f "$VOX_LOGS_DIR/usage.jsonl" ]]; then
        echo "No usage data found"
        return 0
    fi

    local total_cost=$(jq -s 'map(.cost) | add' "$VOX_LOGS_DIR/usage.jsonl" 2>/dev/null || echo "0")
    local total_generations=$(wc -l < "$VOX_LOGS_DIR/usage.jsonl")

    echo "Total generations: $total_generations"
    echo "Total cost: \$$total_cost"
    echo

    echo "Cost by voice profile:"
    jq -s 'group_by(.voice) |
           map({voice: .[0].voice,
                cost: (map(.cost) | add),
                count: length}) |
           .[] |
           "\(.voice)\t$\(.cost)\t\(.count) generations"' \
        "$VOX_LOGS_DIR/usage.jsonl" 2>/dev/null | \
        column -t -s $'\t'
}

# Cost comparison by voice
vox_cost_by_voice() {
    echo "Cost Efficiency by Voice"
    echo "========================"
    echo

    if [[ ! -f "$VOX_LOGS_DIR/usage.jsonl" ]]; then
        echo "No usage data found"
        return 0
    fi

    echo "Voice                          Avg Cost/Char    Total Cost    Generations"
    echo "--------------------------------------------------------------------------"

    jq -s 'group_by(.voice) |
           map({voice: .[0].voice,
                avg_cost_per_char: ((map(.cost) | add) / (map(.chars) | add)),
                total_cost: (map(.cost) | add),
                count: length})' \
        "$VOX_LOGS_DIR/usage.jsonl" 2>/dev/null | \
        jq -r '.[] | "\(.voice)\t\(.avg_cost_per_char)\t$\(.total_cost)\t\(.count)"' | \
        column -t -s $'\t'
}

# System status
vox_status() {
    echo
    echo "  Vox - Text-to-Speech System, v1.0"
    echo
    echo "Active voice: $(_vox_get_active_voice)"
    echo

    echo "Directories:"
    echo "  VOX_DIR: $VOX_DIR"
    echo "  QA_DIR: $QA_DIR (shared)"
    echo "  QA_DB_DIR: $QA_DB_DIR (shared)"
    echo

    echo "Configuration files:"
    [[ -f "$VOX_VOICE_FILE" ]] && echo "  ✓ Active voice: $VOX_VOICE_FILE" || echo "  ○ Active voice: $VOX_VOICE_FILE (default)"
    [[ -f "$VOX_PROFILES_FILE" ]] && echo "  ✓ Voice profiles: $VOX_PROFILES_FILE" || echo "  ✗ Voice profiles: $VOX_PROFILES_FILE (missing)"
    echo

    # Cache stats
    local audio_count=$(find "$QA_DB_DIR" -name "*.vox.*.mp3" 2>/dev/null | wc -l | tr -d ' ')
    local grade_count=$(find "$QA_DB_DIR" -name "*.vox.*.grade" 2>/dev/null | wc -l | tr -d ' ')

    echo "Cache statistics:"
    echo "  Audio files: $audio_count"
    echo "  Graded combinations: $grade_count"
    echo

    if [[ -f "$VOX_LOGS_DIR/usage.jsonl" ]]; then
        local total_cost=$(jq -s 'map(.cost) | add' "$VOX_LOGS_DIR/usage.jsonl" 2>/dev/null || echo "0")
        echo "Total cost (all time): \$$total_cost"
    fi
}
