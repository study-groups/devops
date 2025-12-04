#!/usr/bin/env bash

# Chroma Code Highlighting
# Language detection and syntax highlighting for code blocks

#==============================================================================
# LANGUAGE DETECTION PATTERNS
#==============================================================================

# Detect language from code content
# Returns: language name suitable for bat/pygments, or "text" if unknown
chroma_detect_language() {
    local code="$1"
    local first_line="${code%%$'\n'*}"

    # Shebang detection
    if [[ "$first_line" =~ ^#! ]]; then
        [[ "$first_line" =~ python ]] && { echo "python"; return; }
        [[ "$first_line" =~ node ]] && { echo "javascript"; return; }
        [[ "$first_line" =~ bash|sh ]] && { echo "bash"; return; }
        [[ "$first_line" =~ ruby ]] && { echo "ruby"; return; }
        [[ "$first_line" =~ perl ]] && { echo "perl"; return; }
        [[ "$first_line" =~ php ]] && { echo "php"; return; }
    fi

    # JSON - starts with { or [ and has quotes/colons
    if [[ "$code" =~ ^[[:space:]]*[\{\[] ]] && [[ "$code" =~ \":\" ]]; then
        echo "json"; return
    fi

    # TOML - [section] headers and key = value
    if [[ "$code" =~ ^\[.*\] ]] && [[ "$code" =~ ^[a-zA-Z_]+[[:space:]]*= ]]; then
        echo "toml"; return
    fi

    # YAML - key: value patterns, often starts with ---
    if [[ "$code" =~ ^--- ]] || [[ "$code" =~ ^[a-zA-Z_]+:[[:space:]] ]]; then
        # Distinguish from other formats
        if [[ ! "$code" =~ [\{\}] ]] && [[ "$code" =~ :[[:space:]] ]]; then
            echo "yaml"; return
        fi
    fi

    # HTML/XML - tags
    if [[ "$code" =~ \<[a-zA-Z]+.*\> ]] && [[ "$code" =~ \</[a-zA-Z]+\> ]]; then
        [[ "$code" =~ \<html|\<head|\<body|\<div|\<span ]] && { echo "html"; return; }
        echo "xml"; return
    fi

    # CSS - selectors and properties
    if [[ "$code" =~ \{[[:space:]]*[a-z-]+:[[:space:]] ]] && [[ "$code" =~ [\.\#][a-zA-Z] ]]; then
        echo "css"; return
    fi

    # SQL - keywords
    if [[ "$code" =~ (SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)[[:space:]] ]]; then
        echo "sql"; return
    fi

    # Rust - fn main, let mut, ::, impl
    if [[ "$code" =~ fn[[:space:]]+[a-z_]+\( ]] && [[ "$code" =~ (let[[:space:]]+mut|::|impl[[:space:]]) ]]; then
        echo "rust"; return
    fi

    # Go - func, package, import with no class keyword
    if [[ "$code" =~ ^package[[:space:]] ]] || [[ "$code" =~ func[[:space:]]+[a-zA-Z_]+\( ]]; then
        [[ ! "$code" =~ class[[:space:]] ]] && { echo "go"; return; }
    fi

    # TypeScript - : Type annotations with JS syntax
    if [[ "$code" =~ :[[:space:]]*(string|number|boolean|void|any)\b ]] || [[ "$code" =~ interface[[:space:]] ]]; then
        echo "typescript"; return
    fi

    # JavaScript - function, const/let, =>, class
    if [[ "$code" =~ (function[[:space:]]|const[[:space:]]|let[[:space:]]|=\>|\$\() ]]; then
        echo "javascript"; return
    fi

    # Python - def, import, class with : and indentation
    if [[ "$code" =~ ^(def|class|import|from)[[:space:]] ]] || [[ "$code" =~ :[[:space:]]*$ ]]; then
        # Check for Python-specific patterns
        if [[ "$code" =~ (def[[:space:]]+[a-z_]+\(|import[[:space:]]+[a-z]|self\.|__[a-z]+__) ]]; then
            echo "python"; return
        fi
    fi

    # Ruby - def, end, do..end, @variables
    if [[ "$code" =~ (def[[:space:]]|end$|do[[:space:]]*$|@[a-z_]+) ]]; then
        [[ "$code" =~ \|[a-z_]+\| ]] && { echo "ruby"; return; }
    fi

    # Bash/Shell - common commands, $VAR, [[, function
    if [[ "$code" =~ (\$\{|\[\[|function[[:space:]]+[a-z_]+|echo[[:space:]]|if[[:space:]]+\[\[) ]]; then
        echo "bash"; return
    fi

    # C/C++ - #include, int main, pointers
    if [[ "$code" =~ ^#include ]] || [[ "$code" =~ (int|void|char)[[:space:]]+main\( ]]; then
        [[ "$code" =~ (cout|cin|class|template|namespace) ]] && { echo "cpp"; return; }
        echo "c"; return
    fi

    # Java - public class, System.out
    if [[ "$code" =~ public[[:space:]]+(class|static|void) ]] || [[ "$code" =~ System\.(out|in) ]]; then
        echo "java"; return
    fi

    # PHP - <?php, $variables with ->
    if [[ "$code" =~ ^\<\?php ]] || [[ "$code" =~ \$[a-zA-Z_]+-\> ]]; then
        echo "php"; return
    fi

    # Markdown - headers, links, emphasis (only if clearly markdown)
    if [[ "$code" =~ ^#{1,6}[[:space:]] ]] && [[ "$code" =~ \[.*\]\(.*\) ]]; then
        echo "markdown"; return
    fi

    # Default
    echo "text"
}

#==============================================================================
# SYNTAX HIGHLIGHTING
#==============================================================================

# Check if bat is available
_chroma_has_bat() {
    command -v bat &>/dev/null
}

# Highlight code with bat
_chroma_highlight_bat() {
    local lang="$1"
    local theme="${CHROMA_BAT_THEME:-ansi}"

    bat --language="$lang" \
        --style=plain \
        --color=always \
        --theme="$theme" \
        --paging=never 2>/dev/null || cat
}

# Simple fallback highlighter (basic patterns)
_chroma_highlight_simple() {
    local lang="$1"
    local c_keyword=$(tput setaf 5)    # magenta
    local c_string=$(tput setaf 2)     # green
    local c_comment=$(tput setaf 8)    # gray
    local c_number=$(tput setaf 6)     # cyan
    local c_reset=$(tput sgr0)

    case "$lang" in
        bash|sh)
            sed -E \
                -e "s/(#.*)$/${c_comment}\1${c_reset}/g" \
                -e "s/\b(if|then|else|fi|for|do|done|while|case|esac|function|return|local|export|source)\b/${c_keyword}\1${c_reset}/g" \
                -e "s/(\"[^\"]*\")/${c_string}\1${c_reset}/g" \
                -e "s/('([^']|\\')*')/${c_string}\1${c_reset}/g"
            ;;
        python)
            sed -E \
                -e "s/(#.*)$/${c_comment}\1${c_reset}/g" \
                -e "s/\b(def|class|import|from|if|elif|else|for|while|return|try|except|finally|with|as|yield|lambda|pass|break|continue|True|False|None)\b/${c_keyword}\1${c_reset}/g" \
                -e "s/(\"\"\"[^\"]*\"\"\"|'''[^']*''')/${c_string}\1${c_reset}/g" \
                -e "s/(\"[^\"]*\"|'[^']*')/${c_string}\1${c_reset}/g"
            ;;
        javascript|typescript)
            sed -E \
                -e "s:(//.*$):${c_comment}\1${c_reset}:g" \
                -e "s/\b(function|const|let|var|if|else|for|while|return|class|extends|import|export|from|async|await|try|catch|throw|new|this|true|false|null|undefined)\b/${c_keyword}\1${c_reset}/g" \
                -e "s/(\`[^\`]*\`)/${c_string}\1${c_reset}/g" \
                -e "s/(\"[^\"]*\"|'[^']*')/${c_string}\1${c_reset}/g"
            ;;
        json)
            sed -E \
                -e "s/(\"[^\"]+\")[[:space:]]*:/${c_keyword}\1${c_reset}:/g" \
                -e "s/:[[:space:]]*(\"[^\"]*\")/:${c_string}\1${c_reset}/g" \
                -e "s/\b(true|false|null)\b/${c_number}\1${c_reset}/g" \
                -e "s/\b([0-9]+\.?[0-9]*)\b/${c_number}\1${c_reset}/g"
            ;;
        *)
            # Pass through unchanged
            cat
            ;;
    esac
}

# Main highlight function - uses bat if available, falls back to simple
chroma_highlight_code() {
    local lang="$1"

    if _chroma_has_bat; then
        _chroma_highlight_bat "$lang"
    else
        _chroma_highlight_simple "$lang"
    fi
}

#==============================================================================
# CODE BLOCK EXTRACTION
#==============================================================================

# Check if line looks like code (heuristics for unfenced blocks)
# More conservative: requires strong code signals, not just indentation
chroma_looks_like_code() {
    local line="$1"
    local trimmed="${line#"${line%%[![:space:]]*}"}"

    # Skip if contains prose indicators (arrows, bullets, sentences)
    [[ "$trimmed" == *→* || "$trimmed" == *↘* || "$trimmed" == *•* ]] && return 1
    [[ "$trimmed" =~ \.\.\. ]] && return 1  # Ellipsis = prose

    # Strong code patterns (standalone, not just endings)
    [[ "$trimmed" =~ ^(import|from|const|let|var|function|def|class|package|use|return|if|for|while)[[:space:]\(] ]] && return 0
    [[ "$trimmed" == *'${'*'}'* ]] && return 0  # Shell variable ${VAR}
    [[ "$trimmed" =~ ^[a-zA-Z_]+\(\)\s*\{ ]] && return 0  # Function definition
    [[ "$trimmed" =~ ^\s*[a-zA-Z_]+\s*=\s*[\"\'\[\{] ]] && return 0  # Assignment with literal

    # Only treat as code if indented AND has code-like syntax
    if [[ "$line" =~ ^[[:space:]]{4,} ]]; then
        # Must have brackets, operators, or keywords
        [[ "$trimmed" =~ [\{\}\[\]\(\)] ]] && return 0
        [[ "$trimmed" =~ (=\>|\->|::|\$\{) ]] && return 0
    fi

    return 1
}

# Detect inline code patterns that should be highlighted
# Returns 0 if line contains inline code worth highlighting
chroma_has_inline_code() {
    local line="$1"
    [[ "$line" =~ \`[^\`]+\` ]] && return 0
    return 1
}

#==============================================================================
# EXPORTS
#==============================================================================

export -f chroma_detect_language chroma_highlight_code
export -f chroma_looks_like_code chroma_has_inline_code
export -f _chroma_has_bat _chroma_highlight_bat _chroma_highlight_simple
