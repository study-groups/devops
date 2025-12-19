#!/usr/bin/env bash
# doc.sh - Generated document operations
# Usage: tut doc <verb> [args]

_tut_doc() {
    local verb="${1:-help}"
    shift || true

    case "$verb" in
        list|ls)     _tut_doc_list "$@" ;;
        serve|s)     _tut_doc_serve "$@" ;;
        open|o)      _tut_doc_open "$@" ;;
        index)       _tut_doc_index "$@" ;;
        run|r)       _tut_doc_run "$@" ;;
        browse|b)    _tut_doc_browse "$@" ;;
        help|"")     _tut_doc_help ;;
        *)
            _tut_error "Unknown: doc $verb"
            _tut_doc_help
            return 1
            ;;
    esac
}

_tut_doc_help() {
    _tut_heading 2 "tut doc"
    echo
    echo "  Manage generated documents"
    echo
    _tut_section "COMMANDS"
    echo "  list, ls      List generated documents"
    echo "  serve, s      Start preview server"
    echo "  open, o       Open document in browser"
    echo "  index         Generate landing page"
    echo "  run, r        Interactive mode with terminal"
    echo "  browse, b     CLI step-by-step navigator"
    echo
    _tut_section "EXAMPLES"
    echo "  tut doc list"
    echo "  tut doc serve"
    echo "  tut doc open gdocs-guide.html"
}

# =============================================================================
# LIST
# =============================================================================

_tut_doc_list() {
    _tut_heading 2 "Generated Documents"
    _tut_dim "  $TUT_DIR/generated/"; echo
    echo

    if [[ -d "$TUT_DIR/generated" ]]; then
        local count=0
        local missing_provenance=0
        shopt -s nullglob
        for file in "$TUT_DIR/generated"/*.html "$TUT_DIR/generated"/*.md; do
            if [[ -f "$file" ]]; then
                local name=$(basename "$file")
                local size=$(du -h "$file" | cut -f1)

                # Extract metadata from HTML
                local source="" version="" doc_type=""
                if [[ "$file" == *.html ]]; then
                    source=$(grep -o 'name="tut:source" content="[^"]*"' "$file" 2>/dev/null | sed 's/.*content="\([^"]*\)".*/\1/')
                    version=$(grep -o 'name="tut:version" content="[^"]*"' "$file" 2>/dev/null | sed 's/.*content="\([^"]*\)".*/\1/')
                    doc_type=$(grep -o 'name="tut:type" content="[^"]*"' "$file" 2>/dev/null | sed 's/.*content="\([^"]*\)".*/\1/')
                fi

                # Format display
                local version_str=""
                [[ -n "$version" ]] && version_str="v$version"
                local source_str=""
                if [[ -n "$source" ]]; then
                    source_str="<- $source"
                else
                    source_str="(no provenance)"
                    ((missing_provenance++))
                fi

                printf "  %-28s %6s %4s  %s\n" "$name" "$version_str" "$size" "$source_str"
                ((count++))
            fi
        done
        shopt -u nullglob

        if [[ $count -eq 0 ]]; then
            _tut_dim "  (none)"; echo
        else
            echo
            echo "  Total: $count file(s)"
            [[ $missing_provenance -gt 0 ]] && echo "  Rebuild $missing_provenance file(s) to add provenance metadata"
        fi
    else
        _tut_warn "No generated directory"
    fi
}

# =============================================================================
# SERVE
# =============================================================================

_tut_doc_serve() {
    local file="" port="" action="start"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --stop)       action="stop"; shift ;;
            --status)     action="status"; shift ;;
            --port|-p)    port="$2"; shift 2 ;;
            -*)           echo "Unknown option: $1"; return 1 ;;
            *)            file="$1"; shift ;;
        esac
    done

    local serve_dir="$TUT_DIR/generated"

    # Check TSM is available
    if ! declare -f tsm >/dev/null 2>&1; then
        _tut_error "TSM not loaded. Source tetra first."
        return 1
    fi

    case "$action" in
        start)
            mkdir -p "$serve_dir"

            if [[ -n "$port" ]]; then
                tsm start --port "$port" tut
            else
                tsm start tut
            fi

            # Open specific file if provided
            if [[ -n "$file" ]]; then
                sleep 0.5
                local running_port=$(tsm ls 2>/dev/null | grep -E "tut.*online" | awk '{print $5}' | head -1)
                if [[ -n "$running_port" ]]; then
                    [[ "$file" != /* && ! -f "$file" ]] && file="$serve_dir/$file"
                    local url="http://localhost:$running_port/$(basename "$file")"
                    _tut_open_url "$url"
                fi
            fi
            ;;

        stop)
            local pids=$(tsm ls 2>/dev/null | grep -E "^\s*[0-9]+.*tut" | awk '{print $1}')
            if [[ -n "$pids" ]]; then
                for pid in $pids; do
                    tsm stop "$pid"
                done
                _tut_success "Server stopped"
            else
                _tut_info "Server not running"
            fi
            ;;

        status)
            tsm ls 2>/dev/null | grep -E "(ID|tut)" || echo "Not running"
            ;;
    esac
}

# =============================================================================
# OPEN
# =============================================================================

_tut_doc_open() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Usage: tut doc open <name>"
        return 1
    fi

    local file="$TUT_DIR/generated/$name"
    [[ ! "$name" == *.html ]] && file="${file}.html"

    if [[ ! -f "$file" ]]; then
        _tut_error "Document not found: $name"
        _tut_info "Available: tut doc list"
        return 1
    fi

    _tut_open_url "file://$file"
}

# =============================================================================
# INDEX
# =============================================================================

_tut_doc_index() {
    local output_dir="${TUT_OUTPUT_DIR:-$TUT_DIR/generated}"
    local output_file="$output_dir/index.html"
    local now=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    mkdir -p "$output_dir"

    # Collect doc info from output directory
    local docs=()
    shopt -s nullglob
    for file in "$output_dir"/*.html; do
        [[ "$(basename "$file")" == "index.html" ]] && continue
        [[ -f "$file" ]] || continue

        local name=$(basename "$file")
        local title=$(grep -o '<title>[^<]*</title>' "$file" 2>/dev/null | sed 's/<[^>]*>//g')
        local version=$(grep -o 'name="tut:version" content="[^"]*"' "$file" 2>/dev/null | sed 's/.*content="\([^"]*\)".*/\1/')
        local doc_type=$(grep -o 'name="tut:type" content="[^"]*"' "$file" 2>/dev/null | sed 's/.*content="\([^"]*\)".*/\1/')
        local updated=$(grep -o 'name="tut:updated" content="[^"]*"' "$file" 2>/dev/null | sed 's/.*content="\([^"]*\)".*/\1/')

        [[ -z "$title" ]] && title="$name"
        [[ -z "$doc_type" ]] && doc_type="doc"
        [[ -z "$version" ]] && version="-"

        docs+=("$name|$title|$doc_type|$version|$updated")
    done
    shopt -u nullglob

    if [[ ${#docs[@]} -eq 0 ]]; then
        _tut_warn "No documents found in $output_dir"
        return 1
    fi

    # Generate HTML
    cat > "$output_file" << 'HEADER'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TUT Documentation</title>
    <style>
        :root {
            --bg-primary: #1a1a2e;
            --bg-secondary: #16213e;
            --bg-card: #0d1b2a;
            --text-title: #eaeaea;
            --text-primary: #c0c0d0;
            --text-secondary: #8a8aa0;
            --accent: #e94560;
            --border: #2a2a4a;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            padding: 2rem;
        }
        .container { max-width: 900px; margin: 0 auto; }
        h1 {
            color: var(--text-title);
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }
        .subtitle {
            color: var(--text-secondary);
            margin-bottom: 2rem;
        }
        .doc-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1rem;
        }
        .doc-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1.25rem;
            text-decoration: none;
            transition: border-color 0.2s, transform 0.2s;
        }
        .doc-card:hover {
            border-color: var(--accent);
            transform: translateY(-2px);
        }
        .doc-title {
            color: var(--text-title);
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }
        .doc-meta {
            display: flex;
            gap: 1rem;
            font-size: 0.8rem;
            color: var(--text-secondary);
        }
        .doc-type {
            background: var(--bg-secondary);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            text-transform: uppercase;
            font-size: 0.7rem;
            letter-spacing: 0.5px;
        }
        .doc-type.reference { color: #60a5fa; }
        .doc-type.guide { color: #4ade80; }
        footer {
            margin-top: 3rem;
            padding-top: 1rem;
            border-top: 1px solid var(--border);
            font-size: 0.75rem;
            color: var(--text-secondary);
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Documentation</h1>
        <p class="subtitle">Generated with TUT</p>
        <div class="doc-grid">
HEADER

    # Add each doc card
    for doc in "${docs[@]}"; do
        IFS='|' read -r name title doc_type version updated <<< "$doc"
        cat >> "$output_file" << CARD
            <a href="$name" class="doc-card">
                <div class="doc-title">$title</div>
                <div class="doc-meta">
                    <span class="doc-type $doc_type">$doc_type</span>
                    <span>v$version</span>
                </div>
            </a>
CARD
    done

    # Close HTML
    cat >> "$output_file" << FOOTER
        </div>
        <footer>
            ${#docs[@]} documents - Generated $now
        </footer>
    </div>
</body>
</html>
FOOTER

    _tut_success "Generated index.html"
    echo "  ${#docs[@]} documents"
    echo "  $output_file"
}

# =============================================================================
# RUN - Interactive guide with real terminal
# =============================================================================

_tut_doc_run() {
    local guide=""
    local org=""
    local port="4446"
    local no_browser=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --org)        org="$2"; shift 2 ;;
            --port)       port="$2"; shift 2 ;;
            --no-browser) no_browser=true; shift ;;
            -*)           _tut_error "Unknown option: $1"; return 1 ;;
            *)            guide="$1"; shift ;;
        esac
    done

    [[ -z "$guide" ]] && {
        _tut_heading 2 "tut doc run"
        echo
        echo "  Usage: tut doc run <guide> [--org <name>] [--port <port>]"
        echo
        echo "  Examples:"
        echo "    tut doc run tkm-guide --org pixeljam-arcade"
        echo "    tut doc run tkm-guide.template.json --org myorg"
        return 1
    }

    _tut_heading 2 "Interactive Guide: $guide"
    echo

    # Step 1: Find and hydrate if template
    local guide_path=""
    local is_template=false

    if [[ -f "$guide" ]]; then
        guide_path="$guide"
    elif [[ -f "$TUT_SRC/available/$guide" ]]; then
        guide_path="$TUT_SRC/available/$guide"
    elif [[ -f "$TUT_SRC/available/${guide}.template.json" ]]; then
        guide_path="$TUT_SRC/available/${guide}.template.json"
        is_template=true
    elif [[ -f "$TUT_SRC/available/${guide}.json" ]]; then
        guide_path="$TUT_SRC/available/${guide}.json"
    else
        _tut_error "Guide not found: $guide"
        return 1
    fi

    # Hydrate if template
    local final_guide="$guide_path"
    if [[ "$guide_path" == *".template."* ]] || $is_template; then
        _tut_info "Hydrating template..."

        source "$TUT_SRC/core/hydrate.sh"

        local hydrate_args=("$guide_path")
        [[ -n "$org" ]] && hydrate_args+=(--org "$org")

        final_guide=$(tut_hydrate "${hydrate_args[@]}")
        [[ $? -ne 0 ]] && return 1
    fi

    # Step 2: Build HTML
    _tut_info "Building guide..."
    local guide_name=$(basename "$final_guide" .json)
    _tut_source_build "$guide_name"
    [[ $? -ne 0 ]] && return 1

    # Step 3: Start tut-interactive server
    _tut_info "Starting interactive server..."

    local running=$(tsm ls 2>/dev/null | grep -E "tut-interactive.*online" | head -1)
    if [[ -z "$running" ]]; then
        if [[ ! -d "$TUT_SRC/server/node_modules" ]]; then
            _tut_info "Installing server dependencies..."
            (cd "$TUT_SRC/server" && npm install --silent)
        fi

        if command -v tsm &>/dev/null; then
            tsm start tut-interactive 2>/dev/null || {
                (cd "$TUT_SRC/server" && node tut-server.js --port "$port" &)
                sleep 1
            }
        else
            (cd "$TUT_SRC/server" && node tut-server.js --port "$port" &)
            sleep 1
        fi
    fi

    # Step 4: Open in browser
    local url="http://127.0.0.1:$port/guide/$guide_name"
    _tut_accent "Opening: $url"
    echo

    if ! $no_browser; then
        _tut_open_url "$url"
    fi

    _tut_info "Server running. Stop with: tsm stop tut-interactive"
}

# =============================================================================
# BROWSE - CLI step-by-step navigator
# =============================================================================

_tut_doc_browse() {
    local file="$1"

    if [[ -z "$file" ]]; then
        echo "Usage: tut doc browse <file.md>"
        return 1
    fi

    # Delegate to tut_browse if it exists
    if declare -f tut_browse >/dev/null 2>&1; then
        tut_browse "$file"
    else
        _tut_error "Browse function not loaded"
        return 1
    fi
}
