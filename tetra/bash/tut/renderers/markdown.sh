#!/usr/bin/env bash
# markdown.sh - Markdown renderer for tutorials
#
# Generates static Markdown from JSON tutorial definitions

# Main entry point for Markdown generation
_tut_render_markdown() {
    local json_file="$1"
    local output_file="$2"

    _tut_require_file "$json_file" "JSON file" || return 1
    _tut_require_jq || return 1

    # Validate JSON
    if ! jq empty "$json_file" 2>/dev/null; then
        echo "Error: Invalid JSON in $json_file"
        return 1
    fi

    # Determine output file
    if [[ -z "$output_file" ]]; then
        local basename="${json_file%.json}"
        output_file="${TUT_DIR}/generated/$(basename "$basename").md"
    fi

    echo "Generating Markdown: $json_file -> $output_file"

    # Generate Markdown
    _md_generate "$json_file" > "$output_file"

    echo "✓ Generated: $output_file"
}

_md_generate() {
    local json_file="$1"

    local title=$(tut_meta "$json_file" "title")
    local subtitle=$(tut_meta "$json_file" "subtitle" "")
    local description=$(tut_meta "$json_file" "description" "")
    local author=$(tut_meta "$json_file" "author" "")
    local version=$(tut_meta "$json_file" "version" "")

    # Title and metadata
    echo "# $title"
    echo ""
    [[ -n "$subtitle" ]] && echo "*$subtitle*" && echo ""
    [[ -n "$description" ]] && echo "$description" && echo ""

    # Metadata block
    echo "---"
    [[ -n "$author" ]] && echo "**Author:** $author  "
    [[ -n "$version" ]] && echo "**Version:** $version  "
    echo "**Steps:** $(tut_step_count "$json_file")"
    echo ""

    # Prerequisites
    local prereqs=$(jq -r '.metadata.prerequisites[]? // empty' "$json_file" 2>/dev/null)
    if [[ -n "$prereqs" ]]; then
        echo "**Prerequisites:**"
        while IFS= read -r prereq; do
            echo "- $prereq"
        done <<< "$prereqs"
        echo ""
    fi
    echo "---"
    echo ""

    # Table of contents
    echo "## Table of Contents"
    echo ""
    local step_count=$(tut_step_count "$json_file")
    for ((i=0; i<step_count; i++)); do
        local step_title=$(tut_step "$json_file" "$i" "title")
        local anchor=$(echo "$step_title" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g' | sed 's/[^a-z0-9-]//g')
        echo "$((i+1)). [$step_title](#$anchor)"
    done
    echo ""
    echo "---"
    echo ""

    # Render steps
    _md_render_steps "$json_file"
}

_md_render_steps() {
    local json_file="$1"
    local step_count=$(tut_step_count "$json_file")

    for ((i=0; i<step_count; i++)); do
        local title=$(tut_step "$json_file" "$i" "title")
        local subtitle=$(tut_step "$json_file" "$i" "subtitle" "")

        echo "## Step $((i+1)): $title"
        echo ""
        [[ -n "$subtitle" && "$subtitle" != "null" ]] && echo "*$subtitle*" && echo ""

        _md_render_content "$json_file" "$i"
        _md_render_terminal "$json_file" "$i"
        _md_render_details "$json_file" "$i"

        echo "---"
        echo ""
    done
}

_md_render_content() {
    local json_file="$1"
    local step_idx="$2"
    local content_count=$(tut_content_count "$json_file" "$step_idx")

    for ((j=0; j<content_count; j++)); do
        local block_type=$(tut_content "$json_file" "$step_idx" "$j" "type")

        case "$block_type" in
            paragraph)
                local text=$(tut_content "$json_file" "$step_idx" "$j" "text")
                echo "$text"
                echo ""
                ;;
            list)
                _md_render_list "$json_file" "$step_idx" "$j"
                ;;
            learn-box|info-box)
                _md_render_info_box "$json_file" "$step_idx" "$j"
                ;;
            warning-box)
                _md_render_warning_box "$json_file" "$step_idx" "$j"
                ;;
            you-try)
                _md_render_you_try "$json_file" "$step_idx" "$j"
                ;;
            command-block)
                _md_render_command_block "$json_file" "$step_idx" "$j"
                ;;
            code-block)
                _md_render_code_block "$json_file" "$step_idx" "$j"
                ;;
        esac
    done
}

_md_render_list() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"

    local list_title=$(tut_content "$json_file" "$step_idx" "$block_idx" "title" "")
    local ordered=$(tut_content "$json_file" "$step_idx" "$block_idx" "ordered" "false")

    [[ -n "$list_title" && "$list_title" != "null" ]] && echo "**$list_title**" && echo ""

    local count=1
    while IFS= read -r item; do
        if [[ "$ordered" == "true" ]]; then
            echo "$count. $item"
            ((count++))
        else
            echo "- $item"
        fi
    done < <(tut_list_items "$json_file" "$step_idx" "$block_idx")
    echo ""
}

_md_render_info_box() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"

    local title=$(tut_content "$json_file" "$step_idx" "$block_idx" "title")

    echo "> **ℹ️ $title**"
    echo ">"

    local nested_count=$(tut_nested_count "$json_file" "$step_idx" "$block_idx")
    for ((n=0; n<nested_count; n++)); do
        local nested_type=$(tut_nested "$json_file" "$step_idx" "$block_idx" "$n" "type")

        case "$nested_type" in
            paragraph)
                local text=$(tut_nested "$json_file" "$step_idx" "$block_idx" "$n" "text")
                echo "> $text"
                echo ">"
                ;;
            list)
                while IFS= read -r item; do
                    echo "> - $item"
                done < <(tut_nested_list_items "$json_file" "$step_idx" "$block_idx" "$n")
                echo ">"
                ;;
            command-block)
                echo "> \`\`\`bash"
                while IFS= read -r cmd; do
                    echo "> $cmd"
                done < <(tut_nested_commands "$json_file" "$step_idx" "$block_idx" "$n")
                echo "> \`\`\`"
                echo ">"
                ;;
        esac
    done
    echo ""
}

_md_render_warning_box() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"

    local title=$(tut_content "$json_file" "$step_idx" "$block_idx" "title")

    echo "> **⚠️ $title**"
    echo ">"

    local nested_count=$(tut_nested_count "$json_file" "$step_idx" "$block_idx")
    for ((n=0; n<nested_count; n++)); do
        local nested_type=$(tut_nested "$json_file" "$step_idx" "$block_idx" "$n" "type")

        case "$nested_type" in
            paragraph)
                local text=$(tut_nested "$json_file" "$step_idx" "$block_idx" "$n" "text")
                echo "> $text"
                echo ">"
                ;;
            list)
                while IFS= read -r item; do
                    echo "> - $item"
                done < <(tut_nested_list_items "$json_file" "$step_idx" "$block_idx" "$n")
                echo ">"
                ;;
        esac
    done
    echo ""
}

_md_render_you_try() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"

    local title=$(tut_content "$json_file" "$step_idx" "$block_idx" "title")

    echo "### 🎯 $title"
    echo ""

    local nested_count=$(tut_nested_count "$json_file" "$step_idx" "$block_idx")
    for ((n=0; n<nested_count; n++)); do
        local nested_type=$(tut_nested "$json_file" "$step_idx" "$block_idx" "$n" "type")

        case "$nested_type" in
            paragraph)
                local text=$(tut_nested "$json_file" "$step_idx" "$block_idx" "$n" "text")
                echo "$text"
                echo ""
                ;;
            list)
                while IFS= read -r item; do
                    echo "- $item"
                done < <(tut_nested_list_items "$json_file" "$step_idx" "$block_idx" "$n")
                echo ""
                ;;
            command-block)
                echo "\`\`\`bash"
                while IFS= read -r cmd; do
                    echo "$cmd"
                done < <(tut_nested_commands "$json_file" "$step_idx" "$block_idx" "$n")
                echo "\`\`\`"
                echo ""
                ;;
        esac
    done
}

_md_render_command_block() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"

    echo "\`\`\`bash"
    while IFS= read -r cmd; do
        echo "$cmd"
    done < <(tut_commands "$json_file" "$step_idx" "$block_idx")
    echo "\`\`\`"
    echo ""
}

_md_render_code_block() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"

    local language=$(tut_content "$json_file" "$step_idx" "$block_idx" "language")
    local code=$(tut_content "$json_file" "$step_idx" "$block_idx" "code")
    local caption=$(tut_content "$json_file" "$step_idx" "$block_idx" "caption" "")

    echo "\`\`\`$language"
    echo "$code"
    echo "\`\`\`"
    [[ -n "$caption" && "$caption" != "null" ]] && echo "*$caption*"
    echo ""
}

_md_render_terminal() {
    local json_file="$1"
    local step_idx="$2"

    local term_count=$(tut_terminal_count "$json_file" "$step_idx")
    [[ "$term_count" -eq 0 ]] && return

    echo "**Terminal Session:**"
    echo ""
    echo "\`\`\`bash"

    for ((t=0; t<term_count; t++)); do
        local term_type=$(tut_terminal "$json_file" "$step_idx" "$t" "type")
        local term_content=$(tut_terminal "$json_file" "$step_idx" "$t" "content")

        case "$term_type" in
            prompt)
                echo -n "$term_content"
                ;;
            command)
                echo "$term_content"
                ;;
            output|output-success|output-warning|output-error|output-header)
                echo "$term_content"
                ;;
            comment)
                echo "$term_content"
                ;;
            blank)
                echo ""
                ;;
        esac
    done

    echo "\`\`\`"
    echo ""
}

_md_render_details() {
    local json_file="$1"
    local step_idx="$2"

    local has_details=$(tut_step "$json_file" "$step_idx" "details.enabled" "false")
    [[ "$has_details" != "true" ]] && return

    local details_title=$(tut_step "$json_file" "$step_idx" "details.title" "Under the Hood")
    local details_icon=$(tut_step "$json_file" "$step_idx" "details.icon" "🔍")

    echo "<details>"
    echo "<summary>$details_icon $details_title</summary>"
    echo ""

    local section_count=$(jq ".steps[$step_idx].details.sections | length" "$json_file")
    for ((s=0; s<section_count; s++)); do
        local section_title=$(jq -r ".steps[$step_idx].details.sections[$s].title" "$json_file")
        local section_content=$(jq -r ".steps[$step_idx].details.sections[$s].content" "$json_file")

        echo "#### $section_title"
        echo ""
        echo "$section_content"
        echo ""
    done

    echo "</details>"
    echo ""
}

# internal function
