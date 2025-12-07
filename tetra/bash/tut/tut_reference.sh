#!/usr/bin/env bash

# TUT Reference Documentation Renderer
# Generates scrollable reference docs from JSON definitions

# Convert inline markdown to HTML
# Supports: `code`, **bold**, *italic*
_tut_ref_md_to_html() {
    local text="$1"
    # Convert backticks to <code>
    text=$(echo "$text" | sed 's/`\([^`]*\)`/<code>\1<\/code>/g')
    # Convert **bold** to <strong>
    text=$(echo "$text" | sed 's/\*\*\([^*]*\)\*\*/<strong>\1<\/strong>/g')
    # Convert *italic* to <em>
    text=$(echo "$text" | sed 's/\*\([^*]*\)\*/<em>\1<\/em>/g')
    echo "$text"
}

# Render reference documentation as HTML
# Usage: tut_render_reference <json_file> [output_file]
_tut_render_reference() {
    local json_file="$1"
    local output_file="$2"

    if [[ -z "$json_file" ]]; then
        echo "Usage: tut_render_reference <json_file> [output_file]"
        return 1
    fi

    _tut_require_file "$json_file" "JSON file" || return 1

    # Determine output file
    if [[ -z "$output_file" ]]; then
        local basename="${json_file%.json}"
        basename="${basename%-ref}"
        output_file="${TUT_DIR}/generated/${basename##*/}-reference.html"
    fi

    # Ensure output directory exists
    mkdir -p "$(dirname "$output_file")"

    # Show what we're doing
    printf "  Type:   "; _tut_accent "reference"; echo
    printf "  Source: "; _tut_accent "$(basename "$json_file")"; echo
    printf "          "; _tut_dim "$json_file"; echo

    # Generate HTML
    _tut_ref_generate_html "$json_file" > "$output_file"

    # Stats
    local group_count=$(jq '.groups | length' "$json_file")
    local topic_count=$(jq '[.groups[].topics[]] | length' "$json_file")
    local size=$(du -h "$output_file" | cut -f1)

    printf "  Output: "; _tut_accent "$(basename "$output_file")"; echo
    printf "          "; _tut_dim "$output_file"; echo
    printf "  Stats:  %s groups, %s topics, %s\n" "$group_count" "$topic_count" "$size"
    echo
}

# Internal: Generate complete HTML document
_tut_ref_generate_html() {
    local json_file="$1"

    # Verify required templates exist
    local ref_css="$TUT_SRC/templates/reference/reference-styles.css"
    local ref_js="$TUT_SRC/templates/reference/reference-script.js"
    local fab_css="$TUT_SRC/templates/design-tokens.css"
    local fab_js="$TUT_SRC/templates/design-tokens.js"
    local fab_html="$TUT_SRC/templates/design-tokens.html"

    for tmpl in "$ref_css" "$ref_js" "$fab_css" "$fab_js" "$fab_html"; do
        if [[ ! -f "$tmpl" ]]; then
            echo "Error: Missing template: $tmpl" >&2
            return 1
        fi
    done

    local title=$(jq -r '.metadata.title // "Documentation"' "$json_file")
    local tagline=$(jq -r '.metadata.tagline // ""' "$json_file")
    local version=$(jq -r '.metadata.version // "0.0.0"' "$json_file")
    local author=$(jq -r '.metadata.author // ""' "$json_file")
    local sidebar_position=$(jq -r '.metadata.sidebar_position // "right"' "$json_file")
    local source_file=$(basename "$json_file")
    local build_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # HTML header
    cat <<EOF
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="generator" content="tut">
    <meta name="tut:source" content="$source_file">
    <meta name="tut:version" content="$version">
    <meta name="tut:built" content="$build_time">
    <meta name="tut:type" content="reference">
    <meta name="tut:author" content="$author">
    <title>$title</title>
    <style>
$(cat "$ref_css")

/* Design Token Editor Styles */
$(cat "$fab_css")
    </style>
</head>
<body data-sidebar-position="$sidebar_position">
    <main class="content">
        <header class="page-header">
            <h1 class="page-title">$title</h1>
EOF

    [[ -n "$tagline" ]] && echo "            <p class=\"page-tagline\">$tagline</p>"

    echo "        </header>"
    echo ""

    # Generate topic sections
    _tut_ref_generate_sections "$json_file"

    # Version footer (only visible in design mode via ?design=true)
    cat <<EOF
        <footer class="doc-footer" id="docFooter">
            <span class="doc-version">v$version</span>
            <span class="doc-source">$source_file</span>
            <span class="doc-built">$build_time</span>
        </footer>
EOF

    echo "    </main>"
    echo ""

    # Generate sidebar navigation
    _tut_ref_generate_sidebar "$json_file"

    # Design Token FAB
    cat "$fab_html"

    # JavaScript
    cat <<EOF

    <script>
$(cat "$ref_js")

// Design Token Editor
$(cat "$fab_js")
    </script>
</body>
</html>
EOF
}

# Generate all topic sections
_tut_ref_generate_sections() {
    local json_file="$1"

    local group_count=$(jq '.groups | length' "$json_file")

    for ((g=0; g<group_count; g++)); do
        local topic_count=$(jq ".groups[$g].topics | length" "$json_file")

        for ((t=0; t<topic_count; t++)); do
            _tut_ref_generate_topic "$json_file" "$g" "$t"
        done
    done
}

# Generate a single topic section
_tut_ref_generate_topic() {
    local json_file="$1"
    local group_idx="$2"
    local topic_idx="$3"

    local topic_id=$(jq -r ".groups[$group_idx].topics[$topic_idx].id" "$json_file")
    local topic_title=$(jq -r ".groups[$group_idx].topics[$topic_idx].title" "$json_file")
    local topic_desc=$(jq -r ".groups[$group_idx].topics[$topic_idx].description // empty" "$json_file")

    cat <<EOF
        <section id="$topic_id" class="topic-section">
            <h2 class="section-title">$topic_title</h2>
EOF

    [[ -n "$topic_desc" ]] && echo "            <p class=\"section-description\">$(_tut_ref_md_to_html "$topic_desc")</p>"

    # Generate content blocks
    local content_count=$(jq ".groups[$group_idx].topics[$topic_idx].content | length" "$json_file")

    for ((c=0; c<content_count; c++)); do
        local content_type=$(jq -r ".groups[$group_idx].topics[$topic_idx].content[$c].type" "$json_file")

        case "$content_type" in
            paragraph)
                local text=$(jq -r ".groups[$group_idx].topics[$topic_idx].content[$c].text" "$json_file")
                echo "            <p>$(_tut_ref_md_to_html "$text")</p>"
                ;;
            command-list)
                _tut_ref_render_command_list "$json_file" "$group_idx" "$topic_idx" "$c"
                ;;
            code-block)
                _tut_ref_render_code_block "$json_file" "$group_idx" "$topic_idx" "$c"
                ;;
            module-grid)
                _tut_ref_render_module_grid "$json_file" "$group_idx" "$topic_idx" "$c"
                ;;
            list)
                _tut_ref_render_list "$json_file" "$group_idx" "$topic_idx" "$c"
                ;;
            table)
                _tut_ref_render_table "$json_file" "$group_idx" "$topic_idx" "$c"
                ;;
            api-endpoint)
                _tut_ref_render_api_endpoint "$json_file" "$group_idx" "$topic_idx" "$c"
                ;;
            api-function)
                _tut_ref_render_api_function "$json_file" "$group_idx" "$topic_idx" "$c"
                ;;
        esac
    done

    echo "        </section>"
    echo ""
}

# Render command list
_tut_ref_render_command_list() {
    local json_file="$1"
    local g="$2" t="$3" c="$4"

    echo "            <ul class=\"command-list\">"

    local cmd_count=$(jq ".groups[$g].topics[$t].content[$c].commands | length" "$json_file")
    for ((i=0; i<cmd_count; i++)); do
        local code=$(jq -r ".groups[$g].topics[$t].content[$c].commands[$i].code" "$json_file")
        local desc=$(jq -r ".groups[$g].topics[$t].content[$c].commands[$i].description" "$json_file")
        echo "                <li class=\"command-item\"><code class=\"command-code\">$code</code> <span class=\"command-desc\">$desc</span></li>"
    done

    echo "            </ul>"
}

# Render code block
_tut_ref_render_code_block() {
    local json_file="$1"
    local g="$2" t="$3" c="$4"

    local code=$(jq -r ".groups[$g].topics[$t].content[$c].code" "$json_file")
    local caption=$(jq -r ".groups[$g].topics[$t].content[$c].caption // empty" "$json_file")

    echo "            <pre class=\"code-block\"><code>$code</code></pre>"
    [[ -n "$caption" ]] && echo "            <p class=\"code-caption\"><em>$caption</em></p>"
}

# Render module grid
_tut_ref_render_module_grid() {
    local json_file="$1"
    local g="$2" t="$3" c="$4"

    echo "            <div class=\"module-grid\">"

    local mod_count=$(jq ".groups[$g].topics[$t].content[$c].modules | length" "$json_file")
    for ((i=0; i<mod_count; i++)); do
        local name=$(jq -r ".groups[$g].topics[$t].content[$c].modules[$i].name" "$json_file")
        local desc=$(jq -r ".groups[$g].topics[$t].content[$c].modules[$i].description" "$json_file")
        cat <<EOF
                <div class="module-card">
                    <h4 class="module-name">$name</h4>
                    <p class="module-desc">$desc</p>
                </div>
EOF
    done

    echo "            </div>"
}

# Render list
_tut_ref_render_list() {
    local json_file="$1"
    local g="$2" t="$3" c="$4"

    local ordered=$(jq -r ".groups[$g].topics[$t].content[$c].ordered // false" "$json_file")
    local tag="ul"
    [[ "$ordered" == "true" ]] && tag="ol"

    echo "            <$tag>"

    local item_count=$(jq ".groups[$g].topics[$t].content[$c].items | length" "$json_file")
    for ((i=0; i<item_count; i++)); do
        local item=$(jq -r ".groups[$g].topics[$t].content[$c].items[$i]" "$json_file")
        echo "                <li>$(_tut_ref_md_to_html "$item")</li>"
    done

    echo "            </$tag>"
}

# Render table
_tut_ref_render_table() {
    local json_file="$1"
    local g="$2" t="$3" c="$4"

    echo "            <table>"
    echo "                <thead><tr>"

    local header_count=$(jq ".groups[$g].topics[$t].content[$c].headers | length" "$json_file")
    for ((i=0; i<header_count; i++)); do
        local header=$(jq -r ".groups[$g].topics[$t].content[$c].headers[$i]" "$json_file")
        echo "                    <th>$(_tut_ref_md_to_html "$header")</th>"
    done

    echo "                </tr></thead>"
    echo "                <tbody>"

    local row_count=$(jq ".groups[$g].topics[$t].content[$c].rows | length" "$json_file")
    for ((r=0; r<row_count; r++)); do
        echo "                <tr>"
        local col_count=$(jq ".groups[$g].topics[$t].content[$c].rows[$r] | length" "$json_file")
        for ((col=0; col<col_count; col++)); do
            local cell=$(jq -r ".groups[$g].topics[$t].content[$c].rows[$r][$col]" "$json_file")
            echo "                    <td>$(_tut_ref_md_to_html "$cell")</td>"
        done
        echo "                </tr>"
    done

    echo "                </tbody>"
    echo "            </table>"
}

# Generate sidebar navigation
_tut_ref_generate_sidebar() {
    local json_file="$1"

    cat <<EOF
    <nav class="sidebar" role="navigation" aria-label="Documentation navigation">
        <div class="sidebar-header">
            <span class="sidebar-title">Topics</span>
        </div>

EOF

    local group_count=$(jq '.groups | length' "$json_file")

    for ((g=0; g<group_count; g++)); do
        local group_id=$(jq -r ".groups[$g].id" "$json_file")
        local group_title=$(jq -r ".groups[$g].title" "$json_file")
        local collapsed=$(jq -r ".groups[$g].collapsed // false" "$json_file")

        local collapsed_class=""
        [[ "$collapsed" == "true" ]] && collapsed_class=" collapsed"

        cat <<EOF
        <div class="nav-group$collapsed_class" data-group="$group_id">
            <button class="nav-group-title" aria-expanded="true" aria-controls="$group_id-nav">
                $group_title
            </button>
            <ul class="nav-list" id="$group_id-nav">
EOF

        local topic_count=$(jq ".groups[$g].topics | length" "$json_file")
        for ((t=0; t<topic_count; t++)); do
            local topic_id=$(jq -r ".groups[$g].topics[$t].id" "$json_file")
            local topic_title=$(jq -r ".groups[$g].topics[$t].title" "$json_file")
            echo "                <li class=\"nav-item\"><a class=\"nav-link\" href=\"#$topic_id\">$topic_title</a></li>"
        done

        echo "            </ul>"
        echo "        </div>"
        echo ""
    done

    echo "    </nav>"
}

# Render API endpoint
_tut_ref_render_api_endpoint() {
    local json_file="$1"
    local g="$2" t="$3" c="$4"

    local method=$(jq -r ".groups[$g].topics[$t].content[$c].method" "$json_file")
    local path=$(jq -r ".groups[$g].topics[$t].content[$c].path" "$json_file")
    local summary=$(jq -r ".groups[$g].topics[$t].content[$c].summary // empty" "$json_file")

    # Method color class
    local method_class="method-${method,,}"

    cat <<EOF
            <div class="api-endpoint">
                <div class="endpoint-header">
                    <span class="http-method $method_class">$method</span>
                    <code class="endpoint-path">$path</code>
                </div>
EOF

    [[ -n "$summary" ]] && echo "                <p class=\"endpoint-summary\">$summary</p>"

    # Parameters
    local param_count=$(jq ".groups[$g].topics[$t].content[$c].parameters | length // 0" "$json_file")
    if [[ $param_count -gt 0 ]]; then
        echo "                <div class=\"endpoint-params\">"
        echo "                    <h5>Parameters</h5>"
        echo "                    <table class=\"params-table\">"
        echo "                        <thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>"
        echo "                        <tbody>"
        for ((i=0; i<param_count; i++)); do
            local pname=$(jq -r ".groups[$g].topics[$t].content[$c].parameters[$i].name" "$json_file")
            local ptype=$(jq -r ".groups[$g].topics[$t].content[$c].parameters[$i].type" "$json_file")
            local preq=$(jq -r ".groups[$g].topics[$t].content[$c].parameters[$i].required // false" "$json_file")
            local pdesc=$(jq -r ".groups[$g].topics[$t].content[$c].parameters[$i].description // empty" "$json_file")
            local req_badge=""
            [[ "$preq" == "true" ]] && req_badge="<span class=\"required-badge\">required</span>"
            echo "                        <tr><td><code>$pname</code></td><td><code>$ptype</code></td><td>$req_badge</td><td>$pdesc</td></tr>"
        done
        echo "                        </tbody>"
        echo "                    </table>"
        echo "                </div>"
    fi

    # Request body example
    local req_example=$(jq -r ".groups[$g].topics[$t].content[$c].requestBody.example // empty" "$json_file")
    if [[ -n "$req_example" ]]; then
        echo "                <div class=\"endpoint-body\">"
        echo "                    <h5>Request Body</h5>"
        echo "                    <pre class=\"code-block\"><code>$req_example</code></pre>"
        echo "                </div>"
    fi

    # Responses
    local resp_count=$(jq ".groups[$g].topics[$t].content[$c].responses | length // 0" "$json_file")
    if [[ $resp_count -gt 0 ]]; then
        echo "                <div class=\"endpoint-responses\">"
        echo "                    <h5>Responses</h5>"
        for ((i=0; i<resp_count; i++)); do
            local status=$(jq -r ".groups[$g].topics[$t].content[$c].responses[$i].status" "$json_file")
            local rdesc=$(jq -r ".groups[$g].topics[$t].content[$c].responses[$i].description // empty" "$json_file")
            local rexample=$(jq -r ".groups[$g].topics[$t].content[$c].responses[$i].example // empty" "$json_file")
            local status_class="status-${status:0:1}xx"
            echo "                    <div class=\"response-item\">"
            echo "                        <span class=\"status-code $status_class\">$status</span> <span class=\"status-desc\">$rdesc</span>"
            [[ -n "$rexample" ]] && echo "                        <pre class=\"code-block\"><code>$rexample</code></pre>"
            echo "                    </div>"
        done
        echo "                </div>"
    fi

    echo "            </div>"
}

# Render API function
_tut_ref_render_api_function() {
    local json_file="$1"
    local g="$2" t="$3" c="$4"

    local name=$(jq -r ".groups[$g].topics[$t].content[$c].name" "$json_file")
    local signature=$(jq -r ".groups[$g].topics[$t].content[$c].signature" "$json_file")
    local summary=$(jq -r ".groups[$g].topics[$t].content[$c].summary // empty" "$json_file")

    cat <<EOF
            <div class="api-function">
                <div class="function-header">
                    <code class="function-signature">$signature</code>
                </div>
EOF

    [[ -n "$summary" ]] && echo "                <p class=\"function-summary\">$summary</p>"

    # Parameters
    local param_count=$(jq ".groups[$g].topics[$t].content[$c].parameters | length // 0" "$json_file")
    if [[ $param_count -gt 0 ]]; then
        echo "                <div class=\"function-params\">"
        echo "                    <h5>Parameters</h5>"
        echo "                    <dl class=\"param-list\">"
        for ((i=0; i<param_count; i++)); do
            local pname=$(jq -r ".groups[$g].topics[$t].content[$c].parameters[$i].name" "$json_file")
            local ptype=$(jq -r ".groups[$g].topics[$t].content[$c].parameters[$i].type" "$json_file")
            local pdefault=$(jq -r ".groups[$g].topics[$t].content[$c].parameters[$i].default // empty" "$json_file")
            local pdesc=$(jq -r ".groups[$g].topics[$t].content[$c].parameters[$i].description // empty" "$json_file")
            echo "                        <dt><code>$pname</code> <span class=\"param-type\">$ptype</span></dt>"
            local desc_text="$pdesc"
            [[ -n "$pdefault" ]] && desc_text="$desc_text (default: <code>$pdefault</code>)"
            echo "                        <dd>$desc_text</dd>"
        done
        echo "                    </dl>"
        echo "                </div>"
    fi

    # Returns
    local ret_type=$(jq -r ".groups[$g].topics[$t].content[$c].returns.type // empty" "$json_file")
    if [[ -n "$ret_type" ]]; then
        local ret_desc=$(jq -r ".groups[$g].topics[$t].content[$c].returns.description // empty" "$json_file")
        echo "                <div class=\"function-returns\">"
        echo "                    <h5>Returns</h5>"
        echo "                    <p><code>$ret_type</code> - $ret_desc</p>"
        echo "                </div>"
    fi

    # Example
    local example=$(jq -r ".groups[$g].topics[$t].content[$c].example // empty" "$json_file")
    if [[ -n "$example" ]]; then
        echo "                <div class=\"function-example\">"
        echo "                    <h5>Example</h5>"
        echo "                    <pre class=\"code-block\"><code>$example</code></pre>"
        echo "                </div>"
    fi

    echo "            </div>"
}

# internal function
