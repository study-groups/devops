#!/usr/bin/env bash

# Tetra Dashboard Server
# Serves the new dashboard interface

serve_dashboard() {
    local port="${1:-8080}"
    local current_dir="$PWD"

    echo "🚀 Tetra Demo 010 Dashboard"
    echo "=========================="

    # Generate fresh AST data for the dashboard
    echo "🔄 Generating fresh module discovery data..."
    bash "$(dirname "${BASH_SOURCE[0]}")/generate_ast_json.sh"
    echo
    echo "📱 Dashboard: http://localhost:$port/web/dashboard.html"
    echo "📊 Features:"
    echo "  • Interactive module explorer"
    echo "  • Code analysis and metrics"
    echo "  • Architecture visualization"
    echo "  • Test suite overview"
    echo "  • Technical narrative"
    echo
    echo "🔧 Navigation:"
    echo "  • Summary: Overview and code analysis"
    echo "  • Modules: Interactive module browser"
    echo "  • Tests: Test suite status and coverage"
    echo "  • Architecture: System design and patterns"
    echo
    echo "⌨️  Keyboard shortcuts:"
    echo "  • Alt+1: Summary view"
    echo "  • Alt+2: Modules view"
    echo "  • Alt+3: Tests view"
    echo "  • Alt+4: Architecture view"
    echo

    if command -v python3 >/dev/null; then
        echo "🌐 Starting server on port $port..."
        echo "📁 Serving from: $current_dir"
        echo
        echo "Press Ctrl+C to stop the server"
        echo
        python3 -m http.server "$port"
    else
        echo "❌ Python3 not found"
        echo "📂 Manual access: Open web/dashboard.html in your browser"
        echo "📍 Location: $current_dir/web/dashboard.html"
    fi
}

# Show quick demo
show_demo_info() {
    echo "📦 Demo 010 Structure:"
    echo "├── web/"
    echo "│   ├── dashboard.html      # Main dashboard interface"
    echo "│   ├── css/dashboard.css   # Dashboard styling"
    echo "│   ├── js/dashboard.js     # Dashboard logic"
    echo "│   └── iframes/"
    echo "│       ├── summary.iframe.html       # Code analysis"
    echo "│       ├── modules.iframe.html       # Module explorer"
    echo "│       ├── tests.iframe.html         # Test overview"
    echo "│       └── architecture.iframe.html  # System design"
    echo "├── tests/          # Test modules"
    echo "├── debug/          # Debug utilities"
    echo "├── themes/         # Color themes"
    echo "└── modules/        # TUI framework modules"
    echo
    echo "🎯 Key Features:"
    echo "• Unified TUI/Web rendering framework"
    echo "• AST-based code analysis"
    echo "• Interactive module browser"
    echo "• Comprehensive test suite visualization"
    echo "• Technical documentation and narratives"
}

# Main execution
case "${1:-serve}" in
    "serve")
        serve_dashboard "$2"
        ;;
    "info"|"demo")
        show_demo_info
        ;;
    *)
        echo "Usage: $0 [serve|info] [port]"
        echo "  serve - Start dashboard server (default)"
        echo "  info  - Show demo structure and features"
        echo ""
        echo "Example: $0 serve 8080"
        ;;
esac