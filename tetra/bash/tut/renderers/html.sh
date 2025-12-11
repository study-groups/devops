#!/usr/bin/env bash
# html.sh - HTML renderer for tutorials
#
# Generates interactive HTML from JSON tutorial definitions

# Main entry point for HTML generation
_tut_render_html() {
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
        local out_dir="${TUT_OUTPUT_DIR:-${TUT_DIR}/generated}"
        mkdir -p "$out_dir"
        output_file="${out_dir}/$(basename "$basename").html"
    fi

    # Show what we're doing
    printf "  Type:   "; _tut_accent "guide"; echo
    printf "  Source: "; _tut_accent "$(basename "$json_file")"; echo
    printf "          "; _tut_dim "$json_file"; echo

    # Generate HTML
    _html_generate "$json_file" > "$output_file"

    # Stats
    local step_count=$(_tut_step_count "$json_file")
    local size=$(du -h "$output_file" | cut -f1)

    printf "  Output: "; _tut_accent "$(basename "$output_file")"; echo
    printf "          "; _tut_dim "$output_file"; echo
    printf "  Stats:  %s steps, %s\n" "$step_count" "$size"
    echo
}

_html_generate() {
    local json_file="$1"

    local title=$(_tut_meta "$json_file" "title")
    local subtitle=$(_tut_meta "$json_file" "subtitle" "")
    local version=$(_tut_meta "$json_file" "version" "0.0.0")
    local author=$(_tut_meta "$json_file" "author" "")
    local source_file=$(basename "$json_file")
    local build_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # HTML head
    cat <<HTML_HEAD
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="generator" content="tut">
    <meta name="tut:source" content="$source_file">
    <meta name="tut:version" content="$version">
    <meta name="tut:built" content="$build_time">
    <meta name="tut:type" content="tutorial">
    <meta name="tut:author" content="$author">
HTML_HEAD

    echo "    <title>$title</title>"
    echo ""

    # Base styles
    if [[ -f "$TUT_SRC/templates/base-styles.css" ]]; then
        echo "    <style>"
        cat "$TUT_SRC/templates/base-styles.css"
        echo "    </style>"
    fi

    # Mindmap module styles
    if [[ -f "$TUT_SRC/templates/mindmap/mindmap.css" ]]; then
        echo "    <style>"
        echo "    /* TUT Mindmap Module */"
        cat "$TUT_SRC/templates/mindmap/mindmap.css"
        echo "    </style>"
    fi

    # TDS theme CSS (if theme.tds is specified)
    local tds_theme=$(_tut_meta "$json_file" "theme.tds" "")
    if [[ -n "$tds_theme" && "$tds_theme" != "null" ]]; then
        # Source TDS CSS export if available
        if [[ -f "$TETRA_SRC/bash/tds/exports/css_export.sh" ]]; then
            source "$TETRA_SRC/bash/tds/exports/css_export.sh"
            # Switch to requested theme and export CSS
            if type -t tds_switch_theme &>/dev/null; then
                tds_switch_theme "$tds_theme" 2>/dev/null
            fi
            echo "    <style>"
            echo "        /* TDS Theme: $tds_theme */"
            tds_export_css_root "            "
            echo "    </style>"
        fi
    fi

    # Design token editor styles - always included, visibility controlled by ?design URL param
    if [[ -f "$TUT_SRC/templates/design-tokens.css" ]]; then
        echo "    <style>"
        cat "$TUT_SRC/templates/design-tokens.css"
        echo "    </style>"
    fi

    # Theme overrides
    if [[ $(_tut_has_theme "$json_file") == "true" ]]; then
        echo "    <style>"
        echo "        :root {"
        _tut_theme_css "$json_file"
        echo "        }"
        echo "    </style>"
    fi

    echo "</head>"
    echo "<body>"

    # Header
    echo "    <div class=\"tutorial-header\">"
    echo "        <h1>$title</h1>"
    [[ -n "$subtitle" ]] && echo "        <p>$subtitle</p>"
    echo "    </div>"

    # Navigation
    local step_count=$(_tut_step_count "$json_file")
    cat <<HTML_NAV
    <div class="navigation">
        <button class="nav-button nav-prev" onclick="prevStep()" id="prevBtn" disabled>← Previous</button>
        <div class="progress" id="progress">Step 1 of $step_count</div>
        <button class="nav-button nav-next" onclick="nextStep()" id="nextBtn">Next →</button>
    </div>
HTML_NAV

    # Main container
    echo "    <div class=\"container\">"

    # Narrative panel
    echo "        <div class=\"panel narrative-panel\">"
    echo "            <div class=\"panel-header\">Tutorial Guide</div>"
    echo "            <div class=\"narrative-content\">"
    _html_render_steps "$json_file"
    echo "            </div>"
    echo "        </div>"

    # Terminal panel
    cat <<'HTML_TERMINAL'
        <div class="panel terminal-panel">
            <div class="panel-header">Terminal Output</div>
            <div class="terminal-window">
                <div class="terminal-titlebar">
                    <div class="terminal-dot dot-red"></div>
                    <div class="terminal-dot dot-yellow"></div>
                    <div class="terminal-dot dot-green"></div>
                    <div class="terminal-title">bash - tutorial</div>
                </div>
                <div class="terminal-content" id="terminal"></div>
            </div>
        </div>
HTML_TERMINAL

    echo "    </div>"

    # Design token editor HTML - always included, visibility controlled by ?design URL param
    if [[ -f "$TUT_SRC/templates/design-tokens.html" ]]; then
        echo ""
        echo "    <!-- Design Token Editor (visible with ?design=true) -->"
        cat "$TUT_SRC/templates/design-tokens.html"
    fi

    # JavaScript - always include design tokens, visibility controlled by ?design URL param
    _html_render_javascript "$json_file" "true"

    echo "</body>"
    echo "</html>"
}

_html_render_steps() {
    local json_file="$1"
    local step_count=$(_tut_step_count "$json_file")

    for ((i=0; i<step_count; i++)); do
        local step_id=$(_tut_step "$json_file" "$i" "id")
        local title=$(_tut_step "$json_file" "$i" "title")
        local subtitle=$(_tut_step "$json_file" "$i" "subtitle" "")

        local active_class=""
        [[ $i -eq 0 ]] && active_class=" active"

        echo "                <div class=\"step$active_class\" data-step=\"$i\">"
        echo "                    <span class=\"step-number\">Step $((i+1))</span>"
        echo "                    <h2>$title</h2>"

        [[ -n "$subtitle" && "$subtitle" != "null" ]] && \
            echo "                    <p class=\"subtitle\">$subtitle</p>"

        _html_render_content "$json_file" "$i"
        _html_render_details "$json_file" "$i"

        echo "                </div>"
        echo ""
    done
}

_html_render_content() {
    local json_file="$1"
    local step_idx="$2"
    local content_count=$(_tut_content_count "$json_file" "$step_idx")

    for ((j=0; j<content_count; j++)); do
        local block_type=$(_tut_content "$json_file" "$step_idx" "$j" "type")

        case "$block_type" in
            paragraph)
                local text=$(_tut_content "$json_file" "$step_idx" "$j" "text")
                echo "                    <p>$text</p>"
                ;;
            list)
                _html_render_list "$json_file" "$step_idx" "$j"
                ;;
            learn-box|info-box|warning-box|you-try)
                _html_render_box "$json_file" "$step_idx" "$j" "$block_type"
                ;;
            command-block)
                _html_render_command_block "$json_file" "$step_idx" "$j"
                ;;
            code-block)
                _html_render_code_block "$json_file" "$step_idx" "$j"
                ;;
            mindmap)
                _html_render_mindmap "$json_file" "$step_idx" "$j"
                ;;
        esac
    done
}

_html_render_list() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"

    local list_title=$(_tut_content "$json_file" "$step_idx" "$block_idx" "title" "")
    local ordered=$(_tut_content "$json_file" "$step_idx" "$block_idx" "ordered" "false")

    [[ -n "$list_title" && "$list_title" != "null" ]] && \
        echo "                    <p><strong>$list_title</strong></p>"

    local tag="ul"
    [[ "$ordered" == "true" ]] && tag="ol"

    echo "                    <$tag class=\"content-list\">"
    while IFS= read -r item; do
        echo "                        <li>$item</li>"
    done < <(_tut_list_items "$json_file" "$step_idx" "$block_idx")
    echo "                    </$tag>"
}

_html_render_box() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"
    local box_type="$4"

    local title=$(_tut_content "$json_file" "$step_idx" "$block_idx" "title")

    local css_class="learn-box"
    case "$box_type" in
        you-try) css_class="you-try" ;;
        warning-box) css_class="warning-box" ;;
    esac

    echo "                    <div class=\"$css_class\">"
    echo "                        <div class=\"${css_class}-header\">$title</div>"

    local nested_count=$(_tut_nested_count "$json_file" "$step_idx" "$block_idx")
    for ((n=0; n<nested_count; n++)); do
        local nested_type=$(_tut_nested "$json_file" "$step_idx" "$block_idx" "$n" "type")

        case "$nested_type" in
            paragraph)
                local text=$(_tut_nested "$json_file" "$step_idx" "$block_idx" "$n" "text")
                echo "                        <p>$text</p>"
                ;;
            list)
                echo "                        <ul>"
                while IFS= read -r item; do
                    echo "                            <li>$item</li>"
                done < <(_tut_nested_list_items "$json_file" "$step_idx" "$block_idx" "$n")
                echo "                        </ul>"
                ;;
            command-block)
                echo "                        <div class=\"command-hint\">"
                local first=true
                while IFS= read -r cmd; do
                    [[ "$first" == "true" ]] || echo "<br>"
                    echo -n "$cmd"
                    first=false
                done < <(_tut_nested_commands "$json_file" "$step_idx" "$block_idx" "$n")
                echo ""
                echo "                        </div>"
                ;;
        esac
    done

    echo "                    </div>"
}

_html_render_command_block() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"

    echo "                    <div class=\"command-hint\">"
    local first=true
    while IFS= read -r cmd; do
        [[ "$first" == "true" ]] || echo "<br>"
        echo -n "$cmd"
        first=false
    done < <(_tut_commands "$json_file" "$step_idx" "$block_idx")
    echo ""
    echo "                    </div>"
}

_html_render_code_block() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"

    local language=$(_tut_content "$json_file" "$step_idx" "$block_idx" "language")
    local code=$(_tut_content "$json_file" "$step_idx" "$block_idx" "code")
    local caption=$(_tut_content "$json_file" "$step_idx" "$block_idx" "caption" "")

    echo "                    <div class=\"code-block\">"
    echo "                        <pre><code class=\"language-$language\">$code</code></pre>"
    [[ -n "$caption" && "$caption" != "null" ]] && \
        echo "                        <div class=\"code-caption\">$caption</div>"
    echo "                    </div>"
}

_html_render_mindmap() {
    local json_file="$1"
    local step_idx="$2"
    local block_idx="$3"

    local center_label=$(_tut_content "$json_file" "$step_idx" "$block_idx" "center.label")
    local center_sub=$(_tut_content "$json_file" "$step_idx" "$block_idx" "center.sub" "")
    local title=$(_tut_content "$json_file" "$step_idx" "$block_idx" "title" "")

    # Count spokes
    local spoke_count=$(jq ".steps[$step_idx].content[$block_idx].spokes | length" "$json_file")

    echo "                    <div class=\"mindmap\">"
    echo "                        <div class=\"mindmap-container\" data-spokes=\"$spoke_count\">"

    # Center node
    echo "                            <div class=\"mindmap-center\">"
    echo "                                <div class=\"mindmap-center-label\">$center_label</div>"
    [[ -n "$center_sub" && "$center_sub" != "null" ]] && \
        echo "                                <div class=\"mindmap-center-sub\">$center_sub</div>"
    echo "                            </div>"

    # Spoke nodes
    for ((s=0; s<spoke_count; s++)); do
        local spoke_label=$(jq -r ".steps[$step_idx].content[$block_idx].spokes[$s].label" "$json_file")
        local spoke_sub=$(jq -r ".steps[$step_idx].content[$block_idx].spokes[$s].sub // empty" "$json_file")
        local spoke_path=$(jq -r ".steps[$step_idx].content[$block_idx].spokes[$s].path // empty" "$json_file")
        local spoke_desc=$(jq -r ".steps[$step_idx].content[$block_idx].spokes[$s].description // empty" "$json_file")

        echo "                            <div class=\"mindmap-spoke\">"
        echo "                                <div class=\"mindmap-spoke-label\">$spoke_label</div>"
        [[ -n "$spoke_sub" ]] && \
            echo "                                <div class=\"mindmap-spoke-sub\">$spoke_sub</div>"

        # Expandable detail section
        if [[ -n "$spoke_path" || -n "$spoke_desc" ]]; then
            echo "                                <div class=\"mindmap-spoke-detail\">"
            [[ -n "$spoke_path" ]] && \
                echo "                                    <div class=\"mindmap-spoke-detail-path\">$spoke_path</div>"
            [[ -n "$spoke_desc" ]] && \
                echo "                                    <div class=\"mindmap-spoke-detail-desc\">$spoke_desc</div>"
            echo "                                </div>"
        fi

        echo "                            </div>"
    done

    echo "                        </div>"

    # Caption
    [[ -n "$title" && "$title" != "null" ]] && \
        echo "                        <div class=\"mindmap-title\">$title</div>"

    echo "                    </div>"
}

_html_render_details() {
    local json_file="$1"
    local step_idx="$2"

    local has_details=$(_tut_step "$json_file" "$step_idx" "details.enabled" "false")
    [[ "$has_details" != "true" ]] && return

    local details_title=$(_tut_step "$json_file" "$step_idx" "details.title" "Under the Hood")
    local details_icon=$(_tut_step "$json_file" "$step_idx" "details.icon" "🔍")
    local collapsed=$(_tut_step "$json_file" "$step_idx" "details.collapsed" "true")

    local collapsed_class=""
    [[ "$collapsed" == "true" ]] && collapsed_class=" collapsed"

    echo "                    <div class=\"details-section$collapsed_class\">"
    echo "                        <div class=\"details-toggle\" onclick=\"toggleDetails(this)\">"
    echo "                            <span class=\"details-icon\">$details_icon</span>"
    echo "                            <span class=\"details-title\">$details_title</span>"
    echo "                            <span class=\"details-arrow\">▼</span>"
    echo "                        </div>"
    echo "                        <div class=\"details-content\">"

    local section_count=$(jq ".steps[$step_idx].details.sections | length" "$json_file")
    for ((s=0; s<section_count; s++)); do
        local section_type=$(jq -r ".steps[$step_idx].details.sections[$s].type" "$json_file")
        local section_title=$(jq -r ".steps[$step_idx].details.sections[$s].title" "$json_file")
        local section_content=$(jq -r ".steps[$step_idx].details.sections[$s].content" "$json_file")

        echo "                            <div class=\"detail-$section_type\">"
        echo "                                <h4>$section_title</h4>"
        echo "                                <p>$section_content</p>"
        echo "                            </div>"
    done

    echo "                        </div>"
    echo "                    </div>"
}

_html_render_javascript() {
    local json_file="$1"
    local include_design_tokens="${2:-true}"

    echo "    <script>"
    echo "        let currentStep = 0;"
    echo "        const totalSteps = $(_tut_step_count "$json_file") - 1;"
    echo ""
    echo "        const terminalContent = {"

    local step_count=$(_tut_step_count "$json_file")
    for ((i=0; i<step_count; i++)); do
        echo "            $i: ["

        local term_count=$(_tut_terminal_count "$json_file" "$i")
        for ((t=0; t<term_count; t++)); do
            local term_type=$(_tut_terminal "$json_file" "$i" "$t" "type")
            local term_content=$(_tut_terminal "$json_file" "$i" "$t" "content" | sed 's/"/\\"/g')
            local term_inline=$(_tut_terminal "$json_file" "$i" "$t" "inline" "false")
            local term_highlight=$(_tut_terminal "$json_file" "$i" "$t" "highlight" "false")

            echo -n "                { type: '$term_type', text: \"$term_content\""
            [[ "$term_inline" == "true" ]] && echo -n ", inline: true"
            [[ "$term_highlight" == "true" ]] && echo -n ", highlight: true"
            echo -n " }"
            [[ $t -lt $((term_count-1)) ]] && echo "," || echo ""
        done

        echo -n "            ]"
        [[ $i -lt $((step_count-1)) ]] && echo "," || echo ""
    done

    echo "        };"
    echo ""

    # Base script
    if [[ -f "$TUT_SRC/templates/base-script.js" ]]; then
        cat "$TUT_SRC/templates/base-script.js"
    fi

    # Mindmap module script
    if [[ -f "$TUT_SRC/templates/mindmap/mindmap.js" ]]; then
        echo ""
        echo "        // TUT Mindmap Module"
        cat "$TUT_SRC/templates/mindmap/mindmap.js"
    fi

    # Design token editor script
    if [[ "$include_design_tokens" == "true" && -f "$TUT_SRC/templates/design-tokens.js" ]]; then
        echo ""
        echo "        // Design Token Editor"
        cat "$TUT_SRC/templates/design-tokens.js"
    fi

    echo "    </script>"
}

# internal function
