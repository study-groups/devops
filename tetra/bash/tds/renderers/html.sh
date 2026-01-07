#!/usr/bin/env bash

# TDS HTML Renderer
# Renders markdown to HTML using TDS semantic color tokens
# Creates hybrid style: proportional headings, monospace code, RFC-inspired formatting

# Configuration
: "${TDS_HTML_THEME:=default}"
: "${TDS_HTML_WIDTH:=80}"
: "${TDS_HTML_INLINE_STYLES:=false}"

# HTML escape function
_tds_html_escape() {
    local text="$1"
    text="${text//&/&amp;}"
    text="${text//</&lt;}"
    text="${text//>/&gt;}"
    text="${text//\"/&quot;}"
    echo -n "$text"
}

# Generate CSS from TDS semantic tokens
tds_html_generate_css() {
    local theme="${1:-default}"
    cat <<'CSS'
/* TDS Document Styles - Hybrid RFC-inspired format */
.tds-doc {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 16px;
    line-height: 1.6;
    color: var(--tds-text-primary, #c0caf5);
    background-color: var(--tds-bg-primary, #1a1b26);
    padding: 2rem;
    max-width: 800px;
    margin: 0 auto;
}

/* Typography - Proportional headings */
.tds-doc h1 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--tds-heading-h1, #7aa2f7);
    margin: 2rem 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid var(--tds-border-accent, #7aa2f7);
}

.tds-doc h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--tds-heading-h2, #7dcfff);
    margin: 1.5rem 0 0.75rem;
}

.tds-doc h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--tds-heading-h3, #bb9af7);
    margin: 1.25rem 0 0.5rem;
}

.tds-doc h4, .tds-doc h5, .tds-doc h6 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--tds-heading-h4, #9ece6a);
    margin: 1rem 0 0.5rem;
}

/* Paragraphs */
.tds-doc p {
    margin: 0.75rem 0;
}

/* Code - Monospace */
.tds-doc code {
    font-family: 'Courier New', Monaco, 'Ubuntu Mono', monospace;
    font-size: 0.9em;
    background-color: var(--tds-code-bg, #24283b);
    color: var(--tds-code-text, #9ece6a);
    padding: 0.2em 0.4em;
    border-radius: 3px;
}

.tds-doc pre {
    font-family: 'Courier New', Monaco, 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
    background-color: var(--tds-code-block-bg, #1f2335);
    color: var(--tds-code-block-text, #a9b1d6);
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
    line-height: 1.5;
    margin: 1rem 0;
    border-left: 4px solid var(--tds-border-accent, #7aa2f7);
}

.tds-doc pre code {
    background: none;
    padding: 0;
    font-size: inherit;
    color: inherit;
}

/* Lists */
.tds-doc ul, .tds-doc ol {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
}

.tds-doc li {
    margin: 0.25rem 0;
}

.tds-doc li::marker {
    color: var(--tds-accent-primary, #7aa2f7);
}

/* Checkbox lists */
.tds-doc .checkbox {
    display: inline-block;
    width: 1em;
    height: 1em;
    margin-right: 0.5em;
    vertical-align: middle;
}

.tds-doc .checkbox-checked {
    color: var(--tds-success, #9ece6a);
}

.tds-doc .checkbox-unchecked {
    color: var(--tds-text-muted, #565f89);
}

/* Blockquotes - RFC-inspired */
.tds-doc blockquote {
    margin: 1rem 0;
    padding: 0.5rem 1rem;
    border-left: 4px solid var(--tds-quote-border, #565f89);
    background-color: var(--tds-quote-bg, rgba(86, 95, 137, 0.1));
    color: var(--tds-quote-text, #9aa5ce);
    font-style: italic;
}

/* Links */
.tds-doc a {
    color: var(--tds-link, #7dcfff);
    text-decoration: underline;
}

.tds-doc a:hover {
    color: var(--tds-link-hover, #7aa2f7);
}

/* Horizontal rule */
.tds-doc hr {
    border: none;
    border-top: 1px solid var(--tds-border-primary, #3b4261);
    margin: 2rem 0;
}

/* Bold and emphasis */
.tds-doc strong {
    font-weight: 700;
    color: var(--tds-emphasis-bold, #e0af68);
}

.tds-doc em {
    font-style: italic;
    color: var(--tds-emphasis-italic, #bb9af7);
}

/* RFC-style note sections */
.tds-doc .note {
    padding: 1rem;
    margin: 1rem 0;
    border-left: 4px solid var(--tds-info, #7dcfff);
    background-color: var(--tds-info-bg, rgba(125, 207, 255, 0.1));
}

.tds-doc .warning {
    padding: 1rem;
    margin: 1rem 0;
    border-left: 4px solid var(--tds-warning, #e0af68);
    background-color: var(--tds-warning-bg, rgba(224, 175, 104, 0.1));
}

.tds-doc .error {
    padding: 1rem;
    margin: 1rem 0;
    border-left: 4px solid var(--tds-error, #f7768e);
    background-color: var(--tds-error-bg, rgba(247, 118, 142, 0.1));
}

/* Tables */
.tds-doc table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
}

.tds-doc th, .tds-doc td {
    padding: 0.5rem;
    border: 1px solid var(--tds-border-primary, #3b4261);
    text-align: left;
}

.tds-doc th {
    background-color: var(--tds-bg-secondary, #24283b);
    font-weight: 600;
}
CSS
}

# Render heading
_tds_html_heading() {
    local level="$1"
    local text="$2"
    local escaped_text
    escaped_text=$(_tds_html_escape "$text")
    echo "<h${level}>${escaped_text}</h${level}>"
}

# Render paragraph with inline formatting
_tds_html_paragraph() {
    local text="$1"

    # Process bold **text**
    while [[ "$text" =~ \*\*([^*]+)\*\* ]]; do
        local match="${BASH_REMATCH[0]}"
        local bold="${BASH_REMATCH[1]}"
        local escaped_bold
        escaped_bold=$(_tds_html_escape "$bold")
        text="${text//"$match"/<strong>${escaped_bold}</strong>}"
    done

    # Process inline code `code`
    while [[ "$text" =~ \`([^\`]+)\` ]]; do
        local match="${BASH_REMATCH[0]}"
        local code="${BASH_REMATCH[1]}"
        local escaped_code
        escaped_code=$(_tds_html_escape "$code")
        text="${text//"$match"/<code>${escaped_code}</code>}"
    done

    # Process links [text](url)
    while [[ "$text" =~ \[([^\]]+)\]\(([^\)]+)\) ]]; do
        local match="${BASH_REMATCH[0]}"
        local link_text="${BASH_REMATCH[1]}"
        local url="${BASH_REMATCH[2]}"
        local escaped_text escaped_url
        escaped_text=$(_tds_html_escape "$link_text")
        escaped_url=$(_tds_html_escape "$url")
        text="${text//"$match"/<a href=\"${escaped_url}\">${escaped_text}</a>}"
    done

    # Process emphasis *text*
    while [[ "$text" =~ \*([^*]+)\* ]]; do
        local match="${BASH_REMATCH[0]}"
        local italic="${BASH_REMATCH[1]}"
        local escaped_italic
        escaped_italic=$(_tds_html_escape "$italic")
        text="${text//"$match"/<em>${escaped_italic}</em>}"
    done

    echo "<p>${text}</p>"
}

# Render code block
_tds_html_code_block() {
    local lang="$1"
    local content="$2"
    local escaped_content
    escaped_content=$(_tds_html_escape "$content")

    if [[ -n "$lang" ]]; then
        echo "<pre><code class=\"language-${lang}\">${escaped_content}</code></pre>"
    else
        echo "<pre><code>${escaped_content}</code></pre>"
    fi
}

# Render list item
_tds_html_list_item() {
    local content="$1"
    local is_ordered="$2"

    # Process inline formatting in list item
    while [[ "$content" =~ \*\*([^*]+)\*\* ]]; do
        local match="${BASH_REMATCH[0]}"
        local bold="${BASH_REMATCH[1]}"
        local escaped_bold
        escaped_bold=$(_tds_html_escape "$bold")
        content="${content//"$match"/<strong>${escaped_bold}</strong>}"
    done

    while [[ "$content" =~ \`([^\`]+)\` ]]; do
        local match="${BASH_REMATCH[0]}"
        local code="${BASH_REMATCH[1]}"
        local escaped_code
        escaped_code=$(_tds_html_escape "$code")
        content="${content//"$match"/<code>${escaped_code}</code>}"
    done

    echo "<li>${content}</li>"
}

# Render checkbox item
_tds_html_checkbox_item() {
    local checked="$1"
    local content="$2"

    local checkbox_html
    if [[ "$checked" == "x" || "$checked" == "X" ]]; then
        checkbox_html='<span class="checkbox checkbox-checked">[x]</span>'
    else
        checkbox_html='<span class="checkbox checkbox-unchecked">[ ]</span>'
    fi

    echo "<li>${checkbox_html}${content}</li>"
}

# Render blockquote
_tds_html_blockquote() {
    local content="$1"
    local escaped_content
    escaped_content=$(_tds_html_escape "$content")
    echo "<blockquote>${escaped_content}</blockquote>"
}

# Render horizontal rule
_tds_html_hr() {
    echo "<hr>"
}

# Main HTML render function
tds_render_html() {
    local file="$1"
    local in_code_block=false
    local code_fence=""
    local code_content=""
    local in_list=false
    local list_type=""
    local input_source

    # Determine input source
    if [[ -z "$file" || "$file" == "-" ]]; then
        input_source="/dev/stdin"
    elif [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    else
        input_source="$file"
    fi

    while IFS= read -r line; do
        # Code blocks (fenced)
        if [[ "$line" =~ ^([[:space:]]*)\`\`\`(.*)$ ]]; then
            if [[ "$in_code_block" == false ]]; then
                in_code_block=true
                code_fence="${BASH_REMATCH[2]}"
                code_content=""
                continue
            else
                in_code_block=false
                _tds_html_code_block "$code_fence" "$code_content"
                code_content=""
                continue
            fi
        fi

        # Inside code block
        if [[ "$in_code_block" == true ]]; then
            if [[ -n "$code_content" ]]; then
                code_content+=$'\n'
            fi
            code_content+="$line"
            continue
        fi

        # Close list if needed
        if [[ "$in_list" == true && ! "$line" =~ ^[[:space:]]*[-*+0-9] ]]; then
            if [[ "$list_type" == "ul" ]]; then
                echo "</ul>"
            else
                echo "</ol>"
            fi
            in_list=false
        fi

        # Headers
        if [[ "$line" =~ ^(#{1,6})[[:space:]]+(.+)$ ]]; then
            local level=${#BASH_REMATCH[1]}
            local text="${BASH_REMATCH[2]}"
            _tds_html_heading "$level" "$text"
            continue
        fi

        # Horizontal rule
        if [[ "$line" =~ ^([-*_]){3,}$ ]]; then
            _tds_html_hr
            continue
        fi

        # Checkbox list items
        if [[ "$line" =~ ^([[:space:]]*)[-*+][[:space:]]+\[([[:space:]xX])\][[:space:]]+(.+)$ ]]; then
            local check="${BASH_REMATCH[2]}"
            local content="${BASH_REMATCH[3]}"
            if [[ "$in_list" == false ]]; then
                echo "<ul>"
                in_list=true
                list_type="ul"
            fi
            _tds_html_checkbox_item "$check" "$content"
            continue
        fi

        # Unordered list items
        if [[ "$line" =~ ^([[:space:]]*)[-*+][[:space:]]+(.+)$ ]]; then
            local content="${BASH_REMATCH[2]}"
            if [[ "$in_list" == false || "$list_type" != "ul" ]]; then
                if [[ "$in_list" == true ]]; then
                    echo "</ol>"
                fi
                echo "<ul>"
                in_list=true
                list_type="ul"
            fi
            _tds_html_list_item "$content" false
            continue
        fi

        # Ordered list items
        if [[ "$line" =~ ^([[:space:]]*)([0-9]+)\.[[:space:]]+(.+)$ ]]; then
            local content="${BASH_REMATCH[3]}"
            if [[ "$in_list" == false || "$list_type" != "ol" ]]; then
                if [[ "$in_list" == true ]]; then
                    echo "</ul>"
                fi
                echo "<ol>"
                in_list=true
                list_type="ol"
            fi
            _tds_html_list_item "$content" true
            continue
        fi

        # Blockquotes
        if [[ "$line" =~ ^\>[[:space:]]*(.+)$ ]]; then
            local content="${BASH_REMATCH[1]}"
            _tds_html_blockquote "$content"
            continue
        fi

        # Regular paragraph (non-empty line)
        if [[ -n "$line" ]]; then
            _tds_html_paragraph "$line"
        fi
    done < "$input_source"

    # Close any open list
    if [[ "$in_list" == true ]]; then
        if [[ "$list_type" == "ul" ]]; then
            echo "</ul>"
        else
            echo "</ol>"
        fi
    fi
}

# Generate complete HTML document
tds_html_document() {
    local file="$1"
    local title="${2:-Document}"
    local theme="${3:-default}"

    cat <<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
$(tds_html_generate_css "$theme")
    </style>
</head>
<body>
    <article class="tds-doc">
$(tds_render_html "$file")
    </article>
</body>
</html>
HTML
}

# Command interface
tds_html() {
    local file=""
    local title="Document"
    local full_document=false
    local css_only=false
    local theme="default"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --document|-d)
                full_document=true
                shift
                ;;
            --title|-t)
                title="$2"
                shift 2
                ;;
            --css|-c)
                css_only=true
                shift
                ;;
            --theme)
                theme="$2"
                shift 2
                ;;
            --help|-h)
                cat <<EOF
TDS HTML Renderer - Convert markdown to styled HTML

Usage: tds_html [OPTIONS] <file>

Options:
  --document, -d     Generate full HTML document with head/body
  --title, -t NAME   Set document title (default: "Document")
  --css, -c          Output only CSS (for external stylesheet)
  --theme THEME      Use specific theme (default: default)
  --help, -h         Show this help

Examples:
  tds_html README.md                    # Output HTML fragment
  tds_html --document README.md         # Output complete HTML document
  tds_html --css                        # Output CSS only
  cat file.md | tds_html -              # Process stdin

Note: Uses TDS semantic tokens for consistent styling across themes.
      Hybrid style: proportional headings, monospace code blocks.
EOF
                return 0
                ;;
            *)
                file="$1"
                shift
                ;;
        esac
    done

    if [[ "$css_only" == true ]]; then
        tds_html_generate_css "$theme"
        return 0
    fi

    if [[ -z "$file" ]]; then
        if [[ -p /dev/stdin || ! -t 0 ]]; then
            file="-"
        else
            echo "Error: No file specified" >&2
            echo "Try: tds_html --help" >&2
            return 1
        fi
    fi

    if [[ "$full_document" == true ]]; then
        tds_html_document "$file" "$title" "$theme"
    else
        echo '<article class="tds-doc">'
        tds_render_html "$file"
        echo '</article>'
    fi
}

# Export functions
export -f tds_render_html tds_html tds_html_document tds_html_generate_css

# Execute if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    tds_html "$@"
fi
