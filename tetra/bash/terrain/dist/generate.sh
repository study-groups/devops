#!/usr/bin/env bash
# Terrain Theme Generator
# Generates example pages for each theme variation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THEMES_DIR="$SCRIPT_DIR/themes"
EXAMPLES_DIR="$SCRIPT_DIR/examples"

# Theme list
THEMES=(dark midnight forest amber)

# Generate example page for a theme
generate_example() {
    local theme="$1"
    local output="$EXAMPLES_DIR/${theme}.html"

    cat > "$output" << 'HEREDOC_END'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terrain Theme: THEME_NAME</title>
    <link rel="stylesheet" href="../themes/THEME_NAME.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            padding: 2rem;
        }
        .container { max-width: 800px; margin: 0 auto; }
        h1 {
            color: var(--accent-primary);
            margin-bottom: 1rem;
            font-size: 2rem;
        }
        h2 {
            color: var(--text-secondary);
            margin: 2rem 0 1rem;
            font-size: 1.2rem;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .card {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1rem;
        }
        .card:hover {
            border-color: var(--border-visible);
        }
        .card-title {
            color: var(--text-primary);
            font-weight: 600;
            margin-bottom: 0.5rem;
        }
        .card-body {
            color: var(--text-secondary);
            font-size: 0.9rem;
            line-height: 1.6;
        }
        .btn {
            display: inline-block;
            padding: 0.5rem 1rem;
            border: 1px solid var(--accent-primary);
            background: transparent;
            color: var(--accent-primary);
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-right: 0.5rem;
            margin-top: 1rem;
        }
        .btn:hover {
            background: var(--accent-primary);
            color: var(--bg-primary);
        }
        .btn-success { border-color: var(--success); color: var(--success); }
        .btn-success:hover { background: var(--success); }
        .btn-error { border-color: var(--error); color: var(--error); }
        .btn-error:hover { background: var(--error); }
        .btn-warning { border-color: var(--warning); color: var(--warning); }
        .btn-warning:hover { background: var(--warning); }
        .swatch-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 1rem;
        }
        .swatch {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 1rem;
            text-align: center;
        }
        .swatch-color {
            width: 100%;
            height: 40px;
            border-radius: 4px;
            margin-bottom: 0.5rem;
        }
        .swatch-name {
            font-size: 0.7rem;
            color: var(--text-muted);
            font-family: monospace;
        }
        code {
            background: var(--bg-tertiary);
            color: var(--text-code);
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-size: 0.85em;
        }
        .input-group { margin-bottom: 1rem; }
        .input-group label {
            display: block;
            color: var(--text-muted);
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 0.25rem;
        }
        .input-group input {
            width: 100%;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            color: var(--text-primary);
            padding: 0.75rem;
            border-radius: 4px;
            font-size: 0.9rem;
        }
        .input-group input:focus {
            outline: none;
            border-color: var(--accent-primary);
        }
        .status-badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 3px;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        .status-success { background: var(--success); color: var(--bg-primary); }
        .status-error { background: var(--error); color: white; }
        .status-warning { background: var(--warning); color: var(--bg-primary); }
    </style>
</head>
<body>
    <div class="container">
        <h1>THEME_NAME Theme</h1>
        <p style="color: var(--text-secondary); margin-bottom: 2rem;">
            TUT-compatible design token preview for the <code>THEME_NAME</code> theme.
        </p>

        <h2>Color Swatches</h2>
        <div class="swatch-grid">
            <div class="swatch">
                <div class="swatch-color" style="background: var(--bg-primary);"></div>
                <div class="swatch-name">--bg-primary</div>
            </div>
            <div class="swatch">
                <div class="swatch-color" style="background: var(--bg-secondary);"></div>
                <div class="swatch-name">--bg-secondary</div>
            </div>
            <div class="swatch">
                <div class="swatch-color" style="background: var(--bg-tertiary);"></div>
                <div class="swatch-name">--bg-tertiary</div>
            </div>
            <div class="swatch">
                <div class="swatch-color" style="background: var(--accent-primary);"></div>
                <div class="swatch-name">--accent-primary</div>
            </div>
            <div class="swatch">
                <div class="swatch-color" style="background: var(--success);"></div>
                <div class="swatch-name">--success</div>
            </div>
            <div class="swatch">
                <div class="swatch-color" style="background: var(--error);"></div>
                <div class="swatch-name">--error</div>
            </div>
            <div class="swatch">
                <div class="swatch-color" style="background: var(--warning);"></div>
                <div class="swatch-name">--warning</div>
            </div>
            <div class="swatch">
                <div class="swatch-color" style="background: var(--text-code); border: 1px solid var(--border);"></div>
                <div class="swatch-name">--text-code</div>
            </div>
        </div>

        <h2>Cards</h2>
        <div class="card">
            <div class="card-title">Primary Card</div>
            <div class="card-body">
                This card uses <code>--bg-secondary</code> background with <code>--border</code> outline.
                Text colors demonstrate the hierarchy from primary to secondary.
            </div>
            <button class="btn">Action</button>
            <button class="btn btn-success">Success</button>
            <button class="btn btn-error">Error</button>
        </div>

        <h2>Form Elements</h2>
        <div class="card">
            <div class="input-group">
                <label>Text Input</label>
                <input type="text" placeholder="Enter text...">
            </div>
            <div class="input-group">
                <label>Another Field</label>
                <input type="text" value="Pre-filled value">
            </div>
        </div>

        <h2>Status Badges</h2>
        <div class="card">
            <span class="status-badge status-success">Success</span>
            <span class="status-badge status-error">Error</span>
            <span class="status-badge status-warning">Warning</span>
        </div>

        <h2>Typography</h2>
        <div class="card">
            <p style="color: var(--text-primary); margin-bottom: 0.5rem;">
                <strong>Primary text</strong> - High contrast, main content
            </p>
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                Secondary text - Supporting information and descriptions
            </p>
            <p style="color: var(--text-muted);">
                Muted text - Labels, hints, and less important info
            </p>
        </div>
    </div>
</body>
</html>
HEREDOC_END

    # Replace placeholder with theme name
    sed -i '' "s/THEME_NAME/${theme}/g" "$output"
    echo "Generated: $output"
}

# Generate all examples
main() {
    echo "Terrain Theme Generator"
    echo "======================="
    echo ""

    # Ensure directories exist
    mkdir -p "$EXAMPLES_DIR"

    for theme in "${THEMES[@]}"; do
        if [[ -f "$THEMES_DIR/${theme}.css" ]]; then
            generate_example "$theme"
        else
            echo "Warning: Theme file not found: $THEMES_DIR/${theme}.css"
        fi
    done

    echo ""
    echo "Done! Open examples in browser:"
    echo "  open $EXAMPLES_DIR/*.html"
}

main "$@"
