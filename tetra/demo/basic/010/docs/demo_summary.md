Demo System Module Architecture Review

  Core Architecture

  The demo/basic/010 system implements a layered TUI framework with web
  dashboard integration:

  1. Entry Point & Controller

  - demo.sh - Main controller providing demo <cmd> interface
  - Manages both TUI app and web server lifecycle
  - Uses environment variables: DEMO_SRC, DEMO_DIR

  2. Application Layer (bash/app/)

  - app.sh - Main TUI application orchestrator
  - Component System: components/component_system.sh - Game-like lifecycle
  management
  - Rendering: rendering/double_buffer.sh - Optimized display updates
  - Input: input/game_input.sh - Gamepad-style navigation
  - Controllers: controllers/view_controllers.sh - View state management
  - REPL: repl.sh - Interactive command processor

  3. Framework Layer (bash/modules/)

  - tetra_framework.sh - Pub-Sub state management, multi-target rendering
  - local_ast.sh - Code analysis and module discovery
  - Supports RENDER_TERMINAL, RENDER_HTML, RENDER_JSON targets

  4. Web Integration (web/)

  - dashboard.html - Multi-view web interface
  - Live module analysis via JSON API
  - Synchronized with TUI state through framework

  Module Interaction Patterns

  Initialization Flow:
  demo.sh → app.sh → component_system.sh → tetra_framework.sh

  State Management:
  - Framework uses associative arrays: TETRA_STATE[], TETRA_SUBSCRIBERS[]
  - Pub-Sub pattern: tetra_publish/subscribe for cross-module communication
  - Components track lifecycle: COMPONENT_MOUNTED, COMPONENT_UPDATING

  Rendering Pipeline:
  1. Double buffer prevents flicker
  2. Components mark themselves dirty
  3. Framework renders to target (terminal/HTML/JSON)
  4. Web dashboard consumes JSON for live updates

  Command Routing:
  - action_router.sh maps input to handlers
  - REPL processes commands through handler system
  - Web server provides REST-like API endpoints

⏺ The demo system demonstrates clean separation between TUI and web
  concerns while sharing a unified state model, making it suitable for
  replacing the complex bash/tview/ system with these proven patterns.

